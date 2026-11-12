import { t, getLang, setLang } from './i18n.js';
import {
  LIGHT_TYPES, MODIFIERS, PANELS, PANEL_SURFACES, SUBJECTS, SKIN_TONES, BACKDROPS, WALLS, PRESETS,
  ARM_POSES, GELS, GOBOS, BACKDROP_TYPES, ROOM_LIGHT, ROOM, ROOMS, FLOORS, MOUNTS, setRoom, MODELS, LOOKS, AGES, HAIR_COLORS, EYE_COLORS, CLOTHES_COLORS, PRESET_FACE_Y, modelMeta,
  APERTURES, SHUTTERS, ISOS, FOCALS, ASPECTS, SYNC_SPEED,
  defaultState, makeLight, makePanel, nextId, modSpec, meterLight, subjectTarget, PRODUCT_CAMERA, avoidCamera,
} from './data.js';
import { Diagram, LIMITS } from './diagram.js';
import { MATERIAL_IDS, SHAPE_IDS } from './materials.js';
import { LESSONS, applyLesson } from './lessons.js';

const $ = (id) => document.getElementById(id);
const STORE = 'sl.state.v2';
const APP_VERSION = '6.4';
const MAX_LIGHTS = 5;
const mobile = matchMedia('(pointer: coarse)').matches;
const wideMq = matchMedia('(min-width: 860px) and (min-height: 480px)');

let state = load();
setRoom(state.set.room);
let tab = 'lights';
let engine = null;

