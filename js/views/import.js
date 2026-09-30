// Plan-Import: PDF oder Text (z.B. aus Apple Notizen) → erkennen (Muster oder KI) → prüfen → speichern
import { h, svgIcon, toast, parseNum, openSheet } from '../util.js';
import { addPlan, newPlan, newExercise, getSettings } from '../store.js';
import { extractLines, parsePlanText } from '../pdf-import.js';
import { aiExtractPlans, aiExtractPlansFromText } from '../ai-import.js';
import { aiReady, aiConfig } from '../llm.js';
import { matchExercise, getExercise } from '../exercise-db.js';
import { EQUIPMENT } from '../equipment.js';
import { figureThumb } from './exercise-info.js';
import { openExercisePicker } from './exercise-picker.js';

let mode = 'pattern';
let source = 'pdf'; // 'pdf' | 'text'

export function render(root, { navigate, query }) {
  const settings = getSettings();
  if (mode === 'ai' && !aiReady()) mode = 'pattern';
  if (query?.get('text')) source = 'text';

  root.append(h('button.back', { html: svgIcon.back + '<span>Pläne</span>', onclick: () => navigate('/plans') }));
  const headline = h('h1', { text: 'Trainingsplan importieren' });
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Import' }), headline])]));

  const body = h('div');
  const srcSeg = h('div.seg', {}, [
    h('button', { text: 'PDF', class: source === 'pdf' ? 'active' : '', onclick: () => { source = 'pdf'; drawPicker(); } }),
    h('button', { text: 'Text / Notizen', class: source === 'text' ? 'active' : '', onclick: () => { source = 'text'; drawPicker(); } }),
  ]);
  root.append(srcSeg, body);

  // ---------- Text aus Notizen ----------
  const drawText = () => {
    body.innerHTML = '';
    for (const b of srcSeg.children) b.classList.toggle('active', (b.textContent === 'PDF') === (source === 'pdf'));
    const area = h('textarea.input.mt', { rows: 10, placeholder: 'Notiz einfügen, z.B.:\n\nTag A – Push\nBankdrücken 4 x 8 60 kg\nSchrägbank KH 3 x 10\nSeitheben 3 x 15\n\nTag B – Pull\nKlimmzüge 4 x 6\nRudern 3 x 10 50 kg', style: { minHeight: '220px', fontSize: '15px' } });
    const run = (useAi) => {
      const text = area.value.trim();
      if (text.length < 10) { toast('Bitte den Text der Notiz einfügen'); return; }
      handleText(text, useAi);
    };
    body.append(
      area,
      h('p.small.faint.mt', { text: 'In Apple Notizen: Notiz öffnen → gedrückt halten → Alles auswählen → Kopieren → hier einfügen. „Offline erkennen“ braucht keine KI und liest Zeilen wie „Bankdrücken 4 x 8 60 kg“; bei unübersichtlichen Notizen hilft die KI.' }),
      h('div.stack.mt', {}, [
        h('button.btn.primary.block', { text: 'Offline erkennen', onclick: () => run(false) }),
        h('button.btn.ai-btn.block', { html: svgIcon.sparkle + '<span>Mit KI erkennen</span>', disabled: !aiReady(), onclick: () => run(true) }),
      ]),
    );
  };

  const handleText = async (text, useAi) => {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const fallbackName = lines[0]?.slice(0, 60) || 'Importierter Plan';
    if (!useAi) {
      const result = parsePlanText(lines, fallbackName);
      if (!result.plans.length && aiReady()) toast('Offline nichts erkannt – probier „Mit KI erkennen“', { duration: 6000 });
      drawReview(result, lines, fallbackName);
      return;
    }
    body.innerHTML = '';
    const status = h('div.muted', { text: 'KI liest die Notiz … (5–30 s)' });
    const bar = h('div.progress-line', {}, [h('i')]);
    body.append(h('div.card', {}, [h('div.row', {}, [h('div.spinner'), status]), bar]));
    bar.firstChild.style.width = '45%';
    try {
      const ai = await aiExtractPlansFromText(text);
      bar.firstChild.style.width = '100%';
      drawReview({ plans: ai.plans, unmatched: [] }, lines, fallbackName);
    } catch (e) {
      body.innerHTML = '';
      body.append(h('div.card', { style: { borderColor: 'var(--danger)' } }, [
        h('h3', { text: 'Import fehlgeschlagen' }),
        h('p.muted.mt', { text: e.message || String(e) }),
        h('button.btn.block.mt', { text: 'Nochmal versuchen', onclick: drawPicker }),
      ]));
    }
  };

  // ---------- Schritt 1: Datei & Modus ----------
  const drawPicker = () => {
    headline.textContent = source === 'pdf' ? 'Trainingsplan aus PDF' : 'Trainingsplan aus Text';
    if (source === 'text') { drawText(); return; }
    body.innerHTML = '';
    for (const b of srcSeg.children) b.classList.toggle('active', (b.textContent === 'PDF') === (source === 'pdf'));
    const seg = h('div.seg', {}, [
      h('button', { text: 'Mustererkennung', class: mode === 'pattern' ? 'active' : '', onclick: () => { mode = 'pattern'; drawPicker(); } }),
      h('button', { text: 'KI (Claude)', class: mode === 'ai' ? 'active' : '', onclick: () => {
        if (!aiReady()) { toast('Erst API-Key unter „Mehr“ hinterlegen', { action: { label: 'Zu Mehr', fn: () => navigate('/settings') } }); return; }
        mode = 'ai'; drawPicker();
      } }),
    ]);
    const hint = h('p.small.muted.mt', {
      text: mode === 'pattern'
        ? 'Läuft komplett offline. Erkennt Zeilen wie „Bankdrücken 3 × 10 60 kg“ oder Tabellen mit Sätze/Wdh-Spalten. Danach kannst du alles prüfen und korrigieren.'
        : `Das PDF wird an ${aiConfig().label} gesendet (${aiConfig().model}). Funktioniert auch bei gescannten oder ungewöhnlich formatierten Plänen. Kostet wenige Cent pro Import.`,
    });

    const input = h('input', { type: 'file', accept: 'application/pdf,.pdf' });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
    const drop = h('label.drop.mt', {}, [
      h('div.illu', { html: svgIcon.doc, style: { width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' } }),
      h('div', { text: 'PDF auswählen', style: { fontWeight: 700, color: 'var(--text)' } }),
      h('div.small', { text: 'Tippen, um eine Datei zu wählen' }),
      input,
    ]);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

    body.append(seg, hint, drop);
    body.append(h('p.small.faint.mt', { text: 'Tipp: Pläne mit mehreren Trainingstagen (Tag A / Tag B, Push / Pull …) werden automatisch in mehrere Pläne aufgeteilt.' }));
  };

  // ---------- Schritt 2: Verarbeiten ----------
  const handleFile = async (file) => {
    if (!/pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Bitte eine PDF-Datei wählen'); return; }
    body.innerHTML = '';
    const status = h('div.muted', { text: 'PDF wird gelesen …' });
    const bar = h('div.progress-line', {}, [h('i')]);
    body.append(h('div.card', {}, [h('div.row', {}, [h('div.spinner'), status]), bar]));

    const fallbackName = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Importierter Plan';
    let result, rawLines = [];
    try {
      if (mode === 'ai') {
        status.textContent = 'Claude liest das PDF … (10–40 s)';
        bar.firstChild.style.width = '35%';
        const ai = await aiExtractPlans(file);
        result = { plans: ai.plans, unmatched: [] };
        bar.firstChild.style.width = '100%';
      } else {
        rawLines = await extractLines(file, (p, n) => { status.textContent = `Seite ${p} von ${n} …`; bar.firstChild.style.width = `${Math.round((p / n) * 90)}%`; });
        result = parsePlanText(rawLines, fallbackName);
        bar.firstChild.style.width = '100%';
      }
    } catch (e) {
      console.error(e);
      body.innerHTML = '';
      body.append(h('div.card', { style: { borderColor: 'var(--danger)' } }, [
        h('h3', { text: 'Import fehlgeschlagen' }),
        h('p.muted.mt', { text: e.message || String(e) }),
        h('button.btn.block.mt', { text: 'Nochmal versuchen', onclick: drawPicker }),
      ]));
      return;
    }
    drawReview(result, rawLines, fallbackName);
  };

  // ---------- Schritt 3: Prüfen ----------
  const drawReview = (result, rawLines, fallbackName) => {
    body.innerHTML = '';
    const plans = result.plans.map(p => ({
      include: true,
      name: p.name,
      exercises: p.exercises.map(e => ({ ...e })),
    }));

    if (!plans.length) {
      body.append(h('div.card', {}, [
        h('h3', { text: 'Keine Übungen erkannt' }),
        h('p.muted.mt', { text: mode === 'pattern'
          ? 'Die Mustererkennung hat in diesem PDF keine Übungen gefunden. Das passiert bei gescannten PDFs (nur Bilder) oder sehr ungewöhnlichen Layouts.'
          : 'Claude konnte in diesem Dokument keinen Trainingsplan finden.' }),
        h('div.stack.mt', {}, [
          mode === 'pattern' && aiReady() ? h('button.btn.primary.block', { text: 'Mit KI erneut versuchen', onclick: () => { mode = 'ai'; drawPicker(); } }) : null,
          mode === 'pattern' && !aiReady() ? h('button.btn.ghost.block', { text: 'KI-Import einrichten', onclick: () => navigate('/settings') }) : null,
          h('button.btn.ghost.block', { text: source === 'text' ? 'Anderen Text einfügen' : 'Andere Datei wählen', onclick: drawPicker }),
        ]),
        rawDetails(rawLines),
      ]));
      return;
    }

    const total = plans.reduce((a, p) => a + p.exercises.length, 0);
    body.append(h('p.muted', { html: `<b>${total} Übung${total === 1 ? '' : 'en'}</b> in <b>${plans.length === 1 ? '1 Plan' : plans.length + ' Plänen'}</b> erkannt. Prüfe die Werte und korrigiere, was nicht passt.` }));

    // Namen mit der Übungsdatenbank abgleichen: eindeutige Treffer übernehmen, Rest zur Auswahl markieren
    for (const p of plans) for (const e of p.exercises) applyMatch(e);
    const summary = h('div.card.match-summary');
    const updateSummary = () => {
      const all = plans.flatMap(p => p.exercises);
      const ok = all.filter(e => e.matchId).length;
      const open = all.length - ok;
      summary.innerHTML = '';
      summary.append(h('div.row.between', {}, [
        h('div.grow', {}, [
          h('b', { text: `${ok} von ${all.length} Übungen zugeordnet` }),
          h('div.small.faint', { text: open ? `${open} noch offen – antippen und aus der Datenbank wählen; ohne Zuordnung bleibt der Name so stehen.` : 'Alle Übungen kennen Gerät und Muskeln – Wochenbilanz und Progression rechnen damit richtig.' }),
        ]),
        open ? h('button.btn.sm.ghost', { text: 'Offene zeigen', onclick: () => { const el = body.querySelector('.ex-match.open'); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }) : null,
      ]));
    };
    body.append(summary);
    updateSummary();

    const planCards = h('div.stack.mt');
    body.append(planCards);

    const drawPlans = () => {
      planCards.innerHTML = '';
      plans.forEach((p, pi) => {
        const nameIn = h('input.input', { type: 'text', value: p.name, placeholder: 'Planname' });
        nameIn.addEventListener('input', () => { p.name = nameIn.value; });
        const inc = h('input', { type: 'checkbox', checked: p.include });
        inc.addEventListener('change', () => { p.include = inc.checked; card.style.opacity = inc.checked ? 1 : 0.5; });

        const exList = h('div');
        const drawEx = () => {
          exList.innerHTML = '';
          p.exercises.forEach((e, ei) => {
            const n = h('input.input', { type: 'text', value: e.name, placeholder: 'Übung' });
            const s = h('input.input.num', { type: 'number', inputmode: 'numeric', value: e.sets, min: 1, 'aria-label': 'Sätze' });
            const r = h('input.input.num', { type: 'text', inputmode: 'numeric', value: e.reps, 'aria-label': 'Wiederholungen' });
            const w = h('input.input.num', { type: 'text', inputmode: 'decimal', value: e.weight ?? '', placeholder: '–', 'aria-label': 'Gewicht' });
            const rs = h('input.input.num', { type: 'number', inputmode: 'numeric', value: e.restSec ?? '', placeholder: String(settings.defaultRestSec), 'aria-label': 'Pause' });
            n.addEventListener('input', () => { e.name = n.value; });
            s.addEventListener('input', () => { e.sets = parseInt(s.value, 10) || 1; });
            r.addEventListener('input', () => { e.reps = r.value; });
            w.addEventListener('input', () => { e.weight = parseNum(w.value); });
            rs.addEventListener('input', () => { e.restSec = parseInt(rs.value, 10) || null; });
            const del = h('button.del', { html: svgIcon.trash, 'aria-label': 'Entfernen', onclick: () => { p.exercises.splice(ei, 1); drawEx(); } });
            n.addEventListener('change', () => { applyMatch(e); drawEx(); updateSummary(); });
            exList.append(h('div.imp-ex', {}, [
              n, del,
              matchRow(e, () => { drawEx(); updateSummary(); }),
              h('div.imp-hdr', { style: { gridColumn: '1 / -1' } }, [h('span', { text: 'Sätze' }), h('span', { text: 'Wdh' }), h('span', { text: settings.unit }), h('span', { text: 'Pause s' })]),
              h('div.nums', {}, [s, r, w, rs]),
              e.note ? h('div.note', { text: e.note }) : null,
            ]));
          });
          exList.append(h('button.btn.sm.ghost.mt', { html: svgIcon.plus + '<span>Übung</span>', onclick: () => { p.exercises.push({ name: '', sets: 3, reps: '10', weight: null, restSec: null, note: '' }); drawEx(); } }));
        };
        drawEx();

        const card = h('div.card', {}, [
          h('div.row', {}, [
            h('label.toggle', {}, [inc, h('span')]),
            nameIn,
            plans.length > 1 ? h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Plan entfernen', onclick: () => { plans.splice(pi, 1); drawPlans(); } }) : null,
          ]),
          h('div.mt', {}, [exList]),
        ]);
        planCards.append(card);
      });
    };
    drawPlans();

    body.append(h('div.stack.mt-lg', {}, [
      h('button.btn.primary.block', { text: 'Importieren', style: { minHeight: '56px', fontSize: '17px' }, onclick: () => {
        let count = 0;
        for (const p of plans) {
          if (!p.include) continue;
          const exercises = p.exercises.filter(e => e.name.trim()).map(e => newExercise({
            name: e.name.trim(), sets: Math.max(1, e.sets || 1), reps: String(e.reps || '10').trim(),
            weight: e.weight ?? null, restSec: e.restSec || null, note: e.note || '', weightStep: e.weightStep ?? null,
          }));
          if (!exercises.length) continue;
          addPlan(newPlan({ name: p.name.trim() || fallbackName, exercises }));
          count++;
        }
        toast(count ? `${count} Plan${count === 1 ? '' : 'e'} importiert` : 'Nichts importiert');
        navigate('/plans');
      } }),
      h('button.btn.ghost.block', { text: source === 'text' ? 'Anderen Text einfügen' : 'Andere Datei wählen', onclick: drawPicker }),
    ]));

    if (result.unmatched?.length) {
      const det = h('details.raw', {}, [
        h('summary', { text: `${result.unmatched.length} nicht zugeordnete Zeilen` }),
        h('pre', { text: result.unmatched.join('\n') }),
      ]);
      body.append(det);
    }
    body.append(rawDetails(rawLines));
  };

  // ---------- Zuordnung zur Übungsdatenbank ----------

  /** Eindeutige Treffer sofort übernehmen, sonst Vorschläge merken */
  const applyMatch = (e) => {
    const raw = (e.name || '').trim();
    const m = matchExercise(raw);
    e.suggestions = m.suggestions;
    if (m.confidence === 'exact') {
      e.matchId = m.entry.id;
      if (m.entry.name !== raw) e.origName = raw;
      e.name = m.entry.name;
    } else {
      e.matchId = null;
      e.suggestion = m.entry || null; // unsicherer Treffer → nur vorschlagen
    }
  };

  /** Zeile unter dem Namen: Treffer, Vorschlag oder „zuordnen“ */
  const matchRow = (e, onChange) => {
    const entry = e.matchId ? getExercise(e.matchId) : null;
    const choose = () => openMatchSheet(e, onChange);
    if (entry) {
      return h('div.ex-match.ok', { style: { gridColumn: '1 / -1' }, onclick: choose }, [
        h('span.dot', { html: svgIcon.check }),
        h('span.grow.truncate', { text: `${entry.name} · ${entry.muscles}` + (e.origName ? ` (aus „${e.origName}“)` : '') }),
        h('span.small.faint', { text: 'ändern' }),
      ]);
    }
    const sug = e.suggestion || e.suggestions?.[0] || null;
    return h('div.ex-match.open', { style: { gridColumn: '1 / -1' }, onclick: choose }, [
      h('span.dot.warn', { html: svgIcon.warning }),
      h('span.grow.truncate', { text: sug ? `Nicht sicher – Vorschlag: ${sug.name}` : 'Nicht in der Datenbank' }),
      h('span.small', { text: (e.suggestions?.length || 0) > 1 ? `${e.suggestions.length} Vorschläge` : 'zuordnen' }),
    ]);
  };

  /** Auswahl: Vorschläge (z.B. alle Bank-Varianten zu „Hantelbank“), volle Suche oder Name behalten */
  const openMatchSheet = (e, onChange) => {
    const raw = (e.origName || e.name || '').trim();
    const list = [];
    if (e.suggestion) list.push(e.suggestion);
    for (const s of e.suggestions || []) if (!list.includes(s)) list.push(s);
    if (e.matchId) { const cur = getExercise(e.matchId); if (cur && !list.includes(cur)) list.unshift(cur); }
    openSheet((sheet, close) => {
      const take = (entry) => {
        e.matchId = entry.id;
        e.origName = raw !== entry.name ? raw : null;
        e.name = entry.name;
        if (entry.weightStep) e.weightStep = entry.weightStep;
        close(); onChange();
      };
      sheet.append(
        h('div.row.between', {}, [h('h3', { text: `„${raw}“ zuordnen`, style: { margin: 0 } }), h('button.btn.sm.ghost', { text: 'Schließen', onclick: close })]),
        h('p.small.faint', { text: list.length ? 'Welche Übung ist gemeint? Danach kennt die App Gerät, Muskeln und Gewichtsschritt.' : 'Keine passende Übung gefunden – such in der Datenbank oder behalte den Namen.' }),
      );
      const box = h('div.pick-list');
      for (const entry of list) {
        box.append(h('div.pick-row', { onclick: () => take(entry) }, [
          figureThumb(entry.name) || h('div.fig-thumb'),
          h('div.grow.min0', {}, [
            h('div.clamp2', { text: entry.name, style: { fontWeight: 600 } }),
            h('div.small.faint.clamp2', { text: [entry.muscles, EQUIPMENT[entry.equip?.type]?.name].filter(Boolean).join(' · ') }),
          ]),
          h('div', { html: svgIcon.chevron }),
        ]));
      }
      sheet.append(box);
      sheet.append(h('div.stack.mt', {}, [
        h('button.btn.block', { html: svgIcon.search || svgIcon.plus, onclick: () => { close(); openExercisePicker({ title: `„${raw}“ zuordnen`, query: raw, onPick: (picked) => { if (picked.id) take2(e, picked, onChange); else { e.name = picked.name; e.matchId = null; e.origName = null; onChange(); } } }); } }, [h('span', { text: 'In der Datenbank suchen' })]),
        h('button.btn.ghost.block', { text: `Name „${raw}“ behalten`, onclick: () => { e.name = raw; e.matchId = null; e.origName = null; close(); onChange(); } }),
      ]));
    });
  };
  const take2 = (e, entry, onChange) => {
    e.matchId = entry.id;
    const raw = (e.origName || e.name || '').trim();
    e.origName = raw !== entry.name ? raw : null;
    e.name = entry.name;
    if (entry.weightStep) e.weightStep = entry.weightStep;
    onChange();
  };

  const rawDetails = (rawLines) => rawLines?.length
    ? h('details.raw', {}, [h('summary', { text: 'Erkannter PDF-Text anzeigen' }), h('pre', { text: rawLines.join('\n') })])
    : null;

  drawPicker();
}
