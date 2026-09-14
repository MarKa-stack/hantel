// Erholungsstatus je Muskelgruppe und daraus der Vorschlag, welcher Plan heute dran ist.
// Modell: jede Einheit hinterlässt „Ermüdung“ in Satz-Äquivalenten (primär 1,0 / sekundär 0,5),
// die mit Halbwertszeit 24 h abklingt. < 1 = erholt, ≥ 3 = noch müde.
import { getSessions, getPlans } from './store.js';
import { MUSCLES, MUSCLE_NAME, musclesFor } from './muscles.js';

const HALF_LIFE_H = 24;
const LOOKBACK_MS = 7 * 86400000;
export const FRESH_BELOW = 1;   // Satz-Äquivalente
export const TIRED_FROM = 3;

/** @returns {Record<string, {fatigue:number, lastAt:number|null, lastSets:number, state:'fresh'|'ok'|'tired', hours:number|null}>} */
export function recoveryStatus(now = Date.now()) {
  const out = Object.fromEntries(MUSCLES.map(([k]) => [k, { fatigue: 0, lastAt: null, lastSets: 0, state: 'fresh', hours: null }]));
  for (const s of getSessions()) {
    if (s.startedAt < now - LOOKBACK_MS || s.startedAt > now) continue;
    const decay = Math.pow(0.5, (now - s.startedAt) / 3600000 / HALF_LIFE_H);
    const perMuscle = {};
    for (const e of s.entries) {
      const n = e.sets.length;
      if (!n) continue;
      const m = musclesFor(e.name);
      for (const k of m.primary) perMuscle[k] = (perMuscle[k] || 0) + n;
      for (const k of m.secondary) perMuscle[k] = (perMuscle[k] || 0) + n * 0.5;
    }
    for (const [k, sets] of Object.entries(perMuscle)) {
      const r = out[k]; if (!r) continue;
      r.fatigue += sets * decay;
      if (r.lastAt == null || s.startedAt > r.lastAt) { r.lastAt = s.startedAt; r.lastSets = sets; }
    }
  }
  for (const r of Object.values(out)) {
    r.hours = r.lastAt ? Math.round((now - r.lastAt) / 3600000) : null;
    r.state = r.fatigue >= TIRED_FROM ? 'tired' : r.fatigue >= FRESH_BELOW ? 'ok' : 'fresh';
  }
  return out;
}

/** Ermüdung 0..1 für die Körperkarte (6 Satz-Äquivalente = voll) */
export function fatigueRatios(status) {
  return Object.fromEntries(Object.entries(status).map(([k, r]) => [k, Math.min(1, r.fatigue / 6)]));
}

/** Welche Muskeln ein Plan trifft, gewichtet nach Sätzen */
export function planLoad(plan) {
  const load = {};
  for (const ex of plan.exercises) {
    const n = Math.max(1, ex.sets || 1);
    const m = musclesFor(ex.name);
    for (const k of m.primary) load[k] = (load[k] || 0) + n;
    for (const k of m.secondary) load[k] = (load[k] || 0) + n * 0.5;
  }
  return load;
}

/**
 * Plan für heute: der, dessen Muskeln am erholtesten sind; bei Gleichstand der am längsten nicht trainierte.
 * @returns {{ plan:object, reason:string, score:number, rotationNext:object }|null}
 */
export function suggestPlan(now = Date.now()) {
  const plans = getPlans();
  if (!plans.length) return null;
  const sessions = getSessions();
  const status = recoveryStatus(now);
  const lastSession = sessions[sessions.length - 1];
  const lastIdx = lastSession ? plans.findIndex(p => p.id === lastSession.planId) : -1;
  const rotationNext = plans[(lastIdx + 1) % plans.length];
  if (!sessions.length) return { plan: rotationNext, reason: 'Erstes Training – los geht’s.', score: 0, rotationNext };

  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const scored = plans.map(p => {
    const load = planLoad(p);
    const total = Object.values(load).reduce((a, b) => a + b, 0) || 1;
    // mittlere Ermüdung der Zielmuskeln, gewichtet nach Anteil im Plan
    const score = Object.entries(load).reduce((a, [k, w]) => a + (status[k]?.fatigue || 0) * (w / total), 0);
    const last = [...sessions].reverse().find(s => s.planId === p.id);
    const doneToday = last && last.startedAt >= today.getTime();
    return { plan: p, score, lastAt: last?.startedAt || 0, doneToday, load };
  });
  // heute schon absolviert → ans Ende; sonst kleinste Ermüdung, dann längste Pause
  scored.sort((a, b) => (a.doneToday - b.doneToday) || (a.score - b.score) || (a.lastAt - b.lastAt));
  const best = scored[0];
  const main = Object.entries(best.load).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const fresh = main.filter(k => status[k].state !== 'tired');
  const tired = Object.entries(status).filter(([, r]) => r.state === 'tired').map(([k]) => MUSCLE_NAME[k]);
  let reason;
  if (best.doneToday) reason = 'Alle Pläne heute schon absolviert – Pause oder Zusatzeinheit.';
  else if (fresh.length) {
    const days = Math.max(...fresh.map(k => status[k].hours ?? 999));
    reason = `${fresh.map(k => MUSCLE_NAME[k]).join(' und ')} ${fresh.length > 1 ? 'sind' : 'ist'} erholt` + (days < 999 ? ` (${days >= 48 ? Math.round(days / 24) + ' Tage' : days + ' h'})` : '') + (tired.length ? ` · noch müde: ${tired.join(', ')}` : '') + '.';
  } else reason = 'Alles noch ziemlich müde – lieber leicht trainieren oder einen Tag Pause.';
  return { plan: best.plan, reason, score: best.score, rotationNext };
}
