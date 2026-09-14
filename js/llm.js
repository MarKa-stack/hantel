// Gemeinsamer KI-Zugang: Claude (Anthropic) oder OpenAI, beide direkt aus dem Browser mit eigenem Key.
// Liefert strukturierte JSON-Antworten nach Schema – für PDF-Import und Essen-Freitext.
import { getSettings } from './store.js';

export const PROVIDERS = {
  claude: {
    label: 'Claude (Anthropic)',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://platform.claude.com/',
    models: [
      ['claude-opus-5', 'Claude Opus 5 – beste Erkennung'],
      ['claude-sonnet-5', 'Claude Sonnet 5 – günstiger'],
      ['claude-haiku-4-5', 'Claude Haiku 4.5 – am günstigsten'],
    ],
    defaultModel: 'claude-sonnet-5',
  },
  openai: {
    label: 'OpenAI (ChatGPT)',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      ['gpt-5', 'GPT-5 – beste Erkennung'],
      ['gpt-5-mini', 'GPT-5 mini – günstiger'],
      ['gpt-4.1', 'GPT-4.1'],
      ['gpt-4.1-mini', 'GPT-4.1 mini – am günstigsten'],
    ],
    defaultModel: 'gpt-5-mini',
  },
};

/** Aktive Konfiguration: { provider, key, model } */
export function aiConfig() {
  const s = getSettings();
  const provider = s.aiProvider === 'openai' ? 'openai' : 'claude';
  const p = PROVIDERS[provider];
  const key = (provider === 'openai' ? s.openaiKey : s.apiKey) || '';
  const model = (provider === 'openai' ? s.openaiModel : s.aiModel) || p.defaultModel;
  return { provider, key: key.trim(), model, label: p.label };
}

export function aiReady() { return !!aiConfig().key; }

function friendlyError(status, detail, provider) {
  if (status === 401) return `API-Key ungültig (401) – bitte unter „Mehr → KI“ prüfen (${PROVIDERS[provider].label}).`;
  if (status === 429) return 'Rate-Limit oder Guthaben erschöpft (429). Kurz warten bzw. Konto prüfen.';
  if (status === 529 || status === 503) return 'Der Dienst ist gerade überlastet. Gleich nochmal probieren.';
  return `API-Fehler ${status}${detail ? ': ' + detail : ''}`;
}

/**
 * Strukturierte Antwort nach JSON-Schema.
 * @param {{ system:string, text:string, pdf?:{name:string, base64:string}, schema:object, schemaName?:string, maxTokens?:number, config?:object }} req
 * @returns {Promise<{ data:object, usage:object }>}
 */
export async function structured({ system, text, pdf = null, schema, schemaName = 'result', maxTokens = 8000, config = aiConfig() }) {
  if (!config.key) throw new Error('Kein API-Key hinterlegt. Trag ihn unter „Mehr → KI“ ein.');
  return config.provider === 'openai'
    ? openaiStructured({ system, text, pdf, schema, schemaName, maxTokens, config })
    : claudeStructured({ system, text, pdf, schema, maxTokens, config });
}

// ---------- Claude ----------

async function claudeStructured({ system, text, pdf, schema, maxTokens, config }) {
  const content = [];
  if (pdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.base64 } });
  content.push({ type: 'text', text });
  const res = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: config.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema } } }),
  }, 'claude');
  if (!res.ok) {
    let detail = ''; try { detail = (await res.json())?.error?.message || ''; } catch { /* keine Details */ }
    throw new Error(friendlyError(res.status, detail, 'claude'));
  }
  const msg = await res.json();
  if (msg.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt' + (msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : '.'));
  const out = (msg.content || []).find(b => b.type === 'text')?.text;
  if (!out) throw new Error('Leere Antwort von der API.');
  return { data: JSON.parse(out), usage: msg.usage };
}

// ---------- OpenAI ----------

async function openaiStructured({ system, text, pdf, schema, schemaName, maxTokens, config }) {
  const content = [];
  if (pdf) content.push({ type: 'file', file: { filename: pdf.name || 'dokument.pdf', file_data: 'data:application/pdf;base64,' + pdf.base64 } });
  content.push({ type: 'text', text });
  const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model,
      max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
      response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    }),
  }, 'openai');
  if (!res.ok) {
    let detail = ''; try { detail = (await res.json())?.error?.message || ''; } catch { /* keine Details */ }
    throw new Error(friendlyError(res.status, detail, 'openai'));
  }
  const msg = await res.json();
  const choice = msg.choices?.[0];
  if (choice?.message?.refusal) throw new Error('OpenAI hat die Anfrage abgelehnt: ' + choice.message.refusal);
  const out = choice?.message?.content;
  if (!out) throw new Error('Leere Antwort von der API.');
  return { data: JSON.parse(out), usage: msg.usage };
}

// ---------- Verbindungstest ----------

export async function testConnection(config = aiConfig()) {
  if (!config.key) throw new Error('Kein API-Key');
  if (config.provider === 'openai') {
    const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, max_completion_tokens: 16, messages: [{ role: 'user', content: 'Antworte nur mit OK.' }] }),
    }, 'openai');
    if (res.ok) return true;
    let detail = ''; try { detail = (await res.json())?.error?.message || ''; } catch { /* egal */ }
    throw new Error(friendlyError(res.status, detail, 'openai'));
  }
  const res = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: config.model, max_tokens: 16, messages: [{ role: 'user', content: 'Antworte nur mit OK.' }] }),
  }, 'claude');
  if (res.ok) return true;
  let detail = ''; try { detail = (await res.json())?.error?.message || ''; } catch { /* egal */ }
  throw new Error(friendlyError(res.status, detail, 'claude'));
}

/** fetch mit verständlicher Meldung bei Netz-/CORS-Fehlern (OpenAI schickt bei 401 keine CORS-Header → „Failed to fetch“) */
async function safeFetch(url, init, provider) {
  try { return await fetch(url, init); }
  catch (e) {
    if (provider === 'openai') throw new Error('Keine Antwort von OpenAI – meist ist der API-Key ungültig (OpenAI beantwortet das ohne CORS-Header), sonst Netz prüfen.');
    throw new Error('Keine Antwort vom KI-Dienst – Netz prüfen.');
  }
}
