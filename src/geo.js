/* ===== Geography: regions, sea names, environment raster, catch priors ===== */
const GEO = (() => {
  const EA_BOX = [100, 0, 160, 60];
  const inBox = (lon, lat, b) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
  function pip(lon, lat, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  /* Korean waters used for catch priors */
  const KRP = {
    KJ: [[125.75,33.0],[126.3,32.7],[127.1,32.85],[127.35,33.35],[127.05,33.85],[126.2,33.9],[125.8,33.6]],
    KS: [[126.0,34.25],[126.3,33.95],[126.95,33.75],[127.35,33.35],[128.3,33.25],[128.95,33.6],[129.2,34.6],[129.35,35.05],[129.05,35.25],[128.5,35.1],[127.6,34.95],[126.9,34.85],[126.3,34.75]],
    KE: [[129.05,35.25],[129.35,35.05],[130.2,35.3],[131.2,36.2],[132.6,37.4],[132.4,38.7],[128.35,38.75],[128.6,38.0],[129.3,37.0],[129.5,36.0]],
    KW: [[124.0,38.8],[126.6,38.0],[126.9,37.4],[126.8,36.8],[126.6,36.0],[126.6,35.2],[126.3,34.75],[126.0,34.25],[125.3,33.9],[124.0,34.5]]
  };
  const JPP = [[129.5,33.0],[130.6,34.3],[131.5,35.9],[132.6,37.4],[134.0,38.4],[135.5,39.5],[138.5,42.5],[140.5,45.8],[146.2,45.2],[146.6,42.5],[143.0,39.8],[142.6,36.0],[140.6,33.4],[137.0,32.4],[133.0,31.3],[131.0,29.8],[129.0,30.8]];
  const CNP = [[117.5,41.2],[122.5,41.2],[124.0,39.9],[124.0,34.5],[125.3,33.9],[125.6,31.5],[123.5,28.0],[121.5,25.0],[119.5,22.0],[117.0,21.4],[112.0,19.0],[108.0,17.8],[105.8,21.5],[109.0,22.6],[117.0,24.6],[119.5,27.0],[121.0,30.5],[120.5,33.0],[119.0,35.0],[117.5,38.0]];
  const MDP = [[-6,36],[-5,35.8],[0,35],[10,33],[20,30.3],[33,30.8],[36.6,35.5],[36.2,37],[28,41],[42,41.3],[41,47.3],[30,46.9],[28,44.5],[26,41],[20,42],[13,45.9],[9,44.5],[3.5,43.5],[-2,37]];
  const GMP = [[-98,30.2],[-90,30.6],[-82,30.2],[-80.0,25.6],[-75,23.2],[-60,18],[-60,9.5],[-77,7.3],[-84,9.8],[-88,15.8],[-97.5,18]];

  function region(lon, lat, water) {
    lon = ((lon + 540) % 360) - 180;
    if (water) {
      for (const k of ['KJ', 'KS', 'KE', 'KW']) if (pip(lon, lat, KRP[k])) return k;
      if (inBox(lon, lat, [119.0, 21.5, 122.6, 26.0])) return 'TW';
      if (pip(lon, lat, JPP) || inBox(lon, lat, [122.5, 23.8, 131.5, 30.6])) return 'JP';
      if (pip(lon, lat, CNP)) return 'CN';
      if (lat >= 66) return 'AR';
      if (pip(lon, lat, MDP)) return 'MD';
      if (pip(lon, lat, GMP)) return 'GM';
      if (lat > 42.5 && lon >= 128 && lon <= 142) return 'NP';
      if (inBox(lon, lat, [135, 43, 163, 62])) return 'NP';
      if (inBox(lon, lat, [117, 20, 147, 47])) {
        const REP = [['KW', 124.6, 36.2], ['KS', 127.8, 34.1], ['KE', 130.4, 37.3], ['KJ', 126.5, 33.0], ['JP', 132.5, 33.0], ['JP', 137.5, 39.5], ['JP', 141.5, 37.5], ['JP', 129.5, 28.5], ['CN', 122.0, 29.0], ['CN', 120.5, 34.5], ['TW', 120.8, 23.5]];
        let best = 'JP', bd = 1e9; for (const [k, x, y] of REP) { const d = (x - lon) ** 2 + (y - lat) ** 2; if (d < bd) { bd = d; best = k; } }
        return best;
      }
      if (lat > -25 && lat < 23.5 && (lon >= 90 || lon <= -140)) return 'ST';
      if (lat >= 18 && lat <= 23.5 && lon >= -161 && lon <= -154) return 'ST';
      if (lon >= 20 && lon < 100 && lat >= -45 && lat < 31) return 'IO';
      if (lat >= 20 && lon > -82 && lon < 30) return 'NA';
      if (lat >= 23.5 && (lon >= 120 || lon <= -110)) return 'NP';
      if (lat <= -25 && lat >= -55 && lon >= 110) return 'AU';
      if (lat < 0 && lat >= -60 && lon > -70 && lon < 20) return 'SA';
      if (lat > -25 && lat < 23.5) return lon > -100 && lon < 20 ? 'SA' : 'ST';
      return 'OC';
    }
    if (inBox(lon, lat, [124.4, 33.0, 130.0, 38.7])) return 'KF';
    if (inBox(lon, lat, [129.3, 30.9, 146.2, 45.7]) && !inBox(lon, lat, [124, 33, 129.6, 43])) return 'JF';
    if (inBox(lon, lat, [87, 41, 120, 52.5])) return 'FA';
    if (inBox(lon, lat, [73, 18, 135, 54])) return 'CF';
    if (inBox(lon, lat, [-25, 35, 45, 72])) return 'FE';
    if (inBox(lon, lat, [-170, 15, -50, 75])) return 'FN';
    if (inBox(lon, lat, [-82, -56, -34, 13])) return 'FS';
    if (inBox(lon, lat, [-18, -35, 52, 37])) return 'FF';
    if (inBox(lon, lat, [110, -50, 180, -10])) return 'FO';
    return 'FA';
  }
  const KR = r => ['KW', 'KS', 'KE', 'KJ', 'KF'].includes(r);
  /* Representative point for each home water */
  const HOME = { KW: [126.10, 36.70], KS: [128.40, 34.70], KE: [129.45, 36.00], KJ: [126.55, 33.20], KF: [127.70, 36.80], JP: [139.8, 35.3], JF: [136.0, 35.25], CN: [122.2, 30.5], CF: [116.3, 29.1], TW: [120.2, 22.6], ST: [120.9, 14.3], NP: [-123.5, 48.3], NA: [-70.5, 41.6], GM: [-86.0, 29.9], MD: [5.4, 43.2], AU: [151.3, -33.9], IO: [72.9, 18.9], SA: [-43.1, -22.95], FN: [-89.4, 43.1], FE: [10.0, 51.0], FS: [-60.0, -3.1], FA: [106.9, 47.9], FO: [145.0, -36.0], FF: [32.6, 0.3] };
  const FRESH = { KF: 1, JF: 1, CF: 1, FN: 1, FE: 1, FS: 1, FA: 1, FO: 1, FF: 1 };

  /* Seas for naming: [id, [ko,en,ja,zh], polygon, label point, label min zoom] */
  const SEAS = [
    ['bohai', ['발해', 'Bohai Sea', '渤海', '渤海'], [[117.6,38.2],[118.5,39.1],[119.4,39.9],[121.0,40.9],[122.2,40.5],[121.2,38.8],[120.8,37.8],[119.2,37.2],[118.2,37.6]], [120.0, 39.0], 5],
    ['jeju', ['제주 연안', 'Jeju waters', '済州島周辺', '济州岛海域'], KRP.KJ, [126.55, 32.95], 7],
    ['kstrait', ['대한해협', 'Korea Strait', '対馬海峡', '朝鲜海峡'], [[128.6,34.6],[129.2,34.1],[130.0,33.5],[130.6,33.9],[130.3,34.6],[129.6,35.3],[128.9,35.2]], [129.5, 34.45], 6],
    ['south', ['남해', 'South Sea (Korea)', '韓国南岸', '韩国南部海域'], KRP.KS, [127.6, 34.25], 6],
    ['west', ['서해(황해)', 'Yellow Sea', '黄海', '黄海'], [[119.2,35.0],[120.6,36.3],[121.6,37.4],[122.6,37.4],[122.5,39.6],[124.4,39.8],[125.5,38.6],[126.6,37.7],[126.8,36.5],[126.4,34.8],[126.0,34.2],[125.0,33.6],[123.0,32.6],[121.8,31.7],[120.8,32.6],[119.8,34.5]], [123.6, 36.0], 4],
    ['eastsea', ['동해', 'East Sea (Sea of Japan)', '日本海', '日本海'], [[129.2,35.2],[129.7,35.6],[130.4,34.2],[131.5,34.6],[133.0,35.6],[136.0,36.0],[137.5,37.0],[139.5,38.5],[140.0,40.5],[139.8,43.0],[141.3,45.5],[142.0,46.3],[140.0,48.5],[138.5,47.5],[135.5,43.7],[131.5,42.6],[130.6,42.3],[129.8,41.0],[128.5,39.5],[128.4,38.6],[129.4,37.0],[129.5,36.0]], [134.5, 40.0], 4],
    ['seto', ['세토내해', 'Seto Inland Sea', '瀬戸内海', '濑户内海'], [[131.0,33.9],[132.0,34.0],[133.0,34.4],[134.0,34.7],[135.3,34.7],[135.1,34.25],[134.0,34.2],[133.3,33.9],[132.2,33.4],[131.5,33.6]], [133.3, 34.2], 7],
    ['ecs', ['동중국해', 'East China Sea', '東シナ海', '东海'], [[121.0,30.5],[122.3,31.4],[123.0,32.6],[125.0,33.6],[126.0,33.0],[127.5,32.5],[129.0,32.0],[130.2,31.0],[129.5,29.0],[127.0,26.5],[125.0,24.8],[122.0,25.0],[120.0,26.5],[121.0,28.5]], [125.5, 29.5], 4],
    ['taiwan', ['대만해협', 'Taiwan Strait', '台湾海峡', '台湾海峡'], [[117.5,23.4],[119.5,25.5],[120.0,26.4],[121.6,25.2],[120.3,22.5],[118.5,22.3]], [119.6, 24.2], 6],
    ['scs', ['남중국해', 'South China Sea', '南シナ海', '南海'], [[105.5,10.0],[108.0,18.5],[110.5,21.0],[114.0,22.4],[117.5,23.4],[120.5,22.0],[120.6,18.5],[120.0,14.5],[119.0,10.0],[117.5,7.5],[115.0,5.0],[111.0,2.5],[108.0,2.0],[104.0,1.5],[103.5,5.0],[104.5,8.5]], [114.0, 14.0], 4],
    ['phil', ['필리핀해', 'Philippine Sea', 'フィリピン海', '菲律宾海'], [[121.5,12.0],[122.5,18.5],[122.0,24.5],[125.0,24.8],[127.0,26.5],[129.5,29.0],[131.0,30.5],[136.0,33.5],[139.5,34.8],[142.0,26.0],[145.0,15.0],[136.0,6.5],[127.5,6.5],[126.0,8.0]], [132.0, 20.0], 4],
    ['okhotsk', ['오호츠크해', 'Sea of Okhotsk', 'オホーツク海', '鄂霍次克海'], [[135.0,54.5],[141.5,52.5],[142.5,46.0],[144.0,44.0],[146.0,43.5],[150.0,45.5],[156.5,50.8],[156.0,57.5],[152.0,59.5],[142.0,59.2]], [149.0, 53.5], 4],
    ['bering', ['베링해', 'Bering Sea', 'ベーリング海', '白令海'], [[162.0,58.0],[166.0,55.0],[170.0,52.5],[180,51.5],[180,66],[176,65.0],[170.0,60.0]], [176.0, 58.0], 4],
    ['bering2', ['베링해', 'Bering Sea', 'ベーリング海', '白令海'], [[-180,51.5],[-165,54.0],[-160,58.6],[-165,60.5],[-166,65.5],[-180,66]], null, 9],
    ['alaska', ['알래스카만', 'Gulf of Alaska', 'アラスカ湾', '阿拉斯加湾'], [[-160,55.5],[-153,56.5],[-147,60.5],[-140,59.8],[-135,57.0],[-134,54.5],[-145,53.0],[-155,53.5]], [-146.0, 57.0], 4],
    ['gom', ['멕시코만', 'Gulf of Mexico', 'メキシコ湾', '墨西哥湾'], [[-97.5,27.5],[-97.4,22.0],[-94.0,18.3],[-90.5,19.5],[-87.0,21.3],[-84.9,22.0],[-81.0,23.2],[-80.4,25.2],[-82.5,28.5],[-84.5,30.0],[-89.0,30.4],[-94.0,29.6]], [-90.0, 25.5], 4],
    ['carib', ['카리브해', 'Caribbean Sea', 'カリブ海', '加勒比海'], [[-87.0,21.3],[-84.9,21.9],[-80.0,22.8],[-74.2,20.2],[-68.0,18.6],[-64.0,18.3],[-61.5,16.5],[-61.0,12.5],[-62.0,10.6],[-71.0,12.0],[-76.0,9.0],[-81.5,9.0],[-83.5,10.9],[-83.2,15.0],[-87.6,15.9]], [-75.0, 15.0], 4],
    ['med', ['지중해', 'Mediterranean Sea', '地中海', '地中海'], [[-5.6,36.0],[-2,35.3],[3,36.8],[10.5,33.8],[20,30.4],[32.5,31.0],[35.5,33.5],[36.0,36.8],[28.0,36.5],[26.5,40.0],[23,40.6],[19.5,41.8],[13.0,45.7],[12.3,44.0],[9.5,44.3],[3.2,43.3],[0.5,40.7],[-2.0,36.8]], [18.0, 35.0], 4],
    ['black', ['흑해', 'Black Sea', '黒海', '黑海'], [[27.5,42.0],[28.5,44.5],[30.0,46.4],[33.5,46.0],[36.6,45.4],[38.0,47.1],[39.5,47.2],[41.5,41.6],[36.5,41.3],[33.5,42.0],[29.2,41.2]], [34.5, 43.3], 5],
    ['red', ['홍해', 'Red Sea', '紅海', '红海'], [[32.5,29.9],[34.5,28.0],[35.0,28.0],[38.5,22.0],[43.4,12.6],[43.1,12.7],[38.5,18.0],[36.0,22.0],[33.5,27.0]], [38.0, 20.5], 5],
    ['persian', ['페르시아만', 'Persian Gulf', 'ペルシャ湾', '波斯湾'], [[48.0,30.0],[50.3,29.3],[56.5,26.5],[56.4,24.0],[51.5,24.0],[50.0,26.0],[48.5,28.0]], [51.5, 27.0], 5],
    ['arabian', ['아라비아해', 'Arabian Sea', 'アラビア海', '阿拉伯海'], [[51.0,12.0],[58.0,16.5],[60.0,22.8],[67.0,24.8],[73.0,19.0],[76.5,8.5],[73.0,0.0],[52.0,0.0]], [64.0, 13.0], 4],
    ['bengal', ['벵골만', 'Bay of Bengal', 'ベンガル湾', '孟加拉湾'], [[80.0,6.0],[80.3,13.0],[86.5,19.5],[89.0,22.0],[91.5,22.5],[94.0,18.0],[98.0,10.0],[95.0,5.5]], [88.0, 14.0], 4],
    ['java', ['자바해', 'Java Sea', 'ジャワ海', '爪哇海'], [[105.5,-6.0],[106.0,-3.0],[110.0,-2.8],[116.0,-3.5],[116.0,-7.5],[112.5,-6.8],[108.0,-6.8]], [111.0, -5.0], 5],
    ['coral', ['산호해', 'Coral Sea', '珊瑚海', '珊瑚海'], [[142.5,-10.5],[146.0,-15.0],[150.0,-22.0],[153.5,-24.5],[158.0,-24.0],[163.0,-20.0],[162.0,-11.0],[150.0,-10.5]], [155.0, -16.0], 4],
    ['tasman', ['태즈먼해', 'Tasman Sea', 'タスマン海', '塔斯曼海'], [[150.0,-37.5],[153.5,-29.0],[159.0,-30.0],[166.0,-34.0],[172.6,-34.4],[168.0,-46.5],[146.5,-43.6]], [160.0, -38.0], 4],
    ['north', ['북해', 'North Sea', '北海', '北海'], [[-2.5,51.0],[1.5,51.0],[4.5,52.5],[8.5,53.6],[8.5,57.0],[6.0,58.2],[5.0,61.0],[-1.0,61.0],[-3.0,58.6],[-2.0,55.8],[0.2,53.3]], [3.0, 56.0], 5],
    ['baltic', ['발트해', 'Baltic Sea', 'バルト海', '波罗的海'], [[10.0,54.0],[14.0,53.9],[21.0,54.4],[24.0,57.0],[30.0,60.0],[25.0,60.4],[21.5,61.0],[22.0,65.8],[17.0,61.5],[18.5,59.0],[16.5,56.2],[12.5,56.0]], [19.0, 57.5], 5],
    ['norw', ['노르웨이해', 'Norwegian Sea', 'ノルウェー海', '挪威海'], [[-5,62],[5,61],[12,66],[18,70],[15,72],[0,72],[-8,66]], [4.0, 66.5], 4],
    ['hudson', ['허드슨만', 'Hudson Bay', 'ハドソン湾', '哈德逊湾'], [[-95,58],[-87,55.5],[-80,51.5],[-77,56],[-78,62.5],[-87,64],[-94,61]], [-86.0, 59.5], 4]
  ];
  const OCEAN = {
    npac: ['북태평양', 'North Pacific Ocean', '北太平洋', '北太平洋'], spac: ['남태평양', 'South Pacific Ocean', '南太平洋', '南太平洋'],
    natl: ['북대서양', 'North Atlantic Ocean', '北大西洋', '北大西洋'], satl: ['남대서양', 'South Atlantic Ocean', '南大西洋', '南大西洋'],
    ind: ['인도양', 'Indian Ocean', 'インド洋', '印度洋'], arc: ['북극해', 'Arctic Ocean', '北極海', '北冰洋'], sou: ['남극해', 'Southern Ocean', '南極海', '南大洋']
  };
  const OCEAN_LABELS = [[-150, 30, 'npac'], [165, 25, 'npac'], [-130, -25, 'spac'], [-40, 32, 'natl'], [-18, -22, 'satl'], [80, -20, 'ind'], [0, 80, 'arc'], [60, -62, 'sou']];
  function seaOf(lon, lat) {
    lon = ((lon + 540) % 360) - 180;
    for (const s of SEAS) if (pip(lon, lat, s[2])) return { id: s[0], n: s[1] };
    let k;
    if (lat >= 66) k = 'arc'; else if (lat <= -60) k = 'sou';
    else if (lon >= 20 && lon < 120 && lat < 30) k = lon > 100 && lat > -10 ? 'npac' : 'ind';
    else if (lon > -70 && lon < 20) k = lat >= 0 ? 'natl' : 'satl';
    else if (lon >= -100 && lon <= -70 && lat > 8) k = 'natl';
    else k = lat >= 0 ? 'npac' : 'spac';
    return { id: k, n: OCEAN[k] };
  }

  /* Environment raster: R water, G distance to coast (2 km units), B depth class x50 */
  let ENV = null, envLoading = null;
  function loadEnv() {
    if (!envLoading) envLoading = new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
          ENV = { w: img.width, h: img.height, d: x.getImageData(0, 0, img.width, img.height).data };
        } catch (e) { console.warn('env', e); }
        res(ENV);
      };
      img.onerror = () => res(null);
      img.src = 'geo/env.png';
    });
    return envLoading;
  }
  function envAt(lon, lat) {
    if (!ENV) return null;
    lon = ((lon + 540) % 360) - 180;
    const x = Math.min(ENV.w - 1, Math.max(0, Math.floor((lon + 180) / 360 * ENV.w)));
    const y = Math.min(ENV.h - 1, Math.max(0, Math.floor((90 - lat) / 180 * ENV.h)));
    const i = (y * ENV.w + x) * 4, d = ENV.d;
    return { water: d[i] > 127, dist: d[i + 1] * 2, depth: Math.round(d[i + 2] / 50) };
  }

  /* Season & habitat model */
  function seasonVal(sp, m, lat) {
    const mo = sp.mo;
    if (lat < -23.5) return +mo[(m + 6) % 12];
    if (Math.abs(lat) < 23.5) { let a = 0; for (let i = 0; i < 12; i++) a += +mo[i]; return .6 * a / 12 + .4 * +mo[m]; }
    return +mo[m];
  }
  function fit(sp, e) {
    if (!e) return 1;
    const brack = sp.w === 'B' || sp.z === 'brack';
    if (e.water) {
      if (sp.w === 'F' && !brack) return e.dist <= 6 ? .08 : 0;
      const d = e.dist;
      switch (sp.z) {
        case 'shore': return d <= 16 ? 1 : Math.exp(-(d - 16) / 12);
        case 'coast': return d <= 40 ? 1 : Math.exp(-(d - 40) / 30);
        case 'shelf': return e.depth <= 1 ? 1 : e.depth === 2 ? .45 : .15;
        case 'offshore': return e.depth >= 2 ? 1 : (d > 25 ? .7 : .35);
        case 'deep': return e.depth >= 2 ? 1 : (d > 30 ? .5 : .25);
        case 'brack': return d <= 12 ? 1 : Math.exp(-(d - 12) / 8);
        default: return 1;
      }
    }
    if (sp.w === 'S') return e.dist <= 4 ? .25 : 0;
    if (brack) return e.dist <= 25 ? .9 : .2;
    return 1;
  }
  function weightsAt(e, rg, m, lat) {
    const out = [];
    for (const sp of SP) {
      const ab = sp.ab[rg]; if (!ab) continue;
      const f = fit(sp, e); if (f <= 0) continue;
      const s = seasonVal(sp, m, lat);
      const w = Math.pow(ab, 1.3) * (.15 + s) / 3.15 * f * (1.25 - .15 * sp.r);
      if (w > 0) out.push([sp.id, w]);
    }
    return out;
  }
  /* Prior distribution at a point: samples a small neighbourhood so coastal points mix sea & fresh */
  function prior(lon, lat, m, r = .08) {
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
    const acc = new Map(); let n = 0;
    for (const [dx, dy] of pts) {
      const lo = lon + dx, la = lat + dy, e = envAt(lo, la);
      const water = e ? e.water : true;
      const rg = region(lo, la, water);
      for (const [id, w] of weightsAt(e, rg, m, la)) acc.set(id, (acc.get(id) || 0) + w);
      n++;
    }
    let tot = 0; for (const v of acc.values()) tot += v;
    const res = new Map();
    if (tot > 0) for (const [k, v] of acc) res.set(k, v / tot);
    return res;
  }
  /* Region-level prior (no environment), for home pages */
  function regionPrior(rg, m) {
    const lat = (HOME[rg] || [0, 36])[1];
    const out = []; let tot = 0;
    for (const sp of SP) {
      const ab = sp.ab[rg]; if (!ab) continue;
      const s = seasonVal(sp, m, lat);
      const w = Math.pow(ab, 1.3) * (.15 + s) / 3.15 * (1.25 - .15 * sp.r);
      out.push([sp.id, w, s]); tot += w;
    }
    return out.map(([id, w, s]) => ({ id, p: w / tot, s })).sort((a, b) => b.p - a.p);
  }
  /* Grid cells */
  const inEA = (lon, lat) => inBox(lon, lat, EA_BOX);
  function cellSize(lon, lat, z) { if (z != null && z <= 3) return 2; if (inEA(lon, lat)) return z != null && z <= 5 ? .5 : .25; return 1; }
  function cellKey(lon, lat, size) { return size + ':' + Math.floor(lat / size) + ':' + Math.floor(lon / size); }
  function dms(v, pos, neg) {
    const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
    return `${d}°${m.toFixed(1).padStart(4, '0')}′${v >= 0 ? pos : neg}`;
  }
  const fmtLL = (lat, lon) => `${dms(lat, 'N', 'S')} ${dms(((lon + 540) % 360) - 180, 'E', 'W')}`;

  return { region, KR, HOME, FRESH, SEAS, OCEAN, OCEAN_LABELS, seaOf, loadEnv, envAt, prior, regionPrior, seasonVal, fit, weightsAt, inEA, cellSize, cellKey, fmtLL, pip, EA_BOX, get ENV() { return ENV; } };
})();

