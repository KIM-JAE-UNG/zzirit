/* ===== Phone notifications (폰 알림, Web Push). Website only, on a device whose owner says yes. iPhone and iPad allow
   it only for the app added to the home screen. This device never sends a notice itself: it asks the server, which
   first checks that the thing really happened (a reply, a friend request…), sends it once, and caps each sender. ===== */
function pushCan() { return window.APP_RT === 'web' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!(window.APP_AUTH && window.APP_AUTH.push); }
function pushState() {
  if (window.APP_RT !== 'web') return 'none';
  if (iosDevice() && !standalone()) return 'install'; // iPhone / iPad: only the home-screen app can get notices
  if (!pushCan()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return lsGet('pushOn', 0) && Notification.permission === 'granted' ? 'on' : 'off';
}
const pushKeyBytes = s => { const p = String(s).replace(/-/g, '+').replace(/_/g, '/'); const b = atob(p + '==='.slice((p.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const pushErr = code => Object.assign(new Error(code), { code });
async function pushReg() {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]);
  if (!reg) throw pushErr('no_sw');
  return reg;
}
async function pushOn() {
  if (!pushCan()) throw pushErr('unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw pushErr('denied');
  const reg = await pushReg();
  const key = lsGet('pushKey', '') || await window.APP_AUTH.push.key();
  lsSet('pushKey', key);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(key) });
  const j = sub.toJSON();
  await window.APP_AUTH.push.subscribe(j.endpoint, j.keys.p256dh, j.keys.auth, S.lang);
  lsSet('pushOn', 1);
}
async function pushOff() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { try { await window.APP_AUTH.push.unsubscribe(sub.endpoint); } catch (e) { } await sub.unsubscribe(); }
  } catch (e) { }
  lsSet('pushOn', 0);
}
/* keep the server's copy in step (the language; the account after signing in on this device) */
async function pushSync() {
  if (!pushCan() || !lsGet('pushOn', 0)) return;
  if (Notification.permission !== 'granted') { lsSet('pushOn', 0); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
    if (!sub) { lsSet('pushOn', 0); return; }
    const j = sub.toJSON(); await window.APP_AUTH.push.subscribe(j.endpoint, j.keys.p256dh, j.keys.auth, S.lang);
  } catch (e) { }
}
/* after something that the other person may want to hear about: the server decides */
function pushSend(kind, ref) { if (window.APP_RT !== 'web' || !window.APP_AUTH || !window.APP_AUTH.push || !ref) return; window.APP_AUTH.push.send(kind, ref).catch(() => { }); }
function pushRowHTML() {
  const st = pushState();
  if (st === 'none') return '';
  if (st === 'install') return `<div class="push-row note">${icon('phone')}<span>${t('push_need_install')}</span><button class="btn btn-line btn-sm" id="push-inst">${icon('download')}${t('inst_btn')}</button></div>`;
  if (st === 'unsupported') return `<p class="push-row muted small">${icon('phone')} ${t('push_unsupported')}</p>`;
  if (st === 'denied') return `<p class="push-row note warn">${icon('warn')} ${t('push_blocked')}</p>`;
  return `<div class="push-row"><label class="switch"><input type="checkbox" id="push-sw" ${st === 'on' ? 'checked' : ''}><span class="sw"></span><span><b>${t('push_title')}</b><span class="muted small push-sub">${t('push_sub')}</span></span></label>${st === 'on' && window.APP_AUTH.push.prefs ? pushKindsHTML() : ''}</div>`;
}
/* which morning notes this account wants (kept on the server, so every device of the account follows it) */
const PUSH_KINDS = [['market', 'push_k_mkt', 'coin'], ['tide', 'push_k_tide', 'live'], ['rank', 'push_k_rank', 'trophy']];
function pushKindsHTML() {
  return `<fieldset class="push-kinds" id="push-kinds" disabled><legend>${icon('clock')}${t('push_am')}</legend>${PUSH_KINDS.map(([k, l, ic]) => `<label class="pk"><input type="checkbox" data-pk="${k}" checked><span>${icon(ic)}${t(l)}</span></label>`).join('')}</fieldset>`;
}
function pushKindsBind(root) {
  const fs = $('#push-kinds', root); if (!fs) return;
  window.APP_AUTH.push.prefs().then(p => { if (!fs.isConnected) return; $$('[data-pk]', fs).forEach(x => { x.checked = !p || p[x.dataset.pk] !== false; }); fs.disabled = false; })
    .catch(() => { fs.hidden = true; }); // a server without the morning notice yet
  fs.onchange = async () => {
    const v = {}; $$('[data-pk]', fs).forEach(x => { v[x.dataset.pk] = x.checked; });
    fs.disabled = true;
    try { await window.APP_AUTH.push.prefsSet(v.market, v.tide, v.rank); toast(t('push_k_saved'), 'ok'); }
    catch (e) { toast(t('push_fail'), 'warn'); window.APP_AUTH.push.prefs().then(p => $$('[data-pk]', fs).forEach(x => { x.checked = !p || p[x.dataset.pk] !== false; })).catch(() => { }); }
    fs.disabled = false;
  };
}
function pushBind(root) {
  const sw = $('#push-sw', root);
  if (sw) sw.onchange = async () => {
    sw.disabled = true;
    try { if (sw.checked) { await pushOn(); toast(t('push_on_ok'), 'ok', 5000); } else { await pushOff(); toast(t('push_off_ok')); } }
    catch (e) { sw.checked = false; lsSet('pushOn', 0); toast(t(e.code === 'denied' ? 'push_denied' : 'push_fail'), 'warn', 7000); }
    sw.disabled = false;
    const row = sw.closest('.push-row'); if (row && row.isConnected) { row.outerHTML = pushRowHTML(); pushBind(root); }
  };
  const ib = $('#push-inst', root); if (ib) ib.onclick = () => { const m = ib.closest('.modal-wrap'); if (m) closeModal(m); openInstall(); };
  pushKindsBind(root);
}
