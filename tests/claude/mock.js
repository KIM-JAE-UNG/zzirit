(function(){
  const qs = new URLSearchParams(location.search);
  const UID = qs.get('uid') || 'u_test', OWNER = qs.get('owner') === '1';
  let store = new Map(), ver = -1; const subs = new Set();
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  async function pull() { try { const r = await fetch('/__db'); const j = await r.json(); if (j.ver !== ver) { ver = j.ver; store = new Map(Object.entries(j.data)); for (const f of subs) try { f(); } catch (e) { console.error(e); } } } catch (e) { } }
  const ready = pull(); setInterval(pull, 250);
  async function push(path, data) { await fetch('/__db', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, data }) }); await pull(); }
  function docSnap(path) { const v = store.get(path); return { id: path.split('/').pop(), exists: !!v, data: () => v ? clone(v) : undefined, metadata: { fromCache: false, hasPendingWrites: false } }; }
  function colDocs(path) { const segs = path.split('/').length; const out = []; for (const [k] of store) if (k.startsWith(path + '/') && k.split('/').length === segs + 1) out.push(docSnap(k)); return out; }
  const db = {
    doc(path) { return { id: path.split('/').pop(), path,
      get: async () => { await ready; return docSnap(path); },
      set: async d => push(path, clone(d)),
      update: async d => push(path, Object.assign(clone(store.get(path)) || {}, clone(d))),
      delete: async () => push(path, null),
      onSnapshot(next) { const f = () => next(docSnap(path)); subs.add(f); ready.then(f); return () => subs.delete(f); },
      collection(p) { return db.collection(path + '/' + p); } }; },
    collection(path) { const q = { path, limit() { return q; }, where() { return q; }, orderBy() { return q; },
      get: async () => { await ready; const d = colDocs(path); return { docs: d, size: d.length, empty: !d.length, docChanges: () => [] }; },
      onSnapshot(next) { const f = () => { const d = colDocs(path); next({ docs: d, size: d.length, empty: !d.length, docChanges: () => [], metadata: {} }); }; subs.add(f); ready.then(f); return () => subs.delete(f); },
      doc(id) { return db.doc(path + '/' + id); } }; return q; }
  };
  const sample = async function (input, opts) { const text = 'ok'; if (opts && opts.onText) opts.onText({ text, delta: text }); return { text, truncated: false }; };
  sample.json = async () => ({ fish_visible: true, candidates: [{ id: 'kurodai', p: .8 }], length_cm: 40, screening: { real_photo: .95 }, verdict: 'pass', reasons: [], features: '' });
  sample.limits = async () => ({ images: { maxCount: 5 } });
  const user = { id: async () => UID, isOwner: async () => OWNER, canEdit: async () => true, can: async () => true };
  window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : n === 'sample' ? sample : null };
})();
