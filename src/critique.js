// Automatic critique: looks at the geometry and the meter readings of the current setup and
// names the common beginner mistakes, each with a one-tap fix. Pure functions of the state.
import { LIGHT_TYPES, ROOM, modSpec, meterLight, meterBackdrop, subjectTarget, groupMembers, makePanel, scrimFor } from './data.js';

const deg = (r) => r * 180 / Math.PI;
const HARD = ['standard', 'speedhead', 'snoot', 'fresnel', 'barn', 'optical'];
const round5 = (v) => Math.round(v * 20) / 20;

// Put a light at a given angle around / elevation above the face, keeping its distance.
function place(item, T, az, el) {
  const d = Math.max(0.6, Math.hypot(item.x - T.x, item.h - T.y, item.z - T.z));
  let h = T.y + Math.sin(el * Math.PI / 180) * d, g = Math.cos(el * Math.PI / 180) * d;
  if (h > ROOM.h - 0.25) { h = ROOM.h - 0.25; g = (h - T.y) / Math.tan(el * Math.PI / 180); }
  item.x = round5(T.x + Math.sin(az * Math.PI / 180) * g); item.z = round5(T.z + Math.cos(az * Math.PI / 180) * g); item.h = round5(h);
}

export function critique(state) {
  const out = [];
  const add = (id, sev, fix, args) => out.push({ id, sev, fix, args });
  const cam = state.camera, set = state.set, sub = state.subject;
  const T = subjectTarget(sub), portrait = sub.type === 'portrait';
  const room = set.roomLux ? set.roomLux / cam.shutter : 0;
  const lights = state.items.filter((i) => i.kind === 'light' && i.on !== false);
  const panels = state.items.filter((i) => i.kind === 'panel' && i.on !== false);
  const yaw0 = portrait ? sub.yaw || 0 : 0;
  const sideOf = (it) => Math.abs(((deg(Math.atan2(it.x - T.x, it.z - T.z)) - yaw0 + 540) % 360) - 180);
  const all = lights.map((item) => ({ item, m: meterLight(item, T, cam, state) })).filter((r) => r.m && r.m.H > 0).sort((a, b) => b.m.H - a.m.H);
  const front = all.filter((r) => sideOf(r.item) <= 105);
  const Hall = all.reduce((s, r) => s + r.m.H, room);
  const behindOnly = portrait && all.length && (!front.length || front[0].m.H < all[0].m.H / 16) && room < all[0].m.H / 16;
  const read = portrait && !behindOnly ? front : all;
  const H = read.reduce((s, r) => s + r.m.H, room);
  const ev = H > 0 ? Math.log2(H * cam.iso / 250 / (cam.aperture * cam.aperture)) : -99;

  // ---- exposure ----
  if (!lights.length && !room) { add('noLights', 3); return out; }
  if (Hall <= 0 || Math.log2(Hall * cam.iso / 250 / (cam.aperture * cam.aperture)) < -6) add('noLightOnFace', 3);
  else if (Math.abs(ev) > 0.8 && sub.type !== 'bottle' && !behindOnly) {
    add(ev > 0 ? 'over' : 'under', Math.abs(ev) > 1.5 ? 3 : 2, (st) => {
      // shift every light that reaches the subject by the same amount, as far as their range allows;
      // what is left over goes to the ISO and then the aperture
      const ls = st.items.filter((i) => read.some((r) => r.item.id === i.id));
      let d = -ev;
      if (ls.length) { const sh = Math.max(-8 - Math.min(...ls.map((i) => i.stops)), Math.min(-Math.max(...ls.map((i) => i.stops)), d)); for (const i of ls) i.stops = Math.round((i.stops + sh) * 10) / 10; d -= sh; }
      const isos = [100, 200, 400, 800, 1600, 3200, 6400], aps = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
      while (Math.abs(d) > 0.5) {
        const c = st.camera, up = d > 0, ii = isos.indexOf(c.iso), ai = aps.findIndex((a) => Math.abs(a - c.aperture) < 0.3);
        if (up ? (ii >= 0 && ii < 3) : ii > 0) c.iso = isos[ii + (up ? 1 : -1)];
        else if (ai >= 0 && (up ? ai > 2 : ai < aps.length - 2)) c.aperture = aps[ai + (up ? -1 : 1)];
        else break;
        d += up ? -1 : 1;
      }
    }, { s: Math.abs(ev) });
  }

  const key = read[0];
  if (key && ev >= -6) {
    const it = key.item, dx = it.x - T.x, dy = it.h - T.y, dz = it.z - T.z, g = Math.hypot(dx, dz);
    const el = deg(Math.atan2(dy, g));
    let az = deg(Math.atan2(dx, dz)) - (portrait ? sub.yaw || 0 : 0); az = ((az + 540) % 360) - 180;
    const side = Math.abs(az), sgn = az < 0 ? -1 : 1, yaw = portrait ? sub.yaw || 0 : 0;
    const scrim = !!scrimFor(it, state);
    const fill2 = read[1] ? key.m.H / read[1].m.H : Infinity;
    const bounce = panels.filter((p) => p.surface !== 'black' && p.surface !== 'scrim' && p.surface !== 'cookie');
    const lowFill = bounce.some((p) => p.h < T.y - 0.3 && Math.hypot(p.x - T.x, p.z - T.z) < 1.1 && p.z > T.z + 0.2 && Math.abs(p.x - T.x) < 0.5) || read.slice(1).some((r) => r.item.h < T.y - 0.2 && r.item.z > T.z && key.m.H / r.m.H < 16);
    const sideFill = fill2 <= 8 || set.walls === 'white' || bounce.some((p) => Math.sign(p.x - T.x) !== Math.sign(dx) || Math.abs(p.x - T.x) < 0.3);

    if (portrait) {
      // ---- direction of the key ----
      if (behindOnly) add('keyBehind', 3, (st) => place(st.items.find((i) => i.id === it.id), T, yaw + sgn * 40, 30));
      else if (el < -8) add('fromBelow', 2, (st) => place(st.items.find((i) => i.id === it.id), T, yaw + az, 30));
      else if (el > 55 && !lowFill) add('raccoon', 3, (st) => place(st.items.find((i) => i.id === it.id), T, yaw + az, 35));
      else if (el > 43 && !lowFill) add('noseShadow', 2, (st) => place(st.items.find((i) => i.id === it.id), T, yaw + az, 32));
      else if (el < 12 && side < 15 && fill2 > 4) add('flat', 1, (st) => place(st.items.find((i) => i.id === it.id), T, yaw - 40, 30));
      if (side <= 110 && (el > 60 || el < -8)) add('noCatchlight', 1, out.some((c) => c.id === 'raccoon' || c.id === 'fromBelow') ? null : (st) => place(st.items.find((i) => i.id === it.id), T, yaw + az, 35));
      // ---- contrast ----
      if (side > 50 && side <= 110 && !sideFill && set.walls === 'black') {
        add(side > 78 ? 'halfDark' : 'deepShadow', 1, (st) => {
          const a = (yaw - sgn * 70) * Math.PI / 180;
          st.items.push(makePanel({ x: round5(T.x + Math.sin(a) * 0.8), z: round5(T.z + Math.cos(a) * 0.8), h: round5(T.y - 0.15) }));
        });
      }
      // ---- hardness ----
      if (!scrim && HARD.includes(modSpec(it).id) && LIGHT_TYPES[it.type].mods.includes('softbox') && side <= 110) add('hard', 1, (st) => {
        const i = st.items.find((x) => x.id === it.id); const before = modSpec(i).gain; i.mod = 'softbox'; i.grid = false;
        i.stops = Math.min(0, Math.round((i.stops + Math.log2(before / modSpec(i).gain)) * 10) / 10);
      });
    }
    // ---- colour ----
    const lt = LIGHT_TYPES[it.type], k = lt.flash ? lt.kelvin : it.kelvin;
    if (!it.gel || it.gel === 'none') {
      if (Math.abs(1e6 / k - 1e6 / cam.wb) > 28) add(k < cam.wb ? 'wbWarm' : 'wbCool', 2, (st) => { st.camera.wb = Math.round(k / 100) * 100; }, { k });
    }
    const other = read.slice(1).find((r) => { const l = LIGHT_TYPES[r.item.type], kk = l.flash ? l.kelvin : r.item.kelvin; return (!r.item.gel || r.item.gel === 'none') && key.m.H / r.m.H < 8 && Math.abs(1e6 / kk - 1e6 / k) > 45; });
    if (other && (!it.gel || it.gel === 'none')) add('mixed', 1);
    if (room && set.roomK && H > 0 && room / H > 0.12 && Math.abs(1e6 / set.roomK - 1e6 / k) > 45) add('roomCast', 1, (st) => { st.camera.shutter = 200; });
  }

  // ---- backdrop ----
  const bg = meterBackdrop(state);
  if (bg && portrait && key && ev >= -6) {
    const it = key.item, el = deg(Math.atan2(it.h - T.y, Math.hypot(it.x - T.x, it.z - T.z)));
    if (set.backDist < 1 && it.z > T.z && el < 40 && bg.vsFace > -3) add('bgShadow', 1, (st) => { st.set.backDist = Math.min(1.8, Math.max(1, (-ROOM.zMin) - 0.3)); });
    if (bg.rho > 0.7 && bg.lin < 0.8 && bg.lin > 0.25 && Math.abs(ev) <= 0.7) add('bgGrey', 1);
    if (bg.rho < 0.02 && bg.lin > 0.02 && Math.abs(ev) <= 0.7) add('bgNotBlack', 1, (st) => { st.set.backDist = Math.min(-ROOM.zMin - 0.3, Math.max(st.set.backDist, 3)); });
  }

  // ---- group ----
  if (portrait && sub.model !== 'scan') {
    const people = groupMembers(sub);
    if (people.length > 1) {
      const Hs = people.map((p) => lights.reduce((s, item) => { const r = meterLight(item, { x: p.x, y: p.faceY, z: p.z + 0.03 }, cam, state); return s + (r ? r.H : 0); }, room));
      const lo = Math.min(...Hs), hi = Math.max(...Hs);
      if (lo > 0 && Math.log2(hi / lo) > 0.7) add('groupUneven', 2, null, { s: Math.log2(hi / lo) });
      const zs = people.map((p) => p.z), depth = Math.max(...zs) - Math.min(...zs);
      const s = cam.dist * 1000, dof = 2 * cam.aperture * 0.03 * s * s / (cam.focal * cam.focal) / 1000;
      if (depth > 0.2 && dof < depth + 0.25) add('groupDof', 2, (st) => { const want = st.camera.aperture < 5.6 ? 8 : 11, d = 2 * Math.log2(want / st.camera.aperture); st.camera.aperture = want; for (const i of st.items) if (i.kind === 'light' && LIGHT_TYPES[i.type].flash) i.stops = Math.min(0, Math.round((i.stops + d) * 10) / 10); });
    }
  }

  // ---- camera ----
  if (portrait) {
    const s = cam.dist * 1000, dof = 2 * cam.aperture * 0.03 * s * s / (cam.focal * cam.focal) / 1000;
    if (dof < 0.06 && !(sub.group > 1)) add('thinDof', 1, null, { c: Math.max(1, Math.round(dof * 100)) });
    if (cam.focal <= 35 && cam.dist < 1.1) add('wideClose', 2, (st) => { const k = 85 / st.camera.focal; st.camera.focal = 85; st.camera.dist = Math.min(st.camera.dist * k, ROOM.zMax - 0.4); });
    if (cam.height - T.y > 0.4) add('camHigh', 1, (st) => { st.camera.height = round5(T.y + 0.02); });
    else if (T.y - cam.height > 0.4) add('camLow', 1, (st) => { st.camera.height = round5(T.y + 0.02); });
  }
  const anyCont = read.some((r) => !LIGHT_TYPES[r.item.type].flash && r.m.H / H > 0.3);
  if (anyCont && cam.shutter < 1.3 * cam.focal && cam.shutter <= 60) add('slowShutter', 1);
  if (cam.iso >= 3200) add('highIso', 1);

  out.sort((a, b) => b.sev - a.sev);
  return out;
}

export const critiqueSig = (list) => list.map((c) => c.id + (c.args ? JSON.stringify(c.args, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)) : '')).join('|');