// Fill in anything a stored or shared state is missing; reject what is not a state at all.
function normalize(s) {
  if (!s || s.v !== 1 || !Array.isArray(s.items)) return null;
  const d = defaultState();
  const items = s.items.filter((i) => i && (i.kind === 'light' || i.kind === 'panel') && Number.isFinite(i.x) && Number.isFinite(i.z) && Number.isFinite(i.h)).slice(0, 12);
  return { ...d, ...s, items, subject: { ...d.subject, ...s.subject }, set: { ...d.set, ...s.set }, camera: { ...d.camera, ...s.camera }, view: 'camera' };
}
// A shared link carries the whole state in the URL fragment, base64url-encoded JSON.
const encodeState = (st) => btoa(unescape(encodeURIComponent(JSON.stringify({ ...st, selected: null })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decodeState(text) {
  try { return normalize(JSON.parse(decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/')))))); } catch { return null; }
}
function load() {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (m) {
    const shared = decodeState(m[1]);
    history.replaceState(null, '', location.pathname + location.search);
    if (shared) { shared.preset = 'custom'; shared.selected = shared.items[0]?.id ?? null; return shared; }
  }
  try {
    const s = normalize(JSON.parse(localStorage.getItem(STORE)));
    if (s) return s;
  } catch { /* fall through */ }
  const d = defaultState(); d.preset = 'rembrandt'; d.selected = d.items[0]?.id ?? null; return d;
}

// ---- saved setups ------------------------------------------------------------------
const SAVED = 'sl.saved.v1';
function savedList() { try { const l = JSON.parse(localStorage.getItem(SAVED)); return Array.isArray(l) ? l : []; } catch { return []; } }
function savedWrite(list) { try { localStorage.setItem(SAVED, JSON.stringify(list)); } catch { alert(t('savedFull')); } }
function saveSetup() {
  const name = (prompt(t('savedName'), `${t('savedDefault')} ${savedList().length + 1}`) || '').trim().slice(0, 60);
  if (!name) return;
  const list = savedList().filter((e) => e.name !== name);
  list.unshift({ name, at: Date.now(), state: JSON.parse(JSON.stringify({ ...state, selected: null })) });
  savedWrite(list.slice(0, 40)); renderPane();
}
function loadSetup(entry) {
  const st = normalize(entry.state); if (!st) return;
  st.preset = 'custom'; st.selected = st.items[0]?.id ?? null;
  state = st; setRoom(state.set.room); renderChrome(); layout(); commit({ rebuild: true });
}
async function shareSetup() {
  const url = location.origin + location.pathname + '#s=' + encodeState(state);
  try {
    if (navigator.share) { await navigator.share({ title: t('appName'), url }); return; }
    await navigator.clipboard.writeText(url); alert(t('shareCopied'));
  } catch (e) { if (e && e.name === 'AbortError') return; prompt(t('shareManual'), url); }
}

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } }, 400);
}

// ---- formatting ---------------------------------------------------------------
const num = (v, d = 1) => v.toLocaleString(getLang() === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtM = (v) => `${num(v, 2)} ${t('m')}`;
const fmtDeg = (v) => `${Math.round(v)}°`;
const fmtF = (n) => (n >= 0.7 ? `f/${n >= 10 ? Math.round(n) : num(n, 1)}` : '< f/0.7');
const fmtEv = (ev) => (ev >= 0 ? '+' : '−') + num(Math.abs(ev), 1);
function fmtPower(item) {
  const lt = LIGHT_TYPES[item.type];
  if (!lt.flash) return `${Math.round(100 * Math.pow(2, item.stops))}%` + (lt.watts ? ` · ${Math.round(lt.watts * Math.pow(2, item.stops))} W` : '');
  const n = -item.stops, whole = Math.ceil(n - 0.01), frac = whole - n;
  const base = whole === 0 ? '1/1' : `1/${2 ** whole}`;
  return `${base}${frac > 0.05 ? ' +' + num(frac, 1) : ''} · ${Math.round(lt.ws * Math.pow(2, item.stops))} Ws`;
}

// ---- state changes ------------------------------------------------------------
let pending = null;
let avoid = { raised: new Set(), stuck: new Set() };
function commit({ env = true, rebuild = false } = {}) {
  // equipment that would hide the subject from the camera is lifted out of the way
  const res = avoidCamera(state);
  if (res.changed) { env = true; if (activeTab() === 'lights') rebuild = true; }
  avoid = res;
  if (rebuild) renderPane();
  pending = { env: env || (pending?.env ?? false) };
  save();
}
function flush() {
  requestAnimationFrame(flush);
  if (!pending) return;
  const p = pending; pending = null;
  engine?.sync(state, p.env);
  diagram.draw();
  updateReadouts();
}
const camMax = () => Math.min(ROOM.w > 7 ? 7 : 4.5, Math.round((ROOM.zMax - 0.4) * 20) / 20);
const backMax = () => Math.min(ROOM.w > 7 ? 5 : 3.6, Math.round((-ROOM.zMin - 0.2) * 20) / 20);
// After the room changes size, pull everything back inside the walls.
function fitRoom() {
  for (const i of state.items) {
    i.x = Math.max(-LIMITS.x, Math.min(LIMITS.x, i.x)); i.z = Math.max(LIMITS.zMin, Math.min(LIMITS.zMax, i.z));
    i.h = Math.min(i.h, ROOM.h - 0.2);
  }
  state.camera.dist = Math.min(state.camera.dist, camMax());
  state.set.backDist = Math.min(state.set.backDist, backMax());
}
const touched = () => { state.preset = 'custom'; $('preset').value = 'custom'; };
const selected = () => state.items.find((i) => i.id === state.selected) || null;
const lightCount = () => state.items.filter((i) => i.kind === 'light').length;

function polar(item) {
  const T = subjectTarget(state.subject);
  return { d: Math.hypot(item.x - T.x, item.z - T.z), a: Math.atan2(item.x - T.x, item.z - T.z) * 180 / Math.PI };
}
function setPolar(item, d, a) {
  const T = subjectTarget(state.subject), r = a * Math.PI / 180;
  item.x = Math.max(-LIMITS.x, Math.min(LIMITS.x, T.x + Math.sin(r) * d));
  item.z = Math.max(LIMITS.zMin, Math.min(LIMITS.zMax, T.z + Math.cos(r) * d));
}

function applyPreset(id) {
  const p = PRESETS[id]; if (!p) return;
  state.subject.yaw = 0;
  if (p.subject) Object.assign(state.subject, p.subject);
  if (p.set) Object.assign(state.set, p.set);
  const T0 = subjectTarget(state.subject), dy = T0.y - PRESET_FACE_Y;
  state.items = p.items().map((i) => ({ ...i, h: Math.max(0.3, i.h + dy) }));
  if (p.subject && p.subject.type) { Object.assign(state.camera, PRODUCT_CAMERA[p.subject.type], { height: T0.y + 0.14, angle: 0 }); layout(); }
  if (p.camera) Object.assign(state.camera, p.camera);
  else Object.assign(state.camera, { aperture: 8, shutter: 160, iso: 100, wb: 5600 });
  state.preset = id;
  state.selected = state.items[0]?.id ?? null;
  commit({ rebuild: true });
}

// When the subject height changes, keep the lighting geometry relative to it.
function shiftHeights(before) {
  const dy = subjectTarget(state.subject).y - before;
  if (!dy) return;
  for (const i of state.items) i.h = Math.max(0.2, Math.min(ROOM.h - 0.2, i.h + dy));
  state.camera.height = Math.max(0.3, Math.min(2.6, state.camera.height + dy));
}

// ---- small DOM helpers ---------------------------------------------------------
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), props[k]);
    else if (props[k] !== undefined && props[k] !== false) e.setAttribute(k, props[k] === true ? '' : props[k]);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
function slider(label, value, min, max, step, fmt, onInput) {
  const out = el('output', {}, fmt(value));
  const inp = el('input', { type: 'range', min, max, step, 'aria-label': label });
  inp.value = value;
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt(v); onInput(v); });
  return el('div', { class: 'row' }, el('div', { class: 'lab' }, el('span', {}, label), out), inp);
}
function stepSlider(label, list, value, fmt, onInput) {
  let idx = list.indexOf(value); if (idx < 0) idx = 0;
  return slider(label, idx, 0, list.length - 1, 1, (i) => fmt(list[i]), (i) => onInput(list[i]));
}
function select(label, value, options, onChange) {
  const s = el('select', { 'aria-label': label });
  for (const [v, text] of options) { const o = el('option', { value: v }, text); if (v === value) o.selected = true; s.append(o); }
  s.addEventListener('change', () => onChange(s.value));
  return el('div', { class: 'row' }, el('div', { class: 'lab' }, el('span', {}, label)), s);
}
function check(label, value, onChange) {
  const c = el('input', { type: 'checkbox' }); c.checked = !!value;
  c.addEventListener('change', () => onChange(c.checked));
  return el('label', { class: 'check' }, el('span', {}, label), c);
}
const button = (label, cls, onClick) => el('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: onClick }, label);

// ---- panes ----------------------------------------------------------------------
function itemTitle(item) {
  if (item.kind === 'panel') return `${t('panel')} · ${t('surface.' + item.surface).split(' (')[0]}`;
  return t('mod.' + modSpec(item).id);
}
function itemSub(item) {
  if (item.kind === 'panel') return t('size.' + item.size);
  return t('type.' + item.type);
}

function paneLights() {
  const f = document.createDocumentFragment();
  f.append(el('div', { class: 'note', id: 'expoNote' }));
  if (!state.items.length) f.append(el('p', { class: 'hint' }, t('noItems')));
  const ul = el('ul', { class: 'items' });
  state.items.forEach((item, i) => {
    const li = el('li', { class: (item.id === state.selected ? 'sel ' : '') + (item.on === false ? 'off' : ''), onclick: () => { state.selected = item.id; commit({ env: false, rebuild: true }); } },
      el('span', { class: 'num' }, String(i + 1)),
      el('span', { class: 'nm' }, el('div', {}, itemTitle(item)), el('small', { 'data-meter': item.id }, itemSub(item))));
    ul.append(li);
  });
  f.append(ul);
  const add = el('div', { class: 'btns' });
  if (lightCount() < MAX_LIGHTS) add.append(button('+ ' + t('addLight'), 'primary', () => {
    const T = subjectTarget(state.subject);
    const side = lightCount() % 2 ? 1 : -1;
    const it = makeLight({ x: side * 1.1, z: 1.1, h: T.y + 0.45, stops: -3 });
    state.items.push(it); state.selected = it.id; touched(); commit({ rebuild: true });
  }));
  add.append(button('+ ' + t('addPanel'), '', () => {
    const T = subjectTarget(state.subject);
    const it = makePanel({ x: 0.85, z: 0.3, h: T.y - 0.2 });
    state.items.push(it); state.selected = it.id; touched(); commit({ rebuild: true });
  }));
  f.append(add);
  f.append(el('div', { class: 'btns' }, button(t('exportDiagram'), '', exportDiagram)));

  const item = selected();
  if (!item) { f.append(el('p', { class: 'hint' }, t('selectHint'))); return f; }
  const ed = el('div', { class: 'editor' });
  const idx = state.items.indexOf(item) + 1;
  ed.append(el('h3', {}, `${idx}. ${itemTitle(item)}`));
  const chg = (fn, opts) => (v) => { fn(v); touched(); commit(opts); };

  if (item.kind === 'light') {
    const lt = LIGHT_TYPES[item.type];
    ed.append(check(t('on'), item.on, chg((v) => { item.on = v; }, { rebuild: true })));
    ed.append(select(t('type'), item.type, Object.keys(LIGHT_TYPES).map((k) => [k, t('type.' + k)]), chg((v) => {
      item.type = v; const n = LIGHT_TYPES[v];
      if (!n.mods.includes(item.mod)) item.mod = n.mods[0];
      item.stops = Math.max(n.flash ? -8 : -5, item.stops);
      if (v === 'speedlight' && item.mod === 'standard') item.mod = 'speedhead';
    }, { rebuild: true })));
    if (lt.mods.length > 1) ed.append(select(t('modifier'), modSpec(item).id, lt.mods.map((k) => [k, t('mod.' + k)]), chg((v) => { item.mod = v; if (!MODIFIERS[v].grid) item.grid = false; }, { rebuild: true })));
    if (modSpec(item).hasGrid) ed.append(check(t('grid'), item.grid, chg((v) => { item.grid = v; })));
    ed.append(slider(t('power'), item.stops, lt.flash ? -8 : -5, 0, 1 / 3, (v) => fmtPower({ ...item, stops: v }), chg((v) => { item.stops = Math.round(v * 3) / 3; })));
    if (!lt.flash) ed.append(slider(t('kelvin'), item.kelvin, 2700, 6500, 100, (v) => `${v} K`, chg((v) => { item.kelvin = v; })));
    if (item.type === 'strobe') ed.append(check(t('modeling'), item.modeling, chg((v) => { item.modeling = v; })));
    ed.append(select(t('gel'), item.gel || 'none', Object.keys(GELS).map((k) => [k, t('gel.' + k)]), chg((v) => { item.gel = v; })));
    if (modSpec(item).id === 'optical') ed.append(select(t('gobo'), item.gobo || 'none', GOBOS.map((k) => [k, t('gobo.' + k)]), chg((v) => { item.gobo = v; })));
  } else {
    ed.append(check(t('on'), item.on !== false, chg((v) => { item.on = v; }, { rebuild: true })));
    ed.append(select(t('surface'), item.surface, Object.keys(PANEL_SURFACES).map((k) => [k, t('surface.' + k)]), chg((v) => { item.surface = v; }, { rebuild: true })));
    ed.append(select(t('size'), item.size, Object.keys(PANELS).map((k) => [k, t('size.' + k)]), chg((v) => { item.size = v; }, { rebuild: true })));
  }
  const p = polar(item);
  ed.append(slider(t('distance'), Math.min(4.5, p.d), 0.3, 4.5, 0.05, fmtM, chg((v) => { setPolar(item, v, polar(item).a); })));
  ed.append(slider(t('angle'), p.a, -180, 180, 1, fmtDeg, chg((v) => { setPolar(item, Math.max(0.3, polar(item).d), v); })));
  if (!(item.kind === 'panel' && item.size === 'vflat')) ed.append(slider(t('height'), Math.min(item.h, ROOM.h - 0.2), 0.2, Math.round((ROOM.h - 0.2) * 20) / 20, 0.05, fmtM, chg((v) => { item.h = v; })));
  if (!(item.kind === 'panel' && item.size === 'vflat')) ed.append(select(t('mount'), item.mount || 'auto', MOUNTS.map((k) => [k, t('mount.' + k)]), chg((v) => { item.mount = v; })));
  if (item.kind === 'light') ed.append(slider(t('feather'), item.feather || 0, -180, 180, 1, fmtDeg, chg((v) => { item.feather = v; })));
  ed.append(el('div', { class: 'btns' },
    button(t('duplicate'), '', () => {
      if (item.kind === 'light' && lightCount() >= MAX_LIGHTS) return;
      const c = { ...item, id: nextId(), x: Math.max(-LIMITS.x, Math.min(LIMITS.x, -item.x || 0.5)) };
      state.items.push(c); state.selected = c.id; touched(); commit({ rebuild: true });
    }),
    button(t('remove'), 'danger', () => {
      state.items = state.items.filter((i) => i !== item); state.selected = state.items[0]?.id ?? null; touched(); commit({ rebuild: true });
    })));
  f.append(ed);
  return f;
}

function paneCamera() {
  const f = document.createDocumentFragment();
  const c = state.camera;
  const chg = (fn, opts = { env: true }) => (v) => { fn(v); commit(opts); };
  f.append(el('div', { class: 'note', id: 'expoNote' }));
  f.append(el('div', { class: 'note bad', id: 'syncNote', hidden: true }, t('syncWarn')));
  f.append(stepSlider(t('aperture'), APERTURES, c.aperture, (v) => `f/${v}`, chg((v) => { c.aperture = v; })));
  f.append(stepSlider(t('shutter'), SHUTTERS, c.shutter, (v) => `1/${v} s`, chg((v) => { c.shutter = v; })));
  f.append(stepSlider(t('iso'), ISOS, c.iso, (v) => `ISO ${v}`, chg((v) => { c.iso = v; })));
  f.append(slider(t('wb'), c.wb, 2500, 10000, 100, (v) => `${v} K`, chg((v) => { c.wb = v; })));
  f.append(stepSlider(t('focal'), FOCALS, c.focal, (v) => `${v} mm`, chg((v) => { c.focal = v; }, { env: false })));
  f.append(slider(t('camDist'), c.dist, 0.5, camMax(), 0.05, fmtM, chg((v) => { c.dist = v; }, { env: false })));
  f.append(slider(t('camHeight'), c.height, 0.3, 2.6, 0.05, fmtM, chg((v) => { c.height = v; }, { env: false })));
  f.append(slider(t('camAngle'), c.angle, -90, 90, 1, fmtDeg, chg((v) => { c.angle = v; }, { env: false })));
  f.append(select(t('aspect'), c.aspect, Object.keys(ASPECTS).map((k) => [k, k]), (v) => { c.aspect = v; layout(); commit({ env: false }); }));
  f.append(check(t('autoAvoid'), c.autoAvoid !== false, chg((v) => { c.autoAvoid = v; })));
  f.append(check(t('eyeZoom'), c.eyeZoom, chg((v) => { c.eyeZoom = v; }, { env: false })));
  f.append(check(t('histogram'), c.hist !== false, (v) => { c.hist = v; $('hist').hidden = !v; commit({ env: false }); }));
  f.append(check(t('falseColor'), c.falseColor, chg((v) => { c.falseColor = v; }, { env: false, rebuild: true })));
  if (c.falseColor) f.append(el('div', { class: 'note' }, t('falseLegend')));
  f.append(check(t('clip'), c.clip, chg((v) => { c.clip = v; }, { env: false })));
  return f;
}

function paneSubject() {
  const f = document.createDocumentFragment();
  const s = state.subject;
  const chg = (fn, opts) => (v) => { fn(v); commit(opts); };
  f.append(select(t('subject'), s.type, SUBJECTS.map((k) => [k, t('subject.' + k)]), (v) => {
    const before = subjectTarget(s).y, wasPortrait = s.type === 'portrait';
    s.type = v; shiftHeights(before);
    Object.assign(state.camera, v === 'portrait' ? (wasPortrait ? {} : { dist: 2.1, focal: 85, aspect: '4:5' }) : PRODUCT_CAMERA[v]);
    state.camera.height = subjectTarget(s).y + (v === 'portrait' ? 0.01 : 0.14);
    layout(); commit({ rebuild: true });
  }));
  if (s.type === 'portrait') {
    // changing the model changes the subject's height: keep lights and camera relative to the face
    const rebuild = (fn) => (v) => { const before = subjectTarget(s).y; fn(v); shiftHeights(before); commit({ rebuild: true }); };
    f.append(select(t('model'), s.model, MODELS.map((k) => [k, t('model.' + k)]), rebuild((v) => {
      s.model = v;
      if (v !== 'scan' && !modelMeta(s).hair.includes(s.hair) && s.hair !== 'none') s.hair = modelMeta(s).hair[0];
    })));
    if (s.model === 'scan') {
      f.append(select(t('skin'), s.skin, Object.keys(SKIN_TONES).map((k) => [k, t('skin.' + k)]), chg((v) => { s.skin = v; })));
    } else {
      f.append(select(t('look'), s.eth, LOOKS.map((k) => [k, t('look.' + k)]), rebuild((v) => { s.eth = v; })));
      f.append(select(t('age'), s.age, AGES.map((k) => [k, t('age.' + k)]), rebuild((v) => { s.age = v; })));
      f.append(select(t('pose'), s.pose || 'standing', [['standing', t('pose.standing')], ['seated', t('pose.seated')]], rebuild((v) => { s.pose = v; })));
      f.append(select(t('arms'), s.arms || 'down', ARM_POSES.map((k) => [k, t('arms.' + k)]), chg((v) => { s.arms = v; })));
      f.append(slider(t('smile'), s.smile || 0, 0, 100, 5, (v) => `${v}%`, chg((v) => { s.smile = v; })));
      f.append(check(t('glasses'), s.glasses, chg((v) => { s.glasses = v; })));
      f.append(select(t('hair'), s.hair, [...modelMeta(s).hair.map((k) => [k, t('hair.' + k)]), ['none', t('hair.none')]], chg((v) => { s.hair = v; })));
      f.append(select(t('hairColor'), s.hairColor, Object.keys(HAIR_COLORS).map((k) => [k, t('hc.' + k)]), chg((v) => { s.hairColor = v; })));
      f.append(select(t('eyes'), s.eyes, EYE_COLORS.map((k) => [k, t('eye.' + k)]), chg((v) => { s.eyes = v; })));
      f.append(select(t('clothes'), s.clothes, Object.keys(CLOTHES_COLORS).map((k) => [k, t('cc.' + k)]), chg((v) => { s.clothes = v; })));
    }
    f.append(slider(t('headYaw'), s.yaw, -70, 70, 1, fmtDeg, chg((v) => { s.yaw = v; })));
    f.append(slider(t('headPitch'), s.pitch, -25, 25, 1, fmtDeg, chg((v) => { s.pitch = v; })));
    if (s.model !== 'scan') f.append(slider(t('headTilt'), s.tilt || 0, -25, 25, 1, fmtDeg, chg((v) => { s.tilt = v; })));
  } else {
    if (s.type === 'material') {
      f.append(select(t('material'), s.mat, MATERIAL_IDS.map((k) => [k, t('mat.' + k)]), chg((v) => { s.mat = v; })));
      f.append(select(t('shape'), s.shape, SHAPE_IDS.map((k) => [k, t('shape.' + k)]), chg((v) => { s.shape = v; })));
    }
    f.append(check(t('tent'), s.tent, chg((v) => { s.tent = v; })));
    f.append(check(t('foa'), s.foa, (v) => { s.foa = v; commit({ env: false, rebuild: true }); }));
    if (s.foa) f.append(el('div', { class: 'note' }, t('foaNote')));
    f.append(slider(t('rotate'), s.rot, -180, 180, 1, fmtDeg, chg((v) => { s.rot = v; })));
    f.append(select(t('table'), s.table, ['white', 'black', 'wood'].map((k) => [k, t('table.' + k)]), chg((v) => { s.table = v; })));
  }
  return f;
}

function paneSet() {
  const f = document.createDocumentFragment();
  const s = state.set;
  f.append(el('div', { class: 'row' }, el('div', { class: 'lab' }, el('span', {}, t('backdrop')))));
  const sw = el('div', { class: 'swatches' });
  for (const k in BACKDROPS) {
    sw.append(el('button', { type: 'button', title: t('bd.' + k), 'aria-label': t('bd.' + k), class: s.backdrop === k ? 'on' : '', style: `background:${BACKDROPS[k]}`, onclick: () => { s.backdrop = k; s.backdropColor = BACKDROPS[k]; commit({ rebuild: true }); } }));
  }
  const custom = el('input', { type: 'color', title: t('customColor'), 'aria-label': t('customColor') });
  custom.value = s.backdropColor;
  custom.addEventListener('input', () => { s.backdrop = 'custom'; s.backdropColor = custom.value; commit(); });
  sw.append(custom);
  f.append(sw);
  f.append(select(t('bdKind'), s.kind || 'paper', BACKDROP_TYPES.map((k) => [k, t('bdKind.' + k)]), (v) => { s.kind = v; commit(); }));
  f.append(select(t('room'), s.room || 'medium', Object.keys(ROOMS).map((k) => [k, t('room.' + k)]), (v) => { s.room = v; setRoom(v); fitRoom(); commit({ rebuild: true }); }));
  f.append(select(t('floor'), s.floor || 'concrete', FLOORS.map((k) => [k, t('floor.' + k)]), (v) => { s.floor = v; commit(); }));
  f.append(slider(t('backDist'), Math.min(s.backDist, backMax()), 0.4, backMax(), 0.05, fmtM, (v) => { s.backDist = v; commit(); }));
  f.append(select(t('roomLux'), String(s.roomLux || 0), ROOM_LIGHT.levels.map((k) => [String(k), k ? `${k} lux` : t('roomOff')]), (v) => { s.roomLux = +v; commit({ rebuild: true }); }));
  if (s.roomLux) f.append(select(t('roomK'), String(s.roomK || 3000), ROOM_LIGHT.kelvins.map((k) => [String(k), `${k} K`]), (v) => { s.roomK = +v; commit(); }));
  f.append(select(t('walls'), s.walls, Object.keys(WALLS).map((k) => [k, t('walls.' + k)]), (v) => { s.walls = v; commit(); }));
  // saved setups and sharing
  f.append(el('div', { class: 'editor' }, el('h3', {}, t('savedTitle'))));
  f.append(el('div', { class: 'btns' }, button(t('savedSave'), 'primary', saveSetup), button(t('share'), '', shareSetup)));
  const saved = savedList();
  if (saved.length) {
    const ul = el('ul', { class: 'items' });
    for (const entry of saved) {
      ul.append(el('li', {},
        el('span', { class: 'nm', onclick: () => loadSetup(entry) }, el('div', {}, entry.name), el('small', {}, new Date(entry.at).toLocaleDateString(getLang() === 'vi' ? 'vi-VN' : 'en-GB'))),
        el('button', { type: 'button', class: 'ghost', onclick: () => loadSetup(entry) }, t('savedLoad')),
        el('button', { type: 'button', class: 'ghost', 'aria-label': t('remove'), onclick: () => { if (confirm(t('savedDelete', { n: entry.name }))) { savedWrite(savedList().filter((e) => e.name !== entry.name)); renderPane(); } } }, '✕')));
    }
    f.append(ul);
  } else f.append(el('p', { class: 'hint' }, t('savedNone')));
  f.append(el('div', { class: 'btns' }, button(t('reset'), 'danger', resetAll), button(t('about'), '', () => $('about').showModal())));
  f.append(el('p', { class: 'hint' }, `${t('version')} ${APP_VERSION}`));
  return f;
}

// ---- challenge: rebuild the lighting of a target photo -------------------------------
const CHALLENGES = ['loop', 'rembrandt', 'butterfly', 'split', 'hard', 'clamshell', 'rim'];
let challenge = null, challengeBusy = false;
async function tinyPixels(blob) {
  const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = 40; c.height = 50;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, 40, 50);
  return g.getImageData(0, 0, 40, 50).data;
}
function renderSettled() { // resolves once the live view has refined the current set
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const e = engine;
      if (!e || Date.now() - t0 > 20000 || (!pending && !e.dirty && e.envPasses === 0 && e.n >= Math.min(e.maxSamples, 32))) resolve(); else setTimeout(tick, 150);
    };
    setTimeout(tick, 300);
  });
}
async function startChallenge(id) {
  if (!engine || challengeBusy) return;
  challengeBusy = true;
  state.view = 'camera'; state.subject.type = 'portrait'; renderChrome(); layout();
  const T = subjectTarget(state.subject), dy = T.y - PRESET_FACE_Y;
  const target = PRESETS[id].items().map((i) => ({ ...i, h: Math.max(0.3, i.h + dy) }));
  Object.assign(state.camera, { aperture: 8, shutter: 160, iso: 100, wb: 5600, angle: 0, focal: 85, dist: 1.7, aspect: '4:5', height: T.y + 0.01, falseColor: false });
  Object.assign(state.set, { walls: 'gray' });
  state.items = target; state.selected = null; state.preset = 'custom';
  commit({ rebuild: true });
  await renderSettled();
  const blob = await engine.snapshot();
  if ($('abImg').src) URL.revokeObjectURL($('abImg').src);
  const url = URL.createObjectURL(blob);
  $('abImg').src = url; $('abView').hidden = false;
  challenge = { id, target, px: await tinyPixels(blob), url, result: null, reveal: false };
  const first = makeLight({ mod: 'softbox', x: 0.3, z: 1.6, h: T.y + 0.2, stops: -3 });
  state.items = [first]; state.selected = first.id;
  challengeBusy = false;
  commit({ rebuild: true });
}
async function scoreChallenge() {
  if (!challenge || !engine) return;
  await renderSettled();
  const cur = await tinyPixels(await engine.snapshot()), tgt = challenge.px;
  let diff = 0, la = 0, lb = 0;
  const lin = (v) => Math.pow(v / 255, 2.2);
  for (let i = 0; i < cur.length; i += 4) {
    diff += Math.abs(cur[i] - tgt[i]) + Math.abs(cur[i + 1] - tgt[i + 1]) + Math.abs(cur[i + 2] - tgt[i + 2]);
    la += lin(cur[i + 1]); lb += lin(tgt[i + 1]);
  }
  diff /= cur.length / 4 * 3;
  challenge.result = { score: Math.max(0, Math.min(100, Math.round(100 - 2.4 * diff))), ev: Math.log2((la + 1e-6) / (lb + 1e-6)) };
  renderPane();
}

