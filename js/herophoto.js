// NHÂN VẬT BẰNG ẢNH THẬT: dùng ảnh người dùng chọn thay cho hình 3D mô phỏng.
//  - Ảnh dựng thành tấm phẳng đứng trên phi kiếm, luôn quay mặt về camera (xoay quanh trục đứng).
//  - Tự xoá nền (loang từ mép ảnh, xoá vùng cùng màu nền) nếu ảnh không có nền trong suốt.
//  - Ảnh được nhớ trong trình duyệt (IndexedDB) → mở lại trang vẫn còn.
//  - Nếu có file assets/hero.png trong thư mục dự án thì tự dùng file đó khi chưa chọn ảnh nào.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const DB = 'phiKiem', STORE = 'files', KEY = 'heroImage';

function idb(mode, fn) {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
      const tx = rq.result.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(r?.result);
      tx.onerror = () => rej(tx.error);
    };
  });
}
const saveBlob = (blob) => idb('readwrite', (s) => s.put(blob, KEY));
const loadBlob = () => idb('readonly', (s) => s.get(KEY));
const clearBlob = () => idb('readwrite', (s) => s.delete(KEY));

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

// Xoá nền: loang từ mọi điểm ở mép ảnh, điểm nào gần màu nền (trong ngưỡng tol) thì trong suốt.
// Ảnh đã có nền trong suốt thì giữ nguyên. Cuối cùng làm mềm viền 1 điểm ảnh.
function removeBackground(cv, tol) {
  const g = cv.getContext('2d', { willReadFrequently: true });
  const W = cv.width, H = cv.height;
  const img = g.getImageData(0, 0, W, H), d = img.data;
  let transparentEdge = 0, edgeN = 0;
  const edge = [];
  for (let x = 0; x < W; x++) edge.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) edge.push(y * W, y * W + W - 1);
  for (const p of edge) { edgeN++; if (d[p * 4 + 3] < 20) transparentEdge++; }
  if (transparentEdge / edgeN > 0.5) return; // đã có nền trong suốt sẵn

  const t2 = tol * tol * 3;
  const mask = new Uint8Array(W * H);
  const stack = [];
  // màu nền cục bộ: mỗi điểm mép tự làm "hạt giống" với màu của chính nó (nền chuyển màu vẫn xoá được)
  const seedCol = new Float32Array(W * H * 3);
  for (const p of edge) {
    if (mask[p]) continue;
    mask[p] = 1; stack.push(p);
    seedCol.set([d[p * 4], d[p * 4 + 1], d[p * 4 + 2]], p * 3);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    const r0 = seedCol[p * 3], g0 = seedCol[p * 3 + 1], b0 = seedCol[p * 3 + 2];
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
      if (q < 0 || mask[q]) continue;
      const dr = d[q * 4] - r0, dg = d[q * 4 + 1] - g0, db = d[q * 4 + 2] - b0;
      if (dr * dr + dg * dg + db * db > t2) continue;
      mask[q] = 1; stack.push(q);
      // màu tham chiếu trôi chậm theo nền
      seedCol[q * 3] = r0 * 0.9 + d[q * 4] * 0.1;
      seedCol[q * 3 + 1] = g0 * 0.9 + d[q * 4 + 1] * 0.1;
      seedCol[q * 3 + 2] = b0 * 0.9 + d[q * 4 + 2] * 0.1;
    }
  }
  for (let p = 0; p < W * H; p++) {
    if (mask[p]) { d[p * 4 + 3] = 0; continue; }
    // viền mềm: điểm giáp nền chỉ còn nửa độ đục
    const x = p % W;
    if ((x > 0 && mask[p - 1]) || (x < W - 1 && mask[p + 1]) || mask[p - W] || mask[p + W]) d[p * 4 + 3] >>= 1;
  }
  g.putImageData(img, 0, 0);
}

export class HeroPhoto {
  constructor(hero) {
    this.hero = hero;
    this.source = null; // ảnh gốc (đã thu nhỏ)
    this.mat = new THREE.MeshBasicMaterial({
      transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, toneMapped: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
    this.holder = new THREE.Group(); // nhóm xoay quay về camera
    this.holder.add(this.mesh);
    hero.root.add(this.holder);
    this.status = 'Chưa có ảnh';
    this.onStatus = null;
  }

  _setStatus(s) { this.status = s; this.onStatus?.(s); }

  // Nạp ảnh đã lưu, không có thì thử assets/hero.png
  async init() {
    try {
      const blob = await loadBlob();
      if (blob) return await this._useBlob(blob, 'Ảnh đã lưu');
    } catch { /* trình duyệt chặn lưu trữ */ }
    try {
      const im = await loadImage('assets/hero.png');
      this._useImage(im, 'assets/hero.png');
    } catch { this._apply(); }
  }

  // Người dùng chọn file ảnh từ máy
  async useFile(file) {
    await this._useBlob(file, file.name);
    try { await saveBlob(file); this._setStatus(`Đã dùng & lưu: ${file.name}`); }
    catch { this._setStatus(`Đã dùng (không lưu được): ${file.name}`); }
  }

  async clear() {
    try { await clearBlob(); } catch { /* bỏ qua */ }
    this.source = null;
    this.mat.map?.dispose(); this.mat.map = null;
    this._setStatus('Đã xoá ảnh — dùng lại hình 3D');
    this._apply();
  }

  async _useBlob(blob, label) {
    const url = URL.createObjectURL(blob);
    try { this._useImage(await loadImage(url), label); }
    finally { URL.revokeObjectURL(url); }
  }

  _useImage(im, label) {
    // thu nhỏ để nhẹ máy (cao tối đa 1400 điểm ảnh)
    const k = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(im.naturalWidth * k));
    cv.height = Math.max(1, Math.round(im.naturalHeight * k));
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    this.source = cv;
    this.process();
    this._setStatus(`Đang dùng: ${label}`);
  }

  // Xử lý lại (xoá nền theo ngưỡng hiện tại) — gọi khi đổi tuỳ chọn xoá nền
  process() {
    if (!this.source) return this._apply();
    const P = CONFIG.heroImage, src = this.source;
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0);
    if (P.removeBg) removeBackground(cv, P.tolerance);
    this.mat.map?.dispose();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.mat.map = tex;
    this.mat.needsUpdate = true;
    this.aspect = cv.width / cv.height;
    this._apply();
  }

  // Bật ảnh / hình 3D và đặt cỡ, vị trí
  _apply() {
    const P = CONFIG.heroImage, on = P.enabled && !!this.mat.map;
    this.mesh.visible = on;
    this.hero.setFigureVisible(!on);
    if (!on) return;
    const h = P.height;
    this.mesh.scale.set(h * this.aspect * (P.flip ? -1 : 1), h, 1);
    this.mesh.position.set(P.offsetX, P.offsetY + h / 2, 0);
    this.mat.color.setScalar(P.brightness);
  }

  // Mỗi khung hình: quay mặt ảnh về camera (chỉ xoay quanh trục đứng → nhân vật không bị nghiêng)
  update(camera) {
    if (!this.mesh.visible) return;
    this._apply();
    const wp = this.holder.getWorldPosition(new THREE.Vector3());
    this.holder.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z) - this.hero.root.rotation.y;
  }
}
