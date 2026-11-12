// High-quality capture: renders the current set with a GPU path tracer
// (three-gpu-pathtracer). A separate scene is built for it: meshes are shared with the
// live view, the head turn is baked into the geometry, soft lamps become area lights and
// focused lamps become spot lights with a radius.
import * as THREE from 'three';
import { WebGLPathTracer, PhysicalSpotLight, ShapedAreaLight, PhysicalCamera } from '../vendor/three-gpu-pathtracer.js';
import { ASPECTS, sensorSize } from './data.js';
import { goboTexture } from './models.js';

// A real gobo: a black plate with holes, placed in front of the optical spot.
function goboPlate(id, size) {
  const src = goboTexture(id).image, n = src.width, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, n, n), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i + 3] = d[i] > 128 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = 0; }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, map, alphaTest: 0.5, transparent: true, side: THREE.DoubleSide, roughness: 1 });
  return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat), map, mat };
}

const AREA_MODS = new Set(['softbox', 'octa', 'strip', 'umb_shoot', 'panel', 'ring', 'tube', 'window']);

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
  const smile = mesh.material.defines && 'USE_SMILE' in mesh.material.defines ? src.attributes._smile : null, sm = U.uSmile ? U.uSmile.value : 0;
  for (let i = 0; i < pos.count; i++) {
    const w = turn.getX(i);
    if (smile && sm > 0) pos.setXYZ(i, pos.getX(i) + smile.getX(i) * sm, pos.getY(i) + smile.getY(i) * sm, pos.getZ(i) + smile.getZ(i) * sm);
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
      if (rig.emit) {
        light = new ShapedAreaLight(l.color, l.intensity / (Math.PI * rig.emit.r * rig.emit.r), rig.emit.r * 2, rig.emit.r * 2);
        light.isCircular = true;
        light.position.copy(rig.center);
        light.lookAt(engine.target);
      } else if (AREA_MODS.has(m.id) && !grid) {
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
        if (m.id === 'optical' && rig.item && rig.item.gobo && rig.item.gobo !== 'none') {
          const dist = 0.35, dir = l.target.position.clone().sub(rig.center).normalize();
          const plate = goboPlate(rig.item.gobo, 2 * dist * Math.tan(l.angle) * 1.2);
          plate.mesh.position.copy(rig.center).addScaledVector(dir, dist);
          plate.mesh.lookAt(rig.center);
          scene.add(plate.mesh);
          this.temp.push(plate.mesh.geometry, plate.map, plate.mat);
        }
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
