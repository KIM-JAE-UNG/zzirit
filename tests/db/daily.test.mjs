// 0023 오늘의 미션 and 연속 출석: three missions a Korean day, counted by the server from the game's own tables and paid
// once each (and once more for all three); a visit a day makes the streak (5P, 30P every 7th day in a row).
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
const daily = uid => rpc(uid, `select public.live_daily() r`).then(r => r.r);
const claim = (uid, k) => rpc(uid, `select public.live_mission_claim($1) r`, [k]).then(r => r.r);
const bal = async uid => +((await q(`select bal from public.zp_wallets where acct = $1`, [uid])).rows[0] || { bal: 0 }).bal;
const today = (await q(`select (now() at time zone 'Asia/Seoul')::date::text d`)).rows[0].d;
// a fish in the book today (a second ago, so a sale "now" comes after it); o.ago: days back
const put = (uid, o = {}) => q(`insert into public.live_catches (acct, sp, cm, tier, big, score, pts, onsite, gx, gy, wk, val, sold_at, sold_for, created_at)
  values ($1, $2, 30, $3, $4, 100, 0, $5, 1, 1, private.zp_week(), 5, case when $6 then now() + make_interval(secs => $9) end, $7, now() - interval '1 second' - make_interval(days => $8))`,
  [uid, o.sp || 'saba', o.tier || 1, !!o.big, o.onsite !== false, !!o.sold, o.sold ? (o.free ? 0 : 7) : null, o.ago || 0, o.same ? -1 : 0]);

