-- 0016: 찌릿 포인트 and the 찌릿 루어 shop. The points live only in the app: they are never bought with money, never paid
-- out and never traded. Every week (Monday 00:00 to Sunday 24:00, Korean time) the 챔질 반응속도 board pays 300 / 200 / 100
-- to the first three and 20 to everyone else who played; the first place also gets the 황금 번개 lure, which is not for
-- sale. The server keeps every number: a run has to be started here and take as long as a real game, prizes go out once
-- per week, and only the server changes a wallet. Only adds; nothing is removed.

/* ---------- 1. the week, the same Monday-based Korean week the weekly contest uses ---------- */
create or replace function private.zp_week(p_at timestamptz default now()) returns date
language sql stable set search_path = '' as $$ select date_trunc('week', p_at at time zone 'Asia/Seoul')::date $$;

/* ---------- 2. wallets, the book of every change, the shop's items, who owns what, the weekly boards ---------- */
create table if not exists public.zp_wallets (
  acct uuid primary key references auth.users(id) on delete cascade,
  bal int not null default 0 check (bal >= 0),
  earned int not null default 0 check (earned >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.zp_ledger (
  id bigint generated always as identity primary key,
  acct uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('prize', 'join', 'buy', 'grant')),
  ref text not null default '',
  note text not null default '' check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  unique (acct, reason, ref)
);
create index if not exists zp_ledger_acct on public.zp_ledger (acct, id desc);
create table if not exists public.zp_items (
  id text primary key check (id ~ '^[a-z0-9_]{2,24}$'),
  price int check (price is null or price >= 0), -- null: not for sale (a prize)
  sort int not null default 0,
  active boolean not null default true
);
insert into public.zp_items (id, price, sort) values
  ('spoon', 100, 1), ('vib', 150, 2), ('jig', 200, 3), ('egi', 200, 4), ('tai', 300, 5), ('minnow', 500, 6), ('gold', null, 9)
on conflict (id) do nothing;
create table if not exists public.zp_owned (
  acct uuid not null references auth.users(id) on delete cascade,
  item text not null references public.zp_items(id),
  how text not null default 'buy' check (how in ('buy', 'prize', 'grant')),
  created_at timestamptz not null default now(),
  primary key (acct, item)
);
create table if not exists public.game_scores (
  game text not null check (game in ('rx')),
  wk date not null,
  acct uuid not null references auth.users(id) on delete cascade,
  score int not null,   -- 챔질 반응속도: the average of five taps in ms (lower is better)
  best int,             -- the fastest tap of that run
  void boolean not null default false, -- the operator struck it out
  created_at timestamptz not null default now(),
  primary key (game, wk, acct)
);
create index if not exists game_scores_board on public.game_scores (game, wk, score);
-- one run at a time per account: started here, finished once
create table if not exists private.rx_runs (
  acct uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  started_at timestamptz not null default now(),
  used boolean not null default false
);
create table if not exists private.zp_settled (
  game text not null,
  wk date not null,
  n int not null default 0,
  at timestamptz not null default now(),
  primary key (game, wk)
);
revoke all on private.rx_runs, private.zp_settled from public, anon, authenticated;

/* ---------- 3. who reads what: my wallet and book; everyone signed in reads the boards and who owns which lure ---------- */
alter table public.zp_wallets enable row level security;
alter table public.zp_ledger enable row level security;
alter table public.zp_items enable row level security;
alter table public.zp_owned enable row level security;
alter table public.game_scores enable row level security;
revoke all on public.zp_wallets, public.zp_ledger, public.zp_items, public.zp_owned, public.game_scores from anon, authenticated;
grant select on public.zp_wallets, public.zp_ledger, public.zp_owned, public.game_scores to authenticated;
grant select on public.zp_items to anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zp_wallets' and policyname = 'zp wallet own') then
    create policy "zp wallet own" on public.zp_wallets for select to authenticated using (acct = (select public.acct()) or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zp_ledger' and policyname = 'zp ledger own') then
    create policy "zp ledger own" on public.zp_ledger for select to authenticated using (acct = (select public.acct()) or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zp_items' and policyname = 'zp items read') then
    create policy "zp items read" on public.zp_items for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zp_owned' and policyname = 'zp owned read') then
    create policy "zp owned read" on public.zp_owned for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game_scores' and policyname = 'scores read') then
    create policy "scores read" on public.game_scores for select to authenticated using (not void or (select public.is_admin()));
  end if;
end $$;

/* ---------- 4. helpers ---------- */
create or replace function private.zp_profile_ok(p_acct uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.anglers a where a.id = p_acct and coalesce(btrim(a.data ->> 'nick'), '') <> '');
$$;
-- one entry in the book, at most once per (account, reason, ref); the wallet follows. True when it happened now.
create or replace function private.zp_add(p_acct uuid, p_delta int, p_reason text, p_ref text, p_note text default '') returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.zp_ledger (acct, delta, reason, ref, note) values (p_acct, p_delta, p_reason, p_ref, left(coalesce(p_note, ''), 80))
    on conflict (acct, reason, ref) do nothing returning id into v_id;
  if v_id is null then return false; end if;
  if p_delta >= 0 then
    insert into public.zp_wallets as w (acct, bal, earned) values (p_acct, p_delta, p_delta)
      on conflict (acct) do update set bal = w.bal + p_delta, earned = w.earned + p_delta, updated_at = now();
  else -- spending: the wallet must be there and stay at zero or above (the check on bal refuses the rest)
    update public.zp_wallets w set bal = w.bal + p_delta, updated_at = now() where w.acct = p_acct;
    if not found then raise exception 'not_enough'; end if;
  end if;
  return true;
end $$;
-- a week's board: rank by the average, then the fastest tap, then who got there first
create or replace function private.zp_board(p_game text, p_wk date) returns table (acct uuid, score int, best int, rk bigint, n bigint)
language sql stable security definer set search_path = '' as $$
  select g.acct, g.score, g.best, row_number() over (order by g.score, g.best nulls last, g.created_at), count(*) over ()
  from public.game_scores g where g.game = p_game and g.wk = p_wk and not g.void;
$$;
-- the prizes for a week that is over (a minute after midnight, so a run ending at 23:59:59 still counts), once
create or replace function private.zp_award(p_game text, p_wk date) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; v_ref text := p_game || ':' || p_wk::text; v_prize int[] := array[300, 200, 100];
begin
  if p_wk is null or now() < ((p_wk + 7)::timestamp at time zone 'Asia/Seoul') + interval '1 minute' then return 0; end if;
  insert into private.zp_settled (game, wk) values (p_game, p_wk) on conflict do nothing;
  if not found then return 0; end if; -- already paid (or being paid right now)
  for r in select b.acct, b.rk from private.zp_board(p_game, p_wk) b order by b.rk loop
    if r.rk <= 3 then
      perform private.zp_add(r.acct, v_prize[r.rk::int], 'prize', v_ref, r.rk::text);
      if r.rk = 1 then insert into public.zp_owned (acct, item, how) values (r.acct, 'gold', 'prize') on conflict do nothing; end if;
    else
      perform private.zp_add(r.acct, 20, 'join', v_ref, '');
    end if;
    v_n := v_n + 1;
  end loop;
  update private.zp_settled s set n = v_n, at = now() where s.game = p_game and s.wk = p_wk;
  return v_n;
end $$;

/* ---------- 5. what the app asks ---------- */
-- everything the games page and the shop need in one go; weeks that ended and were not paid yet are paid first
create or replace function public.zp_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_wk date := private.zp_week(); w record;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  for w in select distinct g.wk from public.game_scores g
           where g.game = 'rx' and g.wk < v_wk and g.wk >= v_wk - 35
             and not exists (select 1 from private.zp_settled s where s.game = g.game and s.wk = g.wk)
  loop perform private.zp_award('rx', w.wk); end loop;
  return jsonb_build_object(
    'wk', v_wk,
    'bal', coalesce((select x.bal from public.zp_wallets x where x.acct = v_acct), 0),
    'earned', coalesce((select x.earned from public.zp_wallets x where x.acct = v_acct), 0),
    'owned', coalesce((select jsonb_agg(o.item order by o.created_at) from public.zp_owned o where o.acct = v_acct), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'price', i.price) order by i.sort) from public.zp_items i where i.active), '[]'::jsonb),
    'rx', jsonb_build_object(
      'top', coalesce((select jsonb_agg(jsonb_build_object('a', b.acct, 's', b.score, 'b', b.best) order by b.rk) from private.zp_board('rx', v_wk) b where b.rk <= 10), '[]'::jsonb),
      'n', coalesce((select max(b.n) from private.zp_board('rx', v_wk) b), 0),
      'me', (select jsonb_build_object('s', b.score, 'b', b.best, 'r', b.rk) from private.zp_board('rx', v_wk) b where b.acct = v_acct),
      'last', coalesce((select jsonb_agg(jsonb_build_object('a', b.acct, 's', b.score, 'b', b.best, 'r', b.rk) order by b.rk) from private.zp_board('rx', v_wk - 7) b where b.rk <= 3), '[]'::jsonb),
      'lastn', coalesce((select max(b.n) from private.zp_board('rx', v_wk - 7) b), 0)),
    'led', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'd', l.delta, 'r', l.reason, 'ref', l.ref, 'n', l.note, 'at', l.created_at) order by l.id desc)
                     from (select * from public.zp_ledger x where x.acct = v_acct order by x.id desc limit 30) l), '[]'::jsonb)
  );
