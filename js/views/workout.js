// Trainingsmodus: eine Übung pro Seite, Fortschrittsleiste oben, Satztabelle (Nr · kg · Wdh · RIR · Haken), letztes Training + Empfehlung, PR-Erkennung
import { h, svgIcon, fmtDuration, fmtNum, fmtShortDate, confirmSheet, openSheet, promptSheet, actionSheet, toast, haptic, parseNum, countUp, escapeHtml } from '../util.js';
import { getActiveWorkout, touchWorkout, finishWorkout, cancelWorkout, getSettings, sessionVolume, getExerciseSettings, updateExerciseSettings, getSessions } from '../store.js';
import { restTimer, unlockAudio, keepAlive, setWakeLockWanted } from '../timer.js';
import { speak, sayWeightReps, primeSpeech } from '../speech.js';
import { recommend, detectSetPRs, sessionPRs, fmtKg, PR_LABELS, warmupSets, platesFor, plateauFor, deloadFor } from '../progression.js';
import { findExercise, EXERCISES, exerciseFigure } from '../exercise-db.js';
import { muscleSets, bodyMapSvg, MUSCLE_NAME, musclesFor, findCustomExercise } from '../muscles.js';
import { openExerciseInfo, figureThumb } from './exercise-info.js';
import { backupDue, exportBackup } from '../backup.js';
import { newMilestones } from '../milestones.js';

let cleanup = [];
let rootEl = null;

export const SET_TYPES = {
  work: { short: 'Arbeit', label: 'Arbeitssatz', desc: 'normaler Satz im Zielbereich' },
  drop: { short: 'Drop', label: 'Drop-Satz', desc: 'direkt im Anschluss mit weniger Gewicht; zählt fürs Volumen, nicht für die Progression' },
  amrap: { short: 'AMRAP', label: 'AMRAP', desc: 'so viele Wiederholungen wie möglich – liefert das sauberste e1RM' },
  fail: { short: 'Failure', label: 'Bis zum Versagen', desc: 'letzte Wiederholung geht nicht mehr sauber (RIR 0)' },
};

