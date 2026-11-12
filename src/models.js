// Procedural studio geometry: room, backdrop, light rigs, reflectors and subjects.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { materialParams, sampleGeometry } from './materials.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { ROOM, MODIFIERS, PANELS, PANEL_SURFACES, SKIN_TONES, HAIR_COLORS, CLOTHES_COLORS, modSpec, modelKey, modelMeta } from './data.js';

// Diffuse image-based light comes from a second probe that excludes the lamp faces
// (lamps light surfaces through shadowed spot lights instead), so every physical
// material needs this extra sampler. The shader chunk itself is patched in engine.js.
export const envDiffuse = { value: null };
function hook(mat) {
  mat.onBeforeCompile = (shader) => { shader.uniforms.envMapDiffuse = envDiffuse; };
  return mat;
}
export const std = (p) => hook(new THREE.MeshStandardMaterial(p));
export const phys = (p) => hook(new THREE.MeshPhysicalMaterial(p));

const BLACK_FABRIC = () => std({ color: 0x0a0a0a, roughness: 0.9, side: THREE.DoubleSide });
const BLACK_METAL = () => std({ color: 0x141414, roughness: 0.45, metalness: 0.6 });

function shadowed(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// ---- room and backdrop -------------------------------------------------------

export function buildRoom() {
  const g = new THREE.Group();
  const wallMat = std({ color: 0x6e6e6e, roughness: 0.95, side: THREE.BackSide });
  const box = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d), wallMat);
  box.position.set(0, ROOM.h / 2, (ROOM.zMin + ROOM.zMax) / 2);
  box.receiveShadow = true;
  const floorMat = std({ color: 0x5b5b5b, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, (ROOM.zMin + ROOM.zMax) / 2);
  floor.receiveShadow = true;
  g.add(box, floor);
  return { group: g, wallMat };
}

export function buildBackdrop() {
  const W = 2.72, H = 2.75, R = 0.45, LEN = 4.2, ARC = 14;
  const prof = [[0, H], [0, R]];
  for (let i = 1; i <= ARC; i++) { const a = Math.PI + (i / ARC) * Math.PI / 2; prof.push([R + R * Math.cos(a), R + R * Math.sin(a)]); }
  prof.push([LEN, 0]);
  const pos = [], idx = [];
  prof.forEach(([z, y], i) => {
    pos.push(-W / 2, y + 0.004, z, W / 2, y + 0.004, z);
    // wound so the normals face the camera side; shadow lookups are offset along the normal
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = std({ color: 0x777777, roughness: 0.92, side: THREE.DoubleSide });
  const paper = new THREE.Mesh(geo, mat);
  paper.receiveShadow = true; paper.castShadow = true;
  const g = new THREE.Group();
  g.add(paper);
  const metal = BLACK_METAL();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W + 0.2, 16), mat);
  roll.rotation.z = Math.PI / 2; roll.position.set(0, H + 0.04, -0.04);
  g.add(roll);
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, H + 0.1, 8), metal);
    pole.position.set(sx * (W / 2 + 0.14), (H + 0.1) / 2, -0.04);
    g.add(pole);
  }
  shadowed(g);
  const fixtures = g.children.filter((c) => c !== paper);
  // 'cyc' stretches the sweep wall to wall and removes the paper roll and its stands
  const setKind = (kind) => { const cyc = kind === 'cyc'; paper.scale.x = cyc ? ROOM.w / W : 1; fixtures.forEach((f) => { f.visible = !cyc; }); };
  return { group: g, mat, setKind };
}

// ---- gobos: patterns projected by the optical spot ----------------------------------
const goboCache = new Map();
export function goboTexture(id) {
  if (!id || id === 'none') return null;
  if (!goboCache.has(id)) {
    const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff';
    if (id === 'window') { for (const [x, y] of [[0.14, 0.1], [0.53, 0.1], [0.14, 0.52], [0.53, 0.52]]) g.fillRect(x * n, y * n, 0.33 * n, 0.38 * n); }
    else if (id === 'blinds') { for (let i = 0; i < 9; i++) g.fillRect(0.08 * n, (0.08 + i * 0.095) * n, 0.84 * n, 0.05 * n); }
    else { let s = 9; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      g.fillRect(0, 0, n, n); g.fillStyle = '#000';
      for (let i = 0; i < 70; i++) { g.beginPath(); g.ellipse(r() * n, r() * n, 18 + r() * 40, 8 + r() * 16, r() * 6.3, 0, 7); g.fill(); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    goboCache.set(id, t);
  }
  return goboCache.get(id);
}

// ---- stands -------------------------------------------------------------------

function buildStand() {
  const g = new THREE.Group();
  const metal = BLACK_METAL();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 1, 8), metal);
  pole.name = 'pole';
  g.add(pole);
  // Tripod base: three legs run from a collar on the pole down and out to the floor,
  // each tied back to the bottom of the pole by a brace.
  const legs = new THREE.Group();
  const strut = (ax, ay, az, bx, by, bz, r) => {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), metal);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    legs.add(m);
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5, cx = Math.cos(a), cz = Math.sin(a);
    strut(0, 0.5, 0, cx * 0.46, 0.012, cz * 0.46, 0.011);
    strut(0, 0.14, 0, cx * 0.26, 0.225, cz * 0.26, 0.007);
  }
  // ceiling plate, shown when the lamp hangs from the ceiling instead of standing on the floor
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), metal);
  plate.position.y = ROOM.h - 0.011; plate.visible = false;
  g.add(legs, plate);
  shadowed(g);
  g.userData.setHeight = (h) => { h = Math.max(0.6, h); pole.scale.y = h - 0.1; pole.position.y = 0.1 + (h - 0.1) / 2; legs.visible = true; plate.visible = false; };
  g.userData.setHanging = (yBottom) => {
    const len = Math.max(0.05, ROOM.h - yBottom);
    pole.scale.y = len; pole.position.y = yBottom + len / 2; legs.visible = false; plate.visible = true;
  };
  return g;
}

