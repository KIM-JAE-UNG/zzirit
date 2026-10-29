// 0013 live chat (open chat, 1:1 between friends, the operator's tools, deleting board posts as the operator, phone notices
// for 1:1 messages) and 0014 leaving the app, on a database with every migration.
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
// the same table rights the live database has (Supabase grants table rights broadly; the migrations narrow them)
await db.exec(`grant usage on schema private to service_role;`);
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const D = '44444444-4444-4444-4444-444444444444', E = '55555555-5555-5555-5555-555555555555', E2 = '55555555-5555-5555-5555-555555555556';
const N = '66666666-6666-6666-6666-666666666666', ADM = '99999999-9999-9999-9999-999999999999';
await q(`insert into auth.users values ($1),($2),($3),($4),($5),($6),($7),($8)`, [A, B, C, D, E, E2, N, ADM]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  ✗', m); } };
const asRole = async (role, uid, fn) => { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid || ''}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const as = (uid, fn) => asRole('authenticated', uid, fn);
const srv = fn => asRole('service_role', '', fn);
const fails = async fn => { try { await fn(); return null; } catch (e) { return e.message.split('\n')[0]; } };
const J = JSON.stringify, now = Date.now();
// A and B are friends (B accepted after A asked); A asked C (no answer yet); E is friends with A and has a login ID; D is A's phone
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10)`, [
  A, J({ nick: 'Ann', fr: { [B]: ['r', now - 5000], [C]: ['r', now - 4000], [E]: ['a', now - 1000] }, catches: [] }),
  B, J({ nick: 'Bob', fr: { [A]: ['a', now - 3000] }, catches: [] }),
  C, J({ nick: 'Cy', catches: [] }),
  E, J({ nick: 'Eve', fr: { [A]: ['r', now - 2000] }, team: { id: A, ts: now }, catches: [{ id: 'e1', sp: 'kurodai', len: 30, ts: now, st: 'ok' }] }),
  ADM, J({ nick: '재웅', catches: [] })
]);
await q(`insert into private.links (member, owner) values ($1, $2), ($3, $4)`, [D, A, E2, E]);
await q(`insert into public.app_admins (uid) values ($1)`, [ADM]);
await q(`insert into public.teams (id, data) values ($1, $2)`, [A, J({ name: '부산팀', members: { [E]: now, [B]: now } })]);
await q(`insert into private.logins (name, owner, pass) values ('evefish', $1, extensions.crypt('secret12', extensions.gen_salt('bf', 4)))`, [E]);
await q(`insert into public.board (id, data) values ($1, $2), ($3, $4)`, [
  C, J({ v: 1, posts: [{ id: 'p1', title: 'first', body: 'x', ts: now }, { id: 'p2', title: 'second', body: 'y', ts: now }, { id: 'p3', title: 'third', body: 'z', ts: now }], cmts: [{ id: 'c1', p: C + '|p1', body: 'hi', ts: now }], likes: [], reps: [] }),
  B, J({ v: 1, posts: [], cmts: [{ id: 'cb', p: C + '|p1', body: 'nice', ts: now }, { id: 'cb2', p: C + '|p2', body: 'ok', ts: now }], likes: [], reps: [] })
]);

/* ---------- friends, as the server sees them ---------- */
const fr = async (x, y) => (await q(`select private.are_friends($1, $2) f`, [x, y])).rows[0].f;
check(await fr(A, B) && await fr(B, A), 'a request answered later is a friendship');
check(!(await fr(A, C)), 'a request with no answer is not');
check(await fr(A, E), 'both asked: friends');
check(!(await fr(A, N)) && !(await fr(A, A)), 'nobody / myself: not friends');
await q(`update public.anglers set data = jsonb_set(data, '{fr,${A}}', $1) where id = $2`, [J(['a', now - 9000]), B]);
check(!(await fr(A, B)), 'an accept older than the request does not count');
await q(`update public.anglers set data = jsonb_set(data, '{fr,${A}}', $1) where id = $2`, [J(['a', now - 3000]), B]);

/* ---------- the open chat ---------- */
const say = (uid, body, extra = {}) => as(uid, () => q(`insert into public.chat (room, body, uid, nick) values ($1, $2, $3, $4) returning id, uid, nick, body`, [extra.room || 'all', body, extra.uid || uid, extra.nick || 'x']));
let r = await say(A, '  안녕하세요   갯바위 갈 사람?  ', { uid: B, nick: '운영자' });
check(r.rows[0].uid === A && r.rows[0].nick === 'Ann' && r.rows[0].body === '안녕하세요 갯바위 갈 사람?', 'the server writes who said it (name from the profile), whatever the app sends: ' + J(r.rows[0]));
const firstId = r.rows[0].id;
check(/no_profile/.test(await fails(() => say(N, 'hello'))), 'no profile, no chat');
check(/no_links/.test(await fails(() => say(A, '여기 보세요 https://scam.example'))) && /no_links/.test(await fails(() => say(A, 'bit.ly/abc 클릭'))), 'links refused in the open chat');
check(/no_phone/.test(await fails(() => say(A, '연락주세요 010-1234-5678'))), 'phone numbers refused');
check(await fails(() => say(A, 'x'.repeat(201))) !== null, 'at most 200 characters');
check(/not_signed_in/.test(await fails(() => asRole('authenticated', '', () => q(`insert into public.chat (body) values ('hi')`)))), 'signed-out: refused');
check((await fails(() => asRole('anon', '', () => q(`select * from public.chat`)))) !== null, 'not readable without signing in');
for (let i = 0; i < 6; i++) await say(B, 'msg ' + i);
check(/slow_down/.test((await fails(() => say(B, 'one more'))) || ''), 'a 7th message within 15 seconds: slow down');
r = await as(C, () => q(`select id, nick from public.chat order by id`));
check(r.rows.length >= 5 && r.rows[0].nick === 'Ann', 'everyone signed in reads the open chat');
// the operator
check(/not_admin/.test(await fails(() => as(A, () => q(`select public.chat_hide($1, true)`, [firstId])))), 'only the operator hides messages');
check((await fails(() => as(A, () => q(`update public.chat set hidden = true where id = $1`, [firstId])))) !== null, 'nobody else can flip "hidden" by hand');
check((await as(ADM, () => q(`select public.chat_hide($1, true) h`, [firstId]))).rows[0].h === true, 'the operator hides one');
check(!(await as(C, () => q(`select id from public.chat where id = $1`, [firstId]))).rows.length && (await as(ADM, () => q(`select id from public.chat where id = $1`, [firstId]))).rows.length === 1, 'hidden: gone for others, still there for the operator');
check(/not_admin/.test(await fails(() => as(B, () => q(`select public.chat_mute($1, 10)`, [A])))), 'only the operator mutes');
await as(ADM, () => q(`select public.chat_mute($1, 10)`, [D])); // muting a linked phone mutes the account
check(/muted/.test(await fails(() => say(A, 'can I talk?'))), 'muted (through a linked device): cannot post');
check((await as(A, () => q(`select public.chat_my_mute() m`))).rows[0].m !== null, 'the muted person can see until when');
check((await as(ADM, () => q(`select * from public.chat_mutes()`))).rows.some(x => x.acct === A), 'the operator sees who is muted');
await as(ADM, () => q(`select public.chat_mute($1, 0)`, [A]));
check(!(await fails(() => say(A, 'back again'))), 'mute ended with 0 minutes');
check(/cannot_mute_self/.test(await fails(() => as(ADM, () => q(`select public.chat_mute($1, 5)`, [ADM])))), 'the operator cannot mute themself');
await q(`update public.chat set created_at = now() - interval '4 days' where id = $1`, [firstId]);
check(!(await as(ADM, () => q(`select id from public.chat where id = $1`, [firstId]))).rows.length, 'older than 3 days: not served');

/* ---------- 1:1 between friends ---------- */
const dm = (uid, peer, body, extra = {}) => as(uid, () => q(`insert into public.dm (a, b, sender, body) values ($1, $2, $3, $4) returning id, a, b, sender`, [extra.a || peer, extra.b || uid, extra.sender || uid, body]));
r = await dm(B, A, '내일 몇 시?', { sender: C });
const lo = A < B ? A : B, hi = A < B ? B : A;
check(r.rows[0].a === lo && r.rows[0].b === hi && r.rows[0].sender === B, 'pair stored in order, sender is whoever is signed in: ' + J(r.rows[0]));
const dmId = r.rows[0].id;
check((await as(A, () => q(`select id from public.dm`))).rows.length === 1 && (await as(B, () => q(`select id from public.dm`))).rows.length === 1, 'both friends read it');
check((await as(C, () => q(`select id from public.dm`))).rows.length === 0 && (await as(ADM, () => q(`select id from public.dm`))).rows.length === 0, 'nobody else does (not even the operator)');
check(/not_friends/.test(await fails(() => dm(A, C, 'hi'))), 'not friends yet: refused');
check(/bad_peer/.test(await fails(() => dm(A, B, 'x', { a: C, b: N }))), 'a pair without me: refused');
r = await dm(D, B, 'from my phone');
check(r.rows[0].sender === A, 'a linked phone writes as the account');
check(/bad_peer/.test(await fails(() => dm(D, A, 'to myself'))), 'no messages to myself (through a linked device)');
check((await fails(() => asRole('anon', '', () => q(`select * from public.dm`)))) !== null, '1:1 not readable without signing in');

/* ---------- phone notices for 1:1 ---------- */
r = await srv(() => q(`select public.push_check($1, 'dm', $2) e`, [B, String(dmId)]));
check(r.rows[0].e && r.rows[0].e.to === A && r.rows[0].e.nick === 'Bob' && r.rows[0].e.url === '#chat', 'a notice for the other person: ' + J(r.rows[0].e));
check((await srv(() => q(`select public.push_check($1, 'dm', $2) e`, [A, String(dmId)]))).rows[0].e === null, 'only the sender can ask for it');
await q(`update public.dm set created_at = now() - interval '1 hour' where id = $1`, [dmId]);
check((await srv(() => q(`select public.push_check($1, 'dm', $2) e`, [B, String(dmId)]))).rows[0].e === null, 'not for an old message');
check((await fails(() => as(B, () => q(`select public.push_check($1, 'dm', $2)`, [B, String(dmId)])))) !== null, 'the app itself cannot run the check');

/* ---------- board: the operator deletes a post or comment for good ---------- */
check(/not_admin/.test(await fails(() => as(A, () => q(`select public.board_admin_remove($1, 'post', 'p1')`, [C])))), 'only the operator');
check((await as(ADM, () => q(`select public.board_admin_remove($1, 'post', 'p2') r`, [C]))).rows[0].r === true, 'the operator deletes a post');
let bd = (await q(`select data from public.board where id = $1`, [C])).rows[0].data;
check(bd.posts.map(p => p.id).join() === 'p1,p3' && bd.cmts.length === 1, 'just that post; the others keep their order: ' + bd.posts.map(p => p.id).join());
check((await as(ADM, () => q(`select public.board_admin_remove($1, 'cmt', 'cb') r`, [B]))).rows[0].r === true, 'and a comment');
bd = (await q(`select data from public.board where id = $1`, [B])).rows[0].data;
check(bd.cmts.map(c => c.id).join() === 'cb2', 'just that comment');
check((await as(ADM, () => q(`select public.board_admin_remove($1, 'post', 'nope') r`, [C]))).rows[0].r === false && (await as(ADM, () => q(`select public.board_admin_remove($1, 'bad', 'p1') r`, [C]))).rows[0].r === false, 'nothing to delete: false');

/* ---------- live updates ---------- */
r = await q(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('chat', 'dm') order by 1`);
check(r.rows.map(x => x.tablename).join() === 'chat,dm', 'chat and 1:1 are live');

