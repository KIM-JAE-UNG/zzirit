// Fake Supabase backend: tables, own-row checks through account links, a trigger-like guard, realtime feed, RPCs
const http = require('http'), fs = require('fs'), path = require('path');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const ROOT = path.resolve(__dirname, '..', '..'), LEAFLET = LIB('leaflet/dist/leaflet.js');
let ver = 1; const events = []; const STATS = { photoSelects: 0 };
const T = { anglers: {}, photos: {}, labels: {}, orders: {}, suggest: {}, admin_docs: {}, spots: {}, board: {}, teams: {}, news: {}, points: {}, reviews: {}, chat: {}, dm: {} };
const FEATURES = { del: true, wd: true, zp: true, live: true };
// live chat: the open chat and 1:1 between friends (the same rules as private.chat_guard / dm_guard), mutes, rate limits
let seq = 100; const MUTES = {}; const RATE = {};
function tryOk(k, max, ms) { const now = Date.now(); const a = (RATE[k] || []).filter(x => now - x < ms); if (a.length >= max) { RATE[k] = a; return false; } a.push(now); RATE[k] = a; return true; }
function areFriends(x, y) {
  if (!x || !y || x === y) return false;
  const ax = T.anglers[x], ay = T.anglers[y]; const xy = ax && ax.data.fr && ax.data.fr[y], yx = ay && ay.data.fr && ay.data.fr[x];
  if (!Array.isArray(xy) || !Array.isArray(yx) || !['r', 'a'].includes(xy[0]) || !['r', 'a'].includes(yx[0])) return false;
  const tx = +xy[1] || 0, ty = +yx[1] || 0;
  if (xy[0] === 'a' && yx[0] === 'r') return tx >= ty; if (xy[0] === 'r' && yx[0] === 'a') return ty >= tx; return true;
}
// park rooms: who is in each topic (presence) and a queue of messages per client; clients that stop polling drop out
const RT = {}, RTQ = {}, RTSEEN = {}; const RTSTATS = { sent: 0, delivered: 0 };
function rtState(topic) { const st = {}; for (const [cid, m] of RT[topic] || []) if (m.payload) (st[m.key] = st[m.key] || []).push(Object.assign({ presence_ref: cid }, m.payload)); return st; }
function rtSync(topic) { const st = rtState(topic); for (const cid of (RT[topic] || new Map()).keys()) (RTQ[cid] = RTQ[cid] || []).push({ topic, type: 'presence', state: st }); }
setInterval(() => { const now = Date.now(); for (const [topic, m] of Object.entries(RT)) { let ch = false; for (const cid of [...m.keys()]) if (now - (RTSEEN[cid] || 0) > 3000) { m.delete(cid); ch = true; } if (ch) rtSync(topic); } }, 1000);
// 찌릿 포인트 (the same rules as migration 0016): wallets, the book, owned lures, the weekly 챔질 반응속도 board, runs that
// start here and are checked when they end, prizes paid once per finished week (300 / 200 / 100, 20 for playing, gold lure)
const ZPS = { wal: {}, led: [], owned: {}, scores: {}, runs: {}, settled: {}, seq: 0, items: [['spoon', 100], ['vib', 150], ['egi', 200], ['tai', 300], ['jig', 800], ['minnow', 1000], ['gold', null], ['rod_iso', 150], ['rod_wine', 250], ['rod_spark', 900], ['rod_bolt', 1200], ['reel_red', 180], ['reel_lbr', 250], ['reel_spark', 900], ['reel_bolt', 1200], ['float_ball', 100], ['float_led', 200], ['float_spark', 800], ['float_bolt', 1000]] };
function zpWeek(ms = Date.now()) { const d = new Date(ms + 9 * 3600e3); const off = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - off)).toISOString().slice(0, 10); }
const zpAddDays = (wk, n) => new Date(Date.parse(wk + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
function zpAdd(acct, d, r, ref, n) {
  if (ZPS.led.some(x => x.acct === acct && x.r === r && x.ref === ref)) return false;
  const w = ZPS.wal[acct] || (ZPS.wal[acct] = { bal: 0, earned: 0 });
  if (w.bal + d < 0) throw new Error('not_enough');
  w.bal += d; if (d > 0) w.earned += d;
  ZPS.led.push({ id: ++ZPS.seq, acct, d, r, ref, n: n || '', at: new Date().toISOString() }); return true;
}
function zpBoard(game, wk) {
  const rows = Object.values(ZPS.scores).filter(x => x.game === game && x.wk === wk && !x.void).sort((a, b) => a.score - b.score || (a.best == null ? 1e9 : a.best) - (b.best == null ? 1e9 : b.best) || a.at - b.at);
  return rows.map((x, i) => ({ a: x.acct, s: x.score, b: x.best == null ? null : x.best, r: i + 1, n: rows.length }));
}
function zpAward(game, wk) {
  if (Date.now() < Date.parse(wk + 'T00:00:00+09:00') + 7 * 864e5 + 60e3 || ZPS.settled[game + wk]) return 0;
  ZPS.settled[game + wk] = true; const ref = game + ':' + wk;
  for (const x of zpBoard(game, wk)) {
    if (x.r <= 3) { zpAdd(x.a, [300, 200, 100][x.r - 1], 'prize', ref, String(x.r)); if (x.r === 1) (ZPS.owned[x.a] = ZPS.owned[x.a] || []).includes('gold') || ZPS.owned[x.a].push('gold'); }
    else zpAdd(x.a, 20, 'join', ref, '');
  }
  return 1;
}
const zpNick = me => { const a = T.anglers[me]; return !!(a && a.data && String(a.data.nick || '').trim()); };
// 찌릿 라이브 (0019), the same rules as the database: schools, casts, strikes, landings, the fish book, the weekly bag.
// The waits are short here so the browser tests do not sit by the water; /__sb/live_cfg changes them and fixes the rolls.
const LVS = { cfg: { remote: 5, cap: 80, waitMin: 1300, waitMax: 1700, fightMin: 700, tier: null, big: null, u: null, school: null }, casts: {}, days: {}, catches: [], dex: {}, settled: {}, void: {}, seq: 0 };
const LV_SP = (() => { try { const { SP } = new Function(fs.readFileSync(path.join(ROOT, 'src', 'fishdb.js'), 'utf8') + '; return { SP };')(); return Object.fromEntries(SP.map(x => [x.id, { tier: x.r, L: x.L, X: x.X, w: x.w, z: x.z }])); } catch (e) { return {}; } })();
const LV_PERK = { egi: { win: .3 }, jig: { wait: .7, trophy: 1.3 }, minnow: { trophy: 2 }, gold: { trophy: 2 }, rod_spark: { trophy: 1.2 }, rod_bolt: { trophy: 1.3 }, reel_lbr: { win: .05 }, reel_bolt: { win: .1 }, float_ball: { win: .1 }, float_led: { win: .15, wait: .92 }, float_spark: { win: .2, wait: .88 }, float_bolt: { win: .25, wait: .85 } };
const lvDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const lvHash = (...a) => { let h = 2166136261; for (const ch of a.join(':')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const lvSchool = (cx, cy) => { if (LVS.cfg.school != null) return LVS.cfg.school; const thr = .05 + .13 * lvHash('z', Math.floor(cx / 6), Math.floor(cy / 6), Math.floor(Date.now() / 3600e3)), h = lvHash(cx, cy, Math.floor(Date.now() / 600e3)); return h < thr * .18 ? 3 : h < thr * .5 ? 2 : h < thr ? 1 : 0; };
const lvCm = (sp, u, v, big) => Math.round(Math.min(sp.X, big && sp.X > sp.L * 1.05 ? sp.L * 1.05 + (sp.X - sp.L * 1.05) * Math.pow(v, 1.7) : sp.L * (.55 + .5 * u)) * 10) / 10;
function lvBoard(wk) {
  const by = {};
  for (const c of LVS.catches) if (c.wk === wk && !LVS.void[wk + c.acct]) (by[c.acct] = by[c.acct] || []).push(c);
  const rows = Object.entries(by).map(([a, l]) => { l.sort((x, y) => y.score - x.score); return { a, s: l.slice(0, 5).reduce((n, c) => n + c.score, 0), n: l.length, sp: l[0].sp, cm: l[0].cm, at: Math.max(...l.map(c => c.id)) }; }).sort((x, y) => y.s - x.s || x.at - y.at);
  return rows.map((x, i) => Object.assign(x, { r: i + 1 }));
}
function lvAward(wk) {
  if (wk >= zpWeek() || LVS.settled[wk]) return; LVS.settled[wk] = true;
  for (const x of lvBoard(wk)) if (x.r <= 3) { zpAdd(x.a, [300, 200, 100][x.r - 1], 'prize', 'live:' + wk, String(x.r)); if (x.r === 1) (ZPS.owned[x.a] = ZPS.owned[x.a] || []).includes('gold') || ZPS.owned[x.a].push('gold'); }
}
function lvEarn(acct, d, ref) {
  if (d <= 0) return; const w = ZPS.wal[acct] || (ZPS.wal[acct] = { bal: 0, earned: 0 }); w.bal += d; w.earned += d;
  const l = ZPS.led.find(x => x.acct === acct && x.r === 'join' && x.ref === ref); if (l) l.d += d; else ZPS.led.push({ id: ++ZPS.seq, acct, d, r: 'join', ref, n: 'live', at: new Date().toISOString() });
}
const PUSH = {}, PUSHLOG = []; // phone notices: subscriptions saved through the RPCs, and what the app asked the push function // admin_delete_user present on the "server" (the live one gets it with the SQL update)
const isAdmin = uid => !!uid && (admins.has(uid) || admins.has(acct(uid)));
const admins = new Set(); const links = {}; const codes = {};
const acct = uid => links[uid] || uid;
const key = (t, row) => t === 'photos' ? row.angler + '|' + row.cid : row.id;
const cell = v => (Math.floor(v / 0.25) + 0.5) * 0.25;
function canWrite(t, row, uid) {
  if (!uid) return false;
  if (t === 'reviews') return false;
  if (t === 'points') { const old = T.points[row.id]; return old ? (acct(old.owner) === acct(uid) || isAdmin(uid)) : true; }
  if (t === 'admin_docs') return admins.has(uid) || admins.has(acct(uid));
  if (t === 'news' || t === 'spots') return false;
  if (t === 'photos') return row.angler === acct(uid);
  return row.id === acct(uid);
}
function paid(id, ref) { const o = T.orders[id]; const g = (T.admin_docs.grants && T.admin_docs.grants.data[id]) || {}; return !!(o && (o.data.items || []).some(it => it.kind === 'item' && it.ref === ref && g[it.id] === 'ok')); }
// orders: saved ones never change; new ones only for the two premium items or a tip, one waiting per item, at most 3 waiting
function ordersGuard(row, old) {
  const g = (T.admin_docs.grants && T.admin_docs.grants.data[row.id]) || {};
  const prev = new Map(((old && old.data.items) || []).map(o => [o.id, o]));
  const waiting = o => !['ok', 'no'].includes(g[o.id]);
  const items = (row.data && row.data.items) || []; const out = []; const seen = new Set();
  let wait = items.filter(o => prev.has(o.id) && waiting(prev.get(o.id))).length;
  const refs = new Set(items.filter(o => prev.has(o.id) && waiting(prev.get(o.id)) && prev.get(o.id).kind === 'item').map(o => prev.get(o.id).ref));
  for (const o of items) {
    if (!o || !o.id || seen.has(o.id)) continue;
    if (prev.has(o.id)) { out.push(prev.get(o.id)); seen.add(o.id); continue; }
    if (g[o.id]) continue;
    if (!((o.kind === 'item' && ['pr_gold', 'th_palace'].includes(o.ref)) || o.kind === 'donate')) continue;
    if (wait >= 3 || (o.kind === 'item' && refs.has(o.ref))) continue;
    wait++; if (o.kind === 'item') refs.add(o.ref);
    out.push(Object.assign({}, o, { amt: 500, ts: Date.now() })); seen.add(o.id);
  }
  row.data = { items: out }; return row;
}
const logins = {}; // name -> { owner, pass }
const SIZE_X = { kurodai: 71, madai: 100, saba: 60, mejina: 60 };
function guard(row, old) {
  const d = row.data || {};
  if (old && old.data && old.data.own) d.own = old.data.own; else delete d.own;
  for (const c of (d.catches || [])) {
    if (typeof c.lat === 'number' && typeof c.lon === 'number') {
      const cl = cell(c.lat), co = cell(c.lon);
      if (c.lat !== cl || c.lon !== co) T.spots[row.id + '|' + c.id] = { uid: row.id, cid: c.id, lat: c.lat, lon: c.lon };
      c.lat = cl; c.lon = co;
    }
    if (c.st === 'ok' && !c.tk) c.st = 'review';
    const x = SIZE_X[c.sp]; if (x && c.len > x * 1.3) c.st = 'no'; else if (x && c.len > x && c.st === 'ok') c.st = 'review';
  }
  if (!paid(row.id, 'pr_gold')) { if (d.flair && d.flair.gold) d.flair.gold = false; if (d.decor) { d.decor.items = (d.decor.items || []).filter(x => x !== 'dc_goldboat'); d.decor.fx = (d.decor.fx || []).filter(x => x !== 'fx_sparkle'); } if (d.char && d.char.rd === 'gold') d.char.rd = 'carbon'; }
  if (!paid(row.id, 'th_palace') && d.decor && d.decor.theme === 'th_palace') d.decor.theme = 'th_dawn';
  return row;
}
function visible(t, row, uid) {
  if (t === 'chat') return (!row.hidden || isAdmin(uid)) && Date.now() - Date.parse(row.created_at) < 3 * 864e5;
  if (t === 'dm') return !!uid && [row.a, row.b].includes(acct(uid));
  if (t === 'points') return !!row.pub || (!!uid && acct(row.owner) === acct(uid)) || isAdmin(uid);
  if (t === 'reviews') return (!!uid && acct(row.id) === acct(uid)) || isAdmin(uid);
  if (t === 'orders' || t === 'suggest') return row.id === acct(uid) || admins.has(uid) || admins.has(acct(uid));
  if (t === 'spots') return row.uid === acct(uid);
  return true;
}
const push = (table, eventType, row, old) => { ver++; events.push({ ver, table, eventType, new: row || {}, old: old || {} }); };
const body = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b ? JSON.parse(b) : {})); });
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (o, s = 200) => { res.statusCode = s; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (u.pathname === '/__sb/select') {
    const q = await body(req); if (q.table === 'photos') STATS.photoSelects++;
    const rows = Object.values(T[q.table] || {}).filter(r => visible(q.table, r, q.uid))
      .filter(r => !q.match || Object.entries(q.match).every(([k, v]) => String(r[k]) === String(v)))
      .filter(r => !q.in || q.in.vals.map(String).includes(String(r[q.in.col])));
    if (q.order) rows.sort((a, b) => ((a[q.order.col] > b[q.order.col]) - (a[q.order.col] < b[q.order.col])) * (q.order.asc ? 1 : -1));
    return send({ data: JSON.parse(JSON.stringify(rows.slice(0, q.limit || 1000))) });
  }
  if (u.pathname === '/__sb/insert') {
    const q = await body(req); const uid = q.uid; const row = q.row || {};
    const err = m => send({ error: { code: 'P0001', message: m } });
    if (!uid) return err('not_signed_in');
    const me = acct(uid);
    if (q.table === 'chat') {
      const a = T.anglers[me]; const nick = a && a.data && String(a.data.nick || '').trim(); if (!nick) return err('no_profile');
      if (MUTES[me] && MUTES[me] > Date.now()) return err('muted');
      const text = String(row.body || '').replace(/\s+/g, ' ').trim(); if (text.length < 1 || text.length > 200) return err('bad_body');
      if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|kr|io|me|ly|gg|co)(\/|$|[^a-z]))/i.test(text)) return err('no_links');
      if (/01[016789][ .-]?[0-9]{3,4}[ .-]?[0-9]{4}/.test(text)) return err('no_phone');
      if (!tryOk('chat:' + me, 6, 15000)) return err('slow_down');
      const r = { id: ++seq, room: /^[a-z0-9]{1,16}$/.test(row.room || '') ? row.room : 'all', uid: me, nick: nick.slice(0, 16), body: text, hidden: false, created_at: new Date().toISOString() };
      T.chat[r.id] = r; push('chat', 'INSERT', r); return send({ data: r });
    }
    if (q.table === 'dm') {
      const peer = acct((row.a === me || row.a === uid) ? row.b : row.a);
      if (!peer || peer === me || !T.anglers[peer]) return err('bad_peer');
      if (!areFriends(me, peer)) return err('not_friends');
      if (MUTES[me] && MUTES[me] > Date.now()) return err('muted');
      const text = String(row.body || '').trim(); if (text.length < 1 || text.length > 500) return err('bad_body');
      if (!tryOk('dm:' + me, 10, 20000)) return err('slow_down');
      const [a, b] = me < peer ? [me, peer] : [peer, me];
      const r = { id: ++seq, a, b, sender: me, body: text, created_at: new Date().toISOString() };
      T.dm[r.id] = r; push('dm', 'INSERT', r); return send({ data: r });
    }
    return send({ error: { code: '42501', message: 'permission denied' } });
  }
  if (u.pathname.startsWith('/__sb/rt/')) {
    const q = await body(req); const op = u.pathname.slice(9); RTSEEN[q.cid] = Date.now();
    if (op === 'poll') { const m = RTQ[q.cid] || []; RTQ[q.cid] = []; RTSTATS.delivered += m.length; return send({ msgs: m }); }
    if (op === 'join') { (RT[q.topic] = RT[q.topic] || new Map()).set(q.cid, { key: q.key, payload: null }); rtSync(q.topic); return send({ ok: true }); }
    if (op === 'track') { const m = RT[q.topic] && RT[q.topic].get(q.cid); if (m) { m.payload = q.payload; rtSync(q.topic); } return send({ ok: !!m }); }
    if (op === 'leave') { if (RT[q.topic]) { RT[q.topic].delete(q.cid); rtSync(q.topic); } return send({ ok: true }); }
    if (op === 'send') { RTSTATS.sent++; for (const cid of (RT[q.topic] || new Map()).keys()) if (cid !== q.cid) (RTQ[cid] = RTQ[cid] || []).push({ topic: q.topic, type: 'broadcast', event: q.event, payload: q.payload }); return send({ ok: true }); }
    return send({ error: 'unknown' }, 404);
  }
  if (u.pathname === '/__sb/upsert') {
    const q = await body(req); let row = JSON.parse(JSON.stringify(q.row));
    if (!canWrite(q.table, row, q.uid)) return send({ error: { code: '42501', message: 'new row violates row-level security policy' } });
    const k = key(q.table, row); const old = T[q.table][k];
    if (q.table === 'anglers') row = guard(row, old);
    if (q.table === 'orders') row = ordersGuard(row, old);
    if (q.table === 'points') {
      if (!/^[a-z0-9]{6,24}$/.test(row.id || '') || JSON.stringify(row.data || {}).length > 4000) return send({ error: { code: '23514', message: 'check constraint' } });
      row = { id: row.id, owner: old ? old.owner : acct(q.uid), data: row.data, pub: !!(row.data && row.data.pub === true), updated_at: new Date().toISOString() };
    }
    T[q.table][k] = row;
    push(q.table, old ? 'UPDATE' : 'INSERT', row, old ? { id: old.id } : {});
    return send({ data: null });
  }
  if (u.pathname === '/__sb/delete') {
    const q = await body(req);
    for (const [k, r] of Object.entries(T[q.table])) if (Object.entries(q.match).every(([kk, v]) => String(r[kk]) === String(v)) && canWrite(q.table, r, q.uid)) { delete T[q.table][k]; push(q.table, 'DELETE', {}, q.table === 'photos' ? { angler: r.angler, cid: r.cid } : { id: r.id }); }
    return send({ data: null });
  }
  if (u.pathname === '/__sb/rpc') {
    const q = await body(req); const uid = q.uid;
    if (q.name === 'is_admin') return send({ data: admins.has(uid) || admins.has(acct(uid)) });
    if (q.name === 'claim_admin') { if (uid && q.args.code === 'TESTCODE1234ABCD') { admins.add(uid); admins.add(acct(uid)); return send({ data: true }); } return send({ data: false }); }
    if (q.name === 'my_acct') return send({ data: uid ? acct(uid) : null });
    if (q.name === 'link_create') { if (!uid) return send({ error: { message: 'not_signed_in' } }); const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 8; i++) c += A[Math.floor(Math.random() * 32)]; codes[c] = { owner: acct(uid), exp: Date.now() + 600000 }; return send({ data: c }); }
    if (q.name === 'link_redeem') {
      const code = String(q.args.p_code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); const c = codes[code];
      if (!c || c.exp < Date.now()) return send({ data: { ok: false, err: 'bad_code' } });
      delete codes[code]; const me = acct(uid), owner = c.owner;
      if (me !== owner) {
        const mine = T.anglers[me]; const theirs = T.anglers[owner];
        if (mine && theirs) { const ids = new Set((theirs.data.catches || []).map(x => x.id)); theirs.data.catches = (theirs.data.catches || []).concat((mine.data.catches || []).filter(x => !ids.has(x.id))); push('anglers', 'UPDATE', theirs, { id: owner }); }
        for (const t of ['anglers', 'labels', 'orders', 'suggest', 'board']) if (T[t][me]) { delete T[t][me]; push(t, 'DELETE', {}, { id: me }); }
        links[uid] = owner;
      }
      return send({ data: { ok: true, acct: owner } });
    }
    if (q.name === 'link_leave') { delete links[uid]; return send({ data: true }); }
    const join = owner => {
      const me = acct(uid); if (me === owner) return { ok: true, acct: owner };
      if (Object.values(logins).some(l => l.owner === me)) return { ok: false, err: 'has_id' };
      const mine = T.anglers[me]; const theirs = T.anglers[owner];
      if (mine && theirs) { const ids = new Set((theirs.data.catches || []).map(x => x.id)); theirs.data.catches = (theirs.data.catches || []).concat((mine.data.catches || []).filter(x => !ids.has(x.id))); push('anglers', 'UPDATE', theirs, { id: owner }); }
      for (const t of ['anglers', 'labels', 'orders', 'suggest', 'board']) if (T[t][me]) { delete T[t][me]; push(t, 'DELETE', {}, { id: me }); }
      links[uid] = owner; return { ok: true, acct: owner };
    };
    if (q.name === 'id_me') { const l = Object.entries(logins).find(([, v]) => v.owner === acct(uid)); return send({ data: l ? l[0] : null }); }
    if (q.name === 'id_register') {
      const n = String(q.args.p_name || '').trim().toLowerCase(), p = String(q.args.p_pass || '');
      if (!/^[a-z0-9_]{3,20}$/.test(n)) return send({ data: { ok: false, err: 'bad_name' } });
      if (p.length < 6) return send({ data: { ok: false, err: 'bad_pass' } });
      if (Object.values(logins).some(l => l.owner === acct(uid))) return send({ data: { ok: false, err: 'has_id' } });
      if (logins[n]) return send({ data: { ok: false, err: 'taken' } });
      logins[n] = { owner: acct(uid), pass: p }; return send({ data: { ok: true, name: n } });
    }
    if (q.name === 'id_login') {
      const n = String(q.args.p_name || '').trim().toLowerCase(); const l = logins[n];
      if (!l || l.pass !== q.args.p_pass) return send({ data: { ok: false, err: 'wrong' } });
      return send({ data: Object.assign(join(l.owner), { name: n }) });
    }
    if (q.name === 'id_password') { const e = Object.entries(logins).find(([, v]) => v.owner === acct(uid)); if (!e) return send({ data: { ok: false, err: 'no_id' } }); if (e[1].pass !== q.args.p_old) return send({ data: { ok: false, err: 'wrong' } }); e[1].pass = q.args.p_new; return send({ data: { ok: true } }); }
    if (q.name === 'admin_id_reset') { if (!(admins.has(uid) || admins.has(acct(uid)))) return send({ error: { message: 'not_admin' } }); const l = logins[String(q.args.p_name || '').toLowerCase()]; if (!l) return send({ data: { ok: false, err: 'no_id' } }); l.pass = q.args.p_new; return send({ data: { ok: true } }); }
    if (q.name === 'admin_delete_user') {
      if (!FEATURES.del) return send({ error: { code: 'PGRST202', message: 'Could not find the function public.admin_delete_user(p_uid) in the schema cache' } });
      if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } });
      if (!q.args.p_uid) return send({ data: false });
      const target = acct(q.args.p_uid); if (target === acct(uid)) return send({ error: { message: 'cannot_delete_self' } });
      for (const t of ['anglers', 'labels', 'orders', 'suggest', 'board', 'teams', 'reviews']) if (T[t][target]) { delete T[t][target]; push(t, 'DELETE', {}, { id: target }); }
      for (const [k, r] of Object.entries(T.photos)) if (r.angler === target) { delete T.photos[k]; push('photos', 'DELETE', {}, { angler: r.angler, cid: r.cid }); }
      for (const [k, r] of Object.entries(T.points)) if (acct(r.owner) === target) { delete T.points[k]; push('points', 'DELETE', {}, { id: k }); }
      for (const [n, l] of Object.entries(logins)) if (l.owner === target) delete logins[n];
      for (const a of [...admins]) if (acct(a) === target) admins.delete(a);
      return send({ data: true });
    }
    if (q.name === 'chat_hide') { if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } }); const r = T.chat[q.args.p_id]; if (!r) return send({ data: false }); r.hidden = q.args.p_on !== false; push('chat', 'UPDATE', r, { id: r.id }); return send({ data: true }); }
    if (q.name === 'chat_mute') {
      if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } });
      const target = acct(q.args.p_uid); if (!target || target === acct(uid)) return send({ error: { message: 'cannot_mute_self' } });
      const until = new Date(Date.now() + Math.max(0, +q.args.p_minutes || 0) * 60000).toISOString(); MUTES[target] = Date.parse(until); return send({ data: until });
    }
    if (q.name === 'chat_mutes') { if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } }); return send({ data: Object.entries(MUTES).filter(([, v]) => v > Date.now()).map(([k, v]) => ({ acct: k, until: new Date(v).toISOString() })) }); }
    if (q.name === 'chat_my_mute') { const m = MUTES[acct(uid)]; return send({ data: m && m > Date.now() ? new Date(m).toISOString() : null }); }
    if (q.name === 'board_admin_remove') {
      if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } });
      const b = T.board[q.args.p_owner]; const col = q.args.p_kind === 'post' ? 'posts' : q.args.p_kind === 'cmt' ? 'cmts' : null;
      if (!b || !col || !Array.isArray(b.data[col])) return send({ data: false });
      const n0 = b.data[col].length; b.data[col] = b.data[col].filter(x => x.id !== q.args.p_id);
      if (b.data[col].length === n0) return send({ data: false });
      push('board', 'UPDATE', b, { id: b.id }); return send({ data: true });
    }
    if (q.name === 'delete_my_account') {
      if (!FEATURES.wd) return send({ error: { code: 'PGRST202', message: 'Could not find the function public.delete_my_account(p_pass) in the schema cache' } });
      if (!uid) return send({ data: { ok: false, err: 'not_signed_in' } });
      const me = acct(uid);
      if (isAdmin(uid)) return send({ data: { ok: false, err: 'admin' } });
      if (!tryOk('del:' + uid, 5, 3600e3)) return send({ data: { ok: false, err: 'slow_down' } });
      const l = Object.entries(logins).find(([, v]) => v.owner === me);
      if (l && l[1].pass !== q.args.p_pass) return send({ data: { ok: false, err: 'wrong' } });
      for (const a of Object.values(T.anglers)) { let ch = false; if (a.data.fr && a.data.fr[me]) { delete a.data.fr[me]; ch = true; } if (a.data.team && a.data.team.id === me) { delete a.data.team; ch = true; } if (ch) push('anglers', 'UPDATE', a, { id: a.id }); }
      for (const tm of Object.values(T.teams)) if (tm.data.members && tm.data.members[me]) { delete tm.data.members[me]; push('teams', 'UPDATE', tm, { id: tm.id }); }
      for (const t of ['anglers', 'labels', 'orders', 'suggest', 'board', 'teams', 'reviews']) if (T[t][me]) { delete T[t][me]; push(t, 'DELETE', {}, { id: me }); }
      for (const [k, r] of Object.entries(T.photos)) if (r.angler === me) { delete T.photos[k]; push('photos', 'DELETE', {}, { angler: r.angler, cid: r.cid }); }
      for (const [k, r] of Object.entries(T.points)) if (acct(r.owner) === me) { delete T.points[k]; push('points', 'DELETE', {}, { id: k }); }
      for (const [k, r] of Object.entries(T.chat)) if (r.uid === me) delete T.chat[k];
      for (const [k, r] of Object.entries(T.dm)) if (r.a === me || r.b === me) delete T.dm[k];
      for (const [n, x] of Object.entries(logins)) if (x.owner === me) delete logins[n];
      for (const [ep, x] of Object.entries(PUSH)) if (acct(x.acct) === me) delete PUSH[ep];
      for (const [dev, own] of Object.entries(links)) if (own === me) delete links[dev];
      delete ZPS.wal[me]; delete ZPS.owned[me]; delete ZPS.runs[me]; ZPS.led = ZPS.led.filter(x => x.acct !== me); for (const [k, x] of Object.entries(ZPS.scores)) if (x.acct === me) delete ZPS.scores[k];
      return send({ data: { ok: true } });
    }
    if (/^live_/.test(q.name)) {
      const err = m => send({ error: { code: 'P0001', message: m } });
      if (!FEATURES.live) return send({ error: { code: 'PGRST202', message: 'Could not find the function public.' + q.name + ' in the schema cache' } });
      if (!uid) return err('not_signed_in');
      const me = acct(uid), wk = zpWeek(), day = lvDay(), A = q.args || {}, C = LVS.cfg;
      const d = LVS.days[me + day] || (LVS.days[me + day] = { casts: 0, remote: 0, pts: 0, fish: 0 });
      if (q.name === 'live_state') {
        for (const w of new Set(LVS.catches.filter(c => c.wk < wk).map(c => c.wk))) lvAward(w);
        const b = lvBoard(wk), mine = b.find(x => x.a === me), l = lvBoard(zpAddDays(wk, -7));
        return send({ data: { on: true, wk, now: Date.now(), tide: .6, day: { pts: d.pts, cap: C.cap, fish: d.fish, remote: d.remote, remoteMax: C.remote }, bal: (ZPS.wal[me] || { bal: 0 }).bal,
          dex: Object.entries(LVS.dex[me] || {}).map(([sp, x]) => ({ sp, n: x.n, best: x.best })),
          top: b.slice(0, 10).map(({ a, s, n, sp, cm }) => ({ a, s, n, sp, cm })), n: b.length, me: mine ? { s: mine.s, n: mine.n, r: mine.r, sp: mine.sp, cm: mine.cm } : null,
          last: l.slice(0, 3).map(({ a, s, r, sp, cm }) => ({ a, s, r, sp, cm })),
          feed: LVS.catches.slice(-20).reverse().map(c => ({ id: c.id, a: c.anon ? null : c.acct, sp: c.sp, cm: c.cm, tier: c.tier, big: c.big, on: c.onsite, gx: c.gx, gy: c.gy, at: c.at })) } });
      }
      if (q.name === 'live_schools') {
        if (A.p_x1 < A.p_x0 || A.p_y1 < A.p_y0 || (A.p_x1 - A.p_x0 + 1) * (A.p_y1 - A.p_y0 + 1) > 3000) return err('bad_input');
        const cells = []; for (let x = A.p_x0; x <= A.p_x1; x++) for (let y = A.p_y0; y <= A.p_y1; y++) { const sc = LVS.cfg.school != null ? ((x + y) % 4 === 0 ? LVS.cfg.school : 0) : lvSchool(x, y); if (sc > 0) cells.push([x, y, sc]); }
        return send({ data: { until: (Math.floor(Date.now() / 600e3) + 1) * 600e3, feedAt: false, cells } });
      }
      if (q.name === 'live_cast') {
        if (!zpNick(me)) return err('no_profile');
        if (!['sea', 'fresh'].includes(A.p_water) || !Number.isInteger(A.p_cx) || !Number.isInteger(A.p_cy)) return err('bad_input');
        const on = !!A.p_onsite; if (!on && d.remote >= C.remote) return send({ data: { err: 'remote_out', left: 0 } });
        let waitx = 1, trophy = 1, winx = 0; const a = T.anglers[me], own = ZPS.owned[me] || [];
        for (const k of ['lure', 'rod', 'reel', 'float']) { const id = a && a.data && a.data[k], P = own.includes(id) && LV_PERK[id]; if (P) { waitx *= P.wait || 1; trophy *= P.trophy || 1; winx += P.win || 0; } }
        const school = lvSchool(A.p_cx, A.p_cy), wait = Math.round((C.waitMin + Math.random() * (C.waitMax - C.waitMin)) * Math.max(waitx, .6)), win = Math.round(850 + Math.min(winx, .6) * 1000);
        const token = require('crypto').randomUUID();
        LVS.casts[me] = { token, cx: A.p_cx, cy: A.p_cy, water: A.p_water, onsite: on, anon: !!A.p_anon, at: Date.now(), wait, win, school, trophy: Math.min(trophy, 2.6), state: 'wait' };
        d.casts++; if (!on) d.remote++;
        return send({ data: { token, wait, win, school, feed: false, tide: .6, left: C.remote - d.remote } });
      }
      const k = LVS.casts[me];
      if (q.name === 'live_strike') {
        if (!k || k.token !== A.p_token || k.state !== 'wait') return send({ data: { err: 'no_cast' } });
        const ms = Date.now() - k.at;
        if (ms < k.wait - 150) { k.state = 'done'; return send({ data: { err: 'early' } }); }
        if (ms > k.wait + k.win + 2500) { k.state = 'done'; return send({ data: { err: 'late' } }); }
        const m = (1 + .5 * k.school) * (k.onsite ? 1.25 : 1), w = [55, 27, 12 * m, 5 * m * (k.onsite ? 1 : .5), k.onsite ? m : 0]; let r = Math.random() * w.reduce((x, y) => x + y, 0), tier = 1;
        for (let i = 0; i < 5; i++) { tier = i + 1; r -= w[i]; if (r < 0) break; }
        if (C.tier) tier = k.onsite ? C.tier : Math.min(C.tier, 4);
        Object.assign(k, { state: 'hooked', hookAt: Date.now(), tier, u: C.u != null ? C.u : Math.random(), v: Math.random(), big: C.big != null ? C.big : Math.random() < Math.min(.3, .04 * k.trophy * (1 + .25 * k.school)), seed: Math.floor(Math.random() * 2147483647) });
        return send({ data: { tier: k.tier, u: k.u, v: k.v, big: k.big, seed: k.seed } });
      }
      if (q.name === 'live_land') {
        if (!k || k.token !== A.p_token || k.state !== 'hooked') return send({ data: { err: 'no_cast' } });
        k.state = 'done'; if (!A.p_ok) return send({ data: { lost: true } });
        if (Date.now() - k.hookAt < C.fightMin) return send({ data: { err: 'too_fast' } });
        const sp = LV_SP[A.p_sp];
        if (!sp || sp.tier > k.tier || (k.water === 'sea' && !(['S', 'B'].includes(sp.w) && ['shore', 'coast', 'brack', 'shelf'].includes(sp.z))) || (k.water === 'fresh' && !['F', 'B'].includes(sp.w))) return send({ data: { err: 'bad_species' } });
        const cm = lvCm(sp, k.u, k.v, k.big), score = Math.round(100 * cm / sp.X * [1, 1.3, 1.7, 2.3, 3][sp.tier - 1]);
        let pts = [1, 3, 6, 12, 30][sp.tier - 1]; if (k.big) pts = Math.ceil(pts * 1.5); if (!k.onsite) pts = Math.max(1, Math.ceil(pts * .5));
        const capped = Math.max(0, Math.min(pts, C.cap - d.pts)), dx = LVS.dex[me] || (LVS.dex[me] = {}), old = dx[A.p_sp], first = !old, best = !!old && cm > old.best, bonus = first ? 10 : 0;
        dx[A.p_sp] = { n: (old ? old.n : 0) + 1, best: Math.max(old ? old.best : 0, cm) };
        const row = { id: ++LVS.seq, acct: me, sp: A.p_sp, cm, tier: sp.tier, big: k.big, score, pts: capped + bonus, onsite: k.onsite, anon: k.anon, gx: Math.floor(k.cx / 8), gy: Math.floor(k.cy / 10), wk, at: Date.now() };
        LVS.catches.push(row); d.pts += capped; d.fish++; lvEarn(me, capped + bonus, 'day:' + day);
        const mine = lvBoard(wk).find(x => x.a === me);
        return send({ data: { id: row.id, sp: A.p_sp, cm, tier: sp.tier, big: k.big, score, pts: capped + bonus, first, best, capped: capped < pts, onsite: k.onsite, day: { pts: d.pts, cap: C.cap, fish: d.fish }, wk: { s: mine ? mine.s : 0, r: mine ? mine.r : null }, bal: ZPS.wal[me].bal } });
      }
      if (q.name === 'live_void') { if (!isAdmin(uid)) return err('not_allowed'); LVS.void[A.p_wk + acct(A.p_acct)] = A.p_void !== false; return send({ data: true }); }
      return err('no_function');
    }
    if (/^(zp_|rx_)/.test(q.name)) {
      const err = m => send({ error: { code: 'P0001', message: m } });
      if (!FEATURES.zp) return send({ error: { code: 'PGRST202', message: 'Could not find the function public.' + q.name + ' in the schema cache' } });
      if (!uid) return err('not_signed_in');
      const me = acct(uid), wk = zpWeek(), A = q.args || {};
      if (q.name === 'zp_state') {
        for (const w of new Set(Object.values(ZPS.scores).filter(x => x.game === 'rx' && x.wk < wk && x.wk >= zpAddDays(wk, -35)).map(x => x.wk))) zpAward('rx', w);
        const w = ZPS.wal[me] || { bal: 0, earned: 0 }, b = zpBoard('rx', wk), l = zpBoard('rx', zpAddDays(wk, -7)), mine = b.find(x => x.a === me);
        return send({ data: { wk, bal: w.bal, earned: w.earned, owned: ZPS.owned[me] || [], items: ZPS.items.map(([id, price]) => ({ id, price })),
          rx: { top: b.slice(0, 10).map(({ a, s, b: bb }) => ({ a, s, b: bb })), n: b.length, me: mine ? { s: mine.s, b: mine.b, r: mine.r } : null, last: l.slice(0, 3).map(({ a, s, b: bb, r }) => ({ a, s, b: bb, r })), lastn: l.length },
          led: ZPS.led.filter(x => x.acct === me).sort((x, y) => y.id - x.id).slice(0, 30).map(({ id, d, r, ref, n, at }) => ({ id, d, r, ref, n, at })) } });
      }
      if (q.name === 'rx_begin') {
        if (!zpNick(me)) return err('no_profile');
        if (!tryOk('rxb:' + me, 60, 3600e3)) return err('slow_down');
        const token = require('crypto').randomUUID(); ZPS.runs[me] = { token, at: Date.now(), used: false }; return send({ data: token });
      }
      if (q.name === 'rx_submit') {
        const r = ZPS.runs[me];
        if (!r || r.token !== A.p_token || r.used || Date.now() - r.at > 15 * 60e3) return send({ data: { err: 'bad_run' } });
        r.used = true; const ts = A.p_times;
        if (!Array.isArray(ts) || ts.length !== 5 || ts.some(x => !Number.isInteger(x) || x < 100 || x > 1500)) return send({ data: { err: 'bad_run' } });
        const sum = ts.reduce((a, b) => a + b, 0), avg = Math.round(sum / 5), ok = ts.filter(x => x < 1500), best = ok.length ? Math.min(...ok) : null;
        if (avg < 140 || Date.now() - r.at < 5 * 1500 + 4 * 1000 + sum - 1500) return send({ data: { err: 'too_fast' } });
        const k = 'rx|' + wk + '|' + me, old = ZPS.scores[k]; let rec = false;
        if (!old) { ZPS.scores[k] = { game: 'rx', wk, acct: me, score: avg, best, void: false, at: Date.now() }; rec = true; }
        else if (avg < old.score) { Object.assign(old, { score: avg, best, at: Date.now() }); rec = true; }
        const mine = zpBoard('rx', wk).find(x => x.a === me);
        return send({ data: { avg, best, rec, r: mine ? mine.r : null, n: mine ? mine.n : null, wk } });
      }
      if (q.name === 'zp_buy') {
        if (!zpNick(me)) return err('no_profile');
        const it = ZPS.items.find(x => x[0] === A.p_item); if (!it || it[1] == null) return err('no_item');
        const own = ZPS.owned[me] || (ZPS.owned[me] = []); if (own.includes(A.p_item)) return err('owned');
        const w = ZPS.wal[me] || (ZPS.wal[me] = { bal: 0, earned: 0 }); if (w.bal < it[1]) return err('not_enough');
        if (it[1] > 0) zpAdd(me, -it[1], 'buy', A.p_item, ''); own.push(A.p_item);
        return send({ data: { item: A.p_item, bal: w.bal } });
      }
      if (q.name === 'zp_grant') {
        if (!isAdmin(uid)) return err('not_admin');
        const to = acct(A.p_acct); if (!to || !T.anglers[to]) return err('no_account');
        let d = Math.round(+A.p_delta || 0); if (!d || Math.abs(d) > 100000) return err('bad_amount');
        const w = ZPS.wal[to] || (ZPS.wal[to] = { bal: 0, earned: 0 }); if (d < 0) d = Math.max(d, -w.bal);
        if (d) zpAdd(to, d, 'grant', require('crypto').randomUUID(), String(A.p_note || '').slice(0, 80));
        return send({ data: w.bal });
      }
      if (q.name === 'zp_void') {
        if (!isAdmin(uid)) return err('not_admin');
        const x = ZPS.scores[A.p_game + '|' + A.p_wk + '|' + acct(A.p_acct)]; if (!x) return send({ data: false });
        x.void = A.p_void !== false; return send({ data: true });
      }
    }
    if (q.name === 'push_subscribe') {
      if (!uid) return send({ error: { message: 'not_signed_in' } });
      if (!/^https:\/\/(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com)\//.test(q.args.p_endpoint || '')) return send({ error: { message: 'bad_endpoint' } });
      PUSH[q.args.p_endpoint] = { acct: acct(uid), p256dh: q.args.p_p256dh, auth: q.args.p_auth, lang: q.args.p_lang, off: false }; return send({ data: true });
    }
    if (q.name === 'push_unsubscribe') { const x = PUSH[q.args.p_endpoint]; if (x && acct(x.acct) === acct(uid)) { x.off = true; return send({ data: true }); } return send({ data: false }); }
    if (q.name === 'push_is_on') { const x = PUSH[q.args.p_endpoint]; return send({ data: !!(x && !x.off && acct(x.acct) === acct(uid)) }); }
    if (q.name === 'admin_logins') {
      if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } });
      return send({ data: Object.entries(logins).map(([name, l]) => ({ acct: acct(l.owner), name, created_at: new Date().toISOString() })) });
    }
    if (q.name === 'admin_link_code') {
      if (!isAdmin(uid)) return send({ error: { message: 'not_admin' } });
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 8; i++) c += A[Math.floor(Math.random() * 32)];
      codes[c] = { owner: acct(q.args.p_acct), exp: Date.now() + 1800000 }; return send({ data: c });
    }
    return send({ error: { code: 'PGRST202', message: 'Could not find the function public.' + q.name + ' in the schema cache' } });
  }
  if (u.pathname === '/__fn/news') {
    const now = new Date().toISOString();
    const items = [['ko', '부산 앞바다서 1.2m 부시리 낚아… 역대급 손맛', '바다신문'], ['ko', '제주 갯바위서 초대형 돌돔 잡혀 화제', '제주일보'], ['ko', '낚싯배서 희귀 어종 포획, 학계 관심', '해양뉴스'], ['en', 'Angler lands record 300-pound bluefin tuna', 'Fishing Times'], ['en', 'Giant catfish caught in river breaks state record', 'Outdoor News'], ['ja', '巨大マダイ釣り上げ 記録級の大物', '釣り新聞']];
    items.forEach(([lang, title, source], i) => { const id = 'n' + i; T.news[id] = { id, lang, title, link: 'https://example.com/n' + i, source, pub: new Date(Date.now() - i * 3600e3).toISOString(), score: 40 - i, fetched_at: now }; push('news', 'INSERT', T.news[id]); });
    return send({ ok: true, added: items.length });
  }
  if (u.pathname === '/__fn/push') { const q = await body(req); PUSHLOG.push(Object.assign({ auth: req.headers['x-auth'] || '' }, q)); return send(q.op === 'key' ? { key: 'B' + 'K'.repeat(86) } : { sent: 0 }); }
  if (u.pathname === '/__fn/review') {
    let n = 0; const v = T.admin_docs.verdicts || (T.admin_docs.verdicts = { id: 'verdicts', data: {} }); const touched = new Set();
    for (const [id, a] of Object.entries(T.anglers)) for (const c of (a.data.catches || [])) {
      if (c.st !== 'review' || (v.data[id] && v.data[id][c.id])) continue;
      const hasPhoto = Object.values(T.photos).some(p => p.angler === id && p.cid === c.id);
      const verdict = !hasPhoto ? 'no' : c.sp === 'saba' ? 'no' : 'hold';
      const why = !hasPhoto ? 'no_photo|' : verdict === 'no' ? 'species|Chub mackerel?' : 'unclear|사진이 흐려요';
      v.data[id] = Object.assign({}, v.data[id], { [c.id]: verdict });
      const rv = T.reviews[id] || (T.reviews[id] = { id, data: {} }); rv.data = Object.assign({}, rv.data, { [c.id]: { v: verdict, why, m: 'fake', at: Date.now() } }); touched.add(id); n++;
    }
    if (n) { push('admin_docs', 'UPDATE', v, { id: 'verdicts' }); for (const id of touched) push('reviews', 'UPDATE', T.reviews[id], { id }); }
    return send({ ok: true, decided: n });
  }
  if (u.pathname === '/__sb/changes') {
    const since = +u.searchParams.get('since') || 0, who = u.searchParams.get('uid') || null;
    return send({ ver, events: events.filter(e => e.ver > since && (e.eventType === 'DELETE' || !['points', 'reviews', 'dm', 'chat'].includes(e.table) || visible(e.table, e.new, who))) });
  }
  if (u.pathname === '/__sb/zp_seed') { const q = await body(req); const wk = q.wk || zpAddDays(zpWeek(), q.weeksAgo ? -7 * q.weeksAgo : 0); for (const r of q.rows || []) ZPS.scores['rx|' + wk + '|' + r.acct] = { game: 'rx', wk, acct: r.acct, score: r.score, best: r.best == null ? null : r.best, void: !!r.void, at: Date.now() - 864e5 * 9 + (r.order || 0) }; return send({ ok: true, wk }); }
  if (u.pathname === '/__sb/live_cfg') { const q = await body(req); Object.assign(LVS.cfg, q.cfg || {}); if (q.weeksBack) for (const c of LVS.catches) c.wk = zpAddDays(c.wk, -7 * q.weeksBack); if (q.reset) { LVS.casts = {}; LVS.days = {}; LVS.catches = []; LVS.dex = {}; LVS.settled = {}; } return send({ cfg: LVS.cfg, n: LVS.catches.length }); }
  if (u.pathname === '/__sb/feature') { for (const [k, v] of u.searchParams) FEATURES[k] = v === '1'; return send(FEATURES); }
  if (u.pathname === '/__sb/dump') return send({ T, admins: [...admins], links, STATS, PUSH, PUSHLOG, logins: Object.keys(logins), MUTES, RTSTATS, ZPS, RT: Object.fromEntries(Object.entries(RT).map(([k, m]) => [k, [...m.values()].map(x => x.key)])) });
  if (u.pathname === '/__sb/config') { const q = await body(req); const g = T.admin_docs.config || (T.admin_docs.config = { id: 'config', data: {} }); g.data = Object.assign({}, g.data, q); push('admin_docs', 'UPDATE', g, { id: 'config' }); return send({ ok: true }); }
  if (u.pathname === '/__sb/grant') { const q = await body(req); const g = T.admin_docs.grants || (T.admin_docs.grants = { id: 'grants', data: {} }); g.data[q.uid] = Object.assign({}, g.data[q.uid], { [q.oid]: q.v }); push('admin_docs', 'UPDATE', g, { id: 'grants' }); return send({ ok: true }); }
  const f = u.pathname === '/_leaflet_test.js' ? LEAFLET : path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  fs.readFile(f, (e, buf) => {
    if (e) { res.statusCode = 404; res.end(); return; }
    const ext = path.extname(f).slice(1);
    res.setHeader('content-type', { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webmanifest: 'application/manifest+json', css: 'text/css', pbf: 'application/x-protobuf', webp: 'image/webp' }[ext] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(8768, () => console.log('fake supabase on 8768'));
