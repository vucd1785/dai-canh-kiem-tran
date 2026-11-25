// CẢNH VẬT 3D VÔ TẬN bên dưới nhân vật đang bay:
//  - Địa hình núi non (sóng núi nhiều tầng), thung lũng ở giữa có sông uốn lượn,
//    cỏ xanh ở thấp, đá ở sườn dốc / cao, tuyết trên đỉnh.
//  - Rừng cây lá kim (thông) mọc trên cỏ, tránh sông, sườn quá dốc và vùng tuyết.
//  - Mặt sông / hồ phản ánh trời.
//  - Biển mây trôi quanh chân núi + mây cao.
// Cảnh trôi theo hướng bay; khi camera đi xa (phi kiếm, zoom xa…) cảnh tự dựng thêm quanh camera → không bao giờ hết.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

// ---------- Nhiễu (value noise) ----------
function hash(x, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 5) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
function ridged(x, z, oct = 5) {
  let s = 0, a = 0.5, f = 1, n = 0, w = 1;
  for (let i = 0; i < oct; i++) {
    let r = 1 - Math.abs(noise(x * f, z * f) * 2 - 1);
    r = r * r * w; w = Math.min(1, r * 1.6);
    s += a * r; n += a; a *= 0.5; f *= 2.1;
  }
  return s / n;
}

// Độ cao địa hình tại toạ độ "khung bay" (u = x - quãng đường đã bay, z)
export function terrainHeight(u, z) {
  const T = CONFIG.scene.terrain;
  const riverZ = T.riverMeander * Math.sin(u * 0.008) + 10 * Math.sin(u * 0.023 + 1.3);
  const dz = Math.abs(z - riverZ);
  const valley = THREE.MathUtils.smoothstep(Math.abs(z), T.valleyHalf, T.valleyHalf + 220);
  const base = fbm(u * 0.006, z * 0.006, 4);
  const mount = Math.pow(ridged(u * 0.0042 + 11.3, z * 0.0042 - 7.1, 5), 1.5);
  let h = T.groundY + base * 9 + valley * (T.mountainHeight * mount + 18 * base);
  // đồi cỏ thoai thoải (thảo nguyên)
  h += (T.rolling ?? 0) * (fbm(u * 0.011 + 3.7, z * 0.011 - 1.9, 3) - 0.45) * 2 * (1 - valley * 0.6);
  // sông: lòng sông thấp xuống
  const river = 1 - THREE.MathUtils.smoothstep(dz, T.riverWidth * 0.5, T.riverWidth * 1.6);
  h -= river * 6 * (1 - valley);
  return { h, river: river * (1 - valley) };
}

// ---------- Hình cây thông thấp đa giác ----------
function treeGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5);
  trunk.translate(0, 0.8, 0);
  parts.push(paint(trunk, 0x3a2a1e));
  for (let i = 0; i < 3; i++) {
    const c = new THREE.ConeGeometry(1.5 - i * 0.38, 2.4, 7);
    c.translate(0, 2.1 + i * 1.25, 0);
    parts.push(paint(c, i === 2 ? 0x3a8a58 : 0x2a6a46));
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  g.computeVertexNormals();
  return g;
}
function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  return geo;
}

