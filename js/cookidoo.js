// Cookidoo (Thermomix): Rezept über den Hantel-Server holen und in ein Hantel-Rezept umwandeln.
// Geholt werden nur die öffentlich ausgelieferten Rezeptdaten (Name, Zutaten, Portionen, Zeit,
// Nährwerte je Portion) – die kostenpflichtigen Zubereitungsschritte nicht; die App verlinkt aufs Original.
import { getSettings } from './store.js';
import { runTask } from './llm.js';

/** Cookidoo-Link aus einem geteilten Text herausziehen */
export function cookidooUrl(text) {
  const m = String(text || '').match(/https?:\/\/(?:www\.)?cookidoo\.[a-z.]{2,6}\/[^\s"'<>]+/i);
  return m ? m[0].replace(/[).,]+$/, '') : null;
}

/** Server-Zugang (der Worker holt die Seite – aus dem Browser blockiert CORS) */
function server() {
  const s = getSettings();
  const url = String(s.proxyUrl || '').trim().replace(/\/+$/, '');
  const token = String(s.proxyToken || '').trim();
  return url && token ? { url, token } : null;
}
export function cookidooReady() { return !!server(); }

/** Rohdaten zum Link holen */
export async function fetchCookidoo(link) {
  const c = server();
  if (!c) throw new Error('Dafür braucht es den Hantel-Server (Mehr → KI → Hantel-Server). Alternativ die Zutaten als Text einfügen.');
  const url = cookidooUrl(link) || String(link || '').trim();
  if (!/^https:\/\/(www\.)?cookidoo\./i.test(url)) throw new Error('Das ist kein Cookidoo-Link.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(`${c.url}/cookidoo?url=${encodeURIComponent(url)}`, { headers: { 'X-App-Token': c.token }, signal: ctl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Server antwortet mit ${res.status}`);
    return data.recipe;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Cookidoo antwortet gerade nicht – nochmal versuchen.');
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

/**
 * Zutatenzeilen („1 ½ TL Salz“, „1 Würfel Hefe“) von der KI in Gramm + Nährwerte übersetzen.
 * @returns {Promise<Array>} items für ein Rezept
 */
export async function ingredientsToItems(lines, { servings = 1, name = '' } = {}) {
  const list = [].concat(lines || []).map(s => String(s).trim()).filter(Boolean);
  if (!list.length) throw new Error('Keine Zutaten gefunden.');
  const text = [
    name ? `Rezept: ${name}` : null,
    `Zutatenliste für ${servings} Portion${servings === 1 ? '' : 'en'} (Thermomix-Rezept, Mengenangaben wie „1 TL“, „1 Prise“, „1 Würfel Hefe“ in Gramm umrechnen):`,
    ...list.map(l => '- ' + l),
  ].filter(Boolean).join('\n');
  const { data } = await runTask('food-text', { text });
  const items = (data.items || []).map(i => ({
    foodId: 'ai-' + Math.random().toString(36).slice(2, 9),
    name: i.name + (i.brand ? ` (${i.brand})` : ''),
    grams: i.grams,
    per100: { ...i.per100 },
    note: i.note || '',
  })).filter(i => i.grams > 0);
  if (!items.length) throw new Error('Die Zutaten konnten nicht in Mengen umgerechnet werden.');
  return items;
}

/** Rohdaten + Zutaten-Items → Rezeptentwurf zum Speichern */
export function toRecipeDraft(ck, items) {
  const y = parseYield(ck.yieldText);
  return {
    name: ck.name,
    servings: y.servings,
    items,
    note: '',
    source: 'cookidoo',
    sourceUrl: ck.url,
    sourceLabel: 'Cookidoo',
    yieldText: y.label,
    prepTimeMinutes: ck.totalMinutes || ck.prepMinutes || null,
    sourceNutrition: ck.perServing?.kcal ? { kcal: Math.round(ck.perServing.kcal), protein: r1(ck.perServing.protein), carbs: r1(ck.perServing.carbs), fat: r1(ck.perServing.fat) } : null,
    useSourceNutrition: !!ck.perServing?.kcal,
    variations: [],
  };
}

function r1(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