export function render(root, { navigate }) {
  const w = getActiveWorkout();
  if (!w) { navigate('/plans', true); return; }
  const settings = getSettings();
  rootEl = root;
  root.classList.add('wk-view');
  setWakeLockWanted(true);
  if (w.currentIndex == null) w.currentIndex = 0;
  w.currentIndex = Math.max(0, Math.min(w.entries.length - 1, w.currentIndex));

  // ---------- Kopf (bleibt beim Blättern stehen) ----------
  const elapsedEl = h('span.elapsed', { text: fmtDuration((Date.now() - w.startedAt) / 1000) });
  const tickEl = setInterval(() => { elapsedEl.textContent = fmtDuration((Date.now() - w.startedAt) / 1000); }, 1000);
  cleanup.push(() => clearInterval(tickEl));

  const progressEl = h('div.wk-progress');
  const restMini = h('span.rest-mini');
  root.append(h('div.workout-head', {}, [
    h('div.row.between', {}, [
      h('button.btn.sm.ghost', { text: 'Abbrechen', onclick: cancel }),
      h('div.center.grow', {}, [h('div.title.truncate', { text: w.planName + (w.deload ? ' · Deload' : '') }), h('div', {}, [elapsedEl, restMini])]),
      h('button.btn.sm.primary', { text: 'Beenden', onclick: finish }),
    ]),
    progressEl,
  ]));

  // ---------- Pausentimer: Ring inline über dem nächsten Satz, Restzeit klein im Kopf ----------
  let restEls = null;         // Elemente des Inline-Rings (siehe restCard)
  let restForEntry = null;    // Übung, zu der die laufende Pause gehört
  let currentDrawSets = null; // Neuzeichnen der Satzliste der aktuellen Übung
  const updateRest = () => {
    restMini.textContent = restTimer.active ? ` · Pause ${fmtDuration(restTimer.remaining())}` : '';
    if (restEls) {
      restEls.time.textContent = fmtDuration(restTimer.remaining());
      restEls.prog.setAttribute('stroke-dashoffset', restEls.C * restTimer.progress());
      restEls.lbl.textContent = restTimer.running ? 'Pause' : 'Pausiert';
    }
  };
  cleanup.push(restTimer.on((type) => {
    if (type === 'done') {
      haptic([200, 100, 200]); restEls = null; restForEntry = null; toast('Pause vorbei – nächster Satz!'); currentDrawSets?.();
      // Sprachansage: nächster Satz oder nächste Übung
      const e = w.entries[w.currentIndex];
      const ni = e.sets.findIndex(s => !s.done);
      if (ni >= 0) speak(`Pause vorbei. Satz ${ni + 1}: ${sayWeightReps(e.sets[ni].weight, e.sets[ni].reps)}`);
      else speak(w.entries[w.currentIndex + 1] ? `Pause vorbei. Weiter mit ${w.entries[w.currentIndex + 1].name}` : 'Pause vorbei.');
    }
    else if (type === 'warn') speak('Noch zehn Sekunden');
    else if (type === 'stop' || type === 'cancel') { restEls = null; restForEntry = null; currentDrawSets?.(); }
    updateRest();
  }));
  updateRest();

  // ---------- Übungsseite ----------
  const body = h('div');
  root.append(body);
  const nav = h('div.wk-nav');
  root.append(nav);

  // Fortschrittsleiste: ein Segment pro Übung (erledigt = grün, aktuell = Akzent) – blättern über „Weiter“
  const drawProgress = () => {
    progressEl.innerHTML = '';
    w.entries.forEach((e, i) => {
      const allDone = e.sets.length && e.sets.every(s => s.done);
      progressEl.append(h('i', { class: i === w.currentIndex ? 'cur' : allDone ? 'done' : '' }));
    });
  };

  const drawNav = () => {
    nav.innerHTML = '';
    const i = w.currentIndex, n = w.entries.length;
    const cur = w.entries[i];
    const curDone = cur.sets.length && cur.sets.every(s => s.done);
    nav.append(h('button.btn.ghost', { html: svgIcon.back + '<span>Zurück</span>', disabled: i === 0, onclick: () => go(i - 1) }));
    if (i < n - 1) nav.append(h('button.btn' + (curDone ? '.primary' : ''), { html: '<span>Weiter</span>' + svgIcon.chevron.replace('class="chev"', 'style="fill:currentColor;width:20px;height:20px"'), onclick: () => go(i + 1) }));
    else nav.append(h('button.btn.good', { html: svgIcon.check + '<span>Abschließen</span>', onclick: finish }));
  };

  /** Element im Scrollbereich unter den klebenden Kopf holen */
  const scrollTo = (el) => {
    if (!el) return;
    const headH = root.querySelector('.workout-head')?.offsetHeight || 0;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - headH - 8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  };

  const go = (i) => {
    if (i < 0 || i >= w.entries.length) return;
    w.currentIndex = i;
    touchWorkout();
    drawExercise();
    root.scrollTop = 0;
  };

  const drawExercise = () => {
    const i = w.currentIndex;
    const entry = w.entries[i];
    body.innerHTML = '';
    drawProgress();
    drawNav();

    const lib = findExercise(entry.name);
    const cust = findCustomExercise(entry.name);
    const musclesTxt = lib ? lib.muscles : cust ? cust.primary.map(k => MUSCLE_NAME[k]).join(', ') : null;
    const rec = recommend({ name: entry.name, sets: entry.targetSets, reps: entry.targetReps, weight: entry.targetWeight, weightStep: entry.weightStep });
    const range = rec.reps;
    const targetTxt = `${entry.targetSets} × ${entry.targetReps}` + ` · Pause ${fmtDuration(entry.restSec)}`;
    const showInfo = () => openExerciseInfo(entry.name, { note: entry.note, target: targetTxt });
    const prev = w.entries[i - 1], next = w.entries[i + 1];
    const supersetWith = entry.superset && next ? next : (prev?.superset ? prev : null);

    // Kopfbereich der Übung – kompakt: Bild, Name, Muskeln, Ziel; alles Weitere hinter „⋯“
    body.append(h('div.wk-step', { text: `Übung ${i + 1} von ${w.entries.length}`, style: { margin: '4px 0 8px' } }));
    // Bühne: animierte Figur groß, tippen zeigt Ausführung + Gerät
    const anim = exerciseFigure(entry.name, { animate: true });
    const thumb = anim ? h('div.wk-stage', { onclick: showInfo }, [h('div.wk-stage-fig', { html: anim }), h('div.wk-stage-hint', { html: svgIcon.info + '<span>Ausführung & Gerät</span>' })]) : null;
    const setup = setupRow(entry);
    const more = () => actionSheet(entry.name, [
      { label: 'Ausführung & Tipps', fn: showInfo },
      { label: 'Gewicht eingeben / Scheibenrechner', fn: () => { const cur = entry.sets.find(s => !s.done) || entry.sets[entry.sets.length - 1]; if (cur) openWeightSheet(entry, cur.weight, (v) => { cur.weight = v; touchWorkout(); drawExercise(); }); } },
      { label: entry.sessionNote ? 'Notiz bearbeiten' : 'Notiz zur Übung', fn: editNote },
      { label: 'Maschineneinstellungen', fn: () => setup.edit() },
      { label: 'Übung tauschen (nur heute)', fn: () => swapExercise(entry) },
    ]);
    if (thumb) body.append(thumb);
    body.append(h('div.wk-ex', {}, [
      h('div.grow', {}, [
        h('div.wk-name', { text: entry.name }),
        musclesTxt ? h('div.wk-muscles', { text: musclesTxt }) : null,
        h('div.wk-target', { text: targetTxt }),
        supersetWith ? h('div', { style: { marginTop: '4px' } }, [h('span.pill.accent', { text: '⇅ Supersatz mit ' + supersetWith.name })]) : null,
        entry.swappedFrom ? h('div.small.faint', { text: `Getauscht (statt ${entry.swappedFrom}) – nur für heute` }) : null,
      ]),
      h('button.btn.icon.ghost.wk-more' + (entry.sessionNote ? '.has-note' : ''), { 'aria-label': 'Mehr', title: 'Mehr', html: svgIcon.more, onclick: more }),
    ]));
    if (entry.note) body.append(h('p.small.muted', { text: entry.note, style: { marginTop: '8px' } }));
    // Notiz zu dieser Übung in dieser Session („Schulter zwickt bei Satz 3“) – erscheint beim nächsten Mal unter „Zuletzt“
    async function editNote() {
      const v = await promptSheet({ title: 'Notiz zu ' + entry.name, value: entry.sessionNote || '', placeholder: 'z.B. Schulter zwickt bei Satz 3', okLabel: 'Speichern' });
      if (v == null) return;
      entry.sessionNote = v; touchWorkout(); drawExercise();
    }
    if (entry.sessionNote) body.append(h('button.wk-setup-line', { style: { marginTop: '8px' }, onclick: editNote }, [h('span.wk-setup-ico', { html: svgIcon.note }), h('span.truncate', { text: entry.sessionNote })]));

    // Maschineneinstellungen (übungsübergreifend gespeichert): Einzeiler nur, wenn etwas gemerkt ist
    body.append(setup.box);

    // Letztes Training + Empfehlung auf einer Zeile; die Begründung nur, wenn sie etwas ändert
    const lastEntry = rec.last?.entry, lastDate = rec.last?.session?.startedAt;
    const recTxt = rec.weight != null
      ? `${fmtKg(rec.weight)} × ${range ? (range.min === range.max ? range.min : `${range.min}–${range.max}`) : entry.targetReps}`
      : `– × ${entry.targetReps}`;
    const lastTxt = lastEntry ? fmtLastSets(lastEntry.sets) : '–';
    const showMsg = rec.status !== 'keep' || rec.decline;
    // Stagnation? Deload-Angebot nur, wenn nicht ohnehin Deload-Woche ist und noch kein Satz erledigt wurde
    const plateau = !w.deload && !entry.deload && !entry.sets.some(s => s.done) ? plateauFor(entry.name) : null;
    const dl = plateau ? deloadFor(plateau.weight ?? rec.weight, entry.weightStep || 2.5, entry.targetSets) : null;
    body.append(h('div.card.mt.wk-brief' + (entry.deload ? '.deload' : ''), {}, [
      h('div.wk-last', {}, [
        h('div', {}, [
          h('div.lbl', { text: 'Zuletzt' + (lastDate ? ` · ${fmtShortDate(lastDate)}` : '') }),
          h('div.val', { text: lastTxt }),
        ]),
        h('div', {}, [
          h('div.lbl', { text: entry.deload || w.deload ? 'Heute · Deload' : 'Heute' }),
          h('div.val.rec', { text: recTxt }),
        ]),
      ]),
      lastEntry?.sessionNote ? h('div.msg', { html: `<b>Notiz zuletzt:</b> ${escapeHtml(lastEntry.sessionNote)}` }) : null,
      showMsg && !plateau ? h('div.msg' + (rec.decline ? '.warn' : ''), { text: rec.decline ? 'Letzte Einheit lag unter deinem bisherigen Niveau – Gewicht reduzieren bleibt deine Entscheidung.' : rec.message }) : null,
      plateau ? h('div.msg.warn', {}, [
        h('div', { text: `Seit ${plateau.sessions} Einheiten kein Fortschritt (bestes e1RM ${fmtKg(Math.round(plateau.bestE1rm))} am ${fmtShortDate(plateau.since)})${plateau.grinding ? ' – zuletzt durchgehend RIR 0.' : '.'}` }),
        h('div.row', { style: { gap: '8px', marginTop: '8px', flexWrap: 'wrap' } }, [
          h('button.btn.sm.ghost', { text: `Deload heute: ${fmtKg(dl.weight)} × ${dl.sets} Sätze`, onclick: () => {
            entry.deload = true;
            entry.sets = entry.sets.filter(s => !s.done).slice(0, dl.sets).map(s => ({ ...s, weight: dl.weight }));
            entry.warmup = null; entry.warmupFor = null;
            touchWorkout(); drawExercise(); toast('Deload für diese Übung – leicht und sauber.');
          } }),
          h('button.btn.sm.ghost', { text: 'Tauschen', onclick: () => swapExercise(entry) }),
        ]),
      ]) : null,
    ]));

    // Sätze
    const setsBox = h('div.mt');
    body.append(setsBox);
    const warmBox = h('div');
    // Aufwärmsätze: aus dem Gewicht von Satz 1, nur solange noch kein Arbeitssatz erledigt ist
    const drawWarmup = () => {
      warmBox.innerHTML = '';
      if (!getSettings().warmupSets || entry.sets.some(s => s.done)) return;
      const workW = entry.sets[0]?.weight;
      if (!workW) return;
      const noneDone = !entry.warmup || entry.warmup.every(s => !s.done);
      if (entry.warmup == null || (noneDone && entry.warmupFor !== workW)) {
        entry.warmup = warmupSets(workW, entry.weightStep || 2.5).map(s => ({ ...s, done: false }));
        entry.warmupFor = workW;
        touchWorkout();
      }
      if (!entry.warmup.length) return;
      const det = h('details.warmup', { open: entry.warmup.some(s => s.done) });
      const doneN = entry.warmup.filter(s => s.done).length;
      det.append(h('summary', { html: `<span>Aufwärmen · ${entry.warmup.length} Sätze</span><span class="faint">${doneN}/${entry.warmup.length} · zählt nicht als Volumen</span>` }));
      entry.warmup.forEach((ws) => {
        const pct = Math.round((ws.weight / workW) * 100);
        det.append(h('div.warm-row' + (ws.done ? '.done' : ''), {}, [
          h('div.grow', {}, [h('span.mono', { text: `${fmtKg(ws.weight)} × ${ws.reps}` }), h('span.faint.small', { text: ` · ${pct} %` })]),
          h('button.btn.sm' + (ws.done ? '.ghost' : ''), { html: ws.done ? svgIcon.check : '<span>Fertig</span>', onclick: () => {
            unlockAudio();
            ws.done = !ws.done; touchWorkout();
            if (ws.done && getSettings().autoRestTimer) { restForEntry = entry; restTimer.start(Math.min(60, entry.restSec || 60)); }
            drawWarmup();
          } }),
        ]));
      });
      warmBox.append(det);
    };
    const drawSets = () => {
      setsBox.innerHTML = '';
      setsBox.append(warmBox);
      drawWarmup();
      // Genau ein Satz ist „aktuell“ (Akzent, mit ±): der erste offene, oder ein angetippter
      const firstOpen = entry.sets.findIndex(s => !s.done);
      const cur = entry.expanded != null && entry.sets[entry.expanded] && !entry.sets[entry.expanded].done ? entry.expanded : firstOpen;
      if (restTimer.active && restForEntry === entry) {
        if (cur >= 0) setsBox.append(restCard(entry, entry.sets[cur], cur));
        else {
          // Alle Sätze fertig, Pause läuft → Vorschau auf die nächste Übung samt Maschineneinstellungen
          const nextEx = w.entries[i + 1];
          setsBox.append(restCard(entry, null, null, nextEx ? {
            title: 'Danach: ' + nextEx.name,
            lines: [
              `${nextEx.targetSets} × ${nextEx.targetReps}` + (nextEx.sets[0]?.weight != null ? ` · ${fmtKg(nextEx.sets[0].weight)}` : ''),
              getExerciseSettings(nextEx.name).setup || null,
            ].filter(Boolean),
            action: { label: 'Weiter', fn: () => go(i + 1) },
          } : { title: 'Letzte Übung geschafft', lines: [], action: { label: 'Abschließen', fn: finish } }));
        }
      }
      setsBox.append(setTable(entry, cur, i, drawSets, drawWarmup));
      setsBox.append(h('div.add-set', {}, [
        h('button.btn.sm.ghost', { text: '– Satz', disabled: entry.sets.length <= 1 || entry.sets[entry.sets.length - 1].done, onclick: () => { entry.sets.pop(); touchWorkout(); drawSets(); drawProgress(); drawNav(); } }),
        h('button.btn.sm.ghost', { text: '+ Satz', onclick: () => {
          const prev = entry.sets[entry.sets.length - 1];
          entry.sets.push({ reps: prev?.reps ?? null, weight: prev?.weight ?? null, done: false });
          touchWorkout(); drawSets(); drawProgress(); drawNav();
        } }),
      ]));
    };
    currentDrawSets = drawSets;
    drawSets();
  };

  // ---------- Satztabelle: # · kg · Wdh · RIR · Haken – ein Tipp pro Satz ----------
  const setTable = (entry, cur, exIdx, redrawAll, onWeightChange) => {
    const step = entry.weightStep || 2.5;
    const unit = getSettings().unit || 'kg';
    const table = h('div.set-table');
    table.append(h('div.st-row.head', {}, [h('span', { text: '#' }), h('span', { text: unit.toUpperCase() }), h('span', { text: 'WDH' }), h('span', { text: 'RIR' }), h('span')]));
    const fmtW = (v) => v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ',');

    // Zahlenzelle: direkt tippbar; in der aktuellen Zeile zusätzlich −/+
    const numCell = (set, key, { decimals, isCur }) => {
      const input = h('input.st-in', { type: 'text', inputmode: decimals ? 'decimal' : 'numeric', value: decimals ? fmtW(set[key]) : (set[key] ?? ''), placeholder: '–', 'aria-label': key === 'weight' ? unit : 'Wiederholungen' });
      const commit = () => {
        const v = parseNum(input.value);
        set[key] = v == null ? null : decimals ? Math.max(0, Math.round(v * 100) / 100) : Math.max(0, Math.round(v));
        touchWorkout();
        if (key === 'weight') onWeightChange?.();
      };
      input.addEventListener('input', commit);
      input.addEventListener('blur', () => { commit(); input.value = decimals ? fmtW(set[key]) : (set[key] ?? ''); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      input.addEventListener('focus', () => input.select());
      if (!isCur) return h('div.st-num', {}, [input]);
      const bump = (d) => { const v = Math.max(0, (Number(set[key]) || 0) + d); input.value = decimals ? fmtW(v) : String(v); commit(); haptic(5); };
      return h('div.st-num.cur', {}, [
        h('button.st-pm', { text: '−', 'aria-label': 'weniger', onclick: () => bump(decimals ? -step : -1) }),
        input,
        h('button.st-pm', { text: '+', 'aria-label': 'mehr', onclick: () => bump(decimals ? step : 1) }),
      ]);
    };

    entry.sets.forEach((set, si) => {
      const isCur = si === cur && !set.done;
      const row = h('div.st-row' + (set.done ? '.done' : isCur ? '.cur' : '.open'));
      // Nummer + Satztyp (Arbeit/Drop/AMRAP/Failure) – tippen öffnet die Auswahl
      row.append(h('button.st-no' + (set.type ? '.' + set.type : ''), { 'aria-label': 'Satztyp', onclick: () => {
        actionSheet(`Satz ${si + 1} · Typ`, Object.entries(SET_TYPES).map(([k, t]) => ({ label: `${t.label} – ${t.desc}`, fn: () => {
          set.type = k === 'work' ? undefined : k;
          if (k === 'amrap' || k === 'fail') set.rir = 0;
          touchWorkout(); redrawAll();
        } })));
      } }, [h('span', { text: String(si + 1) }), set.type ? h('small', { text: SET_TYPES[set.type].short }) : null]));

      if (set.done) row.append(h('div.st-val', { text: fmtW(set.weight) || '–' }), h('div.st-val', { text: set.reps ?? '–' }));
      else row.append(numCell(set, 'weight', { decimals: true, isCur }), numCell(set, 'reps', { decimals: false, isCur }));

      // RIR: tippen zählt hoch (– → 0 → 1 → 2 → 3 → 4+ → –)
      const rirLbl = () => set.rir == null ? '–' : set.rir === 4 ? '4+' : String(set.rir);
      const rir = h('button.st-rir' + (set.rir != null ? '.on' : ''), { text: rirLbl(), 'aria-label': 'Wiederholungen im Tank', onclick: () => {
        set.rir = set.rir == null ? 0 : set.rir >= 4 ? null : set.rir + 1;
        touchWorkout(); rir.textContent = rirLbl(); rir.classList.toggle('on', set.rir != null);
      } });
      row.append(rir);
      // Haken: Satz abschließen bzw. wieder öffnen
      const check = h('button.st-check' + (set.done ? '.on' : ''), { 'aria-label': set.done ? 'Satz wieder öffnen' : 'Satz abschließen', html: svgIcon.check, onclick: () => {
        if (set.done) { set.done = false; entry.expanded = si; restTimer.stop(true); touchWorkout(); redrawAll(); drawProgress(); drawNav(); return; }
        completeSet(entry, set, si, exIdx, redrawAll, row, check);
      } });
      row.append(check);
      // Offene, nicht aktuelle Zeile antippen → wird aktuell (±)
      if (!set.done && !isCur) row.addEventListener('click', (e) => { if (e.target.closest('button, input')) return; entry.expanded = si; touchWorkout(); redrawAll(); });
      table.append(row);
    });
    return table;
  };

  /** Satz abschließen: Werte auffüllen, PR prüfen, Pause/Supersatz steuern, Folge-Sätze vorbelegen */
  const completeSet = (entry, set, si, exIdx, redrawAll, row, check) => {
    unlockAudio(); primeSpeech();
    if (set.weight == null) set.weight = entry.targetWeight ?? null;
    if (set.reps == null) set.reps = parseNum(entry.targetReps) ?? null;
    set.done = true;
    set.doneAt = Date.now();
    entry.expanded = null; // nächster offener Satz wird aktuell
    haptic(15);
    // Alle noch offenen Sätze ohne Werte vorbelegen
    for (const s of entry.sets) if (!s.done) { if (s.weight == null) s.weight = set.weight; if (s.reps == null) s.reps = set.reps; }
    touchWorkout();
    // PR-Erkennung gegen Historie + frühere Sätze dieses Workouts
    const earlier = entry.sets.filter((s, j) => j !== si && s.done);
    const prs = detectSetPRs(entry.name, set, earlier);
    if (prs.length) { haptic([30, 40, 30]); showPrToast(entry.name, prs); }

    // Supersatz: A → kein Timer, direkt zu B; B → Timer, danach zurück zu A
    const nextEx = w.entries[exIdx + 1], prevEx = w.entries[exIdx - 1];
    const isFirstOfPair = entry.superset && nextEx;
    const isSecondOfPair = prevEx?.superset;
    const isLastOverall = exIdx === w.entries.length - 1 && entry.sets.every(s => s.done);
    let startRest = false;
    if (isFirstOfPair) {
      toast(`Supersatz: weiter mit ${nextEx.name}`, { action: { label: 'Weiter', fn: () => go(exIdx + 1) }, duration: 6000 });
    } else {
      startRest = getSettings().autoRestTimer && !isLastOverall;
      if (isSecondOfPair && prevEx.sets.some(s => !s.done)) {
        toast(`Nächste Runde: ${prevEx.name}`, { action: { label: 'Zurück', fn: () => go(exIdx - 1) }, duration: 6000 });
      }
    }

    // Lautloses Keep-Alive-Audio muss synchron in der Tipp-Geste starten (iOS), der Timer darf später kommen
    if (startRest) keepAlive.start();

    // Haken zeichnen + Zeile einrasten, dann neu zeichnen und den Pausenring ins Bild holen
    check.innerHTML = svgIcon.checkDraw; check.classList.add('on');
    row.classList.add('snap', 'done'); row.classList.remove('cur');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      if (startRest) { restForEntry = entry; restTimer.start(entry.restSec || getSettings().defaultRestSec); }
      redrawAll(); drawProgress(); drawNav();
      if (restEls?.card) scrollTo(restEls.card);
    }, reduce ? 0 : 420);
  };

  // ---------- Pausenring (inline über dem nächsten Satz, oder mit Vorschau auf die nächste Übung) ----------
  const restCard = (entry, set, si, preview = null) => {
    const R = 27, C = 2 * Math.PI * R;
    const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ringSvg.setAttribute('viewBox', '0 0 66 66');
    const mk = (cls, extra = '') => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', cls); c.setAttribute('cx', 33); c.setAttribute('cy', 33); c.setAttribute('r', R); if (extra) { c.setAttribute('stroke-dasharray', C); c.setAttribute('stroke-dashoffset', C * restTimer.progress()); } return c; };
    const prog = mk('prog', 'p');
    ringSvg.append(mk('track'), prog);
    const time = h('div.time', { text: fmtDuration(restTimer.remaining()) });
    const nextEl = preview
      ? h('div.next-ex', {}, [h('div.next', { text: preview.title, style: { fontWeight: 700, color: 'var(--text)' } }), ...preview.lines.map(t => h('div.next', { text: t }))])
      : h('div.next', { text: `Satz ${si + 1}: ${fmtKg(set.weight)} × ${set.reps ?? '–'}` });
    const card = h('div.rest-ring.pop', {}, [
      h('div.ringbox', {}, [ringSvg, h('div.inner', { html: svgIcon.clock })]),
      h('div.grow', {}, [h('div.lbl', { text: restTimer.running ? 'Pause' : 'Pausiert' }), time, nextEl]),
      h('div.btns', {}, [
        h('button.btn.ghost', { text: '+30s', onclick: (e) => { e.stopPropagation(); restTimer.add(30); } }),
        preview
          ? h('button.btn.primary', { text: preview.action.label, onclick: (e) => { e.stopPropagation(); preview.action.fn(); } })
          : h('button.btn.primary', { text: 'Skip', onclick: (e) => { e.stopPropagation(); restTimer.stop(true); } }),
      ]),
    ]);
    restEls = { time, prog, C, card, lbl: card.querySelector('.lbl') };
    return card;
  };

  // ---------- Übung tauschen (nur für diese Session) ----------
  function swapExercise(entry) {
    const mine = musclesFor(entry.name).primary;
    const candidates = EXERCISES.filter(e => e.name !== entry.name && e.primary?.some(m => mine.includes(m)));
    openSheet((sheet, close) => {
      const apply = (name) => {
        const orig = entry.swappedFrom || entry.name;
        entry.swappedFrom = orig === name ? null : orig;
        entry.name = name;
        // Vorbelegung aus der Historie der neuen Übung
        const rec = recommend({ name, sets: entry.targetSets, reps: entry.targetReps, weight: null, weightStep: entry.weightStep });
        for (const s of entry.sets) if (!s.done) { s.weight = rec.weight ?? null; s.reps = rec.reps?.min ?? s.reps; }
        entry.warmup = null; entry.warmupFor = null;
        touchWorkout(); close(); drawExercise();
        toast(`Getauscht: ${name}`);
      };
      const custom = h('input.input', { type: 'text', placeholder: 'Andere Übung eingeben …' });
      custom.addEventListener('keydown', (e) => { if (e.key === 'Enter' && custom.value.trim()) apply(custom.value.trim()); });
      sheet.append(
        h('h2', { text: 'Übung tauschen' }),
        h('p.small.muted.mb', { text: `Alternative für heute (gleiche Muskelgruppe: ${mine.map(m => MUSCLE_NAME[m]).join(', ') || '–'}). Der Plan bleibt unverändert.` }),
        entry.swappedFrom ? h('button.btn.ghost.block.mb', { text: `Zurück zu ${entry.swappedFrom}`, onclick: () => apply(entry.swappedFrom) }) : null,
        h('div.card', {}, candidates.length ? candidates.map(e => h('div.lib-row', { onclick: () => apply(e.name) }, [
          figureThumb(e.name), h('div.grow', {}, [h('div', { text: e.name, style: { fontWeight: 600 } }), h('div.small.faint', { text: e.muscles })]),
        ])) : [h('p.small.muted', { text: 'Keine passende Alternative in der Bibliothek.' })]),
        h('div.row.mt', {}, [custom, h('button.btn.sm.primary', { text: 'OK', onclick: () => { if (custom.value.trim()) apply(custom.value.trim()); } })]),
        h('div.actions', {}, [h('button.btn.block', { text: 'Abbrechen', onclick: close })]),
      );
    });
  }

  // ---------- Scheibenrechner / Gewicht direkt eingeben ----------
  function openWeightSheet(entry, current, commit) {
    const es = getExerciseSettings(entry.name);
    const custom = findCustomExercise(entry.name);
    const isBarbell = custom ? !!custom.barbell : (entry.weightStep || 2.5) === 2.5 && !/kurzhantel|kh\b|maschine|kabel/i.test(entry.name);
    let bar = es.barWeight != null ? es.barWeight : (isBarbell ? getSettings().barWeight : 0);
    let value = current ?? 0;
    openSheet((sheet, close) => {
      const input = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(value).replace('.', ','), style: { fontSize: '26px', minHeight: '60px' } });
      const platesBox = h('div');
      const barLabel = (b) => b ? `${b} kg` : 'Ohne';
      const barSeg = h('div.seg', {}, [20, 15, 10, 0].map(b => h('button', { text: barLabel(b), class: bar === b ? 'active' : '', onclick: () => {
        bar = b; updateExerciseSettings(entry.name, { barWeight: b });
        for (const x of barSeg.children) x.classList.toggle('active', x.textContent === barLabel(b));
        drawPlates();
      } })));
      const drawPlates = () => {
        platesBox.innerHTML = '';
        const v = parseNum(input.value);
        if (v == null) return;
        if (!bar) { platesBox.append(h('p.small.faint', { text: 'Ohne Stange: keine Scheibenberechnung.' })); return; }
        if (v < bar) { platesBox.append(h('p.small.faint', { text: `Zielgewicht liegt unter dem Stangengewicht (${fmtKg(bar)}).` })); return; }
        const r = platesFor(v, bar);
        platesBox.append(h('div.small.faint', { text: 'Pro Seite' }));
        platesBox.append(h('div.plates', {}, r.perSide.length ? r.perSide.map(p => h('span.plate', { class: 'p' + String(p).replace('.', '_'), text: String(p).replace('.', ',') })) : [h('span.faint', { text: 'nur die Stange' })]));
        platesBox.append(h('div.small.mt', { html: `= <b>${fmtKg(r.total)}</b>` + (r.exact ? '' : ` <span class="faint">(${fmtKg(v)} nicht exakt aufteilbar, Rest ${String(r.remainder).replace('.', ',')} kg)</span>`) }));
      };
      input.addEventListener('input', drawPlates);
      const quick = h('div.grid-4', {}, [-5, -2.5, 2.5, 5].map(d => h('button.btn.sm.ghost', { text: (d > 0 ? '+' : '') + String(d).replace('.', ','), onclick: () => {
        const v = Math.max(0, (parseNum(input.value) || 0) + d); input.value = String(Math.round(v * 100) / 100).replace('.', ','); drawPlates();
      } })));
      // Maschine/Kabel/Kurzhantel: Scheibenrechner eingeklappt, per Link erreichbar
      const platesSection = h('div', { hidden: !isBarbell && es.barWeight == null }, [
        h('div.subhead', { style: { margin: '14px 0 6px' } }, [h('h2', { text: 'Scheibenrechner' })]),
        barSeg, h('div.mt', {}, [platesBox]),
      ]);
      const platesLink = h('button.btn.sm.ghost.mt', { text: 'Scheibenrechner anzeigen', hidden: !platesSection.hidden, onclick: () => { platesSection.hidden = false; platesLink.hidden = true; } });
      sheet.append(
        h('h2', { text: 'Gewicht' }),
        input, h('div.mt', {}, [quick]),
        platesLink, platesSection,
        h('div.actions', {}, [
          h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
          h('button.btn.primary', { text: 'Übernehmen', onclick: () => { const v = parseNum(input.value); if (v != null) commit(v); close(); } }),
        ]),
      );
      drawPlates();
      setTimeout(() => { input.focus(); input.select(); }, 60);
    });
  }

  drawExercise();

  // ---------- Abbrechen / Abschließen ----------
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
    const prs = sessionPRs(preview);
    const ms = muscleSets([preview]);
    const trained = Object.entries(ms.totals).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    restTimer.stop(true); // wer abschließt, braucht keine Pause mehr

    openSheet((sheet, close) => {
      const note = h('textarea.input', { placeholder: 'Wie lief’s? (optional)' });
      // Zahlen zählen hoch
      const setsEl = h('span'), volEl = h('span'), prEl = h('span');
      setTimeout(() => {
        countUp(setsEl, doneSets, { duration: 500 });
        countUp(volEl, vol, { duration: 700, format: (v) => fmtNum(v) });
        countUp(prEl, prs.length, { duration: 400 });
      }, 120);
      sheet.append(
        h('h2', { text: 'Workout abschließen' }),
        h('div.stats', {}, [
          h('div.stat', {}, [h('div.val', { text: fmtDuration(dur) }), h('div.lbl', { text: 'Dauer' })]),
          h('div.stat', {}, [h('div.val', {}, [setsEl]), h('div.lbl', { text: 'Sätze' })]),
          h('div.stat', {}, [h('div.val', {}, [volEl, h('small', { text: settings.unit })]), h('div.lbl', { text: 'Volumen' })]),
          h('div.stat', {}, [h('div.val', {}, [prEl]), h('div.lbl', { text: 'Neue Rekorde' })]),
        ]),
        h('div.subhead', { style: { margin: '14px 0 8px' } }, [h('h2', { text: 'Trainierte Muskeln' })]),
        h('div.grid-2', {}, [
          h('div.bodymap-wrap.compact', { html: bodyMapSvg('front', ms.totals, { mode: 'session' }) }),
          h('div.bodymap-wrap.compact', { html: bodyMapSvg('back', ms.totals, { mode: 'session' }) }),
        ]),
        h('div.small.muted', { style: { marginTop: '8px' }, text: trained.map(([k, n]) => `${MUSCLE_NAME[k]} ${fmtSets(n)}`).join(' · ') }),
        prs.length ? h('div.card.mt', {}, prs.map(p => h('div.pr-row', {}, [
          h('div', {}, [h('div', { text: p.name, style: { fontWeight: 600 } }), h('div.sub', { text: PR_LABELS[p.type] })]),
          h('div.val', { text: p.type === 'volume' ? `${fmtNum(p.value)} ${settings.unit}` : p.type === 'e1rm' ? `${fmtKg(Math.round(p.value * 10) / 10)} 1RM` : `${fmtKg(p.weight)} × ${p.reps}` }),
        ]))) : null,
        h('div.field.mt', {}, [h('label', { text: 'Notiz' }), note]),
        h('div.actions', {}, [
          h('button.btn.ghost', { text: 'Zurück', onclick: close }),
          h('button.btn.good', { text: 'Speichern', onclick: () => {
            close();
            restTimer.stop(true);
            const s = finishWorkout(note.value.trim());
            toast(prs.length ? `Gespeichert – ${prs.length} neue${prs.length === 1 ? 'r' : ''} Rekord${prs.length === 1 ? '' : 'e'}!` : 'Workout gespeichert');
            navigate('/session/' + s.id + '?fresh=1', true);
            // Daten liegen nur auf dem Gerät – alle 10 Workouts an die Sicherung erinnern
            const fresh = newMilestones();
            if (fresh.length) setTimeout(() => toast('Meilenstein: ' + fresh.map(m => m.title).join(', '), { duration: 3500 }), 1200);
            if (backupDue()) setTimeout(() => toast('10 Workouts seit der letzten Sicherung', { action: { label: 'Jetzt sichern', fn: exportBackup }, duration: 9000 }), fresh.length ? 5000 : 2600);
          } }),
        ]),
      );
    });
  }
}

