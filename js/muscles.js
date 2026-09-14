// Muskelgruppen: Taxonomie, Zuordnung von Übungen, Satz-Auswertung, Körperkarte (SVG)
import { findExercise, normalizeExerciseName } from './exercise-db.js';
import { weekKey } from './util.js';
import { getSettings, getCustomExercises } from './store.js';

export const MUSCLES = [
  ['chest', 'Brust'],
  ['back', 'Rücken'],
  ['front_delt', 'Vordere Schulter'],
  ['side_delt', 'Seitliche Schulter'],
  ['rear_delt', 'Hintere Schulter'],
  ['biceps', 'Bizeps'],
  ['triceps', 'Trizeps'],
  ['quads', 'Quadrizeps'],
  ['hamstrings', 'Beinbeuger'],
  ['glutes', 'Gesäß'],
  ['calves', 'Waden'],
  ['abs', 'Bauch'],
];
export const MUSCLE_NAME = Object.fromEntries(MUSCLES);

/** Zuordnung nach Stichworten für Übungen, die nicht in der Bibliothek sind */
const RULES = [
  [/seitheben|lateral raise|side raise/, ['side_delt'], []],
  [/facepull|face pull|reverse.?fly|rear delt|butterfly reverse|hintere schulter/, ['rear_delt'], ['back']],
  [/schulterdrücken|shoulder press|overhead press|military|arnold|frontheben|front raise/, ['front_delt'], ['triceps', 'side_delt']],
  [/dips?\b/, ['chest', 'triceps'], ['front_delt']],
  [/bankdrücken|bench|brust|chest|fly|flys|fliegende|butterfly|pec|liegestütz|push.?up/, ['chest'], ['triceps', 'front_delt']],
  [/klimmz|pull.?up|chin.?up|latzug|lat pull|pulldown|rudern|row\b|rows|rücken|back|hyperext|good morning/, ['back'], ['biceps', 'rear_delt']],
  [/rumänisch|romanian|rdl|kreuzheben|deadlift|beinbeuger|leg curl|hamstring|nordic/, ['hamstrings'], ['glutes', 'back']],
  [/hip thrust|glute|gesäß|po\b|hüftheben|kickback|abduktor/, ['glutes'], ['hamstrings']],
  [/kniebeuge|squat|beinpresse|leg press|beinstrecker|leg extension|ausfallschritt|lunge|bulgarian|hack|step.?up/, ['quads'], ['glutes']],
  [/waden|calf|calves/, ['calves'], []],
  [/curl|bizeps|biceps|hammer/, ['biceps'], []],
  [/trizeps|triceps|pushdown|skull|french|überkopf|kickback|enge?s? bankdrücken|close.?grip/, ['triceps'], []],
  [/crunch|plank|bauch|abs|core|beinheben|leg raise|situp|sit.?up|russian|hollow|wood/, ['abs'], []],
];

/** Eigene Übung zum Namen (exakt oder über Aliase), sonst null */
export function findCustomExercise(name) {
  const n = normalizeExerciseName(name);
  if (!n) return null;
  return getCustomExercises().find(c => normalizeExerciseName(c.name) === n || (c.aliases || []).some(a => normalizeExerciseName(a) === n)) || null;
}

/** @returns {{primary:string[], secondary:string[], source:'custom'|'library'|'rule'|'none'}} */
export function musclesFor(name) {
  const c = findCustomExercise(name);
  if (c) return { primary: c.primary || [], secondary: c.secondary || [], source: 'custom' };
  const e = findExercise(name);
  if (e && e.primary) return { primary: e.primary, secondary: e.secondary || [], source: 'library' };
  const n = normalizeExerciseName(name);
  for (const [re, p, s] of RULES) if (re.test(n)) return { primary: p, secondary: s, source: 'rule' };
  return { primary: [], secondary: [], source: 'none' };
}

/**
 * Sätze pro Muskelgruppe für eine Liste von Sessions (primär 1,0 / sekundär 0,5).
 * @returns {{ totals: Record<string,number>, byExercise: Record<string, Record<string,number>>, unknown: string[] }}
 */
export function muscleSets(sessions) {
  const totals = Object.fromEntries(MUSCLES.map(([k]) => [k, 0]));
  const byExercise = Object.fromEntries(MUSCLES.map(([k]) => [k, {}]));
  const unknown = new Set();
  for (const s of sessions) {
    for (const e of s.entries) {
      const n = e.sets.filter(x => x.done !== false).length;
      if (!n) continue;
      const m = musclesFor(e.name);
      if (m.source === 'none') { unknown.add(e.name); continue; }
      for (const k of m.primary) { totals[k] += n; byExercise[k][e.name] = (byExercise[k][e.name] || 0) + n; }
      for (const k of m.secondary) { totals[k] += n * 0.5; byExercise[k][e.name] = (byExercise[k][e.name] || 0) + n * 0.5; }
    }
  }
  return { totals, byExercise, unknown: [...unknown] };
}

