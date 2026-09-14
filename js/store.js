// Zentraler State + Persistenz (localStorage)
import { uid, normalizeName, repsToNumber } from './util.js';
import { recommend, weightStepFor } from './progression.js';

const KEY = 'hantel.v1';

const DEFAULT_SETTINGS = {
  defaultRestSec: 90,
  autoRestTimer: true,
  sound: true,
  vibrate: true,
  wakeLock: true,
  unit: 'kg',
  apiKey: '',
  aiModel: 'claude-opus-5',
  theme: 'dark',        // 'dark' | 'light' | 'system'
  weeklyGoal: 4,        // Trainings pro Woche (Wochenring auf dem Startbildschirm)
  barWeight: 20,        // Standard-Stangengewicht für den Scheibenrechner
  keepAliveAudio: true, // Pausentimer bei gesperrtem Bildschirm (lautloses Audio)
  warmupSets: true,     // Aufwärmsätze im Training vorschlagen
  name: '',             // Vorname für die Begrüßung auf dem Startbildschirm
  lastBackupAt: 0,      // Zeitpunkt der letzten Sicherung (Export)
  lastBackupSessions: 0, // Anzahl Workouts zum Zeitpunkt der letzten Sicherung (Erinnerung alle 10)
};

const state = {
  plans: [],
  sessions: [],
  activeWorkout: null,
  settings: { ...DEFAULT_SETTINGS },
  exerciseSettings: {}, // je Übung (normalisierter Name): { setup, barWeight }
  body: [],             // Körpergewicht/Maße: { id, date, weight, waist, chest, arm, thigh, note }
};

const listeners = new Set();

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { for (const fn of listeners) fn(what); }

// ---------- Laden / Speichern ----------

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.plans = data.plans || [];
      state.sessions = data.sessions || [];
      state.activeWorkout = data.activeWorkout || null;
      state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      state.exerciseSettings = data.exerciseSettings || {};
      state.body = data.body || [];
    }
  } catch (e) {
    console.error('Konnte Daten nicht laden', e);
  }
  return state;
}

let saveTimer = null;
export function save(immediate = false) {
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        plans: state.plans,
        sessions: state.sessions,
        activeWorkout: state.activeWorkout,
        settings: state.settings,
        exerciseSettings: state.exerciseSettings,
        body: state.body,
        savedAt: Date.now(),
      }));
    } catch (e) {
      console.error('Speichern fehlgeschlagen', e);
    }
  };
  clearTimeout(saveTimer);
  if (immediate) write(); else saveTimer = setTimeout(write, 120);
}

export function getState() { return state; }
export function getSettings() { return state.settings; }

export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  save();
  emit('settings');
}

// ---------- Pläne ----------

export function newExercise(partial = {}) {
  return {
    id: uid(),
    name: '',
    sets: 3,
    reps: '10',
    weight: null,
    restSec: null, // null = Standard aus Einstellungen
    weightStep: null, // null = automatisch nach Übungstyp (2 / 2,5 / 5 kg)
    note: '',
    ...partial,
  };
}