export function unmount() {
  for (const fn of cleanup) { try { fn(); } catch { /* egal */ } }
  cleanup = [];
  rootEl?.classList.remove('wk-view');
  rootEl = null;
  setWakeLockWanted(false);
}

// ---------- Stepper ----------

function fmtSets(n) { return (Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')) + ' S.'; }

/** „60 × 6 · 6 · 5“ – gleiches Gewicht wird zusammengefasst, sonst „60 × 6 · 65 × 5“ */
function fmtLastSets(sets) {
  const parts = [];
  let curW = null, reps = [];
  const flush = () => { if (reps.length) parts.push(`${fmtKg(curW)} × ${reps.join(' · ')}`); reps = []; };
  for (const s of sets) {
    if (s.weight !== curW) { flush(); curW = s.weight; }
    reps.push(s.reps ?? '–');
  }
  flush();
  return parts.join('  |  ') || '–';
}

// ---------- Maschineneinstellungen: Einzeiler ↔ Eingabefeld ----------

function setupRow(entry) {
  const box = h('div.wk-setup');
  let edit = null;
  const draw = () => {
    box.innerHTML = '';
    const setup = getExerciseSettings(entry.name).setup || '';
    edit = () => {
      const input = h('input.input', { type: 'text', value: setup, placeholder: 'Sitz 4, Griffhöhe 3, Pin links …', style: { minHeight: '42px', fontSize: '15px' } });
      const commit = () => { updateExerciseSettings(entry.name, { setup: input.value.trim() }); draw(); };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      box.innerHTML = '';
      box.hidden = false;
      box.append(h('div.row', { style: { gap: '8px' } }, [h('span.wk-setup-ico', { html: svgIcon.wrench }), input]));
      setTimeout(() => input.focus(), 30);
    };
    // Leer bleibt unsichtbar – erreichbar über „⋯ → Maschineneinstellungen“
    box.hidden = !setup;
    if (setup) box.append(h('button.wk-setup-line', { onclick: edit }, [h('span.wk-setup-ico', { html: svgIcon.wrench }), h('span.truncate', { text: setup })]));
  };
  draw();
  return { box, edit: () => edit() };
}

// ---------- PR-Animation ----------

let prTimer = null;
export function showPrToast(name, prs) {
  document.querySelector('.pr-toast')?.remove();
  clearTimeout(prTimer);
  // Wichtigsten Rekord wählen: e1RM (mit %), sonst Gewicht, sonst Wdh
  const p = prs.find(x => x.type === 'e1rm') || prs.find(x => x.type === 'weight') || prs[0];
  const lines = [];
  if (p.type === 'reps') {
    lines.push(h('div.pr-val', { text: `${fmtKg(p.weight)} × ${p.reps}` }));
    lines.push(h('div.pr-sub', { text: `Meiste Wiederholungen bei ${fmtKg(p.weight)} – bisher ${p.prev}` }));
  } else {
    lines.push(h('div.pr-val', { text: `${fmtKg(p.weight)} × ${p.reps}` }));
    lines.push(h('div.pr-sub', { html: `Geschätztes 1RM: <b>${fmtKg(Math.round(p.e1rm))}</b>` }));
    const e = prs.find(x => x.type === 'e1rm');
    if (e?.pct != null) lines.push(h('div.pr-sub.pr-delta', { text: `+${String(e.pct).replace('.', ',')} % gegenüber deinem bisherigen Rekord` }));
    else if (p.type === 'weight' && p.prev) lines.push(h('div.pr-sub.pr-delta', { text: `Höchstes Gewicht – bisher ${fmtKg(p.prev)}` }));
    else if (p.type === 'weight') lines.push(h('div.pr-sub.pr-delta', { text: 'Höchstes Gewicht bei dieser Übung' }));
  }
  const el = h('div.pr-toast', { role: 'status' }, [
    h('div.pr-head', { html: svgIcon.trophy.replace('class="ico"', 'class="ico sm"') + '<span>Neuer PR</span>' }),
    h('div.pr-name', { text: name }),
    ...lines,
  ]);
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', dismiss);
  document.body.append(el);
  prTimer = setTimeout(dismiss, 4500);
}
