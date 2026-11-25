// Lưu / nạp các thông số chỉnh trong bảng Thông số (lưu trong trình duyệt bằng localStorage).
// Chỉ lưu những giá trị chỉnh được trong bảng (TUNABLES), các thiết kế khác vẫn lấy từ config.js.
import { restoreLightInSnapshot } from './presets.js';

export const STORAGE_KEY = 'phiKiem.settings.v1';

export const TUNABLES = [
  'rings', 'halo.back', 'halo.up', 'sword.swarmScale', 'heroFly.speed', 'heroFly.boost', 'heroFly.vertical', 'heroFly.camFollow', 'heroFly.turn', 'heroFly.turnRate', 'sword.heroSwordScale',
  'shield.layers', 'shield.flySpeed', 'shield.thickness', 'shield.swordScale', 'attack.swordScale', 'stream.waveAmp', 'stream.lanes', 'stream.laneSpread',
  'speed.default', 'sword.nearBoost', 'spreadRadiusMul',
  'lightning.rateMul', 'lightning.jag', 'lightning.bladeArcs.enabled', 'lightning.bladeArcs.active', 'lightning.bladeArcs.intensity', 'lightning.bladeArcs.jag', 'lightning.bladeArcs.style', 'lightning.bladeArcs.len', 'lightning.bladeArcs.branch',
  'attack.batchSize', 'attack.waveInterval',
  'trail.enabled', 'trail.intensity', 'trail.minSpeed', 'trail.fullSpeed',
  'rune.enabled', 'rune.radius', 'rune.depth', 'rune.spinMul',
  'rune.minis', 'rune.miniScale', 'rune.showCore',
  'rune.core.radius', 'rune.core.spin', 'rune.core.intensity', 'rune.core.centerSize', 'rune.core.wispSpeed', 'rune.core.wispIntensity',
  'rune.glyph.intensity', 'rune.glyph.size', 'rune.glyph.threshold', 'rune.glyph.mode', 'rune.glyph.text', 'rune.glyph.font',
  'rune.arcs.enabled', 'rune.arcs.active', 'rune.arcs.intensity', 'rune.arcs.jag', 'rune.arcs.style', 'rune.arcs.len', 'rune.arcs.branch',
  'sword.shellAlpha', 'sword.shellEdgeIntensity', 'sword.shellEdgeWidth',
  'colors.shellEdge', 'colors.shellBody', 'colors.emissiveIntensity',
  'sword.hiltDust.enabled', 'sword.hiltDust.size', 'sword.hiltDust.perSword',
  'bloom.strength', 'bloom.radius', 'bloom.threshold',
  'scene.flightMul', 'scene.terrain.enabled', 'scene.terrain.mountainHeight', 'scene.terrain.groundY', 'scene.terrain.valleyHalf', 'scene.terrain.treeDensity', 'camFollow.enabled',
  'view.minDistance', 'view.exposure',
  'stream.enabled', 'stream.streams', 'stream.gap', 'stream.streamDelay', 'stream.speed', 'stream.swoop', 'stream.merge', 'stream.loopRadius', 'stream.loopSpeed', 'stream.loopWobble', 'stream.followSpeed',
  'urchin.radius', 'urchin.layers', 'urchin.alternate', 'urchin.faceCamera', 'urchin.layerGap', 'urchin.spin', 'urchin.pulse', 'urchin.distance', 'urchin.up', 'urchin.fxDim', 'urchin.goldEdge', 'urchin.goldRings', 'urchin.goldAlong', 'urchin.coreLight', 'colors.edgeGold', 'gesture.victoryState', 'dragon.radius', 'dragon.height', 'dragon.wave', 'dragon.speed', 'dragon.length', 'dragon.bodyRadius', 'dragon.ringSize', 'dragon.twist', 'dragon.scaleOut', 'dragon.headSize', 'dragon.solid', 'dragon.meshFit', 'dragon.legs', 'dragon.legLength', 'dragon.legFront', 'dragon.legBack', 'dragon.legSpeed', 'dragon.swordScale', 'dragon.gold', 'dragon.boltRate', 'dragon.boltReach', 'volley.radius', 'volley.inner', 'volley.frontBack', 'volley.holdTime', 'volley.batch', 'volley.interval', 'volley.speed', 'volley.hitSpread', 'volley.linger', 'giant.distance', 'giant.height', 'giant.formY', 'giant.heightJitter', 'giant.depthScale', 'giant.grow', 'giant.camZoom', 'giant.camDist', 'giant.goldEdge', 'giant.edgeWidth', 'giant.edgeIntensity', 'giant.spacing', 'giant.rowSpacing', 'giant.aspect', 'giant.holdTime', 'giant.mergeTime', 'giant.mergeSpread', 'giant.scale', 'giant.swordScale', 'giant.boltRate', 'giant.boltReach', 'giant.boltWidth', 'giant.coreGlow', 'giant.coreArcs.enabled', 'giant.coreArcs.active', 'giant.coreArcs.intensity', 'giant.glyphs', 'giant.arcs.enabled', 'giant.arcs.active', 'giant.arcs.intensity', 'gesture.handTilt', 'gesture.handHold', 'gesture.idleReset',
  'heroImage.enabled', 'heroImage.height', 'heroImage.offsetX', 'heroImage.offsetY', 'heroImage.removeBg', 'heroImage.tolerance', 'heroImage.brightness', 'heroImage.flip',
];

const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((a, k) => (a == null ? undefined : a[k]), o);
  if (t != null && last in t) t[last] = v;
}

export function snapshot(CONFIG) {
  const out = {};
  for (const p of TUNABLES) {
    const v = getPath(CONFIG, p);
    if (v === undefined) continue;
    out[p] = JSON.parse(JSON.stringify(v));
    // Trạng thái ẩn/hiện vòng chỉ để chỉnh cho dễ — không lưu (mở lại trang luôn hiện đủ)
    if (p === 'rings' || p === 'rune.minis') for (const r of out[p]) delete r.visible;
  }
  return out;
}

// Áp 1 bộ thông số dạng { 'đường.dẫn': giá trị } lên CONFIG (vd. cấu hình mặc định của người dùng)
export function applyPreset(CONFIG, preset) {
  for (const p in preset) setPath(CONFIG, p, JSON.parse(JSON.stringify(preset[p])));
}

export function loadSaved(CONFIG) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return false;
    for (const p of TUNABLES) if (p in saved) setPath(CONFIG, p, saved[p]);
    for (const r of CONFIG.rings) r.visible = true;
    return true;
  } catch {
    return false; // trình duyệt chặn lưu trữ / dữ liệu hỏng → dùng mặc định
  }
}

export function saveSettings(CONFIG) {
  // đang Nhẹ máy → lưu giá trị gốc (trước khi giảm) để cấu hình mặc định giữ nguyên
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(restoreLightInSnapshot(CONFIG, snapshot(CONFIG)))); return true; }
  catch { return false; }
}

export function clearSettings() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* bỏ qua */ }
}
