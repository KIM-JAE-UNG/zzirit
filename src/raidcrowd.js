/* ===== 레이드 원정대: everyone in the raid stands together on the deck as their own character (the one made in the
   profile), lines out to the monster. Who is here comes from the raid's live channel (presence: a nickname and the
   character's looks, nothing else). A strike makes that angler's figure rear back, its line flash and the damage rise
   from its head; strikes from several anglers close together make a 합동 챔질 combo. Beaten: everyone dances and the
   MVP holds the monster up. Only the picture: the server still decides the damage (0027). ===== */
const RCW = { m: new Map(), combo: null, flash: 0, last: [] };
const RCW_MAX = 14;
function rcMe() { return { n: String((S.me && S.me.nick) || '').slice(0, 16), c: charOf(S.me || {}, myId()) }; }
function rcAdd(id, p, now) {
  let m = RCW.m.get(id);
  if (!m) { m = { id, n: '', look: null, ck: '', in: now, hit: -1e9, crit: false, pops: [], side: RCW.m.size % 2 ? 1 : -1, ph: Math.random() * 6, x: null }; RCW.m.set(id, m); }
  m.n = String((p && p.n) || m.n || '').slice(0, 16);
  const c = p && p.c && typeof p.c === 'object' ? p.c : null, ck = c ? JSON.stringify(c).slice(0, 600) : '';
  if (ck !== m.ck || !m.look) { m.ck = ck; try { m.look = ANG.look(c || CH.fromSeed(id)); } catch (e) { m.look = ANG.look(CH.fromSeed(id)); } }
  m.gone = false;
  return m;
}
// the channel's presence: who stands on the deck (I am always there)
function rcSync(state) {
  const now = performance.now(), seen = new Set([myId()]);
  rcAdd(myId(), rcMe(), now);
  for (const [id, list] of Object.entries(state || {})) {
    if (RCW.m.size >= 40 && !RCW.m.has(id)) continue;
    const p = Array.isArray(list) ? list[list.length - 1] : list; if (!p) continue;
    seen.add(id); rcAdd(id, p, now);
  }
  for (const m of RCW.m.values()) if (!seen.has(m.id)) m.gone = true;
}
/* 원정대 감정 표현: a wave, a bow, a dance on the deck; everyone in the raid sees it (only who and which move) */
const RC_EMO_GAP = 2200;
function rcEmo(id, k, nick) {
  const e = typeof EMO_BY !== 'undefined' && EMO_BY[k]; if (!e) return false;
  const now = performance.now(), m = RCW.m.get(id) || rcAdd(id, { n: nick }, now - 2000);
  if (m.emo && now - m.emo.t0 < Math.min(RC_EMO_GAP, e.dur * 1000) * .9) return false; // too often: the last one plays on
  m.emo = { k, t0: now, dur: e.dur };
  if (id !== myId() && typeof LVS !== 'undefined') LVS.tone(1320, 1568, .12, .05, 'triangle');
  return true;
}
// the moves I own (waving is free), as small buttons by the strike button
function rdEmoBarHTML() {
  if (typeof EMO === 'undefined') return '';
  return `<div class="rd-emo" role="group" aria-label="${esc(t('rd_emo'))}">${EMO.map(e => { const own = emoOwns(e.id); return `<button class="rd-emob${own ? '' : ' lock'}" data-rdemo="${e.id}" aria-label="${esc(emoName(e.id) + (own ? '' : ' · ' + t('rd_emo_lock')))}" title="${esc(emoName(e.id))}"><img src="${emoArt(e.id)}" alt="">${own ? '' : icon('lock')}</button>`; }).join('')}</div>`;
}
function rdEmo(k) {
  const e = typeof EMO_BY !== 'undefined' && EMO_BY[k]; if (!e) return;
  if (!emoOwns(k)) { toast(t('rd_emo_lock_t', { name: emoName(k) }), 'info'); return; }
  if (Date.now() - (RCW.emoAt || 0) < RC_EMO_GAP) return;
  if (!rcEmo(myId(), k, S.me && S.me.nick)) return;
  RCW.emoAt = Date.now();
  if (typeof LVS !== 'undefined') LVS.buzz(12);
  if (typeof RD !== 'undefined' && RD.room) RD.room.send('emo', { a: myId(), n: S.me && S.me.nick, k });
}
function rcReset() { RCW.m.clear(); RCW.combo = null; RCW.flash = 0; RCW.last = []; }
// someone struck: rear back, flash the line, the damage over the head, maybe a combo
function rcHit(id, dmg, crit, nick) {
  const now = performance.now();
  const m = RCW.m.get(id) || rcAdd(id, { n: nick }, now - 2000);
  m.hit = now; m.crit = !!crit; if (id !== myId()) m.pops.push({ t0: now, txt: '−' + dmg, big: !!crit }); // mine flies up in the middle
  if (m.pops.length > 4) m.pops.shift();
  RCW.last = RCW.last.filter(x => now - x.t < 1600 && x.id !== id); RCW.last.push({ id, t: now });
  const n = RCW.last.length;
  if (n >= 2) {
    const was = RCW.combo && now - RCW.combo.t0 < 1600 ? RCW.combo.n : 0;
    if (n > was) { RCW.combo = { n, t0: now }; RCW.flash = 1; if (typeof LVS !== 'undefined') { LVS.play(n >= 4 ? 'rare' : 'bite'); LVS.buzz([20, 30, 20]); } }
  }
}
// where each one stands: me in the middle, the others to both sides; a second row when it gets crowded
function rcLayout(W, H, won) {
  const list = [...RCW.m.values()].filter(m => !m.gone || performance.now() - m.hit < 3000);
  const me = list.find(m => m.id === myId()), rest = list.filter(m => m !== me).sort((a, b) => a.in - b.in).slice(0, RCW_MAX - 1);
  const order = []; rest.forEach((m, i) => { if (i % 2) order.push(m); else order.unshift(m); });
  if (me) order.splice(Math.floor(order.length / 2), 0, me);
  const phone = W < 640, foot = won ? H * (phone ? .5 : .56) : H - (phone ? 196 : 176), n = order.length;
  const two = n > (phone ? 4 : 8), front = two ? order.filter((_, i) => i % 2 === 0) : order, back = two ? order.filter((_, i) => i % 2 === 1) : [];
  const place = (row, y, k) => { const gap = Math.min(phone ? 84 : 150, (W - 40) / Math.max(1, row.length)); row.forEach((m, i) => { m.tx = W / 2 + (i - (row.length - 1) / 2) * gap; m.ty = y; m.k = k * (m.id === myId() ? 1.12 : 1); }); };
  place(back, foot - (phone ? 52 : 76), phone ? 6 : 9); place(front, foot, phone ? 7.6 : 11.5);
  return { back, front, foot, extra: Math.max(0, RCW.m.size - list.length) };
}
/* the deck, the anglers, their lines to the monster's mouth (mx, my); called from the raid's picture loop */
function rcDraw(g, W, H, T, now, mx, my, st) {
  const L = rcLayout(W, H, st === 'won'), on = st === 'on', won = st === 'won', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the deck: dark planks with lanterns
  if (!won) {
  const dy = L.foot - (W < 640 ? 70 : 84);
  const dk = g.createLinearGradient(0, dy, 0, H); dk.addColorStop(0, 'rgba(13,30,58,0)'); dk.addColorStop(.25, 'rgba(13,30,58,.85)'); dk.addColorStop(1, '#030812'); g.fillStyle = dk; g.fillRect(0, dy, W, H - dy);
  g.strokeStyle = 'rgba(124,196,255,.10)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const y = L.foot + 8 + i * 16; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { const x = W * (.12 + i * .25), y = L.foot + 4, a = .5 + .2 * Math.sin(T * 2 + i); const gl = g.createRadialGradient(x, y, 0, x, y, 60); gl.addColorStop(0, `rgba(124,196,255,${.22 * a})`); gl.addColorStop(1, 'rgba(124,196,255,0)'); g.fillStyle = gl; g.fillRect(x - 60, y - 60, 120, 120); }
  g.restore();
  }
  const mvp = RD.st && (RD.st.raid || RD.st.last), mvpId = mvp && mvp.top && mvp.top[0] && mvp.top[0].d > 0 ? mvp.top[0].a : null;
  const drawRow = row => row.forEach(m => {
    if (m.x == null) m.x = m.tx + (m.tx < W / 2 ? -W * .6 : W * .6);
    const walking = Math.abs(m.x - m.tx) > 2; m.x += (m.tx - m.x) * (reduce ? 1 : .08);
    const sinceHit = (now - m.hit) / 1000, yaw = Math.max(-38, Math.min(38, (mx - m.x) / W * 70));
    let inp; const em = m.emo && (now - m.emo.t0) / 1000 < m.emo.dur ? m.emo : null; if (m.emo && !em) m.emo = null;
    if (em && !walking && st !== 'lost') inp = { act: em.k, t: (now - em.t0) / 1000, T };
    else if (won) inp = m.id === mvpId ? { act: 'result', t: 1 + (T % 4), T } : { act: 'zzirit', t: (T + m.ph) % 3.6, T };
    else if (st === 'lost') inp = { act: 'lose', t: 1, T };
    else if (!on) inp = { act: 'wait', t: 1, T: T + m.ph, dip: 0 };
    else if (walking) inp = { act: 'walk', t: 1, T: T + m.ph, walk: 1 };
    else if (sinceHit < .22) inp = { act: 'hook', t: sinceHit, T };
    else inp = { act: 'fight', t: 1, T: T + m.ph, tension: .45 + .25 * Math.sin(T * 1.7 + m.ph) + (sinceHit < .8 ? .3 : 0), pull: sinceHit < .7, reel: sinceHit > .7 && Math.sin(T * .9 + m.ph) > 0, side: Math.sin(T * .6 + m.ph) * .5 };
    let tip = null;
    try { tip = ANG.draw(g, { x: m.x, y: m.ty, k: m.k, yaw: won || em ? 180 : walking ? (m.tx > m.x ? 90 : -90) : yaw, bearing: 0, pitch: 62, look: m.look, mode: 'remote', noRing: true, in: inp, fish: won && m.id === mvpId && mvp ? { sp: SPI[mvp.sp] } : null }); } catch (e) { }
    // the line to the monster (bright for a moment after a strike)
    if (on && tip && !walking && !em) {
      const f = Math.max(0, 1 - sinceHit / .35), sag = 30 + 20 * Math.sin(T * 2 + m.ph);
      g.beginPath(); g.moveTo(tip.x, tip.y); g.quadraticCurveTo((tip.x + mx) / 2, Math.min(tip.y, my) - sag * (1 - f), mx, my);
      g.strokeStyle = f > 0 ? `rgba(255,255,255,${.6 + .4 * f})` : (m.id === myId() ? 'rgba(227,243,255,.75)' : 'rgba(180,215,250,.38)');
      g.lineWidth = f > 0 ? 1.4 + 2.2 * f : (m.id === myId() ? 1.5 : 1); if (f > 0) { g.shadowColor = '#7CC4FF'; g.shadowBlur = 14 * f; } g.stroke(); g.shadowBlur = 0;
      if (f > 0 && m.crit) { g.save(); g.globalCompositeOperation = 'lighter'; const sp = g.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 40 * f); sp.addColorStop(0, 'rgba(227,243,255,.9)'); sp.addColorStop(1, 'rgba(124,196,255,0)'); g.fillStyle = sp; g.beginPath(); g.arc(tip.x, tip.y, 40 * f, 0, 6.3); g.fill(); g.restore(); }
    }
    // the name over the head (mine in the spark colour), a crown for the MVP
    const hy = m.ty - m.k * 12.5, me = m.id === myId();
    g.font = `${me ? 700 : 600} ${W < 640 ? 11 : 12.5}px "IBM Plex Sans KR", system-ui, sans-serif`; g.textAlign = 'center';
    const label = (m.id === mvpId ? '♛ ' : '') + (m.n || t('lv_someone')), tw = g.measureText(label).width + 12;
    g.fillStyle = me ? 'rgba(124,196,255,.92)' : 'rgba(5,10,19,.62)'; g.beginPath(); g.roundRect ? g.roundRect(m.x - tw / 2, hy - 13, tw, 18, 9) : g.rect(m.x - tw / 2, hy - 13, tw, 18); g.fill();
    g.fillStyle = me ? '#050A13' : '#E3F3FF'; g.fillText(label, m.x, hy);
    // the move's word in a bubble over the name
    if (em) { const a = (now - em.t0) / 1000 / em.dur, say = t('emo_say_' + em.k); g.globalAlpha = Math.min(1, (1 - a) * 4, a * 8); g.font = `700 ${W < 640 ? 12 : 13.5}px "IBM Plex Sans KR", system-ui, sans-serif`; const bw = g.measureText(say).width + 18, by = hy - 44 - Math.min(1, a * 6) * 6;
      g.fillStyle = '#E3F3FF'; g.beginPath(); g.roundRect ? g.roundRect(m.x - bw / 2, by - 15, bw, 24, 12) : g.rect(m.x - bw / 2, by - 15, bw, 24); g.fill(); g.beginPath(); g.moveTo(m.x - 5, by + 9); g.lineTo(m.x + 5, by + 9); g.lineTo(m.x, by + 15); g.fill();
      g.fillStyle = '#050A13'; g.textAlign = 'center'; g.fillText(say, m.x, by + 2); g.globalAlpha = 1; }
    // the damage rising from the head
    m.pops = m.pops.filter(p => now - p.t0 < 1100);
    for (const p of m.pops) { const a = (now - p.t0) / 1100; g.globalAlpha = 1 - a * a; g.font = `italic 700 ${p.big ? (me ? 30 : 22) : (me ? 22 : 16)}px "Chakra Petch", system-ui, sans-serif`; g.fillStyle = p.big ? '#FFFFFF' : '#E3F3FF'; g.shadowColor = '#7CC4FF'; g.shadowBlur = p.big ? 16 : 6; g.fillText((p.big ? t('rd_crit') + ' ' : '') + p.txt, m.x, hy - 18 - a * 60); g.shadowBlur = 0; }
    g.globalAlpha = 1;
  });
  drawRow(L.back); drawRow(L.front);
  if (L.extra) { g.font = '600 12px "IBM Plex Sans KR", system-ui, sans-serif'; g.textAlign = 'right'; g.fillStyle = 'rgba(227,243,255,.75)'; g.fillText('+' + L.extra, W - 14, L.foot - 6); }
  // 합동 챔질: a flash and a big word in the middle
  if (RCW.flash > 0) { g.fillStyle = `rgba(227,243,255,${RCW.flash * .18})`; g.fillRect(0, 0, W, H); RCW.flash = Math.max(0, RCW.flash - .05); }
  const cb = RCW.combo; if (cb && now - cb.t0 < 1500 && on) {
    const a = (now - cb.t0) / 1500, s = 1 + .25 * Math.max(0, 1 - a * 5);
    g.save(); g.translate(W / 2, H * .25); g.scale(s, s); g.globalAlpha = 1 - a * a; g.textAlign = 'center';
    g.font = `italic 800 ${W < 640 ? 30 : 42}px "Chakra Petch", "IBM Plex Sans KR", system-ui, sans-serif`; g.fillStyle = '#FFFFFF'; g.shadowColor = '#7CC4FF'; g.shadowBlur = 24;
    g.fillText(t('rd_combo', { n: cb.n }), 0, 0); g.restore();
  }
  return L;
}
