// Renderer: shadowed spot lights jittered over the real emitter area and accumulated
// over frames (soft shadows, depth of field, anti-aliasing), plus two light probes at the
// subject: one with the lamp faces (specular reflections) and one without (bounce light).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { LIGHT_TYPES, ASPECTS, axisIntensity, exposureScale, lightTint, lightColor, MODELING, lightDir, scrimFor, subjectTarget, cameraPose, sensorSize, WALLS } from './data.js';
import { envDiffuse, buildRoom, buildBackdrop, buildLightRig, buildPanelRig, buildCameraRig, buildSubject, subjectSig, disposeTree, setAssetCallback, goboTexture } from './models.js';

// --- shader patches (must run before any material compiles) ---
function patch(chunk, find, repl) {
  const src = THREE.ShaderChunk[chunk];
  if (!src.includes(find)) throw new Error('shader patch target missing in ' + chunk);
  THREE.ShaderChunk[chunk] = src.replace(find, repl);
}
patch('envmap_physical_pars_fragment', 'vec3 getIBLIrradiance', 'uniform sampler2D envMapDiffuse;\n\tvec3 getIBLIrradiance');
patch('envmap_physical_pars_fragment', 'textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 )', 'textureCubeUV( envMapDiffuse, envMapRotation * worldNormal, 1.0 )');
// Specular highlights come from the probe (which sees the true shape of each lamp),
// so the point-light specular term is removed to avoid counting it twice.
patch('lights_physical_pars_fragment', 'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );', '');

// Skin (materials with the USE_SKIN define): approximate subsurface scattering.
//  - each colour channel looks up the shadow a little further above the surface, so light
//    wraps around the terminator and shadow edges further for red than for blue;
//  - the distance light travels inside the head is read from the shadow map, which lets
//    light glow through thin parts such as ears and nostrils when lit from behind.
export const SHADOW_NEAR = 0.12, SHADOW_FAR = 14;
THREE.ShaderChunk.shadowmap_pars_vertex += '\n#ifdef USE_SKIN\n\tvarying vec3 vSkinWorld;\n#endif\n';
THREE.ShaderChunk.worldpos_vertex += '\n#ifdef USE_SKIN\n\tvSkinWorld = worldPosition.xyz;\n#endif\n';
THREE.ShaderChunk.lights_physical_pars_fragment = `
#ifdef USE_SKIN
	varying vec3 vSkinWorld;
	vec3 skinShadowRGB = vec3( 1.0 );
	vec3 skinTrans = vec3( 0.0 );
#endif
` + THREE.ShaderChunk.lights_physical_pars_fragment;
THREE.ShaderChunk.shadowmap_pars_fragment += `
#if defined( USE_SKIN ) && defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	void skinShadow( sampler2D map, vec2 mapSize, float bias, float radius, mat4 lightMatrix, vec3 worldNormal ) {
		skinShadowRGB.r = getShadow( map, mapSize, 1.0, bias, radius, lightMatrix * vec4( vSkinWorld + worldNormal * 0.0036, 1.0 ) );
		skinShadowRGB.g = getShadow( map, mapSize, 1.0, bias, radius, lightMatrix * vec4( vSkinWorld + worldNormal * 0.002, 1.0 ) );
		skinShadowRGB.b = getShadow( map, mapSize, 1.0, bias, radius, lightMatrix * vec4( vSkinWorld + worldNormal * 0.0011, 1.0 ) );
		// red always scatters at least as far as green, and green as far as blue
		skinShadowRGB.g = max( skinShadowRGB.g, skinShadowRGB.b );
		skinShadowRGB.r = max( skinShadowRGB.r, skinShadowRGB.g );
		vec4 sc = lightMatrix * vec4( vSkinWorld - worldNormal * 0.002, 1.0 );
		sc.xyz /= sc.w;
		if ( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0 ) {
			vec2 tx = 1.5 / mapSize;
			float zFrag = perspectiveDepthToViewZ( sc.z, ${SHADOW_NEAR.toFixed(3)}, ${SHADOW_FAR.toFixed(1)} );
			float thickness = 0.0;
			thickness += perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( map, sc.xy + vec2( tx.x, tx.y ) ) ), ${SHADOW_NEAR.toFixed(3)}, ${SHADOW_FAR.toFixed(1)} );
			thickness += perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( map, sc.xy + vec2( -tx.x, tx.y ) ) ), ${SHADOW_NEAR.toFixed(3)}, ${SHADOW_FAR.toFixed(1)} );
			thickness += perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( map, sc.xy + vec2( tx.x, -tx.y ) ) ), ${SHADOW_NEAR.toFixed(3)}, ${SHADOW_FAR.toFixed(1)} );
			thickness += perspectiveDepthToViewZ( unpackRGBAToDepth( texture2D( map, sc.xy + vec2( -tx.x, -tx.y ) ) ), ${SHADOW_NEAR.toFixed(3)}, ${SHADOW_FAR.toFixed(1)} );
			thickness = max( 0.0, thickness * 0.25 - zFrag - 0.004 );
			skinTrans = exp( - thickness / vec3( 0.007, 0.003, 0.002 ) );
		}
	}
#endif
`;
patch('lights_fragment_begin', 'getSpotLightInfo( spotLight, geometryPosition, directLight );', `getSpotLightInfo( spotLight, geometryPosition, directLight );
		#ifdef USE_SKIN
		skinShadowRGB = vec3( 1.0 ); skinTrans = vec3( 0.0 );
		#endif`);
