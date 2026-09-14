// Double Progression, Gewichtsschritte und PR-Erkennung
import { getSessions, e1rm, setVolume, getCustomExercises } from './store.js';
import { normalizeName } from './util.js';

// ---------- Wiederholungsbereich & Gewichtsschritt ----------

/** "8-12" → {min:8, max:12}; "10" → {min:10, max:10}; "AMRAP" → null */
export function repsRange(reps) {
  const m = String(reps ?? '').match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!m) return null;
  const a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** Standard-Gewichtsschritt nach Übungstyp: Kurzhantel 2 kg, Maschine/Kabel 5 kg, sonst (Langhantel) 2,5 kg */
export function inferWeightStep(name) {
  const n = normalizeName(name);
  if (/kurzhantel|\bkh\b|dumbbell|kurzhanteln/.test(n)) return 2;
  if (/maschine|machine|kabel|cable|presse|press\b|latzug|pulldown|butterfly|pec deck|beinstrecker|beinbeuger|leg curl|leg extension|hip thrust|hackenschmidt|hack|beinpresse|rudern|row|flys?|fly\b|pushdown|trizepsdrücken|seitheben am kabel|wadenheben|calf|crunch/.test(n)) return 5;
  return 2.5;
}

export function weightStepFor(exercise) {
  const s = Number(exercise?.weightStep);
  if (s > 0) return s;
  // eigene Übung mit hinterlegtem Schritt?
  const c = getCustomExercises().find(x => normalizeName(x.name) === normalizeName(exercise?.name || ''));
  if (c && Number(c.weightStep) > 0) return Number(c.weightStep);
  return inferWeightStep(exercise?.name || '');
}

export function roundToStep(w, step) {
  if (!step) return w;
  return Math.round(w / step) * step;
}

