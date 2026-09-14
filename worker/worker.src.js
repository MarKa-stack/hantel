// Hantel KI-Worker (Cloudflare Workers, ES-Modul, eine Datei – auch per Dashboard einfügbar).
// Der OpenAI-Key liegt NUR hier als Secret. Die App schickt Daten, der Worker hält Prompts, Schemas,
// Limits und ruft OpenAI auf. Generiert aus worker/worker.src.js + js/ai-tasks.js (tools/build-worker.ps1).
//
// Bindings / Secrets (Dashboard → Settings → Variables):
//   OPENAI_API_KEY        Secret, Pflicht
//   APP_TOKEN             Secret, Pflicht – dasselbe Token trägt die App unter „Mehr → KI“ ein
//   OPENAI_MODEL          Variable, Standard gpt-5-mini (Text, Rezepte, PDF)
//   OPENAI_VISION_MODEL   Variable, Standard = OPENAI_MODEL (muss Bilder können)
//   OPENAI_SEARCH_MODEL   Variable, Standard = OPENAI_MODEL (Responses-API + Websuche)
//   ALLOWED_ORIGINS       Variable, Komma-Liste, Standard https://marka-stack.github.io
//   DAILY_LIMIT           Variable, Anfragen pro Tag gesamt, Standard 200
//   RATE_PER_10MIN        Variable, Anfragen pro IP und 10 Minuten, Standard 20
//   MAX_CONCURRENT        Variable, parallele Anfragen je Worker-Instanz, Standard 3
//   TIMEOUT_MS            Variable, Standard 60000
//   HANTEL_KV             KV-Namespace (optional, für Limits/Zähler über Instanzen hinweg)

/*__TASKS__*/

const inflight = { n: 0 };
const memCounters = new Map(); // Fallback ohne KV (pro Isolate)

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || 'https://marka-stack.github.io').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || (origin.startsWith('http://localhost') && allowed.some(a => a.includes('localhost')));
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-app-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
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

// ---------- Zähler (KV oder Speicher) ----------

async function bump(env, key, ttlSec) {
  if (env.HANTEL_KV) {
    const cur = parseInt(await env.HANTEL_KV.get(key) || '0', 10) + 1;
    await env.HANTEL_KV.put(key, String(cur), { expirationTtl: ttlSec });
    return cur;
  }
  const now = Date.now();
  const e = memCounters.get(key);
  const cur = e && e.exp > now ? e.n + 1 : 1;
  memCounters.set(key, { n: cur, exp: now + ttlSec * 1000 });
  return cur;
}

async function read(env, key) {
  if (env.HANTEL_KV) return parseInt(await env.HANTEL_KV.get(key) || '0', 10);
  const e = memCounters.get(key);
  return e && e.exp > Date.now() ? e.n : 0;
}

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); }

// ---------- OpenAI ----------

function friendly(status, detail) {
  if (status === 401) return 'Der Server hat keinen gültigen OpenAI-Key (401).';
  if (status === 429) return 'OpenAI-Limit oder Guthaben erschöpft (429). Später erneut versuchen.';
  if (status >= 500) return 'Die KI-Analyse ist gerade nicht verfügbar. Versuch es später erneut.';
  return `KI-Fehler ${status}${detail ? ': ' + detail : ''}`;
}

async function openai(path, body, env, signal) {
  const res = await fetch('https://api.openai.com/v1/' + path, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = ''; try { detail = (await res.json())?.error?.message || ''; } catch { /* keine Details */ }
    const err = new Error(friendly(res.status, detail)); err.status = res.status; err.detail = detail; throw err;
  }
  return res.json();
}

/** Chat Completions mit striktem JSON-Schema (Text, Bild, PDF) */
async function chatStructured(task, inp, env, signal) {
  const model = task.vision ? (env.OPENAI_VISION_MODEL || env.OPENAI_MODEL || 'gpt-5-mini') : (env.OPENAI_MODEL || 'gpt-5-mini');
  const content = [];
  if (inp.image) content.push({ type: 'image_url', image_url: { url: inp.image, detail: 'auto' } });
  if (inp.pdf) content.push({ type: 'file', file: { filename: inp.pdf.name, file_data: 'data:application/pdf;base64,' + inp.pdf.base64 } });
  content.push({ type: 'text', text: inp.text });
  const msg = await openai('chat/completions', {
    model, max_completion_tokens: task.maxTokens,
    messages: [{ role: 'system', content: task.system }, { role: 'user', content }],
    response_format: { type: 'json_schema', json_schema: { name: task.schemaName, strict: true, schema: apiSchema(task.schema) } },
  }, env, signal);
  const choice = msg.choices && msg.choices[0];
  if (choice && choice.message && choice.message.refusal) throw Object.assign(new Error('Die KI hat die Anfrage abgelehnt: ' + choice.message.refusal), { status: 422 });
  const text = choice && choice.message && choice.message.content;
  if (!text) throw Object.assign(new Error('Leere KI-Antwort.'), { status: 502 });
  return { text, usage: msg.usage, model };
}

