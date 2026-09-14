// KI-Freitext: „500 g Hähnchenbrust, 200 g Philadelphia, 1 Apfel“ → Zutaten mit Gramm und Nährwerten pro 100 g.
// Nutzt denselben Claude-API-Key wie der PDF-Import; Antwort als JSON-Schema.
const API_URL = 'https://api.anthropic.com/v1/messages';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Lebensmittel, deutsch, ohne Menge, z.B. "Hähnchenbrust" oder "Frischkäse Philadelphia"' },
          brand: { type: 'string', description: 'Marke, falls genannt, sonst leerer String' },
          grams: { type: 'number', description: 'Menge in Gramm bzw. Milliliter für die genannte Portion (Stückangaben in typisches Gewicht umrechnen)' },
          unit: { type: 'string', enum: ['g', 'ml'] },
          kcal100: { type: 'number', description: 'Kilokalorien pro 100 g/ml' },
          protein100: { type: 'number', description: 'Protein in g pro 100 g/ml' },
          carbs100: { type: 'number', description: 'Kohlenhydrate in g pro 100 g/ml' },
          fat100: { type: 'number', description: 'Fett in g pro 100 g/ml' },
          note: { type: 'string', description: 'Annahme, z.B. "roh", "1 Ei = 58 g", sonst leer' },
        },
        required: ['name', 'brand', 'grams', 'unit', 'kcal100', 'protein100', 'carbs100', 'fat100', 'note'],
        additionalProperties: false,
      },
    },
    servings: { type: ['integer', 'null'], description: 'Anzahl Portionen, falls der Text sie nennt (z.B. "4 Portionen"), sonst null' },
    title: { type: ['string', 'null'], description: 'Gerichtname, falls erkennbar (z.B. "Hähnchen-Frischkäse-Pfanne"), sonst null' },
  },
  required: ['items', 'servings', 'title'],
  additionalProperties: false,
};

const SYSTEM = `Du bist ein Ernährungsassistent für eine deutsche Fitness-App. Der Nutzer beschreibt Lebensmittel oder ein Gericht in Freitext.
Regeln:
- Jede Zutat/jedes Lebensmittel als eigener Eintrag mit realistischer Menge in Gramm (bzw. ml bei Flüssigkeiten).
- Stückangaben in typische Gewichte umrechnen: 1 Ei 58 g, 1 Banane 120 g, 1 Apfel 150 g, 1 EL Öl 10 g, 1 TL 5 g, 1 Scheibe Brot 45 g, 1 Scheibe Käse 25 g, 1 Paprika 150 g, 1 Zwiebel 80 g, 1 Scoop Whey 30 g.
- Nährwerte pro 100 g aus gängigen deutschen Nährwerttabellen; Rohgewicht, wenn nichts anderes gesagt wird (Reis roh ≈ 350 kcal, gekocht ≈ 130 kcal).
- Bei Markenprodukten (z.B. Philadelphia, Skyr von Arla, ja! Hähnchenbrust) die typischen Packungswerte.
- Keine Erfindungen: unklare Mengen konservativ schätzen und in note vermerken.
- Wenn der Text Portionen nennt ("für 4 Personen", "4 Portionen"), servings setzen; wenn ein Gerichtname erkennbar ist, title setzen.`;

/**
 * @param {string} text Freitext
 * @param {{apiKey:string, model:string}} opts
 * @returns {Promise<{items:Array, servings:number|null, title:string|null}>}
 */
export async function aiParseFood(text, { apiKey, model = 'claude-sonnet-5' }) {
  if (!apiKey) throw new Error('Kein API-Key hinterlegt. Trag ihn unter „Mehr → KI-Import“ ein.');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model, max_tokens: 4000, system: SYSTEM,
      messages: [{ role: 'user', content: text.trim() }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    }),
  });
  if (!res.ok) {
    let msg = `API-Fehler ${res.status}`;
    try { const err = await res.json(); if (err?.error?.message) msg += `: ${err.error.message}`; } catch { /* keine Details */ }
    if (res.status === 401) msg = 'API-Key ungültig (401). Bitte unter „Mehr“ prüfen.';
    if (res.status === 429) msg = 'Rate-Limit erreicht (429). Kurz warten und erneut versuchen.';
    if (res.status === 529) msg = 'Claude ist gerade überlastet (529). Gleich nochmal probieren.';
    throw new Error(msg);
  }
  const msg = await res.json();
  if (msg.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt.');
  const out = (msg.content || []).find(b => b.type === 'text')?.text;
  if (!out) throw new Error('Leere Antwort von der API.');
  const parsed = JSON.parse(out);
  const items = (parsed.items || []).map(i => ({
    name: String(i.name || '').trim(), brand: String(i.brand || '').trim(), unit: i.unit === 'ml' ? 'ml' : 'g',
    grams: Math.max(0, Math.round(Number(i.grams) || 0)), note: String(i.note || ''),
    per100: { kcal: Math.max(0, Math.round(Number(i.kcal100) || 0)), protein: Math.max(0, Math.round((Number(i.protein100) || 0) * 10) / 10), carbs: Math.max(0, Math.round((Number(i.carbs100) || 0) * 10) / 10), fat: Math.max(0, Math.round((Number(i.fat100) || 0) * 10) / 10) },
  })).filter(i => i.name && i.grams > 0);
  return { items, servings: parsed.servings ? Math.max(1, parseInt(parsed.servings, 10)) : null, title: parsed.title ? String(parsed.title).trim() : null, usage: msg.usage };
}
