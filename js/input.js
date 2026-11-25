// Đổi cử chỉ tay / bàn phím / chuột thành lệnh cho đàn kiếm và camera
import * as THREE from 'three';
import { CONFIG } from './config.js';

const KEY_STATES = { Digit1: 'ORBIT', Digit2: 'SPREAD', Digit3: 'SHIELD', Digit4: 'ATTACK', Digit5: 'FORMATION', Digit6: 'RETURN', Digit7: 'URCHIN', Digit8: 'GIANT', Digit9: 'VOLLEY', Digit0: 'DRAGON' };
// Phím số bên bàn phím số (numpad) dùng y như hàng số trên
for (const k of Object.keys(KEY_STATES)) KEY_STATES['Numpad' + k.slice(5)] = KEY_STATES[k];
const GESTURE_STATES = { Open_Palm: 'SPREAD', Closed_Fist: 'SHIELD', Pointing_Up: 'ATTACK' };

const mapRange = (v, [a, b], [c, d]) => c + (d - c) * THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
const _ndc = new THREE.Vector2();
const _off = new THREE.Vector3();
const _n = new THREE.Vector3();
const _fwd = new THREE.Vector3(), _rgt = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);

export class InputManager {
  constructor({ swarm, lightning, sparks, camera, controls, canvas, hero, gesture, ui }) {
    Object.assign(this, { swarm, lightning, sparks, camera, controls, hero, gesture, ui });
    this.source = 'keyboard';
    this.mouseNdc = new THREE.Vector2();
    this.mouseMoved = false;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane();

    addEventListener('keydown', (e) => this.onKey(e));
    // phím đang giữ (để bay liên tục)
    this.held = new Set();
    addEventListener('keydown', (e) => { if (!e.target.closest?.('.lil-gui input')) this.held.add(e.code); });
    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => this.held.clear());
    canvas.addEventListener('pointermove', (e) => {
      this.mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.mouseMoved = true;
    });
    gesture.onGesture((name) => this.onGesture(name));
  }

  onKey(e) {
    if (e.target.closest?.('.lil-gui') || e.repeat) return;
    const S = CONFIG.speed;
    if (KEY_STATES[e.code]) { this.source = 'keyboard'; this.command(KEY_STATES[e.code]); return; }
    switch (e.code) {
      case 'Equal': case 'NumpadAdd': this.swarm.speedMul = Math.min(S.max, this.swarm.speedMul + S.keyStep); break;
      case 'Minus': case 'NumpadSubtract': this.swarm.speedMul = Math.max(S.min, this.swarm.speedMul - S.keyStep); break;
      case 'KeyL': this.burst(); break;
      case 'KeyT': CONFIG.trail.enabled = !CONFIG.trail.enabled; break;
      case 'KeyH': this.ui.toggleHelp(); break;
      case 'KeyG': this.ui.toggleGui(); break;
      case 'KeyC': this.ui.toggleCamera(); break;
      case 'Space': e.preventDefault(); this.swarm.speedMul = 1; this.command('ORBIT'); break;
    }
  }

  command(state) {
    if ((state === 'ATTACK' || state === 'VOLLEY') && this.source !== 'gesture' && this.mouseMoved) this._setAttackFromNdc(this.mouseNdc);
    this.swarm.setState(state);
    if (state === 'FORMATION' || state === 'URCHIN') this.burst();
  }

  burst() {
    this.lightning.burst(this.hero.center, this.swarm);
    this.sparks.spawn(this.hero.center, 40, CONFIG.colors.spark, 7);
  }

  onGesture(name) {
    if (GESTURE_STATES[name]) { this.source = 'gesture'; this.command(GESTURE_STATES[name]); return; }
    // Chữ V: tụ vòng kiếm hoặc kiếm trận xoắn (chọn trong bảng Thông số)
    if (name === 'Victory') { this.source = 'gesture'; this.command(CONFIG.gesture.victoryState || 'URCHIN'); return; }
    if (name === 'ILoveYou') { this.source = 'gesture'; this.swarm.speedMul = 1; this.command('ORBIT'); return; }
    if ((name === 'None' || name === 'NoHand') && this.source === 'gesture') {
      const st = this.swarm.state;
      if (st === 'ATTACK') this.command('RETURN');
      else if (st !== 'ORBIT' && st !== 'RETURN') this.command('ORBIT');
    }
  }

  // Chiếu toạ độ màn hình lên mặt phẳng đi qua nhân vật, vuông góc hướng nhìn camera
  _setAttackFromNdc(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    this.camera.getWorldDirection(_n).negate();
    this.plane.setFromNormalAndCoplanarPoint(_n, this.hero.center);
    this.raycaster.ray.intersectPlane(this.plane, this.swarm.attackGoal);
  }

  // Hướng bay từ phím đang giữ: tới/lui theo hướng camera nhìn (bỏ phần lên xuống), trái/phải vuông góc
  flyVector(out) {
    const H = this.held, F = CONFIG.heroFly;
    const f = (H.has('KeyW') || H.has('ArrowUp') ? 1 : 0) - (H.has('KeyS') || H.has('ArrowDown') ? 1 : 0);
    const r = (H.has('KeyD') || H.has('ArrowRight') ? 1 : 0) - (H.has('KeyA') || H.has('ArrowLeft') ? 1 : 0);
    const u = (H.has('KeyR') || H.has('PageUp') ? 1 : 0) - (H.has('KeyF') || H.has('PageDown') ? 1 : 0);
    this.camera.getWorldDirection(_fwd); _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _rgt.crossVectors(_fwd, _UP).normalize();
    const sp = F.speed * (H.has('ShiftLeft') || H.has('ShiftRight') ? F.boost : 1);
    out.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_rgt, r);
    if (out.lengthSq() > 1) out.normalize();
    out.multiplyScalar(sp);
    out.y = u * F.vertical * (H.has('ShiftLeft') || H.has('ShiftRight') ? F.boost : 1);
    return out;
  }

  update(dt) {
    const G = CONFIG.gesture, S = CONFIG.speed, swarm = this.swarm;
    const gs = this.gesture.ready ? this.gesture.state : null;
    // Chống bắt nhầm tay: phải thấy tay LIÊN TỤC handHold giây mới tính là đang điều khiển
    const seen = !!(gs && gs.hands > 0);
    this.handT = seen ? (this.handT || 0) + dt : 0;
    this.idleT = seen ? 0 : (this.idleT || 0) + dt;
    // Không có tay một lúc → tốc độ xoay tự trở về mặc định (lỡ bị nhận nhầm 👎 làm kiếm gần như đứng yên)
    if (this.idleT > G.idleReset && this.source === 'gesture') {
      swarm.speedMul += ((S.default ?? 1) - swarm.speedMul) * (1 - Math.exp(-1.5 * dt));
    }
    if (seen && this.handT >= G.handHold) {
      if (swarm.state === 'ATTACK' || swarm.state === 'VOLLEY') {
        this._setAttackFromNdc(_ndc.set(gs.pointer.x * 2 - 1, -(gs.pointer.y * 2 - 1)));
      } else if (G.handTilt) {
        swarm.setUserRotation((gs.palm.x - 0.5) * 2 * G.yawRange, (gs.palm.y - 0.5) * 2 * G.pitchRange);
      } else swarm.setUserRotation(0, 0);
      // Tay thả lỏng ở ORBIT: khoảng cách ngón cái–trỏ chỉnh bán kính vòng kiếm
      swarm.radiusUser = G.handTilt && gs.gesture === 'None' && swarm.state === 'ORBIT' ? mapRange(gs.pinch, G.pinchRange, G.radiusRange) : 1;
      if (gs.gesture === 'Thumb_Up') swarm.speedMul = Math.min(S.max, swarm.speedMul + S.gestureRate * dt);
      if (gs.gesture === 'Thumb_Down') swarm.speedMul = Math.max(S.min, swarm.speedMul - S.gestureRate * dt);
      // Hai tay: khoảng cách hai bàn tay → zoom camera
      if (gs.twoHandDist != null) {
        const want = mapRange(gs.twoHandDist, G.twoHandRange, G.zoomRange);
        _off.subVectors(this.camera.position, this.controls.target);
        _off.setLength(THREE.MathUtils.lerp(_off.length(), want, 1 - Math.exp(-4 * dt)));
        this.camera.position.copy(this.controls.target).add(_off);
      }
    } else {
      swarm.setUserRotation(0, 0);
      swarm.radiusUser = 1;
      if ((swarm.state === 'ATTACK' || swarm.state === 'VOLLEY') && this.source !== 'gesture' && this.mouseMoved) this._setAttackFromNdc(this.mouseNdc);
    }
  }
}
