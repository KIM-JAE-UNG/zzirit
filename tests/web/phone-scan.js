// Registering a catch on a phone, step by step, the way people tap through it (iPhone size, touch, iPhone browser name).
// Run with the fake server up (node web/server.js). Screenshots land in tests/out/phone-scan/.
const { chromium } = require('playwright'); const fs = require('fs');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8');
const LEAF = fs.readFileSync(LIB('leaflet/dist/leaflet.js'), 'utf8');
const QRLIB = fs.readFileSync(LIB('qrcode-generator/qrcode.js'), 'utf8');
const OUT = __dirname + '/../out/phone-scan/'; fs.mkdirSync(OUT, { recursive: true });
const PHOTO = __dirname + '/../fixtures/IMG_20261027_071500.jpg';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const AI_FISH = { fish_visible: true, candidates: [{ id: 'kurodai', p: .81 }, { id: 'mejina', p: .1 }], other_en: '', other_sci: '', length_cm: 41, screening: { real_photo: .94 }, verdict: 'pass', reasons: [], features: '검은 배지느러미' };
const logs = [], fails = []; const ok = (c, m) => { logs.push((c ? '✓ ' : '✗ ') + m); if (!c) fails.push(m); };
// is the element really the thing a finger lands on (not covered by a bar or another layer), and inside the screen?
const reachable = (p, sel) => p.evaluate(s => {
  const n = document.querySelector(s); if (!n) return 'missing';
  const r = n.getBoundingClientRect(); if (!r.width || !r.height) return 'no size';
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return 'off screen y=' + Math.round(y);
  const top = document.elementFromPoint(x, y); return top && (top === n || n.contains(top)) ? 'ok' : 'covered by ' + (top ? (top.className || top.tagName) : 'nothing');
}, sel);
(async () => {
  const b = await chromium.launch();
  const mk = async (name, opts = {}) => {
    const ctx = await b.newContext({ userAgent: IOS, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    if (!opts.welcome) await ctx.addInitScript(() => { try { localStorage.setItem('eosin.welcomed', '1'); } catch (e) { } });
    await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator**', r => r.fulfill({ contentType: 'text/javascript', body: QRLIB }));
    await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|open-meteo\.com/, r => r.abort());
    await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', async r => {
      const req = r.request(); const body = JSON.parse(req.postData() || '{}');
      if (/\/review$|\/news$|\/push$/.test(req.url())) return r.fulfill({ contentType: 'application/json', body: '{}' });
      if (body.mode === 'status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ai: true, images: true, provider: 'gemini' }) });
      if (body.mode === 'json') { await new Promise(x => setTimeout(x, 400)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: '{}', value: AI_FISH, ticket: 'ticket-' + Math.random().toString(36).slice(2) }) }); }
      return r.fulfill({ contentType: 'application/json', body: '{"text":"ok"}' });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => { logs.push(name + ' PAGEERROR: ' + e.message); fails.push(name + ' pageerror ' + e.message); });
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push(name + ' console.error: ' + m.text().slice(0, 200)); });
    await p.goto('http://127.0.0.1:8768/index.html#home'); await p.waitForTimeout(1800);
    return p;
  };
  const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });
  const dump = async () => (await fetch('http://127.0.0.1:8768/__sb/dump')).json();
  try {
    /* 1. someone with a profile: photo → "is it this fish?" → length → register */
    const A = await mk('A');
    await A.locator('[data-act="onboard"]:visible').first().tap(); await A.waitForTimeout(500);
    await A.fill('#pf-nick', '폰낚시'); if (await A.$('#onb-noid')) await A.locator('#onb-noid').tap(); else await A.locator('#onb-go').tap();
    await A.waitForTimeout(1500);
    const uid = await A.evaluate(() => S.uid);
    await A.evaluate(() => { location.hash = 'scan'; }); await A.waitForTimeout(1000);
    await shot(A, '01_scan');
    ok(await reachable(A, 'label[for="file-cam"]') === 'ok', 'camera button reachable: ' + await reachable(A, 'label[for="file-cam"]'));
    await A.setInputFiles('#file-cam', PHOTO); await A.waitForTimeout(3000);
    await shot(A, '02_after_photo');
    logs.push('  phase=' + await A.evaluate(() => S.scan.phase));
    ok(!!(await A.$('#cf-yes')), 'confirm dialog opened');
    ok(await reachable(A, '#cf-yes') === 'ok', '"yes" reachable: ' + await reachable(A, '#cf-yes'));
    await A.locator('#cf-yes').tap(); await A.waitForTimeout(900);
    await shot(A, '03_form');
    ok(!!(await A.$('#rf-len')), 'form shown');
    logs.push('  focused=' + await A.evaluate(() => document.activeElement && document.activeElement.id));
    await A.locator('#rf-len').tap(); await A.fill('#rf-len', '38');
    await A.evaluate(() => { const b = document.querySelector('#rf-go'); b.scrollIntoView({ block: 'center' }); }); await A.waitForTimeout(300);
    await shot(A, '04_submit');
    ok(await reachable(A, '#rf-go') === 'ok', 'register button reachable: ' + await reachable(A, '#rf-go'));
    await A.locator('#rf-go').tap(); await A.waitForTimeout(2000);
    await shot(A, '05_done');
    const d = await dump(); const cs = (d.T.anglers[uid] && d.T.anglers[uid].data.catches) || [];
    ok(cs.length === 1, 'catch saved: ' + JSON.stringify(cs.map(c => ({ sp: c.sp, len: c.len, st: c.st }))));
    logs.push('  phase=' + await A.evaluate(() => S.scan.phase) + ' err=' + await A.evaluate(() => { const e = document.querySelector('#rf-err'); return e && !e.hidden ? e.textContent : ''; }));

    /* 2. a new phone without a profile: the sign-up dialog comes up in the middle; after it the form must still be there */
    const B = await mk('B');
    await B.evaluate(() => { location.hash = 'scan'; }); await B.waitForTimeout(1000);
    await B.setInputFiles('#file-cam', PHOTO); await B.waitForTimeout(3000);
    ok(!!(await B.$('#cf-yes')), 'B: confirm dialog');
    await B.locator('#cf-yes').tap(); await B.waitForTimeout(1200);
    await shot(B, '11_signup_mid_scan');
    logs.push('  B dialog: ' + await B.evaluate(() => { const m = [...document.querySelectorAll('.modal-wrap.in')].pop(); return m ? m.innerText.slice(0, 120).replace(/\s+/g, ' ') : 'none'; }));
    const hasNoId = !!(await B.$('#onb-noid'));
    await B.fill('#pf-nick', '새폰'); if (hasNoId) await B.locator('#onb-noid').tap(); else await B.locator('#onb-go').tap();
    await B.waitForTimeout(1500);
    await shot(B, '12_after_signup');
    ok(!!(await B.$('#rf-len')), 'B: after signing up the register form is there');

    /* 3. the operator's case: a new phone, photo first, then "log in with my ID" in the middle (the page reloads to switch
          accounts), then the photo again on the logged-in phone */
    const P = await mk('P'); // the operator's PC: profile + ID + operator rights
    await P.locator('[data-act="onboard"]:visible').first().tap(); await P.waitForTimeout(500);
    await P.fill('#pf-nick', '재웅PC'); if (await P.$('#onb-noid')) await P.locator('#onb-noid').tap(); else await P.locator('#onb-go').tap();
    await P.waitForTimeout(1200);
    const pUid = await P.evaluate(() => S.uid);
    ok((await P.evaluate(() => window.APP_AUTH.ids.register('opsid', 'secret12'))).ok === true, 'operator ID made');
    await fetch('http://127.0.0.1:8768/__sb/rpc', { method: 'POST', body: JSON.stringify({ uid: pUid, name: 'claim_admin', args: { code: 'TESTCODE1234ABCD' } }) });
    const C = await mk('C');
    await C.evaluate(() => { location.hash = 'scan'; }); await C.waitForTimeout(1000);
    await C.setInputFiles('#file-cam', __dirname + '/../fixtures/IMG_20261025_090000.jpg'); await C.waitForTimeout(3000); // a photo nobody has registered
    await C.locator('#cf-yes').tap(); await C.waitForTimeout(1200);
    await C.locator('[data-atab="login"]').tap(); await C.waitForTimeout(300);
    await C.fill('#idl-name', 'opsid'); await C.fill('#idl-pass', 'secret12'); await C.locator('#idl-go').tap();
    await C.waitForTimeout(3500);
    await shot(C, '21_after_login');
    logs.push('  C after login: hash=' + await C.evaluate(() => location.hash) + ' uid=' + (await C.evaluate(() => S.uid) === pUid ? 'operator' : 'other') + ' admin=' + await C.evaluate(() => S.isOwner) + ' phase=' + await C.evaluate(() => S.scan && S.scan.phase)
      + ' ai=' + await C.evaluate(() => !!S.sample + '/' + S.sampleImages) + ' me=' + await C.evaluate(() => S.me && S.me.nick) + ' mode=' + await C.evaluate(() => S.mode) + ' hasRow=' + await C.evaluate(() => S.anglers.has(S.uid)) + ' loaded=' + await C.evaluate(() => S.anglersLoaded)
      + ' modal=' + await C.evaluate(() => { const m = [...document.querySelectorAll('.modal-wrap.in')].pop(); return m ? m.innerText.slice(0, 50).replace(/\s+/g, ' ') : 'none'; }));
    ok(!!(await C.$('#rf-len')), 'C: after logging in, the registration carries on (form shown)');
    ok((await C.$$eval('.toast', ns => ns.map(n => n.textContent).join('|'))).includes('이어서'), 'C: told it carries on');
    const submit = async (len, name) => {
      await C.fill('#rf-len', len); await C.evaluate(() => document.querySelector('#rf-go').scrollIntoView({ block: 'center' })); await C.waitForTimeout(300);
      ok(await reachable(C, '#rf-go') === 'ok', 'C: register reachable (' + name + ')');
      await C.locator('#rf-go').tap(); await C.waitForTimeout(2200);
      logs.push('  C ' + name + ': phase=' + await C.evaluate(() => S.scan.phase) + ' err=' + await C.evaluate(() => { const e = document.querySelector('#rf-err'); return e && !e.hidden ? e.textContent : ''; }));
    };
    if (await C.$('#rf-len')) await submit('31', 'resumed');
    await shot(C, '22_done_resumed');
    let d2 = await dump(); let cs2 = (d2.T.anglers[pUid] && d2.T.anglers[pUid].data.catches) || [];
    ok(cs2.length === 1 && cs2[0].st === 'ok' && !!cs2[0].tk, 'C: resumed catch saved on the operator account with the AI proof: ' + JSON.stringify(cs2.map(c => ({ sp: c.sp, len: c.len, st: c.st, tk: !!c.tk }))));
    // and a second fish on the logged-in phone (this is where it used to stop: "yes" did nothing)
    await C.evaluate(() => { S.scan.phase = 'idle'; location.hash = 'scan'; renderScanWork(); }); await C.waitForTimeout(800);
    await C.setInputFiles('#file-cam', __dirname + '/../fixtures/IMG_20261026_160000.jpg'); await C.waitForTimeout(3500);
    ok(!!(await C.$('#cf-yes')), 'C: confirm dialog for the next fish');
    if (await C.$('#cf-yes')) { await C.locator('#cf-yes').tap(); await C.waitForTimeout(1200); }
    await shot(C, '23_form_next');
    ok(!!(await C.$('#rf-len')), 'C: register form for the next fish');
    if (await C.$('#rf-len')) await submit('27', 'next');
    d2 = await dump(); cs2 = (d2.T.anglers[pUid] && d2.T.anglers[pUid].data.catches) || [];
    ok(cs2.length === 2, 'C: second catch saved: ' + cs2.length);
    const lb = d2.T.labels[pUid]; ok(!!lb && (lb.data.items || []).length >= 1, 'C: teaching note saved on the account: ' + (lb ? (lb.data.items || []).length : 0));
  } catch (e) { logs.push('CRASH ' + (e.stack || e)); fails.push('crash'); }
  await b.close();
  console.log(logs.join('\n')); console.log(fails.length ? `FAILED (${fails.length})` : 'ALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
