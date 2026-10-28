/* ===== Sea weather (바다 날씨): wind, waves, water temperature and rain for a fishing area, with a rough
   "good to go?" read. Data from Open-Meteo (free for non-commercial use; © Open-Meteo.com and the weather services it
   draws on). Website only. Asked straight from this browser with the area's coordinates or a saved fishing point —
   never the exact spot of a catch. Kept for 30 minutes so the page doesn't ask again on every visit. ===== */
const WX_TTL = 30 * 60000;
function wxOn() { return window.APP_RT === 'web' && !(S.admin.config && S.admin.config.wxOff); } // the operator can switch it off
const wxKey = (lat, lon) => lat.toFixed(2) + ',' + lon.toFixed(2);
const wxMem = new Map();
function wxCached(lat, lon) { const hit = (lsGet('wx', {}) || {})[wxKey(lat, lon)]; return hit && nowMs() - hit.at < WX_TTL ? hit.d : null; }
async function wxFetch(lat, lon) {
  const key = wxKey(lat, lon);
  if (wxMem.has(key)) return wxMem.get(key);
  const cache = lsGet('wx', {}) || {}; const hit = cache[key];
  if (hit && nowMs() - hit.at < WX_TTL) return hit.d;
  const p = (async () => {
    const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=auto`;
    const get = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [f, m] = await Promise.all([
      get(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=precipitation_probability&forecast_days=2&wind_speed_unit=ms`),
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
    const d = { t: num(cur.temperature_2m), code: num(cur.weather_code), wind: num(cur.wind_speed_10m), gust: num(cur.wind_gusts_10m), wdir: num(cur.wind_direction_10m), wave: num(mc.wave_height), wper: num(mc.wave_period), sst: num(mc.sea_surface_temperature), rain, at: nowMs() };
    const c2 = lsGet('wx', {}) || {}; c2[key] = { at: nowMs(), d };
    const keys = Object.keys(c2); if (keys.length > 12) for (const k of keys.slice(0, keys.length - 12)) delete c2[k];
    lsSet('wx', c2);
    return d;
  })();
  wxMem.set(key, p);
  return p;
}
/* wind and waves decide most trips; this is only a rough read, not a safety call */
function wxGo(d) {
  const w = d.wind ?? 0, g = d.gust ?? w, h = d.wave;
  if (w >= 12 || g >= 17 || (h != null && h >= 2.5)) return 'bad';
  if (w >= 8 || g >= 12 || (h != null && h >= 1.5) || (d.code != null && d.code >= 95)) return 'care';
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
/* the places one can pick: the home sea and my saved fishing points */
function wxPlaces() {
  const h = GEO.HOME[homeRegion()] || [128, 35];
  const out = [{ id: 'home', name: regionName(homeRegion()), lat: h[1], lon: h[0] }];
  if (typeof ptLists === 'function') for (const p of ptLists().mine.slice(0, 20)) if (p.lat != null) out.push({ id: p.id, name: p.name, lat: p.lat, lon: p.lon });
  return out;
}
function wxCardHTML() {
  if (!wxOn()) return '';
  const places = wxPlaces(); const sel = places.find(x => x.id === lsGet('wxAt', 'home')) || places[0];
  return `<section class="card wx-card" id="wx-card" data-lat="${sel.lat}" data-lon="${sel.lon}">
    <div class="sec-head tight"><h2 class="h3">${icon('wave')}${t('wx_title')}</h2>
      ${places.length > 1 ? `<select id="wx-at" aria-label="${esc(t('wx_where'))}">${places.map(x => `<option value="${esc(x.id)}" ${x.id === sel.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : `<span class="muted small">${esc(sel.name)}</span>`}
    </div>
    <div class="wx-line" id="wx-line">${(() => { const d = wxCached(sel.lat, sel.lon); return d ? wxLine(d) : `<span class="muted small">${t('thinking')}</span>`; })()}</div>
    <p class="hint wx-src">${t('wx_note')} · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p>
  </section>`;
}
function wxHydrate(root) {
  const card = $('#wx-card', root); if (!card) return;
  const lat = +card.dataset.lat, lon = +card.dataset.lon; const line = $('#wx-line', card);
  wxFetch(lat, lon).then(d => { if (!line.isConnected) return; line.innerHTML = d ? wxLine(d) : `<span class="muted small">${t('wx_fail')}</span>`; });
  const sel = $('#wx-at', card);
  if (sel) sel.onchange = () => { lsSet('wxAt', sel.value); const p = wxPlaces().find(x => x.id === sel.value); if (!p) return; card.dataset.lat = p.lat; card.dataset.lon = p.lon; line.innerHTML = `<span class="muted small">${t('thinking')}</span>`; wxHydrate(root); };
}
