-- 0012: the rest of the clean-up after the older 10-28 update was run again (see 0011).
-- Run in the Supabase SQL editor (it contains DELETE inside the device-code merge, which the tool cannot apply).
-- 1) the current device-code merge (same code as 0006); 2) the helper the old copy added is no longer used;
-- 3) the empty 'autorev' row goes and admin_docs takes the same four ids as before.

create or replace function public.link_redeem(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_row private.link_codes%rowtype;
  v_try private.link_tries%rowtype;
  v_owner uuid;
  v_mine jsonb; v_doc jsonb;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  select * into v_try from private.link_tries t where t.uid = v_me for update;
  if v_try.uid is null then insert into private.link_tries (uid, n, window_start) values (v_me, 1, now());
  elsif v_try.window_start < now() - interval '10 minutes' then update private.link_tries t set n = 1, window_start = now() where t.uid = v_me;
  elsif v_try.n >= 8 then return jsonb_build_object('ok', false, 'err', 'slow_down');
  else update private.link_tries t set n = t.n + 1 where t.uid = v_me; end if;

  select * into v_row from private.link_codes c
  where c.code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') and c.expires_at > now();
  if v_row.code_hash is null then return jsonb_build_object('ok', false, 'err', 'bad_code'); end if;
  v_owner := v_row.owner;
  if v_owner = v_me or v_owner = public.acct() then
    delete from private.link_codes c where c.code_hash = v_row.code_hash;
    return jsonb_build_object('ok', true, 'acct', v_owner);
  end if;
  -- a device that leads a team must disband it first (members point at its id)
  if exists (select 1 from public.teams tm where tm.id = public.acct()) then return jsonb_build_object('ok', false, 'err', 'team_leader'); end if;
  delete from private.link_codes c where c.code_hash = v_row.code_hash;

  -- bring this device's own records into the account
  v_me := public.acct();
  update public.ai_tickets t set uid = v_owner where t.uid = v_me;
  insert into public.spots (uid, cid, lat, lon) select v_owner, s.cid, s.lat, s.lon from public.spots s where s.uid = v_me on conflict (uid, cid) do nothing;
  delete from public.spots s where s.uid = v_me;
  insert into public.photos (angler, cid, data) select v_owner, p.cid, p.data from public.photos p where p.angler = v_me and p.cid <> '_pic' on conflict (angler, cid) do nothing;
  delete from public.photos p where p.angler = v_me;
  select a.data into v_mine from public.anglers a where a.id = v_me;
  if v_mine is not null then
    select a.data into v_doc from public.anglers a where a.id = v_owner;
    if v_doc is null then
      insert into public.anglers (id, data) values (v_owner, v_mine);
    elsif jsonb_typeof(v_mine->'catches') = 'array' then
      update public.anglers a set data = jsonb_set(a.data, '{catches}', coalesce(a.data->'catches', '[]'::jsonb) || coalesce((
        select jsonb_agg(x) from jsonb_array_elements(v_mine->'catches') x
        where not exists (select 1 from jsonb_array_elements(coalesce(a.data->'catches', '[]'::jsonb)) y where y->>'id' = x->>'id')), '[]'::jsonb))
      where a.id = v_owner;
    end if;
    delete from public.anglers a where a.id = v_me;
  end if;
  for v_doc in select l.data from public.labels l where l.id = v_me loop
    insert into public.labels (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('items', coalesce(public.labels.data->'items', '[]'::jsonb) || coalesce(excluded.data->'items', '[]'::jsonb));
  end loop;
  delete from public.labels l where l.id = v_me;
  for v_doc in select o.data from public.orders o where o.id = v_me loop
    insert into public.orders (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('items', coalesce(public.orders.data->'items', '[]'::jsonb) || coalesce(excluded.data->'items', '[]'::jsonb));
  end loop;
  delete from public.orders o where o.id = v_me;
  for v_doc in select s.data from public.suggest s where s.id = v_me loop
    insert into public.suggest (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('items', coalesce(public.suggest.data->'items', '[]'::jsonb) || coalesce(excluded.data->'items', '[]'::jsonb));
  end loop;
  delete from public.suggest s where s.id = v_me;
  for v_doc in select private.swap_id(b.data, v_me, v_owner) from public.board b where b.id = v_me loop
    insert into public.board (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('v', 1,
      'posts', coalesce(public.board.data->'posts', '[]'::jsonb) || coalesce(excluded.data->'posts', '[]'::jsonb),
      'cmts', coalesce(public.board.data->'cmts', '[]'::jsonb) || coalesce(excluded.data->'cmts', '[]'::jsonb),
      'likes', coalesce(public.board.data->'likes', '[]'::jsonb) || coalesce(excluded.data->'likes', '[]'::jsonb),
      'reps', coalesce(public.board.data->'reps', '[]'::jsonb) || coalesce(excluded.data->'reps', '[]'::jsonb));
  end loop;
  delete from public.board b where b.id = v_me;
  -- references held by others: friend edges, comments/likes on my posts, team rosters, operator decisions
  update public.anglers a set data = private.swap_id(a.data, v_me, v_owner) where a.data::text like '%' || v_me::text || '%';
  update public.board b set data = private.swap_id(b.data, v_me, v_owner) where b.data::text like '%' || v_me::text || '%';
  update public.teams tm set data = private.swap_id(tm.data, v_me, v_owner) where tm.data::text like '%' || v_me::text || '%';
  update public.admin_docs g set data = private.swap_id(g.data, v_me, v_owner) where g.data::text like '%' || v_me::text || '%';
  -- devices that were linked to me (and the account's own first device) follow me
  update private.links l set owner = v_owner where l.owner = v_me;
  if v_me <> auth.uid() then
    insert into private.links (member, owner) values (v_me, v_owner) on conflict (member) do update set owner = excluded.owner, created_at = now();
  end if;
  insert into private.links (member, owner) values (auth.uid(), v_owner)
  on conflict (member) do update set owner = excluded.owner, created_at = now();
  return jsonb_build_object('ok', true, 'acct', v_owner);
end $$;
revoke all on function public.link_redeem(text) from public, anon;
grant execute on function public.link_redeem(text) to authenticated;

drop function if exists private.join_account(uuid);

-- when the full reset ran (2026-10-29 10:19 KST): a phone that still keeps older records does not upload them again
update public.admin_docs set data = data || jsonb_build_object('resetAt', 1793236758000::bigint) where id = 'config' and not (data ? 'resetAt');

delete from public.admin_docs where id = 'autorev' and data = '{}'::jsonb;
do $$ begin
  if not exists (select 1 from public.admin_docs where id not in ('config', 'grants', 'verdicts', 'mod')) then
    alter table public.admin_docs drop constraint if exists admin_docs_id_check;
    alter table public.admin_docs add constraint admin_docs_id_check check (id in ('config', 'grants', 'verdicts', 'mod'));
  end if;
end $$;
