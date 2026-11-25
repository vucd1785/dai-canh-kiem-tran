// Điểm khởi đầu: ghép các phần lại và chạy vòng lặp chính
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from './config.js';
import { setQuality } from './presets.js';
import { createWorld, softDotTexture } from './scene.js';
import { createSwordGeometry, createSwordMaterial, createShellGeometry, createShellMaterial } from './sword.js';
import { HiltDust } from './effects/hiltdust.js';
import { BladeArcs } from './effects/bladearcs.js';
import { buildPanel } from './panel.js';
import { createHero } from './hero.js';
import { HeroPhoto } from './herophoto.js';
import { GlyphPhoto } from './glyphphoto.js';
import { Swarm } from './swarm.js';
import { Trails } from './effects/trail.js';
import { Lightning } from './effects/lightning.js';
import { Sparks } from './effects/sparks.js';
import { RuneDisc, makeGlyphTexture } from './effects/rune.js';
import { DragonBody } from './effects/dragonBody.js';
import { GestureController } from './gesture.js';
import { InputManager } from './input.js';

const STATE_LABEL = {
  ORBIT: 'Kiếm luân sau lưng', SPREAD: 'Tung kiếm', SHIELD: 'Kiếm thuẫn hộ thân',
  ATTACK: 'Phóng kiếm', RETURN: 'Thu kiếm', FORMATION: 'Kiếm trận', URCHIN: 'Tụ vòng kiếm', GIANT: 'Cự kiếm', VOLLEY: 'Bắn kiếm', DRAGON: 'Kim long',
};
const $ = (id) => document.getElementById(id);

// --- Renderer ---
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.view.exposure ?? 1; // độ sáng chung (chỉnh trong 🌄 Cảnh)

