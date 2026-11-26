/* ===== 사진으로 길이 재기: put something everyone has (a card, a coin) next to the fish, take the photo, then drag
   two dots to the ends of that thing and two to the fish's mouth and tail. The fish's length comes from the ratio.
   All on this device, on the photo already chosen for the catch; the photo goes nowhere else. A loupe shows what is
   under the finger while a dot is dragged. ===== */
const MZ_REF = [
  { id: 'card', mm: 85.6, li: [0, 1, 2, 3] }, // a bank or transit card, the long side (ISO/IEC 7810 ID-1)
  { id: 'w500', mm: 26.5, li: [0] }, { id: 'w100', mm: 24, li: [0] },
  { id: 'usq', mm: 24.26, li: [1] }, { id: 'y500', mm: 26.5, li: [2] }, { id: 'y100', mm: 22.6, li: [2] }, { id: 'cny1', mm: 25, li: [3] },
  { id: 'own', mm: 0, li: [0, 1, 2, 3] }
];
const MZ = { el: null, im: null, cb: null, ref: 'card', own: 30, p: null, drag: -1, fit: null, raf: 0 };
// the fish length in cm from the four dots (image pixels) and the thing's size in mm
function mzLen(p, refMm) { const rp = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), fp = Math.hypot(p[3][0] - p[2][0], p[3][1] - p[2][1]); if (!(rp > 4) || !(refMm > 0)) return 0; return Math.round(fp / rp * refMm) / 10; }
function mzRefMm() { const r = MZ_REF.find(x => x.id === MZ.ref) || MZ_REF[0]; return r.id === 'own' ? (+MZ.own || 0) * 10 : r.mm; }
function mzOpen(im, cb) {
  if (!im || MZ.el) return;
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  MZ.im = im; MZ.cb = cb; MZ.drag = -1;
    // where the dots start: the thing low on the left, the fish across the middle
  MZ.p = [[W * .12, H * .82], [W * .32, H * .82], [W * .2, H * .5], [W * .8, H * .5]];
  const refs = MZ_REF.filter(r => r.li.includes(S.li)); MZ.ref = lsGet('mzRef', 'card'); if (!refs.some(r => r.id === MZ.ref)) MZ.ref = 'card';
  const el = document.createElement('div'); el.className = 'mz'; el.id = 'mz';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('ms_h'));
  el.innerHTML = `<div class="mz-top"><button class="mz-x" data-mzclose aria-label="${esc(t('close'))}">${icon('x')}</button><div><b>${t('ms_h')}</b><small>${t('ms_sub')}</small></div></div>
    <div class="mz-refs" role="radiogroup" aria-label="${esc(t('ms_ref'))}">${refs.map(r => `<button role="radio" class="mz-ref${r.id === MZ.ref ? ' on' : ''}" aria-checked="${r.id === MZ.ref}" data-mzref="${r.id}">${t('ms_r_' + r.id)}${r.mm ? `<small>${fmtN(r.mm / 10, 2)}cm</small>` : ''}</button>`).join('')}
      <label class="mz-own"${MZ.ref === 'own' ? '' : ' hidden'}><input type="number" inputmode="decimal" min="1" max="200" step="0.1" value="${MZ.own}" data-mzown aria-label="${esc(t('ms_own_lbl'))}"><span>cm</span></label></div>
    <div class="mz-stage"><canvas class="mz-cv" aria-label="${esc(t('ms_cv'))}"></canvas><canvas class="mz-loupe" width="240" height="240" hidden aria-hidden="true"></canvas></div>
    <div class="mz-foot"><p class="mz-legend"><span class="mz-k ref"></span>${t('ms_leg_ref')}<span class="mz-k fish"></span>${t('ms_leg_fish')}</p>
      <p class="mz-out" aria-live="polite"><b class="num" data-mzout>—</b><span>cm</span></p>
      <p class="mz-tip">${icon('info')}${t('ms_tip')}</p>
      <button class="btn btn-primary btn-lg btn-block" data-mzuse>${icon('check')}${t('ms_use')}</button></div>`;
  document.body.appendChild(el); document.body.classList.add('has-modal'); MZ.el = el;
  const cv = $('.mz-cv', el);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-mzclose]')) mzClose();
    const r = e.target.closest('[data-mzref]'); if (r) { MZ.ref = r.dataset.mzref; lsSet('mzRef', MZ.ref); $$('[data-mzref]', el).forEach(b => { const on = b === r; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); $('.mz-own', el).hidden = MZ.ref !== 'own'; if (MZ.ref === 'own') $('[data-mzown]', el).focus(); mzDraw(); }
    if (e.target.closest('[data-mzuse]')) { const cm = mzLen(MZ.p, mzRefMm()); if (!(cm > 0 && cm <= 600)) { toast(t('ms_err'), 'warn'); return; } const f = MZ.cb; mzClose(); if (f) f(cm); }
  });
  $('[data-mzown]', el).addEventListener('input', e => { MZ.own = parseFloat(e.target.value) || 0; mzDraw(); });
  const at = e => { const b = cv.getBoundingClientRect(), f = MZ.fit; return [(e.clientX - b.left - f.ox) / f.s, (e.clientY - b.top - f.oy) / f.s]; };
  cv.addEventListener('pointerdown', e => {
    const q = at(e), f = MZ.fit, hit = MZ.p.map((p, i) => [Math.hypot(p[0] - q[0], p[1] - q[1]) * f.s, i]).sort((a, b) => a[0] - b[0])[0];
    if (hit[0] > 44) return; MZ.drag = hit[1]; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) { }
    if (typeof LVS !== 'undefined') LVS.buzz(8); mzDraw();
  });
  cv.addEventListener('pointermove', e => { if (MZ.drag < 0) return; const q = at(e); MZ.p[MZ.drag] = [Math.max(0, Math.min(W, q[0])), Math.max(0, Math.min(H, q[1]))]; mzDraw(e); });
  const up = () => { if (MZ.drag < 0) return; MZ.drag = -1; $('.mz-loupe', el).hidden = true; mzDraw(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  // the keyboard: Tab to a dot is not possible on a canvas, so arrows move the last dot touched (1 = thing, 3 = fish)
  MZ.kd = 3; MZ.key = e => { if (e.key === 'Escape') { mzClose(); return; } if (/^[1-4]$/.test(e.key)) { MZ.kd = +e.key - 1; return; } const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (d && !e.target.closest('input')) { e.preventDefault(); const s = (e.shiftKey ? 10 : 2) / MZ.fit.s; MZ.p[MZ.kd] = [MZ.p[MZ.kd][0] + d[0] * s, MZ.p[MZ.kd][1] + d[1] * s]; mzDraw(); } };
  document.addEventListener('keydown', MZ.key);
  MZ.rs = () => mzDraw(); addEventListener('resize', MZ.rs);
  requestAnimationFrame(() => mzDraw());
  setTimeout(() => { const b = $('.mz-ref.on', el); if (b) b.focus(); }, 60);
}
function mzClose() { if (!MZ.el) return; document.removeEventListener('keydown', MZ.key); removeEventListener('resize', MZ.rs); MZ.el.remove(); MZ.el = null; if (!$('.modal-wrap.in')) document.body.classList.remove('has-modal'); }
function mzDraw(ev) {
  const el = MZ.el; if (!el) return;
  const cv = $('.mz-cv', el), st = $('.mz-stage', el), im = MZ.im, W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  const bw = st.clientWidth, bh = st.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(bw * dpr) || cv.height !== Math.round(bh * dpr)) { cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr); cv.style.width = bw + 'px'; cv.style.height = bh + 'px'; }
  const s = Math.min(bw / W, bh / H), ox = (bw - W * s) / 2, oy = (bh - H * s) / 2; MZ.fit = { s, ox, oy };
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, bw, bh);
  g.drawImage(im, ox, oy, W * s, H * s);
  const P = MZ.p.map(p => [ox + p[0] * s, oy + p[1] * s]);
  const seg = (a, b, col, label) => {
    g.lineWidth = 3; g.strokeStyle = 'rgba(5,10,19,.55)'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.lineWidth = 2; g.strokeStyle = col; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
    for (const q of [a, b]) { g.beginPath(); g.arc(q[0], q[1], 13, 0, 6.2832); g.fillStyle = 'rgba(5,10,19,.35)'; g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.stroke(); g.beginPath(); g.arc(q[0], q[1], 2.5, 0, 6.2832); g.fillStyle = col; g.fill(); }
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; g.font = '700 13px "IBM Plex Sans KR", system-ui, sans-serif'; const tw = g.measureText(label).width + 14;
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(mx - tw / 2, my - 30, tw, 22, 11) : g.rect(mx - tw / 2, my - 30, tw, 22); g.fill(); g.fillStyle = '#050A13'; g.textAlign = 'center'; g.fillText(label, mx, my - 14);
  };
  const cm = mzLen(MZ.p, mzRefMm());
  seg(P[0], P[1], '#E3F3FF', t('ms_leg_ref')); seg(P[2], P[3], '#7CC4FF', cm ? fmtN(cm, 1) + 'cm' : t('ms_leg_fish'));
  $('[data-mzout]', el).textContent = cm ? fmtN(cm, 1) : '—';
  // the loupe: 2.5× what is under the finger, above the finger so it is not hidden
  const lp = $('.mz-loupe', el);
  if (MZ.drag >= 0) {
    const q = MZ.p[MZ.drag], c = P[MZ.drag], L = 120, z = 2.5, lg = lp.getContext('2d');
    lp.hidden = false; lg.clearRect(0, 0, 240, 240); lg.save(); lg.beginPath(); lg.arc(120, 120, 118, 0, 6.2832); lg.clip();
    lg.fillStyle = '#050A13'; lg.fillRect(0, 0, 240, 240);
    const sw = 240 / (z * s); lg.drawImage(im, q[0] - sw / 2, q[1] - sw / 2, sw, sw, 0, 0, 240, 240);
    lg.strokeStyle = MZ.drag < 2 ? '#E3F3FF' : '#7CC4FF'; lg.lineWidth = 2; lg.beginPath(); lg.moveTo(120, 96); lg.lineTo(120, 144); lg.moveTo(96, 120); lg.lineTo(144, 120); lg.stroke(); lg.restore();
    const top = c[1] - L - 70 < 0 ? c[1] + 40 : c[1] - L - 70; lp.style.left = Math.max(4, Math.min(bw - L - 4, c[0] - L / 2)) + 'px'; lp.style.top = top + 'px';
  }
}