// ---- light heads ----------------------------------------------------------------
// Local frame: the emitting face sits at the origin and shines towards +Z.

function shell(rFront, rBack, depth, sides, sx = 1, sy = 1, mat = BLACK_FABRIC()) {
  const geo = new THREE.CylinderGeometry(rFront, rBack, depth, sides, 1, true);
  if (sides === 4) geo.rotateY(Math.PI / 4);
  if (sides === 8) geo.rotateY(Math.PI / 8);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, 1);
  return m;
}

export function buildLightRig(item) {
  const m = modSpec(item);
  const head = new THREE.Group();
  const faces = [];
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const addFace = (geo, z = 0) => { const f = new THREE.Mesh(geo, faceMat); f.position.z = z; f.castShadow = false; f.receiveShadow = false; faces.push(f); head.add(f); return f; };
  let back = m.depth; // where the lamp body attaches, behind the face
  let frontHead = false;

  switch (m.id) {
    case 'softbox': case 'strip': case 'panel': {
      if (m.id === 'panel') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(m.w + 0.04, m.h + 0.04, m.depth), BLACK_METAL());
        body.position.z = -m.depth / 2 - 0.002;
        head.add(body);
      } else {
        head.add(shell(Math.SQRT1_2, 0.12, m.depth, 4, m.w, m.h));
      }
      addFace(new THREE.PlaneGeometry(m.w, m.h));
      break;
    }
    case 'octa':
      head.add(shell(m.r / Math.cos(Math.PI / 8), 0.1, m.depth, 8));
      addFace(new THREE.CircleGeometry(m.r / Math.cos(Math.PI / 8), 8, Math.PI / 8));
      break;
    case 'umb_shoot': {
      // translucent dome, convex side towards the subject
      const dome = new THREE.SphereGeometry(m.r * 1.08, 24, 8, 0, Math.PI * 2, 0, 1.18);
      dome.rotateX(Math.PI / 2); dome.translate(0, 0, -m.r * 1.08 * Math.cos(1.18));
      addFace(dome);
      frontHead = false; back = 0.35;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 6), BLACK_METAL());
      shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.2; head.add(shaft);
      break;
    }
    case 'umb_silver': {
      const geo = new THREE.SphereGeometry(m.r * 1.08, 24, 8, 0, Math.PI * 2, 0, 1.18);
      geo.rotateX(-Math.PI / 2); geo.translate(0, 0, m.r * 1.08 * Math.cos(1.18));
      head.add(new THREE.Mesh(geo, std({ color: 0x0a0a0a, roughness: 0.9, side: THREE.FrontSide })));
      faceMat.side = THREE.BackSide;
      addFace(geo, 0.004);
      frontHead = true;
      break;
    }
    case 'dish': {
      head.add(shell(m.r, 0.06, m.depth, 32, 1, 1, std({ color: 0xdddddd, roughness: 0.6, side: THREE.DoubleSide })));
      const ring = new THREE.RingGeometry(0.07, m.r, 32);
      addFace(ring, -0.01);
      const plate = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), BLACK_METAL());
      plate.position.z = 0.0; head.add(plate);
      break;
    }
    case 'snoot':
      head.add(shell(m.r, 0.07, m.depth, 20, 1, 1, BLACK_METAL()));
      head.children[head.children.length - 1].material.side = THREE.DoubleSide;
      addFace(new THREE.CircleGeometry(m.r, 16), -0.01);
      break;
    case 'speedhead': {
      addFace(new THREE.PlaneGeometry(m.w, m.h));
      break;
    }
    case 'para': {
      head.add(shell(m.r, 0.09, m.depth, 16, 1, 1, std({ color: 0x0a0a0a, roughness: 0.9, side: THREE.DoubleSide })));
      addFace(new THREE.CircleGeometry(m.r, 16), -0.02);
      break;
    }
    case 'fresnel': case 'optical': {
      const tube = shell(m.r + 0.012, m.id === 'optical' ? 0.07 : 0.085, m.depth, 24, 1, 1, BLACK_METAL());
      tube.material.side = THREE.DoubleSide; head.add(tube);
      addFace(new THREE.CircleGeometry(m.r, 24), -0.008);
      break;
    }
    case 'barn': {
      head.add(shell(m.r, 0.05, m.depth, 24, 1, 1, std({ color: 0xbbbbbb, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide })));
      addFace(new THREE.CircleGeometry(m.r, 24), -0.03);
      for (let i = 0; i < 4; i++) { // four hinged flaps
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.004, 0.13), BLACK_METAL());
        const a = i * Math.PI / 2;
        flap.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.055);
        flap.rotation.z = a + Math.PI / 2; flap.rotateX(0.35);
        head.add(flap);
      }
      break;
    }
    case 'ring': {
      const body = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 48), BLACK_METAL());
      body.position.z = -0.03; head.add(body);
      addFace(new THREE.RingGeometry(0.17, m.r, 48));
      break;
    }
    case 'tube': {
      const g = new THREE.CylinderGeometry(m.w / 2, m.w / 2, m.h, 16);
      addFace(g);
      for (const sy of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(m.w / 2 + 0.003, m.w / 2 + 0.003, 0.05, 16), BLACK_METAL()); cap.position.y = sy * (m.h / 2 + 0.02); head.add(cap); }
      break;
    }
    default: { // standard reflector
      const s = shell(m.r, 0.05, m.depth, 24, 1, 1, std({ color: 0xbbbbbb, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide }));
      head.add(s);
      addFace(new THREE.CircleGeometry(m.r, 24), -0.03);
    }
  }

  // lamp body
  let body;
  if (item.type === 'speedlight') {
    body = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.1), BLACK_METAL());
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.13, 0.05), BLACK_METAL());
    base.position.set(0, -0.085, -0.02);
    body.add(top, base);
    body.position.z = frontHead ? 0.4 : -(back + 0.05);
  } else if (item.type === 'panel' || item.type === 'ring' || item.type === 'tube') {
    body = new THREE.Group();
  } else {
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16), BLACK_METAL());
    body.rotation.x = Math.PI / 2;
    body.position.z = frontHead ? 0.42 : -(back + 0.13);
  }
  head.add(body);
  shadowed(head);
  faces.forEach((f) => { f.castShadow = false; f.receiveShadow = false; });
  if (frontHead) body.traverse((o) => { o.castShadow = false; });

  const stand = buildStand();
  const group = new THREE.Group();
  group.add(head, stand);
  return { group, head, stand, faces, standOffset: frontHead ? 0.42 : -(back + (['panel', 'ring', 'tube'].includes(item.type) ? 0.03 : 0.13)), spec: m };
}