// --- Thế giới ---
const world = createWorld();
const { scene, camera } = world;
const swordGeo = createSwordGeometry();
const swordMat = createSwordMaterial({ accent: 0 });            // kiếm nhỏ phù văn: luôn xoay → không vòng vàng
// đàn kiếm: viền vàng cán tròn (aAccent) + vàng tay cầm/núm (aGrip) điều khiển riêng từng thanh
const swarmSwordMat = createSwordMaterial({ accent: 'instance', grip: 'instance' });
const heroSwordMat = createSwordMaterial({ accent: 1 });
// kiếm nhỏ phù văn: CHỈ viền vàng quanh đĩa chắn (cán tròn) bật/tắt theo từng lớp, tay cầm + núm không vàng
const runeSwordMat = createSwordMaterial({ accent: 'instance', grip: 0 });
const shellGeo = createShellGeometry();   // thân kiếm thẳng trong suốt bên ngoài lõi trúc
const shellMat = createShellMaterial();
// Bản riêng cho thân kiếm của đàn kiếm: đọc thêm độ vàng viền từng thanh (dùng chung uniform với bản gốc)
const swarmShellMat = shellMat.clone();
swarmShellMat.uniforms = shellMat.uniforms;
swarmShellMat.defines = { EDGE_GOLD: '' };
const hero = createHero(swordGeo, heroSwordMat, shellGeo, shellMat);
scene.add(hero.root);
hero.update(0, 0);
const heroPhoto = new HeroPhoto(hero); // ảnh nhân vật thật (nếu đã chọn)
heroPhoto.init();
const glyphPhoto = new GlyphPhoto(); // ảnh chữ phù văn của người dùng (nếu đã chọn)
glyphPhoto.init();
const lightning = new Lightning(scene);
// Bộ sét riêng: NHIỀU tia nhỏ trên lưỡi từng thanh kiếm (ít đoạn để nhẹ máy)
// Sét cực mỏng dọc lưỡi (mũi → cán): 1 bộ cho kiếm luân, 1 bộ riêng cho kiếm nhỏ phù văn
const bladeArcs = new BladeArcs(scene, {
  getCfg: () => CONFIG.lightning.bladeArcs,
  isHidden: (s) => CONFIG.rings[s.ring]?.visible === false,
});
const runeArcs = new BladeArcs(scene, { getCfg: () => CONFIG.rune.arcs, isHidden: (s) => s.hidden });
// CỰ KIẾM: 1 thanh kiếm khổng lồ (dùng chung hình phi kiếm) + sét nhỏ bám lưỡi + sét lớn văng ra xung quanh
const giantArcs = new BladeArcs(scene, { getCfg: () => CONFIG.giant.arcs, isHidden: (s) => s.hidden });
const giantSword = new THREE.Group();
// lõi cự kiếm: vật liệu riêng, PHÁT SÁNG mạnh (độ sáng chỉnh trong bảng)
const giantCoreMat = createSwordMaterial({ accent: 1 });
giantSword.add(new THREE.Mesh(swordGeo, giantCoreMat));
// PHÙ VĂN vàng khắc dọc lưỡi cự kiếm (2 mặt lưỡi), từ gần chuôi xuống phía mũi
const giantGlyphs = [];
{
  const tex = makeGlyphTexture(), Ls = CONFIG.sword.length, W = CONFIG.sword.width;
  const z = W * 0.5 * CONFIG.sword.shellFlat * 1.02;
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: CONFIG.colors.edgeGold, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, toneMapped: false, fog: false }); // mỗi mặt chỉ thấy từ phía mình (không lộ chữ ngược qua thân)
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.position.z = z * side;
      m.rotation.set(0, side < 0 ? Math.PI : 0, Math.PI); // cự kiếm chĩa xuống → xoay chữ 180° cho đọc thuận chiều
      m.renderOrder = 5;
      giantSword.add(m);
      giantGlyphs.push({ mesh: m, i });
    }
  }
}
// sét chạy DỌC LÕI cự kiếm (kiểu dài mũi → cán, bám sát lõi)
const giantCoreArcs = new BladeArcs(scene, { getCfg: () => CONFIG.giant.coreArcs, isHidden: (s) => s.hidden });
// thân ngoài cự kiếm: bản riêng của vật liệu thân kiếm, viền lưỡi VÀNG
const giantShellMat = shellMat.clone();
giantShellMat.uniforms.edgeColor.value.set(CONFIG.colors.edgeGold);
giantShellMat.uniforms.edgeIntensity.value = 1.3;
const giantShell = new THREE.Mesh(shellGeo, giantShellMat);
giantShell.renderOrder = 3;
giantSword.add(giantShell);
giantSword.visible = false;
scene.add(giantSword);
const giantLight = new THREE.PointLight(0xffd27a, 0, 14, 1.4);
scene.add(giantLight);
// Camera tự tiến lại gần cự kiếm (và lùi về chỗ cũ khi thôi)
const camSave = { pos: new THREE.Vector3(), target: new THREE.Vector3(), saved: false };
let camAutoT = 0, camAutoMode = 0; // 1 = đang tiến vào, -1 = đang lùi về
// PHI KIẾM RA XA: kiếm sắp ra khỏi màn hình → camera tự lùi ra + dịch theo bầy kiếm (thôi phóng thì về chỗ cũ)
const follow = { saved: false, pos: new THREE.Vector3(), target: new THREE.Vector3(), back: 0 };
const _fC = new THREE.Vector3(), _fP = new THREE.Vector3(), _fT = new THREE.Vector3(), _fO = new THREE.Vector3();
function updateCamFollow(dt) {
  const F = CONFIG.camFollow;
  const flying = F.enabled && swarm.state === 'ATTACK';
  if (flying) {
    if (!follow.saved) { follow.pos.copy(camera.position); follow.target.copy(controls.target); follow.saved = true; }
    follow.back = 0;
    // phạm vi bầy kiếm trên màn hình (lấy mẫu) + trọng tâm
    let ext = 0, n = 0;
    _fC.set(0, 0, 0);
    for (let i = 0; i < swarm.swords.length; i += 3) {
      const s = swarm.swords[i];
      if (swarm.isHidden(s)) continue;
      _fC.add(s.pos); n++;
      _fP.copy(s.pos).project(camera);
      if (_fP.z < 1) ext = Math.max(ext, Math.abs(_fP.x), Math.abs(_fP.y));
      else ext = Math.max(ext, 1.5); // ra sau camera
    }
    if (!n) return;
    _fC.divideScalar(n);
    // tâm nhìn dịch dần về giữa nhân vật và bầy kiếm
    _fT.copy(hero.center).lerp(_fC, 0.6);
    controls.target.lerp(_fT, 1 - Math.exp(-1.2 * dt));
    // kiếm sát mép → lùi ra; kiếm đã gọn giữa màn hình → tiến lại dần (không gần hơn chỗ cũ)
    _fO.subVectors(camera.position, controls.target);
    let d = _fO.length();
    const d0 = follow.pos.distanceTo(follow.target);
    if (ext > F.edge) d *= 1 + F.speed * dt * Math.min(3, (ext - F.edge) * 6 + 0.5);
    else if (ext < F.inner && d > d0) d = Math.max(d0, d * (1 - F.speed * 0.4 * dt));
    d = Math.min(d, F.maxDist);
    camera.position.copy(controls.target).add(_fO.setLength(d));
  } else if (follow.saved) {
    // thôi phi kiếm → camera về chỗ cũ trong ~2 giây (nếu cự kiếm không đang điều khiển camera)
    follow.back += dt;
    const k = 1 - Math.exp(-2.5 * dt);
    if (camAutoMode === 0) { controls.target.lerp(follow.target, k); camera.position.lerp(follow.pos, k); }
    if (follow.back > 2.2) follow.saved = false;
  }
}
let giantBoltAcc = 0, giantBoltSlot = 0;
const _heroPrev = new THREE.Vector3(), _flyV = new THREE.Vector3(), _flyD = new THREE.Vector3();
// KIM LONG: ánh vàng theo đầu rồng + sấm sét vàng quanh thân
const dragonLight = new THREE.PointLight(0xffc860, 0, 18, 1.4);
scene.add(dragonLight);
let dragonBoltAcc = 0;
const dragonBody = new DragonBody(scene); // khối rồng 3D bên dưới lớp kiếm
// Dấu ĐỐI PHƯƠNG khi bắn kiếm: vòng ngắm đỏ vàng xoay chậm
const enemyMark = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 48), new THREE.MeshBasicMaterial({
  color: 0xff7a3a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
}));
enemyMark.add(new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 24), enemyMark.material));
enemyMark.renderOrder = 7;
scene.add(enemyMark);
const _gTmp = new THREE.Vector3(), _gTmp2 = new THREE.Vector3();
function giantBolt(g) {
  // tia sét lớn: từ 1 điểm trên thân cự kiếm văng ra 1 điểm ngẫu nhiên xung quanh
  // rải đều dọc thân (chia ô lần lượt), văng ra ngang thân với độ dài gần như nhau → đều, gọn
  const L = CONFIG.sword.length * g.scale, G = CONFIG.giant;
  giantBoltSlot = (giantBoltSlot + 3) % 10;
  const along = -0.2 + 0.85 * ((giantBoltSlot + Math.random()) / 10);
  const a = g.pos.clone().addScaledVector(new THREE.Vector3(0, -1, 0), along * L);
  const ang = Math.random() * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(ang), (Math.random() - 0.5) * 0.5, Math.sin(ang)).normalize();
  const hw = CONFIG.sword.width * 0.5 * g.scale;
  a.addScaledVector(dir, hw * 0.6);                                     // bắt đầu từ mép lưỡi
  const b = a.clone().addScaledVector(dir, G.boltReach * (0.8 + Math.random() * 0.4));
  lightning.spawn(a, b, { width: G.boltWidth, life: 0.1 + Math.random() * 0.12 });
}
const sparks = new Sparks(scene);
// Ánh sáng TRẬN PHÁP ở tâm vòng kiếm (vàng): quầng sáng + đèn điểm chiếu lên các vòng bên trong
const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: softDotTexture(128, 0.3), color: CONFIG.colors.edgeGold, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
}));
coreGlow.renderOrder = 6;
const coreLight = new THREE.PointLight(CONFIG.colors.edgeGold, 0, 6, 1.5);
scene.add(coreGlow, coreLight);
let coreK = 0;

