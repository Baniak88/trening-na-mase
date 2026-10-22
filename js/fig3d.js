/* 3D exercise figure: a smooth mannequin built from primitives (no external models), posed by joint angles,
 * with muscle groups coloured by how much they work. One WebGL renderer is shared and moved between containers.
 * Pose data lives in js/data/poses3d.js. */
import * as THREE from './vendor/three.module.min.js';

const D = Math.PI / 180;
/* Segment lengths (m): upper arm, forearm to wrist, wrist to grip centre; thigh, shin. */
const ARM = {a: 0.3, f: 0.275, g: 0.05}; ARM.b = ARM.f + ARM.g;
const LEG = {a: 0.44, b: 0.43};
const ANKLE_Y = 0.068; // ankle height when the foot is flat on the floor
const COL = {body: 0xCBD5E3, shorts: 0x2C3346, shoe: 0x2C3346, hair: 0x3A3F4C, p: 0xFF6A3D, s: 0xFFB08F,
  metal: 0x8C96A8, plate: 0x2F3544, pad: 0x3A4256, frame: 0x6B7487, cable: 0x55607A};

/* ---------- Geometry helpers ---------- */
/** Tapered limb along -Y from 0 to -len, radius r0 at the top and r1 at the bottom, with rounded ends. */
function limbGeo(len, r0, r1, bulge = 0.12, seg = 22) {
  const pts = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = r0 + (r1 - r0) * t + bulge * r0 * Math.sin(Math.PI * Math.min(1, t * 1.25));
    pts.push(new THREE.Vector2(r, -t * len));
  }
  // round caps
  const cap = (y, r, dir) => { const out = []; for (let i = 1; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; out.push(new THREE.Vector2(r * Math.cos(a), y + dir * r * Math.sin(a) * 0.9)); } return out; };
  const top = cap(0, pts[0].x, 1).reverse(), bot = cap(-len, pts[n].x, -1);
  const prof = [new THREE.Vector2(0, top.length ? top[0].y : 0), ...top.slice(1), ...pts, ...bot.slice(0, -1), new THREE.Vector2(0, bot[bot.length - 1].y)];
  const g = new THREE.LatheGeometry(prof.reverse(), seg); // bottom to top keeps the faces pointing outwards
  g.computeVertexNormals();
  return g;
}
const sphere = (r, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 24, 16); g.scale(sx, sy, sz); return g; };
const mat = (c, rough = 0.62) => new THREE.MeshStandardMaterial({color: c, roughness: rough, metalness: 0.05});

/* ---------- Mannequin ---------- */
const MUSCLE_KEYS = ['chest', 'back', 'delts', 'biceps', 'triceps', 'forearms', 'abs', 'glutes', 'quads', 'hams', 'calves'];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* Muscle regions on the skin, evaluated per vertex in joint space (front = +z, segment runs along y). */
const REG = {
  torso: v => ({chest: ss(0.025, 0.06, v.z) * ss(0.1, 0.14, v.y) * (1 - ss(0.255, 0.285, v.y)) * (1 - ss(0.15, 0.19, Math.abs(v.x))),
    abs: ss(0.03, 0.07, v.z) * (1 - ss(0.09, 0.13, v.y)) * (1 - ss(0.06, 0.09, Math.abs(v.x))),
    back: ss(-0.025, -0.06, v.z) * ss(0.0, 0.05, v.y) * (1 - ss(0.3, 0.34, v.y))}),
  waist: v => ({abs: ss(0.035, 0.07, v.z) * (1 - ss(0.055, 0.085, Math.abs(v.x))) * ss(0.02, 0.06, v.y), back: ss(-0.035, -0.07, v.z) * ss(0.12, 0.2, v.y)}),
  hips: v => ({glutes: 0.85 * ss(-0.03, -0.075, v.z) * (1 - ss(0.04, 0.08, v.y))}),
  upper: v => ({delts: 1 - ss(-0.06, -0.095, v.y), biceps: ss(-0.07, -0.1, v.y) * (1 - ss(-0.24, -0.27, v.y)) * ss(0.005, 0.03, v.z),
    triceps: ss(-0.07, -0.1, v.y) * (1 - ss(-0.25, -0.28, v.y)) * ss(-0.005, -0.03, v.z)}),
  fore: v => ({forearms: 1 - ss(-0.16, -0.21, v.y)}),
  thigh: v => ({quads: ss(-0.14, -0.18, v.y) * (1 - ss(-0.37, -0.42, v.y)) * ss(0.0, 0.035, v.z),
    hams: ss(-0.14, -0.18, v.y) * (1 - ss(-0.36, -0.41, v.y)) * ss(-0.01, -0.045, v.z)}),
  shin: v => ({calves: ss(-0.03, -0.07, v.y) * (1 - ss(-0.27, -0.33, v.y)) * ss(-0.005, -0.03, v.z)}),
};

