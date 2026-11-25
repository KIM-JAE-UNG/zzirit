/* ===== 나의 낚시 결산: the year told as a story (like the year-end recaps of music apps), from my own records only.
   The photo log (catches registered this year that were not refused) and, on the website, the live fish book.
   Full-screen slides that move on by themselves (tap right: next, left: back, hold: pause), the numbers count up, and
   the last slide is a picture to share (1080×1920). Nothing leaves the device except what the person chooses to share,
   and the picture holds no places. ===== */
const RC = { el: null, i: 0, slides: [], d: null, t0: 0, raf: 0, hold: false, live: null };
const RC_MS = 5200;
const rcYear = () => new Date(nowMs()).getFullYear();
function rcData(year = rcYear()) {
  const cs = myCatches().filter(c => c && c.st !== 'no' && SPI[c.sp] && new Date(c.ts || c.at || 0).getFullYear() === year);
  const by = {}, months = Array(12).fill(0), hours = [0, 0, 0, 0]; // dawn 4–8, day 8–16, evening 16–20, night
  let big = null, bigRel = null;
  for (const c of cs) {
    by[c.sp] = (by[c.sp] || 0) + 1;
    const d = new Date(c.ts || c.at); months[d.getMonth()]++;
    const h = d.getHours(); hours[h >= 4 && h < 8 ? 0 : h >= 8 && h < 16 ? 1 : h >= 16 && h < 20 ? 2 : 3]++;
    if (c.len && (!big || c.len > big.len)) big = c;
    const typ = SPI[c.sp].L; if (c.len && typ && (!bigRel || c.len / typ > bigRel.r)) bigRel = { c, r: c.len / typ };
  }
  const dex = (RC.live && RC.live.dex) || [];
  const liveN = dex.reduce((n, x) => n + (+x.n || 0), 0);
  const allSp = new Set([...Object.keys(by), ...dex.map(x => x.sp).filter(id => SPI[id])]);
  const fav = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || null;
  const legends = [...allSp].filter(id => SPI[id] && SPI[id].r >= 5);
  let liveBig = null; for (const x of dex) if (SPI[x.sp] && (!liveBig || +x.best > +liveBig.best)) liveBig = x;
  const busy = months.indexOf(Math.max(...months)), active = months.filter(Boolean).length, tot = cs.length + liveN;
  const hi = hours.indexOf(Math.max(...hours)), share = cs.length ? hours[hi] / cs.length : 0;
  // what kind of angler: the first that fits
  const type = !tot ? 'new' : legends.length ? 'legend' : bigRel && bigRel.r >= 1.3 ? 'giant' : allSp.size >= 8 ? 'collector'
    : cs.length >= 4 && share >= .4 && hi === 0 ? 'dawn' : cs.length >= 4 && share >= .4 && hi === 3 ? 'night' : active >= 4 ? 'steady' : liveN > cs.length ? 'live' : 'rookie';
  return { year, cs, n: cs.length, liveN, tot, sp: allSp.size, by, fav, big, liveBig, months, busy, active, hours, hi, share, legends, dex: dex.length, type,
    top3: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3) };
}
// the live fish book (website): asked once when the story opens
function rcLive() {
  if (!(typeof lvOn === 'function' && lvOn() && S.me && S.me.nick)) return Promise.resolve(null);
  if (typeof LV !== 'undefined' && LV.st && LV.st.dex) return Promise.resolve(RC.live = LV.st);
  return Promise.race([APP_AUTH.live.state().then(s => (RC.live = s)), new Promise(r => setTimeout(() => r(null), 2500))]).catch(() => null);
}

/* --- the home card --- */
function recapCardHTML() {
  if (!S.me || !S.me.nick) return '';
  const d = rcData(), y = d.year;
  return `<section class="rc-card" aria-label="${esc(t('rc_title', { y }))}">
    <div class="rc-c-txt"><p class="rc-c-eye">${icon('sparkle')}${t('rc_eye')}</p><h2>${t('rc_title', { y })}</h2>
      <p class="rc-c-sub">${d.tot ? t('rc_card_p', { n: fmtN(d.tot), s: d.sp }) : t('rc_card_empty')}</p>
      <button class="btn btn-light" data-rcopen>${icon('star')}${t('rc_open')}</button></div>
    <div class="rc-c-art" aria-hidden="true"><b class="num">${y}</b>${d.top3.slice(0, 3).map(([id], i) => `<img class="f${i}" src="${FD.thumb(SPI[id], 200, 110)}" alt="">`).join('')}</div>
  </section>`;
}

