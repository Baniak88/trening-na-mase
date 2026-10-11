/* Trening na masę: UI. Screens: Trening (today / session), Regeneracja, Ćwiczenia, Postępy, Ustawienia, Wiedza. */
import {EX, MUSCLES, MUSCLE_INFO, PATTERNS, PLANS, CYCLE, KINDS, KINDN, EQUIPMENT, canDo, primary} from './data/catalog.js';
import {FC, figSVG, figBounds, visMark} from './figure.js';
import {recovery, weeklySets, status} from './engine/recovery.js';
import {generate, alternatives, prescribe, FOCUS, exSeconds} from './engine/generator.js';
import {suggestLoad, sessionsOf, e1rm, fmt} from './engine/progression.js';
import {load, save, persist, exportJSON, importData, defaultState} from './store.js';
import {bodyMap, targetMap} from './bodymap.js';

/* ---------- Helpers ---------- */
const PLATES = [[25, '--p25', 44, 9], [20, '--p20', 44, 8], [15, '--p15', 40, 7], [10, '--p10', 34, 6], [5, '--p5', 26, 5], [2.5, '--p2', 22, 4], [1.25, '--p1', 18, 3]];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const num = v => { const q = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(q) ? q : null; };
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const clone = o => JSON.parse(JSON.stringify(o));
const roundTo = (v, s) => Math.round(v / s) * s;
const dateStr = iso => new Date(iso).toLocaleDateString('pl-PL', {weekday: 'short', day: 'numeric', month: 'short'});
const isS = ex => ex.unit === 's';
const kgTxt = (ex, kg) => (ex.kind === 'bw' ? (kg ? '+' + fmt(kg) + ' kg' : 'masa ciała') : fmt(kg) + ' kg' + (ex.kind === 'db' ? ' na hantel' : ''));
const unitHead = ex => (ex.kind === 'bw' ? '+kg' : ex.kind === 'db' ? 'kg/hantel' : 'kg');
const repTxt = (ex, n) => (isS(ex) ? n + ' s' : String(n));
const range = (ex, it) => it.lo + '–' + it.hi + (isS(ex) ? ' s' : '');
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
const thumb = id => thumbCache[id] || (thumbCache[id] = figSVG(id, thumbK(EX[id]), FC, boxes[id] || (boxes[id] = figBounds(EX[id], 4 / 3, true)), {}));

/* ---------- State ---------- */
const S = load();
if (!S.settings.cycleStart) S.settings.cycleStart = weekStart().toISOString();
const UI = {tab: 'train', sub: null, fromSettings: false, cur: null, sel: null, chartEx: null, openW: null, delW: null, summary: null, sheet: null,
  aq: '', ap: 'all', ak: 'all', mine: true, wuOpen: false, cfgOpen: false, editProfile: null, wipe: false};
let saveT = null;
function persistNow() { clearTimeout(saveT); save(S); }
function persistSoon() { clearTimeout(saveT); saveT = setTimeout(() => save(S), 400); }
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistNow(); });

const profile = () => S.profiles.find(p => p.id === S.settings.profile) || S.profiles[0];
const equip = () => profile().equip;
const plan = () => PLANS[S.settings.plan];
function cycleWeek() { const cs = weekStart(new Date(S.settings.cycleStart)); const diff = Math.round((weekStart() - cs) / (7 * 864e5)); return ((diff % 6) + 6) % 6; }
const cycle = () => CYCLE[cycleWeek()];

/* ---------- Today's workout ---------- */
function todayKey() {
  const st = S.settings;
  return [st.mode, profile().id, equip().join('.'), st.duration, st.focus, st.plan, st.next, S.workouts.length, cycleWeek(), dayStamp(), st.exclude.join('.'), JSON.stringify(st.subs)].join('|');
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
    const p = plan(); const idx = S.settings.next % p.days.length; const used = new Set(); const items = [];
    for (const it of p.days[idx].ex) { const f = fitPlanItem(it, used); if (f) { items.push(f); used.add(f.id); } }
    S.today = {key, seed, mode: 'plan', day: idx, title: p.days[idx].name, items, deload, estMin: estMin(items, deload)};
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
  if (d.mode === 'plan') S.settings.next = (d.day + 1) % (PLANS[d.plan] || plan()).days.length;
  else S.settings.focus = 'auto';
  S.draft = null; S.today = null;
  stopRest(); releaseWake(); UI.summary = w; persistNow(); render(); window.scrollTo(0, 0); toast('Trening zapisany');
}
function discard() { S.draft = null; persistNow(); stopRest(); releaseWake(); render(); window.scrollTo(0, 0); }
const volume = w => w.ex.reduce((a, q) => a + (isS(EX[q.id] || {}) ? 0 : q.sets.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0)), 0);

/* ---------- Rest timer, sound, wake lock ---------- */
const T = {end: 0, total: 0, on: false, goT: null}; let actx = null;
function unlockAudio() { try { if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } if (actx && actx.state === 'suspended') actx.resume(); } catch (err) { /* no audio */ } }
function beep() {
  try { if (!actx) return; const t = actx.currentTime; [0, 0.28, 0.56].forEach((o, i) => { const os = actx.createOscillator(), g = actx.createGain(); os.frequency.value = i === 2 ? 1175 : 880; g.gain.setValueAtTime(0.0001, t + o); g.gain.exponentialRampToValueAtTime(0.35, t + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.22); os.connect(g).connect(actx.destination); os.start(t + o); os.stop(t + o + 0.25); }); } catch (err) { /* no audio */ }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (err) { /* no vibration */ }
}
function startRest(sec, next) { T.total = sec; T.end = Date.now() + sec * 1000; T.on = true; clearTimeout(T.goT); $('#rest').classList.remove('go'); $('#restLbl').textContent = 'Przerwa'; $('#restNext').textContent = next || ''; $('#restNext').hidden = !next; $('#rest').hidden = false; tick(); }
function stopRest() { T.on = false; clearTimeout(T.goT); $('#rest').hidden = true; $('#rest').classList.remove('go'); }
function tick() {
  if (T.on) {
    const left = (T.end - Date.now()) / 1000;
    if (left <= 0) { T.on = false; beep(); $('#rest').classList.add('go'); $('#restLbl').textContent = 'Koniec przerwy'; $('#restTm').textContent = 'Czas na serię'; $('#restPb').style.width = '100%'; T.goT = setTimeout(stopRest, 6000); }
    else { $('#restTm').textContent = mmss(left); $('#restPb').style.width = (100 - left / T.total * 100) + '%'; }
  }
  if (S.draft) { const el = mmss((Date.now() - new Date(S.draft.started)) / 1000); const c = $('#elapsed'); if (c) c.textContent = el; const bt = $('#bnTime'); if (bt) bt.textContent = el; }
}
setInterval(tick, 250);
$('#restMinus').onclick = () => { T.end -= 15000; tick(); };
$('#restPlus').onclick = () => { T.end += 15000; T.total += 15; tick(); };
$('#restSkip').onclick = stopRest;
$('#restNext').onclick = () => { if (UI.tab !== 'train' && S.draft) { UI.tab = 'train'; UI.sub = null; render(); window.scrollTo(0, 0); } };
let wl = null;
async function wake() { try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (err) { wl = null; } }
function releaseWake() { try { wl && wl.release(); } catch (err) { /* already released */ } wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.draft) wake(); tick(); if (!S.draft && UI.tab === 'train' && S.today && S.today.key !== todayKey()) render(); } });
function nextLabel() {
  const d = S.draft;
  for (let i = 0; i < d.ex.length; i++) { const q = d.ex[i]; const k = q.sets.findIndex(s => !s.done); if (k >= 0) { const ex = EX[q.id]; return 'Następnie: ' + ex.n + ' · seria ' + (k + 1) + ' · ' + (q.sets[k].kg == null ? '' : kgTxt(ex, q.sets[k].kg) + ' × ') + repTxt(ex, q.sets[k].reps ?? q.lo); } }
  return '';
}

