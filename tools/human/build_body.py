#!/usr/bin/env python3
"""Builds js/data/body.bin: a rigged human body for the 3D exercise figure.

Source: MakeHuman base mesh, shape targets, default skeleton and weights (CC0 1.0,
https://github.com/makehumancommunity/makehuman, makehuman/data). Usage:

    python3 tools/human/build_body.py <path to makehuman/data> js/data/body.bin

Steps: young muscular male shape -> joints from the helper vertex groups -> MakeHuman bones merged into
the figure's joints (pelvis, spine, chest, neck, head, shoulder, elbow, forearm twist, hand, fingers, hip,
knee, ankle) -> muscle regions painted per vertex -> compact binary (see FORMAT below).

The figure's joints rest with limbs hanging straight down (local -Y), arms bending towards +Z.
Each bone stores a rotation C that turns the MakeHuman rest pose (arms in an A pose) into that rest:
skinned vertex = joint world matrix * C * (v - MakeHuman joint position).
"""
import json, struct, sys
import numpy as np

SRC, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
SCALE = 0.1  # MakeHuman units are decimetres

# ---------- mesh ----------
V, G, faces = [], None, {}
for l in open(SRC + '3dobjs/base.obj'):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('g '): G = l.split()[1]
    elif l.startswith('f '): faces.setdefault(G, []).append([int(p.split('/')[0]) - 1 for p in l.split()[1:]])
V = np.array(V)

def target(name, w):
    for l in open(SRC + 'targets/' + name):
        if l[0] == '#' or not l.strip(): continue
        p = l.split(); V[int(p[0])] += w * np.array([float(x) for x in p[1:4]])

# young male, athletic: muscle 0.8, average weight, ideal proportions
target('macrodetails/caucasian-male-young.target', 1)
target('macrodetails/universal-male-young-averagemuscle-averageweight.target', 0.4)
target('macrodetails/universal-male-young-maxmuscle-averageweight.target', 0.6)
target('macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions.target', 0.4)
target('macrodetails/proportions/male-young-maxmuscle-averageweight-idealproportions.target', 0.6)
target('torso/torso-muscle-pectoral-incr.target', 0.35)
target('torso/torso-muscle-dorsi-incr.target', 0.35)
target('torso/torso-vshape-incr.target', 0.3)
target('stomach/stomach-tone-incr.target', 0.5)

V = V * SCALE
skel = json.load(open(SRC + 'rigs/default.mhskel'))
JP = {k: V[v].mean(0) for k, v in skel['joints'].items()}
head = lambda b: JP[b + '____head']
tail = lambda b: JP[b + '____tail']

keep = ['body', 'helper-l-eye', 'helper-r-eye']
used = sorted({i for g in keep for f in faces[g] for i in f})
floor = V[used, 1].min()
V[:, 1] -= floor
for k in JP: JP[k] = JP[k] - np.array([0, floor, 0])
remap = {o: n for n, o in enumerate(used)}
P = V[used]
N = len(used)
tris = []
for g in keep:
    for f in faces[g]:
        f = [remap[i] for i in f]
        tris.append([f[0], f[1], f[2]])
        if len(f) == 4: tris.append([f[0], f[2], f[3]])
cls = np.zeros(N, np.uint8)
P = P.copy()
for g, c in (('helper-l-eye', 3), ('helper-r-eye', 3)):
    for f in faces[g]:
        for i in f: cls[remap[i]] = c

# ---------- figure joints (world rest, limbs hanging down) ----------
def unit(v): return v / np.linalg.norm(v)
shL, elL, wrL = head('upperarm01.L'), head('lowerarm01.L'), head('wrist.L')
hpL, knL, anL = head('upperleg01.L'), head('lowerleg01.L'), head('foot.L')
A_UP, A_FORE = np.linalg.norm(elL - shL), np.linalg.norm(wrL - elL)
L_THIGH, L_SHIN = np.linalg.norm(knL - hpL), np.linalg.norm(anL - knL)
knuckles = lambda s, j: np.mean([head(f'finger{i}-{j}.{s}') for i in (2, 3, 4, 5)], 0)

hipY, hipZ = hpL[1], hpL[2]
chestY = shL[1] - 0.245
J = {
    'pelvis': [0, hipY + 0.03, hipZ],
    'spine': [0, hipY + 0.11, hipZ + 0.005],
    'chest': [0, chestY, shL[2] - 0.005],
    'neck': [0, head('neck01')[1], head('neck01')[2]],
    'head': [0, head('head')[1], head('head')[2]],
}
for s, sx in (('L', 1), ('R', -1)):
    sh, hp = head(f'upperarm01.{s}'), head(f'upperleg01.{s}')
    J['sh' + s] = sh.tolist(); J['el' + s] = (sh - [0, A_UP, 0]).tolist(); J['hand' + s] = (sh - [0, A_UP + A_FORE, 0]).tolist()
    J['hp' + s] = hp.tolist(); J['kn' + s] = (hp - [0, L_THIGH, 0]).tolist(); J['an' + s] = (hp - [0, L_THIGH + L_SHIN, 0]).tolist()