export function buildFigure() {
  const skin = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.55, metalness: 0.02});
  const cloth = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.85, metalness: 0});
  const hair = mat(COL.hair, 0.9), shoe = mat(COL.shoe, 0.7);
  const J = {}, painted = [];
  /** Adds a mesh; reg = region function, or a muscle key for the whole mesh, or null. */
  const add = (parent, geo, material, reg = null, base = COL.body, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m);
    if (material.vertexColors) {
      m.updateMatrix(); const pos = geo.attributes.position, n = pos.count, w = {}; const v = new THREE.Vector3();
      for (const k of MUSCLE_KEYS) w[k] = null;
      if (reg) for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix);
        const r = typeof reg === 'string' ? {[reg]: 1} : reg(v);
        for (const k in r) if (r[k] > 0) { (w[k] = w[k] || new Float32Array(n))[i] = r[k]; }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      m.userData.paint = {w, base: new THREE.Color(base)}; painted.push(m);
    }
    return m;
  };
  const xf = (geo, sx, sy, sz, rx = 0) => { if (rx) geo.rotateX(rx); geo.scale(sx, sy, sz); return geo; };
  const joint = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); J[name] = g; return g; };

  const root = new THREE.Group(); J.root = root;
  const pelvis = joint('pelvis', root, 0, 0, 0);
  add(pelvis, xf(limbGeo(0.2, 0.145, 0.165, 0.05), 1, 1, 0.74), cloth, REG.hips, COL.shorts, 0, 0.08, 0);
  add(pelvis, sphere(0.085, 1, 1.0, 0.75), cloth, 'glutes', COL.shorts, 0.07, -0.06, -0.068);
  add(pelvis, sphere(0.085, 1, 1.0, 0.75), cloth, 'glutes', COL.shorts, -0.07, -0.06, -0.068);
  const spine = joint('spine', pelvis, 0, 0.06, 0);
  add(spine, xf(limbGeo(0.22, 0.132, 0.142, 0.02), 1, 1, 0.7, Math.PI), skin, REG.waist);
  const chest = joint('chest', spine, 0, 0.18, 0);
  add(chest, xf(limbGeo(0.29, 0.145, 0.19, 0.05), 1.08, 1, 0.62, Math.PI), skin, REG.torso);
  add(chest, sphere(0.088, 1.12, 0.7, 0.3), skin, 'chest', COL.body, 0.074, 0.19, 0.085);
  add(chest, sphere(0.088, 1.12, 0.7, 0.3), skin, 'chest', COL.body, -0.074, 0.19, 0.085);
  add(chest, sphere(0.1, 0.85, 1.45, 0.2), skin, 'back', COL.body, 0.085, 0.13, -0.08);
  add(chest, sphere(0.1, 0.85, 1.45, 0.2), skin, 'back', COL.body, -0.085, 0.13, -0.08);
  add(chest, sphere(0.09, 1.5, 0.55, 0.45), skin, 'back', COL.body, 0, 0.27, -0.045);
  const neck = joint('neck', chest, 0, 0.29, 0.005);
  add(neck, limbGeo(0.09, 0.052, 0.056, 0).rotateX(Math.PI), skin);
  const head = joint('head', neck, 0, 0.1, 0.01);
  add(head, sphere(0.1, 0.84, 1.08, 0.98), skin, null, COL.body, 0, 0.05, 0.005);
  add(head, sphere(0.102, 0.86, 0.66, 0.98), hair, null, 0, 0, 0.095, -0.014);
  add(head, sphere(0.02, 0.9, 1, 0.9), skin, null, COL.body, 0, 0.04, 0.094);
  add(head, sphere(0.05, 1.3, 0.75, 1), skin, null, COL.body, 0, -0.025, 0.035);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sh = joint('sh' + L, chest, s * 0.205, 0.245, -0.005);
    add(sh, sphere(0.07, 1.0, 1.1, 1.0), skin, 'delts', COL.body, s * 0.008, -0.025, 0);
    add(sh, limbGeo(0.3, 0.058, 0.045, 0.06), skin, REG.upper);
    add(sh, sphere(0.036, 1, 2.1, 0.62), skin, 'biceps', COL.body, 0, -0.155, 0.03);
    add(sh, sphere(0.038, 1, 2.2, 0.6), skin, 'triceps', COL.body, 0, -0.13, -0.03);
    const el = joint('el' + L, sh, 0, -ARM.a, 0);
    add(el, limbGeo(0.27, 0.047, 0.032, 0.1), skin, REG.fore);
    const hand = joint('hand' + L, el, 0, -ARM.f, 0);
    add(hand, sphere(0.036, 0.75, 1.25, 1.0), skin, null, COL.body, 0, -0.035, 0.005);
  }
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const hp = joint('hp' + L, pelvis, s * 0.088, -0.05, 0);
    add(hp, limbGeo(0.16, 0.09, 0.083, 0), cloth, REG.hips, COL.shorts);
    add(hp, limbGeo(0.44, 0.08, 0.052, 0.06), skin, REG.thigh);
    add(hp, sphere(0.06, 1.1, 2.7, 0.5), skin, 'quads', COL.body, 0, -0.24, 0.042);
    add(hp, sphere(0.055, 1.05, 2.6, 0.45), skin, 'hams', COL.body, 0, -0.24, -0.045);
    const kn = joint('kn' + L, hp, 0, -LEG.a, 0);
    add(kn, limbGeo(0.43, 0.05, 0.034, 0.06), skin, REG.shin);
    add(kn, sphere(0.042, 1.05, 2.2, 0.62), skin, 'calves', COL.body, 0, -0.12, -0.03);
    const an = joint('an' + L, kn, 0, -LEG.b, 0);
    const foot = add(an, sphere(0.05, 0.85, 0.55, 2.3), shoe, null, 0, 0, -0.04, 0.06);
    foot.userData.foot = true;
  }
  return {root, J, painted};
}

