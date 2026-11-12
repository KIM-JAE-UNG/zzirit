-- 0019: 찌릿 라이브 — one game on the real map takes the place of the mini games and the park.
-- You cast into real water near where you stand (or, a few times a day, from far away), wait for the bite, strike and
-- reel. The server keeps what must be fair: where the schools are, when the bite comes, which class of fish it is and
-- how big, the points, the fish book and the weekly board. The phone never tells the server where the angler is —
-- only which patch of water (about 110 m) the float is in.
-- Only adds: tables, functions, a column on zp_items and a weekly job. Nothing is removed; the old mini-game tables stay.

/* ---------- 1. settings ---------- */
create table if not exists private.live_cfg (
  id boolean primary key default true check (id),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  remote_per_day int not null default 5 check (remote_per_day >= 0),   -- casts a day from far away
  day_cap int not null default 80 check (day_cap >= 0),                -- points a day from catches (new species come on top)
  casts_per_hour int not null default 80 check (casts_per_hour > 0),
  live boolean not null default true
);
insert into private.live_cfg (id) values (true) on conflict (id) do nothing;

/* ---------- 2. fish the game knows: class 1 (common) … 5 (legend), usual and record length ---------- */
create table if not exists public.live_species (
  id text primary key check (id ~ '^[a-z0-9_]{2,24}$'),
  tier int not null check (tier between 1 and 5),
  l_typ numeric not null check (l_typ > 0),
  l_max numeric not null check (l_max > 0),
  water text not null check (water in ('S', 'B', 'F')),
  zone text not null default ''
);
insert into public.live_species (id, tier, l_typ, l_max, water, zone) values
  ('kurodai', 4, 35, 71, 'S', 'shore'), ('madai', 3, 45, 100, 'S', 'coast'), ('ishidai', 5, 40, 80, 'S', 'shore'), ('ishigakidai', 5, 45, 80, 'S', 'shore'),
  ('mejina', 4, 30, 60, 'S', 'shore'), ('suzuki', 3, 60, 110, 'S', 'coast'), ('hirame', 3, 50, 103, 'S', 'coast'), ('kurosoi', 2, 35, 65, 'S', 'coast'),
  ('mebaru', 2, 20, 35, 'S', 'shore'), ('usumebaru', 2, 22, 35, 'S', 'coast'), ('ainame', 2, 30, 60, 'S', 'shore'), ('saba', 1, 30, 60, 'S', 'coast'),
  ('maaji', 1, 22, 50, 'S', 'coast'), ('tachiuo', 2, 100, 150, 'S', 'shelf'), ('buri', 3, 70, 120, 'S', 'offshore'), ('hiramasa', 4, 80, 150, 'S', 'offshore'),
  ('kanpachi', 4, 90, 190, 'S', 'offshore'), ('sawara', 3, 70, 110, 'S', 'coast'), ('kuromaguro', 5, 150, 300, 'S', 'offshore'), ('iidako', 1, 20, 35, 'S', 'coast'),
  ('madako', 2, 60, 120, 'S', 'shore'), ('mizudako', 3, 150, 400, 'S', 'coast'), ('surumeika', 2, 30, 50, 'S', 'offshore'), ('aoriika', 3, 35, 55, 'S', 'shore'),
  ('kensakiika', 2, 30, 50, 'S', 'coast'), ('kouika', 2, 20, 35, 'S', 'coast'), ('sayori', 1, 30, 40, 'S', 'shore'), ('kasago', 2, 20, 35, 'S', 'shore'),
  ('onioko', 2, 22, 30, 'S', 'coast'), ('minokasago', 2, 25, 35, 'S', 'shore'), ('haokoze', 1, 8, 12, 'S', 'shore'), ('akaei', 2, 80, 200, 'S', 'coast'),
  ('aigo', 1, 25, 40, 'S', 'shore'), ('gonzui', 1, 15, 30, 'S', 'shore'), ('torafugu', 3, 45, 80, 'S', 'coast'), ('kusafugu', 1, 12, 25, 'S', 'shore'),
  ('mefugu', 3, 35, 45, 'B', 'brack'), ('unagi', 3, 60, 130, 'F', 'fresh'), ('kijihata', 4, 35, 60, 'S', 'shore'), ('mahata', 4, 50, 120, 'S', 'shore'),
  ('kue', 5, 70, 130, 'S', 'shore'), ('isaki', 3, 30, 45, 'S', 'coast'), ('kawahagi', 2, 20, 30, 'S', 'shore'), ('shirogisu', 1, 18, 30, 'S', 'shore'),
  ('mahaze', 1, 15, 25, 'B', 'brack'), ('bora', 1, 50, 100, 'B', 'brack'), ('miuy', 4, 60, 130, 'S', 'coast'), ('kiguchi', 2, 20, 40, 'S', 'shelf'),
  ('madara', 3, 60, 120, 'S', 'deep'), ('hokke', 2, 35, 50, 'S', 'coast'), ('makogarei', 2, 25, 45, 'S', 'coast'), ('magarei', 2, 25, 40, 'S', 'coast'),
  ('nishin', 1, 25, 45, 'S', 'coast'), ('konoshiro', 1, 20, 30, 'B', 'brack'), ('magochi', 2, 45, 100, 'S', 'shore'), ('funa', 2, 25, 50, 'F', 'fresh'),
  ('koi', 2, 60, 120, 'F', 'fresh'), ('bass', 3, 40, 97, 'F', 'fresh'), ('bluegill', 1, 15, 40, 'F', 'fresh'), ('kerguigyo', 4, 30, 60, 'F', 'fresh'),
  ('nijimasu', 2, 40, 120, 'F', 'fresh'), ('yamame', 3, 25, 40, 'F', 'fresh'), ('namazu', 2, 50, 100, 'F', 'fresh'), ('gigi', 2, 20, 35, 'F', 'fresh'),
  ('hasu', 2, 30, 40, 'F', 'fresh'), ('kochoto', 2, 45, 100, 'F', 'fresh'), ('nigoi', 2, 40, 60, 'F', 'fresh'), ('wakasagi', 1, 10, 15, 'F', 'fresh'),
  ('ayu', 3, 20, 30, 'F', 'fresh'), ('raigyo', 3, 60, 100, 'F', 'fresh'), ('kusauo', 3, 70, 150, 'F', 'fresh'), ('hakuren', 2, 60, 100, 'F', 'fresh'),
  ('tilapia', 1, 30, 60, 'F', 'fresh'), ('taimen', 5, 80, 200, 'F', 'fresh'), ('yellowfin', 4, 120, 240, 'S', 'offshore'), ('mahimahi', 3, 90, 200, 'S', 'offshore'),
  ('gt', 5, 100, 170, 'S', 'shore'), ('sailfish', 5, 230, 340, 'S', 'offshore'), ('bluemarlin', 5, 300, 500, 'S', 'offshore'), ('redsnapper', 3, 60, 100, 'S', 'shelf'),
  ('barramundi', 4, 80, 180, 'B', 'brack'), ('tarpon', 5, 150, 250, 'B', 'brack'), ('stripedbass', 3, 70, 150, 'S', 'coast'), ('reddrum', 3, 70, 150, 'B', 'brack'),
  ('kingsalmon', 4, 90, 150, 'S', 'coast'), ('coho', 3, 65, 100, 'S', 'coast'), ('halibut', 5, 120, 260, 'S', 'deep'), ('atlcod', 3, 70, 200, 'S', 'deep'),
  ('eubass', 3, 50, 100, 'S', 'shore'), ('snook', 4, 70, 130, 'B', 'brack'), ('bonefish', 4, 50, 90, 'S', 'shore'), ('barracuda', 3, 100, 200, 'S', 'coast'),
  ('wahoo', 4, 120, 250, 'S', 'offshore'), ('stonefish', 2, 30, 40, 'S', 'shore'), ('lionfish', 2, 30, 47, 'S', 'shore'), ('pike', 3, 70, 150, 'F', 'fresh'),
  ('walleye', 3, 50, 100, 'F', 'fresh'), ('smallmouth', 3, 35, 70, 'F', 'fresh'), ('browntrout', 3, 45, 140, 'F', 'fresh'), ('atlsalmon', 4, 80, 150, 'F', 'fresh'),
  ('muskie', 5, 100, 160, 'F', 'fresh'), ('wels', 4, 150, 280, 'F', 'fresh'), ('channelcat', 2, 50, 130, 'F', 'fresh'), ('peacockbass', 4, 50, 95, 'F', 'fresh'),
  ('arapaima', 5, 200, 300, 'F', 'fresh'), ('murraycod', 4, 70, 180, 'F', 'fresh')
