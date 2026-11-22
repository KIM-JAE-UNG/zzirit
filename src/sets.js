/* ===== 도감 세트 and 칭호 (찌릿 라이브, website). A set is a short list of fish that belong together — a kind of water,
   a part of the world, a season. Catch enough different fish of it and the server pays the set's points once; its
   title can then be worn, and others see it on the weekly board and on the brag card. The server counts everything
   (0026): the phone only shows what it says. ===== */
const LSET = { st: null, p: null, at: 0, off: false, titles: {} };
const LSET_IC = { rock: 'wave', west: 'sea', ink: 'sparkle', spiky: 'spike', fresh: 'wave', tropic: 'sun', rivers: 'globe', legend: 'star', spring: 'sparkle', summer: 'sun', autumn: 'flame', winter: 'cloud' };
const lsName = k => t('ls_n_' + k) || k;
const lsTitle = k => (k && t('ls_t_' + k)) || '';
const lsReady = (st = LSET.st) => !st ? 0 : st.sets.filter(s => s.n >= s.need && !s.got).length;
const lsMonth = m => { try { return new Date(2026, m - 1, 15).toLocaleDateString(locale(), { month: 'short' }); } catch (e) { return String(m); } };
const lsInSeason = (s, mo) => s.m0 != null && (s.m0 <= s.m1 ? mo >= s.m0 && mo <= s.m1 : mo >= s.m0 || mo <= s.m1);
function lsLoad(force) {
  if (LSET.off || !APP_AUTH || !APP_AUTH.live || !APP_AUTH.live.sets) return Promise.resolve(null);
  if (LSET.p) return LSET.p;
  if (!force && LSET.st && nowMs() - LSET.at < 60e3) return Promise.resolve(LSET.st);
  LSET.p = APP_AUTH.live.sets().then(r => {
    if (!r || r.err || !Array.isArray(r.sets)) return null;
    const before = LSET.st; LSET.st = r; LSET.at = nowMs();
    if (r.title) LSET.titles[myId()] = r.title; else delete LSET.titles[myId()];
    // a set that just got done (the fish just landed): say so once
    if (before) { const s = r.sets.find(x => x.n >= x.need && !x.got && !before.sets.some(b => b.k === x.k && b.n >= b.need)); if (s) setTimeout(() => toast(t('ls_done', { s: lsName(s.k), t: lsTitle(s.k) }), 'ok', 5200), 1400); }
    lsPaint(); return r;
  }).catch(e => { if (e && (e.code === 'need_update' || e.code === 'not_granted')) LSET.off = true; return null; }).finally(() => { LSET.p = null; });
  return LSET.p;
}
// after a fish lands: look again only when it can change a set
function lsAfterLand(sp) {
  const st = LSET.st; if (!st) { lsLoad(true); return; }
  if (st.sets.some(s => !s.got && s.sps.includes(sp) && !s.have.includes(sp))) lsLoad(true);
}
function lsSetHTML(s, mo) {
  const done = s.n >= s.need, pc = Math.round(100 * Math.min(1, s.n / s.need)), wear = LSET.st && LSET.st.title === s.k, now = lsInSeason(s, mo);
  const fish = s.sps.filter(id => SPI[id]).map(id => { const got = s.have.includes(id), sp = SPI[id]; return `<li class="${got ? 'got' : ''}" title="${got ? esc(spName(sp)) : '???'}"><span class="tone-${sp.w}"><img ${FD.lazy(sp, 120, 66)} alt="" loading="lazy"></span><small>${got ? esc(spName(sp)) : '???'}</small></li>`; }).join('');
  const act = s.got
    ? (wear ? `<span class="ls-wearing">${icon('check')}${t('ls_wearing')}</span>` : `<button class="btn btn-line btn-sm" data-lswear="${esc(s.k)}">${t('ls_wear')}</button>`)
    : done ? `<button class="btn btn-primary btn-sm" data-lsclaim="${esc(s.k)}">${t('dm_claim')} +${s.pts}P</button>` : `<span class="ls-pts num">+${s.pts}P</span>`;
  return `<li class="ls-set${s.got ? ' is-got' : done ? ' is-done' : ''}${wear ? ' is-wear' : ''}" data-lsk="${esc(s.k)}">
    <div class="ls-top"><span class="ls-ic">${icon(s.got ? 'medal' : LSET_IC[s.k] || 'book')}</span>
      <span class="ls-txt"><b>${esc(lsName(s.k))}</b><small>${s.m0 != null ? `<i class="ls-mo${now ? ' now' : ''}">${esc(lsMonth(s.m0))}–${esc(lsMonth(s.m1))}${now ? ' · ' + t('ls_now') : ''}</i>` : ''}${t('ls_need', { n: s.need, m: s.sps.length })}</small></span>
      ${act}</div>
    <div class="ls-prog"><span class="ms-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${s.need}" aria-valuenow="${s.n}" aria-label="${esc(lsName(s.k))}"><i style="width:${pc}%"></i></span><small class="num">${s.n} / ${s.need}</small>
      <span class="ls-title">${icon('medal')}${t('ls_title_is')} <b>${esc(lsTitle(s.k))}</b></span></div>
    <ul class="ls-fish">${fish}</ul></li>`;
}
function lsBodyHTML(st = LSET.st) {
  if (!st) return `<p class="empty">${LSET.off ? t('ls_off') : t('lv_loading')}</p>`;
  const done = st.sets.filter(s => s.got).length, mo = st.mo || new Date().getMonth() + 1;
  const sets = st.sets.slice().sort((a, b) => (lsInSeason(b, mo) ? 1 : 0) - (lsInSeason(a, mo) ? 1 : 0)); // this season's set first
  return `<div class="ls-head"><p class="lv-bsum"><b class="num">${done}</b> / ${st.sets.length} ${t('ls_done_n')}</p>
      <p class="ls-now">${st.title ? `${icon('medal')}<span>${t('ls_my')} <b class="ls-chip">${esc(lsTitle(st.title))}</b></span><button class="btn btn-line btn-sm" data-lswear="">${t('ls_off_btn')}</button>` : `<span class="muted">${t('ls_none')}</span>`}</p></div>
    <p class="muted small ls-how">${t('ls_how')}</p>
    <ul class="ls-list">${sets.map(s => lsSetHTML(s, mo)).join('')}</ul>`;
}
function lsPaint() {
  $$('[data-lsbody]').forEach(el => { el.innerHTML = lsBodyHTML(); });
  const n = lsReady(); $$('[data-lvtab="set"] i').forEach(i => { i.hidden = !n; i.textContent = n || ''; });
}
function lsClaim(btn) {
  if (LSET.busy) return; LSET.busy = true; btn.disabled = true;
  const k = btn.dataset.lsclaim;
  APP_AUTH.live.setClaim(k).then(r => {
    if (!r || r.err) { toast(t(r && r.err === 'no_profile' ? 'ls_need_profile' : 'lv_err'), 'warn'); return lsLoad(true); }
    if (typeof LVS !== 'undefined') LVS.play('coin');
    toast(t('ls_claimed', { p: r.pts, t: lsTitle(k) }), 'ok', 4200);
    if (typeof msBal === 'function') msBal(r.bal);
    if (LSET.st) { LSET.st.sets.forEach(s => { if (s.k === k) s.got = true; }); LSET.st.title = r.title || LSET.st.title; if (LSET.st.title) LSET.titles[myId()] = LSET.st.title; }
    lsPaint();
  }).catch(() => toast(t('lv_err'), 'warn')).finally(() => { LSET.busy = false; btn.disabled = false; });
}
function lsWear(btn) {
  if (LSET.busy) return; LSET.busy = true; btn.disabled = true;
  const k = btn.dataset.lswear || '';
  APP_AUTH.live.wear(k).then(r => {
    if (!r || r.err) { toast(t('lv_err'), 'warn'); return; }
    if (LSET.st) LSET.st.title = r.title || null;
    if (r.title) { LSET.titles[myId()] = r.title; toast(t('ls_worn', { t: lsTitle(r.title) }), 'ok'); } else delete LSET.titles[myId()];
    lsPaint();
  }).catch(() => toast(t('lv_err'), 'warn')).finally(() => { LSET.busy = false; btn.disabled = false; });
}
// the titles of the people on the weekly board (only what each chose to wear)
function lsBoardTitles(root) {
  const els = $$('[data-lvtitle]', root); if (!els.length || LSET.off || !APP_AUTH.live.titles) return;
  const fill = () => els.forEach(el => { const k = LSET.titles[el.dataset.lvtitle]; el.hidden = !k; el.textContent = k ? lsTitle(k) : ''; });
  fill();
  const ids = [...new Set(els.map(el => el.dataset.lvtitle))].slice(0, 50);
  APP_AUTH.live.titles(ids).then(m => { if (m && typeof m === 'object') { ids.forEach(a => { if (m[a]) LSET.titles[a] = m[a]; else delete LSET.titles[a]; }); fill(); } }).catch(() => null);
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-lsclaim]'); if (c) { e.preventDefault(); lsClaim(c); return; }
  const w = e.target.closest('[data-lswear]'); if (w) { e.preventDefault(); lsWear(w); }
});