/* ---------- Equipment ---------- */
function barbell(len = 1.9, pr = 0.22) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 12), mat(COL.metal, 0.35)); bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const s of [1, -1]) {
    for (let i = 0; i < 2; i++) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(pr - i * pr * 0.18, pr - i * pr * 0.18, 0.04, 32), mat(COL.plate, 0.7)); pl.rotation.z = Math.PI / 2; pl.position.x = s * (len / 2 - 0.25 + i * 0.05); g.add(pl); }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), mat(COL.metal, 0.35)); col.rotation.z = Math.PI / 2; col.position.x = s * (len / 2 - 0.3); g.add(col);
  }
  return g;
}
function dumbbell() {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 10), mat(COL.metal, 0.35)); h.rotation.z = Math.PI / 2; g.add(h);
  for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 6), mat(COL.plate, 0.7)); b.rotation.z = Math.PI / 2; b.position.x = s * 0.11; g.add(b); }
  return g;
}
const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, 0.75)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
/** Static props. Each is [type, params]; positions in metres, the figure stands at the origin facing +z. */
function prop(p) {
  const g = new THREE.Group();
  const [t, a = {}] = p;
  const legs = (x0, x1, z0, z1, top) => { for (const x of [x0, x1]) for (const z of [z0, z1]) g.add(box(0.05, top, 0.05, COL.frame, x, top / 2, z)); };
  if (t === 'bench') { // flat pad along z
    const len = a.len || 1.2, y = a.y || 0.44, z = a.z || 0;
    g.add(box(0.3, 0.07, len, COL.pad, a.x || 0, y, z));
    legs(-0.09 + (a.x || 0), 0.09 + (a.x || 0), z - len * 0.38, z + len * 0.38, y - 0.035);
  } else if (t === 'incline') { // seat + back pad leaning back at a.inc degrees from horizontal
    const inc = (a.inc || 40) * D, y = a.y || 0.45, len = a.len || 0.95, z0 = a.z || 0;
    g.add(box(0.32, 0.07, 0.36, COL.pad, 0, y, z0 + 0.12));
    const back = box(0.3, 0.07, len, COL.pad, 0, y + Math.sin(inc) * len / 2 + 0.02, z0 - Math.cos(inc) * len / 2); back.rotation.x = inc; g.add(back);
    legs(-0.1, 0.1, z0 - 0.2, z0 + 0.25, y - 0.035);
  } else if (t === 'seat') { // machine seat with an upright back
    const y = a.y || 0.5, z = a.z || 0;
    g.add(box(0.36, 0.08, 0.4, COL.pad, 0, y, z + 0.06));
    if (a.back !== false) g.add(box(0.36, a.backH || 0.6, 0.08, COL.pad, 0, y + 0.04 + (a.backH || 0.6) / 2, z - 0.2 - (a.backTilt || 0)));
    g.add(box(0.08, y - 0.04, 0.08, COL.frame, 0, (y - 0.04) / 2, z));
    g.add(box(0.5, 0.04, 0.5, COL.frame, 0, 0.02, z));
  } else if (t === 'box') g.add(box(a.w || 0.4, a.h || 0.4, a.d || 0.4, a.c || COL.pad, a.x || 0, a.y ?? (a.h || 0.4) / 2, a.z || 0));
  else if (t === 'bar') { // pull-up bar
    const y = a.y || 2.3, z = a.z || 0;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.4, 12), mat(COL.metal, 0.35)); b.rotation.z = Math.PI / 2; b.position.set(0, y, z); g.add(b);
    for (const s of [1, -1]) g.add(box(0.06, y + 0.05, 0.06, COL.frame, s * 0.7, (y + 0.05) / 2, z));
  } else if (t === 'pbars') { // dip bars along z
    const y = a.y || 1.2;
    for (const s of [1, -1]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 12), mat(COL.metal, 0.35)); b.rotation.x = Math.PI / 2; b.position.set(s * (a.w || 0.28), y, a.z || 0.1); g.add(b);
      g.add(box(0.05, y, 0.05, COL.frame, s * (a.w || 0.28), y / 2, (a.z || 0.1) - 0.35)); g.add(box(0.05, y, 0.05, COL.frame, s * (a.w || 0.28), y / 2, (a.z || 0.1) + 0.35));
    }
  } else if (t === 'tower') { // cable column, pulley at (a.x, a.y, a.z)
    const x = a.x || 0, z = a.z ?? -0.8, y = a.y || 2.1;
    g.add(box(0.12, 2.3, 0.12, COL.frame, x, 1.15, z + (a.back ?? -0.1)));
    const pu = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), mat(COL.metal, 0.4)); pu.rotation.z = Math.PI / 2; pu.position.set(x, y, z); g.add(pu);
    g.userData.pulley = new THREE.Vector3(x, y, z);
  } else if (t === 'pad') { // free box, optionally tilted
    const b = box(a.w || 0.3, a.h || 0.08, a.d || 0.4, a.c || COL.pad, a.x || 0, a.y || 0.5, a.z || 0); b.rotation.x = (a.rx || 0) * D; g.add(b);
  } else if (t === 'plate') { // tilted platform (hack squat, calf block)
    const b = box(a.w || 0.6, a.h || 0.05, a.d || 0.45, a.c || COL.frame, a.x || 0, a.y || 0.03, a.z || 0); b.rotation.x = (a.rx || 0) * D; g.add(b);
  } else if (t === 'rails') { // smith machine or hack squat rails beside the figure
    for (const s of [1, -1]) g.add(box(0.05, 2.1, 0.05, COL.frame, s * (a.w || 0.75), 1.05, a.z || -0.05));
  }
  return g;
}

/* ---------- Pose ----------
 * Each key position sets trunk angles (FK) plus optional targets that are solved with two-bone IK:
 * hands go to the bar, the chest, the floor; feet stay planted. Targets are blended in world space, so the
 * bar travels the way it should (to the lower chest, over the middle of the foot) instead of wherever the
 * interpolated joint angles happen to put it. See js/data/poses3d.js for the fields. */
