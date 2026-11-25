// Thanh Trúc Phong Vân Kiếm (dựng bằng code), theo phim tập 173 (03:00–03:17):
// lưỡi thẳng mảnh xanh ngọc ngả lam, lõi trúc nhỏ bên trong; đĩa chắn tay tròn màu tối viền VÀNG;
// tay cầm dài xanh đen; núm loe như loa kèn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

const NODES = 5;        // số đốt trúc trên thân kiếm
const TIP_START = 0.86; // mũi kiếm bắt đầu từ 86% chiều dài lưỡi

function nodeInfo(y, L) {
  const seg = (L * TIP_START) / (NODES + 1);
  const k = Math.round(y / seg);
  const near = k >= 1 && k <= NODES ? Math.abs(y - k * seg) : Infinity;
  const frac = (y / seg) % 1;
  return { near, frac, seg };
}

// Hình mũi kiếm: 1 ở chỗ bắt đầu mũi → 0 ở đầu mũi. Đường cong kiểu đầu đạn (bo tròn nhẹ ở đầu),
// tipRound càng lớn mũi càng tù / tròn (2 = vừa phải; 1 = nhọn thẳng như cũ)
export function tipProfile(u) {
  const p = CONFIG.sword.tipRound ?? 2;
  return Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, u), p)));
}

function bladeRadius(y, L, r0) {
  const yt = L * TIP_START;
  const T = CONFIG.sword.taper; // TO ở phía tay cầm, NHỎ DẦN tới mũi (tỉ lệ bề rộng lúc bắt đầu mũi)
  if (y >= yt) {
    const u = (y - yt) / (L - yt);
    return r0 * T * tipProfile(u); // mũi bo tròn nhẹ, không nhọn hoắt
  }
  const { near, frac, seg } = nodeInfo(y, L);
  let r = r0 * (1 - (1 - T) * (y / yt));
  // các khấc ngang (đốt trúc) nhân theo bề rộng tại chỗ đó → cũng to ở dưới, nhỏ dần lên mũi
  r *= 1 - 0.06 * Math.sin(Math.PI * frac);
  if (near !== Infinity) r *= 1 + 0.28 * Math.exp(-((near / (seg * 0.07)) ** 2));
  return r;
}

// Gán độ sáng từng đỉnh (color) và độ "vàng" (gold: 0 = thân ngọc, 1 = chuôi vàng)
function paint(geo, brightFn, gold) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const g = new Float32Array(pos.count).fill(gold);
  for (let i = 0; i < pos.count; i++) {
    const b = brightFn(pos.getY(i));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('gold', new THREE.BufferAttribute(g, 1));
  return geo;
}

