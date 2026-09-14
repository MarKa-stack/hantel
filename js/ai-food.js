// KI-Freitext: „500 g Hähnchenbrust, 200 g Philadelphia, 1 Apfel“ → Zutaten mit Gramm und Nährwerten pro 100 g.
// Nutzt den KI-Zugang aus den Einstellungen (Claude oder OpenAI); Antwort als JSON-Schema.
import { structured } from './llm.js';

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
 * @returns {Promise<{items:Array, servings:number|null, title:string|null}>}
 */
export async function aiParseFood(text) {
  const { data, usage } = await structured({ system: SYSTEM, text: text.trim(), schema: SCHEMA, schemaName: 'lebensmittel', maxTokens: 4000 });
  const items = (data.items || []).map(i => ({
    name: String(i.name || '').trim(), brand: String(i.brand || '').trim(), unit: i.unit === 'ml' ? 'ml' : 'g',
    grams: Math.max(0, Math.round(Number(i.grams) || 0)), note: String(i.note || ''),
    per100: { kcal: Math.max(0, Math.round(Number(i.kcal100) || 0)), protein: Math.max(0, Math.round((Number(i.protein100) || 0) * 10) / 10), carbs: Math.max(0, Math.round((Number(i.carbs100) || 0) * 10) / 10), fat: Math.max(0, Math.round((Number(i.fat100) || 0) * 10) / 10) },
  })).filter(i => i.name && i.grams > 0);
  return { items, servings: data.servings ? Math.max(1, parseInt(data.servings, 10)) : null, title: data.title ? String(data.title).trim() : null, usage };
}