export function buildPanelRig(item) {
  const p = PANELS[item.size] || PANELS.disc110;
  const s = PANEL_SURFACES[item.surface] || PANEL_SURFACES.white;
  // a scrim is translucent and glows where lamps hit it; the engine sets its brightness
  const mat = s.scrim ? new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
    : std({ color: s.color, roughness: s.rough, metalness: s.metal, side: THREE.DoubleSide });
  const head = new THREE.Group();
  if (p.shape === 'disc') {
    head.add(new THREE.Mesh(new THREE.CircleGeometry(p.r, 40), mat));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.008, 6, 40), BLACK_METAL());
    head.add(rim);
  } else {
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(p.w / 2, p.h, 0.02), mat);
      leaf.position.set(sx * p.w / 4 * Math.cos(0.3), 0, Math.abs(sx) * p.w / 4 * Math.sin(0.3));
      leaf.rotation.y = -sx * 0.3;
      head.add(leaf);
    }
  }
  shadowed(head);
  const stand = buildStand();
  stand.visible = p.shape === 'disc';
  const group = new THREE.Group();
  group.add(head, stand);
  const faces = [];
  if (s.scrim) head.traverse((o) => { if (o.isMesh && o.material === mat) { o.castShadow = false; o.receiveShadow = false; faces.push(o); } });
  return { group, head, stand, faces, standOffset: -0.03, isPanel: true, panel: p, scrimMat: s.scrim ? mat : null };
}

export function buildCameraRig() {
  const g = new THREE.Group();
  const metal = BLACK_METAL();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.07), metal);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 20), metal);
  lens.rotation.x = Math.PI / 2; lens.position.z = 0.09;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.033, 20), std({ color: 0x050510, roughness: 0.05, metalness: 0.9 }));
  glass.position.z = 0.146;
  const head = new THREE.Group();
  head.add(body, lens, glass);
  const stand = buildStand();
  g.add(head, stand);
  shadowed(g);
  return { group: g, head, stand };
}

// ---- subjects -------------------------------------------------------------------

// Lathe a profile of [radius, y] points. Profiles are smoothed with a spline; repeat a
// point to keep a crisp corner there.
function lathe(points, segs = 64, smooth = true) {
  let pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  if (smooth) pts = new THREE.SplineCurve(pts).getPoints(pts.length * 6).map((p) => { p.x = Math.max(0, p.x); return p; });
  return new THREE.LatheGeometry(pts, segs);
}

