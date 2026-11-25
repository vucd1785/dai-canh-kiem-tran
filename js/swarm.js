// Đàn phi kiếm — kiếm luân 3 vòng đồng tâm sau lưng, lò xo, trạng thái
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const STATES = ['ORBIT', 'SPREAD', 'SHIELD', 'ATTACK', 'RETURN', 'FORMATION', 'URCHIN', 'GIANT', 'VOLLEY', 'DRAGON'];
const DOWN = new THREE.Vector3(0, -1, 0);
const _gp = new THREE.Vector3();
const _LEG = { F: { A: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), B: new THREE.Vector3() },
  hip: new THREE.Vector3(), knee: new THREE.Vector3(), foot: new THREE.Vector3(), thigh: new THREE.Vector3(), shin: new THREE.Vector3(), side: 1 };
const _dA = new THREE.Vector3(), _dB = new THREE.Vector3(), _dT = new THREE.Vector3(), _dN = new THREE.Vector3(), _dBn = new THREE.Vector3(), _dO = new THREE.Vector3();

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _hn = new THREE.Vector3();
const _acc = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _sc = new THREE.Vector3();
const _tv = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _c = new THREE.Color();
const _e = new THREE.Euler();
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const _prev = new THREE.Vector3();
const _slot = new THREE.Vector3();
const _uc = new THREE.Vector3();
const _endD = new THREE.Vector3();
const _endD2 = new THREE.Vector3();