const lerp = (a, b, t) => a + (b - a) * t;
const DEF = {root: [0, 0.95, 0, 0, 0], tilt: 0, sp: 0, nk: 0, hd: 0, sf: 0, sa: 8, sr: 0, el: 8, wr: 0, hf: 0, ha: 4, kn: 0, an: 0, bal: 0, stand: 0};
const TKEYS = new Set(['hw', 'hc', 'hp', 'hs', 'hv', 'hr', 'at']);
const isPair = v => Array.isArray(v) && v.length === 2 && (v[0] === null || v[1] === null || Array.isArray(v[0]) || Array.isArray(v[1]));
function mixv(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => (v == null || b[i] == null ? (t < 0.5 ? v : b[i]) : mixv(v, b[i], t)));
  if (Array.isArray(a) && typeof b === 'number') return a.map(v => mixv(v, b, t));
  if (typeof a === 'number' && Array.isArray(b)) return b.map(v => mixv(a, v, t));
  return t < 0.5 ? a : b;
}
function mix(A, B, t) {
  const o = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (TKEYS.has(k)) continue;
    const dA = k === 'ch' ? (A.sp || 0) * 0.6 : DEF[k], dB = k === 'ch' ? (B.sp || 0) * 0.6 : DEF[k];
    o[k] = mixv(A[k] ?? dA ?? B[k], B[k] ?? dB ?? A[k], t);
  }
  o.atw = lerp(A.at ? 1 : 0, B.at ? 1 : 0, t);
  o.at = A.at && B.at ? mixv(A.at, B.at, t) : A.at || B.at;
  return o;
}
/** Applies joint angles (degrees). sh/el/hp/kn/an take [left, right] or one number for both. */
function apply(F, p) {
  const J = F.J; const two = v => (Array.isArray(v) ? v : [v, v]);
  const r = p.root || DEF.root; // [x, y, z, pitch, yaw]
  J.root.position.set(r[0], r[1], r[2]); J.root.rotation.set(0, 0, 0); J.root.rotation.order = 'YXZ'; J.root.rotation.y = (r[4] || 0) * D; J.root.rotation.x = ((r[3] || 0) + (p.tilt || 0)) * D;
  J.spine.rotation.set((p.sp || 0) * D, 0, 0); J.chest.rotation.set((p.ch ?? (p.sp || 0) * 0.6) * D, 0, 0);
  J.neck.rotation.set((p.nk || 0) * D, 0, 0); J.head.rotation.set((p.hd || 0) * D, 0, 0);
  const sf = two(p.sf ?? 0), sa = two(p.sa ?? 8), sr = two(p.sr ?? 0), el = two(p.el ?? 8), hf = two(p.hf ?? 0), ha = two(p.ha ?? 4), kn = two(p.kn ?? 0), an = two(p.an ?? 0);
  [['L', 1, 0], ['R', -1, 1]].forEach(([L, s, i]) => {
    const sh = J['sh' + L]; sh.rotation.order = 'ZXY'; sh.rotation.set(-sf[i] * D, s * sr[i] * D, s * sa[i] * D);
    J['el' + L].rotation.set(-el[i] * D, 0, 0);
    J['hand' + L].rotation.set((p.wr || 0) * D, 0, 0);
    const hp = J['hp' + L]; hp.rotation.order = 'ZXY'; hp.rotation.set(-hf[i] * D, 0, s * ha[i] * D);
    J['kn' + L].rotation.set(kn[i] * D, 0, 0);
    J['an' + L].rotation.set(-an[i] * D, 0, 0);
  });
}

/* ---------- IK ---------- */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m4 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _e = new THREE.Euler();
const wpos = o => { o.updateWorldMatrix(true, false); return o.getWorldPosition(V3()); };
const wquat = o => { o.updateWorldMatrix(true, false); return o.getWorldQuaternion(new THREE.Quaternion()); };
/** Points j1 (upper joint) and bends j2 so the end of the chain reaches T, bending towards the pole.
 * Arms bend towards local +z, legs towards -z. Returns how far the target is out of reach (m). */
function twoBone(j1, j2, a, b, T, pole, arm) {
  const S = wpos(j1);
  const d = T.clone().sub(S); const L0 = d.length();
  const dir = L0 > 1e-6 ? d.divideScalar(L0) : V3(0, -1, 0);
  const L = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-3, L0));
  const cosA = (a * a + L * L - b * b) / (2 * a * L), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1).addScaledVector(dir, -dir.z);
  pp.normalize();
  const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pp, a * sinA);
  const Y = S.clone().sub(E).divideScalar(a);
  const f = S.clone().addScaledVector(dir, L).sub(E).divideScalar(b);
  const c = -f.dot(Y);
  const Z = f.clone().addScaledVector(Y, c);
  if (Z.lengthSq() < 1e-6) Z.copy(pp).negate().addScaledVector(Y, pp.dot(Y));
  Z.normalize(); if (!arm) Z.negate();
  const X = V3().crossVectors(Y, Z);
  _m4.makeBasis(X, Y, Z); _q1.setFromRotationMatrix(_m4);
  j1.quaternion.copy(wquat(j1.parent).invert().multiply(_q1));
  const bend = Math.atan2(Math.sqrt(Math.max(0, 1 - c * c)), c);
  j2.rotation.set(arm ? -bend : bend, 0, 0);
  j1.updateWorldMatrix(false, true);
  return Math.max(0, L0 - (a + b));
}
const FOOT_BALL = V3(0, -0.062, 0.125); // ball of the foot in ankle space
const footQ = (yaw, pitch) => new THREE.Quaternion().setFromEuler(_e.set(pitch * D, yaw * D, 0, 'YXZ'));
const handPos = (F, L) => F.J['hand' + L].localToWorld(V3(0, -ARM.g, 0.01));
const SIDES = [['L', 1, 0], ['R', -1, 1]];
const pick = (v, i) => (isPair(v) ? v[i] : v);
const num = (v, i, d) => { const x = Array.isArray(v) ? v[i] : v; return x == null ? d : x; };

