// Eingebaute Trainingsplan-Vorlagen (aus "Marvin / Muskelaufbau", Stand 12.09.2026)
import { getPlans, addPlan, newPlan, newExercise, getSettings, updateSettings } from './store.js';

const WARMUP = 'Aufwärmen: 5–8 min locker bewegen. Vor der ersten schweren Übung 2–4 steigende Aufwärmsätze, vor einem neuen schweren Bewegungsmuster 1–2 weitere – nicht bis zur Ermüdung.';
const FIVE_DAY = 'Bei 5 Trainingstagen: Übungen mit * auf Samstag verschieben (Vorlage „Zusatztag Samstag“), nicht zusätzlich ausführen.';

const ex = (name, sets, reps, restSec, note) => ({ name, sets, reps, restSec, note });

export const TEMPLATES = [
  {
    id: 'ok-a',
    name: 'Oberkörper A',
    group: 'Oberkörper / Unterkörper',
    note: `20 Arbeitssätze · ca. 65–85 min inkl. Aufwärmen. ${WARMUP}`,
    exercises: [
      ex('Brustpresse', 3, '6-10', 150, 'RIR 2 · Schulterblätter stabil; Griffe etwa auf Brusthöhe.'),
      ex('Latzug, neutraler Griff', 3, '8-12', 120, 'RIR 1-2 · Ellbogen Richtung Hüfte; Oberkörper ruhig halten.'),
      ex('Rudern, brustgestützt', 3, '8-12', 120, 'RIR 1-2 · Brust am Polster; ohne Schwung ziehen.'),
      ex('Kabel-Flys', 2, '10-15', 90, 'RIR 1-2 · Ellbogen leicht gebeugt; kontrolliert öffnen.'),
      ex('Seitheben am Kabel', 3, '12-20', 75, 'RIR 1-2 · Seitlich anheben; nicht mit dem Oberkörper schwingen.'),
      ex('Reverse-Flys, Maschine', 2, '12-20', 75, 'RIR 1-2 · Arme nach außen führen; Nacken locker lassen.'),
      ex('Bizepscurls am Kabel', 2, '10-15', 75, 'RIR 1-2 · Oberarme ruhig; Ellbogen kontrolliert strecken.'),
      ex('Trizepsdrücken am Kabel', 2, '10-15', 75, 'RIR 1-2 · Ellbogen am Körper; Schultern nicht vorschieben.'),
    ],
  },
  {
    id: 'ok-b',
    name: 'Oberkörper B',
    group: 'Oberkörper / Unterkörper',
    note: `20 Arbeitssätze · ca. 65–85 min inkl. Aufwärmen. ${WARMUP} ${FIVE_DAY}`,
    exercises: [
      ex('Schrägbankdrücken, Kurzhanteln', 3, '8-12', 150, 'RIR 2 · Bank ca. 15–30°; Unterarme unter den Hanteln.'),
      ex('Rudern am Kabel', 3, '8-12', 120, 'RIR 1-2 · Rumpf stabil; kontrolliert nach vorn reichen.'),
      ex('Latzug, schulterbreiter Griff', 3, '8-12', 120, 'RIR 1-2 · Zur oberen Brust ziehen; kein Reißen.'),
      ex('Butterfly-Maschine', 2, '10-15', 90, 'RIR 1-2 · Brustkorb stabil; Dehnung ohne Ausweichen.'),
      ex('Seitheben, Kurzhanteln', 3, '12-20', 75, 'RIR 1-2 · Kontrolliert absenken; nicht hochzucken.'),
      ex('Reverse-Flys, Maschine', 2, '12-20', 75, 'RIR 1-2 · Leicht gebeugte Ellbogen; gleiche Bahn pro Wiederholung.'),
      ex('Schrägbank-Bizepscurls', 2, '10-15', 75, 'RIR 1-2 · Oberarme hängen lassen; nicht nach vorn schieben. * Bei 5 Tagen auf Samstag.'),
      ex('Überkopf-Trizeps am Kabel', 2, '10-15', 75, 'RIR 1-2 · Rumpf stabil; Ellbogen beugen und strecken. * Bei 5 Tagen auf Samstag.'),
    ],
  },
  {
    id: 'uk-a',
    name: 'Unterkörper A',
    group: 'Oberkörper / Unterkörper',
    note: `16 Arbeitssätze · ca. 55–75 min inkl. Aufwärmen. ${WARMUP}`,
    exercises: [
      ex('Hackenschmidt-Kniebeuge', 3, '6-10', 150, 'RIR 2 · Quadrizeps, Gesäß · Füße stabil; so tief wie kontrolliert möglich.'),
      ex('Rumänisches Kreuzheben', 3, '8-10', 150, 'RIR 2 · Beinbeuger, Gesäß, Rückenstrecker · Hüfte zurück; Gewicht nah am Körper, Rücken stabil.'),
      ex('Beinstrecker', 2, '10-15', 90, 'RIR 1-2 · Quadrizeps · Drehachse am Knie ausrichten; nicht hochschleudern.'),
      ex('Beinbeuger, sitzend', 2, '10-15', 90, 'RIR 1-2 · Beinbeuger · Becken am Polster; kontrolliert strecken lassen.'),
      ex('Wadenheben, stehend', 3, '10-15', 75, 'RIR 1-2 · Waden (Gastrocnemius) · Unten kontrolliert dehnen; oben auf die Zehenspitzen.'),
      ex('Kabel-Crunch', 3, '10-15', 75, 'RIR 1-2 · Bauch · Rippen Richtung Becken; nicht nur in der Hüfte knicken.'),
    ],
  },
  {
    id: 'uk-b',
    name: 'Unterkörper B',
    group: 'Oberkörper / Unterkörper',
    note: `17 Arbeitssätze · ca. 55–75 min inkl. Aufwärmen. ${WARMUP} ${FIVE_DAY}`,
    exercises: [
      ex('Beinpresse', 3, '8-12', 150, 'RIR 2 · Quadrizeps, Gesäß · Becken am Polster; kontrollierte, große Bewegungsamplitude.'),
      ex('Hip Thrust, Maschine', 3, '8-12', 120, 'RIR 1-2 · Gesäß · Oben Hüfte strecken; nicht ins Hohlkreuz ausweichen.'),
      ex('Beinbeuger, sitzend', 3, '10-15', 90, 'RIR 1-2 · Beinbeuger · Polster anpassen; Becken bleibt unten.'),
      ex('Beinstrecker', 2, '10-15', 90, 'RIR 1-2 · Quadrizeps · Gleichmäßig bewegen; oben kurz kontrollieren.'),
      ex('Wadenheben, sitzend', 3, '12-20', 75, 'RIR 1-2 · Waden (Soleus) · Volle kontrollierte Bewegung; nicht federn. * Bei 5 Tagen auf Samstag.'),
      ex('Reverse Crunch', 3, '10-20', 75, 'RIR 1-2 · Bauch · Becken einrollen und leicht anheben; kein Beinschwung. * Bei 5 Tagen auf Samstag.'),
    ],
  },
  {
    id: 'zusatz-sa',
    name: 'Zusatztag Samstag (5-Tage-Variante)',
    group: 'Optional',
    optional: true,
    note: 'Nur bei 5 Trainingstagen: die mit * markierten Übungen aus Oberkörper B und Unterkörper B. Diese 10 Sätze entfallen dann Do/Fr, die Wochendosis bleibt gleich. RIR und Pausen wie in B.',
    exercises: [
      ex('Schrägbank-Bizepscurls', 2, '10-15', 75, 'RIR 1-2 · Oberarme hängen lassen; nicht nach vorn schieben.'),
      ex('Überkopf-Trizeps am Kabel', 2, '10-15', 75, 'RIR 1-2 · Rumpf stabil; Ellbogen beugen und strecken.'),
      ex('Wadenheben, sitzend', 3, '12-20', 75, 'RIR 1-2 · Volle kontrollierte Bewegung; nicht federn.'),
      ex('Reverse Crunch', 3, '10-20', 75, 'RIR 1-2 · Becken einrollen und leicht anheben; kein Beinschwung.'),
    ],
  },
];

