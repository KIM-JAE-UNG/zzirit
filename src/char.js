/* ===== My character (original chibi angler) · profile picture ===== */
const CH = (() => {
  const SKIN = ['#FFE6D5', '#F8D3B5', '#EDBB8F', '#D39B6C', '#A8714C', '#764B32'];
  const HAIRC = [
    ['#2B2220', 1], ['#4A3226', 1], ['#7B4A2A', 1], ['#B8783C', 1], ['#E3B866', 1],
    ['#C94B2E', 4], ['#C9CBD6', 6], ['#4F79D6', 8], ['#E7779A', 10], ['#2C7A63', 12]
  ];
  const CLOTH = ['#FF5A1F', '#E8B531', '#3E8E5A', '#2F6FB5', '#24324A', '#7A4FC2', '#D9465B', '#F2F0EA', '#4C5A3E', '#5BB6C9'];
  const BG = ['#CDEBF5', '#FFE1CC', '#E3F4D7', '#F3DDF7', '#FFF1B8', '#D9E2FF', '#FFD6DE', '#2B3A4A'];
  // part id → unlock level (0/1 = from the start). 'gold' rod comes with the premium Golden Angler set.
  const P = {
    hs: { short: 1, buzz: 1, bowl: 1, long: 1, bob: 1, pony: 1, spiky: 3, curly: 5, bun: 7, wave: 9 },
    ey: { dot: 1, happy: 1, sleepy: 1, wink: 1, round: 1, sparkle: 3, sharp: 6, star: 11 },
    mo: { smile: 1, grin: 1, cat: 1, o: 1, flat: 1, tongue: 4 },
    ht: { none: 1, cap: 1, bucket: 1, beanie: 2, band: 3, straw: 5, visor: 8, captain: 15 },
    ou: { tee: 1, vest: 1, hoodie: 2, rain: 4, life: 6, wet: 10, captain: 15 },
    ac: { none: 1, glasses: 1, bandaid: 1, shades: 3, towel: 5, flower: 7, lamp: 9 },
    rd: { bamboo: 1, carbon: 1, lure: 6, sea: 11, gold: 'pr_gold' }
  };
  const ROD = { bamboo: ['#B88A4A', '#8A6232'], carbon: ['#23272E', '#D2412F'], lure: ['#2F6FD0', '#F2F2F2'], sea: ['#F2F2F2', '#2F6FB5'], gold: ['#F5C542', '#B8860B'] };
  const DEF = { v: 1, sk: 1, hs: 'short', hc: 0, ey: 'dot', mo: 'smile', ht: 'cap', htc: '#FF5A1F', ou: 'vest', ouc: '#3E8E5A', ac: 'none', rd: 'carbon', bg: '#CDEBF5' };
  const OL = '#2B2433';
  const hex = c => (/^#[0-9a-fA-F]{6}$/.test(String(c)) ? c : null);
  function norm(c) {
    const o = Object.assign({}, DEF, c || {});
    o.sk = clamp(parseInt(o.sk, 10) || 0, 0, SKIN.length - 1);
    o.hc = clamp(parseInt(o.hc, 10) || 0, 0, HAIRC.length - 1);
    for (const k of ['hs', 'ey', 'mo', 'ht', 'ou', 'ac', 'rd']) if (!(o[k] in P[k])) o[k] = DEF[k];
    o.htc = hex(o.htc) || DEF.htc; o.ouc = hex(o.ouc) || DEF.ouc; o.bg = hex(o.bg) || DEF.bg;
    return o;
  }
  // deterministic look for anglers who never made one (so every sea has its angler)
  function fromSeed(seed) {
    const r = FD.seeded(FD.hashStr(String(seed || 'x')));
    const pick = a => a[Math.floor(r() * a.length)];
    return norm({ sk: Math.floor(r() * 4), hs: pick(['short', 'bowl', 'long', 'bob', 'pony', 'buzz']), hc: Math.floor(r() * 5), ey: pick(['dot', 'happy', 'round', 'wink']), mo: pick(['smile', 'grin', 'cat']), ht: pick(['cap', 'bucket', 'none']), htc: pick(CLOTH), ou: pick(['tee', 'vest']), ouc: pick(CLOTH), ac: 'none', rd: pick(['bamboo', 'carbon']), bg: pick(BG) });
  }
  const sh = (h, a) => FD.shade(h, a);

  /* ---- parts (viewBox: body 0 0 120 132, head centered at 50,40) ---- */
  function hairBack(c, hc) {
    const d = {
      long: 'M23 40 C19 66 22 84 33 88 L67 88 C78 84 81 66 77 40 Z',
      bob: 'M22 40 C19 56 22 64 30 65 L70 65 C78 64 81 56 78 40 Z',
      pony: 'M66 22 C84 18 94 32 88 54 C86 60 80 62 78 58 C82 48 80 38 70 34 Z',
      bun: '', wave: 'M24 40 C21 54 23 60 28 62 L32 50 Z'
    }[c.hs];
    return d ? `<path d="${d}" fill="${hc}" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/>` : '';
  }
  function hairFront(c, hc) {
    const hi = sh(hc, .22);
    const f = (d, extra = '') => `<path d="${d}" fill="${hc}" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/>${extra}`;
    const shine = `<path d="M36 20 C40 16 46 15 50 15" stroke="${hi}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>`;
    switch (c.hs) {
      case 'buzz': return f('M26 37 C26 21 37 14 50 14 C63 14 74 21 74 37 C66 29 34 29 26 37 Z') + shine;
      case 'bowl': return f('M23 45 C21 22 35 12 50 12 C65 12 79 22 77 45 L73.5 45 C73.5 37 72 33 69 31.5 L31 31.5 C28 33 26.5 37 26.5 45 Z') + shine;
      case 'spiky': return f('M24 41 L21 28 L30 30 L27 17 L37 23 L38 10 L46 19 L51 8 L55 19 L64 10 L64 23 L73 17 L70 30 L79 28 L76 41 C70 33 62 29.5 50 30.5 C38 29.5 30 33 24 41 Z');
      case 'long': return f('M24 45 C21 22 36 12 50 12 C64 12 79 22 76 45 C74 34 66 27.5 52 26.5 L50 31 L48 26.5 C34 27.5 26 34 24 45 Z') + shine;
      case 'bob': return f('M23 46 C20 22 35 12 50 12 C65 12 80 22 77 46 C75 36 70 31 63 30 C58 33 52 33.5 46 31.5 C40 33 31 34 27 38 C25 40 24 43 23 46 Z') + shine;
      case 'curly': return f('M24 42 C17 37 21 26 28 26 C27 18 36 13 42 17 C45 10 55 10 58 17 C64 13 73 18 72 26 C79 26 83 37 76 42 C72 36 66 34.5 60 35.5 C56 31 44 31 40 35.5 C34 34.5 28 36 24 42 Z');
      case 'bun': return f('M24 42 C22 22 36 13 51 13 C66 13 78 22 76 42 C72 33 66 29 59 29.5 C54 33 46 33 41 30 C35 31.5 28 35 24 42 Z') + `<circle cx="50" cy="10" r="7.5" fill="${hc}" stroke="${OL}" stroke-width="1.6"/>` + shine;
      case 'wave': return f('M24 45 C19 24 34 12 52 12 C70 12 81 24 76 41 C71 29 61 24.5 47 28.5 C39 31 31 37 24 45 Z') + shine;
      case 'pony': return f('M24 42 C22 22 36 12.5 51 12.5 C66 12.5 78 22 76 42 C72 32.5 66 28.5 59 29 C54 33 46 33.5 40 30.5 C34 32 28 35.5 24 42 Z') + `<rect x="68" y="27" width="6" height="5" rx="2" fill="${sh(c.htc, -.1)}" stroke="${OL}" stroke-width="1.2"/>` + shine;
      default: return f('M24 42 C22 22 36 12 51 12 C66 12 78 22 76 42 C72 32 66 28.5 60 29.5 C56 33.5 49 34 43.5 31 C39 34 33.5 35 29.5 33.5 C27 36 25 39 24 42 Z') + shine; // short
    }
  }
  function eyes(c) {
    const D = OL;
    const dot = (x) => `<ellipse cx="${x}" cy="44.5" rx="3.1" ry="3.9" fill="${D}"/><circle cx="${x + 1.1}" cy="43" r="1.15" fill="#fff"/>`;
    const arc = (x, up = true) => `<path d="M${x - 3.6} ${up ? 45.6 : 43.8} Q${x} ${up ? 40.6 : 48} ${x + 3.6} ${up ? 45.6 : 43.8}" stroke="${D}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    switch (c.ey) {
      case 'happy': return arc(41) + arc(59);
      case 'sleepy': return `<path d="M37.2 45 Q41 47.6 44.8 45" stroke="${D}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M55.2 45 Q59 47.6 62.8 45" stroke="${D}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      case 'wink': return arc(41) + dot(59);
      case 'round': return [41, 59].map(x => `<circle cx="${x}" cy="44.5" r="4.2" fill="#fff" stroke="${D}" stroke-width="1.4"/><circle cx="${x + .6}" cy="44.8" r="2.1" fill="${D}"/><circle cx="${x + 1.3}" cy="43.9" r=".7" fill="#fff"/>`).join('');
      case 'sparkle': return [41, 59].map(x => `<ellipse cx="${x}" cy="44.3" rx="3.9" ry="4.8" fill="${D}"/><ellipse cx="${x}" cy="45.4" rx="2.6" ry="3" fill="#3B6EA8"/><circle cx="${x + 1.3}" cy="42.6" r="1.5" fill="#fff"/><circle cx="${x - 1.2}" cy="46.4" r=".8" fill="#fff"/>`).join('');
      case 'sharp': return `<path d="M36.6 42.4 L45.2 44.2 L44.4 47.2 Q40 48 37.2 45.6 Z" fill="${D}"/><path d="M63.4 42.4 L54.8 44.2 L55.6 47.2 Q60 48 62.8 45.6 Z" fill="${D}"/><circle cx="42.4" cy="45" r=".8" fill="#fff"/><circle cx="57.6" cy="45" r=".8" fill="#fff"/>`;
      case 'star': return [41, 59].map(x => `<ellipse cx="${x}" cy="44.5" rx="3.6" ry="4.4" fill="${D}"/><path d="M${x} 41.6 l.9 1.9 2 .3 -1.5 1.4 .4 2 -1.8-1 -1.8 1 .4-2 -1.5-1.4 2-.3z" fill="#FFE27A"/>`).join('');
      default: return dot(41) + dot(59);
    }
  }
  function brows(c, hc) {
    const col = sh(hc, -.15);
    if (c.ey === 'sharp') return `<path d="M36.5 38.6 L45 40.4" stroke="${col}" stroke-width="2" stroke-linecap="round"/><path d="M63.5 38.6 L55 40.4" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`;
    if (c.ey === 'round') return `<path d="M37 36.4 Q41 34.4 45 36" stroke="${col}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M55 36 Q59 34.4 63 36.4" stroke="${col}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    return `<path d="M37.4 38 Q41 36.6 44.6 37.8" stroke="${col}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M55.4 37.8 Q59 36.6 62.6 38" stroke="${col}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  }
  function mouth(c) {
    const D = OL, M = '#7A2E3A';
    switch (c.mo) {
      case 'grin': return `<path d="M45.4 51 Q50 57.6 54.6 51 Z" fill="${M}" stroke="${D}" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="50" cy="54.4" rx="2.2" ry="1.3" fill="#F2848F"/>`;
      case 'cat': return `<path d="M45.6 51.2 Q47.8 54.2 50 51.2 Q52.2 54.2 54.4 51.2" stroke="${D}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      case 'o': return `<ellipse cx="50" cy="52.6" rx="2.1" ry="2.5" fill="${M}" stroke="${D}" stroke-width="1.2"/>`;
      case 'flat': return `<path d="M46.6 52.4 L53.4 52.4" stroke="${D}" stroke-width="1.8" stroke-linecap="round"/>`;
      case 'tongue': return `<path d="M46.4 51.4 Q50 54.6 53.6 51.4" stroke="${D}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M50.2 53.2 q2.6 .2 2.4 2.6 q-.3 2-2.2 1.8 q-1.8-.2-1.6-2.2z" fill="#F2848F" stroke="${D}" stroke-width="1"/>`;
      default: return `<path d="M46 51.2 Q50 55.4 54 51.2" stroke="${D}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    }
  }
  function hat(c) {
    const col = c.htc, dk = sh(col, -.2), lt = sh(col, .25);
    const s = `stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"`;
    switch (c.ht) {
      case 'cap': return `<path d="M24 34 C24 18 36 10.5 50 10.5 C64 10.5 76 18 76 34 Z" fill="${col}" ${s}/><path d="M68 33 C80 31.5 90 34 93 37.5 C85 39.5 74 38.5 65 36 Z" fill="${dk}" ${s}/><path d="M50 10.5 L50 33" stroke="${dk}" stroke-width="1.2" opacity=".6"/><circle cx="50" cy="11" r="2" fill="${dk}" stroke="${OL}" stroke-width="1"/><path d="M30 26 C34 18 42 14.5 49 14" stroke="${lt}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`;
      case 'bucket': return `<path d="M27 32.5 C27 17 38 11.5 50 11.5 C62 11.5 73 17 73 32.5 Z" fill="${col}" ${s}/><path d="M17 35 C29 29 71 29 83 35 C85 38.5 81 40.5 76 39 C64 35.6 36 35.6 24 39 C19 40.5 15 38.5 17 35 Z" fill="${dk}" ${s}/><path d="M28 29 C40 26.5 60 26.5 72 29" stroke="${lt}" stroke-width="1.6" fill="none" opacity=".7"/>`;
      case 'beanie': return `<path d="M24 37 C23 18 36 9.5 50 9.5 C64 9.5 77 18 76 37 Z" fill="${col}" ${s}/><rect x="22.5" y="33" width="55" height="8" rx="4" fill="${dk}" ${s}/><circle cx="50" cy="8" r="5.5" fill="${lt}" ${s}/><path d="M33 33 V24 M41 33 V19 M50 33 V17 M59 33 V19 M67 33 V24" stroke="${dk}" stroke-width="1.1" opacity=".55"/>`;
      case 'band': return `<path d="M24.5 31 Q50 24.5 75.5 31 L75.5 35.5 Q50 29 24.5 35.5 Z" fill="${col}" ${s}/><path d="M75 33 l8 -4 l-1 6 l5 2 l-8 2 z" fill="${dk}" ${s}/>`;
      case 'straw': return `<path d="M7 34 C20 26.5 80 26.5 93 34 C97 37.5 88 40.5 80 38.2 C64 34 36 34 20 38.2 C12 40.5 3 37.5 7 34 Z" fill="#E8C877" ${s}/><path d="M30 32 C30 16.5 40 11 50 11 C60 11 70 16.5 70 32 Z" fill="#F0D58C" ${s}/><path d="M30.5 27.5 Q50 23.5 69.5 27.5 L69.8 31.4 Q50 27.4 30.2 31.4 Z" fill="${col}"/><path d="M14 35.5 C30 31.5 70 31.5 86 35.5" stroke="#C9A85A" stroke-width="1" fill="none" opacity=".7"/>`;
      case 'visor': return `<path d="M25 31 Q50 23 75 31 L75 35 Q50 27 25 35 Z" fill="${col}" ${s}/><path d="M60 30 C74 28.5 88 31 92 35 C82 37 70 36 58 34 Z" fill="${dk}" ${s}/>`;
      case 'captain': return `<path d="M25 31 L24 21 C24 13 76 13 76 21 L75 31 Z" fill="#F7F7F2" ${s}/><rect x="24.5" y="26" width="51" height="6" fill="#1F2B45" ${s}/><path d="M28 31.5 C40 37 60 37 72 31.5 L72 34 C60 40 40 40 28 34 Z" fill="#121822" ${s}/><circle cx="50" cy="22" r="4.2" fill="#E9B949" stroke="${OL}" stroke-width="1.1"/><path d="M50 19.6 V24.4 M48 22 H52" stroke="${OL}" stroke-width="1"/>`;
      default: return '';
    }
  }
  function acc(c, front) {
    const s = `stroke="${OL}" stroke-width="1.4"`;
    switch (c.ac) {
      case 'glasses': return front ? `<circle cx="41" cy="44.5" r="5.6" fill="#fff" fill-opacity=".16" ${s}/><circle cx="59" cy="44.5" r="5.6" fill="#fff" fill-opacity=".16" ${s}/><path d="M46.6 44 Q50 42.6 53.4 44" stroke="${OL}" stroke-width="1.4" fill="none"/>` : '';
      case 'shades': return front ? `<path d="M34.5 41 H47.5 L46.6 46.6 Q41 50 36 46.6 Z" fill="#1E2430" ${s}/><path d="M52.5 41 H65.5 L64 46.6 Q59 50 53.4 46.6 Z" fill="#1E2430" ${s}/><path d="M47.5 42 H52.5" stroke="${OL}" stroke-width="1.4"/><path d="M37 42.6 L40 42.6 M55 42.6 L58 42.6" stroke="#fff" stroke-width="1.2" opacity=".6"/>` : '';
      case 'bandaid': return front ? `<g transform="rotate(-18 64.5 50.5)"><rect x="59.5" y="48.6" width="10" height="4" rx="2" fill="#F2C9A0" stroke="${OL}" stroke-width="1"/><path d="M63.5 50.6 h2" stroke="#C99A72" stroke-width="1.6"/></g>` : '';
      case 'towel': return front ? `<path d="M34 64 Q50 71 66 64 L67 69 Q50 76 33 69 Z" fill="#F7F7F2" ${s}/><path d="M60 67 L63 82 L57 82 L55.5 69 Z" fill="#F7F7F2" ${s}/><path d="M57.4 77 H62.4" stroke="#5BB6C9" stroke-width="1.6"/><path d="M37 67 Q50 72 63 67" stroke="#5BB6C9" stroke-width="1.4" fill="none"/>` : '';
      case 'flower': return front ? `<g transform="translate(68 24)">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-4" rx="2.6" ry="3.6" fill="#FF8FB0" stroke="${OL}" stroke-width=".9" transform="rotate(${r})"/>`).join('')}<circle r="2.2" fill="#FFD84A" stroke="${OL}" stroke-width=".9"/></g>` : '';
      case 'lamp': return front ? `<path d="M25 30.5 Q50 25 75 30.5" stroke="#2A2F38" stroke-width="3.2" fill="none"/><rect x="44.5" y="23.5" width="11" height="8" rx="2.5" fill="#3B4250" ${s}/><circle cx="50" cy="27.5" r="2.6" fill="#FFF3B0"/><circle cx="50" cy="27.5" r="6" fill="#FFF3B0" opacity=".25"/>` : '';
      default: return '';
    }
  }
  function outfit(c, skin) {
    const col = c.ouc, dk = sh(col, -.2), lt = sh(col, .2);
    const s = `stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"`;
    const torso = (fill) => `<path d="M33 70 Q50 63 67 70 L69.5 100 Q50 104.5 30.5 100 Z" fill="${fill}" ${s}/>`;
    const sleeve = (fill) => `<path d="M34 71 Q27 76 26.5 85 L32.5 86.5 Q33.5 80 37 77 Z" fill="${fill}" ${s}/><path d="M66 71 Q72 74 75 82 L69.5 85 Q67.5 80 63.5 77 Z" fill="${fill}" ${s}/>`;
    switch (c.ou) {
      case 'tee': return torso(col) + `<path d="M43.5 66.5 Q50 71 56.5 66.5" stroke="${OL}" stroke-width="1.4" fill="${skin}"/>` + sleeve(col) + `<path d="M40 82 Q50 86 60 82" stroke="${lt}" stroke-width="2" fill="none" opacity=".6"/>`;
      case 'hoodie': return `<path d="M36 67 Q50 58 64 67 Q60 73 50 73 Q40 73 36 67 Z" fill="${dk}" ${s}/>` + torso(col) + sleeve(col) + `<path d="M40 88 H60 L58 97 H42 Z" fill="${dk}" ${s}/><path d="M46 70 V80 M54 70 V80" stroke="#F7F7F2" stroke-width="1.4" stroke-linecap="round"/>`;
      case 'rain': return torso(col) + sleeve(col) + `<path d="M40 66 Q50 72 60 66 L58 70 Q50 75 42 70 Z" fill="${dk}" ${s}/><path d="M50 72 V101" stroke="${OL}" stroke-width="1.2"/><circle cx="53" cy="80" r="1.4" fill="${OL}"/><circle cx="53" cy="88" r="1.4" fill="${OL}"/><circle cx="53" cy="96" r="1.4" fill="${OL}"/>`;
      case 'life': return torso('#F2F0EA') + sleeve('#F2F0EA') + `<path d="M34 70 Q41 66 46 68 L45 101 Q38 101 31 99.5 Z" fill="#FF6A1F" ${s}/><path d="M66 70 Q59 66 54 68 L55 101 Q62 101 69 99.5 Z" fill="#FF6A1F" ${s}/><path d="M32.5 84 H45.5 M54.5 84 H67.5" stroke="#D8DDE3" stroke-width="2.6"/><path d="M45 92 H55" stroke="${OL}" stroke-width="2.4"/><rect x="48" y="90" width="4" height="4" fill="#2A2F38"/>`;
      case 'wet': return torso('#23272E') + sleeve('#23272E') + `<path d="M34 74 L37 99 M66 74 L63 99" stroke="${col}" stroke-width="3"/><path d="M44 67 Q50 70 56 67" stroke="${col}" stroke-width="2" fill="none"/>`;
      case 'captain': return torso('#1F2B45') + sleeve('#1F2B45') + `<path d="M42 66 L50 76 L58 66" fill="#F7F7F2" ${s}/><path d="M50 76 V101" stroke="#121822" stroke-width="1.2"/>${[80, 88, 96].map(y => `<circle cx="46" cy="${y}" r="1.4" fill="#E9B949"/><circle cx="54" cy="${y}" r="1.4" fill="#E9B949"/>`).join('')}<path d="M26.8 83.5 L32.6 84.8 M69.6 83.5 L75 81.2" stroke="#E9B949" stroke-width="2"/>`;
      default: // fishing vest over a light shirt
        return torso('#E9EEF2') + sleeve('#E9EEF2') + `<path d="M34 70 Q40 66 45.5 67.5 L44.5 101 Q37 101 31 99.5 Z" fill="${col}" ${s}/><path d="M66 70 Q60 66 54.5 67.5 L55.5 101 Q63 101 69 99.5 Z" fill="${col}" ${s}/><rect x="35" y="80" width="7.5" height="7" rx="1.2" fill="${dk}" ${s}/><rect x="57.5" y="80" width="7.5" height="7" rx="1.2" fill="${dk}" ${s}/><rect x="35.5" y="90" width="7" height="6" rx="1.2" fill="${dk}" stroke="${OL}" stroke-width="1.2"/><path d="M58 72 l5 1.5" stroke="${lt}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  function legs(c) {
    const pants = c.ou === 'wet' ? '#23272E' : c.ou === 'captain' ? '#1F2B45' : '#2E3A5C';
    const boot = c.ou === 'rain' ? c.ouc : '#3A3F4B';
    const s = `stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"`;
    return `<path d="M37.5 99 H49 V117 H38.5 Z" fill="${pants}" ${s}/><path d="M51 99 H62.5 L61.5 117 H51 Z" fill="${pants}" ${s}/>
      <path d="M36.5 115 H49.5 V121.5 Q49.5 123.5 47.5 123.5 H35.5 Q33.5 123.5 34 121 Z" fill="${boot}" ${s}/><path d="M50.5 115 H63.5 L66 121 Q66.5 123.5 64.5 123.5 H52.5 Q50.5 123.5 50.5 121.5 Z" fill="${boot}" ${s}/>`;
  }
  function arms(c, skin, rod) {
    const sleeves = c.ou !== 'tee';
    const col = c.ou === 'life' || c.ou === 'vest' ? '#E9EEF2' : c.ou === 'wet' ? '#23272E' : c.ou === 'captain' ? '#1F2B45' : c.ouc;
    const s = `stroke="${OL}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
    // left arm hangs; right arm reaches forward to hold the rod
    const L = sleeves ? `<path d="M30 79 Q27.5 86 28.5 91.5" stroke="${OL}" stroke-width="8.6" fill="none" stroke-linecap="round"/><path d="M30 79 Q27.5 86 28.5 91.5" stroke="${col}" stroke-width="5.6" fill="none" stroke-linecap="round"/>`
      : `<path d="M30 80 Q27.5 86 28.5 91.5" stroke="${OL}" stroke-width="7.6" fill="none" stroke-linecap="round"/><path d="M30 80 Q27.5 86 28.5 91.5" stroke="${skin}" stroke-width="4.6" fill="none" stroke-linecap="round"/>`;
    const R = rod ? `<path d="M71 80 Q75 85 77 89" stroke="${OL}" stroke-width="8.6" fill="none" stroke-linecap="round"/><path d="M71 80 Q75 85 77 89" stroke="${sleeves ? col : skin}" stroke-width="5.6" fill="none" stroke-linecap="round"/>`
      : `<path d="M70 79 Q73 86 72 91.5" stroke="${OL}" stroke-width="8.6" fill="none" stroke-linecap="round"/><path d="M70 79 Q73 86 72 91.5" stroke="${sleeves ? col : skin}" stroke-width="5.6" fill="none" stroke-linecap="round"/>`;
    const hands = `<circle cx="28.7" cy="93" r="3.9" fill="${skin}" ${s}/><circle cx="${rod ? 77.6 : 72}" cy="${rod ? 90.6 : 93}" r="3.9" fill="${skin}" ${s}/>`;
    return L + R + hands;
  }
  function rodSVG(c) {
    const [a, b] = ROD[c.rd] || ROD.carbon;
    return `<path d="M73 98 L113 6" stroke="${OL}" stroke-width="3.4" stroke-linecap="round"/><path d="M73 98 L113 6" stroke="${a}" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M74.5 94.6 L77.4 88" stroke="${b}" stroke-width="2.6" stroke-linecap="round"/><circle cx="72.5" cy="94" r="3.6" fill="#9AA3AD" stroke="${OL}" stroke-width="1.2"/><circle cx="72.5" cy="94" r="1.2" fill="${OL}"/>
      <path d="M113 6 Q118 34 110 64" stroke="#fff" stroke-width=".9" fill="none" opacity=".85"/>${c.rd === 'gold' ? '<path d="M100 30 l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill="#FFF3B0"/>' : ''}`;
  }
  function head(c) {
    const skin = SKIN[c.sk], hc = HAIRC[c.hc][0];
    const s = `stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"`;
    return `<circle cx="25.5" cy="43.5" r="4.4" fill="${skin}" ${s}/><circle cx="74.5" cy="43.5" r="4.4" fill="${skin}" ${s}/>
      <ellipse cx="50" cy="40.5" rx="25.5" ry="24" fill="${skin}" ${s}/>
      <ellipse cx="35.6" cy="50.2" rx="3.9" ry="2.3" fill="#FF8A8A" opacity=".38"/><ellipse cx="64.4" cy="50.2" rx="3.9" ry="2.3" fill="#FF8A8A" opacity=".38"/>
      ${eyes(c)}${brows(c, hc)}<path d="M49.6 48.6 Q50.6 49.4 49.9 50.3" stroke="${OL}" stroke-width=".9" fill="none" opacity=".45" stroke-linecap="round"/>${mouth(c)}
      ${hairFront(c, hc)}${hat(c)}${acc(c, true)}`;
  }
  /* mode: 'full' (with rod, for previews) · 'body' (no rod, the sea scene draws it) · 'head' (avatar) */
  function svg(cfg, mode = 'full') {
    const c = norm(cfg); const skin = SKIN[c.sk];
    const rod = mode === 'full';
    const neck = `<rect x="45" y="58" width="10" height="9" rx="3" fill="${sh(skin, -.08)}" stroke="${OL}" stroke-width="1.4"/>`;
    const body = `${legs(c)}${outfit(c, skin)}${neck}${c.ac === 'towel' ? acc(c, true) : ''}${arms(c, skin, mode !== 'head')}`;
    const inner = `${mode === 'head' ? '' : '<ellipse cx="50" cy="126" rx="21" ry="3.2" fill="#000" opacity=".16"/>'}${hairBack(c, HAIRC[c.hc][0])}${rod ? rodSVG(c) : ''}${body}${head(Object.assign({}, c, { ac: c.ac === 'towel' ? 'none' : c.ac }))}`;
    const vb = mode === 'head' ? '13 4 74 74' : mode === 'body' ? '14 2 72 128' : '8 0 112 130';
    const w = mode === 'head' ? 74 : mode === 'body' ? 72 : 112, h = mode === 'head' ? 74 : mode === 'body' ? 128 : 130;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w * 2}" height="${h * 2}">${inner}</svg>`;
  }
  const _url = new Map();
  function url(cfg, mode = 'head') {
    const key = mode + JSON.stringify(norm(cfg));
    let u = _url.get(key);
    if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(cfg, mode)); if (_url.size > 400) _url.clear(); _url.set(key, u); }
    return u;
  }
  const _img = new Map();
  function image(cfg, mode = 'body') {
    const u = url(cfg, mode); let im = _img.get(u);
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = u; if (_img.size > 60) _img.clear(); _img.set(u, im); }
    return im;
  }
  function locked(part, id) {
    const need = P[part] && P[part][id];
    if (need == null) return false;
    if (typeof need === 'string') return !paidFor(need);
    return myLevel() < need;
  }
  function needOf(part, id) { const n = P[part] && P[part][id]; return typeof n === 'number' ? n : n ? 'pr' : 1; }
  function hairLocked(i) { return myLevel() < HAIRC[i][1]; }
  // parts above the angler's level (or an unpaid gold rod) fall back to the default part
  function fit(c, a, uid) {
    const mine = a === S.me || (uid && uid === myId());
    const L = mine ? myLevel() : lvInfo(a, uid).L;
    const o = Object.assign({}, c);
    for (const k of ['hs', 'ey', 'mo', 'ht', 'ou', 'ac', 'rd']) {
      const need = P[k][o[k]];
      const lockedHere = typeof need === 'number' ? need > L : typeof need === 'string' ? (mine ? !paidFor(need) : false) : false;
      if (lockedHere) o[k] = DEF[k];
    }
    if (HAIRC[o.hc] && HAIRC[o.hc][1] > L) o.hc = 0;
    return o;
  }
  return { SKIN, HAIRC, CLOTH, BG, P, ROD, DEF, norm, fromSeed, svg, url, image, locked, needOf, hairLocked, fit };
})();

