/* ===== 바다 땅따먹기 & 동호회 대항전: the water of the world in squares of 0.1° (about 10 km). Every fish landed in 찌릿 라이브
   adds its score to my power in that square for the week; the most power owns it, until someone lands more. Clubs own a
   square with their members' power together. The server counts it all (0030) and says who took what from whom.
   In the live screen the flag button flies the camera up over the sea: the squares stand up as blocks (mine sky-blue,
   others indigo, a club's in its colour), flags carry the owners' names, a tap on a square says how much power it takes.
   Taking a square sets off a flag; losing one shows on the button and in the panel with a 「되찾기」. Last week's squares
   pay once (10P each, at most 100). Names show at the square at most; fishing unnamed keeps the name hidden. Website only. ===== */
const TF = { on: false, view: 'me', me: null, cells: [], teams: {}, marks: [], off: false, busy: false, at: 0, cam: null, sel: null, p: null, want: false, places: null, fetchT: 0, mineN: null };
const TF_D = 0.1;
const tfOn = () => typeof lvOn === 'function' && lvOn() && !!APP_AUTH.live.turfMe && !TF.off;
const tfOf = (lng, lat) => [Math.floor(lng / TF_D + 1e-9), Math.floor(lat / TF_D + 1e-9)];
const tfMid = (x, y) => ({ lng: (x + .5) * TF_D, lat: (y + .5) * TF_D });
const tfSeen = () => Object.assign({ w: 0, l: 0 }, lsGet('tfSeen', null) || {});
function tfNick(a) { if (!a) return t('tf_hidden'); if (a === myId()) return (S.me && S.me.nick) || t('tf_me'); return lvNick(a); }
// a square's name: the nearest town (from the app's own list) within ~45 km, else the sea
function tfName(x, y) {
  const c = tfMid(x, y), li = Math.max(0, ['ko', 'en', 'ja', 'zh'].indexOf(S.lang));
  let best = null, bd = 0.42 * 0.42;
  for (const p of TF.places || []) { const dx = (p[0] - c.lng) * Math.cos(c.lat * Math.PI / 180), dy = p[1] - c.lat, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } }
  if (best) return t('tf_off', { p: [best[5], best[4], best[6], best[7]][li] || best[4] });
  try { return dict(GEO.seaOf(c.lng, c.lat).n) || t('tf_sq'); } catch (e) { return t('tf_sq'); }
}
function tfPlaces() { if (TF.places) return Promise.resolve(TF.places); return fetch('geo/places.json').then(r => r.json()).then(j => { TF.places = Array.isArray(j) ? j : []; return TF.places; }).catch(() => { TF.places = []; return []; }); }
function tfLeft(ms) { const h = Math.max(0, Math.floor(ms / 3600e3)); return h >= 24 ? t('tf_left_d', { d: Math.floor(h / 24), h: h % 24 }) : t('tf_left_h', { h: Math.max(1, h) }); }

/* --- my week (the news, the badge, the celebration) --- */
function tfLoad(force) {
  if (!tfOn()) return Promise.resolve(null);
  if (TF.p) return TF.p;
  if (!force && TF.me && nowMs() - TF.at < 20e3) return Promise.resolve(TF.me);
  TF.p = APP_AUTH.live.turfMe().then(r => {
    if (!r || r.err || !Array.isArray(r.log)) return null;
    const first = !TF.me; TF.me = r; TF.at = nowMs();
    const sn = tfSeen(), wonMax = Math.max(0, ...r.log.filter(g => g.k === 'won').map(g => g.id)), lostMax = Math.max(0, ...r.log.filter(g => g.k === 'lost').map(g => g.id));
    if (!lsGet('tfSeen', null)) lsSet('tfSeen', { w: wonMax, l: lostMax }); // the first look: nothing old to celebrate
    else if (!first || force) {
      const fresh = r.log.filter(g => g.k === 'won' && g.id > sn.w).sort((a, b) => a.id - b.id);
      if (fresh.length) { lsSet('tfSeen', Object.assign(tfSeen(), { w: wonMax })); tfWin(fresh); }
    }
    tfPanel(); if (TF.on) lsSet('tfSeen', Object.assign(tfSeen(), { l: Math.max(tfSeen().l, lostMax) }));
    tfBadge();
    return r;
  }).catch(e => { if (e && (e.code === 'need_update' || e.code === 'not_granted')) { TF.off = true; tfBadge(); } return null; }).finally(() => { TF.p = null; });
  return TF.p;
}
const tfLost = () => (TF.me ? TF.me.log.filter(g => g.k === 'lost' && g.id > tfSeen().l) : []);
const tfClaimable = () => !!(TF.me && TF.me.last && TF.me.last.n > 0 && !TF.me.last.got);
function tfBadge() {
  const b = $('#lv-tf'); if (b) b.hidden = !tfOn();
  const n = tfLost().length + (tfClaimable() ? 1 : 0);
  $$('[data-tfdot]').forEach(d => { d.hidden = !n || TF.on; d.textContent = n > 9 ? '9+' : String(n || ''); });
}
// after a landed fish: did it take a square?
function tfAfterLand() { if (tfOn()) setTimeout(() => tfLoad(true).then(() => { if (TF.on) tfFetch(); }), 400); }

