/**
 * Front and back body map. Each muscle region is coloured by recovery:
 * green = ready, amber = partly recovered, red = still tired.
 * Drawn in a 100 × 230 box per view; the right half mirrors the left.
 */
import {status} from './engine/recovery.js';

/* Path helpers (y down, SVG coordinates). */
const f1 = v => (Math.round(v * 10) / 10).toString();
const M = pts => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join(' L') + 'Z';
/** Smooth closed path through points (Catmull-Rom to Bézier). */
function S(pts) {
  const n = pts.length; let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
  }
  return d + 'Z';
}
const mir = pts => pts.map(([x, y]) => [100 - x, y]).reverse();

/* Silhouette (left half, mirrored). */
const BODY_L = [[50, 3], [43.5, 5], [41, 12], [41.5, 20], [44, 26], [44.5, 31], [38, 34], [30, 37], [25, 42], [22.5, 50], [21, 62], [19.5, 74], [17.5, 86], [15.5, 98], [13.5, 108], [12, 114], [13.5, 119], [17, 118], [19.5, 110], [22.5, 98], [25.5, 86], [28.5, 74], [30.5, 66], [32, 80], [33, 96], [32.5, 108], [31.5, 122], [32.5, 140], [34.5, 160], [36, 172], [35, 186], [35.5, 202], [37, 214], [34, 222], [36, 226], [44, 226], [45, 219], [44.5, 206], [46, 188], [46.5, 172], [47.5, 156], [48.5, 136], [50, 126]];
const BODY = S(BODY_L.concat(mir(BODY_L.slice(1, -1))));

/* Muscle shapes for the left half; mirrored for the right. */
const FRONT = {
  delts: [[[31, 37], [26, 41], [23.5, 48], [24.5, 55], [28.5, 52], [32.5, 46], [35, 40]]],
  chest: [[[49, 41], [41, 39], [35, 41], [32.5, 48], [34, 55], [40, 58.5], [46.5, 58], [49, 55]]],
  biceps: [[[26, 57], [23.5, 63], [22.3, 72], [23.5, 79], [26.5, 77], [28.5, 69], [29, 60]]],
  forearms: [[[22, 84], [19.5, 92], [17.5, 101], [17.5, 106], [20.5, 103], [23, 94], [24.5, 86]]],
  abs: [[[49, 62], [42.5, 62.5], [41.5, 70], [42, 82], [43.5, 94], [46.5, 101], [49, 102]]],
  quads: [[[34, 120], [33, 134], [34.5, 150], [37.5, 163], [42, 168], [46, 163], [47, 148], [47.5, 132], [46, 120], [40, 116]]],
  calves: [[[36.5, 178], [36, 190], [37.5, 202], [40, 200], [41.5, 188], [40.5, 178]]],
};
const BACK = {
  back: [[[49, 30], [43, 32], [37, 36], [34.5, 44], [36, 56], [39.5, 70], [44, 82], [49, 88]]],
  delts: [[[31, 37], [26, 41], [23.5, 48], [24.5, 55], [28.5, 52], [32.5, 46], [35, 40]]],
  triceps: [[[29.5, 56], [25, 58], [22.5, 66], [22.6, 76], [25, 80], [28, 74], [30, 64]]],
  forearms: [[[22, 84], [19.5, 92], [17.5, 101], [17.5, 106], [20.5, 103], [23, 94], [24.5, 86]]],
  glutes: [[[49, 100], [42, 99], [35.5, 104], [34, 113], [37, 121], [44, 123], [49, 120]]],
  hams: [[[35, 126], [34.5, 140], [36.5, 155], [40.5, 164], [45, 162], [47, 148], [47.5, 132], [45, 125]]],
  calves: [[[35.5, 172], [34.5, 182], [36, 194], [39.5, 198], [43.5, 194], [45, 183], [44, 172], [40, 169]]],
};
/* Fine separation lines drawn over the muscles (left half). */
const LINES_FRONT = ['M49 70 L43 70', 'M49 79 L43.5 79', 'M49 88 L44.5 88', 'M40 128 C41 140 41.5 152 42.5 164'];
const LINES_BACK = ['M49 30 L49 88', 'M38 52 C41 60 44 66 48 70', 'M41 128 C41.5 142 42 152 42.5 162', 'M40 172 L40 196'];

function shape(pts, cls, m) {
  const a = ' class="mz ' + cls + '" data-m="' + m + '"';
  return '<path d="' + S(pts) + '"' + a + '/><path d="' + S(mir(pts)) + '"' + a + '/>';
}
function figure(regions, lines, rec, dx, label, classOf) {
  let out = '<g transform="translate(' + dx + ' 0)"><path d="' + BODY + '" class="bm-body"/>';
  for (const m in regions) {
    const cls = classOf ? classOf(m) : status((rec[m] || {pct: 100}).pct);
    if (!cls) continue;
    for (const pts of regions[m]) out += shape(pts, cls, m);
  }
  out += '<path d="' + lines.concat(lines.map(d => d.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (s0, x, y) => f1(100 - +x) + ' ' + y))).join(' ') + '" class="bm-sep"/>';
  return out + (label ? '<text x="50" y="242" text-anchor="middle" class="bm-label">' + label + '</text>' : '') + '</g>';
}

/** SVG with front (left) and back (right) views. Regions carry data-m for taps. */
export function bodyMap(rec) {
  return '<svg class="bodymap" viewBox="0 0 215 248" role="img" aria-label="Mapa regeneracji mięśni: przód i tył">' +
    figure(FRONT, LINES_FRONT, rec, 2, 'Przód') + figure(BACK, LINES_BACK, rec, 113, 'Tył') + '</svg>';
}

/**
 * Small map of the muscles a workout trains.
 * @param load {Record<string,number>} weighted sets per muscle
 */
export function targetMap(load) {
  const max = Math.max(1, ...Object.values(load));
  const classOf = m => (!load[m] ? null : load[m] >= max * 0.5 ? 'hit' : 'sec');
  return '<svg class="bodymap mini" viewBox="0 0 215 232" role="img" aria-label="Mięśnie w treningu">' +
    figure(FRONT, LINES_FRONT, {}, 2, '', classOf) + figure(BACK, LINES_BACK, {}, 113, '', classOf) + '</svg>';
}
