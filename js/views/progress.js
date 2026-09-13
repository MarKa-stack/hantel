// Fortschritt: Statistik, Übungen mit Bestwerten, Verlauf, Detailseiten
import { h, svg, svgIcon, fmtDuration, fmtDurationLong, fmtDate, fmtShortDate, fmtWeight, fmtNum, dateParts, weekKey, confirmSheet, toast, promptSheet } from '../util.js';
import { getSessions, getSession, deleteSession, updateSession, exerciseIndex, exerciseHistory, entryBest, sessionVolume, detectPRs, getSettings } from '../store.js';

export function render(root, ctx) {
  if (ctx.sub === 'exercise') return renderExercise(root, ctx);
  if (ctx.sub === 'session') return renderSession(root, ctx);
  return renderOverview(root, ctx);
}

// ---------- Übersicht ----------

function renderOverview(root, { navigate }) {
  const settings = getSettings();
  const sessions = getSessions();

  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Hantel' }), h('h1', { text: 'Fortschritt' })])]));

  if (!sessions.length) {
    root.append(h('div.empty', {}, [
      h('div.icon', { text: '📈' }),
      h('h3', { text: 'Noch keine Workouts' }),
      h('p', { text: 'Sobald du dein erstes Training abschließt, siehst du hier Statistiken, Rekorde und Verlauf.' }),
    ]));
    return;
  }

  // Kennzahlen
  const thisWeek = weekKey(Date.now());
  const weekSessions = sessions.filter(s => weekKey(s.startedAt) === thisWeek);
  const weekVol = weekSessions.reduce((a, s) => a + sessionVolume(s), 0);
  const streak = weekStreak(sessions);

  root.append(h('div.stats', {}, [
    stat(String(weekSessions.length), 'Diese Woche'),
    stat(String(sessions.length), 'Workouts gesamt'),
    stat(`${fmtNum(weekVol)}<small>${settings.unit}</small>`, 'Volumen · Woche'),
    stat(`${streak}<small>Wo.</small>`, 'Serie'),
  ]));

  // Wochen-Chart
  root.append(h('div.subhead', {}, [h('h2', { text: 'Workouts pro Woche' })]));
  root.append(h('div.card', {}, [weeklyBarChart(sessions, 12)]));

  // Übungen
  const idx = exerciseIndex();
  root.append(h('div.subhead', {}, [h('h2', { text: 'Übungen & Rekorde' })]));
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
  root.append(exCard);

  // Verlauf
  root.append(h('div.subhead', {}, [h('h2', { text: 'Verlauf' })]));
  const list = h('div.list');
  for (const s of [...sessions].reverse()) list.append(sessionRow(s, settings, navigate));
  root.append(list);
}

function stat(valHtml, label) {
  return h('div.stat', {}, [h('div.val', { html: valHtml }), h('div.lbl', { text: label })]);
}

function sessionRow(s, settings, navigate) {
  const { d, m } = dateParts(s.startedAt);
  const sets = s.entries.reduce((a, e) => a + e.sets.length, 0);
  return h('div.card.tappable.session-row', { onclick: () => navigate('/session/' + s.id) }, [
    h('div.date', {}, [h('div.d', { text: d }), h('div.m', { text: m })]),
    h('div.grow', {}, [
      h('div.truncate', { text: s.planName, style: { fontWeight: 600 } }),
      h('div.meta', { text: `${fmtDurationLong(s.durationSec)} · ${s.entries.length} Übungen · ${sets} Sätze · ${fmtNum(sessionVolume(s))} ${settings.unit}` }),
    ]),
    h('div', { html: svgIcon.chevron }),
  ]);
}

function weekStreak(sessions) {
  const weeks = new Set(sessions.map(s => weekKey(s.startedAt)));
  let wk = weekKey(Date.now());
  let n = 0;
  // Die laufende Woche zählt, wenn trainiert wurde – sonst ab letzter Woche zählen
  if (!weeks.has(wk)) wk -= 7 * 86400000;
  while (weeks.has(wk)) { n++; wk -= 7 * 86400000; }
  return n;
}

// ---------- Übung ----------

let exMetric = 'weight';

