// 0022 the morning notice: who gets one (a phone that said yes, something true to say), what it says (a dear fish in
// the keepnet, the first strong-tide day, last week's prize), once a morning and once per prize, only between 07:30
// and 09:00 Korean time, the three switches, and who may call what — on a database with every migration.
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
const srv = async (sql, params) => { await db.exec(`set role service_role;`); try { return (await q(sql, params)).rows; } finally { await db.exec(`reset role;`); } };
// one morning round at a Korean clock time ('2026-11-20 07:40')
const round = (kst, limit = 300) => srv(`select acct, items from public.push_morning($1, ($2::timestamp at time zone 'Asia/Seoul'))`, [limit, kst]);
const P256 = 'B' + 'A'.repeat(86), AUTH = 'Q'.repeat(22);
let nEp = 0; const sub = (acct, lang = 'ko') => q(`insert into private.push_subs (endpoint, acct, p256dh, auth, lang) values ($1, $2, $3, $4, $5)`, [`https://fcm.googleapis.com/fcm/send/m${++nEp}`, acct, P256, AUTH, lang]);
const net = (acct, sp, val, tier = 3) => q(`insert into public.live_catches (acct, sp, cm, tier, score, pts, onsite, gx, gy, wk, val) values ($1, $2, 40, $4, 80, 0, true, 1, 1, private.zp_week(), $3)`, [acct, sp, val, tier]);
const rate = async (sp, day) => +(await q(`select private.live_rate($1, $2::date) r`, [sp, day])).rows[0].r;

// the days to test: a plain day, and the first day of strong tides (both in the coming weeks)
const days = (await q(`select d::date::text d, private.live_tide((d::date + time '12:00') at time zone 'Asia/Seoul') t,
  private.live_tide((d::date + time '12:00') at time zone 'Asia/Seoul' - interval '1 day') y from generate_series('2026-11-18'::date, '2027-01-31'::date, '1 day') d`)).rows;
const spring = days.find(x => +x.t >= 0.85 && +x.y < 0.85).d, plain = days.find(x => +x.t < 0.85).d;
const sps = (await q(`select id from public.live_species order by id`)).rows.map(x => x.id);
const pick = async (day, dear) => { for (const sp of sps) if ((await rate(sp, day) >= 1.2) === dear) return sp; };
const dearP = await pick(plain, true), cheapP = await pick(plain, false), dearS = await pick(spring, true);
check(spring && plain && dearP && cheapP && dearS, 'test days and fish found: ' + J({ spring, plain, dearP, cheapP, dearS }));
const nextDay = d => new Date(Date.parse(d + 'T00:00:00Z') + 86400e3).toISOString().slice(0, 10);

// the names the server writes with
const nm = (await q(`select n from public.live_species where id = 'kurodai'`)).rows[0].n;
check(Array.isArray(nm) && nm[0] === '감성돔' && nm.length === 4 && (await q(`select count(*)::int n from public.live_species where n is null`)).rows[0].n === 0, 'every fish has its name in four languages');

// A plays and has phones (one on a linked device E); B plays, has a phone; C has a phone but never played; D plays, no phone
await sub(E, 'ko'); await sub(A, 'en'); await sub(B); await sub(C);
for (const x of [A, B, D]) await q(`insert into private.live_days (acct, day) values ($1, '2026-11-10')`, [x]);
await net(A, cheapP, 6); await net(A, dearP, 12, 4); await net(B, cheapP, 30, 5); await net(D, dearP, 12, 4);

// ---------- only in the morning ----------
check((await round(plain + ' 06:50')).length === 0 && (await round(plain + ' 09:00')).length === 0 && (await round(plain + ' 21:00')).length === 0, 'nothing before 07:30 or from 09:00');

// ---------- a dear fish in the keepnet ----------
{
  const rows = await round(plain + ' 07:40');
  const a = rows.find(r => r.acct === A);
  const rt = await rate(dearP, plain);
  check(rows.length === 1 && a && a.items.length === 1 && a.items[0].k === 'mkt' && a.items[0].sp === dearP && +a.items[0].x === rt && a.items[0].p === Math.max(1, Math.round(12 * rt)) && Array.isArray(a.items[0].n),
    'A (two phones, one on a linked device) gets one notice: the dear fish, its price today: ' + J(rows));
  check(!rows.find(r => r.acct === B), 'B\'s fish is not dear today: no notice');
  check(!rows.find(r => r.acct === C) && !rows.find(r => r.acct === D) && !rows.find(r => r.acct === E), 'C has nothing to hear, D has no phone, E is A\'s device');
  check((await round(plain + ' 08:10')).length === 0, 'once a morning');
  check((await q(`select count(*)::int n from private.push_log where to_acct = $1 and kind = 'am'`, [A])).rows[0].n === 1, 'written down once');
  // a sold fish is not told about
  await q(`update public.live_catches set sold_at = now(), sold_for = 14 where acct = $1 and sp = $2`, [A, dearP]);
  check(!(await round(nextDay(plain) + ' 07:40')).find(r => r.acct === A && r.items.some(i => i.k === 'mkt' && i.sp === dearP)), 'a sold fish is not mentioned');
}

