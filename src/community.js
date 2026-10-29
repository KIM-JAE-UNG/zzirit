/* ===== Community: board (게시판) and teams (팀) ===== */
function needShared() {
  if (!S.me || !S.me.nick) { ensureProfile(); return true; }
  if (S.mode !== 'shared' || !S.uid) { toast(t('fr_need_shared'), 'info', 4800); return true; }
  return false;
}
function armed(btn, label) {
  // two-step confirm for destructive buttons
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; btn.classList.add('danger'); const old = btn.innerHTML; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove('danger'); btn.innerHTML = old; } }, 4000);
  return false;
}
function catchOf(uid, cid) { const a = anglerOf(uid); return a && (a.catches || []).find(c => c.id === cid) || null; }
function catchMini(uid, c) {
  if (!c) return '';
  return `<button class="post-catch" data-catch="${esc(uid)}|${esc(c.id)}"><span class="pc-ph" data-ph="${esc(uid)}|${esc(c.id)}"><img src="${FD.thumb(SPI[c.sp] || SP[0], 160, 90)}" alt=""></span><span><b>${esc(nameOf(c.sp))}</b> <span class="num">${lenFmt(c.len)}</span><br><span class="muted small">${fmtDate(c.ts)} · +${fmtN(c.sc || 0)} pt</span></span></button>`;
}

