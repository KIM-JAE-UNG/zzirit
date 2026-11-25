/* ===== 레이드 기록과 괴어 칭호: everything I have done in the legendary raids — joined, beaten, MVP, all the damage, the
   best raid, a book of the six monsters (lit once beaten) and the last raids — and four raid titles to take
   (괴어 사냥꾼, 괴어 MVP, 레이드 베테랑, 괴어 정복자). The server counts it all (0028); a taken title is worn like a set
   title. Opened from the raid screen's 「기록」 button. Website only. ===== */
const RR = { st: null, p: null, at: 0, off: false, busy: false };
const RR_IC = { raid_hunter: 'target', raid_mvp: 'trophy', raid_veteran: 'medal', raid_all: 'book' };
const rrReady = (st = RR.st) => !st ? 0 : st.titles.filter(x => x.n >= x.goal && !x.got).length;
function rrLoad(force) {
  if (RR.off || !APP_AUTH || !APP_AUTH.live || !APP_AUTH.live.raidRec) return Promise.resolve(null);
  if (RR.p) return RR.p;
  if (!force && RR.st && Date.now() - RR.at < 30e3) { rrNudge(); return Promise.resolve(RR.st); }
  RR.p = APP_AUTH.live.raidRec().then(r => {
    if (!r || r.err || !Array.isArray(r.titles)) return null;
    const before = RR.st ? rrReady(RR.st) : 0;
    RR.st = r; RR.at = Date.now(); rrPaint();
    if (rrReady(r) > before && RR.at) rrNudge();
    return r;
  }).catch(e => { if (e && (e.code === 'need_update' || e.code === 'not_granted')) RR.off = true; rrPaint(); return null; }).finally(() => { RR.p = null; });
  return RR.p;
}
function rrNudge() { $$('[data-rrdot]').forEach(d => { d.hidden = !rrReady(); }); }
function rrTitleGoal(x) { return t(x.metric === 'all' ? 'rr_t_all' : x.metric === 'mvp' ? 'rr_t_mvp' : 'rr_t_won', { n: x.goal }); }
function rrBodyHTML(st = RR.st) {
  if (!st) return `<p class="rr-wait">${RR.off ? t('rr_off') : `<span class="pl-spin"></span>${t('lv_loading')}`}</p>`;
  const tile = (k, v, ic) => `<li><span>${icon(ic)}${t(k)}</span><b class="num">${fmtN(v)}</b></li>`;
  const best = st.best && SPI[st.best.sp];
  const book = (st.monsters || []).map(id => { const sp = SPI[id], n = (st.dex || {})[id] || 0; if (!sp) return ''; return `<li class="${n ? 'got' : ''}"><span class="rr-mon"><img src="${FD.thumb(sp, 200, 110)}" alt="" loading="lazy"></span><small>${n ? esc(spName(sp)) : '???'}</small>${n ? `<i class="num">×${n}</i>` : ''}</li>`; }).join('');
  const nGot = (st.monsters || []).filter(id => (st.dex || {})[id]).length;
  const titles = st.titles.map(x => {
    const done = x.n >= x.goal, wear = st.title === x.k, pc = Math.round(100 * Math.min(1, x.n / x.goal));
    const act = x.got ? (wear ? `<span class="ls-wearing">${icon('check')}${t('ls_wearing')}</span>` : `<button class="btn btn-glass btn-sm" data-rrwear="${esc(x.k)}">${t('ls_wear')}</button>`)
      : done ? `<button class="btn btn-primary btn-sm" data-rrclaim="${esc(x.k)}">${t('dm_claim')} +${x.pts}P</button>` : `<span class="rr-pts num">+${x.pts}P</span>`;
    return `<li class="rr-ti${x.got ? ' is-got' : done ? ' is-done' : ''}${wear ? ' is-wear' : ''}"><span class="rr-ti-ic">${icon(RR_IC[x.k] || 'medal')}</span>
      <span class="rr-ti-t"><b>${esc(lsTitle(x.k))}</b><small>${esc(rrTitleGoal(x))}</small><span class="ms-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${x.goal}" aria-valuenow="${x.n}" aria-label="${esc(lsTitle(x.k))}"><i style="width:${pc}%"></i></span></span>
      <span class="rr-ti-a"><small class="num">${x.n}/${x.goal}</small>${act}</span></li>`;
  }).join('');
  const rows = (st.list || []).map(x => { const sp = SPI[x.sp]; return `<li class="${x.won ? 'won' : 'lost'}"><span class="rr-l-f">${sp ? `<img src="${FD.thumb(sp, 120, 66)}" alt="" loading="lazy">` : ''}</span>
      <span class="rr-l-t"><b>${esc(sp ? spName(sp) : x.sp)}${x.mvp ? ' <i class="rr-mvp">MVP</i>' : ''}</b><small>${esc(rdSpot(x.spot))} · ${esc(fmtDate(x.at, { month: 'short', day: 'numeric' }))}</small></span>
      <span class="rr-l-r"><b class="num">${fmtN(x.d)}</b><small>${t('rr_rank', { r: x.rk, n: x.n })}</small></span>
      <span class="rr-l-s ${x.won ? 'won' : 'lost'}">${x.won ? `${t('rr_row_won')}${x.pts ? ` <b class="num">+${x.pts}P</b>` : ''}` : t('rr_row_lost')}</span></li>`; }).join('');
  return `<ul class="rr-tiles">${tile('rr_joined', st.joined, 'users')}${tile('rr_won', st.won, 'check')}${tile('rr_mvp', st.mvp, 'trophy')}${tile('rr_dmg', st.dmg, 'bolt')}${tile('rr_crits', st.crits, 'sparkle')}</ul>
    ${best ? `<p class="rr-best">${icon('star')}<span>${t('rr_best')}</span><b>${esc(t('rr_best_v', { fish: spName(best), d: fmtN(st.best.d), r: st.best.rk }))}</b></p>` : ''}
    <h3 class="rr-h">${icon('book')}${t('rr_book')}<small class="num">${nGot} / ${(st.monsters || []).length}</small></h3>
    <ul class="rr-book">${book}</ul>
    <h3 class="rr-h">${icon('medal')}${t('rr_titles')}${st.title ? `<small>${t('ls_my')} <b class="ls-chip">${esc(lsTitle(st.title))}</b></small>` : ''}</h3>
    <ul class="rr-titles">${titles}</ul>
    <h3 class="rr-h">${icon('clock')}${t('rr_recent')}</h3>
    ${rows ? `<ul class="rr-list">${rows}</ul>` : `<p class="rr-empty">${t('rr_empty')}</p>`}`;
}
function rrPaint() {
  $$('[data-rrbody]').forEach(el => { el.innerHTML = rrBodyHTML(); });
  rrNudge();
}
function rrOpen() {
  const host = RD.el; if (!host) return;
  let el = $('.rd-rec', host);
  if (!el) {
    el = document.createElement('section'); el.className = 'rd-rec'; el.setAttribute('aria-label', t('rr_title'));
    el.innerHTML = `<div class="rr-top"><button class="rd-x rr-back" data-rrclose aria-label="${esc(t('close'))}">${icon('chev')}</button><h2>${t('rr_title')}</h2></div><div class="rr-body" data-rrbody>${rrBodyHTML()}</div>`;
    host.appendChild(el);
  }
  el.hidden = false; requestAnimationFrame(() => el.classList.add('in'));
  rrLoad(true);
}
function rrClose() { const el = RD.el && $('.rd-rec', RD.el); if (!el) return; el.classList.remove('in'); setTimeout(() => { el.hidden = true; }, 220); }
function rrClaim(btn) {
  if (RR.busy) return; RR.busy = true; btn.disabled = true;
  const k = btn.dataset.rrclaim;
  APP_AUTH.live.raidTitle(k).then(r => {
    if (!r || r.err) { toast(t(r && r.err === 'no_profile' ? 'ls_need_profile' : 'lv_err'), 'warn'); return rrLoad(true); }
    if (typeof LVS !== 'undefined') { LVS.play('coin'); LVS.buzz([20, 40, 20]); }
    toast(t('ls_claimed', { p: r.pts, t: lsTitle(k) }), 'ok', 4200);
    if (typeof msBal === 'function') msBal(r.bal);
    if (RR.st) { RR.st.titles.forEach(x => { if (x.k === k) x.got = true; }); RR.st.title = r.title || RR.st.title; }
    if (r.title) { LSET.titles[myId()] = r.title; if (LSET.st) LSET.st.title = r.title; }
    rrPaint(); if (typeof lsPaint === 'function') lsPaint();
  }).catch(() => toast(t('lv_err'), 'warn')).finally(() => { RR.busy = false; btn.disabled = false; });
}
function rrWear(btn) {
  if (RR.busy) return; RR.busy = true; btn.disabled = true;
  const k = btn.dataset.rrwear || '';
  APP_AUTH.live.wear(k).then(r => {
    if (!r || r.err) { toast(t('lv_err'), 'warn'); return; }
    if (RR.st) RR.st.title = r.title || null;
    if (LSET.st) LSET.st.title = r.title || null;
    if (r.title) { LSET.titles[myId()] = r.title; toast(t('ls_worn', { t: lsTitle(r.title) }), 'ok'); } else delete LSET.titles[myId()];
    rrPaint(); if (typeof lsPaint === 'function') lsPaint();
  }).catch(() => toast(t('lv_err'), 'warn')).finally(() => { RR.busy = false; btn.disabled = false; });
}
document.addEventListener('click', e => {
  if (!RD.el || !RD.el.contains(e.target)) return;
  if (e.target.closest('[data-rropen]')) { e.preventDefault(); e.stopPropagation(); rrOpen(); return; }
  if (e.target.closest('[data-rrclose]')) { e.stopPropagation(); rrClose(); return; }
  const c = e.target.closest('[data-rrclaim]'); if (c) { e.stopPropagation(); rrClaim(c); return; }
  const w = e.target.closest('[data-rrwear]'); if (w) { e.stopPropagation(); rrWear(w); }
}, true);
