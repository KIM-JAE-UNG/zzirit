-- 0027: 전설의 괴어 레이드 (the legendary monster raid) for 찌릿 라이브.
-- Every two hours, on the hour, a giant legendary fish shows up at a famous sea for 20 minutes.
-- Everyone in the app can join from anywhere: each strike takes some of its strength (HP). The more people join, the
-- stronger it gets (each new angler adds HP), so it is beaten together. Beaten in time: everyone who struck gets points
-- by their share (30 + up to 120), the one who did the most (MVP) gets 50 more and the fish in the fish book.
-- Not beaten in time: it gets away, nobody gets anything.
-- The server decides the damage (the phone only says how well-timed the strike was, 0..1, and is capped) and how often
-- one may strike. The raid is made by the first person who looks, so no schedule is needed.
-- Only adds: tables and functions in the private schema, two functions the app calls. Nothing is removed.

create table if not exists private.raid_cfg (
  id int primary key default 1 check (id = 1),
  every_min int not null default 120 check (every_min between 2 and 1440),
  dur_min int not null default 20 check (dur_min between 1 and 1440),
  base_hp int not null default 1500 check (base_hp > 0),
  add_hp int not null default 600 check (add_hp >= 0),
  gap_ms int not null default 600 check (gap_ms >= 0)
);
insert into private.raid_cfg (id) values (1) on conflict (id) do nothing;
revoke all on private.raid_cfg from public, anon, authenticated;

create table if not exists private.live_raids (
  id bigint primary key,                        -- its start, in seconds since 1970
  sp text not null references public.live_species(id),
  spot text not null check (spot ~ '^[a-z0-9_]{2,24}$'),
  lat numeric not null, lon numeric not null,
  hp int not null, max_hp int not null,
  starts timestamptz not null, ends timestamptz not null,
  beaten_at timestamptz,
  mvp uuid references auth.users(id) on delete set null
);
create table if not exists private.live_raid_hits (
  raid bigint not null references private.live_raids(id) on delete cascade,
  acct uuid not null references auth.users(id) on delete cascade,
  dmg int not null default 0, hits int not null default 0, crits int not null default 0,
  first_at timestamptz not null default now(), last_at timestamptz not null default now(),
  primary key (raid, acct)
);
create index if not exists live_raid_hits_acct on private.live_raid_hits (acct);
revoke all on private.live_raids, private.live_raid_hits from public, anon, authenticated;

-- the famous seas it may come up in, and the monsters (all of them fish the live game knows)
create or replace function private.raid_pick(p_slot bigint) returns table (spot text, lat numeric, lon numeric, sp text)
language sql immutable set search_path = '' as $$
  with s(i, k, la, lo) as (values
    (0, 'jeju', 33.20, 126.55), (1, 'dokdo', 37.24, 131.87), (2, 'busan', 35.05, 129.15), (3, 'yeosu', 34.62, 127.80),
    (4, 'ulleung', 37.50, 130.85), (5, 'taean', 36.72, 126.05), (6, 'okinawa', 26.40, 127.70), (7, 'tokyo', 35.30, 139.80),
    (8, 'hongkong', 22.20, 114.25), (9, 'hawaii', 21.25, -157.85), (10, 'sydney', -33.85, 151.30), (11, 'florida', 24.55, -81.80)),
  f(i, id) as (values (0, 'kue'), (1, 'ishidai'), (2, 'gt'), (3, 'tarpon'), (4, 'ishigakidai'), (5, 'hiramasa'))
  select s.k, s.la::numeric, s.lo::numeric, f.id from s, f
  where s.i = ((p_slot * 7 + 3) % 12 + 12) % 12 and f.i = ((p_slot * 5 + 1) % 6 + 6) % 6;
$$;

