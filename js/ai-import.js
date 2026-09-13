// KI-Import: Das PDF wird direkt an die Claude-API geschickt, die die Übungen
// als strukturiertes JSON zurückgibt. Funktioniert auch mit gescannten PDFs.

const API_URL = 'https://api.anthropic.com/v1/messages';

const SCHEMA = {
  type: 'object',
  properties: {
    plans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name des Trainingstags/Plans, z.B. "Tag A – Push"' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sets: { type: 'integer', description: 'Anzahl Sätze' },
                reps: { type: 'string', description: 'Wiederholungen, z.B. "10", "8-12", "AMRAP"' },
                weight: { type: ['number', 'null'], description: 'Gewicht in kg, falls angegeben' },
                restSec: { type: ['integer', 'null'], description: 'Pause in Sekunden, falls angegeben' },
                note: { type: 'string', description: 'Tempo, RPE, Hinweise – sonst leerer String' },
              },
              required: ['name', 'sets', 'reps', 'weight', 'restSec', 'note'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'exercises'],
        additionalProperties: false,
      },
    },
  },
  required: ['plans'],
  additionalProperties: false,
};

const SYSTEM = `Du extrahierst Trainingspläne aus PDF-Dokumenten für eine Fitness-App.
Regeln:
- Jeder Trainingstag / jede Einheit (z.B. "Tag 1", "Push", "Workout A") wird ein eigener Plan. Gibt es keine Aufteilung, gib genau einen Plan zurück; nutze dann den Dokumenttitel als Namen.
- Übungen in der Reihenfolge des Dokuments. Übungsnamen sauber ausschreiben (keine Nummerierung, keine Abkürzungen wie "BD" – schreibe "Bankdrücken").
- "3x10" bedeutet 3 Sätze à 10 Wiederholungen. Bereiche wie "8-12" als String übernehmen. Zeitangaben wie "30 s" (z.B. Planks) als reps-String "30s".
- Aufwärmsätze nicht als eigene Übung, nur wenn sie explizit als Übung gelistet sind.
- Gewicht nur setzen, wenn ein konkretes Gewicht im Dokument steht. Prozentangaben (% 1RM) in note schreiben.
- Pause in Sekunden (2 min = 120). Wenn eine globale Pausenangabe existiert, gilt sie für alle Übungen.
- Supersätze: als zwei Übungen mit note "Supersatz mit <andere Übung>".
- Keine Erfindungen: unbekannte Werte auf null bzw. reps als "10" wenn völlig unklar.`;

function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/**
 * @param {File} file PDF
 * @param {{apiKey:string, model:string}} opts
 * @returns {Promise<{plans:Array, usage:object}>}
 */
export async function aiExtractPlans(file, { apiKey, model = 'claude-opus-5' }) {
  if (!apiKey) throw new Error('Kein API-Key hinterlegt. Trag ihn unter „Mehr → KI-Import“ ein.');
  if (file.size > 30 * 1024 * 1024) throw new Error('PDF ist größer als 30 MB.');

  const data = toBase64(await file.arrayBuffer());

  const body = {
    model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
        { type: 'text', text: `Extrahiere alle Trainingspläne und Übungen aus diesem Dokument (Dateiname: ${file.name}).` },
      ],
    }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `API-Fehler ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error?.message) msg += `: ${err.error.message}`;
    } catch { /* keine Details */ }
    if (res.status === 401) msg = 'API-Key ungültig (401). Bitte unter „Mehr“ prüfen.';
    if (res.status === 429) msg = 'Rate-Limit erreicht (429). Kurz warten und erneut versuchen.';
    if (res.status === 529) msg = 'Claude ist gerade überlastet (529). Gleich nochmal probieren.';
    throw new Error(msg);
  }

  const msg = await res.json();
  if (msg.stop_reason === 'refusal') {
    throw new Error('Claude hat die Anfrage abgelehnt' + (msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : '.'));
  }
  const text = (msg.content || []).find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Leere Antwort von der API.');
  const parsed = JSON.parse(text);
  const plans = (parsed.plans || []).map(p => ({
    name: String(p.name || '').trim() || 'Importierter Plan',
    exercises: (p.exercises || []).map(e => ({
      name: String(e.name || '').trim(),
      sets: Math.max(1, parseInt(e.sets, 10) || 3),
      reps: String(e.reps || '10'),
      weight: e.weight == null ? null : Number(e.weight),
      restSec: e.restSec == null ? null : parseInt(e.restSec, 10),
      note: String(e.note || ''),
    })).filter(e => e.name),
  })).filter(p => p.exercises.length);

  return { plans, usage: msg.usage };
}

/** Kurzer Verbindungstest mit minimaler Anfrage */
export async function testApiKey(apiKey, model = 'claude-opus-5') {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Antworte nur mit OK.' }] }),
  });
  if (res.ok) return true;
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch { /* egal */ }
  throw new Error(`${res.status}${detail ? ': ' + detail : ''}`);
}
