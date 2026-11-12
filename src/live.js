/* ===== 찌릿 라이브: one game on the real map =====
   Stand by real water (or, a few times a day, pick a shore from far away), cast, wait for the 찌릿 of a bite, strike, reel.
   What is ours: it runs on the real sea's clock (tide, sunrise and sunset), the fish are the ones that live in that water
   this month, the bite is felt (the phone buzzes), and everyone's floats and bites show on the same map as they happen.
   The server decides the bite, the fish's class and size, and the points (rt-supabase.js → live). The phone never sends
   where the angler stands — only the patch of water the float is in. */
const LV = {
  built: false, map: null, ready: false, cv: null, raf: 0, pal: '', st: null, stAt: 0, err: '',
  pos: null, geo: 'off', watch: null, site: false, near: null,
  mode: 'look', stand: null, target: null, water: [], waterAt: 0,
  phase: 'idle', k: null, f: null, busy: false,
  others: new Map(), schools: [], schUntil: 0, schKey: '', fx: [], ticks: [],
  room: null, roomKey: '', anon: false, me: null, hold: false, lastT: 0, palAt: 0
};
const LV_TIERS = ['', 'lv_t1', 'lv_t2', 'lv_t3', 'lv_t4', 'lv_t5'];
const lvOn = () => window.APP_RT === 'web' && !!(window.APP_AUTH && APP_AUTH.live);
const lvReach = () => { const r = ZL.BY[myGear('rod')]; return (r && r.perk && r.perk.range) || 60; };
const lvFloat = () => myGear('float') || 'float_basic';
const lvLeft = () => (LV.st ? Math.max(0, LV.st.day.remoteMax - LV.st.day.remote) : 0);
const lvNick = uid => { const a = anglerOf(uid); return (a && a.nick) || t('lv_someone'); };

/* --- sound and buzz: small synthesized cues, nothing to download --- */
const LVS = {
  ctx: null, on: lsGet('liveSnd', true),
  ac() { if (!this.on) return null; try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { this.ctx = null; } return this.ctx; },
  tone(f0, f1, dur, vol = .12, type = 'sine', at = 0) {
    const c = this.ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .02);
  },
  noise(dur, vol = .1, freq = 1800, at = 0) {
    const c = this.ac(); if (!c) return; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + at);
  },
  play(k) {
    if (k === 'cast') this.noise(.28, .07, 2600);
    else if (k === 'plop') { this.tone(520, 130, .16, .14); this.noise(.12, .06, 900, .02); }
    else if (k === 'nib') this.tone(1250, 1100, .05, .06, 'triangle');
    else if (k === 'bite') { this.tone(880, 880, .12, .16, 'triangle'); this.tone(1320, 1320, .22, .16, 'triangle', .1); this.tone(1760, 1760, .3, .1, 'sine', .2); }
    else if (k === 'reel') this.tone(1900, 1500, .025, .03, 'square');
    else if (k === 'pull') this.tone(180, 120, .18, .1, 'sawtooth');
    else if (k === 'snap') { this.noise(.2, .16, 3200); this.tone(300, 80, .25, .1, 'sawtooth'); }
    else if (k === 'miss') this.tone(260, 150, .3, .08);
    else if (k === 'land') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, .22, .13, 'triangle', i * .09));
    else if (k === 'rare') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, f, .3, .13, 'triangle', i * .08));
  },
  buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } }
};

/* --- server state --- */
function lvLoad(force) {
  if (!lvOn()) return Promise.resolve(null);
  if (!force && LV.st && nowMs() - LV.stAt < 30e3) return Promise.resolve(LV.st);
  if (LV.stP) return LV.stP;
  LV.stP = APP_AUTH.live.state().then(st => {
    LV.st = st && typeof st === 'object' ? st : null; LV.stAt = nowMs(); LV.err = '';
    // a prize or a catch moved the wallet: the shop's own copy catches up (and tells of a prize once)
    if (LV.st && typeof ZP !== 'undefined' && ZP.st && ZP.st.bal !== LV.st.bal && !ZP.p) zpLoad(true).then(() => { if (['lures', 'home'].includes(viewOf(S.route))) rerenderSoon(); });
    return LV.st;
  })
    .catch(e => { LV.err = (e && e.code) || 'unavailable'; return LV.st; })
    .finally(() => { LV.stP = null; lvHud(); });
  return LV.stP;
}

/* --- which fish: the server rolled a class; the fish itself is one that lives in this water this month --- */
function lvRand(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const lvFits = (sp, kind) => (kind === 'sea' ? (sp.w === 'S' || sp.w === 'B') && ['shore', 'coast', 'brack', 'shelf'].includes(sp.z) : sp.w === 'F' || sp.w === 'B');
function lvPick(tier, seed, kind, lng, lat) {
  const rnd = lvRand(seed), m = new Date().getMonth() + 1, perk = ZL.perk(ZL.KINDS.map(myGear));
  let list = GEO.regionPrior(GEO.region(lng, lat, kind === 'sea'), m).filter(x => SPI[x.id] && lvFits(SPI[x.id], kind));
  if (!list.length) list = SP.filter(sp => lvFits(sp, kind)).map(sp => ({ id: sp.id, p: 1 / (sp.r * sp.r) }));
  for (let tr = tier; tr >= 1; tr--) {
    const c = list.filter(x => SPI[x.id].r === tr); if (!c.length) continue;
    const w = c.map(x => x.p * (perk.sp && perk.sp.includes(x.id) ? perk.x : 1)); let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < c.length; i++) { r -= w[i]; if (r <= 0) return c[i].id; }
    return c[c.length - 1].id;
  }
  return list[0] ? list[0].id : (kind === 'sea' ? 'maaji' : 'funa');
}
// the same sum the server does
const lvCm = (sp, u, v, big) => Math.round(Math.min(sp.X, big && sp.X > sp.L * 1.05 ? sp.L * 1.05 + (sp.X - sp.L * 1.05) * Math.pow(v, 1.7) : sp.L * (.55 + .5 * u)) * 10) / 10;

