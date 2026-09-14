// Ernährung: Makros rechnen, Ziele (TDEE), lokale Suche, adaptive Anpassung über den Gewichtstrend
import { getFoods, getRecipes, getDay, getDiary, getSettings, getBodyLog, updateSettings } from './store.js';
import { BASE_FOODS } from './food-db.js';

export const MEALS = [['breakfast', 'Frühstück'], ['lunch', 'Mittag'], ['dinner', 'Abend'], ['snack', 'Snacks']];
export const MEAL_NAME = Object.fromEntries(MEALS);
export const ACTIVITY = [[1.2, 'Sitzend, kaum Bewegung'], [1.375, 'Leicht aktiv (1–3× Sport)'], [1.55, 'Aktiv (3–5× Sport)'], [1.725, 'Sehr aktiv (6–7× Sport)'], [1.9, 'Körperliche Arbeit + Sport']];
export const GOALS = { gain: { label: 'Muskelaufbau', delta: 250, weekly: [0.15, 0.45] }, hold: { label: 'Halten', delta: 0, weekly: [-0.2, 0.2] }, cut: { label: 'Abnehmen', delta: -450, weekly: [-0.8, -0.3] } };

export function dateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function keyToTs(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }

const r1 = (v) => Math.round(v * 10) / 10;

/** Makros für eine Grammzahl aus Werten pro 100 g */
export function macros(per100, grams) {
  const f = (Number(grams) || 0) / 100;
  return { kcal: Math.round((per100.kcal || 0) * f), protein: r1((per100.protein || 0) * f), carbs: r1((per100.carbs || 0) * f), fat: r1((per100.fat || 0) * f) };
}