/* ===== Lunar calendar & Korean tide phase (물때) ===== */
const TIDE = (() => {
  const rad = d => d * Math.PI / 180;
  function newMoonJDE(k) {
    const T = k / 1236.85;
    let jde = 2451550.09766 + 29.530588861 * k + .00015437 * T * T - .00000015 * T ** 3 + .00000000073 * T ** 4;
    const E = 1 - .002516 * T - .0000074 * T * T;
    const M = rad(2.5534 + 29.1053567 * k - .0000014 * T * T - .00000011 * T ** 3);
    const Mp = rad(201.5643 + 385.81693528 * k + .0107582 * T * T + .00001238 * T ** 3 - .000000058 * T ** 4);
    const F = rad(160.7108 + 390.67050284 * k - .0016118 * T * T - .00000227 * T ** 3 + .000000011 * T ** 4);
    const Om = rad(124.7746 - 1.56375588 * k + .0020672 * T * T + .00000215 * T ** 3);
    const s = Math.sin;
    jde += -.4072 * s(Mp) + .17241 * E * s(M) + .01608 * s(2 * Mp) + .01039 * s(2 * F) + .00739 * E * s(Mp - M) - .00514 * E * s(Mp + M)
      + .00208 * E * E * s(2 * M) - .00111 * s(Mp - 2 * F) - .00057 * s(Mp + 2 * F) + .00056 * E * s(2 * Mp + M) - .00042 * s(3 * Mp)
      + .00042 * E * s(M + 2 * F) + .00038 * E * s(M - 2 * F) - .00024 * E * s(2 * Mp - M) - .00017 * s(Om) - .00007 * s(Mp + 2 * M)
      + .00004 * s(2 * Mp - 2 * F) + .00004 * s(3 * M) + .00003 * s(Mp + M - 2 * F) + .00003 * s(2 * Mp + 2 * F) - .00003 * s(Mp + M + 2 * F)
      + .00003 * s(Mp - M + 2 * F) - .00002 * s(Mp - M - 2 * F) - .00002 * s(3 * Mp + M) + .00002 * s(4 * Mp);
    return jde;
  }
  const jdeToMs = jde => (jde - 2440587.5) * 86400000 - 69000;
  const KST = 9 * 3600000;
  const dayIndexKST = ms => Math.floor((ms + KST) / 86400000);
  function lunar(date) {
    const ms = date.getTime();
    const today = dayIndexKST(ms);
    let k = Math.floor(((ms / 86400000 + 2440587.5) - 2451550.09766) / 29.530588861) + 1;
    let nm = jdeToMs(newMoonJDE(k));
    while (dayIndexKST(nm) > today) { k--; nm = jdeToMs(newMoonJDE(k)); }
    while (dayIndexKST(jdeToMs(newMoonJDE(k + 1))) <= today) { k++; nm = jdeToMs(newMoonJDE(k)); }
    const day = today - dayIndexKST(nm) + 1;
    const age = (ms - nm) / 86400000;
    return { day, age, nextNew: jdeToMs(newMoonJDE(k + 1)) };
  }
  /* 8물때식 (남해·동해): 음력 1일 = 8물 … 7일 = 14물, 8일 = 조금, 9일 = 1물 … 15일 = 7물
     7물때식 (서해): 음력 1일 = 7물 … 7일 = 13물, 8일 = 조금, 9일 = 무시, 10일 = 1물 … 15일 = 6물 */
  function mul(day, west) {
    const d = ((day - 1) % 15) + 1;
    if (west) { if (d <= 7) return { n: d + 6 }; if (d === 8) return { k: 'jogeum' }; if (d === 9) return { k: 'musi' }; return { n: d - 9 }; }
    if (d <= 7) return { n: d + 7 }; if (d === 8) return { k: 'jogeum' }; return { n: d - 8 };
  }
  /* rough current strength 0..1 from lunar age (springs near new/full moon, lag ~1.5 days) */
  function strength(age) { const ph = ((age - 1.5) / 29.53) * Math.PI * 2; return Math.max(0, Math.min(1, .55 + .45 * Math.cos(2 * ph))); }
  return { lunar, mul, strength };
})();
