-- 0025 찌릿 라이브: the real weather on the live map nudges the bite a little.
-- The app reads the weather of the area (Open-Meteo, about 10 km rounded, straight from the browser) and says which
-- kind it is; the server turns the kind into a small factor on the wait for the bite. Only a known kind counts, and the
-- whole range is narrow (×0.88 … ×1.2), so a wrong kind can't buy much: the hourly cast limit, the day's points cap and
-- the server's own rolls stay as they were. Adds only (a new function; live_cast keeps its arguments and now calls it).

-- light rain and grey skies are good fishing; wind and storms make it slower
create or replace function private.live_wx_mult(p_wx text) returns numeric
language sql immutable set search_path = '' as $$
  select case p_wx when 'clear' then 1.0 when 'cloud' then 0.92 when 'rain' then 0.88 when 'fog' then 0.95
                   when 'snow' then 1.05 when 'wind' then 1.1 when 'storm' then 1.2 else 1.0 end::numeric
$$;

create or replace function public.live_cast_wx(p_cx int, p_cy int, p_water text, p_onsite boolean, p_anon boolean, p_wx text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); c private.live_cfg%rowtype; v_day date := (now() at time zone 'Asia/Seoul')::date;
  d private.live_days%rowtype; g record; v_school int; v_feed boolean; v_tide numeric; v_wait int; v_win int; v_tok uuid := gen_random_uuid();
  v_waitx numeric := 1; v_trophy numeric := 1; v_winx numeric := 0; v_on boolean := coalesce(p_onsite, false);
  v_wx text := case when p_wx in ('clear', 'cloud', 'rain', 'fog', 'snow', 'wind', 'storm') then p_wx else null end;
  v_wxm numeric := private.live_wx_mult(v_wx);
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
  select greatest(private.live_school(p_cx, p_cy), coalesce(max(private.live_school(p_cx + dx, p_cy + dy)) - 1, 0)) into v_school
  from generate_series(-1, 1) dx, generate_series(-1, 1) dy where dx <> 0 or dy <> 0;
  v_feed := private.live_feed(p_cx); v_tide := private.live_tide();
  v_wait := greatest(3500, ((6000 + random() * 14000) * v_waitx * (1 - 0.2 * v_school) * (case when v_feed then 0.8 else 1 end) * (1.12 - 0.24 * v_tide) * v_wxm)::int);
  v_win := (850 + v_winx * 1000)::int;
  insert into private.live_casts as k (acct, token, cx, cy, water, onsite, anon, cast_at, wait_ms, win_ms, school, feed, trophy, state, hook_at, tier, u, v, big, seed)
    values (v_acct, v_tok, p_cx, p_cy, p_water, v_on, coalesce(p_anon, false), clock_timestamp(), v_wait, v_win, v_school, v_feed, v_trophy, 'wait', null, null, null, null, null, null)
    on conflict (acct) do update set token = excluded.token, cx = excluded.cx, cy = excluded.cy, water = excluded.water, onsite = excluded.onsite, anon = excluded.anon,
      cast_at = excluded.cast_at, wait_ms = excluded.wait_ms, win_ms = excluded.win_ms, school = excluded.school, feed = excluded.feed, trophy = excluded.trophy,
      state = 'wait', hook_at = null, tier = null, u = null, v = null, big = null, seed = null;
  update private.live_days x set casts = x.casts + 1, remote = x.remote + (case when v_on then 0 else 1 end) where x.acct = v_acct and x.day = v_day;
  return jsonb_build_object('token', v_tok, 'wait', v_wait, 'win', v_win, 'school', v_school, 'feed', v_feed, 'tide', v_tide, 'wx', v_wx, 'wxm', v_wxm,
    'left', case when v_on then c.remote_per_day - d.remote else c.remote_per_day - d.remote - 1 end);
end $$;

-- the old call (apps that are not updated yet) is the same cast without weather
create or replace function public.live_cast(p_cx int, p_cy int, p_water text, p_onsite boolean, p_anon boolean default false) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select public.live_cast_wx(p_cx, p_cy, p_water, p_onsite, p_anon, null)
$$;

revoke all on function private.live_wx_mult(text) from public, anon, authenticated;
revoke all on function public.live_cast_wx(int, int, text, boolean, boolean, text) from public, anon;
grant execute on function public.live_cast_wx(int, int, text, boolean, boolean, text) to authenticated;
