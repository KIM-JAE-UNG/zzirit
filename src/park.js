/* ===== 갯바위 공원 (the park, website): walk around with the anglers who are online, fish at the spots, challenge
   someone to a 60-second fishing duel, talk (the open chat shows as speech bubbles), wave with an emote.
   Live through Supabase Realtime, sparingly (the free plan counts every message): presence says who is here and where
   they stopped; a tap sends one "walking to" message that everyone animates on their own; duels send a few messages.
   Rooms of 15; a full one sends you on to the next. The fish in the park are a game, not records. ===== */
const PK = {
  W: 1600, H: 1000, ROOMS: 5, CAP: 15, SPEED: 165, SPAWN: [800, 790], AV: 66, DUEL: 60000,
  WALK: [
    [[0, 1000], [1600, 1000], [1600, 600], [1330, 600], [1330, 560], [1190, 560], [1185, 470], [1060, 446], [900, 432], [760, 440], [620, 470], [560, 520], [0, 560]],
    [[20, 600], [50, 430], [140, 335], [260, 285], [385, 300], [480, 352], [548, 430], [570, 540], [300, 620]],
    [[1200, 600], [1200, 150], [1320, 150], [1320, 600]]
  ],
  SPOTS: [
    { id: 'r1', x: 150, y: 356, dx: -0.2, dy: -1 }, { id: 'r2', x: 300, y: 304, dx: 0, dy: -1 }, { id: 'r3', x: 455, y: 378, dx: 0.5, dy: -1 },
    { id: 'b1', x: 1214, y: 282, dx: -1, dy: 0 }, { id: 'b2', x: 1306, y: 362, dx: 1, dy: 0 }, { id: 'b3', x: 1260, y: 176, dx: 0, dy: -1 },
    { id: 's1', x: 900, y: 456, dx: 0, dy: -1 }
  ],
  PROPS: [
    { id: 'shop', x: 300, y: 800, r: 95 }, { id: 'board', x: 720, y: 660, r: 75 }, { id: 'fire', x: 1010, y: 830, r: 85 },
    { id: 'tank', x: 1400, y: 735, r: 75 }, { id: 'duel', x: 560, y: 655, r: 65 }, { id: 'light', x: 1260, y: 142, r: 70 }
  ],
  LAMPS: [[180, 680], [520, 905], [1105, 650], [1500, 905], [1260, 590]],
  EMO: ['👋', '😆', '👍', '🎣', '🐟', '❤️'],
  EVENTS: ['mv', 'em', 'di', 'da', 'df', 'de', 'dx']
};
let PK_POOL = { m: -1, list: [] };
function pkWeb() { return window.APP_RT === 'web' && !!(window.APP_AUTH && window.APP_AUTH.rt); }
function pkKst() { const d = new Date(Date.now() + 9 * 3600e3); return { h: d.getUTCHours() + d.getUTCMinutes() / 60, m: d.getUTCMonth() }; }

/* ---------- the ground: where you can walk (rocks, beach, plaza, breakwater) ---------- */
function pkIn(x, y) { for (const poly of PK.WALK) if (GEO.pip(x, y, poly)) return true; return false; }
// walk in a straight line, stopping at the water's edge
function pkReach(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.ceil(d / 8));
  let lx = x0, ly = y0;
  for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (!pkIn(x, y)) break; lx = x; ly = y; }
  return [lx, ly];
}
// a way around the water: a coarse grid of land (20 px), the shortest path through it, then straightened wherever a
// straight line stays on land (from the plaza to the lighthouse goes over the boardwalk, not across the sea)
const PK_CELL = 20; let PK_LAND = null;
function pkLand() {
  if (PK_LAND) return PK_LAND;
  const W = Math.ceil(PK.W / PK_CELL), H = Math.ceil(PK.H / PK_CELL), a = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) a[j * W + i] = pkIn(i * PK_CELL + PK_CELL / 2, j * PK_CELL + PK_CELL / 2) ? 1 : 0;
  return (PK_LAND = { W, H, a });
}
function pkClear(x0, y0, x1, y1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8)); for (let i = 1; i <= n; i++) if (!pkIn(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; return true; }
function pkPath(x0, y0, x1, y1) {
  if (pkClear(x0, y0, x1, y1)) return [[x1, y1]];
  const G = pkLand(), C = PK_CELL;
  const cellOf = (x, y) => [clamp(Math.floor(x / C), 0, G.W - 1), clamp(Math.floor(y / C), 0, G.H - 1)];
  const mid = (i, j) => [i * C + C / 2, j * C + C / 2];
  let [ti, tj] = cellOf(x1, y1);
  if (!G.a[tj * G.W + ti]) { // a tap on the water: the nearest land to it
    let best = null, bd = Infinity;
    for (let j = 0; j < G.H; j++) for (let i = 0; i < G.W; i++) if (G.a[j * G.W + i]) { const d = (i - ti) ** 2 + (j - tj) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
    if (!best) return [pkReach(x0, y0, x1, y1)];
    [ti, tj] = best; [x1, y1] = mid(ti, tj);
    if (pkClear(x0, y0, x1, y1)) return [[x1, y1]];
  }
  const [si, sj] = cellOf(x0, y0), start = sj * G.W + si, goal = tj * G.W + ti;
  const prev = new Int32Array(G.W * G.H).fill(-1); prev[start] = start; const q = [start];
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let h = 0; h < q.length && prev[goal] === -1; h++) {
    const c = q[h], ci = c % G.W, cj = (c - ci) / G.W;
    for (const [di, dj] of D8) {
      const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= G.W || nj >= G.H) continue;
      const n = nj * G.W + ni; if (prev[n] !== -1 || !G.a[n]) continue;
      if (di && dj && (!G.a[cj * G.W + ni] || !G.a[nj * G.W + ci])) continue; // no cutting corners over the water
      prev[n] = c; q.push(n);
    }
  }
  if (prev[goal] === -1) return [pkReach(x0, y0, x1, y1)];
  const pts = []; for (let c = goal; c !== start; c = prev[c]) { const i = c % G.W; pts.push(mid(i, (c - i) / G.W)); }
  pts.reverse(); pts[pts.length - 1] = [x1, y1];
  const out = []; let cx = x0, cy = y0, k = 0;
  while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (pkClear(cx, cy, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); [cx, cy] = pts[far]; k = far + 1; }
  return out;
}
// start walking somebody along a path (each device works out the same path from where it sees them)
function pkGo(p, x, y) { const path = pkPath(p.x, p.y, x, y); const first = path.shift(); p.tx = first[0]; p.ty = first[1]; p.path = path; const last = path.length ? path[path.length - 1] : first; p.gx = last[0]; p.gy = last[1]; }
function pkNearProp(x, y) { let best = null, bd = Infinity; for (const p of PK.PROPS) { const d = Math.hypot(p.x - x, p.y - y); if (d < p.r + 30 && d < bd) { bd = d; best = p; } } return best; }
function pkNear(list, x, y, r) { let best = null, bd = r; for (const s of list) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } } return best; }