/* --- the view --- */
VIEWS.live = {
  render(el) {
    if (!lvOn()) { el.innerHTML = `<div class="page"><div class="empty card big"><h2>${t('lv_title')}</h2><p class="muted">${t('lv_web_only')}</p></div></div>`; return; }
    if (!LV.built || !el.querySelector('#lv')) lvBuild(el);
    lvResume();
  },
  leave() { lvPause(); }
};
function lvBuild(el) {
  el.innerHTML = `
  <div class="lv" id="lv">
    <div class="lv-map" id="lv-map"></div>
    <canvas class="lv-fx" id="lv-fx" aria-hidden="true"></canvas>
    <div class="lv-top">
      <div class="lv-chips" id="lv-chips"></div>
      <a class="lv-wallet" href="#lures" id="lv-wallet" aria-label="${esc(t('zp_title'))}"></a>
    </div>
    <div class="lv-side">
      <button class="lv-sbtn" id="lv-loc" aria-label="${esc(t('lv_locate'))}">${icon('locate')}</button>
      <button class="lv-sbtn" id="lv-book" aria-label="${esc(t('lv_book'))}">${icon('book')}</button>
      <a class="lv-sbtn" href="#lures" aria-label="${esc(t('nav_lures'))}">${icon('lure')}</a>
      <button class="lv-sbtn" id="lv-snd" aria-label="${esc(t('lv_sound'))}" aria-pressed="${LVS.on}">${icon('megaphone')}</button>
    </div>
    <div class="lv-ticker" id="lv-ticker" aria-live="polite"></div>
    <div class="lv-banner" id="lv-banner" aria-hidden="true"></div>
    <div class="lv-fight" id="lv-fight" hidden>
      <div class="lv-dist"><i id="lv-dbar"></i></div>
      <p id="lv-ftxt"></p>
    </div>
    <div class="lv-bottom">
      <p class="lv-hint" id="lv-hint" aria-live="polite"></p>
      <button class="lv-main" id="lv-main"><svg class="lv-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><circle cx="50" cy="50" r="46" id="lv-arc"/></svg><span id="lv-mtxt"></span></button>
      <div class="lv-sub" id="lv-sub"></div>
    </div>
    <div class="lv-res" id="lv-res" hidden></div>
    <div class="lv-cover" id="lv-cover"></div>
    <div class="lv-attr"><a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>
  </div>`;
  LV.built = true; LV.cv = $('#lv-fx', el);
  const main = $('#lv-main', el);
  const down = e => { e.preventDefault(); LV.hold = true; lvPress(); }, up = () => { LV.hold = false; };
  main.addEventListener('pointerdown', down); main.addEventListener('pointerup', up); main.addEventListener('pointerleave', up); main.addEventListener('pointercancel', up);
  main.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); }); main.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') up(); });
  main.addEventListener('contextmenu', e => e.preventDefault());
  $('#lv-loc', el).addEventListener('click', () => lvLocate(true));
  $('#lv-book', el).addEventListener('click', () => lvBook());
  $('#lv-snd', el).addEventListener('click', e => { LVS.on = !LVS.on; lsSet('liveSnd', LVS.on); e.currentTarget.setAttribute('aria-pressed', LVS.on); if (LVS.on) LVS.play('nib'); });
  $('#lv-sub', el).addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (b) lvSub(b.dataset.lv); });
  $('#lv-cover', el).addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (b) lvSub(b.dataset.lv); });
  $('#lv-res', el).addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (b) lvSub(b.dataset.lv); });
  LV.anon = !!lsGet('liveAnon', false);
  lvCover('load');
  LMAP.lib().then(lvMap).catch(() => lvCover('maperr'));
  lvLoad(true);
}
function lvMap(gl) {
  const h = GEO.HOME[homeRegion()] || [129.12, 35.15], c = LV.pos || lsGet('liveAt', null) || { lng: h[0], lat: h[1] };
  LV.pal = LMAP.phaseOf(c.lng, c.lat, nowMs()); LV.palAt = nowMs();
  let map;
  try {
    map = new gl.Map({ container: 'lv-map', style: LMAP.style(LV.pal, S.lang), center: [c.lng, c.lat], zoom: LV.pos ? 16.6 : 14.2, pitch: 58, bearing: 0, maxPitch: 68, minZoom: 3, maxZoom: 19,
      attributionControl: false, dragRotate: true, pitchWithRotate: false, touchPitch: false, localIdeographFontFamily: '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' });
  } catch (e) { lvCover('maperr'); return; }
  LV.map = map; window.__lvmap = map;
  const pad = () => { const h = $('#lv-map').clientHeight || 600; map.setPadding({ top: Math.round(h * .3), bottom: 150, left: 0, right: 0 }); }; pad(); map.on('resize', pad);
  map.on('load', () => { LV.ready = true; (LV.stP || Promise.resolve()).then(() => lvStart()); });
  map.on('idle', () => lvWater());
  map.on('click', e => lvTap(e.lngLat.lng, e.lngLat.lat));
  map.on('moveend', () => { const m = map.getCenter(); lsSet('liveAt', { lng: +m.lng.toFixed(4), lat: +m.lat.toFixed(4) }); });
  let errN = 0; map.on('error', () => { if (!LV.ready && ++errN > 6) lvCover('maperr'); });
}
// the map is there: the intro the first time, then the place
function lvStart() {
  if (!S.me || !S.me.nick) return lvCover('profile');
  if (!LV.st && LV.err) return lvCover('server');
  if (!lsGet('liveOk', false)) return lvCover('intro');
  lvCover('');
  if (lsGet('liveGeo', true)) lvGeo();
  lvHud(); lvRoom();
}
function lvResume() {
  if (LV.map) setTimeout(() => { try { LV.map.resize(); } catch (e) { } lvSize(); }, 60);
  if (LV.ready && $('#lv-cover') && !$('#lv-cover').dataset.k) { if (lsGet('liveGeo', true) && lsGet('liveOk', false)) lvGeo(); lvRoom(); }
  else if (LV.ready) lvStart();
  lvLoad(); lvHud();
  cancelAnimationFrame(LV.raf); LV.lastT = 0; LV.raf = requestAnimationFrame(lvFrame);
}
function lvPause() {
  cancelAnimationFrame(LV.raf); LV.raf = 0; LV.hold = false;
  if (LV.watch != null) { try { navigator.geolocation.clearWatch(LV.watch); } catch (e) { } LV.watch = null; }
  if (LV.phase === 'fight' && LV.k) { APP_AUTH.live.land(LV.k.token, LV.k.sp || '', false).catch(() => null); }
  if (LV.phase !== 'idle') { LV.phase = 'idle'; LV.k = null; LV.f = null; }
  lvLeaveRoom();
}
function liveStop() { try { lvPause(); } catch (e) { } LV.st = null; }

/* --- covers: loading, the first-time intro, no profile, no map --- */
function lvCover(k) {
  const el = $('#lv-cover'); if (!el) return;
  el.dataset.k = k; el.hidden = !k;
  if (!k) { el.innerHTML = ''; return; }
  const mark = `<span class="lv-cmark">${ZL.mark('silver', 'lvc')}</span>`;
  if (k === 'load') el.innerHTML = `<div class="lv-cbox">${mark}<p class="lv-cload">${t('lv_loading')}</p></div>`;
  else if (k === 'maperr') el.innerHTML = `<div class="lv-cbox">${mark}<h2>${t('lv_maperr_h')}</h2><p>${t('lv_maperr_p')}</p><button class="btn btn-primary btn-lg" data-lv="reload">${t('lv_retry')}</button></div>`;
  else if (k === 'server') el.innerHTML = `<div class="lv-cbox">${mark}<h2>${t('lv_title')}</h2><p>${t(LV.err === 'need_update' ? 'zp_err_server' : 'lv_err')}</p><button class="btn btn-primary btn-lg" data-lv="retry">${t('lv_retry')}</button></div>`;
  else if (k === 'profile') el.innerHTML = `<div class="lv-cbox">${mark}<h2>${t('lv_title')}</h2><p>${t('lv_need_nick')}</p><button class="btn btn-primary btn-lg" data-act="onboard">${t('lv_make_nick')}</button></div>`;
  else if (k === 'intro') el.innerHTML = `<div class="lv-cbox lv-intro">${mark}
      <h2>${t('lv_intro_h')}</h2>
      <ol class="lv-steps">
        <li>${icon('pin')}<span><b>${t('lv_in1_h')}</b>${t('lv_in1_p')}</span></li>
        <li>${icon('bolt')}<span><b>${t('lv_in2_h')}</b>${t('lv_in2_p')}</span></li>
        <li>${icon('users')}<span><b>${t('lv_in3_h')}</b>${t('lv_in3_p')}</span></li>
      </ol>
      <p class="lv-priv">${icon('lock')}<span>${t('lv_priv')}</span></p>
      <button class="btn btn-primary btn-lg btn-block" data-lv="go-geo">${icon('locate')}${t('lv_go_geo')}</button>
      <button class="btn btn-glass btn-block" data-lv="go-look">${t('lv_go_look')}</button>
    </div>`;
}

