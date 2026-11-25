// 0026 도감 세트 and 칭호: sets of fish counted by the server from the fish book (a season set: catches in those months,
// Korean dates), paid once, and a title that can be worn and is seen on the weekly board.
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
const sets = uid => rpc(uid, `select public.live_sets() r`);
const claim = (uid, k) => rpc(uid, `select public.live_set_claim($1) r`, [k]);
const wear = (uid, k) => rpc(uid, `select public.live_title_set($1) r`, [k]);
const bal = async uid => +((await q(`select bal from public.zp_wallets where acct = $1`, [uid])).rows[0] || { bal: 0 }).bal;
const one = (r, k) => r.sets.find(s => s.k === k);
// a fish in the book (as live_land writes it): the dex line and the catch; at: when (timestamptz text)
const put = async (uid, sp, at = null) => {
  await q(`insert into public.live_dex as x (acct, sp, n, best) values ($1, $2, 1, 30) on conflict (acct, sp) do update set n = x.n + 1`, [uid, sp]);
  await q(`insert into public.live_catches (acct, sp, cm, tier, big, score, pts, onsite, gx, gy, wk, created_at) values ($1, $2, 30, 2, false, 100, 0, true, 1, 1, private.zp_week(), coalesce($3::timestamptz, now()))`, [uid, sp, at]);
};

// ---------- who may ask ----------
{
  check(/permission denied|not_signed_in/.test(await fails(() => asRole('anon', '', () => q(`select public.live_sets()`))) || ''), 'a visitor who is not signed in cannot ask');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.live_sets`))) || ''), 'the set table is private');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select * from private.live_title`))) || ''), 'the title table is private');
  check(/permission denied/.test(await fails(() => as(A, () => q(`select private.live_set_have($1, 'rock')`, [A]))) || ''), 'the counting is private');
  check((await claim(D, 'rock')).err === 'no_profile', 'no points without a profile');
  check((await claim(A, 'nope')).err === 'no_set', 'an unknown set is refused');
}

// ---------- every set is sound: fish the game knows and can land ----------
{
  const r = (await q(`select s.k, u.sp, x.id from private.live_sets s cross join unnest(s.sps) u(sp) left join public.live_species x on x.id = u.sp where s.kind = 'fish'`)).rows;
  check(r.every(x => x.id), 'every fish in a set is one the game knows ' + J(r.filter(x => !x.id)));
  const far = (await q(`select s.k, u.sp from private.live_sets s cross join unnest(s.sps) u(sp) join public.live_species x on x.id = u.sp where s.kind = 'fish' and x.water = 'S' and x.zone not in ('shore','coast','brack','shelf')`)).rows;
  check(!far.length, 'no set asks for a far-sea fish that can never be landed ' + J(far));
  const s0 = await sets(A);
  check(s0.sets.length === 12 && s0.sets.every(s => s.n === 0 && !s.got && s.have.length === 0) && s0.title === null, 'at first nothing is done and no title is worn ' + J(s0.sets.length));
  check(s0.mo >= 1 && s0.mo <= 12, 'the Korean month comes along');
}

// ---------- a set any time of year ----------
{
  await put(A, 'kurodai'); await put(A, 'mejina'); await put(A, 'kurodai');
  let r = one(await sets(A), 'rock');
  check(r.n === 2 && r.have.length === 2 && r.need === 3, 'two different fish of the set count as two (the same fish twice counts once) ' + J(r));
  check((await claim(A, 'rock')).err === 'not_done', 'a set that is not done pays nothing');
  await put(A, 'ishidai'); // live_land writes it under the account, whichever device
  r = one(await sets(E), 'rock');
  check(r.n === 3, "A's linked phone sees A's sets " + J(r));
  const b0 = await bal(A), c = await claim(E, 'rock');
  check(c.ok && c.pts === 80 && c.title === 'rock' && await bal(A) === b0 + 80, 'a done set pays its points once and its title is worn at once ' + J(c));
  check((await claim(A, 'rock')).err === 'already' && await bal(A) === b0 + 80, 'the second time pays nothing');
  check(one(await sets(A), 'rock').got && (await sets(A)).title === 'rock', 'the set shows as taken and the title as worn');
  check(one(await sets(B), 'rock').n === 0, "another angler's fish book is their own");
}

// ---------- a season set: only catches in those months (Korean dates) ----------
{
  // winter: December to February. A Korean 1 December 00:30 is still 30 November in UTC.
  const y = new Date().getUTCFullYear() - 1;
  await put(B, 'mebaru', `${y}-11-30T15:30:00Z`); // 1 Dec 00:30 in Korea: winter
  await put(B, 'hokke', `${y + 1}-02-28T10:00:00Z`); // winter
  await put(B, 'usumebaru', `${y}-11-30T14:30:00Z`); // 30 Nov 23:30 in Korea: autumn, not winter
  await put(B, 'nishin', `${y}-07-10T10:00:00Z`); // summer
  let r = one(await sets(B), 'winter');
  check(r.n === 2 && r.have.includes('mebaru') && r.have.includes('hokke') && r.m0 === 12 && r.m1 === 2, 'only fish caught in the season count, by the Korean date ' + J(r));
  await put(B, 'magarei', `${y}-12-20T10:00:00Z`);
  check((await claim(B, 'winter')).err === 'not_done', 'three of four is not done');
  await put(B, 'wakasagi', `${y + 1}-01-05T10:00:00Z`);
  const c = await claim(B, 'winter');
  check(c.ok && c.pts === 50, 'four winter fish: the winter set is done ' + J(c));
  check(one(await sets(B), 'autumn').n === 0, 'a fish in the book from the wrong season does not count for another season unless it is in that list');
}

// ---------- wearing a title ----------
{
  check((await wear(A, 'winter')).err === 'not_yours', "a title of a set I have not done can't be worn");
  check((await wear(A, 'rock')).title === 'rock', 'my own title can be worn');
  check((await wear(A, '')).title === null && (await sets(A)).title === null, 'and taken off');
  await wear(A, 'rock');
  const tt = await rpc(B, `select public.live_titles($1::uuid[]) r`, [[A, B, D]]);
  check(tt[A] === 'rock' && tt[B] === 'winter' && !(D in tt), 'the board can see which title each angler wears (only those who wear one) ' + J(tt));
  const many = Array.from({ length: 80 }, () => A);
  check(Object.keys(await rpc(B, `select public.live_titles($1::uuid[]) r`, [many])).length <= 50, 'a long list is cut short');
}

// ---------- leaving takes the title away ----------
{
  await q(`delete from auth.users where id = $1`, [B]);
  check(!(await q(`select 1 from private.live_title where acct = $1`, [B])).rows.length, 'when an account goes, its title goes too');
}
console.log(`${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
