// 0028 레이드 기록과 괴어 칭호: the server counts my raids (joined, beaten, MVP, damage, the monsters beaten) and pays a raid title once.
// A raid title is worn like a set title (live_title_set), and the set list keeps showing only fish sets.
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
// A and B have profiles; D has none; E is A's phone (a linked device)
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4)`, [A, J({ nick: 'Ann', catches: [] }), B, J({ nick: 'Bob', catches: [] })]);
await q(`insert into private.links (member, owner) values ($1, $2)`, [E, A]);
const rpc = (uid, sql, params) => as(uid, async () => (await q(sql, params)).rows[0].r);
const bal = async uid => +((await q(`select bal from public.zp_wallets where acct = $1`, [uid])).rows[0] || { bal: 0 }).bal;
const rec = uid => rpc(uid, `select public.live_raid_record() r`);
const claim = (uid, k) => rpc(uid, `select public.live_raid_title_claim($1) r`, [k]);
const wear = (uid, k) => rpc(uid, `select public.live_title_set($1) r`, [k]);
// a finished raid: id, monster, beaten?, mvp, and the strikes [acct, damage]
const past = async (id, sp, won, mvp, hits) => {
  await q(`insert into private.live_raids (id, sp, spot, lat, lon, hp, max_hp, starts, ends, beaten_at, mvp) values ($1, $2, 'jeju', 33, 126, $3, 500, now() - interval '3 hours' + make_interval(secs => $6::int), now() - interval '2 hours' + make_interval(secs => $6::int), $4, $5)`,
    [id, sp, won ? 0 : 200, won ? new Date(Date.now() - 7200e3 + id * 1000).toISOString() : null, mvp, id]);
  let i = 0; for (const [a, d] of hits) await q(`insert into private.live_raid_hits (raid, acct, dmg, hits, crits, first_at) values ($1, $2, $3, 5, 1, now() - interval '3 hours' + make_interval(secs => $4::int))`, [id, a, d, i++]);
};

// ---------- who may ask ----------
{
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_raid_record()`))) || ''), 'a visitor who is not signed in cannot ask');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.raid_titles`))) || ''), 'the raid title table is private');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.raid_stats($1)`, [B]))) || ''), 'nobody can read someone else\'s numbers');
}

// ---------- at first: nothing ----------
{
  const r = await rec(A);
  check(r.joined === 0 && r.won === 0 && r.mvp === 0 && r.dmg === 0 && r.best === null && r.list.length === 0 && Object.keys(r.dex).length === 0, 'at first there is no record ' + J(r));
  check(r.titles.length === 4 && r.titles.map(x => x.k).join() === 'raid_hunter,raid_mvp,raid_veteran,raid_all' && r.titles.every(x => x.n === 0 && !x.got), 'four raid titles, none done');
  check(r.monsters.length === 6 && r.monsters.includes('kue'), 'the six monsters come along');
  check((await claim(A, 'raid_hunter')).err === 'not_done', 'a title that is not done is refused');
  check((await claim(D, 'raid_hunter')).err === 'no_profile', 'no title without a profile');
  check((await claim(A, 'nope')).err === 'no_title', 'an unknown title is refused');
  const s = await rpc(A, `select public.live_sets() r`);
  check(s.sets.length === 12 && !s.sets.some(x => /^raid_/.test(x.k)), 'the set list shows only the 12 fish sets');
  check((await rpc(A, `select public.live_set_claim('raid_hunter') r`)).err === 'no_set', 'a raid title cannot be taken as a set');
}

