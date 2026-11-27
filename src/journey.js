/* ===== 나의 낚시 여행 (my fishing journey): my catches played back on the map, in the order I caught them.
   The camera flies from one place to the next, a line grows between them, each fish pops up with its date, size and
   what was special (a new kind, my best of that kind), and the numbers add up as it goes (fish, kinds, places, km).
   Play / pause, faster, drag the bar to any day; space, arrows and Escape on a keyboard.
   Everything comes from my own records on this device and stays here: the map is only on my screen. The picture to
   share has no map and no places at all, only the year drawn as a ring of dots (one per fish, by its day). ===== */
const JN = { el: null, map: null, d: null, i: -1, play: false, speed: 1, t0: 0, raf: 0, yr: null, key: null, ly: null, endT: 0 };
const JN_STEP = 2300;
const JN_SPEEDS = [1, 2, 4];
// the season's colour of a dot (no orange: mint, sky, lavender, frost)
const JN_SEA = ['#E6F1FF', '#E6F1FF', '#9BE7D8', '#9BE7D8', '#9BE7D8', '#4FC3F7', '#4FC3F7', '#4FC3F7', '#B9A7FF', '#B9A7FF', '#B9A7FF', '#E6F1FF'];
const jnTs = c => +(c.ts || c.at || 0);
function jnKm(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// my catches that have a place, oldest first (the refused ones are left out, as in the statistics)
function jnAll() {
  return statCatches().filter(c => c && SPI[c.sp] && jnTs(c) && c.lat != null && c.lon != null && Number.isFinite(+c.lat) && Number.isFinite(+c.lon)
    && Math.abs(+c.lat) <= 90 && Math.abs(+c.lon) <= 180 && !(+c.lat === 0 && +c.lon === 0))
    .map(c => ({ c, lat: +c.lat, lon: +c.lon, ts: jnTs(c) })).sort((a, b) => a.ts - b.ts);
}
function jnYears() { return [...new Set(jnAll().map(p => new Date(p.ts).getFullYear()))].sort((a, b) => b - a); }
// the journey for a year ('all' for every year): each stop with what had added up by then
function jnData(yr) {
  const inYr = ts => yr === 'all' || new Date(ts).getFullYear() === yr;
  const pts = jnAll().filter(p => inYr(p.ts));
  const noLoc = statCatches().filter(c => c && SPI[c.sp] && jnTs(c) && inYr(jnTs(c))).length - pts.length;
  const seen = new Set(), best = {}, places = new Set();
  let km = 0, far = null;
  pts.forEach((p, i) => {
    const c = p.c;
    p.isNew = !seen.has(c.sp); seen.add(c.sp);
    p.isBest = !p.isNew && c.len > 0 && c.len > (best[c.sp] || 0);
    if (c.len > 0) best[c.sp] = Math.max(best[c.sp] || 0, c.len);
    const leg = i ? jnKm(pts[i - 1], p) : 0; km += leg; p.leg = leg;
    if (leg > 0 && (!far || leg > far.leg)) far = p;
    places.add(Math.round(p.lat * 20) + ',' + Math.round(p.lon * 20)); // about 5 km a place
    p.n = i + 1; p.sp = seen.size; p.places = places.size; p.km = km;
  });
  let big = null; for (const p of pts) { const L = SPI[p.c.sp].L, r = p.c.len && L ? p.c.len / L : 0; if (r && (!big || r > big.r)) big = { p, r }; }
  const rg = {}; for (const p of pts) if (p.c.rg) rg[p.c.rg] = (rg[p.c.rg] || 0) + 1;
  const topRg = Object.entries(rg).sort((a, b) => b[1] - a[1])[0];
  return { yr, pts, noLoc: Math.max(0, noLoc), n: pts.length, sp: seen.size, places: places.size, km, far, big: big && big.p, topRg: topRg ? topRg[0] : null };
}
const jnKmTxt = km => km >= 100 ? fmtN(Math.round(km)) : fmtN(Math.round(km * 10) / 10, 1);
const jnDate = ts => fmtDate(ts, { year: 'numeric', month: 'short', day: 'numeric' });

/* --- the card on 내 조과 (my own screen, so a small sketch of the route is fine) --- */
function jnCardHTML() {
  const all = jnAll(); if (!all.length) return '';
  const yrs = jnYears(), yr = yrs[0], d = jnData(yr);
  // fitted into a 100×60 box in the middle of the sketch (kept in proportion)
  const xs = d.pts.map(p => p.lon), ys = d.pts.map(p => p.lat);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(100 / Math.max(.02, x1 - x0), 60 / Math.max(.02, y1 - y0));
  const P = d.pts.map(p => [60 + (p.lon - (x0 + x1) / 2) * k, 40 - (p.lat - (y0 + y1) / 2) * k]);
  const path = P.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  return `<section class="jn-card" aria-label="${esc(t('jn_title'))}">
    <div class="jn-c-txt"><p class="jn-c-eye">${icon('map')}${t('jn_eye')}</p><h2>${t('jn_card_h', { y: yr })}</h2>
      <p class="jn-c-sub">${t('jn_card_p', { n: fmtN(d.n), p: fmtN(d.places), km: jnKmTxt(d.km) })}</p>
      <button class="btn btn-light" data-jnopen="${yr}">${icon('play')}${t('jn_open')}</button></div>
    <svg class="jn-c-art" viewBox="0 0 120 80" aria-hidden="true"><path d="${path}" fill="none" stroke="#7CC4FF" stroke-width="1.2" stroke-dasharray="3 2.5" stroke-linecap="round" opacity=".85"/>
      ${P.map((q, i) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${i === P.length - 1 ? 3.2 : 2}" fill="${JN_SEA[new Date(d.pts[i].ts).getMonth()]}"/>`).join('')}</svg>
  </section>`;
}

/* --- the player --- */
async function jnOpen(yr) {
  if (JN.el) return;
  const yrs = jnYears();
  yr = yr === 'all' ? 'all' : +yr || yrs[0] || new Date(nowMs()).getFullYear();
  const el = document.createElement('div'); el.className = 'jn'; el.id = 'jn';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('jn_title'));
  el.innerHTML = `<div class="jn-map" id="jn-map"></div><div class="jn-shade" aria-hidden="true"></div>
    <header class="jn-top"><div class="jn-ttl"><p class="jn-eye">${icon('map')}${t('jn_eye')}</p><h2>${t('jn_title')}</h2></div>
      <button class="jn-x" data-jnclose aria-label="${esc(t('close'))}">${icon('x')}</button>
      <div class="jn-years" role="group" aria-label="${esc(t('jn_year'))}"></div><p class="jn-note" hidden></p></header>
    <div class="jn-pop" aria-live="polite"></div>
    <footer class="jn-bar">
      <div class="jn-now"><b class="jn-date num" id="jn-date">—</b><span class="jn-step num" id="jn-step"></span></div>
      <div class="jn-stats">${['n', 'sp', 'places', 'km'].map(k => `<div><b class="num" data-jnst="${k}">0</b><span>${t('jn_st_' + k)}</span></div>`).join('')}</div>
      <div class="jn-ctl"><button class="jn-play" data-jnplay aria-label="${esc(t('jn_play'))}">${icon('play')}</button>
        <input type="range" id="jn-range" min="0" max="0" value="0" step="1" aria-label="${esc(t('jn_scrub'))}">
        <button class="jn-sp num" data-jnspeed aria-label="${esc(t('jn_speed'))}">1×</button>
        <button class="jn-sh" data-jnshare aria-label="${esc(t('jn_share'))}">${icon('share')}</button></div>
    </footer>
    <div class="jn-end" hidden></div>
    <div class="jn-empty" hidden></div>`;
  document.body.appendChild(el); document.body.classList.add('has-modal'); JN.el = el;
  el.addEventListener('click', e => {
    const tg = e.target;
    if (tg.closest('[data-jnclose]')) { jnClose(); return; }
    if (tg.closest('[data-jnplay]')) { jnToggle(); return; }
    if (tg.closest('[data-jnspeed]')) { JN.speed = JN_SPEEDS[(JN_SPEEDS.indexOf(JN.speed) + 1) % JN_SPEEDS.length]; $('[data-jnspeed]', el).textContent = JN.speed + '×'; return; }
    if (tg.closest('[data-jnshare]')) { jnShare(tg.closest('[data-jnshare]')); return; }
    if (tg.closest('[data-jnagain]')) { jnGo(0, true); jnToggle(true); return; }
    const y = tg.closest('[data-jnyr]'); if (y) { jnLoad(y.dataset.jnyr === 'all' ? 'all' : +y.dataset.jnyr); return; }
  });
  const rg = $('#jn-range', el);
  rg.addEventListener('input', () => { jnToggle(false); jnGo(+rg.value, false); });
  JN.key = e => {
    if (!JN.el) return;
    if (e.key === 'Escape') { e.preventDefault(); jnClose(); }
    else if (e.key === ' ' && !e.target.closest('button,input')) { e.preventDefault(); jnToggle(); }
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target !== rg) { e.preventDefault(); jnToggle(false); jnGo(JN.i + (e.key === 'ArrowRight' ? 1 : -1), true); }
  };
  document.addEventListener('keydown', JN.key);
  setTimeout(() => { const b = $('.jn-x', el); if (b) b.focus(); }, 50);
  if (!yrs.length) { jnEmpty(); return; }
  const box = $('#jn-map', el);
  const build = () => {
    if (!JN.el) return;
    const L = window.L; box.innerHTML = '';
    const map = L.map(box, { zoomControl: false, attributionControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 11, zoomSnap: .25, fadeAnimation: false });
    map.setView([35.5, 128], 6);
    try { const LY = MAPX.makeLayers(L); new LY.Sat({ night: true }).addTo(map); new LY.Vec({ toggles: () => ({ night: true, coast: true, fresh: true, bathy: true }) }).addTo(map); } catch (e) { console.warn(e); }
    JN.map = map; JN.ly = { glow: L.polyline([], { color: '#7CC4FF', weight: 9, opacity: .18, interactive: false }).addTo(map), line: L.polyline([], { color: '#BFE4FF', weight: 2.4, opacity: .95, dashArray: '6 7', interactive: false }).addTo(map), dots: L.layerGroup().addTo(map), cur: null };
    map.on('dragstart zoomstart', e => { if (e && e.originalEvent) jnToggle(false); });
    jnLoad(yr);
    setTimeout(() => map.invalidateSize(), 60);
  };
  if (window.L && window.L.map) build(); else mapWait(box, build);
}
function jnEmpty() {
  const e = $('.jn-empty', JN.el); e.hidden = false; $('.jn-bar', JN.el).hidden = true;
  e.innerHTML = `<p class="jn-e-ic">${icon('pin')}</p><h3>${t('jn_empty_h')}</h3><p>${t('jn_empty_p')}</p>
    <div class="actions"><a class="btn btn-primary" href="#scan" data-jnclose>${icon('camera')}${t('cta_scan')}</a><button class="btn btn-glass" data-jnclose>${t('close')}</button></div>`;
}
function jnLoad(yr) {
  if (!JN.el || !JN.map) return;
  JN.yr = yr; JN.d = jnData(yr);
  const yrs = jnYears();
  $('.jn-years', JN.el).innerHTML = (yrs.length > 1 ? [...yrs, 'all'] : yrs).map(y => `<button class="chip chip-tab" data-jnyr="${y}" aria-pressed="${String(y) === String(yr)}">${y === 'all' ? t('jn_all') : y}</button>`).join('');
  const rg = $('#jn-range', JN.el); rg.max = Math.max(0, JN.d.n - 1); rg.value = 0;
  $('.jn-end', JN.el).hidden = true;
  // the whole year first, for a moment, then off it goes
  const b = window.L.latLngBounds(JN.d.pts.map(p => [p.lat, p.lon]));
  try { JN.map.fitBounds(b.pad(.35), { maxZoom: 8, animate: false }); } catch (e) { }
  JN.i = -1; jnGo(-1, false);
  const nt = $('.jn-note', JN.el); nt.hidden = !JN.d.noLoc; nt.textContent = JN.d.noLoc ? t('jn_noloc', { n: JN.d.noLoc }) : '';
  clearTimeout(JN.startT); JN.startT = setTimeout(() => { if (JN.el && JN.i < 0) { jnGo(0, true); jnToggle(true); } }, 900);
  if (!JN.raf) JN.raf = requestAnimationFrame(jnTick);
}
const jnCalm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// stop i: everything up to it drawn; fly there when asked
function jnGo(i, fly) {
  const d = JN.d; if (!JN.el || !d || !JN.map) return;
  if (i >= d.n) { jnEnd(); return; }
  i = Math.max(-1, Math.min(d.n - 1, i));
  const prev = JN.i; JN.i = i; JN.t0 = performance.now();
  $('.jn-end', JN.el).hidden = true;
  const L = window.L, ly = JN.ly;
  ly.dots.clearLayers();
  for (let k = 0; k < i; k++) { const p = d.pts[k]; ly.dots.addLayer(L.circleMarker([p.lat, p.lon], { radius: p.isNew ? 5 : 4, color: '#0B1730', weight: 1.5, fillColor: JN_SEA[new Date(p.ts).getMonth()], fillOpacity: .95, interactive: false })); }
  const pre = d.pts.slice(0, Math.max(0, i)).map(p => [p.lat, p.lon]);
  ly.line.setLatLngs(pre); ly.glow.setLatLngs(pre);
  if (ly.cur) { ly.cur.remove(); ly.cur = null; }
  const pop = $('.jn-pop', JN.el);
  $('#jn-range', JN.el).value = Math.max(0, i);
  if (i < 0) { pop.innerHTML = ''; jnNums(null); $('#jn-date', JN.el).textContent = JN.yr === 'all' ? t('jn_all') : String(JN.yr); $('#jn-step', JN.el).textContent = t('jn_stops', { n: d.n }); return; }
  const p = d.pts[i], c = p.c, sp = SPI[c.sp], mo = new Date(p.ts).getMonth();
  ly.cur = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'jn-cur', html: `<span class="jn-ping" style="--c:${JN_SEA[mo]}"><i></i><b></b></span>`, iconSize: [44, 44], iconAnchor: [22, 22] }), interactive: false, keyboard: false }).addTo(JN.map);
  if (fly) {
    const far = prev >= 0 && d.pts[prev] ? jnKm(d.pts[prev], p) : 999, z = Math.max(JN.map.getZoom(), 8.5);
    if (jnCalm()) JN.map.setView([p.lat, p.lon], 9, { animate: false });
    else if (far > 30) JN.map.flyTo([p.lat, p.lon], 9, { duration: Math.min(1.4, Math.max(.6, JN_STEP / JN.speed / 1000 * .5)) });
    else JN.map.setView([p.lat, p.lon], Math.min(10, z), { animate: true, duration: .5 });
  } else JN.map.setView([p.lat, p.lon], Math.max(8.5, Math.min(10, JN.map.getZoom())), { animate: false });
  const tags = [p.isNew ? `<span class="jn-tag new">${icon('sparkle')}${t('jn_new')}</span>` : '', p.isBest ? `<span class="jn-tag best">${icon('trophy')}${t('jn_best')}</span>` : '', p === d.far && p.leg > 30 ? `<span class="jn-tag far">${icon('globe')}${t('jn_far', { km: jnKmTxt(p.leg) })}</span>` : ''].join('');
  pop.innerHTML = `<div class="jn-p-in" style="--c:${JN_SEA[mo]}"><img src="${FD.thumb(sp, 180, 100)}" alt="">
    <div><p class="jn-p-eye num">${esc(jnDate(p.ts))}${c.rg ? ' · ' + esc(regionName(c.rg)) : ''}</p><h3>${esc(nameOf(c.sp))}</h3>
    <p class="jn-p-len">${c.len ? `<b class="num">${lenFmt(c.len)}</b>` : ''}${c.bait ? `<span>${esc(String(c.bait).slice(0, 24))}</span>` : ''}</p>${tags ? `<p class="jn-tags">${tags}</p>` : ''}</div></div>`;
  $('#jn-date', JN.el).textContent = jnDate(p.ts);
  $('#jn-step', JN.el).textContent = `${i + 1} / ${d.n}`;
  jnNums(p);
  if (fly && typeof LVS !== 'undefined') { LVS.play(p.isNew ? 'coin' : 'plop'); if (p.isBest) setTimeout(() => LVS.play('bite'), 260); LVS.buzz(p.isNew || p.isBest ? [12, 30, 12] : 10); }
}
function jnNums(p) {
  const v = { n: p ? p.n : 0, sp: p ? p.sp : 0, places: p ? p.places : 0, km: p ? p.km : 0 };
  for (const k in v) { const n = $(`[data-jnst="${k}"]`, JN.el); if (!n) continue; const s = k === 'km' ? jnKmTxt(v[k]) : fmtN(v[k]); if (n.textContent !== s) { n.textContent = s; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); } }
}
function jnToggle(on) {
  if (!JN.el || !JN.d) return;
  JN.play = on == null ? !JN.play : !!on;
  if (JN.play && (JN.i >= JN.d.n - 1 || !$('.jn-end', JN.el).hidden)) { jnGo(0, true); }
  JN.t0 = performance.now();
  const b = $('[data-jnplay]', JN.el); if (b) { b.innerHTML = icon(JN.play ? 'pause' : 'play'); b.setAttribute('aria-label', t(JN.play ? 'jn_pause' : 'jn_play')); b.setAttribute('aria-pressed', String(JN.play)); }
}
// each frame: the line grows from the last stop to this one, and on to the next stop when it is time
function jnTick() {
  if (!JN.el) { JN.raf = 0; return; }
  const d = JN.d, now = performance.now(), dur = JN_STEP / JN.speed;
  if (d && JN.map && JN.i >= 1) {
    const a = d.pts[JN.i - 1], b = d.pts[JN.i], f = Math.min(1, (now - JN.t0) / (dur * .5)), e = 1 - Math.pow(1 - f, 3);
    const ll = d.pts.slice(0, JN.i).map(p => [p.lat, p.lon]); ll.push([a.lat + (b.lat - a.lat) * e, a.lon + (b.lon - a.lon) * e]);
    if (f < 1 || JN.ly.line.getLatLngs().length !== ll.length || !JN._full) { JN.ly.line.setLatLngs(ll); JN.ly.glow.setLatLngs(ll); JN._full = f >= 1; }
  }
  if (JN.play && d && now - JN.t0 >= dur) { JN._full = false; jnGo(JN.i + 1, true); }
  JN.raf = requestAnimationFrame(jnTick);
}
function jnEnd() {
  const d = JN.d; if (!d || !JN.el) return;
  jnToggle(false);
  const L = window.L;
  // the whole route at once, every fish a dot
  JN.ly.dots.clearLayers();
  for (const p of d.pts) JN.ly.dots.addLayer(L.circleMarker([p.lat, p.lon], { radius: p.isNew ? 5 : 4, color: '#0B1730', weight: 1.5, fillColor: JN_SEA[new Date(p.ts).getMonth()], fillOpacity: .95, interactive: false }));
  JN.ly.line.setLatLngs(d.pts.map(p => [p.lat, p.lon])); JN.ly.glow.setLatLngs(d.pts.map(p => [p.lat, p.lon]));
  if (JN.ly.cur) { JN.ly.cur.remove(); JN.ly.cur = null; }
  try { JN.map.flyToBounds(L.latLngBounds(d.pts.map(p => [p.lat, p.lon])).pad(.3), { maxZoom: 9, duration: jnCalm() ? 0 : 1 }); } catch (e) { }
  $('.jn-pop', JN.el).innerHTML = '';
  const big = d.big;
  const e = $('.jn-end', JN.el); e.hidden = false;
  e.innerHTML = `<p class="jn-e-eye">${t('jn_end_eye', { y: d.yr === 'all' ? t('jn_all') : d.yr })}</p>
    <h3>${t('jn_end_h', { p: fmtN(d.places), n: fmtN(d.n) })}</h3>
    <div class="jn-e-sum"><p><b class="num">${jnKmTxt(d.km)}</b><span>${t('jn_end_km')}</span></p><p><b class="num">${fmtN(d.sp)}</b><span>${t('jn_st_sp')}</span></p>
      ${big ? `<p><b class="num">${lenFmt(big.c.len)}</b><span>${esc(nameOf(big.c.sp))}</span></p>` : ''}${d.topRg ? `<p><b>${esc(regionName(d.topRg))}</b><span>${t('jn_end_rg')}</span></p>` : ''}</div>
    <div class="actions"><button class="btn btn-light" data-jnshare>${icon('share')}${t('jn_share')}</button><button class="btn btn-glass" data-jnagain>${icon('refresh')}${t('jn_again')}</button></div>`;
  $('#jn-step', JN.el).textContent = t('jn_stops', { n: d.n });
  if (typeof LVS !== 'undefined') LVS.play('land');
}
function jnClose() {
  if (!JN.el) return;
  cancelAnimationFrame(JN.raf); JN.raf = 0; clearTimeout(JN.startT);
  document.removeEventListener('keydown', JN.key);
  try { if (JN.map) JN.map.remove(); } catch (e) { }
  JN.el.remove(); JN.el = null; JN.map = null; JN.ly = null; JN.play = false; JN.i = -1;
  if (!$('.modal-wrap.in') && !$('.rc')) document.body.classList.remove('has-modal');
}

/* --- the picture to share: the year as a ring of dots (one per fish, at its day), no map, no places --- */
async function jnBlob(d) {
  const W = 1080, H = 1350, P = 80, cx = W / 2, cy = 700, R0 = 180, R1 = 340;
  const SANS = '"IBM Plex Sans KR", "IBM Plex Sans JP", "Noto Sans SC", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif', DISP = '"Chakra Petch", ' + SANS;
  try { await Promise.race([document.fonts.load(`italic 700 200px ${DISP}`, '0123456789'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const bg = g.createRadialGradient(cx, cy, 60, cx, cy, 900); bg.addColorStop(0, '#173A7A'); bg.addColorStop(.55, '#0B1730'); bg.addColorStop(1, '#050A13'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // a few stars
  const rnd = FD.seeded(FD.hashStr(String(d.yr) + d.n)); g.fillStyle = '#FFFFFF';
  for (let i = 0; i < 90; i++) { g.globalAlpha = .1 + rnd() * .35; g.beginPath(); g.arc(rnd() * W, rnd() * H, rnd() * 1.8 + .3, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
  g.textAlign = 'left'; g.fillStyle = '#7CC4FF'; g.font = `700 40px ${DISP}`; g.fillText(`${d.yr === 'all' ? 'ALL TIME' : d.yr} FISHING JOURNEY`, P, 130);
  g.fillStyle = '#FFFFFF'; g.font = `800 66px ${SANS}`; g.fillText(fitText(g, t('jn_title'), W - P * 2), P, 210);
  g.fillStyle = '#A9BBCF'; g.font = `500 38px ${SANS}`; g.fillText(fitText(g, (S.me && S.me.nick) || '', W - P * 2), P, 266);
  // the ring: twelve months around, the fish as dots by their day (when in the year, never where)
  const t0 = d.yr === 'all' ? (d.pts[0] ? d.pts[0].ts : 0) : new Date(d.yr, 0, 1).getTime(), t1 = d.yr === 'all' ? Math.max(t0 + 864e5, d.pts.length ? d.pts[d.pts.length - 1].ts : 0) : new Date(d.yr + 1, 0, 1).getTime();
  const ang = ts => -Math.PI / 2 + (ts - t0) / (t1 - t0) * Math.PI * 2;
  g.strokeStyle = 'rgba(124,196,255,.22)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R1 + 26, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(124,196,255,.1)'; g.beginPath(); g.arc(cx, cy, R0 - 20, 0, Math.PI * 2); g.stroke();
  if (d.yr !== 'all') for (let m = 0; m < 12; m++) {
    const a = ang(new Date(d.yr, m, 1).getTime()); g.strokeStyle = 'rgba(124,196,255,.35)'; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R1 + 16), cy + Math.sin(a) * (R1 + 16)); g.lineTo(cx + Math.cos(a) * (R1 + 36), cy + Math.sin(a) * (R1 + 36)); g.stroke();
    const am = ang(new Date(d.yr, m, 15).getTime()); g.fillStyle = '#7F95AD'; g.font = `600 26px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(m + 1), cx + Math.cos(am) * (R1 + 62), cy + Math.sin(am) * (R1 + 62));
  }
  g.textBaseline = 'alphabetic';
  const pos = d.pts.map((p, i) => { const L = SPI[p.c.sp].L, r = p.c.len && L ? Math.min(1.6, p.c.len / L) / 1.6 : .5, a = ang(p.ts), rr = R0 + (R1 - R0) * (.15 + .85 * r) + ((i * 37) % 9 - 4) * 3; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, p]; });
  g.strokeStyle = 'rgba(191,228,255,.35)'; g.lineWidth = 2; g.setLineDash([8, 9]); g.beginPath(); pos.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
  for (const [x, y, p] of pos) { const col = JN_SEA[new Date(p.ts).getMonth()]; g.save(); g.shadowColor = col; g.shadowBlur = 22; g.fillStyle = col; g.beginPath(); g.arc(x, y, p.isNew ? 11 : 8, 0, Math.PI * 2); g.fill(); g.restore(); if (p.isBest || p === d.big) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.stroke(); } }
  g.textAlign = 'center'; g.fillStyle = '#FFFFFF'; g.font = `italic 700 150px ${DISP}`; g.fillText(fmtN(d.n), cx, cy + 30);
  g.fillStyle = '#BFE4FF'; g.font = `600 38px ${SANS}`; g.fillText(fitText(g, t('jn_st_n'), 300), cx, cy + 90);
  // the numbers under it
  const cells = [[fmtN(d.places), t('jn_st_places')], [jnKmTxt(d.km), t('jn_st_km')], [fmtN(d.sp), t('jn_st_sp')]];
  const cw = (W - P * 2) / cells.length;
  cells.forEach(([v, u], i) => { const x = P + cw * i + cw / 2; g.fillStyle = '#7CC4FF'; g.font = `italic 700 92px ${DISP}`; g.fillText(v, x, 1188); g.fillStyle = '#E3F3FF'; g.font = `600 34px ${SANS}`; g.fillText(fitText(g, u, cw - 20), x, 1232); });
  g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(P, H - 86, W - P * 2, 2);
  g.fillStyle = '#FFFFFF'; g.font = `800 36px ${SANS}`; g.fillText(`${APP_NAME[0]} ${APP_NAME[1]}`, P, H - 38);
  g.textAlign = 'right'; g.fillStyle = '#7F95AD'; g.font = `500 28px ${SANS}`; g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - P, H - 38);
  return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', .9));
}
async function jnShare(btn) {
  if (!JN.d || btn.disabled) return; btn.disabled = true; jnToggle(false);
  try { const b = await jnBlob(JN.d); await shareImage(b, `zzirit-${JN.d.yr}-journey.jpg`, t('jn_share_text', { n: JN.d.n, p: JN.d.places }), { title: 'jn_share', sub: 'jn_share_sub' }); }
  catch (e) { console.warn(e); toast(t('share_fail'), 'warn'); }
  finally { btn.disabled = false; }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-jnopen]'); if (b) { e.preventDefault(); jnOpen(b.dataset.jnopen || null); } });
