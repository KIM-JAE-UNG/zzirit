const { chromium } = require('playwright'); const fs = require('fs');
const FAKE = fs.readFileSync(__dirname + '/fake-supabase.js', 'utf8'); const LEAF = fs.readFileSync(require.resolve('leaflet/dist/leaflet.js', { paths: [__dirname + '/..'] }), 'utf8');
const OUT = __dirname + '/../out/phone/'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: LEAF }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route('https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/**', r => r.fulfill({ contentType: 'application/json', body: '{"ai":true,"images":true}' }));
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
  const args = process.argv.slice(2);
  await p.goto('http://127.0.0.1:8768/index.html#home'); await p.waitForTimeout(1500);
  if (!(await p.evaluate(() => S.me && S.me.nick))) { await p.click('[data-act="onboard"]'); await p.fill('#pf-nick', '폰테스트'); await p.click('#onb-go'); await p.waitForTimeout(1200); }
  for (const a of args) {
    const [hash, sel, name] = a.split(':');
    await p.evaluate(h => location.hash = h, hash); await p.waitForTimeout(1300);
    if (sel && sel !== '-') { await p.evaluate(s => { const n = document.querySelector(s); if (n) n.scrollIntoView({ block: 'start' }); }, sel); await p.waitForTimeout(700); }
    await p.screenshot({ path: OUT + name + '.png' });
  }
  await b.close();
})();
