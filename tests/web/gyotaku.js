// 어탁 (gyotaku) and 사진으로 길이 재기: on a phone, photo → "is it this fish?" → the register form's "measure in photo"
// (the card, the four dots, "use this length" fills the length), register, then the 어탁 from the done screen (the paper
// over the print, peel it, three inks, the 1080×1350 picture, no coordinates); on a computer the dots dragged with the
// mouse give the right length (card 85.6 mm), the 어탁 from the catch detail and from a live catch, English.
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/gyotaku/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/gyotaku/'; fs.mkdirSync(OUT, { recursive: true });
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const AI_FISH = { fish_visible: true, candidates: [{ id: 'kurodai', p: .81 }, { id: 'mejina', p: .1 }], other_en: '', other_sci: '', length_cm: 41, screening: { real_photo: .94 }, verdict: 'pass', reasons: [], features: '검은 배지느러미' };
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
(async () => {
  const b = await chromium.launch();
  const mk = async (name, phone, locale = 'ko-KR') => {
    const ctx = await b.newContext(phone ? { userAgent: IOS, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale } : { viewport: { width: 1360, height: 900 }, locale });
    await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); } catch (e) { } }, WN);
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
    await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|open-meteo\.com/, r => r.abort());
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', async r => {
      const req = r.request(); const body = JSON.parse(req.postData() || '{}');
      if (/\/review$|\/news$|\/push$/.test(req.url())) return r.fulfill({ contentType: 'application/json', body: '{}' });
      if (body.mode === 'status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ai: true, images: true, provider: 'gemini' }) });
      if (body.mode === 'json') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: '{}', value: AI_FISH, ticket: 'ticket-' + Math.random().toString(36).slice(2) }) });
      return r.fulfill({ contentType: 'application/json', body: '{"text":"ok"}' });
    });
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
  const toForm = async (p, photo, tap) => {
    await p.evaluate(() => { location.hash = 'scan'; }); await p.waitForTimeout(1000);
    await p.setInputFiles('#file-cam', __dirname + '/../fixtures/' + photo); await p.waitForTimeout(3000);
    if (tap) await p.locator('#cf-yes').tap(); else await p.click('#cf-yes'); await p.waitForTimeout(1000);
  };
  // the ink picture: how much of it is inked, and the paper's colour at the corner
  const inkStats = p => p.evaluate(() => { const c = document.querySelector('.gy-cv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, corner = [...g.getImageData(8, 8, 1, 1).data];
    let dark = 0, n = 0; for (let y = 330; y < 800; y += 4) for (let x = 80; x < 1000; x += 4) { const k = (y * c.width + x) * 4, l = (d[k] + d[k + 1] + d[k + 2]) / 3; n++; if (Math.abs(l - (corner[0] + corner[1] + corner[2]) / 3) > 60) dark++; }
    return { w: c.width, h: c.height, inked: dark / n, corner }; });
  try {
    /* 1. the phone: measure in the photo, register, then the 어탁 */
    const A = await mk('A', true);
    await onboard(A, '어탁장인', true);
    await toForm(A, 'IMG_20261027_071500.jpg', true);
    ok(!!(await A.$('#rf-measure')), 'the register form offers "measure in photo"');
    await A.evaluate(() => document.querySelector('#rf-measure').scrollIntoView({ block: 'center' })); await A.waitForTimeout(200);
    ok(await reachable(A, '#rf-measure') === 'ok', 'phone: the measure button can be tapped: ' + await reachable(A, '#rf-measure'));
    await A.locator('#rf-measure').tap(); await A.waitForTimeout(700);
    ok(await A.$eval('.mz', n => /사진으로 길이 재기/.test(n.textContent) && /카드 긴 쪽/.test(n.textContent) && /500원 동전/.test(n.textContent) && /100원 동전/.test(n.textContent) && !/25센트/.test(n.textContent)).catch(() => false), 'the measure screen: the card and the Korean coins (not other countries\')');
    ok(await A.$eval('.mz-ref.on', n => n.dataset.mzref === 'card'), 'the card is picked first');
    ok(await A.evaluate(() => { const c = document.querySelector('.mz-cv'), r = c.getBoundingClientRect(); return r.width >= 360 && r.height >= 300 && r.bottom <= innerHeight; }), 'phone: the photo fills the screen');
    ok(await reachable(A, '[data-mzuse]') === 'ok', 'phone: "use this length" reachable: ' + await reachable(A, '[data-mzuse]'));
    // dots: the card 200 px wide, the fish 500 px long (in the photo's own pixels) → 85.6 × 2.5 = 21.4 cm
    await A.evaluate(() => { MZ.p = [[100, 600], [300, 600], [100, 300], [600, 300]]; mzDraw(); });
    ok(await A.$eval('[data-mzout]', n => n.textContent === '21.4'), 'card 200 px, fish 500 px: 21.4 cm');
    await A.locator('[data-mzref="w500"]').tap(); await A.waitForTimeout(200);
    ok(await A.$eval('[data-mzout]', n => n.textContent === '6.6'), 'the ₩500 coin (26.5 mm): 6.6 cm');
    await A.locator('[data-mzref="own"]').tap(); await A.waitForTimeout(200);
    ok(await A.$eval('.mz-own', n => !n.hidden), 'another thing: its length can be typed');
    await A.fill('[data-mzown]', '15'); await A.waitForTimeout(150);
    ok(await A.$eval('[data-mzout]', n => n.textContent === '37.5'), 'a 15 cm thing: 37.5 cm');
    await shot(A, 'g01_measure_phone');
    await A.locator('[data-mzuse]').tap(); await A.waitForTimeout(600);
    ok(!(await A.$('.mz')), 'the measure screen closes');
    ok(await A.$eval('#rf-len', n => n.value === '37.5'), 'the length is filled in (37.5)');
    await A.evaluate(() => { MZ.ref = 'card'; lsSet('mzRef', 'card'); });
    await A.evaluate(() => { const b = document.querySelector('#rf-go'); b.scrollIntoView({ block: 'center' }); }); await A.waitForTimeout(300);
    await A.locator('#rf-go').tap(); await A.waitForTimeout(2500);
    ok(await until(() => A.$('.done [data-gycatch]'), 4000), 'the done screen offers the 어탁');
    await A.locator('.done [data-gycatch]').tap(); await A.waitForTimeout(400);
    ok(await until(() => A.$eval('.gy', n => /나만의 어탁/.test(n.textContent) && /종이 떼기/.test(n.textContent)).catch(() => false), 3000), 'the 어탁 opens with the paper over it');
    ok(await A.$eval('[data-gysave]', n => n.disabled), 'saving waits until the paper is peeled');
    await shot(A, 'g02_paper_phone');
    ok(await reachable(A, '.gy-paper') === 'ok', 'phone: the paper can be tapped: ' + await reachable(A, '.gy-paper'));
    await A.locator('.gy-paper').tap(); await A.waitForTimeout(1200);
    ok(await until(() => A.$eval('[data-gysave]', n => !n.disabled), 4000), 'peeled: save is ready');
    ok(await A.$eval('.gy-paper', n => n.hidden), 'the paper is gone');
    const s1 = await inkStats(A);
    ok(s1.w === 1080 && s1.h === 1350, 'the 어탁 is 1080×1350');
    ok(s1.inked > .2 && s1.inked < .8, 'the fish is inked on the paper (' + s1.inked.toFixed(2) + ')');
    ok(s1.corner[0] > 200, 'sumi: light paper');
    await A.evaluate(() => document.querySelector('.gy-cv').scrollIntoView({ block: 'start' })); await A.waitForTimeout(200);
    await shot(A, 'g03_gyotaku_phone');
    await A.locator('[data-gyst="gin"]').tap(); await A.waitForTimeout(1200);
    const s2 = await inkStats(A);
    ok(s2.corner[0] < 40 && s2.inked > .2, 'silver ink on the night-sea paper');
    ok(await A.evaluate(() => lsGet('gyStyle', '') === 'gin'), 'the ink choice is kept on this device');
    await shot(A, 'g04_gyotaku_gin_phone');
    ok(await A.evaluate(() => { const o = GY.o; return o.sp === 'kurodai' && o.cm === 37.5 && o.nick === '어탁장인' && !('lat' in o) && !('lon' in o); }), 'what the 어탁 holds: the fish, the length, the name — no coordinates');
    await A.locator('[data-gyagain]').tap(); await A.waitForTimeout(600);
    ok(await A.$eval('.gy-paper', n => !n.hidden) && await A.$eval('[data-gysave]', n => n.disabled), '"print again" lays the paper back');
    await A.locator('.gy-paper').tap(); await A.waitForTimeout(1300);
    await A.locator('[data-gysave]').tap(); await A.waitForTimeout(1200);
    ok(await until(() => A.$eval('.share-card .sc-img', n => n.naturalWidth === 1080 && n.naturalHeight === 1350).catch(() => false), 4000), 'save: the picture to keep (1080×1350)');
    ok(await A.$eval('.share-card', n => /정확한 자리는 들어가지 않아요/.test(n.textContent)), 'the share card says no spot is included');

    /* 2. a computer: dragging the dots with the mouse, the detail screen, a live catch, the keyboard, English */
    const B = await mk('B', false);
    await onboard(B, '마우스조사');
    // a test photo 800×600 with a card and a fish
    await B.evaluate(() => new Promise(res => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#556'; g.fillRect(0, 0, 800, 600); g.fillStyle = '#eee'; g.fillRect(100, 480, 200, 60); g.fillStyle = '#9ab'; g.beginPath(); g.ellipse(400, 260, 300, 70, 0, 0, 7); g.fill(); const im = new Image(); im.onload = () => { window._tim = im; res(); }; im.src = c.toDataURL(); }));
    await B.evaluate(() => { window._got = null; mzOpen(window._tim, cm => { window._got = cm; }); }); await B.waitForTimeout(500);
    const toScr = (x, y) => B.evaluate(([x, y]) => { const c = document.querySelector('.mz-cv').getBoundingClientRect(), f = MZ.fit; return [c.left + f.ox + x * f.s, c.top + f.oy + y * f.s]; }, [x, y]);
    const drag = async (from, to) => { const a = await toScr(...from), z = await toScr(...to); await B.mouse.move(a[0], a[1]); await B.mouse.down(); await B.mouse.move((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, { steps: 4 }); await B.mouse.move(z[0], z[1], { steps: 4 }); return z; };
    const start = await B.evaluate(() => MZ.p.map(p => p.slice()));
    await drag(start[0], [100, 510]);
    ok(await B.$eval('.mz-loupe', n => !n.hidden), 'while a dot is dragged, the loupe shows what is under it');
    await shot(B, 'g05_measure_loupe_pc');
    await B.mouse.up();
    ok(await B.$eval('.mz-loupe', n => n.hidden), 'the loupe goes away on letting go');
    await drag(start[1], [300, 510]); await B.mouse.up();
    await drag(start[2], [100, 260]); await B.mouse.up();
    await drag(start[3], [700, 260]); await B.mouse.up(); await B.waitForTimeout(200);
    const v = await B.$eval('[data-mzout]', n => +n.textContent);
    ok(Math.abs(v - 25.7) <= .3, 'dragged: card 200 px, fish 600 px → about 25.7 cm (' + v + ')');
    await shot(B, 'g06_measure_pc');
    // the keyboard: pick the fish's tail (4) and move it with the arrows
    await B.focus('[data-mzref="card"]'); await B.keyboard.press('4'); for (let i = 0; i < 5; i++) await B.keyboard.press('Shift+ArrowLeft');
    ok(await B.$eval('[data-mzout]', n => +n.textContent) < v, 'the arrow keys move a dot too');
    await B.click('[data-mzuse]'); await B.waitForTimeout(300);
    ok(await B.evaluate(() => window._got > 20 && window._got < 26 && !document.querySelector('.mz')), '"use this length" hands the length back');
    await B.evaluate(() => { window._got = null; mzOpen(window._tim, cm => { window._got = cm; }); MZ.p = [[100, 100], [100, 101], [0, 0], [10, 10]]; mzDraw(); }); await B.waitForTimeout(200);
    await B.click('[data-mzuse]'); await B.waitForTimeout(300);
    ok(await B.evaluate(() => window._got === null && !!document.querySelector('.mz')), 'dots on top of each other: asks to place them again');
    await B.keyboard.press('Escape'); await B.waitForTimeout(200);
    ok(!(await B.$('.mz')), 'Escape closes the measure screen');
    // the catch detail
    await toForm(B, 'IMG_20261020_063000.jpg');
    await B.fill('#rf-len', '44.2'); await B.click('#rf-go'); await B.waitForTimeout(2500);
    const cid = await B.evaluate(() => S.me.catches[S.me.catches.length - 1].id);
    await B.evaluate(id => openCatch(S.uid, id), cid); await B.waitForTimeout(600);
    ok(!!(await B.$('.cd [data-gycatch]')), 'the catch detail offers the 어탁');
    await B.click('.cd [data-gycatch]'); await B.waitForTimeout(1800);
    ok(await B.evaluate(() => GY.o && GY.o.cm === 44.2), 'from the detail: the registered length');
    await B.click('.gy-paper'); await B.waitForTimeout(1300);
    await B.click('[data-gyst="sumi"]'); await B.waitForTimeout(1200);
    await shot(B, 'g07_gyotaku_pc');
    await B.keyboard.press('Escape'); await B.waitForTimeout(400); await B.keyboard.press('Escape'); await B.waitForTimeout(400);
    // a live catch's result card (the website's game): its own 어탁 button
    await B.evaluate(() => { LV.res = { sp: 'madai', cm: 52.4, _at: Date.now(), _to: { lng: 129.1, lat: 35.1, kind: 'sea' } }; lvSub('gy'); }); await B.waitForTimeout(1600);
    ok(await B.evaluate(() => GY.o && GY.o.sp === 'madai' && GY.o.cm === 52.4 && !/\d+\.\d{3}/.test(GY.o.where || '')), 'a live catch: its 어탁 (the sea name, not the spot)');
    await B.keyboard.press('Escape'); await B.waitForTimeout(400);
    // English
    await B.evaluate(() => setLang('en')); await B.waitForTimeout(1500);
    await B.evaluate(id => openCatch(S.uid, id), cid); await B.waitForTimeout(600);
    await B.click('.cd [data-gycatch]'); await B.waitForTimeout(1500);
    ok(await B.$eval('.gy', n => /Your gyotaku/.test(n.textContent) && /Peel the paper/.test(n.textContent) && /Sumi black/.test(n.textContent)).catch(() => false), 'English: the 어탁 screen');
    await B.click('.gy-paper'); await B.waitForTimeout(1300);
    await shot(B, 'g08_gyotaku_en');
  } catch (e) { logs.push('CRASH ' + (e && e.stack || e)); fails.push('crash'); }
  await b.close();
  console.log(logs.join('\n'));
  console.log(fails.length ? `\nFAILED (${fails.length})` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
