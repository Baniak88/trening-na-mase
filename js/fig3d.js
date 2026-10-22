/* 3D exercise figure: a smooth mannequin built from primitives (no external models), posed by joint angles,
 * with muscle groups coloured by how much they work. One WebGL renderer is shared and moved between containers.
 * Pose data lives in js/data/poses3d.js. */
import * as THREE from './vendor/three.module.min.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';

const D = Math.PI / 180;
/* Segment lengths (m): upper arm, forearm to wrist, wrist to grip centre; thigh, shin. */
const ARM = {a: 0.254, f: 0.262, b: 0.34}; // upper arm, forearm, forearm + grip (set from body.bin)
const LEG = {a: 0.433, b: 0.448};
const ANKLE = {y: 0.072}; // ankle height with the foot flat on the floor
const COL = {body: 0xCBD5E3, shorts: 0x2C3346, shoe: 0x2C3346, hair: 0x3A3F4C, p: 0xFF6A3D, s: 0xFFB08F,
  metal: 0x8C96A8, plate: 0x2F3544, pad: 0x3A4256, frame: 0x6B7487, cable: 0x55607A};

/* ---------- Helpers ---------- */
const mat = (c, rough = 0.62) => new THREE.MeshStandardMaterial({color: c, roughness: rough, metalness: 0.05});

/* ---------- Body ----------
 * A rigged human (MakeHuman, CC0) loaded from js/data/body.bin, built by tools/human/build_body.py.
 * The figure's joints (J) are plain groups that the IK and FK below rotate; the skinned mesh follows them. */
const MUSCLE_KEYS = ['chest', 'back', 'delts', 'biceps', 'triceps', 'forearms', 'abs', 'glutes', 'quads', 'hams', 'calves'];
let BODY = null;
/** Parses body.bin (see the FORMAT notes in tools/human/build_body.py). */
export function setBody(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  if (String.fromCharCode(...u8.subarray(0, 4)) !== 'TNMB') throw new Error('body.bin');
  const ml = dv.getUint32(4, true); const meta = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + ml)));
  let o = 8 + ml; const n = meta.n, t = meta.t;
  const take = (Type, count) => { const a = new Type(buf.slice(o, o + count * Type.BYTES_PER_ELEMENT)); o += count * Type.BYTES_PER_ELEMENT; return a; };
  const q = take(Uint16Array, n * 3); const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = meta.lo[i % 3] + q[i] * meta.q[i % 3];
  const idx = take(Uint16Array, t * 3); if ((t * 3 * 2) % 4) o += 2;
  const si = take(Uint8Array, n * 4), sw = take(Uint8Array, n * 4), mus = take(Uint8Array, n * 4), cls = take(Uint8Array, n), cloth = take(Uint8Array, n);
  BODY = {meta, pos, idx, si, sw, mus, cls, cloth};
  const L = meta.len;
  ARM.a = L.armA; ARM.f = L.armF; LEG.a = L.thigh; LEG.b = L.shin; ANKLE.y = L.ankle;
  GRIP.L.fromArray(meta.gripL); GRIP.R.fromArray(meta.gripR); FOOT_BALL.fromArray(meta.ball);
  ARM.b = ARM.f + GRIP.L.length();
  return BODY;
}
let _loading = null;
/** Loads the body once (the app calls this before mounting). */
export function loadBody(url = new URL('./data/body.bin', import.meta.url)) {
  if (BODY) return Promise.resolve(BODY);
  return _loading || (_loading = fetch(url).then(r => { if (!r.ok) throw new Error('body ' + r.status); return r.arrayBuffer(); }).then(setBody));
}

