/* ===== Map: satellite base (NASA Blue Marble), vector overlays (Natural Earth / KOSTAT), big-data heat grid ===== */
const MAPX = (() => {
  let D = null, loading = null;
  const PAL = ['#0b2a6f', '#1453c7', '#18a3d8', '#21c48a', '#c6e33a', '#ffd21f', '#ff8a14', '#e8231a'];
  const palCache = PAL.map(h => FD.mix(h, h, 0));
  function palColor(v) { v = Math.max(0, Math.min(.9999, v)); const f = v * (PAL.length - 1), i = Math.floor(f), t = f - i; return FD.mix(PAL[i], PAL[i + 1], t); }

  function img(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  async function json(src) { try { const r = await fetch(src); return r.ok ? await r.json() : null; } catch (e) { return null; } }

  /* --- decoding & spatial index --- */
  function decLine(e, q) { const n = e.length / 2, out = new Float64Array(e.length); let x = 0, y = 0; for (let i = 0; i < e.length; i += 2) { x += e[i]; y += e[i + 1]; out[i] = x / q; out[i + 1] = y / q; } return out; }
  function bboxOf(a) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < a.length; i += 2) { const x = a[i], y = a[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }
  class Index {
    constructor(cell) { this.cell = cell; this.b = new Map(); this.items = []; }
    add(it) { const [x0, y0, x1, y1] = it.bb, c = this.cell; this.items.push(it); it.k = this.items.length;
      for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) for (let gy = Math.floor(y0 / c); gy <= Math.floor(y1 / c); gy++) { const key = gx + ',' + gy; let a = this.b.get(key); if (!a) this.b.set(key, a = []); a.push(it); } }
    query(x0, y0, x1, y1) { const c = this.cell, out = [], seen = new Set();
      for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) for (let gy = Math.floor(y0 / c); gy <= Math.floor(y1 / c); gy++) { const a = this.b.get(gx + ',' + gy); if (!a) continue; for (const it of a) { if (seen.has(it.k)) continue; seen.add(it.k); const b = it.bb; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue; out.push(it); } }
      return out; }
  }
  function lineIndex(list, q, cell, extra) {
    const ix = new Index(cell);
    for (const e of list || []) {
      const a = decLine(e, q);
      // split long lines into chunks for tighter boxes
      const step = 120;
      for (let s = 0; s < a.length - 2; s += step * 2) { const sub = a.subarray(s, Math.min(a.length, s + step * 2 + 2)); if (sub.length < 4) continue; ix.add(Object.assign({ a: sub, bb: bboxOf(sub) }, extra || {})); }
    }
    return ix;
  }
  function polyIndex(list, q, cell, extra) {
    const ix = new Index(cell);
    for (const p of list || []) { const rings = p.map(r => decLine(r, q)); ix.add(Object.assign({ r: rings, bb: bboxOf(rings[0]) }, extra || {})); }
    return ix;
  }

  function load() {
    if (loading) return loading;
    loading = (async () => {
      const [sat, night, coast, urban, roads, bathy, fresh, places] = await Promise.all([
        img('geo/sat.jpg'), img('geo/night.jpg'), json('geo/coast.json'), json('geo/urban.json'), json('geo/roads.json'), json('geo/bathy.json'), json('geo/fresh.json'), json('geo/places.json'), GEO.loadEnv()]);
      const d = { sat, night, places: places || [] };
      if (coast) { d.coastW = lineIndex(coast.W.l, coast.W.q, 10); d.coastE1 = lineIndex(coast.E1.l, coast.E1.q, 2); d.coastE2 = lineIndex(coast.E2.l, coast.E2.q, .5); }
      if (urban) { d.urbanE = polyIndex(urban.E.p, urban.E.q, 1); d.urbanW = polyIndex(urban.W.p, urban.W.q, 5); }
      if (roads) { d.roadsE = {}; for (const k in roads.E) d.roadsE[k] = lineIndex(roads.E[k], roads.q, 1, { c: +k }); d.roadsW = lineIndex(roads.W, 100, 5, { c: 1 }); }
      if (bathy) { d.bathy = {}; for (const k in bathy.d) d.bathy[k] = { E: lineIndex(bathy.d[k].E, bathy.qE, 2), W: lineIndex(bathy.d[k].W, bathy.qW, 10) }; }
      if (fresh) { d.lakesE = polyIndex(fresh.lakes.E, 1000, 1); d.lakesW = polyIndex(fresh.lakes.W, 100, 5); d.riversE = lineIndex(fresh.rivers.E, 1000, 1); d.riversW = lineIndex(fresh.rivers.W, 100, 5); }
      D = d; return d;
    })();
    return loading;
  }

  /* --- projection helpers for a tile --- */
  const tile2lat = (y, n) => { const t = Math.PI * (1 - 2 * y / n); return Math.atan(Math.sinh(t)) * 180 / Math.PI; };
  function tileCtx(coords, size) {
    const n = 2 ** coords.z, x = ((coords.x % n) + n) % n, y = coords.y;
    const lon0 = x / n * 360 - 180, lon1 = (x + 1) / n * 360 - 180, lat0 = tile2lat(y + 1, n), lat1 = tile2lat(y, n);
    const sc = size * n;
    const px = lon => (lon + 180) / 360 * sc - x * size;
    const py = lat => { const s = Math.min(.9999, Math.max(-.9999, Math.sin(lat * Math.PI / 180))); return (.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * sc - y * size; };
    return { n, x, y, z: coords.z, lon0, lon1, lat0, lat1, px, py, size };
  }
  function mkCanvas(size) { const dpr = Math.min(2, window.devicePixelRatio || 1); const c = document.createElement('canvas'); c.width = size * dpr; c.height = size * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; }

  function drawLines(ctx, T, ix, skip) {
    if (!ix) return;
    const pad = (T.lon1 - T.lon0) * .05;
    for (const it of ix.query(T.lon0 - pad, T.lat0 - pad, T.lon1 + pad, T.lat1 + pad)) {
      if (skip && skip(it)) continue;
      const a = it.a; ctx.moveTo(T.px(a[0]), T.py(a[1]));
      for (let i = 2; i < a.length; i += 2) ctx.lineTo(T.px(a[i]), T.py(a[i + 1]));
    }
  }
  function drawPolys(ctx, T, ix) {
    if (!ix) return;
    for (const it of ix.query(T.lon0, T.lat0, T.lon1, T.lat1)) for (const a of it.r) { ctx.moveTo(T.px(a[0]), T.py(a[1])); for (let i = 2; i < a.length; i += 2) ctx.lineTo(T.px(a[i]), T.py(a[i + 1])); ctx.closePath(); }
  }

  /* --- Leaflet layers --- */
  function makeLayers(L) {
    const Sat = L.GridLayer.extend({
      options: { tileSize: 256, keepBuffer: 4, updateWhenZooming: false },
      createTile(coords, done) {
        const size = this.getTileSize().x; const [c, ctx] = mkCanvas(size);
        const T = tileCtx(coords, size);
        const draw = () => {
          const im = this.options.night ? D && D.night : D && D.sat;
          if (!im) { ctx.fillStyle = '#0b2a3a'; ctx.fillRect(0, 0, size, size); return; }
          const W = im.width, H = im.height; ctx.imageSmoothingQuality = 'high';
          const sx = (T.lon0 + 180) / 360 * W, sw = (T.lon1 - T.lon0) / 360 * W;
          const step = 4;
          for (let j = 0; j < size; j += step) {
            const latA = tile2lat(T.y + j / size, T.n), latB = tile2lat(T.y + (j + step) / size, T.n);
            const sy = (90 - latA) / 180 * H, sh = Math.max(.25, (latA - latB) / 180 * H);
            ctx.drawImage(im, sx, sy, sw, sh, 0, j, size, step + .5);
          }
          if (this.options.night) { ctx.fillStyle = 'rgba(5,10,30,.15)'; ctx.fillRect(0, 0, size, size); }
        };
        if (D) { draw(); setTimeout(() => done(null, c), 0); } else load().then(() => { draw(); done(null, c); });
        return c;
      }
    });
    const Vec = L.GridLayer.extend({
      options: { tileSize: 256, keepBuffer: 3, updateWhenZooming: false },
      createTile(coords, done) {
        const size = this.getTileSize().x; const [c, ctx] = mkCanvas(size);
        const go = () => { try { this.paint(ctx, tileCtx(coords, size)); } catch (e) { console.warn(e); } done(null, c); };
        if (D) setTimeout(go, 0); else load().then(go);
        return c;
      },
      paint(ctx, T) {
        const o = this.options.toggles(), z = T.z, ea = T.lon1 > GEO.EA_BOX[0] && T.lon0 < GEO.EA_BOX[2] && T.lat1 > GEO.EA_BOX[1] && T.lat0 < GEO.EA_BOX[3];
        const outsideEA = it => { const b = it.bb; return (b[0] + b[2]) / 2 > GEO.EA_BOX[0] && (b[0] + b[2]) / 2 < GEO.EA_BOX[2] && (b[1] + b[3]) / 2 > GEO.EA_BOX[1] && (b[1] + b[3]) / 2 < GEO.EA_BOX[3]; };
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (o.bathy && z >= 3 && D.bathy) {
          const cols = { '200': 'rgba(150,215,255,.55)', '1000': 'rgba(120,180,240,.35)', '2000': 'rgba(100,150,230,.25)' };
          for (const k of ['2000', '1000', '200']) { ctx.beginPath(); if (ea && z >= 5) drawLines(ctx, T, D.bathy[k].E); else drawLines(ctx, T, D.bathy[k].W); ctx.strokeStyle = cols[k]; ctx.lineWidth = k === '200' ? 1 : .8; ctx.setLineDash(k === '200' ? [] : [3, 3]); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        if (o.urban && z >= 5) { ctx.beginPath(); drawPolys(ctx, T, D.urbanE); if (z >= 5) drawPolys(ctx, T, D.urbanW); ctx.fillStyle = o.night ? 'rgba(255,190,90,.35)' : 'rgba(255,170,90,.42)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,200,140,.55)'; ctx.lineWidth = .6; ctx.stroke(); }
        if (o.fresh && z >= 4) {
          ctx.beginPath(); drawPolys(ctx, T, ea ? D.lakesE : null); drawPolys(ctx, T, D.lakesW); ctx.fillStyle = 'rgba(70,160,230,.55)'; ctx.fill();
          if (z >= 5) { ctx.beginPath(); drawLines(ctx, T, ea ? D.riversE : null); drawLines(ctx, T, D.riversW); ctx.strokeStyle = 'rgba(110,190,255,.75)'; ctx.lineWidth = z >= 7 ? 1.3 : .9; ctx.stroke(); }
        }
        if (o.roads && z >= 6 && D.roadsE) {
          const sty = { 3: ['rgba(255,255,255,.35)', .7, 8], 2: ['rgba(255,236,170,.6)', 1, 7], 1: ['rgba(255,214,90,.85)', 1.6, 6], 4: ['rgba(160,220,255,.5)', .8, 7] };
          for (const k of ['3', '4', '2', '1']) {
            const [col, w, mz] = sty[k]; if (z < mz) continue;
            ctx.beginPath(); if (D.roadsE[k]) drawLines(ctx, T, D.roadsE[k]); if (k === '1') drawLines(ctx, T, D.roadsW);
            if (k === '4') ctx.setLineDash([4, 4]);
            ctx.strokeStyle = col; ctx.lineWidth = w * (z >= 9 ? 1.6 : 1); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        if (o.coast) {
          ctx.beginPath();
          if (z <= 4 || !ea) drawLines(ctx, T, D.coastW);
          else { drawLines(ctx, T, z >= 8 ? D.coastE2 : D.coastE1); drawLines(ctx, T, D.coastW, outsideEA); }
          ctx.strokeStyle = 'rgba(0,10,20,.55)'; ctx.lineWidth = z >= 8 ? 2.6 : 2; ctx.stroke();
          ctx.strokeStyle = 'rgba(205,240,255,.95)'; ctx.lineWidth = z >= 8 ? 1.2 : .9; ctx.stroke();
        }
        if (o.grid && z >= 4) {
          const s = GEO.cellSize((T.lon0 + T.lon1) / 2, (T.lat0 + T.lat1) / 2, z);
          if ((T.lon1 - T.lon0) / s <= 64) {
            ctx.beginPath();
            for (let lo = Math.ceil(T.lon0 / s) * s; lo <= T.lon1; lo += s) { const x = Math.round(T.px(lo)) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, T.size); }
            for (let la = Math.ceil(T.lat0 / s) * s; la <= T.lat1; la += s) { const y = Math.round(T.py(la)) + .5; ctx.moveTo(0, y); ctx.lineTo(T.size, y); }
            ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.stroke();
            if (z >= 8) {
              ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '500 9px "IBM Plex Mono", monospace';
              for (let lo = Math.ceil(T.lon0 / s) * s; lo < T.lon1; lo += s) for (let la = Math.ceil(T.lat0 / s) * s; la < T.lat1; la += s) ctx.fillText(`${la.toFixed(2)}N ${lo.toFixed(2)}E`, T.px(lo) + 3, T.py(la) - 3);
            }
          }
        }
      }
    });
    const Heat = L.GridLayer.extend({
      options: { tileSize: 256, keepBuffer: 2, updateWhenZooming: false, opacity: .62 },
      createTile(coords, done) {
        const size = this.getTileSize().x; const [c, ctx] = mkCanvas(size);
        const go = () => { try { this.paint(ctx, tileCtx(coords, size)); } catch (e) { console.warn(e); } done(null, c); };
        if (GEO.ENV) setTimeout(go, 0); else GEO.loadEnv().then(go);
        return c;
      },
      paint(ctx, T) {
        const f = this.options.value; if (!f) return;
        const s = GEO.cellSize((T.lon0 + T.lon1) / 2, (T.lat0 + T.lat1) / 2, T.z);
        if ((T.lon1 - T.lon0) / s > 96) return;
        for (let lo = Math.floor(T.lon0 / s) * s; lo < T.lon1; lo += s) {
          for (let la = Math.floor(T.lat0 / s) * s; la < T.lat1; la += s) {
            const v = f(lo + s / 2, la + s / 2, s); if (!v || v < .02) continue;
            const x0 = T.px(lo), x1 = T.px(lo + s), y0 = T.py(la + s), y1 = T.py(la);
            ctx.fillStyle = palColor(v); ctx.globalAlpha = Math.min(.72, .14 + v * .52);
            ctx.fillRect(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1);
          }
        }
        ctx.globalAlpha = 1;
      }
    });
    return { Sat, Vec, Heat };
  }

  /* --- labels (cities & seas) --- */
  function labelLayer(L, map, langIndex) {
    const grp = L.layerGroup().addTo(map);
    function refresh() {
      grp.clearLayers();
      if (!D) return;
      const z = map.getZoom(), b = map.getBounds().pad(.05), li = langIndex();
      const placed = [];
      const fits = (pt, w, h) => { for (const r of placed) if (pt.x < r.x + r.w && pt.x + w > r.x && pt.y < r.y + r.h && pt.y + h > r.y) return false; placed.push({ x: pt.x, y: pt.y, w, h }); return true; };
      // seas
      for (const s of GEO.SEAS) {
        if (!s[3] || z < s[4]) continue; const ll = L.latLng(s[3][1], s[3][0]); if (!b.contains(ll)) continue;
        const name = s[1][li] || s[1][1]; const pt = map.latLngToContainerPoint(ll); if (!fits({ x: pt.x - name.length * 4, y: pt.y - 8 }, name.length * 8, 16)) continue;
        grp.addLayer(L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'lbl-sea', html: `<span>${escapeHTML(name)}</span>`, iconSize: [0, 0] }) }));
      }
      if (z <= 4) for (const [lo, la, k] of GEO.OCEAN_LABELS) { const ll = L.latLng(la, lo); if (!b.contains(ll)) continue; const nm = GEO.OCEAN[k][li]; grp.addLayer(L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'lbl-sea lbl-ocean', html: `<span>${escapeHTML(nm)}</span>`, iconSize: [0, 0] }) })); }
      // cities
      let count = 0;
      for (const p of D.places) {
        if (count > 90) break;
        const [lo, la, mz, pop, en, ko, ja, zh] = p;
        if (mz > z + .6) continue; if (z <= 4 && pop < 2000000) continue; if (z <= 6 && pop < 200000 && !GEO.inEA(lo, la)) continue;
        const ll = L.latLng(la, lo); if (!b.contains(ll)) continue;
        const nm = [ko, en, ja, zh][li] || en; const pt = map.latLngToContainerPoint(ll);
        const w = nm.length * (li === 1 ? 6.5 : 11) + 12;
        if (!fits({ x: pt.x - 4, y: pt.y - 9 }, w, 18)) continue;
        grp.addLayer(L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'lbl-city' + (pop > 3e6 ? ' big' : ''), html: `<i></i><span>${escapeHTML(nm)}</span>`, iconSize: [0, 0] }) }));
        count++;
      }
    }
    map.on('moveend zoomend', refresh);
    return { refresh, grp };
  }

  return { load, makeLayers, labelLayer, palColor, PAL, get D() { return D; } };
})();
