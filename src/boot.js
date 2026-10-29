/* ===== Router, global events, boot ===== */
const QR_PATH = '__QR_PATH__';
const ROUTES = ['home', 'scan', 'past', 'map', 'rank', 'friends', 'board', 'teams', 'points', 'sea', 'char', 'dex', 'tackle', 'log', 'help', 'about', 'prefs', 'admin'];
const LIVE_VIEWS = new Set(['home', 'rank', 'friends', 'board', 'teams', 'points', 'sea', 'dex', 'log', 'admin']);
const viewOf = r => (r === 'past' ? 'scan' : r);

function updateStatic() {
  $$('[data-t]').forEach(n => { n.textContent = t(n.dataset.t); });
  $$('[data-tt]').forEach(n => { const v = t(n.dataset.tt); n.setAttribute('aria-label', v); n.title = v; });
  const ls = $('#lang-sel'); if (ls) ls.value = S.lang;
  const ls2 = $('#lang-sel-m'); if (ls2) ls2.value = S.lang;
}
function updateShell() {
  const chip = $('#me-chip');
  if (chip) {
    if (S.me && S.me.nick) { const r = myRank('KR'); chip.innerHTML = `${avatar(S.me, 34)}<span class="mc-txt">${nickHTML(S.me)}<span class="muted small">${flag(S.me.cc)} ${r ? t('rank_kr') + ' #' + r.rank : t('no_rank_yet')}</span></span>`; }
    else chip.innerHTML = `${icon('user')}<span class="mc-txt"><b>${t(window.APP_RT === 'web' && !S.idOff ? 'auth_chip' : 'onb_go')}</b><span class="muted small">${t('onb_card_sub_short')}</span></span>`;
  }
  const mav = $('#me-mini'); if (mav) mav.innerHTML = S.me && S.me.nick ? avatar(S.me, 30) : icon('user');
  // no profile yet: the avatar buttons open sign-up / login instead of an empty sea
  for (const n of [chip, mav]) { if (!n) continue; if (S.me && S.me.nick) { n.setAttribute('href', '#sea'); delete n.dataset.act; } else { n.setAttribute('href', '#'); n.dataset.act = 'onboard'; } }
  $$('.nav-admin').forEach(n => n.hidden = !S.isOwner);
  $$('.nav-web').forEach(n => n.hidden = window.APP_RT !== 'web');
  const nIn = S.me && S.me.nick ? frLists().inc.length : 0;
  $$('[data-frbadge]').forEach(n => { n.hidden = !nIn; n.textContent = nIn > 9 ? '9+' : String(nIn); });
  const fb = $('#fr-mini'); if (fb) fb.setAttribute('aria-label', t('nav_friends') + (nIn ? ` (${nIn})` : ''));
  const mode = $('#mode-pill');
  if (mode) { mode.hidden = !S.ready || S.mode === 'shared'; mode.textContent = t('mode_pill_' + S.mode); mode.title = t(S.mode === 'local' ? 'mode_local_note' : 'mode_offline_note'); }
  // log out next to my name (website, once there is a login ID or a linked device)
  const out = $('#me-out'); if (out) out.hidden = !(idSupported() && S.me && S.me.nick && (S.loginId || (window.APP_AUTH && window.APP_AUTH.link && window.APP_AUTH.link.linked())));
  notiBadge();
}
function setTheme(x) {
  S.theme = x; lsSet('theme', x);
  if (x === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', x);
  const b = $('#theme-btn'); if (b) b.innerHTML = icon(x === 'dark' ? 'moon' : x === 'light' ? 'sun' : 'contrast');
}
const _fontsLoaded = {};
function setLang(l) {
  if (!['ko', 'en', 'ja', 'zh'].includes(l)) l = 'ko';
  S.lang = l; S.li = ['ko', 'en', 'ja', 'zh'].indexOf(l); lsSet('lang', l);
  document.documentElement.lang = l;
  const fam = { ja: 'IBM+Plex+Sans+JP:wght@400;500;600;700', zh: 'Noto+Sans+SC:wght@400;500;600;700' }[l];
  if (fam && !_fontsLoaded[l]) { _fontsLoaded[l] = 1; const ln = document.createElement('link'); ln.rel = 'stylesheet'; ln.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`; document.head.appendChild(ln); }
  updateStatic();
  if (VIEWS.map.labels) VIEWS.map.labels.refresh();
  if (VIEWS.map.built) VIEWS.map.refreshPanels();
}
function show(route) {
  const vid = viewOf(route);
  $$('.view').forEach(v => { v.hidden = v.id !== 'v-' + vid; });
  $$('[data-route]').forEach(a => { const on = (a.dataset.route === route && !(route === 'sea' && S.viewUid)) || (route === 'past' && a.dataset.route === 'scan'); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.body.dataset.route = vid;
  const el = $('#v-' + vid);
  try { VIEWS[vid].render(el); } catch (e) { console.error(e); el.innerHTML = `<div class="page"><div class="empty card big"><h2>${t('err_view')}</h2><p class="muted">${esc(e.message || e)}</p></div></div>`; }
  if (S.scene) { if (vid === 'sea') S.scene.start(); else S.scene.stop(); }
  updateShell();
}
function onHash() {
  let h = (location.hash || '').replace(/^#/, '');
  if (h === 'donate') { openDonate(); h = S.route && S.route !== 'donate' ? S.route : 'home'; }
  if (h === 'claim') { openClaim(); h = S.route && S.route !== 'claim' ? S.route : 'home'; }
  if (/^link=/.test(h)) { const code = decodeURIComponent(h.slice(5)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); h = 'prefs'; try { history.replaceState(null, '', '#prefs'); } catch (e) { } setTimeout(() => openLinkEnter(code), 400); }
  if (/^add=/.test(h)) { S.frQ = decodeURIComponent(h.slice(4)).toUpperCase().slice(0, 12); h = 'friends'; try { history.replaceState(null, '', '#friends'); } catch (e) { } }
  if (h === 'shop') { S.seaTab = 'shop'; h = 'sea'; }
  if (!ROUTES.includes(h)) h = 'home';
  if (h === 'admin' && !S.isOwner && S.ready) h = 'home';
  if (h !== 'sea' && S.route === 'sea') { S.preview = null; }
  if (h !== 'sea') S.viewUid = null;
  if (h === 'scan' && S.route === 'past' && S.scan) { S.scan.mode = 'now'; }
  if (h === 'past' && S.scan) { S.scan.mode = 'past'; if (S.scan.phase !== 'idle' && S.route !== 'past') S.scan.phase = 'idle'; }
  const prev = S.route; S.route = h;
  show(h);
  if (prev !== h && viewOf(h) !== 'map') window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function rerender() {
  if (!S.route) return;
  const vid = viewOf(S.route);
  if (vid === 'scan') { const side = $('#v-scan .scan-side'); if (side && (!S.scan || S.scan.phase === 'idle' || S.scan.phase === 'done')) show(S.route); else updateShell(); return; }
  const a = document.activeElement;
  const el = $('#v-' + vid);
  if (a && el && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio' && a.type !== 'range') {
    if (!S._deferred) { S._deferred = true; a.addEventListener('blur', () => { S._deferred = false; rerender(); }, { once: true }); }
    updateShell(); return;
  }
  show(S.route);
}
const rerenderSoon = debounce(() => {
  try { notiScan(); badgeCheck(); } catch (e) { console.warn(e); }
  const vid = viewOf(S.route);
  if (vid === 'map') { VIEWS.map.onData(); updateShell(); return; }
  if (LIVE_VIEWS.has(vid)) rerender(); else updateShell();
  // an open post keeps up with new comments and likes (unless someone is typing a comment)
  if (S.openPost && S.openPost.w.isConnected) { const ae = document.activeElement; if (!(ae && ae.id === 'pc-body')) S.openPost.render(); }
}, 300);

function openSeaOf(u) {
  S.viewUid = u === (S.uid || 'local') ? null : u;
  if (location.hash === '#sea') { show('sea'); window.scrollTo({ top: 0 }); } else location.hash = 'sea';
}
function previewFor(id) {
  const it = SHOPI[id]; const inc = it.inc || [id]; const p = { id };
  for (const x of inc) { const i = SHOPI[x]; if (i.k === 'theme') p.theme = x.replace('th_', ''); else if (i.k === 'decor') (p.decor = p.decor || []).push(x); else if (i.k === 'fx') (p.fx = p.fx || []).push(x); else if (i.k === 'flair') p.flair = x; }
  return p;
}

document.addEventListener('click', e => {
  const tgt = e.target;
  const inModal = tgt.closest('.modal-wrap');
  const cp = tgt.closest('[data-copy]'); if (cp) { e.preventDefault(); copyText(cp.dataset.copy, cp); return; }
  const sh = tgt.closest('[data-share]'); if (sh) { e.preventDefault(); const i = sh.dataset.share.indexOf('|'); shareCatch(sh.dataset.share.slice(0, i), sh.dataset.share.slice(i + 1), sh); return; }
  const fr = tgt.closest('[data-fr]'); if (fr) { const i = fr.dataset.fr.indexOf('|'); friendAction(fr.dataset.fr.slice(0, i), fr.dataset.fr.slice(i + 1), fr); return; }
  if (inModal) { const su = tgt.closest('[data-seauid]'); if (su) { closeModal(inModal); openSeaOf(su.dataset.seauid); return; } }
  if (inModal) {
    const ct = tgt.closest('.post [data-catch]'); if (ct) { const [u, c] = ct.dataset.catch.split('|'); openCatch(u, c); return; }
    const tj = tgt.closest('[data-tmjoin]'); if (tj) { closeModal(inModal); tmJoin(tj.dataset.tmjoin); return; }
    const tl = tgt.closest('[data-tmleave]'); if (tl) { if (!armed(tl, t('tm_leave_confirm'))) return; closeModal(inModal); tmLeave(); return; }
    const te = tgt.closest('[data-tmedit]'); if (te) { closeModal(inModal); openTeamEdit(te.dataset.tmedit === 'new'); return; }
  }
  if (inModal && !tgt.closest('[data-act="donate"]')) { const c = tgt.closest('[data-catch]'); if (c && tgt.closest('.admin')) { } return; }
  const sp = tgt.closest('[data-sp]'); if (sp) { openSpecies(sp.dataset.sp); return; }
  const ct = tgt.closest('[data-catch]'); if (ct && !tgt.closest('[data-verdict]')) { const [uid, cid] = ct.dataset.catch.split('|'); openCatch(uid, cid); return; }
  const act = tgt.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (act.tagName === 'A' && act.getAttribute('href') === '#') e.preventDefault();
    if (a === 'donate') openDonate();
    else if (a === 'onboard') openOnboarding();
    else if (a === 'auth') openAuth('join');
    else if (a === 'noti') openNoti();
    else if (a === 'logout') openLogout();
    else if (a === 'install') openInstall();
    else if (a === 'weekly') openWeekly();
    else if (a === 'more') openMore();
    else if (a === 'lens') openLens();
    else if (a === 'scan-stop') { if (S.scan && S.scan.ctl) S.scan.ctl.abort(); S.scan.phase = 'idle'; renderScanWork(); }
    else if (a === 'scan-retry') { if (S.scan && S.scan.file) startScan(S.scan.file); }
    else if (a === 'scan-manual') { S.scan.phase = 'result'; S.scan.fused = S.scan.fused || { list: [], other: null }; renderScanWork(); openTrainPicker(!(S.scan.ai && S.scan.ai.fish_visible !== false && S.scan.fused.list.length)); }
    else if (a === 'scan-reset') { S.scan.phase = 'idle'; renderScanWork(); window.scrollTo({ top: 0 }); }
    else if (a === 'ask-confirm') openConfirm();
    else if (a === 'preview-off') { S.preview = null; rerender(); }
    else if (a === 'rec-off') { S.recDismiss = true; rerender(); }
    else if (a === 'idtip-off') { lsSet('idTipOff', 1); rerender(); }
    else if (a === 'insttip-off') { lsSet('instTipOff', 1); rerender(); }
    else if (a === 'notice-x') { const n = noticeOf(); if (n) lsSet('noticeX', n.id); const bar = act.closest('.notice-bar'); if (bar) bar.remove(); }
    else if (a === 'theme-cycle') setTheme(S.theme === 'system' ? 'dark' : S.theme === 'dark' ? 'light' : 'system');
    return;
  }
  const hr = tgt.closest('[data-homerg]'); if (hr) { S.homeView = hr.dataset.homerg; rerender(); return; }
  const sm = tgt.closest('[data-scanmode]'); if (sm) { const m = sm.dataset.scanmode; S.scan = S.scan || {}; S.scan.mode = m; S.scan.phase = 'idle'; location.hash = m === 'past' ? 'past' : 'scan'; if ((location.hash || '').replace('#', '') === (m === 'past' ? 'past' : 'scan')) show(m === 'past' ? 'past' : 'scan'); return; }
  const pa = tgt.closest('[data-pickalt]'); if (pa) { acceptSpecies(pa.dataset.pickalt, true); return; }
  const sc = tgt.closest('[data-scope]'); if (sc) { S.rk.scope = sc.dataset.scope; rerender(); return; }
  const ca = tgt.closest('[data-cat]'); if (ca) { S.rk.cat = ca.dataset.cat; rerender(); return; }
  const su = tgt.closest('[data-seauid]'); if (su) { openSeaOf(su.dataset.seauid); return; }
  const bw = tgt.closest('[data-bd="write"]'); if (bw) { openWrite(); return; }
  const po = tgt.closest('[data-post]'); if (po) { openPost(po.dataset.post); return; }
  const mh = tgt.closest('[data-modhp]'); if (mh) { modToggle('hp', mh.dataset.modhp).then(rerender); return; }
  const ma = tgt.closest('[data-modav]'); if (ma) { modToggle('av', ma.dataset.modav).then(rerender); return; }
  const nt = tgt.closest('[data-newstab]'); if (nt) { S.newsTab = nt.dataset.newstab; rerender(); return; }
  const nm = tgt.closest('[data-news="more"]'); if (nm) { openNews(); return; }
  const idb = tgt.closest('[data-id]'); if (idb) { const k = idb.dataset.id; if (k === 'create') openIdCreate(); else if (k === 'login') openIdLogin(); else if (k === 'password') openIdPassword(); else if (k === 'logout') idLogout(idb); return; }
  const du = tgt.closest('[data-deluser]'); if (du) { adminDeleteUser(du.dataset.deluser, du); return; }
  const rl = tgt.closest('[data-relink]'); if (rl) { openRelink(rl.dataset.relink); return; }
  const lk = tgt.closest('[data-link]'); if (lk) { const k = lk.dataset.link; if (k === 'make') openLinkMake(); else if (k === 'enter') openLinkEnter(); else if (k === 'leave') linkLeave(lk); return; }
  const bc = tgt.closest('[data-bdcat]'); if (bc) { S.bd = Object.assign(S.bd || {}, { cat: bc.dataset.bdcat }); if (S.route !== 'board') location.hash = 'board'; else VIEWS.board.render($('#v-board')); return; }
  const bs = tgt.closest('[data-bdsort]'); if (bs) { S.bd = Object.assign(S.bd || {}, { sort: bs.dataset.bdsort }); VIEWS.board.render($('#v-board')); return; }
  const tmv = tgt.closest('[data-team]'); if (tmv) { openTeam(tmv.dataset.team); return; }
  const tj = tgt.closest('[data-tmjoin]'); if (tj) { tmJoin(tj.dataset.tmjoin); return; }
  const tl = tgt.closest('[data-tmleave]'); if (tl) { if (!armed(tl, t('tm_leave_confirm'))) return; tmLeave(); return; }
  const te = tgt.closest('[data-tmedit]'); if (te) { openTeamEdit(te.dataset.tmedit === 'new'); return; }
  const tok = tgt.closest('[data-tmok]'); if (tok) { tmApprove(tok.dataset.tmok); return; }
  const tno = tgt.closest('[data-tmno]'); if (tno) { tmBan(tno.dataset.tmno).then(rerender); return; }
  const mySea = tgt.closest('a[href="#sea"]'); if (mySea && S.viewUid) { S.viewUid = null; if (location.hash === '#sea') { e.preventDefault(); show('sea'); window.scrollTo({ top: 0 }); } return; }
  const fs = tgt.closest('[data-frsort]'); if (fs) { S.frSort = fs.dataset.frsort; rerender(); return; }
  const ff = tgt.closest('[data-feedf]'); if (ff) { S.feedF = ff.dataset.feedf; rerender(); return; }
  const frk = tgt.closest('[data-frrank]'); if (frk) { S.rk = Object.assign(S.rk || { period: 'month', cat: 'points', sp: featuredSpecies()[0] }, { scope: 'FR' }); return; }
  const to = tgt.closest('[data-tryon]'); if (to) { S.viewUid = null; S.preview = previewFor(to.dataset.tryon); S.seaTab = 'shop'; show('sea'); window.scrollTo({ top: 0 }); toast(t('fr_tryon_toast'), 'info'); return; }
  const sk = tgt.closest('[data-shopkind]'); if (sk) { S.shopKind = sk.dataset.shopkind; rerender(); return; }
  const st = tgt.closest('[data-seatab]'); if (st) { S.seaTab = st.dataset.seatab; rerender(); return; }
  const lt = tgt.closest('[data-logtab]'); if (lt) { S.logTab = lt.dataset.logtab; rerender(); return; }
  const pv = tgt.closest('[data-preview]'); if (pv) { S.preview = previewFor(pv.dataset.preview); if (S.preview.flair) toast(t('preview_flair'), 'info'); rerender(); const sw = $('.scene-wrap'); if (sw) sw.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const by = tgt.closest('[data-buy]'); if (by) { buyItem(by.dataset.buy); return; }
  const tg = tgt.closest('[data-toggle]'); if (tg) { toggleItem(tg.dataset.toggle); return; }
  const df = tgt.closest('[data-dxf]'); if (df) { S.dx.f = df.dataset.dxf; rerender(); return; }
  const ts = tgt.closest('[data-tksp]'); if (ts) { S.tk.sp = ts.dataset.tksp; rerender(); return; }
  const tt = tgt.closest('[data-tktime]'); if (tt) { S.tk.time = tt.dataset.tktime; rerender(); return; }
  const tw = tgt.closest('[data-tkwater]'); if (tw) { S.tk.water = tw.dataset.tkwater; rerender(); return; }
  const cq = tgt.closest('[data-coachq]'); if (cq) { const sp2 = SPI[S.tk.sp] || SPI[inSeasonTop(homeRegion(), new Date().getMonth(), 1)[0].id]; VIEWS.tackle.ask(cq.dataset.coachq, sp2); return; }
  const th = tgt.closest('[data-themeset]'); if (th) { setTheme(th.dataset.themeset); rerender(); return; }
  const un = tgt.closest('[data-unit]'); if (un) { S.unit = un.dataset.unit; lsSet('unit', S.unit); rerender(); return; }
  const gr = tgt.closest('[data-grant]'); if (gr) { const [uid, oid, v] = gr.dataset.grant.split('|'); const g = Object.assign({}, S.admin.grants); g[uid] = Object.assign({}, g[uid] || {}, { [oid]: v }); store.saveAdmin('grants', g).then(ok => { if (ok && v === 'ok') pushSend('paid', uid + '|' + oid); rerender(); }); return; }
  const vd = tgt.closest('[data-verdict]'); if (vd) { const [uid, cid, v] = vd.dataset.verdict.split('|'); const g = Object.assign({}, S.admin.verdicts); g[uid] = Object.assign({}, g[uid] || {}, { [cid]: v }); store.saveAdmin('verdicts', g).then(ok => { if (ok && (v === 'ok' || v === 'no')) pushSend('verdict', uid + '|' + cid); S.dataVer++; rerender(); }); return; }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'lang-sel' || id === 'lang-sel-m') { setLang(e.target.value); rerender(); }
  else if (id === 'rk-period') { S.rk.period = e.target.value; rerender(); }
  else if (id === 'rk-sp') { S.rk.sp = e.target.value; rerender(); }
});
document.addEventListener('paste', e => {
  if (viewOf(S.route) !== 'scan' || !S.scan || S.scan.phase !== 'idle') return;
  const f = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type)); if (f) startScan(f);
});
window.addEventListener('hashchange', onHash);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.route === 'sea' && S.scene) S.scene.frame(0, true); });

(function boot() {
  const saved = lsGet('lang', null);
  const nav = (navigator.language || 'ko').slice(0, 2);
  setLang(saved || (['ko', 'en', 'ja', 'zh'].includes(nav) ? nav : 'en'));
  setTheme(lsGet('theme', 'system'));
  S.unit = lsGet('unit', 'cm');
  S.me = lsGet('me', null);
  onHash();
  store.init().then(() => { updateStatic(); updateShell(); if (S.route === 'admin' && !S.isOwner) location.hash = 'home'; setTimeout(maybeWhatsNew, 2500); setTimeout(maybeWelcome, 1800); setTimeout(pushSync, 4000); });
  if (window.APP_RT === 'web' && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { const h = e.data && e.data.go; if (typeof h === 'string' && /^#[a-z]+$/.test(h)) location.hash = h.slice(1); });
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1200));
  idle(() => { GEO.loadEnv(); });
  // the website can be installed as an app and opened without a connection (sw.js: pages always come fresh from the network first)
  if (window.APP_RT === 'web' && location.protocol === 'https:' && 'serviceWorker' in navigator) idle(() => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
})();
