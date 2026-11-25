// Nhân vật tu sĩ đứng trên phi kiếm: tóc đen dài bay theo gió, áo bào đen xanh thêu viền vàng,
// cổ áo chéo xanh nhạt, giáp vai vàng, thắt lưng khóa vàng + tua đỏ, áo choàng dài (ngoài tối, lót xám xanh).
// Mọi chi tiết dựng bằng hình khối + texture vẽ bằng canvas.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { softDotTexture } from './scene.js';

const GOLD = '#c9a04a';

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function fabricNoise(g, w, h, n = 5000, a = 0.035) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1, 1 + Math.random() * 2);
  }
}

function diamond(g, x, y, s, fill = false) {
  g.beginPath();
  g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.7, y); g.closePath();
  fill ? g.fill() : g.stroke();
}

// Vải áo bào: nền đen xanh, dải thêu vàng chính giữa phía trước (u = 0.5), viền gấu áo
function robeTexture(withHem = true) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#18202d'; g.fillRect(0, 0, w, h);
    fabricNoise(g, w, h);
    g.strokeStyle = g.fillStyle = GOLD;
    const cx = w / 2;
    g.lineWidth = 3;
    for (const dx of [-38, 38]) { g.beginPath(); g.moveTo(cx + dx, 0); g.lineTo(cx + dx, h); g.stroke(); }
    g.lineWidth = 2.5;
    for (let y = 30; y < h; y += 64) {
      diamond(g, cx, y, 24);
      diamond(g, cx, y, 9, true);
      g.beginPath(); g.moveTo(cx - 30, y + 32); g.lineTo(cx, y + 44); g.lineTo(cx + 30, y + 32); g.stroke();
    }
    // hoa văn hình học thưa hai bên
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * w + 20;
      if (Math.abs(x - cx) < 70) continue;
      diamond(g, x, h * 0.72, 10);
    }
    if (withHem) {
      g.fillRect(0, h - 30, w, 7);
      g.fillRect(0, h - 15, w, 3);
      for (let x = 8; x < w; x += 24) diamond(g, x, h - 45, 6);
    }
  });
}

// Áo choàng mặt ngoài: tối, viền vàng hai mép và gấu
function capeTexture() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#1f2633'; g.fillRect(0, 0, w, h);
    fabricNoise(g, w, h, 3000, 0.04);
    g.fillStyle = GOLD;
    g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    g.fillRect(0, h - 12, w, 6);
  });
}

// Tạo dải vải/tóc có thể bay theo gió (đầu trên cố định ở y = 0)
function makeStrip(w, L, segX, segY, taper = 0) {
  const geo = new THREE.PlaneGeometry(w, L, segX, segY);
  geo.translate(0, -L / 2, 0);
  const p = geo.attributes.position.array;
  if (taper) for (let i = 0; i < p.length; i += 3) p[i] *= 1 - taper + taper * (-p[i + 1] / L);
  return { geo, base: p.slice(), L };
}

function waveStrip(st, t, { back = 0.5, flutter = 0.07, side = 0.05, phase = 0, freq = 7 }) {
  const p = st.geo.attributes.position.array, b = st.base;
  for (let i = 0; i < p.length; i += 3) {
    const x0 = b[i], y0 = b[i + 1], z0 = b[i + 2];
    const s = -y0 / st.L; // 0 ở gốc, 1 ở đuôi
    const ph = phase + x0 * 3;
    p[i] = x0 + Math.sin(t * 5.3 - s * 5 + ph) * side * s;
    p[i + 1] = y0 + s * s * back * 0.3;
    p[i + 2] = z0 - s * s * back - Math.sin(t * freq - s * 7 + ph) * flutter * s;
  }
  st.geo.attributes.position.needsUpdate = true;
  st.geo.computeVertexNormals();
}