function paneLearn() {
  const f = document.createDocumentFragment();
  const card = el('div', { class: 'lesson' }, el('h3', {}, t('challenge')), el('p', {}, t('challengeIntro')));
  const pick = el('select', { 'aria-label': t('challenge') });
  CHALLENGES.forEach((id, i) => { const o = el('option', { value: id }, `${t('challenge')} ${i + 1}`); if (challenge && challenge.id === id) o.selected = true; pick.append(o); });
  card.append(el('div', { class: 'row' }, pick));
  card.append(el('div', { class: 'btns' }, button(challenge ? t('challengeRestart') : t('challengeStart'), 'primary', () => startChallenge(pick.value))));
  if (challenge) {
    card.append(el('img', { class: 'target', src: challenge.url, alt: t('challengeTarget') }));
    card.append(el('p', {}, t('challengeHow')));
    card.append(el('div', { class: 'btns' }, button(t('challengeScore'), 'primary', scoreChallenge), button(t('challengeReveal'), '', () => { challenge.reveal = !challenge.reveal; renderPane(); })));
    if (challenge.result) {
      const r = challenge.result;
      const ev = Math.abs(r.ev) < 0.25 ? t('challengeEvOk') : t(r.ev > 0 ? 'challengeBrighter' : 'challengeDarker', { s: num(Math.abs(r.ev), 1) });
      card.append(el('div', { class: 'note' }, `${t('challengeResult', { n: r.score })} ${ev} ${t(r.score >= 85 ? 'challengeGreat' : r.score >= 65 ? 'challengeClose' : 'challengeFar')}`));
    }
    if (challenge.reveal) {
      const T = subjectTarget(state.subject);
      const ul = el('ul', { class: 'answer' });
      ul.append(el('li', {}, t('preset.' + challenge.id)));
      challenge.target.forEach((item) => {
        const d = Math.hypot(item.x - T.x, item.z - T.z), a = Math.atan2(item.x - T.x, item.z - T.z) * 180 / Math.PI;
        ul.append(el('li', {}, `${itemTitle(item)} · ${fmtM(d)} · ${fmtDeg(a)} · ${t('height')} ${fmtM(item.h)}` + (item.kind === 'light' ? ` · ${fmtPower(item)}` : '')));
      });
      card.append(ul);
      card.append(el('div', { class: 'btns' }, button(t('challengeApply'), '', () => { state.items = challenge.target.map((i) => ({ ...i })); state.selected = state.items[0].id; commit({ rebuild: true }); })));
    }
  }
  f.append(card);
  f.append(el('p', { class: 'hint' }, t('learnIntro')));
  LESSONS.forEach((ls, i) => {
    f.append(el('div', { class: 'lesson' },
      el('h3', {}, `${i + 1}. ${t(`lesson.${ls.id}.t`)}`),
      el('p', {}, t(`lesson.${ls.id}.b`)),
      el('p', { class: 'try' }, t('tryIt') + ' ' + t(`lesson.${ls.id}.try`)),
      button(t('lessonSetup'), 'primary', () => { applyLesson(state, ls); $('preset').value = 'custom'; layout(); commit({ rebuild: true }); })));
  });
  return f;
}