/* --- where am I --- */
function lvGeo() {
  if (!navigator.geolocation) { LV.geo = 'none'; lvHud(); return; }
  if (LV.watch != null) return;
  LV.geo = LV.pos ? 'on' : 'ask'; lvHud();
  LV.watch = navigator.geolocation.watchPosition(p => {
    const first = !LV.pos;
    LV.pos = { lng: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy || 30, t: nowMs() }; LV.geo = 'on';
    if (first) lvLocate(false); else { lvSite(); if (LV.mode === 'site' && LV.phase === 'idle') { LV.stand = { lng: LV.pos.lng, lat: LV.pos.lat }; lvMe(); } }
    lvHud();
  }, e => { LV.geo = e && e.code === 1 ? 'denied' : (LV.pos ? 'on' : 'none'); if (LV.geo !== 'on') { try { navigator.geolocation.clearWatch(LV.watch); } catch (x) { } LV.watch = null; } lvHud(); },
  { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 });
}
// fly to where I am; there I fish on the spot when water is in reach
function lvLocate(byHand) {
  if (!LV.pos) { if (byHand) { if (LV.geo === 'denied') toast(t('lv_geo_denied'), 'warn', 5000); else { lsSet('liveGeo', true); lvGeo(); toast(t('lv_geo_wait'), 'info'); } } return; }
  if (LV.phase !== 'idle') return;
  LV.mode = 'look'; LV.stand = null; LV.target = null; LV.wantSite = true;
  LV.map.easeTo({ center: [LV.pos.lng, LV.pos.lat], zoom: 16.6, duration: byHand ? 900 : 0 });
  lvMe(); lvHud();
}
// is there water within my cast? (asked when the tiles around me are loaded)
function lvSite() {
  if (!LV.pos || !LV.map) return;
  const c = LV.map.getCenter(); if (LMAP.dist({ lng: c.lng, lat: c.lat }, LV.pos) > 700 || LV.map.getZoom() < 14.5) return;
  const n = LMAP.nearest(LV.water, LV.pos.lng, LV.pos.lat, 3000);
  LV.near = n; LV.site = !!n && n.d <= lvReach() + Math.min(LV.pos.acc || 0, 40);
  if (LV.site && LV.wantSite && LV.phase === 'idle') { LV.wantSite = false; LV.mode = 'site'; LV.stand = { lng: LV.pos.lng, lat: LV.pos.lat }; LV.target = null; lvFace(); lvMe(); lvSchools(); lvRoom(); }
  else if (!LV.site && LV.mode === 'site' && LV.phase === 'idle') { LV.mode = 'look'; LV.stand = null; LV.target = null; lvMe(); }
}
function lvWater() {
  if (!LV.map || !LV.ready) return;
  LV.water = LV.map.getZoom() >= 13 ? LMAP.water(LV.map) : []; LV.waterAt = nowMs();
  lvSite(); lvSchoolsShow();
  // on the way to a far-away shore: stand at the water's edge as soon as it is in sight
  if (LV.remoteSeek && LV.mode === 'remote' && !LV.stand && LV.phase === 'idle' && LV.map.getZoom() >= 14.5) {
    const c = LV.map.getCenter(), sh = LMAP.shoreBy(LV.water, c.lng, c.lat, 1500);
    if (sh) { LV.remoteSeek = false; LV.stand = { lng: sh.lng, lat: sh.lat }; lvMe(); lvFace(); lvSchools(); lvRoom(); }
  }
  lvHud();
  if (nowMs() - LV.palAt > 240e3) { LV.palAt = nowMs(); const c = LV.map.getCenter(), p = LMAP.phaseOf(c.lng, c.lat, nowMs()); if (p !== LV.pal) { LV.pal = p; LV.map.setStyle(LMAP.style(p, S.lang)); } }
}
// look out over the water from where I stand
function lvFace() {
  if (!LV.stand || !LV.map) return;
  const n = LV.target || LMAP.nearest(LV.water, LV.stand.lng, LV.stand.lat, 400);
  const o = { center: [LV.stand.lng, LV.stand.lat], zoom: Math.max(16.4, Math.min(17.2, LV.map.getZoom())), duration: 900 };
  if (n && (n.lng !== LV.stand.lng || n.lat !== LV.stand.lat)) o.bearing = LMAP.bearing(LV.stand, n);
  LV.map.easeTo(o);
}
// my marker: my face where I stand
function lvMe() {
  const gl = window.maplibregl; if (!gl || !LV.map) return;
  const at = LV.stand || LV.pos;
  if (!at) { if (LV.me) { LV.me.remove(); LV.me = null; } return; }
  if (!LV.me) { const el = document.createElement('div'); LV.me = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([at.lng, at.lat]).addTo(LV.map); }
  LV.me.setLngLat([at.lng, at.lat]);
  const el = LV.me.getElement(), k = LV.mode + '|' + (S.me && S.me.upd);
  if (el.dataset.k !== k) { el.dataset.k = k; el.innerHTML = `<div class="lv-me ${LV.mode}"><span class="lv-me-av">${avatar(S.me, 40)}</span><i></i></div>`; }
}

/* --- schools: shared by everyone, moved by the server every ten minutes --- */
function lvSchools() {
  const at = LV.stand; if (!at || !lvOn()) return;
  const [cx, cy] = LMAP.cellOf(at.lng, at.lat), key = cx + ':' + cy;
  if (key === LV.schKey && nowMs() < LV.schUntil) return;
  LV.schKey = key; LV.schUntil = nowMs() + 30e3;
  APP_AUTH.live.schools(cx - 5, cy - 6, cx + 5, cy + 6).then(r => {
    if (!r || LV.schKey !== key) return;
    LV.schAll = (r.cells || []).map(c => Object.assign(LMAP.cellMid(c[0], c[1]), { s: c[2], cx: c[0], cy: c[1], ph: Math.random() * 6 }));
    LV.schUntil = Math.min(r.until || 0, nowMs() + 600e3) + 1500; lvSchoolsShow();
  }).catch(() => { LV.schUntil = nowMs() + 20e3; });
}
function lvSchoolsShow() { LV.schools = (LV.schAll || []).filter(s => LMAP.waterAt(LV.water, s.lng, s.lat)); }

/* --- taps on the map: where to stand, where to cast --- */
function lvTap(lng, lat) {
  if (LV.phase !== 'idle' || !LV.ready || ($('#lv-cover') && $('#lv-cover').dataset.k)) return;
  if (LV.map.getZoom() < 14.5) { LV.map.easeTo({ center: [lng, lat], zoom: 16.4 }); return; }
  const p = { lng, lat }, kind = LMAP.waterAt(LV.water, lng, lat), R = lvReach();
  if (LV.mode === 'site') {
    if (!kind) return lvSay(t('lv_tap_water'));
    if (LMAP.dist(LV.stand, p) <= R) LV.target = Object.assign(p, { kind });
    else { const q = LMAP.toward(LV.stand, p, R * .97), k2 = LMAP.waterAt(LV.water, q.lng, q.lat); if (!k2) return lvSay(t('lv_too_far', { m: R })); LV.target = Object.assign(q, { kind: k2 }); }
    lvHud(); return;
  }
  // from far away: tap water to stand on the shore beside it, tap land by the water to stand right there
  if (!lvLeft()) return lvSay(t('lv_remote_out'));
  if (!kind) {
    const n = LMAP.nearest(LV.water, lng, lat, R); if (!n) return lvSay(t('lv_tap_shore'));
    LV.stand = p; LV.target = null;
  } else if (LV.stand && LV.mode === 'remote' && LMAP.dist(LV.stand, p) <= R) LV.target = Object.assign(p, { kind });
  else {
    const s = LMAP.shoreBy(LV.water, lng, lat, 1200); if (!s) return lvSay(t('lv_tap_shore'));
    LV.stand = { lng: s.lng, lat: s.lat };
    const q = s.d <= R * .9 ? p : LMAP.toward(LV.stand, p, R * .85), k2 = LMAP.waterAt(LV.water, q.lng, q.lat);
    LV.target = k2 ? Object.assign(q, { kind: k2 }) : null;
  }
  LV.mode = 'remote'; lvMe(); lvFace(); lvSchools(); lvRoom(); lvHud();
}
// no target yet: aim at the best school in reach, or straight out
function lvAim() {
  const R = lvReach(), st = LV.stand; if (!st) return null;
  let best = null;
  for (const s of LV.schools) { const d = LMAP.dist(st, s); if (d <= R && d > 8 && (!best || s.s > best.s)) best = s; }
  if (best) return { lng: best.lng, lat: best.lat, kind: LMAP.waterAt(LV.water, best.lng, best.lat) };
  const n = LMAP.nearest(LV.water, st.lng, st.lat, R); if (!n) return null;
  for (const f of [.75, .55, .9, .35]) {
    const q = n.inside ? { lng: st.lng, lat: st.lat + f * R / 111320 } : LMAP.toward(st, n, Math.max(n.d + 6, R * f)), k = LMAP.waterAt(LV.water, q.lng, q.lat);
    if (k && LMAP.dist(st, q) <= R) return Object.assign(q, { kind: k });
  }
  return null;
}
let lvSayT = 0;
function lvSay(msg, ms = 2600) { const h = $('#lv-hint'); if (!h) return; h.textContent = msg; h.classList.add('say'); clearTimeout(lvSayT); lvSayT = setTimeout(() => { h.classList.remove('say'); lvHud(); }, ms); }

