// 0016 찌릿 포인트: the weekly 챔질 반응속도 board (runs started on the server, checked when they end), the prizes for the
// first three and everyone else who played, the 찌릿 루어 shop and the operator's tools — on a database with every migration.
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
await db.exec(`revoke all on public.zp_wallets, public.zp_ledger, public.zp_items, public.zp_owned, public.game_scores from anon, authenticated;
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
const state = uid => rpc(uid, `select public.zp_state() s`).then(r => r.s);
const begin = uid => rpc(uid, `select public.rx_begin() t`).then(r => r.t);
const submit = (uid, tok, times) => rpc(uid, `select public.rx_submit($1, $2) r`, [tok, times]).then(r => r.r);
// a run that started long enough ago (the test does not wait for a real game)
const aged = async (uid, sec = 40) => { const t = await begin(uid); await q(`update private.rx_runs set started_at = now() - make_interval(secs => $1) where token = $2`, [sec, t]); return t; };
const wk = (await q(`select private.zp_week() w`)).rows[0].w; const wkS = d => new Date(d).toISOString().slice(0, 10);

/* ---------- the week ---------- */
const week = async ts => wkS((await q(`select private.zp_week($1::timestamptz) w`, [ts])).rows[0].w);
check(await week('2026-11-08T14:59:59Z') === '2026-11-02', 'Sunday 23:59:59 in Korea is still the week of Monday 2 November');
check(await week('2026-11-08T15:00:00Z') === '2026-11-09', 'Monday 00:00 in Korea starts the next week');
check(await week('2026-11-01T15:30:00Z') === '2026-11-02', 'Monday 00:30 in Korea (Sunday in UTC) is already the new week');

/* ---------- the starting state ---------- */
let s = await state(A);
check(s.bal === 0 && s.earned === 0 && J(s.owned) === '[]', 'a new angler: no points, nothing owned');
check(J(s.items.map(i => [i.id, i.price])) === J([['spoon', 100], ['vib', 150], ['jig', 200], ['egi', 200], ['tai', 300], ['minnow', 500], ['gold', null]]), 'the shop lists the lures with their prices (the gold one not for sale): ' + J(s.items));
check(J(s.rx.top) === '[]' && s.rx.n === 0 && s.rx.me === null && J(s.rx.last) === '[]', 'empty boards');
check(/not_signed_in/.test(await fails(() => asRole('authenticated', '', () => q(`select public.zp_state()`)))), 'signed out: no state');
check((await fails(() => asRole('anon', '', () => q(`select public.zp_state()`)))) !== null, 'anon cannot call it');

/* ---------- 챔질 반응속도 runs ---------- */
check(/no_profile/.test(await fails(() => begin(D))), 'no profile, no run');
let r = await submit(A, '00000000-0000-0000-0000-000000000000', [250, 260, 270, 280, 290]);
check(r.err === 'bad_run', 'a run that was never started is refused');
let tok = await begin(A);
r = await submit(A, tok, [250, 260, 270, 280, 290]);
check(r.err === 'too_fast', 'a run that ends right after it started (faster than the game itself) is refused');
r = await submit(A, tok, [250, 260, 270, 280, 290]);
check(r.err === 'bad_run', 'a run is used up even when it was refused');
tok = await aged(A);
r = await submit(A, tok, [250, 260, 270, 280, 290]);
check(r.rec === true && r.avg === 270 && r.best === 250 && +r.r === 1 && +r.n === 1 && wkS(r.wk) === wkS(wk), 'a real run lands on this week\'s board: ' + J(r));
tok = await aged(A); r = await submit(A, tok, [300, 310, 320, 330, 340]);
check(r.rec === false && r.avg === 320 && +r.r === 1, 'a slower run does not replace the week\'s best');
tok = await aged(A); r = await submit(A, tok, [200, 210, 1500, 220, 230]);
check(r.rec === false && r.avg === 472, 'a missed tap counts as 1500 ms');
tok = await aged(A); r = await submit(A, tok, [220, 230, 240, 250, 260]);
check(r.rec === true && r.avg === 240, 'a faster run does');
for (const [times, why] of [[[90, 250, 250, 250, 250], 'a tap under 100 ms'], [[250, 250, 250, 250], 'four taps'], [[250, 250, 250, 250, 250, 250], 'six taps'], [[250, 250, 250, 250, 1600], 'over 1500 ms'], [null, 'nothing']]) {
  tok = await aged(A); r = await submit(A, tok, times);
  check(r.err === 'bad_run', why + ' is refused');
}
tok = await aged(A); r = await submit(A, tok, [100, 110, 120, 130, 140]);
check(r.err === 'too_fast', 'an average no person reaches (120 ms) is refused');
tok = await aged(A, 5); r = await submit(A, tok, [250, 260, 270, 280, 290]);
check(r.err === 'too_fast', 'a run shorter than the waits in it is refused');
tok = await begin(A); const tok2 = await begin(A);
await q(`update private.rx_runs set started_at = now() - interval '40 seconds' where acct = $1`, [A]);
check((await submit(A, tok, [250, 260, 270, 280, 290])).err === 'bad_run', 'starting a new run cancels the one before');
check((await submit(A, tok2, [250, 260, 270, 280, 290])).rec === false, 'the new one counts');
await q(`update private.rx_runs set started_at = now() - interval '20 minutes' where acct = $1`, [A]);
tok = (await q(`select token from private.rx_runs where acct = $1`, [A])).rows[0].token; await q(`update private.rx_runs set used = false where acct = $1`, [A]);
check((await submit(A, tok, [250, 260, 270, 280, 290])).err === 'bad_run', 'a run older than 15 minutes has expired');
// E is A's phone: its runs are A's
tok = await aged(E); r = await submit(E, tok, [230, 230, 230, 230, 230]);
check(r.rec === true && r.avg === 230 && +r.n === 1, 'a linked phone plays for the same account');
tok = await aged(B); await submit(B, tok, [280, 290, 300, 310, 320]);
tok = await aged(C); await submit(C, tok, [330, 340, 350, 360, 370]);
tok = await aged(F); await submit(F, tok, [1500, 1500, 1500, 1500, 1500]);
s = await state(B);
check(J(s.rx.top.map(x => [x.a, x.s])) === J([[A, 230], [B, 300], [C, 350], [F, 1500]]) && s.rx.n === 4, 'the board: fastest average first: ' + J(s.rx.top));
check(s.rx.me && s.rx.me.s === 300 && +s.rx.me.r === 2, 'my place on it');
check(s.rx.top[3].b === null, 'all five missed: no fastest tap');
// nobody writes the board, the runs or a wallet themselves
check((await fails(() => as(B, () => q(`insert into public.game_scores (game, wk, acct, score) values ('rx', $1, $2, 150)`, [wk, B])))) !== null, 'the board cannot be written directly');
check((await fails(() => as(B, () => q(`update public.game_scores set score = 150 where acct = $1`, [B])))) !== null || (await q(`select score from public.game_scores where acct = $1`, [B])).rows[0].score === 300, 'or changed');
check((await fails(() => as(B, () => q(`select * from private.rx_runs`)))) !== null, 'the runs are not readable');
check((await fails(() => as(B, () => q(`insert into public.zp_wallets (acct, bal) values ($1, 99999)`, [B])))) !== null, 'no wallet of my own making');
check((await fails(() => as(B, () => q(`insert into public.zp_ledger (acct, delta, reason, ref) values ($1, 9999, 'grant', 'x')`, [B])))) !== null, 'no book entries either');
check((await fails(() => as(B, () => q(`select private.zp_award('rx', $1)`, [wk])))) !== null, 'prizes are not handed out on request');
// a few dozen runs an hour are plenty
let slow = null; for (let i = 0; i < 70 && !slow; i++) slow = await fails(() => begin(C));
check(/slow_down/.test(slow || ''), 'too many runs in an hour: slow down');

/* ---------- prizes: a week that is over pays once, to the first three and everyone else who played ---------- */
const last = (await q(`select (private.zp_week() - 7) w`)).rows[0].w;
await q(`insert into public.game_scores (game, wk, acct, score, best, created_at) values ('rx', $1, $2, 260, 240, now() - interval '9 days'), ('rx', $1, $3, 250, 200, now() - interval '9 days'),
  ('rx', $1, $4, 250, 210, now() - interval '9 days'), ('rx', $1, $5, 400, 300, now() - interval '9 days'), ('rx', $1, $6, 199, 150, now() - interval '9 days')`, [last, A, B, C, F, ADM]);
await q(`update public.game_scores set void = true where acct = $1 and wk = $2`, [ADM, last]); // struck out by the operator
check((await q(`select private.zp_award('rx', $1) n`, [wk])).rows[0].n === 0, 'this week is not over: no prizes yet');
s = await state(C); // anyone opening the page settles the week that ended
const bal = async u => (await q(`select coalesce((select bal from public.zp_wallets where acct = $1), 0) b`, [u])).rows[0].b;
check(await bal(B) === 300 && await bal(C) === 200 && await bal(A) === 100 && await bal(F) === 20 && await bal(ADM) === 0, 'last week: 1st 300 (a tie on the average goes to the faster tap), 2nd 200, 3rd 100, 20 for playing, nothing for a struck-out run');
check(s.bal === 200 && s.earned === 200, 'my wallet in the state');
check(J(s.rx.last.map(x => [x.a, +x.r])) === J([[B, 1], [C, 2], [A, 3]]) && s.rx.lastn === 4, 'last week\'s podium: ' + J(s.rx.last));
const owns = async (u, it) => (await q(`select 1 from public.zp_owned where acct = $1 and item = $2`, [u, it])).rows.length === 1;
check(await owns(B, 'gold') && !(await owns(C, 'gold')), 'the winner gets the 황금 번개 lure');
await state(A); await state(B); await q(`select private.zp_award('rx', $1)`, [last]);
check(await bal(B) === 300 && await bal(A) === 100 && (await q(`select count(*)::int n from public.zp_ledger where reason in ('prize', 'join')`)).rows[0].n === 4, 'paid once, however often anyone looks');
s = await state(B);
check(s.led.length === 1 && s.led[0].d === 300 && s.led[0].r === 'prize' && s.led[0].n === '1' && s.led[0].ref === 'rx:' + wkS(last), 'my book shows the prize with its place and week: ' + J(s.led));
check((await as(B, () => q(`select * from public.zp_ledger`))).rows.every(x => x.acct === B), 'I read only my own book');
check((await as(B, () => q(`select * from public.zp_wallets`))).rows.every(x => x.acct === B), 'and only my own wallet');
check((await as(C, () => q(`select * from public.zp_owned where item = 'gold'`))).rows.some(x => x.acct === B), 'who owns which lure is visible to everyone');
check(!(await as(B, () => q(`select * from public.game_scores where acct = $1`, [ADM]))).rows.length, 'a struck-out run is not shown');
check((await as(ADM, () => q(`select * from public.game_scores where acct = $1`, [ADM]))).rows.length === 1, 'except to the operator');

/* ---------- the shop ---------- */
const buy = (u, it) => rpc(u, `select public.zp_buy($1) r`, [it]).then(r => r.r);
check(/not_enough/.test(await fails(() => buy(A, 'jig'))), 'not enough points (100 for a 200 lure)');
r = await buy(A, 'spoon');
check(r.bal === 0 && await owns(A, 'spoon') && await bal(A) === 0, 'buying: the price comes off, the lure is mine');
check(/owned/.test(await fails(() => buy(A, 'spoon'))), 'the same lure twice: no');
check(/no_item/.test(await fails(() => buy(B, 'gold'))) && /no_item/.test(await fails(() => buy(B, 'nope'))), 'the prize lure and unknown items are not for sale');
check(/no_profile/.test(await fails(() => buy(D, 'spoon'))), 'no profile, no shopping');
await q(`update public.zp_items set active = false where id = 'egi'`);
check(/no_item/.test(await fails(() => buy(B, 'egi'))), 'an item taken off the shelf');
await q(`update public.zp_items set active = true where id = 'egi'`);
check(/not_enough/.test(await fails(() => buy(E, 'egi'))), 'a linked phone shops with its account\'s wallet (empty now)');
s = await state(A);
check(s.owned.includes('spoon'), 'my lures in the state: ' + J(s.owned));
check(s.led[0].r === 'buy' && s.led[0].d === -100 && s.led[0].ref === 'spoon', 'the purchase is in my book');
check((await fails(() => as(A, () => q(`insert into public.zp_owned (acct, item) values ($1, 'minnow')`, [A])))) !== null, 'lures cannot be taken without buying');

/* ---------- the operator ---------- */
const grant = (u, to, d, note) => rpc(u, `select public.zp_grant($1, $2, $3) b`, [to, d, note || '']).then(r => r.b);
check(/not_admin/.test(await fails(() => grant(A, A, 500))), 'only the operator gives points');
check(await grant(ADM, A, 500, '이벤트 1등') === 500 && await bal(A) === 500, 'the operator gives 500 for an event');
check(await grant(ADM, E, 50) === 550, 'to a linked phone means to its account');
check(await grant(ADM, A, -9999) === 0 && await bal(A) === 0, 'taking points stops at zero');
check(/bad_amount/.test(await fails(() => grant(ADM, A, 0))) && /no_account/.test(await fails(() => grant(ADM, '12345678-1234-1234-1234-123456789012', 10))), 'zero, or nobody: refused');
s = await state(A);
check(s.led.some(x => x.r === 'grant' && x.d === 500 && x.n === '이벤트 1등'), 'the note shows in the book');
check(/not_admin/.test(await fails(() => rpc(B, `select public.zp_void('rx', $1, $2) v`, [wk, A])) || ''), 'only the operator strikes runs out');
check((await rpc(ADM, `select public.zp_void('rx', $1, $2) v`, [wk, E])).v === true, 'the operator strikes A\'s run out (named by the phone)');
s = await state(B);
check(J(s.rx.top.map(x => x.a)) === J([B, C, F]) && +s.rx.me.r === 1, 'struck out: off the board');
check((await rpc(ADM, `select public.zp_void('rx', $1, $2, false) v`, [wk, A])).v === true && (await state(B)).rx.top[0].a === A, 'and back on');

/* ---------- leaving takes everything with it ---------- */
await q(`delete from auth.users where id = $1`, [C]);
check(!(await q(`select 1 from public.zp_wallets where acct = $1 union all select 1 from public.game_scores where acct = $1 union all select 1 from public.zp_ledger where acct = $1`, [C])).rows.length, 'a removed account leaves no wallet, runs or book');

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