const PANES = { lights: paneLights, camera: paneCamera, subject: paneSubject, set: paneSet, learn: paneLearn };
const TABS = ['diagram', 'lights', 'camera', 'subject', 'set', 'learn'];

function renderPane() {
  const eff = tab === 'diagram' ? 'lights' : tab;
  const pane = $('pane');
  const keep = pane.dataset.tab === eff ? pane.scrollTop : 0;
  pane.replaceChildren(PANES[eff]());
  pane.dataset.tab = eff;
  pane.scrollTop = keep;
  updateReadouts();
}

function renderChrome() {
  document.title = `${t('appName')} — ${t('tagline')}`;
  for (const b of $('viewSeg').children) { b.textContent = t('view.' + b.dataset.view); b.classList.toggle('on', b.dataset.view === state.view); }
  $('presetLabel').textContent = t('presets');
  const ps = $('preset'); ps.setAttribute('aria-label', t('presets')); ps.replaceChildren();
  for (const k of [...Object.keys(PRESETS), 'custom']) ps.append(el('option', { value: k }, t('preset.' + k)));
  ps.value = state.preset || 'custom';
  $('langBtn').textContent = getLang() === 'vi' ? 'EN' : 'VI';
  $('resetBtn').textContent = t('reset');
  $('aboutBtn').textContent = t('about');
  $('saveBtn').textContent = t('savePhoto');
  if (!hqOn) $('hqBtn').textContent = t('hq');
  $('abSave').textContent = t('abSave'); $('abView').textContent = t('abView');
  $('aboutTitle').textContent = `${t('appName')} ${APP_VERSION} — ${t('tagline')}`;
  $('aboutBody').textContent = t('aboutBody');
  $('aboutClose').textContent = t('close');
  const tabs = $('tabs'); tabs.replaceChildren();
  for (const k of TABS) tabs.append(el('button', { type: 'button', 'data-tab': k, class: k === activeTab() ? 'on' : '', onclick: () => setTab(k) }, t('tab.' + k)));
}
const activeTab = () => (wideMq.matches && tab === 'diagram' ? 'lights' : tab);
function setTab(k) {
  tab = k;
  document.body.classList.toggle('tab-diagram', k === 'diagram');
  for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === activeTab());
  renderPane();
  diagram.draw();
}