on conflict (id) do update set tier = excluded.tier, l_typ = excluded.l_typ, l_max = excluded.l_max, water = excluded.water, zone = excluded.zone;
alter table public.live_species enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'live_species' and policyname = 'live_species_read') then
    create policy live_species_read on public.live_species for select to authenticated using (true);
  end if;
end $$;
grant select on public.live_species to authenticated;

/* ---------- 3. what gear does on the server: sooner bites, more big fish, a longer moment to strike ---------- */
alter table public.zp_items add column if not exists perk jsonb not null default '{}'::jsonb;
insert into public.zp_items (id, price, sort, perk) values
  ('egi', 200, 4, '{"win":0.3}'), ('jig', 800, 7, '{"wait":0.7,"trophy":1.3}'), ('minnow', 1000, 8, '{"trophy":2}'), ('gold', null, 9, '{"trophy":2}'),
  ('rod_wine', 250, 12, '{}'), ('rod_spark', 900, 13, '{"trophy":1.2}'), ('rod_bolt', 1200, 14, '{"trophy":1.3}'),
  ('reel_lbr', 250, 22, '{"win":0.05}'), ('reel_bolt', 1200, 24, '{"win":0.1}'),
  ('float_ball', 100, 31, '{"win":0.1}'), ('float_led', 200, 32, '{"win":0.15,"wait":0.92}'),
  ('float_spark', 800, 33, '{"win":0.2,"wait":0.88}'), ('float_bolt', 1000, 34, '{"win":0.25,"wait":0.85}')