/* ---------- drawing: the ground once (into a picture), the moving things every frame ---------- */
function pkBg() {
  const c = document.createElement('canvas'); c.width = PK.W; c.height = PK.H;
  const g = c.getContext('2d'); const R = FD.seeded(20261029);
  const sea = g.createLinearGradient(0, 0, 0, 640); sea.addColorStop(0, '#0B4A73'); sea.addColorStop(.55, '#1F77A8'); sea.addColorStop(1, '#3FA2C8');
  g.fillStyle = sea; g.fillRect(0, 0, PK.W, PK.H);
  // far islands
  g.fillStyle = 'rgba(20,70,98,.75)';
  for (const [x, w, h] of [[120, 260, 34], [520, 180, 22], [980, 320, 40], [1420, 220, 28]]) { g.beginPath(); g.moveTo(x - w / 2, 92); g.quadraticCurveTo(x - w / 4, 92 - h, x, 92 - h * .9); g.quadraticCurveTo(x + w / 4, 92 - h * 1.1, x + w / 2, 92); g.closePath(); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 92, PK.W, 3);
  const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); } };
  // shallow water rim around the land
  g.save(); g.filter = 'blur(10px)'; poly(PK.WALK[0].map(([x, y]) => [x, y - 14]), 'rgba(120,210,220,.55)'); poly(PK.WALK[1].map(([x, y]) => [x, y - 12]), 'rgba(120,210,220,.45)'); g.restore();
  // beach + plaza
  poly(PK.WALK[0], '#EAD8A4');
  for (let i = 0; i < 900; i++) { const x = R() * PK.W, y = 430 + R() * 220; if (pkIn(x, y) && y < 650) { g.fillStyle = R() < .5 ? 'rgba(170,140,90,.25)' : 'rgba(255,255,255,.35)'; g.fillRect(x, y, 2, 2); } }
  const pv = g.createLinearGradient(0, 610, 0, 660); pv.addColorStop(0, 'rgba(216,207,191,0)'); pv.addColorStop(1, '#D8CFBF');
  g.fillStyle = pv; g.fillRect(0, 610, PK.W, 50); g.fillStyle = '#D8CFBF'; g.fillRect(0, 660, PK.W, 340);
  // paving stones and a round plaza in the middle
  g.strokeStyle = 'rgba(120,105,85,.18)'; g.lineWidth = 2;
  for (let y = 680; y < 1000; y += 40) { const off = ((y / 40) % 2) * 30; for (let x = -60 + off; x < PK.W; x += 60) g.strokeRect(x, y, 60, 40); }
  g.fillStyle = '#E6DED0'; g.beginPath(); g.ellipse(800, 800, 190, 105, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(120,105,85,.25)'; g.lineWidth = 3; g.beginPath(); g.ellipse(800, 800, 190, 105, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(800, 800, 120, 64, 0, 0, Math.PI * 2); g.stroke();
  // wooden boardwalk from the plaza to the breakwater
  g.fillStyle = '#B98A57'; g.fillRect(1180, 560, 160, 110);
  g.strokeStyle = 'rgba(80,50,25,.35)'; g.lineWidth = 2; for (let x = 1180; x < 1340; x += 16) { g.beginPath(); g.moveTo(x, 560); g.lineTo(x, 670); g.stroke(); }
  // rocks (갯바위): a dark base, boulders, tide pools, barnacles
  poly(PK.WALK[1], '#4E4943');
  for (let i = 0; i < 46; i++) {
    const x = 40 + R() * 520, y = 300 + R() * 300; if (!GEO.pip(x, y, PK.WALK[1])) continue;
    const rw = 26 + R() * 44, rh = 16 + R() * 26, tone = 70 + Math.floor(R() * 40);
    g.fillStyle = `rgb(${tone},${tone - 6},${tone - 12})`; g.beginPath(); g.ellipse(x, y, rw, rh, R() * Math.PI, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.ellipse(x - rw * .2, y - rh * .3, rw * .55, rh * .35, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 7; i++) { const x = 90 + R() * 420, y = 380 + R() * 180; if (!GEO.pip(x, y, PK.WALK[1])) continue; g.fillStyle = 'rgba(47,134,179,.85)'; g.beginPath(); g.ellipse(x, y, 16 + R() * 18, 7 + R() * 7, R(), 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 5, y - 2, 6, 2); }
  for (let i = 0; i < 260; i++) { const x = 40 + R() * 520, y = 280 + R() * 330; if (!GEO.pip(x, y, PK.WALK[1])) continue; g.fillStyle = 'rgba(230,226,215,.55)'; g.fillRect(x, y, 2, 2); }
  // breakwater: tetrapods in the water, then the concrete top
  const tetra = (x, y, s) => { g.fillStyle = '#9CA3A7'; g.strokeStyle = '#6E767B'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { const a = k * 2.094 + .5; g.beginPath(); g.ellipse(x + Math.cos(a) * s * .5, y + Math.sin(a) * s * .35, s * .45, s * .22, a, 0, Math.PI * 2); g.fill(); g.stroke(); } g.beginPath(); g.arc(x, y, s * .28, 0, Math.PI * 2); g.fill(); g.stroke(); };
  for (let y = 175; y < 560; y += 34) { tetra(1186, y + (y % 68 ? 8 : 0), 30); tetra(1334, y + (y % 68 ? 0 : 10), 30); }
  g.fillStyle = '#8E9497'; g.fillRect(1196, 146, 128, 456); g.fillStyle = '#C6CACC'; g.fillRect(1204, 146, 112, 456);
  g.strokeStyle = 'rgba(0,0,0,.08)'; for (let y = 170; y < 600; y += 46) { g.beginPath(); g.moveTo(1204, y); g.lineTo(1316, y); g.stroke(); }
  g.fillStyle = '#F2C94C'; for (let y = 160; y < 600; y += 60) { g.fillRect(1206, y, 6, 22); g.fillRect(1308, y + 30, 6, 22); }
  // grass and bushes along the bottom
  g.fillStyle = '#86B862'; g.fillRect(0, 968, PK.W, 32);
  for (let i = 0; i < 70; i++) { const x = R() * PK.W, s = 14 + R() * 18; g.fillStyle = R() < .5 ? '#6E9E4C' : '#7DAF57'; g.beginPath(); g.arc(x, 978 + R() * 10, s, 0, Math.PI * 2); g.fill(); }
  return c;
}
function pkSay(g, txt, x, y, o = {}) { // a short label on the ground (signs): drawn at screen size by the UI pass
  (PKS.labels || (PKS.labels = [])).push({ txt, x, y, o });
}
function pkDrawProps(g, t, night) {
  const out = [];
  // the lighthouse (빨간 등대) at the end of the breakwater
  out.push({ y: 142, d() {
    const x = 1260, y = 142;
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + 4, 34, 9, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) { const y0 = y - i * 20, w0 = 46 - i * 2.6, w1 = 46 - (i + 1) * 2.6; g.fillStyle = i % 2 ? '#F7F3EC' : '#D8412F'; g.beginPath(); g.moveTo(x - w0 / 2, y0); g.lineTo(x + w0 / 2, y0); g.lineTo(x + w1 / 2, y0 - 20); g.lineTo(x - w1 / 2, y0 - 20); g.closePath(); g.fill(); }
    g.fillStyle = '#2A3440'; g.fillRect(x - 20, y - 126, 40, 8);
    const on = (Math.sin(t * 2.2) + 1) / 2;
    g.fillStyle = night ? `rgba(255,236,150,${.65 + on * .35})` : '#FFE9A6'; g.fillRect(x - 13, y - 146, 26, 20);
    g.fillStyle = '#2A3440'; g.beginPath(); g.moveTo(x - 17, y - 146); g.lineTo(x, y - 162); g.lineTo(x + 17, y - 146); g.closePath(); g.fill();
    pkSay(g, t_('pk_light'), x, y + 22, { small: true });
  } });
  // tackle shop (낚시점)
  out.push({ y: 800, d() {
    const x = 300, y = 800;
    g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(x, y + 4, 92, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FBF7EF'; g.fillRect(x - 76, y - 92, 152, 92); g.strokeStyle = '#2B2433'; g.lineWidth = 2; g.strokeRect(x - 76, y - 92, 152, 92);
    g.fillStyle = '#2F6FB5'; g.fillRect(x - 76, y - 38, 152, 38); g.strokeRect(x - 76, y - 38, 152, 38);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : '#D8412F'; g.beginPath(); g.moveTo(x - 86 + i * 21.5, y - 124); g.lineTo(x - 86 + (i + 1) * 21.5, y - 124); g.lineTo(x - 86 + (i + 1) * 21.5, y - 96); g.arc(x - 86 + i * 21.5 + 10.75, y - 96, 10.75, 0, Math.PI); g.closePath(); g.fill(); }
    g.fillStyle = '#0B2230'; g.fillRect(x - 54, y - 152, 108, 26);
    g.strokeStyle = '#B98A57'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 86 + i * 8, y); g.lineTo(x + 96 + i * 10, y - 120 + i * 6); g.stroke(); }
    g.fillStyle = '#F2C94C'; g.fillRect(x - 64, y - 70, 18, 18); g.fillStyle = '#5BB6C9'; g.fillRect(x - 40, y - 74, 14, 22); g.fillStyle = '#FF5A1F'; g.fillRect(x + 30, y - 72, 20, 20);
    pkSay(g, t_('pk_shop'), x, y - 139, { light: true });
  } });
  // notice board (오늘의 대물)
  out.push({ y: 660, d() {
    const x = 720, y = 660;
    g.fillStyle = '#7A5230'; g.fillRect(x - 58, y - 92, 8, 92); g.fillRect(x + 50, y - 92, 8, 92);
    g.fillStyle = '#B07A45'; g.fillRect(x - 66, y - 118, 132, 72); g.strokeStyle = '#5E3E22'; g.lineWidth = 3; g.strokeRect(x - 66, y - 118, 132, 72);
    g.fillStyle = '#FFFDF5'; g.fillRect(x - 56, y - 108, 50, 34); g.fillRect(x + 2, y - 104, 52, 28); g.fillStyle = '#FFE38A'; g.fillRect(x - 20, y - 70, 40, 18);
    g.fillStyle = '#D8412F'; g.beginPath(); g.arc(x - 31, y - 106, 3, 0, 7); g.fill(); g.beginPath(); g.arc(x + 28, y - 102, 3, 0, 7); g.fill();
    pkSay(g, t_('pk_board'), x, y - 124);
  } });
  // campfire with log benches
  out.push({ y: 830, d() {
    const x = 1010, y = 830;
    for (const [bx, by, w] of [[-92, 6, 70], [92, 6, 70], [0, 62, 90]]) { g.fillStyle = '#8B5A33'; g.beginPath(); g.ellipse(x + bx, y + by, w / 2, 11, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#A8723F'; g.beginPath(); g.ellipse(x + bx, y + by - 4, w / 2, 8, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#7C7F84'; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 30, y + Math.sin(a) * 13, 7, 0, 7); g.fill(); }
    g.strokeStyle = '#5E3E22'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 20, y + 5); g.lineTo(x + 20, y - 5); g.moveTo(x - 20, y - 5); g.lineTo(x + 20, y + 5); g.stroke();
    for (let i = 0; i < 3; i++) { const f = Math.sin(t * 9 + i * 2) * 4, h = 34 + Math.sin(t * 7 + i) * 6 - i * 7; g.fillStyle = ['#FF8A1F', '#FFB52E', '#FFE27A'][i]; g.beginPath(); g.moveTo(x - 14 + i * 4, y); g.quadraticCurveTo(x - 10 + f, y - h * .6, x + f * .5, y - h); g.quadraticCurveTo(x + 10 + f, y - h * .6, x + 14 - i * 4, y); g.closePath(); g.fill(); }
  } });
  // measuring board with a little tank (계측대)
  out.push({ y: 735, d() {
    const x = 1400, y = 735;
    g.fillStyle = '#5E6A73'; g.fillRect(x - 52, y - 40, 8, 40); g.fillRect(x + 44, y - 40, 8, 40);
    g.fillStyle = 'rgba(130,210,235,.55)'; g.fillRect(x - 62, y - 108, 124, 70); g.strokeStyle = '#E8F4F8'; g.lineWidth = 3; g.strokeRect(x - 62, y - 108, 124, 70);
    g.fillStyle = '#E9D9AA'; g.fillRect(x - 60, y - 48, 120, 9);
    const sp = SPI[(PKS.best && PKS.best.sp) || 'madai'] || SPI.madai;
    if (sp) { g.save(); g.beginPath(); g.rect(x - 60, y - 106, 120, 66); g.clip(); FD.draw(g, sp, x + Math.sin(t * .8) * 34, y - 74 + Math.sin(t * 1.7) * 4, 64, { t, flip: Math.cos(t * .8) < 0 }); g.restore(); }
    g.fillStyle = '#F2F0EA'; g.fillRect(x - 62, y - 30, 124, 14); g.fillStyle = '#2B2433'; for (let i = 0; i <= 12; i++) g.fillRect(x - 60 + i * 10, y - 30, 1.5, i % 5 ? 6 : 10);
    pkSay(g, t_('pk_tank'), x, y - 114);
  } });
  // the duel rocks (대결 바위)
  out.push({ y: 655, d() {
    const x = 560, y = 655;
    for (const dx of [-30, 30]) { g.fillStyle = '#6E6862'; g.beginPath(); g.ellipse(x + dx, y, 26, 12, 0, 0, 7); g.fill(); g.fillStyle = '#8A847D'; g.beginPath(); g.ellipse(x + dx, y - 4, 22, 8, 0, 0, 7); g.fill(); }
    g.strokeStyle = '#5E3E22'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y - 70); g.stroke();
    g.fillStyle = '#FF5A1F'; g.beginPath(); g.moveTo(x, y - 70); g.lineTo(x + 34, y - 60); g.lineTo(x, y - 50); g.closePath(); g.fill();
    pkSay(g, t_('pk_duel'), x, y + 22, { small: true });
  } });
  // lamp posts
  for (const [lx, ly] of PK.LAMPS) out.push({ y: ly, d() { g.fillStyle = '#2E3A46'; g.fillRect(lx - 3, ly - 76, 6, 76); g.fillRect(lx - 9, ly - 4, 18, 6); g.fillStyle = night ? '#FFE9A6' : '#E8EEF2'; g.beginPath(); g.arc(lx, ly - 82, 9, 0, 7); g.fill(); } });
  // the entrance sign
  out.push({ y: 975, d() { const x = 800, y = 975; g.fillStyle = '#7A5230'; g.fillRect(x - 96, y - 66, 8, 66); g.fillRect(x + 88, y - 66, 8, 66); g.fillStyle = '#B07A45'; g.fillRect(x - 104, y - 86, 208, 30); g.strokeStyle = '#5E3E22'; g.lineWidth = 3; g.strokeRect(x - 104, y - 86, 208, 30); pkSay(g, t_('pk_gate'), x, y - 71, { light: true }); } });
  return out;
}
const t_ = k => t(k);
function pkWater(g, t, night) {
  // glints moving across the sea, foam at the beach, a boat on the horizon, a moored boat, gulls
  const R = FD.seeded(7);
  for (let i = 0; i < 60; i++) { const bx = R() * PK.W, y = 110 + R() * 330, sp = 6 + R() * 10; const x = (bx + t * sp) % PK.W; if (pkIn(x, y)) continue; g.fillStyle = `rgba(255,255,255,${.12 + .2 * Math.abs(Math.sin(t * 1.3 + i))})`; g.fillRect(x, y, 10 + R() * 12, 2); }
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.beginPath();
  const edge = PK.WALK[0].slice(5, 12);
  edge.forEach(([x, y], i) => { const yy = y - 6 + Math.sin(t * 1.6 + x / 60) * 3; if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }); g.stroke();
  const bx = ((t * 18) % (PK.W + 300)) - 150;
  g.fillStyle = 'rgba(245,245,240,.85)'; g.beginPath(); g.moveTo(bx - 20, 102); g.lineTo(bx + 20, 102); g.lineTo(bx + 14, 109); g.lineTo(bx - 14, 109); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(bx, 100); g.lineTo(bx, 78); g.lineTo(bx + 14, 98); g.closePath(); g.fill();
  const my = 395 + Math.sin(t * 1.4) * 2.5;
  g.fillStyle = '#E9EEF2'; g.beginPath(); g.moveTo(1052, my); g.lineTo(1148, my); g.lineTo(1136, my + 18); g.lineTo(1064, my + 18); g.closePath(); g.fill();
  g.fillStyle = '#2F6FB5'; g.fillRect(1064, my + 10, 72, 6); g.fillStyle = '#F7F3EC'; g.fillRect(1084, my - 20, 30, 20); g.fillStyle = '#5BB6C9'; g.fillRect(1090, my - 15, 8, 8); g.fillRect(1102, my - 15, 8, 8);
  g.strokeStyle = 'rgba(40,40,40,.7)'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const x = 420 + Math.cos(t * .21 + i * 2.1) * 330, y = 170 + Math.sin(t * .33 + i) * 55, w = 9 + Math.sin(t * 6 + i) * 2; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w / 2, y - 6, x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke(); }
}

