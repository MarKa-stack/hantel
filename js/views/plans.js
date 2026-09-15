// Startbildschirm, bewusst leer: Wochenleiste (heute markiert, Trainingstage mit Punkt), laufendes Workout,
// die Pläne mit Direktstart – der empfohlene Plan trägt „Heute dran“. Alles Weitere liegt unter „Fortschritt“.
import { h, svgIcon, toast, actionSheet, confirmSheet, promptSheet, relativeDay, illustration, weekKey, isoWeek } from '../util.js';
import { getPlans, addPlan, newPlan, deletePlan, duplicatePlan, movePlan, getSessions, getActiveWorkout, subscribe, getSettings } from '../store.js';
import { muscleSets, bodyMapSvg } from '../muscles.js';
import { suggestPlan } from '../recovery.js';

let unsub = null;
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function render(root, { navigate }) {
  const draw = () => {
    root.innerHTML = '';
    const plans = getPlans();
    const sessions = getSessions();
    const active = getActiveWorkout();
    const settings = getSettings();

    root.append(weekStrip(sessions, navigate));

    // Laufendes Workout – schmale Karte, ein Tipp zurück ins Training
    if (active) {
      const done = active.entries.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
      const total = active.entries.reduce((a, e) => a + e.sets.length, 0);
      root.append(h('div.card.tappable.live-card', { onclick: () => navigate('/workout') }, [
        h('div.row', {}, [
          h('span.live-dot'),
          h('div.grow', {}, [
            h('b', { text: active.planName }),
            h('div.small.muted', { text: `Läuft · ${done}/${total} Sätze · Übung ${(active.currentIndex ?? 0) + 1}/${active.entries.length}` }),
          ]),
          h('button.btn.sm.primary', { html: svgIcon.play + '<span>Weiter</span>' }),
        ]),
        h('div.hero-bar', {}, [h('i', { style: { width: `${total ? Math.round((done / total) * 100) : 0}%` } })]),
      ]));
    }

    // Pläne
    root.append(h('div.subhead', {}, [
      h('h2', { text: 'Deine Pläne' }),
      h('button.btn.sm.ghost.icon', { 'aria-label': 'Plan hinzufügen', html: svgIcon.plus, onclick: addMenu }),
    ]));

    if (!plans.length) {
      root.append(h('div.empty', {}, [
        illustration('dumbbell'),
        h('h3', { text: 'Noch kein Plan' }),
        h('p', { text: 'Starte mit einer Vorlage, importiere deinen Plan als PDF oder leg einen manuell an.' }),
        h('div.stack.mt', {}, [
          h('button.btn.primary.block', { text: 'Vorlagen ansehen', onclick: () => navigate('/templates') }),
          h('button.btn.ghost.block', { text: 'PDF importieren', onclick: () => navigate('/import') }),
          h('button.btn.ghost.block', { text: 'Plan manuell anlegen', onclick: createPlan }),
        ]),
      ]));
      return;
    }

    // Empfehlung (Erholungsstatus + Reihenfolge) nur als Markierung am Plan, nicht als eigene Karte
    const sug = active ? null : suggestPlan();
    const deload = settings.deloadUntil && settings.deloadUntil > Date.now();
    const list = h('div.list');
    for (const p of plans) {
      const last = [...sessions].reverse().find(s => s.planId === p.id);
      const isNext = sug?.plan?.id === p.id;
      const meta = [`${p.exercises.length} Übung${p.exercises.length === 1 ? '' : 'en'}`];
      if (last) meta.push('zuletzt ' + lc(relativeDay(last.startedAt)));
      list.append(h('div.card.tappable.plan-card' + (isNext ? '.next' : ''), { onclick: () => navigate('/plan/' + p.id) }, [
        planThumb(p),
        h('div.grow', {}, [
          isNext ? h('div.plan-flag', { text: deload ? 'Heute dran · Deload' : 'Heute dran' }) : null,
          h('div.truncate', { text: p.name, style: { fontWeight: 700, fontSize: '17px' } }),
          h('div.meta', { text: meta.join(' · ') }),
        ]),
        p.exercises.length ? h('button.btn.icon.plan-play' + (isNext ? '.primary' : ''), { 'aria-label': 'Training starten', html: svgIcon.play, onclick: (e) => { e.stopPropagation(); navigate('/plan/' + p.id + '?start=1'); } }) : null,
      ]));
    }
    root.append(list);
    if (sug?.reason && sessions.length) root.append(h('p.small.faint.plan-reason', { text: sug.reason }));
  };

  const createPlan = async () => {
    const name = await promptSheet({ title: 'Neuer Plan', label: 'Name', placeholder: 'z.B. Push, Pull, Beine …', okLabel: 'Anlegen' });
    if (!name) return;
    const p = addPlan(newPlan({ name }));
    navigate('/plan/' + p.id + '/edit');
  };
  const addMenu = () => actionSheet('Plan hinzufügen', [
    { label: 'Aus Vorlage', fn: () => navigate('/templates') },
    { label: 'PDF importieren', fn: () => navigate('/import') },
    { label: 'Manuell anlegen', fn: createPlan },
  ]);

  draw();
  unsub = subscribe(() => { if (location.hash === '#/plans' || location.hash === '') draw(); });
}