patch('lights_fragment_begin', 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;', `#ifdef USE_SKIN
		if ( directLight.visible && receiveShadow ) skinShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, spotLightMatrix[ i ], inverseTransformDirection( geometryNormal, viewMatrix ) );
		#else
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif`);
patch('lights_physical_pars_fragment', 'vec3 irradiance = dotNL * directLight.color;', `vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_SKIN
		float skinNL = dot( geometryNormal, directLight.direction );
		vec3 skinWrap = vec3( 0.2, 0.11, 0.06 );
		irradiance = ( saturate( ( skinNL + skinWrap ) / ( 1.0 + skinWrap ) ) * skinShadowRGB + 0.4 * skinTrans * saturate( 0.2 - skinNL ) * ( 1.0 - skinShadowRGB ) ) * directLight.color;
	#endif`);

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Engine {
  constructor(canvas, { mobile = false } = {}) {
    this.canvas = canvas;
    this.mobile = mobile;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!r.capabilities.isWebGL2) throw new Error('webgl2');
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.maxSamples = mobile ? 32 : 64;
    this.shadowSize = mobile ? 1024 : 2048;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.room = buildRoom();
    this.backdrop = buildBackdrop();
    this.camRig = buildCameraRig();
    this.scene.add(this.room.group, this.backdrop.group, this.camRig.group);

    // house lights: only used so the studio overview is readable, never in the photo
    this.workLight = new THREE.HemisphereLight(0xffffff, 0x555555, 0.55);
    this.workLight.visible = false;
    this.scene.add(this.workLight);
    // room lights: continuous, shadowless, part of the exposure (unlike the work light)
    this.roomLight = new THREE.HemisphereLight(0xffffff, 0x808080, 0);
    this.scene.add(this.roomLight);

    this.photoCam = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    this.viewCam = new THREE.PerspectiveCamera(48, 1, 0.05, 60);
    this.viewCam.position.set(-2.4, 2.9, 5.0);
    this.controls = new OrbitControls(this.viewCam, canvas);
    this.controls.enableDamping = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 0.6; this.controls.maxDistance = 9;
    this.controls.target.set(0, 1.2, 0);
    this.controls.addEventListener('change', () => { if (this.view === 'overview') this.invalidate(false); });
    this.controls.enabled = false;

    this.cubeSize = mobile ? 128 : 256;
    const cubeOpts = { type: THREE.HalfFloatType, generateMipmaps: false };
    this.cubeSpec = new THREE.WebGLCubeRenderTarget(this.cubeSize, cubeOpts);
    this.cubeDiff = new THREE.WebGLCubeRenderTarget(this.cubeSize, cubeOpts);
    this.cubeCamSpec = new THREE.CubeCamera(0.05, 30, this.cubeSpec);
    this.cubeCamDiff = new THREE.CubeCamera(0.05, 30, this.cubeDiff);
    this.scene.add(this.cubeCamSpec, this.cubeCamDiff);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.pmSpec = null; this.pmDiff = null;

    const quad = new THREE.PlaneGeometry(2, 2);
    this.blendMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, opacity: { value: 1 } },
      vertexShader: QUAD_VS,
      fragmentShader: 'uniform sampler2D tex; uniform float opacity; varying vec2 vUv; void main(){ gl_FragColor = vec4(min(texture2D(tex, vUv).rgb, vec3(60.0)), opacity); }',
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.showMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, clip: { value: 0 }, falseColor: { value: 0 } },
      vertexShader: QUAD_VS,
      fragmentShader: `uniform sampler2D tex; uniform float clip; uniform float falseColor; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tex, vUv).rgb;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          if (falseColor > 0.5) {
            // exposure in stops relative to middle grey (18 %)
            float st = log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-5) / 0.18);
            gl_FragColor.rgb = st < -5.0 ? vec3(0.25, 0.0, 0.4) : st < -3.0 ? vec3(0.0, 0.1, 0.7) : st < -1.5 ? vec3(0.0, 0.45, 0.75) : st < -0.5 ? vec3(0.35)
              : st < 0.5 ? vec3(0.15, 0.7, 0.2) : st < 1.5 ? vec3(0.95, 0.6, 0.7) : st < 2.3 ? vec3(0.95, 0.9, 0.2) : vec3(0.9, 0.1, 0.1);
          } else if (clip > 0.5) {
            float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
            if (min(c.r, min(c.g, c.b)) > 1.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.1, 0.1), 0.35 + 0.5 * stripe);
            else if (max(c.r, max(c.g, c.b)) < 0.002) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.1, 0.3, 1.0), 0.35 + 0.5 * stripe);
          }
        }`,
      depthTest: false, depthWrite: false,
    });
    this.blendQuad = new THREE.Mesh(quad, this.blendMat); this.blendQuad.frustumCulled = false;
    this.showQuad = new THREE.Mesh(quad, this.showMat); this.showQuad.frustumCulled = false;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.rigs = new Map();
    this.subject = null; this.subjectType = null;
    this.target = new THREE.Vector3(0, 1.57, 0);
    this.view = 'camera';
    this.n = 0; this.dirty = true; this.envPasses = 3;
    this.onProgress = null;
    this.state = null;
    this._v = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion() };
    this._loop = this._loop.bind(this);
    setAssetCallback(() => this.invalidate(true));
  }

  start() { requestAnimationFrame(this._loop); }

  invalidate(env = true) { this.stopHQ(); this.dirty = true; if (env) this.envPasses = 3; }

  // High-quality capture (path tracing). Any change to the set cancels it.
  async startHQ() {
    if (this.hq || this.view !== 'camera') return;
    const { HighQuality } = await import('./pathtrace.js');
    this.hq = new HighQuality(this);
    this.hqSamples = 0;
  }
  stopHQ() {
    if (!this.hq) return;
    try { this.hq.dispose(); } catch (e) { console.warn(e); }
    this.hq = null; this.dirty = true;
    if (this.onHQ) this.onHQ(null);
  }

  setSize(w, h) {
    const pr = this.pixelRatio;
    const W = Math.max(2, Math.round(w * pr)), H = Math.max(2, Math.round(h * pr));
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.rtSample?.dispose(); this.rtAccum?.dispose();
    this.rtSample = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace });
    this.rtAccum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false, colorSpace: THREE.LinearSRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.photoCam.aspect = this.viewCam.aspect = W / H;
    this.photoCam.updateProjectionMatrix(); this.viewCam.updateProjectionMatrix();
    this.invalidate(false);
  }

  // Apply the whole app state to the scene.
  sync(state, env = true) {
    this.state = state;
    const T = subjectTarget(state.subject);
    this.target.set(T.x, T.y, T.z);
    this.view = state.view;
    this.controls.enabled = state.view === 'overview';
    this.controls.target.set(0, Math.min(T.y, 1.3), 0);

    this.room.wallMat.color.set(WALLS[state.set.walls] || WALLS.gray);
    this.backdrop.mat.color.set(state.set.backdropColor);
    this.backdrop.group.position.z = -state.set.backDist;
    this.backdrop.setKind(state.set.kind);
    {
      const E = (state.set.roomLux || 0) * exposureScale(state.camera, false), rc = lightColor(state.set.roomK || 3000, state.camera.wb);
      this.roomLight.visible = E > 0;
      this.roomLight.color.setRGB(rc[0] * E, rc[1] * E, rc[2] * E);
      this.roomLight.groundColor.setRGB(rc[0] * E * 0.4, rc[1] * E * 0.4, rc[2] * E * 0.4);
      this.roomLight.intensity = 1;
    }

    const sig = subjectSig(state.subject);
    if (this.subjectType !== sig) {
      if (this.subject) { this.scene.remove(this.subject.group); disposeTree(this.subject.group); }
      this.subject = buildSubject(state.subject, () => this.invalidate(true));
      this.subjectType = sig;
      this.scene.add(this.subject.group);
    }
    this.subject.update(state.subject);

    // camera first: the stands need it to know whether they would show in the frame
    const cam = state.camera;
    const aspect = ASPECTS[cam.aspect] || 1;
    const ss = sensorSize(aspect);
    this.photoCam.fov = 2 * Math.atan(ss.h / 2 / cam.focal) * 180 / Math.PI;
    this.photoCam.updateProjectionMatrix();
    const cp = cameraPose(cam, T);
    this.camPos = new THREE.Vector3(cp.x, cp.y, cp.z);
    this.camRig.head.position.copy(this.camPos);
    this.camRig.head.lookAt(this.target);
    this.camRig.stand.position.set(cp.x, 0, cp.z);
    this.camRig.stand.userData.setHeight(cp.y - 0.06);
    this.photoCam.position.copy(this.camPos); this.photoCam.up.set(0, 1, 0); this.photoCam.lookAt(this.target);
    this.photoCam.clearViewOffset(); this.photoCam.updateMatrixWorld(true);
    this.frameMatrix = new THREE.Matrix4().multiplyMatrices(this.photoCam.projectionMatrix, this.photoCam.matrixWorldInverse);

    // equipment
    this._scrimGlow = new Map();
    const seen = new Set();
    for (const item of state.items) {
      seen.add(item.id);
      const sig = item.kind === 'light' ? `${item.type}|${item.mod}` : `${item.surface}|${item.size}`;
      let rig = this.rigs.get(item.id);
      if (!rig || rig.sig !== sig) {
        if (rig) this._dropRig(rig);
        rig = item.kind === 'light' ? buildLightRig(item) : buildPanelRig(item);
        rig.sig = sig; rig.item = item;
        if (item.kind === 'light') {
          const l = rig.light = new THREE.SpotLight(0xffffff, 1, 0, 0.5, 0.5, 2);
          l.castShadow = true;
          l.shadow.mapSize.set(this.shadowSize, this.shadowSize);
          l.shadow.bias = -0.0006; l.shadow.normalBias = 0.012;
          l.shadow.camera.near = SHADOW_NEAR; l.shadow.camera.far = SHADOW_FAR;
          this.scene.add(l, l.target);
        }
        this.scene.add(rig.group);
        this.rigs.set(item.id, rig);
      }
      this._poseRig(rig, item, state);
    }
    for (const [id, rig] of this.rigs) if (rig.scrimMat) { const g = this._scrimGlow.get(id) || [0, 0, 0]; rig.scrimMat.color.setRGB(0.01 + g[0], 0.01 + g[1], 0.01 + g[2]); }
    for (const [id, rig] of this.rigs) if (!seen.has(id)) { this._dropRig(rig); this.rigs.delete(id); }

    this.lensRadius = cam.focal / 1000 / (2 * cam.aperture);
    this.showMat.uniforms.clip.value = cam.clip ? 1 : 0;
    this.showMat.uniforms.falseColor.value = cam.falseColor ? 1 : 0;
    this.invalidate(env);
  }

  _dropRig(rig) {
    this.scene.remove(rig.group);
    disposeTree(rig.group);
    if (rig.light) { this.scene.remove(rig.light, rig.light.target); rig.light.shadow.dispose?.(); rig.light.dispose(); }
  }

  _poseRig(rig, item, state) {
    const T = this.target, v = this._v;
    const pos = v.a.set(item.x, item.h, item.z);
    rig.head.position.copy(pos);
    if (rig.isPanel) {
      if (rig.panel.shape === 'rect') { rig.head.position.y = rig.panel.h / 2 + 0.01; rig.head.lookAt(T.x, rig.head.position.y, T.z); }
      else rig.head.lookAt(T);
      rig.group.visible = item.on !== false;
    } else {
      const d = lightDir(item, T);
      const aim = v.b.set(pos.x + d.x * d.len, pos.y + d.y * d.len, pos.z + d.z * d.len);
      rig.head.lookAt(aim);
      const m = rig.spec, lt = LIGHT_TYPES[item.type];
      // colour x intensity of the lamp; a strobe's modeling lamp adds a weak continuous part
      const I = axisIntensity(item) * exposureScale(state.camera, lt.flash);
      const c = lightTint(item, state.camera.wb).map((x) => x * I);
      if (lt.flash && item.modeling) {
        const mc = lightColor(MODELING.kelvin, state.camera.wb), mi = MODELING.lumens * m.gain * exposureScale(state.camera, false);
        for (let k = 0; k < 3; k++) c[k] += mc[k] * mi;
      }
      const l = rig.light;
      l.visible = !!item.on;
      l.color.setRGB(c[0], c[1], c[2]);
      l.intensity = 1;
      l.angle = m.half * Math.PI / 180;
      l.penumbra = m.pen;
      const gobo = m.id === 'optical' ? goboTexture(item.gobo) : null;
      if (l.map !== gobo) l.map = gobo;
      l.target.position.copy(aim);
      l.target.updateMatrixWorld();
      rig.center = pos.clone();
      rig.head.updateMatrixWorld(true);
      rig.right = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.head.quaternion);
      rig.up = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.head.quaternion);
      // radiance of the emitting face so that it matches the spot light's intensity
      const area = m.shape === 'disc' ? Math.PI * m.r * m.r : m.w * m.h;
      const L = item.on ? 1 / area : 0;
      for (const f of rig.faces) f.material.color.setRGB(c[0] * L, c[1] * L, c[2] * L);
      // shining through a scrim: the lit patch on the scrim replaces the lamp as the source
      const sc = item.on ? scrimFor(item, state) : null;
      rig.emit = null;
      if (sc) {
        const n = new THREE.Vector3(sc.normal.x, sc.normal.y, sc.normal.z);
        rig.emit = { shape: 'disc', r: sc.r };
        rig.center = new THREE.Vector3(sc.center.x, sc.center.y, sc.center.z);
        rig.right = new THREE.Vector3(0, 1, 0).cross(n).normalize();
        rig.up = n.clone().cross(rig.right).normalize();
        l.intensity = sc.k; l.angle = 70 * Math.PI / 180; l.penumbra = 0.9; if (l.map) l.map = null;
        l.target.position.copy(T); l.target.updateMatrixWorld();
        const g = this._scrimGlow.get(sc.panel) || [0, 0, 0], Lp = sc.k / (Math.PI * sc.limit * sc.limit);
        this._scrimGlow.set(sc.panel, [g[0] + c[0] * Lp, g[1] + c[1] * Lp, g[2] + c[2] * Lp]);
      }
    }
    // stand under the lamp body
    const off = rig.standOffset;
    const fwd = v.c.set(0, 0, 1).applyQuaternion(rig.head.quaternion);
    const sx = rig.head.position.x + fwd.x * off, sz = rig.head.position.z + fwd.z * off, sy = rig.head.position.y + fwd.y * off;
    rig.stand.visible = !(rig.isPanel && rig.panel.shape !== 'disc') && item.type !== 'window';
    rig.stand.position.set(sx, 0, sz);
    // A floor stand that would show in the photo is swapped for a ceiling mount.
    rig.hanging = state.camera.autoAvoid !== false && this._standInFrame(sx, sz, sy - 0.05);
    if (rig.hanging) rig.stand.userData.setHanging(sy + 0.05); else rig.stand.userData.setHeight(sy - 0.05);
  }

  // True if a floor stand at (x, z) reaching up to `top` would be visible in the camera frame.
  _standInFrame(x, z, top) {
    const v = this._v.c, m = this.frameMatrix;
    if (!m) return false;
    const test = (px, py, pz) => {
      v.set(px, py, pz).applyMatrix4(m);
      return v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.04 && Math.abs(v.y) < 1.04;
    };
    for (let y = 0; y <= top; y += 0.08) if (test(x, y, z)) return true;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; if (test(x + Math.cos(a + 0.5) * 0.46, 0.02, z + Math.sin(a + 0.5) * 0.46)) return true; }
    return false;
  }

  _placeLights(n) {
    let i = 0;
    for (const rig of this.rigs.values()) {
      if (!rig.light) continue;
      i++;
      const l = rig.light, m = rig.emit || rig.spec;
      l.position.copy(rig.center);
      if (n > 0) {
        let u = (halton(n, 2) + i * 0.381966) % 1, w = (halton(n, 3) + i * 0.618034) % 1;
        let a, b;
        if (m.shape === 'disc') { const rr = Math.sqrt(u) * m.r, th = w * Math.PI * 2; a = rr * Math.cos(th); b = rr * Math.sin(th); }
        else { a = (u - 0.5) * m.w; b = (w - 0.5) * m.h; }
        l.position.addScaledVector(rig.right, a).addScaledVector(rig.up, b);
      }
    }
  }

  _placeCamera(n) {
    if (this.view === 'overview') {
      const c = this.viewCam;
      if (n > 0) c.setViewOffset(this.W, this.H, halton(n, 2) - 0.5, halton(n, 3) - 0.5, this.W, this.H); else c.clearViewOffset();
      return c;
    }
    const c = this.photoCam, v = this._v;
    c.position.copy(this.camPos);
    c.up.set(0, 1, 0);
    c.lookAt(this.target);
    if (n > 0) {
      c.setViewOffset(this.W, this.H, halton(n, 2) - 0.5, halton(n, 3) - 0.5, this.W, this.H);
      const rr = Math.sqrt(halton(n, 5)) * this.lensRadius, th = halton(n, 7) * Math.PI * 2;
      const right = v.a.set(1, 0, 0).applyQuaternion(c.quaternion), up = v.b.set(0, 1, 0).applyQuaternion(c.quaternion);
      c.position.addScaledVector(right, rr * Math.cos(th)).addScaledVector(up, rr * Math.sin(th));
      c.lookAt(this.target);
    } else c.clearViewOffset();
    return c;
  }

  _updateEnv() {
    const r = this.renderer;
    this.cubeCamSpec.position.copy(this.target);
    this.cubeCamDiff.position.copy(this.target);
    this.subject.group.visible = false;
    this.camRig.group.visible = true;
    r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true;
    this.cubeCamSpec.update(r, this.scene);
    for (const rig of this.rigs.values()) for (const f of rig.faces) f.visible = false;
    this.cubeCamDiff.update(r, this.scene);
    for (const rig of this.rigs.values()) for (const f of rig.faces) f.visible = true;
    r.shadowMap.autoUpdate = true;
    this.subject.group.visible = true;
    this.pmSpec = this.pmrem.fromCubemap(this.cubeSpec.texture, this.pmSpec);
    this.pmDiff = this.pmrem.fromCubemap(this.cubeDiff.texture, this.pmDiff);
    this.scene.environment = this.pmSpec.texture;
    envDiffuse.value = this.pmDiff.texture;
  }

  _show() {
    const r = this.renderer;
    r.setRenderTarget(null);
    this.showMat.uniforms.tex.value = this.rtAccum.texture;
    r.render(this.showQuad, this.quadCam);
  }

  _loop() {
    requestAnimationFrame(this._loop);
    if (!this.state || !this.rtSample) return;
    if (this.hq) {
      if (this.hqSamples >= this.hq.target) return;
      try { this.hqSamples = this.hq.step(); } catch (e) { console.error(e); this.stopHQ(); if (this.onHQ) this.onHQ({ error: true }); return; }
      if (this.onHQ) this.onHQ({ samples: this.hqSamples, target: this.hq.target });
      return;
    }
    if (!this.dirty && this.n >= this.maxSamples) return;
    if (this.dirty) { this.n = 0; this.dirty = false; }
    const r = this.renderer;
    if (this.envPasses > 0) { this._placeLights(0); this._updateEnv(); this.envPasses--; }
    this._placeLights(this.n);
    const cam = this._placeCamera(this.n);
    this.camRig.group.visible = this.workLight.visible = this.view === 'overview';
    r.setRenderTarget(this.rtSample);
    r.clear();
    r.render(this.scene, cam);
    this.workLight.visible = false;
    r.setRenderTarget(this.rtAccum);
    this.blendMat.uniforms.tex.value = this.rtSample.texture;
    this.blendMat.uniforms.opacity.value = 1 / (this.n + 1);
    r.render(this.blendQuad, this.quadCam);
    this._show();
    this.n++;
    if (this.onProgress) this.onProgress(this.n / this.maxSamples);
  }

  snapshot() {
    if (this.hq) this.hq.step(); else this._show();
    return new Promise((res) => this.canvas.toBlob(res, 'image/jpeg', 0.95));
  }
}
