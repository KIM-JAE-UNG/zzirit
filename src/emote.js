/* ===== 찌릿 라이브: 감정 표현 (emotes). The angler on the map waves, bows or dances, and the people at the same water
   see it: a speech bubble over that person's float (no place is sent — only who and which move; the float is already
   shared). Waving is free; the others are bought in the 찌릿 낚시점 with points (the server keeps the price and who owns
   what, like the gear). The shop shows each move with the player's own character. ===== */
const EMO = [
  { id: 'wave', item: '', dur: 2.4, bg: ['#1A2A44', '#0A1322'] },
  { id: 'bow', item: 'emo_bow', price: 150, dur: 2.4, bg: ['#1A2A44', '#0A1322'] },
  { id: 'dance', item: 'emo_dance', price: 300, dur: 3.2, bg: ['#1A2A44', '#0A1322'] },
  { id: 'zzirit', item: 'emo_zzirit', price: 800, sig: true, dur: 3.4, bg: ['#10285E', '#040B1E'] }
];
const EMO_BY = Object.fromEntries(EMO.map(e => [e.id, e]));
const emoName = id => t('emo_n_' + id);
function emoOwns(id) { const e = EMO_BY[id]; if (!e) return false; return !e.item || !!(typeof ZP !== 'undefined' && ZP.st && (ZP.st.owned || []).includes(e.item)); }
function emoPrice(e) { const it = typeof ZP !== 'undefined' && ZP.st && (ZP.st.items || []).find(x => x.id === e.item); return it ? it.price : e.price || 0; }

/* --- my own character doing a move, on a small canvas (the shop's cards and the detail) --- */
function emoPaint(cv, id, tSec, opt) {
  opt = opt || {};
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, e = EMO_BY[id] || EMO[0];
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  let look; try { look = ANG.look(charOf(S.me || {}, myId())); } catch (err) { look = ANG.look({}); }
  const k = h / (opt.tall ? 17.5 : 14);
  try { ANG.draw(c, { x: w / 2, y: h * (opt.tall ? .9 : .92), k, yaw: 180 + (opt.turn || 0), bearing: 0, pitch: 70, look, mode: 'look', noRing: true, in: { act: e.id, t: tSec, T: tSec + 1 } }); } catch (err) { }
}
const _emoArt = new Map();
function emoArt(id) {
  const key = id + '|' + (S.me && S.me.upd) + '|' + (typeof myGear === 'function' ? myGear('rod') : '');
  let u = _emoArt.get(key); if (u) return u;
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 240;
  emoPaint(cv, id, { wave: 1.05, bow: 1.0, dance: 1.2, zzirit: 1.6 }[id] || 1);
  try { u = cv.toDataURL('image/png'); } catch (err) { u = ''; }
  if (_emoArt.size > 16) _emoArt.clear(); _emoArt.set(key, u); return u;
}

