/* ===== Achievements (업적): small goals that come from confirmed catches and taking part (friends, posts, points).
   Only catches the AI or the operator confirmed count, so they can't be faked with made-up entries. ===== */
const BADGES = [
  { id: 'first', ic: 'fish', need: s => [s.n, 1] },
  { id: 'n10', ic: 'fish', need: s => [s.n, 10] },
  { id: 'n50', ic: 'fish', need: s => [s.n, 50] },
  { id: 'sp5', ic: 'book', need: s => [s.species, 5] },
  { id: 'sp15', ic: 'book', need: s => [s.species, 15] },
  { id: 'sp30', ic: 'book', need: s => [s.species, 30] },
  { id: 'rel1', ic: 'heart', need: s => [s.rel, 1] },
  { id: 'rel10', ic: 'heart', need: s => [s.rel, 10] },
  { id: 'big50', ic: 'trophy', need: s => [s.maxLen, 50] },
  { id: 'big80', ic: 'trophy', need: s => [s.maxLen, 80] },
  { id: 'trophy', ic: 'sparkle', need: s => [s.trophy, 1] },
  { id: 'night', ic: 'moon', need: s => [s.night, 1] },
  { id: 'dawn', ic: 'sun', need: s => [s.dawn, 1] },
  { id: 'feat', ic: 'star', need: s => [s.feat, 1] },
  { id: 'both', ic: 'globe', need: s => [(s.sea ? 1 : 0) + (s.fresh ? 1 : 0), 2] },
  { id: 'days5', ic: 'clock', need: s => [s.days, 5] },
  { id: 'pts1k', ic: 'medal', need: s => [s.pts, 1000] },
  { id: 'friends3', ic: 'users', need: s => [s.friends, 3] },
  { id: 'posts3', ic: 'board', need: s => [s.posts, 3] },
  { id: 'spot1', ic: 'pin', need: s => [s.points, 1] },
  { id: 'podium', ic: 'trophy', need: s => [s.podium, 1] },
  { id: 'champ', ic: 'trophy', need: s => [s.champ, 1] }
];
const featMemo = new Map(); // month → that month's featured species (an achievement stays once earned)
function featuredIn(ts) { const d = new Date(ts); const k = monthKey(d); if (!featMemo.has(k)) featMemo.set(k, featuredSpecies(d)); return featMemo.get(k); }
function badgeStats(a, uid) {
  const cs = ((a && a.catches) || []).filter(c => eligible(c, uid));
  const s = { n: cs.length, species: 0, rel: 0, maxLen: 0, trophy: 0, night: 0, dawn: 0, feat: 0, sea: false, fresh: false, days: 0, pts: 0, friends: 0, posts: 0, points: 0 };
  const sp = new Set(), days = new Set();
  for (const c of cs) {
    if (SPI[c.sp]) sp.add(c.sp);
    if (c.rel) s.rel++;
    s.maxLen = Math.max(s.maxLen, c.len || 0);
    const k = SPI[c.sp]; if (k && c.len >= k.L * 1.5) s.trophy++;
    const h = new Date(c.ts).getHours(); if (h >= 20 || h < 4) s.night++; else if (h >= 4 && h < 7) s.dawn++;
    if (!c.past && featuredIn(c.ts).includes(c.sp)) s.feat++;
    if (k ? k.w === 'F' : c.sea === false) s.fresh = true; else s.sea = true;
    days.add(new Date(c.ts).toDateString());
    s.pts += c.sc || 0;
  }
  s.species = sp.size; s.days = days.size;
  Object.assign(s, wkPlaces(uid, a)); // weekly contest: top 3 / first
  if (uid === myId()) {
    s.friends = frLists().friends.length;
    s.posts = [...boardIndex().posts.values()].filter(p => p.uid === uid).length;
    s.points = typeof ptLists === 'function' ? ptLists().mine.length : 0;
  } else {
    s.friends = typeof friendIdsOf === 'function' ? friendIdsOf(uid).length : 0;
    s.posts = [...boardIndex().posts.values()].filter(p => p.uid === uid).length;
  }
  return s;
}
function badgesOf(a, uid) {
  const s = badgeStats(a, uid);
  const mine = uid === myId(); // someone else's saved points are private, so that one only shows on my own page
  return BADGES.filter(b => mine || b.id !== 'spot1').map(b => { const [v, goal] = b.need(s); return Object.assign({}, b, { v: Math.min(v, goal), goal, got: v >= goal }); });
}
function badgesHTML(a, uid) {
  const list = badgesOf(a, uid); const got = list.filter(b => b.got).length;
  return `<div class="bdg-head"><p class="muted">${t('bdg_count', { n: got, all: list.length })}</p></div>
  <ul class="bdg-grid">${list.map(b => `<li class="bdg${b.got ? ' got' : ''}" title="${esc(t('bdg_' + b.id + '_d'))}">
    <span class="bdg-ic">${icon(b.ic)}</span><b>${t('bdg_' + b.id)}</b><span class="muted small">${t('bdg_' + b.id + '_d')}</span>
    ${b.got ? `<span class="chip chip-ok">${icon('check')}${t('bdg_done')}</span>` : `<span class="bdg-bar" aria-label="${b.v}/${b.goal}"><i style="width:${Math.round(b.v / b.goal * 100)}%"></i></span><span class="muted small num">${fmtN(Math.floor(b.v))} / ${fmtN(b.goal)}</span>`}
  </li>`).join('')}</ul>`;
}
/* a new achievement: say so once (and keep it in the notifications) */
function badgeCheck() {
  if (!S.me || !S.me.nick || S.mode !== 'shared' || !notiReady()) return;
  const now = badgesOf(S.me, myId()).filter(b => b.got).map(b => b.id);
  const was = lsGet('badges', null);
  lsSet('badges', now);
  if (!Array.isArray(was)) return; // first look: just remember
  const fresh = now.filter(id => !was.includes(id));
  if (!fresh.length) return;
  toast(t('bdg_new', { name: fresh.map(id => t('bdg_' + id)).join(', ') }), 'ok', 6000);
  const list = notiList(); const have = new Set(list.map(x => x.id));
  for (const id of fresh) if (!have.has('b:' + id)) list.push({ id: 'b:' + id, k: 'badge', t: nowMs(), badge: id });
  lsSet('noti', list.slice(-NOTI_MAX)); notiBadge();
}
