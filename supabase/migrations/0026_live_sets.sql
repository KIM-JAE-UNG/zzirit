-- 0026: 도감 세트 (fish-book sets) and 칭호 (titles) for 찌릿 라이브.
-- A set is a short list of fish that belong together: a kind of water, a part of the world, or a season. Catch enough
-- different fish of the list (a season set: caught in those months, Korean dates) and the set is done: the server pays
-- its points once and the angler may wear its title. The server counts from its own tables (live_dex, live_catches),
-- so the phone can't say a set is done. A worn title shows on the weekly board and on the brag card.
-- Only adds: two tables and functions. Nothing is removed.

create table if not exists private.live_sets (
  k text primary key check (k ~ '^[a-z0-9_]{2,24}$'),
  sps text[] not null,
  need int not null check (need >= 1),
  m0 int check (m0 between 1 and 12),          -- season: first month (null: any time)
  m1 int check (m1 between 1 and 12),          -- season: last month (may wrap past December)
  pts int not null check (pts >= 0),
  sort int not null default 0,
  check (need <= cardinality(sps)),
  check ((m0 is null) = (m1 is null))
);
revoke all on private.live_sets from public, anon, authenticated;

insert into private.live_sets (k, sps, need, m0, m1, pts, sort) values
  ('rock',   array['kurodai', 'mejina', 'ishidai'], 3, null, null, 80, 1),
  ('west',   array['kurosoi', 'hirame', 'suzuki', 'iidako', 'kouika', 'mahaze'], 5, null, null, 60, 2),
  ('ink',    array['iidako', 'madako', 'mizudako', 'aoriika', 'kensakiika', 'kouika'], 4, null, null, 60, 3),
  ('spiky',  array['kasago', 'onioko', 'minokasago', 'haokoze', 'akaei', 'gonzui', 'aigo', 'kusafugu', 'torafugu'], 4, null, null, 50, 4),
  ('fresh',  array['funa', 'koi', 'bass', 'kerguigyo', 'namazu', 'gigi', 'raigyo'], 5, null, null, 60, 5),
  ('tropic', array['gt', 'bonefish', 'barracuda', 'lionfish', 'barramundi', 'snook', 'tarpon'], 3, null, null, 100, 6),
  ('rivers', array['pike', 'walleye', 'muskie', 'wels', 'peacockbass', 'arapaima', 'taimen', 'murraycod'], 3, null, null, 100, 7),
  ('legend', array['ishidai', 'ishigakidai', 'kue', 'gt', 'tarpon', 'taimen', 'muskie', 'arapaima'], 3, null, null, 200, 8),
  ('spring', array['makogarei', 'mebaru', 'iidako', 'kouika', 'madai', 'sayori', 'kurodai', 'funa'], 4, 3, 5, 50, 11),
  ('summer', array['ishidai', 'kensakiika', 'isaki', 'shirogisu', 'minokasago', 'ayu', 'miuy', 'namazu'], 4, 6, 8, 50, 12),
  ('autumn', array['kurodai', 'tachiuo', 'saba', 'maaji', 'konoshiro', 'mahaze', 'aoriika', 'sawara'], 4, 9, 11, 50, 13),
  ('winter', array['mebaru', 'usumebaru', 'hokke', 'magarei', 'nishin', 'wakasagi', 'mizudako', 'kurosoi'], 4, 12, 2, 50, 14)
on conflict (k) do update set sps = excluded.sps, need = excluded.need, m0 = excluded.m0, m1 = excluded.m1, pts = excluded.pts, sort = excluded.sort;

create table if not exists private.live_title (
  acct uuid primary key references auth.users(id) on delete cascade,
  k text not null references private.live_sets(k),
  updated_at timestamptz not null default now()
);
revoke all on private.live_title from public, anon, authenticated;

create index if not exists live_catches_acct_sp on public.live_catches (acct, sp);

