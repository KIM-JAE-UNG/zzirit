// The live database before 0008/0009 are run: only 0001–0007b. Login IDs, recovery codes, points and the review
// queue must already work on top of the old rules.
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
`);
for (const f of fs.readdirSync(M).sort().filter(f => f < '0008' && !f.includes('_schedule'))) await db.exec(fs.readFileSync(M + f, 'utf8'));
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant all on all tables in schema public to service_role; grant usage on schema private to service_role;
  revoke all on public.app_admins, public.ai_tickets, public.ai_usage from anon, authenticated; revoke insert, update, delete on public.spots, public.news from anon, authenticated;
  revoke all on public.reviews from anon, authenticated; grant select on public.reviews to authenticated; revoke all on public.points from anon;`);
const U = n => '0000000' + n + '-0000-0000-0000-00000000000' + n;
const [P1, P2, P3, ADM] = [U(1), U(2), U(3), U(9)];
await q(`insert into auth.users values ($1),($2),($3),($4)`, [P1, P2, P3, ADM]);
await q(`insert into public.app_admins (uid) values ($1)`, [ADM]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  ✗', m); } };
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const J = JSON.stringify, now = Date.now();
const one = async (uid, sql, p) => (await as(uid, () => q(sql, p))).rows[0];
// phone (P1) has a profile with catches; it creates an ID — nothing is lost
await as(P1, () => q(`insert into public.anglers (id, data) values ($1, $2)`, [P1, J({ nick: '차차', catches: [{ id: 'c1', sp: 'kurodai', len: 40, ts: now - 864e5, st: 'review', tr: 60 }] })]));
let r = await one(P1, `select public.id_register('chacha', 'secret12') r`); check(r.r.ok === true, 'sign up on the account in use');
check((await get(P1)).catches.length === 1, 'records kept after signing up');
// PC (P2) has its own profile; it logs in with the ID → one account
await as(P2, () => q(`insert into public.anglers (id, data) values ($1, $2)`, [P2, J({ nick: '차차 PC', catches: [{ id: 'c2', sp: 'madai', len: 45, ts: now - 3600e3, st: 'review', tr: 60 }] })]));
r = await one(P2, `select public.id_login('chacha', 'secret12') r`); check(r.r.ok === true && r.r.acct === P1, 'log in on the PC: ' + J(r.r));
const a1 = await get(P1); check(a1.nick === '차차' && a1.catches.map(c => c.id).sort().join() === 'c1,c2', 'PC records joined the account');
check(!(await get(P2)), 'the PC copy is gone (merged, not duplicated)');
r = await one(P2, `select public.my_acct() a, public.id_me() n`); check(r.a === P1 && r.n === 'chacha', 'the PC is now the same account');
// logging in again on the same device is fine
r = await one(P2, `select public.id_login('chacha', 'secret12') r`); check(r.r.ok === true, 'second login on a joined device is a no-op');
// operator: list IDs, reset a password, make a recovery code
r = await as(ADM, () => q(`select acct, name from public.admin_logins()`)); check(r.rows.length === 1 && r.rows[0].acct === P1, 'operator sees the ID');
r = await one(ADM, `select public.admin_id_reset('chacha', 'newpass9') r`); check(r.r.ok === true, 'operator resets the password');
r = await one(P3, `select public.id_login('chacha', 'secret12') r`); check(r.r.err === 'wrong', 'old password refused');
r = await one(ADM, `select public.admin_link_code($1) c`, [P2]); const code = r.c;
r = await one(P3, `select public.link_redeem($1) r`, [code]); check(r.r.ok === true && r.r.acct === P1, 'recovery code (made from a device id) brings P3 to the account');
// points written on the PC before it joined stay with the account
await as(P1, () => q(`insert into public.points (id, data) values ('pt00001', '{"name":"집 앞 방파제","pub":true}')`));
r = await as(P3, () => q(`select count(*)::int n from public.points`)); check(r.rows[0].n === 1, 'points visible on every device of the account');
// review queue still works on the old catch rules
await db.exec(`set role service_role;`);
r = await q(`select * from public.review_queue(10)`); check(r.rows.length === 2 && r.rows.every(x => x.uid === P1), 'review queue lists the merged catches');
r = await q(`select public.review_set($1, 'c1', 'no', 'no_photo|', 'rule') a`, [P1]); check(r.rows[0].a === true, 'reviewer records a decision');
await db.exec(`reset role;`);
r = await as(P2, () => q(`select data from public.reviews`)); check(r.rows.length === 1 && r.rows[0].data.c1.v === 'no', 'the note reaches the joined device');
// orders guard is active
await as(P1, () => q(`insert into public.orders (id, data) values ($1, $2)`, [P1, J({ items: [{ id: 'o1', kind: 'item', ref: 'th_aurora' }, { id: 'o2', kind: 'item', ref: 'pr_gold', code: 'ZZ-1' }] })]));
r = await q(`select data from public.orders where id = $1`, [P1]); check(r.rows[0].data.items.length === 1 && r.rows[0].data.items[0].ref === 'pr_gold', 'only premium items or tips can be ordered');
async function get(id) { const r = await q(`select data from public.anglers where id = $1`, [id]); return r.rows[0] && r.rows[0].data; }
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
