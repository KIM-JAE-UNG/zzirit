-- 0021: the fish market. A landed fish no longer pays points by itself — it goes into the angler's keepnet, and the
-- angler sells it (one fish or the whole net) for points. Every fish has a worth fixed when it is landed (its class,
-- a big one ×1.5, a far-away catch ×0.5); the market pays that worth times the day's price for that kind of fish
-- (×0.8 … ×1.4, new every Korean day, the same for everyone). The market buys at most day_cap points a day from one
-- account, so the day's limit is what it was — but a fish over the limit is kept for tomorrow instead of being lost.
-- A new kind of fish still pays its 10 points at once. Fish landed before this migration were paid when landed and
-- are not in anyone's net.
-- Only adds: three columns, one setting, functions. Nothing is removed.

alter table private.live_cfg add column if not exists net_max int not null default 30 check (net_max >= 0);   -- fish a keepnet holds
alter table public.live_catches add column if not exists val int;                 -- worth before the day's price (null: paid when landed, before the market)
alter table public.live_catches add column if not exists sold_at timestamptz;     -- sold or let go
alter table public.live_catches add column if not exists sold_for int;            -- points paid (0: let go)
create index if not exists live_catches_net on public.live_catches (acct, id desc) where val is not null and sold_at is null;

-- the day's price for one kind of fish. Nobody can work tomorrow's out without the secret.
create or replace function private.live_rate(p_sp text, p_day date) returns numeric
language sql stable security definer set search_path = '' as $$
  select (array[0.8, 0.9, 0.9, 1, 1, 1, 1.1, 1.1, 1.2, 1.4])[1 + least(9, floor(q.h * 10)::int)]::numeric
  from (select (('x' || substr(md5(c.secret || ':mkt:' || p_sp || ':' || p_day::text), 1, 8))::bit(32)::bigint)::numeric / 4294967296 as h from private.live_cfg c) q;
$$;
create or replace function private.live_price(p_val int, p_rate numeric) returns int
language sql immutable set search_path = '' as $$
  select case when coalesce(p_val, 0) <= 0 then 0 else greatest(1, round(p_val * p_rate)::int) end;
$$;
-- what is in the net, newest first, with today's price
create or replace function private.live_net(p_acct uuid, p_day date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'sp', x.sp, 'cm', x.cm, 'tier', x.tier, 'big', x.big, 'on', x.onsite, 'val', x.val,
      'p', private.live_price(x.val, private.live_rate(x.sp, p_day)), 'at', (extract(epoch from x.created_at) * 1000)::bigint) order by x.id desc), '[]'::jsonb)
  from public.live_catches x where x.acct = p_acct and x.val is not null and x.sold_at is null;
$$;

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
    'net', private.live_net(v_acct, v_day), 'netMax', c.net_max,
    'mkt', coalesce((select jsonb_object_agg(s.id, private.live_rate(s.id, v_day)) from public.live_species s), '{}'::jsonb),
    'mktUntil', (extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Seoul')) * 1000)::bigint,
    'dex', coalesce((select jsonb_agg(jsonb_build_object('sp', x.sp, 'n', x.n, 'best', x.best) order by x.first_at) from public.live_dex x where x.acct = v_acct), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('a', b.acct, 's', b.score, 'n', b.n, 'sp', b.top, 'cm', b.top_cm) order by b.rk) from private.live_board(v_wk) b where b.rk <= 10), '[]'::jsonb),
    'n', coalesce((select max(b.total) from private.live_board(v_wk) b), 0),
    'me', (select jsonb_build_object('s', b.score, 'n', b.n, 'r', b.rk, 'sp', b.top, 'cm', b.top_cm) from private.live_board(v_wk) b where b.acct = v_acct),
    'last', coalesce((select jsonb_agg(jsonb_build_object('a', b.acct, 's', b.score, 'r', b.rk, 'sp', b.top, 'cm', b.top_cm) order by b.rk) from private.live_board(v_wk - 7) b where b.rk <= 3), '[]'::jsonb),
    'feed', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'a', case when f.anon then null else f.acct end, 'sp', f.sp, 'cm', f.cm, 'tier', f.tier, 'big', f.big, 'on', f.onsite, 'gx', f.gx, 'gy', f.gy, 'at', (extract(epoch from f.created_at) * 1000)::bigint) order by f.id desc)
                      from (select * from public.live_catches x where x.created_at > now() - interval '24 hours' order by x.id desc limit 20) f), '[]'::jsonb)
  );
end $$;

