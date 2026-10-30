/* Mój Trener: UI. Only exercises with evidence of muscle growth are offered (catalog usable()). Screens: Trening (today / session), Regeneracja, Ćwiczenia, Postępy, Ustawienia, Wiedza. */
import {EX, MUSCLES, MUSCLE_INFO, PATTERNS, PLANS, CYCLE, KINDN, EQUIPMENT, KINDS, PHOTO_CREDIT, SOURCES, EV_NAME, TRAINABLE, canDo, primary, usable, listable, photoSrc, illSrc, ILL_CREDIT, VARIANT} from './data/catalog.js';
import {FC, figSVG, figBounds, visMark} from './figure.js';
import {recovery, weeklySets, status} from './engine/recovery.js';
import {generate, alternatives, prescribe, FOCUS, exSeconds} from './engine/generator.js';
import {suggestLoad, sessionsOf, e1rm, fmt} from './engine/progression.js';
import {WEEKDAYS, WD_SHORT, PRESETS, fillDay, dayName, weekDays, weekdayOf, nextDay} from './engine/planner.js';
import {load, save, persist, exportJSON, importData, defaultState, cleanPlan} from './store.js';
import {bodyMap, targetMap} from './bodymap.js';
import {HEADS, headName, headsOf, headWhy, mainHeads, headCoverage, LENS, LEN_NAME, lenOf} from './data/heads.js';
import {setLang, detectLang, addPairs, isEn, locale, T as tt} from './i18n.js';
import {EN_DATA} from './i18n/en-data.js';
import {POSES as POSES3D} from './data/poses3d.js';
import {PROVIDERS, aiReady, ask, buildSystem, parsePlan, stripPlan, md} from './ai.js';

/* ---------- Helpers ---------- */
const PLATES = [[25, '--p25', 44, 9], [20, '--p20', 44, 8], [15, '--p15', 40, 7], [10, '--p10', 34, 6], [5, '--p5', 26, 5], [2.5, '--p2', 22, 4], [1.25, '--p1', 18, 3]];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const num = v => { const q = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(q) ? q : null; };
const hms = s => { s = Math.max(0, Math.floor(s)); const hh = Math.floor(s / 3600); return hh ? hh + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') : mmss(s); };
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const clone = o => JSON.parse(JSON.stringify(o));
const roundTo = (v, s) => Math.round(v / s) * s;
const dateStr = iso => new Date(iso).toLocaleDateString(locale(), {weekday: 'short', day: 'numeric', month: 'short'});
const isS = ex => ex.unit === 's';
const kgTxt = (ex, kg) => (ex.kind === 'bw' ? (kg ? '+' + fmt(kg) + ' kg' : 'masa ciała') : fmt(kg) + ' kg' + (ex.kind === 'db' ? ' na hantel' : ''));
const unitHead = ex => (ex.kind === 'bw' ? '+kg' : ex.kind === 'db' ? 'kg/hantel' : 'kg');
const repTxt = (ex, n) => (isS(ex) ? n + ' s' : String(n));
const range = (ex, it) => it.lo + '–' + it.hi + (isS(ex) ? ' s' : '');
/** Native bridge when running inside the Android app (see android/). */
const ANDROID = window.TnmAndroid || null;
let GL_OK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const dayStamp = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
function weekStart(d = new Date()) { const q = new Date(d); q.setHours(0, 0, 0, 0); q.setDate(q.getDate() - ((q.getDay() + 6) % 7)); return q; }
function toast(t) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
const thumbK = ex => (ex.fig.static ? 0 : 0.62);
const boxes = {}, bigBoxes = {}, tightBoxes = {};
const bigBox = id => bigBoxes[id] || (bigBoxes[id] = figBounds(EX[id], 'auto'));
const tightBox = id => tightBoxes[id] || (tightBoxes[id] = figBounds(EX[id], 'auto', true));
const thumbCache = {};
const thumb = id => thumbCache[id] || (thumbCache[id] = EX[id].ek ? '<img class="ill" src="img/ekt/' + EX[id].ek + '.webp" alt="" loading="lazy" decoding="async">' : photoSrc(EX[id], 1) ? '<img src="' + photoSrc(EX[id], 1) + '" alt="" loading="lazy" decoding="async">' : EX[id].fig ? figSVG(id, thumbK(EX[id]), FC, boxes[id] || (boxes[id] = figBounds(EX[id], 4 / 3, true)), {}) : '<img src="' + photoSrc(EX[id], 1) + '" alt="" loading="lazy" decoding="async">');

/** "Triceps: głowa długa" for the first primary muscle that has heads. */
function headLine(ex) {
  const m = primary(ex).find(k => HEADS[k]); if (!m) return '';
  const hs = mainHeads(ex, m); if (!hs.length || hs.length === HEADS[m].length) return MUSCLES[m] + ': cały mięsień';
  return MUSCLES[m] + ': ' + hs.map(headName).join(', ');
}

/* ---------- State ---------- */
const S = load();
/** Interface language: the setting, or the device language when it is 'auto'. English texts are registered only when needed. */
function applyLang() {
  const l = detectLang(S.settings.lang);
  if (l === 'en' && !applyLang.done) {
    applyLang.done = true;
    addPairs(Object.values(EX).map(e => [e.n, e.en]));
    addPairs(EN_DATA);
    addPairs(Object.values(VARIANT));
    for (const e of Object.values(EX)) if (e.cuesPl) addPairs(e.cuesPl.map((c, i) => [c, e.cues[i]]));
  }
  setLang(l);
}
applyLang();
const applyTheme = () => { const t = S.settings.theme || 'navy'; if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; const mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.setAttribute('content', t === 'light' ? '#F2F2F7' : t === 'navy' ? '#1A1D29' : '#000000'); };
applyTheme();
if (!S.settings.cycleStart) S.settings.cycleStart = weekStart().toISOString();
const UI = {stack: [], permSwap: false, tab: S.draft && Date.now() - new Date(S.draft.started) < 12 * 3600e3 ? 'train' : 'home', sub: null, fromSettings: false, cur: null, sel: null, chartEx: null, openW: null, delW: null, summary: null, sheet: null,
  aq: '', at: {part: null, m: null, head: null, len: null}, am: 'all', ah: 'all', ak: 'all', all: true, onlyEv: false, mine: false, peWd: null, peSeed: 1, wuOpen: false, cfgOpen: false, editProfile: null, wipe: false};
let saveT = null;
function persistNow() { clearTimeout(saveT); save(S); }
function persistSoon() { clearTimeout(saveT); saveT = setTimeout(() => save(S), 400); }
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistNow(); });

const profile = () => S.profiles.find(p => p.id === S.settings.profile) || S.profiles[0];
const equip = () => profile().equip;
/* Built-in plans plus the ones the user builds (S.customPlans). */
const daysWord = n => (n === 1 ? 'dzień' : 'dni');
const customAsPlan = c => ({name: c.name, long: 'Twój plan · ' + c.days.length + ' ' + daysWord(c.days.length) + ' w tygodniu', level: c.week ? 'Dni tygodnia' : 'Własny', perWeek: c.days.length, days: c.days, custom: true, week: !!c.week});
function allPlans() { const o = {...PLANS}; for (const c of S.customPlans || []) o[c.id] = customAsPlan(c); return o; }
const plan = () => allPlans()[S.settings.plan] || PLANS.fbw3;
function cycleWeek() { const cs = weekStart(new Date(S.settings.cycleStart)); const diff = Math.round((weekStart() - cs) / (7 * 864e5)); return ((diff % 6) + 6) % 6; }
const cycle = () => CYCLE[cycleWeek()];

/* ---------- Today's workout ---------- */
function todayKey() {
  const st = S.settings;
  return [st.mode, profile().id, equip().join('.'), st.duration, st.focus, st.plan, st.next, S.workouts.length, cycleWeek(), dayStamp(), st.exclude.join('.'), JSON.stringify(st.subs), JSON.stringify(st.dayPick)].join('|');
}
/** Substitute plan exercises that the current gym can't do. */
function fitPlanItem(it, used) {
  let id = S.settings.subs[it.id] || it.id;
  let via = id !== it.id ? 'sub' : null;
  if (!canDo(EX[id], equip()) || S.settings.exclude.includes(id)) {
    const alt = alternatives(id, equip(), [...used]).filter(a => !S.settings.exclude.includes(a))[0];
    if (alt) { id = alt; via = 'equip'; } else return null;
  }
  return {...it, id, orig: it.id, via};
}
function ensureToday(force) {
  const key = todayKey();
  if (!force && S.today && S.today.key === key) return S.today;
  const seed = S.today ? S.today.seed || 1 : 1 + Math.floor(Math.random() * 1000);
  const deload = !!cycle().deload;
  if (S.settings.mode === 'plan') {
    const p = plan(); let idx;
    if (p.week) {
      // Weekly plan: today's weekday decides the day, unless the user picked another one for today.
      const wd = weekdayOf(); const pk = S.settings.dayPick;
      idx = pk && pk.stamp === dayStamp() && p.days[pk.idx] ? pk.idx : p.days.findIndex(d => d.wd === wd);
      if (idx < 0) {
        const n = nextDay(p.days, wd);
        S.today = {key, seed, mode: 'plan', rest: true, wd, next: n ? {idx: p.days.indexOf(n.day), inDays: n.inDays} : null, title: 'Dzień wolny', items: [], deload, estMin: 0};
        persistSoon(); return S.today;
      }
    } else idx = p.days.length ? S.settings.next % p.days.length : 0;
    const used = new Set(); const items = [];
    for (const it of (p.days[idx] || {ex: []}).ex) { const f = fitPlanItem(it, used); if (f) { items.push(f); used.add(f.id); } }
    S.today = {key, seed, mode: 'plan', day: idx, wd: p.week ? p.days[idx].wd : null, title: (p.days[idx] || {name: p.name}).name, items, deload, estMin: estMin(items, deload)};
  } else {
    const g = generate({workouts: S.workouts, equipment: equip(), duration: S.settings.duration, focus: S.settings.focus, seed, deload, exclude: S.settings.exclude});
    S.today = {key, seed, mode: 'auto', ...g, deload, estMin: estMin(g.items, false)};
  }
  persistSoon();
  return S.today;
}
function estMin(items, deload) { return Math.round((items.reduce((a, it) => a + exSeconds({...it, sets: deload ? Math.ceil(it.sets / 2) : it.sets}), 0) + 480) / 60); }
function reshuffle() { S.today.seed = (S.today.seed || 1) + 1; S.today.key = ''; ensureToday(true); }

/* ---------- Session logic ---------- */
function buildEx(it, deload, nFix) {
  const sg = suggestLoad(S.workouts, it, {deload});
  const n = nFix || (deload ? Math.max(1, Math.ceil(it.sets / 2)) : it.sets);
  const sets = [];
  for (let k = 0; k < n; k++) { const lr = sg.lastSets && sg.lastSets[k] ? sg.lastSets[k].reps : null; sets.push({kg: sg.kg, reps: (sg.up || deload) ? it.lo : (lr ?? it.lo), done: false}); }
  return {id: it.id, orig: it.orig || it.id, lo: it.lo, hi: it.hi, rest: it.rest, sets, hint: sg.text, up: sg.up, dl: !!sg.deload, wu: []};
}
function platesFor(kg) {
  const bar = S.settings.bar; if (kg == null) return null; let side = (kg - bar) / 2; if (side < 0) return {under: true};
  const out = []; for (const p of PLATES) { while (side >= p[0] - 1e-9) { out.push(p); side -= p[0]; } }
  return {out, rest: Math.round(side * 100) / 100};
}
function platesHTML(kg) {
  const r = platesFor(kg);
  if (!r) return '<span>Wpisz ciężar, a pokażę talerze na stronę.</span>';
  if (r.under) return '<span>Lżej niż sam gryf (' + fmt(S.settings.bar) + ' kg).</span>';
  const pl = r.out.map(p => '<span class="pl" style="width:' + p[3] + 'px;height:' + p[2] + 'px;background:var(' + p[1] + ');' + (p[0] === 5 ? 'box-shadow:inset 0 0 0 1px var(--p5e)' : '') + '"></span>').join('');
  const txt = r.out.length ? r.out.map(p => fmt(p[0])).join(' + ') : 'sam gryf';
  return '<div class="bar" aria-hidden="true"><span class="sl"></span><span class="col"></span>' + pl + '<span class="end"></span></div><span>Na stronę: <b class="mono">' + txt + '</b>' + (r.rest ? ' (brakuje ' + fmt(r.rest) + ' kg)' : '') + '</span>';
}
function ramp(kg) {
  const bar = S.settings.bar; if (kg == null || kg < bar + 20) return [];
  const out = [[bar, 10]];
  [[0.5, 5], [0.7, 3], [0.85, 1]].forEach(([p, r]) => { const v = roundTo(kg * p, 2.5); if (v > out[out.length - 1][0] && v < kg) out.push([v, r]); });
  return out;
}
function startWorkout() {
  unlockAudio();
  const t = ensureToday();
  if (!t.items.length) { toast('Brak ćwiczeń dla wybranego sprzętu'); return; }
  S.draft = {id: Date.now().toString(36), mode: t.mode, plan: S.settings.plan, day: t.day, title: t.title, week: cycleWeek(), deload: t.deload,
    started: new Date().toISOString(), genWu: false, ex: t.items.map(it => buildEx(it, t.deload))};
  UI.summary = null; UI.cur = null; UI.sel = null; UI.wuOpen = false; INL.t = 0;
  persistNow(); wake(); render(); window.scrollTo(0, 0);
}
const counts = d => { let a = 0, b = 0; d.ex.forEach(q => q.sets.forEach(s => { a++; if (s.done) b++; })); return [b, a]; };
const exDone = q => q.sets.every(s => s.done);
function curEx() { const d = S.draft; if (UI.cur != null && d.ex[UI.cur]) return UI.cur; const i = d.ex.findIndex(q => !exDone(q)); return i < 0 ? d.ex.length - 1 : i; }
function activeSet(i) { const q = S.draft.ex[i]; if (UI.sel && UI.sel.i === i && q.sets[UI.sel.k]) return UI.sel.k; const k = q.sets.findIndex(s => !s.done); return k < 0 ? q.sets.length - 1 : k; }
function finish() {
  const d = S.draft;
  const w = {id: 'w_' + d.id, date: d.started, end: new Date().toISOString(), mode: d.mode, plan: d.plan, day: d.day, dayName: d.title, deload: !!d.deload, week: d.week, ex: [], prs: []};
  d.ex.forEach(q => {
    const sets = q.sets.filter(s => s.done).map(s => ({kg: s.kg || 0, reps: s.reps || 0}));
    if (!sets.length) return;
    const prev = sessionsOf(S.workouts, q.id, true);
    const prevMax = prev.length ? Math.max(...prev.flatMap(h => h.sets.map(s => s.kg || 0))) : null;
    const top = Math.max(...sets.map(s => s.kg));
    if (prevMax != null && top > prevMax) w.prs.push(q.id);
    w.ex.push({id: q.id, sets});
  });
  S.workouts.push(w);
  if (d.mode === 'plan') { S.settings.next = (d.day + 1) % Math.max(1, (allPlans()[d.plan] || plan()).days.length); S.settings.dayPick = null; }
  else S.settings.focus = 'auto';
  S.draft = null; S.today = null;
  stopRest(); releaseWake(); UI.summary = w; persistNow(); render(); window.scrollTo(0, 0); toast('Trening zapisany');
}
function discard() { S.draft = null; persistNow(); stopRest(); releaseWake(); render(); window.scrollTo(0, 0); }
const volume = w => w.ex.reduce((a, q) => a + (isS(EX[q.id] || {}) ? 0 : q.sets.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0)), 0);

/* ---------- Rest timer, sound, wake lock ---------- */
const T = {end: 0, total: 0, on: false, goT: null, cue: 0}; let actx = null;
function unlockAudio() { try { if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } if (actx && actx.state === 'suspended') actx.resume(); } catch (err) { /* no audio */ } }
function tone(at, hz, len, vol) { const os = actx.createOscillator(), g = actx.createGain(); os.frequency.value = hz; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len); os.connect(g).connect(actx.destination); os.start(at); os.stop(at + len + 0.03); }
/** Short tick for the last seconds of a rest. */
function pip() {
  if (S.settings.restSound !== false) try { if (actx) tone(actx.currentTime, 660, 0.09, 0.2); } catch (err) { /* no audio */ }
  try { if (ANDROID) ANDROID.vibrate(60); else if (navigator.vibrate) navigator.vibrate(60); } catch (err) { /* no vibration */ }
}
function beep() {
  if (S.settings.restSound !== false) try { if (actx) { const t = actx.currentTime; [0, 0.28, 0.56].forEach((o, i) => tone(t + o, i === 2 ? 1175 : 880, 0.22, 0.35)); } } catch (err) { /* no audio */ }
  try { if (ANDROID) ANDROID.vibrate(500); else if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (err) { /* no vibration */ }
}
/** Tell the Android app when the rest ends, so it can ring while the app is in the background (0 = no rest). */
function restAlarm(at) { try { if (ANDROID && ANDROID.restAt) ANDROID.restAt(String(at)); } catch (err) { /* older app */ } }
/** The running rest lives in the draft, so it survives closing and reopening the app. */
function keepRest() { restAlarm(T.on ? T.end : 0); if (!S.draft) return; S.draft.rest = T.on ? {end: T.end, total: T.total, next: $('#restNext').textContent} : null; persistSoon(); }
function showRest(next) { clearTimeout(T.goT); T.cue = 0; $('#rest').classList.remove('go'); $('#restLbl').textContent = 'Przerwa'; $('#restNext').textContent = next || ''; $('#restNext').hidden = !next; $('#rest').hidden = false; tick(); }
function startRest(sec, next) { T.total = sec; T.end = Date.now() + sec * 1000; T.on = true; showRest(next); keepRest(); }
function stopRest() { const was = T.on; T.on = false; clearTimeout(T.goT); $('#rest').hidden = true; $('#rest').classList.remove('go'); if (was || (S.draft && S.draft.rest)) keepRest(); }
function resumeRest() { const r = S.draft && S.draft.rest; if (!r || T.on) return; if (r.end > Date.now()) { T.total = r.total; T.end = r.end; T.on = true; showRest(r.next); restAlarm(r.end); } else { S.draft.rest = null; restAlarm(0); } }
function tick() {
  if (T.on) {
    const left = (T.end - Date.now()) / 1000;
    if (left <= 0) { T.on = false; keepRest(); if (left > -5) beep(); $('#rest').classList.add('go'); $('#restLbl').textContent = 'Koniec przerwy'; $('#restTm').textContent = 'Czas na serię'; $('#restPb').style.width = '100%'; T.goT = setTimeout(stopRest, 6000); }
    else {
      const c = Math.ceil(left); if (c <= 3 && c !== T.cue && T.total > 5) { T.cue = c; pip(); }
      $('#restTm').textContent = mmss(left); $('#restPb').style.width = (100 - left / T.total * 100) + '%';
    }
  }
  if (S.draft) { const sec = (Date.now() - new Date(S.draft.started)) / 1000; const el = sec > 12 * 3600 ? (isEn() ? 'since ' : 'od ') + dateStr(S.draft.started) : hms(sec); const c = $('#elapsed'); if (c) c.textContent = el; const bt = $('#bnTime'); if (bt) bt.textContent = el; }
}
setInterval(tick, 250);
resumeRest();
$('#restMinus').onclick = () => { if (!T.on) return; T.end -= 15000; T.cue = 0; tick(); keepRest(); };
$('#restPlus').onclick = () => { if (!T.on) return; T.end += 15000; T.total += 15; T.cue = 0; tick(); keepRest(); };
$('#restSkip').onclick = stopRest;
$('#restNext').onclick = () => { if (UI.tab !== 'train' && S.draft) { UI.tab = 'train'; UI.sub = null; render(); window.scrollTo(0, 0); } };
let wl = null;
async function wake() { if (ANDROID) { try { ANDROID.keepScreenOn(true); } catch (err) { /* ignore */ } return; } try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (err) { wl = null; } }
function releaseWake() { if (ANDROID) { try { ANDROID.keepScreenOn(false); } catch (err) { /* ignore */ } return; } try { wl && wl.release(); } catch (err) { /* already released */ } wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.draft) { wake(); resumeRest(); } tick(); if (!S.draft && UI.tab === 'train' && S.today && S.today.key !== todayKey()) render(); } });
function nextLabel() {
  const d = S.draft;
  for (let i = 0; i < d.ex.length; i++) { const q = d.ex[i]; const k = q.sets.findIndex(s => !s.done); if (k >= 0) { const ex = EX[q.id]; return 'Następnie: ' + ex.n + ' · seria ' + (k + 1) + ' · ' + (q.sets[k].kg == null ? '' : kgTxt(ex, q.sets[k].kg) + ' × ') + repTxt(ex, q.sets[k].reps ?? q.lo); } }
  return '';
}

