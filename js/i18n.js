/* Interface language. The app renders its screens in Polish; when English is active, every text node and a few
 * attributes are translated right after they reach the DOM (MutationObserver), using exact phrases and number
 * patterns from js/i18n/en.js plus exercise texts from js/i18n/en-data.js. */
import {EN, EN_PATTERNS, EN_PREFIX, EN_REPLACE} from './i18n/en.js';

const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT']);
const NUM = /\d+(?:[.,]\d+)?/g;
const PL_CHARS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const exact = new Map(Object.entries(EN));
const patterns = new Map(Object.entries(EN_PATTERNS));
/** Polish text seen in English mode without a translation (for development checks). */
export const missing = new Set();
/** Every untranslated text in English mode, collected only when ?i18n-debug is in the URL. */
const raw = typeof location !== 'undefined' && /i18n-debug/.test(location.search) ? new Set() : null;
let lang = 'pl';
let observer = null;

export const getLang = () => lang;
export const isEn = () => lang === 'en';
/** Locale for dates and numbers. */
export const locale = () => (lang === 'en' ? 'en-GB' : 'pl-PL');

/** Language from the setting ('auto', 'pl' or 'en'); auto follows the device: Polish devices get Polish, the rest English. */
export function detectLang(pref) {
  if (pref === 'pl' || pref === 'en') return pref;
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'pl']);
  return /^pl\b/i.test(list[0] || '') ? 'pl' : 'en';
}

/** Adds [polish, english] pairs (exercise names, cues, notes) to the dictionary. */
export function addPairs(pairs) {
  for (const [pl, en] of pairs) {
    if (typeof pl !== 'string' || typeof en !== 'string') continue;
    const k = clean(pl);
    if (k && en && k !== en && !exact.has(k)) exact.set(k, en);
  }
}

const clean = s => s.replace(/\s+/g, ' ').trim();
const enNum = s => s.replace(/(\d),(\d)/g, '$1.$2');

function viaPattern(t) {
  if (!/\d/.test(t)) return null;
  const nums = t.match(NUM) || [];
  let i = 0;
  const key = t.replace(NUM, () => '{' + i++ + '}');
  const p = patterns.get(key);
  return p == null ? null : p.replace(/\{(\d+)\}/g, (m, n) => enNum(nums[+n] ?? ''));
}

function one(t) {
  const hit = exact.get(t);
  if (hit != null) return hit;
  return viaPattern(t);
}

const SYM = /^([\s✓✕↻›‹▾▸+−•↑↓▶❚·(„"]*)(.*?)([\s›▾✓:…·)”".!?]*)$/;
/** Exact phrase, number pattern, or the same with leading/trailing symbols kept. */
function core(t) {
  const r = one(t);
  if (r != null) return r;
  const m = t.match(SYM);
  if (m && (m[1] || m[3]) && m[2]) { const c = one(m[2]); if (c != null) return m[1] + c + m[3]; }
  // Known Polish openings followed by a value ("Ostatnio 80 kg × 8").
  for (const [pl, en] of EN_PREFIX) if (t.startsWith(pl)) { const rest = t.slice(pl.length); const r2 = en + (one(rest) ?? replaced(rest)); if (!PL_CHARS.test(r2)) return r2; }
  const q = replaced(t);
  return q !== t && !PL_CHARS.test(q) ? q : null;
}
/** Word-level replacements for values such as "12 kg na hantel". */
const replaced = t => EN_REPLACE.reduce((a, [pl, en]) => a.split(pl).join(en), t);

/** Translates one phrase; returns null when nothing matched. Phrases joined with separators go piece by piece. */
export function tr(text) {
  const t = clean(text);
  if (!t) return null;
  const r = core(t);
  if (r != null) return r;
  const parts = t.split(/( · | — | – |: |, | \/ |\. )/);
  if (parts.length < 2) return null;
  let changed = false;
  const out = parts.map((p, i) => { if (i % 2 || !p) return p; const q = core(p); if (q != null) { changed = true; return q; } return p; });
  if (!changed) return null;
  for (let i = 0; i < out.length; i += 2) if (PL_CHARS.test(out[i])) missing.add(out[i]);
  return out.join('');
}

function trNode(node) {
  const v = node.nodeValue;
  if (!v || !/[A-Za-zĄ-ż]/.test(v)) { if (v && /\d,\d/.test(v)) node.nodeValue = enNum(v); return; }
  const r = tr(v);
  if (r != null) {
    const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    const nv = lead + enNum(r) + trail;
    if (nv !== v) node.nodeValue = nv;
  } else {
    if (/\d,\d/.test(v)) node.nodeValue = enNum(v);
    if (PL_CHARS.test(v) || /\b(i|w|z|na|do|od|się|jest|nie)\b/.test(v)) missing.add(clean(v));
    else if (raw) raw.add(clean(v));
  }
}

function trEl(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute && el.getAttribute(a);
    if (v) { const r = tr(v); if (r != null && r !== v) el.setAttribute(a, r); else if (r == null && PL_CHARS.test(v)) missing.add(clean(v)); }
  }
}

const skipped = el => {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (SKIP.has(e.tagName) || e.hasAttribute('data-noi18n')) return true;
  return false;
};

/** Translates a subtree in place (English only). */
export function localize(root) {
  if (lang !== 'en' || !root) return;
  if (root.nodeType === 3) { if (!skipped(root.parentElement)) trNode(root); return; }
  if (root.nodeType !== 1 || skipped(root)) return;
  trEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.hasAttribute('data-noi18n')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? trNode(n) : trEl(n);
  // Form fields are skipped above (their values are user text), but their placeholders and labels are interface.
  if (root.querySelectorAll) for (const el of root.querySelectorAll('input[placeholder],textarea[placeholder],input[aria-label],textarea[aria-label]')) if (!el.closest('[data-noi18n]')) trEl(el);
  if (root.matches && root.matches('input,textarea')) trEl(root);
}

/** Sets the language and, for English, keeps the DOM translated from now on. */
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'pl';
  document.documentElement.lang = lang;
  if (observer) { observer.disconnect(); observer = null; }
  if (lang !== 'en') return;
  observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') { if (!skipped(m.target.parentElement)) trNode(m.target); }
      else if (m.type === 'attributes') { if (!skipped(m.target)) trEl(m.target); }
      else for (const n of m.addedNodes) localize(n);
    }
  });
  observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  localize(document.body);
  const tt = tr(document.title); if (tt) document.title = tt;
}

/** Translates a string for places outside the DOM (confirm dialogs, file names, AI prompts). */
export const T = s => (lang === 'en' ? (tr(s) ?? s) : s);
if (typeof window !== 'undefined') { window.__i18nMissing = missing; window.__i18nRaw = raw; }