-- land: the fight is over. The app says which fish of that water it was (its class may not be higher than the roll);
-- the server measures it, scores it, writes the fish book and the weekly board, and puts the fish in the keepnet.
-- A full net cannot take it: the fish still counts for the book and the board, and is let go.
create or replace function public.live_land(p_token uuid, p_sp text, p_ok boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); r private.live_casts%rowtype; s public.live_species%rowtype; c private.live_cfg%rowtype;
  v_day date := (now() at time zone 'Asia/Seoul')::date; v_wk date := private.zp_week(); d private.live_days%rowtype;
  v_ms numeric; v_cm numeric; v_score int; v_val int; v_first boolean; v_best boolean := false; v_old numeric; v_sum int; v_id bigint; v_bonus int := 0;
  v_net int; v_keep boolean; v_rate numeric;
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
  v_val := v_p[s.tier]; if r.big then v_val := ceil(v_val * 1.5)::int; end if;
  if not r.onsite then v_val := greatest(1, ceil(v_val * 0.5)::int); end if;
  insert into private.live_days (acct, day) values (v_acct, v_day) on conflict do nothing;
  select * into d from private.live_days x where x.acct = v_acct and x.day = v_day for update;
  select count(*) into v_net from public.live_catches x where x.acct = v_acct and x.val is not null and x.sold_at is null;
  v_keep := v_net < c.net_max;
  select x.best into v_old from public.live_dex x where x.acct = v_acct and x.sp = s.id;
  v_first := not found;
  if v_first then v_bonus := 10; else v_best := v_cm > v_old; end if;
  insert into public.live_dex as x (acct, sp, n, best) values (v_acct, s.id, 1, v_cm)
    on conflict (acct, sp) do update set n = x.n + 1, best = greatest(x.best, excluded.best), best_at = case when excluded.best > x.best then now() else x.best_at end;
  insert into public.live_catches (acct, sp, cm, tier, big, score, pts, onsite, anon, gx, gy, wk, val, sold_at, sold_for)
    values (v_acct, s.id, v_cm, s.tier, r.big, v_score, v_bonus, r.onsite, r.anon, floor(r.cx / 8.0)::int, floor(r.cy / 10.0)::int, v_wk,
            v_val, case when v_keep then null else now() end, case when v_keep then null else 0 end)
    returning id into v_id;
  update private.live_days x set fish = x.fish + 1 where x.acct = v_acct and x.day = v_day;
  perform private.zp_earn(v_acct, v_bonus, 'day:' || v_day::text);
  v_sum := private.live_week_sum(v_acct, v_wk);
  insert into public.live_scores as x (wk, acct, score, n, top, top_cm) values (v_wk, v_acct, v_sum, 1, s.id, v_cm)
    on conflict (wk, acct) do update set n = x.n + 1,
      updated_at = case when excluded.score > x.score then now() else x.updated_at end,
      top = case when v_score >= coalesce((select max(q.score) from public.live_catches q where q.acct = v_acct and q.wk = v_wk and q.id <> v_id), 0) then excluded.top else x.top end,
      top_cm = case when v_score >= coalesce((select max(q.score) from public.live_catches q where q.acct = v_acct and q.wk = v_wk and q.id <> v_id), 0) then excluded.top_cm else x.top_cm end,
      score = excluded.score;
  v_rate := private.live_rate(s.id, v_day);
  return jsonb_build_object('id', v_id, 'sp', s.id, 'cm', v_cm, 'tier', s.tier, 'big', r.big, 'score', v_score, 'pts', v_bonus, 'first', v_first, 'best', v_best,
    'capped', false, 'onsite', r.onsite,
    'val', v_val, 'rate', v_rate, 'price', private.live_price(v_val, v_rate), 'kept', v_keep, 'net', v_net + (case when v_keep then 1 else 0 end), 'netMax', c.net_max,
    'day', jsonb_build_object('pts', d.pts, 'cap', c.day_cap, 'fish', d.fish + 1),
    'wk', jsonb_build_object('s', v_sum, 'r', (select b.rk from private.live_board(v_wk) b where b.acct = v_acct)),
    'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0));
end $$;

-- sell fish from the net (p_ids null: all of it), dearest first, for as long as the day's limit lasts — or let them go.
create or replace function public.live_sell(p_ids bigint[] default null, p_release boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); c private.live_cfg%rowtype; v_day date := (now() at time zone 'Asia/Seoul')::date; d private.live_days%rowtype;
  f record; v_left int; v_sum int := 0; v_n int := 0; v_skip int := 0; v_out jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if p_ids is not null and cardinality(p_ids) > 200 then raise exception 'bad_input'; end if;
  if not private.try_ok('lvs:' || v_acct::text, 240, interval '1 hour') then raise exception 'slow_down'; end if;
  select * into c from private.live_cfg;
  insert into private.live_days (acct, day) values (v_acct, v_day) on conflict do nothing;
  select * into d from private.live_days x where x.acct = v_acct and x.day = v_day for update;
  v_left := greatest(0, c.day_cap - d.pts);
  for f in select x.id, x.sp, x.cm, private.live_price(x.val, private.live_rate(x.sp, v_day)) as p
           from public.live_catches x
           where x.acct = v_acct and x.val is not null and x.sold_at is null and (p_ids is null or x.id = any(p_ids))
           order by 4 desc, x.id
  loop
    if coalesce(p_release, false) then
      update public.live_catches x set sold_at = now(), sold_for = 0 where x.id = f.id and x.sold_at is null;
      if found then v_n := v_n + 1; end if;
    elsif f.p <= v_left then
      update public.live_catches x set sold_at = now(), sold_for = f.p where x.id = f.id and x.sold_at is null;
      if found then
        v_n := v_n + 1; v_sum := v_sum + f.p; v_left := v_left - f.p;
        v_out := v_out || jsonb_build_object('id', f.id, 'sp', f.sp, 'cm', f.cm, 'p', f.p);
      end if;
    else v_skip := v_skip + 1;
    end if;
  end loop;
  if v_sum > 0 then
    update private.live_days x set pts = x.pts + v_sum where x.acct = v_acct and x.day = v_day;
    perform private.zp_earn(v_acct, v_sum, 'day:' || v_day::text);
  end if;
  return jsonb_build_object('n', v_n, 'sum', v_sum, 'over', v_skip, 'sold', v_out, 'released', coalesce(p_release, false),
    'day', jsonb_build_object('pts', d.pts + v_sum, 'cap', c.day_cap),
    'net', private.live_net(v_acct, v_day), 'netMax', c.net_max,
    'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0));
end $$;

revoke all on function private.live_rate(text, date), private.live_price(int, numeric), private.live_net(uuid, date) from public, anon, authenticated;
revoke all on function public.live_sell(bigint[], boolean) from public, anon;
grant execute on function public.live_sell(bigint[], boolean) to authenticated;