/** Sessions einer Kalenderwoche (Montag-Start), weekStart = weekKey-Zeitstempel */
export function sessionsInWeek(sessions, weekStart) {
  const end = weekStart + 7 * 86400000;
  return sessions.filter(s => s.startedAt >= weekStart && s.startedAt < end);
}

/** Kennzahlen für eine Muskelgruppe: diese Woche, letzte Woche, 4-Wochen-Schnitt, Übungen dieser Woche */
export function muscleWeekStats(sessions, muscle, weekStart) {
  const week = muscleSets(sessionsInWeek(sessions, weekStart));
  const prev = muscleSets(sessionsInWeek(sessions, weekStart - 7 * 86400000));
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += muscleSets(sessionsInWeek(sessions, weekStart - i * 7 * 86400000)).totals[muscle];
  const exercises = Object.entries(week.byExercise[muscle] || {}).sort((a, b) => b[1] - a[1]);
  return { thisWeek: week.totals[muscle], lastWeek: prev.totals[muscle], avg4: sum / 4, exercises };
}

// ---------- Farben ----------

/** Intensität 0..1 → Farbe von Grün (leicht) über Gelb/Orange nach Rot (intensiv) */
export function intensityColor(ratio) {
  if (ratio <= 0) return null;
  const r = Math.min(1, ratio);
  const hue = 120 - 120 * r; // 120 = grün, 0 = rot
  return `hsl(${hue.toFixed(0)}, 85%, ${(52 - 6 * r).toFixed(0)}%)`;
}

/** Wochenziel je Muskelgruppe (Sätze) aus den Einstellungen */
export function volumeTarget() {
  const s = getSettings();
  const min = Math.max(1, s.volumeMin || 10), max = Math.max(min, s.volumeMax || 20);
  return { min, max };
}

/** 'under' | 'in' | 'over' relativ zum Wochenziel */
export function volumeStatus(sets) {
  const { min, max } = volumeTarget();
  return sets < min ? 'under' : sets > max ? 'over' : 'in';
}

/** Referenz: Obergrenze des Wochenziels = volle Intensität; im Session-Modus 6 Sätze */
export function ratioFor(sets, mode = 'week') {
  const ref = mode === 'session' ? 6 : volumeTarget().max;
  return sets / ref;
}

// ---------- Körperkarte ----------

const W = 200, H = 420;

// Rechte Körperhälfte (x > 100) – linke wird gespiegelt. Vorderseite.
const FRONT = {
  chest: 'M100 90 C118 86 138 88 146 96 C150 110 142 128 122 136 C112 139 103 139 100 136 Z',
  front_delt: 'M144 84 C154 80 164 86 166 98 C162 104 154 106 148 100 C148 94 146 88 144 84 Z',
  side_delt: 'M158 84 C168 86 176 98 174 112 C170 118 162 118 158 112 C161 104 160 94 158 84 Z',
  biceps: 'M152 118 C164 120 172 132 170 160 C166 170 158 172 152 166 C149 150 149 132 152 118 Z',
  abs: 'M100 142 C110 140 118 146 119 154 L119 214 C116 224 108 230 100 230 Z',
  obliques: 'M121 150 C130 150 138 154 139 164 L136 212 C130 218 124 218 121 214 Z',
  quads: 'M104 234 C122 228 138 236 140 256 C142 294 138 318 130 330 C120 336 108 334 104 326 C99 296 99 258 104 234 Z',
  calves: 'M109 344 C122 340 132 346 132 362 C132 386 128 402 121 408 C112 408 108 398 108 384 C108 368 108 356 109 344 Z',
};
// Rückseite
const BACK = {
  traps: 'M100 74 C114 72 128 80 140 92 C130 102 116 106 100 106 Z',
  lats: 'M102 110 C120 108 138 108 144 118 C146 142 138 168 122 184 C114 190 105 190 100 186 L100 112 Z',
  lower_back: 'M100 188 C108 188 116 192 118 202 L116 226 C110 230 104 232 100 232 Z',
  rear_delt: 'M142 84 C154 82 166 92 168 108 C162 114 154 114 148 108 C146 100 144 92 142 84 Z',
  side_delt_b: 'M160 88 C170 92 176 104 174 116 C170 120 164 120 160 116 C162 106 161 96 160 88 Z',
  triceps: 'M152 118 C164 120 172 132 170 160 C166 170 158 172 152 166 C149 150 149 132 152 118 Z',
  glutes: 'M100 230 C118 226 136 232 140 250 C140 268 132 282 116 284 C106 284 100 280 100 274 Z',
  hamstrings: 'M104 288 C122 282 138 288 140 306 C142 322 138 336 130 342 C120 344 108 342 104 334 C99 316 99 300 104 288 Z',
  calves: 'M109 350 C122 346 134 352 134 368 C134 390 128 404 120 410 C111 408 107 398 107 382 C107 368 108 358 109 350 Z',
};
const REGION_MUSCLE = {
  chest: 'chest', front_delt: 'front_delt', side_delt: 'side_delt', biceps: 'biceps', abs: 'abs', obliques: 'abs', quads: 'quads', calves: 'calves',
  traps: 'back', lats: 'back', lower_back: 'back', rear_delt: 'rear_delt', side_delt_b: 'side_delt', triceps: 'triceps', glutes: 'glutes', hamstrings: 'hamstrings',
};

