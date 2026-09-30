// Rezepte aus anderen Apps übernehmen: Cookidoo (Thermomix) und Fddb per Link, oder beliebiger Text.
// Geholt werden nur die öffentlich strukturiert ausgelieferten Daten (Name, Zutaten, Portionen, Zeit,
// Nährwerte) – kostenpflichtige Zubereitungsschritte nicht; das Rezept verlinkt aufs Original.
import { getSettings } from './store.js';
import { runTask } from './llm.js';

const HOSTS = /https?:\/\/(?:www\.)?(?:cookidoo\.[a-z.]{2,6}|fddb\.info)\/[^\s"'<>]+/gi;

/** Alle unterstützten Rezept-Links aus einem Text (Zwischenablage, geteilte Nachricht) */
export function recipeLinks(text) {
  const out = [];
  for (const m of String(text || '').matchAll(HOSTS)) {
    const url = m[0].replace(/[).,;]+$/, '');
    if (!out.includes(url)) out.push(url);
  }
  return out;
}
/** Erster Link (Kompatibilität: früher cookidooUrl) */
export function recipeUrl(text) { return recipeLinks(text)[0] || null; }

/** Server-Zugang (der Worker holt die Seite – aus dem Browser blockiert CORS) */
function server() {
  const s = getSettings();
  const url = String(s.proxyUrl || '').trim().replace(/\/+$/, '');
  const token = String(s.proxyToken || '').trim();
  return url && token ? { url, token } : null;
}
export function importerReady() { return !!server(); }

/** Rohdaten zu einem Link holen (Cookidoo oder Fddb) */
export async function fetchRecipe(link) {
  const c = server();
  if (!c) throw new Error('Dafür braucht es den Hantel-Server (Mehr → KI → Hantel-Server). Alternativ die Zutaten als Text einfügen.');
  const url = recipeUrl(link) || String(link || '').trim();
  if (!/^https:\/\/(www\.)?(cookidoo\.|fddb\.info)/i.test(url)) throw new Error('Das ist kein Cookidoo- oder Fddb-Link.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(`${c.url}/recipe?url=${encodeURIComponent(url)}`, { headers: { 'X-App-Token': c.token }, signal: ctl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Server antwortet mit ${res.status}`);
    return data.recipe;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Die Seite antwortet gerade nicht – nochmal versuchen.');
    if (e instanceof TypeError) throw new Error('Hantel-Server nicht erreichbar – Netz prüfen.');
    throw e;
  } finally { clearTimeout(timer); }
}

/** „12 Stück“, „4 Portionen“, „6 potongan“ → { servings, label } */
export function parseYield(text) {
  const t = String(text || '').trim();
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  const n = m ? Math.round(parseFloat(m[1].replace(',', '.'))) : 0;
  return { servings: n > 0 && n <= 60 ? n : 1, label: t };
}

/** Zutatenzeilen eines Rezepts von der KI in Gramm + Nährwerte übersetzen */
export async function ingredientsToItems(lines, { servings = 1, name = '' } = {}) {
  const list = [].concat(lines || []).map(s => String(s).trim()).filter(Boolean);
  if (!list.length) throw new Error('Keine Zutaten gefunden.');
  const text = [
    name ? `Rezept: ${name}` : null,
    `Zutatenliste für ${servings} Portion${servings === 1 ? '' : 'en'} (Mengenangaben wie „1 TL“, „1 Prise“, „1 Würfel Hefe“ in Gramm umrechnen):`,
    ...list.map(l => '- ' + l),
  ].filter(Boolean).join('\n');
  const { data } = await runTask('food-text', { text });
  const items = itemsFrom(data.items);
  if (!items.length) throw new Error('Die Zutaten konnten nicht in Mengen umgerechnet werden.');
  return items;
}

function itemsFrom(list) {
  return (list || []).map(i => ({
    foodId: 'ai-' + Math.random().toString(36).slice(2, 9),
    name: i.name + (i.brand ? ` (${i.brand})` : ''),
    grams: i.grams,
    per100: { ...i.per100 },
    note: i.note || '',
  })).filter(i => i.grams > 0);
}

/**
 * Mehrere Rezepte in einem Rutsch: entweder geholte Rezepte (mit Zutatenzeilen) oder freier Text.
 * Ein KI-Aufruf für alle – schont das Anfrage-Limit beim Übertragen ganzer Sammlungen.
 * @param {Array<{name, ingredients, yieldText}>|null} recipes
 * @param {string} rawText
 * @returns {Promise<Array>} [{ name, servings, note, items }]
 */
export async function parseRecipesBatch({ recipes = null, rawText = '' } = {}) {
  let text;
  if (recipes?.length) {
    text = recipes.map((r, i) => {
      const y = parseYield(r.yieldText);
      return [`### Rezept ${i + 1}: ${r.name}`, `Portionen: ${y.label || y.servings}`, 'Zutaten:', ...r.ingredients.map(l => '- ' + l)].join('\n');
    }).join('\n\n');
  } else {
    text = String(rawText || '').trim();
  }
  if (text.length < 10) throw new Error('Kein Rezepttext gefunden.');
  const { data } = await runTask('recipes-import', { text });
  return (data.recipes || []).map(r => ({
    name: r.name, servings: r.servings, note: r.note,
    items: itemsFrom(r.items.map(i => ({ ...i, brand: '' }))),
  })).filter(r => r.items.length);
}

/** Rohdaten (Link-Import) + Zutaten-Items → Rezeptentwurf zum Speichern */
export function toRecipeDraft(ck, items, extra = {}) {
  const y = parseYield(ck.yieldText);
  return {
    name: ck.name,
    servings: y.servings,
    items,
    note: ck.note || '',
    source: ck.source || 'cookidoo',
    sourceUrl: ck.url || null,
    sourceLabel: ck.sourceLabel || 'Cookidoo',
    yieldText: y.label,
    prepTimeMinutes: ck.totalMinutes || ck.prepMinutes || null,
    sourceNutrition: ck.perServing?.kcal ? {
      kcal: Math.round(ck.perServing.kcal), protein: r1(ck.perServing.protein), carbs: r1(ck.perServing.carbs), fat: r1(ck.perServing.fat),
    } : null,
    // Offizielle Werte nur nutzen, wenn alle Makros dabei sind
    useSourceNutrition: !!(ck.perServing?.kcal && ck.perServing.protein != null && ck.perServing.carbs != null && ck.perServing.fat != null),
    variations: [],
    ...extra,
  };
}

function r1(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
