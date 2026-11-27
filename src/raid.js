/* ===== 전설의 괴어 레이드: a giant legendary fish comes up every two hours for 20 minutes, and everyone fights it
   together from anywhere. A ring closes in on its weak spot: strike when the ring meets the circle (the server decides
   the damage from how well-timed it was). Everyone's strikes show up live (a realtime channel for the raid); the server
   is asked again every few seconds for the true strength. Beaten in time: everyone gets points by share, the MVP more.
   Website only (the server keeps the raid: 0027). ===== */
const RD = { st: null, at: 0, skew: 0, p: null, err: null, el: null, room: null, roomId: null, raf: 0, fx: [], ph0: 0, busy: false, poll: 0, shake: 0, end: null, last: 0, seen: lsGet('rdSeen', 0) };
const RD_RING = 1150; // ms for the ring to close
const rdOn = () => typeof lvOn === 'function' && lvOn() && !!(APP_AUTH.live && APP_AUTH.live.raid) && !!(S.me && S.me.nick);
const rdNow = () => Date.now() + RD.skew;
const rdRaid = () => (RD.st && RD.st.raid) || null;
const rdActive = (r = rdRaid()) => !!r && !r.beaten && rdNow() < r.ends && rdNow() >= r.starts;
const rdSpot = k => t('rd_spot_' + k) || k;
function rdClock(ms) {
  ms = Math.max(0, ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}
function rdLoad(force) {
  if (!rdOn()) return Promise.resolve(null);
  if (RD.p) return RD.p;
  if (!force && RD.st && Date.now() - RD.at < 25000) return Promise.resolve(RD.st);
  RD.p = APP_AUTH.live.raid().then(r => {
    if (!r) return null;
    const was = rdRaid();
    RD.st = r; RD.at = Date.now(); RD.skew = (r.now || Date.now()) - Date.now(); RD.err = null;
    // my own last strike may be newer than what the server sent a moment ago: keep the lower strength
    if (was && r.raid && was.id === r.raid.id && !r.raid.beaten && was.hp < r.raid.hp && Date.now() - RD.last < 2500) r.raid.hp = was.hp;
    rdPaint(); return r;
  }).catch(e => { RD.err = (e && e.code) || 'err'; return null; }).finally(() => { RD.p = null; });
  return RD.p;
}

/* --- the home card and the live button --- */
function raidCardHTML() {
  if (!rdOn()) return '';
  if (!RD.st && !RD.p && !RD.err) rdLoad();
  if (!RD.st) return '';
  return `<section class="rd-card${rdActive() ? ' on' : ''}" data-rdcard aria-label="${esc(t('rd_title'))}">${rdCardBody()}</section>`;
}
function rdCardBody() {
  const r = rdRaid(), st = RD.st, sp = r && SPI[r.sp];
  if (rdActive(r) && sp) {
    const pc = Math.round(100 * r.hp / Math.max(1, r.max));
    return `<div class="rd-c-art" aria-hidden="true"><img src="${FD.thumb(sp, 360, 190)}" alt=""><i></i></div>
      <div class="rd-c-txt">
        <p class="rd-c-eye"><span class="rd-pulse"></span>${t('rd_live')} · <b data-rdcount="end">${rdClock(r.ends - rdNow())}</b></p>
        <h2>${t('rd_card_h', { fish: esc(spName(sp)) })}</h2>
        <p class="rd-c-sub">${t(r.n ? 'rd_card_p' : 'rd_card_p0', { spot: esc(rdSpot(r.spot)), n: r.n })}</p>
        <div class="rd-c-hp" role="meter" aria-valuemin="0" aria-valuemax="${r.max}" aria-valuenow="${r.hp}" aria-label="HP"><i style="width:${pc}%"></i></div>
        <button class="btn btn-light" data-rdopen>${icon('bolt')}${t('rd_join')}</button>
      </div>`;
  }
  const l = st.last, lsp = l && SPI[l.sp];
  return `<div class="rd-c-art wait" aria-hidden="true">${r && SPI[r.sp] ? `<img src="${FD.thumb(SPI[r.sp], 360, 190)}" alt="">` : `<img src="${FD.thumb(SPI.kue || SPI.kurodai, 360, 190)}" alt="">`}<i></i></div>
    <div class="rd-c-txt">
      <p class="rd-c-eye">${icon('clock')}${t('rd_next')} · <b data-rdcount="next">${rdClock(st.next - rdNow())}</b></p>
      <h2>${t('rd_wait_h')}</h2>
      <p class="rd-c-sub">${lsp ? (l.beaten ? t('rd_last_won', { fish: esc(spName(lsp)), mvp: esc(l.mvpNick || '?'), n: l.n }) : t('rd_last_lost', { fish: esc(spName(lsp)) })) : t('rd_wait_p')}</p>
      <button class="btn btn-glass" data-rdopen>${icon('eye')}${t('rd_peek')}</button>
    </div>`;
}
// a strip on the live map's first screen while a raid is on
function rdCoverHTML() {
  const r = rdRaid(), sp = r && SPI[r.sp]; if (!rdActive(r) || !sp) return '';
  return `<button class="rd-strip" data-rdopen><span class="rd-pulse"></span><span><b>${t('rd_card_h', { fish: esc(spName(sp)) })}</b><small>${t('rd_strip_p')}</small></span>${icon('bolt')}</button>`;
}
function rdPaint() {
  $$('[data-rdcover]').forEach(el => { el.innerHTML = rdCoverHTML(); });
  $$('[data-rdcard]').forEach(el => { el.classList.toggle('on', rdActive()); el.innerHTML = rdCardBody(); });
  if (S.route === 'home' && !$('[data-rdcard]') && RD.st) rerenderSoon();
  const b = $('#lv-rdb'); if (b) b.hidden = !rdActive();
  const lb = $('#lv-rd'); if (lb) lb.classList.toggle('on', rdActive());
  if (RD.el) rdPanel();
}
// the countdowns, every second; a new raid (or the end of one) asks the server again
setInterval(() => {
  if (!RD.st) return;
  const r = rdRaid(), now = rdNow();
  $$('[data-rdcount]').forEach(n => { n.textContent = rdClock((n.dataset.rdcount === 'end' ? (r ? r.ends : 0) : RD.st.next) - now); });
  if ((r && !r.beaten && now >= r.ends) || (!rdActive() && now >= RD.st.next)) { if (Date.now() - RD.at > 4000) rdLoad(true); }
  else if (document.visibilityState === 'visible' && Date.now() - RD.at > (RD.el ? 3000 : 60000) && (S.route === 'home' || S.route === 'live' || RD.el)) rdLoad(true);
  // once a raid is on: one note per raid (a toast with a button), so nobody misses it
  if (rdActive(r) && RD.seen !== r.id && !RD.el && S.ready && !$('.modal-wrap.in')) { RD.seen = r.id; lsSet('rdSeen', r.id); rdToast(r); }
}, 1000);
function rdToast(r) {
  const sp = SPI[r.sp]; if (!sp) return;
  const root = $('#toast-root'); if (!root) return;
  const el = document.createElement('div'); el.className = 'toast toast-info rd-toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${icon('bolt')}<span>${esc(t('rd_toast', { fish: spName(sp), spot: rdSpot(r.spot) }))}</span><button class="btn btn-sm btn-primary" data-rdopen>${t('rd_join')}</button>`;
  root.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 9000);
}

