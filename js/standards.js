// Kraftstandards: geschätztes 1RM relativ zum Körpergewicht, eingeordnet in fünf Stufen.
// Grobe Richtwerte (Männer); Frauen werden mit Faktor 0,68 skaliert. Kein Ersatz für einen Trainer.
import { getBodyLog, getSettings } from './store.js';
import { normalizeExerciseName } from './exercise-db.js';

export const LEVELS = ['Einsteiger', 'Anfänger', 'Fortgeschritten', 'Stark', 'Elite'];

// [Muster, Vielfache des Körpergewichts je Stufe]
const TABLE = [
  [/bankdrücken|bench press|flachbank/, [0.5, 0.75, 1.0, 1.25, 1.5]],
  [/schrägbank|incline/, [0.4, 0.65, 0.9, 1.1, 1.35]],
  [/kniebeuge|squat/, [0.75, 1.0, 1.5, 2.0, 2.5]],
  [/kreuzheben|deadlift/, [1.0, 1.25, 1.75, 2.25, 2.75]],
  [/rumänisch|romanian|rdl/, [0.75, 1.0, 1.4, 1.8, 2.2]],
  [/schulterdrücken|overhead press|military|shoulder press/, [0.35, 0.5, 0.75, 1.0, 1.2]],
  [/langhantelrudern|barbell row|rudern langhantel/, [0.5, 0.75, 1.0, 1.25, 1.5]],
  [/beinpresse|leg press/, [1.0, 1.5, 2.25, 3.0, 3.75]],
  [/brustpresse|chest press/, [0.45, 0.7, 0.95, 1.2, 1.45]],
  [/latzug|lat pulldown|latziehen/, [0.45, 0.65, 0.9, 1.1, 1.3]],
  [/hip thrust/, [0.75, 1.25, 1.75, 2.25, 2.75]],
  [/curl/, [0.2, 0.3, 0.45, 0.6, 0.75]],
];

/** Aktuelles Körpergewicht aus dem Körperlog (letzter Eintrag mit Gewicht) */
export function currentBodyweight() {
  const log = getBodyLog();
  for (let i = log.length - 1; i >= 0; i--) if (log[i].weight != null) return Number(log[i].weight);
  return null;
}

/**
 * @returns {null | { level:number, levelName:string, ratio:number, bodyweight:number, next:{name:string, weight:number, missing:number}|null, thresholds:number[] }}
 */
export function strengthStandard(name, e1rmValue) {
  const n = normalizeExerciseName(name);
  const row = TABLE.find(([re]) => re.test(n));
  if (!row || !e1rmValue) return null;
  const bw = currentBodyweight();
  if (!bw) return { needsBodyweight: true };
  const f = (getSettings().sex || 'm') === 'f' ? 0.68 : 1;
  const thresholds = row[1].map(x => x * f * bw);
  const ratio = e1rmValue / bw;
  let level = -1;
  thresholds.forEach((t, i) => { if (e1rmValue >= t) level = i; });
  const next = level < thresholds.length - 1 ? { name: LEVELS[level + 1], weight: thresholds[level + 1], missing: thresholds[level + 1] - e1rmValue } : null;
  return { level, levelName: level < 0 ? 'unter Einsteiger' : LEVELS[level], ratio, bodyweight: bw, next, thresholds };
}
