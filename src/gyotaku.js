/* ===== 어탁 (gyotaku): the catch printed in ink on paper, the old way anglers kept a fish. Made on this device from the
   species drawing and the length the angler registered — the photo is not needed and nothing is sent anywhere.
   The paper lies over the print first; tap (or pull it up) to peel it off. Three inks: 먹 (sumi black), 쪽빛 (indigo),
   은빛 밤바다 (silver ink on the night-sea paper). The brush letters come from Google Fonts when they can (Nanum Brush
   Script, Yuji Syuku, Ma Shan Zheng); without them a plain serif. The place is the sea or the region at most. ===== */
const GY = { el: null, o: null, ink: new Map(), style: lsGet('gyStyle', 'sumi'), blob: null, peeled: false };
const GY_ST = {
  sumi: { paper: ['#F5F0E6', '#E8DFCD'], ink: [16, 20, 28], text: '#161A22', sub: '#5B5F66', seal: '#A8222B', fib: 'rgba(120,105,80,' },
  ai: { paper: ['#F3F1EA', '#E2DED2'], ink: [20, 44, 98], text: '#14295A', sub: '#56607A', seal: '#A8222B', fib: 'rgba(90,100,130,' },
  gin: { paper: ['#0D1B36', '#050A13'], ink: [214, 228, 244], text: '#E3F3FF', sub: '#8FA3BF', seal: '#B3262E', fib: 'rgba(124,196,255,' }
};
const GY_W = 1080, GY_H = 1350;
const GY_FONT = { ko: 'Nanum Brush Script', en: 'Nanum Brush Script', ja: 'Yuji Syuku', zh: 'Ma Shan Zheng' };
const gyLang = () => ['ko', 'en', 'ja', 'zh'][S.li] || 'ko';
const gyBrush = () => `"${GY_FONT[gyLang()]}", "Nanum Myeongjo", "Noto Serif KR", "Noto Serif JP", "Noto Serif SC", serif`;
// the brush letters: asked once, only when an 어탁 is opened; a page that cannot reach Google Fonts uses a serif
let _gyFontP = null;
function gyFonts(text) {
  if (!_gyFontP) {
    _gyFontP = new Promise(res => {
      try {
        const fam = [...new Set(Object.values(GY_FONT))].map(f => 'family=' + f.replace(/ /g, '+')).join('&');
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + fam + '&display=swap';
        l.onload = () => res(true); l.onerror = () => res(false); document.head.appendChild(l);
      } catch (e) { res(false); }
      setTimeout(() => res(false), 2500);
    });
  }
  return _gyFontP.then(okk => okk ? Promise.race([document.fonts.load(`80px "${GY_FONT[gyLang()]}"`, text || '어탁'), new Promise(r => setTimeout(r, 1800))]).catch(() => null) : null);
}
// a small steady noise (the paper's fibres and the dry brush look the same every time for the same fish)
function gyRand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function gyImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

/* the fish in ink: the drawing's shape becomes the inked area; its light and dark become the pressed texture
   (scales, fin rays, the eye), then dry-brush gaps and the paper's grain */
