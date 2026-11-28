-- 0030: 바다 땅따먹기 (sea turf) and 동호회 대항전 (the club war).
-- The water of the world is cut into squares of 0.1° × 0.1° (about 10 km). Every fish landed in 찌릿 라이브 adds its score
-- to the angler's power in that square for the week (Korean week, Monday to Sunday). Whoever has the most power owns the
-- square — until someone lands more. Clubs (teams) own a square when their members' power together is the most.
-- The server keeps who took what from whom, so the app can say "OO took your sea" and offer to take it back.
-- Last week's squares pay once: 10 points each, at most 100.
-- Names show at the square (10 km) at most; an angler fishing unnamed shows as hidden. Voided weeks do not count.
-- Only adds: tables, functions, a trigger. Nothing is removed.

/* ---------- 1. the tables (private: read only through the functions below) ---------- */
create table if not exists private.live_turf (       -- one line per week, square and angler
  wk date not null,
  tx int not null, ty int not null,                  -- the square: floor(lon / 0.1°), floor(lat / 0.1°)
  acct uuid not null references auth.users(id) on delete cascade,
  power int not null default 0,
  n int not null default 0,
  anon boolean not null default false,
  reached_at timestamptz not null default clock_timestamp(),
  primary key (wk, tx, ty, acct)
);
create index if not exists live_turf_acct on private.live_turf (wk, acct);
create table if not exists private.live_turf_own (   -- who holds each square now (for the news of who took it)
  wk date not null, tx int not null, ty int not null,
  acct uuid not null references auth.users(id) on delete cascade,
  power int not null default 0,
  since timestamptz not null default clock_timestamp(),
  primary key (wk, tx, ty)
);
create table if not exists private.live_turf_log (   -- a square changed hands
  id bigint generated always as identity primary key,
  wk date not null, tx int not null, ty int not null,
  won uuid not null references auth.users(id) on delete cascade,
  lost uuid references auth.users(id) on delete cascade,
  at timestamptz not null default clock_timestamp()
);
create index if not exists live_turf_log_won on private.live_turf_log (won, id desc);
create index if not exists live_turf_log_lost on private.live_turf_log (lost, id desc);

/* ---------- 2. every landed fish adds to the square ---------- */
create or replace function private.live_turf_add(p_wk date, p_tx int, p_ty int, p_acct uuid, p_score int, p_anon boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare o private.live_turf_own%rowtype; b record; v_op int;
begin
  insert into private.live_turf as t (wk, tx, ty, acct, power, n, anon, reached_at) values (p_wk, p_tx, p_ty, p_acct, greatest(0, p_score), 1, coalesce(p_anon, false), clock_timestamp())
    on conflict (wk, tx, ty, acct) do update set power = t.power + excluded.power, n = t.n + 1, anon = t.anon or excluded.anon, reached_at = clock_timestamp();
  insert into private.live_turf_own as w (wk, tx, ty, acct, power) values (p_wk, p_tx, p_ty, p_acct, 0) on conflict (wk, tx, ty) do nothing;
  if found then
    update private.live_turf_own w set power = greatest(0, p_score) where w.wk = p_wk and w.tx = p_tx and w.ty = p_ty;
    insert into private.live_turf_log (wk, tx, ty, won, lost) values (p_wk, p_tx, p_ty, p_acct, null);
    return;
  end if;
  select * into o from private.live_turf_own w where w.wk = p_wk and w.tx = p_tx and w.ty = p_ty for update;
  select t.acct, t.power into b from private.live_turf t where t.wk = p_wk and t.tx = p_tx and t.ty = p_ty order by t.power desc, t.reached_at asc limit 1;
  if b.acct = o.acct then
    update private.live_turf_own w set power = b.power where w.wk = p_wk and w.tx = p_tx and w.ty = p_ty;
  else
    select t.power into v_op from private.live_turf t where t.wk = p_wk and t.tx = p_tx and t.ty = p_ty and t.acct = o.acct;
    if b.power > coalesce(v_op, 0) then   -- a tie keeps the one who was there first
      update private.live_turf_own w set acct = b.acct, power = b.power, since = clock_timestamp() where w.wk = p_wk and w.tx = p_tx and w.ty = p_ty;
      insert into private.live_turf_log (wk, tx, ty, won, lost) values (p_wk, p_tx, p_ty, b.acct, o.acct);
    end if;
  end if;
end $$;
create or replace function private.live_turf_on_catch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.live_turf_add(new.wk, floor(new.gx / 10.0)::int, floor(new.gy / 10.0)::int, new.acct, new.score, new.anon);
  return new;
end $$;
create or replace trigger live_catches_turf after insert on public.live_catches for each row execute function private.live_turf_on_catch();

/* ---------- 3. who owns what (a voided week does not count) ---------- */
-- the owner of every square of a week: the most power, the one who got there first on a tie
create or replace function private.live_turf_owners(p_wk date) returns table (tx int, ty int, acct uuid, power int, anon boolean, rivals bigint)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.tx, t.ty) t.tx, t.ty, t.acct, t.power, t.anon, count(*) over (partition by t.tx, t.ty)
  from private.live_turf t
  where t.wk = p_wk and t.power > 0 and not exists (select 1 from public.live_scores s where s.wk = p_wk and s.acct = t.acct and s.void)
  order by t.tx, t.ty, t.power desc, t.reached_at asc;
