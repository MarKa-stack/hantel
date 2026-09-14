// Startbildschirm: Dashboard (Heute dran, Wochenring, Serie, letztes PR) + Pläne
import { h, svg, svgIcon, toast, actionSheet, confirmSheet, promptSheet, relativeDay, fmtDate, illustration, iconBox, fmtNum, weekKey, isoWeek } from '../util.js';
import { getPlans, addPlan, newPlan, deletePlan, duplicatePlan, movePlan, getSessions, getActiveWorkout, subscribe, getSettings, updateSettings, sessionVolume, deloadActive } from '../store.js';
import { sessionPRs, fmtKg, plateauedExercises } from '../progression.js';
import { muscleSets, bodyMapSvg, MUSCLES } from '../muscles.js';
import { suggestPlan, recoveryStatus, fatigueRatios } from '../recovery.js';
import { weekStats } from './progress.js';

let unsub = null;

export function render(root, { navigate }) {
  const draw = () => {
    root.innerHTML = '';
    const plans = getPlans();
    const sessions = getSessions();
    const active = getActiveWorkout();
    const settings = getSettings();
    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
    const name = (settings.name || '').trim();

    root.append(h('div.page-head', {}, [
      h('div', {}, [h('div.eyebrow', { text: `${fmtDate(Date.now())} · KW ${isoWeek(Date.now())}` }), h('h1', { text: name ? `${greeting}, ${name}` : greeting })]),
    ]));

    // Laufendes Workout
    if (active) {
      const done = active.entries.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
      const total = active.entries.reduce((a, e) => a + e.sets.length, 0);
      root.append(h('div.hero', { onclick: () => navigate('/workout'), style: { cursor: 'pointer' } }, [
        h('div.eyebrow', { html: svgIcon.clock + '<span>Läuft gerade</span>' }),
        h('h2', { text: active.planName }),
        h('div.meta', { text: `${done} von ${total} Sätzen · Übung ${(active.currentIndex ?? 0) + 1} von ${active.entries.length}` }),
        h('button.btn.primary.block', { html: svgIcon.play + '<span>Weiter trainieren</span>' }),
      ]));
    }

    // Heute dran – nach Erholungsstatus der Muskeln, nicht nur nach Rotation
    if (!active && plans.length) {
      const sug = suggestPlan();
      const nextPlan = sug.plan;
      const nextLast = [...sessions].reverse().find(s => s.planId === nextPlan.id);
      const deload = settings.deloadUntil && settings.deloadUntil > Date.now();
      root.append(h('div.hero', {}, [
        h('div.eyebrow', { html: svgIcon.calendar + `<span>${deload ? 'Deload-Woche · Heute dran' : 'Heute dran'}</span>` }),
        h('h2', { text: nextPlan.name }),
        h('div.meta', { text: [
          `${nextPlan.exercises.length} Übungen · ${nextPlan.exercises.reduce((a, e) => a + (e.sets || 0), 0)} Sätze`,
          nextLast ? `zuletzt ${lc(relativeDay(nextLast.startedAt))}` : 'noch nie trainiert',
        ].join(' · ') }),
        sessions.length ? h('div.meta.reason', { text: sug.reason }) : null,
        h('button.btn.primary.block', { html: svgIcon.play + '<span>Training starten</span>', onclick: () => navigate('/plan/' + nextPlan.id + '?start=1') }),
        sug.rotationNext.id !== nextPlan.id
          ? h('button.btn.sm.ghost.block', { text: `Lieber ${sug.rotationNext.name} (nächster laut Reihenfolge)`, style: { marginTop: '8px' }, onclick: () => navigate('/plan/' + sug.rotationNext.id + '?start=1') })
          : null,
      ]));
    }

    // Erholungsstatus der Muskeln
    if (!active && sessions.length) {
      const status = recoveryStatus();
      const ratios = fatigueRatios(status);
      const tired = MUSCLES.filter(([k]) => status[k].state === 'tired').map(([, n]) => n);
      const fresh = MUSCLES.filter(([k]) => status[k].state === 'fresh' && status[k].lastAt).map(([, n]) => n);
      root.append(h('div.card.tappable.recovery', { onclick: () => navigate('/muscles') }, [
        h('div.row', { style: { gap: '12px', alignItems: 'center' } }, [
          h('div.recovery-maps', { html: bodyMapSvg('front', null, { ratios, mono: true, still: true }) + bodyMapSvg('back', null, { ratios, mono: true, still: true }) }),
          h('div.grow', {}, [
            h('div.title-ico', { html: svgIcon.body + '<b>Erholung</b>' }),
            h('div.small.muted', { style: { marginTop: '4px' }, text: tired.length ? `Noch müde: ${tired.join(', ')}` : 'Alle Muskelgruppen erholt.' }),
            fresh.length && tired.length ? h('div.small.faint', { text: `Erholt: ${fresh.slice(0, 4).join(', ')}${fresh.length > 4 ? ' …' : ''}` }) : null,
          ]),
          h('div', { html: svgIcon.chevron }),
        ]),
      ]));
    }

    // Mehrere Übungen stagnieren → Deload-Woche anbieten
    if (!active && sessions.length && !deloadActive()) {
      const stuck = plateauedExercises();
      if (stuck.length >= 3) {
        root.append(h('div.card.alert-card', { style: { marginBottom: '12px' } }, [
          h('div.title-ico', { html: svgIcon.warning + `<b>${stuck.length} Übungen stagnieren</b>` }),
          h('div.small.muted', { style: { marginTop: '4px' }, text: stuck.slice(0, 3).map(p => p.name).join(', ') + (stuck.length > 3 ? ' …' : '') + ' – seit mehreren Wochen kein neues Bestes.' }),
          h('div.row', { style: { gap: '8px', marginTop: '10px' } }, [
            h('button.btn.sm.primary', { text: 'Deload-Woche starten', onclick: () => {
              updateSettings({ deloadUntil: weekKey(Date.now()) + 7 * 86400000 - 1 });
              toast('Deload-Woche bis Sonntag: −15 % Gewicht, ein Satz weniger');
            } }),
            h('button.btn.sm.ghost', { text: 'Details', onclick: () => navigate('/exercise/' + encodeURIComponent(stuck[0].name)) }),
          ]),
        ]));
      }
    }

    // Wochenrückblick: Montag bis Mittwoch (oder bis zum ersten Training der neuen Woche)
    if (!active && sessions.length) {
      const thisWk = weekKey(Date.now()), lastWk = thisWk - 7 * 86400000;
      const dow = (new Date().getDay() + 6) % 7; // Mo = 0
      const last = weekStats(sessions, lastWk);
      const thisN = sessions.filter(s => weekKey(s.startedAt) === thisWk).length;
      if (last.list.length && (dow <= 2 || thisN === 0)) {
        const prev = weekStats(sessions, lastWk - 7 * 86400000);
        const dVol = last.volume - prev.volume;
        root.append(h('div.card.tappable.review', { onclick: () => navigate('/week/' + lastWk), style: { marginBottom: '12px' } }, [
          h('div.row.between', {}, [
            h('div.grow', {}, [
              h('div.title-ico', { html: svgIcon.calendar + `<b>Deine Woche · KW ${isoWeek(lastWk)}</b>` }),
              h('div.small.muted', { style: { marginTop: '4px' }, text: `${last.list.length} Training${last.list.length === 1 ? '' : 's'} · ${fmtNum(last.volume)} ${settings.unit}` + (prev.list.length ? ` (${dVol >= 0 ? '+' : ''}${fmtNum(dVol)})` : '') + ` · ${last.prs.length} PR${last.prs.length === 1 ? '' : 's'}` }),
            ]),
            h('div', { html: svgIcon.chevron }),
          ]),
        ]));
      }
    }

    // Kacheln: Wochenring, Serie, letztes PR
    if (sessions.length) {
      const thisWeek = weekKey(Date.now());
      const weekN = sessions.filter(s => weekKey(s.startedAt) === thisWeek).length;
      const goal = Math.max(1, settings.weeklyGoal || 4);
      const streak = weekStreak(sessions);
      const lastPR = findLastPR(sessions);
      const weekVol = sessions.filter(s => weekKey(s.startedAt) === thisWeek).reduce((a, s) => a + sessionVolume(s), 0);

      const R = 24, C = 2 * Math.PI * R;
      const ringSvg = svg('svg', { viewBox: '0 0 58 58' });
      const prog = svg('circle', { class: 'prog', cx: 29, cy: 29, r: R, 'stroke-dasharray': C, 'stroke-dashoffset': C });
      ringSvg.append(svg('circle', { class: 'track', cx: 29, cy: 29, r: R }), prog);
      requestAnimationFrame(() => requestAnimationFrame(() => prog.setAttribute('stroke-dashoffset', C * (1 - Math.min(1, weekN / goal)))));

      root.append(h('div.dash-tiles', {}, [
        h('div.tile', { onclick: () => navigate('/progress'), style: { cursor: 'pointer' } }, [
          h('div.week-ring', {}, [ringSvg, h('div.inner', { text: `${weekN}/${goal}` })]),
          h('div.lbl', { text: 'Diese Woche' }),
          h('div.sub', { text: weekN >= goal ? 'Ziel erreicht' : `${goal - weekN} offen` }),
        ]),
        h('div.tile', { onclick: () => navigate('/progress'), style: { cursor: 'pointer' } }, [
          iconBox('flame'),
          h('div.val', { html: `${streak}<small> Wo.</small>` }),
          h('div.lbl', { text: 'Serie' }),
        ]),
        lastPR
          ? h('div.tile', { onclick: () => navigate('/exercise/' + encodeURIComponent(lastPR.name)), style: { cursor: 'pointer' } }, [
            iconBox('trophy', 'good'),
            h('div.val', { text: lastPR.type === 'volume' ? fmtNum(lastPR.value) : fmtKg(lastPR.type === 'e1rm' ? Math.round(lastPR.value) : lastPR.weight) }),
            h('div.lbl', { text: 'Letztes PR' }),
            h('div.sub.truncate', { text: lastPR.name, style: { maxWidth: '100%' } }),
          ])
          : h('div.tile', {}, [
            iconBox('box', 'neutral'),
            h('div.val', { html: `${fmtNum(weekVol)}<small> ${settings.unit}</small>` }),
            h('div.lbl', { text: 'Volumen' }),
          ]),
      ]));
    }

    // Pläne
    root.append(h('div.subhead', {}, [
      h('h2', { text: 'Deine Pläne' }),
      h('div.row', { style: { gap: '6px' } }, [
        h('button.btn.sm.ghost', { text: 'Vorlagen', onclick: () => navigate('/templates') }),
        h('button.btn.sm.ghost', { text: 'PDF', onclick: () => navigate('/import') }),
        plans.length ? h('button.btn.sm.ghost.icon', { 'aria-label': 'Plan anlegen', html: svgIcon.plus, onclick: createPlan }) : null,
      ]),
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
    } else {
      const list = h('div.list');
      for (const p of plans) {
        const last = [...sessions].reverse().find(s => s.planId === p.id);
        const meta = [`${p.exercises.length} Übung${p.exercises.length === 1 ? '' : 'en'}`];
        if (last) meta.push('zuletzt ' + lc(relativeDay(last.startedAt)));
        const card = h('div.card.tappable.plan-card', { onclick: () => navigate('/plan/' + p.id) }, [
          planThumb(p),
          h('div.grow', {}, [
            h('div.truncate', { text: p.name, style: { fontWeight: 700, fontSize: '17px' } }),
            h('div.meta', { text: meta.join(' · ') }),
          ]),
          h('button.btn.icon.ghost', { 'aria-label': 'Optionen', html: svgIcon.more, onclick: (e) => { e.stopPropagation(); planMenu(p); } }),
        ]);
        list.append(card);
      }
      root.append(list);
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

/** Mini-Körperkarte mit den Muskeln, die der Plan trifft */
function planThumb(plan) {
  const fake = { entries: plan.exercises.map(e => ({ name: e.name, sets: Array.from({ length: Math.max(1, e.sets || 1) }, () => ({ done: true })) })) };
  const ms = muscleSets([fake]);
  const upper = ['chest', 'back', 'front_delt', 'side_delt', 'rear_delt', 'biceps', 'triceps'].reduce((a, k) => a + ms.totals[k], 0);
  const lower = ['quads', 'hamstrings', 'glutes', 'calves'].reduce((a, k) => a + ms.totals[k], 0);
  const side = lower > upper ? 'front' : (ms.totals.back > ms.totals.chest ? 'back' : 'front');
  return h('div.plan-thumb', { html: bodyMapSvg(side, ms.totals, { mode: 'week', still: true, mono: true }) });
}

function findLastPR(sessions) {
  for (let i = sessions.length - 1; i >= Math.max(0, sessions.length - 6); i--) {
    const prs = sessionPRs(sessions[i]);
    if (prs.length) return { ...prs[0], date: sessions[i].startedAt };
  }
  return null;
}

function weekStreak(sessions) {
  const weeks = new Set(sessions.map(s => weekKey(s.startedAt)));
  let wk = weekKey(Date.now());
  let n = 0;
  if (!weeks.has(wk)) wk -= 7 * 86400000;
  while (weeks.has(wk)) { n++; wk -= 7 * 86400000; }
  return n;
}

// „Heute“/„Gestern“ klein im Satz, Datumsangaben unverändert
const lc = (s) => s.replace(/^(Heute|Gestern)/, (m) => m.toLowerCase());

const PALETTE = ['#ff5c35', '#3ddc84', '#4f8cff', '#ffc857', '#b26bff', '#2ad4c6'];
export function colorFor(plan) {
  let hsh = 0;
  for (const c of plan.id) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[hsh % PALETTE.length];
}
