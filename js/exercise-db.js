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
  for (const e of BY_ALIAS_LEN) if (e.aliases.some(a => a.length >= 5 && (n.includes(a) || (a.includes(n) && n.length >= 5)))) return e;
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
