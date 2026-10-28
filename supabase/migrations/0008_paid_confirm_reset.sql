-- 0008: paid items need the operator's confirmation, order spam is capped, and everyone's game progress starts over.
-- No payment ever reached the operator, so all paid looks and all orders go as well.
-- Accounts, nicknames, friends, characters (free parts), profile photos, posts and teams stay.

-- 1. Saved looks: premium looks only with an order the operator confirmed ('ok'). `own` is server-only.
create or replace function private.anglers_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old_map jsonb := '{}'::jsonb;
  v_out jsonb := '[]'::jsonb;
  v_c jsonb; v_o jsonb;
  v_cid text; v_sp text; v_st text;
  v_len numeric; v_ts_ms numeric; v_ts timestamptz; v_tr int;
  v_past boolean; v_rel boolean; v_verified boolean; v_featured boolean;
  v_tk uuid; v_ticket public.ai_tickets%rowtype;
  v_lat double precision; v_lon double precision; v_clat double precision; v_clon double precision;
  v_keep text[] := '{}';
  v_feat text[] := private.featured_species(now());
  v_now_m text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_n int := 0;
  v_gold boolean; v_palace boolean; v_own jsonb; v_x double precision;
begin
  if jsonb_typeof(new.data) <> 'object' then raise exception 'bad_doc'; end if;
  if pg_column_size(new.data) > 900000 then raise exception 'doc_too_large'; end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and jsonb_typeof(old.data->'catches') = 'array' then
    select coalesce(jsonb_object_agg(x->>'id', x), '{}'::jsonb) into v_old_map
    from jsonb_array_elements(old.data->'catches') x where jsonb_typeof(x) = 'object' and x ? 'id';
  end if;
  if length(coalesce(new.data->>'nick', '')) > 24 then
    new.data := jsonb_set(new.data, '{nick}', to_jsonb(left(new.data->>'nick', 24)));
  end if;
  if new.data ? 'fr' and jsonb_typeof(new.data->'fr') <> 'object' then new.data := new.data - 'fr'; end if;

  -- `own`: looks carried over from earlier confirmed purchases. Only trusted server code (migrations) may change it.
  if coalesce(current_setting('zz.trusted', true), '') <> '1' then
    if tg_op = 'UPDATE' and old.data ? 'own' then new.data := jsonb_set(new.data, '{own}', old.data->'own');
    else new.data := new.data - 'own'; end if;
  end if;
  v_own := case when jsonb_typeof(new.data->'own') = 'array' then new.data->'own' else '[]'::jsonb end;

  -- premium looks need an order the operator confirmed ('ok'); "I sent it" alone is not enough.
  -- A confirmed gold-name order from the old shop (fl_gold) counts for the gold set.
  select exists (select 1 from public.orders ord, jsonb_array_elements(coalesce(ord.data->'items', '[]'::jsonb)) it
    where ord.id = new.id and it->>'kind' = 'item' and it->>'ref' in ('pr_gold', 'fl_gold')
      and (select g.data #>> array[new.id::text, it->>'id'] from public.admin_docs g where g.id = 'grants') = 'ok') or v_own ? 'pr_gold' into v_gold;
  select exists (select 1 from public.orders ord, jsonb_array_elements(coalesce(ord.data->'items', '[]'::jsonb)) it
    where ord.id = new.id and it->>'kind' = 'item' and it->>'ref' = 'th_palace'
      and (select g.data #>> array[new.id::text, it->>'id'] from public.admin_docs g where g.id = 'grants') = 'ok') or v_own ? 'th_palace' into v_palace;
  if not v_gold then
    if new.data #> '{flair,gold}' = 'true'::jsonb then new.data := jsonb_set(new.data, '{flair,gold}', 'false'::jsonb); end if;
    if jsonb_typeof(new.data #> '{decor,items}') = 'array' then
      new.data := jsonb_set(new.data, '{decor,items}', coalesce((select jsonb_agg(x) from jsonb_array_elements(new.data #> '{decor,items}') x where x <> '"dc_goldboat"'::jsonb), '[]'::jsonb));
    end if;
    if jsonb_typeof(new.data #> '{decor,fx}') = 'array' then
      new.data := jsonb_set(new.data, '{decor,fx}', coalesce((select jsonb_agg(x) from jsonb_array_elements(new.data #> '{decor,fx}') x where x <> '"fx_sparkle"'::jsonb), '[]'::jsonb));
    end if;
    if new.data #>> '{char,rd}' = 'gold' then new.data := jsonb_set(new.data, '{char,rd}', '"carbon"'::jsonb); end if;
  end if;
  if not v_palace and new.data #>> '{decor,theme}' = 'th_palace' then new.data := jsonb_set(new.data, '{decor,theme}', '"th_dawn"'::jsonb); end if;

  if jsonb_typeof(new.data->'catches') = 'array' then
    for v_c in select value from jsonb_array_elements(new.data->'catches') loop
      v_n := v_n + 1;
      exit when v_n > 3000;
      if jsonb_typeof(v_c) <> 'object' or not (v_c ? 'id') then continue; end if;
      v_cid := left(v_c->>'id', 40);
      v_keep := v_keep || v_cid;
      v_lat := case when jsonb_typeof(v_c->'lat') = 'number' then (v_c->>'lat')::double precision end;
      v_lon := case when jsonb_typeof(v_c->'lon') = 'number' then (v_c->>'lon')::double precision end;
      if v_lat is not null and v_lon is not null and abs(v_lat) <= 90 and abs(v_lon) <= 180 then
        v_clat := (floor(v_lat / 0.25) + 0.5) * 0.25;
        v_clon := (floor(v_lon / 0.25) + 0.5) * 0.25;
        if v_lat <> v_clat or v_lon <> v_clon then
          insert into public.spots as s (uid, cid, lat, lon)
          values (new.id, v_cid, round(v_lat::numeric, 2), round(v_lon::numeric, 2))
          on conflict (uid, cid) do update set lat = excluded.lat, lon = excluded.lon;
        end if;
        v_c := jsonb_set(jsonb_set(v_c, '{lat}', to_jsonb(v_clat)), '{lon}', to_jsonb(v_clon));
      elsif v_c ? 'lat' or v_c ? 'lon' then
        v_c := jsonb_set(jsonb_set(v_c, '{lat}', 'null'::jsonb), '{lon}', 'null'::jsonb);
      end if;
      v_past := coalesce(v_c->'past' = 'true'::jsonb, false);
      v_o := v_old_map->v_cid;
      if v_o is not null and v_o = v_c then
        v_out := v_out || jsonb_build_array(v_o);
        continue;
      end if;

      v_sp := v_c->>'sp';
      v_len := case when jsonb_typeof(v_c->'len') = 'number' then (v_c->>'len')::numeric end;
      v_ts_ms := case when jsonb_typeof(v_c->'ts') = 'number' then (v_c->>'ts')::numeric end;
      v_ts := case when v_ts_ms is not null and v_ts_ms between 0 and 32503680000000 then to_timestamp(v_ts_ms / 1000.0) end;
      v_tr := case when jsonb_typeof(v_c->'tr') = 'number' then greatest(0, least(100, round((v_c->>'tr')::numeric)::int)) else 0 end;
      v_rel := coalesce(v_c->'rel' = 'true'::jsonb, false);
      v_st := coalesce(v_c->>'st', 'review');
      if v_st not in ('ok', 'review', 'no') then v_st := 'review'; end if;
      if (v_len is null or v_len <= 0 or v_len > 1000 or v_ts is null or v_ts > now() + interval '1 day') and v_st = 'ok' then v_st := 'review'; end if;
      -- far past the species' record size is not a real catch; past the record, a person takes a look
      v_x := null; select s.x into v_x from private.species s where s.id = v_sp;
      if v_x is not null and v_len is not null then
        if v_len > v_x * 1.3 then v_st := 'no';
        elsif v_len > v_x and v_st = 'ok' then v_st := 'review'; end if;
      end if;

      -- 'ok' needs an unused AI screening ticket issued to this account
      v_ticket := null; v_tk := null;
      begin v_tk := (v_c->>'tk')::uuid; exception when others then v_tk := null; end;
      if v_tk is not null then
        select * into v_ticket from public.ai_tickets t
        where t.nonce = v_tk and t.uid = new.id and (t.used_by is null or t.used_by = v_cid);
      end if;
      if v_st = 'ok' then
        if v_ticket.nonce is null or v_ticket.verdict is distinct from 'pass' or v_ticket.fish is false then
          v_st := 'review';
        elsif v_ticket.ai_len is not null and v_ticket.ai_len > 0 and v_len is not null
              and abs(v_len - v_ticket.ai_len::numeric) / v_ticket.ai_len::numeric > 0.5 then
          v_st := 'review';
        elsif v_ticket.img_hash is not null and exists (
              select 1 from public.ai_tickets t2
              where t2.img_hash = v_ticket.img_hash and t2.nonce <> v_ticket.nonce and t2.used_by is not null) then
          v_st := 'review';
        end if;
      end if;
      if v_ticket.nonce is not null then
        update public.ai_tickets t set used_by = v_cid where t.nonce = v_ticket.nonce;
      end if;
      v_verified := v_ticket.nonce is not null and v_tr >= 70;
      v_featured := (not v_past) and v_sp = any(v_feat) and v_ts is not null
                    and to_char(v_ts at time zone 'Asia/Seoul', 'YYYY-MM') = v_now_m;
      v_c := v_c || jsonb_build_object('st', v_st, 'tr', v_tr,
        'sc', case when v_len is null or v_len <= 0 then 0
                   else private.score_of(v_sp, least(v_len, 1000), v_rel, v_verified, coalesce(v_featured, false)) end);
      v_out := v_out || jsonb_build_array(v_c);
    end loop;
    new.data := jsonb_set(new.data, '{catches}', v_out);
  end if;
  delete from public.spots s where s.uid = new.id and not (s.cid = any(v_keep));
  return new;
end $$;

-- 2. Orders: an order, once saved, cannot be changed (only removed by its owner); a new order must be one of the
--    two premium items or a tip, with a fresh id, one waiting order per item and at most 3 waiting at once.
--    Runs as the caller, so it polices app users and lets trusted server code (account merging, migrations) through.
create or replace function private.orders_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_grants jsonb := coalesce((select g.data -> new.id::text from public.admin_docs g where g.id = 'grants'), '{}'::jsonb);
  v_old jsonb := case when tg_op = 'UPDATE' and jsonb_typeof(old.data->'items') = 'array' then old.data->'items' else '[]'::jsonb end;
  v_in jsonb := case when jsonb_typeof(new.data->'items') = 'array' then new.data->'items' else '[]'::jsonb end;
  v_app boolean := current_user in ('authenticated', 'anon');
  v_out jsonb := '[]'::jsonb; v_seen text[] := '{}'; v_wait_refs text[] := '{}';
  v_it jsonb; v_prev jsonb; v_id text; v_wait int := 0; v_n int := 0;
begin
  if pg_column_size(new.data) > 100000 then raise exception 'doc_too_large'; end if;
  if v_app then
    -- saved orders that still wait for the operator (and stay in the list)
    select count(*), coalesce(array_agg(o->>'ref') filter (where o->>'kind' = 'item'), '{}') into v_wait, v_wait_refs
    from jsonb_array_elements(v_old) o
    where jsonb_typeof(o) = 'object' and coalesce(v_grants ->> (o->>'id'), '') not in ('ok', 'no')
      and exists (select 1 from jsonb_array_elements(v_in) x where jsonb_typeof(x) = 'object' and x->>'id' = o->>'id');
  end if;
  for v_it in select value from jsonb_array_elements(v_in) loop
    v_n := v_n + 1; exit when v_n > 300;
    if jsonb_typeof(v_it) <> 'object' then continue; end if;
    v_id := left(coalesce(v_it->>'id', ''), 24);
    if v_id = '' or v_id = any(v_seen) then continue; end if; -- one entry per order id
    if v_app then
      v_prev := null;
      select o into v_prev from jsonb_array_elements(v_old) o where jsonb_typeof(o) = 'object' and o->>'id' = v_id limit 1;
      if v_prev is not null then
        v_it := v_prev; -- saved orders never change
      else
        if v_grants ? v_id then continue; end if; -- an id the operator already decided on can't be reused
        if not ((v_it->>'kind' = 'item' and v_it->>'ref' in ('pr_gold', 'th_palace')) or v_it->>'kind' = 'donate') then continue; end if;
        if v_wait >= 3 then continue; end if;
        if v_it->>'kind' = 'item' and (v_it->>'ref') = any(v_wait_refs) then continue; end if;
        v_wait := v_wait + 1;
        if v_it->>'kind' = 'item' then v_wait_refs := v_wait_refs || (v_it->>'ref'); end if;
        v_it := jsonb_build_object('id', v_id, 'kind', v_it->>'kind', 'ref', case when v_it->>'kind' = 'item' then v_it->>'ref' end,
          'amt', 500, 'code', left(coalesce(v_it->>'code', ''), 12), 'm', left(coalesce(v_it->>'m', ''), 8),
          'ts', floor(extract(epoch from now()) * 1000)::bigint, 'nick', left(coalesce(v_it->>'nick', ''), 24), 'qty', 1);
      end if;
    end if;
    v_seen := v_seen || v_id;
    v_out := v_out || jsonb_build_array(v_it);
  end loop;
  new.data := jsonb_build_object('items', v_out);
  return new;
end $$;
revoke all on function private.orders_guard() from public, anon, authenticated;
drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert or update on public.orders for each row execute function private.orders_guard();

-- 3. Start over (trusted: this migration may clear `own`)
--    First a copy of everything that is about to be cleared, in the private schema (the app can't reach it),
--    so the reset can be undone by hand if it ever has to be.
create table if not exists private.bak_20261028_anglers as table public.anglers;
create table if not exists private.bak_20261028_orders as table public.orders;
create table if not exists private.bak_20261028_admin_docs as table public.admin_docs;
create table if not exists private.bak_20261028_photos as table public.photos;
create table if not exists private.bak_20261028_spots as table public.spots;
create table if not exists private.bak_20261028_ai_tickets as table public.ai_tickets;
create table if not exists private.bak_20261028_labels as table public.labels;
revoke all on private.bak_20261028_anglers, private.bak_20261028_orders, private.bak_20261028_admin_docs,
  private.bak_20261028_photos, private.bak_20261028_spots, private.bak_20261028_ai_tickets, private.bak_20261028_labels
  from public, anon, authenticated;

select set_config('zz.trusted', '1', false);

update public.anglers a set data = (a.data - 'catches' - 'lvSeen' - 'own' - 'decor' - 'flair')
  || jsonb_build_object(
       'catches', '[]'::jsonb,
       'decor', jsonb_build_object('theme', 'th_dawn', 'items', jsonb_build_array('dc_weed', 'dc_rock', 'dc_buoy'), 'fx', jsonb_build_array('fx_bubbles')),
       'flair', '{}'::jsonb,
       'upd', floor(extract(epoch from now()) * 1000)::bigint)
  || case when jsonb_typeof(a.data->'char') = 'object' then jsonb_build_object('char', (a.data->'char') || jsonb_build_object(
       'hs', case when a.data #>> '{char,hs}' in ('short', 'buzz', 'bowl', 'long', 'bob', 'pony') then a.data #>> '{char,hs}' else 'short' end,
       'hc', case when coalesce(a.data #>> '{char,hc}', '') ~ '^[0-4]$' then (a.data #>> '{char,hc}')::int else 0 end,
       'ey', case when a.data #>> '{char,ey}' in ('dot', 'happy', 'sleepy', 'wink', 'round') then a.data #>> '{char,ey}' else 'dot' end,
       'mo', case when a.data #>> '{char,mo}' in ('smile', 'grin', 'cat', 'o', 'flat') then a.data #>> '{char,mo}' else 'smile' end,
       'ht', case when a.data #>> '{char,ht}' in ('none', 'cap', 'bucket') then a.data #>> '{char,ht}' else 'cap' end,
       'ou', case when a.data #>> '{char,ou}' in ('tee', 'vest') then a.data #>> '{char,ou}' else 'vest' end,
       'ac', case when a.data #>> '{char,ac}' in ('none', 'glasses', 'bandaid') then a.data #>> '{char,ac}' else 'none' end,
       'rd', case when a.data #>> '{char,rd}' in ('bamboo', 'carbon') then a.data #>> '{char,rd}' else 'carbon' end))
     else '{}'::jsonb end;

delete from public.photos where cid <> '_pic';   -- catch photos (profile photos stay)
delete from public.spots;                         -- exact catch spots
delete from public.ai_tickets;                    -- AI checks tied to old photos
delete from public.labels;                        -- species corrections from old catches
update public.admin_docs set data = '{}'::jsonb where id = 'verdicts';

-- orders: no payment ever reached the operator, so every order and every decision on orders goes
delete from public.orders;
update public.admin_docs set data = '{}'::jsonb where id = 'grants';

select set_config('zz.trusted', '', false);

-- 4. Housekeeping: the live-test account from the AI check, its probe table and saved test responses
update public.ai_usage g set n = greatest(0, g.n - t.n)
  from public.ai_usage t
  where t.uid = '18b48144-b816-4039-9379-6f7d00e5f2ce' and g.uid = '00000000-0000-0000-0000-000000000000' and g.day = t.day and g.kind = t.kind;
delete from public.ai_usage where uid = '18b48144-b816-4039-9379-6f7d00e5f2ce' or (uid = '00000000-0000-0000-0000-000000000000' and n = 0);
delete from auth.users where id = '18b48144-b816-4039-9379-6f7d00e5f2ce' and is_anonymous;
drop table if exists private._zz_probe;
do $$ begin
  if to_regclass('net._http_response') is not null then delete from net._http_response where id <= 11; end if;
end $$;
-- acct() is only needed by signed-in policies
revoke execute on function public.acct() from anon;
