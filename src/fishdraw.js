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

/* ===== "My Sea" scene ===== */
class SeaScene {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.theme = 'dawn'; this.decor = []; this.fx = []; this.fish = []; this.t = 0; this.run = false;
    this.hover = null; this.particles = []; this.preview = null;
    this.reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    this._ro = 'ResizeObserver' in window ? new ResizeObserver(() => this.resize()) : null;
    if (this._ro) this._ro.observe(canvas.parentElement || canvas);
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerleave', () => { this.hover = null; if (this.onHover) this.onHover(null); });
    canvas.addEventListener('click', e => { const f = this.pick(e); if (f && this.onPick) this.onPick(f); });
  }
  resize() {
    const r = this.cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(280, r.width); this.H = Math.max(220, r.height);
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hz = this.H * .28;
    for (const f of this.fish) this.place(f, true);
    if (!this.run) this.frame(0, true);
  }
  setState({ theme, decor, fx, fish, preview }) {
    if (theme) this.theme = theme; if (decor) this.decor = decor; if (fx) this.fx = fx;
    this.preview = preview || null;
    if (fish) {
      const old = new Map(this.fish.map(f => [f.key, f]));
      this.fish = fish.map(f => { const o = old.get(f.key); if (o) return Object.assign(o, f); const n = Object.assign({}, f); this.place(n); return n; });
    }
    if (!this.run) this.frame(0, true);
  }
  place(f, keep) {
    const sp = SPI[f.sp]; if (!sp) return;
    const rel = Math.max(.55, Math.min(1.6, Math.log2(1 + (f.len || sp.L) / sp.L) * 1.25));
    f.size = Math.max(26, Math.min(this.W * .28, this.W * .1 * rel * (sp.L > 120 ? 1.6 : sp.L > 60 ? 1.25 : 1)));
    if (!keep || f.x == null) {
      const r = FD.seeded(FD.hashStr(f.key));
      f.x = this.W * (.1 + r() * .8); f.by = this.hz + (this.H - this.hz) * (.18 + r() * .58);
      f.v = (.25 + r() * .35) * (r() > .5 ? 1 : -1); f.ph = r() * 10;
    }
    if (sp.sh === 'octopus' || sp.sh === 'flat' || sp.sh === 'ray') f.by = this.H - this.H * .1 - f.size * .12;
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

  palette() {
    const P = {
      dawn:   { sky: ['#1f3550', '#5b6f93', '#e7a98a', '#f4c9a0'], sea: ['#2c5a74', '#173c52', '#0b2433'], sun: '#ffd9a8', floor: '#2a3a3e', far: '#24384c' },
      day:    { sky: ['#5aa6dc', '#8cc8ec', '#cfeaf8', '#e8f6fc'], sea: ['#2a8fb4', '#11658a', '#0a3f5c'], sun: '#fff6d8', floor: '#b8a278', far: '#5e8a7a' },
      sunset: { sky: ['#2a1a46', '#7a3a6a', '#e46a4a', '#f6b25a'], sea: ['#6a3a5a', '#2c2446', '#120f24'], sun: '#ffcf6a', floor: '#3a2a30', far: '#3a2440' },
      night:  { sky: ['#030812', '#071426', '#0c2038', '#12294a'], sea: ['#0a2236', '#06172a', '#020a14'], sun: '#e8f0ff', floor: '#14202a', far: '#0a1424' },
      reef:   { sky: ['#47b6e0', '#7fd2ee', '#c6eef8', '#e6fbff'], sea: ['#1ab0c8', '#0b86a8', '#055c7c'], sun: '#fffbe0', floor: '#e8d7a8', far: '#3aa0a0' },
      aurora: { sky: ['#020814', '#08203a', '#0e3a4a', '#1a4a5a'], sea: ['#0c3040', '#071d2a', '#020c14'], sun: '#dff4ff', floor: '#1a262c', far: '#18303a' },
      sakura: { sky: ['#6a8ac8', '#a8b8e4', '#f2c8d8', '#fbe4ea'], sea: ['#3a8aa8', '#1e6080', '#0e3a52'], sun: '#fff0f4', floor: '#a89070', far: '#7a6a8a' }
    };
    return P[this.preview?.theme || this.theme] || P.dawn;
  }
  has(id) { const d = this.preview?.decor ? this.decor.concat(this.preview.decor) : this.decor; return d.includes(id); }
  hasFx(id) { const d = this.preview?.fx ? this.fx.concat(this.preview.fx) : this.fx; return d.includes(id); }

  frame(dt, still) {
    const c = this.ctx, W = this.W, H = this.H, hz = this.hz, P = this.palette();
    if (!still && !this.reduce) this.t += dt / 1000;
    const t = this.t, theme = this.preview?.theme || this.theme;
    // sky
    let g = c.createLinearGradient(0, 0, 0, hz);
    P.sky.forEach((col, i) => g.addColorStop(i / (P.sky.length - 1), col));
    c.fillStyle = g; c.fillRect(0, 0, W, hz + 1);
    // stars / aurora
    if (theme === 'night' || theme === 'aurora') {
      const r = FD.seeded(42); c.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * hz * .8, s = r() * 1.2 + .2; c.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * .8 + i)); c.fillRect(x, y, s, s); }
      c.globalAlpha = 1;
    }
    if (theme === 'aurora') {
      for (let k = 0; k < 3; k++) {
        c.beginPath(); c.moveTo(0, hz * .55);
        for (let x = 0; x <= W; x += 12) c.lineTo(x, hz * (.25 + k * .1) + Math.sin(x * .012 + t * .5 + k) * hz * .1);
        c.lineTo(W, hz * .9); c.lineTo(0, hz * .9); c.closePath();
        const ag = c.createLinearGradient(0, hz * .1, 0, hz * .9); ag.addColorStop(0, `rgba(80,255,180,${.18 - k * .04})`); ag.addColorStop(1, 'rgba(80,255,180,0)');
        c.fillStyle = ag; c.fill();
      }
    }
    // sun / moon
    const sunX = W * (theme === 'sunset' ? .32 : .78), sunY = hz * (theme === 'sunset' ? .78 : theme === 'dawn' ? .7 : .32);
    const sg = c.createRadialGradient(sunX, sunY, 2, sunX, sunY, hz * .6);
    sg.addColorStop(0, FD.rgba(P.sun, theme === 'night' || theme === 'aurora' ? .5 : .85)); sg.addColorStop(1, FD.rgba(P.sun, 0));
    c.fillStyle = sg; c.fillRect(0, 0, W, hz);
    c.fillStyle = P.sun; c.beginPath(); c.arc(sunX, sunY, theme === 'night' || theme === 'aurora' ? 9 : 14, 0, Math.PI * 2); c.fill();
    // far shore silhouette
    c.fillStyle = P.far; c.beginPath(); c.moveTo(0, hz);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, hz - 8 - Math.abs(Math.sin(x * .011) * 16) - Math.abs(Math.sin(x * .031 + 1) * 8) * (x > W * .45 && x < W * .7 ? 1.6 : .6));
    c.lineTo(W, hz); c.closePath(); c.fill();
    if (theme === 'night') { // squid-boat lights on the horizon
      for (let i = 0; i < 7; i++) { const x = W * (.08 + i * .13), y = hz - 3; const lg = c.createRadialGradient(x, y, 1, x, y, 16); lg.addColorStop(0, 'rgba(190,255,200,.95)'); lg.addColorStop(1, 'rgba(120,255,160,0)'); c.fillStyle = lg; c.fillRect(x - 16, y - 16, 32, 32); }
    }
    if (theme === 'sakura') { c.fillStyle = 'rgba(246,190,210,.9)'; for (let i = 0; i < 5; i++) { const x = W * (.05 + i * .045); c.beginPath(); c.arc(x, hz - 18 - (i % 2) * 6, 14, 0, Math.PI * 2); c.fill(); } }
    // above-water decor
    if (this.has('dc_tetra')) this.tetrapods(c, W * .03, hz, W * .22);
    if (this.has('dc_light')) this.lighthouse(c, W * .86, hz, t);
    // sea body
    g = c.createLinearGradient(0, hz, 0, H);
    P.sea.forEach((col, i) => g.addColorStop(i / (P.sea.length - 1), col));
    c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
    // surface glints
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const y = hz + 3 + (i % 6) * 4, x = ((i * 97 + t * 14 * (i % 2 ? 1 : -1)) % (W + 60)) - 30; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18 + (i % 3) * 8, y); c.stroke(); }
    // light rays
    if (this.hasFx('fx_rays') || theme === 'reef') {
      for (let i = 0; i < 6; i++) {
        const x = W * (.1 + i * .17) + Math.sin(t * .3 + i) * 20;
        const rg = c.createLinearGradient(x, hz, x + 60, H); rg.addColorStop(0, 'rgba(255,255,230,.16)'); rg.addColorStop(1, 'rgba(255,255,230,0)');
        c.fillStyle = rg; c.beginPath(); c.moveTo(x, hz); c.lineTo(x + 26, hz); c.lineTo(x + 110, H); c.lineTo(x + 40, H); c.closePath(); c.fill();
      }
    }
    // boat & buoy & floats (on the surface)
    if (this.has('dc_boat')) this.boat(c, W * .44, hz, t);
    if (this.has('dc_buoy')) this.buoy(c, W * .64, hz, t);
    if (this.has('dc_floats')) this.floats(c, W, hz, t);
    // sea floor
    c.fillStyle = P.floor; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, H - H * .08 - Math.sin(x * .02) * 6 - Math.sin(x * .007 + 2) * 8);
    c.lineTo(W, H); c.closePath(); c.fill();
    if (theme === 'reef' || this.has('dc_coral')) this.coral(c, W * .5, H, t);
    if (this.has('dc_rock')) { this.rock(c, W * .2, H, 46); this.rock(c, W * .82, H, 34); }
    if (this.has('dc_weed')) for (const x of [.08, .3, .7, .94]) this.weed(c, W * x, H, t, x);
    if (this.has('dc_chest')) this.chest(c, W * .66, H, t);
    if (this.has('dc_anchor')) this.anchor(c, W * .9, H);
    if (this.has('dc_trophy')) this.trophy(c, W * .36, H, t);
    // fish
    const order = this.fish.slice().sort((a, b) => a.size - b.size);
    for (const f of order) {
      const sp = SPI[f.sp]; if (!sp) continue;
      if (!still && !this.reduce) {
        const benthic = sp.sh === 'octopus' || sp.sh === 'flat' || sp.sh === 'ray';
        if (!benthic) {
          f.x += f.v * dt * .06 * (f === this.hover ? .25 : 1);
          if (f.x < f.size * .5) { f.x = f.size * .5; f.v = Math.abs(f.v); }
          if (f.x > W - f.size * .5) { f.x = W - f.size * .5; f.v = -Math.abs(f.v); }
          f.y = f.by + Math.sin(t * .8 + f.ph) * 10;
        } else { f.x += Math.sin(t * .2 + f.ph) * .05; }
      }
      c.save();
      if (f === this.hover) { c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 18; }
      FD.draw(c, sp, f.x, f.y, f.size, { flip: f.v < 0 && sp.sh !== 'octopus', t: t + f.ph, still: this.reduce });
      c.restore();
    }
    // jellyfish & turtle
    if (this.has('dc_jelly')) this.jelly(c, W, H, hz, t);
    if (this.has('dc_turtle')) this.turtle(c, W, H, hz, t);
    // particles
    if (this.hasFx('fx_bubbles') || true) this.bubbles(c, W, H, hz, t);
    if (this.hasFx('fx_plankton')) this.plankton(c, W, H, hz, t);
    if (theme === 'sakura') this.petals(c, W, H, t);
    if (theme === 'aurora') this.snow(c, W, hz, t);
    // vignette
    const vg = c.createRadialGradient(W / 2, H * .6, Math.min(W, H) * .3, W / 2, H * .6, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  tetrapods(c, x0, hz, w) {
    c.fillStyle = '#5f666b'; c.beginPath(); c.moveTo(x0 - 20, hz + 4); c.lineTo(x0 + w, hz + 4); c.lineTo(x0 + w * .92, hz - 12); c.lineTo(x0 - 20, hz - 12); c.closePath(); c.fill();
    c.lineCap = 'round';
    const one = (x, y, s, rot, shadeCol, lightCol) => {
      c.save(); c.translate(x, y); c.rotate(rot);
      const legs = [[0, -1], [-.87, .5], [.87, .5], [0, .15]];
      legs.forEach(([dx, dy], i) => { c.strokeStyle = i === 3 ? shadeCol : lightCol; c.lineWidth = s * (i === 3 ? .42 : .5); c.beginPath(); c.moveTo(0, 0); c.lineTo(dx * s, dy * s); c.stroke(); });
      c.fillStyle = lightCol; c.beginPath(); c.arc(0, 0, s * .3, 0, Math.PI * 2); c.fill();
      c.restore();
    };
    for (let i = 0; i < 7; i++) {
      const x = x0 + 4 + i * w / 7, y = hz - 18 - (i % 2) * 7;
      one(x, y, 10 + (i % 3), i * .9 + .3, '#7c8387', i % 2 ? '#a3a9ad' : '#b7bcbf');
    }
  }
  lighthouse(c, x, hz, t) {
    c.fillStyle = '#5a5f63'; c.fillRect(x - 40, hz - 8, 80, 10);
    const h = 64;
    c.fillStyle = '#e8eef0'; c.beginPath(); c.moveTo(x - 10, hz - 8); c.lineTo(x + 10, hz - 8); c.lineTo(x + 7, hz - 8 - h); c.lineTo(x - 7, hz - 8 - h); c.closePath(); c.fill();
    c.fillStyle = '#d23a2e'; for (let i = 0; i < 3; i++) { const y = hz - 8 - h * (.15 + i * .3); c.fillRect(x - 9 + i * .9, y - 7, 18 - i * 1.8, 8); }
    c.fillStyle = '#26303a'; c.fillRect(x - 9, hz - 8 - h - 12, 18, 12);
    c.fillStyle = '#ffe9a8'; c.fillRect(x - 6, hz - 8 - h - 10, 12, 8);
    const a = t * 1.2;
    c.save(); c.translate(x, hz - 8 - h - 6); c.rotate(Math.sin(a) * .6);
    const bg = c.createLinearGradient(0, 0, 220, 0); bg.addColorStop(0, 'rgba(255,240,180,.5)'); bg.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = bg; c.beginPath(); c.moveTo(0, 0); c.lineTo(220, -28); c.lineTo(220, 28); c.closePath(); c.fill();
    c.restore();
  }
  boat(c, x, hz, t) {
    const y = hz + Math.sin(t * 1.4) * 2.5;
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.1) * .04);
    c.fillStyle = '#f2efe6'; c.beginPath(); c.moveTo(-46, -6); c.lineTo(46, -10); c.lineTo(34, 8); c.lineTo(-38, 8); c.closePath(); c.fill();
    c.fillStyle = '#1e5a8a'; c.fillRect(-40, 2, 76, 5);
    c.fillStyle = '#e8e4da'; c.fillRect(-10, -26, 26, 18); c.fillStyle = '#2a3a48'; c.fillRect(-6, -22, 8, 6); c.fillRect(6, -22, 7, 6);
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-26, -8); c.lineTo(-26, -40); c.stroke();
    c.strokeStyle = 'rgba(60,60,60,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-26, -40); c.lineTo(-60, 30); c.stroke();
    c.restore();
  }
  buoy(c, x, hz, t) {
    const y = hz + Math.sin(t * 1.8 + 1) * 3;
    c.fillStyle = '#ff6a2a'; c.beginPath(); c.arc(x, y, 10, Math.PI, 0); c.fill();
    c.fillStyle = '#fff'; c.fillRect(x - 10, y - 3, 20, 3);
    c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x, y - 22); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, this.H * .9); c.stroke();
  }
  floats(c, W, hz, t) {
    const cols = ['#ff5a1f', '#ffd23f', '#3fb6d8', '#ff5a1f', '#9be15d'];
    for (let i = 0; i < 5; i++) {
      const x = W * (.24 + i * .1), y = hz + 2 + Math.sin(t * 2 + i) * 2;
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y + 12); c.lineTo(x + Math.sin(t + i) * 4, y + 70 + i * 10); c.stroke();
      c.fillStyle = cols[i]; c.beginPath(); c.ellipse(x, y - 4, 3, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#16202a'; c.beginPath(); c.ellipse(x, y + 6, 2.5, 6, 0, 0, Math.PI * 2); c.fill();
    }
  }
  rock(c, x, H, s) {
    c.fillStyle = '#3e4a50'; c.beginPath(); c.moveTo(x - s, H); c.quadraticCurveTo(x - s * .9, H - s * .9, x - s * .1, H - s); c.quadraticCurveTo(x + s * .8, H - s * .9, x + s, H); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(x - s * .3, H - s * .7, s * .3, s * .12, -.4, 0, Math.PI * 2); c.fill();
  }
  weed(c, x, H, t, k) {
    for (let j = 0; j < 3; j++) {
      c.strokeStyle = j % 2 ? '#2f7a4a' : '#3f9a5a'; c.lineWidth = 4 - j; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + j * 5, H - 6);
      for (let i = 1; i <= 8; i++) c.lineTo(x + j * 5 + Math.sin(t * 1.3 + i * .6 + k * 9 + j) * i * 1.6, H - 6 - i * (12 + j * 2));
      c.stroke();
    }
  }
  coral(c, x, H, t) {
    const cols = ['#ff7a8a', '#ffb05a', '#c86ad8', '#ff8a5a'];
    for (let k = 0; k < 4; k++) {
      c.strokeStyle = cols[k]; c.lineWidth = 5; c.lineCap = 'round';
      const bx = x + (k - 1.5) * 34;
      const br = (px, py, len, ang, d) => { if (d > 3) return; const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke(); br(ex, ey, len * .72, ang - .5, d + 1); br(ex, ey, len * .72, ang + .45, d + 1); };
      br(bx, H - 8, 18 + k * 2, -Math.PI / 2 + Math.sin(t * .4 + k) * .03, 0);
    }
  }
  chest(c, x, H, t) {
    c.fillStyle = '#7a4a24'; c.fillRect(x - 18, H - 28, 36, 20);
    c.fillStyle = '#8e5a2c'; c.beginPath(); c.moveTo(x - 18, H - 28); c.quadraticCurveTo(x, H - 42, x + 18, H - 28); c.closePath(); c.fill();
    c.fillStyle = '#d8b24a'; c.fillRect(x - 3, H - 30, 6, 8);
    const gl = c.createRadialGradient(x, H - 30, 1, x, H - 30, 28); gl.addColorStop(0, `rgba(255,220,120,${.35 + .2 * Math.sin(t * 2)})`); gl.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = gl; c.fillRect(x - 30, H - 60, 60, 60);
  }
  anchor(c, x, H) {
    c.strokeStyle = '#5a6066'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, H - 50); c.lineTo(x, H - 12); c.stroke();
    c.beginPath(); c.arc(x, H - 26, 16, .2, Math.PI - .2); c.stroke();
    c.beginPath(); c.arc(x, H - 54, 5, 0, Math.PI * 2); c.stroke();
  }
  trophy(c, x, H, t) {
    const y = H - 16;
    const g = c.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, '#a87a1a'); g.addColorStop(.5, '#ffe08a'); g.addColorStop(1, '#a87a1a');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 14, y - 40); c.lineTo(x + 14, y - 40); c.quadraticCurveTo(x + 12, y - 18, x, y - 16); c.quadraticCurveTo(x - 12, y - 18, x - 14, y - 40); c.fill();
    c.fillRect(x - 3, y - 16, 6, 8); c.fillRect(x - 10, y - 8, 20, 6);
    const gl = c.createRadialGradient(x, y - 30, 1, x, y - 30, 40); gl.addColorStop(0, `rgba(255,230,140,${.3 + .15 * Math.sin(t * 1.5)})`); gl.addColorStop(1, 'rgba(255,230,140,0)'); c.fillStyle = gl; c.fillRect(x - 40, y - 70, 80, 80);
  }
  jelly(c, W, H, hz, t) {
    for (let i = 0; i < 3; i++) {
      const x = W * (.2 + i * .28) + Math.sin(t * .3 + i * 2) * 30, y = hz + (H - hz) * (.25 + .15 * i) + Math.sin(t * .9 + i) * 14;
      const p = 1 + Math.sin(t * 2.2 + i) * .08;
      const g = c.createRadialGradient(x, y, 1, x, y, 22); g.addColorStop(0, 'rgba(255,200,255,.75)'); g.addColorStop(1, 'rgba(200,140,255,.15)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 14 * p, 10 / p, 0, Math.PI, 0); c.fill();
      c.strokeStyle = 'rgba(230,190,255,.5)'; c.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * 5, y); c.quadraticCurveTo(x + k * 5 + Math.sin(t * 2 + k) * 5, y + 16, x + k * 4, y + 30); c.stroke(); }
    }
  }
  turtle(c, W, H, hz, t) {
    const span = W + 160, x = ((t * 18) % span) - 80, y = hz + (H - hz) * .3 + Math.sin(t * .5) * 10;
    c.save(); c.translate(x, y);
    c.fillStyle = '#6a8a4a'; const fl = Math.sin(t * 2) * .4;
    for (const [dx, dy, s] of [[12, -9, 1], [12, 9, 1], [-12, -7, .6], [-12, 7, .6]]) { c.save(); c.translate(dx, dy); c.rotate((dy < 0 ? -1 : 1) * (.6 + fl * s)); c.beginPath(); c.ellipse(4, 0, 10 * s, 3.5 * s, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.fillStyle = '#7a9a5a'; c.beginPath(); c.ellipse(24, 0, 6, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a6a3a'; c.beginPath(); c.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(30,40,20,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-10, -6); c.lineTo(10, 6); c.moveTo(-10, 6); c.lineTo(10, -6); c.stroke();
    c.restore();
  }
  bubbles(c, W, H, hz, t) {
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const speed = 18 + (i % 5) * 6, span = H - hz;
      const y = H - ((t * speed + i * 53) % span), x = W * ((i * 0.137) % 1) + Math.sin(t * 2 + i) * 4;
      c.beginPath(); c.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); c.stroke();
    }
  }
  plankton(c, W, H, hz, t) {
    for (let i = 0; i < 40; i++) {
      const x = (W * ((i * .618) % 1) + Math.sin(t * .4 + i) * 20 + W) % W, y = hz + (H - hz) * ((i * .382) % 1) + Math.cos(t * .5 + i) * 10;
      c.fillStyle = `rgba(120,255,230,${.25 + .5 * Math.abs(Math.sin(t * 1.5 + i))})`; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
    }
  }
  petals(c, W, H, t) {
    c.fillStyle = 'rgba(255,190,210,.85)';
    for (let i = 0; i < 18; i++) { const x = (W * ((i * .23) % 1) + t * 20 + Math.sin(t + i) * 20) % W, y = ((t * 26 + i * 41) % (this.hz + 20)) - 10; c.save(); c.translate(x, y); c.rotate(t + i); c.beginPath(); c.ellipse(0, 0, 3.5, 2, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  }
  snow(c, W, hz, t) {
    c.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 26; i++) { const x = (W * ((i * .31) % 1) + Math.sin(t * .6 + i) * 10) % W, y = (t * 14 + i * 29) % hz; c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
  }
}
