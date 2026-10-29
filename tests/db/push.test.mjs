// 0010 phone notifications, on top of the live database (0001–0007b): subscriptions, the event checks, once-only
// sending with a per-sender cap, the VAPID key kept in Vault, and who may call what.
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
-- a small stand-in for Supabase Vault
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text, created_at timestamptz not null default now());
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description, created_at from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid
  language sql as $$ insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id $$;
revoke all on schema vault from public;
`);
const files = fs.readdirSync(M).sort().filter(f => (f < '0008' && !f.includes('_schedule')) || f.startsWith('0010'));
for (const f of files) { try { await db.exec(fs.readFileSync(M + f, 'utf8')); } catch (e) { console.log('FAILED', f, e.message); process.exit(1); } }
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant all on all tables in schema public to service_role; grant usage on schema private to service_role;`);
await db.exec(`revoke all on public.app_admins, public.ai_tickets, public.ai_usage from anon, authenticated;`);
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const ADM = '99999999-9999-9999-9999-999999999999', Z = '00000000-0000-0000-0000-000000000000';
await q(`insert into auth.users values ($1),($2),($3),($4)`, [A, B, C, ADM]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  ✗', m); } };
const asRole = async (role, uid, fn) => { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const as = (uid, fn) => asRole('authenticated', uid, fn);
const srv = fn => asRole('service_role', '', fn);
const fails = async fn => { try { await fn(); return null; } catch (e) { return e.message; } };
const J = JSON.stringify, now = Date.now();
const P256 = 'B' + 'A'.repeat(86), AUTH = 'Q'.repeat(22); // the right shape (65-byte key, 16-byte secret)
const ep = n => `https://fcm.googleapis.com/fcm/send/dev${n}`;

/* ---------- subscriptions ---------- */
check(/bad_endpoint/.test(await fails(() => as(A, () => q(`select public.push_subscribe($1, $2, $3, 'ko')`, ['https://evil.example/collect', P256, AUTH])))), 'only the browser makers\' push services are accepted');
check(/bad_endpoint/.test(await fails(() => as(A, () => q(`select public.push_subscribe($1, $2, $3, 'ko')`, ['https://fcm.googleapis.com.evil.example/x', P256, AUTH])))), 'look-alike hosts refused');
check(/bad_keys/.test(await fails(() => as(A, () => q(`select public.push_subscribe($1, $2, $3, 'ko')`, [ep(1), 'short', AUTH])))), 'malformed keys refused');
let r = await as(A, () => q(`select public.push_subscribe($1, $2, $3, 'ko') x`, [ep(1), P256, AUTH])); check(r.rows[0].x === true, 'a device switches notices on');
r = await as(A, () => q(`select public.push_subscribe($1, $2, $3, 'en') x`, [ep(1), P256, AUTH])); check(r.rows[0].x === true, 'switching on again just refreshes it');
r = await q(`select count(*)::int n, max(lang) l from private.push_subs`); check(r.rows[0].n === 1 && r.rows[0].l === 'en', 'one row per device, language updated');
r = await as(A, () => q(`select public.push_is_on($1) x`, [ep(1)])); check(r.rows[0].x === true, 'the device can see it is on');
r = await as(B, () => q(`select public.push_is_on($1) x`, [ep(1)])); check(r.rows[0].x === false, 'someone else\'s device is not "mine"');
check(!!(await fails(() => q(`set role anon; select public.push_subscribe('${ep(9)}', '${P256}', '${AUTH}', 'ko')`))), 'signed-out visitors cannot subscribe'); await db.exec('reset role;');
check(!!(await fails(() => as(A, () => q(`select * from private.push_subs`)))), 'nobody reads the subscription table directly');
// a linked device belongs to the account
await q(`insert into private.links (member, owner) values ($1, $2)`, [B, A]);
r = await as(B, () => q(`select public.push_subscribe($1, $2, $3, 'ko') x`, [ep(2), P256, AUTH]));
r = await srv(() => q(`select count(*)::int n from public.push_targets($1)`, [A])); check(r.rows[0].n === 2, 'notices for an account reach its linked devices too');
r = await srv(() => q(`select count(*)::int n from public.push_targets($1)`, [B])); check(r.rows[0].n === 2, 'a device id resolves to its account');
// switching off (and the 10-device cap) only marks rows
r = await as(A, () => q(`select public.push_unsubscribe($1) x`, [ep(2)])); check(r.rows[0].x === true, 'a device of the same account can be switched off');
r = await srv(() => q(`select count(*)::int n from public.push_targets($1)`, [A])); check(r.rows[0].n === 1, 'switched-off devices get nothing');
r = await as(C, () => q(`select public.push_unsubscribe($1) x`, [ep(1)])); check(r.rows[0].x === false, 'nobody can switch off someone else\'s device');
for (let i = 10; i < 22; i++) await as(A, () => q(`select public.push_subscribe($1, $2, $3, 'ko')`, [ep(i), P256, AUTH]));
r = await srv(() => q(`select count(*)::int n from public.push_targets($1)`, [A])); check(r.rows[0].n === 10, 'at most 10 devices per account get notices: ' + r.rows[0].n);
r = await srv(() => q(`select public.push_gone($1)`, [ep(21)]));
r = await srv(() => q(`select count(*)::int n from public.push_targets($1) where endpoint = $2`, [A, ep(21)])); check(r.rows[0].n === 0, 'an address the push service says is gone is dropped');

/* ---------- what counts as a real event ---------- */
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4), ($5, $6)`, [A, J({ nick: 'Ann', catches: [], fr: { [C]: ['r', now - 6e4] } }), C, J({ nick: 'Cy', catches: [], fr: { [A]: ['a', now] }, team: { id: A, ts: now } }), ADM, J({ nick: 'Op', catches: [] })]);
await q(`insert into public.board (id, data) values ($1, $2), ($3, $4)`, [A, J({ v: 1, posts: [{ id: 'p1', title: 'Big porgy today', body: 'x', ts: now - 6e5 }], cmts: [{ id: 'own', p: A + '|p1', body: 'mine', ts: now }], likes: [], reps: [] }), C, J({ v: 1, posts: [], cmts: [{ id: 'c1', p: A + '|p1', body: 'Nice!', ts: now }, { id: 'c0', p: A + '|p1', body: 'old', ts: now - 3600e3 }], likes: [], reps: [] })]);
const chk = (from, kind, ref) => srv(() => q(`select public.push_check($1, $2, $3) j`, [from, kind, ref])).then(x => x.rows[0].j);
let j = await chk(C, 'cmt', A + '|p1'); check(j && j.to === A && j.nick === 'Cy' && j.title === 'Big porgy today', 'a fresh reply notifies the post\'s author: ' + J(j));
check(await chk(A, 'cmt', A + '|p1') === null, 'replying to your own post notifies nobody');
check(await chk(C, 'cmt', A + '|nope') === null, 'a post that does not exist: nothing');
check(await chk(C, 'cmt', 'not a key') === null, 'a malformed reference: nothing');
await q(`update public.board set data = jsonb_set(data, '{cmts}', '[{"id":"c0","p":"${A}|p1","body":"old","ts":${now - 3600e3}}]') where id = $1`, [C]);
check(await chk(C, 'cmt', A + '|p1') === null, 'an old comment cannot be used to send a notice again later');
j = await chk(C, 'facc', A); check(j && j.to === A && j.url === '#friends', 'an accepted request notifies the one who asked');
check(await chk(C, 'freq', A) === null, 'an accept is not a new request');
await q(`update public.anglers set data = jsonb_set(data, '{fr}', $2) where id = $1`, [C, J({ [A]: ['r', now] })]);
j = await chk(C, 'freq', A); check(j && j.to === A, 'a fresh friend request notifies the other person');
await q(`update public.anglers set data = data || '{"frOff": true}' where id = $1`, [A]);
check(await chk(C, 'freq', A) === null, 'someone who switched off friend requests hears nothing');
await q(`update public.anglers set data = data - 'frOff' where id = $1`, [A]);
await q(`update public.anglers set data = jsonb_set(data, '{fr}', $2) where id = $1`, [C, J({ [A]: ['r', now - 3600e3] })]);
check(await chk(C, 'freq', A) === null, 'an old request: nothing');
await q(`insert into public.teams (id, data) values ($1, $2)`, [A, J({ v: 1, name: 'Ann team', open: false, members: {}, ban: {} })]);
j = await chk(C, 'tjoin', A); check(j && j.to === A && j.url === '#teams', 'asking to join a closed team notifies the leader');
await q(`update public.teams set data = data || '{"open": true}' where id = $1`, [A]);
check(await chk(C, 'tjoin', A) === null, 'open teams need no approval, so no notice');
await q(`insert into public.app_admins (uid) values ($1)`, [ADM]);
await q(`insert into public.admin_docs (id, data) values ('config', $1), ('grants', $2) on conflict (id) do update set data = excluded.data`, [J({ notice: { id: 'n1', t: '오늘 밤 점검해요', ts: now } }), J({ [C]: { o1: 'ok', o2: 'no' } })]);
j = await chk(ADM, 'notice', 'n1'); check(j && j.all === true && j.to === Z && /점검/.test(j.body), 'the operator\'s notice goes to everyone');
check(await chk(C, 'notice', 'n1') === null, 'only the operator can send a notice');
check(await chk(ADM, 'notice', 'old') === null, 'only the current notice');
j = await chk(ADM, 'paid', C + '|o1'); check(j && j.to === C, 'a confirmed payment notifies the buyer');
check(await chk(ADM, 'paid', C + '|o2') === null && await chk(C, 'paid', C + '|o1') === null, 'not for an unconfirmed order, and only from the operator');
await q(`update public.anglers set data = data || $2 where id = $1`, [C, J({ catches: [{ id: 'cc1', sp: 'kurodai', len: 41, ts: now - 864e5, st: 'review', tr: 50 }] })]);
await q(`insert into public.admin_docs (id, data) values ('verdicts', $1) on conflict (id) do update set data = excluded.data`, [J({ [C]: { cc1: 'ok', cc2: 'hold' } })]);
j = await chk(ADM, 'verdict', C + '|cc1'); check(j && j.to === C && j.v === 'ok' && j.ko === '감성돔' && j.en === 'Black porgy' && +j.len === 41, 'the operator\'s decision on a catch notifies its angler: ' + J(j));
check(await chk(ADM, 'verdict', C + '|cc2') === null && await chk(C, 'verdict', C + '|cc1') === null, 'not for "hold", and only from the operator');
check(await chk(C, 'whatever', A) === null, 'unknown kinds send nothing');

/* ---------- once per event, and a cap per sender ---------- */
r = await srv(() => q(`select public.push_once($1, 'cmt', $2, $3) x`, [A, A + '|p1:c1', C])); check(r.rows[0].x === true, 'the first notice for an event goes out');
r = await srv(() => q(`select public.push_once($1, 'cmt', $2, $3) x`, [A, A + '|p1:c1', C])); check(r.rows[0].x === false, 'the same event never twice');
for (let i = 0; i < 29; i++) await srv(() => q(`select public.push_once($1, 'cmt', $2, $3)`, [A, 'ref' + i, C]));
r = await srv(() => q(`select public.push_once($1, 'cmt', 'one-more', $2) x`, [A, C])); check(r.rows[0].x === false, 'a sender is capped at 30 notices in ten minutes');
r = await srv(() => q(`select public.push_once($1, 'review', 'srv-1', null) x`, [A])); check(r.rows[0].x === true, 'server notices (the reviewer) are not capped');

/* ---------- the VAPID key ---------- */
r = await srv(() => q(`select public.push_vapid() k`)); check(r.rows[0].k === null, 'no key until the push function makes one');
check(/bad_keys/.test(await fails(() => srv(() => q(`select public.push_vapid_init($1)`, [J({ pub: 'x' })])))), 'a malformed key is refused');
const K1 = { pub: 'B' + 'k'.repeat(86), jwk: { kty: 'EC', crv: 'P-256', d: 'd1', x: 'x1', y: 'y1' } };
r = await srv(() => q(`select public.push_vapid_init($1) k`, [J(K1)])); check(r.rows[0].k.pub === K1.pub, 'the key pair is stored');
r = await srv(() => q(`select public.push_vapid_init($1) k`, [J(Object.assign({}, K1, { pub: 'B' + 'z'.repeat(86) }))])); check(r.rows[0].k.pub === K1.pub, 'a second attempt gets the first key (subscriptions stay valid)');
r = await q(`select count(*)::int n from vault.secrets where name = 'zzirit_vapid'`); check(r.rows[0].n === 1, 'one key in Vault');

/* ---------- who may call what ---------- */
for (const call of [`public.push_check('${C}', 'cmt', 'x')`, `public.push_targets('${A}')`, `public.push_vapid()`, `public.push_once('${A}', 'k', 'r', null)`, `public.push_gone('x')`]) {
  check(/permission denied/.test(await fails(() => as(A, () => q(`select ${call}`)))), 'signed-in users cannot call ' + call.split('(')[0]);
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