/* --- the story --- */
function rcSlides(d) {
  const nick = esc(S.me.nick || ''), y = d.year, sp = id => SPI[id] && esc(spName(SPI[id]));
  const L = [];
  L.push({ k: 'intro', bg: 1, html: `<p class="rc-eye">${APP_NAME[0]} ${APP_NAME[1]}</p><h2 class="rc-yr num">${y}</h2><p class="rc-big">${t('rc_intro', { nick })}</p><p class="rc-sm">${t('rc_tap')}</p>` });
  if (!d.tot) {
    L.push({ k: 'empty', bg: 2, html: `<p class="rc-eye">${t('rc_eye')}</p><h2 class="rc-h">${t('rc_empty_h')}</h2><p class="rc-p">${t('rc_empty_p')}</p>
      <div class="rc-cta"><a class="btn btn-light" href="#scan" data-rcclose>${icon('scan')}${t('cta_scan')}</a>${typeof lvOn === 'function' && lvOn() ? `<a class="btn btn-glass" href="#live" data-rcclose>${icon('live')}${t('dm_go')}</a>` : ''}</div>` });
    return L;
  }
  L.push({ k: 'count', bg: 2, html: `<p class="rc-eye">${t('rc_count_eye', { y })}</p><p class="rc-num num" data-rccount="${d.tot}">0</p><p class="rc-big">${t('rc_count_unit')}</p>
    <p class="rc-p">${t('rc_count_p', { s: d.sp, photo: d.n, live: d.liveN })}</p>` });
  const big = d.big ? { id: d.big.sp, cm: d.big.len, when: fmtDate(d.big.ts || d.big.at) } : d.liveBig ? { id: d.liveBig.sp, cm: +d.liveBig.best, when: t('lv_title') } : null;
  if (big) L.push({ k: 'big', bg: 3, html: `<p class="rc-eye">${t('rc_big_eye')}</p><div class="rc-fish"><img src="${FD.thumb(SPI[big.id], 520, 286)}" alt=""></div>
    <h2 class="rc-h">${sp(big.id)}</h2><p class="rc-num sm num"><span data-rccount="${Math.round(big.cm * 10)}" data-rcdiv="10">0</span><small>cm</small></p><p class="rc-sm">${esc(big.when)}</p>` });
  if (d.fav && d.fav[1] >= 2) L.push({ k: 'fav', bg: 4, html: `<p class="rc-eye">${t('rc_fav_eye')}</p><div class="rc-fish sm"><img src="${FD.thumb(SPI[d.fav[0]], 420, 230)}" alt=""></div>
    <h2 class="rc-h">${sp(d.fav[0])}</h2><p class="rc-p">${t('rc_fav_p', { n: d.fav[1] })}</p>` });
  if (d.n >= 2) {
    const mx = Math.max(1, ...d.months);
    L.push({ k: 'months', bg: 5, html: `<p class="rc-eye">${t('rc_mo_eye')}</p><h2 class="rc-h">${t('rc_mo_h', { m: esc(monthName(d.busy)) })}</h2>
      <div class="rc-bars" role="img" aria-label="${esc(d.months.map((v, i) => monthName(i) + ' ' + v).join(', '))}">${d.months.map((v, i) => `<span class="${i === d.busy ? 'on' : ''}" style="--v:${v / mx}"><i></i><b>${i + 1}</b></span>`).join('')}</div>
      <p class="rc-p">${t('rc_mo_p', { n: d.active })}</p>` });
    L.push({ k: 'hours', bg: 6, html: `<p class="rc-eye">${t('rc_hr_eye')}</p><p class="rc-ico">${icon(['sun', 'sun', 'moon', 'moon'][d.hi])}</p><h2 class="rc-h">${t('rc_hr_' + d.hi)}</h2>
      <p class="rc-p">${t('rc_hr_p', { p: Math.round(d.share * 100) })}</p>` });
  }
  if (d.dex) L.push({ k: 'live', bg: 7, html: `<p class="rc-eye">${t('lv_title')}</p><p class="rc-num num" data-rccount="${d.dex}">0</p><p class="rc-big">${t('rc_live_unit')}</p>
    <p class="rc-p">${t('rc_live_p', { n: d.liveN })}</p>${d.legends.length ? `<p class="rc-tag">${icon('star')}${t('rc_legend', { n: d.legends.length })}</p>` : ''}` });
  L.push({ k: 'type', bg: 8, html: `<p class="rc-eye">${t('rc_type_eye')}</p><p class="rc-ico big">${icon(RC_TYPE_IC[d.type] || 'fish')}</p><h2 class="rc-h xl">${t('rc_type_' + d.type)}</h2><p class="rc-p">${t('rc_type_' + d.type + '_p')}</p>` });
  L.push({ k: 'share', bg: 1, html: `<p class="rc-eye">${t('rc_eye')} · ${y}</p><div class="rc-sum">
      <p><b class="num">${fmtN(d.tot)}</b><span>${t('rc_count_unit')}</span></p><p><b class="num">${d.sp}</b><span>${t('rc_sum_sp')}</span></p>
      ${big ? `<p><b class="num">${fmtN(big.cm, 1)}</b><span>cm · ${sp(big.id)}</span></p>` : ''}<p class="wide"><b>${t('rc_type_' + d.type)}</b><span>${nick}</span></p></div>
    <div class="rc-cta"><button class="btn btn-light" data-rcshare>${icon('share')}${t('rc_share')}</button><button class="btn btn-glass" data-rcagain>${icon('refresh')}${t('rc_again')}</button></div>` });
  return L;
}
const RC_TYPE_IC = { legend: 'star', giant: 'trophy', collector: 'book', dawn: 'sun', night: 'moon', steady: 'flame', live: 'live', rookie: 'sparkle', new: 'fish' };
async function rcOpen() {
  if (RC.el) return;
  if (!S.me || !S.me.nick) { if (typeof openOnboarding === 'function') openOnboarding(); return; }
  await rcLive();
  RC.d = rcData(); RC.slides = rcSlides(RC.d); RC.i = 0;
  const el = document.createElement('div'); el.className = 'rc'; el.id = 'rc';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('rc_title', { y: RC.d.year }));
  el.innerHTML = `<div class="rc-frame"><div class="rc-bars-top">${RC.slides.map(() => '<i><b></b></i>').join('')}</div>
    <button class="rc-x" data-rcclose aria-label="${esc(t('close'))}">${icon('x')}</button>
    <div class="rc-slide" aria-live="polite"></div>
    <button class="rc-nav prev" data-rcprev aria-label="${esc(t('rc_prev'))}"></button><button class="rc-nav next" data-rcnext aria-label="${esc(t('rc_next'))}"></button></div>`;
  document.body.appendChild(el); document.body.classList.add('has-modal'); RC.el = el;
  el.addEventListener('click', e => {
    if (e.target.closest('[data-rcclose]')) { rcClose(); return; }
    if (e.target.closest('[data-rcshare]')) { rcShare(e.target.closest('[data-rcshare]')); return; }
    if (e.target.closest('[data-rcagain]')) { rcGo(0); return; }
    if (e.target.closest('[data-rcprev]')) rcGo(RC.i - 1); else if (e.target.closest('[data-rcnext]')) rcGo(RC.i + 1);
  });
  const hold = on => { RC.hold = on; if (!on) RC.t0 = performance.now() - RC.el._p * RC_MS; };
  el.addEventListener('pointerdown', e => { if (!e.target.closest('button,a')) hold(true); });
  el.addEventListener('pointerup', () => hold(false)); el.addEventListener('pointercancel', () => hold(false));
  RC.key = e => { if (e.key === 'Escape') rcClose(); else if (e.key === 'ArrowRight') rcGo(RC.i + 1); else if (e.key === 'ArrowLeft') rcGo(RC.i - 1); };
  document.addEventListener('keydown', RC.key);
  rcGo(0); rcTick();
  setTimeout(() => { const b = $('.rc-x', el); if (b) b.focus(); }, 50);
}
function rcClose() {
  if (!RC.el) return; cancelAnimationFrame(RC.raf); document.removeEventListener('keydown', RC.key);
  RC.el.remove(); RC.el = null; document.body.classList.remove('has-modal');
}
function rcGo(i) {
  if (!RC.el) return;
  if (i < 0) i = 0; if (i >= RC.slides.length) { i = RC.slides.length - 1; }
  RC.i = i; RC.t0 = performance.now(); RC.el._p = 0;
  const s = RC.slides[i], box = $('.rc-slide', RC.el);
  RC.el.dataset.bg = s.bg; RC.el.dataset.k = s.k;
  box.innerHTML = `<div class="rc-in">${s.html}</div>`;
  $$('.rc-bars-top i', RC.el).forEach((b, j) => { b.dataset.s = j < i ? 'done' : j === i ? 'on' : ''; $('b', b).style.width = j < i ? '100%' : '0%'; });
  // the numbers count up
  $$('[data-rccount]', box).forEach(n => {
    const to = +n.dataset.rccount, div = +n.dataset.rcdiv || 1, t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1100;
    const step = () => { const a = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - a, 3); n.textContent = fmtN(Math.round(to * e) / div, div > 1 ? 1 : 0); if (a < 1 && RC.el) requestAnimationFrame(step); };
    step();
  });
}
function rcTick() {
  if (!RC.el) return;
  const last = RC.i >= RC.slides.length - 1;
  if (!RC.hold && !last) {
    const p = Math.min(1, (performance.now() - RC.t0) / RC_MS); RC.el._p = p;
    const b = $$('.rc-bars-top i', RC.el)[RC.i]; if (b) $('b', b).style.width = (p * 100) + '%';
    if (p >= 1) rcGo(RC.i + 1);
  } else if (last) { const b = $$('.rc-bars-top i', RC.el)[RC.i]; if (b) $('b', b).style.width = '100%'; }
  RC.raf = requestAnimationFrame(rcTick);
}