// Đàn kiếm + hào quang + vệt kiếm. Dựng lại được khi đổi số kiếm trong bảng Thông số.
let swarm, shell, trails, rune, hiltDust;
function buildSwarm() {
  const prevSpeed = swarm ? swarm.speedMul : CONFIG.speed.default;
  if (swarm) {
    scene.remove(swarm.mesh, shell);
    swarm.mesh.geometry.dispose();
    swarm.mesh.dispose();
    shell.geometry.dispose();
    shell.dispose();
    trails.dispose(scene);
    hiltDust.dispose(scene);
    for (const b of lightning.bolts) b.active = false; // sét cũ đang bám kiếm cũ
    bladeArcs.reset();
  }
  CONFIG.swordCount = CONFIG.rings.reduce((n, r) => n + r.count, 0);
  swarm = new Swarm(scene, swordGeo, swarmSwordMat, hero);
  swarm.speedMul = prevSpeed;
  // Thân kiếm thẳng trong suốt: cũng dùng chung ma trận vị trí với lõi trúc
  const sg = shellGeo.clone();
  sg.setAttribute('aEdgeGold', new THREE.InstancedBufferAttribute(swarm.edgeGold, 1).setUsage(THREE.DynamicDrawUsage));
  shell = new THREE.InstancedMesh(sg, swarmShellMat, swarm.count);
  shell.instanceMatrix = swarm.mesh.instanceMatrix;
  shell.frustumCulled = false;
  shell.renderOrder = 3;
  scene.add(shell);
  hiltDust = new HiltDust(scene, swarm);
  trails = new Trails(scene, swarm);
  if (rune) rune.swarm = swarm;
  else rune = new RuneDisc(scene, swarm, { geo: swordGeo, mat: runeSwordMat, shellGeo, shellMat }); // phù văn = các lớp kiếm nhỏ
  if (inputRef) inputRef.swarm = swarm;
  if (window.__phiKiem) window.__phiKiem.swarm = swarm;
  swarm.onArrive((s) => {
    sparks.spawn(s.pos, 3); // nhiều kiếm tới cùng lúc → ít tia lửa mỗi thanh
    if (Math.random() < 0.12) lightning.spawn(s.pos, swarm.attackTarget);
  });
}
let inputRef = null; // InputManager (tạo sau) — để cập nhật khi dựng lại đàn kiếm
buildSwarm();