-- the raid on now (made by the first one who asks), or null between raids
create or replace function private.raid_now(p_at timestamptz default now()) returns private.live_raids
language plpgsql security definer set search_path = '' as $$
declare c private.raid_cfg%rowtype; v_slot bigint; v_st timestamptz; r private.live_raids%rowtype; p record;
begin
  select * into c from private.raid_cfg where id = 1;
  v_slot := floor(extract(epoch from p_at) / (c.every_min * 60))::bigint;
  v_st := to_timestamp(v_slot * c.every_min * 60);
  if p_at >= v_st + make_interval(mins => c.dur_min) then return null; end if;
  select * into r from private.live_raids x where x.id = extract(epoch from v_st)::bigint;
  if found then return r; end if;
  select * into p from private.raid_pick(v_slot);
  insert into private.live_raids (id, sp, spot, lat, lon, hp, max_hp, starts, ends)
    values (extract(epoch from v_st)::bigint, p.sp, p.spot, p.lat, p.lon, c.base_hp, c.base_hp, v_st, v_st + make_interval(mins => c.dur_min))
    on conflict (id) do nothing;
  select * into r from private.live_raids x where x.id = extract(epoch from v_st)::bigint;
  return r;
end $$;

-- beaten: pay everyone once (by share), the MVP gets more and the monster in the fish book
create or replace function private.raid_win(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare r private.live_raids%rowtype; v_tot int; h record; v_mvp uuid;
begin
  select x.acct into v_mvp from private.live_raid_hits x where x.raid = p_id and x.dmg > 0 order by x.dmg desc, x.first_at limit 1;
  update private.live_raids x set beaten_at = now(), mvp = v_mvp, hp = 0 where x.id = p_id and x.beaten_at is null returning * into r;
  if not found then return; end if;
  select coalesce(sum(x.dmg), 0) into v_tot from private.live_raid_hits x where x.raid = p_id;
  for h in select x.acct, x.dmg from private.live_raid_hits x where x.raid = p_id and x.dmg > 0 loop
    perform private.zp_add(h.acct, 30 + round(120.0 * h.dmg / greatest(v_tot, 1))::int + case when h.acct = v_mvp then 50 else 0 end,
      'prize', 'raid:' || p_id, case when h.acct = v_mvp then 'raid mvp' else 'raid' end);
  end loop;
  if v_mvp is not null then
    insert into public.live_dex as d (acct, sp, n, best)
      values (v_mvp, r.sp, 1, (select s.l_max from public.live_species s where s.id = r.sp))
      on conflict (acct, sp) do update set n = d.n + 1, best = greatest(d.best, excluded.best),
        best_at = case when excluded.best > d.best then now() else d.best_at end;
  end if;
end $$;

-- what the app shows: the raid on now (or when the next one comes) and how the last one went
create or replace function private.raid_json(r private.live_raids, p_acct uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'sp', r.sp, 'spot', r.spot, 'lat', r.lat, 'lon', r.lon, 'hp', greatest(r.hp, 0), 'max', r.max_hp,
    'starts', (extract(epoch from r.starts) * 1000)::bigint, 'ends', (extract(epoch from r.ends) * 1000)::bigint,
    'beaten', case when r.beaten_at is null then null else (extract(epoch from r.beaten_at) * 1000)::bigint end,
    'mvp', r.mvp, 'mvpNick', (select a.data ->> 'nick' from public.anglers a where a.id = r.mvp),
    'n', (select count(*) from private.live_raid_hits x where x.raid = r.id),
    'top', coalesce((select jsonb_agg(jsonb_build_object('a', y.acct, 'nick', y.nick, 'd', y.dmg) order by y.dmg desc, y.first_at) from (
        select x.acct, x.dmg, x.first_at, (select a.data ->> 'nick' from public.anglers a where a.id = x.acct) nick
        from private.live_raid_hits x where x.raid = r.id order by x.dmg desc, x.first_at limit 5) y), '[]'::jsonb),
    'me', (select jsonb_build_object('d', x.dmg, 'hits', x.hits, 'crits', x.crits,
        'rk', (select count(*) + 1 from private.live_raid_hits z where z.raid = r.id and (z.dmg > x.dmg or (z.dmg = x.dmg and z.first_at < x.first_at))))
      from private.live_raid_hits x where x.raid = r.id and x.acct = p_acct),
    'pts', (select l.delta from public.zp_ledger l where l.acct = p_acct and l.reason = 'prize' and l.ref = 'raid:' || r.id));
$$;

create or replace function public.live_raid() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); c private.raid_cfg%rowtype; r private.live_raids%rowtype; l private.live_raids%rowtype; v_next bigint;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select * into c from private.raid_cfg where id = 1;
  r := private.raid_now();
  v_next := ((floor(extract(epoch from now()) / (c.every_min * 60))::bigint + 1) * c.every_min * 60) * 1000;
  select * into l from private.live_raids x where x.ends <= now() or x.beaten_at is not null order by x.id desc limit 1;
  return jsonb_build_object('now', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'next', v_next, 'every', c.every_min, 'dur', c.dur_min,
    'raid', case when r.id is null then null else private.raid_json(r, v_acct) end,
    'last', case when l.id is null or l.id = r.id then null else private.raid_json(l, v_acct) end);
