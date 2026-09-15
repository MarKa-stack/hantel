// Fortschritt: Übersicht, Übungsanalyse (Kennzahlen/Zeiträume/Rekorde), Session-Detail, Muskelgruppen-Dashboard
import { h, svg, svgIcon, fmtDuration, fmtDurationLong, fmtDate, fmtShortDate, fmtWeight, fmtNum, dateParts, weekKey, confirmSheet, toast, promptSheet, openSheet, parseNum, illustration, iconBox, isoWeek } from '../util.js';
import { getSessions, getSession, deleteSession, updateSession, exerciseIndex, exerciseHistory, entryBest, sessionVolume, getSettings, getBodyLog, updateSettings, deloadActive } from '../store.js';
import { prBaseline, sessionPRs, fmtKg, PR_LABELS, percentTable, inferWeightStep, plateauFor, deloadFor, plateauedExercises } from '../progression.js';
import { recoveryStatus, fatigueRatios } from '../recovery.js';
import { MUSCLES, MUSCLE_NAME, muscleSets, sessionsInWeek, muscleWeekStats, bodyMapSvg, intensityColor, ratioFor, volumeTarget, volumeStatus } from '../muscles.js';
import { shareSession } from '../share.js';
import { milestonesReachedAt, allMilestones } from '../milestones.js';
import { strengthStandard, LEVELS } from '../standards.js';
import { openCustomExerciseEditor } from './custom-exercise.js';

const LEVELS_LABEL = (i) => LEVELS[i];

export function render(root, ctx) {
  if (ctx.sub === 'exercise') return renderExercise(root, ctx);
  if (ctx.sub === 'session') return renderSession(root, ctx);
  if (ctx.sub === 'muscles') return renderMuscles(root, ctx);
  if (ctx.sub === 'week') return renderWeek(root, ctx);
  if (ctx.sub === 'milestones') return renderRecords(root, ctx); // alte Route → Reiter Meilensteine
  if (ctx.sub === 'records') return renderRecords(root, ctx);
  return renderOverview(root, ctx);
}

// ---------- Wochenrückblick ----------

/** Kennzahlen einer Kalenderwoche (Montag-Start) */
export function weekStats(sessions, weekStart) {
  const list = sessionsInWeek(sessions, weekStart);
  const sets = list.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.length, 0), 0);
  const volume = list.reduce((a, s) => a + sessionVolume(s), 0);
  const duration = list.reduce((a, s) => a + (s.durationSec || 0), 0);
  const prs = list.flatMap(s => sessionPRs(s).map(p => ({ ...p, session: s })));
  const muscles = muscleSets(list).totals;
  return { list, sets, volume, duration, prs, muscles, weekStart };
}

function renderWeek(root, { params, navigate }) {
  const sessions = getSessions();
  const settings = getSettings();
  let weekStart = weekKey(Number(params[0]) || Date.now());
  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  const head = h('div.page-head');
  const body = h('div');
  root.append(head, body);

  const draw = () => {
    const cur = weekStats(sessions, weekStart);
    const prev = weekStats(sessions, weekStart - 7 * 86400000);
    const end = weekStart + 6 * 86400000;
    const isThis = weekStart === weekKey(Date.now());
    head.innerHTML = '';
    head.append(
      h('div.grow', {}, [h('div.eyebrow', { text: `${fmtShortDate(weekStart)} – ${fmtShortDate(end)}` }), h('h1', { text: (isThis ? 'Diese Woche' : `KW ${isoWeek(weekStart)}`) })]),
      h('div.row', { style: { gap: '6px' } }, [
        h('button.btn.icon.ghost', { text: '‹', 'aria-label': 'Vorherige Woche', style: { fontSize: '22px' }, onclick: () => { weekStart -= 7 * 86400000; draw(); } }),
        h('button.btn.icon.ghost', { text: '›', 'aria-label': 'Nächste Woche', style: { fontSize: '22px' }, disabled: isThis, onclick: () => { weekStart += 7 * 86400000; draw(); } }),
      ]),
    );
    body.innerHTML = '';
    const delta = (a, b, fmt = (v) => String(v)) => {
      const d = a - b;
      if (!b && !a) return '';
      return `<span class="chip-delta ${d > 0 ? '' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' : ''}${fmt(d)}</span>`;
    };
    body.append(h('div.stats', {}, [
      stat(`${cur.list.length} ${delta(cur.list.length, prev.list.length)}`, 'Trainings'),
      stat(`${cur.sets} ${delta(cur.sets, prev.sets)}`, 'Sätze'),
      stat(`${fmtNum(cur.volume)}<small>${settings.unit}</small> ${delta(cur.volume, prev.volume, fmtNum)}`, 'Volumen'),
      stat(`${cur.prs.length}`, 'Rekorde'),
    ]));
    body.append(h('p.small.faint.mt', { text: 'Veränderung gegenüber der Vorwoche · ' + (cur.duration ? `${fmtDurationLong(cur.duration)} trainiert` : 'kein Training') }));

    // Muskeln: diese vs. Vorwoche
    const rows = MUSCLES.map(([k, n]) => [k, n, cur.muscles[k], prev.muscles[k]]).filter(r => r[2] > 0 || r[3] > 0).sort((a, b) => b[2] - a[2]);
    if (rows.length) {
      body.append(h('div.subhead', {}, [h('h2', { text: 'Muskelgruppen' })]));
      const t = volumeTarget();
      body.append(h('div.card', {}, rows.map(([k, n, a, b]) => h('div.row.between', { style: { padding: '6px 0' } }, [
        h('span', { text: n }),
        h('span.mono', { html: `${fmtSetsShort(a)} <span class="faint">(${fmtSetsShort(b)})</span>` + (a > 0 ? ` <span class="mtag ${volumeStatus(a)}">${volumeStatus(a) === 'in' ? '✓' : volumeStatus(a) === 'under' ? '↓' : '↑'}</span>` : '') }),
      ])).concat([h('p.small.faint', { style: { marginTop: '6px' }, text: `Ziel ${t.min}–${t.max} Sätze · in Klammern die Vorwoche` })])));
    }

    if (cur.prs.length) {
      body.append(h('div.subhead', {}, [h('h2', { text: 'Neue Rekorde' })]));
      body.append(h('div.card', {}, cur.prs.map(p => h('div.pr-row', { onclick: () => navigate('/exercise/' + encodeURIComponent(p.name)), style: { cursor: 'pointer' } }, [
        h('div.grow', {}, [h('div', { text: p.name, style: { fontWeight: 600 } }), h('div.sub', { text: `${PR_LABELS[p.type]} · ${fmtShortDate(p.session.startedAt)}` })]),
        h('div.val', { text: p.type === 'volume' ? `${fmtNum(p.value)} ${settings.unit}` : p.type === 'e1rm' ? fmtKg(Math.round(p.value)) : `${fmtKg(p.weight)} × ${p.reps}` }),
      ]))));
    }

    body.append(h('div.subhead', {}, [h('h2', { text: 'Trainings' })]));
    if (cur.list.length) {
      const list = h('div.list');
      for (const s of [...cur.list].reverse()) list.append(sessionRow(s, settings, navigate));
      body.append(list);
    } else body.append(h('p.muted', { text: 'Keine Trainings in dieser Woche.' }));
  };
  draw();
}

// ---------- Übersicht ----------

// Verlauf auf der Übersicht ein-/ausgeklappt (Standard: zu)
const HIST_KEY = 'hantel.progressHistoryOpen';
let histOpen = (() => { try { return localStorage.getItem(HIST_KEY) === '1'; } catch { return false; } })();

