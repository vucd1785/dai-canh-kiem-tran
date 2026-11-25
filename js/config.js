// ============================================================
//  CẤU HÌNH TẬP TRUNG — chỉnh mọi thông số ở đây
// ============================================================
import { loadSaved, applyPreset } from './settings.js';
import { USER_DEFAULTS } from './defaults.js';
import { applyLight, getQuality } from './presets.js';

export const CONFIG = {
  // --- Kiếm luân sau lưng: 2 LỚP (trước / sau) xoay NGƯỢC nhau, mỗi lớp gồm 2 VÒNG (trong + ngoài) ---
  // Vòng ngoài so le với vòng trong (offset 0.5 = mỗi thanh nằm giữa khe 2 thanh vòng trong).
  // Hai vòng trong cùng 1 lớp xoay cùng chiều, cùng tốc độ.
  // Chuôi kiếm hướng vào tâm (về phía nhân vật), mũi kiếm hướng ra ngoài.
  // count: số kiếm; radius: bán kính (đo ở tâm xoay thanh kiếm, cách chuôi 30% chiều dài);
  // speed: vận tốc góc (âm = quay ngược chiều); breathe: co giãn nhẹ;
  // depth: lệch trước (+) / sau (−); offset: lệch góc (theo 1 khoảng giữa 2 kiếm);
  // radialJitter / angleJitter: độ so le ngẫu nhiên; layer / ringNo: chỉ để đặt tên trong bảng Thông số
  // breathe = 0 để các vòng không co giãn lệch nhau (giữ đúng tâm).
  // Mặc định dưới đây là cấu hình bạn đã tự chỉnh (24/11/2026) — tổng 226 kiếm.
  rings: [
    { layer: 1, ringNo: 1, count: 26, radius: 0.65, speed: 0.45, breathe: 0, depth: 0.14, offset: 0, radialJitter: 1, angleJitter: 0 },
    { layer: 1, ringNo: 2, count: 44, radius: 2.45, speed: 0.45, breathe: 0, depth: 0.14, offset: 0.5, radialJitter: 0.03, angleJitter: 0 },
    { layer: 2, ringNo: 1, count: 90, radius: 2.0, speed: -0.45, breathe: 0, depth: -0.14, offset: 0.25, radialJitter: 1, angleJitter: 0 },
    { layer: 2, ringNo: 2, count: 66, radius: 1.25, speed: -0.45, breathe: 0, depth: -0.14, offset: 0.75, radialJitter: 0.03, angleJitter: 0 },
  ],
  // Tâm kiếm luân: lùi ra sau lưng (back) và nâng lên (up) so với tâm nhân vật
  halo: { back: 0.8, up: 0.35 },
  // Trận đồ phù văn: nằm TRƯỚC 2 lớp kiếm (depth > lớp trước 0.14) — các lớp kiếm nhỏ + trung tâm trận
  // radius: bán kính trận đồ; depth: lệch ra trước; spinMul: nhân tốc độ xoay chung
  rune: {
    enabled: true, radius: 1.15, depth: 0.32, intensity: 0.9, spinMul: 1,
    // CÁC LỚP KIẾM NHỎ xoay bên trong (thay cho hình vẽ): r = bán kính (0..1 theo radius), count = số kiếm,
    // scale = cỡ kiếm nhỏ (so với kiếm lớn), spin = tốc độ xoay (âm = ngược chiều), offset = so le nửa khoảng
    miniScale: 1,          // nhân cỡ tất cả kiếm nhỏ
    minis: [
      { r: 0.9, count: 48, scale: 0.32, spin: 0.25, offset: 0 },
      { r: 0.62, count: 40, scale: 0.27, spin: -0.35, offset: 0.5, glyphs: true }, // lớp 2: có phù văn vàng
      { r: 0.38, count: 30, scale: 0.21, spin: 0.5, offset: 0 },
      { r: 0.18, count: 16, scale: 0.15, spin: -0.7, offset: 0.5 },
    ],
    // Sét cực mỏng RIÊNG cho các kiếm nhỏ phù văn (mũi → cán), chỉnh độc lập với sét kiếm lớn
    arcs: {
      enabled: true,
      active: 2,           // trung bình số tia cùng lúc trên mỗi kiếm nhỏ
      maxBolts: 600,
      life: [0.07, 0.16],
      from: 0.66, to: -0.28,
      intensity: 1.4,
      jag: 0.35,
      style: 'crackle', len: [0.1, 0.28], crackleJag: 2.4, branch: 0.6,
    },
    // TRUNG TÂM TRẬN (thay vòng vẽ bánh xe): 6 gạch vàng đơn giản từ tâm ra vòng tròn vàng, tâm sáng,
    // và các dải LINH LỰC dài ngắn / sáng tối / nhanh chậm không đều nhau xoay tròn bên trong
    showCore: true,
    core: {
      radius: 0.95,                 // bán kính (theo bán kính trận đồ)
      spin: 0.15,                   // 6 gạch xoay chậm
      intensity: 0.9,               // độ sáng 6 gạch + vòng tròn
      color: [1.2, 0.8, 0.25],      // vàng kim
      centerColor: [1.3, 1.1, 0.55],
      centerSize: 0.28,             // cỡ quầng sáng ở tâm
      wisps: 22,                    // số dải linh lực
      wispSpeed: 1,
      wispIntensity: 1.2,
      wispColor: [0.3, 1.1, 0.75],  // linh lực xanh ngọc
      wispColor2: [1.2, 0.85, 0.3], // linh lực vàng
    },
    // PHÙ VĂN VÀNG khắc trên lưỡi kiếm nhỏ (lớp nào bật glyphs), từ chỗ cán lên phía lưỡi
    // chữ trên lưỡi: mode 'text' = chữ Hán viết dọc (text, font thư pháp); threshold: tách nền khi dùng ảnh chữ
    glyph: { mode: 'text', text: '天宇', font: 'Ma Shan Zheng', intensity: 1.4, size: 1.5, threshold: 0.35, color: [1.25, 0.85, 0.25] }, // threshold: tách nền khi dùng ảnh chữ // 1 chữ phù văn ngay trên chỗ cán (size × bề rộng lưỡi)
  },

  colors: {
    blade: 0x0c4f4c,      // lõi kiếm: xanh ngọc ngả lam đậm (teal, như phim)
    emissive: 0x0a6a62,   // màu tự phát sáng (teal)
    emissiveIntensity: 0.3, // lõi trúc phát sáng dịu (không chói)
    rim: [0.25, 0.95, 0.85], // viền lõi trúc xanh ngọc ngả lam
    rimIntensity: 0.9,
    shellBody: 0x0b4d4c,    // mặt lưỡi kiếm ngoài: xanh ngọc ngả lam đậm, hơi trong (như phim)
    shellEdge: 0x7ff2dc,    // mép lưỡi kiếm: xanh ngọc nhạt sáng
    hiltDust: [2.2, 1.7, 0.6], // chấm vàng li ti quanh cán kiếm (>1 để phát sáng)
    hiltDiffuse: 0x0d2622,  // đĩa chắn tay, tay cầm, núm: XANH ĐEN (như phim)
    hiltEmissive: 0x04140f,
    hiltAccent: 0xd8a83a,   // viền vàng quanh đĩa chắn tay (như phim)
    hiltAccentEmissive: 0x8a5a10,
    edgeGold: 0xffc23a,     // màu viền lưỡi khi tụ vòng kiếm (vàng kim)
    boltCore: 0xffc43a,   // lõi sét VÀNG kim
    boltCoreAlt: 0xfff0b8,// lõi sét phụ vàng nhạt
    boltHalo: 0xff9a1a,   // quầng sét vàng cam
    trail: 0x4dffc0,      // vệt đuôi kiếm
    spark: 0xffd76a,      // tia lửa
    heroLight: 0x3dffb0,
    rune: [1.4, 1.0, 0.4],
    orb: 0x5dffc4,        // quả cầu sáng quanh nhân vật
  },

  sword: {
    length: 1.0,
    width: 0.095,         // bề rộng thân kiếm ngoài (rộng hơn chút)
    coreRatio: 0.3,       // lõi trúc bên trong: bán kính = 30% nửa bề rộng thân kiếm
    coreLength: 0.88,     // lõi trúc dài 88% thân kiếm (nằm gọn bên trong)
    shellTip: 0.86,       // mũi thân kiếm ngoài bắt đầu từ 86% chiều dài (mũi ngắn, không quá nhọn)
    tipRound: 2.2,        // mũi bo tròn nhẹ (1 = nhọn thẳng, 2 = bo vừa, 4 = tù tròn)
    taper: 0.55,          // lưỡi + lõi TO ở tay cầm, thon dần: bề rộng lúc bắt đầu mũi = 55% bề rộng ở cán
    shellFlat: 0.28,      // độ dẹt thân kiếm ngoài
    shellAlpha: 0.62,     // độ đục mặt lưỡi kiếm ngoài (thấp = trong hơn) — vẫn thấy lõi trúc mờ bên trong
    shellEdgeIntensity: 0.95, // độ sáng mép lưỡi kiếm
    shellEdgeWidth: 0.12, // bề rộng đường mép sáng (phần của nửa lưỡi) — nhỏ = viền mảnh
    // Chấm vàng li ti lấp lánh bay quanh LƯỠI kiếm (dọc thân, từ chắn tay tới gần mũi)
    hiltDust: { enabled: true, perSword: 14, size: 0.03, radius: [0.04, 0.11], spin: 1.2 },
    nearBoost: 0.4,       // kiếm gần camera sáng hơn bao nhiêu
    opacity: 1.0,         // lõi trúc + chuôi đặc
    swarmScale: 1,        // cỡ kiếm của đàn kiếm (kiếm luân) — nhân thêm với cỡ riêng từng vòng (ring.scale)
    heroSwordScale: 3.4,  // phi kiếm dưới chân nhân vật (to hơn)
  },

  // Nhân vật bằng ẢNH THẬT (chọn trong bảng Thông số → 🧍 Nhân vật, hoặc đặt file assets/hero.png)
  heroImage: {
    enabled: true,       // có ảnh thì dùng ảnh thay hình 3D
    height: 2.3,         // chiều cao nhân vật trong ảnh (đơn vị thế giới)
    offsetX: 0, offsetY: 0.05,
    removeBg: true,      // tự xoá nền (ảnh PNG nền trong suốt thì không cần)
    tolerance: 38,       // ngưỡng xoá nền: lớn = xoá mạnh hơn
    brightness: 1.0,
    flip: false,         // lật ngang ảnh
  },
  // BAY: W A S D / phím mũi tên = tới lui trái phải (theo hướng camera), R / F = lên / xuống, giữ Shift = bay nhanh
  heroFly: { speed: 9, boost: 2.5, vertical: 6, minY: -30, maxY: 80, camFollow: true, turn: true, turnRate: 4 }, // turn: quay đầu theo hướng bay
  heroCenterOffset: [0, 1.1, 0], // tâm quỹ đạo so với chân nhân vật

  // Lò xo kéo kiếm về vị trí đích: k = độ cứng, c = độ hãm
  springs: {
    ORBIT: { k: 30, c: 10 },
    SPREAD: { k: 18, c: 8 },
    SHIELD: { k: 45, c: 12 },
    ATTACK: { k: 60, c: 7 },
    RETURN: { k: 16, c: 7 },
    FORMATION: { k: 24, c: 9 },
    URCHIN: { k: 40, c: 11 },
    GIANT: { k: 26, c: 10 },
    VOLLEY: { k: 30, c: 10 },
    DRAGON: { k: 30, c: 10 },
  },
  maxSpeed: 28,

  spreadRadiusMul: 2.0,
  // Kiếm thuẫn hộ thân: 2 lớp cầu lồng nhau xoay NGƯỢC chiều (kiếm chẵn → lớp trong, lẻ → lớp ngoài)
  shield: {
    layers: [{ radius: 2.0, spin: 1.1 }, { radius: 3.2, spin: 1.1 }], // radius = bán kính lớp trong / ngoài
    flySpeed: 0.45,        // tốc độ quay của 2 quả cầu: cầu ngoài TRÁI → PHẢI, cầu trong PHẢI → TRÁI
    thickness: 0.8,        // độ DÀY mỗi quả cầu: kiếm lệch bán kính trong khoảng này → cầu dày, không mỏng
    swordScale: 1.6,       // cỡ kiếm khi ở kiếm thuẫn (riêng, không theo cỡ phóng to của từng vòng kiếm luân)
  },
  attack: {
    // Phóng theo ĐỢT: vòng ngoài trước → vòng trong sau, mỗi đợt là 1 cụm kiếm nằm cạnh nhau
    swordScale: 1,         // cỡ kiếm khi phóng kiếm / tụ vòng kiếm (riêng, không theo cỡ từng vòng kiếm luân)
    batchSize: 24,         // số kiếm phóng cùng lúc trong 1 đợt
    waveInterval: 0.18,    // giây giữa 2 đợt
    launchImpulse: 9,      // lực bật ngang lúc phóng (tạo đường cong)
    swirlRadius: 1.0,      // bán kính xoáy quanh mục tiêu
    swirlSpeed: 5,
    defaultTarget: [-6, 1.2, 1],
  },
  // BAY NỐI ĐUÔI: kiếm chia thành nhiều DÒNG, thanh sau bám đúng đường bay của thanh trước,
  // mỗi dòng uốn cong riêng (như đàn cá). Dùng khi phóng kiếm (phím 4) và khi tụ vòng kiếm (phím 7).
  stream: {
    enabled: true,         // tắt → phóng kiếm kiểu cũ (lò xo, từng đợt)
    streams: 6,            // số dòng kiếm
    gap: 0.035,            // giây giữa 2 thanh nối đuôi trong 1 dòng (nhỏ = sát nhau)
    streamDelay: 0.15,     // các dòng xuất phát lệch nhau (dòng vòng ngoài đi trước)
    speed: 12,             // tốc độ bay trên dòng
    swoop: 3.2,            // độ cong / độ toả của dòng
    merge: 0.2,            // đoạn đầu (tỉ lệ) để kiếm nhập vào dòng; đoạn cuối để tách về chỗ
    // Phóng kiếm: tới mục tiêu thì MỖI CỤM tiếp tục bay vòng riêng quanh mục tiêu (nối đuôi), không dồn 1 chỗ
    loopRadius: [2.2, 5.5], // bán kính vòng bay của cụm nhỏ nhất / lớn nhất
    loopSpeed: 0.75,        // tốc độ bay vòng (so với tốc độ bay trên dòng)
    loopWobble: 0.3,        // vòng uốn lượn lên xuống (0 = tròn phẳng)
    lanes: 4,               // mỗi dòng chia thành bấy nhiêu HÀNG song song (1 = nối liền thành 1 sợi)
    laneSpread: 0.9,        // các hàng cách nhau bao xa (bề ngang của bầy kiếm)
    waveAmp: 0.3,           // độ uốn lượn của dòng lúc bay tới mục tiêu (theo độ cong)
    followSpeed: 0.8,       // khi đổi mục tiêu (rê chuột): tốc độ thanh dẫn đầu bay tới chỗ mới (so với tốc độ dòng)
  },
  // VÒNG KIẾM (tụ kiếm): kiếm bay nối đuôi rồi xếp thành các VÒNG TRÒN đồng tâm trên 1 mặt phẳng,
  // chuôi quay vào tâm, mũi chĩa ra — như đĩa kiếm trong phim. (tên khoá 'urchin' giữ lại cho cấu hình cũ)
  urchin: {
    radius: 0.5,           // bán kính vòng trong (tính tới chuôi kiếm)
    layers: 3,             // số vòng
    layerGap: 0.55,        // khoảng cách giữa các vòng
    alternate: true,       // các vòng kề nhau xoay ngược chiều
    faceCamera: true,      // mặt vòng luôn quay về phía camera
    spin: 0.35,            // tốc độ xoay vòng
    pulse: 0.03,           // vòng co giãn nhẹ
    distance: 3.2,         // cách nhân vật về phía trước
    up: 0.9,               // cao hơn tâm nhân vật
    goldEdge: true,        // tụ xong → viền lưỡi các vòng TRONG chuyển VÀNG (ánh sáng trận pháp ở tâm chiếu vào)
    goldRings: 2,          // số vòng bên trong bị nhuộm vàng (vòng ngoài giữ xanh)
    goldAlong: 0.55,       // vàng đậm ở phía chuôi (gần tâm), nhạt dần về mũi kiếm
    coreLight: 0.9,        // độ sáng ánh trận pháp ở tâm vòng (0 = tắt)
    fxDim: 0.5,            // kiếm dồn đặc → giảm sáng sét/chấm vàng còn bấy nhiêu (tránh loá trắng)
  },
  // KIM LONG (phím 0): các phi kiếm ghép thành RỒNG VÀNG (đầu có sừng, râu; thân dài vảy kiếm thon dần về đuôi)
  // bay lượn uốn khúc quanh nhân vật, sấm sét vàng bao quanh
  dragon: {
    radius: 11,            // rồng lượn vòng quanh nhân vật bán kính bao nhiêu
    height: 3,             // cao hơn nhân vật
    wave: 4,               // uốn lên xuống
    speed: 11,             // tốc độ bay
    length: 20,            // chiều dài thân rồng (ngắn hơn → kiếm xếp dày hơn)
    bodyRadius: 1.1,       // thân rồng to bao nhiêu
    ringSize: 8,           // số kiếm mỗi vòng vảy
    twist: 6,              // vảy xoắn dọc thân
    scaleOut: 0.22,        // vảy (kiếm) toả ra ngoài bao nhiêu (0 = nằm ép dọc thân)
    headSize: 1.6,         // cỡ đầu rồng
    legs: true,            // 4 chân rồng (đùi, cẳng, 3 móng vuốt) ghép từ kiếm
    legLength: 1.8,        // chân dài bao nhiêu
    legFront: 0.16, legBack: 0.5, // vị trí 2 cặp chân dọc thân (0 = cổ, 1 = đuôi)
    legSpeed: 3.2,         // chân quẫy nhanh chậm
    swordScale: 0.85,      // cỡ kiếm khi thành rồng
    solid: true,           // KHỐI RỒNG 3D (thân vảy vàng, đầu, chân) bên dưới lớp kiếm → liền mạch, không hở
    meshFit: 0.88,         // khối thân nhỏ hơn vòng kiếm chút → kiếm nằm ngay trên bề mặt
    gather: 6,             // kiếm tụ về thân rồng nhanh chậm
    gold: true,            // viền lưỡi vàng → rồng vàng
    boltRate: 14,          // sấm sét vàng quanh rồng mỗi giây
    boltReach: 1.6,        // sét văng xa
  },
  // BẮN KIẾM (phím 9): kiếm xếp quanh nhân vật, hàng TRƯỚC và hàng SAU xen kẽ, mũi chĩa về đối phương
  // (điểm chuột / ngón tay chỉ), rồi từng loạt BAY THẲNG tới đối phương, bắn xong tự thu về
  volley: {
    radius: 3.4,           // bán kính đội hình quanh nhân vật
    inner: 1.1,            // chừa trống quanh người
    frontBack: 0.9,        // hàng trước / hàng sau cách nhân vật bao xa
    holdTime: 1.4,         // ngắm (giây) trước khi bắn
    batch: 12,             // số kiếm mỗi loạt
    interval: 0.07,        // giây giữa 2 loạt
    speed: 34,             // tốc độ bay thẳng
    hitSpread: 0.9,        // kiếm cắm toả quanh đối phương bao rộng
    linger: 1.0,           // bắn xong dừng bao lâu rồi thu kiếm
  },
  // CỰ KIẾM (phím 8): kiếm chĩa xuống đất dàn hàng xa gần → gộp lại thành 1 thanh kiếm khổng lồ có sấm sét
  giant: {
    distance: 4,           // cách nhân vật về phía trước
    height: 4.2,           // tâm cự kiếm cao hơn tâm nhân vật bấy nhiêu
    formY: -0.4,           // đội hình kiếm chĩa xuống: ngang / thấp hơn tâm nhân vật một chút (âm = thấp hơn)
    spacing: 1.0,          // khoảng cách giữa các thanh trong 1 hàng (rộng)
    rowSpacing: 1.5,       // khoảng cách giữa các hàng (trước / sau)
    aspect: 1.6,           // tỉ lệ số thanh mỗi hàng / số hàng (lớn = hàng dài, ít hàng)
    heightJitter: 0.7,     // cao thấp XEN KẼ giữa các thanh kề nhau
    depthScale: 0.5,       // hàng GẦN camera to hơn, hàng XA nhỏ hơn (0 = đều nhau)
    holdTime: 2.2,         // giữ đội hình chĩa xuống bao lâu (giây) rồi mới gộp
    mergeTime: 1.1,        // mỗi thanh bay vào cự kiếm mất bao lâu
    mergeSpread: 1.4,      // các thanh nhập vào lệch nhau trong khoảng này (lần lượt)
    scale: 10,             // cỡ cự kiếm (so với 1 thanh)
    grow: 0.25,            // lúc vừa gộp xong cự kiếm phình to thêm rồi thu về (hiệu ứng "bùng")
    camZoom: true,         // gộp xong camera tự tiến lại gần cự kiếm (về kiếm luân thì lùi lại chỗ cũ)
    camDist: 11,           // khoảng cách camera tới giữa thân cự kiếm khi quay cận (nhỏ = cận hơn)
    // VIỀN LƯỠI cự kiếm màu VÀNG, DÀY
    goldEdge: false,       // viền lưỡi cự kiếm màu vàng (mặc định tắt)
    edgeWidth: 0.4,        // bề dày viền vàng (phần của nửa lưỡi; kiếm thường là 0.12)
    edgeIntensity: 1.6,    // độ sáng viền vàng
    swordScale: 1,         // cỡ kiếm nhỏ trong đội hình
    boltRate: 9,           // số tia sét lớn mỗi giây từ cự kiếm ra xung quanh (rải đều dọc thân)
    boltReach: 1.2,        // tia sét lớn văng xa bao nhiêu (nhỏ gọn, đều nhau)
    boltWidth: 0.8,        // độ dày tia sét lớn
    coreGlow: 2.2,         // LÕI cự kiếm phát sáng thêm bấy nhiêu
    // sét chạy DỌC LÕI cự kiếm (mũi → chuôi)
    coreArcs: { enabled: true, active: 14, maxBolts: 80, life: [0.06, 0.14], from: 0.6, to: -0.22, intensity: 2.4, jag: 0.6,
      style: 'core', len: [0.04, 0.1], crackleJag: 1.6, color: 0x4fe8ff, colorAlt: 0x9ff7ff }, // tia NGẮN trong lõi, xanh lam ngọc
    // PHÙ VĂN vàng dọc lưỡi cự kiếm
    glyphs: { enabled: true, count: 1, size: 1.7, span: 0.75, intensity: 1.6 }, // 1 cụm chữ (天宇) ngay dưới chuôi
    // sét nhỏ bám trên lưỡi cự kiếm (kiểu phim: ngắn, gãy khúc, có nhánh)
    arcs: { enabled: true, active: 22, maxBolts: 260, life: [0.06, 0.14], from: 0.66, to: -0.28, intensity: 1.8, jag: 0.5,
      style: 'crackle', len: [0.08, 0.22], crackleJag: 2.4, branch: 0.7 },
  },
  formation: { arms: 6, inner: 1.6, step: 0.42, twist: 0.32, spin: 0.9, tilt: 0.35 },
  returnDuration: 1.6,
  speed: { min: 0.2, max: 3.0, gestureRate: 0.9, keyStep: 0.25, default: 1 },

  lightning: {
    maxBolts: 80,
    rateMul: 1,            // nhân mật độ sét
    segmentsPow: 4,        // 2^4 = 16 đoạn mỗi tia
    rate: { ORBIT: 7, SPREAD: 5, SHIELD: 14, ATTACK: 24, RETURN: 6, FORMATION: 18, URCHIN: 16, GIANT: 0, VOLLEY: 4, DRAGON: 0 }, // tia/giây
    life: [0.1, 0.22],
    regen: 0.04,           // giây giữa 2 lần đổi hình tia sét (nhấp nháy)
    coreWidth: 0.045,
    haloWidth: 0.2,
    jag: 0.18,             // độ gãy khúc
    maxPairDist: 3.0,
    burstCount: 24,
    // Tia sét CỰC MỎNG, DÀI chạy suốt lưỡi từng thanh: từ mũi kiếm xuống tới cán (bám theo kiếm)
    bladeArcs: {
      enabled: true,
      active: 3.5,         // trung bình số tia CÙNG LÚC trên mỗi thanh kiếm (3–4 tia)
      maxBolts: 1100,      // giới hạn tổng số tia cùng lúc cả trận (giữ máy mượt)
      life: [0.07, 0.16],  // tuổi thọ 1 tia (giây) — ngắn → nhấp nháy như sét thật
      from: 0.66,          // điểm đầu: gần mũi kiếm (tỉ lệ chiều dài, mũi = 0.7)
      to: -0.28,           // điểm cuối: chỗ cán / đĩa chắn tay
      intensity: 1.6,      // độ sáng tia (tia vẽ bằng đường kẻ 1 điểm ảnh → cực mỏng)
      jag: 0.35,           // độ gãy khúc (thấp → tia bám sát lưỡi, không văng ra ngoài)
      // Kiểu tia: 'crackle' = như PHIM (tia ngắn, gãy khúc mạnh, có nhánh, loé ra 2 bên lưỡi)
      //           'long'    = tia dài chạy dọc lưỡi từ mũi xuống cán (kiểu cũ)
      style: 'crackle',
      len: [0.1, 0.28],    // chiều dài tia ngắn (theo chiều dài kiếm)
      crackleJag: 2.4,     // tia ngắn gãy khúc mạnh hơn
      branch: 0.6,         // xác suất có nhánh
    },
  },

  // Vệt kiếm: mặt quét của cả thanh, CHỈ hiện khi kiếm chuyển động nhanh.
  // minSpeed: tốc độ mũi kiếm (đơn vị/giây) bắt đầu có vệt — xoay chậm mặc định thì không có vệt
  // fullSpeed: tốc độ mà vệt sáng hết mức; càng nhanh vệt càng dài và sáng
  trail: {
    enabled: true, length: 22, intensity: 0.85,
    sampleInterval: 1 / 50, // 22 điểm × 0.02 s ≈ vệt dài 0.44 giây chuyển động
    maxLength: 2.2,         // nhưng không dài quá 2.2 đơn vị (kiếm bay nhanh không kéo vệt quá dài)
    minSpeed: 2.4, fullSpeed: 7,
    tipColor: 0xfff0c0, midColor: 0xffc860, baseColor: 0x2fd99a,
  },
  sparks: { max: 600, gravity: -4 },
  bloom: { strength: 0.75, radius: 0.4, threshold: 0.55 },

  scene: {
    palette: 'steppeNight', // 'steppeNight' (thảo nguyên ban đêm, nền tối dễ nhìn), 'steppe' (ban ngày), 'night' (đêm tím), 'dusk' (hoàng hôn)
    flightSpeed: 6,        // tốc độ cảnh trôi (cảm giác bay)
    flightMul: 1,          // nhân tốc độ bay (chỉnh trong bảng Thông số)
    mountains: [
      { W: 340, z: -140, y: -8, amp: 30, parallax: 0.08, seed: 3.1 },
      { W: 200, z: -80, y: -9, amp: 18, parallax: 0.16, seed: 1.7 },
      { W: 120, z: -45, y: -10, amp: 11, parallax: 0.3, seed: 5.3 },
    ],
    cloudCount: 70,
    streakCount: 40,
    dustCount: 0,          // bụi sáng lơ lửng (0 = tắt)
    // CẢNH VẬT 3D vô tận bên dưới: núi non, thung lũng có sông, cỏ, rừng thông, tuyết trên đỉnh, biển mây
    terrain: {
      enabled: true,
      size: 1100,          // bề rộng vùng cảnh dựng quanh camera
      grid: 170,           // độ mịn lưới địa hình
      groundY: -38,        // mặt đất thung lũng thấp hơn nhân vật bấy nhiêu
      mountainHeight: 95,  // núi hai bên thung lũng cao bao nhiêu
      valleyHalf: 70,      // nửa bề rộng thung lũng (nơi nhân vật bay qua)
      riverMeander: 30, riverWidth: 10, waterLevel: 1.2,
      rockLine: 34, snowLine: 72, // cao hơn đáy thung lũng bao nhiêu thì thành đá / tuyết
      treeCount: 3000, treeCell: 16, treeDensity: 0.75,
      cloudCount: 46,
      speed: 1,            // tốc độ cảnh trôi (theo tốc độ bay)
      regen: 110,          // camera đi xa / cảnh trôi quá đoạn này thì dựng thêm quanh camera
      rolling: 4,          // đồi thoai thoải trong thung lũng (thảo nguyên: cao hơn)
    },
  },

  palettes: {
    // THẢO NGUYÊN BAN ĐÊM: đồi cỏ thoai thoải như bản ban ngày nhưng nền TỐI (trời xanh đen, trăng sao)
    // → kiếm, sét, phù văn nổi rõ, dễ nhìn
    steppeNight: {
      skyTop: 0x0a1530, skyMid: 0x34507e, skyBottom: 0x1c2a48,   // sáng hơn: trời đêm xanh lam (trăng sáng)
      fog: 0x2c3e62, fogDensity: 0.003,
      sun: 0xeef3ff, sunGlow: 0x8aa2ff, sunPos: [-200, 140, -380], starOpacity: 1,
      clouds: [0x6a789c, 0x56648a, 0x7c88aa], cloudOpacity: 0.26,
      mountains: [0x2a3350, 0x1c2238, 0x111626],
      hemiSky: 0xa4b6f0, hemiGround: 0x1a2030, hemiIntensity: 1.05,
      dirColor: 0xd6e0ff, dirIntensity: 1.5,
      streak: 0x9fb6ff, dust: 0xc8ffe8,
      grass: 0x335e44, grass2: 0x527a4a, rock: 0x5a6280, snow: 0xd6dcf0, bank: 0x4c4c40, water: 0x2c4a80, waterGlow: 0x14244e,
      terrain: { mountainHeight: 55, valleyHalf: 170, rolling: 16, treeDensity: 0.12, rockLine: 70, snowLine: 400, riverWidth: 7 },
    },
    // THẢO NGUYÊN BAN NGÀY (như phân cảnh thảo nguyên trong phim): trời sáng xanh nhạt ngả vàng ở chân trời,
    // đồi cỏ thoai thoải vàng xanh trải dài, núi xa mờ, mây trắng lớn, nắng ấm
    steppe: {
      skyTop: 0x4f7fb8, skyMid: 0xb9cbd8, skyBottom: 0xd9c79c,
      fog: 0xcdc3a6, fogDensity: 0.0026,
      sun: 0xfff6dc, sunGlow: 0xffe0a0, sunPos: [-230, 150, -380], starOpacity: 0,
      clouds: [0xffffff, 0xf4e8cf, 0xe9eef6], cloudOpacity: 0.5,
      mountains: [0x9a8f78, 0x7d735e, 0x5f5747],
      hemiSky: 0xe2ecff, hemiGround: 0x8a7a50, hemiIntensity: 1.15,
      dirColor: 0xfff0d2, dirIntensity: 2.3,
      streak: 0xffffff, dust: 0xfff0c0,
      grass: 0x7d9446, grass2: 0xb8a95c, rock: 0x8e7d62, snow: 0xf4f1ea, bank: 0x9c8b62, water: 0x5f8db4, waterGlow: 0x1a2a3a,
      glowMul: 0.45,           // quầng sáng trung tâm trận giảm bớt trên nền trời sáng
      bloomMin: 0.72,          // trời sáng → chỉ cho chỗ thật sáng (kiếm, sét, mặt trời) toả sáng, tránh loá cả bầu trời
      // địa hình kiểu thảo nguyên: đồi thấp thoai thoải, thung lũng rộng, núi xa thấp, cây thưa, không tuyết
      terrain: { mountainHeight: 55, valleyHalf: 170, rolling: 16, treeDensity: 0.1, rockLine: 70, snowLine: 400, riverWidth: 7 },
    },
    night: {
      skyTop: 0x04020c, skyMid: 0x2a1850, skyBottom: 0x0d0820,
      fog: 0x2a1850, fogDensity: 0.0055,
      grass: 0x33634e, grass2: 0x4a8060, rock: 0x5c5f80, snow: 0xe2e8fa, bank: 0x5a5068, water: 0x2a4a8a, waterGlow: 0x14244a,
      sun: 0xfff0d0, sunGlow: 0xb79cff, sunPos: [-160, 110, -380], starOpacity: 1,
      clouds: [0x9a88d0, 0x7a6ab8, 0xb8a8e8], cloudOpacity: 0.18,
      mountains: [0x3a2560, 0x251645, 0x150c2c],
      hemiSky: 0x8a7cff, hemiGround: 0x120820, hemiIntensity: 0.7,
      dirColor: 0xcfd4ff, dirIntensity: 1.1,
      streak: 0x9fb6ff, dust: 0xc8ffe8,
    },
    dusk: {
      skyTop: 0x1c170f, skyMid: 0xa67a40, skyBottom: 0x3a2a16,
      fog: 0x8a6a3c, fogDensity: 0.004,
      grass: 0x4a5a2a, grass2: 0x6a7a3a, rock: 0x6a5640, snow: 0xf2e8d2, bank: 0x6a5a40, water: 0x3a5a6a, waterGlow: 0x1a2a2a,
      sun: 0xfff1cc, sunGlow: 0xffc870, sunPos: [-220, 45, -380], starOpacity: 0,
      clouds: [0xe8d2a6, 0xb89868, 0xf5e6c4], cloudOpacity: 0.22,
      mountains: [0x5a4428, 0x33261a, 0x15100a],
      hemiSky: 0xffe2b0, hemiGround: 0x3a2a18, hemiIntensity: 0.8,
      dirColor: 0xffe0b0, dirIntensity: 1.2,
      streak: 0xfff0c8, dust: 0xffe2a0,
    },
  },

  gesture: {
    moduleUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    modelUrl: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
    numHands: 2,
    minScore: 0.6,         // độ tin cậy tối thiểu
    stableFrames: 5,       // giữ cử chỉ bao nhiêu khung hình mới tính
    victoryState: 'URCHIN', // cử chỉ chữ V: 'URCHIN' = vòng kiếm, 'FORMATION' = kiếm trận xoắn
    noneHoldTime: 0.7,     // thả tay (None) bao lâu thì kiếm về quỹ đạo
    lostTimeout: 1.0,      // mất tay bao lâu thì coi như không còn tay
    smoothing: { minCutoff: 1.0, beta: 4.0 }, // One Euro filter
    pinchRange: [0.25, 1.1],
    radiusRange: [0.6, 1.6],
    twoHandRange: [0.15, 0.7],
    zoomRange: [16, 7],
    yawRange: 1.2,
    pitchRange: 0.7,
    handHold: 0.5,         // tay phải giữ trong khung hình liên tục bấy nhiêu giây mới điều khiển nghiêng/bán kính (chống bắt nhầm)
    handTilt: true,        // bàn tay điều khiển nghiêng trận + bán kính (chụm/mở ngón)
    idleReset: 3,          // không có tay bao nhiêu giây thì tốc độ xoay tự về mặc định
    lowFpsSkip: 40,        // FPS dưới mức này thì nhận diện cách 1 khung hình
  },

  maxPixelRatio: 2,
  // Camera: cuộn chuột để zoom. minDistance nhỏ → phóng sát vào nhân vật & kiếm được hơn
  view: { minDistance: 1.2, maxDistance: 140, exposure: 1.2 }, // exposure: độ sáng chung của cảnh
  // Phi kiếm ra xa sát mép màn hình → camera tự lùi ra + dịch theo để luôn thấy kiếm (thôi phi kiếm thì về chỗ cũ)
  camFollow: { enabled: true, edge: 0.78, inner: 0.45, speed: 0.9, maxDist: 140 },
};