$$;
-- the clubs: the leader, and members the club lets in (open clubs take everyone who says so; closed ones the ones let in)
create or replace function private.live_team_of() returns table (acct uuid, tid uuid)
language sql stable security definer set search_path = '' as $$
  select tm.id, tm.id from public.teams tm where coalesce(tm.data ->> 'name', '') <> ''
  union
  select a.id, tm.id from public.anglers a
  join public.teams tm on tm.id::text = (a.data -> 'team' ->> 'id')
  where coalesce(tm.data ->> 'name', '') <> '' and a.id <> tm.id
    and not coalesce(tm.data -> 'ban' ? a.id::text, false)
    and (tm.data -> 'open' = 'true'::jsonb or coalesce(tm.data -> 'members' ? a.id::text, false));
$$;
create or replace function private.live_team_turf(p_wk date) returns table (tx int, ty int, tid uuid, power bigint)
language sql stable security definer set search_path = '' as $$
  select distinct on (q.tx, q.ty) q.tx, q.ty, q.tid, q.power from (
    select t.tx, t.ty, m.tid, sum(t.power) as power, min(t.reached_at) as first_at
    from private.live_turf t join private.live_team_of() m on m.acct = t.acct
    where t.wk = p_wk and t.power > 0 and not exists (select 1 from public.live_scores s where s.wk = p_wk and s.acct = t.acct and s.void)
    group by t.tx, t.ty, m.tid) q
  order by q.tx, q.ty, q.power desc, q.first_at asc;
$$;
create or replace function private.live_team_card(p_tid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', tm.id, 'name', left(coalesce(tm.data ->> 'name', ''), 24), 'tag', left(coalesce(tm.data ->> 'tag', ''), 6),
    'emoji', left(coalesce(tm.data ->> 'emoji', ''), 4), 'color', case when (tm.data ->> 'color') ~ '^#[0-9A-Fa-f]{6}$' then tm.data ->> 'color' else '#0B6E8E' end)
  from public.teams tm where tm.id = p_tid;
$$;
-- the week ends on Monday 00:00 in Korea
create or replace function private.live_turf_ends() returns bigint language sql stable set search_path = '' as $$
  select (extract(epoch from ((private.zp_week() + 7)::timestamp at time zone 'Asia/Seoul')) * 1000)::bigint;
$$;

/* ---------- 4. what the app calls ---------- */
-- the squares in a box (at most 4,000 squares a call): owner (hidden when unnamed), power, my power, the club holding it
create or replace function public.live_turf(p_x0 int, p_y0 int, p_x1 int, p_y1 int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_wk date := private.zp_week();
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if p_x0 is null or p_y0 is null or p_x1 is null or p_y1 is null or p_x1 < p_x0 or p_y1 < p_y0 or (p_x1 - p_x0 + 1)::bigint * (p_y1 - p_y0 + 1) > 4000 then raise exception 'bad_input'; end if;
  return (with o as (select * from private.live_turf_owners(v_wk) w where w.tx between p_x0 and p_x1 and w.ty between p_y0 and p_y1),
    tt as (select * from private.live_team_turf(v_wk) w where w.tx between p_x0 and p_x1 and w.ty between p_y0 and p_y1),
    mine as (select t.tx, t.ty, t.power from private.live_turf t where t.wk = v_wk and t.acct = v_acct and t.tx between p_x0 and p_x1 and t.ty between p_y0 and p_y1),
    keys as (select o.tx, o.ty from o union select tt.tx, tt.ty from tt)
  select jsonb_build_object('wk', v_wk, 'ends', private.live_turf_ends(), 'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'cells', coalesce(jsonb_agg(jsonb_build_object('x', k.tx, 'y', k.ty,
        'a', case when o.anon and o.acct <> v_acct then null else o.acct end, 'p', o.power, 'me', o.acct = v_acct, 'mp', coalesce(m.power, 0), 'c', o.rivals,
        't', tt.tid, 'tp', tt.power)), '[]'::jsonb),
    'teams', coalesce((select jsonb_object_agg(x.tid, private.live_team_card(x.tid)) from (select distinct tt.tid from tt) x), '{}'::jsonb))
  from keys k left join o on o.tx = k.tx and o.ty = k.ty left join tt on tt.tx = k.tx and tt.ty = k.ty left join mine m on m.tx = k.tx and m.ty = k.ty);
end $$;

