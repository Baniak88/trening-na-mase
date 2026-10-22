/* 3D poses. Each exercise has key positions A (start, "Pozycja 1") and B ("Pozycja 2"), optionally M in between
 * (at spec.mk, default 0.5). The solver in js/fig3d.js blends them and keeps the technique constraints:
 *
 * Trunk and FK limbs (degrees): root [x, y, z, pitch, yaw] of the pelvis (pitch -90 = lying on the back with the
 *   head towards -z, +90 = face down), tilt (hip hinge, the legs compensate), sp/ch spine and chest flexion,
 *   nk/hd neck and head, sf/sa/sr/el shoulder flexion, abduction, rotation and elbow, hf/ha/kn/an for legs
 *   without foot targets. [left, right] pairs are allowed everywhere.
 * Hand targets (solved with IK, metres; the figure faces +z, its left is +x):
 *   hw world point, hc chest frame, hp pelvis frame (mid point of the hands, spread by grip g / spec.grip),
 *   hs offset from each shoulder in world axes [out, up, forward], hv direction from the shoulder in the chest
 *   frame with reach hr (great-circle arcs for flies and raises). Use [left, right] pairs, null = FK for that arm.
 *   ep: elbow pole in the chest frame [out, up, forward].
 * Feet: spec.feet {w half stance, z, toe turn-out, ball: true = targets are the balls of the feet}; per key fx, fz,
 *   fy, fp (foot pitch, + = toes down). kp: knee pole. fik: 'L' or 'R' when only one leg is planted.
 *   stand (0..1) raises the body until the legs are straight (soft = knee slack), bal (0..1) moves the body so the
 *   balance point (spec.bal: chest frame {v} or 'hands') is over the middle of the foot; bal0 does that once for A.
 *   at: anchor the hands' mid point (deadlift from the floor); pin: keep a body point on a support.
 * eq: bar, db, db1 (one dumbbell, both hands), grip, sled, cable, rope, cable1 (handle per hand), landmine;
 *   one: 'L' for one-arm work; dba: dumbbell axis (c = chest, f = forearm frame + x/y/z); dbo: offset.
 * ecc: A to B is the lowering phase (played slower). view [yaw, pitch]: yaw 0 = front, 90 = the figure's left. */

