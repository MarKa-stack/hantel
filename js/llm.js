// KI-Zugang der App. Empfohlen: „Hantel-Server“ (Cloudflare Worker, Key nur dort). Alternativ, wie bisher:
// eigener Claude-/OpenAI-Key im Gerät. Aufgaben (Prompts/Schemas) kommen aus ai-tasks.js – im Server-Modus
// schickt die App nur Daten, der Worker hält die Prompts.
import { getSettings, updateSettings } from './store.js';
import { TASKS, validateSchema } from './ai-tasks.js';

export const PROVIDERS = {
  proxy: {
    label: 'Hantel-Server',
    hint: 'Empfohlen: Der OpenAI-Key liegt nur auf deinem Cloudflare-Worker, die App braucht nur URL und Zugangstoken (siehe worker/README.md).',
  },
  claude: {
    label: 'Claude-Key',
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
    label: 'OpenAI-Key',
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

/** Aktive Konfiguration */
export function aiConfig() {
  const s = getSettings();
  const provider = ['proxy', 'openai', 'claude'].includes(s.aiProvider) ? s.aiProvider : 'claude';
  if (provider === 'proxy') {
    const url = String(s.proxyUrl || '').trim().replace(/\/+$/, '');
    return { provider, url, token: String(s.proxyToken || '').trim(), key: url && s.proxyToken ? 'proxy' : '', model: 'Server', label: PROVIDERS.proxy.label };
  }
  const p = PROVIDERS[provider];
  const key = (provider === 'openai' ? s.openaiKey : s.apiKey) || '';
  const model = (provider === 'openai' ? s.openaiModel : s.aiModel) || p.defaultModel;
  return { provider, key: key.trim(), model, label: p.label };
}

export function aiReady() { return !!aiConfig().key; }

/** Kann der aktive Zugang Bilder / Websuche? */
export function aiSupports(feature) {
  const c = aiConfig();
  if (c.provider === 'proxy') return true;
  if (feature === 'webSearch') return c.provider === 'openai';
  return true; // Bilder und PDF: Claude und OpenAI
}

function friendlyError(status, detail, provider) {
  if (status === 401) return `API-Key ungültig (401) – bitte unter „Mehr → KI“ prüfen (${PROVIDERS[provider].label}).`;
  if (status === 429) return 'Rate-Limit oder Guthaben erschöpft (429). Kurz warten bzw. Konto prüfen.';
  if (status === 529 || status === 503 || status >= 500) return 'Die KI-Analyse ist gerade nicht verfügbar. Versuch es später erneut.';
  return `API-Fehler ${status}${detail ? ': ' + detail : ''}`;
}

/** Schema-Wörter, die die Anbieter im strikten Modus nicht akzeptieren, nur lokal prüfen */
function apiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(apiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (['minimum', 'maximum', 'maxLength', 'maxItems', 'minItems', 'minLength'].includes(k)) continue;
    out[k] = apiSchema(v);
  }
  return out;
}

/** fetch mit verständlicher Meldung bei Netz-/CORS-Fehlern (OpenAI schickt bei 401 keine CORS-Header → „Failed to fetch“) */
async function safeFetch(url, init, provider) {
  try { return await fetch(url, init); }
  catch (e) {
    if (e.name === 'AbortError') throw new Error('Die KI-Antwort hat zu lange gedauert. Versuch es erneut.');
    if (provider === 'openai') throw new Error('Keine Antwort von OpenAI – meist ist der API-Key ungültig (OpenAI beantwortet das ohne CORS-Header), sonst Netz prüfen.');
    if (provider === 'proxy') throw new Error('Hantel-Server nicht erreichbar – URL prüfen oder Netz.');
    throw new Error('Keine Antwort vom KI-Dienst – Netz prüfen.');
  }
}

// ==================================================================
// Aufgaben ausführen
// ==================================================================

/**
 * Führt eine KI-Aufgabe aus ai-tasks.js aus – über den Hantel-Server oder direkt mit eigenem Key.
 * @param {'food-text'|'food-image'|'recipe'|'web-recipes'|'pdf-plans'} name
 * @param {object} payload Rohdaten (werden von task.input geprüft)
 * @returns {Promise<{ data:object, usage?:object }>}
 */
export async function runTask(name, payload) {
  const task = TASKS[name];
  if (!task) throw new Error('Unbekannte KI-Aufgabe');
  const config = aiConfig();
  if (!config.key) throw new Error('Kein KI-Zugang eingerichtet – unter „Mehr → KI“ Server oder Key eintragen.');
  if (config.provider === 'proxy') return proxyTask(name, payload, config);

  // Eigener Key: dieselbe Prüfung und Bereinigung wie im Worker
  const inp = task.input(payload);
  if (task.webSearch && config.provider !== 'openai') throw new Error('Rezepte im Web brauchen den Hantel-Server oder einen OpenAI-Key.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  let text, cited = null;
  try {
    if (task.webSearch) ({ text, cited } = await openaiSearch(task, inp, config, ctl.signal));
    else if (config.provider === 'openai') text = await openaiChat(task, inp, config, ctl.signal);
    else text = await claudeChat(task, inp, config, ctl.signal);
  } finally { clearTimeout(timer); }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Ungültige KI-Antwort (kein JSON). Bitte erneut versuchen.'); }
  const problems = validateSchema(task.schema, parsed);
  if (problems.length) throw new Error('Ungültige KI-Antwort: ' + problems.slice(0, 3).join('; '));
  return { data: task.clean(parsed, cited) };
}

async function proxyTask(name, payload, config) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 75000);
  try {
    const res = await safeFetch(`${config.url}/ai/${name}`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'X-App-Token': config.token },
      body: JSON.stringify(payload),
    }, 'proxy');
    let body = null;
    try { body = await res.json(); } catch { /* keine JSON-Antwort */ }
    if (!res.ok || !body?.ok) {
      const msg = body?.error || (res.status === 401 ? 'Zugangstoken falsch – unter „Mehr → KI“ prüfen.' : res.status === 429 ? 'Zu viele Anfragen – kurz warten.' : `Server-Fehler ${res.status}`);
      throw new Error(msg);
    }
    if (body.usage) updateSettings({ proxyUsage: body.usage, proxyUsageAt: Date.now() });
    return { data: body.data, usage: body.usage };
  } finally { clearTimeout(timer); }
}

