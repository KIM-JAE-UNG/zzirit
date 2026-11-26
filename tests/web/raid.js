// 전설의 괴어 레이드 and 나의 낚시 결산: the raid card on the home page, the raid screen (strike on the ring, the monster
// growing for a second angler, everyone's strikes live, the win with points, a story-sized picture), the time between
// raids, and the year-in-review story (counts only this year, moves on by itself, taps, the share picture, empty, phone).
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/raid/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/raid/'; fs.mkdirSync(OUT, { recursive: true });
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
    const raidOn = (base = 300) => post('/__sb/live_cfg', { raidReset: true, raid: { every: 1440, dur: 1440, base, add: 100, gap: 0, sp: 'kue' } });

    /* ---------- the raid is on: the home card, joining, striking together ---------- */
    await raidOn(300);
    const A = await mk('A'); await onboard(A, '괴어사냥꾼');
    const B = await mk('B', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await onboard(B, '폰레이더');
    await go(A, 'home', 1800);
    ok(await until(() => A.$eval('[data-rdcard].on', n => /전설의 괴어/.test(n.textContent) && /제주|독도|부산|여수|울릉|태안|오키나와|도쿄|홍콩|하와이|시드니|플로리다/.test(n.textContent) && !!n.querySelector('[data-rdopen]'))), 'home: a raid card says a legendary fish is up, where, and offers to join');
    ok(await A.$eval('[data-rdcount="end"]', n => /^\d+:\d\d(:\d\d)?$/.test(n.textContent.trim())).catch(() => false), 'the card counts down to its end');
    ok(await until(() => A.$('.rd-toast')), 'a note pops up once when a raid is on');
    await shot(A, 'r01_home_card');
    await A.click('[data-rdcard] [data-rdopen]'); await A.waitForTimeout(1200);
    ok(await A.$eval('#rd', n => /괴어/.test(n.textContent) && /300/.test(n.querySelector('.rd-hp').textContent) && !n.querySelector('.rd-strike').disabled).catch(() => false), 'the raid screen: name, strength 300, the strike button');
    // a well-timed strike: wait for the ring to meet the circle
    await until(() => A.evaluate(() => rdQ() > .9), 2000, 10);
    await A.click('.rd-strike'); await A.waitForTimeout(700);
    const hp1 = await A.evaluate(() => RD.st.raid.hp);
    ok(hp1 < 300 && hp1 >= 300 - 44, 'a strike takes some strength: ' + hp1);
    ok(await A.evaluate(() => RD.st.raid.me && RD.st.raid.me.d === 300 - RD.st.raid.hp), 'my damage is counted');
    // B joins from the phone: the monster grows stronger, and A sees B's strikes live
    await B.evaluate(() => { location.hash = 'live'; }); await B.waitForTimeout(2500);
    ok(await until(() => B.$eval('#lv-rd', n => n.classList.contains('on') && !$('#lv-rdb').hidden).catch(() => false)), 'live map: the raid button glows while a raid is on');
    // a first visit to the live map: its first screen points to the raid
    ok(await until(() => B.$eval('#lv-cover .rd-strip', n => /전설의 괴어/.test(n.textContent)).catch(() => false)), 'the live map\'s first screen says a raid is on');
    await B.click('#lv-cover .rd-strip'); await B.waitForTimeout(1200);
    const bb = await B.$eval('.rd-strike', n => { const r = n.getBoundingClientRect(); return r.bottom <= innerHeight && r.top > innerHeight / 2 && r.width >= 200; });
    ok(bb, 'phone: the strike button is big and at the bottom of the screen');
    await B.click('.rd-strike'); await B.waitForTimeout(800);
    ok(await B.evaluate(() => RD.st.raid.max === 400), 'a second angler makes the monster stronger (+100 here)');
    for (let i = 0; i < 3; i++) { await B.click('.rd-strike'); await B.waitForTimeout(500); }
    ok(await until(() => A.evaluate(() => RD.fx.some(f => !f.mine && /폰레이더/.test(f.txt)) || RD.st.raid.n === 2), 4000), 'A sees B join the fight (live or on the next check)');
    await until(() => A.evaluate(() => RD.st.raid.n === 2), 5000);
    ok(await A.$$eval('.rd-top5 li', ns => ns.length === 2 && ns.some(n => /폰레이더/.test(n.textContent))), 'the damage board lists both');
    await shot(A, 'r02_raid_pc'); await shot(B, 'r03_raid_phone');
    // 레이드 원정대: both characters stand on the deck in both screens, with names; strikes together make a combo
    ok(await until(() => A.evaluate(() => RCW.m.size === 2 && [...RCW.m.values()].some(m => m.n === '폰레이더') && [...RCW.m.values()].every(m => m.look)), 5000), 'A sees both anglers\' characters on the deck');
    ok(await until(() => B.evaluate(() => RCW.m.size === 2 && [...RCW.m.values()].some(m => m.n === '괴어사냥꾼')), 5000), 'B sees them too');
    await sleep(1600); // they walk in
    await Promise.all([A.click('.rd-strike'), B.click('.rd-strike')]); await A.waitForTimeout(250);
    ok(await until(() => A.evaluate(() => !!RCW.combo && RCW.combo.n >= 2), 3000), 'two anglers striking together: a team-strike combo');
    ok(await A.evaluate(() => { const m = [...RCW.m.values()].find(x => x.n === '폰레이더'); return m && performance.now() - m.hit < 3000; }), 'the other angler\'s figure reacts to their strike');
    await A.waitForTimeout(120); await shot(A, 'r02b_crew_combo_pc'); await shot(B, 'r03b_crew_phone');
    // 원정대 감정 표현: the moves I own are buttons by the strike button; a wave shows on both decks, a locked one does not send
    ok(await A.$$eval('.rd-emo [data-rdemo]', ns => ns.length === 4 && !ns.find(n => n.dataset.rdemo === 'wave').classList.contains('lock') && ns.find(n => n.dataset.rdemo === 'zzirit').classList.contains('lock')), 'raid: the emote buttons (waving free, the others locked until bought)');
    const eb = await B.$eval('.rd-emo', n => { const r = n.getBoundingClientRect(), s = document.querySelector('.rd-strike').getBoundingClientRect(); return r.right <= innerWidth && r.bottom < s.top && r.width <= 60; }).catch(() => false);
    ok(eb, 'phone: the emote buttons fit on the right, clear of the strike button');
    await B.click('[data-rdemo="wave"]'); await B.waitForTimeout(300);
    ok(await B.evaluate(() => { const m = RCW.m.get(myId()); return !!(m && m.emo && m.emo.k === 'wave'); }), 'my own figure waves on my deck');
    ok(await until(() => A.evaluate(() => { const m = [...RCW.m.values()].find(x => x.n === '폰레이더'); return !!(m && m.emo && m.emo.k === 'wave'); }), 3000), 'the other angler sees the wave on their deck');
    await A.waitForTimeout(500); await shot(A, 'r02c_crew_wave_pc');
    await B.click('[data-rdemo="zzirit"]'); await B.waitForTimeout(400);
    ok(await B.evaluate(() => /낚시점/.test(document.querySelector('#toast-root').textContent)), 'a locked move points to the tackle shop');
    ok(await A.evaluate(() => { const m = [...RCW.m.values()].find(x => x.n === '폰레이더'); return !(m && m.emo && m.emo.k === 'zzirit'); }), 'and is not sent');
    ok(await A.evaluate(() => { rcEmo('stranger', 'fly', 'x'); const m = RCW.m.get('stranger'); return !m || !m.emo; }), 'an unknown move from someone is ignored');
    await sleep(2400);
    // too fast is refused by the server
    await post('/__sb/live_cfg', { raid: { gap: 60000 } });
    const before = await B.evaluate(() => RD.st.raid.me.hits);
    await B.click('.rd-strike'); await B.waitForTimeout(500); await B.click('.rd-strike'); await B.waitForTimeout(600);
    ok(await B.evaluate(h => RD.st.raid.me.hits <= h + 1, before), 'strikes too close together do not count');
    await post('/__sb/live_cfg', { raid: { gap: 0 } });
    // finish it: A beats it
    await post('/__sb/live_cfg', { raidHp: 20 });
    for (let i = 0; i < 8 && !(await A.evaluate(() => !!RD.st.raid.beaten)); i++) { await A.click('.rd-strike').catch(() => null); await A.waitForTimeout(450); }
    ok(await until(() => A.$eval('.rd-end', n => !n.hidden && /괴어 처치/.test(n.textContent) && /MVP/.test(n.textContent) && /\+\d+P/.test(n.textContent))), 'beaten: the win screen with the MVP and my points');
    ok(!(await A.$('.zp-win')), 'raid points do not show up as a weekly prize');
    ok(await until(() => B.$eval('.rd-end', n => !n.hidden && /괴어 처치/.test(n.textContent) && /\+\d+P/.test(n.textContent)).catch(() => false), 8000), 'the other angler sees the win too, with their own points');
    const d = await dump();
    const paid = d.ZPS.led.filter(x => /^raid:/.test(x.ref));
    ok(paid.length === 2 && paid.every(x => x.d >= 30), 'both are paid once by the server ' + JSON.stringify(paid.map(x => x.d)));
    await shot(A, 'r04_won_pc'); await shot(B, 'r05_won_phone');
    // the share picture: 1080×1920, opens the share card on a computer
    await A.click('[data-rdshare]'); await A.waitForTimeout(1500);
    ok(await A.$eval('.share-card img', n => n.naturalWidth === 1080 && n.naturalHeight === 1920).catch(() => false), 'the raid picture is story-sized');
    await A.keyboard.press('Escape'); await A.waitForTimeout(300);
    await A.evaluate(() => { document.querySelectorAll('.modal-wrap').forEach(m => m.remove()); document.body.classList.remove('has-modal'); rdClose(); });
    await B.evaluate(() => rdClose());
    ok(!(await A.$('#rd')), 'the raid screen closes');

    /* ---------- 레이드 기록과 괴어 칭호 ---------- */
    await A.evaluate(() => rdOpen()); await A.waitForTimeout(1000);
    ok(await until(() => A.$eval('[data-rrdot]', n => !n.hidden).catch(() => false), 5000), 'the record button shows a dot: a raid title is ready');
    await A.click('[data-rropen]'); await A.waitForTimeout(900);
    const rr = await A.evaluate(() => RR.st);
    const aMvp = rr && rr.mvp === 1;
    ok(rr && rr.joined === 1 && rr.won === 1 && rr.dex.kue === 1 && rr.list.length === 1 && rr.list[0].won && rr.list[0].pts >= 30, 'the record: one raid joined and beaten, kue in the book, the points ' + JSON.stringify(rr && { j: rr.joined, w: rr.won, m: rr.mvp }));
    ok(await A.$eval('.rd-rec', n => /내 레이드 기록/.test(n.textContent) && n.querySelectorAll('.rr-book li').length === 6 && n.querySelectorAll('.rr-book li.got').length === 1 && /1 \/ 6/.test(n.textContent) && /최근 레이드/.test(n.textContent)).catch(() => false), 'the record screen: the monster book (1 of 6 lit) and the last raids');
    ok(await A.$eval('[data-rrclaim="raid_hunter"]', n => /\+30P/.test(n.textContent)).catch(() => false), 'the monster hunter title is ready to take (+30P)');
    ok(!(await A.$('[data-rrclaim="raid_veteran"]')) && !(await A.$('[data-rrclaim="raid_all"]')), 'the titles not done cannot be taken');
    await shot(A, 'r06_record_pc');
    // the record covers the raid: clicks and keys do not strike
    const hitsB = (await dump()).ZPS.led.length;
    await A.keyboard.press(' '); await A.waitForTimeout(300);
    ok((await dump()).ZPS.led.length === hitsB, 'space on the record screen does not strike');
    const bal0 = await A.evaluate(() => (typeof ZP !== 'undefined' && ZP.st && ZP.st.bal) || 0);
    await A.click('[data-rrclaim="raid_hunter"]'); await A.waitForTimeout(900);
    ok(await A.$eval('.rr-ti.is-wear', n => /괴어 사냥꾼/.test(n.textContent)).catch(() => false), 'taken: the title is worn at once');
    const led = (await dump()).ZPS.led.filter(x => x.ref === 'set:raid_hunter');
    ok(led.length === 1 && led[0].d === 30, 'the server paid 30P once');
    if (aMvp) {
      await A.click('[data-rrclaim="raid_mvp"]'); await A.waitForTimeout(900);
      await A.click('[data-rrwear="raid_mvp"]'); await A.waitForTimeout(900);
      ok(await A.$eval('.rr-ti.is-wear', n => /괴어 MVP/.test(n.textContent)).catch(() => false), 'the MVP title taken and worn instead');
    } else ok(await A.$eval('.rr-ti:nth-child(2) .rr-pts', n => /\+80P/.test(n.textContent)).catch(() => false), 'not the MVP: the MVP title waits');
    ok(await A.evaluate(() => !!LSET.titles[myId()] && /괴어/.test(lsTitle(LSET.titles[myId()]))), 'the worn raid title is the one others see');
    await A.keyboard.press('Escape'); await A.waitForTimeout(400);
    ok(await A.$('#rd') && await A.$eval('.rd-rec', n => n.hidden).catch(() => true), 'Escape closes the record first, not the raid');
    await A.evaluate(() => rdClose());
    // the phone
    await B.evaluate(() => rdOpen()); await B.waitForTimeout(900);
    await B.click('[data-rropen]'); await B.waitForTimeout(1000);
    ok(await B.$eval('.rd-rec', n => { const r = n.getBoundingClientRect(); return r.width <= 390 && document.documentElement.scrollWidth <= 390 && n.querySelectorAll('.rr-book li').length === 6; }).catch(() => false), 'phone: the record fits the screen');
    await shot(B, 'r07_record_phone');
    await B.evaluate(() => { const b = document.querySelector('.rr-body'); b.scrollTop = b.scrollHeight; }); await B.waitForTimeout(300);
    await shot(B, 'r07b_record_phone_end');
    // a server without the record yet
    await post('/__sb/live_cfg', { cfg: { noRaidRec: true } });
    await B.evaluate(() => { RR.st = null; RR.off = false; return rrLoad(true); }); await B.waitForTimeout(500);
    ok(await B.$eval('.rd-rec', n => /서버 업데이트 뒤/.test(n.textContent)).catch(() => false), 'a server without the record: says it comes after the update');
    await post('/__sb/live_cfg', { cfg: { noRaidRec: false } });
    await B.evaluate(() => rdClose());

    /* ---------- no raid on: when the next one comes, and the last result ---------- */
    await post('/__sb/live_cfg', { raid: { every: 120, dur: 1 } });
    const off = (Date.now() % (120 * 60e3)) >= 60e3;
    if (off) {
      await A.evaluate(() => rdLoad(true)); await A.waitForTimeout(600); await go(A, 'home', 1200);
      ok(await A.$eval('[data-rdcard]:not(.on)', n => /다음 출현까지/.test(n.textContent) && /\d:\d\d/.test(n.textContent)).catch(() => false), 'between raids: the card counts down to the next one');
      await A.click('[data-rdcard] [data-rdopen]'); await A.waitForTimeout(900);
      ok(await A.$eval('#rd', n => n.querySelector('.rd-strike').disabled && /다음 출현까지/.test(n.textContent)).catch(() => false), 'the raid screen between raids: no strikes, a countdown');
      await A.evaluate(() => rdClose());
    }

    /* ---------- 나의 낚시 결산 ---------- */
    await A.evaluate(async () => {
      const y = new Date().getFullYear(), at = (m, d, h) => new Date(y, m, d, h).getTime();
      S.me.catches.push({ id: 'y1', sp: 'madai', len: 62, ts: at(4, 3, 5), at: Date.now(), st: 'ok' }, { id: 'y2', sp: 'kurodai', len: 41, ts: at(5, 10, 5), at: Date.now(), st: 'ok' },
        { id: 'y3', sp: 'kurodai', len: 38, ts: at(8, 21, 6), at: Date.now(), st: 'ok' }, { id: 'y4', sp: 'aoriika', len: 30, ts: at(9, 2, 19), at: Date.now(), st: 'ok' },
        { id: 'y5', sp: 'buri', len: 99, ts: at(9, 2, 19), at: Date.now(), st: 'no' }, { id: 'y6', sp: 'buri', len: 80, ts: new Date(y - 1, 9, 2).getTime(), at: Date.now(), st: 'ok' });
      await store.saveMe(); rerender();
    });
    await go(A, 'home', 1200);
    ok(await A.$eval('.rc-card', n => new RegExp(new Date().getFullYear() + ' 나의 낚시 결산').test(n.textContent) && /\d+마리/.test(n.textContent)).catch(() => false), 'home: the year-in-review card');
    await A.click('.rc-card [data-rcopen]'); await A.waitForTimeout(1500);
    const dd = await A.evaluate(() => RC.d);
    ok(dd.n === 4 && dd.big.len === 62 && dd.fav[0] === 'kurodai' && dd.fav[1] === 2, 'counts only this year and not the refused one: 4 fish, the biggest 62 cm, kurodai twice');
    const lst = await A.evaluate(async () => (await APP_AUTH.live.state()).dex);
    ok(dd.dex === lst.length && dd.dex >= 0, 'the live fish book is counted too: ' + dd.dex);
    ok(dd.hi === 0 && dd.type === (dd.legends.length ? 'legend' : 'giant'), 'the dawn angler; the type fits the year (' + dd.type + ')');
    const slides = await A.evaluate(() => RC.slides.map(s => s.k));
    const want = ['intro', 'count', 'big', 'fav', 'months', 'hours'].concat(dd.dex ? ['live'] : [], ['type', 'share']);
    ok(JSON.stringify(slides) === JSON.stringify(want), 'the story: ' + slides.join(' → '));
    await shot(A, 'r10_recap_intro');
    await A.waitForTimeout(5600);
    ok(await A.evaluate(() => RC.i === 1), 'it moves on by itself');
    await A.click('.rc-nav.next'); await A.waitForTimeout(400);
    ok(await A.evaluate(() => RC.i === 2 && RC.slides[2].k === 'big'), 'tap right: next (the biggest fish)');
    await A.click('.rc-nav.prev'); await A.waitForTimeout(400);
    ok(await A.evaluate(() => RC.i === 1), 'tap left: back');
    await A.keyboard.press('ArrowRight'); await A.waitForTimeout(200); await A.keyboard.press('ArrowRight'); await A.waitForTimeout(1200);
    await shot(A, 'r11_recap_fav');
    await A.evaluate(() => rcGo(RC.slides.length - 1)); await A.waitForTimeout(800);
    ok(await A.$eval('.rc-sum', n => /전설 사냥꾼|대물 헌터/.test(n.textContent) && /괴어사냥꾼/.test(n.textContent) && /4/.test(n.textContent)).catch(() => false), 'the last slide sums it up');
    await shot(A, 'r12_recap_end');
    await A.click('[data-rcshare]'); await A.waitForTimeout(1600);
    ok(await A.$eval('.share-card img', n => n.naturalWidth === 1080 && n.naturalHeight === 1920).catch(() => false), 'the recap picture is story-sized');
    await A.evaluate(() => { document.querySelectorAll('.modal-wrap').forEach(m => m.remove()); });
    await A.keyboard.press('Escape'); await A.waitForTimeout(300);
    ok(!(await A.$('#rc')), 'Escape closes the story');
    // a phone with nothing yet: a short story that points to the first fish
    const C = await mk('C', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await onboard(C, '새내기');
    await go(C, 'log', 1000); await C.click('.log [data-rcopen]'); await C.waitForTimeout(1200);
    ok(await C.evaluate(() => RC.slides.map(s => s.k).join() === 'intro,empty'), 'no catches yet: the intro and a nudge to the first fish');
    await C.evaluate(() => rcGo(1)); await C.waitForTimeout(700);
    ok(await C.$eval('.rc-frame', n => { const r = n.getBoundingClientRect(); return r.width <= 390 && r.height <= 844 && !!n.querySelector('a[href="#scan"]'); }), 'phone: the story fills the screen and offers the scan');
    await shot(C, 'r13_recap_empty_phone');
    await C.click('.rc-slide a[href="#scan"]'); await C.waitForTimeout(800);
    ok(!(await C.$('#rc')) && await C.evaluate(() => S.route === 'scan'), 'the button closes the story and goes to the scan');
    // in English
    await C.evaluate(() => { setLang('en'); rerender(); }); await C.waitForTimeout(1200);
    await go(C, 'home', 1000);
    ok(await C.$eval('.rc-card', n => /in fishing/.test(n.textContent)).catch(() => false) && await C.$eval('[data-rdcard]', n => /Next one in|surfaced/.test(n.textContent)).catch(() => false), 'English texts for both');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  finally {
    await b.close();
    console.log(logs.join('\n'));
    console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL PASSED');
    process.exit(fails.length ? 1 : 0);
  }
})();
