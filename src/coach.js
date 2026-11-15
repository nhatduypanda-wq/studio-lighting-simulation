// Step-by-step lessons: each lesson has a few steps, and each step a test on the current
// state that tells whether the learner has done it. `c` is the context made when the lesson
// was set up: the ids of its items (in order) and a snapshot of the starting values.
import { LIGHT_TYPES, modSpec, meterLight, meterBackdrop, subjectTarget, groupMembers, hexLuminance } from './data.js';

const HARD = ['standard', 'speedhead', 'snoot', 'fresnel', 'barn', 'optical'];
const item = (s, c, n) => s.items.find((i) => i.id === c.ids[n]);
const on = (i) => !!i && i.on !== false;
const dist = (s, i) => { const T = subjectTarget(s.subject); return Math.hypot(i.x - T.x, i.z - T.z); };
const angle = (s, i) => { const T = subjectTarget(s.subject); return Math.atan2(i.x - T.x, i.z - T.z) * 180 / Math.PI; };
const soft = (i) => !HARD.includes(modSpec(i).id);
const room = (s) => (s.set.roomLux ? s.set.roomLux / s.camera.shutter : 0);
const faceH = (s, p) => s.items.reduce((h, i) => { const m = meterLight(i, p, s.camera, s); return h + (m ? m.H : 0); }, room(s));
// exposure at the face in stops relative to the camera settings
export const faceEv = (s) => { const H = faceH(s, subjectTarget(s.subject)); return H > 0 ? Math.log2(H * s.camera.iso / 250 / (s.camera.aperture ** 2)) : -99; };
const exposed = (s, tol = 0.5) => Math.abs(faceEv(s)) <= tol;
const flashEv = (s) => { const T = subjectTarget(s.subject); const H = s.items.reduce((h, i) => { const m = i.kind === 'light' && LIGHT_TYPES[i.type].flash ? meterLight(i, T, s.camera, s) : null; return h + (m ? m.H : 0); }, 0); return H > 0 ? Math.log2(H * s.camera.iso / 250 / (s.camera.aperture ** 2)) : -99; };
const ratio = (s, a, b) => { const T = subjectTarget(s.subject), x = meterLight(a, T, s.camera, s), y = meterLight(b, T, s.camera, s); return x && y && y.H > 0 ? Math.log2(x.H / y.H) : 99; };
const spread = (s) => { const Hs = groupMembers(s.subject).map((p) => faceH(s, { x: p.x, y: p.faceY, z: p.z + 0.03 })); const lo = Math.min(...Hs); return lo > 0 ? Math.log2(Math.max(...Hs) / lo) : 99; };
const L = (n, f) => (s, c) => { const i = item(s, c, n); return !!i && f(i, s, c); };

