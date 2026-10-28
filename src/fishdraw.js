/* ===== Procedural fish renderer (no photos, drawn from species parameters) ===== */
const FD = (() => {
  const SH = {
    porgy:    {d:.50, um:.56, arch:.16, ped:.11, tf:.24, tail:'fork', snoutH:.07, dors:'spiny', eye:.062, eyeU:.86, mouth:'small', head:.27},
    perch:    {d:.34, um:.60, arch:.08, ped:.11, tf:.22, tail:'trunc', snoutH:.08, dors:'spiny', eye:.058, eyeU:.86, mouth:'big', head:.30},
    bass:     {d:.35, um:.58, arch:.06, ped:.11, tf:.22, tail:'trunc', snoutH:.10, dors:'spiny', eye:.052, eyeU:.86, mouth:'huge', head:.31},
    torpedo:  {d:.24, um:.55, arch:.02, ped:.055, tf:.27, tail:'deepfork', snoutH:.05, dors:'two', eye:.052, eyeU:.88, mouth:'small', head:.24, finlets:1},
    tuna:     {d:.31, um:.52, arch:.04, ped:.05, tf:.27, tail:'lunate', snoutH:.06, dors:'two', eye:.048, eyeU:.88, mouth:'small', head:.25, finlets:1},
    jack:     {d:.40, um:.58, arch:.14, ped:.06, tf:.26, tail:'deepfork', snoutH:.12, dors:'two', eye:.058, eyeU:.86, mouth:'big', head:.27, blunt:1},
    dorado:   {d:.30, um:.70, arch:.04, ped:.06, tf:.25, tail:'deepfork', snoutH:.26, dors:'long', eye:.048, eyeU:.90, mouth:'small', head:.18, blunt:1},
    cod:      {d:.27, um:.62, arch:.04, ped:.09, tf:.20, tail:'trunc', snoutH:.08, dors:'three', eye:.052, eyeU:.87, mouth:'big', head:.28, barbel:1},
    carp:     {d:.37, um:.56, arch:.12, ped:.12, tf:.24, tail:'fork', snoutH:.09, dors:'single', eye:.048, eyeU:.88, mouth:'small', head:.24},
    trout:    {d:.25, um:.56, arch:.04, ped:.10, tf:.22, tail:'trunc', snoutH:.08, dors:'single', eye:.048, eyeU:.88, mouth:'big', head:.24, adipose:1},
    mullet:   {d:.22, um:.52, arch:.02, ped:.09, tf:.24, tail:'fork', snoutH:.08, dors:'two', eye:.048, eyeU:.89, mouth:'small', head:.22},
    needle:   {d:.12, um:.50, arch:0, ped:.06, tf:.20, tail:'fork', snoutH:.04, dors:'rear', eye:.05, eyeU:.86, mouth:'small', head:.16, beak:1},
    goby:     {d:.20, um:.70, arch:.04, ped:.11, tf:.20, tail:'round', snoutH:.14, dors:'two', eye:.065, eyeU:.86, mouth:'big', head:.30, blunt:1},
    catfish:  {d:.21, um:.70, arch:0, ped:.11, tf:.17, tail:'round', snoutH:.18, dors:'small', eye:.034, eyeU:.92, mouth:'wide', head:.26, barbels:1, blunt:1},
    snakehead:{d:.18, um:.60, arch:0, ped:.13, tf:.16, tail:'round', snoutH:.12, dors:'longfull', eye:.04, eyeU:.92, mouth:'big', head:.22},
    pike:     {d:.17, um:.45, arch:0, ped:.08, tf:.20, tail:'fork', snoutH:.05, dors:'rear', eye:.044, eyeU:.80, mouth:'duck', head:.30},
    flathead: {d:.16, um:.70, arch:0, ped:.07, tf:.18, tail:'round', snoutH:.08, dors:'two', eye:.04, eyeU:.86, mouth:'wide', head:.34},
    scorpion: {d:.38, um:.72, arch:.10, ped:.12, tf:.20, tail:'round', snoutH:.16, dors:'bigspiny', eye:.07, eyeU:.84, mouth:'big', head:.40, warts:1, blunt:1},
    marlin:   {d:.22, um:.55, arch:.04, ped:.04, tf:.24, tail:'lunate', snoutH:.05, dors:'highfront', eye:.04, eyeU:.86, mouth:'small', head:.20, bill:1},
    sail:     {d:.21, um:.55, arch:.04, ped:.04, tf:.24, tail:'lunate', snoutH:.05, dors:'sail', eye:.04, eyeU:.86, mouth:'small', head:.20, bill:1}
  };
  const TAU = Math.PI * 2;

  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
  function mix(h1, h2, t) { const a = hex2rgb(h1), b = hex2rgb(h2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }
  function shade(h, amt) { return amt >= 0 ? mix(h, '#ffffff', amt) : mix(h, '#000000', -amt); }
  function seeded(seed) { let s = (seed >>> 0) || 7; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* Body geometry sampler (fish faces +x, centre at 0,0, length L) */
  function geom(L, p, wave) {
    const xs = L / 2, xT = -L / 2, xp = xT + p.tf * L;
    const D = p.d * L, P = p.ped * L, sH = Math.max(p.snoutH * D, L * 0.01);
    const y0 = D * 0.05;
    const N = 34, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = xp + (xs - xp) * u;
      let h;
      if (u < p.um) h = P / 2 + (D / 2 - P / 2) * Math.pow(Math.sin(Math.PI / 2 * u / p.um), 1.08);
      else { const v = (u - p.um) / (1 - p.um); h = sH + (D / 2 - sH) * Math.pow(Math.cos(Math.PI / 2 * v), p.blunt ? 0.55 : 0.92); }
      const w = wave ? wave(u) : 0;
      const t = u > .85 ? (u - .85) / .15 : 0;
      const cy = y0 * t + w;
      top.push([x, cy - h * (1 + p.arch)]);
      bot.push([x, cy + h * (1 - p.arch * 0.55)]);
    }
    return { xs, xT, xp, D, P, top, bot, y0, N };
  }
  function bodyPath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(g.top[0][0], g.top[0][1]);
    for (let i = 1; i < g.top.length; i++) {
      const a = g.top[i - 1], b = g.top[i];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    const tip = g.top[g.top.length - 1], btip = g.bot[g.bot.length - 1];
    ctx.quadraticCurveTo(tip[0] + (g.xs - tip[0]) * .2, (tip[1] + btip[1]) / 2, btip[0], btip[1]);
    for (let i = g.bot.length - 2; i >= 0; i--) {
      const a = g.bot[i + 1], b = g.bot[i];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.lineTo(g.bot[0][0], g.bot[0][1]);
    ctx.closePath();
  }
  const at = (arr, u) => { const f = u * (arr.length - 1), i = Math.max(0, Math.min(arr.length - 2, Math.floor(f))), t = f - i; return [arr[i][0] + (arr[i + 1][0] - arr[i][0]) * t, arr[i][1] + (arr[i + 1][1] - arr[i][1]) * t]; };

  function tail(ctx, g, p, L, beat, fill, stroke) {
    const bx = g.xp + 1, by = (g.top[0][1] + g.bot[0][1]) / 2;
    const span = g.xp - g.xT;
    const H = p.tail === 'round' ? Math.max(g.D * .8, g.P * 1.7) : Math.max(g.D * 0.95, g.P * 2.8) * (p.tail === 'lunate' ? 1.05 : 1);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(beat || 0);
    ctx.beginPath();
    const tp = -g.P / 2, bp = g.P / 2;
    if (p.tail === 'fork' || p.tail === 'deepfork') {
      const nd = p.tail === 'deepfork' ? .58 : .40;
      ctx.moveTo(0, tp);
      ctx.quadraticCurveTo(-span * .45, -H * .22, -span, -H / 2);
      ctx.quadraticCurveTo(-span * (1 - nd * .55), -H * .14, -span * (1 - nd), 0);
      ctx.quadraticCurveTo(-span * (1 - nd * .55), H * .14, -span, H / 2);
      ctx.quadraticCurveTo(-span * .45, H * .22, 0, bp);
    } else if (p.tail === 'lunate') {
      ctx.moveTo(0, tp * .8);
      ctx.quadraticCurveTo(-span * .55, -H * .18, -span * 1.02, -H * .56);
      ctx.quadraticCurveTo(-span * .58, -H * .1, -span * .5, 0);
      ctx.quadraticCurveTo(-span * .58, H * .1, -span * 1.02, H * .56);
      ctx.quadraticCurveTo(-span * .55, H * .18, 0, bp * .8);
    } else if (p.tail === 'trunc') {
      ctx.moveTo(0, tp);
      ctx.quadraticCurveTo(-span * .5, -H * .3, -span, -H * .44);
      ctx.quadraticCurveTo(-span * .9, 0, -span, H * .44);
      ctx.quadraticCurveTo(-span * .5, H * .3, 0, bp);
    } else {
      ctx.moveTo(0, tp);
      ctx.bezierCurveTo(-span * .55, -H * .5, -span * 1.15, -H * .3, -span * 1.1, 0);
      ctx.bezierCurveTo(-span * 1.15, H * .3, -span * .55, H * .5, 0, bp);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(.6, L * .004); ctx.stroke(); }
    // fin rays
    ctx.globalAlpha *= .25; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(.4, L * .002);
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(-1, k * g.P * .1); ctx.lineTo(-span * .85, k * H * .11); ctx.stroke(); }
    ctx.restore();
  }

  function fin(ctx, base, height, opts) {
    // base: array of [x,y] points along body edge; height: function(i,n) -> offset (negative = up)
    const n = base.length;
    ctx.beginPath();
    ctx.moveTo(base[0][0], base[0][1]);
    for (let i = 0; i < n; i++) {
      const [x, y] = base[i];
      const h = height(i, n);
      if (opts && opts.spiky && i % 2 === 1) ctx.lineTo(x, y + h * 1.12); else ctx.lineTo(x + (opts && opts.lean ? -h * .25 : 0), y + h);
    }
    ctx.lineTo(base[n - 1][0], base[n - 1][1]);
    ctx.closePath();
  }

  function pattern(ctx, sp, g, L, rnd) {
    const c = sp.c, pc = c[4] || '#000', D = g.D, xs = g.xs, xp = g.xp;
    const span = xs - xp;
    ctx.save();
    switch (sp.pat) {
      case 'vband': {
        const n = sp.sh === 'porgy' ? 7 : 6;
        ctx.fillStyle = rgba(pc, sp.sh === 'sail' || sp.sh === 'marlin' || sp.id === 'wahoo' ? .32 : .72);
        for (let i = 0; i < n; i++) {
          const u = .1 + i * (.8 / (n - 1));
          const [x] = at(g.top, u);
          const w = span * (sp.id === 'bluegill' || sp.id === 'tilapia' ? .05 : .06);
          ctx.beginPath(); ctx.ellipse(x, 0, w, D * .9, 0, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'hline': {
        ctx.strokeStyle = rgba(pc, .55); ctx.lineWidth = Math.max(1, D * .045);
        const n = sp.id === 'isaki' ? 3 : 6;
        for (let i = 0; i < n; i++) {
          const yy = -D * .32 + i * (D * .64 / (n - 1));
          ctx.beginPath(); ctx.moveTo(xp, yy * .6); ctx.quadraticCurveTo(xp + span * .5, yy * 1.05, xs - span * .14, yy * .7); ctx.stroke();
        }
        break;
      }
      case 'spot': case 'dots': {
        const n = sp.pat === 'dots' ? 34 : 22;
        ctx.fillStyle = rgba(pc, sp.pat === 'dots' ? .55 : .7);
        for (let i = 0; i < n; i++) {
          const u = .05 + rnd() * .82, [x, yt] = at(g.top, u), [, yb] = at(g.bot, u);
          const y = yt + (yb - yt) * (sp.pat === 'dots' ? rnd() * .6 : rnd() * .75);
          const r = L * (sp.pat === 'dots' ? .006 : .009) * (.7 + rnd() * .6);
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'rspot': case 'bspot': {
        ctx.fillStyle = sp.pat === 'rspot' ? rgba(pc, .85) : rgba(pc, .9);
        const n = sp.pat === 'rspot' ? 40 : 26;
        for (let i = 0; i < n; i++) {
          const u = .06 + rnd() * .84, [x, yt] = at(g.top, u), [, yb] = at(g.bot, u);
          const y = yt + (yb - yt) * (.08 + rnd() * (sp.pat === 'bspot' ? .5 : .85));
          ctx.beginPath(); ctx.arc(x, y, L * (sp.pat === 'rspot' ? .007 : .005) * (.7 + rnd() * .6), 0, TAU); ctx.fill();
        }
        break;
      }
      case 'mott': case 'blotch': case 'leopard': {
        const n = sp.pat === 'blotch' ? 6 : sp.pat === 'leopard' ? 26 : 18;
        for (let i = 0; i < n; i++) {
          const u = sp.pat === 'blotch' ? .1 + i * .14 : .04 + rnd() * .86;
          const [x, yt] = at(g.top, u), [, yb] = at(g.bot, u);
          const y = sp.pat === 'blotch' ? (yt + yb) / 2 : yt + (yb - yt) * rnd() * .8;
          const r = L * (sp.pat === 'blotch' ? .035 : sp.pat === 'leopard' ? .02 : .03) * (.6 + rnd() * .7);
          ctx.fillStyle = rgba(pc, sp.pat === 'leopard' ? .7 : .42);
          ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, rnd() * 3, 0, TAU); ctx.fill();
          if (sp.pat === 'leopard') { ctx.fillStyle = rgba(c[1], .9); ctx.beginPath(); ctx.ellipse(x, y, r * .55, r * .4, 0, 0, TAU); ctx.fill(); }
        }
        break;
      }
      case 'wavy': {
        ctx.strokeStyle = rgba(pc, .75); ctx.lineWidth = Math.max(1, L * .007);
        for (let i = 0; i < 9; i++) {
          const u = .12 + i * .085, [x, yt] = at(g.top, u);
          ctx.beginPath(); ctx.moveTo(x, yt + D * .04);
          ctx.bezierCurveTo(x + span * .03, yt + D * .12, x - span * .03, yt + D * .18, x + span * .01, yt + D * .3); ctx.stroke();
        }
        break;
      }
      case 'parr': case 'rainbow': {
        if (sp.pat === 'rainbow') {
          const gr = ctx.createLinearGradient(0, -D * .25, 0, D * .2);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.45, rgba(pc, .75)); gr.addColorStop(.55, rgba(pc, .75)); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.fillRect(xp - L * .1, -D * .25, span + L * .2, D * .45);
          ctx.fillStyle = 'rgba(30,30,30,.55)';
          for (let i = 0; i < 40; i++) { const u = rnd() * .9, [x, yt] = at(g.top, u), [, yb] = at(g.bot, u); ctx.beginPath(); ctx.arc(x, yt + (yb - yt) * rnd() * .55, L * .004, 0, TAU); ctx.fill(); }
        } else {
          ctx.fillStyle = rgba(pc, .55);
          for (let i = 0; i < 8; i++) { const u = .12 + i * .1, [x] = at(g.top, u); ctx.beginPath(); ctx.ellipse(x, 0, span * .028, D * .17, 0, 0, TAU); ctx.fill(); }
        }
        break;
      }
      case 'ystripe': case 'yline': case 'bline': {
        ctx.strokeStyle = sp.pat === 'bline' ? rgba(pc, .9) : rgba(c[3], .9);
        ctx.lineWidth = sp.pat === 'bline' ? Math.max(1.2, D * .05) : Math.max(1.5, D * .09);
        const ys = sp.pat === 'yline' ? [-D * .12, D * .1] : [sp.pat === 'bline' ? -D * .02 : -D * .05];
        for (const yy of ys) { ctx.beginPath(); ctx.moveTo(xp, yy * .4); ctx.quadraticCurveTo(xp + span * .55, yy * 1.2, xs - span * .08, yy * .6 + g.y0 * .5); ctx.stroke(); }
        break;
      }
      case 'tailspot': {
        ctx.fillStyle = rgba(pc, .95); ctx.beginPath(); ctx.arc(xp + span * .05, -D * .05, D * .11, 0, TAU); ctx.fill();
        break;
      }
      case 'finlet': case 'scute': {
        if (sp.pat === 'scute') {
          ctx.strokeStyle = rgba(pc, .6); ctx.lineWidth = Math.max(1, D * .05);
          ctx.beginPath(); ctx.moveTo(xp, 0); ctx.quadraticCurveTo(xp + span * .3, -D * .03, xp + span * .55, -D * .12); ctx.stroke();
        }
        break;
      }
      case 'pikespot': {
        ctx.fillStyle = rgba(pc, .75);
        for (let i = 0; i < 46; i++) { const u = .04 + rnd() * .86, [x, yt] = at(g.top, u), [, yb] = at(g.bot, u); ctx.beginPath(); ctx.ellipse(x, yt + (yb - yt) * (.15 + rnd() * .6), L * .011, L * .006, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'redspot': {
        for (let i = 0; i < 30; i++) {
          const u = .1 + rnd() * .8, [x, yt] = at(g.top, u), [, yb] = at(g.bot, u), y = yt + (yb - yt) * (.1 + rnd() * .6);
          const red = rnd() > .55;
          if (red) { ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.arc(x, y, L * .011, 0, TAU); ctx.fill(); }
          ctx.fillStyle = red ? rgba(pc, .95) : 'rgba(30,25,20,.7)'; ctx.beginPath(); ctx.arc(x, y, L * .007, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'peacock': {
        ctx.fillStyle = rgba('#1e2412', .6);
        for (let i = 0; i < 3; i++) { const u = .25 + i * .2, [x] = at(g.top, u); ctx.beginPath(); ctx.ellipse(x, -D * .05, span * .045, D * .5, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = rgba(pc, .6); ctx.fillRect(xp - L * .1, D * .1, span + L * .2, D * .5);
        break;
      }
      case 'redrear': {
        const gr = ctx.createLinearGradient(xp, 0, xp + span * .55, 0); gr.addColorStop(0, rgba(pc, .85)); gr.addColorStop(1, rgba(pc, 0));
        ctx.fillStyle = gr; ctx.fillRect(xp - L * .1, -D, span * .6 + L * .1, D * 2);
        break;
      }
      case 'scales': {
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = Math.max(.6, L * .002);
        const s = L * .035;
        for (let x = xp; x < xs - span * .18; x += s) for (let y = -D * .6; y < D * .6; y += s * .8) { ctx.beginPath(); ctx.arc(x + ((y / s) | 0) % 2 * s * .5, y, s * .55, -1.2, 1.2); ctx.stroke(); }
        break;
      }
      case 'yspot': {
        ctx.fillStyle = rgba(pc, .9); const [x] = at(g.top, .72); ctx.beginPath(); ctx.ellipse(x, -D * .05, D * .14, D * .09, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'puffer': {
        ctx.fillStyle = rgba(pc, .55);
        for (let i = 0; i < 16; i++) { const u = .1 + rnd() * .75, [x, yt] = at(g.top, u); ctx.beginPath(); ctx.arc(x, yt + D * (.08 + rnd() * .25), L * .02, 0, TAU); ctx.fill(); }
        break;
      }
    }
    ctx.restore();
  }

  function eye(ctx, x, y, r, iris) {
    ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = iris || '#c9a64a'; ctx.beginPath(); ctx.arc(x, y, r * .78, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.arc(x + r * .08, y, r * .52, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x + r * .32, y - r * .28, r * .2, 0, TAU); ctx.fill();
  }

  function generic(ctx, sp, L, p, o) {
    const c = sp.c, ph = o.t || 0, amp = o.still ? 0 : L * .028;
    const wave = u => Math.sin(ph * 6 - u * 3.4) * amp * Math.pow(1 - u, 2.2);
    const g = geom(L, p, wave);
    const rnd = seeded(hashStr(sp.id));
    const finCol = rgba(c[3], .88), finEdge = rgba(shade(c[3], -.35), .6);
    const outline = rgba(shade(c[0], -.5), .45);
    // dorsal fins (behind body)
    ctx.save();
    ctx.fillStyle = finCol; ctx.strokeStyle = finEdge; ctx.lineWidth = Math.max(.6, L * .003);
    const D = g.D;
    const dorsal = (u0, u1, hgt, spiky, shape) => {
      const base = []; const n = 14;
      for (let i = 0; i <= n; i++) base.push(at(g.top, u0 + (u1 - u0) * i / n));
      fin(ctx, base, (i, nn) => { const t = i / (nn - 1); const s = shape ? shape(t) : Math.sin(Math.PI * Math.min(1, t * 1.15)); return -hgt * s; }, { spiky });
      ctx.fill(); ctx.stroke();
    };
    switch (p.dors) {
      case 'spiny': dorsal(.30, .55, D * .26, true, t => Math.min(1, t * 3) * (1 - t * .25)); dorsal(.14, .34, D * .24, false); break;
      case 'bigspiny': dorsal(.36, .82, D * .42, true, t => Math.min(1, t * 4) * (1 - t * .35)); dorsal(.12, .38, D * .28, false); break;
      case 'two': dorsal(.48, .70, D * .30, false, t => Math.sin(Math.PI * t) * (1 - t * .3)); dorsal(.16, .36, D * .22, false); break;
      case 'three': dorsal(.60, .76, D * .28, false); dorsal(.36, .56, D * .26, false); dorsal(.12, .32, D * .22, false); break;
      case 'single': dorsal(.42, .70, D * .30, false, t => Math.min(1, t * 2.4) * (1 - t * .5)); break;
      case 'rear': dorsal(.08, .26, D * .38, false); break;
      case 'small': dorsal(.58, .68, D * .22, false); break;
      case 'long': dorsal(.08, .97, D * .28, false, t => .7 + .3 * Math.sin(Math.PI * t)); break;
      case 'longfull': dorsal(.06, .78, D * .22, false, () => 1); break;
      case 'highfront': dorsal(.55, .80, D * .9, false, t => Math.pow(1 - t, 1.8)); dorsal(.08, .14, D * .2, false); break;
      case 'sail': dorsal(.20, .82, D * 1.25, false, t => Math.sin(Math.PI * Math.min(1, t * 1.05)) * (0.75 + t * .25)); break;
    }
    if (p.adipose) { const [x, y] = at(g.top, .12); ctx.beginPath(); ctx.ellipse(x, y - D * .05, L * .02, D * .1, 0, 0, TAU); ctx.fill(); }
    // anal & pelvic fins
    const below = (u0, u1, hgt, shape) => {
      const base = []; const n = 10;
      for (let i = 0; i <= n; i++) base.push(at(g.bot, u0 + (u1 - u0) * i / n));
      fin(ctx, base, (i, nn) => { const t = i / (nn - 1); return hgt * (shape ? shape(t) : Math.sin(Math.PI * t)); });
      ctx.fill(); ctx.stroke();
    };
    if (p.dors === 'longfull') below(.06, .5, D * .2, () => 1);
    else if (p.dors === 'long') below(.08, .45, D * .24, () => .9);
    else below(.12, .34, D * (p.tail === 'deepfork' || p.tail === 'lunate' ? .22 : .26));
    below(.58, .66, D * .2, t => Math.sin(Math.PI * t) * (1 - t * .4));
    if (p.finlets) {
      ctx.fillStyle = sp.pat === 'finlet' ? rgba(c[4], .95) : finCol;
      for (let i = 0; i < 6; i++) {
        const u = .02 + i * .045;
        for (const arr of [g.top, g.bot]) { const [x, y] = at(arr, u); const s = arr === g.top ? -1 : 1; ctx.beginPath(); ctx.moveTo(x - L * .008, y); ctx.lineTo(x + L * .008, y); ctx.lineTo(x - L * .006, y + s * D * .09); ctx.closePath(); ctx.fill(); }
      }
    }
    ctx.restore();
    // tail
    tail(ctx, g, p, L, o.still ? 0 : Math.sin(ph * 6 + .6) * .18, finCol, finEdge);
    // body
    ctx.save();
    bodyPath(ctx, g);
    const gr = ctx.createLinearGradient(0, -D * .7, 0, D * .6);
    gr.addColorStop(0, c[0]); gr.addColorStop(.45, c[1]); gr.addColorStop(1, c[2]);
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    pattern(ctx, sp, g, L, rnd);
    // sheen
    const sh = ctx.createLinearGradient(0, -D * .6, 0, D * .1);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.55, 'rgba(255,255,255,.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(-L / 2, -D * .6, L, D * .7);
    // lateral line
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = Math.max(.5, L * .0025);
    ctx.beginPath(); const a0 = at(g.top, .02), a1 = at(g.top, .8);
    ctx.moveTo(a0[0], (a0[1] + at(g.bot, .02)[1]) / 2); ctx.quadraticCurveTo((a0[0] + a1[0]) / 2, -D * .32, a1[0], a1[1] + D * .35); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = outline; ctx.lineWidth = Math.max(.6, L * .004); ctx.stroke();
    ctx.restore();
    // gill cover
    const ug = 1 - p.head * L / (g.xs - g.xp);
    const gt = at(g.top, ug), gb = at(g.bot, ug);
    ctx.strokeStyle = rgba(shade(c[0], -.45), .45); ctx.lineWidth = Math.max(.7, L * .004);
    ctx.beginPath(); ctx.moveTo(gt[0] - L * .01, gt[1] + D * .18); ctx.quadraticCurveTo(gt[0] + L * .03, (gt[1] + gb[1]) / 2, gb[0], gb[1] - D * .08); ctx.stroke();
    // pectoral fin
    ctx.save(); ctx.translate(gt[0] - L * .012, (gt[1] + gb[1]) / 2 + D * .06); ctx.rotate(.45 + (o.still ? 0 : Math.sin(ph * 4) * .12));
    const pl = L * (sp.sh === 'scorpion' ? .14 : .095);
    ctx.beginPath(); ctx.moveTo(0, -D * .045); ctx.quadraticCurveTo(-pl * .55, -D * .085, -pl, D * .01); ctx.quadraticCurveTo(-pl * .5, D * .06, 0, D * .045); ctx.closePath();
    ctx.fillStyle = rgba(shade(c[3], .2), .5); ctx.fill(); ctx.strokeStyle = rgba(shade(c[3], -.3), .35); ctx.lineWidth = Math.max(.5, L * .0025); ctx.stroke(); ctx.restore();
    // scorpion warts / head spines
    if (p.warts) {
      ctx.fillStyle = rgba(shade(c[0], -.3), .55);
      for (let i = 0; i < 9; i++) { const [x, y] = at(g.top, .72 + rnd() * .25); ctx.beginPath(); ctx.arc(x, y + D * .05, L * .008, 0, TAU); ctx.fill(); }
    }
    // mouth
    const tip = at(g.top, 1), btip = at(g.bot, 1), my = (tip[1] + btip[1]) / 2;
    ctx.strokeStyle = rgba(shade(c[0], -.6), .6); ctx.lineWidth = Math.max(.7, L * .004);
    const mlen = { small: .025, big: .06, huge: .09, wide: .05, duck: .07 }[p.mouth] || .03;
    ctx.beginPath(); ctx.moveTo(g.xs - L * .004, my); ctx.quadraticCurveTo(g.xs - L * mlen * .5, my + D * .05, g.xs - L * mlen, my + D * .02); ctx.stroke();
    // beak / bill
    if (p.beak) { ctx.fillStyle = c[4] || '#d84a2a'; ctx.beginPath(); ctx.moveTo(g.xs - L * .01, my + D * .04); ctx.lineTo(g.xs + L * .12, my + D * .12); ctx.lineTo(g.xs - L * .01, my + D * .14); ctx.closePath(); ctx.fill(); }
    if (p.bill) { ctx.fillStyle = shade(c[0], -.1); ctx.beginPath(); ctx.moveTo(g.xs - L * .02, my - D * .05); ctx.lineTo(g.xs + L * .26, my - D * .01); ctx.lineTo(g.xs - L * .02, my + D * .06); ctx.closePath(); ctx.fill(); }
    // barbels
    if (p.barbel || p.barbels) {
      ctx.strokeStyle = rgba(shade(c[0], -.3), .85); ctx.lineWidth = Math.max(.8, L * .004);
      const n = p.barbels ? 3 : 1;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(g.xs - L * .02, my + D * .04); ctx.quadraticCurveTo(g.xs + L * .02, my + D * (.25 + i * .12), g.xs - L * (.02 + i * .05), my + D * (.45 + i * .18)); ctx.stroke(); }
      if (p.barbels) { ctx.beginPath(); ctx.moveTo(g.xs - L * .02, my - D * .02); ctx.quadraticCurveTo(g.xs + L * .06, my - D * .2, g.xs + L * .02, my - D * .5); ctx.stroke(); }
    }
    // eye
    const ue = at(g.top, p.eyeU), ub = at(g.bot, p.eyeU);
    eye(ctx, ue[0], ue[1] + (ub[1] - ue[1]) * (sp.sh === 'catfish' || sp.sh === 'flathead' ? .25 : .34), p.eye * L, sp.id === 'walleye' ? '#e8e0b0' : sp.id === 'barramundi' ? '#d86a3a' : null);
  }

  /* --- special bodies --- */
  function ribbon(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, D = L * .07;
    const pts = [];
    for (let i = 0; i <= 40; i++) { const u = i / 40, x = -L / 2 + L * u; const w = o.still ? 0 : Math.sin(ph * 5 - u * 7) * L * .02 * (1 - u * .7); pts.push([x, w, D * (u < .85 ? .2 + .8 * Math.min(1, u * 1.6) : (1 - (u - .85) / .15 * .55))]); }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y, h] of pts) ctx.lineTo(x, y - h);
    ctx.lineTo(L / 2 + L * .02, pts[40][1]);
    for (let i = 40; i >= 0; i--) { const [x, y, h] = pts[i]; ctx.lineTo(x, y + h * .9); }
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, -D, 0, D); gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[2]); gr.addColorStop(1, c[1]);
    ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = 'rgba(80,100,115,.5)'; ctx.lineWidth = Math.max(.6, L * .002); ctx.stroke();
    // dorsal fin along length
    ctx.fillStyle = 'rgba(200,215,225,.55)'; ctx.beginPath(); ctx.moveTo(pts[2][0], pts[2][1] - pts[2][2]);
    for (let i = 2; i <= 34; i++) { const [x, y, h] = pts[i]; ctx.lineTo(x, y - h - D * .45); }
    for (let i = 34; i >= 2; i--) { const [x, y, h] = pts[i]; ctx.lineTo(x, y - h); }
    ctx.fill();
    const hx = L / 2 - L * .05, hy = pts[38][1];
    eye(ctx, hx - L * .015, hy - D * .25, D * .42, '#e8e8e8');
    ctx.strokeStyle = 'rgba(60,70,80,.7)'; ctx.lineWidth = Math.max(.7, L * .003);
    ctx.beginPath(); ctx.moveTo(L / 2 + L * .02, hy); ctx.lineTo(hx - L * .02, hy + D * .35); ctx.stroke();
  }
  function eel(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, D = L * (sp.id === 'arapaima' ? .14 : .07);
    const pts = [];
    for (let i = 0; i <= 40; i++) { const u = i / 40, x = -L / 2 + L * u; const w = o.still ? 0 : Math.sin(ph * 5 - u * 6) * L * .03 * (1 - u * .8); pts.push([x, w, D * (u < .15 ? .35 + u * 4 : u > .9 ? 1 - (u - .9) * 3 : 1)]); }
    // continuous fin
    ctx.fillStyle = rgba(c[3], .7); ctx.beginPath(); ctx.moveTo(pts[0][0] - L * .02, pts[0][1]);
    for (let i = 0; i <= 28; i++) { const [x, y, h] = pts[i]; ctx.lineTo(x, y - h - D * .3); }
    for (let i = 28; i >= 0; i--) { const [x, y, h] = pts[i]; ctx.lineTo(x, y + h + D * .3 * (i < 20 ? 1 : 0)); }
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y, h] of pts) ctx.lineTo(x, y - h);
    ctx.quadraticCurveTo(L / 2 + L * .04, pts[40][1], pts[40][0], pts[40][1] + pts[40][2]);
    for (let i = 40; i >= 0; i--) { const [x, y, h] = pts[i]; ctx.lineTo(x, y + h); }
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, -D, 0, D); gr.addColorStop(0, c[0]); gr.addColorStop(.6, c[1]); gr.addColorStop(1, c[2]);
    ctx.fillStyle = gr; ctx.fill();
    if (sp.pat === 'redrear') { ctx.save(); ctx.clip(); const g2 = ctx.createLinearGradient(-L / 2, 0, 0, 0); g2.addColorStop(0, rgba(c[4], .85)); g2.addColorStop(1, rgba(c[4], 0)); ctx.fillStyle = g2; ctx.fillRect(-L / 2, -D * 2, L / 2, D * 4); ctx.restore(); }
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(.6, L * .003); ctx.stroke();
    eye(ctx, L / 2 - L * .05, pts[38][1] - D * .35, D * .3);
    ctx.fillStyle = rgba(c[3], .6); ctx.beginPath(); ctx.ellipse(L / 2 - L * .13, pts[35][1] + D * .3, L * .025, D * .3, .5, 0, TAU); ctx.fill();
  }
  function flat(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, W = L * .42, rnd = seeded(hashStr(sp.id));
    const ripple = o.still ? 0 : ph;
    ctx.fillStyle = rgba(c[3], .85);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU; const r = 1 + .06 * Math.sin(a * 18 + ripple * 6); const x = Math.cos(a) * L * .4 * r, y = Math.sin(a) * W * .62 * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    // tail
    ctx.beginPath(); ctx.moveTo(-L * .36, 0); ctx.quadraticCurveTo(-L * .46, -W * .3, -L * .5, -W * .24); ctx.quadraticCurveTo(-L * .47, 0, -L * .5, W * .24); ctx.quadraticCurveTo(-L * .46, W * .3, -L * .36, 0); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, L * .36, W * .5, 0, 0, TAU);
    const gr = ctx.createRadialGradient(L * .05, -W * .1, L * .02, 0, 0, L * .4); gr.addColorStop(0, shade(c[1], .12)); gr.addColorStop(1, c[0]);
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 26; i++) { ctx.fillStyle = rgba(c[4], .35); ctx.beginPath(); ctx.ellipse((rnd() - .5) * L * .7, (rnd() - .5) * W * .9, L * .03 * (.5 + rnd()), L * .02 * (.5 + rnd()), rnd() * 3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(.6, L * .003); ctx.beginPath(); ctx.moveTo(-L * .34, 0); ctx.quadraticCurveTo(0, -W * .12, L * .3, 0); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(.6, L * .003); ctx.beginPath(); ctx.ellipse(0, 0, L * .36, W * .5, 0, 0, TAU); ctx.stroke();
    const left = sp.id === 'hirame' || sp.id === 'halibut' && false;
    const ey = left ? -1 : 1;
    eye(ctx, L * .24, -W * .08 * ey - W * .06, L * .03); eye(ctx, L * .2, -W * .2 * ey + W * .02, L * .028);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.moveTo(L * .35, W * .05); ctx.quadraticCurveTo(L * .3, W * .14, L * .26, W * .12); ctx.stroke();
  }
  function ray(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, fl = o.still ? 0 : Math.sin(ph * 4) * .08;
    ctx.save(); ctx.rotate(-Math.PI / 2 * 0);
    ctx.strokeStyle = shade(c[0], -.2); ctx.lineWidth = Math.max(1, L * .012);
    ctx.beginPath(); ctx.moveTo(-L * .12, 0); ctx.quadraticCurveTo(-L * .35, L * .02, -L * .5, -L * .02 + fl * L * .2); ctx.stroke();
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(-L * .28, 0); ctx.lineTo(-L * .34, -L * .025); ctx.lineTo(-L * .31, L * .004); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(L * .32, 0);
    ctx.quadraticCurveTo(L * .2, -L * .2, L * .02, -L * (.32 + fl));
    ctx.quadraticCurveTo(-L * .12, -L * .2, -L * .14, 0);
    ctx.quadraticCurveTo(-L * .12, L * .2, L * .02, L * (.32 - fl));
    ctx.quadraticCurveTo(L * .2, L * .2, L * .32, 0);
    const gr = ctx.createRadialGradient(L * .06, 0, L * .02, L * .05, 0, L * .3); gr.addColorStop(0, shade(c[1], .15)); gr.addColorStop(.8, c[0]); gr.addColorStop(1, c[3]);
    ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = rgba(c[3], .9); ctx.lineWidth = Math.max(1, L * .01); ctx.stroke();
    eye(ctx, L * .15, -L * .035, L * .018, '#8a7a40'); eye(ctx, L * .15, L * .035, L * .018, '#8a7a40');
    ctx.restore();
  }
  function puffer(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, R = L * .32, rnd = seeded(hashStr(sp.id));
    ctx.fillStyle = rgba(c[3], .85);
    ctx.save(); ctx.translate(-R * .95, 0); ctx.rotate(o.still ? 0 : Math.sin(ph * 6) * .25);
    ctx.beginPath(); ctx.moveTo(0, -R * .2); ctx.quadraticCurveTo(-R * .6, -R * .6, -R * .7, 0); ctx.quadraticCurveTo(-R * .6, R * .6, 0, R * .2); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.08, R * .86, 0, 0, TAU);
    const gr = ctx.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[1]); gr.addColorStop(.62, c[2]); gr.addColorStop(1, c[2]);
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba(c[4], .7);
    if (sp.pat === 'dots') { for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc((rnd() - .5) * R * 2, -rnd() * R * .8, R * .03, 0, TAU); ctx.fill(); } }
    else { for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc((rnd() - .5) * R * 1.6, -R * (.1 + rnd() * .6), R * (.06 + rnd() * .08), 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.arc(R * .05, R * .05, R * .2, 0, TAU); ctx.fillStyle = rgba(c[4], .9); ctx.fill(); ctx.beginPath(); ctx.arc(R * .05, R * .05, R * .2, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = R * .05; ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(.6, L * .004); ctx.beginPath(); ctx.ellipse(0, 0, R * 1.08, R * .86, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(c[3], .7); ctx.beginPath(); ctx.ellipse(R * .3, R * .05, R * .16, R * .3, .3 + (o.still ? 0 : Math.sin(ph * 8) * .2), 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-R * .4, -R * .8); ctx.quadraticCurveTo(-R * .6, -R * 1.1, -R * .8, -R * .7); ctx.fill();
    eye(ctx, R * .55, -R * .28, R * .17);
    ctx.fillStyle = '#efe9da'; ctx.beginPath(); ctx.ellipse(R * 1.05, R * .08, R * .08, R * .1, 0, 0, TAU); ctx.fill();
  }
  function file(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, rnd = seeded(hashStr(sp.id));
    ctx.fillStyle = rgba(c[3], .8);
    ctx.save(); ctx.translate(-L * .3, 0); ctx.rotate(o.still ? 0 : Math.sin(ph * 6) * .2);
    ctx.beginPath(); ctx.moveTo(0, -L * .06); ctx.quadraticCurveTo(-L * .2, -L * .14, -L * .2, 0); ctx.quadraticCurveTo(-L * .2, L * .14, 0, L * .06); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(L * .42, 0); ctx.quadraticCurveTo(L * .2, -L * .32, -L * .05, -L * .24); ctx.quadraticCurveTo(-L * .3, -L * .1, -L * .3, 0); ctx.quadraticCurveTo(-L * .3, L * .1, -L * .05, L * .24); ctx.quadraticCurveTo(L * .2, L * .3, L * .42, 0);
    const gr = ctx.createLinearGradient(0, -L * .3, 0, L * .3); gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[2]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip(); for (let i = 0; i < 20; i++) { ctx.fillStyle = rgba(c[4], .35); ctx.beginPath(); ctx.arc((rnd() - .4) * L * .6, (rnd() - .5) * L * .4, L * .035, 0, TAU); ctx.fill(); } ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(.6, L * .004); ctx.stroke();
    ctx.strokeStyle = shade(c[0], -.3); ctx.lineWidth = Math.max(1, L * .012); ctx.beginPath(); ctx.moveTo(L * .14, -L * .24); ctx.lineTo(L * .1, -L * .42); ctx.stroke();
    eye(ctx, L * .22, -L * .08, L * .04);
  }
  function squid(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, pulse = o.still ? 0 : Math.sin(ph * 5) * .04, rnd = seeded(hashStr(sp.id));
    const finLong = sp.id === 'aoriika' ? .9 : sp.id === 'kensakiika' ? .55 : .3;
    const M = L * .55, Wm = L * (.11 + pulse * .5);
    // arms behind (pointing +x is head side? squid swims mantle first: mantle tip at -x, arms at +x)
    ctx.strokeStyle = rgba(c[1], .9); ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .045; ctx.lineWidth = Math.max(1.2, L * .016); ctx.beginPath(); ctx.moveTo(L * .14, 0); ctx.quadraticCurveTo(L * .26, a * L * .5, L * (.34 + rnd() * .03), a * L * .8 + (o.still ? 0 : Math.sin(ph * 4 + i) * L * .01)); ctx.stroke(); }
    ctx.lineWidth = Math.max(.8, L * .007);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(L * .14, s * L * .01); ctx.quadraticCurveTo(L * .34, s * L * .035, L * .44, s * L * .02); ctx.stroke(); }
    // fins
    ctx.fillStyle = rgba(c[1], .8);
    ctx.beginPath(); ctx.moveTo(-M * .9 + L * .1, 0);
    ctx.quadraticCurveTo(-M * (1 - finLong) + L * .1 - L * .05, -Wm * (1.9 + (finLong > .5 ? .6 : 0)), L * .1 - M * (1 - finLong) * 0.0 - (finLong > .5 ? 0 : M * .55), -Wm * .8);
    ctx.lineTo(L * .1 - (finLong > .5 ? 0 : M * .55), Wm * .8);
    ctx.quadraticCurveTo(-M * (1 - finLong) + L * .1 - L * .05, Wm * (1.9 + (finLong > .5 ? .6 : 0)), -M * .9 + L * .1, 0);
    ctx.fill();
    // mantle
    ctx.beginPath(); ctx.moveTo(-M + L * .1, 0); ctx.quadraticCurveTo(-M * .55 + L * .1, -Wm * 1.05, L * .1, -Wm); ctx.lineTo(L * .1, Wm); ctx.quadraticCurveTo(-M * .55 + L * .1, Wm * 1.05, -M + L * .1, 0);
    const gr = ctx.createLinearGradient(0, -Wm, 0, Wm); gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[2]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = rgba(c[4], .35); for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(-M * rnd() + L * .1, (rnd() - .5) * Wm * 2, L * .006, 0, TAU); ctx.fill(); } ctx.restore();
    // head
    ctx.fillStyle = c[1]; ctx.beginPath(); ctx.ellipse(L * .14, 0, L * .06, Wm * .72, 0, 0, TAU); ctx.fill();
    eye(ctx, L * .14, -Wm * .25, L * .03, '#2a3a4a');
  }
  function cuttle(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, W = L * .2, und = o.still ? 0 : ph;
    ctx.fillStyle = rgba(c[1], .75);
    ctx.beginPath(); for (let i = 0; i <= 50; i++) { const a = i / 50 * TAU; const r = 1.12 + .05 * Math.sin(a * 14 + und * 8); const x = Math.cos(a) * L * .3 * r - L * .08, y = Math.sin(a) * W * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.fill();
    ctx.strokeStyle = rgba(c[1], .95); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, L * .014);
    for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .08; ctx.beginPath(); ctx.moveTo(L * .2, 0); ctx.quadraticCurveTo(L * .32, a * L * .6, L * .42, a * L * .9 + (o.still ? 0 : Math.sin(ph * 4 + i) * L * .01)); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(-L * .08, 0, L * .3, W, 0, 0, TAU);
    const gr = ctx.createLinearGradient(0, -W, 0, W); gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[2]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = rgba(c[4], .5); ctx.lineWidth = Math.max(1, L * .012); for (let i = 0; i < 9; i++) { const x = -L * .32 + i * L * .055; ctx.beginPath(); ctx.moveTo(x, -W); ctx.quadraticCurveTo(x + L * .03, 0, x, W * .2); ctx.stroke(); } ctx.restore();
    ctx.fillStyle = c[1]; ctx.beginPath(); ctx.ellipse(L * .2, 0, L * .06, W * .62, 0, 0, TAU); ctx.fill();
    eye(ctx, L * .2, -W * .3, L * .032, '#5a6a3a');
  }
  function octopus(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c, R = L * .2, rnd = seeded(hashStr(sp.id));
    ctx.strokeStyle = c[1]; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const base = (i / 8) * Math.PI * .9 + Math.PI * .55;
      ctx.lineWidth = Math.max(1.4, L * .03);
      ctx.beginPath(); ctx.moveTo(0, R * .5);
      const sway = o.still ? 0 : Math.sin(ph * 3 + i * .8) * .35;
      const x1 = Math.cos(base + sway) * L * .25, y1 = R * .5 + Math.abs(Math.sin(base)) * L * .12 + L * .1;
      const x2 = Math.cos(base + sway * 1.6) * L * .45, y2 = R * .4 + L * .22 + Math.sin(i + ph) * L * .02;
      ctx.bezierCurveTo(x1 * .5, y1, x1, y1 + L * .05, x2, y2); ctx.stroke();
      ctx.lineWidth = Math.max(1, L * .012); ctx.strokeStyle = rgba(c[2], .6); ctx.stroke(); ctx.strokeStyle = c[1];
    }
    ctx.beginPath(); ctx.ellipse(-R * .25, -R * .35, R * 1.05, R * 1.25, -.5, 0, TAU);
    const gr = ctx.createRadialGradient(-R * .4, -R * .8, R * .1, 0, 0, R * 1.4); gr.addColorStop(0, shade(c[1], .2)); gr.addColorStop(1, c[0]); ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = rgba(c[4], .35); for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc((rnd() - .5) * R * 2, (rnd() - .7) * R * 2, R * .1, 0, TAU); ctx.fill(); } ctx.restore();
    if (sp.pat === 'ring') { ctx.strokeStyle = rgba(c[4], .95); ctx.lineWidth = Math.max(1, R * .1); ctx.beginPath(); ctx.arc(R * .35, R * .25, R * .18, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = c[1]; ctx.beginPath(); ctx.ellipse(R * .2, R * .3, R * .62, R * .42, 0, 0, TAU); ctx.fill();
    eye(ctx, R * .45, R * .12, R * .16, '#d8b24a');
  }
  function lion(ctx, sp, L, o) {
    const ph = o.t || 0, c = sp.c;
    // long fan pectorals
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const a = .4 + i * .19 + (o.still ? 0 : Math.sin(ph * 3) * .05);
      ctx.strokeStyle = i % 2 ? rgba(c[4], .85) : rgba(c[1], .9); ctx.lineWidth = Math.max(.8, L * .008);
      ctx.beginPath(); ctx.moveTo(L * .05, L * .05); ctx.lineTo(L * .05 - Math.cos(a) * L * .42, L * .05 + Math.sin(a) * L * .32); ctx.stroke();
    }
    // dorsal spines
    for (let i = 0; i < 12; i++) {
      const x = L * .18 - i * L * .045; const h = L * (.28 - i * .012);
      ctx.strokeStyle = i % 2 ? rgba(c[4], .9) : 'rgba(250,240,230,.9)'; ctx.lineWidth = Math.max(.8, L * .007);
      ctx.beginPath(); ctx.moveTo(x, -L * .06); ctx.lineTo(x - L * .03, -L * .06 - h); ctx.stroke();
    }
    ctx.restore();
    generic(ctx, sp, L * .85, Object.assign({}, SH.scorpion, { dors: 'small', d: .32 }), o);
  }

  function draw(ctx, sp, cx, cy, L, o = {}) {
    if (!sp) return;
    ctx.save(); ctx.translate(cx, cy);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    try {
      switch (sp.sh) {
        case 'ribbon': ribbon(ctx, sp, L, o); break;
        case 'eel': eel(ctx, sp, L, o); break;
        case 'flat': flat(ctx, sp, L, o); break;
        case 'ray': ray(ctx, sp, L, o); break;
        case 'puffer': puffer(ctx, sp, L, o); break;
        case 'file': file(ctx, sp, L, o); break;
        case 'squid': squid(ctx, sp, L, o); break;
        case 'cuttle': cuttle(ctx, sp, L, o); break;
        case 'octopus': octopus(ctx, sp, L, o); break;
        case 'lion': lion(ctx, sp, L, o); break;
        default: generic(ctx, sp, L, SH[sp.sh] || SH.perch, o);
      }
    } catch (e) { console.warn('draw', sp.id, e); }
    ctx.restore();
  }

  const cache = new Map();
  function thumb(sp, w = 160, h = 96, opts = {}) {
    const key = sp.id + ':' + w + 'x' + h + (opts.bg || '');
    if (cache.has(key)) return cache.get(key);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas'); cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
    const tall = ['octopus', 'ray', 'flat', 'puffer', 'file', 'lion', 'sail'].includes(sp.sh);
    const L = tall ? Math.min(w * .78, h * 1.25) : w * .82;
    const cy = sp.sh === 'octopus' ? h * .42 : sp.sh === 'sail' ? h * .6 : h * .52;
    draw(ctx, sp, w * (sp.sh === 'marlin' || sp.sh === 'sail' ? .44 : .5), cy, sp.sh === 'marlin' || sp.sh === 'sail' ? w * .72 : L, { still: true });
    const url = cv.toDataURL('image/png');
    cache.set(key, url);
    return url;
  }

  return { draw, thumb, SH, rgba, shade, mix, seeded, hashStr };
})();
