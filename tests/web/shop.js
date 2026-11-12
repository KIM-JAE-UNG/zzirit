// 찌릿 포인트 and the 찌릿 루어 shop: the wallet, last week's prizes arriving (a celebration once), buying and equipping a
// lure (the price comes off on the server, the lure hangs on the character's line and in the park), the operator giving
// points, the optional bank transfer in the payment window, a phone, and a server without the update.
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/shop/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/shop/'; fs.mkdirSync(OUT, { recursive: true });
const SRV = 'http://127.0.0.1:8768', BASE = SRV + '/index.html';
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = async () => (await fetch(SRV + '/__sb/dump')).json();
const post = (path, body) => fetch(SRV + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json());
async function until(fn, ms = 6000, step = 80) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); } catch (e) { v = null; } if (v) return v; await sleep(step); } return v; }
(async () => {
  const b = await chromium.launch();
  try {
    const mk = async (name, opts = {}) => {
      const touch = !!opts.isMobile;
      const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 860 }, locale: 'ko-KR' }, opts));
      // headless Chromium keeps reporting a mouse; a phone has none (the payment window shows phone links then)
      if (touch) await ctx.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /hover: hover|pointer: fine/.test(q) ? { matches: false, media: q, onchange: null, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }, dispatchEvent() { return false; } } : mm(q); });
      await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); } catch (e) { } }, WN);
      await ctx.addInitScript(() => { window.LIVE_TILES = { tiles: '/tests/fixtures/tiles/{z}/{x}/{y}.pbf', glyphs: '', minzoom: 10 }; });
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
    const shot = (p, n, full) => p.screenshot({ path: OUT + n + '.png', fullPage: !!full });
    const closeModals = async p => { for (let i = 0; i < 4; i++) { const xs = await p.$$('.modal-wrap.in .modal-x'); if (!xs.length) break; await xs[xs.length - 1].click(); await p.waitForTimeout(320); } };
    const toasts = p => p.$$eval('.toast', ns => ns.map(n => n.textContent).join(' | '));

    /* ---------- a new angler: an empty wallet, the shop ---------- */
    const A = await mk('A'); await onboard(A, '루어왕');
    const B = await mk('B'); await onboard(B, '은메달');
    const aId = await A.evaluate(() => S.uid), bId = await B.evaluate(() => S.uid);
    await go(A, 'lures', 1400);
    ok(/0\s*P/.test(await A.$eval('.zl-hero .zp-wallet', n => n.textContent)) && await A.$eval('.zl-hero .zp-wallet', n => n.getAttribute('href')) === '#live', 'shop: my wallet, 0P, and the way to earn (the live sea)');
    const cards = await A.$$eval('.zl-card', ns => ns.map(n => n.dataset.zl + ':' + n.querySelector('.zl-tag').textContent.trim()));
    ok(cards.length === 8 && cards[0] === 'jighead:보유' && cards.includes('minnow:1,000P') && cards.includes('jig:800P') && cards.includes('gold:1등 상품'), 'shop: eight lures, the starter one owned, prices, the prize lure — ' + JSON.stringify(cards));
    ok(JSON.stringify(await A.$$eval('.zl-card.sig', ns => ns.map(n => n.dataset.zl))) === '["jig","minnow","gold"]', 'shop: the mark only on the signature lures (and the gold prize)');
    for (const [k, ids] of [['rod', ['rod_basic', 'rod_iso', 'rod_wine', 'rod_spark', 'rod_bolt']], ['reel', ['reel_basic', 'reel_red', 'reel_lbr', 'reel_spark', 'reel_bolt']], ['float', ['float_basic', 'float_ball', 'float_led', 'float_spark', 'float_bolt']]]) {
      await A.click(`[data-zltab="${k}"]`); await A.waitForTimeout(500);
      const got = await A.$$eval('.zl-card', ns => ns.map(n => n.dataset.zl + (n.classList.contains('sig') ? '*' : '')));
      ok(JSON.stringify(got) === JSON.stringify(ids.map((x, i) => x + (i >= 3 ? '*' : ''))), `shop: the ${k} section, two signature pieces — ` + JSON.stringify(got));
      ok(await A.$$eval('.zl-card img', ns => ns.every(n => n.complete && n.naturalWidth > 0)), `shop: every ${k} picture draws`);
      await shot(A, 's01_shop_' + k, true);
    }
    await A.click('[data-zltab="lure"]'); await A.waitForTimeout(400);
    ok(await A.$$eval('.zl-card img', ns => ns.every(n => n.complete && n.naturalWidth > 0)), 'shop: every lure picture draws');
    await shot(A, 's01_shop', true);
    ok(await A.evaluate(() => !!document.querySelector('.nav a[data-route="lures"]')), 'the shop is in the menu');

    /* ---------- last week's prizes arrive: once, with a celebration ---------- */
    await post('/__sb/live_seed', { weeksAgo: 1, rows: [{ acct: aId, score: 231 }, { acct: aId, score: 180 }, { acct: bId, score: 260 }, { acct: 'ffffffff-0000-0000-0000-000000000001', score: 190 }, { acct: 'ffffffff-0000-0000-0000-000000000002', score: 100 }] });
    await A.reload(); await A.waitForTimeout(1500); await go(A, 'lures', 1200);
    const win = await until(() => A.$('.zp-win'), 8000);
    ok(!!win && /지난주 1등/.test(await A.$eval('.zp-win', n => n.textContent)) && /\+300P/.test(await A.$eval('.zp-win-sum', n => n.textContent)), 'prize: a celebration for last week\'s first place (+300P)');
    ok(!!(await A.$('.zp-win-art.gold img')), 'prize: the gold lure in it');
    await shot(A, 's02_prize');
    await closeModals(A);
    let d = await dump();
    ok(d.ZPS.wal[aId].bal === 300 && d.ZPS.wal[bId].bal === 200 && (d.ZPS.owned[aId] || []).includes('gold'), 'prize: 300P and the gold lure for 1st, 200P for 2nd');
    ok(d.ZPS.wal['ffffffff-0000-0000-0000-000000000001'].bal === 100 && !d.ZPS.wal['ffffffff-0000-0000-0000-000000000002'], 'prize: 100P for 3rd, nothing for 4th');
    await A.reload(); await A.waitForTimeout(2500); await go(A, 'lures', 1200);
    ok(!(await A.$('.zp-win')), 'prize: celebrated only once');
    ok(/300/.test(await A.$eval('.zl-hero .zp-bal', n => n.textContent)), 'shop: the wallet shows 300P');
    ok((await A.$eval('[data-zl="gold"] .zl-tag', n => n.textContent)).includes('보유'), 'shop: the gold lure is mine');
    await go(B, 'live', 3000); await B.evaluate(() => lvBook('wk')); await B.waitForTimeout(900);
    ok(/지난주/.test(await B.$eval('.lv-blast', n => n.textContent)) && /루어왕/.test(await B.$eval('.lv-blast', n => n.textContent)) && /은메달/.test(await B.$eval('.lv-blast', n => n.textContent)), 'live book: last week\'s first three');
    await shot(B, 's03_live_last_week');
    await closeModals(B);

    /* ---------- buying and equipping ---------- */
    await A.click('[data-zl="tai"]'); await A.waitForTimeout(500);
    ok(!!(await A.$('.zl-detail .zl-stage img')) && /참돔/.test(await A.$eval('.zl-perk', n => n.textContent)), 'lure page: the picture, what it does at the rocks');
    await shot(A, 's04_lure_detail');
    await A.click('[data-zla="buy"]'); await A.waitForTimeout(250);
    ok(/한 번 더/.test(await A.$eval('[data-zla="buy"]', n => n.textContent)), 'buy: asks for a second tap');
    d = await dump(); ok(d.ZPS.wal[aId].bal === 300, 'buy: nothing spent on the first tap');
    await A.click('[data-zla="buy"]');
    ok(!!(await until(() => A.$('.zl-stage.fresh'), 4000)), 'buy: done, the lure pops in');
    ok(/샀어요/.test(await toasts(A)), 'buy: told so');
    d = await dump(); ok(d.ZPS.wal[aId].bal === 0 && d.ZPS.owned[aId].includes('tai') && d.ZPS.led.some(x => x.acct === aId && x.r === 'buy' && x.d === -300), 'buy: 300P came off on the server, the lure is owned, the book has it');
    await shot(A, 's05_bought');
    await A.click('[data-zla="equip"]'); await A.waitForTimeout(900);
    d = await dump(); ok(d.T.anglers[aId].data.lure === 'tai', 'equip: saved to the profile');
    ok(!!(await A.$('[data-zla="off"]')), 'equip: shown as equipped');
    await closeModals(A); await A.waitForTimeout(500);
    ok(await A.$eval('[data-zl="tai"]', n => n.classList.contains('on')), 'shop: the card says equipped');
    await A.click('[data-zl="minnow"]'); await A.waitForTimeout(500);
    ok(await A.$eval('.zl-act .btn', n => n.disabled) && /1,000P 더/.test(await A.$eval('.zl-act', n => n.textContent)), 'not enough points: the button waits, and says how many more');
    await closeModals(A);
    const book = await A.$$eval('.zp-led li', ns => ns.map(n => n.textContent));
    ok(book.length === 2 && /구매/.test(book[0]) && /-300P/.test(book[0]) && /1등/.test(book[1]) && /\+300P/.test(book[1]), 'the book: the prize and the purchase — ' + JSON.stringify(book));
    const forged = await A.evaluate(async () => { try { await APP_AUTH.zp.buy('minnow'); return 'bought'; } catch (e) { return e.code; } });
    ok(forged === 'not_enough', 'the server refuses a purchase without the points, whatever the page does');
    // the lure on the line: the character picture and someone else's view of me
    ok(await A.evaluate(() => { const c = charOf(S.me, S.uid); return c.lu === 'tai' && CH.svg(c, 'full').includes('chtaih'); }), 'character: the lure hangs on the line');
    await go(B, 'home', 300); await go(B, 'rank', 900);
    ok(await B.evaluate(u => charOf(S.anglers.get(u), u).lu === 'tai', aId), 'others see the lure on my line');
    await go(A, 'char', 1200); await shot(A, 's06_char_lure');

    /* ---------- the live sea: the lure helps there ---------- */
    ok(await A.evaluate(() => { const P = ZL.perk(ZL.KINDS.map(myGear)); return P.x === 3 && P.sp.includes('madai'); }), 'live: the lure\'s help is on the line');
    const tally = await A.evaluate(() => { let m = 0, m0 = 0; const lure = S.me.lure; for (let i = 0; i < 400; i++) { if (lvPick(3, 1000 + i, 'sea', 129.1, 35.1) === 'madai') m++; } S.me.lure = ''; for (let i = 0; i < 400; i++) { if (lvPick(3, 1000 + i, 'sea', 129.1, 35.1) === 'madai') m0++; } S.me.lure = lure; return { m, m0 }; });
    ok(tally.m > tally.m0, 'live: red sea bream come more often with it — ' + JSON.stringify(tally));


    /* ---------- the operator gives points ---------- */
    const OP = await mk('OP'); await onboard(OP, '운영자');
    await go(OP, 'claim', 600); await OP.fill('#cl-code', 'testcode1234abcd'); await OP.click('#cl-go'); await OP.waitForTimeout(2400); await closeModals(OP);
    ok(await OP.evaluate(() => S.isOwner), 'operator signed in');
    await go(OP, 'admin', 1400);
    ok(!!(await OP.$('#ad-zp')), 'admin: a form to give points');
    await OP.selectOption('#ad-zp-who', aId); await OP.fill('#ad-zp-amt', '1500'); await OP.fill('#ad-zp-note', '사진 이벤트 1등');
    await OP.click('#ad-zp button[type="submit"]'); await OP.waitForTimeout(800);
    ok(/1,500P/.test(await toasts(OP)), 'admin: told the new balance');
    d = await dump(); ok(d.ZPS.wal[aId].bal === 1500, 'admin: 1,500P on the server');
    const nope = await A.evaluate(async u => { try { await APP_AUTH.zp.grant(u, 99999, 'me'); return 'given'; } catch (e) { return e.code; } }, aId);
    ok(nope === 'not_admin', 'only the operator gives points');
    await go(A, 'home', 300); await A.evaluate(() => zpLoad(true)); await go(A, 'lures', 1400);
    const gift = await until(() => A.$eval('.zp-win', n => n.textContent).catch(() => ''), 5000);
    ok(/받았어요/.test(gift || '') && /사진 이벤트 1등/.test(gift || '') && /\+1,500P/.test(gift || ''), 'a gift from the operator: told once, with the note');
    await closeModals(A);
    await A.click('[data-zl="minnow"]'); await A.waitForTimeout(500);
    await A.click('[data-zla="buy"]'); await A.waitForTimeout(250); await A.click('[data-zla="buy"]');
    ok(!!(await until(() => A.$('[data-zla="equip"]'), 4000)), 'with the gift, the signature minnow can be bought');
    await closeModals(A); await A.waitForTimeout(400);
    // a reel and a float from the other sections, equipped: the reel on the character, the float in the fishing game
    for (const [k, id] of [['reel', 'reel_lbr'], ['float', 'float_ball']]) {
      await A.click(`[data-zltab="${k}"]`); await A.waitForTimeout(400);
      await A.click(`[data-zl="${id}"]`); await A.waitForTimeout(400);
      await A.click('[data-zla="buy"]'); await A.waitForTimeout(250); await A.click('[data-zla="buy"]');
      await until(() => A.$('[data-zla="equip"]'), 4000); await A.click('[data-zla="equip"]'); await A.waitForTimeout(700);
      await closeModals(A); await A.waitForTimeout(300);
    }
    d = await dump();
    ok(d.ZPS.wal[aId].bal === 150 && d.T.anglers[aId].data.reel === 'reel_lbr' && d.T.anglers[aId].data.float === 'float_ball', 'reel and float bought (1,500 − 1,000 − 250 − 100) and equipped');
    ok(await A.evaluate(() => { const c = charOf(S.me, S.uid); return c.re === 'reel_lbr' && CH.svg(c, 'full').includes('#C9A13A'); }), 'character: the gold LB reel on the rod');
    ok(await A.evaluate(() => { const P = ZL.perk(ZL.KINDS.map(myGear)); return lvFloat() === 'float_ball' && P.win >= .1 && P.reel > 1.1 && lvReach() === 60; }), 'live: the ball float on the water, the reel and float help together, the basic rod casts 60 m');
    
    await go(A, 'lures', 900); await A.click('[data-zltab="lure"]'); await A.waitForTimeout(300);
    ok(/사진 이벤트 1등/.test(await A.$eval('.zp-book', n => n.textContent)), 'the book shows the operator\'s note');

    /* ---------- a bank transfer in the payment window (only when the operator turns it on) ---------- */
    await go(A, 'home', 600); await A.click('[data-act="donate"]:visible'); await A.waitForTimeout(600);
    ok(!(await A.$('.pay-bank')), 'payment: no bank account unless the operator turns it on');
    await closeModals(A);
    await go(OP, 'admin', 1000);
    await OP.fill('#ad-bank-name', '신한'); await OP.fill('#ad-bank-no', '110-000-000000'); await OP.fill('#ad-bank-holder', '테스트');
    await OP.click('label.switch:has(#ad-bank-on) .sw'); await OP.click('#ad-save'); await OP.waitForTimeout(900);
    d = await dump(); ok(d.T.admin_docs.config.data.bankOn === true && d.T.admin_docs.config.data.bankNo === '110000000000', 'admin: the account saved (digits only)');
    await A.waitForTimeout(800); await A.click('[data-act="donate"]:visible'); await A.waitForTimeout(700);
    const bank = await A.$eval('.pay-bank', n => n.textContent).catch(() => '');
    ok(/신한은행/.test(bank) && /110000000000/.test(bank) && /테스트/.test(bank) && !!(await A.$('.pay-bank [data-copy="110000000000"]')), 'payment: the account with a copy button — ' + bank.replace(/\s+/g, ' ').slice(0, 90));
    await shot(A, 's08_pay_bank'); await closeModals(A);

    /* ---------- a phone ---------- */
    const P = await mk('P', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await onboard(P, '폰루어'); await go(P, 'lures', 1600);
    ok(await P.evaluate(() => document.documentElement.scrollWidth <= 391), 'phone: the shop fits the width');
    await shot(P, 's09_phone_shop', true);
    await P.$eval('[data-zl="minnow"]', n => n.scrollIntoView({ block: 'center' })); await P.waitForTimeout(200);
    await P.tap('[data-zl="minnow"]'); await P.waitForTimeout(600); await shot(P, 's10_phone_lure');
    ok(await P.$eval('.zl-detail', n => n.getBoundingClientRect().width <= 390), 'phone: the lure page fits');
    await closeModals(P);
    await P.evaluate(() => openDonate()); await P.waitForTimeout(700);
    const toss = await P.$eval('.pay-bank a.btn-toss', n => n.getAttribute('href')).catch(() => '');
    ok(/^supertoss:\/\/send\?amount=\d+&bank=%EC%8B%A0%ED%95%9C%EC%9D%80%ED%96%89&accountNo=110000000000/.test(toss), 'phone payment: Toss opens with the bank, account and amount filled in — ' + toss);
    await shot(P, 's11_phone_pay'); await closeModals(P);
    await go(P, 'home', 1200); await shot(P, 's12_phone_home', true);
    ok(await P.evaluate(() => document.documentElement.scrollWidth <= 391) && !!(await P.$('.lt')), 'phone: the home page with the door to the live sea fits the width');

    /* ---------- a server without the update: nothing breaks ---------- */
    await fetch(SRV + '/__sb/feature?zp=0'); await fetch(SRV + '/__sb/feature?live=0');
    const Q = await mk('Q'); await onboard(Q, '옛서버'); await go(Q, 'lures', 1600);
    ok((await Q.$$('.zl-card')).length === 8, 'old server: the shop still shows the lures');
    await go(Q, 'live', 3500);
    ok(!!(await until(() => Q.$('#lv-cover [data-lv="retry"]'), 20000)) && /서버를 준비/.test(await Q.$eval('#lv-cover', n => n.textContent)), 'old server: the live sea says the server is being updated');
    await fetch(SRV + '/__sb/feature?live=1');
    await Q.click('[data-lv="retry"]');
    ok(!!(await until(() => Q.$('#lv-cover [data-lv="go-geo"]'), 8000)), 'and "try again" opens it once the server is ready');
    await fetch(SRV + '/__sb/feature?zp=1');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  console.log(logs.join('\n'));
  console.log(`\n${fails.length ? 'FAILED: ' + fails.length : 'ALL PASSED'}`);
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
