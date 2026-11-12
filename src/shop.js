/* ===== 찌릿 포인트 and the 찌릿 낚시점 (website). The points live only in the app: never bought with money, never paid
   out, never traded. The server keeps every number — the wallet, the weekly 챔질 반응속도 board and its prizes (300 / 200 /
   100 for the first three, 20 for everyone else who played, the 황금 번개 lure for the winner), the book of every change
   and what each angler owns. The shop has four sections (lures, rods, reels, floats); in each, two signature pieces carry
   the ZZIRIT mark and take a few weeks of winning. One piece per section is equipped (S.me.lure / rod / reel / float): the
   lure hangs from the character's line, the rod and reel are in its hands, the float is the one in the fishing game; together
   they help a little in the park's solo fishing — never in duels or any ranking. ===== */
const ZP = { st: null, at: 0, p: null, err: null };
const ZP_PRIZE = [300, 200, 100], ZP_JOIN = 20;
function zpOn() { return window.APP_RT === 'web' && !!(window.APP_AUTH && window.APP_AUTH.zp); }
function zpMine() { return zpOn() && !!(S.me && S.me.nick); }
function zpLoad(force) {
  if (!zpOn()) return Promise.resolve(null);
  if (!force && ZP.st && nowMs() - ZP.at < 20e3) return Promise.resolve(ZP.st);
  if (ZP.p) return ZP.p;
  ZP.p = APP_AUTH.zp.state()
    .then(st => { ZP.st = st && typeof st === 'object' ? st : null; ZP.err = null; zpNews(); return ZP.st; })
    .catch(e => { ZP.err = (e && e.code) || 'unavailable'; return ZP.st; })
    .finally(() => { ZP.at = nowMs(); ZP.p = null; });
  return ZP.p;
}
// pages call this while drawing: a fresh state comes in the background and redraws the page once if anything changed
function zpEnsure() {
  if (!zpOn() || ZP.p || nowMs() - ZP.at < 20e3) return;
  const before = JSON.stringify([ZP.st, ZP.err]);
  zpLoad(true).then(() => { if (JSON.stringify([ZP.st, ZP.err]) !== before && ['home', 'lures'].includes(viewOf(S.route))) rerenderSoon(); });
}
const zpBal = () => (ZP.st && ZP.st.bal) || 0;
function zpOwns(id) { const L = ZL.BY[id]; if (!L) return false; return !!L.free || !!(ZP.st && (ZP.st.owned || []).includes(id)); }
function zpPrice(id) { const it = ZP.st && (ZP.st.items || []).find(x => x.id === id); return it ? it.price : ZL.BY[id] ? ZL.BY[id].price : null; }
// what someone has equipped in a section: mine only if I own it (once the server has said what I own); others' as shown
function gearOf(a, uid, kind) {
  const id = a && typeof a[kind] === 'string' ? a[kind] : ''; const L = ZL.BY[id]; if (!L || L.kind !== kind) return '';
  const mine = a === S.me || (uid && uid === myId());
  return mine && ZP.st && !zpOwns(id) ? '' : id;
}
const lureOf = (a, uid) => gearOf(a, uid, 'lure');
const myGear = kind => gearOf(S.me, myId(), kind);
const myLure = () => myGear('lure') || 'jighead';
const zlName = id => ZL.BY[id] ? t('zl_n_' + id) : String(id || '');
const zlSpec = L => Array.isArray(L.spec) ? dict(L.spec) : L.spec;

