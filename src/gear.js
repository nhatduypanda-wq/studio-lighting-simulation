// "What equipment do I have": which presets can be built with the learner's own kit, and
// how to adapt a preset to it (e.g. speedlights instead of studio strobes).
import { LIGHT_TYPES, PRESETS, modSpec, meterLight, subjectTarget } from './data.js';
import { shiftExposure } from './critique.js';

export const GEAR_TYPES = ['strobe', 'speedlight', 'cob'];
export const GEAR_MODS = ['soft', 'umbrella', 'strip', 'dish', 'grid', 'gel', 'reflector'];
export const defaultGear = () => ({ type: 'speedlight', count: 1, soft: false, umbrella: true, strip: false, dish: false, grid: false, gel: false, reflector: true, only: false });

const CAT = { softbox: 'soft', octa: 'soft', umb_shoot: 'umbrella', umb_silver: 'umbrella', strip: 'strip', dish: 'dish' };
// What a modifier becomes on a light type that cannot take it.
const SWAP = { octa: 'softbox', strip: 'softbox', dish: 'umb_silver', standard: 'speedhead', speedhead: 'standard' };

// Returns the list of missing things ([] = can be built): 'count', 'led', or a GEAR_MODS key.
export function missing(id, gear) {
  const p = PRESETS[id]; if (!p) return [];
  const items = p.items(), need = new Set();
  const lamps = items.filter((i) => i.kind === 'light' && i.type !== 'window');
  if (lamps.length > gear.count) need.add('count');
  for (const i of lamps) {
    if (!LIGHT_TYPES[i.type].flash && gear.type !== 'cob') need.add('led');
    let cat = CAT[i.mod];
    if (cat === 'strip' && gear.type === 'speedlight') cat = 'soft';
    if (cat === 'dish' && gear.type === 'speedlight') cat = 'umbrella';
    if (cat && !gear[cat]) need.add(cat);
    if (i.grid && !gear.grid) need.add('grid');
    if (i.gel && i.gel !== 'none' && !gear.gel) need.add('gel');
  }
  if (items.some((i) => i.kind === 'panel') && !gear.reflector) need.add('reflector');
  return [...need];
}

const faceEv = (s) => {
  const T = subjectTarget(s.subject);
  const H = s.items.reduce((h, i) => { const m = meterLight(i, T, s.camera, s); return h + (m ? m.H : 0); }, s.set.roomLux ? s.set.roomLux / s.camera.shutter : 0);
  return H > 0 ? Math.log2(H * s.camera.iso / 250 / (s.camera.aperture ** 2)) : null;
};

// After a preset has been applied to the state: swap its lamps for the learner's kind of
// lamp and bring the exposure back to where the preset had it.
export function adapt(state, gear) {
  const before = faceEv(state);
  let changed = false;
  for (const i of state.items) {
    if (i.kind !== 'light' || i.type === 'window' || i.type === gear.type || !LIGHT_TYPES[i.type].mods.includes('softbox')) continue;
    const g0 = modSpec(i).gain, q0 = LIGHT_TYPES[i.type].q;
    i.type = gear.type;
    if (!LIGHT_TYPES[i.type].mods.includes(i.mod)) { i.mod = SWAP[i.mod] && LIGHT_TYPES[i.type].mods.includes(SWAP[i.mod]) ? SWAP[i.mod] : LIGHT_TYPES[i.type].mods[0]; }
    if (LIGHT_TYPES[i.type].flash) i.stops = Math.round((i.stops + Math.log2(q0 * g0 / (LIGHT_TYPES[i.type].q * modSpec(i).gain))) * 10) / 10;
    changed = true;
  }
  if (!changed) return false;
  if (gear.type === 'cob') Object.assign(state.camera, { shutter: 125 });
  // lamps pushed past full power are clamped; the camera makes up the difference
  const over = Math.max(0, ...state.items.filter((i) => i.kind === 'light').map((i) => i.stops));
  for (const i of state.items) if (i.kind === 'light') i.stops = Math.max(-8, Math.min(0, i.stops - over));
  const after = faceEv(state);
  if (before !== null && after !== null) shiftExposure(state, state.items.map((i) => i.id), before - after);
  return true;
}
