// Tia sét giữa các thanh kiếm: đường gãy khúc tạo bằng chia đôi đoạn thẳng
// (midpoint displacement), nhấp nháy bằng cách tạo lại hình mỗi vài chục ms.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RibbonBatch } from './ribbon.js';

const _dir = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const UPV = new THREE.Vector3(0, 1, 0);
const XV = new THREE.Vector3(1, 0, 0);

export class Lightning {
  // opts.maxBolts / opts.segmentsPow: tạo bộ sét riêng (vd. sét nhỏ trên lưỡi: nhiều tia, ít đoạn)
  constructor(scene, opts = {}) {
    const L = CONFIG.lightning;
    const maxBolts = opts.maxBolts ?? L.maxBolts;
    this.n = (1 << (opts.segmentsPow ?? L.segmentsPow)) + 1;
    // opts.halo = false: bỏ lớp quầng mờ (tia cực mỏng không cần) → nhẹ máy gấp đôi
    this.halo = opts.halo === false ? null : new RibbonBatch(maxBolts, this.n);
    this.core = new RibbonBatch(maxBolts, this.n);
    this.core.mesh.renderOrder = 3;
    scene.add(this.core.mesh);
    if (this.halo) { this.halo.mesh.renderOrder = 2; scene.add(this.halo.mesh); }
    this.bolts = Array.from({ length: maxBolts }, () => ({
      active: false, visible: false, a: null, b: null, age: 0, life: 0, regenT: 0,
      d1: new Float32Array(this.n), d2: new Float32Array(this.n), flicker: 1, alt: false, width: 1,
      // sét bám trên 1 thanh kiếm: toạ độ cục bộ theo thanh kiếm
      sword: null, la: new THREE.Vector3(), lb: new THREE.Vector3(), wa: new THREE.Vector3(), wb: new THREE.Vector3(), jag: 1,
    }));
    this._arcAcc = 0;
    this.points = Array.from({ length: this.n }, () => new THREE.Vector3());
    this.gold = new THREE.Color(CONFIG.colors.boltCore);
    this.alt = new THREE.Color(CONFIG.colors.boltCoreAlt);
    this.haloColor = new THREE.Color(CONFIG.colors.boltHalo);
    this.activeCount = 0;
    this.rateMul = 1;
    this._rr = 0;
    this._acc = 0;
  }

  // a, b là Vector3 "sống" (tham chiếu vị trí kiếm) → tia sét bám theo kiếm
  // Lấy 1 tia rảnh (quét vòng tròn từ vị trí lần trước → nhanh kể cả khi có hàng trăm tia);
  // hết chỗ thì tái dùng tia cũ nhất theo vòng
  _take() {
    const B = this.bolts, N = B.length;
    for (let k = 0; k < N; k++) {
      const i = (this._rr + k) % N;
      if (!B[i].active) { this._rr = (i + 1) % N; return B[i]; }
    }
    const b = B[this._rr];
    this._rr = (this._rr + 1) % N;
    return b;
  }

  spawn(a, b, { width = 1, life } = {}) {
    const L = CONFIG.lightning;
    const bolt = this._take();
    bolt.active = true;
    bolt.sword = null; bolt.jag = 1;
    bolt.a = a; bolt.b = b; bolt.age = 0; bolt.width = width;
    bolt.life = life ?? L.life[0] + Math.random() * (L.life[1] - L.life[0]);
    bolt.alt = Math.random() < 0.3;
    this._regen(bolt);
  }

  // Tia sét MỎNG, DÀI chạy suốt lưỡi 1 thanh kiếm: từ mũi kiếm (from) xuống tới cán (to),
  // toạ độ tính theo thanh kiếm nên sét luôn bám theo kiếm khi kiếm bay/xoay.
  spawnOnSword(s) {
    const A = CONFIG.lightning.bladeArcs, Ls = CONFIG.sword.length, hw = CONFIG.sword.width * 0.5;
    const bolt = this._take();
    bolt.active = true;
    bolt.sword = s;
    const face = (Math.random() < 0.5 ? -1 : 1) * hw * 0.2;            // sát 1 trong 2 mặt lưỡi
    const tipX = (Math.random() * 2 - 1) * hw * 0.15;                  // mũi kiếm: gần sống lưỡi
    const hiltX = (Math.random() * 2 - 1) * hw * 0.8;                  // phía cán: toả ra 2 bên
    bolt.la.set(tipX, Ls * A.from, face);
    bolt.lb.set(hiltX, Ls * A.to, face);
    bolt.a = bolt.wa; bolt.b = bolt.wb;
    bolt.age = 0; bolt.width = A.width; bolt.jag = A.jag;
    bolt.life = A.life[0] + Math.random() * (A.life[1] - A.life[0]);
    bolt.alt = Math.random() < 0.5;
    this._regen(bolt);
  }

  burst(center, swarm, count = CONFIG.lightning.burstCount) {
    for (let i = 0; i < count; i++) {
      const s = swarm.randomSword(); // null nếu mọi vòng đều đang ẩn
      if (s) this.spawn(center, s.pos, { width: 1.4, life: 0.25 + Math.random() * 0.25 });
    }
  }

