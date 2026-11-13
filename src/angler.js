/* ===== 찌릿 라이브: the angler on the map =====
   The player's own character (the one made in the profile: skin, hair, hat, clothes, rod) stands on the map as a whole
   figure and moves: it walks to where it stands, casts, waits, jolts when the bite comes (찌릿!), strikes, leans into the
   fight and holds the fish up. It is a small jointed figure posed in 3D — x to its right, y ahead, z up, in units; the
   figure is about 10 units tall — and drawn on the map's own canvas, turned by where it faces and tilted like the map. */
const ANG = (() => {
  const TAU = Math.PI * 2, RAD = Math.PI / 180, OL = '#131B2E';
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), mixn = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = cl(t, 0, 1); return t * t * (3 - 2 * t); };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], lerp3 = (a, b, t) => [mixn(a[0], b[0], t), mixn(a[1], b[1], t), mixn(a[2], b[2], t)];
  // the middle joint of a two-bone limb (a: root, b: end, la/lb: bone lengths, pole: which way the joint bends)
  function joint(a, b, la, lb, pole) {
    const d0 = sub(b, a), D = cl(len(d0), .05, la + lb - .02), u = unit(d0), x = (la * la - lb * lb + D * D) / (2 * D), h = Math.sqrt(Math.max(0, la * la - x * x));
    const w = unit(sub(pole, mul(u, dot(pole, u))));
    return add(add(a, mul(u, x)), mul(w, h));
  }
  // lean: turn a point about the hips (around the figure's left-right axis; positive leans ahead)
  const leanP = (p, hip, a) => { const y = p[1] - hip[1], z = p[2] - hip[2], c = Math.cos(a), s = Math.sin(a); return [p[0], hip[1] + y * c + z * s, hip[2] - y * s + z * c]; };
  const dirOf = (elev, yaw) => [Math.sin(yaw) * Math.cos(elev), Math.cos(yaw) * Math.cos(elev), Math.sin(elev)];

  /* what the figure wears, from the profile character */
  const _look = new Map();
  function look(cfg) {
    const c = CH.norm(cfg || {}), key = JSON.stringify(c); let L = _look.get(key); if (L) return L;
    const G = c.gr && typeof ZL !== 'undefined' && ZL.BY[c.gr], rod = G ? G.rodC : CH.ROD[c.rd] || CH.ROD.carbon, light = '#E9EEF2';
    const body = c.ou === 'life' ? '#FF6A1F' : c.ou === 'wet' ? '#23272E' : c.ou === 'captain' ? '#1F2B45' : c.ouc;
    const sleeve = c.ou === 'tee' ? null : c.ou === 'vest' || c.ou === 'life' ? light : body;
    L = { skin: CH.SKIN[c.sk], hair: CH.HAIRC[c.hc][0], hat: c.ht, hatC: c.ht === 'straw' ? '#F0D58C' : c.ht === 'captain' ? '#F7F7F2' : c.htc, band: c.htc, body, sleeve,
      pants: c.ou === 'wet' ? '#23272E' : c.ou === 'captain' ? '#1F2B45' : '#2E3A5C', boot: c.ou === 'rain' ? c.ouc : '#3A3F4B', rod, sig: !!(G && G.sig), long: ['long', 'pony', 'bob', 'wave'].includes(c.hs), hs: c.hs };
    if (_look.size > 40) _look.clear(); _look.set(key, L); return L;
  }

  /* --- the pose: where the hands, the feet and the rod are for what the angler is doing ---
     in: { act, t (s since it began), T (clock, s), tension 0..1, pull, reel, side -1..1, dip 0..1, walk 0..1 } */
  function pose(i) {
    const T = i.T, a = i.act, t = i.t;
    const P = { hip: [0, 0, 2.6 + Math.sin(T * 2) * .05], lean: 0, fl: [-.85, 0, 0], fr: [.85, 0, 0], hr: [1.75, .7, 3.5], hl: [-1.8, .15, 2.8 + Math.sin(T * 2 + 1) * .04],
      elev: 78 * RAD, yaw: 8 * RAD, two: false, bend: 0, head: Math.sin(T * .45) * .4, nod: 0, hop: 0, shake: 0, spark: 0, cheer: 0 };
    if (a === 'walk') {
      const w = T * 10, s = Math.sin(w), k = i.walk == null ? 1 : i.walk;
      P.fl = [-.8, s * .95 * k, Math.max(0, Math.cos(w)) * .6 * k]; P.fr = [.8, -s * .95 * k, Math.max(0, -Math.cos(w)) * .6 * k];
      P.hip = [0, 0, 2.55 + Math.abs(Math.cos(w)) * .16 * k]; P.lean = .13 * k; P.hl = [-1.8, -s * .85 * k, 2.9]; P.hr = [1.7, .75 + s * .2 * k, 3.5]; P.elev = (74 + s * 3) * RAD; P.head = 0;
    } else if (a === 'cast') {
      // wind up over the shoulder, whip ahead, follow through
      const u1 = ease(t / .36), u2 = ease((t - .36) / .17), u3 = ease((t - .53) / .4);
      P.two = true; P.elev = (mixn(mixn(78, 128, u1), 26, u2) + 12 * u3) * RAD; P.yaw = mixn(8, 0, u1) * RAD;
      P.hr = lerp3(lerp3([1.75, .7, 3.5], [.95, -.7, 6.1], u1), [.75, 1.9, 4.5], u2); P.lean = mixn(mixn(0, -.24, u1), .3, u2) - .16 * u3;
      P.fl = [-.85, .75 * u2, Math.sin(u2 * Math.PI) * .35]; P.bend = Math.sin(cl((t - .36) / .3, 0, 1) * Math.PI) * -.9; P.head = 0; P.hip[2] -= .15 * u1 - .1 * u2;
    } else if (a === 'wait') {
      const sway = Math.sin(T * 1.1) * .05, dip = i.dip || 0;
      P.two = true; P.elev = (36 + Math.sin(T * .9) * 2 - dip * 9) * RAD; P.yaw = sway; P.hr = [.95, 1.0, 3.75 + sway]; P.lean = .06 + dip * .05; P.fl = [-.95, .35, 0]; P.fr = [.9, -.2, 0];
      P.head = Math.sin(T * .31) * .22 * (1 - dip); P.bend = dip * .25;
    } else if (a === 'bite') {
      // the jolt: a hop, a shiver, sparks
      const j = cl(t / .32, 0, 1), d = Math.exp(-t * 3.2);
      P.two = true; P.elev = (30 - 4 * d) * RAD; P.hr = [.95, 1.05, 3.9 + .5 * d]; P.hop = Math.sin(j * Math.PI) * .7; P.shake = Math.sin(t * 75) * .13 * d; P.spark = cl(1.4 - t * 1.2, 0, 1);
      P.fl = [-1.0, .35, 0]; P.fr = [.95, -.2, 0]; P.lean = -.1 * d; P.bend = .5; P.head = 0;
    } else if (a === 'hook') {
      const u = ease(t / .16);
      P.two = true; P.elev = mixn(34, 84, u) * RAD; P.hr = lerp3([.95, 1.0, 3.8], [.9, .45, 5.1], u); P.lean = -.3 * u; P.bend = .9 * u; P.fl = [-1.0, .5, 0]; P.fr = [1.0, -.45, 0]; P.head = 0;
    } else if (a === 'fight' || a === 'landing') {
      const tn = cl(i.tension || 0, 0, 1), pl = i.pull ? 1 : 0, w = T * 16, up = a === 'landing' ? ease(t / .5) : 0;
      P.two = true; P.elev = (66 - 22 * pl + 8 * tn + 14 * up) * RAD; P.yaw = (i.side || 0) * .45; P.bend = .35 + .65 * tn + .25 * pl;
      P.lean = -(.14 + .3 * tn) + .34 * pl; P.hip = [0, -.25 * tn + .3 * pl, 2.6 - .42 * tn - .1 * pl]; P.fl = [-1.05, .7, 0]; P.fr = [1.05, -.55, 0];
      P.hr = [.85, .55 + .25 * pl, 4.1 + .5 * up]; P.reelA = i.reel ? w : null; P.shake = pl ? Math.sin(T * 40) * .05 : 0; P.head = (i.side || 0) * .3;
    } else if (a === 'result') {
      // turned to the camera, the fish held up, a few hops
      const d = Math.exp(-t * .9), h = Math.abs(Math.sin(t * 6.5)) * .75 * d;
      P.hop = h; P.cheer = 1; P.hr = [1.7, .55, 3.6]; P.elev = 80 * RAD; P.hl = [-2.5, .5, 7.0 + h * .3]; P.head = 0; P.nod = -.12; P.hip[2] += .05;
    } else if (a === 'lose') {
      const u = ease(t / .35);
      P.elev = mixn(60, 12, u) * RAD; P.hr = [1.6, .9, 3.2 - .3 * u]; P.hl = [-1.7, .3, 2.5]; P.lean = .16 * u; P.nod = .5 * u; P.head = 0; P.hip[2] -= .12 * u;
    }
    return P;
  }

  /* --- drawing --- */
  // a filled part of the head's ball: everything on the pole's side of a plane (z0: how far up the pole the plane sits, 0 = half)
  function ballCap(c, cx, cy, R, hx, hy, hv, z0, fill) {
    const s = Math.hypot(hx, hy); if (s < 1e-4 && hv < 0) return;
    const ux = s < 1e-4 ? 0 : hx / s, uy = s < 1e-4 ? -1 : hy / s, ang = Math.atan2(uy, ux), rho = Math.sqrt(Math.max(.01, 1 - z0 * z0)), ex = cx + hx * z0 * R, ey = cy + hy * z0 * R;
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
    c.beginPath(); c.ellipse(ex, ey, Math.max(.05, rho * R * Math.abs(hv)), rho * R, ang, Math.PI / 2, -Math.PI / 2, hv <= 0);
    const px = -uy * rho * R, py = ux * rho * R;
    c.lineTo(ex - px + ux * 3 * R, ey - py + uy * 3 * R); c.lineTo(ex + px + ux * 3 * R, ey + py + uy * 3 * R); c.closePath();
    c.fillStyle = fill; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.1; c.stroke();
    c.restore();
  }
  const shadeC = (h, a) => (typeof FD !== 'undefined' ? FD.shade(h, a) : h);

  /* o: { x, y (px, the ground under the feet), k (px per unit), yaw (deg, where it faces), bearing, pitch (deg, the map's),
          look, mode ('site' | 'remote'), in (pose input), fish: { sp } }
     returns the rod tip on the screen: { x, y } */
  function draw(c, o) {
    const K = o.k, L = o.look, th = cl(o.pitch, 0, 80) * RAD, ct = Math.cos(th), st = Math.sin(th), al = (o.yaw - o.bearing) * RAD, ca = Math.cos(al), sa = Math.sin(al);
    const P = pose(o.in), T = o.in.T; P.hip = add(P.hip, [0, 0, .3]);
    // figure → screen. depth grows toward the camera.
    const pr = p => { const r = p[0] * ca + p[1] * sa, f = -p[0] * sa + p[1] * ca; return [o.x + K * r, o.y - K * (f * ct + p[2] * st), -f * st + p[2] * ct]; };
    const vv = p => (-(-p[0] * sa + p[1] * ca)) * st + p[2] * ct; // how much a direction points at the camera
    const hop = [P.shake || 0, 0, P.hop || 0];
    const hip = add(P.hip, hop), up = p => leanP(p, P.hip, P.lean);
    const upH = p => add(leanP(p, P.hip, P.lean), hop);
    const chest = upH(add(P.hip, [0, 0, 2.25])), shL = upH(add(P.hip, [-1.5, 0, 2.2])), shR = upH(add(P.hip, [1.5, 0, 2.2]));
    const headC = upH(add(P.hip, [0, .12 + (P.nod || 0) * 1.2, 4.45 - Math.abs(P.nod || 0) * .5]));
    const hipL = add(hip, [-.72, 0, -.15]), hipR = add(hip, [.72, 0, -.15]);
    const fl = add(P.fl, [P.shake || 0, 0, (P.hop || 0) * .9]), fr = add(P.fr, [P.shake || 0, 0, (P.hop || 0) * .9]);
    const kL = joint(hipL, add(fl, [0, 0, .35]), 1.45, 1.45, [0, 1, .2]), kR = joint(hipR, add(fr, [0, 0, .35]), 1.45, 1.45, [0, 1, .2]);
    // the rod: the right hand holds the butt; the left hand a little up the rod (or winds the reel)
    const D = dirOf(P.elev, P.yaw), hr = add(up(P.hr), hop), butt = sub(hr, mul(D, .7)), RL = 10.5;
    const reelC = add(add(butt, mul(D, 1.55)), [-.55, 0, -.25]);
    let hl = P.two ? add(butt, mul(D, 2.2)) : add(up(P.hl), hop);
    if (P.reelA != null) hl = add(reelC, [0, Math.cos(P.reelA) * .42, Math.sin(P.reelA) * .42]); else if (P.two && (o.in.act === 'fight' || o.in.act === 'landing')) hl = reelC;
    if (P.cheer) hl = add(P.hl, hop);
    const eL = joint(shL, hl, 1.35, 1.35, [-1, -.4, -.8]), eR = joint(shR, hr, 1.35, 1.35, [1, -.4, -.8]);
    // the bent rod: the tip gives toward the pull (ahead and down), or whips back in a cast
    const tip0 = add(butt, mul(D, RL)), bendV = P.bend >= 0 ? [Math.sin(P.yaw) * .5, Math.cos(P.yaw) * .55, -.85] : [0, -.8, -.3];
    const tip = add(tip0, mul(bendV, Math.abs(P.bend) * 3.4)), mid = add(butt, mul(D, RL * .62));

    const parts = [];
    const limb = (pts, w, col, d) => parts.push({ d, f() { c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.strokeStyle = OL; c.lineWidth = w * K + 2.2; c.stroke(); c.strokeStyle = col; c.lineWidth = w * K; c.stroke(); } });
    const pj = a => a.map(pr);
    // legs and boots
    for (const [h0, k0, f0, side] of [[hipL, kL, fl, -1], [hipR, kR, fr, 1]]) {
      const q = pj([h0, k0, add(f0, [0, 0, .45])]), toe = pr(add(f0, [0, .62, .28])), heel = pr(add(f0, [0, -.2, .28]));
      limb(q, 1.22, L.pants, (q[1][2] + q[2][2]) / 2 - .2);
      parts.push({ d: q[2][2] - .25 + side * .001, f() { c.lineCap = 'round'; c.beginPath(); c.moveTo(heel[0], heel[1]); c.lineTo(toe[0], toe[1]); c.strokeStyle = OL; c.lineWidth = 1.3 * K + 2.2; c.stroke(); c.strokeStyle = L.boot; c.lineWidth = 1.3 * K; c.stroke(); } });
    }
    // the body: a bean from the hips to the chest, the 찌릿 bolt on its back
    {
      const a = pr(add(hip, [0, 0, .15])), b = pr(chest), back = upH(add(P.hip, [0, -1.55, 1.25])), bv = vv([0, -Math.cos(P.lean), Math.sin(P.lean)]);
      parts.push({ d: (a[2] + b[2]) / 2, f() {
        c.lineCap = 'round'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.strokeStyle = OL; c.lineWidth = 3.3 * K + 2.4; c.stroke(); c.strokeStyle = L.body; c.lineWidth = 3.3 * K; c.stroke();
        // a lighter band of light down the side that faces up
        c.beginPath(); c.moveTo(a[0] - K * .5, a[1] - K * .2); c.lineTo(b[0] - K * .5, b[1] - K * .1); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = K * 1.1; c.stroke();
        if (bv > .12) {
          const p0 = pr(back), rx = pr(add(back, [1, 0, 0])), uz = pr(add(back, [0, 0, 1]));
          c.save(); c.transform((rx[0] - p0[0]), (rx[1] - p0[1]), -(uz[0] - p0[0]), -(uz[1] - p0[1]), p0[0], p0[1]); c.globalAlpha = cl(bv * 2.2, 0, 1);
          c.beginPath(); c.moveTo(.28, -1.0); c.lineTo(-.5, .12); c.lineTo(-.02, .12); c.lineTo(-.3, 1.0); c.lineTo(.52, -.2); c.lineTo(.04, -.2); c.closePath();
          c.fillStyle = '#EAF4FF'; c.fill(); c.strokeStyle = 'rgba(19,27,46,.55)'; c.lineWidth = .1; c.stroke(); c.restore();
        }
      } });
    }
    // arms and hands
    for (const [s0, e0, h0] of [[shL, eL, hl], [shR, eR, hr]]) {
      const q = pj([s0, e0, h0]);
      limb(q, .98, L.sleeve || L.skin, (q[0][2] + q[2][2]) / 2 + .1);
      parts.push({ d: q[2][2] + .3, f() { c.beginPath(); c.arc(q[2][0], q[2][1], .58 * K, 0, TAU); c.fillStyle = L.skin; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.1; c.stroke(); } });
    }
    // the rod and its reel
    const sb = pr(butt), sm = pr(mid), stp = pr(tip), sg = pr(add(butt, mul(D, 2.6))), srl = pr(reelC);
    parts.push({ d: pr(add(butt, mul(D, 2)))[2] + .2, f() {
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(sb[0], sb[1]); c.quadraticCurveTo(sm[0], sm[1], stp[0], stp[1]); c.strokeStyle = OL; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = L.rod[0]; c.lineWidth = 1.9; c.stroke();
      c.beginPath(); c.moveTo(sb[0], sb[1]); c.lineTo(sg[0], sg[1]); c.strokeStyle = OL; c.lineWidth = 5; c.stroke(); c.strokeStyle = L.rod[1]; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.arc(srl[0], srl[1], .5 * K, 0, TAU); c.fillStyle = '#C9D3E0'; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.1; c.stroke();
      if (L.sig) { c.beginPath(); c.arc(stp[0], stp[1], 2.4, 0, TAU); c.fillStyle = '#7CC4FF'; c.fill(); }
    } });
    // the head: ball, face, hair, hat
    {
      const R = 2.35, hy = (P.head || 0), fw = [Math.sin(hy), Math.cos(hy) * Math.cos(P.nod || 0), -Math.sin(P.nod || 0)], rt = [Math.cos(hy), -Math.sin(hy), 0], upv = [0, Math.sin(P.nod || 0) * .6, 1];
      const hc = pr(headC), sx = v => { const a = pr(add(headC, v)); return [a[0] - hc[0], a[1] - hc[1]]; };
      const facing = vv(fw), hairPole = unit(add(mul(fw, -.72), [0, 0, .7])), hp = sx(hairPole), hpv = vv(hairPole), upP = sx(unit(upv)), upV = vv(unit(upv));
      const hatK = L.hat, dome = ['cap', 'bucket', 'beanie', 'straw', 'captain'].includes(hatK), brimR = hatK === 'bucket' ? 1.3 : hatK === 'straw' ? 1.5 : 0;
      const ring = (cen, ax, ay, n, half) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU, v = add(cen, add(mul(ax, Math.cos(a)), mul(ay, Math.sin(a)))); const q = pr(add(headC, v)); if (!half || q[2] >= half) pts.push(q); } return pts; };
      const poly = (pts, fill) => { if (pts.length < 3) return; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.1; c.stroke(); };
      const capBrim = () => poly(ring(add(mul(upv, R * .4), mul(fw, R * 1.02)), mul(rt, R * .92), mul(fw, R * .66), 20), shadeC(hatK === 'captain' ? '#121822' : L.hatC === '#F7F7F2' ? '#D5DAE2' : L.hatC, -.22));
      const front = hatK === 'cap' || hatK === 'visor' || hatK === 'captain';
      parts.push({ d: hc[2] + 1.2, f() {
        const Rk = R * K;
        if (L.long) { const b = pr(add(headC, add(mul(fw, -R * .55), [0, 0, -R * .75]))); c.beginPath(); c.arc(b[0], b[1], Rk * .78, 0, TAU); c.fillStyle = L.hair; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.1; c.stroke(); }
        if (brimR) poly(ring(mul(upv, R * .2), mul(rt, R * brimR), mul(fw, R * brimR), 28), shadeC(L.hatC, -.16));
        if (front && facing <= 0) capBrim();
        c.beginPath(); c.arc(hc[0], hc[1], Rk, 0, TAU); c.fillStyle = L.skin; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke();
        // the face is a small flat picture on the front of the ball
        if (facing > .06) {
          const f0 = pr(add(headC, mul(fw, R * .8))), rx = sx(rt), uy = sx(unit(upv));
          c.save(); c.beginPath(); c.arc(hc[0], hc[1], Rk - .6, 0, TAU); c.clip();
          c.transform(rx[0], rx[1], -uy[0], -uy[1], f0[0], f0[1]); c.globalAlpha = cl(facing * 3, 0, 1);
          const blink = (T % 3.7) < .12 || o.in.act === 'result';
          c.fillStyle = 'rgba(255,120,120,.4)'; c.beginPath(); c.ellipse(-1.22, .42, .42, .26, 0, 0, TAU); c.ellipse(1.22, .42, .42, .26, 0, 0, TAU); c.fill();
          c.strokeStyle = OL; c.fillStyle = OL; c.lineWidth = .2; c.lineCap = 'round';
          if (blink) { for (const s of [-1, 1]) { c.beginPath(); c.arc(s * .78, -.02, .3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } }
          else if (o.in.act === 'bite') { for (const s of [-1, 1]) { c.beginPath(); c.arc(s * .78, -.1, .4, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.stroke(); c.beginPath(); c.arc(s * .78, -.1, .14, 0, TAU); c.fillStyle = OL; c.fill(); } }
          else { for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * .78, -.08, .26, .33, 0, 0, TAU); c.fill(); } c.fillStyle = '#fff'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * .78 + .09, -.19, .09, 0, TAU); c.fill(); } }
          c.strokeStyle = OL; c.lineWidth = .18; c.beginPath();
          if (o.in.act === 'bite') c.ellipse(0, .62, .2, .26, 0, 0, TAU); else if (o.in.act === 'result') { c.moveTo(-.42, .5); c.quadraticCurveTo(0, 1.05, .42, .5); c.closePath(); c.fillStyle = '#8A2B3C'; c.fill(); } else if (o.in.act === 'lose') c.arc(0, .86, .3, Math.PI * 1.15, Math.PI * 1.85); else c.arc(0, .42, .32, Math.PI * .15, Math.PI * .85);
          c.stroke(); c.restore();
        }
        if (hatK !== 'beanie') ballCap(c, hc[0], hc[1], Rk * 1.03, hp[0] / K, hp[1] / K, hpv, .02, L.hair);
        if (brimR) { poly(ring(mul(upv, R * .2), mul(rt, R * brimR), mul(fw, R * brimR), 28, pr(add(headC, mul(upv, R * .2)))[2]), shadeC(L.hatC, -.16)); }
        if (front && facing > 0) capBrim();
        if (dome) {
          const z0 = hatK === 'beanie' ? .36 : hatK === 'captain' ? .46 : .42, rr = hatK === 'beanie' ? 1.1 : 1.07;
          ballCap(c, hc[0], hc[1], Rk * rr, upP[0] / K, upP[1] / K, upV, z0, L.hatC);
          if (hatK === 'beanie') { const q = pr(add(headC, mul(unit(upv), R * 1.22))); c.beginPath(); c.arc(q[0], q[1], Rk * .3, 0, TAU); c.fillStyle = shadeC(L.hatC, .3); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.1; c.stroke(); }
          if (hatK === 'cap') { const q = pr(add(headC, mul(unit(upv), R * 1.08))); c.beginPath(); c.arc(q[0], q[1], Rk * .1, 0, TAU); c.fillStyle = shadeC(L.hatC, -.25); c.fill(); }
        } else if (hatK === 'visor' || hatK === 'band') {
          const q = ring(mul(upv, R * .38), mul(rt, R * .93), mul(fw, R * .93), 28, hc[2]); if (q.length > 2) { c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.strokeStyle = OL; c.lineWidth = K * .62 + 2; c.lineCap = 'butt'; c.stroke(); c.strokeStyle = L.hatC; c.lineWidth = K * .62; c.stroke(); }
        }
      } });
    }
    // the fish held up after a catch
    if (P.cheer && o.fish && o.fish.sp && typeof FD !== 'undefined') {
      const h = pr(add(hl, [0, 0, -.2]));
      parts.push({ d: h[2] + 2, f() { c.save(); c.translate(h[0], h[1] + K * 3.3); c.rotate(-Math.PI / 2 + Math.sin(T * 5) * .07); try { FD.draw(c, o.fish.sp, 0, 0, K * 7, { still: true }); } catch (e) { } c.restore(); c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0], h[1] + K * .5); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.stroke(); } });
    }

    // the ground under the feet: a shadow and the ring that says how the angler is here
    c.save();
    c.beginPath(); c.ellipse(o.x, o.y, K * 2.6, K * 2.6 * ct, 0, 0, TAU); c.fillStyle = 'rgba(5,10,19,.34)'; c.fill();
    const pu = .5 + .5 * Math.sin(T * 2.6);
    c.beginPath(); c.ellipse(o.x, o.y, K * (3.3 + pu * .5), K * (3.3 + pu * .5) * ct, 0, 0, TAU); c.strokeStyle = o.mode === 'site' ? `rgba(124,196,255,${.85 - pu * .4})` : `rgba(201,211,224,${.7 - pu * .3})`; c.lineWidth = 1.8; if (o.mode !== 'site') c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
    parts.sort((a, b) => a.d - b.d); for (const p of parts) p.f();
    // 찌릿: sparks over the head when the bite runs up the line
    if (P.spark > 0) {
      const hc = pr(headC); c.lineJoin = 'miter'; c.lineCap = 'butt';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * .55 + Math.sin(T * 31 + i) * .1, r0 = K * 3.1, r1 = K * (4.5 + (i % 2) * .9), x0 = hc[0] + Math.cos(a) * r0, y0 = hc[1] + Math.sin(a) * r0, x1 = hc[0] + Math.cos(a) * r1, y1 = hc[1] + Math.sin(a) * r1;
        const nx = -(y1 - y0) * .22, ny = (x1 - x0) * .22; c.beginPath(); c.moveTo(x0, y0); c.lineTo((x0 * 2 + x1) / 3 + nx, (y0 * 2 + y1) / 3 + ny); c.lineTo((x0 + x1 * 2) / 3 - nx, (y0 + y1 * 2) / 3 - ny); c.lineTo(x1, y1);
        c.globalAlpha = P.spark; c.strokeStyle = 'rgba(90,162,255,.55)'; c.lineWidth = 4.5; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();
      }
    }
    c.restore();
    return { x: stp[0], y: stp[1] };
  }
  return { draw, look, pose };
})();