function renderExercise(root, { params, navigate }) {
  const name = params[0];
  const settings = getSettings();
  const hist = exerciseHistory(name);

  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: `${hist.length}× trainiert` }), h('h1', { text: name })])]));

  if (!hist.length) { root.append(h('div.empty', {}, [h('p', { text: 'Keine Daten.' })])); return; }

  const bests = hist.map(x => entryBest(x.entry));
  const maxW = Math.max(...bests.map(b => b.maxWeight));
  const maxRM = Math.max(...bests.map(b => b.e1rm));
  const maxVol = Math.max(...bests.map(b => b.volume));
  const last = hist[hist.length - 1];

  root.append(h('div.stats', {}, [
    stat(fmtWeight(maxW, settings.unit), 'Max. Gewicht'),
    stat(fmtWeight(Math.round(maxRM), settings.unit), 'Bestes 1RM (gesch.)'),
    stat(`${fmtNum(maxVol)}<small>${settings.unit}</small>`, 'Max. Volumen'),
    stat(fmtShortDate(last.session.startedAt), 'Zuletzt'),
  ]));

  const chartBox = h('div.card.mt');
  const seg = h('div.seg.mt', {}, [
    ['weight', 'Gewicht'], ['e1rm', '1RM'], ['volume', 'Volumen'],
  ].map(([k, l]) => h('button', { text: l, class: exMetric === k ? 'active' : '', onclick: () => { exMetric = k; drawChart(); } })));

  const drawChart = () => {
    for (const b of seg.children) b.classList.toggle('active', b.textContent === { weight: 'Gewicht', e1rm: '1RM', volume: 'Volumen' }[exMetric]);
    chartBox.innerHTML = '';
    const pts = hist.map((x, i) => ({
      x: x.session.startedAt,
      y: exMetric === 'weight' ? bests[i].maxWeight : exMetric === 'e1rm' ? Math.round(bests[i].e1rm * 10) / 10 : bests[i].volume,
    }));
    const unit = settings.unit;
    chartBox.append(lineChart(pts, { unit }));
  };
  root.append(seg, chartBox);
  drawChart();

  // Tabelle
  root.append(h('div.subhead', {}, [h('h2', { text: 'Alle Einheiten' })]));
  const tbl = h('table.tbl', {}, [
    h('thead', {}, [h('tr', {}, [h('th', { text: 'Datum' }), h('th', { text: 'Sätze' }), h('th.num', { text: 'Best' })])]),
  ]);
  const tb = h('tbody');
  for (let i = hist.length - 1; i >= 0; i--) {
    const { session, entry } = hist[i];
    tb.append(h('tr', { onclick: () => navigate('/session/' + session.id), style: { cursor: 'pointer' } }, [
      h('td', { text: fmtShortDate(session.startedAt) }),
      h('td', { text: entry.sets.map(s => `${s.weight ?? '–'}×${s.reps ?? '–'}`).join(' · '), style: { fontSize: '13px' } }),
      h('td.num', { text: fmtWeight(bests[i].maxWeight, settings.unit) }),
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
  const prs = detectPRs(s);

  root.append(h('button.back', { html: svgIcon.back + `<span>${fresh ? 'Pläne' : 'Fortschritt'}</span>`, onclick: () => navigate(fresh ? '/plans' : '/progress') }));
  root.append(h('div.page-head', {}, [
    h('div.grow', {}, [h('div.eyebrow', { text: fmtDate(s.startedAt, { time: true }) }), h('h1', { text: s.planName })]),
  ]));

  if (fresh) root.append(h('div.card', { style: { borderColor: 'var(--good)', marginBottom: '12px' }, html: '<b>Stark! 💪</b> Workout gespeichert.' }));

  const sets = s.entries.reduce((a, e) => a + e.sets.length, 0);
  root.append(h('div.stats', {}, [
    stat(fmtDuration(s.durationSec), 'Dauer'),
    stat(String(sets), 'Sätze'),
    stat(`${fmtNum(sessionVolume(s))}<small>${settings.unit}</small>`, 'Volumen'),
    stat(String(prs.length), 'Rekorde'),
  ]));

  if (prs.length) {
    root.append(h('div.subhead', {}, [h('h2', { text: 'Neue Rekorde' })]));
    root.append(h('div.card', {}, prs.map(p => h('div.pr-row', {}, [
      h('div', {}, [h('div', { text: '🏆 ' + p.name, style: { fontWeight: 600 } }), h('div.sub', { text: (p.type === 'weight' ? 'Maximalgewicht' : 'Geschätztes 1RM') + (p.prev ? ` · vorher ${fmtWeight(Math.round(p.prev * 10) / 10, settings.unit)}` : '') })]),
      h('div.val', { text: fmtWeight(Math.round(p.value * 10) / 10, settings.unit) }),
    ]))));
  }

  root.append(h('div.subhead', {}, [h('h2', { text: 'Übungen' })]));
  const card = h('div.card');
  s.entries.forEach((e, i) => {
    const b = entryBest(e);
    card.append(h('div.ex-row', { onclick: () => navigate('/exercise/' + encodeURIComponent(e.name)), style: { cursor: 'pointer' } }, [
      h('div.idx', { text: i + 1 }),
      h('div.grow', {}, [
        h('div', { text: e.name, style: { fontWeight: 600 } }),
        h('div.target', { text: e.sets.map(s => `${s.weight ?? '–'}×${s.reps ?? '–'}`).join(' · ') }),
        h('div.small.faint', { text: `Volumen ${fmtNum(b.volume)} ${settings.unit} · Best ${fmtWeight(b.maxWeight, settings.unit)}` }),
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

// ---------- Charts (SVG, eine Serie, ohne Bibliothek) ----------

function weeklyBarChart(sessions, weeks) {
  const W = 600, H = 170, padL = 28, padB = 26, padT = 20, padR = 8;
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
    const bar = svg('rect', { class: 'bar' + (b.n ? '' : ' dim'), x, y: b.n ? y : padT + plotH - 3, width: bw, height: b.n ? hgt : 3, rx: 4 });
    root.append(bar);
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

function lineChart(pts, { unit }) {
  const W = 600, H = 200, padL = 44, padB = 26, padT = 20, padR = 14;
  const root = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Verlauf' });
  if (!pts.length) return root;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const ys = pts.map(p => p.y);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMin === yMax) { yMin = Math.max(0, yMin - 5); yMax = yMax + 5; }
  const span = yMax - yMin;
  yMin = Math.max(0, yMin - span * 0.15); yMax = yMax + span * 0.15;
  const xs = pts.map((p, i) => pts.length === 1 ? padL + plotW / 2 : padL + (i / (pts.length - 1)) * plotW);
  const yOf = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const grid = svg('g', { class: 'grid' });
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = yMin + (i / steps) * (yMax - yMin);
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

  // X-Labels (max. 6)
  const every = Math.max(1, Math.ceil(pts.length / 6));
  pts.forEach((p, i) => {
    if (i % every === 0 || i === pts.length - 1) {
      root.append(svg('text', { x: xs[i], y: H - 8, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle', text: fmtShortDate(p.x) }));
    }
  });

  const tip = svg('g', { class: 'tip', visibility: 'hidden' });
  const tipRect = svg('rect', { height: 22, width: 90 }), tipText = svg('text', { y: 15, 'text-anchor': 'middle' });
  const cross = svg('line', { class: 'cross', y1: padT, y2: padT + plotH, visibility: 'hidden' });
  tip.append(tipRect, tipText);
  root.append(cross);
  const dots = pts.map((p, i) => { const d = svg('circle', { class: 'dot', cx: xs[i], cy: yOf(p.y), r: 4 }); root.append(d); return d; });

  const slotW = pts.length > 1 ? (xs[1] - xs[0]) : plotW;
  pts.forEach((p, i) => {
    const hit = svg('rect', { class: 'hit', x: xs[i] - slotW / 2, y: padT, width: slotW, height: plotH });
    const show = () => {
      dots.forEach((d, j) => d.setAttribute('r', j === i ? 6 : 4));
      tipText.textContent = `${fmtDate(p.x)} · ${fmtNum(p.y)} ${unit}`;
      const tw = tipText.textContent.length * 6.4 + 16;
      tipRect.setAttribute('width', tw);
      tipText.setAttribute('x', tw / 2);
      const tx = Math.min(Math.max(xs[i], padL + tw / 2), W - padR - tw / 2);
      tip.setAttribute('transform', `translate(${tx - tw / 2}, ${Math.max(0, yOf(p.y) - 34)})`);
      tip.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', xs[i]); cross.setAttribute('x2', xs[i]); cross.setAttribute('visibility', 'visible');
    };
    const hide = () => { tip.setAttribute('visibility', 'hidden'); cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('r', 4)); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);
    root.append(hit);
  });
  root.append(tip);
  return root;
}
