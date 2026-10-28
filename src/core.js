/* ===== Utilities ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function escapeHTML(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const esc = escapeHTML;
function lsGet(k, d) { try { const v = localStorage.getItem('eosin.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem('eosin.' + k, JSON.stringify(v)); } catch (e) { } }
function rid(n = 8) { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(n)); for (const x of r) s += a[x % a.length]; return s; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nowMs = () => Date.now();
function icon(id, cls = '') { return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`; }

/* ===== Constants ===== */
/* App name lives in build.py (BRAND) so a rename is a one-line change */
const APP_NAME = ['__APP_KO__', '__APP_EN__', '__APP_EN__', '__APP_EN__'];
const DEV = { name: '김재웅', kakaoId: 'rlawodnd12', kakaoUrl: 'https://qr.kakao.com/talk/p1SyBTckPfcUiMyir.g0YMNOWaQ-', kakaoPayUrl: 'https://qr.kakaopay.com/FJ3WJxUGJfa07228' };
const EA_CC = ['KR', 'JP', 'CN', 'TW', 'HK', 'MO', 'MN'];
const COUNTRIES = ['KR', 'JP', 'CN', 'TW', 'HK', 'MO', 'MN', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'PE', 'CO', 'GB', 'IE', 'FR', 'DE', 'ES', 'PT', 'IT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'FI', 'DK', 'IS', 'PL', 'CZ', 'HU', 'GR', 'TR', 'RU', 'UA', 'IL', 'AE', 'SA', 'EG', 'ZA', 'KE', 'MA', 'IN', 'LK', 'BD', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'KH', 'MM', 'AU', 'NZ', 'FJ'];
const HOMES = ['KW', 'KS', 'KE', 'KJ', 'KF', 'JP', 'JF', 'CN', 'CF', 'TW', 'ST', 'NP', 'NA', 'GM', 'MD', 'AU', 'IO', 'SA', 'FN', 'FE', 'FS', 'FA', 'FO', 'FF'];
const FREE_PAST = 5, PAST_PRICE = 500, DONATE_AMT = 500;
const SHOP = [
  { id: 'th_dawn', k: 'theme', p: 0, n: ['새벽 방파제', 'Dawn breakwater', '夜明けの堤防', '黎明防波堤'] },
  { id: 'th_day', k: 'theme', p: 0, n: ['한낮 연안', 'Midday coast', '真昼の沿岸', '正午海岸'] },
  { id: 'th_sunset', k: 'theme', p: 1000, n: ['노을 등대', 'Sunset lighthouse', '夕焼けの灯台', '晚霞灯塔'] },
  { id: 'th_night', k: 'theme', p: 1500, n: ['집어등 밤바다', 'Squid-light night', '集魚灯の夜の海', '集鱼灯夜海'] },
  { id: 'th_reef', k: 'theme', p: 1500, n: ['산호 리프', 'Coral reef', 'サンゴ礁', '珊瑚礁'] },
  { id: 'th_aurora', k: 'theme', p: 2000, n: ['오로라 피오르', 'Aurora fjord', 'オーロラのフィヨルド', '极光峡湾'] },
  { id: 'th_sakura', k: 'theme', p: 1000, n: ['벚꽃 포구', 'Cherry-blossom harbor', '桜の漁港', '樱花渔港'] },
  { id: 'dc_weed', k: 'decor', p: 0, n: ['해초', 'Seaweed', '海藻', '海草'] },
  { id: 'dc_rock', k: 'decor', p: 0, n: ['바위', 'Rocks', '岩', '礁石'] },
  { id: 'dc_buoy', k: 'decor', p: 0, n: ['주황 부표', 'Orange buoy', 'オレンジのブイ', '橙色浮标'] },
  { id: 'dc_tetra', k: 'decor', p: 500, n: ['테트라포드', 'Tetrapods', 'テトラポッド', '消波块'] },
  { id: 'dc_light', k: 'decor', p: 500, n: ['빨간 등대', 'Red lighthouse', '赤い灯台', '红色灯塔'] },
  { id: 'dc_floats', k: 'decor', p: 500, n: ['찌 모빌', 'Float mobile', 'ウキのモビール', '浮漂风铃'] },
  { id: 'dc_boat', k: 'decor', p: 1000, n: ['낚싯배', 'Fishing boat', '釣り船', '钓船'] },
  { id: 'dc_chest', k: 'decor', p: 500, n: ['보물상자', 'Treasure chest', '宝箱', '宝箱'] },
  { id: 'dc_anchor', k: 'decor', p: 500, n: ['닻', 'Anchor', '錨', '锚'] },
  { id: 'dc_jelly', k: 'decor', p: 1000, n: ['빛나는 해파리', 'Glowing jellyfish', '光るクラゲ', '发光水母'] },
  { id: 'dc_turtle', k: 'decor', p: 1000, n: ['바다거북 친구', 'Sea turtle buddy', 'ウミガメ', '海龟伙伴'] },
  { id: 'dc_coral', k: 'decor', p: 1000, n: ['산호 정원', 'Coral garden', 'サンゴの庭', '珊瑚花园'] },
  { id: 'dc_trophy', k: 'decor', p: -1, n: ['금빛 트로피', 'Golden trophy', '金のトロフィー', '金色奖杯'] },
  { id: 'fx_rays', k: 'fx', p: 500, n: ['햇살 커튼', 'Light rays', '光のカーテン', '光束'] },
  { id: 'fx_plankton', k: 'fx', p: 1000, n: ['야광 플랑크톤', 'Glowing plankton', '夜光プランクトン', '夜光浮游生物'] },
  { id: 'fl_gold', k: 'flair', p: 500, n: ['금빛 닉네임', 'Gold nickname', 'ゴールドの名前', '金色昵称'] },
  { id: 'fl_wave', k: 'flair', p: 1000, n: ['물결 프로필 테두리', 'Wave profile frame', '波のプロフィール枠', '波浪头像框'] },
  { id: 'bd_starter', k: 'bundle', p: 1500, was: 2000, inc: ['th_sunset', 'dc_light', 'fx_rays'], n: ['노을 스타터 세트', 'Sunset starter set', '夕焼けスターターセット', '晚霞入门套装'] }
];
const SHOPI = Object.fromEntries(SHOP.map(s => [s.id, s]));

/* ===== App state ===== */
const S = {
  lang: 'ko', li: 0, theme: 'system', unit: 'cm',
  uid: null, isOwner: false, writable: null, mode: 'boot', ready: false,
  db: null, user: null, sample: null, sampleImages: false,
  me: null, anglers: new Map(), labels: new Map(),
  admin: { config: {}, grants: {}, verdicts: {} },
  myOrders: [], myLabels: [], mySuggest: [],
  allOrders: new Map(), allSuggest: new Map(),
  photoCache: new Map(),
  route: 'home', viewUid: null, dataVer: 0
};

/* ===== Store: shared db with local fallback ===== */
const store = (() => {
  const queue = new Map();
  async function write(path, data) {
    // one write at a time per document; coalesce bursts
    const q = queue.get(path) || { running: false, next: null };
    queue.set(path, q);
    q.next = data;
    if (q.running) return;
    q.running = true;
    try {
      while (q.next) {
        const d = q.next; q.next = null;
        await S.db.doc(path).set(d);
      }
    } finally { q.running = false; }
  }
  function goLocal(reason) {
    if (S.mode === 'local') return;
    S.mode = 'local'; S.writable = false;
    if (reason) toast(t('toast_local_mode'), 'info');
    if (!S.me) S.me = lsGet('me', null);
    rerender();
  }
  async function safeWrite(path, data, localKey) {
    if (S.mode === 'shared' && S.db && S.uid) {
      try { await write(path, data); return true; }
      catch (e) {
        if (e && (e.code === 'invalid_argument' || e.code === 'not_granted' || e.code === 'revoked')) { goLocal(true); }
        else if (e && e.code === 'quota_exceeded') { toast(t('toast_quota'), 'warn'); }
        else { console.warn('write', e); toast(t('toast_write_fail'), 'warn'); }
      }
    }
    if (localKey) lsSet(localKey, data);
    return false;
  }
  return {
    async init() {
      S.mode = 'local';
      const [user, db, sample] = await Promise.all([
        window.claude?.use ? claude.use('user').catch(() => null) : null,
        window.claude?.use ? claude.use('db').catch(() => null) : null,
        window.claude?.use ? claude.use('sample').catch(() => null) : null
      ]);
      S.user = user; S.db = db; S.sample = sample;
      if (sample) { try { const lim = await sample.limits(); S.sampleImages = !!lim?.images; } catch (e) { S.sampleImages = false; } }
      if (user) {
        try { S.uid = await user.id(); } catch (e) { S.uid = null; }
        try { S.isOwner = await user.isOwner(); } catch (e) { }
        try { S.writable = await user.can('data.write'); } catch (e) { S.writable = null; }
      }
      // local copies first (fast paint)
      S.me = lsGet('me', null); S.myLabels = lsGet('labels', []); S.myOrders = lsGet('orders', []); S.mySuggest = lsGet('suggest', []);
      if (db) {
        const sub = (q, fn) => { try { return q.onSnapshot(fn, e => console.warn('snapshot', e)); } catch (e) { console.warn(e); } };
        sub(db.collection('anglers').limit(1000), snap => {
          const m = new Map(); for (const d of snap.docs) if (d.exists) m.set(d.id, d.data());
          S.anglers = m; S.dataVer++;
          if (S.uid && m.has(S.uid) && S.mode === 'shared') S.me = JSON.parse(JSON.stringify(m.get(S.uid)));
          try { frNotify(); } catch (e) { console.warn(e); }
          rerenderSoon();
        });
        sub(db.collection('labels').limit(1000), snap => { const m = new Map(); for (const d of snap.docs) if (d.exists) m.set(d.id, d.data()); S.labels = m; S.dataVer++; rerenderSoon(); });
        sub(db.collection('admin'), snap => { for (const d of snap.docs) if (d.exists) S.admin[d.id] = d.data(); rerenderSoon(); });
        if (S.uid && S.writable !== false) {
          S.mode = 'shared';
          sub(db.doc('orders/' + S.uid), d => { if (d.exists) S.myOrders = (d.data().items || []).slice(); rerenderSoon(); });
          sub(db.doc('suggest/' + S.uid), d => { if (d.exists) S.mySuggest = (d.data().items || []).slice(); });
          // first-time: migrate a local profile into the shared store
          setTimeout(async () => {
            if (S.mode !== 'shared') return;
            if (!S.anglers.has(S.uid)) {
              const local = lsGet('me', null);
              if (local && local.nick) { S.me = local; await this.saveMe(); }
            }
          }, 2500);
        }
        if (S.isOwner) {
          sub(db.collection('orders').limit(1000), snap => { const m = new Map(); for (const d of snap.docs) if (d.exists) m.set(d.id, d.data()); S.allOrders = m; rerenderSoon(); });
          sub(db.collection('suggest').limit(1000), snap => { const m = new Map(); for (const d of snap.docs) if (d.exists) m.set(d.id, d.data()); S.allSuggest = m; rerenderSoon(); });
        }
      }
      if (S.mode !== 'shared') S.mode = db ? 'local' : 'offline';
      S.ready = true;
      rerender();
    },
    async saveMe() {
      if (!S.me) return;
      S.me.upd = nowMs();
      lsSet('me', S.me);
      if (S.mode === 'shared') { S.anglers.set(S.uid, JSON.parse(JSON.stringify(S.me))); S.dataVer++; }
      await safeWrite('anglers/' + S.uid, S.me, 'me');
    },
    async savePhoto(cid, data) {
      S.photoCache.set((S.uid || 'local') + '/' + cid, data.t);
      if (S.mode === 'shared') return safeWrite('anglers/' + S.uid + '/photos/' + cid, data, null);
      const ph = lsGet('photos', {}); ph[cid] = data.t; const keys = Object.keys(ph); if (keys.length > 40) delete ph[keys[0]]; lsSet('photos', ph);
    },
    async getPhoto(uid, cid) {
      const key = (uid || 'local') + '/' + cid;
      if (S.photoCache.has(key)) return S.photoCache.get(key);
      if (!uid || uid === 'local') { const ph = lsGet('photos', {}); return ph[cid] || null; }
      if (!S.db) return null;
      try { const d = await S.db.doc('anglers/' + uid + '/photos/' + cid).get(); const v = d.exists ? d.data().t : null; S.photoCache.set(key, v); return v; } catch (e) { return null; }
    },
    async deletePhoto(cid) { if (S.mode === 'shared' && S.db) { try { await S.db.doc('anglers/' + S.uid + '/photos/' + cid).delete(); } catch (e) { } } else { const ph = lsGet('photos', {}); delete ph[cid]; lsSet('photos', ph); } },
    async addLabel(l) {
      S.myLabels.push(l); if (S.myLabels.length > 400) S.myLabels.shift();
      lsSet('labels', S.myLabels);
      if (S.mode === 'shared') { S.labels.set(S.uid, { items: S.myLabels.slice() }); S.dataVer++; await safeWrite('labels/' + S.uid, { items: S.myLabels }, 'labels'); }
    },
    async addOrder(o) {
      S.myOrders.push(o); lsSet('orders', S.myOrders);
      if (S.mode === 'shared') await safeWrite('orders/' + S.uid, { items: S.myOrders }, 'orders');
    },
    async addSuggestion(s) {
      S.mySuggest.push(s); lsSet('suggest', S.mySuggest);
      if (S.mode === 'shared') return safeWrite('suggest/' + S.uid, { items: S.mySuggest }, 'suggest');
      return false;
    },
    async saveAdmin(docId, data) {
      S.admin[docId] = data;
      if (S.db && S.isOwner) { try { await S.db.doc('admin/' + docId).set(data); return true; } catch (e) { console.warn(e); toast(t('toast_write_fail'), 'warn'); } }
      return false;
    }
  };
})();

/* ===== Derived data ===== */
function spName(sp, li = S.li) { if (!sp) return ''; return sp.n[li] || sp.n[1] || sp.n[0]; }
function nameOf(id) { if (!id) return ''; if (id.startsWith('other:')) return id.slice(6); return spName(SPI[id]); }
function myCatches() { return (S.me && S.me.catches) || []; }
function allAnglers() {
  const m = new Map(S.anglers);
  if (S.me && (S.mode !== 'shared' || !S.uid)) m.set(S.uid || 'local', Object.assign({ _local: true }, S.me));
  return m;
}
function verdict(uid, cid) { return (S.admin.verdicts && S.admin.verdicts[uid] && S.admin.verdicts[uid][cid]) || null; }
function eligible(c, uid) {
  const v = verdict(uid, c.id);
  if (v === 'no') return false;
  if (v === 'ok') return true;
  return c.st === 'ok';
}
function scoreOf(spId, len, rel, verified, featured) {
  const sp = SPI[spId]; if (!sp || !len) return 0;
  const ratio = Math.min(len, sp.X * 1.05) / sp.L;
  return Math.round(sp.r * 10 * Math.pow(ratio, 1.5) * (rel ? 1.2 : 1) * (verified ? 1.1 : 1) * (featured ? 2 : 1));
}
function monthKey(d) { return d.getFullYear() * 100 + d.getMonth(); }
function seasonOf(m) { return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'; }
function featuredSpecies(date = new Date()) {
  const m = date.getMonth();
  const krs = SP.filter(s => s.w !== 'F' && (s.ab.KS || s.ab.KW || s.ab.KE || s.ab.KJ) && !s.tox && s.r >= 2);
  const sc = krs.map(s => ({ id: s.id, v: +s.mo[m] * 10 + ((s.ab.KS || 0) + (s.ab.KW || 0) + (s.ab.KE || 0) + (s.ab.KJ || 0)) * 2 + s.r + (isClosed(s, date) ? -100 : 0) })).sort((a, b) => b.v - a.v);
  return sc.slice(0, 3).map(x => x.id);
}
function isFeaturedCatch(c) { const d = new Date(c.ts); const n = new Date(); return monthKey(d) === monthKey(n) && featuredSpecies(n).includes(c.sp); }
function isClosed(sp, date = new Date()) {
  const cl = sp && sp.lg && sp.lg.cl; if (!cl) return false;
  const v = (date.getMonth() + 1) * 100 + date.getDate(), a = cl[0] * 100 + cl[1], b = cl[2] * 100 + cl[3];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
}
function closedText(sp) { const cl = sp.lg && sp.lg.cl; return cl ? `${cl[0]}/${cl[1]}~${cl[2]}/${cl[3]}` : ''; }
function daysUntilClosed(sp, date = new Date()) {
  const cl = sp.lg && sp.lg.cl; if (!cl) return null;
  for (let i = 1; i <= 45; i++) { const d = new Date(date.getTime() + i * 86400000); if (isClosed(sp, d) && !isClosed(sp, new Date(d.getTime() - 86400000))) return i; }
  return null;
}
function owned(itemId) {
  const it = SHOPI[itemId]; if (!it) return false;
  if (it.p === 0) return true;
  if (it.p === -1) return trophyEarned();
  const grants = (S.admin.grants && S.admin.grants[S.uid || 'local']) || {};
  for (const o of S.myOrders) {
    if (o.kind !== 'item') continue;
    const st = grants[o.id];
    if (st === 'no') continue;
    if (o.ref === itemId) return true;
    const b = SHOPI[o.ref]; if (b && b.inc && b.inc.includes(itemId)) return true;
  }
  return false;
}
function orderState(o) { const g = (S.admin.grants && S.admin.grants[S.uid || 'local']) || {}; return g[o.id] || 'pending'; }
function pastUsed() { return myCatches().filter(c => c.past && c.st !== 'no').length; }
function pastCredits() {
  const g = (S.admin.grants && S.admin.grants[S.uid || 'local']) || {};
  return S.myOrders.filter(o => o.kind === 'past' && g[o.id] !== 'no').reduce((a, o) => a + (o.qty || 1), 0);
}
function pastLeft() { return Math.max(0, FREE_PAST + pastCredits() - pastUsed()); }
function supporter() { const g = (S.admin.grants && S.admin.grants[S.uid || 'local']) || {}; return S.myOrders.some(o => o.kind === 'donate' && g[o.id] !== 'no'); }

/* Leaderboard */
function periodStart(period, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  if (period === 'month') return new Date(y, m, 1).getTime();
  if (period === 'season') { const s = seasonOf(m); const sm = { spring: 2, summer: 5, autumn: 8, winter: 11 }[s]; const yy = s === 'winter' && m < 2 ? y - 1 : y; return new Date(yy, sm, 1).getTime(); }
  if (period === 'year') return new Date(y, 0, 1).getTime();
  return 0;
}
function leaderboard(scope = 'KR', period = 'month', cat = 'points', spId = null) {
  const rows = []; const t0 = periodStart(period);
  for (const [uid, a] of allAnglers()) {
    if (!a || !a.nick) continue;
    const cc = a.cc || 'KR';
    if (scope === 'KR' && cc !== 'KR') continue;
    if (scope === 'EA' && !EA_CC.includes(cc)) continue;
    if (scope === 'FR' && uid !== (S.uid || 'local') && relation(uid) !== 'friend') continue;
    const cs = (a.catches || []).filter(c => (c.ts || 0) >= t0 && (a._local ? false : eligible(c, uid)));
    let val = 0, best = null;
    if (cat === 'points') { for (const c of cs) { const v = c.sc || 0; val += v; if (!best || v > (best.sc || 0)) best = c; } }
    else if (cat === 'count') { val = cs.length; best = cs.slice().sort((a, b) => (b.sc || 0) - (a.sc || 0))[0]; }
    else if (cat === 'species') { val = new Set(cs.map(c => c.sp)).size; best = cs.slice().sort((a, b) => (b.sc || 0) - (a.sc || 0))[0]; }
    else if (cat === 'biggest') { for (const c of cs) { if (spId && c.sp !== spId) continue; if ((c.len || 0) > val) { val = c.len; best = c; } } }
    rows.push({ uid, a, val, best, local: !!a._local, n: cs.length });
  }
  rows.sort((x, y) => y.val - x.val || (y.best?.sc || 0) - (x.best?.sc || 0));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.val !== prev) rank = i + 1; prev = r.val; r.rank = r.val > 0 && !r.local ? rank : null; });
  return rows.filter(r => r.val > 0 || r.uid === (S.uid || 'local') || scope === 'FR');
}
function myRank(scope) { const lb = leaderboard(scope, 'month', 'points'); const r = lb.find(x => x.uid === (S.uid || 'local')); return r && r.rank ? { rank: r.rank, of: lb.filter(x => x.rank).length, val: r.val } : null; }
function trophyEarned() { const r = myRank('KR'); return !!(r && r.rank <= 10 && r.val > 0); }
function monthPts(uid, a) { const t0 = periodStart('month'); return (a.catches || []).filter(c => (c.ts || 0) >= t0 && eligible(c, uid)).reduce((s, c) => s + (c.sc || 0), 0); }
function lastCatch(uid, a) { let b = null; for (const c of (a.catches || [])) if (eligible(c, uid) && (!b || (c.at || c.ts) > (b.at || b.ts))) b = c; return b; }

