// Übung suchen und übernehmen: Suchfeld, Muskelfilter, Treffer mit Gerät und Muskeln, Varianten je Bewegung.
import { h, svgIcon, openSheet } from '../util.js';
import { EXERCISES, searchExercises, variantsOf, exercisesByCategory, CATEGORY_NAME } from '../exercise-db.js';
import { EQUIPMENT } from '../equipment.js';
import { MUSCLES, MUSCLE_NAME } from '../muscles.js';
import { getCustomExercises } from '../store.js';
import { figureThumb, openExerciseInfo } from './exercise-info.js';
import { openCustomExerciseEditor } from './custom-exercise.js';

/**
 * @param {{ onPick: (entry|{name}) => void, title?: string, query?: string }} opts
 */
export function openExercisePicker({ onPick, title = 'Übung wählen', query = '' }) {
  openSheet((sheet, close) => {
    let muscle = null;
    let q = query;

    const input = h('input.input', { type: 'search', placeholder: 'Übung suchen – z.B. Brustpresse, Latzug, Squat', value: q, autocapitalize: 'off', autocomplete: 'off' });
    const chips = h('div.day-row.pick-filter', {}, [
      h('button.chip' + (muscle ? '' : '.on'), { text: 'Alle', onclick: () => setMuscle(null) }),
      ...MUSCLES.map(([k, label]) => h('button.chip', { text: label, dataset: { m: k }, onclick: () => setMuscle(k) })),
    ]);
    const results = h('div.pick-list');

    const setMuscle = (k) => {
      muscle = k;
      for (const b of chips.children) b.classList.toggle('on', (b.dataset.m || null) === k);
      draw();
    };

    const pick = (e) => { close(); onPick(e); };

    const row = (e) => {
      const vars = variantsOf(e);
      const eq = EQUIPMENT[e.equip?.type]?.name || '';
      return h('div.pick-row', {}, [
        figureThumb(e.name) || h('div.fig-thumb'),
        h('div.grow.min0', { onclick: () => pick(e), style: { cursor: 'pointer' } }, [
          h('div.clamp2', { text: e.name, style: { fontWeight: 600 } }),
          h('div.small.faint.clamp2', { text: [e.muscles, eq].filter(Boolean).join(' · ') }),
        ]),
        vars.length ? h('button.btn.sm.ghost', { text: `${vars.length + 1} Varianten`, onclick: () => showVariants(e) }) : null,
        h('button.btn.icon.ghost', { 'aria-label': 'Infos', html: svgIcon.info || svgIcon.chevron, onclick: () => openExerciseInfo(e.name) }),
      ]);
    };

    const showVariants = (e) => {
      const all = [e, ...variantsOf(e)].sort((a, b) => (a.baseId ? 1 : 0) - (b.baseId ? 1 : 0));
      results.innerHTML = '';
      results.append(h('button.btn.sm.ghost.block.mb', { html: svgIcon.back + '<span>Zurück zur Suche</span>', onclick: draw }));
      results.append(h('div.subhead', {}, [h('h2', { text: e.baseId ? EXERCISES.find(x => x.id === e.baseId)?.name || e.name : e.name })]));
      for (const v of all) results.append(row2(v));
    };
    const row2 = (e) => h('div.pick-row', { onclick: () => pick(e), style: { cursor: 'pointer' } }, [
      figureThumb(e.name) || h('div.fig-thumb'),
      h('div.grow.min0', {}, [
        h('div.clamp2', { text: e.name, style: { fontWeight: 600 } }),
        h('div.small.faint.clamp2', { text: [e.muscles, EQUIPMENT[e.equip?.type]?.name].filter(Boolean).join(' · ') }),
      ]),
      h('div', { html: svgIcon.chevron }),
    ]);

    const draw = () => {
      results.innerHTML = '';
      const custom = getCustomExercises().filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
      if (custom.length) {
        results.append(h('div.subhead', {}, [h('h2', { text: 'Eigene Übungen' })]));
        for (const c of custom) {
          results.append(h('div.pick-row', { onclick: () => pick({ name: c.name, custom: true }), style: { cursor: 'pointer' } }, [
            h('div.fig-thumb', { html: svgIcon.dumbbell }),
            h('div.grow.min0', {}, [h('div.clamp2', { text: c.name, style: { fontWeight: 600 } }), h('div.small.faint', { text: (c.primary || []).map(k => MUSCLE_NAME[k]).join(', ') })]),
            h('div', { html: svgIcon.chevron }),
          ]));
        }
      }
      if (!q.trim() && !muscle) {
        // Ohne Suche: nach Körperpartie gruppiert, nur die Basisbewegungen
        for (const [label, list] of exercisesByCategory()) {
          const base = list.filter(e => !e.baseId);
          if (!base.length) continue;
          results.append(h('div.subhead', {}, [h('h2', { text: `${label} (${list.length})` })]));
          for (const e of base) results.append(row(e));
        }
        return;
      }
      const hits = searchExercises(q, { muscle });
      results.append(h('div.subhead', {}, [h('h2', { text: `${hits.length} Treffer${muscle ? ' · ' + MUSCLE_NAME[muscle] : ''}` })]));
      if (!hits.length) {
        results.append(h('div.card', {}, [
          h('p.small.muted', { text: 'Nichts gefunden. Du kannst den Namen trotzdem übernehmen oder eine eigene Übung anlegen.' }),
          q.trim() ? h('button.btn.block.mt', { text: `„${q.trim()}“ übernehmen`, onclick: () => pick({ name: q.trim() }) }) : null,
        ]));
        return;
      }
      for (const e of hits) results.append(row(e));
    };

    let t = null;
    input.addEventListener('input', () => { q = input.value; clearTimeout(t); t = setTimeout(draw, 120); });

    sheet.append(
      h('div.row.between', {}, [h('h3', { text: title, style: { margin: 0 } }), h('button.btn.sm.ghost', { text: 'Abbrechen', onclick: close })]),
      h('div.mt', {}, [input]),
      chips,
      results,
      h('button.btn.ghost.block.mt', { html: svgIcon.plus + '<span>Eigene Übung anlegen</span>', onclick: () => { close(); openCustomExerciseEditor(null, (c) => c && onPick({ name: c.name, custom: true })); } }),
    );
    draw();
    setTimeout(() => input.focus(), 60);
  });
}
