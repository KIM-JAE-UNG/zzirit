/* ===== Web runtime: Supabase stands in for the Claude artifact runtime (claude.use) =====
   The rest of the app talks to `claude.use('db' | 'user' | 'sample')` exactly as it does inside Claude.
   Here those calls are served by Supabase: anonymous accounts, Postgres tables guarded by row-level
   security, realtime updates, and an Edge Function that holds the Claude API key. */
(function () {
  const CFG = window.APP_CFG;
  if (!CFG || !window.supabase || (window.claude && window.claude.use)) return;
  window.APP_RT = 'web';
  const sb = window.supabase.createClient(CFG.url, CFG.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'eosin.auth' }
  });
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const mkErr = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };

  /* ---- session: one anonymous account per browser ---- */
  let sessP = null, authErr = null;
  function session() {
    if (!sessP) sessP = (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (data && data.session) return data.session;
        const r = await sb.auth.signInAnonymously();
        if (r.error) { authErr = r.error; console.warn('[auth]', r.error.message); return null; }
        return r.data.session;
      } catch (e) { authErr = e; console.warn('[auth]', e); return null; }
    })();
    return sessP;
  }
  async function token() { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; }
  window.APP_AUTH = { sb, session, error: () => authErr };

  /* ---- document paths → tables ---- */
  function route(path) {
    const p = String(path).split('/');
    if (p[0] === 'anglers' && p.length === 2) return { t: 'anglers', k: { id: p[1] }, conflict: 'id' };
    if (p[0] === 'anglers' && p[2] === 'photos' && p.length === 4) return { t: 'photos', k: { angler: p[1], cid: p[3] }, conflict: 'angler,cid' };
    if ((p[0] === 'labels' || p[0] === 'orders' || p[0] === 'suggest') && p.length === 2) return { t: p[0], k: { id: p[1] }, conflict: 'id' };
    if (p[0] === 'admin' && p.length === 2) return { t: 'admin_docs', k: { id: p[1] }, conflict: 'id' };
    return null;
  }
  const COLL = { anglers: 'anglers', labels: 'labels', orders: 'orders', suggest: 'suggest', admin: 'admin_docs' };
  function dbErr(e) {
    const m = (e && (e.message || e.details)) || String(e);
    if (e && e.code === '42501') return mkErr('not_granted', m);
    if (/doc_too_large|check constraint|too large/i.test(m)) return mkErr('quota_exceeded', m);
    if (/JWT|not authenticated|permission denied/i.test(m)) return mkErr('not_granted', m);
    return mkErr('unavailable', m);
  }

  /* ---- precise catch locations: the public row only keeps a 0.25° cell, the exact spot is private ---- */
  const SPOTS_KEY = 'eosin.spots';
  let mySpots = {}; try { mySpots = JSON.parse(localStorage.getItem(SPOTS_KEY) || '{}') || {}; } catch (e) { mySpots = {}; }
  const saveSpots = () => { try { localStorage.setItem(SPOTS_KEY, JSON.stringify(mySpots)); } catch (e) { } };
  let myId = null, spotsLoaded = null;
  function loadSpots() {
    if (!spotsLoaded) spotsLoaded = (async () => {
      const s = await session(); if (!s) return;
      myId = s.user.id;
      const { data } = await sb.from('spots').select('cid,lat,lon');
      if (Array.isArray(data)) { for (const r of data) if (r.lat != null) mySpots[r.cid] = [r.lat, r.lon]; saveSpots(); }
    })();
    return spotsLoaded;
  }
  function withSpots(id, d) {
    if (!d || id !== myId || !Array.isArray(d.catches)) return d;
    for (const c of d.catches) { const p = mySpots[c.id]; if (p) { c.lat = p[0]; c.lon = p[1]; } }
    return d;
  }
  function rememberSpots(d) {
    if (!d || !Array.isArray(d.catches)) return;
    for (const c of d.catches) if (c && c.id && c.lat != null && c.lon != null) mySpots[c.id] = [c.lat, c.lon];
    saveSpots();
  }

  function snapOf(table, id, row) {
    let data = row ? clone(row.data) : undefined;
    if (data && table === 'anglers') data = withSpots(id, data);
    return { id, exists: !!row, data: () => clone(data), metadata: { fromCache: false, hasPendingWrites: false } };
  }
  const keyOf = (table, row) => (table === 'photos' ? row.cid : row.id);
  function subscribe(table, filter, onChange) {
    const ch = sb.channel('rt-' + table + '-' + Math.random().toString(36).slice(2, 9));
    ch.on('postgres_changes', Object.assign({ event: '*', schema: 'public', table }, filter ? { filter } : {}), p => { try { onChange(p); } catch (e) { console.warn(e); } });
    ch.subscribe();
    return () => { try { sb.removeChannel(ch); } catch (e) { } };
  }

  function docRef(path) {
    const r = route(path);
    const id = String(path).split('/').pop();
    return {
      id, path,
      async get() {
        if (!r) throw mkErr('invalid_argument', path);
        await session(); if (r.t === 'anglers') await loadSpots();
        const { data, error } = await sb.from(r.t).select('*').match(r.k).maybeSingle();
        if (error) throw dbErr(error);
        return snapOf(r.t, id, data);
      },
      async set(d) {
        if (!r) throw mkErr('invalid_argument', path);
        const s = await session(); if (!s) throw mkErr('not_granted', 'not signed in');
        if (r.t === 'anglers') rememberSpots(d);
        const { error } = await sb.from(r.t).upsert(Object.assign({}, r.k, { data: d }), { onConflict: r.conflict });
        if (error) throw dbErr(error);
      },
      async update(d) { const cur = await this.get(); return this.set(Object.assign(cur.exists ? cur.data() : {}, d)); },
      async delete() {
        if (!r) throw mkErr('invalid_argument', path);
        const s = await session(); if (!s) throw mkErr('not_granted', 'not signed in');
        const { error } = await sb.from(r.t).delete().match(r.k);
        if (error) throw dbErr(error);
      },
      onSnapshot(next, onErr) {
        if (!r) { if (onErr) onErr(mkErr('invalid_argument', path)); return () => { }; }
        let stop = null, dead = false;
        const pull = async () => {
          const { data, error } = await sb.from(r.t).select('*').match(r.k).maybeSingle();
          if (dead) return;
          if (error) { if (onErr) onErr(dbErr(error)); return; }
          next(snapOf(r.t, id, data));
        };
        (async () => {
          await session(); if (r.t === 'anglers') await loadSpots();
          await pull();
          if (dead) return;
          const f = Object.entries(r.k).map(([k, v]) => `${k}=eq.${v}`)[0];
          stop = subscribe(r.t, f, () => pull());
        })();
        return () => { dead = true; if (stop) stop(); };
      },
      collection(sub) { return collRef(path + '/' + sub); }
    };
  }

  function collRef(path) {
    const table = COLL[path];
    let lim = 1000;
    const q = {
      path,
      limit(n) { lim = Math.min(n || 1000, 1000); return q; },
      where() { return q; }, orderBy() { return q; },
      doc(id) { return docRef(path + '/' + id); },
      async get() {
        if (!table) throw mkErr('invalid_argument', path);
        await session(); if (table === 'anglers') await loadSpots();
        const { data, error } = await sb.from(table).select('*').limit(lim);
        if (error) throw dbErr(error);
        const docs = (data || []).map(row => snapOf(table, keyOf(table, row), row));
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [] };
      },
      onSnapshot(next, onErr) {
        if (!table) { if (onErr) onErr(mkErr('invalid_argument', path)); return () => { }; }
        const rows = new Map(); let stop = null, dead = false, timer = null;
        const emit = () => {
          if (dead) return;
          const docs = [...rows].map(([k, row]) => snapOf(table, k, row));
          next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} });
        };
        const emitSoon = () => { clearTimeout(timer); timer = setTimeout(emit, 120); };
        const refetch = async ids => {
          if (!ids.length) return;
          const col = table === 'photos' ? 'cid' : 'id';
          const { data, error } = await sb.from(table).select('*').in(col, ids);
          if (error) { if (onErr) onErr(dbErr(error)); return; }
          const got = new Set();
          for (const row of data || []) { rows.set(keyOf(table, row), row); got.add(keyOf(table, row)); }
          for (const id of ids) if (!got.has(id)) rows.delete(id);
          emitSoon();
        };
        (async () => {
          await session(); if (table === 'anglers') await loadSpots();
          const { data, error } = await sb.from(table).select('*').limit(lim);
          if (dead) return;
          if (error) { if (onErr) onErr(dbErr(error)); return; }
          for (const row of data || []) rows.set(keyOf(table, row), row);
          emit();
          const pending = new Set(); let ptimer = null;
          stop = subscribe(table, null, p => {
            const row = p.new && Object.keys(p.new).length ? p.new : null;
            const old = p.old || {};
            const k = row ? keyOf(table, row) : keyOf(table, old);
            if (!k) return;
            if (p.eventType === 'DELETE') { rows.delete(k); emitSoon(); return; }
            if (row && row.data !== undefined) { rows.set(k, row); emitSoon(); return; }
            pending.add(k); clearTimeout(ptimer);
            ptimer = setTimeout(() => { const ids = [...pending]; pending.clear(); refetch(ids); }, 150);
          });
        })();
        return () => { dead = true; clearTimeout(timer); if (stop) stop(); };
      }
    };
    return q;
  }
  const db = { doc: docRef, collection: collRef };

  /* ---- who is viewing ---- */
  let adminP = null;
  const userNs = {
    async id() { const s = await session(); return s ? s.user.id : null; },
    async isOwner() {
      if (!adminP) adminP = (async () => { const s = await session(); if (!s) return false; const { data, error } = await sb.rpc('is_admin'); return !error && data === true; })();
      return adminP;
    },
    async canEdit() { return !!(await session()); },
    async can() { return !!(await session()); },
    async me() { const s = await session(); return { id: s ? s.user.id : '', name: '', avatarUrl: '', color: '#888', email: null, isOwner: await userNs.isOwner(), canEdit: !!s }; },
    async profiles() { return {}; }
  };

  /* ---- Claude through the Edge Function ---- */
  async function callAI(body, signal) {
    const tk = await token();
    if (!tk) throw mkErr('not_granted', 'not signed in');
    let r;
    try {
      r = await fetch(CFG.url + '/functions/v1/ai', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + tk }, body: JSON.stringify(body) });
    } catch (e) {
      if (e && e.name === 'AbortError') throw mkErr('cancelled');
      throw mkErr('unavailable', String(e && e.message || e));
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw mkErr((j.error && j.error.code) || 'unavailable', (j.error && j.error.message) || String(r.status));
    return j;
  }
  function b64(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  }
  let aiStatus = null;
  async function status() {
    if (!aiStatus) aiStatus = callAI({ mode: 'status' }).catch(() => ({ ai: false, images: false }));
    return aiStatus;
  }
  const sample = async function (input, opts) {
    opts = opts || {};
    const j = await callAI({ mode: 'text', input, modelTier: opts.modelTier || 'default' }, opts.signal);
    if (opts.onText) { try { opts.onText({ text: j.text, delta: j.text }); } catch (e) { } }
    return { text: j.text, truncated: !!j.truncated, modelTierApplied: opts.modelTier || 'default', modelApplied: j.modelApplied };
  };
  sample.json = async function (input, opts) {
    opts = opts || {};
    const images = [];
    for (const b of (opts.images || []).slice(0, 2)) images.push({ type: b.type || 'image/jpeg', data: await b64(b) });
    const j = await callAI({ mode: 'json', input, images, modelTier: opts.modelTier || 'default', ticket: true }, opts.signal);
    const v = j.value;
    if (v && typeof v === 'object' && j.ticket) Object.defineProperty(v, '__ticket', { value: j.ticket, enumerable: false });
    return v;
  };
  sample.limits = async function () {
    const st = await status();
    return { maxPromptBytes: 200000, images: st.images ? { maxCount: 2, maxInputBytes: 5000000, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } : null, tools: null };
  };

  window.claude = {
    async use(name) {
      if (name === 'db') { session(); return db; }
      if (name === 'user') { const s = await session(); return s ? userNs : null; }
      if (name === 'sample') { const s = await session(); if (!s) return null; const st = await status(); return st.ai ? sample : null; }
      return null;
    }
  };
})();
