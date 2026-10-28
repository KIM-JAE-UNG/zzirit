const { chromium } = require('playwright');
const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const OUT = __dirname + '/../out/web/'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8768/index.html';
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const PHOTOS = ['IMG_20261020_063000.jpg', 'IMG_20261027_071500.jpg', 'IMG_20261026_160000.jpg', 'IMG_20261025_090000.jpg', 'IMG_20261024_120000.jpg'].map(f => __dirname + '/../fixtures/' + f);
let photoN = 0;
const logs = []; const fails = [];
const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
let AIMODE = 'fish';
const AI_FISH = { fish_visible: true, candidates: [{ id: 'kurodai', p: .81 }, { id: 'mejina', p: .1 }], other_en: '', other_sci: '', length_cm: 41, screening: { real_photo: .94, screenshot: 0, ai_generated: .02, stock_or_web: .03, market_or_aquarium: .03, edited: .04 }, verdict: 'pass', reasons: ['실제 촬영 사진'], features: '검은 배지느러미' };
const AI_NOFISH = { fish_visible: false, candidates: [], other_en: '', other_sci: '', length_cm: null, screening: { real_photo: .9 }, verdict: 'reject', reasons: ['물고기가 없음'], features: '' };
(async () => {
  const b = await chromium.launch();
  try {
  const mk = async (name, opts = {}) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' }, opts.ctx || {}));
    // the first-visit sign-up dialog is tested on its own; everywhere else it would get in the way
    if (!opts.welcome) await ctx.addInitScript(() => { try { localStorage.setItem('eosin.welcomed', '1'); } catch (e) { } });
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
    await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/review', async r => { const j = await (await fetch('http://127.0.0.1:8768/__fn/review', { method: 'POST' })).json(); r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/news', async r => { const j = await (await fetch('http://127.0.0.1:8768/__fn/news', { method: 'POST' })).json(); r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/ai', async r => {
      const req = r.request(); const body = JSON.parse(req.postData() || '{}');
      if (!/^Bearer tok-/.test(req.headers()['authorization'] || '')) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"not_granted"}}' });
      const on = !opts.aiOff;
      if (body.mode === 'status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ai: on, images: on, provider: on ? 'gemini' : null }) });
      if (!on) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"ai_not_configured"}}' });
      if (body.mode === 'json') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: '{}', value: AIMODE === 'nofish' ? AI_NOFISH : AI_FISH, ticket: 'ticket-' + Math.random().toString(36).slice(2) }) });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: '• 테스트 답변', truncated: false, modelApplied: 'gemini-3.5-flash-lite' }) });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => { logs.push(name + ' PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); fails.push(name + ' pageerror ' + e.message); });
    p.on('console', m => { if (m.type() === 'error') logs.push(name + ' console.error: ' + m.text().slice(0, 220)); });
    await p.goto(BASE + '#home'); await p.waitForTimeout(1600);
    p._ctx = ctx;
    return p;
  };
  const dump = async () => (await fetch('http://127.0.0.1:8768/__sb/dump')).json();
  const toasts = p => p.$$eval('.toast', ns => ns.map(n => n.textContent));
  const go = async (p, h, w = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w); };
  const onboard = async (p, nick) => { await go(p, 'home'); await p.click('[data-act="onboard"]:visible'); await p.waitForTimeout(400); await p.fill('#pf-nick', nick); await p.selectOption('#pf-home', 'KS'); if (await p.$('#onb-noid')) await p.click('#onb-noid'); else await p.click('#onb-go'); await p.waitForTimeout(1500); };
  const shot = (p, n, full) => p.screenshot({ path: OUT + n + '.png', fullPage: !!full });
  const closeModals = async p => { for (let i = 0; i < 5; i++) { const xs = await p.$$('.modal-wrap.in .modal-x'); if (!xs.length) break; await xs[xs.length - 1].click(); await p.waitForTimeout(320); } };
  const scan = async (p, mode = 'scan') => { await closeModals(p); await go(p, mode, 900); if (!(await p.$('#file-pick'))) { await p.evaluate(() => { if (S.scan) S.scan.phase = 'idle'; renderScanWork(); }); await p.waitForTimeout(300); } if (!(await p.$('#file-pick'))) { logs.push('scan page html: ' + (await p.$eval('#v-scan', n => n.innerText.slice(0, 300)).catch(() => '?'))); } await p.setInputFiles('#file-pick', PHOTOS[photoN++ % PHOTOS.length], { timeout: 5000 }); await p.waitForTimeout(2600); };

  /* ---------- A: profile, character, AI scan ---------- */
  const A = await mk('A');
  ok(await A.evaluate(() => window.APP_RT === 'web' && S.mode === 'shared'), 'A web runtime, shared mode');
  await onboard(A, '부산감성돔');
  const aId = await A.evaluate(() => S.uid);
  await go(A, 'char', 1200); await shot(A, 'a01_char');
  await A.click('[data-chtab="hs"]'); await A.click('[data-chset="hs|long"]'); await A.click('[data-chtab="ht"]'); await A.click('[data-chset="ht|bucket"]');
  ok((await A.$$('[data-chset^="ht|"][disabled]')).length > 0, 'locked hats shown');
  await shot(A, 'a01b_char_hats');
  await A.click('[data-chtab="ou"]'); await A.click('[data-chset="ou|tee"]');
  await A.click('#ch-save'); await A.waitForTimeout(1200);
  let d = await dump();
  ok(d.T.anglers[aId].data.char && d.T.anglers[aId].data.char.hs === 'long' && d.T.anglers[aId].data.av === 'char', 'character saved to db');
  await shot(A, 'a02_char_saved');
  // AI scan (fish)
  AIMODE = 'fish'; await scan(A);
  ok(!!(await A.$('#cf-yes')), 'confirm modal after AI result');
  ok(!!(await A.$('.confirm .beta-note')), 'confirm shows "may be wrong" note');
  await shot(A, 'a03_confirm');
  await A.click('#cf-yes'); await A.waitForTimeout(800);
  await A.evaluate(() => { S.scan.lon = 128.9; S.scan.lat = 35.05; });
  await A.fill('#rf-len', '42'); await A.click('#rf-go'); await A.waitForTimeout(1800);
  await shot(A, 'a04_done');
  d = await dump();
  const ac = d.T.anglers[aId].data.catches[0];
  ok(ac && ac.st === 'ok' && ac.tk, 'AI catch ok with ticket: ' + JSON.stringify(ac && { st: ac.st, tk: !!ac.tk }));
  ok(await A.$eval('.done-score', n => /XP/.test(n.textContent)), 'done screen shows XP');
  // AI says no fish
  AIMODE = 'nofish'; await scan(A);
  ok(await A.$eval('#scan-work h2', n => n.textContent).then(t => /물고기/.test(t)), 'no-fish screen shown');
  await shot(A, 'a05_nofish');
  await A.click('[data-act="scan-manual"]'); await A.waitForTimeout(700);
  ok(!!(await A.$('.trainer [data-lens]')), 'picker offers Google Lens');
  await shot(A, 'a06_picker');
  await A.click('.trainer [data-pick="madai"]'); await A.waitForTimeout(800);
  await A.fill('#rf-len', '50'); await A.click('#rf-go'); await A.waitForTimeout(1600);
  logs.push('  nofish phase=' + await A.evaluate(() => S.scan.phase) + ' trust=' + await A.evaluate(() => S.scan.trust && S.scan.trust.score) + ' dup=' + await A.evaluate(() => !!S.scan.dup) + ' toasts=' + (await toasts(A)).join('|'));
  d = await dump(); const an = d.T.anglers[aId].data.catches[1];
  ok(an && an.st === 'review', 'no-fish catch goes to review: ' + (an && an.st));
  // past catch is free: no paywall, registers
  AIMODE = 'fish'; await scan(A, 'past');
  ok(!(await A.$('.paywall')), 'no paywall for past catches');
  if (await A.$('#cf-yes')) { await A.click('#cf-yes'); await A.waitForTimeout(700); }
  if (await A.$('#rf-len')) { await A.fill('#rf-len', '35'); await A.click('#rf-go'); await A.waitForTimeout(1600); }
  logs.push('  past phase=' + await A.evaluate(() => S.scan.phase) + ' trust=' + await A.evaluate(() => S.scan.trust && S.scan.trust.score) + ' dup=' + await A.evaluate(() => !!S.scan.dup));
  d = await dump(); ok(d.T.anglers[aId].data.catches.length === 3, 'past catch registered free (3 catches): ' + d.T.anglers[aId].data.catches.length);

  /* ---------- free mode (AI off) ---------- */
  const F = await mk('F', { aiOff: true });
  await onboard(F, '무료모드');
  await scan(F);
  ok(!!(await F.$('.trainer')), 'free mode opens the picker');
  ok(await F.$eval('.trainer', n => /많이 잡히는/.test(n.textContent)), 'free mode shows regional suggestions');
  await shot(F, 'f01_free_picker');
  await F.click('.trainer [data-lens]'); await F.waitForTimeout(2400);
  ok(!!(await F.$('.lens')), 'Lens helper opens (desktop)');
  ok(!!(await F.$('.lens #ln-step1 a[download]')), 'Lens helper offers a save link (web)');
  await shot(F, 'f02_lens');
  await closeModals(F);
  await F.click('[data-act="scan-manual"]'); await F.waitForTimeout(600);
  await F.click('.trainer .tr-row'); await F.waitForTimeout(700);
  ok(await F.$eval('#reg-form', n => /AI가 몇 분 안에/.test(n.textContent)), 'free mode form explains the automatic check');
  await F.fill('#rf-len', '30'); await F.click('#rf-go'); await F.waitForTimeout(1500);
  d = await dump(); const fId = await F.evaluate(() => S.uid);
  ok(d.T.anglers[fId].data.catches[0].st === 'review', 'free mode catch is review');
  await go(F, 'scan', 800); await shot(F, 'f03_scan_free');

  /* ---------- board ---------- */
  await go(A, 'board', 1000); await shot(A, 'b01_board_empty');
  await A.click('.bd-head [data-bd="write"]'); await A.waitForTimeout(500);
  await A.click('label.chip-tab:has(input[value="catch"])');
  await A.fill('#pw-title', '오늘 다대포 감성돔 42cm!'); await A.fill('#pw-body', '새벽 물때 맞춰서 크릴 미끼로 잡았어요.\n손맛 최고였습니다.');
  const refOpt = await A.$$eval('#pw-ref option', os => os.map(o => o.value).filter(Boolean)); if (refOpt[0]) await A.selectOption('#pw-ref', refOpt[0]);
  await shot(A, 'b02_write');
  await A.click('#pw-form button[type="submit"]'); await A.waitForTimeout(1400);
  d = await dump(); ok(d.T.board[aId] && d.T.board[aId].data.posts.length === 1, 'post saved');
  await shot(A, 'b03_board_list');
  /* B joins */
  const B = await mk('B');
  await onboard(B, '여수바다');
  const bId = await B.evaluate(() => S.uid);
  await go(B, 'board', 1300);
  ok((await B.$$('.bd-card')).length === 1, 'B sees the post');
  await B.click('.bd-card'); await B.waitForTimeout(700);
  await B.click('#pl-like'); await B.waitForTimeout(700);
  await B.fill('#pc-body', '와 대박이네요! 어디 포인트인가요?'); await B.click('#pc-form button'); await B.waitForTimeout(1200);
  await shot(B, 'b04_post_modal');
  await B.click('#pl-rep'); await B.click('#pl-rep'); await B.waitForTimeout(900);
  await closeModals(B);
  await A.waitForTimeout(1500);
  const pk = aId + '|' + d.T.board[aId].data.posts[0].id;
  ok(await A.evaluate(k => { const p = boardIndex().posts.get(k); return p && p.likes.size === 1 && p.cmts.length === 1 && p.reps === 1; }, pk), 'A sees like, comment, report');
  await go(A, 'home', 1200); await shot(A, 'b05_home', true);
  ok((await A.$$('.home-board .hb-item')).length === 1, 'home shows hot post');

  /* ---------- teams ---------- */
  await go(A, 'teams', 900); await shot(A, 't01_teams_none');
  await A.click('[data-tmedit="new"]'); await A.waitForTimeout(500);
  await A.fill('#te-name', '부산조사단'); await A.fill('#te-tag', 'bsn'); await A.click('#te-form button[type="submit"]'); await A.waitForTimeout(1300);
  d = await dump(); ok(d.T.teams[aId] && d.T.teams[aId].data.tag === 'BSN', 'team created');
  await go(B, 'teams', 1400);
  await B.click(`[data-tmjoin="${aId}"]`); await B.waitForTimeout(1300);
  await A.waitForTimeout(1500);
  ok(await A.evaluate(id => teamIndex().teams.get(id).members.length === 2, aId), 'B joined A team');
  await go(A, 'teams', 900); await shot(A, 't02_teams_mine', true);
  await go(A, 'rank', 900); await A.click('[data-scope="TEAM"]'); await A.waitForTimeout(500); await shot(A, 't03_rank_team');

  /* ---------- decorate: locked item, premium purchase, cancel ---------- */
  await go(A, 'sea', 1500); await shot(A, 'd01_sea');
  ok(await A.evaluate(() => !!S.scene && !!S.scene.charImg), 'scene has the character');
  await A.click('[data-seatab="shop"]'); await A.waitForTimeout(800);
  await shot(A, 'd02_decorate', true);
  const lockedTheme = await A.evaluate(() => SHOP.find(s => s.lv && s.lv > myLevel()).id);
  await A.evaluate(id => toggleItem(id), lockedTheme); await A.waitForTimeout(400);
  ok(await A.evaluate(id => S.me.decor.theme !== id && !(S.me.decor.items || []).includes(id), lockedTheme), 'locked item not applied');
  await A.click('[data-buy="pr_gold"]'); await A.waitForTimeout(800);
  ok(await A.$eval('#pay-done', n => n.disabled), '"I sent it" disabled before opening KakaoPay');
  await shot(A, 'd03_pay');
  await A._ctx.route('https://qr.kakaopay.com/**', r => r.fulfill({ contentType: 'text/html', body: '<p>kakaopay</p>' }));
  const [pop] = await Promise.all([A.waitForEvent('popup').catch(() => null), A.click('[data-pm="kakao"]')]);
  if (pop) await pop.close();
  await A.waitForTimeout(1600);
  ok(await A.$eval('#pay-done', n => !n.disabled), '"I sent it" enabled after opening KakaoPay');
  await A.click('#pay-done'); await A.waitForTimeout(1500);
  d = await dump();
  ok(d.T.orders[aId] && d.T.orders[aId].data.items.some(o => o.ref === 'pr_gold'), 'order recorded');
  ok(!(d.T.anglers[aId].data.flair && d.T.anglers[aId].data.flair.gold) && !(d.T.anglers[aId].data.decor.items || []).includes('dc_goldboat'), '"I sent it" alone applies nothing');
  await go(A, 'sea', 1200); await A.click('[data-seatab="shop"]'); await A.waitForTimeout(600);
  ok(!!(await A.$('.prem-item .chip-wait')) && !(await A.$('[data-buy="pr_gold"]')), 'shop shows "waiting for payment check", no second buy button');
  await shot(A, 'd03b_waiting');
  await A.evaluate(() => buyItem('pr_gold')); await A.waitForTimeout(500);
  ok(!(await A.$('#pay-done')), 'a second order for the same item is blocked while one waits');
  // the operator finds the money and confirms → the item goes on by itself
  const oidOk = d.T.orders[aId].data.items.find(o => o.ref === 'pr_gold').id;
  await fetch('http://127.0.0.1:8768/__sb/grant', { method: 'POST', body: JSON.stringify({ uid: aId, oid: oidOk, v: 'ok' }) });
  await A.waitForTimeout(3500);
  d = await dump();
  ok(d.T.anglers[aId].data.flair && d.T.anglers[aId].data.flair.gold === true && d.T.anglers[aId].data.decor.items.includes('dc_goldboat'), 'confirmed gold set applied and kept by server');
  ok((await toasts(A)).some(x => /확인됐어요/.test(x)), 'buyer told the payment was confirmed');
  await go(A, 'sea', 1200); await shot(A, 'd04_sea_gold');
  // operator cancels → looks removed after reload
  const oid = d.T.orders[aId].data.items.find(o => o.ref === 'pr_gold').id;
  await fetch('http://127.0.0.1:8768/__sb/grant', { method: 'POST', body: JSON.stringify({ uid: aId, oid, v: 'no' }) });
  await A.reload(); await A.waitForTimeout(2600);
  d = await dump();
  ok(!d.T.anglers[aId].data.flair.gold && !(d.T.anglers[aId].data.decor.items || []).includes('dc_goldboat'), 'cancelled premium removed');

  /* ---------- login ID: A makes one, a new device G signs in with it ---------- */
  await go(A, 'prefs', 1200);
  await A.click('#id-card [data-id="create"]'); await A.waitForTimeout(400);
  ok(!!(await A.$('.auth #au-id')) && !(await A.$('.auth #pf-nick')), 'adding an ID keeps the profile (no nickname form)');
  await A.fill('#au-id', 'busan_ann'); await A.fill('#au-pw', 'pw1234'); await A.fill('#au-pw2', 'pw1234');
  await A.click('#onb-go'); await A.waitForTimeout(1500);
  ok(await A.$eval('#id-card', n => /busan_ann/.test(n.textContent)), 'ID created and shown in settings');
  await shot(A, 'i01_id_card');
  const G = await mk('G');
  await G.evaluate(() => lsSet('wn', WHATS_NEW)); // this device signs in to an existing account: skip the update notes here
  await go(G, 'home'); await G.click('[data-act="onboard"]:visible'); await G.waitForTimeout(300);
  ok(!!(await G.$('.auth [data-atab="login"]')), 'first-run dialog has a login tab');
  await G.click('.auth [data-atab="login"]'); await G.waitForTimeout(400);
  await G.fill('#idl-name', 'busan_ann'); await G.fill('#idl-pass', 'wrong1'); await G.click('#idl-go'); await G.waitForTimeout(800);
  ok(await G.$eval('#idl-err', n => !n.hidden && n.textContent.length > 3), 'wrong password refused');
  await shot(G, 'i02_login');
  await G.fill('#idl-pass', 'pw1234'); await G.click('#idl-go'); await G.waitForTimeout(3500);
  ok(await G.evaluate(id => S.uid === id, aId), 'new device signed in with the ID uses A account');

  /* ---------- device link: A makes a code, D redeems ---------- */
  await go(A, 'prefs', 900);
  await A.click('[data-link="make"]'); await A.waitForTimeout(1200);
  const code = await A.$eval('.link-code [data-copy]', n => n.dataset.copy);
  ok(/^[A-Z2-9]{8}$/.test(code), 'link code shown ' + code);
  await shot(A, 'l01_code');
  await closeModals(A);
  const D = await mk('D', { ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
  await D.evaluate(() => lsSet('wn', WHATS_NEW));
  await D.goto(BASE + '#link=' + code); await D.waitForTimeout(1800);
  ok(!!(await D.$('#lk-code')), 'link prompt opens from QR url');
  await shot(D, 'l02_phone_prompt');
  await D.click('#lk-go'); await D.waitForTimeout(3500);
  ok(await D.evaluate(id => S.uid === id, aId), 'phone now uses A account');
  ok(await D.evaluate(() => (S.me && S.me.catches || []).length) === 3, 'phone sees A catches');
  await go(D, 'home', 1200); await shot(D, 'm01_home', true);
  await go(D, 'sea', 1500); await shot(D, 'm02_sea', true);
  await go(D, 'char', 1000); await shot(D, 'm03_char', true);
  await go(D, 'board', 1000); await shot(D, 'm04_board', true);
  await go(D, 'teams', 1000); await shot(D, 'm05_teams', true);
  await go(D, 'scan', 1000); await shot(D, 'm06_scan', true);
  await go(D, 'prefs', 1000); await shot(D, 'm07_prefs', true);
  ok(await D.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'phone: no horizontal overflow');
  await D.click('[data-act="more"]'); await D.waitForTimeout(500); await shot(D, 'm08_more');
  await closeModals(D); await go(D, 'about', 1200); await shot(D, 'm09_about', true);
  ok(await D.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'phone: brand page fits the screen');

  /* ---------- news ---------- */
  await A.waitForTimeout(500);
  await go(A, 'home', 2500);
  ok((await A.$$('.news-card .hl-item')).length > 0, 'ZZIRIT flash shows community highlights');
  await A.click('[data-newstab="world"]'); await A.waitForTimeout(600);
  ok((await A.$$('.news-card .news-item')).length > 0, 'world news shows headlines');
  await shot(A, 'n01_news');
  // admin view
  await go(A, 'claim', 600); await A.fill('#cl-code', 'testcode1234abcd'); await A.click('#cl-go'); await A.waitForTimeout(2800);
  await go(A, 'admin', 1200); await shot(A, 'x01_admin', true);
  ok(await A.$$eval('.ad-reports li', ns => ns.length) >= 1, 'admin sees reported post');
  ok(await A.$$eval('.admin .catch-card', ns => ns.length) >= 1, 'admin sees the catch the reviewer put on hold');
  ok(await A.$$eval('.ad-users li', ns => ns.length) >= 3, 'admin sees the user list');
  const fDel = await A.$('[data-deluser="' + fId + '"]');
  ok(!!fDel, 'delete button for a user');
  if (fDel) { await fDel.click(); await A.waitForTimeout(300); await fDel.click(); await A.waitForTimeout(1800); }
  d = await dump(); ok(!d.T.anglers[fId], 'operator deleted the account');
  // brand page + logo
  await go(A, 'about', 1200); await shot(A, 'b01_about', true);
  ok(await A.$eval('.ab-hero img', n => n.complete && n.naturalWidth > 100), 'brand page shows the logo');
  ok(await A.$eval('.brand .logo', n => n.tagName === 'IMG' && n.naturalWidth > 32), 'header uses the new logo');

  /* ---------- 2026-10-28b: level tags, notice, share card, what's new, sanity checks, photo cache ---------- */
  await go(B, 'board', 1200);
  ok((await B.$$('.bd-card .lv-mini')).length > 0, 'board shows level tags next to names');
  await go(A, 'rank', 1200);
  ok((await A.$$('.lb-who .lv-mini')).length > 0, 'ranking shows level tags');
  // operator notice
  await go(A, 'admin', 1200);
  await A.fill('#ad-notice', '오늘 밤 10시부터 30분 동안 점검해요.'); await A.click('#ad-notice-go'); await A.waitForTimeout(1500);
  d = await dump();
  ok(d.T.admin_docs.config && d.T.admin_docs.config.data.notice && /점검/.test(d.T.admin_docs.config.data.notice.t), 'notice saved in admin config');
  ok(d.T.admin_docs.config.data.kakaoUrl === undefined || typeof d.T.admin_docs.config.data.kakaoUrl === 'string', 'notice keeps payment settings');
  await go(B, 'home', 1500);
  ok(await B.$eval('.notice-bar', n => /점검/.test(n.textContent)).catch(() => false), 'home shows the operator notice');
  await shot(B, 'q01_notice');
  await B.click('.notice-x'); await B.waitForTimeout(400);
  ok(!(await B.$('.notice-bar')), 'notice closes');
  await B.reload(); await B.waitForTimeout(2500); await go(B, 'home', 1000);
  ok(!(await B.$('.notice-bar')), 'closed notice stays closed after reload');
  await go(B, 'board', 1000);
  ok(!!(await B.$('.bd-notice')), 'board pins the notice');
  await go(A, 'admin', 1000); await A.fill('#ad-notice', '새 공지: 주말 이벤트!'); await A.click('#ad-notice-go'); await A.waitForTimeout(1500);
  await go(B, 'home', 1500);
  ok(await B.$eval('.notice-bar', n => /주말/.test(n.textContent)).catch(() => false), 'a new notice shows again');
  // share card (computer: picture with a save button)
  await go(A, 'log', 1200);
  await A.click('.catch-card'); await A.waitForTimeout(800);
  await A.click('.cd [data-share]'); await A.waitForTimeout(2500);
  ok(await A.$eval('.share-card .sc-img', n => n.complete && n.naturalWidth === 1080 && n.naturalHeight === 1350).catch(() => false), 'share card picture made (1080x1350)');
  ok(!!(await A.$('.share-card a[download]')), 'share card offers a download (web)');
  await shot(A, 'q02_share');
  await closeModals(A);
  // share card (phone: system share sheet with the picture). A fresh phone: the linked phone above lost its touch emulation after the app reloaded.
  const M = await mk('M', { ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
  await M.evaluate(() => lsSet('wn', WHATS_NEW));
  await onboard(M, '폰자랑');
  await M.evaluate(async () => {
    const c = { id: 'shr1', sp: 'kurodai', len: 41.5, ts: Date.now() - 3600e3, at: Date.now(), st: 'review', tr: 60 };
    S.me.catches.push(c); await store.saveMe();
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const g = cv.getContext('2d'); g.fillStyle = '#3a6b8a'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#ddd'; g.fillRect(80, 100, 160, 40);
    await store.savePhoto('shr1', { t: cv.toDataURL('image/jpeg', .8), h: 'x' });
    window.__shared = null; navigator.canShare = () => true;
    navigator.share = async x => { window.__shared = { n: x.files.length, type: x.files[0].type, size: x.files[0].size, text: x.text }; };
  });
  await go(M, 'log', 1200); await M.click('.catch-card'); await M.waitForTimeout(800);
  await M.click('.cd [data-share]'); await M.waitForTimeout(2500);
  const shared = await M.evaluate(() => window.__shared);
  ok(shared && shared.n === 1 && shared.type === 'image/jpeg' && shared.size > 20000 && /github\.io/.test(shared.text), 'phone shares the card through the share sheet: ' + JSON.stringify(shared));
  await closeModals(M);
  // dex: two columns on a phone
  await go(D, 'dex', 1200);
  ok(await D.$eval('.sp-grid', n => getComputedStyle(n).gridTemplateColumns.split(' ').length) === 2, 'dex shows two columns on a phone');
  await shot(D, 'q03_dex_phone');
  // typed-in fish names and impossible lengths
  AIMODE = 'nofish'; await scan(B);
  await B.click('[data-act="scan-manual"]'); await B.waitForTimeout(700);
  await B.click('.tr-other summary'); await B.fill('#tr-other', 'x'); await B.click('#tr-other-ok'); await B.waitForTimeout(400);
  ok((await toasts(B)).some(x => /2~30자/.test(x)) && !!(await B.$('.trainer')), 'one-letter fish name refused');
  await B.fill('#tr-other', '레전드아구몬'); await B.click('#tr-other-ok'); await B.waitForTimeout(900);
  await B.fill('#rf-len', '450'); await B.click('#rf-go'); await B.waitForTimeout(500);
  ok(await B.$eval('#rf-err', n => !n.hidden && /300cm/.test(n.textContent)), 'typed-in fish over 3 m refused');
  await B.fill('#rf-len', '40'); await B.click('#rf-go'); await B.waitForTimeout(1500);
  d = await dump(); const bc = (d.T.anglers[bId].data.catches || []).find(c => c.sp === 'other:레전드아구몬');
  ok(bc && bc.st === 'review', 'typed-in fish at a normal length goes to review');
  AIMODE = 'fish';
  // reserved nicknames
  await go(B, 'prefs', 1000);
  await B.fill('#pf-nick', '찌릿 운영자'); await B.click('#pf-save'); await B.waitForTimeout(800);
  d = await dump();
  ok(d.T.anglers[bId].data.nick === '여수바다' && (await toasts(B)).some(x => /쓸 수 없어요/.test(x)), 'nickname that looks like the operator refused');
  // log only: a catch whose photo never arrived
  await B.evaluate(async () => { const c = { id: 'nophoto1', sp: 'kurodai', len: 33, ts: Date.now() - 864e5, at: Date.now() - 864e5, st: 'review', tr: 50, past: true }; S.me.catches.push(c); await store.saveMe(); });
  await B.waitForTimeout(800);
  await fetch('http://127.0.0.1:8768/__fn/review', { method: 'POST' }); await B.waitForTimeout(2500);
  await go(B, 'log', 1200);
  ok(await B.$eval('[data-catch$="|nophoto1"] .chip', n => /기록만/.test(n.textContent)).catch(() => false), 'catch without a photo shows "log only", not rejected');
  // what's new: someone who joined before the update sees it once
  const W = await mk('W');
  await onboard(W, '예전회원');
  ok(!(await W.$('.wn')), 'a brand-new member does not get the update notes');
  await W.evaluate(async () => { S.me.joined = WN_TS - 864e5; await store.saveMe(); lsSet('wn', ''); });
  await W.waitForTimeout(600); await W.reload(); await W.waitForTimeout(5500);
  ok(!!(await W.$('.wn')), 'an earlier member sees what changed');
  ok(!!(await W.$('#wn-id')), 'update notes offer to create a login ID');
  await shot(W, 'q04_whatsnew');
  await W.click('#wn-ok'); await W.waitForTimeout(400); await W.reload(); await W.waitForTimeout(5000);
  ok(!(await W.$('.wn')), 'update notes show only once');
  // photo cache: a second visit doesn't download the same photos again
  const P = await mk('P');
  await go(P, 'home', 1500); await P.evaluate(() => { const f = document.querySelector('.feed'); if (f) f.scrollIntoView(); }); await P.waitForTimeout(2000);
  const ph1 = (await dump()).STATS.photoSelects;
  await P.reload(); await P.waitForTimeout(2500); await go(P, 'home', 1500); await P.evaluate(() => { const f = document.querySelector('.feed'); if (f) f.scrollIntoView(); }); await P.waitForTimeout(2000);
  const ph2 = (await dump()).STATS.photoSelects;
  const feedImgs = await P.$$eval('.feed .feed-ph img', ns => ns.filter(n => /^data:image\/(jpeg|webp|png)/.test(n.src) && n.naturalWidth > 0).length);
  ok(ph2 === ph1 && feedImgs > 0, `photos come from this device on the second visit (requests ${ph1} → ${ph2}, shown ${feedImgs})`);

  /* ---------- 2026-10-29: sign-up / login dialog, account card, lost sessions, operator help, fishing points ---------- */
  // first visit: the sign-up dialog opens by itself
  const N = await mk('N', { welcome: true });
  await N.waitForTimeout(3800);
  ok(!!(await N.$('.auth #au-id')) && !!(await N.$('.auth [data-atab="login"]')), 'first visit shows sign-up (with ID) and a login tab');
  await shot(N, 'r01_signup');
  const nId = await N.evaluate(() => S.uid);
  await N.fill('#pf-nick', '새회원'); await N.fill('#au-id', 'ab'); await N.fill('#au-pw', 'pw1234'); await N.fill('#au-pw2', 'pw1234');
  await N.click('#onb-go'); await N.waitForTimeout(700);
  ok(await N.$eval('#au-err', n => !n.hidden && /3~20/.test(n.textContent)), 'a too-short ID is explained');
  d = await dump(); ok(!d.T.anglers[nId], 'nothing saved while the form has a mistake');
  await N.fill('#au-id', 'new_member'); await N.fill('#au-pw2', 'different'); await N.click('#onb-go'); await N.waitForTimeout(700);
  ok(await N.$eval('#au-err', n => /비밀번호 확인/.test(n.textContent)), 'different passwords explained');
  await N.fill('#au-pw2', 'pw1234'); await N.click('#onb-go'); await N.waitForTimeout(1600);
  d = await dump(); ok(d.T.anglers[nId] && d.T.anglers[nId].data.nick === '새회원', 'profile saved');
  ok(await N.evaluate(() => S.loginId === 'new_member'), 'ID made in the same step');
  await N.reload(); await N.waitForTimeout(3800);
  ok(!(await N.$('.auth')), 'the sign-up dialog does not come back');
  await go(N, 'prefs', 1300);
  ok(await N.$eval('.prefs .card', n => n.id === 'id-card'), 'settings start with the account');
  ok(await N.$eval('#id-card', n => /new_member/.test(n.textContent) && /조과 0개/.test(n.textContent)), 'account card shows the ID and what is stored');
  await shot(N, 'r02_account');
  // log in on another device: what that device recorded joins the account
  const N2 = await mk('N2');
  await N2.evaluate(() => lsSet('wn', WHATS_NEW));
  await onboard(N2, '폰기기');
  await N2.evaluate(async () => { S.me.catches.push({ id: 'n2c1', sp: 'mejina', len: 31, ts: Date.now() - 3600e3, at: Date.now(), st: 'review', tr: 50 }); await store.saveMe(); });
  await go(N2, 'prefs', 1300);
  ok(await N2.$eval('#id-card .acct-state', n => /아이디가 없어요/.test(n.textContent)), 'without an ID the card says the account lives only in this browser');
  await N2.click('#id-card [data-id="login"]'); await N2.waitForTimeout(500);
  ok(await N2.$eval('.auth [data-atab="login"]', n => n.getAttribute('aria-pressed') === 'true'), 'login tab opens from settings');
  ok(await N2.$eval('.auth [data-pane="login"] .note', n => /1/.test(n.textContent)).catch(() => false), 'login says this device\'s catch will join the account');
  await N2.fill('#idl-name', 'new_member'); await N2.fill('#idl-pass', 'pw1234'); await N2.click('#idl-go'); await N2.waitForTimeout(3800);
  ok(await N2.evaluate(id => S.uid === id, nId), 'logged in: the same account as the first device');
  d = await dump(); ok(d.T.anglers[nId].data.catches.some(c => c.id === 'n2c1'), 'the other device\'s catch joined the account');
  // a dropped sign-in (a server hiccup during a token refresh) comes back instead of a new empty account
  await N.evaluate(() => { localStorage.removeItem('eosin.auth'); }); await N.reload(); await N.waitForTimeout(3200);
  ok(await N.evaluate(id => S.uid === id && !!S.me && S.me.nick === '새회원', nId), 'a dropped session is restored from the saved copy');
  // logging out really logs out
  await go(N, 'prefs', 1200); await N.click('#id-card [data-id="logout"]'); await N.waitForTimeout(300); await N.click('#id-card [data-id="logout"]'); await N.waitForTimeout(3000);
  ok(await N.evaluate(id => S.uid !== id && !(S.me && S.me.nick), nId), 'logout starts fresh (the saved copy is not reused)');

  // operator: IDs in the user list, a recovery code, deleting
  await go(A, 'admin', 1500); await A.evaluate(() => { S.adm.at = 0; adminLoad(); }); await A.waitForTimeout(1000);
  ok(await A.$$eval('.ad-users .chip-id', ns => ns.some(n => /new_member/.test(n.textContent))), 'operator sees login IDs next to users');
  const relinkBtn = await A.$(`[data-relink="${nId}"]`); ok(!!relinkBtn, 'recovery code button for a user');
  await relinkBtn.click(); await A.waitForTimeout(900);
  const rcode = await A.$eval('.relink .link-code b', n => n.textContent.replace('-', '')).catch(() => '');
  ok(/^[A-Z2-9]{8}$/.test(rcode), 'recovery code shown: ' + rcode);
  ok(await A.$eval('.relink textarea', (n, c) => n.value.includes(c.slice(0, 4)), rcode), 'a ready-to-send message includes the code');
  await shot(A, 'r03_relink');
  await closeModals(A);
  const R = await mk('R'); await R.evaluate(() => lsSet('wn', WHATS_NEW));
  await R.goto(BASE + '#link=' + rcode); await R.waitForTimeout(1800);
  await R.click('#lk-go'); await R.waitForTimeout(3800);
  ok(await R.evaluate(id => S.uid === id, nId), 'the recovery code brought someone back to their account');
  // before the server update: a clear note instead of the old misleading "operator account" message
  await fetch('http://127.0.0.1:8768/__sb/feature?del=0');
  await A.evaluate(() => { S.adm.at = 0; S.adm.canDelete = undefined; }); await go(A, 'home', 400); await go(A, 'admin', 2000);
  ok(await A.$$eval('.admin .note', ns => ns.some(n => /서버 업데이트/.test(n.textContent))), 'admin page says deleting needs the server update');
  const anyDel = await A.$('[data-deluser]'); ok(!!anyDel && await anyDel.isDisabled(), 'delete buttons wait for the update');
  await A.evaluate(id => adminDeleteUser(id), bId); await A.waitForTimeout(700);
  const tz = await toasts(A); ok(tz.some(x => /서버 업데이트/.test(x)) && !tz.some(x => /운영자 계정은 삭제할 수 없어요/.test(x)), 'a missing server function is explained as such');
  await fetch('http://127.0.0.1:8768/__sb/feature?del=1');
  // after the update: another operator account can be deleted (the one in use can't)
  await go(W, 'claim', 600); await W.fill('#cl-code', 'testcode1234abcd'); await W.click('#cl-go'); await W.waitForTimeout(2600);
  const wId = await W.evaluate(() => S.uid);
  await A.evaluate(() => { S.adm.at = 0; S.adm.canDelete = undefined; }); await go(A, 'home', 400); await go(A, 'admin', 2000);
  const wDel = await A.$(`[data-deluser="${wId}"]`); ok(!!wDel && !(await wDel.isDisabled()), 'deleting is available after the update');
  if (wDel) { await wDel.click(); await A.waitForTimeout(300); await wDel.click(); await A.waitForTimeout(2000); }
  d = await dump(); ok(!d.T.anglers[wId] && !d.admins.includes(wId), 'another operator account deleted, with its operator rights');
  ok(!(await A.$(`[data-deluser="${aId}"]`)), 'no delete button for the account in use');

  // fishing points
  await N2.evaluate(() => openPointEdit(null, { lat: 35.0465, lon: 128.9654, sp: ['kurodai'] })); await N2.waitForTimeout(600);
  await N2.fill('#pt-name', '다대포 방파제 끝'); await N2.fill('#pt-memo', '들물 때 좋아요. 주차는 공영주차장.'); await N2.click('#pt-go'); await N2.waitForTimeout(1600);
  d = await dump(); const pPriv = Object.values(d.T.points).find(x => x.data.name === '다대포 방파제 끝');
  ok(pPriv && pPriv.owner === nId && pPriv.pub === false && pPriv.data.sp[0] === 'kurodai', 'point saved privately, owned by the account');
  ok(await N2.evaluate(() => S.route === 'points' && document.querySelectorAll('.pt-card').length === 1), 'point listed under my points');
  await N2.evaluate(() => openPointEdit(null, { lat: 35.1532, lon: 129.1189, sp: [] })); await N2.waitForTimeout(600);
  await N2.fill('#pt-name', '광안리 백사장'); await N2.selectOption('#pt-kind', 'beach'); await N2.fill('#pt-sp', '보리멸, 고등어'); await N2.click('label.switch:has(#pt-pub)'); await N2.waitForTimeout(200);
  ok(!(await N2.$eval('#pt-pub-note', n => n.hidden)), 'sharing shows the exact-location warning');
  await N2.click('#pt-go'); await N2.waitForTimeout(1600);
  d = await dump(); const pPub = Object.values(d.T.points).find(x => x.data.name === '광안리 백사장');
  ok(pPub && pPub.pub === true && pPub.data.sp.join() === 'shirogisu,saba', 'shared point saved, species names turned into ids: ' + JSON.stringify(pPub && pPub.data.sp));
  await shot(N2, 'r04_points');
  await go(B, 'points', 1300); await B.click('[data-pttab="shared"]'); await B.waitForTimeout(600);
  ok(await B.$$eval('.pt-card', ns => ns.length === 1 && /광안리/.test(ns[0].textContent)), 'others see the shared point');
  ok(!(await B.evaluate(() => [...S.points.values()].some(p => p.name === '다대포 방파제 끝'))), 'a private point never reaches others');
  await B.click('.pt-card'); await B.waitForTimeout(500);
  ok(!!(await B.$('.pt-detail')) && !(await B.$('#pt-edit')) && !(await B.$('#pt-del')), 'others can read it but not edit or delete it');
  await shot(B, 'r05_point_detail');
  await closeModals(B);
  await go(B, 'map', 2600);
  ok((await B.$$('.pt-mark')).length >= 1, 'the shared point is on the map');
  await go(A, 'log', 1200); await A.click('.catch-card'); await A.waitForTimeout(700);
  ok(!!(await A.$('#cd-pt')), 'a catch with a spot can be saved as a point');
  await closeModals(A);
  await go(A, 'points', 1300); await A.click('[data-pttab="shared"]'); await A.waitForTimeout(500); await A.click('.pt-card'); await A.waitForTimeout(500);
  ok(!!(await A.$('#pt-hide')), 'the operator can hide a shared point');
  await A.click('#pt-hide'); await A.waitForTimeout(1500);
  await go(B, 'points', 1300);
  ok(!(await B.evaluate(() => [...S.points.values()].some(p => p.name === '광안리 백사장' && ptVisible(p)))), 'a hidden point disappears for others');
  await go(N2, 'points', 1200); await N2.click('.pt-card'); await N2.waitForTimeout(500);
  await N2.click('#pt-del'); await N2.waitForTimeout(200); await N2.click('#pt-del'); await N2.waitForTimeout(1500);
  d = await dump(); ok(Object.values(d.T.points).filter(x => x.owner === nId).length === 1, 'the owner deletes a point');
  // dark mode + english
  const E = await mk('E', { ctx: { colorScheme: 'dark', locale: 'en-US' } });
  await E.evaluate(() => { setLang('en'); rerender(); }); await onboard(E, 'Reeler');
  await go(E, 'board', 1200); await shot(E, 'e01_board_dark');
  await go(E, 'char', 1000); await shot(E, 'e02_char_dark');
  await go(E, 'sea', 1500); await E.click('[data-seatab="shop"]'); await E.waitForTimeout(800); await shot(E, 'e03_decor_dark', true);

  } catch (e) { logs.push('CRASH: ' + e.message.split('\n')[0]); fails.push('crash'); }
  console.log(logs.join('\n'));
  console.log(`\n${fails.length ? 'FAILED: ' + fails.length : 'ALL PASSED'}`);
  await b.close();
})();