function silhouette() {
  // Kopf, Hals, Rumpf, Arme, Beine als weiche Formen
  return [
    `<circle class="body-sil" cx="100" cy="36" r="24"/>`,
    `<rect class="body-sil" x="90" y="56" width="20" height="24" rx="6"/>`,
    `<path class="body-sil" d="M64 76 L136 76 C148 76 156 84 155 98 L148 232 C148 240 142 244 134 244 L66 244 C58 244 52 240 52 232 L45 98 C44 84 52 76 64 76 Z"/>`,
    `<circle class="body-sil" cx="152" cy="94" r="17"/>`,
    `<circle class="body-sil" cx="48" cy="94" r="17"/>`,
    `<path class="body-sil body-limb" d="M150 98 L165 164 L170 238"/>`,
    `<path class="body-sil body-limb" d="M50 98 L35 164 L30 238"/>`,
    `<ellipse class="body-sil" cx="171" cy="250" rx="9" ry="14"/>`,
    `<ellipse class="body-sil" cx="29" cy="250" rx="9" ry="14"/>`,
    `<path class="body-sil body-leg" d="M120 236 L124 322 L121 406"/>`,
    `<path class="body-sil body-leg" d="M80 236 L76 322 L79 406"/>`,
    `<ellipse class="body-sil" cx="122" cy="412" rx="14" ry="7"/>`,
    `<ellipse class="body-sil" cx="78" cy="412" rx="14" ry="7"/>`,
  ].join('');
}

/**
 * SVG-Körperkarte.
 * @param {'front'|'back'} side
 * @param {Record<string, number>} sets Sätze pro Muskelgruppe
 * @param {{mode?:'week'|'session', selected?:string}} opts
 */
export function bodyMapSvg(side, sets, opts = {}) {
  const regions = side === 'front' ? FRONT : BACK;
  const parts = [silhouette()];
  let idx = 0;
  for (const [region, d] of Object.entries(regions)) {
    const muscle = REGION_MUSCLE[region];
    const n = sets?.[muscle] || 0;
    // opts.ratios: fertige Intensitäten 0..1 (z.B. Ermüdung) statt Satzzahlen
    const ratio = opts.ratios ? (opts.ratios[muscle] || 0) : ratioFor(n, opts.mode);
    // mono: Akzentfarbe mit Deckkraft nach Intensität (ruhiger, z.B. für kleine Vorschauen) statt Grün→Rot
    const color = opts.mono ? (ratio > 0 ? 'var(--accent)' : null) : intensityColor(ratio);
    const sel = opts.selected === muscle ? ' selected' : '';
    // --i steuert die gestaffelte Einblend-Animation („Aufleuchten“)
    const style = color ? ` style="fill:${color};${opts.mono ? `fill-opacity:${(0.45 + 0.55 * Math.min(1, ratio)).toFixed(2)};` : ''}--i:${idx++}"` : '';
    parts.push(`<path class="muscle${color ? ' active' : ''}${sel}" data-muscle="${muscle}" d="${d}"${style}/>`);
    parts.push(`<path class="muscle${color ? ' active' : ''}${sel}" data-muscle="${muscle}" d="${d}"${style} transform="translate(200 0) scale(-1 1)"/>`);
  }
  if (side === 'front') {
    parts.push(`<path class="muscle-lines" d="M84 158 L116 158 M84 176 L116 176 M84 194 L116 194 M100 142 L100 226"/>`);
  } else {
    parts.push(`<path class="muscle-lines" d="M100 108 L100 232"/>`);
  }
  return `<svg class="bodymap${opts.still ? " still" : ""}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Körperkarte ${side === "front" ? "Vorderseite" : "Rückseite"}">${parts.join("")}</svg>`;
}

/** Wochenstart (Montag 0:00) der Woche, in der ts liegt */
export function weekStartOf(ts) { return weekKey(ts); }
