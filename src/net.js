/* ===== A faster first screen, and a basic screen with no connection =====
   - The map library (Leaflet) is no longer part of the first load on the website: it comes only when a map is opened.
   - The service worker (sw.js) keeps a copy of the few libraries the page needs (sign-in library, fonts, map library),
     so the next launch does not wait for them and the app still opens when the connection is gone.
   - With no connection, a bar at the top says so; the screen shows what is saved on this device. When the connection
     comes back, the bar says so and offers to load everything fresh. */
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
let _leafletP = null;
function needLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (!_leafletP) _leafletP = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = LEAFLET_JS; s.async = true;
    s.onload = () => (window.L && window.L.map ? res(window.L) : rej(new Error('map_lib')));
    s.onerror = () => { s.remove(); rej(new Error('map_lib')); };
    document.head.appendChild(s);
  }).catch(e => { _leafletP = null; throw e; });
  return _leafletP;
}
// a placeholder for a map that is still on its way (or that needs a connection); `again` runs once the library is here
function mapWait(el, again) {
  el.innerHTML = `<div class="map-wait" role="status"><span class="spin" aria-hidden="true"></span><p>${t('map_loading')}</p></div>`;
  needLeaflet().then(again).catch(() => {
    el.innerHTML = `<div class="map-wait off" role="status">${icon('cloud')}<p>${t('map_need_net')}</p><button class="btn btn-line" data-net-retry>${icon('refresh')}${t('retry')}</button></div>`;
    const b = el.querySelector('[data-net-retry]'); if (b) b.onclick = () => mapWait(el, again);
  });
}

/* The screen texts on the website: Korean is in the page, the other languages come from lang/<l>.js only when chosen
   (build.py). The Claude page has all four inside, so there is nothing to bring. */
const _langP = {};
function langReady(l) { return typeof T_SPLIT === 'undefined' || l === 'ko' || !!T_SPLIT.has[l]; }
function needLang(l) {
  if (langReady(l)) return Promise.resolve();
  if (!T_SPLIT.v[l]) return Promise.reject(new Error('lang'));
  if (!_langP[l]) _langP[l] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = `lang/${l}.js?v=${T_SPLIT.v[l]}`; s.async = true;
    s.onload = () => { tPackMerge(); T_SPLIT.has[l] ? res() : rej(new Error('lang')); };
    s.onerror = () => { s.remove(); rej(new Error('lang')); };
    document.head.appendChild(s);
  }).catch(e => { delete _langP[l]; throw e; });
  return _langP[l];
}

const NET = { off: false, wasOff: false, hideT: 0 };
function netBar() {
  let bar = document.getElementById('net-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'net-bar'; bar.className = 'net-bar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite'); bar.hidden = true;
    document.body.appendChild(bar);
    bar.addEventListener('click', e => {
      if (e.target.closest('[data-net-reload]')) location.reload();
      else if (e.target.closest('[data-net-close]')) { bar.hidden = true; document.body.classList.remove('net-on'); }
    });
  }
  return bar;
}
function netShow() {
  if (window.APP_RT !== 'web' && !NET.off) return;
  const bar = netBar(); clearTimeout(NET.hideT);
  if (NET.off) {
    bar.className = 'net-bar off';
    bar.innerHTML = `${icon('cloud')}<span><b>${t('net_off')}</b> <span class="nb-sub">${t('net_off_sub')}</span></span>`;
  } else {
    bar.className = 'net-bar back';
    bar.innerHTML = `${icon('check')}<span><b>${t('net_back')}</b></span><button class="nb-btn" data-net-reload>${icon('refresh')}${t('net_reload')}</button><button class="nb-x" data-net-close aria-label="${esc(t('close'))}">${icon('x')}</button>`;
    NET.hideT = setTimeout(() => { bar.hidden = true; document.body.classList.remove('net-on'); }, 12000);
  }
  bar.hidden = false; document.body.classList.add('net-on');
}
function netSet(off) {
  if (off === NET.off) return;
  NET.off = off;
  if (off) { NET.wasOff = true; netShow(); }
  else if (NET.wasOff) netShow();
}
window.addEventListener('offline', () => netSet(true));
window.addEventListener('online', () => netSet(false));
function netStart() {
  if (navigator.onLine === false) netSet(true);
  // tell the service worker which libraries this page uses, so a copy is kept from the very first visit
  if (window.APP_RT === 'web' && 'serviceWorker' in navigator && navigator.onLine !== false) {
    navigator.serviceWorker.ready.then(r => {
      const urls = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map(n => n.src || n.href).filter(u => /^https:\/\/(cdn\.jsdelivr\.net\/npm\/|cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.googleapis\.com\/)/.test(u));
      if (r.active && urls.length) r.active.postMessage({ keep: urls });
    }).catch(() => { });
  }
}
