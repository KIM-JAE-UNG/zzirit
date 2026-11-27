// 나의 낚시 여행: my catches played back on the map. On a computer: the card on 내 조과 (statistics tab) and the button
// at the top, the player (the map, the year chips, it starts by itself, the stop card with 첫 만남 / 내 최고 기록 and the
// far flight, the numbers add up: fish, kinds, places, km), faster, the end screen, dragging the bar, the keyboard,
// another year, the picture to share (1080×1350, no places and no coordinates written on it), Escape. Refused catches and
// ones without a place are left out. On a phone: everything fits and can be pressed. English. Someone with no places.
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/journey/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/journey/'; fs.mkdirSync(OUT, { recursive: true });
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 6000, step = 80) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); } catch (e) { v = null; } if (v) return v; await sleep(step); } return v; }
const reachable = (p, sel) => p.evaluate(s => {
  const n = document.querySelector(s); if (!n) return 'missing';
  const r = n.getBoundingClientRect(); if (!r.width || !r.height) return 'no size';
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return 'off screen y=' + Math.round(y);
  const top = document.elementFromPoint(x, y); return top && (top === n || n.contains(top)) ? 'ok' : 'covered by ' + (top ? (top.className || top.tagName) : 'nothing');
}, sel);
// a year of fishing (and one from the year before): Busan → Busan again (a bigger one) → Yeosu → Jeju (the far flight) → Gangneung,
// one with no place, one that was refused, one from 2025
const Y = new Date().getFullYear();
const CATCHES = (Y => [
  { id: 'j1', sp: 'kurodai', len: 32, ts: Date.parse(`${Y}-03-14T06:10:00+09:00`), lat: 35.0794, lon: 129.0756, rg: 'KS', st: 'ok', bait: '크릴' },
  { id: 'j2', sp: 'kurodai', len: 41.5, ts: Date.parse(`${Y}-04-02T05:40:00+09:00`), lat: 35.0812, lon: 129.0801, rg: 'KS', st: 'ok' },
  { id: 'j3', sp: 'mebaru', len: 22, ts: Date.parse(`${Y}-05-20T20:30:00+09:00`), lat: 34.7362, lon: 127.7458, rg: 'KS', st: 'ok' },
  { id: 'j4', sp: 'ishidai', len: 48, ts: Date.parse(`${Y}-08-09T07:00:00+09:00`), lat: 33.2456, lon: 126.5612, rg: 'KJ', st: 'ok' },
  { id: 'j5', sp: 'kurodai', len: 38, ts: Date.parse(`${Y}-10-30T16:20:00+09:00`), lat: 37.7719, lon: 128.9476, rg: 'KE', st: 'ok' },
  { id: 'j6', sp: 'mejina', len: 30, ts: Date.parse(`${Y}-06-01T09:00:00+09:00`), st: 'ok' },
  { id: 'j7', sp: 'mejina', len: 99, ts: Date.parse(`${Y}-07-01T09:00:00+09:00`), lat: 35.5, lon: 129.3, rg: 'KS', st: 'no' },
  { id: 'j8', sp: 'suzuki', len: 60, ts: Date.parse(`${Y - 1}-09-10T09:00:00+09:00`), lat: 36.9, lon: 126.2, rg: 'KW', st: 'ok' }
])(Y);
(async () => {
  const b = await chromium.launch();
  const mk = async (name, phone, locale = 'ko-KR') => {
    const ctx = await b.newContext(phone ? { userAgent: IOS, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale } : { viewport: { width: 1360, height: 900 }, locale });
    await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); localStorage.setItem('eosin.liveSnd', 'false'); } catch (e) { } }, WN);
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
    await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|open-meteo\.com/, r => r.abort());
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage();
    p.on('pageerror', e => { logs.push(name + ' PAGEERROR: ' + e.message); fails.push(name + ' pageerror ' + e.message); });
    await p.goto('http://127.0.0.1:8768/index.html#home'); await p.waitForTimeout(1600);
    return p;
  };
  const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });
  const onboard = async (p, nick, tap) => {
    const c = p.locator('[data-act="onboard"]:visible').first(); if (tap) await c.tap(); else await c.click(); await p.waitForTimeout(500);
    await p.fill('#pf-nick', nick); const n = (await p.$('#onb-noid')) ? '#onb-noid' : '#onb-go'; if (tap) await p.locator(n).tap(); else await p.click(n); await p.waitForTimeout(1500);
  };
  const give = (p, cs) => p.evaluate(cs => { S.me.catches = (S.me.catches || []).filter(c => !/^j\d/.test(c.id)).concat(cs); location.hash = 'home'; setTimeout(() => { location.hash = 'log'; }, 50); }, cs);
  const toStats = async p => { await p.waitForTimeout(700); await p.click('[data-logtab="stats"]'); await p.waitForTimeout(500); };
  try {
    // ---------- a computer ----------
    const A = await mk('pc', false);
    await onboard(A, '여행하는낚시꾼');
    await give(A, CATCHES); await toStats(A);
    ok(await A.$eval('.jn-card', n => /5마리/.test(n.textContent) && /4곳/.test(n.textContent) && /km/.test(n.textContent) && n.querySelectorAll('circle').length === 5).catch(() => false), '내 조과 statistics: the journey card (5 fish, 4 places, km, a sketch with 5 dots; the refused one and the one with no place left out)');
    ok(!!(await A.$('.page-head [data-jnopen]')), 'the button at the top of 내 조과');
    await shot(A, 'j01_card_pc');
    // the numbers, worked out
    const d = await A.evaluate(Y => { const d = jnData(Y); return { n: d.n, sp: d.sp, places: d.places, km: d.km, noLoc: d.noLoc, news: d.pts.map(p => p.isNew), best: d.pts.map(p => p.isBest), far: d.far && d.far.c.id, big: d.big && d.big.c.id, bigExp: d.pts.slice().sort((a, b) => b.c.len / SPI[b.c.sp].L - a.c.len / SPI[a.c.sp].L)[0].c.id, topRg: d.topRg, all: jnData('all').n, yrs: jnYears() }; }, Y);
    const hv = (a, b) => { const R = 6371, r = Math.PI / 180, h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
    const P = CATCHES.slice(0, 5).map(c => [c.lat, c.lon]); let km = 0; for (let i = 1; i < P.length; i++) km += hv(P[i - 1], P[i]);
    ok(d.n === 5 && d.sp === 3 && d.places === 4 && Math.abs(d.km - km) < 0.5 && d.noLoc === 1, 'the journey: 5 stops, 3 kinds, 4 places (two Busan stops 500 m apart are one), the km between them, one without a place ' + JSON.stringify(d));
    ok(JSON.stringify(d.news) === '[true,false,true,true,false]' && JSON.stringify(d.best) === '[false,true,false,false,false]', 'first of a kind and a new best are marked (a smaller one later is not a best)');
    ok(d.far === 'j5' && d.big === d.bigExp && d.topRg === 'KS' && d.all === 6 && JSON.stringify(d.yrs) === JSON.stringify([Y, Y - 1]), 'the longest flight, the biggest for its kind, where I went most, all years, the years');
    // the player
    await A.click('.jn-card [data-jnopen]');
    ok(await until(() => A.$('.jn .leaflet-container')), 'the player opens on a map');
    ok(await A.$$eval('.jn-years [data-jnyr]', ns => ns.map(n => n.textContent).join('|')).then(s => s === `${Y}|${Y - 1}|전체`), 'year chips: this year, last year, all');
    ok(await until(() => A.evaluate(() => /자리가 없는 조과 1마리/.test(document.body.textContent))), 'it says the catch without a place is left out');
    ok(await until(() => A.evaluate(() => JN.play && JN.i === 0), 3000), 'it starts playing by itself');
    ok(await A.$eval('.jn-pop', n => /감성돔/.test(n.textContent) && /32/.test(n.textContent) && /첫 만남/.test(n.textContent)), 'the first stop: the fish, its size, 「첫 만남」');
    ok(await A.$eval('[data-jnst="n"]', n => n.textContent === '1') && await A.$eval('#jn-step', n => n.textContent === '1 / 5'), 'the numbers start adding up');
    ok(await until(() => A.evaluate(() => JN.i === 1), 4000), 'on to the next stop by itself');
    ok(await A.$eval('.jn-pop', n => /내 최고 기록/.test(n.textContent) && /41.5/.test(n.textContent)), 'a bigger one of the same kind: 「내 최고 기록」');
    ok(await until(() => A.evaluate(() => JN.ly.line.getLatLngs().length === 2), 2500), 'the line grows from the last place to this one');
    await shot(A, 'j02_player_pc');
    await A.click('[data-jnspeed]'); ok(await A.$eval('[data-jnspeed]', n => n.textContent === '2×') && await A.evaluate(() => JN.speed === 2), 'faster: 2×');
    await A.click('[data-jnspeed]'); ok(await A.evaluate(() => JN.speed === 4), 'faster still: 4×');
    ok(await until(() => A.evaluate(() => JN.i === 3), 4000) && await A.$eval('.jn-pop', n => /돌돔/.test(n.textContent) && /제주/.test(n.textContent)), 'Jeju: the fish and the region');
    ok(await until(() => A.evaluate(() => JN.i === 4), 3000) && await A.$eval('.jn-pop', n => /km 날아옴/.test(n.textContent)), 'the longest flight of the year is marked');
    ok(await until(() => A.$eval('.jn-end', n => !n.hidden).catch(() => false), 3000), 'the end of the journey');
    ok(await A.$eval('.jn-end', n => /4곳에서 5마리/.test(n.textContent) && /가장 많이 간 곳/.test(n.textContent) && !!n.querySelector('[data-jnshare]') && !!n.querySelector('[data-jnagain]')), 'the end screen: places, fish, km, where I went most, share and watch again');
    ok(await A.evaluate(() => !JN.play && JN.ly.dots.getLayers().length === 5 && JN.ly.line.getLatLngs().length === 5), 'at the end the whole route shows, every fish a dot');
    await A.waitForTimeout(1100); await shot(A, 'j03_end_pc');
    // drag the bar to a day
    await A.$eval('#jn-range', n => { n.value = 2; n.dispatchEvent(new Event('input', { bubbles: true })); }); await A.waitForTimeout(300);
    ok(await A.evaluate(() => !JN.play && JN.i === 2) && await A.$eval('#jn-step', n => n.textContent === '3 / 5') && await A.$eval('.jn-end', n => n.hidden), 'dragging the bar goes to that stop and stops playing');
    ok(await A.$eval('[data-jnst="places"]', n => n.textContent === '2') && await A.$eval('[data-jnst="sp"]', n => n.textContent === '2'), 'the numbers are those of that day');
    await A.keyboard.press('ArrowRight'); await A.waitForTimeout(200);
    ok(await A.evaluate(() => JN.i === 3), 'the right arrow: the next stop');
    await A.keyboard.press('ArrowLeft'); await A.waitForTimeout(200);
    ok(await A.evaluate(() => JN.i === 2), 'the left arrow: back one');
    await A.focus('.jn-x'); await A.evaluate(() => document.activeElement.blur());
    await A.keyboard.press(' '); await A.waitForTimeout(100);
    ok(await A.evaluate(() => JN.play) && await A.$eval('[data-jnplay]', n => n.getAttribute('aria-pressed') === 'true'), 'space: play');
    await A.keyboard.press(' '); ok(await A.evaluate(() => !JN.play), 'space again: pause');
    // another year
    await A.click(`[data-jnyr="${Y - 1}"]`); await A.waitForTimeout(400);
    ok(await A.evaluate(Y => JN.yr === Y && JN.d.n === 1, Y - 1), 'last year: its one catch');
    ok(await until(() => A.$eval('.jn-pop', n => /농어/.test(n.textContent)).catch(() => false), 3000), 'and it plays it');
    await A.click('[data-jnyr="all"]'); await A.waitForTimeout(300);
    ok(await A.evaluate(() => JN.yr === 'all' && JN.d.n === 6), 'all years: six');
    await A.click(`[data-jnyr="${Y}"]`); await A.waitForTimeout(300);
    // the picture to share: no map, no places, no coordinates
    const pic = await A.evaluate(async () => {
      const said = [], f0 = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { said.push(String(s)); return f0.call(this, s, ...a); };
      try {
        const blob = await jnBlob(JN.d); const url = URL.createObjectURL(blob); const im = new Image(); await new Promise(r => { im.onload = r; im.src = url; });
        const du = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        return { w: im.width, h: im.height, type: blob.type, said, du };
      } finally { CanvasRenderingContext2D.prototype.fillText = f0; }
    });
    fs.writeFileSync(OUT + 'j04b_picture.jpg', Buffer.from(pic.du.split(',')[1], 'base64'));
    ok(pic.w === 1080 && pic.h === 1350 && pic.type === 'image/jpeg', 'the picture: 1080×1350');
    ok(pic.said.includes('5') && pic.said.some(s => /여행하는낚시꾼/.test(s)) && pic.said.some(s => /FISHING JOURNEY/.test(s)), 'it has the count, my name and the year');
    const bad = pic.said.filter(s => /\d+\.\d{2,}/.test(s) || /부산|제주|여수|강릉|남해|동해|KS|KJ|KE/.test(s) || /35\.0|129\.0|33\.2|126\.5/.test(s));
    ok(!bad.length, 'no places and no coordinates are written on it ' + JSON.stringify(bad));
    await A.evaluate(() => jnGo(99, false)); await A.waitForTimeout(200);
    await A.click('.jn-end [data-jnshare]'); await A.waitForTimeout(1500);
    ok(await until(() => A.$('.share-card .sc-img')), 'PC: the share card with the picture and a save button');
    ok(await A.$eval('.share-card', n => /지도와 장소는 들어가지 않아요/.test(n.textContent)), 'the share card says there is no map and no places in it');
    await shot(A, 'j04_share_pc');
    await A.keyboard.press('Escape'); await A.waitForTimeout(300);
    if (await A.$('.jn')) { await A.keyboard.press('Escape'); await A.waitForTimeout(300); }
    ok(!(await A.$('.jn')) && await A.evaluate(() => !document.body.classList.contains('has-modal')), 'Escape closes the player');
    // the top button opens it too
    await A.click('.page-head [data-jnopen]'); ok(await until(() => A.$('.jn .leaflet-container')), 'the button at the top opens the player');
    await A.click('[data-jnclose]'); await A.waitForTimeout(200); ok(!(await A.$('.jn')), 'the close button');

    // ---------- a phone ----------
    const B = await mk('phone', true);
    await onboard(B, '폰여행', true);
    await give(B, CATCHES); await B.waitForTimeout(700); await B.locator('[data-logtab="stats"]').tap(); await B.waitForTimeout(500);
    ok(await B.$eval('.jn-card', n => { const r = n.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.width > 300; }).catch(() => false), 'phone: the card fits the screen');
    await shot(B, 'j05_card_phone');
    await B.locator('.jn-card [data-jnopen]').tap();
    ok(await until(() => B.evaluate(() => JN.i === 1), 6000), 'phone: it plays');
    for (const s of ['[data-jnplay]', '#jn-range', '[data-jnspeed]', '[data-jnshare]', '.jn-x', `[data-jnyr="${Y}"]`]) ok((await reachable(B, s)) === 'ok', 'phone: ' + s + ' can be pressed (' + await reachable(B, s) + ')');
    ok(await B.evaluate(() => { const p = document.querySelector('.jn-p-in').getBoundingClientRect(), bar = document.querySelector('.jn-bar').getBoundingClientRect(), top = document.querySelector('.jn-top').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth && p.bottom < bar.top && p.top > top.bottom - 10; }), 'phone: the stop card sits between the top and the controls');
    ok(await B.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: nothing sticks out sideways');
    await B.waitForTimeout(500); await shot(B, 'j06_player_phone');
    await B.locator('[data-jnplay]').tap(); await B.waitForTimeout(100);
    ok(await B.evaluate(() => !JN.play), 'phone: tap to pause');
    await B.evaluate(() => jnGo(99, false)); await B.waitForTimeout(1200);
    ok(await B.$eval('.jn-end', n => { const r = n.getBoundingClientRect(); return !n.hidden && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), 'phone: the end screen fits');
    await shot(B, 'j07_end_phone');
    await B.locator('.jn-end [data-jnagain]').tap(); await B.waitForTimeout(300);
    ok(await B.evaluate(() => JN.play && JN.i === 0) && await B.$eval('.jn-end', n => n.hidden), 'phone: watch again from the start');
    await B.locator('.jn-x').tap(); await B.waitForTimeout(200); ok(!(await B.$('.jn')), 'phone: closes');

    // ---------- English, and someone with no places ----------
    const E = await mk('en', false, 'en-US');
    await onboard(E, 'Traveller');
    await give(E, CATCHES.slice(0, 3)); await toStats(E);
    ok(await E.$eval('.jn-card', n => /3 fish/.test(n.textContent) && /2 places/.test(n.textContent)).catch(() => false), 'English: the card');
    await E.click('.jn-card [data-jnopen]'); await until(() => E.evaluate(() => JN.i === 0), 3000);
    ok(await E.$eval('.jn', n => /My fishing journey/.test(n.textContent) && /First one/.test(n.textContent) && /km travelled/.test(n.textContent)), 'English: the player');
    await E.click('[data-jnclose]');
    await give(E, CATCHES.slice(5, 6)); await E.waitForTimeout(800);
    ok(!(await E.$('.page-head [data-jnopen]')), 'no places at all: no journey button');
    await E.evaluate(() => jnOpen()); await E.waitForTimeout(300);
    ok(await E.$eval('.jn-empty', n => !n.hidden && /No catches with a place yet/.test(n.textContent)).catch(() => false), 'opened anyway: it says how to get places on it');
    await shot(E, 'j08_empty_en');
    await E.keyboard.press('Escape'); await E.waitForTimeout(200); ok(!(await E.$('.jn')), 'Escape closes the empty one');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  await b.close();
  console.log(logs.join('\n'));
  console.log(fails.length ? `FAILED (${fails.length})` : 'ALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
