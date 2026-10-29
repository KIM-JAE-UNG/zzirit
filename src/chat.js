/* ===== Live chat (채팅, website): the open chat for everyone online and 1:1 between friends.
   The server keeps the messages (the open chat is shown for 3 days), writes who said each one, refuses links and phone
   numbers in the open chat, keeps muted people quiet and slows floods down. 1:1 is only between friends and only the
   two of them can read it. The open chat is live only while the chat page or the park is open; 1:1 is live all along
   (for the unread count), and only my own conversations ever reach this device. ===== */
const CHAT = { msgs: [], loaded: false, err: null, refs: 0, stop: null, hooks: new Set(), mute: null };
const DMS = { rows: new Map(), loaded: false, stop: null, err: null, started: false };
function chatOn() { return window.APP_RT === 'web' && !!(window.APP_AUTH && window.APP_AUTH.chat); }
const CHAT_BAD = /(씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|좆|존나|개새끼|개새|지랄|미친놈|미친년|닥쳐|fuck|shit|bitch)/gi;
function chatClean(s) { return String(s || '').replace(CHAT_BAD, m => '*'.repeat([...m].length)); }
function chatHidden(id) { const hm = (S.admin.mod && S.admin.mod.hm) || {}; return !!hm[id]; }
function chatTime(iso) { const ms = Date.parse(iso) || nowMs(); return nowMs() - ms < 60e3 ? t('cht_now') : ago(ms); }
function chatErrText(e) { const c = (e && e.code) || 'unavailable'; const k = 'cht_err_' + c; const s = t(k, { until: CHAT.mute ? fmtDT(Date.parse(CHAT.mute)) : '' }); return s === k ? t('cht_err_unavailable') : s; }

