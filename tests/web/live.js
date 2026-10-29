// Live features with several people at once: the open chat, 1:1 between friends, the park (people, walking, emotes,
// speech bubbles, the fishing game, a duel), the operator's board tools, comment editing and leaving (회원 탈퇴).
// Run with a fresh fake server up (node web/server.js). Screenshots land in tests/out/live/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/live/'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8768/index.html';
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
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
      await ctx.addInitScript(() => { try { localStorage.setItem('eosin.welcomed', '1'); localStorage.setItem('eosin.wn', '"2026-10-29d"'); } catch (e) { } });
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
      p._ctx = ctx; p._name = name;
      return p;
    };
    const go = async (p, h, w = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w); };
    const onboard = async (p, nick) => { await go(p, 'home'); await p.click('[data-act="onboard"]:visible'); await p.waitForTimeout(400); await p.fill('#pf-nick', nick); await p.selectOption('#pf-home', 'KS'); if (await p.$('#onb-noid')) await p.click('#onb-noid'); else await p.click('#onb-go'); await p.waitForTimeout(1500); };
    const shot = (p, n, full) => p.screenshot({ path: OUT + n + '.png', fullPage: !!full });
    const closeModals = async p => { for (let i = 0; i < 5; i++) { const xs = await p.$$('.modal-wrap.in .modal-x'); if (!xs.length) break; await xs[xs.length - 1].click(); await p.waitForTimeout(320); } };
    const toasts = p => p.$$eval('.toast', ns => ns.map(n => n.textContent).join(' | '));
    const uidOf = p => p.evaluate(() => S.uid);

    /* ---------- people ---------- */
    const A = await mk('A'); await onboard(A, '갯바위왕');
    const B = await mk('B'); await onboard(B, '감성돔러버');
    const OP = await mk('OP'); await onboard(OP, '관리테스트');
    await go(OP, 'claim', 600); await OP.fill('#cl-code', 'testcode1234abcd'); await OP.click('#cl-go'); await OP.waitForTimeout(2400); await closeModals(OP);
    ok(await OP.evaluate(() => S.isOwner), 'operator signed in');
    const aId = await uidOf(A), bId = await uidOf(B), opId = await uidOf(OP);
    ok(!!aId && !!bId && aId !== bId, 'two separate accounts');
    // the menu has the park and the chat (in the community group)
    ok(await A.$eval('.nav a[data-route="park"]', n => !n.hidden && n.offsetParent !== null).catch(() => false) || await A.$eval('.nav a[data-route="park"]', n => !n.hidden), 'park in the menu');
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

    /* ---------- the park ---------- */
    await go(A, 'park', 1800); await go(B, 'park', 1800);
    ok(!!(await until(() => A.$(`[data-pkwho="${bId}"]`))), 'park: A sees B in the list');
    ok(!!(await until(() => B.$(`[data-pkwho="${aId}"]`))), 'park: B sees A');
    ok(/1번 공원 · 2명/.test(await A.$eval('#pk-status', n => n.textContent)), 'park: who is here');
    await A.waitForTimeout(600); await shot(A, 'l04_park_A');
    // at night (Korean time): the lamps, the fire and the lighthouse light up
    await A.evaluate(() => { window._kst = pkKst; pkKst = () => ({ h: 21.5, m: 9 }); }); await A.waitForTimeout(500); await shot(A, 'l04b_park_night');
    await A.evaluate(() => { pkKst = window._kst; });
    // walking: one tap, the others see the walk
    await A.evaluate(() => pkWalk(980, 720));
    ok(!!(await until(() => B.evaluate(u => { const p = PKS.people.get(u); return p && Math.abs(p.gx - 980) < 3 && Math.abs(p.gy - 720) < 3; }, aId))), 'park: B sees A walking to the spot A tapped');
    await A.waitForTimeout(1600);
    ok(await A.evaluate(() => !PKS.me.moving && Math.abs(PKS.me.x - 980) < 3), 'park: A arrived');
    // the sea stops a walk
    const stop = await A.evaluate(() => pkReach(800, 900, 800, 100));
    ok(stop[1] > 420 && stop[1] < 470, 'park: walking stops at the water\'s edge');
    // the way to the lighthouse goes round by the boardwalk, never over the water; a tap on the sea walks to the shore
    const way = await A.evaluate(() => { const pts = [[800, 790], ...pkPath(800, 790, 1260, 180)]; let dry = true; for (let i = 1; i < pts.length; i++) if (!pkClear(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])) dry = false; return { dry, n: pts.length, end: pts[pts.length - 1] }; });
    ok(way.dry && way.n >= 3 && Math.hypot(way.end[0] - 1260, way.end[1] - 180) < 2, 'park: a dry way round to the lighthouse — ' + JSON.stringify(way));
    const sea = await A.evaluate(() => { const pts = pkPath(800, 790, 700, 200); const e = pts[pts.length - 1]; return { land: pkIn(e[0], e[1]), y: e[1] }; });
    ok(sea.land && sea.y > 400, 'park: tapping the sea walks to the shore');
    // emote and a speech bubble from the open chat
    await A.evaluate(() => pkEmote(0));
    ok(!!(await until(() => B.evaluate(u => { const p = PKS.people.get(u); return p && p.emote && p.emote.e === '👋'; }, aId))), 'park: B sees A wave');
    await A.fill('#pk-text', '공원 분위기 좋네요'); await A.press('#pk-text', 'Enter');
    ok(!!(await until(() => B.evaluate(u => { const p = PKS.people.get(u); return p && p.bubble && p.bubble.txt === '공원 분위기 좋네요'; }, aId))), 'park: what A says shows over A\'s head for B');
    ok(!!(await until(() => B.$$eval('#pk-log li', ns => ns.some(n => n.textContent.includes('공원 분위기 좋네요'))))), 'park: and in the chat lines');
    await B.waitForTimeout(400); await shot(B, 'l05_park_bubble');
    // the fishing game at a spot (made easy for the test: a quick bite, no pulls, a small fish)
    await A.evaluate(() => pkWalk(900, 456));
    ok(!!(await until(() => A.$('#pk-act [data-pk="fish"]'), 6000)), 'park: at a spot, "fish here" appears');
    await A.click('#pk-act [data-pk="fish"]'); await A.waitForTimeout(300);
    ok(await A.$eval('#pk-game', n => !n.hidden), 'game: the panel opens');
    ok(!!(await until(() => B.evaluate(u => { const p = PKS.people.get(u); return p && p.act === 'fish'; }, aId))), 'game: B sees A fishing');
    await A.click('#pkg-btn'); await A.waitForTimeout(150);
    ok(await A.evaluate(() => PKS.game.phase === 'wait'), 'game: cast, waiting for a bite');
    await A.evaluate(() => Object.assign(PKS.game.f, { wait: .3, nibs: [], win: 3, pulls: [], q: .2 }));
    ok(!!(await until(() => A.evaluate(() => PKS.game.phase === 'bite'), 3000, 50)), 'game: the float dives (bite)');
    await shot(A, 'l06_bite');
    const bb = await A.$eval('#pkg-btn', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await A.mouse.move(bb.x, bb.y); await A.mouse.down();
    ok(!!(await until(() => A.evaluate(() => PKS.game.phase === 'fight'), 1500, 30)), 'game: strike, the fight starts');
    await A.waitForTimeout(800); await shot(A, 'l07_fight');
    ok(!!(await until(() => A.evaluate(() => PKS.game.phase === 'got'), 7000, 50)), 'game: reeled in');
    await A.mouse.up();
    ok(await A.evaluate(() => PKS.stats.n === 1 && !!PKS.best && SPI[PKS.best.sp].w !== 'F'), 'game: counted, a sea fish, a park best');
    await shot(A, 'l08_got');
    await A.click('.pkg-x'); await A.waitForTimeout(300);
    ok(await A.$eval('#pk-game', n => n.hidden), 'game: closed');
    // a duel (shortened for the test)
    await A.evaluate(() => { PK.DUEL = 5000; }); await B.evaluate(() => { PK.DUEL = 5000; });
    await A.evaluate(u => pkCard(u), bId); await A.waitForTimeout(400);
    ok(!!(await A.$('[data-pkc="duel"]:not([disabled])')), 'duel: the card offers a duel');
    ok(!!(await A.$('[data-pkc="dm"]')), 'duel: and a 1:1 message (they are friends)');
    await A.click('[data-pkc="duel"]'); await A.waitForTimeout(300);
    ok(!!(await until(() => B.$('[data-pkd="yes"]'))), 'duel: B is asked');
    await shot(B, 'l09_duel_ask');
    await B.click('[data-pkd="yes"]');
    ok(!!(await until(() => A.$('#pk-game.mode-duel:not([hidden])'))), 'duel: A\'s game opens');
    ok(!!(await until(() => B.$('#pk-game.mode-duel:not([hidden])'))), 'duel: B\'s game opens');
    ok(await A.evaluate(() => PKS.game.seed) === await B.evaluate(() => PKS.game.seed), 'duel: the same sea for both (same seed)');
    ok(!!(await until(() => B.evaluate(u => { const p = PKS.people.get(u); return p && p.act === 'duel'; }, aId))), 'duel: others see ⚔️');
    // A catches one during the duel
    await until(() => A.evaluate(() => PKS.duel && PKS.duel.state === 'play'), 4500, 50);
    await A.evaluate(() => Object.assign(PKS.game.f, { wait: .2, nibs: [], win: 3, pulls: [], q: .2 }));
    await until(() => A.evaluate(() => PKS.game.phase === 'bite'), 2000, 40);
    const db = await A.$eval('#pkg-btn', n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await A.mouse.move(db.x, db.y); await A.mouse.down();
    await until(() => A.evaluate(() => PKS.game && (PKS.game.phase === 'got' || PKS.game.phase === 'over')), 5000, 40); await A.mouse.up();
    await shot(A, 'l10_duel');
    ok(!!(await until(() => A.$('.pk-result'), 12000)), 'duel: A gets the result');
    ok(!!(await until(() => B.$('.pk-result'), 8000)), 'duel: B gets the result');
    await shot(A, 'l11_result');
    const sa = await A.evaluate(() => PKS.stats), sb = await B.evaluate(() => PKS.stats);
    ok(sa.w === 1 && sb.l === 1, 'duel: A won (caught one), B lost — ' + JSON.stringify([sa, sb]));
    await closeModals(A); await closeModals(B);
    // leaving the park: the others see it, and the park records are saved to the profile
    await go(A, 'home', 900);
    ok(!!(await until(() => B.evaluate(u => !PKS.people.has(u), aId), 6000)), 'park: B sees A leave');
    d = await dump();
    ok(d.T.anglers[aId].data.park && d.T.anglers[aId].data.park.st.n >= 1 && d.T.anglers[aId].data.park.st.w === 1, 'park: A\'s park records saved');
    await go(B, 'home', 600);
    d = await dump();
    ok(!Object.values(d.RT).some(keys => keys.length), 'park: nobody left in the rooms');
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
    await go(P, 'park', 1800); await shot(P, 'l14_phone_park');
    ok(await P.$eval('#pk-cv', n => { const r = n.getBoundingClientRect(); return r.width > 300 && r.height > 280; }), 'phone: the park fills the screen');
    await P.tap('#pk-cv', { position: { x: 200, y: 160 } }); await P.waitForTimeout(400);
    ok(await P.evaluate(() => PKS.me.moving || Math.hypot(PKS.me.tx - PKS.me.x, PKS.me.ty - PKS.me.y) > 1 || !!PKS.tapAt), 'phone: a tap walks');
    await go(P, 'chat', 1000); await shot(P, 'l15_phone_chat');
    ok(await P.$eval('#chat-text', n => { const r = n.getBoundingClientRect(); return r.bottom < innerHeight - 50; }), 'phone: the chat box sits above the tab bar');
    await P.click('[data-act="more"]'); await P.waitForTimeout(500);
    ok(await P.$$eval('.more a[href="#park"], .more a[href="#chat"]', ns => ns.length === 2), 'phone: park and chat in the menu sheet');
    await shot(P, 'l16_phone_more');
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  console.log(logs.join('\n'));
  console.log(`\n${fails.length ? 'FAILED: ' + fails.length : 'ALL PASSED'}`);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})();
