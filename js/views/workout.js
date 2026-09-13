// Trainingsmodus: eine Übung pro Seite, große Stepper, letztes Training + Empfehlung, PR-Erkennung
import { h, svgIcon, fmtDuration, fmtNum, fmtDate, confirmSheet, openSheet, toast, haptic, parseNum } from '../util.js';
import { getActiveWorkout, touchWorkout, finishWorkout, cancelWorkout, getSettings, sessionVolume, getExerciseSettings, updateExerciseSettings } from '../store.js';
import { restTimer, unlockAudio, setWakeLockWanted } from '../timer.js';
import { recommend, detectSetPRs, sessionPRs, fmtKg, PR_LABELS, warmupSets, platesFor } from '../progression.js';
import { findExercise, EXERCISES } from '../exercise-db.js';
import { muscleSets, bodyMapSvg, MUSCLE_NAME, musclesFor } from '../muscles.js';
import { openExerciseInfo, figureThumb } from './exercise-info.js';

let cleanup = [];
let rootEl = null;

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
  const restBox = h('div');
  root.append(h('div.workout-head', {}, [
    h('div.row.between', {}, [
      h('button.btn.sm.ghost', { text: 'Abbrechen', onclick: cancel }),
      h('div.center.grow', {}, [h('div.title.truncate', { text: w.planName }), elapsedEl]),
      h('button.btn.sm.primary', { text: 'Beenden', onclick: finish }),
    ]),
    progressEl,
    restBox,
  ]));

  // ---------- Pausentimer-Leiste ----------
  let restEls = null;
  const drawRest = () => {
    if (!restTimer.active) { restBox.innerHTML = ''; restEls = null; return; }
    if (!restEls) {
      restEls = { lbl: h('div.lbl'), time: h('div.time'), bar: h('div.bar') };
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

  // ---------- Übungsseite ----------
  const body = h('div');
  root.append(body);
  const nav = h('div.wk-nav');
  root.append(nav);

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
    nav.append(h('button.btn.ghost', { html: svgIcon.back + '<span>Vorherige</span>', disabled: i === 0, onclick: () => go(i - 1) }));
    if (i < n - 1) nav.append(h('button.btn' + (curDone ? '.primary' : ''), { html: '<span>Nächste Übung</span>' + svgIcon.chevron.replace('class="chev"', 'style="fill:currentColor;width:20px;height:20px"'), onclick: () => go(i + 1) }));
    else nav.append(h('button.btn.good', { html: svgIcon.check + '<span>Training abschließen</span>', onclick: finish }));
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
    const rec = recommend({ name: entry.name, sets: entry.targetSets, reps: entry.targetReps, weight: entry.targetWeight, weightStep: entry.weightStep });
    const range = rec.reps;
    const targetTxt = `${entry.targetSets} × ${entry.targetReps}` + ` · Pause ${fmtDuration(entry.restSec)}`;
    const showInfo = () => openExerciseInfo(entry.name, { note: entry.note, target: targetTxt });
    const prev = w.entries[i - 1], next = w.entries[i + 1];
    const supersetWith = entry.superset && next ? next : (prev?.superset ? prev : null);

    // Kopfbereich der Übung
    body.append(h('div.wk-step', { text: `Übung ${i + 1} von ${w.entries.length}`, style: { margin: '4px 0 8px' } }));
    body.append(h('div.wk-ex', {}, [
      figureThumb(entry.name) ? h('div', { onclick: showInfo }, [figureThumb(entry.name)]) : null,
      h('div.grow', {}, [
        h('div.wk-name', { text: entry.name }),
        lib ? h('div.wk-muscles', { text: lib.muscles }) : null,
        h('div.wk-target', { text: targetTxt }),
        supersetWith ? h('div', { style: { marginTop: '4px' } }, [h('span.pill.accent', { text: '⇅ Supersatz mit ' + supersetWith.name })]) : null,
        entry.swappedFrom ? h('div.small.faint', { text: `Getauscht (statt ${entry.swappedFrom}) – nur für heute` }) : null,
        h('div.row', { style: { marginTop: '6px', gap: '8px', flexWrap: 'wrap' } }, [
          h('button.btn.sm.ghost', { text: 'ⓘ Ausführung', onclick: showInfo }),
          h('button.btn.sm.ghost', { text: '⇄ Tauschen', onclick: () => swapExercise(entry) }),
        ]),
      ]),
    ]));
    if (entry.note) body.append(h('p.small.muted', { text: entry.note, style: { marginTop: '8px' } }));

    // Maschineneinstellungen (übungsübergreifend gespeichert)
    const es = getExerciseSettings(entry.name);
    const setupIn = h('input.input', { type: 'text', value: es.setup || '', placeholder: 'Maschineneinstellungen: Sitz 4, Griffhöhe 3, Pin links …', style: { minHeight: '42px', fontSize: '15px' } });
    setupIn.addEventListener('change', () => updateExerciseSettings(entry.name, { setup: setupIn.value.trim() }));
    body.append(h('div.row', { style: { marginTop: '10px', gap: '8px' } }, [h('span', { text: '🔧', style: { fontSize: '18px' } }), setupIn]));

    // Letztes Training + Empfehlung
    const lastEntry = rec.last?.entry, lastDate = rec.last?.session?.startedAt;
    const recTxt = rec.weight != null
      ? `${fmtKg(rec.weight)} × ${range ? (range.min === range.max ? range.min : `${range.min}–${range.max}`) : entry.targetReps}`
      : `– × ${entry.targetReps}`;
    body.append(h('div.card.mt', {}, [
      h('div.wk-last', {}, [
        h('div', {}, [
          h('div.lbl', { text: 'Letztes Training' + (lastDate ? ` · ${fmtDate(lastDate)}` : '') }),
          lastEntry
            ? h('div.val', { html: lastEntry.sets.map(s => `${fmtKg(s.weight)} × ${s.reps ?? '–'}`).join('<br>') })
            : h('div.muted.small', { text: 'Noch keine Einheit protokolliert.' }),
        ]),
        h('div', {}, [
          h('div.lbl', { text: 'Heute empfohlen' }),
          h('div.val.rec', { text: recTxt }),
          h('div.msg', { text: rec.message }),
          rec.decline ? h('div.msg.warn', { text: '⚠︎ Letzte Einheit lag unter deinem bisherigen Leistungsniveau. Gewicht reduzieren bleibt deine Entscheidung.' }) : null,
        ]),
      ]),
    ]));

    // Sätze
    const setsBox = h('div.mt');
    body.append(setsBox);
    const drawSets = () => {
      setsBox.innerHTML = '';
      // Aufwärmsätze: aus dem Arbeitsgewicht des ersten Satzes, zählen nicht als Arbeitssätze
      if (getSettings().warmupSets) {
        const workW = entry.sets[0]?.weight;
        const noneDone = !entry.warmup || entry.warmup.every(s => !s.done);
        if (workW && (entry.warmup == null || (noneDone && entry.warmupFor !== workW))) {
          entry.warmup = warmupSets(workW, entry.weightStep || 2.5).map(s => ({ ...s, done: false }));
          entry.warmupFor = workW;
          touchWorkout();
        }
        if (entry.warmup && entry.warmup.length) {
          const det = h('details.warmup');
          const doneN = entry.warmup.filter(s => s.done).length;
          det.append(h('summary', { html: `<span>Aufwärmen · ${entry.warmup.length} Sätze</span><span class="faint">${doneN}/${entry.warmup.length} · zählt nicht als Volumen</span>` }));
          entry.warmup.forEach((ws, wi) => {
            const pct = Math.round((ws.weight / workW) * 100);
            det.append(h('div.warm-row' + (ws.done ? '.done' : ''), {}, [
              h('div.grow', {}, [h('span.mono', { text: `${fmtKg(ws.weight)} × ${ws.reps}` }), h('span.faint.small', { text: ` · ${pct} %` })]),
              h('button.btn.sm' + (ws.done ? '.ghost' : ''), { html: ws.done ? svgIcon.check : '<span>Fertig</span>', onclick: () => {
                unlockAudio();
                ws.done = !ws.done; touchWorkout();
                if (ws.done && getSettings().autoRestTimer) restTimer.start(Math.min(60, entry.restSec || 60));
                drawSets();
              } }),
            ]));
          });
          setsBox.append(det);
        }
      }
      entry.sets.forEach((set, si) => setsBox.append(setCard(entry, set, si, i, drawSets)));
      setsBox.append(h('div.add-set', {}, [
        h('button.btn.sm.ghost', { text: '– Satz', disabled: entry.sets.length <= 1 || entry.sets[entry.sets.length - 1].done, onclick: () => { entry.sets.pop(); touchWorkout(); drawSets(); drawProgress(); drawNav(); } }),
        h('button.btn.sm.ghost', { text: '+ Satz', onclick: () => {
          const prev = entry.sets[entry.sets.length - 1];
          entry.sets.push({ reps: prev?.reps ?? null, weight: prev?.weight ?? null, done: false });
          touchWorkout(); drawSets(); drawProgress(); drawNav();
        } }),
      ]));
    };
    drawSets();
  };

  // ---------- Satz-Karte mit Steppern ----------
  const setCard = (entry, set, si, exIdx, redrawAll) => {
    const card = h('div.card.set-card' + (set.done ? '.done' : ''));
    const step = entry.weightStep || 2.5;
    const sum = h('div.set-sum', { text: `${fmtKg(set.weight)} × ${set.reps ?? '–'}` });
    const head = h('div.set-head', {}, [
      h('div.row', { style: { gap: '8px' } }, [h('div.set-title', { text: `Satz ${si + 1}` }), sum]),
      set.done ? h('div.check-badge', { html: svgIcon.check }) : null,
    ]);
    card.append(head);

    const updateSum = () => { sum.textContent = `${fmtKg(set.weight)} × ${set.reps ?? '–'}` + (set.rir != null ? ` · RIR ${set.rir}` : ''); };
    const weightStepper = stepper({
      value: set.weight, step, unit: getSettings().unit, min: 0, decimals: true,
      onChange: (v) => { set.weight = v; updateSum(); touchWorkout(); },
      onTap: (setValue) => openWeightSheet(entry, set.weight, (v) => { setValue(v); }),
    });
    const repsStepper = stepper({
      value: set.reps, step: 1, unit: 'Wdh', min: 0, decimals: false,
      onChange: (v) => { set.reps = v; updateSum(); touchWorkout(); },
    });
    card.append(h('div.steppers', {}, [weightStepper, repsStepper]));
    updateSum();

    // RIR-Chips (Wiederholungen im Tank)
    const rirRow = h('div.rir-row', {}, [h('span.lbl', { text: 'RIR' })]);
    for (const r of [0, 1, 2, 3, 4]) {
      const chip = h('button.chip' + (set.rir === r ? '.on' : ''), { text: r === 4 ? '4+' : String(r), onclick: () => {
        set.rir = set.rir === r ? null : r; touchWorkout(); updateSum();
        for (const c of rirRow.querySelectorAll('.chip')) c.classList.toggle('on', set.rir != null && c.textContent === (set.rir === 4 ? '4+' : String(set.rir)));
      } });
      rirRow.append(chip);
    }
    card.append(rirRow);

    const btn = h('button.btn.block.set-done-btn' + (set.done ? '.ghost' : '.good'), {
      html: set.done ? '<span>Erledigt – tippen zum Zurücksetzen</span>' : svgIcon.check + '<span>Satz abschließen</span>',
      onclick: () => {
        unlockAudio();
        if (set.done) {
          set.done = false; restTimer.stop(true); touchWorkout(); redrawAll(); drawProgress(); drawNav(); return;
        }
        if (set.weight == null) set.weight = entry.targetWeight ?? null;
        if (set.reps == null) set.reps = parseNum(entry.targetReps) ?? null;
        set.done = true;
        set.doneAt = Date.now();
        haptic(15);
        // Nächsten offenen Satz vorbelegen
        const next = entry.sets[si + 1];
        if (next && !next.done) { if (next.weight == null) next.weight = set.weight; if (next.reps == null) next.reps = set.reps; }
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
        if (isFirstOfPair) {
          toast(`Supersatz: weiter mit ${nextEx.name}`, { action: { label: 'Weiter', fn: () => go(exIdx + 1) }, duration: 6000 });
        } else {
          if (getSettings().autoRestTimer && !isLastOverall) restTimer.start(entry.restSec || getSettings().defaultRestSec);
          if (isSecondOfPair && prevEx.sets.some(s => !s.done)) {
            toast(`Nächste Runde: ${prevEx.name}`, { action: { label: 'Zurück', fn: () => go(exIdx - 1) }, duration: 6000 });
          }
        }
        redrawAll(); drawProgress(); drawNav();
      },
    });
    card.append(btn);
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
    const isBarbell = (entry.weightStep || 2.5) === 2.5 && !/kurzhantel|kh\b|maschine|kabel/i.test(entry.name);
    let bar = es.barWeight != null ? es.barWeight : (isBarbell ? getSettings().barWeight : 0);
    let value = current ?? 0;
    openSheet((sheet, close) => {
      const input = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(value).replace('.', ','), style: { fontSize: '26px', minHeight: '60px' } });
      const platesBox = h('div');
      const barSeg = h('div.seg', {}, [20, 15, 10, 0].map(b => h('button', { text: b ? `${b} kg` : 'Keine Stange', class: bar === b ? 'active' : '', onclick: () => {
        bar = b; updateExerciseSettings(entry.name, { barWeight: b });
        for (const x of barSeg.children) x.classList.toggle('active', x.textContent === (b ? `${b} kg` : 'Keine Stange'));
        drawPlates();
      } })));
      const drawPlates = () => {
        platesBox.innerHTML = '';
        const v = parseNum(input.value);
        if (v == null) return;
        if (!bar) { platesBox.append(h('p.small.faint', { text: 'Ohne Stange (Maschine/Kurzhantel): keine Scheibenberechnung.' })); return; }
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
      sheet.append(
        h('h2', { text: 'Gewicht' }),
        input, h('div.mt', {}, [quick]),
        h('div.subhead', { style: { margin: '14px 0 6px' } }, [h('h2', { text: 'Scheibenrechner' })]),
        barSeg, h('div.mt', {}, [platesBox]),
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

    openSheet((sheet, close) => {
      const note = h('textarea.input', { placeholder: 'Wie lief’s? (optional)' });
      sheet.append(
        h('h2', { text: 'Workout abschließen' }),
        h('div.stats', {}, [
          h('div.stat', {}, [h('div.val', { text: fmtDuration(dur) }), h('div.lbl', { text: 'Dauer' })]),
          h('div.stat', {}, [h('div.val', { text: String(doneSets) }), h('div.lbl', { text: 'Sätze' })]),
          h('div.stat', {}, [h('div.val', { html: `${fmtNum(vol)}<small>${settings.unit}</small>` }), h('div.lbl', { text: 'Volumen' })]),
          h('div.stat', {}, [h('div.val', { text: String(prs.length) }), h('div.lbl', { text: 'Neue Rekorde' })]),
        ]),
        h('div.subhead', { style: { margin: '14px 0 8px' } }, [h('h2', { text: 'Trainierte Muskeln' })]),
        h('div.grid-2', {}, [
          h('div.bodymap-wrap.compact', { html: bodyMapSvg('front', ms.totals, { mode: 'session' }) }),
          h('div.bodymap-wrap.compact', { html: bodyMapSvg('back', ms.totals, { mode: 'session' }) }),
        ]),
        h('div.small.muted', { style: { marginTop: '8px' }, text: trained.map(([k, n]) => `${MUSCLE_NAME[k]} ${fmtSets(n)}`).join(' · ') }),
        prs.length ? h('div.card.mt', {}, prs.map(p => h('div.pr-row', {}, [
          h('div', {}, [h('div', { text: '🏆 ' + p.name, style: { fontWeight: 600 } }), h('div.sub', { text: PR_LABELS[p.type] })]),
          h('div.val', { text: p.type === 'volume' ? `${fmtNum(p.value)} ${settings.unit}` : p.type === 'e1rm' ? `${fmtKg(Math.round(p.value * 10) / 10)} 1RM` : `${fmtKg(p.weight)} × ${p.reps}` }),
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
  rootEl?.classList.remove('wk-view');
  rootEl = null;
  setWakeLockWanted(false);
}

// ---------- Stepper ----------

function stepper({ value, step, unit, min = 0, decimals, onChange, onTap }) {
  let v = value == null ? null : Number(value);
  const fmt = () => v == null ? '–' : decimals ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v);
  const valEl = h('div.val', {}, [h('span', { text: fmt() }), h('small', { text: unit })]);
  const set = (nv) => {
    v = nv == null ? null : Math.max(min, decimals ? Math.round(nv * 100) / 100 : Math.round(nv));
    valEl.firstChild.textContent = fmt();
    onChange(v);
  };
  const minus = h('button', { text: '−', 'aria-label': 'weniger', onclick: () => set(v == null ? 0 : v - step) });
  const plus = h('button', { text: '+', 'aria-label': 'mehr', onclick: () => set(v == null ? step : v + step) });
  // Tippen auf den Wert → Sheet (Gewicht: Scheibenrechner) oder direkt eingeben (Wdh)
  valEl.addEventListener('click', () => {
    if (onTap) { onTap(set); return; }
    const input = h('input', { type: 'text', inputmode: decimals ? 'decimal' : 'numeric', value: v ?? '' });
    const commit = () => { const n = parseNum(input.value); set(n); input.replaceWith(valEl); };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    valEl.replaceWith(input);
    input.focus(); input.select();
  });
  return h('div.stepper', {}, [minus, valEl, plus]);
}

function fmtSets(n) { return (Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')) + ' S.'; }

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
    h('div.pr-head', { html: '<span>🏆</span><span>Neuer PR</span>' }),
    h('div.pr-name', { text: name }),
    ...lines,
  ]);
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', dismiss);
  document.body.append(el);
  prTimer = setTimeout(dismiss, 4500);
}
