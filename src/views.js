/* ===== Views ===== */
const VIEWS = {};
const homeRegion = () => (S.me && S.me.home) || defaultHome();
function inSeasonTop(rg, m, n) {
  const list = GEO.regionPrior(rg, m);
  const pick = list.filter(x => x.s >= 2).map(x => Object.assign({}, x, { w: x.p * (.5 + .15 * SPI[x.id].r) })).sort((a, b) => b.w - a.w);
  return (pick.length >= n ? pick : pick.concat(list.filter(x => x.s < 2))).slice(0, n);
}
function moonSVG(age, size = 64) {
  const k = (1 - Math.cos(2 * Math.PI * age / 29.53)) / 2, waxing = age < 14.765, r = size / 2 - 2, c = size / 2;
  const x = r * (1 - 2 * k);
  const sweep = waxing ? 1 : 0;
  const d = `M ${c} ${c - r} A ${r} ${r} 0 0 ${sweep} ${c} ${c + r} A ${Math.abs(x)} ${r} 0 0 ${x > 0 ? (waxing ? 0 : 1) : (waxing ? 1 : 0)} ${c} ${c - r} Z`;
  return `<svg class="moon" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" class="moon-dark"/><path d="${d}" class="moon-lit"/></svg>`;
}
function tideInfo(rg) {
  const Lr = TIDE.lunar(new Date()); const west = rg === 'KW'; const m = TIDE.mul(Lr.day, west);
  const label = m.n ? t('mul_n', { n: m.n }) : t('mul_' + m.k);
  const st = TIDE.strength(Lr.age);
  return { Lr, m, label, st, system: west ? t('mul_7') : t('mul_8'), kr: ['KW', 'KS', 'KE', 'KJ'].includes(rg) };
}
function spCard(id, extra = '') {
  const sp = SPI[id]; if (!sp) return '';
  return `<button class="sp-card" data-sp="${id}">
    <span class="sp-thumb tone-${sp.w}"><img src="${FD.thumb(sp, 200, 110)}" alt="" width="200" height="110" loading="lazy"></span>
    <span class="sp-name">${esc(spName(sp))}</span>
    <span class="sp-sci">${esc(sp.sci)}</span>
    <span class="sp-chips">${toxChip(sp)}${isClosed(sp) ? `<span class="chip chip-closed">${t('closed_now')}</span>` : ''}${extra}</span>
  </button>`;
}

/* ---------- HOME ---------- */
VIEWS.home = {
  render(el) {
    const rg = S.homeView || homeRegion();
    const myRg = homeRegion();
    const ti = tideInfo(myRg);
    const now = new Date(), m = now.getMonth();
    const feat = featuredSpecies(now);
    const daysLeft = new Date(now.getFullYear(), m + 1, 1).getTime() - now.getTime();
    const top = inSeasonTop(rg, m, 8);
    const greet = S.me && S.me.nick ? t('home_hi_nick', { nick: esc(S.me.nick) }) : t('home_hi');
    const strengthWord = ti.st > .75 ? t('st_strong') : ti.st > .45 ? t('st_mid') : t('st_weak');
    const tideLine = ti.kr ? t('home_tide_line', { rg: regionName(myRg), mul: ti.label, s: strengthWord }) : t('home_tide_line_g', { s: strengthWord });
    const chipsRg = Array.from(new Set([myRg, 'KS', 'KW', 'KE', 'KJ', 'KF', 'JP', 'CN', 'TW', 'NA', 'FN'])).slice(0, 9);
    // closed season alerts (Korea)
    const closedNow = SP.filter(s => isClosed(s, now));
    const soon = SP.map(s => ({ s, d: daysUntilClosed(s, now) })).filter(x => x.d != null && x.d <= 30 && !isClosed(x.s, now)).sort((a, b) => a.d - b.d);
    // community feed
    const FL = frLists();
    if (S.feedF === 'fr' && !FL.friends.length) S.feedF = 'all';
    const feed = [];
    for (const [uid, a] of allAnglers()) { if (a._local) continue; if (S.feedF === 'fr' && uid !== myId() && relation(uid) !== 'friend') continue; for (const c of (a.catches || [])) if (eligible(c, uid)) feed.push({ uid, a, c }); }
    feed.sort((x, y) => (y.c.at || y.c.ts) - (x.c.at || x.c.ts));
    const mine = myCatches();
    const rKR = myRank('KR');
    const hot = boardList({ sort: 'hot' }).filter(p => !p.hidden).slice(0, 4);
    const myTm = teamOf(myId());
    el.innerHTML = `
    <div class="page home">
      ${noticeBarHTML()}
      ${FL.inc.length ?`<a class="fr-banner" href="#friends">${icon('users')}<span>${t('fr_home_banner', { n: FL.inc.length })}</span><span class="fr-banner-who">${FL.inc.slice(0, 3).map(r => avatar(r.a, 26)).join('')}</span><b>${t('fr_home_banner_cta')}</b></a>` : ''}
      <section class="hero">
        <div class="hero-main">
          <p class="eyebrow">${fmtDate(now.getTime(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} · ${t('lunar_day', { d: ti.Lr.day })}</p>
          <h1>${greet}</h1>
          <p class="lede">${tideLine}</p>
          <div class="hero-cta">
            <a class="btn btn-primary btn-lg" href="#scan">${icon('scan')}${t('cta_scan')}</a>
            <a class="btn btn-line btn-lg" href="#past">${icon('clock')}${t('cta_past')}</a>
          </div>
        </div>
        <div class="tide card" aria-label="${esc(t('today_tide'))}">
          ${moonSVG(ti.Lr.age, 72)}
          <div class="tide-txt">
            <p class="lbl">${t('today_tide')} · ${esc(regionName(myRg))}</p>
            <p class="tide-mul">${ti.kr ? esc(ti.label) : esc(strengthWord)}</p>
            <p class="muted small">${ti.kr ? esc(ti.system) : t('tide_global')}</p>
            <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ti.st * 100)}"><i style="width:${Math.round(ti.st * 100)}%"></i></div>
            <p class="hint">${t('current_strength')} · ${strengthWord}</p>
          </div>
        </div>
      </section>

      ${wxCardHTML()}
      ${idTipHTML() || instTipHTML()}
      ${newsCardHTML()}

      <section class="tourney">
        <div class="tourney-txt">
          <p class="eyebrow light">${t('tourney_eyebrow', { mn: monthName(m) })} · D-${Math.max(0, Math.ceil(daysLeft / 86400000))}</p>
          <h2>${t('tourney_title', { mn: monthName(m) })}</h2>
          <p>${t('tourney_sub')}</p>
          <a class="btn btn-light" href="#rank">${icon('trophy')}${t('see_rank')}</a>
        </div>
        <div class="tourney-fish">${feat.map(id => `<button class="tf" data-sp="${id}"><img src="${FD.thumb(SPI[id], 180, 100)}" alt="" width="180" height="100"><span>${esc(nameOf(id))}</span><b>×2</b></button>`).join('')}</div>
      </section>

      ${wkCardHTML()}

      <section>
        <div class="sec-head">
          <h2>${t('season_now', { rg: esc(regionName(rg)) })}</h2>
          <div class="chip-row" role="group" aria-label="${esc(t('region'))}">${chipsRg.map(r => `<button class="chip chip-tab" aria-pressed="${r === rg}" data-homerg="${r}">${esc(regionName(r))}</button>`).join('')}</div>
        </div>
        <p class="muted small">${t('season_now_hint')}</p>
        <div class="sp-row">${top.map((x, i) => spCard(x.id, `<span class="chip chip-pct">${t('share')} ${fmtN(x.p * 100, 0)}%</span>`)).join('')}</div>
      </section>

      <div class="cols">
        <section class="card">
          <h2 class="h3">${icon('lock')}${t('closed_title')}</h2>
          ${closedNow.length || soon.length ? `<ul class="alert-list">
            ${closedNow.map(s => `<li><button class="link" data-sp="${s.id}">${esc(spName(s))}</button><span class="chip chip-closed">${t('closed_now')}</span><span class="muted">${closedText(s)}</span></li>`).join('')}
            ${soon.map(x => `<li><button class="link" data-sp="${x.s.id}">${esc(spName(x.s))}</button><span class="chip chip-review">D-${x.d}</span><span class="muted">${closedText(x.s)}</span></li>`).join('')}
          </ul>` : `<p class="muted">${t('closed_none')}</p>`}
          <p class="hint">${t('legal_src')}</p>
        </section>
        <section class="card">
          <div class="sec-head tight"><h2 class="h3">${icon('fish')}${t('feed_title')}</h2>${FL.friends.length ? `<div class="seg seg-sm" role="group">${['all', 'fr'].map(k => `<button aria-pressed="${(S.feedF || 'all') === k}" data-feedf="${k}">${t('feed_' + k)}</button>`).join('')}</div>` : ''}</div>
          ${feed.length ? `<ul class="feed">${feed.slice(0, 8).map(({ uid, a, c }) => `
            <li><button class="feed-item" data-catch="${uid}|${c.id}">
              <span class="feed-ph" data-ph="${uid}|${c.id}"><img src="${FD.thumb(SPI[c.sp] || SP[0], 120, 70)}" alt=""></span>
              <span class="feed-txt"><b>${esc(nameOf(c.sp))}</b> <span class="num">${lenFmt(c.len)}</span><br><span class="muted small">${flag(a.cc)} ${esc(a.nick)}${teamTag(uid)} · ${ago(c.at || c.ts)}</span></span>
              <span class="num pts">+${fmtN(c.sc || 0)}</span>
            </button></li>`).join('')}</ul>` : S.feedF === 'fr' ? `<div class="empty"><p>${t('feed_fr_empty')}</p><a class="btn btn-line btn-sm" href="#friends">${t('fr_manage')}</a></div>` : `<div class="empty"><p>${t('feed_empty')}</p><a class="btn btn-line btn-sm" href="#scan">${t('feed_empty_cta')}</a></div>`}
        </section>
      </div>

      <section class="card home-board">
        <div class="sec-head tight"><h2 class="h3">${icon('board')}${t('home_board_title')}</h2><div class="hb-links"><a class="link" href="#teams">${icon('flag')}${myTm && myTm.ok ? esc(myTm.t.name) : t('nav_teams')}</a><a class="link" href="#board">${t('home_board_more')}</a></div></div>
        ${hot.length ? `<ul class="hb-list">${hot.map(p => { const a = anglerOf(p.uid) || { nick: '?' }; return `<li><button class="hb-item" data-post="${esc(p.key)}"><span class="chip chip-cat cat-${esc(p.cat)}">${t('bdc_' + p.cat)}</span><b class="hb-title">${esc(p.title)}</b><span class="muted small hb-meta">${esc(a.nick)} · ${icon('heart')}${p.likes.size} ${icon('chat')}${p.cmts.filter(x => !x.hidden).length}</span></button></li>`; }).join('')}</ul>` : `<div class="empty"><p>${t('home_board_empty')}</p><button class="btn btn-line btn-sm" data-bd="write">${icon('plus')}${t('bd_write')}</button></div>`}
      </section>

      <section class="card me-sum">
        ${S.me && S.me.nick ? `
        <div class="me-row">${avatar(S.me, 48)}<div><p class="lbl">${t('my_season')}</p><h3>${nickHTML(S.me)} ${flag(S.me.cc)}</h3></div></div>
        <div class="stats4">
          <div><span class="num">${rKR ? '#' + rKR.rank : '—'}</span><span>${t('rank_kr')}</span></div>
          <div><span class="num">${fmtN(mine.filter(c => eligible(c, S.uid)).reduce((a, c) => a + (c.sc || 0), 0))}</span><span>${t('total_pts')}</span></div>
          <div><span class="num">${fmtN(mine.length)}</span><span>${t('catches')}</span></div>
          <div><span class="num">${fmtN(new Set(mine.map(c => c.sp)).size)}</span><span>${t('species_n')}</span></div>
        </div>
        <a class="btn btn-line" href="#sea">${icon('sea')}${t('go_my_sea')}</a>` : `
        <div class="me-row">${icon('sparkle', 'big')}<div><h3>${t('onb_card_title')}</h3><p class="muted">${t('onb_card_sub')}</p></div></div>
        <button class="btn btn-primary" data-act="onboard">${t('onb_go')}</button>`}
      </section>

      <section class="help-strip">
        <div><h3>${t('help_strip_title')}</h3><p class="muted">${t('help_strip_sub')}</p></div>
        <div class="help-strip-btns"><a class="btn btn-kakao" href="${DEV.kakaoUrl}" target="_blank" rel="noopener">${icon('chat')}${t('kakao_ask')}</a><button class="btn btn-heart" data-act="donate">${icon('heart')}${t('donate_btn')}</button></div>
      </section>
    </div>`;
    hydratePhotos(el);
    wxHydrate(el);
  }
};
/* Catch photos in lists load when they come near the screen (the drawn fish shows until then) */
const PH_IO = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { PH_IO.unobserve(e.target); PH_WATCH.delete(e.target); loadPh(e.target); } }, { rootMargin: '400px 0px' }) : null;
const PH_WATCH = new Set();
function loadPh(n) { const [uid, cid] = n.dataset.ph.split('|'); store.getPhoto(uid, cid).then(src => { if (src && n.isConnected) n.innerHTML = `<img src="${src}" alt="">`; }); }
function hydratePhotos(root) {
  // lists are redrawn often: stop watching thumbnails that are no longer on the page
  if (PH_IO) for (const n of PH_WATCH) if (!n.isConnected) { PH_IO.unobserve(n); PH_WATCH.delete(n); }
  $$('[data-ph]', root).forEach(n => {
    const [uid, cid] = n.dataset.ph.split('|'); const key = uid + '/' + cid;
    if (S.photoCache.has(key)) { const src = S.photoCache.get(key); if (src) n.innerHTML = `<img src="${src}" alt="">`; return; }
    if (PH_IO) { PH_IO.observe(n); PH_WATCH.add(n); } else loadPh(n);
  });
}

