// 출조 플래너: the peek on the home weather card, the 7-day grid (home sea + a saved point), the best day and the weekend
// pick, a stormy day marked "stay ashore", tapping a day for its details (tide name, good hours, fish), the picture to send,
// the calendar file (no coordinates), only the area's rounded coordinates asked, the phone, English, a failed weather.
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/planner/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/planner/'; fs.mkdirSync(OUT, { recursive: true });
const SRV = 'http://127.0.0.1:8768', BASE = SRV + '/index.html';
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 6000, step = 80) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); } catch (e) { v = null; } if (v) return v; await sleep(step); } return v; }
// seven days from today (Korean date); day 1 is a storm, day 4 is calm and flat, the rest so-so
const DAYS = [...Array(7)].map((_, i) => new Date(Date.now() + 9 * 3600e3 + i * 864e5).toISOString().slice(0, 10));
const WIND = [6, 14, 5, 6.5, 1.5, 6, 5.5], GUST = [9, 21, 8, 10, 3, 9, 9], WAVE = [1.0, 3.2, 1.1, 1.2, .2, 1.1, 1.0], RAIN = [20, 90, 30, 20, 0, 30, 40];
const hourly = f => ({ time: DAYS.flatMap(d => [...Array(24)].map((_, h) => `${d}T${String(h).padStart(2, '0')}:00`)), ...f });
const FC = () => ({ utc_offset_seconds: 32400, daily: { time: DAYS, weather_code: [2, 95, 3, 2, 0, 61, 3], temperature_2m_max: DAYS.map(() => 14), temperature_2m_min: DAYS.map(() => 6), sunrise: DAYS.map(d => d + 'T07:10'), sunset: DAYS.map(d => d + 'T17:15') },
  hourly: hourly({ wind_speed_10m: DAYS.flatMap((_, i) => Array(24).fill(WIND[i])), wind_gusts_10m: DAYS.flatMap((_, i) => Array(24).fill(GUST[i])), precipitation_probability: DAYS.flatMap((_, i) => Array(24).fill(RAIN[i])) }),
  // the "today" card asks the same server for the current weather
  current: { temperature_2m: 12, weather_code: 2, wind_speed_10m: 4, wind_direction_10m: 300, wind_gusts_10m: 7 } });
