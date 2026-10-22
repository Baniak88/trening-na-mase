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

test('names shown in plans and muscle maps have English versions', async () => {
  const {HEADS} = await import('../js/data/heads.js');
  const {PLANS} = await import('../js/data/catalog.js');
  const texts = [];
  for (const parts of Object.values(HEADS)) for (const p of parts) texts.push(p[1]);
  for (const p of Object.values(PLANS)) for (const k of ['name', 'long', 'when']) if (typeof p[k] === 'string') texts.push(p[k]);
  const missing = texts.filter(t => tr(t) == null);
  assert.deepEqual(missing, []);
  assert.equal(tr('✓ górna część (obojczykowa)'), '✓ upper (clavicular) part');
});

test('progression advice reads fully in English', async () => {
  const {looksPolish} = await import('../js/i18n.js');
  for (const t of ['Ostatnio 80 kg × 8, ponad 4 tygodnie temu. Wracasz od 70 kg.', 'Ostatnio 80 kg × 8/8/9. Ten sam ciężar, celuj w 10 w każdej serii.',
    'Tydzień lżejszy: 70 kg, 8 powtórzeń, duży zapas.', 'Ostatnio masa ciała × 12/12. Góra zakresu w każdej serii, więc dziś +2,5 kg.',
    'Pierwszy raz: dobierz ciężar na 8–12 z zapasem 2–3 powtórzeń.', 'Pierwszy raz: bez obciążenia, ile się da w zakresie 8–12.']) {
    const r = tr(t); assert.ok(r && !looksPolish(r), t + ' → ' + r);
  }
});

test('English texts use British spelling', async () => {
  const {EN, EN_PATTERNS} = await import('../js/i18n/en.js');
  const {LIB} = await import('../js/data/library.js');
  const US = /\b(color|colors|center|centered|favorite|gray|behavior|meter|meters|liter|toward|catalog|program|fiber|defense|aluminum|maximize|minimize|optimize|stabilize|emphasize|emphasizes|utilize|utilized|neutralize|realize|organize|recognize|personalize|customize|analyze|lbs?)\b/i;
  const all = [...Object.values(EN), ...Object.values(EN_PATTERNS), ...EN_DATA.map(p => p[1]), ...LIB.flatMap(e => [e.en, ...(e.cues || [])])];
  assert.deepEqual(all.filter(t => typeof t === 'string' && US.test(t)), []);
});