/* ---- the open chat: joined while someone looks (chat page, park), with hooks for the park's speech bubbles ---- */
function chatJoin(hook) {
  if (!chatOn()) return () => { };
  if (hook) CHAT.hooks.add(hook);
  CHAT.refs++;
  if (!CHAT.stop) { CHAT.stop = APP_AUTH.chat.onNew('all', chatAdd); chatLoad(); }
  let done = false;
  return () => {
    if (done) return; done = true;
    if (hook) CHAT.hooks.delete(hook);
    if (--CHAT.refs <= 0) { CHAT.refs = 0; if (CHAT.stop) { CHAT.stop(); CHAT.stop = null; } CHAT.loaded = false; }
  };
}
async function chatLoad() {
  try {
    const rows = await APP_AUTH.chat.recent('all', 80);
    const have = new Set(rows.map(m => m.id));
    CHAT.msgs = rows.concat(CHAT.msgs.filter(m => !have.has(m.id))).sort((a, b) => a.id - b.id).slice(-200);
    CHAT.loaded = true; CHAT.err = null;
  } catch (e) { CHAT.err = (e && e.code) || 'unavailable'; }
  try { CHAT.mute = S.me && S.me.nick ? await APP_AUTH.chat.myMute() : null; } catch (e) { CHAT.mute = null; }
  chatPaint(true);
}
function chatAdd(m) {
  if (!m || !m.id || CHAT.msgs.some(x => x.id === m.id)) return;
  CHAT.msgs.push(m); CHAT.msgs.sort((a, b) => a.id - b.id);
  if (CHAT.msgs.length > 200) CHAT.msgs.splice(0, CHAT.msgs.length - 200);
  for (const h of CHAT.hooks) { try { h(m); } catch (e) { console.warn(e); } }
  chatPaint(false);
}
async function chatSend(text) {
  const v = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!v) return false;
  if (!S.me || !S.me.nick) { ensureProfile(); return false; }
  try { const m = await APP_AUTH.chat.send('all', v); if (CHAT.mute) CHAT.mute = null; chatAdd(m); return true; }
  catch (e) { if (e && e.code === 'muted') { try { CHAT.mute = await APP_AUTH.chat.myMute(); } catch (x) { } chatPaint(false); } toast(chatErrText(e), 'warn', 4800); return false; }
}
function chatRow(m) {
  const a = S.anglers.get(m.uid) || null; const mine = m.uid === myId();
  const nick = (a && a.nick) || m.nick || '?';
  return `<li class="cm${mine ? ' me' : ''}" data-cm="${m.id}">
    <button class="cm-av" data-seauid="${esc(m.uid)}" aria-label="${esc(nick)}">${avatar(a || { nick }, 30)}</button>
    <div class="cm-main"><p class="cm-head"><b>${esc(nick)}</b>${a ? lvMini(a, m.uid) + teamTag(m.uid) : ''}<span class="muted small">${chatTime(m.created_at)}</span>${mine && !S.isOwner ? '' : `<button class="cm-more" data-cmmore="${m.id}" aria-label="${esc(t('cht_more'))}">${icon('dots')}</button>`}</p>
    <p class="cm-body">${esc(chatClean(m.body))}</p></div></li>`;
}
/* paint the open chat where it is shown: keeps the scroll where it is unless the reader is already at the bottom */
function chatPaint(jump) {
  if (typeof pkLog === 'function') pkLog(); // the park shows the last few lines too
  const log = $('#chat-log'); if (!log) return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const list = CHAT.msgs.filter(m => !chatHidden(m.id));
  if (CHAT.err && !list.length) { log.innerHTML = `<li class="chat-empty">${icon('warn')} ${esc(chatErrText({ code: CHAT.err }))}</li>`; return; }
  log.innerHTML = list.length ? list.map(chatRow).join('') : `<li class="chat-empty">${CHAT.loaded ? t('cht_empty') : t('loading')}</li>`;
  if (jump || near) log.scrollTop = log.scrollHeight; else { const nb = $('#chat-newer'); if (nb) nb.hidden = false; }
  const note = $('#chat-note'); if (note) note.textContent = CHAT.mute ? t('cht_err_muted', { until: fmtDT(Date.parse(CHAT.mute)) }) : '';
}
/* a message's menu: report it (others), or — for the operator — hide it and keep its author out for a while */
function chatMore(id) {
  const m = CHAT.msgs.find(x => x.id === +id); if (!m) return;
  const mine = m.uid === myId(); const a = S.anglers.get(m.uid); const nick = (a && a.nick) || m.nick;
  const w = openModal(`<div class="cm-menu">
    <p class="cm-quote"><b>${esc(nick)}</b> ${esc(chatClean(m.body))}</p>
    <div class="actions col">
      ${mine ? '' : `<button class="btn btn-line btn-block" data-cma="report">${icon('warn')}${t('cht_report')}</button>`}
      ${S.isOwner ? `<button class="btn btn-line btn-block" data-cma="hide">${icon('eye')}${t(chatHidden(m.id) ? 'bd_unhide' : 'cht_hide')}</button>
        ${mine ? '' : `<p class="lbl">${t('cht_mute')}</p><div class="chip-row">${[[10, 'cht_m10'], [60, 'cht_m60'], [1440, 'cht_m1d'], [0, 'cht_m0']].map(([n, k]) => `<button class="chip chip-tab" data-cmute="${n}">${t(k)}</button>`).join('')}</div>`}` : ''}
    </div></div>`, { label: t('cht_more') });
  w.addEventListener('click', async e => {
    const b = e.target.closest('[data-cma],[data-cmute]'); if (!b) return;
    if (b.dataset.cma === 'report') {
      if (!S.me || !S.me.nick) { closeModal(w); ensureProfile(); return; }
      await store.addSuggestion({ id: rid(8), cat: 'report', text: `[${t('cht_title')}] ${nick}: ${String(m.body).slice(0, 200)} (#${m.id})`, ts: nowMs(), nick: S.me.nick, ref: 'chat:' + m.id, about: m.uid });
      closeModal(w); toast(t('cht_reported')); return;
    }
    if (b.dataset.cma === 'hide') { closeModal(w); await chatHideToggle(m.id); return; }
    if (b.dataset.cmute != null) {
      try { const until = await APP_AUTH.chat.mute(m.uid, +b.dataset.cmute); closeModal(w); toast(+b.dataset.cmute ? t('cht_muted_done', { nick, until: fmtDT(Date.parse(until)) }) : t('cht_unmuted_done', { nick })); }
      catch (x) { toast(chatErrText(x), 'warn'); }
    }
  });
}
async function chatHideToggle(id) {
  if (!S.isOwner) return;
  const mod = Object.assign({ hp: {}, hc: {}, av: {}, hm: {} }, JSON.parse(JSON.stringify(S.admin.mod || {})));
  mod.hm = mod.hm || {};
  const on = !mod.hm[id];
  try { await APP_AUTH.chat.hide(id, on); } catch (e) { toast(chatErrText(e), 'warn'); return; }
  if (on) mod.hm[id] = nowMs(); else delete mod.hm[id];
  // the readable list stays short: notes older than 3 days are of no use (the server stops serving those messages)
  for (const [k, v] of Object.entries(mod.hm)) if (nowMs() - v > 3 * 864e5) delete mod.hm[k];
  await store.saveAdmin('mod', mod); S.dataVer++;
  toast(t(on ? 'bd_hidden_done' : 'bd_unhidden_done')); chatPaint(false);
}

