/* ===== Today's fishing (오늘의 출조): sea weather — wind, waves, water temperature, rain — plus one rough score that
   adds the weather, the tide and the season, and the best times of the day. Weather from Open-Meteo Data from Open-Meteo (free for non-commercial use; © Open-Meteo.com and the weather services it
   draws on). Website only. Asked straight from this browser with the area's coordinates or a saved fishing point —
   never the exact spot of a catch. Kept for 30 minutes so the page doesn't ask again on every visit. ===== */
const WX_LS = 'wx2'; // v2 adds sunrise / sunset
const WX_TTL = 30 * 60000;
function wxOn() { return window.APP_RT === 'web' && !(S.admin.config && S.admin.config.wxOff); } // the operator can switch it off
const wxKey = (lat, lon) => lat.toFixed(2) + ',' + lon.toFixed(2);
const wxMem = new Map();
function wxCached(lat, lon) { const hit = (lsGet(WX_LS, {}) || {})[wxKey(lat, lon)]; return hit && nowMs() - hit.at < WX_TTL ? hit.d : null; }
async function wxFetch(lat, lon) {
  const key = wxKey(lat, lon);
  if (wxMem.has(key)) return wxMem.get(key);
  const cache = lsGet(WX_LS, {}) || {}; const hit = cache[key];
  if (hit && nowMs() - hit.at < WX_TTL) return hit.d;
  const p = (async () => {
    const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=auto`;
    const get = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [f, m] = await Promise.all([
      get(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=precipitation_probability&daily=sunrise,sunset&forecast_days=2&wind_speed_unit=ms`),
      get(`https://marine-api.open-meteo.com/v1/marine?${q}&current=wave_height,wave_direction,wave_period,sea_surface_temperature&forecast_days=1`)
    ]);
    wxMem.delete(key);
    if (!f && !m) return null;
    const cur = (f && f.current) || {}, mc = (m && m.current) || {};
    // the highest chance of rain over the next 12 hours (times come in the area's local time)
    let rain = null;
    if (f && f.hourly && Array.isArray(f.hourly.time) && Array.isArray(f.hourly.precipitation_probability)) {
      const off = (f.utc_offset_seconds || 0) * 1000, now = Date.now();
      f.hourly.time.forEach((tm, i) => { const at = Date.parse(tm + 'Z') - off; const v = f.hourly.precipitation_probability[i]; if (at >= now - 3600e3 && at <= now + 12 * 3600e3 && typeof v === 'number') rain = Math.max(rain ?? 0, v); });
    }
    const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    const hm = v => (typeof v === 'string' && /T\d\d:\d\d/.test(v) ? v.slice(11, 16) : null); // sunrise / sunset in the place's own time
    const day = (f && f.daily) || {};
    const d = { t: num(cur.temperature_2m), code: num(cur.weather_code), wind: num(cur.wind_speed_10m), gust: num(cur.wind_gusts_10m), wdir: num(cur.wind_direction_10m), wave: num(mc.wave_height), wper: num(mc.wave_period), sst: num(mc.sea_surface_temperature), rain, sr: hm((day.sunrise || [])[0]), ss: hm((day.sunset || [])[0]), at: nowMs() };
    const c2 = lsGet(WX_LS, {}) || {}; c2[key] = { at: nowMs(), d };
    const keys = Object.keys(c2); if (keys.length > 12) for (const k of keys.slice(0, keys.length - 12)) delete c2[k];
    lsSet(WX_LS, c2);
    return d;
  })();
  wxMem.set(key, p);
  return p;
}
/* wind and waves decide most trips; this is only a rough read, not a safety call */
function wxGo(d) {
  const w = d.wind ?? 0, g = d.gust ?? w, h = d.wave;
  if (w >= 12 || g >= 17 || (h != null && h >= 2.5) || (d.code != null && d.code >= 95)) return 'bad'; // thunder: no rods out
  if (w >= 8 || g >= 12 || (h != null && h >= 1.5)) return 'care';
  return 'good';
}
function wxSky(code) {
  if (code == null) return '';
  const k = code === 0 ? 'clear' : code <= 2 ? 'partly' : code === 3 ? 'cloudy' : code <= 48 ? 'fog' : code <= 57 ? 'drizzle' : code <= 67 ? 'rain' : code <= 77 ? 'snow' : code <= 82 ? 'shower' : code <= 86 ? 'snow' : 'storm';
  return t('wxs_' + k);
}
function windDir(deg) { if (deg == null) return ''; const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8; return t('wd_' + ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][i]); }
const wxF1 = v => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1));
function wxLine(d) {
  const go = wxGo(d);
  return `<span class="wx-go wx-${go}">${icon(go === 'good' ? 'check' : 'warn')}${t('wxgo_' + go)}</span>
    <span class="wx-it">${icon('cloud')}<b>${d.t == null ? '—' : Math.round(d.t) + '°'}</b> ${esc(wxSky(d.code))}</span>
    <span class="wx-it">${icon('wind')}<b>${wxF1(d.wind)}</b>m/s ${esc(windDir(d.wdir))}${d.gust != null ? ` <span class="muted">${t('wx_gust', { v: wxF1(d.gust) })}</span>` : ''}</span>
    <span class="wx-it">${icon('wave')}<b>${d.wave == null ? '—' : wxF1(d.wave)}</b>${d.wave == null ? '' : 'm'}${d.wper != null ? ` <span class="muted">${t('wx_period', { v: Math.round(d.wper) })}</span>` : ''}</span>
    ${d.sst != null ? `<span class="wx-it">${t('wx_sst')} <b>${wxF1(d.sst)}°</b></span>` : ''}
    ${d.rain != null ? `<span class="wx-it">${t('wx_rain')} <b>${Math.round(d.rain)}%</b></span>` : ''}`;
}
/* the places one can pick: the home sea and my saved fishing points (each with its region, sea or fresh water) */
const FS_FRESH_OF = { KW: 'KF', KS: 'KF', KE: 'KF', KJ: 'KF', JP: 'JF', CN: 'CF', TW: 'CF' };
function placeRegion(p) {
  const home = homeRegion();
  if (!p || p.id === 'home') return { rg: home, fresh: !!GEO.FRESH[home] };
  if (p.kind === 'river' || p.kind === 'lake') {
    const r = GEO.FRESH[home] ? home : FS_FRESH_OF[GEO.region(p.lon, p.lat, true)] || FS_FRESH_OF[home] || home;
    return { rg: r, fresh: !!GEO.FRESH[r] };
  }
  const r = GEO.region(p.lon, p.lat, true);
  const rg = GEO.HOME[r] && !GEO.FRESH[r] ? r : GEO.FRESH[home] ? 'KS' : home;
  return { rg, fresh: false };
}
function wxPlaces() {
  const h = GEO.HOME[homeRegion()] || [128, 35];
  const out = [Object.assign({ id: 'home', name: regionName(homeRegion()), lat: h[1], lon: h[0] }, placeRegion(null))];
  if (typeof ptLists === 'function') for (const p of ptLists().mine.slice(0, 20)) if (p.lat != null) out.push(Object.assign({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: p.kind }, placeRegion(p)));
  return out;
}