let headAsset = null;
function loadHead() {
  if (!headAsset) {
    headAsset = new Promise((resolve, reject) => {
      new GLTFLoader().load('assets/LeePerrySmith.glb', (gltf) => {
        let mesh = null;
        gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
        const tl = new THREE.TextureLoader();
        const map = tl.load('assets/head-color.jpg', () => onAsset && onAsset()); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
        const normalMap = tl.load('assets/head-normal.jpg', () => onAsset && onAsset()); normalMap.anisotropy = 4;
        mesh.geometry.userData.shared = true;
        resolve({ geometry: mesh.geometry, map, normalMap });
      }, undefined, reject);
    });
  }
  return headAsset;
}

// Elliptical loft through [rx, rz, y] rings (used for the dress-form torso).
function loft(rings, segs = 40) {
  const pos = [], idx = [];
  rings.forEach(([rx, rz, y]) => { for (let j = 0; j <= segs; j++) { const a = (j / segs) * Math.PI * 2; pos.push(Math.cos(a) * rx, y, Math.sin(a) * rz); } });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < segs; j++) {
    const p = i * (segs + 1) + j, q = p + segs + 1;
    idx.push(p, p + 1, q, p + 1, q + 1, q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const HEAD_SCALE = 0.052;      // scan units -> metres (chin to crown about 23 cm)
const HEAD_HALF = 3.97;        // half height of the scan in its own units

function buildPortrait(onReady) {
  const root = new THREE.Group();
  const lift = new THREE.Group(); // origin at the base of the neck
  root.add(lift);
  const clothProps = { color: 0x1b1d22, roughness: 0.92, sheen: 0.4, sheenRoughness: 0.6, sheenColor: 0x333844, side: THREE.DoubleSide };
  const cloth = phys(clothProps);
  const torso = new THREE.Mesh(loft([[0.1, 0.06, -0.07], [0.2, 0.098, -0.14], [0.196, 0.1, -0.3], [0.168, 0.094, -0.5], [0.172, 0.098, -0.62], [0.0, 0.0, -0.62]]), cloth);
  lift.add(torso);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 10), BLACK_METAL());
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 24), BLACK_METAL());
  base.position.y = 0.015;
  root.add(pole, base);

  const pivot = new THREE.Group();
  lift.add(pivot);
  const skin = phys({ color: 0xffffff, roughness: 0.5, specularIntensity: 0.75, sheen: 0.25, sheenRoughness: 0.5, sheenColor: 0x552a22 });
  skin.defines.USE_SKIN = '';
  // The garment is a second copy of the scan pushed out along its normals and cut at a crew neckline.
  const shirt = phys(clothProps);
  shirt.onBeforeCompile = (shader) => {
    shader.uniforms.envMapDiffuse = envDiffuse;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\ntransformed += normalize(normal) * 0.075;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vObj.y > -2.02 - 0.1 * vObj.z + 0.045 * vObj.x * vObj.x) discard;');
  };
  const placeholder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), skin);
  placeholder.scale.set(0.8, 1.15, 0.95); placeholder.position.y = 0.18;
  pivot.add(placeholder);
  loadHead().then((a) => {
    skin.map = a.map; skin.normalMap = a.normalMap; skin.needsUpdate = true;
    const y = 0.3 - HEAD_HALF * HEAD_SCALE;
    const head = new THREE.Mesh(a.geometry, skin);
    const top = new THREE.Mesh(a.geometry, shirt);
    top.userData.noHQ = true;
    for (const m of [head, top]) { m.scale.setScalar(HEAD_SCALE); m.position.set(0, y, 0); m.receiveShadow = true; pivot.add(m); }
    head.castShadow = true;
    pivot.remove(placeholder);
    onReady && onReady();
  }).catch((e) => console.warn('head model failed to load', e));
  shadowed(root);

  const update = (s) => {
    const top = 1.7;
    lift.position.y = top - 0.3;
    const ph = Math.max(0.05, lift.position.y - 0.62);
    pole.scale.y = ph; pole.position.y = ph / 2;
    lift.rotation.y = (s.yaw || 0) * Math.PI / 180;
    pivot.rotation.x = -(s.pitch || 0) * Math.PI / 180;
    const c = SKIN_TONES[s.skin] || SKIN_TONES.light;
    skin.color.setRGB(c[0], c[1], c[2]);
  };
  return { group: root, update };
}

const TABLE_TOPS = {
  white: { color: 0xeeeeee, roughness: 0.85, metalness: 0 },
  black: { color: 0x050505, roughness: 0.06, metalness: 0 },
  wood: { color: 0x7a5234, roughness: 0.55, metalness: 0 },
};

