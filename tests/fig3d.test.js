import {test} from 'node:test';
import assert from 'node:assert/strict';

const {solve3d, setBody} = await import('../js/fig3d.js');
const {readFileSync} = await import('node:fs');
const bin = readFileSync(new URL('../js/data/body.bin', import.meta.url)); setBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.length));
const {POSES} = await import('../js/data/poses3d.js');
const {EX} = await import('../js/data/catalog.js');

test('every 3D pose belongs to an exercise', () => {
  assert.deepEqual(Object.keys(POSES).filter(id => !EX[id]), []);
});

test('hands and feet reach their targets through the whole rep, nothing goes through the floor', () => {
  const bad = [];
  for (const [id, spec] of Object.entries(POSES)) {
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const r = solve3d(spec, k);
      const nums = [r.err, r.minY, ...r.hands.flat(), ...Object.values(r.joints).flat()];
      if (nums.some(x => !Number.isFinite(x))) { bad.push(`${id}@${k}: NaN`); continue; }
      if (r.err > 0.02) bad.push(`${id}@${k}: target ${r.err.toFixed(3)} m out of reach`);
      if (r.minY < -0.03) bad.push(`${id}@${k}: ${(-r.minY).toFixed(2)} m below the floor`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the bench press bar touches the chest and locks out over the shoulders', () => {
  const top = solve3d(POSES.bench, 0), low = solve3d(POSES.bench, 1);
  const bar = r => r.hands.reduce((a, h) => a.map((v, i) => v + h[i] / 2), [0, 0, 0]);
  assert.ok(Math.abs(bar(top)[2] - top.joints.shL[2]) < 0.06, 'bar over the shoulders at the top');
  assert.ok(bar(low)[1] - low.joints.chest[1] < 0.16, 'bar on the chest at the bottom');
  assert.ok(top.elbow[0] < 40 && low.elbow[0] > 90);
});

test('squat: thighs reach parallel, feet stay planted', () => {
  const a = solve3d(POSES.squat, 0).joints, b = solve3d(POSES.squat, 1).joints;
  assert.ok(b.hpL[1] <= b.knL[1] + 0.02, 'hip at or below knee height');
  assert.ok(Math.hypot(a.anL[0] - b.anL[0], a.anL[1] - b.anL[1], a.anL[2] - b.anL[2]) < 0.005);
});