// ---------- last week's prize ----------
{
  const d2 = nextDay(nextDay(plain));
  await q(`insert into public.zp_ledger (acct, delta, reason, ref, note, created_at) values ($1, 200, 'prize', 'live:2026-11-09', '2', ($2::timestamp at time zone 'Asia/Seoul') - interval '7 hours')`, [B, d2 + ' 07:40']);
  let rows = await round(d2 + ' 07:40'); const b = rows.find(r => r.acct === B);
  check(b && b.items.some(i => i.k === 'rank' && i.r === 2 && i.p === 200), 'B hears about last week\'s 2nd place and its 200P: ' + J(b));
  rows = await round(nextDay(d2) + ' 07:40');
  check(!rows.find(r => r.acct === B && r.items.some(i => i.k === 'rank')), 'a prize is told once');
  // B switches prize notices off
  const pf = await rpc(B, `select public.push_prefs_set(true, true, false) p`).then(r => r.p);
  check(pf.rank === false && pf.market === true && pf.tide === true, 'B switches prize notices off: ' + J(pf));
  { const c = await rpc(C, `select public.push_prefs() p`).then(r => r.p); check(c.market === true && c.tide === true && c.rank === true, 'everything is on until changed: ' + J(c)); }
  await q(`insert into public.zp_ledger (acct, delta, reason, ref, note, created_at) values ($1, 300, 'prize', 'live:2026-11-16', '1', ($2::timestamp at time zone 'Asia/Seoul') - interval '7 hours')`, [B, nextDay(nextDay(d2)) + ' 07:40']);
  check(!(await round(nextDay(nextDay(d2)) + ' 07:40')).find(r => r.acct === B), 'switched off: no prize notice');
  await rpc(B, `select public.push_prefs_set(true, true, true) p`);
  // a prize from long ago is old news
  await q(`insert into public.zp_ledger (acct, delta, reason, ref, note, created_at) values ($1, 100, 'prize', 'live:2026-10-05', '3', now() - interval '40 days')`, [C]);
  check(!(await round(nextDay(nextDay(nextDay(d2))) + ' 07:40')).find(r => r.acct === C), 'a prize from weeks ago is not news');
}

// ---------- the strong tides ----------
{
  await net(A, dearS, 12, 4);
  const rows = await round(spring + ' 07:35');
  const a = rows.find(r => r.acct === A), b = rows.find(r => r.acct === B);
  check(a && a.items.some(i => i.k === 'tide') && a.items.some(i => i.k === 'mkt' && i.sp === dearS), 'on the first strong day A hears both: the tides and the dear fish: ' + J(a && a.items));
  check(b && b.items.length >= 1 && b.items.some(i => i.k === 'tide'), 'B (who has played) hears about the tides');
  check(!rows.find(r => r.acct === C), 'C, who never played, hears nothing about the tides');
  check(!(await round(nextDay(spring) + ' 07:35')).some(r => r.items.some(i => i.k === 'tide')), 'only on the first strong day');
  // switched off
  await rpc(B, `select public.push_prefs_set(true, false, true) p`);
  const later = days.filter(x => +x.t >= 0.85 && +x.y < 0.85).map(x => x.d)[1];
  check(later && !(await round(later + ' 07:35')).find(r => r.acct === B && r.items.some(i => i.k === 'tide')), 'B switched tide notices off: ' + later);
}

// ---------- how many a round ----------
{
  await net(B, dearP, 12, 4); await net(D, dearP, 12, 4);
  await sub(D);
  const day = days.map(x => x.d).filter(d => d > plain).find(d => true);
  const r1 = await round('2027-02-10 07:40', 1), r2 = await round('2027-02-10 07:50', 300), r3 = await round('2027-02-10 08:00', 300);
  check(r1.length <= 1 && r3.length === 0 && new Set([...r1, ...r2].map(r => r.acct)).size === r1.length + r2.length, 'a round takes at most its limit; the next takes the rest; nobody twice: ' + J([r1.length, r2.length, r3.length]));
}

// ---------- who may call what ----------
check(/permission denied/.test(await fails(() => as(A, () => q(`select * from public.push_morning(300, null)`))) || ''), 'signed-in users cannot run the morning round');
check(/permission denied/.test(await fails(() => asRole('anon', '', () => q(`select public.push_prefs()`))) || ''), 'visitors who are not signed in cannot read switches');
check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.push_prefs`))) || ''), 'nobody reads the switches table directly');
check(/not_signed_in|permission denied/.test(await fails(() => asRole('anon', '', () => q(`select public.push_prefs_set(true, true, true)`))) || ''), 'visitors cannot change switches');

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
