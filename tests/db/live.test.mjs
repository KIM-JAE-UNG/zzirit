// 0019 찌릿 라이브 + 0021 the fish market: schools, casting (on the spot and from far away), striking, landing, the
// fish book, the keepnet and selling (the day's price, the day's limit), the weekly bag of five and its prizes — on a
// database with every migration.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
const M = new URL('../../supabase/migrations/', import.meta.url).pathname;
const db = await PGlite.create({ extensions: { pgcrypto } });
const q = async (sql, params) => { try { return await db.query(sql, params); } catch (e) { throw new Error(e.message + '\n  in: ' + sql.slice(0, 160)); } };
await db.exec(`
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key, is_anonymous boolean not null default true);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create publication supabase_realtime;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text, created_at timestamptz not null default now());
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description, created_at from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid
  language sql as $$ insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id $$;
`);
for (const f of fs.readdirSync(M).sort().filter(f => !f.includes('_schedule'))) {
  try { await db.exec(fs.readFileSync(M + f, 'utf8')); } catch (e) { console.log('FAILED', f, e.message); process.exit(1); }
}
// the table rights Supabase hands out by default (the migrations narrow them)
await db.exec(`grant all on all tables in schema public to anon, authenticated;`);
await db.exec(`revoke all on public.zp_wallets, public.zp_ledger, public.zp_items, public.zp_owned, public.game_scores, public.live_catches, public.live_dex, public.live_scores from anon, authenticated;
  grant select on public.zp_wallets, public.zp_ledger, public.zp_owned, public.game_scores to authenticated; grant select on public.zp_items to anon, authenticated;`);
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const D = '44444444-4444-4444-4444-444444444444', E = '55555555-5555-5555-5555-555555555555', F = '66666666-6666-6666-6666-666666666666';
const ADM = '99999999-9999-9999-9999-999999999999';
await q(`insert into auth.users values ($1),($2),($3),($4),($5),($6),($7)`, [A, B, C, D, E, F, ADM]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  ✗', m); } };
const asRole = async (role, uid, fn) => { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const as = (uid, fn) => asRole('authenticated', uid, fn);
const fails = async fn => { try { await fn(); return null; } catch (e) { return e.message.split('\n')[0]; } };
const J = JSON.stringify;
// A, B, C, F have profiles; D has none; E is A's phone (a linked device); ADM is the operator
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10)`, [
  A, J({ nick: 'Ann', catches: [] }), B, J({ nick: 'Bob', catches: [] }), C, J({ nick: 'Cy', catches: [] }), F, J({ nick: 'Fin', catches: [] }), ADM, J({ nick: '재웅', catches: [] })]);
await q(`insert into private.links (member, owner) values ($1, $2)`, [E, A]);
await q(`insert into public.app_admins (uid) values ($1)`, [ADM]);
const rpc = (uid, sql, params) => as(uid, async () => (await q(sql, params)).rows[0]);
const state = uid => rpc(uid, `select public.live_state() s`).then(r => r.s);
const cast = (uid, cx = 103295, cy = 35153, water = 'sea', onsite = true, anon = false) => rpc(uid, `select public.live_cast($1, $2, $3, $4, $5) r`, [cx, cy, water, onsite, anon]).then(r => r.r);
const strike = (uid, tok) => rpc(uid, `select public.live_strike($1) r`, [tok]).then(r => r.r);
const sell = (uid, ids = null, release = false) => rpc(uid, `select public.live_sell($1::bigint[], $2) r`, [ids, release]).then(r => r.r);
const land = (uid, tok, sp, okk = true) => rpc(uid, `select public.live_land($1, $2, $3) r`, [tok, sp, okk]).then(r => r.r);
// the test does not wait: move the cast (and the hook) back in time
const ageCast = (uid, ms) => q(`update private.live_casts set cast_at = clock_timestamp() - make_interval(secs => $2::numeric / 1000) where acct = $1`, [uid, ms]);
const ageHook = (uid, ms) => q(`update private.live_casts set hook_at = clock_timestamp() - make_interval(secs => $2::numeric / 1000) where acct = $1`, [uid, ms]);
const row = async uid => (await q(`select * from private.live_casts where acct = $1`, [uid])).rows[0];
// one whole fish: cast, wait, strike, fight, land. opts.tier/u/v/big fix the rolls.
const fish = async (uid, sp, o = {}) => {
  const c = await cast(uid, o.cx, o.cy, o.water || 'sea', o.onsite !== false, !!o.anon); if (c.err) return c;
  await ageCast(uid, c.wait + 300); const s = await strike(uid, c.token); if (s.err) return s;
  await q(`update private.live_casts set tier = coalesce($2, tier), u = coalesce($3, u), v = coalesce($4, v), big = coalesce($5, big) where acct = $1`, [uid, o.tier ?? null, o.u ?? null, o.v ?? null, o.big ?? null]);
  await ageHook(uid, o.fight || 6000); return land(uid, c.token, sp, o.ok !== false);
};

// ---------- the sea's clock ----------
{
  const r = (await q(`select private.live_tide() t, private.live_tide('2026-11-09 12:00+00') t2, private.live_feed(103295, '2026-11-10 21:30+00') f1, private.live_feed(103295, '2026-11-10 03:00+00') f2`)).rows[0];
  check(+r.t >= 0 && +r.t <= 1 && +r.t2 >= 0 && +r.t2 <= 1, 'the tide strength stays between 0 and 1');
  check(r.f1 === true && r.f2 === false, 'feeding time follows the sun at that longitude (06:30 in Busan feeds, noon does not) ' + J(r));
  const cm = (await q(`select private.live_cm(30, 60, 0, 0, false) a, private.live_cm(30, 60, 0.999, 0, false) b, private.live_cm(30, 60, 0, 0, true) c, private.live_cm(30, 60, 0, 0.9999, true) d`)).rows[0];
  check(+cm.a === 16.5 && +cm.b <= 31.5 && +cm.b > 31 && +cm.c === 31.5 && +cm.d > 59 && +cm.d <= 60, 'a usual fish is 55–105 % of the usual length, a big one runs toward the record ' + J(cm));
  const sch = (await q(`select count(*) filter (where s > 0)::int n, max(s) mx, count(*)::int tot from (select private.live_school(x, y) s from generate_series(103000, 103059) x, generate_series(35100, 35149) y) q`)).rows[0];
  check(sch.n > 60 && sch.n < 700 && sch.mx <= 3, 'schools sit in a small share of the cells (3–20 %): ' + J(sch));
  const same = (await q(`select private.live_school(103295, 35153, '2026-11-10 03:01+00') a, private.live_school(103295, 35153, '2026-11-10 03:08+00') b`)).rows[0];
  check(same.a === same.b, 'a school stays put for its ten minutes');
  const box = await rpc(A, `select public.live_schools(103280, 35140, 103310, 35170) r`).then(r => r.r);
  check(Array.isArray(box.cells) && box.until > Date.now() && box.until <= Date.now() + 600000 && box.cells.every(c => c.length === 3 && c[2] >= 1), 'live_schools lists the schools of a box and when they move');
  check(/bad_input/.test(await fails(() => rpc(A, `select public.live_schools(0, 0, 100, 100)`)) || ''), 'a box that is too large is refused');
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_schools(0, 0, 1, 1)`))) || ''), 'a visitor who is not signed in cannot ask');
}

