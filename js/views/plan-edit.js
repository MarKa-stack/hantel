// Plan bearbeiten: Name, Notiz, Übungen (hinzufügen, ändern, sortieren, löschen)
import { h, svgIcon, fmtWeight, openSheet, confirmSheet, toast, parseNum } from '../util.js';
import { getPlan, updatePlan, newExercise, getSettings, exerciseIndex, getPlans } from '../store.js';
import { inferWeightStep } from '../progression.js';

export function render(root, { params, navigate }) {
  const plan = getPlan(params[0]);
  if (!plan) { navigate('/plans', true); return; }
  const settings = getSettings();

  const commit = () => updatePlan(plan.id, { exercises: plan.exercises, name: plan.name, note: plan.note });

  root.append(h('button.back', { html: svgIcon.back + '<span>Fertig</span>', onclick: () => navigate('/plan/' + plan.id) }));
  root.append(h('div.page-head', {}, [h('h1', { text: 'Plan bearbeiten' })]));

  const nameInput = h('input.input', { type: 'text', value: plan.name, placeholder: 'Name des Plans' });
  nameInput.addEventListener('input', () => { plan.name = nameInput.value.trim() || 'Plan'; commit(); });
  const noteInput = h('input.input', { type: 'text', value: plan.note || '', placeholder: 'Notiz (optional)' });
  noteInput.addEventListener('input', () => { plan.note = noteInput.value.trim(); commit(); });

  root.append(h('div.stack', {}, [
    h('div.field', {}, [h('label', { text: 'Name' }), nameInput]),
    h('div.field', {}, [h('label', { text: 'Notiz' }), noteInput]),
  ]));

  root.append(h('div.subhead', {}, [h('h2', { text: 'Übungen' })]));
  const listEl = h('div.card');
  root.append(listEl);
  root.append(h('button.btn.block.mt', { html: svgIcon.plus + '<span>Übung hinzufügen</span>', onclick: () => editExercise(null) }));

  const drawList = () => {
    listEl.innerHTML = '';
    if (!plan.exercises.length) {
      listEl.append(h('p.muted.center', { text: 'Noch keine Übungen.', style: { padding: '10px 0' } }));
      return;
    }
    plan.exercises.forEach((ex, i) => {
      const target = `${ex.sets} × ${ex.reps}` + (ex.weight != null ? ` @ ${fmtWeight(ex.weight, settings.unit)}` : '') + (ex.restSec ? ` · ${ex.restSec}s` : '');
      listEl.append(h('div.ex-row', { onclick: () => editExercise(ex) }, [
        h('div.idx', { text: i + 1 }),
        h('div.grow', {}, [
          h('div', { text: ex.name, style: { fontWeight: 600 } }),
          h('div.target', { text: target }),
        ]),
        h('div', { html: svgIcon.chevron }),
      ]));
    });
  };

  const editExercise = (ex) => {
    const isNew = !ex;
    const draft = ex ? { ...ex } : newExercise();
    openSheet((sheet, close) => {
      const known = [...new Set([
        ...exerciseIndex().map(e => e.name),
        ...getPlans().flatMap(p => p.exercises.map(e => e.name)),
      ])].sort();
      const dl = h('datalist', { id: 'ex-names' }, known.map(n => h('option', { value: n })));

      const name = h('input.input', { type: 'text', value: draft.name, placeholder: 'z.B. Bankdrücken', list: 'ex-names', autocomplete: 'off' });
      const sets = h('input.input.num', { type: 'number', inputmode: 'numeric', min: 1, max: 20, value: draft.sets });
      const reps = h('input.input.num', { type: 'text', inputmode: 'numeric', value: draft.reps, placeholder: '8-12' });
      const weight = h('input.input.num', { type: 'text', inputmode: 'decimal', value: draft.weight ?? '', placeholder: '–' });
      const rest = h('input.input.num', { type: 'number', inputmode: 'numeric', value: draft.restSec ?? '', placeholder: String(settings.defaultRestSec) });
      const note = h('input.input', { type: 'text', value: draft.note || '', placeholder: 'Tempo, Hinweise …' });
      const stepSel = h('select.input', {}, [
        h('option', { value: '', text: `Automatisch (${String(inferWeightStep(draft.name || '')).replace('.', ',')} kg)` }),
        ...[1, 1.25, 2, 2.5, 5, 10].map(v => h('option', { value: String(v), text: `${String(v).replace('.', ',')} kg`, selected: draft.weightStep === v })),
      ]);
      name.addEventListener('input', () => { if (!stepSel.value) stepSel.firstChild.textContent = `Automatisch (${String(inferWeightStep(name.value)).replace('.', ',')} kg)`; });

      const save = () => {
        const n = name.value.trim();
        if (!n) { name.focus(); return; }
        draft.name = n;
        draft.sets = Math.max(1, parseInt(sets.value, 10) || 1);
        draft.reps = reps.value.trim() || '10';
        draft.weight = parseNum(weight.value);
        draft.restSec = parseInt(rest.value, 10) || null;
        draft.weightStep = parseNum(stepSel.value);
        draft.note = note.value.trim();
        if (isNew) plan.exercises.push(draft);
        else Object.assign(ex, draft);
        commit(); drawList(); close();
      };

      const idx = ex ? plan.exercises.indexOf(ex) : -1;
      const move = (dir) => {
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= plan.exercises.length) return;
        [plan.exercises[idx], plan.exercises[j]] = [plan.exercises[j], plan.exercises[idx]];
        commit(); drawList(); close();
      };

      sheet.append(
        dl,
        h('h2', { text: isNew ? 'Neue Übung' : 'Übung bearbeiten' }),
        h('div.stack', {}, [
          h('div.field', {}, [h('label', { text: 'Übung' }), name]),
          h('div.grid-4', {}, [
            h('div.field', {}, [h('label', { text: 'Sätze' }), sets]),
            h('div.field', {}, [h('label', { text: 'Wdh' }), reps]),
            h('div.field', {}, [h('label', { text: settings.unit }), weight]),
            h('div.field', {}, [h('label', { text: 'Pause s' }), rest]),
          ]),
          h('div.field', {}, [h('label', { text: 'Gewichtsschritt (Progression)' }), stepSel]),
          h('div.field', {}, [h('label', { text: 'Notiz' }), note]),
        ]),
        !isNew ? h('div.row.mt', {}, [
          h('button.btn.sm.ghost.grow', { text: '↑ Nach oben', onclick: () => move(-1), disabled: idx <= 0 }),
          h('button.btn.sm.ghost.grow', { text: '↓ Nach unten', onclick: () => move(1), disabled: idx >= plan.exercises.length - 1 }),
          h('button.btn.sm.danger', { html: svgIcon.trash, 'aria-label': 'Löschen', onclick: async () => {
            close();
            if (await confirmSheet({ title: `„${ex.name}“ entfernen?`, okLabel: 'Entfernen', danger: true })) {
              plan.exercises.splice(idx, 1); commit(); drawList(); toast('Übung entfernt');
            }
          } }),
        ]) : null,
        h('div.actions', {}, [
          h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
          h('button.btn.primary', { text: isNew ? 'Hinzufügen' : 'Speichern', onclick: save }),
        ]),
      );
      if (isNew) setTimeout(() => name.focus(), 60);
    });
  };

  drawList();
}
