-- =====================================================================
-- 0006: community board, teams, one account on several devices (link codes),
--       daily fishing news, free past catches, premium checks, AI limits
-- =====================================================================

-- ---------- one account, several devices ----------
-- Each device signs in on its own (anonymous). A link maps a device to the account that holds the records;
-- every "own row" rule below uses acct() instead of auth.uid().
create table if not exists private.links (
  member uuid primary key references auth.users(id) on delete cascade,
  owner uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists links_owner on private.links(owner);
create table if not exists private.link_codes (
  code_hash text primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists private.link_tries (
  uid uuid primary key,
  n int not null default 0,
  window_start timestamptz not null default now()
);

create or replace function public.acct() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce((select l.owner from private.links l where l.member = auth.uid()), auth.uid());
$$;
create or replace function public.my_acct() returns uuid
language sql stable security definer set search_path = '' as $$ select public.acct(); $$;
create or replace function public.acct_of(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce((select l.owner from private.links l where l.member = p_uid), p_uid);
$$;
revoke all on function public.acct() from public;
revoke all on function public.my_acct() from public, anon;
revoke all on function public.acct_of(uuid) from public, anon, authenticated;
grant execute on function public.acct() to anon, authenticated;
grant execute on function public.my_acct() to authenticated;
grant execute on function public.acct_of(uuid) to service_role;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.uid = (select auth.uid()) or a.uid = (select public.acct()));
$$;
create or replace function public.claim_admin(code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if auth.uid() is null then return false; end if;
  select s.v into v from private.app_secrets s where s.k = 'admin_code';
  if v is null or code is null or length(code) < 12 or code <> v then
    perform pg_sleep(0.8);
    return false;
  end if;
  insert into public.app_admins (uid) values (auth.uid()) on conflict do nothing;
  insert into public.app_admins (uid) values (public.acct()) on conflict do nothing;
  return true;
end $$;

-- link codes: 8 characters, 10 minutes, single use
create or replace function public.link_create() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_owner uuid := public.acct();
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := ''; v_bytes bytea; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from private.link_codes c where c.owner = v_owner or c.expires_at < now();
  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1); end loop;
  insert into private.link_codes (code_hash, owner, expires_at)
  values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_owner, now() + interval '10 minutes');
  return v_code;
end $$;

-- rename one id inside jsonb documents (friend edges, post keys, operator decisions)
create or replace function private.swap_id(d jsonb, a uuid, b uuid) returns jsonb
language sql immutable set search_path = '' as $$ select replace(d::text, a::text, b::text)::jsonb $$;

-- redeem: returns {ok, acct} or {ok:false, err}; failures are not exceptions so the attempt counter sticks
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

create or replace function public.link_leave() returns boolean
language sql volatile security definer set search_path = '' as $$
  delete from private.links l where l.member = auth.uid() returning true;
$$;
revoke all on function public.link_create() from public, anon;
revoke all on function public.link_redeem(text) from public, anon;
revoke all on function public.link_leave() from public, anon;
grant execute on function public.link_create() to authenticated;
grant execute on function public.link_redeem(text) to authenticated;
grant execute on function public.link_leave() to authenticated;

-- ---------- board & teams ----------
create table if not exists public.board (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint board_size check (pg_column_size(data) < 600000)
);
create table if not exists public.teams (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint teams_size check (pg_column_size(data) < 100000)
);
drop trigger if exists board_touch on public.board;
drop trigger if exists teams_touch on public.teams;
create trigger board_touch before update on public.board for each row execute function private.touch();
create trigger teams_touch before update on public.teams for each row execute function private.touch();
alter table public.board enable row level security;
alter table public.teams enable row level security;

alter table public.admin_docs drop constraint if exists admin_docs_id_check;
alter table public.admin_docs add constraint admin_docs_id_check check (id in ('config', 'grants', 'verdicts', 'mod'));

-- ---------- own-row rules now use the account (acct), not the device ----------
drop policy if exists "anglers insert own" on public.anglers;
drop policy if exists "anglers update own" on public.anglers;
drop policy if exists "anglers delete own" on public.anglers;
create policy "anglers insert own" on public.anglers for insert to authenticated with check ((select public.acct()) = id);
create policy "anglers update own" on public.anglers for update to authenticated using ((select public.acct()) = id) with check ((select public.acct()) = id);
create policy "anglers delete own" on public.anglers for delete to authenticated using ((select public.acct()) = id);
drop policy if exists "photos insert own" on public.photos;
drop policy if exists "photos update own" on public.photos;
drop policy if exists "photos delete own" on public.photos;
create policy "photos insert own" on public.photos for insert to authenticated with check ((select public.acct()) = angler);
create policy "photos update own" on public.photos for update to authenticated using ((select public.acct()) = angler) with check ((select public.acct()) = angler);
create policy "photos delete own" on public.photos for delete to authenticated using ((select public.acct()) = angler);
drop policy if exists "labels insert own" on public.labels;
drop policy if exists "labels update own" on public.labels;
create policy "labels insert own" on public.labels for insert to authenticated with check ((select public.acct()) = id);
create policy "labels update own" on public.labels for update to authenticated using ((select public.acct()) = id) with check ((select public.acct()) = id);
drop policy if exists "orders read own or admin" on public.orders;
drop policy if exists "orders insert own" on public.orders;
drop policy if exists "orders update own" on public.orders;
create policy "orders read own or admin" on public.orders for select to authenticated using ((select public.acct()) = id or (select public.is_admin()));
create policy "orders insert own" on public.orders for insert to authenticated with check ((select public.acct()) = id);
create policy "orders update own" on public.orders for update to authenticated using ((select public.acct()) = id) with check ((select public.acct()) = id);
drop policy if exists "suggest read own or admin" on public.suggest;
drop policy if exists "suggest insert own" on public.suggest;
drop policy if exists "suggest update own" on public.suggest;
create policy "suggest read own or admin" on public.suggest for select to authenticated using ((select public.acct()) = id or (select public.is_admin()));
create policy "suggest insert own" on public.suggest for insert to authenticated with check ((select public.acct()) = id);
create policy "suggest update own" on public.suggest for update to authenticated using ((select public.acct()) = id) with check ((select public.acct()) = id);
drop policy if exists "spots read own" on public.spots;
create policy "spots read own" on public.spots for select to authenticated using ((select public.acct()) = uid);
drop policy if exists "board read" on public.board;
drop policy if exists "board insert own" on public.board;
drop policy if exists "board update own" on public.board;
drop policy if exists "board delete own" on public.board;
create policy "board read" on public.board for select to anon, authenticated using (true);
create policy "board insert own" on public.board for insert to authenticated with check ((select public.acct()) = id);
create policy "board update own" on public.board for update to authenticated using ((select public.acct()) = id) with check ((select public.acct()) = id);
create policy "board delete own" on public.board for delete to authenticated using ((select public.acct()) = id);
drop policy if exists "teams read" on public.teams;
drop policy if exists "teams insert own" on public.teams;
drop policy if exists "teams update own" on public.teams;
drop policy if exists "teams delete own" on public.teams;
create policy "teams read" on public.teams for select to anon, authenticated using (true);
create policy "teams insert own" on public.teams for insert to authenticated with check ((select public.acct()) = id);
create policy "teams update own" on public.teams for update to authenticated using ((select public.acct()) = id) with check ((select public.acct()) = id);
create policy "teams delete own" on public.teams for delete to authenticated using ((select public.acct()) = id);

-- ---------- daily fishing news (titles + links only) ----------
create table if not exists public.news (
  id text primary key,
  lang text not null,
  title text not null,
  link text not null,
  source text,
  pub timestamptz,
  score int not null default 0,
  fetched_at timestamptz not null default now()
);
create index if not exists news_lang on public.news (lang, score desc);
alter table public.news enable row level security;
drop policy if exists "news read" on public.news;
create policy "news read" on public.news for select to anon, authenticated using (true);
revoke insert, update, delete on public.news from anon, authenticated;
create table if not exists private.news_meta (k text primary key, v timestamptz not null);
create or replace function public.news_claim(p_minutes int) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v timestamptz;
begin
  select m.v into v from private.news_meta m where m.k = 'refresh' for update;
  if v is not null and v > now() - make_interval(mins => greatest(5, p_minutes)) then return false; end if;
  insert into private.news_meta (k, v) values ('refresh', now()) on conflict (k) do update set v = excluded.v;
  return true;
end $$;
revoke all on function public.news_claim(int) from public, anon, authenticated;
grant execute on function public.news_claim(int) to service_role;

-- ---------- AI budget with limits set by the AI function (env), service only ----------
create or replace function public.ai_take(p_uid uuid, p_kind text, p_lim int, p_glim int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_mine int; v_total int;
begin
  if p_uid is null or p_kind not in ('image', 'text') then return false; end if;
  select coalesce((select u.n from public.ai_usage u where u.uid = p_uid and u.day = v_day and u.kind = p_kind), 0) into v_mine;
  if v_mine >= greatest(1, p_lim) then return false; end if;
  insert into public.ai_usage as u (uid, day, kind, n) values ('00000000-0000-0000-0000-000000000000', v_day, p_kind, 1)
    on conflict on constraint ai_usage_pkey do update set n = u.n + 1 returning u.n into v_total;
  if v_total > greatest(1, p_glim) then return false; end if;
  insert into public.ai_usage as u (uid, day, kind, n) values (p_uid, v_day, p_kind, 1)
    on conflict on constraint ai_usage_pkey do update set n = u.n + 1;
  return true;
end $$;
revoke all on function public.ai_take(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, text, int, int) to service_role;

-- ---------- server checks on every angler save: past catches are free now; premium looks need a purchase ----------
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
  v_gold boolean; v_palace boolean;
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

  -- premium looks (500 won items) stay only while a purchase exists that the operator has not cancelled
  select exists (select 1 from public.orders ord, jsonb_array_elements(coalesce(ord.data->'items', '[]'::jsonb)) it
    where ord.id = new.id and it->>'kind' = 'item' and it->>'ref' = 'pr_gold'
      and coalesce((select g.data #>> array[new.id::text, it->>'id'] from public.admin_docs g where g.id = 'grants'), '') <> 'no') into v_gold;
  select exists (select 1 from public.orders ord, jsonb_array_elements(coalesce(ord.data->'items', '[]'::jsonb)) it
    where ord.id = new.id and it->>'kind' = 'item' and it->>'ref' = 'th_palace'
      and coalesce((select g.data #>> array[new.id::text, it->>'id'] from public.admin_docs g where g.id = 'grants'), '') <> 'no') into v_palace;
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

-- ---------- realtime for the new tables ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board') then
    alter publication supabase_realtime add table public.board;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams') then
    alter publication supabase_realtime add table public.teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'news') then
    alter publication supabase_realtime add table public.news;
  end if;
end $$;
