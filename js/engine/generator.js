/**
 * Workout generator: builds today's session from muscle recovery, the
 * equipment in the selected gym, the time available and the chosen focus.
 *
 * 1. Pick the focus. "Auto" trains the whole body when upper and lower body
 *    are both recovered, otherwise the fresher half.
 * 2. Walk the focus's slot list (compound patterns first, then isolation).
 *    A slot is skipped when its muscles are still tired or already got their
 *    weekly sets.
 * 3. Fill each slot with the best available exercise: familiar exercises and
 *    free weights for the main lifts score higher, last session's picks score
 *    lower for variety, and a seeded jitter lets "shuffle" give new picks.
 * 4. Stop when the time budget is used.
 *
 * Pure function: same inputs and seed give the same workout.
 */
import {EX, MUSCLES, MUSCLE_INFO, PATTERNS, canDo, isCompound, primary} from '../data/catalog.js';
import {recovery, weeklySets} from './recovery.js';

export const FOCUS = {
  auto: {n: 'Auto'},
  full: {n: 'Całe ciało'},
  upper: {n: 'Góra'},
  lower: {n: 'Dół'},
  push: {n: 'Push'},
  pull: {n: 'Pull'},
  legs: {n: 'Nogi'},
};

const UPPER = ['chest', 'back', 'delts', 'biceps', 'triceps'];
const LOWER = ['quads', 'hams', 'glutes'];
const REAR_DELT = ['facepull', 'revpec'];
/** Pattern exercises that work better as accessories than as the main lift. */
const ACCESSORY = ['straightpd', 'stepup', 'pushup', 'hack'];

/** Muscles a movement pattern mainly loads (used for readiness checks). */
export const PATTERN_MUSCLES = {knee: ['quads', 'glutes'], hinge: ['hams', 'glutes'], hpush: ['chest'], vpush: ['delts'], hpull: ['back'], vpull: ['back']};

const SLOTS = {
  full: [{p: 'knee'}, {p: 'hpush'}, {p: 'hpull'}, {p: 'hinge'}, {p: 'vpull'}, {p: 'vpush'}, {m: 'delts'}, {m: 'biceps'}, {m: 'triceps'}, {m: 'calves'}, {m: 'abs'}],
  upper: [{p: 'hpush'}, {p: 'hpull'}, {p: 'vpush'}, {p: 'vpull'}, {m: 'chest'}, {m: 'delts'}, {m: 'biceps'}, {m: 'triceps'}, {m: 'delts', rear: 1}, {m: 'abs'}],
  lower: [{p: 'knee'}, {p: 'hinge'}, {p: 'knee'}, {m: 'hams'}, {m: 'quads'}, {m: 'calves'}, {m: 'glutes'}, {m: 'abs'}],
  push: [{p: 'hpush'}, {p: 'vpush'}, {p: 'hpush'}, {m: 'chest'}, {m: 'delts'}, {m: 'triceps'}, {m: 'triceps'}],
  pull: [{p: 'vpull'}, {p: 'hpull'}, {p: 'hpull'}, {m: 'delts', rear: 1}, {m: 'biceps'}, {m: 'biceps'}, {m: 'abs'}],
  legs: [{p: 'knee'}, {p: 'hinge'}, {p: 'knee'}, {m: 'hams'}, {m: 'quads'}, {m: 'glutes'}, {m: 'calves'}],
};
const MAX_EX = {30: 4, 45: 6, 60: 7, 75: 8, 90: 9};
const WARMUP_S = 8 * 60;

/** Deterministic PRNG (mulberry32) so a seed reproduces the same workout. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const avg = (rec, ms) => ms.reduce((a, m) => a + rec[m].pct, 0) / ms.length;

/** Choose the focus for "Auto". Returns {focus, light}. */
export function autoFocus(rec) {
  const u = avg(rec, UPPER), l = avg(rec, LOWER);
  if (u >= 85 && l >= 85) return {focus: 'full', light: false};
  if (Math.max(u, l) < 60) return {focus: 'full', light: true};
  return {focus: u >= l ? 'upper' : 'lower', light: false};
}

/** Sets, rep range and rest for an exercise in a given slot position. */
export function prescribe(ex, {main = false, short = false} = {}) {
  if (ex.unit === 's') return {sets: 3, lo: 30, hi: 60, rest: 60};
  if (ex.p === 'core') return {sets: 3, lo: 10, hi: 15, rest: 60};
  if (['latraise', 'cablelat', 'revpec', 'facepull', 'calf', 'seatedcalf'].includes(ex.id)) return {sets: 3, lo: 12, hi: 20, rest: 60};
  if (ex.id === 'deadlift') return {sets: 3, lo: 5, hi: 8, rest: 180};
  if (main) return {sets: short ? 3 : 4, lo: 6, hi: 10, rest: ex.kind === 'bar' ? 180 : 150};
  if (isCompound(ex)) return {sets: 3, lo: 8, hi: 12, rest: ex.kind === 'machine' || ex.kind === 'cable' ? 105 : 120};
  return {sets: 3, lo: 10, hi: 15, rest: 75};
}

/** Estimated seconds for an exercise: sets × (rest + ~40 s of work). */
export const exSeconds = it => it.sets * (it.rest + 40);

function candidates(slot, pool, used) {
  let c;
  if (slot.p) c = pool.filter(ex => ex.p === slot.p && !REAR_DELT.includes(ex.id));
  else if (slot.rear) c = pool.filter(ex => REAR_DELT.includes(ex.id));
  else {
    c = pool.filter(ex => primary(ex).includes(slot.m) && !isCompound(ex));
    if (!c.length) c = pool.filter(ex => primary(ex).includes(slot.m));
  }
  return c.filter(ex => !used.has(ex.id));
}