// ---------- eigener Key: OpenAI ----------

async function openaiChat(task, inp, config, signal) {
  const content = [];
  if (inp.image) content.push({ type: 'image_url', image_url: { url: inp.image, detail: 'auto' } });
  if (inp.pdf) content.push({ type: 'file', file: { filename: inp.pdf.name, file_data: 'data:application/pdf;base64,' + inp.pdf.base64 } });
  content.push({ type: 'text', text: inp.text });
  const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model, max_completion_tokens: task.maxTokens,
      messages: [{ role: 'system', content: task.system }, { role: 'user', content }],
      response_format: { type: 'json_schema', json_schema: { name: task.schemaName, strict: true, schema: apiSchema(task.schema) } },
    }),
  }, 'openai');
  if (!res.ok) { let d = ''; try { d = (await res.json())?.error?.message || ''; } catch { /* egal */ } throw new Error(friendlyError(res.status, d, 'openai')); }
  const msg = await res.json();
  const choice = msg.choices?.[0];
  if (choice?.message?.refusal) throw new Error('OpenAI hat die Anfrage abgelehnt: ' + choice.message.refusal);
  const out = choice?.message?.content;
  if (!out) throw new Error('Leere Antwort von der API.');
  return out;
}

async function openaiSearch(task, inp, config, signal) {
  const body = (toolType) => JSON.stringify({
    model: config.model, max_output_tokens: task.maxTokens, tools: [{ type: toolType }], instructions: task.system, input: inp.text,
    text: { format: { type: 'json_schema', name: task.schemaName, strict: true, schema: apiSchema(task.schema) } },
  });
  const call = (toolType) => safeFetch('https://api.openai.com/v1/responses', { method: 'POST', signal, headers: { 'content-type': 'application/json', Authorization: `Bearer ${config.key}` }, body: body(toolType) }, 'openai');
  let res = await call('web_search');
  if (res.status === 400) { const d = await res.text(); if (/tool|web_search/i.test(d)) res = await call('web_search_preview'); else throw new Error(friendlyError(400, d.slice(0, 120), 'openai')); }
  if (!res.ok) { let d = ''; try { d = (await res.json())?.error?.message || ''; } catch { /* egal */ } throw new Error(friendlyError(res.status, d, 'openai')); }
  const msg = await res.json();
  const cited = []; let text = '';
  for (const item of msg.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) if (c.type === 'output_text') { text += c.text || ''; for (const a of c.annotations || []) if (a.type === 'url_citation' && a.url) cited.push(a.url); }
  }
  if (!text) throw new Error('Leere Antwort von der API.');
  return { text, cited };
}