function mountNote(item) {
  let s = '';
  if (engine?.rigs.get(item.id)?.hanging) s += ' · ' + t('noteHang');
  if (avoid.stuck.has(item.id)) s += ' · ' + t('noteBlock');
  else if (avoid.raised.has(item.id)) s += ' · ' + t('noteRaised');
  return s;
}

// ---- readouts ---------------------------------------------------------------------
function updateReadouts() {
  const T = subjectTarget(state.subject), cam = state.camera;
  let H = 0, anyFlash = false; const each = [];
  for (const item of state.items) {
    if (item.kind !== 'light') continue;
    const m = meterLight(item, T, cam, state);
    const node = document.querySelector(`[data-meter="${item.id}"]`);
    let text = t('meterOff');
    if (m) {
      const lt = LIGHT_TYPES[item.type];
      H += m.H; each.push(m.H);
      if (lt.flash) anyFlash = true;
      text = m.N < 0.5 ? t('meterNone') : `${fmtF(m.N)} (${fmtEv(m.ev)} EV) · ${fmtM(m.d)}`;
    }
    if (node) node.textContent = `${itemSub(item)} · ${text}${mountNote(item)}`;
  }
  for (const item of state.items) {
    if (item.kind !== 'panel') continue;
    const node = document.querySelector(`[data-meter="${item.id}"]`);
    if (node) node.textContent = itemSub(item) + mountNote(item);
  }
  const N = Math.sqrt(H * cam.iso / 250);
  const ev = N > 0 ? 2 * Math.log2(N / cam.aperture) : -99;
  const line = N < 0.5 ? t('meterNone') : t('expoTotal', { f: fmtF(N), ev: fmtEv(ev), n: cam.aperture });
  if (state.set.roomLux) H += state.set.roomLux / cam.shutter;
  each.sort((a, b) => b - a);
  let ratio = '';
  if (each.length >= 2 && each[1] > 0) { const r = each[0] / each[1]; ratio = ' ' + t('ratio', { r: r >= 10 ? Math.round(r) : num(r, 1), s: num(Math.log2(r), 1) }); }
  const note = $('expoNote'); if (note) note.textContent = `${t('meter')}: ${line}.${ratio}`;
  const sync = anyFlash && cam.shutter > SYNC_SPEED;
  const sn = $('syncNote'); if (sn) sn.hidden = !sync;
  $('warn').hidden = !sync; if (sync) $('warn').textContent = t('syncWarn');
  $('hud').textContent = `${cam.focal} mm · f/${cam.aperture} · 1/${cam.shutter} s · ISO ${cam.iso} · ${cam.wb} K` + (N >= 0.5 ? `  |  ${fmtEv(ev)} EV` : '');
  $('hud').hidden = state.view !== 'camera';
  $('saveBtn').hidden = $('hqBtn').hidden = $('abSave').hidden = state.view !== 'camera';
  $('hist').hidden = state.view !== 'camera' || state.camera.hist === false || !!state.camera.falseColor;
  if (state.view !== 'camera') { $('abImg').hidden = $('abTag').hidden = true; $('abView').hidden = true; } else if ($('abImg').src) $('abView').hidden = false;
}

