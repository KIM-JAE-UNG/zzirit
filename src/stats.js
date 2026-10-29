/* ===== My catch statistics (내 조과 통계): when, where in the day, with what bait and which fish I catch, plus my best
   per species. Worked out from my own records; rejected entries are left out (log-only ones stay — they are real
   days on the water). Plain HTML bars in the app's chart blue; every chart has a "numbers" table too. ===== */
const TOD = [['dawn', 4, 7], ['morning', 7, 11], ['midday', 11, 15], ['afternoon', 15, 18], ['evening', 18, 21], ['night', 21, 28]];
function todOf(ts) { let h = new Date(ts).getHours(); if (h < 4) h += 24; return TOD.findIndex(([, a, b]) => h >= a && h < b); }
function statCatches() { const me = myId(); return myCatches().filter(c => catchState(me, c) !== 'no' || logOnly(me, c)); }
function statsData(cs) {
  const now = new Date(); const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), v: 0 }); }
  const tod = TOD.map(([k]) => ({ k, v: 0 }));
  const sp = new Map(), bait = new Map(), best = new Map();
  let rel = 0, big = null;
  for (const c of cs) {
    const d = new Date(c.ts || c.at || 0);
    const mi = months.findIndex(x => x.y === d.getFullYear() && x.m === d.getMonth()); if (mi >= 0) months[mi].v++;
    const ti = todOf(c.ts || c.at || 0); if (ti >= 0) tod[ti].v++;
    sp.set(c.sp, (sp.get(c.sp) || 0) + 1);
    const label = String(c.bait || '').trim().replace(/\s+/g, ' '); const bk = label.toLowerCase();
    if (bk) { const e = bait.get(bk) || { label, v: 0 }; e.v++; bait.set(bk, e); }
    if (c.rel) rel++;
    const pb = best.get(c.sp); if (!pb || (c.len || 0) > (pb.len || 0)) best.set(c.sp, c);
    // the biggest for its kind (length against the species' usual size), so a big sea bream beats an average yellowtail
    const r = SPI[c.sp] && c.len ? c.len / SPI[c.sp].L : 0; if (r && (!big || r > big.r)) big = { c, r };
  }
  return {
    n: cs.length, species: sp.size, rel, big, months, tod,
    sp: [...sp].map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v),
    bait: [...bait.values()].sort((a, b) => b.v - a.v),
    best: [...best.values()].sort((a, b) => (b.len || 0) - (a.len || 0))
  };
}
/* columns (single series): the tallest one carries its number, the rest show it on hover / focus and in the table */
function vzCols(items, title) {
  const max = Math.max(0, ...items.map(x => x.v));
  const peak = max > 0 ? items.findIndex(x => x.v === max) : -1;
  return `<div class="vz vz-colchart" role="img" aria-label="${esc(title + ': ' + items.map(x => `${x.label} ${x.v}`).join(', '))}">
    <div class="vz-plot" style="--n:${items.length}">${items.map((x, i) => `<span class="vz-col" tabindex="0" data-tip="${esc(x.label)}|${esc(t('st_n', { n: fmtN(x.v) }))}" style="--h:${max ? Math.round(x.v / max * 100) : 0}%"><i${x.v ? '' : ' hidden'}></i>${i === peak ? `<b>${fmtN(x.v)}</b>` : ''}</span>`).join('')}</div>
    <div class="vz-axis" style="--n:${items.length}" aria-hidden="true">${items.map(x => `<span>${esc(x.short || x.label)}</span>`).join('')}</div>
  </div>
  <details class="vz-table"><summary>${t('st_table')}</summary><table><tbody>${items.map(x => `<tr><th scope="row">${esc(x.label)}</th><td class="num">${fmtN(x.v)}</td></tr>`).join('')}</tbody></table></details>`;
}
/* horizontal bars for ranked lists: the number sits at each bar's end (short lists, so every row is labelled) */
function vzBars(rows) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<ul class="vz vz-hbars">${rows.map(r => `<li><span class="vz-hl">${r.html || esc(r.label)}</span><span class="vz-ht"><i style="width:${Math.max(2, Math.round(r.v / max * 100))}%"></i></span><b class="vz-hv num">${fmtN(r.v)}</b></li>`).join('')}</ul>`;
}
function statsHTML() {
  const cs = statCatches();
  if (!cs.length) return `<div class="empty card big"><h2>${t('st_empty')}</h2><p class="muted">${t('log_empty_sub')}</p><a class="btn btn-primary" href="#scan">${t('cta_scan')}</a></div>`;
  const s = statsData(cs);
  const topTod = s.tod.slice().sort((a, b) => b.v - a.v)[0];
  const monthShort = x => { try { return new Date(x.y, x.m, 1).toLocaleDateString(locale(), { month: 'short' }); } catch (e) { return String(x.m + 1); } };
  const monthLong = x => fmtDate(new Date(x.y, x.m, 1).getTime(), { year: 'numeric', month: 'long' });
  return `<div class="stats">
    <div class="stats4 card">
      <div><span class="num">${fmtN(s.n)}</span><span>${t('catches')}</span></div>
      <div><span class="num">${fmtN(s.species)}</span><span>${t('species_n')}</span></div>
      <div><span class="num">${fmtN(Math.round(s.rel / s.n * 100))}%</span><span>${t('st_rel')}</span></div>
      <div>${s.big ? `<span class="num">${lenFmt(s.big.c.len)}</span><span>${t('st_big', { sp: esc(nameOf(s.big.c.sp)) })}</span>` : `<span class="num">—</span><span>${t('st_big_none')}</span>`}</div>
    </div>
    ${topTod && topTod.v ? `<p class="st-insight">${icon('sparkle')}<span>${t('st_insight_tod', { tod: `<b>${t('tod_' + topTod.k)}</b>` })}${s.bait[0] ? ` · ${t('st_insight_bait', { bait: `<b>${esc(s.bait[0].label)}</b>` })}` : ''}</span></p>` : ''}
    <div class="st-grid">
      <section class="card"><h2 class="h3">${t('st_months')}</h2>${vzCols(s.months.map(x => ({ label: monthLong(x), short: monthShort(x), v: x.v })), t('st_months'))}</section>
      <section class="card"><h2 class="h3">${t('st_tod')}</h2>${vzCols(s.tod.map(x => ({ label: t('tod_' + x.k), v: x.v })), t('st_tod'))}<p class="hint">${t('st_tod_hint')}</p></section>
      <section class="card"><h2 class="h3">${t('st_species')}</h2>${vzBars(s.sp.slice(0, 6).map(x => ({ html: `<button class="link" data-sp="${esc(x.id)}">${esc(nameOf(x.id))}</button>`, v: x.v })))}</section>
      <section class="card"><h2 class="h3">${t('st_bait')}</h2>${s.bait.length ? vzBars(s.bait.slice(0, 6).map(x => ({ label: x.label, v: x.v }))) : `<p class="muted">${t('st_bait_none')}</p>`}</section>
    </div>
    <section class="card"><h2 class="h3">${icon('trophy')}${t('st_best')}</h2>
      <table class="st-best"><thead><tr><th scope="col">${t('species')}</th><th scope="col">${t('st_len')}</th><th scope="col">${t('st_when')}</th></tr></thead>
      <tbody>${s.best.slice(0, 12).map(c => `<tr><td><button class="link" data-catch="${esc(myId())}|${esc(c.id)}">${esc(nameOf(c.sp))}</button></td><td class="num">${lenFmt(c.len)}</td><td class="muted">${fmtDate(c.ts || c.at)}</td></tr>`).join('')}</tbody></table>
    </section>
    <p class="hint">${t('st_note')}</p>
  </div>`;
}
/* one tooltip for every column chart: the value first, then what it is (text only, never HTML) */
(function vzTips() {
  let tip = null;
  const show = el => {
    if (!tip) { tip = document.createElement('div'); tip.className = 'vz-tip'; tip.setAttribute('role', 'tooltip'); tip.innerHTML = '<b></b><span></span>'; document.body.appendChild(tip); }
    const [label, val] = String(el.dataset.tip || '').split('|');
    tip.firstChild.textContent = val || ''; tip.lastChild.textContent = label || '';
    const r = el.getBoundingClientRect(); tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - h - 8) + 'px';
  };
  const hide = () => { if (tip) tip.style.display = 'none'; };
  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('.vz-col[data-tip]'); if (el) show(el); else hide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.vz-col[data-tip]'); if (el) show(el); else hide(); });
  document.addEventListener('focusout', hide);
  addEventListener('scroll', hide, { passive: true });
})();