/* --- the raid screen --- */
function rdOpen() {
  if (!rdOn()) { toast(t(S.me && S.me.nick ? 'lv_web_only' : 'dm_need_profile'), 'warn'); return; }
  if (RD.el) return;
  const el = document.createElement('div'); el.className = 'rd'; el.id = 'rd';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('rd_title'));
  el.innerHTML = `<canvas class="rd-cv" aria-hidden="true"></canvas>
    <div class="rd-head"><button class="rd-x" data-rdclose aria-label="${esc(t('close'))}">${icon('x')}</button><div class="rd-hd"></div>${APP_AUTH.live.raidRec ? `<button class="rd-recb" data-rropen>${icon('chart')}<span>${t('rr_btn')}</span><i class="rd-dot" data-rrdot hidden></i></button>` : ''}</div>
    <ol class="rd-top5" aria-label="${esc(t('rd_board'))}"></ol>
    <div class="rd-foot"><p class="rd-hint"></p><button class="rd-strike" data-rdstrike>${icon('bolt')}<span>${t('rd_strike')}</span></button><p class="rd-mine"></p>${typeof rdEmoBarHTML === 'function' ? rdEmoBarHTML() : ''}</div>
    <div class="rd-end" hidden></div>`;
  document.body.appendChild(el); document.body.classList.add('has-modal');
  RD.el = el; RD.end = null; RD.fx = []; RD.ph0 = performance.now();
  if (typeof rcReset === 'function') { rcReset(); rcSync({}); }
  el.addEventListener('click', e => {
    if (e.target.closest('[data-rdclose]')) rdClose();
    else if (e.target.closest('[data-rdstrike]')) rdStrike();
    else if (e.target.closest('[data-rdemo]')) rdEmo(e.target.closest('[data-rdemo]').dataset.rdemo);
    else if (e.target.closest('[data-rdshare]')) rdShare(e.target.closest('[data-rdshare]'));
    else if (e.target.classList.contains('rd-cv') && !$('.rd-rec:not([hidden])', el)) rdStrike();
  });
  RD.key = e => { const rec = $('.rd-rec:not([hidden])', el); if (rec) { if (e.key === 'Escape') rrClose(); return; } if (e.key === 'Escape') rdClose(); else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('button')) { e.preventDefault(); rdStrike(); } };
  document.addEventListener('keydown', RD.key);
  rdPanel(); rdLoad(true); rdLoop(); if (typeof rrLoad === 'function') rrLoad();
  setTimeout(() => { const b = $('.rd-strike', el); if (b && !b.disabled) b.focus(); }, 60);
}
function rdClose() {
  if (!RD.el) return;
  cancelAnimationFrame(RD.raf); document.removeEventListener('keydown', RD.key);
  RD.el.remove(); RD.el = null; document.body.classList.remove('has-modal');
  if (RD.room) { RD.room.leave(); RD.room = null; RD.roomId = null; }
  if (typeof rcReset === 'function') rcReset();
  rdPaint();
}
// join the raid's live channel (everyone's strikes as they happen)
function rdJoin(r) {
  if (!r || RD.roomId === r.id || !(APP_AUTH.rt && APP_AUTH.rt.room)) return;
  if (RD.room) RD.room.leave();
  RD.roomId = r.id;
  RD.room = APP_AUTH.rt.room('raid-' + r.id, myId(), {
    events: ['hit', 'won', 'emo'],
    // who stands on the deck (raidcrowd.js): a nickname and the character's looks
    sync: st => { if (typeof rcSync === 'function') rcSync(st); },
    status: x => { if (x === 'SUBSCRIBED' && RD.room && typeof rcMe === 'function') RD.room.track(rcMe()); },
    msg(ev, p) {
      const cur = rdRaid(); if (!cur || cur.id !== r.id) return;
      if (ev === 'hit') {
        const d = Math.max(0, Math.min(99, +p.d || 0)); if (!d) return;
        if (+p.hp >= 0 && +p.hp < cur.hp) cur.hp = +p.hp;
        if (+p.max > cur.max && +p.max < cur.max + 5000) cur.max = +p.max;
        if (typeof rcHit === 'function' && p.a) rcHit(String(p.a).slice(0, 64), d, !!p.c, String(p.n || '').slice(0, 16));
        else rdFx(String(p.n || t('lv_someone')).slice(0, 16) + ' −' + d, !!p.c, false);
        rdPanel();
      } else if (ev === 'emo') { if (typeof rcEmo === 'function' && p.a && String(p.a) !== myId()) rcEmo(String(p.a).slice(0, 64), String(p.k || ''), String(p.n || '').slice(0, 16)); }
      else if (ev === 'won') rdLoad(true);
    }
  });
}
// how well-timed a strike is now: 1 when the ring meets the circle
function rdQ(now = performance.now()) { const ph = ((now - RD.ph0) % RD_RING) / RD_RING; return Math.max(0, 1 - Math.abs(1 - ph) * 2.2) * (ph > .5 ? 1 : 0) || 0; }
function rdStrike() {
  const r = rdRaid(); if (!RD.el || !rdActive(r) || RD.busy) return;
  const q = +rdQ().toFixed(3); RD.busy = true; RD.ph0 = performance.now(); RD.last = Date.now();
  if (typeof LVS !== 'undefined') LVS.play('pull');
  APP_AUTH.live.raidHit(r.id, q).then(x => {
    if (!x) return;
    if (x.err === 'fast') return;
    if (x.err === 'no_profile') { toast(t('dm_need_profile'), 'warn'); return; }
    if (x.err) { if (x.raid) RD.st.raid = x.raid; rdLoad(true); rdPanel(); return; }
    r.hp = x.hp; r.max = x.max; r.me = Object.assign({}, r.me || {}, x.me);
    rdFx('−' + x.dmg, x.crit, true);
    // 합동 챔질 counted by the server (0029): the extra damage and how many struck together
    if (x.combo > 1 && x.bonus > 0) {
      if (RD.bonusId !== r.id) { RD.bonus = 0; RD.bonusId = r.id; } RD.bonus += x.bonus;
      setTimeout(() => rdFx(t('rd_cbonus', { n: x.combo, b: x.bonus }), true, true), 140);
      if (typeof LVS !== 'undefined') { LVS.play('coin'); LVS.buzz([15, 25, 15, 25, 30]); }
    }
    if (x.crit) { RD.shake = 1; if (typeof LVS !== 'undefined') { LVS.play('snap'); LVS.buzz([25, 30, 25]); } } else if (typeof LVS !== 'undefined') LVS.buzz(15);
    if (typeof rcHit === 'function') rcHit(myId(), x.dmg, x.crit, S.me.nick);
    if (RD.room) RD.room.send('hit', { a: myId(), n: S.me.nick, d: x.dmg, c: !!x.crit, hp: x.hp, max: x.max, x: Math.max(0, Math.min(5, +x.combo || 0)) });
    if (x.beaten && x.raid) { RD.st.raid = x.raid; if (RD.room) RD.room.send('won', {}); if (typeof LVS !== 'undefined') LVS.play('rare'); if (typeof zpLoad === 'function') zpLoad(); if (typeof rrLoad === 'function') setTimeout(() => rrLoad(true), 1200); }
    rdPanel();
  }).catch(e => { toast(t(e && e.code === 'need_update' ? 'zp_err_server' : 'lv_err'), 'warn'); }).finally(() => { RD.busy = false; });
}
function rdFx(txt, big, mine) {
  const W = innerWidth, H = innerHeight;
  RD.fx.push({ txt, big, mine, t0: performance.now(), x: W / 2 + (Math.random() - .5) * Math.min(W * .6, 360) + (mine ? 0 : 40), y: H * .42 + (Math.random() - .5) * 80 });
  if (RD.fx.length > 30) RD.fx.shift();
}
// the words and numbers around the picture
function rdPanel() {
  const el = RD.el; if (!el) return;
  const st = RD.st, r = rdRaid(), sp = r && SPI[r.sp], hd = $('.rd-hd', el), on = rdActive(r);
  if (!st) { hd.innerHTML = `<p class="rd-eye">${t('rd_title')}</p><h2>${t('lv_loading')}</h2>`; $('.rd-strike', el).disabled = true; return; }
  if (r && sp) {
    const pc = Math.max(0, Math.min(100, 100 * r.hp / Math.max(1, r.max)));
    hd.innerHTML = `<p class="rd-eye">${on ? `<span class="rd-pulse"></span>${t('rd_live')}` : t('rd_title')} · ${esc(rdSpot(r.spot))}</p>
      <h2>${t('rd_name', { fish: esc(spName(sp)) })}</h2>
      <div class="rd-hp" role="meter" aria-label="HP" aria-valuemin="0" aria-valuemax="${r.max}" aria-valuenow="${r.hp}"><i style="width:${pc}%"></i><span class="num">${fmtN(r.hp)} / ${fmtN(r.max)}</span></div>
      <p class="rd-meta">${on ? `${icon('clock')}<b data-rdcount="end">${rdClock(r.ends - rdNow())}</b> · ` : ''}${icon('users')}${t('rd_n', { n: r.n })}</p>`;
    rdJoin(on ? r : null);
  } else {
    hd.innerHTML = `<p class="rd-eye">${t('rd_title')}</p><h2>${t('rd_wait_h')}</h2>
      <p class="rd-meta">${icon('clock')}${t('rd_next')} <b data-rdcount="next">${rdClock(st.next - rdNow())}</b></p>`;
  }
  const top = (r && r.top) || [];
  $('.rd-top5', el).innerHTML = top.map((x, i) => `<li class="${x.a === myId() ? 'me' : ''}"><b class="num">${i + 1}</b><span>${esc(x.nick || t('lv_someone'))}</span><i class="num">${fmtN(x.d)}</i></li>`).join('');
  const b = $('.rd-strike', el); b.disabled = !on;
  $('.rd-hint', el).textContent = on ? t('rd_hint') : '';
  const me = r && r.me;
  $('.rd-mine', el).innerHTML = on ? (me ? t('rd_mine', { d: fmtN(me.d), r: me.rk || '-' }) + (RD.bonus && RD.bonusId === r.id ? ` <span class="rd-bonus" data-rdbonus>${icon('users')}${t('rd_bonus_tot', { b: fmtN(RD.bonus) })}</span>` : '') : t('rd_first')) : '';
  // the end: beaten, got away, or nothing on now
  const end = $('.rd-end', el);
  let k = !r ? 'wait' : r.beaten ? 'won' : rdNow() >= r.ends ? 'lost' : null;
  if (!r && st.last && rdNow() - st.last.ends < 10 * 60e3) k = st.last.beaten ? 'won' : 'lost';
  const rr = r || st.last;
  if (k === RD.end && k !== 'won') return;
  RD.end = k; end.hidden = !k; $('.rd-foot', el).hidden = !!k;
  if (!k) return;
  if (k === 'wait') { end.innerHTML = `<p class="rd-e-big">${icon('clock')}</p><h3>${t('rd_wait_h')}</h3><p>${t('rd_wait_long')}</p><button class="btn btn-line" data-rdclose>${t('close')}</button>`; return; }
  const fsp = rr && SPI[rr.sp];
  if (k === 'won') {
    const mine = rr.me && rr.me.d > 0;
    end.innerHTML = `<p class="rd-e-eye">${t('rd_won_eye')}</p><h3 class="rd-e-h">${t('rd_won_h')}</h3>
      <p class="rd-e-sub">${t('rd_won_p', { fish: esc(fsp ? spName(fsp) : ''), n: rr.n })}</p>
      <p class="rd-e-mvp">${icon('trophy')}MVP <b>${esc(rr.mvpNick || '?')}</b>${rr.mvp === myId() ? ` · ${t('rd_mvp_me')}` : ''}</p>
      ${mine ? `<p class="rd-e-pts"><b class="num">+${fmtN(rr.pts || 0)}P</b><span>${t('rd_mine', { d: fmtN(rr.me.d), r: rr.me.rk })}</span></p>` : `<p class="rd-e-sub">${t('rd_won_late')}</p>`}
      <div class="actions">${mine ? `<button class="btn btn-primary" data-rdshare>${icon('share')}${t('rd_share')}</button>` : ''}<button class="btn btn-glass" data-rdclose>${t('close')}</button></div>`;
    if (mine && rr.pts == null) setTimeout(() => rdLoad(true), 1500);
  } else {
    end.innerHTML = `<p class="rd-e-eye">${t('rd_lost_eye')}</p><h3 class="rd-e-h lost">${t('rd_lost_h')}</h3>
      <p class="rd-e-sub">${t('rd_lost_p', { fish: esc(fsp ? spName(fsp) : '') })}</p>
      <p class="rd-meta">${icon('clock')}${t('rd_next')} <b data-rdcount="next">${rdClock(st.next - rdNow())}</b></p>
      <div class="actions"><button class="btn btn-glass" data-rdclose>${t('close')}</button></div>`;
  }
}
// the picture: the deep sea, the monster swaying, the ring on its weak spot, the line, the numbers
function rdLoop() {
  const el = RD.el; if (!el) return;
  const cv = $('.rd-cv', el), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const now = performance.now(), T = now / 1000, r = rdRaid(), sp = (r && SPI[r.sp]) || (RD.st && RD.st.last && SPI[RD.st.last.sp]) || SPI.kue, on = rdActive(r);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0B2450'); bg.addColorStop(.55, '#06122A'); bg.addColorStop(1, '#02060F');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // light from the surface
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { const x = W * (.15 + i * .18) + Math.sin(T * .3 + i) * 30; const gr = g.createLinearGradient(x, 0, x + 80, H * .8); gr.addColorStop(0, 'rgba(124,196,255,.10)'); gr.addColorStop(1, 'rgba(124,196,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 50, 0); g.lineTo(x + 160, H * .8); g.lineTo(x + 20, H * .8); g.closePath(); g.fill(); }
  g.restore();
  // bubbles
  for (let i = 0; i < 26; i++) { const s = (i * 97.3) % 1, x = (i * 0.137 % 1) * W, y = H - ((T * (18 + s * 30) + i * 61) % (H + 40)); g.beginPath(); g.arc(x + Math.sin(T + i) * 6, y, 1.5 + s * 3, 0, 6.3); g.strokeStyle = 'rgba(180,220,255,.25)'; g.stroke(); }
  // the monster
  const size = Math.min(W * .86, H * .62, 620), shake = RD.shake > 0 ? (RD.shake -= .06, RD.shake * 10) : 0;
  const cx = W / 2 + (reduce ? 0 : Math.sin(T * .7) * W * .05) + (Math.random() - .5) * shake, cy = H * .40 + (reduce ? 0 : Math.sin(T * 1.1) * 10) + (Math.random() - .5) * shake;
  const hpF = r && r.max ? r.hp / r.max : 1;
  // its presence: slow rings of light around it
  if (!reduce) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const k = ((T * .35 + i / 3) % 1); g.beginPath(); g.ellipse(cx, cy, size * (.45 + k * .35), size * (.18 + k * .16), 0, 0, 6.3); g.strokeStyle = `rgba(124,196,255,${(1 - k) * (on ? .22 : .1)})`; g.lineWidth = 2; g.stroke(); } g.restore(); }
  g.save();
  g.shadowColor = on ? 'rgba(124,196,255,.65)' : 'rgba(124,196,255,.3)'; g.shadowBlur = 40;
  if (!on && !(r && r.beaten)) g.globalAlpha = .55;
  try { FD.draw(g, sp, cx, cy, size, { t: reduce ? 0 : T, still: reduce }); } catch (e) { }
  g.restore();
  // the eye glows harder as it weakens
  if (on) { g.save(); g.globalCompositeOperation = 'lighter'; const ex = cx + size * .33, ey = cy - size * .02, gl = g.createRadialGradient(ex, ey, 0, ex, ey, 26 + (1 - hpF) * 20); gl.addColorStop(0, 'rgba(227,243,255,.9)'); gl.addColorStop(1, 'rgba(124,196,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(ex, ey, 46, 0, 6.3); g.fill(); g.restore(); }
  // everyone on the deck, lines out to its mouth (raidcrowd.js)
  const mx = cx + size * .44, my = cy + size * .04;
  const rst = on ? 'on' : r && r.beaten ? 'won' : r && rdNow() >= r.ends ? 'lost' : 'wait';
  if (typeof rcDraw === 'function') rcDraw(g, W, H, T, now, mx, my, rst);
  // the weak spot and the ring closing in on it
  if (on) {
    const wx = cx + size * .06, wy = cy - size * .02, R0 = 26, ph = ((now - RD.ph0) % RD_RING) / RD_RING, rr = R0 + 90 * (1 - ph), q = rdQ(now);
    g.beginPath(); g.arc(wx, wy, R0, 0, 6.3); g.lineWidth = 3; g.strokeStyle = 'rgba(227,243,255,.95)'; g.stroke();
    g.beginPath(); g.arc(wx, wy, R0 * .35, 0, 6.3); g.fillStyle = q > .85 ? '#E3F3FF' : 'rgba(124,196,255,.7)'; g.fill();
    g.beginPath(); g.arc(wx, wy, rr, 0, 6.3); g.lineWidth = q > .85 ? 6 : 3; g.strokeStyle = q > .85 ? 'rgba(227,243,255,1)' : `rgba(124,196,255,${.35 + ph * .55})`; g.shadowColor = '#7CC4FF'; g.shadowBlur = q > .85 ? 24 : 8; g.stroke(); g.shadowBlur = 0;
  }
  // the numbers flying up
  RD.fx = RD.fx.filter(f => now - f.t0 < 1300);
  for (const f of RD.fx) {
    const a = (now - f.t0) / 1300; g.globalAlpha = 1 - a * a;
    g.font = `italic 700 ${f.mine ? (f.big ? 54 : 36) : (f.big ? 26 : 18)}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center';
    g.fillStyle = f.mine ? (f.big ? '#FFFFFF' : '#E3F3FF') : 'rgba(180,215,250,.9)'; g.shadowColor = '#7CC4FF'; g.shadowBlur = f.big ? 20 : 6;
    g.fillText((f.big && f.mine ? t('rd_crit') + ' ' : '') + f.txt, f.x, f.y - a * 90); g.shadowBlur = 0;
  }
  g.globalAlpha = 1;
  // beaten: sparks
  if (r && r.beaten) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const a = i * 2.4 + T * .6, d = ((T * 120 + i * 37) % 320); g.fillStyle = `rgba(227,243,255,${1 - d / 320})`; g.fillRect(W / 2 + Math.cos(a) * d, H * .42 + Math.sin(a) * d, 3, 3); } g.restore(); }
  RD.raf = requestAnimationFrame(rdLoop);
}

/* --- a story-sized picture to show off the win (1080×1920, drawn here) --- */
async function rdShare(btn) {
  const r = (RD.st && (RD.st.raid || RD.st.last)); if (!r || !SPI[r.sp]) return;
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try {
    const sp = SPI[r.sp], W = 1080, H = 1920, P = 72;
    const SANS = '"IBM Plex Sans KR", "IBM Plex Sans JP", "Noto Sans SC", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif', DISP = '"Chakra Petch", ' + SANS;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#123A7A'); bg.addColorStop(.5, '#0B1730'); bg.addColorStop(1, '#050A13'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const gl = g.createRadialGradient(W / 2, 820, 0, W / 2, 820, 640); gl.addColorStop(0, 'rgba(124,196,255,.5)'); gl.addColorStop(1, 'rgba(124,196,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.fillStyle = '#7CC4FF'; g.font = `700 44px ${DISP}`; g.fillText('LEGENDARY RAID', W / 2, 220);
    g.fillStyle = '#FFFFFF'; g.font = `800 96px ${SANS}`; g.fillText(fitText(g, t('rd_won_h'), W - P * 2), W / 2, 340);
    g.save(); g.shadowColor = 'rgba(124,196,255,.8)'; g.shadowBlur = 60; FD.draw(g, sp, W / 2, 820, 900, { still: true }); g.restore();
    g.fillStyle = '#FFFFFF'; g.font = `700 76px ${SANS}`; g.fillText(fitText(g, t('rd_name', { fish: spName(sp) }), W - P * 2), W / 2, 1250);
    g.fillStyle = '#A9BBCF'; g.font = `500 40px ${SANS}`; g.fillText(fitText(g, `${rdSpot(r.spot)} · ${t('rd_n', { n: r.n })}`, W - P * 2), W / 2, 1320);
    if (r.me) { g.fillStyle = '#7CC4FF'; g.font = `italic 700 170px ${DISP}`; g.fillText(fmtN(r.me.d), W / 2, 1540); g.fillStyle = '#E3F3FF'; g.font = `600 42px ${SANS}`; g.fillText(fitText(g, t('rd_story_dmg', { r: r.me.rk }) + (r.mvp === myId() ? ' · MVP' : ''), W - P * 2), W / 2, 1610); }
    g.fillStyle = '#A9BBCF'; g.font = `500 36px ${SANS}`; g.fillText(fitText(g, `${S.me.nick || ''} · ${fmtDate(r.beaten || nowMs())}`, W - P * 2), W / 2, 1700);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(P, H - 132, W - P * 2, 2);
    g.textAlign = 'left'; g.fillStyle = '#FFFFFF'; g.font = `800 38px ${SANS}`; g.fillText(`${APP_NAME[0]} ${APP_NAME[1]}`, P, H - 72);
    g.textAlign = 'right'; g.fillStyle = '#7F95AD'; g.font = `500 30px ${SANS}`; g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - P, H - 72);
    const blob = await new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', .9));
    await shareImage(blob, `zzirit-raid-${r.sp}.jpg`, t('rd_story_text', { fish: spName(sp) }), { tall: true, title: 'rd_share', sub: 'rd_story_sub' });
  } catch (e) { console.warn(e); toast(t('share_fail'), 'warn'); }
  finally { if (btn) btn.disabled = false; }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-rdopen]'); if (b && !b.closest('#rd')) { e.preventDefault(); rdOpen(); } });
