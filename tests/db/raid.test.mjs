// 0027 전설의 괴어 레이드: a monster every two hours that everyone fights together; the server decides the damage,
// grows the monster for each new angler, and pays once by share when it is beaten in time.
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
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', D = '44444444-4444-4444-4444-444444444444', E = '55555555-5555-5555-5555-555555555555';
await q(`insert into auth.users values ($1),($2),($3),($4)`, [A, B, D, E]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  ✗', m); } };
const asRole = async (role, uid, fn) => { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const as = (uid, fn) => asRole('authenticated', uid, fn);
const fails = async fn => { try { await fn(); return null; } catch (e) { return e.message.split('\n')[0]; } };
const J = JSON.stringify;
// A and B have profiles; D has none; E is A's phone (a linked device)
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4)`, [A, J({ nick: 'Ann', catches: [] }), B, J({ nick: 'Bob', catches: [] })]);
await q(`insert into private.links (member, owner) values ($1, $2)`, [E, A]);
const rpc = (uid, sql, params) => as(uid, async () => (await q(sql, params)).rows[0].r);
const raid = uid => rpc(uid, `select public.live_raid() r`);
const hit = (uid, id, qq) => rpc(uid, `select public.live_raid_hit($1, $2) r`, [id, qq]);
const bal = async uid => +((await q(`select bal from public.zp_wallets where acct = $1`, [uid])).rows[0] || { bal: 0 }).bal;
const cfg = s => q(`update private.raid_cfg set ${s} where id = 1`);
// one raid a day (from 00:00 UTC) that lasts until a few minutes from now, so one is surely on while the checks run
const onNow = async () => { const d = new Date(), m = d.getUTCHours() * 60 + d.getUTCMinutes(); await cfg(`every_min = 1440, dur_min = ${Math.min(1440, m + 10)}, gap_ms = 0, base_hp = 100, add_hp = 50`); };

// ---------- who may ask ----------
{
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_raid()`))) || ''), 'a visitor who is not signed in cannot ask');
  for (const t of ['private.live_raids', 'private.live_raid_hits', 'private.raid_cfg'])
    check(/permission denied/.test(await fails(() => as(A, () => q(`select * from ${t}`))) || ''), t + ' is private');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.raid_win(1)`))) || ''), 'paying out is private');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.raid_now()`))) || ''), 'making a raid is private');
}

// ---------- the schedule: one on now, or when the next one comes ----------
{
  await cfg(`every_min = 120, dur_min = 20`);
  const r = await raid(A);
  check(r.next > r.now && r.next - r.now <= 120 * 60e3 && r.every === 120 && r.dur === 20, 'it says when the next one comes (every 2 hours)');
  if (r.raid) check(r.raid.ends - r.raid.starts === 20 * 60e3 && r.raid.starts % (120 * 60e3) === 0, 'a raid starts on the even hour and lasts 20 minutes');
  await onNow();
  const s = (await raid(A)).raid;
  check(!!s && s.hp === 100 && s.max === 100 && s.n === 0 && s.now !== null, 'a raid is on, at full strength, with nobody yet ' + J(s));
  check(['kue', 'ishidai', 'gt', 'tarpon', 'ishigakidai', 'hiramasa'].includes(s.sp) && typeof s.spot === 'string' && Math.abs(+s.lat) <= 90, 'a legendary fish at a famous sea');
  check((await raid(B)).raid.id === s.id, 'everyone sees the same raid');
  check((await q(`select count(*)::int n from private.live_raids`)).rows[0].n >= 1 && (await q(`select count(*)::int n from private.live_raids where id = $1`, [s.id])).rows[0].n === 1, 'asked twice, made once');
  const picks = new Set(); for (let i = 0; i < 60; i++) { const p = (await q(`select * from private.raid_pick($1)`, [i])).rows[0]; picks.add(p.spot + '/' + p.sp); check(!!p.spot && !!p.sp, 'every slot has a sea and a fish'); }
  check(picks.size >= 12, 'the seas and fish change from raid to raid: ' + picks.size);
}

