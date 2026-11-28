// 0030 바다 땅따먹기 and 동호회 대항전: every landed fish adds its score to the angler's power in its 10 km square for the week;
// the most power owns the square (a tie keeps who was there first), the server writes who took it from whom, clubs own squares
// with their members' power together, unnamed anglers stay hidden, voided weeks do not count, last week's squares pay once.
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
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333', D = '44444444-4444-4444-4444-444444444444', E = '55555555-5555-5555-5555-555555555555', F = '66666666-6666-6666-6666-666666666666';
await q(`insert into auth.users values ($1),($2),($3),($4),($5),($6)`, [A, B, C, D, E, F]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  ✗', m); } };
const asRole = async (role, uid, fn) => { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const as = (uid, fn) => asRole('authenticated', uid, fn);
const fails = async fn => { try { await fn(); return null; } catch (e) { return e.message.split('\n')[0]; } };
const J = JSON.stringify;
// A, B, C, F have profiles; D has none; E is A's phone (a linked device)
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)`, [A, J({ nick: 'Ann', catches: [] }), B, J({ nick: 'Bob', catches: [] }), C, J({ nick: 'Cat', catches: [] }), F, J({ nick: 'Fay', catches: [] })]);
await q(`insert into private.links (member, owner) values ($1, $2)`, [E, A]);
const rpc = (uid, sql, params) => as(uid, async () => (await q(sql, params)).rows[0].r);
const bal = async uid => +((await q(`select bal from public.zp_wallets where acct = $1`, [uid])).rows[0] || { bal: 0 }).bal;
const wk = (await q(`select private.zp_week()::text w`)).rows[0].w;
const lastWk = (await q(`select (private.zp_week() - 7)::text w`)).rows[0].w;
// a landed fish: the float's 1 km square (gx, gy) → the 10 km turf square is floor(g / 10)
const fish = (acct, gx, gy, score, o = {}) => q(`insert into public.live_catches (acct, sp, cm, tier, big, score, pts, onsite, anon, gx, gy, wk, created_at) values ($1, 'kurodai', 40, 4, false, $2, 0, true, $3, $4, $5, $6::date, now())`,
  [acct, score, !!o.anon, gx, gy, o.wk || wk]);
const turf = (uid, x0, y0, x1, y1) => rpc(uid, `select public.live_turf($1, $2, $3, $4) r`, [x0, y0, x1, y1]);
const me = uid => rpc(uid, `select public.live_turf_me() r`);
const cell = (r, x, y) => r.cells.find(c => c.x === x && c.y === y);

// ---------- who may ask ----------
{
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_turf(0, 0, 1, 1)`))) || ''), 'a visitor who is not signed in cannot see the squares');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.live_turf`))) || ''), 'the turf tables are private');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.live_turf_owners($1::date)`, [wk]))) || ''), 'nobody calls the inner functions');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.live_turf_add($1::date, 0, 0, $2, 999, false)`, [wk, A]))) || ''), 'nobody adds power by hand');
  check(/bad_input/.test(await fails(() => turf(A, 0, 0, 100, 100)) || ''), 'a box of more than 4,000 squares is refused');
  check(/bad_input/.test(await fails(() => turf(A, 5, 5, 1, 1)) || ''), 'a box the wrong way round is refused');
  const r = await turf(A, 0, 0, 10, 10);
  check(r.wk === wk && r.cells.length === 0 && r.ends > Date.now() && r.ends - Date.now() <= 7 * 864e5 + 1000, 'at first the sea belongs to nobody, and the week ends on Monday ' + J(r).slice(0, 120));
  const m = await me(A);
  check(m.n === 0 && m.rk === null && m.cells.length === 0 && m.lords.length === 0 && m.log.length === 0 && m.last.n === 0 && m.last.pts === 0 && !m.last.got, 'my week: nothing yet');
}

// ---------- the first fish takes the square; more power takes it away; a tie keeps the first ----------
{
  await fish(A, 12925, 3515, 80);                   // square (1292, 351): Busan
  let r = await turf(B, 1290, 350, 1295, 355), c = cell(r, 1292, 351);
  check(c && c.a === A && c.p === 80 && c.me === false && c.mp === 0 && c.c === 1, 'A\'s fish: the square is A\'s, B sees the owner and the power ' + J(c));
  r = await turf(A, 1290, 350, 1295, 355); c = cell(r, 1292, 351);
  check(c.me === true && c.mp === 80, 'A sees it is hers');
  let m = await me(A);
  check(m.n === 1 && m.rk === 1 && J(m.cells) === J([[1292, 351, 80]]) && m.log.length === 1 && m.log[0].k === 'won' && m.log[0].who === null, 'A holds one square, first of the lords; the log: taken from nobody ' + J(m.log));
  check((await me(E)).n === 1, 'A\'s phone (a linked device) is A');
  await fish(B, 12921, 3519, 50);                   // same square, less
  r = await turf(B, 1290, 350, 1295, 355); c = cell(r, 1292, 351);
  check(c.a === A && c.p === 80 && c.mp === 50 && c.c === 2, 'B adds 50: still A\'s (B sees his own 50 and two anglers there)');
  await fish(B, 12929, 3510, 30);                   // B: 80 → a tie
  c = cell(await turf(B, 1290, 350, 1295, 355), 1292, 351);
  check(c.a === A && c.mp === 80, 'a tie (80 : 80) keeps the one who was there first');
  check((await me(B)).log.length === 0 && (await me(A)).log.length === 1, 'and nobody took anything');
  await fish(B, 12922, 3512, 15);                   // 95 > 80
  c = cell(await turf(A, 1290, 350, 1295, 355), 1292, 351);
  check(c.a === B && c.p === 95 && c.me === false && c.mp === 80, 'B lands more: the square is B\'s now');
  m = await me(A);
  check(m.n === 0 && m.log[0].k === 'lost' && m.log[0].who === B && m.log[0].x === 1292 && m.log[0].y === 351, 'A\'s log: B took it ' + J(m.log[0]));
  const mb = await me(B);
  check(mb.n === 1 && mb.log[0].k === 'won' && mb.log[0].who === A, 'B\'s log: taken from A');
  await fish(A, 12925, 3515, 40);                   // A takes it back: 120 > 95
  check(cell(await turf(A, 1290, 350, 1295, 355), 1292, 351).a === A && (await me(B)).log[0].k === 'lost', 'A takes it back, B hears of it');
  // a fish of another square does not touch this one
  await fish(B, 12935, 3505, 10);                   // (1293, 350)
  r = await turf(A, 1290, 350, 1295, 355);
  check(r.cells.length === 2 && cell(r, 1293, 350).a === B && cell(r, 1292, 351).a === A, 'each square on its own');
  // negative squares (west, south) work too
  await fish(C, -7410, -3320, 60);                  // (-741, -332): somewhere far
  c = cell(await turf(C, -745, -335, -740, -330), -741, -332);
  check(c && c.a === C && c.p === 60, 'west and south of zero: floor, not toward zero');
}

// ---------- the lords of the week ----------
{
  await fish(C, 12945, 3545, 20); await fish(C, 12955, 3545, 20);  // C: 3 squares
  const m = await me(A);
  check(m.lords.length === 3 && m.lords[0].a === C && m.lords[0].n === 3 && m.lords.map(l => l.n).join() === '3,1,1', 'lords: by squares held ' + J(m.lords));
  check(m.lords[1].a === A && m.lords[1].p === 120 && m.lords[1].rk === 2 && m.lords[2].rk === 3 && m.lords_n === 3 && m.rk === 2, 'then by power; my place');
}

// ---------- fishing unnamed: power counts, the name stays hidden ----------
{
  await fish(F, 12805, 3405, 70, { anon: true });   // (1280, 340)
  let c = cell(await turf(A, 1278, 338, 1282, 342), 1280, 340);
  check(c && c.a === null && c.p === 70, 'an unnamed angler\'s square shows no name');
  c = cell(await turf(F, 1278, 338, 1282, 342), 1280, 340);
  check(c.a === F && c.me === true, 'but the angler sees it is hers');
  await fish(A, 12801, 3401, 90);
  const mf = await me(F);
  check(mf.log[0].k === 'lost' && mf.log[0].who === A, 'F hears A took it');
  await fish(F, 12805, 3405, 40, { anon: true });
  const ma = await me(A);
  check(ma.log[0].k === 'lost' && ma.log[0].who === null, 'A hears it was taken back — by someone hidden ' + J(ma.log[0]));
  check(ma.lords.some(l => l.a === null && l.n === 1) && !ma.lords.some(l => l.a === F), 'the lords board hides the unnamed one too');
}

// ---------- the clubs ----------
{
  // B leads an open club; A says she is in it; C asked to join a closed club of F's that has not let him in
  await q(`insert into public.teams (id, data) values ($1, $2), ($3, $4)`, [B, J({ name: '부산조사회', tag: 'BSN', emoji: '🐟', color: '#1E66E5', open: true, members: {} }), F, J({ name: '<b>닫힌</b>', tag: 'X', color: 'red;}', open: false, members: {} })]);
  await q(`update public.anglers set data = data || $2 where id = $1`, [A, J({ team: { id: B } })]);
  await q(`update public.anglers set data = data || $2 where id = $1`, [C, J({ team: { id: F } })]);
  let r = await turf(A, 1290, 350, 1295, 355);
  let c = cell(r, 1292, 351);
  check(c.t === B && c.tp === 120 + 95, 'Busan: the club holds it with A and B together (215) ' + J(c));
  check(r.teams[B] && r.teams[B].name === '부산조사회' && r.teams[B].tag === 'BSN' && r.teams[B].color === '#1E66E5', 'the club card comes along');
  c = cell(await turf(A, 1293, 344, 1296, 355), 1294, 354);
  check(c && c.a === C && !c.t, 'C\'s square: no club (the closed club has not let him in)');
  let m = await me(A);
  check(m.team && m.team.id === B && m.team.n === 2 && m.team.rk === 1, 'A\'s club holds 2 squares (Busan and B\'s other one; the third goes to F\'s club: F leads it, 110 > A\'s 90) ' + J(m.team));
  check(cell(await turf(A, 1278, 338, 1282, 342), 1280, 340).t === F, 'the leader counts for her own club');
  check(m.clubs.length === 2 && m.clubs[0].id === B, 'the club war board');
  // the closed club lets C in: now C's squares are the club's
  await q(`update public.teams set data = jsonb_set(data, '{members}', $2::jsonb) where id = $1`, [F, J({ [C]: Date.now() })]);
  m = await me(C);
  check(m.team && m.team.id === F && m.team.n >= 4 && m.team.color === '#0B6E8E', 'let in: C\'s squares count for the closed club (a bad colour falls back) ' + J(m.team));
  // banned: out
  await q(`update public.teams set data = jsonb_set(data, '{ban}', $2::jsonb) where id = $1`, [B, J({ [A]: Date.now() })]);
  c = cell(await turf(A, 1290, 350, 1295, 355), 1292, 351);
  check(c.t === B && c.tp === 95, 'a banned member\'s power no longer counts for the club');
  check((await me(A)).team === null, 'and she is in no club');
  await q(`update public.teams set data = data - 'ban' where id = $1`, [B]);
}

// ---------- a voided week does not count ----------
{
  await q(`insert into public.live_scores (wk, acct, score, n, void) values ($1::date, $2, 999, 9, true) on conflict (wk, acct) do update set void = true`, [wk, C]);
  const r = await turf(A, 1293, 344, 1296, 355);
  check(!cell(r, 1294, 354) && !cell(r, 1295, 354), 'the operator voided C\'s week: his squares are free');
  await q(`update public.live_scores set void = false where wk = $1::date and acct = $2`, [wk, C]);
}

// ---------- last week pays once ----------
{
  await fish(A, 100, 100, 30, { wk: lastWk }); await fish(A, 110, 100, 30, { wk: lastWk }); await fish(A, 120, 100, 30, { wk: lastWk });
  await fish(B, 100, 100, 50, { wk: lastWk }); // B took one of them
  let m = await me(A);
  check(m.last.n === 2 && m.last.pts === 20 && !m.last.got, 'last week A held 2 squares at the end: 20 points waiting');
  check(!cell(await turf(A, 9, 9, 13, 11), 10, 10), 'last week\'s squares are not on this week\'s map');
  const b0 = await bal(A);
  const cl = await rpc(E, `select public.live_turf_claim() r`);
  check(cl.ok && cl.n === 2 && cl.pts === 20 && (await bal(A)) === b0 + 20, 'claimed (from A\'s phone): +20P to A ' + J(cl));
  check((await rpc(A, `select public.live_turf_claim() r`)).err === 'already' && (await bal(A)) === b0 + 20, 'only once');
  check((await me(A)).last.got === true, 'and it says so');
  check((await rpc(C, `select public.live_turf_claim() r`)).err === 'none', 'nothing held last week: nothing to claim');
  check((await rpc(D, `select public.live_turf_claim() r`)).err === 'no_profile', 'no profile, no points');
  for (let i = 0; i < 14; i++) await fish(C, 2000 + i * 10, 2000, 5, { wk: lastWk });
  const cc = await rpc(C, `select public.live_turf_claim() r`);
  check(cc.n === 14 && cc.pts === 100, 'at most 100 points (14 squares)');
}

// ---------- the trigger, the backfill, leaving ----------
{
  check((await q(`select count(*)::int n from private.live_turf_log`)).rows[0].n >= 8, 'every change of hands was written down');
  // the migration once more over what is there: nothing doubles
  const before = (await q(`select sum(power)::int s from private.live_turf where wk = $1::date`, [wk])).rows[0].s;
  await db.exec(fs.readFileSync(M + '0030_live_turf.sql', 'utf8'));
  check((await q(`select sum(power)::int s from private.live_turf where wk = $1::date`, [wk])).rows[0].s === before, 'running the migration again adds nothing twice');
  await q(`delete from auth.users where id = $1`, [B]);
  check(!(await q(`select 1 from private.live_turf where acct = $1 union all select 1 from private.live_turf_log where won = $1 or lost = $1`, [B])).rows.length, 'when an account goes, its squares and its news go too');
}
console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
