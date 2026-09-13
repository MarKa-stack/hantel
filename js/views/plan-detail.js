// Plan-Ansicht: Übungen + "Training starten"
import { h, svgIcon, fmtWeight, confirmSheet, toast } from '../util.js';
import { getPlan, startWorkout, getActiveWorkout, cancelWorkout, getSettings, lastPerformance } from '../store.js';
import { unlockAudio } from '../timer.js';
import { colorFor } from './plans.js';
import { openExerciseInfo, figureThumb } from './exercise-info.js';

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

  root.append(h('div.page-head', {}, [
    h('div.grow', {}, [
      h('div.eyebrow', { text: `${plan.exercises.length} Übungen`, style: { color: colorFor(plan) } }),
      h('h1', { text: plan.name }),
    ]),
    h('button.btn.icon.ghost', { 'aria-label': 'Bearbeiten', html: svgIcon.edit, onclick: () => navigate('/plan/' + plan.id + '/edit') }),
  ]));

  if (plan.note) root.append(h('p.muted.mb', { text: plan.note }));

  if (!plan.exercises.length) {
    root.append(h('div.empty', {}, [
      h('div.icon', { text: '📝' }),
      h('h3', { text: 'Keine Übungen' }),
      h('p', { text: 'Füge Übungen hinzu, um mit dem Training zu starten.' }),
      h('button.btn.primary.mt', { text: 'Übungen hinzufügen', onclick: () => navigate('/plan/' + plan.id + '/edit') }),
    ]));
    return;
  }

  const card = h('div.card');
  plan.exercises.forEach((ex, i) => {
    const last = lastPerformance(ex.name);
    const target = `${ex.sets} × ${ex.reps}` + (ex.weight != null ? ` @ ${fmtWeight(ex.weight, settings.unit)}` : '') + ` · ${ex.restSec || settings.defaultRestSec}s Pause`;
    const thumb = figureThumb(ex.name);
    card.append(h('div.ex-row', { onclick: () => openExerciseInfo(ex.name, { note: ex.note, target }), style: { cursor: 'pointer' } }, [
      thumb || h('div.idx', { text: i + 1 }),
      h('div.grow', {}, [
        h('div', { text: `${i + 1}. ${ex.name}`, style: { fontWeight: 600 } }),
        h('div.target', { text: target }),
        last ? h('div.small.faint', { text: 'Zuletzt: ' + last.sets.map(s => `${s.weight ?? '–'}×${s.reps ?? '–'}`).join(', ') }) : null,
        ex.note ? h('div.small.muted', { text: ex.note }) : null,
      ]),
      h('div', { html: svgIcon.chevron }),
    ]));
  });
  root.append(card);

  root.append(h('div.mt-lg', {}, [
    h('button.btn.primary.block', { html: svgIcon.play + '<span>Training starten</span>', onclick: start, style: { minHeight: '56px', fontSize: '17px' } }),
  ]));
}
