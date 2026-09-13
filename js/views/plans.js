// Übersicht aller Trainingspläne
import { h, svgIcon, toast, actionSheet, confirmSheet, promptSheet, relativeDay } from '../util.js';
import { getPlans, addPlan, newPlan, deletePlan, duplicatePlan, movePlan, getSessions, getActiveWorkout, subscribe } from '../store.js';

let unsub = null;

export function render(root, { navigate }) {
  const draw = () => {
    root.innerHTML = '';
    const plans = getPlans();
    const active = getActiveWorkout();

    root.append(h('div.page-head', {}, [
      h('div', {}, [h('div.eyebrow', { text: 'Hantel' }), h('h1', { text: 'Trainingspläne' })]),
      h('div.row', { style: { gap: '6px' } }, [
        h('button.btn.sm.ghost', { text: 'Vorlagen', onclick: () => navigate('/templates') }),
        h('button.btn.sm.ghost', { text: 'PDF', onclick: () => navigate('/import') }),
      ]),
    ]));

    if (active) {
      root.append(h('div.card.tappable', { onclick: () => navigate('/workout'), style: { borderColor: 'var(--accent)', marginBottom: '12px' } }, [
        h('div.row.between', {}, [
          h('div', {}, [
            h('div', { html: '<span class="pill accent">● Läuft</span>' }),
            h('div', { text: active.planName, style: { fontWeight: 700, marginTop: '6px' } }),
          ]),
          h('span.btn.sm.primary', { text: 'Weiter' }),
        ]),
      ]));
    }

    if (!plans.length) {
      root.append(h('div.empty', {}, [
        h('div.icon', { text: '🏋️' }),
        h('h3', { text: 'Noch kein Plan' }),
        h('p', { text: 'Leg einen Plan manuell an oder importiere deinen Trainingsplan als PDF.' }),
        h('div.stack.mt', {}, [
          h('button.btn.primary.block', { text: 'Vorlagen ansehen', onclick: () => navigate('/templates') }),
          h('button.btn.ghost.block', { text: 'PDF importieren', onclick: () => navigate('/import') }),
          h('button.btn.ghost.block', { text: 'Plan manuell anlegen', onclick: createPlan }),
        ]),
      ]));
    } else {
      const list = h('div.list');
      const sessions = getSessions();
      for (const p of plans) {
        const last = [...sessions].reverse().find(s => s.planId === p.id);
        const meta = [`${p.exercises.length} Übung${p.exercises.length === 1 ? '' : 'en'}`];
        if (last) meta.push('zuletzt ' + relativeDay(last.startedAt).toLowerCase());
        const card = h('div.card.tappable.plan-card', { onclick: () => navigate('/plan/' + p.id) }, [
          h('div.swatch', { style: { background: colorFor(p) } }),
          h('div.grow', {}, [
            h('div.truncate', { text: p.name, style: { fontWeight: 700, fontSize: '17px' } }),
            h('div.meta', { text: meta.join(' · ') }),
          ]),
          h('button.btn.icon.ghost', {
            'aria-label': 'Optionen',
            html: svgIcon.more,
            onclick: (e) => { e.stopPropagation(); planMenu(p); },
          }),
        ]);
        list.append(card);
      }
      root.append(list);
      root.append(h('button.fab', { 'aria-label': 'Plan anlegen', html: svgIcon.plus, onclick: createPlan }));
    }
  };

  const createPlan = async () => {
    const name = await promptSheet({ title: 'Neuer Plan', label: 'Name', placeholder: 'z.B. Push, Pull, Beine …', okLabel: 'Anlegen' });
    if (!name) return;
    const p = addPlan(newPlan({ name }));
    navigate('/plan/' + p.id + '/edit');
  };

  const planMenu = (p) => {
    actionSheet(p.name, [
      { label: 'Training starten', fn: () => navigate('/plan/' + p.id + '?start=1') },
      { label: 'Bearbeiten', fn: () => navigate('/plan/' + p.id + '/edit') },
      { label: 'Duplizieren', fn: () => { duplicatePlan(p.id); toast('Plan dupliziert'); } },
      { label: 'Nach oben', fn: () => movePlan(p.id, -1) },
      { label: 'Nach unten', fn: () => movePlan(p.id, 1) },
      { label: 'Löschen', danger: true, fn: async () => {
        if (await confirmSheet({ title: `„${p.name}“ löschen?`, text: 'Dein Trainingsverlauf bleibt erhalten.', okLabel: 'Löschen', danger: true })) {
          deletePlan(p.id); toast('Plan gelöscht');
        }
      } },
    ]);
  };

  draw();
  unsub = subscribe(() => { if (location.hash === '#/plans' || location.hash === '') draw(); });
}

export function unmount() { unsub?.(); unsub = null; }

const PALETTE = ['#ff5c35', '#3ddc84', '#4f8cff', '#ffc857', '#b26bff', '#2ad4c6'];
export function colorFor(plan) {
  let hsh = 0;
  for (const c of plan.id) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[hsh % PALETTE.length];
}
