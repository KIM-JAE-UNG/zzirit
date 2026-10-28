-- =====================================================================
-- Fishing league backend (Supabase)
-- Documents mirror the app's data model so the web app and the Claude
-- artifact version share one codebase. Every angler writes only their
-- own rows; the server re-checks scores, AI screening and past-catch
-- quotas so a modified client cannot fake a ranking.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------- Reference data & secrets (not exposed through the API) ----------
create table private.species (
  id   text primary key,
  idx  int not null,               -- order in the app catalog (tie-breaker)
  r    int not null,               -- rarity 1..5
  l    double precision not null,  -- reference length, cm
  x    double precision not null,  -- record length, cm
  w    text not null,              -- S sea · F fresh · B brackish
  tox  int not null default 0,
  mo   text not null,              -- 12 digits, monthly activity 0..3
  ab   jsonb not null default '{}'::jsonb,
  cl   int[]                       -- Korean closed season [m1,d1,m2,d2]
);
create table private.app_secrets (k text primary key, v text not null);

-- ---------- App tables ----------
create table public.anglers (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.photos (
  angler uuid not null references auth.users(id) on delete cascade,
  cid text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (angler, cid),
  constraint photos_size check (pg_column_size(data) < 160000)
);
create table public.labels (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint labels_size check (pg_column_size(data) < 200000)
);
create table public.orders (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint orders_size check (pg_column_size(data) < 100000)
);
create table public.suggest (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint suggest_size check (pg_column_size(data) < 100000)
);
create table public.admin_docs (
  id text primary key check (id in ('config', 'grants', 'verdicts')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.app_admins (
  uid uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Precise catch locations: only the angler can read them. The public
-- angler document keeps just the 0.25° grid cell used for statistics.
create table public.spots (
  uid uuid not null references auth.users(id) on delete cascade,
  cid text not null,
  lat double precision,
  lon double precision,
  primary key (uid, cid)
);
-- AI screening tickets, written by the AI function with the secret key.
create table public.ai_tickets (
  nonce uuid primary key,
  uid uuid not null references auth.users(id) on delete cascade,
  verdict text,
  fish boolean,
  real double precision,
  ai_len double precision,
  sp text,
  img_hash text,
  used_by text,
  created_at timestamptz not null default now()
);
create index ai_tickets_uid on public.ai_tickets (uid);
create index ai_tickets_img on public.ai_tickets (img_hash);
create table public.ai_usage (
  uid uuid not null,
  day date not null,
  kind text not null,
  n int not null default 0,
  primary key (uid, day, kind)
);

-- ---------- Helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.uid = (select auth.uid()));
$$;

-- The operator proves ownership once per browser with a secret code.
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
  return true;
end $$;

-- Daily AI budget per angler and for the whole app (keeps the API bill bounded).
create or replace function public.ai_take(kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d date := (now() at time zone 'Asia/Seoul')::date;
  lim int; glim int; mine int; total int;
begin
  if me is null then return false; end if;
  if kind = 'image' then lim := 30; glim := 1000;
  elsif kind = 'text' then lim := 40; glim := 2000;
  else return false; end if;
  insert into public.ai_usage as u (uid, day, kind, n) values (me, d, kind, 1)
    on conflict (uid, day, kind) do update set n = u.n + 1 returning u.n into mine;
  insert into public.ai_usage as u (uid, day, kind, n) values ('00000000-0000-0000-0000-000000000000', d, kind, 1)
    on conflict (uid, day, kind) do update set n = u.n + 1 returning u.n into total;
  return mine <= lim and total <= glim;
end $$;

create or replace function private.is_closed(cl int[], d date) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when cl is null or coalesce(array_length(cl, 1), 0) < 4 then false
    when cl[1] * 100 + cl[2] <= cl[3] * 100 + cl[4] then
      (extract(month from d)::int * 100 + extract(day from d)::int) between cl[1] * 100 + cl[2] and cl[3] * 100 + cl[4]
    else
      (extract(month from d)::int * 100 + extract(day from d)::int) >= cl[1] * 100 + cl[2]
      or (extract(month from d)::int * 100 + extract(day from d)::int) <= cl[3] * 100 + cl[4]
  end;
$$;

-- This month's double-score species (same rule as the app).
create or replace function private.featured_species(ts timestamptz) returns text[]
language sql stable set search_path = '' as $$
  with m as (
    select extract(month from (ts at time zone 'Asia/Seoul'))::int as mon, (ts at time zone 'Asia/Seoul')::date as d
  ), v as (
    select s.id, s.idx,
      substr(s.mo, m.mon, 1)::int * 10
      + (coalesce((s.ab->>'KS')::int, 0) + coalesce((s.ab->>'KW')::int, 0) + coalesce((s.ab->>'KE')::int, 0) + coalesce((s.ab->>'KJ')::int, 0)) * 2
      + s.r
      + case when private.is_closed(s.cl, m.d) then -100 else 0 end as score
    from private.species s, m
    where s.w <> 'F' and s.tox = 0 and s.r >= 2
      and (coalesce((s.ab->>'KS')::int, 0) + coalesce((s.ab->>'KW')::int, 0) + coalesce((s.ab->>'KE')::int, 0) + coalesce((s.ab->>'KJ')::int, 0)) > 0
    order by score desc, s.idx asc
    limit 3
  )
  select coalesce(array_agg(id order by score desc, idx asc), '{}') from v;
$$;

create or replace function private.score_of(sp text, len numeric, rel boolean, verified boolean, featured boolean) returns int
language sql stable set search_path = '' as $$
  select coalesce((
    select floor(s.r * 10 * power(least(len::double precision, s.x * 1.05) / s.l, 1.5)
      * (case when rel then 1.2 else 1 end) * (case when verified then 1.1 else 1 end) * (case when featured then 2 else 1 end) + 0.5)::int
    from private.species s where s.id = sp), 0);
$$;

-- ---------- Server-side checks on every angler save ----------
create or replace function private.anglers_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_map jsonb := '{}'::jsonb;
  out_catches jsonb := '[]'::jsonb;
  c jsonb; o jsonb;
  cid text; sp text; st text;
  len numeric; ts_ms numeric; ts timestamptz; tr int;
  past boolean; rel boolean; verified boolean; featured boolean;
  tk uuid; tkrow public.ai_tickets%rowtype;
  lat double precision; lon double precision; clat double precision; clon double precision;
  past_count int := 0; past_allow int; credits int;
  keep_cids text[] := '{}';
  feat text[] := private.featured_species(now());
  now_m text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  n int := 0;
begin
  if jsonb_typeof(new.data) <> 'object' then raise exception 'bad_doc'; end if;
  if pg_column_size(new.data) > 900000 then raise exception 'doc_too_large'; end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and jsonb_typeof(old.data->'catches') = 'array' then
    select coalesce(jsonb_object_agg(x->>'id', x), '{}'::jsonb) into old_map
    from jsonb_array_elements(old.data->'catches') x where jsonb_typeof(x) = 'object' and x ? 'id';
  end if;
  if length(coalesce(new.data->>'nick', '')) > 24 then
    new.data := jsonb_set(new.data, '{nick}', to_jsonb(left(new.data->>'nick', 24)));
  end if;
  if new.data ? 'fr' and jsonb_typeof(new.data->'fr') <> 'object' then new.data := new.data - 'fr'; end if;

  -- past catches: 5 free + purchased credits the operator has not rejected
  select coalesce(sum(case when jsonb_typeof(it->'qty') = 'number' then (it->>'qty')::int else 1 end), 0) into credits
  from public.orders ord, jsonb_array_elements(coalesce(ord.data->'items', '[]'::jsonb)) it
  where ord.id = new.id and it->>'kind' = 'past'
    and coalesce((select g.data #>> array[new.id::text, it->>'id'] from public.admin_docs g where g.id = 'grants'), '') <> 'no';
  past_allow := 5 + credits;

  if jsonb_typeof(new.data->'catches') = 'array' then
    for c in select value from jsonb_array_elements(new.data->'catches') loop
      n := n + 1;
      exit when n > 3000;
      if jsonb_typeof(c) <> 'object' or not (c ? 'id') then continue; end if;
      cid := left(c->>'id', 40);
      keep_cids := keep_cids || cid;
      -- precise location goes to the private table; the public copy keeps the grid cell
      lat := case when jsonb_typeof(c->'lat') = 'number' then (c->>'lat')::double precision end;
      lon := case when jsonb_typeof(c->'lon') = 'number' then (c->>'lon')::double precision end;
      if lat is not null and lon is not null and abs(lat) <= 90 and abs(lon) <= 180 then
        clat := (floor(lat / 0.25) + 0.5) * 0.25;
        clon := (floor(lon / 0.25) + 0.5) * 0.25;
        if lat <> clat or lon <> clon then
          insert into public.spots (uid, cid, lat, lon) values (new.id, cid, round(lat::numeric, 2), round(lon::numeric, 2))
          on conflict (uid, cid) do update set lat = excluded.lat, lon = excluded.lon;
        end if;
        c := jsonb_set(jsonb_set(c, '{lat}', to_jsonb(clat)), '{lon}', to_jsonb(clon));
      elsif c ? 'lat' or c ? 'lon' then
        c := jsonb_set(jsonb_set(c, '{lat}', 'null'::jsonb), '{lon}', 'null'::jsonb);
      end if;
      past := coalesce(c->'past' = 'true'::jsonb, false);
      o := old_map->cid;
      if o is not null and o = c then
        out_catches := out_catches || jsonb_build_array(o);
        if past and coalesce(o->>'st', '') <> 'no' then past_count := past_count + 1; end if;
        continue;
      end if;

      -- new or edited catch: check it again on the server
      sp := c->>'sp';
      len := case when jsonb_typeof(c->'len') = 'number' then (c->>'len')::numeric end;
      ts_ms := case when jsonb_typeof(c->'ts') = 'number' then (c->>'ts')::numeric end;
      ts := case when ts_ms is not null and ts_ms between 0 and 32503680000000 then to_timestamp(ts_ms / 1000.0) end;
      tr := case when jsonb_typeof(c->'tr') = 'number' then greatest(0, least(100, round((c->>'tr')::numeric)::int)) else 0 end;
      rel := coalesce(c->'rel' = 'true'::jsonb, false);
      st := coalesce(c->>'st', 'review');
      if st not in ('ok', 'review', 'no') then st := 'review'; end if;
      if (len is null or len <= 0 or len > 1000 or ts is null or ts > now() + interval '1 day') and st = 'ok' then st := 'review'; end if;

      tkrow := null; tk := null;
      begin tk := (c->>'tk')::uuid; exception when others then tk := null; end;
      if tk is not null then
        select * into tkrow from public.ai_tickets t
        where t.nonce = tk and t.uid = new.id and (t.used_by is null or t.used_by = cid);
      end if;
      if st = 'ok' then
        if tkrow.nonce is null or tkrow.verdict is distinct from 'pass' or tkrow.fish is false then
          st := 'review';
        elsif tkrow.ai_len is not null and tkrow.ai_len > 0 and len is not null
              and abs(len - tkrow.ai_len::numeric) / tkrow.ai_len::numeric > 0.5 then
          st := 'review';
        elsif tkrow.img_hash is not null and exists (
              select 1 from public.ai_tickets t2
              where t2.img_hash = tkrow.img_hash and t2.nonce <> tkrow.nonce and t2.used_by is not null) then
          st := 'review';  -- the same photo was already used for another catch
        end if;
      end if;
      if tkrow.nonce is not null then update public.ai_tickets set used_by = cid where nonce = tkrow.nonce; end if;
      if past and st <> 'no' then
        past_count := past_count + 1;
        if past_count > past_allow and st = 'ok' then st := 'review'; end if;
      end if;
      verified := tkrow.nonce is not null and tr >= 70;
      featured := (not past) and sp = any(feat) and ts is not null
                  and to_char(ts at time zone 'Asia/Seoul', 'YYYY-MM') = now_m;
      c := c || jsonb_build_object('st', st, 'tr', tr,
        'sc', case when len is null or len <= 0 then 0 else private.score_of(sp, least(len, 1000), rel, verified, featured) end);
      out_catches := out_catches || jsonb_build_array(c);
    end loop;
    new.data := jsonb_set(new.data, '{catches}', out_catches);
  end if;
  delete from public.spots s where s.uid = new.id and not (s.cid = any(keep_cids));
  return new;
end $$;

create trigger anglers_guard before insert or update on public.anglers
for each row execute function private.anglers_guard();

create or replace function private.touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger photos_touch before update on public.photos for each row execute function private.touch();
create trigger labels_touch before update on public.labels for each row execute function private.touch();
create trigger orders_touch before update on public.orders for each row execute function private.touch();
create trigger suggest_touch before update on public.suggest for each row execute function private.touch();
create trigger admin_docs_touch before update on public.admin_docs for each row execute function private.touch();

-- ---------- Row level security ----------
alter table public.anglers    enable row level security;
alter table public.photos     enable row level security;
alter table public.labels     enable row level security;
alter table public.orders     enable row level security;
alter table public.suggest    enable row level security;
alter table public.admin_docs enable row level security;
alter table public.app_admins enable row level security;
alter table public.spots      enable row level security;
alter table public.ai_tickets enable row level security;
alter table public.ai_usage   enable row level security;

-- anglers: everyone reads (rankings are public), each person writes their own
create policy "anglers read" on public.anglers for select to anon, authenticated using (true);
create policy "anglers insert own" on public.anglers for insert to authenticated with check ((select auth.uid()) = id);
create policy "anglers update own" on public.anglers for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "anglers delete own" on public.anglers for delete to authenticated using ((select auth.uid()) = id);

create policy "photos read" on public.photos for select to anon, authenticated using (true);
create policy "photos insert own" on public.photos for insert to authenticated with check ((select auth.uid()) = angler);
create policy "photos update own" on public.photos for update to authenticated using ((select auth.uid()) = angler) with check ((select auth.uid()) = angler);
create policy "photos delete own" on public.photos for delete to authenticated using ((select auth.uid()) = angler);

create policy "labels read" on public.labels for select to anon, authenticated using (true);
create policy "labels insert own" on public.labels for insert to authenticated with check ((select auth.uid()) = id);
create policy "labels update own" on public.labels for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- orders & suggestions: the author and the operator only
create policy "orders read own or admin" on public.orders for select to authenticated using ((select auth.uid()) = id or (select public.is_admin()));
create policy "orders insert own" on public.orders for insert to authenticated with check ((select auth.uid()) = id);
create policy "orders update own" on public.orders for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "suggest read own or admin" on public.suggest for select to authenticated using ((select auth.uid()) = id or (select public.is_admin()));
create policy "suggest insert own" on public.suggest for insert to authenticated with check ((select auth.uid()) = id);
create policy "suggest update own" on public.suggest for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- operator settings, approvals and verdicts: public read, operator write
create policy "admin_docs read" on public.admin_docs for select to anon, authenticated using (true);
create policy "admin_docs insert admin" on public.admin_docs for insert to authenticated with check ((select public.is_admin()));
create policy "admin_docs update admin" on public.admin_docs for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "spots read own" on public.spots for select to authenticated using ((select auth.uid()) = uid);
-- app_admins, ai_tickets, ai_usage: no policies (server functions only)

revoke all on public.app_admins, public.ai_tickets, public.ai_usage from anon, authenticated;
revoke insert, update, delete on public.spots from anon, authenticated;
revoke all on function public.claim_admin(text) from public, anon;
revoke all on function public.ai_take(text) from public, anon;
grant execute on function public.claim_admin(text) to authenticated;
grant execute on function public.ai_take(text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.anglers, public.labels, public.admin_docs, public.orders, public.suggest;