/** Wochenplan aus dem PDF – zur Anzeige in der Vorlagen-Übersicht */
export const WEEK_PLAN = [
  ['Mo', 'Oberkörper A', 'Oberkörper A'],
  ['Di', 'Unterkörper A', 'Unterkörper A'],
  ['Mi', 'Pause', 'Pause'],
  ['Do', 'Oberkörper B', 'Oberkörper B ohne Arme *'],
  ['Fr', 'Unterkörper B', 'Unterkörper B ohne Waden/Bauch *'],
  ['Sa', 'Pause', 'Zusatztag: verschobene Übungen'],
  ['So', 'Pause', 'Pause'],
];

export function templateToPlan(t) {
  return newPlan({
    name: t.name,
    note: t.note,
    exercises: t.exercises.map(e => newExercise({ name: e.name, sets: e.sets, reps: e.reps, weight: null, restSec: e.restSec, note: e.note })),
  });
}

export function addTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return null;
  return addPlan(templateToPlan(t));
}

/**
 * Beim ersten Start die vier Hauptpläne anlegen (einmalig, nur wenn der Name noch nicht existiert).
 * @returns {number} Anzahl neu angelegter Pläne
 */
export function seedTemplates() {
  const s = getSettings();
  if (s.seededTemplates >= 1) return 0;
  const existing = new Set(getPlans().map(p => p.name.trim().toLowerCase()));
  let n = 0;
  for (const t of TEMPLATES) {
    if (t.optional) continue;
    if (existing.has(t.name.toLowerCase())) continue;
    addPlan(templateToPlan(t));
    n++;
  }
  updateSettings({ seededTemplates: 1 });
  return n;
}