async function gyInk(sp, style) {
  const key = sp.id + '|' + style; if (GY.ink.has(key)) return GY.ink.get(key);
  const W = 960, H = 960, img = await gyImg(FD.thumb(sp, W, H));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, W, H);
  const id = g.getImageData(0, 0, W, H), d = id.data, N = W * H, lum = new Float32Array(N), a = new Float32Array(N);
  for (let i = 0; i < N; i++) { const k = i * 4; a[i] = d[k + 3] / 255; lum[i] = (.3 * d[k] + .59 * d[k + 1] + .11 * d[k + 2]) / 255; }
  // a blurred copy (box blur, rows then columns) for the fine detail
  const blur = new Float32Array(N), tmp = new Float32Array(N), R = 5;
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -R; x <= R; x++) s += lum[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * R + 1); s += lum[y * W + Math.min(W - 1, x + R + 1)] - lum[y * W + Math.max(0, x - R)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -R; y <= R; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { blur[y * W + x] = s / (2 * R + 1); s += tmp[Math.min(H - 1, y + R + 1) * W + x] - tmp[Math.max(0, y - R) * W + x]; } }
  const rnd = gyRand(FD.hashStr ? FD.hashStr(sp.id) : 7), st = GY_ST[style] || GY_ST.sumi;
  const scaly = !['eel', 'ribbon', 'octopus', 'squid', 'cuttle', 'ray', 'crab', 'shrimp'].includes(sp.sh), ss = 13;
  // the grain: a coarse random field, smoothed, that makes the ink pool and thin like a real rubbing
  const GW = Math.ceil(W / 8) + 2, GH = Math.ceil(H / 8) + 2, grain = new Float32Array(GW * GH); for (let i = 0; i < grain.length; i++) grain[i] = rnd();
  const gr = (x, y) => { const gx = x / 8, gy = y / 8, x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0, q = (i, j) => grain[(y0 + j) * GW + x0 + i]; return (q(0, 0) * (1 - fx) + q(1, 0) * fx) * (1 - fy) + (q(0, 1) * (1 - fx) + q(1, 1) * fx) * fy; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, k = i * 4, al = a[i];
    if (al < .4) { d[k + 3] = 0; continue; }
    const hp = lum[i] - blur[i];
    let v = .96 - (lum[i] - .45) * .4 - hp * 3.2;
    if (scaly) { const row = Math.floor(y / ss), ox = row % 2 ? ss / 2 : 0, cx = Math.floor((x + ox) / ss) * ss - ox + ss / 2, cy = row * ss, r = Math.hypot(x - cx, y - cy); if (r > ss * .55 && r < ss * .72 && y > cy) v -= .16; }
    v *= .72 + .42 * gr(x, y);
    if (rnd() < .05 * (1 - v)) v *= .35; // dry-brush gaps
    v = Math.max(0, Math.min(1, v)) * Math.min(1, (al - .4) / .25);
    d[k] = st.ink[0]; d[k + 1] = st.ink[1]; d[k + 2] = st.ink[2]; d[k + 3] = Math.round(v * 235);
  }
  g.putImageData(id, 0, 0);
  // only the fish: cut the empty paper around it so it can be laid out as large as fits
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
  const cw = x1 - x0 + 2, ch = y1 - y0 + 2, cc = document.createElement('canvas'); cc.width = cw; cc.height = ch; cc.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
  const out = { cv: cc, W: cw, H: ch };
  if (GY.ink.size > 8) GY.ink.clear(); GY.ink.set(key, out); return out;
}
// vertical letters (Korean, Japanese, Chinese), one under another; Latin goes across
function gyVert(g, s, x, y, size, maxH) {
  const ch = [...s], step = Math.min(size * 1.02, maxH / Math.max(1, ch.length)); g.font = `${step / 1.02}px ${gyBrush()}`; g.textAlign = 'center'; g.textBaseline = 'top';
  ch.forEach((c, i) => g.fillText(c, x, y + i * step)); return y + ch.length * step;
}
function gySeal(g0, x, y, s, txt, color, round, rnd) {
  // drawn on its own small canvas, so the worn spots only take ink off the stamp, not off the paper
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(s * 1.4); const g = cv.getContext('2d');
  g.save(); g.translate(cv.width / 2, cv.height / 2); g.rotate(-.04 + rnd() * .08);
  g.fillStyle = color; g.globalAlpha = .9;
  g.beginPath(); if (round) g.arc(0, 0, s / 2, 0, 6.2832); else g.rect(-s / 2, -s / 2, s, s); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  const ch = [...txt].slice(0, 4), n = ch.length, fs = n <= 1 ? s * .62 : s * .4;
  g.font = `${fs}px ${gyBrush()}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (n <= 1) g.fillText(ch[0] || '', 0, s * .03);
  else if (n === 2) { g.fillText(ch[0], 0, -s * .2); g.fillText(ch[1], 0, s * .22); }
  else ch.forEach((c, i) => g.fillText(c, (i < 2 ? s * .2 : -s * .2), (i % 2 ? s * .22 : -s * .2)));
  // a worn edge, as a stamp pressed by hand
  for (let i = 0; i < 70; i++) { const an = rnd() * 6.2832, r = s * (.36 + rnd() * .2); g.beginPath(); g.arc(Math.cos(an) * r, Math.sin(an) * r, 1 + rnd() * 3, 0, 6.2832); g.fill(); }
  g.restore(); g0.drawImage(cv, x - cv.width / 2, y - cv.height / 2);
}
async function gyDraw(o, style) {
  const st = GY_ST[style] || GY_ST.sumi, sp = SPI[o.sp];
  const name = spName(sp), cm = (+o.cm || 0), lenTxt = fmtN(cm, 1) + 'cm';
  await gyFonts(name + lenTxt + (o.nick || '') + t('gy_word') + APP_NAME[0] + '0123456789.');
  const cv = document.createElement('canvas'); cv.width = GY_W; cv.height = GY_H; const g = cv.getContext('2d');
  const rnd = gyRand((FD.hashStr ? FD.hashStr(o.sp + '|' + cm + '|' + (o.ts || 0)) : 11));
  // the paper: a soft wash, long fibres and a few flecks
  const bg = g.createLinearGradient(0, 0, GY_W * .3, GY_H); bg.addColorStop(0, st.paper[0]); bg.addColorStop(1, st.paper[1]); g.fillStyle = bg; g.fillRect(0, 0, GY_W, GY_H);
  for (let i = 0; i < 900; i++) { const x = rnd() * GY_W, y = rnd() * GY_H, l = 6 + rnd() * 30, an = rnd() * 6.28; g.strokeStyle = st.fib + (.05 + rnd() * .1) + ')'; g.lineWidth = .6 + rnd(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * l / 2 + rnd() * 6, y + Math.sin(an) * l / 2, x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); }
  const vg = g.createRadialGradient(GY_W / 2, GY_H * .45, GY_W * .3, GY_W / 2, GY_H * .45, GY_W * .9); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, style === 'gin' ? 'rgba(0,0,0,.35)' : 'rgba(90,70,40,.12)'); g.fillStyle = vg; g.fillRect(0, 0, GY_W, GY_H);
  // the fish, pressed a little crooked as by hand
  const ink = await gyInk(sp, style), k = Math.min(900 / ink.W, 560 / ink.H), fw = ink.W * k, fh = ink.H * k, fx = (GY_W - fw) / 2 - 20, fy = 600 - fh / 2;
  g.save(); g.translate(fx + fw / 2, fy + fh / 2); g.rotate(-.035); g.drawImage(ink.cv, -fw / 2, -fh / 2, fw, fh); g.restore();
  // the ruler under it: the registered length across the fish's width
  const ry = Math.max(fy + fh + 44, 800), rx0 = fx, rx1 = fx + fw;
  g.strokeStyle = st.text; g.globalAlpha = .7; g.lineWidth = 3; g.beginPath(); g.moveTo(rx0, ry); g.lineTo(rx1, ry); g.stroke();
  const ticks = Math.max(2, Math.min(60, Math.round(cm))), major = cm > 60 ? 10 : 5;
  for (let i = 0; i <= ticks; i++) { const x = rx0 + (rx1 - rx0) * i / ticks, big = i % major === 0 || i === ticks; g.lineWidth = big ? 2.5 : 1.2; g.beginPath(); g.moveTo(x, ry); g.lineTo(x, ry - (big ? 18 : 9)); g.stroke(); }
  g.globalAlpha = 1;
  // the words: the name in brush letters down the right side (across in English), the length, the day, the place, the angler
  g.fillStyle = st.text;
  const vert = S.li !== 1;
  if (vert) { gyVert(g, name, GY_W - 110, 60, 118, 250); }
  else { g.font = `120px ${gyBrush()}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(name.length > 16 ? name.slice(0, 16) + '…' : name, 70, 200); }
  g.font = `110px ${gyBrush()}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(lenTxt, GY_W / 2, ry + 140);
  const day = o.ts ? new Date(o.ts) : new Date(nowMs()), ds = `${day.getFullYear()}. ${day.getMonth() + 1}. ${day.getDate()}.`;
  g.textAlign = 'left'; g.fillStyle = st.sub; g.font = `600 30px "IBM Plex Sans KR", "IBM Plex Sans JP", "Noto Sans SC", system-ui, sans-serif`;
  const lines = [ds + (o.where ? '  ·  ' + o.where : ''), o.nick ? t('gy_by', { nick: o.nick }) : ''].filter(Boolean);
  lines.forEach((l, i) => g.fillText(l.length > 40 ? l.slice(0, 40) + '…' : l, 70, GY_H - 150 + i * 46));
  if (vert) { g.fillStyle = st.sub; g.font = `40px ${gyBrush()}`; g.textAlign = 'left'; g.fillText(t('gy_word'), 70, 110); }
  else { g.fillStyle = st.sub; g.font = `600 26px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'left'; g.fillText(t('gy_word').toUpperCase(), 72, 92); }
  // two seals: the app's square one, the angler's round one
  gySeal(g, GY_W - 140, GY_H - 160, 120, APP_NAME[0].slice(0, 2), st.seal, false, rnd);
  if (o.nick) gySeal(g, GY_W - 270, GY_H - 150, 84, [...o.nick][0], st.seal, true, rnd);
  g.fillStyle = st.sub; g.globalAlpha = .7; g.font = `500 22px "IBM Plex Sans KR", system-ui, sans-serif`; g.textAlign = 'left'; g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), 70, GY_H - 40); g.globalAlpha = 1;
  return cv;
}