// Điểm trên đường cong Bézier bậc 3
function bezier(out, p0, p1, p2, p3, u) {
  const a = 1 - u;
  return out.set(0, 0, 0)
    .addScaledVector(p0, a * a * a).addScaledVector(p1, 3 * a * a * u)
    .addScaledVector(p2, 3 * a * u * u).addScaledVector(p3, u * u * u);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Swarm {
  constructor(scene, geometry, material, hero) {
    this.center = hero.center; // Vector3 sống (tâm nhân vật), cập nhật mỗi khung hình
    this.forward = hero.forward; // hướng mặt nhân vật
    // Mặt phẳng kiếm luân: vuông góc với hướng mặt nhân vật, nằm sau lưng
    this.haloQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.forward);
    this.haloCenter = new THREE.Vector3();
    this._updateHaloCenter();
    this.swords = [];
    let idx = 0;
    CONFIG.rings.forEach((ring, r) => {
      for (let j = 0; j < ring.count; j++) {
        this.swords.push({
          index: idx++, ring: r, slot: j,
          angle0: ((j + (ring.offset || 0)) / ring.count) * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          // hệ số so le ngẫu nhiên (-1..1), nhân với radialJitter / angleJitter lúc tính → chỉnh trực tiếp được
          rj: Math.random() * 2 - 1, aj: Math.random() * 2 - 1,
          pos: new THREE.Vector3(), vel: new THREE.Vector3(),
          dir: new THREE.Vector3(0, 1, 0), quat: new THREE.Quaternion(),
          target: new THREE.Vector3(),
          state: 'ORBIT', pending: null, switchAt: 0, arrived: false, scale: 1,
        });
      }
    });
    this.count = idx;
    this.ringStart = [];
    let acc = 0;
    for (const r of CONFIG.rings) { this.ringStart.push(acc); acc += r.count; }

    this._buildShield();

    this._buildUrchin();
    // CỰ KIẾM: chỗ của từng thanh trong đội hình chĩa xuống + chỗ nhập vào thân cự kiếm
    this.giant = { pos: new THREE.Vector3(), quat: new THREE.Quaternion().setFromUnitVectors(UP, DOWN), k: 0, scale: 0, hidden: true };
    this._giantRight = new THREE.Vector3(); this._giantFwd = new THREE.Vector3(); this._giantNear = 1;
    this._buildGiant();
    // BẮN KIẾM: đối phương (điểm chuột / ngón tay), hướng tới đối phương và khung đội hình
    this.enemy = new THREE.Vector3(...CONFIG.attack.defaultTarget);
    this._vDir = new THREE.Vector3(0, 0, -1); this._vRight = new THREE.Vector3(1, 0, 0); this._vUp = new THREE.Vector3(0, 1, 0);
    this.volleyDone = 0;
    // KIM LONG: đầu rồng bay lượn, thân đi theo đúng đường đầu đã bay (lịch sử vị trí đầu)
    this.dragon = { head: new THREE.Vector3(), t: 0, hist: [], k: 0 };
    this._buildDragon();
    this.urchinQ = new THREE.Quaternion().copy(this.haloQ);
    this.urchinCenter = new THREE.Vector3();
    this.streamCurves = [];

    this.ringAngles = CONFIG.rings.map(() => 0);
    this.formationTiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(CONFIG.formation.tilt, 0, 0));
    this.userQ = new THREE.Quaternion();
    this.userYaw = 0; this.userPitch = 0; this.userYawT = 0; this.userPitchT = 0;
    this.radiusMul = 1; this.radiusUser = 1;
    this.speedMul = CONFIG.speed.default ?? 1;
    this.shieldAngles = [0, 0]; this.formationAngle = 0;
    this.state = 'ORBIT'; this.stateStart = 0; this.time = 0;
    this.attackGoal = new THREE.Vector3(...CONFIG.attack.defaultTarget);
    this.attackTarget = this.attackGoal.clone();
    // Tâm vòng bay của các cụm: bay về mục tiêu với tốc độ như 1 thanh kiếm (không nhảy theo chuột),
    // và lưu LỊCH SỬ vị trí → thanh thứ j trong cụm đi theo vị trí tâm của j×gap giây trước
    // ⇒ khi rê chuột, thanh đầu đổi hướng trước, các thanh sau lần lượt bay đúng theo đường đó (nối đuôi).
    this.loopCenter = this.attackTarget.clone();
    this.hist = [];
    this._arriveCbs = []; this._stateCbs = [];

    this.edgeGold = new Float32Array(this.count); // 0..1 viền lưỡi vàng từng thanh (thân kiếm ngoài đọc mảng này)
    // Vòng vàng ở chuôi: 0 khi xoay (kiếm luân, kiếm thuẫn...), 1 khi PHI KIẾM (phóng kiếm / tụ vòng kiếm)
    this.accent = new Float32Array(this.count); // viền vàng quanh cán tròn (đĩa chắn)
    this.grip = new Float32Array(this.count);   // vàng ở tay cầm + núm
    const geo = geometry.clone();
    geo.setAttribute('aAccent', new THREE.InstancedBufferAttribute(this.accent, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aGrip', new THREE.InstancedBufferAttribute(this.grip, 1).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.InstancedMesh(geo, material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.count; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
    scene.add(this.mesh);

    // Đặt kiếm vào đúng vị trí kiếm luân ngay từ đầu, mũi hướng ra ngoài
    for (const s of this.swords) {
      this._computeTarget(s);
      s.pos.copy(s.target);
      _dir.subVectors(s.target, this.haloCenter).normalize();
      s.quat.setFromUnitVectors(UP, _dir);
    }
  }

  // KIẾM THUẪN: 2 QUẢ CẦU KÍN như quả địa cầu (kể cả 2 đỉnh). Kiếm chẵn → cầu trong, lẻ → cầu ngoài.
  // Kiếm rải ĐỀU trên mặt cầu theo đường xoắn Fibonacci (không thành từng vòng), mỗi quả cầu tự quay
  // quanh trục đứng như trái đất: cầu ngoài TRÁI → PHẢI, cầu trong PHẢI → TRÁI. Mũi kiếm nằm theo chiều quay.
  // Gần 2 đỉnh kiếm nhỏ dần (vòng quay ở đó nhỏ) để đỉnh vẫn kín mà không rối.
  _buildShield() {
    this._shieldKey = 'globe';
    const per = [[], []];
    this.swords.forEach((s, i) => per[i % 2].push(i));
    this.shieldSlots = new Array(this.count);
    for (let layer = 0; layer < 2; layer++) {
      const list = per[layer], n = Math.max(1, list.length);
      list.forEach((idx, k) => {
        const y = 1 - (2 * (k + 0.5)) / n;              // từ đỉnh trên xuống đỉnh dưới
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const th = k * GOLDEN + layer * 1.1;              // cầu ngoài lệch góc → so le với cầu trong
        this.shieldSlots[idx] = {
          layer, dir: new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr),
          rOff: ((k * 0.6180339) % 1) - 0.5,              // lệch bán kính trong độ dày lớp
          k: 0.5 + 0.5 * Math.min(1, rr / 0.6),           // hệ số cỡ: nhỏ dần khi gần đỉnh
        };
      });
    }
  }

  // Tốc độ góc của lớp kiếm thuẫn: lớp ngoài TRÁI → PHẢI (+), lớp trong PHẢI → TRÁI (−)
  _shieldSpin(layer) {
    const v = Math.abs(CONFIG.shield.flySpeed ?? 0.5);
    return layer === 1 ? v : -v;
  }

  // CỰ KIẾM — bước 1: kiếm CHĨA XUỐNG ĐẤT, dàn thành nhiều hàng trước/sau (xa gần) như đạo quân kiếm.
  // Bước 2: lần lượt bay vào nhập thành 1 thanh kiếm khổng lồ. Bước 3: cự kiếm hiện ra, sấm sét bao quanh.
  _buildGiant() {
    const G = CONFIG.giant, n = this.count;
    const cols = Math.max(1, Math.round(Math.sqrt(n * G.aspect)));
    const rows = Math.ceil(n / cols);
    this._giantGrid = { cols, rows };
    this.giantSlots = this.swords.map((_, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      return {
        col: col - (cols - 1) / 2 + (row % 2) * 0.5,       // hàng so le
        row: row - (rows - 1) / 2,
        jy: ((col + row) % 2 ? 0.5 : -0.5) + (Math.random() - 0.5) * 0.3, // cao thấp XEN KẼ (× heightJitter)
        along: Math.random(),                               // chỗ nhập vào thân cự kiếm (0 = chuôi, 1 = mũi)
        side: (Math.random() - 0.5) * 2,
        delay: Math.random() * G.mergeSpread,               // mỗi thanh nhập vào lúc khác nhau
      };
    });
    this._giantKey = `${n}|${G.aspect}`;
  }

  // KIM LONG — chia kiếm: ĐẦU (mõm, sừng, râu) + THÂN (nhiều vòng vảy dọc sống lưng, thon dần về đuôi)
  _buildDragon() {
    const D = CONFIG.dragon, n = this.count;
    const nHead = Math.min(n, Math.max(8, Math.round(n * 0.1)));
    const per = Math.max(3, Math.round(D.ringSize));
    // 4 CHÂN: mỗi chân 2 thanh đùi + 2 thanh cẳng + 3 móng vuốt
    const LEG = 7, nLeg = D.legs ? Math.min(4 * LEG, Math.max(0, n - nHead - per)) : 0;
    const nBody = n - nHead - nLeg, segs = Math.max(1, Math.ceil(nBody / per));
    this.dragonSlots = this.swords.map((_, i) => {
      if (i >= nHead && i < nHead + nLeg) {
        const j = i - nHead;
        return { head: false, leg: Math.floor(j / LEG), part: j % LEG };
      }
      if (i > nHead + nLeg - 1) i -= nLeg; // phần còn lại làm thân
      if (i < nHead) {
        // đầu: 2 sừng, 2 râu, còn lại thành mõm / đầu hình chóp nhọn về phía trước
        const kind = i < 2 ? 'horn' : i < 4 ? 'whisker' : 'snout';
        return { head: true, kind, side: i % 2 ? 1 : -1, a: (i / nHead) * Math.PI * 2 * 2.3, f: (i % 5) / 5 };
      }
      const j = i - nHead, seg = Math.floor(j / per), m = j % per;
      return { head: false, s: (seg + 0.5) / segs, a: (m / per) * Math.PI * 2 + (seg % 2) * (Math.PI / per) };
    });
    this._dragonKey = `${n}|${D.ringSize}|${D.legs}`;
  }

  // Vị trí đầu rồng tại thời điểm t (nội suy trong lịch sử) → điểm trên sống lưng
  _dragonAt(t, out) {
    const H = this.dragon.hist;
    if (!H.length) return out.copy(this.dragon.head);
    if (t >= H[H.length - 1].t) return out.copy(H[H.length - 1].p);
    if (t <= H[0].t) return out.copy(H[0].p);
    let lo = 0, hi = H.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H[m].t <= t) lo = m; else hi = m; }
    return out.copy(H[lo].p).lerp(H[hi].p, (t - H[lo].t) / Math.max(1e-6, H[hi].t - H[lo].t));
  }

  // Khung toạ độ trên sống lưng rồng tại thời điểm t: A = điểm, T = hướng tới, N = ngang, B = lên
  dragonFrame(t, o) {
    this._dragonAt(t, o.A); this._dragonAt(t - 0.06, _dB);
    o.T.subVectors(o.A, _dB); if (o.T.lengthSq() < 1e-8) o.T.set(1, 0, 0); o.T.normalize();
    o.N.crossVectors(o.T, UP); if (o.N.lengthSq() < 1e-6) o.N.set(1, 0, 0); o.N.normalize();
    o.B.crossVectors(o.N, o.T);
    return o;
  }
  // độ to thân theo vị trí dọc thân (0 = cổ, 1 = đuôi): phình giữa, nhỏ ở cổ, thon nhọn về đuôi
  dragonTaper(s, floor = 0.15) {
    return Math.max(floor, Math.sin(Math.PI * Math.min(1, 0.15 + s * 0.95)) * (1 - s * 0.55));
  }
  // Các điểm của 1 chân rồng (hông, gối, bàn chân + hướng đùi / cẳng)
  dragonLeg(leg, now, o) {
    const D = CONFIG.dragon, bodyT = D.length / Math.max(1, D.speed);
    const side = leg % 2 ? 1 : -1, front = leg < 2, sAt = front ? D.legFront : D.legBack;
    const F = this.dragonFrame(now - sAt * bodyT, o.F);
    const r = D.bodyRadius * this.dragonTaper(sAt) * (D.meshFit ?? 0.9);
    const sway = Math.sin(now * D.legSpeed + (front ? 0 : Math.PI) + (side > 0 ? Math.PI / 2 : 0));
    const L1 = D.legLength * 0.55, L2 = D.legLength * 0.5;
    o.side = side;
    o.hip.copy(F.A).addScaledVector(F.N, side * r * 0.85).addScaledVector(F.B, -r * 0.35);
    o.thigh.copy(F.B).multiplyScalar(-0.8).addScaledVector(F.N, side * 0.55).addScaledVector(F.T, -0.3 + sway * 0.5).normalize();
    o.knee.copy(o.hip).addScaledVector(o.thigh, L1);
    o.shin.copy(F.B).multiplyScalar(-1).addScaledVector(F.T, 0.45 - sway * 0.35).addScaledVector(F.N, side * 0.15).normalize();
    o.foot.copy(o.knee).addScaledVector(o.shin, L2);
    return o;
  }

  // Hàng gần camera to hơn, hàng xa nhỏ hơn
  _giantDepthK(slot) {
    const G = CONFIG.giant, half = Math.max(1, (this._giantGrid.rows - 1) / 2);
    return Math.max(0.3, 1 + G.depthScale * (slot.row / half) * this._giantNear);
  }

  // Tiến trình nhập vào cự kiếm của 1 thanh (0 → 1), theo thời gian từ lúc vào chế độ
  _giantMerge(slot) {
    const G = CONFIG.giant, t = this.time - this.stateStart - G.holdTime - slot.delay;
    return smooth(0, G.mergeTime, t);
  }

  // VÒNG KIẾM: các vòng tròn đồng tâm nằm trên 1 mặt phẳng, chuôi quay vào tâm, mũi chĩa ra.
  // Số kiếm mỗi vòng tỉ lệ với chu vi (vòng ngoài nhiều kiếm hơn) → mật độ đều; vòng kề nhau so le nửa khoảng.
  _buildUrchin() {
    const U = CONFIG.urchin;
    const L = Math.max(1, Math.round(U.layers));
    this._urchinLayers = L;
    this._urchinKey = `${L}|${U.radius}|${U.layerGap}`;
    const R = Array.from({ length: L }, (_, l) => U.radius + l * U.layerGap + 0.05);
    const sumR = R.reduce((a, b) => a + b, 0);
    const counts = R.map((r) => Math.floor((this.count * r) / sumR));
    let rest = this.count - counts.reduce((a, b) => a + b, 0);
    for (let l = L - 1; rest > 0; l = (l - 1 + L) % L, rest--) counts[l]++;
    const slots = [];
    counts.forEach((n, l) => {
      for (let j = 0; j < n; j++) slots.push({ layer: l, angle: ((j + (l % 2) * 0.5) / Math.max(1, n)) * Math.PI * 2 });
    });
    // Xếp kiếm vào chỗ theo thứ tự góc hiện tại trên kiếm luân → bay vào ít bắt chéo nhau
    this.urchin = slots;
    this.urchinAngles = R.map(() => 0);
  }

  _updateUrchinCenter() {
    const U = CONFIG.urchin;
    this.urchinCenter.copy(this.center).addScaledVector(this.forward, U.distance);
    this.urchinCenter.y += U.up;
  }

  // Chia kiếm thành các DÒNG bay nối đuôi tới đích (ATTACK: mục tiêu; URCHIN: tâm vòng kiếm).
  // Xếp kiếm từ vòng ngoài vào trong, theo góc → mỗi dòng là 1 cụm kiếm cạnh nhau, thanh này nối đuôi thanh kia.
  _planStreams(state) {
    const S = CONFIG.stream, TAU = Math.PI * 2;
    const order = this.swords.slice().sort((a, b) => {
      const ra = CONFIG.rings[a.ring].radius, rb = CONFIG.rings[b.ring].radius;
      if (ra !== rb) return rb - ra;
      if (a.ring !== b.ring) return a.ring - b.ring;
      const ang = (s) => ((s.angle0 + this.ringAngles[s.ring]) % TAU + TAU) % TAU;
      return ang(a) - ang(b);
    });
    const nS = Math.max(1, Math.min(order.length, Math.round(S.streams)));
    const per = Math.ceil(order.length / nS);
    if (state === 'ATTACK') { this.loopCenter.copy(this.attackTarget); this.hist.length = 0; }
    const end = state === 'URCHIN' ? this.urchinCenter : this.loopCenter;
    const rnd = () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.streamCurves = [];
    // Mỗi CỤM có 1 vòng bay riêng quanh mục tiêu (mặt phẳng nghiêng ngẫu nhiên, bán kính riêng, chiều riêng)
    // → tới nơi các cụm vẫn bay tiếp thành từng dòng tách biệt, không dồn thành 1 đống
    // Mỗi dòng 1 vòng bay UỐN LƯỢN riêng: mặt phẳng xoay ngẫu nhiên mọi hướng, bán kính phập phồng,
    // lượn lên xuống (sóng), chiều bay ngẫu nhiên → các dòng đan nhau nhiều hướng, không đều một kiểu
    const randQ = () => new THREE.Quaternion().setFromAxisAngle(rnd(), Math.random() * Math.PI * 2);
    this.streamLoops = Array.from({ length: nS }, () => {
      const [r0, r1] = S.loopRadius;
      return {
        q: randQ(),
        r: r0 + (r1 - r0) * Math.random(),
        dir: Math.random() < 0.5 ? -1 : 1,
        ang: Math.random() * Math.PI * 2,
        f: 2 + Math.floor(Math.random() * 2),      // số lần lượn lên xuống mỗi vòng
        m: 1 + Math.floor(Math.random() * 3),      // số lần phồng/thắt bán kính mỗi vòng
        wob: (0.8 + Math.random() * 0.8),          // biên độ lượn (nhân với loopWobble)
        rmod: 0.12 + Math.random() * 0.25,
        ph: Math.random() * Math.PI * 2, ph2: Math.random() * Math.PI * 2,
        spd: 0.75 + Math.random() * 0.5,           // mỗi dòng nhanh chậm khác nhau
      };
    });
    const plan = new Map();
    for (let k = 0; k < nS; k++) {
      const group = order.slice(k * per, (k + 1) * per);
      if (!group.length) continue;
      // điểm xuất phát của dòng = trọng tâm cụm kiếm
      const p0 = new THREE.Vector3();
      for (const s of group) p0.add(s.pos);
      p0.divideScalar(group.length);
      // dòng toả ra ngoài trước (theo hướng từ tâm kiếm luân) rồi uốn cong về đích
      const out = new THREE.Vector3().subVectors(p0, this.haloCenter);
      if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
      out.normalize();
      // mỗi dòng toả ra 1 hướng ngẫu nhiên khác nhau rồi vòng về đích
      const p1 = p0.clone().addScaledVector(out, S.swoop * 0.6).addScaledVector(rnd(), S.swoop * 1.1);
      const off2 = rnd().multiplyScalar(S.swoop * 1.3); // điểm điều khiển thứ 2 tính theo đích (đích có thể di chuyển)
      // sóng uốn lượn dọc đường bay (cả dòng đi cùng 1 sóng → vẫn nối đuôi nhau)
      const wave = { v: rnd(), amp: S.swoop * S.waveAmp * (0.6 + Math.random() * 0.8), n: 1 + Math.floor(Math.random() * 2) };
      const curve = { p0, p1, off2, end, wave, len: 0 };
      this.streamCurves.push(curve);
      // Mỗi dòng chia thành NHIỀU HÀNG song song (lanes): kiếm cùng hàng nối đuôi nhau, các hàng đi cạnh nhau
      // lệch nhau một chút → thành 1 bầy kiếm có bề ngang chứ không phải 1 sợi kiếm nối liền.
      const L = Math.max(1, Math.round(S.lanes));
      const laneVec = Array.from({ length: L }, (_, l) => (L === 1 ? new THREE.Vector3() : rnd().multiplyScalar(S.laneSpread * (0.55 + 0.45 * ((l + 1) / L)))));
      group.forEach((s, j) => {
        const lane = j % L, rank = Math.floor(j / L);
        const slot = rank * (1 + 0.6 * (L > 1)) + lane * 0.45 * (L > 1) + Math.random() * 0.35; // thứ tự trễ (đơn vị gap)
        const off = laneVec[lane].clone().addScaledVector(rnd(), S.laneSpread * 0.18 * Math.random());
        plan.set(s, { curve, delay: k * S.streamDelay + slot * S.gap, k: this.streamCurves.length - 1, j: slot, off });
      });
    }
    return plan;
  }

  // Vị trí tâm vòng bay tại thời điểm t (nội suy trong lịch sử)
  centerAt(t, out) {
    const H = this.hist;
    if (!H.length || t >= H[H.length - 1].t) return out.copy(this.loopCenter);
    if (t <= H[0].t) return out.copy(H[0].p);
    let lo = 0, hi = H.length - 1; // tìm nhị phân đoạn chứa t
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H[m].t <= t) lo = m; else hi = m; }
    const a = H[lo], b = H[hi];
    return out.copy(a.p).lerp(b.p, (t - a.t) / Math.max(1e-6, b.t - a.t));
  }

  _curveLen(c) {
    const p2 = _uc.copy(c.end).add(c.off2);
    let len = 0;
    _prev.copy(c.p0);
    for (let i = 1; i <= 12; i++) {
      bezier(_v, c.p0, c.p1, p2, c.end, i / 12);
      len += _v.distanceTo(_prev);
      _prev.copy(_v);
    }
    return Math.max(0.5, len);
  }

  _updateHaloCenter() {
    const H = CONFIG.halo;
    this.haloCenter.copy(this.center).addScaledVector(this.forward, -H.back);
    this.haloCenter.y += H.up;
  }

  isHalo(state = this.state) { return state === 'ORBIT' || state === 'SPREAD' || state === 'RETURN'; }

  onArrive(cb) { this._arriveCbs.push(cb); }
  onStateChange(cb) { this._stateCbs.push(cb); }

  setUserRotation(yaw, pitch) { this.userYawT = yaw; this.userPitchT = pitch; }

  setState(state) {
    if (!STATES.includes(state) || state === this.state) return;
    this.state = state;
    this.stateStart = this.time;
    const A = CONFIG.attack;
    // Phóng kiếm theo ĐỢT: xếp kiếm từ vòng ngoài vào vòng trong (bán kính lớn trước),
    // trong cùng vòng xếp theo góc → mỗi đợt là 1 cụm kiếm nằm cạnh nhau.
    // Đợt thứ k phóng sau k × waveInterval giây; mỗi đợt batchSize thanh phóng cùng lúc.
    let waveOf = null;
    const plan = CONFIG.stream.enabled && (state === 'ATTACK' || state === 'URCHIN') ? this._planStreams(state) : null;
    if (state === 'ATTACK' && !plan) {
      const TAU = Math.PI * 2;
      const order = this.swords.filter((s) => !this.isHidden(s)).sort((a, b) => {
        const ra = CONFIG.rings[a.ring].radius, rb = CONFIG.rings[b.ring].radius;
        if (ra !== rb) return rb - ra;
        if (a.ring !== b.ring) return a.ring - b.ring;
        const ang = (s) => ((s.angle0 + this.ringAngles[s.ring]) % TAU + TAU) % TAU;
        return ang(a) - ang(b);
      });
      waveOf = new Map();
      const size = Math.max(1, Math.round(A.batchSize));
      order.forEach((s, rank) => waveOf.set(s, Math.floor(rank / size)));
    }
    for (const s of this.swords) {
      let delay;
      s.nextCurve = null;
      s.loopK = -1; s.lastT = null;
      if (plan) {
        const p = plan.get(s); delay = p.delay; s.nextCurve = p.curve;
        s.laneOff = p.off;
        if (state === 'ATTACK') { s.loopK = p.k; s.loopJ = p.j; }
      }
      else if (state === 'ATTACK') delay = (waveOf.get(s) ?? 0) * A.waveInterval;
      else if (state === 'RETURN') delay = (s.index / this.count) * 0.4;
      else if (state === 'VOLLEY') delay = (s.index % 12) * 0.01;
      else if (state === 'GIANT') delay = (this.giantSlots[s.index].row + this._giantGrid.rows / 2) * 0.06; // dàn từng hàng
      else delay = (s.index % 24) * 0.006; // gợn sóng nhẹ
      s.pending = state;
      s.switchAt = this.time + delay;
    }
    if (state === 'VOLLEY') {
      // thứ tự bắn: vòng ngoài trước, xen kẽ thanh trước / sau → từng loạt bay thẳng tới đối phương
      const V = CONFIG.volley;
      this.enemy.copy(this.attackGoal);
      this.volleyDone = 0;
      const n = this.count, order = this.swords.map((s) => s.index).sort(() => Math.random() - 0.5);
      order.forEach((idx, rank) => {
        const s = this.swords[idx];
        s.vFire = this.time + V.holdTime + Math.floor(rank / Math.max(1, V.batch)) * V.interval;
        s.vFly = null; s.vHit = false;
        s.vSlot = rank; // chỗ trong đội hình (xoắn hướng dương)
      });
      this._vN = n;
    }
    for (const cb of this._stateCbs) cb(state);
  }

  _enter(s, state) {
    s.state = state;
    s.pending = null;
    s.path = null;
    s.prevTarget = null; // đổi trạng thái → đích nhảy chỗ, bỏ qua bù vận tốc 1 khung
    if (state === 'DRAGON') s.lastT = null;
    if (s.nextCurve) {
      // Bắt đầu bay trên dòng: nhớ độ lệch chỗ xuất phát để nhập dần vào dòng
      const c = s.nextCurve;
      s.nextCurve = null;
      if (!c.len) c.len = this._curveLen(c);
      s.path = { c, t: 0, from: s.pos.clone().sub(c.p0) };
      s.arrived = false;
      return;
    }
    if (state === 'ATTACK') {
      s.arrived = false;
      // Bật ngang một lực ngẫu nhiên vuông góc hướng bay → đường bay cong
      _dir.subVectors(this.attackTarget, s.pos).normalize();
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(_dir).normalize();
      s.vel.addScaledVector(_v, CONFIG.attack.launchImpulse).addScaledVector(_dir, CONFIG.attack.launchImpulse * 0.5);
    }
  }

  // Tính vị trí đích của 1 thanh kiếm theo trạng thái của chính nó (lookahead: nhìn trước theo thời gian)
  _computeTarget(s, lookahead = 0) {
    const out = s.target;
    const st = s.state;
    if (st === 'SHIELD') {
      const sl = this.shieldSlots[s.index], Ls = CONFIG.shield.layers[sl.layer];
      const R = (Ls.radius + sl.rOff * (CONFIG.shield.thickness ?? 0)) * this.radiusUser;
      const a = this.shieldAngles[sl.layer] + lookahead * this._shieldSpin(sl.layer);
      out.copy(sl.dir).multiplyScalar(R).applyAxisAngle(UP, a); // góc tăng → mặt trước chạy sang phải
      out.applyQuaternion(this.userQ).add(this.center);
    } else if (st === 'ATTACK' && s.loopK >= 0 && this.streamLoops?.[s.loopK]) {
      // Cụm kiếm bay vòng quanh mục tiêu theo vòng riêng; thanh sau nối đuôi thanh trước trên vòng
      const S = CONFIG.stream, Lp = this.streamLoops[s.loopK];
      const a = Lp.ang - Lp.dir * s.loopJ * (S.speed * Lp.spd * S.gap) / Lp.r;
      const rr = Lp.r * (1 + Lp.rmod * Math.sin(Lp.m * a + Lp.ph));       // bán kính phập phồng
      const b = S.loopWobble * Lp.wob * Math.sin(Lp.f * a + Lp.ph2);       // lượn lên xuống
      out.set(Math.cos(a) * Math.cos(b) * rr, Math.sin(b) * rr, Math.sin(a) * Math.cos(b) * rr)
        .applyQuaternion(Lp.q).add(this.centerAt(this.time - s.loopJ * S.gap, _endD));
      if (s.laneOff) out.add(s.laneOff); // giữ đúng hàng của mình trong bầy
    } else if (st === 'ATTACK') {
      const A = CONFIG.attack;
      const t = this.time + lookahead;
      const dirSign = s.ring % 2 ? 1 : -1;
      const ang = s.index * 2.39996 + t * A.swirlSpeed * dirSign;
      const rad = A.swirlRadius * (0.6 + (s.index % 3) * 0.35);
      out.set(Math.cos(ang) * rad, Math.sin(ang * 0.7 + s.phase) * rad * 0.6, Math.sin(ang) * rad).add(this.attackTarget);
    } else if (st === 'DRAGON') {
      const D = CONFIG.dragon, sl = this.dragonSlots[s.index], now = this.time;
      const bodyT = D.length / Math.max(1, D.speed);              // thời gian đầu bay hết chiều dài thân
      if (sl.head) {
        // ĐẦU: quanh đầu rồng, theo hướng bay
        this._dragonAt(now, _dA); this._dragonAt(now - 0.08, _dB);
        _dT.subVectors(_dA, _dB); if (_dT.lengthSq() < 1e-8) _dT.set(1, 0, 0); _dT.normalize();
        _dN.crossVectors(_dT, UP); if (_dN.lengthSq() < 1e-6) _dN.set(1, 0, 0); _dN.normalize();
        _dBn.crossVectors(_dN, _dT);
        const hs = D.headSize;
        if (sl.kind === 'horn') {         // sừng: chĩa ngược ra sau, vểnh lên
          out.copy(_dA).addScaledVector(_dBn, hs * 0.7).addScaledVector(_dN, sl.side * hs * 0.35).addScaledVector(_dT, -hs * 0.2);
          s.dDir = (s.dDir || new THREE.Vector3()).copy(_dT).multiplyScalar(-1).addScaledVector(_dBn, 0.9).addScaledVector(_dN, sl.side * 0.3).normalize();
        } else if (sl.kind === 'whisker') { // râu: dài, toả ra 2 bên phía trước
          out.copy(_dA).addScaledVector(_dT, hs * 0.5).addScaledVector(_dN, sl.side * hs * 0.4).addScaledVector(_dBn, -hs * 0.2);
          s.dDir = (s.dDir || new THREE.Vector3()).copy(_dN).multiplyScalar(sl.side).addScaledVector(_dT, 0.5).addScaledVector(_dBn, -0.3).normalize();
        } else {                          // mõm / đầu: chóp nhọn về phía trước
          const r = hs * 0.35 * (1 - sl.f * 0.6);
          out.copy(_dA).addScaledVector(_dT, hs * (sl.f * 0.8 - 0.3))
            .addScaledVector(_dN, Math.cos(sl.a) * r).addScaledVector(_dBn, Math.sin(sl.a) * r * 0.8);
          s.dDir = (s.dDir || new THREE.Vector3()).copy(_dT);
        }
      } else if (sl.leg !== undefined) {
        // CHÂN RỒNG: gắn 2 bên thân (2 chân trước gần cổ, 2 chân sau giữa thân), quẫy nhịp khi bay
        const Lg = this.dragonLeg(sl.leg, now, _LEG);
        const { hip, knee, foot, thigh, shin, side } = Lg;
        _dT.copy(Lg.F.T); _dN.copy(Lg.F.N);
        s.dDir = s.dDir || new THREE.Vector3();
        const p = sl.part;
        if (p < 2) { out.copy(hip).lerp(knee, p ? 0.78 : 0.3); s.dDir.copy(thigh); }
        else if (p < 4) { out.copy(knee).lerp(foot, p === 3 ? 0.78 : 0.3); s.dDir.copy(shin); }
        else {
          // 3 móng vuốt xoè ra từ bàn chân, hướng tới trước / xuống
          const c = p - 5; // -1, 0, 1
          s.dDir.copy(shin).addScaledVector(_dT, 0.7).addScaledVector(_dN, side * c * 0.55).normalize();
          out.copy(foot).addScaledVector(s.dDir, D.legLength * 0.12);
        }
      } else {
        // THÂN: vòng vảy quanh sống lưng, thanh kiếm chĩa ra sau + toả ra ngoài như vảy; thon dần về đuôi
        const ts = now - sl.s * bodyT;
        this._dragonAt(ts, _dA); this._dragonAt(ts - 0.06, _dB);
        _dT.subVectors(_dA, _dB); if (_dT.lengthSq() < 1e-8) _dT.set(1, 0, 0); _dT.normalize();
        _dN.crossVectors(_dT, UP); if (_dN.lengthSq() < 1e-6) _dN.set(1, 0, 0); _dN.normalize();
        _dBn.crossVectors(_dN, _dT);
        const r = D.bodyRadius * this.dragonTaper(sl.s); // kiếm nằm sát trên bề mặt khối thân (khối thân = r × meshFit)
        const a = sl.a + sl.s * D.twist;
        _dO.copy(_dN).multiplyScalar(Math.cos(a)).addScaledVector(_dBn, Math.sin(a));
        out.copy(_dA).addScaledVector(_dO, r);
        s.dDir = (s.dDir || new THREE.Vector3()).copy(_dT).multiplyScalar(-1).addScaledVector(_dO, D.scaleOut).normalize();
      }
    } else if (st === 'VOLLEY') {
      // Đội hình quanh nhân vật trên mặt phẳng vuông góc hướng tới đối phương (xoắn hướng dương),
      // thanh chẵn ở PHÍA TRƯỚC nhân vật, thanh lẻ ở PHÍA SAU — xen kẽ
      const V = CONFIG.volley, n = Math.max(1, this._vN || this.count), k = s.vSlot ?? s.index;
      const r = V.inner + (V.radius - V.inner) * Math.sqrt((k + 0.5) / n);
      const a = k * GOLDEN;
      const side = k % 2 ? -V.frontBack : V.frontBack;
      out.copy(this.center).addScaledVector(this._vRight, Math.cos(a) * r).addScaledVector(this._vUp, Math.sin(a) * r * 0.8 + 0.3)
        .addScaledVector(this._vDir, side);
    } else if (st === 'GIANT') {
      const G = CONFIG.giant, sl = this.giantSlots[s.index];
      // đội hình: hàng ngang theo bên phải nhân vật, hàng trước/sau theo hướng mặt nhân vật
      const gx = sl.col * G.spacing, gz = sl.row * G.rowSpacing;
      const bob = Math.sin(this.time * 1.6 + s.phase) * 0.08;
      _v.copy(this.giant.pos).addScaledVector(this._giantRight, gx).addScaledVector(this._giantFwd, gz);
      _v.y = this.center.y + G.formY + sl.jy * G.heightJitter + bob; // ngang / thấp hơn nhân vật một chút
      // chỗ nhập vào thân cự kiếm (cự kiếm chĩa xuống: chuôi ở trên, mũi ở dưới)
      const L = CONFIG.sword.length * G.scale;
      const yLocal = (-0.25 + 0.9 * sl.along) * L;          // dọc thân, từ gần chuôi tới gần mũi
      const half = CONFIG.sword.width * 0.5 * G.scale * 0.6 * (1 - 0.6 * sl.along);
      _gp.copy(this.giant.pos).addScaledVector(DOWN, yLocal).addScaledVector(this._giantRight, sl.side * half);
      const m = this._giantMerge(sl);
      out.copy(_v).lerp(_gp, m * m * (3 - 2 * m));
    } else if (st === 'URCHIN') {
      // Vòng kiếm: chuôi nằm trên vòng tròn bán kính của lớp, thân chĩa thẳng ra ngoài trong mặt phẳng vòng
      // (vị trí thanh = chuôi + 0.3 chiều dài). Các vòng kề nhau xoay ngược chiều nếu bật "alternate".
      const U = CONFIG.urchin, e = this.urchin[s.index];
      const R = (U.radius + e.layer * U.layerGap) * this.radiusUser * (1 + U.pulse * Math.sin(this.time * 3 + s.phase))
        + CONFIG.sword.length * 0.3;
      const dirSign = U.alternate && e.layer % 2 ? -1 : 1;
      const a = e.angle + this.urchinAngles[e.layer] + lookahead * U.spin * dirSign * this.speedMul;
      out.set(Math.cos(a) * R, Math.sin(a) * R, 0).applyQuaternion(this.urchinQ).add(this.urchinCenter);
    } else if (st === 'FORMATION') {
      const F = CONFIG.formation;
      const arm = s.index % F.arms;
      const j = Math.floor(s.index / F.arms);
      const r = F.inner + j * F.step;
      const a = (arm * Math.PI * 2) / F.arms + j * F.twist + this.formationAngle + lookahead * F.spin;
      out.set(r * Math.cos(a), Math.sin(this.time * 2 + j * 0.5) * 0.15 - 0.3, r * Math.sin(a));
      out.applyQuaternion(this.formationTiltQ).applyQuaternion(this.userQ).add(this.center);
    } else {
      // ORBIT / SPREAD / RETURN: kiếm luân — các lớp kiếm trên mặt phẳng sau lưng,
      // mỗi lớp lệch trước/sau (depth) và xoay theo tốc độ riêng
      const ring = CONFIG.rings[s.ring];
      const step = (Math.PI * 2) / ring.count;
      const th = s.angle0 + s.aj * (ring.angleJitter || 0) * step + this.ringAngles[s.ring] + lookahead * ring.speed;
      const R = (ring.radius + s.rj * (ring.radialJitter || 0)) * this.radiusMul * (1 + ring.breathe * Math.sin(this.time * 2 + s.ring * 1.3));
      out.set(R * Math.cos(th), R * Math.sin(th), ring.depth || 0);
      out.applyQuaternion(this.haloQ).applyQuaternion(this.userQ).add(this.haloCenter);
    }
    return out;
  }

  // Lấy ngẫu nhiên 2 thanh kiếm gần nhau để phóng sét giữa chúng
  randomPair() {
    const a = this.randomSword();
    if (!a) return null;
    let b = null;
    if (this.isHalo(a.state)) {
      const nextRing = a.ring + 1;
      if (nextRing < CONFIG.rings.length && Math.random() < 0.35) {
        // Sét nối sang thanh gần nhất ở vòng ngoài kế bên
        let best = Infinity;
        const start = this.ringStart[nextRing];
        for (let k = 0; k < CONFIG.rings[nextRing].count; k++) {
          const c = this.swords[start + k];
          const d = c.pos.distanceToSquared(a.pos);
          if (d < best) { best = d; b = c; }
        }
      } else {
        const ring = CONFIG.rings[a.ring];
        const j = (a.slot + (Math.random() < 0.5 ? 1 : ring.count - 1)) % ring.count;
        b = this.swords[this.ringStart[a.ring] + j];
      }
    } else {
      let best = Infinity;
      for (let k = 0; k < 6; k++) {
        const c = this.swords[(Math.random() * this.count) | 0];
        if (c === a) continue;
        const d = c.pos.distanceToSquared(a.pos);
        if (d < best) { best = d; b = c; }
      }
    }
    if (!b || this.isHidden(b) || a.pos.distanceTo(b.pos) > CONFIG.lightning.maxPairDist) return null;
    return [a.pos, b.pos];
  }

  // Vòng bị ẩn (bảng Thông số → Hiện) thì kiếm của nó ẩn luôn, không có sét/vệt/chấm vàng
  isHidden(s) { return CONFIG.rings[s.ring]?.visible === false; }

  // Lấy ngẫu nhiên 1 thanh đang hiện (thử vài lần; nếu ẩn hết thì trả về null)
  randomSword() {
    for (let k = 0; k < 8; k++) {
      const s = this.swords[(Math.random() * this.count) | 0];
      if (!this.isHidden(s)) return s;
    }
    return null;
  }

  update(dt, camera) {
    this.time += dt;
    // nhân vật quay đầu → mặt phẳng kiếm luân (sau lưng) xoay theo
    this.haloQ.setFromUnitVectors(_hn.set(0, 0, 1), this.forward);
    const sm = this.speedMul;
    CONFIG.rings.forEach((r, i) => { this.ringAngles[i] += r.speed * sm * dt; });
    this.shieldAngles[0] += this._shieldSpin(0) * sm * dt;
    this.shieldAngles[1] += this._shieldSpin(1) * sm * dt;
    this.formationAngle += CONFIG.formation.spin * sm * dt;
    if (this.streamLoops) {
      const S = CONFIG.stream;
      for (const Lp of this.streamLoops) Lp.ang += Lp.dir * (S.speed * S.loopSpeed * Lp.spd * sm * dt) / Lp.r;
    }
    {
      const U = CONFIG.urchin;
      if (`${Math.max(1, Math.round(U.layers))}|${U.radius}|${U.layerGap}` !== this._urchinKey) this._buildUrchin();
      this.urchinAngles.forEach((_, l) => { this.urchinAngles[l] += U.spin * (U.alternate && l % 2 ? -1 : 1) * sm * dt; });
      this._updateUrchinCenter();
      // KIM LONG: đầu rồng bay lượn uốn khúc quanh nhân vật (đường cong 3D nhiều nhịp), ghi lịch sử cho thân bám theo
      {
        const D = CONFIG.dragon, dr = this.dragon;
        if (`${this.count}|${D.ringSize}|${D.legs}` !== this._dragonKey) this._buildDragon();
        dr.t += dt * sm * D.speed / Math.max(1, D.radius);
        const a = dr.t, R = D.radius;
        dr.head.set(
          Math.cos(a) * R + Math.sin(a * 2.3 + 1) * R * 0.25,
          D.height + Math.sin(a * 1.7) * D.wave + Math.sin(a * 3.1 + 2) * D.wave * 0.35,
          Math.sin(a) * R * 0.75 + Math.cos(a * 1.4) * R * 0.3,
        ).add(this.center);
        const H = dr.hist;
        H.push({ t: this.time, p: dr.head.clone() });
        const keep = D.length / Math.max(1, D.speed) + 1;
        while (H.length > 2 && H[1].t < this.time - keep) H.shift();
        dr.k += ((this.state === 'DRAGON' ? 1 : 0) - dr.k) * (1 - Math.exp(-3 * dt));
      }
      // hướng tới đối phương (đối phương đi theo chuột / ngón tay)
      if (this.state === 'VOLLEY') this.enemy.lerp(this.attackGoal, 1 - Math.exp(-8 * dt));
      this._vDir.subVectors(this.enemy, this.center);
      if (this._vDir.lengthSq() < 1e-4) this._vDir.set(0, 0, -1);
      this._vDir.normalize();
      this._vRight.crossVectors(this._vDir, Math.abs(this._vDir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
      this._vUp.crossVectors(this._vRight, this._vDir).normalize();
      // Cự kiếm: phía trước nhân vật, trên cao; hiện dần khi kiếm nhập vào
      const G = CONFIG.giant;
      if (`${this.count}|${G.aspect}` !== this._giantKey) this._buildGiant();
      this._giantFwd.copy(this.forward).setY(0).normalize();
      this._giantRight.crossVectors(this._giantFwd, UP).normalize();
      // hàng nào phía camera thì là hàng "gần"
      this._giantNear = Math.sign(_v.subVectors(camera.position, this.giant.pos).dot(this._giantFwd)) || 1;
      this.giant.pos.copy(this.center).addScaledVector(this._giantFwd, G.distance);
      this.giant.pos.y += G.height;
      let want = 0;
      if (this.state === 'GIANT') {
        const tt = this.time - this.stateStart - G.holdTime;
        want = smooth(G.mergeTime * 0.3, G.mergeTime + G.mergeSpread, tt);
      }
      this.giant.k += (want - this.giant.k) * (1 - Math.exp(-(want > this.giant.k ? 4 : 3) * dt));
      const tt2 = this.time - this.stateStart - G.holdTime - G.mergeTime - G.mergeSpread * 0.6;
      const pop = this.state === 'GIANT' && tt2 > 0 ? G.grow * Math.exp(-tt2 * 2.2) * Math.sin(Math.min(Math.PI, tt2 * 4)) : 0;
      this.giant.scale = G.scale * this.giant.k * (1 + pop);
      this.giant.hidden = this.giant.k < 0.05;
      // Mặt vòng: quay mặt về camera (giống phim) hoặc theo mặt phẳng kiếm luân; xoay theo tay
      if (U.faceCamera) _v.subVectors(camera.position, this.urchinCenter).normalize();
      else _v.set(0, 0, 1).applyQuaternion(this.haloQ);
      _q.setFromUnitVectors(_hn.set(0, 0, 1), _v).premultiply(this.userQ);
      this.urchinQ.slerp(_q, 1 - Math.exp(-3 * dt));
    }

    const kSmooth = 1 - Math.exp(-4 * dt);
    const desiredR = (this.state === 'SPREAD' ? CONFIG.spreadRadiusMul : 1) * this.radiusUser;
    this.radiusMul += (desiredR - this.radiusMul) * kSmooth;
    this.userYaw += (this.userYawT - this.userYaw) * kSmooth;
    this.userPitch += (this.userPitchT - this.userPitch) * kSmooth;
    this.userQ.setFromEuler(_e.set(this.userPitch, this.userYaw, 0));
    this.attackTarget.lerp(this.attackGoal, 1 - Math.exp(-10 * dt));
    {
      // Tâm vòng bay đuổi theo mục tiêu với tốc độ giới hạn (như thanh kiếm dẫn đầu), rồi ghi lịch sử
      const S = CONFIG.stream;
      _v.subVectors(this.attackGoal, this.loopCenter);
      const d = _v.length(), step = Math.min(d, S.speed * S.followSpeed * sm * dt, d * (1 - Math.exp(-6 * dt)) + 0.02);
      if (d > 1e-5) this.loopCenter.addScaledVector(_v, step / d);
      const H = this.hist;
      H.push({ t: this.time, p: this.loopCenter.clone() });
      while (H.length > 2 && H[1].t < this.time - 6) H.shift();
    }
    this._updateHaloCenter();

    if (this.state === 'RETURN' && this.time - this.stateStart > CONFIG.returnDuration) this.setState('ORBIT');
    // bắn xong hết → dừng một chút rồi tự thu kiếm về
    if (this.state === 'VOLLEY' && this.volleyDone >= this.count) {
      this._vEnd ??= this.time;
      if (this.time - this._vEnd > CONFIG.volley.linger) { this._vEnd = null; this.setState('RETURN'); }
    } else this._vEnd = null;

    const camDistCenter = camera.position.distanceTo(this.center);
    const slerpK = 1 - Math.exp(-14 * dt);
    // Pháp tuyến mặt phẳng kiếm luân (đã tính cả xoay theo tay)
    const haloN = _hn.set(0, 0, 1).applyQuaternion(this.haloQ).applyQuaternion(this.userQ);
    const maxSp = CONFIG.maxSpeed;

    for (const s of this.swords) {
      if (s.pending && this.time >= s.switchAt) this._enter(s, s.pending);
      this._computeTarget(s);

      if (s.path) {
        // BAY NỐI ĐUÔI: đi theo đường cong chung của dòng; đầu đường nhập dần vào dòng,
        // cuối đường (vòng kiếm) tách dần về đúng chỗ của mình
        const P = s.path, c = P.c, S = CONFIG.stream;
        P.t += (S.speed * sm * dt) / c.len;
        const u = Math.min(1, P.t);
        _prev.copy(s.pos);
        // Phóng kiếm: đích của thanh j = tâm vòng bay của j×gap giây trước → cả dòng đi đúng 1 đường
        const endV = s.loopK >= 0 ? this.centerAt(this.time - s.loopJ * S.gap, _endD2) : c.end;
        bezier(s.pos, c.p0, c.p1, _uc.copy(endV).add(c.off2), endV, u);
        s.pos.addScaledVector(P.from, 1 - smooth(0, S.merge, u));
        if (c.wave) s.pos.addScaledVector(c.wave.v, c.wave.amp * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * c.wave.n * u));
        // tách ra hàng của mình khi đang bay (cuối đường thì chỗ đích đã có sẵn độ lệch hàng)
        if (s.laneOff) s.pos.addScaledVector(s.laneOff, smooth(0, S.merge, u) * (1 - smooth(1 - S.merge, 1, u)));
        // cuối đường: tách dần về chỗ riêng (chỗ trên vòng kiếm / chỗ trên vòng bay của cụm)
        if (s.state === 'URCHIN' || s.loopK >= 0) s.pos.addScaledVector(_slot.subVectors(s.target, endV), smooth(1 - S.merge, 1, u));
        s.vel.subVectors(s.pos, _prev).divideScalar(Math.max(dt, 1e-4));
        if (u >= 1) {
          s.path = null; s.prevTarget = null; // tới nơi → lò xo giữ tiếp (cụm bay vòng quanh mục tiêu / giữ chỗ trên vòng kiếm)
          if (s.state === 'ATTACK') {
            if (!s.arrived) { s.arrived = true; for (const cb of this._arriveCbs) cb(s); }
          } else s.vel.setLength(Math.min(s.vel.length(), 6));
        }
      } else if (s.state === 'DRAGON') {
        // bám theo chỗ của mình trên thân rồng (bù chuyển động + kéo dần về chỗ) → thân rồng liền mạch
        _prev.copy(s.pos);
        if (s.lastT) s.pos.add(_slot.subVectors(s.target, s.lastT));
        else s.lastT = new THREE.Vector3();
        s.pos.lerp(s.target, 1 - Math.exp(-CONFIG.dragon.gather * dt));
        s.lastT.copy(s.target);
        s.vel.subVectors(s.pos, _prev).divideScalar(Math.max(dt, 1e-4));
      } else if (s.state === 'VOLLEY' && this.time >= (s.vFire ?? Infinity)) {
        // BAY THẲNG tới đối phương (tăng tốc dần), tới nơi thì cắm lại đó
        const V = CONFIG.volley;
        if (!s.vFly) {
          const to = this.enemy.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(V.hitSpread));
          s.vFly = { from: s.pos.clone(), to, t: 0, len: Math.max(0.5, s.pos.distanceTo(to)) };
        }
        const F = s.vFly;
        _prev.copy(s.pos);
        F.t = Math.min(1, F.t + (V.speed * sm * dt) / F.len);
        const e = F.t * F.t * (1.6 - 0.6 * F.t);            // nhanh dần
        s.pos.lerpVectors(F.from, F.to, e);
        s.vel.subVectors(s.pos, _prev).divideScalar(Math.max(dt, 1e-4));
        if (F.t >= 1 && !s.vHit) {
          s.vHit = true; this.volleyDone++;
          for (const cb of this._arriveCbs) cb(s);
        }
        if (s.vHit) s.vel.set(0, 0, 0);
      } else if (s.state === 'ATTACK' && s.loopK >= 0) {
        // Cụm bay vòng: bám theo chuyển động của chỗ mình trên vòng (không trễ như lò xo) + kéo dần về đúng chỗ
        _prev.copy(s.pos);
        if (s.lastT) s.pos.add(_slot.subVectors(s.target, s.lastT));
        else s.lastT = new THREE.Vector3();
        s.pos.lerp(s.target, 1 - Math.exp(-5 * dt));
        s.lastT.copy(s.target);
        s.vel.subVectors(s.pos, _prev).divideScalar(Math.max(dt, 1e-4));
      } else {
        // Lò xo có hãm + BÙ VẬN TỐC ĐÍCH: a = k(đích − p) + c(v_đích − v)
        // → kiếm bám đúng chỗ của mình kể cả khi vòng rất lớn / xoay nhanh (không bị trễ phía sau,
        //   nên vẫn được coi là "đã vào chỗ" và mũi chĩa đúng ra ngoài thay vì nằm ngang theo hướng bay)
        const sp = CONFIG.springs[s.state];
        _tv.set(0, 0, 0);
        if (s.prevTarget && s.state !== 'ATTACK') {
          _tv.subVectors(s.target, s.prevTarget).divideScalar(Math.max(dt, 1e-4));
          if (_tv.lengthSq() > maxSp * maxSp) _tv.setLength(maxSp);
        }
        (s.prevTarget ??= new THREE.Vector3()).copy(s.target);
        _acc.subVectors(s.target, s.pos).multiplyScalar(sp.k).addScaledVector(_tv.sub(s.vel), sp.c);
        s.vel.addScaledVector(_acc, dt);
        if (s.vel.lengthSq() > maxSp * maxSp) s.vel.setLength(maxSp);
        s.pos.addScaledVector(s.vel, dt);
      }

      // Hướng mũi kiếm: ở kiếm luân (đã về gần vị trí) thì chĩa ra ngoài từ tâm,
      // chuôi quay vào nhân vật; còn lại thì mũi kiếm hướng theo vận tốc bay
      const v2 = s.vel.lengthSq();
      const near = s.pos.distanceToSquared(s.target) < 1.0;
      if (this.isHalo(s.state) && near) {
        // Chĩa thẳng ra từ tâm CỦA CHÍNH VÒNG: bỏ phần lệch trước/sau (theo pháp tuyến mặt trận)
        // → kiếm luôn nằm phẳng trong mặt vòng, không bị xỉa chéo khi vòng đẩy ra trước/sau.
        _dir.subVectors(s.target, this.haloCenter);
        _dir.addScaledVector(haloN, -_dir.dot(haloN)).normalize();
        _q.setFromUnitVectors(UP, _dir);
        s.quat.slerp(_q, slerpK);
      } else if (s.state === 'DRAGON' && s.dDir) {
        _q.setFromUnitVectors(UP, s.dDir);
        s.quat.slerp(_q, slerpK);
      } else if (s.state === 'VOLLEY') {
        // mũi kiếm chĩa thẳng về phía đối phương (cả lúc chờ lẫn lúc bay)
        if (s.vFly) _dir.subVectors(s.vFly.to, s.vFly.from).normalize();
        else _dir.subVectors(this.enemy, s.pos).normalize();
        _q.setFromUnitVectors(UP, _dir);
        s.quat.slerp(_q, slerpK);
      } else if (s.state === 'GIANT') {
        // Cự kiếm: mọi thanh chĩa mũi xuống đất (đi theo hướng cự kiếm)
        _q.setFromUnitVectors(UP, DOWN);
        s.quat.slerp(_q, slerpK * 0.6);
      } else if (s.state === 'URCHIN' && !s.path && near) {
        // Vòng kiếm: mũi chĩa thẳng ra từ tâm vòng
        _dir.subVectors(s.target, this.urchinCenter).normalize();
        _q.setFromUnitVectors(UP, _dir);
        s.quat.slerp(_q, slerpK);
      } else if (s.state === 'SHIELD' && near) {
        // Kiếm thuẫn: mũi kiếm nằm NGANG theo chiều chạy trên dải của mình (nối đuôi nhau)
        const sl = this.shieldSlots[s.index];
        _v.copy(sl.dir).applyAxisAngle(UP, this.shieldAngles[sl.layer]);
        _dir.set(_v.z, 0, -_v.x);                                   // tiếp tuyến chiều quay quanh trục đứng
        if (_dir.lengthSq() < 1e-6) _dir.set(1, 0, 0);              // đúng tại đỉnh
        _dir.applyQuaternion(this.userQ).normalize().multiplyScalar(Math.sign(this._shieldSpin(sl.layer)) || 1);
        _q.setFromUnitVectors(UP, _dir);
        s.quat.slerp(_q, slerpK);
      } else if (v2 > 0.04) {
        _dir.copy(s.vel).divideScalar(Math.sqrt(v2));
        _q.setFromUnitVectors(UP, _dir);
        s.quat.slerp(_q, slerpK);
      }

      if (s.state === 'ATTACK' && !s.arrived && s.pos.distanceTo(this.attackTarget) < 1.0) {
        s.arrived = true;
        for (const cb of this._arriveCbs) cb(s);
      }

      // Viền vàng: thanh đã vào chỗ trên vòng kiếm thì viền lưỡi chuyển dần sang vàng
      // Chỉ các VÒNG BÊN TRONG mới vàng (ánh sáng trận pháp ở tâm chiếu vào); vòng ngoài giữ xanh
      const UG = CONFIG.urchin;
      const inner = s.state === 'URCHIN' && this.urchin[s.index].layer < UG.goldRings;
      const wantGold = (UG.goldEdge && inner && !s.path && near) || (s.state === 'DRAGON' && CONFIG.dragon.gold) ? 1 : 0; // rồng: viền lưỡi vàng
      this.edgeGold[s.index] += (wantGold - this.edgeGold[s.index]) * (1 - Math.exp(-3 * dt));

      // Phi kiếm (phóng / tụ vòng): vàng đủ cả cán tròn + tay cầm + núm.
      // Đang xoay (kiếm luân...): chỉ viền vàng cán tròn nếu vòng đó bật "goldRim".
      const flying = s.state === 'ATTACK' || s.state === 'URCHIN' || s.state === 'GIANT' || s.state === 'VOLLEY' || s.state === 'DRAGON';
      const wantAcc = flying || CONFIG.rings[s.ring].goldRim ? 1 : 0;
      const kA = 1 - Math.exp(-6 * dt);
      this.accent[s.index] += (wantAcc - this.accent[s.index]) * kA;
      this.grip[s.index] += ((flying ? 1 : 0) - this.grip[s.index]) * kA;

      const hidden = this.isHidden(s);
      // Cỡ kiếm: cỡ chung đàn kiếm × cỡ riêng của vòng (chỉnh trong ⚔ Kiếm luân), đổi mượt
      // Cỡ kiếm: kiếm luân dùng cỡ từng vòng; kiếm thuẫn / phóng kiếm / tụ vòng dùng CỠ RIÊNG
      // (không theo cỡ phóng to của vòng, để dòng kiếm và quả cầu không bị rối vì kiếm quá dài)
      const sws = CONFIG.sword.swarmScale ?? 1;
      const wantScale = s.state === 'SHIELD' ? sws * (CONFIG.shield.swordScale ?? 1) * this.shieldSlots[s.index].k
        : s.state === 'GIANT' ? sws * (CONFIG.giant.swordScale ?? 1) * this._giantDepthK(this.giantSlots[s.index])
          * (1 - smooth(0.75, 1, this._giantMerge(this.giantSlots[s.index]))) // gần to xa nhỏ; nhập xong thì tan vào cự kiếm
        : s.state === 'DRAGON' ? sws * CONFIG.dragon.swordScale * (this.dragonSlots[s.index].head && this.dragonSlots[s.index].kind !== 'snout' ? 1.5 : this.dragonSlots[s.index].leg !== undefined ? (this.dragonSlots[s.index].part >= 4 ? 0.6 : 0.9) : 1)
        : s.state === 'ATTACK' || s.state === 'URCHIN' || s.state === 'VOLLEY' ? sws * (CONFIG.attack.swordScale ?? 1)
        : sws * (CONFIG.rings[s.ring].scale ?? 1);
      s.scale += (wantScale - s.scale) * (1 - Math.exp(-8 * dt));
      _m.compose(s.pos, s.quat, hidden ? _zero : _sc.setScalar(s.scale)); // ẩn = thu nhỏ về 0 (thân ngoài + hào quang dùng chung ma trận nên ẩn theo)
      this.mesh.setMatrixAt(s.index, _m);

      // Gần camera → sáng hơn
      const d = camera.position.distanceTo(s.pos);
      const f = THREE.MathUtils.clamp(0.5 + (camDistCenter - d) / 10, 0, 1);
      let b = 0.65 + CONFIG.sword.nearBoost * f + (s.state === 'ATTACK' ? 0.35 : 0);
      // Đang mở thư mục chỉnh 1 vòng trong bảng Thông số → vòng đó sáng lên, các vòng khác mờ đi
      const focus = CONFIG.ui.focusRing;
      if (focus >= 0) b *= s.ring === focus ? 1.8 : 0.3;
      this.mesh.setColorAt(s.index, _c.setRGB(b, b, b));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aAccent.needsUpdate = true;
    this.mesh.geometry.attributes.aGrip.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
