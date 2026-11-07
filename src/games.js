/* ===== 미니게임: 오늘의 물고기 운세 and 챔질 반응속도.
   운세: one fish a day, the same all day for the same person (seeded by who and the Korean date) — a fortune to
   smile at, with a lucky bait, time and lure colour. 반응속도: the float bobs, nibbles to fool you, then dives; tap
   the moment it does. Five tries, averaged; tapping before the dive is a false strike. Records go in the profile
   (S.me.games) and never touch catches or the angler rankings. On the website a 반응속도 run is also started and checked on
   the server, which keeps this week's board and pays its prizes in 찌릿 포인트 (shop.js). Both games work in Claude too. ===== */
function kstDay(ms = nowMs()) { return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10); }
function gmHash(str) { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function gmGet() { const g = S.me && S.me.nick ? S.me.games : lsGet('games', null); return g && typeof g === 'object' && !Array.isArray(g) ? g : {}; }
async function gmSave(patch) {
  const g = Object.assign({}, gmGet(), patch);
  if (S.me && S.me.nick) { S.me.games = g; await store.saveMe(); } else lsSet('games', g);
  return g;
}

/* ---------- 오늘의 물고기 운세 ---------- */
const FO_COLORS = ['#E5484D', '#F76B15', '#E2D51C', '#30A46C', '#0090FF', '#8E4EC6', '#E93D82', '#F4F7EE', '#B8C0C8', '#D4A72C'];
const FO_MSGS = 24;
function fortuneOf(uid, day) {
  const R = FD.seeded(gmHash(uid + '|' + day));
  const m = +day.slice(5, 7) - 1;
  const pool = GEO.regionPrior(homeRegion(), m).filter(x => SPI[x.id]).slice(0, 24);
  let tot = 0; for (const x of pool) tot += Math.sqrt(x.p);
  let r = R() * tot, sp = pool.length ? pool[0].id : 'madai';
  for (const x of pool) { r -= Math.sqrt(x.p); if (r <= 0) { sp = x.id; break; } }
  const stars = [2, 3, 3, 4, 4, 4, 4, 5, 5, 3][Math.floor(R() * 10)];
  const s0 = SPI[sp] || {}; const baits = [...(s0.b || []).map(b => dict(BAIT[b])), ...(s0.lu || []).map(l => dict(LURE[l]))].filter(Boolean);
  return { sp, stars, bait: baits.length ? baits[Math.floor(R() * baits.length)] : '', time: Math.floor(R() * 8), color: Math.floor(R() * FO_COLORS.length), msg: Math.floor(R() * FO_MSGS), day };
}
const foStars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
function foCardHTML(f, fresh) {
  const sp = SPI[f.sp]; const [, mo, da] = f.day.split('-').map(Number);
  return `<div class="fo-card${fresh ? ' fo-in' : ''}">
    <p class="eyebrow">${t('fo_title')} · ${t('fo_date', { m: mo, d: da })}</p>
    <div class="fo-pic"><img src="${FD.thumb(sp, 300, 200)}" alt=""></div>
    <h2 class="fo-name">${esc(nameOf(f.sp))}</h2>
    <p class="fo-stars" aria-label="${esc(t('fo_stars', { n: f.stars }))}">${foStars(f.stars)}</p>
    <p class="fo-msg">“${esc(t('fo_m' + f.msg))}”</p>
    <dl class="fo-lucky">
      ${f.bait ? `<div><dt>${t('fo_lucky_bait')}</dt><dd>${esc(f.bait)}</dd></div>` : ''}
      <div><dt>${t('fo_lucky_time')}</dt><dd>${t('fo_t' + f.time)}</dd></div>
      <div><dt>${t('fo_lucky_color')}</dt><dd><i class="fo-sw" style="background:${FO_COLORS[f.color]}"></i>${t('fo_c' + f.color)}</dd></div>
    </dl>
    <div class="actions"><button class="btn btn-primary" id="fo-share">${icon('share')}${t('fo_share')}</button><button class="btn btn-line" data-fosp="${esc(f.sp)}">${icon('fish')}${t('fo_see_fish')}</button></div>
    <p class="hint">${t('fo_note')}</p>
  </div>`;
}
function openFortune() {
  const day = kstDay(), f = fortuneOf(myId(), day), drawn = gmGet().fo === day;
  const w = openModal(`<div class="fo" id="fo-box">${drawn ? foCardHTML(f) : `<div class="fo-back">
      <div class="fo-deck" id="fo-deck" aria-hidden="true"><span>?</span></div>
      <h2>${t('fo_title')}</h2><p class="lede">${t('fo_sub')}</p>
      <button class="btn btn-primary btn-lg" id="fo-draw">${icon('sparkle')}${t('fo_draw')}</button></div>`}</div>`, { label: t('fo_title') });
  const bind = () => {
    const sh = $('#fo-share', w); if (sh) sh.onclick = async () => {
      const text = t('fo_share_text', { fish: nameOf(f.sp), stars: foStars(f.stars), msg: t('fo_m' + f.msg) });
      if (navigator.share) { try { await navigator.share({ text: text + '\n' + SITE_URL }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      if (await copyText(text + '\n' + SITE_URL)) toast(t('fo_copied'), 'ok');
    };
  };
  w.addEventListener('click', e => { const b = e.target.closest('[data-fosp]'); if (b) { closeModal(w); openSpecies(b.dataset.fosp); } });
  bind();
  const go = $('#fo-draw', w);
  if (go) go.onclick = () => {
    go.disabled = true; const deck = $('#fo-deck', w); if (deck) deck.classList.add('shake');
    setTimeout(() => {
      const box = $('#fo-box', w); if (!box || !box.isConnected) return;
      box.innerHTML = foCardHTML(f, true); bind();
      gmSave({ fo: day }).then(() => { if (S.route === 'home' || S.route === 'games') rerenderSoon(); });
    }, 750);
  };
}
/* the home page: a line to draw it, or today's fish once drawn */
function foStripHTML() {
  if (!S.ready) return '';
  const day = kstDay();
  if (gmGet().fo !== day) return `<button class="card fo-strip" data-act="fortune"><span class="fo-strip-ic" aria-hidden="true">🎣</span><span class="fo-strip-t"><b>${t('fo_title')}</b><span class="muted small">${t('fo_sub')}</span></span><span class="btn btn-primary btn-sm">${t('fo_draw')}</span></button>`;
  const f = fortuneOf(myId(), day);
  return `<button class="card fo-strip done" data-act="fortune"><img src="${FD.thumb(SPI[f.sp], 120, 66)}" alt=""><span class="fo-strip-t"><b>${t('fo_today')} · ${esc(nameOf(f.sp))} <span class="fo-st">${foStars(f.stars)}</span></b><span class="muted small">“${esc(t('fo_m' + f.msg))}”</span></span>${icon('chev')}</button>`;
}

/* ---------- 챔질 반응속도 ---------- */
const RX = { ROUNDS: 5, MIN: 100, MISS: 1500 };
function rxGrade(avg) { return avg < 230 ? 1 : avg < 280 ? 2 : avg < 340 ? 3 : avg < 450 ? 4 : 5; }
function rxBoard() { // everyone's best average (plausible ones only), best first
  const rows = [];
  const add = (uid, a) => { const g = a && a.games; if (!g || !(g.rtAvg >= 120 && g.rtAvg < RX.MISS)) return; rows.push({ uid, a, avg: Math.round(g.rtAvg), best: Math.round(g.rt || g.rtAvg) }); };
  for (const [uid, a] of S.anglers) if (uid !== myId()) add(uid, a);
  if (S.me && S.me.nick) add(myId(), S.me);
  return rows.sort((x, y) => x.avg - y.avg || x.best - y.best);
}
function openReaction() {
  const w = openModal(`<div class="rx">
    <div class="rx-top"><h2>${icon('clock')}${t('rx_title')}</h2><span class="rx-round num" id="rx-round"></span></div>
    <div class="rx-stage" id="rx-stage" role="button" tabindex="0" aria-label="${esc(t('rx_tap'))}"><canvas id="rx-cv" aria-hidden="true"></canvas><p class="rx-big num" id="rx-big" aria-live="assertive"></p></div>
    <p class="rx-msg" id="rx-msg">${t('rx_sub')}</p>
    <ol class="rx-times" id="rx-times"></ol>
    <div class="rx-end" id="rx-end" hidden></div>
    <div class="actions"><button class="btn btn-primary btn-lg" id="rx-go">${t('rx_start')}</button></div>
  </div>`, { label: t('rx_title') });
  const cv = $('#rx-cv', w), stage = $('#rx-stage', w), big = $('#rx-big', w), msg = $('#rx-msg', w), list = $('#rx-times', w), go = $('#rx-go', w), end = $('#rx-end', w), rnd = $('#rx-round', w);
  const G = { st: 'idle', times: [], fouls: 0, timers: [], nibs: [], at: 0, sinkAt: 0, raf: 0 };
  RX.cur = G; // the running game (the tests look at it)
  const later = (fn, ms) => G.timers.push(setTimeout(fn, ms));
  const clear = () => { G.timers.forEach(clearTimeout); G.timers = []; };
  const paintList = () => { list.innerHTML = G.times.map(v => `<li class="${v >= RX.MISS ? 'miss' : ''}">${v >= RX.MISS ? t('rx_miss') : t('rx_ms', { n: v })}</li>`).join(''); rnd.textContent = G.st === 'idle' || G.st === 'done' ? '' : t('rx_round', { n: Math.min(G.times.length + 1, RX.ROUNDS), of: RX.ROUNDS }); };
  function round() {
    clear(); G.st = 'wait'; G.at = performance.now(); big.textContent = ''; big.className = 'rx-big num'; msg.textContent = t('rx_wait');
    const delay = 1500 + Math.random() * 3200;
    G.nibs = []; for (let i = Math.floor(Math.random() * 3); i > 0; i--) G.nibs.push(400 + Math.random() * (delay - 700));
    later(() => { if (G.st === 'wait') { G.st = 'sinkNext'; } }, delay); // the dive shows on the next frame, and the clock starts there
    paintList();
  }
  function record(v) {
    G.times.push(v); paintList();
    if (G.times.length >= RX.ROUNDS) later(finish, 900); else later(round, 1000);
  }
  function foul(key) { clear(); G.st = 'foul'; G.fouls++; big.textContent = '✋'; big.className = 'rx-big num bad'; msg.textContent = t(key); if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch (e) { } later(round, 1200); }
  function hit(ts) {
    if (G.st === 'wait') return foul('rx_foul');
    if (G.st === 'sinkNext') return foul('rx_toofast');
    if (G.st !== 'sink') return;
    const v = Math.round(ts - G.sinkAt);
    if (v < RX.MIN) return foul('rx_toofast');
    clear(); G.st = 'got'; big.textContent = t('rx_ms', { n: v }); big.className = 'rx-big num ok'; msg.textContent = v < 230 ? '⚡' : '';
    record(v);
  }
  async function finish() {
    clear(); G.st = 'done'; cancelAnimationFrame(G.raf); paintList();
    const ok = G.times.filter(v => v < RX.MISS);
    const avg = Math.round(G.times.reduce((a, b) => a + b, 0) / G.times.length), best = ok.length ? Math.min(...ok) : null;
    const old = gmGet(); const rec = !(old.rtAvg <= avg);
    const patch = { rtN: (old.rtN || 0) + 1 };
    if (rec) { patch.rtAvg = avg; patch.rtAt = nowMs(); }
    if (best != null && !(old.rt <= best)) patch.rt = best;
    await gmSave(patch);
    const board = rxBoard(); const me = board.findIndex(x => x.uid === myId());
    big.textContent = ''; msg.textContent = '';
    end.hidden = false; end.innerHTML = `<p class="rx-grade">${t('rx_g' + rxGrade(avg))}${rec ? ` <span class="chip chip-new">${t('rx_newrec')}</span>` : ''}</p>
      <div class="rx-sum"><div><span>${t('rx_avg')}</span><b class="num">${t('rx_ms', { n: avg })}</b></div><div><span>${t('rx_best')}</span><b class="num">${best == null ? '—' : t('rx_ms', { n: best })}</b></div>${G.fouls ? `<div><span>${t('rx_fouls_k')}</span><b class="num">${G.fouls}</b></div>` : ''}</div>
      ${me >= 0 && S.me && S.me.nick && !zpOn() ? `<p class="muted small">${t('rx_myrank', { n: me + 1, of: board.length })}</p>` : ''}`;
    go.textContent = t('rx_again'); go.hidden = false;
    if (G.tok) {
      const wk = document.createElement('p'); wk.className = 'rx-wk'; wk.textContent = t('rx_wk_sending'); end.appendChild(wk);
      const tok = await G.tok; G.tok = null;
      let r = null;
      if (tok) { try { r = await APP_AUTH.zp.rxSubmit(tok, G.times.slice(0, RX.ROUNDS)); } catch (e) { r = { err: (e && e.code) || 'unavailable' }; } }
      else r = { err: G.tokErr || 'unavailable' };
      RX.last = r;
      if (wk.isConnected) {
        if (r && !r.err) { wk.innerHTML = `${icon('trophy')}<span>${t('rx_wk_place', { n: r.r, of: r.n })}${r.rec ? ` <span class="chip chip-new">${t('rx_wk_rec')}</span>` : ''}</span>`; wk.classList.add('ok'); }
        else wk.textContent = t(r && r.err === 'too_fast' ? 'rx_wk_fast' : r && r.err === 'slow' ? 'rx_wk_slow' : r && r.err === 'need_update' ? 'zp_err_server' : 'rx_wk_err');
      }
      zpLoad(true).then(() => { if (S.route === 'games') rerenderSoon(); });
    } else if (zpOn() && !zpMine()) { const wk = document.createElement('p'); wk.className = 'rx-wk'; wk.textContent = t('rx_wk_profile'); end.appendChild(wk); }
    if (S.route === 'games') rerenderSoon();
  }
  // drawing: sea, a float that bobs, twitches for nibbles and dives for the bite
  function draw(now) {
    G.raf = requestAnimationFrame(draw);
    if (!cv.isConnected) { cancelAnimationFrame(G.raf); clear(); return; }
    const r = cv.getBoundingClientRect(); const wd = r.width, ht = r.height; if (!wd || !ht) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(wd * dpr)) { cv.width = Math.round(wd * dpr); cv.height = Math.round(ht * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sea = ht * .42, tt = now / 1000;
    const sky = g.createLinearGradient(0, 0, 0, ht); sky.addColorStop(0, '#9ED4EA'); sky.addColorStop(.415, '#CFEAF4'); sky.addColorStop(.42, '#2E8CC0'); sky.addColorStop(1, '#0E4E78');
    g.fillStyle = sky; g.fillRect(0, 0, wd, ht);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= wd; x += 8) { const y = sea + Math.sin(x / 20 + tt * 2) * 2; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    if (G.st === 'sinkNext') { G.st = 'sink'; G.sinkAt = now; if (navigator.vibrate) try { navigator.vibrate(50); } catch (e) { } later(() => { if (G.st === 'sink') { clear(); G.st = 'got'; big.textContent = t('rx_miss'); big.className = 'rx-big num bad'; record(RX.MISS); } }, RX.MISS); }
    const el = (now - G.at);
    let dy = Math.sin(tt * 2.6) * 2.5;
    if (G.st === 'wait' && G.nibs.some(n => el >= n && el < n + 260)) dy = 5 + Math.sin(tt * 45) * 2; // a nibble: a little twitch
    if (G.st === 'sink') dy = Math.min(26, (now - G.sinkAt) * .25) + 4;
    const fx = wd / 2, fy = sea + dy;
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx, 0); g.lineTo(fx, fy - 26); g.stroke();
    g.save(); g.beginPath(); g.rect(0, 0, wd, sea + 1); g.clip(); // the part above the water
    g.fillStyle = '#FF3B2F'; g.beginPath(); g.ellipse(fx, fy - 12, 9, 15, 0, Math.PI, 0); g.fill(); g.fillStyle = '#FFF'; g.fillRect(fx - 9, fy - 12, 18, 6); g.fillStyle = '#FF3B2F'; g.beginPath(); g.ellipse(fx, fy - 6, 9, 9, 0, 0, Math.PI); g.fill();
    g.strokeStyle = '#2B2433'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, fy - 27); g.lineTo(fx, fy - 40); g.stroke();
    g.restore();
    g.fillStyle = 'rgba(255,59,47,.35)'; g.beginPath(); g.ellipse(fx, fy - 4, 8, 12, 0, 0, Math.PI * 2); if (fy - 4 > sea) g.fill(); // under water, faint
    if (G.st === 'sink') { const k = (now - G.sinkAt) / 400; for (let i = 0; i < 3; i++) { const rr = ((k + i / 3) % 1) * 46; g.strokeStyle = `rgba(255,255,255,${1 - rr / 46})`; g.beginPath(); g.ellipse(fx, sea + 2, rr, rr * .3, 0, 0, Math.PI * 2); g.stroke(); }
      g.font = `800 ${Math.round(Math.min(wd, ht) * .17)}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center'; g.fillStyle = '#FF5A1F'; g.fillText(t('pk_zzirit'), wd / 2, sea * .55); }
  }
  G.raf = requestAnimationFrame(draw);
  const press = e => { if (G.st === 'idle' || G.st === 'done' || G.st === 'foul' || G.st === 'got') return; e.preventDefault(); hit(e.timeStamp || performance.now()); };
  stage.addEventListener('pointerdown', press);
  stage.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e); });
  go.onclick = () => {
    G.times = []; G.fouls = 0; end.hidden = true; end.innerHTML = ''; go.hidden = true; stage.focus({ preventScroll: true });
    // on the website the run starts on the server too, so this week's board (and its prizes) only takes real games
    G.tok = zpMine() ? APP_AUTH.zp.rxBegin().catch(e => { G.tokErr = (e && e.code) || 'unavailable'; return null; }) : null; G.tokErr = null;
    round();
  };
  paintList();
}

/* ---------- the page ---------- */
VIEWS.games = {
  render(el) {
    const g = gmGet(); const day = kstDay(); const drawn = g.fo === day; const f = drawn ? fortuneOf(myId(), day) : null;
    const board = rxBoard(); const meAt = board.findIndex(x => x.uid === myId());
    const srv = zpOn(); if (srv) zpEnsure();
    const wme = srv && ZP.st && ZP.st.rx && ZP.st.rx.me;
    el.innerHTML = `<div class="page games-page">
      <header class="page-head"><h1>${t('gm_title')}</h1><p class="lede">${t('gm_sub')}</p></header>
      ${srv ? zpWalletHTML('games') : ''}
      <div class="gm-grid">
        <section class="card gm-card gm-fo">
          <div class="gm-art fo-art" aria-hidden="true">${f ? `<img src="${FD.thumb(SPI[f.sp], 240, 160)}" alt="">` : '<span>?</span>'}</div>
          <h2 class="h3">${t('fo_title')}</h2>
          <p class="muted">${f ? `${t('fo_today')}: <b>${esc(nameOf(f.sp))}</b> <span class="fo-st">${foStars(f.stars)}</span>` : t('fo_sub')}</p>
          <button class="btn ${f ? 'btn-line' : 'btn-primary'}" data-act="fortune">${f ? t('fo_open') : t('fo_draw')}</button>
        </section>
        <section class="card gm-card gm-rx">
          <div class="gm-art rx-art" aria-hidden="true"><i class="rx-float"></i></div>
          <h2 class="h3">${t('rx_title')}</h2>
          <p class="muted">${t('rx_sub')}</p>
          <p class="gm-mine">${t('rx_mine')}: <b class="num">${g.rtAvg ? t('rx_ms', { n: Math.round(g.rtAvg) }) : t('rx_none_yet')}</b>${g.rt ? ` <span class="muted small">(${t('rx_best')} ${t('rx_ms', { n: Math.round(g.rt) })})</span>` : ''}</p>
          ${srv ? `<p class="gm-week">${wme ? t('rx_wk_mine', { n: wme.r, ms: wme.s }) : t('rx_wk_prize')}</p>` : ''}
          <button class="btn btn-primary" data-act="reaction">${t('gm_play')}</button>
        </section>
        ${window.APP_RT === 'web' ? `<a class="card gm-card gm-park" href="#park"><div class="gm-art pk-art" aria-hidden="true">${typeof PK_THUMB === 'string' && PK_THUMB ? `<img src="${PK_THUMB}" alt="">` : ''}</div><h2 class="h3">${t('gm_park')}</h2><p class="muted">${t('gm_park_sub')}</p><span class="btn btn-line">${t('home_live_go')}</span></a>` : ''}
      </div>
      ${srv ? rxWeekHTML() : `<section class="card rx-rank">
        <div class="sec-head tight"><h2 class="h3">${icon('trophy')}${t('rx_rank')}</h2><span class="muted small">${t('gm_fun')}</span></div>
        ${board.length ? `<ol class="rk-list">${board.slice(0, 10).map((x, i) => `<li class="${x.uid === myId() ? 'me' : ''}"><span class="wk-rank r${i + 1}">${i + 1}</span><button class="rk-who" data-seauid="${esc(x.uid)}">${avatar(x.a, 30)}<b>${esc(x.a.nick || '?')}</b>${lvMini(x.a, x.uid)}</button><span class="rk-v num">${t('rx_ms', { n: x.avg })}</span></li>`).join('')}</ol>
          ${meAt >= 10 ? `<p class="muted small">${t('rx_myrank', { n: meAt + 1, of: board.length })}</p>` : ''}` : `<p class="muted">${t('rx_rank_none')}</p>`}
      </section>`}
      ${srv ? `<a class="card gm-shop" href="#lures"><span class="gm-shop-art" aria-hidden="true">${['minnow', 'reel_spark', 'float_spark'].map(id => `<img src="${ZL.url(id, 'game')}" alt="">`).join('')}</span><span class="gm-shop-t"><b>${t('zl_title')}</b><span class="muted small">${t('gm_shop_sub')}</span></span>${icon('chev')}</a>` : ''}
    </div>`;
    if (window.APP_RT === 'web' && typeof pkThumb === 'function' && !PK_THUMB) { pkThumb(); setTimeout(() => { const a = $('.gm-park .gm-art', el); if (a && PK_THUMB && !a.firstChild) a.innerHTML = `<img src="${PK_THUMB}" alt="">`; }, 1500); }
  }
};
