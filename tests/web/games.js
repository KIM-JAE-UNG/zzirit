// Mini games: today's fish fortune (home strip, draw, the same fish all day, saved) and the strike reaction test
// (false strikes, five rounds, the record and the ranking), and the stalls for them in the park.
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/games/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/games/'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8768/index.html';
// the update notes this build would show: marked as seen, so no dialog gets in the way (whatever the current id is)
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = async () => (await fetch('http://127.0.0.1:8768/__sb/dump')).json();
async function until(fn, ms = 6000, step = 60) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); } catch (e) { v = null; } if (v) return v; await sleep(step); } return v; }
(async () => {
  const b = await chromium.launch();
  try {
    const mk = async (name, opts = {}) => {
      const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 860 }, locale: 'ko-KR' }, opts));
      await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); } catch (e) { } }, WN);
      await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
      await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
      await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
      await ctx.route(/fonts\.(googleapis|gstatic)\.com|open-meteo\.com/, r => r.abort());
      await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      const p = await ctx.newPage();
      p.on('pageerror', e => { logs.push(name + ' PAGEERROR: ' + e.message); fails.push(name + ' pageerror ' + e.message); });
      await p.goto(BASE + '#home'); await p.waitForTimeout(1400);
      return p;
    };
    const go = async (p, h, w = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w); };
    const onboard = async (p, nick) => { await go(p, 'home'); await p.click('[data-act="onboard"]:visible'); await p.waitForTimeout(400); await p.fill('#pf-nick', nick); await p.selectOption('#pf-home', 'KS'); if (await p.$('#onb-noid')) await p.click('#onb-noid'); else await p.click('#onb-go'); await p.waitForTimeout(1500); };
    const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });
    const closeModals = async p => { for (let i = 0; i < 4; i++) { const xs = await p.$$('.modal-wrap.in .modal-x'); if (!xs.length) break; await xs[xs.length - 1].click(); await p.waitForTimeout(320); } };

    const A = await mk('A'); await onboard(A, '운세왕'); await go(A, 'home', 1000);
    const aId = await A.evaluate(() => S.uid);
    /* fortune */
    ok(!!(await A.$('.fo-strip:not(.done)')), 'home: a line to draw today\'s fish fortune');
    await A.click('.fo-strip'); await A.waitForTimeout(400);
    ok(!!(await A.$('#fo-deck')) && !!(await A.$('#fo-draw')), 'fortune: a card face down and a draw button');
    await shot(A, 'g01_fortune_back');
    await A.click('#fo-draw'); await A.waitForTimeout(1100);
    const f1 = await A.evaluate(() => ({ name: document.querySelector('.fo-name') && document.querySelector('.fo-name').textContent, stars: document.querySelector('.fo-stars') && document.querySelector('.fo-stars').textContent, lucky: document.querySelectorAll('.fo-lucky div').length, msg: document.querySelector('.fo-msg') && document.querySelector('.fo-msg').textContent }));
    ok(!!f1.name && /^[★☆]{5}$/.test(f1.stars) && f1.lucky >= 2 && f1.msg.length > 4, 'fortune: a fish, stars, a message and lucky things — ' + JSON.stringify(f1));
    await shot(A, 'g02_fortune');
    await closeModals(A); await A.waitForTimeout(600);
    ok(!!(await until(() => A.$('.fo-strip.done'))), 'home: today\'s fish shows after the draw');
    ok(await A.$eval('.fo-strip.done', (n, nm) => n.textContent.includes(nm), f1.name), 'home: the same fish on the home line');
    await A.click('.fo-strip'); await A.waitForTimeout(400);
    ok(!(await A.$('#fo-draw')) && await A.$eval('.fo-name', (n, nm) => n.textContent === nm, f1.name), 'fortune: drawn already — no second draw, the same fish all day');
    await closeModals(A);
    const det = await A.evaluate(u => { const a = fortuneOf(u, '2026-11-06'), b = fortuneOf(u, '2026-11-06'); const days = new Set(); for (let i = 1; i <= 12; i++) days.add(fortuneOf(u, '2026-11-' + String(i).padStart(2, '0')).sp); return { same: JSON.stringify(a) === JSON.stringify(b), kinds: days.size }; }, aId);
    ok(det.same && det.kinds >= 3, 'fortune: fixed for a person and a day, different over days — ' + JSON.stringify(det));
    let d = await dump();
    ok(d.T.anglers[aId].data.games && d.T.anglers[aId].data.games.fo === await A.evaluate(() => kstDay()), 'fortune: the draw is saved to the profile');
    /* strike reaction */
    await go(A, 'games', 900);
    ok(!!(await A.$('.gm-fo')) && !!(await A.$('.gm-rx')) && !!(await A.$('.gm-park')), 'games page: fortune, reaction and the park');
    await shot(A, 'g03_games');
    await A.click('.gm-rx [data-act="reaction"]'); await A.waitForTimeout(400);
    await A.click('#rx-go'); await A.waitForTimeout(150);
    await until(() => A.evaluate(() => RX.cur.st === 'wait'), 2000);
    await A.click('#rx-stage'); await A.waitForTimeout(200);
    ok(await A.evaluate(() => RX.cur.st === 'foul' && RX.cur.fouls === 1), 'reaction: tapping before the dive is a false strike');
    ok(/헛챔질/.test(await A.$eval('#rx-msg', n => n.textContent)), 'reaction: told so');
    await shot(A, 'g04_foul');
    for (let i = 0; i < 5; i++) {
      const sank = await until(() => A.evaluate(() => RX.cur.st === 'sink'), 8000, 20);
      if (!sank) { ok(false, 'reaction: round ' + (i + 1) + ' never dived'); break; }
      if (i === 0) await shot(A, 'g05_dive');
      await sleep(220 + i * 30); await A.click('#rx-stage');
      await until(() => A.evaluate(n => RX.cur.times.length === n, i + 1), 2000, 20);
    }
    const res = await until(() => A.evaluate(() => RX.cur.st === 'done' && { times: RX.cur.times, g: gmGet() }), 4000);
    ok(!!res && res.times.length === 5 && res.times.every(v => v >= 100 && v < 1500), 'reaction: five rounds measured — ' + JSON.stringify(res && res.times));
    ok(!!res && res.g.rtAvg > 0 && res.g.rt > 0 && res.g.rt <= res.g.rtAvg, 'reaction: average and best saved');
    ok(!!(await A.$('.rx-grade')) && /ms/.test(await A.$eval('.rx-sum', n => n.textContent)), 'reaction: a grade and the times shown');
    const wk = await until(() => A.$eval('.rx-wk.ok', n => n.textContent).catch(() => ''), 5000);
    ok(/이번 주 1위/.test(wk || ''), 'reaction: the run went on this week\'s board (started and checked on the server) — ' + wk);
    await shot(A, 'g06_result');
    await closeModals(A); await A.waitForTimeout(500);
    d = await dump();
    ok(d.T.anglers[aId].data.games.rtAvg === res.g.rtAvg, 'reaction: the record is on the profile (server)');
    ok(d.ZPS && Object.values(d.ZPS.scores).some(x => x.acct === aId && x.score === Math.round(res.times.reduce((a, b) => a + b, 0) / 5)), 'reaction: the server keeps the run with the same average');
    const B = await mk('B'); await onboard(B, '번개손');
    await B.evaluate(() => gmSave({ rtAvg: 205, rt: 180 })); await B.waitForTimeout(800); // a record typed into the profile, no real run
    await go(A, 'home', 300); await go(A, 'games', 1200);
    let rk = await A.$$eval('.rx-week .rk-list li', ns => ns.map(n => n.textContent));
    ok(rk.length === 1 && /운세왕/.test(rk[0]) && /\+300P/.test(rk[0]), 'weekly board: only real runs count (a record written into a profile does not) — ' + JSON.stringify(rk));
    ok(!!(await A.$('.zp-prizes .p1')) && /300P/.test(await A.$eval('.zp-prizes', n => n.textContent)), 'weekly board: the prizes are listed');
    ok(/이번 주 1위/.test(await A.$eval('.gm-week', n => n.textContent)), 'games page: my place this week on the reaction card');
    // a forged run straight to the server: refused
    const forged = await B.evaluate(async () => { const tok = await APP_AUTH.zp.rxBegin(); return APP_AUTH.zp.rxSubmit(tok, [150, 150, 150, 150, 150]); });
    ok(forged && forged.err === 'too_fast', 'weekly board: a run sent without playing is refused — ' + JSON.stringify(forged));
    /* the park stalls */
    await go(A, 'park', 1800);
    await A.evaluate(() => pkWalk(1235, 935));
    ok(!!(await until(() => A.$('#pk-act [data-prop="luck"]'), 6000)), 'park: by the fortune stall, a button for it');
    await A.click('#pk-act [data-prop="luck"]'); await A.waitForTimeout(500);
    ok(!!(await A.$('.fo-card')), 'park: the stall opens today\'s fortune');
    await closeModals(A);
    await A.evaluate(() => pkWalk(440, 935));
    ok(!!(await until(() => A.$('#pk-act [data-prop="react"]'), 8000)), 'park: by the practice frame, a button for the reaction test');
    await shot(A, 'g07_park_stall');
    /* a phone */
    const P = await mk('P', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await onboard(P, '폰운세'); await go(P, 'home', 900);
    await P.click('.fo-strip'); await P.waitForTimeout(300); await P.click('#fo-draw'); await P.waitForTimeout(1100);
    await shot(P, 'g08_phone_fortune');
    ok(await P.$eval('.fo-card', n => n.getBoundingClientRect().width <= 390), 'phone: the fortune card fits');
    await closeModals(P); await go(P, 'games', 900); await shot(P, 'g09_phone_games');
    await P.click('.gm-rx [data-act="reaction"]'); await P.waitForTimeout(300); await P.tap('#rx-go');
    const sank = await until(() => P.evaluate(() => RX.cur.st === 'sink'), 8000, 20);
    if (sank) { await sleep(260); await P.tap('#rx-stage'); }
    ok(!!(await until(() => P.evaluate(() => RX.cur.times.length === 1), 2000)), 'phone: a tap counts');
    await shot(P, 'g10_phone_reaction');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  console.log(logs.join('\n'));
  console.log(`\n${fails.length ? 'FAILED: ' + fails.length : 'ALL PASSED'}`);
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
