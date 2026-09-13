// Mehr: Einstellungen, KI-Import, Datensicherung, Installation
import { h, svgIcon, toast, confirmSheet, download } from '../util.js';
import { getSettings, updateSettings, exportJSON, importJSON, resetAll, getSessions, getPlans } from '../store.js';
import { testApiKey } from '../ai-import.js';

export const APP_VERSION = '1.1.0';

const MODELS = [
  ['claude-opus-5', 'Claude Opus 5 – beste Erkennung (Standard)'],
  ['claude-sonnet-5', 'Claude Sonnet 5 – günstiger'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5 – am günstigsten'],
];

export function render(root) {
  const s = getSettings();

  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Hantel' }), h('h1', { text: 'Mehr' })])]));

  // ---------- Bibliothek & Vorlagen ----------
  root.append(h('div.card.tappable', { onclick: () => { location.hash = '#/library'; } }, [
    h('div.row.between', {}, [
      h('div', {}, [h('div', { text: '📖 Übungsbibliothek', style: { fontWeight: 700 } }), h('div.small.faint', { text: 'Bewegungsanimationen und Ausführungstipps zu allen Übungen' })]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));
  root.append(h('div.card.tappable', { onclick: () => { location.hash = '#/templates'; } }, [
    h('div.row.between', {}, [
      h('div', {}, [h('div', { text: '📋 Plan-Vorlagen', style: { fontWeight: 700 } }), h('div.small.faint', { text: 'Oberkörper / Unterkörper A+B, Zusatztag, Wochenplan' })]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));

  // ---------- Training ----------
  root.append(h('div.subhead', {}, [h('h2', { text: 'Training' })]));
  const rest = h('input.input.num', { type: 'number', inputmode: 'numeric', value: s.defaultRestSec, min: 10, max: 600, style: { width: '90px' } });
  rest.addEventListener('change', () => { const v = parseInt(rest.value, 10); if (v > 0) updateSettings({ defaultRestSec: v }); });

  const unitSeg = h('div.seg', { style: { width: '120px' } }, ['kg', 'lb'].map(u => h('button', { text: u, class: s.unit === u ? 'active' : '', onclick: (e) => {
    updateSettings({ unit: u }); for (const b of e.target.parentNode.children) b.classList.toggle('active', b.textContent === u);
  } })));

  root.append(h('div.card', {}, [
    switchRow('Standard-Pause', 'Sekunden zwischen Sätzen, falls die Übung keine eigene Pause hat', rest),
    switchRow('Pausentimer automatisch', 'Startet nach jedem abgehakten Satz', toggle('autoRestTimer')),
    switchRow('Ton', 'Signal, wenn die Pause vorbei ist', toggle('sound')),
    switchRow('Vibration', 'Wird auf iPhones von Safari leider nicht unterstützt', toggle('vibrate')),
    switchRow('Bildschirm an lassen', 'Während Workout und Timer (Wake Lock)', toggle('wakeLock')),
    switchRow('Einheit', 'Für Gewichte', unitSeg),
  ]));

  // ---------- KI ----------
  root.append(h('div.subhead', {}, [h('h2', { text: 'KI-Import (optional)' })]));
  const key = h('input.input', { type: 'password', value: s.apiKey || '', placeholder: 'sk-ant-…', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
  key.addEventListener('change', () => updateSettings({ apiKey: key.value.trim() }));
  const model = h('select.input', {}, MODELS.map(([v, l]) => h('option', { value: v, text: l, selected: s.aiModel === v })));
  model.addEventListener('change', () => updateSettings({ aiModel: model.value }));
  const testBtn = h('button.btn.ghost.block', { text: 'Verbindung testen', onclick: async () => {
    const k = key.value.trim();
    if (!k) { toast('Bitte erst einen API-Key eintragen'); return; }
    updateSettings({ apiKey: k });
    testBtn.disabled = true; testBtn.textContent = 'Teste …';
    try { await testApiKey(k, model.value); toast('Verbindung OK ✅'); }
    catch (e) { toast('Fehler: ' + e.message, { duration: 5000 }); }
    finally { testBtn.disabled = false; testBtn.textContent = 'Verbindung testen'; }
  } });

  root.append(h('div.card', {}, [
    h('p.small.muted', { html: 'Mit einem eigenen <b>Claude-API-Key</b> liest Claude dein PDF direkt – auch gescannte oder verschachtelte Pläne. Den Key bekommst du unter <a href="https://platform.claude.com/" target="_blank" rel="noopener">platform.claude.com</a>. Er wird nur lokal auf diesem Gerät gespeichert und nie exportiert.' }),
    h('div.field.mt', {}, [h('label', { text: 'API-Key' }), key]),
    h('div.field.mt', {}, [h('label', { text: 'Modell' }), model]),
    h('div.mt', {}, [testBtn]),
  ]));

  // ---------- Daten ----------
  root.append(h('div.subhead', {}, [h('h2', { text: 'Daten' })]));
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    try {
      const merge = await confirmSheet({ title: 'Sicherung einspielen', text: 'Vorhandene Daten behalten und zusammenführen? („Abbrechen“ = nichts tun)', okLabel: 'Zusammenführen' });
      if (!merge) return;
      const r = importJSON(await f.text(), { merge: true });
      toast(`${r.plans} Pläne, ${r.sessions} Workouts importiert`);
      location.hash = '#/plans';
    } catch (e) { toast('Import fehlgeschlagen: ' + e.message, { duration: 5000 }); }
    fileIn.value = '';
  });

  root.append(h('div.card', {}, [
    h('p.small.muted', { text: `${getPlans().length} Pläne · ${getSessions().length} Workouts gespeichert. Die Daten liegen nur in diesem Browser – sichere sie regelmäßig.` }),
    h('div.grid-2.mt', {}, [
      h('button.btn.ghost', { text: 'Sicherung exportieren', onclick: () => {
        const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        download(`hantel-backup-${stamp}.json`, exportJSON());
        toast('Sicherung erstellt');
      } }),
      h('button.btn.ghost', { text: 'Sicherung einspielen', onclick: () => fileIn.click() }),
    ]),
    fileIn,
    h('button.btn.danger.block.mt', { text: 'Alle Daten löschen', onclick: async () => {
      if (await confirmSheet({ title: 'Wirklich alles löschen?', text: 'Pläne, Workouts und Einstellungen werden unwiderruflich entfernt.', okLabel: 'Alles löschen', danger: true })) {
        resetAll(); toast('Alles gelöscht'); location.hash = '#/plans';
      }
    } }),
  ]));

  // ---------- Installation ----------
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  root.append(h('div.subhead', {}, [h('h2', { text: 'App installieren' })]));
  root.append(h('div.card', {}, [
    standalone
      ? h('p.small.muted', { text: '✅ Hantel läuft als installierte App.' })
      : h('p.small.muted', { html: 'Auf dem iPhone in Safari: <b>Teilen</b> (Quadrat mit Pfeil) → <b>Zum Home-Bildschirm</b>. Danach startet Hantel wie eine normale App – auch offline.' }),
    h('p.small.faint.mt', { text: `Hantel ${APP_VERSION}` }),
  ]));
}

function switchRow(label, desc, control) {
  return h('div.switch', {}, [
    h('div.grow', {}, [h('div.lbl', { text: label }), desc ? h('div.desc', { text: desc }) : null]),
    control,
  ]);
}

function toggle(key) {
  const s = getSettings();
  const input = h('input', { type: 'checkbox', checked: !!s[key] });
  input.addEventListener('change', () => updateSettings({ [key]: input.checked }));
  return h('label.toggle', {}, [input, h('span')]);
}
