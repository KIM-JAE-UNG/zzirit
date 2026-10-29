/* ===== UI primitives: toast, modal, copy ===== */
function toast(msg, kind = 'ok', ms = 3200) {
  const root = $('#toast-root'); if (!root) return;
  const el = document.createElement('div'); el.className = 'toast toast-' + kind; el.setAttribute('role', 'status');
  el.innerHTML = `${icon(kind === 'warn' ? 'warn' : kind === 'info' ? 'info' : 'check')}<span>${esc(msg)}</span>`;
  root.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}
let _modalStack = [];
function openModal(html, opts = {}) {
  const root = $('#modal-root');
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap' + (opts.wide ? ' wide' : '') + (opts.sheet ? ' sheet' : '');
  wrap.innerHTML = `<div class="modal-back" data-close></div><div class="modal" role="dialog" aria-modal="true" ${opts.label ? `aria-label="${esc(opts.label)}"` : ''}>${opts.noClose ? '' : `<button class="modal-x" data-close aria-label="${esc(t('close'))}">${icon('close')}</button>`}<div class="modal-body">${html}</div></div>`;
  root.appendChild(wrap);
  document.body.classList.add('has-modal');
  requestAnimationFrame(() => wrap.classList.add('in'));
  const close = () => closeModal(wrap);
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]') && !opts.noClose) close(); });
  const onKey = e => { if (e.key === 'Escape' && !opts.noClose && _modalStack[_modalStack.length - 1] === wrap) close(); };
  document.addEventListener('keydown', onKey);
  wrap._onKey = onKey; wrap._onClose = opts.onClose;
  _modalStack.push(wrap);
  setTimeout(() => { const f = wrap.querySelector('[autofocus], .modal input, .modal button:not(.modal-x)'); if (f && !opts.noFocus) f.focus({ preventScroll: true }); }, 60);
  return wrap;
}
function closeModal(wrap) {
  wrap = wrap || _modalStack[_modalStack.length - 1]; if (!wrap) return;
  _modalStack = _modalStack.filter(w => w !== wrap);
  document.removeEventListener('keydown', wrap._onKey);
  wrap.classList.remove('in');
  setTimeout(() => wrap.remove(), 220);
  if (!_modalStack.length) document.body.classList.remove('has-modal');
  if (wrap._onClose) wrap._onClose();
}
async function copyText(text, el) {
  try { await navigator.clipboard.writeText(text); toast(t('copied'), 'ok', 1800); return true; }
  catch (e) {
    const box = el && el.closest('[data-copybox]') ? el.closest('[data-copybox]').querySelector('.copy-src') : null;
    if (box) { const r = document.createRange(); r.selectNodeContents(box); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast(t('copy_manual'), 'info'); return false;
  }
}

/* ===== Image helpers ===== */
function loadImageFile(file) {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file); const im = new Image(); im.onload = () => res({ im, url }); im.onerror = () => rej(new Error('decode')); im.src = url; });
}
function canvasFrom(im, max) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c;
}
const toBlob = (c, q = .86) => new Promise(r => c.toBlob(b => r(b), 'image/jpeg', q));
function dhash(im) {
  const c = document.createElement('canvas'); c.width = 9; c.height = 8; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, 9, 8); const d = x.getImageData(0, 0, 9, 8).data; let hi = 0, lo = 0, k = 0;
  for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) {
    const p = (y * 9 + i) * 4, q = p + 4;
    const a = d[p] * .299 + d[p + 1] * .587 + d[p + 2] * .114, b = d[q] * .299 + d[q + 1] * .587 + d[q + 2] * .114;
    const bit = a > b ? 1 : 0; if (k < 32) hi = (hi << 1 | bit) >>> 0; else lo = (lo << 1 | bit) >>> 0; k++;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}