/* --- the big button --- */
function lvPress() {
  LVS.ac();
  if (LV.busy) return;
  const ph = LV.phase;
  if (ph === 'idle') {
    if (!LV.stand) { if (LV.geo === 'on' && LV.site) return lvLocate(true); return lvSub('remote'); }
    if (!LV.target) LV.target = lvAim();
    if (!LV.target) return lvSay(t(LV.mode === 'site' ? 'lv_tap_water' : 'lv_tap_shore'));
    lvCast();
  } else if (ph === 'wait') lvEarly();
  else if (ph === 'bite') lvStrike();
}
function lvSub(k) {
  if (k === 'reload') { location.reload(); return; }
  if (k === 'retry') { lvCover('load'); lvLoad(true).then(() => lvStart()); return; }
  if (k === 'go-geo' || k === 'go-look') { lsSet('liveOk', true); lsSet('liveGeo', k === 'go-geo'); lvCover(''); if (k === 'go-geo') lvGeo(); lvHud(); lvRoom(); if (k === 'go-look') lvSub('remote'); return; }
  if (k === 'again') { $('#lv-res').hidden = true; LV.phase = 'idle'; lvHud(); return; }
  if (k === 'book') { $('#lv-res').hidden = true; LV.phase = 'idle'; lvHud(); lvBook(); return; }
  if (LV.phase !== 'idle') return;
  if (k === 'site') lvLocate(true);
  else if (k === 'geo') { lsSet('liveGeo', true); lvGeo(); }
  else if (k === 'remote') {
    if (!lvLeft()) return lvSay(t('lv_remote_out'));
    LV.mode = 'remote'; LV.target = null; LV.wantSite = false;
    // the nearest water on the screen; none in sight → say so
    const c = LV.map.getCenter(), s = LV.map.getZoom() >= 13 ? LMAP.shoreBy(LV.water, c.lng, c.lat, 6000) : null;
    if (s) { LV.stand = { lng: s.lng, lat: s.lat }; lvMe(); lvFace(); lvSchools(); lvRoom(); }
    else { LV.stand = null; lvCoast(LV.pos || c); }
    lvHud();
  }
}
// far from any water on the screen: the nearest coast in the app's own outline of the world
function lvCoast(c) {
  lvSay(t('lv_seek'), 4000);
  fetch('geo/coast.json').then(r => r.json()).then(j => {
    let best = null, bd = 1e18; const cosl = Math.cos(c.lat * Math.PI / 180);
    for (const k of ['E2', 'W']) { const L = j[k]; if (!L) continue;
      for (const l of L.l) { let x = 0, y = 0; for (let i = 0; i < l.length; i += 2) { x += l[i]; y += l[i + 1]; const dx = (x / L.q - c.lng) * cosl, dy = y / L.q - c.lat, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x / L.q, y / L.q]; } } }
      if (best && bd < 4) break; }
    if (best && LV.mode === 'remote' && !LV.stand) { LV.remoteSeek = true; LV.map.jumpTo({ center: best, zoom: 15.6 }); }
  }).catch(() => lvSay(t('lv_tap_shore')));
}

/* --- cast → wait → bite → strike → fight → land --- */
function lvCast() {
  const tg = LV.target, st = LV.stand, [cx, cy] = LMAP.cellOf(tg.lng, tg.lat), site = LV.mode === 'site';
  LV.phase = 'cast'; LV.busy = true; LV.k = { t0: performance.now(), from: st, to: tg, fly: 0, site };
  LVS.play('cast'); lvFace(); lvHud();
  const anim = new Promise(r => setTimeout(r, 720));
  Promise.all([APP_AUTH.live.cast(cx, cy, tg.kind, site, LV.anon), anim]).then(([r]) => {
    LV.busy = false;
    if (!r || r.err) { LV.phase = 'idle'; LV.k = null; if (r && r.err === 'remote_out' && LV.st) LV.st.day.remote = LV.st.day.remoteMax; lvSay(t(r && r.err === 'remote_out' ? 'lv_remote_out' : 'lv_err')); lvHud(); return; }
    if (LV.phase !== 'cast') return;
    if (LV.st && !site) LV.st.day.remote = LV.st.day.remoteMax - r.left;
    const rnd = lvRand((Math.random() * 1e9) | 0), nibs = []; const n = r.wait > 7000 ? (rnd() < .6 ? 2 : 1) : (rnd() < .5 ? 1 : 0);
    for (let i = 0; i < n; i++) nibs.push(1500 + rnd() * Math.max(500, r.wait - 3200));
    Object.assign(LV.k, { token: r.token, wait: r.wait, win: r.win, school: r.school, feed: r.feed, t0: performance.now(), nibs: nibs.sort((a, b) => a - b), nib: 0, dip: 0 });
    LV.phase = 'wait'; LVS.play('plop'); lvFx('splash', tg, 1); lvTrack(); lvHud();
  }).catch(e => { LV.busy = false; LV.phase = 'idle'; LV.k = null; lvSay(t(e && e.code === 'slow' ? 'lv_slow' : e && e.code === 'no_profile' ? 'lv_need_nick' : 'lv_err')); lvHud(); });
}
function lvEnd(msgKey, snd) { LV.phase = 'idle'; LV.k = null; LV.f = null; LV.busy = false; LV.target = null; $('#lv-fight').hidden = true; if (snd) LVS.play(snd); lvTrack(); lvLoad(true); if (msgKey) lvSay(t(msgKey), 3200); lvHud(); }
function lvEarly() {
  const k = LV.k; if (!k || !k.token) return;
  APP_AUTH.live.strike(k.token).catch(() => null); // the server ends the cast
  lvFx('splash', k.to, .6); lvEnd('lv_early', 'miss');
}
function lvStrike() {
  const k = LV.k; if (!k || LV.busy) return;
  LV.busy = true; LV.phase = 'hook'; LVS.buzz(30); lvHud();
  APP_AUTH.live.strike(k.token).then(r => {
    LV.busy = false;
    if (!r || r.err) return lvEnd(r && r.err === 'early' ? 'lv_early' : 'lv_missed', 'miss');
    const id = lvPick(r.tier, r.seed, k.to.kind, k.to.lng, k.to.lat), sp = SPI[id], cm = lvCm(sp, r.u, r.v, r.big);
    const q = clamp((sp.r - 1) / 4 * .65 + cm / sp.X * .35 + (r.big ? .12 : 0), 0, 1), P = ZL.perk(ZL.KINDS.map(myGear));
    k.sp = id; k.cm = cm; k.big = r.big;
    LV.f = { T: 30, D: 60 + 40 * q, D0: 60 + 40 * q, q, P, pull: 0, next: 1.1 + Math.random(), slack: 0, t: 0, click: 0, side: 0, sv: 0 };
    LV.phase = 'fight'; $('#lv-fight').hidden = false; lvTrack(); lvHud();
  }).catch(() => { LV.busy = false; lvEnd('lv_err', 'miss'); });
}
function lvFightStep(dt) {
  const G = LV.f, k = LV.k; if (!G) return;
  G.t += dt; G.next -= dt;
  if (G.pull > 0) G.pull -= dt;
  else if (G.next <= 0) { G.pull = .6 + Math.random() * (.4 + G.q * .8); G.next = G.pull + 1.6 + Math.random() * (2.6 - G.q); LVS.play('pull'); LVS.buzz([35, 30, 60]); lvFx('splash', lvFishAt(), .5); }
  const pull = G.pull > 0, hold = LV.hold;
  if (hold) {
    const sweet = G.T >= 40 && G.T <= 85;
    G.D -= dt * (13 - 5 * G.q) * G.P.reel * (pull ? .35 : 1) * (sweet ? 1.45 : .8);
    G.T += dt * (pull ? 54 : 26) * (.8 + G.q * .7) * G.P.tension;
    G.click += dt; if (G.click > .09) { G.click = 0; LVS.play('reel'); }
  } else { G.T -= dt * 46; G.D = Math.min(G.D0, G.D + dt * (pull ? 6 : 2)); }
  G.T = clamp(G.T, 0, 100);
  G.slack = G.T < 6 ? G.slack + dt : 0;
  G.sv += (Math.random() - .5) * dt * 6; G.sv *= .96; G.side = clamp(G.side + G.sv * dt, -1, 1);
  if (G.T >= 100) return lvLose('lv_snap', 'snap');
  if (G.slack > 2.4) return lvLose('lv_slip', 'miss');
  if (G.D <= 0) return lvLand();
  const bar = $('#lv-dbar'); if (bar) bar.style.width = (100 - G.D / G.D0 * 100) + '%';
  const arc = $('#lv-arc'); if (arc) { arc.style.strokeDashoffset = String(289 * (1 - G.T / 100)); arc.setAttribute('class', G.T > 85 ? 'hot' : G.T >= 40 ? 'good' : 'low'); }
  const tx = $('#lv-ftxt'), msg = G.T > 85 ? t('lv_f_hot') : pull ? t('lv_f_pull') : G.T < 20 ? t('lv_f_slack') : t('lv_f_reel', { m: Math.max(1, Math.round(LMAP.dist(k.from, k.to) * G.D / G.D0)) });
  if (tx && tx.textContent !== msg) tx.textContent = msg;
}
function lvLose(key, snd) { const k = LV.k; if (k && k.token) APP_AUTH.live.land(k.token, k.sp || '', false).catch(() => null); LVS.buzz([40, 40, 40]); lvEnd(key, snd); }
function lvLand() {
  const k = LV.k; LV.phase = 'landing'; LV.busy = true; $('#lv-fight').hidden = true; lvHud();
  // a fish cannot come up before the server would believe it
  const waitMs = Math.max(0, 2700 - LV.f.t * 1000);
  setTimeout(() => APP_AUTH.live.land(k.token, k.sp, true).then(r => {
    LV.busy = false;
    if (!r || r.err || r.lost) return lvEnd('lv_err', 'miss');
    if (LV.st) { LV.st.day = Object.assign(LV.st.day, r.day); LV.st.bal = r.bal; }
    if (typeof ZP !== 'undefined' && ZP.st) ZP.st.bal = r.bal;
    LV.phase = 'result'; LV.target = null; LVS.play(r.tier >= 4 || r.big ? 'rare' : 'land'); LVS.buzz(r.tier >= 4 ? [60, 40, 60, 40, 160] : [50, 40, 90]);
    lvFx('splash', k.to, 1.2); lvResult(r);
    if (!LV.anon && LV.room) LV.room.send('catch', { u: myId(), n: S.me.nick, sp: r.sp, cm: r.cm, tier: r.tier, big: r.big, x: +k.to.lng.toFixed(5), y: +k.to.lat.toFixed(5), on: k.site ? 1 : 0 });
    LV.k = null; LV.f = null; lvTrack(); lvLoad(true); lvHud();
  }).catch(() => { LV.busy = false; lvEnd('lv_err', 'miss'); }), waitMs);
}
function lvResult(r) {
  const sp = SPI[r.sp], el = $('#lv-res'); if (!el || !sp) return;
  const tags = [r.first ? `<b class="lv-tag new">${t('lv_new')}</b>` : '', r.best ? `<b class="lv-tag">${t('lv_best')}</b>` : '', r.big ? `<b class="lv-tag">${t('lv_big')}</b>` : '', r.onsite ? `<b class="lv-tag site">${t('lv_site')}</b>` : ''].join('');
  el.hidden = false; el.className = 'lv-res t' + r.tier;
  el.innerHTML = `<div class="lv-rcard" role="dialog" aria-label="${esc(spName(sp))}">
    <p class="lv-rtier">${t(LV_TIERS[r.tier])}</p>
    <div class="lv-rfish tone-${sp.w}"><img src="${FD.thumb(sp, 520, 260)}" alt=""></div>
    <h2>${esc(spName(sp))}</h2>
    <p class="lv-rcm"><b class="num">${fmtN(r.cm, 1)}</b><span>cm</span></p>
    <p class="lv-rtags">${tags}</p>
    <dl class="lv-rstat">
      <div><dt>${t('lv_r_pts')}</dt><dd class="num">+${fmtN(r.pts)}P</dd></div>
      <div><dt>${t('lv_r_score')}</dt><dd class="num">${fmtN(r.score)}</dd></div>
      <div><dt>${t('lv_r_week')}</dt><dd class="num">${fmtN(r.wk.s)}${r.wk.r ? `<small>${t('lv_rank_n', { n: r.wk.r })}</small>` : ''}</dd></div>
    </dl>
    ${r.capped ? `<p class="lv-rnote">${t('lv_capped', { n: r.day.cap })}</p>` : ''}
    <div class="lv-rbtn"><button class="btn btn-primary btn-lg" data-lv="again">${t('lv_again')}</button><button class="btn btn-glass btn-lg" data-lv="book">${t('lv_book')}</button></div>
  </div>`;
}
// where the fish is right now (between the float and me, swinging)
function lvFishAt() {
  const k = LV.k, G = LV.f; if (!k) return null; if (!G) return k.to;
  const p = LMAP.toward(k.from, k.to, LMAP.dist(k.from, k.to) * (.12 + .88 * G.D / G.D0)), b = LMAP.bearing(k.from, k.to) * Math.PI / 180, off = G.side * 7 * (G.D / G.D0 + .3);
  const mLon = 111320 * Math.cos(p.lat * Math.PI / 180);
  return { lng: p.lng + Math.cos(b) * off / mLon, lat: p.lat - Math.sin(b) * off / 111320 };
}

