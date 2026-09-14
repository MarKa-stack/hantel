// Übungsbibliothek + Vorlagen
import { h, svgIcon, toast } from '../util.js';
import { EXERCISES } from '../exercise-db.js';
import { TEMPLATES, WEEK_PLAN, addTemplate } from '../templates.js';
import { getPlans, getCustomExercises } from '../store.js';
import { MUSCLE_NAME } from '../muscles.js';
import { openExerciseInfo, figureThumb } from './exercise-info.js';
import { openCustomExerciseEditor } from './custom-exercise.js';

export function render(root, { navigate, sub }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Mehr</span>', onclick: () => navigate('/settings') }));

  if (sub === 'templates') return renderTemplates(root, navigate);

  const custom = getCustomExercises();
  root.append(h('div.page-head', {}, [
    h('div', {}, [h('div.eyebrow', { text: `${EXERCISES.length + custom.length} Übungen` }), h('h1', { text: 'Übungsbibliothek' })]),
    h('button.btn.sm.ghost.icon', { 'aria-label': 'Eigene Übung anlegen', html: svgIcon.plus, onclick: () => openCustomExerciseEditor(null, () => navigate('/library', true)) }),
  ]));
  root.append(h('p.muted.mb', { text: 'Tippe auf eine Übung für die Bewegungsanimation und Ausführungstipps. Übungen in deinen Plänen werden über den Namen automatisch zugeordnet – was fehlt, legst du mit „+“ als eigene Übung an.' }));

  // Eigene Übungen zuerst
  root.append(h('div.subhead', {}, [h('h2', { text: 'Eigene Übungen' })]));
  if (custom.length) {
    const card = h('div.card');
    for (const c of custom) {
      card.append(h('div.lib-row', { onclick: () => openCustomExerciseEditor(c, () => navigate('/library', true)) }, [
        h('div.idx', { html: svgIcon.dumbbell, style: { width: '64px', height: '52px', borderRadius: '10px' } }),
        h('div.grow', {}, [h('div', { text: c.name, style: { fontWeight: 600 } }), h('div.small.faint', { text: c.primary.map(k => MUSCLE_NAME[k]).join(', ') + (c.secondary?.length ? ` · ${c.secondary.map(k => MUSCLE_NAME[k]).join(', ')}` : '') })]),
        h('div', { html: svgIcon.edit.replace('<svg', '<svg class="chev"') }),
      ]));
    }
    root.append(card);
  } else {
    root.append(h('div.card', {}, [h('p.small.muted', { text: 'Noch keine eigenen Übungen. Für alles, was die Bibliothek nicht kennt: Name, Muskeln, Gewichtsschritt – dann zählt die Übung in Wochenbilanz, Erholung und Progression richtig.' })]));
  }

  const groups = [
    ['Oberkörper', EXERCISES.slice(0, 16)],
    ['Unterkörper', EXERCISES.slice(16)],
  ];
  for (const [title, list] of groups) {
    root.append(h('div.subhead', {}, [h('h2', { text: title })]));
    const card = h('div.card');
    for (const e of list) {
      card.append(h('div.lib-row', { onclick: () => openExerciseInfo(e.name) }, [
        figureThumb(e.name),
        h('div.grow', {}, [h('div', { text: e.name, style: { fontWeight: 600 } }), h('div.small.faint', { text: e.muscles })]),
        h('div', { html: svgIcon.chevron }),
      ]));
    }
    root.append(card);
  }
}

export function renderTemplates(root, navigate) {
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Vorlagen' }), h('h1', { text: 'Trainingspläne' })])]));
  root.append(h('p.muted', { text: 'Dein Oberkörper/Unterkörper-Split für 4 oder 5 Gym-Tage pro Woche. Vorlagen lassen sich beliebig oft hinzufügen und danach frei bearbeiten.' }));

  const existing = new Set(getPlans().map(p => p.name.trim().toLowerCase()));
  const list = h('div.list.mt');
  for (const t of TEMPLATES) {
    const has = existing.has(t.name.toLowerCase());
    list.append(h('div.card', {}, [
      h('div.row.between', {}, [
        h('div.grow', {}, [
          h('div', { text: t.name, style: { fontWeight: 700, fontSize: '17px' } }),
          h('div.small.faint', { text: `${t.exercises.length} Übungen · ${t.exercises.reduce((a, e) => a + e.sets, 0)} Arbeitssätze` + (has ? ' · bereits angelegt' : '') }),
        ]),
        h('button.btn.sm' + (has ? '.ghost' : '.primary'), { text: has ? 'Nochmal' : 'Hinzufügen', onclick: () => {
          const p = addTemplate(t.id);
          toast(`„${p.name}“ hinzugefügt`, { action: { label: 'Öffnen', fn: () => navigate('/plan/' + p.id) } });
        } }),
      ]),
      h('div.small.muted.mt', { text: t.exercises.map(e => e.name).join(' · ') }),
    ]));
  }
  root.append(list);

  root.append(h('div.subhead', {}, [h('h2', { text: 'Deine Woche' })]));
  const tbl = h('table.tbl', {}, [
    h('thead', {}, [h('tr', {}, [h('th', { text: 'Tag' }), h('th', { text: '4 Tage' }), h('th', { text: '5 Tage' })])]),
    h('tbody', {}, WEEK_PLAN.map(([d, a, b]) => h('tr', {}, [h('td', { text: d, style: { fontWeight: 700 } }), h('td', { text: a }), h('td', { text: b })]))),
  ]);
  root.append(h('div.card.tbl-wrap', {}, [tbl]));
  root.append(h('p.small.faint.mt', { text: '* Bei 5 Tagen wandern Schrägbank-Curls, Überkopf-Trizeps, Wadenheben sitzend und Reverse Crunch auf den Samstag – die Wochendosis bleibt gleich.' }));
}
