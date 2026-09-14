// Meilensteine: aus dem Verlauf berechnet, nie „verliehen“ – wer die Daten hat, hat den Meilenstein.
import { getSessions, getSettings, updateSettings, sessionVolume, getBodyLog, e1rm } from './store.js';
import { sessionPRs } from './progression.js';
import { weekKey, fmtNum } from './util.js';

/** [id, Titel, Beschreibung, Prüfung(ctx) → Zeitstempel des Erreichens oder null] */
const DEFS = [
  ['w1', 'Erstes Workout', 'Der Anfang ist gemacht.', c => c.sessions[0]?.startedAt ?? null],
  ['w10', '10 Workouts', 'Zehnmal im Studio gewesen und alles protokolliert.', c => c.sessions[9]?.startedAt ?? null],
  ['w25', '25 Workouts', 'Routine.', c => c.sessions[24]?.startedAt ?? null],
  ['w50', '50 Workouts', 'Ein halbes Hundert.', c => c.sessions[49]?.startedAt ?? null],
  ['w100', '100 Workouts', 'Dreistellig – das machen die wenigsten.', c => c.sessions[99]?.startedAt ?? null],
  ['w250', '250 Workouts', 'Das ist ein Lebensstil.', c => c.sessions[249]?.startedAt ?? null],
  ['s4', '4 Wochen in Folge', 'Vier Wochen ohne Aussetzer.', c => c.streakReached(4)],
  ['s8', '8 Wochen in Folge', 'Zwei Monate am Stück.', c => c.streakReached(8)],
  ['s12', '12 Wochen in Folge', 'Ein Quartal durchgezogen.', c => c.streakReached(12)],
  ['s26', 'Halbes Jahr in Folge', '26 Wochen, jede Woche trainiert.', c => c.streakReached(26)],
  ['s52', 'Ein Jahr in Folge', '52 Wochen ohne Lücke.', c => c.streakReached(52)],
  ['v5', '5 Tonnen in einer Einheit', 'Volumen ≥ 5.000 kg in einem Workout.', c => c.firstSession(s => sessionVolume(s) >= 5000)],
  ['v10', '10 Tonnen in einer Einheit', 'Volumen ≥ 10.000 kg in einem Workout.', c => c.firstSession(s => sessionVolume(s) >= 10000)],
  ['t100', '100 Tonnen gesamt', 'Kumuliertes Volumen über alle Workouts.', c => c.totalVolumeReached(100000)],
  ['t500', '500 Tonnen gesamt', 'Ein halber Güterzug.', c => c.totalVolumeReached(500000)],
  ['t1000', '1.000 Tonnen gesamt', 'Vierstellig in Tonnen.', c => c.totalVolumeReached(1000000)],
  ['pr1', 'Erster Rekord', 'Zum ersten Mal eine alte Bestleistung geschlagen.', c => c.prCountReached(1)],
  ['pr10', '10 Rekorde', 'Zehn persönliche Bestleistungen.', c => c.prCountReached(10)],
  ['pr50', '50 Rekorde', 'Fortschritt ist dein Standard.', c => c.prCountReached(50)],
  ['kg100', '100 kg bewegt', 'Erster Satz mit mindestens 100 kg.', c => c.firstSession(s => s.entries.some(e => e.sets.some(x => Number(x.weight) >= 100)))],
  ['kg140', '140 kg bewegt', 'Erster Satz mit mindestens 140 kg.', c => c.firstSession(s => s.entries.some(e => e.sets.some(x => Number(x.weight) >= 140)))],
  ['rm100', 'e1RM über 100 kg', 'Geschätztes Maximum dreistellig.', c => c.firstSession(s => s.entries.some(e => e.sets.some(x => e1rm(x.weight, x.reps) >= 100)))],
  ['body10', '10 Wiegungen', 'Körpergewicht regelmäßig im Blick.', c => c.body[9]?.date ?? null],
];

function context() {
  const sessions = getSessions();
  const body = getBodyLog();
  let streakCache = null;
  const streakReached = (n) => {
    if (!streakCache) {
      // Wochen in aufsteigender Reihenfolge; Serie zählt zusammenhängende Wochen mit Training
      const weeks = [...new Set(sessions.map(s => weekKey(s.startedAt)))].sort((a, b) => a - b);
      const reachedAt = {};
      let run = 0, prev = null;
      for (const wk of weeks) {
        run = prev != null && wk - prev === 7 * 86400000 ? run + 1 : 1;
        prev = wk;
        if (!reachedAt[run]) reachedAt[run] = sessions.filter(s => weekKey(s.startedAt) === wk).pop().startedAt;
      }
      streakCache = reachedAt;
    }
    // erreicht, sobald irgendeine Serie mindestens n lang war → frühester Zeitpunkt der Länge n
    const hits = Object.entries(streakCache).filter(([len]) => Number(len) >= n).map(([, t]) => t);
    return hits.length ? Math.min(...hits) : null;
  };
  const firstSession = (pred) => sessions.find(pred)?.startedAt ?? null;
  const totalVolumeReached = (v) => { let sum = 0; for (const s of sessions) { sum += sessionVolume(s); if (sum >= v) return s.startedAt; } return null; };
  let prCache = null;
  const prCountReached = (n) => {
    if (!prCache) { prCache = []; for (const s of sessions) { const k = sessionPRs(s).length; for (let i = 0; i < k; i++) prCache.push(s.startedAt); } }
    return prCache[n - 1] ?? null;
  };
  return { sessions, body, streakReached, firstSession, totalVolumeReached, prCountReached };
}

/** Alle Meilensteine mit Erreicht-Zeitpunkt (oder null) */
export function allMilestones() {
  const c = context();
  return DEFS.map(([id, title, desc, check]) => ({ id, title, desc, at: check(c) }));
}

/** Meilensteine, die genau mit dieser Session erreicht wurden */
export function milestonesReachedAt(session) {
  return allMilestones().filter(m => m.at === session.startedAt);
}

/** Erreichte, aber noch nicht gezeigte Meilensteine; markiert sie als gezeigt */
export function newMilestones() {
  const seen = new Set(getSettings().milestonesSeen || []);
  const fresh = allMilestones().filter(m => m.at && !seen.has(m.id));
  if (fresh.length) updateSettings({ milestonesSeen: [...seen, ...fresh.map(m => m.id)] });
  return fresh;
}

export function fmtVolumeShort(v) { return v >= 1000 ? `${fmtNum(v / 1000)} t` : `${fmtNum(v)} kg`; }