/* ---------- Board ---------- */
function bdCard(p) {
  const a = anglerOf(p.uid) || { nick: '?' };
  const c = p.ref ? catchOf(p.uid, p.ref) : null;
  const n = p.cmts.filter(x => !x.hidden).length;
  return `<li><button class="bd-card${p.hidden ? ' is-hidden' : ''}" data-post="${esc(p.key)}">
    <span class="bd-main">
      <span class="bd-meta"><span class="chip chip-cat cat-${esc(p.cat)}">${t('bdc_' + p.cat)}</span>${p.hidden ? `<span class="chip chip-closed">${t('bd_hidden_chip')}</span>` : ''}${S.isOwner && p.reps ? `<span class="chip chip-review">${icon('warn')}${p.reps}</span>` : ''}</span>
      <b class="bd-title">${esc(p.title)}</b>
      <span class="bd-ex">${esc(String(p.body || '').replace(/\s+/g, ' ').slice(0, 140))}</span>
      <span class="bd-by">${avatar(a, 22)}${nickHTML(a)}${lvMini(a, p.uid)}${teamTag(p.uid)}<span class="muted"> · ${ago(p.ts)}</span></span>
    </span>
    ${c ? `<span class="bd-ph" data-ph="${esc(p.uid)}|${esc(c.id)}"><img src="${FD.thumb(SPI[c.sp] || SP[0], 160, 90)}" alt=""></span>` : ''}
    <span class="bd-stats"><span class="${p.likes.has(myId()) ? 'on' : ''}">${icon('heart')}${p.likes.size}</span><span>${icon('chat')}${n}</span></span>
  </button></li>`;
}
VIEWS.board = {
  render(el) {
    S.bd = S.bd || { cat: 'all', sort: 'new', q: '' };
    const bd = S.bd; const shared = S.mode === 'shared';
    el.innerHTML = `
    <div class="page board">
      <header class="page-head bd-head">
        <div><h1>${t('bd_title')}</h1><p class="lede">${t('bd_sub')}</p></div>
        <button class="btn btn-primary" data-bd="write">${icon('plus')}${t('bd_write')}</button>
      </header>
      ${shared ? '' : `<p class="note">${icon('info')} ${t('bd_local_note')}</p>`}
      ${noticeCardHTML()}
      <div class="bd-bar">
        <div class="chip-row" role="group" aria-label="${esc(t('bd_f_cat'))}">${['all', ...BD_CATS].map(c => `<button class="chip chip-tab" aria-pressed="${bd.cat === c}" data-bdcat="${c}">${t('bdc_' + c)}</button>`).join('')}${S.me && S.me.nick ? `<button class="chip chip-tab chip-mine" aria-pressed="${!!bd.mine}" data-bdmine>${icon('user')}${t('bd_mine')}</button>` : ''}</div>
        <div class="bd-tools">
          <div class="seg seg-sm" role="group">${['new', 'hot'].map(s => `<button aria-pressed="${bd.sort === s}" data-bdsort="${s}">${t('bd_sort_' + s)}</button>`).join('')}</div>
          <input class="search" id="bd-q" type="search" placeholder="${esc(t('bd_search'))}" value="${esc(bd.q)}" autocomplete="off">
        </div>
      </div>
      <div id="bd-list"></div>
    </div>`;
    this.renderList(el);
    const q = $('#bd-q', el);
    q.addEventListener('input', debounce(() => { S.bd.q = q.value; this.renderList(el); }, 180));
  },
  renderList(el) {
    const box = $('#bd-list', el); if (!box) return;
    const list = boardList(Object.assign({}, S.bd, { mineOnly: !!S.bd.mine && !!(S.me && S.me.nick) }));
    box.innerHTML = list.length ? `<ul class="bd-list">${list.slice(0, 120).map(bdCard).join('')}</ul>` : `
      <div class="empty card big">${icon('board', 'big')}<h2>${t(S.bd.q || S.bd.cat !== 'all' || S.bd.mine ? 'bd_none_found' : 'bd_empty')}</h2><p class="muted">${t('bd_empty_sub')}</p><button class="btn btn-primary" data-bd="write">${icon('plus')}${t('bd_write')}</button></div>`;
    hydratePhotos(box);
  }
};
function recentCount(arr, ms) { const t0 = nowMs() - ms; return arr.filter(x => (x.ts || 0) >= t0).length; }
function openWrite(key) {
  if (needShared()) return;
  const B = myBoardDoc();
  const edit = key ? B.posts.find(p => S.uid + '|' + p.id === key) : null;
  if (key && !edit) return;
  const cs = myCatches().slice().sort((a, b) => b.ts - a.ts).slice(0, 60);
  const cat0 = edit ? edit.cat : (S.bd && S.bd.cat !== 'all' ? S.bd.cat : 'catch');
  const w = openModal(`
    <form class="write" id="pw-form" novalidate>
      <h2>${t(edit ? 'bd_edit' : 'bd_write')}</h2>
      <div class="chip-row" role="radiogroup" aria-label="${esc(t('bd_f_cat'))}">${BD_CATS.map(c => `<label class="chip chip-tab"><input type="radio" name="pw-cat" value="${c}" ${cat0 === c ? 'checked' : ''}><span>${t('bdc_' + c)}</span></label>`).join('')}</div>
      <div class="field"><label for="pw-title">${t('bd_f_title')}</label><input id="pw-title" maxlength="${BD_MAX.title}" value="${esc(edit ? edit.title : '')}" autocomplete="off"></div>
      <div class="field"><label for="pw-body">${t('bd_f_body')}</label><textarea id="pw-body" rows="8" maxlength="${BD_MAX.body}" placeholder="${esc(t('bd_f_body_ph'))}">${esc(edit ? edit.body : '')}</textarea><small class="muted" id="pw-count"></small></div>
      ${cs.length ? `<div class="field"><label for="pw-ref">${t('bd_f_ref')}</label><select id="pw-ref"><option value="">${t('bd_f_ref_none')}</option>${cs.map(c => `<option value="${esc(c.id)}" ${edit && edit.ref === c.id ? 'selected' : ''}>${esc(nameOf(c.sp))} ${lenFmt(c.len)} · ${fmtDate(c.ts)}</option>`).join('')}</select></div>` : ''}
      <p class="hint">${icon('shield')} ${t('bd_rules')}</p>
      <p class="err" id="pw-err" hidden></p>
      <div class="actions"><button class="btn btn-primary" type="submit">${icon('send')}${t(edit ? 'bd_save' : 'bd_post')}</button><button class="btn btn-ghost" type="button" data-close>${t('cancel')}</button></div>
    </form>`, { label: t('bd_write') });
  const body = $('#pw-body', w), cnt = $('#pw-count', w);
  const upd = () => { cnt.textContent = `${body.value.length} / ${BD_MAX.body}`; }; body.addEventListener('input', upd); upd();
  $('#pw-form', w).onsubmit = async e => {
    e.preventDefault();
    const err = $('#pw-err', w); err.hidden = true;
    const title = $('#pw-title', w).value.trim().slice(0, BD_MAX.title);
    const text = body.value.trim().slice(0, BD_MAX.body);
    const cat = ($('input[name="pw-cat"]:checked', w) || {}).value || 'free';
    const ref = $('#pw-ref', w) ? $('#pw-ref', w).value || null : null;
    if (title.length < 2) { err.textContent = t('bd_err_title'); err.hidden = false; return; }
    if (text.length < 2) { err.textContent = t('bd_err_body'); err.hidden = false; return; }
    if (edit) Object.assign(edit, { cat, title, body: text, ref, upd: nowMs() });
    else {
      if (B.posts.length >= BD_MAX.posts) { err.textContent = t('bd_err_limit', { n: BD_MAX.posts }); err.hidden = false; return; }
      if (recentCount(B.posts, 10 * 60000) >= 5) { err.textContent = t('bd_err_slow'); err.hidden = false; return; }
      B.posts.push({ id: rid(10), cat, title, body: text, ref, rg: homeRegion(), ts: nowMs() });
    }
    await store.saveBoard();
    closeModal(w); toast(t(edit ? 'bd_updated' : 'bd_posted'));
    if (!edit) { S.bd = Object.assign(S.bd || {}, { sort: 'new' }); if (S.route !== 'board') location.hash = 'board'; }
    rerender();
  };
}
function openPost(key) {
  const w = openModal('<div class="post" id="post-box"></div>', { wide: true, label: t('bd_title'), onClose: () => { if (S.openPost && S.openPost.w === w) S.openPost = null; } });
  const render = () => {
    const p = boardIndex().posts.get(key); const box = $('#post-box', w); if (!box) return;
    if (!p || (p.hidden && !S.isOwner && p.uid !== myId())) { box.innerHTML = `<div class="empty"><p class="muted">${t('bd_gone')}</p></div>`; return; }
    const a = anglerOf(p.uid) || { nick: '?' }; const mine = p.uid === myId(); const liked = p.likes.has(myId());
    const c = p.ref ? catchOf(p.uid, p.ref) : null;
    const cmts = p.cmts.filter(x => !x.hidden || S.isOwner || x.uid === myId());
    const draft = $('#pc-body', w) ? $('#pc-body', w).value : '';
    const editId = S.openPost && S.openPost.key === key ? S.openPost.edit : null;
    const eta = $('.cmt-edit-ta', w); const editDraft = eta ? eta.value : null; // what is being typed survives a refresh
    box.innerHTML = `
      <p class="eyebrow"><span class="chip chip-cat cat-${esc(p.cat)}">${t('bdc_' + p.cat)}</span> ${fmtDT(p.ts)}${p.upd && p.upd > p.ts + 60000 ? ' · ' + t('bd_edited') : ''}</p>
      <h2>${esc(p.title)}</h2>
      ${p.hidden ? `<p class="note">${icon('warn')} ${t('bd_hidden_note')}</p>` : ''}
      <button class="post-by" data-seauid="${esc(p.uid)}">${avatar(a, 34)}<span>${nickHTML(a)}${lvMini(a, p.uid)}${teamTag(p.uid)} <span class="muted">${flag(a.cc)} ${esc(regionName(p.rg || a.home || 'KS'))}</span></span></button>
      <div class="post-body">${esc(p.body)}</div>
      ${catchMini(p.uid, c)}
      <div class="post-acts">
        <button class="btn btn-sm ${liked ? 'btn-primary' : 'btn-line'}" id="pl-like" aria-pressed="${liked}">${icon('heart')}${t('bd_like')} ${p.likes.size}</button>
        ${mine ? `<button class="btn btn-ghost btn-sm" id="pl-edit">${t('bd_edit')}</button><button class="btn btn-ghost btn-sm" id="pl-del">${icon('trash')}${t('delete')}</button>` : `<button class="btn btn-ghost btn-sm" id="pl-rep">${icon('warn')}${t('bd_report')}</button>`}
        ${S.isOwner ? `<button class="btn btn-ghost btn-sm" id="pl-hide">${t(p.hidden ? 'bd_unhide' : 'bd_hide')}</button>${mine ? '' : `<button class="btn btn-ghost btn-sm" id="pl-adel">${icon('trash')}${t('bd_admin_del')}</button>`}` : ''}
      </div>
      <section class="cmts">
        <h3 class="h4">${icon('chat')}${t('bd_cmts', { n: cmts.filter(x => !x.hidden).length })}</h3>
        ${cmts.length ? `<ul class="cmt-list">${cmts.map(x => { const ca = anglerOf(x.uid) || { nick: '?' }; const own = x.uid === myId(); const editing = own && editId === x.id; return `<li class="${x.hidden ? 'is-hidden' : ''}"><button class="cmt-who" data-seauid="${esc(x.uid)}">${avatar(ca, 26)}</button><div><p class="cmt-head">${nickHTML(ca)}${lvMini(ca, x.uid)}${teamTag(x.uid)} <span class="muted small">${ago(x.ts)}${x.upd ? ' · ' + t('bd_edited') : ''}</span>${own && !editing ? `<button class="link small" data-cmtedit="${esc(x.id)}">${t('bd_edit')}</button><button class="link small" data-cmtdel="${esc(x.id)}">${t('delete')}</button>` : ''}${S.isOwner ? `<button class="link small" data-cmthide="${esc(x.key)}">${t(x.hidden ? 'bd_unhide' : 'bd_hide')}</button>${own ? '' : `<button class="link small" data-cmtadel="${esc(x.key)}">${t('bd_admin_del')}</button>`}` : ''}</p>${editing ? `<form class="cmt-edit" data-cmteditf="${esc(x.id)}"><textarea class="cmt-edit-ta" rows="2" maxlength="${BD_MAX.cmt}">${esc(editDraft != null ? editDraft : x.body)}</textarea><div class="actions"><button class="btn btn-primary btn-sm" type="submit">${t('bd_cmt_save')}</button><button class="btn btn-ghost btn-sm" type="button" data-cmtcancel>${t('cancel')}</button></div></form>` : `<p class="cmt-body">${esc(x.body)}</p>`}</div></li>`; }).join('')}</ul>` : `<p class="muted small">${t('bd_cmt_empty')}</p>`}
        <form class="cmt-form" id="pc-form" novalidate><textarea id="pc-body" rows="2" maxlength="${BD_MAX.cmt}" placeholder="${esc(t('bd_cmt_ph'))}">${esc(draft)}</textarea><button class="btn btn-primary btn-sm" type="submit">${icon('send')}${t('bd_cmt_send')}</button></form>
      </section>`;
    hydratePhotos(box);
    const B = () => myBoardDoc();
    $('#pl-like', box).onclick = async () => {
      if (needShared()) return;
      const L = B().likes; const i = L.indexOf(key);
      if (i >= 0) L.splice(i, 1); else { L.push(key); if (L.length > BD_MAX.likes) L.shift(); }
      await store.saveBoard(); render();
    };
    const ed = $('#pl-edit', box); if (ed) ed.onclick = () => { closeModal(w); openWrite(key); };
    const del = $('#pl-del', box); if (del) del.onclick = async () => {
      if (!armed(del, t('bd_del_confirm'))) return;
      const D = B(); D.posts = D.posts.filter(x => S.uid + '|' + x.id !== key); D.cmts = D.cmts.filter(x => x.p !== key);
      await store.saveBoard(); closeModal(w); toast(t('bd_deleted')); rerender();
    };
    const rep = $('#pl-rep', box); if (rep) rep.onclick = async () => {
      if (needShared()) return;
      const R = B().reps; if (R.some(r => r.p === key)) { toast(t('bd_reported')); return; }
      if (!armed(rep, t('bd_report_confirm'))) return;
      R.push({ p: key, ts: nowMs() }); if (R.length > BD_MAX.reps) R.shift();
      await store.saveBoard(); toast(t('bd_reported')); render();
    };
    const hide = $('#pl-hide', box); if (hide) hide.onclick = () => modToggle('hp', key).then(render);
    const adel = $('#pl-adel', box); if (adel) adel.onclick = async () => {
      if (!armed(adel, t('bd_admin_del_q'))) return;
      if (await bdAdminRemove('post', key)) { closeModal(w); rerender(); }
    };
    $$('[data-cmtadel]', box).forEach(b => b.onclick = async () => { if (!armed(b, t('bd_admin_del_q'))) return; if (await bdAdminRemove('cmt', b.dataset.cmtadel)) render(); });
    $$('[data-cmtedit]', box).forEach(b => b.onclick = () => { S.openPost.edit = b.dataset.cmtedit; render(); const ta = $('.cmt-edit-ta', box); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } });
    $$('[data-cmtcancel]', box).forEach(b => b.onclick = () => { S.openPost.edit = null; const ta = $('.cmt-edit-ta', box); if (ta) ta.value = ''; render(); });
    $$('[data-cmteditf]', box).forEach(f => f.onsubmit = async e => {
      e.preventDefault();
      const v = $('.cmt-edit-ta', f).value.trim().slice(0, BD_MAX.cmt); if (!v) return;
      const c = B().cmts.find(x => x.id === f.dataset.cmteditf); if (!c) return;
      if (c.body !== v) { c.body = v; c.upd = nowMs(); await store.saveBoard(); toast(t('bd_updated')); }
      S.openPost.edit = null; $('.cmt-edit-ta', f).remove(); render();
    });
    $$('[data-cmthide]', box).forEach(b => b.onclick = () => modToggle('hc', b.dataset.cmthide).then(render));
    $$('[data-cmtdel]', box).forEach(b => b.onclick = async () => {
      if (!armed(b, t('bd_del_confirm'))) return;
      const D = B(); D.cmts = D.cmts.filter(x => x.id !== b.dataset.cmtdel); await store.saveBoard(); render();
    });
    $('#pc-form', box).onsubmit = async e => {
      e.preventDefault(); if (needShared()) return;
      const ta = $('#pc-body', box); const v = ta.value.trim().slice(0, BD_MAX.cmt); if (!v) return;
      const D = B();
      if (recentCount(D.cmts, 5 * 60000) >= 15) { toast(t('bd_err_slow'), 'warn'); return; }
      if (D.cmts.length >= BD_MAX.cmts) D.cmts.shift();
      D.cmts.push({ id: rid(10), p: key, body: v, ts: nowMs() }); ta.value = '';
      await store.saveBoard(); render();
      if (!key.startsWith(myId() + '|')) pushSend('cmt', key); // the post's author, on their phone
    };
  };
  S.openPost = { key, w, render };
  render();
}
/* the operator deletes a post or a comment for good: gone from its author's board on the server, and also marked hidden
   (so an old copy on the author's device, if it ever came back, stays out of sight) */