function score(ex, {main, known, lastIds, recentIds, rand}) {
  let s = rand() * 1.2;
  if (known.has(ex.id)) s += 1.2;
  if (recentIds.has(ex.id)) s -= 2;
  else if (lastIds.has(ex.id)) s -= 0.8;
  if (main) s += ({bar: 1, db: 0.6, machine: 0.3, cable: 0.2, bw: 0.1}[ex.kind] || 0) - (ACCESSORY.includes(ex.id) ? 1.5 : 0);
  else if (ACCESSORY.includes(ex.id)) s -= 0.5;
  else s += {db: 0.3, machine: 0.3, cable: 0.3, bar: 0.1, bw: 0}[ex.kind] || 0;
  return s;
}

/**
 * Generate a workout.
 * @param {object} o
 * @param {Array}  o.workouts   logged workouts
 * @param {string[]} o.equipment equipment ids available
 * @param {number} o.duration   minutes (30/45/60/75/90)
 * @param {string} o.focus      key of FOCUS
 * @param {number} o.seed       shuffle seed
 * @param {boolean} o.deload    halve the sets
 * @param {string[]} o.exclude  exercise ids never to pick
 * @param {number|Date} o.now
 */
export function generate({workouts = [], equipment = [], duration = 60, focus = 'auto', seed = 1, deload = false, exclude = [], now = Date.now()} = {}) {
  const rec = recovery(workouts, now);
  const week = weeklySets(workouts, now);
  let f = focus, light = false;
  if (focus === 'auto') ({focus: f, light} = autoFocus(rec));
  const manual = focus !== 'auto';
  const minReady = manual || light ? 35 : 60;
  const rand = rng(seed);
  const pool = Object.values(EX).filter(ex => canDo(ex, equipment) && !exclude.includes(ex.id));
  const sorted = [...workouts].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const known = new Set(sorted.flatMap(w => w.ex.map(e => e.id)));
  const lastIds = new Set(sorted[0] ? sorted[0].ex.map(e => e.id) : []);
  const nowMs = +new Date(now);
  const recentIds = new Set(sorted.filter(w => nowMs - +new Date(w.date) < 48 * 36e5).flatMap(w => w.ex.map(e => e.id)));
  const budget = duration * 60 - WARMUP_S;
  const maxEx = MAX_EX[duration] || 7;
  const used = new Set();
  const items = [];
  const skipped = [];
  let time = 0;
  let mainDone = 0;
  for (const slot of SLOTS[f]) {
    if (items.length >= maxEx || time >= budget) break;
    const muscles = slot.p ? PATTERN_MUSCLES[slot.p] : [slot.m];
    const ready = Math.min(...muscles.map(m => rec[m].pct));
    if (ready < minReady) { skipped.push({slot, why: 'regeneracja'}); continue; }
    const tm = MUSCLE_INFO[muscles[0]].target[1];
    if (!manual && !slot.p && week[muscles[0]] >= tm) { skipped.push({slot, why: 'objętość'}); continue; }
    const cand = candidates(slot, pool, used);
    if (!cand.length) { skipped.push({slot, why: 'sprzęt'}); continue; }
    const main = !!slot.p && mainDone < 2;
    let best = null, bestS = -Infinity;
    for (const ex of cand) {
      const s = score(ex, {main, known, lastIds, recentIds, rand});
      if (s > bestS) { bestS = s; best = ex; }
    }
    const rx = prescribe(best, {main: main && mainDone === 0, short: duration <= 30});
    let sets = rx.sets;
    if (ready < 80 || light) sets = Math.max(2, sets - 1);
    if (deload) sets = Math.max(1, Math.ceil(sets / 2));
    const it = {id: best.id, sets, lo: rx.lo, hi: rx.hi, rest: rx.rest, why: whyText(muscles[0], rec, week)};
    if (items.length >= 3 && time + exSeconds(it) > budget + 120) break;
    items.push(it);
    used.add(best.id);
    time += exSeconds(it);
    if (slot.p) mainDone++;
  }
  return {
    focus: f,
    auto: focus === 'auto',
    light,
    title: FOCUS[f].n,
    items,
    skipped,
    estMin: Math.round((time + WARMUP_S) / 60),
  };
}

function whyText(m, rec, week) {
  const r = rec[m];
  const t = MUSCLE_INFO[m].target;
  const w = Math.round(week[m] * 10) / 10;
  if (w < t[0]) return MUSCLES[m] + ': ' + r.pct + '% regeneracji, ' + String(w).replace('.', ',') + ' z ' + t[0] + '+ serii w tym tygodniu';
  return MUSCLES[m] + ': ' + r.pct + '% regeneracji';
}

/**
 * Exercises that can replace `id` with the given equipment: same movement
 * pattern for compounds, same primary muscle for isolation work.
 */
export function alternatives(id, equipment, usedIds = []) {
  const ex = EX[id];
  const prim = primary(ex);
  const used = new Set(usedIds);
  return Object.values(EX)
    .filter(o => o.id !== id && !used.has(o.id) && canDo(o, equipment))
    .map(o => {
      let s = 0;
      if (isCompound(ex) && o.p === ex.p) s += 3;
      const shared = primary(o).filter(m => prim.includes(m)).length;
      s += shared * 2;
      if (!isCompound(ex) && !isCompound(o)) s += 1;
      if ((ex.alt || []).includes(o.id)) s += 1.5;
      return {o, s};
    })
    .filter(x => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(x => x.o.id);
}

/** Pattern labels for display. */
export const patternName = p => (PATTERNS.find(x => x[0] === p) || ['', ''])[1];