/* --- the celebration: a flag goes up --- */
function tfWin(list) {
  const g = list[list.length - 1], host = $('#lv'); if (!host || !g) return;
  tfPlaces().then(() => {
    const from = g.who ? t('tf_win_from', { n: tfNick(g.who) }) : t('tf_win_new');
    let el = $('.tf-win', host); if (el) el.remove();
    el = document.createElement('div'); el.className = 'tf-win'; el.setAttribute('role', 'status');
    el.innerHTML = `<div class="tf-win-in"><span class="tf-rays" aria-hidden="true"></span><span class="tf-wflag" aria-hidden="true">${tfFlagSVG('#7CC4FF')}</span>
      <p class="tf-win-k">${t('tf_win_k')}</p><h3>${esc(tfName(g.x, g.y))}</h3><p class="tf-win-s">${esc(from)}${list.length > 1 ? ' · ' + esc(t('tf_win_more', { n: list.length })) : ''}</p>
      <button class="btn btn-primary btn-sm" data-tfgo="1">${icon('flag')}${t('tf_see')}</button></div>`;
    host.appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('[data-tfgo]')) { el.remove(); tfOpen(g.x, g.y); } else el.remove(); });
    if (typeof LVS !== 'undefined') { LVS.ac(); [392, 523, 659, 784, 1047].forEach((f, i) => LVS.tone(f, f, .26, .12, 'triangle', i * .1)); LVS.noise(.35, .08, 300, .02); LVS.buzz([30, 50, 30, 50, 180]); }
    setTimeout(() => { if (el.isConnected) el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 5200);
  });
}
const tfFlagSVG = c => `<svg viewBox="0 0 40 48" width="40" height="48"><path d="M6 46V4" stroke="#E3F3FF" stroke-width="3" stroke-linecap="round"/><path d="M8 5h24l-5 8 5 8H8z" fill="${c}" stroke="#0B1730" stroke-width="1.5" stroke-linejoin="round"/><path d="M17 8l-3 6h4l-2 5" stroke="#0B1730" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* --- the war map --- */
function tfOpen(fx, fy) {
  if (!tfOn() || !LV.map || !LV.ready) { TF.want = true; return; }
  if (LV.phase !== 'idle' && LV.phase !== 'result') { lvSay(t('tf_busy')); return; }
  const m = LV.map, c = m.getCenter();
  if (!TF.on) TF.cam = { center: [c.lng, c.lat], zoom: m.getZoom(), pitch: m.getPitch(), bearing: m.getBearing() };
  TF.on = true; TF.sel = null; $('#lv').classList.add('tf-on'); $('#lv-res').hidden = true; if (LV.phase === 'result') { LV.phase = 'idle'; }
  const to = fx != null ? tfMid(fx, fy) : (LV.stand || LV.pos || { lng: c.lng, lat: c.lat });
  m.easeTo({ center: [to.lng, to.lat], zoom: LV.w && LV.w < 600 ? 8.4 : 8.9, pitch: 52, bearing: -12, duration: 1400 });
  if (fx != null) TF.sel = [fx, fy];
  tfPanel(); tfBadge(); tfPlaces().then(() => tfPanel());
  m.once('moveend', () => { tfFetch(); if (TF.sel) tfCard(); });
  if (!TF.mv) { TF.mv = true; m.on('moveend', () => { if (TF.on) { clearTimeout(TF.fetchT); TF.fetchT = setTimeout(tfFetch, 250); } }); m.on('styledata', () => { if (TF.on) setTimeout(tfPaint, 50); }); }
  tfLoad(true);
  // the news was seen
  if (TF.me) lsSet('tfSeen', Object.assign(tfSeen(), { l: Math.max(tfSeen().l, ...TF.me.log.map(g => g.id)) }));
}
function tfClose(go) {
  if (!TF.on) return;
  TF.on = false; TF.sel = null; $('#lv').classList.remove('tf-on', 'tf-sel');
  tfMarks([]); const m = LV.map;
  try { if (m.getLayer('tf-top')) m.removeLayer('tf-top'); if (m.getLayer('tf-box')) m.removeLayer('tf-box'); if (m.getSource('tf')) m.removeSource('tf'); } catch (e) { }
  const p = $('#tf-panel'); if (p) p.hidden = true; const cd = $('#tf-card'); if (cd) cd.hidden = true;
  if (go) { const c = tfMid(go[0], go[1]); LV.mode = 'remote'; LV.stand = null; LV.target = null; LV.wantSite = false; lvMe(); lvCoast(c); lvHud(); }
  else if (TF.cam) m.easeTo(Object.assign({ duration: 1100 }, TF.cam));
  tfBadge(); lvHud();
}
function tfBox() {
  const m = LV.map, b = m.getBounds(), c = m.getCenter(), [cx, cy] = tfOf(c.lng, c.lat);
  let [x0, y0] = tfOf(b.getWest(), b.getSouth()), [x1, y1] = tfOf(b.getEast(), b.getNorth());
  x0 = Math.max(x0, cx - 30); x1 = Math.min(x1, cx + 30); y0 = Math.max(y0, cy - 30); y1 = Math.min(y1, cy + 30);
  return [x0, y0, Math.max(x0, x1), Math.max(y0, y1)];
}
function tfFetch() {
  if (!TF.on || TF.busy) return;
  TF.busy = true; const box = tfBox();
  APP_AUTH.live.turf(...box).then(r => {
    if (!r || !Array.isArray(r.cells)) return;
    TF.cells = r.cells; TF.teams = Object.assign(TF.teams, r.teams || {}); TF.ends = r.ends; TF.now = r.now; TF.box = box;
    tfPaint(); if (TF.sel) tfCard();
  }).catch(e => { if (e && e.code === 'need_update') { TF.off = true; tfClose(); } }).finally(() => { TF.busy = false; });
}
const TF_COL = { me: '#7CC4FF', other: '#5866D8', hide: '#58657E' };
function tfColor(c) {
  if (TF.view === 'club') { const tm = c.t && TF.teams[c.t]; return tm ? tm.color : null; }
  return c.me ? TF_COL.me : c.a ? TF_COL.other : TF_COL.hide;
}
function tfPaint() {
  if (!TF.on || !LV.map) return;
  const m = LV.map, feats = [];
  for (const c of TF.cells) {
    const col = tfColor(c); if (!col) continue;
    const pw = TF.view === 'club' ? c.tp : c.p, x = c.x * TF_D, y = c.y * TF_D, e = .006;
    feats.push({ type: 'Feature', properties: { col, h: Math.round(Math.min(14000, 900 + Math.sqrt(pw || 0) * 420)), me: TF.view === 'club' ? (TF.me && TF.me.team && c.t === TF.me.team.id ? 1 : 0) : c.me ? 1 : 0, k: c.x + ',' + c.y },
      geometry: { type: 'Polygon', coordinates: [[[x + e, y + e], [x + TF_D - e, y + e], [x + TF_D - e, y + TF_D - e], [x + e, y + TF_D - e], [x + e, y + e]]] } });
  }
  const data = { type: 'FeatureCollection', features: feats }; TF.feats = feats;
  try {
    if (m.getSource('tf')) m.getSource('tf').setData(data);
    else {
      m.addSource('tf', { type: 'geojson', data });
      m.addLayer({ id: 'tf-box', type: 'fill-extrusion', source: 'tf', paint: { 'fill-extrusion-color': ['get', 'col'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .78, 'fill-extrusion-vertical-gradient': true } });
      m.addLayer({ id: 'tf-top', type: 'line', source: 'tf', paint: { 'line-color': ['case', ['==', ['get', 'me'], 1], '#E3F3FF', 'rgba(227,243,255,.35)'], 'line-width': ['case', ['==', ['get', 'me'], 1], 2, 1] } });
    }
  } catch (e) { }
  // flags with names: the strongest squares in sight
  const list = TF.cells.filter(c => tfColor(c)).sort((a, b) => (b.me - a.me) || ((TF.view === 'club' ? b.tp : b.p) - (TF.view === 'club' ? a.tp : a.p))).slice(0, 36);
  tfMarks(list);
}
function tfMarks(list) {
  const keep = new Map(); for (const mk of TF.marks) keep.set(mk.k, mk);
  const want = new Set(list.map(c => c.x + ',' + c.y + TF.view));
  for (const mk of TF.marks) if (!want.has(mk.k)) { try { mk.m.remove(); } catch (e) { } keep.delete(mk.k); }
  if (!window.maplibregl) { TF.marks = []; return; }
  TF.marks = list.map(c => {
    const k = c.x + ',' + c.y + TF.view; let mk = keep.get(k);
    const club = TF.view === 'club', tm = club && TF.teams[c.t], col = tfColor(c), mine = club ? !!(TF.me && TF.me.team && c.t === TF.me.team.id) : c.me;
    const label = club ? `${esc(tm ? (tm.emoji || '') + ' ' + (tm.tag || tm.name) : '?')}` : esc(tfNick(c.a));
    const html = `<span class="tf-fl" style="--c:${esc(col)}">${tfFlagSVG(col)}</span><span class="tf-nm">${label}<b class="num">${fmtN(club ? c.tp : c.p)}</b></span>`;
    if (!mk) {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'tf-mk';
      el.addEventListener('click', e => { e.stopPropagation(); TF.sel = [c.x, c.y]; tfCard(); });
      mk = { k, el, m: new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([(c.x + .5) * TF_D, (c.y + .5) * TF_D]).addTo(LV.map) };
    }
    mk.el.classList.toggle('mine', !!mine); mk.el.setAttribute('aria-label', tfName(c.x, c.y)); mk.el.innerHTML = html;
    return mk;
  });
}
function tfTap(lng, lat) { TF.sel = tfOf(lng, lat); tfCard(); }
// one square: who holds it, how much it takes
function tfCard() {
  const el = $('#tf-card'); if (!el || !TF.sel) return;
  const [x, y] = TF.sel, c = TF.cells.find(q => q.x === x && q.y === y), club = TF.view === 'club';
  const mp = c ? c.mp : 0, op = c ? c.p : 0, pc = op ? Math.min(100, Math.round(100 * mp / op)) : 0;
  let body;
  if (club) {
    const tm = c && c.t && TF.teams[c.t], my = TF.me && TF.me.team;
    body = tm ? `<p class="tf-own" style="--c:${esc(tm.color)}"><i class="tf-dot"></i><b>${esc((tm.emoji || '') + ' ' + tm.name)}</b><span class="num">${fmtN(c.tp)}</span></p>
      <p class="tf-say">${my && my.id === tm.id ? t('tf_club_ours') : t('tf_club_theirs')}</p>` : `<p class="tf-say">${t('tf_club_free')}</p>`;
  } else if (!c) body = `<p class="tf-say">${t('tf_free')}</p>`;
  else if (c.me) body = `<p class="tf-own me"><i class="tf-dot"></i><b>${t('tf_mine')}</b><span class="num">${fmtN(c.p)}</span></p><p class="tf-say">${t(c.c > 1 ? 'tf_mine_keep' : 'tf_mine_alone')}</p>`;
  else body = `<p class="tf-own"><i class="tf-dot"></i><b>${esc(tfNick(c.a))}</b><span class="num">${fmtN(c.p)}</span></p>
      <div class="tf-vs"><span>${t('tf_my_power')}</span><span class="ms-bar"><i style="width:${pc}%"></i></span><b class="num">${fmtN(mp)}</b></div>
      <p class="tf-say">${t('tf_need', { n: fmtN(op - mp + 1) })}</p>`;
  el.hidden = false; $('#lv').classList.add('tf-sel');
  el.innerHTML = `<button class="tf-x" data-tfx="card" aria-label="${esc(t('close'))}">${icon('close')}</button>
    <p class="tf-cn">${icon('flag')}<span>${esc(tfName(x, y))}</span></p>${body}
    <button class="btn btn-primary btn-block" data-tffish="${x},${y}">${icon('live')}${t(c && c.me && !club ? 'tf_fish_keep' : 'tf_fish')}</button>
    <small class="tf-rem">${t('tf_remote', { n: lvLeft() })}</small>`;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function tfPanelHTML() {
  const r = TF.me, club = TF.view === 'club';
  const tabs = `<div class="seg tf-seg" role="tablist">${[['me', 'tf_tab_me'], ['club', 'tf_tab_club']].map(([k, l]) => `<button role="tab" aria-selected="${TF.view === k}" data-tfview="${k}">${t(l)}</button>`).join('')}</div>`;
  const left = TF.ends || (r && r.ends), now = TF.now || (r && r.now) || nowMs();
  const head = `<div class="tf-head"><h2>${icon('flag')}${t('tf_title')}</h2>${left ? `<span class="tf-left">${icon('clock')}${esc(tfLeft(left - now))}</span>` : ''}<button class="tf-x" data-tfx="panel" aria-label="${esc(t('close'))}">${icon('close')}</button></div>`;
  if (!r) return head + tabs + `<p class="tf-wait"><span class="pl-spin"></span>${t('lv_loading')}</p>`;
  const claim = tfClaimable() ? `<button class="tf-claim" data-tfclaim="1">${icon('coin')}<span>${t('tf_claim', { n: r.last.n })}</span><b class="num">+${r.last.pts}P</b></button>` : '';
  const lost = tfLost();
  const news = r.log.slice(0, 4).map(g => `<li class="${g.k}${g.k === 'lost' && lost.some(q => q.id === g.id) ? ' new' : ''}"><i>${icon(g.k === 'won' ? 'flag' : 'bolt')}</i><span>${esc(t(g.k === 'won' ? (g.who ? 'tf_log_won' : 'tf_log_new') : 'tf_log_lost', { n: tfNick(g.who), p: tfName(g.x, g.y) }))}</span>${g.k === 'lost' ? `<button class="btn btn-sm btn-glass" data-tfat="${g.x},${g.y}">${t('tf_back')}</button>` : ''}</li>`).join('');
  if (club) {
    const my = r.team;
    const me = my ? `<p class="tf-big" style="--c:${esc(my.color)}"><b class="num">${fmtN(my.n)}</b><span>${t('tf_club_n', { t: (my.emoji || '') + ' ' + my.name })}${my.rk ? ` · <em>${t('tf_rank', { n: my.rk })}</em>` : ''}</span></p>`
      : `<p class="tf-big"><span>${t('tf_club_none')}</span><a class="btn btn-sm btn-glass" href="#teams">${icon('users')}${t('tf_club_join')}</a></p>`;
    const rows = r.clubs.map(c => `<li class="${my && c.id === my.id ? 'me' : ''}"><b class="num">${c.rk}</b><i class="tf-dot" style="--c:${esc(c.color)}"></i><span>${esc((c.emoji || '') + ' ' + c.name)}${c.tag ? ` <small>${esc(c.tag)}</small>` : ''}</span><em class="num">${t('tf_n_sq', { n: fmtN(c.n) })}</em></li>`).join('');
    return head + tabs + me + `<h3 class="tf-h">${t('tf_clubs')}</h3>` + (rows ? `<ol class="tf-board">${rows}</ol>` : `<p class="tf-empty">${t('tf_clubs_empty')}</p>`) + `<p class="tf-how">${t('tf_how_club')}</p>`;
  }
  const rows = r.lords.map(l => `<li class="${l.a === myId() ? 'me' : ''}"><b class="num">${l.rk}</b>${l.a ? avatar(anglerOf(l.a), 24) : `<i class="tf-dot"></i>`}<span>${esc(tfNick(l.a))}</span><em class="num">${t('tf_n_sq', { n: fmtN(l.n) })}</em></li>`).join('');
  return head + tabs + claim + `<p class="tf-big"><b class="num">${fmtN(r.n)}</b><span>${t('tf_my_n')}${r.rk ? ` · <em>${t('tf_rank', { n: r.rk })}</em>` : ''}</span></p>`
    + (news ? `<ul class="tf-news">${news}</ul>` : '')
    + `<h3 class="tf-h">${t('tf_lords')}</h3>` + (rows ? `<ol class="tf-board">${rows}</ol>` : `<p class="tf-empty">${t('tf_lords_empty')}</p>`)
    + `<p class="tf-how">${t('tf_how')}</p>`;
}
function tfPanel() {
  const p = $('#tf-panel'); if (!p) return;
  if (!TF.on) { p.hidden = true; return; }
  p.hidden = false; p.innerHTML = tfPanelHTML();
}
function tfClaim(btn) {
  if (btn.disabled) return; btn.disabled = true;
  APP_AUTH.live.turfClaim().then(r => {
    if (!r || r.err) { toast(t(r && r.err === 'no_profile' ? 'ls_need_profile' : r && r.err === 'already' ? 'tf_claim_done' : 'lv_err'), 'warn'); return tfLoad(true); }
    LVS.play('coin'); LVS.buzz([20, 40, 20]); toast(t('tf_claimed', { n: r.n, p: r.pts }), 'ok', 4200);
    if (TF.me) TF.me.last.got = true; if (LV.st) LV.st.bal = r.bal; if (typeof msBal === 'function') msBal(r.bal);
    tfPanel(); tfBadge();
  }).catch(() => toast(t('lv_err'), 'warn')).finally(() => { btn.disabled = false; });
}
function tfClick(e) {
  const b = e.target.closest('[data-tfview],[data-tfx],[data-tffish],[data-tfat],[data-tfclaim]'); if (!b) return;
  if (b.dataset.tfview) { TF.view = b.dataset.tfview; tfPanel(); tfPaint(); if (TF.sel) tfCard(); tfFetch(); tfLoad(true); }
  else if (b.dataset.tfx === 'card') { $('#tf-card').hidden = true; TF.sel = null; $('#lv').classList.remove('tf-sel'); }
  else if (b.dataset.tfx) tfClose();
  else if (b.dataset.tffish) tfClose(b.dataset.tffish.split(',').map(Number));
  else if (b.dataset.tfat) { const [x, y] = b.dataset.tfat.split(',').map(Number); TF.sel = [x, y]; const c = tfMid(x, y); LV.map.easeTo({ center: [c.lng, c.lat], zoom: Math.max(8, LV.map.getZoom()), duration: 900 }); tfCard(); }
  else if (b.dataset.tfclaim) tfClaim(b);
}
// the team page: this week's club war in one card
function tfTeamCardHTML() {
  if (!tfOn() || !TF.me) return '';
  const my = TF.me.team, top = TF.me.clubs.slice(0, 3);
  return `<section class="tf-tcard card"><div class="tf-tc-h"><h2 class="h3">${icon('flag')}${t('tf_war')}</h2><a class="btn btn-sm btn-primary" href="#live" data-tfwant="1">${t('tf_war_go')}</a></div>
    <p class="muted small">${t('tf_war_sub')}</p>
    ${my ? `<p class="tf-tc-me" style="--c:${esc(my.color)}"><i class="tf-dot"></i><b>${esc((my.emoji || '') + ' ' + my.name)}</b><span>${t('tf_n_sq', { n: fmtN(my.n) })}${my.rk ? ' · ' + t('tf_rank', { n: my.rk }) : ''}</span></p>` : ''}
    ${top.length ? `<ol class="tf-board">${top.map(c => `<li class="${my && c.id === my.id ? 'me' : ''}"><b class="num">${c.rk}</b><i class="tf-dot" style="--c:${esc(c.color)}"></i><span>${esc((c.emoji || '') + ' ' + c.name)}</span><em class="num">${t('tf_n_sq', { n: fmtN(c.n) })}</em></li>`).join('')}</ol>` : `<p class="tf-empty">${t('tf_clubs_empty')}</p>`}</section>`;
}
document.addEventListener('click', e => { if (e.target.closest('[data-tfwant]')) { TF.want = true; TF.view = 'club'; } });