end $$;

-- 챔질 반응속도: a run starts here (one at a time) ...
create or replace function public.rx_begin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_tok uuid := gen_random_uuid();
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then raise exception 'no_profile'; end if;
  if not private.try_ok('rxb:' || v_acct::text, 60, interval '1 hour') then raise exception 'slow_down'; end if;
  insert into private.rx_runs as r (acct, token, started_at, used) values (v_acct, v_tok, now(), false)
    on conflict (acct) do update set token = excluded.token, started_at = excluded.started_at, used = false;
  return v_tok;
end $$;
-- ... and ends with its five taps: each 100–1500 ms (1500 = missed), an average a person can reach, and no faster than
-- the game itself (five waits of at least 1.5 s, the taps, four 1 s pauses; 1.5 s allowed for the network). The week's
-- best run stays on the board. A run is used up even when it is refused (so the answer comes back instead of an error).
create or replace function public.rx_submit(p_token uuid, p_times int[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); r private.rx_runs%rowtype; v_wk date := private.zp_week(); x int; v_sum int := 0;
  v_best int; v_avg int; v_old int; v_rec boolean := false; v_rk bigint; v_n bigint;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select * into r from private.rx_runs q where q.acct = v_acct for update;
  if r.acct is null or r.token is distinct from p_token or r.used or r.started_at < now() - interval '15 minutes' then return jsonb_build_object('err', 'bad_run'); end if;
  update private.rx_runs q set used = true where q.acct = v_acct;
  if p_times is null or coalesce(array_length(p_times, 1), 0) <> 5 or array_ndims(p_times) <> 1 then return jsonb_build_object('err', 'bad_run'); end if;
  foreach x in array p_times loop
    if x is null or x < 100 or x > 1500 then return jsonb_build_object('err', 'bad_run'); end if;
    v_sum := v_sum + x;
    if x < 1500 and (v_best is null or x < v_best) then v_best := x; end if;
  end loop;
  v_avg := round(v_sum / 5.0);
  if v_avg < 140 then return jsonb_build_object('err', 'too_fast'); end if;
  if extract(epoch from (clock_timestamp() - r.started_at)) * 1000 < 5 * 1500 + 4 * 1000 + v_sum - 1500 then return jsonb_build_object('err', 'too_fast'); end if;
  select g.score into v_old from public.game_scores g where g.game = 'rx' and g.wk = v_wk and g.acct = v_acct for update;
  if v_old is null then
    insert into public.game_scores (game, wk, acct, score, best) values ('rx', v_wk, v_acct, v_avg, v_best); v_rec := true;
  elsif v_avg < v_old then
    update public.game_scores g set score = v_avg, best = v_best, created_at = now() where g.game = 'rx' and g.wk = v_wk and g.acct = v_acct; v_rec := true;
  end if;
  select b.rk, b.n into v_rk, v_n from private.zp_board('rx', v_wk) b where b.acct = v_acct;
  return jsonb_build_object('avg', v_avg, 'best', v_best, 'rec', v_rec, 'r', v_rk, 'n', v_n, 'wk', v_wk);
end $$;

-- the shop: an item for sale, not owned yet, enough points; the price comes from here, not from the app
create or replace function public.zp_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_price int; v_bal int;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then raise exception 'no_profile'; end if;
  select i.price into v_price from public.zp_items i where i.id = p_item and i.active;
  if v_price is null then raise exception 'no_item'; end if;
  insert into public.zp_wallets (acct) values (v_acct) on conflict do nothing;
  select w.bal into v_bal from public.zp_wallets w where w.acct = v_acct for update;
  if exists (select 1 from public.zp_owned o where o.acct = v_acct and o.item = p_item) then raise exception 'owned'; end if;
  if v_bal < v_price then raise exception 'not_enough'; end if;
  if v_price > 0 and not private.zp_add(v_acct, -v_price, 'buy', p_item, '') then raise exception 'owned'; end if;
  insert into public.zp_owned (acct, item, how) values (v_acct, p_item, 'buy');
  return jsonb_build_object('item', p_item, 'bal', v_bal - v_price);
end $$;

-- the operator: give or take points (never below zero), strike a run out of a board (or put it back)
create or replace function public.zp_grant(p_acct uuid, p_delta int, p_note text default '') returns int
language plpgsql security definer set search_path = '' as $$
declare v_to uuid; v_bal int; v_d int := p_delta;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  v_to := public.acct_of(p_acct);
  if v_to is null or not exists (select 1 from auth.users u where u.id = v_to) then raise exception 'no_account'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then raise exception 'bad_amount'; end if;
  insert into public.zp_wallets (acct) values (v_to) on conflict do nothing;
  select w.bal into v_bal from public.zp_wallets w where w.acct = v_to for update;
  if v_d < 0 then v_d := greatest(v_d, -v_bal); end if;
  if v_d <> 0 then perform private.zp_add(v_to, v_d, 'grant', gen_random_uuid()::text, coalesce(p_note, '')); end if;
  return v_bal + v_d;
end $$;
create or replace function public.zp_void(p_game text, p_wk date, p_acct uuid, p_void boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.game_scores g set void = coalesce(p_void, true) where g.game = p_game and g.wk = p_wk and g.acct = public.acct_of(p_acct);
  return found;
end $$;

revoke all on function private.zp_week(timestamptz), private.zp_profile_ok(uuid), private.zp_add(uuid, int, text, text, text),
  private.zp_board(text, date), private.zp_award(text, date) from public, anon, authenticated;
revoke all on function public.zp_state(), public.rx_begin(), public.rx_submit(uuid, int[]), public.zp_buy(text),
  public.zp_grant(uuid, int, text), public.zp_void(text, date, uuid, boolean) from public, anon;
grant execute on function public.zp_state(), public.rx_begin(), public.rx_submit(uuid, int[]), public.zp_buy(text),
  public.zp_grant(uuid, int, text), public.zp_void(text, date, uuid, boolean) to authenticated;
