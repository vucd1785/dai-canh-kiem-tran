// Vệt kiếm quét cả thanh, CHỈ hiện theo tốc độ chuyển động của kiếm:
// - Mỗi thanh nhớ N vị trí gần nhất của mũi và chuôi + tốc độ mũi kiếm tại mỗi thời điểm.
// - Độ sáng từng đoạn = (tốc độ lúc đó, qua ngưỡng minSpeed..fullSpeed) × (mờ dần theo tuổi).
//   → xoay chậm: không có vệt; xoay nhanh / phóng kiếm: vệt dài, sáng.
// - Mặt quét chia 2 dải (mũi→giữa, giữa→chuôi): mép mũi trắng vàng sáng nhất,
//   giữa vàng, chuôi ngọc gần như trong suốt → dạng vầng trăng khuyết mềm mại.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RibbonBatch } from './ribbon.js';

const AXIS = new THREE.Vector3();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Trails {
  constructor(scene, swarm) {
    this.swarm = swarm;
    this.n = CONFIG.trail.length;
    // 2 dải mỗi thanh: [mũi→giữa] và [giữa→chuôi]
    this.batch = new RibbonBatch(swarm.count * 2, this.n);
    this.batch.mesh.renderOrder = 1;
    scene.add(this.batch.mesh);
    const L = CONFIG.sword.length;
    this.offTip = 0.7 * L;
    this.offMid = 0.25 * L;
    this.offBase = -0.25 * L;
    const mk = () => swarm.swords.map(() => Array.from({ length: this.n }, () => new THREE.Vector3()));
    this.tips = mk(); this.mids = mk(); this.bases = mk();
    this.speeds = swarm.swords.map(() => new Float32Array(this.n));
    this.prevTip = swarm.swords.map(() => new THREE.Vector3());
    this.acc = 0;
    for (const s of swarm.swords) this._sample(s, 0, true);
    this.cTip = new THREE.Color(); this.cMid = new THREE.Color(); this.cBase = new THREE.Color();
  }

  dispose(scene) {
    scene.remove(this.batch.mesh);
    this.batch.mesh.geometry.dispose();
    this.batch.mesh.material.dispose();
  }

  // Lấy mẫu THEO THỜI GIAN (mỗi sampleInterval giây thêm 1 điểm) để độ dài vệt
  // không phụ thuộc FPS; điểm đầu luôn bám vị trí hiện tại cho mượt.
  _sample(s, dt, fill = false, shift = false) {
    const i = s.index;
    AXIS.set(0, 1, 0).applyQuaternion(s.quat);
    const T = this.tips[i], M = this.mids[i], B = this.bases[i], S = this.speeds[i];
    if (fill) {
      for (let k = 0; k < this.n; k++) {
        T[k].copy(s.pos).addScaledVector(AXIS, this.offTip * (s.scale ?? 1));
        M[k].copy(s.pos).addScaledVector(AXIS, this.offMid * (s.scale ?? 1));
        B[k].copy(s.pos).addScaledVector(AXIS, this.offBase * (s.scale ?? 1));
      }
      this.prevTip[i].copy(T[0]);
      return;
    }
    if (shift) {
      T.unshift(T.pop()); M.unshift(M.pop()); B.unshift(B.pop());
      S.copyWithin(1, 0);
    }
    T[0].copy(s.pos).addScaledVector(AXIS, this.offTip * (s.scale ?? 1));
    M[0].copy(s.pos).addScaledVector(AXIS, this.offMid * (s.scale ?? 1));
    B[0].copy(s.pos).addScaledVector(AXIS, this.offBase * (s.scale ?? 1));
    const speed = dt > 0 ? T[0].distanceTo(this.prevTip[i]) / dt : 0;
    this.prevTip[i].copy(T[0]);
    S[0] = shift ? speed : S[0] + (speed - S[0]) * 0.3; // làm mượt tốc độ
  }

  update(dt) {
    const Tc = CONFIG.trail;
    this.batch.mesh.visible = Tc.enabled;
    if (!Tc.enabled) return;
    this.cTip.set(Tc.tipColor); this.cMid.set(Tc.midColor); this.cBase.set(Tc.baseColor);
    const n = this.n, ct = this.cTip, cm = this.cMid, cb = this.cBase;
    // Nhiều kiếm → vệt cộng sáng chồng lên nhau rất nhiều → giảm theo số kiếm để không cháy trắng
    const crowd = Math.min(1, 72 / Math.max(1, this.swarm.count));
    const I = Tc.intensity * crowd;
    const maxLen = Tc.maxLength; // vệt dài tối đa (đơn vị thế giới) — kiếm bay nhanh không kéo vệt quá dài
    const dist = this._dist || (this._dist = new Float32Array(n));
    this.acc += dt;
    const shift = this.acc >= Tc.sampleInterval;
    if (shift) this.acc = Math.min(this.acc - Tc.sampleInterval, Tc.sampleInterval);
    for (const s of this.swarm.swords) {
      const i = s.index;
      this._sample(s, dt, false, shift);
      const S = this.speeds[i];
      // độ sáng đoạn k: theo tốc độ lúc đó × mờ dần theo tuổi (đầu mới nhất = 0 để mép mượt)
      const T = this.tips[i];
      dist[0] = 0;
      for (let k = 1; k < n; k++) dist[k] = dist[k - 1] + T[k].distanceTo(T[k - 1]);
      const hid = this.swarm.isHidden(s); // vòng đang ẩn → không vẽ vệt
      const fk = (k) => (k === 0 || hid ? 0
        : smooth(Tc.minSpeed, Tc.fullSpeed, S[k])
          * Math.pow(1 - k / (n - 1), 2)
          * Math.pow(Math.max(0, 1 - dist[k] / maxLen), 1.5) // mờ dần theo quãng đường
          * I);
      this.batch.writePairs(i * 2, this.tips[i], this.mids[i], n, (k, _n, oa, ob) => {
        const f = fk(k);
        oa[0] = ct.r * f; oa[1] = ct.g * f; oa[2] = ct.b * f;
        ob[0] = cm.r * f * 0.45; ob[1] = cm.g * f * 0.45; ob[2] = cm.b * f * 0.45;
      });
      this.batch.writePairs(i * 2 + 1, this.mids[i], this.bases[i], n, (k, _n, oa, ob) => {
        const f = fk(k);
        oa[0] = cm.r * f * 0.45; oa[1] = cm.g * f * 0.45; oa[2] = cm.b * f * 0.45;
        ob[0] = cb.r * f * 0.05; ob[1] = cb.g * f * 0.05; ob[2] = cb.b * f * 0.05;
      });
    }
    this.batch.commit();
  }
}