/* ---------- Scene and player ---------- */
let R = null; // shared state: one figure, one renderer
function stage() {
  if (R) return R;
  const scene = new THREE.Scene();
  const F = buildFigure(); scene.add(F.root);
  R = {scene, F, props: new THREE.Group(), tools: new THREE.Group(), cables: [], spec: null, t: 0, last: 0, raf: 0, el: null, yaw: 0, drag: null, hold: -1, err: 0};
  scene.add(R.props, R.tools);
  return R;
}
function ensure() {
  stage();
  if (R.renderer) return R;
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const {scene} = R;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d98ad, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.2, 4, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -2, right: 2, top: 2.6, bottom: -1, near: 0.5, far: 12}); key.shadow.radius = 4; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd3ff, 0.9); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), new THREE.ShadowMaterial({opacity: 0.16})); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  R.camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 30);
  R.renderer = renderer;
  return R;
}

const _c = new THREE.Color(), _p = new THREE.Color(COL.p), _s = new THREE.Color(COL.s);
export function setMuscles(F, m) {
  for (const mesh of F.painted) {
    const {w, base} = mesh.userData.paint; const col = mesh.geometry.attributes.color; const n = col.count;
    for (let i = 0; i < n; i++) {
      _c.copy(base); let best = 0, lv = 0;
      for (const k of MUSCLE_KEYS) { const a = w[k]; if (!a || !m[k]) continue; const x = a[i]; if (x > best || (x === best && m[k] > lv)) { best = x; lv = m[k]; } }
      if (best > 0) _c.lerp(lv >= 1 ? _p : _s, best);
      col.setXYZ(i, _c.r, _c.g, _c.b);
    }
    col.needsUpdate = true;
  }
}

function clear(g) { while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } }

/** Tempo: pause, the first half of the rep, short pause, the second half. The lowering (eccentric) half is slower. */
const easeIO = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
function phaseK(t, ecc) {
  const TL = ecc ? [[0, 0, 500], [0, 1, 1900], [1, 1, 350], [1, 0, 1200]] : [[0, 0, 450], [0, 1, 1200], [1, 1, 500], [1, 0, 1900]];
  const tot = TL.reduce((a, p) => a + p[2], 0); t %= tot;
  for (const [a, b, d] of TL) { if (t < d) return a + (b - a) * easeIO(t / d); t -= d; }
  return 0;
}

/** Key positions around k: [first, second, local t]. M (optional) sits at spec.mk (default 0.5). */
function segment(spec, k) {
  if (!spec.M) return [spec.A, spec.B, k];
  const m = spec.mk ?? 0.5;
  return k <= m ? [spec.A, spec.M, k / m] : [spec.M, spec.B, (k - m) / (1 - m)];
}
/** Hand target of one key position for one side: a world point, a direction from the shoulder, or null (FK). */
function target(K, i, s, g) {
  const {J} = R.F, L = i ? 'R' : 'L';
  for (const key of ['hw', 'hc', 'hp', 'hs', 'hv']) {
    if (K[key] === undefined) continue;
    const pair = isPair(K[key]); const v = pair ? K[key][i] : K[key];
    if (!v) continue;
    const x = key === 'hs' || key === 'hv' || pair ? s * v[0] : v[0] + s * g;
    const p = V3(key === 'hw' && pair ? v[0] : x, v[1], v[2]);
    if (key === 'hw') return {p};
    if (key === 'hc') return {p: J.chest.localToWorld(p)};
    if (key === 'hp') return {p: J.pelvis.localToWorld(p)};
    if (key === 'hs') return {p: wpos(J['sh' + L]).add(p)};
    return {d: p.normalize(), r: num(K.hr, i, ARM.a + ARM.b - 0.02)};
  }
  return null;
}
function dirPoint(t, L) { const {J} = R.F; return wpos(J['sh' + L]).addScaledVector(t.d.clone().applyQuaternion(wquat(J.chest)), t.r); }
function handTargets(spec, k, p) {
  const [K0, K1, t] = segment(spec, k); const g = p.g ?? spec.grip ?? 0.25;
  return SIDES.map(([L, s, i]) => {
    const a = target(K0, i, s, g), b = target(K1, i, s, g);
    if (!a || !b) return null;
    if (a.d && b.d) { const qa = new THREE.Quaternion(), qb = new THREE.Quaternion().setFromUnitVectors(a.d, b.d); qa.slerp(qb, t); return dirPoint({d: a.d.clone().applyQuaternion(qa), r: lerp(a.r, b.r, t)}, L); }
    const pa = a.d ? dirPoint(a, L) : a.p, pb = b.d ? dirPoint(b, L) : b.p;
    return pa.lerp(pb, t);
  });
}
function solveArms(spec, p, T) {
  const {J} = R.F; const ep = p.ep ?? spec.ep ?? [1, -0.6, -0.3]; const cq = wquat(J.chest); let err = 0;
  SIDES.forEach(([L, s, i]) => {
    if (!T[i]) return;
    const e = Array.isArray(ep[0]) ? ep[i] : ep;
    J['hand' + L].rotation.set(0, 0, 0);
    err = Math.max(err, twoBone(J['sh' + L], J['el' + L], ARM.a, ARM.b, T[i], V3(s * e[0], e[1], e[2]).applyQuaternion(cq), true));
  });
  return err;
}
const handsMid = F => handPos(F, 'L').add(handPos(F, 'R')).multiplyScalar(0.5);
function shift(F, v) { F.root.position.add(v); F.root.updateMatrixWorld(true); }
/** World positions of the ankles and the foot rotations for this frame. */
function feetFrame(spec, p) {
  const f = spec.feet; const r = p.root || DEF.root;
  return SIDES.map(([L, s, i]) => {
    const yaw = (r[4] || 0) + s * num(p.ftoe, i, f.toe ?? 12), q = footQ(yaw, num(p.fp, i, 0));
    const pt = V3(s * num(p.fx, i, f.w ?? 0.14), num(p.fy, i, f.y ?? (num(f.ball, i, false) ? 0.02 : ANKLE_Y)), num(p.fz, i, f.z ?? 0));
    if (num(f.ball, i, false)) pt.sub(FOOT_BALL.clone().applyQuaternion(q));
    return {pt, q};
  });
}
function hipPos(F, L) { return wpos(F.J['hp' + L]); }
/** Raises or lowers the body so the legs are almost straight (standing tall). */
function standTall(F, ft, w, only, soft) {
  let dy = Infinity;
  SIDES.forEach(([L, s, i]) => { if (!only.includes(L)) return; const h = hipPos(F, L), a = ft[i].pt; const dh = Math.hypot(h.x - a.x, h.z - a.z); const reach = LEG.a + LEG.b - soft; if (dh < reach) dy = Math.min(dy, a.y + Math.sqrt(reach * reach - dh * dh) - h.y); });
  if (dy < Infinity) shift(F, V3(0, dy * w, 0));
}
function balPoint(spec, F) {
  const b = spec.bal; if (b === 'hands') return handsMid(F);
  return (b.f === 'p' ? F.J.pelvis : F.J.chest).localToWorld(V3(...b.v));
}

