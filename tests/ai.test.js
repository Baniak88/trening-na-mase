import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ask, parsePlan, stripPlan, md, buildSystem, aiReady} from '../js/ai.js';
import {EX, listable} from '../js/data/catalog.js';
import {migrate, exportJSON, defaultState} from '../js/store.js';

const valid = id => !!EX[id] && listable(EX[id], true);
const answer = 'Here you go.\n\n```plan\n{"name":"Test","days":[{"wd":2,"name":"Legs","ex":[{"id":"squat","sets":9,"lo":6,"hi":10,"rest":999},{"id":"made_up"}]},{"wd":0,"ex":[{"id":"bench","sets":3,"lo":12,"hi":8}]},{"wd":0,"ex":[{"id":"curl"}]}]}\n```\nGood luck.';

test('plan blocks from the AI are checked against the exercise list', () => {
  const p = parsePlan(answer, valid);
  assert.equal(p.name, 'Test');
  assert.deepEqual(p.days.map(d => d.wd), [0, 2], 'sorted, one day per weekday');
  assert.deepEqual(p.days[1].ex.map(e => e.id), ['squat'], 'unknown ids dropped');
  assert.equal(p.days[1].ex[0].sets, 8, 'sets capped');
  assert.equal(p.days[1].ex[0].rest, 300, 'rest capped');
  assert.ok(p.days[0].ex[0].hi >= p.days[0].ex[0].lo, 'rep range fixed');
  assert.equal(parsePlan('no plan here', valid), null);
  assert.equal(parsePlan('```plan\n{broken\n```', valid), null);
  assert.equal(stripPlan(answer), 'Here you go.\n\nGood luck.');
});

test('AI answers are rendered as safe Markdown', () => {
  const h = md('**Bold** and *it*\n- one\n- two <script>\n\n1. first');
  assert.ok(h.includes('<b>Bold</b>') && h.includes('<i>it</i>'));
  assert.ok(h.includes('<ul><li>one</li><li>two &lt;script&gt;</li></ul>'));
  assert.ok(h.includes('<ol><li>first</li></ol>'));
  assert.ok(!h.includes('<script>'));
});

test('requests go to the chosen provider with alternating turns', async () => {
  let seen;
  const fetchFn = async (url, init) => { seen = {url, init, body: JSON.parse(init.body)}; return {ok: true, status: 200, json: async () => ({content: [{type: 'text', text: 'Hi'}]})}; };
  const out = await ask({provider: 'anthropic', key: 'k'}, 'sys', [{role: 'assistant', text: 'old'}, {role: 'user', text: 'a'}, {role: 'user', text: 'b'}], {fetchFn});
  assert.equal(out, 'Hi');
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen.init.headers['x-api-key'], 'k');
  assert.equal(seen.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.deepEqual(seen.body.messages, [{role: 'user', content: 'a\n\nb'}]);
  assert.equal(seen.body.system, 'sys');

  const oa = async (url, init) => { seen = {url, body: JSON.parse(init.body), init}; return {ok: true, status: 200, json: async () => ({choices: [{message: {content: 'Yo'}}]})}; };
  assert.equal(await ask({provider: 'openai', key: 'sk'}, 'sys', [{role: 'user', text: 'q'}], {fetchFn: oa}), 'Yo');
  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen.body.messages[0].role, 'system');
  assert.equal(seen.init.headers.authorization, 'Bearer sk');

  const gm = async (url, init) => { seen = {url, body: JSON.parse(init.body), init}; return {ok: true, status: 200, json: async () => ({candidates: [{content: {parts: [{text: 'G'}]}}]})}; };
  assert.equal(await ask({provider: 'gemini', key: 'g'}, 'sys', [{role: 'user', text: 'q'}, {role: 'assistant', text: 'r'}, {role: 'user', text: 'q2'}], {fetchFn: gm}), 'G');
  assert.ok(seen.url.includes('/models/gemini-2.5-flash:generateContent'));
  assert.deepEqual(seen.body.contents.map(c => c.role), ['user', 'model', 'user']);

  const cu = async url => { seen = {url}; return {ok: true, status: 200, json: async () => ({choices: [{message: {content: 'C'}}]})}; };
  await ask({provider: 'custom', base: 'http://192.168.1.5:11434/v1/', model: 'llama3'}, 's', [{role: 'user', text: 'q'}], {fetchFn: cu});
  assert.equal(seen.url, 'http://192.168.1.5:11434/v1/chat/completions');
});

test('provider errors become clear messages', async () => {
  const bad = status => async () => ({ok: false, status, json: async () => ({error: {message: 'nope'}})});
  await assert.rejects(ask({provider: 'anthropic', key: 'k'}, 's', [{role: 'user', text: 'q'}], {fetchFn: bad(401)}), /klucz API/);
  await assert.rejects(ask({provider: 'openai', key: 'k'}, 's', [{role: 'user', text: 'q'}], {fetchFn: bad(429)}), /limit/);
  await assert.rejects(ask({provider: 'openai', key: 'k'}, 's', [{role: 'user', text: 'q'}], {fetchFn: async () => { throw new TypeError('Failed to fetch'); }}), /połączenia/);
  assert.equal(aiReady({provider: 'anthropic', key: ''}), false);
  assert.equal(aiReady({provider: 'custom', base: 'http://x', model: 'm'}), true);
});

test('the coach context follows the interface language', () => {
  const d = {lang: 'en', today: '2026-10-21', bw: 80, duration: 60, gym: 'Gym', equipment: ['barbell'], mode: 'auto', cycle: 'week 1', plan: {name: 'P', days: [{label: 'Mon', ex: ['Bench press 3x6-10']}]}, recovery: {chest: 90}, weekly: {chest: '6/10-20'}, workouts: [], exercises: ['bench | Wyciskanie / Bench press | chest | barbell ✓']};
  assert.ok(buildSystem(d).includes('Always answer in English'));
  assert.ok(buildSystem({...d, lang: 'pl'}).includes('Always answer in Polish'));
  assert.ok(buildSystem(d).includes('bench | Wyciskanie / Bench press'));
});

test('the API key stays out of backups and survives migration', () => {
  const s = migrate({...defaultState(), ai: {provider: 'gemini', key: 'secret', model: ''}, chat: [{role: 'user', text: 'hi'}, {role: 'bot', text: 'x'}]});
  assert.equal(s.ai.provider, 'gemini');
  assert.equal(s.ai.key, 'secret');
  assert.equal(s.chat.length, 1);
  assert.ok(!exportJSON(s).includes('secret'));
  assert.equal(migrate({ai: {provider: 'evil'}}).ai.provider, 'anthropic');
});