/* --- together: everyone's floats and bites, as they happen --- */
function lvRoom() {
  if (!lvOn() || !APP_AUTH.rt || !LV.ready || !lsGet('liveOk', false)) return;
  const at = LV.stand || LV.pos || (LV.map && { lng: LV.map.getCenter().lng, lat: LV.map.getCenter().lat }); if (!at) return;
  const key = 'live:' + Math.floor(at.lng / .2) + ':' + Math.floor(at.lat / .2);
  if (key === LV.roomKey && LV.room) return;
  lvLeaveRoom(); LV.roomKey = key;
  LV.room = APP_AUTH.rt.room(key, myId(), {
    events: ['bite', 'catch'],
    sync: st => { const m = new Map(); for (const [id, arr] of Object.entries(st || {})) { const p = arr && arr[arr.length - 1]; if (p && id !== myId() && p.f) m.set(id, p); } LV.others = m; lvHud(); },
    msg: (ev, p) => {
      if (!p || typeof p.x !== 'number') return;
      if (ev === 'bite') { lvFx('bolt', { lng: p.x, lat: p.y }, .8); }
      else if (ev === 'catch' && SPI[p.sp]) { lvFx('splash', { lng: p.x, lat: p.y }, 1); lvTick({ n: String(p.n || '').slice(0, 12), sp: p.sp, cm: +p.cm || 0, tier: p.tier | 0, on: !!p.on }); }
    },
    status: s => { if (s === 'SUBSCRIBED') lvTrack(); }
  });
}
function lvLeaveRoom() { if (LV.room) { try { LV.room.leave(); } catch (e) { } } LV.room = null; LV.roomKey = ''; LV.others = new Map(); }
function lvTrack() {
  if (!LV.room) return;
  const k = LV.k, out = k && k.token && !LV.anon && ['wait', 'bite', 'hook', 'fight'].includes(LV.phase);
  LV.room.track({ n: (S.me && S.me.nick) || '', f: out ? lvFloat() : '', x: out ? +k.to.lng.toFixed(5) : 0, y: out ? +k.to.lat.toFixed(5) : 0, ph: out ? LV.phase : '', on: k && k.site ? 1 : 0, t: nowMs() });
}
function lvTick(o) {
  const el = $('#lv-ticker'); if (!el || !SPI[o.sp]) return;
  const d = document.createElement('p'); d.className = 'lv-tick t' + (o.tier || 1);
  d.innerHTML = `${o.on ? `<i class="lv-tsite">${t('lv_site')}</i>` : ''}<b>${esc(o.n || t('lv_someone'))}</b> ${esc(spName(SPI[o.sp]))} <span class="num">${fmtN(o.cm, 1)}cm</span>${o.ago ? `<small>${esc(o.ago)}</small>` : ''}`;
  el.prepend(d); while (el.children.length > 3) el.lastChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 500); }, o.ago ? 9000 : 6500);
}