/* ---------- Animation: technique sheet + inline figure ---------- */
const AN = {raf: 0, last: 0, t: 0, paused: false, speed: 1, mode: -1, marks: true, k: 0};
const INL = {t: 0};
function timeline(f) {
  if (f.static) return null;
  if (f.walk) return [{a: 0, b: 1, d: 700, l: 'Krótkie, szybkie kroki'}, {a: 1, b: 0, d: 700, l: 'Krótkie, szybkie kroki'}];
  const ab = f.ecc === 'AB'; const E = 'Opuszczanie: powoli, 2–3 s', C = 'Praca: dynamicznie, ok. 1 s';
  return [{a: 0, b: 0, d: 800, l: (f.sA || ['Start'])[0]}, {a: 0, b: 1, d: ab ? 2600 : 1100, l: ab ? E : C}, {a: 1, b: 1, d: 700, l: (f.sB || ['Koniec'])[0]}, {a: 1, b: 0, d: ab ? 1100 : 2600, l: ab ? C : E}];
}
const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
function phaseAt(tl, t) { const total = tl.reduce((a, p) => a + p.d, 0); t = ((t % total) + total) % total; for (const p of tl) { if (t < p.d) return {p, k: p.a + (p.b - p.a) * ease(t / p.d)}; t -= p.d; } return {p: tl[0], k: 0}; }
function timeForK(tl, k) { if (!tl) return 0; let t = 0; for (const p of tl) { if (p.a !== p.b) { const lo = Math.min(p.a, p.b), hi = Math.max(p.a, p.b); if (k >= lo && k <= hi) { const x = (k - p.a) / (p.b - p.a); return t + Math.acos(1 - 2 * Math.max(0, Math.min(1, x))) / Math.PI * p.d; } } t += p.d; } return 0; }
function drawFig(label) {
  const sh = UI.sheet; if (!sh || !sh.id) return; const f = EX[sh.id].fig; const box = $('#figAnim'); if (!box) return;
  box.innerHTML = figSVG(sh.id, AN.k, FC, bigBox(sh.id), {mode: AN.mode, marks: AN.marks, ghost: AN.marks});
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
  if (il) { const id = il.dataset.id; const tl = timeline(EX[id].fig); if (tl) { need = true; INL.t += dt; const r = phaseAt(tl, INL.t); il.innerHTML = figSVG(id, r.k, FC, tightBox(id), {}); const lb = $('#inlPhase'); if (lb && lb.textContent !== r.p.l) lb.textContent = r.p.l; } }
  if (need) AN.raf = requestAnimationFrame(loop); else { AN.raf = 0; AN.last = 0; }
}
function kick() { if (!AN.raf) AN.raf = requestAnimationFrame(loop); }

