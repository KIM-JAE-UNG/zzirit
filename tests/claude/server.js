const http = require('http'), fs = require('fs'), path = require('path');
const LIB = p => require.resolve(p, { paths: [require('path').join(__dirname, '..')] });
const ROOT = path.resolve(__dirname, '..', '..'), LEAFLET = LIB('leaflet/dist/leaflet.js');
// the Claude page with a fake Claude runtime (storage, AI, downloads) in front of it
function testPage() {
  const html = fs.readFileSync(path.join(ROOT, 'artifact.html'), 'utf8'), mock = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'
    + html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>', '<script>' + mock + '</script>\n<script src="/_leaflet_test.js"></script>') + '</body></html>';
}
const now = Date.now(), H = 3600e3, D = 864e5;
let ver = 1;
const data = {
  'anglers/u_other': { v: 1, nick: 'BusanKing', cc: 'KR', home: 'KS', style: 'float', joined: now - 9e8, catches: [{ id: 'c1', sp: 'kurodai', len: 48, ts: now - D, at: now - D + 4e5, lat: 35.0, lon: 129.0, rg: 'KS', sea: true, st: 'ok', tr: 92, sc: 118 }, { id: 'c2', sp: 'aoriika', len: 38, ts: now - 3 * D, at: now - 3 * D, lat: 34.6, lon: 128.4, rg: 'KS', sea: true, st: 'ok', tr: 88, sc: 61 }], decor: { theme: 'th_sunset', items: ['dc_weed', 'dc_light'], fx: [] }, flair: { gold: true } },
  'anglers/u_jp': { v: 1, nick: 'TokyoBay', cc: 'JP', home: 'JP', style: 'lure', joined: now - 9e8, catches: [{ id: 'c3', sp: 'suzuki', len: 72, ts: now - 2 * D, at: now - 2 * D, lat: 35.4, lon: 139.8, rg: 'JP', sea: true, st: 'ok', tr: 90, sc: 51 }], fr: { u_b: ['r', now - 2 * H] } },
  'anglers/u_c': { v: 1, nick: '제주돌돔', cc: 'KR', home: 'KJ', style: 'float', joined: now - 5e8, catches: [{ id: 'c4', sp: 'ishidai', len: 44, ts: now - 5 * H, at: now - 5 * H, lat: 33.2, lon: 126.5, rg: 'KJ', sea: true, st: 'ok', tr: 91, sc: 140 }], decor: { theme: 'th_reef', items: ['dc_weed', 'dc_coral'], fx: ['fx_rays'] }, fr: { u_a: ['r', now - 30 * 60e3] } }
};
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__db') {
    if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ver, data })); return; }
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { const { path: p, data: d } = JSON.parse(body); if (d == null) delete data[p]; else data[p] = d; ver++; res.setHeader('content-type', 'application/json'); res.end('{}'); });
    return;
  }
  if (u.pathname === '/_test.html') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(testPage()); return; }
  const f = u.pathname === '/_leaflet_test.js' ? LEAFLET : path.join(ROOT, decodeURIComponent(u.pathname));
  fs.readFile(f, (e, buf) => {
    if (e) { res.statusCode = 404; res.end(); return; }
    const ext = path.extname(f).slice(1);
    res.setHeader('content-type', { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', css: 'text/css' }[ext] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(8766, () => console.log('listening 8766'));