function hamming(a, b) {
  if (!a || !b || a.length !== 16 || b.length !== 16) return 64;
  const pc = x => { x = x - ((x >>> 1) & 0x55555555); x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
  return pc((parseInt(a.slice(0, 8), 16) ^ parseInt(b.slice(0, 8), 16)) >>> 0) + pc((parseInt(a.slice(8), 16) ^ parseInt(b.slice(8), 16)) >>> 0);
}
function hashBits(h) { if (!h || h.length !== 16) return 0; let n = 0; for (const ch of h) { let v = parseInt(ch, 16); while (v) { n += v & 1; v >>= 1; } } return n; }
function findDuplicate(hash) {
  // flat pictures (screenshots of plain colours, drawings) give nearly empty hashes; only an exact match counts for those
  const weak = hashBits(hash) < 10 || hashBits(hash) > 54;
  for (const [uid, a] of allAnglers()) for (const c of (a.catches || [])) {
    if (!c.h || c.st === 'no') continue;
    if (weak || hashBits(c.h) < 10 || hashBits(c.h) > 54 ? c.h === hash : hamming(c.h, hash) <= 5) return { uid, c };
  }
  return null;
}
async function readExif(file) {
  try {
    if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
    const buf = await file.slice(0, 512 * 1024).arrayBuffer(); const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 10 < v.byteLength) {
      const mk = v.getUint16(off), len = v.getUint16(off + 2);
      if (mk === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
      if ((mk & 0xFF00) !== 0xFF00 || mk === 0xFFDA) break;
      off += 2 + len;
    }
  } catch (e) { console.warn('exif', e); }
  return null;
}
function parseTiff(v, st) {
  const le = v.getUint16(st) === 0x4949, u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const out = {};
  const str = (o, n) => { let s = ''; for (let i = 0; i < n && o + i < v.byteLength; i++) { const c = v.getUint8(o + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
  const rat = o => { const a = u32(o), b = u32(o + 4); return b ? a / b : 0; };
  const ifd = (o, fn) => { if (st + o + 2 > v.byteLength) return; const n = u16(st + o); for (let i = 0; i < n; i++) { const e = st + o + 2 + i * 12; if (e + 12 > v.byteLength) break; const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4); const size = (sizes[type] || 1) * cnt; const p = size > 4 ? st + u32(e + 8) : e + 8; fn(tag, type, cnt, p, e + 8); } };
  let ex = 0, gp = 0;
  ifd(u32(st + 4), (tag, type, cnt, p, vo) => { if (tag === 0x010F) out.make = str(p, cnt); else if (tag === 0x0110) out.model = str(p, cnt); else if (tag === 0x0131) out.software = str(p, cnt); else if (tag === 0x0132) out.dt = str(p, cnt); else if (tag === 0x8769) ex = u32(vo); else if (tag === 0x8825) gp = u32(vo); });
  if (ex) ifd(ex, (tag, type, cnt, p, vo) => { if (tag === 0x9003) out.dto = str(p, cnt); else if (tag === 0xA002) out.w = type === 3 ? u16(vo) : u32(vo); else if (tag === 0xA003) out.h = type === 3 ? u16(vo) : u32(vo); });
  if (gp) { let a, b, lat, lon; ifd(gp, (tag, type, cnt, p, vo) => { if (tag === 1) a = str(vo, 2); else if (tag === 3) b = str(vo, 2); else if (tag === 2) lat = rat(p) + rat(p + 8) / 60 + rat(p + 16) / 3600; else if (tag === 4) lon = rat(p) + rat(p + 8) / 60 + rat(p + 16) / 3600; }); if (lat && lon) { out.lat = a === 'S' ? -lat : lat; out.lon = b === 'W' ? -lon : lon; } }
  const ds = out.dto || out.dt;
  if (ds && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}/.test(ds)) { const [d, tm] = ds.split(' '); const [Y, M, D] = d.split(':').map(Number); const [h, mi, se] = tm.split(':').map(Number); const ms = new Date(Y, M - 1, D, h, mi, se || 0).getTime(); if (!isNaN(ms) && Y > 1990) out.ts = ms; }
  return out;
}
function fileNameInfo(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  let kind = 'other', date = null;
  if (/^(screenshot|screen ?shot|스크린샷|スクリーンショット|截屏|屏幕截图|capture)/i.test(base)) kind = 'screenshot';
  else if (/^kakaotalk_/i.test(base)) kind = 'messenger';
  else if (/^(IMG|PXL|DSC|DSCN|DSCF|SAM|MVIMG|GOPR|GX|DJI|P)[_-]?\d{3,}/i.test(base) || /^\d{8}[_-]\d{6}/.test(base)) kind = 'camera';
  else if (/^[a-f0-9]{16,}$/i.test(base) || /^(image|images|download|photo|unnamed|pexels|unsplash|shutterstock|istock|adobestock|depositphotos|gettyimages)/i.test(base)) kind = 'web';
  const m = base.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/);
  if (m) date = new Date(+m[1], +m[2] - 1, +m[3], 12).getTime();
  return { kind, date };
}
function trustScore({ exif, fname, dup, ai, len, sp, ts, past, skipAi }) {
  const items = []; let s = 50;
  const add = (k, ok, pts) => { items.push({ k, ok, pts }); s += pts; };
  if (exif && exif.ts) add('exif_date', true, 15); else add('exif_date', false, past ? -10 : -5);
  if (exif && (exif.make || exif.model)) add('exif_cam', true, 10); else add('exif_cam', false, 0);
  if (exif && exif.lat != null) add('exif_gps', true, 5);
  if (fname.kind === 'camera') add('fname_cam', true, 5);
  else if (fname.kind === 'screenshot') add('fname_shot', false, -40);
  else if (fname.kind === 'web') add('fname_web', false, -12);
  else if (fname.kind === 'messenger') add('fname_msg', null, 0);
  if (fname.date && exif && exif.ts) { const ok = Math.abs(fname.date - exif.ts) < 2 * 86400000; add('fname_match', ok, ok ? 5 : -10); }
  if (exif && exif.software && /photoshop|lightroom|snapseed|picsart|meitu|facetune|gimp|canva|remini|generat/i.test(exif.software)) add('edited_sw', false, -10);
  if (dup) add('dup', false, -70); else add('nodup', true, 5);
  if (ai) {
    const sc = ai.screening || {};
    if (ai.fish_visible === false) add('ai_nofish', false, -50);
    if ((sc.real_photo ?? 1) >= .6) add('ai_real', true, 10); else add('ai_real', false, -30);
    if ((sc.screenshot || 0) > .5) add('ai_shot', false, -30);
    if ((sc.ai_generated || 0) > .5) add('ai_gen', false, -45);
    if ((sc.stock_or_web || 0) > .5) add('ai_stock', false, -35);
    if ((sc.market_or_aquarium || 0) > .6) add('ai_market', false, -25);
    if ((sc.edited || 0) > .6) add('ai_edit', false, -10);
    if (ai.verdict === 'reject') add('ai_reject', false, -20); else if (ai.verdict === 'pass') add('ai_pass', true, 5);
  } else if (!skipAi) add('ai_none', false, past ? -100 : -10);
  if (sp && len) {
    if (len > sp.X * 1.05) add('len_record', false, -25);
    else if (ai && ai.length_cm && (len / ai.length_cm > 1.7 || ai.length_cm / len > 1.7)) add('len_mismatch', false, -10);
    else add('len_ok', true, 0);
  }
  if (ts && ts > nowMs() + 3600000) add('date_future', false, -50);
  if (past && exif && exif.ts && ts && Math.abs(exif.ts - ts) > 3 * 86400000) add('date_mismatch', false, -15);
  return { score: clamp(Math.round(s), 0, 100), items };
}

/* ===== AI: identification + photo screening (one call) ===== */
function catalogText() { return SP.map(s => `${s.id}: ${s.n[1]} / ${s.sci}`).join('\n'); }
const LANG_NAME = ['Korean', 'English', 'Japanese', 'Simplified Chinese'];
async function aiIdentify(blob, ctx, signal) {
  if (!S.sample || !S.sampleImages) throw { code: 'images_unavailable' };
  const { confusions } = learnStats();
  const conf = confusions.slice(0, 8).map(c => `${c.p}→${c.a} ×${c.n}`).join(', ');
  const prompt = `You are the species-identification and photo-screening model of a fishing competition app.
Look at the attached photo of a catch and reply with JSON only.

Species catalog (id: English name / scientific name):
${catalogText()}

Context (weak hints only, trust what you see): region=${ctx.region || 'unknown'}, month=${ctx.month + 1}.
${conf ? `Community corrections so far (model said → actually was): ${conf}. Look carefully at the features that separate these pairs.` : ''}

Rules:
- candidates: up to 3 catalog ids with probabilities p (0-1) summing to at most 1. If the animal is not in the catalog, use id "other" and fill other_en and other_sci.
- fish_visible: false if no fish or cephalopod is clearly visible.
- length_cm: estimated total length from visible references (hands, ruler, measuring board, cooler, lure), or null.
- screening (0-1 each): real_photo (unedited camera photo), screenshot (app UI, status bar), ai_generated, stock_or_web (watermark, stock or studio look, collage), market_or_aquarium (fish market tray, ice, aquarium glass), edited (heavy filters, composite).
- verdict: "pass", "review" or "reject" for use as ${ctx.past ? 'a PAST catch photo registered later' : "today's catch"} in a ranking competition.
- reasons: up to 3 short strings in ${LANG_NAME[S.li]}.
- features: one short sentence in ${LANG_NAME[S.li]} naming the key visual features you used.

JSON shape:
{"fish_visible":true,"candidates":[{"id":"kurodai","p":0.82},{"id":"mejina","p":0.1}],"other_en":"","other_sci":"","length_cm":42,"screening":{"real_photo":0.9,"screenshot":0,"ai_generated":0.02,"stock_or_web":0.03,"market_or_aquarium":0.05,"edited":0.05},"verdict":"pass","reasons":["..."],"features":"..."}`;
  const res = await S.sample.json(prompt, { images: [blob], modelTier: 'default', signal });
  if (!res || typeof res !== 'object') throw { code: 'invalid_json' };
  res.candidates = (Array.isArray(res.candidates) ? res.candidates : []).filter(c => c && (SPI[c.id] || c.id === 'other')).map(c => ({ id: c.id, p: clamp(Number(c.p) || 0, 0, 1) })).slice(0, 3);
  return res;
}
/* Bayesian fusion: AI likelihood x community calibration x regional/seasonal prior */
function fuse(ai, prior) {
  const cands = ai.candidates.filter(c => c.id !== 'other');
  const cal = calibrate(cands.length ? cands : []);
  const scores = new Map();
  for (const [id, p] of cal) { const pr = prior ? (prior.get(id) || 0) : 0; scores.set(id, p * Math.pow(pr + .01, .3)); }
  let tot = 0; for (const v of scores.values()) tot += v;
  const aiMass = cands.reduce((a, c) => a + c.p, 0) || 1;
  const list = [...scores].map(([id, v]) => ({ id, p: tot ? v / tot * Math.min(1, aiMass) : 0 })).sort((a, b) => b.p - a.p);
  const other = ai.candidates.find(c => c.id === 'other');
  return { list, other: other ? { p: other.p, en: ai.other_en, sci: ai.other_sci } : null };
}
function aiErrorText(e) {
  const c = e && e.code;
  if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled') return t('ai_err_granted');
  if (c === 'images_unavailable') return t('ai_err_images');
  if (c === 'rate_limited') return t('ai_err_rate');
  if (c === 'image_rejected') return t('ai_err_image');
  if (c === 'cancelled') return t('ai_err_cancel');
  if (c === 'refused') return t('ai_err_refused');
  if (c === 'ai_not_configured') return t('ai_need_claude');
  return t('ai_err_generic');
}

/* ===== Web build: the operator proves ownership once per browser with an admin code (#claim) ===== */
function openClaim() {
  if (window.APP_RT !== 'web' || !window.APP_AUTH) return;
  const w = openModal(`<div class="claim">
    <h2>${icon('shield')} ${t('claim_title')}</h2><p class="muted">${t('claim_sub')}</p>
    <div class="field"><label for="cl-code" class="sr">${t('claim_ph')}</label><input id="cl-code" placeholder="${esc(t('claim_ph'))}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40"></div>
    <p class="err" id="cl-err" hidden></p>
    <div class="actions"><button class="btn btn-primary" id="cl-go">${t('claim_go')}</button></div></div>`, { label: t('claim_title') });
  const go = $('#cl-go', w), inp = $('#cl-code', w), err = $('#cl-err', w);
  const run = async () => {
    err.hidden = true;
    const code = inp.value.replace(/\s+/g, '').toUpperCase(); if (!code) return;
    const s = await window.APP_AUTH.session();
    if (!s) { err.textContent = t('claim_need_login'); err.hidden = false; return; }
    go.disabled = true;
    const { data, error } = await window.APP_AUTH.sb.rpc('claim_admin', { code });
    go.disabled = false;
    if (error || data !== true) { err.textContent = t('claim_bad'); err.hidden = false; return; }
    toast(t('claim_ok')); closeModal(w);
    setTimeout(() => { location.hash = 'admin'; location.reload(); }, 700);
  };
  go.onclick = run;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
}

/* ===== Onboarding / profile ===== */
function defaultHome() { return { ko: 'KS', ja: 'JP', zh: 'CN', en: 'NA' }[S.lang] || 'KS'; }
function defaultCC() { const l = (navigator.language || '').split('-')[1]; if (l && COUNTRIES.includes(l.toUpperCase())) return l.toUpperCase(); return { ko: 'KR', ja: 'JP', zh: 'CN', en: 'US' }[S.lang] || 'KR'; }
function ensureProfile(then) {
  if (S.me && S.me.nick) { then && then(); return; }
  openOnboarding(then);
}
function profileFormHTML(p, afterNick = '') {
  const opts = COUNTRIES.map(c => `<option value="${c}" ${p.cc === c ? 'selected' : ''}>${flag(c)} ${esc(ccName(c))}</option>`).join('');
  const homes = HOMES.map(h => `<option value="${h}" ${p.home === h ? 'selected' : ''}>${esc(regionName(h))}</option>`).join('');
  const styles = Object.keys(METHOD).map(m => `<option value="${m}" ${p.style === m ? 'selected' : ''}>${esc(dict(METHOD[m]))}</option>`).join('');
  return `
  <div class="field"><label for="pf-nick">${t('pf_nick')}</label><input id="pf-nick" maxlength="16" value="${esc(p.nick || '')}" placeholder="${t('pf_nick_ph')}" autocomplete="nickname"></div>
  ${afterNick}
  <div class="row2">
    <div class="field"><label for="pf-cc">${t('pf_country')}</label><select id="pf-cc">${opts}</select></div>
    <div class="field"><label for="pf-home">${t('pf_home')}</label><select id="pf-home">${homes}</select></div>
  </div>
  <div class="row2">
    <div class="field"><label for="pf-style">${t('pf_style')}</label><select id="pf-style">${styles}</select></div>
    <div class="field"><label for="pf-lang">${t('pf_lang')}</label><select id="pf-lang">${['ko', 'en', 'ja', 'zh'].map((l, i) => `<option value="${l}" ${S.lang === l ? 'selected' : ''}>${['한국어', 'English', '日本語', '中文'][i]}</option>`).join('')}</select></div>
  </div>
  <p class="hint">${icon('globe')} ${t('pf_rank_hint')}</p>`;
}
/* names that would look like the operator or the app itself */
const NICK_RESERVED = /(운영자|관리자|운영진|공식|admin|official|staff|매니저|運営|管理者|管理员|官方)|^(찌릿|zzirit|gm)$/i;
function nickProblem(nick) { if (S.isOwner) return null; return NICK_RESERVED.test(nick.replace(/[\s._-]/g, '')) ? 'pf_nick_reserved' : null; }
function readProfileForm(root) {
  const nick = $('#pf-nick', root).value.trim().replace(/\s+/g, ' ').slice(0, 16);
  return { nick: nick || ('Angler' + Math.floor(1000 + Math.random() * 9000)), cc: $('#pf-cc', root).value, home: $('#pf-home', root).value, style: $('#pf-style', root).value, lang: $('#pf-lang', root).value, bad: nick ? nickProblem(nick) : null };
}
function nickRefused(f, root) {
  if (!f.bad) return false;
  toast(t(f.bad), 'warn', 4800); const n = $('#pf-nick', root); if (n) n.focus();
  return true;
}
const NEW_ME = () => ({ v: 1, joined: nowMs(), catches: [], decor: { theme: 'th_dawn', items: ['dc_weed', 'dc_rock', 'dc_buoy'], fx: [] }, flair: {} });
async function saveProfileFrom(w, f) {
  S.me = Object.assign(NEW_ME(), S.me || {}, f);
  if (f.lang !== S.lang) setLang(f.lang);
  await store.saveMe();
}
function onbArt(w) { const cv = $('#onb-cv', w); if (cv) { const ctx = cv.getContext('2d'); ['kurodai', 'madai', 'aoriika', 'buri'].forEach((id, i) => FD.draw(ctx, SPI[id], 80 + i * 135, 78 + (i % 2) * 10, i === 2 ? 110 : 120, { still: true, flip: i % 2 === 1 })); } }
function openOnboarding(then) {
  // website: sign-up and login in one dialog (once we know the server can do login IDs)
  if (idSupported()) {
    if (S.loginId === undefined) { myLoginId().then(() => openOnboarding(then)); return; }
    if (!S.idOff) { openAuth('join', then); return; }
  }
  const p = { nick: '', cc: defaultCC(), home: defaultHome(), style: 'float' };
  const w = openModal(`
    <div class="onb">
      <div class="onb-art" aria-hidden="true"><canvas width="560" height="150" id="onb-cv"></canvas></div>
      <h2>${t('onb_title')}</h2>
      <p class="lede">${t('onb_sub')}</p>
      ${profileFormHTML(p)}
      ${S.mode !== 'shared' ? `<p class="note">${icon('info')} ${t(S.mode === 'local' ? 'mode_local_note' : 'mode_offline_note')}</p>` : ''}
      <div class="actions"><button class="btn btn-primary btn-lg" id="onb-go">${t('onb_go')}</button></div>
    </div>`, { label: t('onb_title') });
  onbArt(w);
  $('#onb-go', w).onclick = async () => {
    const f = readProfileForm(w);
    if (nickRefused(f, w)) return; delete f.bad;
    await saveProfileFrom(w, f);
    closeModal(w); toast(t('onb_done', { nick: S.me.nick }));
    rerender(); then && then();
  };
}

/* ===== Sign up / log in (website). Signing up keeps everything this device already recorded;
   logging in joins this device to the ID's account, and this device's records come along. ===== */
function openAuth(tab = 'join', then) {
  if (!idSupported() || S.idOff) { openOnboarding(then); return; }
  const hasProfile = !!(S.me && S.me.nick), hasId = !!S.loginId;
  const p = Object.assign({ nick: '', cc: defaultCC(), home: defaultHome(), style: 'float' }, S.me || {});
  const local = myCatches().length;
  const idFields = hasId ? `<p class="note ok">${icon('check')} ${t('id_signed_in', { name: `<b class="mono">${esc(S.loginId)}</b>` })}</p>` : `
    <div class="field"><label for="au-id">${t('id_name')}</label><input id="au-id" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="zzirit_fisher"><small class="muted">${t('id_name_hint')}</small></div>
    <div class="row2">
      <div class="field"><label for="au-pw">${t('id_pass')}</label><input id="au-pw" type="password" autocomplete="new-password" maxlength="72"><small class="muted">${t('id_pass_hint')}</small></div>
      <div class="field"><label for="au-pw2">${t('id_pass2')}</label><input id="au-pw2" type="password" autocomplete="new-password" maxlength="72"></div>
    </div>`;
  const w = openModal(`
    <div class="auth">
      <div class="onb-art" aria-hidden="true"><canvas width="560" height="150" id="onb-cv"></canvas></div>
      <div class="seg auth-tabs" role="tablist">
        <button role="tab" data-atab="join" aria-pressed="${tab === 'join'}">${t(hasProfile ? 'auth_tab_id' : 'auth_tab_join')}</button>
        <button role="tab" data-atab="login" aria-pressed="${tab === 'login'}">${t('auth_tab_login')}</button>
      </div>
      <form class="auth-pane" id="au-join" data-pane="join" ${tab === 'join' ? '' : 'hidden'} novalidate>
        <h2>${t(hasProfile ? 'auth_join_title_me' : 'auth_join_title')}</h2>
        <p class="lede">${t(hasProfile ? 'auth_join_sub_me' : 'auth_join_sub')}</p>
        ${hasProfile ? `<div class="field"><label>${t('pf_nick')}</label><p class="auth-me">${avatar(S.me, 30)} <b>${esc(S.me.nick)}</b> <span class="muted small">${t('acct_sum', { n: fmtN(local), pts: fmtN(myPoints()), lv: myLevel() })}</span></p></div>${idFields}`
          : profileFormHTML(p, idFields)}
        ${S.mode !== 'shared' ? `<p class="note">${icon('info')} ${t(S.mode === 'local' ? 'mode_local_note' : 'mode_offline_note')}</p>` : ''}
        <p class="err" id="au-err" hidden></p>
        <div class="actions"><button class="btn btn-primary btn-lg" type="submit" id="onb-go">${t(hasId ? 'onb_go' : hasProfile ? 'id_create_go' : 'auth_join_go')}</button></div>
        ${hasProfile || hasId ? '' : `<button class="link small auth-noid" type="button" id="onb-noid">${t('auth_no_id')}</button>`}
        <p class="hint">${icon('shield')} ${t('auth_pw_note')}</p>
      </form>
      <form class="auth-pane" id="au-login" data-pane="login" ${tab === 'login' ? '' : 'hidden'} novalidate>
        <h2>${t('id_login')}</h2>
        <p class="lede">${t('auth_login_sub')}</p>
        <div class="field"><label for="idl-name">${t('id_name')}</label><input id="idl-name" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20"></div>
        <div class="field"><label for="idl-pass">${t('id_pass')}</label><input id="idl-pass" type="password" autocomplete="current-password" maxlength="72"></div>
        ${local ? `<p class="note">${icon('info')} ${t('link_merge_note', { n: local })}</p>` : ''}
        <p class="err" id="idl-err" hidden></p>
        <div class="actions"><button class="btn btn-primary btn-lg" type="submit" id="idl-go">${t('id_login_go')}</button></div>
        <p class="hint">${t('id_forgot')}</p>
      </form>
    </div>`, { label: t('auth_tab_join') });
  onbArt(w);
  const show = k => { $$('[data-atab]', w).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.atab === k))); $$('[data-pane]', w).forEach(f => { f.hidden = f.dataset.pane !== k; }); const first = $(`[data-pane="${k}"] input`, w); if (first) setTimeout(() => first.focus(), 40); };
  w.addEventListener('click', e => { const b = e.target.closest('[data-atab]'); if (b) show(b.dataset.atab); });
  const fail = (box, code) => { box.textContent = idErr(code); box.hidden = false; };
  // sign up (or add an ID to the profile this device already has)
  const jf = $('#au-join', w), jerr = $('#au-err', w), jgo = $('#onb-go', w);
  jf.addEventListener('submit', async e => {
    e.preventDefault(); jerr.hidden = true;
    let f = null;
    if (!hasProfile) { f = readProfileForm(w); if (nickRefused(f, w)) return; delete f.bad; }
    jgo.disabled = true;
    try {
      if (!hasId) {
        const name = $('#au-id', w).value.trim().toLowerCase(), p1 = $('#au-pw', w).value, p2 = $('#au-pw2', w).value;
        if (!/^[a-z0-9_]{3,20}$/.test(name)) throw { code: 'bad_name' };
        if (p1.length < 6) throw { code: 'bad_pass' };
        if (p1 !== p2) throw { code: 'mismatch' };
        const r = await window.APP_AUTH.ids.register(name, p1);
        if (!r || r.ok !== true) throw { code: (r && r.err) || 'fail' };
        S.loginId = r.name;
      }
      if (f) await saveProfileFrom(w, f);
      closeModal(w);
      toast(t(hasProfile ? 'id_created' : 'auth_joined', { name: S.loginId, nick: (S.me && S.me.nick) || '' }), 'ok', 6000);
      rerender(); then && then();
    } catch (x) { jgo.disabled = false; fail(jerr, x && x.code); }
  });
  const noid = $('#onb-noid', w);
  if (noid) noid.onclick = async () => {
    const f = readProfileForm(w); if (nickRefused(f, w)) return; delete f.bad;
    await saveProfileFrom(w, f);
    closeModal(w); toast(t('onb_done', { nick: S.me.nick }));
    rerender(); then && then();
  };
  // log in with an ID made on another device
  const lf = $('#au-login', w), lerr = $('#idl-err', w), lgo = $('#idl-go', w);
  lf.addEventListener('submit', async e => {
    e.preventDefault(); lerr.hidden = true;
    const name = $('#idl-name', w).value.trim().toLowerCase(), pw = $('#idl-pass', w).value;
    if (!name || !pw) { fail(lerr, 'wrong'); return; }
    lgo.disabled = true;
    try {
      const r = await window.APP_AUTH.ids.login(name, pw);
      if (!r || r.ok !== true) throw { code: (r && r.err) || 'fail' };
      for (const k of ['me', 'meOf', 'labels', 'orders', 'suggest', 'photos']) lsSet(k, null);
      try { localStorage.removeItem('eosin.spots'); } catch (x) { }
      const back = scanStash(); // a catch that was waiting for this login carries on after the reload
      closeModal(w); toast(t('id_login_ok', { name: r.name || name }), 'ok');
      setTimeout(() => { location.hash = back ? (S.scan.mode === 'past' ? 'past' : 'scan') : 'sea'; location.reload(); }, 800);
    } catch (x) { lgo.disabled = false; fail(lerr, x && x.code); }
  });
  setTimeout(() => { const first = $(`[data-pane="${tab}"] input`, w); if (first) first.focus(); }, 80);
  return w;
}
/* Logging in switches accounts, so the page reloads. A catch someone was registering when the login came up is kept
   for this tab (photo, what the AI said and its proof, the chosen fish) and picked up again after the reload, so the
   photo does not go through the AI twice. Kept at most 30 minutes, only in this tab. */
