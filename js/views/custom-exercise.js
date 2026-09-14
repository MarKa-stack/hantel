// Editor für eigene Übungen: Name, Aliase, Primär-/Sekundärmuskeln, Gewichtsschritt, Stange, Tipps
import { h, openSheet, confirmSheet, toast, parseNum } from '../util.js';
import { saveCustomExercise, deleteCustomExercise } from '../store.js';
import { MUSCLES } from '../muscles.js';

/**
 * @param {object|string|null} existing bestehende Übung, ein Name als Vorbelegung, oder null
 * @param {(saved:object|null)=>void} onDone
 */
export function openCustomExerciseEditor(existing, onDone = () => {}) {
  const isNew = !existing || typeof existing === 'string';
  const draft = isNew
    ? { name: typeof existing === 'string' ? existing : '', aliases: [], primary: [], secondary: [], weightStep: null, barbell: false, tips: [] }
    : { ...existing, aliases: [...(existing.aliases || [])], primary: [...(existing.primary || [])], secondary: [...(existing.secondary || [])], tips: [...(existing.tips || [])] };

  openSheet((sheet, close) => {
    const name = h('input.input', { type: 'text', value: draft.name, placeholder: 'z.B. Kabelzug Crossover' });
    const aliases = h('input.input', { type: 'text', value: draft.aliases.join(', '), placeholder: 'Andere Schreibweisen, mit Komma (optional)' });
    const stepSel = h('select.input', {}, [
      h('option', { value: '', text: 'Automatisch' }),
      ...[1, 1.25, 2, 2.5, 5, 10].map(v => h('option', { value: String(v), text: `${String(v).replace('.', ',')} kg`, selected: draft.weightStep === v })),
    ]);
    const barIn = h('input', { type: 'checkbox', checked: !!draft.barbell });
    const tips = h('textarea.input', { placeholder: 'Ausführungstipps – ein Tipp pro Zeile (optional)', value: draft.tips.join('\n') });

    const chips = (key) => {
      const box = h('div.chips');
      for (const [k, label] of MUSCLES) {
        const on = draft[key].includes(k);
        const c = h('button.chip' + (on ? '.on' : ''), { text: label, onclick: () => {
          const i = draft[key].indexOf(k);
          if (i >= 0) draft[key].splice(i, 1); else { draft[key].push(k); const other = key === 'primary' ? 'secondary' : 'primary'; const j = draft[other].indexOf(k); if (j >= 0) draft[other].splice(j, 1); }
          redraw();
        } });
        box.append(c);
      }
      return box;
    };
    const primBox = h('div'), secBox = h('div');
    const redraw = () => { primBox.innerHTML = ''; primBox.append(chips('primary')); secBox.innerHTML = ''; secBox.append(chips('secondary')); };
    redraw();

    const save = () => {
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      if (!draft.primary.length) { toast('Mindestens einen Primärmuskel wählen'); return; }
      draft.name = n;
      draft.aliases = aliases.value.split(',').map(s => s.trim()).filter(Boolean);
      draft.weightStep = parseNum(stepSel.value);
      draft.barbell = barIn.checked;
      draft.tips = tips.value.split('\n').map(s => s.trim()).filter(Boolean);
      const saved = saveCustomExercise(draft);
      close(); toast(isNew ? 'Übung angelegt' : 'Übung gespeichert'); onDone(saved);
    };

    sheet.append(
      h('h2', { text: isNew ? 'Eigene Übung' : 'Übung bearbeiten' }),
      h('div.stack', {}, [
        h('div.field', {}, [h('label', { text: 'Name' }), name]),
        h('div.field', {}, [h('label', { text: 'Aliase' }), aliases]),
        h('div.field', {}, [h('label', { text: 'Primärmuskeln (1,0 Satz)' }), primBox]),
        h('div.field', {}, [h('label', { text: 'Sekundärmuskeln (0,5 Satz)' }), secBox]),
        h('div.grid-2', {}, [
          h('div.field', {}, [h('label', { text: 'Gewichtsschritt' }), stepSel]),
          h('div.switch', { style: { padding: '6px 0' } }, [h('div.grow', {}, [h('div.lbl', { text: 'Langhantel' }), h('div.desc', { text: 'Scheibenrechner an' })]), h('label.toggle', {}, [barIn, h('span')])]),
        ]),
        h('div.field', {}, [h('label', { text: 'Tipps' }), tips]),
      ]),
      !isNew ? h('button.btn.danger.block.mt', { text: 'Übung löschen', onclick: async () => {
        close();
        if (await confirmSheet({ title: `„${existing.name}“ löschen?`, text: 'Bereits protokollierte Sätze bleiben erhalten, nur die Zuordnung geht verloren.', okLabel: 'Löschen', danger: true })) {
          deleteCustomExercise(existing.id); toast('Übung gelöscht'); onDone(null);
        }
      } }) : null,
      h('div.actions', {}, [
        h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
        h('button.btn.primary', { text: isNew ? 'Anlegen' : 'Speichern', onclick: save }),
      ]),
    );
    if (isNew && !draft.name) setTimeout(() => name.focus(), 60);
  });
}
