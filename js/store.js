/**
 * Local storage of settings, gym profiles and the workout log.
 * Data stays on the phone; export and import move it between devices.
 */
import {EQUIPMENT, EX, MUSCLES, PLANS} from './data/catalog.js';

const KEY = 'tnm-v1';
const ALL = EQUIPMENT.map(e => e[0]);

export const defaultProfiles = () => [
  {id: 'gym', name: 'Siłownia', equip: [...ALL]},
  {id: 'home', name: 'Dom', equip: ['dumbbells', 'bench', 'pullup']},
];

export function defaultState() {
  return {
    v: 1,
    settings: {
      mode: 'auto', plan: 'fbw3', next: 0, profile: 'gym', duration: 60, focus: 'auto',
      bar: 20, bw: 80, subs: {}, exclude: [], cycleStart: null, welcomed: false, updatedAt: 0, dayPick: null,
    },
    profiles: defaultProfiles(),
    customPlans: [],
    workouts: [],
    draft: null,
    today: null,
  };
}

/**
 * Clean a user-built plan: known exercises only, sane numbers.
 * A weekly plan (week: true) ties each day to a weekday (wd, Monday = 0) and its muscle groups (mus).
 * Returns null when the input is not a plan.
 */
export function cleanPlan(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.days)) return null;
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  const week = !!p.week;
  const seen = new Set();
  let days = p.days.slice(0, 7).map((d, i) => {
    const o = {
      name: String((d && d.name) || 'Dzień ' + (i + 1)).slice(0, 24),
      ex: (d && Array.isArray(d.ex) ? d.ex : []).filter(e => e && EX[e.id]).slice(0, 15).map(e => {
        const lo = num(e.lo, 1, 100, 8);
        return {id: e.id, sets: num(e.sets, 1, 10, 3), lo, hi: Math.max(lo, num(e.hi, 1, 100, 12)), rest: num(e.rest, 15, 600, 90)};
      }),
    };
    if (week) { o.wd = num(d && d.wd, 0, 6, i); o.mus = (d && Array.isArray(d.mus) ? d.mus : []).filter(m => MUSCLES[m]); }
    return o;
  });
  if (week) days = days.filter(d => !seen.has(d.wd) && seen.add(d.wd)).sort((a, b) => a.wd - b.wd);
  const out = {id: String(p.id || 'c' + Date.now().toString(36)), name: String(p.name || 'Mój plan').slice(0, 30), days};
  if (week) out.week = true;
  return out;
}

const o0 = v => (v && typeof v === 'object' ? v : {});
const validWorkout = w => w && typeof w.id === 'string' && w.date && Array.isArray(w.ex);

/** Bring any stored shape (this app or the earlier prototype) to the current one. */
export function migrate(d) {
  const s = defaultState();
  if (!d || typeof d !== 'object') return s;
  if (d.settings && typeof d.settings === 'object') {
    const o = d.settings;
    for (const k of ['mode', 'plan', 'next', 'profile', 'duration', 'focus', 'bar', 'bw', 'cycleStart', 'welcomed', 'updatedAt']) if (o[k] != null) s.settings[k] = o[k];
    if (o.subs && typeof o.subs === 'object') s.settings.subs = {...o.subs};
    if (Array.isArray(o.exclude)) s.settings.exclude = o.exclude.filter(id => EX[id]);
    if (o.plan === 'fbw') s.settings.plan = 'fbw3';
    if (o.plan === 'ul') s.settings.plan = 'ul4';
  }
  if (Array.isArray(d.customPlans)) s.customPlans = d.customPlans.map(cleanPlan).filter(Boolean);
  if (!PLANS[s.settings.plan] && !s.customPlans.some(p => p.id === s.settings.plan)) s.settings.plan = 'fbw3';
  for (const k in s.settings.subs) if (!EX[s.settings.subs[k]]) delete s.settings.subs[k];
  if (!['auto', 'plan'].includes(s.settings.mode)) s.settings.mode = 'auto';
  if (Array.isArray(d.profiles) && d.profiles.length) {
    s.profiles = d.profiles.filter(p => p && p.id && Array.isArray(p.equip)).map(p => ({id: String(p.id), name: String(p.name || 'Siłownia'), equip: p.equip.filter(e => ALL.includes(e))}));
    if (!s.profiles.length) s.profiles = defaultProfiles();
  }
  if (!s.profiles.some(p => p.id === s.settings.profile)) s.settings.profile = s.profiles[0].id;
  if (Array.isArray(d.workouts)) s.workouts = d.workouts.filter(validWorkout);
  if (o0(d.settings).dayPick && typeof d.settings.dayPick === 'object') s.settings.dayPick = {stamp: String(d.settings.dayPick.stamp), idx: +d.settings.dayPick.idx || 0};
  if (d.draft && Array.isArray(d.draft.ex)) s.draft = d.draft;
  if (d.today && Array.isArray(d.today.items)) s.today = d.today;
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (err) { /* private mode or corrupted data: start fresh */ }
  return defaultState();
}

let warned = false;
export function save(S) {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    return true;
  } catch (err) {
    if (!warned) { warned = true; console.warn('Zapis nie powiódł się', err); }
    return false;
  }
}

/** Ask the browser not to clear our data under storage pressure. */
export function persist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (err) { /* optional */ }
}

export function exportJSON(S) {
  return JSON.stringify({app: 'trening-na-mase', v: 1, exportedAt: new Date().toISOString(), settings: S.settings, profiles: S.profiles, customPlans: S.customPlans, workouts: S.workouts}, null, 1);
}

/**
 * Merge data from an export (this app or the prototype) into S.
 * Workouts are merged by id; settings are taken only when S has no workouts yet.
 * @returns {{added:number, total:number}}
 */
export function importData(S, text) {
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (err) { throw new Error('To nie jest plik z danymi treningów (zły format JSON).'); }
  if (!d || !Array.isArray(d.workouts)) throw new Error('W pliku nie ma listy treningów.');
  const incoming = migrate(d);
  const have = new Set(S.workouts.map(w => w.id));
  const fresh = incoming.workouts.filter(w => !have.has(w.id));
  if (!S.workouts.length) {
    const keepProfile = S.settings.profile;
    S.settings = {...S.settings, ...incoming.settings};
    if (Array.isArray(d.profiles)) S.profiles = incoming.profiles;
    else S.settings.profile = keepProfile;
  }
  const havePlans = new Set((S.customPlans || []).map(p => p.id));
  S.customPlans = (S.customPlans || []).concat(incoming.customPlans.filter(p => !havePlans.has(p.id)));
  S.workouts.push(...fresh);
  S.workouts.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return {added: fresh.length, total: S.workouts.length};
}