// Trục kiếm là +Y (mũi kiếm hướng +Y). Tâm xoay đặt ở 30% chiều dài.
// Mũi kiếm ở y = +0.7L, đĩa chắn tay ở y ≈ -0.3L (dùng cho vệt kiếm quét cả thanh).
// Hình này là PHẦN ĐẶC: lõi trúc nhỏ bên trong + đĩa chắn tay + cán + núm.
// Thân kiếm thẳng trong suốt bên ngoài là createShellGeometry().
export function createSwordGeometry(L = CONFIG.sword.length, W = CONFIG.sword.width) {
  const r0 = W / 2;
  const Lc = L * CONFIG.sword.coreLength;  // lõi trúc ngắn hơn thân kiếm (nằm gọn bên trong)
  const rc = r0 * CONFIG.sword.coreRatio;  // lõi trúc mảnh
  const pts = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * Lc;
    pts.push(new THREE.Vector2(Math.max(bladeRadius(y, Lc, rc), 0.0005), y));
  }
  const blade = new THREE.LatheGeometry(pts, 10);
  paint(blade, (y) => {
    const { near, seg } = nodeInfo(y, Lc);
    const glow = near === Infinity || y > Lc * TIP_START ? 0 : Math.exp(-((near / (seg * 0.09)) ** 2));
    return 0.6 + 0.8 * glow; // đốt trúc sáng nhẹ
  }, 0);

  // --- Chuôi kiếm theo phim (Phàm Nhân Tu Tiên tập 173, 03:00–03:17) ---
  // Đĩa chắn tay TRÒN màu tối có VIỀN VÀNG sáng; cổ nối xanh ngọc; tay cầm dài màu xanh đen,
  // 2 đai nhỏ; núm cuối LOE RA như loa kèn + nút nhỏ. gold: 0 = thân, 1 = chuôi tối, 2 = vàng kim.
  const hilt = [];
  const gy = -W * 0.1;                  // tâm đĩa
  const Rg = W * 0.9;                   // bán kính đĩa: đường kính ≈ 1.8 lần bề rộng lưỡi (như phim)
  const disc = new THREE.LatheGeometry([
    new THREE.Vector2(0.0005, -W * 0.08),
    new THREE.Vector2(Rg * 0.9, -W * 0.08),
    new THREE.Vector2(Rg, -W * 0.03),
    new THREE.Vector2(Rg, W * 0.03),
    new THREE.Vector2(Rg * 0.9, W * 0.08),
    new THREE.Vector2(0.0005, W * 0.08),
  ], 36);
  disc.translate(0, gy, 0);
  hilt.push(paint(disc, () => 0.55, 1));
  const rim = new THREE.TorusGeometry(Rg, W * 0.075, 8, 40); // VIỀN VÀNG quanh đĩa
  rim.rotateX(Math.PI / 2);
  rim.translate(0, gy, 0);
  hilt.push(paint(rim, () => 1.6, 2));
  const face = new THREE.TorusGeometry(Rg * 0.55, W * 0.025, 5, 28); // vòng chỉ mảnh trên mặt đĩa
  face.rotateX(Math.PI / 2);
  face.translate(0, gy + W * 0.08, 0);
  hilt.push(paint(face, () => 0.9, 1));
  // (đã bỏ khối "cổ nối" tròn giữa đĩa chắn và lưỡi — nó che mất một phần chữ trên lưỡi)
  // Tay cầm: dài, màu xanh đen, hơi thon ở giữa
  const gripH = L * 0.2;
  const gripTop = gy - W * 0.08;
  const grip = new THREE.LatheGeometry([
    new THREE.Vector2(r0 * 0.62, 0),
    new THREE.Vector2(r0 * 0.55, gripH * 0.5),
    new THREE.Vector2(r0 * 0.62, gripH),
  ], 10);
  grip.translate(0, gripTop - gripH, 0);
  hilt.push(paint(grip, () => 0.45, 1));
  for (const f of [0.08, 0.92]) {                                   // 2 đai nhỏ ở 2 đầu tay cầm
    const band = new THREE.TorusGeometry(r0 * 0.66, r0 * 0.14, 6, 16); // đai VÀNG trên tay cầm
    band.rotateX(Math.PI / 2);
    band.translate(0, gripTop - gripH * f, 0);
    hilt.push(paint(band, () => 1.4, 3)); // 3 = vàng ở TAY CẦM / NÚM (tách riêng với viền đĩa chắn)
  }
  // Núm loe ra như loa kèn + nút tròn nhỏ ở cuối
  const pTop = gripTop - gripH;
  const flare = new THREE.LatheGeometry([
    new THREE.Vector2(r0 * 0.6, 0),
    new THREE.Vector2(r0 * 0.7, -W * 0.25),
    new THREE.Vector2(r0 * 1.0, -W * 0.45),
    new THREE.Vector2(r0 * 1.25, -W * 0.55),
    new THREE.Vector2(r0 * 1.15, -W * 0.62),
    new THREE.Vector2(0.0005, -W * 0.62),
  ], 14);
  flare.translate(0, pTop, 0);
  hilt.push(paint(flare, () => 0.6, 1));
  const flareRim = new THREE.TorusGeometry(r0 * 1.2, r0 * 0.12, 6, 18); // vòng VÀNG ở miệng núm loe
  flareRim.rotateX(Math.PI / 2);
  flareRim.translate(0, pTop - W * 0.58, 0);
  hilt.push(paint(flareRim, () => 1.4, 3));
  const knob = new THREE.SphereGeometry(r0 * 0.35, 8, 6);
  knob.translate(0, pTop - W * 0.68, 0);
  hilt.push(paint(knob, () => 0.8, 1));

  const geos = [blade, ...hilt].map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color', 'gold'].includes(name)) g.deleteAttribute(name);
    }
    g.clearGroups();
    return g;
  });
  const geo = mergeGeometries(geos, false);
  geo.translate(0, -L * 0.3, 0);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Thân kiếm THẲNG bên ngoài: lưỡi dẹt tiết diện hình thoi, hai mép thẳng song song, mũi nhọn.
