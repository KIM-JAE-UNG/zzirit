-- 0028: 레이드 기록과 괴어 칭호 (the raid record and raid titles) for 찌릿 라이브.
-- Everything an angler has done in the legendary raids, counted by the server from its own tables (0027):
-- raids joined and beaten, times MVP, all the damage, the best raid, the monsters beaten (a small fish book of its own),
-- and the last raids. Four raid titles: beat one (괴어 사냥꾼), beat ten (레이드 베테랑), be MVP once (괴어 MVP),
-- beat all six monsters (괴어 정복자). Done: the server pays the points once and the title can be worn like a set title.
-- Only adds: one column (with a default), a table, rows and functions. The set functions of 0026 are replaced so they
-- keep showing only fish sets. Nothing is removed.

alter table private.live_sets add column if not exists kind text not null default 'fish';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_sets_kind_ok') then
    alter table private.live_sets add constraint live_sets_kind_ok check (kind in ('fish', 'raid'));
  end if;
end $$;

-- the raid titles: what to count and how many. Each has a row in live_sets too (kind 'raid'), so a worn title is one key.
create table if not exists private.raid_titles (
  k text primary key check (k ~ '^raid_[a-z0-9_]{2,19}$'),
  metric text not null check (metric in ('won', 'mvp', 'all')),
  goal int not null check (goal >= 1),
  pts int not null check (pts >= 0),
  sort int not null default 0
);
revoke all on private.raid_titles from public, anon, authenticated;
insert into private.raid_titles (k, metric, goal, pts, sort) values
  ('raid_hunter', 'won', 1, 30, 1), ('raid_mvp', 'mvp', 1, 80, 2), ('raid_veteran', 'won', 10, 120, 3), ('raid_all', 'all', 6, 200, 4)
on conflict (k) do update set metric = excluded.metric, goal = excluded.goal, pts = excluded.pts, sort = excluded.sort;
insert into private.live_sets (k, sps, need, m0, m1, pts, sort, kind)
  select r.k, array['kue', 'ishidai', 'gt', 'tarpon', 'ishigakidai', 'hiramasa'], 1, null, null, r.pts, 30 + r.sort, 'raid' from private.raid_titles r
on conflict (k) do update set kind = 'raid', pts = excluded.pts, sort = excluded.sort;

-- the six monsters, in the order the raid brings them
create or replace function private.raid_monsters() returns text[] language sql immutable set search_path = '' as $$
  select array['kue', 'ishidai', 'gt', 'tarpon', 'ishigakidai', 'hiramasa']::text[];
$$;

-- one angler's numbers (raids with at least one strike that did damage)
create or replace function private.raid_stats(p_acct uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select h.raid, h.dmg, h.hits, h.crits, h.first_at, r.sp, r.spot, r.beaten_at, r.mvp, r.ends,
      (select count(*) from private.live_raid_hits z where z.raid = h.raid) as n,
      (select count(*) + 1 from private.live_raid_hits z where z.raid = h.raid and (z.dmg > h.dmg or (z.dmg = h.dmg and z.first_at < h.first_at))) as rk
    from private.live_raid_hits h join private.live_raids r on r.id = h.raid
    where h.acct = p_acct and h.dmg > 0)
  select jsonb_build_object(
    'joined', (select count(*) from mine),
    'won', (select count(*) from mine where beaten_at is not null),
    'mvp', (select count(*) from mine where mvp = p_acct),
    'dmg', (select coalesce(sum(dmg), 0) from mine),
    'hits', (select coalesce(sum(hits), 0) from mine),
    'crits', (select coalesce(sum(crits), 0) from mine),
    'best', (select jsonb_build_object('id', m.raid, 'sp', m.sp, 'd', m.dmg, 'rk', m.rk) from mine m order by m.dmg desc, m.raid desc limit 1),
    'dex', coalesce((select jsonb_object_agg(x.sp, x.c) from (select sp, count(*) c from mine where beaten_at is not null group by sp) x), '{}'::jsonb),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', y.raid, 'sp', y.sp, 'spot', y.spot, 'won', y.beaten_at is not null, 'mvp', y.mvp = p_acct,
        'd', y.dmg, 'rk', y.rk, 'n', y.n, 'at', (extract(epoch from coalesce(y.beaten_at, y.ends)) * 1000)::bigint,
        'pts', (select l.delta from public.zp_ledger l where l.acct = p_acct and l.reason = 'prize' and l.ref = 'raid:' || y.raid)) order by y.raid desc)
      from (select * from mine order by raid desc limit 12) y), '[]'::jsonb));
