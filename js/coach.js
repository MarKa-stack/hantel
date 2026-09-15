// Wöchentlicher KI-Coach: fasst die letzten vier Wochen kompakt zusammen (nur Zahlen, keine Rohdaten),
// schickt sie an die Aufgabe 'coach' (ai-tasks.js) und merkt sich den Bericht in den Einstellungen.
import { getSessions, getSettings, updateSettings, getPlans, sessionVolume, exerciseHistory, entryBest, deloadActive, getBodyLog } from './store.js';
import { weekKey, isoWeek } from './util.js';
import { plateauFor, sessionPRs, workingWeight, fmtKg } from './progression.js';
import { muscleSets, MUSCLE_NAME, MUSCLES, volumeTarget } from './muscles.js';
import { recoveryStatus } from './recovery.js';
import { intakeAverage, weightTrend, targets } from './nutrition.js';
import { runTask, aiReady } from './llm.js';

const WEEK = 7 * 86400000;
const r1 = (v) => Math.round(v * 10) / 10;
const day = (ts) => new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

/** Gespeicherter Bericht (oder null) */
export function getCoachReport() { return getSettings().coach || null; }

/** Gibt es seit dem letzten Bericht eine neue Woche mit Training? */
export function coachDue() {
  const rep = getCoachReport();
  const sessions = getSessions();
  if (!sessions.length) return false;
  if (!rep) return true;
  return weekKey(Date.now()) > rep.weekKey && sessions.some(s => s.startedAt > rep.at);
}

