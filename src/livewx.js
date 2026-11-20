/* ===== 찌릿 라이브: the real weather on the live map. Rain falls, fog hangs, snow drifts, wind pulls streaks across
   the water and rocks the float, a storm flashes. The weather comes from Open-Meteo (weather.js, kept 30 minutes),
   asked for the area rounded to about 10 km — never the exact spot. It also nudges the bite a little (the server keeps
   the numbers: light rain and grey skies a bit sooner, wind and storms a bit later). Website only. ===== */
const LWX = { d: null, kind: null, at: 0, key: '', drops: [], streaks: [], flash: 0, nextFlash: 0, told: false, w: 0, h: 0 };
// the same small factors as the server (0025): below 1 is a quicker bite
const LWX_M = { clear: 1, cloud: .92, rain: .88, fog: .95, snow: 1.05, wind: 1.1, storm: 1.2 };
const LWX_IC = { clear: 'sun', cloud: 'cloud', rain: 'cloud', fog: 'cloud', snow: 'cloud', wind: 'wind', storm: 'bolt' };
const lwxReduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
function lwxKind(d) {
  if (!d || (d.code == null && d.wind == null)) return null;
  const c = d.code, w = d.wind ?? 0, g = d.gust ?? w;
  if (c != null && c >= 95) return 'storm';
  if (w >= 8 || g >= 12) return 'wind';
  if (c != null && ((c >= 71 && c <= 77) || c === 85 || c === 86)) return 'snow';
  if (c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82))) return 'rain';
  if (c === 45 || c === 48) return 'fog';
  if (c === 2 || c === 3) return 'cloud';
  return 'clear';
}
// the weather that counts for a cast: only a fresh reading
const lwxNow = () => (LWX.kind && nowMs() - LWX.at < 3600e3 ? LWX.kind : null);
// where the float would be: the spot I stand at, else the middle of the map — rounded to 0.1° (about 10 km)
function lwxRefresh() {
  if (typeof wxOn !== 'function' || !wxOn() || !LV.map) return;
  const c = LV.stand || LV.pos || LV.map.getCenter(); if (!c) return;
  const lat = Math.round(c.lat * 10) / 10, lon = Math.round(c.lng * 10) / 10, key = lat + ',' + lon;
  if (key === LWX.key && nowMs() - LWX.asked < 10 * 60e3) return;
  LWX.key = key; LWX.asked = nowMs();
  wxFetch(lat, lon).then(d => {
    if (LWX.key !== key) return;
    LWX.d = d || null; LWX.kind = lwxKind(d); LWX.at = d ? (d.at || nowMs()) : 0; LWX.drops = []; LWX.streaks = [];
    if (typeof lvHud === 'function') lvHud();
  }).catch(() => null);
}
// a word about the sky: the forecast's own words, except a windy day says so
function lwxSky() { const d = LWX.d, k = LWX.kind; if (!d || !k) return ''; return k === 'wind' ? t('lwx_windy') : wxSky(d.code) || t('lwx_' + k); }
function lwxChip() {
  const k = lwxNow(); if (!k) return '';
  const m = LWX_M[k], d = LWX.d, tmp = d && d.t != null ? ` ${Math.round(d.t)}°` : '';
  const tag = m < 1 ? `<i class="lv-up">${t('lwx_bite_up')}</i>` : m > 1 ? `<i class="lv-dn">${t('lwx_bite_dn')}</i>` : '';
  return `<button type="button" class="lv-chip wx wx-${k}" data-lwx="1" aria-label="${esc(t('lwx_aria', { s: lwxSky() }))}">${icon(LWX_IC[k])}${esc(lwxSky())}${tmp}${tag}</button>`;
}
function lwxInfo() { const k = lwxNow(); if (k) lvSay(t('lwx_why_' + k), 5200); }