/* ===== Friends =====
   Every angler writes only their own document, so each side of a link lives in anglers/{uid}.fr = { otherUid: [state, ts] }.
   state: 'r' requested · 'a' accepted · 'd' declined · 'x' removed. 'd'/'x' quietly hide later requests from that person.
   An accept only counts if it is newer than the request it answers, so a fresh request after an unfriend needs a fresh accept. */
const FR_MAX = 300, FR_PENDING_MAX = 30;
const myId = () => S.uid || 'local';
function anglerOf(uid) { return uid === myId() ? S.me : S.anglers.get(uid); }
function frEdge(a, uid) { const e = a && a.fr && a.fr[uid]; return Array.isArray(e) && e.length === 2 ? e : null; }
const frWants = e => !!e && (e[0] === 'r' || e[0] === 'a');
const frBlocks = e => !!e && (e[0] === 'd' || e[0] === 'x');
function frLinked(a, b) {
  if (!frWants(a) || !frWants(b)) return false;
  if (a[0] === 'a' && b[0] === 'r') return a[1] >= b[1];
  if (a[0] === 'r' && b[0] === 'a') return b[1] >= a[1];
  return true;
}
function relation(uid) {
  const me = myId(); if (!uid || uid === me) return 'self';
  const mine = frEdge(S.me, uid), theirs = frEdge(S.anglers.get(uid), me);
  if (frLinked(mine, theirs)) return 'friend';
  if (theirs && theirs[0] === 'r') return frBlocks(mine) ? 'hidden' : 'in';
  if (mine && mine[0] === 'r') return 'out';
  return 'none';
}
let _frCache = { v: -1 };
function frLists() {
  if (_frCache.v === S.dataVer && _frCache.me === S.me && _frCache.id === myId()) return _frCache;
  const L = { v: S.dataVer, me: S.me, id: myId(), friends: [], inc: [], out: [], hidden: [] };
  if (S.me) for (const [uid, a] of S.anglers) {
    if (uid === myId() || !a || !a.nick) continue;
    const r = relation(uid); if (r === 'none') continue;
    const mine = frEdge(S.me, uid), theirs = frEdge(a, myId());
    const ts = r === 'in' || r === 'hidden' ? theirs[1] : r === 'out' ? mine[1] : Math.max(mine ? mine[1] : 0, theirs ? theirs[1] : 0);
    (r === 'friend' ? L.friends : r === 'in' ? L.inc : r === 'out' ? L.out : L.hidden).push({ uid, a, ts });
  }
  for (const k of ['inc', 'out', 'hidden']) L[k].sort((x, y) => y.ts - x.ts);
  _frCache = L; return L;
}
function friendIdsOf(uid) {
  const a = anglerOf(uid); if (!a || !a.fr) return [];
  const out = [];
  for (const [x, e] of Object.entries(a.fr)) { if (!frWants(e)) continue; const b = anglerOf(x); if (b && frLinked(e, frEdge(b, uid))) out.push(x); }
  return out;
}
function mutualCount(uid) { const mine = new Set(frLists().friends.map(f => f.uid)); return friendIdsOf(uid).filter(x => mine.has(x)).length; }
function frCode(uid) {
  let h = 2166136261; for (const ch of String(uid)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; h >>>= 0;
  for (let i = 0; i < 6; i++) s += A[(h >>> (i * 5)) & 31];
  return s;
}
function frSearch(q) {
  const raw = String(q || '').trim(); if (!raw) return [];
  const code = raw.toUpperCase().replace(/[\s-]/g, ''), ql = raw.normalize('NFC').toLowerCase();
  const out = [];
  for (const [uid, a] of S.anglers) {
    if (uid === myId() || !a || !a.nick) continue;
    const nk = String(a.nick).normalize('NFC').toLowerCase();
    const s = /^[A-Z2-9]{6}$/.test(code) && frCode(uid) === code ? 100 : nk === ql ? 50 : nk.startsWith(ql) ? 20 : ql.length >= 2 && nk.includes(ql) ? 10 : 0;
    if (s) out.push({ uid, a, s });
  }
  return out.sort((x, y) => y.s - x.s || String(x.a.nick).localeCompare(String(y.a.nick))).slice(0, 20);
}
function frSuggest(n = 6) {
  if (!S.me) return [];
  const mySp = new Set(myCatches().map(c => c.sp)); const myFr = new Set(frLists().friends.map(f => f.uid));
  const rows = [];
  for (const [uid, a] of S.anglers) {
    if (uid === myId() || !a || !a.nick || a.frOff || relation(uid) !== 'none') continue;
    let s = 0; const why = [];
    const mutual = friendIdsOf(uid).filter(x => myFr.has(x)).length;
    if (mutual) { s += 2 * mutual; why.push(t('fr_mutual', { n: mutual })); }
    if (a.home && a.home === S.me.home) { s += 3; why.push(regionName(a.home)); }
    else if (a.cc && a.cc === S.me.cc) { s += 1.5; why.push(ccName(a.cc)); }
    const both = [...new Set((a.catches || []).map(c => c.sp))].filter(x => mySp.has(x) && SPI[x]);
    if (both.length) { s += Math.min(3, both.length); why.push(t('fr_why_sp', { sp: nameOf(both[0]) })); }
    const last = lastCatch(uid, a); if (last && nowMs() - (last.at || last.ts) < 30 * 864e5) s += 1;
    if (s > 0) rows.push({ uid, a, s, why: (why.length ? why : [regionName(a.home || 'KS')]).slice(0, 2).join(' · ') });
  }
  return rows.sort((x, y) => y.s - x.s).slice(0, n);
}
/* Toast when a request arrives or someone accepts mine while the app is open */
function frNotify() {
  if (S.mode !== 'shared' || !S.me || !S.me.nick) return;
  const L = frLists(); const inc = new Set(L.inc.map(x => x.uid)), fr = new Set(L.friends.map(x => x.uid));
  const prev = S._frPrev; S._frPrev = { inc, fr };
  if (!prev) return;
  for (const u of inc) if (!prev.inc.has(u)) toast(t('fr_new_req', { nick: S.anglers.get(u)?.nick || '?' }), 'info', 4800);
  for (const u of fr) if (!prev.fr.has(u) && !prev.inc.has(u)) toast(t('fr_new_friend', { nick: S.anglers.get(u)?.nick || '?' }), 'ok', 4800);
}

/* Crowd learning: confusion statistics & data counts */
let _learnCache = { v: -1 };
function learnStats() {
  if (_learnCache.v === S.dataVer) return _learnCache;
  const conf = new Map(); let total = 0, correct = 0; const per = new Map();
  const add = (l) => {
    if (!l || !l.p || !l.a) return; total++;
    if (l.p === l.a) correct++;
    const row = conf.get(l.p) || new Map(); row.set(l.a, (row.get(l.a) || 0) + 1); conf.set(l.p, row);
    const ps = per.get(l.p) || { n: 0, ok: 0 }; ps.n++; if (l.p === l.a) ps.ok++; per.set(l.p, ps);
  };
  const srcs = new Map(S.labels);
  if (S.mode !== 'shared') srcs.set('local', { items: S.myLabels });
  for (const [, d] of srcs) for (const l of (d.items || [])) add(l);
  const confusions = [];
  for (const [p, row] of conf) for (const [a, n] of row) if (a !== p) confusions.push({ p, a, n });
  confusions.sort((x, y) => y.n - x.n);
  _learnCache = { v: S.dataVer, conf, total, correct, per, confusions };
  return _learnCache;
}
function calibrate(cands) {
  // P(actual | AI says p) blended with the AI's own confidence
  const { conf } = learnStats(); const alpha = 6; const out = new Map();
  for (const { id, p } of cands) {
    const row = conf.get(id); let n = 0; if (row) for (const v of row.values()) n += v;
    out.set(id, (out.get(id) || 0) + p * alpha / (alpha + n));
    if (row) for (const [a, k] of row) out.set(a, (out.get(a) || 0) + p * k / (alpha + n));
  }
  return out;
}
let _cellCache = { v: -1 };
function cellCounts() {
  if (_cellCache.v === S.dataVer) return _cellCache.m;
  const m = new Map();
  for (const [uid, a] of allAnglers()) for (const c of (a.catches || [])) {
    if (c.lat == null || c.lon == null) continue; if (!a._local && !eligible(c, uid)) continue; if (a._local) continue;
    const s = GEO.inEA(c.lon, c.lat) ? .25 : 1; const key = GEO.cellKey(c.lon, c.lat, s);
    let e = m.get(key); if (!e) m.set(key, e = []); e.push({ sp: c.sp, m: new Date(c.ts).getMonth() });
  }
  _cellCache = { v: S.dataVer, m };
  return m;
}
function cellData(lon, lat, size, month) {
  const m = cellCounts(); const counts = new Map(); let N = 0;
  const base = GEO.inEA(lon, lat) ? .25 : 1;
  const steps = Math.max(1, Math.round(size / base));
  const lo0 = Math.floor((lon - size / 2) / base) * base, la0 = Math.floor((lat - size / 2) / base) * base;
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
    const arr = m.get(GEO.cellKey(lo0 + i * base + base / 2, la0 + j * base + base / 2, base)); if (!arr) continue;
    for (const r of arr) { const dm = Math.min(Math.abs(r.m - month), 12 - Math.abs(r.m - month)); if (dm > 1) continue; counts.set(r.sp, (counts.get(r.sp) || 0) + 1); N++; }
  }
  return { counts, N };
}
/* Posterior: expert prior + community records (Dirichlet-style blend) */
function posterior(lon, lat, month, size = .25) {
  const pr = GEO.prior(lon, lat, month, Math.min(.12, size / 2));
  const { counts, N } = cellData(lon, lat, size, month);
  const B = 10, out = [];
  const ids = new Set([...pr.keys(), ...counts.keys()]);
  for (const id of ids) { if (!SPI[id]) continue; const p0 = pr.get(id) || 0, n = counts.get(id) || 0; out.push({ id, p: (B * p0 + n) / (B + N), n, p0 }); }
  out.sort((a, b) => b.p - a.p);
  return { list: out, N };
}