/** Responses-API mit Websuche + JSON-Schema; liefert zusätzlich die zitierten URLs */
async function searchStructured(task, inp, env, signal) {
  const model = env.OPENAI_SEARCH_MODEL || env.OPENAI_MODEL || 'gpt-5-mini';
  const body = (toolType) => ({
    model, max_output_tokens: task.maxTokens,
    tools: [{ type: toolType }],
    instructions: task.system,
    input: inp.text,
    text: { format: { type: 'json_schema', name: task.schemaName, strict: true, schema: apiSchema(task.schema) } },
  });
  let msg;
  try { msg = await openai('responses', body('web_search'), env, signal); }
  catch (e) {
    if (e.status === 400 && /tool|web_search/i.test(e.detail || '')) msg = await openai('responses', body('web_search_preview'), env, signal);
    else throw e;
  }
  const cited = [];
  let text = '';
  for (const item of msg.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type === 'output_text') { text += c.text || ''; for (const a of c.annotations || []) if (a.type === 'url_citation' && a.url) cited.push(a.url); }
    }
  }
  if (!text) throw Object.assign(new Error('Leere KI-Antwort.'), { status: 502 });
  return { text, usage: msg.usage, cited, model };
}

// ---------- Request-Handling ----------

async function handleTask(name, payload, env) {
  const task = TASKS[name];
  if (!task) throw Object.assign(new Error('Unbekannte Aufgabe'), { status: 404 });
  let inp;
  try { inp = task.input(payload); } catch (e) { throw Object.assign(new Error(e.message), { status: 400 }); }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), parseInt(env.TIMEOUT_MS || '60000', 10));
  let raw;
  try {
    raw = task.webSearch ? await searchStructured(task, inp, env, ctl.signal) : await chatStructured(task, inp, env, ctl.signal);
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('Die KI-Antwort hat zu lange gedauert. Versuch es erneut.'), { status: 504 });
    throw e;
  } finally { clearTimeout(timer); }

  let parsed;
  try { parsed = JSON.parse(raw.text); } catch { throw Object.assign(new Error('Ungültige KI-Antwort (kein JSON). Bitte erneut versuchen.'), { status: 502 }); }
  const problems = validateSchema(task.schema, parsed);
  if (problems.length) throw Object.assign(new Error('Ungültige KI-Antwort: ' + problems.slice(0, 3).join('; ')), { status: 502 });
  const data = task.clean(parsed, raw.cited || null);
  return { data, model: raw.model, tokens: raw.usage };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ai\/([a-z-]+)$/);
    if (!m) return json({ ok: false, error: 'Nicht gefunden' }, 404, cors);

    if (!env.OPENAI_API_KEY) return json({ ok: false, error: 'Server nicht konfiguriert: OPENAI_API_KEY fehlt.' }, 500, cors);
    if (!env.APP_TOKEN) return json({ ok: false, error: 'Server nicht konfiguriert: APP_TOKEN fehlt.' }, 500, cors);
    const token = request.headers.get('X-App-Token') || '';
    if (token !== env.APP_TOKEN) return json({ ok: false, error: 'Zugangstoken fehlt oder ist falsch.' }, 401, cors);

    const today = dayKey(), month = monthKey();
    if (m[1] === 'usage') {
      if (request.method !== 'GET') return json({ ok: false, error: 'Methode' }, 405, cors);
      return json({ ok: true, usage: { today: await read(env, 'usage:' + today), month: await read(env, 'usage:' + month), dailyLimit: parseInt(env.DAILY_LIMIT || '200', 10) } }, 200, cors);
    }
    if (request.method !== 'POST') return json({ ok: false, error: 'Methode' }, 405, cors);

    // Schutz: Größe, Parallelität, Rate pro IP, Tageslimit
    const len = parseInt(request.headers.get('content-length') || '0', 10);
    if (len > 45_000_000) return json({ ok: false, error: 'Anfrage zu groß.' }, 413, cors);
    if (inflight.n >= parseInt(env.MAX_CONCURRENT || '3', 10)) return json({ ok: false, error: 'Gerade zu viele Anfragen gleichzeitig – kurz warten.' }, 429, cors);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = Math.floor(Date.now() / 600000);
    const perIp = await bump(env, `rl:${ip}:${bucket}`, 700);
    if (perIp > parseInt(env.RATE_PER_10MIN || '20', 10)) return json({ ok: false, error: 'Zu viele Anfragen – bitte ein paar Minuten warten.' }, 429, cors);
    const dayCount = await bump(env, 'usage:' + today, 3 * 86400);
    if (dayCount > parseInt(env.DAILY_LIMIT || '200', 10)) return json({ ok: false, error: 'Tageslimit für KI-Anfragen erreicht.' }, 429, cors);
    const monthCount = await bump(env, 'usage:' + month, 40 * 86400);

    let payload;
    try { payload = await request.json(); } catch { return json({ ok: false, error: 'Ungültige Anfrage (kein JSON).' }, 400, cors); }

    inflight.n++;
    try {
      const { data, model, tokens } = await handleTask(m[1], payload, env);
      return json({ ok: true, data, model, tokens, usage: { today: dayCount, month: monthCount } }, 200, cors);
    } catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
      return json({ ok: false, error: e.message || 'Unbekannter Fehler' }, status, cors);
    } finally { inflight.n--; }
  },
};
