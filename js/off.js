// Open Food Facts: Produktsuche und EAN-Abfrage. Läuft bevorzugt über den Hantel-Server (Cache, Retry, kein CORS),
// sonst direkt (offene API; Antworten ohne CORS-Header bei Last/Limit → Retry mit Wartezeit).
import { aiConfig } from './llm.js';

const FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_quantity,serving_size,quantity';

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function normalize(p) {
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n.energy_100g) != null) kcal = Math.round(num(n.energy_100g) / 4.184);
  const protein = num(n.proteins_100g), carbs = num(n.carbohydrates_100g), fat = num(n.fat_100g);
  if (kcal == null || protein == null) return null;
  const name = (p.product_name_de || p.product_name || '').trim();
  if (!name) return null;
  const isLiquid = /ml|l\b/i.test(p.quantity || '') && !/g\b/i.test(p.quantity || '');
  const portions = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0 && sq < 2000) portions.push({ label: `1 Portion (${p.serving_size || sq + (isLiquid ? ' ml' : ' g')})`, grams: Math.round(sq) });
  const qty = String(p.quantity || '').match(/(\d+(?:[.,]\d+)?)\s*(g|ml)/i);
  if (qty) { const g = Math.round(parseFloat(qty[1].replace(',', '.'))); if (g > 0 && g <= 3000 && !portions.some(x => x.grams === g)) portions.push({ label: `Ganze Packung (${g} ${qty[2].toLowerCase()})`, grams: g }); }
  return {
    id: 'off-' + p.code, name, brand: String(p.brands || '').split(',')[0].trim(), source: 'off', barcode: p.code,
    per100: { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10, carbs: Math.round((carbs ?? 0) * 10) / 10, fat: Math.round((fat ?? 0) * 10) / 10 },
    unit: isLiquid ? 'ml' : 'g', portions,
  };
}

/** Über den Hantel-Server, wenn eingerichtet – der hält Cache und Wiederholungen */
function viaProxy() {
  const c = aiConfig();
  return c.provider === 'proxy' && c.url && c.token ? c : null;
}

async function proxyGet(path) {
  const c = viaProxy();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(`${c.url}/off/${path}`, { headers: { 'X-App-Token': c.token }, signal: ctl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Server antwortet mit ${res.status}`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Open Food Facts antwortet gerade nicht – nochmal versuchen.');
    if (e instanceof TypeError) throw new Error('Hantel-Server nicht erreichbar – Netz prüfen.');
    throw e;
  } finally { clearTimeout(t); }
}

/** Direkt: Timeout 12 s, bis zu drei Versuche (Limit-Antworten kommen ohne CORS-Header → „Failed to fetch“) */
async function directGet(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) return res.json();
      if (res.status === 429) throw new Error('Anfrage-Limit von Open Food Facts erreicht – eine Minute warten.');
      if (res.status >= 500 && i < tries - 1) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue; }
      throw new Error(`Open Food Facts antwortet mit ${res.status}`);
    } catch (e) {
      clearTimeout(t);
      if (/Limit|antwortet mit/.test(e.message)) throw e;
      if (i < tries - 1) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue; }
      throw new Error('Open Food Facts antwortet gerade nicht – nochmal versuchen.');
    }
  }
  throw new Error('Open Food Facts antwortet gerade nicht.');
}

/** Textsuche: Produkte, die in Deutschland verkauft werden; Duplikate (Name + Marke + kcal) nur einmal */
export async function offSearch(q, { limit = 30 } = {}) {
  let data;
  if (viaProxy()) data = await proxyGet(`search?q=${encodeURIComponent(q)}`);
  else {
    const base = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}&lc=de`;
    data = await directGet(base + '&tagtype_0=countries&tag_contains_0=contains&tag_0=germany');
    if (!(data.products || []).length) data = await directGet(base);
  }
  const seen = new Set();
  return (data.products || []).map(normalize).filter(Boolean).filter(f => {
    const k = `${f.name.toLowerCase()}|${f.brand.toLowerCase()}|${f.per100.kcal}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** EAN/Barcode (8–14 Ziffern) */
export async function offByBarcode(code) {
  const c = String(code).replace(/\D/g, '');
  const data = viaProxy() ? await proxyGet(`product/${c}`) : await directGet(`https://world.openfoodfacts.org/api/v2/product/${c}?fields=${FIELDS}`);
  if (data.status !== 1 || !data.product) return null;
  return normalize(data.product);
}

export function looksLikeBarcode(q) { return /^\d{8,14}$/.test(String(q).trim()); }