/* ===== i18n helpers ===== */
function t(key, vars) {
  const e = T[key]; let s = e ? (e[S.li] != null && e[S.li] !== '' ? e[S.li] : e[1] || e[0]) : key;
  if (s.indexOf('{') >= 0) s = s.replace(/\{(\w+)\}/g, (m, k) => k === 'app' ? APP_NAME[S.li] : k === 'app_eun' ? APP_NAME[0] + josa(APP_NAME[0], '은', '는') : vars && vars[k] != null ? vars[k] : m);
  return s;
}
function josa(w, a, b) { w = String(w); const c = w.charCodeAt(w.length - 1); if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 ? a : b; return /[aeiouy]$/i.test(w) ? b : a; }
function dict(entry) { return entry ? (entry[S.li] || entry[1] || entry[0]) : ''; }
function monthName(m) { try { return new Date(2026, m, 1).toLocaleDateString(locale(), { month: 'long' }); } catch (e) { return String(m + 1); } }
function locale() { return ['ko-KR', 'en-US', 'ja-JP', 'zh-CN'][S.li]; }
function fmtN(n, d = 0) { return Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: d }); }
function fmtDate(ms, opts) { try { return new Date(ms).toLocaleDateString(locale(), opts || { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
function fmtDT(ms) { try { return new Date(ms).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function ago(ms) {
  const s = Math.max(1, Math.round((nowMs() - ms) / 1000));
  try { const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }); if (s < 60) return rtf.format(-s, 'second'); if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute'); if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour'); return rtf.format(-Math.round(s / 86400), 'day'); } catch (e) { return fmtDate(ms); }
}
function ccName(cc) { try { return new Intl.DisplayNames([locale()], { type: 'region' }).of(cc) || cc; } catch (e) { return cc; } }
function flag(cc) { if (!cc || cc.length !== 2) return ''; return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))); }
function lenFmt(cm) { if (cm == null) return ''; return S.unit === 'in' ? `${fmtN(cm / 2.54, 1)} in` : `${fmtN(cm, 1)} cm`; }
function wtFmt(kg) { if (!kg) return ''; return S.unit === 'in' ? `${fmtN(kg * 2.20462, 2)} lb` : `${fmtN(kg, 2)} kg`; }
function regionName(r) { return dict(T['rg_' + r]) || r; }