const SCAN_KEEP = 'eosin.pendingScan';
function scanStash() {
  const sc = S.scan;
  if (!sc || !sc.im || !(sc.phase === 'result' || sc.phase === 'form') || !(sc.chosen || (sc.fused && sc.fused.list && sc.fused.list.length))) return false;
  try {
    const keep = {
      v: 1, at: nowMs(), big: canvasFrom(sc.im, 1280).toDataURL('image/jpeg', .86), thumb: sc.thumb, ai: sc.ai, tk: (sc.ai && sc.ai.__ticket) || null,
      fused: sc.fused, chosen: sc.chosen, corrected: !!sc.corrected, exif: sc.exif || null, fname: sc.fname || {}, dup: !!sc.dup, hash: sc.hash,
      month: sc.month, rg: sc.rg, lon: sc.lon, lat: sc.lat, picked: !!sc.picked, mode: sc.mode, noAI: !!sc.noAI
    };
    sessionStorage.setItem(SCAN_KEEP, JSON.stringify(keep));
    return true;
  } catch (e) { try { sessionStorage.removeItem(SCAN_KEEP); } catch (x) { } return false; }
}
function scanRestore() {
  let k = null;
  try { k = JSON.parse(sessionStorage.getItem(SCAN_KEEP) || 'null'); sessionStorage.removeItem(SCAN_KEEP); } catch (e) { return null; }
  if (!k || k.v !== 1 || !k.big || !(nowMs() - k.at < 30 * 60000)) return null;
  const im = new Image(); im.src = k.big;
  if (k.ai && k.tk) Object.defineProperty(k.ai, '__ticket', { value: k.tk, enumerable: false });
  const sc = Object.assign({}, k, { url: k.big, im, file: null, steps: [], phase: 'result', dup: k.dup ? { again: true } : null });
  delete sc.big; delete sc.tk; delete sc.v; delete sc.at;
  // once the account's profile has arrived: straight on to the form (or the "is it this fish?" question)
  let n = 0;
  const go = () => {
    if (S.scan !== sc || sc.phase !== 'result') return;
    if (!(S.anglersLoaded && S.ready) && n++ < 60) { setTimeout(go, 250); return; }
    toast(t('scan_resumed'), 'info', 4200);
    if (sc.chosen) ensureProfile(() => { sc.phase = 'form'; renderScanWork(); }); else openConfirm();
  };
  setTimeout(go, 400);
  return sc;
}
/* First visit on the website: show sign-up / login once (people can still close it and look around) */
function maybeWelcome(tries = 0) {
  if (window.APP_RT !== 'web' || lsGet('welcomed', 0) || tries > 6) return;
  if (!S.ready || $('.modal-wrap.in') || S.route === 'admin' || /^#(claim|link=)/.test(location.hash)) { setTimeout(() => maybeWelcome(tries + 1), 3000); return; }
  if (S.me && S.me.nick) { lsSet('welcomed', 1); return; }
  myLoginId().then(() => {
    if ((S.me && S.me.nick) || lsGet('welcomed', 0)) { lsSet('welcomed', 1); return; }
    if ($('.modal-wrap.in')) { setTimeout(() => maybeWelcome(tries + 1), 3000); return; }
    lsSet('welcomed', 1);
    // after logging out, and on the first open of an installed app (iPhone keeps it apart from Safari), people are coming back
    const tab = lsGet('authTab', standalone() ? 'login' : 'join') === 'login' ? 'login' : 'join'; lsSet('authTab', null);
    if (idSupported() && !S.idOff) openAuth(tab); else openOnboarding();
  });
}
function myPoints() { return myCatches().filter(c => eligible(c, myId())).reduce((a, c) => a + (c.sc || 0), 0); }

/* ===== Payments: KakaoPay transfer-code link (no bank account shown anywhere) ===== */
function payLinks(amt) {
  const cfg = S.admin.config || {};
  const kurl = cfg.kakaoUrl || DEV.kakaoPayUrl || '';
  let kakao = null;
  if (/^https:\/\/qr\.kakaopay\.com\//.test(kurl)) kakao = cfg.kakaoAmt ? kurl.replace(/\/$/, '') + (amt * 524288).toString(16) : kurl;
  const toss = cfg.tossId ? `https://toss.me/${encodeURIComponent(cfg.tossId)}/${amt}` : null;
  return { kakao, toss };
}
let _qrLib = null;
function loadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!_qrLib) _qrLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = () => res(window.qrcode); s.onerror = () => { _qrLib = null; rej(new Error('qr')); };
    document.head.appendChild(s);
  });
  return _qrLib;
}
async function drawQr(box, text) {
  try {
    const qrcode = await loadQrLib();
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    if (box.isConnected) box.innerHTML = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
  } catch (e) { box.hidden = true; }
}
function openPay({ kind, ref, amt, title, desc, onDone }) {
  const code = 'ZZ-' + rid(4).toUpperCase();
  const L = payLinks(amt);
  const ready = !!(L.kakao || L.toss);
  const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const w = openModal(`
    <div class="pay">
      <p class="eyebrow">${t(kind === 'donate' ? 'pay_eyebrow_donate' : 'pay_eyebrow_item')}</p>
      <h2>${esc(title)}</h2>
      ${desc ? `<p class="lede">${desc}</p>` : ''}
      <div class="pay-amt"><span class="num">${fmtN(amt)}</span><span>${t('won')}</span></div>
      ${ready ? `
      <ol class="pay-steps">
        <li><p class="ps-h"><span class="ps-n">1</span>${t(desktop ? 'pay_step1_pc' : L.toss && L.kakao ? 'pay_step1_both' : L.toss ? 'pay_toss' : 'pay_step1')}</p>
          <div class="pay-methods">
            ${L.toss ? `<a class="btn btn-toss btn-lg" href="${esc(L.toss)}" target="_blank" rel="noopener" data-pm="toss">${t('pay_toss')}</a>` : ''}
            ${L.kakao ? `<a class="btn btn-kpay btn-lg" href="${esc(L.kakao)}" target="_blank" rel="noopener" data-pm="kakao">${t('pay_kakao')}</a>` : ''}
          </div>
          ${desktop ? `<div class="pay-qr"><div class="pay-qr-img" id="pay-qr"></div><p class="hint">${t(L.toss ? 'pay_qr_hint_toss' : 'pay_qr_hint')}</p></div>` : ''}
          <div class="pay-code" data-copybox>
            <div><span class="lbl">${t('pay_memo')}</span><span class="copy-src mono big">${code}</span></div>
            <button class="btn btn-line btn-sm" data-copy="${code}">${icon('copy')} ${t('copy')}</button>
          </div>
          <p class="hint">${t('pay_hint')}</p></li>
        <li><p class="ps-h"><span class="ps-n">2</span>${t('pay_step2')}</p>
          <button class="btn btn-primary btn-lg btn-block" id="pay-done" disabled>${t('pay_done')}</button>
          <p class="hint" id="pay-wait">${t('pay_wait')}</p></li>
      </ol>
      <p class="fine">${t('pay_fine2')}</p>` : `
      <p class="note">${icon('info')} ${t('pay_none')}</p>
      <div class="actions"><a class="btn btn-kakao btn-lg btn-block" href="${DEV.kakaoUrl}" target="_blank" rel="noopener">${icon('chat')}${t('kakao_ask')}</a></div>`}
    </div>`, { label: title });
  // Toss first: money sent to a Toss ID arrives without the operator having to accept it (KakaoPay needs "받기")
  const qbox = $('#pay-qr', w); if (qbox) drawQr(qbox, L.toss || L.kakao);
  if (!ready) return;
  let method = L.toss ? 'toss' : 'kakao';
  const done = $('#pay-done', w);
  // "I sent it" only wakes up after the payment page was opened (phone) or the QR has been on screen a while (computer)
  const arm = () => { if (!done.isConnected) return; done.disabled = false; const pw = $('#pay-wait', w); if (pw) pw.hidden = true; };
  $$('[data-pm]', w).forEach(a => a.addEventListener('click', () => { method = a.dataset.pm; setTimeout(arm, 1200); }));
  if (desktop) setTimeout(arm, 9000);
  done.onclick = async () => {
    if (done.disabled) return;
    done.disabled = true;
    // records the order with its memo code; nothing is applied until the operator finds the money and confirms it
    const o = { id: rid(10), kind, ref: ref || null, amt, code, m: method, ts: nowMs(), nick: S.me?.nick || '', qty: 1 };
    await store.addOrder(o);
    closeModal(w);
    toast(t('pay_sent', { code }), 'ok', 7000);
    onDone && onDone(o);
    rerender();
  };
}
/* At most a few orders may wait for confirmation at once (the server enforces the same), and one per item */
const PAY_PENDING_MAX = 3;
function payBlocked(kind, ref) {
  const same = kind === 'item' ? pendingOrders('item', ref)[0] : null;
  if (same) { toast(t('pay_dup', { code: same.code }), 'info', 7000); return true; }
  if (pendingOrders().length >= PAY_PENDING_MAX) { toast(t('pay_many'), 'info', 7000); return true; }
  return false;
}
function openDonate() {
  if (S.mode === 'shared' && payBlocked('donate')) return;
  openPay({ kind: 'donate', amt: DONATE_AMT, title: t('donate_title'), desc: t('donate_desc') });
}
function buyItem(id) {
  const it = SHOPI[id]; if (!it || !it.pr) return;
  if (owned(id)) { applyItem(id); toast(t('applied')); rerender(); return; }
  if (S.mode === 'shared' && payBlocked('item', id)) return;
  ensureProfile(() => openPay({ kind: 'item', ref: id, amt: PREMIUM_PRICE, title: dict(it.n), desc: t('prem_desc_' + id) }));
}
/* When the operator confirms one of my orders: put the item on once and say thanks (each order only once per device) */
function payNotify() {
  if (S.mode !== 'shared' || !S.me || !S.me.nick || !S.ordersLoaded || !S.adminLoaded) return;
  let seen; try { seen = new Set(lsGet('payok', [])); } catch (e) { seen = new Set(); }
  const g = grantsOf(myId()); let changed = false, applied = false;
  for (const o of S.myOrders) {
    if (g[o.id] !== 'ok' || seen.has(o.id)) continue;
    seen.add(o.id); changed = true;
    if (!o.ts || nowMs() - o.ts > 30 * 864e5) continue;
    const it = o.kind === 'item' && SHOPI[o.ref];
    if (it && it.pr) { applyItem(o.ref); applied = true; toast(t('pay_ok_item', { name: dict(it.n) }), 'ok', 7000); }
    else if (o.kind === 'donate') toast(t('pay_ok_donate'), 'ok', 7000);
  }
  if (changed) lsSet('payok', [...seen].slice(-300));
  if (applied) rerenderSoon();
}
function setFlair(id, on) {
  S.me.flair = S.me.flair || {};
  if (id === 'fl_gold') S.me.flair.gold = on; else if (id === 'fl_wave') S.me.flair.frame = on;
}
function applyItem(id) {
  if (!S.me) return; const it = SHOPI[id]; if (!it) return;
  const d = S.me.decor || (S.me.decor = DEFAULT_DECOR());
  d.items = d.items || []; d.fx = d.fx || [];
  for (const x of (it.inc || [id])) {
    const i = SHOPI[x]; if (!i || !owned(x)) continue;
    if (i.k === 'theme') d.theme = x;
    else if (i.k === 'decor') { if (x === 'dc_boat' || x === 'dc_goldboat') d.items = d.items.filter(y => y !== 'dc_boat' && y !== 'dc_goldboat'); if (!d.items.includes(x)) d.items.push(x); }
    else if (i.k === 'fx') { if (!d.fx.includes(x)) d.fx.push(x); }
    else if (i.k === 'flair') setFlair(x, true);
  }
  if (id === 'pr_gold' && S.me.char) S.me.char.rd = 'gold';
  store.saveMe();
}
function toggleItem(id) {
  if (!S.me) return; const it = SHOPI[id]; if (!it) return;
  if (!owned(id)) { toast(it.pr || it.in ? t('prem_need') : it.top ? t('earned_top10') : t('lock_lv', { n: it.lv }), 'info'); return; }
  const d = S.me.decor || (S.me.decor = DEFAULT_DECOR()); d.items = d.items || []; d.fx = d.fx || [];
  if (it.k === 'decor') { const i = d.items.indexOf(id); if (i >= 0) d.items.splice(i, 1); else { if (id === 'dc_boat' || id === 'dc_goldboat') d.items = d.items.filter(y => y !== 'dc_boat' && y !== 'dc_goldboat'); d.items.push(id); } }
  else if (it.k === 'fx') { const i = d.fx.indexOf(id); if (i >= 0) d.fx.splice(i, 1); else d.fx.push(id); }
  else if (it.k === 'theme') d.theme = id;
  else if (it.k === 'flair') { const on = id === 'fl_gold' ? !(S.me.flair && S.me.flair.gold) : !(S.me.flair && S.me.flair.frame); setFlair(id, on); if (on) setFlair(id === 'fl_gold' ? 'fl_wave' : 'fl_gold', false); }
  else if (it.k === 'set') { applyItem(id); rerender(); return; }
  store.saveMe(); rerender();
}
/* Drop looks that are no longer owned (an unconfirmed or cancelled order, a level that went down after a rejected catch) */
function cleanLooks() {
  if (!S.me) return false;
  let changed = false;
  if (S.me.decor) {
    const d = S.me.decor;
    if (d.theme && SHOPI[d.theme] && !owned(d.theme)) { d.theme = 'th_dawn'; changed = true; }
    const keep = x => SHOPI[x] && owned(x);
    const items = (d.items || []).filter(keep), fx = (d.fx || []).filter(keep);
    if (items.length !== (d.items || []).length || fx.length !== (d.fx || []).length) { d.items = items; d.fx = fx; changed = true; }
  }
  if (S.me.flair && S.me.flair.gold && !owned('fl_gold')) { S.me.flair.gold = false; changed = true; }
  if (S.me.flair && S.me.flair.frame && !owned('fl_wave')) { S.me.flair.frame = false; changed = true; }
  if (S.me.char) {
    const fitted = CH.fit(CH.norm(S.me.char), S.me, myId());
    if (JSON.stringify(fitted) !== JSON.stringify(CH.norm(S.me.char))) { S.me.char = fitted; changed = true; }
  }
  return changed;
}

