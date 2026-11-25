// Bầu trời, mặt trời/trăng, sao, núi nhiều lớp, biển mây, vệt gió, bụi sáng
// Màu lấy từ CONFIG.palette ('dusk' hoàng hôn vàng hoặc 'night')
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Terrain } from './terrain.js';

export function softDotTexture(size = 128, falloff = 0.45) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(falloff, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Độ cao sườn núi, tuần hoàn theo chu kỳ W để cuộn vô tận không bị nối
function ridgeHeight(x, W, seed) {
  const ks = [1, 2, 3, 5, 8, 13];
  let h = 0;
  for (let i = 0; i < ks.length; i++) {
    const a = 1 / (1 + i * 0.9);
    h += a * (1 - Math.abs(Math.sin((Math.PI * ks[i] * x) / W + seed * (i + 1) * 1.7)));
  }
  return h / 2.6;
}

function makeMountainLayer({ W, z, y, amp, seed }, color) {
  const shape = new THREE.Shape();
  const N = 260;
  shape.moveTo(-W, y - 60);
  for (let i = 0; i <= N; i++) {
    const x = -W + (2 * W * i) / N;
    shape.lineTo(x, y + ridgeHeight(x, W, seed) * amp);
  }
  shape.lineTo(W, y - 60);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: true }));
  mesh.position.z = z;
  return mesh;
}

