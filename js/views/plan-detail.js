// Plan-Ansicht: Übungen + "Training starten"
import { h, svgIcon, fmtWeight, confirmSheet, toast, illustration } from '../util.js';
import { getPlan, startWorkout, getActiveWorkout, cancelWorkout, getSettings } from '../store.js';
import { unlockAudio } from '../timer.js';
import { colorFor } from './plans.js';
import { openExerciseInfo, figureThumb } from './exercise-info.js';
import { findExercise } from '../exercise-db.js';
import { bodyMapSvg, musclesFor, findCustomExercise, MUSCLE_NAME } from '../muscles.js';

export function render(root, { params, query, navigate }) {
  const plan = getPlan(params[0]);
  if (!plan) { navigate('/plans', true); return; }
  const settings = getSettings();

  const start = async () => {
    unlockAudio();
    const active = getActiveWorkout();
    if (active) {
      const ok = await confirmSheet({
        title: 'Laufendes Workout verwerfen?',
        text: `„${active.planName}“ läuft noch. Wenn du neu startest, gehen die bisherigen Sätze verloren.`,
        okLabel: 'Neu starten', danger: true,
      });
      if (!ok) { navigate('/workout'); return; }
      cancelWorkout();
    }
    if (!plan.exercises.length) { toast('Der Plan hat noch keine Übungen'); return; }
    startWorkout(plan.id);
    navigate('/workout');
  };

  if (query.get('start') === '1') { history.replaceState(null, '', '#/plan/' + plan.id); start(); return; }
  root.append(h('button.back', { html: svgIcon.back + '<span>Pläne</span>', onclick: () => navigate('/plans') }));

  // Kopf: Name links, Muskelfokus des Plans rechts als zwei kleine Körperkarten (vorn/hinten)
  const focus = planMuscles(plan);
  root.append(h('div.page-head.plan-head', {}, [
    h('div.grow', {}, [
      h('div.eyebrow', { text: `${plan.exercises.length} Übungen · ${plan.exercises.reduce((a, e) => a + (Number(e.sets) || 0), 0)} Sätze`, style: { color: colorFor(plan) } }),
      h('h1', { text: plan.name }),
    ]),
    plan.exercises.length ? h('div.plan-maps', { onclick: () => navigate('/muscles') }, [
      h('div', { html: bodyMapSvg('front', focus, { mode: 'session', mono: true, still: true }) }),
      h('div', { html: bodyMapSvg('back', focus, { mode: 'session', mono: true, still: true }) }),
    ]) : null,
    h('button.btn.icon.ghost', { 'aria-label': 'Bearbeiten', html: svgIcon.edit, onclick: () => navigate('/plan/' + plan.id + '/edit') }),
  ]));

  // Hinweise zum Plan: eine Zeile, Tipp klappt auf
  if (plan.note) {
    const det = h('details.plan-note');
    det.append(h('summary', {}, [h('span.truncate', { text: plan.note }), h('span.more', { text: 'mehr' })]), h('p', { text: plan.note }));
    root.append(det);
  }

  if (!plan.exercises.length) {
    root.append(h('div.empty', {}, [
      illustration('clipboard'),
      h('h3', { text: 'Keine Übungen' }),
      h('p', { text: 'Füge Übungen hinzu, um mit dem Training zu starten.' }),
      h('button.btn.primary.mt', { text: 'Übungen hinzufügen', onclick: () => navigate('/plan/' + plan.id + '/edit') }),
    ]));
    return;
  }

  const card = h('div.card.plan-list');
  plan.exercises.forEach((ex, i) => {
    const target = `${ex.sets} × ${ex.reps}` + (ex.weight != null ? ` @ ${fmtWeight(ex.weight, settings.unit)}` : '') + ` · ${ex.restSec || settings.defaultRestSec}s Pause`;
    const thumb = figureThumb(ex.name);
    const lib = findExercise(ex.name);
    const cust = findCustomExercise(ex.name);
    const musclesTxt = lib ? lib.muscles : cust ? cust.primary.map(k => MUSCLE_NAME[k]).join(', ') : (ex.note || '');
    const chips = [
      h('span.pill', { text: `${ex.sets} Sätze` }),
      h('span.pill', { text: `${ex.reps} Wdh` }),
      ex.weight != null ? h('span.pill', { text: fmtWeight(ex.weight, settings.unit) }) : null,
      ex.superset && plan.exercises[i + 1] ? h('span.pill.accent', { text: '⇅ Supersatz' }) : null,
    ];
    card.append(h('div.ex-row.plan-ex', { onclick: () => openExerciseInfo(ex.name, { note: ex.note, target }) }, [
      thumb || h('div.idx', { text: i + 1 }),
      h('div.grow', {}, [
        h('div.truncate', { text: ex.name, style: { fontWeight: 600 } }),
        musclesTxt ? h('div.small.faint.truncate', { text: musclesTxt }) : null,
        h('div.row', { style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } }, chips),
      ]),
      h('div', { html: svgIcon.chevron }),
    ]));
  });
  root.append(card);

  root.append(h('div.cta-bar', {}, [
    h('button.btn.primary.block', { html: svgIcon.play + '<span>Training starten</span>', onclick: start }),
  ]));
}

/** Muskelgruppen, die der Plan trifft: Sätze je Gruppe (primär 1, sekundär 0,5) */
function planMuscles(plan) {
  const totals = {};
  for (const ex of plan.exercises) {
    const m = musclesFor(ex.name);
    const n = Number(ex.sets) || 0;
    for (const k of m.primary) totals[k] = (totals[k] || 0) + n;
    for (const k of m.secondary) totals[k] = (totals[k] || 0) + n * 0.5;
  }
  return totals;
}