/* ---------- news: prizes that came in since this device last looked ---------- */
function zpNews() {
  const led = (ZP.st && ZP.st.led) || []; if (!led.length || !zpMine()) return;
  const top = Math.max(...led.map(x => +x.id || 0)), seen = lsGet('zpSeen', null);
  const fresh = led.filter(x => +x.id > (+seen || 0) && x.d > 0 && x.r !== 'buy' && !/^day:/.test(x.ref || '') && (seen != null || nowMs() - Date.parse(x.at) < 3 * DAY_MS));
  lsSet('zpSeen', top);
  if (fresh.length) setTimeout(() => zpCelebrate(fresh), 700);
}
function zpWeekName(day) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(day || ''); return m ? t('zp_week_of', { m: +m[2], w: Math.ceil(+m[3] / 7) }) : ''; }
function zpWhy(x) {
  const wk = String(x.ref || '').split(':')[1] || '';
  const live = /^live:/.test(x.ref || '');
  if (/^day:/.test(x.ref || '')) return t('zp_r_live');
  if (x.r === 'prize') return t(live ? 'zp_r_prize_live' : 'zp_r_prize', { n: x.n, w: zpWeekName(wk) });
  if (x.r === 'join') return t('zp_r_join', { w: zpWeekName(wk) });
  if (x.r === 'buy') return t('zp_r_buy', { name: zlName(x.ref) });
  return x.n ? t('zp_r_grant_n', { note: x.n }) : t('zp_r_grant');
}
function zpCelebrate(list, tries = 0) {
  if ($('.modal-wrap.in')) { if (tries < 20) setTimeout(() => zpCelebrate(list, tries + 1), 4000); return; }
  const sum = list.reduce((a, x) => a + x.d, 0), prize = list.find(x => x.r === 'prize'), gold = prize && prize.n === '1';
  const w = openModal(`<div class="zp-win">
      <div class="zp-win-art${gold ? ' gold' : ''}">${gold ? `<img src="${ZL.url('gold')}" alt="">` : `<span class="zp-coin big">${icon('coin')}</span>`}</div>
      <h2>${prize ? t('zp_win_title', { n: prize.n }) : t('zp_got_title')}</h2>
      <p class="zp-win-sum num">+${fmtN(sum)}P</p>
      <ul class="zp-win-list">${list.slice(0, 5).map(x => `<li><span>${esc(zpWhy(x))}</span><b class="num">+${fmtN(x.d)}P</b></li>`).join('')}</ul>
      ${gold ? `<p class="note">${icon('trophy')} ${t('zp_win_gold')}</p>` : ''}
      <div class="actions"><a class="btn btn-primary btn-lg" href="#lures">${icon('lure')}${t('zp_go_shop')}</a></div>
    </div>`, { label: t('zp_got_title') });
  w.addEventListener('click', e => { if (e.target.closest('a[href="#lures"]')) closeModal(w); });
}

/* ---------- pieces shared by the games page and the shop ---------- */
function zpWalletHTML(where) {
  if (!zpOn()) return `<div class="zp-wallet off"><span class="zp-coin">${icon('coin')}</span><span class="zp-w-t"><b>${t('zp_name')}</b><span class="muted small">${t('zp_web_only')}</span></span></div>`;
  if (!zpMine()) return `<div class="zp-wallet"><span class="zp-coin">${icon('coin')}</span><span class="zp-w-t"><b>${t('zp_name')}</b><span class="muted small">${t('zp_need_profile')}</span></span><button class="btn btn-primary btn-sm" data-act="onboard">${t('onb_go')}</button></div>`;
  const n = ZP.st ? fmtN(zpBal()) : '…';
  const to = where === 'shop' ? '#live' : '#lures';
  return `<a class="zp-wallet" href="${to}"><span class="zp-coin">${icon('coin')}</span><span class="zp-w-t"><span class="muted small">${t('zp_mine')}</span><b class="zp-bal num" data-zpbal>${n}<small>P</small></b></span><span class="zp-w-go">${t(where === 'shop' ? 'zp_earn_more' : 'zp_go_shop')}${icon('chev')}</span></a>`;
}
function zpBookHTML() {
  const led = (ZP.st && ZP.st.led) || [];
  return `<section class="card zp-book"><div class="sec-head tight"><h2 class="h3">${icon('log')}${t('zp_book')}</h2><span class="muted small">${t('zp_earned', { n: fmtN((ZP.st && ZP.st.earned) || 0) })}</span></div>
    ${led.length ? `<ul class="zp-led">${led.slice(0, 15).map(x => `<li><span class="zp-led-t">${esc(zpWhy(x))}<span class="muted small">${esc(fmtDate(Date.parse(x.at), { month: 'short', day: 'numeric' }))}</span></span><b class="num ${x.d < 0 ? 'neg' : 'pos'}">${x.d > 0 ? '+' : ''}${fmtN(x.d)}P</b></li>`).join('')}</ul>` : `<p class="muted">${t('zp_book_none')}</p>`}
  </section>`;
}

