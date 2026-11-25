// KHỐI RỒNG 3D bên dưới lớp phi kiếm (skill Kim long): thân ống vảy vàng uốn theo đường bay,
// đầu rồng (mõm, hàm, sừng, bờm, mắt sáng), 4 chân có khớp và móng vuốt. Phi kiếm phủ lên trên như vảy
// → nhìn liền khối, không có khoảng hở. Hình đầu rồng tự dựng bằng khối cơ bản (không lấy mẫu từ phim).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

const NS = 90, NR = 14; // số vòng dọc thân × số điểm mỗi vòng

// Vảy rồng (canvas): các vảy bán nguyệt xếp so le, viền sáng
function scaleTexture() {
  const W = 256, H = 256, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#8a6a22'; g.fillRect(0, 0, W, H);
  const r = 32;
  for (let row = -1; row < H / (r * 0.8) + 1; row++) {
    for (let col = -1; col < W / (r * 2) + 1; col++) {
      const x = col * r * 2 + (row % 2 ? r : 0), y = row * r * 0.8;
      const grd = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
      grd.addColorStop(0, '#fff2b8'); grd.addColorStop(0.55, '#e6be52'); grd.addColorStop(1, '#7c5a1a');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI); g.fill();
      g.strokeStyle = 'rgba(255,240,190,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r - 1, 0.1, Math.PI - 0.1); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Đầu rồng (toạ độ cục bộ: +Z = phía trước, +Y = lên, đơn vị theo cỡ đầu = 1)
function headGeometry() {
  const parts = [];
  const add = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  add(new THREE.SphereGeometry(0.5, 16, 12), 0, 0.05, -0.05, 0, 0, 0, 0.95, 0.75, 1.15);              // sọ
  add(new THREE.CylinderGeometry(0.26, 0.42, 1.05, 12), 0, 0.02, 0.62, Math.PI / 2);                  // mõm dài
  add(new THREE.SphereGeometry(0.3, 12, 10), 0, 0.04, 1.12, 0, 0, 0, 1.05, 0.75, 0.9);              // mũi
  add(new THREE.BoxGeometry(0.5, 0.13, 1.0), 0, -0.3, 0.6, 0.18);                                    // hàm dưới (hơi há)
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.09, 1.25, 8), s * 0.24, 0.5, -0.45, -2.25, 0, s * 0.18);             // sừng vểnh ra sau
    add(new THREE.ConeGeometry(0.05, 0.5, 6), s * 0.2, 0.38, -0.1, -2.0, 0, s * 0.25);                // sừng nhỏ
    add(new THREE.SphereGeometry(0.12, 8, 6), s * 0.3, 0.22, 0.35, 0, 0, 0, 1, 0.7, 1.2);              // gờ mày
    add(new THREE.ConeGeometry(0.06, 0.35, 6), s * 0.24, -0.08, 1.15, Math.PI / 2 + 0.3, 0, s * -0.5); // nanh
  }
  for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.08, 0.5 - i * 0.05, 6), 0, 0.42 - i * 0.04, -0.3 - i * 0.18, -1.9); // bờm gai sau đầu
  const g = mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k); return p; }));
  g.computeVertexNormals();
  return g;
}

export class DragonBody {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({
      map: scaleTexture(), color: 0xffe9a8, metalness: 0.85, roughness: 0.3,   // vàng kim, bớt ngả cam
      emissive: 0x5a4210, emissiveIntensity: 0.45, transparent: true, opacity: 1,
    });