/* ===== Free identification help: Google Lens (no AI cost) ===== */
/* phones and tablets: hand pictures to the system share sheet (KakaoTalk, Instagram, Google Lens...) */
function touchDevice() { return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820); }
function lensBlob(type) { const sc = S.scan; if (!sc || !sc.im) return Promise.resolve(null); const c = canvasFrom(sc.im, 1280); return new Promise(r => c.toBlob(b => r(b), type, .9)); }
async function openLens() {
  const sc = S.scan; if (!sc || !sc.im) return;
  if (touchDevice() && navigator.canShare) {
    // phones: share a re-encoded copy (no GPS or camera data) straight to Google / Google Lens
    const jpg = await lensBlob('image/jpeg');
    const file = jpg && new File([jpg], 'zzirit-fish.jpg', { type: 'image/jpeg' });
    if (file && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); toast(t('lens_hint_mobile'), 'info', 7000); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
  }
  // computer (or no file sharing): show the steps at once; the clean copy and the clipboard follow in the background
  const w = openModal(`<div class="lens">
    <h2>${icon('lens')} ${t('lens_title')}</h2>
    <p class="lede">${t('lens_sub')}</p>
    <div class="lens-body">
      <div class="lens-ph"><img src="${sc.url || ''}" alt=""></div>
      <ol class="lens-steps">
        <li id="ln-step1"><span class="btn btn-line btn-sm" aria-disabled="true">${icon('image')}${t('lens_save')}</span></li>
        <li><a class="btn btn-primary btn-sm" href="https://images.google.com/" target="_blank" rel="noopener">${icon('lens')}${t('lens_open')}</a><p class="muted small" id="ln-how">${t('lens_how_drop')}</p></li>
        <li>${t('lens_step3')}</li>
      </ol>
    </div>
    <p class="hint">${icon('info')} ${t('lens_note')}</p>
  </div>`, { label: t('lens_title'), onClose: () => { if (w._url) setTimeout(() => URL.revokeObjectURL(w._url), 2000); } });
  const jpg = await lensBlob('image/jpeg'); if (!jpg || !w.isConnected) return;
  const s1 = $('#ln-step1', w);
  // website: a plain download link. Inside Claude a page cannot download by itself, so it asks through the downloads permission.
  const web = window.APP_RT === 'web';
  const dl = web ? null : (window.claude?.use ? await claude.use('downloads').catch(() => null) : null);
  if (!w.isConnected) return;
  let saveBtn = '';
  if (web) { const url = w._url = URL.createObjectURL(jpg); saveBtn = `href="${url}" download="zzirit-fish.jpg"`; }
  else if (dl) saveBtn = 'href="#" data-lens-save';
  if (s1) s1.innerHTML = saveBtn ? `<a class="btn btn-line btn-sm" ${saveBtn}>${icon('image')}${t('lens_save')}</a>` : '';
  if (dl) w.addEventListener('click', e => {
    if (!e.target.closest('[data-lens-save]')) return;
    e.preventDefault();
    dl.save({ filename: 'zzirit-fish.jpg', data: jpg }).catch(err => { if (err && err.code !== 'declined') toast(t('ai_err_generic'), 'warn'); });
  });
  if (!(navigator.clipboard && window.ClipboardItem)) return;
  try {
    const png = await lensBlob('image/png');
    const copied = await Promise.race([navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(() => true), new Promise(r => setTimeout(() => r(false), 4000))]);
    if (copied && w.isConnected) {
      if (s1) s1.innerHTML = `<b>${icon('check')} ${t('lens_copied')}</b>` + (saveBtn ? ` <a class="link small" ${saveBtn}>${t('lens_save')}</a>` : '');
      const how = $('#ln-how', w); if (how) how.textContent = t('lens_how_paste');
    }
  } catch (e) { /* saving the photo still works */ }
}