# ---------- bone frames: rotation C from MakeHuman rest into the figure rest ----------
def frame(d, ant):
    """Rotation matrix that sends direction d to -Y and ant (made perpendicular) to +Z."""
    d = unit(d); a = unit(ant - d * np.dot(ant, d)); x = np.cross(-d, a)  # columns: where X, Y, Z of the source go
    Msrc = np.stack([x, -d, a], 1)  # source basis (x, y=-d... ) expressed in world
    return Msrc.T  # rotation taking source basis to identity
def quat(M):
    m = M; t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1) * 2; return [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    i = np.argmax(np.diag(m))
    if i == 0: s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2; return [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    if i == 1: s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2; return [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2; return [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]

BONES = []  # name, joint, bind position (MakeHuman), C rotation (3x3)
I3 = np.eye(3)
for n in ('pelvis', 'spine', 'chest', 'neck', 'head'): BONES.append((n, n, np.array(J[n]), I3))
extra = {}
for s in ('L', 'R'):
    sh, el, wr = head(f'upperarm01.{s}'), head(f'lowerarm01.{s}'), head(f'wrist.{s}')
    d1, d2 = el - sh, wr - el
    ant1 = unit((wr - sh) - unit(d1) * np.dot(wr - sh, unit(d1)))  # flexion side: the rest pose has a bent elbow
    C1 = frame(d1, ant1)
    ant2 = ant1 - unit(d2) * np.dot(ant1, unit(d2))  # carry the same roll down the forearm
    C2 = frame(d2, ant2)
    k1 = knuckles(s, 1); d3 = k1 - wr; ant3 = ant2 - unit(d3) * np.dot(ant2, unit(d3)); C3 = frame(d3, ant3)
    BONES += [('sh' + s, 'sh' + s, sh, C1), ('el' + s, 'el' + s, el, C2), ('el2' + s, 'el' + s, el, C2), ('hand' + s, 'hand' + s, wr, C3)]
    k2 = knuckles(s, 2)
    BONES += [('fa' + s, 'hand' + s, k1, C3), ('fb' + s, 'hand' + s, k2, C3)]
    # palm normal in the hand frame: from the knuckle line and the hand direction
    side = 1 if s == 'L' else -1
    across = head(f'finger2-1.{s}') - head(f'finger5-1.{s}')  # pinky -> index
    palm = unit(np.cross(unit(d3), unit(across))) * side
    extra['palm' + s] = (C3 @ palm).tolist(); extra['fa' + s] = (C3 @ (k1 - wr)).tolist(); extra['fb' + s] = (C3 @ (k2 - wr)).tolist()
    extra['grip' + s] = (C3 @ (k1 - wr) * 0.62 + C3 @ palm * 0.035).tolist()
    hp, kn, an = head(f'upperleg01.{s}'), head(f'lowerleg01.{s}'), head(f'foot.{s}')
    fwd = np.array([0, 0, 1.0])
    BONES += [('hp' + s, 'hp' + s, hp, frame(kn - hp, fwd)), ('kn' + s, 'kn' + s, kn, frame(an - kn, fwd)), ('an' + s, 'an' + s, an, I3)]
names = [b[0] for b in BONES]
bi = {n: i for i, n in enumerate(names)}

# ---------- weights ----------
def target_bone(b):
    s = b[-1] if b[-2:] in ('.L', '.R') else ''
    base = b[:-2] if s else b
    if base in ('root', 'spine05') or base == 'pelvis': return 'pelvis'
    if base in ('spine04', 'spine03'): return 'spine'
    if base in ('spine02', 'spine01', 'breast', 'clavicle'): return 'chest'
    if base == 'shoulder01': return ('chest', 'sh' + s)
    if base.startswith('neck'): return 'neck'
    if base.startswith('upperarm'): return 'sh' + s
    if base == 'lowerarm01': return 'el' + s
    if base == 'lowerarm02': return 'el2' + s
    if base == 'wrist' or base.startswith('metacarpal') or base.startswith('finger1'): return 'hand' + s
    if base.startswith('finger') and base.endswith('-1'): return 'fa' + s
    if base.startswith('finger'): return 'fb' + s
    if base.startswith('upperleg'): return 'hp' + s
    if base.startswith('lowerleg'): return 'kn' + s
    if base == 'foot' or base.startswith('toe'): return 'an' + s
    return 'head'
W = np.zeros((N, len(names)))
for b, lst in json.load(open(SRC + 'rigs/default_weights.mhw'))['weights'].items():
    t = target_bone(b)
    for vi, w in lst:
        if vi not in remap: continue
        if isinstance(t, tuple): W[remap[vi], bi[t[0]]] += w * 0.45; W[remap[vi], bi[t[1]]] += w * 0.55
        else: W[remap[vi], bi[t]] += w
W[W.sum(1) == 0, bi['head']] = 1
top = np.argsort(-W, 1)[:, :4]
tw = np.take_along_axis(W, top, 1); tw = tw / tw.sum(1, keepdims=True)
tw8 = np.round(tw * 255).astype(int); tw8[:, 0] += 255 - tw8.sum(1)

# ---------- paint: muscles, shorts, shoes ----------
MUS = ['chest', 'back', 'delts', 'biceps', 'triceps', 'forearms', 'abs', 'glutes', 'quads', 'hams', 'calves']
def ss(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
x, y, z = P[:, 0], P[:, 1], P[:, 2]
ax = np.abs(x)
wb = lambda *ns: sum(W[:, bi[n]] for n in ns) / np.maximum(W.sum(1), 1e-9)
M = np.zeros((N, len(MUS)))
sh_y, hip_y, chest_y = shL[1], hpL[1], chestY
torso = wb('pelvis', 'spine', 'chest', 'neck')
# chest: front of the rib cage between the nipple line and the collar bones
nip = sh_y - 0.13
M[:, 0] = wb('chest', 'shL', 'shR') * ss(0.04, 0.075, z - shL[2]) * ss(nip - 0.1, nip - 0.06, y) * (1 - ss(sh_y + 0.0, sh_y + 0.035, y)) * (1 - ss(0.17, 0.2, ax))
# abs: front of the trunk below the chest
M[:, 6] = wb('chest', 'spine', 'pelvis') * ss(0.03, 0.06, z - hpL[2]) * ss(hip_y + 0.03, hip_y + 0.07, y) * (1 - ss(nip - 0.12, nip - 0.08, y)) * (1 - ss(0.085, 0.11, ax))
# back: lats, traps and the muscles along the spine
M[:, 1] = torso * ss(-0.03, -0.07, z - shL[2]) * ss(hip_y + 0.1, hip_y + 0.16, y) * (1 - ss(sh_y + 0.1, sh_y + 0.14, y))
# glutes
M[:, 7] = wb('pelvis', 'hpL', 'hpR') * ss(-0.03, -0.07, z - hpL[2]) * ss(hip_y - 0.16, hip_y - 0.11, y) * (1 - ss(hip_y + 0.07, hip_y + 0.11, y))
# arms, in each bone's own frame (front = +Z after C)
for s in ('L', 'R'):
    sh = head(f'upperarm01.{s}')
    for bone, k_front, k_back in (('sh' + s, 3, 4),):
        C = BONES[bi[bone]][3]; loc = (P - sh) @ C.T  # vertices in the hanging-arm frame
        w = W[:, bi[bone]] / np.maximum(W.sum(1), 1e-9)
        d = np.linalg.norm(P - sh, axis=1)
        M[:, 2] = np.maximum(M[:, 2], (1 - ss(0.1, 0.14, d)) * ss(0.11, 0.15, ax) * ss(sh_y - 0.16, sh_y - 0.09, y))
        M[:, k_front] = np.maximum(M[:, k_front], w * ss(0.0, 0.025, loc[:, 2]) * ss(-0.03, -0.07, loc[:, 1]) * (1 - ss(-0.21, -0.25, loc[:, 1])))
        M[:, k_back] = np.maximum(M[:, k_back], w * ss(0.0, -0.025, loc[:, 2]) * ss(-0.04, -0.08, loc[:, 1]) * (1 - ss(-0.22, -0.26, loc[:, 1])))
    M[:, 5] = np.maximum(M[:, 5], wb('el' + s, 'el2' + s) * 1.0)
    hp = head(f'upperleg01.{s}'); kn = head(f'lowerleg01.{s}')
    C = BONES[bi['hp' + s]][3]; loc = (P - hp) @ C.T; w = wb('hp' + s)
    M[:, 8] = np.maximum(M[:, 8], w * ss(0.0, 0.03, loc[:, 2]) * ss(-0.1, -0.15, loc[:, 1]) * (1 - ss(-0.38, -0.42, loc[:, 1])))
    M[:, 9] = np.maximum(M[:, 9], w * ss(-0.01, -0.04, loc[:, 2]) * ss(-0.12, -0.17, loc[:, 1]) * (1 - ss(-0.36, -0.41, loc[:, 1])))
    C = BONES[bi['kn' + s]][3]; loc = (P - kn) @ C.T; w = wb('kn' + s)
    M[:, 10] = np.maximum(M[:, 10], w * ss(-0.005, -0.03, loc[:, 2]) * ss(-0.03, -0.07, loc[:, 1]) * (1 - ss(-0.26, -0.32, loc[:, 1])))
M = np.clip(M, 0, 1)
# shorts and shoes
an_y = anL[1]
cloth = np.zeros(N)  # 0 skin .. 1 shorts / shoe / hair, blended at the edges
arms = wb('shL', 'shR', 'elL', 'elR', 'el2L', 'el2R', 'handL', 'handR', 'faL', 'faR', 'fbL', 'fbR') > 0.3
band = (1 - ss(hip_y + 0.065, hip_y + 0.105, y)) * ss(hip_y - 0.27, hip_y - 0.22, y)
band[arms] = 0
cls[(band > 0.01) & (cls == 0)] = 1; cloth[cls == 1] = band[cls == 1]
shoe = (y < an_y + 0.06) & (cls == 0)
cls[shoe] = 2; cloth[shoe] = ss(an_y + 0.05, an_y + 0.035, y[shoe])
# hair: short cut; the hairline is high at the forehead, above the ears at the sides, low at the nape
hv = wb('head') > 0.5
crown = y[hv].max(); hcz = P[hv & (y > crown - 0.06), 2].mean()
hc = np.array([0, crown - 0.105, hcz])
dv = P - hc; dn = dv / np.maximum(np.linalg.norm(dv, axis=1, keepdims=True), 1e-9)
thr = 0.2 + 0.42 * dn[:, 2] + 0.25 * np.clip(np.abs(dn[:, 0]) - 0.6, 0, 1)
hair = ss(thr - 0.02, thr + 0.09, dn[:, 1]); hair[~hv] = 0; hair[np.linalg.norm(dv, axis=1) > 0.2] = 0
cls[(hair > 0.01) & (cls == 0)] = 4; cloth[cls == 4] = hair[cls == 4]
order = np.argsort(-M, 1)[:, :2]
mw = np.take_along_axis(M, order, 1)
mus = np.zeros((N, 4), np.uint8)
mus[:, 0] = order[:, 0]; mus[:, 1] = np.round(mw[:, 0] * 255); mus[:, 2] = order[:, 1]; mus[:, 3] = np.round(mw[:, 1] * 255)

# foot: ball of the foot in ankle space (the ankle bone keeps the MakeHuman foot as it is)
toes = np.mean([head(f'toe{i}-1.L') for i in (1, 2, 3, 4, 5)], 0)
ball = toes - anL; ball[1] = -anL[1] + 0.004

# ---------- write ----------
lo, hi = P.min(0), P.max(0); q = (hi - lo) / 65535
pos = np.round((P - lo) / q).astype(np.uint16)
meta = {
    'license': 'Body: MakeHuman base mesh, targets, skeleton and weights, CC0 1.0 (makehumancommunity/makehuman)',
    'n': N, 't': len(tris), 'lo': lo.tolist(), 'q': q.tolist(), 'muscles': MUS,
    'joints': {k: [round(float(c), 5) for c in v] for k, v in J.items()},
    'bones': [{'name': n, 'joint': j, 'bind': [round(float(c), 5) for c in p], 'q': [round(float(c), 6) for c in quat(C)]} for n, j, p, C in BONES],
    'len': {'armA': A_UP, 'armF': A_FORE, 'thigh': L_THIGH, 'shin': L_SHIN, 'ankle': float(anL[1])},
    'ball': ball.tolist(), **{k: [round(float(c), 5) for c in v] for k, v in extra.items()},
}
mj = json.dumps(meta, separators=(',', ':')).encode()
mj += b' ' * (-len(mj) % 4)
with open(OUT, 'wb') as f:
    f.write(b'TNMB'); f.write(struct.pack('<I', len(mj))); f.write(mj)
    f.write(pos.tobytes())
    idx = np.array(tris, np.uint16); f.write(idx.tobytes())
    if idx.nbytes % 4: f.write(b'\0\0')
    f.write(top.astype(np.uint8).tobytes()); f.write(tw8.astype(np.uint8).tobytes()); f.write(mus.tobytes()); f.write(cls.tobytes()); f.write(np.round(np.clip(cloth, 0, 1) * 255).astype(np.uint8).tobytes())
print('vertices', N, 'triangles', len(tris), 'bytes', 8 + len(mj) + pos.nbytes + idx.nbytes + N * 13, meta['len'])
