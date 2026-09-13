// Timer-Engine: zeitstempelbasiert, damit sie auch nach Sperrbildschirm stimmt.
import { getSettings } from './store.js';

// ---------- Audio ----------

let audioCtx = null;

/** Muss aus einer Nutzer-Geste heraus aufgerufen werden (iOS). */
export function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Stiller Ton, damit iOS den Kontext freigibt
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.01);
  } catch { /* egal */ }
}

function beep(freq = 880, dur = 0.12, when = 0, vol = 0.25) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t = audioCtx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* egal */ }
}

export function playDone() {
  const s = getSettings();
  if (s.sound) {
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    beep(880, 0.12, 0); beep(880, 0.12, 0.18); beep(1320, 0.3, 0.36);
    // Bei gesperrtem Bildschirm ist WebAudio meist stumm → zusätzlich über das Media-Element klingeln
    if (document.hidden || audioCtx?.state !== "running") keepAlive.ring(); else keepAlive.stop();
  }
  if (s.vibrate) { try { navigator.vibrate?.([200, 80, 200, 80, 400]); } catch { /* iOS */ } }
}

// ---------- Keep-Alive (Sperrbildschirm) ----------
// iOS pausiert JavaScript und WebAudio, sobald das Display aus ist. Ein lautlos laufendes
// <audio loop> hält die Audio-Session offen; dann läuft der Timer weiter und der Beep
// wird über dasselbe Media-Element abgespielt.

function wavDataUrl(seconds, tone) {
  const rate = 8000, n = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    let s = 0;
    if (tone) {
      const t = i / rate;
      // Drei kurze Töne: 880, 880, 1320 Hz
      const seg = t < 0.18 ? 880 : t < 0.36 ? 0 : t < 0.54 ? 880 : t < 0.72 ? 0 : t < 1.2 ? 1320 : 0;
      s = seg ? Math.sin(2 * Math.PI * seg * t) * 0.8 : 0;
    }
    v.setUint8(44 + i, 128 + Math.round(s * 120));
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(bin);
}

export const keepAlive = {
  el: null, silence: null, bell: null, running: false,
  _init() {
    if (this.el) return;
    this.silence = wavDataUrl(1.0, false);
    this.bell = wavDataUrl(1.3, true);
    this.el = document.createElement('audio');
    this.el.setAttribute('playsinline', '');
    this.el.preload = 'auto';
    this.el.loop = true;
    this.el.volume = 1;
    document.body.append(this.el);
  },
  /** Aus einer Nutzer-Geste heraus starten (z.B. „Satz abschließen“) */
  start() {
    if (!getSettings().keepAliveAudio) return;
    try {
      this._init();
      if (this.el.src !== this.silence) this.el.src = this.silence;
      this.el.loop = true;
      const p = this.el.play();
      if (p?.catch) p.catch(() => {});
      this.running = true;
    } catch { /* egal */ }
  },
  ring() {
    if (!this.el) return;
    try {
      this.el.loop = false;
      this.el.src = this.bell;
      const p = this.el.play();
      if (p?.catch) p.catch(() => {});
      this.el.onended = () => { this.stop(); };
    } catch { /* egal */ }
  },
  stop() {
    if (!this.el) return;
    try { this.el.pause(); this.el.onended = null; this.el.loop = true; if (this.el.src !== this.silence) this.el.src = this.silence; } catch { /* egal */ }
    this.running = false;
  },
};

export function playTick() {
  if (getSettings().sound) beep(660, 0.06, 0, 0.12);
}

// ---------- Countdown ----------

