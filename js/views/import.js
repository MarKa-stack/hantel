// PDF-Import: Datei wählen → erkennen (Muster oder KI) → prüfen → speichern
import { h, svgIcon, toast, parseNum } from '../util.js';
import { addPlan, newPlan, newExercise, getSettings } from '../store.js';
import { extractLines, parsePlanText } from '../pdf-import.js';
import { aiExtractPlans } from '../ai-import.js';

let mode = 'pattern';

export function render(root, { navigate }) {
  const settings = getSettings();
  if (mode === 'ai' && !settings.apiKey) mode = 'pattern';

  root.append(h('button.back', { html: svgIcon.back + '<span>Pläne</span>', onclick: () => navigate('/plans') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Import' }), h('h1', { text: 'Trainingsplan aus PDF' })])]));

  const body = h('div');
  root.append(body);

  // ---------- Schritt 1: Datei & Modus ----------
  const drawPicker = () => {
    body.innerHTML = '';
    const seg = h('div.seg', {}, [
      h('button', { text: 'Mustererkennung', class: mode === 'pattern' ? 'active' : '', onclick: () => { mode = 'pattern'; drawPicker(); } }),
      h('button', { text: 'KI (Claude)', class: mode === 'ai' ? 'active' : '', onclick: () => {
        if (!settings.apiKey) { toast('Erst API-Key unter „Mehr“ hinterlegen', { action: { label: 'Zu Mehr', fn: () => navigate('/settings') } }); return; }
        mode = 'ai'; drawPicker();
      } }),
    ]);
    const hint = h('p.small.muted.mt', {
      text: mode === 'pattern'
        ? 'Läuft komplett offline. Erkennt Zeilen wie „Bankdrücken 3 × 10 60 kg“ oder Tabellen mit Sätze/Wdh-Spalten. Danach kannst du alles prüfen und korrigieren.'
        : `Das PDF wird an die Claude-API gesendet (${settings.aiModel}). Funktioniert auch bei gescannten oder ungewöhnlich formatierten Plänen. Kostet wenige Cent pro Import.`,
    });

    const input = h('input', { type: 'file', accept: 'application/pdf,.pdf' });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
    const drop = h('label.drop.mt', {}, [
      h('div.icon', { text: '📄' }),
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
        const ai = await aiExtractPlans(file, { apiKey: settings.apiKey, model: settings.aiModel });
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
          mode === 'pattern' && settings.apiKey ? h('button.btn.primary.block', { text: 'Mit KI erneut versuchen', onclick: () => { mode = 'ai'; drawPicker(); } }) : null,
          mode === 'pattern' && !settings.apiKey ? h('button.btn.ghost.block', { text: 'KI-Import einrichten', onclick: () => navigate('/settings') }) : null,
          h('button.btn.ghost.block', { text: 'Andere Datei wählen', onclick: drawPicker }),
        ]),
        rawDetails(rawLines),
      ]));
      return;
    }

    const total = plans.reduce((a, p) => a + p.exercises.length, 0);
    body.append(h('p.muted', { html: `<b>${total} Übung${total === 1 ? '' : 'en'}</b> in <b>${plans.length === 1 ? '1 Plan' : plans.length + ' Plänen'}</b> erkannt. Prüfe die Werte und korrigiere, was nicht passt.` }));

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
            exList.append(h('div.imp-ex', {}, [
              n, del,
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
            weight: e.weight ?? null, restSec: e.restSec || null, note: e.note || '',
          }));
          if (!exercises.length) continue;
          addPlan(newPlan({ name: p.name.trim() || fallbackName, exercises }));
          count++;
        }
        toast(count ? `${count} Plan${count === 1 ? '' : 'e'} importiert 🎉` : 'Nichts importiert');
        navigate('/plans');
      } }),
      h('button.btn.ghost.block', { text: 'Andere Datei wählen', onclick: drawPicker }),
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

  const rawDetails = (rawLines) => rawLines?.length
    ? h('details.raw', {}, [h('summary', { text: 'Erkannter PDF-Text anzeigen' }), h('pre', { text: rawLines.join('\n') })])
    : null;

  drawPicker();
}
