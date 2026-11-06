// Screenshots of the home page's "오늘의 출조" card with realistic weather (Open-Meteo answered by a fixture).
// node web/shot-fs.js [outDir]   (fake server running)
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = (process.argv[2] || __dirname + '/../out/fs') + '/'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8768/index.html';
// the update notes this build would show: marked as seen, so no dialog gets in the way (whatever the current id is)
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const WX = process.env.WX || 'ok';
function forecast() {
  const now = new Date(); const day = now.toISOString().slice(0, 10);
  const hours = Array.from({ length: 48 }, (_, i) => { const d = new Date(Date.parse(day + 'T00:00:00Z') + i * 3600e3); return d.toISOString().slice(0, 13) + ':00'; });
  const wind = WX === 'bad' ? 13.5 : WX === 'care' ? 8.6 : 3.4;
  return { utc_offset_seconds: 32400, current: { temperature_2m: 17.8, weather_code: WX === 'bad' ? 95 : 2, wind_speed_10m: wind, wind_direction_10m: 315, wind_gusts_10m: wind * 1.6 },
    hourly: { time: hours, precipitation_probability: hours.map((_, i) => (WX === 'bad' ? 80 : i % 9 === 3 ? 30 : 10)) },
    daily: { sunrise: [day + 'T06:52', day + 'T06:53'], sunset: [day + 'T17:31', day + 'T17:30'] } };
}
function marine() { return { current: { wave_height: WX === 'bad' ? 2.8 : WX === 'care' ? 1.6 : 0.6, wave_direction: 140, wave_period: 6.2, sea_surface_temperature: 19.4 } }; }
(async () => {
  const b = await chromium.launch(); const fails = [];
  const mk = async (opts = {}) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 900 }, locale: 'ko-KR' }, opts));
    await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); } catch (e) { } }, WN);
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
    await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route(/api\.open-meteo\.com/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(forecast()) }));
    await ctx.route(/marine-api\.open-meteo\.com/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(marine()) }));
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage(); p.on('pageerror', e => fails.push(e.message));
    await p.goto(BASE + '#home'); await p.waitForTimeout(1400);
    await p.click('[data-act="onboard"]:visible'); await p.waitForTimeout(400); await p.fill('#pf-nick', '테스트' + Math.floor(Math.random() * 1000)); await p.selectOption('#pf-home', 'KS');
    if (await p.$('#onb-noid')) await p.click('#onb-noid'); else await p.click('#onb-go'); await p.waitForTimeout(1600);
    await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(1600);
    return p;
  };
  const D = await mk();
  const card = await D.$('#wx-card'); if (card) { await card.scrollIntoViewIfNeeded(); await D.waitForTimeout(500); await card.screenshot({ path: OUT + 'fs_desktop_' + WX + '.png' }); } else fails.push('no card (desktop)');
  const P = await mk({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pc = await P.$('#wx-card'); if (pc) { await pc.scrollIntoViewIfNeeded(); await P.waitForTimeout(500); await pc.screenshot({ path: OUT + 'fs_phone_' + WX + '.png' }); } else fails.push('no card (phone)');
  console.log(fails.length ? 'FAIL ' + fails.join(' | ') : 'shots ok'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
