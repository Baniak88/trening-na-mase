/**
 * Load progression.
 *
 * Double progression: keep the weight until every set reaches the top of the
 * rep range, then add the exercise's increment. After a long break (over four
 * weeks) start at 90 % of the last top weight. Deload weeks use 90 % and the
 * bottom of the range.
 */
import {EX} from '../data/catalog.js';

const DAY = 864e5;
const toMs = t => (typeof t === 'number' ? t : +new Date(t));

/** Epley estimate of the one-rep max. */
export const e1rm = (kg, reps) => (kg || 0) * (1 + (reps || 0) / 30);
/** Load that leaves `rir` reps in reserve at `reps` reps, from an estimated 1RM. */
export const loadFor = (oneRm, reps, rir = 2) => oneRm / (1 + (reps + rir) / 30);

/** Smallest practical weight step for the exercise. */
export const stepOf = ex => (ex.kind === 'bar' ? 2.5 : ex.inc || 2.5);
export const roundLoad = (ex, kg) => {
  const s = stepOf(ex);
  return Math.max(0, Math.round(kg / s) * s);
};

/** Sessions with this exercise, oldest first. Deload workouts are skipped unless `all`. */
export function sessionsOf(workouts, exId, all = false) {
  return (workouts || [])
    .filter(w => (all || !w.deload) && (w.ex || []).some(e => e.id === exId))
    .sort((a, b) => toMs(a.date) - toMs(b.date))
    .map(w => ({date: w.date, sets: w.ex.find(e => e.id === exId).sets}));
}

/** Best estimated 1RM for the exercise (all time). */
export function bestE1rm(workouts, exId) {
  let best = 0;
  for (const s of sessionsOf(workouts, exId, true)) for (const x of s.sets) best = Math.max(best, e1rm(x.kg, x.reps));
  return best;
}

/**
 * Suggested load for a planned exercise.
 * @param item {id, sets, lo, hi}
 * @returns {kg:number|null, up:boolean, first:boolean, deload:boolean, lastSets:Array|null, text:string}
 */
export function suggestLoad(workouts, item, {deload = false, now = Date.now()} = {}) {
  const ex = EX[item.id];
  const secs = ex.unit === 's';
  const unit = secs ? ' s' : '';
  const kgTxt = kg => (ex.kind === 'bw' ? (kg ? '+' + fmt(kg) + ' kg' : 'masa ciała') : fmt(kg) + ' kg' + (ex.kind === 'db' ? ' na hantel' : ''));
  const hist = sessionsOf(workouts, item.id);
  const last = hist[hist.length - 1];
  if (!last) {
    return {kg: ex.kind === 'bw' ? 0 : null, up: false, first: true, deload: false, lastSets: null,
      text: ex.kind === 'bw'
        ? 'Pierwszy raz: bez obciążenia, ile się da w zakresie ' + item.lo + '–' + item.hi + unit + '.'
        : 'Pierwszy raz: dobierz ciężar na ' + item.lo + '–' + item.hi + unit + ' z zapasem 2–3 powtórzeń.'};
  }
  const top = Math.max(...last.sets.map(s => s.kg || 0));
  const lastStr = kgTxt(top) + ' × ' + last.sets.map(s => s.reps).join('/') + unit;
  if (deload) {
    const kg = ex.kind === 'bw' ? 0 : roundLoad(ex, top * 0.9);
    return {kg, up: false, first: false, deload: true, lastSets: null, text: 'Tydzień lżejszy: ' + kgTxt(kg) + ', ' + item.lo + unit + ' powtórzeń, duży zapas.'};
  }
  const daysAgo = (toMs(now) - toMs(last.date)) / DAY;
  if (daysAgo > 28 && ex.kind !== 'bw') {
    const kg = roundLoad(ex, top * 0.9);
    return {kg, up: false, first: false, deload: false, lastSets: null, text: 'Ostatnio ' + lastStr + ', ponad 4 tygodnie temu. Wracasz od ' + kgTxt(kg) + '.'};
  }
  const allTop = last.sets.length >= Math.min(item.sets, 3) && last.sets.every(s => (s.reps || 0) >= item.hi && (s.kg || 0) >= top);
  if (allTop) {
    const kg = top + ex.inc;
    return {kg, up: true, first: false, deload: false, lastSets: last.sets, text: 'Ostatnio ' + lastStr + '. Góra zakresu w każdej serii, więc dziś ' + kgTxt(kg) + '.'};
  }
  return {kg: top, up: false, first: false, deload: false, lastSets: last.sets, text: 'Ostatnio ' + lastStr + '. Ten sam ciężar, celuj w ' + item.hi + unit + ' w każdej serii.'};
}

export const fmt = n => (n == null || n === '' ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
