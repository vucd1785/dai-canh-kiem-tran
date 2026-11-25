// Sét CỰC MỎNG chạy dọc lưỡi từng thanh kiếm: từ mũi kiếm xuống tới cán, vài tia cùng lúc mỗi thanh.
// Vẽ bằng đường kẻ 1 điểm ảnh (LineSegments) → mỏng nhất có thể và rất nhẹ máy.
// Dùng chung cho nhiều nhóm kiếm, mỗi nhóm có cấu hình riêng:
//   new BladeArcs(scene, { getCfg: () => CONFIG.lightning.bladeArcs, isHidden: (s) => ... })
// "Kiếm" là bất kỳ object nào có { pos: Vector3, quat: Quaternion, scale?: số } (vị trí thế giới).
// Đặt s.dead = true để mọi tia đang bám vào thanh đó tắt ngay (vd. khi dựng lại phù văn).
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const SEG = 8;            // số đoạn gãy mỗi tia
const NP = SEG + 1;       // số điểm mỗi tia
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class BladeArcs {
  constructor(scene, { getCfg = () => CONFIG.lightning.bladeArcs, isHidden = () => false } = {}) {
    this.getCfg = getCfg;
    this.isHidden = isHidden;
    const A = getCfg();
    const max = (this.max = A.maxBolts);
    this.active = new Uint8Array(max);
    this.sword = new Array(max).fill(null);
    this.la = new Float32Array(max * 3);   // điểm đầu (toạ độ theo thanh kiếm)
    this.lb = new Float32Array(max * 3);   // điểm cuối
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.regenT = new Float32Array(max);
    this.flick = new Float32Array(max);
    this.alt = new Uint8Array(max);
    this.jagK = new Float32Array(max).fill(1); // hệ số gãy khúc riêng từng tia
    this.d1 = new Float32Array(max * NP);  // độ lệch gãy khúc theo 2 hướng vuông góc
    this.d2 = new Float32Array(max * NP);
    this.wasVisible = new Uint8Array(max);

    const vcount = max * SEG * 2;
    this.pos = new Float32Array(vcount * 3);
    this.col = new Float32Array(vcount * 3);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, fog: false,
    }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;
    scene.add(this.lines);

    // màu tia: lấy theo cấu hình riêng nếu có (vd. sét lõi cự kiếm màu xanh lam ngọc), không thì vàng
    this.gold = new THREE.Color(A.color ?? CONFIG.colors.boltCore);
    this.pale = new THREE.Color(A.colorAlt ?? CONFIG.colors.boltCoreAlt);
    this.rateMul = 1;
    this.dim = 1; // giảm sáng khi kiếm dồn đặc (cầu gai)
    this._acc = 0;
    this._cursor = 0;
    this._free = 0;
    this.activeCount = 0;
  }

  reset() { this.active.fill(0); }

  _take() {
    const N = this.max;
    for (let k = 0; k < N; k++) {
      const i = (this._free + k) % N;
      if (!this.active[i]) { this._free = (i + 1) % N; return i; }
    }
    const i = this._free; this._free = (i + 1) % N; return i;
  }

  _regen(i) {
    const A = this.getCfg();
    const amp0 = CONFIG.lightning.jag * A.jag * this.jagK[i];
    for (const d of [this.d1, this.d2]) {
      const o = i * NP;
      d[o] = 0; d[o + SEG] = 0;
      let amp = amp0;
      for (let size = SEG; size > 1; size >>= 1) {
        const half = size >> 1;
        for (let k = 0; k < SEG; k += size) d[o + k + half] = (d[o + k] + d[o + k + size]) * 0.5 + (Math.random() * 2 - 1) * amp;
        amp *= 0.55;
      }
    }
    this.flick[i] = 0.6 + Math.random() * 0.6;
    this.regenT[i] = 0;
  }

  // 1 tia từ điểm a tới điểm b (toạ độ theo thanh kiếm)
  _bolt(s, ax, ay, az, bx, by, bz, life, jag) {
    const i = this._take();
    this.la[i * 3] = ax; this.la[i * 3 + 1] = ay; this.la[i * 3 + 2] = az;
    this.lb[i * 3] = bx; this.lb[i * 3 + 1] = by; this.lb[i * 3 + 2] = bz;
    this.sword[i] = s;
    this.active[i] = 1;
    this.age[i] = 0;
    this.life[i] = life;
    this.jagK[i] = jag;
    this.alt[i] = Math.random() < 0.45 ? 1 : 0;
    this._regen(i);
    return 1;
  }

  // Trả về số tia đã tạo
  _spawn(s) {
    const A = this.getCfg(), L = CONFIG.sword.length, hw = CONFIG.sword.width * 0.5;
    const life = A.life[0] + Math.random() * (A.life[1] - A.life[0]);
    const face = (Math.random() < 0.5 ? -1 : 1) * hw * 0.2;   // sát 1 trong 2 mặt lưỡi
    if (A.style === 'core') {
      // Kiểu LÕI: tia NGẮN chạy dọc bên trong lõi kiếm, chỗ nào cũng có thể loé lên
      const y0 = L * (A.to + Math.random() * (A.from - A.to));
      const len = L * (A.len[0] + Math.random() * (A.len[1] - A.len[0])) * (Math.random() < 0.5 ? -1 : 1);
      const rc = hw * 0.25;
      return this._bolt(s, (Math.random() - 0.5) * rc, y0, (Math.random() - 0.5) * rc * 0.5,
        (Math.random() - 0.5) * rc, y0 + len, (Math.random() - 0.5) * rc * 0.5, life, A.crackleJag ?? 1);
    }
    if (A.style !== 'crackle') {
      // Kiểu cũ: tia dài chạy dọc lưỡi từ mũi xuống cán
      return this._bolt(s, (Math.random() * 2 - 1) * hw * 0.15, L * A.from, face,
        (Math.random() * 2 - 1) * hw * 0.8, L * A.to, face, life, 1);
    }
    // Kiểu PHIM: tia NGẮN, gãy khúc mạnh, CÓ NHÁNH, loé ra 2 bên lưỡi tại 1 điểm ngẫu nhiên
    const side = Math.random() < 0.5 ? -1 : 1;
    const oy = L * (-0.22 + Math.random() * 0.88);                  // điểm phát: từ cán tới gần mũi
    const ox = side * hw * (0.3 + Math.random() * 0.7);
    const len = L * (A.len[0] + Math.random() * (A.len[1] - A.len[0]));
    // hướng: chủ yếu toả ngang ra ngoài mép, lệch lên/xuống dọc lưỡi
    let dx = side * (0.5 + Math.random() * 0.8), dy = (Math.random() - 0.5) * 1.6, dz = (Math.random() - 0.5) * 0.9;
    const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    const ex = ox + dx * len, ey = oy + dy * len, ez = face + dz * len;
    let n = this._bolt(s, ox, oy, face, ex, ey, ez, life, A.crackleJag);
    // 1–2 nhánh mọc ra từ giữa tia chính
    const nb = Math.random() < A.branch ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0;
    for (let k = 0; k < nb; k++) {
      const f = 0.3 + Math.random() * 0.4;
      const bx0 = ox + dx * len * f, by0 = oy + dy * len * f, bz0 = face + dz * len * f;
      const bl = len * (0.35 + Math.random() * 0.4);
      let ux = dx + (Math.random() - 0.5) * 1.6, uy = dy + (Math.random() - 0.5) * 1.6, uz = dz + (Math.random() - 0.5) * 1.2;
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      n += this._bolt(s, bx0, by0, bz0, bx0 + ux * bl, by0 + uy * bl, bz0 + uz * bl, life * (0.6 + Math.random() * 0.4), A.crackleJag);
    }
    return n;
  }

  // Giữ trung bình A.active tia cùng lúc trên MỖI thanh đang hiện trong danh sách `list`;
  // chia lần lượt cho từng thanh (vòng tròn qua danh sách) để thanh nào cũng đều có sét.
  autoSpawn(dt, list) {
    const A = this.getCfg();
    if (!A.enabled || !list || !list.length) { this._acc = 0; return; }
    let shown = 0;
    for (const s of list) if (!this.isHidden(s)) shown++;
    if (!shown) { this._acc = 0; return; }
    const perSpawn = A.style === 'crackle' ? 1 + A.branch * 1.4 : 1; // mỗi lần sinh có thể kèm nhánh
    const rate = (A.active * shown * this.rateMul) / ((A.life[0] + A.life[1]) / 2) / perSpawn;
    this._acc = Math.min(this._acc + rate * dt, this.max);
    const N = list.length;
    this._cursor %= N;
    while (this._acc >= 1) {
      this._acc -= 1;
      for (let k = 0; k < N; k++) {
        const s = list[this._cursor];
        this._cursor = (this._cursor + 1) % N;
        if (!this.isHidden(s)) { this._spawn(s); break; }
      }
    }
  }

  update(dt) {
    const A = this.getCfg(), regen = CONFIG.lightning.regen;
    const P = this.pos, C = this.col, I = A.intensity * this.dim;
    let count = 0;
    for (let i = 0; i < this.max; i++) {
      const vo = i * SEG * 6; // 6 số (2 đỉnh × xyz) mỗi đoạn
      if (this.active[i]) {
        this.age[i] += dt;
        const s = this.sword[i];
        if (this.age[i] >= this.life[i] || !s || s.dead || this.isHidden(s)) this.active[i] = 0;
      }
      if (!this.active[i]) {
        if (this.wasVisible[i]) { C.fill(0, vo, vo + SEG * 6); this.wasVisible[i] = 0; }
        continue;
      }
      this.regenT[i] += dt;
      if (this.regenT[i] >= regen) this._regen(i);
      const s = this.sword[i];
      const sc = s.scale ?? 1; // kiếm nhỏ (phù văn) → tia thu nhỏ theo
      _a.fromArray(this.la, i * 3).multiplyScalar(sc).applyQuaternion(s.quat).add(s.pos);
      _b.fromArray(this.lb, i * 3).multiplyScalar(sc).applyQuaternion(s.quat).add(s.pos);
      let dx = _b.x - _a.x, dy = _b.y - _a.y, dz = _b.z - _a.z;
      const len = Math.hypot(dx, dy, dz) || 1e-6;
      dx /= len; dy /= len; dz /= len;
      // 2 hướng vuông góc với tia (u, w) để làm gãy khúc
      let ux, uy, uz;
      if (Math.abs(dy) < 0.95) { ux = -dz; uy = 0; uz = dx; } else { ux = 0; uy = dz; uz = -dy; } // dir × (0,1,0) hoặc × (1,0,0)
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const wx = dy * uz - dz * uy, wy = dz * ux - dx * uz, wz = dx * uy - dy * ux;
      const t = this.age[i] / this.life[i];
      const br = (1 - t * t) * this.flick[i] * I;
      const c = this.alt[i] ? this.pale : this.gold;
      const cr = c.r * br, cg = c.g * br, cb = c.b * br;
      const o = i * NP;
      let px = _a.x, py = _a.y, pz = _a.z;
      for (let k = 1; k <= SEG; k++) {
        const f = (len * k) / SEG, e1 = this.d1[o + k] * len, e2 = this.d2[o + k] * len;
        const qx = _a.x + dx * f + ux * e1 + wx * e2;
        const qy = _a.y + dy * f + uy * e1 + wy * e2;
        const qz = _a.z + dz * f + uz * e1 + wz * e2;
        const v = vo + (k - 1) * 6;
        P[v] = px; P[v + 1] = py; P[v + 2] = pz; P[v + 3] = qx; P[v + 4] = qy; P[v + 5] = qz;
        C[v] = C[v + 3] = cr; C[v + 1] = C[v + 4] = cg; C[v + 2] = C[v + 5] = cb;
        px = qx; py = qy; pz = qz;
      }
      this.wasVisible[i] = 1;
      count++;
    }
    this.activeCount = count;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.lines.visible = A.enabled || count > 0;
  }
}