function pose(k) {
  const {F, spec} = R; const J = F.J;
  if (spec.bal0 && R.bal0 == null) {
    R.bal0 = 0; pose(0);
    const ft0 = feetFrame(spec, mix(...segment(spec, 0).slice(0, 2), 0));
    R.bal0 = (spec.balZ ?? (ft0[0].pt.z + ft0[1].pt.z) / 2 + 0.05) - balPoint(spec, F).z;
  }
  const [K0, K1, t] = segment(spec, k);
  const p = mix(K0, K1, t);
  apply(F, p); F.root.updateMatrixWorld(true);
  if (spec.pin) { const fr = spec.pin.f === 'p' ? J.pelvis : J.chest; shift(F, V3(...spec.pin.w).sub(fr.localToWorld(V3(...spec.pin.v)))); }
  if (spec.rest != null) shift(F, V3(0, spec.rest - trunkFloor(F), 0)); // lying on the floor: the back rests on it
  const ft = spec.feet ? feetFrame(spec, p) : null;
  const needHands = p.atw > 0 || (spec.bal === 'hands' && (p.bal ?? 1) > 0) || spec.hands;
  if (needHands) solveArms(spec, p, handTargets(spec, k, p));
  if (spec.hands) shift(F, V3(...spec.hands).sub(handsMid(F)));
  else if (p.atw > 0) shift(F, V3(...p.at).sub(handsMid(F)).multiplyScalar(p.atw));
  if (spec.bal0) shift(F, V3(0, 0, R.bal0)); // balance measured once in the start position: the body does not drift during the rep
  const balW = spec.bal ? p.bal ?? 0 : 0;
  const balZ = () => spec.balZ ?? (ft ? (ft[0].pt.z + ft[1].pt.z) / 2 + 0.05 : 0.05);
  if (balW > 0) shift(F, V3(0, 0, (balZ() - balPoint(spec, F).z) * balW));
  const only = spec.fik || 'LR', soft = p.soft ?? 0.008;
  if (ft && p.stand > 0) { standTall(F, ft, p.stand, only, soft); if (balW > 0) { shift(F, V3(0, 0, (balZ() - balPoint(spec, F).z) * balW)); standTall(F, ft, p.stand, only, soft); } }
  let err = 0;
  if (ft) {
    const kp = p.kp ?? spec.kp ?? [0.25, 0, 1]; const r = p.root || DEF.root; const kq = footQ(r[4] || 0, r[3] || 0);
    SIDES.forEach(([L, s, i]) => {
      if (!only.includes(L)) return;
      const e = Array.isArray(kp[0]) ? kp[i] : kp;
      err = Math.max(err, twoBone(J['hp' + L], J['kn' + L], LEG.a, LEG.b, ft[i].pt, V3(s * e[0], e[1], e[2]).applyQuaternion(kq), false));
      J['an' + L].quaternion.copy(wquat(J['kn' + L]).invert().multiply(ft[i].q));
    });
  } else if (spec.ground !== false) { shift(F, V3(0, -footFloor(F), 0)); }
  err = Math.max(err, solveArms(spec, p, handTargets(spec, k, p)));
  F.root.updateMatrixWorld(true);
  R.err = err;
  placeTools(F, spec);
}
const _b = new THREE.Box3(), _tv = new THREE.Vector3();
/** Lowest skin point of the trunk and head (meshes on pelvis, spine, chest, neck, head). */
function trunkFloor(F) {
  F.root.updateMatrixWorld(true); let min = Infinity;
  for (const n of ['pelvis', 'spine', 'chest', 'neck', 'head']) for (const m of F.J[n].children) {
    if (!m.isMesh) continue; const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) { _tv.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); if (_tv.y < min) min = _tv.y; }
  }
  return min;
}
/** Lowest point of the feet in world space. */
function footFloor(F) {
  let min = Infinity;
  F.root.updateMatrixWorld(true);
  F.root.traverse(o => { if (o.userData.foot) { _b.setFromObject(o); min = Math.min(min, _b.min.y); } });
  return min;
}
const AX = {x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1)};
function placeTools(F, spec) {
  const J = F.J; const hl = handPos(F, 'L'), hr = handPos(F, 'R');
  const dba = spec.dba || 'cx', fr = s => (dba[0] === 'c' ? J.chest : J['hand' + s]);
  R.tools.children.forEach(o => {
    const u = o.userData;
    if (u.kind === 'bar') { o.position.copy(hl).add(hr).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(AX.x, hl.clone().sub(hr).normalize()); }
    else if (u.kind === 'db' || u.kind === 'one') {
      const side = u.side || 'L'; const q = wquat(fr(side));
      o.position.copy(u.kind === 'one' ? hl.clone().add(hr).multiplyScalar(0.5) : side === 'L' ? hl : hr);
      if (spec.dbo) o.position.add(V3(...spec.dbo).applyQuaternion(q));
      o.quaternion.setFromUnitVectors(AX.x, AX[dba[1]].clone().applyQuaternion(q));
    }
    else if (u.kind === 'handle') { o.position.copy(hl).add(hr).multiplyScalar(0.5); if (u.align) o.quaternion.setFromUnitVectors(AX.x, hl.clone().sub(hr).normalize()); }
    else if (u.kind === 'grip') { o.position.copy(u.side === 'L' ? hl : hr); }
    else if (u.kind === 'sled') { const sp = spec.sledBall || (spec.feet && spec.feet.ball) ? V3(0, -0.075, 0.125) : V3(0, -0.075, 0.06); const fl = J.anL.localToWorld(sp.clone()), fr2 = J.anR.localToWorld(sp); o.position.copy(fl).add(fr2).multiplyScalar(0.5); }
    else if (u.kind === 'roller') { const a = J.knL.localToWorld(V3(0, -u.at, u.z)), b = J.knR.localToWorld(V3(0, -u.at, u.z)); o.position.copy(u.side === 'L' ? a : u.side === 'R' ? b : a.add(b).multiplyScalar(0.5)); }
    else if (u.kind === 'pad') { o.position.copy(J[u.frame].localToWorld(V3(...u.v))); o.quaternion.copy(wquat(J[u.frame])).multiply(new THREE.Quaternion().setFromEuler(_e.set((u.rx || 0) * D, 0, 0))); }
    else if (u.kind === 'landmine') {
      const piv = V3(...u.pivot), h = hl.clone().add(hr).multiplyScalar(0.5); const dir = h.clone().sub(piv); const len = dir.length() + 0.25; dir.normalize();
      o.position.copy(piv).addScaledVector(dir, len / 2); o.quaternion.setFromUnitVectors(AX.y, dir); o.scale.set(1, len, 1); R.lm = {h, dir};
    }
    else if (u.kind === 'lmplate' && R.lm) { o.position.copy(R.lm.h).addScaledVector(R.lm.dir, 0.15); o.quaternion.setFromUnitVectors(AX.y, R.lm.dir); }
  });
  for (const c of R.cables) {
    const to = c.side === 'L' ? hl : c.side === 'R' ? hr : hl.clone().add(hr).multiplyScalar(0.5);
    const pos = c.line.geometry.attributes.position; pos.setXYZ(0, c.from.x, c.from.y, c.from.z); pos.setXYZ(1, to.x, to.y, to.z); pos.needsUpdate = true;
  }
}