// --- Camera điều khiển bằng chuột (kéo để xoay, cuộn để zoom) ---
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = CONFIG.view.minDistance;
controls.maxDistance = CONFIG.view.maxDistance;
camera.near = 0.02; camera.updateProjectionMatrix(); // zoom sát mà không bị cắt hình

// --- Hậu kỳ: bloom ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const B = CONFIG.bloom;
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), B.strength, B.radius, B.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- Cử chỉ + input ---
const gesture = new GestureController($('cam-video'), $('cam-overlay'));
let gui;
const ui = {
  toggleHelp: () => { $('help').classList.remove('hidden'); $('help').classList.toggle('collapsed'); fitHelp(); },
  toggleGui: () => gui.show(gui._hidden),
  // Bật / tắt camera (nút trên HUD hoặc phím C)
  toggleCamera: () => (gesture.ready ? ui.stopCamera() : ui.startCamera()),
  stopCamera: () => {
    gesture.stop();
    $('cam-box').hidden = true;
    document.body.classList.remove('cam-on');
    $('btn-camera').textContent = '📷 Bật camera';
    $('btn-camera').classList.remove('on');
    $('cam-status').textContent = 'Camera đã tắt';
  },
  startCamera: async () => {
    if (gesture.ready || ui.starting) return;
    ui.starting = true;
    const btn = $('btn-camera');
    btn.disabled = true;
    try {
      await gesture.start((msg) => ($('cam-status').textContent = msg));
      $('cam-box').hidden = false;
      document.body.classList.add('cam-on');
      btn.textContent = '⏹ Tắt camera';
      btn.classList.add('on');
      btn.disabled = false;
    } catch (e) {
      console.error(e);
      const denied = e.name === 'NotAllowedError';
      $('cam-status').textContent = denied
        ? 'Chưa được phép dùng camera — bấm biểu tượng 🔒 trên thanh địa chỉ để cho phép rồi thử lại.'
        : 'Lỗi: ' + (e.message || e);
      btn.disabled = false;
    }
    ui.starting = false;
  },
};
const input = new InputManager({ swarm, lightning, sparks, camera, controls, canvas, hero, gesture, ui });
inputRef = input;
$('btn-camera').addEventListener('click', ui.toggleCamera);
// Nút NHẸ MÁY: bật / tắt cấu hình nhẹ (tải lại trang để dựng lại với ít kiếm hơn)
{
  const b = $('btn-light'), light = CONFIG.quality === 'light';
  b.textContent = light ? '🐢 Đang: Nhẹ máy · bấm để chuyển ✨ Đầy đủ' : '✨ Đang: Đầy đủ · bấm để về 🐢 Nhẹ máy';
  b.classList.toggle('on', !light);
  b.addEventListener('click', () => { setQuality(light ? 'full' : 'light'); location.reload(); });
}
// Bảng phím tắt: bấm nút để mở / thu gọn; luôn giữ dưới khung HUD (có nút bật camera) — không che nhau
$('help-toggle').addEventListener('click', ui.toggleHelp);
function fitHelp() {
  const top = $('hud').getBoundingClientRect().bottom + 12;
  $('help').style.maxHeight = Math.max(60, innerHeight - top - 12) + 'px';
}
addEventListener('resize', fitHelp);
new ResizeObserver(fitHelp).observe($('hud'));
fitHelp();

