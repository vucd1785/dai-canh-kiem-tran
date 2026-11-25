// Tia lửa: hệ hạt nhỏ bắn ra khi kiếm đánh trúng mục tiêu / khi bùng sét
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { softDotTexture } from '../scene.js';

export class Sparks {
  constructor(scene) {
    const n = (this.n = CONFIG.sparks.max);
    this.pos = new Float32Array(n * 3).fill(0);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n).fill(1);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.14, map: softDotTexture(64), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this.cursor = 0;
    this._c = new THREE.Color();
  }

  spawn(p, count = 10, color = CONFIG.colors.spark, speed = 5) {
    const c = this._c.set(color);
    for (let j = 0; j < count; j++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const i3 = i * 3;
      this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
      // hướng ngẫu nhiên trên mặt cầu
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = speed * (0.3 + Math.random());
      this.vel[i3] = r * Math.cos(th) * sp; this.vel[i3 + 1] = u * sp; this.vel[i3 + 2] = r * Math.sin(th) * sp;
      const b = 1.5 + Math.random();
      this.base[i3] = c.r * b; this.base[i3 + 1] = c.g * b; this.base[i3 + 2] = c.b * b;
      this.life[i] = this.maxLife[i] = 0.4 + Math.random() * 0.5;
    }
  }

  update(dt) {
    const g = CONFIG.sparks.gravity, drag = Math.max(0, 1 - 1.5 * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
        this.pos[i3 + 1] = -9999;
        continue;
      }
      this.vel[i3 + 1] += g * dt;
      for (let a = 0; a < 3; a++) { this.vel[i3 + a] *= drag; this.pos[i3 + a] += this.vel[i3 + a] * dt; }
      const f = this.life[i] / this.maxLife[i];
      this.col[i3] = this.base[i3] * f; this.col[i3 + 1] = this.base[i3 + 1] * f; this.col[i3 + 2] = this.base[i3 + 2] * f;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