function renderOverview(root, { navigate }) {
  const settings = getSettings();
  const sessions = getSessions();

  root.append(h('div.page-head', {}, [h('div', {}, [h('h1', { text: 'Fortschritt' })])]));

  if (!sessions.length) {
    root.append(h('div.empty', {}, [
      illustration('chart'),
      h('h3', { text: 'Noch keine Workouts' }),
      h('p', { text: 'Sobald du dein erstes Training abschließt, siehst du hier Statistiken, Rekorde, Verlauf und deine Muskelgruppen-Bilanz.' }),
    ]));
    return;
  }

  const thisWeek = weekKey(Date.now());
  const weekSessions = sessions.filter(s => weekKey(s.startedAt) === thisWeek);

  // Kennzahlen als Fenster zum Blättern: Diese Woche · Workouts gesamt · Serie
  root.append(statsCarousel(sessions, weekSessions, settings));

  // Erholungsstatus der Muskeln (von der Startseite hierher gezogen)
  {
    const status = recoveryStatus();
    const ratios = fatigueRatios(status);
    const tired = MUSCLES.filter(([k]) => status[k].state === 'tired').map(([, n]) => n);
    const fresh = MUSCLES.filter(([k]) => status[k].state === 'fresh' && status[k].lastAt).map(([, n]) => n);
    root.append(h('div.card.tappable.recovery.row-card.mt', { onclick: () => navigate('/muscles') }, [
      h('div.row', {}, [
        h('div.recovery-maps', { html: bodyMapSvg('front', null, { ratios, mono: true, still: true }) + bodyMapSvg('back', null, { ratios, mono: true, still: true }) }),
        h('div.grow', {}, [
          h('b', { text: 'Erholung' }),
          h('div.small.muted', { text: tired.length ? `Noch müde: ${tired.join(', ')}` : 'Alle Muskelgruppen erholt.' }),
          fresh.length && tired.length ? h('div.small.faint', { text: `Erholt: ${fresh.slice(0, 4).join(', ')}${fresh.length > 4 ? ' …' : ''}` }) : null,
        ]),
        h('div', { html: svgIcon.chevron }),
      ]),
    ]));
  }

  // Mehrere Übungen stagnieren → Deload-Woche anbieten
  if (!deloadActive()) {
    const stuck = plateauedExercises();
    if (stuck.length >= 3) {
      root.append(h('div.card.alert-card.row-card', {}, [
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
  {
    const lastWk = thisWeek - 7 * 86400000;
    const dow = (new Date().getDay() + 6) % 7; // Mo = 0
    const last = weekStats(sessions, lastWk);
    if (last.list.length && (dow <= 2 || weekSessions.length === 0)) {
      const prev = weekStats(sessions, lastWk - 7 * 86400000);
      const dVol = last.volume - prev.volume;
      root.append(h('div.card.tappable.review.row-card', { onclick: () => navigate('/week/' + lastWk) }, [
        h('div.row', {}, [
          iconBox('calendar', 'good'),
          h('div.grow', {}, [
            h('b', { text: `Deine Woche · KW ${isoWeek(lastWk)}` }),
            h('div.small.muted', { text: `${last.list.length} Training${last.list.length === 1 ? '' : 's'} · ${fmtNum(last.volume)} ${settings.unit}` + (prev.list.length ? ` (${dVol >= 0 ? '+' : ''}${fmtNum(dVol)})` : '') + ` · ${last.prs.length} PR${last.prs.length === 1 ? '' : 's'}` }),
          ]),
          h('div', { html: svgIcon.chevron }),
        ]),
      ]));
    }
  }


  // Körpergewicht
  const body = getBodyLog();
  const lastBody = [...body].reverse().find(e => e.weight != null);
  root.append(h('div.card.tappable.row-card', { onclick: () => navigate('/body') }, [
    h('div.row', {}, [
      iconBox('scale', 'neutral'),
      h('div.grow', {}, [
        h('b', { text: 'Gewicht & Maße' }),
        h('div.small.faint', { text: lastBody ? `Zuletzt ${String(lastBody.weight).replace('.', ',')} kg · ${fmtShortDate(lastBody.date)}` : 'Körpergewicht und Umfänge protokollieren' }),
      ]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));

  // Rekorde & Meilensteine: eine Seite mit zwei Reitern
  const mstones = allMilestones();
  const reached = mstones.filter(m => m.at);
  const lastPR = latestPR(sessions);
  root.append(h('div.card.tappable.row-card', { onclick: () => navigate('/records') }, [
    h('div.row', {}, [
      iconBox('trophy', 'good'),
      h('div.grow', {}, [
        h('b', { text: 'Rekorde & Meilensteine' }),
        h('div.small.faint', { text: (lastPR ? `Rekord: ${lastPR.name} ${fmtPR(lastPR, settings)} · ` : '') + `${reached.length} von ${mstones.length} Meilensteinen` }),
      ]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));

  // Verlauf (Kalender/Wochen-Chart + letzte Workouts) einklappbar, Zustand wird gemerkt
  const firstWeek = weekKey(sessions.reduce((a, s) => Math.min(a, s.startedAt), Infinity));
  const spanWeeks = Math.round((weekKey(Date.now()) - firstWeek) / (7 * 86400000)) + 1;
  const hist = h('div.history');
  hist.append(carousel([
    { title: 'Trainingskalender', make: () => heatmap(sessions, Math.min(20, Math.max(8, spanWeeks)), navigate) },
    { title: 'Workouts pro Woche', make: () => weeklyBarChart(sessions, 12, chartWidth(root)) },
  ]));
  const all = [...sessions].reverse();
  const list = h('div.list.mt');
  const drawList = (n) => {
    list.innerHTML = '';
    for (const s of all.slice(0, n)) list.append(sessionRow(s, settings, navigate));
    if (all.length > n) list.append(h('button.btn.ghost.block', { text: `Alle ${all.length} Workouts anzeigen`, onclick: () => drawList(all.length) }));
  };
  drawList(6);
  hist.append(list);
  hist.hidden = !histOpen;
  const histTab = h('button.btn.ghost.block.tab-toggle.mt', { class: histOpen ? 'open' : '', html: `<span>Verlauf · ${all.length} Workout${all.length === 1 ? '' : 's'}</span>` + svgIcon.chevron, onclick: () => {
    histOpen = !histOpen; hist.hidden = !histOpen; histTab.classList.toggle('open', histOpen);
    try { localStorage.setItem(HIST_KEY, histOpen ? '1' : '0'); } catch { /* egal */ }
  } });
  root.append(histTab, hist);
}

/** Eine Kennzahl pro Seite: große Zahl, Einheit, eine Zeile Kontext und eine kleine Grafik */
function statsCarousel(sessions, weekSessions, settings) {
  const big = (val, unit, sub, extra) => h('div.stat-page', {}, [
    h('div.stat-val', { html: `${val}${unit ? `<small>${unit}</small>` : ''}` }),
    h('div.small.muted', { text: sub }),
    extra || null,
  ]);
  const week0 = weekKey(Date.now());
  const weeks = new Set(sessions.map(s => weekKey(s.startedAt)));
  const first = sessions.reduce((a, s) => Math.min(a, s.startedAt), Infinity);
  const spanWeeks = Math.max(1, Math.round((week0 - weekKey(first)) / (7 * 86400000)) + 1);
  const streak = weekStreak(sessions);
  // Beste Serie: längste Folge aufeinanderfolgender Trainingswochen
  let best = 0, run = 0, prev = null;
  for (const w of [...weeks].sort((a, b) => a - b)) { run = prev != null && w - prev === 7 * 86400000 ? run + 1 : 1; best = Math.max(best, run); prev = w; }
  const sets = weekSessions.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.length, 0), 0);
  const mins = Math.round(weekSessions.reduce((a, s) => a + (s.durationSec || 0), 0) / 60);
  const trained = new Set(weekSessions.map(s => (new Date(s.startedAt).getDay() + 6) % 7));
  const today = (new Date().getDay() + 6) % 7;
  const days = h('div.stat-days', {}, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => h('span', { text: d, class: (trained.has(i) ? 'on' : '') + (i === today ? ' today' : '') })));
  const totalSets = sessions.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.length, 0), 0);
  const totalSec = sessions.reduce((a, s) => a + (s.durationSec || 0), 0);
  const totals = h('div.small.faint', { style: { marginTop: '4px' }, text: `${fmtDurationLong(totalSec)} im Training · ${totalSets} Sätze` });
  // Letzte 8 Wochen: welche hatten Training
  const wkRow = h('div.stat-days.weeks', {}, Array.from({ length: 8 }, (_, k) => { const w = week0 - (7 - k) * 7 * 86400000; return h('span', { text: String(isoWeek(w)), class: (weeks.has(w) ? 'on' : '') + (w === week0 ? ' today' : '') }); }));
  return carousel([
    { title: 'Diese Woche', make: () => big(weekSessions.length, weekSessions.length === 1 ? 'Workout' : 'Workouts', weekSessions.length ? `${sets} Sätze · ${mins} min` : 'Noch kein Training diese Woche', days) },
    { title: 'Workouts gesamt', make: () => big(sessions.length, '', `seit ${fmtShortDate(first)} · Ø ${(sessions.length / spanWeeks).toFixed(1).replace('.', ',')} pro Woche`, totals) },
    { title: 'Serie', make: () => big(streak, streak === 1 ? 'Woche' : 'Wochen', `in Folge mit Training · beste Serie ${best} Woche${best === 1 ? '' : 'n'}`, wkRow) },
  ]);
}

/** Karte mit mehreren Ansichten: Titel + ‹ › blättern, Punkte zeigen die Position */
function carousel(panels) {
  let i = 0;
  const title = h('b', { text: panels[0].title });
  const body = h('div.carousel-body');
  const dots = h('div.carousel-dots', {}, panels.map((_, k) => h('i', { class: k === 0 ? 'on' : '' })));
  const show = (k) => {
    i = (k + panels.length) % panels.length;
    title.textContent = panels[i].title;
    body.innerHTML = ''; body.append(panels[i].make());
    [...dots.children].forEach((d, k2) => d.classList.toggle('on', k2 === i));
  };
  show(0);
  return h('div.card.carousel', {}, [
    h('div.row.between.carousel-head', {}, [
      title,
      h('div.row', { style: { gap: '4px' } }, [
        h('button.btn.icon.ghost.sm', { 'aria-label': 'Zurück', text: '‹', onclick: () => show(i - 1) }),
        h('button.btn.icon.ghost.sm', { 'aria-label': 'Weiter', text: '›', onclick: () => show(i + 1) }),
      ]),
    ]),
    body, dots,
  ]);
}

/** Jüngster Rekord über die letzten Sessions */
function latestPR(sessions) {
  for (let k = sessions.length - 1; k >= Math.max(0, sessions.length - 8); k--) {
    const prs = sessionPRs(sessions[k]);
    if (prs.length) return { ...prs[0], date: sessions[k].startedAt };
  }
  return null;
}
function fmtPR(p, settings) {
  return p.type === 'volume' ? `${fmtNum(p.value)} ${settings.unit}` : p.type === 'e1rm' ? `${fmtKg(Math.round(p.value))} 1RM` : `${fmtKg(p.weight)} × ${p.reps}`;
}

// ---------- Rekorde & Meilensteine ----------

let recTab = 'records';

function renderRecords(root, { navigate, sub }) {
  if (sub === 'milestones') recTab = 'milestones';
  const settings = getSettings();
  const sessions = getSessions();
  const idx = exerciseIndex();
  const all = allMilestones();
  const done = all.filter(m => m.at).sort((a, b) => b.at - a.at);
  const open = all.filter(m => !m.at);
  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: `${idx.length} Übungen · ${done.length} von ${all.length} Meilensteinen` }), h('h1', { text: 'Rekorde & Meilensteine' })])]));

  const panel = h('div');
  const tabs = [['records', 'Rekorde'], ['milestones', 'Meilensteine']];
  const seg = h('div.seg.mt', {}, tabs.map(([k, l]) => h('button', { text: l, class: recTab === k ? 'active' : '', onclick: () => {
    recTab = k; for (const b of seg.children) b.classList.toggle('active', b.textContent === l); draw();
  } })));
  root.append(seg, panel);

  const drawRecords = () => {
    if (!idx.length) { panel.append(h('div.card.mt', {}, [h('p.small.muted', { text: 'Sobald du trainierst, stehen hier deine Bestwerte je Übung.' })])); return; }
    // Jüngste Rekorde (letzte 8 Sessions)
    const recent = [];
    for (let k = sessions.length - 1; k >= Math.max(0, sessions.length - 8); k--) for (const p of sessionPRs(sessions[k])) recent.push({ ...p, date: sessions[k].startedAt });
    if (recent.length) {
      panel.append(h('div.subhead', {}, [h('h2', { text: 'Zuletzt aufgestellt' })]));
      const rc = h('div.card');
      for (const p of recent.slice(0, 8)) rc.append(h('div.pr-row', { onclick: () => navigate('/exercise/' + encodeURIComponent(p.name)), style: { cursor: 'pointer' } }, [
        iconBox('trophy', 'good'),
        h('div.grow', {}, [h('div', { text: p.name, style: { fontWeight: 600 } }), h('div.sub', { text: `${PR_LABELS[p.type]} · ${fmtShortDate(p.date)}` })]),
        h('div.val', { text: fmtPR(p, settings) }),
      ]));
      panel.append(rc);
    }
    panel.append(h('div.subhead', {}, [h('h2', { text: 'Bestwerte je Übung' })]));
    const exCard = h('div.card');
    for (const e of idx) {
      exCard.append(h('div.pr-row', { onclick: () => navigate('/exercise/' + encodeURIComponent(e.name)), style: { cursor: 'pointer' } }, [
        h('div.grow', {}, [
          h('div', { text: e.name, style: { fontWeight: 600 } }),
          h('div.sub', { text: `${e.count}× trainiert · 1RM ≈ ${fmtWeight(Math.round(e.e1rm), settings.unit)}` }),
        ]),
        h('div.val', { text: fmtWeight(e.maxWeight, settings.unit) }),
        h('div', { html: svgIcon.chevron }),
      ]));
    }
    panel.append(exCard);
  };
  const drawMilestones = () => {
    if (done.length) {
      panel.append(h('div.subhead', {}, [h('h2', { text: 'Erreicht' })]));
      panel.append(h('div.card', {}, done.map(m => h('div.pr-row', {}, [
        iconBox('trophy', 'good'),
        h('div.grow', { style: { marginLeft: '10px' } }, [h('div', { text: m.title, style: { fontWeight: 700 } }), h('div.sub', { text: `${m.desc} · ${fmtDate(m.at)}` })]),
      ]))));
    }
    if (open.length) {
      panel.append(h('div.subhead', {}, [h('h2', { text: 'Noch offen' })]));
      panel.append(h('div.card', {}, open.map(m => h('div.pr-row', { style: { opacity: 0.6 } }, [
        iconBox('trophy', 'neutral'),
        h('div.grow', { style: { marginLeft: '10px' } }, [h('div', { text: m.title, style: { fontWeight: 600 } }), h('div.sub', { text: m.desc })]),
      ]))));
    }
  };
  const draw = () => { panel.innerHTML = ''; (recTab === 'milestones' ? drawMilestones : drawRecords)(); };
  draw();
}

/** Chart-Breite in CSS-Pixeln (Container minus Card-/View-Padding), damit Text nicht skaliert */
function chartWidth(root) { return Math.max(280, (root.clientWidth || 375) - 66); }

function stat(valHtml, label) {
  return h('div.stat', {}, [h('div.val', { html: valHtml }), h('div.lbl', { text: label })]);
}

function fmtSets(n) { return (Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')) + ' Sätze'; }

function sessionRow(s, settings, navigate) {
  const { d, m } = dateParts(s.startedAt);
  const sets = s.entries.reduce((a, e) => a + e.sets.length, 0);
  return h('div.card.tappable.session-row', { onclick: () => navigate('/session/' + s.id) }, [
    h('div.date', {}, [h('div.d', { text: d }), h('div.m', { text: m })]),
    h('div.grow', {}, [
      h('div.truncate', { text: s.planName, style: { fontWeight: 600 } }),
      h('div.meta', { text: `${fmtDurationLong(s.durationSec)} · ${sets} Sätze · ${fmtNum(sessionVolume(s))} ${settings.unit}` }),
    ]),
    h('div', { html: svgIcon.chevron }),
  ]);
}

/** GitHub-Style Kalender: eine Spalte pro Woche (Mo–So), letzte `weeks` Wochen */
function heatmap(sessions, weeks, navigate) {
  const byDay = new Map();
  for (const s of sessions) {
    const d = new Date(s.startedAt); d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    byDay.set(k, (byDay.get(k) || []).concat(s));
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = weekKey(today.getTime()) - (weeks - 1) * 7 * 86400000;
  const grid = h('div.heatmap');
  const months = [];
  for (let wk = 0; wk < weeks; wk++) {
    for (let d = 0; d < 7; d++) {
      const t = start + (wk * 7 + d) * 86400000;
      const list = byDay.get(t) || [];
      const vol = list.reduce((a, s) => a + sessionVolume(s), 0);
      const lvl = !list.length ? 0 : vol < 4000 ? 1 : vol < 9000 ? 2 : 3;
      const cell = h('i', { class: (lvl ? 'l' + lvl : '') + (t === today.getTime() ? ' today' : ''), title: `${fmtDate(t)}${list.length ? ` · ${list.map(s => s.planName).join(', ')}` : ''}` });
      if (t > today.getTime()) cell.style.visibility = 'hidden';
      if (list.length) cell.addEventListener('click', () => navigate('/session/' + list[0].id));
      grid.append(cell);
      if (d === 0) { const m = new Date(t); if (m.getDate() <= 7) months.push(['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][m.getMonth()]); else months.push(''); }
    }
  }
  const streak = weekStreak(sessions);
  return h('div', {}, [
    // Zellen wachsen mit der Breite, aber nicht über ~18 px – sonst wirken wenige Wochen wie Kacheln
    h('div', { style: { maxWidth: `${weeks * 21}px` } }, [
      h('div.heatmap-wrap', {}, [grid]),
      h('div.heatmap-months', {}, months.map(m => h('span', { text: m }))),
    ]),
    h('div.small.faint', { style: { marginTop: '6px' }, text: `${weeks} Wochen · ${sessions.filter(s => s.startedAt >= start).length} Workouts · Serie: ${streak} Woche${streak === 1 ? '' : 'n'} in Folge` }),
  ]);
}

function weekStreak(sessions) {
  const weeks = new Set(sessions.map(s => weekKey(s.startedAt)));
  let wk = weekKey(Date.now());
  let n = 0;
  if (!weeks.has(wk)) wk -= 7 * 86400000;
  while (weeks.has(wk)) { n++; wk -= 7 * 86400000; }
  return n;
}

// ---------- Übung: Analyse ----------

const METRICS = [
  ['weight', 'Gewicht'], ['topset', 'Top'], ['e1rm', 'e1RM'], ['volume', 'Vol.'], ['reps', 'Wdh'],
];
const PERIODS = [['1m', '1 M', 30], ['3m', '3 M', 91], ['6m', '6 M', 182], ['1y', '1 J', 365], ['all', 'Gesamt', Infinity]];
let exMetric = 'e1rm';
let exPeriod = 'all';

function renderExercise(root, { params, navigate }) {
  const name = params[0];
  const settings = getSettings();
  const unit = settings.unit;
  const hist = exerciseHistory(name);

  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: `${hist.length}× trainiert` }), h('h1', { text: name })])]));

  if (!hist.length) { root.append(h('div.empty', {}, [h('p', { text: 'Keine Daten.' })])); return; }

  // Stagnation?
  const plateau = plateauFor(name);
  if (plateau) {
    const dl = deloadFor(plateau.weight, inferWeightStep(name), 3);
    root.append(h('div.card.mt.alert-card', {}, [
      h('div.title-ico', { html: svgIcon.warning + `<b>Plateau seit ${plateau.sessions} Einheiten</b>` }),
      h('p.small.muted', { style: { marginTop: '6px' }, text: `Bestes e1RM ${fmtKg(Math.round(plateau.bestE1rm))} am ${fmtDate(plateau.since)}, seitdem keine Verbesserung${plateau.grinding ? ' – und zuletzt jeder Satz mit RIR 0' : ''}.` }),
      h('ul.tips.mt', {}, [
        h('li', { text: `Deload: eine Einheit mit ${fmtKg(dl.weight)} × ${dl.sets} Sätzen, dann wieder normal – im Training gibt es dafür einen Knopf.` }),
        h('li', { text: 'Wiederholungsbereich wechseln (z.B. 6–10 statt 10–15) oder das Tempo ändern.' }),
        h('li', { text: 'Übung für 4–6 Wochen durch eine Variante mit gleicher Muskelgruppe tauschen.' }),
      ]),
    ]));
  }

  // Punkte pro Einheit
  const points = hist.map(({ session, entry }) => {
    const b = entryBest(entry);
    const top = b.bestSet || entry.sets[0];
    const topIdx = entry.sets.indexOf(top);
    return {
      x: session.startedAt, sessionId: session.id,
      weight: b.maxWeight, topset: Number(top?.weight) || 0, e1rm: Math.round(b.e1rm * 10) / 10, volume: b.volume,
      reps: entry.sets.reduce((a, s) => a + (Number(s.reps) || 0), 0),
      topReps: Number(top?.reps) || 0, topSetNo: topIdx + 1, sets: entry.sets.length,
    };
  });

  const metricSeg = h('div.seg.scroll.mt', {}, METRICS.map(([k, l]) => h('button', { text: l, class: exMetric === k ? 'active' : '', onclick: () => { exMetric = k; draw(); } })));
  const periodSeg = h('div.seg.period-seg', { style: { marginTop: '8px' } }, PERIODS.map(([k, l]) => h('button', { text: l, class: exPeriod === k ? 'active' : '', onclick: () => { exPeriod = k; draw(); } })));
  const chartBox = h('div.card.mt');
  const deltaBox = h('div.card', { style: { marginTop: '10px' } });
  root.append(metricSeg, periodSeg, chartBox, deltaBox);

  const draw = () => {
    for (const b of metricSeg.children) b.classList.toggle('active', b.textContent === METRICS.find(m => m[0] === exMetric)[1]);
    for (const b of periodSeg.children) b.classList.toggle('active', b.textContent === PERIODS.find(p => p[0] === exPeriod)[1]);
    const days = PERIODS.find(p => p[0] === exPeriod)[2];
    const since = days === Infinity ? 0 : Date.now() - days * 86400000;
    const pts = points.filter(p => p.x >= since).map(p => ({ ...p, y: p[exMetric] }));
    chartBox.innerHTML = '';
    deltaBox.innerHTML = '';
    const isKg = exMetric !== 'reps';
    const u = isKg ? unit : 'Wdh';
    if (!pts.length) { chartBox.append(h('p.muted.center', { text: 'Keine Einheiten in diesem Zeitraum.' })); deltaBox.hidden = true; return; }
    deltaBox.hidden = false;
    const captions = { weight: 'Bestes Gewicht', topset: 'Top-Satz (Gewicht des besten Satzes)', e1rm: 'Geschätztes 1RM', volume: 'Volumen pro Einheit', reps: 'Wiederholungen (Summe pro Einheit)' };
    chartBox.append(h('div.small.faint', { text: captions[exMetric] }));
    chartBox.append(lineChart(pts, {
      width: chartWidth(root),
      unit: u,
      tooltip: (p) => [
        fmtDate(p.x),
        `${fmtKg(p.topset)} × ${p.topReps} (Satz ${p.topSetNo})`,
        `e1RM ${fmtKg(Math.round(p.e1rm))}`,
      ],
    }));
    // Veränderung im Zeitraum – erst ab zwei Einheiten sinnvoll
    if (pts.length < 2) { deltaBox.hidden = true; return; }
    const first = pts[0], last = pts[pts.length - 1];
    const delta = last.y - first.y;
    const pct = first.y ? (delta / first.y) * 100 : 0;
    const spanMs = last.x - first.x;
    const months = Math.round(spanMs / (30.44 * 86400000));
    const spanTxt = months >= 2 ? `${months} Monaten` : `${Math.max(1, Math.round(spanMs / 86400000))} Tagen`;
    const fmtV = (v) => isKg ? fmtNum(Math.round(v * 10) / 10) + ' ' + unit : fmtNum(v) + ' Wdh';
    deltaBox.append(h('div.delta-box', {}, [
      h('div.big' + (delta > 0 ? '.up' : delta < 0 ? '.down' : ''), { text: (delta > 0 ? '+' : '') + fmtV(delta) }),
      h('div.muted', { text: `in ${spanTxt}` }),
      h('div.grow'),
      h('span.chip-delta' + (delta > 0 ? '' : delta < 0 ? '.down' : '.flat'), { html: (delta > 0 ? svgIcon.arrowUp.replace('class="ico"', 'class="ico sm"') : delta < 0 ? svgIcon.arrowDown.replace('class="ico"', 'class="ico sm"') : '') + '<span>' + (pct > 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + ' %</span>' }),
    ]));
  };
  draw();

  // Statistik
  const bests = hist.map(x => entryBest(x.entry));
  const totalSets = hist.reduce((a, x) => a + x.entry.sets.length, 0);
  const maxW = Math.max(...bests.map(b => b.maxWeight));
  const maxRM = Math.max(...bests.map(b => b.e1rm));
  const lastImprove = (() => {
    for (let i = points.length - 1; i > 0; i--) { const d = points[i].weight - points[i - 1].weight; if (d !== 0) return d; }
    return 0;
  })();
  root.append(h('div.subhead', {}, [h('h2', { text: 'Statistik' })]));
  root.append(h('div.stats.cols-3', {}, [
    stat(String(hist.length), 'Trainings'),
    stat(String(totalSets), 'Arbeitssätze'),
    stat(fmtWeight(maxW, unit), 'Bestes Gewicht'),
    stat(fmtWeight(Math.round(maxRM), unit), 'Bestes e1RM'),
    stat(points.length > 1 ? (lastImprove > 0 ? '+' : '') + fmtWeight(lastImprove, unit) : '–', 'Letzte Verbesserung'),
    stat(fmtShortDate(hist[hist.length - 1].session.startedAt), 'Zuletzt'),
  ]));

  // Rekorde
  const base = prBaseline(name);
  root.append(h('div.subhead', {}, [h('h2', { text: 'Rekorde' })]));
  const recs = h('div.card');
  const prRow = (label, val, sub) => h('div.pr-row', {}, [
    h('div.grow', {}, [h('div', { text: label, style: { fontWeight: 600 } }), sub ? h('div.sub', { text: sub }) : null]),
    h('div.val', { text: val }),
  ]);
  if (base.maxWeight) recs.append(prRow(PR_LABELS.weight, `${fmtKg(base.maxWeight.value)} × ${base.maxWeight.reps}`, fmtDate(base.maxWeight.date)));
  if (base.e1rm) recs.append(prRow(PR_LABELS.e1rm, fmtKg(Math.round(base.e1rm.value * 10) / 10), `${fmtKg(base.e1rm.weight)} × ${base.e1rm.reps} · ${fmtDate(base.e1rm.date)}`));
  if (base.sessionVolume) recs.append(prRow(PR_LABELS.volume, `${fmtNum(base.sessionVolume.value)} ${unit}`, fmtDate(base.sessionVolume.date)));
  const repsRows = [...base.repsAtWeight.entries()].sort((a, b) => b[0] - a[0]).slice(0, 4);
  if (repsRows.length) recs.append(prRow('Meiste Wiederholungen je Gewicht', '', repsRows.map(([w, r]) => `${fmtKg(w)}: ${r.reps} Wdh`).join(' · ')));
  root.append(recs);

  // Kraftstandard relativ zum Körpergewicht
  const std = base.e1rm ? strengthStandard(name, base.e1rm.value) : null;
  if (std) {
    root.append(h('div.subhead', {}, [h('h2', { text: 'Kraftstandard' })]));
    if (std.needsBodyweight) {
      root.append(h('div.card', {}, [
        h('p.small.muted', { text: 'Trag dein Körpergewicht unter „Gewicht & Maße“ ein, dann siehst du hier, wo dein e1RM im Vergleich steht.' }),
        h('button.btn.sm.ghost.mt', { text: 'Körpergewicht eintragen', onclick: () => navigate('/body') }),
      ]));
    } else {
      const pct = std.level < 0 ? (base.e1rm.value / std.thresholds[0]) * 100
        : std.next ? ((base.e1rm.value - std.thresholds[std.level]) / (std.next.weight - std.thresholds[std.level])) * 100 : 100;
      root.append(h('div.card.standard-card', {}, [
        h('div.row.between', {}, [
          h('div', {}, [
            h('div.small.faint', { text: `e1RM ${fmtKg(Math.round(base.e1rm.value))} · ${std.ratio.toFixed(2).replace('.', ',')} × Körpergewicht (${fmtKg(std.bodyweight)})` }),
            h('div.std-level', { text: std.levelName }),
          ]),
          iconBox('medal', std.level >= 2 ? 'good' : ''),
        ]),
        h('div.std-track', {}, [h('i', { style: { width: `${Math.max(2, Math.min(100, pct))}%` } })]),
        h('div.row.between.small.faint', { style: { marginTop: '4px' } }, [
          h('span', { text: std.level < 0 ? 'Einsteiger' : LEVELS_LABEL(std.level) }),
          h('span', { text: std.next ? `${std.next.name} ab ${fmtKg(Math.round(std.next.weight))} · noch ${fmtKg(Math.round(std.next.missing))}` : 'Höchste Stufe erreicht' }),
        ]),
        h('div.std-scale', {}, std.thresholds.map((t, i) => h('span' + (i <= std.level ? '.on' : ''), { text: `${fmtKg(Math.round(t))}` }))),
        h('p.small.faint.mt', { text: 'Richtwerte für den Sport – Körperbau, Alter und Technik spielen mit rein.' }),
      ]));
    }
  }

  // 1RM-/Prozent-Tabelle
  if (base.e1rm) {
    const step = inferWeightStep(name);
    const rows = percentTable(base.e1rm.value, step);
    const det = h('details.raw', {}, [
      h('summary', { text: `Prozent-Tabelle (aus e1RM ${fmtKg(Math.round(base.e1rm.value))})` }),
      h('div.card.tbl-wrap', { style: { marginTop: '8px' } }, [h('table.tbl.pct-table', {}, [
        h('thead', {}, [h('tr', {}, [h('th', { text: '% 1RM' }), h('th.num', { text: 'Gewicht' }), h('th.num', { text: '≈ Wdh' })])]),
        h('tbody', {}, rows.map(r => h('tr', {}, [h('td', { text: `${r.pct} %` }), h('td.num', { text: fmtKg(r.weight) }), h('td.num', { text: String(r.reps) })]))),
      ])]),
    ]);
    root.append(det);
  }

  // Alle Einheiten
  root.append(h('div.subhead', {}, [h('h2', { text: 'Alle Einheiten' })]));
  const tbl = h('table.tbl', {}, [h('thead', {}, [h('tr', {}, [h('th', { text: 'Datum' }), h('th', { text: 'Sätze' }), h('th.num', { text: 'e1RM' })])])]);
  const tb = h('tbody');
  for (let i = hist.length - 1; i >= 0; i--) {
    const { session, entry } = hist[i];
    tb.append(h('tr', { onclick: () => navigate('/session/' + session.id), style: { cursor: 'pointer' } }, [
      h('td', { text: fmtShortDate(session.startedAt) }),
      h('td', { text: entry.sets.map(s => `${s.weight ?? '–'}×${s.reps ?? '–'}`).join(' · '), style: { fontSize: '13px' } }),
      h('td.num', { text: fmtWeight(Math.round(bests[i].e1rm), unit) }),
    ]));
  }
  tbl.append(tb);
  root.append(h('div.card.tbl-wrap', {}, [tbl]));
}

// ---------- Session ----------

function renderSession(root, { params, query, navigate }) {
  const s = getSession(params[0]);
  if (!s) { navigate('/progress', true); return; }
  const settings = getSettings();
  const fresh = query.get('fresh') === '1';
  const prs = sessionPRs(s);
  const ms = muscleSets([s]);

  root.append(h('button.back', { html: svgIcon.back + `<span>${fresh ? 'Pläne' : 'Fortschritt'}</span>`, onclick: () => navigate(fresh ? '/plans' : '/progress') }));
  root.append(h('div.page-head', {}, [
    h('div.grow', {}, [h('div.eyebrow', { text: fmtDate(s.startedAt, { time: true }) }), h('h1', { text: s.planName })]),
  ]));

  if (fresh) root.append(h('div.card', { style: { borderColor: 'var(--good)', marginBottom: '12px' }, html: '<b>Stark!</b> Workout gespeichert.' }));

  const sets = s.entries.reduce((a, e) => a + e.sets.length, 0);
  root.append(h('div.stats', {}, [
    stat(fmtDuration(s.durationSec), 'Dauer'),
    stat(String(sets), 'Sätze'),
    stat(`${fmtNum(sessionVolume(s))}<small>${settings.unit}</small>`, 'Volumen'),
    stat(String(prs.length), 'Rekorde'),
  ]));

  // Teilbare Bildkarte
  const shareBtn = h('button.btn.block.mt' + (fresh ? '.primary' : '.ghost'), { html: svgIcon.share + '<span>Workout-Karte teilen</span>', onclick: async () => {
    shareBtn.disabled = true;
    try { await shareSession(s); } catch (e) { toast('Teilen fehlgeschlagen: ' + e.message, { duration: 4000 }); }
    finally { shareBtn.disabled = false; }
  } });
  root.append(shareBtn);

  // Meilensteine, die mit diesem Workout erreicht wurden
  const reached = milestonesReachedAt(s);
  if (reached.length) {
    root.append(h('div.card.mt.milestone-card', {}, reached.map(m => h('div.row', { style: { gap: '12px' } }, [
      iconBox('trophy', 'good'),
      h('div.grow', {}, [h('div', { text: m.title, style: { fontWeight: 700 } }), h('div.small.faint', { text: m.desc })]),
    ]))));
  }

  // Trainierte Muskeln
  root.append(h('div.subhead', {}, [h('h2', { text: 'Trainierte Muskeln' })]));
  root.append(h('div.grid-2', {}, [
    h('div.bodymap-wrap.compact', { html: bodyMapSvg('front', ms.totals, { mode: 'session' }) }),
    h('div.bodymap-wrap.compact', { html: bodyMapSvg('back', ms.totals, { mode: 'session' }) }),
  ]));
  const trained = Object.entries(ms.totals).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  root.append(h('div.small.muted', { style: { marginTop: '8px' }, text: trained.map(([k, n]) => `${MUSCLE_NAME[k]} ${fmtSets(n)}`).join(' · ') }));

  if (prs.length) {
    root.append(h('div.subhead', {}, [h('h2', { text: 'Neue Rekorde' })]));
    root.append(h('div.card', {}, prs.map(p => h('div.pr-row', {}, [
      h('div', {}, [h('div', { text: p.name, style: { fontWeight: 600 } }), h('div.sub', { text: PR_LABELS[p.type] + (p.prev ? ` · vorher ${p.type === 'volume' ? fmtNum(p.prev) + ' ' + settings.unit : fmtKg(Math.round(p.prev * 10) / 10)}` : '') })]),
      h('div.val', { text: p.type === 'volume' ? `${fmtNum(p.value)} ${settings.unit}` : p.type === 'e1rm' ? fmtKg(Math.round(p.value * 10) / 10) : `${fmtKg(p.weight)} × ${p.reps}` }),
    ]))));
  }

  root.append(h('div.subhead', {}, [h('h2', { text: 'Übungen' }), h('button.btn.sm.ghost', { text: 'Bearbeiten', onclick: () => editSession(s, navigate) })]));
  const card = h('div.card');
  s.entries.forEach((e, i) => {
    const b = entryBest(e);
    card.append(h('div.ex-row', { onclick: () => navigate('/exercise/' + encodeURIComponent(e.name)), style: { cursor: 'pointer' } }, [
      h('div.idx', { text: i + 1 }),
      h('div.grow', {}, [
        h('div', { text: e.name, style: { fontWeight: 600 } }),
        h('div.target', { text: e.sets.map(s => `${s.weight ?? '–'}×${s.reps ?? '–'}` + (s.type ? ` ${s.type.toUpperCase()}` : '') + (s.rir != null ? ` (RIR ${s.rir})` : '')).join(' · ') }),
        h('div.small.faint', { text: `Volumen ${fmtNum(b.volume)} ${settings.unit} · Best ${fmtWeight(b.maxWeight, settings.unit)} · e1RM ${fmtWeight(Math.round(b.e1rm), settings.unit)}` }),
        e.sessionNote ? h('div.small.muted', { text: `„${e.sessionNote}“` }) : null,
      ]),
      h('div', { html: svgIcon.chevron }),
    ]));
  });
  root.append(card);

  const noteEl = h('p.muted', { text: s.note || 'Keine Notiz' });
  root.append(h('div.subhead', {}, [h('h2', { text: 'Notiz' }), h('button.btn.sm.ghost', { text: 'Bearbeiten', onclick: async () => {
    const v = await promptSheet({ title: 'Notiz', value: s.note || '', placeholder: 'Wie lief’s?' });
    if (v != null) { updateSession(s.id, { note: v }); noteEl.textContent = v; }
  } })]));
  root.append(h('div.card', {}, [noteEl]));

  root.append(h('button.btn.danger.block.mt-lg', { text: 'Workout löschen', onclick: async () => {
    if (await confirmSheet({ title: 'Workout löschen?', text: 'Das kann nicht rückgängig gemacht werden.', okLabel: 'Löschen', danger: true })) {
      deleteSession(s.id); toast('Workout gelöscht'); navigate('/progress', true);
    }
  } }));
}

/** Vergangene Session korrigieren: Gewicht/Wdh je Satz, Sätze hinzufügen/entfernen */
function editSession(s, navigate) {
  const draft = s.entries.map(e => ({ ...e, sets: e.sets.map(x => ({ ...x })) }));
  openSheet((sheet, close) => {
    const list = h('div.stack');
    const drawList = () => {
      list.innerHTML = '';
      draft.forEach((e) => {
        const box = h('div.card', { style: { padding: '10px 12px' } }, [h('div', { text: e.name, style: { fontWeight: 700, marginBottom: '6px' } })]);
        box.append(h('div.edit-set', { style: { fontSize: '11px', color: 'var(--text-3)', fontWeight: 700 } }, [h('span', { text: '#' }), h('span', { text: 'kg' }), h('span', { text: 'Wdh' }), h('span')]));
        e.sets.forEach((set, si) => {
          const wIn = h('input.input.num', { type: 'text', inputmode: 'decimal', value: set.weight ?? '' });
          const rIn = h('input.input.num', { type: 'text', inputmode: 'numeric', value: set.reps ?? '' });
          wIn.addEventListener('input', () => { set.weight = parseNum(wIn.value); });
          rIn.addEventListener('input', () => { set.reps = parseNum(rIn.value); });
          box.append(h('div.edit-set', {}, [
            h('span.mono.faint', { text: String(si + 1) }), wIn, rIn,
            h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Satz entfernen', style: { width: '40px', minHeight: '40px' }, onclick: () => { e.sets.splice(si, 1); drawList(); } }),
          ]));
        });
        box.append(h('button.btn.sm.ghost', { text: '+ Satz', style: { marginTop: '6px' }, onclick: () => { const p = e.sets[e.sets.length - 1]; e.sets.push({ weight: p?.weight ?? null, reps: p?.reps ?? null, done: true }); drawList(); } }));
        list.append(box);
      });
    };
    drawList();
    sheet.append(
      h('h2', { text: 'Workout bearbeiten' }),
      h('p.small.muted.mb', { text: 'Korrekturen wirken auf Rekorde, Progression und Statistik.' }),
      list,
      h('div.actions', {}, [
        h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
        h('button.btn.primary', { text: 'Speichern', onclick: () => {
          const entries = draft.map(e => ({ ...e, sets: e.sets.filter(x => x.weight != null || x.reps != null) })).filter(e => e.sets.length);
          updateSession(s.id, { entries });
          close(); toast('Workout aktualisiert'); navigate('/session/' + s.id, true);
        } }),
      ]),
    );
  });
}

// ---------- Muskelgruppen-Dashboard ----------

let mWeekOffset = 0;
let mSide = 'front';
let mSelected = null;

function renderMuscles(root, { navigate }) {
  const sessions = getSessions();
  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Wochenbilanz' }), h('h1', { text: 'Muskelgruppen' })])]));

  const weekLbl = h('div.center.grow', { style: { fontWeight: 700, fontSize: '15px' } });
  const weekNav = h('div.row.between.mb', {}, [
    h('button.btn.icon.ghost', { text: '‹', 'aria-label': 'Vorherige Woche', style: { fontSize: '22px' }, onclick: () => { mWeekOffset++; draw(); } }),
    weekLbl,
    h('button.btn.icon.ghost', { text: '›', 'aria-label': 'Nächste Woche', style: { fontSize: '22px' }, disabled: mWeekOffset === 0, onclick: () => { mWeekOffset = Math.max(0, mWeekOffset - 1); draw(); } }),
  ]);
  root.append(weekNav);

  const mapWrap = h('div.bodymap-wrap');
  const sideSeg = h('div.seg', { style: { margin: '10px 0' } }, [
    h('button', { text: 'Vorderseite', onclick: () => { mSide = 'front'; draw(); } }),
    h('button', { text: 'Rückseite', onclick: () => { mSide = 'back'; draw(); } }),
  ]);
  const detail = h('div');
  const barsCard = h('div.card');
  root.append(mapWrap, h('div.legend', { html: '<span>leicht</span><i></i><span>intensiv</span>' }), sideSeg, detail, h('div.subhead', {}, [h('h2', { text: 'Deine Trainingswoche' })]), barsCard);

  let firstDraw = true; // Balken nur beim ersten Aufbau von 0 animieren
  const draw = () => {
    const weekStart = weekKey(Date.now()) - mWeekOffset * 7 * 86400000;
    const wkSessions = sessionsInWeek(sessions, weekStart);
    const ms = muscleSets(wkSessions);
    const end = new Date(weekStart + 6 * 86400000);
    weekLbl.textContent = (mWeekOffset === 0 ? 'Diese Woche · ' : mWeekOffset === 1 ? 'Letzte Woche · ' : '') + `${fmtShortDate(weekStart)} – ${fmtShortDate(end)}`;
    weekNav.lastChild.disabled = mWeekOffset === 0;
    for (const b of sideSeg.children) b.classList.toggle('active', (b.textContent === 'Vorderseite') === (mSide === 'front'));

    mapWrap.innerHTML = bodyMapSvg(mSide, ms.totals, { mode: 'week', selected: mSelected, still: !firstDraw });
    mapWrap.querySelectorAll('.muscle[data-muscle]').forEach(el => el.addEventListener('click', () => { mSelected = mSelected === el.dataset.muscle ? null : el.dataset.muscle; draw(); }));

    // Detailkarte
    detail.innerHTML = '';
    if (mSelected) {
      const st = muscleWeekStats(sessions, mSelected, weekStart);
      detail.append(h('div.card', { style: { borderColor: intensityColor(ratioFor(st.thisWeek)) || 'var(--border)' } }, [
        h('div.row.between', {}, [h('h3', { text: MUSCLE_NAME[mSelected].toUpperCase() }), h('button.btn.sm.ghost', { text: '✕', onclick: () => { mSelected = null; draw(); } })]),
        h('div.stats.cols-3.mt', {}, [
          stat(fmtSetsShort(st.thisWeek), 'Diese Woche'),
          stat(fmtSetsShort(st.lastWeek), 'Letzte Woche'),
          stat(fmtSetsShort(st.avg4), '4-Wochen-Ø'),
        ]),
        st.exercises.length
          ? h('div.mt', {}, [h('div.small.faint', { text: 'Übungen diese Woche', style: { marginBottom: '4px' } }), ...st.exercises.map(([n, c]) => h('div.row.between', { style: { padding: '4px 0' } }, [h('span', { text: n }), h('span.mono', { text: fmtSets(c) })]))])
          : h('p.small.muted.mt', { text: 'In dieser Woche nicht trainiert.' }),
      ]));
    }

    // Balken mit Zielband (Volumen-Ziel aus den Einstellungen)
    barsCard.innerHTML = '';
    const target = volumeTarget();
    const max = Math.max(target.max * 1.15, ...Object.values(ms.totals));
    barsCard.append(h('div.small.faint', { style: { marginBottom: '4px' }, text: `Ziel ${target.min}–${target.max} Sätze pro Woche (unter „Mehr“ einstellbar)` }));
    for (const [k, label] of MUSCLES) {
      const n = ms.totals[k];
      const st = volumeStatus(n);
      const color = intensityColor(ratioFor(n)) || 'var(--surface-3)';
      barsCard.append(h('div.mbar.' + st + (mSelected === k ? '.selected' : ''), { onclick: () => { mSelected = mSelected === k ? null : k; draw(); } }, [
        h('div.name', { text: label }),
        h('div.track', {}, [
          h('span.band', { style: { left: `${(target.min / max) * 100}%`, width: `${((target.max - target.min) / max) * 100}%` } }),
          (() => { const bar = h('i', { style: { width: firstDraw ? '0%' : `${(n / max) * 100}%`, background: color } }); if (firstDraw) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = `${(n / max) * 100}%`; })); return bar; })(),
        ]),
        h('div.n', { html: fmtSetsShort(n) + (n > 0 ? `<span class="mtag ${st}">${st === 'in' ? '✓' : st === 'under' ? '↓' : '↑'}</span>` : '') }),
      ]));
    }
    if (ms.unknown.length) barsCard.append(h('div.mt', {}, [
      h('p.small.faint', { text: 'Ohne Zuordnung: ' + ms.unknown.join(', ') }),
      h('div.row', { style: { gap: '6px', flexWrap: 'wrap', marginTop: '6px' } }, ms.unknown.map(n => h('button.btn.sm.ghost', { text: `„${n}“ zuordnen`, onclick: () => openCustomExerciseEditor(n, () => draw()) }))),
    ]));
    if (!wkSessions.length) barsCard.append(h('p.small.muted.mt', { text: 'Keine Workouts in dieser Woche.' }));
  };
  draw();
  firstDraw = false;
}

