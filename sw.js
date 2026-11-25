/* 찌릿 ZZIRIT service worker.
   Lets the website be installed as an app and still open without a connection.
   The page always comes from the network first, so an update shows up right away; the last good copy is used only
   when the network fails. Nothing else (data, photos, maps, sign-in) passes through here.
   It also keeps a copy of the few libraries the page loads from other sites (the sign-in library, the map library,
   the fonts), so the next launch does not wait for them and the app still opens with no connection. Those addresses
   carry a version number, so a kept copy never goes stale; the font list is checked again whenever there is a connection.
   It also shows the phone notifications the server sends, and opens the right screen when one is tapped. */
const CACHE = 'zzirit-page-v1';
const LIBS = 'zzirit-lib-v1';
const KEEP = [CACHE, LIBS];
// versioned files that never change at the same address: use the kept copy first
const FIXED = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/[^/]+@\d[^/]*\/|cdn\.jsdelivr\.net\/npm\/@[^/]+\/[^/]+@\d[^/]*\/|cdnjs\.cloudflare\.com\/ajax\/libs\/[^/]+\/\d[^/]*\/|fonts\.gstatic\.com\/)/;
// may change at the same address: fresh from the network, the kept copy only when the network fails
const FRESH = /^https:\/\/fonts\.googleapis\.com\/css2\?/;
// the screen texts in other languages (lang/<l>.js?v=<hash>): a new text gets a new address, so a kept copy is fine
const libKind = u => (FIXED.test(u) ? 'fixed' : FRESH.test(u) ? 'fresh' : u.startsWith(SCOPE.href + 'vendor/') ? 'fresh' : u.startsWith(SCOPE.href + 'lang/') ? 'fixed' : null);
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
  for (const k of await caches.keys()) if (k.startsWith('zzirit-') && !KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method === 'GET' && r.mode !== 'navigate') { const k = libKind(r.url); if (k) e.respondWith(lib(e, r, k)); return; }
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

/* the libraries: a kept copy (fixed addresses) or the network first (fonts list, vendor files) */
const usable = res => res && (res.ok || res.type === 'opaque');
async function lib(e, r, kind) {
  const c = await caches.open(LIBS).catch(() => null);
  if (kind === 'fixed' && c) { const hit = await c.match(r.url); if (hit) return hit; }
  try {
    const res = await fetch(r);
    if (c && usable(res)) {
      const copy = res.clone();
      // an older copy of the same language's texts is no longer needed
      const base = r.url.split('?')[0], old = r.url.startsWith(SCOPE.href + 'lang/') ? (await c.keys()).filter(k => k.url !== r.url && k.url.split('?')[0] === base) : [];
      e.waitUntil(Promise.all(old.map(k => c.delete(k))).then(() => c.put(r.url, copy)).catch(() => { }));
    }
    return res;
  } catch (err) {
    const hit = c ? await c.match(r.url) : null;
    if (hit) return hit;
    throw err;
  }
}
// the page says which libraries it loaded before this worker was in charge (the very first visit): keep a copy of them
self.addEventListener('message', e => {
  const urls = e.data && Array.isArray(e.data.keep) ? e.data.keep.filter(u => typeof u === 'string' && libKind(u)).slice(0, 12) : [];
  if (!urls.length) return;
  e.waitUntil((async () => {
    const c = await caches.open(LIBS);
    for (const u of urls) {
      try {
        if (await c.match(u)) continue;
        const res = await fetch(u, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(u, { mode: 'no-cors', credentials: 'omit' }));
        if (usable(res)) await c.put(u, res);
      } catch (err) { }
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
