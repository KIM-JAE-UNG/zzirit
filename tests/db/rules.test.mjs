// 0007b–0009: login IDs, operator help, order rules, the reviewer's queue, fishing points (0007b, no records touched),
// confirm-first payments and the reset (0008), account deletion (0009).
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
const files = fs.readdirSync(M).sort();
const apply = async f => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('applied', f); } catch (e) { console.log('FAILED', f, e.message); process.exit(1); } };
for (const f of files.filter(f => f < '0008' && !f.includes('_schedule'))) await apply(f); // pg_net / pg_cron are not in this test database
const grants = async () => {
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant all on all tables in schema public to service_role; grant usage on schema private to service_role;`);
  await db.exec(`revoke all on public.app_admins, public.ai_tickets, public.ai_usage from anon, authenticated; revoke insert, update, delete on public.spots, public.news from anon, authenticated;`);
  // same table rights as 0007b sets on the live database
  await db.exec(`revoke all on public.reviews from anon, authenticated; grant select on public.reviews to authenticated; revoke all on public.points from anon;`);
};
await grants();
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const T = '18b48144-b816-4039-9379-6f7d00e5f2ce', Z = '00000000-0000-0000-0000-000000000000';
const D = '44444444-4444-4444-4444-444444444444', E = '55555555-5555-5555-5555-555555555555', ADM = '99999999-9999-9999-9999-999999999999';
const ADM2 = '99999999-9999-9999-9999-999999999998', F = '66666666-6666-6666-6666-666666666666', G = '77777777-7777-7777-7777-777777777777';
await q(`insert into auth.users values ($1),($2),($3),($4),($5),($6),($7),($8),($9),($10)`, [A, B, C, T, D, E, ADM, ADM2, F, G]);
let ok = 0, bad = 0; const check = (c, m) => { if (c) { ok++; } else { bad++; console.log('  ✗', m); } };
async function as(uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } }
const J = JSON.stringify; const now = Date.now();
const get = async (tbl, id) => (await q(`select data from public.${tbl} where id = $1`, [id])).rows[0]?.data;

/* ---------- data before the reset (written as the server, like the live database today) ---------- */
await q(`insert into public.anglers (id, data) values ($1, $2), ($3, $4), ($5, $6)`, [
  A, J({ nick: 'Ann', cc: 'KR', fr: { [B]: ['a', now] }, lvSeen: 5, pic: 123, av: 'pic', flair: { gold: true, frame: true }, decor: { theme: 'th_aurora', items: ['dc_weed', 'dc_turtle'], fx: ['fx_plankton'] },
    char: { hs: 'wave', hc: 7, ey: 'happy', mo: 'tongue', ht: 'captain', ou: 'vest', ac: 'lamp', rd: 'gold', bg: '#FFE1CC', sk: 2 }, catches: [{ id: 'a1', sp: 'kurodai', len: 40, ts: now - 864e5, st: 'ok', tr: 90 }] }),
  B, J({ nick: 'Bob', cc: 'KR', flair: { gold: true }, decor: { theme: 'th_palace', items: ['dc_goldboat'], fx: ['fx_sparkle'] }, catches: [{ id: 'b1', sp: 'madai', len: 50, ts: now - 864e5, st: 'ok', tr: 90 }] }),
  C, J({ nick: 'Cy', cc: 'JP', catches: [] })
]);
await q(`insert into public.orders (id, data) values ($1, $2), ($3, $4)`, [
  A, J({ items: [{ id: 'g1', kind: 'item', ref: 'fl_gold', amt: 500 }, { id: 's1', kind: 'item', ref: 'bd_starter', amt: 1500 }, { id: 'w1', kind: 'item', ref: 'fl_wave', amt: 1000 }, { id: 'x1', kind: 'item', ref: 'th_aurora', amt: 2000 }, { id: 'p1', kind: 'past', amt: 500 }] }),
  B, J({ items: [{ id: 'bg', kind: 'item', ref: 'pr_gold', amt: 500, code: 'ZZ-AAAA' }, { id: 'bp', kind: 'item', ref: 'th_palace', amt: 500 }, { id: 'bd', kind: 'donate', amt: 500 }, { id: 'bx', kind: 'item', ref: 'dc_jelly', amt: 1000 }, { id: 'bn', kind: 'donate', amt: 500 }] })
]);
await q(`insert into public.admin_docs (id, data) values ('grants', $1), ('verdicts', $2)`, [J({ [A]: { g1: 'ok', s1: 'ok', w1: 'ok', x1: 'no', p1: 'no' }, [B]: { bn: 'no' } }), J({ [A]: { a1: 'ok' } })]);
await q(`insert into public.photos (angler, cid, data) values ($1, 'a1', '{"t":"x"}'), ($1, '_pic', '{"t":"p"}'), ($2, 'b1', '{"t":"y"}')`, [A, B]);
await q(`insert into public.labels (id, data) values ($1, '{"items":[{"p":"a","a":"b"}]}')`, [A]);
await q(`insert into public.board (id, data) values ($1, $2)`, [C, J({ v: 1, posts: [{ id: 'pc', title: 'hi', body: 'x', ts: now }], cmts: [], likes: [], reps: [] })]);
await q(`insert into public.ai_usage (uid, day, kind, n) values ($1, (now() at time zone 'Asia/Seoul')::date, 'image', 6), ($2, (now() at time zone 'Asia/Seoul')::date, 'image', 6), ($1, (now() at time zone 'Asia/Seoul')::date, 'text', 2), ($2, (now() at time zone 'Asia/Seoul')::date, 'text', 2)`, [T, Z]);
await q(`insert into public.ai_tickets (nonce, uid, verdict) values (gen_random_uuid(), $1, 'pass')`, [T]);

/* ---------- the migrations ---------- */
await apply('0008_paid_confirm_reset.sql');
await apply('0009_review_admin_ids.sql');
await apply('0011_restore_functions.sql');   // the same code again (put back on the live server after an old copy ran)
await apply('0012_restore_link_redeem.sql');
await grants();
await q(`insert into public.app_admins (uid) values ($1), ($2)`, [ADM, ADM2]);
let r;
let a = await get('anglers', A), b = await get('anglers', B), c = await get('anglers', C);
check(a.catches.length === 0 && b.catches.length === 0, 'catches cleared');
check(a.decor.theme === 'th_dawn' && a.decor.items.join() === 'dc_weed,dc_rock,dc_buoy' && a.decor.fx.join() === 'fx_bubbles', 'decor back to default');
check(JSON.stringify(a.flair) === '{}' && JSON.stringify(b.flair) === '{}', 'flair (gold name, frame) cleared');
check(!('lvSeen' in a) && !('own' in a) && !('own' in b), 'level marker cleared, nothing carried over');
check(a.nick === 'Ann' && a.pic === 123 && a.av === 'pic' && a.fr[B][0] === 'a' && c.nick === 'Cy', 'profile, photo choice and friends kept');
check(a.char.hs === 'short' && a.char.hc === 0 && a.char.ey === 'happy' && a.char.mo === 'smile' && a.char.ht === 'cap' && a.char.ou === 'vest' && a.char.ac === 'none' && a.char.rd === 'carbon' && a.char.bg === '#FFE1CC' && a.char.sk === 2, 'character: locked parts back to default, free parts kept: ' + J(a.char));
r = await q(`select cid from public.photos order by cid`); check(r.rows.length === 1 && r.rows[0].cid === '_pic', 'only profile photos remain');
r = await q(`select (select count(*)::int from public.labels) l, (select count(*)::int from public.spots) s, (select count(*)::int from public.ai_tickets) t, (select count(*)::int from public.orders) o`);
check(r.rows[0].l === 0 && r.rows[0].s === 0 && r.rows[0].t === 0, 'labels, spots, tickets cleared');
check(r.rows[0].o === 0, 'all orders removed (nobody paid)');
check(JSON.stringify(await get('admin_docs', 'verdicts')) === '{}' && JSON.stringify(await get('admin_docs', 'grants')) === '{}', 'decisions cleared');
r = await get('admin_docs', 'config'); check(r && r.notice && /^rs\d{8}$/.test(r.notice.id) && /초기화했어요/.test(r.notice.t) && r.notice.t.length <= 400 && r.notice.ts > 0, 'a notice about the reset is posted once it has really run');
check(r && typeof r.resetAt === 'number' && Math.abs(r.resetAt - Date.now()) < 600000, 'the reset time is written down (phones do not upload older records again): ' + (r && r.resetAt));
r = await q(`select count(*)::int n from auth.users where id = $1`, [T]); check(r.rows[0].n === 0, 'test account removed');
r = await q(`select coalesce(sum(n), 0)::int n from public.ai_usage`); check(r.rows[0].n === 0, 'test usage removed');
r = await q(`select (select count(*)::int from public.board) b`); check(r.rows[0].b === 1, 'posts kept');
r = await q(`select coalesce(current_setting('zz.trusted', true), '') v`); check(r.rows[0].v === '', 'trusted flag switched off after the migration');
r = await q(`select en, sci, ko from private.species_names where id = 'kurodai'`); check(r.rows[0].en === 'Black porgy' && r.rows[0].ko === '감성돔', 'species names on the server');
r = await q(`select count(*)::int n from private.species_names`); check(r.rows[0].n === 106, 'all 106 species named');

/* ---------- paid looks need a confirmed order ---------- */
const lookGold = J({ flair: { gold: true }, decor: { theme: 'th_palace', items: ['dc_goldboat'], fx: ['fx_sparkle'] }, char: { rd: 'gold' } });
await as(B, async () => { await q(`insert into public.orders (id, data) values ($1, $2)`, [B, J({ items: [{ id: 'bg', kind: 'item', ref: 'pr_gold', code: 'ZZ-AAAA' }, { id: 'bp', kind: 'item', ref: 'th_palace' }] })]); });
await as(B, async () => { await q(`update public.anglers set data = data || $2 where id = $1`, [B, lookGold]); });
b = await get('anglers', B);
check(b.flair.gold === false && b.decor.theme === 'th_dawn' && !b.decor.items.includes('dc_goldboat') && !b.decor.fx.includes('fx_sparkle') && b.char.rd === 'carbon', '"I sent it" alone gives nothing');
await q(`update public.admin_docs set data = $1 where id = 'grants'`, [J({ [B]: { bg: 'ok' } })]);
await as(B, async () => { await q(`update public.anglers set data = data || $2 where id = $1`, [B, lookGold]); });
b = await get('anglers', B);
check(b.flair.gold === true && b.decor.items.includes('dc_goldboat') && b.char.rd === 'gold', 'confirmed gold set kept');
check(b.decor.theme === 'th_dawn', 'palace still needs its own confirmation');
await as(A, async () => { await q(`update public.anglers set data = data || $2 where id = $1`, [A, J({ flair: { gold: true }, decor: { theme: 'th_dawn', items: ['dc_goldboat'], fx: [] } })]); });
a = await get('anglers', A); check(a.flair.gold === false && !a.decor.items.includes('dc_goldboat'), 'no order, no gold');

/* ---------- `own` cannot be edited by the app ---------- */
await as(C, async () => { await q(`update public.anglers set data = data || $2 where id = $1`, [C, J({ own: ['pr_gold'], flair: { gold: true } })]); });
c = await get('anglers', C); check(!('own' in c) && c.flair.gold === false, 'cannot fake own to get gold');

/* ---------- order rules ---------- */
await as(B, async () => {
  const ob = await get('orders', B);
  const items = ob.items.map(o => o.id === 'bp' ? Object.assign({}, o, { ref: 'pr_gold' }) : o.id === 'bg' ? Object.assign({}, o, { ref: 'th_palace' }) : o);
  await q(`update public.orders set data = $2 where id = $1`, [B, J({ items })]);
});
let ob = await get('orders', B);
check(ob.items.find(o => o.id === 'bg').ref === 'pr_gold' && ob.items.find(o => o.id === 'bp').ref === 'th_palace', 'saved orders cannot be edited');
await q(`update public.admin_docs set data = $1 where id = 'grants'`, [J({ [B]: { bg: 'ok', bn: 'no' } })]);
await as(B, async () => {
  const cur = await get('orders', B);
  const add = [{ id: 'bn', kind: 'donate' }, { id: 'n1', kind: 'item', ref: 'th_palace' }, { id: 'n2', kind: 'item', ref: 'th_aurora' }, { id: 'n3', kind: 'past' }, { id: 'n4', kind: 'donate' }, { id: 'n5', kind: 'donate' }, { id: 'n6', kind: 'donate' }, { id: 'bg', kind: 'donate' }];
  await q(`update public.orders set data = $2 where id = $1`, [B, J({ items: cur.items.concat(add) })]);
});
ob = await get('orders', B); const idsB = ob.items.map(o => o.id);
check(!idsB.includes('n1'), 'second waiting palace order refused (one per item)');
check(!idsB.includes('n2') && !idsB.includes('n3'), 'orders for free items or retired kinds refused');
check(idsB.filter(x => x === 'bg').length === 1 && ob.items.find(o => o.id === 'bg').kind === 'item', 'duplicate ids refused');
check(!idsB.includes('bn'), 'an id the operator already decided on cannot come back');
// waiting before: bp (1) → two more may wait
check(idsB.includes('n4') && idsB.includes('n5') && !idsB.includes('n6'), 'at most 3 orders wait at once: ' + idsB);
const n4 = ob.items.find(o => o.id === 'n4'); check(n4.amt === 500 && typeof n4.ts === 'number', 'new orders normalised');

/* ---------- impossible lengths ---------- */
await as(D, async () => { await q(`insert into public.anglers (id, data) values ($1, $2)`, [D, J({ nick: 'Dee', cc: 'KR', catches: [
  { id: 'd1', sp: 'kurodai', len: 150, ts: now - 3600e3, st: 'review', tr: 50 },
  { id: 'd2', sp: 'kurodai', len: 75, ts: now - 3600e3, st: 'ok', tr: 90 },
  { id: 'd3', sp: 'kurodai', len: 41, ts: now - 3600e3, st: 'review', tr: 40, memo: 'evening' }] })]); });
let d = await get('anglers', D);
check(d.catches.find(x => x.id === 'd1').st === 'no', '150 cm black porgy rejected by the server');
check(d.catches.find(x => x.id === 'd2').st === 'review', 'past-record size goes to review');
await q(`insert into public.photos (angler, cid, data) values ($1, 'd3', '{"t":"data:image/jpeg;base64,AAAA"}')`, [D]);

/* ---------- automatic review ---------- */
await db.exec(`set role service_role;`);
r = await q(`select public.review_claim(60) a, public.review_claim(60) b`); check(r.rows[0].a === true && r.rows[0].b === false, 'review throttle');
r = await q(`select * from public.review_queue(10)`);
const qd3 = r.rows.find(x => x.cid === 'd3'), qd2 = r.rows.find(x => x.cid === 'd2');
check(!!qd3 && qd3.en === 'Black porgy' && Number(qd3.x) === 71 && qd3.photo.startsWith('data:image') && qd3.memo === 'evening', 'queue has the catch, species info and photo');
check(!!qd2 && !qd2.photo, 'queue lists catches without photos too');
check(!r.rows.find(x => x.cid === 'd1'), 'rejected catch not queued');
r = await q(`select public.review_set($1, 'd3', 'ok', '', 'gemini-3.6-flash') a, public.review_set($1, 'd2', 'hold', '기록 크기라 운영자가 확인해요', 'rule') b`, [D]); check(r.rows[0].a === true && r.rows[0].b === true, 'decisions recorded');
r = await q(`select * from public.review_queue(10)`); check(!r.rows.find(x => x.uid === D), 'decided catches leave the queue');
await db.exec(`reset role;`);
let e3 = null;
await q(`update public.admin_docs set data = jsonb_set(data, array[$1::text, 'd2'], '"ok"') where id = 'verdicts'`, [D]);
await db.exec(`set role service_role;`);
r = await q(`select public.review_set($1, 'd2', 'no', 'x', 'm') a`, [D]); check(r.rows[0].a === false, 'operator decision is never overwritten');
await db.exec(`reset role;`);
const vd = await get('admin_docs', 'verdicts'), ar = await get('reviews', D);
check(vd[D].d3 === 'ok' && vd[D].d2 === 'ok' && ar.d2.v === 'hold' && ar.d2.why.length > 0 && ar.d3.v === 'ok', 'verdicts + reasons stored');
r = await as(D, async () => q(`select count(*)::int n from public.reviews`)); check(r.rows[0].n === 1, 'an angler reads their own review notes');
r = await as(A, async () => q(`select count(*)::int n from public.reviews`)); check(r.rows[0].n === 0, 'nobody else reads them');
r = await as(ADM, async () => q(`select count(*)::int n from public.reviews`)); check(r.rows[0].n === 1, 'the operator reads them');
e3 = null; try { await as(D, async () => q(`insert into public.reviews (id, data) values ($1, '{}') on conflict (id) do update set data = '{}'`, [D])); } catch (e) { e3 = e; } check(!!e3, 'app users cannot write review notes');
e3 = null; try { await as(D, async () => q(`select * from public.review_queue(5)`)); } catch (e) { e3 = e; } check(!!e3, 'app users cannot read the review queue');
e3 = null; try { await as(D, async () => q(`select public.review_set($1, 'd1', 'ok', '', '')`, [D])); } catch (e) { e3 = e; } check(!!e3, 'app users cannot record decisions');

/* ---------- login ID ---------- */
const reg = async (uid, n, p) => (await as(uid, async () => q(`select public.id_register($1, $2) r`, [n, p]))).rows[0].r;
const login = async (uid, n, p) => (await as(uid, async () => q(`select public.id_login($1, $2) r`, [n, p]))).rows[0].r;
check((await reg(D, 'ab', 'secret1')).err === 'bad_name', 'too-short ID refused');
check((await reg(D, 'Dee_Fish', '123')).err === 'bad_pass', 'short password refused');
check((await reg(D, 'admin', 'secret12')).err === 'taken', 'reserved ID refused');
r = await reg(D, 'Dee_Fish', 'secret12'); check(r.ok === true && r.name === 'dee_fish', 'ID created (lowercase)');
check((await reg(D, 'another', 'secret12')).err === 'has_id', 'one ID per account');
check((await reg(E, 'dee_fish', 'secret12')).err === 'taken', 'ID already taken');
r = await as(D, async () => q(`select public.id_me() n`)); check(r.rows[0].n === 'dee_fish', 'id_me');
r = await q(`select pass from private.logins where name = 'dee_fish'`); check(r.rows[0].pass.startsWith('$2') && !r.rows[0].pass.includes('secret12'), 'password stored as bcrypt hash');
// E (a new device with its own catch) logs in
await as(E, async () => { await q(`insert into public.anglers (id, data) values ($1, $2)`, [E, J({ nick: 'phone', catches: [{ id: 'e1', sp: 'saba', len: 30, ts: now - 3600e3, st: 'review', tr: 40 }] })]); });
check((await login(E, 'dee_fish', 'wrongpass')).err === 'wrong', 'wrong password refused');
r = await login(E, 'DEE_FISH', 'secret12'); check(r.ok === true && r.acct === D && r.name === 'dee_fish', 'login ok: ' + J(r));
d = await get('anglers', D); check(d.catches.some(x => x.id === 'e1') && d.nick === 'Dee', 'device records joined the account');
r = await as(E, async () => q(`select public.my_acct() a`)); check(r.rows[0].a === D, 'the device now acts as the account');
r = await as(E, async () => q(`select public.id_me() n`)); check(r.rows[0].n === 'dee_fish', 'id_me on the joined device');
// an account with its own ID can't be folded into another one
await reg(C, 'cy_jp', 'secret34');
check((await login(C, 'dee_fish', 'secret12')).err === 'has_id', 'logged-in account cannot join another ID');
// password change + operator reset
r = await as(E, async () => q(`select public.id_password('nope', 'newpass1') r`)); check(r.rows[0].r.err === 'wrong', 'password change needs the old one');
r = await as(E, async () => q(`select public.id_password('secret12', 'newpass1') r`)); check(r.rows[0].r.ok === true, 'password changed');
check((await login(B, 'dee_fish', 'secret12')).err === 'wrong', 'old password no longer works');
let e4 = null; try { await as(B, async () => q(`select public.admin_id_reset('dee_fish', 'hacked1')`)); } catch (e) { e4 = e; } check(!!e4, 'only the operator resets passwords');
r = await as(ADM, async () => q(`select public.admin_id_reset('dee_fish', 'temp1234') r`)); check(r.rows[0].r.ok === true, 'operator reset');
// brute force: 10 tries per device per 10 minutes
let last; for (let i = 0; i < 11; i++) last = await login(B, 'cy_jp', 'bad' + i);
check(last.err === 'slow_down', 'too many wrong tries are slowed down');

/* ---------- operator help: who has which ID, and a code to get a lost account back ---------- */
let e7 = null; try { await as(A, async () => q(`select * from public.admin_logins()`)); } catch (e) { e7 = e; } check(!!e7, 'only the operator lists login IDs');
r = await as(ADM, async () => q(`select acct, name from public.admin_logins()`));
check(r.rows.some(x => x.name === 'dee_fish' && x.acct === D) && r.rows.some(x => x.name === 'cy_jp' && x.acct === C), 'the operator sees which account has which ID');
e7 = null; try { await as(A, async () => q(`select public.admin_link_code($1)`, [F])); } catch (e) { e7 = e; } check(!!e7, 'only the operator makes recovery codes');
await q(`insert into public.anglers (id, data) values ($1, $2)`, [F, J({ nick: 'F old', catches: [{ id: 'f1', sp: 'kurodai', len: 38, ts: now - 864e5 * 3, st: 'ok', tr: 90 }] })]);
await as(F, async () => { await q(`insert into public.points (id, data) values ('fpriv01', $1), ('fpub001', $2)`, [J({ name: '비밀 갯바위', lat: 34.7, lon: 127.7 }), J({ name: '방파제', lat: 35.1, lon: 129.0, pub: true })]); });
r = await q(`select owner, pub from public.points where id = 'fpub001'`); check(r.rows[0].owner === F && r.rows[0].pub === true, 'a point belongs to whoever wrote it; the shared flag comes from its data');
// G starts over on a new device (lost F), writes a catch and a point, then gets F back with the operator's code
await as(G, async () => { await q(`insert into public.anglers (id, data) values ($1, $2)`, [G, J({ nick: 'G new', catches: [{ id: 'g1', sp: 'saba', len: 25, ts: now - 3600e3, st: 'review', tr: 40 }] })]); });
await as(G, async () => { await q(`insert into public.points (id, data) values ('gpriv01', $1)`, [J({ name: '새 포인트' })]); });
r = await as(G, async () => q(`select id from public.points order by id`)); check(r.rows.map(x => x.id).join() === 'fpub001,gpriv01', 'others see only shared points (plus their own)');
r = await as(ADM, async () => q(`select public.admin_link_code($1) c`, [F])); const rc = r.rows[0].c;
check(/^[A-Z2-9]{8}$/.test(rc), 'recovery code made');
r = await as(G, async () => q(`select public.link_redeem($1) r`, [rc])); check(r.rows[0].r.ok === true && r.rows[0].r.acct === F, 'recovery code joins the lost account');
const fdoc = await get('anglers', F); check(fdoc.nick === 'F old' && fdoc.catches.some(x => x.id === 'f1') && fdoc.catches.some(x => x.id === 'g1'), 'old records back, new ones kept');
r = await as(G, async () => q(`select id from public.points order by id`)); check(r.rows.map(x => x.id).join() === 'fpriv01,fpub001,gpriv01', 'points from both devices belong to the account');
r = await as(F, async () => q(`update public.points set data = data || '{"note":"edited"}' where id = 'gpriv01' returning id`)); check(r.rows.length === 1, 'and can be edited from either device');

/* ---------- fishing points: privacy and limits ---------- */
r = await as(A, async () => q(`select id from public.points order by id`)); check(r.rows.map(x => x.id).join() === 'fpub001', 'a stranger sees only the shared point');
await as(A, async () => { await q(`update public.points set data = data || '{"name":"hacked"}' where id = 'fpub001'`); });
r = await q(`select data->>'name' n from public.points where id = 'fpub001'`); check(r.rows[0].n === '방파제', 'nobody else can edit a point');
let e6 = null; try { await as(A, async () => q(`insert into public.points (id, owner, data) values ('afake01', $1, '{"name":"x"}')`, [F])); } catch (e) { e6 = e; } check(!!e6, 'cannot write a point in someone else\'s name');
await as(A, async () => { await q(`delete from public.points where id = 'fpub001'`); });
r = await q(`select count(*)::int n from public.points where id = 'fpub001'`); check(r.rows[0].n === 1, 'nobody else can remove a point');
await as(ADM, async () => { await q(`update public.points set data = data || '{"hidden":true}' where id = 'fpub001'`); });
r = await q(`select data->>'hidden' h from public.points where id = 'fpub001'`); check(r.rows[0].h === 'true', 'the operator can hide a shared point');
e6 = null; try { await as(A, async () => q(`insert into public.points (id, data) values ('Bad id!', '{}')`)); } catch (e) { e6 = e; } check(!!e6, 'point ids are checked');
const bigNote = Array.from({ length: 5000 }, (_, i) => String.fromCharCode(44032 + (i * 7919) % 11172)).join('');
e6 = null; try { await as(A, async () => q(`insert into public.points (id, data) values ('abig001', $1)`, [J({ note: bigNote })])); } catch (e) { e6 = e; } check(!!e6, 'a point is kept small');
await q(`insert into public.points (id, owner, data) select 'acap' || lpad(i::text, 3, '0'), $1, '{}' from generate_series(1, 300) i`, [A]);
e6 = null; try { await as(A, async () => q(`insert into public.points (id, data) values ('acap301', '{}')`)); } catch (e) { e6 = e; } check(!!e6, 'at most 300 points per account');
r = await as(A, async () => q(`update public.points set data = '{"name":"edited"}' where id = 'acap001' returning id`)); check(r.rows.length === 1, 'editing still works at the limit');
await q(`delete from public.points where id like 'acap%'`);

/* ---------- link code still works (now through the shared join) ---------- */
await q(`delete from private.login_tries`);
let code; await as(A, async () => { r = await q(`select public.link_create() c`); code = r.rows[0].c; });
await as(B, async () => { r = await q(`select public.link_redeem($1) r`, [code]); });
check(r.rows[0].r.ok === true && r.rows[0].r.acct === A, 'link code joins: ' + J(r.rows[0].r));
r = await q(`select count(*)::int n from private.link_codes`); check(r.rows[0].n === 0, 'used code removed');
const oa = await get('orders', A); check(oa && oa.items.filter(o => o.id === 'bg').length === 1, 'orders moved with the device, once');

/* ---------- operator deletes an account ---------- */
await as(C, async () => { await q(`insert into public.teams (id, data) values ($1, $2)`, [C, J({ v: 1, name: 'Cy team', members: { [C]: now, [A]: now }, ban: {} })]); });
await as(A, async () => { await q(`update public.anglers set data = data || $2 where id = $1`, [A, J({ team: { id: C, ts: now }, fr: { [D]: ['a', now] } })]); });
let e5 = null; try { await as(A, async () => q(`select public.admin_delete_user($1)`, [D])); } catch (e) { e5 = e; } check(!!e5, 'only the operator deletes accounts');
e5 = null; try { await as(ADM, async () => q(`select public.admin_delete_user($1)`, [ADM])); } catch (e) { e5 = e; } check(!!e5 && /cannot_delete_self/.test(e5.message), 'the account in use cannot delete itself');
r = await as(ADM, async () => q(`select public.admin_delete_user($1) x`, [ADM2])); check(r.rows[0].x === true, 'another operator account can be deleted');
r = await q(`select (select count(*)::int from public.app_admins where uid = $1) a, (select count(*)::int from auth.users where id = $1) u`, [ADM2]); check(r.rows[0].a === 0 && r.rows[0].u === 0, 'its operator rights went with it');
r = await as(ADM, async () => q(`select public.admin_delete_user(null) x`)); check(r.rows[0].x === false, 'a safe empty call (the app uses it to see whether deleting is available)');
r = await as(ADM, async () => q(`select public.admin_delete_user($1) x`, [E])); check(r.rows[0].x === true, 'delete via a linked device id');
r = await q(`select (select count(*)::int from auth.users where id in ($1, $2)) u, (select count(*)::int from public.anglers where id = $1) a, (select count(*)::int from private.logins where name = 'dee_fish') l, (select count(*)::int from public.photos where angler = $1) p`, [D, E]);
check(r.rows[0].u === 0 && r.rows[0].a === 0 && r.rows[0].l === 0 && r.rows[0].p === 0, 'account, devices, profile, login ID and photos gone');
a = await get('anglers', A); check(!(a.fr && a.fr[D]), 'friend edges to the deleted account removed');
r = await as(ADM, async () => q(`select public.admin_delete_user($1) x`, [C])); check(r.rows[0].x === true, 'delete a team leader');
a = await get('anglers', A); check(!a.team, 'members of the deleted team are freed');
r = await q(`select count(*)::int n from public.teams where id = $1`, [C]); check(r.rows[0].n === 0, 'team removed with its leader');
check(!((await get('admin_docs', 'verdicts')) || {})[D], 'operator notes about the account removed');
r = await q(`select count(*)::int n from public.reviews where id = $1`, [D]); check(r.rows[0].n === 0, 'review notes removed with the account');

/* ---------- anon ---------- */
let e1 = null; try { await db.exec(`set role anon; select public.acct();`); } catch (e) { e1 = e; } await db.exec('reset role;'); check(!!e1, 'anon cannot call acct()');
e1 = null; try { await db.exec(`set role anon; select public.id_login('x','y');`); } catch (e) { e1 = e; } await db.exec('reset role;'); check(!!e1, 'anon cannot try logins');
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
