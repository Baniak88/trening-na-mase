/**
 * Muscle recovery model.
 *
 * Every logged set adds fatigue to the muscles it trains (secondary muscles
 * count half). Fatigue fades linearly to zero over the muscle's recovery
 * window: 72 h for big muscles, 48 h for arms and shoulders, 36 h for calves
 * and abs. Several workouts combine as independent sources:
 * fatigue = 1 − Π(1 − fᵢ).
 *
 * Everything is derived from the workout log, so there is no stored state to
 * get out of sync.
 */
import {EX, MUSCLES, MUSCLE_INFO} from '../data/catalog.js';

/** Fatigue added by one hard working set on its primary muscle. */
export const FATIGUE_PER_SET = 0.13;
const MAX_SESSION_FATIGUE = 0.95;
const HOUR = 36e5;

const toMs = t => (typeof t === 'number' ? t : +new Date(t));

/** Weighted set count per muscle for one workout (deload weeks count half). */
export function muscleDose(workout) {
  const dose = {};
  for (const e of workout.ex || []) {
    const ex = EX[e.id];
    if (!ex) continue;
    const n = (e.sets || []).length * (workout.deload ? 0.5 : 1);
    for (const m in ex.m) dose[m] = (dose[m] || 0) + ex.m[m] * n;
  }
  return dose;
}

/**
 * Recovery of every muscle at `now`.
 * @returns {Record<string,{pct:number,readyIn:number,last:number|null}>}
 *   pct: 0–100 (100 = fully recovered), readyIn: hours until fully recovered,
 *   last: timestamp of the last workout that trained the muscle.
 */
export function recovery(workouts, now = Date.now()) {
  const nowMs = toMs(now);
  const acc = {};
  for (const m in MUSCLES) acc[m] = {fresh: 1, readyIn: 0, last: null};
  for (const w of workouts || []) {
    const t = toMs(w.end || w.date);
    const dt = (nowMs - t) / HOUR;
    if (!(dt >= 0)) continue;
    const dose = muscleDose(w);
    for (const m in dose) {
      const a = acc[m];
      if (!a) continue;
      if (a.last === null || t > a.last) a.last = t;
      const H = MUSCLE_INFO[m].h;
      if (dt >= H) continue;
      const f = Math.min(MAX_SESSION_FATIGUE, dose[m] * FATIGUE_PER_SET) * (1 - dt / H);
      a.fresh *= 1 - f;
      a.readyIn = Math.max(a.readyIn, H - dt);
    }
  }
  const out = {};
  for (const m in acc) out[m] = {pct: Math.round(acc[m].fresh * 100), readyIn: Math.ceil(acc[m].readyIn), last: acc[m].last};
  return out;
}

/** 'ready' ≥ 85 %, 'partial' 60–84 %, 'tired' below 60 %. */
export const status = pct => (pct >= 85 ? 'ready' : pct >= 60 ? 'partial' : 'tired');

/** Weighted sets per muscle over the last `days` days (secondary muscles count half). */
export function weeklySets(workouts, now = Date.now(), days = 7) {
  const from = toMs(now) - days * 24 * HOUR;
  const out = {};
  for (const m in MUSCLES) out[m] = 0;
  for (const w of workouts || []) {
    const t = toMs(w.end || w.date);
    if (t < from || t > toMs(now)) continue;
    const dose = muscleDose({...w, deload: false});
    for (const m in dose) if (m in out) out[m] += dose[m];
  }
  return out;
}
