const { chromium } = require('playwright');
const OUT = __dirname + '/../out/claude-'; const BASE = 'http://127.0.0.1:8766/_test.html';
const logs = []; const fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: require('fs').readFileSync(require.resolve('qrcode-generator/qrcode.js', { paths: [__dirname + '/..'] }), 'utf8') }));
    const p = await ctx.newPage();
    p.on('pageerror', e => { logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); fails.push('pageerror'); });
    const go = async (h, w = 900) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(w); };
    await p.goto(BASE + '?uid=u_art&owner=1#home'); await p.waitForTimeout(1600);
    ok(await p.evaluate(() => window.APP_RT !== 'web' && S.mode === 'shared'), 'artifact runtime shared mode');
    await p.click('[data-act="onboard"]'); await p.fill('#pf-nick', '아티팩트'); await p.click('#onb-go'); await p.waitForTimeout(1200);
    await go('char', 1000); await p.click('[data-chtab="hs"]'); await p.click('[data-chset="hs|bob"]'); await p.click('#ch-save'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => S.me.char && S.me.char.hs === 'bob'), 'artifact: character saved');
    await go('scan', 900); await p.setInputFiles('#file-pick', __dirname + '/../fixtures/IMG_20261027_071500.jpg'); await p.waitForTimeout(2600);
    if (await p.$('#cf-yes')) { await p.click('#cf-yes'); await p.waitForTimeout(700); }
    await p.fill('#rf-len', '41'); await p.click('#rf-go'); await p.waitForTimeout(1400);
    ok(await p.evaluate(() => (S.me.catches || []).length === 1 && S.me.catches[0].st === 'ok'), 'artifact: AI catch ok (no ticket needed here)');
    // Lens helper inside Claude: the photo is saved through the downloads permission (a plain link does nothing there)
    await p.evaluate(() => { const orig = claude.use; window.__saved = []; claude.use = async n => n === 'downloads' ? { save: async r => { __saved.push(r.filename + ':' + ((r.data && r.data.size) || 0)); return { status: 'saved' }; } } : orig(n); });
    await go('scan', 900); if (!(await p.$('#file-pick'))) { await p.evaluate(() => { if (S.scan) S.scan.phase = 'idle'; renderScanWork(); }); await p.waitForTimeout(300); }
    await p.setInputFiles('#file-pick', __dirname + '/../fixtures/IMG_20261026_160000.jpg', { timeout: 5000 }); await p.waitForTimeout(2600);
    await p.evaluate(() => openLens()); await p.waitForTimeout(1500);
    ok(!!(await p.$('.lens [data-lens-save]')) && !(await p.$('.lens a[download]')), 'artifact: Lens save uses downloads, no plain link');
    await p.click('.lens [data-lens-save]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => __saved.length === 1 && /^zzirit-fish\.jpg:[1-9]/.test(__saved[0])), 'artifact: photo handed to downloads.save');
    await p.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(w => closeModal(w))); await p.waitForTimeout(600);
    // share card inside Claude: the picture is saved through the downloads permission too
    await p.evaluate(() => { const c = S.me.catches[0]; shareCatch(S.uid || 'local', c.id); }); await p.waitForTimeout(2500);
    ok(!!(await p.$('.share-card .sc-img')) && !(await p.$('.share-card a[download]')), 'artifact: share card shown, no plain download link');
    await p.click('#sc-save'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => __saved.length === 2 && /^zzirit-.*cm\.jpg:[1-9]/.test(__saved[1])), 'artifact: share card handed to downloads.save');
    await p.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(w => closeModal(w))); await p.waitForTimeout(600);
    await go('board', 900); await p.click('.bd-head [data-bd="write"]'); await p.waitForTimeout(400);
    await p.fill('#pw-title', '아티팩트 글'); await p.fill('#pw-body', '본문 테스트'); await p.click('#pw-form button[type="submit"]'); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => boardList().length === 1), 'artifact: post saved');
    await go('teams', 800); await p.click('[data-tmedit="new"]'); await p.waitForTimeout(400); await p.fill('#te-name', '아티팀'); await p.fill('#te-tag', 'ART'); await p.click('#te-form button[type="submit"]'); await p.waitForTimeout(1000);
    ok(await p.evaluate(() => teamIndex().ranked.length >= 1), 'artifact: team saved');
    await go('sea', 1500); await p.click('[data-seatab="shop"]'); await p.waitForTimeout(800);
    await p.screenshot({ path: OUT + 'sea.png' });
    await p.click('[data-buy="th_palace"]'); await p.waitForTimeout(700);
    const pm = await p.$('[data-pm="kakao"]'); ok(!!pm, 'artifact: pay modal with KakaoPay');
    await go('home', 1200); ok(!!(await p.$('.news-card')), 'artifact: buzz card'); ok(!(await p.$('[data-newstab="world"]')), 'artifact: no world tab');
    await p.screenshot({ path: OUT + 'home.png', fullPage: true });
    ok(!(await p.$('#wx-card')) && !(await p.$('.inst-tip')), 'artifact: no website-only weather card or install tip');
    ok(await p.$eval('#me-out', n => n.hidden), 'artifact: no log-out button (the Claude account is the sign-in)');
    await p.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(w => closeModal(w))); await p.waitForTimeout(400); // the pay window from above
    await go('sea', 1200); await p.click('[data-seatab="badges"]'); await p.waitForTimeout(500);
    ok(await p.$$eval('.bdg.got', ns => ns.some(n => /첫 조과/.test(n.textContent))), 'artifact: achievements tab works');
    await p.click('.rail-ctl .noti-btn'); await p.waitForTimeout(500);
    ok(!!(await p.$('.noti')), 'artifact: notifications open');
    await p.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(w => closeModal(w))); await p.waitForTimeout(500);
    await go('prefs', 800); ok(await p.$eval('#v-prefs', n => /Claude/.test(n.textContent)), 'artifact: link note mentions Claude account');
    await go('admin', 1000); await p.screenshot({ path: OUT + 'admin.png', fullPage: true });
    for (const r of ['rank', 'friends', 'dex', 'tackle', 'log', 'help', 'about', 'map']) { await go(r, r === 'map' ? 2500 : 700); }
    ok(true, 'artifact: all routes rendered');
  } catch (e) { logs.push('CRASH ' + e.message.split('\n')[0]); fails.push('crash'); }
  console.log(logs.join('\n')); console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED');
  await b.close();
})();