export function createHero(swordGeo, swordMat, shellGeo, shellMat) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.y = -0.5; // mặt hướng chéo về bên trái (hướng bay) và về phía camera
  root.add(body);

  // --- Vật liệu ---
  const robeTex = robeTexture(true);
  const torsoTex = robeTexture(false);
  const robeMat = new THREE.MeshStandardMaterial({ map: robeTex, roughness: 0.75, side: THREE.DoubleSide });
  const torsoMat = new THREE.MeshStandardMaterial({ map: torsoTex, roughness: 0.75 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.8, side: THREE.DoubleSide });
  const innerBlue = new THREE.MeshStandardMaterial({ color: 0xa9c8dc, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1d6bf, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9ac52, metalness: 0.85, roughness: 0.3, emissive: 0x3a2808, emissiveIntensity: 0.6 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xa3202a, roughness: 0.7 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.5, metalness: 0.2 });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
  };

  // --- Phi kiếm dưới chân ---
  const ride = new THREE.Mesh(swordGeo, swordMat);
  ride.scale.setScalar(CONFIG.sword.heroSwordScale);
  ride.rotation.x = Math.PI / 2;
  ride.position.set(0, 0.02, 0.1);
  body.add(ride);
  if (shellGeo && shellMat) ride.add(new THREE.Mesh(shellGeo, shellMat)); // thân kiếm ngoài trong suốt

  // --- Giày ---
  for (const x of [-0.09, 0.09]) add(new THREE.CylinderGeometry(0.055, 0.065, 0.2, 10), bootMat, x, 0.14, 0.02);

  // --- Vạt áo dưới (thêu vàng phía trước + viền gấu) ---
  // thetaStart = π để giữa texture (u = 0.5) nằm ở phía trước (+z)
  add(new THREE.CylinderGeometry(0.2, 0.27, 1.02, 24, 1, true, Math.PI), robeMat, 0, 0.6, 0);

  // --- Thân trên ---
  const torso = add(new THREE.CylinderGeometry(0.175, 0.2, 0.6, 20, 1, false, Math.PI), torsoMat, 0, 1.4, 0);
  torso.scale.set(1.15, 1, 0.82);
  // Cổ áo chéo: lớp trong xanh nhạt + nẹp vàng
  const lapel = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.045, 1.55, 0.155);
    g.rotation.z = side * 0.5;
    add(new THREE.BoxGeometry(0.05, 0.34, 0.012), innerBlue, 0, 0, 0, g);
    add(new THREE.BoxGeometry(0.014, 0.36, 0.016), goldMat, side * 0.032, 0, 0.002, g);
    body.add(g);
  };
  lapel(-1); lapel(1);
  // Thắt lưng + khóa vàng + mảnh trang trí + tua đỏ
  add(new THREE.CylinderGeometry(0.205, 0.205, 0.08, 20), darkMat, 0, 1.14, 0);
  const buckle = add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), goldMat, 0, 1.14, 0.2);
  buckle.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.1, 0.16, 0.02), goldMat, 0, 1.0, 0.205);
  const tassels = [];
  for (const x of [-0.07, 0.07]) {
    const tg = new THREE.Group();
    tg.position.set(x, 1.0, 0.215);
    add(new THREE.CylinderGeometry(0.012, 0.018, 0.34, 6), redMat, 0, -0.17, 0, tg);
    add(new THREE.SphereGeometry(0.02, 8, 6), goldMat, 0, 0, 0, tg);
    body.add(tg);
    tassels.push(tg);
  }

  // --- Giáp vai vàng + cổ áo dựng ---
  for (const side of [-1, 1]) {
    const pad = add(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat, side * 0.23, 1.66, 0);
    pad.scale.set(1.15, 0.55, 1);
    pad.rotation.z = -side * 0.35;
    const flare = add(new THREE.BoxGeometry(0.03, 0.16, 0.12), goldMat, side * 0.13, 1.78, -0.04);
    flare.rotation.z = -side * 0.45;
  }

  // --- Cổ + đầu ---
  add(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 10), skinMat, 0, 1.76, 0);
  const head = add(new THREE.SphereGeometry(0.145, 24, 18), skinMat, 0, 1.94, 0.005);
  head.scale.set(0.9, 1.1, 0.95);
  // mày, mắt (đơn giản)
  for (const x of [-0.045, 0.045]) {
    const brow = add(new THREE.BoxGeometry(0.05, 0.008, 0.01), hairMat, x, 1.985, 0.128);
    brow.rotation.z = x > 0 ? -0.12 : 0.12;
    add(new THREE.SphereGeometry(0.011, 8, 6), hairMat, x, 1.955, 0.128);
  }

  // --- Tóc: chỏm trên, búi + trâm vàng, tóc dài sau lưng, 2 lọn trước mặt ---
  // chỏm tóc ngả ra sau để lộ trán (tóc rẽ giữa, buộc nửa đầu)
  const cap = add(new THREE.SphereGeometry(0.158, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, 0, 1.955, -0.015);
  cap.scale.set(0.97, 1.12, 1.02);
  cap.rotation.x = -0.85;
  const backHair = add(new THREE.SphereGeometry(0.15, 16, 12), hairMat, 0, 1.92, -0.05);
  backHair.scale.set(0.95, 1.05, 0.9);
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 12), hairMat, 0, 2.12, -0.05);
  const pin = add(new THREE.BoxGeometry(0.2, 0.014, 0.014), goldMat, 0, 2.13, -0.05);
  pin.rotation.z = 0.15;

  const hairStrips = [];
  const hairRoot = new THREE.Group();
  hairRoot.position.set(0, 2.0, -0.12);
  body.add(hairRoot);
  [[-0.06, 1.15, 0.13], [0.0, 1.3, 0.15], [0.06, 1.1, 0.13]].forEach(([x, L, w], i) => {
    const st = makeStrip(w, L, 1, 14, 0.5);
    const m = new THREE.Mesh(st.geo, hairMat);
    m.position.set(x, 0, -i * 0.005);
    hairRoot.add(m);
    hairStrips.push({ st, phase: i * 1.3 });
  });
  const frontStrands = [];
  for (const x of [-0.115, 0.115]) {
    const st = makeStrip(0.035, 0.55, 1, 8, 0.4);
    const m = new THREE.Mesh(st.geo, hairMat);
    m.position.set(x, 2.0, 0.07);
    body.add(m);
    frontStrands.push({ st, phase: x * 10 });
  }

  // --- Tay: vai → khuỷu → cổ tay. Cánh tay trên áo bó, cẳng tay áo rộng loe, cổ tay vàng ---
  // shoulder: [rx, rz] xoay ở vai; elbow: [rx, rz] gập ở khuỷu; seal: bàn tay bắt kiếm quyết (2 ngón giơ)
  function makeArm(x, shoulder, elbow, seal = false) {
    const sh = new THREE.Group();
    sh.position.set(x, 1.67, 0);
    sh.rotation.set(shoulder[0], 0, shoulder[1]);
    add(new THREE.SphereGeometry(0.07, 12, 8), robeMat, 0, 0, 0, sh); // khớp vai
    add(new THREE.CylinderGeometry(0.068, 0.062, 0.28, 12), torsoMat, 0, -0.14, 0, sh);
    const el = new THREE.Group();
    el.position.y = -0.28;
    el.rotation.set(elbow[0], 0, elbow[1]);
    sh.add(el);
    add(new THREE.SphereGeometry(0.062, 10, 8), torsoMat, 0, 0, 0, el); // khớp khuỷu
    const sleeve = add(new THREE.CylinderGeometry(0.065, 0.12, 0.27, 14, 1, true, Math.PI), robeMat, 0, -0.135, 0, el);
    sleeve.rotation.y = Math.PI;
    const cuff = add(new THREE.TorusGeometry(0.115, 0.011, 6, 20), goldMat, 0, -0.27, 0, el);
    cuff.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.038, 0.045, 0.06, 10), innerBlue, 0, -0.27, 0, el);
    // bàn tay: lòng bàn tay dẹt + (nếu bắt ấn) 2 ngón trỏ–giữa duỗi thẳng
    const hand = new THREE.Group();
    hand.position.y = -0.33;
    el.add(hand);
    add(new THREE.BoxGeometry(0.06, 0.07, 0.03), skinMat, 0, 0, 0, hand); // lòng bàn tay
    if (seal) {
      for (const fx of [-0.012, 0.012]) add(new THREE.CapsuleGeometry(0.011, 0.07, 3, 6), skinMat, fx, -0.075, 0, hand);
      const thumb = add(new THREE.CapsuleGeometry(0.011, 0.03, 3, 6), skinMat, 0.03, -0.01, 0.015, hand);
      thumb.rotation.z = 0.8;
    } else {
      add(new THREE.BoxGeometry(0.055, 0.05, 0.028), skinMat, 0, -0.055, 0.005, hand); // ngón khép
    }
    body.add(sh);
    return { sh, el, base: { shoulder, elbow } };
  }
  // Tay phải: gập khuỷu, đưa bàn tay lên trước ngực bắt kiếm quyết (điều khiển phi kiếm)
  const armR = makeArm(-0.27, [-0.35, 0.22], [-1.95, 0.35], true);
  // Tay trái: buông tự nhiên bên hông, hơi ra sau
  const armL = makeArm(0.27, [0.12, 0.1], [-0.18, 0]);

  // --- Áo choàng dài: chung 1 hình, mặt ngoài tối viền vàng, mặt trong lót xám xanh ---
  const cape = makeStrip(0.78, 1.75, 6, 18, 0.45);
  const capeOuter = new THREE.Mesh(cape.geo, new THREE.MeshStandardMaterial({ map: capeTexture(), roughness: 0.8, side: THREE.BackSide }));
  const capeLining = new THREE.Mesh(cape.geo, new THREE.MeshStandardMaterial({ color: 0x6d7b90, roughness: 0.85, side: THREE.FrontSide }));
  for (const m of [capeOuter, capeLining]) { m.position.set(0, 1.74, -0.2); body.add(m); }

  // --- Quả cầu sáng ngọc bao quanh (hộ thể linh quang) ---
  const orbMat = new THREE.SpriteMaterial({
    map: softDotTexture(128, 0.35), color: CONFIG.colors.orb, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const orb = new THREE.Sprite(orbMat);
  orb.position.y = 1.15;
  orb.scale.setScalar(2.6);
  orb.renderOrder = 5;
  root.add(orb);

  // Đèn trắng ấm chiếu phía trước để thấy rõ màu áo (không bị ánh kiếm nhuộm xanh)
  const keyLight = new THREE.PointLight(0xfff0e0, 1.6, 5, 1.2);
  keyLight.position.set(0, 1.6, 1.4);
  body.add(keyLight);

  const center = new THREE.Vector3();
  const offset = new THREE.Vector3(...CONFIG.heroCenterOffset);
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), body.rotation.y);
  const forward0 = forward.clone();          // hướng mặt lúc chưa quay
  const facing0 = Math.atan2(forward0.x, forward0.z);
  let yaw = 0, yawRate = 0;                  // hướng quay đầu hiện tại (quay theo hướng bay)
  root.rotation.order = 'YXZ';               // quay đầu trước, rồi mới nghiêng người

  // Vị trí bay của nhân vật (di chuyển bằng WASD / mũi tên / R F) + nghiêng người theo hướng bay
  const base = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const lean = { x: 0, z: 0 };
  function move(v, dt) {
    vel.lerp(v, 1 - Math.exp(-6 * dt));              // tăng / giảm tốc mượt
    base.addScaledVector(vel, dt);
    const F = CONFIG.heroFly;
    base.y = THREE.MathUtils.clamp(base.y, F.minY, F.maxY);
    return vel;
  }

  function update(dt, t) {
    // QUAY ĐẦU theo hướng bay (trái / phải / quay lại), mượt
    const F = CONFIG.heroFly, hs = Math.hypot(vel.x, vel.z);
    let dYaw = 0;
    if (F.turn && hs > 1) {
      const want = Math.atan2(vel.x, vel.z) - facing0;
      let diff = want - yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));      // đường quay ngắn nhất
      dYaw = diff * (1 - Math.exp(-F.turnRate * dt));
      yaw += dYaw;
    }
    yawRate += (dYaw / Math.max(dt, 1e-4) - yawRate) * Math.min(1, dt * 6);
    forward.copy(forward0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    // nghiêng người: chúi tới khi bay nhanh, nghiêng sang bên khi rẽ
    const fwdSpeed = vel.x * forward.x + vel.z * forward.z;
    const lx = THREE.MathUtils.clamp(fwdSpeed * 0.018, -0.3, 0.3);
    const lz = THREE.MathUtils.clamp(-yawRate * 0.18, -0.4, 0.4);
    lean.x += (lx - lean.x) * Math.min(1, dt * 4); lean.z += (lz - lean.z) * Math.min(1, dt * 4);
    root.rotation.y = yaw;
    root.position.set(base.x, base.y + Math.sin(t * 1.3) * 0.18, base.z);
    ride.scale.setScalar(CONFIG.sword.heroSwordScale); // cỡ phi kiếm dưới chân (chỉnh được trong bảng)
    root.rotation.z = Math.sin(t * 0.9) * 0.05 + lean.z;
    root.rotation.x = Math.sin(t * 1.1) * 0.03 + lean.x;
    armR.el.rotation.x = armR.base.elbow[0] + Math.sin(t * 2.1) * 0.04;
    armL.sh.rotation.x = armL.base.shoulder[0] + Math.sin(t * 1.7 + 1) * 0.05; // tay trái đung đưa nhẹ
    orbMat.opacity = (0.13 + 0.04 * Math.sin(t * 2.4)) * (CONFIG.palette.glowMul ?? 1); // trời sáng: quầng mờ hơn
    orb.scale.setScalar(2.6 + 0.12 * Math.sin(t * 1.7));

    waveStrip(cape, t, { back: 0.75, flutter: 0.1, side: 0.06 });
    for (const h of hairStrips) waveStrip(h.st, t, { back: 0.55, flutter: 0.06, side: 0.05, phase: h.phase, freq: 8 });
    for (const h of frontStrands) waveStrip(h.st, t, { back: 0.12, flutter: 0.02, side: 0.015, phase: h.phase, freq: 6 });
    for (let i = 0; i < tassels.length; i++) tassels[i].rotation.x = -0.35 + Math.sin(t * 6 + i) * 0.12;

    center.copy(offset).add(root.position);
  }

  // Ẩn/hiện hình 3D mô phỏng (giữ phi kiếm dưới chân + đèn + quầng sáng) — dùng khi thay bằng ảnh thật
  function setFigureVisible(v) {
    for (const c of body.children) if (c !== ride && c !== keyLight) c.visible = v;
  }

  return { root, center, forward, update, setFigureVisible, move, base, vel };
}
