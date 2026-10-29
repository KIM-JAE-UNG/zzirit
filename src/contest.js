/* ===== Weekly contest (주간 대물 대회): Monday to Sunday, Korean time. Each angler's best confirmed catch of the week
   counts, measured against the usual size of its species, so a big sea bream can beat an average yellowtail.
   Catches registered up to a day after the week still count; after that the week is final. Earlier-day ("past")
   registrations stay out. Worked out from everyone's records on this device; the server keeps nothing extra. ===== */
const DAY_MS = 86400000, KST_MS = 9 * 3600000, WK_GRACE = DAY_MS;
function weekIdx(ms = nowMs()) { return Math.floor((Math.floor((ms + KST_MS) / DAY_MS) + 3) / 7); } // Monday-based weeks
function weekStart(w) { return (w * 7 - 3) * DAY_MS - KST_MS; }
function wkFinal(w) { return nowMs() >= weekStart(w + 1) + WK_GRACE; }
function wkRatio(c) { const sp = SPI[c.sp]; if (!sp || !c.len) return 0; return Math.min(c.len, sp.X * 1.05) / sp.L; }
const _wk = new Map(); let _wkVer = -1;
function weekBoard(w) {
  if (_wkVer !== S.dataVer) { _wk.clear(); _wkVer = S.dataVer; }
  if (_wk.has(w)) return _wk.get(w);
  const t0 = weekStart(w), t1 = weekStart(w + 1);
  const best = new Map();
  for (const [uid, a] of allAnglers()) {
    if (!a || !a.nick || a._local) continue;
    for (const c of a.catches || []) {
      const ts = c.ts || 0;
      if (c.past || ts < t0 || ts >= t1 || (c.at || ts) >= t1 + WK_GRACE || !SPI[c.sp] || !eligible(c, uid)) continue;
      const r = wkRatio(c); if (!r) continue;
      const b = best.get(uid);
      if (!b || r > b.r || (r === b.r && (c.at || ts) < (b.c.at || b.c.ts))) best.set(uid, { uid, a, c, r });
    }
  }
  const rows = [...best.values()].sort((x, y) => y.r - x.r || (x.c.at || x.c.ts) - (y.c.at || y.c.ts));
  rows.forEach((x, i) => { x.rank = i + 1; });
  _wk.set(w, rows); return rows;
}
/* weeks this angler finished in the top 3 / first (final weeks only) — for the achievements */
function wkPlaces(uid, a) {
  const weeks = new Set(); for (const c of (a && a.catches) || []) if (!c.past && c.ts) weeks.add(weekIdx(c.ts));
  let podium = 0, champ = 0;
  for (const w of weeks) { if (!wkFinal(w)) continue; const r = weekBoard(w).find(x => x.uid === uid); if (r && r.rank <= 3) { podium++; if (r.rank === 1) champ++; } }
  return { podium, champ };
}
function wkRange(w) { const o = { month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' }; return `${fmtDate(weekStart(w), o)} – ${fmtDate(weekStart(w + 1) - 1, o)}`; }
function wkRow(x, me) {
  return `<li><button class="wk-row${x.uid === me ? ' me' : ''}" data-catch="${esc(x.uid)}|${esc(x.c.id)}">
    <span class="wk-rank r${x.rank}">${x.rank}</span>${avatar(x.a, 30)}
    <span class="wk-who"><span class="wk-nm"><b>${esc(x.a.nick)}</b>${teamTag(x.uid)}</span><span class="muted small">${esc(nameOf(x.c.sp))} ${lenFmt(x.c.len)}</span></span>
    <span class="wk-r" title="${esc(t('wk_ratio', { r: x.r.toFixed(2) }))}"><b class="num">×${x.r.toFixed(2)}</b></span>
  </button></li>`;
}
function wkCardHTML() {
  if (!S.ready) return '';
  const w = weekIdx(), me = myId(); const rows = weekBoard(w);
  const mine = rows.find(x => x.uid === me);
  const left = Math.max(0, Math.ceil((weekStart(w + 1) - nowMs()) / DAY_MS));
  const last = weekBoard(w - 1)[0];
  return `<section class="card wk-card">
    <div class="sec-head tight"><h2 class="h3">${icon('trophy')}${t('wk_title')}</h2><span class="chip chip-wait">D-${left}</span></div>
    <p class="muted small">${t('wk_sub')}</p>
    ${rows.length ? `<ol class="wk-list">${rows.slice(0, 3).map(x => wkRow(x, me)).join('')}</ol>` : `<p class="wk-empty">${icon('fish')} ${t('wk_empty')}</p>`}
    <div class="wk-foot">
      <span class="small">${mine ? (mine.rank > 3 ? t('wk_mine', { rank: mine.rank, fish: `${esc(nameOf(mine.c.sp))} ${lenFmt(mine.c.len)}` }) : '') : S.me && S.me.nick ? t('wk_mine_none') : ''}</span>
      ${last ? `<span class="small muted">${t('wk_last')}: <b>${esc(last.a.nick)}</b> · ${esc(nameOf(last.c.sp))} ${lenFmt(last.c.len)}</span>` : ''}
      <button class="btn btn-line btn-sm" data-act="weekly">${t('wk_all')}</button>
    </div>
  </section>`;
}
function openWeekly() {
  const w = weekIdx(), me = myId(); const rows = weekBoard(w).slice(0, 20);
  const past = [1, 2, 3, 4].map(k => ({ w: w - k, rows: weekBoard(w - k).slice(0, 3), fin: wkFinal(w - k) })).filter(x => x.rows.length);
  const m = openModal(`<div class="wk-modal">
    <h2>${icon('trophy')} ${t('wk_title')}</h2>
    <p class="muted small">${wkRange(w)} · ${t('wk_sub')}</p>
    ${rows.length ? `<ol class="wk-list">${rows.map(x => wkRow(x, me)).join('')}</ol>` : `<p class="wk-empty">${icon('fish')} ${t('wk_empty')}</p>`}
    ${past.length ? `<h3 class="h4 wk-past-h">${t('wk_past')}</h3>${past.map(p => `<div class="wk-past"><p class="lbl">${wkRange(p.w)}${p.fin ? '' : ` <span class="chip chip-wait">${t('wk_wait')}</span>`}</p><ol class="wk-list sm">${p.rows.map(x => wkRow(x, me)).join('')}</ol></div>`).join('')}` : ''}
    <details class="fs-how"><summary>${t('fs_how_q')}</summary><p class="small muted">${t('wk_how')}</p></details>
  </div>`, { label: t('wk_title') });
  m.addEventListener('click', e => { const b = e.target.closest('[data-catch]'); if (!b) return; const i = b.dataset.catch.indexOf('|'); closeModal(m); openCatch(b.dataset.catch.slice(0, i), b.dataset.catch.slice(i + 1)); });
}