/* ---------- Sheets ---------- */
function openSheet(id, ctx) { UI.sheet = {id, ctx: ctx || null, tab: 'ruch'}; AN.mode = -1; AN.t = 0; AN.k = 0; AN.last = 0; AN.paused = REDUCED; renderSheet(true); }
function openPanel(type, extra) { UI.sheet = {type, ...(extra || {})}; renderSheet(true); }
function closeSheet() { UI.sheet = null; $('#sheetRoot').innerHTML = ''; document.body.classList.remove('lock'); kick(); }
function sheetFrame(title, eyebrow, sub, tabs, body) {
  return '<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT" data-stop="1"><div class="sheet-top"><div class="grab"></div><div class="sheet-h"><div style="min-width:0">' + (eyebrow ? '<div class="eyebrow">' + eyebrow + '</div>' : '') + '<h2 id="shT">' + title + '</h2>' + (sub ? '<div class="muted small">' + sub + '</div>' : '') + '</div><button class="x" data-act="sheet-close" aria-label="Zamknij">×</button></div>' + (tabs || '') + '</div><div class="sheet-body">' + body + '</div></div></div>';
}
function renderSheet(fresh) {
  const sh = UI.sheet; if (!sh) { closeSheet(); return; }
  const h = sh.type === 'list' ? listSheet() : sh.type === 'finish' ? finishSheet() : sh.type === 'pick' ? pickSheet() : sh.type === 'muscle' ? muscleSheet() : exSheet();
  const prev = $('.sheet') ? $('.sheet').scrollTop : 0;
  $('#sheetRoot').innerHTML = h; document.body.classList.add('lock');
  const sx = $('.sheet'); if (sx) sx.scrollTop = fresh ? 0 : prev;
  if (fresh) { const x = $('.sheet .x'); if (x) x.focus({preventScroll: true}); }
  if (sh.id) drawFig(AN.paused ? null : undefined);
  kick();
}
function ctxUsed(ctx) {
  if (!ctx) return [];
  if (ctx.from === 'session' && S.draft) return S.draft.ex.map(q => q.id);
  if (ctx.from === 'today' && S.today) return S.today.items.map(q => q.id);
  return [];
}
function exSheet() {
  const sh = UI.sheet; const ex = EX[sh.id]; const f = ex.fig; const tl = timeline(f); const bad = f.bad || []; const bd = AN.mode >= 0 ? bad[AN.mode] : null;
  const ctx = sh.ctx; const q = ctx && ctx.from === 'session' && S.draft ? S.draft.ex[ctx.i] : null;
  const alts = alternatives(sh.id, ctx ? equip() : EQUIPMENT.map(e => e[0]), ctxUsed(ctx)).filter(a => !S.settings.exclude.includes(a));
  const pat = (PATTERNS.find(p => p[0] === ex.p) || ['', ''])[1];
  const tabs = '<div class="stabs" role="tablist">' + [['ruch', 'Ruch'], ['info', 'Wskazówki']].concat(alts.length ? [['alt', ctx ? 'Zamień' : 'Zamienniki']] : []).map(([k, l]) => '<button role="tab" data-act="stab" data-t="' + k + '" aria-selected="' + (sh.tab === k) + '">' + l + '</button>').join('') + '</div>';
  let h = '';
  if (sh.tab === 'ruch') {
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
    h += '<div class="stack" style="gap:8px"><div class="sec-t">Sprzęt</div><p class="small">' + (ex.needs.length ? ex.needs.map(n => EQUIPMENT.find(e => e[0] === n)[1]).join(', ') : 'Bez sprzętu') + '</p></div>';
    if (best) h += '<p class="small">Twój rekord: <b class="mono">' + kgTxt(ex, best) + '</b></p>';
    h += '<div class="stack" style="gap:8px"><div class="sec-t">Jak wykonać</div><ul class="cues">' + ex.cues.map(c => '<li><span>' + c + '</span></li>').join('') + '</ul></div>';
    h += '<div class="stack" style="gap:8px"><div class="sec-t">Częste błędy</div><ul class="cues bad">' + ex.err.map(c => '<li><span>' + c + '</span></li>').join('') + '</ul></div>';
  } else {
    if (ctx) {
      const locked = q && q.sets.some(s => s.done);
      if (locked) h += '<p class="muted small">Masz już odhaczone serie tego ćwiczenia, więc zamiana jest zablokowana.</p>';
      h += alts.map(a => '<div class="card altc"><button class="thumb" data-act="sheet-open" data-id="' + a + '" aria-label="Technika: ' + EX[a].n + '">' + thumb(a) + '</button><div style="min-width:0"><b>' + EX[a].n + '</b><div class="muted small">' + KINDN[EX[a].kind] + ' · ' + primary(EX[a]).map(m => MUSCLES[m]).join(', ') + '</div><div class="row" style="margin-top:8px"><button class="btn sm" data-act="swap" data-id="' + a + '"' + (locked ? ' disabled' : '') + '>Zamień</button>' + (S.settings.mode === 'plan' ? '<button class="btn sm ghost" data-act="swap" data-id="' + a + '" data-perm="1"' + (locked ? ' disabled' : '') + '>Na stałe w planie</button>' : '') + '</div></div></div>').join('');
    } else {
      h += alts.map(a => '<button class="card altc" data-act="sheet-open" data-id="' + a + '"><span class="thumb">' + thumb(a) + '</span><span style="min-width:0;text-align:left"><b style="display:block">' + EX[a].n + '</b><span class="muted small">' + KINDN[EX[a].kind] + ' · technika ›</span></span></button>').join('');
    }
  }
  if (ctx && ctx.from === 'today') h += '<div class="sheet-actions"><button class="btn ghost wide" data-act="today-remove">Usuń z dzisiejszego treningu</button><button class="btn ghost wide" data-act="exclude">Nie proponuj tego ćwiczenia</button></div>';
  else if (!ctx && S.settings.exclude.includes(sh.id)) h += '<div class="sheet-actions"><button class="btn wide" data-act="unexclude">Znowu proponuj to ćwiczenie</button></div>';
  return sheetFrame(ex.n, pat + ' · ' + KINDN[ex.kind], ex.en + (ex.uni ? ' · serie na każdą stronę' : ''), tabs, h);
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
  const used = new Set(sh.target === 'session' ? (S.draft ? S.draft.ex.map(e => e.id) : []) : (S.today ? S.today.items.map(e => e.id) : []));
  const list = Object.values(EX).filter(ex => canDo(ex, equip()) && !used.has(ex.id) && (!q || (ex.n + ' ' + ex.en + ' ' + Object.keys(ex.m).map(m => MUSCLES[m]).join(' ')).toLowerCase().includes(q)));
  const body = '<input class="search" id="pickQ" type="search" placeholder="Szukaj: nazwa lub partia" value="' + esc(sh.q || '') + '" aria-label="Szukaj ćwiczenia"><ul class="exlist">' +
    list.map(ex => '<li><button class="exrow" data-act="pick-add" data-id="' + ex.id + '"><span class="thumb">' + thumb(ex.id) + '</span><span style="min-width:0"><span class="nm" style="display:block">' + ex.n + '</span><span class="hn" style="display:block">' + KINDN[ex.kind] + ' · ' + primary(ex).map(m => MUSCLES[m]).join(', ') + '</span></span><span class="tg">+</span></button></li>').join('') + '</ul>' +
    (list.length ? '' : '<p class="muted">Nic nie pasuje. Sprawdź sprzęt w profilu „' + esc(profile().name) + '”.</p>');
  return sheetFrame('Dodaj ćwiczenie', 'Sprzęt: ' + esc(profile().name), '', '', body);
}
function muscleSheet() {
  const m = UI.sheet.m; const rec = recovery(S.workouts); const r = rec[m]; const wk = weeklySets(S.workouts)[m]; const t = MUSCLE_INFO[m].target;
  const ex = Object.values(EX).filter(e => primary(e).includes(m) && canDo(e, equip())).slice(0, 8);
  const st = status(r.pct);
  const body = '<div class="mus-head"><span class="rec-dot ' + st + '"></span><div><b class="big-num">' + r.pct + '%</b><div class="muted small">' + ({ready: 'Gotowy do treningu', partial: 'Częściowo zregenerowany', tired: 'Jeszcze zmęczony'})[st] + (r.readyIn ? ' · pełna regeneracja za ok. ' + hoursTxt(r.readyIn) : '') + '</div></div></div>' +
    '<p class="small">W ostatnich 7 dniach: <b class="mono">' + fmt(Math.round(wk * 10) / 10) + '</b> serii (cel ' + t[0] + '–' + t[1] + ').' + (r.last ? ' Ostatnio trenowany: ' + dateStr(r.last) + '.' : ' Jeszcze nie trenowany.') + '</p>' +
    '<div class="sec-t">Ćwiczenia z Twoim sprzętem</div><ul class="exlist">' + ex.map(e => '<li><button class="exrow" data-act="sheet-open" data-id="' + e.id + '"><span class="thumb">' + thumb(e.id) + '</span><span style="min-width:0"><span class="nm" style="display:block">' + e.n + '</span><span class="hn" style="display:block">' + KINDN[e.kind] + '</span></span><span class="tg">›</span></button></li>').join('') + '</ul>';
  return sheetFrame(MUSCLES[m], 'Regeneracja', '', '', body);
}
const hoursTxt = h => h + ' h';

