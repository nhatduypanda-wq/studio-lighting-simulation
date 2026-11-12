// Material library for the "material sample" subject. Surface structure (weave, grain,
// brushing, wood rings) is drawn into small canvases and used as colour or bump maps.
import * as THREE from 'three';

export const MATERIAL_IDS = ['cotton', 'silk', 'velvet', 'leather', 'wood', 'paper', 'plasticGloss', 'plasticMatte', 'rubber',
  'steelBrushed', 'chrome', 'gold', 'copper', 'glass', 'glassFrosted', 'porcelain'];
export const SHAPE_IDS = ['ball', 'drape', 'cube', 'cylinder', 'knot'];

const cache = new Map();
function canvasTex(key, size, draw, repeat = 1, srgb = false) {
  const k = key + repeat;
  if (!cache.has(k)) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(k, t);
  }
  return cache.get(k);
}
// deterministic pseudo-random numbers so the textures look the same every time
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

const weave = (g, n) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  const r = rng(7), step = n / 16;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const over = (x + y) % 2 === 0, v = (over ? 200 : 70) + r() * 30;
    g.fillStyle = `rgb(${v},${v},${v})`;
    if (over) g.fillRect(x * step + 1, y * step, step - 2, step); else g.fillRect(x * step, y * step + 1, step, step - 2);
  }
};
const grain = (g, n) => {
  g.fillStyle = '#909090'; g.fillRect(0, 0, n, n);
  const r = rng(11);
  for (let i = 0; i < 900; i++) {
    const x = r() * n, y = r() * n, s = 3 + r() * 7, v = 150 + r() * 90;
    g.strokeStyle = '#404040'; g.lineWidth = 1.5; g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.5), r() * 3, 0, 7); g.fill(); g.stroke();
  }
};
const brushed = (g, n) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  const r = rng(3);
  for (let i = 0; i < 2600; i++) { const v = 60 + r() * 160; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(r() * n - 40, r() * n, 30 + r() * 120, 1); }
};
const speckle = (g, n) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  const r = rng(5);
  for (let i = 0; i < 9000; i++) { const v = 90 + r() * 80; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
};
const woodColor = (g, n) => {
  const r = rng(21);
  g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, n, n);
  for (let x = 0; x < n; x++) {
    const ring = Math.sin(x * 0.11 + Math.sin(x * 0.013) * 6) * 0.5 + 0.5;
    const v = 0.72 + 0.28 * ring + (r() - 0.5) * 0.06;
    g.fillStyle = `rgb(${154 * v | 0},${104 * v | 0},${60 * v | 0})`;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= n; y += 16) g.lineTo(x + Math.sin(y * 0.02 + x * 0.01) * 5, y);
    g.lineTo(x + 2, n); g.lineTo(x + 2, 0); g.fill();
  }
};

export function materialParams(id) {
  switch (id) {
    case 'cotton': return { color: 0xd9d5cc, roughness: 0.95, sheen: 0.5, sheenRoughness: 0.7, sheenColor: 0xffffff, bumpMap: canvasTex('weave', 256, weave, 14), bumpScale: 1.2 };
    case 'silk': return { color: 0x8c1d2e, roughness: 0.32, sheen: 1, sheenRoughness: 0.22, sheenColor: 0xffb0b8, anisotropy: 0.6 };
    case 'velvet': return { color: 0x1c0f3e, roughness: 1, sheen: 1, sheenRoughness: 0.85, sheenColor: 0x9a7cff };
    case 'leather': return { color: 0x3d2414, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4, bumpMap: canvasTex('grain', 512, grain, 4), bumpScale: 1.5 };
    case 'wood': return { map: canvasTex('wood', 512, woodColor, 1, true), roughness: 0.55, bumpMap: canvasTex('wood', 512, woodColor, 1, true), bumpScale: 0.4 };
    case 'paper': return { color: 0xeeeeea, roughness: 1, bumpMap: canvasTex('speckle', 256, speckle, 6), bumpScale: 0.3 };
    case 'plasticGloss': return { color: 0xc81e1e, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 };
    case 'plasticMatte': return { color: 0x2a66c8, roughness: 0.62 };
    case 'rubber': return { color: 0x151515, roughness: 0.88 };
    case 'steelBrushed': return { color: 0xd4d4d4, metalness: 1, roughness: 0.36, anisotropy: 0.85, bumpMap: canvasTex('brushed', 512, brushed, 2), bumpScale: 0.25 };
    case 'chrome': return { color: 0xffffff, metalness: 1, roughness: 0.03 };
    case 'gold': return { color: 0xffc66b, metalness: 1, roughness: 0.16 };
    case 'copper': return { color: 0xd47a52, metalness: 1, roughness: 0.26 };
    case 'glass': return { color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.12, ior: 1.5 };
    case 'glassFrosted': return { color: 0xffffff, roughness: 0.45, transmission: 1, thickness: 0.12, ior: 1.5 };
    default: return { color: 0xf4f1ea, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.08 };
  }
}

export function sampleGeometry(shape) {
  switch (shape) {
    case 'cube': { const g = new THREE.BoxGeometry(0.15, 0.15, 0.15, 1, 1, 1); g.translate(0, 0.075, 0); g.rotateY(0.6); return g; }
    case 'cylinder': { const g = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 64); g.translate(0, 0.1, 0); return g; }
    case 'knot': { const g = new THREE.TorusKnotGeometry(0.065, 0.024, 220, 28); g.translate(0, 0.12, 0); return g; }
    case 'drape': {
      // a cloth hanging from a rail, with folds that deepen towards the bottom
      const g = new THREE.PlaneGeometry(0.46, 0.4, 160, 60);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), d = 0.5 - y / 0.4; // 0 at the top, 1 at the bottom
        p.setZ(i, Math.sin(x * 42 + Math.sin(x * 9) * 1.5) * (0.008 + 0.03 * d) + Math.sin(x * 15) * 0.012 * d);
      }
      g.translate(0, 0.21, 0); g.computeVertexNormals(); return g;
    }
    default: { const g = new THREE.SphereGeometry(0.095, 96, 64); g.translate(0, 0.095, 0); return g; }
  }
}