/* --- what the page says around the map --- */
function lvHud() {
  const root = $('#lv'); if (!root) return;
  const st = LV.st, ph = LV.phase, tg = LV.target, c = LV.map && LV.ready ? LV.map.getCenter() : null;
  // chips: the tide, feeding time, where I fish from, who is out
  const chips = [];
  try { const ti = tideInfo(homeRegion()); chips.push(`<span class="lv-chip">${icon('moon')}${esc(ti.label)} · ${t(ti.st > .7 ? 'lv_tide_hi' : ti.st > .35 ? 'lv_tide_mid' : 'lv_tide_lo')}</span>`); } catch (e) { }
  const fa = LV.stand || (c && { lng: c.lng, lat: c.lat }); if (fa && LMAP.feeding(fa.lng, nowMs())) chips.push(`<span class="lv-chip hot">${icon('bolt')}${t('lv_feed')}</span>`);
  if (LV.mode === 'site') chips.push(`<span class="lv-chip site">${icon('pin')}${t('lv_site')}</span>`);
  else if (st) chips.push(`<span class="lv-chip">${icon('globe')}${t('lv_remote_n', { n: lvLeft(), m: st.day.remoteMax })}</span>`);
  if (LV.others.size) chips.push(`<span class="lv-chip">${icon('users')}${t('lv_floats', { n: LV.others.size })}</span>`);
  const ch = $('#lv-chips'), html = chips.join(''); if (ch.dataset.h !== html) { ch.dataset.h = html; ch.innerHTML = html; }
  const w = $('#lv-wallet'), wh = st ? `${icon('coin')}<b class="num">${fmtN(st.bal)}</b><small>${t('lv_today', { n: st.day.pts, m: st.day.cap })}</small>` : ''; if (w.dataset.h !== wh) { w.dataset.h = wh; w.innerHTML = wh; }
  // the button and the line above it
  let label = t('lv_cast'), hint = '', cls = ph;
  if (ph === 'idle') {
    if (!LV.stand) {
      if (LV.geo === 'ask') { label = t('lv_remote'); hint = t('lv_geo_wait'); }
      else if (LV.geo === 'on' && LV.near && !LV.site) { label = t('lv_remote'); hint = t('lv_far', { d: LV.near.d < 1000 ? Math.round(LV.near.d / 10) * 10 + ' m' : (LV.near.d / 1000).toFixed(1) + ' km', m: lvReach() }); }
      else if (LV.geo === 'on' && LV.site) { label = t('lv_here'); hint = t('lv_site_ready'); }
      else if (LV.remoteSeek || LV.mode === 'remote') { label = t('lv_remote'); hint = t('lv_tap_shore'); }
      else { label = t('lv_remote'); hint = t(LV.geo === 'denied' ? 'lv_geo_denied' : 'lv_look'); }
      if (!lvLeft() && !(LV.geo === 'on' && LV.site)) { hint = t('lv_remote_out'); cls = 'idle off'; }
    } else hint = tg ? t('lv_ready') : t(LV.mode === 'site' ? 'lv_pick' : 'lv_pick_remote');
  } else if (ph === 'cast') { label = t('lv_cast'); hint = ''; }
  else if (ph === 'wait') { label = t('lv_strike'); hint = t(LV.k && LV.k.school ? 'lv_wait_school' : 'lv_wait'); }
  else if (ph === 'bite' || ph === 'hook') { label = t('lv_strike_now'); hint = ''; }
  else if (ph === 'fight') { label = t('lv_reel'); hint = ''; }
  else if (ph === 'landing') { label = '…'; hint = t('lv_landing'); }
  else if (ph === 'result') { label = t('lv_cast'); hint = ''; }
  const mt = $('#lv-mtxt'); if (mt.textContent !== label) mt.textContent = label;
  const main = $('#lv-main'); if (main.dataset.ph !== cls) { main.dataset.ph = cls; main.className = 'lv-main ' + cls; }
  const h = $('#lv-hint'); if (!h.classList.contains('say') && h.textContent !== hint) h.textContent = hint;
  root.dataset.ph = ph; root.dataset.mode = LV.mode;
  // the small buttons under it
  const sub = [];
  if (ph === 'idle') {
    if (LV.mode === 'site') sub.push(`<button class="lv-pill" data-lv="remote">${icon('globe')}${t('lv_to_remote')}</button>`);
    else if (LV.geo === 'on' && (LV.stand || LV.site)) sub.push(`<button class="lv-pill" data-lv="site">${icon('locate')}${t(LV.site ? 'lv_to_site' : 'lv_to_me')}</button>`);
    else if (LV.geo === 'off' || LV.geo === 'none') sub.push(`<button class="lv-pill" data-lv="geo">${icon('locate')}${t('lv_geo_on')}</button>`);
  }
  const sb = $('#lv-sub'), sh = sub.join(''); if (sb.dataset.h !== sh) { sb.dataset.h = sh; sb.innerHTML = sh; }
}