/* ---------- Animation: technique sheet + inline figure ---------- */
const AN = {raf: 0, last: 0, t: 0, paused: false, speed: 1, mode: -1, marks: true, k: 0};
const INL = {t: 0};
function timeline(f) {
  if (!f || f.static) return null;
  if (f.walk) return [{a: 0, b: 1, d: 700, l: 'Krótkie, szybkie kroki'}, {a: 1, b: 0, d: 700, l: 'Krótkie, szybkie kroki'}];
  const ab = f.ecc === 'AB'; const E = 'Opuszczanie: powoli, 2–3 s', C = 'Praca: dynamicznie, ok. 1 s';
  return [{a: 0, b: 0, d: 800, l: (f.sA || ['Start'])[0]}, {a: 0, b: 1, d: ab ? 2600 : 1100, l: ab ? E : C}, {a: 1, b: 1, d: 700, l: (f.sB || ['Koniec'])[0]}, {a: 1, b: 0, d: ab ? 1100 : 2600, l: ab ? C : E}];
}
const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
function phaseAt(tl, t) { const total = tl.reduce((a, p) => a + p.d, 0); t = ((t % total) + total) % total; for (const p of tl) { if (t < p.d) return {p, k: p.a + (p.b - p.a) * ease(t / p.d)}; t -= p.d; } return {p: tl[0], k: 0}; }
function timeForK(tl, k) { if (!tl) return 0; let t = 0; for (const p of tl) { if (p.a !== p.b) { const lo = Math.min(p.a, p.b), hi = Math.max(p.a, p.b); if (k >= lo && k <= hi) { const x = (k - p.a) / (p.b - p.a); return t + Math.acos(1 - 2 * Math.max(0, Math.min(1, x))) / Math.PI * p.d; } } t += p.d; } return 0; }
function drawFig(label) {
  const sh = UI.sheet; if (!sh || !sh.id) return; const f = EX[sh.id].fig; const box = $('#figAnim'); if (!box || !f) return;
  box.innerHTML = figSVG(sh.id, AN.k, FC, bigBox(sh.id), {mode: AN.mode, marks: AN.marks, ghost: AN.marks, detail: true});
  const sl = $('#figK'); if (sl && document.activeElement !== sl) sl.value = Math.round(AN.k * 1000);
  if (label != null) { const lb = $('#figPhase'); if (lb && lb.textContent !== label) lb.textContent = label; }
  const st = AN.k < 0.25 ? 0 : AN.k > 0.75 ? 2 : 1;
  document.querySelectorAll('.steps button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === st)));
  const tx = $('#stepTxt');
  if (tx) {
    const ab = f.ecc === 'AB';
    const mv = ab ? 'Opuszczaj kontrolowanie przez 2–3 s, wracaj dynamicznie w ok. 1 s. Wdech przed opuszczaniem, wydech przy wysiłku.' : 'Faza pracy dynamicznie w ok. 1 s, powrót kontrolowany przez 2–3 s. Wydech przy wysiłku, wdech przy powrocie.';
    const t = st === 0 ? (f.sA || ['', ''])[1] : st === 2 ? (f.sB || ['', ''])[1] : mv;
    if (tx.textContent !== t) tx.textContent = t;
  }
  document.querySelectorAll('.legend-n li').forEach(li => { const m = (f.marks || []).find(q => q.n === +li.dataset.n); li.classList.toggle('on', !!m && visMark(m, AN.k)); });
}
function loop(ts) {
  const dt = AN.last ? Math.min(100, ts - AN.last) : 16; AN.last = ts; let need = false; const sh = UI.sheet;
  if (sh && sh.id && $('#figAnim')) { const tl = timeline(EX[sh.id].fig); if (tl) { need = true; if (!AN.paused) { AN.t += dt * AN.speed; const r = phaseAt(tl, AN.t); AN.k = r.k; drawFig(r.p.l); } } }
  const il = !sh && !REDUCED ? $('#inlFig') : null;
  if (il) { const id = il.dataset.id; const tl = timeline(EX[id].fig); if (tl) { need = true; INL.t += dt; const r = phaseAt(tl, INL.t); il.innerHTML = figSVG(id, r.k, FC, tightBox(id), {detail: true}); const lb = $('#inlPhase'); if (lb && lb.textContent !== r.p.l) lb.textContent = r.p.l; } }
  if (need) AN.raf = requestAnimationFrame(loop); else { AN.raf = 0; AN.last = 0; }
}
function kick() { if (!AN.raf) AN.raf = requestAnimationFrame(loop); }

/* ---------- Sheets ---------- */
/* Sheets stack: opening a sheet over another keeps the one below; back returns to it. */
function openSheet(id, ctx) { if (UI.sheet) UI.stack.push(UI.sheet); UI.sheet = {id, ctx: ctx || null, tab: ctx && ctx.from === 'plan' ? 'set' : 'ruch', view: UI.lastView || '3d'}; AN.mode = -1; AN.t = 0; AN.k = 0; AN.last = 0; AN.paused = REDUCED; renderSheet(true); }
function openPanel(type, extra) { if (UI.sheet) UI.stack.push(UI.sheet); UI.sheet = {type, ...(extra || {})}; renderSheet(true); }
function closeSheet() { const prev = UI.stack.pop(); if (prev) { UI.sheet = prev; renderSheet(true); return; } UI.sheet = null;
  const bg = $('#sheetRoot .sheet-bg');
  if (bg && !REDUCED) { bg.classList.add('out'); bg.removeAttribute('data-act'); setTimeout(() => { if (!UI.sheet) $('#sheetRoot').innerHTML = ''; }, 200); } else $('#sheetRoot').innerHTML = ''; document.body.classList.remove('lock'); kick(); }
function closeAll() { UI.stack = []; closeSheet(); }
function sheetFrame(title, eyebrow, sub, tabs, body) {
  return '<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT" data-stop="1"><div class="sheet-top"><div class="grab"></div>' + (UI.stack.length ? '<button class="sheet-back" data-act="sheet-back">‹ Wróć</button>' : '') + '<div class="sheet-h"><div style="min-width:0">' + (eyebrow ? '<div class="eyebrow">' + eyebrow + '</div>' : '') + '<h2 id="shT">' + title + '</h2>' + (sub ? '<div class="muted small">' + sub + '</div>' : '') + '</div><button class="x" data-act="sheet-close" aria-label="Zamknij">×</button></div>' + (tabs || '') + '</div><div class="sheet-body">' + body + '</div></div></div>';
}
function renderSheet(fresh) {
  const sh = UI.sheet; if (!sh) { closeSheet(); return; }
  const h = sh.type === 'list' ? listSheet() : sh.type === 'finish' ? finishSheet() : sh.type === 'pick' ? pickSheet() : sh.type === 'muscle' ? muscleSheet() : sh.type === 'day' ? daySheet() : exSheet();
  const prev = $('.sheet') ? $('.sheet').scrollTop : 0; const opening = !$('#sheetRoot .sheet-bg:not(.out)');
  $('#sheetRoot').innerHTML = h; document.body.classList.add('lock');
  if (opening) { const bg = $('#sheetRoot .sheet-bg'); if (bg) bg.classList.add('in'); }
  const sx = $('.sheet'); if (sx) sx.scrollTop = fresh ? 0 : prev;
  if (fresh) { const x = $('.sheet .x'); if (x) x.focus({preventScroll: true}); }
  if (sh.id) drawFig(AN.paused ? null : undefined);
  kick();
  const st = $('#stage3d'); if (st) start3d(st, sh.id);
}
/* 3D figure: loaded on first use (three.js is large), shared by all sheets. */
let fig3d = null;
function start3d(el, id) {
  const ex = EX[id]; const m = {}; for (const k in ex.m) m[k] = ex.m[k] >= 1 ? 1 : 0.5;
  (fig3d ? Promise.resolve(fig3d) : import('./fig3d.js').then(mod => mod.loadBody().then(() => (fig3d = mod)))).then(mod => {
    if (!el.isConnected) return;
    mod.mount3d(el, POSES3D[id], m, {reduced: REDUCED, onPhase: k => { const t = $('#tag3d'); if (t) { const v = k < 0.5 ? 'Pozycja 1' : 'Pozycja 2'; if (t.textContent !== tt(v)) t.textContent = tt(v); } }});
  }).catch(() => { GL_OK = false; if (UI.sheet && UI.sheet.id === id) { UI.sheet.view = 'ill'; renderSheet(false); } });
}
function ctxUsed(ctx) {
  if (!ctx) return [];
  if (ctx.from === 'session' && S.draft) return S.draft.ex.map(q => q.id);
  if (ctx.from === 'today' && S.today) return S.today.items.map(q => q.id);
  if (ctx.from === 'plan' && curPlan() && curPlan().days[ctx.d]) return curPlan().days[ctx.d].ex.map(q => q.id);
  return [];
}
function exSheet() {
  const sh = UI.sheet; const ex = EX[sh.id]; const f = ex.fig || {}; const tl = timeline(ex.fig); const views = [['3d', '3D', POSES3D[sh.id] && GL_OK], ['ill', 'Rysunek', ex.ek], ['photo', 'Zdjęcie', photoSrc(ex, 0)]].filter(v => v[2]); if (!views.length) views.push(['fig', 'Rysunek', true]); if (!views.some(v => v[0] === sh.view)) sh.view = views[0][0]; const bad = f.bad || []; const bd = AN.mode >= 0 ? bad[AN.mode] : null;
  const ctx = sh.ctx; const q = ctx && ctx.from === 'session' && S.draft ? S.draft.ex[ctx.i] : null;
  const alts = alternatives(sh.id, ctx ? equip() : EQUIPMENT.map(e => e[0]), ctxUsed(ctx)).filter(a => !S.settings.exclude.includes(a));
  const pat = (PATTERNS.find(p => p[0] === ex.p) || ['', ''])[1];
  const tabs = '<div class="stabs" role="tablist">' + (ctx && ctx.from === 'plan' ? [['set', 'Ustaw']] : []).concat([['ruch', 'Technika'], ['info', 'Opis']]).concat(alts.length || ctx ? [['alt', ctx ? 'Zamień' : 'Zamienniki']] : []).map(([k, l]) => '<button role="tab" data-act="stab" data-t="' + k + '" aria-selected="' + (sh.tab === k) + '">' + l + '</button>').join('') + '</div>';
  let h = '';
  if (sh.tab === 'ruch' && views.length > 1) h += '<div class="seg viewseg n' + views.length + '" role="group" aria-label="Widok">' + views.map(v => '<button data-act="view" data-v="' + v[0] + '" aria-pressed="' + (sh.view === v[0]) + '">' + v[1] + '</button>').join('') + '</div>';
  if (sh.tab === 'ruch' && sh.view === '3d') {
    h += '<div class="stage3d" id="stage3d" data-noi18n><span class="phtag" id="tag3d"></span><span class="hint3d" aria-hidden="true">↔</span></div>';
    h += '<div class="ill-key" aria-hidden="true"><span><i class="k1"></i>mięśnie główne</span><span><i class="k2"></i>pomocnicze</span><span>przeciągnij, żeby obrócić</span></div>';
    h += '<div class="seg pos3d" role="group" aria-label="Pozycje"><button data-act="k3d" data-k="0" aria-pressed="false">Pozycja 1</button><button data-act="k3d" data-k="-1" aria-pressed="true">Ruch</button><button data-act="k3d" data-k="1" aria-pressed="false">Pozycja 2</button></div>';
  }
  if (sh.tab === 'ruch' && (sh.view === 'ill' || sh.view === '3d')) {
    if (sh.view === 'ill') {
    h += '<div class="photos ill' + (REDUCED ? ' still' : '') + '" id="photos" data-act="photo-auto"><img src="' + illSrc(ex, 0) + '" alt="' + esc(ex.n) + ': pozycja 1" class="ph0"><img src="' + illSrc(ex, 1) + '" alt="' + esc(ex.n) + ': pozycja 2" class="ph1"><span class="phtag ph0">Pozycja 1</span><span class="phtag ph1">Pozycja 2</span></div>';
    h += '<div class="ill-key" aria-hidden="true"><span><i class="k1"></i>mięśnie główne</span><span><i class="k2"></i>pomocnicze</span></div>';
    h += '<div class="frames steps" role="group" aria-label="Pozycje"><button data-act="photo-k" data-k="0"><img src="' + illSrc(ex, 0) + '" alt=""><span><i>1</i>Pozycja 1</span></button><button data-act="photo-k" data-k="1"><img src="' + illSrc(ex, 1) + '" alt=""><span><i>2</i>Pozycja 2</span></button></div>';
    if (ex.ekv && VARIANT[ex.ekv]) h += '<p class="varnote"><b>Bliski wariant.</b> ' + VARIANT[ex.ekv][0] + '</p>';
    }
    const load = {}; for (const k in ex.m) load[k] = ex.m[k] >= 1 ? 1 : 0.3;
    h += '<div class="ill-mus"><div class="ill-map">' + targetMap(load) + '</div><div class="ill-ml"><div class="sec-t">Pracujące mięśnie</div><div class="row">' + primary(ex).map(k => '<span class="chip m prim"><i class="dot1"></i>' + MUSCLES[k] + '</span>').join('') + Object.keys(ex.m).filter(k => ex.m[k] < 1).map(k => '<span class="chip m"><i class="dot2"></i>' + MUSCLES[k] + '</span>').join('') + '</div></div></div>';
    if (f.sA) h += '<p class="steptxt"><b>' + f.sA[0] + ':</b> ' + f.sA[1] + '</p>';
    if (f.sB) h += '<p class="steptxt"><b>' + f.sB[0] + ':</b> ' + f.sB[1] + '</p>';
    { const mk = (f.marks || []).filter(m => m.l); if (mk.length) h += '<div class="stack" style="gap:8px"><div class="sec-t">Na co zwracać uwagę</div><ul class="cues">' + mk.map(m => '<li><span>' + m.l + '</span></li>').join('') + '</ul></div>'; }
    if (sh.view === 'ill') h += '<p class="muted small">Rysunki: <a href="' + ILL_CREDIT[1] + '" target="_blank" rel="noopener">' + ILL_CREDIT[0] + '</a>, licencja <a href="' + ILL_CREDIT[3] + '" target="_blank" rel="noopener">' + ILL_CREDIT[2] + '</a> (przycięte i przebarwione).</p>';
  } else if (sh.tab === 'ruch' && sh.view === 'photo') {
    h += '<div class="photos' + (REDUCED ? ' still' : '') + '" id="photos" data-act="photo-auto"><img src="' + photoSrc(ex, 0) + '" alt="' + esc(ex.n) + ': pozycja startowa" class="ph0"><img src="' + photoSrc(ex, 1) + '" alt="' + esc(ex.n) + ': pozycja końcowa" class="ph1"><span class="phtag ph0">' + (f.sA || ['Start'])[0] + '</span><span class="phtag ph1">' + (f.sB || ['Koniec'])[0] + '</span></div>';
    h += '<div class="steps" role="group" aria-label="Pozycje"><button data-act="photo-k" data-k="0"><span>1</span>' + (f.sA || ['Start'])[0] + '</button><button data-act="photo-k" data-k="1"><span>2</span>' + (f.sB || ['Koniec'])[0] + '</button></div>';
    if (f.sA) h += '<p class="steptxt"><b>' + f.sA[0] + ':</b> ' + f.sA[1] + '</p>';
    if (f.sB) h += '<p class="steptxt"><b>' + f.sB[0] + ':</b> ' + f.sB[1] + '</p>';
    h += '<p class="muted small">Zdjęcia: <a href="' + PHOTO_CREDIT[1] + '" target="_blank" rel="noopener">' + PHOTO_CREDIT[0] + '</a> (domena publiczna). Sprzęt na zdjęciu może się trochę różnić od opisu.</p>';
  } else if (sh.tab === 'ruch') {
    const marks = (f.marks || []).filter(m => m.n).sort((a, b) => a.n - b.n);
    h += '<div class="modes" role="group" aria-label="Wariant"><button class="mode ok" data-act="mode" data-m="-1" aria-pressed="' + (AN.mode < 0) + '">✓ Poprawnie</button>' + bad.map((b, i) => '<button class="mode bad" data-act="mode" data-m="' + i + '" aria-pressed="' + (AN.mode === i) + '">✕ ' + b.l + '</button>').join('') + '</div>';
    h += '<div class="figwrap' + (bd ? ' isbad' : '') + '"><div class="figbox big" id="figAnim" style="aspect-ratio:' + (bigBox(sh.id).w / bigBox(sh.id).h).toFixed(3) + '"></div>' + (bd ? '<span class="figtag">Błąd</span>' : '') + '</div>';
    if (tl) h += '<div class="ctrls"><button class="btn sm" data-act="anim-toggle">' + (AN.paused ? '▶ Odtwórz' : '❚❚ Pauza') + '</button><input type="range" id="figK" min="0" max="1000" value="' + Math.round(AN.k * 1000) + '" aria-label="Przewiń ruch klatka po klatce"><button class="btn sm ghost" data-act="speed" aria-label="Tempo animacji">' + (AN.speed === 1 ? '1×' : '0,5×') + '</button></div>';
    h += '<div class="phase"><b id="figPhase">' + (tl ? tl[0].l : 'Trzymaj pozycję i spokojnie oddychaj') + '</b><label class="tgl"><input type="checkbox" id="figMarks"' + (AN.marks ? ' checked' : '') + '> Linie</label></div>';
    if (bd) h += '<div class="whybad"><b>' + bd.l + '.</b> ' + bd.why + '</div>';
    if (tl && !f.walk) h += '<div class="steps" role="group" aria-label="Fazy ruchu"><button data-act="step-k" data-k="0"><span>1</span>' + (f.sA || ['Start'])[0] + '</button><button data-act="step-k" data-k="0.5"><span>2</span>Ruch</button><button data-act="step-k" data-k="1"><span>3</span>' + (f.sB || ['Koniec'])[0] + '</button></div><p class="steptxt" id="stepTxt"></p>';
    else if (f.sA) h += '<p class="steptxt">' + f.sA[1] + ' ' + (f.sB ? f.sB[1] : '') + '</p>';
    if (marks.length) h += '<div class="stack" style="gap:8px"><div class="sec-t">Na co patrzeć</div><ol class="legend-n">' + marks.map(m => '<li data-n="' + m.n + '"><span class="num">' + m.n + '</span><span>' + m.l + (m.ph ? ' <em>(' + (m.ph === 'A' ? (f.sA || ['start'])[0].toLowerCase() : (f.sB || ['koniec'])[0].toLowerCase()) + ')</em>' : '') + '</span></li>').join('') + '</ol></div>';
  } else if (sh.tab === 'info') {
    const prim = primary(ex), sec = Object.keys(ex.m).filter(k => ex.m[k] < 1);
    const best = Math.max(0, ...sessionsOf(S.workouts, sh.id, true).flatMap(s => s.sets.map(x => x.kg || 0)));
    const why = ctx && ctx.from === 'today' && S.today && S.today.items[ctx.idx] ? S.today.items[ctx.idx].why : '';
    if (why) h += '<p class="whytoday"><b>Dlaczego dziś:</b> ' + esc(why) + '</p>';
    h += '<div class="stack" style="gap:8px"><div class="sec-t">Mięśnie</div><div class="row">' + prim.map(k => '<span class="chip m prim">' + MUSCLES[k] + '</span>').join('') + sec.map(k => '<span class="chip m">' + MUSCLES[k] + ' · pomocniczo</span>').join('') + '</div></div>';
    { const hd = headsOf(ex); const byM = {};
      for (const k in hd) { const m = k.split('.')[0]; (byM[m] = byM[m] || []).push([k, hd[k]]); }
      const ms = Object.keys(byM).sort((a, b) => (ex.m[b] || 0) - (ex.m[a] || 0));
      if (ms.length) h += '<div class="stack" style="gap:8px"><div class="sec-t">Które części mięśni</div><ul class="heads">' + ms.map(m => '<li><span class="hm">' + MUSCLES[m] + '</span><span class="hh">' + HEADS[m].map(([hk, hn]) => { const w = (byM[m].find(x => x[0] === m + '.' + hk) || [0, 0])[1]; return '<span class="hchip w' + (w >= 1 ? 2 : w > 0 ? 1 : 0) + '">' + hn + '</span>'; }).join('') + '</span></li>').join('') + '</ul><div class="legend small"><span><i class="hl2"></i>główny akcent</span><span><i class="hl1"></i>pomocniczo</span><span><i class="hl0"></i>słabo lub wcale</span></div>' + (headWhy(ex) ? '<p class="whytoday">' + headWhy(ex) + '</p>' : '') + '</div>'; }
    { const L = lenOf(ex); h += '<div class="evi"><span class="lenico ' + L + '" aria-hidden="true"></span><div><b>Pozycja pracy mięśnia: ' + LEN_NAME[L].toLowerCase() + '</b><span class="small muted">' + LENS.find(x => x[0] === L)[2] + '</span></div></div>'; }
    if (!ex.ev) h += '<p class="notice small"><b>Bez badań przyrostu.</b> Nie dobieram go automatycznie, ale możesz dodać je do planu sam.</p>';
    h += '<button class="btn ghost wide aiask" data-act="ai-ask-ex">' + '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON.ai + '</svg> Zapytaj trenera AI o to ćwiczenie</button>';
    if (ex.ev) { const src = SOURCES[ex.ev.s]; h += '<div class="evi"><span class="evb ' + ex.ev.l + '">' + ex.ev.l + '</span><div><b>' + EV_NAME[ex.ev.l] + '</b><a href="' + src[1] + '" target="_blank" rel="noopener">' + src[0] + '</a></div></div>'; }
    h += '<div class="stack" style="gap:8px"><div class="sec-t">Sprzęt</div><p class="small">' + (ex.needs.length ? ex.needs.map(n => EQUIPMENT.find(e => e[0] === n)[1]).join(', ') : 'Bez sprzętu') + '</p></div>';
    if (best) h += '<p class="small">Twój rekord: <b class="mono">' + kgTxt(ex, best) + '</b></p>';
    h += '<div class="stack" style="gap:8px"><div class="sec-t">Jak wykonać</div>' + (ex.lib && !ex.cuesPl && !isEn() ? '<p class="muted small">Opis z bazy free-exercise-db, po angielsku.</p>' : '') + '<ul class="cues"' + (ex.lib && !ex.cuesPl ? ' data-noi18n' : '') + '>' + (!isEn() && ex.cuesPl ? ex.cuesPl : ex.cues).map(c => '<li><span>' + c + '</span></li>').join('') + '</ul></div>';
    if (ex.err.length) h += '<div class="stack" style="gap:8px"><div class="sec-t">Częste błędy</div><ul class="cues bad">' + ex.err.map(c => '<li><span>' + c + '</span></li>').join('') + '</ul></div>';
  } else if (sh.tab === 'set') {
    const day = (curPlan() || {days: []}).days[ctx.d]; const e = day && day.ex[ctx.i];
    if (!e) h += '<p class="muted">Tego ćwiczenia nie ma już w planie.</p>';
    else {
      h += '<div class="pe-edit big">' + peStepper('Serie', 'sets', e.sets, ctx.d, ctx.i) + peStepper(isS(ex) ? 'Od, s' : 'Powtórzenia od', 'lo', e.lo, ctx.d, ctx.i) + peStepper(isS(ex) ? 'Do, s' : 'Powtórzenia do', 'hi', e.hi, ctx.d, ctx.i) + peStepper('Przerwa', 'rest', e.rest, ctx.d, ctx.i, true) + '</div>';
      h += '<div class="seg" style="grid-template-columns:1fr 1fr"><button data-act="pe-move" data-d="' + ctx.d + '" data-i="' + ctx.i + '" data-dir="-1"' + (ctx.i === 0 ? ' disabled' : '') + '>↑ Wcześniej</button><button data-act="pe-move" data-d="' + ctx.d + '" data-i="' + ctx.i + '" data-dir="1"' + (ctx.i === day.ex.length - 1 ? ' disabled' : '') + '>↓ Później</button></div>';
      h += '<button class="btn primary big" data-act="sheet-back">Gotowe</button><button class="btn ghost wide" data-act="stab" data-t="alt">Zamień na inne ćwiczenie</button><button class="btn danger wide" data-act="pe-ex-del" data-d="' + ctx.d + '" data-i="' + ctx.i + '">Usuń z planu</button>';
    }
  } else {
    const locked = q && q.sets.some(s2 => s2.done);
    if (locked) h += '<p class="notice small">Masz już odhaczone serie tego ćwiczenia, więc zamiana jest zablokowana.</p>';
    if (ctx) h += '<p class="muted small">Dotknij „Wybierz”, żeby zamienić. Dotknij nazwy, żeby zobaczyć technikę.</p>';
    if (ctx && ctx.from !== 'plan' && S.settings.mode === 'plan') h += '<label class="tglrow"><input type="checkbox" id="permSwap"' + (UI.permSwap ? ' checked' : '') + '> Zamień też w planie na stałe</label>';
    h += '<ul class="list">' + alts.map(a2 => { const e2 = EX[a2]; return '<li><div class="lrow altrow"><button class="altprev" data-act="sheet-open" data-id="' + a2 + '"><span class="thumb">' + thumb(a2) + '</span><span class="lmain"><b>' + e2.n + '</b><span>' + KINDN[e2.kind] + ' · ' + (headLine(e2) || primary(e2).map(m => MUSCLES[m]).join(', ')) + '</span></span></button>' +
      (ctx ? '<button class="btn sm primary" data-act="swap" data-id="' + a2 + '"' + (locked ? ' disabled' : '') + '>Wybierz</button>' : '<span class="evb ' + e2.ev.l + '">' + e2.ev.l + '</span>') + '</div></li>'; }).join('') + '</ul>';
    if (ctx && !locked) h += '<button class="btn wide" data-act="pick-replace">Wybierz z pełnej listy ćwiczeń</button>';
  }
  if (ctx && ctx.from === 'today') h += '<div class="sheet-actions"><button class="btn ghost wide" data-act="today-remove">Usuń z dzisiejszego treningu</button><button class="btn ghost wide" data-act="exclude">Nie proponuj tego ćwiczenia</button></div>';
  else if (!ctx && S.settings.exclude.includes(sh.id)) h += '<div class="sheet-actions"><button class="btn wide" data-act="unexclude">Znowu proponuj to ćwiczenie</button></div>';
  return sheetFrame(ex.n, primary(ex).map(k => MUSCLES[k]).join(', ') + ' · ' + KINDN[ex.kind] + (ex.ev ? ' · <span class="okdot">✓ potwierdzone badaniami</span>' : ''), ex.en + (ex.uni ? ' · serie na każdą stronę' : ''), tabs, h);
}
function listSheet() {
  const d = S.draft; if (!d) return sheetFrame('Trening', '', '', '', '');
  const cur = curEx();
  const body = '<ul class="exlist">' + d.ex.map((q, i) => {
    const ex = EX[q.id]; const nd = q.sets.filter(s => s.done).length; const done = exDone(q);
    return '<li><button class="exrow" data-act="go-ex" data-i="' + i + '"><span class="thumb">' + thumb(q.id) + '</span><span style="min-width:0"><span class="nm" style="display:block">' + (i + 1) + '. ' + ex.n + '</span><span class="hn' + (done ? ' up' : '') + '" style="display:block">' + (done ? 'Zrobione' : nd + ' z ' + q.sets.length + ' serii') + (i === cur ? ' · teraz' : '') + '</span></span><span class="tg">' + (done ? '✓' : '›') + '</span></button></li>';
  }).join('') + '</ul><button class="btn wide" data-act="pick-open" data-target="session">+ Dodaj ćwiczenie</button><button class="btn ghost wide" data-act="discard-ask">Porzuć trening bez zapisu</button>';
  return sheetFrame('Lista ćwiczeń', 'Dotknij, żeby przejść', '', '', body);
}
function finishSheet() {
  const d = S.draft; if (!d) return sheetFrame('Trening', '', '', '', '');
  const [c, t] = counts(d); const sh = UI.sheet;
  if (sh.mode === 'discard') return sheetFrame('Porzucić trening?', '', '', '', '<p>Wpisane serie zostaną usunięte i nie trafią do historii.</p><button class="btn danger wide" data-act="discard-yes">Porzuć trening</button><button class="btn ghost wide" data-act="sheet-close">Wróć do treningu</button>');
  return sheetFrame(c < t ? 'Zakończyć wcześniej?' : 'Zapisać trening?', '', '', '', '<p>Zrobione <b>' + c + ' z ' + t + '</b> serii' + (c < t ? '. Niezaznaczone serie nie trafią do historii.' : '.') + '</p><button class="btn primary big" data-act="finish-yes"' + (c ? '' : ' disabled') + '>Zapisz trening</button>' + (c ? '' : '<p class="muted small">Odhacz przynajmniej jedną serię, żeby zapisać trening.</p>') + '<button class="btn ghost wide" data-act="sheet-close">Wróć do treningu</button><button class="btn ghost wide small" data-act="discard-ask">Porzuć bez zapisu</button>');
}
function pickSheet() {
  const sh = UI.sheet; const q = (sh.q || '').trim().toLowerCase();
  const replace = sh.target === 'replace';
  if (replace) sh.d = sh.ctx.d;
  const forPlan = sh.target === 'plan' || (replace && sh.ctx.from === 'plan');
  const used = new Set(replace ? ctxUsed(sh.ctx) : forPlan ? ((curPlan() || {days: []}).days[sh.d] || {ex: []}).ex.map(e => e.id) : sh.target === 'session' ? (S.draft ? S.draft.ex.map(e => e.id) : []) : (S.today ? S.today.items.map(e => e.id) : []));
  const list = Object.values(EX).filter(ex => listable(ex, sh.all !== false) && (forPlan || canDo(ex, equip())) && !used.has(ex.id) && (!q || (ex.n + ' ' + ex.en + ' ' + Object.keys(ex.m).map(m => MUSCLES[m]).join(' ')).toLowerCase().includes(q)));
  // Adding to a weekly plan day: exercises for that day's muscles come first.
  const dm = forPlan ? (((curPlan() || {days: []}).days[sh.d] || {}).mus || []) : [];
  const hits = ex => primary(ex).some(m => dm.includes(m)) ? 1 : 0;
  list.sort((x, y) => (hits(y) - hits(x)) || (exOrder(x) - exOrder(y)));
  const body = '<div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="Zakres"><button data-act="pick-all" data-v="0" aria-pressed="' + (sh.all === false) + '">Z badaniami</button><button data-act="pick-all" data-v="1" aria-pressed="' + (sh.all !== false) + '">Wszystkie</button></div>' +
    '<input class="search" id="pickQ" type="search" placeholder="Szukaj: nazwa lub partia" value="' + esc(sh.q || '') + '" aria-label="Szukaj ćwiczenia"><ul class="list">' +
    list.map(ex => '<li><button class="lrow" data-act="pick-add" data-id="' + ex.id + '"><span class="thumb">' + thumb(ex.id) + '</span><span class="lmain"><b>' + ex.n + '</b><span>' + KINDN[ex.kind] + ' · ' + (headLine(ex) || primary(ex).map(m => MUSCLES[m]).join(', ')) + '</span>' + evBadge(ex) + '</span><span class="addplus" aria-hidden="true">+</span></button></li>').join('') + '</ul>' +
    (list.length ? '' : '<p class="muted">Nic nie pasuje. Sprawdź sprzęt w profilu „' + esc(profile().name) + '”.</p>');
  return sheetFrame(replace ? 'Zamień na…' : 'Dodaj ćwiczenie', forPlan ? 'Wszystkie ćwiczenia' : 'Sprzęt: ' + esc(profile().name), forPlan ? 'Ćwiczenia, których nie zrobisz w danej siłowni, zamienią się automatycznie.' : '', '', body);
}
function muscleSheet() {
  const m = UI.sheet.m; const rec = recovery(S.workouts); const r = rec[m]; const wk = weeklySets(S.workouts)[m]; const t = MUSCLE_INFO[m].target;
  const ex = Object.values(EX).filter(e => usable(e) && primary(e).includes(m) && canDo(e, equip())).slice(0, 8);
  const st = status(r.pct);
  const body = '<div class="mus-head"><span class="rec-dot ' + st + '"></span><div><b class="big-num">' + r.pct + '%</b><div class="muted small">' + ({ready: 'Gotowy do treningu', partial: 'Częściowo zregenerowany', tired: 'Jeszcze zmęczony'})[st] + (r.readyIn ? ' · pełna regeneracja za ok. ' + hoursTxt(r.readyIn) : '') + '</div></div></div>' +
    '<p class="small">W ostatnich 7 dniach: <b class="mono">' + fmt(Math.round(wk * 10) / 10) + '</b> serii (cel ' + t[0] + '–' + t[1] + ').' + (r.last ? ' Ostatnio trenowany: ' + dateStr(r.last) + '.' : ' Jeszcze nie trenowany.') + '</p>' +
    '<div class="sec-t">Ćwiczenia z Twoim sprzętem</div><ul class="exlist">' + ex.map(e => '<li><button class="exrow" data-act="sheet-open" data-id="' + e.id + '"><span class="thumb">' + thumb(e.id) + '</span><span style="min-width:0"><span class="nm" style="display:block">' + e.n + '</span><span class="hn" style="display:block">' + KINDN[e.kind] + '</span></span><span class="tg">›</span></button></li>').join('') + '</ul>';
  return sheetFrame(MUSCLES[m], 'Regeneracja', '', '', body);
}
const hoursTxt = h => h + ' h';

$('#sheetRoot').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'sheet-close') { if (b.classList.contains('sheet-bg') && ev.target.closest('[data-stop]')) return; closeAll(); return; }
  if (a === 'sheet-back') { closeSheet(); return; }
  if (a === 'plan-ex') { const e = curPlan().days[+b.dataset.d].ex[+b.dataset.i]; openSheet(e.id, {from: 'plan', d: +b.dataset.d, i: +b.dataset.i}); return; }
  if (a === 'stab') { UI.sheet.tab = b.dataset.t; renderSheet(true); return; }
  if (a === 'view') { UI.sheet.view = UI.lastView = b.dataset.v; renderSheet(false); return; }
  if (a === 'ai-ask-ex') { const ex = EX[UI.sheet.id]; closeAll(); UI.fromSettings = false; UI.sub = 'ai'; aiSend(tt('Jak poprawnie wykonać to ćwiczenie i jak je wpleść w mój plan?') + ' ' + (isEn() ? ex.en : ex.n)); return; }
  if (a === 'k3d') { const k = +b.dataset.k; if (fig3d) fig3d.hold3d(k); document.querySelectorAll('.pos3d button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
  if (a === 'photo-k' || a === 'photo-auto') {
    // Tap a position to hold it; tap it again (or the big picture) to go back to alternating.
    const p = $('#photos'); if (!p) return; const hold = a === 'photo-k' && b.getAttribute('aria-pressed') !== 'true';
    p.classList.remove('show0', 'show1', 'still'); if (hold) p.classList.add('still', 'show' + b.dataset.k);
    document.querySelectorAll('.steps button').forEach(x => x.setAttribute('aria-pressed', String(hold && x === b))); return;
  }
  if (a === 'anim-toggle') { AN.paused = !AN.paused; AN.last = 0; b.textContent = AN.paused ? '▶ Odtwórz' : '❚❚ Pauza'; if (!AN.paused) { AN.t = timeForK(timeline(EX[UI.sheet.id].fig), AN.k); kick(); } return; }
  if (a === 'speed') { AN.speed = AN.speed === 1 ? 0.5 : 1; b.textContent = AN.speed === 1 ? '1×' : '0,5×'; return; }
  if (a === 'mode') { AN.mode = +b.dataset.m; renderSheet(false); return; }
  if (a === 'step-k') { AN.paused = true; AN.k = +b.dataset.k; const tg = $('[data-act=anim-toggle]'); if (tg) tg.textContent = '▶ Odtwórz'; drawFig(b.textContent.slice(1)); return; }
  if (a === 'sheet-open') { openSheet(b.dataset.id); return; }
  if (a === 'go-ex') { closeAll(); goEx(+b.dataset.i); return; }
  if (a === 'finish-yes') { closeAll(); finish(); return; }
  if (a === 'discard-ask') { openPanel('finish', {mode: 'discard'}); return; }
  if (a === 'discard-yes') { closeAll(); discard(); return; }
  if (a === 'pick-replace') { openPanel('pick', {target: 'replace', ctx: UI.sheet.ctx, q: ''}); return; }
  if (a === 'pick-all') { UI.sheet.all = b.dataset.v === '1'; renderSheet(false); return; }
  if (a === 'day-go') { UI.sheet.wd = +b.dataset.v; UI.peOpen = null; renderSheet(false); return; }
  if (a === 'pick-open') { openPanel('pick', {target: b.dataset.target, d: +b.dataset.d, q: '', wd: UI.sheet.type === 'day' ? UI.sheet.wd : null}); return; }
  if (a === 'pick-add' && UI.sheet.target === 'replace') { const sh = UI.sheet; closeSheet(); swapExercise(sh.ctx, b.dataset.id); return; }
  if (a === 'pick-add') { const sh = UI.sheet; closeSheet(); addExercise(sh.target, b.dataset.id, sh.d); return; }
  if (a.startsWith('pe-') || a === 'set-pick') { if (a === 'set-pick') closeAll(); const fromEx = UI.sheet && UI.sheet.ctx && UI.sheet.ctx.from === 'plan'; onAct(ev); if (a === 'pe-ex-del' && fromEx) { closeSheet(); toast('Usunięte z planu'); } return; }
  if (a === 'today-remove') { const i = UI.sheet.ctx.idx; S.today.items.splice(i, 1); persistSoon(); closeAll(); render(); toast('Usunięte z dzisiejszego treningu'); return; }
  if (a === 'exclude') { const id = UI.sheet.id; if (!S.settings.exclude.includes(id)) S.settings.exclude.push(id); S.today = null; persistNow(); closeAll(); render(); toast('Nie będę proponować: ' + EX[id].n); return; }
  if (a === 'unexclude') { S.settings.exclude = S.settings.exclude.filter(x => x !== UI.sheet.id); S.today = null; persistNow(); renderSheet(false); toast('Znowu w propozycjach'); return; }
  if (a === 'swap') { swapExercise(UI.sheet.ctx, b.dataset.id); return; }
});
$('#sheetRoot').addEventListener('input', ev => {
  if (ev.target.id === 'figK') { AN.paused = true; AN.k = ev.target.value / 1000; const tg = $('[data-act=anim-toggle]'); if (tg) tg.textContent = '▶ Odtwórz'; drawFig('Przewijanie klatka po klatce'); }
  if (ev.target.id === 'permSwap') { UI.permSwap = ev.target.checked; return; }
  if (ev.target.id === 'figMarks') { AN.marks = ev.target.checked; drawFig(); }
  if (ev.target.id === 'pickQ') { UI.sheet.q = ev.target.value; const pos = ev.target.selectionStart; renderSheet(false); const n = $('#pickQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && UI.sheet) closeSheet(); });

function swapExercise(ctx, nid, perm) {
  if (perm == null) perm = !!UI.permSwap;
  if (ctx.from === 'plan') {
    const day = curPlan().days[ctx.d]; const e = day.ex[ctx.i]; const rx = prescribe(EX[nid], {main: ctx.i === 0});
    day.ex[ctx.i] = {id: nid, sets: e.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest};
    S.today = null; persistNow(); closeSheet(); render(); toast('Zamienione na: ' + EX[nid].n); return;
  }
  if (ctx.from === 'session') {
    const i = ctx.i; const q = S.draft.ex[i];
    if (perm) { const o = q.orig || q.id; S.settings.subs[o] = nid; if (nid === o) delete S.settings.subs[o]; }
    S.draft.ex[i] = buildEx({id: nid, orig: q.orig || q.id, sets: q.sets.length, lo: q.lo, hi: q.hi, rest: q.rest}, S.draft.deload, q.sets.length);
    UI.cur = i; UI.sel = null;
  } else {
    const it = S.today.items[ctx.idx];
    if (perm) { const o = it.orig || it.id; S.settings.subs[o] = nid; if (nid === o) delete S.settings.subs[o]; S.today = null; }
    else { const rx = prescribe(EX[nid], {main: ctx.idx === 0}); S.today.items[ctx.idx] = {...it, id: nid, lo: rx.lo, hi: rx.hi, rest: rx.rest, why: it.why}; }
  }
  persistNow(); closeAll(); render(); toast('Zamienione na: ' + EX[nid].n);
}
function addExercise(target, id, day) {
  const rx = prescribe(EX[id], {});
  if (target === 'plan') { const c = curPlan(); if (!c || !c.days[day]) return; c.days[day].ex.push({id, sets: rx.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest}); planChanged(); toast('Dodane: ' + EX[id].n); return; }
  if (target === 'session' && S.draft) {
    S.draft.ex.push(buildEx({id, sets: rx.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest}, S.draft.deload));
    persistNow(); goEx(S.draft.ex.length - 1);
  } else {
    ensureToday(); S.today.items.push({id, sets: rx.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest, why: 'Dodane przez Ciebie'});
    S.today.estMin = estMin(S.today.items, S.today.deload); persistNow(); render();
  }
  toast('Dodane: ' + EX[id].n);
}

/* ---------- Plan editor helpers ---------- */
const curPlan = () => S.customPlans.find(c => c.id === UI.pe);
function openPlanEditor(id) { UI.pe = id; UI.peOpen = null; UI.peDel = null; UI.sub = 'planedit'; render(); window.scrollTo(0, 0); }
function planChanged() { S.today = null; persistNow(); render(); if (UI.sheet) renderSheet(false); }
function subBack() { UI.peWd = null; UI.sub = UI.sub === 'planedit' ? 'settings' : (UI.sub === 'know' || UI.sub === 'ai') && UI.fromSettings ? 'settings' : null; UI.aiCfg = false; UI.peDel = null; render(); window.scrollTo(0, 0); }
function planLoad(days) { const v = {}; days.forEach(d => d.ex.forEach(e => { const m = (EX[e.id] || {}).m || {}; for (const k in m) v[k] = (v[k] || 0) + m[k] * e.sets; })); return v; }

/* ---------- Views ---------- */
function cycleBar(wk) { return '<div class="cyc" aria-label="Tydzień ' + (wk + 1) + ' z 6">' + CYCLE.map((c, i) => '<span class="' + (c.deload ? 'dl ' : '') + (i < wk ? 'past' : i === wk ? 'now' : '') + '"></span>').join('') + '</div>'; }
function exRow(id, right, sub, act, extra) {
  const ex = EX[id];
  return '<li><button class="exrow" data-act="' + (act || 'sheet-open') + '" data-id="' + id + '"' + (extra || '') + '><span class="thumb">' + thumb(id) + '</span><span style="min-width:0"><span class="nm" style="display:block">' + ex.n + '</span>' + (sub || '') + '</span><span class="tg">' + right + '</span></button></li>';
}
const chipRow = (act, opts, cur, label) => '<div class="chips" role="group" aria-label="' + label + '">' + opts.map(([k, l]) => '<button class="pill" data-act="' + act + '" data-v="' + k + '" aria-pressed="' + (String(cur) === String(k)) + '">' + l + '</button>').join('') + '</div>';

const exWord = n => n + ' ' + (n === 1 ? 'ćwiczenie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ćwiczenia' : 'ćwiczeń');
const setsWord = n => n + ' ' + (n === 1 ? 'seria' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'serie' : 'serii');
const sameDay = (iso, d = new Date()) => dayStamp(new Date(iso)) === dayStamp(d);
/** Mon–Sun strip: planned days, trained days and today. */
/* Weekly plan shown and edited on the home screen. */
const weekPlanObj = () => S.customPlans.find(c => c.week && c.id === S.settings.plan) || S.customPlans.find(c => c.week) || null;
function ensureWeekPlan() {
  let c = weekPlanObj();
  if (!c) { c = {id: 'c' + Date.now().toString(36), name: 'Mój tydzień', week: true, days: []}; S.customPlans.push(c); }
  return c;
}
function useWeekPlan(c) {
  if (S.settings.mode === 'plan' && S.settings.plan === c.id) return;
  S.settings.mode = 'plan'; S.settings.plan = c.id; S.settings.next = 0; S.settings.dayPick = null; S.settings.welcomed = true; S.today = null;
  toast('Trenujesz według planu tygodnia');
}
function weekList() {
  const c = weekPlanObj(); const ws = weekStart(); const today = weekdayOf();
  const done = new Set(S.workouts.filter(w => new Date(w.date) >= ws).map(w => weekdayOf(new Date(w.date))));
  const using = c && S.settings.mode === 'plan' && S.settings.plan === c.id;
  let h = '<section class="stack" style="gap:8px"><div class="sec-h">' + (c && c.days.length ? 'Twój tydzień' : 'Zaplanuj tydzień') + '</div>';
  if (!c || !c.days.length) h += '<p class="muted small hint-p">Dotknij dnia i zaznacz partie mięśni, np. poniedziałek: klatka i biceps. Ćwiczenia dobiorą się same.</p>';
  h += '<ul class="list week-list">' + WEEKDAYS.map((wn, wd) => {
    const d = c && c.days.find(x => x.wd === wd);
    return '<li><button class="lrow" data-act="day-open" data-v="' + wd + '"><span class="wdname' + (done.has(wd) ? ' done' : wd === today ? ' now' : '') + '">' + (done.has(wd) ? '✓' : WD_SHORT[wd]) + '</span><span class="lmain"><b>' + wn + (wd === today ? ' · dziś' : '') + '</b><span>' + (d ? esc(d.mus.map(m => MUSCLES[m]).join(', ')) + ' · ' + d.ex.length + ' ćw.' : 'Odpoczynek') + '</span></span><span class="chev" aria-hidden="true">›</span></button></li>';
  }).join('') + '</ul>';
  if (c && c.days.length && !using) h += '<button class="btn wide" data-act="week-use">Trenuj według planu tygodnia</button>';
  return h + '</section>';
}
/** Which heads of the day's muscles get a main exercise, with a one-tap fix for gaps. */
function coverageBlock(d, di) {
  const cov = headCoverage(d.ex.map(e => e.id), d.mus.filter(m => HEADS[m])); const used = new Set(d.ex.map(e => e.id));
  let gaps = '';
  const rows = d.mus.filter(m => HEADS[m]).map(m => '<li><span class="hm">' + MUSCLES[m] + '</span><span class="hh">' + HEADS[m].map(([hk, hn]) => {
    const key = m + '.' + hk; const w = cov[key];
    if (w < 1) {
      const fix = Object.values(EX).filter(e => usable(e) && !used.has(e.id) && canDo(e, equip()) && mainHeads(e, m).includes(key)).sort((a, b) => (a.ev.l > b.ev.l) - (a.ev.l < b.ev.l))[0];
      gaps += '<li>' + MUSCLES[m] + ', ' + hn + ': ' + (fix ? 'słabo trenowane. <button class="linkbtn" data-act="pe-add" data-d="' + di + '" data-id="' + fix.id + '">+ ' + fix.n + '</button>' : (w > 0 ? 'pracuje tylko pomocniczo' : 'nie pracuje') + '. Brak ćwiczenia z badaniami przyrostu na tę część' + (key === 'delts.post' ? '; pomagają wiosłowania. Możesz dodać z pełnej listy np. odwrotne rozpiętki.' : '.')) + '</li>';
    }
    return '<span class="hchip w' + (w >= 1 ? 2 : w > 0 ? 1 : 0) + '">' + (w >= 1 ? '✓ ' : '') + hn + '</span>';
  }).join('') + '</span></li>').join('');
  if (!rows) return '';
  return '<div class="eyebrow">Części mięśni w tym dniu</div><ul class="heads">' + rows + '</ul>' + (gaps ? '<ul class="gaps small">' + gaps + '</ul>' : '<p class="small ok-txt">Każda część wybranych mięśni ma swoje ćwiczenie.</p>');
}
/** Sheet for one weekday: muscle groups, then the exercises filled in for them. */
function daySheet() {
  const wd = UI.sheet.wd; const c = weekPlanObj(); const di = c ? c.days.findIndex(x => x.wd === wd) : -1; const d = di >= 0 ? c.days[di] : null;
  const has = w => !!(c && c.days.some(x => x.wd === w));
  let h = '<div class="wdpick" role="tablist" aria-label="Dzień tygodnia">' + WD_SHORT.map((l, w) => '<button role="tab" data-act="day-go" data-v="' + w + '" aria-selected="' + (w === wd) + '"' + (has(w) ? ' class="has"' : '') + '>' + l + '</button>').join('') + '</div>';
  h += '<div class="eyebrow">Partie mięśni</div><div class="mgrid" role="group" aria-label="Partie mięśni">' + TRAINABLE.map(m => '<button class="mtog" data-act="pe-mus" data-wd="' + wd + '" data-m="' + m + '" aria-pressed="' + !!(d && d.mus.includes(m)) + '">' + MUSCLES[m] + '</button>').join('') + '</div>';
  if (d) {
    h += '<div class="eyebrow">Ćwiczenia · dotknij, żeby zmienić lub zamienić</div><ul class="list">' + d.ex.map((e, i) => '<li><button class="lrow" data-act="plan-ex" data-d="' + di + '" data-i="' + i + '"><span class="thumb">' + thumb(e.id) + '</span><span class="lmain"><b>' + EX[e.id].n + '</b><span>' + e.sets + ' × ' + range(EX[e.id], e) + ' · ' + headLine(EX[e.id]) + '</span></span><span class="chev" aria-hidden="true">›</span></button></li>').join('') + '</ul>' + coverageBlock(d, di) +
      '<div class="row"><button class="btn sm" data-act="pick-open" data-target="plan" data-d="' + di + '">+ Dodaj ćwiczenie</button><button class="btn sm ghost" data-act="pe-refill" data-d="' + di + '">↻ Dobierz inne</button></div>' +
      '<button class="btn primary big" data-act="sheet-close">Gotowe</button>' +
      (wd !== weekdayOf() && d.ex.length ? '<button class="btn ghost wide" data-act="set-pick" data-v="' + di + '">Zrób ten trening dziś</button>' : '');
  } else h += '<p class="muted small">Zaznacz jedną lub kilka partii. Dobiorę ćwiczenia, przy których badania pokazały przyrost mięśni. Bez zaznaczenia to dzień wolny.</p>';
  return sheetFrame(WEEKDAYS[wd], 'Plan tygodnia', d ? exWord(d.ex.length) + ' · ok. ' + estMin(d.ex, false) + ' min' : 'Odpoczynek', '', h);
}
/* ---------- Start: menu with today's summary ---------- */
const ICON = {
  train: '<path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/>',
  plan: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  atlas: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  recovery: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  progress: '<path d="M4 19h16M5 15l4-4 4 3 6-7"/>',
  know: '<path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>',
  ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
const icon = (k, color) => '<span class="ticon" style="background:' + color + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg></span>';
function viewStart() {
  const st = S.settings; const t = S.draft ? null : ensureToday(); const rec = recovery(S.workouts);
  const ready = TRAINABLE.filter(m => status(rec[m].pct) === 'ready').length;
  const ws = weekStart(); const thisWeek = S.workouts.filter(w => new Date(w.date) >= ws).length;
  const c = weekPlanObj(); const perWeek = c && c.days.length ? c.days.length : 0;
  const today = new Date().toLocaleDateString(locale(), {weekday: 'long', day: 'numeric', month: 'long'});
  let h = '<div class="stack"><p class="start-date">' + today.charAt(0).toUpperCase() + today.slice(1) + '</p>';
  if (!st.welcomed) h += '<section class="card welcome"><b>Witaj w Moim Trenerze</b><p class="small">Zacznij od planu tygodnia: wybierz dni i partie mięśni, a ćwiczenia dobiorą się same. Proponuję tylko ćwiczenia, przy których badania pokazały przyrost mięśni.</p><div class="row"><button class="btn sm primary" data-act="day-open" data-v="' + weekdayOf() + '">Zaplanuj tydzień</button><button class="btn sm ghost" data-act="welcomed">Później</button></div></section>';
  if (S.draft) {
    const [dn, dt] = counts(S.draft);
    if (Date.now() - new Date(S.draft.started) > 12 * 3600e3) h += '<section class="card hero"><div class="eyebrow">Niezakończony trening</div><h2>' + esc(S.draft.title || 'Trening') + '</h2><p class="muted">Zaczęty ' + dateStr(S.draft.started) + ', zrobione ' + dn + ' z ' + dt + ' serii. Zapisz go albo porzuć, żeby zacząć dzisiejszy.</p><div class="hero-btns"><button class="btn primary big" data-act="stale-save"' + (dn ? '' : ' disabled') + '>Zapisz</button><button class="btn big" data-act="stale-drop">Porzuć</button></div></section>';
    else h += '<section class="card hero"><div class="eyebrow">Trening w toku</div><h2>' + esc(S.draft.title || 'Trening') + '</h2><p class="muted">' + dn + ' z ' + dt + ' serii</p><button class="btn primary big" data-act="back-train">Wróć do treningu</button></section>';
  } else if (t.rest) {
    const n = t.next ? plan().days[t.next.idx] : null;
    h += '<section class="card hero"><div class="eyebrow">Dziś</div><h2>Dzień wolny</h2><p class="muted">' + (n ? 'Następny trening: ' + WEEKDAYS[n.wd].toLowerCase() + ', ' + esc(n.name) + '.' : 'Mięśnie rosną, kiedy odpoczywasz.') + '</p><button class="btn big" data-act="go" data-tab="plan">Zobacz plan tygodnia</button></section>';
  } else {
    h += '<section class="card hero"><div class="eyebrow">Dziś</div><h2>' + esc(t.title) + '</h2><p class="muted">' + exWord(t.items.length) + ' · ok. ' + t.estMin + ' min</p><div class="hero-btns"><button class="btn primary big" data-act="start-go"' + (t.items.length ? '' : ' disabled') + '>Zacznij trening</button><button class="btn big" data-act="go" data-tab="train">Podgląd</button></div></section>';
  }
  const tiles = [
    ['plan', 'Plan tygodnia', perWeek ? perWeek + ' ' + daysWord(perWeek) + ' w tygodniu' : 'ustaw dni i partie', '#34C759', 'go', 'plan'],
    ['atlas', 'Ćwiczenia', Object.values(EX).filter(e => listable(e, true)).length + ', w tym ' + Object.values(EX).filter(usable).length + ' z badaniami', '#FF9500', 'go', 'atlas'],
    ['recovery', 'Regeneracja', 'gotowe ' + ready + ' z ' + TRAINABLE.length + ' partii', '#FF3B30', 'go', 'recovery'],
    ['progress', 'Postępy', thisWeek + ' w tym tygodniu', '#AF52DE', 'go', 'progress'],
    ['know', 'Wiedza', 'zasady i badania', '#5856D6', 'go-know', ''],
  ];
  tiles.splice(1, 0, ['ai', 'Trener AI', aiReady(S.ai) ? 'zapytaj o plan i technikę' : 'podłącz własny klucz AI', '#0A84FF', 'go-ai', '']);
  h += '<div class="tiles">' + tiles.map(([k, l, sub, col, act, tab]) => '<button class="tile" data-act="' + act + '"' + (tab ? ' data-tab="' + tab + '"' : '') + '>' + icon(k, col) + '<b>' + l + '</b><span>' + sub + '</span></button>').join('') + '</div>';
  h += '<ul class="list"><li><button class="lrow" data-act="go-settings">' + icon('settings', '#8E8E93') + '<span class="lmain"><b>Ustawienia</b><span>Siłownie i sprzęt, gotowe plany, cykl, kopia danych</span></span><span class="chev">›</span></button></li></ul>';
  return h + '</div>';
}
function viewPlanTab() {
  const c = weekPlanObj();
  let h = '<div class="stack">' + weekList();
  if (c && c.days.length) h += planVolume(c);
  h += '<ul class="list"><li><button class="lrow" data-act="go-ai" data-q="plan">' + icon('ai', '#0A84FF') + '<span class="lmain"><b>Ułóż plan z trenerem AI</b><span>Opisz cel i dni, a AI przygotuje plan do wgrania</span></span><span class="chev">›</span></button></li></ul>';
  h += '<ul class="list"><li><button class="lrow" data-act="go-settings"><span class="lmain"><b>Gotowe plany i tryb automatyczny</b><span>FBW, góra/dół, PPL albo dobór według regeneracji</span></span><span class="chev">›</span></button></li></ul>';
  return h + '</div>';
}
const planLink = () => '<ul class="list"><li><button class="lrow" data-act="go" data-tab="plan"><span class="lmain"><b>Plan tygodnia</b><span>Dni, partie mięśni i ćwiczenia</span></span><span class="chev">›</span></button></li></ul>';
function viewHome() {
  const t = ensureToday(); const st = S.settings; const wk = cycleWeek(); const cy = CYCLE[wk]; const p = plan();
  const weekPlan = t.mode === 'plan' && p.week;
  let h = '<div class="stack">';
  if (UI.summary) { const w = UI.summary; h += '<section class="card summary"><h3>Trening zapisany</h3><p>' + esc(w.dayName) + ' · ' + setsWord(w.ex.reduce((a, q) => a + q.sets.length, 0)) + ' · ' + fmt(Math.round(volume(w))) + ' kg</p>' + (w.prs.length ? '<div class="row">' + w.prs.map(q => '<span class="chip pr">Rekord: ' + EX[q].n + '</span>').join('') + '</div>' : '') + '</section>'; }
  if (t.rest) {
    const n = t.next ? p.days[t.next.idx] : null;
    const trained = S.workouts.some(w => sameDay(w.date));
    h += '<section class="card today"><div class="eyebrow">' + WEEKDAYS[t.wd] + '</div><h2>Dzień wolny</h2><p class="muted">' + (trained ? 'Dziś już trenowałeś.' : 'Mięśnie rosną, kiedy odpoczywasz.') + (n ? ' Następny trening: <b>' + WEEKDAYS[n.wd].toLowerCase() + '</b>, ' + esc(n.name) + '.' : '') + '</p>' +
      (n && !trained ? '<button class="btn wide" data-act="set-pick" data-v="' + t.next.idx + '">Trenuj dziś: ' + esc(n.name) + '</button>' : '') + '</section>';
    h += planLink();
    return h + '</div>';
  }
  const doneToday = weekPlan && S.workouts.some(w => sameDay(w.date) && w.plan === st.plan && w.day === t.day);
  const load = {}; t.items.forEach(it => { const m = EX[it.id].m; for (const k in m) load[k] = (load[k] || 0) + m[k] * it.sets; });
  const eyebrow = weekPlan ? (t.wd === weekdayOf() ? 'Dziś · ' : 'Wybrany dzień · ') + WEEKDAYS[t.wd] : t.mode === 'plan' ? esc(p.name) : 'Dobrane dla Ciebie';
  h += '<section class="card today"><div class="today-top"><div class="today-txt"><div class="eyebrow">' + eyebrow + '</div>' +
    '<h2>' + esc(t.title) + '</h2><div class="today-meta">' + exWord(t.items.length) + ' · ok. ' + t.estMin + ' min' + (cy.deload ? ' · tydzień lżejszy' : '') + '</div>' + (doneToday ? '<div class="donebadge">✓ Zrobione dziś</div>' : '') + '</div>' +
    '</div>' +
    (t.light ? '<p class="notice small">Mięśnie jeszcze się regenerują. Proponuję lżejszy trening albo dzień wolny.</p>' : '') +
    (cy.deload ? '<p class="notice small">Tydzień lżejszy: połowa serii, ok. 10% mniej ciężaru.</p>' : '') +
    '<button class="btn ' + (doneToday ? '' : 'primary ') + 'big" data-act="start"' + (t.items.length ? '' : ' disabled') + '>' + (doneToday ? 'Trenuj jeszcze raz' : 'Zacznij trening') + '</button>' +
    '<button class="cfg-toggle" data-act="cfg" aria-expanded="' + UI.cfgOpen + '"><span>' + esc(profile().name) + (t.mode === 'plan' ? '' : ' · ' + st.duration + ' min · ' + FOCUS[st.focus].n) + '</span><b>' + (UI.cfgOpen ? 'Gotowe' : 'Zmień') + '</b></button>';
  if (UI.cfgOpen) {
    h += '<div class="cfg">';
    h += '<div class="eyebrow">Gdzie trenujesz</div>' + chipRow('set-profile', S.profiles.map(q => [q.id, esc(q.name)]), st.profile, 'Siłownia');
    if (t.mode === 'auto') {
      h += '<div class="eyebrow">Czas</div>' + chipRow('set-dur', [30, 45, 60, 75, 90].map(m => [m, m + ' min']), st.duration, 'Czas treningu');
      h += '<div class="eyebrow">Zakres</div>' + chipRow('set-focus', Object.entries(FOCUS).map(([k, v]) => [k, v.n]), st.focus, 'Zakres treningu');
    } else if (weekPlan) {
      h += '<div class="eyebrow">Trenuj dziś inny dzień</div>' + chipRow('set-pick', p.days.map((d, i) => [i, WD_SHORT[d.wd] + ' · ' + esc(d.name)]), t.day, 'Dzień planu');
    } else {
      h += '<div class="eyebrow">Dzień planu</div>' + chipRow('set-day', p.days.map((d, i) => [i, esc(d.name)]), st.next % p.days.length, 'Dzień planu');
    }
    h += '<button class="linkbtn" data-act="go-settings">Plan, sprzęt i inne ustawienia ›</button></div>';
  }
  h += '</section>';
  h += '<section class="stack" style="gap:8px"><div class="sec-h">Ćwiczenia</div><ul class="list">' + t.items.map((it, i) => {
    const ex = EX[it.id]; const sg = suggestLoad(S.workouts, it, {deload: t.deload}); const n = t.deload ? Math.ceil(it.sets / 2) : it.sets;
    const tgt = sg.kg != null && !sg.first ? kgTxt(ex, sg.kg) : '';
    const note = it.via === 'equip' ? 'zamiast: ' + EX[it.orig].n : it.via === 'sub' ? 'zamiast: ' + EX[it.orig].n : '';
    return '<li><button class="lrow" data-act="today-ex" data-id="' + it.id + '" data-idx="' + i + '"><span class="thumb">' + thumb(it.id) + '</span><span class="lmain"><b>' + ex.n + '</b><span>' + n + ' × ' + range(ex, it) + (tgt ? ' · <em class="' + (sg.up ? 'up' : '') + '">' + (sg.up ? '↑ ' : '') + tgt + '</em>' : '') + '</span>' + (note ? '<span class="sub-note">' + esc(note) + '</span>' : '') + '</span><span class="chev" aria-hidden="true">›</span></button></li>';
  }).join('') + '</ul>' + (t.items.length ? '' : '<p class="muted card">Brak ćwiczeń dla tego sprzętu. Zmień siłownię albo partie w planie.</p>') +
    '<div class="row today-actions">' + (t.mode === 'auto' ? '<button class="btn sm" data-act="shuffle">↻ Inne ćwiczenia</button>' : '') + '<button class="btn sm ghost" data-act="pick-open" data-target="today">+ Dodaj ćwiczenie</button></div></section>';
  h += planLink();
  return h + '</div>';
}
function goEx(i) { const d = S.draft; if (!d) return; if (i >= d.ex.length) { openPanel('finish', {mode: 'finish'}); return; } i = Math.max(0, i); UI.cur = i; UI.sel = null; INL.t = 0; render(); window.scrollTo({top: 0, behavior: REDUCED ? 'auto' : 'smooth'}); }
function viewSession() {
  const d = S.draft; const i = curEx(); const q = d.ex[i]; const ex = EX[q.id]; const n = d.ex.length; const k = activeSet(i); const s = q.sets[k];
  let h = '<div class="stack">';
  if (!d.genWu) h += '<section class="card wu"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div><b>Rozgrzewka · 5–10 min</b>' + (UI.wuOpen ? '' : '<div class="muted small">Cardio, krążenia, kilka lekkich serii</div>') + '</div><div class="row" style="flex-wrap:nowrap"><button class="btn sm ghost" data-act="wu-toggle" aria-expanded="' + UI.wuOpen + '">' + (UI.wuOpen ? 'Zwiń' : 'Pokaż') + '</button><button class="btn sm ok" data-act="wu-done">Zrobione</button></div></div>' +
    (UI.wuOpen ? '<ul><li>3–5 min lekkiego cardio: rower, orbitrek, szybki marsz</li><li>Krążenia ramion i bioder, wymachy nóg po 10</li><li>10 przysiadów i 10 pompek bez obciążenia</li><li>Przed ciężkim ćwiczeniem zrób serie rozgrzewkowe pokazane przy nim</li></ul>' : '') + '</section>';
  h += '<section class="player" id="player"><div class="pl-head"><button class="pl-count" data-act="list" aria-haspopup="dialog">Ćwiczenie ' + (i + 1) + ' z ' + n + ' ▾</button><button class="btn sm ghost" data-act="tech" data-i="' + i + '">Zamień</button></div>' +
    '<h2 class="pl-name">' + ex.n + '</h2><div class="row"><span class="chip">' + q.sets.length + ' × ' + range(ex, q) + '</span><button class="chip rest-go" data-act="rest-go" data-i="' + i + '" aria-label="Włącz przerwę">⏱ <span>przerwa ' + mmss(q.rest) + '</span></button><span class="chip m">' + KINDN[ex.kind] + '</span>' + (ex.uni ? '<span class="chip m">na stronę</span>' : '') + '</div>' +
    '<button class="inl-wrap" data-act="tech" data-i="' + i + '" aria-label="Pokaż technikę: ' + ex.n + '">' + '<span class="inl photos' + (ex.ek ? ' ill' : '') + (REDUCED ? ' still' : '') + '"><img class="ph0" src="' + (ex.ek ? illSrc(ex, 0) : photoSrc(ex, 0)) + '" alt=""><img class="ph1" src="' + (ex.ek ? illSrc(ex, 1) : photoSrc(ex, 1)) + '" alt=""></span>' + '<span class="inl-cap"><b>Technika i opis ›</b></span></button>' +
    '<p class="hint' + (q.up ? ' up' : q.dl ? ' dl' : '') + '">' + (q.up ? '<span class="mono">↑</span>' : '') + '<span>' + q.hint + '</span></p>';
  if (ex.kind === 'bar' && !q.dl) { const rp = ramp(q.sets[0].kg); if (rp.length) h += '<div class="ramp"><span class="eyebrow">Rozgrzewka:</span>' + rp.map((r, j) => '<button data-act="wu" data-i="' + i + '" data-j="' + j + '" aria-pressed="' + !!(q.wu || [])[j] + '">' + fmt(r[0]) + '×' + r[1] + '</button>').join('') + '</div>'; }
  h += '<div class="setpills" role="group" aria-label="Serie">' + q.sets.map((x, j) => '<button class="sp' + (x.done ? ' done' : '') + (j === k ? ' sel' : '') + '" data-act="sel" data-i="' + i + '" data-k="' + j + '" aria-label="Seria ' + (j + 1) + (x.done ? ', zrobiona' : '') + '"><small>Seria ' + (j + 1) + '</small><span>' + (x.kg == null ? (x.reps ?? q.lo) + ' powt.' : fmt(x.kg) + '×' + (x.reps ?? '–')) + '</span></button>').join('') +
    '<button class="sp add" data-act="addset" data-i="' + i + '" aria-label="Dodaj serię">+</button></div>';
  h += '<div class="panel"><div class="row" style="justify-content:space-between"><b>Seria ' + (k + 1) + ' z ' + q.sets.length + '</b><span class="muted small">' + (s.done ? 'zrobiona' : 'cel: ' + range(ex, q) + (q.dl ? '' : ' · RIR ' + CYCLE[d.week ?? 0].rir)) + '</span></div>' +
    '<div class="steppers"><div class="stp"><label for="kg-' + i + '">' + unitHead(ex) + '</label><div class="ctl"><button data-act="step" data-f="kg" data-d="-1" data-i="' + i + '" aria-label="Mniej kg">−</button><input id="kg-' + i + '" inputmode="decimal" autocomplete="off" data-f="kg" data-i="' + i + '" data-k="' + k + '" value="' + fmt(s.kg) + '" placeholder="kg"><button data-act="step" data-f="kg" data-d="1" data-i="' + i + '" aria-label="Więcej kg">+</button></div></div>' +
    '<div class="stp"><label for="rp-' + i + '">' + (isS(ex) ? 'Sekundy' : 'Powtórzenia') + '</label><div class="ctl"><button data-act="step" data-f="reps" data-d="-1" data-i="' + i + '" aria-label="Mniej">−</button><input id="rp-' + i + '" inputmode="numeric" autocomplete="off" data-f="reps" data-i="' + i + '" data-k="' + k + '" value="' + (s.reps ?? '') + '" placeholder="' + q.lo + '"><button data-act="step" data-f="reps" data-d="1" data-i="' + i + '" aria-label="Więcej">+</button></div></div></div>' +
    (s.done ? '<button class="btn wide" data-act="undo" data-i="' + i + '">Cofnij odhaczenie</button>' : '<button class="btn ok big" data-act="save" data-i="' + i + '">Seria zrobiona ✓</button>') + '</div>';
  if (ex.kind === 'bar') h += '<div class="plates" id="pl' + i + '">' + platesHTML(s.kg) + '</div>';
  if (q.sets.length > 1 && !q.sets[q.sets.length - 1].done) h += '<button class="linkbtn" style="align-self:flex-start" data-act="rmset" data-i="' + i + '">Usuń ostatnią serię</button>';
  h += '<div class="pl-nav"><button class="btn" data-act="prev"' + (i === 0 ? ' disabled' : '') + '>‹ Poprzednie</button><button class="btn' + (exDone(q) ? ' primary' : '') + '" data-act="next">' + (i === n - 1 ? 'Zakończ ✓' : 'Następne ›') + '</button></div><p class="muted small center">Możesz też przesunąć palcem w bok</p></section>';
  const rest = d.ex.map((x, j) => [x, j]).filter(([x, j]) => j !== i && !exDone(x));
  if (rest.length) h += '<section class="card" style="padding-block:6px"><div class="eyebrow" style="padding-top:8px">Zostało</div><ul class="exlist">' + rest.map(([x, j]) => { const e = EX[x.id]; const nd = x.sets.filter(s2 => s2.done).length; return exRow(x.id, '›', '<span class="hn" style="display:block">' + (j + 1) + '. · ' + x.sets.length + ' × ' + range(e, x) + (nd ? ' · ' + nd + ' zrobione' : '') + '</span>', 'go-ex', ' data-i="' + j + '"'); }).join('') + '</ul></section>';
  return h + '</div>';
}
function volBars(done, only) {
  const keys = only || Object.keys(MUSCLES); const MAX = 24; const pc = v => Math.min(100, v / MAX * 100);
  return '<div class="vol">' + keys.map(k => {
    const d = done[k] || 0; const [lo, hi] = MUSCLE_INFO[k].target;
    return '<button class="vrow" data-act="muscle" data-m="' + k + '"><span>' + MUSCLES[k] + '</span><span class="vtrack"><span class="vzone" style="left:' + pc(lo) + '%;width:' + (pc(hi) - pc(lo)) + '%"></span><span class="vfill" style="width:' + pc(d) + '%"></span></span><span class="n">' + fmt(Math.round(d * 10) / 10) + '</span></button>';
  }).join('') + '</div>';
}
function viewRecovery() {
  const rec = recovery(S.workouts); const wk = weeklySets(S.workouts);
  const order = Object.keys(MUSCLES).sort((a, b) => rec[a].pct - rec[b].pct);
  let h = '<div class="stack">';
  h += '<section class="card stack" style="gap:10px"><div class="bm-wrap" data-act="bm">' + bodyMap(rec) + '</div><div class="legend"><span><i class="ready"></i>gotowe 85%+</span><span><i class="partial"></i>60–84%</span><span><i class="tired"></i>zmęczone</span></div><p class="muted small center">Dotknij mięśnia, żeby zobaczyć szczegóły</p></section>';
  h += '<section class="card"><ul class="reclist">' + order.map(m => { const r = rec[m]; const st = status(r.pct); return '<li><button data-act="muscle" data-m="' + m + '"><span class="rec-dot ' + st + '"></span><span class="nm">' + MUSCLES[m] + '</span><span class="rbar"><b class="' + st + '" style="width:' + r.pct + '%"></b></span><span class="mono pct">' + r.pct + '%</span><span class="muted small eta">' + (r.readyIn ? 'za ' + hoursTxt(r.readyIn) : (r.last ? 'gotowe' : '—')) + '</span></button></li>'; }).join('') + '</ul></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Serie w ostatnich 7 dniach</div>' + volBars(wk, TRAINABLE) + '<div class="legend"><span><i style="background:var(--accent)"></i>zrobione serie</span><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1px var(--ok)"></i>zalecany zakres</span></div><p class="muted small">Ćwiczenie pomocnicze liczy się jako pół serii. Generator dokłada serie tam, gdzie brakuje ich do zakresu.</p></section>';
  return h + '</div>';
}
/* ---------- Exercises: pick a body part, then narrow down with simple filters ---------- */
const PARTS = [['chestsh', 'Klatka i barki', ['chest', 'delts'], 'bench'], ['back', 'Plecy', ['back'], 'pullup'], ['arms', 'Ramiona', ['biceps', 'triceps'], 'curl'], ['legs', 'Nogi', ['quads', 'hams', 'calves'], 'squat'], ['glutes', 'Pośladki', ['glutes'], 'glutebridge'], ['abs', 'Brzuch', ['abs'], 'cablecrunch'], ['forearms', 'Przedramiona', ['forearms'], 'hammer']];
const evBadge = e => (e.ev ? '<span class="evok" title="' + EV_NAME[e.ev.l] + '">✓ Badania</span>' : '');
const exOrder = e => (e.ev ? (e.ev.l === 'A' ? 0 : 1) : 2);
function exRows(list) {
  return '<ul class="list">' + list.map(e => '<li><button class="lrow' + (S.settings.exclude.includes(e.id) ? ' off' : '') + '" data-act="sheet-open" data-id="' + e.id + '"><span class="thumb">' + thumb(e.id) + '</span><span class="lmain"><b>' + e.n + '</b><span>' + KINDN[e.kind] + ' · ' + (headLine(e) || primary(e).map(k => MUSCLES[k]).join(', ')) + '</span>' + evBadge(e) + '</span><span class="chev" aria-hidden="true">›</span></button></li>').join('') + '</ul>';
}
function exSections(list) {
  const ev = list.filter(e => e.ev).sort((a, b) => exOrder(a) - exOrder(b)); const rest = list.filter(e => !e.ev);
  return (ev.length ? '<div class="sec-h">Potwierdzone badaniami <span class="muted small">' + ev.length + '</span></div>' + exRows(ev) : '') +
    (rest.length && !UI.onlyEv ? '<div class="sec-h">Pozostałe ćwiczenia <span class="muted small">' + rest.length + '</span></div><p class="muted small hint-p">Bez badań mierzących przyrost mięśni. Możesz je dodać do planu sam.</p>' + exRows(rest) : '');
}
const chip = (act, v, label, on) => '<button class="pill" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '">' + label + '</button>';
function viewAtlas() {
  const A = UI.at; const q = UI.aq.trim().toLowerCase();
  const base = Object.values(EX).filter(e => listable(e, true) && (!UI.onlyEv || usable(e)) && (UI.ak === 'all' || e.kind === UI.ak) && (!UI.mine || canDo(e, equip())));
  let h = '<div class="atl-head"><input class="search" id="aq" type="search" placeholder="Szukaj, np. wiosłowanie" value="' + esc(UI.aq) + '" aria-label="Szukaj ćwiczenia"></div><div class="stack">';
  const toggles = '<div class="filters" role="group" aria-label="Opcje">' + '<button class="pill tog" data-act="only-ev" aria-pressed="' + UI.onlyEv + '">' + (UI.onlyEv ? '✓ ' : '') + 'Tylko z badaniami</button><button class="pill tog" data-act="mine" aria-pressed="' + UI.mine + '">' + (UI.mine ? '✓ ' : '') + 'Mój sprzęt</button>' + [['all', 'Każdy sprzęt']].concat(KINDS).map(([k, l]) => chip('ak', k, l, UI.ak === k)).join('') + '</div>';
  if (q) {
    const list = base.filter(e => (e.n + ' ' + e.en + ' ' + Object.keys(e.m).map(m => MUSCLES[m]).join(' ')).toLowerCase().includes(q));
    return h + toggles + '<p class="muted small">' + exWord(list.length) + '</p>' + (list.length ? exSections(list) : '<p class="muted">Nic nie pasuje.</p>') + '</div>';
  }
  const part = PARTS.find(p => p[0] === A.part);
  if (!part) {
    h += '<h2 class="step-t">Wybierz <em>partię</em></h2><div class="parts">' + PARTS.map(([k, l, ms, ph]) => {
      const all = Object.values(EX).filter(e => listable(e, true) && primary(e).some(m => ms.includes(m))); const nEv = all.filter(usable).length;
      return '<button class="part" data-act="at-part" data-v="' + k + '"><span class="part-ph">' + (EX[ph] ? (EX[ph].ek ? '<img class="ill" src="' + illSrc(EX[ph], 1) + '" alt="" loading="lazy" decoding="async">' : '<img src="' + photoSrc(EX[ph], 1) + '" alt="" loading="lazy">') : '') + '</span><b>' + l + '</b><span class="pn">' + exWord(all.length) + '</span>' + (nEv ? '<span class="pe">✓ ' + nEv + ' z badaniami</span>' : '<span class="pe muted">bez badań</span>') + '</button>';
    }).join('') + '</div><p class="muted small hint-p"><span class="evok">✓ Badania</span> = badania pokazały przyrost mięśni przy tym ćwiczeniu albo jego bliskim wariancie. Tylko takie ćwiczenia dobieram automatycznie.</p>';
    return h + '</div>';
  }
  if (part[2].length === 1) A.m = part[2][0];
  let list = base.filter(e => primary(e).some(m => part[2].includes(m)));
  h += '<h2 class="step-t">' + part[1] + '</h2>';
  if (part[2].length > 1) h += '<div class="filters" role="group" aria-label="Mięsień">' + chip('at-m', '', 'Wszystkie', !A.m) + part[2].map(m => chip('at-m', m, MUSCLES[m], A.m === m)).join('') + '</div>';
  if (A.m) list = list.filter(e => primary(e).includes(A.m));
  if (A.m && HEADS[A.m]) {
    h += '<div class="filters" role="group" aria-label="Część mięśnia">' + chip('at-head', '', 'Cały mięsień', !A.head) + HEADS[A.m].map(([k, l]) => chip('at-head', A.m + '.' + k, l, A.head === A.m + '.' + k)).join('') + '</div>';
    if (A.head) list = list.filter(e => mainHeads(e, A.m).includes(A.head));
  }
  h += '<div class="filters" role="group" aria-label="Pozycja mięśnia">' + chip('at-len', '', 'Każda pozycja', !A.len) + LENS.map(([k, l]) => chip('at-len', k, l, A.len === k)).join('') + '</div>';
  if (A.len) list = list.filter(e => lenOf(e) === A.len);
  h += toggles + '<p class="muted small">' + exWord(list.length) + '</p>' + (list.length ? exSections(list) : '<p class="muted">Nic nie pasuje. <button class="linkbtn" data-act="af-reset">Wyczyść filtry</button></p>');
  return h + '</div>';
}
function atlasBack() {
  if (UI.aq) { UI.aq = ''; return true; }
  if (UI.at.part) { UI.at = {part: null, m: null, head: null, len: null}; return true; }
  return false;
}
function viewProgress() {
  const ws = S.workouts.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  let h = '<div class="stack">';
  const ws7 = weekStart(); const thisWeek = ws.filter(w => new Date(w.date) >= ws7);
  h += '<section class="stats"><div class="stat"><div class="v">' + ws.length + '</div><div class="k">treningów</div></div><div class="stat"><div class="v">' + thisWeek.length + '</div><div class="k">w tym tygodniu</div></div><div class="stat"><div class="v">' + fmt(Math.round(thisWeek.reduce((a, w) => a + volume(w), 0) / 100) / 10) + ' t</div><div class="k">objętość tygodnia</div></div></section>';
  if (!ws.length) return h + '<section class="card empty"><h3>Brak treningów</h3><p class="muted" style="margin-bottom:14px">Zacznij pierwszy trening. Każda odhaczona seria trafi tutaj, a wykres pokaże, jak rośnie ciężar w każdym ćwiczeniu.</p><button class="btn primary" data-act="go" data-tab="train">Przejdź do treningu</button></section></div>';
  const done = [...new Set(ws.flatMap(w => w.ex.map(q => q.id)))].filter(id => EX[id]);
  if (!UI.chartEx || !done.includes(UI.chartEx)) UI.chartEx = done[0];
  const exId = UI.chartEx; const ex = EX[exId]; const h0 = sessionsOf(S.workouts, exId, true);
  const pts = h0.map(q => ({d: q.date, top: Math.max(...q.sets.map(s => s.kg || 0)), e1: Math.max(...q.sets.map(s => e1rm(s.kg, s.reps)))}));
  const best = Math.max(...pts.map(q => q.top)); const bestE = Math.max(...pts.map(q => q.e1));
  h += '<section class="card stack" style="gap:12px"><label class="sec-t" for="chartEx">Progres ciężaru</label><select id="chartEx">' + done.map(id => '<option value="' + id + '"' + (id === exId ? ' selected' : '') + '>' + EX[id].n + '</option>').join('') + '</select>' + chart(pts, ex) +
    '<div class="stats"><div class="stat"><div class="v">' + fmt(best) + '</div><div class="k">rekord, ' + unitHead(ex) + '</div></div><div class="stat"><div class="v">' + (ex.kind === 'bw' || isS(ex) ? '–' : fmt(Math.round(bestE * 2) / 2)) + '</div><div class="k">szac. 1RM, kg</div></div><div class="stat"><div class="v">' + pts.length + '</div><div class="k">treningów</div></div></div>' +
    '<p class="muted" style="font-size:12px">Szacowany 1RM wg wzoru Epleya: ciężar × (1 + powtórzenia / 30).</p></section>';
  h += '<div class="eyebrow" style="margin-top:6px">Ostatnie treningi</div>';
  ws.forEach(w => {
    const mins = w.end ? Math.round((new Date(w.end) - new Date(w.date)) / 60000) : null; const open = UI.openW === w.id;
    h += '<section class="card wk"><button class="wk-h" data-act="openw" data-id="' + w.id + '" aria-expanded="' + open + '"><span><h3>' + esc(w.dayName || 'Trening') + '</h3><span class="muted" style="font-size:13px;display:block">' + dateStr(w.date) + (mins ? ' · ' + mins + ' min' : '') + ' · ' + fmt(Math.round(volume(w))) + ' kg</span></span><span class="muted">' + (open ? '▴' : '▾') + '</span></button>' +
      ((w.prs && w.prs.length) || w.deload ? '<div class="row">' + (w.deload ? '<span class="chip dl">Tydzień lżejszy</span>' : '') + (w.prs || []).filter(p => EX[p]).map(p => '<span class="chip pr">Rekord: ' + EX[p].n + '</span>').join('') + '</div>' : '') +
      (open ? '<ul>' + w.ex.filter(q => EX[q.id]).map(q => '<li><span>' + EX[q.id].n + '</span><span>' + q.sets.map(s => (EX[q.id].kind === 'bw' && !s.kg ? 'mc' : fmt(s.kg)) + '×' + s.reps).join(', ') + '</span></li>').join('') + '</ul><div class="row" style="justify-content:flex-end">' +
        (UI.delW === w.id ? '<span class="muted" style="font-size:13px">Usunąć ten trening?</span><button class="btn sm danger" data-act="delw-yes" data-id="' + w.id + '">Usuń</button><button class="btn sm ghost" data-act="delw-no">Anuluj</button>' : '<button class="btn sm ghost" data-act="delw" data-id="' + w.id + '">Usuń trening</button>') + '</div>' : '') + '</section>';
  });
  return h + '</div>';
}
function chart(pts, ex) {
  if (pts.length < 2) return '<p class="muted" style="font-size:14px">Wykres pojawi się po drugim treningu z tym ćwiczeniem.</p>';
  const Wd = 340, H = 170, L = 40, Rp = 12, Tp = 12, B = 26; const vals = pts.map(q => q.top);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi === lo) { lo -= 5; hi += 5; }
  const span = hi - lo; const step = [1, 2, 2.5, 5, 10, 20, 25, 50].find(s => span / s <= 4) || 100; lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = i => L + (Wd - L - Rp) * (i / (pts.length - 1)); const Y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
  let g = ''; for (let v = lo; v <= hi + 1e-9; v += step) g += '<line x1="' + L + '" x2="' + (Wd - Rp) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" style="stroke:var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" style="fill:var(--muted);font:11px var(--mono)">' + fmt(v) + '</text>';
  const line = pts.map((q, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(q.top).toFixed(1)).join(' ');
  const area = line + ' L' + X(pts.length - 1).toFixed(1) + ' ' + (H - B) + ' L' + L + ' ' + (H - B) + ' Z';
  const lab = [0, pts.length - 1].map(i => '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (i ? 'end' : 'start') + '" style="fill:var(--muted);font:11px var(--body)">' + new Date(pts[i].d).toLocaleDateString(locale(), {day: 'numeric', month: 'short'}) + '</text>').join('');
  const dots = pts.map((q, i) => '<circle cx="' + X(i) + '" cy="' + Y(q.top) + '" r="' + (i === pts.length - 1 ? 5 : 3) + '" style="fill:' + (i === pts.length - 1 ? 'var(--accent)' : 'var(--surface)') + ';stroke:var(--accent)" stroke-width="2"/>').join('');
  return '<svg class="chart" viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="Najcięższa seria na treningu, ' + unitHead(ex) + '">' + g + '<path d="' + area + '" style="fill:var(--accent);opacity:.12"/><path d="' + line + '" style="fill:none;stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>' + dots + lab + '</svg>';
}
function viewSettings() {
  const st = S.settings; const wk = cycleWeek();
  let h = '<div class="stack">';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Jak układać trening</div><div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="Tryb"><button data-act="set-mode" data-v="auto" aria-pressed="' + (st.mode === 'auto') + '">Automatycznie</button><button data-act="set-mode" data-v="plan" aria-pressed="' + (st.mode === 'plan') + '">Mój plan</button></div>' +
    '<p class="muted small">' + (st.mode === 'auto' ? 'Każdy trening dobiera się do regeneracji mięśni, sprzętu i czasu.' : 'Plan tygodnia pokazuje trening według dnia tygodnia. Gotowe plany idą po kolei. Ćwiczenia, których nie zrobisz na swoim sprzęcie, zamieniają się same.') + '</p>';
  if (st.mode === 'plan') {
    const cur = allPlans()[st.plan];
    h += '<div class="plans" role="group" aria-label="Wybór planu">' + Object.entries(allPlans()).map(([k, q]) => '<button data-act="set-plan" data-v="' + k + '" aria-pressed="' + (k === st.plan) + '"' + (q.custom ? ' class="own"' : '') + '><b>' + q.perWeek + ' ' + daysWord(q.perWeek) + '</b><span>' + esc(q.name) + '</span><span>' + q.level + '</span></button>').join('') +
      '<button class="plan-new" data-act="plan-new"><b>+</b><span>Plan tygodnia</span><span>Dni i partie mięśni</span></button></div>';
    if (cur) h += cur.custom ? '<button class="btn sm" data-act="plan-edit" data-v="' + st.plan + '">Edytuj plan „' + esc(cur.name) + '”</button>' : '<button class="btn sm ghost" data-act="plan-copy" data-v="' + st.plan + '">Skopiuj „' + esc(cur.name) + '” i dopasuj do siebie</button>';
  } else h += '<button class="btn sm" data-act="plan-new">+ Zaplanuj tydzień: dni i partie mięśni</button>';
  h += '</section>';
  h += '<ul class="list"><li><button class="lrow" data-act="go-ai" data-v="cfg">' + icon('ai', '#0A84FF') + '<span class="lmain"><b>Trener AI</b><span>' + (aiReady(S.ai) ? PROVIDERS[S.ai.provider].name + ' · ' + esc(S.ai.model || PROVIDERS[S.ai.provider].model) : 'Nie połączono. Dotknij, żeby dodać klucz API.') + '</span></span><span class="chev">›</span></button></li></ul>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Siłownie i sprzęt</div><ul class="profiles">' + S.profiles.map(p => {
    const open = UI.editProfile === p.id;
    return '<li class="' + (p.id === st.profile ? 'cur' : '') + '"><div class="prow"><button class="pname" data-act="set-profile" data-v="' + p.id + '"><span class="radio" aria-hidden="true"></span><span><b>' + esc(p.name) + '</b><span class="muted small" style="display:block">' + (p.equip.length ? p.equip.map(e => EQUIPMENT.find(x => x[0] === e)[1]).join(', ') : 'bez sprzętu') + '</span></span></button><button class="btn sm ghost" data-act="edit-profile" data-v="' + p.id + '" aria-expanded="' + open + '">' + (open ? 'Gotowe' : 'Edytuj') + '</button></div>' +
      (open ? '<div class="pedit"><label class="field"><span>Nazwa</span><input id="pname-' + p.id + '" data-pid="' + p.id + '" class="pname-in" value="' + esc(p.name) + '" maxlength="24"></label><div class="eqgrid">' + EQUIPMENT.map(([k, l]) => '<label class="eq"><input type="checkbox" data-pid="' + p.id + '" data-eq="' + k + '"' + (p.equip.includes(k) ? ' checked' : '') + '> ' + l + '</label>').join('') + '</div><p class="muted small">Ćwiczenia z tym sprzętem: ' + Object.values(EX).filter(e => usable(e) && canDo(e, p.equip)).length + ' z ' + Object.values(EX).filter(usable).length + '</p>' + (S.profiles.length > 1 ? '<button class="btn sm danger" data-act="del-profile" data-v="' + p.id + '">Usuń tę siłownię</button>' : '') + '</div>' : '') + '</li>';
  }).join('') + '</ul><button class="btn sm" data-act="add-profile">+ Dodaj siłownię</button></section>';
  if (st.exclude.length) h += '<section class="card stack" style="gap:8px"><div class="sec-t">Nie proponuj</div><div class="row">' + st.exclude.map(id => '<button class="pill" data-act="unexclude-id" data-v="' + id + '">' + EX[id].n + ' ×</button>').join('') + '</div><p class="muted small">Dotknij, żeby znów proponować.</p></section>';
  h += '<section class="card stack" style="gap:10px"><div class="row" style="justify-content:space-between"><div class="sec-t">Cykl 6 tygodni</div><span class="chip">tydzień ' + (wk + 1) + '</span></div>' + cycleBar(wk) +
    '<div class="cycgrid">' + CYCLE.map((c, i) => '<div' + (i === wk ? ' class="now"' : '') + '><b>T' + (i + 1) + '</b><span>' + (c.deload ? 'lżej' : 'RIR ' + c.rir) + '</span></div>').join('') + '</div>' +
    '<p class="muted small">Wysiłek rośnie z tygodnia na tydzień, co 6. tydzień jest lżejszy.</p><button class="btn sm" data-act="cycle-reset">Zacznij cykl od tego tygodnia</button></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t" data-noi18n>Język · Language</div><div class="seg" style="grid-template-columns:repeat(3,1fr)" role="group" aria-label="Język">' + [['auto', 'Automatycznie'], ['pl', 'Polski'], ['en', 'English']].map(([k, l]) => '<button data-act="set-lang" data-v="' + k + '" aria-pressed="' + ((st.lang || 'auto') === k) + '"' + (k !== 'auto' ? ' data-noi18n' : '') + '>' + l + '</button>').join('') + '</div><p class="muted small">Język aplikacji. Automatycznie: polski na telefonach po polsku, angielski na pozostałych.</p></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Wygląd</div><div class="seg" style="grid-template-columns:repeat(3,1fr)" role="group" aria-label="Motyw">' + [['navy', 'Granatowy'], ['light', 'Jasny'], ['system', 'Jak telefon']].map(([k, l]) => '<button data-act="set-theme" data-v="' + k + '" aria-pressed="' + ((st.theme || 'navy') === k) + '">' + l + '</button>').join('') + '</div></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Przerwa między seriami</div><div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="Start przerwy"><button data-act="set-rest-auto" data-v="1" aria-pressed="' + (st.restAuto !== false) + '">Sama po serii</button><button data-act="set-rest-auto" data-v="0" aria-pressed="' + (st.restAuto === false) + '">Ręcznie</button></div>' +
    '<div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="Sygnał końca przerwy"><button data-act="set-rest-sound" data-v="1" aria-pressed="' + (st.restSound !== false) + '">Dźwięk i wibracja</button><button data-act="set-rest-sound" data-v="0" aria-pressed="' + (st.restSound === false) + '">Tylko wibracja</button></div>' +
    '<p class="muted small">Odliczanie rusza po odhaczeniu serii, a długość bierze z planu. Ręcznie włączysz ją przyciskiem ⏱ przy ćwiczeniu. Ostatnie 3 sekundy pikają, a koniec przerwy daje sygnał. W aplikacji na Androida przyjdzie też powiadomienie, gdy telefon jest zablokowany.</p></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Gryf</div><div class="seg" style="grid-template-columns:repeat(3,1fr)">' + [20, 15, 10].map(b => '<button data-act="set-bar" data-v="' + b + '" aria-pressed="' + (st.bar === b) + '">' + b + ' kg</button>').join('') + '</div><p class="muted small">Do kalkulatora talerzy przy ćwiczeniach ze sztangą.</p></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Twoje dane</div><p class="muted small">Treningi zapisują się tylko w tym telefonie (' + S.workouts.length + ' treningów). Zrób kopię, żeby przenieść je na inne urządzenie.</p>' +
    '<div class="row"><button class="btn sm" data-act="export">Zapisz kopię (plik)</button><label class="btn sm ghost filebtn">Wczytaj kopię<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>' +
    '<details class="paste"><summary>Wklej dane z poprzedniej wersji</summary><textarea id="pasteData" rows="4" placeholder="Wklej tu skopiowane dane"></textarea><button class="btn sm" data-act="paste-import">Wczytaj</button></details>' +
    (UI.wipe ? '<div class="confirm card"><p>Usunąć wszystkie treningi i ustawienia z tego telefonu?</p><div class="row"><button class="btn sm danger" data-act="wipe-yes">Usuń wszystko</button><button class="btn sm ghost" data-act="wipe-no">Anuluj</button></div></div>' : '<button class="linkbtn danger-link" data-act="wipe">Usuń wszystkie dane</button>') + '</section>';
  h += '<button class="linkcard" data-act="go-know"><span><b>Wiedza</b><span class="muted small" style="display:block">Zasady treningu na masę i źródła</span></span><span aria-hidden="true">›</span></button>';
  h += '<p class="muted small center">Mój Trener · wersja 2.9</p>';
  return h + '</div>';
}
function peStepper(label, f, val, di, i, rest) {
  return '<div class="pe-stp"><span>' + label + '</span><div class="ctl"><button data-act="pe-step" data-f="' + f + '" data-d="' + di + '" data-i="' + i + '" data-dir="-1" aria-label="' + label + ' mniej">−</button><b class="mono">' + (rest ? mmss(val) : val) + '</b><button data-act="pe-step" data-f="' + f + '" data-d="' + di + '" data-i="' + i + '" data-dir="1" aria-label="' + label + ' więcej">+</button></div></div>';
}
/** Editable exercise list of one plan day (tap to change sets, reps and rest). */
function peExList(d, di) {
  return '<ol class="pe-list">' + d.ex.map((e, i) => {
    const ex = EX[e.id]; const open = UI.peOpen === di + '-' + i;
    return '<li class="pe-ex' + (open ? ' open' : '') + '"><div class="pe-row"><button class="thumb" data-act="pe-swap" data-t="ruch" data-d="' + di + '" data-i="' + i + '" aria-label="Technika: ' + ex.n + '">' + thumb(e.id) + '</button>' +
      '<button class="pe-main" data-act="pe-open" data-d="' + di + '" data-i="' + i + '" aria-expanded="' + open + '"><b>' + ex.n + '</b><span class="mono">' + e.sets + ' × ' + range(ex, e) + ' · przerwa ' + mmss(e.rest) + '</span></button>' +
      '<div class="pe-ord"><button data-act="pe-move" data-d="' + di + '" data-i="' + i + '" data-dir="-1" aria-label="Przesuń wyżej"' + (i === 0 ? ' disabled' : '') + '>▲</button><button data-act="pe-move" data-d="' + di + '" data-i="' + i + '" data-dir="1" aria-label="Przesuń niżej"' + (i === d.ex.length - 1 ? ' disabled' : '') + '>▼</button></div></div>' +
      (open ? '<div class="pe-edit">' + peStepper('Serie', 'sets', e.sets, di, i) + peStepper(isS(ex) ? 'Od, s' : 'Powt. od', 'lo', e.lo, di, i) + peStepper(isS(ex) ? 'Do, s' : 'Powt. do', 'hi', e.hi, di, i) + peStepper('Przerwa', 'rest', e.rest, di, i, true) + '<div class="pe-acts"><button class="btn sm primary" data-act="pe-swap" data-t="alt" data-d="' + di + '" data-i="' + i + '">↻ Zamień ćwiczenie</button><button class="btn sm ghost" data-act="pe-swap" data-t="ruch" data-d="' + di + '" data-i="' + i + '">Technika</button><button class="linkbtn danger-link" data-act="pe-ex-del" data-d="' + di + '" data-i="' + i + '">Usuń z planu</button></div></div>' : '') + '</li>';
  }).join('') + '</ol>';
}
function planVolume(c) {
  const vol = planLoad(c.days); const ms = TRAINABLE; const low = ms.filter(m => (vol[m] || 0) < MUSCLE_INFO[m].target[0]); const high = ms.filter(m => (vol[m] || 0) > MUSCLE_INFO[m].target[1]);
  return '<section class="card stack" style="gap:10px"><div class="sec-t">Serie na partię w tygodniu</div><p class="muted small">Zielone pole to zalecany zakres (10–20 serii na duże partie).</p>' + volBars(vol, ms) +
    (low.length ? '<p class="notice small"><b>Mało serii:</b> ' + low.map(m => MUSCLES[m]).join(', ') + '.</p>' : '') + (high.length ? '<p class="notice small"><b>Dużo serii:</b> ' + high.map(m => MUSCLES[m]).join(', ') + '. Regeneracja może nie nadążyć.</p>' : '') + (!low.length && !high.length ? '<p class="small">Każda partia ma zalecaną liczbę serii.</p>' : '') + '</section>';
}
/** Weekly plan: weekday → muscle groups → exercises filled in automatically. */
function viewWeekEdit(c) {
  const using = S.settings.mode === 'plan' && S.settings.plan === c.id; const usable0 = c.days.some(d => d.ex.length);
  let h = '<div class="stack">';
  h += '<section class="card stack" style="gap:10px"><label class="field"><span>Nazwa planu</span><input id="pe-name" class="pe-in" maxlength="30" value="' + esc(c.name) + '"></label>' +
    '<button class="btn ' + (using ? 'ok' : 'primary') + ' wide" data-act="pe-use"' + (usable0 && !using ? '' : ' disabled') + '>' + (using ? '✓ Używasz tego planu' : 'Używaj tego planu') + '</button></section>';
  if (!c.days.length) h += '<div class="sec-h">Szybki start</div><ul class="list">' + PRESETS.map(pr => '<li><button class="lrow" data-act="pe-preset" data-v="' + pr.id + '"><span class="lmain"><b>' + pr.name + '</b><span>' + Object.keys(pr.days).map(wd => WD_SHORT[wd] + ': ' + dayName(pr.days[wd])).join(' · ') + '</span></span><span class="chev">›</span></button></li>').join('') + '</ul><p class="muted small">Albo wybierz dzień poniżej i zaznacz partie mięśni.</p>';
  h += '<div class="sec-h">Dni tygodnia</div><ul class="list week-list">' + WEEKDAYS.map((wn, wd) => {
    const di = c.days.findIndex(d => d.wd === wd); const d = c.days[di]; const open = UI.peWd === wd;
    let li = '<li class="' + (open ? 'open' : '') + '"><button class="lrow" data-act="pe-wd" data-v="' + wd + '" aria-expanded="' + open + '"><span class="wdname">' + WD_SHORT[wd] + '</span><span class="lmain"><b>' + wn + '</b><span>' + (d ? esc(d.mus.map(m => MUSCLES[m]).join(', ')) + ' · ' + d.ex.length + ' ćw. · ok. ' + estMin(d.ex, false) + ' min' : 'Odpoczynek') + '</span></span><span class="chev' + (open ? ' up' : '') + '" aria-hidden="true">›</span></button>';
    if (open) {
      li += '<div class="wd-edit"><div class="eyebrow">Partie mięśni</div><div class="mgrid" role="group" aria-label="Partie mięśni na ' + wn + '">' + TRAINABLE.map(m => '<button class="mtog" data-act="pe-mus" data-wd="' + wd + '" data-m="' + m + '" aria-pressed="' + !!(d && d.mus.includes(m)) + '">' + MUSCLES[m] + '</button>').join('') + '</div>';
      if (d) li += '<div class="eyebrow">Ćwiczenia, dobrane automatycznie</div>' + peExList(d, di) + '<div class="row"><button class="btn sm" data-act="pick-open" data-target="plan" data-d="' + di + '">+ Dodaj</button><button class="btn sm ghost" data-act="pe-refill" data-d="' + di + '">↻ Dobierz inne</button></div>';
      else li += '<p class="muted small">Zaznacz partie, a dobiorę ćwiczenia z badaniami przyrostu.</p>';
      li += '</div>';
    }
    return li + '</li>';
  }).join('') + '</ul>';
  if (c.days.length) h += planVolume(c);
  h += UI.peDel === 'plan' ? '<div class="card confirm"><p>Usunąć plan „' + esc(c.name) + '”? Historia treningów zostanie.</p><div class="row"><button class="btn sm danger" data-act="pe-del-yes">Usuń plan</button><button class="btn sm ghost" data-act="pe-cancel">Anuluj</button></div></div>' : '<button class="linkbtn danger-link" data-act="pe-del">Usuń plan</button>';
  return h + '</div>';
}
function viewPlanEdit() {
  const c = curPlan(); if (!c) return '<p class="muted">Ten plan już nie istnieje.</p>';
  if (c.week) return viewWeekEdit(c);
  const using = S.settings.mode === 'plan' && S.settings.plan === c.id; const usable = c.days.some(d => d.ex.length);
  let h = '<div class="stack">';
  h += '<section class="card stack" style="gap:10px"><label class="field"><span>Nazwa planu</span><input id="pe-name" class="pe-in" maxlength="30" value="' + esc(c.name) + '"></label>' +
    '<button class="btn ' + (using ? 'ok' : 'primary') + ' wide" data-act="pe-use"' + (usable && !using ? '' : ' disabled') + '>' + (using ? '✓ Używasz tego planu' : 'Używaj tego planu') + '</button>' + (usable ? '' : '<p class="muted small">Dodaj ćwiczenia, żeby móc używać planu.</p>') + '</section>';
  c.days.forEach((d, di) => {
    h += '<section class="card stack pe-day" style="gap:8px"><div class="pe-dayhead"><input class="pe-in pe-dayname" data-d="' + di + '" maxlength="24" value="' + esc(d.name) + '" aria-label="Nazwa dnia ' + (di + 1) + '"><span class="muted small">' + d.ex.length + ' ćw. · ok. ' + estMin(d.ex, false) + ' min</span></div>';
    if (!d.ex.length) h += '<p class="muted small">Brak ćwiczeń. Dodaj pierwsze.</p>';
    h += peExList(d, di);
    h += '<div class="row"><button class="btn sm" data-act="pick-open" data-target="plan" data-d="' + di + '">+ Dodaj ćwiczenie</button>' +
      (UI.peDel === di ? '<span class="muted small">Usunąć dzień?</span><button class="btn sm danger" data-act="pe-day-del-yes" data-d="' + di + '">Usuń</button><button class="btn sm ghost" data-act="pe-cancel">Anuluj</button>' : (c.days.length > 1 ? '<button class="btn sm ghost" data-act="pe-day-del" data-d="' + di + '">Usuń dzień</button>' : '')) + '</div></section>';
  });
  if (c.days.length < 7) h += '<button class="btn wide" data-act="pe-day-add">+ Dodaj dzień</button>';
  h += planVolume(c);
  h += UI.peDel === 'plan' ? '<div class="card confirm"><p>Usunąć plan „' + esc(c.name) + '”? Historia treningów zostanie.</p><div class="row"><button class="btn sm danger" data-act="pe-del-yes">Usuń plan</button><button class="btn sm ghost" data-act="pe-cancel">Anuluj</button></div></div>' : '<button class="linkbtn danger-link" data-act="pe-del">Usuń plan</button>';
  return h + '</div>';
}
const SRC = [
  ['NASM: model OPT, faza hipertrofii', 'https://www.nasm.org/certified-personal-trainer/the-opt-model'],
  ['Active IQ: Level 3 Diploma in Fitness Instructing and Personal Training', 'https://www.ActiveIQ.co.uk/docs/default-source/pdf/q3dfipt-declared-purpose-v2.pdf'],
  ['NCCPT: podstawowe wzorce ruchowe', 'https://open-exam-prep.com/study-guides/nccpt-cpt/exercise-technique/fundamental-movement-patterns'],
  ['Pelland i in.: objętość i częstotliwość a hipertrofia', 'https://sportrxiv.org/index.php/server/preprint/view/460'],
  ['Bliskość upadku mięśniowego a hipertrofia', 'https://biolayne.com/reps/issue-32/the-failure-factor-the-relationship-between-proximity-to-failure-and-strength-and-hypertrophy/'],
  ['Schoenfeld 2016: przerwy 1 vs 3 min', 'https://brookbushinstitute.com/article/longer-interset-rest-periods-enhance-muscle-strength-hypertrophy-resistance-trained-men'],
  ['Maeo 2021: uginanie nóg siedząc vs leżąc', 'https://sci-sport.com/en/hypertrophy-and-hamstring-protection-seated-prone-leg-curl/'],
  ['Maeo 2022: triceps nad głową vs wyciąg', 'https://sci-sport.com/en/triceps-hypertrophy-impact-of-arm-position/'],
  ['Bell i in. 2024: praktyki deloadu', 'https://doaj.org/article/7d15e260e0ac4cff9e8c685dd7335389'],
  ['fabrykasily.pl: budowanie masy, podejście oparte na badaniach', 'https://www.fabrykasily.pl/treningi/budowanie-masy-miesniowej-aktualne-podejscie-oparte-na-badaniach'],
  ['budujmase.pl: 10 najlepszych ćwiczeń na masę', 'https://www.budujmase.pl/trening/10-najlepszych-cwiczen-na-mase-miesniowa.html'],
  ['Zdjęcia ćwiczeń: free-exercise-db (domena publiczna)', 'https://github.com/yuhonas/free-exercise-db'],
  ['Ilustracje ćwiczeń: Everkinetic (CC BY-SA 4.0), przycięte i przebarwione', 'https://github.com/everkinetic/data'],
];
const protein = bw => (bw ? Math.round(bw * 1.6) + '–' + Math.round(bw * 2) + ' g' : '–');
/* ---------- AI coach ---------- */
const AI_QUICK = ['Co dziś trenować?', 'Oceń mój ostatni tydzień treningów', 'Ułóż mi plan na 4 dni w tygodniu', 'Jak przełamać stagnację w wyciskaniu?', 'Ile białka i kalorii potrzebuję na masę?'];
const WD_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function openAI(cfg, draft) {
  UI.fromSettings = UI.sub === 'settings'; UI.sub = 'ai'; UI.aiForm = {...S.ai}; UI.aiCfg = !!cfg || !aiReady(S.ai);
  if (draft) UI.aiDraft = tt(draft);
  render(); window.scrollTo(0, cfg ? 0 : document.body.scrollHeight);
}
/** What the coach knows about the user: settings, plan, recovery, weekly sets, recent workouts and the exercise list. */
function aiData() {
  const rec = recovery(S.workouts), week = weeklySets(S.workouts), p = plan(), cw = cycleWeek();
  const nm = id => (EX[id] ? EX[id].en : id);
  const best = q => { const top = q.sets.reduce((a, x) => ((x.kg || 0) > (a.kg || 0) ? x : a), q.sets[0] || {}); return (top.kg ? fmt(top.kg).replace(',', '.') + ' kg × ' : '') + (top.reps ?? '?'); };
  const workouts = S.workouts.slice(-10).reverse().map(w => w.date.slice(0, 10) + ' ' + (w.dayName || '') + ': ' + w.ex.map(q => nm(q.id) + ' ' + best(q) + ' (' + q.sets.length + ' sets)').join('; '));
  const exercises = Object.values(EX).filter(e => listable(e, true)).sort((a, b) => !!usable(b) - !!usable(a)).map(e => e.id + ' | ' + e.n + ' / ' + e.en + ' | ' + primary(e).join(',') + ' | ' + (e.needs.join(',') || 'none') + (usable(e) ? ' ✓' : ''));
  return {
    lang: isEn() ? 'en' : 'pl', today: new Date().toISOString().slice(0, 10), bw: S.settings.bw, duration: S.settings.duration, gym: profile().name, equipment: equip(),
    mode: S.settings.mode === 'plan' ? 'follows the plan below' : 'auto-generated workouts based on recovery',
    cycle: 'week ' + (cw + 1) + ' of 6, ' + (CYCLE[cw].deload ? 'lighter deload week' : CYCLE[cw].rir + ' reps in reserve'),
    plan: {name: p.name, days: p.days.map((d, i) => ({label: p.week ? WD_EN[d.wd] : 'Day ' + (i + 1), ex: d.ex.map(e => nm(e.id) + ' ' + e.sets + 'x' + e.lo + '-' + e.hi)}))},
    recovery: Object.fromEntries(TRAINABLE.map(m => [m, (rec[m] || {pct: 100}).pct])),
    weekly: Object.fromEntries(TRAINABLE.map(m => [m, (Math.round((week[m] || 0) * 10) / 10) + '/' + MUSCLE_INFO[m].target.join('-')])),
    workouts, exercises,
  };
}
async function aiSend(text) {
  text = String(text || '').trim();
  if (!text || UI.aiBusy) return;
  if (!aiReady(S.ai)) { UI.aiDraft = text; openAI(true); return; }
  S.chat.push({role: 'user', text, t: Date.now()}); UI.aiDraft = ''; UI.aiBusy = true; UI.sub = 'ai'; persistNow(); render(); window.scrollTo(0, document.body.scrollHeight);
  try {
    const ans = await ask(S.ai, buildSystem(aiData()), S.chat.filter(m => !m.err).slice(-12));
    const pl = parsePlan(ans, id => !!EX[id] && listable(EX[id], true));
    S.chat.push({role: 'assistant', text: ans, t: Date.now(), ...(pl ? {plan: pl} : {})});
  } catch (err) {
    S.chat.push({role: 'assistant', text: err.message || 'Błąd', detail: err.detail || '', err: true, t: Date.now()});
  }
  UI.aiBusy = false; S.chat = S.chat.slice(-40); persistNow();
  if (UI.sub === 'ai') { render(); const el = document.querySelector('.msg:last-of-type'); if (el) el.scrollIntoView({block: 'start'}); }
  else toast('Trener AI odpowiedział');
}
function aiSave() {
  const f = UI.aiForm; const n = {provider: f.provider, key: String(f.key || '').trim(), model: String(f.model || '').trim(), base: String(f.base || (f.provider === 'custom' ? PROVIDERS.custom.base : '')).trim()};
  if (!aiReady(n)) { toast(n.provider === 'custom' ? 'Podaj adres i nazwę modelu' : 'Wklej klucz API'); return; }
  S.ai = n; UI.aiCfg = false; persistNow(); toast('Połączono z AI'); render();
  if (UI.aiDraft && !S.chat.length) { const d = UI.aiDraft; aiSend(d); }
}
function aiApplyPlan(i) {
  const m = S.chat[i]; if (!m || !m.plan) return;
  const pl = parsePlan('```plan\n' + JSON.stringify(m.plan) + '\n```', id => !!EX[id] && listable(EX[id], true));
  if (!pl) { toast('Ten plan nie pasuje do listy ćwiczeń'); return; }
  const musOf = ex => [...new Set(ex.flatMap(e => primary(EX[e.id])))].slice(0, 6);
  const c = cleanPlan({id: 'ai' + Date.now().toString(36), name: pl.name || tt('Plan od AI'), week: true, days: pl.days.map(d => ({wd: d.wd, name: d.name || dayName(musOf(d.ex)), mus: musOf(d.ex), ex: d.ex}))});
  S.customPlans.push(c); S.settings.plan = c.id; S.settings.mode = 'plan'; S.today = null; persistNow();
  m.applied = c.id; UI.sub = null; UI.tab = 'plan'; render(); window.scrollTo(0, 0); toast('Plan wgrany: ' + c.name);
}
function aiSetup() {
  const f = UI.aiForm || {...S.ai}; const P = PROVIDERS[f.provider] || PROVIDERS.anthropic;
  let h = '<section class="card stack aisetup" style="gap:12px"><div class="sec-t">Połącz trenera AI</div><p class="small">Trener AI działa na Twoim własnym kluczu API. Wybierz dostawcę, wklej klucz i gotowe. Opłaty za zapytania nalicza dostawca, zwykle to grosze za rozmowę.</p>';
  h += '<div class="seg aiprov" role="group" aria-label="Dostawca">' + Object.entries(PROVIDERS).map(([k, v]) => '<button data-act="ai-provider" data-v="' + k + '" aria-pressed="' + (f.provider === k) + '"' + (k === 'custom' ? '' : ' data-noi18n') + '>' + v.name + '</button>').join('') + '</div>';
  if (f.provider === 'custom') h += '<label class="field"><span>Adres API (zgodny z OpenAI)</span><input id="ai-base" value="' + esc(f.base || PROVIDERS.custom.base) + '" autocomplete="off" spellcheck="false" placeholder="https://openrouter.ai/api/v1"></label><p class="muted small">Np. OpenRouter, Groq, Mistral, Ollama albo LM Studio w sieci domowej.</p>';
  h += '<label class="field"><span>Klucz API' + (f.provider === 'custom' ? ' (jeśli wymagany)' : '') + '</span><input id="ai-key" type="password" value="' + esc(f.key || '') + '" autocomplete="off" spellcheck="false" placeholder="' + (f.provider === 'anthropic' ? 'sk-ant-…' : f.provider === 'openai' ? 'sk-…' : f.provider === 'gemini' ? 'AIza…' : '') + '"></label>';
  h += '<label class="field"><span>Model</span><input id="ai-model" value="' + esc(f.model || '') + '" autocomplete="off" spellcheck="false" placeholder="' + esc(P.model || 'np. meta-llama/llama-3.3-70b-instruct') + '"></label>';
  h += '<p class="small"><a href="' + P.keyUrl + '" target="_blank" rel="noopener">Gdzie wziąć klucz? ›</a></p>';
  h += '<button class="btn primary big" data-act="ai-save">Zapisz i połącz</button>' + (aiReady(S.ai) ? '<button class="btn ghost wide" data-act="ai-cfg">Anuluj</button>' : '');
  h += '<p class="muted small">Klucz i rozmowy zostają tylko w tym telefonie i nie trafiają do kopii danych. Z każdym pytaniem do dostawcy wysyłam podsumowanie Twojego planu, ostatnich treningów i regeneracji, żeby rady pasowały do Ciebie.</p></section>';
  return h;
}
function aiBubble(m, i) {
  if (m.role === 'user') return '<div class="msg me" data-noi18n>' + esc(m.text) + '</div>';
  if (m.err) return '<div class="msg ai err"><b>' + esc(m.text) + '</b>' + (m.detail ? '<span class="small muted" data-noi18n>' + esc(m.detail) + '</span>' : '') + '<button class="btn sm" data-act="ai-retry">Spróbuj ponownie</button></div>';
  let h = '<div class="msg ai"><div class="md" data-noi18n>' + md(stripPlan(m.text)) + '</div>';
  if (m.plan) h += '<div class="aiplan"><div class="eyebrow">Plan od AI</div><b class="aiplan-n" data-noi18n>' + esc(m.plan.name || '') + '</b><ul>' + m.plan.days.map(d => '<li><b>' + WEEKDAYS[d.wd] + '</b><span>' + d.ex.map(e => EX[e.id] ? EX[e.id].n : e.id).join(', ') + '</span></li>').join('') + '</ul>' +
    (m.applied ? '<p class="small okdot">✓ Wgrany do Twoich planów</p>' : '<button class="btn primary wide" data-act="ai-plan" data-i="' + i + '">Wgraj ten plan</button>') + '</div>';
  return h + '</div>';
}
function viewAI() {
  let h = '<div class="stack aiview">';
  if (UI.aiCfg || !aiReady(S.ai)) { h += aiSetup(); if (!aiReady(S.ai)) return h + '</div>'; }
  if (!S.chat.length) h += '<section class="card aihello">' + icon('ai', '#0A84FF') + '<div><b>Twój trener AI</b><p class="small muted">Zna Twój plan, ostatnie treningi i regenerację. Zapytaj o technikę, plan, stagnację albo dietę. Gdy poprosisz o plan, wgrasz go jednym dotknięciem.</p></div></section>';
  h += '<div class="chat">' + S.chat.map(aiBubble).join('') + (UI.aiBusy ? '<div class="msg ai busy"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Trener myśli…</span></div>' : '') + '</div>';
  if (!UI.aiBusy) h += '<div class="qchips">' + AI_QUICK.map((q, i) => '<button class="pill" data-act="ai-quick" data-i="' + i + '">' + q + '</button>').join('') + '</div>';
  h += '<div class="composer"><textarea id="aiIn" rows="2" placeholder="Zapytaj trenera…">' + esc(UI.aiDraft || '') + '</textarea><button class="btn primary" data-act="ai-send"' + (UI.aiBusy ? ' disabled' : '') + '>Wyślij</button></div>';
  h += '<div class="row aifoot"><button class="linkbtn" data-act="ai-cfg"><span data-noi18n>' + PROVIDERS[S.ai.provider].name + ' · ' + esc(S.ai.model || PROVIDERS[S.ai.provider].model) + '</span> · zmień</button>' + (S.chat.length ? '<button class="linkbtn" data-act="ai-clear">Wyczyść rozmowę</button>' : '') + '</div>';
  h += '<p class="muted small">AI może się mylić. Przy bólu lub urazie skonsultuj się z fizjoterapeutą albo lekarzem.</p>';
  return h + '</div>';
}

function viewKnow() {
  const bw = S.settings.bw || 80;
  const R2 = [['72 h', 'Regeneracja', 'Po treningu mięsień potrzebuje czasu: duże partie ok. 72 h, barki i ramiona ok. 48 h, łydki i brzuch ok. 36 h. Generator wybiera partie, które są już gotowe.'],
    ['10–20', 'Serie na partię tygodniowo', 'Więcej serii daje więcej wzrostu, ale każda kolejna dokłada coraz mniej. Ćwiczenie pomocnicze liczy się jako pół serii, tak jak w metaanalizie Pellanda.'],
    ['6–12', 'Zakres powtórzeń', 'W wielostawowych 6–12, w izolacjach 10–20. Model OPT z kursu NASM zaleca w fazie hipertrofii 3–6 serii po 6–12 powtórzeń przy 75–85% maksimum.'],
    ['RIR', 'Zapas powtórzeń', 'Im bliżej upadku mięśniowego, tym większy wzrost. Cykl zaczyna od 3 powtórzeń w zapasie i dochodzi do 0–1 w 5. tygodniu.'],
    ['2–3′', 'Przerwy', 'W ćwiczeniach wielostawowych 2–3 minuty. W badaniu Schoenfelda przerwy 3-minutowe dały większy przyrost mięśni ud niż 1-minutowe.'],
    ['+', 'Podwójna progresja', 'Najpierw dokładasz powtórzenia w zakresie. Gdy zrobisz górę zakresu we wszystkich seriach, aplikacja podnosi ciężar.'],
    ['6. tydz.', 'Tydzień lżejszy', 'Trenujący siłowo robią deload średnio co ok. 5–6 tygodni: mniej serii, lżej, większy zapas.']];
  return '<div class="stack"><section class="card"><ul class="rules">' + R2.map(r => '<li><span class="big mono">' + r[0] + '</span><div><b>' + r[1] + '</b><p>' + r[2] + '</p></div></li>').join('') + '</ul></section>' +
    '<section class="card stack" style="gap:10px"><div class="sec-t">Wzorce ruchowe</div><p class="muted small">Kursy trenerskie uczą układać plan wokół wzorców ruchu. Generator najpierw wybiera ćwiczenia wielostawowe dla każdego wzorca, potem izolacje dla partii, którym brakuje serii.</p><div class="pat">' +
    [['Przysiad', 'przysiad, hack, suwnica'], ['Zawias biodrowy', 'martwy ciąg, RDL, hip thrust'], ['Wykrok', 'wykroki, bułgarski'], ['Pchanie poziome', 'wyciskanie, maszyna, pompki'], ['Pchanie pionowe', 'żołnierskie, hantle, maszyna'], ['Przyciąganie poziome', 'wiosłowania'], ['Przyciąganie pionowe', 'podciąganie, wyciąg'], ['Izolacje', 'barki, ramiona, uda, łydki']].map(([a, b]) => '<div><b>' + a + '</b>' + b + '</div>').join('') + '</div></section>' +
    '<section class="card stack" style="gap:10px"><div class="sec-t">Tylko ćwiczenia z badaniami przyrostu</div><p class="small">Aplikacja proponuje ' + Object.values(EX).filter(usable).length + ' ćwiczeń. <span class="evb A">A</span> to ćwiczenie samo trenowane w badaniu, które zmierzyło przyrost mięśni. <span class="evb B">B</span> to bliski wariant (ten sam ruch, inny sprzęt) albo program treningowy z tym ćwiczeniem, w którym mięśnie urosły. Wolne ciężary i maszyny dają podobny przyrost. Ćwiczenia bez takich danych nie są dobierane automatycznie, ale znajdziesz je w atlasie i dodasz do planu sam.</p><ol class="src">' + Object.values(SOURCES).map(x => '<li><a href="' + x[1] + '" target="_blank" rel="noopener">' + x[0] + '</a></li>').join('') + '</ol></section>' +
    '<section class="card stack" style="gap:12px"><div class="sec-t">Dieta i regeneracja</div><p class="small">Trening daje sygnał do wzrostu, ale mięśnie rosną przy nadwyżce ok. 300 kcal i 1,6–2,0 g białka na kg masy ciała. Śpij 7–9 godzin.</p>' +
    '<div class="calc"><div class="field"><label for="bw">Masa ciała, kg</label><input id="bw" inputmode="decimal" value="' + fmt(bw) + '"></div><div><div class="field"><label>Białko dziennie</label></div><div class="out" id="prot">' + protein(bw) + '</div></div></div></section>' +
    '<section class="card stack" style="gap:8px"><div class="sec-t">Źródła</div><ol class="src">' + SRC.map(s => '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + '</a></li>').join('') + '</ol></section></div>';
}

/* ---------- Shell: app bar, banner, render ---------- */
const TITLES = {home: 'Mój Trener', train: 'Trening', plan: 'Plan tygodnia', recovery: 'Regeneracja', atlas: 'Ćwiczenia', progress: 'Postępy'};
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
function renderBar() {
  const sess = UI.tab === 'train' && !UI.sub && S.draft; let left, right = '', sub = '';
  if (sess) {
    const d = S.draft; const [c, tt] = counts(d); const cur = curEx();
    left = '<div class="ab-t2"><span class="ab-title">' + esc(d.title || 'Trening') + '</span><span class="ab-clock mono" id="elapsed">0:00</span></div>';
    right = '<button class="btn sm primary" data-act="finish">Zakończ</button>';
    sub = '<div class="steps-strip" role="group" aria-label="Ćwiczenia w treningu">' + d.ex.map((q, i) => '<button class="dot' + (exDone(q) ? ' done' : '') + (i === cur ? ' cur' : '') + '" data-act="go-ex" data-i="' + i + '" aria-label="' + (i + 1) + '. ' + EX[q.id].n + (exDone(q) ? ', zrobione' : '') + '"' + (i === cur ? ' aria-current="step"' : '') + '>' + (exDone(q) ? '✓' : i + 1) + '</button>').join('') + '</div><div class="progress thin" aria-label="' + c + ' z ' + tt + ' serii"><b style="width:' + (tt ? c / tt * 100 : 0) + '%"></b></div>';
  } else if (UI.sub) {
    left = '<button class="ab-back" data-act="back" aria-label="Wróć">‹</button><span class="ab-title">' + (UI.sub === 'settings' ? 'Ustawienia' : UI.sub === 'planedit' ? 'Twój plan' : UI.sub === 'ai' ? 'Trener AI' : 'Wiedza') + '</span>';
  } else if (UI.tab === 'atlas' && (UI.at.part || UI.aq)) {
    left = '<button class="ab-back" data-act="at-back" aria-label="Wróć">‹</button><span class="ab-title">' + TITLES[UI.tab] + '</span>';
  } else if (UI.tab === 'recovery') {
    left = '<button class="ab-back" data-act="go" data-tab="home" aria-label="Wróć">‹</button><span class="ab-title">' + TITLES[UI.tab] + '</span>';
  } else {
    left = '<span class="ab-title">' + TITLES[UI.tab] + '</span>';
    right = '<button class="ab-icon" data-act="go-settings" aria-label="Ustawienia">' + GEAR + '</button>';
  }
  $('#abLeft').innerHTML = left; $('#abRight').innerHTML = right; $('#abSub').innerHTML = sub; $('#abSub').hidden = !sub;
}
function renderBanner() {
  const b = $('#sessBanner'); const show = !!S.draft && ((UI.tab !== 'train' && UI.tab !== 'home') || !!UI.sub); b.hidden = !show;
  if (show) { const d = S.draft; const [c, t] = counts(d); b.innerHTML = '<button class="bn" data-act="back-train"><span class="bn-dot" aria-hidden="true"></span><span class="bn-txt"><b>Trening w toku</b><span class="bn-sub"><span>' + esc(d.title || '') + '</span> · <span>' + c + '/' + t + ' serii</span> · <span class="mono" id="bnTime"></span></span></span><span class="bn-go">Wróć</span><i class="bn-bar" style="width:' + (t ? Math.round(100 * c / t) : 0) + '%"></i></button>'; }
}
function render() {
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', !UI.sub && b.dataset.tab === UI.tab ? 'page' : 'false'));
  renderBar();
  let v;
  if (UI.sub === 'settings') v = viewSettings();
  else if (UI.sub === 'know') v = viewKnow();
  else if (UI.sub === 'planedit') v = viewPlanEdit();
  else if (UI.sub === 'ai') v = viewAI();
  else v = UI.tab === 'train' ? (S.draft ? viewSession() : viewHome()) : {home: viewStart, plan: viewPlanTab, recovery: viewRecovery, atlas: viewAtlas, progress: viewProgress}[UI.tab]();
  const key = UI.tab + '|' + (UI.sub || '') + '|' + (UI.tab === 'atlas' ? (UI.at.part || '') : '') + '|' + (S.draft ? 1 : 0);
  const vw = $('#view'); vw.innerHTML = v;
  if (render.key !== key && !REDUCED) { vw.classList.remove('fade'); void vw.offsetWidth; vw.classList.add('fade'); }
  render.key = key;
  renderBanner(); tick(); kick();
}

/* ---------- Events ---------- */
document.querySelector('.tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (UI.tab === b.dataset.tab && !UI.sub) { window.scrollTo({top: 0, behavior: 'smooth'}); return; }
  UI.tab = b.dataset.tab; UI.sub = null; render(); window.scrollTo(0, 0);
});
function setVal(q, k, f, v) { const s = q.sets[k]; if (f === 'kg') { const old = s.kg; s.kg = v; for (let j = k + 1; j < q.sets.length; j++) { const o = q.sets[j]; if (!o.done && o.kg === old) o.kg = v; } } else s.reps = v; }
function nextUndone(from) { const d = S.draft; for (let j = from + 1; j < d.ex.length; j++) if (!exDone(d.ex[j])) return j; for (let j = 0; j < from; j++) if (!exDone(d.ex[j])) return j; return -1; }
function setting(k, v) { S.settings[k] = v; S.settings.updatedAt = Date.now(); persistNow(); }
function onAct(ev) {
  const b = ev.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act; const i = +b.dataset.i; const d = S.draft; const v = b.dataset.v;
  switch (a) {
    case 'start': startWorkout(); break;
    case 'stale-save': finish(); UI.tab = 'home'; render(); break;
    case 'stale-drop': discard(); toast('Trening porzucony'); break;
    case 'start-go': UI.tab = 'train'; UI.sub = null; startWorkout(); break;
    case 'welcomed': setting('welcomed', true); render(); break;
    case 'cfg': UI.cfgOpen = !UI.cfgOpen; render(); break;
    case 'set-profile': setting('profile', v); render(); toast('Siłownia: ' + profile().name); break;
    case 'set-dur': setting('duration', +v); render(); break;
    case 'set-rest-auto': setting('restAuto', v === '1'); render(); break;
    case 'set-rest-sound': unlockAudio(); setting('restSound', v === '1'); if (v === '1') beep(); render(); break;
    case 'set-focus': setting('focus', v); render(); break;
    case 'set-day': setting('next', +v); render(); break;
    case 'set-mode': setting('mode', v); render(); break;
    case 'set-plan': setting('plan', v); setting('next', 0); S.today = null; render(); toast('Plan: ' + allPlans()[v].name); break;
    case 'plan-new': { const c = {id: 'c' + Date.now().toString(36), name: 'Mój tydzień', week: true, days: []}; S.customPlans.push(c); setting('welcomed', true); persistNow(); openPlanEditor(c.id); UI.peWd = weekdayOf(); render(); break; }
    case 'day-open': { const c = weekPlanObj(); UI.pe = c ? c.id : null; UI.peOpen = null; openPanel('day', {wd: +v}); break; }
    case 'week-use': { const c = weekPlanObj(); if (c) { useWeekPlan(c); persistNow(); render(); } break; }
    case 'set-pick': setting('dayPick', {stamp: dayStamp(), idx: +v}); S.today = null; UI.cfgOpen = false; render(); window.scrollTo(0, 0); break;
    case 'pe-wd': { const wd = +v; UI.peWd = UI.peWd === wd ? null : wd; UI.peOpen = null; render(); break; }
    case 'pe-mus': {
      const fromHome = UI.sheet && UI.sheet.type === 'day';
      const c = fromHome ? ensureWeekPlan() : curPlan(); if (fromHome) { UI.pe = c.id; useWeekPlan(c); } const wd = +b.dataset.wd; const m = b.dataset.m; let d = c.days.find(x => x.wd === wd);
      const mus = d ? (d.mus.includes(m) ? d.mus.filter(x => x !== m) : d.mus.concat(m)) : [m];
      if (!mus.length) c.days = c.days.filter(x => x !== d);
      else { if (!d) { d = {wd, mus: [], name: '', ex: []}; c.days.push(d); } d.mus = mus; d.name = dayName(mus); d.ex = fillDay(mus, {equipment: equip(), exclude: S.settings.exclude}); }
      c.days.sort((x, y) => x.wd - y.wd); UI.peOpen = null; planChanged(); break;
    }
    case 'pe-refill': { const d = curPlan().days[+b.dataset.d]; UI.peSeed++; d.ex = fillDay(d.mus, {equipment: equip(), exclude: S.settings.exclude, seed: UI.peSeed}); UI.peOpen = null; planChanged(); toast('Dobrane inne ćwiczenia'); break; }
    case 'pe-preset': { const c = curPlan(); const pr = PRESETS.find(x => x.id === v); if (!pr) break; c.days = weekDays(pr.days, {equipment: equip(), exclude: S.settings.exclude}); UI.peWd = null; planChanged(); toast('Gotowe. Zmień dowolny dzień.'); break; }
    case 'plan-copy': { const src = allPlans()[v]; const c = {id: 'c' + Date.now().toString(36), name: (src.name + ' (moja wersja)').slice(0, 30), days: clone(src.days).map(d => ({name: d.name, ex: d.ex.map(e => ({id: e.id, sets: e.sets, lo: e.lo, hi: e.hi, rest: e.rest}))}))}; S.customPlans.push(c); persistNow(); openPlanEditor(c.id); toast('Skopiowano, możesz edytować'); break; }
    case 'plan-edit': openPlanEditor(v); break;
    case 'pe-swap': { const d = +b.dataset.d; const e = curPlan().days[d].ex[i]; openSheet(e.id, {from: 'plan', d, i}); UI.sheet.tab = b.dataset.t || 'alt'; renderSheet(false); break; }
    case 'pe-open': { const k = b.dataset.d + '-' + i; UI.peOpen = UI.peOpen === k ? null : k; render(); break; }
    case 'pe-move': { const day = curPlan().days[+b.dataset.d]; const j = i + +b.dataset.dir; if (j < 0 || j >= day.ex.length) break; if (UI.sheet && UI.sheet.ctx && UI.sheet.ctx.from === 'plan') UI.sheet.ctx.i = j; [day.ex[i], day.ex[j]] = [day.ex[j], day.ex[i]]; if (UI.peOpen === b.dataset.d + '-' + i) UI.peOpen = b.dataset.d + '-' + j; planChanged(); break; }
    case 'pe-step': { const e = curPlan().days[+b.dataset.d].ex[i]; const ex = EX[e.id]; const dir = +b.dataset.dir; const f = b.dataset.f;
      if (f === 'sets') e.sets = Math.min(10, Math.max(1, e.sets + dir));
      if (f === 'rest') e.rest = Math.min(600, Math.max(15, e.rest + dir * 15));
      if (f === 'lo') { e.lo = Math.max(1, e.lo + dir * (isS(ex) ? 5 : 1)); if (e.hi < e.lo) e.hi = e.lo; }
      if (f === 'hi') { e.hi = Math.max(e.lo, e.hi + dir * (isS(ex) ? 5 : 1)); }
      planChanged(); break; }
    case 'pe-ex-del': curPlan().days[+b.dataset.d].ex.splice(i, 1); UI.peOpen = null; planChanged(); break;
    case 'pe-day-add': { const c = curPlan(); if (c.days.length < 7) c.days.push({name: 'Dzień ' + String.fromCharCode(65 + c.days.length), ex: []}); planChanged(); break; }
    case 'pe-day-del': UI.peDel = +b.dataset.d; render(); break;
    case 'pe-day-del-yes': { const c = curPlan(); if (c.days.length > 1) c.days.splice(+b.dataset.d, 1); UI.peDel = null; if (S.settings.next >= c.days.length) S.settings.next = 0; planChanged(); break; }
    case 'pe-del': UI.peDel = 'plan'; render(); break;
    case 'pe-cancel': UI.peDel = null; render(); break;
    case 'pe-del-yes': { const id = UI.pe; S.customPlans = S.customPlans.filter(c => c.id !== id); if (S.settings.plan === id) { S.settings.plan = 'fbw3'; S.settings.next = 0; } S.today = null; UI.peDel = null; UI.sub = 'settings'; persistNow(); render(); toast('Plan usunięty'); break; }
    case 'pe-use': setting('mode', 'plan'); setting('plan', UI.pe); setting('next', 0); S.today = null; render(); toast('Używasz planu: ' + curPlan().name); break;
    case 'set-theme': setting('theme', v); applyTheme(); render(); break;
    case 'set-lang': { const was = isEn(); setting('lang', v); if ((detectLang(v) === 'en') !== was) { persistNow(); location.reload(); return; } applyLang(); render(); break; }
    case 'set-bar': setting('bar', +v); render(); break;
    case 'shuffle': reshuffle(); render(); toast('Nowy zestaw ćwiczeń'); break;
    case 'today-ex': openSheet(b.dataset.id, {from: 'today', idx: +b.dataset.idx}); break;
    case 'pick-open': openPanel('pick', {target: b.dataset.target, d: +b.dataset.d, q: ''}); break;
    case 'go': UI.tab = b.dataset.tab; UI.sub = null; render(); window.scrollTo(0, 0); break;
    case 'go-know': UI.fromSettings = UI.sub === 'settings'; UI.sub = 'know'; render(); window.scrollTo(0, 0); break;
    case 'go-ai': openAI(b.dataset.v === 'cfg', b.dataset.q === 'plan' ? 'Ułóż mi plan na 4 dni w tygodniu pod budowę masy, z moim sprzętem.' : ''); break;
    case 'ai-provider': UI.aiForm.provider = v; render(); break;
    case 'ai-save': aiSave(); break;
    case 'ai-cfg': UI.aiCfg = !UI.aiCfg; UI.aiForm = {...S.ai}; render(); window.scrollTo(0, 0); break;
    case 'ai-send': { const n = $('#aiIn'); aiSend(n ? n.value : UI.aiDraft); break; }
    case 'ai-quick': aiSend(tt(AI_QUICK[+b.dataset.i])); break;
    case 'ai-clear': S.chat = []; persistNow(); render(); break;
    case 'ai-plan': aiApplyPlan(+b.dataset.i); break;
    case 'ai-retry': { const last = [...S.chat].reverse().find(m => m.role === 'user'); while (S.chat.length && S.chat[S.chat.length - 1].err) S.chat.pop(); if (last) { S.chat.splice(S.chat.lastIndexOf(last), 1); aiSend(last.text); } break; }
    case 'go-settings': UI.sub = 'settings'; render(); window.scrollTo(0, 0); break;
    case 'back': subBack(); break;
    case 'back-train': UI.tab = 'train'; UI.sub = null; render(); window.scrollTo(0, 0); break;
    case 'muscle': openPanel('muscle', {m: b.dataset.m}); break;
    case 'bm': { const t = ev.target.closest('[data-m]'); if (t) openPanel('muscle', {m: t.dataset.m}); break; }
    case 'sheet-open': openSheet(b.dataset.id); break;
    case 'tech': openSheet(d.ex[i].id, {from: 'session', i}); break;
    case 'list': openPanel('list'); break;
    case 'go-ex': goEx(i); break;
    case 'prev': goEx(curEx() - 1); break;
    case 'next': goEx(curEx() + 1); break;
    case 'sel': UI.sel = {i, k: +b.dataset.k}; render(); break;
    case 'wu': { const q = d.ex[i]; q.wu = q.wu || []; q.wu[+b.dataset.j] = !q.wu[+b.dataset.j]; persistSoon(); render(); break; }
    case 'wu-toggle': UI.wuOpen = !UI.wuOpen; render(); break;
    case 'wu-done': d.genWu = true; persistSoon(); render(); break;
    case 'step': {
      unlockAudio(); const q = d.ex[i]; const k = activeSet(i); const s = q.sets[k]; const ex = EX[q.id]; const dir = +b.dataset.d;
      if (b.dataset.f === 'kg') { const base = s.kg ?? (ex.kind === 'bar' ? S.settings.bar : ex.kind === 'db' ? 8 : ex.kind === 'bw' ? 0 : 20); setVal(q, k, 'kg', Math.max(0, Math.round((base + dir * ex.inc) * 100) / 100)); }
      else { const st = isS(ex) ? 5 : 1; setVal(q, k, 'reps', Math.max(0, (s.reps ?? q.lo) + dir * st)); }
      persistSoon(); render(); break;
    }
    case 'save': {
      unlockAudio(); const q = d.ex[i]; const k = activeSet(i); const s = q.sets[k]; const ex = EX[q.id];
      if (s.kg == null && ex.kind !== 'bw') { const el = document.getElementById('kg-' + i); if (el) { el.classList.add('need'); el.focus(); } toast('Wpisz ciężar'); return; }
      if (s.kg == null) s.kg = 0; if (s.reps == null) s.reps = q.lo; s.done = true; UI.sel = null;
      const finishedEx = exDone(q); const [c, t] = counts(d);
      if (c < t && S.settings.restAuto !== false) startRest(finishedEx ? Math.max(90, q.rest) : q.rest, nextLabel()); else stopRest();
      persistNow();
      if (c >= t) { render(); openPanel('finish', {mode: 'finish'}); break; }
      if (finishedEx) { const j = nextUndone(i); if (j >= 0) { toast('Następne: ' + EX[d.ex[j].id].n); goEx(j); break; } }
      render(); break;
    }
    case 'rest-go': unlockAudio(); startRest(d.ex[i].rest, nextLabel()); break;
    case 'undo': { const q = d.ex[i]; q.sets[activeSet(i)].done = false; persistSoon(); render(); break; }
    case 'addset': { const q = d.ex[i]; const l = q.sets[q.sets.length - 1]; q.sets.push({kg: l.kg, reps: l.reps, done: false}); UI.sel = {i, k: q.sets.length - 1}; persistSoon(); render(); break; }
    case 'rmset': { const q = d.ex[i]; if (q.sets.length > 1 && !q.sets[q.sets.length - 1].done) q.sets.pop(); UI.sel = null; persistSoon(); render(); break; }
    case 'finish': openPanel('finish', {mode: 'finish'}); break;
    case 'cycle-reset': setting('cycleStart', weekStart().toISOString()); render(); toast('Cykl zaczyna się od tego tygodnia'); break;
    case 'edit-profile': UI.editProfile = UI.editProfile === v ? null : v; render(); break;
    case 'add-profile': { const id = 'p' + Date.now().toString(36); S.profiles.push({id, name: 'Nowa siłownia', equip: ['dumbbells']}); UI.editProfile = id; persistNow(); render(); break; }
    case 'del-profile': { S.profiles = S.profiles.filter(p => p.id !== v); if (S.settings.profile === v) S.settings.profile = S.profiles[0].id; UI.editProfile = null; persistNow(); render(); break; }
    case 'unexclude-id': S.settings.exclude = S.settings.exclude.filter(x => x !== v); persistNow(); render(); break;
    case 'export': exportFile(); break;
    case 'paste-import': { const t = $('#pasteData'); doImport(t ? t.value : ''); break; }
    case 'wipe': UI.wipe = true; render(); break;
    case 'wipe-no': UI.wipe = false; render(); break;
    case 'wipe-yes': { const fresh = defaultState(); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, fresh); S.settings.cycleStart = weekStart().toISOString(); UI.wipe = false; persistNow(); stopRest(); render(); toast('Dane usunięte'); break; }
    case 'am': UI.am = v; render(); break;
    case 'ak': UI.ak = v; render(); break;
    case 'at-back': atlasBack(); render(); window.scrollTo(0, 0); break;
    case 'at-part': UI.at = {part: v, m: null, head: null, len: null}; render(); window.scrollTo(0, 0); break;
    case 'at-m': UI.at.m = v || null; UI.at.head = null; render(); break;
    case 'at-head': UI.at.head = v || null; render(); break;
    case 'at-len': UI.at.len = v || null; render(); break;
    case 'only-ev': UI.onlyEv = !UI.onlyEv; render(); break;
    case 'ah': UI.ah = v; render(); break;
    case 'pe-add': addExercise('plan', b.dataset.id, +b.dataset.d); break;
    case 'aall': UI.all = v === '1'; render(); window.scrollTo(0, 0); break;
    case 'mine': UI.mine = !UI.mine; render(); break;
    case 'af-reset': UI.at = {part: null, m: null, head: null, len: null}; UI.ak = 'all'; UI.aq = ''; UI.mine = false; render(); break;
    case 'openw': UI.openW = UI.openW === b.dataset.id ? null : b.dataset.id; UI.delW = null; render(); break;
    case 'delw': UI.delW = b.dataset.id; render(); break;
    case 'delw-no': UI.delW = null; render(); break;
    case 'delw-yes': { const id = b.dataset.id; S.workouts = S.workouts.filter(w => w.id !== id); S.today = null; persistNow(); UI.delW = null; UI.openW = null; if (UI.summary && UI.summary.id === id) UI.summary = null; render(); toast('Trening usunięty'); break; }
  }
}
['#view', '#appbar', '#sessBanner'].forEach(s => $(s).addEventListener('click', onAct));
$('#view').addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'bw') { const v = num(t.value); if (v && v > 20 && v < 400) { S.settings.bw = v; $('#prot').textContent = protein(v); persistSoon(); } return; }
  if (t.id === 'aq') { UI.aq = t.value; const pos = t.selectionStart; render(); const n = $('#aq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } return; }
  if (t.id === 'aiIn') { UI.aiDraft = t.value; return; }
  if (t.id === 'ai-key' || t.id === 'ai-model' || t.id === 'ai-base') { UI.aiForm[t.id.slice(3)] = t.value; return; }
  if (t.id === 'pe-name') { const c = curPlan(); if (c) { c.name = t.value.trim() || 'Mój plan'; S.today = null; persistSoon(); } return; }
  if (t.classList.contains('pe-dayname')) { const c = curPlan(); if (c && c.days[+t.dataset.d]) { c.days[+t.dataset.d].name = t.value.trim() || 'Dzień ' + (+t.dataset.d + 1); S.today = null; persistSoon(); } return; }
  if (t.classList.contains('pname-in')) { const p = S.profiles.find(x => x.id === t.dataset.pid); if (p) { p.name = t.value.trim() || 'Siłownia'; persistSoon(); } return; }
  if (!t.dataset.f || !S.draft) return;
  const i = +t.dataset.i, k = +t.dataset.k; const q = S.draft.ex[i];
  if (t.dataset.f === 'kg') { setVal(q, k, 'kg', num(t.value)); t.classList.remove('need'); const pl = document.getElementById('pl' + i); if (pl) pl.innerHTML = platesHTML(q.sets[k].kg); }
  else { const v = parseInt(t.value, 10); setVal(q, k, 'reps', isFinite(v) ? v : null); }
  persistSoon();
});
$('#view').addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'chartEx') { UI.chartEx = t.value; render(); return; }
  if (t.dataset.eq) { const p = S.profiles.find(x => x.id === t.dataset.pid); if (!p) return; p.equip = t.checked ? [...new Set([...p.equip, t.dataset.eq])] : p.equip.filter(e => e !== t.dataset.eq); S.today = null; persistNow(); render(); return; }
  if (t.classList.contains('pname-in')) { render(); return; }
  if (t.id === 'importFile' && t.files && t.files[0]) { const r = new FileReader(); r.onload = () => doImport(String(r.result)); r.onerror = () => toast('Nie udało się odczytać pliku'); r.readAsText(t.files[0]); return; }
  if (t.dataset.f && S.draft) setTimeout(render, 0);
});
$('#view').addEventListener('focusin', ev => { if (ev.target.matches('.stp input')) ev.target.select(); });
let sw = null;
$('#view').addEventListener('touchstart', ev => { if (!S.draft || UI.tab !== 'train' || UI.sub || ev.target.closest('input,select,.ramp,.setpills,.steppers')) return; const t = ev.touches[0]; sw = {x: t.clientX, y: t.clientY, t: Date.now()}; }, {passive: true});
$('#view').addEventListener('touchend', ev => {
  if (!sw) return; const t = ev.changedTouches[0]; const dx = t.clientX - sw.x, dy = t.clientY - sw.y; const fast = Date.now() - sw.t < 700; sw = null;
  if (fast && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) { const c = curEx(); if (dx < 0 && c < S.draft.ex.length - 1) goEx(c + 1); else if (dx > 0 && c > 0) goEx(c - 1); }
}, {passive: true});

function exportFile() {
  if (ANDROID) { ANDROID.saveFile('twoj-trener-' + new Date().toISOString().slice(0, 10) + '.json', exportJSON(S)); return; }
  const blob = new Blob([exportJSON(S)], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'twoj-trener-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Kopia zapisana');
}
function doImport(text) {
  try { const r = importData(S, text); S.today = null; persistNow(); render(); toast('Wczytano ' + r.added + ' nowych treningów (razem ' + r.total + ')'); }
  catch (err) { toast(err.message); }
}

/* ---------- Service worker & updates ---------- */
if (!ANDROID && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { $('#updateBar').hidden = false; $('#updateBtn').onclick = () => { persistNow(); w.postMessage('skipWaiting'); }; };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
  }).catch(() => { /* offline support unavailable */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

/* Android back button and app pause (called from MainActivity). Returns true when the app handled "back". */
window.tnmBack = () => {
  if (UI.sheet) { closeSheet(); return true; }
  if (UI.sub) { subBack(); return true; }
  if (UI.cfgOpen) { UI.cfgOpen = false; render(); return true; }
  if (UI.tab === 'atlas' && atlasBack()) { render(); window.scrollTo(0, 0); return true; }
  if (UI.tab !== 'home') { UI.tab = 'home'; render(); window.scrollTo(0, 0); return true; }
  return false;
};
window.tnmSave = persistNow;

persist();
render();
if (S.draft) wake();
