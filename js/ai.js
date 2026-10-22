/* AI coach: talks to the provider the user picked (their own API key), with a summary of the user's training as context.
 * Requests go straight from the phone to the provider; the key and the chat stay in localStorage on this device. */

export const PROVIDERS = {
  anthropic: {name: 'Anthropic', model: 'claude-sonnet-5-5', keyUrl: 'https://console.anthropic.com/settings/keys'},
  openai: {name: 'ChatGPT (OpenAI)', model: 'gpt-5-mini', keyUrl: 'https://platform.openai.com/api-keys'},
  gemini: {name: 'Gemini (Google)', model: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey'},
  custom: {name: 'Zgodny z OpenAI', model: '', keyUrl: 'https://openrouter.ai/keys', base: 'https://openrouter.ai/api/v1'},
};

/** True when the settings are enough to send a question. */
export const aiReady = ai => !!ai && !!PROVIDERS[ai.provider] && (ai.provider === 'custom' ? !!(ai.base && (ai.model || '').trim()) : !!(ai.key || '').trim());
const modelOf = ai => (ai.model || '').trim() || PROVIDERS[ai.provider].model;

/** Plain-language error for a failed request. */
function failure(status, detail) {
  const e = new Error(status === 401 || status === 403 ? 'Nieprawidłowy klucz API albo brak dostępu do modelu.'
    : status === 404 ? 'Nie znaleziono modelu. Sprawdź jego nazwę w ustawieniach AI.'
    : status === 429 ? 'Przekroczony limit zapytań albo brak środków na koncie u dostawcy.'
    : status === 400 ? 'Dostawca odrzucił zapytanie.' : 'Dostawca AI nie odpowiedział poprawnie.');
  e.detail = (status ? 'HTTP ' + status : '') + (detail ? ': ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 200) : '');
  return e;
}

/**
 * Sends the conversation and returns the answer text.
 * @param ai {provider, key, model, base}
 * @param system context and rules for the coach
 * @param msgs [{role: 'user'|'assistant', text}]
 */
export async function ask(ai, system, msgs, {timeout = 90000, fetchFn = fetch} = {}) {
  const model = modelOf(ai), key = (ai.key || '').trim();
  // Providers expect user and assistant turns to alternate, starting with the user.
  const turns = [];
  for (const m of msgs) {
    if (!m || !m.text) continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    if (!turns.length && role === 'assistant') continue;
    if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].text += '\n\n' + m.text;
    else turns.push({role, text: String(m.text)});
  }
  let url, headers = {'content-type': 'application/json'}, body, read;
  if (ai.provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    Object.assign(headers, {'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'});
    body = {model, max_tokens: 2500, system, messages: turns.map(m => ({role: m.role, content: m.text}))};
    read = j => (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  } else if (ai.provider === 'gemini') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    headers['x-goog-api-key'] = key;
    body = {systemInstruction: {parts: [{text: system}]}, contents: turns.map(m => ({role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.text}]}))};
    read = j => (((j.candidates || [])[0] || {}).content || {parts: []}).parts.map(p => p.text || '').join('');
  } else {
    const base = ai.provider === 'openai' ? 'https://api.openai.com/v1' : String(ai.base || '').trim().replace(/\/+$/, '');
    url = base + '/chat/completions';
    if (key) headers.authorization = 'Bearer ' + key;
    body = {model, messages: [{role: 'system', content: system}].concat(turns.map(m => ({role: m.role, content: m.text})))};
    read = j => ((((j.choices || [])[0] || {}).message || {}).content || '');
  }
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
  let res;
  try {
    res = await fetchFn(url, {method: 'POST', headers, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined});
  } catch (err) {
    throw new Error(err && err.name === 'AbortError' ? 'Dostawca AI nie odpowiedział na czas. Spróbuj jeszcze raz.' : 'Brak połączenia z dostawcą AI. Sprawdź internet.');
  } finally { if (timer) clearTimeout(timer); }
  let j = null;
  try { j = await res.json(); } catch (err) { /* not JSON */ }
  if (!res.ok) throw failure(res.status, j && (j.error && (j.error.message || j.error) || j.message));
  const text = j ? read(j) : '';
  if (!text.trim()) throw new Error('Dostawca AI zwrócił pustą odpowiedź.');
  return text.trim();
}

/**
 * System prompt with the coach's rules and the user's data.
 * @param d {lang, today, bw, duration, gym, equipment[], mode, plan, cycle, recovery{}, weekly{}, workouts[], exercises[]}
 */