export function newPlan(partial = {}) {
  return {
    id: uid(),
    name: 'Neuer Plan',
    note: '',
    exercises: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

export function getPlans() { return state.plans; }
export function getPlan(id) { return state.plans.find(p => p.id === id) || null; }

export function addPlan(plan) {
  state.plans.push(plan);
  save();
  emit('plans');
  return plan;
}

export function updatePlan(id, patch) {
  const p = getPlan(id);
  if (!p) return null;
  Object.assign(p, patch, { updatedAt: Date.now() });
  save();
  emit('plans');
  return p;
}

export function deletePlan(id) {
  state.plans = state.plans.filter(p => p.id !== id);
  save();
  emit('plans');
}

export function duplicatePlan(id) {
  const p = getPlan(id);
  if (!p) return null;
  const copy = newPlan({
    name: p.name + ' (Kopie)',
    note: p.note,
    exercises: p.exercises.map(e => ({ ...e, id: uid() })),
  });
  return addPlan(copy);
}

export function movePlan(id, dir) {
  const i = state.plans.findIndex(p => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.plans.length) return;
  [state.plans[i], state.plans[j]] = [state.plans[j], state.plans[i]];
  save();
  emit('plans');
}

// ---------- Workout ----------

export function getActiveWorkout() { return state.activeWorkout; }

export function startWorkout(planId) {
  const plan = getPlan(planId);
  if (!plan) return null;
  const entries = plan.exercises.map(ex => {
    const rec = recommend(ex);
    const last = rec.last?.entry || null;
    const n = Math.max(1, ex.sets || 1);
    const sets = [];
    for (let i = 0; i < n; i++) {
      const prev = last?.sets[i] || last?.sets[last.sets.length - 1] || null;
      // Gewicht: Empfehlung (Double Progression); Wdh: bei Gewichtserhöhung unteres Ende des Bereichs, sonst wie zuletzt
      const weight = rec.weight ?? prev?.weight ?? ex.weight ?? null;
      const reps = rec.status === 'increase'
        ? (rec.reps?.min ?? repsToNumber(ex.reps) ?? null)
        : (prev?.reps ?? rec.reps?.min ?? repsToNumber(ex.reps) ?? null);
      sets.push({ reps, weight, done: false });
    }
    return {
      exerciseId: ex.id,
      name: ex.name,
      targetSets: ex.sets,
      targetReps: ex.reps,
      targetWeight: ex.weight,
      weightStep: weightStepFor(ex),
      restSec: ex.restSec || state.settings.defaultRestSec,
      note: ex.note || '',
      superset: !!ex.superset, // bildet mit der nächsten Übung einen Supersatz
      warmup: null,            // Aufwärmsätze werden beim ersten Öffnen erzeugt
      sets,
    };
  });
  state.activeWorkout = {
    id: uid(),
    planId: plan.id,
    planName: plan.name,
    startedAt: Date.now(),
    endedAt: null,
    currentIndex: 0,
    entries,
    note: '',
  };
  save(true);
  emit('workout');
  return state.activeWorkout;
}

export function touchWorkout() { save(); }

export function finishWorkout(note = '') {
  const w = state.activeWorkout;
  if (!w) return null;
  w.endedAt = Date.now();
  w.durationSec = Math.round((w.endedAt - w.startedAt) / 1000);
  w.note = note;
  // Nur Übungen mit mindestens einem abgehakten Satz behalten
  w.entries = w.entries
    .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
    .filter(e => e.sets.length > 0);
  state.sessions.push(w);
  state.sessions.sort((a, b) => a.startedAt - b.startedAt);
  state.activeWorkout = null;
  save(true);
  emit('sessions');
  return w;
}

export function cancelWorkout() {
  state.activeWorkout = null;
  save(true);
  emit('workout');
}

// ---------- Verlauf / Statistik ----------

export function getSessions() { return state.sessions; }
export function getSession(id) { return state.sessions.find(s => s.id === id) || null; }

export function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  save();
  emit('sessions');
}

export function updateSession(id, patch) {
  const s = getSession(id);
  if (!s) return null;
  Object.assign(s, patch);
  save();
  emit('sessions');
  return s;
}

/** Letzte protokollierte Leistung für eine Übung (per Name) */
export function lastPerformance(name) {
  const key = normalizeName(name);
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const e = state.sessions[i].entries.find(x => normalizeName(x.name) === key);
    if (e && e.sets.length) return { ...e, date: state.sessions[i].startedAt };
  }
  return null;
}

/** Alle Sessions-Einträge einer Übung, chronologisch */
export function exerciseHistory(name) {
  const key = normalizeName(name);
  const out = [];
  for (const s of state.sessions) {
    const e = s.entries.find(x => normalizeName(x.name) === key);
    if (e && e.sets.length) out.push({ session: s, entry: e });
  }
  return out;
}

export function setVolume(set) {
  return (Number(set.weight) || 0) * (Number(set.reps) || 0);
}
export function entryVolume(entry) { return entry.sets.reduce((a, s) => a + setVolume(s), 0); }
export function sessionVolume(session) { return session.entries.reduce((a, e) => a + entryVolume(e), 0); }

