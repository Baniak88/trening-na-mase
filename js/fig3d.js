/* 3D exercise figure: a smooth mannequin built from primitives (no external models), posed by joint angles,
 * with muscle groups coloured by how much they work. One WebGL renderer is shared and moved between containers.
 * Pose data lives in js/data/poses3d.js. */
import * as THREE from './vendor/three.module.min.js';

const D = Math.PI / 180;
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
  const chest = joint('chest', spine, 0, 0.2, 0);
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
    add(sh, limbGeo(0.29, 0.058, 0.045, 0.06), skin, REG.upper);
    add(sh, sphere(0.036, 1, 2.1, 0.62), skin, 'biceps', COL.body, 0, -0.15, 0.03);
    add(sh, sphere(0.038, 1, 2.2, 0.6), skin, 'triceps', COL.body, 0, -0.13, -0.03);
    const el = joint('el' + L, sh, 0, -0.29, 0);
    add(el, limbGeo(0.26, 0.047, 0.032, 0.1), skin, REG.fore);
    const hand = joint('hand' + L, el, 0, -0.27, 0);
    add(hand, sphere(0.036, 0.75, 1.25, 1.0), skin, null, COL.body, 0, -0.035, 0.005);
  }
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const hp = joint('hp' + L, pelvis, s * 0.088, -0.05, 0);
    add(hp, limbGeo(0.16, 0.09, 0.083, 0), cloth, REG.hips, COL.shorts);
    add(hp, limbGeo(0.44, 0.08, 0.052, 0.06), skin, REG.thigh);
    add(hp, sphere(0.06, 1.1, 2.7, 0.5), skin, 'quads', COL.body, 0, -0.24, 0.042);
    add(hp, sphere(0.055, 1.05, 2.6, 0.45), skin, 'hams', COL.body, 0, -0.24, -0.045);
    const kn = joint('kn' + L, hp, 0, -0.44, 0);
    add(kn, limbGeo(0.43, 0.05, 0.034, 0.06), skin, REG.shin);
    add(kn, sphere(0.042, 1.05, 2.2, 0.62), skin, 'calves', COL.body, 0, -0.12, -0.03);
    const an = joint('an' + L, kn, 0, -0.43, 0);
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
  } else if (t === 'rails') { // smith machine or hack squat rails beside the figure
    for (const s of [1, -1]) g.add(box(0.05, 2.1, 0.05, COL.frame, s * (a.w || 0.75), 1.05, a.z || -0.05));
  }
  return g;
}

/* ---------- Pose ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const DEF = {root: [0, 0.95, 0, 0, 0], tilt: 0, sp: 0, ch: 0, nk: 0, hd: 0, sf: 0, sa: 8, sr: 0, el: 8, wr: 0, hf: 0, ha: 4, kn: 0, an: 0};
function mix(A, B, t) {
  const o = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const dflt = k === 'ch' ? undefined : DEF[k];
    const a = A[k] ?? (k === 'ch' ? (A.sp || 0) * 0.6 : dflt) ?? B[k], b = B[k] ?? (k === 'ch' ? (B.sp || 0) * 0.6 : dflt) ?? A[k];
    if (Array.isArray(a) || Array.isArray(b)) { const aa = Array.isArray(a) ? a : [a, a], bb = Array.isArray(b) ? b : [b, b]; o[k] = aa.map((v, i) => lerp(v, bb[i] ?? v, t)); }
    else o[k] = typeof a === 'number' ? lerp(a, b, t) : t < 0.5 ? a : b;
  }
  return o;
}
/** Applies joint angles (degrees). sh/el/hp/kn/an take [left, right] or one number for both. */
function apply(F, p) {
  const J = F.J; const two = v => (Array.isArray(v) ? v : [v, v]);
  const r = p.root || [0, 0.95, 0, 0, 0]; // [x, y, z, pitch, yaw]
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
const _v = new THREE.Vector3(), _b = new THREE.Box3();
/** Lowest point of the feet in world space. */
function footFloor(F) {
  let min = Infinity;
  F.root.updateMatrixWorld(true);
  F.root.traverse(o => { if (o.userData.foot) { _b.setFromObject(o); min = Math.min(min, _b.min.y); } });
  return min;
}
const handPos = (F, L) => F.J['hand' + L].localToWorld(_v.set(0, -0.04, 0.01)).clone();

/* ---------- Scene and player ---------- */
let R = null; // shared renderer state
function ensure() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d98ad, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.2, 4, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 12}); key.shadow.radius = 4; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd3ff, 0.9); rim.position.set(-3, 2.5, -2.5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.ShadowMaterial({opacity: 0.16})); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 30);
  const F = buildFigure(); scene.add(F.root);
  R = {renderer, scene, camera, F, props: new THREE.Group(), tools: new THREE.Group(), cables: [], spec: null, t: 0, last: 0, raf: 0, el: null, yaw: 0, drag: null, hold: -1};
  scene.add(R.props, R.tools);
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

