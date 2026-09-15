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

// Rechte Körperhälfte (x > 100) – linke wird gespiegelt. Reihenfolge = Zeichenreihenfolge.
// Regionen ohne Muskelgruppe (Unterarm, Serratus, Adduktoren) sind nur Detail und bleiben neutral.
const FRONT = {
  traps_f: 'M104 60 C116 62 134 66 152 76 C142 80 124 80 110 74 C107 70 105 65 104 60 Z',
  side_delt: 'M164 82 C173 86 179 98 178 114 C175 120 168 122 163 116 C166 104 166 92 164 82 Z',
  front_delt: 'M148 78 C158 74 168 80 171 94 C170 104 162 110 154 106 C150 98 148 88 148 78 Z',
  chest: 'M100 86 C112 82 134 84 149 92 C154 108 148 128 130 138 C116 143 104 142 100 140 Z',
  biceps: 'M153 110 C165 112 175 128 176 152 C175 166 168 174 158 170 C152 152 150 130 153 110 Z',
  forearm_f: 'M160 176 C170 172 182 178 184 194 C188 214 188 232 184 246 C180 250 174 250 171 244 C167 224 162 200 160 176 Z',
  serratus: 'M136 140 C142 144 148 152 146 162 C142 158 138 154 136 148 Z',
  abs: 'M100 146 C110 144 118 150 118 160 L118 218 C114 228 106 234 100 234 Z',
  obliques: 'M120 156 C130 158 138 164 138 176 L134 216 C128 222 122 222 120 218 Z',
  adductors: 'M103 262 C108 258 114 262 114 272 C112 290 108 300 104 306 C102 292 101 276 103 262 Z',
  quads: 'M104 240 C124 234 142 242 145 264 C147 298 143 324 133 336 C121 342 108 340 104 332 C99 300 99 264 104 240 Z',
  calves: 'M109 348 C120 344 134 350 136 366 C138 388 132 402 124 408 C114 408 109 400 108 386 C107 372 107 358 109 348 Z',
};
const BACK = {
  traps: 'M100 60 C112 62 130 70 150 80 C140 92 128 104 114 112 C108 116 104 118 100 118 Z',
  side_delt_b: 'M166 84 C175 90 181 102 179 116 C176 122 169 124 164 118 C167 106 167 94 166 84 Z',
  rear_delt: 'M148 78 C158 76 170 86 173 104 C170 112 162 116 154 110 C150 100 148 88 148 78 Z',
  teres: 'M120 100 C132 100 146 106 148 118 C144 126 132 130 122 124 C118 116 118 106 120 100 Z',
  lats: 'M100 122 C118 120 138 120 147 130 C146 152 138 176 122 192 C112 196 104 196 100 192 Z',
  lower_back: 'M100 196 C106 196 112 200 114 212 L112 236 C108 240 104 242 100 242 Z',
  triceps: 'M153 110 C165 112 175 128 176 152 C175 166 168 174 158 170 C152 152 150 130 153 110 Z',
  forearm_b: 'M160 176 C170 172 182 178 184 194 C188 214 188 232 184 246 C180 250 174 250 171 244 C167 224 162 200 160 176 Z',
  glutes: 'M100 240 C120 236 140 242 144 260 C144 280 134 294 118 296 C107 296 100 292 100 286 Z',
  hamstrings: 'M104 300 C122 294 140 300 143 318 C145 334 141 348 131 354 C121 356 108 354 104 346 C99 328 99 312 104 300 Z',
  calves: 'M108 358 C122 354 136 360 136 376 C136 396 130 408 122 412 C112 410 108 400 107 386 C106 372 106 364 108 358 Z',
};
// Trennlinien für Details (Bauchsegmente, Schlüsselbein, Quadrizeps-Köpfe, Schienbein, Wirbelsäule …)
const LINES = {
  front: 'M108 74 C124 76 140 76 150 80 M100 164 L118 164 M100 182 L118 182 M100 200 L118 200 M100 218 L118 218 M126 246 C132 272 132 304 128 334 M113 300 C112 318 116 330 121 338 M116 352 C118 372 120 392 122 406',
  back: 'M100 122 L100 242 M124 304 C126 322 126 340 122 354 M122 360 C123 376 123 392 121 408 M166 178 C172 200 176 222 178 244',
};
const REGION_MUSCLE = {
  chest: 'chest', front_delt: 'front_delt', side_delt: 'side_delt', biceps: 'biceps', abs: 'abs', obliques: 'abs', quads: 'quads', calves: 'calves', traps_f: 'back',
  traps: 'back', teres: 'back', lats: 'back', lower_back: 'back', rear_delt: 'rear_delt', side_delt_b: 'side_delt', triceps: 'triceps', glutes: 'glutes', hamstrings: 'hamstrings',
  forearm_f: null, forearm_b: null, serratus: null, adductors: null,
};

