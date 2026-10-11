import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EX, canDo} from '../js/data/catalog.js';
import {recovery, weeklySets, status} from '../js/engine/recovery.js';
import {generate, alternatives, autoFocus} from '../js/engine/generator.js';
import {suggestLoad, e1rm, roundLoad} from '../js/engine/progression.js';

const GYM = ['barbell', 'dumbbells', 'bench', 'machines', 'cable', 'pullup', 'dip'];
const HOME = ['dumbbells', 'bench', 'pullup'];
const NOW = new Date('2026-10-12T18:00:00Z');
const hoursAgo = h => new Date(+NOW - h * 36e5).toISOString();
const wk = (h, ex, extra = {}) => ({id: 'w' + h, date: hoursAgo(h + 1), end: hoursAgo(h), ex, ...extra});
const sets = (n, kg, reps) => Array.from({length: n}, () => ({kg, reps}));

test('every exercise has a figure, needs and alternatives that exist', () => {
  for (const [id, ex] of Object.entries(EX)) {
    if (ex.lib) assert.ok(ex.img && ex.cues.length && ex.n && Object.values(ex.m).includes(1), id + ' library entry');
    else assert.ok(ex.fig && ex.fig.A && ex.fig.B, id + ' figure');
    assert.ok(Array.isArray(ex.needs), id + ' needs');
    for (const a of ex.alt) assert.ok(EX[a], id + ' alt ' + a);
  }
});

test('fresh lifter is fully recovered', () => {
  const r = recovery([], NOW);
  for (const m in r) assert.equal(r[m].pct, 100);
});

test('chest is tired right after a chest day and recovers over 72 h', () => {
  const day = [wk(2, [{id: 'bench', sets: sets(4, 80, 8)}, {id: 'dbbench', sets: sets(3, 30, 10)}])];
  const r2 = recovery(day, NOW);
  assert.ok(r2.chest.pct < 40, 'chest ' + r2.chest.pct);
  assert.equal(status(r2.chest.pct), 'tired');
  assert.ok(r2.triceps.pct > r2.chest.pct, 'secondary muscle less tired');
  assert.equal(r2.quads.pct, 100);
  const later = recovery(day, new Date(+NOW + 71 * 36e5));
  assert.ok(later.chest.pct >= 95);
});

test('weekly sets count secondary muscles as half', () => {
  const w = weeklySets([wk(10, [{id: 'bench', sets: sets(4, 80, 8)}])], NOW);
  assert.equal(w.chest, 4);
  assert.equal(w.triceps, 2);
});

test('auto focus picks the fresher half', () => {
  const legDay = [wk(20, [{id: 'squat', sets: sets(4, 100, 6)}, {id: 'rdl', sets: sets(3, 80, 8)}, {id: 'legpress', sets: sets(3, 150, 10)}])];
  assert.equal(autoFocus(recovery(legDay, NOW)).focus, 'upper');
  assert.equal(autoFocus(recovery([], NOW)).focus, 'full');
});

test('generated workout respects equipment, time and recovery', () => {
  for (const duration of [30, 45, 60, 75]) {
    const g = generate({workouts: [], equipment: HOME, duration, seed: 7, now: NOW});
    assert.ok(g.items.length >= 3, duration + ' min: ' + g.items.length);
    for (const it of g.items) assert.ok(canDo(EX[it.id], HOME), it.id + ' needs ' + EX[it.id].needs);
    assert.equal(new Set(g.items.map(i => i.id)).size, g.items.length, 'no duplicates');
    assert.ok(g.estMin <= duration + 6, 'fits time: ' + g.estMin + ' vs ' + duration);
  }
  const legDay = [wk(20, [{id: 'squat', sets: sets(4, 100, 6)}, {id: 'rdl', sets: sets(3, 80, 8)}])];
  const g = generate({workouts: legDay, equipment: GYM, duration: 60, seed: 3, now: NOW});
  assert.equal(g.focus, 'upper');
  assert.ok(!g.items.some(i => ['quads', 'hams'].some(m => EX[i.id].m[m] >= 1)), 'no tired legs');
});

test('same seed gives the same workout, another seed can differ', () => {
  const a = generate({equipment: GYM, duration: 60, seed: 11, now: NOW});
  const b = generate({equipment: GYM, duration: 60, seed: 11, now: NOW});
  assert.deepEqual(a.items, b.items);
  const seeds = new Set([1, 2, 3, 4, 5, 6].map(s => generate({equipment: GYM, duration: 60, seed: s, now: NOW}).items.map(i => i.id).join()));
  assert.ok(seeds.size > 1, 'shuffle changes picks');
});