/* ---------- SCAN ---------- */
VIEWS.scan = {
  render(el) {
    S.scan = S.scan || { mode: 'now', phase: 'idle' };
    if (S.route === 'past') S.scan.mode = 'past';
    const sc = S.scan;
    const ls = learnStats();
    const acc = ls.total ? Math.round(ls.correct / ls.total * 100) : null;
    el.innerHTML = `
    <div class="page scan">
      <header class="page-head">
        <h1>${t(sc.mode === 'past' ? 'past_title' : 'scan_title')} <span class="beta-chip">${t('beta')}</span></h1>
        <p class="lede">${t(sc.mode === 'past' ? 'past_sub' : 'scan_sub')}</p>
        <p class="beta-note">${icon('info')} ${t(S.sampleImages ? 'ai_beta_note' : 'ai_free_note')}</p>
        <div class="seg" role="tablist">
          <button role="tab" aria-selected="${sc.mode === 'now'}" data-scanmode="now">${icon('camera')}${t('mode_now')}</button>
          <button role="tab" aria-selected="${sc.mode === 'past'}" data-scanmode="past">${icon('clock')}${t('mode_past')}</button>
        </div>
      </header>
      <div class="scan-grid">
        <div id="scan-work" class="scan-work"></div>
        <aside class="scan-side">${scanSideHTML()}</aside>
      </div>
    </div>`;
    renderScanWork();
  }
};
function scanSideHTML() {
  const sc = S.scan || { mode: 'now' };
  const ls = learnStats();
  const acc = ls.total ? Math.round(ls.correct / ls.total * 100) : null;
  return `
          <div class="card">
            <h3 class="h4">${icon('sparkle')}${t('how_title')}</h3>
            <ol class="how">
              <li><b>${t('how1')}</b><span>${t('how1d')}</span></li>
              <li><b>${t('how2')}</b><span>${t('how2d')}</span></li>
              <li><b>${t('how3')}</b><span>${t('how3d')}</span></li>
              <li><b>${t('how4')}</b><span>${t('how4d')}</span></li>
            </ol>
          </div>
          <div class="card learn">
            <h3 class="h4">${icon('layers')}${t('learn_title')}</h3>
            <div class="stats2"><div><span class="num">${fmtN(ls.total)}</span><span>${t('learn_n')}</span></div><div><span class="num">${acc == null ? '—' : acc + '%'}</span><span>${t('learn_acc')}</span></div></div>
            ${ls.confusions.length ? `<p class="small muted">${t('learn_conf')}</p><ul class="conf">${ls.confusions.slice(0, 4).map(c => `<li>${esc(nameOf(c.p))} → <b>${esc(nameOf(c.a))}</b> <span class="muted">×${c.n}</span></li>`).join('')}</ul>` : `<p class="small muted">${t('learn_empty')}</p>`}
          </div>
          <div class="card note-card">${icon(S.sampleImages ? 'sparkle' : 'lens')}<div><p><b>${t(S.sampleImages ? 'ai_on_title' : 'ai_off_title')}</b></p><p class="small">${t(S.sampleImages ? 'ai_on_sub' : 'ai_off_sub')}</p>${window.APP_RT === 'web' && S.sampleImages ? `<p class="small muted">${t('ai_provider_note')}</p>` : ''}</div></div>`;
}
function renderScanWork() {
  const box = $('#scan-work'); if (!box) return;
  const sc = S.scan;
  if (sc.phase === 'idle') {
    box.innerHTML = `
      <div class="drop" id="drop" tabindex="0" aria-label="${esc(t('drop_aria'))}">
        <div class="sonar" aria-hidden="true"><i></i><i></i><i></i><span class="sweep"></span></div>
        <h2>${t(sc.mode === 'past' ? 'drop_title_past' : 'drop_title')}</h2>
        <p class="muted">${t('drop_sub')}</p>
        <div class="drop-btns">
          <label class="btn btn-primary btn-lg" for="file-cam">${icon('camera')}${t('take_photo')}</label>
          <label class="btn btn-line btn-lg" for="file-pick">${icon('image')}${t('pick_photo')}</label>
        </div>
        <input type="file" id="file-cam" accept="image/*" capture="environment" hidden>
        <input type="file" id="file-pick" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden>
        <p class="hint">${t(sc.mode === 'past' ? 'drop_hint_past' : 'drop_hint')}</p>
      </div>`;
    const onFile = e => { const f = e.target.files && e.target.files[0]; if (f) startScan(f); e.target.value = ''; };
    $('#file-cam').addEventListener('change', onFile); $('#file-pick').addEventListener('change', onFile);
    const drop = $('#drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) startScan(f); });
    return;
  }
  const steps = sc.steps || [];
  const stepHTML = `<ol class="steps">${steps.map(s => `<li class="st-${s.st}">${icon(s.st === 'done' ? 'check' : s.st === 'fail' ? 'x' : s.st === 'warn' ? 'warn' : 'dot')}<span>${esc(s.label)}</span>${s.note ? `<em>${esc(s.note)}</em>` : ''}</li>`).join('')}</ol>`;
  const photo = `<div class="scan-photo ${sc.phase === 'work' ? 'busy' : ''}"><img src="${sc.url}" alt="${esc(t('your_photo'))}">${sc.phase === 'work' ? `<div class="scan-overlay"><span class="sweep"></span><div class="grid"></div></div>` : ''}</div>`;
  if (sc.phase === 'work') {
    box.innerHTML = `<div class="work card">${photo}<div class="work-side"><h2>${t('analyzing')}</h2>${stepHTML}<button class="btn btn-ghost btn-sm" data-act="scan-stop">${icon('stop')}${t('stop')}</button></div></div>`;
    return;
  }
  if (sc.phase === 'error') {
    box.innerHTML = `<div class="work card">${photo}<div class="work-side"><h2>${t('scan_err_title')}</h2>${stepHTML}<p class="err">${esc(sc.err || '')}</p><div class="actions"><button class="btn btn-primary" data-act="scan-retry">${icon('refresh')}${t('retry')}</button><button class="btn btn-line" data-act="scan-manual">${t('choose_manually')}</button><button class="btn btn-ghost" data-act="scan-reset">${t('new_photo')}</button></div></div></div>`;
    return;
  }
  if (sc.phase === 'nofish') {
    box.innerHTML = `<div class="work card">${photo}<div class="work-side"><h2>${t('nofish_title')}</h2><p>${t('nofish_sub')}</p>${stepHTML}<div class="actions"><button class="btn btn-primary" data-act="scan-reset">${icon('camera')}${t('new_photo')}</button><button class="btn btn-line" data-act="scan-manual">${t('nofish_review')}</button></div><p class="hint">${t('nofish_hint')}</p></div></div>`;
    return;
  }
  if (sc.phase === 'reject') {
    box.innerHTML = `<div class="work card">${photo}<div class="work-side"><h2>${t('reject_title')}</h2><p>${t(sc.rejectKey || 'reject_sub')}</p>${trustHTML(sc.trust)}<div class="actions"><button class="btn btn-primary" data-act="scan-reset">${t('new_photo')}</button><a class="btn btn-line" href="#help">${t('ask_review')}</a></div></div></div>`;
    return;
  }
  if (sc.phase === 'result' || sc.phase === 'form') {
    const top = sc.chosen || (sc.fused && sc.fused.list[0] && sc.fused.list[0].id);
    const sp = SPI[top];
    const conf = sc.fused && sc.fused.list.find(x => x.id === top);
    box.innerHTML = `
      <div class="result card">
        ${photo}
        <div class="result-main">
          <p class="eyebrow">${t(sc.chosen && sc.corrected ? 'res_corrected' : sc.ai ? 'res_ai' : 'res_manual')}${sc.ai && !sc.corrected ? ` <span class="beta-chip">${t('beta')}</span>` : ''}</p>
          <div class="res-head">
            <img class="res-sprite" src="${sp ? FD.thumb(sp, 220, 120) : ''}" alt="" width="220" height="120">
            <div>
              <h2>${sp ? esc(spName(sp)) : esc(top ? nameOf(top) : t('unknown_fish'))}</h2>
              <p class="sci">${sp ? esc(sp.sci) : esc(sc.fused && sc.fused.other ? (sc.fused.other.sci || '') : '')}</p>
              ${conf && !sc.corrected ? `<div class="conf-ring" style="--p:${Math.round(conf.p * 100)}"><span class="num">${Math.round(conf.p * 100)}%</span><span>${t('confidence')}</span></div>` : ''}
            </div>
          </div>
          <div class="chips">${toxChip(sp, true)}${sp && isClosed(sp) ? `<span class="chip chip-closed big">${icon('lock')}${t('closed_now')} · ${closedText(sp)}</span>` : ''}${sp && sp.lg && sp.lg.min ? `<span class="chip chip-review big">${t('lg_min_short', { n: sp.lg.min })}</span>` : ''}</div>
          ${sp && sp.tox ? `<div class="tox-panel tox-${sp.tox} slim"><p><b>${t('tox_' + ['', 'poison', 'sting', 'cig', 'caution'][sp.tox])}</b> — ${t('toxd_' + sp.tox)}</p></div>` : ''}
          ${sc.ai && sc.ai.features ? `<p class="features">${icon('eye')} ${esc(sc.ai.features)}</p>` : ''}
          ${sc.fused && sc.fused.list.length > 1 && !sc.corrected ? `<div class="alts"><span class="muted small">${t('alts')}</span>${sc.fused.list.slice(1, 4).map(x => `<button class="chip chip-tab" data-pickalt="${x.id}">${esc(nameOf(x.id))} ${Math.round(x.p * 100)}%</button>`).join('')}</div>` : ''}
          ${sc.ai && !sc.corrected ? `<p class="hint">${icon('info')} ${t('ai_maybe_wrong')}</p>` : ''}
          ${sc.phase === 'result' ? (top ? `<div class="actions"><button class="btn btn-primary btn-lg" data-act="ask-confirm">${t('continue')}</button><button class="btn btn-line" data-act="lens">${icon('lens')}${t('lens_btn')}</button><button class="btn btn-ghost" data-act="scan-reset">${t('new_photo')}</button></div>`
            : `<div class="actions"><button class="btn btn-primary btn-lg" data-act="scan-manual">${icon('layers')}${t('pick_species')}</button><button class="btn btn-line" data-act="lens">${icon('lens')}${t('lens_btn')}</button><button class="btn btn-ghost" data-act="scan-reset">${t('new_photo')}</button></div>`) : `<div class="actions"><button class="btn btn-ghost btn-sm" data-act="scan-manual">${t('change_species')}</button></div>`}
        </div>
      </div>
      ${sc.phase === 'form' ? registerFormHTML() : ''}`;
    if (sc.phase === 'form') bindRegisterForm();
    return;
  }
  if (sc.phase === 'done') {
    const c = sc.saved; const sp = SPI[c.sp];
    box.innerHTML = `<div class="done card">
      <div class="done-art"><img src="${sp ? FD.thumb(sp, 300, 160) : ''}" alt=""></div>
      <h2>${t(c.st === 'ok' ? 'done_title' : 'done_review_title')}</h2>
      <p class="lede">${t(c.st === 'ok' ? 'done_sub' : 'done_review_sub', { name: esc(nameOf(c.sp)), len: lenFmt(c.len) })}</p>
      <div class="done-score"><span class="num">+${fmtN(c.sc || 0)}</span><span>pt</span>${statusChip(c.st, c.tr)}${c.st === 'ok' ? `<span class="lv-chip">+${fmtN(sc.xpGain || 0)} XP</span>` : `<span class="lv-chip lv-wait">${t('xp_after_review')}</span>`}</div>
      ${sc.lvUp ? `<div class="lvup">${icon('star')}<div><b>${t('lv_up', { n: sc.lvUp })}</b>${sc.unlocks && sc.unlocks.length ? `<p class="small">${t('unlock_line', { name: esc(sc.unlocks.map(id => dict(SHOPI[id].n)).slice(0, 4).join(', ')) })}</p>` : ''}</div><a class="btn btn-light btn-sm" href="#sea">${t('go_decorate')}</a></div>` : ''}
      ${trustHTML(sc.trust)}
      <div class="actions"><button class="btn btn-primary" data-act="scan-reset">${icon('camera')}${t('scan_another')}</button><button class="btn btn-line" data-share="${esc(myId())}|${esc(c.id)}">${icon('share')}${t('share_btn')}</button><a class="btn btn-line" href="#rank">${icon('trophy')}${t('see_rank')}</a><a class="btn btn-line" href="#sea">${icon('sea')}${t('go_my_sea')}</a></div>
    </div>`;
  }
}
function trustHTML(tr) {
  if (!tr) return '';
  return `<details class="trust" ${tr.score < 70 ? 'open' : ''}><summary>${t('trust_title')} <span class="num">${tr.score}</span>/100 <span class="trust-meter"><i style="width:${tr.score}%"></i></span></summary>
    <ul>${tr.items.map(i => `<li class="${i.ok === true ? 'ok' : i.ok === false ? 'bad' : 'neutral'}">${icon(i.ok === true ? 'check' : i.ok === false ? 'x' : 'dot')}<span>${t('tr_' + i.k)}</span><em>${i.pts > 0 ? '+' : ''}${i.pts}</em></li>`).join('')}</ul></details>`;
}
function setStep(i, st, note) { const s = S.scan.steps[i]; if (s) { s.st = st; if (note != null) s.note = note; } renderScanWork(); }
async function startScan(file) {
  const sc = S.scan; if (sc.url) URL.revokeObjectURL(sc.url);
  Object.assign(sc, { phase: 'work', file, chosen: null, corrected: false, ai: null, fused: null, err: null, trust: null, saved: null });
  sc.steps = [
    { label: t('step_exif'), st: 'run' }, { label: t('step_dup'), st: 'wait' }, { label: t('step_ai'), st: 'wait' },
    { label: t('step_prior'), st: 'wait' }, { label: t('step_tox'), st: 'wait' }
  ];
  try {
    const { im, url } = await loadImageFile(file); sc.url = url; sc.im = im;
  } catch (e) { sc.url = ''; sc.phase = 'error'; sc.err = t('img_decode_err'); renderScanWork(); return; }
  renderScanWork();
  sc.exif = await readExif(file); sc.fname = fileNameInfo(file.name);
  const exN = sc.exif ? [sc.exif.ts ? t('exif_has_date') : '', sc.exif.make ? (sc.exif.make + ' ' + (sc.exif.model || '')).trim() : '', sc.exif.lat != null ? 'GPS' : ''].filter(Boolean).join(' · ') : t('exif_none');
  setStep(0, sc.exif && sc.exif.ts ? 'done' : 'warn', exN);
  const big = canvasFrom(sc.im, 1280); sc.blob = await toBlob(big, .86);
  sc.thumb = canvasFrom(sc.im, 360).toDataURL('image/jpeg', .74);
  sc.hash = dhash(sc.im);
  sc.dup = findDuplicate(sc.hash);
  setStep(1, sc.dup ? 'fail' : 'done', sc.dup ? t('dup_found') : t('dup_none'));
  sc.month = new Date(sc.exif && sc.exif.ts ? sc.exif.ts : nowMs()).getMonth();
  const home = GEO.HOME[homeRegion()] || [128.4, 34.7];
  sc.lon = sc.exif && sc.exif.lat != null ? sc.exif.lon : null; sc.lat = sc.exif && sc.exif.lat != null ? sc.exif.lat : null;
  const lon = sc.lon ?? home[0], lat = sc.lat ?? home[1];
  await GEO.loadEnv();
  const env = GEO.envAt(lon, lat); const rg = GEO.region(lon, lat, env ? env.water : true);
  sc.rg = rg;
  if (sc.dup && sc.mode === 'past') { sc.trust = trustScore({ exif: sc.exif, fname: sc.fname, dup: true, ai: null, past: true, skipAi: true }); sc.phase = 'reject'; sc.rejectKey = 'reject_dup'; renderScanWork(); return; }
  if (!S.sample || !S.sampleImages) {
    // free mode: no AI, so the person picks (Google Lens can help) and the operator checks the photo
    setStep(2, 'warn', t('ai_off'));
    const pr = GEO.prior(lon, lat, sc.month);
    sc.sugg = [...pr].sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]).filter(id => SPI[id]);
    setStep(3, 'done', sc.lon != null ? t('prior_gps') : t('prior_home', { rg: regionName(homeRegion()) })); setStep(4, 'done');
    sc.noAI = true; sc.fused = { list: [], other: null }; sc.phase = 'result'; renderScanWork(); openTrainPicker(true); return;
  }
  sc.noAI = false; sc.sugg = null;
  setStep(2, 'run', t('ai_running'));
  sc.ctl = new AbortController();
  try {
    sc.ai = await aiIdentify(sc.blob, { region: regionName(rg), month: sc.month, past: sc.mode === 'past' }, sc.ctl.signal);
  } catch (e) {
    if (e && e.code === 'cancelled') { sc.phase = 'idle'; renderScanWork(); return; }
    setStep(2, 'fail', aiErrorText(e)); sc.phase = 'error'; sc.err = aiErrorText(e); renderScanWork(); return;
  }
  setStep(2, 'done', sc.ai.fish_visible === false ? t('ai_nofish') : (sc.ai.candidates[0] ? nameOf(sc.ai.candidates[0].id === 'other' ? 'other:' + (sc.ai.other_en || '?') : sc.ai.candidates[0].id) : '—'));
  const prior = GEO.prior(lon, lat, sc.month);
  sc.fused = fuse(sc.ai, prior);
  setStep(3, 'done', sc.lon != null ? t('prior_gps') : t('prior_home', { rg: regionName(homeRegion()) }));
  const top = sc.fused.list[0] && SPI[sc.fused.list[0].id];
  setStep(4, top && top.tox ? 'warn' : 'done', top && top.tox ? t('tox_' + ['', 'poison', 'sting', 'cig', 'caution'][top.tox]) : t('tox_none'));
  if (sc.ai.fish_visible === false) { sc.phase = 'nofish'; renderScanWork(); return; }
  sc.phase = 'result';
  renderScanWork();
  const p0 = sc.fused.list[0] ? sc.fused.list[0].p : 0;
  if ((sc.fused.list.length && p0 >= .2) || (sc.fused.other && sc.fused.other.p >= .3)) setTimeout(openConfirm, 350); else openTrainPicker(true);
}
function openConfirm() {
  const sc = S.scan; const top = sc.fused.list[0]; const id = top ? top.id : null; const sp = SPI[id];
  const w = openModal(`
    <div class="confirm">
      <img src="${sp ? FD.thumb(sp, 300, 150) : ''}" alt="" width="300" height="150">
      <p class="eyebrow">${t('confirm_eyebrow')}</p>
      <h2>${t('confirm_q', { name: esc(sp ? spName(sp) : (sc.fused.other ? sc.fused.other.en : '?')) })}</h2>
      ${toxChip(sp, true)}
      <p class="muted">${top ? t('confirm_conf', { p: Math.round(top.p * 100) }) : ''}</p>
      <div class="actions col">
        <button class="btn btn-primary btn-lg btn-block" id="cf-yes">${icon('check')}${t('confirm_yes')}</button>
        <button class="btn btn-line btn-lg btn-block" id="cf-no">${icon('layers')}${t('confirm_no')}</button>
      </div>
      <p class="hint">${t('confirm_hint')}</p>
      <p class="beta-note small">${icon('info')} ${t('ai_maybe_wrong')}</p>
    </div>`, { label: t('confirm_eyebrow') });
  $('#cf-yes', w).onclick = () => { closeModal(w); acceptSpecies(id, false); };
  $('#cf-no', w).onclick = () => { closeModal(w); openTrainPicker(false); };
}
function openTrainPicker(manual) {
  const sc = S.scan; const aiSugg = (sc.fused && sc.fused.list.slice(0, 5).map(x => x.id)) || [];
  const sugg = aiSugg.length ? aiSugg : (sc.sugg || []);
  const w = openModal(`
    <div class="trainer">
      <p class="eyebrow">${icon('layers')} ${t(manual ? 'train_eyebrow_manual' : 'train_eyebrow')}</p>
      <h2>${t(manual ? 'train_title_manual' : 'train_title')}</h2>
      <p class="lede">${t(manual ? 'train_sub_manual' : 'train_sub')}</p>
      ${sc.file ? `<button class="lens-row" type="button" data-lens>${icon('lens')}<span><b>${t('lens_btn')}</b><span class="muted small">${t('lens_row_sub')}</span></span></button>` : ''}
      <input class="search" id="tr-q" type="search" placeholder="${esc(t('train_search'))}" autocomplete="off">
      ${sugg.length ? `<p class="small muted">${t(aiSugg.length ? 'train_sugg' : 'train_sugg_prior')}</p><div class="tr-sugg">${sugg.map(id => `<button class="tr-item" data-pick="${id}"><img src="${FD.thumb(SPI[id], 120, 66)}" alt=""><span>${esc(nameOf(id))}</span></button>`).join('')}</div>` : ''}
      <div class="tr-list" id="tr-list"></div>
      <details class="tr-other"><summary>${t('train_notlisted')}</summary><div class="row-inline"><input id="tr-other" maxlength="40" placeholder="${esc(t('train_other_ph'))}"><button class="btn btn-line" id="tr-other-ok">${t('ok')}</button></div></details>
    </div>`, { wide: true, label: t('train_title') });
  const list = $('#tr-list', w);
  const draw = q => {
    q = (q || '').trim().toLowerCase();
    const items = SP.filter(s => !q || s.n.some(n => n.toLowerCase().includes(q)) || s.sci.toLowerCase().includes(q) || s.id.includes(q));
    list.innerHTML = items.slice(0, 60).map(s => `<button class="tr-row" data-pick="${s.id}"><img src="${FD.thumb(s, 90, 50)}" alt=""><span><b>${esc(spName(s))}</b><em>${esc(s.sci)}</em></span>${toxChip(s)}</button>`).join('') || `<p class="muted">${t('no_results')}</p>`;
  };
  draw('');
  $('#tr-q', w).addEventListener('input', e => draw(e.target.value));
  w.addEventListener('click', e => { if (e.target.closest('[data-lens]')) { openLens(); return; } const b = e.target.closest('[data-pick]'); if (b) { closeModal(w); acceptSpecies(b.dataset.pick, !manual); } });
  $('#tr-other-ok', w).onclick = () => {
    const inp = $('#tr-other', w); const v = cleanOtherName(inp.value);
    if (!v) { toast(t('train_other_bad'), 'warn', 4200); inp.focus(); return; }
    closeModal(w); acceptSpecies('other:' + v, !manual);
  };
}
/* A typed-in fish name: 2–30 letters, no links, not just numbers or symbols */
function cleanOtherName(s) {
  const v = String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if ([...v].length < 2 || /https?:|www\.|\.com|[<>{}]/i.test(v) || !/\p{L}/u.test(v)) return '';
  return v;
}
async function acceptSpecies(id, corrected) {
  const sc = S.scan; const pred = sc.fused && sc.fused.list[0] ? sc.fused.list[0].id : null;
  sc.chosen = id; sc.corrected = corrected;
  if (pred || corrected) {
    await store.addLabel({ p: pred || 'none', a: id, c: sc.fused && sc.fused.list[0] ? +sc.fused.list[0].p.toFixed(2) : 0, m: sc.month, g: sc.rg, t: nowMs(), h: sc.hash });
    if (corrected) toast(t('train_done', { n: fmtN(learnStats().total) }), 'ok', 4200);
    const side = $('.scan-side'); if (side) side.innerHTML = scanSideHTML();
  }
  ensureProfile(() => { sc.phase = 'form'; renderScanWork(); const f = $('#rf-len'); if (f) f.focus(); });
}
function registerFormHTML() {
  const sc = S.scan; const sp = SPI[sc.chosen];
  const ts = sc.exif && sc.exif.ts ? sc.exif.ts : nowMs();
  const dt = new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const baits = sp ? [...sp.b.map(b => dict(BAIT[b])), ...sp.lu.map(l => dict(LURE[l]))] : [];
  const loc = sc.lon != null ? `${t('loc_exif')} · <span class="mono">${GEO.fmtLL(sc.lat, sc.lon)}</span>` : t('loc_none');
  return `
  <form class="reg card" id="reg-form" novalidate>
    <h2>${t('reg_title')}</h2>
    <div class="row3">
      <div class="field"><label for="rf-len">${t('reg_len')} <span class="req">*</span></label><div class="unit-in"><input id="rf-len" type="number" inputmode="decimal" min="1" max="600" step="0.1" required placeholder="${sp ? Math.round(sp.L) : 30}"><span>cm</span></div>${sp && sp.lg && sp.lg.min ? `<small class="muted">${t('lg_min_short', { n: sp.lg.min })}${sp.lg.nt === 'tachiuo' ? ' · ' + t('lg_anal') : ''}</small>` : ''}</div>
      <div class="field"><label for="rf-wt">${t('reg_wt')}</label><div class="unit-in"><input id="rf-wt" type="number" inputmode="decimal" min="0" max="900" step="0.01"><span>kg</span></div></div>
      <div class="field"><label for="rf-dt">${t('reg_dt')}</label><input id="rf-dt" type="datetime-local" value="${dt}" max="${new Date(nowMs() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"><small class="muted" id="rf-dt-note"></small></div>
    </div>
    <div class="field"><label>${t('reg_loc')}</label><div class="loc-row"><span id="rf-loc" class="loc-txt">${loc}</span><button type="button" class="btn btn-line btn-sm" id="rf-pick">${icon('pin')}${t('reg_pick')}</button></div><small class="muted">${t('reg_loc_privacy')}</small></div>
    <div class="row2">
      <div class="field"><label for="rf-bait">${t('reg_bait')}</label><input id="rf-bait" list="rf-baits" maxlength="40"><datalist id="rf-baits">${baits.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
      <div class="field"><label for="rf-me">${t('reg_method')}</label><select id="rf-me">${Object.keys(METHOD).map(m => `<option value="${m}" ${(sp ? sp.me[0] : (S.me && S.me.style)) === m ? 'selected' : ''}>${esc(dict(METHOD[m]))}</option>`).join('')}</select></div>
    </div>
    <label class="switch"><input type="checkbox" id="rf-rel"><span class="sw"></span><span>${t('reg_release')} <em class="muted">${t('reg_release_bonus')}</em></span></label>
    <div class="field"><label for="rf-memo">${t('reg_memo')}</label><textarea id="rf-memo" rows="2" maxlength="300" placeholder="${esc(t('reg_memo_ph'))}"></textarea></div>
    ${sc.mode === 'past' ? `<p class="note">${icon('shield')} ${t('reg_past_note2')}</p>` : ''}
    ${!sc.ai ? `<p class="note">${icon('info')} ${t('reg_review_note')}</p>` : sc.ai.fish_visible === false ? `<p class="note">${icon('warn')} ${t('reg_nofish_note')}</p>` : ''}
    ${S.mode !== 'shared' ? `<p class="note">${icon('info')} ${t(S.mode === 'local' ? 'mode_local_note' : 'mode_offline_note')}</p>` : ''}
    <p class="err" id="rf-err" hidden></p>
    <div class="actions"><button class="btn btn-primary btn-lg" type="submit" id="rf-go">${icon('check')}${t('reg_submit')}</button><button class="btn btn-ghost" type="button" data-act="scan-reset">${t('cancel')}</button></div>
  </form>`;
}
function bindRegisterForm() {
  const sc = S.scan; const f = $('#reg-form'); if (!f) return;
  const updDt = () => { const v = $('#rf-dt').value; const ts = v ? new Date(v).getTime() : nowMs(); const old = sc.mode !== 'past' && ts < nowMs() - 3 * 86400000; const n = $('#rf-dt-note'); if (n) n.textContent = old ? t('reg_old_note2') : ''; };
  $('#rf-dt').addEventListener('input', updDt); updDt();
  $('#rf-pick').onclick = () => { const h = GEO.HOME[homeRegion()]; openMapPicker(sc.lon != null ? [sc.lon, sc.lat] : h, pos => { sc.lon = pos[0]; sc.lat = pos[1]; sc.picked = true; const env = GEO.envAt(pos[0], pos[1]); $('#rf-loc').innerHTML = `${esc(env && env.water ? dict(GEO.seaOf(pos[0], pos[1]).n) : t('fresh_land'))} · <span class="mono">${GEO.fmtLL(pos[1], pos[0])}</span>`; }); };
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#rf-err'); err.hidden = true;
    const len = parseFloat($('#rf-len').value);
    if (!len || len <= 0) { err.textContent = t('reg_err_len'); err.hidden = false; $('#rf-len').focus(); return; }
    const sp = SPI[sc.chosen];
    // no fish anyone lands is longer than 6 m, and one we don't know (typed in) over 3 m isn't believable either
    if (len > 600 || (!sp && len > 300)) { err.textContent = t('reg_err_toobig_any', { n: sp ? 600 : 300 }); err.hidden = false; $('#rf-len').focus(); return; }
    const dtv = $('#rf-dt').value; const ts = dtv ? new Date(dtv).getTime() : nowMs();
    // a length far beyond the species record can't be real (the server refuses it too); past the record a person checks it
    if (sp && len > sp.X * 1.3) { err.textContent = t('reg_err_toobig', { n: Math.round(sp.X), name: spName(sp) }); err.hidden = false; $('#rf-len').focus(); return; }
    const record = !!(sp && len > sp.X);
    if (record && f.dataset.warned !== 'rec') { f.dataset.warned = 'rec'; err.textContent = t('reg_warn_record', { n: Math.round(sp.X) }); err.hidden = false; return; }
    if (sp && sp.lg && sp.lg.min && len <= sp.lg.min && !$('#rf-rel').checked) { if (!f.dataset.warned) { f.dataset.warned = '1'; err.textContent = t('reg_warn_small', { n: sp.lg.min }); err.hidden = false; return; } }
    const past = sc.mode === 'past' || (ts < nowMs() - 3 * 86400000);
    $('#rf-go').disabled = true;
    const noAI = !sc.ai;
    const trust = trustScore({ exif: sc.exif, fname: sc.fname, dup: !!sc.dup, ai: sc.ai, len, sp, ts, past, skipAi: noAI });
    sc.trust = trust;
    let st;
    if (sc.dup) st = 'no';
    else if (noAI) st = trust.score >= 30 ? 'review' : 'no';            // without AI a person always checks the photo
    else if (sc.ai.fish_visible === false) st = 'review';               // the AI saw no fish: the operator decides
    else if (past) st = trust.score >= 70 ? 'ok' : trust.score >= 40 ? 'review' : 'no';
    else st = trust.score >= 40 ? 'ok' : 'review';
    const ticket = sc.ai && sc.ai.__ticket; // web build: proof that the server screened this photo
    if (window.APP_RT === 'web' && st === 'ok' && !ticket) st = 'review';
    if (record && st === 'ok') st = 'review';
    if (st === 'no') { sc.phase = 'reject'; sc.rejectKey = sc.dup ? 'reject_dup' : 'reject_sub'; renderScanWork(); return; }
    const lon = sc.lon, lat = sc.lat;
    const env = lon != null ? GEO.envAt(lon, lat) : null;
    const c = {
      id: rid(10), sp: sc.chosen, len: Math.round(len * 10) / 10, wt: parseFloat($('#rf-wt').value) || null, ts, at: nowMs(),
      lat: lon != null ? Math.round(lat * 100) / 100 : null, lon: lon != null ? Math.round(lon * 100) / 100 : null,
      rg: lon != null ? GEO.region(lon, lat, env ? env.water : true) : homeRegion(), sea: !!(env && env.water),
      bait: $('#rf-bait').value.trim().slice(0, 40), me: $('#rf-me').value, rel: $('#rf-rel').checked, past,
      st, tr: trust.score, h: sc.hash, cf: sc.fused && sc.fused.list[0] ? +sc.fused.list[0].p.toFixed(2) : null,
      memo: $('#rf-memo').value.trim().slice(0, 300), src: sc.ai ? 'ai' : 'manual', fn: sc.fname.kind
    };
    if (ticket) c.tk = ticket;
    c.sc = SPI[c.sp] ? scoreOf(c.sp, c.len, c.rel, trust.score >= 70, !past && isFeaturedCatch(c)) : 0;
    const before = lvInfo(S.me, myId());
    S.me.catches = S.me.catches || []; S.me.catches.push(c);
    const after = lvInfo(Object.assign({}, S.me, { upd: nowMs() }), myId());
    sc.xpGain = Math.max(0, after.xp - before.xp);
    sc.lvUp = after.L > before.L ? after.L : 0;
    sc.unlocks = sc.lvUp ? SHOP.filter(x => x.lv && x.lv > before.L && x.lv <= after.L).map(x => x.id) : [];
    await store.saveMe();
    await store.savePhoto(c.id, { t: sc.thumb, h: sc.hash });
    // the automatic reviewer checks it within minutes; nudge it now
    if (st === 'review' && window.APP_AUTH && window.APP_AUTH.review) window.APP_AUTH.review.ping();
    sc.saved = c; sc.phase = 'done'; renderScanWork();
    toast(t(st === 'ok' ? 'reg_ok_toast' : 'reg_review_toast', { pts: fmtN(c.sc) }), st === 'ok' ? 'ok' : 'info', 4000);
  });
}

