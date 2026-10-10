import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultState, importData, migrate, exportJSON} from '../js/store.js';

const proto = {app: 'trening-na-mase-prototyp',
  settings: {plan: 'ul4', equip: 'mach', next: 2, bar: 15, bw: 82, subs: {squat: 'hack'}, cycleStart: '2026-10-05T00:00:00.000Z', onboarded: true},
  workouts: [{id: 'w_a1', date: '2026-10-06T17:00:00.000Z', end: '2026-10-06T18:05:00.000Z', plan: 'ul4', day: 0, dayName: 'Góra A', deload: false, week: 0,
    ex: [{id: 'bench', sets: [{kg: 70, reps: 8}, {kg: 70, reps: 7}]}], prs: []}]};

test('prototype export imports into an empty app with its settings', () => {
  const S = defaultState();
  const r = importData(S, JSON.stringify(proto));
  assert.equal(r.added, 1);
  assert.equal(S.settings.plan, 'ul4');
  assert.equal(S.settings.bar, 15);
  assert.equal(S.settings.subs.squat, 'hack');
  assert.ok(S.profiles.some(p => p.id === S.settings.profile));
});

test('import merges by id and does not duplicate', () => {
  const S = defaultState();
  importData(S, proto);
  const again = importData(S, proto);
  assert.equal(again.added, 0);
  assert.equal(S.workouts.length, 1);
});

test('export round-trips', () => {
  const S = defaultState();
  importData(S, proto);
  const T = defaultState();
  importData(T, exportJSON(S));
  assert.equal(T.workouts.length, 1);
  assert.deepEqual(T.profiles.map(p => p.id), S.profiles.map(p => p.id));
});

test('bad input gives a readable error', () => {
  assert.throws(() => importData(defaultState(), 'nie json'), /JSON/);
  assert.throws(() => importData(defaultState(), '{}'), /treningów/);
});

test('migrate drops unknown exercises in substitutions and fixes profile', () => {
  const s = migrate({settings: {subs: {squat: 'nope'}, profile: 'gone'}});
  assert.deepEqual(s.settings.subs, {});
  assert.equal(s.settings.profile, 'gym');
});