async function bdAdminRemove(kind, key) {
  if (!S.isOwner) return false;
  const i = key.indexOf('|'); const owner = key.slice(0, i), id = key.slice(i + 1);
  if (window.APP_AUTH && window.APP_AUTH.board) {
    try { await window.APP_AUTH.board.adminRemove(owner, kind, id); }
    catch (e) { toast(t(e && e.code === 'need_update' ? 'cht_err_need_update' : 'bd_remove_fail'), 'warn', 4800); return false; }
  }
  const mod = Object.assign({ hp: {}, hc: {}, av: {} }, JSON.parse(JSON.stringify(S.admin.mod || {})));
  const m = kind === 'post' ? 'hp' : 'hc'; mod[m] = mod[m] || {}; mod[m][key] = nowMs();
  await store.saveAdmin('mod', mod);
  const col = kind === 'post' ? 'posts' : 'cmts';
  const d = S.board.get(owner); if (d && Array.isArray(d[col])) S.board.set(owner, Object.assign({}, d, { [col]: d[col].filter(x => x.id !== id) }));
  if (owner === S.uid && S.myBoard && Array.isArray(S.myBoard[col])) S.myBoard[col] = S.myBoard[col].filter(x => x.id !== id);
  S.dataVer++; toast(t('bd_removed'));
  return true;
}
async function modToggle(kind, key) {
  if (!S.isOwner) return;
  const mod = Object.assign({ hp: {}, hc: {}, av: {} }, JSON.parse(JSON.stringify(S.admin.mod || {})));
  mod[kind] = mod[kind] || {};
  if (kind === 'av') { const a = S.anglers.get(key); mod.av[key] = Math.max(nowMs(), (a && a.pic) || 0); }
  else if (mod[kind][key]) delete mod[kind][key]; else mod[kind][key] = nowMs();
  await store.saveAdmin('mod', mod); S.dataVer++;
  toast(t(mod[kind][key] ? 'bd_hidden_done' : 'bd_unhidden_done'));
}