    // --- thân: ống dọc sống lưng, cập nhật mỗi khung hình ---
    const n = NS * NR;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
      uv.set([j / (NR - 1) * 3, (i / NS) * 14], (i * NR + j) * 2);
      if (i < NS - 1) {
        const a = i * NR + j, b = i * NR + (j + 1) % NR, c = (i + 1) * NR + j, d = (i + 1) * NR + (j + 1) % NR;
        idx.push(a, c, b, b, c, d);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.body = new THREE.Mesh(geo, this.mat);
    this.body.frustumCulled = false;
    this.group.add(this.body);

    // --- đầu ---
    this.head = new THREE.Mesh(headGeometry(), this.mat);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeMat);
      eye.position.set(s * 0.33, 0.17, 0.42);
      this.head.add(eye);
    }
    this.group.add(this.head);

    // --- 4 chân: đùi, cẳng (trụ), khớp gối / hông (cầu), 3 móng (chóp) ---
    const cyl = new THREE.CylinderGeometry(1, 0.8, 1, 10); cyl.translate(0, 0.5, 0); // gốc ở đáy, dài 1 theo +Y
    const sph = new THREE.SphereGeometry(1, 10, 8);
    const claw = new THREE.ConeGeometry(1, 1, 6); claw.translate(0, 0.5, 0);
    this.legs = [0, 1, 2, 3].map(() => {
      const L = {
        thigh: new THREE.Mesh(cyl, this.mat), shin: new THREE.Mesh(cyl, this.mat),
        hip: new THREE.Mesh(sph, this.mat), knee: new THREE.Mesh(sph, this.mat), foot: new THREE.Mesh(sph, this.mat),
        claws: [0, 1, 2].map(() => new THREE.Mesh(claw, this.mat)),
      };
      for (const m of [L.thigh, L.shin, L.hip, L.knee, L.foot, ...L.claws]) this.group.add(m);
      return L;
    });
    this.F = { A: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), B: new THREE.Vector3() };
    this.leg = { F: { A: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), B: new THREE.Vector3() },
      hip: new THREE.Vector3(), knee: new THREE.Vector3(), foot: new THREE.Vector3(), thigh: new THREE.Vector3(), shin: new THREE.Vector3(), side: 1 };
    this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  // đặt 1 khối trụ / chóp nối từ a theo hướng dir dài len, bán kính rad
  _bone(mesh, a, dir, len, rad) {
    mesh.position.copy(a);
    mesh.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, dir);
    mesh.scale.set(rad, len, rad);
  }

  update(swarm) {
    const D = CONFIG.dragon, k = swarm.dragon.k;
    const on = D.solid && k > 0.02 && swarm.dragon.hist.length > 2;
    this.group.visible = on;
    if (!on) return;
    this.mat.opacity = Math.min(1, k * 1.2);
    const now = swarm.time, bodyT = D.length / Math.max(1, D.speed), F = this.F, fit = D.meshFit ?? 0.9;
    // --- thân: cổ → đuôi (đuôi thon nhọn) ---
    const P = this.pos, Nn = this.nor;
    for (let i = 0; i < NS; i++) {
      const s = i / (NS - 1);
      swarm.dragonFrame(now - s * bodyT, F);
      const tail = s > 0.85 ? 1 - (s - 0.85) / 0.15 : 1;          // vuốt nhọn đuôi
      const r = D.bodyRadius * swarm.dragonTaper(s, 0.12) * fit * Math.max(0.02, tail);
      for (let j = 0; j < NR; j++) {
        const a = (j / NR) * Math.PI * 2;
        const cx = Math.cos(a), sy = Math.sin(a) * (sy0(a));
        const nx = F.N.x * cx + F.B.x * sy, ny = F.N.y * cx + F.B.y * sy, nz = F.N.z * cx + F.B.z * sy;
        const o = (i * NR + j) * 3;
        P[o] = F.A.x + nx * r; P[o + 1] = F.A.y + ny * r; P[o + 2] = F.A.z + nz * r;
        Nn[o] = nx; Nn[o + 1] = ny; Nn[o + 2] = nz;
      }
    }
    const g = this.body.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();

    // --- đầu: tại đầu rồng, quay theo hướng bay ---
    swarm.dragonFrame(now, F);
    this._m.makeBasis(F.N, F.B, F.T);
    this.head.quaternion.setFromRotationMatrix(this._m);
    this.head.position.copy(F.A).addScaledVector(F.T, D.headSize * 0.25);
    this.head.scale.setScalar(D.headSize * 1.05);

    // --- chân ---
    this.legs.forEach((L, li) => {
      const vis = D.legs;
      for (const m of [L.thigh, L.shin, L.hip, L.knee, L.foot, ...L.claws]) m.visible = vis;
      if (!vis) return;
      const G = swarm.dragonLeg(li, now, this.leg);
      const rad = D.bodyRadius * 0.22;
      this._bone(L.thigh, G.hip, G.thigh, G.hip.distanceTo(G.knee), rad);
      this._bone(L.shin, G.knee, G.shin, G.knee.distanceTo(G.foot), rad * 0.75);
      L.hip.position.copy(G.hip); L.hip.scale.setScalar(rad * 1.5);
      L.knee.position.copy(G.knee); L.knee.scale.setScalar(rad * 1.05);
      L.foot.position.copy(G.foot); L.foot.scale.setScalar(rad * 0.95);
      L.claws.forEach((c, ci) => {
        const d = this._v.copy(G.shin).addScaledVector(G.F.T, 0.7).addScaledVector(G.F.N, G.side * (ci - 1) * 0.55).normalize();
        this._bone(c, G.foot, d, D.legLength * 0.28, rad * 0.35);
      });
    });
  }
}

// thân hơi dẹt theo chiều đứng (bụng phẳng hơn lưng)
function sy0(a) { return Math.sin(a) < 0 ? 0.85 : 1; }