export function fmtKg(w) {
  if (w == null || isNaN(w)) return '–';
  const n = Number(w);
  return (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')) + ' kg';
}

// ---------- Verlauf einer Übung ----------

/** Alle Sessions mit Sätzen dieser Übung, chronologisch (älteste zuerst); Deload-Einheiten optional ausblenden */
export function historyFor(name, { before = Infinity, skipDeload = false } = {}) {
  const key = normalizeName(name);
  const out = [];
  for (const s of getSessions()) {
    if (s.startedAt >= before) continue;
    if (skipDeload && s.deload) continue;
    const e = s.entries.find(x => normalizeName(x.name) === key);
    if (e && e.sets.length) out.push({ session: s, entry: e });
  }
  return out;
}

/** Arbeitssätze einer Einheit (ohne Drop-Sätze) */
export function workSets(entry) {
  return entry.sets.filter(s => s.type !== 'drop');
}

/** Arbeitsgewicht einer Einheit: das Gewicht, mit dem die meisten Sätze gemacht wurden (bei Gleichstand das höhere) */
export function workingWeight(entry) {
  const counts = new Map();
  for (const s of entry.sets) {
    if (s.weight == null) continue;
    const w = Number(s.weight);
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  let best = null, bestN = 0;
  for (const [w, n] of counts) if (n > bestN || (n === bestN && w > best)) { best = w; bestN = n; }
  return best;
}

// ---------- Double Progression ----------

/**
 * Empfehlung fürs nächste Training.
 * @param {object} exercise Plan-Übung { name, sets, reps, weight, weightStep }
 * @returns {{ weight:number|null, reps:{min,max}|null, status:string, message:string, last:object|null, decline:boolean }}
 */
export function recommend(exercise, opts = {}) {
  const range = repsRange(exercise.reps);
  const step = weightStepFor(exercise);
  // Deload-Einheiten sind bewusst leichter und zählen für die Progression nicht
  const hist = historyFor(exercise.name, { ...opts, skipDeload: true });
  const last = hist[hist.length - 1] || null;

  if (!last) {
    return {
      weight: exercise.weight ?? null, reps: range, step, last: null, decline: false,
      status: 'first', message: exercise.weight != null ? 'Erstes Training mit diesem Plan – Startgewicht aus dem Plan.' : 'Erstes Training – wähle ein Gewicht, mit dem du den Zielbereich sauber schaffst.',
    };
  }

  const lastSets = workSets(last.entry);
  const w = workingWeight({ sets: lastSets });
  const setsAtW = lastSets.filter(s => Number(s.weight) === w);
  const targetSets = Math.max(1, exercise.sets || 1);

  // Leistungsabfall gegenüber dem bisherigen Niveau (bestes e1RM davor)?
  const lastBest = Math.max(0, ...lastSets.map(s => e1rm(s.weight, s.reps)));
  const prevBest = Math.max(0, ...hist.slice(0, -1).flatMap(h => workSets(h.entry).map(s => e1rm(s.weight, s.reps))));
  const decline = prevBest > 0 && lastBest < prevBest * 0.92;

  if (w == null || !range) {
    return { weight: w, reps: range, step, last, decline, status: 'keep', message: 'Gewicht beibehalten.' };
  }

  const allReachedMax = setsAtW.length >= targetSets && setsAtW.every(s => Number(s.reps) >= range.max);
  if (allReachedMax) {
    return {
      weight: w + step, reps: range, step, last, decline: false,
      status: 'increase', message: `Zielbereich vollständig erreicht (${targetSets} × ${range.max}). Nächste Stufe: +${fmtKg(step)}.`,
    };
  }
  // RIR-Schärfung: alle Sätze im Zielbereich UND überall RIR ≥ 3 protokolliert → das Gewicht war zu leicht
  const allInRangeEasy = setsAtW.length >= targetSets && setsAtW.every(s => Number(s.reps) >= range.min && s.rir != null && Number(s.rir) >= 3);
  if (allInRangeEasy) {
    return {
      weight: w + step, reps: range, step, last, decline: false,
      status: 'increase', message: `Zielbereich mit RIR ≥ 3 erreicht – das Gewicht war zu leicht. Nächste Stufe: +${fmtKg(step)}.`,
    };
  }
  const anyBelowMin = setsAtW.some(s => Number(s.reps) < range.min);
  return {
    weight: w, reps: range, step, last, decline,
    status: anyBelowMin ? 'below' : 'keep',
    message: anyBelowMin
      ? `${fmtKg(w)} beibehalten – erst alle Sätze in den Zielbereich (${range.min}–${range.max}) bringen.`
      : `${fmtKg(w)} beibehalten und versuchen, die Wiederholungen zu steigern (Ziel: alle Sätze × ${range.max}).`,
  };
}

// ---------- Plateau & Deload ----------

/**
 * Stagnation: seit mindestens 4 Einheiten und 3 Wochen kein neues bestes e1RM.
 * @returns {{ sessions:number, since:number, bestE1rm:number, weight:number|null, grinding:boolean }|null}
 */
export function plateauFor(name) {
  const hist = historyFor(name, { skipDeload: true });
  if (hist.length < 4) return null;
  let best = 0, bestIdx = 0;
  hist.forEach(({ entry }, i) => {
    const rm = Math.max(0, ...workSets(entry).map(s => e1rm(s.weight, s.reps)));
    if (rm > best + 0.05) { best = rm; bestIdx = i; }
  });
  const stale = hist.length - 1 - bestIdx;
  const days = (Date.now() - hist[bestIdx].session.startedAt) / 86400000;
  if (stale < 4 || days < 21) return null;
  // „Grinding“: die letzten zwei Einheiten durchgehend mit RIR 0 protokolliert
  const grinding = hist.slice(-2).every(({ entry }) => workSets(entry).length && workSets(entry).every(s => s.rir === 0));
  return { sessions: stale, since: hist[bestIdx].session.startedAt, bestE1rm: best, weight: workingWeight(hist[hist.length - 1].entry), grinding };
}

/** Deload-Vorgabe: −15 % Gewicht (auf den Schritt gerundet), ein Satz weniger */
export function deloadFor(weight, step = 2.5, sets = 3) {
  const w = weight != null ? Math.max(step, roundToStep(Number(weight) * 0.85, step)) : null;
  return { weight: w, sets: Math.max(1, (sets || 1) - 1) };
}

/** Alle je trainierten Übungen, die gerade stagnieren */
export function plateauedExercises() {
  const seen = new Map();
  for (const s of getSessions()) for (const e of s.entries) if (e.sets.length) seen.set(normalizeName(e.name), e.name);
  const out = [];
  for (const name of seen.values()) { const p = plateauFor(name); if (p) out.push({ name, ...p }); }
  return out;
}

// ---------- Persönliche Rekorde ----------

/**
 * Bestwerte einer Übung aus der Historie (optional zusätzlich aus bereits erledigten Sätzen des laufenden Workouts).
 * @returns {{ maxWeight:{value,reps,date}|null, repsAtWeight:Map<number,{reps,date}>, e1rm:{value,weight,reps,date}|null, sessionVolume:{value,date}|null }}
 */
export function prBaseline(name, { extraSets = [], before = Infinity } = {}) {
  const base = { maxWeight: null, repsAtWeight: new Map(), e1rm: null, sessionVolume: null };
  const consider = (set, date) => {
    const w = Number(set.weight), r = Number(set.reps);
    if (!w || !r) return;
    if (!base.maxWeight || w > base.maxWeight.value || (w === base.maxWeight.value && r > base.maxWeight.reps)) base.maxWeight = { value: w, reps: r, date };
    const raw = base.repsAtWeight.get(w);
    if (!raw || r > raw.reps) base.repsAtWeight.set(w, { reps: r, date });
    const rm = e1rm(w, r);
    if (!base.e1rm || rm > base.e1rm.value) base.e1rm = { value: rm, weight: w, reps: r, date };
  };
  for (const { session, entry } of historyFor(name, { before })) {
    for (const s of entry.sets) consider(s, session.startedAt);
    const vol = entry.sets.reduce((a, s) => a + setVolume(s), 0);
    if (vol > 0 && (!base.sessionVolume || vol > base.sessionVolume.value)) base.sessionVolume = { value: vol, date: session.startedAt };
  }
  for (const s of extraSets) consider(s, Date.now());
  return base;
}

/**
 * Prüft einen gerade abgeschlossenen Satz auf neue Rekorde.
 * @param {string} name Übungsname
 * @param {{weight,reps}} set der neue Satz
 * @param {Array} earlierSets bereits erledigte Sätze dieser Übung im laufenden Workout (ohne den neuen)
 * @returns {Array<{type:'weight'|'reps'|'e1rm', value:number, prev:number|null, pct:number|null, weight:number, reps:number, e1rm:number}>}
 */
export function detectSetPRs(name, set, earlierSets = []) {
  const w = Number(set.weight), r = Number(set.reps);
  if (!w || !r) return [];
  // Ohne frühere Einheit gibt es nichts zu übertreffen – der allererste Satz ist kein Rekord
  if (!historyFor(name).length) return [];
  const base = prBaseline(name, { extraSets: earlierSets });
  const rm = e1rm(w, r);
  const out = [];
  const pct = (v, p) => (p ? Math.round(((v - p) / p) * 1000) / 10 : null);
  if (base.maxWeight && w > base.maxWeight.value) {
    out.push({ type: 'weight', value: w, prev: base.maxWeight.value, pct: pct(w, base.maxWeight.value), weight: w, reps: r, e1rm: rm });
  }
  const raw = base.repsAtWeight.get(w);
  if (raw && r > raw.reps) {
    out.push({ type: 'reps', value: r, prev: raw.reps, pct: null, weight: w, reps: r, e1rm: rm });
  }
  if (base.e1rm && rm > base.e1rm.value + 0.05) {
    out.push({ type: 'e1rm', value: rm, prev: base.e1rm.value, pct: pct(rm, base.e1rm.value), weight: w, reps: r, e1rm: rm });
  }
  return out;
}

/** Rekorde einer abgeschlossenen Session gegenüber allen früheren (für Zusammenfassung & Session-Detail) */
export function sessionPRs(session) {
  const out = [];
  for (const e of session.entries) {
    const base = prBaseline(e.name, { before: session.startedAt });
    if (!base.maxWeight && !base.e1rm) continue; // erste Einheit dieser Übung: alles wäre "Rekord"
    let bestW = null, bestRM = null;
    for (const s of e.sets) {
      const w = Number(s.weight), r = Number(s.reps);
      if (!w || !r) continue;
      if (!bestW || w > bestW.w) bestW = { w, r };
      const rm = e1rm(w, r);
      if (!bestRM || rm > bestRM.rm) bestRM = { rm, w, r };
    }
    if (bestW && (!base.maxWeight || bestW.w > base.maxWeight.value)) out.push({ name: e.name, type: 'weight', value: bestW.w, prev: base.maxWeight?.value ?? null, weight: bestW.w, reps: bestW.r });
    else if (bestRM && base.e1rm && bestRM.rm > base.e1rm.value + 0.05) out.push({ name: e.name, type: 'e1rm', value: bestRM.rm, prev: base.e1rm.value, weight: bestRM.w, reps: bestRM.r });
    const vol = e.sets.reduce((a, s) => a + setVolume(s), 0);
    if (vol > 0 && base.sessionVolume && vol > base.sessionVolume.value) out.push({ name: e.name, type: 'volume', value: vol, prev: base.sessionVolume.value });
  }
  return out;
}

// ---------- Aufwärmsätze ----------

/**
 * Aufwärmsätze aus dem Arbeitsgewicht: 40 % × 10, 60 % × 6, 80 % × 3 (auf den Gewichtsschritt gerundet).
 * Unter 20 kg Arbeitsgewicht nur ein leichter Satz.
 */
export function warmupSets(workWeight, step = 2.5) {
  const w = Number(workWeight);
  if (!w || w < 20) return w ? [{ weight: roundToStep(w * 0.5, step), reps: 10 }] : [];
  const round = (x) => Math.max(step, roundToStep(x, step));
  const out = [
    { weight: round(w * 0.4), reps: 10 },
    { weight: round(w * 0.6), reps: 6 },
    { weight: round(w * 0.8), reps: 3 },
  ];
  // Doppelte Stufen (bei kleinen Gewichten) zusammenfassen
  return out.filter((s, i) => i === 0 || s.weight > out[i - 1].weight);
}

// ---------- Scheibenrechner ----------

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

/**
 * Scheiben pro Seite für ein Zielgewicht.
 * @returns {{ perSide:number[], total:number, exact:boolean, remainder:number }}
 */
export function platesFor(target, barWeight = 20, plates = PLATES) {
  const t = Number(target) || 0;
  let rest = Math.max(0, (t - barWeight) / 2);
  const perSide = [];
  for (const p of plates) {
    while (rest >= p - 1e-9) { perSide.push(p); rest -= p; }
  }
  const loaded = barWeight + perSide.reduce((a, p) => a + p, 0) * 2;
  return { perSide, total: loaded, exact: Math.abs(loaded - t) < 1e-9, remainder: Math.round((t - loaded) * 100) / 100 };
}

/** Prozent-Tabelle aus dem e1RM (50–100 %), auf den Gewichtsschritt gerundet */
export function percentTable(e1rmValue, step = 2.5) {
  const rows = [];
  // Abrunden auf den Gewichtsschritt – lieber etwas leichter als zu schwer
  for (let p = 100; p >= 50; p -= 5) rows.push({ pct: p, weight: Math.floor((e1rmValue * p / 100) / step) * step, reps: repsAtPct(p) });
  return rows;
}
/** Grobe Wiederholungszahl, die bei x % des 1RM typischerweise möglich ist (Epley umgestellt) */
function repsAtPct(pct) {
  if (pct >= 100) return 1;
  return Math.max(1, Math.round((100 / pct - 1) * 30));
}

export const PR_LABELS = {
  weight: 'Höchstes Gewicht',
  reps: 'Meiste Wiederholungen bei diesem Gewicht',
  e1rm: 'Bestes geschätztes 1RM',
  volume: 'Höchstes Volumen in einer Einheit',
};