const STAND = {w: 0.15, toe: 12};
const LIE = (y, z = 0.22) => [0, y, z, -90, 0];
const KNEEL = a => [0, 0.1 + 0.463 * Math.cos(a * Math.PI / 180), 0.463 * Math.sin(a * Math.PI / 180), a, 0]; // pelvis while kneeling, body leaning a° forward
const SIT = (y = 0.63) => ({root: [0, y, 0, 0, 0]});
const SEATFEET = {w: 0.17, z: 0.47, toe: 10};
const HANG = d => [d, -0.612, 0]; // arm hanging straight down from the shoulder, d = grip outside the shoulder
const BENCH = {eq: 'bar', ecc: 1, ground: false, grip: 0.4, props: [['bench']], feet: {w: 0.31, z: 0.62, toe: 22}, kp: [0.35, -0.2, 1], ep: [0.9, -0.55, -0.8], view: [32, 30]};
const P = {
  /* ---------- legs ---------- */
  squat: {eq: 'bar', ecc: 1, grip: 0.42, feet: {w: 0.17, toe: 20}, kp: [0.3, 0, 1], bal: {v: [0, 0.29, -0.085]}, ep: [0.3, -1, -0.45], view: [62, 8],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 4, stand: 1, bal: 1, hc: [0, 0.29, -0.085]},
    B: {root: [0, 0.46, 0, 0, 0], tilt: 40, sp: 4, nk: -14, bal: 1, hc: [0, 0.29, -0.085]}},
  frontsquat: {eq: 'bar', ecc: 1, grip: 0.24, feet: {w: 0.17, toe: 20}, kp: [0.3, 0, 1], bal: {v: [0, 0.262, 0.135]}, ep: [0.3, 0.02, 1], view: [62, 8],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, bal: 1, hc: [0, 0.262, 0.135]},
    B: {root: [0, 0.43, 0, 0, 0], tilt: 24, nk: -12, bal: 1, hc: [0, 0.262, 0.135]}},
  goblet: {eq: 'db1', ecc: 1, dba: 'cy', dbo: [0, -0.09, 0.02], grip: 0.05, feet: {w: 0.2, toe: 28}, kp: [0.55, 0, 1], bal: {v: [0, 0.12, 0.2]}, ep: [0.35, -1, 0.25], view: [50, 8],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, bal: 1, hc: [0, 0.2, 0.19]},
    B: {root: [0, 0.4, 0, 0, 0], tilt: 20, nk: -10, bal: 1, hc: [0, 0.2, 0.19]}},
  smithsquat: {eq: 'bar', ecc: 1, grip: 0.42, props: [['rails']], feet: {w: 0.17, toe: 18, z: 0.16}, kp: [0.4, 0, 1], bal: {v: [0, 0.29, -0.085]}, balZ: 0, ep: [0.3, -1, -0.45], view: [62, 8],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, bal: 1, hc: [0, 0.29, -0.085]},
    B: {root: [0, 0.47, 0, 0, 0], tilt: 26, nk: -10, bal: 1, hc: [0, 0.29, -0.085]}},
  hack: {eq: 'none', ecc: 1, grip: 0.3, feet: {w: 0.16, z: 0.42, y: 0.115, toe: 15}, kp: [0.35, 0, 1], ep: [1, -1, 0.2], view: [72, 6],
    props: [['plate', {w: 0.7, d: 0.5, y: 0.05, z: 0.45, rx: -15}], ['pad', {w: 0.05, h: 2.0, d: 0.05, x: 0.36, y: 0.95, z: -0.25, rx: -40}], ['pad', {w: 0.05, h: 2.0, d: 0.05, x: -0.36, y: 0.95, z: -0.25, rx: -40}]],
    pads: [{v: [0, 0.12, -0.165], w: 0.42, h: 0.62, d: 0.06}, {v: [0.13, 0.31, -0.02], w: 0.11, h: 0.07, d: 0.24}, {v: [-0.13, 0.31, -0.02], w: 0.11, h: 0.07, d: 0.24}],
    A: {root: [0, 0.86, -0.1, 0, 0], tilt: -40, fp: -15, hc: [0, 0.33, 0.06]},
    B: {root: [0, 0.53, 0.18, 0, 0], tilt: -40, fp: -15, hc: [0, 0.33, 0.06]}},
  lunge: {eq: 'db', ecc: 1, dba: 'cz', feet: {w: 0.1, toe: 6, ball: true}, view: [80, 6],
    A: {root: [0, 0.9, -0.02, 0, 0], stand: 1, soft: 0.02, fz: [0.55, -0.42], fp: [0, 40], sa: 7, el: 6},
    B: {root: [0, 0.56, -0.03, 0, 0], tilt: 3, fz: [0.55, -0.42], fp: [0, 60], sa: 7, el: 6}},
  bss: {eq: 'db', ecc: 1, dba: 'cz', feet: {w: 0.1, toe: 6, ball: [true, false]}, props: [['bench', {len: 0.45, z: -0.62}]], view: [80, 6],
    A: {root: [0, 0.95, -0.03, 0, 0], stand: 1, soft: 0.015, fz: [0.33, -0.52], fy: [0.02, 0.53], fp: [0, 118], sa: 7, el: 6},
    B: {root: [0, 0.5, -0.08, 0, 0], tilt: 12, fz: [0.33, -0.52], fy: [0.02, 0.53], fp: [0, 118], sa: 7, el: 6}},
  legpress: {eq: 'sled', ecc: 1, ground: false, sledTilt: 45, feet: {w: 0.15, toe: 10}, kp: [0.3, 0, 1], view: [84, 10],
    props: [['pad', {w: 0.5, h: 0.07, d: 1.05, y: 0.69, z: -0.31, rx: 40}], ['pad', {w: 0.5, h: 0.08, d: 0.4, y: 0.4, z: 0.02, rx: 10}], ['box', {w: 0.12, h: 0.36, d: 0.12, z: -0.05}]],
    A: {root: [0, 0.55, 0, -50, 0], fy: 1.07, fz: 0.66, fp: -128, sa: 25, el: 30, sf: 10},
    B: {root: [0, 0.55, 0, -50, 0], fy: 0.76, fz: 0.35, fp: -128, sa: 25, el: 30, sf: 10}},
  legext: {eq: 'none', ground: false, props: [['seat', {y: 0.5, backH: 0.65}]], roller: {at: 0.37, z: 0.075}, view: [78, 8],
    A: {...SIT(), hf: 90, kn: 92, an: 5, sa: 16, el: 30, sf: 15}, B: {...SIT(), hf: 90, kn: 3, an: -12, sa: 16, el: 30, sf: 15}},
  legcurl: {eq: 'none', ground: false, props: [['seat', {y: 0.5, backH: 0.7, backTilt: 0.05}], ['pad', {w: 0.45, h: 0.08, d: 0.16, y: 0.74, z: 0.4}]], roller: {at: 0.38, z: -0.075}, view: [78, 8],
    A: {...SIT(), tilt: -8, hf: 82, kn: 4, an: -5, sa: 16, el: 30, sf: 15}, B: {...SIT(), tilt: -8, hf: 82, kn: 112, an: 5, sa: 16, el: 30, sf: 15}},
  lyingcurl: {eq: 'none', ground: false, props: [['bench', {len: 1.15, y: 0.62, z: 0.12}]], roller: {at: 0.38, z: -0.075}, view: [82, 12],
    A: {root: [0, 0.74, -0.05, 92, 0], hf: -2, kn: 3, sf: 160, el: 70, sa: 25}, B: {root: [0, 0.74, -0.05, 92, 0], hf: -2, kn: 118, an: 10, sf: 160, el: 70, sa: 25}},
  deadlift: {eq: 'bar', grip: 0.26, feet: {w: 0.13, toe: 10}, kp: [0.2, 0, 1], bal: 'hands', view: [80, 6],
    A: {root: [0, 0.6, -0.2, 0, 0], tilt: 57, sp: 2, nk: -20, hs: [0.055, -0.61, -0.035], at: [0, 0.225, 0.06]},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 0, stand: 1, bal: 1, hs: HANG(0.055)}},
  rdl: {eq: 'bar', ecc: 1, grip: 0.26, feet: {w: 0.14, toe: 8}, kp: [0.2, 0, 1], bal: 'hands', view: [80, 6],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, soft: 0.012, bal: 1, hs: HANG(0.055)},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 74, sp: 3, nk: -25, stand: 1, soft: 0.035, bal: 1, hs: HANG(0.055)}},
  dbrdl: {eq: 'db', ecc: 1, dba: 'cx', feet: {w: 0.14, toe: 8}, kp: [0.2, 0, 1], bal: 'hands', view: [80, 6],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, soft: 0.012, bal: 1, hs: HANG(-0.04)},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 74, sp: 3, nk: -25, stand: 1, soft: 0.035, bal: 1, hs: HANG(-0.04)}},
  singlerdl: {eq: 'db', ecc: 1, dba: 'cz', feet: {w: 0.1, toe: 6}, fik: 'L', kp: [0.2, 0, 1], bal: 'hands', balZ: 0.06, view: [84, 6],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, soft: 0.015, bal: 1, hs: HANG(-0.02), hf: [0, -4], kn: [0, 22], an: [0, 15]},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 84, nk: -28, stand: 1, soft: 0.035, bal: 1, hs: HANG(-0.02), hf: [0, 2], kn: [0, 8], an: [0, 10]}},
  hipext: {eq: 'none', ecc: 1, ground: false, feet: {w: 0.11, toe: 8}, kp: [0.2, 0, 1], pin: {f: 'p', v: [0, -0.05, 0], w: [0, 0.95, 0.06]}, ep: [1, -1, 0.3], view: [84, 8],
    props: [['pad', {w: 0.42, h: 0.12, d: 0.26, y: 0.84, z: 0.15, rx: 45}], ['pad', {w: 0.42, h: 0.1, d: 0.1, y: 0.37, z: -0.66}], ['pad', {w: 0.1, h: 0.1, d: 1.05, y: 0.6, z: -0.25, rx: -45}], ['box', {w: 0.1, h: 0.6, d: 0.1, z: -0.25}]],
    A: {root: [0, 0.95, 0, 45, 0], fy: 0.33, fz: -0.56, fp: 45, hc: [[-0.09, 0.18, 0.2], [0.09, 0.21, 0.21]]},
    B: {root: [0, 0.95, 0, 132, 0], nk: -10, fy: 0.33, fz: -0.56, fp: 45, hc: [[-0.09, 0.18, 0.2], [0.09, 0.21, 0.21]]}},
  nordic: {eq: 'none', ecc: 1, ground: false, feet: {w: 0.1, toe: 0}, kp: [0.02, -1, 0.5], ep: [0.8, -1, 0.2], view: [84, 6],
    props: [['pad', {w: 0.5, h: 0.05, d: 0.7, y: 0.025, z: -0.2}], ['pad', {w: 0.42, h: 0.09, d: 0.09, y: 0.21, z: -0.44}]],
    A: {root: KNEEL(0), fy: 0.115, fz: -0.42, fp: 162, hc: [[-0.1, 0.17, 0.19], [0.1, 0.2, 0.2]]},
    M: {root: KNEEL(32), nk: -10, fy: 0.115, fz: -0.42, fp: 162, hs: [0.05, -0.25, 0.3]},
    B: {root: KNEEL(64), nk: -20, fy: 0.115, fz: -0.42, fp: 162, hs: [0.05, -0.15, 0.5]}},
  hipthrust: {eq: 'bar', grip: 0.36, ground: false, props: [['bench', {len: 0.45, z: -0.6}]], feet: {w: 0.17, z: 0.5, toe: 14}, kp: [0.3, 0, 1], pin: {f: 'c', v: [0, 0.14, -0.105], w: [0, 0.485, -0.37]}, ep: [1, 0.5, 0.3], view: [84, 10],
    A: {root: [0, 0.35, 0, -45, 0], nk: 10, hp: [0, -0.03, 0.17]},
    B: {root: [0, 0.55, 0, -90, 0], nk: 28, hp: [0, -0.03, 0.17]}},
  glutebridge: {eq: 'bar', grip: 0.36, ground: false, feet: {w: 0.17, z: 0.42, toe: 12}, kp: [0.3, 0, 1], pin: {f: 'c', v: [0, 0.3, -0.08], w: [0, 0, -0.42]}, rest: 0.005, ep: [1, 0.5, 0.3], view: [84, 12],
    A: {root: [0, 0.12, 0, -90, 0], hp: [0, -0.03, 0.17]},
    B: {root: [0, 0.3, 0, -112, 0], nk: 22, hp: [0, -0.03, 0.17]}},
  calf: {eq: 'none', feet: {w: 0.14, toe: 10, ball: true}, props: [['box', {w: 0.6, h: 0.1, d: 0.32, z: 0.2}]], ep: [1, -1, 0.2], view: [76, 4],
    pads: [{v: [0.13, 0.31, -0.01], w: 0.11, h: 0.07, d: 0.24}, {v: [-0.13, 0.31, -0.01], w: 0.11, h: 0.07, d: 0.24}],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, fy: 0.12, fz: 0.07, fp: -22, hs: [0.11, 0.06, 0.12]},
    B: {root: [0, 0.95, 0, 0, 0], stand: 1, fy: 0.12, fz: 0.07, fp: 38, hs: [0.11, 0.06, 0.12]}},
  seatedcalf: {eq: 'none', ground: false, feet: {w: 0.13, toe: 8, ball: true}, kp: [0.2, 0, 1], props: [['seat', {y: 0.48, back: false}], ['box', {w: 0.5, h: 0.1, d: 0.25, z: 0.5}]],
    pads: [{frame: 'hpL', v: [-0.11, -0.36, 0.065], w: 0.42, h: 0.16, d: 0.07}], grip: 0.17, view: [70, 8],
    A: {...SIT(0.63), tilt: 10, fy: 0.12, fz: 0.47, fp: -22, hp: [0, 0.03, 0.42]},
    B: {...SIT(0.63), tilt: 10, fy: 0.12, fz: 0.47, fp: 34, hp: [0, 0.03, 0.42]}},
  /* ---------- chest ---------- */
  bench: {...BENCH, A: {root: LIE(0.585), hs: [0.195, 0.565, 0.02]}, B: {root: LIE(0.585), hc: [0, 0.12, 0.135]}},
  dbbench: {...BENCH, eq: 'db', dba: 'cx', A: {root: LIE(0.585), hs: [0.02, 0.6, 0]}, B: {root: LIE(0.585), hc: [0, 0.17, 0.07], g: 0.34}},
  incline: {...BENCH, eq: 'db', dba: 'cx', props: [['incline', {inc: 38}]], feet: {w: 0.3, z: 0.52, toe: 22}, view: [38, 24],
    A: {root: [0, 0.62, -0.05, -52, 0], hs: [0.02, 0.6, 0]}, B: {root: [0, 0.62, -0.05, -52, 0], hc: [0, 0.22, 0.08], g: 0.33}},
  pushup: {eq: 'none', ecc: 1, ground: false, grip: 0.27, pr: -140, curl: 5, feet: {w: 0.1, toe: 0, ball: true}, kp: [0.2, 0, 1], ep: [0.8, -0.75, -0.25], view: [72, 14],
    A: {root: [0, 0.465, -0.401, 71.4, 0], fy: 0.045, fz: -1.267, fp: 65, wr: 80, hw: [0, 0.085, 0]},
    B: {root: [0, 0.18, -0.353, 89.5, 0], fy: 0.045, fz: -1.267, fp: 65, nk: -10, wr: 98, hw: [0, 0.085, 0]}},
  dips: {eq: 'none', ecc: 1, ground: false, grip: 0.27, props: [['pbars', {y: 1.22, w: 0.27, z: 0.1}]], ep: [0.25, 0, -1], view: [70, 6],
    A: {root: [0, 1.41, 0.015, 0, 0], tilt: 8, hf: 25, kn: 75, an: 20, hw: [0, 1.25, 0.1]},
    B: {root: [0, 1.21, 0.065, 0, 0], tilt: 26, hf: 35, kn: 80, an: 20, hw: [0, 1.25, 0.1]}},
  cablefly: {eq: 'cable1', props: [['tower', {x: 0.95, y: 1.9, z: -0.2}], ['tower', {x: -0.95, y: 1.9, z: -0.2}]], feet: {w: 0.12, toe: 8, ball: true}, ep: [1, 0.25, -0.6], view: [28, 8],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 14, stand: 1, soft: 0.02, fz: [0.28, -0.22], fp: [0, 32], hv: [0.85, 0.48, -0.25], hr: 0.55},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 14, stand: 1, soft: 0.02, fz: [0.28, -0.22], fp: [0, 32], hv: [0.1, -0.72, 0.7], hr: 0.55}},
  pecdeck: {eq: 'grip', ground: false, props: [['seat', {y: 0.48, backH: 0.78}]], feet: SEATFEET, ep: [0.2, -1, -0.5], view: [32, 14],
    A: {...SIT(), hv: [1, 0.03, -0.22], hr: 0.52}, B: {...SIT(), hv: [0.16, 0.03, 1], hr: 0.52}},
  chestpress: {eq: 'grip', ground: false, grip: 0.29, props: [['seat', {y: 0.48, backH: 0.78}]], feet: SEATFEET, ep: [1, -0.6, -0.4], view: [60, 10],
    A: {...SIT(), hc: [0, 0.19, 0.15]}, B: {...SIT(), hs: [0.07, -0.06, 0.585]}},
  /* ---------- shoulders ---------- */
  ohp: {eq: 'bar', grip: 0.27, feet: STAND, ep: [0.3, -1, 0.8], view: [52, 4],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, hc: [0, 0.262, 0.15]},
    M: {root: [0, 0.95, 0, 0, 0], stand: 1, tilt: -4, nk: -8, hd: -10, hs: [0.065, 0.33, 0.16], ep: [0.6, -1, 0.3]},
    B: {root: [0, 0.95, 0, 0, 0], stand: 1, nk: 6, hs: [0.065, 0.6, 0.02], ep: [1, -0.3, 0]}},
  dbohp: {eq: 'db', dba: 'cx', ground: false, props: [['seat', {y: 0.48, backH: 0.78}]], feet: SEATFEET, ep: [1, -1, 0.1], view: [36, 8],
    A: {...SIT(), hs: [0.25, 0.12, 0.03]}, B: {...SIT(), hs: [0.06, 0.6, 0.02]}},
  machpress: {eq: 'grip', ground: false, props: [['seat', {y: 0.48, backH: 0.78}]], feet: SEATFEET, ep: [1, -1, 0.1], view: [36, 8],
    A: {...SIT(), hs: [0.23, 0.12, 0.08]}, B: {...SIT(), hs: [0.1, 0.58, 0.08]}},
  latraise: {eq: 'db', dba: 'cz', feet: STAND, ep: [0, 1, -0.7], view: [14, 6],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, tilt: 4, hv: [0.22, -1, 0.14], hr: 0.565},
    B: {root: [0, 0.95, 0, 0, 0], stand: 1, tilt: 4, hv: [1, 0.04, 0.14], hr: 0.565}},
  /* ---------- back ---------- */
  pullup: {eq: 'none', ground: false, grip: 0.4, props: [['bar', {y: 2.3}]], ep: [1, -1, 0.05], view: [205, 8],
    A: {root: [0, 1.325, 0, 0, 0], tilt: -3, hf: 8, kn: 35, an: 15, hw: [0, 2.3, 0]},
    B: {root: [0, 1.765, -0.02, 0, 0], tilt: -12, nk: -10, hf: 12, kn: 40, an: 15, hw: [0, 2.3, 0]}},
  chinup: {eq: 'none', pr: 90, ground: false, grip: 0.2, props: [['bar', {y: 2.3}]], ep: [0.35, -1, 0.7], view: [38, 8],
    A: {root: [0, 1.3, 0, 0, 0], tilt: -2, hf: 8, kn: 35, an: 15, hw: [0, 2.3, 0]},
    B: {root: [0, 1.765, -0.06, 0, 0], tilt: -10, nk: -10, hf: 12, kn: 40, an: 15, hw: [0, 2.3, 0]}},
  latpull: {eq: 'cable', handle: 1.15, ground: false, grip: 0.42, feet: SEATFEET, ep: [1, -0.8, -0.25], view: [205, 10],
    props: [['seat', {y: 0.48, back: false}], ['tower', {y: 2.25, z: 0.08, back: 0.35}], ['pad', {w: 0.45, h: 0.08, d: 0.12, y: 0.79, z: 0.32}]],
    A: {...SIT(), hs: [0.215, 0.575, 0.08]}, B: {...SIT(), tilt: -14, hc: [0, 0.27, 0.15]}},
  cablerow: {eq: 'cable', handle: 0.16, ground: false, grip: 0.06, feet: {w: 0.13, toe: 6}, kp: [0.3, 0, 1], ep: [0.3, -0.5, -1], view: [84, 10],
    props: [['box', {w: 0.4, h: 0.32, d: 0.55, z: -0.08}], ['tower', {y: 0.42, z: 1.08, back: 0.12}], ['pad', {w: 0.5, h: 0.32, d: 0.06, y: 0.3, z: 0.86, rx: -18}]],
    A: {root: [0, 0.43, 0, 0, 0], tilt: 24, fy: 0.23, fz: 0.79, fp: -70, hs: [-0.16, -0.1, 0.58]},
    B: {root: [0, 0.43, 0, 0, 0], tilt: -4, fy: 0.23, fz: 0.79, fp: -70, hc: [0, -0.05, 0.16]}},
  row: {eq: 'bar', grip: 0.3, feet: {w: 0.15, toe: 10}, kp: [0.25, 0, 1], bal: 'hands', bal0: true, ep: [0.45, -0.45, -1], view: [80, 8],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 52, nk: -22, stand: 1, soft: 0.04, hs: HANG(0.095)},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 50, nk: -22, stand: 1, soft: 0.04, hc: [0, -0.1, 0.16]}},
  dbrow: {eq: 'db', one: 'L', dba: 'cy', feet: {w: 0.17, toe: 10}, kp: [0.25, 0, 1], ep: [[0.15, -0.3, -1], [0.3, -0.3, -0.5]], view: [62, 14],
    props: [['bench', {len: 0.9, x: -0.27, z: 0.5, y: 0.42}]],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 76, nk: -20, stand: 1, soft: 0.05, fz: [-0.22, 0.25], hs: [HANG(0.0), [0.04, -0.52, 0.02]]},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 74, nk: -20, stand: 1, soft: 0.05, fz: [-0.22, 0.25], hc: [[0.2, -0.13, 0.0], null], hs: [null, [0.04, -0.52, 0.02]]}},
  straightpd: {eq: 'cable', handle: 0.55, props: [['tower', {y: 2.15, z: 0.78, back: 0.1}]], feet: STAND, ep: [0.4, 0.4, -1], view: [80, 8],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 24, stand: 1, soft: 0.03, hv: [0.24, 0.78, 0.58], hr: 0.565},
    B: {root: [0, 0.95, 0, 0, 0], tilt: 24, stand: 1, soft: 0.03, hv: [0.24, -0.92, 0.34], hr: 0.565}},
  /* ---------- arms ---------- */
  curl: {eq: 'db', dba: 'fx', pr: 90, feet: STAND, view: [38, 6], A: {root: [0, 0.95, 0, 0, 0], stand: 1, sa: 7, el: 4, sr: 10}, B: {root: [0, 0.95, 0, 0, 0], stand: 1, sa: 7, el: 138, sf: 8, sr: 10}},
  barcurl: {eq: 'bar', pr: 90, barLen: 1.5, plate: 0.15, feet: STAND, view: [38, 6], A: {root: [0, 0.95, 0, 0, 0], stand: 1, sa: 9, el: 4}, B: {root: [0, 0.95, 0, 0, 0], stand: 1, sa: 9, el: 136, sf: 8}},
  hammer: {eq: 'db', dba: 'fz', feet: STAND, view: [38, 6], A: {root: [0, 0.95, 0, 0, 0], stand: 1, sa: 7, el: 4}, B: {root: [0, 0.95, 0, 0, 0], stand: 1, sa: 7, el: 132, sf: 8}},
  cablecurl: {eq: 'cable', pr: 90, handle: 0.45, props: [['tower', {y: 0.15, z: 0.62, back: 0.1}]], feet: STAND, view: [62, 6],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, tilt: -3, sa: 8, el: 6, sf: 10}, B: {root: [0, 0.95, 0, 0, 0], stand: 1, tilt: -3, sa: 8, el: 136, sf: 16}},
  inclinecurl: {eq: 'db', dba: 'fx', pr: 90, ground: false, props: [['incline', {inc: 55}]], feet: {w: 0.22, z: 0.55, toe: 15}, kp: [0.3, 0, 1], view: [84, 8],
    A: {root: [0, 0.62, -0.02, -36, 0], sf: -34, el: 3, sa: 6, sr: 10}, B: {root: [0, 0.62, -0.02, -36, 0], sf: -24, el: 135, sa: 6, sr: 10}},
  preacher: {eq: 'db', dba: 'fx', pr: 90, ground: false, props: [['seat', {y: 0.48, back: false}], ['pad', {w: 0.5, h: 0.08, d: 0.34, y: 0.875, z: 0.17, rx: 34}], ['box', {w: 0.08, h: 0.9, d: 0.08, z: 0.3}]], feet: SEATFEET, view: [74, 10],
    A: {...SIT(), tilt: 10, sf: 46, sa: 12, el: 10}, B: {...SIT(), tilt: 10, sf: 46, sa: 12, el: 126}},
  conc: {eq: 'db', one: 'L', dba: 'fx', pr: [90, 0], ground: false, props: [['box', {w: 0.4, h: 0.45, d: 0.4}]], feet: {w: 0.3, z: 0.42, toe: 25}, kp: [0.6, 0, 1], view: [42, 8],
    A: {root: [0, 0.56, 0, 0, 0], tilt: 40, nk: -15, sf: [44, 40], sa: [5, 20], el: [6, 60]}, B: {root: [0, 0.56, 0, 0, 0], tilt: 40, nk: -15, sf: [44, 40], sa: [5, 20], el: [128, 60]}},
  triext: {eq: 'db1', ecc: 1, dba: 'fy', dbo: [0, 0.1, 0.02], feet: STAND, view: [74, 6],
    A: {root: [0, 0.95, 0, 0, 0], stand: 1, sf: 172, sa: 8, el: 8}, B: {root: [0, 0.95, 0, 0, 0], stand: 1, sf: 168, sa: 10, el: 150}},
  ropeoh: {eq: 'rope', props: [['tower', {y: 0.62, z: -0.62, back: -0.1}]], feet: {w: 0.12, toe: 8, ball: true}, view: [78, 6],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 26, stand: 1, soft: 0.02, fz: [0.3, -0.25], fp: [0, 30], sf: 160, sa: 10, el: 140}, B: {root: [0, 0.95, 0, 0, 0], tilt: 26, stand: 1, soft: 0.02, fz: [0.3, -0.25], fp: [0, 30], sf: 146, sa: 10, el: 8}},
  pushdown: {eq: 'cable', handle: 0.32, props: [['tower', {y: 2.1, z: 0.45, back: 0.1}]], feet: STAND, view: [68, 6],
    A: {root: [0, 0.95, 0, 0, 0], tilt: 10, stand: 1, soft: 0.02, sf: 8, sa: 6, el: 112}, B: {root: [0, 0.95, 0, 0, 0], tilt: 10, stand: 1, soft: 0.02, sf: 8, sa: 6, el: 4}},
  skull: {...BENCH, eq: 'db', dba: 'fz', A: {root: LIE(0.585), sf: 100, sa: 8, el: 6}, B: {root: LIE(0.585), sf: 116, sa: 8, el: 122}},
  cgbench: {...BENCH, grip: 0.24, ep: [0.45, -1, -0.6], A: {root: LIE(0.585), hs: [0.035, 0.6, 0.02]}, B: {root: LIE(0.585), hc: [0, 0.1, 0.135]}},
  /* ---------- core ---------- */
  cablecrunch: {eq: 'rope', ground: false, props: [['tower', {y: 2.1, z: 0.85, back: 0.1}], ['pad', {w: 0.45, h: 0.04, d: 0.3, y: 0.02, z: 0}]], feet: {w: 0.12, toe: 0}, kp: [0.2, -1, 0.4], ep: [0.6, -0.4, 1], view: [80, 8],
    A: {root: [0, 0.55, 0, 0, 0], tilt: 8, fy: 0.08, fz: -0.42, fp: 162, hc: [[0.07, 0.4, 0.08], [-0.07, 0.4, 0.08]]},
    B: {root: [0, 0.55, 0.02, 0, 0], tilt: 16, sp: 38, ch: 30, nk: 18, fy: 0.08, fz: -0.42, fp: 162, hc: [[0.07, 0.4, 0.08], [-0.07, 0.4, 0.08]]}},
};

