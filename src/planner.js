/* ===== 출조 플래너 (the week planner): when and where to go this week. Seven days of wind, waves, rain, the tide and the
   fish in season, for the home sea and my saved fishing points, as one grid of scores (the same score as "today's
   fishing", weather.js). The best day stands out, the weekend gets its own pick, and a day can be sent to a friend as a
   picture or put in the calendar (.ics). Website only. Open-Meteo is asked straight from this browser with the area's
   coordinates or a saved point's (never a catch's spot); kept 2 hours on this device. ===== */
const PL_LS = 'wx7', PL_TTL = 2 * 3600e3, PL_ROWS = 6;
const PL = { mem: new Map(), wrap: null, sel: null, places: [] };
const plKey = p => wxKey(p.lat, p.lon) + (p.fresh ? 'f' : 's');
function plCached(p) { const hit = (lsGet(PL_LS, {}) || {})[plKey(p)]; return hit && nowMs() - hit.at < PL_TTL ? hit.d : null; }
function plFetch(p) {
  const key = plKey(p);
  const c = plCached(p); if (c) return Promise.resolve(c);
  if (PL.mem.has(key)) return PL.mem.get(key);
  const pr = (async () => {
    const q = `latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&timezone=auto&forecast_days=7`;
    const get = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [f, m] = await Promise.all([
      get(`https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m,wind_gusts_10m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&wind_speed_unit=ms`),
      p.fresh ? null : get(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height`)
    ]);
    PL.mem.delete(key);
    const dl = f && f.daily; if (!dl || !Array.isArray(dl.time) || !dl.time.length) return null;
    const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    // the daytime hours (6–18 in the place's own time): the average wind, the strongest gust, the highest rain chance and waves
    const hours = (h, k, day) => { const out = []; if (!h || !Array.isArray(h.time) || !Array.isArray(h[k])) return out; h.time.forEach((tm, i) => { if (typeof tm === 'string' && tm.startsWith(day)) { const hr = +tm.slice(11, 13); const v = num(h[k][i]); if (hr >= 6 && hr <= 18 && v != null) out.push(v); } }); return out; };
    const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), max = a => (a.length ? Math.max(...a) : null);
    const hm = v => (typeof v === 'string' && /T\d\d:\d\d/.test(v) ? v.slice(11, 16) : null);
    const days = dl.time.slice(0, 7).map((day, i) => ({
      day, code: num((dl.weather_code || [])[i]), t: num((dl.temperature_2m_max || [])[i]), tmin: num((dl.temperature_2m_min || [])[i]),
      wind: avg(hours(f.hourly, 'wind_speed_10m', day)), gust: max(hours(f.hourly, 'wind_gusts_10m', day)), rain: max(hours(f.hourly, 'precipitation_probability', day)),
      wave: m ? max(hours(m.hourly, 'wave_height', day)) : null, sr: hm((dl.sunrise || [])[i]), ss: hm((dl.sunset || [])[i])
    }));
    const d = { days, at: nowMs() };
    const all = lsGet(PL_LS, {}) || {}; all[key] = { at: nowMs(), d };
    const keys = Object.keys(all); if (keys.length > 10) for (const k of keys.slice(0, keys.length - 10)) delete all[k];
    lsSet(PL_LS, all);
    return d;
  })();
  PL.mem.set(key, pr);
  return pr;
}
const plDate = day => new Date(day + 'T12:00:00+09:00');
function plScore(dd, place) { return fishScore(dd, place, plDate(dd.day)); }
function plTide(place, day) {
  const L = TIDE.lunar(plDate(day)), st = TIDE.strength(L.age), m = TIDE.mul(L.day, place.rg === 'KW');
  const kr = ['KW', 'KS', 'KE', 'KJ'].includes(place.rg);
  return { st, kr, label: kr ? (m.n ? t('mul_n', { n: m.n }) : t('mul_' + m.k)) : t(st >= .75 ? 'ft_strong' : st >= .3 ? 'ft_mid' : 'ft_weak'), flow: t(st >= .75 ? 'ft_strong' : st >= .3 ? 'ft_mid' : 'ft_weak') };
}
function plDay(day, opt) { try { return plDate(day).toLocaleDateString(locale(), Object.assign({ timeZone: 'Asia/Seoul' }, opt)); } catch (e) { return day.slice(5); } }
const plWd = day => plDay(day, { weekday: 'short' });
const plMd = day => plDay(day, { month: 'numeric', day: 'numeric' });
const plDayName = day => plDay(day, { month: 'short', day: 'numeric', weekday: 'short' });
const plWeekend = day => { const w = plDate(day).getUTCDay(); return w === 0 || w === 6; }; // noon in Korea is the same day in UTC
const plToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
// the best of a set of cells (higher score first, then the earlier day)
function plBest(cells, f = () => true) {
  let b = null;
  for (const c of cells) if (c.s.total != null && f(c) && c.s.level !== 'bad' && (!b || c.s.total > b.s.total || (c.s.total === b.s.total && c.dd.day < b.dd.day))) b = c;
  return b;
}
function plCells() {
  const out = [];
  PL.places.forEach((p, pi) => { const d = plCached(p); if (d) d.days.forEach((dd, di) => out.push({ p, pi, dd, di, s: plScore(dd, p) })); });
  return out;
}

/* --- the peek on the home weather card --- */
function plPeekHTML() {
  if (!wxOn()) return '';
  return `<button class="pl-peek" data-plopen>${icon('sun')}<span data-plpeek>${plPeekText()}</span>${icon('chev')}</button>`;
}
function plPeekText(place) {
  place = place || wxPlaces()[0];
  const d = plCached(place); if (!d) return esc(t('pl_peek'));
  const b = plBest(d.days.map(dd => ({ p: place, dd, s: plScore(dd, place) })));
  return b ? t('pl_peek_best', { day: `<b>${esc(plDayName(b.dd.day))}</b>`, n: `<span class="nowrap"><b class="num">${b.s.total}</b>${esc(t('fs_pts'))}</span>` }) : esc(t('pl_peek'));
}
function plPeekLoad(card) {
  if (!wxOn()) return;
  const place = wxPlaces().find(x => x.id === card.dataset.at) || wxPlaces()[0];
  plFetch(place).then(d => { if (!d) return; $$('[data-plpeek]', card).forEach(el => { el.innerHTML = plPeekText(place); }); });
}

/* --- the planner --- */
function plOpen() {
  if (!wxOn()) { toast(t('lv_web_only'), 'warn'); return; }
  PL.places = wxPlaces().slice(0, PL_ROWS); PL.sel = null;
  PL.wrap = openModal(`<div class="pl" data-pl>${plBodyHTML()}</div>`, { wide: true, label: t('pl_title'), noFocus: true, onClose: () => { PL.wrap = null; } });
  PL.places.forEach(p => plFetch(p).then(() => plPaint()));
}
function plPaint() { const el = PL.wrap && $('[data-pl]', PL.wrap); if (el) { const sc = $('.pl-gridw', el); const x = sc ? sc.scrollLeft : 0; el.innerHTML = plBodyHTML(); const sc2 = $('.pl-gridw', el); if (sc2) sc2.scrollLeft = x; } }
function plBodyHTML() {
  const cells = plCells(), loading = PL.places.some(p => !plCached(p) && PL.mem.has(plKey(p)));
  const best = plBest(cells), wk = plBest(cells, c => plWeekend(c.dd.day));
  const sel = (PL.sel && cells.find(c => c.pi === PL.sel[0] && c.di === PL.sel[1])) || best;
  const days = (cells.find(c => c.pi === 0) ? plCached(PL.places[0]).days : (cells[0] ? plCached(cells[0].p).days : [])).map(x => x.day);
  const today = plToday();
  const head = `<header class="pl-head"><p class="pl-eye">${icon('sun')}${t('pl_title')}</p><h2>${t('pl_h')}</h2><p class="pl-lede">${t('pl_lede')}</p></header>`;
  if (!cells.length) return head + `<p class="pl-wait">${loading || PL.places.some(p => PL.mem.has(plKey(p))) ? `<span class="pl-spin"></span>${t('pl_loading')}` : t('pl_fail')}</p>`;
  const pick = (c, k, cls) => c ? `<button class="pl-pick ${cls}" data-plc="${c.pi}:${c.di}">
      <span class="pl-pk-k">${icon(k === 'pl_best' ? 'trophy' : 'star')}${t(k)}</span>
      <b class="pl-pk-d">${esc(plDayName(c.dd.day))}</b><span class="pl-pk-p">${icon('pin')}${esc(c.p.name)}</span>
      <span class="pl-pk-n lvl-${c.s.level}"><b class="num">${c.s.total}</b>${t('fs_pts')}</span></button>` : '';
  const picks = best ? `<div class="pl-picks">${pick(best, 'pl_best', 'is-best')}${wk && wk !== best ? pick(wk, 'pl_wkend', 'is-wk') : ''}</div>` : `<p class="pl-none">${icon('warn')}${t('pl_none')}</p>`;
  const grid = `<div class="pl-gridw"><table class="pl-grid"><thead><tr><th class="pl-ph" scope="col">${t('pl_place')}</th>${days.map(d => `<th scope="col" class="${plWeekend(d) ? 'we' : ''}${d === today ? ' td' : ''}"><small>${d === today ? t('pl_today') : esc(plWd(d))}</small><b class="num">${esc(plDay(d, { day: 'numeric' }).replace(/[^0-9]/g, ''))}</b></th>`).join('')}</tr></thead>
    <tbody>${PL.places.map((p, pi) => { const d = plCached(p); return `<tr><th scope="row" class="pl-ph"><span>${esc(p.name)}</span><small>${t(p.fresh ? 'pl_fresh' : 'pl_sea')}</small></th>${days.map((day, di) => {
      const dd = d && d.days[di]; if (!dd) return `<td><span class="pl-c pl-c-wait">${PL.mem.has(plKey(p)) ? '·' : '—'}</span></td>`;
      const s = plScore(dd, p), on = sel && sel.pi === pi && sel.di === di, isB = best && best.pi === pi && best.di === di;
      return `<td><button class="pl-c lvl-${s.level || 'none'}${on ? ' on' : ''}${isB ? ' best' : ''}" style="--i:${pi * 7 + di}" data-plc="${pi}:${di}" aria-pressed="${on}" aria-label="${esc(p.name + ' ' + plDayName(dd.day) + ' ' + (s.total ?? '—') + t('fs_pts') + ' ' + t('fs_' + (s.level || 'ok')))}"><b class="num">${s.total ?? '—'}</b>${s.go !== 'good' && s.go ? `<i>${icon('wind')}</i>` : ''}</button></td>`;
    }).join('')}</tr>`; }).join('')}</tbody></table></div>
    <p class="pl-legend"><span class="lvl-great">${t('fs_great')}</span><span class="lvl-good">${t('fs_good')}</span><span class="lvl-ok">${t('fs_ok')}</span><span class="lvl-low">${t('fs_low')}</span><span class="lvl-bad">${t('fs_bad')}</span></p>
    ${PL.places.length < 2 ? `<p class="hint pl-tip">${icon('pin')}${t('pl_add_pts')}</p>` : ''}`;
  return head + picks + grid + (sel ? plDetailHTML(sel) : '') + `<p class="hint wx-src">${t('wx_note')} · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p>`;
}
function plDetailHTML(c) {
  const { p, dd, s } = c, say = fsSay(s, dd, 'ok'), ti = plTide(p, dd.day);
  const tile = (ic, k, v) => `<li class="fs-tile st-${v ? v.st : 'none'}"><span class="ft-k">${icon(ic)}${t(k)}</span><b class="ft-w">${v ? esc(v.word) : '—'}</b><span class="ft-s">${v ? esc(v.sub) : ''}</span></li>`;
  const tide = p.fresh ? { st: 'none', word: '—', sub: t('fs_fresh') } : { st: s.ti >= 24 ? 'good' : s.ti >= 16 ? 'ok' : 'meh', word: ti.label, sub: ti.kr ? ti.flow : '' };
  const sky = fsSky(dd); if (sky && dd.tmin != null && dd.t != null) sky.sub = [`${Math.round(dd.tmin)}°/${Math.round(dd.t)}°`, dd.rain != null ? t('fs_rain', { n: Math.round(dd.rain) }) : ''].filter(Boolean).join(' · ');
  const hrs = dd.sr && dd.ss && s.go !== 'bad' ? `<div class="fs-row"><span class="fs-lbl">${t('fs_when')}</span><span class="fs-rv fs-times"><span class="fs-tw">${icon('sun')}<span class="tw-k">${t('fs_dawn')}</span><b class="num">${hmAdd(dd.sr, -30)}~${hmAdd(dd.sr, 60)}</b></span><span class="fs-tw">${icon('moon')}<span class="tw-k">${t('fs_dusk')}</span><b class="num">${hmAdd(dd.ss, -60)}~${hmAdd(dd.ss, 30)}</b></span></span></div>` : '';
  const top = inSeasonTop(p.rg, plDate(dd.day).getMonth(), 3);
  const fish = top.length ? `<div class="fs-row"><span class="fs-lbl">${t('fs_fish')}</span><span class="fs-rv">${top.map(x => `<button class="chip chip-tab" data-sp="${esc(x.id)}">${esc(nameOf(x.id))}</button>`).join('')}</span></div>` : '';
  return `<section class="pl-det" aria-live="polite">
    <div class="pl-det-h"><span>${icon('pin')}<b>${esc(p.name)}</b></span><span class="num">${esc(plDayName(dd.day))}</span></div>
    <div class="fs-main"><div class="fs-badge lvl-${s.level || 'none'}"><b class="fs-n num">${s.total ?? '—'}</b><span>${t('fs_pts')}</span></div>
      <div class="fs-say"><p class="fs-verdict lvl-${s.level || 'none'}">${esc(say.title)}</p>${say.why ? `<p class="fs-why">${esc(say.why)}</p>` : ''}</div></div>
    <ul class="fs-tiles">${tile('wind', 'fs_t_wind', fsWind(dd))}${tile('wave', 'fs_t_wave', fsWave(dd))}${tile('cloud', 'fs_t_sky', sky)}${tile('moon', 'fs_tide', tide)}</ul>
    <div class="fs-rows">${hrs}${fish}</div>
    <div class="actions pl-acts"><button class="btn btn-primary" data-plshare>${icon('share')}${t('pl_share')}</button>${s.go !== 'bad' ? `<button class="btn btn-line" data-plics>${icon('clock')}${t('pl_ics')}</button>` : ''}</div>
  </section>`;
}
function plSelCell() {
  const cells = plCells();
  return (PL.sel && cells.find(c => c.pi === PL.sel[0] && c.di === PL.sel[1])) || plBest(cells);
}

/* --- send it to a friend: a 1080×1350 picture of the plan --- */
async function plShare(btn) {
  const c = plSelCell(); if (!c) return;
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try {
    const { p, dd, s } = c, W = 1080, H = 1350, P = 72;
    const SANS = '"IBM Plex Sans KR", "IBM Plex Sans JP", "Noto Sans SC", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif', DISP = '"Chakra Petch", ' + SANS;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#123A7A'); bg.addColorStop(.55, '#0B1730'); bg.addColorStop(1, '#050A13'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // the sea line and the sun coming up
    const sun = g.createRadialGradient(W - 230, 420, 0, W - 230, 420, 360); sun.addColorStop(0, 'rgba(227,243,255,.55)'); sun.addColorStop(1, 'rgba(124,196,255,0)'); g.fillStyle = sun; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(124,196,255,.25)'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, 560 + i * 26 + Math.sin(x / 70 + i) * 6); g.stroke(); }
    g.textAlign = 'left'; g.fillStyle = '#7CC4FF'; g.font = `700 40px ${DISP}`; g.fillText('FISHING PLAN', P, 150);
    g.fillStyle = '#FFFFFF'; g.font = `800 92px ${SANS}`; g.fillText(fitText(g, plDayName(dd.day), W - P * 2 - 260), P, 270);
    g.fillStyle = '#C9D3E0'; g.font = `600 50px ${SANS}`; g.fillText(fitText(g, p.name, W - P * 2 - 260), P, 350);
    // the score
    g.save(); g.translate(W - P - 120, 260); g.beginPath(); g.arc(0, 0, 120, 0, 6.3); g.fillStyle = 'rgba(124,196,255,.16)'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#7CC4FF'; g.beginPath(); g.arc(0, 0, 120, -Math.PI / 2, -Math.PI / 2 + 6.283 * (s.total || 0) / 100); g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#FFFFFF'; g.font = `italic 700 104px ${DISP}`; g.fillText(String(s.total ?? '—'), 0, 34); g.font = `600 30px ${SANS}`; g.fillStyle = '#A9BBCF'; g.fillText(t('fs_pts'), 0, 82); g.restore();
    g.textAlign = 'left'; g.fillStyle = '#E3F3FF'; g.font = `700 54px ${SANS}`; g.fillText(fitText(g, t('fs_' + (s.level || 'ok')), W - P * 2), P, 480);
    // four tiles
    const ti = plTide(p, dd.day), w = fsWind(dd), v = fsWave(dd), k = fsSky(dd);
    const tiles = [[t('fs_t_wind'), w && w.word, w && `${wxF1(dd.wind)} m/s`], [t('fs_t_wave'), p.fresh ? '—' : v && v.word, v && `${wxF1(dd.wave)} m`], [t('fs_t_sky'), k && k.word, dd.rain != null ? t('fs_rain', { n: Math.round(dd.rain) }) : ''], [t('fs_tide'), p.fresh ? '—' : ti.label, p.fresh ? '' : ti.kr ? ti.flow : '']];
    const tw = (W - P * 2 - 3 * 24) / 4;
    tiles.forEach(([a, b, cc], i) => { const x = P + i * (tw + 24), y = 690; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, tw, 200, 26) : g.rect(x, y, tw, 200); g.fill(); g.fillStyle = '#8E9BB0'; g.font = `600 28px ${SANS}`; g.fillText(fitText(g, a, tw - 40), x + 22, y + 52); g.fillStyle = '#FFFFFF'; g.font = `700 40px ${SANS}`; g.fillText(fitText(g, b || '—', tw - 40), x + 22, y + 116); g.fillStyle = '#A9BBCF'; g.font = `500 26px ${SANS}`; g.fillText(fitText(g, cc || '', tw - 40), x + 22, y + 164); });
    // the good hours and the fish in season
    if (dd.sr && dd.ss && s.go !== 'bad') { g.fillStyle = '#7CC4FF'; g.font = `600 36px ${SANS}`; g.fillText(fitText(g, `${t('fs_dawn')} ${hmAdd(dd.sr, -30)}~${hmAdd(dd.sr, 60)}  ·  ${t('fs_dusk')} ${hmAdd(dd.ss, -60)}~${hmAdd(dd.ss, 30)}`, W - P * 2), P, 960); }
    const top = inSeasonTop(p.rg, plDate(dd.day).getMonth(), 3);
    top.forEach((x, i) => { const sp = SPI[x.id]; if (!sp) return; const cx = P + 150 + i * 312, cy = 1090; try { FD.draw(g, sp, cx, cy, 250, { still: true }); } catch (e) { } g.textAlign = 'center'; g.fillStyle = '#E3F3FF'; g.font = `600 30px ${SANS}`; g.fillText(fitText(g, nameOf(x.id), 280), cx, cy + 92); g.textAlign = 'left'; });
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(P, H - 120, W - P * 2, 2);
    g.fillStyle = '#FFFFFF'; g.font = `800 36px ${SANS}`; g.fillText(`${APP_NAME[0]} ${APP_NAME[1]} · ${t('pl_go')}`, P, H - 62);
    g.textAlign = 'right'; g.fillStyle = '#7F95AD'; g.font = `500 28px ${SANS}`; g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - P, H - 62);
    const blob = await new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', .9));
    await shareImage(blob, `zzirit-plan-${dd.day}.jpg`, t('pl_share_text', { day: plDayName(dd.day), place: p.name, n: s.total ?? '—' }), { title: 'pl_share_h', sub: 'pl_share_sub' });
  } catch (e) { console.warn(e); toast(t('share_fail'), 'warn'); }
  finally { if (btn) btn.disabled = false; }
}
/* --- put it in the calendar: one event at the dawn window (no coordinates in it) --- */
function plIcs(c) {
  c = c || plSelCell(); if (!c) return null;
  const { p, dd, s } = c, ymd = dd.day.replace(/-/g, '');
  const a = dd.sr ? hmAdd(dd.sr, -30) : '06:00', b = dd.sr ? hmAdd(dd.sr, 60) : '09:00';
  const esc2 = v => String(v).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const desc = [`${t('fs_title')} ${s.total ?? '—'}${t('fs_pts')} · ${t('fs_' + (s.level || 'ok'))}`, fsWind(dd) ? `${t('fs_t_wind')} ${wxF1(dd.wind)} m/s` : '', !p.fresh && dd.wave != null ? `${t('fs_t_wave')} ${wxF1(dd.wave)} m` : '', !p.fresh ? `${t('fs_tide')} ${plTide(p, dd.day).label}` : '', t('wx_note'), SITE_URL].filter(Boolean).join('\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ZZIRIT//planner//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:zzirit-${ymd}-${Math.random().toString(36).slice(2, 10)}@zzirit`, `DTSTAMP:${stamp}`,
    `DTSTART:${ymd}T${a.replace(':', '')}00`, `DTEND:${ymd}T${b.replace(':', '')}00`,
    `SUMMARY:${esc2(t('pl_cal', { place: p.name }))}`, `DESCRIPTION:${esc2(desc)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
function plIcsSave() {
  const c = plSelCell(), txt = plIcs(c); if (!txt) return;
  const url = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = `zzirit-${c.dd.day}.ics`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(t('pl_ics_ok'), 'ok');
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-plopen]'); if (o) { e.preventDefault(); plOpen(); return; }
  if (!PL.wrap || !PL.wrap.contains(e.target)) return;
  const c = e.target.closest('[data-plc]');
  if (c) { const [pi, di] = c.dataset.plc.split(':').map(Number); PL.sel = [pi, di]; plPaint(); if (typeof LVS !== 'undefined' && LVS.buzz) LVS.buzz(8); const det = $('.pl-det', PL.wrap); if (det && c.classList.contains('pl-pick')) det.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  const sh = e.target.closest('[data-plshare]'); if (sh) { plShare(sh); return; }
  if (e.target.closest('[data-plics]')) plIcsSave();
});