function fmtSetsShort(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','); }

// ---------- Charts (SVG, eine Serie, ohne Bibliothek) ----------

function weeklyBarChart(sessions, weeks, W = 600) {
  const H = 170, padL = 28, padB = 26, padT = 20, padR = 8;
  const now = weekKey(Date.now());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const wk = now - i * 7 * 86400000;
    buckets.push({ wk, n: sessions.filter(s => weekKey(s.startedAt) === wk).length });
  }
  const max = Math.max(3, ...buckets.map(b => b.n));
  const root = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Workouts pro Woche' });
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const grid = svg('g', { class: 'grid' });
  for (let v = 0; v <= max; v += Math.ceil(max / 3)) {
    const y = padT + plotH - (v / max) * plotH;
    grid.append(svg('line', { x1: padL, x2: W - padR, y1: y, y2: y }));
    grid.append(svg('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', text: String(v) }));
  }
  root.append(grid);
  const gap = 6, bw = plotW / buckets.length - gap;
  const tip = svg('g', { class: 'tip', visibility: 'hidden' });
  const tipRect = svg('rect', { height: 22, width: 90, y: 0 }), tipText = svg('text', { y: 15, 'text-anchor': 'middle' });
  tip.append(tipRect, tipText);
  buckets.forEach((b, i) => {
    const x = padL + i * (bw + gap) + gap / 2;
    const hgt = (b.n / max) * plotH;
    const y = padT + plotH - hgt;
    root.append(svg('rect', { class: 'bar' + (b.n ? '' : ' dim'), x, y: b.n ? y : padT + plotH - 3, width: bw, height: b.n ? hgt : 3, rx: 4 }));
    const d = new Date(b.wk);
    if (i % 2 === 1 || buckets.length <= 6) root.append(svg('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', text: `${d.getDate()}.${d.getMonth() + 1}.` }));
    const hit = svg('rect', { class: 'hit', x: x - gap / 2, y: padT, width: bw + gap, height: plotH });
    const show = () => {
      tipText.textContent = `${b.n} Workout${b.n === 1 ? '' : 's'} · ab ${d.getDate()}.${d.getMonth() + 1}.`;
      const tw = tipText.textContent.length * 6.4 + 16;
      tipRect.setAttribute('width', tw);
      const tx = Math.min(Math.max(x + bw / 2, padL + tw / 2), W - padR - tw / 2);
      tip.setAttribute('transform', `translate(${tx - tw / 2}, ${Math.max(0, y - 30)})`);
      tipText.setAttribute('x', tw / 2);
      tip.setAttribute('visibility', 'visible');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.setAttribute('visibility', 'hidden'));
    root.append(hit);
  });
  root.append(tip);
  return root;
}

