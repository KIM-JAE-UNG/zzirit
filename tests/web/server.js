// Fake Supabase backend: tables, own-row checks through account links, a trigger-like guard, realtime feed, RPCs
const http = require('http'), fs = require('fs'), path = require('path');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const ROOT = path.resolve(__dirname, '..', '..'), LEAFLET = LIB('leaflet/dist/leaflet.js');
let ver = 1; const events = []; const STATS = { photoSelects: 0 };
const T = { anglers: {}, photos: {}, labels: {}, orders: {}, suggest: {}, admin_docs: {}, spots: {}, board: {}, teams: {}, news: {}, points: {}, reviews: {}, chat: {}, dm: {} };
const FEATURES = { del: true, wd: true };
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
      return send({ data: { ok: true } });
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
  if (u.pathname === '/__sb/feature') { for (const [k, v] of u.searchParams) FEATURES[k] = v === '1'; return send(FEATURES); }
  if (u.pathname === '/__sb/dump') return send({ T, admins: [...admins], links, STATS, PUSH, PUSHLOG, logins: Object.keys(logins), MUTES, RTSTATS, RT: Object.fromEntries(Object.entries(RT).map(([k, m]) => [k, [...m.values()].map(x => x.key)])) });
  if (u.pathname === '/__sb/config') { const q = await body(req); const g = T.admin_docs.config || (T.admin_docs.config = { id: 'config', data: {} }); g.data = Object.assign({}, g.data, q); push('admin_docs', 'UPDATE', g, { id: 'config' }); return send({ ok: true }); }
  if (u.pathname === '/__sb/grant') { const q = await body(req); const g = T.admin_docs.grants || (T.admin_docs.grants = { id: 'grants', data: {} }); g.data[q.uid] = Object.assign({}, g.data[q.uid], { [q.oid]: q.v }); push('admin_docs', 'UPDATE', g, { id: 'grants' }); return send({ ok: true }); }
  const f = u.pathname === '/_leaflet_test.js' ? LEAFLET : path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  fs.readFile(f, (e, buf) => {
    if (e) { res.statusCode = 404; res.end(); return; }
    const ext = path.extname(f).slice(1);
    res.setHeader('content-type', { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webmanifest: 'application/manifest+json' }[ext] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(8768, () => console.log('fake supabase on 8768'));
