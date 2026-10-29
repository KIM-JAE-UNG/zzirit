// Minimal stand-in for supabase-js (only what the web runtime shim uses), talking to the fake backend
(function () {
  const post = (p, b) => fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  const ANON_OFF = new URLSearchParams(location.search).get('anonoff') === '1';
  function createClient(url, key, opts) {
    const SK = (opts && opts.auth && opts.auth.storageKey) || 'sb-auth';
    const load = () => { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { return null; } };
    let session = load();
    const uid = () => session && session.user.id;
    const subsAuth = [];
    const tell = ev => { for (const f of subsAuth) try { f(ev, session); } catch (e) { } };
    const auth = {
      async getSession() { return { data: { session } }; },
      async signInAnonymously() {
        if (ANON_OFF) return { data: {}, error: { message: 'Anonymous sign-ins are disabled', code: 'anonymous_provider_disabled' } };
        const id = 'u-' + Math.random().toString(36).slice(2, 10);
        session = { access_token: 'tok-' + Math.random().toString(36).slice(2), refresh_token: 'rt-' + id, user: { id, is_anonymous: true } };
        localStorage.setItem(SK, JSON.stringify(session)); tell('SIGNED_IN'); return { data: { session, user: session.user }, error: null };
      },
      // like the real client: a saved refresh token brings the same account back (a broken one does not)
      async setSession({ refresh_token }) {
        const m = /^rt-(u-[a-z0-9]+)$/.exec(refresh_token || '');
        if (!m) return { data: { session: null }, error: { message: 'Invalid Refresh Token' } };
        session = { access_token: 'tok-' + Math.random().toString(36).slice(2), refresh_token, user: { id: m[1], is_anonymous: true } };
        localStorage.setItem(SK, JSON.stringify(session)); tell('TOKEN_REFRESHED'); return { data: { session }, error: null };
      },
      onAuthStateChange(cb) { subsAuth.push(cb); return { data: { subscription: { unsubscribe() { } } } }; },
      async signOut() { session = null; localStorage.removeItem(SK); tell('SIGNED_OUT'); return { error: null }; }
    };
    function from(table) {
      const st = { table, match: null, in: null, limit: 1000, op: 'select', single: false, order: null, row: null };
      const run = async () => {
        if (st.op === 'select') { const r = await post('/__sb/select', { table, match: st.match, in: st.in, limit: st.limit, order: st.order, uid: uid() }); if (r.error) return { data: null, error: r.error }; return { data: st.single ? (r.data[0] || null) : r.data, error: null }; }
        if (st.op === 'insert') { const r = await post('/__sb/insert', { table, row: st.row, uid: uid() }); if (r.error) return { data: null, error: r.error }; return { data: st.single ? r.data : [r.data], error: null }; }
        if (st.op === 'delete') { const r = await post('/__sb/delete', { table, match: st.match, uid: uid() }); return { data: null, error: r.error || null }; }
      };
      const qb = {
        select() { if (st.op !== 'delete' && st.op !== 'insert') st.op = 'select'; return qb; },
        order(col, o) { st.order = { col, asc: !(o && o.ascending === false) }; return qb; },
        insert(row) { st.op = 'insert'; st.row = row; return qb; },
        single() { st.single = true; return qb; },
        limit(n) { st.limit = n; return qb; },
        match(m) { st.match = m; return qb; },
        eq(c, v) { st.match = Object.assign(st.match || {}, { [c]: v }); return qb; },
        in(col, vals) { st.in = { col, vals }; return qb; },
        maybeSingle() { st.single = true; return qb; },
        delete() { st.op = 'delete'; return qb; },
        upsert(row) { return post('/__sb/upsert', { table, row, uid: uid() }).then(r => ({ data: null, error: r.error || null })); },
        then(res, rej) { return run().then(res, rej); }
      };
      return qb;
    }
    async function rpc(name, args) { const r = await post('/__sb/rpc', { name, args: args || {}, uid: uid() }); return { data: r.data, error: r.error || null }; }
    // realtime: one shared poller per client
    const chans = new Set(); let since = 0, polling = false;
    async function poll() {
      if (polling) return; polling = true;
      try { const r = await fetch('/__sb/changes?since=' + since + '&uid=' + encodeURIComponent(uid() || '')).then(x => x.json()); if (!since) { since = r.ver; } else { for (const e of r.events) { since = Math.max(since, e.ver); for (const ch of chans) ch._deliver(e); } } } catch (e) { }
      polling = false;
    }
    setInterval(poll, 250); poll();
    // presence + broadcast rooms (the park): joined, tracked and relayed by the fake server, polled every 200 ms
    const CID = 'c-' + Math.random().toString(36).slice(2, 10); const rooms = new Map(); let rtBusy = false;
    async function rtPoll() {
      if (!rooms.size || rtBusy) return; rtBusy = true;
      try { const r = await post('/__sb/rt/poll', { cid: CID }); for (const m of r.msgs || []) { const ch = rooms.get(m.topic); if (ch) ch._rt(m); } } catch (e) { }
      rtBusy = false;
    }
    setInterval(rtPoll, 200);
    function channel(name, opts) {
      const subs = [];
      const conf = (opts && opts.config) || {}; const presKey = conf.presence && conf.presence.key; let state = {};
      const ch = {
        on(kind, filter, cb) { subs.push({ kind, filter, cb }); return ch; },
        subscribe(cb) {
          chans.add(ch);
          if (presKey || subs.some(x => x.kind === 'presence' || x.kind === 'broadcast')) { ch._topic = name; rooms.set(name, ch); post('/__sb/rt/join', { cid: CID, topic: name, key: presKey || CID }).then(() => { if (cb) cb('SUBSCRIBED'); }); }
          else if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
          return ch;
        },
        track(payload) { return post('/__sb/rt/track', { cid: CID, topic: name, payload }).then(() => 'ok'); },
        untrack() { return post('/__sb/rt/track', { cid: CID, topic: name, payload: null }).then(() => 'ok'); },
        send(m) { return post('/__sb/rt/send', { cid: CID, topic: name, event: m.event, payload: m.payload }).then(() => 'ok'); },
        presenceState() { return state; },
        _rt(m) {
          if (m.type === 'presence') { state = m.state; for (const x of subs) if (x.kind === 'presence' && x.filter.event === 'sync') x.cb(); }
          else if (m.type === 'broadcast') { for (const x of subs) if (x.kind === 'broadcast' && x.filter.event === m.event) x.cb({ type: 'broadcast', event: m.event, payload: m.payload }); }
        },
        _deliver(e) {
          for (const s of subs) {
            if (s.kind !== 'postgres_changes' || s.filter.table !== e.table) continue;
            if (s.filter.filter) { const [col, rest] = s.filter.filter.split('='); const val = rest.replace(/^eq\./, ''); const rec = e.eventType === 'DELETE' ? e.old : e.new; if (String(rec[col]) !== val) continue; }
            s.cb({ eventType: e.eventType, new: e.new, old: e.old, table: e.table });
          }
        }
      };
      return ch;
    }
    return { auth, from, rpc, channel, removeChannel(ch) { chans.delete(ch); if (ch._topic && rooms.get(ch._topic) === ch) { rooms.delete(ch._topic); post('/__sb/rt/leave', { cid: CID, topic: ch._topic }); } } };
  }
  window.supabase = { createClient };
})();
