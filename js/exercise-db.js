// Übungsdatenbank: Basisbewegungen mit Varianten (js/data/ex-*.js), Muskeln, Geräte, Tipps und Figuren.
// Varianten erben alles von ihrer Basisübung und überschreiben nur, was abweicht.
import { renderFigure } from './figure.js';
import { FIGS } from './data/figures.js';
import { CHEST } from './data/ex-chest.js';
import { BACK } from './data/ex-back.js';
import { SHOULDERS } from './data/ex-shoulders.js';
import { ARMS } from './data/ex-arms.js';
import { LEGS } from './data/ex-legs.js';
import { CORE } from './data/ex-core.js';

export const CATEGORIES = [
  ['chest', 'Brust'], ['back', 'Rücken'], ['shoulders', 'Schultern'],
  ['arms', 'Arme'], ['legs', 'Beine'], ['core', 'Rumpf'],
];
export const CATEGORY_NAME = Object.fromEntries(CATEGORIES);

// Muskel-Labels lokal (muscles.js importiert diese Datei – kein Ringschluss)
const MUSCLE_LABEL = {
  chest: 'Brust', back: 'Rücken', front_delt: 'vordere Schulter', side_delt: 'seitliche Schulter',
  rear_delt: 'hintere Schulter', biceps: 'Bizeps', triceps: 'Trizeps', quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger', glutes: 'Gesäß', calves: 'Waden', abs: 'Bauch',
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function muscleText(primary, secondary) {
  const p = (primary || []).map(k => MUSCLE_LABEL[k]).filter(Boolean);
  const s = (secondary || []).map(k => MUSCLE_LABEL[k]).filter(Boolean);
  return [...p, ...s].map((t, i) => (i === 0 ? cap(t) : t)).join(', ');
}

/** Basisübung + Variante zu einem vollständigen Eintrag verschmelzen */
function merge(base, v) {
  const e = {
    ...base, ...v,
    equip: { ...(base.equip || {}), ...(v.equip || {}) },
    primary: v.primary || base.primary,
    secondary: v.secondary || base.secondary,
    tips: v.tips || [...(base.tips || []), ...(v.tipsAdd || [])],
    fig: v.fig || base.fig,
    baseId: base.id,
  };
  delete e.variants; delete e.tipsAdd;
  return e;
}

function flatten(groups) {
  const out = [];
  for (const group of groups) {
    for (const m of group) {
      const base = { ...m, mechanic: m.mechanic || 'compound' };
      delete base.variants;
      out.push(base);
      for (const v of m.variants || []) out.push(merge(m, v));
    }
  }
  for (const e of out) {
    e.muscles = e.muscles || muscleText(e.primary, e.secondary);
    e.secondary = e.secondary || [];
    e.aliases = [...new Set([...(e.aliases || []), e.name.toLowerCase()].map(normalizeExerciseName))].filter(Boolean);
    // Figur: Name aus data/figures.js oder ein eingebettetes Objekt
    if (typeof e.fig === 'string') e.fig = FIGS[e.fig] || FIGS[e.fig.replace(/-/g, '_')] || null;
  }
  return out;
}

/** Alle Übungen in Datenreihenfolge (Basisübung, dann ihre Varianten) */
export const EXERCISES = flatten([CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE]);
// Für die Namenszuordnung: längere Aliase zuerst prüfen („schrägbankdrücken kurzhanteln“ vor „bankdrücken“)
const BY_ALIAS_LEN = [...EXERCISES].sort((a, b) => Math.max(...b.aliases.map(x => x.length)) - Math.max(...a.aliases.map(x => x.length)));

const byId = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export function normalizeExerciseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[,;:()/\-–_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Findet den passenden Bibliothekseintrag zu einem Übungsnamen (oder null). */
export function findExercise(name) {
  const n = normalizeExerciseName(name);
  if (!n) return null;
  for (const e of BY_ALIAS_LEN) if (e.aliases.some(a => a === n)) return e;
  // Teiltreffer nur, wenn sich Name und Alias weitgehend decken – sonst würde „Bauch“ zu „Beinbeuger, Bauchlage“
  for (const e of BY_ALIAS_LEN) {
    for (const a of e.aliases) {
      if (a.length < 5) continue;
      if (!(n.includes(a) || (a.includes(n) && n.length >= 5))) continue;
      if (Math.min(a.length, n.length) / Math.max(a.length, n.length) >= 0.72) return e;
    }
  }
  return null;
}

export function getExercise(id) { return byId[id] || null; }

/** Varianten derselben Bewegung (inkl. der Basisübung), ohne den Eintrag selbst */
export function variantsOf(entry) {
  if (!entry) return [];
  const root = entry.baseId || entry.id;
  return EXERCISES.filter(e => (e.baseId || e.id) === root && e.id !== entry.id);
}

const fold = (s) => normalizeExerciseName(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/**
 * Suche für die Übungsauswahl: Treffer nach Relevanz (Name-Anfang > Wortanfang > enthalten).
 * @param {string} q Suchtext
 * @param {{ muscle?: string, equip?: string, category?: string, limit?: number }} opts
 */
export function searchExercises(q, { muscle = null, equip = null, category = null, limit = 60 } = {}) {
  const n = fold(q || '');
  const scored = [];
  for (const e of EXERCISES) {
    if (muscle && !e.primary.includes(muscle) && !e.secondary.includes(muscle)) continue;
    if (equip && e.equip?.type !== equip) continue;
    if (category && e.category !== category) continue;
    let s = 0;
    if (!n) s = 1;
    else {
      for (const a of [fold(e.name), ...e.aliases.map(fold)]) {
        if (a === n) { s = Math.max(s, 100); break; }
        if (a.startsWith(n)) s = Math.max(s, 70);
        else if (a.includes(' ' + n)) s = Math.max(s, 55);
        else if (a.includes(n)) s = Math.max(s, 35);
      }
      if (!s && fold(e.muscles).includes(n)) s = 15;
    }
    if (s) scored.push({ e, s: s + (e.baseId ? 0 : 3) }); // Basisübung leicht bevorzugen
  }
  return scored.sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name)).slice(0, limit).map(x => x.e);
}

/**
 * Vorschläge zu einem freien Namen („Hantelbank“, „Brust Maschine“, „BD“) – auch wenn kein Alias passt.
 * Zerlegt den Namen in Wörter und deren Vor-/Nachsilben (ab 4 Zeichen) und sucht sie in Name, Aliassen,
 * Gerätename und Muskeltext. So findet „Hantelbank“ alles rund um Hantel und Bank.
 */
export function suggestExercises(name, limit = 8) {
  const n = fold(name);
  if (!n) return [];
  const words = n.split(' ').filter(w => w.length >= 3).map(w => w);
  const frags = new Set(words);
  for (const w of words) {
    if (w.length < 6) continue;
    for (let l = w.length - 1; l >= 4; l--) { frags.add(w.slice(0, l)); frags.add(w.slice(w.length - l)); }
  }
  // Mögliche Zerlegungen zusammengesetzter Wörter (beide Teile ab 4 Zeichen)
  const splits = [];
  for (const w of words) for (let i = 4; i <= w.length - 4; i++) splits.push([w.slice(0, i), w.slice(i)]);
  const scored = [];
  for (const e of EXERCISES) {
    // Treffer im Namen zählen doppelt, Treffer nur im Gerät oder Muskel einfach
    const hayName = fold([e.name, ...e.aliases].join(' '));
    const hayElse = fold([EQUIP_NAME[e.equip?.type] || '', e.muscles].join(' '));
    let best = 0;
    for (const f of frags) {
      if (hayName.includes(f)) best = Math.max(best, f.length * 2);
      else if (hayElse.includes(f)) best = Math.max(best, f.length);
    }
    // Zusammengesetzte Wörter: passen beide Hälften („Hantel“ + „bank“), zählt das deutlich mehr
    for (const [a, b] of splits) {
      const hitA = hayName.includes(a) ? a.length * 2 : hayElse.includes(a) ? a.length : 0;
      const hitB = hayName.includes(b) ? b.length * 2 : hayElse.includes(b) ? b.length : 0;
      if (hitA && hitB) best = Math.max(best, hitA + hitB);
    }
    if (best >= 3) scored.push({ e, s: best + (e.baseId ? 0 : 1) });
  }
  return scored.sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name)).slice(0, limit).map(x => x.e);
}

