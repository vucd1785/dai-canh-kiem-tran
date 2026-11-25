// Trận đồ phù văn nằm trước 2 lớp kiếm luân:
//  - Các LỚP KIẾM NHỎ xoay xen kẽ chiều (CONFIG.rune.minis), ẩn/hiện được từng lớp.
//  - Lớp nào bật "glyphs" thì lưỡi kiếm nhỏ có PHÙ VĂN VÀNG khắc từ chỗ cán lên phía lưỡi.
//  - TRUNG TÂM TRẬN (CONFIG.rune.core): 6 gạch vàng đơn giản toả từ tâm tới vòng tròn vàng,
//    tâm sáng, và các dải LINH LỰC dài ngắn / sáng tối không đều nhau xoay tròn bên trong.
// Tất cả vẽ bằng code / canvas (không lấy hình từ phim).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { softDotTexture } from '../scene.js';

const TAU = Math.PI * 2;

// ---------- Phù văn vàng trên lưỡi kiếm nhỏ ----------
// CHỈ 1 CHỮ phù văn kiểu BÚT THẢO bay bổng (nét quét dài, vòng tròn, nét gãy, chấm) — vẽ bằng nét bút lông
// to giữa, thon 2 đầu, có quầng sáng. Tự vẽ theo phong cách thư pháp, không chép chữ có sẵn.
function drawDefaultGlyph(cv) {
  const S = cv.width;
  const g = cv.getContext('2d');
  g.save();
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#fff';
  // 1 nét bút: đường Bézier bậc 3 qua các điểm (toạ độ 0..1), bề dày w0 → to nhất ở giữa → w1
  const brush = (p0, p1, p2, p3, w0, wMid, w1) => {
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = 1 - u;
      const x = a * a * a * p0[0] + 3 * a * a * u * p1[0] + 3 * a * u * u * p2[0] + u * u * u * p3[0];
      const y = a * a * a * p0[1] + 3 * a * a * u * p1[1] + 3 * a * u * u * p2[1] + u * u * u * p3[1];
      const w = u < 0.5 ? w0 + (wMid - w0) * (u / 0.5) : wMid + (w1 - wMid) * ((u - 0.5) / 0.5);
      g.beginPath(); g.arc(x * S, y * S, Math.max(0.6, w * S / 256), 0, Math.PI * 2); g.fill();
    }
  };
  const draw = () => {
    // nét quét dài chéo từ dưới trái vắt lên trên phải (nét chủ)
    brush([0.08, 0.78], [0.35, 0.62], [0.55, 0.35], [0.86, 0.08], 2, 9, 1.5);
    // vòng tròn bên trái (nét cuộn)
    brush([0.30, 0.55], [0.05, 0.55], [0.08, 0.92], [0.30, 0.84], 3, 7, 3);
    brush([0.30, 0.84], [0.48, 0.78], [0.45, 0.52], [0.30, 0.55], 3, 6, 2);
    // nét gãy zíc-zắc ngang giữa
    brush([0.36, 0.48], [0.48, 0.40], [0.52, 0.62], [0.64, 0.50], 2, 6, 2);
    brush([0.64, 0.50], [0.72, 0.42], [0.76, 0.60], [0.88, 0.52], 2, 5, 1);
    // nét móc dọc bên phải
    brush([0.74, 0.28], [0.70, 0.45], [0.76, 0.66], [0.66, 0.86], 1.5, 6, 1);
    // nét ngang ngắn trên cùng + đuôi vẩy
    brush([0.42, 0.22], [0.52, 0.16], [0.60, 0.24], [0.70, 0.18], 1, 5, 1);
    brush([0.55, 0.80], [0.66, 0.92], [0.80, 0.86], [0.94, 0.74], 1.5, 5, 0.8);
    // chấm
    for (const [x, y, r] of [[0.58, 0.70, 5], [0.86, 0.36, 4], [0.22, 0.30, 3.5]]) { g.beginPath(); g.arc(x * S, y * S, r * S / 256, 0, Math.PI * 2); g.fill(); }
  };
  // quầng sáng mờ rồi nét sáng rõ
  g.shadowColor = '#fff';
  g.shadowBlur = 14 * S / 256; g.globalAlpha = 0.55; draw();
  g.shadowBlur = 4 * S / 256; g.globalAlpha = 1; draw();
  g.restore();
}

