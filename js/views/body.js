// Körpergewicht & Maße: Log mit Verlaufslinie
import { h, svg, svgIcon, fmtDate, fmtShortDate, fmtNum, confirmSheet, toast, parseNum } from '../util.js';
import { getBodyLog, addBodyEntry, deleteBodyEntry } from '../store.js';

const FIELDS = [
  ['weight', 'Gewicht', 'kg'], ['waist', 'Taille', 'cm'], ['chest', 'Brust', 'cm'], ['arm', 'Oberarm', 'cm'], ['thigh', 'Oberschenkel', 'cm'],
];
let metric = 'weight';

export function render(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Körper' }), h('h1', { text: 'Gewicht & Maße' })])]));

  // Eingabe
  const inputs = {};
  const form = h('div.card', {}, [
    h('div.grid-2', {}, FIELDS.map(([k, label, unit]) => {
      inputs[k] = h('input.input.num', { type: 'text', inputmode: 'decimal', placeholder: '–' });
      return h('div.field', {}, [h('label', { text: `${label} (${unit})` }), inputs[k]]);
    }).concat([
      (() => { inputs.note = h('input.input', { type: 'text', placeholder: 'Notiz' }); return h('div.field', {}, [h('label', { text: 'Notiz' }), inputs.note]); })(),
    ])),
    h('button.btn.primary.block.mt', { text: 'Eintrag speichern', onclick: () => {
      const entry = {};
      for (const [k] of FIELDS) { const v = parseNum(inputs[k].value); if (v != null) entry[k] = v; }
      if (!Object.keys(entry).length) { toast('Mindestens einen Wert eintragen'); return; }
      entry.note = inputs.note.value.trim();
      addBodyEntry(entry);
      toast('Gespeichert');
      navigate('/body', true);
    } }),
  ]);
  root.append(form);

  const log = getBodyLog();
  if (!log.length) {
    root.append(h('p.small.faint.mt', { text: 'Tipp: Immer zur gleichen Tageszeit wiegen (z.B. morgens nach dem Aufstehen) – dann ist die Verlaufslinie aussagekräftig.' }));
    return;
  }

  // Kennzahlen
  const withW = log.filter(e => e.weight != null);
  if (withW.length) {
    const last = withW[withW.length - 1];
    const weekAgo = [...withW].reverse().find(e => e.date <= last.date - 7 * 86400000);
    const first = withW[0];
    root.append(h('div.stats.cols-3.mt', {}, [
      h('div.stat', {}, [h('div.val', { html: `${fmtKgN(last.weight)}` }), h('div.lbl', { text: 'Aktuell' })]),
      h('div.stat', {}, [h('div.val', { text: weekAgo ? delta(last.weight - weekAgo.weight) : '–' }), h('div.lbl', { text: 'vs. 7 Tage' })]),
      h('div.stat', {}, [h('div.val', { text: withW.length > 1 ? delta(last.weight - first.weight) : '–' }), h('div.lbl', { text: 'Seit Start' })]),
    ]));
  }

  // Chart
  const seg = h('div.seg.mt', {}, FIELDS.map(([k, label]) => h('button', { text: label, class: metric === k ? 'active' : '', onclick: () => { metric = k; draw(); } })));
  const chartBox = h('div.card', { style: { marginTop: '10px' } });
  root.append(seg, chartBox);
  const draw = () => {
    for (const b of seg.children) b.classList.toggle('active', b.textContent === FIELDS.find(f => f[0] === metric)[1]);
    chartBox.innerHTML = '';
    const pts = log.filter(e => e[metric] != null).map(e => ({ x: e.date, y: e[metric] }));
    const unit = FIELDS.find(f => f[0] === metric)[2];
    if (pts.length < 2) { chartBox.append(h('p.muted.center', { text: pts.length ? 'Ab zwei Einträgen erscheint der Verlauf.' : 'Keine Werte für diese Kennzahl.' })); return; }
    chartBox.append(lineChart(pts, unit));
  };
  draw();

  // Liste
  root.append(h('div.subhead', {}, [h('h2', { text: 'Einträge' })]));
  const card = h('div.card');
  for (const e of [...log].reverse()) {
    const parts = FIELDS.filter(([k]) => e[k] != null).map(([k, label, unit]) => `${label} ${String(e[k]).replace('.', ',')} ${unit}`);
    card.append(h('div.pr-row', {}, [
      h('div.grow', {}, [h('div', { text: fmtDate(e.date), style: { fontWeight: 600 } }), h('div.sub', { text: parts.join(' · ') + (e.note ? ` · ${e.note}` : '') })]),
      h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Löschen', onclick: async () => {
        if (await confirmSheet({ title: 'Eintrag löschen?', okLabel: 'Löschen', danger: true })) { deleteBodyEntry(e.id); navigate('/body', true); }
      } }),
    ]));
  }
  root.append(card);
}

