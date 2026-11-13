/* ===== Fish, drawn from species parameters like a field-guide plate (no photos) =====
   Each species has a body plan (SH), five colours (back, flank, belly, fins, markings) and a marking pattern. The drawing
   adds what makes a fish look like a fish and not a toy: a dark back fading to a pale belly, rows of scales, fins with
   spines and soft rays and a clear membrane, a small wet eye, the gill cover, the jaw, the lateral line, a band of light.
   A fish is painted once, still, into an off-screen picture; a swimming fish is that picture bent slice by slice. */
const FD = (() => {
  // d depth, um where the body is deepest (0 tail … 1 snout), arch how far the back rises, ped tail stalk, tf tail length,
  // sc scale size (0: smooth skin), pv where the belly fins sit
  const SH = {
    porgy:    {d:.46, um:.58, arch:.20, ped:.105, tf:.24, tail:'fork', snoutH:.10, dors:'spiny', eye:.058, eyeU:.855, mouth:'small', head:.27, sc:.026, pv:.60, steep:1},
    perch:    {d:.31, um:.60, arch:.10, ped:.105, tf:.21, tail:'trunc', snoutH:.09, dors:'spiny', eye:.052, eyeU:.865, mouth:'big', head:.29, sc:.021, pv:.60},
    bass:     {d:.32, um:.58, arch:.08, ped:.11, tf:.21, tail:'trunc', snoutH:.11, dors:'spiny', eye:.046, eyeU:.865, mouth:'huge', head:.31, sc:.021, pv:.60},
    torpedo:  {d:.225, um:.56, arch:.03, ped:.045, tf:.25, tail:'deepfork', snoutH:.06, dors:'two', eye:.05, eyeU:.885, mouth:'small', head:.24, finlets:1, sc:.009, pv:.60},
    tuna:     {d:.29, um:.55, arch:.05, ped:.04, tf:.25, tail:'lunate', snoutH:.07, dors:'two', eye:.04, eyeU:.885, mouth:'small', head:.25, finlets:1, sc:0, pv:.60, sickle:1},
    jack:     {d:.37, um:.58, arch:.14, ped:.05, tf:.26, tail:'deepfork', snoutH:.13, dors:'two', eye:.052, eyeU:.87, mouth:'big', head:.26, blunt:1, sc:.012, pv:.60, sickle:1},
    dorado:   {d:.28, um:.74, arch:.05, ped:.05, tf:.25, tail:'deepfork', snoutH:.30, dors:'long', eye:.042, eyeU:.90, mouth:'small', head:.18, blunt:1, sc:.008, pv:.66},
    cod:      {d:.25, um:.63, arch:.05, ped:.085, tf:.19, tail:'trunc', snoutH:.09, dors:'three', eye:.046, eyeU:.875, mouth:'big', head:.28, barbel:1, sc:.01, pv:.70},
    carp:     {d:.34, um:.57, arch:.14, ped:.12, tf:.23, tail:'fork', snoutH:.10, dors:'single', eye:.04, eyeU:.885, mouth:'small', head:.24, sc:.036, pv:.44},
    trout:    {d:.235, um:.57, arch:.05, ped:.095, tf:.21, tail:'trunc', snoutH:.09, dors:'single', eye:.042, eyeU:.885, mouth:'big', head:.23, adipose:1, sc:.011, pv:.42},
    mullet:   {d:.215, um:.54, arch:.03, ped:.09, tf:.23, tail:'fork', snoutH:.10, dors:'two', eye:.044, eyeU:.895, mouth:'small', head:.22, sc:.026, pv:.50},
    needle:   {d:.085, um:.50, arch:0, ped:.05, tf:.17, tail:'fork', snoutH:.05, dors:'rear', eye:.04, eyeU:.88, mouth:'small', head:.15, beak:1, sc:0, pv:.30},
    goby:     {d:.19, um:.72, arch:.05, ped:.105, tf:.19, tail:'round', snoutH:.16, dors:'two', eye:.05, eyeU:.875, mouth:'big', head:.29, blunt:1, sc:.014, pv:.66},
    catfish:  {d:.20, um:.72, arch:0, ped:.10, tf:.17, tail:'round', snoutH:.20, dors:'small', eye:.022, eyeU:.92, mouth:'wide', head:.26, barbels:1, blunt:1, sc:0, pv:.48},
    snakehead:{d:.17, um:.62, arch:0, ped:.125, tf:.16, tail:'round', snoutH:.13, dors:'longfull', eye:.03, eyeU:.925, mouth:'big', head:.22, sc:.017, pv:.60},
    pike:     {d:.155, um:.47, arch:0, ped:.08, tf:.19, tail:'fork', snoutH:.06, dors:'rear', eye:.036, eyeU:.82, mouth:'duck', head:.29, sc:.012, pv:.42},
    flathead: {d:.14, um:.72, arch:0, ped:.065, tf:.18, tail:'round', snoutH:.10, dors:'two', eye:.034, eyeU:.87, mouth:'wide', head:.33, sc:.01, pv:.62},
    scorpion: {d:.36, um:.72, arch:.10, ped:.12, tf:.20, tail:'round', snoutH:.18, dors:'bigspiny', eye:.058, eyeU:.845, mouth:'big', head:.39, warts:1, blunt:1, sc:.018, pv:.62},
    marlin:   {d:.21, um:.58, arch:.05, ped:.035, tf:.23, tail:'lunate', snoutH:.06, dors:'highfront', eye:.032, eyeU:.86, mouth:'small', head:.20, bill:1, sc:0, pv:.62, sickle:1},
    sail:     {d:.20, um:.58, arch:.05, ped:.035, tf:.23, tail:'lunate', snoutH:.06, dors:'sail', eye:.032, eyeU:.86, mouth:'small', head:.20, bill:1, sc:0, pv:.62, sickle:1}
  };
  const TAU = Math.PI * 2;

  function hex2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2(c) { if (c[0] === '#') return hex2rgb(c); const m = c.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; }
  function rgba(h, a) { const [r, g, b] = rgb2(h); return `rgba(${r},${g},${b},${a})`; }
  function mix(h1, h2, t) { const a = rgb2(h1), b = rgb2(h2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }
  function shade(h, amt) { return amt >= 0 ? mix(h, '#ffffff', amt) : mix(h, '#000000', -amt); }
  function seeded(seed) { let s = (seed >>> 0) || 7; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const lw = (L, k, min = .5) => Math.max(min, L * k);

  /* Body outline (the fish faces +x, centre at 0,0, length L): the back and the belly from the tail stalk to the snout */
  function geom(L, p) {
    const xs = L / 2, xT = -L / 2, xp = xT + p.tf * L;
    const D = p.d * L, P = p.ped * L, sH = Math.max(p.snoutH * D, L * 0.01);
    const y0 = D * 0.05, N = 48, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = xp + (xs - xp) * u;
      let h;
      if (u < p.um) h = P / 2 + (D / 2 - P / 2) * Math.pow(Math.sin(Math.PI / 2 * u / p.um), 1.12);
      else { const v = (u - p.um) / (1 - p.um); h = sH + (D / 2 - sH) * Math.pow(Math.cos(Math.PI / 2 * v), p.blunt ? 0.55 : 0.9); }
      const t = u > .85 ? (u - .85) / .15 : 0, cy = y0 * t;
      // a steep forehead (sea breams): the back stays high until just behind the eye
      const st = p.steep && u > p.um ? 1 + .1 * Math.sin(Math.PI * Math.min(1, (u - p.um) / (1 - p.um) * 1.15)) : 1;
      top.push([x, cy - h * (1 + p.arch) * st]);
      bot.push([x, cy + h * (1 - p.arch * 0.55)]);
    }
    return { xs, xT, xp, D, P, top, bot, y0, N };
  }
  function bodyPath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(g.top[0][0], g.top[0][1]);
    for (let i = 1; i < g.top.length; i++) { const a = g.top[i - 1], b = g.top[i]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    const tip = g.top[g.top.length - 1], btip = g.bot[g.bot.length - 1];
    ctx.quadraticCurveTo(tip[0] + (g.xs - tip[0]) * .2, (tip[1] + btip[1]) / 2, btip[0], btip[1]);
    for (let i = g.bot.length - 2; i >= 0; i--) { const a = g.bot[i + 1], b = g.bot[i]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.lineTo(g.bot[0][0], g.bot[0][1]);
    ctx.closePath();
  }
  const at = (arr, u) => { u = Math.max(0, Math.min(1, u)); const f = u * (arr.length - 1), i = Math.max(0, Math.min(arr.length - 2, Math.floor(f))), t = f - i; return [arr[i][0] + (arr[i + 1][0] - arr[i][0]) * t, arr[i][1] + (arr[i + 1][1] - arr[i][1]) * t]; };
  const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(.01, r), 0, TAU); };
  // a soft-edged blot of colour
  function blot(ctx, x, y, rx, ry, rot, col, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.max(.01, rx), Math.max(.01, ry));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, rgba(col, a)); g.addColorStop(.55, rgba(col, a * .8)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
  }

  /* --- the eye: small, dark, wet --- */
  function eye(ctx, x, y, r, iris, L) {
    const ir = iris || '#b9a468';
    ctx.fillStyle = 'rgba(0,0,0,.3)'; circle(ctx, x, y, r * 1.16); ctx.fill();
    const g = ctx.createRadialGradient(x - r * .25, y - r * .3, r * .1, x, y, r);
    g.addColorStop(0, shade(ir, .45)); g.addColorStop(.55, ir); g.addColorStop(1, shade(ir, -.55));
    ctx.fillStyle = g; circle(ctx, x, y, r); ctx.fill();
    ctx.fillStyle = '#06080b'; ctx.beginPath(); ctx.ellipse(x + r * .05, y + r * .02, r * .56, r * .6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(shade(ir, .5), .55); ctx.lineWidth = Math.max(.3, r * .07); ctx.beginPath(); ctx.ellipse(x + r * .05, y + r * .02, r * .6, r * .64, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = Math.max(.4, r * .2); ctx.beginPath(); ctx.arc(x, y, r * .98, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.92)'; circle(ctx, x - r * .2, y - r * .26, r * .17); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(ctx, x + r * .3, y + r * .3, r * .09); ctx.fill();
  }

  /* --- a fin: a membrane over rays. base runs from the fin's front to its back along the body's edge;
         dir -1 stands up, +1 hangs down; hf(t) is its height; lean is how far the rays trail toward the tail --- */
  function fin(ctx, L, base, dir, hf, col, bodyCol, o = {}) {
    const n = base.length, out = [], lean = o.lean == null ? .38 : o.lean; let hmax = 0;
    for (let i = 0; i < n; i++) { const t = i / (n - 1), h = hf(t); hmax = Math.max(hmax, h); out.push([base[i][0] - h * lean * (o.fan ? (.4 + t * 1.2) : 1), base[i][1] + dir * h]); }
    if (hmax < .5) return;
    ctx.beginPath(); ctx.moveTo(base[0][0], base[0][1]); ctx.lineTo(out[0][0], out[0][1]);
    for (let i = 1; i < n; i++) {
      const a = out[i - 1], b = out[i];
      if (o.spines && i <= o.spines) { const h = Math.min(hf((i - 1) / (n - 1)), hf(i / (n - 1))); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - dir * h * .2, b[0], b[1]); }
      else ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.lineTo(out[n - 1][0], out[n - 1][1]); ctx.lineTo(base[n - 1][0], base[n - 1][1]);
    for (let i = n - 2; i >= 0; i--) ctx.lineTo(base[i][0], base[i][1]);
    ctx.closePath();
    const y0 = base[Math.floor(n / 2)][1], gr = ctx.createLinearGradient(0, y0, 0, y0 + dir * hmax);
    gr.addColorStop(0, rgba(mix(col, bodyCol, .45), .97)); gr.addColorStop(.5, rgba(col, .9)); gr.addColorStop(1, rgba(shade(col, o.dark ? -.25 : .12), o.clear == null ? .66 : o.clear));
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    if (o.spot) { ctx.fillStyle = rgba(o.spot, .5); const r = seeded(n * 97 + 3); for (let i = 0; i < 26; i++) { const k = Math.floor(r() * (n - 1)), f = .25 + r() * .6; circle(ctx, base[k][0] + (out[k][0] - base[k][0]) * f, base[k][1] + (out[k][1] - base[k][1]) * f, lw(L, .006, .6)); ctx.fill(); } }
    // rays: stiff pale spines in front, fine soft rays behind (each splitting near its tip)
    for (let i = 0; i < n; i++) {
      const a = base[i], b = out[i], spine = o.spines && i < o.spines;
      if (spine) { ctx.strokeStyle = rgba(shade(col, -.5), .6); ctx.lineWidth = lw(L, .0058, .7); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = rgba(shade(col, .55), .6); ctx.lineWidth = lw(L, .0022, .35); ctx.stroke(); }
      else {
        ctx.strokeStyle = rgba(shade(col, -.55), .4); ctx.lineWidth = lw(L, .0018, .35);
        const sub = i < n - 1 ? 2 : 1;
        for (let k = 0; k < sub; k++) { const f = k / sub, a2 = i < n - 1 ? [a[0] + (base[i + 1][0] - a[0]) * f, a[1] + (base[i + 1][1] - a[1]) * f] : a, b2 = i < n - 1 ? [b[0] + (out[i + 1][0] - b[0]) * f, b[1] + (out[i + 1][1] - b[1]) * f] : b; ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); }
      }
    }
    ctx.restore();
    // the free edge
    ctx.strokeStyle = rgba(shade(col, -.45), .5); ctx.lineWidth = lw(L, .0028, .45); ctx.beginPath(); ctx.moveTo(base[0][0], base[0][1]); ctx.lineTo(out[0][0], out[0][1]);
    for (let i = 1; i < n; i++) { const a = out[i - 1], b = out[i]; if (o.spines && i <= o.spines) { const h = Math.min(hf((i - 1) / (n - 1)), hf(i / (n - 1))); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - dir * h * .2, b[0], b[1]); } else ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.lineTo(out[n - 1][0], out[n - 1][1]); ctx.lineTo(base[n - 1][0], base[n - 1][1]); ctx.stroke();
  }
  const edge = (arr, u0, u1, n) => { const b = []; for (let i = 0; i <= n; i++) b.push(at(arr, u0 + (u1 - u0) * i / n)); return b; };

  /* --- the tail: v runs from -1 (upper tip) to 1 (lower tip) along its trailing edge --- */
  function tail(ctx, L, g, p, col, bodyCol) {
    const bx = g.xp + L * .004, by = (g.top[0][1] + g.bot[0][1]) / 2, span = g.xp - g.xT, P = g.P;
    const H = p.tail === 'round' ? Math.max(g.D * .78, P * 1.7) : Math.max(g.D * 0.95, P * 2.9) * (p.tail === 'lunate' ? 1.12 : 1);
    const E = v => {
      const a = Math.abs(v);
      if (p.tail === 'fork') return [-span * (1 - .42 * Math.pow(1 - a, 1.25)), v * H / 2];
      if (p.tail === 'deepfork') return [-span * (1 - .62 * Math.pow(1 - a, 1.1)), v * H / 2];
      if (p.tail === 'lunate') return [-span * (1.02 - .58 * Math.pow(1 - a * a, .75)), v * H * .56];
      if (p.tail === 'trunc') return [-span * (1 - .07 * (1 - a * a)), v * H * .46];
      return [-span * (.5 + .6 * Math.cos(v * Math.PI / 2)), Math.sin(v * Math.PI / 2) * H / 2];
    };
    const lead = p.tail === 'lunate' ? [.5, .16] : p.tail === 'round' ? [.3, .46] : p.tail === 'trunc' ? [.5, .34] : [.45, .24];
    ctx.save(); ctx.translate(bx, by);
    const path = () => {
      ctx.beginPath(); ctx.moveTo(0, -P / 2); const t0 = E(-1); ctx.quadraticCurveTo(-span * lead[0], -H * lead[1], t0[0], t0[1]);
      for (let i = 1; i <= 24; i++) { const q = E(-1 + i / 12); ctx.lineTo(q[0], q[1]); }
      ctx.quadraticCurveTo(-span * lead[0], H * lead[1], 0, P / 2); ctx.closePath();
    };
    path();
    const gr = ctx.createLinearGradient(0, 0, -span, 0); gr.addColorStop(0, rgba(mix(col, bodyCol, .7), .98)); gr.addColorStop(.28, rgba(mix(col, bodyCol, .25), .95)); gr.addColorStop(.75, rgba(col, .88)); gr.addColorStop(1, rgba(shade(col, -.12), .72));
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    for (let k = -9; k <= 9; k++) {
      const v = k / 9, q = E(v), s0 = [-span * .04, v * P * .42];
      ctx.strokeStyle = rgba(shade(col, -.5), .3); ctx.lineWidth = lw(L, .002, .35); ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.quadraticCurveTo(-span * lead[0] * .9, v * H * (lead[1] + .12) * .9, q[0], q[1]); ctx.stroke();
      if (k < 9) { const q2 = E(v + 1 / 18); ctx.strokeStyle = rgba(shade(col, .4), .16); ctx.beginPath(); ctx.moveTo(-span * .3, (v + 1 / 18) * H * .22); ctx.lineTo(q2[0], q2[1]); ctx.stroke(); }
    }
    ctx.restore();
    path(); ctx.strokeStyle = rgba(shade(col, -.5), .45); ctx.lineWidth = lw(L, .0028, .45); ctx.stroke();
    ctx.restore();
  }

  /* --- markings --- */
  function pattern(ctx, sp, g, L, rnd) {
    const c = sp.c, pc = c[4] || '#000', D = g.D, xs = g.xs, xp = g.xp, span = xs - xp;
    const mid = u => { const a = at(g.top, u), b = at(g.bot, u); return [a[0], a[1], b[1]]; };
    ctx.save();
    switch (sp.pat) {
      case 'vband': case 'zebra': {
        const n = sp.pat === 'zebra' ? 9 : sp.sh === 'porgy' ? 7 : 6, a = sp.sh === 'sail' || sp.sh === 'marlin' || sp.id === 'wahoo' ? .3 : .6;
        for (let i = 0; i < n; i++) {
          const u = .08 + i * (.8 / (n - 1)), [x, yt, yb] = mid(u), w = span * (sp.pat === 'zebra' ? .03 : .042), gr = ctx.createLinearGradient(x - w * 1.6, 0, x + w * 1.6, 0);
          gr.addColorStop(0, rgba(pc, 0)); gr.addColorStop(.35, rgba(pc, a)); gr.addColorStop(.65, rgba(pc, a)); gr.addColorStop(1, rgba(pc, 0));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - w * 1.6, yt); ctx.lineTo(x + w * 1.6, yt); ctx.lineTo(x + w * .9 - D * .05, yt + (yb - yt) * .82); ctx.lineTo(x - w * .9 - D * .05, yt + (yb - yt) * .82); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'hline': {
        const n = sp.id === 'isaki' ? 3 : 6; ctx.strokeStyle = rgba(pc, .5); ctx.lineWidth = lw(D, .04, .8); ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const f = .16 + i * (.56 / Math.max(1, n - 1)); ctx.beginPath();
          for (let k = 0; k <= 16; k++) { const u = .03 + k * .052, [x, yt, yb] = mid(u), y = yt + (yb - yt) * f; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
        break;
      }
      case 'spot': case 'dots': case 'rspot': case 'bspot': case 'pikespot': {
        const n = { spot: 26, dots: 46, rspot: 44, bspot: 30, pikespot: 60 }[sp.pat], lo = sp.pat === 'bspot' ? .55 : sp.pat === 'dots' ? .62 : .8;
        for (let i = 0; i < n; i++) {
          const u = .05 + rnd() * .84, [x, yt, yb] = mid(u), y = yt + (yb - yt) * (.07 + rnd() * lo), r = L * (sp.pat === 'spot' ? .0085 : sp.pat === 'pikespot' ? .009 : .0055) * (.7 + rnd() * .7);
          if (sp.pat === 'pikespot') blot(ctx, x, y, r * 1.7, r, 0, pc, .8);
          else if (sp.pat === 'bspot') { ctx.fillStyle = rgba(pc, .9); circle(ctx, x, y, r); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(ctx, x - r * .25, y - r * .25, r * .35); ctx.fill(); }
          else { ctx.fillStyle = rgba(pc, sp.pat === 'dots' ? .5 : .68); circle(ctx, x, y, r); ctx.fill(); }
        }
        break;
      }
      case 'mott': case 'blotch': case 'leopard': {
        const n = sp.pat === 'blotch' ? 6 : sp.pat === 'leopard' ? 30 : 26;
        for (let i = 0; i < n; i++) {
          const u = sp.pat === 'blotch' ? .1 + i * .14 : .04 + rnd() * .86, [x, yt, yb] = mid(u);
          const y = sp.pat === 'blotch' ? yt + (yb - yt) * (.36 + rnd() * .12) : yt + (yb - yt) * rnd() * .78, r = L * (sp.pat === 'blotch' ? .045 : sp.pat === 'leopard' ? .019 : .03) * (.6 + rnd() * .8);
          if (sp.pat === 'leopard') { ctx.fillStyle = rgba(pc, .72); ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r, rnd() * 3, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(c[1], .85); ctx.beginPath(); ctx.ellipse(x, y, r * .5, r * .38, 0, 0, TAU); ctx.fill(); }
          else { blot(ctx, x, y, r * (1.2 + rnd() * .8), r * (.7 + rnd() * .5), rnd() * 3, pc, sp.pat === 'blotch' ? .6 : .5); if (rnd() > .5) blot(ctx, x + r * (rnd() - .5) * 2, y + r * (rnd() - .5), r * .7, r * .5, rnd() * 3, pc, .4); }
        }
        break;
      }
      case 'wavy': {
        ctx.strokeStyle = rgba(pc, .7); ctx.lineWidth = lw(L, .006, .8); ctx.lineCap = 'round';
        for (let i = 0; i < 22; i++) { const u = .1 + i * .037, [x, yt] = mid(u), o = (i % 2) * D * .03; ctx.beginPath(); ctx.moveTo(x, yt + D * .03 + o); ctx.bezierCurveTo(x + span * .022, yt + D * .1, x - span * .022, yt + D * .17, x + span * .008, yt + D * (.25 + (i % 3) * .03)); ctx.stroke(); }
        break;
      }
      case 'parr': case 'rainbow': {
        if (sp.pat === 'rainbow') {
          for (let k = 0; k <= 30; k++) { const u = .03 + k * .03, [x, yt, yb] = mid(u), y = yt + (yb - yt) * .5; blot(ctx, x, y, span * .05, (yb - yt) * .15, 0, pc, .34); }
          ctx.fillStyle = 'rgba(28,30,26,.6)';
          for (let i = 0; i < 90; i++) { const u = rnd() * .92, [x, yt, yb] = mid(u); circle(ctx, x, yt + (yb - yt) * rnd() * .56, L * .0038 * (.6 + rnd() * .8)); ctx.fill(); }
        } else for (let i = 0; i < 9; i++) { const u = .1 + i * .095, [x, yt, yb] = mid(u); blot(ctx, x, (yt + yb) / 2, span * .03, (yb - yt) * .26, 0, pc, .55); }
        break;
      }
      case 'ystripe': case 'yline': case 'bline': {
        const fs = sp.pat === 'yline' ? [.36, .58] : [sp.pat === 'bline' ? .47 : .44], col = sp.pat === 'bline' ? pc : c[3], w = sp.pat === 'bline' ? .05 : .085;
        for (const f of fs) for (const [ww, a] of [[w * 1.7, .25], [w, .8]]) {
          ctx.strokeStyle = rgba(col, a); ctx.lineWidth = lw(D, ww, 1); ctx.lineCap = 'round'; ctx.beginPath();
          for (let k = 0; k <= 16; k++) { const u = .01 + k * .054, [x, yt, yb] = mid(u), y = yt + (yb - yt) * f; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
        break;
      }
      case 'tailspot': { const [x, yt, yb] = mid(.04); blot(ctx, x + span * .01, yt + (yb - yt) * .42, D * .12, D * .12, 0, pc, 1); ctx.fillStyle = rgba(pc, .9); circle(ctx, x + span * .01, yt + (yb - yt) * .42, D * .075); ctx.fill(); break; }
      case 'scute': {
        // the row of keeled scutes along a jack mackerel's side
        ctx.strokeStyle = rgba(pc, .55); ctx.lineWidth = lw(D, .035, .6);
        ctx.lineWidth = lw(D, .022, .5); for (let k = 0; k < 30; k++) { const u = .02 + k * .0125, [x, yt, yb] = mid(u), y = yt + (yb - yt) * .5, hgt = D * .03 * Math.sin(Math.PI * Math.min(1, k / 26 + .1)); ctx.beginPath(); ctx.moveTo(x, y - hgt); ctx.lineTo(x + span * .009, y); ctx.lineTo(x, y + hgt); ctx.stroke(); }
        break;
      }
      case 'redspot': {
        for (let i = 0; i < 40; i++) {
          const u = .08 + rnd() * .82, [x, yt, yb] = mid(u), y = yt + (yb - yt) * (.1 + rnd() * .62), red = rnd() > .6, r = L * .0058;
          if (red) { ctx.fillStyle = 'rgba(200,220,235,.6)'; circle(ctx, x, y, r * 1.7); ctx.fill(); }
          ctx.fillStyle = red ? rgba(pc, .95) : 'rgba(30,25,20,.7)'; circle(ctx, x, y, r); ctx.fill();
        }
        break;
      }
      case 'peacock': {
        for (let i = 0; i < 3; i++) { const u = .25 + i * .2, [x, yt, yb] = mid(u); blot(ctx, x, yt + (yb - yt) * .4, span * .04, (yb - yt) * .5, 0, '#1e2412', .7); }
        const gr = ctx.createLinearGradient(0, D * .05, 0, D * .5); gr.addColorStop(0, rgba(pc, 0)); gr.addColorStop(1, rgba(pc, .65)); ctx.fillStyle = gr; ctx.fillRect(xp - L * .1, D * .05, span + L * .2, D * .6);
        break;
      }
      case 'redrear': { const gr = ctx.createLinearGradient(xp, 0, xp + span * .55, 0); gr.addColorStop(0, rgba(pc, .8)); gr.addColorStop(1, rgba(pc, 0)); ctx.fillStyle = gr; ctx.fillRect(xp - L * .1, -D, span * .6 + L * .1, D * 2); break; }
      case 'yspot': { const [x, yt, yb] = mid(.72); blot(ctx, x, yt + (yb - yt) * .42, D * .16, D * .11, 0, pc, .95); break; }
      case 'puffer': { for (let i = 0; i < 16; i++) { const u = .1 + rnd() * .75, [x, yt] = mid(u); blot(ctx, x, yt + D * (.08 + rnd() * .25), L * .022, L * .018, 0, pc, .6); } break; }
    }
    ctx.restore();
  }

  /* --- an ordinary fish --- */
  function generic(ctx, sp, L, p) {
    const c = sp.c, g = geom(L, p), D = g.D, span = g.xs - g.xp, rnd = seeded(hashStr(sp.id));
    const fc = c[3], back = shade(c[0], -.2), ink = shade(c[0], -.62);
    const yT = Math.min(...g.top.map(q => q[1])), yB = Math.max(...g.bot.map(q => q[1]));
    const ug = 1 - p.head * L / span, gt = at(g.top, ug), gb = at(g.bot, ug); // the gill opening
    // the rear edge of the gill cover: from behind the eye, bulging toward the tail, down and forward to the throat
    const gh = gb[1] - gt[1], gA = [gt[0] + L * .022, gt[1] + gh * .2], gM = [gt[0] - L * .03, gt[1] + gh * .54], gZ = [gb[0] + L * .075, gt[1] + gh * .96], gC = [2 * gM[0] - (gA[0] + gZ[0]) / 2, 2 * gM[1] - (gA[1] + gZ[1]) / 2];
    const gill = () => { ctx.beginPath(); ctx.moveTo(gA[0], gA[1]); ctx.quadraticCurveTo(gC[0], gC[1], gZ[0], gZ[1]); };
    const H = u => { const a = at(g.top, u), b = at(g.bot, u); return [a[0], a[1], b[1]]; };

    /* fins that sit behind the body */
    const up = (u0, u1, n, hf, o) => fin(ctx, L, edge(g.top, u0, u1, n), -1, hf, fc, c[0], o);
    const dn = (u0, u1, n, hf, o) => fin(ctx, L, edge(g.bot, u0, u1, n), 1, hf, fc, c[2], o);
    const bump = (k = 1.15) => t => Math.sin(Math.PI * Math.min(1, t * k));
    switch (p.dors) {
      case 'spiny': {
        const hs = D * (sp.sh === 'porgy' ? .19 : .23);
        up(.69, .40, 10, t => hs * Math.min(1, .35 + t * 3.2) * (1 - t * .28), { spines: 10, lean: .3 });
        up(.41, .15, 10, t => hs * (.8 + .3 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * (1 - t * t * t * .7), { lean: .42 });
        break;
      }
      case 'bigspiny': up(.84, .40, 12, t => D * .42 * Math.min(1, .3 + t * 4) * (1 - t * .4), { spines: 12, lean: .28 }); up(.41, .14, 9, t => D * .3 * bump(1.2)(t), { lean: .4 }); break;
      case 'two': {
        if (p.sickle) { up(.70, .52, 7, t => D * .3 * Math.pow(1 - t, 1.5) * Math.min(1, .5 + t * 6), { spines: 7, lean: .5 }); up(.47, .28, 9, t => D * (sp.sh === 'jack' ? .26 : .36) * (Math.pow(1 - t, 2.4) * Math.min(1, t * 9 + .2) + .1 * (1 - t)), { lean: .9, dark: 1 }); }
        else { up(.70, .52, 7, t => D * .32 * Math.sin(Math.PI * Math.min(1, t * 1.6 + .12)) * (1 - t * .45), { spines: 7, lean: .4 }); up(.44, .24, 9, t => D * .24 * (1 - t * .6) * Math.min(1, t * 6 + .3), { lean: .55 }); }
        break;
      }
      case 'three': up(.76, .60, 8, t => D * .26 * bump(1.25)(t)); up(.57, .38, 9, t => D * .27 * bump(1.2)(t)); up(.35, .14, 9, t => D * .23 * bump(1.2)(t)); break;
      case 'single': if (sp.sh === 'carp') up(.66, .26, 16, t => D * .3 * (t < .12 ? .5 + t * 4.2 : 1 - (t - .12) * .72), { spines: 1, lean: .4 }); else up(.60, .42, 10, t => D * .3 * Math.min(1, .45 + t * 4) * (1 - t * .5), { lean: .45, spot: sp.pat === 'rainbow' || sp.pat === 'redspot' ? '#22201c' : null }); break;
      case 'rear': up(.27, .09, 10, t => D * (sp.sh === 'needle' ? .7 : .52) * Math.min(1, .4 + t * 4) * (1 - t * .6), { lean: .5 }); break;
      case 'small': up(.63, .54, 6, t => D * .3 * Math.min(1, .4 + t * 4) * (1 - t * .6), { spines: 1, lean: .5 }); break;
      case 'long': up(.93, .10, 26, t => D * .34 * (.55 + .45 * Math.sin(Math.PI * Math.min(1, t * 2.2))) * (1 - t * .55), { lean: .35 }); break;
      case 'longfull': up(.80, .07, 26, t => D * .22 * Math.min(1, .3 + t * 6) * (t > .92 ? 1 - (t - .92) * 6 : 1), { lean: .45 }); break;
      case 'highfront': up(.82, .22, 22, t => D * (.95 * Math.pow(1 - Math.min(1, t * 3.4), 1.6) * Math.min(1, t * 30 + .3) + .1), { lean: .7, dark: 1 }); up(.17, .11, 4, t => D * .16 * bump()(t), { lean: .8, dark: 1 }); break;
      case 'sail': up(.86, .22, 30, t => D * 1.25 * Math.sin(Math.PI * Math.min(1, .12 + t * .95)) * (.72 + t * .28), { lean: .12, dark: 1, spot: '#0b1830', clear: .85 }); up(.17, .11, 4, t => D * .16 * bump()(t), { lean: .8, dark: 1 }); break;
    }
    if (p.adipose) { const [x, y] = at(g.top, .13); ctx.fillStyle = rgba(mix(fc, c[0], .5), .95); ctx.beginPath(); ctx.moveTo(x + L * .012, y + D * .01); ctx.quadraticCurveTo(x - L * .004, y - D * .13, x - L * .028, y - D * .1); ctx.quadraticCurveTo(x - L * .016, y - D * .02, x - L * .012, y + D * .01); ctx.fill(); }
    // anal fin
    if (p.dors === 'longfull') dn(.50, .07, 18, t => D * .2 * Math.min(1, .3 + t * 6) * (t > .9 ? 1 - (t - .9) * 5 : 1), { lean: .45 });
    else if (p.dors === 'long') dn(.46, .09, 14, t => D * .2 * (1 - t * .5), { lean: .4 });
    else if (p.sickle) dn(.43, .26, 9, t => D * (sp.sh === 'jack' ? .24 : .32) * (Math.pow(1 - t, 2.4) * Math.min(1, t * 9 + .2) + .1 * (1 - t)), { lean: .9, dark: 1 });
    else if (sp.sh === 'cod') { dn(.52, .36, 8, t => D * .2 * bump(1.2)(t)); dn(.33, .14, 8, t => D * .19 * bump(1.2)(t)); }
    else if (sp.sh === 'catfish') dn(.52, .06, 20, t => D * .22 * Math.min(1, .4 + t * 5), { lean: .4 });
    else dn(p.dors === 'rear' ? .27 : .36, p.dors === 'rear' ? .10 : .15, 9, t => D * (p.dors === 'rear' ? .44 : .27) * Math.min(1, .4 + t * 3.5) * (1 - t * .5), { spines: p.dors === 'spiny' || p.dors === 'bigspiny' ? 3 : 0, lean: .5 });
    // pelvic fin (the far one, a little darker, then the near one)
    const pv = p.pv || .58, pl = D * (sp.sh === 'scorpion' ? .34 : p.sickle ? .2 : .27);
    dn(pv + .04, pv - .05, 6, t => pl * (1 - t * .78) * Math.min(1, t * 6 + .55), { lean: .8, spines: p.dors === 'spiny' || p.dors === 'bigspiny' ? 1 : 0 });
    if (p.finlets && (sp.sh === 'tuna' || ['saba', 'sawara', 'wahoo'].includes(sp.id))) {
      const yel = sp.pat === 'finlet';
      for (let i = 0; i < 7; i++) { const u = .03 + i * .034; for (const [arr, s] of [[g.top, -1], [g.bot, 1]]) { const [x, y] = at(arr, u); ctx.fillStyle = yel ? rgba(c[4], .95) : rgba(mix(fc, c[0], .4), .95); ctx.beginPath(); ctx.moveTo(x + L * .011, y); ctx.lineTo(x - L * .016, y + s * D * .085); ctx.lineTo(x - L * .009, y); ctx.closePath(); ctx.fill(); if (yel) { ctx.strokeStyle = 'rgba(20,20,10,.5)'; ctx.lineWidth = lw(L, .0015, .3); ctx.stroke(); } } }
    }
    tail(ctx, L, g, p, fc, c[1]);

    /* the body */
    ctx.save();
    bodyPath(ctx, g); ctx.clip();
    const gr = ctx.createLinearGradient(0, yT, 0, yB);
    gr.addColorStop(0, back); gr.addColorStop(.2, c[0]); gr.addColorStop(.46, c[1]); gr.addColorStop(.74, c[2]); gr.addColorStop(1, shade(c[2], .3));
    ctx.fillStyle = gr; ctx.fillRect(g.xT, yT - 2, L, yB - yT + 4);
    // scales: overlapping rows, each with a dark free edge toward the tail and a glint; none on the head
    const s = (p.sc || 0) * L * (sp.pat === 'scales' ? 1.25 : 1), dpx = ctx.getTransform ? Math.abs(ctx.getTransform().a) : 1;
    ctx.save(); ctx.beginPath(); ctx.moveTo(g.xT, yT - 2); ctx.lineTo(gA[0], yT - 2); ctx.lineTo(gA[0], gA[1]); ctx.quadraticCurveTo(gC[0], gC[1], gZ[0], gZ[1]); ctx.lineTo(gZ[0], yB + 2); ctx.lineTo(g.xT, yB + 2); ctx.closePath(); ctx.clip();
    if (s * dpx >= 2.4) {
      const dark = rgba(ink, sp.pat === 'scales' ? .3 : .15), light = `rgba(255,255,255,${sp.pat === 'scales' ? .3 : .16})`;
      ctx.lineWidth = Math.max(.45 / dpx, s * .1);
      for (let r = 0, y = yT; y < yB + s; y += s * .78, r++) for (let x = g.xp - s + (r % 2) * s * .5; x < gt[0] + s; x += s) {
        ctx.strokeStyle = dark; ctx.beginPath(); ctx.arc(x, y, s * .6, Math.PI - 1.1, Math.PI + 1.1); ctx.stroke();
        ctx.strokeStyle = light; ctx.beginPath(); ctx.arc(x - s * .16, y - s * .06, s * .32, -1.5, -.3); ctx.stroke();
      }
    } else if (p.sc) {
      // too small to see scale by scale: a fine weave
      ctx.strokeStyle = rgba(ink, .1); ctx.lineWidth = Math.max(.4 / dpx, L * .0015);
      for (let x = g.xp - D; x < gt[0] + D; x += L * .016) { ctx.beginPath(); ctx.moveTo(x, yT); ctx.lineTo(x + D * .45, yB); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + D * .45, yT); ctx.lineTo(x, yB); ctx.stroke(); }
    } else {
      // smooth skin: faint lines of muscle
      ctx.strokeStyle = rgba(ink, .06); ctx.lineWidth = Math.max(.4 / dpx, L * .0016);
      for (let x = g.xp; x < gt[0]; x += L * .022) { ctx.beginPath(); ctx.moveTo(x - D * .1, yT); ctx.lineTo(x + D * .08, 0); ctx.lineTo(x - D * .1, yB); ctx.stroke(); }
    }
    ctx.restore();
    pattern(ctx, sp, g, L, rnd);
    // the belly washes the scales and marks out; the back is darkest along its ridge
    let wash = ctx.createLinearGradient(0, yT + (yB - yT) * .55, 0, yB); wash.addColorStop(0, rgba(c[2], 0)); wash.addColorStop(1, rgba(shade(c[2], .25), .72));
    ctx.fillStyle = wash; ctx.fillRect(g.xT, yT, L, yB - yT + 2);
    wash = ctx.createLinearGradient(0, yT, 0, yT + (yB - yT) * .3); wash.addColorStop(0, rgba(back, .7)); wash.addColorStop(1, rgba(back, 0));
    ctx.fillStyle = wash; ctx.fillRect(g.xT, yT - 2, L, (yB - yT) * .32);
    // skin grain
    for (let i = 0; i < 260; i++) { const u = rnd(), [x, yt, yb] = H(u), y = yt + (yb - yt) * rnd() * .8; ctx.fillStyle = rnd() > .45 ? rgba(ink, .1) : 'rgba(255,255,255,.1)'; ctx.fillRect(x, y, lw(L, .0028, .4), lw(L, .0028, .4)); }
    // the head: smooth skin; the gill cover throws a soft shadow behind its edge and catches light along it
    {
      ctx.lineCap = 'round';
      ctx.save(); ctx.translate(-L * .009, 0); for (const [w, a] of [[.034, .05], [.02, .07], [.009, .1]]) { gill(); ctx.strokeStyle = `rgba(0,0,0,${a})`; ctx.lineWidth = L * w; ctx.stroke(); } ctx.restore();
      ctx.save(); ctx.translate(L * .006, 0); gill(); ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = lw(L, .006, .6); ctx.stroke(); ctx.restore();
      gill(); ctx.strokeStyle = rgba(ink, .5); ctx.lineWidth = lw(L, .003, .5); ctx.stroke();
      // the cheek plate in front of it, and the sheen of the cheek
      const uq = ug + (1 - ug) * .36, qt = at(g.top, uq), qb = at(g.bot, uq), qh = qb[1] - qt[1];
      ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = lw(L, .0024, .4); ctx.beginPath(); ctx.moveTo(qt[0] - L * .004, qt[1] + qh * .46); ctx.quadraticCurveTo(qt[0] - L * .02, qt[1] + qh * .78, qb[0] + L * .03, qb[1] - qh * .08); ctx.stroke();
      blot(ctx, (gt[0] + g.xs) / 2 - L * .01, gt[1] + gh * .62, (g.xs - gt[0]) * .3, gh * .16, 0, '#ffffff', .16);
    }
    // lateral line: a row of fine dashes following the back
    ctx.strokeStyle = rgba(ink, .34); ctx.lineWidth = lw(L, .0022, .4); ctx.setLineDash([L * .008, L * .006]); ctx.beginPath();
    for (let k = 0; k <= 24; k++) { const u = .01 + k * (ug - .02) / 24, [x, yt, yb] = H(u), f = .5 - .16 * Math.sin(Math.PI * Math.min(1, u / ug)) * (p.arch > .08 ? 1.3 : .8); k ? ctx.lineTo(x, yt + (yb - yt) * f) : ctx.moveTo(x, yt + (yb - yt) * f); }
    ctx.stroke(); ctx.setLineDash([]);
    // light: a soft band along the upper side, a rim of shadow all round
    for (const [w, a] of [[.2, .07], [.12, .09], [.055, .12]]) {
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = D * w; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k <= 20; k++) { const u = .08 + k * .041, [x, yt, yb] = H(u), y = yt + (yb - yt) * .3; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    bodyPath(ctx, g); ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = D * .1; ctx.stroke(); ctx.strokeStyle = rgba(ink, .22); ctx.lineWidth = D * .035; ctx.stroke();
    ctx.restore();
    bodyPath(ctx, g); ctx.strokeStyle = rgba(ink, .38); ctx.lineWidth = lw(L, .0022, .45); ctx.stroke();

    /* what lies on top of the body */
    // pectoral fin: a clear, pointed fan behind the gill cover
    {
      const px = gM[0] + L * .012, py = gt[1] + gh * .62, pl2 = L * (sp.sh === 'scorpion' ? .17 : p.sickle ? .17 : .12), wd = D * (sp.sh === 'scorpion' ? .22 : p.sickle ? .05 : .085);
      ctx.save(); ctx.translate(px, py); ctx.rotate(p.sickle ? .16 : .3);
      ctx.beginPath(); ctx.moveTo(0, -wd * .5); ctx.quadraticCurveTo(-pl2 * .55, -wd * .95, -pl2, wd * .12); ctx.quadraticCurveTo(-pl2 * .55, wd * .8, 0, wd * .5); ctx.closePath();
      const pg = ctx.createLinearGradient(0, 0, -pl2, 0); pg.addColorStop(0, rgba(mix(fc, c[1], .55), .8)); pg.addColorStop(1, rgba(shade(fc, .3), .42));
      ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = rgba(shade(fc, -.5), .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = rgba(shade(fc, -.5), .34); ctx.lineWidth = lw(L, .0016, .3);
      for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(0, k * wd * .08); ctx.lineTo(-pl2 * 1.05, k * wd * .2 + wd * .1); ctx.stroke(); }
      ctx.restore(); ctx.restore();
    }
    if (p.warts) { for (let i = 0; i < 14; i++) { const [x, y] = at(g.top, .5 + rnd() * .46); blot(ctx, x, y + D * (.04 + rnd() * .16), L * .012, L * .009, rnd() * 3, shade(c[0], -.4), .6); } }
    // the mouth and jaws
    const tip = at(g.top, 1), btip = at(g.bot, 1), my = (tip[1] + btip[1]) / 2 + D * .015;
    const mlen = { small: .028, big: .06, huge: .085, wide: .05, duck: .09 }[p.mouth] || .03;
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(ink, .78); ctx.lineWidth = lw(L, .0038, .6); ctx.beginPath(); ctx.moveTo(g.xs - L * .002, my); ctx.quadraticCurveTo(g.xs - L * mlen * .55, my + D * .028, g.xs - L * mlen, my + D * (p.mouth === 'duck' ? .03 : .07)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = lw(L, .003, .4); ctx.beginPath(); ctx.moveTo(g.xs - L * .006, my - D * .022); ctx.quadraticCurveTo(g.xs - L * mlen * .55, my + D * .004, g.xs - L * mlen * .95, my + D * .04); ctx.stroke();
    if (p.mouth === 'big' || p.mouth === 'huge') { ctx.strokeStyle = rgba(ink, .3); ctx.lineWidth = lw(L, .0024, .4); ctx.beginPath(); ctx.moveTo(g.xs - L * mlen * .3, my - D * .035); ctx.quadraticCurveTo(g.xs - L * mlen * .8, my - D * .01, g.xs - L * mlen * 1.12, my + D * .075); ctx.stroke(); }
    if (p.beak) { for (const [yy, ln] of [[-.012, .15], [.03, .19]]) { ctx.fillStyle = yy > 0 ? c[4] || '#c8492a' : shade(c[0], -.2); ctx.beginPath(); ctx.moveTo(g.xs - L * .012, my + D * (yy - .09)); ctx.lineTo(g.xs + L * ln, my + D * yy * 2.4); ctx.lineTo(g.xs - L * .012, my + D * (yy + .1)); ctx.closePath(); ctx.fill(); } }
    if (p.bill) { const bg = ctx.createLinearGradient(0, my - D * .06, 0, my + D * .05); bg.addColorStop(0, shade(c[0], -.25)); bg.addColorStop(1, shade(c[0], .15)); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(g.xs - L * .03, my - D * .09); ctx.quadraticCurveTo(g.xs + L * .1, my - D * .05, g.xs + L * .27, my - D * .02); ctx.quadraticCurveTo(g.xs + L * .1, my + D * .02, g.xs - L * .03, my + D * .05); ctx.closePath(); ctx.fill(); }
    if (p.barbel || p.barbels) {
      ctx.strokeStyle = rgba(shade(c[0], -.35), .9); ctx.lineCap = 'round';
      const n = p.barbels ? 3 : 1;
      for (let i = 0; i < n; i++) { ctx.lineWidth = lw(L, .0042 - i * .0008, .5); ctx.beginPath(); ctx.moveTo(g.xs - L * (.018 + i * .012), my + D * .06); ctx.quadraticCurveTo(g.xs + L * (.02 - i * .01), my + D * (.26 + i * .1), g.xs - L * (.03 + i * .05), my + D * (.44 + i * .16)); ctx.stroke(); }
      if (p.barbels) { ctx.lineWidth = lw(L, .0045, .5); ctx.beginPath(); ctx.moveTo(g.xs - L * .02, my - D * .04); ctx.quadraticCurveTo(g.xs + L * .09, my - D * .16, g.xs + L * .05, my - D * .56); ctx.stroke(); }
    }
    // nostril and eye
    const ue = at(g.top, p.eyeU), ub = at(g.bot, p.eyeU), er = p.eye * L * .52, ey = ue[1] + (ub[1] - ue[1]) * (sp.sh === 'catfish' || sp.sh === 'flathead' ? .26 : .36);
    ctx.fillStyle = rgba(ink, .6); circle(ctx, ue[0] + (g.xs - ue[0]) * .5, ey - er * .3, lw(L, .0035, .4)); ctx.fill();
    eye(ctx, ue[0], ey, er, sp.id === 'walleye' ? '#d9d2a8' : sp.id === 'barramundi' ? '#c8663a' : mix('#b9a468', c[1], .25), L);
  }

  /* --- other bodies --- */
  function ribbon(ctx, sp, L) {
    // hairtail: a long silver blade, a low fin all along the back, a whip of a tail
    const c = sp.c, D = L * .058, pts = [];
    for (let i = 0; i <= 48; i++) { const u = i / 48, x = -L / 2 + L * u; pts.push([x, 0, D * (u < .86 ? .08 + .92 * Math.pow(Math.min(1, u * 1.35), .8) : 1 - (u - .86) / .14 * .5)]); }
    ctx.fillStyle = rgba(mix(c[3] || '#cdd6dc', '#9fb0ba', .3), .7); ctx.beginPath(); ctx.moveTo(pts[3][0], -pts[3][2]);
    for (let i = 3; i <= 42; i++) ctx.lineTo(pts[i][0], -pts[i][2] - D * .42 * Math.min(1, (i - 3) / 6) * (i > 38 ? (42 - i) / 4 : 1));
    for (let i = 42; i >= 3; i--) ctx.lineTo(pts[i][0], -pts[i][2]); ctx.fill();
    ctx.strokeStyle = 'rgba(70,90,105,.3)'; ctx.lineWidth = lw(L, .0014, .3); for (let i = 4; i <= 42; i += .5) { const a = pts[Math.floor(i)]; ctx.beginPath(); ctx.moveTo(a[0], -a[2]); ctx.lineTo(a[0] - L * .004, -a[2] - D * .4); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(pts[0][0], 0); for (const [x, , h] of pts) ctx.lineTo(x, -h);
    ctx.quadraticCurveTo(L / 2 + L * .028, -D * .1, L / 2 + L * .03, D * .25); for (let i = 48; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][2] * .92); ctx.closePath();
    const gr = ctx.createLinearGradient(0, -D, 0, D); gr.addColorStop(0, '#8fa3b2'); gr.addColorStop(.25, '#e9eff3'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.72, '#d5dee5'); gr.addColorStop(1, '#a9b8c4');
    ctx.fillStyle = gr; ctx.fill(); ctx.save(); ctx.clip();
    const sh = ctx.createLinearGradient(-L / 2, 0, L / 2, 0); for (let i = 0; i <= 10; i++) sh.addColorStop(i / 10, `rgba(${i % 2 ? '120,150,175' : '255,255,255'},${i % 2 ? .12 : .1})`); ctx.fillStyle = sh; ctx.fillRect(-L / 2, -D, L, D * 2);
    ctx.strokeStyle = 'rgba(60,80,95,.3)'; ctx.lineWidth = lw(L, .0018, .35); ctx.beginPath(); ctx.moveTo(-L * .4, D * .1); ctx.quadraticCurveTo(0, D * .5, L * .36, -D * .05); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(60,78,92,.5)'; ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    const hx = L / 2 - L * .055; eye(ctx, hx, -D * .3, D * .3, '#d9dcdc', L);
    ctx.strokeStyle = 'rgba(40,52,62,.8)'; ctx.lineWidth = lw(L, .003, .5); ctx.beginPath(); ctx.moveTo(L / 2 + L * .028, D * .2); ctx.quadraticCurveTo(hx + L * .02, D * .3, hx - L * .03, D * .42); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,78,92,.45)'; ctx.lineWidth = lw(L, .0024, .4); ctx.beginPath(); ctx.moveTo(hx - L * .05, -D * .8); ctx.quadraticCurveTo(hx - L * .03, 0, hx - L * .055, D * .78); ctx.stroke();
  }
  function eel(ctx, sp, L) {
    const c = sp.c, big = sp.id === 'arapaima', D = L * (big ? .13 : .062), ink = shade(c[0], -.6), pts = [], rnd = seeded(hashStr(sp.id));
    for (let i = 0; i <= 48; i++) { const u = i / 48, x = -L / 2 + L * u, y = Math.sin(u * 5.2 + .6) * L * (big ? .012 : .035) * (1 - u * .55); pts.push([x, y, D * (u < .16 ? .3 + u * 4.4 : u > .9 ? 1 - (u - .9) * 3.4 : 1)]); }
    ctx.fillStyle = rgba(mix(c[3], c[0], .4), .82); ctx.beginPath(); ctx.moveTo(pts[0][0] - L * .02, pts[0][1]);
    const fa = big ? 15 : 31, fb = big ? 15 : 24, fk = big ? .5 : 1;
    for (let i = 0; i <= fa; i++) ctx.lineTo(pts[i][0], pts[i][1] - pts[i][2] - D * .34 * fk * Math.min(1, (fa - i) / 5) * Math.min(1, .35 + i / 3));
    for (let i = fb; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2] + D * .3 * fk * Math.min(1, (fb - i) / 5) * Math.min(1, .35 + i / 3)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const [x, y, h] of pts) ctx.lineTo(x, y - h);
    ctx.quadraticCurveTo(L / 2 + L * .035, pts[48][1], pts[48][0], pts[48][1] + pts[48][2]); for (let i = 48; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2]); ctx.closePath();
    const gr = ctx.createLinearGradient(0, -D * 1.3, 0, D * 1.3); gr.addColorStop(0, shade(c[0], -.25)); gr.addColorStop(.35, c[0]); gr.addColorStop(.62, c[1]); gr.addColorStop(1, c[2]);
    ctx.fillStyle = gr; ctx.fill(); ctx.save(); ctx.clip();
    if (sp.pat === 'redrear') { const g2 = ctx.createLinearGradient(-L / 2, 0, L * .05, 0); g2.addColorStop(0, rgba(c[4], .85)); g2.addColorStop(1, rgba(c[4], 0)); ctx.fillStyle = g2; ctx.fillRect(-L / 2, -D * 3, L * .6, D * 6); }
    if (big) { ctx.strokeStyle = rgba(ink, .22); ctx.lineWidth = lw(L, .002, .4); const s = L * .03; for (let r = 0, y = -D * 1.4; y < D * 1.4; y += s * .78, r++) for (let x = -L / 2 + (r % 2) * s * .5; x < L * .3; x += s) { ctx.beginPath(); ctx.arc(x, y, s * .6, Math.PI - 1.1, Math.PI + 1.1); ctx.stroke(); } }
    else for (let i = 0; i < 46; i++) { const k = Math.floor(rnd() * 44) + 2; blot(ctx, pts[k][0], pts[k][1] + (rnd() - .6) * pts[k][2] * 1.4, L * .012, L * .008, 0, sp.pat === 'mott' || sp.pat === 'leopard' ? (c[4] || ink) : ink, sp.pat === 'none' ? .08 : .4); }
    for (const [w, a] of [[.5, .08], [.24, .12]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = D * w; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1] - q[2] * .42) : ctx.moveTo(q[0], q[1] - q[2] * .42))); ctx.stroke(); }
    ctx.strokeStyle = rgba(ink, .22); ctx.lineWidth = D * .22; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    const h = pts[45]; eye(ctx, h[0] + L * .012, h[1] - h[2] * .42, D * .2, mix('#b9a468', c[1], .3), L);
    ctx.strokeStyle = rgba(ink, .7); ctx.lineWidth = lw(L, .003, .5); ctx.beginPath(); ctx.moveTo(L / 2 + L * .03, pts[48][1] + D * .08); ctx.quadraticCurveTo(h[0] + L * .03, h[1] + h[2] * .3, h[0], h[1] + h[2] * .2); ctx.stroke();
    ctx.fillStyle = rgba(mix(c[3], c[1], .4), .8); ctx.beginPath(); ctx.ellipse(pts[40][0], pts[40][1] + pts[40][2] * .25, L * .028, D * .34, .6, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(ink, .35); ctx.lineWidth = lw(L, .0018, .3); ctx.stroke();
  }
  function flat(ctx, sp, L) {
    // flounder, seen from above: an oval body fringed by its fins, both eyes on one side
    const c = sp.c, W = L * (sp.id === 'halibut' ? .29 : .33), rnd = seeded(hashStr(sp.id)), ink = shade(c[0], -.6), bx = L * .04;
    // the body's edge: a = 0 at the snout, going round
    const B = a => { const k = Math.cos(a); return [bx + (k > 0 ? k * L * .36 * (1 - .12 * Math.pow(k, 6)) : k * L * .33), Math.sin(a) * W * .5 * (1 - .1 * Math.max(0, -k))]; };
    for (const s of [-1, 1]) {
      const b = [], o = [];
      for (let i = 0; i <= 34; i++) { const t = i / 34, a = s * Math.PI * (.13 + t * .8), q = B(a), h = W * .2 * Math.sin(Math.PI * Math.min(1, t * 1.2 + .04)) * (1 - t * .25); b.push(q); o.push([q[0] - L * .014 + Math.cos(a) * h * .25, q[1] + s * h]); }
      ctx.beginPath(); ctx.moveTo(b[0][0], b[0][1]); o.forEach(q => ctx.lineTo(q[0], q[1])); for (let i = 34; i >= 0; i--) ctx.lineTo(b[i][0], b[i][1]); ctx.closePath();
      ctx.fillStyle = rgba(mix(c[3], c[0], .35), .9); ctx.fill(); ctx.strokeStyle = rgba(ink, .3); ctx.lineWidth = lw(L, .0016, .3);
      for (let i = 0; i <= 34; i++) { ctx.beginPath(); ctx.moveTo(b[i][0], b[i][1]); ctx.lineTo(o[i][0], o[i][1]); ctx.stroke(); }
      ctx.beginPath(); o.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.strokeStyle = rgba(ink, .42); ctx.stroke();
    }
    // tail fan
    const tx = bx - L * .31;
    ctx.beginPath(); ctx.moveTo(tx, -W * .1); ctx.quadraticCurveTo(-L * .42, -W * .27, -L * .5, -W * .25); ctx.quadraticCurveTo(-L * .525, 0, -L * .5, W * .25); ctx.quadraticCurveTo(-L * .42, W * .27, tx, W * .1); ctx.closePath();
    ctx.fillStyle = rgba(mix(c[3], c[0], .4), .95); ctx.fill(); ctx.strokeStyle = rgba(ink, .3); ctx.lineWidth = lw(L, .0018, .3); for (let k = -7; k <= 7; k++) { ctx.beginPath(); ctx.moveTo(tx, k * W * .012); ctx.lineTo(-L * .505, k * W * .034); ctx.stroke(); }
    const body = () => { ctx.beginPath(); for (let i = 0; i <= 64; i++) { const q = B(i / 64 * TAU); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.closePath(); };
    body(); const gr = ctx.createRadialGradient(bx + L * .02, -W * .08, L * .03, bx, 0, L * .4); gr.addColorStop(0, shade(c[1], .1)); gr.addColorStop(.7, c[0]); gr.addColorStop(1, shade(c[0], -.25)); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 70; i++) blot(ctx, bx + (rnd() - .5) * L * .7, (rnd() - .5) * W, L * .02 * (.4 + rnd()), L * .014 * (.4 + rnd()), rnd() * 3, rnd() > .3 ? (c[4] || ink) : shade(c[1], .3), .42);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = rnd() > .5 ? rgba(ink, .14) : 'rgba(255,255,255,.12)'; ctx.fillRect(bx + (rnd() - .5) * L * .7, (rnd() - .5) * W, lw(L, .003, .4), lw(L, .003, .4)); }
    ctx.strokeStyle = rgba(ink, .32); ctx.lineWidth = lw(L, .0022, .4); ctx.setLineDash([L * .008, L * .006]); ctx.beginPath(); ctx.moveTo(bx - L * .32, 0); ctx.quadraticCurveTo(bx + L * .06, -W * .01, bx + L * .12, -W * .13); ctx.quadraticCurveTo(bx + L * .17, -W * .17, bx + L * .21, -W * .08); ctx.stroke(); ctx.setLineDash([]);
    for (const [w, a] of [[.3, .05], [.14, .08]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = W * w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - L * .24, -W * .16); ctx.quadraticCurveTo(bx, -W * .3, bx + L * .2, -W * .2); ctx.stroke(); }
    body(); ctx.strokeStyle = rgba(ink, .22); ctx.lineWidth = W * .07; ctx.stroke(); ctx.restore();
    body(); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .003, .5); ctx.beginPath(); ctx.moveTo(bx + L * .2, -W * .31); ctx.quadraticCurveTo(bx + L * .235, 0, bx + L * .2, W * .33); ctx.stroke();
    // pectoral
    ctx.fillStyle = rgba(mix(c[3], c[1], .4), .75); ctx.beginPath(); ctx.moveTo(bx + L * .18, W * .1); ctx.quadraticCurveTo(bx + L * .11, W * .27, bx + L * .05, W * .2); ctx.quadraticCurveTo(bx + L * .11, W * .12, bx + L * .18, W * .1); ctx.fill(); ctx.strokeStyle = rgba(ink, .3); ctx.lineWidth = lw(L, .0016, .3); ctx.stroke();
    for (const [x, y, r] of [[.275, -.05, .018], [.255, -.2, .017]]) { blot(ctx, bx + L * x, W * y, L * r * 2, L * r * 2, 0, shade(c[0], -.3), .6); eye(ctx, bx + L * x, W * y, L * r, mix('#b9a468', c[1], .3), L); }
    ctx.strokeStyle = rgba(ink, .75); ctx.lineWidth = lw(L, .0034, .5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + L * .312, W * .09); ctx.quadraticCurveTo(bx + L * .3, W * .17, bx + L * .262, W * .19); ctx.stroke();
  }
  function ray(ctx, sp, L) {
    const c = sp.c, ink = shade(c[0], -.6), rnd = seeded(hashStr(sp.id));
    ctx.lineCap = 'round'; ctx.strokeStyle = shade(c[0], -.15); ctx.lineWidth = lw(L, .016, 1); ctx.beginPath(); ctx.moveTo(-L * .12, 0); ctx.quadraticCurveTo(-L * .32, L * .012, -L * .5, -L * .015); ctx.stroke();
    ctx.strokeStyle = shade(c[0], -.35); ctx.lineWidth = lw(L, .006, .6); ctx.beginPath(); ctx.moveTo(-L * .12, 0); ctx.quadraticCurveTo(-L * .32, L * .012, -L * .5, -L * .015); ctx.stroke();
    ctx.fillStyle = '#d9d2c2'; ctx.beginPath(); ctx.moveTo(-L * .27, -L * .004); ctx.lineTo(-L * .35, -L * .03); ctx.lineTo(-L * .3, L * .004); ctx.closePath(); ctx.fill();
    for (const s of [-1, 1]) { ctx.fillStyle = rgba(shade(c[0], -.1), .95); ctx.beginPath(); ctx.ellipse(-L * .13, s * L * .045, L * .05, L * .022, s * .4, 0, TAU); ctx.fill(); }
    const disc = () => { ctx.beginPath(); ctx.moveTo(L * .33, 0); ctx.bezierCurveTo(L * .25, -L * .14, L * .14, -L * .32, 0, -L * .335); ctx.bezierCurveTo(-L * .1, -L * .3, -L * .15, -L * .1, -L * .15, 0); ctx.bezierCurveTo(-L * .15, L * .1, -L * .1, L * .3, 0, L * .335); ctx.bezierCurveTo(L * .14, L * .32, L * .25, L * .14, L * .33, 0); ctx.closePath(); };
    disc(); const gr = ctx.createRadialGradient(L * .07, 0, L * .02, L * .05, 0, L * .34); gr.addColorStop(0, shade(c[1], .12)); gr.addColorStop(.6, c[0]); gr.addColorStop(1, shade(c[0], -.3)); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 46; i++) blot(ctx, (rnd() - .35) * L * .5, (rnd() - .5) * L * .6, L * .018 * (.5 + rnd()), L * .013 * (.5 + rnd()), rnd() * 3, rnd() > .4 ? (c[4] || ink) : shade(c[1], .35), .4);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = rnd() > .5 ? rgba(ink, .14) : 'rgba(255,255,255,.1)'; ctx.fillRect((rnd() - .35) * L * .5, (rnd() - .5) * L * .66, lw(L, .003, .4), lw(L, .003, .4)); }
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = L * .05; ctx.beginPath(); ctx.moveTo(-L * .12, 0); ctx.lineTo(L * .22, 0); ctx.stroke(); ctx.strokeStyle = rgba(ink, .25); ctx.lineWidth = lw(L, .003, .4); ctx.beginPath(); ctx.moveTo(-L * .13, 0); ctx.lineTo(L * .12, 0); ctx.stroke();
    disc(); ctx.strokeStyle = rgba(shade(c[3] || c[0], .1), .5); ctx.lineWidth = L * .03; ctx.stroke(); ctx.restore();
    disc(); ctx.strokeStyle = rgba(ink, .45); ctx.lineWidth = lw(L, .0024, .4); ctx.stroke();
    for (const s of [-1, 1]) { blot(ctx, L * .16, s * L * .04, L * .03, L * .026, 0, shade(c[0], -.35), .7); eye(ctx, L * .165, s * L * .04, L * .012, '#8a7a40', L); ctx.fillStyle = rgba(ink, .7); ctx.beginPath(); ctx.ellipse(L * .125, s * L * .05, L * .012, L * .008, 0, 0, TAU); ctx.fill(); }
  }
  function puffer(ctx, sp, L) {
    const c = sp.c, R = L * .3, rnd = seeded(hashStr(sp.id)), ink = shade(c[0], -.6), fc = c[3];
    // tail, back and belly fins
    ctx.save(); ctx.translate(-R * 1.0, 0); ctx.beginPath(); ctx.moveTo(R * .1, -R * .16); ctx.quadraticCurveTo(-R * .45, -R * .5, -R * .66, -R * .4); ctx.quadraticCurveTo(-R * .6, 0, -R * .66, R * .4); ctx.quadraticCurveTo(-R * .45, R * .5, R * .1, R * .16); ctx.closePath();
    ctx.fillStyle = rgba(mix(fc, c[0], .3), .92); ctx.fill(); ctx.strokeStyle = rgba(shade(fc, -.5), .3); ctx.lineWidth = lw(L, .002, .35); for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(0, k * R * .03); ctx.lineTo(-R * .64, k * R * .075); ctx.stroke(); } ctx.restore();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-R * .45, s * R * .66); ctx.quadraticCurveTo(-R * .72, s * R * 1.08, -R * .92, s * R * .86); ctx.quadraticCurveTo(-R * .8, s * R * .6, -R * .72, s * R * .48); ctx.closePath(); ctx.fillStyle = rgba(mix(fc, c[0], .3), .9); ctx.fill(); }
    const body = () => { ctx.beginPath(); ctx.moveTo(R * 1.12, R * .02); ctx.bezierCurveTo(R * 1.0, -R * .62, R * .3, -R * .86, -R * .3, -R * .76); ctx.bezierCurveTo(-R * .78, -R * .66, -R * 1.02, -R * .3, -R * 1.0, 0); ctx.bezierCurveTo(-R * 1.02, R * .36, -R * .7, R * .9, 0, R * .92); ctx.bezierCurveTo(R * .62, R * .92, R * 1.04, R * .56, R * 1.12, R * .02); ctx.closePath(); };
    body(); const gr = ctx.createLinearGradient(0, -R * .86, 0, R * .92); gr.addColorStop(0, shade(c[0], -.22)); gr.addColorStop(.3, c[0]); gr.addColorStop(.52, c[1]); gr.addColorStop(.62, c[2]); gr.addColorStop(1, shade(c[2], .3)); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    if (sp.pat === 'dots') for (let i = 0; i < 90; i++) { ctx.fillStyle = 'rgba(255,255,255,.62)'; circle(ctx, (rnd() - .5) * R * 2.1, -rnd() * R * .8 + R * .02, R * .026 * (.6 + rnd() * .8)); ctx.fill(); }
    else { for (let i = 0; i < 12; i++) blot(ctx, (rnd() - .5) * R * 1.7, -R * (.12 + rnd() * .56), R * (.07 + rnd() * .09), R * (.05 + rnd() * .07), rnd() * 3, c[4] || ink, .7); ctx.fillStyle = rgba(c[4] || ink, .92); circle(ctx, -R * .12, -R * .02, R * .17); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = R * .035; ctx.stroke(); }
    // prickles on the belly
    ctx.strokeStyle = rgba(ink, .22); ctx.lineWidth = lw(L, .0016, .3); for (let i = 0; i < 120; i++) { const x = (rnd() - .5) * R * 1.8, y = R * (.25 + rnd() * .62); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - R * .02, y + R * .025); ctx.stroke(); }
    for (let i = 0; i < 240; i++) { ctx.fillStyle = rnd() > .5 ? rgba(ink, .1) : 'rgba(255,255,255,.1)'; ctx.fillRect((rnd() - .5) * R * 2.2, (rnd() - .5) * R * 1.8, lw(L, .003, .4), lw(L, .003, .4)); }
    for (const [w, a] of [[.34, .07], [.16, .12]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = R * w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-R * .6, -R * .44); ctx.quadraticCurveTo(R * .1, -R * .62, R * .7, -R * .36); ctx.stroke(); }
    body(); ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = R * .16; ctx.stroke(); ctx.restore();
    body(); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    ctx.save(); ctx.translate(R * .34, R * .12); ctx.rotate(.5); ctx.beginPath(); ctx.moveTo(0, -R * .14); ctx.quadraticCurveTo(-R * .34, -R * .22, -R * .36, 0); ctx.quadraticCurveTo(-R * .34, R * .2, 0, R * .14); ctx.closePath(); ctx.fillStyle = rgba(mix(fc, c[1], .4), .82); ctx.fill(); ctx.strokeStyle = rgba(ink, .32); ctx.lineWidth = lw(L, .0018, .3); ctx.stroke(); for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(0, k * R * .03); ctx.lineTo(-R * .34, k * R * .055); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0028, .4); ctx.beginPath(); ctx.arc(R * .5, R * .08, R * .2, Math.PI * .6, Math.PI * 1.25); ctx.stroke();
    eye(ctx, R * .66, -R * .26, R * .12, mix('#b9a468', c[1], .3), L);
    ctx.fillStyle = '#ece6d6'; ctx.beginPath(); ctx.ellipse(R * 1.09, R * .06, R * .05, R * .085, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(ink, .6); ctx.lineWidth = lw(L, .002, .35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(R * 1.04, R * .06); ctx.lineTo(R * 1.14, R * .06); ctx.stroke();
  }
  function file(ctx, sp, L) {
    // filefish: a flat, rough-skinned lozenge with one spine over the eye
    const c = sp.c, rnd = seeded(hashStr(sp.id)), ink = shade(c[0], -.6), fc = c[3];
    ctx.save(); ctx.translate(-L * .3, 0); ctx.beginPath(); ctx.moveTo(L * .02, -L * .05); ctx.quadraticCurveTo(-L * .14, -L * .15, -L * .2, -L * .13); ctx.quadraticCurveTo(-L * .19, 0, -L * .2, L * .13); ctx.quadraticCurveTo(-L * .14, L * .15, L * .02, L * .05); ctx.closePath(); ctx.fillStyle = rgba(mix(fc, c[0], .3), .92); ctx.fill(); ctx.strokeStyle = rgba(shade(fc, -.5), .3); ctx.lineWidth = lw(L, .002, .35); for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(0, k * L * .009); ctx.lineTo(-L * .195, k * L * .025); ctx.stroke(); } ctx.restore();
    for (const s of [-1, 1]) { const b = [], o = []; for (let i = 0; i <= 14; i++) { const t = i / 14, x = L * .06 - t * L * .32, y = s * (L * .235 - t * L * .13); b.push([x, y]); o.push([x - L * .01, y + s * L * .06 * Math.sin(Math.PI * t)]); } ctx.beginPath(); ctx.moveTo(b[0][0], b[0][1]); o.forEach(q => ctx.lineTo(q[0], q[1])); for (let i = 14; i >= 0; i--) ctx.lineTo(b[i][0], b[i][1]); ctx.closePath(); ctx.fillStyle = rgba(shade(fc, .1), .7); ctx.fill(); ctx.strokeStyle = rgba(ink, .25); ctx.lineWidth = lw(L, .0015, .3); for (let i = 0; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(b[i][0], b[i][1]); ctx.lineTo(o[i][0], o[i][1]); ctx.stroke(); } }
    const body = () => { ctx.beginPath(); ctx.moveTo(L * .43, L * .02); ctx.quadraticCurveTo(L * .3, -L * .12, L * .14, -L * .25); ctx.quadraticCurveTo(L * .0, -L * .3, -L * .12, -L * .2); ctx.quadraticCurveTo(-L * .28, -L * .1, -L * .3, 0); ctx.quadraticCurveTo(-L * .28, L * .1, -L * .12, L * .2); ctx.quadraticCurveTo(L * .0, L * .34, L * .1, L * .27); ctx.quadraticCurveTo(L * .3, L * .14, L * .43, L * .02); ctx.closePath(); };
    body(); const gr = ctx.createLinearGradient(0, -L * .3, 0, L * .32); gr.addColorStop(0, shade(c[0], -.2)); gr.addColorStop(.3, c[0]); gr.addColorStop(.6, c[1]); gr.addColorStop(1, c[2]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 34; i++) blot(ctx, (rnd() - .4) * L * .62, (rnd() - .5) * L * .46, L * .03 * (.5 + rnd()), L * .02 * (.5 + rnd()), rnd() * 3, c[4] || ink, .36);
    for (let i = 0; i < 700; i++) { ctx.fillStyle = rnd() > .5 ? rgba(ink, .13) : 'rgba(255,255,255,.11)'; ctx.fillRect((rnd() - .4) * L * .74, (rnd() - .5) * L * .6, lw(L, .003, .4), lw(L, .003, .4)); }
    for (const [w, a] of [[.1, .07], [.05, .11]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = L * w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-L * .2, -L * .1); ctx.quadraticCurveTo(L * .05, -L * .2, L * .28, -L * .06); ctx.stroke(); }
    body(); ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = L * .045; ctx.stroke(); ctx.restore();
    body(); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = shade(c[0], -.35); ctx.lineWidth = lw(L, .011, .9); ctx.beginPath(); ctx.moveTo(L * .16, -L * .235); ctx.lineTo(L * .1, -L * .42); ctx.stroke(); ctx.strokeStyle = shade(c[0], .2); ctx.lineWidth = lw(L, .003, .4); ctx.stroke();
    ctx.save(); ctx.translate(L * .12, L * .0); ctx.beginPath(); ctx.moveTo(0, -L * .03); ctx.quadraticCurveTo(-L * .08, -L * .05, -L * .09, 0); ctx.quadraticCurveTo(-L * .08, L * .05, 0, L * .03); ctx.closePath(); ctx.fillStyle = rgba(mix(fc, c[1], .4), .8); ctx.fill(); ctx.strokeStyle = rgba(ink, .3); ctx.lineWidth = lw(L, .0016, .3); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(ink, .5); ctx.lineWidth = lw(L, .0026, .4); ctx.beginPath(); ctx.moveTo(L * .17, -L * .03); ctx.lineTo(L * .15, L * .05); ctx.stroke();
    eye(ctx, L * .22, -L * .1, L * .024, mix('#c7b56a', c[1], .2), L);
    ctx.fillStyle = '#e9e2d0'; ctx.beginPath(); ctx.ellipse(L * .425, L * .022, L * .012, L * .016, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(ink, .6); ctx.lineWidth = lw(L, .002, .35); ctx.stroke();
  }
  // squid, cuttlefish, octopus: soft bodies speckled with colour cells
  function cells(ctx, rnd, n, x0, x1, y0, y1, L, col, a = .5) { for (let i = 0; i < n; i++) { ctx.fillStyle = rgba(col, a * (.4 + rnd() * .6)); circle(ctx, x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), L * .0045 * (.5 + rnd())); ctx.fill(); } }
  function arm(ctx, L, x0, y0, x1, y1, x2, y2, w, col, ink, suck) {
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, q = t => { const v = 1 - t; return [v * v * x0 + 2 * v * t * x1 + t * t * x2, v * v * y0 + 2 * v * t * y1 + t * t * y2]; }, a = q(t0), b = q(t1); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = w * (1 - t0 * .82) + lw(L, .003, .5); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6 + .02, q = t => { const v = 1 - t; return [v * v * x0 + 2 * v * t * x1 + t * t * x2, v * v * y0 + 2 * v * t * y1 + t * t * y2]; }, a = q(t0), b = q(Math.min(1, t1)); ctx.strokeStyle = col; ctx.lineWidth = w * (1 - t0 * .82); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    if (suck) for (let k = 1; k < 10; k++) { const t = k / 10, v = 1 - t, x = v * v * x0 + 2 * v * t * x1 + t * t * x2, y = v * v * y0 + 2 * v * t * y1 + t * t * y2; ctx.fillStyle = 'rgba(255,240,230,.55)'; circle(ctx, x, y + w * .2 * (1 - t), w * .13 * (1 - t * .7)); ctx.fill(); }
  }
  function squid(ctx, sp, L) {
    const c = sp.c, rnd = seeded(hashStr(sp.id)), ink = shade(c[0], -.6);
    const finLong = sp.id === 'aoriika' ? .92 : sp.id === 'kensakiika' ? .5 : .34, M = L * .58, Wm = L * .1, hx = L * .12;
    for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .05; arm(ctx, L, hx + L * .03, a * L * .3, hx + L * .14, a * L * .62, hx + L * (.24 + (i % 3) * .018), a * L * .42 + Math.sin(i * 2.1) * L * .006, L * .02, mix(c[1], c[2], .3), ink, false); }
    for (const s of [-1, 1]) { arm(ctx, L, hx + L * .03, s * L * .012, hx + L * .22, s * L * .05, hx + L * .38, s * L * .02, L * .008, mix(c[1], c[2], .3), ink, false); ctx.fillStyle = mix(c[1], c[2], .3); ctx.beginPath(); ctx.ellipse(hx + L * .37, s * L * .022, L * .03, L * .008, s * -.1, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(ink, .35); ctx.lineWidth = lw(L, .0018, .3); ctx.stroke(); }
    // fins along the mantle
    const fx0 = hx - M, fx1 = hx - M * (1 - finLong);
    const fd = fx1 - fx0;
    ctx.beginPath(); ctx.moveTo(fx0, 0);
    if (finLong > .6) { ctx.quadraticCurveTo(fx0 + fd * .5, -Wm * 1.75, fx1, -Wm * .85); ctx.lineTo(fx1, Wm * .85); ctx.quadraticCurveTo(fx0 + fd * .5, Wm * 1.75, fx0, 0); }
    else { ctx.quadraticCurveTo(fx0 + fd * .3, -Wm * 1.1, fx0 + fd * .58, -Wm * 1.9); ctx.quadraticCurveTo(fx0 + fd * .9, -Wm * 1.5, fx1, -Wm * .7); ctx.lineTo(fx1, Wm * .7); ctx.quadraticCurveTo(fx0 + fd * .9, Wm * 1.5, fx0 + fd * .58, Wm * 1.9); ctx.quadraticCurveTo(fx0 + fd * .3, Wm * 1.1, fx0, 0); }
    ctx.closePath();
    ctx.fillStyle = rgba(mix(c[0], c[2], .45), .9); ctx.fill(); ctx.strokeStyle = rgba(ink, .32); ctx.lineWidth = lw(L, .002, .35); ctx.stroke();
    const mantle = () => { ctx.beginPath(); ctx.moveTo(hx - M, 0); ctx.bezierCurveTo(hx - M * .7, -Wm * .78, hx - M * .3, -Wm * 1.06, hx, -Wm * .96); ctx.lineTo(hx, Wm * .96); ctx.bezierCurveTo(hx - M * .3, Wm * 1.06, hx - M * .7, Wm * .78, hx - M, 0); ctx.closePath(); };
    mantle(); const gr = ctx.createLinearGradient(0, -Wm, 0, Wm); gr.addColorStop(0, shade(c[0], -.15)); gr.addColorStop(.3, c[0]); gr.addColorStop(.62, c[1]); gr.addColorStop(1, c[2]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip(); cells(ctx, rnd, 420, hx - M, hx, -Wm, Wm * .5, L, c[4] || '#7a3a2a', .6);
    for (const [w, a] of [[.6, .08], [.28, .13]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Wm * w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - M * .85, -Wm * .2); ctx.quadraticCurveTo(hx - M * .4, -Wm * .62, hx - L * .02, -Wm * .5); ctx.stroke(); }
    mantle(); ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = Wm * .3; ctx.stroke(); ctx.restore();
    mantle(); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + L * .025, 0, L * .055, Wm * .74, 0, 0, TAU); ctx.fillStyle = mix(c[1], c[0], .3); ctx.fill(); ctx.strokeStyle = rgba(ink, .35); ctx.lineWidth = lw(L, .002, .35); ctx.stroke();
    ctx.save(); ctx.clip(); cells(ctx, rnd, 60, hx - L * .03, hx + L * .08, -Wm, Wm * .3, L, c[4] || '#7a3a2a', .6); ctx.restore();
    eye(ctx, hx + L * .03, -Wm * .2, L * .022, '#b9c2c6', L);
  }
  function cuttle(ctx, sp, L) {
    const c = sp.c, W = L * .19, rnd = seeded(hashStr(sp.id)), ink = shade(c[0], -.6), bx = -L * .08;
    for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .085; arm(ctx, L, L * .2, a * L * .3, L * .3, a * L * .5, L * (.36 + (i % 2) * .02), a * L * .34 + Math.sin(i * 2.3) * L * .008, L * .024, mix(c[1], c[2], .25), ink, false); }
    ctx.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU, r = 1.13 + .035 * Math.sin(a * 16), x = bx + Math.cos(a) * L * .3 * r, y = Math.sin(a) * W * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fillStyle = rgba(mix(c[1], c[2], .5), .8); ctx.fill(); ctx.strokeStyle = rgba(ink, .3); ctx.lineWidth = lw(L, .0018, .3); ctx.stroke();
    const body = () => { ctx.beginPath(); ctx.ellipse(bx, 0, L * .3, W, 0, 0, TAU); };
    body(); const gr = ctx.createLinearGradient(0, -W, 0, W); gr.addColorStop(0, shade(c[0], -.2)); gr.addColorStop(.35, c[0]); gr.addColorStop(.66, c[1]); gr.addColorStop(1, c[2]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = rgba(c[4] || ink, .5); ctx.lineWidth = lw(L, .011, .8); ctx.lineCap = 'round';
    for (let i = 0; i < 11; i++) { const x = bx - L * .27 + i * L * .052; ctx.beginPath(); ctx.moveTo(x, -W); ctx.bezierCurveTo(x + L * .03, -W * .5, x - L * .02, -W * .2, x + L * .012, W * .25); ctx.stroke(); }
    cells(ctx, rnd, 320, bx - L * .3, bx + L * .3, -W, W * .6, L, shade(c[0], -.4), .5);
    for (const [w, a] of [[.5, .08], [.24, .12]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = W * w; ctx.beginPath(); ctx.moveTo(bx - L * .22, -W * .42); ctx.quadraticCurveTo(bx, -W * .7, bx + L * .22, -W * .42); ctx.stroke(); }
    body(); ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = W * .2; ctx.stroke(); ctx.restore();
    body(); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(L * .21, 0, L * .06, W * .64, 0, 0, TAU); ctx.fillStyle = mix(c[1], c[0], .3); ctx.fill(); ctx.strokeStyle = rgba(ink, .35); ctx.lineWidth = lw(L, .002, .35); ctx.stroke();
    eye(ctx, L * .215, -W * .26, L * .024, '#8f9a5a', L); ctx.strokeStyle = '#06080b'; ctx.lineWidth = lw(L, .006, .5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(L * .2, -W * .25); ctx.quadraticCurveTo(L * .215, -W * .17, L * .23, -W * .25); ctx.stroke();
  }
  function octopus(ctx, sp, L) {
    const c = sp.c, R = L * .19, rnd = seeded(hashStr(sp.id)), ink = shade(c[0], -.6), skin = c[1];
    const ends = [[-.44, .2], [-.36, .34], [-.2, .42], [-.05, .4], [.12, .43], [.26, .36], [.4, .3], [.46, .14]];
    ends.forEach(([ex, ey], i) => { const far = i === 0 || i === 7 || i === 3; arm(ctx, L, R * .15, R * .55, ex * L * .55 + (i % 2 ? L * .05 : -L * .03), R * .55 + L * (.16 + (i % 3) * .03), ex * L, R * .3 + ey * L * .62 + (i % 2) * L * .02, L * .046, far ? shade(skin, -.12) : skin, ink, true); });
    const mantle = () => { ctx.beginPath(); ctx.ellipse(-R * .32, -R * .42, R * 1.05, R * 1.28, -.5, 0, TAU); };
    mantle(); const gr = ctx.createRadialGradient(-R * .6, -R * 1.0, R * .1, -R * .2, -R * .3, R * 1.5); gr.addColorStop(0, shade(skin, .28)); gr.addColorStop(.5, skin); gr.addColorStop(1, shade(c[0], -.25)); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 40; i++) blot(ctx, -R * .3 + (rnd() - .5) * R * 2.2, -R * .4 + (rnd() - .5) * R * 2.6, R * .1 * (.5 + rnd()), R * .08 * (.5 + rnd()), rnd() * 3, c[4] || shade(c[0], -.3), .4);
    cells(ctx, rnd, 420, -R * 1.5, R * .9, -R * 1.8, R * .9, L, shade(c[0], -.45), .5);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(255,255,255,.14)'; circle(ctx, -R * .3 + (rnd() - .5) * R * 2, -R * .5 + (rnd() - .5) * R * 2.4, L * .004); ctx.fill(); }
    mantle(); ctx.strokeStyle = rgba(ink, .22); ctx.lineWidth = R * .22; ctx.stroke(); ctx.restore();
    mantle(); ctx.strokeStyle = rgba(ink, .4); ctx.lineWidth = lw(L, .0022, .4); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(R * .22, R * .34, R * .66, R * .44, .1, 0, TAU); const hg = ctx.createLinearGradient(0, -R * .1, 0, R * .8); hg.addColorStop(0, shade(skin, .1)); hg.addColorStop(1, shade(skin, -.2)); ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = rgba(ink, .32); ctx.lineWidth = lw(L, .002, .35); ctx.stroke();
    if (sp.pat === 'ring') for (let i = 0; i < 14; i++) { const x = -R * .3 + (rnd() - .5) * R * 1.7, y = -R * .4 + (rnd() - .5) * R * 2; ctx.strokeStyle = rgba(c[4], .95); ctx.lineWidth = lw(R, .055, .7); circle(ctx, x, y, R * .11); ctx.stroke(); ctx.fillStyle = rgba(shade(c[0], -.3), .6); circle(ctx, x, y, R * .06); ctx.fill(); }
    blot(ctx, R * .46, R * .14, R * .26, R * .22, 0, shade(c[0], -.35), .6);
    eye(ctx, R * .46, R * .13, R * .13, '#c9a94a', L); ctx.fillStyle = '#06080b'; ctx.fillRect(R * .37, R * .11, R * .19, R * .045);
  }
  function lion(ctx, sp, L) {
    const c = sp.c, pc = c[4] || '#7a2a1a';
    // the long banded spines of the back, and the fan of the breast fins behind the body
    for (let i = 0; i < 13; i++) { const x = L * .19 - i * L * .04, h = L * (.3 - i * .012), tx = x - L * .035, ty = -L * .07 - h; ctx.lineCap = 'round'; ctx.strokeStyle = rgba(shade(pc, -.3), .8); ctx.lineWidth = lw(L, .008, .8); ctx.beginPath(); ctx.moveTo(x, -L * .06); ctx.lineTo(tx, ty); ctx.stroke(); ctx.strokeStyle = 'rgba(250,240,228,.95)'; ctx.lineWidth = lw(L, .005, .5); ctx.setLineDash([L * .022, L * .022]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = rgba(mix(pc, c[1], .5), .4); ctx.beginPath(); ctx.moveTo(x, -L * .06); ctx.lineTo(tx, ty); ctx.lineTo(x - L * .04, -L * .06); ctx.closePath(); ctx.fill(); }
    for (let i = 0; i < 12; i++) { const a = .25 + i * .17, x1 = L * .06 - Math.cos(a) * L * .44, y1 = L * .04 + Math.sin(a) * L * .34; ctx.fillStyle = rgba(mix(c[1], pc, .35), .32); ctx.beginPath(); ctx.moveTo(L * .06, L * .04); ctx.lineTo(x1, y1); ctx.lineTo(L * .06 - Math.cos(a + .17) * L * .42, L * .04 + Math.sin(a + .17) * L * .33); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(shade(pc, -.2), .85); ctx.lineWidth = lw(L, .006, .6); ctx.beginPath(); ctx.moveTo(L * .06, L * .04); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = 'rgba(250,240,228,.9)'; ctx.lineWidth = lw(L, .0035, .4); ctx.setLineDash([L * .02, L * .024]); ctx.stroke(); ctx.setLineDash([]); }
    generic(ctx, Object.assign({}, sp, { pat: 'zebra' }), L * .82, Object.assign({}, SH.scorpion, { dors: 'small', d: .31, warts: 0 }));
  }

  // one still fish, centred at 0,0, L long, facing +x
  function paint(ctx, sp, L) {
    try {
      switch (sp.sh) {
        case 'ribbon': ribbon(ctx, sp, L); break;
        case 'eel': eel(ctx, sp, L); break;
        case 'flat': flat(ctx, sp, L); break;
        case 'ray': ray(ctx, sp, L); break;
        case 'puffer': puffer(ctx, sp, L); break;
        case 'file': file(ctx, sp, L); break;
        case 'squid': squid(ctx, sp, L); break;
        case 'cuttle': cuttle(ctx, sp, L); break;
        case 'octopus': octopus(ctx, sp, L); break;
        case 'lion': lion(ctx, sp, L); break;
        default: generic(ctx, sp, L, SH[sp.sh] || SH.perch);
      }
    } catch (e) { console.warn('draw', sp.id, e); }
  }

  /* --- pictures: each fish is painted once per size and kept --- */
  const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; };
  // how far the drawing reaches around its centre, in lengths: [left, top, right, bottom]
  const _box = new Map();
  function box(sp) {
    let b = _box.get(sp.id); if (b) return b;
    const L = 110, W = 220, H = 200, cv = mkCanvas(W, H), ctx = cv.getContext('2d'); ctx.translate(W / 2, H / 2); paint(ctx, sp, L);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    try { const d = ctx.getImageData(0, 0, W, H).data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch (e) { x0 = 20; x1 = 200; y0 = 40; y1 = 160; }
    if (x1 <= x0) { x0 = 20; x1 = 200; y0 = 40; y1 = 160; }
    b = [(x0 - W / 2 - 1) / L, (y0 - H / 2 - 1) / L, (x1 - W / 2 + 2) / L, (y1 - H / 2 + 2) / L]; _box.set(sp.id, b); return b;
  }
  const _spr = new Map();
  function sprite(sp, Lpx) {
    const Lq = Math.max(24, Math.ceil(Lpx / 24) * 24), key = sp.id + ':' + Lq; let s = _spr.get(key);
    if (s) { _spr.delete(key); _spr.set(key, s); return s; }
    const b = box(sp), w = (b[2] - b[0]) * Lq + 4, h = (b[3] - b[1]) * Lq + 4, cv = mkCanvas(w, h), ctx = cv.getContext('2d');
    ctx.translate(-b[0] * Lq + 2, -b[1] * Lq + 2); paint(ctx, sp, Lq);
    s = { cv, L: Lq, ox: -b[0] * Lq + 2, oy: -b[1] * Lq + 2 };
    _spr.set(key, s); if (_spr.size > 70) _spr.delete(_spr.keys().next().value);
    return s;
  }

  /* draw(ctx, sp, cx, cy, L, { flip, alpha, t, still }): t is the swimming clock (seconds) */
  function draw(ctx, sp, cx, cy, L, o = {}) {
    if (!sp || !(L > 0)) return;
    let sc = 1; try { const m = ctx.getTransform(); sc = Math.hypot(m.a, m.b) || 1; } catch (e) { }
    const s = sprite(sp, Math.min(900, L * sc)), k = L / s.L, W = s.cv.width, Hh = s.cv.height;
    ctx.save(); ctx.translate(cx, cy);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.scale(k, k);
    if (o.still || o.t == null) ctx.drawImage(s.cv, -s.ox, -s.oy);
    else if (sp.sh === 'octopus') { ctx.rotate(Math.sin(o.t * 2.4) * .05); ctx.scale(1 + Math.sin(o.t * 3) * .02, 1 - Math.sin(o.t * 3) * .02); ctx.drawImage(s.cv, -s.ox, -s.oy); }
    else {
      // the still picture, bent slice by slice: the tail swings widest, the head hardly at all
      const soft = sp.sh === 'squid' || sp.sh === 'cuttle', wide = sp.sh === 'ray' || sp.sh === 'flat', n = 26, sw = W / n, amp = s.L * (soft ? .012 : wide ? .02 : sp.sh === 'eel' || sp.sh === 'ribbon' ? .04 : .03);
      for (let i = 0; i < n; i++) {
        const u = (i + .5) / n, dy = Math.sin(o.t * 6 - u * (sp.sh === 'eel' || sp.sh === 'ribbon' ? 7 : 3.4)) * amp * (wide ? Math.sin(u * Math.PI) : Math.pow(1 - u, sp.sh === 'eel' || sp.sh === 'ribbon' ? 1.1 : 2));
        ctx.drawImage(s.cv, i * sw, 0, sw + (i < n - 1 ? 1 : 0), Hh, -s.ox + i * sw, -s.oy + dy, sw + (i < n - 1 ? 1 : 0), Hh);
      }
    }
    ctx.restore();
  }

  const cache = new Map();
  function thumb(sp, w = 160, h = 96, opts = {}) {
    const key = sp.id + ':' + w + 'x' + h + (opts.bg || '');
    if (cache.has(key)) return cache.get(key);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = mkCanvas(w * dpr, h * dpr), ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
    // as large as fits, with a little air around it
    const b = box(sp), L = Math.min(w * .9 / (b[2] - b[0]), h * .86 / (b[3] - b[1]));
    ctx.translate(w / 2 - (b[0] + b[2]) / 2 * L, h / 2 - (b[1] + b[3]) / 2 * L);
    // a soft shadow under the fish, as on a plate
    ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = '#0b1522'; ctx.beginPath(); ctx.ellipse((b[0] + b[2]) / 2 * L, b[3] * L * .98, (b[2] - b[0]) * L * .36, Math.max(1.2, h * .018), 0, 0, TAU); ctx.fill(); ctx.restore();
    paint(ctx, sp, L);
    const url = cv.toDataURL('image/png');
    cache.set(key, url);
    return url;
  }

  /* long lists: lazy(sp, w, h) gives the attributes for an <img> whose picture is painted when it comes near the screen */
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  let io = null;
  function fill(img) { const [id, w, h] = (img.dataset.fd || '').split('|'); img.removeAttribute('data-fd'); const sp = typeof SPI !== 'undefined' && SPI[id]; if (sp) img.src = thumb(sp, +w, +h); }
  function watch() {
    if (io) return;
    io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); } }, { rootMargin: '500px' });
    const scan = n => { if (n.nodeType !== 1) return; if (n.matches('img[data-fd]')) io.observe(n); n.querySelectorAll('img[data-fd]').forEach(x => io.observe(x)); };
    new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.documentElement, { childList: true, subtree: true });
    scan(document.documentElement);
  }
  function lazy(sp, w = 160, h = 96) {
    if (cache.has(sp.id + ':' + w + 'x' + h) || typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return `src="${thumb(sp, w, h)}"`;
    watch(); return `src="${BLANK}" data-fd="${sp.id}|${w}|${h}"`;
  }

  return { draw, thumb, lazy, SH, rgba, shade, mix, seeded, hashStr };
})();