function charOf(a, uid) { return a && a.char ? CH.fit(CH.norm(a.char), a, uid || avatarUid(a)) : CH.fromSeed(uid || (a && a.nick) || 'x'); }
function safeColor(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c)) ? c : '#CDEBF5'; }

/* ---- avatars: character face, uploaded photo, or the first letter ---- */
function avatarUid(a) { return a ? (a._uid || ((a === S.me || a._local) ? myId() : null)) : null; }
function picHidden(uid, a) { const m = S.admin.mod && S.admin.mod.av; return !!(m && uid && a && a.pic && m[uid] && m[uid] >= a.pic); }
function avatar(a, size = 36) {
  const nick = (a && a.nick) || '?';
  const uid = avatarUid(a);
  const fl = flairOf(a, uid);
  const cls = 'avatar' + (fl.gold ? ' gold' : fl.frame ? ' framed' : '');
  const mode = a ? (a.av || 'char') : 'init';
  const letter = esc([...nick][0] || '?');
  if (mode === 'pic' && a.pic && uid && !picHidden(uid, a)) {
    const key = uid + '/_pic@' + a.pic; const src = S.photoCache.get(key);
    return `<span class="${cls} pic" style="--s:${size}px;--h:${FD.hashStr(nick) % 360}" data-av="${esc(uid)}|${esc(String(a.pic))}" aria-hidden="true">${src ? `<img src="${src}" alt="">` : letter}</span>`;
  }
  if (mode !== 'init' && a && (a.char || uid || a.nick)) { const ch = charOf(a, uid); return `<span class="${cls} chr" style="--s:${size}px;--cbg:${safeColor(ch.bg)}" aria-hidden="true"><img src="${CH.url(ch, 'head')}" alt="" loading="lazy"></span>`; }
  return `<span class="${cls}" style="--h:${FD.hashStr(nick) % 360};--s:${size}px" aria-hidden="true">${letter}</span>`;
}
function nickHTML(a) { return `<span class="nick${flairOf(a).gold ? ' gold' : ''}">${esc((a && a.nick) || '?')}</span>`; }
async function loadAvatarPhoto(uid, ts) {
  const key = uid + '/_pic@' + ts;
  if (S.photoCache.has(key)) return S.photoCache.get(key);
  let v = null;
  if (uid === myId() && S._myPic && S._myPic.ts === +ts) v = S._myPic.t;
  else if (S.db) { try { const d = await S.db.doc('anglers/' + uid + '/photos/_pic').get(); v = d.exists ? d.data().t : null; } catch (e) { v = null; } }
  else if (uid === myId()) { const ph = lsGet('photos', {}); v = ph._pic || null; }
  S.photoCache.set(key, v); return v;
}
function hydrateAvatars(root = document) {
  for (const n of root.querySelectorAll('[data-av]:not([data-avok])')) {
    n.dataset.avok = '1';
    const [uid, ts] = n.dataset.av.split('|');
    loadAvatarPhoto(uid, ts).then(src => { if (src && n.isConnected) n.innerHTML = `<img src="${src}" alt="">`; });
  }
}
(() => { let tm = null; const mo = new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => hydrateAvatars(), 60); }); const go = () => mo.observe(document.body, { childList: true, subtree: true }); if (document.body) go(); else addEventListener('DOMContentLoaded', go); })();