// ---------- eigener Key: Claude ----------

async function claudeChat(task, inp, config, signal) {
  const content = [];
  if (inp.image) {
    const m = inp.image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  if (inp.pdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: inp.pdf.base64 } });
  content.push({ type: 'text', text: inp.text });
  const res = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: config.model, max_tokens: task.maxTokens, system: task.system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: apiSchema(task.schema) } } }),
  }, 'claude');
  if (!res.ok) { let d = ''; try { d = (await res.json())?.error?.message || ''; } catch { /* egal */ } throw new Error(friendlyError(res.status, d, 'claude')); }
  const msg = await res.json();
  if (msg.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt' + (msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : '.'));
  const out = (msg.content || []).find(b => b.type === 'text')?.text;
  if (!out) throw new Error('Leere Antwort von der API.');
  return out;
}

// ==================================================================
// Verbindungstest, Modelle, Nutzung
// ==================================================================

export async function testConnection(config = aiConfig()) {
  if (config.provider === 'proxy') {
    if (!config.url || !config.token) throw new Error('Server-URL und Zugangstoken eintragen');
    const res = await safeFetch(`${config.url}/ai/usage`, { headers: { 'X-App-Token': config.token } }, 'proxy');
    let body = null; try { body = await res.json(); } catch { /* egal */ }
    if (!res.ok || !body?.ok) throw new Error(body?.error || (res.status === 401 ? 'Zugangstoken falsch.' : `Server antwortet mit ${res.status}`));
    updateSettings({ proxyUsage: body.usage, proxyUsageAt: Date.now() });
    return true;
  }
  if (!config.key) throw new Error('Kein API-Key');
  if (config.provider === 'openai') {
    // Erst der Key über /v1/models (liefert bei 401 saubere CORS-Header), dann das Modell über einen Mini-Chat
    const probe = await safeFetch('https://api.openai.com/v1/models?limit=1', { headers: { Authorization: `Bearer ${config.key}` } }, 'openai');
    if (!probe.ok) throw new Error(friendlyError(probe.status, '', 'openai'));
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

/** Modelle, auf die der Key Zugriff hat (OpenAI: /v1/models, Claude: /v1/models) */
export async function listModels(config = aiConfig()) {
  if (config.provider === 'proxy') throw new Error('Im Server-Modus wird das Modell auf dem Worker konfiguriert (OPENAI_MODEL).');
  if (!config.key) throw new Error('Kein API-Key');
  if (config.provider === 'openai') {
    const res = await safeFetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${config.key}` } }, 'openai');
    if (!res.ok) throw new Error(friendlyError(res.status, '', 'openai'));
    const data = (await res.json()).data || [];
    return data.map(m => m.id)
      .filter(id => /^(gpt|o\d|chatgpt)/i.test(id) && !/embedding|audio|realtime|tts|transcribe|image|search|moderation|instruct|vision-preview/i.test(id))
      .sort((a, b) => b.localeCompare(a)).map(id => ({ id, label: id }));
  }
  const res = await safeFetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }, 'claude');
  if (!res.ok) throw new Error(friendlyError(res.status, '', 'claude'));
  const data = (await res.json()).data || [];
  return data.map(m => ({ id: m.id, label: m.display_name ? `${m.display_name} (${m.id})` : m.id }));
}