/* ---------- MAP ---------- */
VIEWS.map = {
  built: false,
  render(el) {
    S.mp = S.mp || { month: new Date().getMonth(), sp: S.mapSp || '', base: 'day', fold: window.innerWidth < 760, tg: { coast: true, urban: true, roads: true, fresh: true, bathy: true, grid: true, heat: true, labels: true } };
    if (S.mapSp) { S.mp.sp = S.mapSp; S.mapSp = null; }
    if (S.mp.tg.points === undefined) S.mp.tg.points = true;
    const focus = () => { if (S.mapFocus && this.map) { const [lo, la, z] = S.mapFocus; S.mapFocus = null; this.map.setView([la, lo], z); } };
    if (this.built && el.querySelector('#map')) { this.refreshPanels(); this.drawMine(); setTimeout(() => { if (this.map) { this.map.invalidateSize(); focus(); } }, 60); return; }
    const mp = S.mp;
    el.innerHTML = `
    <div class="map-wrap">
      <div id="map" class="map" aria-label="${esc(t('map_aria'))}"></div>
      <div class="map-ctl card" id="map-ctl"></div>
      <aside class="map-info card" id="map-info" hidden></aside>
      <div class="map-jump" role="group" aria-label="${esc(t('jump'))}">
        ${[['kr', [127.6, 35.9, 7]], ['jeju', [126.55, 33.38, 9]], ['busan', [129.05, 35.1, 10]], ['ea', [128, 34, 5]], ['world', [140, 25, 2]]].map(([k, v]) => `<button class="chip chip-tab" data-jump="${v.join(',')}">${t('jump_' + k)}</button>`).join('')}
      </div>
      <div class="map-legend card" id="map-legend"></div>
      <div class="map-attr">${t('map_attr')}</div>
    </div>`;
    const map = L.map($('#map', el), { zoomControl: false, attributionControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 11, zoomSnap: .5, maxBounds: [[-85, -400], [85, 400]] });
    const h = GEO.HOME[homeRegion()] || [128, 35];
    map.setView([h[1] || 35.5, h[0] || 128], GEO.KR(homeRegion()) ? 7 : 5);
    L.control.zoom({ position: 'bottomright', zoomInTitle: t('zoom_in'), zoomOutTitle: t('zoom_out') }).addTo(map);
    const LY = MAPX.makeLayers(L);
    this.sat = new LY.Sat({ night: mp.base === 'night' }).addTo(map);
    this.heat = new LY.Heat({ value: this.heatFn() }); if (mp.tg.heat) this.heat.addTo(map);
    this.vec = new LY.Vec({ toggles: () => Object.assign({ night: S.mp.base === 'night' }, S.mp.tg) }).addTo(map);
    this.labels = MAPX.labelLayer(L, map, () => S.li);
    this.mine = L.layerGroup().addTo(map);
    this.pts = L.layerGroup().addTo(map);
    this.map = map; this.built = true; this.LY = LY;
    setTimeout(focus, 120);
    MAPX.load().then(() => { this.labels.refresh(); this.drawMine(); });
    map.on('click', e => this.inspect(e.latlng.lng, e.latlng.lat));
    el.addEventListener('click', e => { const j = e.target.closest('[data-jump]'); if (j) { const [lo, la, z] = j.dataset.jump.split(',').map(Number); map.flyTo([la, lo], z, { duration: .8 }); } });
    this.refreshPanels();
    setTimeout(() => map.invalidateSize(), 80);
  },
  heatFn() {
    const mp = S.mp; const cache = new Map(); const ver = S.dataVer;
    return (lon, lat, size) => {
      const key = size + ':' + lon.toFixed(3) + ':' + lat.toFixed(3);
      if (cache.has(key)) return cache.get(key);
      let v;
      if (mp.sp) { const post = posterior(lon, lat, mp.month, size); const e = post.list.find(x => x.id === mp.sp); v = e ? Math.min(1, e.p / .22) : 0; }
      else {
        const env = GEO.envAt(lon, lat); const land = env && !env.water;
        if (land && size >= 1) { cache.set(key, 0); return 0; }
        const pr = GEO.prior(lon, lat, mp.month, size / 2); let n = 0; for (const [id, p] of pr) { const sp = SPI[id]; if (p > .015 && GEO.seasonVal(sp, mp.month, lat) >= 2) n++; }
        const d = cellData(lon, lat, size, mp.month).N; v = Math.min(1, n / 22 + d * .05) * (land ? .5 : 1);
      }
      cache.set(key, v); return v;
    };
  },
  redrawHeat() { if (!this.heat) return; this.heat.options.value = this.heatFn(); this.heat.redraw(); },
  refreshPanels() {
    const mp = S.mp; const ctl = $('#map-ctl'); if (!ctl) return;
    const spOpts = SP.slice().sort((a, b) => spName(a).localeCompare(spName(b), locale())).map(s => `<option value="${s.id}" ${mp.sp === s.id ? 'selected' : ''}>${esc(spName(s))}${s.tox ? ' ⚠' : ''}</option>`).join('');
    const tg = mp.tg;
    ctl.innerHTML = `
      <div class="ctl-head"><h2 class="h4">${icon('layers')}${t('map_title')}</h2><button class="btn btn-ghost btn-xs" id="ctl-fold" aria-expanded="${!mp.fold}">${icon(mp.fold ? 'plus' : 'minus')}</button></div>
      <div class="ctl-body" ${mp.fold ? 'hidden' : ''}>
        <div class="seg seg-sm" role="group"><button aria-pressed="${mp.base === 'day'}" data-base="day">${icon('sun')}${t('base_day')}</button><button aria-pressed="${mp.base === 'night'}" data-base="night">${icon('moon')}${t('base_night')}</button></div>
        <label class="field-inline" for="mp-sp"><span>${t('map_species')}</span><select id="mp-sp"><option value="">${t('map_all_species')}</option>${spOpts}</select></label>
        <div class="month">
          <div class="month-top"><span>${t('map_month')}</span><b id="mp-mlbl">${esc(monthName(mp.month))}</b></div>
          <input type="range" min="0" max="11" step="1" value="${mp.month}" id="mp-month" aria-label="${esc(t('map_month'))}">
          <div class="chip-row">${[['spring', 3], ['summer', 6], ['autumn', 9], ['winter', 0]].map(([s, mm]) => `<button class="chip chip-tab" aria-pressed="${seasonOf(mp.month) === s}" data-season="${mm}">${t('season_' + s)}</button>`).join('')}</div>
        </div>
        <fieldset class="toggles"><legend class="sr">${t('layers')}</legend>
          ${['heat', 'coast', 'urban', 'roads', 'fresh', 'bathy', 'grid'].concat(pointsOn() ? ['points'] : []).map(k => `<label class="tg"><input type="checkbox" data-tg="${k}" ${tg[k] ? 'checked' : ''}><span>${t('tg_' + k)}</span></label>`).join('')}
        </fieldset>
        <p class="hint">${t('map_note_detail')}</p>
      </div>`;
    const lg = $('#map-legend');
    if (lg) lg.innerHTML = `<p class="lbl">${mp.sp ? t('legend_sp', { name: esc(nameOf(mp.sp)) }) : t('legend_all')}</p><div class="ramp" style="background:linear-gradient(90deg,${MAPX.PAL.join(',')})"></div><div class="ramp-lbl"><span>${t('low')}</span><span>${t('high')}</span></div><p class="hint">${t('legend_basis')}</p>`;
    $('#ctl-fold').onclick = () => { mp.fold = !mp.fold; this.refreshPanels(); };
    $('#mp-sp').onchange = e => { mp.sp = e.target.value; this.redrawHeat(); this.refreshPanels(); if (this.last) this.inspect(...this.last); };
    $('#mp-month').oninput = e => { mp.month = +e.target.value; $('#mp-mlbl').textContent = monthName(mp.month); this.redrawHeatSoon(); };
    $('#mp-month').onchange = () => { this.refreshPanels(); if (this.last) this.inspect(...this.last); };
    $$('[data-season]', ctl).forEach(b => b.onclick = () => { mp.month = +b.dataset.season; this.redrawHeat(); this.refreshPanels(); if (this.last) this.inspect(...this.last); });
    $$('[data-base]', ctl).forEach(b => b.onclick = () => { mp.base = b.dataset.base; this.sat.options.night = mp.base === 'night'; this.sat.redraw(); this.vec.redraw(); this.refreshPanels(); });
    $$('[data-tg]', ctl).forEach(c => c.onchange = () => { const k = c.dataset.tg; tg[k] = c.checked; if (k === 'heat') { if (c.checked) this.heat.addTo(this.map); else this.heat.remove(); } else if (k === 'points') this.drawMine(); else this.vec.redraw(); });
  },
  redrawHeatSoon: debounce(function () { VIEWS.map.redrawHeat(); }, 160),
  drawMine() {
    if (!this.mine) return; this.mine.clearLayers();
    for (const c of myCatches()) if (c.lat != null) this.mine.addLayer(L.marker([c.lat, c.lon], { icon: L.divIcon({ className: 'my-pin', html: `<i></i>`, iconSize: [14, 14] }), title: nameOf(c.sp) }).on('click', () => openCatch(S.uid || 'local', c.id)));
    // fishing points: mine filled, shared ones outlined
    if (this.pts) {
      this.pts.clearLayers();
      if (pointsOn() && S.mp.tg.points) for (const p of S.points.values()) {
        if (p.lat == null || p.lon == null || !ptVisible(p) || (!p.pub && !ptMine(p))) continue;
        this.pts.addLayer(L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'pt-mark' + (ptMine(p) ? ' mine' : ''), html: icon('pin'), iconSize: [26, 26], iconAnchor: [13, 24] }), title: p.name || '' }).on('click', () => openPoint(p.id)));
      }
    }
  },
  inspect(lon, lat) {
    this.last = [lon, lat];
    const box = $('#map-info'); if (!box) return;
    const mp = S.mp; const z = this.map.getZoom();
    const size = GEO.cellSize(lon, lat, Math.max(6, z));
    const env = GEO.envAt(lon, lat);
    const water = env ? env.water : true;
    const sea = water ? GEO.seaOf(lon, lat) : null;
    const rg = GEO.region(lon, lat, water);
    const post = posterior(lon, lat, mp.month, size);
    const top = post.list.slice(0, 7);
    const toxic = post.list.filter(x => SPI[x.id].tox && x.p > .01).slice(0, 4);
    const closed = GEO.KR(rg) ? post.list.slice(0, 20).filter(x => isClosed(SPI[x.id], new Date(new Date().getFullYear(), mp.month, 15))) : [];
    const baitCount = new Map(); top.slice(0, 4).forEach(x => SPI[x.id].b.forEach((b, i) => baitCount.set(b, (baitCount.get(b) || 0) + x.p * (3 - Math.min(2, i)))));
    const baits = [...baitCount].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b]) => dict(BAIT[b]));
    const ti = GEO.KR(rg) && rg !== 'KF' ? tideInfo(rg) : null;
    const depthTxt = env && env.water ? t('depth_' + Math.max(1, env.depth)) : '';
    const maxP = top[0] ? top[0].p : 1;
    box.hidden = false;
    box.innerHTML = `
      <button class="modal-x" id="mi-x" aria-label="${esc(t('close'))}">${icon('close')}</button>
      <p class="eyebrow">${water ? t('sea_area') : t('fresh_area')}</p>
      <h2>${esc(water ? dict(sea.n) : t('fresh_land'))}</h2>
      <p class="mono small">${GEO.fmtLL(lat, lon)}</p>
      <div class="chips">${`<span class="chip">${esc(regionName(rg))}</span>`}${depthTxt ? `<span class="chip">${esc(depthTxt)}</span>` : ''}${env ? `<span class="chip">${t('coast_dist', { km: Math.round(env.dist) })}</span>` : ''}${ti ? `<span class="chip chip-season">${t('today_tide')} ${esc(ti.label)}</span>` : ''}</div>
      <h3 class="h4">${t('mi_top', { mn: monthName(mp.month) })}</h3>
      <ol class="prob">${top.map(x => `<li><button class="link" data-sp="${x.id}">${esc(nameOf(x.id))}</button><span class="ti">${SPI[x.id].tox ? icon(SPI[x.id].tox === 1 ? 'skull' : 'spike', 'tox-ic') : ''}</span><span class="pbar"><i style="width:${Math.max(4, x.p / maxP * 100)}%"></i></span><span class="num">${fmtN(x.p * 100, 1)}%</span>${x.n ? `<span class="n" title="${esc(t('records'))}">${x.n}</span>` : ''}</li>`).join('')}</ol>
      <p class="hint">${post.N ? t('mi_basis_data', { n: post.N }) : t('mi_basis_prior')}</p>
      ${baits.length ? `<h3 class="h4">${t('mi_baits')}</h3><div class="chips">${baits.map(b => `<span class="chip chip-bait">${esc(b)}</span>`).join('')}</div>` : ''}
      ${toxic.length ? `<div class="tox-panel tox-2 slim"><p><b>${icon('warn')} ${t('mi_toxic')}</b> ${toxic.map(x => esc(nameOf(x.id))).join(', ')}</p></div>` : ''}
      ${closed.length ? `<div class="tox-panel slim closedp"><p><b>${icon('lock')} ${t('mi_closed')}</b> ${closed.map(x => `${esc(nameOf(x.id))} (${closedText(SPI[x.id])})`).join(', ')}</p></div>` : ''}
      <div class="actions"><a class="btn btn-primary btn-sm" href="#scan">${icon('scan')}${t('mi_register')}</a></div>`;
    $('#mi-x').onclick = () => { box.hidden = true; this.last = null; };
  },
  onData() { if (!this.built) return; this.redrawHeat(); this.drawMine(); if (this.last) this.inspect(...this.last); }
};