export function createWorld() {
  const S = CONFIG.scene, P = CONFIG.palette;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.skyBottom);
  scene.fog = new THREE.FogExp2(P.fog, P.fogDensity);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1400);
  camera.position.set(2, 2.8, 10);

  // --- Bầu trời gradient ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(P.skyTop) },
        mid: { value: new THREE.Color(P.skyMid) },
        bottom: { value: new THREE.Color(P.skyBottom) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bottom, pow(-h, 0.5));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // --- Sao (ẩn khi hoàng hôn) ---
  const starCount = 2200;
  const sp = new Float32Array(starCount * 3);
  const sc = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const th = Math.random() * Math.PI * 2;
    const y = 0.03 + Math.random() * 0.95;
    const r = Math.sqrt(1 - y * y);
    sp.set([Math.cos(th) * r * 480, y * 480, Math.sin(th) * r * 480], i * 3);
    const b = 0.35 + Math.random() * 0.65;
    sc.set([b, b, b * (0.9 + Math.random() * 0.1)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false, opacity: P.starOpacity })
  );
  stars.visible = P.starOpacity > 0;
  scene.add(stars);

  // --- Mặt trời / trăng ---
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(256, 0.25), color: P.sunGlow, fog: false, transparent: true, depthWrite: false, opacity: 0.55 }));
  sunGlow.scale.set(160, 160, 1);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(256, 0.7), color: P.sun, fog: false, transparent: true, depthWrite: false }));
  sun.scale.set(34, 34, 1);
  sunGlow.position.set(...P.sunPos);
  sun.position.copy(sunGlow.position);
  scene.add(sunGlow, sun);

  // --- Núi nhiều lớp (parallax) ---
  const layers = S.mountains.map((cfg, i) => {
    const mesh = makeMountainLayer(cfg, P.mountains[i] ?? P.mountains[P.mountains.length - 1]);
    scene.add(mesh);
    return { mesh, cfg, offset: Math.random() * cfg.W };
  });

  // --- Biển mây ---
  const cloudTex = softDotTexture(128, 0.3);
  const cloudMats = P.clouds.map(
    (color) => new THREE.SpriteMaterial({ map: cloudTex, color, transparent: true, opacity: P.cloudOpacity, depthWrite: false, fog: true })
  );
  const clouds = [];
  for (let i = 0; i < S.cloudCount; i++) {
    const s = new THREE.Sprite(cloudMats[i % cloudMats.length]);
    const high = Math.random() < 0.2;
    const z = high ? -10 - Math.random() * 30 : -40 + Math.random() * 32;
    s.position.set(-70 + Math.random() * 140, high ? 2 + Math.random() * 5 : -9 + Math.random() * 6, z);
    const sc2 = high ? 6 + Math.random() * 8 : 8 + Math.random() * 16;
    s.scale.set(sc2 * 1.8, sc2 * 0.6, 1);
    clouds.push({ sprite: s, speed: 0.6 + (z + 40) / 40 });
    scene.add(s);
  }

  // --- Vệt gió ---
  const streakPos = new Float32Array(S.streakCount * 6);
  const streaks = [];
  for (let i = 0; i < S.streakCount; i++) {
    streaks.push({ x: -25 + Math.random() * 50, y: -3 + Math.random() * 8, z: -6 + Math.random() * 12, len: 1.5 + Math.random() * 2.5, sp: 2 + Math.random() * 2 });
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMesh = new THREE.LineSegments(
    streakGeo,
    new THREE.LineBasicMaterial({ color: P.streak, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  streakMesh.frustumCulled = false;
  scene.add(streakMesh);

  // --- Bụi sáng lơ lửng quanh trận kiếm (như mảnh vụn lấp lánh trong phim) ---
  const DN = S.dustCount;
  const dustPos = new Float32Array(DN * 3);
  const dustCol = new Float32Array(DN * 3);
  const dust = [];
  const dustColor = new THREE.Color(P.dust);
  for (let i = 0; i < DN; i++) {
    dust.push({
      x: -14 + Math.random() * 28, y: -4 + Math.random() * 12, z: -8 + Math.random() * 12,
      vx: 0.2 + Math.random() * 0.6, vy: (Math.random() - 0.5) * 0.3, tw: Math.random() * 10, tws: 2 + Math.random() * 4,
    });
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  const dustMesh = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.07, map: softDotTexture(32), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  }));
  dustMesh.frustumCulled = false;
  scene.add(dustMesh);

  // --- Ánh sáng ---
  scene.add(new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiIntensity));
  const dirLight = new THREE.DirectionalLight(P.dirColor, P.dirIntensity);
  dirLight.position.set(-4, 6, 3);
  scene.add(dirLight);
  const heroLight = new THREE.PointLight(CONFIG.colors.heroLight, 2, 14, 1.5);
  scene.add(heroLight);

  // --- Cảnh vật 3D vô tận (núi non, sông, cỏ cây, biển mây) — thay cho núi phẳng + mây cũ ---
  const terrain = new Terrain(scene, P);

  function update(dt, t, flightMul = 1) {
    const fs = S.flightSpeed * flightMul;
    const useTerrain = S.terrain?.enabled;
    for (const L of layers) L.mesh.visible = !useTerrain;
    for (const c of clouds) c.sprite.visible = !useTerrain;
    terrain.update(dt, camera, fs);
    // bầu trời, sao, trăng luôn bao quanh camera (bay / lùi xa bao nhiêu cũng không chạm mép trời)
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    sunGlow.position.set(...P.sunPos).add(camera.position);
    sun.position.copy(sunGlow.position);
    for (const L of layers) {
      L.offset = (L.offset + fs * L.cfg.parallax * dt) % L.cfg.W;
      L.mesh.position.x = L.offset - L.cfg.W / 2;
    }
    for (const c of clouds) {
      c.sprite.position.x += fs * c.speed * dt;
      if (c.sprite.position.x > 70) c.sprite.position.x -= 140;
    }
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      s.x += fs * s.sp * dt;
      if (s.x > 25) { s.x = -25; s.y = -3 + Math.random() * 8; s.z = -6 + Math.random() * 12; }
      streakPos.set([s.x, s.y, s.z, s.x - s.len, s.y, s.z], i * 6);
    }
    streakGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < DN; i++) {
      const d = dust[i];
      d.x += (d.vx + fs * 0.15) * dt;
      d.y += d.vy * dt;
      if (d.x > 14) { d.x = -14; d.y = -4 + Math.random() * 12; }
      if (d.y > 8) d.y = -4; else if (d.y < -4) d.y = 8;
      const b = Math.max(0, Math.sin(t * d.tws + d.tw)) * 1.6;
      dustPos[i * 3] = d.x; dustPos[i * 3 + 1] = d.y; dustPos[i * 3 + 2] = d.z;
      dustCol[i * 3] = dustColor.r * b; dustCol[i * 3 + 1] = dustColor.g * b; dustCol[i * 3 + 2] = dustColor.b * b;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.color.needsUpdate = true;
    stars.rotation.y += dt * 0.002;
  }

  return { scene, camera, heroLight, update, terrain };
}