/* Variants. Same movement → same pose; otherwise a pose derived from the closest one. */
const one = (base, extra) => ({...base, ...extra});
const SAME = {walklunge: 'lunge', splitsquat: 'lunge', inclinebar: null, ezcurl: 'barcurl', ezskull: null};
for (const [a, b] of Object.entries(SAME)) if (b) P[a] = P[b];
P.inclinebar = one(P.incline, {eq: 'bar', grip: 0.39, A: {root: P.incline.A.root, hs: [0.185, 0.57, 0]}, B: {root: P.incline.A.root, hc: [0, 0.235, 0.135]}});
P.smithincl = one(P.inclinebar, {props: [['incline', {inc: 38}], ['rails', {w: 0.62}]]});
P.smithbench = one(P.bench, {props: [['bench'], ['rails', {w: 0.62}]], A: {root: LIE(0.585), hc: [0, 0.14, 0.555]}});
P.ezskull = one(P.skull, {eq: 'bar', barLen: 1.25, plate: 0.13});
P.legext1 = one(P.legext, {roller: {at: 0.37, z: 0.075, side: 'L'}, A: {...P.legext.A, kn: [92, 90]}, B: {...P.legext.B, kn: [3, 90], an: [-12, 5]}});
P.dbthrust = one(P.hipthrust, {eq: 'db1', dba: 'cx', grip: 0.09});
P.singlebridge = one(P.glutebridge, {eq: 'none', fik: 'L', ep: [0.6, -1, 0.2],
  A: {...P.glutebridge.A, hf: [0, 70], kn: [0, 12], hp: undefined, sa: 20, el: 6, sf: 5}, B: {...P.glutebridge.B, hf: [0, 18], kn: [0, 6], hp: undefined, sa: 20, el: 6, sf: 5}});
