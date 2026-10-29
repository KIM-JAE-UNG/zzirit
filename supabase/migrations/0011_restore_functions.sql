-- 0011: put back the current login-ID and reviewer functions.
-- On 2026-10-29 an older copy of the 10-28 server update was run again in the SQL editor. It replaced these functions
-- with their first versions: ID login could join a device to an account that had itself been joined into another one,
-- and the reviewer's notes went to admin_docs ('autorev'), which everyone can read, instead of public.reviews.
-- This file is the same code as 0007b, so running it on a fresh database changes nothing. It only adds and updates.

create or replace function public.id_me() returns text
language sql stable security definer set search_path = '' as $$ select (private.login_of(public.acct())).name; $$;

create or replace function public.id_register(p_name text, p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text := lower(btrim(coalesce(p_name, ''))); v_owner uuid := public.acct();
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  if v_name in ('admin', 'administrator', 'root', 'zzirit', 'jjirit', 'operator', 'support', 'system', 'null', 'undefined', 'test', 'manager', 'official', 'staff') then return jsonb_build_object('ok', false, 'err', 'taken'); end if;
  if length(coalesce(p_pass, '')) < 6 or length(p_pass) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  if (private.login_of(v_owner)).name is not null then return jsonb_build_object('ok', false, 'err', 'has_id'); end if;
  if not private.try_ok('reg:' || auth.uid()::text, 10, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  begin
    insert into private.logins (name, owner, pass) values (v_name, v_owner, extensions.crypt(p_pass, extensions.gen_salt('bf', 8)));
  exception when unique_violation then return jsonb_build_object('ok', false, 'err', 'taken');
  end;
  return jsonb_build_object('ok', true, 'name', v_name);
end $$;

create or replace function public.id_login(p_name text, p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text := lower(btrim(coalesce(p_name, ''))); v_row private.logins%rowtype; v_target uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if not private.try_ok('dev:' || auth.uid()::text, 10, interval '10 minutes') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  if not private.try_ok('name:' || v_name, 30, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  select * into v_row from private.logins l where l.name = v_name;
  if v_row.name is null or v_row.pass <> extensions.crypt(coalesce(p_pass, ''), v_row.pass) then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'err', 'wrong');
  end if;
  v_target := public.acct_of(v_row.owner);
  if v_target = public.acct() then return jsonb_build_object('ok', true, 'acct', v_target, 'name', v_row.name); end if;
  -- an account with its own ID stays separate: log out on this device first
  if (private.login_of(public.acct())).name is not null then return jsonb_build_object('ok', false, 'err', 'has_id'); end if;
  return private.join_with_code(v_target) || jsonb_build_object('name', v_row.name);
end $$;

create or replace function public.id_password(p_old text, p_new text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row private.logins%rowtype;
begin
  v_row := private.login_of(public.acct());
  if v_row.name is null then return jsonb_build_object('ok', false, 'err', 'no_id'); end if;
  if not private.try_ok('pw:' || auth.uid()::text, 10, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  if v_row.pass <> extensions.crypt(coalesce(p_old, ''), v_row.pass) then return jsonb_build_object('ok', false, 'err', 'wrong'); end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  update private.logins l set pass = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), changed_at = now() where l.name = v_row.name;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.review_queue(p_limit int)
returns table (uid uuid, cid text, sp text, len numeric, ts bigint, at bigint, past boolean, rel boolean, tr int, memo text,
               en text, sci text, ko text, l double precision, x double precision, photo text)
language sql stable security definer set search_path = '' as $$
  select a.id, c->>'id', c->>'sp',
    case when jsonb_typeof(c->'len') = 'number' then (c->>'len')::numeric end,
    case when jsonb_typeof(c->'ts') = 'number' then floor((c->>'ts')::numeric)::bigint end,
    case when jsonb_typeof(c->'at') = 'number' then floor((c->>'at')::numeric)::bigint end,
    coalesce(c->'past' = 'true'::jsonb, false), coalesce(c->'rel' = 'true'::jsonb, false),
    case when jsonb_typeof(c->'tr') = 'number' then round((c->>'tr')::numeric)::int end,
    left(coalesce(c->>'memo', ''), 300),
    n.en, n.sci, n.ko, s.l, s.x,
    (select p.data->>'t' from public.photos p where p.angler = a.id and p.cid = c->>'id')
  from public.anglers a
  cross join lateral jsonb_array_elements(case when jsonb_typeof(a.data->'catches') = 'array' then a.data->'catches' else '[]'::jsonb end) c
  left join private.species s on s.id = c->>'sp'
  left join private.species_names n on n.id = c->>'sp'
  where jsonb_typeof(c) = 'object' and c->>'st' = 'review'
    and (select g.data #>> array[a.id::text, c->>'id'] from public.admin_docs g where g.id = 'verdicts') is null
  order by case when jsonb_typeof(c->'at') = 'number' then (c->>'at')::numeric end nulls last
  limit greatest(1, least(p_limit, 20));
$$;

create or replace function public.review_set(p_uid uuid, p_cid text, p_v text, p_why text, p_model text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_done boolean; v_note jsonb;
begin
  if p_v not in ('ok', 'no', 'hold') or p_uid is null or coalesce(p_cid, '') = '' then return false; end if;
  insert into public.admin_docs (id, data) values ('verdicts', '{}'::jsonb) on conflict (id) do nothing;
  update public.admin_docs g set data = jsonb_set(g.data, array[p_uid::text], coalesce(g.data -> p_uid::text, '{}'::jsonb) || jsonb_build_object(p_cid, p_v))
    where g.id = 'verdicts' and (g.data #>> array[p_uid::text, p_cid]) is null
    returning true into v_done;
  if not coalesce(v_done, false) then return false; end if;
  v_note := jsonb_build_object('v', p_v, 'why', left(coalesce(p_why, ''), 200), 'm', left(coalesce(p_model, ''), 40), 'at', floor(extract(epoch from now()) * 1000)::bigint);
  insert into public.reviews (id, data, updated_at) values (p_uid, jsonb_build_object(p_cid, v_note), now())
  on conflict (id) do update set data = public.reviews.data || jsonb_build_object(p_cid, v_note), updated_at = now();
  return true;
end $$;

revoke all on function public.id_me() from public, anon;
revoke all on function public.id_register(text, text) from public, anon;
revoke all on function public.id_login(text, text) from public, anon;
revoke all on function public.id_password(text, text) from public, anon;
grant execute on function public.id_me() to authenticated;
grant execute on function public.id_register(text, text) to authenticated;
grant execute on function public.id_login(text, text) to authenticated;
grant execute on function public.id_password(text, text) to authenticated;
revoke all on function public.review_queue(int) from public, anon, authenticated;
revoke all on function public.review_set(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.review_queue(int) to service_role;
grant execute on function public.review_set(uuid, text, text, text, text) to service_role;

-- the notes the old reviewer left in admin_docs move to public.reviews (only the angler and the operator can read
-- them there); a note already in public.reviews for the same catch wins. Then the readable copy is emptied.
do $$ begin
  if exists (select 1 from public.admin_docs g where g.id = 'autorev') then
    insert into public.reviews (id, data, updated_at)
    select u.key::uuid, u.value, now()
    from public.admin_docs g cross join lateral jsonb_each(case when jsonb_typeof(g.data) = 'object' then g.data else '{}'::jsonb end) u
    where g.id = 'autorev' and u.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and jsonb_typeof(u.value) = 'object'
      and exists (select 1 from auth.users x where x.id = case when u.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then u.key::uuid end)
    on conflict (id) do update set data = excluded.data || public.reviews.data, updated_at = now();
    update public.admin_docs set data = '{}'::jsonb where id = 'autorev';
  end if;
end $$;