/* --- drawing on top of the map --- */
function lvSize() { const cv = LV.cv; if (!cv) return; const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); } LV.dpr = d; LV.w = r.width; LV.h = r.height; }
// a point on the ground and how many pixels a metre east / north is there
function lvG(p) {
  const m = LV.map, a = m.project([p.lng, p.lat]), mLon = 111320 * Math.cos(p.lat * Math.PI / 180), e = m.project([p.lng + 20 / mLon, p.lat]), n = m.project([p.lng, p.lat + 20 / 111320]);
  const g = { x: a.x, y: a.y, ex: (e.x - a.x) / 20, ey: (e.y - a.y) / 20, nx: (n.x - a.x) / 20, ny: (n.y - a.y) / 20 }; g.s = Math.sqrt(Math.abs(g.ex * g.ny - g.ey * g.nx)); return g;
}
function lvRingPath(c, g, r) { const d = LV.dpr; c.setTransform(d * g.ex, d * g.ey, d * g.nx, d * g.ny, d * g.x, d * g.y); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.setTransform(d, 0, 0, d, 0, 0); }
function lvFx(kind, at, power = 1) { if (at) LV.fx.push({ kind, at: { lng: at.lng, lat: at.lat }, t: 0, p: power, seed: Math.random() * 1000 }); if (LV.fx.length > 40) LV.fx.shift(); }
function lvFloatDraw(c, g, id, dip, t, alpha = 1, name = '') {
  const im = ZL.img(id, 'game'), k = clamp(g.s * 22, .26, .5), bob = Math.sin(t * 2.2 + g.x * .05) * 1.5;
  c.save(); c.globalAlpha = alpha;
  // the ring the float sits in
  lvRingPath(c, g, 1.6 + (Math.sin(t * 2.2) + 1) * .5); c.strokeStyle = 'rgba(227,243,255,.55)'; c.lineWidth = 1; c.stroke();
  if (im && im.complete && im.naturalWidth) { c.beginPath(); c.rect(g.x - 40, g.y - 120, 80, 120); c.clip(); c.drawImage(im, g.x - 120 * k, g.y - 80 * k + bob + dip, 240 * k, 120 * k); }
  c.restore();
  if (name) { c.save(); c.globalAlpha = alpha * .95; c.font = '600 11px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; const w = c.measureText(name).width + 12; c.fillStyle = 'rgba(5,10,19,.72)'; c.beginPath(); if (c.roundRect) c.roundRect(g.x - w / 2, g.y + 8, w, 18, 9); else c.rect(g.x - w / 2, g.y + 8, w, 18); c.fill(); c.fillStyle = '#E3F3FF'; c.fillText(name, g.x, g.y + 21); c.restore(); }
}
function lvBolt(c, x, y, h, seed, a) {
  c.save(); c.globalAlpha = a; c.lineJoin = 'miter';
  for (const [lw, col] of [[7, 'rgba(90,162,255,.35)'], [3, '#7CC4FF'], [1.2, '#FFFFFF']]) {
    c.beginPath(); let px = x + Math.sin(seed) * 16, py = y - h; c.moveTo(px, py);
    for (let i = 1; i <= 6; i++) { const ty = y - h + h * i / 6, tx = x + (i === 6 ? 0 : Math.sin(seed * (i + 1.3)) * 13 * (1 - i / 7)); c.lineTo(tx, ty); }
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  }
  c.restore();
}
function lvFrame(now) {
  LV.raf = requestAnimationFrame(lvFrame);
  const map = LV.map, cv = LV.cv; if (!map || !cv || !LV.ready) return;
  const dt = Math.min(.12, LV.lastT ? (now - LV.lastT) / 1000 : .016); LV.lastT = now; const T = now / 1000;
  if (!LV.w || (now | 0) % 30 === 0) lvSize();
  const c = cv.getContext('2d'), d = LV.dpr || 1; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, LV.w, LV.h);
  // the game's clock runs whatever the map shows
  if (LV.k && LV.k.token) {
    const k0 = LV.k, el = now - k0.t0;
    if (LV.phase === 'wait') {
      while (k0.nib < k0.nibs.length && el >= k0.nibs[k0.nib]) { k0.nib++; k0.dip = 5; LVS.play('nib'); LVS.buzz(18); lvFx('ring', k0.to, .5); }
      if (el >= k0.wait) { LV.phase = 'bite'; k0.biteAt = now; k0.dip = 14; LVS.play('bite'); LVS.buzz([0, 130, 50, 220]); lvFx('bolt', k0.to, 1); lvFx('splash', k0.to, .9); lvBanner(t('lv_zzirit')); if (!LV.anon && LV.room) LV.room.send('bite', { x: +k0.to.lng.toFixed(5), y: +k0.to.lat.toFixed(5) }); lvTrack(); lvHud(); }
    } else if (LV.phase === 'bite' && now - k0.biteAt > k0.win) lvEnd('lv_missed', 'miss');
    else if (LV.phase === 'fight') lvFightStep(dt);
  }
  const k = LV.k, ph = LV.phase, z = map.getZoom();
  if (z < 14.2) return;
  if (LV.stand && nowMs() > LV.schUntil) lvSchools();
  // schools: soft patches of light that breathe
  for (const s of LV.schools) {
    const g = lvG(s); if (g.x < -80 || g.x > LV.w + 80 || g.y < -80 || g.y > LV.h + 80) continue;
    const pulse = .5 + .5 * Math.sin(T * 1.4 + s.ph), r = 16 + s.s * 7;
    for (let i = 0; i < 3; i++) { lvRingPath(c, g, r * (.35 + i * .33) + pulse * 2.5); c.strokeStyle = `rgba(160,214,255,${(.13 + .09 * s.s) * (1 - i * .25) * (.6 + .4 * pulse)})`; c.lineWidth = 1.4; c.stroke(); }
    lvRingPath(c, g, r * .5); c.fillStyle = `rgba(124,196,255,${.05 + .035 * s.s})`; c.fill();
    // a fish or two turning under the surface
    c.save(); c.globalAlpha = .28 + .1 * s.s; c.fillStyle = '#DDF1FF';
    for (let i = 0; i < s.s + 1; i++) { const a = T * (.5 + i * .13) + s.ph + i * 2.1, rr = r * (.25 + .12 * i), fx = g.x + (Math.cos(a) * g.ex + Math.sin(a) * g.nx) * rr, fy = g.y + (Math.cos(a) * g.ey + Math.sin(a) * g.ny) * rr; c.beginPath(); c.ellipse(fx, fy, 4.5 * clamp(g.s * 14, .6, 1.5), 1.6 * clamp(g.s * 14, .6, 1.5), a + 1.57, 0, 6.2832); c.fill(); }
    c.restore();
  }
  // how far I can cast, and where I aim
  if (LV.stand && (ph === 'idle' || ph === 'cast')) {
    const g = lvG(LV.stand); lvRingPath(c, g, lvReach()); c.setLineDash([7, 7]); c.lineDashOffset = -T * 9; c.strokeStyle = 'rgba(124,196,255,.7)'; c.lineWidth = 1.6; c.stroke(); c.setLineDash([]);
    lvRingPath(c, g, lvReach()); c.fillStyle = 'rgba(124,196,255,.045)'; c.fill();
  }
  if (LV.target && ph === 'idle') {
    const g = lvG(LV.target), p = .5 + .5 * Math.sin(T * 4);
    lvRingPath(c, g, 3.2 + p * 1.2); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2; c.stroke(); lvRingPath(c, g, 1); c.fillStyle = '#7CC4FF'; c.fill();
    const a = lvG(LV.stand); c.beginPath(); c.moveTo(a.x, a.y - 34); c.quadraticCurveTo((a.x + g.x) / 2, Math.min(a.y, g.y) - 70, g.x, g.y); c.setLineDash([3, 6]); c.strokeStyle = 'rgba(227,243,255,.7)'; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]);
  }
  // everyone else's floats
  for (const [id, o] of LV.others) {
    if (!o.f || !ZL.BY[o.f]) continue; const g = lvG({ lng: o.x, lat: o.y }); if (g.x < -60 || g.x > LV.w + 60 || g.y < -60 || g.y > LV.h + 60) continue;
    lvFloatDraw(c, g, o.f, o.ph === 'bite' || o.ph === 'fight' ? 8 : 0, T + (o.t % 7), .92, String(o.n || '').slice(0, 10));
  }
  // my line and float
  if (k) {
    const a = lvG(k.from), tipX = a.x, tipY = a.y - 36;
    if (ph === 'cast') {
      const s = clamp((now - k.t0) / 700, 0, 1), b = lvG(k.to), x = tipX + (b.x - tipX) * s, y = tipY + (b.y - tipY) * s - Math.sin(s * Math.PI) * 90;
      c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo((tipX + x) / 2, Math.min(tipY, y) - 30 * Math.sin(s * Math.PI), x, y); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.1; c.stroke();
      c.beginPath(); c.arc(x, y, 3.2, 0, 6.2832); c.fillStyle = '#fff'; c.fill();
    } else if (['wait', 'bite', 'hook', 'fight', 'landing'].includes(ph)) {
      k.dip = ph === 'wait' ? k.dip * .9 : 14;
      const at = ph === 'fight' || ph === 'landing' ? lvFishAt() : k.to, b = lvG(at), G = LV.f, taut = G ? G.T / 100 : ph === 'bite' ? .7 : 0;
      c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo((tipX + b.x) / 2, (tipY + b.y) / 2 + 26 * (1 - taut), b.x, b.y - (ph === 'fight' ? 0 : 14));
      c.strokeStyle = G && G.T > 85 ? '#FF6B7E' : `rgba(255,255,255,${.6 + .35 * taut})`; c.lineWidth = 1.1 + taut * .6; c.stroke();
      if (ph === 'fight' || ph === 'landing') { const p = .5 + .5 * Math.sin(T * 9); lvRingPath(c, b, 2.4 + p * 1.4 + (G && G.pull > 0 ? 2 : 0)); c.strokeStyle = 'rgba(227,243,255,.85)'; c.lineWidth = 1.6; c.stroke(); if (G && G.pull > 0 && Math.random() < .2) lvFx('ring', at, .5); }
      else lvFloatDraw(c, b, lvFloat(), k.dip, T, 1);
    }
  }
  // splashes, rings, bolts
  for (let i = LV.fx.length - 1; i >= 0; i--) {
    const f = LV.fx[i]; f.t += dt; const g = lvG(f.at);
    if (f.kind === 'splash' || f.kind === 'ring') {
      const life = f.kind === 'ring' ? .8 : 1.2, u = f.t / life; if (u >= 1) { LV.fx.splice(i, 1); continue; }
      for (let j = 0; j < (f.kind === 'ring' ? 1 : 3); j++) { const uu = u - j * .16; if (uu <= 0) continue; lvRingPath(c, g, (2 + uu * 15) * f.p); c.strokeStyle = `rgba(227,243,255,${(1 - uu) * .75})`; c.lineWidth = 1.5; c.stroke(); }
      if (f.kind === 'splash' && u < .45) { c.fillStyle = `rgba(255,255,255,${.9 - u * 2})`; for (let j = 0; j < 7; j++) { const a = f.seed + j * .9, r = u * 34 * f.p; c.beginPath(); c.arc(g.x + Math.cos(a) * r * .7, g.y - Math.abs(Math.sin(a)) * r * 1.5 + u * u * 60, 1.6, 0, 6.2832); c.fill(); } }
    } else if (f.kind === 'bolt') {
      const u = f.t / .55; if (u >= 1) { LV.fx.splice(i, 1); continue; }
      lvBolt(c, g.x, g.y, 150 * f.p, f.seed + Math.floor(f.t * 22), u < .15 ? 1 : (1 - u) * (Math.sin(f.t * 60) > -.3 ? 1 : .35));
      lvRingPath(c, g, 3 + u * 26 * f.p); c.strokeStyle = `rgba(124,196,255,${(1 - u) * .9})`; c.lineWidth = 2.2; c.stroke();
    }
  }
}
let lvBanT = 0;
function lvBanner(txt) { const b = $('#lv-banner'); if (!b) return; b.textContent = txt; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(lvBanT); lvBanT = setTimeout(() => b.classList.remove('on'), 1100); }