// ---------- casting ----------
{
  check(/no_profile/.test(await fails(() => cast(D)) || ''), 'no profile, no cast');
  check(/bad_input/.test(await fails(() => cast(A, 1, 1, 'lava')) || ''), 'only sea or fresh water');
  const c = await cast(A);
  check(c.token && c.wait >= 3500 && c.wait <= 22500 && c.win === 850 && c.left === 5, 'a cast answers with the wait (3.5–22 s) and the strike window: ' + J({ wait: c.wait, win: c.win, left: c.left }));
  check((await strike(A, c.token)).err === 'early', 'striking before the bite scares the fish');
  check((await strike(A, c.token)).err === 'no_cast', 'and that cast is over');
  const c2 = await cast(A); await ageCast(A, c2.wait + c2.win + 4000);
  check((await strike(A, c2.token)).err === 'late', 'striking long after the bite is too late');
  const c3 = await cast(A); await ageCast(A, c3.wait + 200);
  check((await strike(A, '00000000-0000-0000-0000-000000000000')).err === 'no_cast', 'someone else\'s token does nothing');
  const s3 = await strike(A, c3.token);
  check(s3.tier >= 1 && s3.tier <= 5 && s3.u >= 0 && s3.u < 1 && typeof s3.big === 'boolean' && s3.seed > 0, 'a good strike hooks a fish: ' + J(s3));
  check((await land(A, c3.token, 'maaji')).err === 'too_fast', 'a fish cannot be landed in under 2.5 s');
  check((await land(A, c3.token, 'maaji')).err === 'no_cast', 'and the fish is gone');
  // E is A's phone: the same line
  const c4 = await cast(E); check((await row(A)).token === c4.token, 'a linked phone casts for the same account');
}

