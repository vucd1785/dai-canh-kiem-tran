// CẤU HÌNH "NHẸ MÁY" — MẶC ĐỊNH khi mở trang. Muốn đầy đủ (nhiều kiếm, đủ hiệu ứng) thì bấm nút ✨ Đầy đủ
// (dưới nút camera) hoặc chọn trong 💾 Lưu cấu hình → Cấu hình chạy.
// Áp ĐÈ lên cấu hình đang dùng (mặc định + đã lưu) mỗi khi mở trang ở chế độ nhẹ; cấu hình mặc định KHÔNG bị đổi:
// lúc đang nhẹ máy mà bấm "Lưu làm mặc định" thì các giá trị dưới đây được lưu bằng giá trị gốc (trước khi giảm).
export const LIGHT = {
  countMul: 0.5,       // số kiếm mỗi vòng kiếm luân × 0.5
  miniCountMul: 0.5,   // số kiếm nhỏ mỗi lớp phù văn × 0.5
  values: {
    maxPixelRatio: 1,                         // không vẽ gấp đôi trên màn hình nét cao (đỡ nặng nhất)
    'lightning.bladeArcs.enabled': false,     // sét trên từng lưỡi kiếm
    'rune.arcs.enabled': false,               // sét trên kiếm nhỏ phù văn
    'lightning.rateMul': 0.4,                 // sét nối giữa các kiếm thưa lại
    'trail.enabled': false,                   // vệt kiếm
    'sword.hiltDust.enabled': false,          // chấm vàng quanh lưỡi
    'scene.terrain.enabled': false,           // cảnh núi non 3D
    'scene.cloudCount': 30, 'scene.streakCount': 20,
    'rune.core.wisps': 10,                    // dải linh lực trung tâm trận
    'giant.arcs.active': 10, 'giant.coreArcs.active': 6, 'giant.boltRate': 5,
    'dragon.boltRate': 6,
  },
};

export const QUALITY_KEY = 'phiKiem.quality';
// Mặc định là NHẸ MÁY; chỉ khi đã chọn "Đầy đủ" thì mới chạy bản đầy đủ
export function getQuality() {
  try { return localStorage.getItem(QUALITY_KEY) === 'full' ? 'full' : 'light'; } catch { return 'light'; }
}
export function setQuality(q) {
  try { localStorage.setItem(QUALITY_KEY, q); } catch { /* bỏ qua */ }
}

const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'), last = ks.pop(), t = ks.reduce((a, k) => (a == null ? undefined : a[k]), o);
  if (t != null && last in t) t[last] = v;
}

// Áp cấu hình nhẹ lên CONFIG, nhớ lại giá trị gốc để khi Lưu thì lưu giá trị gốc (giữ nguyên mặc định)
export function applyLight(CONFIG) {
  const orig = { values: {}, ringCounts: CONFIG.rings.map((r) => r.count), miniCounts: CONFIG.rune.minis.map((m) => m.count) };
  for (const [p, v] of Object.entries(LIGHT.values)) {
    orig.values[p] = JSON.parse(JSON.stringify(getPath(CONFIG, p) ?? null));
    setPath(CONFIG, p, v);
  }
  CONFIG.rings.forEach((r) => { r.count = Math.max(3, Math.round(r.count * LIGHT.countMul)); });
  CONFIG.rune.minis.forEach((m) => { m.count = Math.max(3, Math.round(m.count * LIGHT.miniCountMul)); });
  CONFIG._lightOrig = orig;
}

// Khi lưu ở chế độ nhẹ: trả các giá trị bị giảm về giá trị gốc trong bản lưu
export function restoreLightInSnapshot(CONFIG, snap) {
  const o = CONFIG._lightOrig;
  if (!o) return snap;
  for (const [p, v] of Object.entries(o.values)) if (p in snap) snap[p] = v;
  if (snap.rings) snap.rings.forEach((r, i) => {
    // vòng nào người dùng vừa chỉnh số kiếm trong lúc nhẹ máy thì quy đổi ngược lại theo tỉ lệ
    const light = Math.max(3, Math.round((o.ringCounts[i] ?? r.count) * LIGHT.countMul));
    r.count = r.count === light ? (o.ringCounts[i] ?? r.count) : Math.round(r.count / LIGHT.countMul);
  });
  if (snap['rune.minis']) snap['rune.minis'].forEach((m, i) => {
    const light = Math.max(3, Math.round((o.miniCounts[i] ?? m.count) * LIGHT.miniCountMul));
    m.count = m.count === light ? (o.miniCounts[i] ?? m.count) : Math.round(m.count / LIGHT.miniCountMul);
  });
  return snap;
}