/* --- the shop: the emote section --- */
function emoCardHTML(e) {
  const own = emoOwns(e.id);
  const tag = !e.item ? `<span class="zl-tag own">${t('emo_free')}</span>` : own ? `<span class="zl-tag own">${t('zl_owned')}</span>` : `<span class="zl-tag price num">${icon('coin')}${fmtN(emoPrice(e))}P</span>`;
  return `<button class="zl-card emo-card${own ? ' own' : ''}${e.sig ? ' sig' : ''}" data-emo="${e.id}" style="--zl-a:${e.bg[0]};--zl-b:${e.bg[1]}">
    ${e.sig ? `<span class="zl-sigb">${ZL.mark('silver', 'be' + e.id)}SIGNATURE</span>` : ''}
    <span class="zl-art"><img src="${emoArt(e.id)}" alt="" decoding="async"></span>
    <span class="zl-meta"><b>${esc(emoName(e.id))}</b><span class="small">${esc(t('emo_say_' + e.id))}</span></span>${tag}</button>`;
}
function openEmote(id) {
  const e = EMO_BY[id]; if (!e) return;
  let armed = 0, fresh = false, raf = 0;
  const body = () => {
    const own = emoOwns(id), price = emoPrice(e), bal = typeof zpBal === 'function' ? zpBal() : 0;
    let act;
    if (!e.item || own) act = `<a class="btn btn-primary btn-lg btn-block${fresh ? ' pop' : ''}" href="#live">${icon('live')}${t('emo_use')}</a>`;
    else if (!zpOn()) act = `<p class="muted small">${t('zp_web_only')}</p>`;
    else if (!zpMine()) act = `<p class="muted small">${t('zp_need_profile')}</p><button class="btn btn-primary btn-lg btn-block" data-act="onboard">${t('onb_go')}</button>`;
    else if (!ZP.st) act = `<button class="btn btn-primary btn-lg btn-block" disabled>${t(ZP.err ? 'zp_err' : 'loading')}</button>`;
    else if (bal >= price) act = `<button class="btn btn-primary btn-lg btn-block${armed ? ' armed' : ''}" data-emb="buy">${icon('coin')}${t(armed ? 'zl_buy_sure' : 'zl_buy', { p: fmtN(price) })}</button>`;
    else act = `<button class="btn btn-primary btn-lg btn-block" disabled>${icon('coin')}${t('zl_buy', { p: fmtN(price) })}</button><p class="hint">${t('zl_short', { n: fmtN(price - bal) })}</p><a class="btn btn-line btn-block" href="#live">${t('zp_earn_more')}</a>`;
    return `<div class="zl-detail emo-detail" style="--zl-a:${e.bg[0]};--zl-b:${e.bg[1]}">
      <div class="zl-stage${e.sig ? ' sig' : ''}"><canvas class="emo-cv" width="560" height="440" aria-label="${esc(emoName(id))}"></canvas>${e.sig ? `<span class="zl-badge sig">${ZL.mark('silver', 'de')}SIGNATURE</span>` : ''}${fresh ? `<span class="zl-new">${t('zl_new')}</span>` : ''}</div>
      <div class="zl-body">
        <p class="eyebrow no-up">${t('shop_t_emote')}${e.item ? '' : ' · ' + t('emo_free')}</p>
        <h2>${esc(emoName(id))}</h2>
        <p class="lede">${t('emo_d_' + id)}</p>
        <p class="muted small zl-where">${icon('users')} ${t('emo_where')}</p>
        <div class="zl-act">${act}</div>
        ${e.item && zpMine() && ZP.st ? `<p class="muted small zl-bal">${icon('coin')} ${t('zp_have', { n: fmtN(bal) })}</p>` : ''}
      </div></div>`;
  };
  const w = openModal(`<div id="emo-box">${body()}</div>`, { label: emoName(id) });
  const t0 = performance.now();
  const loop = () => {
    if (!w.isConnected) return; raf = requestAnimationFrame(loop);
    const cv = $('.emo-cv', w); if (!cv) return;
    emoPaint(cv, id, ((performance.now() - t0) / 1000) % (e.dur + .8), { tall: true });
  };
  raf = requestAnimationFrame(loop);
  const paint = () => { const b = $('#emo-box', w); if (b && b.isConnected) b.innerHTML = body(); };
  if (zpOn() && !ZP.st) zpLoad().then(paint);
  w.addEventListener('click', async ev => {
    if (ev.target.closest('[data-act="onboard"]')) { closeModal(w); openOnboarding(); return; }
    if (ev.target.closest('a[href^="#"]')) { closeModal(w); return; }
    const b = ev.target.closest('[data-emb]'); if (!b || b.disabled) return;
    if (!armed) { armed = setTimeout(() => { armed = 0; paint(); }, 3500); paint(); return; }
    clearTimeout(armed); armed = 0; b.disabled = true;
    try {
      const r = await APP_AUTH.zp.buy(e.item);
      if (ZP.st) { ZP.st.bal = r && typeof r.bal === 'number' ? r.bal : ZP.st.bal; ZP.st.owned = [...new Set([...(ZP.st.owned || []), e.item])]; }
      fresh = true; paint(); toast(t('emo_bought', { name: emoName(id) }), 'ok');
      zpLoad(true).then(() => { paint(); if (viewOf(S.route) === 'lures') rerenderSoon(); });
    } catch (err) {
      const c = err && err.code;
      toast(t(c === 'not_enough' ? 'zl_err_short' : c === 'owned' ? 'zl_err_owned' : c === 'no_profile' ? 'zp_need_profile' : c === 'no_item' || c === 'need_update' ? 'zp_err_server' : 'zp_err'), 'warn');
      zpLoad(true).then(paint);
    }
  });
}