export function buildSystem(d) {
  const L = [];
  L.push('You are the coach inside "' + (d.lang === 'en' ? 'My Trainer' : 'Mój Trener') + '", a muscle-building (hypertrophy) workout app.');
  L.push('Always answer in ' + (d.lang === 'en' ? 'English' : 'Polish') + '. Be concise and practical: short paragraphs or bullet lists, no tables.');
  L.push('Base advice on research on hypertrophy (volume of about 10–20 hard sets per muscle per week, 6–12 reps for compound lifts and 10–20 for isolation, 0–3 reps in reserve, 2–3 min rest for compound lifts, double progression, training muscles in the lengthened position). Say when evidence is weak.');
  L.push('You are not a doctor or dietitian. For pain, injury or medical conditions tell the user to see a physiotherapist or doctor and do not diagnose.');
  L.push('When the user asks for a new training plan or a change to their plan, include exactly one fenced code block with the language tag plan containing JSON like:');
  L.push('```plan\n{"name":"Push Pull Legs","days":[{"wd":0,"name":"Chest + triceps","ex":[{"id":"bench","sets":3,"lo":6,"hi":10,"rest":150}]}]}\n```');
  L.push('Rules for the plan: wd is the weekday (0 = Monday … 6 = Sunday); 2–6 training days; 3–8 exercises per day; use only ids from the exercise list below; sets 2–5; reps 6–12 for compound lifts and 10–20 for isolation; rest in seconds (60–180). Respect the user\'s equipment. After the block explain the plan in a few sentences. The app shows a button that loads the plan.');
  L.push('Do not output a plan block when the user did not ask for a plan.');
  L.push('');
  L.push('USER DATA (today: ' + d.today + ')');
  L.push('Body weight: ' + (d.bw ? d.bw + ' kg' : 'unknown') + '. Usual workout length: ' + d.duration + ' min. Gym profile: ' + d.gym + ' (equipment: ' + (d.equipment.join(', ') || 'none') + ').');
  L.push('Mode: ' + d.mode + '. Training cycle: ' + d.cycle + '.');
  if (d.plan) L.push('Current plan "' + d.plan.name + '": ' + d.plan.days.map(x => x.label + ': ' + (x.ex.join(', ') || 'rest')).join(' | '));
  L.push('Recovery now (% per muscle): ' + Object.entries(d.recovery).map(([m, v]) => m + ' ' + v).join(', ') + '.');
  L.push('Hard sets in the last 7 days / weekly target: ' + Object.entries(d.weekly).map(([m, v]) => m + ' ' + v).join(', ') + '.');
  L.push(d.workouts.length ? 'Recent workouts (newest first):\n' + d.workouts.join('\n') : 'No workouts logged yet.');
  L.push('');
  L.push('EXERCISE LIST (id | name | main muscles | equipment). Only these ids are valid in a plan; ✓ = backed by growth studies:');
  L.push(d.exercises.join('\n'));
  return L.join('\n');
}

/**
 * Finds a plan block in an answer and checks it.
 * @param valid id => true when the exercise id may be used
 * @returns {name, days:[{wd, name, ex:[{id, sets, lo, hi, rest}]}]} or null
 */
export function parsePlan(text, valid) {
  const m = String(text || '').match(/```\s*(?:plan|json)\s*\n([\s\S]*?)```/i);
  if (!m) return null;
  let o;
  try { o = JSON.parse(m[1]); } catch (err) { return null; }
  if (!o || !Array.isArray(o.days)) return null;
  const n = (v, lo, hi, def) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : def);
  const seen = new Set();
  const days = o.days.map((d, i) => ({
    wd: n(d && d.wd, 0, 6, i), name: String((d && d.name) || '').slice(0, 24),
    ex: (d && Array.isArray(d.ex) ? d.ex : []).filter(e => e && valid(e.id)).slice(0, 10).map(e => {
      const lo = n(e.lo, 1, 40, 8);
      return {id: e.id, sets: n(e.sets, 1, 8, 3), lo, hi: Math.max(lo, n(e.hi, 1, 40, 12)), rest: n(e.rest, 30, 300, 120)};
    }),
  })).filter(d => d.ex.length && !seen.has(d.wd) && seen.add(d.wd)).sort((a, b) => a.wd - b.wd);
  if (!days.length) return null;
  return {name: String(o.name || '').slice(0, 30), days};
}

/** Answer text without the plan block (the app shows its own card instead). */
export const stripPlan = text => String(text || '').replace(/```\s*(?:plan|json)\s*\n[\s\S]*?```/i, '').replace(/\n{3,}/g, '\n\n').trim();

/** Minimal, safe Markdown: paragraphs, lists, bold, italics, inline code, headings. */
export function md(text) {
  const esc = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = []; let list = null;
  const close = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    close();
    if ((m = line.match(/^#{1,4}\s+(.*)$/))) { out.push('<p><b>' + inline(m[1]) + '</b></p>'); continue; }
    out.push('<p>' + inline(line) + '</p>');
  }
  close();
  return out.join('');
}
