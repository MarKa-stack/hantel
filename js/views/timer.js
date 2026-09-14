// Timer-Seite: Countdown (Pausentimer) + Stoppuhr
import { h, svg, fmtDuration } from '../util.js';
import { getSettings, updateSettings } from '../store.js';
import { restTimer, unlockAudio, Stopwatch, setWakeLockWanted } from '../timer.js';

let cleanup = [];
let mode = 'countdown';
let stopwatch = null;
const PRESETS = [30, 45, 60, 90, 120, 150, 180, 240];

export function render(root) {
  const settings = getSettings();
  setWakeLockWanted(true);
  let selected = settings.lastTimerSec || settings.defaultRestSec || 90;

  root.append(h('div.page-head', {}, [h('div', {}, [h('h1', { text: 'Timer' })])]));

  const seg = h('div.seg', {}, [
    h('button', { text: 'Countdown', class: mode === 'countdown' ? 'active' : '', onclick: () => { mode = 'countdown'; draw(); } }),
    h('button', { text: 'Stoppuhr', class: mode === 'stopwatch' ? 'active' : '', onclick: () => { mode = 'stopwatch'; draw(); } }),
  ]);
  root.append(seg);
  const body = h('div');
  root.append(body);

  const draw = () => {
    for (const b of seg.children) b.classList.toggle('active', b.textContent === (mode === 'countdown' ? 'Countdown' : 'Stoppuhr'));
    body.innerHTML = '';
    for (const fn of cleanup) fn();
    cleanup = [];
    if (mode === 'countdown') drawCountdown(); else drawStopwatch();
  };

  // ---------- Countdown ----------
  const drawCountdown = () => {
    const R = 120, C = 2 * Math.PI * R;
    const big = h('div.big.mono', { text: fmtDuration(selected) });
    const state = h('div.state', { text: 'Bereit' });
    const ringSvg = svg('svg', { viewBox: '0 0 260 260' });
    const progC = svg('circle', { class: 'prog', cx: 130, cy: 130, r: R, 'stroke-dasharray': C, 'stroke-dashoffset': 0 });
    ringSvg.append(svg('circle', { class: 'track', cx: 130, cy: 130, r: R }), progC);

    const ring = h('div.ring', {}, [ringSvg, h('div.inner', {}, [big, state])]);

    const startBtn = h('button.btn.primary.block', { text: 'Start', style: { minHeight: '56px', fontSize: '18px' } });
    const secondary = h('div.grid-2.mt', {}, [
      h('button.btn.ghost', { text: '+30s', onclick: () => { if (restTimer.active) restTimer.add(30); else { selected += 30; update(); } } }),
      h('button.btn.ghost', { text: 'Zurücksetzen', onclick: () => { restTimer.stop(true); update(); } }),
    ]);

    const presets = h('div.presets', {}, PRESETS.map(s => h('button.btn', {
      text: fmtDuration(s), class: s === selected ? 'active' : '',
      onclick: () => { selected = s; updateSettings({ lastTimerSec: s }); if (!restTimer.active) update(); else { restTimer.stop(true); restTimer.start(s); } },
    })));

    const custom = h('div.row.mt', {}, [
      h('input.input.num', { type: 'number', inputmode: 'numeric', placeholder: 'Sekunden', 'aria-label': 'Eigene Sekunden', min: 5, max: 3600, style: { flex: '1' } }),
      h('button.btn.ghost', { text: 'Übernehmen', onclick: (e) => {
        const v = parseInt(e.target.previousSibling.value, 10);
        if (v > 0) { selected = v; updateSettings({ lastTimerSec: v }); update(); }
      } }),
    ]);

    const update = () => {
      const active = restTimer.active;
      const rem = active ? restTimer.remaining() : selected;
      big.textContent = fmtDuration(rem);
      big.classList.toggle('running', restTimer.running);
      state.textContent = restTimer.running ? 'Läuft' : restTimer.active ? 'Pausiert' : 'Bereit';
      progC.setAttribute('stroke-dashoffset', active ? C * restTimer.progress() : 0);
      startBtn.textContent = restTimer.running ? 'Pause' : restTimer.active ? 'Weiter' : 'Start';
      startBtn.className = 'btn block ' + (restTimer.running ? '' : 'primary');
      for (const b of presets.children) b.classList.toggle('active', !active && b.textContent === fmtDuration(selected));
    };
    startBtn.addEventListener('click', () => {
      unlockAudio();
      if (restTimer.running) restTimer.pause();
      else if (restTimer.active) restTimer.resume();
      else restTimer.start(selected);
      update();
    });

    cleanup.push(restTimer.on((type) => {
      if (type === 'done') { state.textContent = 'Fertig!'; big.textContent = '0:00'; setTimeout(update, 1500); }
      else update();
    }));

    body.append(h('div.timer-display', {}, [ring]), startBtn, secondary, presets, custom);
    update();
  };

  // ---------- Stoppuhr ----------
  const drawStopwatch = () => {
    if (!stopwatch) stopwatch = new Stopwatch();
    const big = h('div.big.mono', { text: fmtDuration(stopwatch.elapsed()) });
    const state = h('div.state', { text: stopwatch.running ? 'Läuft' : 'Bereit' });
    const startBtn = h('button.btn.primary.block', { text: stopwatch.running ? 'Stopp' : 'Start', style: { minHeight: '56px', fontSize: '18px' } });
    const resetBtn = h('button.btn.ghost.block.mt', { text: 'Zurücksetzen', onclick: () => { stopwatch.reset(); } });
    const update = () => {
      big.textContent = fmtDuration(stopwatch.elapsed());
      big.classList.toggle('running', stopwatch.running);
      state.textContent = stopwatch.running ? 'Läuft' : stopwatch.elapsed() ? 'Gestoppt' : 'Bereit';
      startBtn.textContent = stopwatch.running ? 'Stopp' : 'Start';
      startBtn.className = 'btn block ' + (stopwatch.running ? 'danger' : 'primary');
    };
    startBtn.addEventListener('click', () => { if (stopwatch.running) stopwatch.stop(); else stopwatch.start(); update(); });
    cleanup.push(stopwatch.on(update));
    body.append(h('div.timer-display', {}, [big, state]), startBtn, resetBtn);
    update();
  };

  draw();
}

export function unmount() {
  for (const fn of cleanup) fn();
  cleanup = [];
  setWakeLockWanted(false);
}