P.dbcalf = one(P.calf, {eq: 'db', one: 'L', dba: 'cz', fik: 'L', pads: [], props: [['box', {w: 0.4, h: 0.1, d: 0.32, z: 0.2}], ['box', {w: 0.06, h: 1.9, d: 0.06, x: -0.34, z: 0.42, y: 0.95}]],
  A: {...P.calf.A, hs: [[0, -0.612, 0], null], hw: [null, [-0.33, 1.3, 0.37]], kn: [0, 80], hf: [0, 10]}, B: {...P.calf.B, hs: [[0, -0.612, 0], null], hw: [null, [-0.33, 1.3, 0.37]], kn: [0, 80], hf: [0, 10]}});
P.lpcalf = one(P.legpress, {ecc: 0, sledBall: true, A: {...P.legpress.A, fy: 1.085, fz: 0.675, fp: -145}, B: {...P.legpress.A, fy: 1.085, fz: 0.675, fp: -97}});
P.inclinemach = one(P.chestpress, {props: [['seat', {y: 0.48, backH: 0.8, backTilt: 0.12}]], A: {...SIT(), tilt: -12, hc: [0, 0.22, 0.15]}, B: {...SIT(), tilt: -12, hs: [0.06, 0.32, 0.5]}});
P.arnold = one(P.dbohp, {A: {...SIT(), hs: [0.03, 0.13, 0.2]}, M: {...SIT(), hs: [0.2, 0.3, 0.1]}, B: P.dbohp.B, ep: [0.3, -1, 0.7]});
P.arnold.M.ep = [1, -1, 0.3]; P.arnold.B = {...P.dbohp.B, ep: [1, -1, 0.1]};
P.smithohp = one(P.dbohp, {eq: 'bar', grip: 0.4, props: [['seat', {y: 0.48, backH: 0.78}], ['rails', {w: 0.62}]], ep: [0.6, -1, 0.4],
  A: {...SIT(), hc: [0, 0.37, 0.19]}, B: {...SIT(), hs: [0.195, 0.565, 0.1]}});