/** Geschätztes 1RM (Epley) */
export function e1rm(weight, reps) {
  const w = Number(weight) || 0, r = Number(reps) || 0;
  if (!w || !r) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

export function entryBest(entry) {
  let maxW = 0, maxRM = 0, bestSet = null;
  for (const s of entry.sets) {
    const w = Number(s.weight) || 0;
    const rm = e1rm(s.weight, s.reps);
    if (w > maxW) maxW = w;
    if (rm > maxRM) { maxRM = rm; bestSet = s; }
  }
  return { maxWeight: maxW, e1rm: maxRM, bestSet, volume: entryVolume(entry) };
}

/** Übersicht aller je trainierten Übungen mit Bestwerten */
export function exerciseIndex() {
  const map = new Map();
  for (const s of state.sessions) {
    for (const e of s.entries) {
      if (!e.sets.length) continue;
      const key = normalizeName(e.name);
      const b = entryBest(e);
      const cur = map.get(key) || { name: e.name, count: 0, maxWeight: 0, e1rm: 0, lastDate: 0 };
      cur.count++;
      cur.maxWeight = Math.max(cur.maxWeight, b.maxWeight);
      cur.e1rm = Math.max(cur.e1rm, b.e1rm);
      cur.lastDate = Math.max(cur.lastDate, s.startedAt);
      cur.name = e.name;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.lastDate - a.lastDate);
}

/** Neue Bestleistungen in einer Session gegenüber allen früheren */
export function detectPRs(session) {
  const prs = [];
  const before = state.sessions.filter(s => s.startedAt < session.startedAt && s.id !== session.id);
  for (const e of session.entries) {
    const key = normalizeName(e.name);
    let prevMax = 0, prevRM = 0;
    for (const s of before) {
      const pe = s.entries.find(x => normalizeName(x.name) === key);
      if (!pe) continue;
      const b = entryBest(pe);
      prevMax = Math.max(prevMax, b.maxWeight);
      prevRM = Math.max(prevRM, b.e1rm);
    }
    const b = entryBest(e);
    if (b.maxWeight > 0 && b.maxWeight > prevMax) prs.push({ name: e.name, type: 'weight', value: b.maxWeight, prev: prevMax });
    else if (b.e1rm > 0 && b.e1rm > prevRM && prevRM > 0) prs.push({ name: e.name, type: 'e1rm', value: b.e1rm, prev: prevRM });
  }
  return prs;
}

// ---------- Übungs-Einstellungen (Maschine, Stange) ----------

export function getExerciseSettings(name) {
  return state.exerciseSettings[normalizeName(name)] || {};
}

export function updateExerciseSettings(name, patch) {
  const key = normalizeName(name);
  state.exerciseSettings[key] = { ...(state.exerciseSettings[key] || {}), ...patch };
  save();
  return state.exerciseSettings[key];
}

// ---------- Körpergewicht / Maße ----------

export function getBodyLog() { return state.body; }

export function addBodyEntry(entry) {
  const e = { id: uid(), date: Date.now(), ...entry };
  state.body.push(e);
  state.body.sort((a, b) => a.date - b.date);
  save();
  emit('body');
  return e;
}

export function deleteBodyEntry(id) {
  state.body = state.body.filter(e => e.id !== id);
  save();
  emit('body');
}

// ---------- Export / Import ----------

export function exportJSON() {
  return JSON.stringify({
    app: 'hantel',
    version: 2,
    exportedAt: new Date().toISOString(),
    plans: state.plans,
    sessions: state.sessions,
    settings: { ...state.settings, apiKey: '' }, // API-Key nie exportieren
    exerciseSettings: state.exerciseSettings,
    body: state.body,
  }, null, 2);
}

export function importJSON(text, { merge = true } = {}) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'hantel') throw new Error('Das ist keine Hantel-Sicherung.');
  if (!merge) {
    state.plans = [];
    state.sessions = [];
  }
  const planIds = new Set(state.plans.map(p => p.id));
  const sessionIds = new Set(state.sessions.map(s => s.id));
  let plans = 0, sessions = 0;
  for (const p of data.plans || []) if (!planIds.has(p.id)) { state.plans.push(p); plans++; }
  for (const s of data.sessions || []) if (!sessionIds.has(s.id)) { state.sessions.push(s); sessions++; }
  state.sessions.sort((a, b) => a.startedAt - b.startedAt);
  if (data.settings) {
    const { apiKey, ...rest } = data.settings;
    Object.assign(state.settings, rest);
  }
  if (data.exerciseSettings) Object.assign(state.exerciseSettings, data.exerciseSettings);
  if (Array.isArray(data.body)) {
    const ids = new Set(state.body.map(b => b.id));
    for (const b of data.body) if (!ids.has(b.id)) state.body.push(b);
    state.body.sort((a, b) => a.date - b.date);
  }
  save(true);
  emit('plans'); emit('sessions'); emit('settings'); emit('body');
  return { plans, sessions };
}

export function resetAll() {
  state.plans = [];
  state.sessions = [];
  state.activeWorkout = null;
  state.exerciseSettings = {};
  state.body = [];
  state.settings = { ...DEFAULT_SETTINGS };
  save(true);
  emit('plans'); emit('sessions'); emit('settings'); emit('workout');
}