export const STEPS = {
  inverse: [L(0, (i, s) => dist(s, i) >= 1.45), L(0, (i, s) => dist(s, i) >= 1.45 && exposed(s))],
  size: [L(0, (i) => soft(i)), L(0, (i, s) => soft(i) && dist(s, i) <= 1.0), L(0, (i, s) => soft(i) && dist(s, i) <= 1.0 && exposed(s))],
  patterns: [L(0, (i, s) => Math.abs(angle(s, i)) <= 8), L(0, (i, s) => Math.abs(angle(s, i)) >= 82 && Math.abs(angle(s, i)) <= 100), L(0, (i, s) => Math.abs(angle(s, i)) >= 35 && Math.abs(angle(s, i)) <= 50)],
  ratio: [(s, c) => { const r = ratio(s, item(s, c, 0), item(s, c, 1)); return on(item(s, c, 1)) && r >= 0.7 && r <= 1.3; },
    (s, c) => on(item(s, c, 1)) && ratio(s, item(s, c, 0), item(s, c, 1)) >= 2.8 && ratio(s, item(s, c, 0), item(s, c, 1)) < 20,
    (s, c) => { const r = ratio(s, item(s, c, 0), item(s, c, 1)); return on(item(s, c, 1)) && r >= 1.7 && r <= 2.3; }],
  feather: [L(0, (i) => Math.abs(i.feather || 0) >= 15 && Math.abs(i.feather || 0) <= 40), L(0, (i) => Math.abs(i.feather || 0) >= 55)],
  separation: [(s, c) => !on(item(s, c, 1)) && on(item(s, c, 2)), (s, c) => on(item(s, c, 1)) && !on(item(s, c, 2)), (s, c) => on(item(s, c, 1)) && on(item(s, c, 2))],
  colour: [L(1, (i, s, c) => (i.gel || 'none') !== c.base[1].gel && (i.gel || 'none') !== 'none'), L(1, (i, s, c) => i.stops <= c.base[1].stops - 0.8)],
  metal: [(s, c) => !on(item(s, c, 1)), (s, c) => on(item(s, c, 1))],
  ambient: [(s) => s.camera.shutter <= 30, (s) => s.camera.shutter <= 30 && s.camera.iso >= 400 && Math.abs(flashEv(s)) <= 0.6],
  bgTone: [(s) => s.set.backDist >= 3, L(0, (i, s) => s.set.backDist >= 3 && dist(s, i) <= 0.85 && exposed(s))],
  bgWhite: [(s, c) => !on(item(s, c, 1)) && !on(item(s, c, 2)),
    (s, c) => { const b = meterBackdrop(s); return on(item(s, c, 1)) && on(item(s, c, 2)) && !!b && b.vsFace >= 2.3; },
    (s, c) => { const b = meterBackdrop(s); return on(item(s, c, 1)) && on(item(s, c, 2)) && !!b && b.vsFace >= 0.4 && b.vsFace <= 1.3 && Math.max(Math.abs(b.left), Math.abs(b.right)) <= 0.5; }],
  bgSpot: [L(1, (i) => !i.grid), L(1, (i, s, c) => i.grid && i.stops <= c.base[1].stops - 0.8), L(0, (i) => !i.grid)],
  bgGel: [L(0, (i) => i.grid), (s) => hexLuminance(s.set.backdropColor) < 0.02, L(1, (i, s, c) => i.stops <= c.base[1].stops - 0.8)],
  bgShadow: [(s) => s.set.backDist >= 1.8, L(0, (i, s) => s.set.backDist <= 0.8 && i.h >= 2.5), L(0, (i, s) => soft(i) && exposed(s, 0.7))],
  gFalloff: [(s) => spread(s) <= 0.7, (s) => spread(s) <= 0.34 && exposed(s, 0.6)],
  gShadow: [L(0, (i, s) => Math.abs(angle(s, i)) <= 20), L(0, (i, s) => Math.abs(angle(s, i)) <= 20 && i.h >= 2.3), L(0, (i, s) => soft(i) && exposed(s, 0.7))],
  gDepth: [(s) => s.camera.aperture >= 8, (s) => s.camera.aperture >= 8 && exposed(s, 0.6)],
  glassBright: [L(0, (i, s) => Math.abs(angle(s, i)) >= 160 && dist(s, i) >= 0.4 && dist(s, i) <= 1.3), L(0, (i, s, c) => Math.abs(angle(s, i)) >= 160 && i.stops <= c.base[0].stops - 0.8)],
  glassDark: [L(0, (i, s) => Math.abs(angle(s, i)) >= 125 && Math.abs(angle(s, i)) <= 165), (s, c) => [0, 1].every((n) => { const i = item(s, c, n); return on(i) && Math.abs(angle(s, i)) >= 125 && Math.abs(angle(s, i)) <= 165; }) && angle(s, item(s, c, 0)) * angle(s, item(s, c, 1)) < 0],
  tentMetal: [(s) => !!s.subject.tent, (s) => !!s.subject.tent && exposed(s, 0.7)],
  flatlay: [L(0, (i, s) => { const T = subjectTarget(s.subject); return Math.atan2(i.h - T.y, dist(s, i)) * 180 / Math.PI <= 40 && dist(s, i) >= 0.4; }),
    (s, c) => { const i = item(s, c, 0); return !!i && s.items.some((p) => p.kind === 'panel' && on(p) && p.surface !== 'black' && Math.sign(p.x || 0.001) !== Math.sign(i.x || 0.001) || p.kind === 'panel' && on(p) && p.surface !== 'black' && Math.sign(p.z || 0.001) !== Math.sign(i.z || 0.001)); },
    L(0, (i, s) => exposed(s, 0.7))],
  idPhoto: [L(0, (i, s) => soft(i) && exposed(s, 0.7)),
    (s, c) => { const k = item(s, c, 0); return !!k && s.items.some((o) => o.kind === 'light' && o.id !== k.id && on(o) && o.aim !== 'bg' && Math.sign(o.x) !== Math.sign(k.x) && Math.abs(ratio(s, k, o)) <= 1); },
    (s) => { const b = meterBackdrop(s); return s.set.backDist >= 1.2 && !!b && Math.max(Math.abs(b.left), Math.abs(b.right)) <= 0.5 && exposed(s, 0.7); }],
  flag: [L(1, (i) => on(i) && i.surface === 'white'), (s, c) => !on(item(s, c, 1))],
};

export function startCoach(state, lesson) {
  return { id: lesson.id, step: 0, done: false, ids: state.items.map((i) => i.id), base: state.items.map((i) => ({ ...i, gel: i.gel || 'none' })) };
}
// Advance past every step whose test passes. Returns true when something changed.
export function advance(state, coach) {
  const steps = STEPS[coach.id] || [];
  if (coach.done) return false;
  let ok = false;
  try { ok = steps[coach.step] ? !!steps[coach.step](state, coach) : true; } catch { ok = false; }
  if (!ok) return false;
  coach.step++;
  if (coach.step >= steps.length) coach.done = true;
  return true;
}