/* ===== Login ID (web build): one ID + password for every device. No email; the server keeps only a hash. ===== */
function idSupported() { return window.APP_RT === 'web' && !!(window.APP_AUTH && window.APP_AUTH.ids) && !S.idOff; }
async function myLoginId(force) {
  if (!idSupported()) return null;
  if (!force && S.loginId !== undefined) return S.loginId;
  // if the server can't answer (not set up yet, or offline), hide the ID features instead of showing broken buttons
  try { S.loginId = (await window.APP_AUTH.ids.me()) || null; } catch (e) { if (S.loginId === undefined) S.loginId = null; S.idOff = true; }
  return S.loginId;
}
function idErr(code) {
  const k = { bad_name: 'name', bad_pass: 'pass', taken: 'taken', wrong: 'wrong', slow_down: 'slow', slow: 'slow', has_id: 'has_id', team_leader: 'leader', no_id: 'no_id', mismatch: 'mismatch', need_update: 'update', not_signed_in: 'signin', not_admin: 'not_admin' }[code] || 'fail';
  return t('id_err_' + k);
}
function idFormModal({ id, title, sub, fields, go, note, onSubmit }) {
  const w = openModal(`<form class="id-form" id="${id}" novalidate><h2>${icon('user')} ${title}</h2>${sub ? `<p class="lede">${sub}</p>` : ''}
    ${fields.map(f => `<div class="field"><label for="${f.id}">${f.label}</label><input id="${f.id}" ${f.type ? `type="${f.type}"` : ''} autocomplete="${f.ac || 'off'}" autocapitalize="none" spellcheck="false" maxlength="${f.max || 72}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>${f.hint ? `<small class="muted">${f.hint}</small>` : ''}</div>`).join('')}
    ${note || ''}
    <p class="err" id="${id}-err" hidden></p>
    <div class="actions"><button class="btn btn-primary" type="submit" id="${id}-go">${go}</button><button class="btn btn-ghost" type="button" data-close>${t('cancel')}</button></div></form>`, { label: title });
  const f = $('#' + id, w), err = $('#' + id + '-err', w), btn = $('#' + id + '-go', w);
  const val = k => $('#' + k, w).value;
  f.addEventListener('submit', async e => {
    e.preventDefault(); err.hidden = true; btn.disabled = true;
    try { await onSubmit(val, w); }
    catch (x) { btn.disabled = false; err.textContent = idErr(x && x.code); err.hidden = false; }
  });
  setTimeout(() => { const first = $('input', w); if (first) first.focus(); }, 60);
  return w;
}
const idCheck = r => { if (!r || r.ok !== true) throw { code: (r && r.err) || 'fail' }; return r; };
// adding an ID and logging in both go through the one sign-up / login dialog
function openIdCreate() { if (idSupported()) openAuth('join'); }
function openIdLogin() { if (idSupported()) openAuth('login'); }
function openIdPassword() {
  if (!idSupported()) return;
  idFormModal({
    id: 'idp', title: t('id_change_pw'), go: t('save'),
    fields: [{ id: 'idp-old', label: t('id_old_pw'), type: 'password', ac: 'current-password' }, { id: 'idp-new', label: t('id_new_pw'), type: 'password', ac: 'new-password', hint: t('id_pass_hint') }, { id: 'idp-new2', label: t('id_pass2'), type: 'password', ac: 'new-password' }],
    async onSubmit(v, w) {
      const o = v('idp-old'), n1 = v('idp-new'), n2 = v('idp-new2');
      if (n1.length < 6) throw { code: 'bad_pass' };
      if (n1 !== n2) throw { code: 'mismatch' };
      idCheck(await window.APP_AUTH.ids.password(o, n1));
      closeModal(w); toast(t('id_pw_changed'), 'ok');
    }
  });
}
/* ===== Log out (website). With a login ID the person can come back any time; a device joined with a link code
   just leaves the account (the records stay there). Without either there would be no way back, so we stop and help. ===== */
async function idLogout() { return openLogout(); }
async function openLogout() {
  if (!idSupported()) return;
  const id = await myLoginId(true); const linked = !!(window.APP_AUTH.link && window.APP_AUTH.link.linked());
  if (!id && !linked) {
    const w = openModal(`<div class="logout">
      <h2>${icon('logout')} ${t('lo_title')}</h2>
      <p class="acct-state warn">${icon('warn')} ${t('lo_no_id')}</p>
      <div class="actions"><button class="btn btn-primary" id="lo-id">${icon('user')}${t('id_create')}</button><button class="btn btn-line" id="lo-login">${t('lo_other_id')}</button><button class="btn btn-ghost" data-close>${t('cancel')}</button></div>
    </div>`, { label: t('lo_title') });
    $('#lo-id', w).onclick = () => { closeModal(w); openAuth('join'); };
    $('#lo-login', w).onclick = () => { closeModal(w); openAuth('login'); };
    return;
  }
  const w = openModal(`<div class="logout">
    <h2>${icon('logout')} ${t('lo_title')}</h2>
    ${acctSumHTML()}
    <p>${id ? t('lo_sub_id', { name: `<b class="mono">${esc(id)}</b>` }) : t('lo_sub_linked')}</p>
    <p class="muted small">${icon('shield')} ${t('lo_keep')}</p>
    <div class="actions"><button class="btn btn-primary lo-go" id="lo-go">${icon('logout')}${t('id_logout')}</button><button class="btn btn-ghost" data-close>${t('cancel')}</button></div>
  </div>`, { label: t('lo_title') });
  $('#lo-go', w).onclick = async () => {
    $('#lo-go', w).disabled = true;
    try { await pushOff(); } catch (e) { } // this device stops getting the account's notices
    try { await window.APP_AUTH.ids.logout(); } catch (e) { }
    for (const k of ['me', 'meOf', 'labels', 'orders', 'suggest', 'photos', 'payok', 'welcomed', 'noti', 'notiSeen', 'notiInit', 'notiState', 'badges']) lsSet(k, null);
    lsSet('authTab', 'login'); // after reloading, the login dialog opens (to sign in again or with another ID)
    closeModal(w); toast(t('id_logged_out'));
    setTimeout(() => { location.hash = 'home'; location.reload(); }, 700);
  };
}
/* ===== Leaving (회원 탈퇴). On the website the server removes the account with everything in it, on every linked
   device (a login ID asks for the password again); then this device forgets it all and starts over. Without a server
   account (records kept only on this device) it simply wipes this device. The operator's own account can't leave here. ===== */
function wdCardHTML() {
  if (!S.me || !S.me.nick) return '';
  const server = window.APP_RT === 'web' && S.mode === 'shared' && !!(window.APP_AUTH && window.APP_AUTH.account);
  if (!server && S.mode !== 'local') return '';
  return `<section class="card wd-card"><h2 class="h3">${icon('trash')}${t('wd_title')}</h2><p class="muted">${t(server ? 'wd_sub' : 'wd_local')}</p>
    <div class="actions"><button class="btn btn-line btn-danger" data-act="withdraw">${server ? t('wd_title') : t('wd_local_go')}</button></div></section>`;
}
function wipeDevice() {
  // language, theme and units stay (they say nothing about the person); everything else of the app goes
  const keep = new Set(['lang', 'theme', 'unit']);
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('eosin.') && !keep.has(k.slice(6))) localStorage.removeItem(k); } catch (e) { }
  try { sessionStorage.clear(); } catch (e) { }
  return Promise.resolve(PHDB.clear()).catch(() => { });
}
async function openWithdraw() {
  if (!S.me || !S.me.nick) return;
  const server = window.APP_RT === 'web' && S.mode === 'shared' && !!(window.APP_AUTH && window.APP_AUTH.account);
  if (!server && S.mode !== 'local') return;
  const id = server ? await myLoginId(true) : null;
  const linked = server && !!(window.APP_AUTH.link && window.APP_AUTH.link.linked());
  const word = t('wd_word');
  const w = openModal(`<form class="wd" id="wd-form" novalidate>
    <h2>${icon('trash')} ${t('wd_title')}</h2>
    ${acctSumHTML()}
    ${server ? `<p class="acct-state warn">${icon('warn')} ${t('wd_lede')}</p>
      <ul class="wd-list">${['wd_l1', 'wd_l2', 'wd_l3', 'wd_l4'].map(k => `<li>${t(k)}</li>`).join('')}</ul>
      ${linked ? `<p class="note">${icon('link')} ${t('wd_linked_note')}</p>` : ''}
      ${id ? `<div class="field"><label for="wd-pass">${t('wd_pass')} <span class="muted mono">${esc(id)}</span></label><input id="wd-pass" type="password" autocomplete="current-password" maxlength="64"></div>` : `<p class="muted small">${t('wd_no_pass')}</p>`}`
      : `<p class="acct-state warn">${icon('warn')} ${t('wd_local')}</p>`}
    <div class="field"><label for="wd-word">${t('wd_type', { w: esc(word) })}</label><input id="wd-word" autocomplete="off" maxlength="20" placeholder="${esc(word)}"></div>
    <p class="err" id="wd-err" hidden></p>
    <div class="actions"><button class="btn btn-danger" id="wd-go" type="submit" disabled>${icon('trash')}${server ? t('wd_go') : t('wd_local_go')}</button><button class="btn btn-ghost" type="button" data-close>${t('cancel')}</button></div>
  </form>`, { label: t('wd_title') });
  const go = $('#wd-go', w), inp = $('#wd-word', w), err = $('#wd-err', w);
  const ok = () => inp.value.trim().toLowerCase() === word.toLowerCase();
  inp.addEventListener('input', () => { go.disabled = !ok(); });
  $('#wd-form', w).onsubmit = async e => {
    e.preventDefault(); if (!ok() || go.disabled) return;
    err.hidden = true; go.disabled = true;
    if (server) {
      const pass = $('#wd-pass', w) ? $('#wd-pass', w).value : null;
      if (id && !pass) { err.textContent = t('wd_err_wrong'); err.hidden = false; go.disabled = false; $('#wd-pass', w).focus(); return; }
      try { await pushOff(); } catch (x) { } // this browser stops getting notices before the account goes
      try { await window.APP_AUTH.account.remove(pass); }
      catch (x) {
        const c = (x && x.code) || 'unavailable'; const k = 'wd_err_' + c; const msg = t(k);
        err.textContent = msg === k ? t('wd_err_unavailable') : msg; err.hidden = false; go.disabled = false; return;
      }
    }
    try { pkStop(); } catch (x) { }
    await wipeDevice();
    closeModal(w); toast(t('wd_done'), 'ok', 6000);
    setTimeout(() => { location.hash = 'home'; location.reload(); }, 1600);
  };
}
function acctSumHTML() {
  if (!S.me || !S.me.nick) return '';
  return `<div class="acct-sum">${avatar(S.me, 44)}<div><b>${nickHTML(S.me)}</b> ${lvMini(S.me, myId())}<p class="muted small">${t('acct_sum', { n: fmtN(myCatches().length), pts: fmtN(myPoints()), lv: myLevel() })}</p></div></div>`;
}
function idCardHTML() {
  if (S.loginId === undefined) { myLoginId().then(() => { const c = $('#id-card'); if (c) { if (S.idOff) c.remove(); else c.innerHTML = idCardHTML(); } }); return `<h2 class="h3">${icon('user')}${t('acct_title')}</h2><p class="muted">${t('thinking')}</p>`; }
  const linked = !!(window.APP_AUTH.link && window.APP_AUTH.link.linked());
  return S.loginId
    ? `<h2 class="h3">${icon('user')}${t('acct_title')}</h2>${acctSumHTML()}<p class="acct-state ok">${icon('check')} ${t('id_signed_in', { name: `<b class="mono">${esc(S.loginId)}</b>` })}</p><p class="muted small">${t('id_signed_in_sub')}</p>
       <div class="actions"><button class="btn btn-line" data-id="password">${t('id_change_pw')}</button><button class="btn btn-ghost" data-id="logout">${t('id_logout')}</button></div>`
    : `<h2 class="h3">${icon('user')}${t('acct_title')}</h2>${acctSumHTML()}<p class="acct-state warn">${icon('warn')} ${t(S.me && S.me.nick ? 'acct_no_id' : 'acct_none')}</p>
       <div class="actions"><button class="btn btn-primary" data-id="create">${t(S.me && S.me.nick ? 'id_create' : 'auth_tab_join')}</button><button class="btn btn-line" data-id="login">${t('id_login')}</button>${linked ? `<button class="btn btn-ghost" data-id="logout">${t('id_logout')}</button>` : ''}</div>`;
}

/* ===== Operator: remove an account (with everything it posted) ===== */
async function adminDeleteUser(uid, btn) {
  if (!S.isOwner || !uid || uid === myId()) return;
  const a = S.anglers.get(uid); const nick = (a && a.nick) || '?';
  if (btn && !armed(btn, t('ad_del_confirm', { nick }))) return;
  try {
    if (window.APP_RT === 'web') { if (!window.APP_AUTH || !window.APP_AUTH.admin) throw new Error('unavailable'); await window.APP_AUTH.admin.deleteUser(uid); }
    else await store.adminDeleteDocs(uid);
    S.anglers.delete(uid); S.dataVer++;
    toast(t('ad_deleted', { nick }), 'ok');
    if (/^#sea/.test(location.hash) && location.hash.includes(uid)) location.hash = 'admin'; else rerender();
  } catch (e) {
    // say what actually happened (an older version showed "operator accounts can't be deleted" for any error)
    const k = { need_update: 'ad_need_update', self: 'ad_del_self', not_admin: 'ad_not_admin' }[e && e.code] || 'ad_del_fail';
    toast(t(k), 'warn', 7000);
  }
}

/* ===== PC ↔ phone: one account on several devices (web build) ===== */
function linkSupported() { return window.APP_RT === 'web' && window.APP_AUTH && window.APP_AUTH.link; }
async function openLinkMake() {
  if (!linkSupported()) return;
  const w = openModal(`<div class="link-make"><h2>${icon('link')} ${t('link_make')}</h2><p class="lede">${t('link_make_sub')}</p><div class="link-box" id="lk-box"><p class="muted">${t('thinking')}</p></div></div>`, { label: t('link_make') });
  const box = $('#lk-box', w);
  try {
    const code = await window.APP_AUTH.link.create();
    const pretty = code.slice(0, 4) + '-' + code.slice(4);
    const url = location.origin + location.pathname + '#link=' + code;
    const until = nowMs() + 10 * 60000;
    box.innerHTML = `<div class="link-qr" id="lk-qr"></div><div class="link-code" data-copybox><span class="copy-src mono">${pretty}</span><button class="btn btn-line btn-sm" data-copy="${code}">${icon('copy')}${t('copy')}</button></div><p class="hint">${t('link_code_hint')} <b id="lk-left" class="num"></b></p>`;
    drawQr($('#lk-qr', w), url);
    const tick = () => { const n = $('#lk-left', w); if (!n) return; const s = Math.max(0, Math.round((until - nowMs()) / 1000)); n.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s > 0) setTimeout(tick, 1000); else box.innerHTML = `<p class="muted">${t('link_expired')}</p>`; };
    tick();
  } catch (e) { box.innerHTML = `<p class="err">${esc(linkErr(e))}</p>`; }
}
function linkErr(e) { const m = String((e && (e.code || e.message)) || ''); return /slow|rate/i.test(m) ? t('link_slow') : /bad|expired|invalid/i.test(m) ? t('link_bad') : /team_leader/i.test(m) ? t('link_err_leader') : /has_id/i.test(m) ? t('id_err_has_id') : t('link_fail'); }
function openLinkEnter(pre) {
  if (!linkSupported()) return;
  const local = myCatches().length;
  const w = openModal(`<div class="link-enter"><h2>${icon('link')} ${t('link_confirm_title')}</h2><p class="lede">${t('link_enter_sub')}</p>
    <div class="field"><label for="lk-code">${t('link_enter')}</label><input id="lk-code" class="mono" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EF12" value="${esc(pre ? pre.slice(0, 4) + (pre.length > 4 ? '-' + pre.slice(4) : '') : '')}"></div>
    ${local ? `<p class="note">${icon('info')} ${t('link_merge_note', { n: local })}</p>` : ''}
    <p class="err" id="lk-err" hidden></p>
    <div class="actions"><button class="btn btn-primary" id="lk-go">${t('link_go')}</button><button class="btn btn-ghost" data-close>${t('cancel')}</button></div></div>`, { label: t('link_enter') });
  const inp = $('#lk-code', w), err = $('#lk-err', w), go = $('#lk-go', w);
  const run = async () => {
    err.hidden = true; const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) { err.textContent = t('link_bad'); err.hidden = false; return; }
    go.disabled = true;
    try {
      await window.APP_AUTH.link.redeem(code);
      for (const k of ['me', 'labels', 'orders', 'suggest', 'photos']) lsSet(k, null);
      try { localStorage.removeItem('eosin.spots'); } catch (e) { }
      toast(t('link_ok')); closeModal(w);
      setTimeout(() => { location.hash = 'sea'; location.reload(); }, 800);
    } catch (e) { go.disabled = false; err.textContent = linkErr(e); err.hidden = false; }
  };
  go.onclick = run; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
}
async function linkLeave(btn) {
  if (!linkSupported()) return;
  if (btn && !armed(btn, t('link_leave_confirm'))) return;
  try { await window.APP_AUTH.link.leave(); for (const k of ['me', 'labels', 'orders', 'suggest', 'photos']) lsSet(k, null); toast(t('link_left')); setTimeout(() => location.reload(), 700); }
  catch (e) { toast(linkErr(e), 'warn'); }
}

/* ===== Species sheet ===== */
function toxChip(sp, big) {
  if (!sp || !sp.tox) return '';
  const k = ['', 'poison', 'sting', 'cig', 'caution'][sp.tox];
  const ic = sp.tox === 1 ? 'skull' : sp.tox === 2 ? 'spike' : 'warn';
  return `<span class="chip chip-${k}${big ? ' big' : ''}">${icon(ic)}${t('tox_' + k)}</span>`;
}
function seasonBars(sp, lat = 36, label = true) {
  const m = new Date().getMonth();
  const vals = Array.from({ length: 12 }, (_, i) => GEO.seasonVal(sp, i, lat));
  return `<div class="bars" role="img" aria-label="${esc(t('season_aria'))}">${vals.map((v, i) => `<span class="${i === m ? 'now' : ''}" style="--v:${(v / 3).toFixed(2)}" title="${i + 1}${t('month_suffix')}: ${'●'.repeat(Math.round(v)) || '–'}"></span>`).join('')}</div>${label ? `<div class="bars-lbl">${Array.from({ length: 12 }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>` : ''}`;
}
function legalBlock(sp) {
  const lg = sp.lg || {};
  const parts = [];
  if (lg.min) parts.push(`<li>${t('lg_min', { n: lg.min })}${lg.nt === 'tachiuo' ? ' ' + t('lg_anal') : lg.nt === 'surumeika' ? ' ' + t('lg_mantle') : ''}</li>`);
  if (lg.cl) parts.push(`<li>${t('lg_closed', { d: closedText(sp) })}${isClosed(sp) ? ` <span class="chip chip-closed">${t('closed_now')}</span>` : ''}</li>`);
  if (lg.nt && T['lgn_' + lg.nt]) parts.push(`<li class="muted">${t('lgn_' + lg.nt)}</li>`);
  if (!parts.length) return `<p class="muted">${t('lg_none')}</p>`;
  return `<ul class="legal">${parts.join('')}</ul>`;
}
function openSpecies(id) {
  const sp = SPI[id]; if (!sp) return;
  const all = []; for (const [uid, a] of allAnglers()) for (const c of (a.catches || [])) if (c.sp === id && (a._local || eligible(c, uid))) all.push({ c, a });
  const best = all.slice().sort((x, y) => (y.c.len || 0) - (x.c.len || 0))[0];
  const mine = myCatches().filter(c => c.sp === id);
  const regions = Object.entries(sp.ab).sort((a, b) => b[1] - a[1]);
  const lat = (GEO.HOME[S.me?.home || defaultHome()] || [0, 36])[1];
  const w = openModal(`
    <article class="sps">
      <div class="sps-hero tone-${sp.w}">
        <img src="${FD.thumb(sp, 520, 260)}" alt="" width="520" height="260">
        <div class="sps-chips">${toxChip(sp, true)}${isClosed(sp) ? `<span class="chip chip-closed big">${icon('lock')}${t('closed_now')}</span>` : ''}${+sp.mo[new Date().getMonth()] >= 3 ? `<span class="chip chip-season big">${t('in_season')}</span>` : ''}</div>
      </div>
      <header class="sps-head">
        <h2>${esc(spName(sp))}</h2>
        <p class="sci">${esc(sp.sci)}</p>
        <p class="names">${sp.n.map((n, i) => i === S.li ? '' : `<span><b>${['KO', 'EN', 'JA', 'ZH'][i]}</b> ${esc(n)}</span>`).join('')}</p>
        <div class="stars" aria-label="${esc(t('rarity'))}">${'★'.repeat(sp.r)}${'☆'.repeat(5 - sp.r)} <span class="muted">${t('rarity')} · ${t('pts_per_ref', { n: scoreOf(id, sp.L, false, false, false) })}</span></div>
      </header>
      ${sp.tox ? `<section class="tox-panel tox-${sp.tox}"><h3>${icon(sp.tox === 1 ? 'skull' : sp.tox === 2 ? 'spike' : 'warn')} ${t('tox_' + ['', 'poison', 'sting', 'cig', 'caution'][sp.tox])}</h3><p>${t('toxd_' + sp.tox)}</p>${sp.tox === 2 ? `<p class="aid"><b>${t('first_aid')}</b> ${t('aid_sting')}</p>` : sp.tox === 1 ? `<p class="aid"><b>${t('first_aid')}</b> ${t('aid_eat')}</p>` : ''}</section>` : ''}
      <section><h3>${t('tip')}</h3><p>${esc(dict(sp.t))}</p></section>
      <div class="sps-grid">
        <section><h3>${t('season_kr')}</h3>${seasonBars(sp, lat)}<p class="hint">${t('season_hint')}</p></section>
        <section><h3>${t('legal_kr')}</h3>${legalBlock(sp)}<p class="hint">${t('legal_src')}</p></section>
      </div>
      <section><h3>${t('rec_baits')}</h3>
        <div class="chips">${sp.b.map(b => `<span class="chip chip-bait">${esc(dict(BAIT[b]))}</span>`).join('') || `<span class="muted">—</span>`}</div>
        <h3 class="mt">${t('rec_lures')}</h3>
        <div class="chips">${sp.lu.map(b => `<span class="chip chip-lure">${esc(dict(LURE[b]))}</span>`).join('') || `<span class="muted">—</span>`}</div>
        <h3 class="mt">${t('rec_methods')}</h3>
        <div class="chips">${sp.me.map(b => `<span class="chip">${esc(dict(METHOD[b]))}</span>`).join('')}</div>
      </section>
      <div class="sps-grid">
        <section><h3>${t('id_tips')}</h3><p>${esc(dict(sp.idt))}</p>${(sp.lk || []).filter(x => SPI[x]).length ? `<p class="lk">${t('lookalikes')} ${(sp.lk || []).filter(x => SPI[x]).map(x => `<button class="link" data-sp="${x}">${esc(nameOf(x))}</button>`).join(' · ')}</p>` : ''}</section>
        <section><h3>${t('where')}</h3><ul class="where">${regions.map(([r, v]) => `<li><span>${esc(regionName(r))}</span><span class="dots">${'●'.repeat(v)}${'○'.repeat(3 - v)}</span></li>`).join('')}</ul></section>
      </div>
      <section class="sps-stats">
        <div><span class="num">${fmtN(all.length)}</span><span>${t('community_catches')}</span></div>
        <div><span class="num">${best ? lenFmt(best.c.len) : '—'}</span><span>${t('biggest_record')}${best ? ` · ${esc(best.a.nick)}` : ''}</span></div>
        <div><span class="num">${fmtN(mine.length)}</span><span>${t('my_catches')}</span></div>
        <div><span class="num">${lenFmt(sp.X)}</span><span>${t('record_class')}</span></div>
      </section>
      <div class="actions"><a class="btn btn-line" href="#tackle" data-tackle="${id}">${icon('lure')} ${t('open_tackle')}</a><a class="btn btn-line" href="#map" data-mapsp="${id}">${icon('map')} ${t('open_map_sp')}</a></div>
    </article>`, { wide: true, label: spName(sp) });
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-sp]'); if (b) { closeModal(w); openSpecies(b.dataset.sp); }
    const tk = e.target.closest('[data-tackle]'); if (tk) { S.tackleSp = tk.dataset.tackle; closeModal(w); }
    const mp = e.target.closest('[data-mapsp]'); if (mp) { S.mapSp = mp.dataset.mapsp; closeModal(w); }
  });
}

/* ===== Catch detail ===== */
async function openCatch(uid, cid) {
  const a = uid === (S.uid || 'local') ? S.me : (allAnglers().get(uid));
  const c = a && (a.catches || []).find(x => x.id === cid); if (!c) return;
  const sp = SPI[c.sp]; const mine = uid === (S.uid || 'local');
  const st = catchState(uid, c);
  const note = (mine || S.isOwner) ? reviewNote(uid, c) : null;
  const showLoc = mine && c.lat != null;
  const w = openModal(`
    <article class="cd">
      <div class="cd-photo"><div class="ph-skel" id="cd-ph">${sp ? `<img src="${FD.thumb(sp, 420, 240)}" alt="">` : ''}</div></div>
      <div class="cd-info">
        <p class="eyebrow">${c.past ? t('past_catch') : t('catch')} · ${fmtDT(c.ts)}</p>
        <h2>${esc(nameOf(c.sp))} <span class="num len">${lenFmt(c.len)}</span></h2>
        <div class="chips">${statusChip(st, c.tr, logOnly(uid, c))}${toxChip(sp)}${c.rel ? `<span class="chip chip-ok">${t('released')}</span>` : ''}${isFeaturedCatch(c) ? `<span class="chip chip-feat">${t('x2')}</span>` : ''}</div>
        ${note && note.v !== 'ok' ? `<p class="note rv-note">${icon('shield')} <span><b>${t(note.v === 'no' ? (note.code === 'no_photo' ? 'rv_title_log' : 'rv_title_no') : 'rv_title_hold')}</b> ${esc(reviewReason(note))}</span></p>` : st === 'review' && mine ? `<p class="note rv-note">${icon('clock')} <span>${t('rv_waiting')}</span></p>` : ''}
        <dl class="kv">
          <div><dt>${t('angler')}</dt><dd>${mine ? `${flag(a.cc)} ${esc(a.nick)}` : `<button class="link" data-seauid="${esc(uid)}">${flag(a.cc)} ${esc(a.nick)}</button>${relation(uid) === 'friend' ? ` <span class="chip chip-ok">${t('fr_is_friend')}</span>` : ''}`}</dd></div>
          <div><dt>${t('score')}</dt><dd class="num">${fmtN(c.sc || 0)} pt</dd></div>
          ${c.wt ? `<div><dt>${t('weight')}</dt><dd>${wtFmt(c.wt)}</dd></div>` : ''}
          <div><dt>${t('area')}</dt><dd>${esc(c.sea ? dict(GEO.seaOf(c.lon, c.lat).n) : regionName(c.rg || ''))}${showLoc ? `<br><span class="mono small">${GEO.fmtLL(c.lat, c.lon)}</span>` : ''}</dd></div>
          ${c.bait ? `<div><dt>${t('bait_used')}</dt><dd>${esc(c.bait)}</dd></div>` : ''}
          ${c.me ? `<div><dt>${t('method')}</dt><dd>${esc(dict(METHOD[c.me]) || c.me)}</dd></div>` : ''}
          <div><dt>${t('trust')}</dt><dd><span class="trust-meter"><i style="width:${c.tr || 0}%"></i></span> ${c.tr ?? '—'}</dd></div>
        </dl>
        ${c.memo ? `<blockquote class="memo" id="cd-memo">${esc(c.memo)}</blockquote>${!mine && S.sample ? `<button class="btn btn-ghost btn-sm" id="cd-tr">${icon('globe')} ${t('translate')}</button>` : ''}` : ''}
        <div class="actions split"><button class="btn btn-line btn-sm" data-share="${esc(uid)}|${esc(c.id)}">${icon('share')} ${t('share_btn')}</button>${mine && pointsOn() && c.lat != null ? `<button class="btn btn-line btn-sm" id="cd-pt">${icon('pin')} ${t('pt_from_catch')}</button>` : ''}${mine ? `<button class="btn btn-ghost btn-sm" id="cd-del">${icon('trash')} ${t('delete')}</button>` : ''}</div>
      </div>
    </article>`, { wide: true });
  store.getPhoto(uid, c.id).then(src => { if (src) { const ph = $('#cd-ph', w); if (ph) ph.innerHTML = `<img src="${src}" alt="${esc(nameOf(c.sp))}">`; } });
  const tr = $('#cd-tr', w);
  if (tr) tr.onclick = async () => {
    tr.disabled = true; tr.textContent = t('thinking');
    try { const r = await S.sample(`Translate the following fishing note into ${LANG_NAME[S.li]}. Output only the translation.\n\n${c.memo}`, { modelTier: 'quick' }); $('#cd-memo', w).textContent = r.text.trim(); tr.remove(); }
    catch (e) { tr.textContent = aiErrorText(e); }
  };
  const cpt = $('#cd-pt', w);
  if (cpt) cpt.onclick = () => { closeModal(w); openPointEdit(null, { lat: Math.round(c.lat * 1e4) / 1e4, lon: Math.round(c.lon * 1e4) / 1e4, sp: SPI[c.sp] ? [c.sp] : [], kind: c.sea ? 'breakwater' : 'river' }); };
  const del = $('#cd-del', w);
  if (del) del.onclick = () => {
    if (del.dataset.armed) { S.me.catches = S.me.catches.filter(x => x.id !== c.id); store.saveMe(); store.deletePhoto(c.id); closeModal(w); toast(t('deleted')); rerender(); }
    else { del.dataset.armed = '1'; del.classList.add('danger'); del.innerHTML = `${icon('trash')} ${t('delete_confirm')}`; }
  };
}
/* ===== Friends: request · accept · decline · cancel · unfriend ===== */
async function friendAction(act, uid, btn) {
  if (!S.me || !S.me.nick) { ensureProfile(() => friendAction(act, uid)); return; }
  if (S.mode !== 'shared' || !S.uid) { toast(t('fr_need_shared'), 'info', 4800); return; }
  const o = S.anglers.get(uid); if (!o || uid === S.uid) return;
  const theirs = frEdge(o, S.uid);
  const ts = Math.max(nowMs(), (theirs ? theirs[1] : 0) + 1); // stays newer than their side even if clocks disagree
  const rel = relation(uid);
  const fr = Object.assign({}, S.me.fr || {});
  let msg = null;
  if (act === 'req' && (rel === 'in' || rel === 'hidden')) act = 'acc';
  if (act === 'req') {
    if (rel !== 'none') return;
    if (o.frOff) { toast(t('fr_off'), 'info'); return; }
    const L = frLists();
    if (L.out.length >= FR_PENDING_MAX) { toast(t('fr_limit_pending', { n: FR_PENDING_MAX }), 'warn', 4800); return; }
    if (L.friends.length >= FR_MAX) { toast(t('fr_limit', { n: FR_MAX }), 'warn'); return; }
    fr[uid] = ['r', ts]; msg = t('fr_sent', { nick: o.nick });
  } else if (act === 'acc') {
    if (frLists().friends.length >= FR_MAX) { toast(t('fr_limit', { n: FR_MAX }), 'warn'); return; }
    fr[uid] = ['a', ts]; msg = t('fr_accepted_t', { nick: o.nick });
  } else if (act === 'dec') { fr[uid] = ['d', ts]; msg = t('fr_declined_t'); }
  else if (act === 'cancel') { delete fr[uid]; msg = t('fr_canceled_t'); }
  else if (act === 'un') {
    if (btn && !btn.dataset.armed) { btn.dataset.armed = '1'; btn.classList.add('danger'); btn.textContent = t('fr_un_confirm'); setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove('danger'); btn.textContent = t('fr_un'); } }, 4000); return; }
    fr[uid] = ['x', ts]; msg = t('fr_removed_t', { nick: o.nick });
  } else return;
  S.me.fr = fr; S.dataVer++;
  // record the new state first: the db echo can arrive before the write resolves, and my own action shouldn't toast back at me
  const L = frLists(); S._frPrev = { inc: new Set(L.inc.map(x => x.uid)), fr: new Set(L.friends.map(x => x.uid)) };
  await store.saveMe();
  if (act === 'req' || act === 'acc') pushSend(act === 'req' ? 'freq' : 'facc', uid);
  if (msg) toast(msg, act === 'dec' || act === 'cancel' ? 'info' : 'ok');
  rerender();
}
/* A catch the reviewer could not check because it has no photo stays in the angler's log, outside rankings */
function logOnly(uid, c) { if (catchState(uid, c) !== 'no') return false; const n = reviewNote(uid, c); return !!(n && n.code === 'no_photo'); }
function statusChip(st, tr, log) {
  if (log) return `<span class="chip chip-local">${icon('log')}${t('st_logonly')}</span>`;
  if (st === 'ok') return `<span class="chip chip-ok">${icon('check')}${tr >= 70 ? t('st_verified') : t('st_ok')}</span>`;
  if (st === 'review') return `<span class="chip chip-review">${icon('clock')}${t('st_review')}</span>`;
  if (st === 'hold') return `<span class="chip chip-wait">${icon('clock')}${t('st_hold')}</span>`;
  if (st === 'no') return `<span class="chip chip-closed">${icon('x')}${t('st_rejected')}</span>`;
  if (st === 'local') return `<span class="chip chip-local">${t('st_local')}</span>`;
  return '';
}

/* ===== Map picker (catch location) ===== */
function openMapPicker(init, cb) {
  const w = openModal(`
    <div class="picker">
      <h2>${t('pick_title')}</h2>
      <p class="lede">${t('pick_sub')}</p>
      <div class="picker-map" id="pk-map"></div>
      <div class="picker-foot"><div id="pk-info" class="muted">${t('pick_hint')}</div><button class="btn btn-primary" id="pk-ok" disabled>${t('pick_ok')}</button></div>
    </div>`, { wide: true, noFocus: true });
  const el = $('#pk-map', w);
  const map = L.map(el, { zoomControl: true, attributionControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 11 }).setView([init[1], init[0]], 7);
  const LY = MAPX.makeLayers(L);
  new LY.Sat({}).addTo(map);
  new LY.Vec({ toggles: () => ({ coast: true, urban: true, roads: true, fresh: true, bathy: false, grid: true }) }).addTo(map);
  MAPX.labelLayer(L, map, () => S.li).refresh();
  MAPX.load().then(() => setTimeout(() => { map.invalidateSize(); }, 50));
  let mk = null, pos = null;
  map.on('click', e => {
    pos = [e.latlng.lng, e.latlng.lat];
    if (!mk) mk = L.marker(e.latlng, { icon: L.divIcon({ className: 'pin', html: icon('pin'), iconSize: [28, 28], iconAnchor: [14, 26] }) }).addTo(map); else mk.setLatLng(e.latlng);
    const env = GEO.envAt(pos[0], pos[1]);
    const sea = env && env.water ? dict(GEO.seaOf(pos[0], pos[1]).n) : t('fresh_land');
    $('#pk-info', w).innerHTML = `<b>${esc(sea)}</b> · <span class="mono">${GEO.fmtLL(pos[1], pos[0])}</span>`;
    $('#pk-ok', w).disabled = false;
  });
  setTimeout(() => map.invalidateSize(), 250);
  $('#pk-ok', w).onclick = () => { closeModal(w); cb && cb(pos); };
}

/* ===== Share card: one picture of a catch to send to friends (KakaoTalk, Instagram...) =====
   Drawn on this device; shows the sea area at most, never the exact spot. */
function imgFrom(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fitText(g, s, max) { if (g.measureText(s).width <= max) return s; let a = [...s]; while (a.length > 1 && g.measureText(a.join('') + '…').width > max) a.pop(); return a.join('') + '…'; }
async function catchCardBlob(uid, a, c) {
  const W = 1080, H = 1350, P = 60;
  const SANS = '"IBM Plex Sans KR", "IBM Plex Sans JP", "Noto Sans SC", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  const DISP = '"Big Shoulders Display", ' + SANS;
  try { await Promise.race([Promise.all([document.fonts.load(`800 170px ${DISP}`, '0123456789.cm'), document.fonts.load(`700 64px ${SANS}`, nameOf(c.sp) + (a.nick || ''))]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0E2440'); bg.addColorStop(1, '#070C16');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * .85, H * .1, 0, W * .85, H * .1, W * .7); glow.addColorStop(0, 'rgba(255,90,31,.18)'); glow.addColorStop(1, 'rgba(255,90,31,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // photo (or the drawn fish when there is none)
  const sp = SPI[c.sp];
  const photo = await store.getPhoto(uid, c.id).catch(() => null);
  const px = P, py = P, pw = W - P * 2, ph = 800;
  g.save(); rrect(g, px, py, pw, ph, 40); g.clip();
  g.fillStyle = '#CFE6F0'; g.fillRect(px, py, pw, ph);
  try {
    const im = await imgFrom(photo || FD.thumb(sp || SP[0], 960, 680));
    const s = Math.max(pw / im.width, ph / im.height), dw = im.width * s, dh = im.height * s;
    g.drawImage(im, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
  } catch (e) { }
  const shade = g.createLinearGradient(0, py + ph - 220, 0, py + ph); shade.addColorStop(0, 'rgba(7,12,22,0)'); shade.addColorStop(1, 'rgba(7,12,22,.55)');
  g.fillStyle = shade; g.fillRect(px, py + ph - 220, pw, 220);
  g.restore();
  // status pills on the photo
  const pills = [];
  if (eligible(c, uid)) pills.push([t('share_pill_ok'), '#1F9D63']);
  if (c.rel) pills.push([t('released'), '#2A7FB8']);
  if (c.past) pills.push([t('past_short'), '#5B6B80']);
  let x = px + 28; g.font = `700 34px ${SANS}`; g.textBaseline = 'middle';
  for (const [label, col] of pills) { const w = g.measureText(label).width + 44; g.fillStyle = col; rrect(g, x, py + 28, w, 60, 30); g.fill(); g.fillStyle = '#fff'; g.fillText(label, x + 22, py + 59); x += w + 14; }
  // name and length
  g.textBaseline = 'alphabetic'; g.fillStyle = '#FFFFFF';
  g.font = `700 64px ${SANS}`; g.fillText(fitText(g, nameOf(c.sp) || '?', W - P * 2), P, py + ph + 100);
  const lenTxt = String(Math.round(c.len * 10) / 10);
  g.font = `800 176px ${DISP}`; g.fillStyle = '#FF6A2B'; g.fillText(lenTxt, P - 4, py + ph + 270);
  const lw = g.measureText(lenTxt).width;
  g.font = `800 72px ${DISP}`; g.fillStyle = '#FFFFFF'; g.fillText('cm', P + lw + 14, py + ph + 270);
  // when, where (sea area only), who
  const where = c.sea && c.lon != null ? dict(GEO.seaOf(c.lon, c.lat).n) : regionName(c.rg || '');
  const lv = uid ? lvInfo(a, uid).L : 1;
  g.font = `500 36px ${SANS}`; g.fillStyle = '#A9BBCF';
  g.fillText(fitText(g, [fmtDate(c.ts), where, `${a.nick || '?'} · Lv.${lv}`].filter(Boolean).join('  ·  '), W - P * 2), P, py + ph + 340);
  // brand footer
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(P, H - 150, W - P * 2, 2);
  try { const logo = await imgFrom(LOGO.mark); g.save(); rrect(g, P, H - 118, 76, 76, 18); g.clip(); g.drawImage(logo, P, H - 118, 76, 76); g.restore(); } catch (e) { }
  g.fillStyle = '#FFFFFF'; g.font = `800 42px ${SANS}`; g.fillText(`${APP_NAME[0]} ${APP_NAME[1]}`, P + 98, H - 68);
  g.fillStyle = '#7F95AD'; g.font = `500 28px ${SANS}`; g.textAlign = 'right'; g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - P, H - 70); g.textAlign = 'left';
  return new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', .9));
}
async function shareCatch(uid, cid, btn) {
  const a = uid === (S.uid || 'local') ? S.me : allAnglers().get(uid);
  const c = a && (a.catches || []).find(x => x.id === cid); if (!c) return;
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try {
    const blob = await catchCardBlob(uid, a, c); if (!blob) throw new Error('no card');
    const name = `zzirit-${SPI[c.sp] ? c.sp : 'catch'}-${Math.round(c.len)}cm.jpg`;
    const text = t('share_text', { name: nameOf(c.sp), len: lenFmt(c.len) });
    const file = new File([blob], name, { type: 'image/jpeg' });
    // phones: straight to KakaoTalk, Instagram and the rest; computers: the picture with a save button
    if (touchDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: text + '\n' + SITE_URL }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    openShareCard(blob, name, text);
  } catch (e) { console.warn(e); toast(t('share_fail'), 'warn'); }
  finally { if (btn) btn.disabled = false; }
}
function openShareCard(blob, name, text) {
  const url = URL.createObjectURL(blob);
  const web = window.APP_RT === 'web';
  const w = openModal(`<div class="share-card">
    <h2>${icon('share')} ${t('share_title')}</h2>
    <p class="lede">${t('share_sub')}</p>
    <img class="sc-img" src="${url}" alt="${esc(text)}">
    <div class="actions"><a class="btn btn-primary" id="sc-save" href="${web ? url : '#'}"${web ? ` download="${esc(name)}"` : ''}>${icon('image')}${t('share_save')}</a><button class="btn btn-line" data-copy="${esc(text + ' ' + SITE_URL)}">${icon('copy')}${t('share_copy')}</button></div>
  </div>`, { label: t('share_title'), onClose: () => setTimeout(() => URL.revokeObjectURL(url), 2000) });
  // inside Claude a page can't download by itself; it asks through the downloads permission
  if (!web) $('#sc-save', w).onclick = async e => {
    e.preventDefault();
    try { const dl = await claude.use('downloads'); await dl.save({ filename: name, data: blob }); }
    catch (err) { if (!err || err.code !== 'declined') toast(t('share_fail'), 'warn'); }
  };
}

/* ===== What's new: shown once after a big update (website only; needs the matching server update) ===== */
const WHATS_NEW = '2026-10-29d', WN_TS = Date.parse('2026-10-29T09:30:00Z'); // people who joined after this have nothing to catch up on
const BOOT_AT = Date.now();
/* what each update brought, newest last; people see what came after the last one they saw (at most 6 lines) */
const WN_ITEMS = [
  ['2026-10-28', 'user', 'wn_id'], ['2026-10-28', 'shield', 'wn_review'], ['2026-10-28', 'heart', 'wn_pay'], ['2026-10-28', 'share', 'wn_share'],
  ['2026-10-29', 'bell', 'wn_noti'], ['2026-10-29', 'wave', 'wn_wx'], ['2026-10-29', 'medal', 'wn_bdg'], ['2026-10-29', 'download', 'wn_inst'], ['2026-10-29', 'logout', 'wn_out'],
  ['2026-10-29b', 'wave', 'wn_fs'], ['2026-10-29b', 'trophy', 'wn_wk'], ['2026-10-29b', 'chart', 'wn_st'], ['2026-10-29b', 'phone', 'wn_push'],
  ['2026-10-29c', 'camera', 'wn_fix'], ['2026-10-29c', 'menu', 'wn_menu'],
  ['2026-10-29d', 'wave', 'wn_park'], ['2026-10-29d', 'chat', 'wn_chat'], ['2026-10-29d', 'board', 'wn_bdmod'], ['2026-10-29d', 'user', 'wn_wd']
];
function maybeWhatsNew(tries = 0) {
  if (window.APP_RT !== 'web' || lsGet('wn', '') === WHATS_NEW || tries > 6) return;
  if (!S.ready || $('.modal-wrap.in')) { setTimeout(() => maybeWhatsNew(tries + 1), 4000); return; }
  // a first visit gets the welcome dialog instead, and someone who joined after the update has nothing to catch up on
  if (!S.me || !S.me.nick || (S.me.joined && S.me.joined >= Math.min(WN_TS, BOOT_AT))) { lsSet('wn', WHATS_NEW); return; }
  myLoginId().then(id => {
    if (S.idOff || lsGet('wn', '') === WHATS_NEW) return; // the server update isn't in yet: try again next visit
    if ($('.modal-wrap.in')) { setTimeout(() => maybeWhatsNew(tries + 1), 4000); return; }
    const seen = lsGet('wn', '') || ''; lsSet('wn', WHATS_NEW); openWhatsNew(id, seen);
  });
}
function openWhatsNew(id, seen = '') {
  // the newest update first (in the listed order); the login-ID line leads for people who still have no ID
  const pick = WN_ITEMS.filter(x => x[0] > seen && x[2] !== 'wn_id');
  const vers = [...new Set(pick.map(x => x[0]))].sort().reverse();
  const all = vers.flatMap(v => pick.filter(x => x[0] === v));
  if (!id && idSupported()) all.unshift(WN_ITEMS.find(x => x[2] === 'wn_id'));
  const items = all.slice(0, 6).map(x => [x[1], x[2]]);
  if (!items.length) return;
  const w = openModal(`<div class="wn">
    <p class="eyebrow">${t('wn_eyebrow')}</p>
    <h2>${t('wn_title')}</h2>
    <ul class="wn-list">${items.map(([ic, k]) => `<li>${icon(ic)}<div><b>${t(k + '_h')}</b><p class="muted">${t(k + '_p')}</p></div></li>`).join('')}</ul>
    <div class="actions"><button class="btn btn-primary" id="wn-ok">${t('ok')}</button>${!id && idSupported() ? `<button class="btn btn-line" id="wn-id">${icon('user')}${t('id_create')}</button>` : ''}</div>
  </div>`, { label: t('wn_title') });
  $('#wn-ok', w).onclick = () => closeModal(w);
  const b = $('#wn-id', w); if (b) b.onclick = () => { closeModal(w); openIdCreate(); };
}

/* ===== Install as an app (website). Chrome, Edge and Samsung Internet offer a one-tap install; iPhone and iPad
   need Safari's Share → Add to Home Screen; in-app browsers (KakaoTalk, Instagram…) can't install at all.
   Nothing to show once the site already runs as an installed app. ===== */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; try { if (S.route === 'home') rerenderSoon(); } catch (err) { } });
window.addEventListener('appinstalled', () => { installEvt = null; lsSet('instTipOff', 1); toast(t('inst_done'), 'ok', 6000); try { if (S.route === 'home') rerenderSoon(); } catch (err) { } });
function standalone() { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } }
function installOn() { return window.APP_RT === 'web' && !standalone(); }
function iosDevice() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function inAppBrowser() { return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|everytimeApp|BAND\//i.test(navigator.userAgent); }
async function openInstall() {
  if (!installOn()) return;
  if (installEvt) {
    const e = installEvt; installEvt = null;
    try { await e.prompt(); const r = await e.userChoice; if (r && r.outcome === 'accepted') lsSet('instTipOff', 1); } catch (err) { }
    updateShell(); rerenderSoon(); return;
  }
  const ios = iosDevice(), inApp = inAppBrowser();
  const steps = inApp ? ['inst_inapp1', 'inst_inapp2'] : ios ? ['inst_ios1', 'inst_ios2', 'inst_ios3'] : ['inst_other1', 'inst_other2'];
  // the installed app on iPhone, and any other browser, keep storage of their own: the way back in is the login ID
  const apart = (ios || inApp) && idSupported() && !S.idOff && !!(S.me && S.me.nick);
  const id = apart ? await myLoginId() : null;
  const url = SITE_URL || (location.origin + location.pathname);
  const w = openModal(`<div class="install">
    <h2>${icon('download')} ${t('inst_title')}</h2>
    <p class="lede">${t('inst_sub')}</p>
    <ol class="inst-steps">${steps.map(k => `<li>${t(k)}</li>`).join('')}</ol>
    ${apart ? (id ? `<p class="note ok">${icon('check')} ${t(inApp ? 'inst_id_have_other' : 'inst_id_have', { name: `<b class="mono">${esc(id)}</b>` })}</p>`
      : `<p class="note warn">${icon('warn')} ${t(inApp ? 'inst_id_first_other' : 'inst_id_first')}</p>`) : ''}
    <div class="actions">
      ${apart && !id ? `<button class="btn btn-primary" id="inst-id">${icon('user')}${t('id_create')}</button>` : ''}
      ${inApp && /KAKAOTALK/i.test(navigator.userAgent) ? `<a class="btn btn-line" href="kakaotalk://web/openExternal?url=${encodeURIComponent(url)}">${t('inst_open_ext')}</a>` : ''}
      ${inApp ? `<button class="btn btn-line" data-copy="${esc(url)}">${icon('copy')}${t('inst_copy_link')}</button>` : ''}
      <button class="btn btn-ghost" data-close>${t('close')}</button>
    </div>
  </div>`, { label: t('inst_title') });
  const b = $('#inst-id', w); if (b) b.onclick = () => { closeModal(w); openIdCreate(); };
}
/* Home tip on phones: once someone has a profile, suggest adding the app to the home screen (until dismissed) */
function instTipHTML() {
  if (!installOn() || !touchDevice() || lsGet('instTipOff', 0) || !S.me || !S.me.nick || !myCatches().length) return '';
  if (idSupported() && S.loginId === undefined) return ''; // the login-ID tip may still come first
  if (!installEvt && !iosDevice() && !inAppBrowser()) return ''; // this browser has its own install button, or none at all
  return `<section class="card id-tip inst-tip">${icon('download')}<div><b>${t('inst_tip_title')}</b><p class="muted small">${t('inst_tip_sub')}</p></div><div class="rec-btns"><button class="btn btn-primary btn-sm" data-act="install">${t('inst_btn')}</button><button class="btn btn-ghost btn-xs" data-act="insttip-off" aria-label="${esc(t('close'))}">${icon('close')}</button></div></section>`;
}