// Gerätenamen für die Vorschlagssuche (equipment.js importiert diese Datei nicht – kein Ringschluss)
const EQUIP_NAME = {
  cable_tower: 'Kabelzug Kabelturm', cable_crossover: 'Kabelzug Crossover', lat_pulldown: 'Latzug',
  chest_press: 'Brustpresse Maschine', row_machine: 'Rudermaschine', seated_row_cable: 'Rudern Kabel sitzend',
  pec_deck: 'Butterfly Pec Deck', incline_bench: 'Schrägbank Hantelbank', flat_bench: 'Flachbank Hantelbank Bank',
  hack_squat: 'Hackenschmidt', leg_press: 'Beinpresse', leg_extension: 'Beinstrecker', leg_curl_seated: 'Beinbeuger sitzend',
  leg_curl_lying: 'Beinbeuger liegend', calf_standing: 'Wadenmaschine stehend', calf_seated: 'Wadenmaschine sitzend',
  hip_thrust: 'Hip Thrust Maschine', dumbbells: 'Kurzhantel Hantel Hanteln', barbell: 'Langhantel Hantel Stange',
  mat: 'Matte Boden', squat_rack: 'Rack Kniebeugeständer Langhantel', smith_machine: 'Multipresse Smith',
  pullup_bar: 'Klimmzugstange Stange', dip_station: 'Dip Barren', preacher_bench: 'Scott Bank Hantelbank',
  abduction_machine: 'Abduktoren Adduktoren', back_extension: 'Rückenstrecker Hyperextension', t_bar_row: 'T-Bar Rudern',
  shoulder_press_machine: 'Schulterpresse Maschine', ez_bar: 'SZ Stange Hantel', kettlebell: 'Kettlebell',
  bodyweight: 'Körpergewicht ohne Gerät',
};

/**
 * Zuordnung eines importierten Namens zur Datenbank.
 * @returns {{ entry: object|null, confidence: 'exact'|'fuzzy'|null, suggestions: object[] }}
 */
export function matchExercise(name) {
  const n = normalizeExerciseName(name);
  if (!n) return { entry: null, confidence: null, suggestions: [] };
  for (const e of BY_ALIAS_LEN) if (e.aliases.some(a => a === n)) return { entry: e, confidence: 'exact', suggestions: [] };
  const fuzzy = findExercise(name);
  const suggestions = suggestExercises(name).filter(e => e !== fuzzy);
  if (fuzzy) return { entry: fuzzy, confidence: 'fuzzy', suggestions };
  return { entry: null, confidence: null, suggestions };
}

/** Übungen nach Kategorie gruppiert (für Bibliothek und Auswahl ohne Suchtext) */
export function exercisesByCategory() {
  return CATEGORIES.map(([key, label]) => [label, EXERCISES.filter(e => e.category === key)]);
}

/** SVG-String der Übungsfigur (animiert oder statisch) */
export function exerciseFigure(entryOrName, opts = {}) {
  const e = typeof entryOrName === 'string' ? findExercise(entryOrName) : entryOrName;
  if (!e || !e.fig) return '';
  return renderFigure(e.fig, opts);
}
