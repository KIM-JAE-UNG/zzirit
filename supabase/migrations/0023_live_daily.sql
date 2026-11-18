-- 0023: 오늘의 미션 and 연속 출석 (the daily missions and the visit streak) for 찌릿 라이브.
-- Every Korean day each angler gets three small missions, picked by the server from what they did in the game today
-- (fish landed, a rare one, a big one, fish sold or let go, a fish from far away, a sea or a freshwater fish). A done
-- mission pays a few points once; all three done pays a bonus once. Opening the game once a day counts as a visit:
-- days in a row make the streak (5P a day, 30P every 7th day). The server counts everything from its own tables, so
-- the phone can't say a mission is done. Points go through the same book (zp_ledger, reason 'prize') once per ref.
-- Only adds: one table and functions. Nothing is removed.

create table if not exists private.live_streak (
  acct uuid primary key references auth.users(id) on delete cascade,
  last_day date not null,
  streak int not null default 1 check (streak >= 1),
  best int not null default 1 check (best >= 1),
  total int not null default 1 check (total >= 1),
  updated_at timestamptz not null default now()
);
revoke all on private.live_streak from public, anon, authenticated;

-- the points: a visit is 5, every 7th day in a row 30; a mission by its kind; all three 20
create or replace function private.live_visit_pts(p_streak int) returns int
language sql immutable set search_path = '' as $$ select case when p_streak > 0 and p_streak % 7 = 0 then 30 else 5 end $$;

-- today's three missions for one angler: one about landing fish, two others, the same all day
-- returns [{k, goal, pts}]
create or replace function private.live_missions(p_acct uuid, p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h text := md5(p_acct::text || ':' || p_day::text || ':mission'); v_pool text[] := array['rare', 'big', 'sell', 'free', 'remote', 'water'];
  v_a int; v_b int; v_out jsonb; k text; v_list text[];
begin
  v_a := (('x' || substr(h, 1, 4))::bit(16)::int) % 6;
  v_b := (('x' || substr(h, 5, 4))::bit(16)::int) % 5; if v_b >= v_a then v_b := v_b + 1; end if;
  v_list := array[case when (('x' || substr(h, 9, 2))::bit(8)::int) % 3 = 0 then 'fish6' else 'fish3' end, v_pool[v_a + 1], v_pool[v_b + 1]];
  v_out := '[]'::jsonb;
  foreach k in array v_list loop
    if k = 'water' then k := case when (('x' || substr(h, 11, 2))::bit(8)::int) % 2 = 0 then 'sea' else 'fresh' end; end if;
    v_out := v_out || jsonb_build_object('k', k,
      'goal', case k when 'fish3' then 3 when 'fish6' then 6 when 'sell' then 3 when 'sea' then 2 when 'fresh' then 2 else 1 end,
      'pts', case k when 'fish3' then 10 when 'fish6' then 20 when 'rare' then 20 when 'big' then 20 when 'sea' then 15 when 'fresh' then 15 else 10 end);
  end loop;
  return v_out;
end $$;

-- how far one mission is today, counted from the game's own tables
create or replace function private.live_mission_n(p_acct uuid, p_day date, p_k text) returns int
language sql stable security definer set search_path = '' as $$
  with b as (select (p_day::timestamp at time zone 'Asia/Seoul') as t0, ((p_day + 1)::timestamp at time zone 'Asia/Seoul') as t1),
  caught as (select c.* from public.live_catches c, b where c.acct = p_acct and c.created_at >= b.t0 and c.created_at < b.t1),
  gone as (select c.* from public.live_catches c, b where c.acct = p_acct and c.sold_at >= b.t0 and c.sold_at < b.t1 and c.sold_at > c.created_at)
  select (case p_k
    when 'fish3' then (select count(*) from caught)
    when 'fish6' then (select count(*) from caught)
    when 'rare' then (select count(*) from caught where tier >= 3)
    when 'big' then (select count(*) from caught where big)
    when 'remote' then (select count(*) from caught where not onsite)
    when 'sea' then (select count(*) from caught x join public.live_species s on s.id = x.sp where s.water in ('S', 'B'))
    when 'fresh' then (select count(*) from caught x join public.live_species s on s.id = x.sp where s.water in ('F', 'B'))
    when 'sell' then (select count(*) from gone where coalesce(sold_for, 0) > 0)
    when 'free' then (select count(*) from gone where sold_for = 0)
    else 0 end)::int;
$$;

-- a visit on that day: the streak grows by one after yesterday, starts again after a gap. Pays once a day.
create or replace function private.live_checkin(p_acct uuid, p_day date) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r private.live_streak%rowtype; v_new boolean := false; v_pts int := 0;
begin
  select * into r from private.live_streak s where s.acct = p_acct for update;
  if not found then
    insert into private.live_streak (acct, last_day) values (p_acct, p_day) on conflict (acct) do nothing;
    select * into r from private.live_streak s where s.acct = p_acct for update;
    v_new := r.last_day = p_day and r.total = 1 and r.streak = 1;
  elsif r.last_day < p_day then
    update private.live_streak s set streak = case when r.last_day = p_day - 1 then r.streak + 1 else 1 end,
      best = greatest(r.best, case when r.last_day = p_day - 1 then r.streak + 1 else 1 end), total = r.total + 1, last_day = p_day, updated_at = now()
      where s.acct = p_acct returning * into r;
    v_new := true;
  end if;
  if v_new then
    v_pts := private.live_visit_pts(r.streak);
    if not private.zp_add(p_acct, v_pts, 'prize', 'visit:' || p_day::text, r.streak::text) then v_pts := 0; end if;
  end if;
  return jsonb_build_object('streak', case when r.last_day >= p_day - 1 then r.streak else 0 end, 'best', r.best, 'total', r.total, 'got', v_pts,
    'next', private.live_visit_pts(r.streak + 1), 'to7', 7 - (r.streak % 7));
end $$;

-- what the app shows: today's visit (counted now), the streak and the three missions with how far each is
create or replace function public.live_daily() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_day date := (now() at time zone 'Asia/Seoul')::date; v_vis jsonb; m jsonb; v_list jsonb := '[]'::jsonb; v_n int;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  v_vis := private.live_checkin(v_acct, v_day);
  for m in select * from jsonb_array_elements(private.live_missions(v_acct, v_day)) loop
    v_n := private.live_mission_n(v_acct, v_day, m ->> 'k');
    v_list := v_list || (m || jsonb_build_object('n', least(v_n, (m ->> 'goal')::int),
      'got', exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'mis:' || v_day::text || ':' || (m ->> 'k'))));
  end loop;
  return jsonb_build_object('day', v_day, 'visit', v_vis, 'missions', v_list, 'all', 20,
    'allGot', exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'mis:' || v_day::text || ':all'),
    'until', (extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Seoul')) * 1000)::bigint,
    'bal', coalesce((select w.bal from public.zp_wallets w where w.acct = v_acct), 0));
