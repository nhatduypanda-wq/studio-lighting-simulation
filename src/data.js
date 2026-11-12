// Equipment catalogue, photographic constants and lighting presets.
import { MODEL_META } from './models-meta.js';
// Units: metres, degrees, lumen-seconds (flash) / lumens (continuous).

export const ROOM = { w: 7, d: 10, h: 3.2, zMin: -4.5, zMax: 5.5 };

export const LIGHT_TYPES = {
  strobe: { flash: true, q: 8000, ws: 400, kelvin: 5600, mods: ['standard', 'softbox', 'octa', 'strip', 'umb_shoot', 'umb_silver', 'dish', 'snoot'] },
  speedlight: { flash: true, q: 1520, ws: 76, kelvin: 5600, mods: ['speedhead', 'softbox', 'umb_shoot', 'umb_silver', 'snoot'] },
  cob: { flash: false, q: 27000, watts: 300, kelvin: 5600, mods: ['standard', 'softbox', 'octa', 'strip', 'umb_shoot', 'umb_silver', 'dish', 'snoot'] },
  panel: { flash: false, q: 9000, watts: 100, kelvin: 5600, mods: ['panel'] },
};

// gain = on-axis candela per lumen. half = beam half-angle, pen = edge softness (0..1).
export const MODIFIERS = {
  standard: { shape: 'disc', r: 0.09, half: 32, pen: 0.35, gain: 0.84, depth: 0.12 },
  speedhead: { shape: 'rect', w: 0.065, h: 0.04, half: 26, pen: 0.4, gain: 2.1, depth: 0.05 },
  softbox: { shape: 'rect', w: 0.6, h: 0.9, half: 68, pen: 0.9, gain: 0.16, depth: 0.4, grid: { half: 28, pen: 0.6, gain: 0.13 } },
  octa: { shape: 'disc', r: 0.6, half: 68, pen: 0.9, gain: 0.16, depth: 0.5, sides: 8, grid: { half: 28, pen: 0.6, gain: 0.13 } },
  strip: { shape: 'rect', w: 0.3, h: 1.2, half: 68, pen: 0.9, gain: 0.15, depth: 0.35, grid: { half: 26, pen: 0.6, gain: 0.12 } },
  umb_shoot: { shape: 'disc', r: 0.5, half: 70, pen: 1.0, gain: 0.12, depth: 0.22 },
  umb_silver: { shape: 'disc', r: 0.5, half: 55, pen: 0.7, gain: 0.3, depth: 0.22 },
  dish: { shape: 'disc', r: 0.275, half: 40, pen: 0.6, gain: 0.45, depth: 0.13, grid: { half: 20, pen: 0.5, gain: 0.4 } },
  snoot: { shape: 'disc', r: 0.03, half: 9, pen: 0.5, gain: 0.6, depth: 0.25 },
  panel: { shape: 'rect', w: 0.6, h: 0.4, half: 62, pen: 0.9, gain: 0.25, depth: 0.05 },
};

export const PANELS = {
  disc80: { shape: 'disc', r: 0.4 },
  disc110: { shape: 'disc', r: 0.55 },
  vflat: { shape: 'rect', w: 1.0, h: 2.0 },
};
export const PANEL_SURFACES = {
  white: { color: 0xf2f2f2, rough: 0.95, metal: 0 },
  silver: { color: 0xffffff, rough: 0.6, metal: 0 },
  gold: { color: 0xffd9a0, rough: 0.6, metal: 0 },
  black: { color: 0x050505, rough: 1, metal: 0 },
};

export const SUBJECTS = ['portrait', 'material', 'spheres', 'bottle', 'vase', 'shaker'];
export const MODELS = ['female', 'male', 'scan'];
export const LOOKS = ['asi', 'cau', 'afr'];
export const AGES = ['young', 'old'];
export const HAIR_COLORS = { black: 0x0b0a09, darkbrown: 0x24160d, brown: 0x4a2f1c, blonde: 0xb39160, red: 0x74331a, grey: 0x8e8e8e, white: 0xdcdcdc };
export const EYE_COLORS = ['brown', 'blue', 'green'];
export const CLOTHES_COLORS = { charcoal: 0x3a3a40, black: 0x121212, white: 0xe6e6e6, navy: 0x1d2946, red: 0x7c1d24, beige: 0xb9a688 };
export const modelKey = (s) => `${s.model}_${s.eth}_${s.age}`;
export const modelMeta = (s) => MODEL_META[modelKey(s)] || MODEL_META.female_asi_young;
export const SKIN_TONES = { light: [1, 1, 1], medium: [0.86, 0.74, 0.66], tan: [0.66, 0.5, 0.4], deep: [0.4, 0.28, 0.22] };
export const BACKDROPS = { white: '#f4f4f2', lightgray: '#b9b9b9', gray: '#777777', black: '#0c0c0c', blue: '#3d5a80', beige: '#c9b79c', red: '#9b2d30', green: '#2f5d50' };
export const WALLS = { white: '#e8e8e8', gray: '#6e6e6e', black: '#111111' };