-- which fish of a set one angler has (a season set: only fish caught in those months, Korean dates)
create or replace function private.live_set_have(p_acct uuid, p_k text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.sp order by x.sp), '{}'::text[]) from (
    select d.sp from private.live_sets s join public.live_dex d on d.acct = p_acct and d.sp = any (s.sps)
      where s.k = p_k and s.m0 is null
    union all
    select c.sp from private.live_sets s join public.live_catches c on c.acct = p_acct and c.sp = any (s.sps)
      where s.k = p_k and s.m0 is not null
        and (case when s.m0 <= s.m1
                  then extract(month from c.created_at at time zone 'Asia/Seoul') between s.m0 and s.m1
                  else extract(month from c.created_at at time zone 'Asia/Seoul') >= s.m0 or extract(month from c.created_at at time zone 'Asia/Seoul') <= s.m1 end)
  ) x;
$$;

-- what the app shows: every set, what I have of it, whether its points are taken, and the title I wear
create or replace function public.live_sets() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_out jsonb := '[]'::jsonb; s record; v_have text[];
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  for s in select * from private.live_sets order by sort, k loop
    v_have := private.live_set_have(v_acct, s.k);
    v_out := v_out || jsonb_build_object('k', s.k, 'sps', to_jsonb(s.sps), 'need', s.need, 'm0', s.m0, 'm1', s.m1, 'pts', s.pts,
      'have', to_jsonb(v_have), 'n', least(cardinality(v_have), s.need),
      'got', exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'set:' || s.k));
  end loop;
  return jsonb_build_object('sets', v_out, 'title', (select t.k from private.live_title t where t.acct = v_acct),
    'mo', extract(month from now() at time zone 'Asia/Seoul')::int);
end $$;

-- take a done set's points (once) — after that its title can be worn
create or replace function public.live_set_claim(p_k text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); s private.live_sets%rowtype;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  select * into s from private.live_sets x where x.k = p_k;
  if s.k is null then return jsonb_build_object('err', 'no_set'); end if;
  if cardinality(private.live_set_have(v_acct, s.k)) < s.need then return jsonb_build_object('err', 'not_done'); end if;
  if not private.zp_add(v_acct, s.pts, 'prize', 'set:' || s.k, s.k) then return jsonb_build_object('err', 'already'); end if;
  -- the first title is worn at once
  insert into private.live_title (acct, k) values (v_acct, s.k) on conflict (acct) do nothing;
  return jsonb_build_object('ok', true, 'k', s.k, 'pts', s.pts, 'title', (select t.k from private.live_title t where t.acct = v_acct),
    'bal', coalesce((select w.bal from public.zp_wallets w where w.acct = v_acct), 0));
end $$;

-- wear one of my titles (null or '': none)
create or replace function public.live_title_set(p_k text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct();
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if coalesce(p_k, '') = '' then delete from private.live_title t where t.acct = v_acct; return jsonb_build_object('ok', true, 'title', null); end if;
  if not exists (select 1 from public.zp_ledger l where l.acct = v_acct and l.reason = 'prize' and l.ref = 'set:' || p_k) then
    return jsonb_build_object('err', 'not_yours');
  end if;
  insert into private.live_title as t (acct, k) values (v_acct, p_k) on conflict (acct) do update set k = excluded.k, updated_at = now();
  return jsonb_build_object('ok', true, 'title', p_k);
end $$;

-- the titles some anglers wear (for the weekly board): {acct: k}. Only what they chose to wear, nothing else.
create or replace function public.live_titles(p_accts uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(t.acct, t.k), '{}'::jsonb) from private.live_title t
  where t.acct = any (p_accts[1:50]);
$$;

revoke all on function private.live_set_have(uuid, text) from public, anon, authenticated;
revoke all on function public.live_sets(), public.live_set_claim(text), public.live_title_set(text), public.live_titles(uuid[]) from public, anon;
grant execute on function public.live_sets(), public.live_set_claim(text), public.live_title_set(text), public.live_titles(uuid[]) to authenticated;