// Silhouette: Kopf, Hals, dann je Seite Arm (hinten) und Rumpf+Bein (davor); rechte Hälfte wird gespiegelt
const SIL_ARM = 'M150 78 C162 76 176 82 179 98 C183 128 181 156 181 174 C187 202 191 226 189 246 C196 254 198 262 196 270 C195 277 193 283 189 285 C185 288 179 287 177 283 C174 272 174 260 176 248 C171 226 165 202 161 178 C155 152 150 128 147 106 C147 96 148 86 150 78 Z';
const SIL_BODY = 'M100 62 C106 62 112 63 117 66 C132 68 148 72 158 80 C156 96 151 110 147 120 C144 148 141 176 138 200 C139 218 145 230 148 244 C151 282 147 320 141 342 C142 372 140 396 137 408 C144 411 150 417 146 422 L106 422 C104 416 107 410 109 406 C108 380 108 376 110 350 C108 322 106 290 103 262 C102 254 101 250 100 248 Z';
/**
 * SVG-Körperkarte.
 * @param {'front'|'back'} side
 * @param {Record<string, number>} sets Sätze pro Muskelgruppe
 * @param {{mode?:'week'|'session', selected?:string, ratios?:object, mono?:boolean, color?:string, still?:boolean}} opts
 */
export function bodyMapSvg(side, sets, opts = {}) {
  const regions = side === 'front' ? FRONT : BACK;
  // Eine Körperhälfte aufbauen, die andere ist eine gespiegelte Gruppe (die Aufleucht-Animation setzt
  // „transform“ am Pfad – deshalb spiegelt die Gruppe, nicht der Pfad)
  const half = [`<path class="body-sil" d="${SIL_ARM}"/>`, `<path class="body-sil" d="${SIL_BODY}"/>`];
  let idx = 0;
  for (const [region, d] of Object.entries(regions)) {
    const muscle = REGION_MUSCLE[region];
    if (!muscle) { half.push(`<path class="muscle detail" d="${d}"/>`); continue; } // reines Detail, nie eingefärbt
    const n = sets?.[muscle] || 0;
    // opts.ratios: fertige Intensitäten 0..1 (z.B. Ermüdung) statt Satzzahlen
    const ratio = opts.ratios ? (opts.ratios[muscle] || 0) : ratioFor(n, opts.mode);
    // mono: Akzentfarbe mit Deckkraft nach Intensität (ruhiger, z.B. für kleine Vorschauen) statt Grün→Rot
    const color = opts.mono ? (ratio > 0 ? (opts.color || 'var(--accent)') : null) : intensityColor(ratio);
    const sel = opts.selected === muscle ? ' selected' : '';
    // --i steuert die gestaffelte Einblend-Animation („Aufleuchten“)
    const style = color ? ` style="fill:${color};${opts.mono ? `fill-opacity:${(0.45 + 0.55 * Math.min(1, ratio)).toFixed(2)};` : ''}--i:${idx++}"` : '';
    half.push(`<path class="muscle${color ? ' active' : ''}${sel}" data-muscle="${muscle}" d="${d}"${style}/>`);
  }
  half.push(`<path class="muscle-lines" d="${LINES[side]}"/>`);
  const h = half.join('');
  const parts = [
    `<path class="body-sil head" d="M100 4 C114 4 123 16 123 32 C123 46 113 58 100 60 C87 58 77 46 77 32 C77 16 86 4 100 4 Z"/><path class="body-sil" d="M89 50 L111 50 L114 70 L86 70 Z"/>`,
    `<g>${h}</g><g transform="translate(200 0) scale(-1 1)">${h}</g>`,
  ];
  return `<svg class="bodymap${opts.still ? " still" : ""}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Körperkarte ${side === "front" ? "Vorderseite" : "Rückseite"}">${parts.join("")}</svg>`;
}

/** Wochenstart (Montag 0:00) der Woche, in der ts liegt */
export function weekStartOf(ts) { return weekKey(ts); }