/* ---------- Teams ---------- */
function teamEmblem(tm, size = 40) {
  return `<span class="team-emblem" style="--tc:${esc(tm.color || '#0B6E8E')};--s:${size}px" aria-hidden="true">${esc(tm.emoji || '🎣')}</span>`;
}
function teamRow(e, mineId) {
  const tm = e.t; const leader = anglerOf(e.id) || { nick: '?' };
  const full = e.members.length >= TEAM_MAX;
  const isMine = mineId === e.id;
  return `<li class="tm-row"><button class="tm-who" data-team="${esc(e.id)}">
      <span class="tm-rank num">${e.rank || '—'}</span>${teamEmblem(tm, 42)}
      <span class="tm-txt"><b>${esc(tm.name)}</b> <span class="team-tag" style="--tc:${esc(tm.color || '#0B6E8E')}">${esc(tm.tag)}</span><br>
      <span class="muted small">${esc(regionName(tm.home || 'KS'))} · ${t('tm_members_n', { n: e.members.length, max: TEAM_MAX })} · ${t(tm.open ? 'tm_open' : 'tm_closed')} · ${esc(leader.nick)}</span></span>
    </button>
    <span class="tm-pts num">${fmtN(e.pts)} pt</span>
    <span class="tm-act">${isMine ? `<span class="chip chip-ok">${t('tm_mine')}</span>` : full ? `<span class="chip chip-local">${t('tm_full')}</span>` : `<button class="btn btn-line btn-sm" data-tmjoin="${esc(e.id)}">${t(tm.open ? 'tm_join' : 'tm_request')}</button>`}</span>
  </li>`;
}
VIEWS.teams = {
  render(el) {
    const ti = teamIndex(); const me = myId(); const mine = teamOf(me);
    const e = mine ? ti.teams.get(mine.id) : null;
    S.tmQ = S.tmQ || '';
    const shared = S.mode === 'shared';
    let myCard;
    if (mine && mine.ok && e) {
      myCard = `<section class="card tm-mine">
        <div class="tm-mine-head">${teamEmblem(e.t, 64)}<div><p class="eyebrow">${t(mine.leader ? 'tm_my_leader' : 'tm_my_team')}</p><h2>${esc(e.t.name)} <span class="team-tag" style="--tc:${esc(e.t.color)}">${esc(e.t.tag)}</span></h2>
        <p class="muted">${t('tm_members_n', { n: e.members.length, max: TEAM_MAX })} · ${t('tm_pts', { n: fmtN(e.pts) })}${e.rank ? ' · ' + t('tm_rank', { n: e.rank }) : ''}</p></div></div>
        ${e.t.intro ? `<p class="tm-intro">${esc(e.t.intro)}</p>` : ''}
        ${mine.leader && e.pending.length ? `<div class="tm-pend"><h3 class="h4">${t('tm_pending_title', { n: e.pending.length })}</h3><ul class="fr-list">${e.pending.map(uid => { const a = anglerOf(uid) || { nick: '?' }; return `<li class="fr-row"><button class="fr-who" data-seauid="${esc(uid)}">${avatar(a, 36)}<span class="fr-txt"><span class="fr-name">${nickHTML(a)} <span class="fr-flag">${flag(a.cc)}</span></span><span class="muted small">${esc(regionName(a.home || 'KS'))}</span></span></button><span class="fr-acts"><button class="btn btn-primary btn-sm" data-tmok="${esc(uid)}">${t('tm_approve')}</button><button class="btn btn-line btn-sm" data-tmno="${esc(uid)}">${t('tm_reject')}</button></span></li>`; }).join('')}</ul></div>` : ''}
        <div class="actions"><button class="btn btn-line" data-team="${esc(e.id)}">${icon('users')}${t('tm_view')}</button>${mine.leader ? `<button class="btn btn-line" data-tmedit="1">${t('tm_edit')}</button>` : `<button class="btn btn-ghost" data-tmleave="1">${t('tm_leave')}</button>`}</div>
      </section>`;
    } else if (mine && mine.pending) {
      myCard = `<section class="card tm-mine"><div class="tm-mine-head">${teamEmblem(mine.t, 56)}<div><p class="eyebrow">${t('tm_pending_eyebrow')}</p><h2>${esc(mine.t.name)}</h2><p class="muted">${t('tm_pending_mine')}</p></div></div><div class="actions"><button class="btn btn-ghost" data-tmleave="1">${t('tm_cancel_req')}</button></div></section>`;
    } else {
      myCard = `<section class="card tm-mine tm-none"><div>${icon('flag', 'big')}</div><div><h2>${t('tm_none_title')}</h2><p class="muted">${t('tm_none_sub')}</p></div><button class="btn btn-primary" data-tmedit="new">${icon('plus')}${t('tm_create')}</button></section>`;
    }
    const q = S.tmQ.trim().toLowerCase();
    const list = ti.ranked.filter(x => !q || (x.t.name + ' ' + x.t.tag).toLowerCase().includes(q));
    el.innerHTML = `
    <div class="page teams">
      <header class="page-head"><h1>${t('tm_title')}</h1><p class="lede">${t('tm_sub')}</p></header>
      ${shared ? '' : `<p class="note">${icon('info')} ${t('bd_local_note')}</p>`}
      ${myCard}
      <section class="tm-sec">
        <div class="sec-head"><h2 class="h3">${icon('trophy')}${t('tm_list')}</h2><input class="search tm-search" id="tm-q" type="search" placeholder="${esc(t('tm_search'))}" value="${esc(S.tmQ)}" autocomplete="off"></div>
        ${list.length ? `<ul class="tm-list card">${list.map(x => teamRow(x, mine && mine.ok ? mine.id : null)).join('')}</ul>` : `<div class="empty card">${icon('flag', 'big')}<p class="muted">${t(q ? 'bd_none_found' : 'tm_rank_empty')}</p></div>`}
      </section>
      <p class="hint">${icon('info')} ${t('tm_rules', { max: TEAM_MAX })}</p>
    </div>`;
    const qi = $('#tm-q', el);
    qi.addEventListener('input', debounce(() => { S.tmQ = qi.value; const ul = $('.tm-sec', el); const q2 = S.tmQ.trim().toLowerCase(); const l2 = teamIndex().ranked.filter(x => !q2 || (x.t.name + ' ' + x.t.tag).toLowerCase().includes(q2)); const mm = teamOf(myId()); ul.querySelector('.tm-list, .empty').outerHTML = l2.length ? `<ul class="tm-list card">${l2.map(x => teamRow(x, mm && mm.ok ? mm.id : null)).join('')}</ul>` : `<div class="empty card">${icon('flag', 'big')}<p class="muted">${t('bd_none_found')}</p></div>`; }, 180));
  }
};
function openTeam(tid) {
  const e = teamIndex().teams.get(tid); if (!e) return;
  const tm = e.t; const me = myId(); const mine = teamOf(me);
  const inThis = mine && mine.id === tid; const leaderView = inThis && mine.leader;
  const members = e.members.map(uid => ({ uid, a: anglerOf(uid) || { nick: '?' } })).map(m => Object.assign(m, { pts: monthPts(m.uid, m.a) })).sort((x, y) => (y.uid === tid) - (x.uid === tid) || y.pts - x.pts);
  const w = openModal(`
    <div class="team-modal">
      <div class="tm-mine-head">${teamEmblem(tm, 72)}<div><p class="eyebrow">${t(tm.open ? 'tm_open' : 'tm_closed')} · ${esc(regionName(tm.home || 'KS'))}</p><h2>${esc(tm.name)} <span class="team-tag" style="--tc:${esc(tm.color)}">${esc(tm.tag)}</span></h2>
        <p class="muted">${t('tm_members_n', { n: e.members.length, max: TEAM_MAX })} · ${t('tm_pts', { n: fmtN(e.pts) })}${e.rank ? ' · ' + t('tm_rank', { n: e.rank }) : ''}</p></div></div>
      ${tm.intro ? `<p class="tm-intro">${esc(tm.intro)}</p>` : ''}
      <ul class="fr-list tm-members">${members.map(m => `<li class="fr-row"><button class="fr-who" data-seauid="${esc(m.uid)}">${avatar(m.a, 36)}<span class="fr-txt"><span class="fr-name">${m.uid === tid ? '👑 ' : ''}${nickHTML(m.a)}${lvMini(m.a, m.uid)} <span class="fr-flag">${flag(m.a.cc)}</span></span><span class="muted small">${t('tm_pts', { n: fmtN(m.pts) })}</span></span></button>${leaderView && m.uid !== tid ? `<span class="fr-acts"><button class="btn btn-ghost btn-sm" data-tmkick="${esc(m.uid)}">${t('tm_kick')}</button></span>` : ''}</li>`).join('')}</ul>
      <div class="actions">${inThis ? (leaderView ? `<button class="btn btn-line" data-tmedit="1">${t('tm_edit')}</button><button class="btn btn-ghost" id="tm-disband">${t('tm_disband')}</button>` : `<button class="btn btn-ghost" data-tmleave="1">${t(mine.pending ? 'tm_cancel_req' : 'tm_leave')}</button>`) : e.members.length >= TEAM_MAX ? `<span class="chip chip-local">${t('tm_full')}</span>` : `<button class="btn btn-primary" data-tmjoin="${esc(tid)}">${t(tm.open ? 'tm_join' : 'tm_request')}</button>`}</div>
    </div>`, { label: tm.name });
  const dis = $('#tm-disband', w); if (dis) dis.onclick = async () => { if (!armed(dis, t('tm_disband_confirm'))) return; await store.saveTeam(null); closeModal(w); toast(t('tm_disbanded')); rerender(); };
  w.addEventListener('click', ev => {
    const k = ev.target.closest('[data-tmkick]'); if (k) { ev.stopPropagation(); if (!armed(k, t('tm_kick_confirm'))) return; tmBan(k.dataset.tmkick).then(() => { closeModal(w); openTeam(tid); }); }
  });
}
async function tmBan(uid) {
  const tm = S.teams.get(S.uid); if (!tm) return;
  const d = JSON.parse(JSON.stringify(tm)); d.members = d.members || {}; d.ban = d.ban || {};
  delete d.members[uid]; d.ban[uid] = nowMs();
  await store.saveTeam(d); toast(t('tm_kicked'));
}
async function tmApprove(uid) {
  const tm = S.teams.get(S.uid); if (!tm) return;
  const d = JSON.parse(JSON.stringify(tm)); d.members = d.members || {}; d.ban = d.ban || {};
  if (teamIndex().teams.get(S.uid).members.length >= TEAM_MAX) { toast(t('tm_full'), 'warn'); return; }
  d.members[uid] = nowMs(); delete d.ban[uid];
  await store.saveTeam(d); toast(t('tm_approved')); rerender();
}
async function tmJoin(tid) {
  if (needShared()) return;
  if (S.teams.has(S.uid)) { toast(t('tm_err_leader_join'), 'warn', 4800); return; }
  const cur = teamOf(S.uid); if (cur && cur.id !== tid) { toast(t('tm_err_in_team'), 'warn', 4800); return; }
  const e = teamIndex().teams.get(tid); if (!e) return;
  if (e.t.ban && e.t.ban[S.uid]) { toast(t('tm_err_banned'), 'warn'); return; }
  if (e.members.length >= TEAM_MAX) { toast(t('tm_full'), 'warn'); return; }
  S.me.team = { id: tid, ts: nowMs() };
  await store.saveMe(); S.dataVer++;
  if (!e.t.open) pushSend('tjoin', tid); // the leader decides
  toast(t(e.t.open ? 'tm_joined' : 'tm_requested', { name: e.t.name }), 'ok', 4200); rerender();
}
async function tmLeave() {
  if (needShared()) return;
  delete S.me.team; await store.saveMe(); S.dataVer++; toast(t('tm_left')); rerender();
}
function openTeamEdit(isNew) {
  if (needShared()) return;
  const cur = S.teams.get(S.uid);
  if (isNew && cur) { openTeam(S.uid); return; }
  if (isNew) { const m = teamOf(S.uid); if (m && m.ok) { toast(t('tm_err_in_team'), 'warn', 4800); return; } }
  const d = cur ? JSON.parse(JSON.stringify(cur)) : { v: 1, name: '', tag: '', emoji: TEAM_EMOJI[0], color: TEAM_COLORS[0], home: homeRegion(), intro: '', open: true, members: {}, ban: {}, ts: nowMs() };
  const homes = HOMES.map(h => `<option value="${h}" ${d.home === h ? 'selected' : ''}>${esc(regionName(h))}</option>`).join('');
  const w = openModal(`
    <form class="team-edit" id="te-form" novalidate>
      <h2>${t(cur ? 'tm_edit' : 'tm_create')}</h2>
      <div class="row2">
        <div class="field"><label for="te-name">${t('tm_f_name')}</label><input id="te-name" maxlength="16" value="${esc(d.name)}" autocomplete="off"></div>
        <div class="field"><label for="te-tag">${t('tm_f_tag')}</label><input id="te-tag" maxlength="4" value="${esc(d.tag)}" autocomplete="off" placeholder="ZZR"></div>
      </div>
      <div class="field"><span>${t('tm_f_emoji')}</span><div class="emoji-grid" role="radiogroup">${TEAM_EMOJI.map(x => `<label class="emo"><input type="radio" name="te-emo" value="${x}" ${d.emoji === x ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div></div>
      <div class="field"><span>${t('tm_f_color')}</span><div class="swatches" role="radiogroup">${TEAM_COLORS.map(x => `<label class="sw-c" style="--c:${x}"><input type="radio" name="te-col" value="${x}" ${d.color === x ? 'checked' : ''}><span></span></label>`).join('')}</div></div>
      <div class="field"><label for="te-home">${t('tm_f_home')}</label><select id="te-home">${homes}</select></div>
      <div class="field"><label for="te-intro">${t('tm_f_intro')}</label><textarea id="te-intro" rows="3" maxlength="200">${esc(d.intro || '')}</textarea></div>
      <label class="switch"><input type="checkbox" id="te-open" ${d.open ? 'checked' : ''}><span class="sw"></span><span>${t('tm_f_open')}</span></label>
      <p class="hint">${t('tm_f_open_hint')}</p>
      <p class="err" id="te-err" hidden></p>
      <div class="actions"><button class="btn btn-primary" type="submit">${t(cur ? 'tm_save' : 'tm_create')}</button><button class="btn btn-ghost" type="button" data-close>${t('cancel')}</button></div>
    </form>`, { label: t('tm_create') });
  $('#te-form', w).onsubmit = async ev => {
    ev.preventDefault();
    const err = $('#te-err', w); err.hidden = true;
    const name = $('#te-name', w).value.trim().replace(/\s+/g, ' ');
    const tag = $('#te-tag', w).value.trim().toUpperCase();
    if (name.length < 2 || name.length > 16) { err.textContent = t('tm_err_name'); err.hidden = false; return; }
    if (!/^[\p{L}\p{N}]{2,4}$/u.test(tag)) { err.textContent = t('tm_err_tag'); err.hidden = false; return; }
    for (const [tid, o] of S.teams) if (tid !== S.uid && o && (String(o.name).toLowerCase() === name.toLowerCase() || String(o.tag).toUpperCase() === tag)) { err.textContent = t('tm_err_dup'); err.hidden = false; return; }
    Object.assign(d, { name, tag, emoji: ($('input[name="te-emo"]:checked', w) || {}).value || TEAM_EMOJI[0], color: ($('input[name="te-col"]:checked', w) || {}).value || TEAM_COLORS[0], home: $('#te-home', w).value, intro: $('#te-intro', w).value.trim().slice(0, 200), open: $('#te-open', w).checked, upd: nowMs() });
    if (!cur && S.me.team) { delete S.me.team; await store.saveMe(); }
    await store.saveTeam(d);
    closeModal(w); toast(t(cur ? 'tm_saved' : 'tm_created', { name })); rerender();
  };
}
