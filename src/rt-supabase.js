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
  // A copy of the last sign-in: if a token refresh fails during a short server hiccup, supabase-js drops the session,
  // and starting a new anonymous account would make the person's records vanish from this device. Try the copy first.
  const BK = 'eosin.auth.bk';
  const saveBk = s => { try { if (s && s.refresh_token) localStorage.setItem(BK, JSON.stringify({ a: s.access_token, r: s.refresh_token, u: s.user && s.user.id })); } catch (e) { } };
  const dropBk = () => { try { localStorage.removeItem(BK); } catch (e) { } };
  try { sb.auth.onAuthStateChange((ev, s) => { if (s) saveBk(s); }); } catch (e) { }
  let sessP = null, authErr = null;
  function session() {
    if (!sessP) sessP = (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (data && data.session) { saveBk(data.session); return data.session; }
        let bk = null; try { bk = JSON.parse(localStorage.getItem(BK) || 'null'); } catch (e) { bk = null; }
        if (bk && bk.r) {
          try {
            const rs = await sb.auth.setSession({ access_token: bk.a || '', refresh_token: bk.r });
            if (!rs.error && rs.data && rs.data.session) { console.info('[auth] sign-in restored'); return rs.data.session; }
          } catch (e) { console.warn('[auth] restore failed', e); }
        }
        const r = await sb.auth.signInAnonymously();
        if (r.error) { authErr = r.error; console.warn('[auth]', r.error.message); return null; }
        return r.data.session;
      } catch (e) { authErr = e; console.warn('[auth]', e); return null; }
    })();
    return sessP;
  }
  async function token() { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; }
  /* One account can be used on several devices: each device signs in on its own, then a link code ties it to the
     account that holds the records. acct() is that account's id (the database checks the same mapping). */
  let acctP = null, authId = null, acctId = null;
  function acct() {
    if (!acctP) acctP = (async () => {
      const s = await session(); if (!s) return null;
      authId = s.user.id; acctId = authId;
      try { const { data, error } = await sb.rpc('my_acct'); if (!error && typeof data === 'string' && data) acctId = data; } catch (e) { }
      return acctId;
    })();
    return acctP;
  }
  // what went wrong, as a short code the app can explain (a missing server function means the server update isn't in yet)
  function rpcCode(error) {
    const m = String((error && (error.message || error.details)) || '');
    if ((error && error.code === 'PGRST202') || /could not find the function|schema cache/i.test(m)) return 'need_update';
    if (/cannot_delete_self/.test(m)) return 'self';
    if (/not_admin/.test(m)) return 'not_admin';
    if (/no_account/.test(m)) return 'no_account';
    if (/team_leader/i.test(m)) return 'team_leader';
    if (/slow|rate limit/i.test(m)) return 'slow';
    if (/bad_code|expired/i.test(m)) return 'bad_code';
    return 'unavailable';
  }
  async function rpcOrThrow(name, args) {
    const s = await session(); if (!s) throw mkErr('not_granted', 'not signed in');
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw mkErr(rpcCode(error), error.message);
    return data;
  }
  const link = {
    create: () => rpcOrThrow('link_create'),
    async redeem(code) { const r = await rpcOrThrow('link_redeem', { p_code: code }); if (!r || r.ok !== true) throw mkErr((r && r.err) || 'bad_code', (r && r.err) || 'bad_code'); return r.acct; },
    leave: () => rpcOrThrow('link_leave'),
    linked: () => !!(authId && acctId && authId !== acctId)
  };
  const callFn = async name => {
    const tk = await token();
    const r = await fetch(CFG.url + '/functions/v1/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + (tk || CFG.key) }, body: '{}' });
    return r.ok;
  };
  const news = { refresh: () => callFn('news') };
  // the automatic reviewer runs on its own every few minutes; a fresh catch just nudges it (it ignores extra nudges)
  const review = { ping: () => callFn('review').catch(() => false) };
  // operator only (checked on the server): remove an account with everything it posted; which account has which ID;
  // a one-time code that brings someone back to an account they lost
  const admin = {
    deleteUser: uid => rpcOrThrow('admin_delete_user', { p_uid: uid }),
    async canDelete() { try { await rpcOrThrow('admin_delete_user', { p_uid: null }); return true; } catch (e) { return e.code === 'need_update' ? false : null; } },
    logins: () => rpcOrThrow('admin_logins'),
    linkCode: uid => rpcOrThrow('admin_link_code', { p_acct: uid })
  };
  // login ID + password: the server keeps only a hash; logging in joins this device to that account
  const ids = {
    me: () => rpcOrThrow('id_me'),
    register: (name, pass) => rpcOrThrow('id_register', { p_name: name, p_pass: pass }),
    login: (name, pass) => rpcOrThrow('id_login', { p_name: name, p_pass: pass }),
    password: (o, n) => rpcOrThrow('id_password', { p_old: o, p_new: n }),
    adminReset: (name, pass) => rpcOrThrow('admin_id_reset', { p_name: name, p_new: pass }),
    async logout() { dropBk(); try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { } dropBk(); }
  };
  window.APP_AUTH = { sb, session, acct, link, news, review, admin, ids, error: () => authErr };

  /* ---- document paths → tables ---- */
  function route(path) {
    const p = String(path).split('/');
    if (p[0] === 'anglers' && p.length === 2) return { t: 'anglers', k: { id: p[1] }, conflict: 'id' };
    if (p[0] === 'anglers' && p[2] === 'photos' && p.length === 4) return { t: 'photos', k: { angler: p[1], cid: p[3] }, conflict: 'angler,cid' };
    if ((p[0] === 'labels' || p[0] === 'orders' || p[0] === 'suggest' || p[0] === 'board' || p[0] === 'teams' || p[0] === 'points') && p.length === 2) return { t: p[0], k: { id: p[1] }, conflict: 'id' };
    if (p[0] === 'reviews' && p.length === 2) return { t: 'reviews', k: { id: p[1] }, conflict: 'id', ro: true };
    if (p[0] === 'news' && p.length === 2) return { t: 'news', k: { id: p[1] }, conflict: 'id', ro: true };
    if (p[0] === 'admin' && p.length === 2) return { t: 'admin_docs', k: { id: p[1] }, conflict: 'id' };
    return null;
  }
  const COLL = { anglers: 'anglers', labels: 'labels', orders: 'orders', suggest: 'suggest', admin: 'admin_docs', board: 'board', teams: 'teams', news: 'news', points: 'points', reviews: 'reviews' };
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
      myId = await acct();
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
    let data = row ? (table === 'news' ? { lang: row.lang, title: row.title, link: row.link, source: row.source, pub: row.pub, score: row.score, fetched_at: row.fetched_at } : clone(row.data)) : undefined;
    if (data && table === 'points') data = Object.assign({}, data, { _owner: row.owner, _upd: row.updated_at });
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
        if (!r || r.ro) throw mkErr('invalid_argument', path);
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
    async id() { const s = await session(); return s ? await acct() : null; },
    async isOwner() {
      if (!adminP) adminP = (async () => { const s = await session(); if (!s) return false; const { data, error } = await sb.rpc('is_admin'); return !error && data === true; })();
      return adminP;
    },
    async canEdit() { return !!(await session()); },
    async can() { return !!(await session()); },
    async me() { const s = await session(); return { id: s ? await acct() : '', name: '', avatarUrl: '', color: '#888', email: null, isOwner: await userNs.isOwner(), canEdit: !!s }; },
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
