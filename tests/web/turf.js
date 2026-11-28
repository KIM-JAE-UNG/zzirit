// 바다 땅따먹기 and 동호회 대항전 in 찌릿 라이브: the flag button, the war map (blocks and flags, mine sky-blue), the panel (my
// seas, the lords, last week's pay once), a tap on a square (who holds it, how much it takes, fish here), someone takes
// my sea (the news with 「되찾기」, the badge), taking it back (the flag goes up), the club war (a club's colour, the
// ranking, the card on the team page), hidden anglers, the server without 0030 (the button stays away), a phone.
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/turf/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/turf/'; fs.mkdirSync(OUT, { recursive: true });
const SRV = 'http://127.0.0.1:8768', BASE = SRV + '/index.html';
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(SRV + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json());
async function until(fn, ms = 6000, step = 80) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); } catch (e) { v = null; } if (v) return v; await sleep(step); } return v; }
const reachable = (p, sel) => p.evaluate(s => {
  const n = document.querySelector(s); if (!n) return 'missing';
  const r = n.getBoundingClientRect(); if (!r.width || !r.height) return 'no size';
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return 'off screen y=' + Math.round(y);
  const top = document.elementFromPoint(x, y); return top && (top === n || n.contains(top)) ? 'ok' : 'covered by ' + (top ? (top.className || top.tagName) : 'nothing');
}, sel);
// Zürich lake (the test tiles): A's square (85, 473), B's (86, 473), a hidden angler's (84, 474)
const SQ_A = { gx: 854, gy: 4736 }, SQ_B = { gx: 864, gy: 4736 }, SQ_H = { gx: 845, gy: 4745 };
(async () => {
  const b = await chromium.launch();
  try {
    const mk = async (name, opts = {}) => {
      const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 860 }, locale: 'ko-KR' }, opts));
      await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); localStorage.setItem('eosin.liveOk', 'true'); localStorage.setItem('eosin.liveGeo', 'false'); localStorage.setItem('eosin.liveSnd', 'false'); localStorage.setItem('eosin.liveAt', JSON.stringify({ lng: 8.54, lat: 47.366 })); } catch (e) { } }, WN);
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
    const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });
    const idOf = p => p.evaluate(() => myId());
    const seed = (acct, sq, score, o = {}) => post('/__sb/live_seed', { weeksAgo: o.weeksAgo || 0, rows: [{ acct, score, gx: sq.gx, gy: sq.gy, anon: !!o.anon, now: true }] });
    const toLive = async p => { await go(p, 'live', 1500); return until(() => p.evaluate(() => LV.ready && !$('#lv-cover').dataset.k), 20000); };

    const A = await mk('A'); await onboard(A, '갯바위왕');
    const B = await mk('B'); await onboard(B, '감성돔러버');
    const aId = await idOf(A), bId = await idOf(B);
    await seed(aId, SQ_A, 80); await seed(bId, SQ_B, 60); await seed('hidden-1', SQ_H, 40, { anon: true });
    await seed(aId, { gx: 100, gy: 100 }, 30, { weeksAgo: 1 }); // last week: one square held

    /* ---------- the flag button and the war map ---------- */
    ok(!!(await toLive(A)), 'live: the map is up');
    ok(!!(await until(() => A.$eval('#lv-tf', n => !n.hidden))), 'the flag button is on the side');
    ok(!!(await until(() => A.$eval('#lv-tf [data-tfdot]', n => !n.hidden && n.textContent === '1'))), 'it shows 1: last week\'s pay is waiting');
    await A.click('#lv-tf');
    ok(!!(await until(() => A.evaluate(() => TF.on && $('#lv').classList.contains('tf-on')))), 'the war map opens');
    ok(!!(await until(() => A.evaluate(() => Math.abs(LV.map.getZoom() - 8.9) < .2 && LV.map.getPitch() > 40), 5000)), 'the camera flies up over the sea (zoom 8.9, tilted)');
    ok(!!(await until(() => A.evaluate(() => !!LV.map.getLayer('tf-box') && TF.feats.length === 3), 5000)), 'three squares stand up as blocks');
    ok(await A.evaluate(() => { const f = TF.feats, me = f.find(x => x.properties.me === 1); return !!me && me.properties.col === '#7CC4FF' && f.filter(x => x.properties.col === '#5866D8').length === 1 && f.filter(x => x.properties.col === '#58657E').length === 1; }), 'mine sky-blue, Bob\'s indigo, the hidden one grey');
    ok(!!(await until(() => A.$$eval('.tf-mk', ns => ns.length === 3 && ns.some(n => n.classList.contains('mine') && /갯바위왕/.test(n.textContent) && /80/.test(n.textContent)) && ns.some(n => /감성돔러버/.test(n.textContent)) && ns.some(n => /숨은 낚시꾼/.test(n.textContent))))), 'flags carry the names and the power (the unnamed one as 숨은 낚시꾼)');
    const panel = await A.$eval('#tf-panel', n => n.hidden ? '' : n.textContent);
    ok(/바다 땅따먹기/.test(panel) && /남음/.test(panel) && /1곳이 내 바다/.test(panel) && /1위|2위/.test(panel) && /이번 주 바다의 주인/.test(panel), 'the panel: the title, time left, my seas and place, the lords ' + panel.slice(0, 120));
    ok(/지난주 내 바다 1곳 보상/.test(panel) && /\+10P/.test(panel), 'last week\'s pay: 1 sea → +10P');
    ok(await A.evaluate(() => getComputedStyle($('.lv-bottom')).display === 'none' && getComputedStyle($('#lv-net')).display === 'none'), 'the fishing buttons step aside');
    await A.waitForTimeout(700); await shot(A, 't01_war_map');
    // claim
    const bal0 = await A.evaluate(() => APP_AUTH.live.turfMe().then(r => r.bal));
    await A.click('[data-tfclaim]');
    ok(!!(await until(() => A.evaluate(() => /지난주 바다 1곳 보상 \+10P/.test(document.body.textContent)))), 'claimed: the toast says +10P');
    ok((await A.evaluate(() => APP_AUTH.live.turfMe().then(r => r.bal))) === bal0 + 10 && !(await A.$('[data-tfclaim]')), 'the wallet has 10P more, the button is gone');
    ok((await A.evaluate(() => APP_AUTH.live.turfClaim())).err === 'already', 'only once');
    // a tap on Bob's square
    await A.evaluate(() => { const c = tfMid(86, 473); lvTap(c.lng, c.lat); });
    let card = await until(() => A.$eval('#tf-card', n => n.hidden ? '' : n.textContent));
    ok(/감성돔러버/.test(card) && /60/.test(card) && /61점 더 낚으면 내 땅/.test(card) && /여기서 낚시하기/.test(card) && /멀리서 던지기 오늘 5번 남음/.test(card), 'a tap on Bob\'s square: who, how much, 61 more points takes it, fish here ' + card);
    ok(/앞바다|호|해|바다/.test(await A.$eval('.tf-cn', n => n.textContent)), 'the square has a name (the nearest town or the sea)');
    await A.waitForTimeout(300); await shot(A, 't02_square_card');
    await A.evaluate(() => { const c = tfMid(85, 473); lvTap(c.lng, c.lat); });
    card = await A.$eval('#tf-card', n => n.textContent);
    ok(/내 바다/.test(card) && /여기서 더 낚기/.test(card), 'my own square: mine, fish more to hold it');
    await A.evaluate(() => { const c = tfMid(90, 470); lvTap(c.lng, c.lat); });
    ok(/아직 주인이 없는 바다/.test(await A.$eval('#tf-card', n => n.textContent)), 'an empty square: nobody holds it');

    /* ---------- Bob takes my sea; I take it back ---------- */
    await seed(bId, SQ_A, 100);
    await A.evaluate(() => tfLoad(true));
    const news = await until(() => A.$eval('.tf-news', n => n.textContent));
    ok(/감성돔러버님이 .+를 빼앗아 갔어요/.test(news || '') && !!(await A.$('.tf-news li.lost [data-tfat]')), 'the news: Bob took it, with 되찾기 ' + news);
    await A.click('.tf-news li.lost [data-tfat]');
    ok(!!(await until(() => A.$eval('#tf-card', n => !n.hidden && /감성돔러버/.test(n.textContent) && /21점 더/.test(n.textContent)))), '되찾기 shows the square: 21 more points takes it back');
    await A.click('#tf-card [data-tffish]');
    ok(!!(await until(() => A.evaluate(() => !TF.on && LV.mode === 'remote' && !$('#lv').classList.contains('tf-on')))), 'fish here: the war map closes, fishing from afar');
    // a fish later: it is mine again — the flag goes up
    await seed(aId, SQ_A, 50);
    await A.evaluate(() => tfAfterLand());
    const win = await until(() => A.$eval('.tf-win', n => n.textContent), 5000);
    ok(/바다 점령!/.test(win || '') && /감성돔러버님에게서 빼앗았어요/.test(win || ''), 'taken back: 「바다 점령!」 from Bob ' + win);
    await A.waitForTimeout(900); await shot(A, 't03_sea_taken');
    await A.click('.tf-win [data-tfgo]');
    ok(!!(await until(() => A.evaluate(() => TF.on && TF.sel && TF.sel[0] === 85))), '「내 땅 보기」 opens the war map on that square');
    // Bob hears
    ok(!!(await toLive(B)), 'B on the live map');
    ok(!!(await until(() => B.evaluate(() => TF.me && TF.me.log[0] && TF.me.log[0].k === 'lost'), 6000)), 'B\'s news: taken back by A');

    /* ---------- the club war ---------- */
    await B.evaluate(() => store.saveTeam({ v: 1, name: '부산조사회', tag: 'BSN', emoji: '🐟', color: '#1E66E5', home: 'KS', intro: '', open: true, members: {}, ban: {}, ts: nowMs() }));
    await A.evaluate(id => { S.me.team = { id, ts: nowMs() }; return store.saveMe(); }, bId);
    await A.waitForTimeout(600);
    await A.click('[data-tfview="club"]');
    ok(!!(await until(() => A.evaluate(() => TF.view === 'club' && TF.feats.length === 2 && TF.feats.every(f => f.properties.col === '#1E66E5')), 6000)), 'club view: the club\'s squares in its colour (the hidden one has no club)');
    await A.evaluate(() => tfFetch()); await A.waitForTimeout(500);
    ok(!!(await until(() => A.$$eval('.tf-mk', ns => ns.length === 2 && ns.every(n => /BSN/.test(n.textContent))))), 'club flags carry the club tag');
    const cp = await until(() => A.evaluate(() => tfLoad(true).then(() => $('#tf-panel').textContent)));
    ok(/부산조사회/.test(cp) && /동호회 순위/.test(cp) && /2곳/.test(cp), 'the panel: my club holds 2 seas, the club ranking ' + cp.slice(0, 140));
    await A.waitForTimeout(500); await shot(A, 't04_club_war');
    await A.evaluate(() => { const c = tfMid(86, 473); lvTap(c.lng, c.lat); });
    ok(/우리 동호회의 바다/.test(await A.$eval('#tf-card', n => n.textContent)), 'a club square: ours');
    await A.click('#lv-tf');
    ok(!!(await until(() => A.evaluate(() => !TF.on && !LV.map.getLayer('tf-box') && !$('.tf-mk')))), 'closing takes the blocks and flags away');
    // the team page
    await go(A, 'teams', 1500);
    ok(!!(await until(() => A.$eval('.tf-tcard', n => /이번 주 동호회 대항전/.test(n.textContent) && /부산조사회/.test(n.textContent) && /2곳/.test(n.textContent)))), 'the team page: this week\'s club war card');
    await A.click('.tf-tcard [data-tfwant]');
    ok(!!(await until(() => A.evaluate(() => TF.on && TF.view === 'club'), 20000)), '「지도 보기」 opens the war map on the club view');

    /* ---------- a server without 0030 ---------- */
    await post('/__sb/live_cfg', { cfg: { noTurf: true } });
    const C = await mk('C'); await onboard(C, '새낚시꾼');
    ok(!!(await toLive(C)), 'C on the live map');
    await C.waitForTimeout(1200);
    ok(await C.evaluate(() => TF.off && $('#lv-tf').hidden), 'no 0030 on the server: the flag button stays away');
    ok(await C.evaluate(() => { const n0 = $$('.tf-tcard').length; return tfTeamCardHTML() === '' && n0 === 0; }), 'and the team page has no war card');
    await post('/__sb/live_cfg', { cfg: { noTurf: false } });

    /* ---------- a phone ---------- */
    const P = await mk('P', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await onboard(P, '폰낚시꾼');
    ok(!!(await toLive(P)), 'phone: the live map');
    ok(!!(await until(() => P.$eval('#lv-tf', n => !n.hidden))), 'phone: the flag button');
    ok((await reachable(P, '#lv-tf')) === 'ok', 'phone: the flag button can be pressed');
    await P.tap('#lv-tf');
    ok(!!(await until(() => P.evaluate(() => TF.on && !!LV.map.getLayer('tf-box') && $$('.tf-mk').length >= 2), 8000)), 'phone: the war map with flags');
    ok(await P.evaluate(() => { const r = $('#tf-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.height < innerHeight * .5; }), 'phone: the panel fits in the lower half');
    await P.waitForTimeout(700); await shot(P, 't05_phone_map');
    await P.evaluate(() => { const c = tfMid(85, 473); lvTap(c.lng, c.lat); });
    await until(() => P.$eval('#tf-card', n => !n.hidden));
    ok((await reachable(P, '#tf-card [data-tffish]')) === 'ok' && (await reachable(P, '#tf-card .tf-x')) === 'ok', 'phone: the square card and its buttons can be pressed');
    ok(await P.evaluate(() => { const a = $('#tf-card').getBoundingClientRect(), b2 = $('#tf-panel').getBoundingClientRect(); return a.bottom <= b2.top + 2 && a.right <= innerWidth; }), 'phone: the card does not cover the panel');
    await P.waitForTimeout(300); await shot(P, 't06_phone_card');
    await P.tap('#tf-card .tf-x');
    ok(await P.$eval('#tf-card', n => n.hidden), 'phone: the card closes');
  } catch (e) { logs.push('CRASH ' + e.stack); fails.push('crash'); }
  await b.close();
  console.log(logs.join('\n'));
  console.log(fails.length ? `FAILED ${fails.length}` : 'ALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