/* ---- 1:1 between friends ---- */
function dmPeerOf(r) { const me = myId(); return r.a === me ? r.b : r.a; }
function dmStart() {
  if (!chatOn() || DMS.started || !S.uid || S.mode !== 'shared') return;
  DMS.started = true;
  DMS.stop = APP_AUTH.dm.onNew(r => { if (r && r.id) { const fresh = !DMS.rows.has(r.id); DMS.rows.set(r.id, r); if (fresh) dmChanged(r); } });
  APP_AUTH.dm.list(300).then(rows => { for (const r of rows) DMS.rows.set(r.id, r); DMS.loaded = true; DMS.err = null; dmChanged(null); })
    .catch(e => { DMS.err = (e && e.code) || 'unavailable'; DMS.loaded = true; dmChanged(null); });
}
function dmReads() { const v = lsGet('dmRead', {}); return v && typeof v === 'object' ? v : {}; }
function dmThreads() {
  const me = myId(); const by = new Map();
  for (const r of DMS.rows.values()) {
    const peer = dmPeerOf(r); if (!peer || peer === me) continue;
    const th = by.get(peer) || { peer, msgs: [], last: null, unread: 0 };
    th.msgs.push(r); by.set(peer, th);
  }
  const read = dmReads();
  for (const th of by.values()) {
    th.msgs.sort((a, b) => a.id - b.id); th.last = th.msgs[th.msgs.length - 1];
    th.unread = th.msgs.filter(r => r.sender !== me && r.id > (read[th.peer] || 0)).length;
  }
  return by;
}
function dmUnread() { let n = 0; for (const th of dmThreads().values()) n += th.unread; return n; }
function dmMarkRead(peer) {
  const th = dmThreads().get(peer); if (!th || !th.last) return;
  const read = dmReads(); if ((read[peer] || 0) >= th.last.id) return;
  read[peer] = th.last.id; lsSet('dmRead', read); dmBadge();
}
function dmBadge() {
  const n = dmUnread();
  $$('[data-dmbadge]').forEach(b => { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); });
  try { navDots(); } catch (e) { }
}
function dmChanged(r) {
  // a new message in the open conversation is read at once; anything else waits in the count (and the bell)
  if (r && S.route === 'chat' && S.chatTab === 'dm' && S.dmPeer === dmPeerOf(r) && !document.hidden) dmMarkRead(S.dmPeer);
  dmBadge(); dmPaint();
  if (r && r.sender !== myId()) { try { notiScan(); } catch (e) { } }
}
async function dmSend(peer, text) {
  const v = String(text || '').trim().slice(0, 500); if (!v) return false;
  try {
    const r = await APP_AUTH.dm.send(peer, v); DMS.rows.set(r.id, r); dmMarkRead(peer); dmPaint();
    pushSend('dm', String(r.id)); // the friend's phone, if they switched notices on
    return true;
  } catch (e) { toast(chatErrText(e), 'warn', 4800); return false; }
}
function dmOpen(peer) { S.chatTab = 'dm'; S.dmPeer = peer || null; if (S.route !== 'chat') location.hash = 'chat'; else show('chat'); }
function dmListHTML() {
  const th = dmThreads(); const fr = frLists().friends;
  const peers = new Set([...fr.map(f => f.uid), ...th.keys()]);
  const rows = [...peers].map(uid => ({ uid, a: S.anglers.get(uid), th: th.get(uid), friend: relation(uid) === 'friend' }))
    .filter(x => x.a && x.a.nick)
    .sort((x, y) => ((y.th && y.th.last ? y.th.last.id : 0) - (x.th && x.th.last ? x.th.last.id : 0)) || x.a.nick.localeCompare(y.a.nick));
  if (!rows.length) return `<div class="dm-none">${icon('users', 'big')}<p>${t('cht_dm_none')}</p><a class="btn btn-primary" href="#friends">${icon('user-plus')}${t('cht_dm_find')}</a></div>`;
  return `<ul class="dm-list">${rows.map(x => `<li><button class="dm-row" data-dmpeer="${esc(x.uid)}">${avatar(x.a, 40)}
    <span class="dm-who"><b>${esc(x.a.nick)}</b>${lvMini(x.a, x.uid)}<span class="muted small">${x.th && x.th.last ? esc(chatClean(x.th.last.body).slice(0, 60)) : t('cht_dm_start')}</span></span>
    <span class="dm-side">${x.th && x.th.last ? `<span class="muted small">${chatTime(x.th.last.created_at)}</span>` : ''}${x.th && x.th.unread ? `<i class="badge num">${x.th.unread > 9 ? '9+' : x.th.unread}</i>` : ''}${x.friend ? '' : `<span class="chip">${t('cht_dm_notfriend')}</span>`}</span>
  </button></li>`).join('')}</ul><p class="hint">${icon('shield')} ${t('cht_dm_rule')}</p>`;
}
function dmThreadHTML(peer) {
  const a = S.anglers.get(peer) || { nick: '?' }; const friend = relation(peer) === 'friend';
  return `<div class="dm-head"><button class="btn btn-ghost btn-sm" data-dmback>${t('back')}</button><button class="dm-who-btn" data-seauid="${esc(peer)}">${avatar(a, 32)}<b>${esc(a.nick)}</b>${lvMini(a, peer)}</button></div>
    <ol class="chat-log dm-log" id="dm-log" aria-live="polite"></ol>
    ${friend ? `<form class="chat-in" id="dm-form"><input id="dm-text" maxlength="500" autocomplete="off" placeholder="${esc(t('cht_dm_ph', { nick: a.nick }))}"><button class="btn btn-primary" type="submit">${icon('send')}<span>${t('cht_send')}</span></button></form>`
      : `<p class="note">${icon('info')} ${t('cht_dm_notfriend_note')}</p>`}`;
}
function dmPaint() {
  const card = $('#chat-card'); if (!card || S.route !== 'chat' || S.chatTab !== 'dm') return;
  if (!S.dmPeer) { const box = $('#dm-box', card); if (box) box.innerHTML = DMS.err && !DMS.rows.size ? `<p class="note">${icon('warn')} ${esc(chatErrText({ code: DMS.err }))}</p>` : dmListHTML(); return; }
  const log = $('#dm-log', card); if (!log) return;
  const th = dmThreads().get(S.dmPeer); const me = myId();
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.innerHTML = th && th.msgs.length ? th.msgs.map(r => `<li class="cm cm-dm${r.sender === me ? ' me' : ''}"><div class="cm-main"><p class="cm-body">${esc(chatClean(r.body))}</p><p class="cm-head"><span class="muted small">${chatTime(r.created_at)}</span>${r.sender === me ? '' : `<button class="cm-more" data-dmrep="${r.id}" aria-label="${esc(t('cht_report'))}">${icon('warn')}</button>`}</p></div></li>`).join('')
    : `<li class="chat-empty">${t('cht_dm_empty')}</li>`;
  if (near || !log.dataset.seen) { log.scrollTop = log.scrollHeight; log.dataset.seen = '1'; }
  dmMarkRead(S.dmPeer);
}

