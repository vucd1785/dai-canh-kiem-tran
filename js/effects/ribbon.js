// Dải băng luôn quay mặt về camera (dùng cho vệt kiếm và tia sét).
// Nhiều dải gộp chung 1 mesh → 1 lần vẽ.
import * as THREE from 'three';

const _t = new THREE.Vector3();
const _view = new THREE.Vector3();
const _side = new THREE.Vector3();
const _prev = new THREE.Vector3();

export class RibbonBatch {
  constructor(strips, pps) {
    this.strips = strips;
    this.pps = pps; // số điểm mỗi dải
    const vcount = strips * pps * 2;
    this.positions = new Float32Array(vcount * 3);
    this.colors = new Float32Array(vcount * 3);
    const index = [];
    for (let s = 0; s < strips; s++) {
      for (let k = 0; k < pps - 1; k++) {
        const a = (s * pps + k) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
      })
    );
    this.mesh.frustumCulled = false;
    this._out = [0, 0, 0];
  }

  // widthFn(k, n) → độ rộng; colorFn(k, n, out) ghi màu vào out[0..2]
  writeStrip(s, pts, n, widthFn, colorFn, camPos) {
    const P = this.positions, C = this.colors, pps = this.pps, out = this._out;
    _prev.set(0, 1, 0);
    for (let k = 0; k < pps; k++) {
      const kk = Math.min(k, n - 1);
      const p = pts[kk];
      const vi = (s * pps + k) * 6;
      if (k >= n) {
        P[vi] = P[vi + 3] = p.x; P[vi + 1] = P[vi + 4] = p.y; P[vi + 2] = P[vi + 5] = p.z;
        C.fill(0, vi, vi + 6);
        continue;
      }
      _t.subVectors(pts[Math.min(kk + 1, n - 1)], pts[Math.max(kk - 1, 0)]);
      _view.subVectors(camPos, p);
      _side.crossVectors(_t, _view);
      const l = _side.length();
      if (l < 1e-6) _side.copy(_prev);
      else { _side.divideScalar(l); _prev.copy(_side); }
      const w = widthFn(k, n) * 0.5;
      P[vi] = p.x + _side.x * w; P[vi + 1] = p.y + _side.y * w; P[vi + 2] = p.z + _side.z * w;
      P[vi + 3] = p.x - _side.x * w; P[vi + 4] = p.y - _side.y * w; P[vi + 5] = p.z - _side.z * w;
      colorFn(k, n, out);
      C[vi] = C[vi + 3] = out[0]; C[vi + 1] = C[vi + 4] = out[1]; C[vi + 2] = C[vi + 5] = out[2];
    }
  }

  // Dải giữa 2 đường: A[k] (vd. mũi kiếm) và B[k] (vd. chuôi kiếm) theo thời gian
  // → mặt quét của cả thanh kiếm. colorFn(k, n, outA, outB) ghi màu 2 mép.
  writePairs(s, A, B, n, colorFn) {
    const P = this.positions, C = this.colors, outA = this._out, outB = this._outB || (this._outB = [0, 0, 0]);
    for (let k = 0; k < this.pps; k++) {
      const kk = Math.min(k, n - 1);
      const a = A[kk], b = B[kk];
      const vi = (s * this.pps + k) * 6;
      P[vi] = a.x; P[vi + 1] = a.y; P[vi + 2] = a.z;
      P[vi + 3] = b.x; P[vi + 4] = b.y; P[vi + 5] = b.z;
      if (k >= n) { C.fill(0, vi, vi + 6); continue; }
      colorFn(k, n, outA, outB);
      C[vi] = outA[0]; C[vi + 1] = outA[1]; C[vi + 2] = outA[2];
      C[vi + 3] = outB[0]; C[vi + 4] = outB[1]; C[vi + 5] = outB[2];
    }
  }

  hideStrip(s) {
    const start = s * this.pps * 6;
    this.colors.fill(0, start, start + this.pps * 6);
    this.positions.fill(0, start, start + this.pps * 6);
  }

  commit() {
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