/* --- the picture to share: the year on one card, no places --- */
async function rcBlob(d) {
  const W = 1080, H = 1920, P = 80;
  const SANS = '"IBM Plex Sans KR", "IBM Plex Sans JP", "Noto Sans SC", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif', DISP = '"Chakra Petch", ' + SANS;
  try { await Promise.race([document.fonts.load(`italic 700 200px ${DISP}`, '0123456789'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1E4FA8'); bg.addColorStop(.5, '#0B1730'); bg.addColorStop(1, '#050A13'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .1; g.fillStyle = '#7CC4FF'; g.font = `italic 700 520px ${DISP}`; g.textAlign = 'center'; g.fillText(String(d.year), W / 2 + 40, 620); g.restore();
  g.textAlign = 'left'; g.fillStyle = '#7CC4FF'; g.font = `700 42px ${DISP}`; g.fillText(`${d.year} FISHING RECAP`, P, 200);
  g.fillStyle = '#FFFFFF'; g.font = `800 84px ${SANS}`; g.fillText(fitText(g, t('rc_title', { y: d.year }), W - P * 2), P, 310);
  g.fillStyle = '#A9BBCF'; g.font = `500 44px ${SANS}`; g.fillText(fitText(g, S.me.nick || '', W - P * 2), P, 380);
  // three big numbers
  const big = d.big ? { id: d.big.sp, cm: d.big.len } : d.liveBig ? { id: d.liveBig.sp, cm: +d.liveBig.best } : null;
  const nums = [[fmtN(d.tot), t('rc_count_unit')], [String(d.sp), t('rc_sum_sp')], big ? [fmtN(big.cm, 1), 'cm'] : null].filter(Boolean);
  nums.forEach(([v, u], i) => { const y = 600 + i * 210; g.fillStyle = '#7CC4FF'; g.font = `italic 700 170px ${DISP}`; g.fillText(v, P, y); const w = g.measureText(v).width; g.fillStyle = '#E3F3FF'; g.font = `600 48px ${SANS}`; g.fillText(fitText(g, u, W - P * 2 - w - 30), P + w + 26, y); });
  if (big && SPI[big.id]) { g.save(); g.shadowColor = 'rgba(124,196,255,.7)'; g.shadowBlur = 40; FD.draw(g, SPI[big.id], W / 2, 1300, 760, { still: true }); g.restore(); }
  // the kind of angler
  g.fillStyle = 'rgba(124,196,255,.18)'; rrect(g, P, 1500, W - P * 2, 210, 36); g.fill();
  g.fillStyle = '#A9BBCF'; g.font = `500 36px ${SANS}`; g.fillText(t('rc_type_eye'), P + 44, 1570);
  g.fillStyle = '#FFFFFF'; g.font = `800 72px ${SANS}`; g.fillText(fitText(g, t('rc_type_' + d.type), W - P * 2 - 88), P + 44, 1660);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(P, H - 132, W - P * 2, 2);
  g.fillStyle = '#FFFFFF'; g.font = `800 38px ${SANS}`; g.fillText(`${APP_NAME[0]} ${APP_NAME[1]}`, P, H - 72);
  g.textAlign = 'right'; g.fillStyle = '#7F95AD'; g.font = `500 30px ${SANS}`; g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - P, H - 72);
  return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', .9));
}
async function rcShare(btn) {
  if (btn.disabled) return; btn.disabled = true;
  try { const b = await rcBlob(RC.d); await shareImage(b, `zzirit-${RC.d.year}-recap.jpg`, t('rc_story_text', { y: RC.d.year, n: RC.d.tot }), { tall: true, title: 'rc_share', sub: 'rc_story_sub' }); }
  catch (e) { console.warn(e); toast(t('share_fail'), 'warn'); }
  finally { btn.disabled = false; }
}
document.addEventListener('click', e => { if (e.target.closest('[data-rcopen]')) { e.preventDefault(); rcOpen(); } });