/** Kompakte Datenbasis für den Bericht */
export function coachData(now = Date.now()) {
  const settings = getSettings();
  const sessions = getSessions();
  const thisWeek = weekKey(now);
  const unit = settings.unit || 'kg';

  // Vier Wochen (laufende zuerst)
  const wochen = [];
  for (let i = 0; i < 4; i++) {
    const wk = thisWeek - i * WEEK;
    const list = sessions.filter(s => s.startedAt >= wk && s.startedAt < wk + WEEK);
    wochen.push({
      kw: isoWeek(wk), laufend: i === 0 || undefined,
      trainings: list.length,
      saetze: list.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.length, 0), 0),
      volumen: Math.round(list.reduce((a, s) => a + sessionVolume(s), 0)),
      minuten: Math.round(list.reduce((a, s) => a + (s.durationSec || 0), 0) / 60),
      rekorde: list.reduce((a, s) => a + sessionPRs(s).length, 0),
    });
  }

  // Letzte 7 Tage im Detail
  const recent = sessions.filter(s => s.startedAt >= now - WEEK).map(s => ({
    tag: day(s.startedAt), plan: s.planName || s.name || 'Training', minuten: Math.round((s.durationSec || 0) / 60),
    saetze: s.entries.reduce((b, e) => b + e.sets.length, 0), volumen: Math.round(sessionVolume(s)),
    rekorde: sessionPRs(s).slice(0, 4).map(p => `${p.name}: ${p.type === 'volume' ? Math.round(p.value) + ' ' + unit : p.type === 'e1rm' ? fmtKg(Math.round(p.value)) + ' 1RM' : fmtKg(p.weight) + ' × ' + p.reps}`),
    notiz: s.note ? String(s.note).slice(0, 120) : undefined,
  }));

  // Übungen: die zuletzt trainierten, mit Verlauf
  const seen = new Map();
  for (const s of sessions) for (const e of s.entries) if (e.sets.length) seen.set(e.name.trim().toLowerCase(), e.name);
  const uebungen = [];
  for (const name of seen.values()) {
    const hist = exerciseHistory(name);
    if (!hist.length) continue;
    const last = hist[hist.length - 1];
    if (last.session.startedAt < now - 5 * WEEK) continue; // seit über fünf Wochen nicht trainiert → weglassen
    const bestAll = Math.max(...hist.map(h => entryBest(h.entry).e1rm));
    const recent4 = hist.filter(h => h.session.startedAt >= now - 4 * WEEK);
    const before = hist.filter(h => h.session.startedAt < now - 4 * WEEK);
    const bestRecent = recent4.length ? Math.max(...recent4.map(h => entryBest(h.entry).e1rm)) : null;
    const bestBefore = before.length ? Math.max(...before.map(h => entryBest(h.entry).e1rm)) : null;
    const lb = entryBest(last.entry);
    const plateau = plateauFor(name);
    uebungen.push({
      name, einheiten: hist.length, zuletzt: day(last.session.startedAt),
      arbeitsgewicht: workingWeight(last.entry) != null ? `${fmtKg(workingWeight(last.entry))}` : undefined,
      topSatz: lb.bestSet ? `${fmtKg(lb.bestSet.weight)} × ${lb.bestSet.reps}` : undefined,
      e1rm: Math.round(lb.e1rm), bestesE1rm: Math.round(bestAll),
      e1rmTrend4Wochen: bestRecent != null && bestBefore != null ? `${bestRecent - bestBefore >= 0 ? '+' : ''}${r1(bestRecent - bestBefore)} ${unit}` : undefined,
      stagniert: plateau ? `seit ${plateau.sessions} Einheiten (${Math.round((now - plateau.since) / 86400000)} Tage)${plateau.grinding ? ', zuletzt nur RIR 0' : ''}` : undefined,
    });
  }
  uebungen.sort((a, b) => b.einheiten - a.einheiten);

  // Muskelgruppen der letzten 7 Tage gegen den Zielbereich
  const tgt = volumeTarget();
  const ms = muscleSets(sessions.filter(s => s.startedAt >= now - WEEK)).totals;
  const muskeln = {};
  for (const [k] of MUSCLES) if (ms[k] > 0) muskeln[MUSCLE_NAME[k]] = r1(ms[k]);

  // Erholung
  const status = recoveryStatus(now);
  const muede = MUSCLES.filter(([k]) => status[k].state === 'tired').map(([, n]) => n);

  // Körper & Ernährung
  const bodyLog = getBodyLog().filter(e => e.weight != null);
  const lastW = bodyLog[bodyLog.length - 1];
  const trend = weightTrend(21);
  const intake = intakeAverage(14);
  const t = targets();

  return {
    heute: day(now), einheit: unit,
    wochenziel: settings.weeklyGoal || 4,
    deloadWoche: deloadActive() || undefined,
    plaene: getPlans().map(p => p.name).slice(0, 8),
    wochen, letzte7Tage: recent,
    uebungen: uebungen.slice(0, 14),
    muskelnSaetze7Tage: muskeln, zielSaetzeProWoche: `${tgt.min}–${tgt.max}`,
    erholung: muede.length ? { muede } : { muede: [] },
    koerper: lastW ? { gewichtKg: lastW.weight, gewogen: day(lastW.date), trendProWoche: trend ? `${trend.perWeek >= 0 ? '+' : ''}${r1(trend.perWeek)} kg` : undefined } : undefined,
    ernaehrung: intake ? { tageProtokolliert: intake.days, kcalSchnitt: Math.round(intake.kcal), proteinSchnitt: Math.round(intake.protein), ziel: t.ready ? { kcal: Math.round(t.kcal), protein: Math.round(t.protein), art: settings.nGoal } : undefined } : undefined,
  };
}

/** Bericht erzeugen und speichern */
export async function generateCoachReport() {
  if (!aiReady()) throw new Error('Kein KI-Zugang eingerichtet – unter „Mehr → KI“ Server oder Key eintragen.');
  const data = coachData();
  let res;
  try { res = await runTask('coach', { data }); } catch (e) {
    if (/Unbekannte Aufgabe|404/.test(e.message || '')) throw new Error('Der Hantel-Server kennt den Coach noch nicht – bitte die aktuelle worker/index.js in Cloudflare einfügen und deployen.');
    throw e;
  }
  const report = { ...res.data, at: Date.now(), weekKey: weekKey(Date.now()), kw: isoWeek(Date.now()), trainings: data.letzte7Tage.length };
  updateSettings({ coach: report });
  return report;
}
