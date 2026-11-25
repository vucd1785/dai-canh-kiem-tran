// Bảng Thông số (phím G) — sắp xếp theo nhóm, mỗi lúc chỉ mở 1 nhóm cho gọn.
//  ⚔ Kiếm luân: Lớp → Vòng. Mỗi vòng có Hiện/ẩn, "Chỉ hiện vòng này"; mở vòng nào thì vòng đó sáng lên,
//     các vòng khác mờ đi để dễ thấy mình đang chỉnh gì.
// Mọi thanh chỉnh gắn thẳng vào CONFIG → "Lưu làm mặc định" lưu được hết.
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { CONFIG } from './config.js';
import { saveSettings, clearSettings, snapshot } from './settings.js';
import { refreshGlyph } from './effects/rune.js';

// lil-gui 0.17 (đi kèm three r160) chưa có onOpenClose → tự móc vào open/openAnimated của thư mục.
// cb(isOpen) chạy mỗi khi thư mục đó (không tính thư mục con) được mở hoặc đóng.
function onToggle(folder, cb) {
  for (const m of ['open', 'openAnimated']) {
    const orig = folder[m].bind(folder);
    folder[m] = (v = true) => {
      const was = folder._closed;
      const r = orig(v);
      if (was !== folder._closed) cb(!folder._closed);
      return r;
    };
  }
}

