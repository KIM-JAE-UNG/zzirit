/* ===== Fishing points (포인트): where people fish, what bites there, tips. =====
   Each point belongs to the account that wrote it. It stays private unless the owner shares it; shared points
   show for everyone on this page and on the map. The operator can hide a shared point. Website only. */
const PT_KINDS = ['breakwater', 'rocks', 'beach', 'boat', 'river', 'lake', 'other'];
const PT_MAX_SP = 5;
function pointsOn() { return window.APP_RT === 'web'; }
function ptMine(p) { return !!p && (p._owner === S.uid || (!p.pub && !S.isOwner)); }
function ptVisible(p) { return p && (!p.hidden || ptMine(p) || S.isOwner); }
function ptLists() {
  const all = [...S.points.values()].filter(ptVisible);
  const mine = all.filter(ptMine).sort((a, b) => (b.upd || 0) - (a.upd || 0));
  const shared = all.filter(p => p.pub && !ptMine(p)).sort((a, b) => (b.upd || 0) - (a.upd || 0));
  return { mine, shared };
}
function ptWhere(p) {
  if (p.lat == null || p.lon == null) return '';
  const env = GEO.envAt(p.lon, p.lat);
  return env && env.water ? dict(GEO.seaOf(p.lon, p.lat).n) : regionName(GEO.region(p.lon, p.lat, false));
}
const ptSpName = x => (SPI[x] ? spName(SPI[x]) : String(x || '').slice(0, 20));
function ptCard(p) {
  const owner = !ptMine(p) ? (anglerOf(p._owner) || null) : null;
  return `<li><button class="pt-card${p.hidden ? ' is-hidden' : ''}" data-point="${esc(p.id)}">
    <span class="pt-pin">${icon('pin')}</span>
    <span class="pt-main">
      <span class="pt-top"><b>${esc(p.name || '?')}</b><span class="chip">${t('ptk_' + (PT_KINDS.includes(p.kind) ? p.kind : 'other'))}</span>${ptMine(p) ? `<span class="chip ${p.pub ? 'chip-ok' : 'chip-local'}">${t(p.pub ? 'pt_shared' : 'pt_private')}</span>` : ''}${p.hidden ? `<span class="chip chip-closed">${t('pt_hidden_chip')}</span>` : ''}</span>
      <span class="muted small">${esc(ptWhere(p))}${(p.sp || []).length ? ' · ' + esc((p.sp || []).slice(0, 3).map(ptSpName).join(', ')) : ''}</span>
      ${p.memo ? `<span class="pt-memo">${esc(String(p.memo).replace(/\s+/g, ' ').slice(0, 90))}</span>` : ''}
      ${owner ? `<span class="pt-by">${avatar(owner, 20)}${nickHTML(owner)}${lvMini(owner, p._owner)}</span>` : ''}
    </span>
  </button></li>`;
}
VIEWS.points = {
  render(el) {
    if (!pointsOn()) { el.innerHTML = `<div class="page"><div class="empty card big"><h2>${t('nav_points')}</h2><p class="muted">${t('pt_web_only')}</p></div></div>`; return; }
    S.ptTab = S.ptTab || 'mine';
    const L = ptLists(); const list = S.ptTab === 'mine' ? L.mine : L.shared;
    el.innerHTML = `
    <div class="page points">
      <header class="page-head bd-head">
        <div><h1>${t('pt_title')}</h1><p class="lede">${t('pt_sub')}</p></div>
        <button class="btn btn-primary" data-ptnew>${icon('plus')}${t('pt_add')}</button>
      </header>
      <div class="seg" role="tablist">${['mine', 'shared'].map(k => `<button role="tab" aria-pressed="${S.ptTab === k}" data-pttab="${k}">${t('pt_tab_' + k)} <span class="muted">${(k === 'mine' ? L.mine : L.shared).length}</span></button>`).join('')}</div>
      ${list.length ? `<ul class="pt-list">${list.slice(0, 300).map(ptCard).join('')}</ul>` : `
        <div class="empty card big">${icon('pin', 'big')}<h2>${t(S.ptTab === 'mine' ? 'pt_empty_mine' : 'pt_empty_shared')}</h2><p class="muted">${t(S.ptTab === 'mine' ? 'pt_empty_mine_sub' : 'pt_empty_shared_sub')}</p>${S.ptTab === 'mine' ? `<button class="btn btn-primary" data-ptnew>${icon('plus')}${t('pt_add')}</button>` : ''}</div>`}
      <p class="hint">${icon('shield')} ${t('pt_privacy')}</p>
    </div>`;
  }
};
function openPoint(id) {
  const p = S.points.get(id); if (!p || !ptVisible(p)) return;
  const mine = ptMine(p); const owner = !mine ? anglerOf(p._owner) : null;
  const w = openModal(`<article class="pt-detail">
    <p class="eyebrow">${t('ptk_' + (PT_KINDS.includes(p.kind) ? p.kind : 'other'))}${p.upd ? ' · ' + fmtDate(p.upd) : ''}</p>
    <h2>${icon('pin')} ${esc(p.name || '?')}</h2>
    <div class="chips">${mine ? `<span class="chip ${p.pub ? 'chip-ok' : 'chip-local'}">${t(p.pub ? 'pt_shared' : 'pt_private')}</span>` : ''}${p.hidden ? `<span class="chip chip-closed">${t('pt_hidden_chip')}</span>` : ''}${(p.sp || []).map(x => SPI[x] ? `<button class="chip chip-tab" data-sp="${esc(x)}">${esc(ptSpName(x))}</button>` : `<span class="chip">${esc(ptSpName(x))}</span>`).join('')}</div>
    <dl class="kv">
      <div><dt>${t('area')}</dt><dd>${esc(ptWhere(p) || '—')}${p.lat != null ? `<br><span class="mono small">${GEO.fmtLL(p.lat, p.lon)}</span>` : ''}</dd></div>
      ${owner ? `<div><dt>${t('pt_by')}</dt><dd><button class="link" data-seauid="${esc(p._owner)}">${flag(owner.cc)} ${esc(owner.nick)}</button></dd></div>` : ''}
    </dl>
    ${p.memo ? `<blockquote class="memo">${esc(p.memo)}</blockquote>` : ''}
    <div class="actions">
      ${p.lat != null ? `<button class="btn btn-line btn-sm" id="pt-map">${icon('map')}${t('pt_on_map')}</button>` : ''}
      ${mine ? `<button class="btn btn-line btn-sm" id="pt-edit">${t('bd_edit')}</button><button class="btn btn-ghost btn-sm" id="pt-del">${icon('trash')}${t('delete')}</button>` : ''}
      ${S.isOwner && !mine ? `<button class="btn btn-ghost btn-sm" id="pt-hide">${t(p.hidden ? 'bd_unhide' : 'bd_hide')}</button>` : ''}
    </div>
  </article>`, { label: p.name || t('nav_points') });
  const mp = $('#pt-map', w); if (mp) mp.onclick = () => { closeModal(w); S.mapFocus = [p.lon, p.lat, 12]; location.hash = 'map'; };
  const ed = $('#pt-edit', w); if (ed) ed.onclick = () => { closeModal(w); openPointEdit(id); };
  const dl = $('#pt-del', w); if (dl) dl.onclick = async () => { if (!armed(dl, t('delete_confirm'))) return; await store.deletePoint(id); closeModal(w); toast(t('deleted')); rerender(); };
  const hd = $('#pt-hide', w); if (hd) hd.onclick = async () => { const d = Object.assign({}, p, { hidden: !p.hidden }); if (await store.savePoint(d)) { toast(t(d.hidden ? 'pt_hidden_done' : 'pt_unhidden_done')); closeModal(w); rerender(); } };
  w.addEventListener('click', e => { const sp = e.target.closest('[data-sp]'); if (sp) { closeModal(w); openSpecies(sp.dataset.sp); } });
}
/* write or change a point; `pre` fills it in (from a catch: its spot and species) */
function openPointEdit(id, pre) {
  if (!pointsOn()) return;
  if (!S.me || !S.me.nick) { ensureProfile(() => openPointEdit(id, pre)); return; }
  if (S.mode !== 'shared' || !S.uid) { toast(t('fr_need_shared'), 'info', 4800); return; }
  const old = id ? S.points.get(id) : null;
  if (id && (!old || !ptMine(old))) return;
  const p = Object.assign({ name: '', kind: 'breakwater', lat: null, lon: null, sp: [], memo: '', pub: false }, old || {}, pre || {});
  const spText = (p.sp || []).map(ptSpName).join(', ');
  const w = openModal(`<form class="pt-form" id="pt-form" novalidate>
    <h2>${icon('pin')} ${t(old ? 'pt_edit_title' : 'pt_add')}</h2>
    <div class="field"><label for="pt-name">${t('pt_name')} <span class="req">*</span></label><input id="pt-name" maxlength="30" value="${esc(p.name)}" placeholder="${esc(t('pt_name_ph'))}"></div>
    <div class="row2">
      <div class="field"><label for="pt-kind">${t('pt_kind')}</label><select id="pt-kind">${PT_KINDS.map(k => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${t('ptk_' + k)}</option>`).join('')}</select></div>
      <div class="field"><label>${t('pt_where')} <span class="req">*</span></label><div class="loc-row"><span id="pt-loc" class="loc-txt">${p.lat != null ? `${esc(ptWhere(p))} · <span class="mono">${GEO.fmtLL(p.lat, p.lon)}</span>` : t('loc_none')}</span><button type="button" class="btn btn-line btn-sm" id="pt-pick">${icon('pin')}${t('reg_pick')}</button></div></div>
    </div>
    <div class="field"><label for="pt-sp">${t('pt_species')}</label><input id="pt-sp" list="pt-sps" value="${esc(spText)}" placeholder="${esc(t('pt_species_ph'))}" maxlength="120"><datalist id="pt-sps">${SP.map(s => `<option value="${esc(spName(s))}">`).join('')}</datalist></div>
    <div class="field"><label for="pt-memo">${t('pt_memo')}</label><textarea id="pt-memo" rows="3" maxlength="300" placeholder="${esc(t('pt_memo_ph'))}">${esc(p.memo || '')}</textarea></div>
    <label class="switch"><input type="checkbox" id="pt-pub" ${p.pub ? 'checked' : ''}><span class="sw"></span><span>${t('pt_share')}</span></label>
    <p class="note" id="pt-pub-note" ${p.pub ? '' : 'hidden'}>${icon('warn')} ${t('pt_share_note')}</p>
    <p class="err" id="pt-err" hidden></p>
    <div class="actions"><button class="btn btn-primary" type="submit" id="pt-go">${icon('check')}${t('save')}</button><button class="btn btn-ghost" type="button" data-close>${t('cancel')}</button></div>
  </form>`, { label: t(old ? 'pt_edit_title' : 'pt_add') });
  let lat = p.lat, lon = p.lon;
  $('#pt-pick', w).onclick = () => {
    const h = GEO.HOME[homeRegion()] || [128, 35];
    openMapPicker(lon != null ? [lon, lat] : h, pos => { lon = Math.round(pos[0] * 1e4) / 1e4; lat = Math.round(pos[1] * 1e4) / 1e4; $('#pt-loc', w).innerHTML = `${esc(ptWhere({ lat, lon }))} · <span class="mono">${GEO.fmtLL(lat, lon)}</span>`; });
  };
  $('#pt-pub', w).onchange = e => { $('#pt-pub-note', w).hidden = !e.target.checked; };
  $('#pt-form', w).addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#pt-err', w); err.hidden = true;
    const name = $('#pt-name', w).value.replace(/\s+/g, ' ').trim();
    if ([...name].length < 2 || /https?:|www\./i.test(name)) { err.textContent = t('pt_err_name'); err.hidden = false; $('#pt-name', w).focus(); return; }
    if (lat == null || lon == null) { err.textContent = t('pt_err_where'); err.hidden = false; return; }
    // species: names from the list become ids, anything else stays as typed (at most 5)
    const byName = new Map(); for (const s of SP) for (const n of s.n) byName.set(n.toLowerCase(), s.id);
    const sp = [...new Set($('#pt-sp', w).value.split(/[,，、]/).map(x => x.trim()).filter(Boolean).map(x => byName.get(x.toLowerCase()) || x.slice(0, 20)))].slice(0, PT_MAX_SP);
    const memo = $('#pt-memo', w).value.trim().slice(0, 300);
    const d = { id: old ? old.id : rid(10), name: name.slice(0, 30), kind: $('#pt-kind', w).value, lat, lon, sp, memo, pub: $('#pt-pub', w).checked, ts: (old && old.ts) || nowMs(), upd: nowMs() };
    if (old && old.hidden) d.hidden = true;
    $('#pt-go', w).disabled = true;
    if (await store.savePoint(d)) { closeModal(w); toast(t(d.pub ? 'pt_saved_shared' : 'pt_saved'), 'ok'); S.ptTab = 'mine'; if (S.route !== 'points') location.hash = 'points'; else rerender(); }
    else $('#pt-go', w).disabled = false;
  });
  setTimeout(() => { const n = $('#pt-name', w); if (n && !n.value) n.focus(); }, 60);
}
document.addEventListener('click', e => {
  if (e.target.closest('.modal-wrap')) return;
  const nw = e.target.closest('[data-ptnew]'); if (nw) { openPointEdit(null); return; }
  const pt = e.target.closest('[data-point]'); if (pt) { openPoint(pt.dataset.point); return; }
  const tb = e.target.closest('[data-pttab]'); if (tb) { S.ptTab = tb.dataset.pttab; rerender(); }
});
