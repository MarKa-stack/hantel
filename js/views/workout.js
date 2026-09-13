// Aktives Workout: Sätze abhaken, Pausentimer, Abschluss
import { h, svgIcon, fmtDuration, fmtWeight, fmtNum, confirmSheet, openSheet, toast, haptic, parseNum } from '../util.js';
import { getActiveWorkout, touchWorkout, finishWorkout, cancelWorkout, getSettings, sessionVolume, detectPRs, lastPerformance } from '../store.js';
import { restTimer, unlockAudio, setWakeLockWanted } from '../timer.js';
import { openExerciseInfo, figureThumb } from './exercise-info.js';

let cleanup = [];

export function render(root, { navigate }) {
  const w = getActiveWorkout();
  if (!w) { navigate('/plans', true); return; }
  const settings = getSettings();
  setWakeLockWanted(true);

  // ---------- Kopf ----------
  const elapsedEl = h('span.elapsed', { text: fmtDuration((Date.now() - w.startedAt) / 1000) });
  const tickEl = setInterval(() => { elapsedEl.textContent = fmtDuration((Date.now() - w.startedAt) / 1000); }, 1000);
  cleanup.push(() => clearInterval(tickEl));

  const restBox = h('div');
  const head = h('div.workout-head', {}, [
    h('div.row.between', {}, [
      h('button.btn.sm.ghost', { text: 'Abbrechen', onclick: cancel }),
      h('div.center.grow', {}, [h('div.title.truncate', { text: w.planName }), elapsedEl]),
      h('button.btn.sm.primary', { text: 'Beenden', onclick: finish }),
    ]),
    restBox,
  ]);
  root.append(head);

  // ---------- Pausentimer ----------
  // Leiste nur einmal bauen und danach nur Werte aktualisieren (sonst startet die Animation bei jedem Tick neu)
  let restEls = null;
  const drawRest = () => {
    if (!restTimer.active) { restBox.innerHTML = ''; restEls = null; return; }
    if (!restEls) {
      restEls = {
        lbl: h('div.lbl'), time: h('div.time'), bar: h('div.bar'),
      };
      restBox.append(h('div.rest-bar', {}, [
        h('div', {}, [restEls.lbl, restEls.time]),
        h('div.grow'),
        h('button.btn', { text: '+30s', onclick: () => restTimer.add(30) }),
        h('button.btn', { text: 'Skip', onclick: () => restTimer.stop(true) }),
        restEls.bar,
      ]));
    }
    restEls.lbl.textContent = restTimer.running ? 'Pause' : 'Pausiert';
    restEls.time.textContent = fmtDuration(restTimer.remaining());
    restEls.bar.style.width = `${(1 - restTimer.progress()) * 100}%`;
  };
  drawRest();
  cleanup.push(restTimer.on((type) => {
    if (type === 'done') { haptic([200, 100, 200]); restBox.innerHTML = ''; restEls = null; toast('Pause vorbei – nächster Satz!'); }
    else drawRest();
  }));

  // ---------- Übungen ----------
  const list = h('div.list');
  root.append(list);

  const drawEntry = (entry, idx) => {
    const card = h('div.card.ex-card');
    const allDone = entry.sets.length && entry.sets.every(s => s.done);
    card.classList.toggle('done', !!allDone);

    const last = lastPerformance(entry.name);
    const target = `Ziel: ${entry.targetSets} × ${entry.targetReps}` + (entry.targetWeight != null ? ` @ ${fmtWeight(entry.targetWeight, settings.unit)}` : '') + ` · Pause ${entry.restSec}s`;
    const showInfo = () => openExerciseInfo(entry.name, { note: entry.note, target });
    card.append(h('div.ex-head', {}, [
      h('div.grow', {}, [
        h('div.ex-name', { text: `${idx + 1}. ${entry.name}` }),
        h('div.ex-target', { text: target }),
        last ? h('div.ex-last', { text: 'Letztes Mal: ' + last.sets.map(s => `${s.weight ?? '–'}×${s.reps ?? '–'}`).join(' · ') }) : null,
        entry.note ? h('div.small.muted', { text: entry.note }) : null,
      ]),
      h('div', { onclick: showInfo, style: { cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } }, [
        figureThumb(entry.name),
        h('button.info-btn', { text: 'i', 'aria-label': 'Ausführungstipps' }),
      ]),
    ]));

    const grid = h('div.set-grid', {}, [
      h('div.hdr', { text: 'Satz' }), h('div.hdr', { text: settings.unit }), h('div.hdr', { text: 'Wdh' }), h('div.hdr', { text: '' }),
    ]);

    entry.sets.forEach((set, si) => {
      const wIn = h('input.input.num', { type: 'text', inputmode: 'decimal', value: set.weight ?? '', placeholder: '–', 'aria-label': 'Gewicht' });
      const rIn = h('input.input.num', { type: 'text', inputmode: 'numeric', value: set.reps ?? '', placeholder: '–', 'aria-label': 'Wiederholungen' });
      wIn.addEventListener('input', () => { set.weight = parseNum(wIn.value); touchWorkout(); });
      rIn.addEventListener('input', () => { set.reps = parseNum(rIn.value); touchWorkout(); });
      // Enter/Weiter auf der Tastatur → nächstes Feld
      wIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') rIn.focus(); });
      rIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { rIn.blur(); toggle(); } });

      const check = h('button.check' + (set.done ? '.on' : ''), { html: svgIcon.check, 'aria-label': 'Satz abhaken' });
      const toggle = () => {
        unlockAudio();
        set.done = !set.done;
        if (set.done) {
          // Leere Felder mit Vorgabe füllen
          if (set.weight == null && wIn.value === '') { set.weight = entry.targetWeight ?? null; wIn.value = set.weight ?? ''; }
          if (set.reps == null && rIn.value === '') { set.reps = parseNum(entry.targetReps) ?? null; rIn.value = set.reps ?? ''; }
          // Nächsten Satz vorbelegen
          const next = entry.sets[si + 1];
          if (next && !next.done) { if (next.weight == null) next.weight = set.weight; if (next.reps == null) next.reps = set.reps; }
          haptic(15);
          const isLastSetOverall = idx === w.entries.length - 1 && si === entry.sets.length - 1;
          if (settings.autoRestTimer && !isLastSetOverall) restTimer.start(entry.restSec || settings.defaultRestSec);
        } else {
          restTimer.stop(true);
        }
        touchWorkout();
        redraw(idx);
      };
      check.addEventListener('click', toggle);

      const rowClass = set.done ? 'set-row done' : 'set-row';
      const row = h('div', { class: rowClass, style: { display: 'contents' } }, [
        h('div.setno', { text: si + 1 }), wIn, rIn, check,
      ]);
      // "display: contents" für Grid – Klassen zum Einfärben auf die Inputs übertragen
      if (set.done) { wIn.classList.add('done'); rIn.classList.add('done'); wIn.style.cssText = rIn.style.cssText = 'background:var(--good-soft);border-color:transparent;color:var(--good)'; }
      grid.append(row);
    });
    card.append(grid);

    card.append(h('div.add-set', {}, [
      h('button.btn.sm.ghost', { text: '– Satz', disabled: entry.sets.length <= 1, onclick: () => {
        const lastSet = entry.sets[entry.sets.length - 1];
        if (lastSet.done && entry.sets.length > 1) return;
        entry.sets.pop(); touchWorkout(); redraw(idx);
      } }),
      h('button.btn.sm.ghost', { text: '+ Satz', onclick: () => {
        const prev = entry.sets[entry.sets.length - 1];
        entry.sets.push({ reps: prev?.reps ?? null, weight: prev?.weight ?? null, done: false });
        touchWorkout(); redraw(idx);
      } }),
    ]));
    return card;
  };

  const cards = [];
  const redraw = (i) => {
    const fresh = drawEntry(w.entries[i], i);
    cards[i].replaceWith(fresh);
    cards[i] = fresh;
  };
  w.entries.forEach((e, i) => { const c = drawEntry(e, i); cards.push(c); list.append(c); });

  root.append(h('div.mt-lg', {}, [
    h('button.btn.good.block', { html: svgIcon.check + '<span>Workout beenden</span>', onclick: finish, style: { minHeight: '56px', fontSize: '17px' } }),
  ]));

  // ---------- Abschluss ----------
  async function cancel() {
    const ok = await confirmSheet({ title: 'Workout abbrechen?', text: 'Alle Sätze dieses Workouts werden verworfen.', okLabel: 'Verwerfen', danger: true });
    if (!ok) return;
    restTimer.stop(true);
    cancelWorkout();
    navigate('/plans', true);
  }

  function finish() {
    const doneSets = w.entries.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
    if (!doneSets) {
      confirmSheet({ title: 'Keine Sätze abgehakt', text: 'Ohne abgehakte Sätze wird nichts gespeichert. Workout verwerfen?', okLabel: 'Verwerfen', danger: true })
        .then(ok => { if (ok) { restTimer.stop(true); cancelWorkout(); navigate('/plans', true); } });
      return;
    }
    const preview = { ...w, entries: w.entries.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length) };
    const vol = sessionVolume(preview);
    const dur = (Date.now() - w.startedAt) / 1000;
    const prs = detectPRs(preview);

    openSheet((sheet, close) => {
      const note = h('textarea.input', { placeholder: 'Wie lief’s? (optional)' });
      sheet.append(
        h('h2', { text: 'Workout abschließen' }),
        h('div.stats', {}, [
          h('div.stat', {}, [h('div.val', { text: fmtDuration(dur) }), h('div.lbl', { text: 'Dauer' })]),
          h('div.stat', {}, [h('div.val', { html: `${doneSets}` }), h('div.lbl', { text: 'Sätze' })]),
          h('div.stat', {}, [h('div.val', { html: `${fmtNum(vol)}<small>${settings.unit}</small>` }), h('div.lbl', { text: 'Volumen' })]),
          h('div.stat', {}, [h('div.val', { text: String(prs.length) }), h('div.lbl', { text: 'Neue Rekorde' })]),
        ]),
        prs.length ? h('div.card.mt', {}, prs.map(p => h('div.pr-row', {}, [
          h('div', {}, [h('div', { text: '🏆 ' + p.name, style: { fontWeight: 600 } }), h('div.sub', { text: p.type === 'weight' ? 'Neues Maximalgewicht' : 'Neues geschätztes 1RM' })]),
          h('div.val', { text: fmtWeight(Math.round(p.value * 10) / 10, settings.unit) }),
        ]))) : null,
        h('div.field.mt', {}, [h('label', { text: 'Notiz' }), note]),
        h('div.actions', {}, [
          h('button.btn.ghost', { text: 'Zurück', onclick: close }),
          h('button.btn.good', { text: 'Speichern', onclick: () => {
            close();
            restTimer.stop(true);
            const s = finishWorkout(note.value.trim());
            toast(prs.length ? `Gespeichert – ${prs.length} neue${prs.length === 1 ? 'r' : ''} Rekord${prs.length === 1 ? '' : 'e'}! 🏆` : 'Workout gespeichert 💪');
            navigate('/session/' + s.id + '?fresh=1', true);
          } }),
        ]),
      );
    });
  }
}

export function unmount() {
  for (const fn of cleanup) { try { fn(); } catch { /* egal */ } }
  cleanup = [];
  setWakeLockWanted(false);
}