$$;

create or replace function private.raid_title_n(p_stats jsonb, p_metric text) returns int language sql immutable set search_path = '' as $$
  select case p_metric when 'won' then (p_stats ->> 'won')::int when 'mvp' then (p_stats ->> 'mvp')::int
    else (select count(*) from jsonb_object_keys(p_stats -> 'dex') k where k = any (private.raid_monsters()))::int end;
$$;

-- what the app shows: my numbers, the monster book, the raid titles (how far, whether taken) and the title I wear
create or replace function public.live_raid_record() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_st jsonb;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  v_st := private.raid_stats(v_acct);
  return v_st || jsonb_build_object('monsters', to_jsonb(private.raid_monsters()),
    'titles', coalesce((select jsonb_agg(jsonb_build_object('k', r.k, 'metric', r.metric, 'goal', r.goal, 'pts', r.pts,
        'n', least(private.raid_title_n(v_st, r.metric), r.goal),
        'got', exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'set:' || r.k)) order by r.sort)
      from private.raid_titles r), '[]'::jsonb),
    'title', (select t.k from private.live_title t where t.acct = v_acct));
end $$;

-- take a done raid title's points (once); the first title is worn at once. The ledger key is 'set:<k>' like a set,
-- so live_title_set (0026) lets it be worn without any change.
create or replace function public.live_raid_title_claim(p_k text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); r private.raid_titles%rowtype;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  select * into r from private.raid_titles x where x.k = p_k;
  if r.k is null then return jsonb_build_object('err', 'no_title'); end if;
  if private.raid_title_n(private.raid_stats(v_acct), r.metric) < r.goal then return jsonb_build_object('err', 'not_done'); end if;
  if not private.zp_add(v_acct, r.pts, 'prize', 'set:' || r.k, r.k) then return jsonb_build_object('err', 'already'); end if;
  insert into private.live_title (acct, k) values (v_acct, r.k) on conflict (acct) do nothing;
  return jsonb_build_object('ok', true, 'k', r.k, 'pts', r.pts, 'title', (select t.k from private.live_title t where t.acct = v_acct),
    'bal', coalesce((select w.bal from public.zp_wallets w where w.acct = v_acct), 0));
end $$;

-- 0026's set functions, the same but only for fish sets (a raid title is never a set to collect)
create or replace function public.live_sets() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_out jsonb := '[]'::jsonb; s record; v_have text[];
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  for s in select * from private.live_sets where kind = 'fish' order by sort, k loop
    v_have := private.live_set_have(v_acct, s.k);
    v_out := v_out || jsonb_build_object('k', s.k, 'sps', to_jsonb(s.sps), 'need', s.need, 'm0', s.m0, 'm1', s.m1, 'pts', s.pts,
      'have', to_jsonb(v_have), 'n', least(cardinality(v_have), s.need),
      'got', exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'set:' || s.k));
  end loop;
  return jsonb_build_object('sets', v_out, 'title', (select t.k from private.live_title t where t.acct = v_acct),
    'mo', extract(month from now() at time zone 'Asia/Seoul')::int);
end $$;

create or replace function public.live_set_claim(p_k text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); s private.live_sets%rowtype;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  select * into s from private.live_sets x where x.k = p_k and x.kind = 'fish';
  if s.k is null then return jsonb_build_object('err', 'no_set'); end if;
  if cardinality(private.live_set_have(v_acct, s.k)) < s.need then return jsonb_build_object('err', 'not_done'); end if;
  if not private.zp_add(v_acct, s.pts, 'prize', 'set:' || s.k, s.k) then return jsonb_build_object('err', 'already'); end if;
  insert into private.live_title (acct, k) values (v_acct, s.k) on conflict (acct) do nothing;
  return jsonb_build_object('ok', true, 'k', s.k, 'pts', s.pts, 'title', (select t.k from private.live_title t where t.acct = v_acct),
    'bal', coalesce((select w.bal from public.zp_wallets w where w.acct = v_acct), 0));
end $$;

revoke all on function private.raid_monsters(), private.raid_stats(uuid), private.raid_title_n(jsonb, text) from public, anon, authenticated;
revoke all on function public.live_raid_record(), public.live_raid_title_claim(text) from public, anon;
grant execute on function public.live_raid_record(), public.live_raid_title_claim(text) to authenticated;