function buildProduct(type, st) {
  const root = new THREE.Group();
  const topMat = phys({ color: 0xeeeeee, roughness: 0.85, clearcoat: 0 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.8), topMat);
  top.position.y = 0.885;
  root.add(top);
  const legMat = BLACK_METAL();
  for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.87, 8), legMat);
    leg.position.set(x, 0.435, z);
    root.add(leg);
  }
  const turn = new THREE.Group();
  turn.position.y = 0.9;
  root.add(turn);

  if (type === 'watch') {
    const w = new THREE.Group();
    const steel = std({ color: 0xd9d9d9, roughness: 0.14, metalness: 1 }), brushed = std({ color: 0xc8c8c8, roughness: 0.35, metalness: 1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.0205, 0.011, 64), brushed);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0022, 12, 64), steel); bezel.rotation.x = Math.PI / 2; bezel.position.y = 0.0055;
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.019, 64), std({ color: 0x0c1c3a, roughness: 0.45, metalness: 0.6 })); dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0052;
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0195, 64), phys({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 0.001, ior: 1.6 })); glass.rotation.x = -Math.PI / 2; glass.position.y = 0.0064;
    w.add(body, bezel, dial, glass);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0004, 0.004), steel); const a = i * Math.PI / 6; m.position.set(Math.sin(a) * 0.016, 0.0056, Math.cos(a) * 0.016); m.rotation.y = a; w.add(m); }
    for (const [len, a] of [[0.011, 1.0], [0.015, -0.9]]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.0005, len), steel); h.position.set(Math.sin(a) * len / 2, 0.0059, Math.cos(a) * len / 2); h.rotation.y = a; w.add(h); }
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 16), steel); crown.rotation.z = Math.PI / 2; crown.position.x = 0.023; w.add(crown);
    const leather = phys({ ...materialParams('leather'), color: 0x2a170c });
    for (const sz of [-1, 1]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0035, 0.055), leather); strap.position.set(0, -0.002, sz * 0.047); strap.rotation.x = sz * 0.22; w.add(strap); }
    w.rotation.x = 1.0; w.position.set(0, 0.045, 0);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.04), phys({ color: 0x050505, roughness: 0.08, clearcoat: 1 })); block.position.set(0, 0.015, -0.03);
    turn.add(w, block);
  } else if (type === 'ring') {
    const gold = std({ color: 0xffc66b, roughness: 0.12, metalness: 1 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0013, 16, 96), gold); band.position.y = 0.0108;
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0018, 0.003, 6), gold); seat.position.y = 0.0222;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.0034, 0), phys({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 0.004, ior: 2.4, flatShading: true })); gem.scale.y = 0.75; gem.position.y = 0.0262;
    turn.add(band, seat, gem); turn.rotation.y = 0.5;
  } else if (type === 'cosmetics') {
    const blackGloss = phys({ color: 0x070707, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }), gold = std({ color: 0xe9b96e, roughness: 0.2, metalness: 1 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 48), blackGloss); tube.position.set(-0.06, 0.025, 0.01);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0113, 0.0113, 0.006, 48), gold); band.position.set(-0.06, 0.053, 0.01);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0085, 0.022, 32), phys({ color: 0xa3122b, roughness: 0.3, sheen: 0.5 })); stick.position.set(-0.06, 0.067, 0.01);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.035, 64), phys({ color: 0xf6efe6, roughness: 0.4, transmission: 0.6, thickness: 0.02 })); jar.position.set(0.015, 0.0175, 0);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.014, 64), gold); lid.position.set(0.015, 0.042, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.03), blackGloss); box.position.set(0.085, 0.055, -0.02); box.rotation.y = -0.4;
    turn.add(tube, band, stick, jar, lid, box);
  } else if (type === 'fruit') {
    const plate = new THREE.Mesh(lathe([[0, 0.004], [0.06, 0.004], [0.1, 0.012], [0.125, 0.022], [0.127, 0.024], [0.1, 0.016], [0.06, 0.009], [0, 0.009]], 64), phys({ color: 0xf2efe8, roughness: 0.2, clearcoat: 0.8 }));
    const peel = phys({ ...materialParams('paper'), color: 0xe8781a, roughness: 0.5, bumpScale: 1.5, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    const orange = new THREE.Mesh(new THREE.SphereGeometry(0.038, 64, 48), peel); orange.position.set(-0.035, 0.047, 0.005);
    const apple = new THREE.Mesh(lathe([[0, 0.012], [0.02, 0.004], [0.034, 0.012], [0.04, 0.035], [0.036, 0.058], [0.022, 0.07], [0.006, 0.066], [0, 0.062]], 64), phys({ color: 0x9c1418, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 })); apple.position.set(0.045, 0.006, -0.01);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0016, 0.018, 8), std({ color: 0x3b2a18, roughness: 0.8 })); stem.position.set(0.045, 0.077, -0.01); stem.rotation.z = 0.25;
    turn.add(plate, orange, apple, stem);
  } else if (type === 'chart') {
    const cols = ['#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa', '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e',
      '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1', '#f3f3f2', '#c8c8c8', '#a0a0a0', '#7a7a79', '#555555', '#343434'];
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d');
    g.fillStyle = '#101010'; g.fillRect(0, 0, 600, 400);
    cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(14 + (i % 6) * 97, 12 + Math.floor(i / 6) * 96, 86, 86); });
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.004), [0, 1, 2, 3].map(() => std({ color: 0x101010, roughness: 0.9 })).concat([std({ map, roughness: 0.9 }), std({ color: 0x101010, roughness: 0.9 })]));
    card.position.y = 0.105; card.rotation.x = -0.12;
    turn.add(card);
  } else if (type === 'material') {
    const mat = phys({ ...materialParams(st.mat), side: st.shape === 'drape' ? THREE.DoubleSide : THREE.FrontSide });
    turn.add(new THREE.Mesh(sampleGeometry(st.shape), mat));
  } else if (type === 'spheres') {
    const r = 0.085;
    const mats = [
      std({ color: new THREE.Color().setRGB(0.18, 0.18, 0.18), roughness: 0.95 }),
      std({ color: 0xffffff, roughness: 0.03, metalness: 1 }),
      std({ color: new THREE.Color().setRGB(0.85, 0.85, 0.85), roughness: 0.9 }),
      phys({ color: 0x8c0f14, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 }),
    ];
    mats.forEach((m, i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), m);
      s.position.set((i - 1.5) * 0.2, r, 0);
      turn.add(s);
    });
  } else if (type === 'bottle') {
    const glass = phys({ color: 0xeef9f1, roughness: 0.03, transmission: 1, thickness: 0.012, ior: 1.5, side: THREE.DoubleSide });
    const prof = [[0, 0.004], [0.03, 0.004], [0.037, 0.008], [0.038, 0.02], [0.038, 0.07], [0.038, 0.13], [0.038, 0.185], [0.035, 0.21], [0.024, 0.235], [0.015, 0.25], [0.0135, 0.262], [0.0135, 0.285], [0.0135, 0.3], [0.0155, 0.302], [0.0155, 0.313], [0.0125, 0.315]];
    const b = new THREE.Mesh(lathe(prof, 64), glass);
    const wine = new THREE.Mesh(lathe([[0, 0.008], [0.0335, 0.008], [0.0345, 0.016], [0.0345, 0.165], [0, 0.165]], 48, false), phys({ color: 0x3a0308, roughness: 0.04, clearcoat: 1 }));
    turn.add(wine, b);
    turn.scale.setScalar(1.15);
  } else if (type === 'vase') {
    const mat = std({ color: 0xd9cdb8, roughness: 0.78, side: THREE.DoubleSide });
    turn.add(new THREE.Mesh(lathe([[0, 0], [0.045, 0], [0.052, 0.004], [0.085, 0.06], [0.1, 0.14], [0.088, 0.22], [0.055, 0.28], [0.04, 0.32], [0.05, 0.362], [0.048, 0.366], [0.044, 0.362], [0.036, 0.32]], 64), mat));
  } else {
    const mat = std({ color: 0xd8d8d8, roughness: 0.17, metalness: 1 });
    turn.add(new THREE.Mesh(lathe([[0, 0], [0.038, 0], [0.042, 0.004], [0.044, 0.012], [0.047, 0.09], [0.05, 0.176], [0.05, 0.176], [0.051, 0.184], [0.047, 0.192], [0.047, 0.192], [0.042, 0.215], [0.034, 0.238], [0.027, 0.243], [0.027, 0.243], [0.027, 0.27], [0.027, 0.27], [0.02, 0.274], [0.0, 0.274]], 64), mat));
  }
  shadowed(root);
  const update = (s) => {
    turn.rotation.y = (s.rot || 0) * Math.PI / 180;
    const tt = TABLE_TOPS[s.table] || TABLE_TOPS.white;
    topMat.color.setHex(tt.color); topMat.roughness = tt.roughness;
    topMat.clearcoat = s.table === 'black' ? 1 : 0; topMat.clearcoatRoughness = 0.03;
  };
  return { group: root, update };
}