/* --- the screen: the paper over the print, peel it, pick the ink, keep it --- */
async function gyOpen(o) {
  const sp = o && SPI[o.sp]; if (!sp || !(+o.cm > 0)) return;
  GY.o = o; GY.peeled = false; GY.blob = null;
  const w = openModal(`<div class="gy" data-gy-root>
    <p class="eyebrow">${icon('fish')} ${t('gy_word')}</p>
    <h2>${t('gy_h')}</h2>
    <p class="lede">${t('gy_sub')}</p>
    <div class="gy-stage"><canvas class="gy-cv" width="${GY_W}" height="${GY_H}" aria-label="${esc(t('gy_alt', { name: spName(sp), len: fmtN(+o.cm, 1) + 'cm' }))}" role="img"></canvas>
      <button class="gy-paper" data-gypeel aria-label="${esc(t('gy_peel'))}"><span class="gy-hand">${icon('chev')}</span><b>${t('gy_peel')}</b><small>${t('gy_peel_sub')}</small></button>
      <div class="gy-wait" hidden><i></i></div></div>
    <div class="gy-ink" role="radiogroup" aria-label="${esc(t('gy_ink'))}">${Object.keys(GY_ST).map(k => `<button role="radio" class="gy-chip${k === GY.style ? ' on' : ''}" aria-checked="${k === GY.style}" data-gyst="${k}"><i class="gy-dot ${k}"></i>${t('gy_st_' + k)}</button>`).join('')}</div>
    <div class="actions"><button class="btn btn-primary" data-gysave disabled>${icon('share')}${t('gy_save')}</button><button class="btn btn-line" data-gyagain disabled>${icon('refresh')}${t('gy_again')}</button></div>
  </div>`, { wide: true, label: t('gy_h'), onClose: () => { GY.el = null; } });
  GY.el = w;
  const paper = $('.gy-paper', w);
  // pulling the paper up works as well as a tap
  let y0 = null;
  paper.addEventListener('pointerdown', e => { y0 = e.clientY; try { paper.setPointerCapture(e.pointerId); } catch (er) { } });
  paper.addEventListener('pointermove', e => { if (y0 == null || GY.peeled) return; const dy = Math.min(0, e.clientY - y0); paper.style.transform = `perspective(900px) rotateX(${Math.max(-60, dy / 3)}deg)`; if (dy < -90) gyPeel(); });
  paper.addEventListener('pointerup', () => { y0 = null; if (!GY.peeled) paper.style.transform = ''; });
  w.addEventListener('click', e => {
    if (e.target.closest('[data-gypeel]')) gyPeel();
    const s = e.target.closest('[data-gyst]'); if (s) gyStyle(s.dataset.gyst);
    if (e.target.closest('[data-gyagain]')) gyAgain();
    const sv = e.target.closest('[data-gysave]'); if (sv) gySave(sv);
  });
  await gyRender();
}
async function gyRender() {
  const w = GY.el; if (!w) return;
  const wait = $('.gy-wait', w); if (wait) wait.hidden = false;
  try {
    const cv = await gyDraw(GY.o, GY.style), out = $('.gy-cv', w); if (!out || GY.el !== w) return;
    out.getContext('2d').drawImage(cv, 0, 0);
    GY.blob = await new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', .9));
  } catch (e) { console.warn(e); toast(t('share_fail'), 'warn'); }
  if (wait) wait.hidden = true;
  if (GY.peeled) $$('[data-gysave],[data-gyagain]', w).forEach(b => { b.disabled = !GY.blob; });
}
function gyPeel() {
  const w = GY.el; if (!w || GY.peeled) return;
  GY.peeled = true; const p = $('.gy-paper', w); p.style.transform = ''; p.classList.add('off');
  setTimeout(() => { if (p.isConnected) p.hidden = true; }, 950);
  if (typeof LVS !== 'undefined') { LVS.noise(.5, .08, 1200); LVS.noise(.25, .05, 3000, .25); setTimeout(() => LVS.play('land'), 650); LVS.buzz([20, 40, 60]); }
  $$('[data-gysave],[data-gyagain]', w).forEach(b => { b.disabled = !GY.blob; });
  const sv = $('[data-gysave]', w); if (sv && !sv.disabled) setTimeout(() => sv.focus({ preventScroll: true }), 900);
}
function gyAgain() {
  const w = GY.el; if (!w) return; const p = $('.gy-paper', w);
  GY.peeled = false; p.hidden = false; p.classList.remove('off'); p.classList.add('down'); setTimeout(() => p.classList.remove('down'), 500);
  if (typeof LVS !== 'undefined') { LVS.tone(120, 70, .25, .14, 'sine'); LVS.buzz(40); }
  $$('[data-gysave],[data-gyagain]', w).forEach(b => { b.disabled = true; });
  setTimeout(() => { const pp = $('.gy-paper', w); if (pp) pp.focus({ preventScroll: true }); }, 60);
}
async function gyStyle(k) {
  if (!GY_ST[k] || !GY.el) return; GY.style = k; lsSet('gyStyle', k);
  $$('[data-gyst]', GY.el).forEach(b => { const on = b.dataset.gyst === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  await gyRender();
}
async function gySave(btn) {
  if (!GY.blob || btn.disabled) return; btn.disabled = true;
  try {
    const o = GY.o, name = `zzirit-gyotaku-${o.sp}-${Math.round(o.cm)}cm.jpg`;
    await shareImage(GY.blob, name, t('gy_text', { name: spName(SPI[o.sp]), len: fmtN(+o.cm, 1) + 'cm' }), { title: 'gy_h', sub: 'gy_share_sub' });
  } catch (e) { toast(t('share_fail'), 'warn'); }
  finally { btn.disabled = false; }
}
// what an 어탁 needs from a registered catch (the place is the sea or the region, never the point)
function gyFromCatch(a, c) {
  let where = ''; try { where = c.sea ? dict(GEO.seaOf(c.lon, c.lat).n) : (c.rg ? regionName(c.rg) : ''); } catch (e) { }
  return { sp: c.sp, cm: c.len, ts: c.ts, where, nick: a && a.nick };
}