on conflict (id) do update set perk = excluded.perk;

/* ---------- 4. the game's own tables ---------- */
create table if not exists private.live_days (      -- one line per account and Korean day
  acct uuid not null references auth.users(id) on delete cascade,
  day date not null,
  casts int not null default 0,
  remote int not null default 0,
  pts int not null default 0,
  fish int not null default 0,
  primary key (acct, day)
);
create table if not exists private.live_casts (     -- the line in the water: one per account
  acct uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  cx int not null, cy int not null,
  water text not null check (water in ('sea', 'fresh')),
  onsite boolean not null,
  anon boolean not null default false,
  cast_at timestamptz not null default clock_timestamp(),
  wait_ms int not null,
  win_ms int not null,
  school int not null default 0,
  feed boolean not null default false,
  trophy numeric not null default 1,
  state text not null default 'wait' check (state in ('wait', 'hooked', 'done')),
  hook_at timestamptz,
  tier int, u numeric, v numeric, big boolean, seed int
);
create table if not exists public.live_catches (
  id bigint generated always as identity primary key,
  acct uuid not null references auth.users(id) on delete cascade,
  sp text not null references public.live_species(id),
  cm numeric not null,
  tier int not null,
  big boolean not null default false,
  score int not null,
  pts int not null,
  onsite boolean not null,
  anon boolean not null default false,
  gx int not null, gy int not null,     -- about 1 km: where the float was, not where the angler stood
  wk date not null,
  created_at timestamptz not null default now()
);
create index if not exists live_catches_wk on public.live_catches (wk, acct, score desc);
create index if not exists live_catches_new on public.live_catches (id desc);
create table if not exists public.live_dex (
  acct uuid not null references auth.users(id) on delete cascade,
  sp text not null references public.live_species(id),
  n int not null default 1,
  best numeric not null,
  first_at timestamptz not null default now(),
  best_at timestamptz not null default now(),
  primary key (acct, sp)
);
create table if not exists public.live_scores (     -- the week's board: the five best fish added up
  wk date not null,
  acct uuid not null references auth.users(id) on delete cascade,
  score int not null,
  n int not null default 0,
  top text not null default '',
  top_cm numeric,
  void boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (wk, acct)
);
create index if not exists live_scores_board on public.live_scores (wk, score desc);
-- read only through the functions below (they hide who it was when the angler asked to stay unnamed)
alter table public.live_catches enable row level security;
alter table public.live_dex enable row level security;
alter table public.live_scores enable row level security;
revoke all on public.live_catches, public.live_dex, public.live_scores from anon, authenticated;

