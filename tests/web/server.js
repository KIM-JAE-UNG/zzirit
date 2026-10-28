// Fake Supabase backend: tables, own-row checks through account links, a trigger-like guard, realtime feed, RPCs
const http = require('http'), fs = require('fs'), path = require('path');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const ROOT = path.resolve(__dirname, '..', '..'), LEAFLET = LIB('leaflet/dist/leaflet.js');
let ver = 1; const events = []; const STATS = { photoSelects: 0 };
const T = { anglers: {}, photos: {}, labels: {}, orders: {}, suggest: {}, admin_docs: {}, spots: {}, board: {}, teams: {}, news: {} };
const admins = new Set(); const links = {}; const codes = {};
const acct = uid => links[uid] || uid;
const key = (t, row) => t === 'photos' ? row.angler + '|' + row.cid : row.id;
const cell = v => (Math.floor(v / 0.25) + 0.5) * 0.25;
function canWrite(t, row, uid) {
  if (!uid) return false;
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
    return send({ data: JSON.parse(JSON.stringify(rows.slice(0, q.limit || 1000))) });
  }
  if (u.pathname === '/__sb/upsert') {
    const q = await body(req); let row = JSON.parse(JSON.stringify(q.row));
    if (!canWrite(q.table, row, q.uid)) return send({ error: { code: '42501', message: 'new row violates row-level security policy' } });
    const k = key(q.table, row); const old = T[q.table][k];
    if (q.table === 'anglers') row = guard(row, old);
    if (q.table === 'orders') row = ordersGuard(row, old);
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
      if (!(admins.has(uid) || admins.has(acct(uid)))) return send({ error: { message: 'not_admin' } });
      const target = acct(q.args.p_uid); if (admins.has(target)) return send({ error: { message: 'cannot_delete_admin' } });
      for (const t of ['anglers', 'labels', 'orders', 'suggest', 'board', 'teams']) if (T[t][target]) { delete T[t][target]; push(t, 'DELETE', {}, { id: target }); }
      for (const [k, r] of Object.entries(T.photos)) if (r.angler === target) { delete T.photos[k]; push('photos', 'DELETE', {}, { angler: r.angler, cid: r.cid }); }
      for (const [n, l] of Object.entries(logins)) if (l.owner === target) delete logins[n];
      return send({ data: true });
    }
    return send({ error: { message: 'no such rpc ' + q.name } });
  }
  if (u.pathname === '/__fn/news') {
    const now = new Date().toISOString();
    const items = [['ko', '부산 앞바다서 1.2m 부시리 낚아… 역대급 손맛', '바다신문'], ['ko', '제주 갯바위서 초대형 돌돔 잡혀 화제', '제주일보'], ['ko', '낚싯배서 희귀 어종 포획, 학계 관심', '해양뉴스'], ['en', 'Angler lands record 300-pound bluefin tuna', 'Fishing Times'], ['en', 'Giant catfish caught in river breaks state record', 'Outdoor News'], ['ja', '巨大マダイ釣り上げ 記録級の大物', '釣り新聞']];
    items.forEach(([lang, title, source], i) => { const id = 'n' + i; T.news[id] = { id, lang, title, link: 'https://example.com/n' + i, source, pub: new Date(Date.now() - i * 3600e3).toISOString(), score: 40 - i, fetched_at: now }; push('news', 'INSERT', T.news[id]); });
    return send({ ok: true, added: items.length });
  }
  if (u.pathname === '/__fn/review') {
    let n = 0; const v = T.admin_docs.verdicts || (T.admin_docs.verdicts = { id: 'verdicts', data: {} }); const ar = T.admin_docs.autorev || (T.admin_docs.autorev = { id: 'autorev', data: {} });
    for (const [id, a] of Object.entries(T.anglers)) for (const c of (a.data.catches || [])) {
      if (c.st !== 'review' || (v.data[id] && v.data[id][c.id])) continue;
      const hasPhoto = Object.values(T.photos).some(p => p.angler === id && p.cid === c.id);
      const verdict = !hasPhoto ? 'no' : c.sp === 'saba' ? 'no' : 'hold';
      const why = !hasPhoto ? 'no_photo|' : verdict === 'no' ? 'species|Chub mackerel?' : 'unclear|사진이 흐려요';
      v.data[id] = Object.assign({}, v.data[id], { [c.id]: verdict });
      ar.data[id] = Object.assign({}, ar.data[id], { [c.id]: { v: verdict, why, m: 'fake', at: Date.now() } }); n++;
    }
    if (n) { push('admin_docs', 'UPDATE', v, { id: 'verdicts' }); push('admin_docs', 'UPDATE', ar, { id: 'autorev' }); }
    return send({ ok: true, decided: n });
  }
  if (u.pathname === '/__sb/changes') { const since = +u.searchParams.get('since') || 0; return send({ ver, events: events.filter(e => e.ver > since) }); }
  if (u.pathname === '/__sb/dump') return send({ T, admins: [...admins], links, STATS });
  if (u.pathname === '/__sb/grant') { const q = await body(req); const g = T.admin_docs.grants || (T.admin_docs.grants = { id: 'grants', data: {} }); g.data[q.uid] = Object.assign({}, g.data[q.uid], { [q.oid]: q.v }); push('admin_docs', 'UPDATE', g, { id: 'grants' }); return send({ ok: true }); }
  const f = u.pathname === '/_leaflet_test.js' ? LEAFLET : path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  fs.readFile(f, (e, buf) => {
    if (e) { res.statusCode = 404; res.end(); return; }
    const ext = path.extname(f).slice(1);
    res.setHeader('content-type', { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webmanifest: 'application/manifest+json' }[ext] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(8768, () => console.log('fake supabase on 8768'));
