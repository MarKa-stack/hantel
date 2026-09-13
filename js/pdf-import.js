// PDF-Import: Text extrahieren (pdf.js) + Übungen per Mustererkennung finden.

const PDFJS_VERSION = '6.3.289';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return lib;
    });
  }
  return pdfjsPromise;
}

/**
 * Liest ein PDF und gibt Zeilen zurück. Spalten (große horizontale Lücken)
 * werden mit " | " getrennt, damit Tabellen erkennbar bleiben.
 */
export async function extractLines(file, onProgress) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(p, doc.numPages);
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter(it => it.str != null && it.str.trim() !== '')
      .map(it => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: Math.abs(it.transform[3]) || Math.abs(it.height) || 10,
      }));
    // Zeilen bilden: Items mit ähnlichem y gehören zusammen
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const rows = [];
    for (const it of items) {
      const tol = Math.max(2.5, it.h * 0.45);
      let row = rows.find(r => Math.abs(r.y - it.y) <= tol);
      if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
      row.items.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = null;
      for (const it of row.items) {
        if (prevEnd != null) {
          const gap = it.x - prevEnd;
          const fh = it.h || 10;
          if (gap > fh * 1.6) text += ' | ';
          else if (gap > fh * 0.12 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
        }
        text += it.str;
        prevEnd = it.x + it.w;
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
    lines.push(''); // Seitenumbruch
  }
  return lines;
}

// ---------- Mustererkennung ----------

const HEADER_KEYS = {
  name: /^(übung(en)?|exercise|bezeichnung|name|movement)$/i,
  sets: /^(sätze|satz|sets?|serien)$/i,
  reps: /^(wdh\.?|wiederholungen|wh|reps?|wiederh\.?)$/i,
  weight: /^(gewicht|kg|weight|last|load)$/i,
  rest: /^(pause|rest|erholung|p\.)$/i,
  tempo: /^(tempo|rpe|rir|notiz|notes?|bemerkung|kommentar)$/i,
};

const DAY_WORDS = /^(tag|day|trainingstag|training|workout|einheit|session|woche|week|split|plan)\s*[:\-]?\s*([a-z]|\d{1,2}|i{1,3}|iv|v)?\b/i;
const SPLIT_WORDS = /^(push|pull|legs?|beine|oberkörper|unterkörper|ganzkörper|full ?body|upper( body)?|lower( body)?|brust|rücken|schultern?|arme|bizeps|trizeps|core|bauch|cardio|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

// Hinweis: \b behandelt Umlaute als Nicht-Wortzeichen ("3 Sätze" → "3 S" + Grenze),
// deshalb werden Wortenden mit (?![a-zäöüß]) statt \b abgesichert.
const NW = '(?![a-zäöüß])';
const RE_SETSXREPS = /(\d{1,2})\s*[x×X*]\s*(\d{1,3}(?:\s*[-–/]\s*\d{1,3})?)(?!\s*(?:kg|cm|mm))/;
const RE_TIME_UNIT_AFTER = new RegExp('^\\s*(s|sek|sec|sekunden|min|minuten)' + NW, 'i');
const RE_SETS_WORD = new RegExp('(\\d{1,2})\\s*(?:sätze|satz|sets?|serien)' + NW, 'i');
const RE_REPS_WORD = new RegExp('(\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)\\s*(?:wdh\\.?|wiederholungen|wh' + NW + '|reps?' + NW + ')', 'i');
const RE_REPS_ONLY_WORD = /(?:^|[^a-zäöüß])(amrap|max\.?|maximal|bis (?:zum )?muskelversagen)(?![a-zäöüß])/i;
const RE_WEIGHT = new RegExp('(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(?:kg|kilo)' + NW, 'i');
const RE_REST = new RegExp(
  '(?:pause|rest|(?:^|\\s)p(?=\\s*[:.]))\\s*[:=.]?\\s*(\\d{1,3})\\s*(s|sek|sec|sekunden|min|minuten|\')?' + NW +
  '|(\\d{1,3})\\s*(s|sek|sec|sekunden)' + NW + '\\s*(?:pause|rest)?' +
  '|(\\d{1,2})\\s*(min|minuten)' + NW + '\\s*(?:pause|rest)', 'i');
const RE_LEADING_NUM = /^\s*(?:\d{1,2}\s*[.):]|[-•·*▪●–]|[a-z]\))\s*/i;