class Countdown {
  constructor() {
    this.endAt = null;
    this.total = 0;
    this.paused = null; // verbleibende ms bei Pause
    this.listeners = new Set();
    this.interval = null;
    this.lastWhole = null;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this._tick(); });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(type) { for (const fn of this.listeners) fn(type, this); }

  get running() { return this.endAt != null; }
  get active() { return this.endAt != null || this.paused != null; }
  remainingMs() {
    if (this.paused != null) return this.paused;
    if (this.endAt == null) return 0;
    return Math.max(0, this.endAt - Date.now());
  }
  remaining() { return Math.ceil(this.remainingMs() / 1000); }
  progress() { return this.total ? 1 - this.remainingMs() / (this.total * 1000) : 0; }

  start(seconds) {
    this.total = seconds;
    this.paused = null;
    this.endAt = Date.now() + seconds * 1000;
    this.lastWhole = null;
    keepAlive.start();
    this._loop();
    this._emit('start');
  }
  add(seconds) {
    if (this.paused != null) { this.paused = Math.max(0, this.paused + seconds * 1000); this.total += seconds; }
    else if (this.endAt != null) { this.endAt += seconds * 1000; this.total += seconds; }
    else return;
    if (this.remainingMs() <= 0) { this.stop(); return; }
    this._emit('tick');
  }
  pause() {
    if (this.endAt == null) return;
    this.paused = this.remainingMs();
    this.endAt = null;
    clearInterval(this.interval); this.interval = null;
    this._emit('pause');
  }
  resume() {
    if (this.paused == null) return;
    this.endAt = Date.now() + this.paused;
    this.paused = null;
    this._loop();
    this._emit('resume');
  }
  stop(silent = false) {
    clearInterval(this.interval); this.interval = null;
    keepAlive.stop();
    const was = this.active;
    this.endAt = null; this.paused = null;
    if (was) this._emit(silent ? 'cancel' : 'stop');
  }
  _loop() {
    clearInterval(this.interval);
    this.interval = setInterval(() => this._tick(), 200);
    this._tick();
  }
  _tick() {
    if (this.endAt == null) return;
    const rem = this.remainingMs();
    const whole = Math.ceil(rem / 1000);
    if (whole !== this.lastWhole) {
      this.lastWhole = whole;
      if (whole > 0 && whole <= 3) playTick();
      this._emit('tick');
    }
    if (rem <= 0) {
      clearInterval(this.interval); this.interval = null;
      this.endAt = null; this.paused = null;
      playDone();
      this._emit('done');
    }
  }
}

/** Ein gemeinsamer Pausentimer für Workout + Timer-Seite */
export const restTimer = new Countdown();

// ---------- Stoppuhr ----------

export class Stopwatch {
  constructor(startedAt = null) {
    this.startedAt = startedAt;
    this.accum = 0; // ms aus früheren Läufen
    this.interval = null;
    this.listeners = new Set();
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  get running() { return this.startedAt != null; }
  elapsedMs() { return this.accum + (this.startedAt ? Date.now() - this.startedAt : 0); }
  elapsed() { return Math.floor(this.elapsedMs() / 1000); }
  start() { if (this.running) return; this.startedAt = Date.now(); this._loop(); this._emit(); }
  stop() { if (!this.running) return; this.accum += Date.now() - this.startedAt; this.startedAt = null; clearInterval(this.interval); this._emit(); }
  reset() { this.accum = 0; this.startedAt = null; clearInterval(this.interval); this._emit(); }
  destroy() { clearInterval(this.interval); this.listeners.clear(); }
  _loop() { clearInterval(this.interval); this.interval = setInterval(() => this._emit(), 250); }
  _emit() { for (const fn of this.listeners) fn(this); }
}

// ---------- Wake Lock ----------

let wakeLock = null;
let wakeLockWanted = false;
export async function requestWakeLock() {
  if (!getSettings().wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}
export function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* egal */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  // iOS gibt den Wake Lock beim Wechsel frei → beim Zurückkommen erneuern
  if (!document.hidden && wakeLockWanted) requestWakeLock();
});
export function setWakeLockWanted(v) { wakeLockWanted = v; if (v) requestWakeLock(); else releaseWakeLock(); }