// --- Bảng chỉnh thông số (xem js/panel.js) ---
lightning.rateMul = CONFIG.lightning.rateMul;
bladeArcs.rateMul = runeArcs.rateMul = CONFIG.lightning.rateMul;
gui = buildPanel({
  getSwarm: () => swarm, rebuild: buildSwarm,
  lightning, bladeArcs, runeArcs, hero, heroPhoto, glyphPhoto, controls, camera, terrain: world.terrain, bloom, shellMat, swordMat,
});

addEventListener('resize', () => {
  if (!innerWidth || !innerHeight) return; // cửa sổ bị ẩn / thu nhỏ về 0
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// --- Vòng lặp chính ---
const clock = new THREE.Clock();
let fps = 60, frame = 0, hudT = 0, fxDim = 1;
const hud = { state: $('hud-state'), gesture: $('hud-gesture'), hands: $('hud-hands'), speed: $('hud-speed'), fps: $('hud-fps') };

function loop() {
  requestAnimationFrame(loop);
  const rawDt = clock.getDelta();
  // Máy chậm (FPS thấp) vẫn xoay đúng tốc độ: chỉ chặn khung hình quá dài (vd. lúc chuyển tab)
  const dt = Math.min(rawDt, 1 / 12);
  const t = clock.elapsedTime;
  fps += (1 / Math.max(rawDt, 1e-4) - fps) * 0.05;
  frame++;

  // Máy yếu: nhận diện tay cách 1 khung hình
  if (fps >= CONFIG.gesture.lowFpsSkip || frame % 2 === 0) gesture.update(performance.now());
  input.update(dt);
  // BAY: di chuyển nhân vật, camera + tâm nhìn dời theo đúng bằng quãng nhân vật vừa bay
  {
    const before = _heroPrev.copy(hero.base);
    hero.move(input.flyVector(_flyV), dt);
    if (CONFIG.heroFly.camFollow) {
      _flyD.subVectors(hero.base, before);
      camera.position.add(_flyD);
      controls.target.add(_flyD);
      if (follow.saved) { follow.pos.add(_flyD); follow.target.add(_flyD); }
      if (camSave.saved) { camSave.pos.add(_flyD); camSave.target.add(_flyD); }
    }
  }

  world.update(dt, t, CONFIG.scene.flightMul);
  hero.update(dt, t);
  heroPhoto.update(camera);
  swarm.update(dt, camera);
  dragonBody.update(swarm);
  swarmSwordMat.emissiveIntensity = heroSwordMat.emissiveIntensity = runeSwordMat.emissiveIntensity = swordMat.emissiveIntensity; // bảng chỉnh đổi swordMat
  shell.geometry.attributes.aEdgeGold.needsUpdate = true;
  // Vòng kiếm: kiếm dồn đặc vào 1 chỗ → giảm sáng hiệu ứng trên lưỡi để không bị loá trắng
  const wantDim = swarm.state === 'URCHIN' ? CONFIG.urchin.fxDim : 1;
  fxDim += (wantDim - fxDim) * (1 - Math.exp(-3 * dt));
  bladeArcs.dim = hiltDust.dim = fxDim;
  {
    const U = CONFIG.urchin, on = swarm.state === 'URCHIN' ? 1 : 0;
    coreK += (on - coreK) * (1 - Math.exp(-2 * dt));
    const pulse = 1 + 0.12 * Math.sin(t * 3.1) + 0.06 * Math.sin(t * 7.3);
    const R = (U.radius + Math.max(0, U.goldRings - 1) * U.layerGap) * swarm.radiusUser;
    coreGlow.position.copy(swarm.urchinCenter);
    coreGlow.scale.setScalar((R * 2 + 0.6) * pulse);
    coreGlow.material.opacity = Math.min(1, coreK * U.coreLight * 0.55);
    coreGlow.material.color.set(CONFIG.colors.edgeGold);
    coreGlow.visible = coreK > 0.01 && U.coreLight > 0;
    coreLight.position.copy(swarm.urchinCenter);
    coreLight.intensity = coreK * U.coreLight * 3 * pulse;
    coreLight.distance = R * 2.5 + 1;
  }
  lightning.rateMul = CONFIG.lightning.rateMul * (swarm.state === 'URCHIN' ? CONFIG.urchin.fxDim : 1);
  rune.update(dt, t);
  hiltDust.update(t);
  trails.update(dt);
  lightning.autoSpawn(dt, swarm);
  lightning.update(dt, camera);
  bladeArcs.autoSpawn(dt, swarm.swords);
  bladeArcs.update(dt);
  runeArcs.autoSpawn(dt, rune.minis.swords);
  runeArcs.update(dt);
  {
    // Cự kiếm: hiện / ẩn, sét bám lưỡi, sét lớn, ánh sáng vàng
    const g = swarm.giant;
    giantSword.visible = !g.hidden;
  // Kim long: sét vàng quanh thân (từ 1 thanh kiếm trên thân văng ra ngoài, bám theo thanh đó)
  {
    const D = CONFIG.dragon, dk = swarm.dragon.k;
    dragonLight.position.copy(swarm.dragon.head);
    dragonLight.intensity = dk * (2.5 + Math.random() * 1.5);
    if (swarm.state === 'DRAGON' && dk > 0.5) {
      dragonBoltAcc += D.boltRate * dt;
      while (dragonBoltAcc >= 1) {
        dragonBoltAcc -= 1;
        const s = swarm.swords[(Math.random() * swarm.count) | 0];
        if (swarm.isHidden(s)) continue;
        const b = s.pos.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(D.boltReach * (0.6 + Math.random() * 0.6)));
        lightning.spawn(s.pos, b, { width: 0.9, life: 0.1 + Math.random() * 0.15 });
      }
    }
  }
  // dấu đối phương
  const vOn = swarm.state === 'VOLLEY';
  enemyMark.material.opacity += ((vOn ? 0.9 : 0) - enemyMark.material.opacity) * (1 - Math.exp(-5 * dt));
  enemyMark.visible = enemyMark.material.opacity > 0.02;
  enemyMark.position.copy(swarm.enemy);
  enemyMark.quaternion.copy(camera.quaternion);
  enemyMark.rotateZ(t * 0.8);
  enemyMark.scale.setScalar(1 + 0.08 * Math.sin(t * 6));
    giantSword.position.copy(g.pos);
    giantSword.quaternion.copy(g.quat);
    giantSword.scale.setScalar(Math.max(1e-3, g.scale));
    giantArcs.autoSpawn(dt, g.hidden ? [] : [g]);
    giantArcs.update(dt);
    giantCoreArcs.autoSpawn(dt, g.hidden ? [] : [g]);
    giantCoreArcs.update(dt);
    // lõi sáng + phù văn dọc lưỡi (sáng dần khi cự kiếm hiện, nhấp nháy như đang vận lực)
    const GG = CONFIG.giant;
    giantCoreMat.emissiveIntensity = (CONFIG.colors.emissiveIntensity ?? 0.3) + GG.coreGlow * g.k * (0.8 + 0.2 * Math.sin(t * 7));
    const Ls = CONFIG.sword.length, Wd = CONFIG.sword.width;
    for (const gl of giantGlyphs) {
      const n = Math.max(0, Math.round(GG.glyphs.count));
      const on = GG.glyphs.enabled && gl.i < n && !g.hidden;
      gl.mesh.visible = on;
      if (!on) continue;
      // từ gần chuôi (y nhỏ) xuống phía mũi; chữ nhỏ dần theo lưỡi thon
      const f = n > 1 ? gl.i / (n - 1) : 0;
      const y = Ls * (-0.24 + 0.82 * GG.glyphs.span * f);
      const sz = Wd * GG.glyphs.size * (1 - (1 - (CONFIG.sword.taper ?? 1)) * Math.min(1, (y + 0.3 * Ls) / (0.8 * Ls)));
      gl.mesh.position.y = y;
      gl.mesh.scale.set(sz, sz, 1);
      gl.mesh.material.opacity = g.k * GG.glyphs.intensity * (0.7 + 0.3 * Math.sin(t * 4 - gl.i * 0.8));
    }
    if (!g.hidden && g.k > 0.6) {
      giantBoltAcc += CONFIG.giant.boltRate * dt;
      while (giantBoltAcc >= 1) { giantBoltAcc -= 1; giantBolt(g); }
    }
    giantLight.position.copy(g.pos);
    giantLight.intensity = g.k * (2.2 + Math.random() * 1.6);
    giantShellMat.uniforms.edgeColor.value.set(CONFIG.giant.goldEdge ? CONFIG.colors.edgeGold : CONFIG.colors.shellEdge);
    // viền lưỡi cự kiếm: VÀNG và DÀY
    const GE = CONFIG.giant;
    giantShellMat.uniforms.edgeStart.value = 1 - (GE.goldEdge ? GE.edgeWidth : CONFIG.sword.shellEdgeWidth);
    giantShellMat.uniforms.edgeIntensity.value = GE.goldEdge ? GE.edgeIntensity * (0.85 + 0.15 * Math.sin(t * 5)) : CONFIG.sword.shellEdgeIntensity;
    const L = CONFIG.sword.length * g.scale;
    // camera: gộp xong thì tiến lại gần, rời chế độ thì lùi về chỗ cũ
    const G = CONFIG.giant;
    if (swarm.state === 'GIANT' && G.camZoom && g.k > 0.3 && camAutoMode === 0 && !camSave.saved) {
      camSave.pos.copy(camera.position); camSave.target.copy(controls.target); camSave.saved = true;
      camAutoMode = 1; camAutoT = 0;
    } else if (swarm.state !== 'GIANT' && camSave.saved && camAutoMode !== -1) {
      camAutoMode = -1; camAutoT = 0;
    }
    if (camAutoMode !== 0) {
      camAutoT += dt;
      const k = 1 - Math.exp(-2.5 * dt);
      if (camAutoMode === 1) {
        const tgt = _gTmp.copy(g.pos); tgt.y -= L * 0.2;           // nhìn vào giữa thân kiếm
        controls.target.lerp(tgt, k);
        const dir = _gTmp2.subVectors(camSave.pos, tgt).normalize();
        camera.position.lerp(dir.multiplyScalar(G.camDist).add(tgt), k);
        if (camAutoT > 2.2) camAutoMode = 0;                        // xong → trả quyền xoay camera cho người dùng
      } else {
        controls.target.lerp(camSave.target, k);
        camera.position.lerp(camSave.pos, k);
        if (camAutoT > 2.2) { camAutoMode = 0; camSave.saved = false; }
      }
    }
  }
  sparks.update(dt);

  world.heroLight.position.copy(hero.center);
  world.heroLight.intensity = 0.5 + lightning.activeCount * 0.06 * (0.6 + Math.random() * 0.8);

  updateCamFollow(dt);
  bloom.threshold = Math.max(CONFIG.bloom.threshold, CONFIG.palette.bloomMin ?? 0); // trời sáng: tránh loá cả bầu trời
  controls.update();
  if (innerWidth && innerHeight) composer.render();

  hudT += rawDt;
  if (hudT > 0.25) {
    hudT = 0;
    hud.state.textContent = STATE_LABEL[swarm.state];
    const gs = gesture.state;
    hud.gesture.textContent = gesture.ready ? `${gs.rawGesture} (${(gs.score * 100) | 0}%) → ${gs.gesture}` : '—';
    hud.hands.textContent = gesture.ready ? gs.hands : '—';
    hud.speed.textContent = swarm.speedMul.toFixed(2) + '×';
    hud.fps.textContent = Math.round(fps);
  }
}
loop();

// Để debug trong console
window.__phiKiem = { renderer, swarm, lightning, bladeArcs, runeArcs, giantArcs, giantCoreArcs, giantSword, controls, heroPhoto, glyphPhoto, getRune: () => rune, sparks, gesture, input, CONFIG, camera, rebuild: buildSwarm };
