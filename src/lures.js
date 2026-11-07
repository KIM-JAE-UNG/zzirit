/* ===== 찌릿 루어: the shop's lures, drawn here as SVG — nose to the right, light from the top left. Each one is built from
   its own body shape and paint (gradients, foil, scales or cloth), a 3D eye and real hardware: split rings, treble hooks
   with barbs, assist hooks on braided cord — and the ZZIRIT mark (traced from the logo) with a spark on its line tie. ZL.url(id): a picture for <img> (cached) · ZL.inner(id, prefix): the same
   drawing to place inside another SVG (the character's line) · ZL.img(id): an Image for canvas. ===== */
const ZL = (() => {
  const st = s => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null && a !== 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const lg = (id, x1, y1, x2, y2, s) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${st(s)}</linearGradient>`;
  const rg = (id, cx, cy, r, s, fx = cx, fy = cy) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${st(s)}</radialGradient>`;
  const n = v => +v.toFixed(2);
  // metal wire: a dark stroke with a thin light line along its upper edge
  const wire = (d, w = 1.5, dark = '#262B33', lite = '#C3CBD6') => `<path d="${d}" fill="none" stroke="${dark}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${lite}" stroke-width="${n(w * .36)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(-.35 -.4)" opacity=".9"/>`;
  const ring = (x, y, rx = 3.3, ry = 3.7) => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="none" stroke="#262B33" stroke-width="1.5"/><path d="M${n(x - rx * .82)} ${n(y - ry * .5)} A${n(rx)} ${n(ry)} 0 0 1 ${n(x + rx * .45)} ${n(y - ry * .88)}" fill="none" stroke="#D5DCE5" stroke-width=".6"/>`;
  // a treble hook hanging from a split ring at (x, y); the third point faces the viewer
  function treble(x, y, s = 1, color) {
    const T = (px, py) => `${n(x + px * s)} ${n(y + py * s)}`;
    const dark = color || '#262B33';
    const left = `M${T(0, 20)} C${T(0, 26.8)} ${T(-3, 29)} ${T(-6.3, 29)} C${T(-9.8, 29)} ${T(-11.5, 26.4)} ${T(-11.3, 22)} L${T(-10.7, 15.4)}`;
    const right = `M${T(0, 20)} C${T(0, 26.8)} ${T(3, 29)} ${T(6.3, 29)} C${T(9.8, 29)} ${T(11.5, 26.4)} ${T(11.3, 22)} L${T(10.7, 15.4)}`;
    const mid = `M${T(0, 20)} C${T(.6, 27.5)} ${T(2.4, 31.4)} ${T(-.8, 32.4)} C${T(-3.4, 33.2)} ${T(-4.6, 30.6)} ${T(-3.9, 27)}`;
    const barbs = `M${T(-10.8, 18.2)} L${T(-8.8, 20.3)} M${T(10.8, 18.2)} L${T(8.8, 20.3)}`;
    return `${wire(mid, 1.3 * s, '#4A515C', '#9AA4B2')}${ring(x, y, 3.2 * s, 3.6 * s)}<circle cx="${n(x)}" cy="${n(y + 6 * s)}" r="${n(1.9 * s)}" fill="none" stroke="${dark}" stroke-width="${n(1.3 * s)}"/>${wire(`M${T(0, 7.9)} L${T(0, 20)}`, 1.6 * s, dark)}${wire(left, 1.5 * s, dark)}${wire(right, 1.5 * s, dark)}${wire(barbs, 1.1 * s, dark)}`;
  }
  function eye(p, x, y, r, c = ['#FFF4BF', '#F2B200', '#8F5A00']) {
    return `${rg(p + 'ey', x - r * .3, y - r * .35, r * 1.05, [[0, c[0]], [.5, c[1]], [1, c[2]]])}<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#0C0F14"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r * .82)}" fill="url(#${p}ey)"/><circle cx="${n(x + r * .12)}" cy="${n(y + r * .08)}" r="${n(r * .44)}" fill="#05070A"/><ellipse cx="${n(x - r * .3)}" cy="${n(y - r * .36)}" rx="${n(r * .27)}" ry="${n(r * .2)}" fill="#fff" opacity=".95"/><circle cx="${n(x + r * .34)}" cy="${n(y + r * .32)}" r="${n(r * .1)}" fill="#fff" opacity=".7"/>`;
  }
  // fine diagonal lines for holographic foil, and fish scales
  const hatch = (id, c, a, gap = 2.2, ang = 62) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${gap}" height="${gap}" patternTransform="rotate(${ang})"><path d="M0 0 V${gap}" stroke="${c}" stroke-width=".55" stroke-opacity="${a}"/></pattern>`;
  const scales = (id, c, a) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="7" height="7"><path d="M0 3.5 A3.5 3.5 0 0 1 7 3.5 M-3.5 7 A3.5 3.5 0 0 1 3.5 7 M3.5 7 A3.5 3.5 0 0 1 10.5 7" fill="none" stroke="${c}" stroke-opacity="${a}" stroke-width=".55"/></pattern>`;
  const gloss = (d, w = 2.4, a = .6) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity="${a}"/>`;

  /* ---------- the ZZIRIT mark, traced from the logo: one silver ribbon that is the fish — its forehead thin at the top
     right, sweeping down to the left and back out as the tail — a blue wave under the tail, the face line and the eye, and
     the line rising to a spark and coming down as the hook in the fish's mouth. Drawn in a 120 × 104 box. Only the
     signature gear carries it (two in each section, and the champion's gold lure), with a spark on its line tie. ---------- */
  const ZZ_FISH = 'M79.2 42.3 C74 40 66 40.2 60.9 40.8 C52 42.4 44 45.4 38.7 48.2 C32 51.8 27 55 22.4 59.3 C16 65.4 11 71 7.7 76.5 C14 80 26 80 39.4 76.7 C45 84 49 91.6 55.4 93.4 C64 95.6 75 93.2 85.8 81.3 C80 85.2 70.2 88.6 64.5 87.9 C52 86.4 40 77 32.1 68.6 C36 60.6 42 53.6 49.3 49.3 C54.6 46.2 60 44.2 65.6 43.2 C70.6 42.4 75.6 42 79.2 42.3 Z';
  const ZZ_FACE = 'M80.2 44.6 C80.4 50.4 78.6 56.4 74.4 61.2 C76.6 62 77.6 60.4 78.6 58.2 C80.2 54 80.8 49.2 80.2 44.6 Z';
  const ZZ_WAVE = 'M7.3 79.2 C17 78.6 25.6 82.2 34.2 87.8 C38 90.6 42 94.6 46 97.4 C51 100.8 57 102.6 62 101.2 C64.6 100.6 67 99.8 69.1 98.7 C66 99.4 61 98.6 58.2 96.9 C52 92 47.4 86 41.7 80.6 C38.8 78 35 75.8 31.6 76.2 C27 77.6 20 78 15 75.8 C12 77 9.6 78.4 7.3 79.2 Z';
  const ZZ_LINE = 'M65.7 28.3 C79 19.6 94 12.2 108.4 9';
  const ZZ_HOOK = 'M110.6 11.4 C109.6 18 101.6 32 93.2 44.6 C91.4 47.6 92.6 51.4 90.2 54.4 C87.6 57.6 83 60.8 78.2 62.8';
  const ZZ_STYLE = {
    silver: { f: [['#FFFFFF'], ['#D9E1EB'], ['#9AA7B8']], w: [['#2563EB'], ['#3B8BFF'], ['#9BD0FF']], eye: '#FFFFFF', ln: '#EEF3F9', sp: '#5AB0FF', edge: '#0B1530' },
    navy: { f: [['#1B3A73'], ['#0E2350'], ['#06143A']], w: [['#1D4ED8'], ['#2F7BFF'], ['#7CC4FF']], eye: '#0E2350', ln: '#0E2350', sp: '#4DA3FF' },
    dark: { f: [['#2B2414'], ['#16110A'], ['#0B0804']], w: [['#1D4ED8'], ['#3B82F6'], ['#93C5FD']], eye: '#16110A', ln: '#16110A', sp: '#5AB0FF' },
    etch: { f: [['#5A3A00', .55]], w: [['#7A4E00', .5]], eye: '#5A3A00', ln: '#5A3A00', sp: '', lift: '#FFF7D6' }
  };
  // a four-point glint with a soft blue glow
  const spark = (id, x, y, r = 6, c = '#5AB0FF') => `${rg(id, x, y, r, [[0, '#FFFFFF', .95], [.22, c, .75], [1, c, 0]])}<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${id})"/><path d="M${n(x - r)} ${n(y)} L${n(x)} ${n(y - r * .1)} L${n(x + r)} ${n(y)} L${n(x)} ${n(y + r * .1)} Z M${n(x)} ${n(y - r * .78)} L${n(x + r * .09)} ${n(y)} L${n(x)} ${n(y + r * .78)} L${n(x - r * .09)} ${n(y)} Z" fill="#fff"/>`;
  function zzMark(p, x, y, w, style = 'silver', rot = 0) {
    const S = ZZ_STYLE[style] || ZZ_STYLE.silver, k = w / 120;
    const stops = a => a.length === 1 ? [[0, a[0][0], a[0][1] == null ? 1 : a[0][1]], [1, a[0][0], a[0][1] == null ? 1 : a[0][1]]] : a.map(([c, o], i) => [i / (a.length - 1), c, o == null ? 1 : o]);
    const ink = d => `<path d="${d}" fill="url(#${p}zf)"${S.edge ? ` stroke="${S.edge}" stroke-opacity=".45" stroke-width="3" paint-order="stroke" stroke-linejoin="round"` : ''}/>`;
    const body = `${lg(p + 'zf', 30, 38, 70, 92, stops(S.f))}${lg(p + 'zw', 8, 80, 66, 102, stops(S.w))}
      ${S.lift ? `<g transform="translate(1.2 1.4)" fill="${S.lift}" opacity=".75"><path d="${ZZ_FISH}"/><path d="${ZZ_FACE}"/><path d="${ZZ_WAVE}"/></g>` : ''}
      ${ink(ZZ_FISH)}${ink(ZZ_FACE)}<path d="${ZZ_WAVE}" fill="url(#${p}zw)"${S.edge ? ` stroke="${S.edge}" stroke-opacity=".45" stroke-width="3" paint-order="stroke" stroke-linejoin="round"` : ''}/>
      <circle cx="71.5" cy="47.4" r="1.9" fill="${S.eye}"/>
      ${S.edge ? `<path d="${ZZ_LINE}" fill="none" stroke="${S.edge}" stroke-opacity=".4" stroke-width="3.6" stroke-linecap="round"/><path d="${ZZ_HOOK}" fill="none" stroke="${S.edge}" stroke-opacity=".4" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      <path d="${ZZ_LINE}" fill="none" stroke="${S.ln}" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>
      <path d="${ZZ_HOOK}" fill="none" stroke="${S.ln}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${S.sp ? spark(p + 'zs', 108.6, 9.2, 12, S.sp) : ''}`;
    return `<g transform="translate(${n(x)} ${n(y)})${rot ? ` rotate(${rot})` : ''} scale(${n(k * 1000) / 1000})">${body}</g>`;
  }
  // "ZZIRIT" in thin strokes (drawn, so it looks the same on every phone), h units tall
  function zzWord(x, y, h, color, op = .8, word = 'ZZIRIT') {
    const G = { Z: ['M0 0H4L0 5H4', 5.6], I: ['M.5 0V5', 2.6], R: ['M0 5V0H2.7C4.1 0 4.1 2.6 2.7 2.6H0M2.2 2.6L4 5', 5.6], T: ['M0 0H4M2 0V5', 5.6], C: ['M4 .6C3.4 0 2.8 0 2.2 0C.8 0 0 1.1 0 2.5S.8 5 2.2 5C2.8 5 3.4 5 4 4.4', 5.6], H: ['M0 0V5M4 0V5M0 2.5H4', 5.6], A: ['M0 5L2 0L4 5M.8 3.2H3.2', 5.6], M: ['M0 5V0L2 3L4 0V5', 5.6], P: ['M0 5V0H2.7C4.1 0 4.1 2.8 2.7 2.8H0', 5.6], O: ['M2 0C.8 0 0 1.1 0 2.5S.8 5 2 5S4 3.9 4 2.5S3.2 0 2 0Z', 5.6], N: ['M0 5V0L4 5V0', 5.6],
      B: ['M0 5V0H2.6C3.7 0 3.9 2.4 2.6 2.4H0M2.6 2.4C4.1 2.4 4.2 5 2.6 5H0', 5.4], L: ['M0 0V5H3.8', 5], S: ['M3.8.6C3.3.2 2.7 0 2 0C1 0 .2.6.2 1.3C.2 3 4 2 4 3.7C4 4.5 3.1 5 2 5C1.2 5 .5 4.8 0 4.3', 5.4],
      E: ['M3.8 0H0V5H3.8M0 2.5H3.2', 5], K: ['M0 0V5M3.8 0L0 3.2M1.3 2.2L4 5', 5.4], F: ['M3.8 0H0V5M0 2.5H3.2', 5],
      0: ['M2 0C.8 0 0 1.1 0 2.5S.8 5 2 5S4 3.9 4 2.5S3.2 0 2 0Z', 5.4], 1: ['M1 .9L2.2 0V5', 3.6], 2: ['M.2 1.1C.5.4 1.2 0 2 0C3.2 0 3.9.7 3.9 1.5C3.9 2.6 2.8 3.2 0 5H4', 5.4],
      3: ['M.2.5C.7.2 1.3 0 2 0C3.2 0 3.8.6 3.8 1.3C3.8 2 3 2.5 2 2.5C3.2 2.5 4 3.1 4 3.8C4 4.6 3.2 5 2 5C1.2 5 .6 4.8 0 4.5', 5.4], 4: ['M3 5V0L0 3.4H4', 5.4],
      5: ['M3.8 0H.6L.3 2.3C.8 2 1.4 1.9 2 1.9C3.2 1.9 4 2.6 4 3.5S3.2 5 2 5C1.2 5 .6 4.8 0 4.4', 5.4], 6: ['M3.6.3C3.2.1 2.7 0 2.2 0C.9 0 0 1.2 0 2.9C0 4.2.8 5 2 5S4 4.3 4 3.3S3.2 1.8 2 1.8S0 2.4 0 3.2', 5.4],
      7: ['M0 0H4L1.6 5', 5.2], 8: ['M2 2.4C3.1 2.4 3.7 1.9 3.7 1.2S3.1 0 2 0S.3.5.3 1.2S.9 2.4 2 2.4C3.2 2.4 4 3 4 3.7S3.2 5 2 5S0 4.4 0 3.7S.8 2.4 2 2.4Z', 5.4],
      9: ['M.4 4.7C.8 4.9 1.3 5 1.8 5C3.1 5 4 3.8 4 2.1C4 .8 3.2 0 2 0S0 .7 0 1.7S.8 3.2 2 3.2S4 2.6 4 1.8', 5.4], '-': ['M.4 2.6H3', 3.8], '.': ['M.6 4.4V5', 1.8] };
    let d = '', cx = 0;
    for (const ch of word) { const g = G[ch]; if (!g) { cx += 3; continue; } d += `<path d="${g[0]}" transform="translate(${n(cx)} 0)"/>`; cx += g[1]; }
    const k = h / 5;
    return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k * 1000) / 1000})" fill="none" stroke="${color}" stroke-width="${n(.7 / Math.max(k, .3))}" stroke-linecap="square" opacity="${op}">${d}</g>`;
  }

  /* ---------- 번개 미노우 (and the 황금 번개 prize, the same body in gold) ---------- */
  const ARC = 'M129 58.8 L117 55.6 L109 60.2 L92 56.2 L85 60.4 L68 56.6 L62 59.6 L42 56.6';
  const MIN = 'M34 50 C58 41 100 34 140 34 C170 34 192 40 204 50 C209 55 207 61 200 64.5 C186 71 160 75 130 75 C95 74 60 66 34 60 C29.6 58.6 29.6 51.4 34 50 Z';
  function minnow(p, gold) {
    const C = gold
      ? { b0: '#4A2C00', b1: '#A86F00', s0: '#FFF6C9', s1: '#FFD23F', s2: '#E2A100', bel: '#FFF4CC', line: '#B91C1C', sc: '#6B4200', iris: ['#FFFFFF', '#FF5A5A', '#7A0000'], glow: '#FFF9DB' }
      : { b0: '#061B4D', b1: '#1E63E9', s0: '#F2F6FC', s1: '#B9C7DA', s2: '#EEF3FA', bel: '#FFFFFF', line: '#FF5A1F', sc: '#0B2F7A', iris: ['#FFF4BF', '#F2B200', '#8F5A00'], glow: '#FFFFFF' };
    return `<defs>
      <clipPath id="${p}c"><path d="${MIN}"/></clipPath>
      ${lg(p + 'b', 0, 34, 0, 75, [[0, C.b0], [.27, C.b1], [.43, C.s0], [.55, C.s1], [.7, C.s2], [1, C.bel]])}
      ${lg(p + 'f', 34, 0, 206, 0, [[0, '#fff', 0], [.1, '#fff', .55], [.16, '#000', .08], [.24, '#fff', 0], [.33, '#fff', .4], [.4, '#000', .07], [.48, '#fff', 0], [.56, '#fff', .5], [.62, '#000', .08], [.7, '#fff', 0], [.8, '#fff', .38], [.88, '#fff', 0]])}
      ${lg(p + 'h', 0, 34, 0, 60, [[0, '#fff', .55], [1, '#fff', 0]])}
      ${lg(p + 'u', 0, 52, 0, 76, [[0, '#000', 0], [1, '#000', .22]])}
      ${lg(p + 'l', 196, 62, 228, 90, [[0, '#E9F3FF', .75], [1, '#FFFFFF', .2]])}
      ${rg(p + 'r', 170, 60, 10, [[0, '#FF3B3B', .55], [1, '#FF3B3B', 0]])}
      ${hatch(p + 'x', gold ? '#7A4E00' : '#7FA7E8', .35)}${scales(p + 's', C.sc, .3)}
    </defs>
    <path d="M196 63 L227 84 Q231 88.5 225.5 90.4 L215 91 Q206 86 193 70 Z" fill="url(#${p}l)" stroke="#fff" stroke-width=".8" stroke-opacity=".85"/>
    <path d="M200 67 L223 85" stroke="#fff" stroke-width=".9" opacity=".7"/>
    <path d="M196 63 L227 84 Q231 88.5 225.5 90.4 L215 91 Q206 86 193 70 Z" fill="none" stroke="#294A70" stroke-width=".5" stroke-opacity=".45"/>
    ${ring(221.5, 84.6, 2.4, 2.6)}${spark(p + 'sp', 221.5, 84.6, 6)}
    ${wire('M128 72 L128 76.6', 1.4)}${treble(128, 79.2, 1.02)}
    ${wire('M33 55 L29.4 55', 1.4)}${treble(26.4, 55.6, .95)}
    <path d="${MIN}" fill="url(#${p}b)"/>
    <g clip-path="url(#${p}c)">
      <rect x="30" y="34" width="180" height="42" fill="url(#${p}x)"/>
      <rect x="30" y="40" width="150" height="30" fill="url(#${p}s)"/>
      <rect x="30" y="34" width="180" height="42" fill="url(#${p}f)"/>
      <rect x="30" y="34" width="180" height="42" fill="url(#${p}u)"/>
      <path d="${ARC}" fill="none" stroke="${C.line}" stroke-width="4.2" stroke-linejoin="round" opacity=".22"/>
      <path d="${ARC}" fill="none" stroke="${C.line}" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="${ARC}" fill="none" stroke="${C.glow}" stroke-width=".55" stroke-linejoin="round" transform="translate(0 -.5)" opacity=".9"/>
      <ellipse cx="170" cy="61" rx="10" ry="7" fill="url(#${p}r)"/>
      <path d="M171.5 37.5 C163.5 46 163.5 61 170.5 71" fill="none" stroke="#0B1A33" stroke-width="1.1" opacity=".38"/>
      <path d="M173 38 C166 46 166 60 172 70" fill="none" stroke="#fff" stroke-width=".6" opacity=".55"/>
      ${zzWord(gold ? 92 : 100, 66.4, 2.5, gold ? '#5C3A00' : '#0B2F7A', .55, gold ? 'CHAMPION' : 'ZZIRIT')}
      <path d="M52 40 C90 31 150 30 196 44 L196 52 C150 41 92 42 52 52 Z" fill="url(#${p}h)"/>
    </g>
    ${gloss('M66 42.5 C100 36.6 150 35.6 186 41', 2.2, .7)}
    ${gloss('M150 70.5 C170 69 186 66.5 196 63', 1.2, .35)}
    <path d="${MIN}" fill="none" stroke="#0B1530" stroke-width=".7" stroke-opacity=".45"/>
    ${zzMark(p + 'm', 128, 42.4, 26, gold ? 'dark' : 'navy')}
    ${eye(p, 185, 48.6, 6.8, C.iris)}
    ${gold ? `<path d="M118 47 l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z M66 49 l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" fill="#fff" opacity=".95"/>` : ''}`;
  }

  /* ---------- 섬광 메탈지그: slim pink-backed holographic jig, glow belly stripes, twin assist hooks on braided cord ---------- */
  const JIG = 'M24 57 C46 48.6 92 42.4 140 42.4 C177 42.4 201 47.6 215 56.4 C201 64.6 177 70 140 70 C92 70 46 65.6 24 57 Z';
  function jig(p) {
    return `<defs>
      <clipPath id="${p}c"><path d="${JIG}"/></clipPath>
      ${lg(p + 'b', 0, 42.4, 0, 70, [[0, '#5E0035'], [.16, '#D10068'], [.34, '#FF4FA6'], [.45, '#FFE3F1'], [.5, '#FFFFFF'], [.58, '#C9D3E1'], [.7, '#EEF2F8'], [.84, '#DDFBCB'], [1, '#9EE27E']])}
      ${lg(p + 'p', 24, 0, 215, 0, [[0, '#FF6EC7', .5], [.18, '#FFD36E', .42], [.36, '#6EFFB6', .42], [.54, '#6EC8FF', .5], [.72, '#B46EFF', .46], [.9, '#FF6EC7', .5], [1, '#FFD36E', .42]])}
      ${lg(p + 'f', 0, 42.4, 0, 70, [[0, '#fff', 0], [.46, '#fff', .7], [.52, '#fff', 0], [1, '#000', .18]])}
      <pattern id="${p}x" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><path d="M0 0 V5 M0 0 H5" stroke="#fff" stroke-width=".6" stroke-opacity=".55"/></pattern>
    </defs>
    ${wire('M215 56.4 C218.4 56.4 220.4 58 220.4 61', 1.5)}${ring(220.4, 64.2, 3.1, 3.5)}
    <path d="M219.6 67.4 C218.4 74 214 78 211.6 83 M221.2 67.4 C223.4 74.4 226.4 78 227.6 83.6" fill="none" stroke="#FF8A00" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M219.6 67.4 C218.4 74 214 78 211.6 83 M221.2 67.4 C223.4 74.4 226.4 78 227.6 83.6" fill="none" stroke="#FFE3A3" stroke-width=".9" stroke-dasharray="1.3 1.5" stroke-linecap="round"/>
    ${wire('M211.4 83 L211.4 98 C211.4 105 200.6 106.2 199.2 98.8 L199 93.4', 1.8)}${wire('M199.2 95.8 L201.4 97.9', 1.1)}
    ${wire('M227.6 83.6 L227.6 98.6 C227.6 105.6 216.8 106.8 215.4 99.4 L215.2 94', 1.8)}${wire('M215.4 96.4 L217.6 98.5', 1.1)}
    ${wire('M24 57 L20.6 57', 1.3)}${ring(17.6, 57, 3, 3.4)}
    <path d="${JIG}" fill="url(#${p}b)"/>
    <g clip-path="url(#${p}c)">
      <rect x="22" y="42" width="195" height="29" fill="url(#${p}x)"/>
      <rect x="22" y="42" width="195" height="29" fill="url(#${p}p)"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${48 + i * 19} 72 L${58 + i * 19} 59.5 L${64 + i * 19} 59.5 L${54 + i * 19} 72 Z" fill="#F4FFE8" opacity=".85"/>`).join('')}
      <rect x="22" y="42" width="195" height="29" fill="url(#${p}f)"/>
      <path d="M34 56.4 C80 55.8 150 55.6 207 56.4" fill="none" stroke="#fff" stroke-width="1" opacity=".9"/>
    </g>
    ${gloss('M58 50.4 C100 45.4 160 45 196 49.6', 1.7, .8)}
    <path d="${JIG}" fill="none" stroke="#3A0A26" stroke-width=".7" stroke-opacity=".55"/>
    ${zzMark(p + 'm', 143.6, 44.6, 22, 'navy')}
    ${eye(p, 199.5, 54.2, 4.2, ['#FFFFFF', '#FF3D7F', '#6B0030'])}${spark(p + 'sp', 220.4, 64.2, 6)}`;
  }

  /* ---------- 오징어킬러 에기: orange cloth over gold tape, marble back, a glow eye in its socket, lead plate under the chin,
     two feathers and the 'kanna' — two rows of pins fanning back like a half-open umbrella ---------- */
  const EGI = 'M38 57 C52 45 106 37 158 38.5 C186 39.5 204 46 214 54.5 C206 63.5 188 69.5 162 71.5 C112 75 56 70 38 57 Z';
  function blob(x, y, r, seed) { // a soft irregular patch
    const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(seed); const pts = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, k = r * (.65 + R() * .5); pts.push([x + Math.cos(a) * k * 1.5, y + Math.sin(a) * k * .8]); }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; let d = `M${n(mid(pts[6], pts[0])[0])} ${n(mid(pts[6], pts[0])[1])}`;
    for (let i = 0; i < 7; i++) { const m = mid(pts[i], pts[(i + 1) % 7]); d += ` Q${n(pts[i][0])} ${n(pts[i][1])} ${n(m[0])} ${n(m[1])}`; }
    return d + 'Z';
  }
  function egi(p) {
    const pins = [];
    for (const [bx, len, spread] of [[31.5, 12.5, 15], [24.5, 11, 12.5]]) for (let i = 0; i < 7; i++) {
      const f = -1 + i / 3, x2 = bx - len * (1 - .3 * Math.abs(f)), y2 = 57 + f * spread;
      pins.push(`M${n(bx)} ${n(57 + f * 2)} L${n(x2)} ${n(y2)} l${n(2)} ${n(f < 0 ? 1.3 : -1.3)}`);
    }
    const feather = (x, y, len, ang, c1, c2, id) => `<g transform="rotate(${ang} ${x} ${y})">${lg(id, x, y, x - len, y, [[0, c1], [1, c2, .2]])}<path d="M${x} ${y} C${x - len * .3} ${y - 5.5} ${x - len * .75} ${y - 4.5} ${x - len} ${y - 1} C${x - len * .7} ${y + 2.6} ${x - len * .3} ${y + 2.4} ${x} ${y} Z" fill="url(#${id})"/><path d="M${x} ${y} C${x - len * .4} ${y - 1.4} ${x - len * .75} ${y - 1.4} ${x - len * .98} ${y - 1}" fill="none" stroke="#FFF1D6" stroke-width=".5" opacity=".9"/></g>`;
    return `<defs>
      <clipPath id="${p}c"><path d="${EGI}"/></clipPath>
      ${lg(p + 'g', 0, 38, 0, 73, [[0, '#6E3A00'], [.3, '#D99000'], [.5, '#FFE587'], [.7, '#D08600'], [1, '#7A4600']])}
      ${lg(p + 'b', 0, 38, 0, 73, [[0, '#A82E00', .96], [.25, '#FF5A0A', .86], [.52, '#FF8B2E', .5], [.78, '#FF6A10', .86], [1, '#B33A00', .96]])}
      ${lg(p + 'u', 0, 52, 0, 74, [[0, '#000', 0], [1, '#000', .26]])}
      ${lg(p + 'w', 0, 60, 0, 75, [[0, '#6B737E'], [.35, '#C9D0D9'], [1, '#2B3038']])}
      ${rg(p + 's', 189, 51, 9.5, [[0, '#7A2400', .9], [.7, '#C24A00', .6], [1, '#FF8A3A', 0]])}
      <pattern id="${p}x" patternUnits="userSpaceOnUse" width="2.2" height="2.2"><path d="M0 0 L2.2 2.2 M2.2 0 L0 2.2" stroke="#FFD9B5" stroke-width=".38" stroke-opacity=".6"/></pattern>
    </defs>
    ${wire(pins.join(' '), .85, '#7A8190', '#F2F4F8')}
    <path d="M38 57 L19 57" stroke="#AEB6C2" stroke-width="3.2" stroke-linecap="round"/><path d="M38 56 L19 56" stroke="#fff" stroke-width=".8" opacity=".9"/>
    <rect x="31.5" y="54.2" width="3" height="5.6" rx="1" fill="#FF4FA3"/><rect x="24.5" y="54.6" width="2.6" height="4.8" rx="1" fill="#FF4FA3"/>
    ${feather(158, 41.5, 30, 24, '#FFB020', '#FFE27A', p + 'f1')}${feather(152, 41.8, 26, 34, '#FF5A1F', '#FFB020', p + 'f2')}
    <path d="${EGI}" fill="url(#${p}g)"/>
    <g clip-path="url(#${p}c)">
      ${[0, 1, 2, 3].map(i => `<path d="M${70 + i * 30} 36 L${84 + i * 30} 36 L${64 + i * 30} 76 L${50 + i * 30} 76 Z" fill="#FFF3B0" opacity=".42"/>`).join('')}
      <rect x="36" y="36" width="180" height="40" fill="url(#${p}b)"/>
      ${[[70, 44.5, 7, 3], [96, 42, 6, 11], [121, 43.5, 7.5, 21], [146, 41.8, 6, 33], [168, 43.6, 4.6, 45], [84, 49.4, 3.6, 57], [134, 48.2, 3.8, 69], [108, 48.6, 3, 81]].map(([x, y, r, sd]) => `<path d="${blob(x, y, r, sd)}" fill="#4A1200" opacity=".5"/>`).join('')}
      <rect x="36" y="36" width="180" height="40" fill="url(#${p}x)"/>
      <rect x="36" y="36" width="180" height="40" fill="url(#${p}u)"/>
      <path d="M60 46.4 C96 39.6 150 38.8 196 47.2 L196 50.2 C150 43.2 96 44.2 60 51.4 Z" fill="#fff" opacity=".35"/>
      <circle cx="189" cy="51" r="9.5" fill="url(#${p}s)"/>
    </g>
    <path d="M166 65.6 C180 65.6 196 64.6 208.4 60.4 L212.6 63.8 C202 71.2 186 74.8 166 74.2 Z" fill="url(#${p}w)" stroke="#20252C" stroke-width=".6"/>
    <path d="M169 67.4 C183 67.2 197 66.2 207.6 62.4" fill="none" stroke="#EEF2F6" stroke-width=".7" opacity=".85"/>
    <path d="M180.5 55.6 C173.5 51.6 166.5 51.8 161.5 55.2 C167 56.8 173.5 58.6 180.5 58.6 Z" fill="#FFC79A" opacity=".75" stroke="#C25A1A" stroke-width=".45"/>
    ${gloss('M70 46 C104 40.8 150 40.2 188 45.8', 1.6, .6)}
    <path d="${EGI}" fill="none" stroke="#4A1600" stroke-width=".65" stroke-opacity=".55"/>
    <path d="M212 54.4 C200 47.6 182 43.6 160 42.6" fill="none" stroke="#5A1A00" stroke-width=".6" opacity=".45"/>
    ${eye(p, 189, 51, 6.6, ['#F4FFE8', '#7DFF4A', '#1E7A00'])}
    ${ring(215.6, 53.6, 2.3, 2.5)}`;
  }

  /* ---------- 진동 바이브: lipless and deep, fire-tiger paint, the line tie on its back, two trebles ---------- */
  const VIB = 'M46 60 C49 45 80 32 124 30 C158 29 184 36 199 46 L206 57.5 C205.5 66 196 74 176 79 C142 86.5 92 85 62 75 C51 71 45.5 66 46 60 Z';
  function vib(p) {
    return `<defs>
      <clipPath id="${p}c"><path d="${VIB}"/></clipPath>
      ${lg(p + 'b', 0, 30, 0, 85, [[0, '#2F5E00'], [.2, '#9BE000'], [.42, '#F6F33A'], [.62, '#FFD21F'], [.8, '#FF7A00'], [1, '#E85000']])}
      ${lg(p + 'u', 0, 55, 0, 86, [[0, '#000', 0], [1, '#000', .2]])}
      ${lg(p + 'h', 0, 30, 0, 56, [[0, '#fff', .6], [1, '#fff', 0]])}
      ${scales(p + 's', '#3D5A00', .28)}
    </defs>
    ${wire('M171 31.5 L171 27.5', 1.3)}${ring(171, 24.6, 2.6, 2.9)}
    ${wire('M128 84.5 L128 88', 1.4)}${treble(128, 90.6, .98)}
    ${wire('M58 74 L56 78', 1.4)}${treble(55.4, 80.6, .9)}
    <path d="${VIB}" fill="url(#${p}b)"/>
    <g clip-path="url(#${p}c)">
      <rect x="44" y="28" width="165" height="60" fill="url(#${p}s)"/>
      ${[[70, 7], [90, 9], [110, 10], [130, 10], [150, 9], [168, 7]].map(([x, w], i) => `<path d="M${x} 28 C${x + 4} 40 ${x - 3} 50 ${x + 2} ${62 - (i % 2) * 4} C${x + 5} ${66 - (i % 2) * 4} ${x + w * .2} 70 ${x + w * .45} 74 L${x + w * .9} 74 C${x + w * .5} 66 ${x + w + 2} 58 ${x + w} 48 C${x + w - 2} 40 ${x + w + 3} 33 ${x + w} 28 Z" fill="#141A05" opacity=".62"/>`).join('')}
      <rect x="44" y="28" width="165" height="60" fill="url(#${p}u)"/>
      <path d="M58 44 C90 31 150 28 196 44 L196 52 C150 38 92 40 58 54 Z" fill="url(#${p}h)"/>
      <path d="M172 39 C166 50 166 62 173 73" fill="none" stroke="#B3001B" stroke-width="1.6" opacity=".7"/>
    </g>
    ${gloss('M70 41 C102 32.4 152 31.2 190 41.6', 2, .7)}
    <path d="${VIB}" fill="none" stroke="#2A2400" stroke-width=".7" stroke-opacity=".45"/>
    ${eye(p, 184, 50.5, 6.3, ['#FFFDE8', '#FFD000', '#8A6200'])}`;
  }

  /* ---------- 물비늘 스푼: hammered gold, cupped (a dark hollow and a bright rim), red dots, a red-tagged treble ---------- */
  const SPN = 'M207 58 C207 53.4 199 49.6 186 47.6 C160 43.6 120 40 84 40.6 C52 41.2 34 48 34 58 C34 68 52 74.8 84 75.4 C120 76 160 72.4 186 68.4 C199 66.4 207 62.6 207 58 Z';
  function spoon(p) {
    const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7); const dimples = [];
    for (let i = 0; i < 120; i++) { // hammered: shallow dents, shadow on the upper left inside, light on the lower right
      const a = R() * 6.283, k = Math.sqrt(R()), x = 118 + Math.cos(a) * 82 * k, y = 58 + Math.sin(a) * 15.5 * k * (1 - .25 * Math.max(0, (x - 120) / 90));
      const r = 1.6 + R() * 1.9, rot = n(R() * 360);
      dimples.push(`<g transform="rotate(${rot} ${n(x)} ${n(y)})"><path d="M${n(x - r)} ${n(y)} A${n(r)} ${n(r * .7)} 0 0 1 ${n(x + r)} ${n(y)}" fill="none" stroke="#5C3900" stroke-width="${n(r * .45)}" opacity=".2"/><path d="M${n(x + r * .8)} ${n(y + .3)} A${n(r * .8)} ${n(r * .55)} 0 0 1 ${n(x - r * .8)} ${n(y + .3)}" fill="none" stroke="#FFF7D1" stroke-width="${n(r * .4)}" opacity=".32"/></g>`);
    }
    return `<defs>
      <clipPath id="${p}c"><path d="${SPN}"/></clipPath>
      ${lg(p + 'b', 0, 40, 0, 76, [[0, '#4F3100'], [.14, '#B97C00'], [.3, '#FFDF6E'], [.42, '#FFFBE6'], [.53, '#F7C531'], [.73, '#A86E00'], [1, '#4A2C00']])}
      ${lg(p + 'k', 0, 52, 0, 76, [[0, '#3A2400', 0], [.6, '#3A2400', .18], [1, '#3A2400', .5]])}
      ${lg(p + 'x', 40, 0, 205, 0, [[0, '#fff', 0], [.3, '#fff', .35], [.42, '#fff', 0], [.66, '#fff', .3], [.78, '#fff', 0]])}
    </defs>
    ${wire('M207 58 L210.4 58', 1.3)}${ring(213.4, 58, 3, 3.4)}
    ${wire('M35.6 58 L33.6 58', 1.3)}${ring(30.6, 58.4, 3.1, 3.5)}
    <path d="M30.6 84 C24 91 22 98 25 104 C28 98 31 93 31.6 88 Z M30.6 84 C37 91 39 98 36 104 C33 98 30.4 93 29.6 88 Z" fill="#E11D2E" opacity=".92"/>
    <path d="M30.6 84 C28 92 28.8 98 30.6 103" fill="none" stroke="#FF9A9A" stroke-width=".6"/>
    ${treble(30.6, 61.2, .9)}
    <path d="${SPN}" fill="url(#${p}b)"/>
    <g clip-path="url(#${p}c)">
      ${dimples.join('')}
      <rect x="30" y="38" width="180" height="40" fill="url(#${p}x)"/>
      <path d="M38 62 C64 72.6 110 74.8 150 72 C176 70 196 65 204 60 L206 78 L34 78 Z" fill="url(#${p}k)"/>
      ${[[66, 52], [92, 63.6], [156, 51], [176, 62.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.9" fill="#8A0B16"/><circle cx="${x}" cy="${y}" r="2.3" fill="#E11D2E"/><circle cx="${x - .8}" cy="${y - .9}" r=".8" fill="#fff" opacity=".75"/>`).join('')}
    </g>
    <path d="M48 47.6 C76 42.4 140 41.4 190 50.4" fill="none" stroke="#FFFCEB" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
    <path d="${SPN}" fill="none" stroke="#4A2E00" stroke-width=".9" stroke-opacity=".65"/>
    <path d="M203 56 C196 51.6 182 48.8 166 47" fill="none" stroke="#fff" stroke-width="1.1" opacity=".6"/>`;
  }

  /* ---------- 홍염 타이라바: a round glitter head, skirt strands and curly ties, two small hooks on fluorocarbon ---------- */
  function tai(p) {
    const glitter = [];
    const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(42);
    for (let i = 0; i < 36; i++) { const a = R() * 6.283, r = Math.sqrt(R()) * 19; glitter.push(`<circle cx="${n(182 + Math.cos(a) * r)}" cy="${n(48 + Math.sin(a) * r)}" r="${n(.35 + R() * .6)}" fill="${R() > .5 ? '#FFE27A' : '#FFFFFF'}" opacity="${n(.55 + R() * .45)}"/>`); }
    const strand = (y0, y1, c, w, wav) => `<path d="M168 ${y0} C140 ${y0 + wav} 112 ${y1 - wav} 84 ${y1} C70 ${y1 + wav * .6} 58 ${y1 - wav * .4} 46 ${y1 + 1}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
    return `<defs>
      ${rg(p + 'h', 182, 48, 23, [[0, '#FFB199'], [.35, '#FF3B2F'], [.8, '#C40C0C'], [1, '#6E0000']], 174, 39)}
      ${lg(p + 't', 60, 0, 170, 0, [[0, '#FF2E1F'], [1, '#FF8A00']])}
    </defs>
    <path d="M182 26 L182 4" stroke="#B8C4D0" stroke-width="1" opacity=".9"/>
    ${strand(52, 58, '#FFC400', 1.3, 6)}${strand(54, 66, '#FF7A00', 1.3, -5)}${strand(56, 72, '#FF3B2F', 1.3, 7)}${strand(53, 62, '#FFE27A', .9, -7)}${strand(57, 77, '#FF7A00', 1.1, 4)}
    <path d="M168 52 C146 46 126 52 110 48 C96 45 86 53 72 49 C62 46.4 56 52 50 50.4 C54 54 61 53.4 68 55.2 C82 59 92 52 106 55 C122 58.6 144 54 166 58 Z" fill="url(#${p}t)" opacity=".95"/>
    <path d="M70 52 C64 47 57 49.5 58 54.5 C59 58.4 65.2 57.8 64.6 53.8" fill="none" stroke="#FF5A1F" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M168 60 C150 62 132 70 114 68 C100 66.6 88 74 74 72 C64 70.6 58 76 52 75 C57 79 63 77.4 70 78.4 C84 80.4 96 72.6 110 74.6 C128 77 150 68 167 64 Z" fill="#FF2E1F" opacity=".9"/>
    <path d="M60 76 C53 72.6 47.4 76.4 49.4 81 C51 84.6 57.2 83 55.6 79" fill="none" stroke="#FF2E1F" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M170 56 C150 62 134 64 120 64.5 M170 58 C152 66 140 70 128 71.5" fill="none" stroke="#DCE6EE" stroke-width=".7" opacity=".9"/>
    ${wire('M120 64.5 L120 74 C120 79.6 112 80.4 110.6 75 L110.4 70.6', 1.4)}${wire('M110.6 72.6 L112.4 74.3', .9)}
    ${wire('M128 71.5 L128 81 C128 86.6 120 87.4 118.6 82 L118.4 77.6', 1.4)}${wire('M118.6 79.6 L120.4 81.3', .9)}
    <circle cx="182" cy="48" r="22" fill="url(#${p}h)"/>
    ${glitter.join('')}
    <circle cx="182" cy="48" r="22" fill="none" stroke="#5A0000" stroke-width=".8" stroke-opacity=".6"/>
    <ellipse cx="174.5" cy="37.5" rx="7" ry="4.2" transform="rotate(-28 174.5 37.5)" fill="#fff" opacity=".55"/>
    ${eye(p, 190.5, 45, 6.2, ['#FFFFFF', '#FFD84D', '#9A6A00'])}`;
  }

  /* ---------- 기본 지그헤드: a round lead head and a pearl grub with a ribbon tail ---------- */
  function jighead(p) {
    const rings = []; for (let i = 0; i < 9; i++) { const x = 168 - i * 8.6, t = i / 9; rings.push(`<path d="M${n(x)} ${n(49.6 + t * 3.4)} C${n(x - 1.8)} ${n(54)} ${n(x - 1.8)} ${n(60)} ${n(x)} ${n(64.4 - t * 2.6)}" fill="none" stroke="#B3A994" stroke-width=".7" opacity=".6"/>`); }
    const TAIL = 'M94 53.2 C77 51 62 58.6 62 71 C62 84.4 77.6 90.2 87 82.6 C92.4 78.2 89.6 71 83.4 72 C86.8 74 86.6 77.8 83.6 80 C76.6 84.6 67.6 79.6 68.6 70.6 C69.6 61.8 79.6 59.8 94 62.6 Z';
    return `<defs>
      ${rg(p + 'h', 190, 56, 13.5, [[0, '#F4F6F9'], [.45, '#AEB6C1'], [1, '#4A525D']], 185, 50)}
      ${lg(p + 'w', 0, 48, 0, 66, [[0, '#FFFFFF'], [.45, '#F6EFE2'], [.8, '#E9D9C6'], [1, '#CDBBA2']])}
      ${lg(p + 't', 62, 0, 96, 0, [[0, '#E9FF6A'], [1, '#F6EFE2']])}
    </defs>
    <path d="M190 43 L190 37.2" stroke="#262B33" stroke-width="1.4"/>${ring(190, 34.4, 2.4, 2.7)}
    <path d="${TAIL}" fill="url(#${p}t)" stroke="#B9AC8E" stroke-width=".6"/>
    <path d="M90 55 C78 54 66 60 65.6 70" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>
    <path d="M180 48.6 C150 48.2 114 50.4 94 53 C88.6 53.8 87.4 58.6 89.2 61.6 C91 64 95.6 64.6 100 64.4 C124 63.6 150 64.6 180 64.8 Z" fill="url(#${p}w)" stroke="#B9AC8E" stroke-width=".5"/>
    ${rings.join('')}
    ${[[110, 54], [128, 59], [146, 53.5], [158, 60], [100, 60], [138, 56.5], [168, 55], [120, 61.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".75" fill="#D4A72C"/>`).join('')}
    ${gloss('M98 52.8 C120 50.8 150 50.2 176 50.8', 1.6, .85)}
    ${wire('M134 50 C134 44 138 40.6 143 40.6 L146.4 41.2', 1.6)}${wire('M144.3 40.6 L143 43.2', 1)}
    <circle cx="190" cy="56" r="13" fill="url(#${p}h)"/>
    <circle cx="190" cy="56" r="13" fill="none" stroke="#2C323A" stroke-width=".7" stroke-opacity=".6"/>
    <ellipse cx="185.4" cy="50" rx="4.4" ry="2.6" transform="rotate(-30 185.4 50)" fill="#fff" opacity=".7"/>
    ${eye(p, 193.5, 54.6, 4.4, ['#FFFFFF', '#FF5A1F', '#8A2400'])}`;
  }

  /* ---------- 낚싯대: the butt half of a rod at an angle — butt cap, grip, reel seat (the signature rods carry the mark on
     it), fore grip, winding check, then the blank with thread wraps and guides running off to the top right ---------- */
  const cy4 = c => [[0, c[0]], [.26, c[1]], [.55, c[2]], [1, c[3] || c[0]]];
  const cyl = (id, x0, x1, r, c, rx = 1) => `${lg(id, 0, -r, 0, r, cy4(c))}<rect x="${n(x0)}" y="${n(-r)}" width="${n(x1 - x0)}" height="${n(2 * r)}" rx="${rx}" fill="url(#${id})"/>`;
  function rod(p, C) {
    const rAt = x => 4.6 - (x - 138) * (3.1 / 134);
    const tex = C.tex === 'cork'
      ? `<pattern id="${p}t" patternUnits="userSpaceOnUse" width="7" height="5"><ellipse cx="2" cy="1.4" rx="1.3" ry=".7" fill="#6B4A1E" opacity=".45"/><ellipse cx="5.4" cy="3.6" rx=".9" ry=".5" fill="#6B4A1E" opacity=".4"/><circle cx="4.6" cy="1" r=".4" fill="#FFF1D6" opacity=".5"/></pattern>`
      : `<pattern id="${p}t" patternUnits="userSpaceOnUse" width="3" height="3"><circle cx=".8" cy=".8" r=".45" fill="#fff" opacity=".1"/><circle cx="2.2" cy="2.1" r=".35" fill="#000" opacity=".25"/></pattern>`;
    const carbon = `<pattern id="${p}cb" patternUnits="userSpaceOnUse" width="2.4" height="2.4"><rect width="1.2" height="1.2" fill="#fff" opacity=".1"/><rect x="1.2" y="1.2" width="1.2" height="1.2" fill="#fff" opacity=".1"/></pattern>`;
    const guide = (x, h, rr) => { const r0 = rAt(x); return `${cyl(p + 'gw' + x, x - 5, x + 5, r0 + .55, C.wrap, .6)}<path d="M${n(x - 5)} ${n(-r0 - .6)} V${n(r0 + .6)} M${n(x + 5)} ${n(-r0 - .6)} V${n(r0 + .6)}" stroke="${C.trim}" stroke-width=".7"/>
      <path d="M${n(x - 3.4)} ${n(r0)} L${n(x)} ${n(h - rr)} L${n(x + 3.4)} ${n(r0)}" fill="none" stroke="${C.guide}" stroke-width="1.1" stroke-linejoin="round"/>
      <ellipse cx="${x}" cy="${n(h)}" rx="${n(rr * .34)}" ry="${n(rr)}" fill="none" stroke="${C.guide}" stroke-width="1.4"/><ellipse cx="${x}" cy="${n(h)}" rx="${n(rr * .2)}" ry="${n(rr * .74)}" fill="none" stroke="#C9D2DD" stroke-width=".6"/>`; };
    return `<defs>${tex}${carbon}</defs>
    <ellipse cx="128" cy="113" rx="104" ry="4" fill="#000" opacity=".18"/>
    <g transform="translate(9 107) rotate(-24)">
      ${lg(p + 'bl', 0, -4.6, 0, 4.6, cy4(C.blank))}<path d="M138 -4.6 L274 -1.5 L274 1.5 L138 4.6 Z" fill="url(#${p}bl)"/>
      <path d="M140 -3.4 L272 -.9" stroke="#fff" stroke-width=".8" opacity=".45"/>
      ${guide(176, 19, 7)}${guide(220, 13, 4.6)}${guide(256, 9, 3.2)}
      ${cyl(p + 'dw', 140, 154, 4.9, C.wrap, .6)}<path d="M140 -5 V5 M143 -5 V5 M151 -5 V5 M154 -5 V5" stroke="${C.trim}" stroke-width=".7"/>
      ${C.zig ? `<path d="M156 -4.4 L160 4.2 L164 -4.2 L168 4.1 L172 -4.1" fill="none" stroke="${C.zig}" stroke-width="1.6" stroke-linejoin="round"/>` : ''}
      ${zzWord(180, -1.3, 2.6, C.text, .85, C.label)}
      <path d="M0 -7.6 H9 V7.6 H0 C-1.4 7.6 -2.2 4.6 -2.2 0 C-2.2 -4.6 -1.4 -7.6 0 -7.6 Z" fill="url(#${p}cp)"/>${lg(p + 'cp', 0, -7.6, 0, 7.6, cy4(C.cap))}
      ${cyl(p + 'g1', 9, 64, 7, C.grip, 2)}<rect x="9" y="-7" width="55" height="14" rx="2" fill="url(#${p}t)"/>
      ${cyl(p + 'h1', 64, 69, 7.6, C.hood)}
      ${cyl(p + 'st', 69, 98, 6.2, C.seat)}${C.sig ? `<rect x="69" y="-6.2" width="29" height="12.4" fill="url(#${p}cb)"/>` : ''}
      ${cyl(p + 'nt', 98, 108, 6.8, C.hood)}<path d="M100 -6.8 V6.8 M102 -6.8 V6.8 M104 -6.8 V6.8 M106 -6.8 V6.8" stroke="#000" stroke-width=".5" opacity=".3"/>
      ${cyl(p + 'g2', 108, 134, 6.4, C.grip, 2)}<rect x="108" y="-6.4" width="26" height="12.8" rx="2" fill="url(#${p}t)"/>
      ${cyl(p + 'wc', 134, 138, 5.6, C.hood)}
      <path d="M144 5 C144 9 147 10 149 8.4" fill="none" stroke="${C.guide}" stroke-width=".9"/>
      ${C.sig ? `${zzMark(p + 'm', 76.6, -6.2, 14.4, 'silver')}${spark(p + 'sp', 176, 19 - 7, 7)}` : ''}
    </g>`;
  }

  /* ---------- 릴: a spinning reel from the side, hanging under a piece of rod — foot and stem, the gear body with its
     side plate, the handle arm and knob, the rotor and bail, the spool full of line, the drag knob. A lever-brake (LB)
     reel has its brake lever in front of the stem. The signature reels carry the mark on the side plate. ---------- */
  function reel(p, C) {
    const knob = C.knobT === 'paddle'
      ? `<path d="M56 98 C52 93 54 87 60 86 C66 85 70 90 68 96 C66 102 60 103 56 98 Z" fill="url(#${p}kn)"/>`
      : `<ellipse cx="62" cy="96" rx="8" ry="7.4" fill="url(#${p}kn)"/><ellipse cx="59.6" cy="93" rx="3" ry="2" fill="#fff" opacity=".35"/>`;
    return `<defs>
      ${lg(p + 'rd', 0, 9, 0, 17, cy4(['#15181D', '#4A505A', '#22262D']))}
      ${lg(p + 'rf', 0, 0, 240, 0, [[0, '#fff', 0], [.24, '#fff'], [.8, '#fff'], [1, '#fff', 0]])}
      <mask id="${p}rm" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="120"><rect x="0" y="0" width="240" height="30" fill="url(#${p}rf)"/></mask>
      ${lg(p + 'bd', 76, 50, 126, 100, [[0, C.body[1]], [.45, C.body[0]], [1, C.body[2]]])}
      ${rg(p + 'cv', 94, 68, 24, [[0, C.cover[0]], [.6, C.cover[1]], [1, C.cover[2]]])}
      ${lg(p + 'rt', 0, 52, 0, 100, cy4(C.rotor))}
      ${lg(p + 'sp', 0, 57, 0, 95, cy4(C.spool))}
      ${lg(p + 'ln', 0, 60, 0, 92, cy4(C.line))}
      ${lg(p + 'kn', 0, 88, 0, 104, cy4(C.knob))}
      ${lg(p + 'dg', 0, 66, 0, 86, cy4(C.drag || C.spool))}
      <pattern id="${p}lt" patternUnits="userSpaceOnUse" width="2" height="1.6"><path d="M0 .8 H2" stroke="#fff" stroke-width=".35" opacity=".35"/></pattern>
    </defs>
    <ellipse cx="124" cy="112" rx="70" ry="4" fill="#000" opacity=".18"/>
    <rect x="0" y="9" width="240" height="8" rx="2" fill="url(#${p}rd)" mask="url(#${p}rm)"/>
    <path d="M84 17 H126 C127 17 127 20 126 20 H84 C83 20 83 17 84 17 Z" fill="${C.body[2]}"/>
    <path d="M96 20 C94 32 91 42 93 53 L109 53 C107 42 108 31 111 20 Z" fill="url(#${p}bd)"/>
    ${C.lb ? `<path d="M110 26 C124 25 142 30 156 42 L153.4 45.6 C141 35.6 125 31 110 31.4 Z" fill="${C.lb}"/><circle cx="111" cy="28.6" r="2.4" fill="${C.body[2]}"/>` : ''}
    <path d="M76 66 C76 55 87 50 101 50 C118 50 127 58 127 71 L127 85 C127 96 117 101 102 101 C87 101 76 95 76 84 Z" fill="url(#${p}bd)"/>
    <ellipse cx="100" cy="75.6" rx="20.5" ry="21" fill="url(#${p}cv)"/>
    <ellipse cx="100" cy="75.6" rx="20.5" ry="21" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".8"/>
    ${C.accent ? `<path d="M80 62 C88 55 104 53 116 58" fill="none" stroke="${C.accent}" stroke-width="1.6"/>` : ''}
    <circle cx="100" cy="75.6" r="9" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>
    <path d="M126 55 L145 51.4 C148 51 149 53 149 56 L149 96 C149 99 148 101 145 100.6 L126 97 Z" fill="url(#${p}rt)"/>
    <path d="M140 51.8 L170 49.2 L171 52.6 L141 55.4 Z M140 96.6 L170 99.2 L171 95.8 L141 93 Z" fill="url(#${p}rt)"/>
    <path d="M168 49.4 C190 50 194 98 168 99.2" fill="none" stroke="${C.bail}" stroke-width="2.2"/><path d="M168 49.4 C189 50.4 193 97 168 99.2" fill="none" stroke="#fff" stroke-width=".6" opacity=".6"/>
    <rect x="163" y="46.4" width="7" height="6" rx="1.4" fill="${C.bail}"/>
    ${C.sig ? zzMark(p + 'm', 127.6, 64.6, 19, C.markStyle || 'silver') : ''}
    <rect x="149" y="56.6" width="4" height="39" rx="1" fill="url(#${p}sp)"/>
    <rect x="153" y="60.4" width="22" height="31.4" fill="url(#${p}ln)"/><rect x="153" y="60.4" width="22" height="31.4" fill="url(#${p}lt)"/>
    <rect x="175" y="57.4" width="4.6" height="37.6" rx="1.2" fill="url(#${p}sp)"/>
    <rect x="179.6" y="65.6" width="11" height="21" rx="2.4" fill="url(#${p}dg)"/><path d="M182 65.6 V86.6 M184.6 65.6 V86.6 M187.2 65.6 V86.6" stroke="#000" stroke-width=".6" opacity=".25"/>
    <path d="M100 75.6 L62 96" stroke="url(#${p}bd)" stroke-width="6.4" stroke-linecap="round"/><path d="M100 75.6 L62 96" stroke="#fff" stroke-width="1" opacity=".3" transform="translate(-.6 -1.6)"/>
    <circle cx="100" cy="75.6" r="5" fill="${C.body[2]}"/><circle cx="98.6" cy="74.2" r="1.6" fill="#fff" opacity=".4"/>
    ${knob}
    ${C.sig ? spark(p + 'sk', 185, 76, 7) : ''}`;
  }

  /* ---------- 찌: floats standing in calm water (the water is left out for the fishing game, which draws its own) —
     a stick float, a ball float (구멍찌) with its hole and stopper, an LED float that glows. The signature floats carry
     the mark on the body and glow blue at the top. ---------- */
  const WL = 80;
  function water(p, x, w, behind) {
    return behind
      ? `${lg(p + 'wa', 0, WL, 0, 120, [[0, '#7CC4FF', .28], [1, '#0B3D91', .55]])}<rect x="0" y="${WL}" width="240" height="${120 - WL}" fill="url(#${p}wa)"/>`
      : `<path d="M0 ${WL} H240" stroke="#BFE3FF" stroke-width=".8" opacity=".55"/>${[1, 2, 3].map(i => `<ellipse cx="${x}" cy="${WL + .4}" rx="${n(w * .6 + i * 17)}" ry="${n(1.6 + i * 1.3)}" fill="none" stroke="#E6F4FF" stroke-width="${n(1.1 - i * .25)}" opacity="${n(.75 - i * .2)}"/>`).join('')}`;
  }
  function stickFloat(p, C, o) {
    const x = 120, k = o.sig ? 1.42 : 1.18;
    const body = `M${x} 38 C${n(x + 9 * k)} 44 ${n(x + 9.5 * k)} 66 ${n(x + 6.4 * k)} 84 C${n(x + 4.6 * k)} 93 ${n(x + 2 * k)} 99 ${x} 101 C${n(x - 2 * k)} 99 ${n(x - 4.6 * k)} 93 ${n(x - 6.4 * k)} 84 C${n(x - 9.5 * k)} 66 ${n(x - 9 * k)} 44 ${x} 38 Z`;
    return `${lg(p + 'fb', x - 9 * k, 0, x + 9 * k, 0, [[0, C.body[2]], [.32, C.body[0]], [.58, C.body[1]], [1, C.body[2]]])}
      ${lg(p + 'ft', x - 2.2, 0, x + 2.2, 0, [[0, C.top[1]], [.4, C.top[0]], [1, C.top[1]]])}
      <clipPath id="${p}fc"><path d="${body}"/></clipPath>
      ${C.glow ? `${rg(p + 'gl', x, 12, 16, [[0, C.glow, .85], [.35, C.glow, .35], [1, C.glow, 0]])}<circle cx="${x}" cy="12" r="16" fill="url(#${p}gl)"/>` : ''}
      <path d="M${x} 2 V8" stroke="#2B2F36" stroke-width=".9"/>
      <rect x="${x - 2.2}" y="7" width="4.4" height="32" rx="2" fill="url(#${p}ft)"/>
      <rect x="${x - 2.2}" y="${7 + 12}" width="4.4" height="3" fill="${C.band || '#fff'}" opacity=".95"/><rect x="${x - 2.2}" y="${7 + 22}" width="4.4" height="2.6" fill="${C.band || '#fff'}" opacity=".95"/>
      <path d="${body}" fill="url(#${p}fb)"/>
      <g clip-path="url(#${p}fc)">
        <rect x="${x - 14}" y="47" width="28" height="5" fill="${C.ring}"/>
        <rect x="${x - 14}" y="${o.sig ? 91 : 70}" width="28" height="${o.sig ? 3 : 4}" fill="${C.ring}" opacity=".9"/>
        ${o.sig ? zzMark(p + 'm', x - 10.6, 55.4, 21, C.markStyle || 'silver', 0) : ''}
        <path d="M${x - 4.4} 44 C${x - 6.4} 58 ${x - 6} 76 ${x - 3.6} 90" fill="none" stroke="#fff" stroke-width="1.4" opacity=".5"/>
      </g>
      <path d="${body}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".6"/>
      <path d="M${x} 101 V114" stroke="#2B2F36" stroke-width="1.3"/><circle cx="${x}" cy="115.6" r="1.8" fill="none" stroke="#2B2F36" stroke-width="1"/>
      ${o.sig ? spark(p + 'sk', x, 6, 9, C.glow || '#5AB0FF') : ''}`;
  }
  function ballFloat(p, C, o) {
    const x = 120, cy = 66, r = 23;
    return `${rg(p + 'bf', x - 8, cy - 9, r * 1.3, [[0, C.body[0]], [.55, C.body[1]], [1, C.body[2]]])}
      ${rg(p + 'bt', x - 7, cy - 14, r, [[0, C.top[0]], [.6, C.top[1]], [1, C.top[2]]])}
      <clipPath id="${p}bc"><circle cx="${x}" cy="${cy}" r="${r}"/></clipPath>
      <path d="M${x} 2 V${cy - r}" stroke="#D7DEE6" stroke-width=".8" opacity=".9"/>
      <ellipse cx="${x}" cy="22" rx="3" ry="4" fill="#E11D2E"/><ellipse cx="${x - 1}" cy="20.6" rx="1" ry="1.3" fill="#fff" opacity=".6"/>
      <circle cx="${x}" cy="${cy}" r="${r}" fill="url(#${p}bf)"/>
      <g clip-path="url(#${p}bc)">
        <path d="M${x - r} ${cy - 2} C${x - 10} ${cy + 3} ${x + 10} ${cy + 3} ${x + r} ${cy - 2} V${cy - r} H${x - r} Z" fill="url(#${p}bt)"/>
        ${C.stripe ? `<path d="M${x - r} ${cy + 1} C${x - 10} ${cy + 6} ${x + 10} ${cy + 6} ${x + r} ${cy + 1}" fill="none" stroke="${C.stripe}" stroke-width="2.2"/>` : ''}
        ${o.sig ? zzMark(p + 'm', x - 4.6, cy - 19.4, 21, 'silver') : ''}
        <ellipse cx="${x - 8}" cy="${cy - 12}" rx="8" ry="5" transform="rotate(-25 ${x - 8} ${cy - 12})" fill="#fff" opacity=".45"/>
      </g>
      <circle cx="${x}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".7"/>
      <ellipse cx="${x}" cy="${cy - r + 1.4}" rx="2.4" ry="1.2" fill="#1A1D22"/>
      <path d="M${x} ${cy + r} V114" stroke="#D7DEE6" stroke-width=".8" opacity=".85"/>
      <ellipse cx="${x}" cy="${cy + r + 1}" rx="1.8" ry="1" fill="#1A1D22"/>
      ${o.sig ? spark(p + 'sk', x, cy - r - 2, 9, '#5AB0FF') : ''}`;
  }
  function floatArt(p, C, o) {
    o = o || {};
    const art = C.ball ? ballFloat(p, C, o) : stickFloat(p, C, o);
    if (!o.water) return art;
    // in the water: the part below the line a little blue and blurred, ripples around
    return `<defs><clipPath id="${p}up"><rect x="0" y="0" width="240" height="${WL}"/></clipPath><clipPath id="${p}dn"><rect x="0" y="${WL}" width="240" height="${120 - WL}"/></clipPath></defs>
      ${water(p, 120, C.ball ? 46 : 18, true)}
      <g clip-path="url(#${p}dn)" opacity=".55">${art.replace(/id="([^"]+)"/g, 'id="$1u"').replace(/url\(#([^)]+)\)/g, 'url(#$1u)')}</g>
      <g clip-path="url(#${p}up)">${art}</g>
      ${water(p, 120, C.ball ? 46 : 18, false)}`;
  }

  // the line: id, kind, drawing, price (the server's price wins), help in the park's solo game, how it is shown. Each kind
  // has a free basic piece; the signature (sig) pieces carry the ZZIRIT mark and cost a few weeks of winning.
  const R = (c, o) => p => rod(p, Object.assign({ cap: ['#111', '#4A4F57', '#25292F'], hood: ['#6E7682', '#E9EDF2', '#A9B1BC', '#5A616B'], guide: '#3A404A', trim: '#C9D2DD', text: '#fff', label: '1-530' }, c, o || {}));
  const RL = c => p => reel(p, Object.assign({ bail: '#C9D1DB', knob: ['#15181D', '#4A505A', '#22262D'] }, c));
  const FL = c => (p, o) => floatArt(p, c, Object.assign({ sig: !!c.sig }, o));
  const LIST = [
    { id: 'jighead', kind: 'lure', draw: jighead, tie: [190, 34.4], spec: '3.5g · 2"', price: 0, free: true, perk: null, bg: ['#20344F', '#0B1626'] },
    { id: 'spoon', kind: 'lure', draw: spoon, tie: [213.4, 58], spec: '7g', price: 100, perk: { reel: 1.15 }, bg: ['#4A3510', '#1A1206'] },
    { id: 'vib', kind: 'lure', draw: vib, tie: [171, 24.6], spec: '70mm · 14g', price: 150, perk: { tension: .85 }, bg: ['#2C3D0A', '#0F1504'] },
    { id: 'egi', kind: 'lure', draw: egi, tie: [215.6, 53.6], spec: ['3.5호', 'size 3.5', '3.5号', '3.5号'], price: 200, perk: { win: .3 }, bg: ['#4A2408', '#1A0C03'] },
    { id: 'tai', kind: 'lure', draw: tai, tie: [182, 4], spec: '60g', price: 300, perk: { sp: ['madai', 'kurodai'], x: 3 }, bg: ['#4A0E0E', '#180404'] },
    { id: 'jig', kind: 'lure', sig: true, draw: jig, tie: [220.4, 64.2], spec: '120mm · 40g', price: 800, perk: { wait: .7, trophy: 1.3 }, bg: ['#45173A', '#160712'] },
    { id: 'minnow', kind: 'lure', sig: true, draw: p => minnow(p, false), tie: [221.5, 84.6], spec: '110mm · 16g', price: 1000, perk: { trophy: 2 }, bg: ['#0E2C66', '#050E24'] },
    { id: 'gold', kind: 'lure', sig: true, draw: p => minnow(p, true), tie: [221.5, 84.6], spec: '110mm · 16g', price: null, prize: true, perk: { trophy: 2, reel: 1.1 }, bg: ['#4D3800', '#140E00'] },
    { id: 'rod_basic', kind: 'rod', draw: R({ grip: ['#14161A', '#3A3E45', '#202328'], seat: ['#7C8590', '#F0F3F6', '#B5BDC7', '#5E6670'], blank: ['#0E1013', '#4B5059', '#1E2126'], wrap: ['#2A2E35', '#6B727C', '#3A3F47'], label: '1-530' }), spec: ['1호 5.3m', '#1 · 5.3 m', '1号 5.3m', '1号 5.3米'], price: 0, free: true, perk: null, bg: ['#26303D', '#0D1117'], rodC: ['#1E2126', '#4B5059'] },
    { id: 'rod_iso', kind: 'rod', draw: R({ grip: ['#B98D55', '#E8C995', '#C9A06A'], tex: 'cork', seat: ['#4A4F57', '#9AA2AD', '#6B727C', '#30343A'], blank: ['#C9CCD0', '#FFFFFF', '#E8EAED'], wrap: ['#8E0B16', '#E3263A', '#B5121F'], trim: '#E8C46A', text: '#B5121F', label: '1-530' }), spec: ['1호 5.3m', '#1 · 5.3 m', '1号 5.3m', '1号 5.3米'], price: 150, perk: { tension: .92 }, bg: ['#3A2A22', '#120C09'], rodC: ['#E8EAED', '#B5121F'] },
    { id: 'rod_wine', kind: 'rod', draw: R({ grip: ['#14161A', '#3A3E45', '#202328'], seat: ['#8A6A1E', '#F5DE8A', '#C9A13A', '#6B4E10'], hood: ['#8A6A1E', '#F5DE8A', '#C9A13A', '#6B4E10'], blank: ['#3D0612', '#B11E3A', '#6E0E22'], wrap: ['#8A6A1E', '#F5DE8A', '#C9A13A'], trim: '#1A0A0E', text: '#F5DE8A', label: '1.5-530', guide: '#2A2E35' }), spec: ['1.5호 5.3m', '#1.5 · 5.3 m', '1.5号 5.3m', '1.5号 5.3米'], price: 250, perk: { tension: .88, win: .1 }, bg: ['#4A0E1C', '#16040A'], rodC: ['#6E0E22', '#F5DE8A'] },
    { id: 'rod_spark', kind: 'rod', sig: true, draw: R({ grip: ['#0B1530', '#2A3A5E', '#141F3A'], seat: ['#0A0C10', '#3A404A', '#15181D'], hood: ['#5E6670', '#E9EDF2', '#A9B1BC', '#454B54'], blank: ['#06143A', '#2F6BFF', '#0E2A6E'], wrap: ['#C9D2DD', '#FFFFFF', '#9AA4B2'], trim: '#2F6BFF', text: '#fff', label: 'ZZIRIT 1.5-530', sig: true }), spec: ['1.5호 5.3m', '#1.5 · 5.3 m', '1.5号 5.3m', '1.5号 5.3米'], price: 900, perk: { tension: .84, trophy: 1.2 }, bg: ['#10285E', '#040B1E'], rodC: ['#0E2A6E', '#2F6BFF'] },
    { id: 'rod_bolt', kind: 'rod', sig: true, draw: R({ grip: ['#0B1530', '#2A3A5E', '#141F3A'], seat: ['#0A0C10', '#3A404A', '#15181D'], hood: ['#1D4ED8', '#9BD0FF', '#3B82F6', '#0B2C7A'], blank: ['#7A8FB0', '#F4F8FF', '#9DB4DA', '#3D5E99'], wrap: ['#C2410C', '#FF8A4C', '#FF5A1F'], trim: '#0B1530', zig: '#FF5A1F', text: '#0B1530', label: 'ZZIRIT BOLT', sig: true, guide: '#2A2E35' }), spec: ['2호 5.3m', '#2 · 5.3 m', '2号 5.3m', '2号 5.3米'], price: 1200, perk: { tension: .78, win: .15, trophy: 1.3 }, bg: ['#173E86', '#050E24'], rodC: ['#9DB4DA', '#FF5A1F'] },
    { id: 'reel_basic', kind: 'reel', draw: RL({ body: ['#3A3F47', '#5E6670', '#1E2126'], cover: ['#4A505A', '#2A2E35', '#15181D'], rotor: ['#15181D', '#5E6670', '#2A2E35'], spool: ['#7C8590', '#F0F3F6', '#B5BDC7', '#5E6670'], line: ['#2C7A3A', '#7FD68C', '#3E9A4E'] }), spec: '2500', price: 0, free: true, perk: null, bg: ['#26303D', '#0D1117'], reelC: ['#3A3F47', '#B5BDC7'] },
    { id: 'reel_red', kind: 'reel', draw: RL({ body: ['#3A3F47', '#5E6670', '#1E2126'], cover: ['#E3263A', '#8E0B16', '#4A060C'], rotor: ['#15181D', '#5E6670', '#2A2E35'], spool: ['#8E0B16', '#FF6B76', '#C2121F', '#5A060C'], line: ['#C9D2DD', '#FFFFFF', '#E3E8EE'], knob: ['#8E0B16', '#FF6B76', '#C2121F'], accent: '#E3263A' }), spec: '2500', price: 180, perk: { reel: 1.08 }, bg: ['#3D1016', '#140507'], reelC: ['#3A3F47', '#E3263A'] },
    { id: 'reel_lbr', kind: 'reel', draw: RL({ body: ['#C9A13A', '#F5DE8A', '#8A6A1E'], cover: ['#F5DE8A', '#C9A13A', '#6B4E10'], rotor: ['#15181D', '#5E6670', '#2A2E35'], spool: ['#8A6A1E', '#F5DE8A', '#C9A13A', '#6B4E10'], line: ['#E8C46A', '#FFF3B0', '#D9A93A'], lb: '#C9A13A', knobT: 'paddle' }), spec: 'LB 2500', price: 250, perk: { reel: 1.12, win: .05 }, bg: ['#3D2E0A', '#140F03'], reelC: ['#C9A13A', '#F5DE8A'] },
    { id: 'reel_spark', kind: 'reel', sig: true, draw: RL({ body: ['#0E2A6E', '#2F6BFF', '#06143A'], cover: ['#1B3A73', '#0E2350', '#06143A'], rotor: ['#06143A', '#3B82F6', '#0E2350'], spool: ['#9AA4B2', '#FFFFFF', '#C9D2DD', '#6B727C'], line: ['#1D4ED8', '#7CC4FF', '#2F7BFF'], knob: ['#06143A', '#3B82F6', '#0E2350'], sig: true }), spec: '2500', price: 900, perk: { reel: 1.15, tension: .95 }, bg: ['#10285E', '#040B1E'], reelC: ['#0E2A6E', '#2F6BFF'] },
    { id: 'reel_bolt', kind: 'reel', sig: true, draw: RL({ body: ['#9DB4DA', '#F4F8FF', '#3D5E99'], cover: ['#1B3A73', '#0E2350', '#06143A'], rotor: ['#3D5E99', '#F4F8FF', '#7A8FB0'], spool: ['#C2410C', '#FF8A4C', '#FF5A1F', '#7A2A00'], line: ['#C9D2DD', '#FFFFFF', '#E3E8EE'], knob: ['#C2410C', '#FF8A4C', '#FF5A1F'], lb: '#FF5A1F', accent: '#FF5A1F', knobT: 'paddle', sig: true, markStyle: 'navy', drag: ['#0B1530', '#3A4A6E', '#141F3A'] }), spec: 'LB 2500', price: 1200, perk: { reel: 1.2, win: .1 }, bg: ['#173E86', '#050E24'], reelC: ['#9DB4DA', '#FF5A1F'] },
    { id: 'float_basic', kind: 'float', draw: FL({ body: ['#FFFFFF', '#E9ECEF', '#9AA4B2'], top: ['#FF5A1F', '#C2410C'], ring: '#15181D' }), spec: '1호', price: 0, free: true, perk: null, bg: ['#1E3A5F', '#0A1626'] },
    { id: 'float_ball', kind: 'float', draw: FL({ ball: true, body: ['#FFFFFF', '#E3E8EE', '#8E99A8'], top: ['#FFB27A', '#FF5A1F', '#C2410C'] }), spec: 'B', price: 100, perk: { win: .1 }, bg: ['#1E3A5F', '#0A1626'] },
    { id: 'float_led', kind: 'float', draw: FL({ body: ['#3A3F47', '#7C8590', '#15181D'], top: ['#B9FFB0', '#3BD45A'], ring: '#9AA4B2', band: '#E9FFE6', glow: '#4ADE80' }), spec: '1호 LED', price: 200, perk: { win: .15, wait: .92 }, bg: ['#0E2A2A', '#041010'] },
    { id: 'float_spark', kind: 'float', sig: true, draw: FL({ body: ['#1B3A73', '#3B6FD0', '#06143A'], top: ['#BFE3FF', '#3B8BFF'], ring: '#C9D2DD', band: '#E6F4FF', glow: '#5AB0FF', sig: true }), spec: '1호 LED', price: 800, perk: { win: .2, wait: .88 }, bg: ['#10285E', '#040B1E'] },
    { id: 'float_bolt', kind: 'float', sig: true, draw: FL({ ball: true, body: ['#F4F8FF', '#9DB4DA', '#3D5E99'], top: ['#FFD0B0', '#FF5A1F', '#C2410C'], stripe: '#0B1530', sig: true }), spec: 'B', price: 1000, perk: { win: .25, wait: .85 }, bg: ['#173E86', '#050E24'] }
  ];
  const KINDS = ['lure', 'rod', 'reel', 'float'];
  const BY = Object.fromEntries(LIST.map(x => [x.id, x]));
  // a picture of one piece; floats come in the water unless v === 'game' (the fishing game draws its own water)
  const inner = (id, pfx, v) => { const L = BY[id]; return L ? L.draw((pfx || 'zl') + id.replace(/_/g, ''), { water: L.kind === 'float' && v !== 'game' }) : ''; };
  const svg = (id, pfx, v) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="480" height="240">${inner(id, pfx, v)}</svg>`;
  const _url = new Map(), _img = new Map();
  function url(id, v) { const k = id + '|' + (v || ''); let u = _url.get(k); if (!u && BY[id]) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, '', v)); _url.set(k, u); } return u || ''; }
  function img(id, v) { const k = id + '|' + (v || ''); let im = _img.get(k); if (!im && BY[id]) { im = new Image(); im.decoding = 'async'; im.src = url(id, v); _img.set(k, im); } return im || null; }
  // the help of everything on the line together, kept within bounds so the game stays a game
  function perk(ids) {
    const o = { reel: 1, tension: 1, wait: 1, win: 0, trophy: 1, sp: null, x: 1 };
    for (const id of ids) {
      const P = id && BY[id] && BY[id].perk; if (!P) continue;
      if (P.reel) o.reel *= P.reel; if (P.tension) o.tension *= P.tension; if (P.wait) o.wait *= P.wait;
      if (P.win) o.win += P.win; if (P.trophy) o.trophy *= P.trophy; if (P.sp) { o.sp = P.sp; o.x = P.x; }
    }
    o.reel = Math.min(o.reel, 1.4); o.tension = Math.max(o.tension, .65); o.wait = Math.max(o.wait, .6); o.win = Math.min(o.win, .6); o.trophy = Math.min(o.trophy, 2.6);
    return o;
  }
  // the mark on its own (for pages): <svg> of the ZZIRIT fish, wave, line and spark
  const mark = (style = 'silver', pfx = 'zm') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 -4 122 110" aria-hidden="true">${zzMark(pfx, 0, 0, 120, style)}</svg>`;
  return { LIST, KINDS, BY, inner, svg, url, img, perk, mark };
})();
