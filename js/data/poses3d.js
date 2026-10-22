/* 3D poses: two key positions A (start) and B (end) as joint angles in degrees, plus equipment, props and camera.
 * tilt: pelvis tilt forward (whole body; legs compensate with hip flexion); sp spine flexion; ch chest;
 * sf shoulder flexion (arm forward/up), sa abduction (out to the side), sr shoulder rotation, el elbow flexion,
 * hf hip flexion, ha hip abduction, kn knee flexion, an ankle; root [x, y, z, pitch, yaw]
 * (pitch -90 = lying on the back with the head towards -z, +90 = face down with the head towards +z).
 * Pairs [left, right] are allowed. ground: feet on the floor (default) or false; hands: [x, y, z] to hang/push from.
 * eq: bar, db, dbn (neutral grip), db1 (one dumbbell in both hands), grip, sled, cable, rope, cable1, cable2.
 * view [yaw, pitch]: yaw 0 = front, 90 = the figure's left side. */
const RACK = {sa: 48, sr: 82, el: 120, sf: -28};
const SIT = {root: [0, 0.67, 0, 0, 0], hf: 90, kn: 90};
const LIE = y => [0, y, 0.22, -90, 0];
const BENCH_LEGS = {hf: -8, kn: 98, an: 8, ha: 18};
const P = {
  /* legs */
  squat: {eq: 'bar', view: [50, 8], A: {...RACK, ha: 10}, B: {...RACK, ha: 14, tilt: 38, sp: 5, hf: 120, kn: 118, an: 32}},
  frontsquat: {eq: 'bar', view: [55, 8], A: {sf: 95, sa: 22, el: 150, ha: 10}, B: {sf: 85, sa: 22, el: 150, ha: 14, tilt: 18, hf: 105, kn: 122, an: 34}},
  goblet: {eq: 'db1', view: [45, 8], A: {sf: 25, sa: 18, el: 140, ha: 12}, B: {sf: 35, sa: 25, el: 140, ha: 18, tilt: 20, hf: 112, kn: 125, an: 34}},
  smithsquat: {eq: 'bar', props: [['rails']], view: [40, 8], A: {...RACK, ha: 10}, B: {...RACK, ha: 14, tilt: 30, hf: 112, kn: 112, an: 28}},
  hack: {eq: 'none', props: [['pad', {w: 0.5, h: 1.0, d: 0.08, y: 1.05, z: -0.2, rx: -20}], ['rails', {w: 0.4}]], view: [60, 6],
    A: {tilt: -15, hf: -5, kn: 15, sa: 30, el: 100, sf: -10}, B: {tilt: -15, hf: 95, kn: 110, an: 25, sa: 30, el: 100, sf: -10}},
  lunge: {eq: 'dbn', view: [75, 6], A: {sa: 6, el: 4, ha: 6}, B: {sa: 6, el: 4, ha: 6, hf: [88, -18], kn: [92, 100], an: [28, -12]}},
  bss: {eq: 'dbn', props: [['bench', {len: 0.4, z: -0.45}]], view: [75, 6], A: {sa: 6, el: 4, hf: [8, -20], kn: [6, 95], an: [0, -45]}, B: {sa: 6, el: 4, tilt: 12, hf: [100, 2], kn: [100, 130], an: [30, -45]}},
  legpress: {eq: 'sled', ground: false, sledTilt: 50, props: [['pad', {w: 0.5, h: 0.08, d: 0.5, y: 0.42, z: -0.05}], ['pad', {w: 0.5, h: 0.75, d: 0.08, y: 0.72, z: -0.45, rx: -55}]], view: [80, 10],
    A: {root: [0, 0.55, 0, -55, 0], hf: 70, kn: 15, an: 10, sa: 25, el: 30}, B: {root: [0, 0.55, 0, -55, 0], hf: 140, kn: 110, an: 30, sa: 25, el: 30}},
  legext: {eq: 'none', ground: false, props: [['seat', {y: 0.5, backH: 0.65}]], view: [75, 8], A: {...SIT, sa: 18, el: 20}, B: {...SIT, kn: 5, an: -10, sa: 18, el: 20}},
  legcurl: {eq: 'none', ground: false, props: [['seat', {y: 0.5, backH: 0.65}]], view: [75, 8], A: {...SIT, kn: 5, sa: 18, el: 20}, B: {...SIT, kn: 100, sa: 18, el: 20}},
  lyingcurl: {eq: 'none', ground: false, props: [['bench', {len: 1.25, y: 0.62, z: 0.1}]], view: [80, 12], A: {root: [0, 0.75, -0.1, 90, 0], sf: 80, el: 60, sa: 30}, B: {root: [0, 0.75, -0.1, 90, 0], sf: 80, el: 60, sa: 30, kn: 115}},
  deadlift: {eq: 'bar', view: [75, 6], A: {sa: 6, el: 0, sf: 48, tilt: 48, hf: 115, kn: 85, an: 25, ha: 8}, B: {sa: 6, el: 0, ha: 8}},
  rdl: {eq: 'bar', view: [75, 6], A: {sa: 6, el: 0, kn: 10, hf: 10, ha: 8}, B: {sa: 6, el: 0, sf: 72, tilt: 72, hf: 85, kn: 20, an: 5, ha: 8}},
  dbrdl: {eq: 'dbn', view: [75, 6], A: {sa: 4, el: 0, kn: 10, hf: 10, ha: 8}, B: {sa: 4, el: 0, sf: 72, tilt: 72, hf: 85, kn: 20, an: 5, ha: 8}},
  singlerdl: {eq: 'dbn', view: [80, 6], A: {sa: 4, el: 0, kn: [10, 5], hf: [10, 0]}, B: {sa: 4, el: 0, sf: 85, tilt: 85, hf: [88, 0], kn: [18, 0], an: [5, 0]}},
  hipext: {eq: 'none', ground: false, props: [['pad', {w: 0.4, h: 0.12, d: 0.3, y: 0.85, z: 0.12, rx: 45}], ['pad', {w: 0.5, h: 0.05, d: 0.35, y: 0.3, z: -0.62, rx: 45}]], view: [80, 8],
    A: {root: [0, 1.0, 0.1, 45, 0], sf: 150, el: 120, sa: 40}, B: {root: [0, 1.0, 0.1, 45, 0], sf: 150, el: 120, sa: 40, tilt: 70, hf: 70}},
  nordic: {eq: 'none', view: [80, 6], ground: false, A: {root: [0, 0.6, 0, 0, 0], kn: 90, an: -40, sf: 0, el: 90, sa: 10}, B: {root: [0, 0.6, 0, 55, 0], kn: 35, an: -40, sf: 60, el: 60, sa: 10}},
  hipthrust: {eq: 'bar', props: [['bench', {len: 0.4, z: -0.55}]], view: [80, 8], A: {root: [0, 0.3, 0, -55, 0], hf: 60, kn: 120, an: 20, sf: 10, el: 10, sa: 20}, B: {root: [0, 0.55, 0, -88, 0], hf: -2, kn: 85, an: 10, sf: 10, el: 10, sa: 20}},
  glutebridge: {eq: 'bar', view: [80, 8], A: {root: [0, 0.12, 0, -90, 0], hf: 60, kn: 115, sf: 8, el: 6, sa: 22}, B: {root: [0, 0.35, 0, -110, 0], hf: 20, kn: 95, sf: 8, el: 6, sa: 22}},
  calf: {eq: 'none', props: [['box', {w: 0.6, h: 0.1, d: 0.25, z: 0.06}]], view: [70, 4], A: {an: 15, sa: 30, el: 100, sf: -15, sr: 70}, B: {an: -30, sa: 30, el: 100, sf: -15, sr: 70}},
  seatedcalf: {eq: 'none', ground: false, props: [['seat', {y: 0.48, back: false}]], view: [75, 6], A: {...SIT, root: [0, 0.65, 0, 0, 0], an: 20, sf: 35, el: 60, tilt: 10}, B: {...SIT, root: [0, 0.65, 0, 0, 0], an: -25, sf: 35, el: 60, tilt: 10}},
  /* chest */
  bench: {eq: 'bar', ground: false, props: [['bench']], view: [65, 22], A: {root: LIE(0.58), ...BENCH_LEGS, sf: 90, sa: 14, el: 4}, B: {root: LIE(0.58), ...BENCH_LEGS, sf: 40, sa: 62, el: 92, sr: -20}},
  dbbench: {eq: 'db', ground: false, props: [['bench']], view: [65, 22], A: {root: LIE(0.58), ...BENCH_LEGS, sf: 90, sa: 10, el: 4}, B: {root: LIE(0.58), ...BENCH_LEGS, sf: 30, sa: 62, el: 95, sr: -20}},
  incline: {eq: 'db', ground: false, props: [['incline', {inc: 38}]], view: [65, 14], A: {root: [0, 0.62, -0.05, -52, 0], hf: 40, kn: 85, ha: 18, sf: 95, sa: 10, el: 4}, B: {root: [0, 0.62, -0.05, -52, 0], hf: 40, kn: 85, ha: 18, sf: 40, sa: 60, el: 95, sr: -20}},
  pushup: {eq: 'none', hands: [0, 0.04, 0.0], view: [70, 12], A: {root: [0, 0.5, 0, 74, 0], sf: 76, sa: 14, el: 2}, B: {root: [0, 0.5, 0, 86, 0], sf: 30, sa: 30, el: 95}},
  dips: {eq: 'none', props: [['pbars']], hands: [0, 1.25, 0.1], view: [65, 6], A: {sf: -5, sa: 14, el: 4, hf: 20, kn: 70, tilt: 8}, B: {sf: -50, sa: 18, el: 95, hf: 30, kn: 75, tilt: 22}},
  cablefly: {eq: 'cable2', props: [['tower', {x: 0.9, y: 1.85, z: -0.25}], ['tower', {x: -0.9, y: 1.85, z: -0.25}]], view: [25, 8],
    A: {sa: 75, sf: 15, el: 15, tilt: 10, hf: [25, -10], kn: [20, 5]}, B: {sa: 20, sf: 55, sr: 0, el: 15, tilt: 10, hf: [25, -10], kn: [20, 5]}},
  pecdeck: {eq: 'grip', ground: false, props: [['seat', {y: 0.48, backH: 0.75}]], view: [30, 14], A: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 82, sf: 10, el: 80, sr: 75}, B: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 40, sf: 70, el: 80, sr: 75}},
  chestpress: {eq: 'grip', ground: false, props: [['seat', {y: 0.48, backH: 0.75}]], view: [55, 10], A: {...SIT, root: [0, 0.65, 0, 0, 0], sf: 40, sa: 55, el: 100, sr: -15}, B: {...SIT, root: [0, 0.65, 0, 0, 0], sf: 82, sa: 18, el: 6}},
  /* shoulders */
  ohp: {eq: 'bar', view: [40, 6], A: {sf: 35, sa: 65, el: 130, sr: 60, ha: 8}, B: {sf: 170, sa: 15, el: 10, ha: 8}},
  dbohp: {eq: 'db', ground: false, props: [['seat', {y: 0.48, backH: 0.75}]], view: [35, 8], A: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 80, sr: 80, el: 95, sf: 5}, B: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 160, el: 10, sf: 10}},
  machpress: {eq: 'grip', ground: false, props: [['seat', {y: 0.48, backH: 0.75}]], view: [35, 8], A: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 80, sr: 80, el: 95, sf: 10}, B: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 155, el: 12, sf: 12}},
  latraise: {eq: 'dbn', view: [10, 6], A: {sa: 10, el: 12, ha: 8}, B: {sa: 85, el: 12, ha: 8}},
  /* back */
  pullup: {eq: 'none', props: [['bar', {y: 2.3}]], hands: [0, 2.3, 0], view: [200, 8], A: {sa: 160, el: 6, hf: 15, kn: 60}, B: {sa: 55, sr: 80, el: 115, hf: 15, kn: 60}},
  chinup: {eq: 'none', props: [['bar', {y: 2.3}]], hands: [0, 2.3, 0.02], view: [70, 8], A: {sf: 175, sa: 10, el: 4, hf: 15, kn: 60}, B: {sf: 45, sa: 15, el: 140, hf: 20, kn: 60, tilt: -8}},
  latpull: {eq: 'cable', handle: 1.0, ground: false, props: [['seat', {y: 0.48, back: false}], ['tower', {y: 2.25, z: 0.05, back: 0.35}]], view: [200, 10],
    A: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 155, el: 8}, B: {...SIT, root: [0, 0.65, 0, 0, 0], sa: 60, sr: 80, el: 115, tilt: -12}},
  cablerow: {eq: 'cable', handle: 0.25, ground: false, props: [['box', {w: 0.4, h: 0.35, d: 0.5, z: -0.05}], ['tower', {y: 0.45, z: 1.15, back: 0.12}], ['pad', {w: 0.5, h: 0.3, d: 0.08, y: 0.18, z: 0.95, rx: -15}]], view: [80, 10],
    A: {root: [0, 0.5, 0, 22, 0], hf: 90, kn: 35, an: -10, sf: 85, sa: 6, el: 2}, B: {root: [0, 0.5, 0, -6, 0], hf: 60, kn: 35, an: -10, sf: 15, sa: 8, el: 105}},
  row: {eq: 'bar', view: [75, 8], A: {sa: 8, sf: 55, el: 0, tilt: 55, hf: 75, kn: 25, an: 8, ha: 8}, B: {sa: 25, sf: 5, el: 100, tilt: 55, hf: 75, kn: 25, an: 8, ha: 8}},
  dbrow: {eq: 'dbn', one: true, props: [['bench', {len: 0.9, x: -0.25, z: 0.45}]], view: [70, 12], A: {sa: [6, 8], sf: [80, 80], el: [0, 0], tilt: 78, hf: [85, 70], kn: [15, 40], ha: [10, 4]}, B: {sa: [15, 8], sf: [20, 80], el: [100, 0], tilt: 78, hf: [85, 70], kn: [15, 40], ha: [10, 4]}},
  straightpd: {eq: 'cable', handle: 0.5, props: [['tower', {y: 2.1, z: 0.75, back: 0.1}]], view: [75, 8], A: {sf: 110, sa: 10, el: 15, tilt: 25, hf: 30, kn: 15}, B: {sf: 5, sa: 10, el: 10, tilt: 25, hf: 30, kn: 15}},
  /* arms */
  curl: {eq: 'db', view: [35, 6], A: {sa: 6, el: 4, ha: 8}, B: {sa: 6, el: 135, sf: 10, ha: 8}},
  barcurl: {eq: 'bar', barLen: 1.5, plate: 0.15, view: [35, 6], A: {sa: 10, el: 4, ha: 8}, B: {sa: 10, el: 135, sf: 10, ha: 8}},
  hammer: {eq: 'dbn', view: [35, 6], A: {sa: 6, el: 4, ha: 8}, B: {sa: 6, el: 130, sf: 10, ha: 8}},
  cablecurl: {eq: 'cable', handle: 0.45, props: [['tower', {y: 0.15, z: 0.6, back: 0.1}]], view: [60, 6], A: {sa: 8, el: 4, sf: 8, ha: 8}, B: {sa: 8, el: 135, sf: 14, ha: 8}},
  inclinecurl: {eq: 'dbn', ground: false, props: [['incline', {inc: 55}]], view: [80, 8], A: {root: [0, 0.62, -0.02, -38, 0], hf: 50, kn: 80, ha: 14, sf: -30, el: 2, sa: 6}, B: {root: [0, 0.62, -0.02, -38, 0], hf: 50, kn: 80, ha: 14, sf: -20, el: 135, sa: 6}},
  preacher: {eq: 'bar', barLen: 1.3, plate: 0.13, ground: false, props: [['seat', {y: 0.48, back: false}], ['pad', {w: 0.55, h: 0.05, d: 0.34, y: 1.04, z: 0.2, rx: 50}]], view: [70, 10],
    A: {...SIT, root: [0, 0.65, 0, 0, 0], sf: 50, sa: 12, el: 8, tilt: 10}, B: {...SIT, root: [0, 0.65, 0, 0, 0], sf: 50, sa: 12, el: 125, tilt: 10}},
  conc: {eq: 'dbn', one: true, ground: false, props: [['box', {w: 0.4, h: 0.45, d: 0.4}]], view: [40, 8], A: {root: [0, 0.6, 0, 0, 0], tilt: 40, hf: [122, 122], ha: [25, 25], kn: [95, 95], sf: [45, 40], sa: [5, 20], el: [5, 60]}, B: {root: [0, 0.6, 0, 0, 0], tilt: 40, hf: [122, 122], ha: [25, 25], kn: [95, 95], sf: [45, 40], sa: [5, 20], el: [125, 60]}},
  triext: {eq: 'db1', view: [70, 6], A: {sf: 170, sa: 8, el: 150, ha: 8}, B: {sf: 170, sa: 8, el: 10, ha: 8}},
  ropeoh: {eq: 'rope', props: [['tower', {y: 0.6, z: -0.6, back: -0.1}]], view: [75, 6], A: {sf: 160, sa: 10, el: 140, tilt: 25, hf: [45, -5], kn: [40, 10]}, B: {sf: 145, sa: 10, el: 10, tilt: 25, hf: [45, -5], kn: [40, 10]}},
  pushdown: {eq: 'cable', handle: 0.32, props: [['tower', {y: 2.1, z: 0.45, back: 0.1}]], view: [65, 6], A: {sf: 8, sa: 6, el: 110, tilt: 10, hf: 10, kn: 8, ha: 8}, B: {sf: 8, sa: 6, el: 4, tilt: 10, hf: 10, kn: 8, ha: 8}},
  skull: {eq: 'bar', barLen: 1.3, plate: 0.13, ground: false, props: [['bench']], view: [70, 20], A: {root: LIE(0.58), ...BENCH_LEGS, sf: 100, sa: 10, el: 6}, B: {root: LIE(0.58), ...BENCH_LEGS, sf: 115, sa: 10, el: 120}},
  cgbench: {eq: 'bar', ground: false, props: [['bench']], view: [65, 22], A: {root: LIE(0.58), ...BENCH_LEGS, sf: 90, sa: 4, el: 4}, B: {root: LIE(0.58), ...BENCH_LEGS, sf: 30, sa: 18, el: 100}},
  /* core */
  cablecrunch: {eq: 'rope', props: [['tower', {y: 2.1, z: 0.45, back: 0.1}]], view: [75, 8], A: {tilt: 8, hf: -5, kn: 92, an: -50, sf: 165, sa: 15, el: 145, sp: 0}, B: {tilt: 28, hf: 22, kn: 92, an: -50, sf: 155, sa: 15, el: 145, sp: 35}},
};
/* Exercises that move the same way share a pose. */
const SAME = {walklunge: 'lunge', splitsquat: 'lunge', legext1: 'legext', dbthrust: 'hipthrust', singlebridge: 'glutebridge', lpcalf: 'calf', dbcalf: 'calf',
  inclinebar: 'incline', smithbench: 'bench', smithincl: 'incline', inclinemach: 'chestpress', arnold: 'dbohp', smithohp: 'dbohp', seatedlat: 'latraise', cablelat: 'latraise',
  closepull: 'latpull', onearmpull: 'latpull', tbar: 'row', onearmrow: 'cablerow', machinerow: 'cablerow', ezcurl: 'barcurl', cablecurl1: 'cablecurl',
  pushdown1: 'pushdown', ezskull: 'skull', triext1: 'triext', revpec: 'pecdeck'};
for (const [a, b] of Object.entries(SAME)) P[a] = P[b];
P.inclinebar = {...P.incline, eq: 'bar'}; P.smithincl = {...P.incline, eq: 'bar', props: [...P.incline.props, ['rails', {w: 0.6}]]};
P.smithbench = {...P.bench, props: [['bench'], ['rails', {w: 0.6}]]};
export const POSES = P;