/* ---- the page ---- */
VIEWS.chat = {
  render(el) {
    if (!chatOn()) { el.innerHTML = `<div class="page"><div class="empty card big">${icon('chat', 'big')}<h2>${t('cht_web_only')}</h2><p class="muted">${t('cht_web_only_sub')}</p></div></div>`; return; }
    const tab = S.chatTab === 'dm' ? 'dm' : 'all';
    const key = tab + '|' + (tab === 'dm' ? S.dmPeer || '' : '') + '|' + (S.me && S.me.nick ? 1 : 0) + '|' + S.lang;
    if (el.dataset.ck === key && $('#chat-card', el)) { chatPaint(false); dmPaint(); dmBadge(); return; } // keep what is being typed
    el.dataset.ck = key;
    const can = !!(S.me && S.me.nick);
    el.innerHTML = `
    <div class="page chat-page">
      <header class="page-head"><h1>${t('cht_title')}</h1><p class="lede">${t('cht_sub')}</p></header>
      <div class="seg chat-tabs" role="tablist">
        <button role="tab" data-ctab="all" aria-selected="${tab === 'all'}">${icon('users')}<span>${t('cht_all')}</span></button>
        <button role="tab" data-ctab="dm" aria-selected="${tab === 'dm'}">${icon('chat')}<span>${t('cht_dm')}</span><i class="badge num" data-dmbadge hidden></i></button>
      </div>
      <section class="card chat-card" id="chat-card">
        ${tab === 'all' ? `
          <ol class="chat-log" id="chat-log" aria-live="polite"></ol>
          <button class="chat-newer" id="chat-newer" hidden>${t('cht_newer')}</button>
          ${can ? `<form class="chat-in" id="chat-form"><input id="chat-text" maxlength="200" autocomplete="off" placeholder="${esc(t('cht_ph'))}"><button class="btn btn-primary" type="submit">${icon('send')}<span>${t('cht_send')}</span></button></form>`
            : `<div class="chat-in chat-join"><span class="muted">${t('cht_need_profile')}</span><button class="btn btn-primary btn-sm" data-act="onboard">${t('onb_go')}</button></div>`}
          <p class="small muted" id="chat-note"></p>`
          : S.dmPeer ? dmThreadHTML(S.dmPeer) : `<div id="dm-box"></div>`}
      </section>
      <p class="hint chat-safe">${icon('shield')} ${t('cht_safety')}</p>
    </div>`;
    if (tab === 'all') { if (!this._stop) this._stop = chatJoin(null); chatPaint(true); }
    else { if (this._stop) { this._stop(); this._stop = null; } dmPaint(); }
    dmBadge();
    el.onclick = e => {
      const tb = e.target.closest('[data-ctab]'); if (tb) { S.chatTab = tb.dataset.ctab; S.dmPeer = null; this.render(el); return; }
      const mo = e.target.closest('[data-cmmore]'); if (mo) { chatMore(mo.dataset.cmmore); return; }
      const pr = e.target.closest('[data-dmpeer]'); if (pr) { S.dmPeer = pr.dataset.dmpeer; this.render(el); return; }
      if (e.target.closest('[data-dmback]')) { S.dmPeer = null; this.render(el); return; }
      const nb = e.target.closest('#chat-newer'); if (nb) { nb.hidden = true; const log = $('#chat-log'); if (log) log.scrollTop = log.scrollHeight; return; }
      const rp = e.target.closest('[data-dmrep]'); if (rp) {
        const r = DMS.rows.get(+rp.dataset.dmrep); if (!r) return;
        if (!armed(rp, t('cht_report_q'))) return;
        const a = S.anglers.get(r.sender) || {};
        store.addSuggestion({ id: rid(8), cat: 'report', text: `[${t('cht_dm')}] ${a.nick || '?'}: ${String(r.body).slice(0, 300)} (#${r.id})`, ts: nowMs(), nick: (S.me && S.me.nick) || '', ref: 'dm:' + r.id, about: r.sender }).then(() => toast(t('cht_reported')));
      }
    };
    const f = $('#chat-form', el);
    if (f) f.onsubmit = async e => { e.preventDefault(); const inp = $('#chat-text', el); const b = f.querySelector('button'); b.disabled = true; if (await chatSend(inp.value)) inp.value = ''; b.disabled = false; inp.focus(); };
    const df = $('#dm-form', el);
    if (df) df.onsubmit = async e => { e.preventDefault(); const inp = $('#dm-text', el); const b = df.querySelector('button'); b.disabled = true; if (await dmSend(S.dmPeer, inp.value)) inp.value = ''; b.disabled = false; inp.focus(); };
  },
  leave() { if (this._stop) { this._stop(); this._stop = null; } const el = $('#v-chat'); if (el) delete el.dataset.ck; }
};