// Texture chữ phù văn DÙNG CHUNG (kiếm nhỏ phù văn + cự kiếm): đổi 1 chỗ là đổi hết
// CHỮ HÁN viết dọc kiểu thư pháp (mặc định 天宇 — Thiên Vũ), phát sáng; font thư pháp tải từ Google Fonts,
// chưa tải xong / không có mạng thì dùng font Khải thư có sẵn trên máy.
function drawTextGlyph(cv, text, font) {
  const S = cv.width, g = cv.getContext('2d');
  const chars = [...(text || '').trim()].slice(0, 4);
  g.save();
  g.clearRect(0, 0, S, S);
  if (!chars.length) { g.restore(); return; }
  const n = chars.length, cell = S / n;
  const size = Math.min(cell * 0.95, S * 0.9);
  g.font = `${Math.round(size)}px "${font}", "Ma Shan Zheng", KaiTi, STKaiti, "Kaiti SC", "Noto Serif SC", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = g.strokeStyle = '#fff';
  g.lineJoin = 'round';
  const pass = (blur, alpha, stroke) => {
    g.shadowColor = '#fff'; g.shadowBlur = blur; g.globalAlpha = alpha; g.lineWidth = stroke;
    chars.forEach((c, i) => {
      const y = cell * (i + 0.5) + size * 0.04;
      if (stroke) g.strokeText(c, S / 2, y);
      g.fillText(c, S / 2, y);
    });
  };
  pass(S * 0.05, 0.5, S * 0.012); // quầng sáng
  pass(S * 0.012, 1, S * 0.006);  // nét rõ, hơi đậm
  g.restore();
}

function drawCurrentGlyph(cv) {
  const G = CONFIG.rune.glyph;
  if (G.mode === 'text' && G.font !== '__brush') drawTextGlyph(cv, G.text, G.font);
  else drawDefaultGlyph(cv);
}

let GLYPH = null;
export function makeGlyphTexture() {
  if (GLYPH) return GLYPH;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  GLYPH = new THREE.CanvasTexture(cv);
  GLYPH.colorSpace = THREE.SRGBColorSpace;
  GLYPH.anisotropy = 8;
  GLYPH.userData.canvas = cv;
  GLYPH.userData.source = 'default';
  refreshGlyph();
  return GLYPH;
}

// Vẽ lại chữ (khi đổi chữ / đổi font). Chờ font thư pháp tải xong rồi vẽ lại lần nữa cho đúng nét.
export function refreshGlyph() {
  const tex = makeGlyphTexture();
  if (tex.userData.source === 'image') return; // đang dùng ảnh chữ của người dùng
  drawCurrentGlyph(tex.userData.canvas);
  tex.needsUpdate = true;
  const G = CONFIG.rune.glyph;
  if (G.mode === 'text' && G.font !== '__brush' && document.fonts?.load) {
    document.fonts.load(`100px "${G.font}"`, G.text).then(() => {
      if (tex.userData.source === 'image') return;
      drawCurrentGlyph(tex.userData.canvas);
      tex.needsUpdate = true;
    }).catch(() => {});
  }
}

// Dùng ẢNH CHỮ người dùng chọn (vd. cắt từ phim): nền tối → trong suốt, nét sáng → trắng (nhuộm vàng bằng màu vật liệu).
// threshold: độ sáng (0..1) dưới mức này coi là nền
export function setGlyphImage(img, threshold = 0.35) {
  const tex = makeGlyphTexture(), cv = tex.userData.canvas, S = cv.width;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, S, S);
  const k = Math.min(S / img.width, S / img.height) * 0.94; // vừa khung, giữ tỉ lệ
  const w = img.width * k, h = img.height * k;
  g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  // nền: lấy độ sáng trung bình 4 góc làm mức nền
  const lum = (i) => (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3] / 255;
    const L = lum(i) * a;
    const v = Math.min(1, Math.max(0, (L - threshold) / Math.max(0.05, 1 - threshold)));
    p[i] = p[i + 1] = p[i + 2] = 255;
    p[i + 3] = Math.round(255 * Math.pow(v, 0.8));
  }
  g.putImageData(d, 0, 0);
  tex.userData.source = 'image';
  tex.needsUpdate = true;
}

export function resetGlyph() {
  const tex = makeGlyphTexture();
  tex.userData.source = 'default';
  refreshGlyph();
}

// Tấm phù văn dán sát 2 mặt lưỡi, ngay trên chỗ cán (1 chữ)
function makeGlyphGeometry() {
  const L = CONFIG.sword.length, W = CONFIG.sword.width;
  const size = W * CONFIG.rune.glyph.size, z = W * 0.5 * CONFIG.sword.shellFlat * 0.98;
  const yc = -L * 0.3 + W * 0.55 + size * 0.6; // ngay trên đĩa chắn tay + cổ kiếm
  const a = new THREE.PlaneGeometry(size, size);
  a.translate(0, yc, z);
  const b = new THREE.PlaneGeometry(size, size);
  b.rotateY(Math.PI);
  b.translate(0, yc, -z);
  const geo = new THREE.BufferGeometry();
  const merge = (k) => new THREE.Float32BufferAttribute([...a.attributes[k].array, ...b.attributes[k].array], a.attributes[k].itemSize);
  geo.setAttribute('position', merge('position'));
  geo.setAttribute('uv', merge('uv'));
  const n = a.attributes.position.count;
  geo.setIndex([...a.index.array, ...Array.from(b.index.array, (i) => i + n)]);
  return geo;
}

// ---------- Trung tâm trận ----------
// 6 gạch vàng đơn giản (hơi gãy như tia linh lực) từ tâm tới vòng tròn, mỗi gạch có 1 vạch ngang gần đầu
function makeCoreTexture(size = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const S = (size / 2) * 0.96;
  g.translate(size / 2, size / 2);
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.shadowColor = '#fff';
  g.shadowBlur = 10;
  let rnd = 3;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  // vòng tròn ngoài (đôi)
  g.lineWidth = 7; g.beginPath(); g.arc(0, 0, S * 0.97, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, S * 0.9, 0, TAU); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    // gạch chính: đường hơi gãy khúc từ gần tâm ra tới vòng
    g.lineWidth = 5;
    g.beginPath();
    for (let k = 0; k <= 14; k++) {
      const r = S * (0.08 + 0.86 * (k / 14));
      const off = k === 0 || k === 14 ? 0 : (rand() - 0.5) * S * 0.035;
      const x = ca * r + px * off, y = sa * r + py * off;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    // vạch ngang gần đầu gạch
    const rc = S * 0.72, half = S * 0.09;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(ca * rc + px * half, sa * rc + py * half);
    g.lineTo(ca * rc - px * half, sa * rc - py * half);
    g.stroke();
    // vài tia nhỏ toả ra từ gạch (như tia linh lực)
    g.lineWidth = 1.6;
    for (let k = 0; k < 5; k++) {
      const r = S * (0.2 + rand() * 0.7), side = rand() < 0.5 ? -1 : 1, len = S * (0.03 + rand() * 0.05);
      g.beginPath();
      g.moveTo(ca * r, sa * r);
      g.lineTo(ca * (r + len * 0.6) + px * side * len, sa * (r + len * 0.6) + py * side * len);
      g.stroke();
    }
  }
  // tâm sáng
  g.shadowBlur = 0;
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(-S * 0.16, -S * 0.16, S * 0.32, S * 0.32);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Dải linh lực: cung tròn mờ 2 đầu, sáng ở giữa (texture dọc theo chiều dài cung)
function makeWispTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 32;
  const g = cv.getContext('2d');
  const gx = g.createLinearGradient(0, 0, 256, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  gx.addColorStop(0.92, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, 256, 32);
  // mờ theo bề ngang dải
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 32);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.5, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy;
  g.fillRect(0, 0, 256, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cung tròn có UV chạy dọc chiều dài (u: 0 → 1 theo góc)
function arcGeometry(r, width, theta, seg = 40) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, a = u * theta;
    for (const [k, rr] of [[0, r - width / 2], [1, r + width / 2]]) {
      pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      uv.push(u, k);
    }
    if (i < seg) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _mw = new THREE.Matrix4();
const _ws = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class RuneDisc {
  // swords = { geo, mat, shellGeo, shellMat }: dùng lại hình + vật liệu phi kiếm cho các KIẾM NHỎ
  constructor(scene, swarm, swords) {
    this.swarm = swarm;
    this.swords = swords;
    this.group = new THREE.Group();
    this.minis = null;
    this.glyphGeo = makeGlyphGeometry();
    this.glyphMat = new THREE.MeshBasicMaterial({
      map: makeGlyphTexture(), color: new THREE.Color(...CONFIG.rune.glyph.color), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, // không lộ chữ ngược qua thân toneMapped: false, fog: false,
    });
    this.buildMinis();
    this._buildCore();
    scene.add(this.group);
    this.opacity = 0;
  }

  // ---------- Trung tâm trận ----------
  _buildCore() {
    const C = CONFIG.rune.core;
    const core = new THREE.Group();
    core.position.z = -0.03; // nằm ngay sau các kiếm nhỏ
    const add = (mat) => { mat.transparent = true; mat.blending = THREE.AdditiveBlending; mat.depthWrite = false; mat.toneMapped = false; mat.fog = false; mat.side = THREE.DoubleSide; return mat; };
    // 6 gạch + vòng tròn
    const spokes = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), add(new THREE.MeshBasicMaterial({ map: makeCoreTexture(), color: new THREE.Color(...C.color) })));
    spokes.renderOrder = 6;
    core.add(spokes);
    // tâm sáng
    const glow = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: softDotTexture(128, 0.3), color: new THREE.Color(...C.centerColor) })));
    glow.renderOrder = 7;
    core.add(glow);
    // linh lực: các cung dài ngắn, rộng hẹp, sáng tối, nhanh chậm KHÔNG ĐỀU nhau
    const wispTex = makeWispTexture();
    const wisps = [];
    for (let i = 0; i < C.wisps; i++) {
      const r = 0.12 + Math.random() * 0.78;
      const theta = 0.5 + Math.random() * 2.2;
      const mat = add(new THREE.MeshBasicMaterial({ map: wispTex, color: new THREE.Color(...(Math.random() < 0.55 ? C.wispColor : C.wispColor2)) }));
      const mesh = new THREE.Mesh(arcGeometry(r, 0.015 + Math.random() * 0.05, theta), mat);
      mesh.rotation.z = Math.random() * TAU;
      mesh.position.z = 0.002 * i;
      mesh.renderOrder = 6;
      core.add(mesh);
      wisps.push({
        mesh, base: 0.35 + Math.random() * 0.65,
        speed: (0.6 + Math.random() * 2.6) * (Math.random() < 0.8 ? 1 : -1) * (r < 0.4 ? 1.6 : 1), // vòng trong quay nhanh hơn
        flick: 1 + Math.random() * 4, ph: Math.random() * TAU,
      });
    }
    this.core = { group: core, spokes, glow, wisps };
    this.group.add(core);
  }

  // Các lớp KIẾM NHỎ (CONFIG.rune.minis): mỗi lớp là 1 vòng kiếm nhỏ chĩa ra ngoài, chuôi hướng tâm.
  // Dựng lại khi đổi số kiếm của 1 lớp.
  buildMinis() {
    if (this.minis) {
      this.group.remove(this.minis.core, this.minis.shell, this.minis.glyph);
      this.minis.core.geometry.dispose();
      this.minis.core.dispose(); this.minis.shell.dispose(); this.minis.glyph.dispose();
      for (const s of this.minis.swords) s.dead = true; // tắt sét đang bám vào kiếm nhỏ cũ
    }
    const layers = CONFIG.rune.minis;
    const total = layers.reduce((n, l) => n + l.count, 0);
    const { geo, mat, shellGeo, shellMat } = this.swords;
    // Vòng vàng quanh cán: bật/tắt theo từng lớp (thuộc tính aAccent của từng kiếm nhỏ)
    const accent = new Float32Array(Math.max(1, total));
    const cg = geo.clone();
    cg.setAttribute('aAccent', new THREE.InstancedBufferAttribute(accent, 1).setUsage(THREE.DynamicDrawUsage));
    const core = new THREE.InstancedMesh(cg, mat, Math.max(1, total));
    const shell = new THREE.InstancedMesh(shellGeo, shellMat, Math.max(1, total));
    const glyph = new THREE.InstancedMesh(this.glyphGeo, this.glyphMat, Math.max(1, total));
    shell.instanceMatrix = core.instanceMatrix; // dùng chung vị trí
    core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    glyph.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (const m of [core, shell, glyph]) { m.frustumCulled = false; m.count = total; this.group.add(m); }
    shell.renderOrder = 4;
    glyph.renderOrder = 5; // vẽ sau thân kiếm trong suốt → phù văn nổi trên lưỡi
    // Vị trí THẾ GIỚI của từng kiếm nhỏ (để sét trên lưỡi bám theo) — cập nhật mỗi khung hình
    const swords = Array.from({ length: total }, () => ({
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 0, hidden: true,
    }));
    this.minis = { core, shell, glyph, accent, angles: layers.map(() => 0), total, swords };
  }

  _updateMinis(dt, sm, fade) {
    const layers = CONFIG.rune.minis, M = this.minis, gs = CONFIG.rune.miniScale;
    let idx = 0;
    layers.forEach((l, li) => {
      M.angles[li] += l.spin * sm * dt; // các lớp xoay xen kẽ chiều nhau
      const shown = l.visible !== false;
      const s = l.scale * gs * fade * (shown ? 1 : 0); // lớp bị ẩn → thu về 0
      _s.set(s, s, s);
      for (let j = 0; j < l.count && idx < M.total; j++, idx++) {
        const a = M.angles[li] + ((j + (l.offset || 0)) / l.count) * TAU;
        _p.set(Math.cos(a) * l.r, Math.sin(a) * l.r, (l.z ?? 0) + 0.02 * li); // z: đẩy lớp tới trước (+) / lùi ra sau (−)
        _q.setFromAxisAngle(Z, a - Math.PI / 2); // trục kiếm (+Y) chĩa ra ngoài theo bán kính
        _m.compose(_p, _q, _s);
        M.core.setMatrixAt(idx, _m);
        M.accent[idx] = l.goldRings ? 1 : 0; // viền vàng quanh cán tròn (đĩa chắn) của lớp này
        M.glyph.setMatrixAt(idx, l.glyphs && shown ? _m : _zero); // phù văn vàng chỉ ở lớp có bật
        // toạ độ thế giới = ma trận nhóm phù văn × ma trận cục bộ của kiếm nhỏ
        const w = M.swords[idx];
        _mw.multiplyMatrices(this.group.matrixWorld, _m).decompose(w.pos, w.quat, _ws);
        w.scale = _ws.x;
        w.hidden = fade < 0.15 || !shown;
      }
    });
    M.core.instanceMatrix.needsUpdate = true;
    M.glyph.instanceMatrix.needsUpdate = true;
    M.core.geometry.attributes.aAccent.needsUpdate = true;
  }

  _updateCore(dt, t, sm) {
    const C = CONFIG.rune.core, K = this.core;
    K.group.visible = CONFIG.rune.showCore && this.opacity > 0.01;
    if (!K.group.visible) return;
    K.group.scale.setScalar(C.radius);
    const o = this.opacity * (CONFIG.palette.glowMul ?? 1); // trời sáng: giảm quầng sáng cộng dồn kẻo loá trắng
    K.spokes.rotation.z += C.spin * sm * dt;
    K.spokes.material.opacity = o * C.intensity;
    K.glow.scale.setScalar(C.centerSize * (1 + 0.15 * Math.sin(t * 3.3) + 0.08 * Math.sin(t * 7.1)));
    K.glow.material.opacity = Math.min(1, o * C.intensity * 1.2);
    for (const w of K.wisps) {
      w.mesh.rotation.z += w.speed * C.wispSpeed * sm * dt;
      // sáng tối thất thường: nhịp chậm × chớp nhanh
      const f = 0.55 + 0.45 * Math.sin(t * w.flick + w.ph);
      w.mesh.material.opacity = o * C.wispIntensity * w.base * f;
    }
  }

  update(dt, t) {
    const sw = this.swarm, Rn = CONFIG.rune;
    this.group.visible = Rn.enabled;
    if (!Rn.enabled) { for (const s of this.minis.swords) s.hidden = true; return; }
    const total = Rn.minis.reduce((n, l) => n + l.count, 0);
    if (total !== this.minis.total) this.buildMinis();
    if (this._glyphSize !== Rn.glyph.size) {
      this._glyphSize = Rn.glyph.size;
      this.glyphGeo.dispose();
      this.glyphGeo = this.minis.glyph.geometry = makeGlyphGeometry();
    }
    // Mặt phẳng trận đồ = mặt phẳng kiếm luân (kể cả khi xoay theo tay), đẩy ra phía trước 2 lớp kiếm
    this.group.quaternion.copy(sw.userQ).multiply(sw.haloQ);
    _n.copy(Z).applyQuaternion(this.group.quaternion);
    this.group.position.copy(sw.haloCenter).addScaledVector(_n, Rn.depth);
    this.group.scale.setScalar(Rn.radius * sw.radiusMul);
    const want = sw.isHalo() ? 1 : 0;
    this.opacity += (want - this.opacity) * (1 - Math.exp(-3 * dt));
    const sm = sw.speedMul * Rn.spinMul;
    this.group.updateMatrixWorld(true);
    // Kiếm nhỏ: hiện/ẩn mượt bằng cách thu phóng (không đổi được độ trong vì dùng chung vật liệu phi kiếm)
    this._updateMinis(dt, sm, Math.min(1, this.opacity));
    this.glyphMat.opacity = this.opacity * Rn.glyph.intensity;
    this.glyphMat.color.setRGB(...Rn.glyph.color);
    this._updateCore(dt, t, sm);
  }
}