// ---------- landing: species, size, points, the fish book ----------
{
  await q(`delete from private.login_tries`);
  let r = await fish(B, 'kurodai', { tier: 4, u: 0.5, big: false });
  const cmWant = +(await q(`select private.live_cm(l_typ, l_max, 0.5, 0, false) c from public.live_species where id = 'kurodai'`)).rows[0].c;
  check(r.sp === 'kurodai' && +r.cm === cmWant && r.tier === 4 && r.val === 12 && r.pts === 10 && r.first === true && r.score > 0 && r.bal === 10 && r.kept === true && r.net === 1, 'a class-4 fish is worth 12 points and goes into the net; a new species pays 10 at once: ' + J(r));
  check([0.8, 0.9, 1, 1.1, 1.2, 1.4].includes(+r.rate) && r.price === Math.max(1, Math.round(12 * r.rate)), 'the answer says the day\'s price: ' + J({ rate: r.rate, price: r.price }));
  r = await fish(B, 'kurodai', { tier: 4, u: 0.9, big: false });
  check(r.val === 12 && r.pts === 0 && r.first === false && r.best === true && r.bal === 10 && r.net === 2, 'the second one pays nothing by itself and is a personal best: ' + J({ pts: r.pts, best: r.best, bal: r.bal }));
  r = await fish(B, 'kurodai', { tier: 2 });
  check(r.err === 'bad_species', 'a fish of a higher class than the roll is refused');
  r = await fish(B, 'maaji', { tier: 4, u: 0.5, big: true, v: 0.5 });
  check(r.tier === 1 && r.big === true && r.val === 2 && r.pts === 10, 'a lower class is fine and is worth what its own class is (a big one half as much again): ' + J({ tier: r.tier, val: r.val }));
  r = await fish(B, 'funa', { tier: 3 });
  check(r.err === 'bad_species', 'a freshwater fish does not come out of the sea');
  r = await fish(B, 'funa', { tier: 3, water: 'fresh', u: 0.2, big: false });
  check(r.sp === 'funa', 'and comes out of fresh water');
  r = await fish(B, 'kuromaguro', { tier: 5 });
  check(r.err === 'bad_species', 'a fish of the open ocean does not bite from the shore');
  r = await fish(B, 'nosuch', { tier: 5 });
  check(r.err === 'bad_species', 'an unknown fish is refused');
  r = await fish(B, 'maaji', { ok: false });
  check(r.lost === true, 'a lost fight ends the cast with nothing');
  const st = await state(B);
  check(st.dex.length === 3 && st.dex.find(x => x.sp === 'kurodai').n === 2 && st.day.fish === 4 && st.bal === 30 && st.day.pts === 0, 'the fish book counts each species: ' + J(st.dex) + ' ' + st.bal);
  check(st.net.length === 4 && st.netMax === 30 && st.net[0].sp === 'funa' && st.net.every(f => f.id && f.val >= 1 && f.p >= 1) && Object.keys(st.mkt).length > 100 && st.mktUntil > Date.now(), 'the state lists the keepnet (newest first) and the day\'s prices');
  const led = (await q(`select delta, reason, ref from public.zp_ledger where acct = $1`, [B])).rows;
  check(led.length === 1 && led[0].reason === 'join' && /^day:\d{4}-\d\d-\d\d$/.test(led[0].ref) && led[0].delta === st.bal, 'the day\'s points are one growing line in the book: ' + J(led));
}

// ---------- from far away: five casts a day, half the points, no legends ----------
{
  await q(`delete from private.login_tries`);
  let last;
  for (let i = 0; i < 5; i++) last = await cast(C, 103295, 35153, 'sea', false);
  check(last.token && last.left === 0, 'five casts a day from far away');
  const six = await cast(C, 103295, 35153, 'sea', false);
  check(six.err === 'remote_out', 'the sixth is refused');
  check((await cast(C, 103295, 35153, 'sea', true)).token, 'on the spot there is no such limit');
  await q(`update private.live_days set remote = 0 where acct = $1`, [C]);
  const r = await fish(C, 'kurodai', { tier: 4, u: 0.5, big: false, onsite: false });
  check(r.val === 6 && r.pts === 10 && r.onsite === false, 'a far-away catch is worth half: ' + J({ val: r.val }));
  // no class 5 from far away: many strikes, never a legend
  let top = 0;
  for (let i = 0; i < 60; i++) { await q(`delete from private.login_tries`); await q(`update private.live_days set remote = 0 where acct = $1`, [C]); const c = await cast(C, 103295, 35153, 'sea', false); await ageCast(C, c.wait + 100); const s = await strike(C, c.token); top = Math.max(top, s.tier); }
  check(top >= 1 && top <= 4, 'the legends only bite on the spot (highest class in 60 far-away strikes: ' + top + ')');
}