/* ----- the fishing score: weather 40 + tide 30 + season 30 (fresh water: weather and season only). A rough guide. ----- */
const ACT_MEMO = new Map();
function seasonAct(rg) { // how lively the region's fish are in each month (abundance × the species' monthly activity)
  if (ACT_MEMO.has(rg)) return ACT_MEMO.get(rg);
  const lat = (GEO.HOME[rg] || [0, 36])[1]; const a = new Array(12).fill(0);
  for (const sp of SP) { const ab = sp.ab[rg]; if (!ab) continue; const w = Math.pow(ab, 1.3); for (let m = 0; m < 12; m++) a[m] += w * GEO.seasonVal(sp, m, lat); }
  ACT_MEMO.set(rg, a); return a;
}
function seasonScore(rg, m) { const a = seasonAct(rg); const lo = Math.min(...a), hi = Math.max(...a); return Math.round(hi > lo ? 10 + 20 * (a[m] - lo) / (hi - lo) : 20); }
function tideScore(st) { return Math.round(30 * Math.max(.35, 1 - Math.abs(st - .62) * 1.4)); } // a moderate current suits most fishing
function wxScore(d) { const go = wxGo(d); let v = go === 'good' ? 40 : go === 'care' ? 20 : 0; if (d.rain != null) v -= d.rain >= 70 ? 10 : d.rain >= 40 ? 5 : 0; return Math.max(0, v); }
function fishScore(d, place) {
  const now = new Date(); const st = TIDE.strength(TIDE.lunar(now).age);
  const se = seasonScore(place.rg, now.getMonth()), ti = place.fresh ? null : tideScore(st), w = d ? wxScore(d) : null;
  let total = null;
  if (w != null) total = place.fresh ? Math.round((w + se) * 100 / 70) : w + ti + se;
  const go = d ? wxGo(d) : null;
  if (go === 'bad') total = Math.min(total, 30);
  const level = total == null ? null : go === 'bad' ? 'bad' : total >= 80 ? 'great' : total >= 62 ? 'good' : total >= 45 ? 'ok' : 'low';
  return { total, w, ti, se, st, go, level, fresh: place.fresh };
}
const FS_IC = { great: 'check', good: 'check', ok: 'info', low: 'info', bad: 'warn' };
function fsChip(s) { return s.level ? `<span class="fs-lvl fs-${s.level}">${icon(FS_IC[s.level])}${t('fs_' + s.level)}</span>` : ''; }
function fsTopHTML(s) {
  const part = (k, v, max, note) => `<li><span class="fs-k">${t(k)}</span><span class="fs-bar" role="meter" aria-label="${esc(t(k))}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v == null ? 0 : v}"><i style="width:${v == null ? 0 : Math.round(v / max * 100)}%"></i></span><b class="fs-v">${v == null ? (note || '—') : `${v}<small>/${max}</small>`}</b></li>`;
  return `<div class="fs-score"><span class="fs-n">${s.total == null ? '—' : s.total}</span><span class="fs-of">/100</span>${fsChip(s)}</div>
    <ul class="fs-parts">${part('fs_wx', s.w, 40)}${s.fresh ? part('fs_tide', null, 30, t('fs_fresh')) : part('fs_tide', s.ti, 30)}${part('fs_season', s.se, 30)}</ul>`;
}
function hmAdd(hm, min) { const [h, m] = hm.split(':').map(Number); const v = ((h * 60 + m + min) % 1440 + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); }
function fsExtraHTML(d, place) {
  const out = [];
  if (d && d.sr && d.ss) out.push(`<span class="fs-time">${icon('sun')}${t('fs_dawn')} <b>${hmAdd(d.sr, -30)}~${hmAdd(d.sr, 60)}</b></span><span class="fs-time">${icon('moon')}${t('fs_dusk')} <b>${hmAdd(d.ss, -60)}~${hmAdd(d.ss, 30)}</b></span>`);
  const top = inSeasonTop(place.rg, new Date().getMonth(), 3);
  if (top.length) out.push(`<span class="fs-fish">${t('fs_fish')} ${top.map(x => `<button class="chip chip-tab" data-sp="${esc(x.id)}">${esc(nameOf(x.id))}</button>`).join('')}</span>`);
  return out.join('');
}
function wxCardHTML() {
  if (!wxOn()) return '';
  const places = wxPlaces(); const sel = places.find(x => x.id === lsGet('wxAt', 'home')) || places[0];
  const d = wxCached(sel.lat, sel.lon);
  return `<section class="card wx-card fs-card" id="wx-card" data-at="${esc(sel.id)}">
    <div class="sec-head tight"><h2 class="h3">${icon('wave')}${t('fs_title')}</h2>
      ${places.length > 1 ? `<select id="wx-at" aria-label="${esc(t('wx_where'))}">${places.map(x => `<option value="${esc(x.id)}" ${x.id === sel.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : `<span class="muted small">${esc(sel.name)}</span>`}
    </div>
    <div class="fs-top" id="fs-top">${fsTopHTML(fishScore(d, sel))}</div>
    <div class="wx-line" id="wx-line">${d ? wxLine(d) : `<span class="muted small">${t('thinking')}</span>`}</div>
    <p class="fs-extra" id="fs-extra">${fsExtraHTML(d, sel)}</p>
    <details class="fs-how"><summary>${t('fs_how_q')}</summary><p class="small muted">${t('fs_how')}</p></details>
    <p class="hint wx-src">${t('wx_note')} · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p>
  </section>`;
}
function wxHydrate(root) {
  const card = $('#wx-card', root); if (!card) return;
  const place = wxPlaces().find(x => x.id === card.dataset.at) || wxPlaces()[0];
  const line = $('#wx-line', card), top = $('#fs-top', card), extra = $('#fs-extra', card);
  wxFetch(place.lat, place.lon).then(d => {
    if (!line.isConnected) return;
    line.innerHTML = d ? wxLine(d) : `<span class="muted small">${t('wx_fail')}</span>`;
    top.innerHTML = fsTopHTML(fishScore(d, place)); extra.innerHTML = fsExtraHTML(d, place);
  });
  const sel = $('#wx-at', card);
  if (sel) sel.onchange = () => {
    lsSet('wxAt', sel.value); const p = wxPlaces().find(x => x.id === sel.value); if (!p) return;
    card.dataset.at = p.id; line.innerHTML = `<span class="muted small">${t('thinking')}</span>`;
    top.innerHTML = fsTopHTML(fishScore(null, p)); extra.innerHTML = fsExtraHTML(null, p); wxHydrate(root);
  };
}
try { if (localStorage.getItem('eosin.wx')) localStorage.removeItem('eosin.wx'); } catch (e) { } // the first version's cache