end $$;

-- take the points for a done mission (p_k is one of today's three, or 'all' once all three are taken)
create or replace function public.live_mission_claim(p_k text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_day date := (now() at time zone 'Asia/Seoul')::date; m jsonb; v_pts int; v_ok boolean;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  if p_k = 'all' then
    if exists (select 1 from jsonb_array_elements(private.live_missions(v_acct, v_day)) x
               where not exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'mis:' || v_day::text || ':' || (x ->> 'k')))
    then return jsonb_build_object('err', 'not_done'); end if;
    v_pts := 20;
  else
    select x into m from jsonb_array_elements(private.live_missions(v_acct, v_day)) x where x ->> 'k' = p_k;
    if m is null then return jsonb_build_object('err', 'not_today'); end if;
    if private.live_mission_n(v_acct, v_day, p_k) < (m ->> 'goal')::int then return jsonb_build_object('err', 'not_done'); end if;
    v_pts := (m ->> 'pts')::int;
  end if;
  v_ok := private.zp_add(v_acct, v_pts, 'prize', 'mis:' || v_day::text || ':' || p_k, p_k);
  if not v_ok then return jsonb_build_object('err', 'already'); end if;
  return jsonb_build_object('ok', true, 'k', p_k, 'pts', v_pts, 'bal', coalesce((select w.bal from public.zp_wallets w where w.acct = v_acct), 0));
end $$;

revoke all on function private.live_visit_pts(int), private.live_missions(uuid, date), private.live_mission_n(uuid, date, text), private.live_checkin(uuid, date) from public, anon, authenticated;
revoke all on function public.live_daily(), public.live_mission_claim(text) from public, anon;
grant execute on function public.live_daily(), public.live_mission_claim(text) to authenticated;