const PARENT = {pelvis: 'root', spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck'};
for (const s of ['L', 'R']) Object.assign(PARENT, {['sh' + s]: 'chest', ['el' + s]: 'sh' + s, ['hand' + s]: 'el' + s, ['hp' + s]: 'pelvis', ['kn' + s]: 'hp' + s, ['an' + s]: 'kn' + s});

export function buildFigure() {
  const B = BODY, M = B.meta, jp = M.joints, J = {};
  J.root = new THREE.Group();
  const wpos = n => (n === 'root' ? jp.pelvis : jp[n]);
  for (const n of Object.keys(PARENT)) { // insertion order puts parents first
    const g = new THREE.Group(); const a = wpos(n), b = wpos(PARENT[n]);
    g.position.set(a[0] - b[0], a[1] - b[1], a[2] - b[2]); J[PARENT[n]].add(g); J[n] = g;
  }
  for (const s of ['L', 'R']) { // finger pivots: knuckles, then the middle joints
    const fa = new THREE.Group(); fa.position.fromArray(M['fa' + s]); J['hand' + s].add(fa); J['fa' + s] = fa;
    const fb = new THREE.Group(); fb.position.fromArray(M['fb' + s]).sub(fa.position); fa.add(fb); J['fb' + s] = fb;
  }
  const bones = [], inv = [];
  for (const b of M.bones) {
    const bone = new THREE.Bone(); bone.quaternion.fromArray(b.q); bone.name = b.name;
    (J[b.name.startsWith('fa') || b.name.startsWith('fb') ? b.name : b.joint]).add(bone);
    bones.push(bone); inv.push(new THREE.Matrix4().makeTranslation(-b.bind[0], -b.bind[1], -b.bind[2]));
    if (b.name.startsWith('el2')) J['tw' + b.name.slice(3)] = Object.assign(bone, {q0: bone.quaternion.clone()});
  }
  // trainers over the feet: a rounded upper and a light sole
  for (const s of ['L', 'R']) {
    const up = new THREE.SphereGeometry(1, 28, 18); const p = up.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i) * 0.047, y = p.getY(i) * 0.052, z = p.getZ(i) * 0.148; if (z > 0.05) y *= 1 - (z - 0.05) * 2.6; y = Math.max(y, -0.036); p.setXYZ(i, x, y - 0.03, z + 0.07); }
    up.computeVertexNormals();
    const shoe = new THREE.Mesh(up, mat(COL.shoe, 0.7)); shoe.castShadow = true;
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.018, 28), mat(0xE4E8EF, 0.8)); sole.scale.set(0.05, 1, 0.152); sole.position.set(0, -0.062, 0.07); sole.castShadow = true;
    shoe.rotation.y = s === 'L' ? 0.06 : -0.06; sole.rotation.y = shoe.rotation.y;
    J['an' + s].add(shoe, sole);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.pos, 3));
  g.setIndex(new THREE.BufferAttribute(B.idx, 1));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(B.si), 4));
  const w = new Float32Array(B.sw.length); for (let i = 0; i < w.length; i++) w[i] = B.sw[i] / 255;
  g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(M.n * 3), 3));
  g.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.62, metalness: 0.02}));
  mesh.castShadow = true; mesh.frustumCulled = false;
  J.root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
  // trunk vertices sampled for "lying on the floor" checks
  const trunk = []; const tb = new Set(M.bones.map((b, i) => (['pelvis', 'spine', 'chest', 'neck', 'head'].includes(b.name) ? i : -1)).filter(i => i >= 0));
  for (let i = 0; i < M.n; i += 5) if (tb.has(B.si[i * 4]) && B.sw[i * 4] > 160) trunk.push(i);
  return {root: J.root, J, mesh, trunk};
}

/* ---------- Equipment ----------
 * Gym kit built from rounded boxes, tubes and lathe profiles with shared PBR materials (lit by the studio environment). */
