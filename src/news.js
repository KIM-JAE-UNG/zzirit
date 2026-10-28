/* ===== Today's fishing buzz: community highlights ("ZZIRIT flash") + daily world headlines ===== */
let _hlCache = { v: -1 };
function zzHighlights(limit = 12) {
  if (_hlCache.v === S.dataVer && _hlCache.limit === limit) return _hlCache.list;
  const now = nowMs(), wk = now - 7 * 864e5, day = now - 864e5;
  const firsts = new Map(); const pool = [];
  for (const [uid, a] of allAnglers()) {
    if (!a || a._local || !a.nick) continue;
    for (const c of a.catches || []) {
      if (!SPI[c.sp] || !c.len || !eligible(c, uid)) continue;
      const at = c.at || c.ts || 0;
      const f = firsts.get(c.sp); if (!f || at < f.at) firsts.set(c.sp, { c, at });
      if (at >= wk) pool.push({ uid, a, c, at });
    }
  }
  const stories = [];
  for (const h of pool) {
    const sp = SPI[h.c.sp]; const rel = h.c.len / sp.L, rec = h.c.len / sp.X;
    const cands = [{ k: 'big', score: 40 + rel * 20 + (h.at > day ? 8 : 0) }];
    if (rec >= .8) cands.push({ k: 'record', score: 92 + rec * 10, pct: Math.round(rec * 100) });
    if (sp.r >= 5) cands.push({ k: 'rare', score: 86 });
    const f = firsts.get(h.c.sp); if (f && f.c === h.c) cands.push({ k: 'first', score: 90 });
    if (h.c.rel && rel >= 1.05) cands.push({ k: 'release', score: 58 + rel * 5 });
    const best = cands.sort((x, y) => y.score - x.score)[0];
    stories.push(Object.assign({}, h, best, { rel }));
  }
  const bigs = stories.filter(s => s.k === 'big').sort((x, y) => y.rel - x.rel);
  if (bigs[0]) { bigs[0].k = 'top'; bigs[0].score += 30; }
  let list = stories.filter(s => s.k !== 'big' || bigs.indexOf(s) < 4);
  const lead = teamIndex().ranked[0];
  if (lead && lead.pts > 0) list.push({ k: 'team', score: 62, at: now, team: lead });
  list = list.sort((x, y) => y.score - x.score || y.at - x.at).slice(0, limit);
  _hlCache = { v: S.dataVer, limit, list };
  return list;
}
function hlText(h) {
  const nick = esc(h.a ? h.a.nick : ''), sp = h.c ? esc(nameOf(h.c.sp)) : '', len = h.c ? lenFmt(h.c.len) : '';
  if (h.k === 'team') return t('hl_team', { team: esc(h.team.t.name), pts: fmtN(h.team.pts) });
  return t('hl_' + h.k, { nick, sp, len, pct: h.pct || 0 });
}
function hlItem(h) {
  const data = h.k === 'team' ? `data-team="${esc(h.team.id)}"` : `data-catch="${esc(h.uid)}|${esc(h.c.id)}"`;
  const art = h.k === 'team' ? teamEmblem(h.team.t, 40) : `<span class="hl-ph" data-ph="${esc(h.uid)}|${esc(h.c.id)}"><img src="${FD.thumb(SPI[h.c.sp] || SP[0], 120, 70)}" alt=""></span>`;
  return `<li><button class="hl-item" ${data}>${art}<span class="hl-txt"><span class="hl-k hlk-${h.k}">${t('hlk_' + h.k)}</span><b>${hlText(h)}</b><span class="muted small">${ago(h.at)}</span></span></button></li>`;
}
function newsFor(lang) {
  const all = (S.news || []).filter(n => n && n.title && /^https?:\/\//.test(n.link || ''));
  let list = all.filter(n => n.lang === lang);
  if (list.length < 3) list = list.concat(all.filter(n => n.lang === (lang === 'ko' ? 'en' : 'ko')));
  const seen = new Set();
  return list.filter(n => { const k = n.title.toLowerCase().slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => (y.score || 0) - (x.score || 0) || new Date(y.pub || 0) - new Date(x.pub || 0));
}
function newsItem(n) {
  const when = n.pub ? ago(new Date(n.pub).getTime()) : '';
  return `<li><a class="news-item" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer"><span class="muted small">${esc(n.source || '')}${when ? ' · ' + when : ''}</span><b>${esc(n.title)}</b></a></li>`;
}
function newsCardHTML() {
  const web = window.APP_RT === 'web';
  S.newsTab = web ? (S.newsTab || 'zz') : 'zz';
  const hl = zzHighlights(4);
  const world = web ? newsFor(S.lang).slice(0, 4) : [];
  if (web) newsMaybeRefresh();
  const zzBody = hl.length ? `<ul class="hl-list">${hl.map(hlItem).join('')}</ul>` : `<div class="empty"><p>${t('hl_empty')}</p><a class="btn btn-line btn-sm" href="#scan">${icon('camera')}${t('cta_scan')}</a></div>`;
  const wBody = world.length ? `<ul class="news-list">${world.map(newsItem).join('')}</ul>` : `<div class="empty"><p class="muted">${t('news_empty_world')}</p></div>`;
  return `<section class="card news-card">
    <div class="sec-head tight"><h2 class="h3">${icon('sparkle')}${t('news_title')}</h2>${web ? `<div class="seg seg-sm" role="tablist">${['zz', 'world'].map(k => `<button role="tab" aria-pressed="${S.newsTab === k}" data-newstab="${k}">${t('news_tab_' + k)}</button>`).join('')}</div>` : ''}</div>
    ${S.newsTab === 'world' ? wBody : zzBody}
    <div class="news-foot"><button class="link small" data-news="more">${t('news_more')}</button>${S.newsTab === 'world' ? `<span class="muted small">${t('news_note')}</span>` : ''}</div>
  </section>`;
}
function openNews() {
  const web = window.APP_RT === 'web';
  const render = () => {
    const tab = S.newsTab || 'zz';
    const hl = zzHighlights(20), world = web ? newsFor(S.lang).slice(0, 30) : [];
    return `<div class="news-modal"><h2>${icon('sparkle')} ${t('news_title')}</h2>
      ${web ? `<div class="seg seg-sm" role="tablist">${['zz', 'world'].map(k => `<button role="tab" aria-pressed="${tab === k}" data-nm="${k}">${t('news_tab_' + k)}</button>`).join('')}</div>` : ''}
      ${tab === 'world' ? (world.length ? `<ul class="news-list">${world.map(newsItem).join('')}</ul><p class="hint">${t('news_note')}</p>` : `<p class="muted">${t('news_empty_world')}</p>`)
        : (hl.length ? `<ul class="hl-list">${hl.map(hlItem).join('')}</ul>` : `<p class="muted">${t('hl_empty')}</p>`)}</div>`;
  };
  const w = openModal(render(), { wide: true, label: t('news_title') });
  const body = $('.modal-body', w);
  hydratePhotos(body);
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-nm]'); if (b) { S.newsTab = b.dataset.nm; body.innerHTML = render(); hydratePhotos(body); return; }
    const c = e.target.closest('[data-catch]'); if (c) { const [u, id] = c.dataset.catch.split('|'); openCatch(u, id); return; }
    const tm = e.target.closest('[data-team]'); if (tm) { closeModal(w); openTeam(tm.dataset.team); }
  });
}
let _newsAsked = 0;
function newsMaybeRefresh() {
  if (!window.APP_AUTH || !window.APP_AUTH.news || nowMs() - _newsAsked < 30 * 60000) return;
  const newest = Math.max(0, ...(S.news || []).map(n => new Date(n.fetched_at || 0).getTime()));
  if (S.news && S.news.length && nowMs() - newest < 8 * 3600000) return;
  _newsAsked = nowMs();
  setTimeout(() => { window.APP_AUTH.news.refresh().catch(() => { }); }, 1500);
}