// ---------- who may ask ----------
{
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_daily()`))) || ''), 'a visitor who is not signed in cannot ask');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.live_checkin($1, current_date)`, [A]))) || ''), 'the visit itself is private (nobody can pay themselves a visit)');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.live_streak`))) || ''), 'the streak table is private');
  const d = await daily(D);
  check(d.err === 'no_profile', 'no missions without a profile ' + J(d));
}

// ---------- the visit and the streak ----------
{
  const b0 = await bal(A), r = await daily(A);
  check(r.visit.streak === 1 && r.visit.got === 5 && r.day === today, 'the first visit starts the streak at 1 and pays 5P ' + J(r.visit));
  check(await bal(A) === b0 + 5, 'the 5P are in the wallet');
  const r2 = await daily(A);
  check(r2.visit.streak === 1 && r2.visit.got === 0, 'a second visit the same day pays nothing more');
  const r3 = await daily(E);
  check(r3.visit.streak === 1 && r3.visit.got === 0 && await bal(A) === b0 + 5, "a linked phone is the same angler: the same streak, no second payment");
  await q(`insert into private.live_streak (acct, last_day, streak, best, total) values ($1, $2::date - 1, 6, 6, 6)`, [B, today]);
  const b1 = await bal(B), rb = await daily(B);
  check(rb.visit.streak === 7 && rb.visit.got === 30 && rb.visit.best === 7 && await bal(B) === b1 + 30, 'coming back the next day grows the streak; the 7th day pays 30P ' + J(rb.visit));
  await q(`insert into private.live_streak (acct, last_day, streak, best, total) values ($1, $2::date - 3, 5, 5, 5)`, [C, today]);
  const rc = await daily(C);
  check(rc.visit.streak === 1 && rc.visit.best === 5 && rc.visit.got === 5, 'after a gap the streak starts again (the best stays) ' + J(rc.visit));
  const v = (await q(`select private.live_checkin($1, $2::date + 1) a, private.live_checkin($1, $2::date + 1) b`, [C, today])).rows[0];
  check(v.a.streak === 2 && v.a.got === 5 && v.b.got === 0, 'the next day pays once ' + J(v));
  const p = (await q(`select private.live_visit_pts(1) a, private.live_visit_pts(7) b, private.live_visit_pts(14) c, private.live_visit_pts(8) d`)).rows[0];
  check(p.a === 5 && p.b === 30 && p.c === 30 && p.d === 5, 'every 7th day pays 30P');
  const led = (await q(`select ref, note, reason from public.zp_ledger where acct = $1 and ref like 'visit:%' order by id`, [B])).rows;
  check(led.length === 1 && led[0].note === '7' && led[0].reason === 'prize', 'visits are written in the book with the day of the streak ' + J(led));
}

// ---------- the missions ----------
{
  const r = await daily(A), ks = r.missions.map(m => m.k);
  check(r.missions.length === 3 && /^fish[36]$/.test(ks[0]) && new Set(ks).size === 3, 'three different missions, the first about landing fish ' + J(ks));
  check(r.missions.every(m => m.n === 0 && !m.got && m.goal >= 1 && m.pts >= 10), 'nothing done yet');
  const again = await daily(A);
  check(J(again.missions.map(m => m.k)) === J(ks), 'the same three all day');
  const days = (await q(`select count(distinct private.live_missions($1, d::date)::text)::int n from generate_series(current_date, current_date + 20, '1 day') d`, [A])).rows[0].n;
  check(days > 5, 'other days bring other missions (' + days + ' different in 21 days)');
  const many = (await q(`select k, count(*)::int n from (select jsonb_array_elements(private.live_missions(gen_random_uuid(), current_date)) ->> 'k' k from generate_series(1, 400)) x group by k`)).rows;
  check(['fish3', 'fish6', 'rare', 'big', 'sell', 'free', 'remote', 'sea', 'fresh'].every(k => many.some(x => x.k === k)), 'every kind of mission comes up ' + J(many));
  check((await claim(A, ks[1])).err === 'not_done', 'a mission not done yet pays nothing');
  check((await claim(A, 'nope')).err === 'not_today' || ks.includes('nope'), "a mission that isn't today's pays nothing");
  check((await claim(A, 'all')).err === 'not_done', 'the bonus waits for all three');
  // do everything any mission could ask: six rare, big sea and fresh fish from far away, three sold, one let go
  for (let i = 0; i < 3; i++) await put(A, { sp: 'madai', tier: 3, big: true, onsite: false, sold: true });
  for (let i = 0; i < 3; i++) await put(A, { sp: 'bass', tier: 3, big: true, onsite: false });
  await put(A, { sp: 'saba', sold: true, free: true });
  const r2 = await daily(A);
  check(r2.missions.every(m => m.n === m.goal && !m.got), 'the server counts the day from the fish book ' + J(r2.missions));
  const b0 = await bal(A); let sum = 0;
  for (const m of r2.missions) { const c = await claim(A, m.k); check(c.ok && c.pts === m.pts, 'mission ' + m.k + ' pays ' + m.pts + 'P'); sum += m.pts; }
  check(await bal(A) === b0 + sum, 'the points are in the wallet');
  check((await claim(A, ks[0])).err === 'already', 'a mission pays once');
  const all = await claim(A, 'all');
  check(all.ok && all.pts === 20 && (await claim(A, 'all')).err === 'already', 'all three pay 20P more, once');
  const r3 = await daily(E);
  check(r3.missions.every(m => m.got) && r3.allGot, 'the linked phone sees them taken');
  check(await bal(A) === b0 + sum + 20, 'and nothing more was paid');
}

// ---------- what counts ----------
{
  await put(F, { sp: 'madai', tier: 3, big: true });             // sea, rare, big, on the spot
  await put(F, { sp: 'saba' });                                   // sea
  await put(F, { sp: 'bass', tier: 3, onsite: false });           // fresh, rare, far away
  await put(F, { sp: 'bora', sold: true });                       // brackish (sea and fresh), sold today
  await put(F, { sp: 'saba', sold: true, free: true });           // let go
  await put(F, { sp: 'saba', sold: true, free: true, same: true }); // a full net let it go when it was landed: not "let go" by hand
  await put(F, { sp: 'madai', tier: 4, big: true, onsite: false, ago: 2 }); // two days ago: not today
  const n = (await q(`select k, private.live_mission_n($1, (now() at time zone 'Asia/Seoul')::date, k) n from unnest(array['fish3','rare','big','remote','sea','fresh','sell','free']) k`, [F])).rows;
  const N = Object.fromEntries(n.map(x => [x.k, x.n]));
  check(N.fish3 === 6 && N.rare === 2 && N.big === 1 && N.remote === 1, 'fish, rare, big and far-away fish of today only ' + J(N));
  check(N.sea === 5 && N.fresh === 2, 'sea and freshwater fish (brackish counts for both) ' + J(N));
  check(N.sell === 1 && N.free === 1, 'sold and let go by hand today ' + J(N));
}

console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