export function sumMacros(list) {
  return list.reduce((a, m) => ({ kcal: a.kcal + (m.kcal || 0), protein: r1(a.protein + (m.protein || 0)), carbs: r1(a.carbs + (m.carbs || 0)), fat: r1(a.fat + (m.fat || 0)) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

// ---------- Rezepte ----------

export function recipeTotals(recipe) {
  const grams = recipe.items.reduce((a, it) => a + (Number(it.grams) || 0), 0);
  const total = sumMacros(recipe.items.map(it => macros(it.per100, it.grams)));
  const servings = Math.max(1, Number(recipe.servings) || 1);
  const perServing = { kcal: Math.round(total.kcal / servings), protein: r1(total.protein / servings), carbs: r1(total.carbs / servings), fat: r1(total.fat / servings) };
  const per100 = grams ? { kcal: Math.round(total.kcal / grams * 100), protein: r1(total.protein / grams * 100), carbs: r1(total.carbs / grams * 100), fat: r1(total.fat / grams * 100) } : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return { grams, total, perServing, per100, servings, gramsPerServing: Math.round(grams / servings) };
}

// ---------- Suche (lokal) ----------

const fold = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** Alle bekannten Lebensmittel: eigene/gemerkte zuerst, dann Basis */
export function allFoods() {
  const own = getFoods();
  const ownIds = new Set(own.map(f => f.id));
  return own.concat(BASE_FOODS.filter(b => !ownIds.has(b.id)));
}

export function findFood(id) {
  return getFoods().find(f => f.id === id) || BASE_FOODS.find(f => f.id === id) || null;
}

/** Treffer: Lebensmittel und Rezepte, nach Relevanz (Anfang > Wortanfang > enthält; genutzte zuerst) */
export function searchLocal(q, { limit = 30 } = {}) {
  const n = fold(q.trim());
  const score = (name, brand) => {
    const s = fold(name), b = fold(brand);
    if (!n) return 1;
    if (s.startsWith(n)) return 100;
    if (s.split(/\s+/).some(w => w.startsWith(n))) return 80;
    if (s.includes(n)) return 60;
    if (b && b.includes(n)) return 40;
    return 0;
  };
  const foods = allFoods().map(f => { const s = score(f.name, f.brand); return { kind: 'food', item: f, s: s ? s + Math.min(20, (f.uses || 0) * 2) : 0 }; }).filter(x => x.s > 0);
  const recipes = getRecipes().map(r => { const s = score(r.name, ''); return { kind: 'recipe', item: r, s: s ? s + 10 : 0 }; }).filter(x => x.s > 0);
  return foods.concat(recipes).sort((a, b) => b.s - a.s).slice(0, limit);
}

/** Zuletzt verwendete Lebensmittel/Rezepte (aus dem Tagebuch, neueste zuerst, ohne Doppelte) */
export function recentItems(limit = 12) {
  const diary = getDiary();
  const keys = Object.keys(diary).sort().reverse().slice(0, 30);
  const seen = new Set(); const out = [];
  for (const k of keys) {
    for (const e of [...diary[k]].reverse()) {
      const id = `${e.kind}:${e.refId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const item = e.kind === 'recipe' ? getRecipes().find(r => r.id === e.refId) : findFood(e.refId);
      if (item) out.push({ kind: e.kind, item, lastGrams: e.grams, lastServings: e.servings });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function favoriteItems() {
  return getFoods().filter(f => f.favorite).map(f => ({ kind: 'food', item: f }));
}

// ---------- Tagebuch ----------

export function dayTotals(key) {
  return sumMacros(getDay(key));
}

export function mealTotals(key, meal) {
  return sumMacros(getDay(key).filter(e => e.meal === meal));
}

/** Eintrag für ein Lebensmittel bauen (Nährwerte eingefroren) */
export function foodEntry(food, grams, meal) {
  const m = macros(food.per100, grams);
  return { meal, kind: 'food', refId: food.id, name: food.name + (food.brand ? ` (${food.brand})` : ''), grams: Number(grams), ...m };
}

export function recipeEntry(recipe, servings, meal) {
  const t = recipeTotals(recipe);
  const f = Number(servings) || 1;
  return { meal, kind: 'recipe', refId: recipe.id, name: recipe.name, servings: f, grams: Math.round(t.gramsPerServing * f), kcal: Math.round(t.perServing.kcal * f), protein: r1(t.perServing.protein * f), carbs: r1(t.perServing.carbs * f), fat: r1(t.perServing.fat * f) };
}

// ---------- Ziele ----------

export function currentWeight() {
  const log = getBodyLog();
  for (let i = log.length - 1; i >= 0; i--) if (log[i].weight != null) return Number(log[i].weight);
  return null;
}

/** Grundumsatz (Mifflin-St Jeor) × Aktivität */
export function tdee() {
  const s = getSettings();
  const kg = currentWeight();
  if (!kg || !s.nHeight || !s.nAge) return null;
  const bmr = 10 * kg + 6.25 * s.nHeight - 5 * s.nAge + (s.sex === 'f' ? -161 : 5);
  return Math.round(bmr * (s.nActivity || 1.55));
}

/** @returns {{ ready:boolean, kcal:number, protein:number, carbs:number, fat:number, tdee:number|null, base:number }} */
export function targets() {
  const s = getSettings();
  const kg = currentWeight();
  const t = tdee();
  const goal = GOALS[s.nGoal] || GOALS.gain;
  const base = s.nKcalOverride > 0 ? s.nKcalOverride : (t ? t + goal.delta : 0);
  const kcal = Math.max(0, Math.round(base + (s.nAdjust || 0)));
  const protein = kg ? Math.round(kg * (s.nProteinPerKg || 1.8)) : 0;
  const fat = kcal ? Math.round(kcal * 0.27 / 9) : 0;
  const carbs = kcal ? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)) : 0;
  return { ready: kcal > 0 && protein > 0, kcal, protein, carbs, fat, tdee: t, base, adjust: s.nAdjust || 0 };
}

// ---------- Adaptive Anpassung ----------

/** Lineare Regression über Gewichtseinträge der letzten `days` Tage → kg pro Woche */
export function weightTrend(days = 21) {
  const since = Date.now() - days * 86400000;
  const pts = getBodyLog().filter(e => e.weight != null && e.date >= since).map(e => [e.date / 86400000, Number(e.weight)]);
  if (pts.length < 3) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx;
  const span = pts[pts.length - 1][0] - pts[0][0];
  return { perWeek: r1(slope * 7), points: n, spanDays: Math.round(span) };
}

/** Durchschnitt der protokollierten Tage (nur Tage mit ≥ 800 kcal zählen als „vollständig“) */
export function intakeAverage(days = 14) {
  const out = [];
  for (let i = 1; i <= days; i++) {
    const k = dateKey(Date.now() - i * 86400000);
    const t = dayTotals(k);
    if (t.kcal >= 800) out.push(t);
  }
  if (!out.length) return null;
  const s = sumMacros(out);
  return { days: out.length, kcal: Math.round(s.kcal / out.length), protein: Math.round(s.protein / out.length) };
}

/**
 * Empfehlung: Zielkalorien anpassen, wenn der Gewichtstrend außerhalb des Zielbereichs liegt.
 * Braucht ≥ 8 vollständige Tage und ≥ 3 Wiegungen über ≥ 10 Tage; frühestens 7 Tage nach der letzten Anpassung.
 */
export function adaptiveSuggestion() {
  const s = getSettings();
  const intake = intakeAverage(14);
  const trend = weightTrend(21);
  const goal = GOALS[s.nGoal] || GOALS.gain;
  const res = { ready: false, intake, trend, goal, delta: 0, message: '' };
  if (!s.nAdaptive) { res.message = 'Automatische Anpassung ist aus.'; return res; }
  if (!intake || intake.days < 8) { res.message = `Erst ${intake?.days || 0} von 8 vollständigen Tagen protokolliert.`; return res; }
  if (!trend || trend.spanDays < 10) { res.message = 'Zu wenig Wiegungen – mindestens drei über zehn Tage.'; return res; }
  res.ready = true;
  const [lo, hi] = goal.weekly;
  if (Date.now() - (s.nLastAdjust || 0) < 7 * 86400000) { res.message = 'Zuletzt vor weniger als einer Woche angepasst – erst mal so weiter.'; return res; }
  if (trend.perWeek < lo) { res.delta = 100; res.message = `Gewicht ${trend.perWeek >= 0 ? '+' : ''}${String(trend.perWeek).replace('.', ',')} kg/Woche – zu wenig für ${goal.label}. Ziel +100 kcal.`; }
  else if (trend.perWeek > hi) { res.delta = -100; res.message = `Gewicht +${String(trend.perWeek).replace('.', ',')} kg/Woche – schneller als geplant. Ziel −100 kcal.`; }
  else res.message = `Gewicht ${trend.perWeek >= 0 ? '+' : ''}${String(trend.perWeek).replace('.', ',')} kg/Woche – genau im Zielbereich.`;
  return res;
}

export function applyAdjustment(delta) {
  const s = getSettings();
  updateSettings({ nAdjust: (s.nAdjust || 0) + delta, nLastAdjust: Date.now() });
}

export function fmtKcal(v) { return new Intl.NumberFormat('de-DE').format(Math.round(v || 0)); }
export function fmtG(v) { const n = Math.round((v || 0) * 10) / 10; return (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')); }