const MT = {};
function mats() {
  if (MT.pad) return MT;
  MT.pad = new THREE.MeshPhysicalMaterial({color: 0x262C3B, roughness: 0.58, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x5B6A8A), clearcoat: 0.15, clearcoatRoughness: 0.6});
  MT.steel = new THREE.MeshStandardMaterial({color: 0x454D5E, roughness: 0.34, metalness: 0.75});
  MT.chrome = new THREE.MeshStandardMaterial({color: 0xE2E7EF, roughness: 0.14, metalness: 1});
  MT.knurl = new THREE.MeshStandardMaterial({color: 0xB9C0CC, roughness: 0.45, metalness: 1});
  MT.rubber = new THREE.MeshStandardMaterial({color: 0x1A1E26, roughness: 0.82, metalness: 0});
  MT.plate = new THREE.MeshStandardMaterial({color: 0x1F232C, roughness: 0.5, metalness: 0.2});
  MT.stack = new THREE.MeshStandardMaterial({color: 0x2E3442, roughness: 0.4, metalness: 0.6});
  MT.accent = new THREE.MeshStandardMaterial({color: COL.p, roughness: 0.45, metalness: 0.1});
  MT.foam = new THREE.MeshStandardMaterial({color: 0x252A36, roughness: 0.9});
  MT.wood = new THREE.MeshStandardMaterial({color: 0xB08A62, roughness: 0.7});
  return MT;
}
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
/** Rounded box centred at (x, y, z). */
const rbox = (w, h, d, m, x = 0, y = 0, z = 0, r = 0.02) => { const o = shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), m)); o.position.set(x, y, z); return o; };
/** Round tube between two points. */
function tube(a, b, r, m, seg = 14) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const dir = B.clone().sub(A); const len = dir.length();
  const o = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m)); o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return o;
}
/** Bumper plate: rubber disc with a lip and a steel hub, axis along x. */
function plateMesh(r, t) {
  const m = mats(); const g = new THREE.Group();
  const prof = [[0.03, -t / 2], [r - 0.012, -t / 2], [r, -t / 2 + 0.01], [r, t / 2 - 0.01], [r - 0.012, t / 2], [r * 0.82, t / 2], [r * 0.8, t / 2 - 0.006], [0.07, t / 2 - 0.006], [0.03, t / 2]].map(([x, y]) => new THREE.Vector2(x, y));
  const disc = shade(new THREE.Mesh(new THREE.LatheGeometry(prof.reverse(), 40), m.plate)); disc.rotation.z = Math.PI / 2; g.add(disc);
  const hub = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, t + 0.004, 24), m.chrome)); hub.rotation.z = Math.PI / 2; g.add(hub);
  return g;
}
function barbell(len = 1.9, pr = 0.22) {
  const m = mats(); const g = new THREE.Group(); const h = len / 2;
  const shaft = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, len - 0.8, 16), m.knurl)); shaft.rotation.z = Math.PI / 2; g.add(shaft);
  for (const s of [1, -1]) {
    const sl = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 20), m.chrome)); sl.rotation.z = Math.PI / 2; sl.position.x = s * (h - 0.2); g.add(sl);
    const col = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.035, 20), m.chrome)); col.rotation.z = Math.PI / 2; col.position.x = s * (h - 0.4); g.add(col);
    const t1 = pr > 0.18 ? 0.055 : 0.04; const p1 = plateMesh(pr, t1); p1.position.x = s * (h - 0.4 + 0.02 + t1 / 2); g.add(p1);
    const p2 = plateMesh(pr * 0.78, 0.035); p2.position.x = s * (h - 0.4 + 0.025 + t1 + 0.02); g.add(p2);
    const clip = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 16), m.accent)); clip.rotation.z = Math.PI / 2; clip.position.x = s * (h - 0.4 + 0.05 + t1 + 0.035); g.add(clip);
  }
  return g;
}
function dumbbell() {
  const m = mats(); const g = new THREE.Group();
  const hd = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.15, 16), m.knurl)); hd.rotation.z = Math.PI / 2; g.add(hd);
  for (const s of [1, -1]) {
    const head = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.072, 6), m.rubber)); head.rotation.z = Math.PI / 2; head.rotation.x = Math.PI / 6; head.position.x = s * 0.111; g.add(head);
    const cap = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.074, 20), m.chrome)); cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.111; g.add(cap);
    const ring = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), m.chrome)); ring.rotation.z = Math.PI / 2; ring.position.x = s * 0.07; g.add(ring);
  }
  return g;
}
/** Floor-standing frame foot: a short crossbar with rubber caps. */
function foot(g, x, z, w, m) { g.add(rbox(w, 0.045, 0.07, m.steel, x, 0.0225, z, 0.012)); for (const s of [1, -1]) g.add(rbox(0.05, 0.02, 0.075, m.rubber, x + s * (w / 2 - 0.02), 0.01, z, 0.008)); }
/** Static props. Each is [type, params]; positions in metres, the figure stands at the origin facing +z. */
function prop(p) {
  const m = mats(); const g = new THREE.Group();
  const [t, a = {}] = p;
  if (t === 'bench') { // flat bench: cushion on a spine with two T-feet
    const len = a.len || 1.2, y = a.y || 0.44, z = a.z || 0, x = a.x || 0;
    g.add(rbox(0.29, 0.075, len, m.pad, x, y, z, 0.03));
    g.add(rbox(0.07, 0.05, len * 0.86, m.steel, x, y - 0.065, z, 0.01));
    for (const zz of [z - len * 0.38, z + len * 0.38]) { g.add(rbox(0.06, y - 0.09, 0.05, m.steel, x, (y - 0.09) / 2 + 0.02, zz, 0.01)); foot(g, x, zz, 0.46, m); }
  } else if (t === 'incline') { // adjustable bench: seat, back pad hinged behind it, strut and ladder
    const inc = (a.inc || 40) * D, y = a.y || 0.45, len = a.len || 0.95, z0 = a.z || 0;
    g.add(rbox(0.31, 0.075, 0.36, m.pad, 0, y, z0 + 0.12, 0.03));
    const back = rbox(0.29, 0.075, len, m.pad, 0, y + Math.sin(inc) * len / 2 + 0.02, z0 - Math.cos(inc) * len / 2, 0.03); back.rotation.x = inc; g.add(back);
    const ub = [0, y - 0.03 + Math.sin(inc) * len * 0.45, z0 - Math.cos(inc) * len * 0.45 + 0.03]; // under the back pad
    g.add(tube([0, 0.08, z0 + 0.32], [0, 0.08, z0 - 0.62], 0.028, m.steel));
    g.add(tube([0, 0.08, z0 + 0.15], [0, y - 0.05, z0 + 0.12], 0.026, m.steel));
    g.add(tube([0, 0.08, z0 - 0.45], ub, 0.022, m.steel));
    g.add(tube([0, y - 0.05, z0 + 0.0], [0, y - 0.05, z0 + 0.25], 0.024, m.steel));
    foot(g, 0, z0 + 0.32, 0.5, m); foot(g, 0, z0 - 0.62, 0.5, m);
  } else if (t === 'seat') { // machine seat on a post, upright back pad on its own post
    const y = a.y || 0.5, z = a.z || 0;
    g.add(rbox(0.38, 0.085, 0.4, m.pad, 0, y, z + 0.06, 0.035));
    g.add(rbox(0.07, y - 0.08, 0.07, m.steel, 0, (y - 0.08) / 2 + 0.03, z, 0.012));
    g.add(rbox(0.56, 0.04, 0.6, m.steel, 0, 0.02, z - 0.05, 0.012));
    if (a.back !== false) {
      const bh = a.backH || 0.6, bz = z - 0.2 - (a.backTilt || 0);
      g.add(rbox(0.38, bh, 0.085, m.pad, 0, y + 0.06 + bh / 2, bz, 0.035));
      g.add(rbox(0.06, y + bh * 0.6, 0.06, m.steel, 0, (y + bh * 0.6) / 2, bz - 0.08, 0.01));
      g.add(rbox(0.06, 0.05, 0.12, m.steel, 0, y + bh * 0.55, bz - 0.04, 0.01));
    }
  } else if (t === 'box') { // plyo box / step
    const h = a.h || 0.4; g.add(rbox(a.w || 0.4, h, a.d || 0.4, a.c ? new THREE.MeshStandardMaterial({color: a.c, roughness: 0.7}) : m.rubber, a.x || 0, a.y ?? h / 2, a.z || 0, 0.02));
  } else if (t === 'bar') { // pull-up station
    const y = a.y || 2.3, z = a.z || 0;
    g.add(tube([-0.72, y, z], [0.72, y, z], 0.016, m.knurl, 18));
    for (const s of [1, -1]) { g.add(rbox(0.07, y + 0.08, 0.07, m.steel, s * 0.72, (y + 0.08) / 2, z - 0.05, 0.012)); foot(g, s * 0.72, z - 0.05, 0.12, m); g.add(rbox(0.07, 0.045, 0.9, m.steel, s * 0.72, 0.0225, z - 0.05, 0.012)); }
    g.add(rbox(1.5, 0.07, 0.07, m.steel, 0, y + 0.1, z - 0.05, 0.012));
  } else if (t === 'pbars') { // dip station
    const y = a.y || 1.2, w = a.w || 0.28, z = a.z || 0.1;
    for (const s of [1, -1]) {
      g.add(tube([s * w, y, z - 0.42], [s * w, y, z + 0.42], 0.022, m.knurl, 18));
      for (const zz of [z - 0.36, z + 0.36]) g.add(rbox(0.06, y, 0.06, m.steel, s * w, y / 2, zz, 0.01));
      g.add(rbox(0.07, 0.045, 0.95, m.steel, s * w, 0.0225, z, 0.012));
    }
    g.add(rbox(w * 2 + 0.06, 0.05, 0.06, m.steel, 0, 0.32, z - 0.36, 0.01));
  } else if (t === 'tower') { // cable column: two uprights, weight stack on guide rods, pulley at (x, y, z)
    const x = a.x || 0, z = a.z ?? -0.8, y = a.y || 2.1, bz = z + (a.back ?? -0.1);
    for (const s of [1, -1]) g.add(rbox(0.07, 2.25, 0.07, m.steel, x + s * 0.2, 1.125, bz, 0.012));
    g.add(rbox(0.47, 0.07, 0.1, m.steel, x, 2.25, bz, 0.012)); g.add(rbox(0.6, 0.05, 0.5, m.steel, x, 0.025, bz, 0.012));
    for (let i = 0; i < 12; i++) g.add(rbox(0.28, 0.034, 0.12, i === 11 ? m.accent : m.stack, x, 0.1 + i * 0.037, bz, 0.006));
    for (const s of [1, -1]) g.add(tube([x + s * 0.1, 0.05, bz], [x + s * 0.1, 1.6, bz], 0.008, m.chrome, 8));
    const wheel = shade(new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 10, 28), m.steel)); wheel.rotation.y = Math.PI / 2; wheel.position.set(x, y, z); g.add(wheel);
    const hub = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 14), m.chrome)); hub.rotation.z = Math.PI / 2; hub.position.set(x, y, z); g.add(hub);
    if (Math.abs(z - bz) > 0.05) g.add(tube([x, y, z], [x, y, bz], 0.018, m.steel));
    g.userData.pulley = new THREE.Vector3(x, y, z);
  } else if (t === 'pad') { // free pad, optionally tilted
    const b = rbox(a.w || 0.3, a.h || 0.08, a.d || 0.4, a.c ? new THREE.MeshStandardMaterial({color: a.c, roughness: 0.7}) : m.pad, a.x || 0, a.y || 0.5, a.z || 0, 0.025); b.rotation.x = (a.rx || 0) * D; g.add(b);
  } else if (t === 'plate') { // platform (hack squat, footplate)
    const b = rbox(a.w || 0.6, a.h || 0.05, a.d || 0.45, m.steel, a.x || 0, a.y || 0.03, a.z || 0, 0.012); b.rotation.x = (a.rx || 0) * D; g.add(b);
    const top = rbox((a.w || 0.6) - 0.04, 0.012, (a.d || 0.45) - 0.04, m.rubber, 0, (a.h || 0.05) / 2, 0, 0.004); b.add(top);
  } else if (t === 'rails') { // Smith machine / hack rails
    const w = a.w || 0.75, z = a.z || -0.05;
    for (const s of [1, -1]) { g.add(rbox(0.07, 2.2, 0.07, m.steel, s * w, 1.1, z, 0.012)); g.add(tube([s * (w - 0.06), 0.1, z + 0.05], [s * (w - 0.06), 2.05, z + 0.05], 0.012, m.chrome, 10)); g.add(rbox(0.08, 0.045, 0.8, m.steel, s * w, 0.0225, z, 0.012)); }
    g.add(rbox(w * 2 + 0.07, 0.07, 0.07, m.steel, 0, 2.2, z, 0.012));
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
    J['hand' + L].rotation.set((p.wr || 0) * D, J['hand' + L].rotation.y, 0);
    const hp = J['hp' + L]; hp.rotation.order = 'ZXY'; hp.rotation.set(-hf[i] * D, 0, s * ha[i] * D);
    J['kn' + L].rotation.set(kn[i] * D, 0, 0);
    J['an' + L].rotation.set(-an[i] * D, 0, 0);
  });
}