-- my week: how many squares I hold, the lords and the clubs of the week, what was taken from me (and what I took), last week's pay
create or replace function public.live_turf_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_wk date := private.zp_week(); v_last date := private.zp_week() - 7; v_n int; v_ln int; v_tid uuid;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select m.tid into v_tid from private.live_team_of() m where m.acct = v_acct limit 1;
  select count(*) into v_ln from private.live_turf_owners(v_last) o where o.acct = v_acct;
  return (with o as (select * from private.live_turf_owners(v_wk)),
    lords as (select o.acct, count(*) as n, sum(o.power) as p, bool_or(o.anon) as anon, rank() over (order by count(*) desc, sum(o.power) desc) as rk from o group by o.acct),
    clubs as (select w.tid, count(*) as n, sum(w.power) as p, rank() over (order by count(*) desc, sum(w.power) desc) as rk from private.live_team_turf(v_wk) w group by w.tid)
  select jsonb_build_object('wk', v_wk, 'ends', private.live_turf_ends(), 'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'n', coalesce((select l.n from lords l where l.acct = v_acct), 0),
    'rk', (select l.rk from lords l where l.acct = v_acct),
    'lords_n', (select count(*) from lords),
    'cells', coalesce((select jsonb_agg(jsonb_build_array(x.tx, x.ty, x.power) order by x.power desc) from (select * from o where o.acct = v_acct order by o.power desc limit 60) x), '[]'::jsonb),
    'lords', coalesce((select jsonb_agg(jsonb_build_object('a', case when l.anon and l.acct <> v_acct then null else l.acct end, 'n', l.n, 'p', l.p, 'rk', l.rk) order by l.rk, l.p desc)
                       from (select * from lords order by rk, p desc limit 10) l), '[]'::jsonb),
    'clubs', coalesce((select jsonb_agg(private.live_team_card(c.tid) || jsonb_build_object('n', c.n, 'p', c.p, 'rk', c.rk) order by c.rk, c.p desc)
                       from (select * from clubs order by rk, p desc limit 10) c), '[]'::jsonb),
    'team', case when v_tid is null then null else coalesce((select private.live_team_card(c.tid) || jsonb_build_object('n', c.n, 'p', c.p, 'rk', c.rk) from clubs c where c.tid = v_tid),
                                                            private.live_team_card(v_tid) || jsonb_build_object('n', 0, 'p', 0, 'rk', null)) end,
    'clubs_n', (select count(*) from clubs),
    'log', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'x', g.tx, 'y', g.ty, 'k', case when g.won = v_acct then 'won' else 'lost' end,
          'who', case when g.won = v_acct then (case when g.lost is null or coalesce((select t.anon from private.live_turf t where t.wk = g.wk and t.tx = g.tx and t.ty = g.ty and t.acct = g.lost), false) then null else g.lost end)
                      else (case when coalesce((select t.anon from private.live_turf t where t.wk = g.wk and t.tx = g.tx and t.ty = g.ty and t.acct = g.won), false) then null else g.won end) end,
          'at', (extract(epoch from g.at) * 1000)::bigint) order by g.id desc)
       from (select * from private.live_turf_log g where (g.won = v_acct or g.lost = v_acct) and g.wk = v_wk order by g.id desc limit 20) g), '[]'::jsonb),
    'last', jsonb_build_object('wk', v_last, 'n', v_ln, 'pts', least(100, v_ln * 10),
      'got', exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'turf:' || v_last::text)),
    'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0)));
end $$;

-- last week's squares pay once: 10 points each, at most 100
create or replace function public.live_turf_claim() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_last date := private.zp_week() - 7; v_n int; v_pts int;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  select count(*) into v_n from private.live_turf_owners(v_last) o where o.acct = v_acct;
  if v_n = 0 then return jsonb_build_object('err', 'none'); end if;
  v_pts := least(100, v_n * 10);
  if not private.zp_add(v_acct, v_pts, 'prize', 'turf:' || v_last::text, v_n::text || ' seas') then return jsonb_build_object('err', 'already'); end if;
  return jsonb_build_object('ok', true, 'n', v_n, 'pts', v_pts, 'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0));
end $$;

/* ---------- 5. this week's fish so far count from today ---------- */
insert into private.live_turf (wk, tx, ty, acct, power, n, anon, reached_at)
  select c.wk, floor(c.gx / 10.0)::int, floor(c.gy / 10.0)::int, c.acct, sum(c.score), count(*), bool_or(c.anon), max(c.created_at)
  from public.live_catches c where c.wk = private.zp_week() group by 1, 2, 3, 4
on conflict do nothing;
insert into private.live_turf_own (wk, tx, ty, acct, power, since)
  select o.wk, o.tx, o.ty, o.acct, o.power, now() from (
    select distinct on (t.tx, t.ty) t.wk, t.tx, t.ty, t.acct, t.power from private.live_turf t where t.wk = private.zp_week() order by t.tx, t.ty, t.power desc, t.reached_at asc) o
on conflict do nothing;

revoke all on table private.live_turf, private.live_turf_own, private.live_turf_log from public, anon, authenticated;
revoke all on function private.live_turf_add(date, int, int, uuid, int, boolean), private.live_turf_on_catch(), private.live_turf_owners(date), private.live_team_of(),
  private.live_team_turf(date), private.live_team_card(uuid), private.live_turf_ends() from public, anon, authenticated;
revoke all on function public.live_turf(int, int, int, int), public.live_turf_me(), public.live_turf_claim() from public, anon;
grant execute on function public.live_turf(int, int, int, int), public.live_turf_me(), public.live_turf_claim() to authenticated;