// Mây bông xốp (canvas): nhiều đốm mềm chồng lên nhau
function cloudTexture(seed) {
  const S = 256, cv = document.createElement('canvas');
  cv.width = S; cv.height = S / 2;
  const g = cv.getContext('2d');
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = S * (0.15 + rnd() * 0.7), y = S / 2 * (0.35 + rnd() * 0.4), rad = S * (0.06 + rnd() * 0.13);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S / 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Terrain {
  constructor(scene, palette) {
    const T = CONFIG.scene.terrain, P = palette;
    this.scroll = 0;
    this.group = new THREE.Group();
    scene.add(this.group);

    // --- Mặt đất ---
    const N = T.grid, size = T.size;
    const geo = new THREE.PlaneGeometry(size, size, N, N);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    this.base = geo.attributes.position.array.slice(); // toạ độ lưới gốc (x, z)
    this.ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(this.ground);
    this.col = {
      grass: new THREE.Color(P.grass ?? 0x2f5a3a), grass2: new THREE.Color(P.grass2 ?? 0x4a7a45),
      rock: new THREE.Color(P.rock ?? 0x4a4a5c), snow: new THREE.Color(P.snow ?? 0xdfe6f5),
      bank: new THREE.Color(P.bank ?? 0x5a5040),
    };

    // --- Mặt nước (sông / hồ) ---
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshPhongMaterial({
      color: P.water ?? 0x1c3a5a, emissive: P.waterGlow ?? 0x0a1830, shininess: 90, specular: 0x8899cc, transparent: true, opacity: 0.85,
    }));
    this.water.rotation.x = -Math.PI / 2;
    this.group.add(this.water);

    // --- Rừng cây ---
    this.trees = new THREE.InstancedMesh(treeGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), T.treeCount);
    this.trees.frustumCulled = false;
    this.group.add(this.trees);

    // --- Biển mây quanh chân núi + mây cao ---
    const texs = [1, 7, 13, 29].map(cloudTexture);
    this.clouds = [];
    for (let i = 0; i < T.cloudCount; i++) {
      const high = i % 4 === 0;
      const m = new THREE.SpriteMaterial({ map: texs[i % texs.length], color: P.clouds[i % P.clouds.length], transparent: true, opacity: (high ? 0.5 : 0.75) * (P.cloudOpacity / 0.18) * 0.35, depthWrite: false, fog: true });
      const s = new THREE.Sprite(m);
      const w = high ? 60 + Math.random() * 80 : 80 + Math.random() * 120;
      s.scale.set(w, w * 0.35, 1);
      this.clouds.push({ s, high, u: (Math.random() - 0.5) * size, z: (Math.random() - 0.5) * size, y: high ? 38 + Math.random() * 40 : T.groundY + 6 + Math.random() * 12, baseOp: m.opacity, spd: 0.6 + Math.random() * 0.8 });
      scene.add(s);
    }
    this.anchor = new THREE.Vector2(1e9, 1e9);
    this.genScroll = 0;
  }

  // Dựng lại độ cao + cây quanh tâm (cx, cz) — gọi khi camera đi xa hoặc cảnh đã trôi một đoạn
  _rebuild(cx, cz) {
    const T = CONFIG.scene.terrain;
    this.anchor.set(cx, cz);
    this.genScroll = this.scroll;
    this.group.position.set(cx, 0, cz);
    const pos = this.ground.geometry.attributes.position, col = this.ground.geometry.attributes.color;
    const A = pos.array, C = col.array, B = this.base, cl = this.col, tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = B[i * 3] + cx, z = B[i * 3 + 2] + cz;
      const { h, river } = terrainHeight(x - this.scroll, z);
      A[i * 3 + 1] = h;
      // màu theo độ cao: cỏ → đá → tuyết; bờ sông nâu
      const rel = h - T.groundY;
      const g = fbm((x - this.scroll) * 0.03, z * 0.03, 2);
      tmp.copy(cl.grass).lerp(cl.grass2, g);
      if (river > 0.05) tmp.lerp(cl.bank, Math.min(1, river * 1.5));
      tmp.lerp(cl.rock, THREE.MathUtils.smoothstep(rel, T.rockLine - 10, T.rockLine + 12));
      tmp.lerp(cl.snow, THREE.MathUtils.smoothstep(rel, T.snowLine - 6, T.snowLine + 8));
      C[i * 3] = tmp.r; C[i * 3 + 1] = tmp.g; C[i * 3 + 2] = tmp.b;
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.ground.geometry.computeVertexNormals();
    this.ground.geometry.computeBoundingSphere();
    this.water.position.y = T.groundY + T.waterLevel;

    // cây: rải theo ô lưới cố định trong khung bay (ổn định, không nhảy chỗ khi dựng lại)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const cell = T.treeCell, half = T.size * 0.45, U0 = cx - this.scroll;
    let n = 0;
    for (let gu = Math.floor((U0 - half) / cell); gu <= Math.floor((U0 + half) / cell) && n < T.treeCount; gu++) {
      for (let gz = Math.floor((cz - half) / cell); gz <= Math.floor((cz + half) / cell) && n < T.treeCount; gz++) {
        if (hash(gu * 7 + 3, gz * 13 + 5) > T.treeDensity) continue;
        const u = (gu + hash(gu, gz * 3)) * cell, z = (gz + hash(gu * 5, gz)) * cell;
        const { h, river } = terrainHeight(u, z);
        const rel = h - T.groundY;
        if (river > 0.05 || rel > T.rockLine - 6 || h < T.groundY + T.waterLevel + 0.5) continue;
        const sc = 0.9 + hash(gu * 11, gz * 17) * 1.1;
        p.set(u + this.scroll - cx, h - 0.3, z - cz);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(gu, gz) * 6.28);
        s.set(sc, sc * (0.9 + hash(gz, gu) * 0.5), sc);
        this.trees.setMatrixAt(n++, m.compose(p, q, s));
      }
    }
    this.trees.count = n;
    this.trees.instanceMatrix.needsUpdate = true;
  }

  update(dt, camera, flightSpeed) {
    const T = CONFIG.scene.terrain;
    this.group.visible = T.enabled;
    for (const c of this.clouds) c.s.visible = T.enabled;
    if (!T.enabled) return;
    this.scroll += flightSpeed * T.speed * dt;
    // cảnh đã trôi / camera đã đi xa quá 1 đoạn → dựng lại quanh camera
    const cx = camera.position.x, cz = camera.position.z;
    const drift = this.scroll - this.genScroll;
    if (Math.abs(cx - this.anchor.x) > T.regen || Math.abs(cz - this.anchor.y) > T.regen || drift > T.regen) {
      this._rebuild(Math.round(cx / 8) * 8, Math.round(cz / 8) * 8);
    }
    this.group.position.x = this.anchor.x + (this.scroll - this.genScroll);
    // mây trôi theo hướng bay, luôn quanh camera
    const half = T.size * 0.5;
    for (const c of this.clouds) {
      c.u += flightSpeed * T.speed * c.spd * dt;
      let x = c.u - cx;
      x = ((x + half) % (2 * half) + 2 * half) % (2 * half) - half;
      let z = c.z - cz;
      z = ((z + half) % (2 * half) + 2 * half) % (2 * half) - half;
      // mây thấp nằm dưới chân, mây cao trên đầu — luôn tính theo độ cao camera để không bao giờ trùm tầm nhìn
      const y = c.high ? Math.max(c.y, camera.position.y + 26) : Math.min(c.y, camera.position.y - 34);
      c.s.position.set(cx + x, y, cz + z);
      // ở quá gần camera thì mờ dần (không bị lọt vào giữa đám mây)
      const d = Math.hypot(x, y - camera.position.y, z);
      c.s.material.opacity = c.baseOp * THREE.MathUtils.smoothstep(d, 60, 150) * (c.high ? 1 : 0.7);
    }
  }
}