/* ---------- RANK ---------- */
VIEWS.rank = {
  render(el) {
    S.rk = S.rk || { scope: (S.me && S.me.cc && S.me.cc !== 'KR') ? (EA_CC.includes(S.me.cc) ? 'EA' : 'W') : 'KR', period: 'month', cat: 'points', sp: featuredSpecies()[0] };
    const rk = S.rk;
    const rows = leaderboard(rk.scope, rk.period, rk.cat, rk.cat === 'biggest' ? rk.sp : null);
    const ranked = rows.filter(r => r.rank);
    const me = rows.find(r => r.uid === (S.uid || 'local'));
    const unit = rk.cat === 'points' ? 'pt' : rk.cat === 'biggest' ? 'cm' : rk.cat === 'count' ? t('unit_fish') : t('unit_species');
    const fmtVal = v => rk.cat === 'biggest' ? lenFmt(v) : `${fmtN(v)} ${unit}`;
    const feat = featuredSpecies();
    const spOpts = SP.map(s => `<option value="${s.id}" ${rk.sp === s.id ? 'selected' : ''}>${esc(spName(s))}</option>`).join('');
    const podium = ranked.slice(0, 3);
    el.innerHTML = `
    <div class="page rank">
      <header class="page-head"><h1>${t('rank_title')}</h1><p class="lede">${t('rank_sub')}</p></header>
      <div class="rank-tabs" role="tablist">${['KR', 'EA', 'W', 'FR', 'TEAM'].map(s => `<button role="tab" aria-selected="${rk.scope === s}" data-scope="${s}"><span class="rt-flag">${s === 'KR' ? flag('KR') : s === 'EA' ? flag('KR') + flag('JP') + flag('CN') : s === 'W' ? icon('globe') : s === 'FR' ? icon('users') : icon('flag')}</span><span>${t('scope_' + s)}</span>${s === 'FR' && frLists().inc.length ? `<i class="dot" aria-hidden="true"></i>` : ''}</button>`).join('')}</div>
      ${rk.scope === 'FR' ? `<p class="hint">${icon('users')} ${t('fr_rank_hint')} <a href="#friends">${t('fr_manage')}</a></p>` : ''}
      ${rk.scope === 'TEAM' ? VIEWS.rank.teamHTML() : `<div class="rank-filters">
        <div class="seg seg-sm" role="group">${['points', 'biggest', 'count', 'species'].map(c => `<button aria-pressed="${rk.cat === c}" data-cat="${c}">${t('cat_' + c)}</button>`).join('')}</div>
        <label class="field-inline" for="rk-period"><span>${t('period')}</span><select id="rk-period">${['month', 'season', 'year', 'all'].map(p => `<option value="${p}" ${rk.period === p ? 'selected' : ''}>${t('per_' + p)}</option>`).join('')}</select></label>
        ${rk.cat === 'biggest' ? `<label class="field-inline" for="rk-sp"><span>${t('species')}</span><select id="rk-sp">${spOpts}</select></label>` : ''}
      </div>
      ${rk.scope === 'FR' && !frLists().friends.length ? `
      <div class="empty card big">${icon('users', 'big')}<h2>${t('fr_rank_empty')}</h2><p class="muted">${t('fr_empty_sub')}</p><a class="btn btn-primary" href="#friends">${icon('user-plus')}${t('fr_find_cta')}</a></div>` : ranked.length ? `
      <div class="podium">${[1, 0, 2].map(i => podium[i] ? `<button class="pod pod-${i + 1}" data-seauid="${podium[i].uid}">
        <span class="pod-medal num">${i + 1}</span>${avatar(podium[i].a, 56)}<span class="pod-nick">${nickHTML(podium[i].a)}${teamTag(podium[i].uid)}</span><span class="pod-lv">${lvMini(podium[i].a, podium[i].uid)}</span><span class="muted small">${flag(podium[i].a.cc)} ${esc(ccName(podium[i].a.cc || 'KR'))}</span><span class="num pod-val">${fmtVal(podium[i].val)}</span>
        ${podium[i].best ? `<img src="${FD.thumb(SPI[podium[i].best.sp] || SP[0], 120, 66)}" alt="" class="pod-fish">` : ''}</button>` : `<div class="pod pod-empty pod-${i + 1}"></div>`).join('')}</div>
      <div class="lb card"><table><thead><tr><th>#</th><th>${t('angler')}</th><th class="hide-s">${t('best_catch')}</th><th class="r">${t('cat_' + rk.cat)}</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="${r.uid === (S.uid || 'local') ? 'me' : ''}" data-seauid="${r.uid}"><td class="num">${r.rank || '—'}</td><td><span class="lb-who">${avatar(r.a, 30)}${nickHTML(r.a)}${lvMini(r.a, r.uid)}${teamTag(r.uid)} <span class="muted">${flag(r.a.cc)}</span>${r.local ? `<span class="chip chip-local">${t('st_local')}</span>` : ''}</span></td><td class="hide-s">${r.best ? `${esc(nameOf(r.best.sp))} <span class="muted">${lenFmt(r.best.len)}</span>` : '—'}</td><td class="r num">${fmtVal(r.val)}</td></tr>`).join('')}
      </tbody></table></div>` : `
      <div class="empty card big">
        <div class="empty-art"><img src="${FD.thumb(SPI[feat[0]], 260, 140)}" alt=""></div>
        <h2>${t('rank_empty_title')}</h2><p class="muted">${t('rank_empty_sub')}</p>
        <a class="btn btn-primary" href="#scan">${icon('scan')}${t('cta_scan')}</a>
      </div>`}
      ${me && !me.rank && me.local ? `<p class="note">${icon('info')} ${t('rank_local_note')}</p>` : ''}`}
      <section class="card rules">
        <h2 class="h3">${icon('star')}${t('rules_title')}</h2>
        <ul>
          <li>${t('rule_score')}</li><li>${t('rule_bonus')}</li><li>${t('rule_feat', { list: feat.map(nameOf).join(', ') })}</li><li>${t('rule_verify')}</li><li>${t('rule_ea')}</li>
        </ul>
      </section>
    </div>`;
  },
  teamHTML() {
    const ti = teamIndex(); const mine = teamOf(myId());
    return `<p class="hint">${icon('flag')} ${t('tm_rank_hint')} <a href="#teams">${t('tm_manage')}</a></p>
      ${ti.ranked.length ? `<ul class="tm-list card">${ti.ranked.map(e => teamRow(e, mine && mine.ok ? mine.id : null)).join('')}</ul>` : `<div class="empty card big">${icon('flag', 'big')}<h2>${t('tm_rank_empty')}</h2><p class="muted">${t('tm_none_sub')}</p><a class="btn btn-primary" href="#teams">${icon('plus')}${t('tm_create')}</a></div>`}`;
  }
};

/* ---------- FRIENDS ---------- */
function frBtns(uid, rel, opt = {}) {
  const a = S.anglers.get(uid);
  if (rel === 'in' || rel === 'hidden') return `<button class="btn btn-primary btn-sm" data-fr="acc|${esc(uid)}">${icon('check')}${t('fr_acc')}</button>${rel === 'in' ? `<button class="btn btn-line btn-sm" data-fr="dec|${esc(uid)}">${t('fr_dec')}</button>` : ''}`;
  if (rel === 'out') return `<span class="chip chip-review">${icon('clock')}${t('fr_pending')}</span><button class="btn btn-ghost btn-sm" data-fr="cancel|${esc(uid)}">${t('fr_cancel')}</button>`;
  if (rel === 'friend') return `${opt.inSea ? `<span class="chip chip-ok">${icon('user-check')}${t('fr_is_friend')}</span>` : `<button class="btn btn-line btn-sm" data-seauid="${esc(uid)}">${icon('sea')}${t('fr_visit')}</button>`}<button class="btn btn-ghost btn-sm" data-fr="un|${esc(uid)}">${t('fr_un')}</button>`;
  if (rel === 'none') return a && a.frOff ? `<span class="chip chip-local">${t('fr_off')}</span>` : `<button class="btn btn-primary btn-sm" data-fr="req|${esc(uid)}">${icon('user-plus')}${t('fr_req')}</button>`;
  return '';
}
function frRow(row, rel, sub) {
  const { uid, a } = row;
  return `<li class="fr-row"><button class="fr-who" data-seauid="${esc(uid)}">${avatar(a, 44)}<span class="fr-txt"><span class="fr-name">${nickHTML(a)}${lvMini(a, uid)} <span class="fr-flag">${flag(a.cc)}</span></span><span class="muted small">${sub}</span></span></button><span class="fr-acts">${frBtns(uid, rel)}</span></li>`;
}
function frLastLine(uid, a) { const c = lastCatch(uid, a); return c ? `${esc(nameOf(c.sp))} ${lenFmt(c.len)} · ${ago(c.at || c.ts)}` : t('fr_no_catch'); }
VIEWS.friends = {
  render(el) {
    const head = `<header class="page-head"><h1>${t('fr_title')}</h1><p class="lede">${t('fr_sub')}</p></header>`;
    if (!S.me || !S.me.nick) {
      el.innerHTML = `<div class="page friends">${head}<div class="empty card big">${icon('users', 'big')}<h2>${t('onb_card_title')}</h2><p class="muted">${t('fr_need_profile')}</p><button class="btn btn-primary" data-act="onboard">${t('onb_go')}</button></div></div>`;
      return;
    }
    const L = frLists(); const shared = S.mode === 'shared';
    const code = frCode(myId());
    S.frSort = S.frSort || 'recent';
    const fr = L.friends.map(r => Object.assign({}, r, { last: lastCatch(r.uid, r.a), pts: monthPts(r.uid, r.a) }));
    if (S.frSort === 'points') fr.sort((x, y) => y.pts - x.pts);
    else if (S.frSort === 'name') fr.sort((x, y) => String(x.a.nick).localeCompare(String(y.a.nick), locale()));
    else fr.sort((x, y) => ((y.last && (y.last.at || y.last.ts)) || 0) - ((x.last && (x.last.at || x.last.ts)) || 0));
    const sug = shared ? frSuggest(6) : [];
    const link = window.APP_RT === 'web' ? location.origin + location.pathname + '#add=' + code : '';
    const invite = t(link ? 'fr_invite_msg_web' : 'fr_invite_msg', { code, nick: S.me.nick, link });
    const reqSub = r => { const m = mutualCount(r.uid); return t('fr_req_ago', { ago: ago(r.ts) }) + (m ? ' · ' + t('fr_mutual', { n: m }) : '') + (r.a.home ? ' · ' + esc(regionName(r.a.home)) : ''); };
    el.innerHTML = `
    <div class="page friends">
      ${head}
      ${shared ? '' : `<p class="note">${icon('info')} ${t('fr_local_note')}</p>`}
      <div class="fr-top">
        <section class="card fr-code">
          <p class="eyebrow">${t('fr_code')}</p>
          <div class="fr-code-row" data-copybox><span class="copy-src fr-codev num" aria-label="${esc(code.split('').join(' '))}">${code.slice(0, 3)}-${code.slice(3)}</span><button class="btn btn-line btn-sm" data-copy="${code}">${icon('copy')}${t('copy')}</button></div>
          <button class="btn btn-ghost btn-sm fr-invite" data-copy="${esc(invite)}">${icon('send')}${t('fr_invite_copy')}</button>
          <p class="hint">${t('fr_code_hint')}</p>
        </section>
        <section class="card fr-find">
          <label class="lbl" for="fr-q">${t('fr_search')}</label>
          <input id="fr-q" type="search" class="search" placeholder="${esc(t('fr_search_ph'))}" value="${esc(S.frQ || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" maxlength="20">
          <ul class="fr-list fr-res" id="fr-res" aria-live="polite"></ul>
        </section>
      </div>
      ${L.inc.length ? `<section class="fr-sec"><h2 class="h3">${t('fr_incoming')} <span class="count">${L.inc.length}</span></h2><ul class="fr-list card">${L.inc.map(r => frRow(r, 'in', reqSub(r))).join('')}</ul></section>` : ''}
      <section class="fr-sec">
        <div class="sec-head"><h2 class="h3">${t('fr_list_n', { n: fr.length })}</h2>${fr.length > 1 ? `<div class="seg seg-sm" role="group">${['recent', 'points', 'name'].map(k => `<button aria-pressed="${S.frSort === k}" data-frsort="${k}">${t('fr_sort_' + k)}</button>`).join('')}</div>` : ''}</div>
        ${fr.length ? `<ul class="fr-list card">${fr.map(r => frRow(r, 'friend', `${r.last ? `${esc(nameOf(r.last.sp))} ${lenFmt(r.last.len)} · ${ago(r.last.at || r.last.ts)}` : t('fr_no_catch')}${S.frSort === 'points' ? ` · <b class="num">${fmtN(r.pts)} pt</b>` : ''}`)).join('')}</ul>
        <p class="hint">${icon('trophy')} <a href="#rank" data-frrank>${t('fr_rank_link')}</a></p>` : `
        <div class="empty card">${icon('users', 'big')}<h3>${t('fr_empty_title')}</h3><p class="muted">${t('fr_empty_sub')}</p><a class="btn btn-line btn-sm" href="#rank">${icon('trophy')}${t('see_rank')}</a></div>`}
      </section>
      ${L.out.length ? `<section class="fr-sec"><h2 class="h3">${t('fr_outgoing')} <span class="count">${L.out.length}</span></h2><ul class="fr-list card">${L.out.map(r => frRow(r, 'out', t('fr_req_ago', { ago: ago(r.ts) }))).join('')}</ul><p class="hint">${t('fr_out_hint')}</p></section>` : ''}
      ${sug.length ? `<section class="fr-sec"><h2 class="h3">${t('fr_suggest')}</h2><ul class="fr-list card">${sug.map(r => frRow(r, 'none', esc(r.why))).join('')}</ul></section>` : ''}
      ${L.hidden.length ? `<details class="card fr-hidden"><summary>${t('fr_hidden')} (${L.hidden.length})</summary><p class="hint">${t('fr_hidden_hint')}</p><ul class="fr-list">${L.hidden.map(r => frRow(r, 'hidden', t('fr_req_ago', { ago: ago(r.ts) }))).join('')}</ul></details>` : ''}
    </div>`;
    const q = $('#fr-q', el), res = $('#fr-res', el);
    const run = () => {
      S.frQ = q.value; const v = q.value.trim();
      if (!v) { res.innerHTML = ''; return; }
      const rows = frSearch(v);
      res.innerHTML = rows.length ? rows.map(r => frRow(r, relation(r.uid), `${esc(regionName(r.a.home || 'KS'))} · ${t('fr_n_catches', { n: (r.a.catches || []).length })}`)).join('') : `<li class="fr-none muted small">${t(v.length < 2 && !/^[a-z0-9]{6}$/i.test(v) ? 'fr_search_short' : 'fr_search_none')}</li>`;
    };
    q.addEventListener('input', debounce(run, 120));
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    run();
  }
};

/* ---------- MY SEA ---------- */
VIEWS.sea = {
  render(el) {
    const uid = S.viewUid && S.viewUid !== (S.uid || 'local') ? S.viewUid : null;
    const a = uid ? allAnglers().get(uid) : S.me;
    if (!a || !a.nick) {
      el.innerHTML = `<div class="page sea"><div class="empty card big"><div class="empty-art"><img src="${FD.thumb(SPI.madai, 260, 140)}" alt=""></div><h2>${t('sea_empty_title')}</h2><p class="muted">${t('sea_empty_sub')}</p><button class="btn btn-primary" data-act="onboard">${t('onb_go')}</button></div></div>`;
      return;
    }
    const mine = !uid;
    const cs = (a.catches || []).filter(c => mine || eligible(c, uid));
    const rk = ['KR', 'EA', 'W'].map(s => { const lb = leaderboard(s, 'month', 'points'); const r = lb.find(x => x.uid === (uid || S.uid || 'local')); return r && r.rank ? '#' + r.rank : '—'; });
    const best = cs.slice().sort((x, y) => (y.sc || 0) - (x.sc || 0))[0];
    if (!el.querySelector('#sea-cv') || el.dataset.uid !== (uid || 'me')) {
      el.dataset.uid = uid || 'me';
      el.innerHTML = `<div class="page sea"><header class="sea-head" id="sea-head"></header><div class="scene-wrap"><canvas id="sea-cv" aria-label="${esc(t('sea_canvas_aria'))}"></canvas><div class="scene-tip" id="sea-tip" hidden></div><div class="scene-banner" id="sea-banner" hidden></div></div><div id="sea-rec"></div><div id="sea-body"></div></div>`;
      if (S.scene) S.scene.stop();
      S.scene = new SeaScene($('#sea-cv', el));
      S.scene.onHover = (f, e) => { const tip = $('#sea-tip'); if (!tip) return; if (!f) { tip.hidden = true; return; } const r = $('#sea-cv').getBoundingClientRect(); tip.hidden = false; tip.style.left = clamp(e.clientX - r.left + 12, 8, r.width - 180) + 'px'; tip.style.top = clamp(e.clientY - r.top - 10, 8, r.height - 60) + 'px'; tip.innerHTML = `<b>${esc(nameOf(f.sp))}</b> ${lenFmt(f.len)}<br><span class="muted small">${fmtDate(f.ts)}</span>`; };
      S.scene.onPick = f => openCatch(uid || S.uid || 'local', f.key);
      S.scene.start();
    }
    $('#sea-head', el).innerHTML = `
      <div class="sh-left">${mine ? `<a class="sh-av" href="#char" aria-label="${esc(t('ch_title'))}">${avatar(a, 64)}<span class="sh-av-edit">${icon('gear')}</span></a>` : avatar(a, 64)}<div><p class="eyebrow">${t(mine ? 'my_sea' : 'their_sea')} · ${lvChip(a, uid || myId())} ${esc(lvInfo(a, uid || myId()).title)}</p><h1>${nickHTML(a)}${teamTag(uid || myId())} <span class="flagbig">${flag(a.cc)}</span></h1><p class="muted">${esc(ccName(a.cc || 'KR'))} · ${esc(regionName(a.home || 'KS'))} · ${esc(dict(METHOD[a.style]) || '')}${mine && supporter() ? ` · <span class="chip chip-heart">${icon('heart')}${t('supporter')}</span>` : ''}</p>
        ${mine ? `<p class="sh-fr"><a class="chip chip-tab" href="#char">${icon('user')}${t('ch_edit_btn')}</a><a class="chip chip-tab" href="#friends">${icon('users')}${t('fr_list_n', { n: frLists().friends.length })}${frLists().inc.length ? ` · <b class="acc-txt">${t('fr_new_n', { n: frLists().inc.length })}</b>` : ''}</a></p>` : (S.isOwner ? `<p class="sh-fr">${a.pic && !picHidden(uid, a) ? `<button class="btn btn-ghost btn-xs" data-modav="${esc(uid)}">${t('ad_hide_pic')}</button>` : ''}<button class="btn btn-ghost btn-xs" data-deluser="${esc(uid)}">${icon('x')}${t('ad_del_user')}</button></p>` : '') + `<div class="sh-acts">${frBtns(uid, relation(uid), { inSea: true })}${(() => { const m = mutualCount(uid); return m ? `<span class="muted small">${t('fr_mutual', { n: m })}</span>` : ''; })()}</div>`}</div></div>
      <div class="stats4 sh-stats">
        <div><span class="num">${rk[0]}</span><span>${t('scope_KR')}</span></div><div><span class="num">${rk[1]}</span><span>${t('scope_EA')}</span></div><div><span class="num">${rk[2]}</span><span>${t('scope_W')}</span></div>
        <div><span class="num">${best ? lenFmt(best.len) : '—'}</span><span>${best ? esc(nameOf(best.sp)) : t('best_catch')}</span></div>
      </div>`;
    const fishMap = new Map();
    for (const c of cs.slice().sort((x, y) => (y.len || 0) - (x.len || 0))) if (SPI[c.sp] && !fishMap.has(c.sp)) fishMap.set(c.sp, c);
    const fish = [...fishMap.values()].slice(0, 16).map(c => ({ key: c.id, sp: c.sp, len: c.len, ts: c.ts }));
    // only looks this angler may show (their level, confirmed purchases) — saved data alone is not trusted
    const decor = decorOf(a, uid || myId());
    const ch = charOf(a, uid || myId());
    S.scene.setState({ theme: (decor.theme || 'th_dawn').replace('th_', ''), decor: decor.items, fx: decor.fx, fish, char: ch, rod: a.char ? ch.rd : null, preview: mine && S.preview ? { theme: S.preview.theme, decor: S.preview.decor, fx: S.preview.fx } : null });
    const banner = $('#sea-banner', el);
    if (mine && S.preview) {
      const it = SHOPI[S.preview.id]; banner.hidden = false;
      const act = owned(it.id) ? `<button class="btn btn-primary btn-sm" data-toggle="${it.id}">${t('use_item')}</button>` : it.pr ? (pendingOrders('item', it.id)[0] ? `<span class="chip chip-wait">${icon('clock')}${t('prem_wait')}</span>` : `<button class="btn btn-primary btn-sm" data-buy="${it.id}">${t('prem_buy', { p: fmtN(PREMIUM_PRICE) })}</button>`) : `<span class="chip chip-local">${icon('lock')}${it.top ? t('earned_top10') : t('lock_lv', { n: it.lv })}</span>`;
      banner.innerHTML = `<span>${icon('eye')} ${t('preview_on', { name: esc(dict(it.n)) })}</span>${act}<button class="btn btn-ghost btn-sm" data-act="preview-off">${t('close')}</button>`;
    }
    else banner.hidden = true;
    // newly unlocked looks (levels only — never a purchase nudge) / a friend's look to try on
    const fresh = mine ? this.freshUnlocks() : [];
    const myD = (S.me && S.me.decor) || DEFAULT_DECOR();
    const theirLook = !mine && S.me && S.me.nick ? [decor.theme, ...(decor.items || []), ...(decor.fx || [])].find(id => SHOPI[id] && !SHOPI[id].top && id !== myD.theme && !(myD.items || []).includes(id) && !(myD.fx || []).includes(id)) : null;
    $('#sea-rec', el).innerHTML = fresh.length && !S.recDismiss && !S.preview ? `<div class="rec card new"><img src="${this.itemThumb(fresh[0])}" alt="" width="96" height="60"><div><p class="eyebrow">${t('unlock_eyebrow', { n: myLevel() })}</p><p>${t('unlock_line', { name: esc(fresh.map(id => dict(SHOPI[id].n)).slice(0, 3).join(', ')) })}</p></div><div class="rec-btns"><button class="btn btn-primary btn-sm" data-toggle="${fresh[0]}">${t('use_item')}</button><button class="btn btn-ghost btn-xs" data-act="rec-off" aria-label="${esc(t('close'))}">${icon('close')}</button></div></div>`
      : theirLook ? `<div class="rec card"><img src="${this.itemThumb(theirLook)}" alt="" width="96" height="60"><div><p class="eyebrow no-up">${t('fr_tryon_eyebrow', { nick: esc(a.nick) })}</p><p>${t('fr_tryon_line', { name: esc(dict(SHOPI[theirLook].n)) })}</p></div><div class="rec-btns"><button class="btn btn-line btn-sm" data-tryon="${theirLook}">${icon('eye')}${t('fr_tryon')}</button></div></div>` : '';
    S.seaTab = S.seaTab || 'shop';
    const tabs = mine ? ['shop', 'catches', 'dex', 'badges'] : ['catches', 'dex', 'badges'];
    if (!tabs.includes(S.seaTab)) S.seaTab = tabs[0];
    $('#sea-body', el).innerHTML = `
      ${fish.length ? '' : `<p class="note">${icon('fish')} ${t(mine ? 'sea_nofish' : 'sea_nofish_other')}</p>`}
      <div class="tabs" role="tablist">${tabs.map(k => `<button role="tab" aria-selected="${S.seaTab === k}" data-seatab="${k}">${t('seatab_' + k)}</button>`).join('')}</div>
      <div class="tab-body">${S.seaTab === 'shop' ? this.shopHTML() : S.seaTab === 'catches' ? this.catchesHTML(cs, uid) : S.seaTab === 'badges' ? badgesHTML(a, uid || myId()) : this.dexHTML(cs)}</div>`;
    hydratePhotos(el);
    if (mine && S.seaTab === 'shop' && S.me && myLevel() > (S.me.lvSeen || 1) && !S._lvSeenT) { S._lvSeenT = setTimeout(() => { S._lvSeenT = null; if (S.me) { S.me.lvSeen = myLevel(); store.saveMe(); } }, 4000); }
  },
  freshUnlocks() {
    if (!S.me) return [];
    const L = myLevel(), seen = S.me.lvSeen || 1; if (L <= seen) return [];
    const d = S.me.decor || DEFAULT_DECOR();
    return SHOP.filter(x => x.lv && x.lv > seen && x.lv <= L && d.theme !== x.id && !(d.items || []).includes(x.id) && !(d.fx || []).includes(x.id)).map(x => x.id);
  },
  itemThumb(id) {
    const key = 'item:' + id; if (FD._it && FD._it[key]) return FD._it[key];
    FD._it = FD._it || {};
    const c = document.createElement('canvas'); c.width = 240; c.height = 150; c.style.width = '240px'; c.style.height = '150px';
    document.body.appendChild(c); c.style.position = 'absolute'; c.style.left = '-9999px';
    const sc = new SeaScene(c, { thumb: true }); const it = SHOPI[id]; const inc = it.inc || [id];
    const theme = (inc.find(x => SHOPI[x].k === 'theme') || (id === 'pr_gold' ? 'th_sunset' : 'th_day')).replace('th_', '');
    const decor = ['dc_weed', 'dc_rock', ...inc.filter(x => SHOPI[x].k === 'decor')];
    const ch = S.me && S.me.char ? S.me.char : CH.DEF;
    sc.setState({ theme, decor, fx: inc.filter(x => SHOPI[x].k === 'fx'), fish: it.k === 'flair' ? [] : [{ key: 'a', sp: 'madai', len: 45 }], char: Object.assign({}, ch, id === 'pr_gold' ? { rd: 'gold' } : {}), rod: id === 'pr_gold' ? 'gold' : ch.rd, hideChar: it.k === 'flair' });
    sc.t = 2.2; sc.frame(16, true);
    if (it.k === 'flair') { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, c.width, c.height); x.font = '700 34px "Big Shoulders Display", sans-serif'; x.textAlign = 'center'; x.fillStyle = id === 'fl_gold' ? '#ffd54a' : '#fff'; x.fillText(APP_NAME[1], c.width / 2, c.height / 2 + 12); x.strokeStyle = id === 'fl_gold' ? '#ffd54a' : '#3fb6d8'; x.lineWidth = 6; x.beginPath(); x.arc(c.width / 2, c.height / 2, 54, 0, Math.PI * 2); x.stroke(); }
    sc.stop(); if (sc._ro) sc._ro.disconnect();
    const url = c.toDataURL('image/jpeg', .82); c.remove(); FD._it[key] = url; return url;
  },
  shopHTML() {
    const kinds = ['theme', 'decor', 'fx', 'flair'];
    S.shopKind = S.shopKind && (S.shopKind === 'all' || kinds.includes(S.shopKind)) ? S.shopKind : 'all';
    const d = Object.assign(DEFAULT_DECOR(), (S.me && S.me.decor) || {});
    const fl = (S.me && S.me.flair) || {};
    const active = id => { const it = SHOPI[id]; if (it.k === 'theme') return d.theme === id; if (it.k === 'decor') return (d.items || []).includes(id); if (it.k === 'fx') return (d.fx || []).includes(id); if (it.k === 'flair') return id === 'fl_gold' ? !!fl.gold : !!fl.frame; if (it.k === 'set') return it.inc.every(x => active(x)); return false; };
    const li = lvInfo(S.me, myId()); const seen = (S.me && S.me.lvSeen) || 1;
    const pct = Math.round((li.xp - li.cur) / Math.max(1, li.next - li.cur) * 100);
    const nextUnlock = SHOP.filter(x => x.lv && x.lv > li.L).sort((a, b) => a.lv - b.lv)[0];
    const card = s => {
      const own = owned(s.id), on = own && active(s.id), isNew = s.lv && s.lv > seen && own;
      const btn = own ? (s.k === 'theme' ? (on ? `<span class="chip chip-ok">${t('in_use')}</span>` : `<button class="btn btn-primary btn-sm" data-toggle="${s.id}">${t('use_item')}</button>`)
        : `<button class="btn btn-sm ${on ? 'btn-line' : 'btn-primary'}" data-toggle="${s.id}">${on ? t('remove') : t('use_item')}</button>`)
        : `<button class="btn btn-ghost btn-sm" data-preview="${s.id}">${icon('eye')}${t('try_on')}</button>`;
      const tag = own ? (isNew ? `<span class="chip chip-new">NEW</span>` : '') : s.top ? `<span class="chip chip-feat">${t('earned_top10')}</span>` : s.in ? `<span class="chip chip-prem">${t('premium')}</span>` : `<span class="chip chip-lock">${icon('lock')}Lv.${s.lv}</span>`;
      return `<div class="shop-item ${on ? 'on' : ''}${own ? '' : ' locked'}"><img src="${this.itemThumb(s.id)}" alt="" width="240" height="150" loading="lazy"><div class="si-txt"><b>${esc(dict(s.n))}</b>${tag}</div><div class="si-btns">${btn}</div></div>`;
    };
    const prem = SHOP.filter(s => s.pr);
    return `
      <div class="lv-card card">
        <div class="lv-l"><span class="lv-chip big">Lv.${li.L}</span><div><b>${esc(li.title)}</b><p class="muted small">${t('xp_left', { n: fmtN(Math.max(0, li.next - li.xp)) })}${nextUnlock ? ' · ' + t('next_unlock', { name: esc(dict(nextUnlock.n)), n: nextUnlock.lv }) : ''}</p></div></div>
        <div class="meter xp"><i style="width:${pct}%"></i></div>
        <p class="hint">${t('decor_free_note')}</p>
      </div>
      <h3 class="h4">${icon('star')}${t('premium_title')}</h3>
      <div class="prem-grid">${prem.map(s => { const own = owned(s.id); const wait = !own && pendingOrders('item', s.id)[0]; return `<div class="prem-item${own ? ' owned' : ''}"><img src="${this.itemThumb(s.id)}" alt="" width="240" height="150" loading="lazy"><div class="pi-txt"><b>${esc(dict(s.n))}</b><p class="muted small">${t('prem_desc_' + s.id)}</p>${wait ? `<p class="small"><span class="chip chip-wait">${icon('clock')}${t('prem_wait')}</span> <span class="mono small">${esc(wait.code)}</span></p>` : ''}</div><div class="si-btns">${own ? (active(s.id) ? `<span class="chip chip-ok">${t('in_use')}</span>` : `<button class="btn btn-primary btn-sm" data-toggle="${s.id}">${t('use_item')}</button>`) : `<button class="btn btn-ghost btn-sm" data-preview="${s.id}">${icon('eye')}${t('try_on')}</button>${wait ? '' : `<button class="btn btn-primary btn-sm" data-buy="${s.id}">${t('prem_buy', { p: fmtN(PREMIUM_PRICE) })}</button>`}`}</div></div>`; }).join('')}</div>
      <p class="hint">${t('prem_note')}</p>
      <div class="chip-row shop-kinds">${['all', ...kinds].map(k => `<button class="chip chip-tab" aria-pressed="${S.shopKind === k}" data-shopkind="${k}">${k === 'all' ? t('shop_all') : t('kind_' + k)}</button>`).join('')}</div>
      ${(S.shopKind === 'all' ? kinds : [S.shopKind]).map(k => `<h3 class="h4">${t('kind_' + k)}</h3><div class="shop-grid">${SHOP.filter(s => s.k === k && !s.pr).map(card).join('')}</div>`).join('')}`;
  },
  catchesHTML(cs, uid) {
    if (!cs.length) return `<div class="empty"><p class="muted">${t('no_catches')}</p>${!uid ? `<a class="btn btn-primary btn-sm" href="#scan">${t('cta_scan')}</a>` : ''}</div>`;
    return `<div class="catch-grid">${cs.slice().sort((a, b) => b.ts - a.ts).map(c => `<button class="catch-card" data-catch="${uid || S.uid || 'local'}|${c.id}"><span class="cc-ph" data-ph="${uid || S.uid || 'local'}|${c.id}"><img src="${FD.thumb(SPI[c.sp] || SP[0], 200, 110)}" alt=""></span><span class="cc-txt"><b>${esc(nameOf(c.sp))}</b> <span class="num">${lenFmt(c.len)}</span><br><span class="muted small">${fmtDate(c.ts)}${c.past ? ' · ' + t('past_short') : ''}</span></span>${statusChip(catchState(uid || S.uid || 'local', c), c.tr, logOnly(uid || S.uid || 'local', c))}</button>`).join('')}</div>`;
  },
  dexHTML(cs) {
    const got = new Set(cs.map(c => c.sp));
    const kr = SP.filter(s => s.ab.KS || s.ab.KW || s.ab.KE || s.ab.KJ || s.ab.KF);
    const n = kr.filter(s => got.has(s.id)).length;
    return `<p><b class="num">${n}</b> / ${kr.length} ${t('dex_progress')}</p><div class="meter"><i style="width:${Math.round(n / kr.length * 100)}%"></i></div>
      <div class="dex-mini">${kr.map(s => `<button class="dm ${got.has(s.id) ? 'got' : ''}" data-sp="${s.id}" title="${esc(spName(s))}"><img src="${FD.thumb(s, 100, 56)}" alt=""><span>${esc(spName(s))}</span></button>`).join('')}</div>`;
  }
};

/* ---------- DEX ---------- */
VIEWS.dex = {
  render(el) {
    S.dx = S.dx || { q: '', f: 'all' };
    const dx = S.dx; const m = new Date().getMonth();
    const got = new Set(myCatches().map(c => c.sp));
    const filters = ['all', 'sea', 'fresh', 'season', 'toxic', 'mine'];
    const list = SP.filter(s => {
      const q = dx.q.trim().toLowerCase();
      if (q && !(s.n.some(n => n.toLowerCase().includes(q)) || s.sci.toLowerCase().includes(q))) return false;
      if (dx.f === 'sea') return s.w !== 'F'; if (dx.f === 'fresh') return s.w === 'F' || s.w === 'B';
      if (dx.f === 'season') return +s.mo[m] >= 3; if (dx.f === 'toxic') return s.tox > 0; if (dx.f === 'mine') return got.has(s.id);
      return true;
    });
    el.innerHTML = `
    <div class="page dex">
      <header class="page-head"><h1>${t('dex_title')}</h1><p class="lede">${t('dex_sub', { n: SP.length })}</p></header>
      <div class="dex-bar"><input type="search" class="search" id="dx-q" value="${esc(dx.q)}" placeholder="${esc(t('dex_search'))}" aria-label="${esc(t('dex_search'))}">
        <div class="chip-row">${filters.map(f => `<button class="chip chip-tab" aria-pressed="${dx.f === f}" data-dxf="${f}">${t('dxf_' + f)}</button>`).join('')}</div></div>
      <p class="muted small">${t('dex_count', { n: list.length })}</p>
      <div class="sp-grid">${list.map(s => spCard(s.id, got.has(s.id) ? `<span class="chip chip-ok">${t('caught')}</span>` : '')).join('') || `<p class="muted">${t('no_results')}</p>`}</div>
    </div>`;
    const q = $('#dx-q', el); q.addEventListener('input', debounce(e => { dx.q = e.target.value; const pos = q.selectionStart; this.render(el); const nq = $('#dx-q', el); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e2) { } }, 220));
  }
};

/* ---------- TACKLE ---------- */
VIEWS.tackle = {
  render(el) {
    S.tk = S.tk || { sp: '', time: 'day', water: 'clear', method: '' };
    if (S.tackleSp) { S.tk.sp = S.tackleSp; S.tackleSp = null; }
    const tk = S.tk; const m = new Date().getMonth(); const rg = homeRegion();
    const auto = inSeasonTop(rg, m, 6).map(x => x.id);
    const sp = SPI[tk.sp] || SPI[auto[0]];
    const spOpts = SP.slice().sort((a, b) => spName(a).localeCompare(spName(b), locale())).map(s => `<option value="${s.id}" ${sp.id === s.id ? 'selected' : ''}>${esc(spName(s))}</option>`).join('');
    const night = ['mebaru', 'tachiuo', 'surumeika', 'kensakiika', 'namazu', 'unagi', 'gonzui', 'maaji', 'isaki', 'gigi', 'walleye', 'snook', 'akaei'].includes(sp.id);
    const colors = this.colors(tk.water, tk.time);
    const methods = tk.method && sp.me.includes(tk.method) ? [tk.method] : sp.me;
    el.innerHTML = `
    <div class="page tackle">
      <header class="page-head"><h1>${t('tk_title')}</h1><p class="lede">${t('tk_sub')}</p></header>
      <div class="tk-grid">
        <section class="card tk-form">
          <label class="field" for="tk-sp"><span>${t('tk_target')}</span><select id="tk-sp">${spOpts}</select></label>
          <div class="chip-row"><span class="muted small">${t('tk_auto', { rg: esc(regionName(rg)) })}</span>${auto.map(id => `<button class="chip chip-tab" aria-pressed="${sp.id === id}" data-tksp="${id}">${esc(nameOf(id))}</button>`).join('')}</div>
          <div class="row2">
            <div class="field"><span>${t('tk_time')}</span><div class="seg seg-sm">${['dawn', 'day', 'dusk', 'night'].map(x => `<button aria-pressed="${tk.time === x}" data-tktime="${x}">${t('time_' + x)}</button>`).join('')}</div></div>
            <div class="field"><span>${t('tk_water')}</span><div class="seg seg-sm">${['clear', 'stained', 'murky'].map(x => `<button aria-pressed="${tk.water === x}" data-tkwater="${x}">${t('water_' + x)}</button>`).join('')}</div></div>
          </div>
        </section>
        <section class="card tk-res">
          <div class="tk-head"><img src="${FD.thumb(sp, 220, 120)}" alt="" width="220" height="120"><div><h2>${esc(spName(sp))}</h2>${toxChip(sp)}<p class="muted small">${t('tk_best_time')}: ${night ? t('time_night') : t('time_dawn') + ' · ' + t('time_dusk')}${sp.w !== 'F' ? ' · ' + t('tk_tide_tip') : ''}</p></div></div>
          <h3 class="h4">${t('rec_baits')}</h3><ol class="rank-list">${sp.b.map((b, i) => `<li><span class="num">${i + 1}</span>${esc(dict(BAIT[b]))}</li>`).join('') || `<li class="muted">${t('tk_no_bait')}</li>`}</ol>
          <h3 class="h4">${t('rec_lures')}</h3>${sp.lu.length ? `<ol class="rank-list">${sp.lu.map((l, i) => `<li><span class="num">${i + 1}</span>${esc(dict(LURE[l]))}</li>`).join('')}</ol>
          <div class="colors"><span class="muted small">${t('tk_colors')}</span>${colors.map(c => `<span class="swatch" style="--c:${c[0]}"></span><span class="small">${esc(dict(c[1]))}</span>`).join('')}</div>` : `<p class="muted">${t('tk_no_lure')}</p>`}
          <h3 class="h4">${t('rec_methods')}</h3><div class="chips">${methods.map(x => `<span class="chip">${esc(dict(METHOD[x]))}</span>`).join('')}</div>
          <div class="tip-box">${icon('sparkle')}<p>${esc(dict(sp.t))}</p></div>
          ${sp.lg && (sp.lg.min || sp.lg.cl) ? `<p class="small">${icon('lock')} ${sp.lg.min ? t('lg_min_short', { n: sp.lg.min }) : ''} ${sp.lg.cl ? t('lg_closed', { d: closedText(sp) }) : ''}</p>` : ''}
        </section>
      </div>
      <section class="card coach">
        <h2 class="h3">${icon('chat')}${t('coach_title')}</h2>
        <p class="muted small">${t('coach_sub')}</p>
        <div class="chat" id="coach-log">${(S.coach || []).map(m => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('') || `<div class="chat-empty">${['coach_q1', 'coach_q2', 'coach_q3'].map(k => `<button class="chip chip-tab" data-coachq="${esc(t(k, { name: spName(sp) }))}">${esc(t(k, { name: spName(sp) }))}</button>`).join('')}</div>`}</div>
        <form class="chat-in" id="coach-form"><input id="coach-q" maxlength="300" placeholder="${esc(t('coach_ph'))}" autocomplete="off" ${S.sample ? '' : 'disabled'}><button class="btn btn-primary" ${S.sample ? '' : 'disabled'}>${icon('send')}<span class="sr">${t('send')}</span></button></form>
        ${S.sample ? '' : `<p class="hint">${t('ai_need_claude')}</p>`}
      </section>
    </div>`;
    $('#tk-sp', el).onchange = e => { tk.sp = e.target.value; this.render(el); };
    $('#coach-form', el).onsubmit = e => { e.preventDefault(); const q = $('#coach-q', el).value.trim(); if (q) this.ask(q, sp); };
  },
  colors(water, time) {
    const C = { natural: ['#9fb4a8', ['내추럴(실버·멸치)', 'Natural (silver, baitfish)', 'ナチュラル(シルバー)', '自然色(银色)']], chart: ['#cbe33a', ['차트·라임', 'Chartreuse', 'チャート', '荧光绿']], pink: ['#ff6aa8', ['핑크', 'Pink', 'ピンク', '粉色']], orange: ['#ff8a2a', ['오렌지·레드', 'Orange / red', 'オレンジ', '橙红']], gold: ['#d8a83a', ['골드', 'Gold', 'ゴールド', '金色']], glow: ['#c8ffd8', ['야광(글로우)', 'Glow', '夜光(グロー)', '夜光']], black: ['#222', ['블랙 실루엣', 'Black silhouette', 'ブラック', '黑色']], white: ['#f2f2f2', ['화이트·펄', 'White / pearl', 'パールホワイト', '珍珠白']] };
    if (time === 'night') return [C.glow, C.black, C.white];
    if (water === 'murky') return [C.chart, C.orange, C.pink];
    if (water === 'stained') return [C.gold, C.chart, C.pink];
    if (time === 'dawn' || time === 'dusk') return [C.gold, C.orange, C.natural];
    return [C.natural, C.white, C.gold];
  },
  async ask(q, sp) {
    if (!S.sample) return;
    S.coach = S.coach || []; S.coach.push({ role: 'user', content: q });
    const log = $('#coach-log'); log.innerHTML = S.coach.map(m => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('') + `<div class="msg assistant pending">${t('thinking')}</div>`;
    $('#coach-q').value = ''; log.scrollTop = log.scrollHeight;
    const rg = homeRegion(); const ti = tideInfo(rg);
    const ctx = `You are a friendly, expert fishing guide inside the ${APP_NAME[1]} fishing app. Answer in ${LANG_NAME[S.li]}, practical and concise (under 160 words), short bullet points where useful. Never give advice that breaks fishing laws; mention closed seasons or size limits when relevant. If a species is venomous or toxic, say so clearly.
App context: user's home waters ${regionName(rg)}; month ${new Date().getMonth() + 1}; today's tide phase ${ti.kr ? ti.label : 'n/a'}.
Selected species data: ${sp.n[1]} (${sp.sci}); Korean name ${sp.n[0]}; season by month (0-3) ${sp.mo}; baits ${sp.b.map(b => BAIT[b][1]).join(', ') || 'none'}; lures ${sp.lu.map(l => LURE[l][1]).join(', ') || 'none'}; methods ${sp.me.map(m => METHOD[m][1]).join(', ')}; Korea legal: min ${sp.lg.min || 'none'} cm, closed ${closedText(sp) || 'none'}; toxicity code ${sp.tox} (1 eat-toxic, 2 venomous spines, 3 ciguatera risk, 4 caution).`;
    const turns = [{ role: 'user', content: ctx }, ...S.coach.slice(-8)];
    const pend = log.querySelector('.pending');
    try {
      const r = await S.sample(turns, { cache: false, onText: ({ text }) => { if (pend) { pend.textContent = text; pend.classList.remove('pending'); } log.scrollTop = log.scrollHeight; } });
      S.coach.push({ role: 'assistant', content: r.text });
    } catch (e) { if (pend) pend.textContent = e.text || aiErrorText(e); S.coach.pop(); }
  }
};

/* ---------- MY CATCH LOG ---------- */
VIEWS.log = {
  render(el) {
    const cs = myCatches().slice().sort((a, b) => b.ts - a.ts);
    const pts = cs.filter(c => eligible(c, S.uid)).reduce((a, c) => a + (c.sc || 0), 0);
    el.innerHTML = `
    <div class="page log">
      <header class="page-head"><h1>${t('log_title')}</h1><p class="lede">${t('log_sub')}</p>
        <div class="hero-cta"><a class="btn btn-primary" href="#scan">${icon('camera')}${t('mode_now')}</a><a class="btn btn-line" href="#past">${icon('clock')}${t('mode_past')}</a></div></header>
      ${cs.length ? `<div class="seg log-tabs" role="tablist">${['list', 'stats'].map(k => `<button role="tab" aria-pressed="${(S.logTab || 'list') === k}" data-logtab="${k}">${icon(k === 'list' ? 'log' : 'chart')}${t('st_tab_' + k)}</button>`).join('')}</div>` : ''}
      ${S.logTab === 'stats' && cs.length ? statsHTML() : `
      <div class="stats4 card"><div><span class="num">${fmtN(cs.length)}</span><span>${t('catches')}</span></div><div><span class="num">${fmtN(pts)}</span><span>${t('total_pts')}</span></div><div><span class="num">Lv.${myLevel()}</span><span>${esc(lvInfo(S.me, myId()).title)}</span></div><div><span class="num">${fmtN(cs.filter(c => { const x = catchState(myId(), c); return x === 'review' || x === 'hold'; }).length)}</span><span>${t('st_review')}</span></div></div>
      ${cs.length ? VIEWS.sea.catchesHTML(cs, null) : `<div class="empty card big"><div class="empty-art"><img src="${FD.thumb(SPI.kurodai, 260, 140)}" alt=""></div><h2>${t('log_empty')}</h2><p class="muted">${t('log_empty_sub')}</p><a class="btn btn-primary" href="#scan">${t('cta_scan')}</a></div>`}`}
      ${S.myOrders.length ? `<section class="card"><h2 class="h3">${icon('heart')}${t('orders_title')}</h2><ul class="orders">${S.myOrders.slice().reverse().map(o => `<li><span>${esc(o.kind === 'item' ? dict(SHOPI[o.ref]?.n) || o.ref : o.kind === 'past' ? t('ord_past_old') : t('donate_title'))}</span><span class="num">${fmtN(o.amt)}${t('won')}</span><span class="mono small">${esc(o.code)}</span><span class="chip ${({ no: 'chip-closed', ok: 'chip-ok', wait: 'chip-wait' })[orderState(o)]}">${t('ord_' + orderState(o))}</span></li>`).join('')}</ul><p class="hint">${t('orders_note')}</p></section>` : ''}
    </div>`;
    hydratePhotos(el);
  }
};

/* ---------- ABOUT: what ZZIRIT means and what it is for ---------- */
const LOGO = { mark: '__LOGO_MARK__', full: '__LOGO_FULL__' };
VIEWS.about = {
  render(el) {
    const item = (ic, k) => `<li><span class="ab-ic">${icon(ic)}</span><div><b>${t(k + '_t')}</b><p>${t(k + '_d')}</p></div></li>`;
    el.innerHTML = `
    <div class="page about">
      <section class="ab-hero">
        <img class="ab-logo" src="${LOGO.full}" alt="${esc(APP_NAME[0] + ' ' + APP_NAME[1])}" width="280" height="280">
        <div class="ab-hero-txt">
          <p class="eyebrow">${t('about_eyebrow')}</p>
          <h1>${t('about_hero_h')}</h1>
          <p class="lede">${t('about_hero_p')}</p>
          <div class="hero-cta"><a class="btn btn-primary" href="#scan">${icon('scan')}${t('cta_scan')}</a><a class="btn btn-line" href="#help">${icon('chat')}${t('nav_help')}</a></div>
        </div>
      </section>
      <section class="card ab-sec"><h2 class="h3">${t('about_name_h')}</h2>
        <ol class="ab-name">${['1', '2', '3'].map(n => `<li><span class="ab-word">${t('about_name_' + n + '_t')}</span><p>${t('about_name_' + n + '_d')}</p></li>`).join('')}</ol>
      </section>
      <section class="card ab-sec ab-logo-sec"><h2 class="h3">${t('about_logo_h')}</h2>
        <div class="ab-logo-grid"><img class="ab-mark" src="${LOGO.mark}" alt="" width="128" height="128">
          <ul class="ab-list">${item('fish', 'about_logo_1')}${item('sparkle', 'about_logo_2')}${item('contrast', 'about_logo_3')}</ul></div>
      </section>
      <section class="card ab-sec"><h2 class="h3">${t('about_for_h')}</h2>
        <ul class="ab-list ab-for">${item('log', 'about_for_1')}${item('shield', 'about_for_2')}${item('warn', 'about_for_3')}${item('sea', 'about_for_4')}${item('users', 'about_for_5')}</ul>
      </section>
      <p class="ab-close">${t('about_close')}</p>
      <p class="hint ab-made">${t('about_made')}</p>
    </div>`;
  }
};

/* ---------- HELP ---------- */
VIEWS.help = {
  render(el) {
    const mine = S.mySuggest.slice().reverse().slice(0, 5);
    el.innerHTML = `
    <div class="page help">
      <header class="page-head"><h1>${t('help_title')}</h1><p class="lede">${t('help_sub')}</p></header>
      <div class="help-grid">
        <section class="card kakao">
          <p class="eyebrow">${t('kakao_eyebrow')}</p>
          <h2>${t('kakao_title')}</h2>
          <div class="kakao-body">
            <div class="qr" role="img" aria-label="${esc(t('qr_aria'))}"><svg viewBox="-2 -2 37 37" shape-rendering="crispEdges"><rect x="-2" y="-2" width="37" height="37" fill="#fff"/><path d="${QR_PATH}" fill="#111"/></svg></div>
            <div class="kakao-info">
              <dl class="kv"><div><dt>${t('dev')}</dt><dd>${esc(DEV.name)}</dd></div><div data-copybox><dt>${t('kakao_id')}</dt><dd><span class="copy-src mono">${DEV.kakaoId}</span> <button class="btn btn-ghost btn-xs" data-copy="${DEV.kakaoId}">${icon('copy')}${t('copy')}</button></dd></div></dl>
              <a class="btn btn-kakao btn-lg btn-block" href="${DEV.kakaoUrl}" target="_blank" rel="noopener">${icon('chat')}${t('kakao_ask')}</a>
              <p class="hint">${t('kakao_hint')}</p>
            </div>
          </div>
        </section>
        <section class="card suggest">
          <p class="eyebrow">${t('sg_eyebrow')}</p>
          <h2>${t('sg_title')}</h2>
          <form id="sg-form" novalidate>
            <div class="chip-row" role="radiogroup" aria-label="${esc(t('sg_cat'))}">${['feature', 'bug', 'species', 'pay', 'etc'].map((c, i) => `<label class="chip chip-tab"><input type="radio" name="sg-cat" value="${c}" ${i === 0 ? 'checked' : ''}><span>${t('sgc_' + c)}</span></label>`).join('')}</div>
            <div class="field"><label for="sg-text" class="sr">${t('sg_title')}</label><textarea id="sg-text" rows="5" maxlength="1000" placeholder="${esc(t('sg_ph'))}"></textarea></div>
            <div class="actions"><button class="btn btn-primary" type="submit">${icon('send')}${t('sg_save')}</button><button class="btn btn-kakao" type="button" id="sg-kakao">${icon('chat')}${t('sg_kakao')}</button></div>
            <p class="hint">${t('sg_hint')}</p>
          </form>
          ${mine.length ? `<h3 class="h4">${t('sg_mine')}</h3><ul class="sg-list">${mine.map(s => `<li><span class="chip">${t('sgc_' + s.cat)}</span><span>${esc(s.text.slice(0, 80))}</span><span class="muted small">${ago(s.ts)}</span></li>`).join('')}</ul>` : ''}
        </section>
      </div>
      <section class="card donate-card">
        <div class="dc-txt"><p class="eyebrow">${t('donate_eyebrow')}</p><h2>${t('donate_title')}</h2><p>${t('donate_desc')}</p></div>
        <button class="btn btn-heart btn-lg" data-act="donate">${icon('heart')}${t('donate_btn')}</button>
      </section>
      <section class="faq">
        <h2 class="h3">${t('faq_title')}</h2>
        ${['scan', 'train', 'score', 'past', 'fake', 'review', 'friends', ...(window.APP_RT === 'web' ? ['account'] : []), 'pay', 'spot', 'legal', 'beta'].map(k => `<details class="card"><summary>${t('faq_' + k + '_q')}</summary><p>${t('faq_' + k + '_a', { p: fmtN(PREMIUM_PRICE) })}</p></details>`).join('')}
      </section>
    </div>`;
    const compose = () => { const cat = ($('input[name="sg-cat"]:checked', el) || {}).value || 'feature'; const text = $('#sg-text', el).value.trim(); return { cat, text, msg: `[${APP_NAME[0]} ${APP_NAME[1]} · ${t('sgc_' + cat)}]\n${text}\n— ${S.me?.nick || ''} ${S.me?.cc ? '(' + S.me.cc + ')' : ''}` }; };
    $('#sg-form', el).onsubmit = async e => {
      e.preventDefault(); const c = compose(); if (c.text.length < 2) { toast(t('sg_empty'), 'warn'); return; }
      const ok = await store.addSuggestion({ id: rid(8), cat: c.cat, text: c.text, ts: nowMs(), nick: S.me?.nick || '' });
      toast(t(ok ? 'sg_saved' : 'sg_saved_local')); $('#sg-text', el).value = ''; this.render(el);
    };
    $('#sg-kakao', el).onclick = async () => {
      const c = compose(); if (c.text.length < 2) { toast(t('sg_empty'), 'warn'); return; }
      await store.addSuggestion({ id: rid(8), cat: c.cat, text: c.text, ts: nowMs(), nick: S.me?.nick || '', via: 'kakao' });
      try { await navigator.clipboard.writeText(c.msg); toast(t('sg_copied'), 'ok', 4200); } catch (e2) { toast(t('copy_manual'), 'info'); }
      const a = document.createElement('a'); a.href = DEV.kakaoUrl; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    };
  }
};

/* Home tip: make a login ID so the records follow you to any device (web, after the first catch, until dismissed) */
function idTipHTML() {
  if (!idSupported() || S.mode !== 'shared' || !S.me || !S.me.nick || lsGet('idTipOff', 0)) return '';
  if (S.loginId === undefined) { myLoginId().then(id => { if (!id && $('#v-home') && !$('#v-home').hidden) rerenderSoon(); }); return ''; }
  if (S.loginId || (window.APP_AUTH.link && window.APP_AUTH.link.linked())) return '';
  return `<section class="card id-tip">${icon('user')}<div><b>${t('id_tip_title')}</b><p class="muted small">${t('id_tip_sub')}</p></div><div class="rec-btns"><button class="btn btn-primary btn-sm" data-id="create">${t('id_create')}</button><button class="btn btn-ghost btn-sm" data-id="login">${t('id_login')}</button><button class="btn btn-ghost btn-xs" data-act="idtip-off" aria-label="${esc(t('close'))}">${icon('close')}</button></div></section>`;
}

/* ---------- PREFS ---------- */
VIEWS.prefs = {
  render(el) {
    const p = Object.assign({ nick: '', cc: defaultCC(), home: defaultHome(), style: 'float' }, S.me || {});
    el.innerHTML = `
    <div class="page prefs">
      <header class="page-head"><h1>${t('prefs_title')}</h1></header>
      ${idSupported() && S.mode === 'shared' ? `<section class="card id-card" id="id-card">${idCardHTML()}</section>` : ''}
      <section class="card"><h2 class="h3">${t('prefs_profile')}</h2>
        ${S.me && S.me.nick ? `<a class="pf-char" href="#char">${avatar(S.me, 48)}<span><b>${t('ch_title')}</b><span class="muted small">${t('pf_char_hint')}</span></span>${icon('gear')}</a>` : ''}
        <div id="pf-box">${profileFormHTML(p)}</div><div class="actions"><button class="btn btn-primary" id="pf-save">${t('save')}</button></div></section>
      ${linkSupported() ? `<section class="card link-card"><h2 class="h3">${icon('link')}${t('link_title')}</h2><p class="muted">${t('link_sub')}</p>
        ${window.APP_AUTH.link.linked() ? `<p class="note ok">${icon('check')} ${t('link_linked')}</p>` : ''}
        <div class="actions"><button class="btn btn-primary" data-link="make">${icon('qr')}${t('link_make')}</button><button class="btn btn-line" data-link="enter">${t('link_enter')}</button>${window.APP_AUTH.link.linked() ? `<button class="btn btn-ghost" data-link="leave">${t('link_leave')}</button>` : ''}</div>
        <p class="hint">${t('link_hint')}</p></section>` : window.APP_RT !== 'web' && S.mode === 'shared' ? `<section class="card"><h2 class="h3">${icon('link')}${t('link_title')}</h2><p class="muted">${t('link_artifact_note')}</p></section>` : ''}
      <section class="card"><h2 class="h3">${t('prefs_display')}</h2>
        <div class="row2">
          <div class="field"><span>${t('theme')}</span><div class="seg seg-sm">${['system', 'light', 'dark'].map(x => `<button aria-pressed="${S.theme === x}" data-themeset="${x}">${t('theme_' + x)}</button>`).join('')}</div></div>
          <div class="field"><span>${t('units')}</span><div class="seg seg-sm">${['cm', 'in'].map(x => `<button aria-pressed="${S.unit === x}" data-unit="${x}">${x === 'cm' ? 'cm · kg' : 'in · lb'}</button>`).join('')}</div></div>
        </div>
        ${installOn() ? `<div class="inst-row"><div><b>${t('inst_btn')}</b><p class="muted small">${t('inst_row_sub')}</p></div><button class="btn btn-line btn-sm" data-act="install">${icon('download')}${t('inst_btn')}</button></div>` : ''}
      </section>
      ${window.APP_RT === 'web' && S.mode === 'shared' && S.me && S.me.nick ? `<section class="card push-card"><h2 class="h3">${icon('bell')}${t('push_card')}</h2>${pushRowHTML()}<p class="hint">${t('push_hint')}</p></section>` : ''}
      <section class="card"><h2 class="h3">${t('prefs_privacy')}</h2><p>${t('privacy_text')}</p>
        ${S.me && S.me.nick ? `<label class="switch"><input type="checkbox" id="pf-froff" ${S.me.frOff ? '' : 'checked'}><span class="sw"></span><span>${t('fr_off_pref')}</span></label><p class="hint">${t('fr_off_pref_hint')}</p>` : ''}
      </section>
      <section class="card"><h2 class="h3">${t('prefs_status')}</h2>
        <dl class="kv"><div><dt>${t('status_mode')}</dt><dd>${t('mode_' + S.mode)}</dd></div><div><dt>${t('status_ai')}</dt><dd>${S.sampleImages ? t('on') : S.sample ? t('ai_text_only') : t('off')}</dd></div></dl>
        <p class="hint">${t('mode_explain')}</p>
        ${window.APP_RT === 'web' && !S.isOwner ? `<p class="hint"><a href="#claim">${icon('shield')} ${t('claim_title')}</a></p>` : ''}
      </section>
      <section class="card credits"><h2 class="h3">${t('credits_title')}</h2><p class="small">${t('credits_text')}</p>${wxOn() ? `<p class="small">${t('credits_wx')} · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>` : ''}</section>
    </div>`;
    pushBind(el);
    const fo = $('#pf-froff', el);
    if (fo) fo.onchange = async () => { S.me.frOff = !fo.checked; await store.saveMe(); toast(t('saved')); };
    $('#pf-save', el).onclick = async () => {
      const f = readProfileForm(el);
      if (nickRefused(f, el)) return; delete f.bad;
      S.me = Object.assign({ v: 1, joined: nowMs(), catches: [], decor: { theme: 'th_dawn', items: ['dc_weed', 'dc_rock', 'dc_buoy'], fx: [] }, flair: {} }, S.me || {}, f);
      if (f.lang !== S.lang) setLang(f.lang);
      await store.saveMe(); toast(t('saved')); rerender();
    };
  }
};

/* ---------- ADMIN (owner only) ---------- */
VIEWS.admin = {
  render(el) {
    if (!S.isOwner) { el.innerHTML = `<div class="page"><div class="empty card big"><h2>${t('admin_only')}</h2></div></div>`; return; }
    const cfg = S.admin.config || {};
    const orders = []; for (const [uid, d] of S.allOrders) for (const o of (d.items || [])) orders.push({ uid, o, st: grantState((S.admin.grants[uid] || {})[o.id]) });
    orders.sort((a, b) => ((a.st === 'wait') === (b.st === 'wait') ? (b.o.ts || 0) - (a.o.ts || 0) : a.st === 'wait' ? -1 : 1));
    const sugg = []; for (const [uid, d] of S.allSuggest) for (const s of (d.items || [])) sugg.push({ uid, s });
    sugg.sort((a, b) => b.s.ts - a.s.ts);
    // only what the automatic reviewer left on hold reaches the operator (plus anything it has not managed to look at for an hour)
    const reviews = []; for (const [uid, a] of S.anglers) for (const c of (a.catches || [])) {
      const v = verdict(uid, c.id);
      if (c.st === 'review' && (v === 'hold' || (!v && nowMs() - (c.at || c.ts || 0) > 3600e3))) reviews.push({ uid, a, c, note: reviewNote(uid, c) });
    }
    const autoLog = []; for (const [uid, m] of Object.entries(S.admin.autorev || {})) for (const [cid, r] of Object.entries(m || {})) { const a = S.anglers.get(uid); const c = a && (a.catches || []).find(x => x.id === cid); if (c) autoLog.push({ uid, a, c, note: reviewNote(uid, c), at: r.at || 0 }); }
    autoLog.sort((x, y) => y.at - x.at);
    const users = [...S.anglers.entries()].filter(([, a]) => a && a.nick).map(([uid, a]) => ({ uid, a, n: (a.catches || []).length, L: lvInfo(a, uid).L, pts: (a.catches || []).filter(c => eligible(c, uid)).reduce((x, c) => x + (c.sc || 0), 0) })).sort((x, y) => (y.a.joined || 0) - (x.a.joined || 0));
    adminLoad();
    const ids = S.adm.logins || new Map(); const uq = (S.adm.q || '').trim().toLowerCase();
    const shown = uq ? users.filter(u => u.a.nick.toLowerCase().includes(uq) || (ids.get(u.uid) || '').includes(uq) || u.uid.startsWith(uq)) : users;
    const nCatch = [...S.anglers.values()].reduce((s, a) => s + (a.catches || []).length, 0);
    const flagged = [...boardIndex().posts.values()].filter(p => p.reps > 0 || p.hidden).sort((x, y) => (x.hidden - y.hidden) || (y.reps - x.reps) || (y.ts - x.ts)).slice(0, 60);
    el.innerHTML = `
    <div class="page admin">
      <header class="page-head"><h1>${t('admin_title')}</h1><p class="lede">${t('admin_sub')}</p></header>
      <div class="stats4 card"><div><span class="num">${S.anglers.size}</span><span>${t('ad_users')}</span></div><div><span class="num">${nCatch}</span><span>${t('catches')}</span></div><div><span class="num">${learnStats().total}</span><span>${t('learn_n')}</span></div><div><span class="num">${orders.filter(x => x.st === 'wait').length}</span><span>${t('ad_pending')}</span></div></div>
      <section class="card ad-notice"><h2 class="h3">${icon('megaphone')}${t('ad_notice')}</h2><p class="hint">${t('ad_notice_hint')}</p>
        <div class="field"><textarea id="ad-notice" rows="3" maxlength="400" placeholder="${esc(t('ad_notice_ph'))}">${esc((noticeOf() || {}).t || '')}</textarea></div>
        <div class="actions"><button class="btn btn-primary" id="ad-notice-go">${icon('megaphone')}${t('ad_notice_go')}</button>${noticeOf() ? `<button class="btn btn-ghost" id="ad-notice-off">${t('ad_notice_off')}</button>` : ''}</div>
        ${window.APP_RT === 'web' ? `<label class="switch ad-wx"><input type="checkbox" id="ad-wx" ${cfg.wxOff ? '' : 'checked'}><span class="sw"></span><span>${t('ad_wx')}</span></label><p class="hint">${t('ad_wx_hint')}</p>` : ''}
      </section>
      <section class="card"><h2 class="h3">${icon('heart')}${t('ad_pay')}</h2>
        <div class="row2">
          <div class="field"><label for="ad-toss">${t('ad_toss')}</label><input id="ad-toss" value="${esc(cfg.tossId || '')}" placeholder="toss.me/___"></div>
          <div class="field"><label for="ad-kakao">${t('ad_kakao')}</label><input id="ad-kakao" value="${esc(cfg.kakaoUrl || '')}" placeholder="https://qr.kakaopay.com/..."></div>
        </div>
        <label class="switch"><input type="checkbox" id="ad-kamt" ${cfg.kakaoAmt ? 'checked' : ''}><span class="sw"></span><span>${t('ad_kakao_amt')}</span></label>
        <p class="hint">${t('ad_pay_hint')}</p>
        <div class="actions"><button class="btn btn-primary" id="ad-save">${t('save')}</button></div>
      </section>
      <section class="card"><h2 class="h3">${icon('clock')}${t('ad_orders')}</h2><p class="hint">${t('ad_orders_hint')}</p>
        ${orders.length ? `<div class="tbl"><table><thead><tr><th>${t('angler')}</th><th>${t('ad_item')}</th><th class="r">${t('ad_amt')}</th><th>${t('pay_memo')}</th><th>${t('ad_when')}</th><th></th></tr></thead><tbody>${orders.map(({ uid, o, st }) => `<tr><td>${esc(o.nick || S.anglers.get(uid)?.nick || '?')}</td><td>${esc(o.kind === 'item' ? dict(SHOPI[o.ref]?.n) || o.ref : o.kind === 'past' ? t('ord_past_old') : t('donate_title'))}</td><td class="r num">${fmtN(o.amt)}</td><td class="mono">${esc(o.code)}</td><td class="small">${fmtDT(o.ts)}</td><td class="nowrap">${st === 'wait' ? `<button class="btn btn-primary btn-xs" data-grant="${uid}|${o.id}|ok">${t('ad_confirm')}</button> <button class="btn btn-ghost btn-xs" data-grant="${uid}|${o.id}|no">${t('ad_cancel_order')}</button>` : `<span class="chip ${st === 'ok' ? 'chip-ok' : 'chip-closed'}">${t('ord_' + st)}</span> <button class="btn btn-ghost btn-xs" data-grant="${uid}|${o.id}|wait">${t('ad_undo')}</button>`}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${t('ad_none')}</p>`}
      </section>
      <section class="card"><h2 class="h3">${icon('shield')}${t('ad_reviews')}</h2><p class="hint">${t('ad_reviews_auto')}</p>
        ${reviews.length ? `<div class="catch-grid">${reviews.map(({ uid, a, c, note }) => `<div class="catch-card"><span class="cc-ph" data-ph="${uid}|${c.id}"></span><span class="cc-txt"><b>${esc(nameOf(c.sp))}</b> ${lenFmt(c.len)} · ${esc(a.nick)}<br><span class="muted small">${t('trust')} ${c.tr} · ${fmtDate(c.ts)}${c.past ? ' · ' + t('past_short') : ''}</span>${note ? `<br><span class="small rv-why">${icon('shield')} ${esc(reviewReason(note))}</span>` : ''}</span><span class="nowrap"><button class="btn btn-primary btn-xs" data-verdict="${uid}|${c.id}|ok">${t('approve')}</button> <button class="btn btn-ghost btn-xs" data-verdict="${uid}|${c.id}|no">${t('reject')}</button> <button class="btn btn-ghost btn-xs" data-catch="${uid}|${c.id}">${t('view')}</button></span></div>`).join('')}</div>` : `<p class="muted">${t('ad_reviews_none')}</p>`}
        ${autoLog.length ? `<details class="ad-auto"><summary>${t('ad_auto_log', { n: autoLog.length })}</summary><ul class="ad-autolog">${autoLog.slice(0, 40).map(({ uid, a, c, note }) => `<li><span class="chip ${note.v === 'no' ? 'chip-closed' : note.v === 'ok' ? 'chip-ok' : 'chip-wait'}">${t(note.v === 'no' ? 'st_rejected' : note.v === 'ok' ? 'st_ok' : 'st_hold')}</span><button class="link" data-catch="${uid}|${c.id}">${esc(nameOf(c.sp))} ${lenFmt(c.len)}</button><span class="muted small">${esc(a.nick)} · ${esc(reviewReason(note))}</span>${verdict(uid, c.id) !== 'ok' ? `<button class="btn btn-ghost btn-xs" data-verdict="${uid}|${c.id}|ok">${t('approve')}</button>` : `<button class="btn btn-ghost btn-xs" data-verdict="${uid}|${c.id}|no">${t('reject')}</button>`}</li>`).join('')}</ul></details>` : ''}
      </section>
      <section class="card"><h2 class="h3">${icon('users')}${t('ad_users_title')}</h2><p class="hint">${t('ad_users_hint')}</p>
        ${S.adm.canDelete === false ? `<p class="note">${icon('info')} ${t('ad_del_needs_update')}</p>` : ''}
        <input class="search" id="ad-uq" type="search" placeholder="${esc(t('ad_users_search'))}" value="${esc(S.adm.q || '')}" autocomplete="off">
        ${shown.length ? `<ul class="ad-users">${shown.slice(0, 300).map(({ uid, a, n, L, pts }) => `<li><button class="fr-who" data-seauid="${esc(uid)}">${avatar(a, 32)}<span class="fr-txt"><span class="fr-name">${nickHTML(a)} <span class="lv-chip">Lv.${L}</span>${ids.get(uid) ? ` <span class="chip chip-id mono">${icon('user')}${esc(ids.get(uid))}</span>` : ''}</span><span class="muted small">${t('catches')} ${n} · ${fmtN(pts)} pt · ${a.joined ? fmtDate(a.joined) : '—'} · <span class="mono">${esc(uid.slice(0, 8))}</span></span></span></button><span class="ad-acts">${uid === myId() ? `<span class="chip">${t('ad_you')}</span>` : `${window.APP_RT === 'web' ? `<button class="btn btn-line btn-xs" data-relink="${esc(uid)}">${icon('link')}${t('ad_relink')}</button>` : ''}<button class="btn btn-ghost btn-xs" data-deluser="${esc(uid)}" ${S.adm.canDelete === false ? 'disabled' : ''}>${icon('x')}${t('ad_del_user')}</button>`}</span></li>`).join('')}</ul>` : `<p class="muted">${t('ad_none')}</p>`}
        ${window.APP_RT === 'web' ? `<form class="ad-idreset" id="ad-idreset"><p class="lbl">${t('ad_id_reset')}</p><div class="row2"><div class="field"><input id="ad-idr-name" placeholder="${esc(t('id_name'))}" autocomplete="off" autocapitalize="none" spellcheck="false"></div><div class="field"><input id="ad-idr-pass" placeholder="${esc(t('ad_id_reset_pw'))}" autocomplete="off"></div></div><div class="actions"><button class="btn btn-line btn-sm" type="submit">${t('ad_id_reset_go')}</button></div><p class="hint">${t('ad_id_reset_hint')}</p></form>` : ''}
      </section>
      <section class="card"><h2 class="h3">${icon('board')}${t('ad_reports')}</h2>
        ${flagged.length ? `<ul class="ad-reports">${flagged.map(p => `<li class="${p.hidden ? 'is-hidden' : ''}"><button class="link" data-post="${esc(p.key)}"><span class="chip chip-cat cat-${esc(p.cat)}">${t('bdc_' + p.cat)}</span> ${esc(p.title)}</button><span class="muted small">${esc((anglerOf(p.uid) || {}).nick || '?')} · ${ago(p.ts)}</span>${p.reps ? `<span class="chip chip-review">${icon('warn')}${p.reps}</span>` : ''}${p.hidden ? `<span class="chip chip-closed">${t('bd_hidden_chip')}</span>` : ''}<button class="btn btn-ghost btn-xs" data-modhp="${esc(p.key)}">${t(p.hidden ? 'bd_unhide' : 'bd_hide')}</button></li>`).join('')}</ul>` : `<p class="muted">${t('ad_none')}</p>`}
      </section>
      <section class="card"><h2 class="h3">${icon('chat')}${t('ad_suggest')}</h2>
        ${sugg.length ? `<ul class="sg-list">${sugg.map(({ s }) => `<li><span class="chip">${t('sgc_' + s.cat)}</span><span>${esc(s.text)}</span><span class="muted small">${esc(s.nick || '')} · ${ago(s.ts)}</span></li>`).join('')}</ul>` : `<p class="muted">${t('ad_none')}</p>`}
      </section>
    </div>`;
    hydratePhotos(el);
    $('#ad-save', el).onclick = async () => {
      const toss = $('#ad-toss', el).value.trim().replace(/^https?:\/\/toss\.me\//, '').replace(/\/.*$/, '');
      const kakao = $('#ad-kakao', el).value.trim();
      if (kakao && !/^https:\/\/qr\.kakaopay\.com\//.test(kakao)) { toast(t('ad_kakao_bad'), 'warn'); return; }
      await store.saveAdmin('config', Object.assign({}, S.admin.config || {}, { tossId: toss, kakaoUrl: kakao, kakaoAmt: $('#ad-kamt', el).checked }));
      toast(t('saved'));
    };
    $('#ad-notice-go', el).onclick = async () => {
      const v = $('#ad-notice', el).value.trim().slice(0, 400);
      if (!v) { toast(t('ad_notice_empty'), 'warn'); return; }
      const nt = { id: rid(8), t: v, ts: nowMs() };
      if (await store.saveAdmin('config', Object.assign({}, S.admin.config || {}, { notice: nt }))) { toast(t('ad_notice_done')); pushSend('notice', nt.id); }
      rerender();
    };
    const wxSw = $('#ad-wx', el);
    if (wxSw) wxSw.onchange = async () => { if (await store.saveAdmin('config', Object.assign({}, S.admin.config || {}, { wxOff: !wxSw.checked }))) toast(t('saved')); };
    const nOff = $('#ad-notice-off', el);
    if (nOff) nOff.onclick = async () => {
      const cur = Object.assign({}, S.admin.config || {}); delete cur.notice;
      if (await store.saveAdmin('config', cur)) toast(t('ad_notice_removed'));
      rerender();
    };
    const idr = $('#ad-idreset', el);
    if (idr) idr.onsubmit = async e => {
      e.preventDefault();
      const name = $('#ad-idr-name', el).value.trim().toLowerCase(), pw = $('#ad-idr-pass', el).value.trim();
      if (!name || pw.length < 6) { toast(t('id_err_pass'), 'warn'); return; }
      try { const r = await window.APP_AUTH.ids.adminReset(name, pw); if (!r || r.ok !== true) throw { code: (r && r.err) || 'fail' }; toast(t('ad_id_reset_ok', { name }), 'ok', 6000); idr.reset(); }
      catch (x) { toast(idErr(x && x.code), 'warn', 6000); }
    };
    const uqi = $('#ad-uq', el);
    if (uqi) uqi.addEventListener('input', debounce(() => { S.adm.q = uqi.value; rerender(); }, 200));
  }
};

/* operator page extras from the server: who has which login ID, and whether deleting accounts is available yet */
function adminLoad(force) {
  S.adm = S.adm || {};
  if (window.APP_RT !== 'web' || !window.APP_AUTH || !window.APP_AUTH.admin) return;
  if (!force && S.adm.at && nowMs() - S.adm.at < 60000) return;
  S.adm.at = nowMs();
  window.APP_AUTH.admin.logins().then(rows => { S.adm.logins = new Map((rows || []).map(r => [r.acct, r.name])); rerenderSoon(); }).catch(e => { console.warn('admin_logins', e); });
  window.APP_AUTH.admin.canDelete().then(v => { if (S.adm.canDelete !== v) { S.adm.canDelete = v; rerenderSoon(); } });
}
/* operator: a one-time code that brings someone back to an account they lost (they type it in Settings) */
async function openRelink(uid) {
  if (!S.isOwner || window.APP_RT !== 'web') return;
  const a = S.anglers.get(uid); const nick = (a && a.nick) || '?';
  let code;
  try { code = await window.APP_AUTH.admin.linkCode(uid); }
  catch (e) { toast(t(e && e.code === 'need_update' ? 'ad_need_update' : 'ad_relink_fail'), 'warn', 6000); return; }
  const pretty = String(code).replace(/^(.{4})(.{4})$/, '$1-$2');
  const msg = t('ad_relink_msg', { code: pretty });
  openModal(`<div class="relink">
    <h2>${icon('link')} ${t('ad_relink_title', { nick: esc(nick) })}</h2>
    <p class="lede">${t('ad_relink_sub')}</p>
    <p class="link-code"><b class="mono">${esc(pretty)}</b> <button class="btn btn-line btn-sm" data-copy="${esc(code)}">${icon('copy')}${t('copy')}</button></p>
    <div class="field"><label>${t('ad_relink_send')}</label><textarea rows="3" readonly>${esc(msg)}</textarea><button class="btn btn-primary btn-sm" data-copy="${esc(msg)}">${icon('copy')}${t('ad_relink_copy')}</button></div>
    <p class="hint">${icon('shield')} ${t('ad_relink_note')}</p>
  </div>`, { label: t('ad_relink_title', { nick }) });
}

/* ---------- More (mobile) ---------- */
function openMore() {
  const items = [['friends', 'users'], ['board', 'board'], ['teams', 'flag'], ['points', 'pin'], ['char', 'user'], ['dex', 'book'], ['tackle', 'lure'], ['log', 'log'], ['help', 'chat'], ['about', 'sparkle'], ['prefs', 'gear']];
  if (window.APP_RT !== 'web') items.splice(3, 1);
  if (S.isOwner) items.push(['admin', 'shield']);
  const nIn = frLists().inc.length;
  // the account first: who is signed in, with a way to sign out (only when there is a way back in: a login ID or a linked device)
  const linked = !!(window.APP_AUTH && window.APP_AUTH.link && window.APP_AUTH.link.linked());
  const inAcct = !!(S.me && S.me.nick) && (!!S.loginId || linked);
  const acct = idSupported() && !S.idOff ? (inAcct
    ? `<div class="more-acct"><a href="#prefs" class="more-acct-main">${avatar(S.me, 30)}<span><b>${esc(S.me.nick)}</b><span class="muted small${S.loginId ? ' mono' : ''}">${esc(S.loginId || t('more_linked'))}</span></span></a><button class="more-out" data-act="logout">${icon('logout')}<span>${t('lo_title')}</span></button></div>`
    : `<button class="more-acct" data-act="auth">${icon('user')}<span><b>${t(S.me && S.me.nick ? 'more_acct_keep' : 'more_acct_join')}</b><span class="muted small">${t(S.me && S.me.nick ? 'more_acct_keep_sub' : 'more_acct_join_sub')}</span></span></button>`) : '';
  const inst = installOn() ? `<button class="more-item" data-act="install">${icon('download')}<span>${t('inst_btn')}</span></button>` : '';
  const w = openModal(`<nav class="more"><h2 class="sr">${t('more')}</h2>${acct}${items.map(([r, ic]) => `<a href="#${r}" class="more-item">${icon(ic)}<span>${t('nav_' + r)}</span>${r === 'friends' && nIn ? `<i class="badge num">${nIn}</i>` : ''}</a>`).join('')}${inst}<button class="more-item heart" data-act="donate">${icon('heart')}<span>${t('donate_btn')}</span></button></nav>`, { sheet: true, label: t('more') });
  w.addEventListener('click', e => {
    if (e.target.closest('[data-act="auth"]')) { closeModal(w); openAuth('join'); return; }
    if (e.target.closest('[data-act="logout"]')) { closeModal(w); openLogout(); return; }
    if (e.target.closest('[data-act="install"]')) { closeModal(w); openInstall(); return; }
    if (e.target.closest('a,.heart')) closeModal(w);
  });
}