// Vẽ trong suốt (thấy lõi trúc bên trong), mép sáng xanh — xem createShellMaterial().
export function createShellGeometry(L = CONFIG.sword.length, W = CONFIG.sword.width) {
  const r = W / 2, yt = L * CONFIG.sword.shellTip, T = CONFIG.sword.taper;
  // Lưỡi TO ở phía tay cầm rồi THON DẦN đều tới chỗ bắt đầu mũi (r × taper), sau đó vuốt nhọn
  const pts = [
    new THREE.Vector2(r, 0),
    new THREE.Vector2(r * (1 - (1 - T) * 0.5), yt * 0.5),
    new THREE.Vector2(r * T, yt),
  ];
  // mũi: nhiều điểm theo đường cong bo tròn (không nhọn hoắt)
  for (let i = 1; i <= 12; i++) {
    const u = i / 12;
    pts.push(new THREE.Vector2(Math.max(0.0005, r * T * tipProfile(u)), yt + (L - yt) * u));
  }
  const g = new THREE.LatheGeometry(pts, 4); // 4 mặt → tiết diện hình thoi, 2 mép nằm trên trục x
  g.scale(1, 1, CONFIG.sword.shellFlat);
  g.translate(0, -L * 0.3, 0);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Vật liệu thân kiếm trong suốt: giữa mờ xanh ngọc, 2 mép + viền (fresnel) sáng xanh lục.
export function createShellMaterial() {
  const S = CONFIG.sword, C = CONFIG.colors;
  return new THREE.ShaderMaterial({
    uniforms: {
      bodyColor: { value: new THREE.Color(C.shellBody) },
      edgeColor: { value: new THREE.Color(C.shellEdge) },
      goldEdge: { value: new THREE.Color(C.edgeGold) },
      goldAlong: { value: CONFIG.urchin.goldAlong },
      taper: { value: CONFIG.sword.taper },
      tipRound: { value: CONFIG.sword.tipRound ?? 2 },
      bodyAlpha: { value: S.shellAlpha },
      edgeIntensity: { value: S.shellEdgeIntensity },
      edgeStart: { value: 1 - S.shellEdgeWidth }, // mép sáng chỉ chiếm phần ngoài cùng của lưỡi
      shape: { value: new THREE.Vector4(S.length, S.width / 2, S.length * S.shellTip, S.length * 0.3) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      varying float vEG;
      #ifdef EDGE_GOLD
        attribute float aEdgeGold; // 0..1: viền lưỡi chuyển sang vàng (từng thanh)
      #endif
      void main() {
        #ifdef EDGE_GOLD
          vEG = aEdgeGold;
        #else
          vEG = 0.0;
        #endif
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vLocal = position.xy; // toạ độ trên lưỡi kiếm (x: ngang, y: dọc)
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec4 shape; // L, nửa bề rộng, chỗ bắt đầu mũi, độ dịch tâm xoay
      uniform vec3 bodyColor; uniform vec3 edgeColor; uniform float bodyAlpha; uniform float edgeIntensity; uniform float edgeStart;
      uniform vec3 goldEdge;
      uniform float goldAlong;
      uniform float taper;
      uniform float tipRound;
      varying vec2 vLocal;
      varying float vEG;
      void main() {
        // Bề rộng lưỡi tại độ cao này → điểm ảnh gần mép bao nhiêu (0 = sống kiếm, 1 = mép)
        float y = vLocal.y + shape.w;
        float uT = clamp((y - shape.z) / (shape.x - shape.z), 0.0, 1.0);
        float rl = y < shape.z ? shape.y * (1.0 - (1.0 - taper) * y / shape.z)
                               : shape.y * taper * sqrt(max(0.0, 1.0 - pow(uT, tipRound))); // mũi bo tròn
        float edge = clamp(abs(vLocal.x) / max(rl, 1e-4), 0.0, 1.0);
        // CHỈ mép lưỡi sáng (đường mảnh ở 2 cạnh, kể cả 2 cạnh mũi); mặt lưỡi có màu, hơi trong.
        // Chống nhấp nháy: đường mép luôn rộng tối thiểu ~1.5 điểm ảnh (dùng fwidth), nên khi kiếm
        // ở xa / đang xoay, viền không bị lúc hiện lúc mất.
        float fw = fwidth(edge);
        float start = min(edgeStart, 1.0 - 1.5 * fw);
        float f = smoothstep(start - fw, 1.0, edge);
        // ánh vàng từ tâm trận chiếu ra: đậm ở phía chuôi (gần tâm), nhạt dần về mũi
        float along = clamp(y / shape.x, 0.0, 1.0);
        float g = vEG * (1.0 - goldAlong * along);
        vec3 c = mix(bodyColor, mix(edgeColor, goldEdge, g) * edgeIntensity, f);
        gl_FragColor = vec4(c, mix(bodyAlpha, 0.95, f));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// Vật liệu: thân ngọc đậm hơi trong suốt, viền sáng vàng (fresnel), phần chuôi chuyển sang vàng kim.
// accent: các vòng VÀNG ở chuôi (viền đĩa chắn, đai tay cầm, vòng núm):
//   'instance' → bật/tắt theo từng thanh (thuộc tính aAccent 0..1 — chỉ sáng vàng khi phi kiếm)
//   số 0..1    → cố định cho cả vật liệu (0 = vòng vàng thành màu chuôi tối)
// grip: vàng ở tay cầm + núm (gold = 3): 'same' = theo accent, hoặc số 0..1 cố định
export function createSwordMaterial({ accent = 1, grip = 'same' } = {}) {
  const C = CONFIG.colors;
  const m = new THREE.MeshStandardMaterial({
    color: C.blade,
    emissive: C.emissive,
    emissiveIntensity: C.emissiveIntensity,
    metalness: 0.35,
    roughness: 0.22,
    vertexColors: true,
    transparent: CONFIG.sword.opacity < 1,
    opacity: CONFIG.sword.opacity,
  });
  const hiltD = new THREE.Color(C.hiltDiffuse);
  const hiltE = new THREE.Color(C.hiltEmissive);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Vector3(...C.rim).multiplyScalar(C.rimIntensity) };
    shader.uniforms.hiltDiffuse = { value: hiltD };
    shader.uniforms.hiltEmissive = { value: hiltE };
    shader.uniforms.accentDiffuse = { value: new THREE.Color(C.hiltAccent) };
    shader.uniforms.accentEmissive = { value: new THREE.Color(C.hiltAccentEmissive) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float gold;\nvarying float vGold;' + (accent === 'instance' ? '\nattribute float aAccent;' : '') + (grip === 'instance' ? '\nattribute float aGrip;' : ''))
      // gold = 2 (vàng kim) → 1 + độ vàng: 0 thì thành màu chuôi tối, 1 thì vàng hẳn
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float accK = ${accent === 'instance' ? 'aAccent' : Number(accent).toFixed(3)};
        float gripK = ${grip === 'same' ? 'accK' : grip === 'instance' ? 'aGrip' : Number(grip).toFixed(3)};
        // gold: 0 thân · 1 chuôi tối · 2 viền vàng ĐĨA CHẮN (cán tròn) · 3 vàng TAY CẦM/NÚM
        vGold = gold > 2.5 ? 1.0 + gripK : (gold > 1.5 ? 1.0 + accK : gold);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform vec3 hiltDiffuse;\nuniform vec3 hiltEmissive;\nuniform vec3 accentDiffuse;\nuniform vec3 accentEmissive;\nvarying float vGold;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(mix(diffuseColor.rgb, hiltDiffuse, clamp(vGold, 0.0, 1.0)), accentDiffuse, clamp(vGold - 1.0, 0.0, 1.0));')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(mix(totalEmissiveRadiance, hiltEmissive, clamp(vGold, 0.0, 1.0)), accentEmissive, clamp(vGold - 1.0, 0.0, 1.0));
        float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.6);
        totalEmissiveRadiance += rimColor * rimF;
        #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
          totalEmissiveRadiance *= vColor.rgb;
        #endif`
      );
  };
  m.customProgramCacheKey = () => 'sword-accent-' + accent + '-' + grip;
  return m;
}