/* ---------- people ---------- */
const PKS = { on: false }; // the live state of the park on this device
function pkPerson(uid) { return uid === myId() ? PKS.me : PKS.people.get(uid); }
function pkDrawPerson(g, p, t) {
  const a = p.uid === myId() ? S.me : S.anglers.get(p.uid); if (!a) return;
  const img = CH.image(charOf(a, p.uid), 'full'); const h = PK.AV, w = h * 112 / 130;
  const bob = p.moving ? Math.abs(Math.sin(t * 11)) * 3 : 0;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(p.x, p.y, 15, 5, 0, 0, Math.PI * 2); g.fill();
  if (img.complete && img.naturalWidth) {
    g.save(); g.translate(p.x, p.y - bob + (p.act === 'sit' ? 10 : 0)); if (p.dir < 0) g.scale(-1, 1);
    g.drawImage(img, -.375 * w, -.95 * h, w, h); g.restore();
  }
  // the line and float only from a fishing spot (in a duel away from the water, the ⚔️ above the head says it all)
  const sp = (p.act === 'fish' || p.act === 'duel') && PK.SPOTS.find(s => s.id === p.spot);
  if (sp && Math.hypot(sp.x - p.x, sp.y - p.y) < 150) {
    const tipX = p.x + (.9375 - .375) * w * (p.dir < 0 ? -1 : 1), tipY = p.y - .95 * h + .046 * h;
    const bx = (sp ? sp.x + sp.dx * 130 : p.x + 120 * p.dir), by = (sp ? sp.y + sp.dy * 130 : p.y - 120) + Math.sin(t * 3 + p.x) * 2;
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + 18, bx, by); g.stroke();
    g.fillStyle = '#FF3B2F'; g.beginPath(); g.arc(bx, by - 2, 3.5, Math.PI, 0); g.fill(); g.fillStyle = '#FFF'; g.beginPath(); g.arc(bx, by - 2, 3.5, 0, Math.PI); g.fill();
  }
}
function pkSend(ev, payload) { if (PKS.room) PKS.room.send(ev, payload); }
function pkMyPresence() { const m = PKS.me; return { u: myId(), x: Math.round(m.x), y: Math.round(m.y), d: m.dir, a: m.act || '', s: m.spot || '', b: PKS.best ? PKS.best.sp + '|' + PKS.best.len : '' }; }
const pkTrackSoon = debounce(() => { if (PKS.on && PKS.room && PKS.subscribed) { PKS.lastTrack = nowMs(); PKS.room.track(pkMyPresence()); } }, 900);
function pkSync(state) {
  const me = myId(); const here = new Set();
  for (const [key, metas] of Object.entries(state || {})) {
    const m = metas && metas[metas.length - 1]; if (!m || !m.u || key === me || m.u === me) continue;
    here.add(m.u);
    let p = PKS.people.get(m.u);
    if (!p) { p = { uid: m.u, x: m.x, y: m.y, tx: m.x, ty: m.y, dir: m.d || 1, act: m.a || '', spot: m.s || '', moving: false, since: nowMs() }; PKS.people.set(m.u, p); }
    p.act = m.a || ''; p.spot = m.s || ''; p.best = m.b || ''; p.dir = m.d || p.dir;
    if (!p.moving && Math.hypot(p.x - m.x, p.y - m.y) > 40) { p.x = m.x; p.y = m.y; p.tx = m.x; p.ty = m.y; p.path = []; }
  }
  for (const uid of [...PKS.people.keys()]) if (!here.has(uid)) {
    PKS.people.delete(uid);
    if (PKS.duel && PKS.duel.peer === uid && PKS.duel.state !== 'done') pkDuelGone();
  }
  if (!PKS.synced) {
    PKS.synced = true;
    // a full room: on to the next one
    if (PKS.people.size >= PK.CAP && PKS.roomNo < PK.ROOMS) { const next = PKS.roomNo + 1; toast(t('pk_full', { a: PKS.roomNo, b: next }), 'info'); setTimeout(() => pkJoin(next), 50); return; }
  }
  pkPanel();
}
function pkMsg(ev, p) {
  if (!p || p.u === myId()) return;
  if (ev === 'mv') {
    let q = PKS.people.get(p.u);
    if (!q) { q = { uid: p.u, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 1, act: '', moving: false, since: nowMs() }; PKS.people.set(p.u, q); }
    if (Math.hypot(q.x - p.x, q.y - p.y) > 90) { q.x = p.x; q.y = p.y; }
    pkGo(q, p.tx, p.ty); q.act = ''; return;
  }
  if (ev === 'em') { const q = PKS.people.get(p.u); if (q && PK.EMO[p.e]) q.emote = { e: PK.EMO[p.e], until: nowMs() + 2600 }; return; }
  pkDuelMsg(ev, p);
}

/* ---------- joining and leaving a room ---------- */
function pkJoin(no) {
  if (PKS.room) { try { PKS.room.leave(); } catch (e) { } PKS.room = null; }
  PKS.roomNo = clamp(no || 1, 1, PK.ROOMS); lsSet('pkRoom', PKS.roomNo);
  PKS.people = new Map(); PKS.synced = false; PKS.subscribed = false;
  PKS.room = APP_AUTH.rt.room('zz-park-' + PKS.roomNo, myId(), {
    events: PK.EVENTS,
    sync: pkSync, msg: pkMsg,
    status: st => {
      PKS.subscribed = st === 'SUBSCRIBED'; PKS.status = st;
      if (st === 'SUBSCRIBED') PKS.room.track(pkMyPresence());
      pkPanel();
    }
  });
  pkPanel();
}
function pkStart(el) {
  PKS.on = true; PKS.people = new Map(); PKS.labels = []; PKS.font = null; PKS.paused = false;
  const m = S.me && S.me.park; PKS.best = m && m.best ? m.best : null; PKS.stats = Object.assign({ n: 0, w: 0, l: 0, d: 0 }, (m && m.st) || {});
  PKS.me = { uid: myId(), x: PK.SPAWN[0] + (Math.random() * 80 - 40), y: PK.SPAWN[1] - Math.random() * 30, tx: 0, ty: 0, dir: 1, act: '', moving: false };
  PKS.me.tx = PKS.me.x; PKS.me.ty = PKS.me.y;
  PKS.cam = { x: PKS.me.x, y: PKS.me.y }; PKS.tapAt = null;
  PKS.bgImg = PKS.bgImg || pkBg();
  PKS.chatStop = chatJoin(m2 => { const p = pkPerson(m2.uid); if (p) p.bubble = { txt: chatClean(m2.body), until: nowMs() + 6500 }; pkLog(); });
  pkJoin(lsGet('pkRoom', 1));
  PKS.last = performance.now(); PKS.raf = requestAnimationFrame(pkFrame);
}
function pkStop() {
  if (!PKS.on) return;
  if (PKS.duel && PKS.duel.state !== 'done') pkDuelAbort(true);
  if (PKS.game) pkGameClose(true);
  PKS.on = false; cancelAnimationFrame(PKS.raf);
  if (PKS.room) { try { PKS.room.leave(); } catch (e) { } PKS.room = null; }
  if (PKS.chatStop) { PKS.chatStop(); PKS.chatStop = null; }
  pkSaveStats(true);
}
function pkSaveStats(now) {
  if (!PKS.dirty || !S.me || !S.me.nick) return;
  if (!now && nowMs() - (PKS.savedAt || 0) < 60e3) return;
  PKS.dirty = false; PKS.savedAt = nowMs();
  S.me.park = { best: PKS.best || null, st: PKS.stats };
  store.saveMe();
}