// ---- MakeHuman portrait models ------------------------------------------------------
// Each GLB holds body, eyes, brows, lashes, clothes and several hair meshes. A `_turn`
// vertex attribute (0..1) says how much a vertex follows the head; the rotation is applied
// in the vertex shader so the neck bends smoothly without a skeleton.

const glbCache = new Map();
function loadGLB(url) {
  if (!glbCache.has(url)) {
    glbCache.set(url, new Promise((resolve, reject) => new GLTFLoader().load(url, (g) => {
      const out = {};
      g.scene.traverse((o) => { if (o.isMesh) { o.geometry.userData.shared = true; out[o.name] = o.geometry; } });
      resolve(out);
    }, undefined, reject)));
  }
  return glbCache.get(url);
}
// Called whenever a texture finishes loading so the renderer can redraw.
let onAsset = null;
export function setAssetCallback(fn) { onAsset = fn; }
const texCache = new Map();
function tex(name, srgb = true) {
  if (!texCache.has(name)) {
    const t = new THREE.TextureLoader().load('assets/models/tex/' + name, () => onAsset && onAsset());
    t.flipY = false; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(name, t);
  }
  return texCache.get(name);
}

const TURN_PARS = `
attribute float _turn;
#ifdef USE_SMILE
attribute vec3 _smile;
uniform float uSmile;
#endif
uniform vec3 uTurn;
uniform vec3 uPivot;
mat3 turnMat( float w ) {
  float y = uTurn.x * w, p = uTurn.y * w, r = uTurn.z * w;
  float cy = cos( y ), sy = sin( y ), cp = cos( p ), sp = sin( p ), cr = cos( r ), sr = sin( r );
  mat3 ry = mat3( cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy );
  mat3 rx = mat3( 1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp );
  mat3 rz = mat3( cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0 );
  return ry * rx * rz;
}`;
function withTurn(mat, U, isStd = true) {
  mat.onBeforeCompile = (shader) => {
    if (isStd) shader.uniforms.envMapDiffuse = envDiffuse;
    shader.uniforms.uTurn = U.uTurn; shader.uniforms.uPivot = U.uPivot; shader.uniforms.uSmile = U.uSmile;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + TURN_PARS)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = turnMat( _turn ) * objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_SMILE\ntransformed += _smile * uSmile;\n#endif\ntransformed = turnMat( _turn ) * ( transformed - uPivot ) + uPivot;');
  };
  return mat;
}
function turnDepth(U, map) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  if (map) { m.map = map; m.alphaTest = 0.3; }
  return withTurn(m, U, false);
}