// ---------- striking ----------
{
  const id = (await raid(A)).raid.id;
  check((await hit(D, id, 1)).err === 'no_profile', 'no strikes without a profile');
  check((await hit(A, 999, 1)).err === 'no_raid', 'an unknown raid is refused');
  const a1 = await hit(A, id, 0);
  check(a1.ok && a1.dmg >= 6 && a1.dmg <= 10 && !a1.crit && a1.max === 100 && a1.hp === 100 - a1.dmg, 'a poorly timed strike: small damage, the first one fights it at base strength ' + J(a1));
  const b1 = await hit(B, id, 1);
  check(b1.ok && b1.crit && b1.dmg >= 36 && b1.dmg <= 44 && b1.max === 150, 'a perfect strike doubles; a second angler makes it stronger (+50) ' + J(b1));
  const big = await hit(A, id, 99);
  check(big.dmg <= 44, 'the phone cannot claim more than a perfect strike');
  await cfg(`gap_ms = 60000`);
  check((await hit(A, id, 1)).err === 'fast', 'strikes too close together are refused');
  await cfg(`gap_ms = 0`);
  const e1 = await hit(E, id, .5);
  check(e1.ok && e1.max === 150, 'a linked phone strikes for the same person (no extra strength)');
  const st = (await raid(B)).raid;
  check(st.n === 2 && st.top.length === 2 && st.top[0].d >= st.top[1].d && st.top.some(x => x.nick === 'Ann') && st.me && st.me.hits === 1, 'the board shows who did the most, with nicknames ' + J(st.top));
  // finish it
  let last; for (let i = 0; i < 40; i++) { last = await hit(i % 2 ? A : B, id, 1); if (last.beaten || last.err) break; }
  check(last && last.beaten && last.hp === 0 && last.raid && last.raid.beaten, 'beaten together');
  const done = (await raid(A)).raid;
  const top = done.top[0];
  check(done.mvp === top.a && !!done.mvpNick, 'the one who did the most is the MVP');
  const la = (await q(`select acct, delta, note from public.zp_ledger where ref = $1 order by delta desc`, ['raid:' + id])).rows;
  const tot = done.top.reduce((n, x) => n + x.d, 0);
  check(la.length === 2 && la.every(x => x.delta === 30 + Math.round(120 * done.top.find(y => y.a === x.acct).d / tot) + (x.acct === done.mvp ? 50 : 0)), 'everyone is paid by share, the MVP 50 more ' + J(la));
  check(done.pts === la.find(x => x.acct === A).delta && (await raid(B)).raid.pts === la.find(x => x.acct === B).delta, 'each one sees their own reward');
  const dx = (await q(`select n, best from public.live_dex where acct = $1 and sp = $2`, [done.mvp, done.sp])).rows[0];
  check(!!dx && +dx.best > 0, 'the MVP gets the monster in the fish book');
  const b0 = await bal(A);
  check((await hit(A, id, 1)).err === 'beaten' && await bal(A) === b0, 'a beaten raid takes no more strikes and pays once');
  await q(`select private.raid_win($1)`, [id]);
  check((await q(`select count(*)::int n from public.zp_ledger where ref = $1`, ['raid:' + id])).rows[0].n === 2, 'paying out twice does nothing');
}

// ---------- the one that got away ----------
{
  await q(`insert into private.live_raids (id, sp, spot, lat, lon, hp, max_hp, starts, ends) values (12345, 'kue', 'jeju', 33, 126, 500, 500, now() - interval '30 minutes', now() - interval '10 minutes')`);
  const r = await hit(A, 12345, 1);
  check(r.err === 'over' && !r.raid.beaten, 'after its time it has got away: no strikes');
  const later = await raid(A);
  check(!later.raid || later.raid.id !== 12345, 'and it is not the raid on now');
  check(!(await q(`select 1 from public.zp_ledger where ref = 'raid:12345'`)).rows.length, 'nobody is paid for one that got away');
}

// ---------- leaving ----------
{
  await q(`delete from auth.users where id = $1`, [B]);
  check(!(await q(`select 1 from private.live_raid_hits where acct = $1`, [B])).rows.length, 'when an account goes, its strikes go too');
}
console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