end $$;

-- one strike: p_q is how well-timed it was (0..1, the phone's word: capped, and the damage is the server's)
create or replace function public.live_raid_hit(p_id bigint, p_q numeric) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); c private.raid_cfg%rowtype; r private.live_raids%rowtype; h private.live_raid_hits%rowtype;
  v_q numeric; v_crit boolean; v_dmg int;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  select * into c from private.raid_cfg where id = 1;
  perform private.raid_now();
  select * into r from private.live_raids x where x.id = p_id for update;
  if not found then return jsonb_build_object('err', 'no_raid'); end if;
  if r.beaten_at is not null then return jsonb_build_object('err', 'beaten', 'raid', private.raid_json(r, v_acct)); end if;
  if now() < r.starts or now() >= r.ends then return jsonb_build_object('err', 'over', 'raid', private.raid_json(r, v_acct)); end if;
  select * into h from private.live_raid_hits x where x.raid = r.id and x.acct = v_acct for update;
  if not found then
    -- someone new: the monster grows stronger (the first one fights it at its base strength)
    if exists (select 1 from private.live_raid_hits x where x.raid = r.id) then
      update private.live_raids x set hp = x.hp + c.add_hp, max_hp = x.max_hp + c.add_hp where x.id = r.id returning * into r;
    end if;
    insert into private.live_raid_hits (raid, acct) values (r.id, v_acct) returning * into h;
  elsif h.last_at > clock_timestamp() - make_interval(secs => c.gap_ms / 1000.0) then
    return jsonb_build_object('err', 'fast');
  end if;
  v_q := least(greatest(coalesce(p_q, 0), 0), 1);
  v_crit := v_q >= 0.85;
  v_dmg := 6 + round(v_q * 12)::int + floor(random() * 5)::int;
  if v_crit then v_dmg := v_dmg * 2; end if;
  v_dmg := least(v_dmg, greatest(r.hp, 0));
  update private.live_raid_hits x set dmg = x.dmg + v_dmg, hits = x.hits + 1, crits = x.crits + v_crit::int, last_at = clock_timestamp()
    where x.raid = r.id and x.acct = v_acct returning * into h;
  update private.live_raids x set hp = x.hp - v_dmg where x.id = r.id returning * into r;
  if r.hp <= 0 then perform private.raid_win(r.id); select * into r from private.live_raids x where x.id = p_id; end if;
  return jsonb_build_object('ok', true, 'dmg', v_dmg, 'crit', v_crit, 'hp', greatest(r.hp, 0), 'max', r.max_hp,
    'beaten', r.beaten_at is not null, 'raid', case when r.beaten_at is not null then private.raid_json(r, v_acct) else null end,
    'me', jsonb_build_object('d', h.dmg, 'hits', h.hits));
end $$;

revoke all on function private.raid_pick(bigint), private.raid_now(timestamptz), private.raid_win(bigint), private.raid_json(private.live_raids, uuid) from public, anon, authenticated;
revoke all on function public.live_raid(), public.live_raid_hit(bigint, numeric) from public, anon;
grant execute on function public.live_raid(), public.live_raid_hit(bigint, numeric) to authenticated;