/* --- drawing: on top of everything on the live canvas, in screen space --- */
function lwxDraw(c, dt, T) {
  const k = lwxNow(); if (!k || k === 'clear') return;
  const W = LV.w || 0, H = LV.h || 0; if (!W || !H) return;
  if (LWX.w !== W || LWX.h !== H) { LWX.w = W; LWX.h = H; LWX.drops = []; LWX.streaks = []; }
  const d = LWX.d || {}, wind = clamp(d.wind ?? 2, 0, 20), calm = lwxReduce(), night = LV.pal === 'night';
  c.save();
  // the sky's light: grey days dim the top of the view, fog thickens toward the horizon
  if (k === 'cloud' || k === 'rain' || k === 'storm' || k === 'snow') {
    const g = c.createLinearGradient(0, 0, 0, H * .55); g.addColorStop(0, `rgba(8,16,30,${k === 'storm' ? .34 : k === 'cloud' ? .16 : .24})`); g.addColorStop(1, 'rgba(8,16,30,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H * .55);
  }
  if (k === 'fog') {
    const g = c.createLinearGradient(0, 0, 0, H); const fc = night ? '150,170,195' : '214,226,238';
    g.addColorStop(0, `rgba(${fc},.62)`); g.addColorStop(.45, `rgba(${fc},.32)`); g.addColorStop(1, `rgba(${fc},.14)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (!calm) for (let i = 0; i < 3; i++) {
      const y = H * (.18 + i * .2), x = ((T * (8 + i * 4) + i * 300) % (W + 600)) - 300, r = c.createRadialGradient(x, y, 0, x, y, 260);
      r.addColorStop(0, `rgba(${fc},.22)`); r.addColorStop(1, `rgba(${fc},0)`); c.fillStyle = r; c.fillRect(x - 260, y - 260, 520, 520);
    }
  }
  if (calm) { c.restore(); return; }
  // rain and snow: drops that fall with the wind
  if (k === 'rain' || k === 'storm' || k === 'snow') {
    const heavy = k === 'storm' || d.code === 65 || d.code === 67 || d.code === 82, light = d.code >= 51 && d.code <= 57;
    const n = Math.round((k === 'snow' ? 70 : heavy ? 170 : light ? 55 : 110) * clamp(W * H / (390 * 760), .6, 2.2));
    const slant = (k === 'snow' ? .25 : .12) * Math.min(wind, 14) * ((d.wdir ?? 270) < 180 ? -1 : 1);
    while (LWX.drops.length < n) LWX.drops.push({ x: Math.random() * W, y: Math.random() * H, v: .75 + Math.random() * .5, s: Math.random() * 6.28 });
    if (LWX.drops.length > n) LWX.drops.length = n;
    c.lineCap = 'round';
    if (k === 'snow') {
      c.fillStyle = night ? 'rgba(220,235,255,.75)' : 'rgba(255,255,255,.85)';
      for (const p of LWX.drops) {
        p.y += 42 * p.v * dt; p.x += (slant * 30 + Math.sin(T * 1.3 + p.s) * 14) * dt;
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; } if (p.x < -6) p.x += W + 12; else if (p.x > W + 6) p.x -= W + 12;
        c.beginPath(); c.arc(p.x, p.y, 1.2 + p.v * 1.3, 0, 6.2832); c.fill();
      }
    } else {
      const len = heavy ? 18 : 13, sp = heavy ? 900 : 700;
      c.strokeStyle = night ? 'rgba(170,205,245,.42)' : 'rgba(205,228,255,.5)'; c.lineWidth = heavy ? 1.3 : 1.1;
      c.beginPath();
      for (const p of LWX.drops) {
        p.y += sp * p.v * dt; p.x += slant * sp * p.v * dt * .1;
        if (p.y > H + len) { p.y = -len - Math.random() * 40; p.x = Math.random() * W; } if (p.x < -20) p.x += W + 40; else if (p.x > W + 20) p.x -= W + 40;
        c.moveTo(p.x, p.y); c.lineTo(p.x - slant * len * .1, p.y - len * p.v);
      }
      c.stroke();
    }
  }
  // wind: thin streaks running across the view
  if (k === 'wind' || (k === 'storm' && wind >= 6)) {
    const n = 16, dir = (d.wdir ?? 270) < 180 ? -1 : 1;
    while (LWX.streaks.length < n) LWX.streaks.push({ x: Math.random() * W, y: Math.random() * H, l: 40 + Math.random() * 90, v: .7 + Math.random() * .6, a: Math.random() });
    c.lineWidth = 1.2;
    for (const s of LWX.streaks) {
      s.x += dir * (120 + wind * 22) * s.v * dt; s.a += dt * .5;
      if (s.x > W + s.l || s.x < -s.l) { s.x = dir > 0 ? -s.l : W + s.l; s.y = Math.random() * H; s.a = 0; }
      const al = .32 * Math.sin(Math.min(1, s.a) * Math.PI);
      c.strokeStyle = `rgba(227,243,255,${al.toFixed(3)})`; c.beginPath(); c.moveTo(s.x, s.y); c.quadraticCurveTo(s.x - dir * s.l * .5, s.y - 4, s.x - dir * s.l, s.y + 2); c.stroke();
    }
  }
  // a storm: now and then the sky flashes
  if (k === 'storm') {
    const now = performance.now();
    if (!LWX.nextFlash) LWX.nextFlash = now + 3000 + Math.random() * 6000;
    if (now > LWX.nextFlash) { LWX.flash = now; LWX.nextFlash = now + 5000 + Math.random() * 9000; }
    const u = (now - LWX.flash) / 260; if (u < 1) { c.fillStyle = `rgba(227,243,255,${(.3 * (1 - u) * (Math.sin(u * 30) > -.4 ? 1 : .3)).toFixed(3)})`; c.fillRect(0, 0, W, H); }
  }
  c.restore();
}
// how much the wind rocks a float (1 is a calm day)
const lwxSway = () => { const k = lwxNow(); if (!k) return 1; return 1 + Math.min(1.6, Math.max(0, (LWX.d && LWX.d.wind || 0) - 2) / 5); };
