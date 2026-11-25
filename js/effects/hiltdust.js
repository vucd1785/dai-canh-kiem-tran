// Chấm vàng li ti lấp lánh lượn quanh cán kiếm của từng thanh (bám theo kiếm)
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { softDotTexture } from '../scene.js';

const _v = new THREE.Vector3();

export class HiltDust {
  constructor(scene, swarm) {
    const H = CONFIG.sword.hiltDust, L = CONFIG.sword.length;
    this.swarm = swarm;
    this.K = H.perSword;
    const n = swarm.count * this.K;
    this.ang = new Float32Array(n); this.rad = new Float32Array(n); this.y = new Float32Array(n);
    this.spd = new Float32Array(n); this.tw = new Float32Array(n); this.ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.ang[i] = Math.random() * Math.PI * 2;
      this.rad[i] = H.radius[0] + Math.random() * (H.radius[1] - H.radius[0]);
      this.y[i] = L * (-0.25 + Math.random() * 0.85); // dọc LƯỠI kiếm: từ đĩa chắn tay (-0.25L) tới gần mũi (+0.6L)
      this.spd[i] = (0.5 + Math.random()) * H.spin * (Math.random() < 0.5 ? -1 : 1);
      this.tw[i] = 3 + Math.random() * 6;
      this.ph[i] = Math.random() * Math.PI * 2;
    }
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: H.size, map: softDotTexture(32, 0.5), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this.color = CONFIG.colors.hiltDust;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }

  update(t) {
    const H = CONFIG.sword.hiltDust;
    this.points.visible = H.enabled;
    if (!H.enabled) return;
    this.points.material.size = H.size;
    const K = this.K, c = this.color, dm = this.dim ?? 1;
    for (const s of this.swarm.swords) {
      const hid = this.swarm.isHidden(s) ? 0 : 1; // vòng đang ẩn → tắt chấm vàng
      for (let k = 0; k < K; k++) {
        const i = s.index * K + k, i3 = i * 3;
        const a = this.ang[i] + t * this.spd[i];
        _v.set(Math.cos(a) * this.rad[i], this.y[i], Math.sin(a) * this.rad[i]).multiplyScalar(s.scale ?? 1).applyQuaternion(s.quat).add(s.pos);
        this.pos[i3] = _v.x; this.pos[i3 + 1] = _v.y; this.pos[i3 + 2] = _v.z;
        const b = dm * hid * Math.pow(0.5 + 0.5 * Math.sin(t * this.tw[i] + this.ph[i]), 3); // lấp lánh
        this.col[i3] = c[0] * b; this.col[i3 + 1] = c[1] * b; this.col[i3 + 2] = c[2] * b;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