/**
 * Linienchart mit Tooltip (mehrzeilig) – pts: [{x:ts, y:number, ...meta}]
 */
function lineChart(pts, { unit, tooltip, width = 600 }) {
  const W = width, H = 220, padL = 46, padB = 26, padT = 16, padR = 14;
  const root = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Verlauf' });
  if (!pts.length) return root;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const ys = pts.map(p => p.y);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMin === yMax) { yMin = Math.max(0, yMin - 5); yMax = yMax + 5; }
  const span = yMax - yMin;
  yMin = Math.max(0, yMin - span * 0.15); yMax = yMax + span * 0.15;
  // x über Zeit verteilen, aber mindestens gleichmäßig lesbar
  const xs = pts.map((p, i) => pts.length === 1 ? padL + plotW / 2 : padL + (i / (pts.length - 1)) * plotW);
  const yOf = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const grid = svg('g', { class: 'grid' });
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (i / 4) * (yMax - yMin);
    const y = yOf(v);
    grid.append(svg('line', { x1: padL, x2: W - padR, y1: y, y2: y }));
    grid.append(svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', text: fmtNum(v) }));
  }
  root.append(grid);

  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yOf(pts[i].y).toFixed(1)}`).join(' ');
  if (pts.length > 1) {
    root.append(svg('path', { class: 'area', d: `${path} L${xs[xs.length - 1]},${padT + plotH} L${xs[0]},${padT + plotH} Z` }));
    root.append(svg('path', { class: 'line', d: path }));
  }
  const every = Math.max(1, Math.ceil(pts.length / 6));
  pts.forEach((p, i) => {
    if (i % every === 0 || i === pts.length - 1) {
      root.append(svg('text', { x: xs[i], y: H - 8, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle', text: fmtShortDate(p.x) }));
    }
  });

  const tip = svg('g', { class: 'tip', visibility: 'hidden' });
  const tipRect = svg('rect', { height: 22, width: 90 });
  tip.append(tipRect);
  const cross = svg('line', { class: 'cross', y1: padT, y2: padT + plotH, visibility: 'hidden' });
  root.append(cross);
  const dots = pts.map((p, i) => { const d = svg('circle', { class: 'dot', cx: xs[i], cy: yOf(p.y), r: 4 }); root.append(d); return d; });
  const slotW = pts.length > 1 ? (xs[1] - xs[0]) : plotW;
  let pinned = -1;
  const hide = () => { if (pinned >= 0) return; tip.setAttribute('visibility', 'hidden'); cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('r', 4)); };
  const show = (i) => {
    const p = pts[i];
    dots.forEach((d, j) => d.setAttribute('r', j === i ? 6 : 4));
    const lines = [`${fmtNum(Math.round(p.y * 10) / 10)} ${unit}`, ...(tooltip ? tooltip(p) : [])];
    tip.querySelectorAll('text').forEach(t => t.remove());
    const tw = Math.max(...lines.map(l => l.length)) * 6.6 + 16;
    const th = lines.length * 16 + 8;
    tipRect.setAttribute('width', tw); tipRect.setAttribute('height', th);
    lines.forEach((l, k) => tip.append(svg('text', { x: 8, y: 16 + k * 16, 'text-anchor': 'start', text: l, style: k ? 'font-weight:500' : '' })));
    const tx = Math.min(Math.max(xs[i] - tw / 2, 2), W - tw - 2);
    const ty = yOf(p.y) - th - 12 < 0 ? yOf(p.y) + 12 : yOf(p.y) - th - 12;
    tip.setAttribute('transform', `translate(${tx}, ${ty})`);
    tip.setAttribute('visibility', 'visible');
    cross.setAttribute('x1', xs[i]); cross.setAttribute('x2', xs[i]); cross.setAttribute('visibility', 'visible');
  };
  pts.forEach((p, i) => {
    const hit = svg('rect', { class: 'hit', x: xs[i] - slotW / 2, y: padT, width: slotW, height: plotH });
    hit.addEventListener('pointerenter', () => show(i));
    hit.addEventListener('pointerdown', (e) => { e.preventDefault(); pinned = pinned === i ? -1 : i; show(i); if (pinned < 0) hide(); });
    hit.addEventListener('pointerleave', hide);
    root.append(hit);
  });
  root.append(tip);
  return root;
}