/** Tempo: hold A, move to B (concentric), hold B, return (eccentric, slower). */
const TL = [[0, 0, 600], [0, 1, 1300], [1, 1, 500], [1, 0, 1900]];
const easeIO = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
function phaseK(t) {
  const tot = TL.reduce((a, p) => a + p[2], 0); t %= tot;
  for (const [a, b, d] of TL) { if (t < d) return a + (b - a) * easeIO(t / d); t -= d; }
  return 0;
}

function pose(k) {
  const {F, spec} = R;
  const p = mix(spec.A, spec.B, k);
  apply(F, p);
  if (spec.hands) { // hands fixed on a bar or the floor: move the whole body so they land there
    F.root.updateMatrixWorld(true); const m = handPos(F, 'L').add(handPos(F, 'R')).multiplyScalar(0.5);
    F.root.position.add(new THREE.Vector3(...spec.hands).sub(m)); F.root.updateMatrixWorld(true);
  } else if (spec.ground !== false) { const f = footFloor(F); F.root.position.y -= f; F.root.updateMatrixWorld(true); }
  // tools follow the hands
  const hl = handPos(F, 'L'), hr = handPos(F, 'R');
  R.tools.children.forEach(o => {
    if (o.userData.kind === 'bar') { o.position.copy(hl).add(hr).multiplyScalar(0.5); o.lookAt(o.position.clone().add(hl.clone().sub(hr))); o.rotateY(-Math.PI / 2); }
    else if (o.userData.kind === 'db') { o.position.copy(o.userData.side === 'L' ? hl : hr); const fw = F.J['hand' + o.userData.side]; fw.getWorldQuaternion(o.quaternion); if (o.userData.neutral) o.rotateY(Math.PI / 2); }
    else if (o.userData.kind === 'handle') { o.position.copy(hl).add(hr).multiplyScalar(0.5); if (o.userData.align) { o.lookAt(o.position.clone().add(hl.clone().sub(hr))); o.rotateY(-Math.PI / 2); } }
    else if (o.userData.kind === 'one') { o.position.copy(hl).add(hr).multiplyScalar(0.5); F.J.handL.getWorldQuaternion(o.quaternion); o.rotateX(Math.PI / 2); }
    else if (o.userData.kind === 'grip') { o.position.copy(o.userData.side === 'L' ? hl : hr); }
    else if (o.userData.kind === 'sled') { const fl = F.J.anL.localToWorld(new THREE.Vector3(0, -0.03, 0.06)), fr = F.J.anR.localToWorld(new THREE.Vector3(0, -0.03, 0.06)); o.position.copy(fl).add(fr).multiplyScalar(0.5); }
  });
  for (const c of R.cables) {
    const to = c.side === 'L' ? hl : c.side === 'R' ? hr : hl.clone().add(hr).multiplyScalar(0.5);
    const pos = c.line.geometry.attributes.position; pos.setXYZ(0, c.from.x, c.from.y, c.from.z); pos.setXYZ(1, to.x, to.y, to.z); pos.needsUpdate = true;
  }
}

