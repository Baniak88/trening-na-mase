/**
 * Front and back body map. Each muscle region is coloured by recovery:
 * green = ready, amber = partly recovered, red = still tired.
 */
import {status} from './engine/recovery.js';

const E = (cx, cy, rx, ry, rot) => ({t: 'e', cx, cy, rx, ry, rot: rot || 0});
const mirror = s => (s.t === 'e' ? {...s, cx: 100 - s.cx, rot: -s.rot} : {...s, d: s.dm});

/* Regions in a 100 × 230 box, x mirrored around 50. */
const FRONT = {
  delts: [E(29, 50, 8.5, 7.5, -20)],
  chest: [{t: 'p', d: 'M50 45 C44 43 37 44 34 50 C33 57 36 63 43 64 C47 64 50 62 50 58 Z', dm: 'M50 45 C56 43 63 44 66 50 C67 57 64 63 57 64 C53 64 50 62 50 58 Z'}],
  abs: [{t: 'p', d: 'M42 67 L58 67 L57 100 C55 106 45 106 43 100 Z'}],
  biceps: [E(23, 70, 5, 11, 12)],
  quads: [E(41, 140, 8.5, 24, 4)],
};
const BACK = {
  back: [{t: 'p', d: 'M50 41 C43 41 37 44 34 49 C35 60 38 72 43 84 L50 90 L57 84 C62 72 65 60 66 49 C63 44 57 41 50 41 Z'}],
  delts: [E(29, 50, 8.5, 7.5, -20)],
  triceps: [E(23, 70, 5.5, 12, 12)],
  glutes: [E(43.5, 108, 8, 9, 0)],
  hams: [E(41.5, 140, 7.5, 20, 4)],
  calves: [E(41.5, 184, 6, 14, 2)],
};

function base(fill) {
  const p = (d) => '<path d="' + d + '" fill="' + fill + '"/>';
  return '<circle cx="50" cy="18" r="11" fill="' + fill + '"/>' +
    p('M45 28 L55 28 L56 38 L44 38 Z') +
    p('M30 41 C38 37 62 37 70 41 C74 52 70 70 64 84 L62 110 C62 116 38 116 38 110 L36 84 C30 70 26 52 30 41 Z') +
    p('M24 45 C19 55 17 70 18 84 C18 96 16 104 17 110 L22 110 C24 102 25 94 27 84 C29 72 30 58 31 48 Z') +
    p('M76 45 C81 55 83 70 82 84 C82 96 84 104 83 110 L78 110 C76 102 75 94 73 84 C71 72 70 58 69 48 Z') +
    p('M38 108 C33 130 33 152 36 168 C35 185 35 200 37 214 L45 214 C46 200 47 185 47 168 C49 150 50 130 50 112 Z') +
    p('M62 108 C67 130 67 152 64 168 C65 185 65 200 63 214 L55 214 C54 200 53 185 53 168 C51 150 50 130 50 112 Z');
}

function shape(s, cls, m) {
  const a = ' class="mz ' + cls + '" data-m="' + m + '"';
  if (s.t === 'e') return '<ellipse cx="' + s.cx + '" cy="' + s.cy + '" rx="' + s.rx + '" ry="' + s.ry + '" transform="rotate(' + s.rot + ' ' + s.cx + ' ' + s.cy + ')"' + a + '/>';
  return '<path d="' + s.d + '"' + a + '/>';
}

function figure(regions, rec, dx, label) {
  let out = '<g transform="translate(' + dx + ' 0)">' + base('var(--body-base)');
  for (const m in regions) {
    const cls = status(rec[m].pct);
    for (const s of regions[m]) {
      out += shape(s, cls, m);
      const mir = mirror(s);
      if (s.t === 'e' || s.dm) out += shape(mir, cls, m);
    }
  }
  return out + '<text x="50" y="228" text-anchor="middle" class="bm-label">' + label + '</text></g>';
}

/** SVG with front (left) and back (right) views. Regions carry data-m for taps. */
export function bodyMap(rec) {
  return '<svg class="bodymap" viewBox="0 0 210 234" role="img" aria-label="Mapa regeneracji mięśni: przód i tył">' +
    figure(FRONT, rec, 0, 'Przód') + figure(BACK, rec, 110, 'Tył') + '</svg>';
}