// Nạp các thông số bạn đã bấm "Lưu làm mặc định" (lưu trong trình duyệt) đè lên giá trị ở trên
applyPreset(CONFIG, USER_DEFAULTS); // cấu hình mặc định của người dùng (js/defaults.js)
CONFIG.loadedSaved = loadSaved(CONFIG);
// Chế độ NHẸ MÁY (nút 🐢): ít kiếm hơn, tắt hiệu ứng nặng — áp đè lên, không đổi cấu hình mặc định
CONFIG.quality = getQuality();
if (CONFIG.quality === 'light') applyLight(CONFIG);

// Trạng thái giao diện lúc chạy (không lưu): vòng đang được chỉnh trong bảng Thông số (-1 = không có)
CONFIG.ui = { focusRing: -1 };
for (const r of CONFIG.rings) { r.visible ??= true; r.scale ??= 1; r.goldRim ??= false; } // ẩn/hiện + cỡ kiếm từng vòng
// Lớp kiếm nhỏ phù văn: luôn hiện khi mở trang; cấu hình cũ chưa có 'glyphs' → lớp 2 mặc định có phù văn vàng
CONFIG.rune.minis.forEach((l, i) => { l.visible = true; l.glyphs ??= i === 1; l.goldRings ??= false; });

CONFIG.swordCount = CONFIG.rings.reduce((n, r) => n + r.count, 0);
try { const pl = localStorage.getItem('phiKiem.palette'); if (pl && CONFIG.palettes[pl]) CONFIG.scene.palette = pl; } catch { /* bỏ qua */ }
CONFIG.palette = CONFIG.palettes[CONFIG.scene.palette] || CONFIG.palettes.night;
// địa hình riêng của từng cảnh (vd. thảo nguyên: đồi thấp, cây thưa) — trừ các giá trị bạn đã lưu
if (CONFIG.palette.terrain) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('phiKiem.settings.v1')) || {}; } catch { return {}; } })();
  for (const [k, v] of Object.entries(CONFIG.palette.terrain)) if (!(`scene.terrain.${k}` in saved)) CONFIG.scene.terrain[k] = v;
}
