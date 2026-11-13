// Live features with several people at once: the open chat, 1:1 between friends, 찌릿 라이브 (the game on the real map:
// on the spot, floats seen by others, the bite, the fight, the catch, the book, far-away casts on a phone), the operator's
// board tools, comment editing and leaving (회원 탈퇴).
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/live/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/live/'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8768/index.html';
// the update notes this build would show: marked as seen, so no dialog gets in the way (whatever the current id is)
const WN = (fs.readFileSync(__dirname + '/../../index.html', 'utf8').match(/WHATS_NEW = '([^']+)'/) || [])[1] || '';
const logs = [], fails = [], PAGES = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = async () => (await fetch('http://127.0.0.1:8768/__sb/dump')).json();
const feature = q => fetch('http://127.0.0.1:8768/__sb/feature?' + q);
// wait until fn() is truthy (polling), up to ms; returns the last value
async function until(fn, ms = 6000, step = 150) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); } catch (e) { v = null; } if (v) return v; await sleep(step); } return v; }

(async () => {
  const b = await chromium.launch();
  try {
    const mk = async (name, opts = {}) => {
      const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 860 }, locale: 'ko-KR' }, opts.ctx || {}));
      await ctx.addInitScript(wn => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', JSON.stringify(wn)); } catch (e) { } }, WN);
      // the live map draws the test tiles (a lakeside town) instead of asking the tile server
      await ctx.addInitScript(() => { window.LIVE_TILES = { tiles: '/tests/fixtures/tiles/{z}/{x}/{y}.pbf', glyphs: '', minzoom: 10 }; });
      await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
      await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
      await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
      await ctx.route(/fonts\.(googleapis|gstatic)\.com|open-meteo\.com/, r => r.abort());
      await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', async r => {
        const req = r.request(); const body = JSON.parse(req.postData() || '{}');
        if (/\/push$/.test(req.url())) { const j = await (await fetch('http://127.0.0.1:8768/__fn/push', { method: 'POST', headers: { 'x-auth': req.headers()['authorization'] || '' }, body: req.postData() || '{}' })).json(); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); }
        if (/\/review$|\/news$/.test(req.url())) return r.fulfill({ contentType: 'application/json', body: '{}' });
        if (body.mode === 'status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ai: false, images: false, provider: null }) });
        return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"ai_not_configured"}}' });
      });
      const p = await ctx.newPage();
      p.on('pageerror', e => { logs.push(name + ' PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); fails.push(name + ' pageerror ' + e.message); });
      p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push(name + ' console.error: ' + m.text().slice(0, 220)); });
      await p.goto(BASE + '#home'); await p.waitForTimeout(1500);
      p._ctx = ctx; p._name = name; PAGES.push(p);
      return p;
    };
    const go = async (p, h, w = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w); };
    const onboard = async (p, nick) => { await go(p, 'home'); await p.click('[data-act="onboard"]:visible'); await p.waitForTimeout(400); await p.fill('#pf-nick', nick); await p.selectOption('#pf-home', 'KS'); if (await p.$('#onb-noid')) await p.click('#onb-noid'); else await p.click('#onb-go'); await p.waitForTimeout(1500); };
    const shot = (p, n, full) => p.screenshot({ path: OUT + n + '.png', fullPage: !!full });
    const closeModals = async p => { for (let i = 0; i < 5; i++) { const xs = await p.$$('.modal-wrap.in .modal-x'); if (!xs.length) break; await xs[xs.length - 1].click(); await p.waitForTimeout(320); } };
    const toasts = p => p.$$eval('.toast', ns => ns.map(n => n.textContent).join(' | '));
    const uidOf = p => p.evaluate(() => S.uid);

    /* ---------- people ---------- */
    const LAKE = { latitude: 47.36655, longitude: 8.54135, accuracy: 12 }; // on the quay, a cast away from the lake
    const A = await mk('A', { ctx: { geolocation: LAKE, permissions: ['geolocation'] } }); await onboard(A, '갯바위왕');
    const B = await mk('B', { ctx: { geolocation: { latitude: 47.36640, longitude: 8.54180, accuracy: 15 }, permissions: ['geolocation'] } }); await onboard(B, '감성돔러버');
    const OP = await mk('OP'); await onboard(OP, '관리테스트');
    await go(OP, 'claim', 600); await OP.fill('#cl-code', 'testcode1234abcd'); await OP.click('#cl-go'); await OP.waitForTimeout(2400); await closeModals(OP);
    ok(await OP.evaluate(() => S.isOwner), 'operator signed in');
    const aId = await uidOf(A), bId = await uidOf(B), opId = await uidOf(OP);
    ok(!!aId && !!bId && aId !== bId, 'two separate accounts');
    // the menu has the live sea right under home; the park and the mini games are gone
    ok(await A.$eval('.nav > a[data-route="live"]', n => !n.hidden && /찌릿 라이브/.test(n.textContent)), 'live in the menu');
    ok(!(await A.$('.nav a[data-route="park"], .nav a[data-route="games"]')), 'no park, no mini games in the menu');
    ok(await A.$eval('.nav a[data-route="chat"]', n => !n.hidden), 'chat in the menu');

    /* ---------- the open chat ---------- */
    await go(A, 'chat', 1200); await go(B, 'chat', 1200); await go(OP, 'chat', 1200);
    ok(!!(await A.$('#chat-form')), 'chat: A can write');
    await A.fill('#chat-text', '안녕하세요 다들 반가워요'); await A.press('#chat-text', 'Enter');
    ok(!!(await until(() => B.$$eval('#chat-log .cm-body', ns => ns.some(n => n.textContent === '안녕하세요 다들 반가워요')))), 'chat: B sees A\'s message live');
    ok(await A.$eval('#chat-text', n => n.value === ''), 'chat: the box empties after sending');
    let d = await dump();
    const m1 = Object.values(d.T.chat).find(r => r.body === '안녕하세요 다들 반가워요');
    ok(!!m1 && m1.uid === aId && m1.nick === '갯바위왕', 'chat: the server wrote who said it');
    await A.fill('#chat-text', '여기 들어와요 www.scam-shop.com'); await A.press('#chat-text', 'Enter'); await A.waitForTimeout(700);
    ok(/링크/.test(await toasts(A)), 'chat: links refused with a reason');
    await A.fill('#chat-text', '연락주세요 010-1234-5678'); await A.press('#chat-text', 'Enter'); await A.waitForTimeout(700);
    ok(/전화번호/.test(await toasts(A)), 'chat: phone numbers refused');
    d = await dump();
    ok(!Object.values(d.T.chat).some(r => /scam|010-/.test(r.body)), 'chat: refused messages were not stored');
    // the profanity mask (shown masked, kept as typed)
    await A.fill('#chat-text', '아 시발 놓쳤다'); await A.press('#chat-text', 'Enter');
    ok(!!(await until(() => B.$$eval('#chat-log .cm-body', ns => ns.some(n => n.textContent === '아 ** 놓쳤다')))), 'chat: bad words masked for readers');
    await shot(B, 'l01_chat_B');
    // B reports A's first message
    const m1sel = `#chat-log [data-cm="${m1.id}"] [data-cmmore]`;
    await B.click(m1sel); await B.waitForTimeout(400);
    ok(!!(await B.$('[data-cma="report"]')) && !(await B.$('[data-cmute]')), 'chat: a member sees report, not the operator tools');
    await B.click('[data-cma="report"]'); await B.waitForTimeout(900);
    d = await dump();
    ok((d.T.suggest[bId] && d.T.suggest[bId].data.items || []).some(s => s.cat === 'report' && s.ref === 'chat:' + m1.id && s.about === aId), 'chat: the report reaches the operator inbox');
    // the operator: hide it, then mute A for 10 minutes, then lift it
    await until(() => OP.$(m1sel)); await OP.click(m1sel); await OP.waitForTimeout(400);
    ok(!!(await OP.$('[data-cma="hide"]')) && (await OP.$$('[data-cmute]')).length === 4, 'chat: the operator gets hide and mute');
    await OP.click('[data-cma="hide"]'); await OP.waitForTimeout(1200);
    d = await dump();
    ok(d.T.chat[m1.id].hidden === true, 'chat: hidden on the server');
    ok(!!(await until(() => B.$$eval('#chat-log .cm-body', ns => !ns.some(n => n.textContent === '안녕하세요 다들 반가워요')))), 'chat: the hidden message disappears for others');
    const m2 = Object.values(d.T.chat).find(r => r.body === '아 시발 놓쳤다');
    await OP.click(`#chat-log [data-cm="${m2.id}"] [data-cmmore]`); await OP.waitForTimeout(400);
    await OP.click('[data-cmute="10"]'); await OP.waitForTimeout(900);
    ok(/10|채팅할 수 없어요/.test(await toasts(OP)), 'chat: mute confirmed to the operator');
    await A.fill('#chat-text', '저 말 좀 할게요'); await A.press('#chat-text', 'Enter'); await A.waitForTimeout(800);
    ok(/막았어요/.test(await toasts(A)), 'chat: a muted person is told until when');
    ok(/막았어요/.test(await A.$eval('#chat-note', n => n.textContent).catch(() => '')), 'chat: the mute note stays under the box');
    await OP.click(`#chat-log [data-cm="${m2.id}"] [data-cmmore]`); await OP.waitForTimeout(400); await OP.click('[data-cmute="0"]'); await OP.waitForTimeout(800);
    await A.fill('#chat-text', '이제 됐다'); await A.press('#chat-text', 'Enter');
    ok(!!(await until(() => B.$$eval('#chat-log .cm-body', ns => ns.some(n => n.textContent === '이제 됐다')))), 'chat: talking again after the mute is lifted');

    /* ---------- 1:1 between friends ---------- */
    await A.evaluate(u => friendAction('req', u), bId); await B.waitForTimeout(1200);
    await until(() => B.evaluate(u => relation(u) === 'in', aId));
    await B.evaluate(u => friendAction('acc', u), aId);
    ok(!!(await until(() => A.evaluate(u => relation(u) === 'friend', bId))), 'friends: A and B are friends');
    await go(B, 'home', 700);
    await go(A, 'chat', 800); await A.click('[data-ctab="dm"]'); await A.waitForTimeout(500);
    ok(!!(await A.$(`[data-dmpeer="${bId}"]`)), 'dm: the friend is in the list');
    await A.click(`[data-dmpeer="${bId}"]`); await A.waitForTimeout(500);
    await A.fill('#dm-text', '내일 새벽에 같이 갈래요?'); await A.press('#dm-text', 'Enter');
    ok(!!(await until(() => B.$eval('.nav [data-dmbadge]', n => !n.hidden && n.textContent === '1'))), 'dm: unread count next to the menu');
    ok(!!(await until(() => B.evaluate(() => notiList().some(x => x.k === 'dm')))), 'dm: a line in the notifications');
    d = await dump();
    const dm1 = Object.values(d.T.dm).find(r => r.body === '내일 새벽에 같이 갈래요?');
    ok(!!dm1 && dm1.sender === aId && [dm1.a, dm1.b].sort().join() === [aId, bId].sort().join(), 'dm: stored for the two of them');
    ok(d.PUSHLOG.some(x => x.kind === 'dm' && x.ref === String(dm1.id)), 'dm: the friend\'s phone is asked to be told');
    await B.click('.noti-btn:visible'); await B.waitForTimeout(500);
    await shot(B, 'l02_noti_dm');
    await B.click('.nt-item.k-dm'); await B.waitForTimeout(900);
    ok(await B.evaluate(u => S.route === 'chat' && S.chatTab === 'dm' && S.dmPeer === u, aId), 'dm: the notification opens the conversation');
    await go(B, 'home', 500); await go(B, 'dm', 700);
    ok(await B.evaluate(() => S.route === 'chat' && S.chatTab === 'dm' && !S.dmPeer && location.hash === '#chat'), 'dm: a phone notice (#dm) opens the conversations');
    await B.click(`[data-dmpeer="${aId}"]`); await B.waitForTimeout(500);
    ok(await B.$$eval('#dm-log .cm-body', ns => ns.some(n => n.textContent === '내일 새벽에 같이 갈래요?')), 'dm: B reads it');
    ok(!!(await until(() => B.$eval('.nav [data-dmbadge]', n => n.hidden))), 'dm: read, the count goes away');
    await B.fill('#dm-text', '좋아요! 5시에 봐요'); await B.press('#dm-text', 'Enter');
    ok(!!(await until(() => A.$$eval('#dm-log .cm-body', ns => ns.some(n => n.textContent === '좋아요! 5시에 봐요')))), 'dm: A sees the reply live');
    await shot(A, 'l03_dm_A');
    // someone who is not a friend can neither write nor read
    const C = await mk('C'); await onboard(C, '지나가는사람');
    const cId = await uidOf(C);
    const cTry = await C.evaluate(async u => { try { await APP_AUTH.dm.send(u, '안녕'); return 'sent'; } catch (e) { return e.code; } }, aId);
    ok(cTry === 'not_friends', 'dm: a stranger cannot write');
    ok((await C.evaluate(() => APP_AUTH.dm.list())).length === 0, 'dm: a stranger reads nothing');
    const opRead = await OP.evaluate(() => APP_AUTH.dm.list());
    ok(opRead.length === 0, 'dm: not even the operator reads 1:1');

    /* ---------- 찌릿 라이브: two anglers on the same quay ---------- */
    const lvCfg = cfg => fetch('http://127.0.0.1:8768/__sb/live_cfg', { method: 'POST', body: JSON.stringify(cfg) }).then(r => r.json());
    const press = async p => { await p.dispatchEvent('#lv-main', 'pointerdown'); await p.dispatchEvent('#lv-main', 'pointerup'); };
    const ph = p => p.evaluate(() => LV.phase);
    await lvCfg({ cfg: { tier: 4, big: false, u: .5, school: 2, rate: 1.25 } });
    await go(A, 'park', 2500); // an old link to the park lands on the live sea
    ok(await A.evaluate(() => location.hash === '#live' && S.route === 'live'), 'live: old park links open the live sea');
    ok(!!(await until(() => A.$('#lv-cover [data-lv="go-geo"]'), 20000)), 'live: the first visit explains the game and asks about location');
    ok(/이 기기에서만/.test(await A.$eval('#lv-cover .lv-priv', n => n.textContent)), 'live: and says what happens to the location');
    await shot(A, 'l04_live_intro');
    await A.click('[data-lv="go-geo"]');
    ok(!!(await until(() => A.evaluate(() => LV.mode === 'site' && !!LV.stand && LV.site), 20000)), 'live: by the water → fishing on the spot');
    ok(await A.evaluate(() => LV.near && LV.near.d > 5 && LV.near.d < 100 && LV.near.kind === 'fresh'), 'live: the lake is a cast away (fresh water)');
    ok(!!(await until(() => A.evaluate(() => LV.schools.length > 0 && LV.schools.every(s => LMAP.waterAt(LV.water, s.lng, s.lat))), 8000)), 'live: schools show, only on water');
    ok(/현장/.test(await A.$eval('#lv-chips', n => n.textContent)) && /캐스팅/.test(await A.$eval('#lv-mtxt', n => n.textContent)), 'live: the chips say "on the spot", the button says "cast"');
    ok(await A.$eval('#lv-fx', n => n.width > 300 && n.height > 300) && (await A.evaluate(() => !!(LV.ang.at && LV.ang.tip && LV.ang.tip.y < LV.h))), 'live: my angler stands on the map');
    await A.waitForTimeout(600); await shot(A, 'l04b_live_site');
    await go(B, 'live', 2500); await until(() => B.$('#lv-cover [data-lv="go-geo"]'), 20000); await B.click('[data-lv="go-geo"]');
    ok(!!(await until(() => B.evaluate(() => LV.mode === 'site' && !!LV.stand), 20000)), 'live: B is on the quay too');
    // a tap on the water aims there; a tap on land does not
    const aim = await A.evaluate(() => { const t0 = lvAim(); lvTap(LV.stand.lng, LV.stand.lat); const onLand = LV.target; lvTap(t0.lng, t0.lat); return { onLand: !!onLand, d: LMAP.dist(LV.stand, LV.target), kind: LV.target.kind }; });
    ok(!aim.onLand && aim.d > 5 && aim.d <= 60 && aim.kind === 'fresh', 'live: a tap on the water aims within the rod\'s reach — ' + JSON.stringify(aim));
    // A casts: B sees the float (A's fish takes its time, so B can fumble first)
    await lvCfg({ cfg: { waitMin: 7000, waitMax: 7400 } });
    await press(A);
    ok(!!(await until(async () => (await ph(A)) === 'wait', 8000)), 'live: A\'s float is in the water');
    ok(!!(await until(() => B.evaluate(u => { const o = LV.others.get(u); return o && o.f === 'float_basic' && o.n === '갯바위왕' && Math.abs(o.y - 47.366) < .01; }, aId), 8000)), 'live: B sees A\'s float on the same water');
    ok(/찌 1개/.test(await B.$eval('#lv-chips', n => n.textContent)), 'live: B\'s chips count the floats');
    // B strikes too early: the fish is gone
    await lvCfg({ cfg: { waitMin: 1300, waitMax: 1700 } });
    await press(B); await until(async () => (await ph(B)) === 'wait', 8000); await B.waitForTimeout(150); await press(B);
    ok(!!(await until(async () => (await ph(B)) === 'idle', 4000)) && /너무 빨랐어요/.test(await B.$eval('#lv-hint', n => n.textContent)), 'live: striking before the bite loses the fish');
    // A: the bite → strike → fight → land
    ok(!!(await until(async () => (await ph(A)) === 'bite', 14000, 50)), 'live: the bite comes');
    const biteUi = await A.evaluate(() => [$('#lv-banner').textContent, $('#lv-mtxt').textContent]);
    await press(A);
    ok(/찌릿!/.test(biteUi[0]) && /챔질!/.test(biteUi[1]), 'live: "찌릿!" and the button says strike');
    await shot(A, 'l05_live_bite');
    ok(!!(await until(async () => (await ph(A)) === 'fight', 6000)), 'live: a good strike hooks the fish');
    ok(await A.evaluate(() => !!LV.k.sp && SPI[LV.k.sp].w !== 'S' && SPI[LV.k.sp].r <= 4 && LV.k.cm > 5), 'live: a freshwater fish of that region, no higher than the class rolled');
    await A.evaluate(() => { window.__bot = setInterval(() => { if (LV.phase !== 'fight' || !LV.f) return; LV.hold = LV.f.T < 60 ? true : LV.f.T > 76 ? false : LV.hold; }, 30); });
    await A.waitForTimeout(900); ok(await A.$eval('#lv-fight', n => !n.hidden && /m|놓으세요|감으세요/.test(n.textContent)), 'live: the fight shows how far the fish is');
    await shot(A, 'l05b_live_fight');
    ok(!!(await until(async () => (await ph(A)) === 'result', 60000)), 'live: reeled in');
    await A.evaluate(() => clearInterval(window.__bot));
    ok(await A.evaluate(() => LV.ang.act === 'result' || LV.ang.act === 'walk'), 'live: the angler holds the fish up');
    const res = await until(() => A.$eval('#lv-res', n => (n.hidden ? '' : n.textContent)), 5000) || '';
    ok(/cm/.test(res) && /15P/.test(res) && /×1\.25/.test(res) && /도감 첫 등록 \+10P/.test(res) && /현장/.test(res) && /1등/.test(res) && /지금 팔기 \+15P/.test(res), 'live: the catch card — size, today\'s price (12 × 1.25), new in the book, on the spot, first on the board');
    await A.waitForTimeout(700); await shot(A, 'l06_live_catch');
    ok(!!(await until(() => B.$$eval('.lv-tick', ns => ns.some(n => /갯바위왕/.test(n.textContent) && /cm/.test(n.textContent))), 8000)), 'live: B\'s ticker tells of A\'s catch');
    ok(!!(await until(() => B.evaluate(u => !LV.others.has(u), aId), 8000)), 'live: and A\'s float is gone from B\'s map');
    const stA = await A.evaluate(() => APP_AUTH.live.state());
    ok(stA.dex.length === 1 && stA.me && stA.me.r === 1 && stA.bal === 10 && stA.day.fish === 1 && stA.feed[0].a === aId && stA.net.length === 1 && stA.net[0].p === 15, 'live: the server kept the fish (in the net), the first-catch points and the board');
    ok(/10/.test(await A.$eval('#lv-wallet', n => n.textContent)) && (await A.$eval('#lv-nb', n => n.textContent)) === '1', 'live: the wallet on the map shows the points, the keepnet button counts one fish');
    // sell it straight from the card
    await A.click('[data-lv="sellnow"]');
    ok(!!(await until(() => A.evaluate(() => $('#lv-res').hidden && LV.st.bal === 25 && LV.st.net.length === 0 && LV.st.day.pts === 15), 5000)), 'live: "sell now" pays today\'s price and empties the net');
    ok(/25/.test(await A.$eval('#lv-wallet', n => n.textContent)) && /15\/80/.test(await A.$eval('#lv-wallet', n => n.textContent)) && await A.$eval('#lv-nb', n => n.hidden), 'live: the wallet shows the sale and what was sold today');
    ok((await dump()).ZPS.wal[aId].bal === 25, 'live: the points are on the server');
    // the book: my fish, the board, how it works
    await A.click('#lv-book'); await A.waitForTimeout(700);
    ok(await A.$$eval('.lv-book .lv-dx.got', ns => ns.length === 1) && /1/.test(await A.$eval('.lv-book .lv-bsum b', n => n.textContent)), 'book: one species caught, the rest are shadows');
    await shot(A, 'l06b_live_book');
    await A.click('[data-lvtab="wk"]'); await A.waitForTimeout(700);
    ok(await A.$$eval('.lv-book .lv-board li.me', ns => ns.length === 1) && /300P/.test(await A.$eval('.lv-book', n => n.textContent)), 'book: the weekly board with me on it and the prizes');
    await A.click('[data-lvtab="how"]'); await A.waitForTimeout(700);
    await A.click('.lv-book .lv-opt .sw'); await A.waitForTimeout(200);
    ok(await A.evaluate(() => LV.anon === true), 'book: "hide my float" can be switched on');
    await closeModals(A);
    // hidden: A casts again and B sees nothing
    await press(A); await until(async () => (await ph(A)) === 'wait', 8000); await B.waitForTimeout(1500);
    ok(await B.evaluate(u => !LV.others.has(u), aId), 'live: a hidden float does not show on other maps');
    await until(async () => (await ph(A)) === 'bite', 8000); await A.waitForTimeout(1500);
    ok(!!(await until(async () => (await ph(A)) === 'idle', 4000)) && /놓쳤어요/.test(await A.$eval('#lv-hint', n => n.textContent)), 'live: a bite left alone is a missed bite');
    // leaving the page takes the angler off the water
    await go(A, 'home', 800); await go(B, 'home', 600);
    ok(/지금 바다에 찌를/.test(await A.$eval('.lt', n => n.textContent)) && !!(await until(() => A.$$eval('.lt-feed li', ns => ns.length >= 1), 5000)), 'home: the door to the live sea shows the latest catch');
    d = await dump();
    ok(!Object.values(d.RT).some(keys => keys.length), 'live: nobody left in the rooms');
    logs.push('  realtime messages sent: ' + d.RTSTATS.sent + ', delivered: ' + d.RTSTATS.delivered);

    /* ---------- the board: my posts, editing a comment, the operator deleting for good ---------- */
    await go(A, 'board', 800); await A.click('#v-board .bd-head [data-bd="write"]'); await A.waitForTimeout(400);
    await A.fill('#pw-title', '감성돔 포인트 질문'); await A.fill('#pw-body', '남해 쪽 갯바위 추천 부탁드려요'); await A.click('#pw-form button[type="submit"]'); await A.waitForTimeout(1200);
    d = await dump();
    const post = (d.T.board[aId].data.posts || []).find(p => p.title === '감성돔 포인트 질문');
    ok(!!post, 'board: A posted');
    const pkey = aId + '|' + post.id;
    await B.evaluate(k => openPost(k), pkey); await B.waitForTimeout(500);
    await B.fill('#pc-body', '거제 쪽 괜찮아요'); await B.click('#pc-form button[type="submit"]'); await B.waitForTimeout(1000);
    d = await dump();
    const cmt = (d.T.board[bId].data.cmts || []).find(c => c.p === pkey);
    ok(!!cmt, 'board: B commented');
    await B.click(`[data-cmtedit="${cmt.id}"]`); await B.waitForTimeout(300);
    ok(!!(await B.$('.cmt-edit-ta')), 'board: editing my comment');
    await B.fill('.cmt-edit-ta', '거제 지세포 쪽 괜찮아요 (수정)'); await B.click('[data-cmteditf] button[type="submit"]'); await B.waitForTimeout(1000);
    d = await dump();
    const cmt2 = d.T.board[bId].data.cmts.find(c => c.id === cmt.id);
    ok(cmt2.body === '거제 지세포 쪽 괜찮아요 (수정)' && cmt2.upd > cmt2.ts, 'board: the comment changed on the server');
    ok(/수정됨/.test(await B.$eval('#post-box', n => n.textContent)), 'board: shown as edited');
    ok(!(await B.$('[data-cmtadel]')) && !(await B.$('#pl-adel')), 'board: members have no operator delete');
    await shot(B, 'l12_cmt_edit');
    await closeModals(B);
    // my posts only
    await go(B, 'board', 600); await B.click('#v-board .bd-head [data-bd="write"]'); await B.waitForTimeout(300); await B.fill('#pw-title', 'B의 조황'); await B.fill('#pw-body', '오늘 꽝이었어요'); await B.click('#pw-form button[type="submit"]'); await B.waitForTimeout(1200);
    await go(A, 'board', 600); await A.click('[data-bdmine]'); await A.waitForTimeout(400);
    const mineTitles = await A.$$eval('#bd-list .bd-title', ns => ns.map(n => n.textContent));
    ok(mineTitles.length === 1 && mineTitles[0] === '감성돔 포인트 질문', 'board: "my posts" shows only mine');
    await A.click('[data-bdmine]'); await A.waitForTimeout(300);
    ok((await A.$$('#bd-list .bd-title')).length >= 2, 'board: everything again');
    // the operator deletes B's comment and A's post for good (two taps each)
    await go(OP, 'board', 600); await OP.evaluate(k => openPost(k), pkey); await OP.waitForTimeout(600);
    const cdel = await OP.$(`[data-cmtadel="${bId}|${cmt.id}"]`);
    ok(!!cdel, 'board: the operator can delete any comment');
    await cdel.click(); await OP.waitForTimeout(200); await cdel.click(); await OP.waitForTimeout(1200);
    d = await dump();
    ok(!d.T.board[bId].data.cmts.some(c => c.id === cmt.id), 'board: the comment is gone from the server');
    ok(!!(d.T.admin_docs.mod && d.T.admin_docs.mod.data.hc[bId + '|' + cmt.id]), 'board: and kept out of sight');
    const pdel = await OP.$('#pl-adel'); await pdel.click(); await OP.waitForTimeout(200); await pdel.click(); await OP.waitForTimeout(1400);
    d = await dump();
    ok(!d.T.board[aId].data.posts.some(p => p.id === post.id), 'board: the post is gone from the server');
    ok(!!(await until(() => A.evaluate(id => !myBoardDoc().posts.some(p => p.id === id), post.id))), 'board: A\'s own copy follows');
    // A saving the board again (a like) does not bring the post back
    await A.evaluate(k => { myBoardDoc().likes.push(k); return store.saveBoard(); }, bId + '|x'); await A.waitForTimeout(800);
    d = await dump();
    ok(!d.T.board[aId].data.posts.some(p => p.id === post.id), 'board: a later save from A keeps it deleted');

    /* ---------- leaving (회원 탈퇴) ---------- */
    // C (no login ID) is A's friend and has said something in the open chat
    await C.evaluate(u => friendAction('req', u), aId); await A.waitForTimeout(1200);
    await until(() => A.evaluate(u => relation(u) === 'in', cId)); await A.evaluate(u => friendAction('acc', u), cId); await A.waitForTimeout(1200);
    await go(C, 'chat', 900); await C.fill('#chat-text', '저 곧 탈퇴해요'); await C.press('#chat-text', 'Enter'); await C.waitForTimeout(900);
    d = await dump();
    ok(!!d.T.anglers[aId].data.fr[cId] && Object.values(d.T.chat).some(r => r.uid === cId), 'leave: C has a friend and a chat message');
    await go(C, 'prefs', 900);
    ok(!!(await C.$('[data-act="withdraw"]')), 'leave: the button is in Settings');
    await C.click('[data-act="withdraw"]'); await C.waitForTimeout(500);
    ok(await C.$eval('#wd-go', n => n.disabled), 'leave: disabled until the word is typed');
    ok(!(await C.$('#wd-pass')), 'leave: no password asked without a login ID');
    await C.fill('#wd-word', '탈퇴'); await C.waitForTimeout(100);
    ok(await C.$eval('#wd-go', n => !n.disabled), 'leave: enabled after typing 탈퇴');
    await shot(C, 'l13_withdraw');
    await C.click('#wd-go');
    await C.waitForTimeout(3600);
    d = await dump();
    ok(!d.T.anglers[cId], 'leave: C\'s profile is gone');
    ok(!Object.values(d.T.chat).some(r => r.uid === cId), 'leave: C\'s chat messages are gone');
    ok(!d.T.anglers[aId].data.fr[cId], 'leave: removed from A\'s friends');
    const cAfter = await C.evaluate(() => ({ me: localStorage.getItem('eosin.me'), uid: S.uid, nick: S.me && S.me.nick }));
    ok(!cAfter.me && !cAfter.nick && cAfter.uid !== cId, 'leave: this device starts over (new visitor, nothing kept)');
    // D has a login ID: the password is asked, a wrong one refused
    const D = await mk('D'); await onboard(D, '아이디있음');
    const dId = await uidOf(D);
    await D.evaluate(() => APP_AUTH.ids.register('dtest01', 'pass1234')); await D.evaluate(() => { S.loginId = undefined; });
    await go(D, 'prefs', 900); await D.click('[data-act="withdraw"]'); await D.waitForTimeout(600);
    ok(!!(await D.$('#wd-pass')), 'leave: the password is asked with a login ID');
    await D.fill('#wd-pass', 'wrongpass'); await D.fill('#wd-word', '탈퇴'); await D.click('#wd-go'); await D.waitForTimeout(900);
    ok(/비밀번호가 맞지 않아요/.test(await D.$eval('#wd-err', n => n.hidden ? '' : n.textContent)), 'leave: a wrong password is refused');
    d = await dump(); ok(!!d.T.anglers[dId], 'leave: nothing removed after a wrong password');
    await D.fill('#wd-pass', 'pass1234'); await D.click('#wd-go'); await D.waitForTimeout(3600);
    d = await dump();
    ok(!d.T.anglers[dId] && !d.logins.includes('dtest01'), 'leave: D and the login ID are gone');
    // the operator can't leave here; an old server says it is not ready yet
    await go(OP, 'prefs', 800); await OP.click('[data-act="withdraw"]'); await OP.waitForTimeout(500);
    await OP.fill('#wd-word', '탈퇴'); await OP.click('#wd-go'); await OP.waitForTimeout(900);
    ok(/운영자 계정/.test(await OP.$eval('#wd-err', n => n.textContent)), 'leave: the operator account is refused');
    await closeModals(OP);
    await feature('wd=0');
    await go(B, 'prefs', 800); await B.click('[data-act="withdraw"]'); await B.waitForTimeout(500);
    await B.fill('#wd-word', '탈퇴'); await B.click('#wd-go'); await B.waitForTimeout(900);
    ok(/준비하는 중/.test(await B.$eval('#wd-err', n => n.textContent)), 'leave: not on the server yet → says so, nothing lost');
    d = await dump(); ok(!!d.T.anglers[bId], 'leave: B is still there');
    await feature('wd=1');
    await closeModals(B);

    /* ---------- a phone ---------- */
    const P = await mk('P', { ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
    await onboard(P, '폰낚시꾼');
    // a phone with no location: far-away casts only, a few a day
    await lvCfg({ cfg: { tier: 2, big: false, u: .4, remote: 2 } });
    await P.evaluate(() => lsSet('liveAt', { lng: 8.53, lat: 47.376 })); // where this phone last looked at the map: in town, a walk from the water
    await P.click('.tabbar a[data-route="live"]'); await P.waitForTimeout(2500);
    ok(await P.evaluate(() => S.route === 'live') && await P.$eval('.tabbar a[data-route="live"]', n => n.classList.contains('on')), 'phone: the live tab');
    await until(() => P.$('#lv-cover [data-lv="go-look"]'), 20000); await P.click('[data-lv="go-look"]');
    ok(!!(await until(() => P.evaluate(() => LV.mode === 'remote' && !!LV.stand), 25000)), 'phone: without location → a far-away cast, standing at the nearest shore');
    ok(await P.$eval('.lv', n => { const r = n.getBoundingClientRect(); return r.width >= 389 && r.height > 600 && r.bottom <= innerHeight - 50; }), 'phone: the map fills the screen above the tab bar');
    ok(/원정 2\/2/.test(await P.$eval('#lv-chips', n => n.textContent)), 'phone: the chip counts the far-away casts');
    await P.waitForTimeout(800); await shot(P, 'l14_phone_live');
    // a real tap on the map: on water it aims
    const pt = await P.evaluate(() => { const t0 = lvAim(), q = LV.map.project([t0.lng, t0.lat]), r = LV.map.getCanvas().getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; });
    await P.touchscreen.tap(pt.x, pt.y); await P.waitForTimeout(500);
    ok(await P.evaluate(() => !!LV.target && LMAP.dist(LV.stand, LV.target) <= 60), 'phone: a tap on the water sets the target');
    await press(P); ok(!!(await until(async () => (await ph(P)) === 'bite', 12000, 60)), 'phone: far-away cast → bite');
    await press(P); await until(async () => (await ph(P)) === 'fight', 6000);
    await P.evaluate(() => { window.__bot = setInterval(() => { if (LV.phase !== 'fight' || !LV.f) return; LV.hold = LV.f.T < 60 ? true : LV.f.T > 76 ? false : LV.hold; }, 30); });
    ok(!!(await until(async () => (await ph(P)) === 'result', 60000)), 'phone: landed');
    const resP = await until(() => P.$eval('#lv-res', n => (n.hidden ? '' : n.textContent)), 5000) || '';
    ok(/3P/.test(resP) && /살림망에 넣고 한 번 더/.test(resP) && !/현장/.test(await P.$eval('.lv-rtags', n => n.textContent)), 'phone: a far-away catch is worth half (2 × 1.25 → 3P)');
    ok(await P.$$eval('#lv-res .lv-rbtn .btn', ns => ns.every(b => { const r = b.getBoundingClientRect(); return r.right <= innerWidth - 8 && b.scrollWidth <= b.clientWidth + 1; })), 'phone: the three buttons fit');
    await P.waitForTimeout(600); await shot(P, 'l14b_phone_catch');
    await P.click('[data-lv="again"]'); await P.waitForTimeout(300);
    // the keepnet: the fish is there with its price; let one go needs two taps; selling pays
    await P.click('#lv-net'); await P.waitForTimeout(700);
    ok(await P.$$eval('.lv-netl li', ns => ns.length === 1 && /3P/.test(ns[0].textContent) && /×1\.25/.test(ns[0].textContent)) && /모두 팔기 \+3P/.test(await P.$eval('.lv-nall', n => n.textContent)), 'net: the fish with today\'s price, and "sell all"');
    ok(await P.$eval('.lv-book .seg', n => n.getBoundingClientRect().height < 60) && await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'net: the four tabs fit on one line on a phone');
    await shot(P, 'l14c_phone_net');
    await P.click('.lv-nfree'); await P.waitForTimeout(200);
    ok(await P.$eval('.lv-nfree', n => n.classList.contains('armed')) && await P.evaluate(() => LV.st.net.length === 1), 'net: "let go" asks once more first');
    await P.click('[data-lvsell]');
    ok(!!(await until(() => P.evaluate(() => LV.st.net.length === 0 && LV.st.bal === 13 && !document.querySelector('.lv-netl') && /비어/.test(document.querySelector('#lv-bbody').textContent)), 5000)), 'net: sold — 10 for the new species + 3, and the net is empty');
    await closeModals(P);
    await press(P); await until(async () => (await ph(P)) === 'wait', 8000); await press(P); await until(async () => (await ph(P)) === 'idle', 5000);
    ok(/원정 0\/2/.test(await P.$eval('#lv-chips', n => n.textContent)), 'phone: two casts used');
    await P.waitForTimeout(2800); await press(P); await P.waitForTimeout(600);
    ok(/다 썼어요/.test(await P.$eval('#lv-hint', n => n.textContent)) && await P.evaluate(() => LV.phase === 'idle'), 'phone: no far-away casts left today — ' + await P.evaluate(() => JSON.stringify([LV.phase, $('#lv-hint').textContent, LV.st.day, document.querySelectorAll('.modal-wrap.in').length])));
    await go(P, 'chat', 1000); await shot(P, 'l15_phone_chat');
    ok(await P.$eval('#chat-text', n => { const r = n.getBoundingClientRect(); return r.bottom < innerHeight - 50; }), 'phone: the chat box sits above the tab bar');
    await P.click('[data-act="more"]'); await P.waitForTimeout(500);
    ok(await P.$$eval('.more a[href="#lures"], .more a[href="#chat"]', ns => ns.length === 2) && !(await P.$('.more a[href="#park"], .more a[href="#games"]')), 'phone: the tackle shop and chat in the menu sheet, no park');
    await shot(P, 'l16_phone_more');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); for (const p of PAGES) { try { await p.screenshot({ path: OUT + 'crash_' + p._name + '.png' }); } catch (x) { } } }
  console.log(logs.join('\n'));
  console.log(`\n${fails.length ? 'FAILED: ' + fails.length : 'ALL PASSED'}`);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})();