  // Sinh sét theo tần suất của trạng thái hiện tại
  autoSpawn(dt, swarm) {
    this._acc += (CONFIG.lightning.rate[swarm.state] ?? 6) * this.rateMul * dt;
    while (this._acc >= 1) {
      this._acc -= 1;
      const pair = swarm.randomPair();
      if (pair) this.spawn(pair[0], pair[1]);
    }
  }

  // Giữ trung bình A.active tia cùng lúc trên MỖI thanh kiếm đang hiện:
  // tần suất sinh = số tia cần giữ ÷ tuổi thọ trung bình 1 tia.
  // Chia LẦN LƯỢT cho từng thanh (vòng tròn qua danh sách) để thanh nào cũng đều có sét.
  autoSpawnBlade(dt, swarm) {
    const A = CONFIG.lightning.bladeArcs;
    if (!A.enabled) { this._arcAcc = 0; return; }
    let shown = 0;
    for (const r of CONFIG.rings) if (r.visible !== false) shown += r.count;
    const avgLife = (A.life[0] + A.life[1]) / 2;
    const rate = (A.active * shown * this.rateMul) / avgLife;
    this._arcAcc = Math.min(this._arcAcc + rate * dt, this.bolts.length);
    const list = swarm.swords, N = list.length;
    this._cursor = (this._cursor || 0) % Math.max(1, N);
    while (this._arcAcc >= 1 && N) {
      this._arcAcc -= 1;
      for (let k = 0; k < N; k++) {               // lấy thanh kế tiếp đang hiện
        const s = list[this._cursor];
        this._cursor = (this._cursor + 1) % N;
        if (!swarm.isHidden(s)) { this.spawnOnSword(s); break; }
      }
    }
  }

  _regen(bolt) {
    const n = this.n, jag = CONFIG.lightning.jag * bolt.jag;
    for (const d of [bolt.d1, bolt.d2]) {
      d[0] = 0; d[n - 1] = 0;
      let amp = jag;
      for (let size = n - 1; size > 1; size >>= 1) {
        const half = size >> 1;
        for (let i = 0; i < n - 1; i += size) d[i + half] = (d[i] + d[i + size]) * 0.5 + (Math.random() * 2 - 1) * amp;
        amp *= 0.55;
      }
    }
    bolt.flicker = 0.6 + Math.random() * 0.6;
    bolt.regenT = 0;
  }

  update(dt, camera) {
    const L = CONFIG.lightning, n = this.n, pts = this.points, cam = camera.position;
    let count = 0;
    for (let i = 0; i < this.bolts.length; i++) {
      const bolt = this.bolts[i];
      if (bolt.active) {
        bolt.age += dt;
        if (bolt.age >= bolt.life) bolt.active = false;
      }
      if (!bolt.active) {
        if (bolt.visible) { this.core.hideStrip(i); this.halo?.hideStrip(i); bolt.visible = false; }
        continue;
      }
      bolt.regenT += dt;
      if (bolt.regenT >= L.regen) this._regen(bolt);
      if (bolt.sword) {
        const s = bolt.sword;
        bolt.wa.copy(bolt.la).applyQuaternion(s.quat).add(s.pos);
        bolt.wb.copy(bolt.lb).applyQuaternion(s.quat).add(s.pos);
      }

      _dir.subVectors(bolt.b, bolt.a);
      const len = _dir.length();
      if (len < 1e-3) continue;
      _dir.divideScalar(len);
      _u.crossVectors(_dir, Math.abs(_dir.y) < 0.95 ? UPV : XV).normalize();
      _w.crossVectors(_dir, _u);
      for (let k = 0; k < n; k++) {
        pts[k].copy(bolt.a)
          .addScaledVector(_dir, (len * k) / (n - 1))
          .addScaledVector(_u, bolt.d1[k] * len)
          .addScaledVector(_w, bolt.d2[k] * len);
      }
      const fade = 1 - Math.pow(bolt.age / bolt.life, 2);
      const br = fade * bolt.flicker;
      const core = bolt.alt ? this.alt : this.gold, halo = this.haloColor, wm = bolt.width;
      if (this.halo) this.halo.writeStrip(i, pts, n,
        () => L.haloWidth * wm,
        (_k, _n, out) => { out[0] = halo.r * br * 0.6; out[1] = halo.g * br * 0.6; out[2] = halo.b * br * 0.6; },
        cam);
      this.core.writeStrip(i, pts, n,
        (k) => L.coreWidth * wm * (0.5 + 0.5 * Math.sin((Math.PI * k) / (n - 1))),
        (_k, _n, out) => { out[0] = core.r * br * 1.5; out[1] = core.g * br * 1.5; out[2] = core.b * br * 1.5; /* không quá sáng để giữ màu vàng */ },
        cam);
      bolt.visible = true;
      count++;
    }
    this.activeCount = count;
    this.core.commit();
    this.halo?.commit();
  }
}