const MC = () => ({ utc_offset_seconds: 32400, hourly: hourly({ wave_height: DAYS.flatMap((_, i) => Array(24).fill(WAVE[i])) }), current: { wave_height: .8, sea_surface_temperature: 16 } });
(async () => {
  const b = await chromium.launch();
  const asked = [];
  try {
    const mk = async (name, opts = {}, wx = true) => {
      const touch = !!opts.isMobile;
      const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 900 }, locale: 'ko-KR', acceptDownloads: true }, opts));
      if (touch) await ctx.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /hover: hover|pointer: fine/.test(q) ? { matches: false, media: q, onchange: null, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }, dispatchEvent() { return false; } } : mm(q); });
      await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); } catch (e) { } }, WN);
      await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
      await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
      await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      await ctx.route('https://api.open-meteo.com/**', r => { asked.push(r.request().url()); return wx ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(FC()) }) : r.abort(); });
      await ctx.route('https://marine-api.open-meteo.com/**', r => { asked.push(r.request().url()); return wx ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(MC()) }) : r.abort(); });
      await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      const p = await ctx.newPage();
      p.on('pageerror', e => { logs.push(name + ' PAGEERROR: ' + e.message); fails.push(name + ' pageerror ' + e.message); });
      await p.goto(BASE + '#home'); await p.waitForTimeout(1400);
      return p;
    };
    const go = async (p, h, w = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w); };
    const onboard = async (p, nick) => { await go(p, 'home'); await p.click('[data-act="onboard"]:visible'); await p.waitForTimeout(400); await p.fill('#pf-nick', nick); await p.selectOption('#pf-home', 'KS'); if (await p.$('#onb-noid')) await p.click('#onb-noid'); else await p.click('#onb-go'); await p.waitForTimeout(1500); };
    const shot = (p, n, full) => p.screenshot({ path: OUT + n + '.png', fullPage: !!full });

    const A = await mk('A'); await onboard(A, '출조왕');
    // a saved fishing point (precise, only mine)
    await A.evaluate(() => { S.points.set('pt1', { id: 'pt1', name: '오륙도 방파제', lat: 35.0987, lon: 129.1234, kind: 'breakwater', _owner: S.uid, upd: Date.now() }); });
    await go(A, 'home', 1800);
    ok(await until(() => A.$eval('#wx-card .pl-peek', n => /이번 주 최고의 날/.test(n.textContent) && /\d+점/.test(n.textContent))), 'home: the weather card says the best day this week');
    const peek = await A.$eval('#wx-card .pl-peek', n => n.textContent);
    await A.click('#wx-card .pl-peek'); await A.waitForTimeout(1500);
    ok(await until(() => A.$$eval('.pl-grid tbody tr', rs => rs.length === 2 && rs.every(r => r.querySelectorAll('.pl-c:not(.pl-c-wait)').length === 7))), 'the planner: two places (home and my point) × 7 days');
    const cells = await A.$$eval('.pl-grid tbody tr:first-child .pl-c', ns => ns.map(n => ({ n: +n.textContent.trim() || 0, cls: n.className })));
    ok(cells[1].cls.includes('lvl-bad') && cells[1].n <= 30, 'the stormy day says stay ashore ' + JSON.stringify(cells[1]));
    const top = Math.max(...cells.map(c => c.n));
    // the tide (the moon) and the season (a new month) change from day to day, so compare the days without them: the calm, flat day has the best weather
    const tides = await A.evaluate(ds => ds.map(d => tideScore(TIDE.strength(TIDE.lunar(plDate(d)).age)) + seasonScore(PL.places[0].rg, plDate(d).getMonth())), DAYS);
    const noTide = cells.map((c, i) => c.n - tides[i]);
    ok(!/lvl-bad/.test(cells[4].cls) && noTide[4] === Math.max(...noTide) && cells[1].n === Math.min(...cells.map(c => c.n)), 'the calm, flat day scores best (without tide and season), the storm lowest ' + cells.map(c => c.n).join(',') + ' tide+season ' + tides.join(','));
    ok(await A.$eval('.pl-grid thead th:nth-child(2)', n => /오늘/.test(n.textContent)), 'the first day is today');
    const best = await A.$eval('.pl-pick.is-best', n => n.textContent);
    ok(/이번 주 최고의 날/.test(best) && new RegExp(top + '점').test(best), 'the best day stands out: ' + best.replace(/\s+/g, ' '));
    ok(peek.includes(top + '점'), 'the home card named the same score');
    ok(await A.$$eval('.pl-grid .pl-c.best', ns => ns.length === 1), 'one square glows as the best');
    // the detail of the selected (best) day
    ok(await A.$eval('.pl-det', n => /좋은 시간/.test(n.textContent) && /06:40~08:10/.test(n.textContent) && /물|조금|무시/.test(n.textContent) && n.querySelectorAll('[data-sp]').length >= 1).catch(() => false), 'the day in detail: good hours from sunrise, the tide, fish in season');
    await shot(A, 'p01_planner_pc');
    // tap the storm
    await A.click('.pl-grid tbody tr:first-child td:nth-child(3) .pl-c'); await A.waitForTimeout(500);
    ok(await A.$eval('.pl-det', n => /출조 자제/.test(n.textContent) && !/좋은 시간/.test(n.textContent) && !n.querySelector('[data-plics]')).catch(() => false), 'a stormy day: stay ashore, no good hours, no calendar button');
    ok(await A.$eval('.pl-grid tbody tr:first-child td:nth-child(3) .pl-c', n => n.classList.contains('on') && n.getAttribute('aria-pressed') === 'true'), 'the tapped square is marked');
    // my point's row: the same days, its own name
    await A.click('.pl-grid tbody tr:nth-child(2) td:nth-child(6) .pl-c'); await A.waitForTimeout(500);
    ok(await A.$eval('.pl-det-h', n => /오륙도 방파제/.test(n.textContent)).catch(() => false), 'my point\'s day shows its name');
    // only rounded coordinates were asked (3 decimals), never more
    ok(asked.length >= 4 && asked.every(u => { const m = u.match(/latitude=([\d.-]+)&longitude=([\d.-]+)/); return m && m[1].split('.')[1].length <= 3 && m[2].split('.')[1].length <= 3; }) && asked.some(u => /forecast_days=7/.test(u)), 'asked Open-Meteo with rounded coordinates, 7 days');
    // the calendar file
    const [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-plics]')]);
    const ics = fs.readFileSync(await dl.path(), 'utf8');
    ok(/^BEGIN:VCALENDAR/.test(ics) && /DTSTART:\d{8}T064000/.test(ics) && /DTEND:\d{8}T081000/.test(ics) && /SUMMARY:찌릿 출조 · 오륙도 방파제/.test(ics) && !/35\.09|129\.12/.test(ics), 'the calendar file: the dawn window, the place name, no coordinates');
    ok(/\.ics$/.test(dl.suggestedFilename()), 'saved as .ics');
    // the picture to send
    await A.click('[data-plshare]'); await A.waitForTimeout(1500);
    ok(await A.$eval('.share-card img', n => n.naturalWidth === 1080 && n.naturalHeight === 1350).catch(() => false), 'the plan picture (1080×1350) opens the share card');
    ok(await A.$eval('.share-card [data-copy]', n => /출조 어때\? 찌릿 점수 \d+점/.test(n.dataset.copy)).catch(() => false), 'with a line to send: "… 출조 어때? 찌릿 점수 N점"');
    await shot(A, 'p02_share_pc');
    await A.keyboard.press('Escape'); await A.waitForTimeout(400); await A.keyboard.press('Escape'); await A.waitForTimeout(400);
    // opening again uses what is kept (2 hours), no new questions
    const n0 = asked.length;
    await A.click('#wx-card .pl-peek'); await A.waitForTimeout(800);
    ok(asked.length === n0 && await A.$$eval('.pl-grid tbody tr', rs => rs.length === 2), 'opened again: from this device, nothing asked again');
    await A.keyboard.press('Escape'); await A.waitForTimeout(400);

    /* ---------- the phone ---------- */
    const P = await mk('P', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await onboard(P, '폰출조');
    await go(P, 'home', 1800);
    await until(() => P.$eval('#wx-card .pl-peek', n => /최고의 날/.test(n.textContent)));
    await P.$eval('#wx-card .pl-peek', n => n.scrollIntoView({ block: 'center' })); await P.waitForTimeout(300);
    await shot(P, 'p03_home_peek_phone');
    await P.click('#wx-card .pl-peek'); await P.waitForTimeout(1500);
    ok(await until(() => P.$$eval('.pl-grid tbody .pl-c', ns => ns.length === 7)), 'phone: one place (home), 7 days, and a tip to save points');
    ok(await P.evaluate(() => { const g = document.querySelector('.pl-gridw'), t = document.querySelector('.pl-grid'); return document.documentElement.scrollWidth <= 390 && t.getBoundingClientRect().width <= g.getBoundingClientRect().width + 1; }), 'phone: the grid fits, no sideways scroll');
    ok(await P.$('.pl-tip'), 'phone: a tip to save fishing points');
    await shot(P, 'p04_planner_phone');
    await P.$eval('.pl-det', n => n.scrollIntoView({ block: 'start' })); await P.waitForTimeout(300);
    await shot(P, 'p05_planner_detail_phone');
    await P.evaluate(() => closeModal());
    // English
    await P.evaluate(() => { setLang('en'); rerender(); }); await P.waitForTimeout(1500);
    await go(P, 'home', 1200);
    ok(await until(() => P.$eval('#wx-card .pl-peek', n => /Best this week/.test(n.textContent))), 'English: the peek');
    await P.click('#wx-card .pl-peek'); await P.waitForTimeout(900);
    ok(await P.$eval('.pl', n => /When and where this week/.test(n.textContent) && /Today/.test(n.textContent)), 'English: the planner');
    await P.evaluate(() => closeModal());

    /* ---------- the weather can't be had ---------- */
    const F = await mk('F', {}, false); await onboard(F, '날씨없음');
    await go(F, 'home', 1500);
    ok(await F.$eval('#wx-card .pl-peek', n => /7일 출조 계획 보기/.test(n.textContent)).catch(() => false), 'no weather: the peek just offers the plan');
    await F.click('#wx-card .pl-peek'); await F.waitForTimeout(1500);
    ok(await until(() => F.$eval('.pl', n => /날씨를 받지 못했어요/.test(n.textContent))), 'no weather: the planner says so');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  finally {
    await b.close();
    console.log(logs.join('\n'));
    console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL PASSED');
    process.exit(fails.length ? 1 : 0);
  }
})();
