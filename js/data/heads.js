/**
 * Muscle heads (parts) and which ones each exercise emphasises.
 * Weights: 1 = main emphasis, 0.5 = also works. Keys are "muscle.head".
 * Curated exercises carry a short explanation; the rest get heads from name rules.
 */
import {EX, primary} from './catalog.js';

export const HEADS = {
  chest: [['clav', 'górna część (obojczykowa)'], ['stern', 'środkowa i dolna część (mostkowa)']],
  back: [['lats', 'najszerszy grzbietu'], ['mid', 'środek pleców (czworoboczny, równoległoboczne)']],
  delts: [['ant', 'przedni akton'], ['lat', 'boczny akton'], ['post', 'tylny akton']],
  biceps: [['long', 'głowa długa'], ['short', 'głowa krótka'], ['brach', 'mięsień ramienny']],
  triceps: [['long', 'głowa długa'], ['lat', 'głowa boczna'], ['med', 'głowa przyśrodkowa']],
  quads: [['rf', 'prosty uda'], ['vast', 'mięśnie obszerne']],
  hams: [['bf', 'dwugłowy uda (głowa długa)'], ['semi', 'półścięgnisty i półbłoniasty']],
  glutes: [['max', 'pośladkowy wielki'], ['med', 'pośladkowy średni']],
  calves: [['gas', 'brzuchaty łydki'], ['sol', 'płaszczkowaty']],
};
export const headName = key => { const [m, h] = key.split('.'); const x = (HEADS[m] || []).find(q => q[0] === h); return x ? x[1] : h; };