/* ---------- IK ---------- */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m4 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _e = new THREE.Euler();
const AX = {x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1)};
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
const FOOT_BALL = V3(0.01, -0.068, 0.139); // ball of the foot in ankle space
const GRIP = {L: V3(-0.035, -0.067, 0), R: V3(0.035, -0.067, 0)}; // grip point in hand space
const footQ = (yaw, pitch) => new THREE.Quaternion().setFromEuler(_e.set(pitch * D, yaw * D, 0, 'YXZ'));
const handPos = (F, L) => F.J['hand' + L].localToWorld(GRIP[L].clone());
const SIDES = [['L', 1, 0], ['R', -1, 1]];
const pick = (v, i) => (isPair(v) ? v[i] : v);
const num = (v, i, d) => { const x = Array.isArray(v) ? v[i] : v; return x == null ? d : x; };

/* ---------- Scene and player ---------- */
let R = null; // shared state: one figure, one renderer
function stage() {
  if (R) return R;
  const scene = new THREE.Scene();
  const F = buildFigure(); scene.add(F.root, F.mesh);
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d98ad, 0.9));
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; pm.dispose(); } catch (e) { /* no env map, lights only */ }
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
const _sh = new THREE.Color(COL.shorts), _shoe = new THREE.Color(COL.shoe), _eye = new THREE.Color(0xAEB7C6), _hair = new THREE.Color(COL.hair), _k = new THREE.Color();
/** Colours the skin: main muscles orange, assisting ones light, plus shorts, shoes, hair and eyes. m = {key: 1 | 0.5}. */
export function setMuscles(F, m) {
  const {mus, cls, cloth, meta} = BODY; const col = F.mesh.geometry.attributes.color; const base = new THREE.Color(COL.body);
  const lv = meta.muscles.map(k => (m && m[k]) || 0);
  for (let i = 0; i < meta.n; i++) {
    const c = cls[i];
    if (c === 3) { col.setXYZ(i, _eye.r, _eye.g, _eye.b); continue; }
    let best = 0, l = 0;
    for (const o of [0, 2]) { const k = mus[i * 4 + o], w = mus[i * 4 + o + 1] / 255; if (lv[k] && w > best) { best = w; l = lv[k]; } }
    const mc = l >= 1 ? _p : _s;
    _c.copy(base).lerp(mc, best);
    if (c) {
      _k.copy(c === 1 ? _sh : c === 2 ? _shoe : _hair);
      if (c === 1) _k.lerp(mc, best * 0.9);
      _c.lerp(_k, cloth[i] / 255);
    }
    col.setXYZ(i, _c.r, _c.g, _c.b);
  }
  col.needsUpdate = true;
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
    if (key === 'hs') { const r = ARM.a + ARM.b - 0.012; if (p.length() > r) p.setLength(r); return {p: wpos(J['sh' + L]).add(p)}; } // too far = arm straight that way
    return {d: p.normalize(), r: Math.min(num(K.hr, i, 9), ARM.a + ARM.b - 0.015)};
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
/** Palm turn (pr: 90 palm forward / supinated, 0 neutral, -90 pronated) shared by the hand and half the forearm,
 * and the fingers curled round a handle. */
const _ax = new THREE.Vector3(), _q2 = new THREE.Quaternion();
function hands(spec, p) {
  const {J} = R.F; const eq = spec.eq || 'none';
  const pr = p.pr ?? spec.pr ?? (['bar', 'landmine'].includes(eq) || (eq === 'cable' && (spec.handle || 0.5) > 0.3) ? -90 : 0);
  const curl = (spec.curl ?? (eq === 'none' && !spec.props ? 12 : 82)) * D;
  SIDES.forEach(([L, s, i]) => {
    const a = num(pr, i, 0) * D * s; const h = J['hand' + L];
    h.rotation.order = 'YXZ'; h.rotation.y = a;
    const tw = J['tw' + L]; tw.quaternion.copy(_q2.setFromAxisAngle(AX.y, a / 2)).multiply(tw.q0);
    const n = V3().fromArray(BODY.meta['palm' + L]); _ax.crossVectors(V3(0, -1, 0), n).normalize();
    J['fa' + L].quaternion.setFromAxisAngle(_ax, curl * 0.6); J['fb' + L].quaternion.setFromAxisAngle(_ax, curl * 0.8);
  });
}
function solveArms(spec, p, T) {
  const {J, root} = R.F; const ep = p.ep ?? spec.ep ?? [1, -0.6, -0.3]; const cq = wquat(J.chest); let err = 0;
  SIDES.forEach(([L, s, i]) => {
    if (!T[i]) return;
    const e = Array.isArray(ep[0]) ? ep[i] : ep; const pole = V3(s * e[0], e[1], e[2]).applyQuaternion(cq);
    J['hand' + L].rotation.x = (p.wr || 0) * D; J['hand' + L].rotation.z = 0;
    let goal = T[i].clone(), miss = 0;
    for (let it = 0; it < 3; it++) { // the grip sits beside the forearm axis: aim off by the remaining miss
      miss = twoBone(J['sh' + L], J['el' + L], ARM.a, ARM.b, goal, pole, true);
      root.updateMatrixWorld(true); const d = T[i].clone().sub(handPos(R.F, L)); if (d.lengthSq() < 1e-6) break; goal.add(d);
    }
    err = Math.max(err, miss, handPos(R.F, L).distanceTo(T[i]) > 0.03 ? handPos(R.F, L).distanceTo(T[i]) : 0);
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
    const pt = V3(s * num(p.fx, i, f.w ?? 0.14), num(p.fy, i, f.y ?? (num(f.ball, i, false) ? 0.02 : ANKLE.y)), num(p.fz, i, f.z ?? 0));
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
  apply(F, p); hands(spec, p); F.root.updateMatrixWorld(true);
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
  for (const i of F.trunk) { F.mesh.getVertexPosition(i, _tv); if (_tv.y < min) min = _tv.y; }
  return min;
}
const SOLE = [V3(0, -0.07, -0.05), V3(0, -0.068, 0.14), V3(0, -0.06, 0.2)];
/** Lowest point of the soles in world space. */
function footFloor(F) {
  let min = Infinity;
  F.root.updateMatrixWorld(true);
  for (const L of ['L', 'R']) for (const p of SOLE) min = Math.min(min, F.J['an' + L].localToWorld(p.clone()).y);
  return min;
}
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
  for (const k of [0, 0.25, 0.5, 0.75, 1]) { pose(k); R.scene.updateMatrixWorld(true); R.F.mesh.computeBoundingBox(); box.union(R.F.mesh.boundingBox); box.expandByObject(R.tools); for (const L of ['L', 'R']) box.expandByPoint(R.F.J['an' + L].localToWorld(V3(0, -0.07, 0.2))); }
  box.expandByObject(R.props);
  return box;
}
function frameCamera() {
  const {camera, spec} = R;
  const v = spec.view || [35, 12];
  const yaw = (v[0] + R.yaw) * D, pitch = v[1] * D;
  const b = R.box, c = spec.look ? V3(...spec.look) : b.getCenter(V3()), sz = b.getSize(V3());
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
  const m = mats(); const metal = () => m.knurl;
  const add = (o, u) => { o.userData = u; R.tools.add(o); return o; };
  if (eq === 'bar') add(barbell(spec.barLen || 1.9, spec.plate || 0.225), {kind: 'bar'});
  if (eq === 'db') for (const s of spec.one ? [spec.one] : ['L', 'R']) add(dumbbell(), {kind: 'db', side: s});
  if (eq === 'db1') add(dumbbell(), {kind: 'one'});
  if (eq === 'grip') for (const s of spec.one ? [spec.one] : ['L', 'R']) add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 16), metal())), {kind: 'grip', side: s});
  if (eq === 'sled') { const pl = new THREE.Group(); pl.add(rbox(0.62, 0.05, 0.5, m.steel, 0, 0.03, 0, 0.012), rbox(0.58, 0.012, 0.46, m.rubber, 0, 0.002, 0, 0.004)); for (const s of [1, -1]) pl.add(tube([s * 0.22, 0.075, -0.25], [s * 0.22, 0.075, 0.25], 0.022, m.chrome)); pl.rotation.x = (spec.sledTilt ?? 45) * D; const g = new THREE.Group(); g.add(pl); add(g, {kind: 'sled'}); }
  if (eq === 'landmine') {
    const g = new THREE.Group();
    const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 14), m.knurl)); g.add(b); add(g, {kind: 'landmine', pivot: spec.pivot});
    const pl = new THREE.Group(); for (let i = 0; i < 2; i++) { const c = plateMesh(0.21 - i * 0.04, 0.045); c.rotation.z = Math.PI / 2; c.position.y = i * 0.05; pl.add(c); } add(pl, {kind: 'lmplate'});
  }
  if (eq === 'cable' || eq === 'rope' || eq === 'cable1') {
    if (!pulleys.length) { const t = prop(['tower', spec.tower || {}]); R.props.add(t); pulleys.push(t.userData.pulley); }
    const sides = eq === 'cable1' ? (spec.one ? [spec.one] : ['L', 'R']) : ['M'];
    sides.forEach((side, i) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({color: 0x1b202b})); R.scene.add(line);
      R.cables.push({line, side, from: pulleys[Math.min(i, pulleys.length - 1)]});
    });
    if (eq !== 'cable1') { const h = shade(new THREE.Mesh(new THREE.CylinderGeometry(eq === 'rope' ? 0.02 : 0.014, eq === 'rope' ? 0.02 : 0.014, eq === 'rope' ? 0.22 : (spec.handle || 0.5), 14), eq === 'rope' ? m.rubber : metal())); h.rotation.z = Math.PI / 2; const g2 = new THREE.Group(); g2.add(h); add(g2, {kind: 'handle', align: true}); }
    else for (const s of sides) add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 16), metal())), {kind: 'grip', side: s});
  }
  if (spec.roller) { const r = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.33, 6, 20), m.pad)); r.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(r, tube([-0.24, 0, 0], [0.24, 0, 0], 0.012, m.chrome)); add(g, {kind: 'roller', at: spec.roller.at ?? 0.36, z: spec.roller.z ?? 0.07, side: spec.roller.side}); }
  for (const pd of spec.pads || []) { const b = rbox(pd.w, pd.h, pd.d, m.pad, 0, 0, 0, 0.025); const g = new THREE.Group(); g.add(b); add(g, {kind: 'pad', frame: pd.frame || 'chest', v: pd.v, rx: pd.rx}); }
  if (eq === 'sled') sledRails(spec, m);
  if (muscles) setMuscles(R.F, muscles);
}
/** Leg press carriage rails along the sled's travel, behind the footplate. */
function sledRails(spec, m) {
  const {J} = R.F; const mid = () => wpos(J.anL).add(wpos(J.anR)).multiplyScalar(0.5);
  pose(0); const a = mid(); pose(1); const b = mid();
  const t = (spec.sledTilt ?? 45) * D, n = V3(0, Math.cos(t), Math.sin(t)); // the carriage slides along the plate normal
  const ta = a.dot(n), tb = b.dot(n), c = a.clone().addScaledVector(n, -ta);
  const p0 = c.clone().addScaledVector(n, Math.min(ta, tb) + 0.02), p1 = c.clone().addScaledVector(n, Math.max(ta, tb) + 0.55), g = new THREE.Group();
  for (const s of [1, -1]) {
    const x = s * 0.4, q0 = [x, p0.y, p0.z], q1 = [x, p1.y, p1.z];
    g.add(tube(q0, q1, 0.022, m.chrome), tube(q1, [x, 0, p1.z], 0.032, m.steel));
    g.add(rbox(0.07, 0.045, Math.abs(p1.z - p0.z) + 0.25, m.steel, x, 0.0225, (p0.z + p1.z) / 2, 0.012));
    if (p0.y > 0.2) g.add(tube(q0, [x, 0, p0.z], 0.03, m.steel));
  }
  g.add(tube([-0.4, p1.y, p1.z], [0.4, p1.y, p1.z], 0.03, m.steel));
  R.props.add(g);
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
  const floor = (() => { const b = new THREE.Box3(); R.F.root.updateMatrixWorld(true); b.setFromObject(R.F.mesh, true); return b.min.y; })();
  return {err: R.err, joints, hands: [handPos(R.F, 'L').toArray(), handPos(R.F, 'R').toArray()], minY: floor,
    elbow: ['L', 'R'].map(L => -J['el' + L].rotation.x / D), knee: ['L', 'R'].map(L => J['kn' + L].rotation.x / D)};
}
export const _R = () => R; // debugging aid for tools/tests