/* ---------- the frame: move people, follow me with the camera, draw ---------- */
function pkFrame(ts) {
  if (!PKS.on) return;
  PKS.raf = requestAnimationFrame(pkFrame);
  const cv = PKS.cv; if (!cv || !cv.isConnected || document.hidden) { PKS.last = ts; return; }
  const dt = Math.min(.05, (ts - PKS.last) / 1000); PKS.last = ts; const t = ts / 1000;
  const step = p => {
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d > 1.5) { const s = Math.min(d, PK.SPEED * dt); p.x += dx / d * s; p.y += dy / d * s; p.moving = true; if (Math.abs(dx) > 2) p.dir = dx > 0 ? 1 : -1; }
    else if (p.path && p.path.length) { const n = p.path.shift(); p.tx = n[0]; p.ty = n[1]; }
    else if (p.moving) { p.x = p.tx; p.y = p.ty; p.moving = false; if (p === PKS.me) pkArrived(); }
  };
  step(PKS.me); for (const p of PKS.people.values()) step(p);
  if (PKS.keys && PKS.keys.size) pkKeyWalk();
  // camera
  const r = cv.getBoundingClientRect(); const cw = r.width, ch = r.height; if (!cw || !ch) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const zoom = PKS.zoom = clamp(Math.min(cw / 1100, ch / 690), .55, 1.1);
  const hw = cw / 2 / zoom, hh = ch / 2 / zoom;
  const cx = hw * 2 >= PK.W ? PK.W / 2 : clamp(PKS.me.x, hw, PK.W - hw), cy = hh * 2 >= PK.H ? PK.H / 2 : clamp(PKS.me.y - 40, hh, PK.H - hh);
  PKS.cam.x += (cx - PKS.cam.x) * Math.min(1, dt * 5); PKS.cam.y += (cy - PKS.cam.y) * Math.min(1, dt * 5);
  const g = PKS.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0B4A73'; g.fillRect(0, 0, cv.width, cv.height / 2); g.fillStyle = '#7DAF57'; g.fillRect(0, cv.height / 2, cv.width, cv.height / 2);
  g.setTransform(dpr * zoom, 0, 0, dpr * zoom, (cw / 2 - PKS.cam.x * zoom) * dpr, (ch / 2 - PKS.cam.y * zoom) * dpr);
  g.drawImage(PKS.bgImg, 0, 0);
  const { h } = pkKst(); const night = h >= 19.5 || h < 5.3, dusk = !night && (h >= 17 || h < 6.5);
  pkWater(g, t, night);
  // spots: a ring, brighter when I am close
  const nearSpot = PKS.me.act ? null : pkNear(PK.SPOTS, PKS.me.x, PKS.me.y, 46);
  for (const s of PK.SPOTS) { const busy = [...PKS.people.values()].some(p => p.spot === s.id && (p.act === 'fish' || p.act === 'duel')); g.strokeStyle = s === nearSpot ? `rgba(255,214,90,${.6 + .4 * Math.sin(t * 5)})` : busy ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.45)'; g.lineWidth = 3; g.beginPath(); g.ellipse(s.x, s.y + 2, 20, 8, 0, 0, Math.PI * 2); g.stroke(); }
  PKS.labels = [];
  const items = pkDrawProps(g, t, night);
  for (const p of [PKS.me, ...PKS.people.values()]) items.push({ y: p.y, d: () => pkDrawPerson(g, p, t) });
  items.sort((a, b) => a.y - b.y); for (const it of items) it.d();
  if (PKS.tapAt && nowMs() - PKS.tapAt.at < 700) { const k = (nowMs() - PKS.tapAt.at) / 700; g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.ellipse(PKS.tapAt.x, PKS.tapAt.y, 10 + k * 14, 4 + k * 6, 0, 0, Math.PI * 2); g.stroke(); }
  // time of day (Korean time): dusk glow, night with the lamps, the fire and the lighthouse beam
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (night || dusk) {
    g.fillStyle = night ? 'rgba(6,16,44,.46)' : 'rgba(255,128,60,.12)'; g.fillRect(0, 0, cw, ch);
    if (night) {
      g.globalCompositeOperation = 'lighter';
      const glow = (x, y, rr, col) => { const sx = (x - PKS.cam.x) * zoom + cw / 2, sy = (y - PKS.cam.y) * zoom + ch / 2; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rr * zoom); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(sx - rr * zoom, sy - rr * zoom, rr * 2 * zoom, rr * 2 * zoom); };
      for (const [lx, ly] of PK.LAMPS) glow(lx, ly - 82, 110, 'rgba(255,214,140,.30)');
      glow(1010, 815, 150 + Math.sin(t * 9) * 8, 'rgba(255,150,60,.42)');
      glow(1260, 6, 120, 'rgba(255,236,150,.45)');
      const sx = (1260 - PKS.cam.x) * zoom + cw / 2, sy = (6 - PKS.cam.y) * zoom + ch / 2, a = t * .9;
      g.fillStyle = 'rgba(255,240,170,.10)'; g.beginPath(); g.moveTo(sx, sy); g.arc(sx, sy, 900 * zoom, a - .12, a + .12); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
  }
  pkUI(g, cw, ch, zoom, t);
  pkActBar(nearSpot);
  if (PKS.game) pkGameStep(dt, t);
  pkSaveStats(false);
}
/* names, speech bubbles, emotes and sign labels at screen size (readable at any zoom) */
function pkFont() { return PKS.font || (PKS.font = getComputedStyle(document.body).fontFamily || 'sans-serif'); }
function pkUI(g, cw, ch, zoom, t) {
  const font = pkFont();
  const sx = x => (x - PKS.cam.x) * zoom + cw / 2, sy = y => (y - PKS.cam.y) * zoom + ch / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const L of PKS.labels) {
    g.font = `700 ${L.o.small ? 11 : 12}px ${font}`; const w = g.measureText(L.txt).width + 12;
    const x = sx(L.x), y = sy(L.y);
    if (!L.o.light) { g.fillStyle = 'rgba(11,34,48,.72)'; pkRound(g, x - w / 2, y - 9, w, 18, 9); g.fill(); }
    g.fillStyle = '#FFFFFF'; g.fillText(L.txt, x, y + .5);
  }
  const now = nowMs();
  for (const p of [...PKS.people.values(), PKS.me]) {
    const a = p.uid === myId() ? S.me : S.anglers.get(p.uid); if (!a) continue;
    const x = sx(p.x), headY = sy(p.y - PK.AV - (p.act === 'sit' ? -10 : 0));
    g.font = `700 12px ${font}`;
    const nm = a.nick + '  Lv.' + lvInfo(a, p.uid).L; const w = g.measureText(nm).width + 14;
    g.fillStyle = p.uid === myId() ? 'rgba(255,90,31,.92)' : 'rgba(11,34,48,.70)'; pkRound(g, x - w / 2, sy(p.y) + 6, w, 18, 9); g.fill();
    g.fillStyle = '#FFF'; g.fillText(nm, x, sy(p.y) + 15.5);
    let top = headY - 8;
    if (p.act === 'duel') { g.font = `18px ${font}`; g.fillText('⚔️', x, top - 8); top -= 22; }
    else if (p.act === 'fish') { g.font = `16px ${font}`; g.fillText('🎣', x, top - 8); top -= 20; }
    if (p.emote && p.emote.until > now) { const k = 1 - Math.max(0, (p.emote.until - now - 2200) / 400); g.font = `${Math.round(26 * Math.min(1, .5 + k))}px ${font}`; g.fillText(p.emote.e, x, top - 14); top -= 34; }
    if (p.bubble && p.bubble.until > now) {
      const alpha = Math.min(1, (p.bubble.until - now) / 500);
      g.font = `500 13px ${font}`; const lines = pkWrap(g, p.bubble.txt, 180).slice(0, 3);
      const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 18, bh = lines.length * 17 + 12;
      g.globalAlpha = alpha; g.fillStyle = '#FFFFFF'; pkRound(g, x - bw / 2, top - bh - 8, bw, bh, 10); g.fill();
      g.beginPath(); g.moveTo(x - 6, top - 9); g.lineTo(x + 6, top - 9); g.lineTo(x, top - 1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(11,34,48,.15)'; g.lineWidth = 1; pkRound(g, x - bw / 2, top - bh - 8, bw, bh, 10); g.stroke();
      g.fillStyle = '#0B2230'; lines.forEach((l, i) => g.fillText(l, x, top - bh - 8 + 14 + i * 17)); g.globalAlpha = 1;
    }
  }
}
function pkRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function pkWrap(g, s, max) { const out = []; let line = ''; for (const ch of [...String(s)]) { if (g.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }

/* ---------- moving: tap to walk, arrows / WASD on a keyboard ---------- */
let pkSentAt = 0, pkSendTimer = null;
function pkWalk(x, y) {
  const me = PKS.me; if (me.act === 'duel') return;
  if (me.act) { me.act = ''; me.spot = ''; pkTrackSoon(); }
  pkGo(me, x, y);
  // one message per tap at most every 250 ms (the latest wins): where I am and where I am going
  const send = () => { pkSendTimer = null; pkSentAt = nowMs(); pkSend('mv', { u: myId(), x: Math.round(me.x), y: Math.round(me.y), tx: Math.round(me.gx), ty: Math.round(me.gy) }); };
  clearTimeout(pkSendTimer); const wait = 250 - (nowMs() - pkSentAt); if (wait <= 0) send(); else pkSendTimer = setTimeout(send, wait);
}
function pkArrived() {
  pkTrackSoon();
  const pend = PKS.pending; PKS.pending = null;
  if (pend && Math.hypot(PKS.me.x - pend.x, PKS.me.y - pend.y) < pend.r + 60) pkProp(pend.id);
}
function pkKeyWalk() {
  if (nowMs() - (PKS.keyAt || 0) < 200) return; PKS.keyAt = nowMs();
  let dx = 0, dy = 0; for (const k of PKS.keys) { if (k === 'ArrowLeft' || k === 'a') dx--; if (k === 'ArrowRight' || k === 'd') dx++; if (k === 'ArrowUp' || k === 'w') dy--; if (k === 'ArrowDown' || k === 's') dy++; }
  if (dx || dy) { const n = Math.hypot(dx, dy); pkWalk(PKS.me.x + dx / n * 70, PKS.me.y + dy / n * 70); }
}
function pkTap(e) {
  const cv = PKS.cv; const r = cv.getBoundingClientRect(); const z = PKS.zoom || 1;
  const wx = (e.clientX - r.left - r.width / 2) / z + PKS.cam.x, wy = (e.clientY - r.top - r.height / 2) / z + PKS.cam.y;
  // someone: their card; a prop: open it when close, walk there first when not; anywhere else: walk
  for (const p of PKS.people.values()) if (Math.abs(wx - p.x) < 24 && wy > p.y - PK.AV - 6 && wy < p.y + 8) { pkCard(p.uid); return; }
  if (Math.abs(wx - PKS.me.x) < 24 && wy > PKS.me.y - PK.AV - 6 && wy < PKS.me.y + 8) { pkEmotes(); return; }
  for (const pr of PK.PROPS) if (Math.hypot(wx - pr.x, wy - (pr.y - 50)) < pr.r) {
    if (Math.hypot(PKS.me.x - pr.x, PKS.me.y - pr.y) < pr.r + 60) { pkProp(pr.id); return; }
    PKS.pending = pr; pkWalk(pr.x + (PKS.me.x < pr.x ? -pr.r * .7 : pr.r * .7), pr.y + 26); return;
  }
  PKS.tapAt = { x: wx, y: wy, at: nowMs() }; pkWalk(wx, wy);
}

/* ---------- the bar under the park: what I can do here, emotes, saying something ---------- */
function pkActBar(nearSpot) {
  const bar = $('#pk-act'); if (!bar) return;
  const k = PKS.game ? 'game' : nearSpot ? 'spot:' + nearSpot.id : PKS.me.act === 'sit' ? 'sit' : (pkNearProp(PKS.me.x, PKS.me.y) || {}).id || '';
  if (bar.dataset.k === k) return; bar.dataset.k = k;
  if (k === 'game') { bar.innerHTML = ''; return; }
  if (k.startsWith('spot:')) { bar.innerHTML = `<button class="btn btn-primary" data-pk="fish" data-spot="${k.slice(5)}">${icon('fish')}${t('pk_fish_here')}</button>`; return; }
  if (k === 'fire') { bar.innerHTML = `<button class="btn btn-line" data-pk="sit">${t('pk_sit')}</button>`; return; }
  if (k === 'sit') { bar.innerHTML = `<button class="btn btn-line" data-pk="stand">${t('pk_stand')}</button>`; return; }
  bar.innerHTML = k ? `<button class="btn btn-line" data-pk="prop" data-prop="${k}">${t('pk_open_' + k)}</button>` : `<span class="muted small">${t('pk_hint')}</span>`;
}
function pkEmotes() {
  const box = $('#pk-emo'); if (!box) return;
  box.hidden = !box.hidden;
}
function pkEmote(i) {
  if (!PK.EMO[i]) return; PKS.me.emote = { e: PK.EMO[i], until: nowMs() + 2600 };
  if (nowMs() - (PKS.emoAt || 0) > 900) { PKS.emoAt = nowMs(); pkSend('em', { u: myId(), e: i }); }
  const box = $('#pk-emo'); if (box) box.hidden = true;
}
function pkLog() {
  const box = $('#pk-log'); if (!box) return;
  const list = CHAT.msgs.filter(m => !chatHidden(m.id)).slice(-4);
  box.innerHTML = list.map(m => { const a = S.anglers.get(m.uid); return `<li><b>${esc((a && a.nick) || m.nick)}</b> ${esc(chatClean(m.body))}</li>`; }).join('');
}
/* who is here (also the way to reach someone without tapping the picture) */
function pkPanel() {
  const box = $('#pk-people'); if (!box || !PKS.on) return;
  const st = $('#pk-status');
  if (st) st.textContent = PKS.subscribed ? t('pk_here', { n: PKS.people.size + 1, room: PKS.roomNo }) : PKS.status === 'CHANNEL_ERROR' || PKS.status === 'TIMED_OUT' ? t('pk_reconnect') : t('pk_joining');
  $$('[data-pkroom]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.pkroom === PKS.roomNo)));
  const rows = [...PKS.people.values()].map(p => ({ p, a: S.anglers.get(p.uid) })).filter(x => x.a && x.a.nick);
  box.innerHTML = rows.length ? rows.map(({ p, a }) => `<li><button class="pk-person" data-pkwho="${esc(p.uid)}">${avatar(a, 28)}<span><b>${esc(a.nick)}</b>${lvMini(a, p.uid)}<span class="muted small">${p.act === 'duel' ? t('pk_st_duel') : p.act === 'fish' ? t('pk_st_fish') : p.act === 'sit' ? t('pk_st_sit') : ''}</span></span></button></li>`).join('')
    : `<li class="muted small pk-alone">${t('pk_alone')}</li>`;
}
function pkCard(uid) {
  const a = S.anglers.get(uid); if (!a) return;
  const p = PKS.people.get(uid); const rel = relation(uid); const pk = a.park || {}; const st = pk.st || {};
  const busy = !p || p.act === 'duel' || !!PKS.duel || !!PKS.game;
  const w = openModal(`<div class="pk-card">
    <div class="pk-card-top">${avatar(a, 56)}<div><h2>${esc(a.nick)} ${lvMini(a, uid)}${teamTag(uid)}</h2>
      <p class="muted small">${t('pk_card_stats', { w: st.w || 0, l: st.l || 0, n: st.n || 0 })}${pk.best && SPI[pk.best.sp] ? ` · ${t('pk_card_best', { fish: `${esc(nameOf(pk.best.sp))} ${lenFmt(pk.best.len)}` })}` : ''}</p></div></div>
    <div class="actions col">
      <button class="btn btn-primary btn-block" data-pkc="duel" ${busy ? 'disabled' : ''}>⚔️ ${t('pk_duel_ask')}</button>
      ${rel === 'friend' ? `<button class="btn btn-line btn-block" data-pkc="dm">${icon('chat')}${t('pk_dm')}</button>` : `<div class="pk-fr">${frBtns(uid, rel)}</div>`}
      <button class="btn btn-ghost btn-block" data-pkc="sea">${icon('sea')}${t('pk_see_sea')}</button>
    </div>
    ${busy && p && p.act === 'duel' ? `<p class="hint">${t('pk_busy')}</p>` : ''}
  </div>`, { label: a.nick });
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-pkc]'); if (!b) return;
    if (b.dataset.pkc === 'duel') { closeModal(w); pkDuelAsk(uid); }
    else if (b.dataset.pkc === 'dm') { closeModal(w); dmOpen(uid); }
    else if (b.dataset.pkc === 'sea') { closeModal(w); openSeaOf(uid); }
  });
}
function pkProp(id) {
  if (id === 'board') { openWeekly(); return; }
  if (id === 'shop') { pkShop(); return; }
  if (id === 'fire') { pkSit(true); return; }
  if (id === 'light') { pkLight(); return; }
  if (id === 'tank') { pkTank(); return; }
  if (id === 'duel') { toast(t('pk_duel_how'), 'info', 5200); }
}
function pkSit(on) { PKS.me.act = on ? 'sit' : ''; PKS.me.spot = ''; pkTrackSoon(); }
function pkShop() {
  const m = pkKst().m; const top = pkPool(m).slice(0, 4);
  openModal(`<div class="pk-shop"><h2>${icon('lure')} ${t('pk_shop')}</h2><p class="lede">${t('pk_shop_sub')}</p>
    <ul class="pk-shop-list">${top.map(x => { const sp = SPI[x.id]; const baits = [...(sp.b || []).map(b => dict(BAIT[b])), ...(sp.lu || []).map(l => dict(LURE[l]))].slice(0, 3); return `<li><img src="${FD.thumb(sp, 120, 66)}" alt=""><span><b>${esc(spName(sp))}</b><span class="muted small">${esc(baits.join(' · '))}</span></span></li>`; }).join('')}</ul>
    <a class="btn btn-line" href="#tackle">${t('pk_shop_more')}</a></div>`, { label: t('pk_shop') });
}
function pkLight() {
  const w = openModal(`<div class="pk-light"><h2>${t('pk_light')}</h2><p class="lede">${t('pk_light_sub')}</p>${typeof wxCardHTML === 'function' && wxOn() ? wxCardHTML() : `<p class="muted">${t('pk_light_none')}</p>`}</div>`, { wide: true, label: t('pk_light') });
  try { if (typeof wxHydrate === 'function') wxHydrate(w); } catch (e) { }
}
function pkTank() {
  const rows = [...PKS.people.values()].map(p => ({ uid: p.uid, b: p.best })).concat([{ uid: myId(), b: PKS.best ? PKS.best.sp + '|' + PKS.best.len : '' }])
    .map(x => { const [sp, len] = String(x.b || '').split('|'); return { uid: x.uid, sp, len: +len, r: SPI[sp] ? +len / SPI[sp].L : 0 }; }).filter(x => x.r > 0).sort((a, b) => b.r - a.r).slice(0, 8);
  openModal(`<div class="pk-tank"><h2>${t('pk_tank')}</h2><p class="lede">${t('pk_tank_sub')}</p>
    ${rows.length ? `<ol class="pk-tank-list">${rows.map((x, i) => { const a = x.uid === myId() ? S.me : S.anglers.get(x.uid); return `<li><span class="wk-rank r${i + 1}">${i + 1}</span>${avatar(a, 28)}<b>${esc((a && a.nick) || '?')}</b><span>${esc(nameOf(x.sp))} ${lenFmt(x.len)}</span></li>`; }).join('')}</ol>` : `<p class="muted">${t('pk_tank_none')}</p>`}
    <p class="hint">${t('pk_game_note')}</p></div>`, { label: t('pk_tank') });
}