// ---------- the fish market: selling from the keepnet ----------
{
  await q(`delete from private.login_tries`);
  const day = (await q(`select (now() at time zone 'Asia/Seoul')::date::text d`)).rows[0].d;
  const rate = async sp => +(await q(`select private.live_rate($1, $2::date) r`, [sp, day])).rows[0].r;
  const price = (val, rt) => Math.max(1, Math.round(val * rt));
  let st = await state(B); const before = st.bal, net0 = st.net;
  check(net0.every(f => f.p === price(f.val, +st.mkt[f.sp])), 'each fish in the net shows its worth times the day\'s price');
  // one fish
  const one = net0.find(f => f.sp === 'kurodai');
  let r = await sell(B, [one.id]);
  check(r.n === 1 && r.sum === one.p && r.bal === before + one.p && r.day.pts === one.p && r.net.length === net0.length - 1 && !r.net.find(f => f.id === one.id), 'selling one fish pays its price and takes it out of the net: ' + J({ sum: r.sum, bal: r.bal }));
  r = await sell(B, [one.id]);
  check(r.n === 0 && r.sum === 0 && r.bal === before + one.p, 'a fish is sold once');
  // somebody else's fish
  const mine = (await state(C)).net[0];
  r = await sell(B, [mine.id]);
  check(r.n === 0 && (await state(C)).net.find(f => f.id === mine.id), 'nobody sells another angler\'s fish');
  // the price moves with the day and is the same for everyone
  const rs = (await q(`select private.live_rate('kurodai', d::date) r from generate_series('2026-01-01'::date, '2026-03-31'::date, '1 day') d`)).rows.map(x => +x.r);
  check(new Set(rs).size >= 4 && Math.min(...rs) === 0.8 && Math.max(...rs) === 1.4 && Math.abs(rs.reduce((a, b) => a + b, 0) / rs.length - 1.04) < 0.08, 'the price of a fish moves from day to day between ×0.8 and ×1.4: ' + J([...new Set(rs)].sort()));
  check(+(await state(C)).mkt.kurodai === await rate('kurodai'), 'and is the same for everyone that day');
  // everything, dearest first, up to the day's limit
  await q(`update private.live_days set pts = 80 - $2 where acct = $1`, [B, 13]);
  st = await state(B);
  const order = st.net.slice().sort((x, y) => y.p - x.p || x.id - y.id); let left = 13, want = 0, wantN = 0;
  for (const f of order) if (f.p <= left) { left -= f.p; want += f.p; wantN++; }
  r = await sell(B);
  check(r.sum === want && r.n === wantN && r.over === st.net.length - wantN && r.day.pts === 80 - 13 + want && r.net.length === st.net.length - wantN, 'the market buys no more than 80 points a day; what is over stays in the net: ' + J({ sum: r.sum, n: r.n, over: r.over }));
  check(r.over > 0 && (await sell(B)).sum <= left, 'the rest waits for tomorrow');
  // letting fish go
  const keep = (await state(B)).net;
  r = await sell(B, [keep[0].id], true);
  check(r.n === 1 && r.sum === 0 && r.released === true && r.net.length === keep.length - 1, 'a fish can be let go for nothing');
  // a full net: the fish counts for the book and the board and is let go
  await q(`update private.live_cfg set net_max = (select count(*) from public.live_catches where acct = $1 and val is not null and sold_at is null)`, [B]);
  const sc = (await state(B)).me.s;
  r = await fish(B, 'mebaru', { tier: 4, u: 0.9, big: false });
  check(r.kept === false && r.first === true && r.pts === 10 && (await state(B)).net.length === r.net && (await state(B)).me.s > sc, 'a full net lets the new fish go, but the book and the board still count it: ' + J({ kept: r.kept, net: r.net }));
  await q(`update private.live_cfg set net_max = 30`);
  // fish from before the market are nobody's to sell
  await q(`insert into public.live_catches (acct, sp, cm, tier, score, pts, onsite, gx, gy, wk) values ($1, 'maaji', 20, 1, 40, 1, true, 1, 1, private.zp_week())`, [F]);
  check((await state(F)).net.length === 0 && (await sell(F)).n === 0, 'fish landed before the market are not in the net');
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_sell(null, false)`))) || ''), 'a visitor who is not signed in cannot sell');
  const led = (await q(`select count(*)::int n, sum(delta)::int d from public.zp_ledger where acct = $1 and reason = 'join'`, [B])).rows[0];
  check(led.n === 1 && led.d === (await state(B)).bal, 'sales and first-catch points share the day\'s one line in the book: ' + J(led));
}

// ---------- gear: only what is owned counts ----------
{
  await q(`delete from private.login_tries`);
  await q(`update public.anglers set data = data || '{"float":"float_bolt","lure":"jig"}' where id = $1`, [F]);
  let c = await cast(F);
  check(c.win === 850, 'gear that is not owned does nothing');
  await q(`insert into public.zp_owned (acct, item, how) values ($1, 'float_bolt', 'grant'), ($1, 'jig', 'grant')`, [F]);
  c = await cast(F);
  check(c.win === 850 + 250, 'an owned float gives a longer moment to strike: ' + c.win);
  const k = await row(F);
  check(+k.trophy === 1.3, 'and an owned lure more big fish');
}

// ---------- the week: five best fish, prizes ----------
{
  await q(`delete from private.login_tries`);
  await db.exec(`delete from public.live_catches; delete from public.live_scores; delete from private.live_days;`);
  for (const u of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) await fish(A, 'kurodai', { tier: 4, u, big: false });
  const five = (await q(`select sum(score)::int s from (select score from public.live_catches where acct = $1 order by score desc limit 5) t`, [A])).rows[0].s;
  let st = await state(A);
  check(st.me.s === five && st.me.n === 7 && st.me.r === 1 && st.top[0].a === A && st.top[0].sp === 'kurodai', 'the week\'s score is the five best fish added up: ' + J(st.me));
  await fish(B, 'maaji', { tier: 1, u: 0.5, big: false }); await fish(C, 'mebaru', { tier: 2, u: 0.5, big: false }); await fish(F, 'maaji', { tier: 1, u: 0.1, big: false, anon: true });
  st = await state(C);
  check(st.n === 4 && st.top.map(x => x.a).join() === [A, C, B, F].join() && st.me.r === 2, 'the board ranks everyone: ' + J(st.top.map(x => x.s)));
  check(st.feed.length === 10 && st.feed[0].a === null && st.feed[1].a === C && st.feed[0].gx === Math.floor(103295 / 8), 'the feed shows the latest catches; an unnamed angler stays unnamed');
  // last week: move it all back seven days, then settle
  await db.exec(`update public.live_catches set wk = wk - 7; update public.live_scores set wk = wk - 7;`);
  const balA = (await state(A)).bal, sB = await state(B);
  check((await state(A)).last.length === 3, 'last week\'s first three are shown');
  const bal = async u => (await q(`select bal from public.zp_wallets where acct = $1`, [u])).rows[0].bal;
  const got = async u => (await q(`select coalesce(sum(delta), 0)::int d from public.zp_ledger where acct = $1 and reason = 'prize' and ref like 'live:%'`, [u])).rows[0].d;
  check(await got(A) === 300 && await got(C) === 200 && await got(B) === 100 && await got(F) === 0, 'the first three get 300, 200 and 100 points');
  check((await q(`select 1 from public.zp_owned where acct = $1 and item = 'gold'`, [A])).rows.length === 1, 'and the best bag wins the gold lure');
  await state(A); check(await got(A) === 300, 'the prizes are paid once');
  const wkNow = (await state(A)).wk;
  check(/not_allowed/.test(await fails(() => rpc(A, `select public.live_void($2::date, $1, true)`, [B, wkNow])) || ''), 'only the operator can strike a bag out');
  await fish(B, 'kurodai', { tier: 4, u: 0.5, big: false });
  check(await rpc(ADM, `select public.live_void($2::date, $1, true) r`, [B, wkNow]).then(r => r.r) === true && (await state(B)).me === null, 'the operator strikes a bag out and it leaves the board');
}

// ---------- nobody reads the tables directly ----------
{
  for (const tb of ['live_catches', 'live_dex', 'live_scores']) check(/permission denied/.test(await fails(() => as(A, () => q(`select * from public.${tb} limit 1`))) || ''), tb + ' is read only through the functions');
  check((await as(A, () => q(`select count(*)::int n from public.live_species`))).rows[0].n > 100, 'the species list is open to members');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.live_school(1, 1)`))) || ''), 'the school function itself is private');
}

console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