test('focus choices produce sensible first exercises', () => {
  const first = f => EX[generate({equipment: GYM, focus: f, duration: 60, seed: 2, now: NOW}).items[0].id];
  assert.equal(first('push').p, 'hpush');
  assert.equal(first('pull').p, 'vpull');
  assert.equal(first('legs').p, 'knee');
});

test('alternatives stay within equipment and pattern', () => {
  const alt = alternatives('bench', HOME);
  assert.ok(alt.length > 0);
  for (const id of alt) assert.ok(canDo(EX[id], HOME));
  assert.ok(alt.includes('dbbench'));
});

test('double progression adds weight only when every set hits the top', () => {
  const item = {id: 'bench', sets: 3, lo: 6, hi: 10};
  const hit = suggestLoad([wk(72, [{id: 'bench', sets: sets(3, 80, 10)}])], item, {now: NOW});
  assert.equal(hit.kg, 82.5);
  assert.ok(hit.up);
  const miss = suggestLoad([wk(72, [{id: 'bench', sets: [{kg: 80, reps: 10}, {kg: 80, reps: 9}, {kg: 80, reps: 8}]}])], item, {now: NOW});
  assert.equal(miss.kg, 80);
  assert.ok(!miss.up);
  const first = suggestLoad([], item, {now: NOW});
  assert.equal(first.kg, null);
  assert.ok(first.first);
});

test('helpers', () => {
  assert.equal(Math.round(e1rm(100, 5)), 117);
  assert.equal(roundLoad(EX.bench, 81.3), 82.5);
});

test('only exercises with growth evidence are suggested', async () => {
  const {usable, PLANS} = await import('../js/data/catalog.js');
  for (const id of ['facepull', 'plank', 'farmer', 'stepup', 'dips']) assert.equal(usable(EX[id]), false, id);
  for (const [id, ex] of Object.entries(EX)) if (usable(ex)) assert.ok(['A', 'B'].includes(ex.ev.l) && ex.ev.s, id + ' evidence');
  for (const p of Object.values(PLANS)) for (const d of p.days) for (const e of d.ex) assert.ok(usable(EX[e.id]), 'plan uses ' + e.id);
  for (const focus of ['full', 'upper', 'lower', 'push', 'pull', 'legs']) {
    const g = generate({workouts: [], equipment: GYM, duration: 90, focus, seed: 5, now: NOW});
    assert.ok(g.items.length >= 3, focus);
    for (const it of g.items) assert.ok(usable(EX[it.id]), focus + ' picked ' + it.id);
  }
  for (const id of alternatives('bench', GYM)) assert.ok(usable(EX[id]), 'alt ' + id);
});

test('weekly planner fills a day with the chosen muscles', async () => {
  const {fillDay, weekDays, dayFor, nextDay, weekdayOf, PRESETS} = await import('../js/engine/planner.js');
  const {usable, primary, isCompound} = await import('../js/data/catalog.js');
  const day = fillDay(['chest', 'biceps'], {equipment: GYM});
  const hit = new Set(day.flatMap(e => primary(EX[e.id])));
  assert.ok(hit.has('chest') && hit.has('biceps'));
  assert.ok(day.every(e => usable(EX[e.id]) && (primary(EX[e.id]).includes('chest') || primary(EX[e.id]).includes('biceps'))), 'only chosen muscles');
  assert.ok(isCompound(EX[day[0].id]), 'compound first');
  assert.equal(new Set(day.map(e => e.id)).size, day.length, 'no duplicates');
  const sets = m => day.filter(e => primary(EX[e.id]).includes(m)).reduce((a, e) => a + e.sets, 0);
  assert.ok(sets('chest') >= 6 && sets('chest') <= 12, 'chest sets ' + sets('chest'));
  const home = fillDay(['back', 'quads', 'delts'], {equipment: HOME});
  assert.ok(home.length >= 3 && home.every(e => canDo(EX[e.id], HOME)), 'home equipment');
  assert.ok(fillDay(['chest', 'back', 'delts', 'biceps', 'triceps', 'quads'], {equipment: GYM}).length <= 8, 'day stays short');
  assert.deepEqual(fillDay([], {equipment: GYM}), []);
  assert.deepEqual(fillDay(['chest'], {equipment: GYM, seed: 4}), fillDay(['chest'], {equipment: GYM, seed: 4}), 'deterministic');
  const days = weekDays(PRESETS[0].days, {equipment: GYM});
  assert.equal(days[0].wd, 0);
  assert.equal(days[0].name, 'Klatka + Biceps');
  assert.equal(dayFor(days, 2), null, 'Wednesday is a rest day');
  assert.equal(nextDay(days, 2).day.wd, 3);
  assert.equal(nextDay(days, 4).inDays, 3, 'Friday to Monday');
  assert.equal(weekdayOf(new Date(2026, 9, 12)), 0, '12 Oct 2026 is a Monday');
});