export function unmount() { unsub?.(); unsub = null; }

/** Schmale Wochenleiste: Mo–So, heute hervorgehoben, Trainingstage mit Punkt (tippen → Session) */
function weekStrip(sessions, navigate) {
  const now = new Date();
  const start = weekKey(now.getTime());
  const dayKey = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const todayKey = dayKey(now.getTime());
  const byDay = new Map();
  for (const s of sessions) byDay.set(dayKey(s.startedAt), s);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const key = dayKey(start + i * 86400000 + 3600000); // +1 h gegen Sommerzeit-Sprünge
    const d = new Date(key);
    const s = byDay.get(key);
    const cls = 'day' + (key === todayKey ? '.today' : '') + (s ? '.trained' : '') + (key > todayKey ? '.future' : '');
    days.push(h('button.' + cls, { 'aria-label': `${WD[i]} ${d.getDate()}.` + (s ? ' – Training' : ''), disabled: !s, onclick: () => navigate('/session/' + s.id) }, [
      h('span.wd', { text: WD[i] }),
      h('span.num', { text: String(d.getDate()) }),
      h('i.dot'),
    ]));
  }
  return h('div.week-strip', {}, [
    h('div.row.between.ws-head', {}, [
      h('span.ws-month', { text: `${MONTHS[now.getMonth()]} ${now.getFullYear()}` }),
      h('span.ws-kw', { text: `KW ${isoWeek(now.getTime())}` }),
    ]),
    h('div.days', {}, days),
  ]);
}

/** Plan-Optionen (⋯) – in der Plan-Ansicht; nach dem Löschen geht es zurück zur Startseite */
export function openPlanMenu(p, navigate) {
  actionSheet(p.name, [
    { label: 'Bearbeiten', fn: () => navigate('/plan/' + p.id + '/edit') },
    { label: 'Duplizieren', fn: () => { duplicatePlan(p.id); toast('Plan dupliziert'); navigate('/plans'); } },
    { label: 'Nach oben', fn: () => { movePlan(p.id, -1); toast('Verschoben'); } },
    { label: 'Nach unten', fn: () => { movePlan(p.id, 1); toast('Verschoben'); } },
    { label: 'Löschen', danger: true, fn: async () => {
      if (await confirmSheet({ title: `„${p.name}“ löschen?`, text: 'Dein Trainingsverlauf bleibt erhalten.', okLabel: 'Löschen', danger: true })) {
        deletePlan(p.id); toast('Plan gelöscht'); navigate('/plans', true);
      }
    } },
  ]);
}

/** Mini-Körperkarte mit den Muskeln, die der Plan trifft */
function planThumb(plan) {
  const fake = { entries: plan.exercises.map(e => ({ name: e.name, sets: Array.from({ length: Math.max(1, e.sets || 1) }, () => ({ done: true })) })) };
  const ms = muscleSets([fake]);
  const upper = ['chest', 'back', 'front_delt', 'side_delt', 'rear_delt', 'biceps', 'triceps'].reduce((a, k) => a + ms.totals[k], 0);
  const lower = ['quads', 'hamstrings', 'glutes', 'calves'].reduce((a, k) => a + ms.totals[k], 0);
  const side = lower > upper ? 'front' : (ms.totals.back > ms.totals.chest ? 'back' : 'front');
  return h('div.plan-thumb', { html: bodyMapSvg(side, ms.totals, { mode: 'week', still: true, mono: true }) });
}

// „Heute“/„Gestern“ klein im Satz, Datumsangaben unverändert
const lc = (s) => s.replace(/^(Heute|Gestern)/, (m) => m.toLowerCase());

const PALETTE = ['#ff5c35', '#3ddc84', '#4f8cff', '#ffc857', '#b26bff', '#2ad4c6'];
export function colorFor(plan) {
  let hsh = 0;
  for (const c of plan.id) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[hsh % PALETTE.length];
}