export const APERTURES = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
export const SHUTTERS = [30, 60, 125, 160, 200, 250, 500, 1000, 2000, 4000];
export const ISOS = [50, 100, 200, 400, 800, 1600, 3200, 6400];
export const FOCALS = [24, 35, 50, 85, 105, 135, 200];
export const ASPECTS = { '3:2': 1.5, '2:3': 2 / 3, '4:5': 0.8, '1:1': 1, '16:9': 16 / 9 };
export const SYNC_SPEED = 200;

let uid = 1;
export const nextId = () => 'e' + Date.now().toString(36) + (uid++);

export function makeLight(o = {}) {
  return { id: nextId(), kind: 'light', type: 'strobe', mod: 'softbox', grid: false, stops: -2, kelvin: 5600, on: true, x: -1.2, z: 1.2, h: 1.9, feather: 0, ...o };
}
export function makePanel(o = {}) {
  return { id: nextId(), kind: 'panel', surface: 'white', size: 'disc110', on: true, x: 0.9, z: 0.4, h: 1.3, ...o };
}

export function defaultState() {
  const st = {
    v: 1,
    view: 'camera',
    subject: { type: 'portrait', model: 'female', eth: 'asi', age: 'young', hair: 'long01', hairColor: 'black', eyes: 'brown', clothes: 'charcoal', skin: 'light', yaw: 0, pitch: 0, tilt: 0, rot: 0, table: 'white', mat: 'cotton', shape: 'ball' },
    set: { backdrop: 'gray', backdropColor: BACKDROPS.gray, backDist: 2.0, walls: 'gray' },
    camera: { focal: 85, aperture: 8, shutter: 160, iso: 100, wb: 5600, dist: 2.1, height: 1.57, angle: 0, aspect: '4:5', clip: false },
    items: PRESETS.rembrandt.items(),
    selected: null,
  };
  // presets are authored for a subject whose face is at 1.57 m
  const dy = subjectTarget(st.subject).y - PRESET_FACE_Y;
  for (const i of st.items) i.h += dy;
  st.camera.height += dy;
  return st;
}
export const PRESET_FACE_Y = 1.57;

// Positions use polar coordinates around the subject: a = angle from the camera axis
// (0 = on the camera axis, + = camera right), d = distance, h = height.
const P = (a, d) => ({ x: Math.sin(a * Math.PI / 180) * d, z: Math.cos(a * Math.PI / 180) * d });

export const PRESETS = {
  rembrandt: {
    items: () => [
      makeLight({ mod: 'octa', ...P(-45, 1.5), h: 2.2, stops: -5 / 3 }),
      makePanel({ ...P(70, 0.9), h: 1.4 }),
    ],
  },
  loop: {
    items: () => [
      makeLight({ mod: 'softbox', ...P(-30, 1.5), h: 2.0, stops: -2 }),
      makeLight({ mod: 'umb_shoot', ...P(25, 2.4), h: 1.7, stops: -3.7 }),
    ],
  },
  butterfly: {
    items: () => [makeLight({ mod: 'dish', ...P(0, 1.3), h: 2.35, stops: -3.7 })],
  },
  clamshell: {
    items: () => [
      makeLight({ mod: 'dish', ...P(0, 1.3), h: 2.35, stops: -3.7 }),
      makePanel({ size: 'disc80', surface: 'silver', ...P(0, 0.6), h: 1.05 }),
    ],
  },
  split: {
    items: () => [makeLight({ mod: 'strip', ...P(-90, 1.2), h: 1.6, stops: -2.3 })],
  },
  rim: {
    items: () => [
      makeLight({ mod: 'strip', grid: true, ...P(-140, 1.6), h: 1.8, stops: -1.3 }),
      makeLight({ mod: 'strip', grid: true, ...P(140, 1.6), h: 1.8, stops: -1.3 }),
      makeLight({ mod: 'octa', ...P(15, 1.8), h: 1.9, stops: -3.3 }),
    ],
  },
  hard: {
    items: () => [makeLight({ mod: 'standard', ...P(-40, 2.2), h: 2.3, stops: -4.7 })],
  },
  continuous: {
    items: () => [
      makeLight({ type: 'cob', mod: 'octa', ...P(-40, 1.3), h: 2.0, stops: -1 }),
      makeLight({ type: 'panel', mod: 'panel', ...P(150, 1.6), h: 1.9, stops: 0, kelvin: 3200 }),
    ],
    camera: { aperture: 2.8, shutter: 125, iso: 200 },
  },
};