test('every muscle group has a wide choice of evidence-backed exercises', async () => {
  const {usable, primary, TRAINABLE, SOURCES} = await import('../js/data/catalog.js');
  const u = Object.values(EX).filter(usable);
  assert.ok(u.length >= 70, 'usable ' + u.length);
  for (const m of TRAINABLE) {
    const n = u.filter(e => primary(e).includes(m)).length;
    assert.ok(n >= (m === 'calves' ? 4 : 8), m + ' has ' + n);
  }
  for (const e of u) {
    assert.ok(SOURCES[e.ev.s], e.id + ' source');
    assert.ok(e.fig.A && e.fig.B && e.cues.length && e.err.length, e.id + ' content');
    for (const a of e.alt) assert.ok(EX[a], e.id + ' alt ' + a);
  }
});

test('library exercises are listed but never picked automatically', async () => {
  const {usable, listable, photoSrc} = await import('../js/data/catalog.js');
  const {fillDay} = await import('../js/engine/planner.js');
  const lib = Object.values(EX).filter(e => e.lib);
  assert.ok(lib.length > 400, 'library ' + lib.length);
  assert.ok(lib.every(e => !usable(e) && listable(e, true) && !listable(e, false)));
  assert.match(photoSrc(lib[0], 1), /^https:\/\/raw\.githubusercontent\.com\/.+\/1\.jpg$/);
  const g = generate({workouts: [], equipment: [...GYM, 'kettlebell', 'bands'], duration: 90, focus: 'full', seed: 3, now: NOW});
  assert.ok(g.items.every(it => !EX[it.id].lib));
  assert.ok(fillDay(['chest', 'back'], {equipment: [...GYM, 'kettlebell', 'bands']}).every(it => !EX[it.id].lib));
});

test('muscle heads: every evidence exercise is mapped and the planner covers different heads', async () => {
  const {usable, primary} = await import('../js/data/catalog.js');
  const {HEADS, headsOf, headWhy, headCoverage, mainHeads} = await import('../js/data/heads.js');
  const {fillDay} = await import('../js/engine/planner.js');
  for (const e of Object.values(EX).filter(usable)) {
    for (const m of primary(e).filter(k => HEADS[k])) assert.ok(mainHeads(e, m).length, e.id + ' main head of ' + m);
    assert.ok(headWhy(e).length > 20, e.id + ' explanation');
  }
  assert.deepEqual(mainHeads(EX.ropeoh, 'triceps'), ['triceps.long']);
  assert.ok(mainHeads(EX.preacher, 'biceps').includes('biceps.short'));
  assert.deepEqual(mainHeads(EX.seatedcalf, 'calves'), ['calves.sol']);
  assert.ok(headsOf(EX.x_reverse_flyes)['delts.post'] === 1, 'library rear delt by name');
  const full = ms => { const d = fillDay(ms, {equipment: GYM}); const c = headCoverage(d.map(x => x.id), ms); return Object.entries(c).filter(([, w]) => w < 1).map(([k]) => k); };
  assert.deepEqual(full(['triceps']), [], 'triceps: all three heads');
  assert.deepEqual(full(['biceps']), [], 'biceps: long, short, brachialis');
  assert.deepEqual(full(['calves']), [], 'calves: gastrocnemius and soleus');
  assert.deepEqual(full(['chest']), [], 'chest: upper and middle');
  assert.deepEqual(full(['delts']), ['delts.post'], 'delts: front and side (no evidence-backed rear delt exercise)');
  const quads = fillDay(['quads'], {equipment: GYM}).map(x => x.id);
  assert.ok(!(quads.includes('legext') && quads.includes('legext1')), 'no near-duplicate variants');
});
