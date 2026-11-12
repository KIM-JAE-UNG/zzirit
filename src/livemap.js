/* ===== 찌릿 라이브: the map =====
   MapLibre GL (vendor/) draws OpenStreetMap vector tiles (OpenMapTiles layers, served free by OpenFreeMap) in our own
   style: the land is quiet, buildings stand up, and the water is the bright part with a glowing shore.
   The look follows the real sun at that place: day, twilight, night.
   Also here: reading the water out of the tiles — is this point water, how far is the nearest water, where is the shore. */
const LMAP = (() => {
  let libP = null;
  const hook = () => window.LIVE_TILES || {}; // tests point the map at their own tiles
  function lib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (!libP) libP = new Promise((res, rej) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/maplibre-gl.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = 'vendor/maplibre-gl.js';
      s.onload = () => (window.maplibregl ? res(window.maplibregl) : rej(new Error('map_lib')));
      s.onerror = () => { libP = null; rej(new Error('map_lib')); };
      document.head.appendChild(s);
    });
    return libP;
  }

  /* --- the sun: altitude in degrees at a place and time (good to about a degree) --- */
  function sunAlt(lng, lat, ms) {
    const rad = Math.PI / 180, d = ms / 86400000 - 10957.5; // days since J2000
    const g = rad * (357.529 + .98560028 * d), q = 280.459 + .98564736 * d;
    const L = rad * (q + 1.915 * Math.sin(g) + .020 * Math.sin(2 * g)), e = rad * (23.439 - .00000036 * d);
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24, ha = rad * ((gmst * 15 + lng) % 360) - ra;
    return Math.asin(Math.sin(rad * lat) * Math.sin(dec) + Math.cos(rad * lat) * Math.cos(dec) * Math.cos(ha)) / rad;
  }
  const phaseOf = (lng, lat, ms) => { const a = sunAlt(lng, lat, ms); return a > 5 ? 'day' : a > -7 ? 'dusk' : 'night'; };
  // the hour by the sun at that longitude — the server uses the same rule for feeding time
  const solarHour = (lng, ms) => (((ms / 3600000 + lng / 15) % 24) + 24) % 24;
  const feeding = (lng, ms) => { const h = solarHour(lng, ms); return (h >= 5 && h < 8) || (h >= 16.5 && h < 19.5); };

  /* --- three palettes from the logo: ink, silver, azure, spark --- */
  const PAL = {
    night: { land: '#070D18', land2: '#0B1423', green: '#0A1A1E', sea: '#0C2B5C', sea2: '#0A2249', shore: '#5AA2FF', edge: '#9CCBFF', road: '#16233A', road2: '#22355A', path: '#1A2A46', rail: '#1B2942',
      b0: '#152238', b1: '#22365A', b2: '#31508A', roof: '#1B2B48', label: '#8FA3C4', halo: '#050A13', wlabel: '#7DB8F5', sky: '#050A13', horizon: '#0E2247', fog: '#081325', light: .22 },
    dusk: { land: '#101831', land2: '#161F3D', green: '#12233A', sea: '#1D3F86', sea2: '#18336E', shore: '#8FC0FF', edge: '#CFE4FF', road: '#222E54', road2: '#32437A', path: '#283760', rail: '#293660',
      b0: '#24305A', b1: '#364A86', b2: '#4B68B4', roof: '#2B3A6B', label: '#AEBBDD', halo: '#0B1226', wlabel: '#B6D5FF', sky: '#141C3F', horizon: '#6C6FB4', fog: '#27305F', light: .3 },
    day: { land: '#E6EBF2', land2: '#DDE4EE', green: '#D3E3DC', sea: '#5E9FE8', sea2: '#4C8DDB', shore: '#FFFFFF', edge: '#F2F8FF', road: '#FFFFFF', road2: '#F7FAFD', path: '#F2F5FA', rail: '#C3CCDA',
      b0: '#F6F8FB', b1: '#DCE4EF', b2: '#B8C7DC', roof: '#FFFFFF', label: '#44536C', halo: '#F4F7FB', wlabel: '#F2F8FF', sky: '#8FC3FB', horizon: '#DCEBFB', fog: '#E8EEF6', light: .42 }
  };

  function style(pal, lang) {
    const P = PAL[pal] || PAL.night, H = hook();
    const src = H.tiles ? { type: 'vector', tiles: [new URL(H.tiles, location.href).href.replace(/%7B/g, '{').replace(/%7D/g, '}')], minzoom: H.minzoom || 0, maxzoom: 14, attribution: '© OpenStreetMap' }
      : { type: 'vector', url: 'https://tiles.openfreemap.org/planet' };
    const name = ['coalesce', ['get', 'name:' + (lang || 'ko')], ['get', 'name']];
    const z = (a, b, c, d) => ['interpolate', ['exponential', 1.5], ['zoom'], a, b, c, d];
    const road = (id, cls, w0, w1, color, extra) => Object.assign({ id, type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', ['match', ['get', 'class'], cls, true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': z(12, w0, 18, w1) } }, extra || {});
    const labels = H.glyphs === '' ? [] : [
      { id: 'lb-water', type: 'symbol', source: 'omt', 'source-layer': 'water_name', minzoom: 9,
        layout: { 'text-field': name, 'text-font': ['Noto Sans Italic'], 'text-size': z(10, 11, 16, 15), 'text-letter-spacing': .08, 'text-max-width': 6, 'symbol-placement': 'point' },
        paint: { 'text-color': P.wlabel, 'text-halo-color': P.sea2, 'text-halo-width': 1, 'text-opacity': .85 } },
      { id: 'lb-road', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15.5,
        layout: { 'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'symbol-placement': 'line', 'text-pitch-alignment': 'map' },
        paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.2, 'text-opacity': .8 } },
      { id: 'lb-place', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 8,
        filter: ['match', ['get', 'class'], ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'island', 'hamlet'], true, false],
        layout: { 'text-field': name, 'text-font': ['Noto Sans Bold'], 'text-size': ['match', ['get', 'class'], 'city', 16, 'town', 14, 12.5], 'text-max-width': 7, 'text-padding': 8 },
        paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.4 } }
    ];
    return {
      version: 8, name: 'zzirit-' + pal,
      glyphs: H.glyphs || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: { omt: src },
      light: { anchor: 'viewport', color: '#ffffff', intensity: P.light, position: [1.3, 215, 42] },
      sky: { 'sky-color': P.sky, 'horizon-color': P.horizon, 'fog-color': P.fog, 'sky-horizon-blend': .7, 'horizon-fog-blend': .8, 'fog-ground-blend': .35, 'atmosphere-blend': 0 },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': P.land } },
        { id: 'landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['residential', 'commercial', 'industrial', 'retail'], true, false], paint: { 'fill-color': P.land2, 'fill-opacity': .7 } },
        { id: 'green', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['wood', 'grass', 'farmland', 'wetland'], true, false], paint: { 'fill-color': P.green, 'fill-opacity': .8 } },
        { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': P.green, 'fill-opacity': .6 } },
        { id: 'sand', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'sand'], paint: { 'fill-color': P.land2 } },
        { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': P.sea2, 'line-width': z(11, .6, 18, 5) } },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['!=', ['get', 'class'], 'swimming_pool'], paint: { 'fill-color': ['interpolate', ['linear'], ['zoom'], 9, P.sea2, 15, P.sea], 'fill-antialias': true } },
        // the shore glows: a wide soft line under a thin bright one
        { id: 'shore-glow', type: 'line', source: 'omt', 'source-layer': 'water', filter: ['!=', ['get', 'class'], 'swimming_pool'], minzoom: 12,
          paint: { 'line-color': P.shore, 'line-width': z(12, 2, 18, 26), 'line-blur': z(12, 2, 18, 22), 'line-opacity': pal === 'day' ? .55 : .42 } },
        { id: 'shore', type: 'line', source: 'omt', 'source-layer': 'water', filter: ['!=', ['get', 'class'], 'swimming_pool'], minzoom: 12,
          paint: { 'line-color': P.edge, 'line-width': z(12, .5, 18, 1.6), 'line-opacity': .8 } },
        // piers and breakwaters: where anglers stand
        { id: 'pier-a', type: 'fill', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['match', ['get', 'class'], ['pier', 'bridge'], true, false]], paint: { 'fill-color': P.land2 } },
        { id: 'pier-l', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'pier']], paint: { 'line-color': P.road2, 'line-width': z(13, 1.2, 18, 9) } },
        road('rd-path', ['path', 'track'], .4, 2.4, P.path, { minzoom: 14, layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': P.path, 'line-width': z(14, .5, 18, 2.4), 'line-dasharray': [2, 1.5] } }),
        road('rd-minor', ['minor', 'service'], .5, 9, P.road, { minzoom: 13 }),
        road('rd-mid', ['tertiary', 'secondary'], 1, 14, P.road2),
        road('rd-main', ['primary', 'trunk', 'motorway'], 1.4, 18, P.road2),
        { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12, filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-color': P.rail, 'line-width': z(12, .6, 18, 2.5) } },
        { id: 'bld-flat', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, maxzoom: 15, paint: { 'fill-color': P.b0, 'fill-opacity': z(13, 0, 14, .9) } },
        { id: 'bld', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 14.5, filter: ['!=', ['get', 'hide_3d'], true],
          paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, P.b0, 18, P.b1, 70, P.b2],
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.3, ['coalesce', ['get', 'render_height'], 6]],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.3, ['coalesce', ['get', 'render_min_height'], 0]],
            'fill-extrusion-opacity': pal === 'day' ? .96 : .92, 'fill-extrusion-vertical-gradient': true } }
      ].concat(labels)
    };
  }

  /* --- water out of the tiles --- */
  const M_LAT = 111320;
  const kindOf = cls => (cls === 'ocean' || cls === 'dock' ? 'sea' : 'fresh');
  // every water polygon the map has loaded: [{ cls, rings: [[ [lng, lat], … ], …holes], box: [x0, y0, x1, y1] }]
  function water(map) {
    let fs = [];
    try { fs = map.querySourceFeatures('omt', { sourceLayer: 'water' }); } catch (e) { return []; }
    const out = [];
    for (const f of fs) {
      const cls = (f.properties && f.properties.class) || 'lake'; if (cls === 'swimming_pool') continue;
      const g = f.geometry; if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const rings of polys) {
        if (!rings.length || rings[0].length < 4) continue;
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p of rings[0]) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
        out.push({ cls, rings, box: [x0, y0, x1, y1] });
      }
    }
    return out;
  }
  const pipRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const inPoly = (p, x, y) => { if (x < p.box[0] || x > p.box[2] || y < p.box[1] || y > p.box[3]) return false; if (!pipRing(p.rings[0], x, y)) return false; for (let i = 1; i < p.rings.length; i++) if (pipRing(p.rings[i], x, y)) return false; return true; };
  // the kind of water at a point ('sea' | 'fresh'), or null on land
  function waterAt(polys, lng, lat) { for (const p of polys) if (inPoly(p, lng, lat)) return kindOf(p.cls); return null; }
  // the nearest pieces of water's edge to a point, nearest first: [{ d (m), lng, lat, cls }]
  function edges(polys, lng, lat, maxM, keep) {
    const mLon = M_LAT * Math.cos(lat * Math.PI / 180), dLat = maxM / M_LAT, dLon = maxM / mLon, best = [];
    for (const p of polys) {
      if (lng < p.box[0] - dLon || lng > p.box[2] + dLon || lat < p.box[1] - dLat || lat > p.box[3] + dLat) continue;
      for (const r of p.rings) for (let i = 0; i < r.length - 1; i++) {
        const ax = (r[i][0] - lng) * mLon, ay = (r[i][1] - lat) * M_LAT, bx = (r[i + 1][0] - lng) * mLon, by = (r[i + 1][1] - lat) * M_LAT;
        if ((ax > maxM && bx > maxM) || (ax < -maxM && bx < -maxM) || (ay > maxM && by > maxM) || (ay < -maxM && by < -maxM)) continue;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
        const cx = ax + dx * t, cy = ay + dy * t, d = Math.hypot(cx, cy);
        if (d <= maxM) best.push({ d, lng: lng + cx / mLon, lat: lat + cy / M_LAT, cls: p.cls });
      }
    }
    best.sort((a, b) => a.d - b.d);
    return keep ? best.slice(0, keep) : best;
  }
  // how far is water from here? { d: 0 when standing in it, lng, lat of the nearest water, kind } or null when none within maxM
  function nearest(polys, lng, lat, maxM = 1500) {
    const k = waterAt(polys, lng, lat); if (k) return { d: 0, lng, lat, kind: k, inside: true };
    const e = edges(polys, lng, lat, maxM, 1)[0];
    return e ? { d: e.d, lng: e.lng, lat: e.lat, kind: kindOf(e.cls), inside: false } : null;
  }
  // a place to stand on dry land beside this point of water (tile seams in open water are skipped), or null
  function shoreBy(polys, lng, lat, maxM = 2500) {
    const mLon = M_LAT * Math.cos(lat * Math.PI / 180);
    for (const e of edges(polys, lng, lat, maxM, 60)) {
      const dx = (e.lng - lng) * mLon, dy = (e.lat - lat) * M_LAT, L = Math.hypot(dx, dy) || 1;
      for (const step of [4, 9]) {
        const sl = e.lng + dx / L * step / mLon, sa = e.lat + dy / L * step / M_LAT;
        if (!waterAt(polys, sl, sa)) return { lng: sl, lat: sa, d: e.d + step };
      }
    }
    return null;
  }
  const dist = (a, b) => { const mLon = M_LAT * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180); return Math.hypot((a.lng - b.lng) * mLon, (a.lat - b.lat) * M_LAT); };
  const bearing = (a, b) => { const mLon = M_LAT * Math.cos(a.lat * Math.PI / 180); return (Math.atan2((b.lng - a.lng) * mLon, (b.lat - a.lat) * M_LAT) * 180 / Math.PI + 360) % 360; };
  // a point d metres from a toward b
  const toward = (a, b, d) => { const L = dist(a, b) || 1, t = d / L; return { lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t }; };
  // cells the server knows: 0.00125° × 0.001° (about 110 m)
  const CW = .00125, CH = .001;
  const cellOf = (lng, lat) => [Math.floor(lng / CW), Math.floor(lat / CH)];
  const cellMid = (cx, cy) => ({ lng: (cx + .5) * CW, lat: (cy + .5) * CH });

  return { lib, style, PAL, sunAlt, phaseOf, solarHour, feeding, water, waterAt, nearest, shoreBy, edges, dist, bearing, toward, cellOf, cellMid, kindOf, CW, CH };
})();