// ---- layout ---------------------------------------------------------------------------
function layout() {
  const stage = $('stage'), cv = $('gl');
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  let w = W, h = H;
  if (state.view === 'camera') {
    const a = ASPECTS[state.camera.aspect] || 1;
    if (W / H > a) { h = H; w = H * a; } else { w = W; h = W / a; }
  }
  cv.style.width = Math.round(w) + 'px'; cv.style.height = Math.round(h) + 'px';
  engine?.setSize(Math.round(w), Math.round(h));
}

// ---- wiring ----------------------------------------------------------------------------
const diagram = new Diagram($('diagram'), {
  getState: () => state,
  labels: () => ({ cam: t('cam'), m: t('m') }),
  onSelect: (id) => { if (state.selected !== id) { state.selected = id; if (activeTab() === 'lights') renderPane(); commit({ env: false }); } },
  onMove: (id, x, z) => { const it = state.items.find((i) => i.id === id); if (!it) return; it.x = x; it.z = z; touched(); commit(); syncPolarSliders(); },
  onMoveCamera: (x, z) => {
    const T = subjectTarget(state.subject);
    state.camera.dist = Math.max(0.5, Math.min(camMax(), Math.hypot(x - T.x, z - T.z)));
    state.camera.angle = Math.max(-90, Math.min(90, Math.atan2(x - T.x, z - T.z) * 180 / Math.PI));
    commit({ env: false });
    if (activeTab() === 'camera') renderPane();
  },
});
let polarTimer = 0;
function syncPolarSliders() { // refresh the editor after a drag settles
  clearTimeout(polarTimer);
  polarTimer = setTimeout(() => { if (activeTab() === 'lights') renderPane(); }, 250);
}