/** Box around the figure, its props and tools over the whole movement. */
function fitBox() {
  const box = new THREE.Box3();
  for (const k of [0, 0.25, 0.5, 0.75, 1]) { pose(k); R.scene.updateMatrixWorld(true); box.expandByObject(R.F.root); box.expandByObject(R.tools); }
  box.expandByObject(R.props);
  return box;
}
function frameCamera() {
  const {camera, spec} = R;
  const v = spec.view || [35, 12];
  const yaw = (v[0] + R.yaw) * D, pitch = v[1] * D;
  const b = R.box, c = b.getCenter(V3()), sz = b.getSize(V3());
  const half = Math.tan(camera.fov * D / 2);
  const rad = Math.max(sz.y / 2 / half, Math.hypot(sz.x, sz.z) / 2 / (half * camera.aspect)) * 1.0 + Math.hypot(sz.x, sz.z) / 2;
  const dist = (spec.dist || 1) * Math.max(2.4, rad);
  camera.position.set(c.x + dist * Math.sin(yaw) * Math.cos(pitch), c.y + dist * Math.sin(pitch), c.z + dist * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(c);
}

function draw() {
  if (!R || !R.el || !R.renderer) return;
  const {renderer, scene, camera, el} = R;
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  frameCamera();
  renderer.render(scene, camera);
}

function loop(ts) {
  R.raf = 0;
  if (!R.el || !R.el.isConnected) { R.el = null; return; }
  const dt = R.last ? Math.min(60, ts - R.last) : 16; R.last = ts;
  if (R.hold < 0 && !R.reduced) R.t += dt;
  const k = R.hold >= 0 ? R.hold : R.reduced ? 1 : phaseK(R.t, R.spec.ecc);
  pose(k); draw(); if (R.onPhase) R.onPhase(k);
  R.raf = requestAnimationFrame(loop);
}

/** Builds the props and the equipment the hands or feet carry. */
function setup(spec, muscles) {
  stage();
  R.spec = spec; R.bal0 = null;
  clear(R.props); clear(R.tools); for (const c of R.cables) R.scene.remove(c.line); R.cables = [];
  const pulleys = [];
  for (const p of spec.props || []) { const g = prop(p); R.props.add(g); if (g.userData.pulley) pulleys.push(g.userData.pulley); }
  const eq = spec.eq || 'none';
  const metal = () => mat(COL.metal, 0.4);
  const add = (o, u) => { o.userData = u; R.tools.add(o); return o; };
  if (eq === 'bar') add(barbell(spec.barLen || 1.9, spec.plate || 0.225), {kind: 'bar'});
  if (eq === 'db') for (const s of spec.one ? [spec.one] : ['L', 'R']) add(dumbbell(), {kind: 'db', side: s});
  if (eq === 'db1') add(dumbbell(), {kind: 'one'});
  if (eq === 'grip') for (const s of spec.one ? [spec.one] : ['L', 'R']) add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10), metal()), {kind: 'grip', side: s});
  if (eq === 'sled') { const pl = box(0.62, 0.05, 0.5, COL.frame, 0, 0, 0); pl.geometry.rotateX((spec.sledTilt ?? 45) * D); const g = new THREE.Group(); g.add(pl); add(g, {kind: 'sled'}); }
  if (eq === 'landmine') {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1, 10), mat(COL.metal, 0.35)); g.add(b); add(g, {kind: 'landmine', pivot: spec.pivot});
    const pl = new THREE.Group(); for (let i = 0; i < 2; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.21 - i * 0.04, 0.21 - i * 0.04, 0.04, 28), mat(COL.plate, 0.7)); c.position.y = i * 0.045; pl.add(c); } add(pl, {kind: 'lmplate'});
  }
  if (eq === 'cable' || eq === 'rope' || eq === 'cable1') {
    if (!pulleys.length) { const t = prop(['tower', spec.tower || {}]); R.props.add(t); pulleys.push(t.userData.pulley); }
    const sides = eq === 'cable1' ? (spec.one ? [spec.one] : ['L', 'R']) : ['M'];
    sides.forEach((side, i) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({color: 0x2a3142})); R.scene.add(line);
      R.cables.push({line, side, from: pulleys[Math.min(i, pulleys.length - 1)]});
    });
    if (eq !== 'cable1') { const h = new THREE.Mesh(new THREE.CylinderGeometry(eq === 'rope' ? 0.02 : 0.013, eq === 'rope' ? 0.02 : 0.013, eq === 'rope' ? 0.22 : (spec.handle || 0.5), 8), eq === 'rope' ? mat(0x3A4256, 0.9) : metal()); h.rotation.z = Math.PI / 2; const g2 = new THREE.Group(); g2.add(h); add(g2, {kind: 'handle', align: true}); }
    else for (const s of sides) add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), metal()), {kind: 'grip', side: s});
  }
  if (spec.roller) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 16), mat(COL.pad, 0.8)); r.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(r); add(g, {kind: 'roller', at: spec.roller.at ?? 0.36, z: spec.roller.z ?? 0.07, side: spec.roller.side}); }
  for (const pd of spec.pads || []) { const b = box(pd.w, pd.h, pd.d, COL.pad, 0, 0, 0); const g = new THREE.Group(); g.add(b); add(g, {kind: 'pad', frame: pd.frame || 'chest', v: pd.v, rx: pd.rx}); }
  if (muscles) setMuscles(R.F, muscles);
}