/* ---------- 5. the sea's clock: schools, feeding time, the pull of the tide ---------- */
-- 0 none, 1–3 how strong. Cells are 0.00125° × 0.001° (about 110 m). Schools move every ten minutes; a wider patch
-- of water stays rich or poor for an hour. Nobody can work it out without the secret.
create or replace function private.live_school(p_cx int, p_cy int, p_at timestamptz default now()) returns int
language sql stable security definer set search_path = '' as $$
  select case when q.h < q.thr * 0.18 then 3 when q.h < q.thr * 0.5 then 2 when q.h < q.thr then 1 else 0 end
  from (select
    (('x' || substr(md5(c.secret || ':' || p_cx || ':' || p_cy || ':' || floor(extract(epoch from p_at) / 600)::bigint), 1, 8))::bit(32)::bigint)::numeric / 4294967296 as h,
    0.05 + 0.13 * ((('x' || substr(md5(c.secret || ':z:' || floor(p_cx / 6.0)::int || ':' || floor(p_cy / 6.0)::int || ':' || floor(extract(epoch from p_at) / 3600)::bigint), 1, 8))::bit(32)::bigint)::numeric / 4294967296) as thr
  from private.live_cfg c) q;
$$;
-- by the sun at that longitude: around sunrise (5–8 h) and sunset (16:30–19:30) the fish feed
create or replace function private.live_feed(p_cx int, p_at timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select (q.h >= 5 and q.h < 8) or (q.h >= 16.5 and q.h < 19.5)
  from (select mod((extract(epoch from p_at) / 3600.0 + ((p_cx + 0.5) * 0.00125) / 15.0)::numeric + 48, 24) as h) q;
$$;
-- 0..1, like the app's rough current strength: springs near the new and the full moon, about a day and a half late
create or replace function private.live_tide(p_at timestamptz default now()) returns numeric
language sql stable set search_path = '' as $$
  select greatest(0, least(1, 0.55 + 0.45 * cos(2 * ((mod((extract(epoch from p_at) / 86400.0 + 2440587.5 - 2451550.09766)::numeric, 29.530588861) - 1.5) / 29.53) * 2 * pi())))::numeric;
$$;
-- the length of a fish from its two rolls: usually 55–105 % of the usual size; a big one runs from there toward the record
create or replace function private.live_cm(p_typ numeric, p_max numeric, p_u numeric, p_v numeric, p_big boolean) returns numeric
language sql immutable set search_path = '' as $$
  select round(least(p_max, case when p_big and p_max > p_typ * 1.05 then p_typ * 1.05 + (p_max - p_typ * 1.05) * power(p_v, 1.7)
                                 else p_typ * (0.55 + 0.5 * p_u) end), 1);
$$;
create or replace function private.live_week_sum(p_acct uuid, p_wk date) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(t.score), 0)::int from (select c.score from public.live_catches c where c.acct = p_acct and c.wk = p_wk order by c.score desc limit 5) t;
$$;
create or replace function private.live_board(p_wk date) returns table (acct uuid, score int, n int, top text, top_cm numeric, rk bigint, total bigint)
language sql stable security definer set search_path = '' as $$
  select s.acct, s.score, s.n, s.top, s.top_cm, rank() over (order by s.score desc, s.updated_at), count(*) over ()
  from public.live_scores s where s.wk = p_wk and not s.void and s.score > 0;