export function buildPanel(ctx) {
  const { getSwarm, rebuild, lightning, bladeArcs, runeArcs, bloom, shellMat, swordMat, controls, heroPhoto, glyphPhoto, terrain, hero, camera } = ctx;

  // Chọn ảnh chữ phù văn (dùng chung cho kiếm nhỏ phù văn + cự kiếm)
  const glyphIn = document.createElement('input');
  glyphIn.type = 'file'; glyphIn.accept = 'image/*'; glyphIn.hidden = true;
  document.body.appendChild(glyphIn);
  glyphIn.addEventListener('change', async () => { const f = glyphIn.files[0]; if (f) await glyphPhoto.useFile(f); glyphIn.value = ''; });
  const glyphUi = { pick: () => glyphIn.click(), clear: () => glyphPhoto.clear(), status: glyphPhoto.status };
  glyphPhoto.onStatus = (s) => { glyphUi.status = s; };
  const FONTS = { 'Bút lông (Ma Shan Zheng)': 'Ma Shan Zheng', 'Thảo thư (Zhi Mang Xing)': 'Zhi Mang Xing', 'Cuồng thảo (Liu Jian Mao Cao)': 'Liu Jian Mao Cao', 'Khải thư (KaiTi)': 'KaiTi', 'Nét phù văn vẽ sẵn': '__brush' };
  function addGlyphPicker(f) {
    // gõ chữ / đổi kiểu chữ → bỏ ảnh chữ (nếu đang dùng) và vẽ chữ ngay
    const useText = () => { CONFIG.rune.glyph.mode = 'text'; if (glyphPhoto.img) glyphPhoto.clear(); else refreshGlyph(); };
    f.add(CONFIG.rune.glyph, 'text').name('Chữ trên lưỡi (vd. 天宇)').listen().onFinishChange(useText);
    f.add(CONFIG.rune.glyph, 'font', FONTS).name('Kiểu chữ').listen().onChange(useText);
    f.add(glyphUi, 'pick').name('📁 Chọn ảnh chữ phù văn…');
    f.add(glyphUi, 'status').name('Chữ đang dùng').disable().listen();
    f.add(CONFIG.rune.glyph, 'threshold', 0, 0.9, 0.01).name('Tách nền ảnh chữ').onFinishChange(() => glyphPhoto.reprocess());
    f.add(glyphUi, 'clear').name('↺ Bỏ ảnh, dùng chữ ở trên');
  }

  const gui = new GUI({ title: '⚙ Thông số  (phím G)', width: 340 });
  gui.domElement.classList.add('pk-panel');

  const top = []; // nhóm cấp 1 → chỉ mở 1 nhóm mỗi lúc
  const group = (title) => {
    const f = gui.addFolder(title);
    f.close();
    top.push(f);
    onToggle(f, (isOpen) => {
      if (isOpen) for (const o of top) if (o !== f) o.close();
      else if (f === gLuan) CONFIG.ui.focusRing = -1;
    });
    return f;
  };
  onToggle(gui, (isOpen) => { if (!isOpen) CONFIG.ui.focusRing = -1; });

  // ---------------- 💾 Lưu cấu hình ----------------
  const status = { text: CONFIG.loadedSaved ? 'Đang dùng cấu hình đã lưu' : 'Đang dùng mặc định gốc' };
  const act = {
    save: () => {
      CONFIG.speed.default = getSwarm().speedMul;
      status.text = saveSettings(CONFIG) ? '✓ Đã lưu — mở lại trang vẫn giữ' : '✗ Trình duyệt chặn lưu trữ';
    },
    copy: async () => {
      CONFIG.speed.default = getSwarm().speedMul;
      const json = JSON.stringify(snapshot(CONFIG), null, 2);
      try { await navigator.clipboard.writeText(json); status.text = '✓ Đã sao chép vào clipboard'; }
      catch { console.log(json); status.text = 'Không sao chép được — xem Console (F12)'; }
    },
    reset: () => {
      if (!confirm('Xoá cấu hình đã lưu trong trình duyệt và quay về cấu hình mặc định (js/defaults.js)?')) return;
      clearSettings();
      location.reload();
    },
  };
  const gSave = group('💾 Lưu cấu hình');
  gSave.add(act, 'save').name('💾 Lưu làm mặc định');
  gSave.add(act, 'copy').name('📋 Sao chép cấu hình');
  gSave.add(act, 'reset').name('↺ Về mặc định gốc');
  gSave.add(status, 'text').name('Trạng thái').disable().listen();

  // ---------------- ⚔ Kiếm luân ----------------
  const gLuan = group('⚔ Kiếm luân (sau lưng)');
  const info = { total: 0 };
  const updateTotal = () => (info.total = CONFIG.rings.reduce((n, r) => n + r.count, 0));
  updateTotal();
  const common = {
    get speed() { return getSwarm().speedMul; }, set speed(v) { getSwarm().speedMul = v; },
    showAll: () => { for (const r of CONFIG.rings) r.visible = true; },
  };
  gLuan.add(info, 'total').name('Tổng số kiếm').disable().listen();
  gLuan.add(common, 'showAll').name('👁 Hiện tất cả các vòng');
  gLuan.add(common, 'speed', CONFIG.speed.min, CONFIG.speed.max, 0.05).name('Tốc độ xoay chung').listen();
  gLuan.add(CONFIG.sword, 'swarmScale', 0.2, 4, 0.05).name('Cỡ kiếm (tất cả)');
  gLuan.add({
    get v() { return CONFIG.rings.every((r) => r.goldRim); },
    set v(x) { for (const r of CONFIG.rings) r.goldRim = x; },
  }, 'v').name('Viền vàng cán tròn (tất cả)').listen();
  const gTay = gLuan.addFolder('✋ Tay điều khiển (camera)');
  gTay.add(CONFIG.gesture, 'handTilt').name('Bàn tay nghiêng trận + chỉnh bán kính');
  gTay.add(CONFIG.gesture, 'handHold', 0, 2, 0.1).name('Giữ tay bao lâu mới điều khiển (giây)');
  gTay.add(CONFIG.gesture, 'idleReset', 0.5, 10, 0.5).name('Bỏ tay bao lâu thì tốc độ về mặc định');
  gTay.close();

  const gPos = gLuan.addFolder('📍 Vị trí trận');
  gPos.add(CONFIG.halo, 'back', 0, 15, 0.05).name('Lùi sau lưng (cách nhân vật)');
  gPos.add(CONFIG.halo, 'up', -5, 8, 0.05).name('Độ cao tâm trận');
  gPos.close();

  const layers = [...new Set(CONFIG.rings.map((r) => r.layer ?? 1))];
  const ringFolders = [];
  for (const L of layers) {
    const rings = CONFIG.rings.filter((r) => (r.layer ?? 1) === L);
    const gLayer = gLuan.addFolder(`Lớp ${L} · ${L === 1 ? 'trước' : L === 2 ? 'sau' : ''}`);
    // Chỉnh chung cả lớp (đổi tất cả vòng trong lớp)
    const lp = {
      get visible() { return rings.every((r) => r.visible !== false); },
      set visible(v) { for (const r of rings) r.visible = v; },
      get speed() { return rings[0].speed; }, set speed(v) { for (const r of rings) r.speed = v; },
      get depth() { return rings[0].depth; }, set depth(v) { for (const r of rings) r.depth = v; },
      get scale() { return rings[0].scale ?? 1; }, set scale(v) { for (const r of rings) r.scale = v; },
      get goldRim() { return rings.every((r) => r.goldRim); }, set goldRim(v) { for (const r of rings) r.goldRim = v; },
    };
    gLayer.add(lp, 'visible').name('👁 Hiện lớp này').listen();
    gLayer.add(lp, 'speed', -2, 2, 0.05).name('Tốc độ xoay (cả lớp)').listen();
    gLayer.add(lp, 'depth', -5, 3, 0.01).name('Lệch trước/sau (cả lớp)').listen();
    gLayer.add(lp, 'scale', 0.2, 4, 0.05).name('Cỡ kiếm (cả lớp)').listen();
    gLayer.add(lp, 'goldRim').name('Viền vàng cán tròn (cả lớp)').listen();

    for (const ring of rings) {
      const idx = CONFIG.rings.indexOf(ring);
      const title = () => `Vòng ${ring.ringNo ?? idx + 1} · ${ring.count} kiếm`;
      const rf = gLayer.addFolder(title());
      const solo = { only: () => { for (const r of CONFIG.rings) r.visible = r === ring; } };
      rf.add(ring, 'visible').name('👁 Hiện').listen();
      rf.add(solo, 'only').name('🎯 Chỉ hiện vòng này');
      rf.add(ring, 'count', 3, 120, 1).name('Số kiếm').onFinishChange(() => { updateTotal(); rf.title(title()); rebuild(); });
      rf.add(ring, 'radius', 0.3, 8, 0.05).name('Bán kính').listen();
      rf.add(ring, 'scale', 0.2, 4, 0.05).name('Cỡ kiếm').listen();
      rf.add(ring, 'goldRim').name('Viền vàng cán tròn').listen();
      rf.add(ring, 'speed', -2, 2, 0.05).name('Tốc độ xoay').listen();
      rf.add(ring, 'depth', -5, 3, 0.01).name('Lệch trước/sau').listen();
      rf.add(ring, 'radialJitter', 0, 1, 0.01).name('So le bán kính');
      rf.add(ring, 'angleJitter', 0, 0.5, 0.01).name('So le góc');
      rf.close();
      // Mở vòng nào → vòng đó sáng lên, vòng khác mờ đi; chỉ mở 1 vòng mỗi lúc
      onToggle(rf, (isOpen) => {
        if (isOpen) {
          for (const o of ringFolders) if (o !== rf) o.close();
          CONFIG.ui.focusRing = idx;
        } else if (CONFIG.ui.focusRing === idx) CONFIG.ui.focusRing = -1;
      });
      ringFolders.push(rf);
    }
  }

  // ---------------- 🚀 Phóng kiếm ----------------
  const gPhong = group('🚀 Phóng kiếm (phím 4)');
  const ST = CONFIG.stream, UR = CONFIG.urchin;
  gPhong.add({ go: () => getSwarm().setState('ATTACK') }, 'go').name('▶ Thử phóng kiếm');
  gPhong.add(CONFIG.attack, 'swordScale', 0.1, 3, 0.05).name('Cỡ kiếm khi phóng / tụ vòng');
  gPhong.add(ST, 'enabled').name('Bay nối đuôi theo dòng cong');
  const gDong = gPhong.addFolder('〰 Dòng kiếm (bay nối đuôi)');
  gDong.add(ST, 'streams', 1, 24, 1).name('Số dòng kiếm');
  gDong.add(ST, 'lanes', 1, 10, 1).name('Số hàng trong mỗi dòng');
  gDong.add(ST, 'laneSpread', 0, 3, 0.05).name('Bề ngang bầy kiếm');
  gDong.add(ST, 'gap', 0.005, 0.2, 0.005).name('Khoảng cách nối đuôi (giây)');
  gDong.add(ST, 'streamDelay', 0, 1, 0.01).name('Các dòng xuất phát lệch nhau');
  gDong.add(ST, 'speed', 2, 40, 0.5).name('Tốc độ bay');
  gDong.add(ST, 'swoop', 0, 10, 0.1).name('Độ cong / toả của dòng');
  gDong.add(ST, 'merge', 0.05, 0.45, 0.01).name('Độ mượt nhập/tách dòng');
  gDong.add(ST.loopRadius, '0', 0.3, 6, 0.1).name('Vòng bay cụm: bán kính nhỏ nhất');
  gDong.add(ST.loopRadius, '1', 0.3, 10, 0.1).name('Vòng bay cụm: bán kính lớn nhất');
  gDong.add(ST, 'loopSpeed', 0, 2, 0.05).name('Tốc độ cụm bay vòng');
  gDong.add(ST, 'loopWobble', 0, 1.2, 0.05).name('Vòng bay lượn lên xuống');
  gDong.add(ST, 'waveAmp', 0, 1.5, 0.05).name('Dòng bay uốn lượn');
  gDong.add(ST, 'followSpeed', 0.1, 3, 0.05).name('Tốc độ đuổi theo mục tiêu mới');
  const gDot = gPhong.addFolder('Kiểu cũ: phóng theo đợt (khi tắt bay nối đuôi)');
  gDot.add(CONFIG.attack, 'batchSize', 1, 250, 1).name('Số kiếm mỗi đợt');
  gDot.add(CONFIG.attack, 'waveInterval', 0, 1, 0.01).name('Giây giữa 2 đợt');
  gDot.close();
  gPhong.add({ note: 'Vòng ngoài phóng trước → vòng trong' }, 'note').name('Thứ tự').disable();

  // ---------------- ⭕ Tụ vòng kiếm ----------------
  const gGai = group('⭕ Tụ vòng kiếm (phím 7 / chữ V)');
  gGai.add({ go: () => getSwarm().setState('URCHIN') }, 'go').name('▶ Tụ thành vòng kiếm');
  gGai.add({ go: () => getSwarm().setState('ORBIT') }, 'go').name('⟲ Về kiếm luân');
  gGai.add(UR, 'radius', 0.1, 3, 0.05).name('Bán kính vòng trong');
  gGai.add(UR, 'layers', 1, 6, 1).name('Số vòng');
  gGai.add(UR, 'layerGap', 0.1, 2, 0.05).name('Khoảng cách các vòng');
  gGai.add(UR, 'spin', -3, 3, 0.05).name('Tốc độ xoay');
  gGai.add(UR, 'alternate').name('Vòng kề nhau xoay ngược');
  gGai.add(UR, 'faceCamera').name('Mặt vòng quay về camera');
  gGai.add(UR, 'pulse', 0, 0.3, 0.01).name('Co giãn nhẹ');
  gGai.add(UR, 'distance', -3, 10, 0.1).name('Cách nhân vật (phía trước)');
  gGai.add(UR, 'up', -3, 5, 0.1).name('Độ cao');
  gGai.add(UR, 'goldEdge').name('Viền lưỡi vòng trong chuyển vàng');
  gGai.add(UR, 'goldRings', 0, 6, 1).name('Số vòng trong bị nhuộm vàng');
  gGai.add(UR, 'goldAlong', 0, 1, 0.05).name('Vàng nhạt dần về mũi').onChange((v) => (shellMat.uniforms.goldAlong.value = v));
  gGai.add(UR, 'coreLight', 0, 2, 0.05).name('Ánh sáng trận pháp ở tâm');
  gGai.addColor(CONFIG.colors, 'edgeGold').name('Màu viền vàng').onChange((v) => shellMat.uniforms.goldEdge.value.set(v));
  gGai.add(UR, 'fxDim', 0, 1, 0.05).name('Độ sáng hiệu ứng khi tụ vòng');
  gGai.add(CONFIG.gesture, 'victoryState', { 'Tụ vòng kiếm': 'URCHIN', 'Kiếm trận xoắn': 'FORMATION' }).name('Cử chỉ chữ V →');

  // ---------------- 🐉 Kim long (phím 0) ----------------
  const gLong = group('🐉 Kim long (phím 0)');
  const DR = CONFIG.dragon;
  gLong.add({ go: () => getSwarm().setState('DRAGON') }, 'go').name('▶ Hoá rồng vàng');
  gLong.add({ go: () => getSwarm().setState('ORBIT') }, 'go').name('⟲ Về kiếm luân');
  gLong.add(DR, 'radius', 3, 40, 0.5).name('Lượn quanh nhân vật (bán kính)');
  gLong.add(DR, 'height', -10, 20, 0.5).name('Độ cao');
  gLong.add(DR, 'wave', 0, 15, 0.5).name('Uốn lên xuống');
  gLong.add(DR, 'speed', 2, 40, 0.5).name('Tốc độ bay');
  gLong.add(DR, 'length', 5, 80, 1).name('Thân rồng dài');
  gLong.add(DR, 'bodyRadius', 0.2, 4, 0.05).name('Thân rồng to');
  gLong.add(DR, 'ringSize', 3, 16, 1).name('Số kiếm mỗi vòng vảy');
  gLong.add(DR, 'twist', 0, 20, 0.5).name('Vảy xoắn dọc thân');
  gLong.add(DR, 'scaleOut', 0, 1.5, 0.05).name('Vảy toả ra ngoài');
  gLong.add(DR, 'headSize', 0.5, 5, 0.1).name('Cỡ đầu rồng');
  gLong.add(DR, 'legs').name('Có 4 chân + móng vuốt');
  gLong.add(DR, 'legLength', 0.5, 5, 0.1).name('Chân dài');
  gLong.add(DR, 'legFront', 0.05, 0.5, 0.01).name('Vị trí chân trước');
  gLong.add(DR, 'legBack', 0.3, 0.9, 0.01).name('Vị trí chân sau');
  gLong.add(DR, 'legSpeed', 0, 10, 0.1).name('Chân quẫy nhanh chậm');
  gLong.add(DR, 'swordScale', 0.2, 3, 0.05).name('Cỡ kiếm khi thành rồng');
  gLong.add(DR, 'gold').name('Rồng vàng (viền lưỡi vàng)');
  gLong.add(DR, 'solid').name('Khối rồng 3D liền (thân vảy, đầu, chân)');
  gLong.add(DR, 'meshFit', 0.5, 1.2, 0.01).name('Khối thân to / nhỏ so với lớp kiếm');
  gLong.add(DR, 'boltRate', 0, 60, 1).name('Sấm sét mỗi giây');
  gLong.add(DR, 'boltReach', 0.3, 6, 0.1).name('Sét văng xa');

  // ---------------- 🎯 Bắn kiếm (phím 9) ----------------
  const gBan = group('🎯 Bắn kiếm (phím 9)');
  const VO = CONFIG.volley;
  gBan.add({ go: () => getSwarm().setState('VOLLEY') }, 'go').name('▶ Bắn kiếm (đối phương = chỗ chuột)');
  gBan.add({ go: () => getSwarm().setState('ORBIT') }, 'go').name('⟲ Về kiếm luân');
  gBan.add(VO, 'radius', 1, 10, 0.1).name('Đội hình rộng');
  gBan.add(VO, 'frontBack', 0, 4, 0.05).name('Hàng trước / sau cách người');
  gBan.add(VO, 'holdTime', 0, 5, 0.1).name('Ngắm bao lâu rồi bắn (giây)');
  gBan.add(VO, 'batch', 1, 100, 1).name('Số kiếm mỗi loạt');
  gBan.add(VO, 'interval', 0, 0.5, 0.01).name('Giây giữa 2 loạt');
  gBan.add(VO, 'speed', 5, 100, 1).name('Tốc độ bay thẳng');
  gBan.add(VO, 'hitSpread', 0, 5, 0.1).name('Kiếm cắm toả quanh đối phương');
  gBan.add(VO, 'linger', 0, 5, 0.1).name('Bắn xong chờ rồi thu kiếm');

  // ---------------- 🗡 Cự kiếm (phím 8) ----------------
  const gCu = group('🗡 Cự kiếm (phím 8)');
  const GI = CONFIG.giant;
  gCu.add({ go: () => getSwarm().setState('GIANT') }, 'go').name('▶ Gọi cự kiếm');
  gCu.add({ go: () => getSwarm().setState('ORBIT') }, 'go').name('⟲ Về kiếm luân');
  const gCu1 = gCu.addFolder('① Đội hình chĩa xuống');
  gCu1.add(GI, 'spacing', 0.2, 2, 0.05).name('Khoảng cách trong hàng');
  gCu1.add(GI, 'rowSpacing', 0.2, 3, 0.05).name('Khoảng cách các hàng (xa gần)');
  gCu1.add(GI, 'aspect', 0.3, 5, 0.1).name('Hàng dài / số hàng');
  gCu1.add(GI, 'formY', -4, 4, 0.05).name('Độ cao đội hình (so với nhân vật)');
  gCu1.add(GI, 'heightJitter', 0, 3, 0.05).name('Cao thấp xen kẽ');
  gCu1.add(GI, 'depthScale', 0, 1.5, 0.05).name('Gần to xa nhỏ');
  gCu1.add(GI, 'swordScale', 0.2, 3, 0.05).name('Cỡ kiếm nhỏ');
  gCu1.add(GI, 'holdTime', 0, 8, 0.1).name('Giữ đội hình (giây) rồi gộp');
  const gCu2 = gCu.addFolder('② Gộp thành cự kiếm');
  gCu2.add(GI, 'mergeTime', 0.2, 4, 0.05).name('Thời gian bay vào');
  gCu2.add(GI, 'mergeSpread', 0, 4, 0.05).name('Lần lượt (độ lệch)');
  gCu2.add(GI, 'scale', 2, 30, 0.5).name('Cỡ cự kiếm');
  gCu2.add(GI, 'grow', 0, 1, 0.05).name('Bùng to lúc gộp xong');
  gCu2.add(GI, 'camZoom').name('Camera tự tiến lại gần');
  gCu2.add(GI, 'camDist', 4, 40, 0.5).name('Khoảng cách camera');
  gCu2.add(GI, 'distance', -5, 12, 0.1).name('Cách nhân vật (phía trước)');
  gCu2.add(GI, 'height', -2, 10, 0.1).name('Độ cao cự kiếm');
  const gCu3 = gCu.addFolder('③ Sấm sét quanh cự kiếm');
  gCu3.add(GI.arcs, 'enabled').name('Sét nhỏ bám lưỡi');
  gCu3.add(GI.arcs, 'active', 0, 60, 1).name('Số tia nhỏ cùng lúc');
  gCu3.add(GI.arcs, 'intensity', 0, 4, 0.05).name('Độ sáng tia nhỏ');
  gCu3.add(GI, 'boltRate', 0, 30, 0.5).name('Sét lớn mỗi giây');
  gCu3.add(GI, 'boltReach', 0.2, 8, 0.1).name('Sét lớn văng xa');
  gCu3.add(GI, 'boltWidth', 0.2, 3, 0.05).name('Sét lớn: độ dày');
  gCu3.add(GI, 'coreGlow', 0, 6, 0.1).name('Lõi kiếm phát sáng');
  gCu3.add(GI.coreArcs, 'enabled').name('Sét chạy dọc lõi');
  gCu3.add(GI.coreArcs, 'active', 0, 20, 1).name('Số tia dọc lõi');
  gCu3.add(GI.coreArcs, 'intensity', 0, 5, 0.05).name('Độ sáng tia dọc lõi');
  const gCu5 = gCu.addFolder('⑤ Phù văn trên lưỡi cự kiếm');
  gCu5.add(GI.glyphs, 'enabled').name('Hiện phù văn');
  addGlyphPicker(gCu5);
  gCu5.add(GI.glyphs, 'count', 0, 8, 1).name('Số chữ');
  gCu5.add(GI.glyphs, 'size', 0.2, 2, 0.05).name('Cỡ chữ');
  gCu5.add(GI.glyphs, 'span', 0.2, 1, 0.05).name('Trải dài theo lưỡi');
  gCu5.add(GI.glyphs, 'intensity', 0, 4, 0.05).name('Độ sáng');
  gCu5.close();
  const gCu4 = gCu.addFolder('④ Viền vàng cự kiếm');
  gCu4.add(GI, 'goldEdge').name('Viền lưỡi cự kiếm màu vàng');
  gCu4.add(GI, 'edgeWidth', 0.05, 0.9, 0.01).name('Độ dày viền vàng');
  gCu4.add(GI, 'edgeIntensity', 0, 4, 0.05).name('Độ sáng viền vàng');
  gCu4.close();
  for (const f of [gCu1, gCu2, gCu3]) f.close();

  // ---------------- 🛡 Kiếm thuẫn hộ thân ----------------
  const gThuan = group('🛡 Kiếm thuẫn hộ thân');
  CONFIG.shield.layers.forEach((l, i) => {
    const lb = i === 0 ? 'Lớp trong' : 'Lớp ngoài';
    gThuan.add(l, 'radius', 0.8, 6, 0.05).name(`${lb}: bán kính`);
  });
  gThuan.add(CONFIG.shield, 'flySpeed', 0, 3, 0.05).name('Tốc độ bay (ngoài →, trong ←)');
  gThuan.add(CONFIG.shield, 'thickness', 0, 3, 0.05).name('Độ dày mỗi quả cầu');
  gThuan.add(CONFIG.shield, 'swordScale', 0.1, 4, 0.05).name('Cỡ kiếm khi hộ thân');
  gThuan.add(CONFIG, 'spreadRadiusMul', 1.2, 3, 0.1).name('Độ tung kiếm (phím 2)');

  // ---------------- 🗡 Hình kiếm ----------------
  const gHinh = group('🗡 Hình kiếm');
  // Màu theo phim (tập 173): thân xanh ngọc ngả lam đậm, hơi trong, mép xanh ngọc nhạt, bớt chói.
  // Dùng nút này nếu đã từng "Lưu làm mặc định" (màu đã lưu sẽ đè màu mặc định mới).
  const FILM = { shellBody: 0x0b4d4c, shellEdge: 0x7ff2dc, shellAlpha: 0.62, shellEdgeIntensity: 0.95, shellEdgeWidth: 0.12, emissiveIntensity: 0.3 };
  gHinh.add({ film: () => {
    Object.assign(CONFIG.colors, { shellBody: FILM.shellBody, shellEdge: FILM.shellEdge, emissiveIntensity: FILM.emissiveIntensity });
    Object.assign(CONFIG.sword, { shellAlpha: FILM.shellAlpha, shellEdgeIntensity: FILM.shellEdgeIntensity, shellEdgeWidth: FILM.shellEdgeWidth });
    const U = shellMat.uniforms;
    U.bodyColor.value.set(FILM.shellBody); U.edgeColor.value.set(FILM.shellEdge);
    U.bodyAlpha.value = FILM.shellAlpha; U.edgeIntensity.value = FILM.shellEdgeIntensity; U.edgeStart.value = 1 - FILM.shellEdgeWidth;
    swordMat.emissiveIntensity = FILM.emissiveIntensity;
    gHinh.controllersRecursive().forEach((c) => c.updateDisplay());
  } }, 'film').name('🎨 Áp màu kiếm theo phim');
  gHinh.add(CONFIG.sword, 'shellAlpha', 0, 1, 0.01).name('Độ đục thân kiếm').onChange((v) => (shellMat.uniforms.bodyAlpha.value = v));
  gHinh.addColor(CONFIG.colors, 'shellBody').name('Màu thân kiếm').onChange((v) => shellMat.uniforms.bodyColor.value.set(v));
  gHinh.add(CONFIG.sword, 'shellEdgeIntensity', 0, 4, 0.05).name('Độ sáng viền').onChange((v) => (shellMat.uniforms.edgeIntensity.value = v));
  gHinh.add(CONFIG.sword, 'shellEdgeWidth', 0.02, 0.5, 0.01).name('Độ dày viền').onChange((v) => (shellMat.uniforms.edgeStart.value = 1 - v));
  gHinh.addColor(CONFIG.colors, 'shellEdge').name('Màu viền').onChange((v) => shellMat.uniforms.edgeColor.value.set(v));
  gHinh.add(CONFIG.colors, 'emissiveIntensity', 0, 1.5, 0.05).name('Độ sáng lõi trúc').onChange((v) => (swordMat.emissiveIntensity = v));
  gHinh.add(CONFIG.sword, 'nearBoost', 0, 1.5, 0.05).name('Kiếm gần sáng hơn');
  gHinh.add(CONFIG.sword.hiltDust, 'enabled').name('Chấm vàng quanh lưỡi');
  gHinh.add(CONFIG.sword.hiltDust, 'size', 0.01, 0.1, 0.005).name('Cỡ chấm vàng');
  gHinh.add(CONFIG.sword.hiltDust, 'perSword', 2, 40, 1).name('Số chấm / kiếm').onFinishChange(rebuild);

  // ---------------- ✨ Hiệu ứng ----------------
  const gFx = group('✨ Hiệu ứng');
  const gSet = gFx.addFolder('⚡ Sét');
  gSet.add(CONFIG.lightning, 'rateMul', 0, 3, 0.1).name('Mật độ sét (chung)').onChange((v) => { lightning.rateMul = v; bladeArcs.rateMul = v; runeArcs.rateMul = v; });
  gSet.add(CONFIG.lightning, 'jag', 0.05, 0.4, 0.01).name('Độ gãy khúc');
  gSet.add(CONFIG.lightning.bladeArcs, 'enabled').name('Sét trên lưỡi kiếm').listen();
  gSet.add(CONFIG.lightning.bladeArcs, 'style', { 'Như phim (ngắn, có nhánh)': 'crackle', 'Dài mũi → cán (cũ)': 'long' }).name('Kiểu tia');
  gSet.add(CONFIG.lightning.bladeArcs.len, '1', 0.05, 0.8, 0.01).name('Độ dài tia ngắn');
  gSet.add(CONFIG.lightning.bladeArcs, 'branch', 0, 1, 0.05).name('Tia có nhánh');
  gSet.add(CONFIG.lightning.bladeArcs, 'active', 0, 8, 0.5).name('Số tia cùng lúc / kiếm');
  gSet.add(CONFIG.lightning.bladeArcs, 'intensity', 0, 4, 0.05).name('Độ sáng tia trên lưỡi');
  gSet.add(CONFIG.lightning.bladeArcs, 'jag', 0.05, 1.5, 0.05).name('Độ gãy khúc tia');
  const gVet = gFx.addFolder('〰 Vệt kiếm');
  gVet.add(CONFIG.trail, 'enabled').name('Hiện vệt kiếm').listen();
  gVet.add(CONFIG.trail, 'intensity', 0, 1.5, 0.02).name('Độ sáng');
  gVet.add(CONFIG.trail, 'minSpeed', 0, 10, 0.1).name('Tốc độ bắt đầu hiện');
  gVet.add(CONFIG.trail, 'fullSpeed', 1, 20, 0.5).name('Tốc độ sáng tối đa');
  const gBl = gFx.addFolder('💡 Phát sáng (bloom)');
  gBl.add(CONFIG.bloom, 'strength', 0, 3, 0.05).name('Cường độ').onChange((v) => (bloom.strength = v));
  gBl.add(CONFIG.bloom, 'radius', 0, 1, 0.05).name('Độ toả').onChange((v) => (bloom.radius = v));
  gBl.add(CONFIG.bloom, 'threshold', 0, 1, 0.01).name('Ngưỡng').onChange((v) => (bloom.threshold = v));
  for (const f of [gSet, gVet, gBl]) f.close();

  // ---------------- 🔯 Phù văn ----------------
  const gRune = group('🔯 Phù văn');
  gRune.add(CONFIG.rune, 'enabled').name('Hiện trận đồ');
  gRune.add(CONFIG.rune, 'radius', 0.3, 8, 0.05).name('Bán kính');
  gRune.add(CONFIG.rune, 'depth', -5, 3, 0.01).name('Lệch trước (+) / sau (−)');
  gRune.add(CONFIG.rune, 'spinMul', -3, 3, 0.05).name('Tốc độ xoay (chung)');
  gRune.add(CONFIG.rune, 'miniScale', 0.3, 4, 0.05).name('Cỡ kiếm nhỏ (chung)');
  // Từng lớp kiếm nhỏ
  CONFIG.rune.minis.forEach((l, i) => {
    const f = gRune.addFolder(`Lớp kiếm nhỏ ${i + 1}`);
    f.add(l, 'visible').name('Hiện lớp này').listen();
    f.add({ solo: () => CONFIG.rune.minis.forEach((m, k) => (m.visible = k === i)) }, 'solo').name('🎯 Chỉ hiện lớp này');
    f.add(l, 'glyphs').name('Phù văn vàng trên lưỡi');
    if (l.goldRings === undefined) l.goldRings = false;
    f.add(l, 'goldRings').name('Viền vàng quanh cán tròn');
    f.add(l, 'count', 3, 120, 1).name('Số kiếm'); // phù văn tự dựng lại khi đổi số
    f.add(l, 'r', 0.05, 12, 0.01).name('Bán kính');
    if (l.z === undefined) l.z = 0;
    f.add(l, 'z', -1.5, 1.5, 0.01).name('Đẩy tới (+) / lùi (−)');
    f.add(l, 'scale', 0.05, 2, 0.01).name('Cỡ kiếm');
    f.add(l, 'spin', -2, 2, 0.05).name('Tốc độ xoay');
    f.close();
  });
  const gRA = gRune.addFolder('⚡ Sét trên kiếm nhỏ');
  gRA.add(CONFIG.rune.arcs, 'enabled').name('Hiện sét trên kiếm nhỏ').listen();
  gRA.add(CONFIG.rune.arcs, 'style', { 'Như phim (ngắn, có nhánh)': 'crackle', 'Dài mũi → cán (cũ)': 'long' }).name('Kiểu tia');
  gRA.add(CONFIG.rune.arcs.len, '1', 0.05, 0.8, 0.01).name('Độ dài tia ngắn');
  gRA.add(CONFIG.rune.arcs, 'branch', 0, 1, 0.05).name('Tia có nhánh');
  gRA.add(CONFIG.rune.arcs, 'active', 0, 8, 0.5).name('Số tia cùng lúc / kiếm');
  gRA.add(CONFIG.rune.arcs, 'intensity', 0, 4, 0.05).name('Độ sáng tia');
  gRA.add(CONFIG.rune.arcs, 'jag', 0.05, 1.5, 0.05).name('Độ gãy khúc');
  gRA.close();
  gRune.add({ all: () => CONFIG.rune.minis.forEach((m) => (m.visible = true)) }, 'all').name('👁 Hiện tất cả lớp kiếm nhỏ');
  const gG = gRune.addFolder('✍ Phù văn vàng trên lưỡi');
  addGlyphPicker(gG);
  gG.add(CONFIG.rune.glyph, 'intensity', 0, 3, 0.05).name('Độ sáng phù văn');
  gG.add(CONFIG.rune.glyph, 'size', 0.3, 3, 0.05).name('Cỡ chữ phù văn');
  gG.close();
  const gCore = gRune.addFolder('☯ Trung tâm trận');
  const CR = CONFIG.rune.core;
  gCore.add(CONFIG.rune, 'showCore').name('Hiện trung tâm trận');
  gCore.add(CR, 'radius', 0.2, 4, 0.05).name('Bán kính');
  gCore.add(CR, 'intensity', 0, 2, 0.05).name('Độ sáng 6 gạch + vòng');
  gCore.add(CR, 'spin', -2, 2, 0.05).name('Tốc độ xoay 6 gạch');
  gCore.add(CR, 'centerSize', 0, 1.5, 0.05).name('Cỡ tâm sáng');
  gCore.add(CR, 'wispIntensity', 0, 2, 0.05).name('Độ sáng linh lực');
  gCore.add(CR, 'wispSpeed', 0, 4, 0.05).name('Tốc độ linh lực xoay');
  gCore.close();

  // ---------------- 🧍 Nhân vật (ảnh thật) ----------------
  const gHero = group('🧍 Nhân vật (ảnh)');
  const HI = CONFIG.heroImage;
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.hidden = true;
  document.body.appendChild(fileIn);
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (f) { HI.enabled = true; await heroPhoto.useFile(f); }
    fileIn.value = '';
  });
  const heroUi = {
    pick: () => fileIn.click(),
    clear: () => heroPhoto.clear(),
    status: heroPhoto.status,
  };
  heroPhoto.onStatus = (st) => { heroUi.status = st; };
  gHero.add(heroUi, 'pick').name('📁 Chọn ảnh nhân vật từ máy…');
  gHero.add(heroUi, 'status').name('Trạng thái').disable().listen();
  gHero.add(HI, 'enabled').name('Dùng ảnh thay hình 3D').listen().onChange(() => heroPhoto.process());
  gHero.add(CONFIG.sword, 'heroSwordScale', 0.5, 8, 0.1).name('Cỡ phi kiếm dưới chân');
  gHero.add(CONFIG.heroFly, 'speed', 1, 40, 0.5).name('🕊 Tốc độ bay (WASD)');
  gHero.add(CONFIG.heroFly, 'boost', 1, 6, 0.1).name('🕊 Giữ Shift bay nhanh ×');
  gHero.add(CONFIG.heroFly, 'vertical', 1, 30, 0.5).name('🕊 Tốc độ lên / xuống (R / F)');
  gHero.add(CONFIG.heroFly, 'camFollow').name('🕊 Camera bay theo nhân vật');
  gHero.add(CONFIG.heroFly, 'turn').name('🕊 Quay đầu theo hướng bay');
  gHero.add(CONFIG.heroFly, 'turnRate', 0.5, 12, 0.5).name('🕊 Tốc độ quay đầu');
  gHero.add({ home: () => { const d = hero.base.clone().negate(); hero.base.set(0, 0, 0); camera.position.add(d); controls.target.add(d); } }, 'home').name('🏠 Về chỗ xuất phát');
  gHero.add(HI, 'height', 0.5, 6, 0.05).name('Chiều cao nhân vật');
  gHero.add(HI, 'offsetY', -1, 2, 0.01).name('Lên / xuống');
  gHero.add(HI, 'offsetX', -1, 1, 0.01).name('Trái / phải');
  gHero.add(HI, 'brightness', 0.3, 2, 0.05).name('Độ sáng ảnh');
  gHero.add(HI, 'flip').name('Lật ngang ảnh');
  gHero.add(HI, 'removeBg').name('Tự xoá nền ảnh').onChange(() => heroPhoto.process());
  gHero.add(HI, 'tolerance', 5, 120, 1).name('Mức xoá nền').onFinishChange(() => heroPhoto.process());
  gHero.add(heroUi, 'clear').name('🗑 Bỏ ảnh, dùng lại hình 3D');

  // ---------------- 🌄 Cảnh ----------------
  const gCanh = group('🌄 Cảnh');
  gCanh.add({ get p() { return CONFIG.scene.palette; }, set p(v) { try { localStorage.setItem('phiKiem.palette', v); } catch { /* bỏ qua */ } location.reload(); } },
    'p', { 'Thảo nguyên ban đêm (tối)': 'steppeNight', 'Thảo nguyên ban ngày': 'steppe', 'Đêm tím': 'night', 'Hoàng hôn': 'dusk' }).name('Cảnh (tải lại trang)');
  gCanh.add(CONFIG.view, 'exposure', 0.4, 3, 0.05).name('☀ Độ sáng cảnh').onChange((v) => { const r = window.__phiKiem?.renderer; if (r) r.toneMappingExposure = v; });
  gCanh.add(CONFIG.scene, 'flightMul', 0, 3, 0.1).name('Tốc độ bay');
  const TR = CONFIG.scene.terrain, regen = () => terrain?.anchor.set(1e9, 1e9); // dựng lại cảnh ngay
  gCanh.add(TR, 'enabled').name('Cảnh núi non 3D (cỏ cây, sông, mây)');
  gCanh.add(TR, 'mountainHeight', 10, 220, 1).name('Núi cao').onFinishChange(regen);
  gCanh.add(TR, 'groundY', -150, -10, 1).name('Mặt đất thấp hơn nhân vật').onFinishChange(regen);
  gCanh.add(TR, 'valleyHalf', 10, 300, 1).name('Thung lũng rộng').onFinishChange(regen);
  gCanh.add(TR, 'treeDensity', 0, 1, 0.05).name('Mật độ cây').onFinishChange(regen);
  gCanh.add(CONFIG.camFollow, 'enabled').name('Phi kiếm xa: camera tự lùi theo');
  gCanh.add(CONFIG.view, 'minDistance', 0.3, 8, 0.1).name('Zoom gần nhất (nhỏ = to hơn)').onChange((v) => (controls.minDistance = v));

  gLuan.open(); // mở sẵn nhóm hay dùng nhất
  gui.close();
  return gui;
}
