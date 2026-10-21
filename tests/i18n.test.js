import {test} from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = globalThis.document || {documentElement: {}};
const {tr, addPairs, detectLang} = await import('../js/i18n.js');
const {EN_DATA} = await import('../js/i18n/en-data.js');
const {EX} = await import('../js/data/catalog.js');

test('interface phrases, numbers and joined pieces are translated', () => {
  assert.equal(tr('Zacznij trening'), 'Start workout');
  assert.equal(tr('6 ćwiczeń · ok. 58 min'), '6 exercises · about 58 min');
  assert.equal(tr('Ostatnio 80 kg × 8/8/9. Ten sam ciężar, celuj w 10 w każdej serii.'), 'Last time 80 kg × 8/8/9. Same weight, aim for 10 in every set.');
  assert.equal(tr('✓ 19 z badaniami'), '✓ 19 backed by studies');
  assert.equal(tr('Zupełnie nieznany tekst'), null);
});

test('every curated exercise text has an English version', () => {
  addPairs(EN_DATA);
  const missing = [];
  for (const e of Object.values(EX)) {
    if (e.lib) continue;
    const f = e.fig || {};
    const texts = [...e.cues, ...e.err, ...(f.sA || []), ...(f.sB || []), ...(f.marks || []).map(m => m.l).filter(Boolean)];
    for (const t of texts) if (tr(t) == null) missing.push(e.id + ': ' + t);
  }
  assert.deepEqual(missing, []);
});

test('language follows the setting, then the device', () => {
  assert.equal(detectLang('pl'), 'pl');
  assert.equal(detectLang('en'), 'en');
  Object.defineProperty(globalThis, 'navigator', {value: {languages: ['pl-PL']}, configurable: true});
  assert.equal(detectLang('auto'), 'pl');
  Object.defineProperty(globalThis, 'navigator', {value: {languages: ['de-DE', 'pl']}, configurable: true});
  assert.equal(detectLang('auto'), 'en');
});