/* --- the book: my fish, this week's board, how it works --- */
function lvBook(tab) {
  lvLoad().then(() => {
    const st = LV.st; if (!st) { toast(t('lv_err'), 'warn'); return; }
    const cur = tab || 'dex', dex = new Map(st.dex.map(d => [d.sp, d]));
    const m = new Date().getMonth() + 1, at = LV.stand || LV.pos, near = at ? GEO.regionPrior(GEO.region(at.lng, at.lat, true), m).filter(x => SPI[x.id] && lvFits(SPI[x.id], 'sea')).map(x => x.id) : [];
    const ids = [...new Set([...st.dex.map(d => d.sp), ...near, ...SP.filter(sp => lvFits(sp, 'sea') || lvFits(sp, 'fresh')).map(sp => sp.id)])];
    const dexH = `<p class="lv-bsum"><b class="num">${st.dex.length}</b> / ${ids.length} ${t('lv_dex_n')}</p><div class="lv-dex">${ids.map(id => { const sp = SPI[id], d = dex.get(id); return `<div class="lv-dx${d ? ' got' : ''} t${sp.r}"><span class="tone-${sp.w}"><img src="${FD.thumb(sp, 200, 110)}" alt="" loading="lazy"></span><b>${d ? esc(spName(sp)) : '???'}</b><small>${d ? `<i class="num">${fmtN(d.best, 1)}</i>cm · ${t('lv_dex_x', { n: d.n })}` : t(LV_TIERS[sp.r])}</small></div>`; }).join('')}</div>`;
    const row = (b, i) => `<li class="${b.a === myId() ? 'me' : ''}"><b class="num">${i + 1}</b>${avatar(anglerOf(b.a), 30)}<span><strong>${esc(lvNick(b.a))}</strong><small>${b.sp && SPI[b.sp] ? esc(spName(SPI[b.sp])) + ' ' + fmtN(b.cm, 1) + 'cm' : ''}</small></span><em class="num">${fmtN(b.s)}</em>${S.isOwner ? `<button class="btn btn-sm btn-line" data-zpvoid="${esc(b.a)}|${esc(st.wk)}">${t('zp_void')}</button>` : ''}</li>`;
    const wkH = `<p class="lv-bsum">${t('lv_wk_how')}</p>
      <ul class="zp-prizes lv-prz"><li class="p1"><b class="num">300P</b><span>${t('lv_wk_p1')}</span></li><li class="p2"><b class="num">200P</b><span>${t('lv_rank_n', { n: 2 })}</span></li><li class="p3"><b class="num">100P</b><span>${t('lv_rank_n', { n: 3 })}</span></li></ul>
      ${st.top.length ? `<ol class="lv-board">${st.top.map(row).join('')}</ol>` : `<p class="empty">${t('lv_wk_empty')}</p>`}
      ${st.me ? `<p class="lv-bme">${t('lv_wk_me', { r: st.me.r, s: fmtN(st.me.s), n: st.me.n })}</p>` : ''}
      ${st.last && st.last.length ? `<p class="lv-blast">${t('lv_wk_last')} ${st.last.map(b => `<b>${b.r}.</b> ${esc(lvNick(b.a))}`).join(' · ')}</p>` : ''}`;
    const howH = `<ul class="lv-how">
        <li>${icon('pin')}<span><b>${t('lv_how1_h')}</b>${t('lv_how1_p', { m: lvReach() })}</span></li>
        <li>${icon('globe')}<span><b>${t('lv_how2_h')}</b>${t('lv_how2_p', { n: st.day.remoteMax })}</span></li>
        <li>${icon('moon')}<span><b>${t('lv_how3_h')}</b>${t('lv_how3_p')}</span></li>
        <li>${icon('coin')}<span><b>${t('lv_how4_h')}</b>${t('lv_how4_p', { n: st.day.cap })}</span></li>
        <li>${icon('lure')}<span><b>${t('lv_how5_h')}</b>${t('lv_how5_p')}</span></li>
      </ul>
      <label class="switch lv-opt"><input type="checkbox" id="lv-anon" ${LV.anon ? 'checked' : ''}><span class="sw"></span><span><b>${t('lv_anon_h')}</b><small>${t('lv_anon_p')}</small></span></label>
      <p class="lv-priv">${icon('lock')}<span>${t('lv_priv')}</span></p>`;
    const w = openModal(`<div class="lv-book"><h2>${t('lv_book')}</h2>
      <div class="seg" role="tablist">${[['dex', 'lv_tab_dex'], ['wk', 'lv_tab_wk'], ['how', 'lv_tab_how']].map(([k, l]) => `<button role="tab" aria-selected="${k === cur}" data-lvtab="${k}">${t(l)}</button>`).join('')}</div>
      <div class="lv-bbody">${cur === 'dex' ? dexH : cur === 'wk' ? wkH : howH}</div></div>`, { wide: true, label: t('lv_book') });
    w.addEventListener('click', e => { const b = e.target.closest('[data-lvtab]'); if (b) { closeModal(w); setTimeout(() => lvBook(b.dataset.lvtab), 30); } });
    w.addEventListener('change', e => { if (e.target.id === 'lv-anon') { LV.anon = e.target.checked; lsSet('liveAnon', LV.anon); lvTrack(); } });
  });
}

/* --- on the home page: the door to the live sea --- */
function liveTeaserHTML() {
  if (!lvOn()) return '';
  if (!LV.st && !LV.stP && !LV.err) lvLoad().then(() => { if (S.route === 'home' && LV.st && LV.st.feed.length) rerenderSoon(); });
  const st = LV.st, feed = (st && st.feed) || [];
  const rows = feed.filter(f => SPI[f.sp]).slice(0, 3).map(f => `<li class="t${f.tier}"><span class="tone-${SPI[f.sp].w}"><img src="${FD.thumb(SPI[f.sp], 120, 66)}" alt="" loading="lazy"></span><b>${esc(f.a ? lvNick(f.a) : t('lv_someone'))}</b><em>${esc(spName(SPI[f.sp]))} <i class="num">${fmtN(f.cm, 1)}</i>cm</em></li>`).join('');
  return `<a class="lt" href="#live">
    <div class="lt-art" aria-hidden="true">${liveArtSVG()}</div>
    <div class="lt-body">
      <p class="lt-kick"><i class="live-tag">LIVE</i>${t('lv_title')}</p>
      <h2>${t('lt_h')}</h2>
      <p class="lt-p">${t('lt_p')}</p>
      ${rows ? `<ul class="lt-feed">${rows}</ul>` : ''}
      <span class="btn btn-light btn-lg">${icon('live')}${t('lt_cta')}</span>
    </div>
  </a>`;
}
// a small drawing of the game: blocks of a town, a glowing shore, floats and one bite (the sea sits on the right)
function liveArtSVG() {
  const blocks = [[70, 150, 44, 28, 38], [150, 120, 36, 24, 62], [210, 170, 50, 30, 26], [110, 215, 40, 26, 48], [200, 240, 54, 30, 30], [270, 110, 34, 22, 44], [40, 250, 30, 22, 22], [285, 215, 30, 20, 34], [20, 180, 26, 18, 30], [160, 60, 30, 20, 28], [250, 40, 36, 22, 20]];
  const b = blocks.map(([x, y, w, d, h]) => `<g><path d="M${x} ${y - h}l${w} ${-w * .35}l${d} ${d * .5}l${-w} ${w * .35}z" fill="#263C66"/><path d="M${x} ${y - h}v${h}l${d} ${d * .5}v${-h}z" fill="#131F35"/><path d="M${x + d} ${y + d * .5 - h}v${h}l${w} ${-w * .35}v${-h}z" fill="#1A2A47"/></g>`).join('');
  const shore = 'M352 0C380 50 340 96 372 150C402 200 366 250 392 300';
  const float = (x, y, k, o) => `<g opacity="${o}"><ellipse cx="${x}" cy="${y}" rx="${13 * k}" ry="${5 * k}" fill="none" stroke="#E3F3FF" stroke-width="1.2" opacity=".7"/><ellipse cx="${x}" cy="${y}" rx="${22 * k}" ry="${8.5 * k}" fill="none" stroke="#E3F3FF" stroke-width=".8" opacity=".35"/><path d="M${x} ${y}v${-20 * k}" stroke="#F4F8FF" stroke-width="${3.4 * k}" stroke-linecap="round"/><circle cx="${x}" cy="${y - 23 * k}" r="${3.4 * k}" fill="#7CC4FF"/></g>`;
  return `<svg viewBox="0 0 640 300" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="lta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1730"/><stop offset="1" stop-color="#050A13"/></linearGradient>
    <linearGradient id="ltb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0C2B5C"/><stop offset="1" stop-color="#1A4DA6"/></linearGradient>
    <filter id="ltg" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <rect width="640" height="300" fill="url(#lta)"/>
    <path d="${shore}H640V0Z" fill="url(#ltb)"/>
    <path d="${shore}" fill="none" stroke="#5AA2FF" stroke-width="12" opacity=".5" filter="url(#ltg)"/>
    <path d="${shore}" fill="none" stroke="#BFE3FF" stroke-width="1.4"/>
    <g opacity=".9">${b}</g>
    <g fill="none" stroke="#A0D6FF"><ellipse cx="548" cy="78" rx="34" ry="13" opacity=".4"/><ellipse cx="548" cy="78" rx="21" ry="8" opacity=".55"/><ellipse cx="548" cy="78" rx="9" ry="3.5" opacity=".7"/></g>
    ${float(486, 168, 1, 1)}${float(584, 232, .8, .7)}${float(600, 128, .6, .5)}
    <path d="M356 196C392 120 440 110 486 146" fill="none" stroke="#E3F3FF" stroke-width="1.2" stroke-dasharray="3 5" opacity=".85"/>
    <path d="M500 18l-16 40h14l-10 50" fill="none" stroke="#5AA2FF" stroke-width="9" opacity=".35" stroke-linejoin="round" filter="url(#ltg)"/>
    <path d="M500 18l-16 40h14l-10 50" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="356" cy="200" r="16" fill="none" stroke="#7CC4FF" stroke-width="1" opacity=".5"/>
    <circle cx="356" cy="200" r="8" fill="#050A13" stroke="#7CC4FF" stroke-width="2.4"/><circle cx="356" cy="200" r="2.8" fill="#fff"/>
  </svg>`;
}