/* ---------- the shop ---------- */
function zlCardHTML(L) {
  const own = zpOwns(L.id), on = myGear(L.kind) === L.id, price = zpPrice(L.id);
  const tag = on ? `<span class="zl-tag on">${icon('check')}${t('zl_equipped')}</span>`
    : own ? `<span class="zl-tag own">${t('zl_owned')}</span>`
    : L.prize ? `<span class="zl-tag prize">${icon('trophy')}${t('zl_prize')}</span>`
    : `<span class="zl-tag price num">${icon('coin')}${fmtN(price)}P</span>`;
  return `<button class="zl-card${own ? ' own' : ''}${on ? ' on' : ''}${L.prize ? ' champ' : ''}${L.sig ? ' sig' : ''}" data-zl="${L.id}" style="--zl-a:${L.bg[0]};--zl-b:${L.bg[1]}">
    ${L.sig ? `<span class="zl-sigb">${ZL.mark('silver', 'b' + L.id.replace(/_/g, ''))}SIGNATURE</span>` : ''}
    <span class="zl-art"><img src="${ZL.url(L.id)}" alt="" decoding="async"></span>
    <span class="zl-meta"><b>${esc(zlName(L.id))}</b><span class="small">${esc(t('zl_t_' + L.id))} · ${esc(zlSpec(L))}</span></span>${tag}</button>`;
}
const ZL_TAB_ART = { lure: 'minnow', rod: 'rod_bolt', reel: 'reel_bolt', float: 'float_spark' };
VIEWS.lures = {
  render(el) {
    zpEnsure();
    const tab = ZL.KINDS.includes(S.shopTab) ? S.shopTab : (S.shopTab = lsGet('shopTab', 'lure'), ZL.KINDS.includes(S.shopTab) ? S.shopTab : (S.shopTab = 'lure'));
    const items = ZL.LIST.filter(L => L.kind === tab);
    el.innerHTML = `<div class="page lures-page">
      <header class="zl-hero">
        <div class="zl-hero-t"><p class="eyebrow"><span class="zl-hero-mark">${ZL.mark('silver', 'hero')}</span>ZZIRIT TACKLE</p><h1>${t('zl_title')}</h1><p class="lede">${t('zl_sub')}</p></div>
        <div class="zl-hero-art${tab === 'float' ? ' float' : ''}" aria-hidden="true"><img src="${ZL.url(ZL_TAB_ART[tab], 'game')}" alt=""></div>
        ${zpWalletHTML('shop')}
      </header>
      <div class="chips zl-tabs" role="tablist">${ZL.KINDS.map(k => `<button class="chip${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-zltab="${k}">${t('shop_t_' + k)}${myGear(k) && k !== 'lure' ? '<i class="zl-dot"></i>' : ''}</button>`).join('')}</div>
      <div class="zl-grid">${items.map(L => zlCardHTML(L)).join('')}</div>
      <p class="muted small zl-signote">${ZL.mark('silver', 'note')}${t('zl_sig_note')}</p>
      ${zpMine() && ZP.st ? zpBookHTML() : ''}
      <p class="fine">${t('zp_fine')}</p>
    </div>`;
  }
};
function openLure(id) {
  const L = ZL.BY[id]; if (!L) return;
  let armed = 0, fresh = false;
  const body = () => {
    const own = zpOwns(id), price = zpPrice(id), bal = zpBal(), on = !!(S.me && S.me[L.kind] === id) && own;
    let act;
    if (!zpOn()) act = `<p class="muted small">${t('zp_web_only')}</p>`;
    else if (!zpMine()) act = `<p class="muted small">${t('zp_need_profile')}</p><button class="btn btn-primary btn-lg btn-block" data-act="onboard">${t('onb_go')}</button>`;
    else if (on) act = `<button class="btn btn-line btn-lg btn-block" data-zla="off">${icon('check')}${t('zl_equipped')} · ${t('zl_unequip')}</button>`;
    else if (own) act = `<button class="btn btn-primary btn-lg btn-block${fresh ? ' pop' : ''}" data-zla="equip">${icon('lure')}${t('zl_equip')}</button>`;
    else if (L.prize) act = `<p class="note">${icon('trophy')} ${t('zl_prize_how')}</p><a class="btn btn-line btn-block" href="#live">${t('zl_go_games')}</a>`;
    else if (!ZP.st) act = `<button class="btn btn-primary btn-lg btn-block" disabled>${t(ZP.err ? 'zp_err' : 'loading')}</button>`;
    else if (bal >= price) act = `<button class="btn btn-primary btn-lg btn-block${armed ? ' armed' : ''}" data-zla="buy">${icon('coin')}${t(armed ? 'zl_buy_sure' : 'zl_buy', { p: fmtN(price) })}</button>`;
    else act = `<button class="btn btn-primary btn-lg btn-block" disabled>${icon('coin')}${t('zl_buy', { p: fmtN(price) })}</button><p class="hint">${t('zl_short', { n: fmtN(price - bal) })}</p><a class="btn btn-line btn-block" href="#live">${t('zp_earn_more')}</a>`;
    const u = ZL.url(id);
    return `<div class="zl-detail" style="--zl-a:${L.bg[0]};--zl-b:${L.bg[1]}">
      <div class="zl-stage${fresh ? ' fresh' : ''}${L.sig ? ' sig' : ''}"><div class="zl-float"><img src="${u}" alt="${esc(zlName(id))}"><i class="zl-shine" style="-webkit-mask-image:url(&quot;${u}&quot;);mask-image:url(&quot;${u}&quot;)"></i></div>${L.prize ? '<span class="zl-badge">CHAMPION</span>' : L.sig ? `<span class="zl-badge sig">${ZL.mark('silver', 'db')}SIGNATURE</span>` : ''}${fresh ? `<span class="zl-new">${t('zl_new')}</span>` : ''}</div>
      <div class="zl-body">
        <p class="eyebrow no-up">${esc(t('zl_t_' + id))} · ${esc(zlSpec(L))}</p>
        <h2>${esc(zlName(id))}</h2>
        <p class="lede">${t('zl_d_' + id)}</p>
        <p class="muted small zl-where">${icon(L.kind === 'float' ? 'wave' : 'user')} ${t('zl_where_' + L.kind)}</p>
        ${L.perk ? `<p class="zl-perk">${icon('sparkle')}<span><b>${t('zl_perk_h')}</b> ${t('zl_p_' + id)}</span></p>` : ''}
        <div class="zl-act">${act}</div>
        ${zpMine() && ZP.st ? `<p class="muted small zl-bal">${icon('coin')} ${t('zp_have', { n: fmtN(bal) })}</p>` : ''}
      </div></div>`;
  };
  const w = openModal(`<div id="zl-box">${body()}</div>`, { label: zlName(id) });
  const paint = () => { const b = $('#zl-box', w); if (b && b.isConnected) b.innerHTML = body(); };
  if (zpOn() && !ZP.st) zpLoad().then(paint);
  w.addEventListener('click', async e => {
    if (e.target.closest('[data-act="onboard"]')) { closeModal(w); openOnboarding(); return; }
    if (e.target.closest('a[href^="#"]')) { closeModal(w); return; }
    const b = e.target.closest('[data-zla]'); if (!b || b.disabled) return;
    const k = b.dataset.zla;
    if (k === 'buy') {
      if (!armed) { armed = setTimeout(() => { armed = 0; paint(); }, 3500); paint(); return; }
      clearTimeout(armed); armed = 0; b.disabled = true;
      try {
        const r = await APP_AUTH.zp.buy(id);
        if (ZP.st) { ZP.st.bal = r && typeof r.bal === 'number' ? r.bal : ZP.st.bal; ZP.st.owned = [...new Set([...(ZP.st.owned || []), id])]; }
        fresh = true; paint(); toast(t('zl_bought', { name: zlName(id) }), 'ok');
        zpLoad(true).then(() => { paint(); if (viewOf(S.route) === 'lures') rerenderSoon(); });
      } catch (err) {
        const c = err && err.code;
        toast(t(c === 'not_enough' ? 'zl_err_short' : c === 'owned' ? 'zl_err_owned' : c === 'no_profile' ? 'zp_need_profile' : c === 'need_update' ? 'zp_err_server' : 'zp_err'), 'warn');
        zpLoad(true).then(paint);
      }
      return;
    }
    if (k === 'equip' || k === 'off') {
      if (!S.me || !S.me.nick) return;
      if (k === 'equip') S.me[L.kind] = id; else delete S.me[L.kind];
      b.disabled = true; fresh = false;
      await store.saveMe(); S.dataVer++;
      paint(); toast(t(k === 'equip' ? 'zl_equip_done' : 'zl_unequip_done', { name: zlName(id) }), 'ok');
      if (viewOf(S.route) === 'lures') rerenderSoon();
    }
  });
}
// the operator strikes a run out of this week's board (or puts it back)
async function zpVoid(acct, wk) {
  try { await APP_AUTH.live.void(wk, acct, true); if (typeof lvLoad === 'function') lvLoad(true); toast(t('zp_void_done'), 'ok'); await zpLoad(true); rerenderSoon(); }
  catch (e) { toast(t('zp_err'), 'warn'); }
}