const T = {
  flat: 'Na płaskiej ławce najmocniej pracuje środkowa i dolna część klatki, górna słabiej. Z barków pomaga przedni akton, z tricepsa głowy boczna i przyśrodkowa.',
  incline: 'Skos 30–45° przenosi pracę na górną (obojczykową) część klatki. W badaniu Chavesa (2020) górna klatka urosła wyraźnie bardziej po wyciskaniu na skosie niż płasko.',
  fly: 'Rozpiętki trenują obie części klatki w mocnym rozciągnięciu. W badaniu Pinto (2025) górna i środkowa część urosły podobnie.',
  cg: 'Wąski chwyt i łokcie przy tułowiu: głównie głowy boczna i przyśrodkowa tricepsa. Głowa długa jest przy ramieniu wzdłuż tułowia skrócona i pracuje słabiej.',
  vpull: 'Ruch z góry w dół, łokcie wzdłuż tułowia: głównie najszerszy grzbietu. Środek pleców i biceps pomagają.',
  hpull: 'Wiosłowanie: środek pleców (czworoboczny, równoległoboczne) i najszerszy. Pomaga tylny akton barków. Łokcie szerzej = więcej środka pleców i tylnych barków, łokcie przy tułowiu = więcej najszerszego.',
  press: 'Wyciskanie nad głowę: głównie przedni akton, boczny pomaga. Tylny akton prawie nie pracuje, więc samo wyciskanie nie wystarczy na pełne barki.',
  lateral: 'Unoszenie bokiem to główne ćwiczenie na boczny akton, który daje szerokość barków. Wyciskania trenują go słabo.',
  curl: 'Ramię wzdłuż tułowia: obie głowy bicepsa pracują podobnie, mięsień ramienny pomaga.',
  inclineCurl: 'Ramię za tułowiem rozciąga głowę długą. W badaniu Kassiano (2025) uginanie na skosie dało większy przyrost w górnej części ramienia.',
  preacher: 'Ramię przed tułowiem skraca głowę długą, więc mocniej pracują głowa krótka i mięsień ramienny. W badaniu Kassiano (2025) modlitewnik dał większy przyrost w dolnej części ramienia.',
  overhead: 'Ramię nad głową rozciąga głowę długą tricepsa. W badaniu Maeo (2023) głowa długa urosła ok. 1,5 raza bardziej niż przy prostowaniu na wyciągu z ramieniem przy tułowiu.',
  pushdown: 'Ramię przy tułowiu: głównie głowy boczna i przyśrodkowa. Głowa długa pracuje, ale jest skrócona i rośnie słabiej niż przy ćwiczeniach nad głową (Maeo 2023).',
  skull: 'Leżąc z ramieniem odchylonym za głowę: częściowo rozciągnięta głowa długa, pracują wszystkie trzy głowy.',
  squat: 'Przysiad, suwnica i wykroki rozwijają głównie mięśnie obszerne. Prosty uda pracuje słabo, bo jednocześnie zgina biodro. Mocno pracuje pośladkowy wielki.',
  lunge: 'Wykroki: mięśnie obszerne i pośladkowy wielki; pośladkowy średni trzyma miednicę w równowadze.',
  legext: 'Prostowanie nóg to jedyne ćwiczenie, które mocno rozwija prosty uda (przysiady robią to słabo). W badaniu Maeo (2023) wersja siedząca dała większy przyrost prostego uda niż leżąca.',
  hinge: 'Ruch z biodra przy prawie prostych kolanach: głównie głowa długa dwugłowego uda i pośladkowy wielki. Półścięgnisty pracuje słabiej.',
  seatedCurl: 'Siedząc dwugłowe są rozciągnięte w biodrze. W badaniu Maeo (2021) wszystkie tylne mięśnie uda, zwłaszcza głowa długa dwugłowego, urosły bardziej niż przy uginaniu leżąc.',
  lyingCurl: 'Leżąc: mocno półścięgnisty, głowa długa dwugłowego słabiej. Przyrost mniejszy niż w wersji siedzącej (Maeo 2021).',
  nordic: 'Nordic najmocniej rozwija półścięgnisty (Bourne 2017), głowa długa dwugłowego pomaga.',
  hipext: 'Wyprosty bioder rozwijają głównie głowę długą dwugłowego i pośladki (Bourne 2017).',
  thrust: 'Hip thrust i mostek: pośladkowy wielki pracuje najmocniej w pełnym wyproście biodra. Dwugłowe pomagają.',
  single: 'Wersja jednonóż: dodatkowo pośladkowy średni stabilizuje miednicę.',
  calfStand: 'Stojąc z prostymi kolanami pracuje głównie brzuchaty łydki. W badaniu Kinoshity (2023) wspięcia stojąc dały większy przyrost łydek niż siedząc.',
  calfSeat: 'Siedząc ze zgiętymi kolanami brzuchaty prawie się wyłącza, pracuje głównie płaszczkowaty.',
};
const P = (hd, why) => ({hd, why});
const flat = P({'chest.stern': 1, 'chest.clav': 0.5, 'delts.ant': 0.5, 'triceps.lat': 0.5, 'triceps.med': 0.5}, T.flat);
const incl = P({'chest.clav': 1, 'chest.stern': 0.5, 'delts.ant': 0.5, 'triceps.lat': 0.5}, T.incline);
const vpull = P({'back.lats': 1, 'back.mid': 0.5, 'biceps.long': 0.5, 'biceps.short': 0.5}, T.vpull);
const hpull = P({'back.mid': 1, 'back.lats': 1, 'delts.post': 0.5, 'biceps.brach': 0.5}, T.hpull);
const press = P({'delts.ant': 1, 'delts.lat': 0.5, 'triceps.lat': 0.5, 'triceps.med': 0.5}, T.press);
const lateral = P({'delts.lat': 1}, T.lateral);
const curl = P({'biceps.long': 1, 'biceps.short': 1, 'biceps.brach': 0.5}, T.curl);
const prea = P({'biceps.short': 1, 'biceps.brach': 1, 'biceps.long': 0.5}, T.preacher);
const oh = P({'triceps.long': 1, 'triceps.lat': 0.5, 'triceps.med': 0.5}, T.overhead);
const pd = P({'triceps.lat': 1, 'triceps.med': 1, 'triceps.long': 0.5}, T.pushdown);
const skull = P({'triceps.long': 1, 'triceps.lat': 1, 'triceps.med': 0.5}, T.skull);
const squat = P({'quads.vast': 1, 'quads.rf': 0.5, 'glutes.max': 1}, T.squat);
const press45 = P({'quads.vast': 1, 'quads.rf': 0.5, 'glutes.max': 0.5}, T.squat);
const lunge = P({'quads.vast': 1, 'glutes.max': 1, 'glutes.med': 0.5}, T.lunge);
const legext = P({'quads.rf': 1, 'quads.vast': 1}, T.legext);
const hinge = P({'hams.bf': 1, 'hams.semi': 0.5, 'glutes.max': 1}, T.hinge);
const thrust = P({'glutes.max': 1, 'hams.bf': 0.5}, T.thrust);
const stand = P({'calves.gas': 1, 'calves.sol': 0.5}, T.calfStand);

