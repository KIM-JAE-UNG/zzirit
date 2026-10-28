/* ===== "My Sea": painted layers (sky, shore, water, floor) cached off-screen, with the angler fishing from the surface ===== */
const SEA_THEMES = {
  dawn: { sky: ['#1b2848', '#47598a', '#b98a94', '#f2c39b'], sun: '#ffe3bd', sunAt: [.8, .8], sunR: 17, glow: .95, cloud: '#f4c8b6', cloudA: .55, far: ['#7d84a6', '#555e84', '#323b5c'], sea: ['#4d8ba3', '#225670', '#0c2a3a'], floor: ['#56645d', '#2b3734'], sand: '#6b796e', ray: '255,226,196', fog: '12,40,56', mist: 1 },
  day: { sky: ['#3d8fd8', '#69b2ea', '#a6d6f4', '#dcf1fb'], sun: '#fffbe8', sunAt: [.84, .26], sunR: 15, glow: .75, cloud: '#ffffff', cloudA: .92, far: ['#9cc0cc', '#6c9886', '#467761'], sea: ['#2b9fc6', '#127099', '#073f5c'], floor: ['#cdb78c', '#9a835c'], sand: '#e2cfa2', ray: '255,255,236', fog: '8,58,88', gulls: 1 },
  sunset: { sky: ['#291745', '#6c3067', '#d6604c', '#f8b858'], sun: '#ffd47c', sunAt: [.3, .88], sunR: 24, glow: 1.1, cloud: '#ff9f7c', cloudA: .62, far: ['#8a4c6e', '#5b3354', '#341f3e'], sea: ['#7c4b6a', '#3b2a52', '#141026'], floor: ['#4d363a', '#291d22'], sand: '#634a4c', ray: '255,200,150', fog: '24,14,38', gulls: 1 },
  sakura: { sky: ['#7a8ed1', '#aebbe9', '#f3c7d9', '#fde9ef'], sun: '#fff5f7', sunAt: [.8, .38], sunR: 14, glow: .6, cloud: '#ffffff', cloudA: .82, far: ['#bcaecd', '#9284ab', '#6c5f88'], sea: ['#4b9eb9', '#226c8d', '#0e3c55'], floor: ['#bca07b', '#8a7253'], sand: '#cfb48d', ray: '255,236,242', fog: '12,56,82', blossom: 1 },
  night: { sky: ['#02050e', '#051126', '#0a1d38', '#12284a'], sun: '#f1f6ff', sunAt: [.76, .3], sunR: 13, moon: 1, glow: .5, cloud: '#2c3e63', cloudA: .4, far: ['#1a2741', '#101c31', '#09121f'], sea: ['#0e2b44', '#071a2f', '#020913'], floor: ['#1b2731', '#0c141b'], sand: '#2a3944', ray: '160,200,255', fog: '2,9,18', stars: 1, squid: 1, city: 1 },
  reef: { sky: ['#3fb3e3', '#76ceef', '#bdebf8', '#e7fbff'], sun: '#fffde9', sunAt: [.8, .24], sunR: 15, glow: .7, cloud: '#ffffff', cloudA: .9, far: ['#86d3c3', '#52b09d', '#2f8b7a'], sea: ['#1fbfd2', '#0b90af', '#045e7d'], floor: ['#f2e2b6', '#d6be87'], sand: '#fbedc8', ray: '255,255,226', fog: '4,78,108', bright: 1 },
  aurora: { sky: ['#020712', '#071b33', '#0d3445', '#19475b'], sun: '#e6f7ff', sunAt: [.82, .24], sunR: 10, moon: 1, glow: .35, cloud: '#26405a', cloudA: .25, far: ['#d4e2ea', '#637d8f', '#2b3f4f'], sea: ['#10374a', '#08202f', '#020b13'], floor: ['#1e2c32', '#0e171b'], sand: '#2b3b41', ray: '150,255,210', fog: '2,12,20', stars: 1, aurora: 1, snow: 1 },
  palace: { sky: ['#050a1e', '#0f1d47', '#25306b', '#3e3a79'], sun: '#ffe7a3', sunAt: [.74, .3], sunR: 21, moon: 1, glow: .85, cloud: '#4d4b8c', cloudA: .42, far: ['#2c2e66', '#1e214c', '#131538'], sea: ['#0f4b6c', '#0a2e4c', '#05132a'], floor: ['#20304a', '#121a2a'], sand: '#2e3d58', ray: '255,215,130', fog: '4,14,34', stars: 1, palace: 1 }
};
class SeaScene {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts;
    this.theme = 'dawn'; this.decor = []; this.fx = []; this.fish = []; this.t = 0; this.run = false;
    this.hover = null; this.preview = null; this.char = null; this.rod = null; this.hideChar = false;
    this.reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    if (!opts.thumb) {
      this._ro = 'ResizeObserver' in window ? new ResizeObserver(() => this.resize()) : null;
      if (this._ro) this._ro.observe(canvas.parentElement || canvas);
      canvas.addEventListener('pointermove', e => this.onMove(e));
      canvas.addEventListener('pointerleave', () => { this.hover = null; if (this.onHover) this.onHover(null); });
      canvas.addEventListener('click', e => { const f = this.pick(e); if (f && this.onPick) this.onPick(f); });
    }
  }
  resize() {
    const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(240, r.width || parseFloat(this.cv.style.width) || 240); this.H = Math.max(150, r.height || parseFloat(this.cv.style.height) || 150);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr); this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.hz = Math.round(this.H * .36); this.floorY = this.H - Math.max(18, this.H * .1);
    this._key = null;
    for (const f of this.fish) this.place(f, true);
    if (!this.run) this.frame(0, true);
  }
  setState({ theme, decor, fx, fish, preview, char, rod, hideChar }) {
    if (theme) this.theme = theme; if (decor) this.decor = decor; if (fx) this.fx = fx;
    this.preview = preview || null;
    if (char !== undefined) { this.char = char; this.charImg = char ? CH.image(char, 'body') : null; if (this.charImg && !this.charImg.complete) this.charImg.onload = () => { if (!this.run) this.frame(0, true); }; }
    if (rod !== undefined) this.rod = rod;
    if (hideChar !== undefined) this.hideChar = hideChar;
    if (fish) {
      const old = new Map(this.fish.map(f => [f.key, f]));
      this.fish = fish.map(f => { const o = old.get(f.key); if (o) return Object.assign(o, f); const n = Object.assign({}, f); this.place(n); return n; });
    }
    if (!this.run) this.frame(0, true);
  }
  get P() { return SEA_THEMES[this.preview?.theme || this.theme] || SEA_THEMES.dawn; }
  get themeId() { return SEA_THEMES[this.preview?.theme || this.theme] ? (this.preview?.theme || this.theme) : 'dawn'; }
  has(id) { return (this.preview?.decor ? this.decor.concat(this.preview.decor) : this.decor).includes(id); }
  hasFx(id) { return (this.preview?.fx ? this.fx.concat(this.preview.fx) : this.fx).includes(id); }
  boatKind() { return this.has('dc_goldboat') ? 'gold' : this.has('dc_boat') ? 'boat' : null; }
  place(f, keep) {
    const sp = SPI[f.sp]; if (!sp) return;
    const rel = Math.max(.55, Math.min(1.6, Math.log2(1 + (f.len || sp.L) / sp.L) * 1.25));
    f.size = Math.max(24, Math.min(this.W * .26, this.W * .095 * rel * (sp.L > 120 ? 1.6 : sp.L > 60 ? 1.25 : 1)));
    if (!keep || f.x == null) {
      const r = FD.seeded(FD.hashStr(f.key));
      f.x = this.W * (.12 + r() * .76); f.depth = r();
      f.by = this.hz + (this.floorY - this.hz) * (.24 + f.depth * .6);
      f.v = (.25 + r() * .35) * (r() > .5 ? 1 : -1); f.ph = r() * 10;
    }
    if (sp.sh === 'octopus' || sp.sh === 'flat' || sp.sh === 'ray') f.by = this.floorY - f.size * .08;
    f.y = f.by;
  }
  start() { if (this.run) return; this.run = true; let last = performance.now(); const loop = now => { if (!this.run) return; const dt = Math.min(50, now - last); last = now; this.frame(dt); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.run = false; cancelAnimationFrame(this.raf); }
  pick(e) {
    const r = this.cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const f of this.fish) { const dx = x - f.x, dy = y - f.y; const d = dx * dx / (f.size * f.size * .3) + dy * dy / (f.size * f.size * .08); if (d < 1 && d < bd) { bd = d; best = f; } }
    return best;
  }
  onMove(e) { const f = this.pick(e); if (f !== this.hover) { this.hover = f; if (this.onHover) this.onHover(f, e); this.cv.style.cursor = f ? 'pointer' : 'default'; } else if (f && this.onHover) this.onHover(f, e); }

  /* ---------- static layers ---------- */
  ridge(seed, x, amp, base) {
    const r = FD.seeded(seed); const a = [r() * 6, r() * 6, r() * 6];
    return base + amp * (.55 * Math.sin(x * .006 + a[0]) + .3 * Math.sin(x * .017 + a[1]) + .15 * Math.sin(x * .045 + a[2]));
  }
  build() {
    const W = this.W, H = this.H, hz = this.hz, P = this.P, th = this.themeId, fy = this.floorY;
    const key = [th, W, H, this.boatKind(), ...['dc_tetra', 'dc_light', 'dc_rock', 'dc_shell', 'dc_anchor', 'dc_wreck', 'dc_coral'].map(x => this.has(x) ? 1 : 0)].join('|');
    if (this._key === key) return; this._key = key;
    const cv = this.bgCv || (this.bgCv = document.createElement('canvas'));
    cv.width = Math.round(W * this.dpr); cv.height = Math.round(H * this.dpr);
    const c = cv.getContext('2d'); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // sky
    let g = c.createLinearGradient(0, 0, 0, hz); P.sky.forEach((col, i) => g.addColorStop(i / (P.sky.length - 1), col));
    c.fillStyle = g; c.fillRect(0, 0, W, hz + 2);
    if (P.stars) { const r = FD.seeded(7); for (let i = 0; i < 150; i++) { const x = r() * W, y = r() * hz * .82, s = r() * 1.3 + .3; c.globalAlpha = .25 + r() * .7; c.fillStyle = '#fff'; c.fillRect(x, y, s, s); } c.globalAlpha = 1; }
    const sx = W * P.sunAt[0], sy = hz * P.sunAt[1];
    g = c.createRadialGradient(sx, sy, 2, sx, sy, hz * 1.1); g.addColorStop(0, FD.rgba(P.sun, .55 * P.glow)); g.addColorStop(.35, FD.rgba(P.sun, .18 * P.glow)); g.addColorStop(1, FD.rgba(P.sun, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, hz);
    if (P.moon) {
      g = c.createRadialGradient(sx - P.sunR * .3, sy - P.sunR * .3, 1, sx, sy, P.sunR); g.addColorStop(0, '#ffffff'); g.addColorStop(1, P.sun);
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, P.sunR, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(120,130,160,.18)'; for (const [dx, dy, rr] of [[-.3, -.2, .22], [.25, .15, .16], [-.05, .35, .12]]) { c.beginPath(); c.arc(sx + dx * P.sunR, sy + dy * P.sunR, rr * P.sunR, 0, Math.PI * 2); c.fill(); }
    } else {
      g = c.createRadialGradient(sx, sy, P.sunR * .2, sx, sy, P.sunR); g.addColorStop(0, '#ffffff'); g.addColorStop(.7, P.sun); g.addColorStop(1, FD.rgba(P.sun, .0));
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, P.sunR * 1.15, 0, Math.PI * 2); c.fill();
    }
    // far shore: three ridges, lighter = farther
    const layers = [[11, .2, .1, P.far[0]], [23, .13, .06, P.far[1]], [37, .07, .025, P.far[2]]];
    layers.forEach(([seed, amp, base, col], li) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, hz + 1);
      for (let x = 0; x <= W + 8; x += 6) { let y = hz - this.ridge(seed, x, hz * amp, hz * base); if (li === 2 && x > W * .6) y = Math.max(y, hz - hz * .04); c.lineTo(x, y); }
      c.lineTo(W, hz + 1); c.closePath(); c.fill();
      if (li === 0 && P.snow) { c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); for (let x = 0; x <= W; x += 6) { const y = hz - this.ridge(seed, x, hz * amp, hz * base); c.rect(x, y, 6, Math.max(0, (hz * .12) - (hz - y) * .02 - 8)); } c.fill(); c.restore(); }
    });
    if (P.blossom) { const r = FD.seeded(5); for (let i = 0; i < 9; i++) { const x = W * (.02 + i * .065 + r() * .02), y = hz - hz * (.06 + r() * .05); for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#f6bcd0' : '#fad3e1'; c.beginPath(); c.arc(x + (r() - .5) * 18, y + (r() - .5) * 10, 9 + r() * 7, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#6b4a4a'; c.fillRect(x - 1, y + 4, 2, hz - y); } }
    if (P.city) { const r = FD.seeded(3); for (let i = 0; i < 60; i++) { const x = W * (.05 + r() * .55), y = hz - 2 - r() * hz * .05; c.fillStyle = r() > .7 ? 'rgba(255,214,140,.9)' : 'rgba(255,240,200,.65)'; c.fillRect(x, y, 1.6, 1.6); } }
    if (P.squid) for (let i = 0; i < 6; i++) { const x = W * (.6 + i * .065), y = hz - 2; const lg = c.createRadialGradient(x, y, 1, x, y, 14); lg.addColorStop(0, 'rgba(200,255,210,.95)'); lg.addColorStop(1, 'rgba(120,255,160,0)'); c.fillStyle = lg; c.fillRect(x - 14, y - 14, 28, 28); }
    if (P.mist) { g = c.createLinearGradient(0, hz - hz * .18, 0, hz); g.addColorStop(0, 'rgba(255,230,215,0)'); g.addColorStop(1, 'rgba(255,230,215,.35)'); c.fillStyle = g; c.fillRect(0, hz - hz * .18, W, hz * .18); }
    // breakwater, tetrapods, lighthouse (above water, right side)
    if (this.has('dc_tetra') || this.has('dc_light')) this.breakwater(c, W, hz);
    if (this.has('dc_tetra')) this.tetrapods(c, W * .7, hz, W * .3);
    if (this.has('dc_light')) this.lighthouseBody(c, W * .9, hz);
    // water body
    g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, P.sea[0]); g.addColorStop(.45, P.sea[1]); g.addColorStop(1, P.sea[2]);
    c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
    // horizon shine
    g = c.createLinearGradient(0, hz, 0, hz + 18); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, hz, W, 18);
    // distant underwater rock formations and kelp silhouettes
    c.fillStyle = `rgba(${P.fog},.45)`;
    for (const [x0, w0, h0] of [[.08, .22, .2], [.55, .3, .26], [.85, .2, .16]]) { c.beginPath(); c.moveTo(W * x0, fy); c.quadraticCurveTo(W * (x0 + w0 * .25), fy - (fy - hz) * h0 * 1.2, W * (x0 + w0 * .5), fy - (fy - hz) * h0); c.quadraticCurveTo(W * (x0 + w0 * .8), fy - (fy - hz) * h0 * .7, W * (x0 + w0), fy); c.closePath(); c.fill(); }
    if (this.has('dc_wreck')) this.wreck(c, W * .7, fy);
    if (P.palace) this.palace(c, W * .5, fy, 0);
    // sea floor
    g = c.createLinearGradient(0, fy - 14, 0, H); g.addColorStop(0, P.floor[0]); g.addColorStop(1, P.floor[1]);
    c.fillStyle = g; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) c.lineTo(x, fy - this.ridge(91, x, 8, 2));
    c.lineTo(W, H); c.closePath(); c.fill();
    { const r = FD.seeded(13); c.strokeStyle = FD.rgba(P.sand, .35); c.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = r() * W, y = fy + 4 + r() * (H - fy - 6), w = 10 + r() * 22; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y - 3, x + w, y); c.stroke(); }
      for (let i = 0; i < 70; i++) { const x = r() * W, y = fy + 2 + r() * (H - fy); c.fillStyle = r() > .5 ? FD.rgba(P.sand, .45) : 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(x, y, .6 + r() * 1.6, 0, Math.PI * 2); c.fill(); } }
    if (this.has('dc_rock')) { this.rock(c, W * .2, fy + 4, Math.min(52, W * .07), 3); this.rock(c, W * .83, fy + 6, Math.min(38, W * .05), 9); }
    if (this.has('dc_shell')) this.shells(c, W, fy);
    if (this.has('dc_anchor')) this.anchor(c, W * .92, fy + 6);
    if (this.has('dc_coral') || P.bright) this.coral(c, W * .5, fy + 6, P.bright && !this.has('dc_coral') ? .7 : 1);
    if (!this.boatKind()) this.outcrop(c, W, hz);
    // cloud strip (drifts each frame)
    const cs = this.cloudCv || (this.cloudCv = document.createElement('canvas'));
    const cw = W * 2, ch = Math.max(20, hz * .7);
    cs.width = Math.round(cw * this.dpr); cs.height = Math.round(ch * this.dpr);
    const cc = cs.getContext('2d'); cc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const r = FD.seeded(th.length * 31 + 5);
    const cscale = clamp(W / 900, .45, 1.1), nClouds = W < 520 ? 4 : 6;
    for (let i = 0; i < nClouds; i++) {
      const x = r() * cw, y = ch * (.3 + r() * .45), s = (14 + r() * 24) * cscale, n = 7;
      // one cloud = overlapping soft puffs over a flat, slightly darker base
      const base = cc.createLinearGradient(0, y - s * .2, 0, y + s * .35); base.addColorStop(0, FD.rgba(P.cloud, P.cloudA * .9)); base.addColorStop(1, FD.rgba(P.cloud, 0));
      cc.fillStyle = base; cc.globalAlpha = .55; cc.beginPath(); cc.ellipse(x, y + s * .1, s * 1.8, s * .28, 0, 0, Math.PI * 2); cc.fill(); cc.globalAlpha = 1;
      for (let k = 0; k < n; k++) { const u = k / (n - 1), bx = x + (u - .5) * s * 3.2 + (r() - .5) * 8, by = y - Math.sin(u * Math.PI) * s * .55, br = s * (.42 + Math.sin(u * Math.PI) * .42);
        const cg = cc.createRadialGradient(bx - br * .25, by - br * .3, br * .1, bx, by, br); cg.addColorStop(0, FD.rgba(P.cloud, P.cloudA)); cg.addColorStop(.7, FD.rgba(P.cloud, P.cloudA * .55)); cg.addColorStop(1, FD.rgba(P.cloud, 0));
        cc.fillStyle = cg; cc.beginPath(); cc.arc(bx, by, br, 0, Math.PI * 2); cc.fill(); }
    }
  }

  /* ---------- per frame ---------- */
  frame(dt, still) {
    const c = this.ctx, W = this.W, H = this.H, hz = this.hz, P = this.P, fy = this.floorY;
    if (!still && !this.reduce) this.t += dt / 1000;
    const t = this.t;
    this.build();
    c.drawImage(this.bgCv, 0, 0, W, H);
    // clouds
    const ch = Math.max(20, hz * .7), off = (t * 6) % (W * 2);
    c.save(); c.beginPath(); c.rect(0, 0, W, hz); c.clip();
    c.drawImage(this.cloudCv, -off, 0, W * 2, ch); c.drawImage(this.cloudCv, W * 2 - off, 0, W * 2, ch);
    if (P.aurora) this.aurora(c, W, hz, t);
    if (P.stars) { for (let i = 0; i < 14; i++) { const x = (i * 97.3) % W, y = (i * 37.7) % (hz * .6); c.globalAlpha = .3 + .7 * Math.abs(Math.sin(t * 1.3 + i * 1.7)); c.fillStyle = '#fff'; c.fillRect(x, y, 1.8, 1.8); } c.globalAlpha = 1; }
    if (P.gulls) this.gulls(c, W, hz, t);
    c.restore();
    if (this.has('dc_light')) this.lighthouseBeam(c, W * .9, hz, t);
    // sun / moon glitter on the water
    this.glitter(c, W * P.sunAt[0], hz, t, P);
    // underwater light
    if (this.hasFx('fx_rays') || P.bright || P.palace) this.rays(c, W, hz, fy, t, P);
    this.caustics(c, W, hz, t);
    if (P.palace) this.palaceGlow(c, W * .5, fy, t);
    // animated decor on the floor
    if (this.has('dc_weed')) { for (const [x, s] of [[.07, .8], [.31, .65], [.72, .75], [.96, .9]]) this.kelp(c, W * x, fy + 6, t, s, x); }
    if (this.has('dc_clam')) this.clam(c, W * .28, fy + 8, t);
    if (this.has('dc_chest')) this.chest(c, W * .64, fy + 7, t);
    if (this.has('dc_trophy')) this.trophy(c, W * .38, fy + 6, t);
    if (this.hasFx('fx_school')) this.school(c, W, hz, fy, t);
    // fish (far → near)
    const order = this.fish.slice().sort((a, b) => (b.depth || 0) - (a.depth || 0) || a.size - b.size);
    for (const f of order) {
      const sp = SPI[f.sp]; if (!sp) continue;
      if (!still && !this.reduce) {
        const benthic = sp.sh === 'octopus' || sp.sh === 'flat' || sp.sh === 'ray';
        if (!benthic) {
          f.x += f.v * dt * .06 * (f === this.hover ? .25 : 1);
          if (f.x < f.size * .5) { f.x = f.size * .5; f.v = Math.abs(f.v); }
          if (f.x > W - f.size * .5) { f.x = W - f.size * .5; f.v = -Math.abs(f.v); }
          f.y = f.by + Math.sin(t * .8 + f.ph) * 9;
        } else f.x += Math.sin(t * .2 + f.ph) * .05;
      }
      c.save();
      c.globalAlpha = .82 + (1 - (f.depth || 0)) * .18;
      if (f === this.hover) { c.shadowColor = 'rgba(255,210,130,.95)'; c.shadowBlur = 18; }
      FD.draw(c, sp, f.x, f.y, f.size, { flip: f.v < 0 && sp.sh !== 'octopus', t: t + f.ph, still: this.reduce });
      c.restore();
    }
    if (this.has('dc_jelly')) this.jelly(c, W, hz, fy, t);
    if (this.has('dc_turtle')) this.turtle(c, W, hz, fy, t);
    // depth haze over everything below the surface
    let g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, `rgba(${P.fog},0)`); g.addColorStop(1, `rgba(${P.fog},.28)`);
    c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
    // surface: buoy, floats, boat + angler
    if (this.has('dc_buoy')) this.buoy(c, W * .66, hz, t);
    if (this.has('dc_floats')) this.floatMobile(c, W * .5, hz, t);
    this.angler(c, W, hz, t);
    this.surface(c, W, hz, t, P);
    // particles
    if (this.hasFx('fx_bubbles')) this.bubbles(c, W, hz, fy, t);
    if (this.hasFx('fx_plankton')) this.plankton(c, W, hz, fy, t);
    if (this.hasFx('fx_sparkle')) this.sparkle(c, W, hz, t);
    if (P.blossom) this.petals(c, W, hz, t);
    if (P.snow) this.snowfall(c, W, hz, t);
    if (P.palace) this.lanterns(c, W, hz, fy, t);
    // vignette
    g = c.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .35, W / 2, H * .55, Math.max(W, H) * .78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.26)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  /* ---------- sky & water effects ---------- */
  aurora(c, W, hz, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let x = 0; x <= W; x += 10) { const y = hz * (.22 + k * .09) + Math.sin(x * .011 + t * .45 + k * 1.7) * hz * .09 + Math.sin(x * .004 - t * .2) * hz * .05; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      for (let x = W; x >= 0; x -= 10) { const y = hz * (.22 + k * .09) + Math.sin(x * .011 + t * .45 + k * 1.7) * hz * .09 + Math.sin(x * .004 - t * .2) * hz * .05; c.lineTo(x, y + hz * (.22 + .05 * Math.sin(x * .02 + t))); }
      c.closePath();
      const g = c.createLinearGradient(0, hz * .1, 0, hz * .8); g.addColorStop(0, `rgba(120,255,190,${.16 - k * .03})`); g.addColorStop(.6, `rgba(90,200,255,${.08 - k * .015})`); g.addColorStop(1, 'rgba(160,90,255,0)');
      c.fillStyle = g; c.fill();
    }
    c.restore();
  }
  gulls(c, W, hz, t) {
    c.strokeStyle = 'rgba(40,50,70,.55)'; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const x = ((t * (14 + i * 4) + i * W * .37) % (W + 60)) - 30, y = hz * (.28 + i * .09) + Math.sin(t * 1.4 + i) * 4, s = 5 + i, f = Math.sin(t * 6 + i * 2) * 2.5;
      c.beginPath(); c.moveTo(x - s, y - f); c.quadraticCurveTo(x - s / 2, y - s * .5 - f, x, y); c.quadraticCurveTo(x + s / 2, y - s * .5 - f, x + s, y - f); c.stroke(); }
  }
  glitter(c, sx, hz, t, P) {
    const col = P.moon ? '235,242,255' : '255,240,210';
    for (let i = 0; i < 26; i++) { const y = hz + 2 + Math.pow(i / 26, 1.6) * (this.H - hz) * .35, spread = 6 + (y - hz) * .5;
      const x = sx + Math.sin(i * 12.9898 + Math.floor(t * 3 + i) * 1.7) * spread; const a = .15 + .45 * Math.abs(Math.sin(t * 2.4 + i * 1.3));
      c.fillStyle = `rgba(${col},${a})`; c.fillRect(x - 4, y, 8 + (i % 3) * 3, 1.3); }
  }
  rays(c, W, hz, fy, t, P) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const x = W * (.06 + i * .17) + Math.sin(t * .25 + i * 1.9) * 24, w = 22 + (i % 3) * 14;
      const g = c.createLinearGradient(0, hz, 0, fy); g.addColorStop(0, `rgba(${P.ray},.16)`); g.addColorStop(1, `rgba(${P.ray},0)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(x, hz); c.lineTo(x + w, hz); c.lineTo(x + w * 3.2 + 30, fy); c.lineTo(x + w * 1.4 + 10, fy); c.closePath(); c.fill(); }
    c.restore();
  }
  caustics(c, W, hz, t) {
    c.save(); c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) { const y0 = hz + 6 + k * 7; c.beginPath();
      for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * .05 + t * 1.6 + k) * 2.2 + Math.sin(x * .013 - t + k * 2) * 2; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke(); }
    c.restore();
  }
  surface(c, W, hz, t, P) {
    // translucent water over the lower hull, then a foamy wavy line
    let g = c.createLinearGradient(0, hz, 0, hz + 16); g.addColorStop(0, FD.rgba(P.sea[0], .55)); g.addColorStop(1, FD.rgba(P.sea[0], 0));
    c.fillStyle = g; c.fillRect(0, hz, W, 16);
    c.beginPath(); for (let x = 0; x <= W; x += 6) { const y = hz + Math.sin(x * .045 + t * 1.8) * 1.6 + Math.sin(x * .013 - t * .9) * 1.2; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 4; c.stroke();
  }

  /* ---------- above-water decor ---------- */
  breakwater(c, W, hz) {
    const x0 = W * .66; const g = c.createLinearGradient(0, hz - 14, 0, hz + 4); g.addColorStop(0, '#8a9196'); g.addColorStop(1, '#4e555a');
    c.fillStyle = g; c.beginPath(); c.moveTo(x0, hz + 4); c.lineTo(x0 + 10, hz - 12); c.lineTo(W, hz - 12); c.lineTo(W, hz + 4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0 + 10, hz - 12, W - x0 - 10, 2);
  }
  tetrapods(c, x0, hz, w) {
    const one = (x, y, s, rot) => {
      c.save(); c.translate(x, y); c.rotate(rot);
      for (const [dx, dy, k] of [[0, -1, .95], [-.87, .5, .8], [.87, .5, .7], [0, .15, .55]]) {
        const g = c.createLinearGradient(-s, -s, s, s); g.addColorStop(0, FD.shade('#b9bec1', k * .15)); g.addColorStop(1, FD.shade('#7d8488', -.1));
        c.strokeStyle = g; c.lineWidth = s * .46; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(dx * s, dy * s); c.stroke();
      }
      c.fillStyle = '#c4c9cc'; c.beginPath(); c.arc(0, 0, s * .28, 0, Math.PI * 2); c.fill();
      c.restore();
    };
    for (let i = 0; i < 8; i++) one(x0 + 6 + i * w / 8, hz - 16 - (i % 2) * 7, 9 + (i % 3), i * .9 + .3);
  }
  lighthouseBody(c, x, hz) {
    const h = Math.min(70, hz * .62), b = hz - 12;
    let g = c.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, '#c9d1d4'); g.addColorStop(.45, '#f4f7f8'); g.addColorStop(1, '#aab3b7');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 10, b); c.lineTo(x + 10, b); c.lineTo(x + 6.5, b - h); c.lineTo(x - 6.5, b - h); c.closePath(); c.fill();
    g = c.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, '#a62a22'); g.addColorStop(.45, '#e0463a'); g.addColorStop(1, '#8e231c');
    c.fillStyle = g; for (let i = 0; i < 3; i++) { const y = b - h * (.12 + i * .3), wd = 10 - i * 1.1; c.fillRect(x - wd + .6, y - 7, (wd - .6) * 2, 8); }
    c.fillStyle = '#2b333b'; c.fillRect(x - 9, b - h - 3, 18, 3); c.fillRect(x - 6, b - h - 14, 12, 11);
    c.fillStyle = '#ffe8a6'; c.fillRect(x - 4.5, b - h - 12, 9, 7);
    c.fillStyle = '#d23a2e'; c.beginPath(); c.moveTo(x - 7, b - h - 14); c.lineTo(x, b - h - 21); c.lineTo(x + 7, b - h - 14); c.closePath(); c.fill();
  }
  lighthouseBeam(c, x, hz, t) {
    const h = Math.min(70, hz * .62), y = hz - 12 - h - 8.5;
    const g0 = c.createRadialGradient(x, y, 1, x, y, 22); g0.addColorStop(0, 'rgba(255,240,180,.9)'); g0.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g0; c.fillRect(x - 22, y - 22, 44, 44);
    c.save(); c.translate(x, y); c.rotate(Math.PI + Math.sin(t * .9) * .55); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, 0, 230, 0); g.addColorStop(0, 'rgba(255,240,180,.42)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -2); c.lineTo(230, -30); c.lineTo(230, 30); c.lineTo(0, 2); c.closePath(); c.fill(); c.restore();
  }
  outcrop(c, W, hz) {
    // rocky ledge (갯바위) at the left edge where the angler stands when there is no boat
    const top = hz - Math.max(14, this.H * .055), xr = Math.max(70, W * .2);
    const g = c.createLinearGradient(0, top, 0, hz + 22); g.addColorStop(0, '#6c6862'); g.addColorStop(.5, '#4a4642'); g.addColorStop(1, '#2c2a28');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, hz + 26); c.lineTo(0, top - 6); c.quadraticCurveTo(xr * .25, top - 10, xr * .5, top); c.quadraticCurveTo(xr * .78, top + 2, xr * .9, top + 12); c.quadraticCurveTo(xr * 1.05, hz - 2, xr * 1.12, hz + 26); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, top - 5); c.quadraticCurveTo(xr * .25, top - 9, xr * .5, top + 1); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.18)'; for (const [x, y, r] of [[.3, .55, 7], [.62, .4, 5], [.8, .75, 6]]) { c.beginPath(); c.ellipse(xr * x, top + (hz - top) * y, r * 1.6, r * .7, -.3, 0, Math.PI * 2); c.fill(); }
    this._stand = { x: xr * .42, y: top - 2 };
  }

  /* ---------- the angler ---------- */
  angler(c, W, hz, t) {
    const kind = this.boatKind(); const bob = Math.sin(t * 1.4) * 2.2;
    let feetX, feetY;
    if (kind) { const bx = W * .34; this.boat(c, bx, hz + bob * .6, t, kind); feetX = bx - Math.min(34, W * .045); feetY = hz - Math.min(10, this.H * .025) + bob * .6; }
    else { const st = this._stand || { x: W * .1, y: hz - 20 }; feetX = st.x; feetY = st.y; }
    if (this.hideChar || !this.charImg || !this.charImg.complete || !this.charImg.naturalWidth) return;
    const h = clamp(this.H * .2, 44, 104), w = h * 72 / 128;
    c.save(); c.translate(feetX, feetY);
    c.drawImage(this.charImg, -w / 2, -h * .975, w, h);
    // rod from the hand, line to a float on the water; every so often a fish bites (찌릿!)
    const hand = { x: -w / 2 + w * .883, y: -h * .975 + h * .692 };
    const cyc = 11, ph = (t + (this.biteSeed || 3)) % cyc, bite = ph > cyc - 1.8 ? Math.sin((ph - (cyc - 1.8)) / 1.8 * Math.PI) : 0;
    const len = h * 1.05, ang = -.86 + bite * .26;
    const tip = { x: hand.x + Math.cos(ang) * len, y: hand.y + Math.sin(ang) * len };
    const [rc, rc2] = (CH.ROD[this.rod] || CH.ROD[(this.char && this.char.rd) || 'carbon'] || CH.ROD.carbon);
    const ctl = { x: hand.x + Math.cos(ang) * len * .55 + bite * 10, y: hand.y + Math.sin(ang) * len * .55 + bite * 4 };
    c.lineCap = 'round';
    c.strokeStyle = '#2B2433'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(hand.x, hand.y); c.quadraticCurveTo(ctl.x, ctl.y, tip.x, tip.y); c.stroke();
    c.strokeStyle = rc; c.lineWidth = 1.9; c.stroke();
    c.strokeStyle = rc2; c.lineWidth = 2.6; c.beginPath(); c.moveTo(hand.x + 1, hand.y - 2); c.lineTo(hand.x + Math.cos(ang) * 7, hand.y + Math.sin(ang) * 7 - 2); c.stroke();
    c.restore();
    const tx = feetX + tip.x, ty = feetY + tip.y;
    const fx = Math.min(W - 20, tx + Math.max(40, W * .1)), fyy = hz + Math.sin(t * 1.9) * 1.6 + bite * 7;
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = .9; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo((tx + fx) / 2, Math.max(ty, fyy) - 6 + bite * 14, fx, fyy - 6); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(fx, fyy + 6); c.lineTo(fx + Math.sin(t) * 3, fyy + 46); c.stroke();
    c.fillStyle = '#ff4d2a'; c.beginPath(); c.ellipse(fx, fyy - 3, 2.6, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f7f7f2'; c.beginPath(); c.ellipse(fx, fyy + 3, 2.6, 3.4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd84a'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fyy - 8); c.lineTo(fx, fyy - 13); c.stroke();
    if (bite > .15) {
      c.strokeStyle = `rgba(255,255,255,${.6 * bite})`; c.lineWidth = 1; for (let k = 1; k <= 2; k++) { c.beginPath(); c.ellipse(fx, hz + 1, 6 * k + bite * 6, 1.6 * k, 0, 0, Math.PI * 2); c.stroke(); }
      c.save(); c.globalAlpha = Math.min(1, bite * 1.4); c.font = `800 ${Math.round(clamp(this.H * .045, 11, 18))}px "Big Shoulders Display", "IBM Plex Sans KR", sans-serif`; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(11,34,48,.85)'; const txt = (S.li === 0 ? '찌릿!' : 'ZZIRIT!'); c.strokeText(txt, fx + 4, fyy - 20 - bite * 6); c.fillStyle = '#ffd84a'; c.fillText(txt, fx + 4, fyy - 20 - bite * 6); c.restore();
    }
  }
  boat(c, x, hz, t, kind) {
    const s = clamp(this.W / 800, .55, 1.25);
    c.save(); c.translate(x, hz); c.rotate(Math.sin(t * 1.1) * .035); c.scale(s, s);
    const gold = kind === 'gold';
    let g = c.createLinearGradient(0, -14, 0, 12);
    if (gold) { g.addColorStop(0, '#fff2b0'); g.addColorStop(.4, '#e9b949'); g.addColorStop(1, '#8a5e12'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd6d9'); }
    c.fillStyle = g; c.strokeStyle = gold ? '#6a4608' : '#55636b'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-62, -10); c.lineTo(66, -14); c.quadraticCurveTo(60, 4, 44, 12); c.lineTo(-48, 12); c.quadraticCurveTo(-60, 4, -62, -10); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = gold ? '#b3261e' : '#1f5c8c'; c.beginPath(); c.moveTo(-58, 0); c.lineTo(62, -3); c.lineTo(58, 3); c.lineTo(-55, 5); c.closePath(); c.fill();
    if (gold) { c.fillStyle = '#fff3b0'; for (let i = -40; i <= 40; i += 20) { c.beginPath(); c.arc(i, -6, 2, 0, Math.PI * 2); c.fill(); } }
    // cabin
    g = c.createLinearGradient(0, -40, 0, -12); g.addColorStop(0, gold ? '#fff6cf' : '#f6f4ee'); g.addColorStop(1, gold ? '#e2b54a' : '#d9d5cb');
    c.fillStyle = g; c.fillRect(8, -38, 34, 26); c.strokeRect(8, -38, 34, 26);
    c.fillStyle = gold ? '#b3261e' : '#c8372b'; c.fillRect(5, -42, 40, 5);
    c.fillStyle = '#2a3a48'; c.fillRect(13, -33, 10, 8); c.fillRect(27, -33, 10, 8);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(14, -32, 3, 6); c.fillRect(28, -32, 3, 6);
    c.strokeStyle = gold ? '#8a5e12' : '#3a3a3a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(30, -42); c.lineTo(30, -66); c.stroke();
    c.fillStyle = gold ? '#ffd84a' : '#ff5a1f'; c.beginPath(); c.moveTo(30, -66); c.lineTo(44, -62); c.lineTo(30, -58); c.closePath(); c.fill();
    if (gold) { const gl = c.createRadialGradient(36, -50, 1, 36, -50, 40); gl.addColorStop(0, `rgba(255,220,120,${.25 + .1 * Math.sin(t * 2)})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = gl; c.fillRect(-10, -90, 92, 90); }
    c.restore();
  }

  /* ---------- surface decor ---------- */
  buoy(c, x, hz, t) {
    const y = hz + Math.sin(t * 1.8 + 1) * 2.6, s = clamp(this.W / 800, .7, 1.2);
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, this.floorY - y); c.stroke();
    const g = c.createRadialGradient(-4, -6, 1, 0, 0, 12); g.addColorStop(0, '#ffb07a'); g.addColorStop(1, '#e8501c');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 11, Math.PI, 0); c.lineTo(11, 3); c.lineTo(-11, 3); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.fillRect(-11, -3, 22, 3);
    c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -11); c.lineTo(0, -24); c.stroke();
    c.fillStyle = `rgba(255,80,60,${.6 + .4 * Math.sin(t * 3)})`; c.beginPath(); c.arc(0, -25, 2.4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  floatMobile(c, x, hz, t) {
    const cols = ['#ff5a1f', '#ffd23f', '#3fb6d8', '#9be15d', '#ff7aa8'];
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * 16, y = hz + 1 + Math.sin(t * 2 + i) * 2;
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, y + 10); c.lineTo(fx + Math.sin(t + i) * 4, y + 60 + i * 9); c.stroke();
      const g = c.createLinearGradient(fx - 3, 0, fx + 3, 0); g.addColorStop(0, FD.shade(cols[i], -.2)); g.addColorStop(.5, cols[i]); g.addColorStop(1, FD.shade(cols[i], -.25));
      c.fillStyle = g; c.beginPath(); c.ellipse(fx, y - 4, 3.2, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#16202a'; c.beginPath(); c.ellipse(fx, y + 6, 2.4, 5.5, 0, 0, Math.PI * 2); c.fill();
    }
  }

  /* ---------- floor decor ---------- */
  rock(c, x, y, s, seed) {
    const r = FD.seeded(seed); const pts = []; for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI; pts.push([x + Math.cos(a) * s * (1 + (r() - .5) * .3), y + Math.sin(a) * s * (.75 + (r() - .5) * .25)]); }
    const g = c.createLinearGradient(x - s, y - s, x + s * .6, y); g.addColorStop(0, '#6f7c80'); g.addColorStop(1, '#2f3a3e');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - s, y); for (const [px, py] of pts) c.lineTo(px, py); c.lineTo(x + s, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.ellipse(x - s * .35, y - s * .55, s * .35, s * .12, -.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(80,140,80,.35)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - s * .6 + r() * s * 1.2, y - s * .3 - r() * s * .3, 2 + r() * 3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x + s * .2, y + 2, s * 1.1, 3, 0, 0, Math.PI * 2); c.fill();
  }
  shells(c, W, fy) {
    const sc = (x, y, s, col) => { c.save(); c.translate(x, y); c.fillStyle = col; c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(-s, -s * 1.2, 0, -s * 1.3); c.quadraticCurveTo(s, -s * 1.2, s, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = .8; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(k * s * .45, -s * 1.15); c.stroke(); } c.restore(); };
    const star = (x, y, s, col) => { c.save(); c.translate(x, y); c.rotate(.3); c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? s * .42 : s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8); } c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; c.beginPath(); c.arc(Math.cos(a) * s * .5, Math.sin(a) * s * .4, 1, 0, Math.PI * 2); c.fill(); } c.restore(); };
    sc(W * .14, fy + 10, 6, '#f2d2c0'); star(W * .45, fy + 12, 8, '#ff7a4a'); sc(W * .57, fy + 9, 5, '#e8c7f0'); star(W * .79, fy + 13, 7, '#ffb347'); sc(W * .87, fy + 11, 4.5, '#fbe3b6');
  }
  anchor(c, x, y) {
    const g = c.createLinearGradient(x - 16, 0, x + 16, 0); g.addColorStop(0, '#4a5258'); g.addColorStop(.5, '#8c969c'); g.addColorStop(1, '#3e454b');
    c.save(); c.translate(x, y); c.rotate(-.18); c.strokeStyle = g; c.lineWidth = 4.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -8); c.stroke(); c.beginPath(); c.moveTo(-12, -40); c.lineTo(12, -40); c.stroke();
    c.beginPath(); c.arc(0, -22, 17, .25, Math.PI - .25); c.stroke(); c.beginPath(); c.arc(0, -57, 5, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(80,90,95,.6)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(4 + i * 5, -60 - i * 4, 3, 2, .6, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  coral(c, x, y, k) {
    const cols = ['#ff7a8a', '#ffb05a', '#c86ad8', '#ff8a5a', '#5fd3c8'];
    const br = (px, py, len, ang, d, col, w) => { if (d > 3) return; const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke(); br(ex, ey, len * .72, ang - .5, d + 1, col, w * .78); br(ex, ey, len * .72, ang + .45, d + 1, col, w * .78); };
    c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const bx = x + (i - 2) * 30 * k; br(bx, y - 4, (16 + i * 3) * k, -Math.PI / 2 + (i - 2) * .08, 0, cols[i], 5 * k); }
    // fan coral and a brain coral
    c.fillStyle = 'rgba(200,90,180,.55)'; c.beginPath(); c.moveTo(x + 78 * k, y - 4); c.quadraticCurveTo(x + 50 * k, y - 50 * k, x + 80 * k, y - 58 * k); c.quadraticCurveTo(x + 108 * k, y - 50 * k, x + 80 * k, y - 4); c.fill();
    c.fillStyle = '#e8b06a'; c.beginPath(); c.ellipse(x - 80 * k, y - 6, 15 * k, 10 * k, 0, Math.PI, 0); c.fill(); c.strokeStyle = 'rgba(120,70,30,.5)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(x - 80 * k + i * 4 * k, y - 6, 6 * k, Math.PI, 0); c.stroke(); }
  }
  wreck(c, x, fy) {
    const s = clamp(this.W / 800, .6, 1.2); c.save(); c.translate(x, fy - 4); c.rotate(-.12); c.scale(s, s);
    c.fillStyle = 'rgba(30,40,46,.75)'; c.beginPath(); c.moveTo(-90, 0); c.lineTo(80, -6); c.quadraticCurveTo(70, -36, 40, -40); c.lineTo(-70, -34); c.quadraticCurveTo(-92, -20, -90, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,28,32,.8)'; c.fillRect(-20, -70, 4, 36); c.fillRect(-26, -64, 18, 3);
    c.fillStyle = 'rgba(120,170,170,.25)'; for (let i = -50; i <= 30; i += 22) { c.beginPath(); c.arc(i, -20, 4, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(60,120,80,.5)'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-60 + i * 30, -30); c.quadraticCurveTo(-56 + i * 30, -50, -62 + i * 30, -64); c.stroke(); }
    c.restore();
  }
  palace(c, x, fy) {
    // the Dragon Palace on the sea floor: stone base, red columns, two sweeping roofs
    const s = clamp(this.W / 800, .6, 1.25); c.save(); c.translate(x, fy - 2); c.scale(s, s);
    c.fillStyle = 'rgba(28,38,70,.9)'; c.fillRect(-110, -14, 220, 14); c.fillRect(-96, -22, 192, 8);
    c.fillStyle = 'rgba(150,40,40,.85)'; for (let i = -80; i <= 80; i += 32) c.fillRect(i - 3, -70, 6, 48);
    const roof = (y, w, h) => { c.beginPath(); c.moveTo(-w - 18, y + 6); c.quadraticCurveTo(-w * .6, y - 2, -w * .45, y - h); c.lineTo(w * .45, y - h); c.quadraticCurveTo(w * .6, y - 2, w + 18, y + 6); c.quadraticCurveTo(w * .5, y + 1, 0, y + 2); c.quadraticCurveTo(-w * .5, y + 1, -w - 18, y + 6); c.closePath(); c.fill(); };
    c.fillStyle = 'rgba(30,60,80,.95)'; roof(-70, 104, 18); c.fillStyle = 'rgba(40,74,96,.95)'; c.fillRect(-52, -110, 104, 22); roof(-110, 70, 16);
    c.fillStyle = 'rgba(255,220,130,.85)'; for (let i = -64; i <= 64; i += 32) c.fillRect(i - 7, -58, 14, 18); for (let i = -36; i <= 36; i += 24) c.fillRect(i - 5, -104, 10, 12);
    c.restore();
  }
  palaceGlow(c, x, fy, t) {
    const s = clamp(this.W / 800, .6, 1.25); const g = c.createRadialGradient(x, fy - 60 * s, 4, x, fy - 60 * s, 170 * s);
    g.addColorStop(0, `rgba(255,214,120,${.22 + .06 * Math.sin(t * 1.3)})`); g.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = g; c.fillRect(x - 180 * s, fy - 240 * s, 360 * s, 260 * s);
  }
  kelp(c, x, y, t, s, k) {
    const h = (this.floorY - this.hz) * .55 * s;
    for (let j = 0; j < 3; j++) {
      const g = c.createLinearGradient(0, y, 0, y - h); g.addColorStop(0, '#1f5a36'); g.addColorStop(1, j % 2 ? '#5fbf6a' : '#46a85a');
      c.strokeStyle = g; c.lineWidth = 3.4 - j * .6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + j * 6, y);
      const seg = 9; const pts = [];
      for (let i = 1; i <= seg; i++) { const px = x + j * 6 + Math.sin(t * 1.2 + i * .55 + k * 9 + j) * i * 1.5, py = y - i * h / seg; pts.push([px, py]); c.lineTo(px, py); }
      c.stroke();
      c.fillStyle = j % 2 ? 'rgba(95,191,106,.75)' : 'rgba(70,168,90,.75)';
      for (let i = 2; i < seg; i += 2) { const [px, py] = pts[i]; const side = i % 4 ? 1 : -1; c.beginPath(); c.ellipse(px + side * 5, py, 6, 2.2, side * .5 + Math.sin(t + i) * .2, 0, Math.PI * 2); c.fill(); }
    }
  }
  clam(c, x, y, t) {
    const o = .25 + .2 * (1 + Math.sin(t * .6)) / 2;
    c.save(); c.translate(x, y);
    const g = c.createLinearGradient(0, -24, 0, 0); g.addColorStop(0, '#9fd6e8'); g.addColorStop(1, '#4b8aa8');
    c.fillStyle = g; c.beginPath(); for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; c.lineTo(Math.cos(a) * 24, Math.sin(a) * 9 + (i % 2 ? -2 : 0)); } c.closePath(); c.fill();
    const pg = c.createRadialGradient(0, -6, 1, 0, -6, 18); pg.addColorStop(0, `rgba(255,255,255,${.7 + .3 * Math.sin(t * 2)})`); pg.addColorStop(1, 'rgba(255,240,255,0)'); c.fillStyle = pg; c.fillRect(-20, -26, 40, 30);
    c.fillStyle = '#fff7fb'; c.beginPath(); c.arc(0, -6, 4.5, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(-o); c.fillStyle = g; c.beginPath(); for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; c.lineTo(Math.cos(a) * 24, Math.sin(a) * 18 + (i % 2 ? -2 : 0)); } c.closePath(); c.fill(); c.restore();
    c.restore();
  }
  chest(c, x, y, t) {
    c.save(); c.translate(x, y);
    let g = c.createLinearGradient(0, -24, 0, 0); g.addColorStop(0, '#8e5a2c'); g.addColorStop(1, '#5c3818');
    c.fillStyle = g; c.fillRect(-20, -22, 40, 22); c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -12; i <= 12; i += 8) c.fillRect(i, -22, 1, 22);
    c.fillStyle = '#d8b24a'; c.fillRect(-20, -22, 40, 3); c.fillRect(-3, -18, 6, 8);
    c.save(); c.translate(-20, -22); c.rotate(-.55); g = c.createLinearGradient(0, -14, 0, 0); g.addColorStop(0, '#a46a34'); g.addColorStop(1, '#7a4a24'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(20, -16, 40, 0); c.closePath(); c.fill(); c.restore();
    for (let i = 0; i < 6; i++) { c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(-12 + i * 5, -22 - (i % 2) * 3, 2.6, 0, Math.PI * 2); c.fill(); }
    const gl = c.createRadialGradient(0, -24, 1, 0, -24, 34); gl.addColorStop(0, `rgba(255,220,120,${.35 + .2 * Math.sin(t * 2)})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = gl; c.fillRect(-34, -60, 68, 62);
    c.restore();
  }
  trophy(c, x, y, t) {
    const g = c.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, '#a87a1a'); g.addColorStop(.5, '#ffe08a'); g.addColorStop(1, '#a87a1a');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 14, y - 48); c.lineTo(x + 14, y - 48); c.quadraticCurveTo(x + 12, y - 26, x, y - 24); c.quadraticCurveTo(x - 12, y - 26, x - 14, y - 48); c.fill();
    c.fillRect(x - 3, y - 24, 6, 8); c.fillRect(x - 11, y - 16, 22, 6);
    const sw = ((t * .5) % 1) * 40 - 20; c.fillStyle = 'rgba(255,255,255,.5)'; c.save(); c.beginPath(); c.moveTo(x - 14, y - 48); c.lineTo(x + 14, y - 48); c.lineTo(x, y - 24); c.closePath(); c.clip(); c.fillRect(x + sw, y - 50, 4, 30); c.restore();
    const gl = c.createRadialGradient(x, y - 36, 1, x, y - 36, 42); gl.addColorStop(0, `rgba(255,230,140,${.3 + .15 * Math.sin(t * 1.5)})`); gl.addColorStop(1, 'rgba(255,230,140,0)'); c.fillStyle = gl; c.fillRect(x - 42, y - 80, 84, 84);
  }

  /* ---------- swimmers & particles ---------- */
  jelly(c, W, hz, fy, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = W * (.2 + i * .28) + Math.sin(t * .3 + i * 2) * 30, y = hz + (fy - hz) * (.25 + .15 * i) + Math.sin(t * .9 + i) * 14, p = 1 + Math.sin(t * 2.2 + i) * .08;
      const g = c.createRadialGradient(x, y - 3, 1, x, y, 20); g.addColorStop(0, 'rgba(255,210,255,.75)'); g.addColorStop(1, 'rgba(190,130,255,.08)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 15 * p, 11 / p, 0, Math.PI, 0); c.fill();
      c.strokeStyle = 'rgba(230,190,255,.45)'; c.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * 5, y); c.bezierCurveTo(x + k * 5 + Math.sin(t * 2 + k) * 6, y + 12, x + k * 3 - Math.sin(t * 2 + k) * 4, y + 22, x + k * 4, y + 34); c.stroke(); }
    }
    c.restore();
  }
  turtle(c, W, hz, fy, t) {
    const span = W + 160, x = ((t * 16) % span) - 80, y = hz + (fy - hz) * .32 + Math.sin(t * .5) * 10;
    c.save(); c.translate(x, y); const s = clamp(W / 800, .7, 1.2); c.scale(s, s);
    c.fillStyle = '#6a8a4a'; const fl = Math.sin(t * 2) * .4;
    for (const [dx, dy, k] of [[12, -10, 1], [12, 10, 1], [-13, -8, .6], [-13, 8, .6]]) { c.save(); c.translate(dx, dy); c.rotate((dy < 0 ? -1 : 1) * (.6 + fl * k)); c.beginPath(); c.ellipse(5, 0, 11 * k, 3.6 * k, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.fillStyle = '#86a660'; c.beginPath(); c.ellipse(25, 0, 6.5, 5.2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1b2410'; c.beginPath(); c.arc(28, -2, 1.1, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(-4, -5, 2, 0, 0, 20); g.addColorStop(0, '#8aa45e'); g.addColorStop(1, '#4d6332');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 19, 14, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(30,40,20,.45)'; c.lineWidth = 1; for (const [px, py] of [[0, 0], [-9, -5], [9, -5], [-9, 5], [9, 5]]) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 4); } c.closePath(); c.stroke(); }
    c.restore();
  }
  school(c, W, hz, fy, t) {
    const cx = ((t * 34) % (W + 300)) - 150, cy = hz + (fy - hz) * .45 + Math.sin(t * .7) * 16;
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = 6 + (i % 7) * 6, x = cx + Math.cos(a) * r * 1.8 + Math.sin(t * 3 + i) * 2, y = cy + Math.sin(a) * r * .7;
      c.fillStyle = `rgba(210,225,235,${.55 + .35 * Math.sin(t * 4 + i)})`; c.beginPath(); c.ellipse(x, y, 5, 1.8, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(x - 4.5, y); c.lineTo(x - 8, y - 2); c.lineTo(x - 8, y + 2); c.closePath(); c.fill(); }
  }
  bubbles(c, W, hz, fy, t) {
    c.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const speed = 18 + (i % 5) * 6, span = fy - hz, y = fy - ((t * speed + i * 53) % span), x = W * ((i * .137) % 1) + Math.sin(t * 2 + i) * 4, r = 1.4 + (i % 3);
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x - r * .35, y - r * .35, r * .3, 0, Math.PI * 2); c.fill(); }
  }
  plankton(c, W, hz, fy, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) { const x = (W * ((i * .618) % 1) + Math.sin(t * .4 + i) * 20 + W) % W, y = hz + (fy - hz) * ((i * .382) % 1) + Math.cos(t * .5 + i) * 10;
      c.fillStyle = `rgba(120,255,230,${.2 + .5 * Math.abs(Math.sin(t * 1.5 + i))})`; c.beginPath(); c.arc(x, y, 1.7, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  sparkle(c, W, hz, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) { const x = (W * ((i * .277) % 1) + Math.sin(t * .5 + i) * 14) % W, y = hz * (.15 + ((i * .41) % .8)) + Math.sin(t + i) * 6, a = Math.max(0, Math.sin(t * 2.6 + i * 1.7));
      c.fillStyle = `rgba(255,220,120,${a})`; c.beginPath(); const s = 1.5 + a * 2.5; c.moveTo(x, y - s * 2); c.lineTo(x + s * .5, y - s * .5); c.lineTo(x + s * 2, y); c.lineTo(x + s * .5, y + s * .5); c.lineTo(x, y + s * 2); c.lineTo(x - s * .5, y + s * .5); c.lineTo(x - s * 2, y); c.lineTo(x - s * .5, y - s * .5); c.closePath(); c.fill(); }
    c.restore();
  }
  petals(c, W, hz, t) {
    c.fillStyle = 'rgba(255,190,210,.9)';
    for (let i = 0; i < 20; i++) { const x = (W * ((i * .23) % 1) + t * 20 + Math.sin(t + i) * 20) % W, y = ((t * 26 + i * 41) % (hz + 30)) - 10; c.save(); c.translate(x, y); c.rotate(t + i); c.beginPath(); c.ellipse(0, 0, 3.6, 2, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  }
  snowfall(c, W, hz, t) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 30; i++) { const x = (W * ((i * .31) % 1) + Math.sin(t * .6 + i) * 10) % W, y = (t * 14 + i * 29) % hz; c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
  }
  lanterns(c, W, hz, fy, t) {
    for (let i = 0; i < 7; i++) { const span = this.H + 40, y = this.H - ((t * (10 + i * 2) + i * 70) % span), x = W * (.12 + i * .13) + Math.sin(t * .6 + i) * 10;
      const under = y > hz; const a = under ? .55 : .9;
      const g = c.createRadialGradient(x, y, 1, x, y, 16); g.addColorStop(0, `rgba(255,200,110,${a})`); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - 16, y - 16, 32, 32);
      c.fillStyle = `rgba(230,70,50,${a})`; c.beginPath(); c.ellipse(x, y, 4.5, 6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = `rgba(255,220,140,${a})`; c.fillRect(x - 3, y - 7, 6, 1.6); }
  }
}
