// Exporte: CSV (alle Sätze) und ICS (wöchentliche Trainingstermine)
import { getSessions, getSettings, getPlans, e1rm, setVolume } from './store.js';
import { download, toast } from './util.js';

/** Datei über das Share-Sheet anbieten (iOS: „In Kalender“, „In Dateien sichern“ …), sonst Download */
async function offerFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(name, text, type);
  toast(`${name} gespeichert`);
}

// ---------- CSV ----------

const CSV_HEAD = ['Datum', 'Uhrzeit', 'Plan', 'Übung', 'Satz', 'Typ', 'Gewicht', 'Wdh', 'RIR', 'Volumen', 'e1RM', 'Notiz'];

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const num = (v) => v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');

export function buildCSV() {
  const rows = [CSV_HEAD];
  for (const s of getSessions()) {
    const d = new Date(s.startedAt);
    const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    for (const e of s.entries) {
      e.sets.forEach((set, i) => {
        rows.push([date, time, s.planName, e.name, i + 1, set.type || 'work', num(set.weight), set.reps ?? '', set.rir ?? '', num(setVolume(set)), num(e1rm(set.weight, set.reps)), e.sessionNote || '']);
      });
    }
  }
  // Semikolon + BOM: öffnet in deutschem Excel/Numbers direkt als Tabelle
  return '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
}

export async function exportCSV() {
  const d = new Date();
  await offerFile(`hantel-saetze-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`, buildCSV(), 'text/csv');
}

// ---------- ICS ----------

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function icsDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** Wöchentliche Termine für die eingestellten Trainingstage; optional ein fester Plan je Tag */
export function buildICS() {
  const s = getSettings();
  const days = (s.trainingDays || []).slice().sort();
  if (!days.length) return null;
  const [hh, mm] = (s.trainingTime || '18:00').split(':').map(Number);
  const plans = getPlans();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hantel//Trainingsplan//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const now = new Date();
  for (const day of days) {
    // erster Termin: nächster passender Wochentag ab heute
    const first = new Date(now); first.setHours(hh || 18, mm || 0, 0, 0);
    while (first.getDay() !== day || first < now) first.setDate(first.getDate() + 1);
    const end = new Date(first.getTime() + 75 * 60000);
    const planId = s.trainingPlanByDay?.[day];
    const plan = plans.find(p => p.id === planId);
    const title = plan ? `Training: ${plan.name}` : 'Training (Hantel)';
    lines.push(
      'BEGIN:VEVENT',
      `UID:hantel-${day}-${first.getTime()}@hantel`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(first)}`,
      `DTEND:${icsDate(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[day]}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${plan ? plan.exercises.map(e => e.name).join(', ') : 'Der Plan für heute steht in der App unter „Heute dran“.'}`,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Gleich Training', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function exportICS() {
  const ics = buildICS();
  if (!ics) { toast('Erst Trainingstage auswählen'); return; }
  await offerFile('hantel-training.ics', ics, 'text/calendar');
}