/** Box around the figure, its props and tools over the whole movement. */
function fitBox() {
  const box = new THREE.Box3();
  for (const k of [0, 0.5, 1]) { pose(k); R.scene.updateMatrixWorld(true); box.expandByObject(R.F.root); box.expandByObject(R.tools); }
  box.expandByObject(R.props);
  return box;
}
function frameCamera() {
  const {camera, spec} = R;
  const v = spec.view || [35, 12];
  const yaw = (v[0] + R.yaw) * D, pitch = v[1] * D;
  const b = R.box, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  const half = Math.tan(camera.fov * D / 2);
  const rad = Math.max(sz.y / 2 / half, Math.hypot(sz.x, sz.z) / 2 / (half * camera.aspect)) * 0.92 + Math.hypot(sz.x, sz.z) / 2;
  const dist = (spec.dist || 1) * Math.max(2.4, rad);
  const tgt = c;
  camera.position.set(tgt.x + dist * Math.sin(yaw) * Math.cos(pitch), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(tgt);
}

function draw() {
  if (!R || !R.el) return;
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
  const k = R.hold >= 0 ? R.hold : R.reduced ? 1 : phaseK(R.t);
  pose(k); draw(); if (R.onPhase) R.onPhase(k);
  R.raf = requestAnimationFrame(loop);
}

/**
 * Mounts the animated figure into a container element.
 * @param spec pose spec from poses3d.js; muscles {key: 1 | 0.5}
 */
export function mount3d(el, spec, muscles, {reduced = false, onPhase = null} = {}) {
  ensure();
  if (R.el && R.el !== el && R.renderer.domElement.parentNode) R.renderer.domElement.remove();
  R.el = el; R.spec = spec; R.onPhase = onPhase; R.t = 0; R.last = 0; R.yaw = 0; R.hold = -1; R.reduced = reduced;
  el.appendChild(R.renderer.domElement);
  R.renderer.domElement.className = 'gl3d';
  clear(R.props); clear(R.tools); for (const c of R.cables) R.scene.remove(c.line); R.cables = [];
  const pulleys = [];
  for (const p of spec.props || []) { const g = prop(p); R.props.add(g); if (g.userData.pulley) pulleys.push(g.userData.pulley); }
  const eq = spec.eq || 'none';
  const metal = () => mat(COL.metal, 0.4);
  if (eq === 'bar') { const b = barbell(spec.barLen || 1.9, spec.plate || 0.22); b.userData.kind = 'bar'; R.tools.add(b); }
  if (eq === 'db' || eq === 'dbn') for (const s of spec.one ? ['L'] : ['L', 'R']) { const d = dumbbell(); d.userData = {kind: 'db', side: s, neutral: eq === 'dbn'}; R.tools.add(d); }
  if (eq === 'db1') { const d = dumbbell(); d.userData.kind = 'one'; R.tools.add(d); }
  if (eq === 'grip') for (const s of ['L', 'R']) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10), metal()); h.userData = {kind: 'grip', side: s}; R.tools.add(h); }
  if (eq === 'sled') { const pl = box(0.6, 0.05, 0.45, COL.frame, 0, 0, 0); pl.rotation.x = (spec.sledTilt ?? 45) * D; pl.userData.kind = 'sled'; R.tools.add(pl); }
  if (eq === 'cable' || eq === 'rope' || eq === 'cable1' || eq === 'cable2') {
    if (!pulleys.length) { const t = prop(['tower', spec.tower || {}]); R.props.add(t); pulleys.push(t.userData.pulley); }
    const sides = eq === 'cable2' ? ['L', 'R'] : eq === 'cable1' ? ['L'] : ['M'];
    sides.forEach((side, i) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({color: 0x2a3142})); R.scene.add(line);
      R.cables.push({line, side, from: pulleys[Math.min(i, pulleys.length - 1)]});
    });
    if (eq === 'cable' || eq === 'rope') { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, eq === 'rope' ? 0.2 : (spec.handle || 0.5), 8), metal()); h.rotation.z = Math.PI / 2; h.userData = {kind: 'handle', align: eq === 'cable'}; const g2 = new THREE.Group(); g2.add(h); g2.userData = h.userData; R.tools.add(g2); }
    if (eq === 'cable1' || eq === 'cable2') for (const s of sides) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), metal()); h.userData = {kind: 'grip', side: s}; R.tools.add(h); }
  }
  setMuscles(R.F, muscles);
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
