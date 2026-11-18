/* ===== 오늘의 미션 and the visit streak (찌릿 라이브, website). The server picks today's three missions, counts how far
   each is from the game's own tables and pays each one once; opening the app once a day is a visit (5P, 30P every 7th
   day in a row). Nothing here decides a mission is done: the phone only shows what the server says. ===== */
const MS = { st: null, p: null, at: 0, err: null };
const MS_IC = { fish3: 'fish', fish6: 'fish', rare: 'sparkle', big: 'trophy', sell: 'coin', free: 'heart', remote: 'globe', sea: 'wave', fresh: 'wave' };
const msLabel = m => t('dm_' + (m.k === 'fish3' || m.k === 'fish6' ? 'fish' : m.k), { n: m.goal });
const msReady = (st = MS.st) => !st ? 0 : st.missions.filter(m => m.n >= m.goal && !m.got).length + (st.missions.every(m => m.got) && !st.allGot ? 1 : 0);
function msLoad(force) {
  if (typeof lvOn !== 'function' || !lvOn() || !S.me || !S.me.nick) return Promise.resolve(null);
  if (MS.p) return MS.p;
  if (!force && MS.st && nowMs() - MS.at < 60e3 && MS.st.until > nowMs()) return Promise.resolve(MS.st);
  MS.p = APP_AUTH.live.daily().then(r => {
    if (!r || r.err) { MS.err = (r && r.err) || 'x'; return null; }
    const before = MS.st; MS.st = r; MS.at = nowMs(); MS.err = null;
    if (r.visit && r.visit.got > 0) { const v = r.visit; setTimeout(() => toast(t('dm_visit', { n: v.streak, p: v.got }), 'ok', 4200), 900); msBal(r.bal); }
    // a mission that just got done (the fish just landed or sold): say so once
    if (before && before.day === r.day && r.missions.some(m => m.n >= m.goal && !m.got && !before.missions.some(b => b.k === m.k && b.n >= b.goal))) toast(t('dm_done'), 'ok', 4200);
    msPaint(); return r;
  }).catch(e => { MS.err = (e && e.code) || 'x'; return null; }).finally(() => { MS.p = null; });
  return MS.p;
}
function msBal(bal) {
  if (bal == null) return;
  if (typeof LV !== 'undefined' && LV.st) LV.st.bal = bal;
  if (typeof ZP !== 'undefined' && ZP.st) ZP.st.bal = bal;
}
// the missions, the bonus and the streak (the same on the home page and in the live game)
function msBodyHTML(st = MS.st) {
  if (!st) return '';
  const v = st.visit || { streak: 0, to7: 7 }, allDone = st.missions.every(m => m.got);
  const row = m => {
    const done = m.n >= m.goal, pc = Math.round(100 * Math.min(1, m.n / m.goal));
    return `<li class="ms-m${m.got ? ' is-got' : done ? ' is-done' : ''}"><span class="ms-ic">${icon(m.got || done ? 'check' : MS_IC[m.k] || 'target')}</span>
      <span class="ms-txt"><b>${esc(msLabel(m))}</b><span class="ms-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.goal}" aria-valuenow="${m.n}"><i style="width:${pc}%"></i></span><small class="num">${m.n} / ${m.goal}</small></span>
      ${m.got ? `<span class="ms-pts is-got">${t('dm_got')}</span>` : done ? `<button class="btn btn-primary btn-sm ms-claim" data-msclaim="${esc(m.k)}">${t('dm_claim')} +${m.pts}P</button>` : `<span class="ms-pts num">+${m.pts}P</span>`}</li>`;
  };
  return `<div class="ms-streak">
      <span class="ms-flame${v.streak >= 7 ? ' hot' : ''}">${icon('flame')}<b class="num">${v.streak}</b></span>
      <span class="ms-sk"><b>${t('dm_streak', { n: v.streak })}</b><small>${v.to7 === 7 && v.streak > 0 ? t('dm_to7_0') : t('dm_to7', { n: v.to7 })}</small></span>
      <span class="ms-week" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i <= ((v.streak - 1) % 7) + 1 && v.streak > 0 ? 'on' : ''}${i === 7 ? ' d7' : ''}"></i>`).join('')}</span>
    </div>
    <ul class="ms-list">${st.missions.map(row).join('')}</ul>
    <div class="ms-all${st.allGot ? ' is-got' : ''}"><span>${icon('star')}${t('dm_all')}</span>${st.allGot ? `<span class="ms-pts is-got">${t('dm_got')}</span>` : allDone ? `<button class="btn btn-primary btn-sm ms-claim" data-msclaim="all">${t('dm_claim')} +${st.all}P</button>` : `<span class="ms-pts num">+${st.all}P</span>`}</div>
    <p class="ms-foot muted small">${icon('clock')}${t('dm_new_at')} · ${t('dm_streak_p')}</p>`;
}
// on the home page, under the door to the live game
function msCardHTML() {
  if (typeof lvOn !== 'function' || !lvOn() || !S.me || !S.me.nick) return '';
  if (!MS.st && !MS.p && !MS.err) msLoad();
  if (!MS.st) return '';
  return `<section class="card ms-card" aria-label="${esc(t('dm_title'))}"><div class="ms-head"><h2>${icon('target')}${t('dm_title')}</h2>${S.route !== 'live' ? `<a class="btn btn-line btn-sm" href="#live">${icon('live')}${t('dm_go')}</a>` : ''}</div><div data-msbody>${msBodyHTML()}</div></section>`;
}
// everything that shows the missions, again
function msPaint() {
  $$('[data-msbody]').forEach(el => { el.innerHTML = msBodyHTML(); });
  if (S.route === 'home' && !$('.ms-card') && MS.st) rerenderSoon();
  const b = $('#lv-msb'); if (b) { const n = msReady(); b.hidden = !n; b.textContent = n || ''; }
  if (typeof lvHud === 'function' && $('#lv')) lvHud();
}
function msOpen() {
  msLoad().then(st => {
    if (!st) { toast(t(MS.err === 'no_profile' ? 'dm_need_profile' : 'lv_err'), 'warn'); return; }
    openModal(`<div class="ms-modal"><h2>${icon('target')}${t('dm_title')}</h2><div data-msbody>${msBodyHTML()}</div></div>`, { label: t('dm_title') });
  });
}
function msClaim(btn) {
  if (MS.busy) return; MS.busy = true; btn.disabled = true;
  const k = btn.dataset.msclaim;
  APP_AUTH.live.claim(k).then(r => {
    if (!r || r.err) { toast(t('lv_err'), 'warn'); return msLoad(true); }
    if (typeof LVS !== 'undefined') LVS.play('coin');
    toast(t('dm_claimed', { p: r.pts }), 'ok');
    msBal(r.bal);
    if (MS.st) { if (k === 'all') MS.st.allGot = true; else MS.st.missions.forEach(m => { if (m.k === k) m.got = true; }); MS.st.bal = r.bal; }
    msPaint();
  }).catch(() => toast(t('lv_err'), 'warn')).finally(() => { MS.busy = false; btn.disabled = false; });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-msclaim]'); if (b) { e.preventDefault(); msClaim(b); } });
