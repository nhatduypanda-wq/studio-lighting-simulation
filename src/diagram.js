// Top-down lighting diagram: shows the set and lets the user drag lights and the camera.
import { PANELS, PANEL_SURFACES, LIGHT_TYPES, ASPECTS, modSpec, lightDir, subjectTarget, cameraPose, sensorSize, kelvinRGB } from './data.js';

const REGION = { cx: 0, cz: 0.9, w: 6.6, h: 8.2 };
export const LIMITS = { x: 3.3, zMin: -4.2, zMax: 5.2 };

export class Diagram {
  constructor(canvas, { getState, onMove, onSelect, onMoveCamera, labels }) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.getState = getState; this.onMove = onMove; this.onSelect = onSelect; this.onMoveCamera = onMoveCamera; this.labels = labels;
    this.drag = null;
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    const up = (e) => { if (this.drag) { this.drag = null; try { canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ } } };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  _fit() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (this.c.width !== W || this.c.height !== H) { this.c.width = W; this.c.height = H; }
    this.cssW = r.width; this.cssH = r.height; this.dpr = dpr;
    this.s = Math.min(r.width / REGION.w, r.height / REGION.h);
  }
  X(x) { return this.cssW / 2 + (x - REGION.cx) * this.s; }
  Z(z) { return this.cssH / 2 + (z - REGION.cz) * this.s; }
  inv(px, py) { return { x: (px - this.cssW / 2) / this.s + REGION.cx, z: (py - this.cssH / 2) / this.s + REGION.cz }; }

  _pt(e) { const r = this.c.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; }

  _down(e) {
    const st = this.getState(); if (!this.s) return;
    const { px, py } = this._pt(e);
    const T = subjectTarget(st.subject);
    let best = null, bd = 26;
    for (const it of st.items) { const d = Math.hypot(this.X(it.x) - px, this.Z(it.z) - py); if (d < bd) { bd = d; best = { id: it.id, ox: this.X(it.x) - px, oz: this.Z(it.z) - py }; } }
    const cp = cameraPose(st.camera, T);
    if (!best) { const d = Math.hypot(this.X(cp.x) - px, this.Z(cp.z) - py); if (d < 26) best = { cam: true, ox: this.X(cp.x) - px, oz: this.Z(cp.z) - py }; }
    if (!best) { this.onSelect(null); return; }
    this.drag = best;
    this.c.setPointerCapture(e.pointerId);
    if (best.id) this.onSelect(best.id);
    e.preventDefault();
  }

  _move(e) {
    if (!this.drag) return;
    const { px, py } = this._pt(e);
    const w = this.inv(px + this.drag.ox, py + this.drag.oz);
    if (this.drag.cam) this.onMoveCamera(w.x, w.z);
    else this.onMove(this.drag.id, Math.max(-LIMITS.x, Math.min(LIMITS.x, w.x)), Math.max(LIMITS.zMin, Math.min(LIMITS.zMax, w.z)));
    e.preventDefault();
  }

  draw() {
    const st = this.getState(); if (!st) return;
    this._fit();
    if (!this.cssW || !this.cssH) return;
    const g = this.ctx, s = this.s;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.cssW, this.cssH);
    const T = subjectTarget(st.subject);

    // room and 1 m grid
    g.fillStyle = '#222325'; g.fillRect(this.X(-3.5), this.Z(-4.5), 7 * s, 10 * s);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.beginPath();
    for (let x = -3; x <= 3; x++) { g.moveTo(this.X(x), this.Z(-4.5)); g.lineTo(this.X(x), this.Z(5.5)); }
    for (let z = -4; z <= 5; z++) { g.moveTo(this.X(-3.5), this.Z(z)); g.lineTo(this.X(3.5), this.Z(z)); }
    g.stroke();
    g.strokeStyle = '#4a4d52'; g.lineWidth = 2; g.strokeRect(this.X(-3.5), this.Z(-4.5), 7 * s, 10 * s);

    // backdrop paper
    const bz = -st.set.backDist;
    g.fillStyle = st.set.backdropColor; g.globalAlpha = 0.28;
    g.fillRect(this.X(-1.36), this.Z(bz), 2.72 * s, 4.2 * s);
    g.globalAlpha = 1;
    g.strokeStyle = st.set.backdropColor; g.lineWidth = 4; g.beginPath(); g.moveTo(this.X(-1.36), this.Z(bz)); g.lineTo(this.X(1.36), this.Z(bz)); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(this.X(-1.36), this.Z(bz) - 2, 2.72 * s, 4);

    // camera with field of view
    const cp = cameraPose(st.camera, T);
    const ss = sensorSize(ASPECTS[st.camera.aspect] || 1);
    const hf = Math.atan(ss.w / 2 / st.camera.focal);
    const ca = Math.atan2(T.x - cp.x, T.z - cp.z);
    g.fillStyle = 'rgba(120,170,255,.10)'; g.beginPath(); g.moveTo(this.X(cp.x), this.Z(cp.z));
    for (const a of [ca - hf, ca + hf]) g.lineTo(this.X(cp.x + Math.sin(a) * 9), this.Z(cp.z + Math.cos(a) * 9));
    g.closePath(); g.fill();
    g.save(); g.translate(this.X(cp.x), this.Z(cp.z)); g.rotate(-ca);
    g.fillStyle = '#8fb4ff'; g.fillRect(-9, -5, 18, 11); g.fillRect(-4, 5, 8, 6);
    g.restore();
    this._label(this.labels().cam, this.X(cp.x), this.Z(cp.z) - 12, '#8fb4ff');

    // subject
    if (st.subject.type === 'portrait') {
      const yaw = (st.subject.yaw || 0) * Math.PI / 180;
      g.save(); g.translate(this.X(0), this.Z(0));
      g.fillStyle = '#3b3d42'; g.beginPath(); g.ellipse(0, 0, 0.22 * s, 0.11 * s, -yaw * 0.35, 0, 7); g.fill();
      g.rotate(-yaw);
      g.fillStyle = '#d9b9a3'; g.beginPath(); g.ellipse(0, 0, 0.085 * s, 0.1 * s, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-0.025 * s, 0.09 * s); g.lineTo(0, 0.135 * s); g.lineTo(0.025 * s, 0.09 * s); g.fill();
      g.restore();
    } else {
      g.fillStyle = '#3b3d42'; g.fillRect(this.X(-0.65), this.Z(-0.4), 1.3 * s, 0.8 * s);
      g.fillStyle = '#d9d9d9'; g.beginPath(); g.arc(this.X(0), this.Z(0), 0.07 * s + 2, 0, 7); g.fill();
    }

    // equipment
    let n = 0;
    for (const it of st.items) {
      n++;
      const sel = it.id === st.selected;
      const px = this.X(it.x), py = this.Z(it.z);
      let ang, width, color;
      if (it.kind === 'light') {
        const d = lightDir(it, T); ang = Math.atan2(d.x, d.z);
        const m = modSpec(it); width = (m.shape === 'disc' ? m.r * 2 : m.w);
        const lt = LIGHT_TYPES[it.type]; const k = kelvinRGB(lt.flash ? lt.kelvin : it.kelvin);
        const srgb = (v) => Math.round(255 * Math.pow(Math.min(1, v), 1 / 2.2));
        color = `rgb(${srgb(k[0])},${srgb(k[1])},${srgb(k[2])})`;
        if (it.on) {
          const half = Math.min(m.half, 70) * Math.PI / 180, len = Math.min(d.len * Math.hypot(d.x, d.z) + 0.5, 3.2) * s;
          const grad = g.createRadialGradient(px, py, 0, px, py, len);
          grad.addColorStop(0, 'rgba(255,225,150,.32)'); grad.addColorStop(1, 'rgba(255,225,150,0)');
          g.fillStyle = grad; g.beginPath(); g.moveTo(px, py);
          g.arc(px, py, len, Math.PI / 2 - ang - half, Math.PI / 2 - ang + half); g.closePath(); g.fill();
        }
      } else {
        ang = Math.atan2(T.x - it.x, T.z - it.z);
        const p = PANELS[it.size] || PANELS.disc110; width = p.shape === 'disc' ? p.r * 2 : p.w;
        color = '#' + (PANEL_SURFACES[it.surface] || PANEL_SURFACES.white).color.toString(16).padStart(6, '0');
        if (it.surface === 'black') color = '#000';
      }
      const wpx = Math.max(14, width * s);
      g.save(); g.translate(px, py); g.rotate(-ang);
      g.globalAlpha = it.on === false ? 0.4 : 1;
      if (it.kind === 'light') { g.fillStyle = '#111'; g.beginPath(); g.moveTo(-wpx / 2, 0); g.lineTo(wpx / 2, 0); g.lineTo(5, -Math.max(8, wpx * 0.45)); g.lineTo(-5, -Math.max(8, wpx * 0.45)); g.closePath(); g.fill(); g.strokeStyle = '#777'; g.lineWidth = 1; g.stroke(); }
      g.strokeStyle = color; g.lineWidth = it.kind === 'light' ? 4 : 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-wpx / 2, 0); g.lineTo(wpx / 2, 0); g.stroke();
      if (it.kind === 'panel') { g.strokeStyle = '#888'; g.lineWidth = 1; g.strokeRect(-wpx / 2, -3, wpx, 6); }
      g.restore(); g.globalAlpha = 1;
      // number badge
      const bx = px - Math.sin(ang) * 16, by = py - Math.cos(ang) * 16;
      g.fillStyle = sel ? '#f2b33d' : '#55585d'; g.beginPath(); g.arc(bx, by, 10, 0, 7); g.fill();
      g.fillStyle = sel ? '#1a1404' : '#fff'; g.font = '700 11px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(n), bx, by + 0.5);
      if (sel) { g.strokeStyle = '#f2b33d'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath(); g.arc(px, py, Math.max(20, wpx / 2 + 6), 0, 7); g.stroke(); g.setLineDash([]); }
    }

    // 1 m scale bar
    g.strokeStyle = '#8a8d91'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, this.cssH - 12); g.lineTo(10 + s, this.cssH - 12); g.stroke();
    this._label('1 ' + this.labels().m, 10 + s / 2, this.cssH - 22, '#8a8d91');
  }

  _label(text, x, y, color) {
    const g = this.ctx;
    g.font = '11px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(text, x, y);
  }
}