// ---------- the record ----------
{
  await past(101, 'kue', true, A, [[A, 300], [B, 200]]);
  await past(102, 'gt', true, B, [[B, 400], [A, 100]]);
  await past(103, 'tarpon', false, null, [[A, 150]]);
  await past(104, 'ishidai', true, B, [[B, 500], [A, 0]]); // a strike that did nothing does not count
  await q(`insert into public.zp_ledger (acct, delta, reason, ref, note) values ($1, 120, 'prize', 'raid:101', 'raid mvp')`, [A]);
  const r = await rec(A);
  check(r.joined === 3 && r.won === 2 && r.mvp === 1 && r.dmg === 550 && r.hits === 15 && r.crits === 3, 'joined, beaten, MVP, damage, strikes ' + J(r));
  check(r.best && r.best.id === 101 && r.best.d === 300 && r.best.rk === 1 && r.best.sp === 'kue', 'the best raid, with my place');
  check(J(r.dex) === J({ gt: 1, kue: 1 }) || (r.dex.kue === 1 && r.dex.gt === 1 && Object.keys(r.dex).length === 2), 'only monsters beaten count in the book (not the one that got away) ' + J(r.dex));
  check(r.list.length === 3 && r.list[0].id === 103 && !r.list[0].won && r.list[2].id === 101 && r.list[2].mvp && r.list[2].pts === 120 && r.list[1].rk === 2 && r.list[1].n === 2, 'the last raids, newest first, with place, people and points ' + J(r.list));
  const b = await rec(B);
  check(b.joined === 3 && b.won === 3 && b.mvp === 2 && b.list.every(x => x.won), 'each one sees only their own');
  const e = await rec(E);
  check(e.joined === 3 && e.won === 2, 'a linked phone sees the same person\'s record');
  const ti = Object.fromEntries(r.titles.map(x => [x.k, x]));
  check(ti.raid_hunter.n === 1 && ti.raid_mvp.n === 1 && ti.raid_veteran.n === 2 && ti.raid_veteran.goal === 10 && ti.raid_all.n === 2 && ti.raid_all.goal === 6, 'how far each title is ' + J(r.titles));
}

// ---------- taking and wearing ----------
{
  const b0 = await bal(A);
  const c = await claim(A, 'raid_hunter');
  check(c.ok && c.pts === 30 && c.title === 'raid_hunter' && c.bal === b0 + 30, 'a done title pays once and is worn at once ' + J(c));
  check((await claim(A, 'raid_hunter')).err === 'already' && await bal(A) === b0 + 30, 'and only once');
  check((await claim(E, 'raid_hunter')).err === 'already', 'not again from a linked phone');
  check((await claim(A, 'raid_veteran')).err === 'not_done', 'ten beaten raids are not done with two');
  const m = await claim(A, 'raid_mvp');
  check(m.ok && m.pts === 80 && m.title === 'raid_hunter', 'a second title keeps the one worn');
  check((await wear(A, 'raid_mvp')).title === 'raid_mvp', 'a raid title is worn like a set title');
  check((await wear(B, 'raid_mvp')).err === 'not_yours', 'nobody wears a title they have not taken');
  const tl = await rpc(B, `select public.live_titles($1) r`, [[A]]);
  check(tl[A] === 'raid_mvp', 'others see the raid title');
  const r = await rec(A);
  check(r.title === 'raid_mvp' && r.titles.find(x => x.k === 'raid_hunter').got && r.titles.find(x => x.k === 'raid_mvp').got && !r.titles.find(x => x.k === 'raid_all').got, 'the record says what is taken and worn');
  // all six monsters
  for (const [i, sp] of [[105, 'tarpon'], [106, 'ishidai'], [107, 'ishigakidai'], [108, 'hiramasa']]) await past(i, sp, true, B, [[B, 300], [A, 50]]);
  const r2 = await rec(A);
  check(r2.titles.find(x => x.k === 'raid_all').n === 6 && r2.won === 6, 'all six monsters beaten ' + J(r2.dex));
  check((await claim(A, 'raid_all')).pts === 200, 'the conqueror title pays 200');
  check((await rpc(A, `select public.live_sets() r`)).title === 'raid_mvp', 'the set list shows the raid title worn');
}

// ---------- leaving ----------
{
  await q(`delete from auth.users where id = $1`, [A]);
  check(!(await q(`select 1 from private.live_title where acct = $1`, [A])).rows.length, 'when an account goes, its title goes too');
}
console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
