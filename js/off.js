// Open Food Facts: Produktsuche und EAN-Abfrage (offene Datenbank, CORS-frei). Ergebnisse werden zu
// Lebensmittel-Objekten normalisiert; nur Einträge mit vollständigen Nährwerten pro 100 g.
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

async function get(url, retry = true) {
  let res;
  try { res = await fetch(url, { headers: { Accept: 'application/json' } }); }
  catch (e) {
    // Limit-Antworten (429) kommen ohne CORS-Header an → „Failed to fetch“; einmal kurz warten und nochmal
    if (retry) { await new Promise(r => setTimeout(r, 1500)); return get(url, false); }
    throw new Error('Open Food Facts gerade nicht erreichbar – Netz oder Anfrage-Limit, kurz warten.');
  }
  if (res.status === 429) throw new Error('Anfrage-Limit von Open Food Facts erreicht – eine Minute warten.');
  if (!res.ok) throw new Error(`Open Food Facts antwortet mit ${res.status}`);
  return res.json();
}

/** Textsuche: Produkte, die in Deutschland verkauft werden (de.-Subdomain hat kein CORS, daher world + Filter) */
export async function offSearch(q, { limit = 30 } = {}) {
  const base = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}&lc=de`;
  let data = await get(base + '&tagtype_0=countries&tag_contains_0=contains&tag_0=germany');
  if (!(data.products || []).length) data = await get(base); // Fallback weltweit
  // Doppelte (gleicher Name + Marke + kcal) nur einmal zeigen
  const seen = new Set();
  return (data.products || []).map(normalize).filter(Boolean).filter(f => {
    const k = `${f.name.toLowerCase()}|${f.brand.toLowerCase()}|${f.per100.kcal}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** EAN/Barcode (8–13 Ziffern) */
export async function offByBarcode(code) {
  const c = String(code).replace(/\D/g, '');
  const data = await get(`https://world.openfoodfacts.org/api/v2/product/${c}?fields=${FIELDS}`);
  if (data.status !== 1 || !data.product) return null;
  return normalize(data.product);
}

export function looksLikeBarcode(q) { return /^\d{8,14}$/.test(String(q).trim()); }