P.seatedlat = one(P.latraise, {ground: false, props: [['seat', {y: 0.48, back: false}]], feet: SEATFEET, A: {...SIT(), hv: [0.22, -1, 0.14], hr: 0.565}, B: {...SIT(), hv: [1, 0.04, 0.14], hr: 0.565}});
P.cablelat = one(P.latraise, {eq: 'cable1', one: 'L', props: [['tower', {x: -0.45, y: 0.15, z: 0.1, back: -0.05}]],
  A: {...P.latraise.A, hv: [[-0.25, -1, 0.3], null], sa: [8, 40], el: [8, 80], sf: [0, 30]}, B: {...P.latraise.B, hv: [[1, 0.04, 0.14], null], sa: [8, 40], el: [8, 80], sf: [0, 30]}});
P.closepull = one(P.latpull, {handle: 0.14, grip: 0.06, ep: [0.3, -1, -0.5], A: {...SIT(), hs: [-0.145, 0.58, 0.09]}, B: {...SIT(), tilt: -14, hc: [0, 0.2, 0.17]}});
P.onearmpull = one(P.latpull, {eq: 'cable1', one: 'L', props: [['seat', {y: 0.48, back: false}], ['tower', {x: 0.2, y: 2.25, z: 0.08, back: 0.35}], ['pad', {w: 0.45, h: 0.08, d: 0.12, y: 0.79, z: 0.32}]], ep: [0.8, -1, -0.2],
  A: {...SIT(), hs: [[0, 0.6, 0.1], null], sf: [0, 35], el: [0, 70], sa: [0, 12]}, B: {...SIT(), tilt: -6, hc: [[0.22, 0.22, 0.06], null], sf: [0, 35], el: [0, 70], sa: [0, 12]}});