// Glasses: a frame and two flat lenses placed from the eye position in the model's metadata.
// Every vertex gets _turn = 1 so they follow the head.
function buildGlasses(meta) {
  const y = meta.eyeY + 0.002, z = meta.eyeZ + 0.014, ex = 0.032, rx = 0.026, ry = 0.021;
  const frame = [], lens = [];
  for (const sx of [-1, 1]) {
    const ring = new THREE.TorusGeometry(1, 0.075, 8, 40); ring.scale(rx, ry, rx); ring.translate(sx * ex, y, z); frame.push(ring);
    const l = new THREE.CircleGeometry(1, 40); l.scale(rx * 0.97, ry * 0.97, 1); l.translate(sx * ex, y, z); lens.push(l);
    // temple: from the hinge back to the ear
    const t = new THREE.BoxGeometry(0.003, 0.004, 0.125); t.translate(sx * (ex + rx + 0.006), y + 0.004, z - 0.066); frame.push(t);
    const hinge = new THREE.BoxGeometry(0.01, 0.005, 0.004); hinge.translate(sx * (ex + rx + 0.002), y + 0.004, z); frame.push(hinge);
  }
  const bridge = new THREE.CylinderGeometry(0.0017, 0.0017, 2 * (ex - rx) + 0.004, 8); bridge.rotateZ(Math.PI / 2); bridge.translate(0, y + 0.006, z); frame.push(bridge);
  const finish = (list) => {
    const g = mergeGeometries(list.map((x) => { const n = x.toNonIndexed(); n.deleteAttribute('uv'); return n; }));
    g.setAttribute('_turn', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
    return g;
  };
  return { frame: finish(frame), lens: finish(lens) };
}

function buildModel(s, onReady) {
  const root = new THREE.Group();
  const meta = modelMeta(s);
  const U = { uTurn: { value: new THREE.Vector3() }, uPivot: { value: new THREE.Vector3(meta.neck[0], meta.neck[1], meta.neck[2]) }, uSmile: { value: 0 } };
  const skinTex = tex(`skin_${modelKey(s)}.jpg`);
  const M = {
    skin: withTurn(new THREE.MeshPhysicalMaterial({ map: skinTex, bumpMap: skinTex, bumpScale: 0.35, roughness: 0.48, specularIntensity: 0.8, sheen: 0.2, sheenRoughness: 0.5, sheenColor: 0x4a2620 }), U),
    eyes: withTurn(new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, alphaTest: 0.5 }), U),
    brows: withTurn(new THREE.MeshStandardMaterial({ map: tex('brows.png'), roughness: 0.7, alphaTest: 0.12, alphaToCoverage: true, side: THREE.DoubleSide }), U),
    lashes: withTurn(new THREE.MeshStandardMaterial({ map: tex('lashes.png'), color: 0x0a0a0a, roughness: 0.7, alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide }), U),
    hair: withTurn(new THREE.MeshPhysicalMaterial({ roughness: 0.42, sheen: 0.6, sheenRoughness: 0.35, alphaTest: 0.18, alphaToCoverage: true, side: THREE.DoubleSide }), U),
    clothes: withTurn(new THREE.MeshPhysicalMaterial({ map: tex(`clothes_${s.model}.jpg`), normalMap: tex(`clothes_${s.model}_n.jpg`, false), roughness: 0.9, sheen: 0.35, sheenRoughness: 0.6, sheenColor: 0x555555, side: THREE.DoubleSide }), U),
  };
  M.skin.defines.USE_SKIN = ''; M.skin.defines.USE_SMILE = '';
  const depth = turnDepth(U);
  // the figure and a stool live in `figure`; sitting swaps in the seated vertex positions
  // and lowers the figure so the feet stay on the floor
  const figure = new THREE.Group(); root.add(figure);
  const stool = new THREE.Group(); stool.visible = false; root.add(stool);
  {
    const top = meta.seatY - meta.seatDrop, wood = std({ color: 0x3a2a1c, roughness: 0.6 }), metal = BLACK_METAL();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 32), wood); seat.position.set(0, top - 0.02, -0.02);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, top - 0.05, 12), metal); post.position.set(0, (top - 0.05) / 2 + 0.01, -0.02);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 32), metal); foot.position.set(0, 0.01, -0.02);
    stool.add(seat, post, foot); shadowed(stool);
  }
  const posed = []; // meshes that have seated positions
  const gl = buildGlasses(meta);
  const glasses = new THREE.Group();
  const frameMesh = new THREE.Mesh(gl.frame, withTurn(new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.25, clearcoat: 0.6 }), U));
  frameMesh.castShadow = true; frameMesh.receiveShadow = true; frameMesh.customDepthMaterial = depth; frameMesh.userData.turnU = U; frameMesh.frustumCulled = false;
  const lensMesh = new THREE.Mesh(gl.lens, withTurn(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.0, transmission: 1, thickness: 0.002, ior: 1.5, side: THREE.DoubleSide }), U));
  lensMesh.userData.turnU = U; lensMesh.frustumCulled = false;
  glasses.add(frameMesh, lensMesh); figure.add(glasses);
  const hairMeshes = {};
  let hairTexName = null;
  let current = s;

  const apply = (st) => {
    current = st;
    U.uTurn.value.set((st.yaw || 0) * Math.PI / 180, (st.pitch || 0) * Math.PI / 180, (st.tilt || 0) * Math.PI / 180);
    U.uSmile.value = Math.max(0, Math.min(1, (st.smile || 0) / 100));
    glasses.visible = !!st.glasses;
    const seated = st.pose === 'seated';
    figure.position.y = seated ? -meta.seatDrop : 0; stool.visible = seated;
    for (const m of posed) {
      const g = m.geometry, stand = g.userData.stand || (g.userData.stand = { position: g.attributes.position, normal: g.attributes.normal });
      const pos = seated ? g.attributes._seatpos : stand.position, nrm = seated ? g.attributes._seatnrm : stand.normal;
      if (g.attributes.position !== pos) { g.setAttribute('position', pos); g.setAttribute('normal', nrm); }
    }
    const hc = HAIR_COLORS[st.hairColor] ?? HAIR_COLORS.black;
    M.hair.color.setHex(hc); M.hair.sheenColor.setHex(hc).multiplyScalar(1.6).addScalar(0.04);
    M.brows.color.setHex(hc).multiplyScalar(0.7);
    M.clothes.color.setHex(CLOTHES_COLORS[st.clothes] ?? CLOTHES_COLORS.charcoal);
    const eyeTex = tex(`eye_${st.eyes || 'brown'}.png`);
    if (M.eyes.map !== eyeTex) { M.eyes.map = eyeTex; M.eyes.needsUpdate = true; }
    for (const k in hairMeshes) hairMeshes[k].visible = k === st.hair;
    const hm = hairMeshes[st.hair];
    if (hm && hairTexName !== st.hair) {
      hairTexName = st.hair;
      M.hair.map = tex(`hair_${st.hair}.png`); M.hair.needsUpdate = true;
      hm.customDepthMaterial = turnDepth(U, M.hair.map);
    }
  };

  loadGLB(`assets/models/${modelKey(s)}.glb`).then((geo) => {
    const add = (name, mat, cast = true) => {
      if (!geo[name]) return null;
      const m = new THREE.Mesh(geo[name], mat);
      m.castShadow = cast; m.receiveShadow = true; m.customDepthMaterial = depth; m.frustumCulled = false; m.userData.turnU = U;
      figure.add(m); if (geo[name].attributes._seatpos) posed.push(m); return m;
    };
    add('body', M.skin); add('eyes', M.eyes, false); add('clothes', M.clothes);
    const b = add('brows', M.brows, false); if (b) b.customDepthMaterial = undefined;
    const l = add('lashes', M.lashes, false); if (l) l.customDepthMaterial = undefined;
    for (const name in geo) if (name.startsWith('hair_')) { const h = add(name, M.hair); h.visible = false; hairMeshes[name.slice(5)] = h; }
    apply(current);
    onReady && onReady();
  }).catch((e) => console.warn('model failed to load', e));

  return { group: root, update: apply };
}

export const subjectSig = (s) => (s.type === 'portrait' ? `portrait|${s.model === 'scan' ? 'scan' : modelKey(s)}` : s.type === 'material' ? `material|${s.mat}|${s.shape}` : s.type);

export function buildSubject(s, onReady) {
  if (s.type !== 'portrait') return buildProduct(s.type, s);
  return s.model === 'scan' ? buildPortrait(onReady) : buildModel(s, onReady);
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => m && m.dispose());
    }
  });
}
export { MODIFIERS };
