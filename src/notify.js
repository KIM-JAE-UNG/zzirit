/* ===== Notifications (알림): replies and likes on my posts, friend requests, review results, team requests,
   operator notices, confirmed payments. Worked out on this device from what the app already loads; nothing extra is
   stored on the server. The first scan only records what is already there, so nobody gets a flood of old news. ===== */
const NOTI_MAX = 80;
function notiOn() { return S.mode === 'shared' && !!(S.me && S.me.nick); }
function notiList() { const l = lsGet('noti', []); return Array.isArray(l) ? l : []; }
/* new = arrived on this device after the list was last opened (data can arrive late, so not the event's own time) */
const notiNew = (x, seen) => !x.old && (x.at || x.t) > seen;
function notiUnread() { const seen = lsGet('notiSeen', 0) || 0; return notiList().filter(x => notiNew(x, seen)).length; }
/* everything the notifications look at has arrived (so the first look doesn't miss what was already there) */
function notiReady() { return S.anglersLoaded && S.adminLoaded && S.boardLoaded && S.teamsLoaded && S.ordersLoaded && (window.APP_RT !== 'web' || S.pointsLoaded); }
function notiScan() {
  if (!notiOn() || !notiReady()) return;
  const list = notiList(); const have = new Set(list.map(x => x.id));
  const first = !lsGet('notiInit', 0); // the first time: remember what is there, as already read
  const st = lsGet('notiState', {}) || {}; let changed = false;
  const add = (id, k, t, data) => {
    if (have.has(id)) return; have.add(id); changed = true;
    list.push(Object.assign({ id, k, t: Math.min(t || nowMs(), nowMs()), at: nowMs() }, first ? { old: 1 } : {}, data));
  };
  const me = myId();
  // replies and likes on my posts; replies to posts I commented on
  const bd = boardIndex();
  for (const p of bd.posts.values()) {
    if (p.uid === me) {
      for (const c of p.cmts) if (c.uid !== me && !c.hidden) add('c:' + c.key, 'cmt', c.ts, { post: p.key, who: c.uid, title: String(p.title || '').slice(0, 40), body: String(c.body || '').slice(0, 60) });
      const n = p.likes.size, was = (st.likes || {})[p.key] || 0;
      if (n > was) { if (was || !first) add('l:' + p.key + ':' + n, 'like', nowMs(), { post: p.key, n: n - was, title: String(p.title || '').slice(0, 40) }); }
      (st.likes = st.likes || {})[p.key] = n;
    } else if (p.cmts.some(c => c.uid === me)) {
      const mineAt = Math.max(...p.cmts.filter(c => c.uid === me).map(c => c.ts || 0));
      for (const c of p.cmts) if (c.uid !== me && !c.hidden && (c.ts || 0) > mineAt) add('c:' + c.key, 'cmt2', c.ts, { post: p.key, who: c.uid, title: String(p.title || '').slice(0, 40), body: String(c.body || '').slice(0, 60) });
    }
  }
  // friend requests and accepted requests
  const L = frLists();
  for (const r of L.inc) add('f:' + r.uid + ':' + r.ts, 'freq', r.ts, { who: r.uid });
  const frNow = new Set(L.friends.map(x => x.uid)); const frWas = new Set(st.fr || []);
  for (const r of L.friends) if (!frWas.has(r.uid) && st.fr) add('fa:' + r.uid, 'facc', r.ts, { who: r.uid });
  st.fr = [...frNow];
  // review results for my catches (the AI reviewer or the operator)
  for (const c of myCatches()) {
    if (c.st !== 'review') continue;
    const s2 = catchState(me, c); if (s2 === 'review') continue;
    const n = reviewNote(me, c);
    add('r:' + c.id + ':' + s2, s2 === 'ok' ? 'rok' : s2 === 'no' ? (logOnly(me, c) ? 'rlog' : 'rno') : 'rhold', (n && n.at) || nowMs(), { cid: c.id, sp: c.sp, len: c.len, why: n ? reviewReason(n) : '' });
  }
  // people asking to join my team (I lead it)
  const tm = teamIndex().teams.get(me);
  if (tm) for (const uid of tm.pending) add('tj:' + uid, 'tjoin', nowMs(), { who: uid });
  // operator notice
  const nt = noticeOf(); if (nt) add('n:' + nt.id, 'notice', nt.ts || nowMs(), { body: nt.t.slice(0, 80) });
  // payments the operator confirmed
  const g = grantsOf(me);
  for (const o of S.myOrders) if (g[o.id] === 'ok') add('p:' + o.id, 'paid', nowMs(), { ref: o.kind === 'item' ? o.ref : 'donate' });
  if (first) { lsSet('notiInit', 1); changed = true; }
  lsSet('notiState', st);
  if (changed) { list.sort((a, b) => a.t - b.t); lsSet('noti', list.slice(-NOTI_MAX)); }
  notiBadge();
}
function notiBadge() {
  const on = notiOn(); const n = on ? notiUnread() : 0;
  $$('.noti-btn').forEach(b => { b.hidden = !on; b.setAttribute('aria-label', t('noti_title') + (n ? ` (${n})` : '')); });
  $$('[data-notibadge]').forEach(x => { x.hidden = !n; x.textContent = n > 9 ? '9+' : String(n); });
  const fm = $('#fr-mini'); if (fm) fm.hidden = on; // friend requests show up in the notifications
}
function notiText(x) {
  const who = x.who ? esc((anglerOf(x.who) || {}).nick || '?') : '';
  const fish = x.sp ? `${esc(nameOf(x.sp))} ${lenFmt(x.len)}` : '';
  switch (x.k) {
    case 'cmt': return t('nt_cmt', { who, title: esc(x.title) }) + (x.body ? `<span class="nt-q">${esc(x.body)}</span>` : '');
    case 'cmt2': return t('nt_cmt2', { who, title: esc(x.title) }) + (x.body ? `<span class="nt-q">${esc(x.body)}</span>` : '');
    case 'like': return t('nt_like', { n: x.n, title: esc(x.title) });
    case 'freq': return t('nt_freq', { who });
    case 'facc': return t('nt_facc', { who });
    case 'rok': return t('nt_rok', { fish });
    case 'rno': return t('nt_rno', { fish }) + (x.why ? `<span class="nt-q">${esc(x.why)}</span>` : '');
    case 'rlog': return t('nt_rlog', { fish });
    case 'rhold': return t('nt_rhold', { fish });
    case 'tjoin': return t('nt_tjoin', { who });
    case 'notice': return `<b>${t('notice_label')}</b> ${esc(x.body)}`;
    case 'badge': return t('nt_badge', { name: t('bdg_' + x.badge) });
    case 'paid': return t('nt_paid', { item: x.ref === 'donate' ? t('donate_btn') : esc(dict((SHOPI[x.ref] || {}).n) || x.ref) });
    default: return '';
  }
}
const NT_ICON = { cmt: 'chat', cmt2: 'chat', like: 'heart', freq: 'user-plus', facc: 'user-check', rok: 'check', rno: 'x', rlog: 'log', rhold: 'clock', tjoin: 'flag', notice: 'megaphone', paid: 'heart', badge: 'medal' };
function openNoti() {
  notiScan();
  const seen = lsGet('notiSeen', 0) || 0;
  const list = notiList().slice().sort((a, b) => b.t - a.t).filter(x => notiText(x));
  const w = openModal(`<div class="noti">
    <h2>${icon('bell')} ${t('noti_title')}</h2>
    ${list.length ? `<ul class="nt-list">${list.map(x => `<li><button class="nt-item k-${esc(x.k)}${notiNew(x, seen) ? ' unread' : ''}" data-nt="${esc(x.id)}"><span class="nt-ic">${icon(NT_ICON[x.k] || 'bell')}</span><span class="nt-txt"><span class="nt-main">${notiText(x)}</span><span class="muted small">${ago(x.t)}</span></span></button></li>`).join('')}</ul>`
      : `<div class="empty"><p class="muted">${t('noti_empty')}</p></div>`}
    <p class="hint">${t('noti_hint')}</p>
  </div>`, { label: t('noti_title') });
  lsSet('notiSeen', nowMs()); notiBadge();
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-nt]'); if (!b) return;
    const x = list.find(y => y.id === b.dataset.nt); if (!x) return;
    closeModal(w);
    if (x.post) openPost(x.post);
    else if (x.cid) openCatch(myId(), x.cid);
    else if (x.k === 'freq' || x.k === 'facc') location.hash = 'friends';
    else if (x.k === 'tjoin') location.hash = 'teams';
    else if (x.k === 'notice') location.hash = 'home';
    else if (x.k === 'paid') location.hash = 'sea';
    else if (x.k === 'badge') { S.seaTab = 'badges'; S.viewUid = null; location.hash = 'sea'; }
  });
}