const CURATED = {
  bench: flat, dbbench: flat, smithbench: flat, chestpress: flat, pushup: flat,
  incline: incl, inclinebar: incl, smithincl: incl, inclinemach: incl,
  pecdeck: P({'chest.clav': 1, 'chest.stern': 1}, T.fly), cablefly: P({'chest.clav': 1, 'chest.stern': 1}, T.fly),
  cgbench: P({'triceps.lat': 1, 'triceps.med': 1, 'chest.stern': 0.5}, T.cg),
  pullup: vpull, chinup: vpull, latpull: vpull, closepull: vpull, onearmpull: vpull,
  row: hpull, dbrow: hpull, cablerow: hpull, machinerow: hpull, tbar: hpull, onearmrow: hpull,
  ohp: press, dbohp: press, machpress: press, smithohp: press, arnold: press,
  latraise: lateral, cablelat: lateral, seatedlat: lateral,
  curl, cablecurl: curl, cablecurl1: curl, barcurl: curl, ezcurl: curl,
  inclinecurl: P({'biceps.long': 1, 'biceps.short': 0.5, 'biceps.brach': 0.5}, T.inclineCurl),
  preacher: prea, conc: prea,
  triext: oh, ropeoh: oh, triext1: oh, pushdown: pd, pushdown1: pd, skull, ezskull: skull,
  squat, goblet: squat, frontsquat: squat, smithsquat: squat, hack: press45, legpress: press45,
  bss: lunge, lunge, splitsquat: lunge, walklunge: lunge,
  legext, legext1: legext,
  deadlift: P({'hams.bf': 1, 'glutes.max': 1, 'back.mid': 0.5}, T.hinge), rdl: hinge, dbrdl: hinge,
  singlerdl: P({'hams.bf': 1, 'hams.semi': 0.5, 'glutes.max': 1, 'glutes.med': 0.5}, T.hinge + ' ' + T.single),
  legcurl: P({'hams.bf': 1, 'hams.semi': 1}, T.seatedCurl), lyingcurl: P({'hams.semi': 1, 'hams.bf': 0.5}, T.lyingCurl),
  nordic: P({'hams.semi': 1, 'hams.bf': 0.5}, T.nordic), hipext: P({'hams.bf': 1, 'glutes.max': 1}, T.hipext),
  hipthrust: thrust, dbthrust: thrust, glutebridge: thrust, singlebridge: P({'glutes.max': 1, 'glutes.med': 0.5, 'hams.bf': 0.5}, T.thrust + ' ' + T.single),
  calf: stand, lpcalf: stand, dbcalf: stand, seatedcalf: P({'calves.sol': 1}, T.calfSeat),
};

/* Name rules for the rest (English names from the exercise databases). */
function guess(ex) {
  const n = (ex.en || '').toLowerCase(); const o = {};
  for (const m of primary(ex)) {
    let hs;
    if (m === 'triceps') hs = /overhead|behind the head|french|lying|skull|incline.*extension|extension.*incline|ez bar triceps|decline.*extension/.test(n) ? {long: 1, lat: 0.5} : {lat: 1, med: 1};
    else if (m === 'biceps') hs = /hammer|reverse|zottman|cross body|pronat/.test(n) ? {brach: 1} : /preacher|spider|concentration|scott|prone incline|high cable|high pulley/.test(n) ? {short: 1, brach: 0.5} : /incline|drag|behind|lying supine|overhead cable/.test(n) ? {long: 1} : {long: 1, short: 1};
    else if (m === 'delts') hs = /rear|reverse fl|face pull|back fly|pull apart|bent over.*(raise|lateral)|lying.*rear/.test(n) ? {post: 1} : /lateral|side|upright|scaption|iron cross/.test(n) ? {lat: 1} : /press|military|jerk|push|arnold/.test(n) ? {ant: 1, lat: 0.5} : {ant: 1};
    else if (m === 'chest') hs = /incline/.test(n) ? {clav: 1, stern: 0.5} : /decline|dip/.test(n) ? {stern: 1} : /fly|flye|cross|pec deck|butterfly/.test(n) ? {clav: 1, stern: 1} : {stern: 1, clav: 0.5};
    else if (m === 'back') hs = /pulldown|pull-?up|chin|pullover|straight-arm/.test(n) ? {lats: 1} : /shrug/.test(n) ? {mid: 1} : /row|pull apart/.test(n) ? {mid: 1, lats: 1} : {lats: 1};
    else if (m === 'quads') hs = /extension|sissy/.test(n) ? {rf: 1, vast: 1} : {vast: 1};
    else if (m === 'hams') hs = /nordic|glute ham/.test(n) ? {semi: 1, bf: 0.5} : /curl/.test(n) ? {semi: 1, bf: 1} : {bf: 1};
    else if (m === 'glutes') hs = /abduct|monster|side/.test(n) ? {med: 1} : {max: 1};
    else if (m === 'calves') hs = /seated/.test(n) ? {sol: 1} : {gas: 1};
    for (const h in hs || {}) o[m + '.' + h] = hs[h];
  }
  return o;
}