$('#sheetRoot').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'sheet-close') { if (b.classList.contains('sheet-bg') && ev.target.closest('[data-stop]')) return; closeSheet(); return; }
  if (a === 'stab') { UI.sheet.tab = b.dataset.t; renderSheet(true); return; }
  if (a === 'anim-toggle') { AN.paused = !AN.paused; AN.last = 0; b.textContent = AN.paused ? '▶ Odtwórz' : '❚❚ Pauza'; if (!AN.paused) { AN.t = timeForK(timeline(EX[UI.sheet.id].fig), AN.k); kick(); } return; }
  if (a === 'speed') { AN.speed = AN.speed === 1 ? 0.5 : 1; b.textContent = AN.speed === 1 ? '1×' : '0,5×'; return; }
  if (a === 'mode') { AN.mode = +b.dataset.m; renderSheet(false); return; }
  if (a === 'step-k') { AN.paused = true; AN.k = +b.dataset.k; const tg = $('[data-act=anim-toggle]'); if (tg) tg.textContent = '▶ Odtwórz'; drawFig(b.textContent.slice(1)); return; }
  if (a === 'sheet-open') { openSheet(b.dataset.id); return; }
  if (a === 'go-ex') { closeSheet(); goEx(+b.dataset.i); return; }
  if (a === 'finish-yes') { closeSheet(); finish(); return; }
  if (a === 'discard-ask') { openPanel('finish', {mode: 'discard'}); return; }
  if (a === 'discard-yes') { closeSheet(); discard(); return; }
  if (a === 'pick-open') { openPanel('pick', {target: b.dataset.target, q: ''}); return; }
  if (a === 'pick-add') { addExercise(UI.sheet.target, b.dataset.id); closeSheet(); return; }
  if (a === 'today-remove') { const i = UI.sheet.ctx.idx; S.today.items.splice(i, 1); persistSoon(); closeSheet(); render(); toast('Usunięte z dzisiejszego treningu'); return; }
  if (a === 'exclude') { const id = UI.sheet.id; if (!S.settings.exclude.includes(id)) S.settings.exclude.push(id); S.today = null; persistNow(); closeSheet(); render(); toast('Nie będę proponować: ' + EX[id].n); return; }
  if (a === 'unexclude') { S.settings.exclude = S.settings.exclude.filter(x => x !== UI.sheet.id); S.today = null; persistNow(); renderSheet(false); toast('Znowu w propozycjach'); return; }
  if (a === 'swap') { swapExercise(UI.sheet.ctx, b.dataset.id, b.dataset.perm === '1'); return; }
});
$('#sheetRoot').addEventListener('input', ev => {
  if (ev.target.id === 'figK') { AN.paused = true; AN.k = ev.target.value / 1000; const tg = $('[data-act=anim-toggle]'); if (tg) tg.textContent = '▶ Odtwórz'; drawFig('Przewijanie klatka po klatce'); }
  if (ev.target.id === 'figMarks') { AN.marks = ev.target.checked; drawFig(); }
  if (ev.target.id === 'pickQ') { UI.sheet.q = ev.target.value; const pos = ev.target.selectionStart; renderSheet(false); const n = $('#pickQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && UI.sheet) closeSheet(); });

function swapExercise(ctx, nid, perm) {
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
  persistNow(); closeSheet(); render(); toast('Zamienione: ' + EX[nid].n);
}
function addExercise(target, id) {
  const rx = prescribe(EX[id], {});
  if (target === 'session' && S.draft) {
    S.draft.ex.push(buildEx({id, sets: rx.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest}, S.draft.deload));
    persistNow(); goEx(S.draft.ex.length - 1);
  } else {
    ensureToday(); S.today.items.push({id, sets: rx.sets, lo: rx.lo, hi: rx.hi, rest: rx.rest, why: 'Dodane przez Ciebie'});
    S.today.estMin = estMin(S.today.items, S.today.deload); persistNow(); render();
  }
  toast('Dodane: ' + EX[id].n);
}

/* ---------- Views ---------- */
function cycleBar(wk) { return '<div class="cyc" aria-label="Tydzień ' + (wk + 1) + ' z 6">' + CYCLE.map((c, i) => '<span class="' + (c.deload ? 'dl ' : '') + (i < wk ? 'past' : i === wk ? 'now' : '') + '"></span>').join('') + '</div>'; }
function exRow(id, right, sub, act, extra) {
  const ex = EX[id];
  return '<li><button class="exrow" data-act="' + (act || 'sheet-open') + '" data-id="' + id + '"' + (extra || '') + '><span class="thumb">' + thumb(id) + '</span><span style="min-width:0"><span class="nm" style="display:block">' + ex.n + '</span>' + (sub || '') + '</span><span class="tg">' + right + '</span></button></li>';
}
const chipRow = (act, opts, cur, label) => '<div class="chips" role="group" aria-label="' + label + '">' + opts.map(([k, l]) => '<button class="pill" data-act="' + act + '" data-v="' + k + '" aria-pressed="' + (String(cur) === String(k)) + '">' + l + '</button>').join('') + '</div>';

function viewHome() {
  const t = ensureToday(); const st = S.settings; const wk = cycleWeek(); const cy = CYCLE[wk];
  const rec = recovery(S.workouts);
  const ws = weekStart(); const thisWeek = S.workouts.filter(w => new Date(w.date) >= ws).length;
  let h = '<div class="stack">';
  if (!st.welcomed) h += '<section class="card welcome"><b>Trening układa się sam.</b><p class="small">Aplikacja patrzy, które mięśnie są wypoczęte, jaki masz sprzęt i ile masz czasu. Po każdym treningu kolejny dopasowuje się do tego, co zrobiłeś. Ciężary podpowiada z Twojej historii.</p><button class="btn sm" data-act="welcomed">Rozumiem</button></section>';
  if (UI.summary) { const w = UI.summary; h += '<section class="card summary"><h3>Trening zapisany</h3><p style="margin-top:6px">' + esc(w.dayName) + ' · ' + w.ex.reduce((a, q) => a + q.sets.length, 0) + ' serii · objętość <b class="mono">' + fmt(Math.round(volume(w))) + ' kg</b></p>' + (w.prs.length ? '<div class="row" style="margin-top:10px">' + w.prs.map(q => '<span class="chip pr">Rekord: ' + EX[q].n + '</span>').join('') + '</div>' : '') + '<div class="row" style="margin-top:12px"><button class="btn sm" data-act="go" data-tab="recovery">Zobacz regenerację</button><button class="btn sm ghost" data-act="go" data-tab="progress">Postępy</button></div></section>'; }
  const focusM = [...new Set(t.items.flatMap(it => primary(EX[it.id])))].filter(m => m !== 'abs').slice(0, 4);
  const load = {}; t.items.forEach(it => { const m = EX[it.id].m; for (const k in m) load[k] = (load[k] || 0) + m[k] * it.sets; });
  h += '<section class="card today"><div class="today-top"><div class="today-txt"><div class="eyebrow">' + (t.mode === 'plan' ? 'Plan · ' + plan().name : 'Dziś · ' + (st.focus === 'auto' ? 'dobrane dla Ciebie' : 'wybrany zakres')) + '</div>' +
    '<h2>' + esc(t.title) + '</h2><div class="today-meta"><span><b class="mono">' + t.items.length + '</b> ćwiczeń</span><span><b class="mono">' + t.estMin + '</b> min</span></div><span class="chip' + (cy.deload ? ' dl' : '') + '">Tydz. ' + (wk + 1) + ' · ' + (cy.deload ? 'lżej' : 'RIR ' + cy.rir) + '</span></div>' +
    '<div class="today-map">' + targetMap(load) + '</div></div>' +
    (focusM.length ? '<div class="recchips">' + focusM.map(m => '<span class="recchip ' + status(rec[m].pct) + '"><i></i>' + MUSCLES[m] + ' ' + rec[m].pct + '%</span>').join('') + '</div>' : '') +
    (t.light ? '<p class="notice small"><b>Mięśnie jeszcze się regenerują.</b> Proponuję lżejszy trening albo dzień wolny.</p>' : '') +
    (t.mode === 'auto' && !t.auto && t.items.length < 3 ? '<p class="notice small"><b>Wybrane mięśnie jeszcze się regenerują.</b> Ustaw zakres „Auto”, a dobiorę wypoczęte partie.</p>' : '') +
    (cy.deload ? '<p class="notice small"><b>Tydzień lżejszy:</b> połowa serii, ok. 10% mniej ciężaru, duży zapas.</p>' : '') +
    '<button class="btn primary big" data-act="start"' + (t.items.length ? '' : ' disabled') + '>Zacznij trening</button>' +
    '<button class="cfg-toggle" data-act="cfg" aria-expanded="' + UI.cfgOpen + '"><span>' + esc(profile().name) + ' · ' + (t.mode === 'plan' ? t.title : st.duration + ' min · ' + FOCUS[st.focus].n) + '</span><b>' + (UI.cfgOpen ? 'Gotowe' : 'Zmień') + '</b></button>';
  if (UI.cfgOpen) {
    h += '<div class="cfg">';
    h += '<div class="eyebrow">Gdzie trenujesz</div>' + chipRow('set-profile', S.profiles.map(p => [p.id, esc(p.name)]), st.profile, 'Siłownia');
    if (t.mode === 'auto') {
      h += '<div class="eyebrow">Czas</div>' + chipRow('set-dur', [30, 45, 60, 75, 90].map(m => [m, m + ' min']), st.duration, 'Czas treningu');
      h += '<div class="eyebrow">Zakres</div>' + chipRow('set-focus', Object.entries(FOCUS).map(([k, v]) => [k, v.n]), st.focus, 'Zakres treningu');
    } else {
      h += '<div class="eyebrow">Dzień planu</div>' + chipRow('set-day', plan().days.map((d, i) => [i, d.name]), st.next % plan().days.length, 'Dzień planu');
    }
    h += '<button class="linkbtn" data-act="go-settings">Więcej ustawień: tryb, plan, sprzęt ›</button></div>';
  }
  h += '</section>';
  h += '<section class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><div class="sec-t">Ćwiczenia</div><span class="muted small">dotknij, żeby zobaczyć technikę</span></div><ol class="excards">' + t.items.map((it, i) => {
    const ex = EX[it.id]; const sg = suggestLoad(S.workouts, it, {deload: t.deload}); const n = t.deload ? Math.ceil(it.sets / 2) : it.sets;
    const tgt = sg.kg != null && !sg.first ? kgTxt(ex, sg.kg) : 'dobierz ciężar';
    const pm = primary(ex)[0]; const pr = rec[pm];
    const note = it.via === 'equip' ? 'zamiast: ' + EX[it.orig].n + ' (sprzęt)' : it.via === 'sub' ? 'zamiast: ' + EX[it.orig].n : '';
    return '<li><button class="excard" data-act="today-ex" data-id="' + it.id + '" data-idx="' + i + '"><span class="exnum mono">' + (i + 1) + '</span><span class="thumb">' + thumb(it.id) + '</span><span class="exbody"><b class="nm">' + ex.n + '</b>' +
      '<span class="exline"><span class="chip mono">' + n + ' × ' + range(ex, it) + '</span><span class="chip mono' + (sg.up ? ' up' : '') + '">' + (sg.up ? '↑ ' : '') + tgt + '</span></span>' +
      (pm && pr ? '<span class="extag"><span class="recchip ' + status(pr.pct) + '"><i></i>' + MUSCLES[pm] + ' ' + pr.pct + '%</span>' + (note ? '<span class="sub-note">' + esc(note) + '</span>' : '') + '</span>' : '') + '</span></button></li>';
  }).join('') + '</ol>' + (t.items.length ? '' : '<p class="muted card">Brak ćwiczeń dla tego sprzętu i zakresu. Zmień siłownię albo zakres.</p>') +
    '<div class="row today-actions">' + (t.mode === 'auto' ? '<button class="btn sm" data-act="shuffle">↻ Inne ćwiczenia</button>' : '') + '<button class="btn sm ghost" data-act="pick-open" data-target="today">+ Dodaj ćwiczenie</button></div></section>';
  h += '<section class="card row" style="justify-content:space-between"><div><div class="eyebrow">Ten tydzień</div><b>' + thisWeek + (st.mode === 'plan' ? ' z ' + plan().perWeek : '') + ' treningów</b></div><div class="week">' + Array.from({length: st.mode === 'plan' ? plan().perWeek : Math.max(3, thisWeek)}, (_, i) => '<span class="' + (i < thisWeek ? 'on' : '') + '"></span>').join('') + '</div></section>';
  h += '<button class="linkcard" data-act="go-know"><span><b>Jak to działa?</b><span class="muted small" style="display:block">Regeneracja, objętość i progresja z kursów trenerskich i badań</span></span><span aria-hidden="true">›</span></button>';
  return h + '</div>';
}
function goEx(i) { const d = S.draft; if (!d) return; if (i >= d.ex.length) { openPanel('finish', {mode: 'finish'}); return; } i = Math.max(0, i); UI.cur = i; UI.sel = null; INL.t = 0; render(); window.scrollTo({top: 0, behavior: REDUCED ? 'auto' : 'smooth'}); }
function viewSession() {
  const d = S.draft; const i = curEx(); const q = d.ex[i]; const ex = EX[q.id]; const n = d.ex.length; const k = activeSet(i); const s = q.sets[k];
  let h = '<div class="stack">';
  if (!d.genWu) h += '<section class="card wu"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div><b>Rozgrzewka · 5–10 min</b>' + (UI.wuOpen ? '' : '<div class="muted small">Cardio, krążenia, kilka lekkich serii</div>') + '</div><div class="row" style="flex-wrap:nowrap"><button class="btn sm ghost" data-act="wu-toggle" aria-expanded="' + UI.wuOpen + '">' + (UI.wuOpen ? 'Zwiń' : 'Pokaż') + '</button><button class="btn sm ok" data-act="wu-done">Zrobione</button></div></div>' +
    (UI.wuOpen ? '<ul><li>3–5 min lekkiego cardio: rower, orbitrek, szybki marsz</li><li>Krążenia ramion i bioder, wymachy nóg po 10</li><li>10 przysiadów i 10 pompek bez obciążenia</li><li>Przed ciężkim ćwiczeniem zrób serie rozgrzewkowe pokazane przy nim</li></ul>' : '') + '</section>';
  h += '<section class="player" id="player"><div class="pl-head"><button class="pl-count" data-act="list" aria-haspopup="dialog">Ćwiczenie ' + (i + 1) + ' z ' + n + ' ▾</button><button class="btn sm ghost" data-act="tech" data-i="' + i + '">Zamień</button></div>' +
    '<h2 class="pl-name">' + ex.n + '</h2><div class="row"><span class="chip">' + q.sets.length + ' × ' + range(ex, q) + '</span><span class="chip">przerwa ' + mmss(q.rest) + '</span><span class="chip m">' + KINDN[ex.kind] + '</span>' + (ex.uni ? '<span class="chip m">na stronę</span>' : '') + '</div>' +
    '<button class="inl-wrap" data-act="tech" data-i="' + i + '" aria-label="Pokaż technikę: ' + ex.n + '"><span class="inl" id="inlFig" data-id="' + q.id + '">' + figSVG(q.id, thumbK(ex), FC, tightBox(q.id), {}) + '</span><span class="inl-cap"><span id="inlPhase">Technika</span><b>Technika i błędy ›</b></span></button>' +
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
function volBars(done, mid) {
  const keys = Object.keys(MUSCLES); const MAX = 24; const pc = v => Math.min(100, v / MAX * 100);
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
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Serie w ostatnich 7 dniach</div>' + volBars(wk) + '<div class="legend"><span><i style="background:var(--accent)"></i>zrobione serie</span><span><i style="background:var(--ok-soft);box-shadow:inset 0 0 0 1px var(--ok)"></i>zalecany zakres</span></div><p class="muted small">Ćwiczenie pomocnicze liczy się jako pół serii. Generator dokłada serie tam, gdzie brakuje ich do zakresu.</p></section>';
  return h + '</div>';
}
function viewAtlas() {
  const q = UI.aq.trim().toLowerCase();
  const list = Object.entries(EX).filter(([id, e]) => (UI.ap === 'all' || e.p === UI.ap) && (UI.ak === 'all' || e.kind === UI.ak) && (!UI.mine || canDo(e, equip())) && (!q || (e.n + ' ' + e.en + ' ' + Object.keys(e.m).map(m => MUSCLES[m]).join(' ')).toLowerCase().includes(q)));
  let h = '<div class="atl-head"><input class="search" id="aq" type="search" placeholder="Szukaj: nazwa lub partia, np. plecy" value="' + esc(UI.aq) + '" aria-label="Szukaj ćwiczenia">' +
    '<div class="filters" role="group" aria-label="Sprzęt"><button class="pill" data-act="mine" aria-pressed="' + UI.mine + '">Mój sprzęt: ' + esc(profile().name) + '</button>' + KINDS.map(([k, l]) => '<button class="pill" data-act="ak" data-k="' + k + '" aria-pressed="' + (UI.ak === k) + '">' + l + '</button>').join('') + '</div>' +
    '<div class="filters" role="group" aria-label="Wzorzec ruchu">' + [['all', 'Każdy ruch']].concat(PATTERNS).map(([k, l]) => '<button class="pill" data-act="af" data-p="' + k + '" aria-pressed="' + (UI.ap === k) + '">' + l + '</button>').join('') + '</div></div><div class="stack">';
  h += '<p class="muted small">' + list.length + ' z ' + Object.keys(EX).length + ' ćwiczeń · dotknij, żeby zobaczyć animację techniki</p>';
  if (!list.length) h += '<p class="muted">Nic nie pasuje do wybranych filtrów.</p><button class="btn" data-act="af-reset">Wyczyść filtry</button>';
  PATTERNS.forEach(([k, l]) => {
    const g = list.filter(([, e]) => e.p === k); if (!g.length) return;
    h += '<section class="pgroup"><div class="sec-t">' + l + '</div><div class="atlas">' + g.map(([id, e]) => '<button class="acard' + (S.settings.exclude.includes(id) ? ' off' : '') + '" data-act="sheet-open" data-id="' + id + '"><span class="figbox">' + thumb(id) + '</span><b>' + e.n + '</b><span>' + KINDN[e.kind] + ' · ' + primary(e).map(m => MUSCLES[m]).join(', ') + '</span></button>').join('') + '</div></section>';
  });
  return h + '</div>';
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
  const lab = [0, pts.length - 1].map(i => '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (i ? 'end' : 'start') + '" style="fill:var(--muted);font:11px var(--body)">' + new Date(pts[i].d).toLocaleDateString('pl-PL', {day: 'numeric', month: 'short'}) + '</text>').join('');
  const dots = pts.map((q, i) => '<circle cx="' + X(i) + '" cy="' + Y(q.top) + '" r="' + (i === pts.length - 1 ? 5 : 3) + '" style="fill:' + (i === pts.length - 1 ? 'var(--accent)' : 'var(--surface)') + ';stroke:var(--accent)" stroke-width="2"/>').join('');
  return '<svg class="chart" viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="Najcięższa seria na treningu, ' + unitHead(ex) + '">' + g + '<path d="' + area + '" style="fill:var(--accent);opacity:.12"/><path d="' + line + '" style="fill:none;stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>' + dots + lab + '</svg>';
}
function viewSettings() {
  const st = S.settings; const wk = cycleWeek();
  let h = '<div class="stack">';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Jak układać trening</div><div class="seg" style="grid-template-columns:1fr 1fr" role="group" aria-label="Tryb"><button data-act="set-mode" data-v="auto" aria-pressed="' + (st.mode === 'auto') + '">Automatycznie</button><button data-act="set-mode" data-v="plan" aria-pressed="' + (st.mode === 'plan') + '">Stały plan</button></div>' +
    '<p class="muted small">' + (st.mode === 'auto' ? 'Każdy trening dobiera się do regeneracji mięśni, sprzętu i czasu.' : 'Dni idą po kolei według wybranego planu. Ćwiczenia, których nie zrobisz na swoim sprzęcie, zamieniają się automatycznie.') + '</p>';
  if (st.mode === 'plan') h += '<div class="plans" role="group" aria-label="Wybór planu">' + Object.entries(PLANS).map(([k, q]) => '<button data-act="set-plan" data-v="' + k + '" aria-pressed="' + (k === st.plan) + '"><b>' + q.perWeek + ' dni</b><span>' + q.name + '</span><span>' + q.level + '</span></button>').join('') + '</div>';
  h += '</section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Siłownie i sprzęt</div><ul class="profiles">' + S.profiles.map(p => {
    const open = UI.editProfile === p.id;
    return '<li class="' + (p.id === st.profile ? 'cur' : '') + '"><div class="prow"><button class="pname" data-act="set-profile" data-v="' + p.id + '"><span class="radio" aria-hidden="true"></span><span><b>' + esc(p.name) + '</b><span class="muted small" style="display:block">' + (p.equip.length ? p.equip.map(e => EQUIPMENT.find(x => x[0] === e)[1]).join(', ') : 'bez sprzętu') + '</span></span></button><button class="btn sm ghost" data-act="edit-profile" data-v="' + p.id + '" aria-expanded="' + open + '">' + (open ? 'Gotowe' : 'Edytuj') + '</button></div>' +
      (open ? '<div class="pedit"><label class="field"><span>Nazwa</span><input id="pname-' + p.id + '" data-pid="' + p.id + '" class="pname-in" value="' + esc(p.name) + '" maxlength="24"></label><div class="eqgrid">' + EQUIPMENT.map(([k, l]) => '<label class="eq"><input type="checkbox" data-pid="' + p.id + '" data-eq="' + k + '"' + (p.equip.includes(k) ? ' checked' : '') + '> ' + l + '</label>').join('') + '</div><p class="muted small">Ćwiczenia z tym sprzętem: ' + Object.values(EX).filter(e => canDo(e, p.equip)).length + ' z ' + Object.keys(EX).length + '</p>' + (S.profiles.length > 1 ? '<button class="btn sm danger" data-act="del-profile" data-v="' + p.id + '">Usuń tę siłownię</button>' : '') + '</div>' : '') + '</li>';
  }).join('') + '</ul><button class="btn sm" data-act="add-profile">+ Dodaj siłownię</button></section>';
  if (st.exclude.length) h += '<section class="card stack" style="gap:8px"><div class="sec-t">Nie proponuj</div><div class="row">' + st.exclude.map(id => '<button class="pill" data-act="unexclude-id" data-v="' + id + '">' + EX[id].n + ' ×</button>').join('') + '</div><p class="muted small">Dotknij, żeby znów proponować.</p></section>';
  h += '<section class="card stack" style="gap:10px"><div class="row" style="justify-content:space-between"><div class="sec-t">Cykl 6 tygodni</div><span class="chip">tydzień ' + (wk + 1) + '</span></div>' + cycleBar(wk) +
    '<div class="cycgrid">' + CYCLE.map((c, i) => '<div' + (i === wk ? ' class="now"' : '') + '><b>T' + (i + 1) + '</b><span>' + (c.deload ? 'lżej' : 'RIR ' + c.rir) + '</span></div>').join('') + '</div>' +
    '<p class="muted small">Wysiłek rośnie z tygodnia na tydzień, co 6. tydzień jest lżejszy.</p><button class="btn sm" data-act="cycle-reset">Zacznij cykl od tego tygodnia</button></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Gryf</div><div class="seg" style="grid-template-columns:repeat(3,1fr)">' + [20, 15, 10].map(b => '<button data-act="set-bar" data-v="' + b + '" aria-pressed="' + (st.bar === b) + '">' + b + ' kg</button>').join('') + '</div><p class="muted small">Do kalkulatora talerzy przy ćwiczeniach ze sztangą.</p></section>';
  h += '<section class="card stack" style="gap:10px"><div class="sec-t">Twoje dane</div><p class="muted small">Treningi zapisują się tylko w tym telefonie (' + S.workouts.length + ' treningów). Zrób kopię, żeby przenieść je na inne urządzenie.</p>' +
    '<div class="row"><button class="btn sm" data-act="export">Zapisz kopię (plik)</button><label class="btn sm ghost filebtn">Wczytaj kopię<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>' +
    '<details class="paste"><summary>Wklej dane z poprzedniej wersji</summary><textarea id="pasteData" rows="4" placeholder="Wklej tu skopiowane dane"></textarea><button class="btn sm" data-act="paste-import">Wczytaj</button></details>' +
    (UI.wipe ? '<div class="confirm card"><p>Usunąć wszystkie treningi i ustawienia z tego telefonu?</p><div class="row"><button class="btn sm danger" data-act="wipe-yes">Usuń wszystko</button><button class="btn sm ghost" data-act="wipe-no">Anuluj</button></div></div>' : '<button class="linkbtn danger-link" data-act="wipe">Usuń wszystkie dane</button>') + '</section>';
  h += '<button class="linkcard" data-act="go-know"><span><b>Wiedza</b><span class="muted small" style="display:block">Zasady treningu na masę i źródła</span></span><span aria-hidden="true">›</span></button>';
  h += '<p class="muted small center">Trening na masę · wersja 1.1 · <a href="https://github.com/Baniak88/trening-na-mase" target="_blank" rel="noopener">kod na GitHubie</a></p>';
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
];
const protein = bw => (bw ? Math.round(bw * 1.6) + '–' + Math.round(bw * 2) + ' g' : '–');
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
    [['Przysiad', 'przysiad, hack, suwnica'], ['Zawias biodrowy', 'martwy ciąg, RDL, hip thrust'], ['Wykrok', 'wykroki, bułgarski, skrzynia'], ['Pchanie poziome', 'wyciskanie, maszyna, pompki'], ['Pchanie pionowe', 'żołnierskie, hantle, maszyna'], ['Przyciąganie poziome', 'wiosłowania, face pull'], ['Przyciąganie pionowe', 'podciąganie, wyciąg'], ['Core i noszenie', 'deska, spięcia, farmer']].map(([a, b]) => '<div><b>' + a + '</b>' + b + '</div>').join('') + '</div></section>' +
    '<section class="card stack" style="gap:12px"><div class="sec-t">Dieta i regeneracja</div><p class="small">Trening daje sygnał do wzrostu, ale mięśnie rosną przy nadwyżce ok. 300 kcal i 1,6–2,0 g białka na kg masy ciała. Śpij 7–9 godzin.</p>' +
    '<div class="calc"><div class="field"><label for="bw">Masa ciała, kg</label><input id="bw" inputmode="decimal" value="' + fmt(bw) + '"></div><div><div class="field"><label>Białko dziennie</label></div><div class="out" id="prot">' + protein(bw) + '</div></div></div></section>' +
    '<section class="card stack" style="gap:8px"><div class="sec-t">Źródła</div><ol class="src">' + SRC.map(s => '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + '</a></li>').join('') + '</ol></section></div>';
}

/* ---------- Shell: app bar, banner, render ---------- */
const TITLES = {train: 'Trening', recovery: 'Regeneracja', atlas: 'Ćwiczenia', progress: 'Postępy'};
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
function renderBar() {
  const sess = UI.tab === 'train' && !UI.sub && S.draft; let left, right = '', sub = '';
  if (sess) {
    const d = S.draft; const [c, tt] = counts(d); const cur = curEx();
    left = '<div class="ab-t2"><span class="ab-title">' + esc(d.title || 'Trening') + '</span><span class="ab-clock mono" id="elapsed">0:00</span></div>';
    right = '<button class="btn sm primary" data-act="finish">Zakończ</button>';
    sub = '<div class="steps-strip" role="group" aria-label="Ćwiczenia w treningu">' + d.ex.map((q, i) => '<button class="dot' + (exDone(q) ? ' done' : '') + (i === cur ? ' cur' : '') + '" data-act="go-ex" data-i="' + i + '" aria-label="' + (i + 1) + '. ' + EX[q.id].n + (exDone(q) ? ', zrobione' : '') + '"' + (i === cur ? ' aria-current="step"' : '') + '>' + (exDone(q) ? '✓' : i + 1) + '</button>').join('') + '</div><div class="progress thin" aria-label="' + c + ' z ' + tt + ' serii"><b style="width:' + (tt ? c / tt * 100 : 0) + '%"></b></div>';
  } else if (UI.sub) {
    left = '<button class="ab-back" data-act="back" aria-label="Wróć">‹</button><span class="ab-title">' + (UI.sub === 'settings' ? 'Ustawienia' : 'Wiedza') + '</span>';
  } else {
    left = '<span class="ab-title">' + TITLES[UI.tab] + '</span>';
    right = '<button class="ab-icon" data-act="go-settings" aria-label="Ustawienia">' + GEAR + '</button>';
  }
  $('#abLeft').innerHTML = left; $('#abRight').innerHTML = right; $('#abSub').innerHTML = sub; $('#abSub').hidden = !sub;
}
function renderBanner() {
  const b = $('#sessBanner'); const show = !!S.draft && (UI.tab !== 'train' || !!UI.sub); b.hidden = !show;
  if (show) { const d = S.draft; const [c, t] = counts(d); b.innerHTML = '<button class="bn" data-act="back-train"><span><b>Trening w toku</b> · ' + esc(d.title || '') + ' · ' + c + '/' + t + ' serii · <span class="mono" id="bnTime"></span></span><span>Wróć ›</span></button>'; }
}
function render() {
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', !UI.sub && b.dataset.tab === UI.tab ? 'page' : 'false'));
  renderBar();
  let v;
  if (UI.sub === 'settings') v = viewSettings();
  else if (UI.sub === 'know') v = viewKnow();
  else v = UI.tab === 'train' ? (S.draft ? viewSession() : viewHome()) : {recovery: viewRecovery, atlas: viewAtlas, progress: viewProgress}[UI.tab]();
  $('#view').innerHTML = v;
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
    case 'welcomed': setting('welcomed', true); render(); break;
    case 'cfg': UI.cfgOpen = !UI.cfgOpen; render(); break;
    case 'set-profile': setting('profile', v); render(); toast('Siłownia: ' + profile().name); break;
    case 'set-dur': setting('duration', +v); render(); break;
    case 'set-focus': setting('focus', v); render(); break;
    case 'set-day': setting('next', +v); render(); break;
    case 'set-mode': setting('mode', v); render(); break;
    case 'set-plan': setting('plan', v); setting('next', 0); render(); toast('Plan: ' + PLANS[v].name); break;
    case 'set-bar': setting('bar', +v); render(); break;
    case 'shuffle': reshuffle(); render(); toast('Nowy zestaw ćwiczeń'); break;
    case 'today-ex': openSheet(b.dataset.id, {from: 'today', idx: +b.dataset.idx}); break;
    case 'pick-open': openPanel('pick', {target: b.dataset.target, q: ''}); break;
    case 'go': UI.tab = b.dataset.tab; UI.sub = null; render(); window.scrollTo(0, 0); break;
    case 'go-know': UI.fromSettings = UI.sub === 'settings'; UI.sub = 'know'; render(); window.scrollTo(0, 0); break;
    case 'go-settings': UI.sub = 'settings'; render(); window.scrollTo(0, 0); break;
    case 'back': UI.sub = UI.sub === 'know' && UI.fromSettings ? 'settings' : null; render(); window.scrollTo(0, 0); break;
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
      if (c < t) startRest(finishedEx ? Math.max(90, q.rest) : q.rest, nextLabel()); else stopRest();
      persistNow();
      if (c >= t) { render(); openPanel('finish', {mode: 'finish'}); break; }
      if (finishedEx) { const j = nextUndone(i); if (j >= 0) { toast('Następne: ' + EX[d.ex[j].id].n); goEx(j); break; } }
      render(); break;
    }
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
    case 'ak': UI.ak = b.dataset.k; render(); break;
    case 'af': UI.ap = b.dataset.p; render(); break;
    case 'mine': UI.mine = !UI.mine; render(); break;
    case 'af-reset': UI.ak = 'all'; UI.ap = 'all'; UI.aq = ''; UI.mine = false; render(); break;
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
  const blob = new Blob([exportJSON(S)], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'trening-na-mase-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Kopia zapisana');
}
function doImport(text) {
  try { const r = importData(S, text); S.today = null; persistNow(); render(); toast('Wczytano ' + r.added + ' nowych treningów (razem ' + r.total + ')'); }
  catch (err) { toast(err.message); }
}

/* ---------- Service worker & updates ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { $('#updateBar').hidden = false; $('#updateBtn').onclick = () => { persistNow(); w.postMessage('skipWaiting'); }; };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
  }).catch(() => { /* offline support unavailable */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

persist();
render();
if (S.draft) wake();