/* ---------- leaving (0014) ---------- */
await say(E, '저 탈퇴해요');
await dm(E, A, '그동안 고마웠어요');
check((await as(E, () => q(`select public.delete_my_account('wrong') r`))).rows[0].r.err === 'wrong', 'with a login ID the password is asked again');
check((await as(ADM, () => q(`select public.delete_my_account(null) r`))).rows[0].r.err === 'admin', 'an operator account cannot remove itself');
r = await as(E2, () => q(`select public.delete_my_account('secret12') r`)); // from the linked second device
check(r.rows[0].r.ok === true, 'right password: removed');
check((await q(`select count(*)::int n from auth.users where id in ($1, $2)`, [E, E2])).rows[0].n === 0, 'the account and its linked device are gone');
check(!(await q(`select 1 from public.anglers where id = $1`, [E])).rows.length && !(await q(`select 1 from private.logins where name = 'evefish'`)).rows.length, 'profile and login ID gone');
check(!(await q(`select 1 from public.chat where uid = $1`, [E])).rows.length && !(await q(`select 1 from public.dm where sender = $1`, [E])).rows.length, 'their chat and 1:1 messages gone');
const aFr = (await q(`select data -> 'fr' f from public.anglers where id = $1`, [A])).rows[0].f;
const team = (await q(`select data -> 'members' m from public.teams where id = $1`, [A])).rows[0].m;
check(!(E in aFr) && (B in aFr) && !(E in team) && (B in team), 'removed from friends lists and team rosters, others untouched');
r = await as(N, () => q(`select public.delete_my_account(null) r`)); // no profile, no ID: still allowed
check(r.rows[0].r.ok === true && !(await q(`select 1 from auth.users where id = $1`, [N])).rows.length, 'an account without an ID can leave too');
check((await fails(() => asRole('anon', '', () => q(`select public.delete_my_account(null)`)))) !== null, 'not callable signed out');

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