/* ---------- the fishing game: cast, wait for the float to dip (찌릿!), strike, then reel without snapping the line ---------- */
function pkPool(m) {
  if (PK_POOL.m === m) return PK_POOL.list;
  const list = GEO.regionPrior('KS', m).filter(x => SPI[x.id] && SPI[x.id].w !== 'F' && SPI[x.id].L > 0 && SPI[x.id].X > 0).slice(0, 18);
  let tot = 0; for (const x of list) tot += x.p;
  PK_POOL = { m, list: list.map(x => ({ id: x.id, p: x.p / (tot || 1) })) };
  return PK_POOL.list;
}
// the same seed gives the same fish in the same order: in a duel both players get exactly the same sea
function pkFish(seed, idx, m) {
  const R = FD.seeded((seed ^ Math.imul(idx + 1, 2654435761)) >>> 0);
  const pool = pkPool(m); let r = R(), sp = pool.length ? pool[0].id : 'madai';
  for (const x of pool) { r -= x.p; if (r <= 0) { sp = x.id; break; } }
  const s0 = SPI[sp]; const trophy = R() < .07;
  let len = trophy ? s0.L * (1.15 + .35 * R()) : s0.L * (.55 + .5 * R() + .25 * R() * R());
  len = Math.round(Math.max(8, Math.min(s0.X * .97, len)) * 10) / 10;
  const q = len / s0.L, wait = 1.6 + R() * 4.2;
  const nibs = []; for (let i = Math.floor(R() * 3); i > 0; i--) nibs.push(.5 + R() * Math.max(.2, wait - 1));
  const win = clamp(1.05 - .25 * (q - 1), .55, 1.1);
  const pulls = []; let at = .8 + R() * 1.2; while (at < 40) { const d = .5 + R() * .5; pulls.push([at, at + d]); at += d + .9 + R() * 1.6 / Math.max(.6, q); }
  return { sp, len, q, wait, nibs, win, pulls, trophy };
}
function pkGameOpen(mode, opts = {}) {
  const box = $('#pk-game'); if (!box) return;
  const spot = PK.SPOTS.find(s => s.id === opts.spot) || pkNear(PK.SPOTS, PKS.me.x, PKS.me.y, 80) || null; // a duel can start anywhere
  PKS.game = { mode, seed: (opts.seed >>> 0) || ((Math.random() * 2 ** 32) >>> 0), m: opts.m != null ? opts.m : pkKst().m, idx: 0, phase: mode === 'duel' ? 'wait' : 'ready', pt: 0, f: null, T: 35, D: 100, slack: 0, hold: false, bag: [], score: 0, msg: '', spot };
  if (mode === 'duel') PKS.game.f = pkFish(PKS.game.seed, 0, PKS.game.m);
  if (PKS.me.moving || (PKS.me.path && PKS.me.path.length)) pkWalk(PKS.me.x, PKS.me.y); // stop where I am (and tell the others)
  PKS.me.act = mode === 'duel' ? 'duel' : 'fish'; PKS.me.spot = spot ? spot.id : ''; if (spot && spot.dx) PKS.me.dir = spot.dx < 0 ? -1 : 1; pkTrackSoon();
  box.hidden = false; box.className = 'pk-game mode-' + mode;
  box.innerHTML = `<div class="pkg-top"><b id="pkg-title">${mode === 'duel' ? '⚔️ ' + t('pk_duel_vs', { nick: esc((S.anglers.get(PKS.duel.peer) || {}).nick || '?') }) : '🎣 ' + t('pk_fishing')}</b><span class="pkg-time num" id="pkg-time"></span>${mode === 'duel' ? '' : `<button class="pkg-x" data-pkg="quit" aria-label="${esc(t('close'))}">${icon('close')}</button>`}</div>
    ${mode === 'duel' ? `<div class="pkg-score"><span>${t('pk_me')} <b class="num" id="pkg-my">0</b></span><span>${t('pk_them')} <b class="num" id="pkg-op">0</b></span></div>` : ''}
    <canvas id="pkg-cv" aria-hidden="true"></canvas>
    <div class="pkg-meters"><div class="pkg-meter" title="${esc(t('pk_tension'))}"><span class="pkg-zone"></span><i id="pkg-t"></i></div><div class="pkg-meter dist" title="${esc(t('pk_distance'))}"><i id="pkg-d"></i></div></div>
    <p class="pkg-msg" id="pkg-msg" aria-live="polite"></p>
    <button class="btn btn-primary btn-lg btn-block pkg-btn" id="pkg-btn"></button>
    <div class="pkg-bag" id="pkg-bag"></div>`;
  const btn = $('#pkg-btn', box);
  const down = e => { e.preventDefault(); pkGameInput(true); }, up = e => { e.preventDefault(); pkGameInput(false); };
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
  btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); pkGameInput(true); } });
  btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pkGameInput(false); } });
  box.querySelector('[data-pkg="quit"]')?.addEventListener('click', () => pkGameClose());
  pkGameView();
  setTimeout(() => btn.focus({ preventScroll: true }), 50);
}
function pkGameClose(silent) {
  const box = $('#pk-game'); if (box) { box.hidden = true; box.innerHTML = ''; }
  PKS.game = null; if (PKS.me) { PKS.me.act = ''; PKS.me.spot = ''; } if (!silent) pkTrackSoon();
  const bar = $('#pk-act'); if (bar) bar.dataset.k = '';
}
function pkGameInput(down) {
  const G = PKS.game; if (!G) return;
  if (!down) { G.hold = false; return; }
  if (G.phase === 'ready') { G.f = pkFish(G.seed, G.idx, G.m); G.phase = 'wait'; G.pt = 0; G.msg = ''; }
  else if (G.phase === 'wait') { G.phase = 'lost'; G.pt = 0; G.msg = t('pk_early'); G.again = true; } // too soon: the fish swam off (the same fish comes back)
  else if (G.phase === 'bite') { G.phase = 'fight'; G.pt = 0; G.T = 35; G.D = 100; G.slack = 0; G.hold = true; G.msg = ''; }
  else if (G.phase === 'fight') G.hold = true;
  else if ((G.phase === 'got' || G.phase === 'lost') && G.mode === 'solo' && G.pt > .4) { if (G.phase === 'lost' && !G.again) G.idx++; G.again = false; G.f = pkFish(G.seed, G.idx, G.m); G.phase = 'wait'; G.pt = 0; G.msg = ''; }
  pkGameView();
}
function pkGameStep(dt, t) {
  const G = PKS.game; if (!G) return;
  const D = PKS.duel;
  if (G.mode === 'duel') {
    if (!D || D.state === 'count') { pkGameView(); pkGameDraw(t); return; }
    if (D.state === 'play' && performance.now() >= D.end) { G.phase = 'over'; G.hold = false; pkDuelFinish(); }
  }
  G.pt += dt; const f = G.f;
  if (G.phase === 'wait' && f && G.pt >= f.wait) { G.phase = 'bite'; G.pt = 0; if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { } }
  else if (G.phase === 'bite' && G.pt > f.win) { G.phase = 'lost'; G.pt = 0; G.msg = t_('pk_missed'); G.again = false; }
  else if (G.phase === 'fight') {
    const pull = f.pulls.some(([a, b]) => G.pt >= a && G.pt < b);
    if (G.hold) { G.D -= (24 / (.7 + .5 * f.q)) * (G.T >= 40 && G.T <= 85 ? 1.25 : .8) * dt; G.T += (16 + 10 * f.q + (pull ? 42 : 0)) * dt; }
    else { G.T -= 34 * dt; G.D += (pull ? 10 : 3) * dt; }
    G.T = clamp(G.T, 0, 100); G.D = clamp(G.D, 0, 100);
    G.slack = G.T < 6 ? G.slack + dt : 0;
    if (G.T >= 100) { G.phase = 'lost'; G.pt = 0; G.msg = t_('pk_snap'); G.again = false; if (navigator.vibrate) try { navigator.vibrate([40, 40, 40]); } catch (e) { } }
    else if (G.slack > 2.2) { G.phase = 'lost'; G.pt = 0; G.msg = t_('pk_slip'); G.again = false; }
    else if (G.D <= 0) pkGameGot();
  }
  else if (G.mode === 'duel' && (G.phase === 'got' || G.phase === 'lost') && G.pt > (G.phase === 'got' ? 1.1 : .9)) {
    if (!G.again) G.idx++; G.again = false; G.f = pkFish(G.seed, G.idx, G.m); G.phase = 'wait'; G.pt = 0; G.msg = '';
  }
  pkGameView(); pkGameDraw(t);
}
function pkGameGot() {
  const G = PKS.game; const f = G.f; const s0 = SPI[f.sp];
  const sc = Math.round(100 * f.len / s0.L);
  G.phase = 'got'; G.pt = 0; G.again = false; G.score += sc; G.bag.push({ sp: f.sp, len: f.len, s: sc });
  G.msg = t(f.trophy ? 'pk_got_big' : 'pk_got', { fish: `${nameOf(f.sp)} ${lenFmt(f.len)}` });
  if (G.mode === 'solo') {
    G.idx++; PKS.stats.n = (PKS.stats.n || 0) + 1; PKS.dirty = true;
    if (!PKS.best || f.len / s0.L > PKS.best.len / ((SPI[PKS.best.sp] || s0).L)) { PKS.best = { sp: f.sp, len: f.len, at: nowMs() }; G.msg += ' · ' + t('pk_new_best'); pkTrackSoon(); }
  } else if (PKS.duel) { PKS.duel.my = { n: G.bag.length, s: G.score }; pkSend('df', { id: PKS.duel.id, u: myId(), n: G.bag.length, s: G.score }); }
}
function pkGameView() {
  const G = PKS.game; if (!G) return;
  const btn = $('#pkg-btn'), msg = $('#pkg-msg'), T = $('#pkg-t'), Dm = $('#pkg-d'), time = $('#pkg-time'), bag = $('#pkg-bag');
  if (!btn) return;
  const lab = { ready: t('pk_cast'), wait: t('pk_wait'), bite: t('pk_strike'), fight: t('pk_reel'), got: G.mode === 'solo' ? t('pk_again') : t('pk_next'), lost: G.mode === 'solo' ? t('pk_again') : t('pk_next'), over: t('pk_over') }[G.phase] || '';
  if (btn.textContent !== lab) btn.textContent = lab;
  btn.classList.toggle('hot', G.phase === 'bite'); btn.disabled = G.phase === 'over' || (G.mode === 'duel' && PKS.duel && PKS.duel.state === 'count');
  const hint = G.phase === 'wait' ? t('pk_wait_hint') : G.phase === 'bite' ? t('pk_bite') : G.phase === 'fight' ? t('pk_fight_hint') : G.phase === 'ready' ? t('pk_ready_hint') : '';
  const text = G.msg || hint; if (msg.textContent !== text) msg.textContent = text;
  if (T) { T.style.width = (G.phase === 'fight' ? G.T : 0) + '%'; T.classList.toggle('danger', G.T > 85); }
  if (Dm) Dm.style.width = (G.phase === 'fight' ? 100 - G.D : 0) + '%';
  if (G.mode === 'duel' && PKS.duel) {
    const d = PKS.duel; const left = d.state === 'count' ? Math.ceil((d.t0 - performance.now()) / 1000) : Math.max(0, Math.ceil((d.end - performance.now()) / 1000));
    if (time) time.textContent = d.state === 'count' ? t('pk_count', { n: Math.max(1, left) }) : t('pk_left', { n: left });
    const my = $('#pkg-my'), op = $('#pkg-op'); if (my) my.textContent = fmtN(G.score); if (op) op.textContent = fmtN((d.op && d.op.s) || 0);
  } else if (time) time.textContent = G.bag.length ? t('pk_bag_n', { n: G.bag.length }) : '';
  if (bag && bag.dataset.n !== String(G.bag.length)) { bag.dataset.n = String(G.bag.length); bag.innerHTML = G.bag.slice(-6).reverse().map(x => `<span class="pkg-fish"><img src="${FD.thumb(SPI[x.sp], 90, 50)}" alt=""><span>${esc(nameOf(x.sp))} ${lenFmt(x.len)}</span></span>`).join(''); }
}
function pkGameDraw(t) {
  const G = PKS.game; const cv = $('#pkg-cv'); if (!G || !cv) return;
  const r = cv.getBoundingClientRect(); const w = r.width, h = r.height; if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#9ED4EA'); sky.addColorStop(.32, '#9ED4EA'); sky.addColorStop(.33, '#2E8CC0'); sky.addColorStop(1, '#0E4E78');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const sea = h * .33;
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 8) { const y = sea + Math.sin(x / 18 + t * 2) * 2; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  const f = G.f; let fx = w / 2, fy = sea;
  const nib = G.phase === 'wait' && f && f.nibs.some(n => G.pt >= n && G.pt < n + .35);
  if (G.phase === 'bite') { fy = sea + 14 + Math.sin(t * 30) * 2; g.font = `800 ${Math.round(h * .17)}px ${pkFont()}`; g.textAlign = 'center'; g.fillStyle = '#FF5A1F'; g.fillText(t_('pk_zzirit'), w / 2, sea - 18); for (let i = 0; i < 3; i++) { const rr = ((t * 60 + i * 20) % 60); g.strokeStyle = `rgba(255,255,255,${1 - rr / 60})`; g.beginPath(); g.ellipse(fx, sea + 2, rr, rr * .3, 0, 0, Math.PI * 2); g.stroke(); } }
  else if (nib) fy = sea + 5 + Math.sin(t * 40) * 2;
  else if (G.phase === 'wait') fy = sea + Math.sin(t * 2.4) * 2;
  if (G.phase === 'fight' && f) {
    // the fish pulls left and right; closer to the surface as it comes in
    const pull = f.pulls.some(([a, b]) => G.pt >= a && G.pt < b);
    const fxp = w / 2 + Math.sin(G.pt * (pull ? 4 : 1.6)) * w * .28, fyp = sea + 10 + (G.D / 100) * (h - sea - 26);
    g.strokeStyle = G.T > 85 ? '#FF6B5A' : 'rgba(255,255,255,.85)'; g.lineWidth = G.T > 85 ? 2 : 1.2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(fxp, fyp); g.stroke();
    const sp = SPI[f.sp]; if (sp) { g.save(); g.globalAlpha = .55 + .45 * (1 - G.D / 100); FD.draw(g, sp, fxp, fyp + 6, Math.min(w * .3, 40 + f.q * 30), { t, flip: Math.cos(G.pt * (pull ? 4 : 1.6)) < 0 }); g.restore(); }
  } else if (G.phase === 'got' && f && SPI[f.sp]) {
    FD.draw(g, SPI[f.sp], w / 2, sea + (h - sea) * .45, Math.min(w * .42, 120), { t });
  } else if (G.phase !== 'ready' && G.phase !== 'over') {
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(fx, fy - 8); g.stroke();
    g.fillStyle = '#FF3B2F'; g.beginPath(); g.ellipse(fx, fy - 6, 5, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#FFF'; g.beginPath(); g.ellipse(fx, fy - 6, 5, 7, 0, 0, Math.PI); g.fill();
    g.strokeStyle = '#2B2433'; g.lineWidth = 1; g.beginPath(); g.moveTo(fx, fy - 13); g.lineTo(fx, fy - 18); g.stroke();
  }
}

/* ---------- duels: ask, answer, a countdown, 60 seconds with the same fish for both, then the result ---------- */
function pkDuelAsk(uid) {
  if (PKS.duel || PKS.game) return;
  if (!PKS.room || !PKS.subscribed) { toast(t('pk_reconnect'), 'info'); return; }
  const id = rid(8);
  PKS.duel = { id, peer: uid, role: 'from', state: 'asking', my: { n: 0, s: 0 }, op: { n: 0, s: 0 } };
  pkSend('di', { id, u: myId(), to: uid });
  const nick = (S.anglers.get(uid) || {}).nick || '?';
  PKS.duelW = openModal(`<div class="pk-ask"><h2>⚔️ ${t('pk_duel_asked', { nick: esc(nick) })}</h2><p class="lede">${t('pk_duel_wait')}</p><div class="actions"><button class="btn btn-ghost" data-pkd="cancel">${t('cancel')}</button></div></div>`, { label: t('pk_duel_ask'), noClose: true });
  PKS.duelW.querySelector('[data-pkd="cancel"]').onclick = () => pkDuelAbort(false);
  PKS.duel.timer = setTimeout(() => { if (PKS.duel && PKS.duel.id === id && PKS.duel.state === 'asking') { pkDuelAbort(false); toast(t('pk_duel_noanswer', { nick }), 'info'); } }, 16000);
}
function pkDuelMsg(ev, p) {
  const me = myId(); const d = PKS.duel;
  if (ev === 'di' && p.to === me) {
    // someone asks me: only someone who is here, not again right after a no; busy people answer no by themselves
    if (!PKS.people.has(p.u) || (PKS.diBlock && PKS.diBlock.get(p.u) > nowMs())) return;
    if (d || PKS.game || !PKS.on) { pkSend('da', { id: p.id, u: me, to: p.u, ok: false, busy: true }); return; }
    const nick = (S.anglers.get(p.u) || {}).nick || '?';
    PKS.duel = { id: p.id, peer: p.u, role: 'to', state: 'asked', my: { n: 0, s: 0 }, op: { n: 0, s: 0 } };
    const w = PKS.duelW = openModal(`<div class="pk-ask"><h2>⚔️ ${t('pk_duel_in', { nick: esc(nick) })}</h2><p class="lede">${t('pk_duel_rule')}</p><p class="muted small" id="pkd-left"></p>
      <div class="actions"><button class="btn btn-primary" data-pkd="yes">${t('pk_duel_yes')}</button><button class="btn btn-ghost" data-pkd="no">${t('pk_duel_no')}</button></div></div>`, { label: t('pk_duel_ask'), noClose: true });
    let left = 15; const tick = () => { const el = $('#pkd-left', w); if (el) el.textContent = t('pk_duel_left', { n: left }); };
    tick(); PKS.duel.timer = setInterval(() => { left--; tick(); if (left <= 0) answer(false); }, 1000);
    const answer = ok => {
      const dd = PKS.duel; if (!dd || dd.id !== p.id || dd.state !== 'asked') return;
      clearInterval(dd.timer); closeModal(w); PKS.duelW = null;
      if (!ok) { pkSend('da', { id: p.id, u: me, to: p.u, ok: false }); PKS.duel = null; (PKS.diBlock = PKS.diBlock || new Map()).set(p.u, nowMs() + 30000); return; }
      const seed = (Math.random() * 2 ** 32) >>> 0, m = pkKst().m;
      pkSend('da', { id: p.id, u: me, to: p.u, ok: true, seed, m });
      pkDuelStart(seed, m);
    };
    w.querySelector('[data-pkd="yes"]').onclick = () => answer(true);
    w.querySelector('[data-pkd="no"]').onclick = () => answer(false);
    return;
  }
  if (!d || p.id !== d.id || p.u !== d.peer) return;
  if (ev === 'da' && d.state === 'asking') {
    clearTimeout(d.timer); if (PKS.duelW) { closeModal(PKS.duelW); PKS.duelW = null; }
    const nick = (S.anglers.get(d.peer) || {}).nick || '?';
    if (!p.ok) { PKS.duel = null; toast(t(p.busy ? 'pk_duel_busy' : 'pk_duel_declined', { nick }), 'info'); return; }
    pkDuelStart(p.seed >>> 0, +p.m);
  } else if (ev === 'df') { d.op = { n: +p.n || 0, s: +p.s || 0 }; }
  else if (ev === 'de') { d.op = { n: +p.n || 0, s: +p.s || 0, fin: true }; if (d.state === 'done') pkDuelResult(); }
  else if (ev === 'dx') { if (d.state === 'asked') { clearInterval(d.timer); if (PKS.duelW) { closeModal(PKS.duelW); PKS.duelW = null; } PKS.duel = null; toast(t('pk_duel_cancelled'), 'info'); } else if (d.state === 'play' || d.state === 'count') pkDuelGone(); }
}
function pkDuelStart(seed, m) {
  const d = PKS.duel; d.state = 'count'; d.t0 = performance.now() + 3000; d.end = d.t0 + PK.DUEL; d.seed = seed;
  // each fishes where they stand; the sea is the same for both (same seed: the same fish in the same order)
  pkGameOpen('duel', { seed, m });
  setTimeout(() => { if (PKS.duel === d && d.state === 'count') { d.state = 'play'; if (PKS.game) { PKS.game.phase = 'wait'; PKS.game.pt = 0; } } }, 3000);
}
function pkDuelFinish() {
  const d = PKS.duel; if (!d || d.state === 'done') return;
  d.state = 'done'; const G = PKS.game;
  d.my = { n: G ? G.bag.length : 0, s: G ? G.score : 0 };
  pkSend('de', { id: d.id, u: myId(), n: d.my.n, s: d.my.s });
  d.wait = setTimeout(pkDuelResult, 4500); // the other side's final word, or their last score after a few seconds
  if (d.op.fin) pkDuelResult();
}
function pkDuelResult() {
  const d = PKS.duel; if (!d || d.shown) return; d.shown = true; clearTimeout(d.wait);
  const res = d.forfeit ? 'w' : d.my.s > d.op.s ? 'w' : d.my.s < d.op.s ? 'l' : 'd';
  PKS.stats[res] = (PKS.stats[res] || 0) + 1; PKS.dirty = true; pkSaveStats(true);
  const nick = (S.anglers.get(d.peer) || {}).nick || '?';
  if (res === 'w') PKS.me.emote = { e: '🏆', until: nowMs() + 4000 };
  pkGameClose();
  openModal(`<div class="pk-result r-${res}"><p class="eyebrow">⚔️ ${t('pk_duel_vs', { nick: esc(nick) })}</p><h2>${t('pk_res_' + res)}</h2>
    ${d.forfeit ? `<p class="lede">${t('pk_res_forfeit', { nick: esc(nick) })}</p>` : `<div class="pk-res-score"><div><span>${t('pk_me')}</span><b class="num">${fmtN(d.my.s)}</b><span class="muted small">${t('pk_bag_n', { n: d.my.n })}</span></div><span class="vs">:</span><div><span>${esc(nick)}</span><b class="num">${fmtN(d.op.s)}</b><span class="muted small">${t('pk_bag_n', { n: d.op.n })}</span></div></div>`}
    <p class="hint">${t('pk_score_how')}</p>
    <div class="actions"><button class="btn btn-primary" data-close>${t('ok')}</button></div></div>`, { label: t('pk_duel_ask') });
  if (res === 'w') pkSend('em', { u: myId(), e: 3 });
  PKS.duel = null;
}
function pkDuelGone() {
  const d = PKS.duel; if (!d) return;
  if (d.state === 'asking' || d.state === 'asked') { clearTimeout(d.timer); clearInterval(d.timer); if (PKS.duelW) { closeModal(PKS.duelW); PKS.duelW = null; } PKS.duel = null; return; }
  if (d.state === 'done') { d.op.fin = true; pkDuelResult(); return; }
  d.forfeit = true; d.state = 'done'; pkDuelResult();
}
function pkDuelAbort(leaving) {
  const d = PKS.duel; if (!d) return;
  clearTimeout(d.timer); clearInterval(d.timer); clearTimeout(d.wait);
  pkSend('dx', { id: d.id, u: myId() });
  if (PKS.duelW) { closeModal(PKS.duelW); PKS.duelW = null; }
  if (d.state === 'play' || d.state === 'count') { PKS.stats.l = (PKS.stats.l || 0) + 1; PKS.dirty = true; }
  PKS.duel = null; if (PKS.game && PKS.game.mode === 'duel') pkGameClose(leaving);
}

/* ---------- the way in from the home page: the park (a small picture of it) and the chat ---------- */
let PK_THUMB = null, PK_THUMB_BUSY = false;
function pkThumb() {
  if (PK_THUMB || PK_THUMB_BUSY) return PK_THUMB;
  PK_THUMB_BUSY = true;
  (window.requestIdleCallback || (f => setTimeout(f, 800)))(() => {
    try {
      const big = PKS.bgImg || (PKS.bgImg = pkBg());
      const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d');
      g.drawImage(big, 0, 0, PK.W, PK.H, 0, 0, 640, 400);
      const k = 640 / PK.W; g.save(); g.scale(k, k); for (const it of pkDrawProps(g, 0, false)) it.d(); g.restore(); PKS.labels = [];
      PK_THUMB = c.toDataURL('image/jpeg', .72);
      $$('.hl-park .hl-art').forEach(n => { n.style.backgroundImage = `url(${PK_THUMB})`; });
    } catch (e) { console.warn(e); }
  });
  return null;
}
function homeLiveHTML() {
  if (!pkWeb()) return '';
  const th = pkThumb(); const n = dmUnread();
  return `<section class="home-live">
    <a class="hl-card hl-park" href="#park"><span class="hl-art"${th ? ` style="background-image:url(${th})"` : ''}></span>
      <span class="hl-txt"><span class="hl-tag">LIVE</span><b>${t('pk_title')}</b><span>${t('home_live_park')}</span></span><span class="btn btn-light btn-sm hl-go">${t('home_live_go')}</span></a>
    <a class="hl-card hl-chat" href="#chat">${icon('chat', 'hl-ic')}
      <span class="hl-txt"><b>${t('cht_title')}${n ? ` <i class="badge num">${n > 9 ? '9+' : n}</i>` : ''}</b><span>${t('home_live_chat')}</span></span><span class="btn btn-light btn-sm hl-go">${t('home_live_go')}</span></a>
  </section>`;
}

/* ---------- the page ---------- */
VIEWS.park = {
  render(el) {
    if (!pkWeb()) { el.innerHTML = `<div class="page"><div class="empty card big">${icon('wave', 'big')}<h2>${t('pk_web_only')}</h2><p class="muted">${t('cht_web_only_sub')}</p></div></div>`; return; }
    if (!S.me || !S.me.nick) {
      el.innerHTML = `<div class="page park-page"><header class="page-head"><h1>${t('pk_title')}</h1><p class="lede">${t('pk_sub')}</p></header><div class="empty card big">${icon('wave', 'big')}<h2>${t('pk_need_profile')}</h2><button class="btn btn-primary" data-act="onboard">${t('onb_go')}</button></div></div>`;
      return;
    }
    if (!S.ready) { el.innerHTML = `<div class="page park-page"><div class="empty card big">${icon('wave', 'big')}<p class="muted">${t('loading')}</p></div></div>`; return; }
    if (S.mode !== 'shared' || !S.uid) { pkStop(); el.innerHTML = `<div class="page park-page"><header class="page-head"><h1>${t('pk_title')}</h1></header><div class="empty card big">${icon('wave', 'big')}<h2>${t('pk_offline')}</h2><p class="muted">${t('pk_offline_sub')}</p></div></div>`; return; }
    if (PKS.on && el.querySelector('#pk-cv')) { if (el.dataset.lang === S.lang) { pkPanel(); pkLog(); return; } pkStop(); } // already walking around: keep it
    el.dataset.lang = S.lang;
    el.innerHTML = `
    <div class="page park-page">
      <header class="page-head pk-head"><div><h1>${t('pk_title')}</h1><p class="lede">${t('pk_sub')}</p></div>
        <div class="pk-rooms" role="group" aria-label="${esc(t('pk_rooms'))}">${Array.from({ length: PK.ROOMS }, (_, i) => `<button class="chip chip-tab" data-pkroom="${i + 1}">${t('pk_room', { n: i + 1 })}</button>`).join('')}</div></header>
      <div class="pk-wrap">
        <div class="pk-stage">
          <canvas id="pk-cv" class="pk-cv" tabindex="0" aria-label="${esc(t('pk_canvas'))}"></canvas>
          <ol class="pk-log" id="pk-log" aria-hidden="true"></ol>
          <div class="pk-act" id="pk-act"></div>
          <div class="pk-game" id="pk-game" hidden></div>
          <div class="pk-emo" id="pk-emo" hidden>${PK.EMO.map((e, i) => `<button data-pkemo="${i}" aria-label="${esc(e)}">${e}</button>`).join('')}</div>
        </div>
        <div class="pk-bar">
          <form class="pk-say" id="pk-say"><button type="button" class="btn btn-ghost btn-sm pk-emo-btn" data-pk="emo" aria-label="${esc(t('pk_emote'))}">😊</button><input id="pk-text" maxlength="200" autocomplete="off" placeholder="${esc(t('pk_say_ph'))}"><button class="btn btn-primary btn-sm" type="submit">${icon('send')}</button></form>
        </div>
        <aside class="pk-side card"><p class="pk-status" id="pk-status"></p><ul class="pk-people" id="pk-people"></ul><p class="hint">${t('pk_side_hint')}</p></aside>
      </div>
      <p class="hint">${icon('info')} ${t('pk_note')}</p>
    </div>`;
    PKS.cv = $('#pk-cv', el); PKS.ctx = PKS.cv.getContext('2d');
    PKS.cv.addEventListener('pointerdown', e => { if (e.button === 0 || e.pointerType !== 'mouse') pkTap(e); });
    PKS.keys = new Set();
    PKS.cv.addEventListener('keydown', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) { e.preventDefault(); PKS.keys.add(k); } });
    PKS.cv.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; PKS.keys.delete(k); });
    PKS.cv.addEventListener('blur', () => PKS.keys.clear());
    el.onclick = e => {
      const rb = e.target.closest('[data-pkroom]'); if (rb) { if (+rb.dataset.pkroom !== PKS.roomNo && !PKS.duel) { pkGameClose(true); pkJoin(+rb.dataset.pkroom); } return; }
      const em = e.target.closest('[data-pkemo]'); if (em) { pkEmote(+em.dataset.pkemo); return; }
      const who = e.target.closest('[data-pkwho]'); if (who) { pkCard(who.dataset.pkwho); return; }
      const b = e.target.closest('[data-pk]'); if (!b) return;
      const k = b.dataset.pk;
      if (k === 'fish') pkGameOpen('solo', { spot: b.dataset.spot });
      else if (k === 'sit') pkSit(true);
      else if (k === 'stand') pkSit(false);
      else if (k === 'prop') pkProp(b.dataset.prop);
      else if (k === 'emo') pkEmotes();
    };
    $('#pk-say', el).onsubmit = async e => { e.preventDefault(); const inp = $('#pk-text', el); if (await chatSend(inp.value)) { inp.value = ''; } };
    pkStart(el);
    pkPanel(); pkLog();
  },
  leave() { pkStop(); }
};
window.addEventListener('pagehide', () => { try { pkStop(); } catch (e) { } });
// a hidden tab leaves the room after a minute (nobody stands around frozen) and comes back when shown again
document.addEventListener('visibilitychange', () => {
  if (!PKS.on) return;
  clearTimeout(PKS.hideT);
  if (document.hidden) PKS.hideT = setTimeout(() => { if (!document.hidden && PKS.on) return; if (PKS.duel) pkDuelAbort(false); if (PKS.game) pkGameClose(true); if (PKS.room) { try { PKS.room.leave(); } catch (e) { } PKS.room = null; } PKS.people = new Map(); PKS.subscribed = false; PKS.paused = true; }, 60000);
  else if (PKS.paused) { PKS.paused = false; pkJoin(PKS.roomNo); }
});