/* ---- character page ---- */
const CH_TABS = [['sk', 'ch_t_skin'], ['hs', 'ch_t_hair'], ['hc', 'ch_t_haircolor'], ['ey', 'ch_t_eyes'], ['mo', 'ch_t_mouth'], ['ht', 'ch_t_hat'], ['htc', 'ch_t_hatcolor'], ['ou', 'ch_t_outfit'], ['ouc', 'ch_t_outfitcolor'], ['ac', 'ch_t_acc'], ['rd', 'ch_t_rod'], ['bg', 'ch_t_bg']];
VIEWS.char = {
  render(el) {
    if (!S.me || !S.me.nick) { el.innerHTML = `<div class="page char"><header class="page-head"><h1>${t('ch_title')}</h1></header><div class="empty card big">${icon('user', 'big')}<h2>${t('onb_card_title')}</h2><p class="muted">${t('ch_need_profile')}</p><button class="btn btn-primary" data-act="onboard">${t('onb_go')}</button></div></div>`; return; }
    if (!S.chDraft) S.chDraft = CH.norm(S.me.char || charOf(S.me, myId()));
    S.chTab = S.chTab || 'hs';
    const li = lvInfo(S.me, myId());
    const pct = Math.round((li.xp - li.cur) / Math.max(1, li.next - li.cur) * 100);
    const mode = S.me.av || 'char';
    el.innerHTML = `
    <div class="page char">
      <header class="page-head"><h1>${t('ch_title')}</h1><p class="lede">${t('ch_sub')}</p></header>
      <div class="char-grid">
        <section class="card char-stage">
          <div class="char-big" id="ch-big" style="--cbg:${safeColor(S.chDraft.bg)}"><img src="${CH.url(S.chDraft, 'full')}" alt="${esc(t('ch_title'))}"></div>
          <div class="char-id"><h2>${nickHTML(S.me)}</h2><p><span class="lv-chip big">Lv.${li.L}</span> <b>${esc(li.title)}</b></p></div>
          <div class="xp-row"><div class="meter xp"><i style="width:${pct}%"></i></div><span class="num small">${fmtN(li.xp)} / ${fmtN(li.next)} XP</span></div>
          <p class="hint">${t('xp_how')}</p>
          <div class="pic-pick">
            <p class="lbl">${t('pf_pic')}</p>
            <div class="seg seg-sm" role="radiogroup">${['char', 'pic', 'init'].map(k => `<button aria-pressed="${mode === k}" data-avmode="${k}">${t('pf_pic_' + k)}</button>`).join('')}</div>
            <div class="pic-row">${avatar(S.me, 56)}<label class="btn btn-line btn-sm" for="ch-pic">${icon('image')}${t(S.me.pic ? 'pf_pic_change' : 'pf_pic_upload')}</label><input type="file" id="ch-pic" accept="image/*" hidden>${S.me.pic ? `<button class="btn btn-ghost btn-sm" data-avmode="rmpic">${t('pf_pic_remove')}</button>` : ''}</div>
            <p class="hint">${t('pf_pic_note')}</p>
          </div>
        </section>
        <section class="card char-edit">
          <div class="ch-mini" id="ch-mini" style="--cbg:${safeColor(S.chDraft.bg)}"><img src="${CH.url(S.chDraft, 'head')}" alt=""></div>
          <div class="ch-tabs" role="tablist">${CH_TABS.map(([k, key]) => `<button role="tab" aria-selected="${S.chTab === k}" data-chtab="${k}">${t(key)}</button>`).join('')}</div>
          <div class="ch-opts" id="ch-opts">${this.optsHTML()}</div>
          <div class="actions"><button class="btn btn-primary" id="ch-save">${icon('check')}${t('ch_save')}</button><button class="btn btn-line" id="ch-rand">${icon('refresh')}${t('ch_random')}</button><button class="btn btn-ghost" id="ch-undo">${t('ch_undo')}</button></div>
        </section>
      </div>
    </div>`;
    this.bind(el);
  },
  optsHTML() {
    const d = S.chDraft; const k = S.chTab;
    const lockTag = need => `<span class="lock">${icon('lock')}${need === 'pr' ? t('premium') : 'Lv.' + need}</span>`;
    if (k === 'sk') return `<div class="sw-grid">${CH.SKIN.map((c, i) => `<button class="swc${d.sk === i ? ' on' : ''}" style="--c:${c}" data-chset="sk|${i}" aria-label="${esc(t('ch_t_skin'))} ${i + 1}"></button>`).join('')}</div>`;
    if (k === 'hc') return `<div class="part-grid head hc-prev"><button class="part on" disabled style="--cbg:${safeColor(d.bg)}"><img src="${CH.url(Object.assign({}, d, { ht: 'none' }), 'head')}" alt=""></button></div><div class="sw-grid">${CH.HAIRC.map(([c, lv], i) => { const lk = CH.hairLocked(i); return `<button class="swc${d.hc === i ? ' on' : ''}${lk ? ' locked' : ''}" style="--c:${c}" data-chset="hc|${i}" ${lk ? 'disabled' : ''} aria-label="${esc(t('ch_t_haircolor'))} ${i + 1}">${lk ? lockTag(lv) : ''}</button>`; }).join('')}</div>`;
    if (k === 'htc' || k === 'ouc') return `<div class="sw-grid">${CH.CLOTH.map(c => `<button class="swc${d[k] === c ? ' on' : ''}" style="--c:${c}" data-chset="${k}|${c}" aria-label="${c}"></button>`).join('')}</div>`;
    if (k === 'bg') return `<div class="sw-grid">${CH.BG.map(c => `<button class="swc${d.bg === c ? ' on' : ''}" style="--c:${c}" data-chset="bg|${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const mode = k === 'ou' || k === 'rd' ? 'full' : 'head';
    return `<div class="part-grid ${mode}">${Object.keys(CH.P[k]).map(id => {
      const lk = CH.locked(k, id); const v = Object.assign({}, d, { [k]: id }, k === 'hs' ? { ht: 'none' } : {});
      return `<button class="part${d[k] === id ? ' on' : ''}${lk ? ' locked' : ''}" data-chset="${k}|${id}" ${lk ? 'disabled' : ''} style="--cbg:${safeColor(d.bg)}"><img src="${CH.url(v, mode)}" alt="" loading="lazy">${lk ? lockTag(CH.needOf(k, id)) : ''}</button>`;
    }).join('')}</div>`;
  },
  refresh(el) {
    const big = $('#ch-big', el); if (big) { big.style.setProperty("--cbg", safeColor(S.chDraft.bg)); big.innerHTML = `<img src="${CH.url(S.chDraft, 'full')}" alt="">`; }
    const o = $('#ch-opts', el); if (o) o.innerHTML = this.optsHTML();
    const mini = $('#ch-mini', el); if (mini) { mini.style.setProperty('--cbg', safeColor(S.chDraft.bg)); mini.innerHTML = `<img src="${CH.url(S.chDraft, 'head')}" alt="">`; }
  },
  bind(el) {
    el.onclick = e => {
      const tb = e.target.closest('[data-chtab]'); if (tb) { S.chTab = tb.dataset.chtab; $$('[data-chtab]', el).forEach(b => b.setAttribute('aria-selected', String(b === tb))); this.refresh(el); return; }
      const st = e.target.closest('[data-chset]'); if (st && !st.disabled) { const [k, v] = st.dataset.chset.split('|'); S.chDraft[k] = k === 'sk' || k === 'hc' ? +v : v; this.refresh(el); return; }
      const am = e.target.closest('[data-avmode]'); if (am) { setAvatarMode(am.dataset.avmode); return; }
    };
    $('#ch-save', el).onclick = async () => {
      S.me.char = CH.fit(CH.norm(S.chDraft), S.me, myId()); if (!S.me.av || S.me.av === 'init') S.me.av = 'char';
      await store.saveMe(); S.dataVer++; toast(t('ch_saved')); rerender();
    };
    $('#ch-rand', el).onclick = () => {
      const r = Math.random; const pick = (part) => { const ids = Object.keys(CH.P[part]).filter(id => !CH.locked(part, id)); return ids[Math.floor(r() * ids.length)]; };
      const hcs = CH.HAIRC.map((x, i) => i).filter(i => !CH.hairLocked(i));
      Object.assign(S.chDraft, { sk: Math.floor(r() * CH.SKIN.length), hs: pick('hs'), hc: hcs[Math.floor(r() * hcs.length)], ey: pick('ey'), mo: pick('mo'), ht: pick('ht'), htc: CH.CLOTH[Math.floor(r() * CH.CLOTH.length)], ou: pick('ou'), ouc: CH.CLOTH[Math.floor(r() * CH.CLOTH.length)], ac: r() < .5 ? 'none' : pick('ac'), rd: pick('rd'), bg: CH.BG[Math.floor(r() * CH.BG.length)] });
      this.refresh(el);
    };
    $('#ch-undo', el).onclick = () => { S.chDraft = CH.norm(S.me.char || charOf(S.me, myId())); this.refresh(el); };
    const pic = $('#ch-pic', el); if (pic) pic.onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) uploadAvatarPhoto(f); };
  }
};
async function setAvatarMode(m) {
  if (!S.me) return;
  if (m === 'rmpic') { delete S.me.pic; S.me.av = S.me.char ? 'char' : 'init'; await store.saveMe(); store.deletePhoto('_pic'); toast(t('pf_pic_removed')); rerender(); return; }
  if (m === 'pic' && !S.me.pic) { const inp = $('#ch-pic'); if (inp) inp.click(); return; }
  if (m === 'char' && !S.me.char) S.me.char = CH.norm(S.chDraft || charOf(S.me, myId()));
  S.me.av = m; await store.saveMe(); S.dataVer++; toast(t('saved')); rerender();
}
async function uploadAvatarPhoto(file) {
  try {
    const { im, url } = await loadImageFile(file);
    const side = Math.min(im.naturalWidth, im.naturalHeight); const sx = (im.naturalWidth - side) / 2, sy = (im.naturalHeight - side) / 2;
    const c = document.createElement('canvas'); c.width = c.height = 192;
    c.getContext('2d').drawImage(im, sx, sy, side, side, 0, 0, 192, 192); URL.revokeObjectURL(url);
    const data = c.toDataURL('image/jpeg', .82);
    const ts = nowMs();
    S._myPic = { ts, t: data }; S.photoCache.set(myId() + '/_pic@' + ts, data);
    await store.savePhoto('_pic', { t: data });
    S.me.pic = ts; S.me.av = 'pic'; await store.saveMe(); S.dataVer++;
    toast(t('pf_pic_saved')); rerender();
  } catch (e) { console.warn(e); toast(t('img_decode_err'), 'warn'); }
}