$$;
-- points earned by fishing: one line a day in the book, growing as the day goes
create or replace function private.zp_earn(p_acct uuid, p_delta int, p_ref text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_delta is null or p_delta <= 0 then return; end if;
  insert into public.zp_ledger (acct, delta, reason, ref, note) values (p_acct, p_delta, 'join', p_ref, 'live')
    on conflict (acct, reason, ref) do update set delta = public.zp_ledger.delta + excluded.delta;
  insert into public.zp_wallets (acct, bal, earned) values (p_acct, p_delta, p_delta)
    on conflict (acct) do update set bal = public.zp_wallets.bal + p_delta, earned = public.zp_wallets.earned + p_delta, updated_at = now();
end $$;
-- the week's prizes, once: 300 / 200 / 100 points and the gold lure for the best bag
create or replace function private.live_award(p_wk date) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; v_prize int[] := array[300, 200, 100];
begin
  if p_wk >= private.zp_week() then return 0; end if;
  insert into private.zp_settled (game, wk) values ('live', p_wk) on conflict do nothing;
  if not found then return 0; end if;
  for r in select b.acct, b.rk from private.live_board(p_wk) b where b.rk <= 3 order by b.rk loop
    if private.zp_add(r.acct, v_prize[r.rk::int], 'prize', 'live:' || p_wk::text, r.rk::text) then v_n := v_n + 1; end if;
    if r.rk = 1 then insert into public.zp_owned (acct, item, how) values (r.acct, 'gold', 'prize') on conflict do nothing; end if;
  end loop;
  return v_n;
end $$;

/* ---------- 6. what the app calls ---------- */
create or replace function public.live_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_wk date := private.zp_week(); v_day date := (now() at time zone 'Asia/Seoul')::date;
  c private.live_cfg%rowtype; d private.live_days%rowtype; w record;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select * into c from private.live_cfg;
  for w in select distinct s.wk from public.live_scores s
           where s.wk < v_wk and s.wk >= v_wk - 35 and not exists (select 1 from private.zp_settled z where z.game = 'live' and z.wk = s.wk)
  loop perform private.live_award(w.wk); end loop;
  select * into d from private.live_days x where x.acct = v_acct and x.day = v_day;
  return jsonb_build_object(
    'on', c.live, 'wk', v_wk, 'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'tide', private.live_tide(),
    'day', jsonb_build_object('pts', coalesce(d.pts, 0), 'cap', c.day_cap, 'fish', coalesce(d.fish, 0), 'remote', coalesce(d.remote, 0), 'remoteMax', c.remote_per_day),
    'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0),
    'dex', coalesce((select jsonb_agg(jsonb_build_object('sp', x.sp, 'n', x.n, 'best', x.best) order by x.first_at) from public.live_dex x where x.acct = v_acct), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('a', b.acct, 's', b.score, 'n', b.n, 'sp', b.top, 'cm', b.top_cm) order by b.rk) from private.live_board(v_wk) b where b.rk <= 10), '[]'::jsonb),
    'n', coalesce((select max(b.total) from private.live_board(v_wk) b), 0),
    'me', (select jsonb_build_object('s', b.score, 'n', b.n, 'r', b.rk, 'sp', b.top, 'cm', b.top_cm) from private.live_board(v_wk) b where b.acct = v_acct),
    'last', coalesce((select jsonb_agg(jsonb_build_object('a', b.acct, 's', b.score, 'r', b.rk, 'sp', b.top, 'cm', b.top_cm) order by b.rk) from private.live_board(v_wk - 7) b where b.rk <= 3), '[]'::jsonb),
    'feed', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'a', case when f.anon then null else f.acct end, 'sp', f.sp, 'cm', f.cm, 'tier', f.tier, 'big', f.big, 'on', f.onsite, 'gx', f.gx, 'gy', f.gy, 'at', (extract(epoch from f.created_at) * 1000)::bigint) order by f.id desc)
                      from (select * from public.live_catches x where x.created_at > now() - interval '24 hours' order by x.id desc limit 20) f), '[]'::jsonb)
  );
end $$;

