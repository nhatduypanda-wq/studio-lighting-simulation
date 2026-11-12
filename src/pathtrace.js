// High-quality capture: renders the current set with a GPU path tracer
// (three-gpu-pathtracer). A separate scene is built for it: meshes are shared with the
// live view, the head turn is baked into the geometry, soft lamps become area lights and
// focused lamps become spot lights with a radius.
import * as THREE from 'three';
import { WebGLPathTracer, PhysicalSpotLight, ShapedAreaLight, PhysicalCamera } from '../vendor/three-gpu-pathtracer.js';
import { ASPECTS, sensorSize } from './data.js';

const AREA_MODS = new Set(['softbox', 'octa', 'strip', 'umb_shoot', 'panel', 'ring', 'tube']);

function bakeTurn(mesh) {
  const U = mesh.userData.turnU, src = mesh.geometry;
  const turn = src.attributes._turn;
  if (!U || !turn) return src;
  const g = new THREE.BufferGeometry();
  g.setIndex(src.index);
  if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv);
  const pos = src.attributes.position.clone(), nrm = src.attributes.normal.clone();
  const t = U.uTurn.value, pivot = U.uPivot.value;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const w = turn.getX(i);
    if (w === 0) continue;
    q.setFromEuler(e.set(t.y * w, t.x * w, t.z * w, 'YXZ'));
    v.fromBufferAttribute(pos, i).sub(pivot).applyQuaternion(q).add(pivot); pos.setXYZ(i, v.x, v.y, v.z);
    v.fromBufferAttribute(nrm, i).applyQuaternion(q); nrm.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('position', pos); g.setAttribute('normal', nrm);
  return g;
}

export class HighQuality {
  constructor(engine) {
    this.engine = engine;
    this.temp = [];
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    engine.scene.updateMatrixWorld(true);

    const faces = new Set();
    for (const rig of engine.rigs.values()) for (const f of rig.faces) faces.add(f);
    const hiddenRoots = [engine.camRig.group];
    const isHidden = (o) => { for (let p = o; p; p = p.parent) { if (!p.visible || hiddenRoots.includes(p)) return true; } return false; };

    engine.scene.traverse((o) => {
      if (!o.isMesh || faces.has(o) || o.userData.noHQ || isHidden(o)) return;
      const geo = bakeTurn(o);
      if (geo !== o.geometry) this.temp.push(geo);
      const m = new THREE.Mesh(geo, o.material);
      m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrixWorld.copy(o.matrixWorld);
      scene.add(m);
    });

    for (const rig of engine.rigs.values()) {
      const l = rig.light;
      if (!l || !l.visible || l.intensity <= 0) continue;
      const m = rig.spec, grid = rig.item && rig.item.grid && m.hasGrid;
      const area = m.shape === 'disc' ? Math.PI * m.r * m.r : m.w * m.h;
      let light;
      if (AREA_MODS.has(m.id) && !grid) {
        const w = m.shape === 'disc' ? m.r * 2 : m.w, h = m.shape === 'disc' ? m.r * 2 : m.h;
        light = new ShapedAreaLight(l.color, l.intensity / area, w, h);
        light.isCircular = m.shape === 'disc';
        light.position.copy(rig.center);
        light.lookAt(l.target.position);
      } else {
        light = new PhysicalSpotLight(l.color, l.intensity, 0, l.angle, l.penumbra, 2);
        light.radius = Math.sqrt(area / Math.PI);
        light.position.copy(rig.center);
        light.target.position.copy(l.target.position);
        scene.add(light.target);
      }
      scene.add(light);
    }
    scene.updateMatrixWorld(true);

    const st = engine.state.camera, src = engine.photoCam;
    const cam = this.camera = new PhysicalCamera(src.fov, src.aspect, 0.05, 40);
    const ss = sensorSize(ASPECTS[st.aspect] || 1);
    cam.filmGauge = src.aspect >= 1 ? ss.w : ss.h;
    cam.position.copy(engine.camPos); cam.lookAt(engine.target);
    cam.fStop = st.aperture; cam.apertureBlades = 0;
    cam.focusDistance = engine.camPos.distanceTo(engine.target);
    cam.updateMatrixWorld(true);

    const pt = this.pt = new WebGLPathTracer(engine.renderer);
    pt.bounces = 6; pt.transmissiveBounces = 8;
    pt.filterGlossyFactor = 0.5;
    pt.tiles.set(engine.mobile ? 3 : 2, engine.mobile ? 3 : 2);
    pt.renderScale = engine.mobile ? 0.75 : 1;
    pt.minSamples = 1; pt.fadeDuration = 0; pt.renderDelay = 0;
    pt.rasterizeScene = false; pt.dynamicLowRes = false;
    pt.textureSize.set(1024, 1024);
    pt.setScene(scene, cam);
    this.target = engine.mobile ? 150 : 400;
  }

  step() {
    this.pt.renderSample();
    return Math.floor(this.pt.samples);
  }

  dispose() {
    this.pt.dispose();
    for (const g of this.temp) g.dispose();
    const r = this.engine.renderer;
    r.setRenderTarget(null); r.autoClear = false;
  }
}
