// Sprachansagen über die Web Speech API (deutsch). iOS braucht die erste Ansage aus einer Nutzer-Geste.
import { getSettings } from './store.js';

let primed = false;
let voice = null;

function pickVoice() {
  if (voice || !('speechSynthesis' in window)) return voice;
  const voices = speechSynthesis.getVoices();
  voice = voices.find(v => /^de[-_]/i.test(v.lang) && /Anna|Petra|Markus|Google Deutsch|Helena/i.test(v.name))
    || voices.find(v => /^de[-_]/i.test(v.lang)) || null;
  return voice;
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { voice = null; pickVoice(); });

export function speechAvailable() { return 'speechSynthesis' in window; }

/** Aus einer Tipp-Geste aufrufen: gibt die Sprachausgabe auf iOS frei */
export function primeSpeech() {
  if (primed || !speechAvailable() || !getSettings().speech) return;
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; speechSynthesis.speak(u); primed = true; } catch { /* egal */ }
}

export function speak(text) {
  if (!speechAvailable() || !getSettings().speech || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    const v = pickVoice(); if (v) u.voice = v;
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch { /* egal */ }
}

/** „60 Kilo, 6 Wiederholungen“ */
export function sayWeightReps(weight, reps) {
  const w = weight != null ? `${String(weight).replace('.', ',')} Kilo` : '';
  const r = reps != null ? `${reps} Wiederholungen` : '';
  return [w, r].filter(Boolean).join(', ');
}