/** Heads an exercise works: {"triceps.long": 1, ...}. */
export function headsOf(ex) {
  if (!ex) return {};
  if (!ex._hd) ex._hd = CURATED[ex.id] ? CURATED[ex.id].hd : guess(ex);
  return ex._hd;
}
/** Short explanation of the emphasis (curated exercises only). */
export const headWhy = ex => (CURATED[ex.id] ? CURATED[ex.id].why : '');
/** Main heads (weight 1) of an exercise within one muscle. */
export const mainHeads = (ex, m) => Object.entries(headsOf(ex)).filter(([k, w]) => w >= 1 && k.startsWith(m + '.')).map(([k]) => k);

/**
 * How well a list of exercises covers each head of the given muscles.
 * @returns {Record<string, number>} head key -> best weight (0, 0.5 or 1)
 */
export function headCoverage(ids, muscles) {
  const out = {};
  for (const m of muscles) for (const [h] of HEADS[m] || []) out[m + '.' + h] = 0;
  for (const id of ids) { const hd = headsOf(EX[id]); for (const k in hd) if (k in out) out[k] = Math.max(out[k], hd[k]); }
  return out;
}

/* ---------- Muscle length: where an exercise loads the target muscle hardest ---------- */
export const LENS = [
  ['long', 'Rozciągnięty', 'Największy opór, gdy mięsień jest długi (np. dół ruchu przy wyproście nad głową, RDL, uginaniu nóg siedząc).'],
  ['short', 'Skrócony', 'Największy opór w pełnym skurczu (np. góra hip thrustu, unoszenie bokiem z hantlami).'],
  ['full', 'Pełny zakres', 'Opór rozłożony na cały ruch (wyciskania, ściągania, maszyny z krzywką).'],
];
export const LEN_NAME = {long: 'Rozciągnięty', short: 'Skrócony', full: 'Pełny zakres'};
const LEN = {
  // long: hardest with the muscle stretched; short: hardest when fully shortened
  cablefly: 'long', cablerow: 'long', onearmrow: 'long', cablelat: 'long', inclinecurl: 'long', preacher: 'long',
  triext: 'long', ropeoh: 'long', triext1: 'long', skull: 'long', ezskull: 'long',
  squat: 'long', goblet: 'long', frontsquat: 'long', smithsquat: 'long', hack: 'long', bss: 'long', lunge: 'long', splitsquat: 'long', walklunge: 'long',
  rdl: 'long', dbrdl: 'long', singlerdl: 'long', legcurl: 'long', nordic: 'long',
  latraise: 'short', seatedlat: 'short', pushdown: 'short', pushdown1: 'short', lyingcurl: 'short',
  hipthrust: 'short', dbthrust: 'short', glutebridge: 'short', singlebridge: 'short',
};
/** 'long' | 'short' | 'full' for an exercise. */
export function lenOf(ex) {
  if (!ex) return 'full';
  if (LEN[ex.id]) return LEN[ex.id];
  if (!ex.lib && !ex.hidden) return 'full';
  const n = (ex.en || '').toLowerCase();
  if (/overhead|behind the head|incline.*curl|stiff|romanian|good morning|pullover|fly|flye|deficit|sissy|nordic|glute ham|deep|full squat|split squat|lunge/.test(n)) return 'long';
  if (/kickback|thrust|bridge|hip raise|butt lift|crunch|shrug|concentration|spider|lateral raise|side lateral|pushdown|leg extension|abduct|squeeze/.test(n)) return 'short';
  return 'full';
}
