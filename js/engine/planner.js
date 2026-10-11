/**
 * Weekly planner: the user picks muscle groups for each weekday and the
 * planner fills the day with evidence-backed exercises.
 *
 * Volume per muscle in one session (one session per muscle per week):
 * large muscles 6–9 sets, small ones 3–6 sets, fewer when the day trains
 * many groups, so a day stays at about 8 exercises or less.
 * Order: multi-joint lifts for large muscles first, isolation last.
 * Exercises for one muscle aim at different heads (e.g. triceps: overhead for the
 * long head, pushdown for the lateral and medial heads).
 *
 * Pure functions: same inputs and seed give the same day.
 */
import {EX, MUSCLES, canDo, isCompound, primary, usable} from '../data/catalog.js';
import {prescribe, rng} from './generator.js';
import {mainHeads} from '../data/heads.js';

export const WEEKDAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
export const WD_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const BIG = ['chest', 'back', 'quads', 'hams', 'glutes'];
const ORDER = ['quads', 'glutes', 'hams', 'chest', 'back', 'delts', 'triceps', 'biceps', 'calves'];
const MAX_EX = 8;
/** Fine as extra volume, weaker as a gym day's staple. */
const ACCESSORY = ['pushup', 'hack'];

/** Weekday index with Monday = 0. */
export const weekdayOf = (d = new Date()) => (new Date(d).getDay() + 6) % 7;

/** Default day name from its muscles, e.g. "Klatka + Biceps". */
export const dayName = mus => (mus.length ? mus.map(m => MUSCLES[m]).join(' + ') : 'Odpoczynek').slice(0, 24);

/** How many exercises a muscle gets on a day that trains `count` groups. */
export function exercisesFor(m, count) {
  if (BIG.includes(m)) return count <= 2 ? 3 : 2;
  return count <= 2 ? 2 : 1;
}

function score(ex, m, slot, picked, rand, seed) {
  let s = rand() * (seed === 1 ? 0.6 : 2.6);
  if (ex.ev && ex.ev.l === 'A') s += 0.8;
  const compound = isCompound(ex);
  // Large muscles: two multi-joint lifts, then isolation. Shoulders: a press, then raises. Arms and calves: isolation.
  const wantCompound = BIG.includes(m) ? slot < 2 : m === 'delts' ? slot === 0 : false;
  if (compound === wantCompound) s += 1.5;
  if (compound && picked.some(p => isCompound(p) && p.p === ex.p)) s -= 0.6; // e.g. a row after a pulldown
  if (!compound && picked.some(p => !isCompound(p) && primary(p).join() === primary(ex).join())) s -= 0.5;
  if (picked.some(p => p.kind === ex.kind)) s -= 0.4;
  if (slot > 0) {
    // Prefer a head of this muscle that the day does not train hard yet.
    const covered = new Set(picked.flatMap(p => mainHeads(p, m)));
    const mine = mainHeads(ex, m);
    if (mine.some(h => !covered.has(h))) s += 1;
    else if (mine.length) s -= 0.5;
  }
  const fam = e => e.base || e.id; // variants of one exercise (e.g. leg extension and its single-leg version)
  if (picked.some(p => fam(p) === fam(ex) || p.id === ex.base || ex.id === p.base)) s -= 1.5;
  if (ACCESSORY.includes(ex.id)) s -= 1.3;
  if (ex.id === 'seatedcalf') s -= 0.3; // standing raises grew the calves more (Kinoshita 2023)
  if (slot === 0 && compound) s += {bar: 0.5, db: 0.3, machine: 0.2, cable: 0.1, bw: 0}[ex.kind] || 0;
  return s;
}

/**
 * Exercises for one day.
 * @param {string[]} muscles muscle ids chosen for the day
 * @param {object} o
 * @param {string[]} o.equipment available equipment ids
 * @param {string[]} o.exclude exercise ids never to pick
 * @param {number} o.seed 1 = default picks, other values give alternatives
 * @returns {{id:string, sets:number, lo:number, hi:number, rest:number}[]}
 */
export function fillDay(muscles, {equipment = [], exclude = [], seed = 1} = {}) {
  const ms = ORDER.filter(m => muscles.includes(m));
  if (!ms.length) return [];
  const rand = rng(seed * 7919);
  const pool = Object.values(EX).filter(ex => usable(ex) && canDo(ex, equipment) && !exclude.includes(ex.id));
  const need = {};
  for (const m of ms) need[m] = exercisesFor(m, ms.length);
  const out = [];
  const used = new Set();
  for (const m of ms) {
    const picked = out.map(o => EX[o.id]).filter(ex => primary(ex).includes(m));
    while (need[m] > 0 && out.length < MAX_EX) {
      const cand = pool.filter(ex => !used.has(ex.id) && primary(ex).includes(m));
      if (!cand.length) break;
      let best = null, bestS = -Infinity;
      for (const ex of cand) { const s = score(ex, m, picked.length, picked, rand, seed); if (s > bestS) { bestS = s; best = ex; } }
      used.add(best.id); picked.push(best);
      out.push({id: best.id, m});
      for (const k of primary(best)) if (need[k] != null) need[k]--;
    }
  }
  // Multi-joint lifts first (large muscles in ORDER), then isolation.
  out.sort((a, b) => (isCompound(EX[b.id]) - isCompound(EX[a.id])) || ORDER.indexOf(a.m) - ORDER.indexOf(b.m));
  const small = ms.length >= 3;
  return out.map((o, i) => {
    const rx = prescribe(EX[o.id], {main: i === 0 && isCompound(EX[o.id])});
    return {id: o.id, sets: small && !BIG.includes(o.m) ? Math.min(rx.sets, 3) : rx.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest};
  });
}

/** Starting points for a weekly plan: weekday index -> muscles. */
export const PRESETS = [
  {id: 'split4', name: '4 dni: klatka + biceps, barki + triceps', days: {0: ['chest', 'biceps'], 1: ['quads', 'glutes', 'calves'], 3: ['delts', 'triceps'], 4: ['back', 'hams']}},
  {id: 'split3', name: '3 dni: góra, dół, góra', days: {0: ['chest', 'back', 'delts'], 2: ['quads', 'hams', 'glutes', 'calves'], 4: ['chest', 'back', 'biceps', 'triceps']}},
];

/** Build plan days from a weekday → muscles map. */
export function weekDays(map, opts) {
  return Object.keys(map).map(Number).sort((a, b) => a - b).map(wd => ({name: dayName(map[wd]), wd, mus: [...map[wd]], ex: fillDay(map[wd], opts)}));
}

/** The plan day for a weekday, or null on a rest day. */
export const dayFor = (days, wd) => days.find(d => d.wd === wd) || null;

/** Next training day after weekday `wd` (wraps around the week). */
export function nextDay(days, wd) {
  for (let k = 1; k <= 7; k++) { const d = dayFor(days, (wd + k) % 7); if (d) return {day: d, inDays: k}; }
  return null;
}