-- the schools in a box of cells, for now (at most 3,000 cells a call)
create or replace function public.live_schools(p_x0 int, p_y0 int, p_x1 int, p_y1 int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_x1 < p_x0 or p_y1 < p_y0 or (p_x1 - p_x0 + 1)::bigint * (p_y1 - p_y0 + 1) > 3000 then raise exception 'bad_input'; end if;
  return jsonb_build_object(
    'until', (floor(extract(epoch from v_now) / 600) + 1)::bigint * 600000,
    'feedAt', private.live_feed((p_x0 + p_x1) / 2, v_now),
    'cells', coalesce((select jsonb_agg(jsonb_build_array(q.x, q.y, q.s))
                       from (select x, y, private.live_school(x, y, v_now) as s from generate_series(p_x0, p_x1) x, generate_series(p_y0, p_y1) y) q where q.s > 0), '[]'::jsonb));
end $$;

-- cast: the float lands in a cell of water. The answer says when the bite will come and how long there is to strike.
create or replace function public.live_cast(p_cx int, p_cy int, p_water text, p_onsite boolean, p_anon boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); c private.live_cfg%rowtype; v_day date := (now() at time zone 'Asia/Seoul')::date;
  d private.live_days%rowtype; g record; v_school int; v_feed boolean; v_tide numeric; v_wait int; v_win int; v_tok uuid := gen_random_uuid();
  v_waitx numeric := 1; v_trophy numeric := 1; v_winx numeric := 0; v_on boolean := coalesce(p_onsite, false);
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then raise exception 'no_profile'; end if;
  if p_water is null or p_water not in ('sea', 'fresh') or p_cx is null or p_cy is null or abs(p_cx) > 144000 or abs(p_cy) > 90000 then raise exception 'bad_input'; end if;
  select * into c from private.live_cfg;
  if not c.live then return jsonb_build_object('err', 'off'); end if;
  if not private.try_ok('lvc:' || v_acct::text, c.casts_per_hour, interval '1 hour') then raise exception 'slow_down'; end if;
  insert into private.live_days (acct, day) values (v_acct, v_day) on conflict do nothing;
  select * into d from private.live_days x where x.acct = v_acct and x.day = v_day for update;
  if not v_on and d.remote >= c.remote_per_day then return jsonb_build_object('err', 'remote_out', 'left', 0); end if;
  -- what is on the line (only gear this account owns counts)
  for g in select i.perk from public.anglers a
           cross join lateral (values (a.data ->> 'lure'), (a.data ->> 'rod'), (a.data ->> 'reel'), (a.data ->> 'float')) e(id)
           join public.zp_items i on i.id = e.id
           where a.id = v_acct and exists (select 1 from public.zp_owned o where o.acct = v_acct and o.item = i.id)
  loop
    v_waitx := v_waitx * coalesce((g.perk ->> 'wait')::numeric, 1);
    v_trophy := v_trophy * coalesce((g.perk ->> 'trophy')::numeric, 1);
    v_winx := v_winx + coalesce((g.perk ->> 'win')::numeric, 0);
  end loop;
  v_waitx := greatest(v_waitx, 0.6); v_trophy := least(v_trophy, 2.6); v_winx := least(v_winx, 0.6);
  -- a school right there counts in full, one next door a step less
  select greatest(private.live_school(p_cx, p_cy), coalesce(max(private.live_school(p_cx + dx, p_cy + dy)) - 1, 0)) into v_school
  from generate_series(-1, 1) dx, generate_series(-1, 1) dy where dx <> 0 or dy <> 0;
  v_feed := private.live_feed(p_cx); v_tide := private.live_tide();
  v_wait := greatest(3500, ((6000 + random() * 14000) * v_waitx * (1 - 0.2 * v_school) * (case when v_feed then 0.8 else 1 end) * (1.12 - 0.24 * v_tide))::int);
  v_win := (850 + v_winx * 1000)::int;
  insert into private.live_casts as k (acct, token, cx, cy, water, onsite, anon, cast_at, wait_ms, win_ms, school, feed, trophy, state, hook_at, tier, u, v, big, seed)
    values (v_acct, v_tok, p_cx, p_cy, p_water, v_on, coalesce(p_anon, false), clock_timestamp(), v_wait, v_win, v_school, v_feed, v_trophy, 'wait', null, null, null, null, null, null)
    on conflict (acct) do update set token = excluded.token, cx = excluded.cx, cy = excluded.cy, water = excluded.water, onsite = excluded.onsite, anon = excluded.anon,
      cast_at = excluded.cast_at, wait_ms = excluded.wait_ms, win_ms = excluded.win_ms, school = excluded.school, feed = excluded.feed, trophy = excluded.trophy,
      state = 'wait', hook_at = null, tier = null, u = null, v = null, big = null, seed = null;
  update private.live_days x set casts = x.casts + 1, remote = x.remote + (case when v_on then 0 else 1 end) where x.acct = v_acct and x.day = v_day;
  return jsonb_build_object('token', v_tok, 'wait', v_wait, 'win', v_win, 'school', v_school, 'feed', v_feed, 'tide', v_tide,
    'left', case when v_on then c.remote_per_day - d.remote else c.remote_per_day - d.remote - 1 end);
end $$;

-- strike: not before the bite, not long after it. A good strike hooks a fish: its class, its size rolls and a seed.
create or replace function public.live_strike(p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); r private.live_casts%rowtype; v_ms numeric; w numeric[]; m numeric; v_sum numeric; v_roll numeric; v_tier int := 1; i int;
  v_u numeric := random(); v_v numeric := random(); v_big boolean; v_seed int := floor(random() * 2147483647)::int;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select * into r from private.live_casts k where k.acct = v_acct for update;
  if r.acct is null or r.token <> p_token or r.state <> 'wait' then return jsonb_build_object('err', 'no_cast'); end if;
  v_ms := extract(epoch from (clock_timestamp() - r.cast_at)) * 1000;
  if v_ms < r.wait_ms - 150 then update private.live_casts k set state = 'done' where k.acct = v_acct; return jsonb_build_object('err', 'early'); end if;
  if v_ms > r.wait_ms + r.win_ms + 2500 then update private.live_casts k set state = 'done' where k.acct = v_acct; return jsonb_build_object('err', 'late'); end if;
  m := (1 + 0.5 * r.school) * (case when r.feed then 1.2 else 1 end) * (case when r.onsite then 1.25 else 1 end);
  w := array[55, 27, 12 * m, 5 * m * (case when r.onsite then 1 else 0.5 end), (case when r.onsite then 1 * m else 0 end)];
  v_sum := w[1] + w[2] + w[3] + w[4] + w[5]; v_roll := random() * v_sum;
  for i in 1..5 loop v_tier := i; v_roll := v_roll - w[i]; exit when v_roll < 0; end loop;
  v_big := random() < least(0.3, 0.04 * r.trophy * (1 + 0.25 * r.school));
  update private.live_casts k set state = 'hooked', hook_at = clock_timestamp(), tier = v_tier, u = v_u, v = v_v, big = v_big, seed = v_seed where k.acct = v_acct;
  return jsonb_build_object('tier', v_tier, 'u', v_u, 'v', v_v, 'big', v_big, 'seed', v_seed);
end $$;

-- land: the fight is over. The app says which fish of that water it was (its class may not be higher than the roll);
-- the server measures it, scores it, pays the points and writes the fish book and the weekly board.
create or replace function public.live_land(p_token uuid, p_sp text, p_ok boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); r private.live_casts%rowtype; s public.live_species%rowtype; c private.live_cfg%rowtype;
  v_day date := (now() at time zone 'Asia/Seoul')::date; v_wk date := private.zp_week(); d private.live_days%rowtype;
  v_ms numeric; v_cm numeric; v_score int; v_pts int; v_capped int; v_first boolean; v_best boolean := false; v_old numeric; v_sum int; v_id bigint; v_bonus int := 0;
  v_w numeric[] := array[1, 1.3, 1.7, 2.3, 3]; v_p int[] := array[1, 3, 6, 12, 30];
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select * into r from private.live_casts k where k.acct = v_acct for update;
  if r.acct is null or r.token <> p_token or r.state <> 'hooked' then return jsonb_build_object('err', 'no_cast'); end if;
  update private.live_casts k set state = 'done' where k.acct = v_acct;
  if not coalesce(p_ok, false) then return jsonb_build_object('lost', true); end if;
  v_ms := extract(epoch from (clock_timestamp() - r.hook_at)) * 1000;
  if v_ms < 2500 then return jsonb_build_object('err', 'too_fast'); end if;
  if v_ms > 240000 then return jsonb_build_object('err', 'late'); end if;
  select * into s from public.live_species x where x.id = p_sp;
  if s.id is null or s.tier > r.tier
     or (r.water = 'sea' and not (s.water in ('S', 'B') and s.zone in ('shore', 'coast', 'brack', 'shelf')))
     or (r.water = 'fresh' and s.water not in ('F', 'B')) then return jsonb_build_object('err', 'bad_species'); end if;
  select * into c from private.live_cfg;
  v_cm := private.live_cm(s.l_typ, s.l_max, r.u, r.v, r.big);
  v_score := round(100 * v_cm / s.l_max * v_w[s.tier])::int;
  v_pts := v_p[s.tier]; if r.big then v_pts := ceil(v_pts * 1.5)::int; end if;
  if not r.onsite then v_pts := greatest(1, ceil(v_pts * 0.5)::int); end if;
  insert into private.live_days (acct, day) values (v_acct, v_day) on conflict do nothing;
  select * into d from private.live_days x where x.acct = v_acct and x.day = v_day for update;
  v_capped := greatest(0, least(v_pts, c.day_cap - d.pts));
  select x.best into v_old from public.live_dex x where x.acct = v_acct and x.sp = s.id;
  v_first := not found;
  if v_first then v_bonus := 10; else v_best := v_cm > v_old; end if;
  insert into public.live_dex as x (acct, sp, n, best) values (v_acct, s.id, 1, v_cm)
    on conflict (acct, sp) do update set n = x.n + 1, best = greatest(x.best, excluded.best), best_at = case when excluded.best > x.best then now() else x.best_at end;
  insert into public.live_catches (acct, sp, cm, tier, big, score, pts, onsite, anon, gx, gy, wk)
    values (v_acct, s.id, v_cm, s.tier, r.big, v_score, v_capped + v_bonus, r.onsite, r.anon, floor(r.cx / 8.0)::int, floor(r.cy / 10.0)::int, v_wk)
    returning id into v_id;
  update private.live_days x set pts = x.pts + v_capped, fish = x.fish + 1 where x.acct = v_acct and x.day = v_day;
  perform private.zp_earn(v_acct, v_capped + v_bonus, 'day:' || v_day::text);
  v_sum := private.live_week_sum(v_acct, v_wk);
  insert into public.live_scores as x (wk, acct, score, n, top, top_cm) values (v_wk, v_acct, v_sum, 1, s.id, v_cm)
    on conflict (wk, acct) do update set n = x.n + 1,
      updated_at = case when excluded.score > x.score then now() else x.updated_at end,
      top = case when v_score >= coalesce((select max(q.score) from public.live_catches q where q.acct = v_acct and q.wk = v_wk and q.id <> v_id), 0) then excluded.top else x.top end,
      top_cm = case when v_score >= coalesce((select max(q.score) from public.live_catches q where q.acct = v_acct and q.wk = v_wk and q.id <> v_id), 0) then excluded.top_cm else x.top_cm end,
      score = excluded.score;
  return jsonb_build_object('id', v_id, 'sp', s.id, 'cm', v_cm, 'tier', s.tier, 'big', r.big, 'score', v_score, 'pts', v_capped + v_bonus, 'first', v_first, 'best', v_best,
    'capped', v_capped < v_pts, 'onsite', r.onsite,
    'day', jsonb_build_object('pts', d.pts + v_capped, 'cap', c.day_cap, 'fish', d.fish + 1),
    'wk', jsonb_build_object('s', v_sum, 'r', (select b.rk from private.live_board(v_wk) b where b.acct = v_acct)),
    'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0));
end $$;

-- the operator strikes a week's bag out (or puts it back)
create or replace function public.live_void(p_wk date, p_acct uuid, p_void boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.live_scores s set void = coalesce(p_void, true) where s.wk = p_wk and s.acct = p_acct;
  return found;
end $$;

revoke all on function private.live_school(int, int, timestamptz), private.live_feed(int, timestamptz), private.live_tide(timestamptz), private.live_cm(numeric, numeric, numeric, numeric, boolean),
  private.live_week_sum(uuid, date), private.live_board(date), private.zp_earn(uuid, int, text), private.live_award(date) from public, anon, authenticated;
revoke all on function public.live_state(), public.live_schools(int, int, int, int), public.live_cast(int, int, text, boolean, boolean), public.live_strike(uuid), public.live_land(uuid, text, boolean), public.live_void(date, uuid, boolean) from public, anon;
grant execute on function public.live_state(), public.live_schools(int, int, int, int), public.live_cast(int, int, text, boolean, boolean), public.live_strike(uuid), public.live_land(uuid, text, boolean), public.live_void(date, uuid, boolean) to authenticated;
