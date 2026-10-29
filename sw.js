/* 찌릿 ZZIRIT service worker.
   Lets the website be installed as an app and still open without a connection.
   The page always comes from the network first, so an update shows up right away; the last good copy is used only
   when the network fails. Nothing else (data, photos, maps, sign-in) passes through here.
   It also shows the phone notifications the server sends, and opens the right screen when one is tapped. */
const CACHE = 'zzirit-page-v1';
const SCOPE = new URL(self.registration.scope);
const PAGE = SCOPE.href; // the app's one page ("./" and "./index.html" are the same page)
const OFFLINE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>찌릿 ZZIRIT</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070C16;color:#e8eef7;font:16px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;text-align:center;padding:24px}h1{font-size:20px;margin:0 0 8px}button{margin-top:18px;padding:10px 22px;border-radius:999px;border:0;background:#2f8cff;color:#fff;font:inherit;cursor:pointer}</style></head>
<body><main><h1>인터넷 연결이 없어요</h1><p>연결되면 다시 열어 주세요.<br>No connection. Please try again once you are back online.</p><button onclick="location.reload()">다시 시도 · Retry</button></main></body></html>`;

const isPage = u => u.origin === SCOPE.origin && (u.pathname === SCOPE.pathname || u.pathname === SCOPE.pathname + 'index.html');

self.addEventListener('install', e => {
  self.skipWaiting();
  // keep a copy from the start, so the very next launch works offline too
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGE, { cache: 'no-cache' }))).catch(() => { }));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('zzirit-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.mode !== 'navigate' || r.method !== 'GET') return; // everything else goes to the network exactly as before
  const page = isPage(new URL(r.url));
  e.respondWith((async () => {
    try {
      const res = await fetch(r);
      if (page && res.ok && res.type === 'basic') { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(PAGE, copy)).catch(() => { })); }
      return res;
    } catch (err) {
      const hit = page ? await caches.match(PAGE) : null;
      return hit || new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
  })());
});

/* Phone notifications: the server sends { t: title, b: text, u: "#screen", tag } (encrypted for this browser only). */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { b: e.data ? e.data.text() : '' }; }
  const title = String(d.t || '찌릿 ZZIRIT').slice(0, 60);
  e.waitUntil(self.registration.showNotification(title, {
    body: String(d.b || '새 소식이 있어요').slice(0, 200),
    icon: new URL('icon-192.png', SCOPE).href,
    tag: d.tag ? String(d.tag).slice(0, 60) : undefined,
    renotify: !!d.tag,
    data: { u: /^#[a-z]+$/.test(d.u || '') ? d.u : '#home' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.u) || '#home';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find(c => c.url.startsWith(SCOPE.href));
    if (open) { await open.focus(); open.postMessage({ go: hash }); return; }
    await self.clients.openWindow(SCOPE.href + hash);
  })());
});
