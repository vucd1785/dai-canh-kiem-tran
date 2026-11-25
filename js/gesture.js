// Giai đoạn 5: đọc webcam → MediaPipe GestureRecognizer → cử chỉ ổn định + toạ độ đã làm mượt
import { CONFIG } from './config.js';

// One Euro filter: đứng yên thì lọc mạnh (hết rung), di chuyển nhanh thì lọc nhẹ (ít trễ)
class OneEuro {
  constructor(minCutoff, beta, dCutoff = 1) {
    Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: 0, t: 0 });
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x, t) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class GestureController {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.ready = false;
    this.lastVideoTime = -1;
    const S = CONFIG.gesture.smoothing;
    this.f = Array.from({ length: 4 }, () => new OneEuro(S.minCutoff, S.beta));
    this.state = {
      hands: 0, gesture: 'NoHand', rawGesture: 'None', score: 0,
      pointer: { x: 0.5, y: 0.5 }, palm: { x: 0.5, y: 0.5 }, pinch: 1, twoHandDist: null,
    };
    this.candidate = 'None'; this.candidateFrames = 0; this.candidateStart = 0; this.lastSeen = 0;
    this._cbs = [];
  }

  onGesture(cb) { this._cbs.push(cb); }
  _emit(name) { for (const cb of this._cbs) cb(name); }

  async start(onStatus = () => {}) {
    const G = CONFIG.gesture;
    // Model chỉ tải 1 lần; tắt rồi bật lại camera sẽ dùng lại → bật lại rất nhanh
    if (!this.recognizer) {
      onStatus('Đang tải MediaPipe…');
      const { FilesetResolver, GestureRecognizer, DrawingUtils } = await import(G.moduleUrl);
      const fileset = await FilesetResolver.forVisionTasks(G.wasmUrl);
      const make = (delegate) => GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: G.modelUrl, delegate },
        runningMode: 'VIDEO',
        numHands: G.numHands,
      });
      try { this.recognizer = await make('GPU'); }
      catch (e) { console.warn('GPU delegate lỗi, chuyển sang CPU', e); this.recognizer = await make('CPU'); }
      this.drawer = new DrawingUtils(this.ctx);
      this.connections = GestureRecognizer.HAND_CONNECTIONS;
    }

    onStatus('Đang mở camera…');
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.overlay.width = this.video.videoWidth;
    this.overlay.height = this.video.videoHeight;
    this.lastVideoTime = -1;
    this.ready = true;
    onStatus('Camera đã bật ✓');
  }

  // Tắt camera: dừng hẳn webcam (đèn camera tắt), xoá hình tay, coi như không còn tay
  stop() {
    this.ready = false;
    if (this.stream) for (const tr of this.stream.getTracks()) tr.stop();
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const st = this.state;
    st.hands = 0; st.twoHandDist = null; st.rawGesture = 'None'; st.score = 0;
    this.candidate = 'None'; this.candidateFrames = 0;
    if (st.gesture !== 'NoHand') { st.gesture = 'NoHand'; this._emit('NoHand'); }
  }

  // Gọi mỗi khung hình. Chỉ chạy nhận diện khi camera có khung hình mới.
  update(nowMs) {
    if (!this.ready || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    const res = this.recognizer.recognizeForVideo(this.video, nowMs);
    this._process(res, nowMs / 1000);
    this._draw(res);
  }

  _process(res, t) {
    const G = CONFIG.gesture, st = this.state;
    st.hands = res.landmarks.length;
    if (st.hands === 0) {
      st.twoHandDist = null;
      if (t - this.lastSeen > G.lostTimeout && st.gesture !== 'NoHand') {
        st.gesture = 'NoHand';
        this.candidate = 'None'; this.candidateFrames = 0;
        this._emit('NoHand');
      }
      return;
    }
    this.lastSeen = t;
    const lm = res.landmarks[0];
    const top = res.gestures[0]?.[0];
    let name = top?.categoryName || 'None';
    st.score = top?.score || 0;
    if (st.score < G.minScore) name = 'None';
    st.rawGesture = name;

    // Chống nhận nhầm: phải giữ ổn định N khung hình (None thì phải giữ lâu hơn)
    if (name === this.candidate) this.candidateFrames++;
    else { this.candidate = name; this.candidateFrames = 1; this.candidateStart = t; }
    const held = name === 'None' ? t - this.candidateStart >= G.noneHoldTime : this.candidateFrames >= G.stableFrames;
    if (held && name !== st.gesture) { st.gesture = name; this._emit(name); }

    // Toạ độ: lật trục x (camera trước như soi gương), rồi làm mượt
    st.pointer.x = this.f[0].filter(1 - lm[8].x, t);
    st.pointer.y = this.f[1].filter(lm[8].y, t);
    const ids = [0, 5, 9, 13, 17];
    let px = 0, py = 0;
    for (const i of ids) { px += lm[i].x; py += lm[i].y; }
    st.palm.x = this.f[2].filter(1 - px / ids.length, t);
    st.palm.y = this.f[3].filter(py / ids.length, t);
    st.pinch = dist2(lm[4], lm[8]) / Math.max(1e-3, dist2(lm[0], lm[9]));
    st.twoHandDist = st.hands >= 2 ? dist2(res.landmarks[0][9], res.landmarks[1][9]) : null;
  }

  _draw(res) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    for (const lm of res.landmarks) {
      this.drawer.drawConnectors(lm, this.connections, { color: '#3dffb0', lineWidth: 3 });
      this.drawer.drawLandmarks(lm, { color: '#ffd76a', lineWidth: 1, radius: 3 });
    }
  }
}