function norm(s) {
  return s
    .replace(/[×✕✖]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/[’´`]/g, "'")
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function letters(s) { return (s.match(/[a-zäöüß]/gi) || []).length; }

function detectHeader(cells) {
  if (cells.length < 2) return null;
  const map = {};
  let hits = 0;
  cells.forEach((c, i) => {
    const t = c.trim();
    for (const [k, re] of Object.entries(HEADER_KEYS)) {
      if (re.test(t)) { if (map[k] == null) map[k] = i; hits++; break; }
    }
  });
  return hits >= 2 ? map : null;
}

function parseRest(s) {
  const m = s.match(RE_REST);
  if (!m) return null;
  if (m[1]) { const n = +m[1]; return /min/.test(m[2] || '') || m[2] === "'" ? n * 60 : n; }
  if (m[3]) return +m[3];
  if (m[5]) return +m[5] * 60;
  return null;
}

function cleanName(s) {
  let n = s.replace(RE_LEADING_NUM, '');
  n = n.replace(/[\s:|\-–,;(]+$/g, '').trim();
  n = n.replace(/\s{2,}/g, ' ');
  return n;
}

/** Versucht, aus einer Zeile eine Übung zu lesen. */
function parseExerciseLine(line, header) {
  const cells = line.split(' | ').map(c => c.trim()).filter(Boolean);
  const text = cells.join(' ');
  if (letters(text) < 3) return null;

  let name = null, sets = null, reps = null, weight = null, restSec = null, note = '';
  let restText = text; // Text für die Pausen-Suche (ohne Zeitangaben, die zu den Wdh gehören, z.B. "Plank 3 x 45 s")

  // 1) Tabelle mit erkanntem Header
  if (header && cells.length >= 2) {
    const get = (k) => header[k] != null ? cells[header[k]] : undefined;
    name = get('name') ?? cells[0];
    const s = get('sets'), r = get('reps'), w = get('weight'), p = get('rest');
    if (s) { const m = s.match(/\d{1,2}/); if (m) sets = +m[0]; }
    if (r) {
      const m = r.match(/\d{1,3}(?:\s*[-–/]\s*\d{1,3})?/);
      if (m) {
        reps = m[0].replace(/\s+/g, '');
        const tu = r.slice(m.index + m[0].length).match(RE_TIME_UNIT_AFTER);
        if (tu) reps += /min/i.test(tu[1]) ? 'min' : 's';
      } else if (RE_REPS_ONLY_WORD.test(r)) reps = r.trim();
    }
    restText = header.rest != null ? (p || '') : cells.filter((_, i) => i !== header.reps).join(' ');
    if (w) { const m = w.match(/\d{1,3}(?:[.,]\d{1,2})?/); if (m) weight = parseFloat(m[0].replace(',', '.')); }
    if (p) { const m = p.match(/\d{1,3}/); if (m) restSec = /min/i.test(p) ? +m[0] * 60 : +m[0]; }
    // Fallback: setsXreps in einer Zelle
    if (sets == null && reps == null) {
      const m = text.match(RE_SETSXREPS);
      if (m) { sets = +m[1]; reps = m[2].replace(/\s+/g, ''); }
    }
    if (header.tempo != null && cells[header.tempo] && cells[header.tempo] !== name) note = cells[header.tempo];
  }

  // 2) Freitext-Muster
  if (sets == null && reps == null) {
    let m = text.match(RE_SETSXREPS);
    if (m) {
      sets = +m[1]; reps = m[2].replace(/\s+/g, '');
      name = name ?? text.slice(0, m.index);
      // "3 x 45 s" → zeitbasierte Übung, die Sekunden sind keine Pause
      const after = text.slice(m.index + m[0].length);
      const tu = after.match(RE_TIME_UNIT_AFTER);
      if (tu) { reps += /min/i.test(tu[1]) ? 'min' : 's'; restText = text.slice(0, m.index) + after.slice(tu[0].length); }
    }
    else {
      const ms = text.match(RE_SETS_WORD), mr = text.match(RE_REPS_WORD);
      if (ms) sets = +ms[1];
      if (mr) reps = mr[1].replace(/\s+/g, '');
      if (!mr) { const mo = text.match(RE_REPS_ONLY_WORD); if (mo && ms) reps = mo[1]; }
      if (ms || mr) {
        const idx = Math.min(ms ? ms.index : Infinity, mr ? mr.index : Infinity);
        name = name ?? text.slice(0, idx);
      }
    }
  }

  // 3) Tabelle ohne Header: Name + mehrere Zahlenzellen
  if (sets == null && reps == null && cells.length >= 3) {
    const nums = cells.slice(1).map(c => c.match(/^(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*[-–/]\s*(\d{1,3}))?\s*(kg|s|sek|min)?$/i));
    const numeric = nums.filter(Boolean);
    if (numeric.length >= 2 && letters(cells[0]) >= 3) {
      name = cells[0];
      const vals = [];
      nums.forEach((m) => { if (m) vals.push(m); });
      sets = +vals[0][1];
      reps = vals[1][2] ? `${vals[1][1]}-${vals[1][2]}` : vals[1][1];
      for (const v of vals.slice(2)) {
        const u = (v[3] || '').toLowerCase();
        if (u === 'kg' || (!u && weight == null && restSec == null)) weight = parseFloat(v[1].replace(',', '.'));
        else if (/^s|sek|min/.test(u)) restSec = /min/.test(u) ? +v[1] * 60 : +v[1];
      }
    }
  }

  if (name == null || sets == null && reps == null) return null;

  // Gewicht & Pause aus dem gesamten Text nachziehen
  if (weight == null) { const m = text.match(RE_WEIGHT); if (m) weight = parseFloat(m[1].replace(',', '.')); }
  if (restSec == null) restSec = parseRest(restText);

  name = cleanName(name);
  if (letters(name) < 3) return null;
  if (Object.values(HEADER_KEYS).some(re => re.test(name))) return null;
  if (sets == null) sets = 3;
  if (reps == null) reps = '10';

  return { name, sets, reps: String(reps), weight, restSec, note };
}

function isDayHeader(line) {
  const t = line.replace(/ \| /g, ' ').trim();
  if (t.length > 48 || letters(t) < 3) return false;
  if (RE_SETSXREPS.test(t) || RE_REPS_WORD.test(t)) return false;
  if (DAY_WORDS.test(t)) return true;
  if (SPLIT_WORDS.test(t) && !/\d/.test(t.replace(/\b(tag|day|woche)\s*\d\b/i, ''))) return true;
  if (/^[A-ZÄÖÜ][A-ZÄÖÜ\s\-/&]{3,}$/.test(t) && !/\d/.test(t)) return true; // GROSSBUCHSTABEN-Überschrift
  if (/:$/.test(t) && t.length < 32) return true;
  return false;
}

/**
 * Wandelt PDF-Zeilen in Pläne mit Übungen um.
 * @returns {{plans: Array<{name:string, exercises:Array}>, unmatched: string[]}}
 */
export function parsePlanText(rawLines, fallbackName = 'Importierter Plan') {
  const lines = rawLines.map(norm);
  const plans = [];
  const unmatched = [];
  let current = null;
  let header = null;
  let pendingName = null; // Übungsname auf eigener Zeile, Sätze/Wdh folgen

  const ensurePlan = (name) => {
    if (!current || name) {
      current = { name: name || fallbackName, exercises: [] };
      plans.push(current);
    }
    return current;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { pendingName = null; continue; }
    const cells = line.split(' | ').map(c => c.trim()).filter(Boolean);

    // Tabellen-Header?
    const hdr = detectHeader(cells);
    if (hdr) { header = hdr; pendingName = null; continue; }

    // Tag/Abschnitt?
    if (isDayHeader(line)) {
      // Originalzeile für den Namen nehmen (behält z.B. den Gedankenstrich)
      const name = cleanName(rawLines[i].replace(/\s+/g, ' ').replace(/ \| /g, ' ')).replace(/:$/, '').trim();
      // Leeren, gerade erst angelegten Plan umbenennen statt neuen anlegen
      if (current && current.exercises.length === 0) current.name = name;
      else ensurePlan(name);
      pendingName = null;
      continue;
    }

    // Übung?
    let ex = parseExerciseLine(line, header);

    // Zwei-Zeilen-Layout: "Bankdrücken" / "3 x 10"
    if (!ex && pendingName) {
      const combined = parseExerciseLine(pendingName + ' ' + line, null);
      if (combined) { ex = combined; pendingName = null; }
    }

    if (ex) {
      ensurePlan(null).exercises.push(ex);
      pendingName = null;
      continue;
    }

    // Zeile ohne Zahlen, könnte ein Übungsname sein, dessen Angaben in der nächsten Zeile stehen
    if (letters(line) >= 3 && !/\d/.test(line) && line.length < 60 && cells.length === 1) {
      pendingName = cleanName(line);
      continue;
    }

    // Pausen-/Notizzeile direkt unter einer Übung
    const last = current?.exercises[current.exercises.length - 1];
    if (last && /pause|rest/i.test(line) && !RE_SETSXREPS.test(line)) {
      const r = parseRest(line);
      if (r) { last.restSec = last.restSec ?? r; continue; }
    }
    unmatched.push(line);
  }

  // Pläne ohne Übungen entfernen
  const result = plans.filter(p => p.exercises.length > 0);
  // Globale "Pause: 90s"-Angabe auf Übungen ohne Pause übertragen
  const globalRest = unmatched.map(parseRest).find(Boolean);
  if (globalRest) for (const p of result) for (const e of p.exercises) if (e.restSec == null) e.restSec = globalRest;

  return { plans: result, unmatched };
}