/**
 * Mounts the animated figure into a container element.
 * @param spec pose spec from poses3d.js; muscles {key: 1 | 0.5}
 */
export function mount3d(el, spec, muscles, {reduced = false, onPhase = null} = {}) {
  ensure();
  if (R.el && R.el !== el && R.renderer.domElement.parentNode) R.renderer.domElement.remove();
  R.el = el; R.onPhase = onPhase; R.t = 0; R.last = 0; R.yaw = 0; R.hold = -1; R.reduced = reduced;
  el.appendChild(R.renderer.domElement);
  R.renderer.domElement.className = 'gl3d';
  setup(spec, muscles);
  R.box = fitBox(); pose(0); draw();
  if (!R.raf) R.raf = requestAnimationFrame(loop);
  // drag to turn the figure
  const c = R.renderer.domElement;
  c.onpointerdown = e => { R.drag = {x: e.clientX, yaw: R.yaw}; c.setPointerCapture(e.pointerId); };
  c.onpointermove = e => { if (R.drag) R.yaw = R.drag.yaw + (e.clientX - R.drag.x) * 0.6; };
  c.onpointerup = c.onpointercancel = () => { R.drag = null; };
}
/** Holds a position (0 = start, 1 = end) or resumes the animation (-1). */
export function hold3d(k) { if (R) { R.hold = k; } }
export function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

/** Solves one frame without a renderer (tests and tools): reach error, joints and hands in world space. */
export function solve3d(spec, k) {
  if (!R || R.spec !== spec) setup(spec, null);
  pose(k);
  const {J} = R.F; const w = o => wpos(o).toArray();
  const joints = {}; for (const n of Object.keys(J)) joints[n] = w(J[n]);
  const floor = (() => { const b = new THREE.Box3(); R.F.root.updateMatrixWorld(true); b.setFromObject(R.F.root, true); return b.min.y; })();
  return {err: R.err, joints, hands: [handPos(R.F, 'L').toArray(), handPos(R.F, 'R').toArray()], minY: floor,
    elbow: ['L', 'R'].map(L => -J['el' + L].rotation.x / D), knee: ['L', 'R'].map(L => J['kn' + L].rotation.x / D)};
}
export const _R = () => R; // debugging aid for tools/tests