$('viewSeg').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.view; if (!v) return;
  state.view = v; renderChrome(); layout(); commit({ env: false });
});
$('preset').addEventListener('change', (e) => { if (e.target.value !== 'custom') applyPreset(e.target.value); });
$('langBtn').addEventListener('click', () => { setLang(getLang() === 'vi' ? 'en' : 'vi'); renderChrome(); renderPane(); diagram.draw(); });
function resetAll() {
  if (!confirm(t('resetConfirm'))) return;
  state = defaultState(); state.preset = 'rembrandt'; state.selected = state.items[0].id;
  renderChrome(); layout(); commit({ rebuild: true });
}
$('resetBtn').addEventListener('click', resetAll);
$('aboutBtn').addEventListener('click', () => $('about').showModal());
$('saveBtn').addEventListener('click', async () => {
  const blob = await engine?.snapshot(); if (!blob) return;
  const a = el('a', { href: URL.createObjectURL(blob), download: `studio-light-${Date.now()}.jpg` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
// ---- histogram ---------------------------------------------------------------------
const histSrc = document.createElement('canvas'); histSrc.width = histSrc.height = 96;
function drawHist() {
  if (state.camera.hist === false || state.view !== 'camera' || state.camera.falseColor) return;
  const g = histSrc.getContext('2d', { willReadFrequently: true });
  g.drawImage($('gl'), 0, 0, 96, 96);
  const d = g.getImageData(0, 0, 96, 96).data, bins = new Float32Array(64);
  for (let i = 0; i < d.length; i += 4) bins[Math.min(63, (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) >> 2)]++;
  const h = $('hist'), c = h.getContext('2d'); let mx = 1;
  for (let i = 1; i < 63; i++) mx = Math.max(mx, bins[i]);
  c.clearRect(0, 0, 128, 56);
  for (let i = 0; i < 64; i++) {
    const v = Math.min(1, bins[i] / mx);
    c.fillStyle = i === 63 && bins[i] > 46 ? '#e5604d' : i === 0 && bins[i] > 46 ? '#5b8cff' : 'rgba(255,255,255,.8)';
    c.fillRect(i * 2, 56 - v * 52, 2, v * 52);
  }
}

// ---- A/B comparison ----------------------------------------------------------------
$('abSave').addEventListener('click', async () => {
  const blob = await engine?.snapshot(); if (!blob) return;
  if ($('abImg').src) URL.revokeObjectURL($('abImg').src);
  $('abImg').src = URL.createObjectURL(blob);
  $('abView').hidden = false;
});
$('abView').addEventListener('click', () => {
  const show = $('abImg').hidden;
  $('abImg').hidden = $('abTag').hidden = !show;
  $('abView').classList.toggle('on', show);
});

// ---- lighting diagram export ---------------------------------------------------------
function exportDiagram() {
  const dg = diagram.toCanvas(700, 870);
  const T = subjectTarget(state.subject), cam = state.camera;
  const lines = [`${t('appName')} — ${t('tab.diagram')}`, `${t('cam')}: ${cam.focal} mm · f/${cam.aperture} · 1/${cam.shutter} s · ISO ${cam.iso} · ${cam.wb} K · ${fmtM(cam.dist)}`,
    `${t('subject')}: ${t('subject.' + state.subject.type)} · ${t('backDist')} ${fmtM(state.set.backDist)}`, ''];
  state.items.forEach((item, i) => {
    const p = polar(item);
    let s = `${i + 1}. ${itemTitle(item)} — ${itemSub(item)}`;
    if (item.kind === 'light') { s += ` — ${fmtPower(item)}`; if (item.gel && item.gel !== 'none') s += ` — ${t('gel')}: ${t('gel.' + item.gel)}`; }
    lines.push(s);
    const m = item.kind === 'light' ? meterLight(item, T, cam, state) : null;
    lines.push(`     ${fmtM(p.d)} · ${fmtDeg(p.a)} · ${t('height')} ${fmtM(item.h)}` + (m && m.N >= 0.5 ? ` · ${fmtF(m.N)}` : '') + (item.on === false ? ` · ${t('meterOff')}` : ''));
  });
  const W = dg.width, lh = 40, out = document.createElement('canvas');
  out.width = W; out.height = dg.height + lines.length * lh + 60;
  const g = out.getContext('2d');
  g.fillStyle = '#1a1b1d'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(dg, 0, 0);
  g.textBaseline = 'top';
  lines.forEach((ln, i) => { g.font = (i === 0 ? '700 30px ' : '26px ') + '-apple-system, system-ui, sans-serif'; g.fillStyle = i === 0 ? '#f2b33d' : '#ecebe8'; g.fillText(ln, 36, dg.height + 24 + i * lh); });
  out.toBlob((blob) => {
    const a = el('a', { href: URL.createObjectURL(blob), download: `lighting-diagram-${Date.now()}.png` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

let hqOn = false;
$('hqBtn').addEventListener('click', async () => {
  if (!engine) return;
  if (hqOn) { engine.stopHQ(); return; }
  hqOn = true; $('hqBtn').classList.add('on'); $('hqBtn').textContent = t('hqPreparing');
  // let the label paint before the (blocking) scene build and shader compile
  await new Promise((r) => setTimeout(r, 60));
  try { await engine.startHQ(); } catch (e) { console.error(e); hqEnd(true); }
});
function hqEnd(error) {
  hqOn = false; $('hqBtn').classList.remove('on'); $('hqBtn').textContent = t('hq');
  $('progress').style.width = '0';
  if (error) alert(t('hqFail'));
}
new ResizeObserver(layout).observe($('stage'));
wideMq.addEventListener('change', () => { renderChrome(); renderPane(); diagram.draw(); });

setLang(getLang());
renderChrome();
setTab(wideMq.matches ? 'lights' : 'diagram');
$('loading').textContent = t('loading');
requestAnimationFrame(flush);

import('./engine.js').then(({ Engine }) => {
  engine = new Engine($('gl'), { mobile });
  engine.onHQ = (info) => {
    if (!info || info.error) { if (hqOn) hqEnd(info && info.error); return; }
    const done = info.samples >= info.target;
    if (done || info.samples % 10 === 0) drawHist();
    $('hqBtn').textContent = done ? t('hqDone') : `${t('hqStop')} ${Math.round(100 * info.samples / info.target)}%`;
    $('progress').style.width = done ? '0' : Math.round(100 * info.samples / info.target) + '%';
  };
  let ticks = 0;
  engine.onProgress = (p) => { $('progress').style.width = p >= 1 ? '0' : Math.round(p * 100) + '%'; if (p >= 1 || ticks++ % 8 === 0) drawHist(); };
  layout();
  engine.sync(state, true);
  engine.start();
  $('loading').hidden = true;
  window.__studio = { engine, getState: () => state };
}).catch((err) => {
  console.error(err);
  $('loading').textContent = t('noWebgl');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // when an updated service worker takes over, reload once so the page runs the new code
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => { /* offline support is optional */ });
}