P.tbar = one(P.row, {eq: 'landmine', pivot: [0, 0.04, -1.25], grip: 0.06, ep: [0.3, -0.4, -1],
  A: {...P.row.A, hs: HANG(-0.17)}, B: {...P.row.B, hc: [0, 0.06, 0.16]}});
P.onearmrow = one(P.cablerow, {eq: 'cable1', one: 'L', A: {...P.cablerow.A, hs: [[0.02, -0.08, 0.59], null], sf: [0, 40], el: [0, 70]}, B: {...P.cablerow.B, hc: [[0.17, -0.06, 0.06], null], sf: [0, 40], el: [0, 70]}});
P.machinerow = {eq: 'grip', ground: false, grip: 0.22, feet: SEATFEET, ep: [0.3, -0.3, -1], view: [80, 10],
  props: [['seat', {y: 0.48, back: false}], ['pad', {w: 0.3, h: 0.45, d: 0.08, y: 0.95, z: 0.2}]],
  A: {...SIT(), tilt: 6, hs: [0.02, -0.05, 0.6]}, B: {...SIT(), tilt: 6, hc: [0, 0.12, 0.06]}};
P.cablecurl1 = one(P.cablecurl, {eq: 'cable1', one: 'L', props: [['tower', {x: 0.25, y: 0.15, z: 0.62, back: 0.1}]], A: {...P.cablecurl.A, el: [6, 8]}, B: {...P.cablecurl.B, el: [136, 8], sf: [16, 8]}});
P.pushdown1 = one(P.pushdown, {eq: 'cable1', one: 'L', props: [['tower', {x: 0.2, y: 2.1, z: 0.45, back: 0.1}]], A: {...P.pushdown.A, el: [112, 30]}, B: {...P.pushdown.B, el: [4, 30]}});
P.triext1 = one(P.triext, {eq: 'db', one: 'L', dba: 'fz', dbo: null, A: {...P.triext.A, sf: [172, 10], el: [8, 30], sa: [4, 10]}, B: {...P.triext.B, sf: [168, 10], el: [150, 30], sa: [4, 10]}});
P.revpec = {eq: 'grip', ground: false, props: [['seat', {y: 0.48, back: false}], ['pad', {w: 0.36, h: 0.6, d: 0.08, y: 0.95, z: 0.2}]], feet: SEATFEET, ep: [1, 0.2, -0.3], view: [200, 14],
  A: {...SIT(), hv: [0.12, 0, 1], hr: 0.56}, B: {...SIT(), hv: [1, 0, 0.04], hr: 0.56}};
export const POSES = P;
