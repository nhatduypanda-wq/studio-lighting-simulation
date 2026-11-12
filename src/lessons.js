// Short lessons: each one sets up the studio to demonstrate one lighting idea.
// Light heights are authored for a face at PRESET_FACE_Y and shifted to the current model,
// except where `abs` is set (product lessons).
import { makeLight, makePanel, P, subjectTarget, PRESET_FACE_Y, PRODUCT_CAMERA } from './data.js';

const L = (o) => makeLight(o), R = (o) => makePanel(o);
export const LESSONS = [
  { id: 'inverse', items: () => [L({ mod: 'softbox', ...P(-40, 0.8), h: 1.75, stops: -4.3 })], set: { backDist: 1.5, walls: 'black', backdrop: 'gray', backdropColor: '#777777' } },
  { id: 'size', items: () => [L({ mod: 'standard', ...P(-40, 1.6), h: 2.1, stops: -4.7 })], set: { walls: 'gray' } },
  { id: 'patterns', items: () => [L({ mod: 'softbox', ...P(-45, 1.4), h: 2.1, stops: -2.7 })], set: { walls: 'gray' } },
  { id: 'ratio', items: () => [L({ mod: 'softbox', ...P(-40, 1.5), h: 2.0, stops: -2.3 }), L({ mod: 'umb_shoot', ...P(15, 2.2), h: 1.6, stops: -4 })], set: { walls: 'black' } },
  { id: 'feather', items: () => [L({ mod: 'softbox', ...P(-60, 0.9), h: 1.7, stops: -4 })], set: { walls: 'gray' } },
  { id: 'separation', items: () => [L({ mod: 'octa', ...P(-35, 1.5), h: 2.0, stops: -2 }), L({ mod: 'strip', grid: true, ...P(150, 1.5), h: 1.9, stops: -2.3 }),
    L({ mod: 'standard', x: 0.25, z: -1.2, h: 0.55, stops: -5, feather: 180 })], set: { walls: 'black', backDist: 2.2, backdrop: 'gray', backdropColor: '#777777' } },
  { id: 'colour', items: () => [L({ mod: 'octa', ...P(-35, 1.5), h: 2.0, stops: -2 }), L({ mod: 'standard', gel: 'blue', ...P(140, 1.6), h: 1.8, stops: -3.3 }),
    L({ mod: 'standard', gel: 'orange', ...P(-140, 1.6), h: 1.8, stops: -4.3 })], set: { walls: 'black' } },
  { id: 'metal', abs: true, subject: { type: 'shaker', table: 'black' }, items: () => [L({ mod: 'strip', ...P(-70, 0.7), h: 1.2, stops: -4 }), R({ size: 'disc80', ...P(70, 0.5), h: 1.1 })], set: { walls: 'black' } },
  { id: 'flag', items: () => [L({ mod: 'softbox', ...P(-70, 1.2), h: 1.8, stops: -3 }), R({ size: 'vflat', surface: 'black', ...P(80, 0.7), h: 1 })], set: { walls: 'white' } },
];

export function applyLesson(state, lesson) {
  state.subject = { ...state.subject, type: 'portrait', yaw: 0, pitch: 0, tilt: 0, ...(lesson.subject || {}) };
  Object.assign(state.set, lesson.set || {});
  const T = subjectTarget(state.subject), dy = lesson.abs ? 0 : T.y - PRESET_FACE_Y;
  state.items = lesson.items().map((i) => ({ ...i, h: Math.max(0.3, i.h + dy) }));
  Object.assign(state.camera, { aperture: 8, shutter: 160, iso: 100, wb: 5600, angle: 0 },
    state.subject.type === 'portrait' ? { focal: 85, dist: 2.1, aspect: '4:5', height: T.y + 0.01 } : { ...PRODUCT_CAMERA[state.subject.type], height: T.y + 0.14 });
  state.preset = 'custom';
  state.selected = state.items[0].id;
}