/* --- in 찌릿 라이브: the picker, my move, and everyone else's --- */
LV.emos = new Map(); LV.emoMe = null; LV.emoNext = 0;
function emoPick() {
  const box = $('#lv-emo'); if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  if (typeof zpEnsure === 'function') zpEnsure();
  box.innerHTML = `<p class="lv-emoh">${t('emo_title')}</p><div class="lv-emol">${EMO.map(e => { const own = emoOwns(e.id);
    return `<button class="lv-emob${own ? '' : ' lock'}${e.sig ? ' sig' : ''}" data-emo-go="${e.id}"><img src="${emoArt(e.id)}" alt=""><b>${esc(emoName(e.id))}</b>${!e.item ? `<small class="ok">${t('emo_free')}</small>` : own ? `<small class="ok">${t('zl_owned')}</small>` : `<small class="num">${icon('lock')}${fmtN(emoPrice(e))}P</small>`}</button>`; }).join('')}</div>
    ${LV.anon ? `<p class="lv-emon">${t('emo_hidden')}</p>` : ''}`;
  box.hidden = false;
}
function emoGo(id) {
  const box = $('#lv-emo'); if (box) box.hidden = true;
  const e = EMO_BY[id]; if (!e) return;
  if (!emoOwns(id)) { S.shopTab = 'emote'; lsSet('shopTab', 'emote'); location.hash = '#lures'; setTimeout(() => openEmote(id), 350); return; }
  const now = performance.now(), A = LV.ang;
  if (!A.at || !LV.ready) return lvSay(t('emo_need_stand'), 3200);
  if (!['idle', 'wait'].includes(LV.phase)) return lvSay(t('emo_busy'), 2600);
  if (now < LV.emoNext) return;
  A.emo = id; A.emoEnd = now + e.dur * 1000; LV.emoMe = { e: id, at: now }; LV.emoNext = now + e.dur * 1000 + 600;
  if (id === 'zzirit') { LVS.play('bite'); LVS.buzz([0, 60, 40, 90]); } else if (id === 'dance') LVS.play('nib');
  if (!LV.anon && LV.room) LV.room.send('emote', { u: myId(), e: id, n: ((S.me && S.me.nick) || '').slice(0, 12) });
}
// someone at this water made a move: a bubble over their float, or a line in the ticker when their float isn't out
function emoGot(p) {
  if (!p || typeof p.u !== 'string' || p.u === myId() || !EMO_BY[p.e]) return;
  const now = performance.now(), last = LV.emos.get(p.u);
  if (last && now - last.at < 2500) return;
  const n = String(p.n || '').slice(0, 12) || t('lv_someone'), o = LV.others.get(p.u);
  LV.emos.set(p.u, { e: p.e, at: now, n });
  if (o && o.f) return;
  const el = $('#lv-ticker'); if (!el) return;
  const d = document.createElement('p'); d.className = 'lv-tick emo' + (lvIsFr(p.u) ? ' fr' : '');
  d.innerHTML = `<b>${esc(n)}</b> <span>${esc(t('emo_tick_' + p.e))}</span>`;
  el.prepend(d); while (el.children.length > 3) el.lastChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 500); }, 4500);
}
function emoBubble(c, x, y, txt, u, fr) {
  const a = u < .12 ? u / .12 : u > .85 ? (1 - u) / .15 : 1, rise = (1 - Math.min(1, u / .12)) * 8;
  c.save(); c.globalAlpha = Math.max(0, a); c.font = '700 12.5px "IBM Plex Sans KR", sans-serif';
  const w = Math.ceil(c.measureText(txt).width) + 20, h = 26, bx = x - w / 2, by = y - h - 8 + rise;
  c.beginPath(); if (c.roundRect) c.roundRect(bx, by, w, h, 13); else c.rect(bx, by, w, h);
  c.moveTo(x - 6, by + h); c.lineTo(x, by + h + 7); c.lineTo(x + 6, by + h);
  c.fillStyle = fr ? '#7CC4FF' : '#FFFFFF'; c.shadowColor = 'rgba(5,10,19,.35)'; c.shadowBlur = 8; c.fill(); c.shadowBlur = 0;
  c.fillStyle = '#0B1530'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, by + h / 2 + .5);
  c.restore();
}
// called by the map's frame after the angler is drawn
function emoFrame(c, now) {
  if (LV.emoMe) {
    const e = EMO_BY[LV.emoMe.e], u = (now - LV.emoMe.at) / (e.dur * 1000);
    if (u >= 1 || !LV.ang.at) LV.emoMe = null;
    else { const g = lvG(LV.ang.at); emoBubble(c, g.x, g.y - lvAngK() * 14.5, t('emo_say_' + e.id), u, false); }
  }
  for (const [id, m] of LV.emos) {
    const e = EMO_BY[m.e], u = (now - m.at) / (e.dur * 1000 + 600);
    if (u >= 1) { LV.emos.delete(id); continue; }
    const o = LV.others.get(id); if (!o || !o.f) continue;
    const g = lvG({ lng: o.x, lat: o.y }); if (g.x < -60 || g.x > LV.w + 60 || g.y < -60 || g.y > LV.h + 60) continue;
    emoBubble(c, g.x, g.y - 30, t('emo_say_' + e.id), u, lvIsFr(id));
  }
}