function fmtKgN(v) { return String(Math.round(v * 10) / 10).replace('.', ',') + '<small>kg</small>'; }
function delta(d) { const r = Math.round(d * 10) / 10; return (r > 0 ? '+' : '') + String(r).replace('.', ',') + ' kg'; }

function lineChart(pts, unit) {
  const W = 600, H = 200, padL = 46, padB = 26, padT = 16, padR = 14;
  const root = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Verlauf' });
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const ys = pts.map(p => p.y);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const span = yMax - yMin; yMin -= span * 0.2; yMax += span * 0.2;
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const xs = pts.map(p => x1 === x0 ? padL + plotW / 2 : padL + ((p.x - x0) / (x1 - x0)) * plotW);
  const yOf = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const grid = svg('g', { class: 'grid' });
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (i / 4) * (yMax - yMin), y = yOf(v);
    grid.append(svg('line', { x1: padL, x2: W - padR, y1: y, y2: y }));
    grid.append(svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', text: (Math.round(v * 10) / 10).toString().replace('.', ',') }));
  }
  root.append(grid);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yOf(pts[i].y).toFixed(1)}`).join(' ');
  root.append(svg('path', { class: 'area', d: `${d} L${xs[xs.length - 1]},${padT + plotH} L${xs[0]},${padT + plotH} Z` }));
  root.append(svg('path', { class: 'line', d }));
  root.append(svg('text', { x: padL, y: H - 8, text: fmtShortDate(x0) }));
  root.append(svg('text', { x: W - padR, y: H - 8, 'text-anchor': 'end', text: fmtShortDate(x1) }));
  const tip = svg('g', { class: 'tip', visibility: 'hidden' });
  const tipRect = svg('rect', { height: 22, width: 90 }), tipText = svg('text', { y: 15, 'text-anchor': 'middle' });
  tip.append(tipRect, tipText);
  const dots = pts.map((p, i) => { const c = svg('circle', { class: 'dot', cx: xs[i], cy: yOf(p.y), r: 4 }); root.append(c); return c; });
  pts.forEach((p, i) => {
    const l = i ? (xs[i] + xs[i - 1]) / 2 : padL, r = i < pts.length - 1 ? (xs[i] + xs[i + 1]) / 2 : W - padR;
    const hit = svg('rect', { class: 'hit', x: l, y: padT, width: Math.max(1, r - l), height: plotH });
    const show = () => {
      dots.forEach((c, j) => c.setAttribute('r', j === i ? 6 : 4));
      tipText.textContent = `${fmtDate(p.x)} · ${String(p.y).replace('.', ',')} ${unit}`;
      const tw = tipText.textContent.length * 6.4 + 16;
      tipRect.setAttribute('width', tw); tipText.setAttribute('x', tw / 2);
      const tx = Math.min(Math.max(xs[i], padL + tw / 2), W - padR - tw / 2);
      tip.setAttribute('transform', `translate(${tx - tw / 2}, ${Math.max(0, yOf(p.y) - 34)})`);
      tip.setAttribute('visibility', 'visible');
    };
    hit.addEventListener('pointerenter', show); hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => { tip.setAttribute('visibility', 'hidden'); dots.forEach(c => c.setAttribute('r', 4)); });
    root.append(hit);
  });
  root.append(tip);
  return root;
}