// ---- photometry helpers ----------------------------------------------------

export function modSpec(item) {
  const lt = LIGHT_TYPES[item.type];
  let id = item.mod;
  if (!lt.mods.includes(id)) id = lt.mods[0];
  const m = MODIFIERS[id];
  const g = item.grid && m.grid ? m.grid : null;
  return { id, ...m, half: g ? g.half : m.half, pen: g ? g.pen : m.pen, gain: g ? g.gain : m.gain, hasGrid: !!m.grid };
}

// On-axis luminous intensity in cd·s (flash) or cd (continuous).
export function axisIntensity(item) {
  const lt = LIGHT_TYPES[item.type];
  return lt.q * Math.pow(2, item.stops) * modSpec(item).gain;
}

// Scale that maps photometric exposure to linear pixel value: an 18 % grey card lit to
// the metered exposure (H = 250·N²/ISO lux·s) renders at 0.18.
export function exposureScale(cam, flash) {
  const k = Math.PI * cam.iso / (250 * cam.aperture * cam.aperture);
  return flash ? k : k / cam.shutter;
}

// Tanner Helland black-body approximation, returned in linear RGB.
export function kelvinRGB(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  const lin = (v) => { v = Math.min(255, Math.max(0, v)) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return [lin(r), lin(g), lin(b)];
}

// Colour of a light as seen by a camera balanced for wb, luminance-normalised.
export function lightColor(kelvin, wb) {
  const a = kelvinRGB(kelvin), w = kelvinRGB(wb);
  const c = [a[0] / w[0], a[1] / w[1], a[2] / Math.max(w[2], 1e-3)];
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map((v) => v / y);
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Unit vector from the light towards its aim point (subject, rotated by feather).
export function lightDir(item, target) {
  let dx = target.x - item.x, dy = target.y - item.h, dz = target.z - item.z;
  const f = (item.feather || 0) * Math.PI / 180;
  if (f) { const c = Math.cos(f), s = Math.sin(f); const nx = dx * c + dz * s; dz = -dx * s + dz * c; dx = nx; }
  const l = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / l, y: dy / l, z: dz / l, len: l };
}

// Incident-meter reading at the subject for one light: equivalent f-number at the camera's ISO/shutter.
export function meterLight(item, target, cam) {
  if (item.kind !== 'light' || !item.on) return null;
  const m = modSpec(item), lt = LIGHT_TYPES[item.type];
  const dir = lightDir(item, target);
  const tx = target.x - item.x, ty = target.y - item.h, tz = target.z - item.z;
  const d = Math.hypot(tx, ty, tz) || 1e-3;
  const cosT = (tx * dir.x + ty * dir.y + tz * dir.z) / d;
  const half = m.half * Math.PI / 180;
  const fall = smoothstep(Math.cos(half), Math.cos(half * (1 - m.pen)), cosT);
  let H = axisIntensity(item) * fall / (d * d);
  if (!lt.flash) H /= cam.shutter;
  const N = Math.sqrt(H * cam.iso / 250);
  return { H, N, ev: N > 0 ? 2 * Math.log2(N / cam.aperture) : -Infinity, d };
}

export function subjectTarget(subject) {
  if (subject.type === 'portrait') {
    if (subject.model === 'scan') return { x: 0, y: 1.57, z: 0 };
    const m = modelMeta(subject);
    return { x: 0, y: m.eyeY - 0.035, z: 0.03 };
  }
  return { x: 0, y: PRODUCT_Y[subject.type] ?? 1.05, z: 0 };
}
const PRODUCT_Y = { material: 1.02, spheres: 0.985, bottle: 1.08, vase: 1.08, shaker: 1.04 };
export const PRODUCT_CAMERA = {
  material: { focal: 85, aspect: '1:1', dist: 1.15 },
  spheres: { focal: 50, dist: 1.7, aspect: '3:2' },
  bottle: { focal: 85, dist: 1.35, aspect: '4:5' },
  vase: { focal: 85, dist: 1.35, aspect: '4:5' },
  shaker: { focal: 85, dist: 1.2, aspect: '4:5' },
};

export function cameraPose(cam, target) {
  const a = cam.angle * Math.PI / 180;
  return { x: target.x + Math.sin(a) * cam.dist, y: cam.height, z: target.z + Math.cos(a) * cam.dist };
}

export function sensorSize(aspect) {
  if (aspect >= 1.5) return { w: 36, h: 36 / aspect };
  if (aspect >= 1) return { w: 24 * aspect, h: 24 };
  if (aspect > 2 / 3) return { w: 24, h: 24 / aspect };
  return { w: 36 * aspect, h: 36 };
}
