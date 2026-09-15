// Mehr: Einstellungen, KI-Import, Datensicherung, Installation
import { h, svgIcon, toast, confirmSheet, fmtDate, isIOS, weekKey } from '../util.js';
import { getSettings, updateSettings, importJSON, resetAll, getSessions, getPlans, deloadActive } from '../store.js';
import { PROVIDERS, testConnection, listModels } from '../llm.js';
import { PHOTOS, EQUIPMENT } from '../equipment.js';
import { exportBackup } from '../backup.js';
import { cloudPush, cloudPull } from '../cloud.js';
import { exportCSV, exportICS, WEEKDAYS_DE } from '../exporters.js';

export const APP_VERSION = '1.19.0';

export function render(root, { navigate }) {
  const s = getSettings();

  root.append(h('div.page-head', {}, [h('div', {}, [h('h1', { text: 'Mehr' })])]));

  // ---------- Bibliothek & Vorlagen ----------
  root.append(h('div.card.tappable', { onclick: () => { location.hash = '#/library'; } }, [
    h('div.row.between', {}, [
      h('div', {}, [h('div.title-ico', { html: svgIcon.book + '<b>Übungsbibliothek</b>' }), h('div.small.faint', { text: 'Bewegungsanimationen und Ausführungstipps zu allen Übungen' })]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));
  root.append(h('div.card.tappable', { onclick: () => { location.hash = '#/templates'; } }, [
    h('div.row.between', {}, [
      h('div', {}, [h('div.title-ico', { html: svgIcon.clipboard + '<b>Plan-Vorlagen</b>' }), h('div.small.faint', { text: 'Oberkörper / Unterkörper A+B, Zusatztag, Wochenplan' })]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));
  root.append(h('div.card.tappable', { onclick: () => { location.hash = '#/body'; } }, [
    h('div.row.between', {}, [
      h('div', {}, [h('div.title-ico', { html: svgIcon.scale + '<b>Gewicht & Maße</b>' }), h('div.small.faint', { text: 'Körpergewicht und Umfänge mit Verlauf' })]),
      h('div', { html: svgIcon.chevron }),
    ]),
  ]));

  // ---------- Training ----------
  const rest = h('input.input.num', { type: 'number', inputmode: 'numeric', value: s.defaultRestSec, min: 10, max: 600, style: { width: '90px' } });
  rest.addEventListener('change', () => { const v = parseInt(rest.value, 10); if (v > 0) updateSettings({ defaultRestSec: v }); });

  const unitSeg = h('div.seg', { style: { width: '120px' } }, ['kg', 'lb'].map(u => h('button', { text: u, class: s.unit === u ? 'active' : '', onclick: (e) => {
    updateSettings({ unit: u }); for (const b of e.target.parentNode.children) b.classList.toggle('active', b.textContent === u);
  } })));

  const barSeg = h('div.seg', { style: { width: '150px' } }, [20, 15, 10].map(b => h('button', { text: `${b}`, class: s.barWeight === b ? 'active' : '', onclick: (e) => {
    updateSettings({ barWeight: b }); for (const x of e.target.parentNode.children) x.classList.toggle('active', x.textContent === String(b));
  } })));

  const themeSeg = h('div.seg', { style: { width: '200px' } }, [['dark', 'Dunkel'], ['light', 'Hell'], ['system', 'Auto']].map(([v, l]) => h('button', { text: l, class: (s.theme || 'dark') === v ? 'active' : '', onclick: (e) => {
    updateSettings({ theme: v }); for (const x of e.target.parentNode.children) x.classList.toggle('active', x.textContent === l);
  } })));
  const goalIn = h('input.input.num', { type: 'number', inputmode: 'numeric', value: s.weeklyGoal || 4, min: 1, max: 14, style: { width: '80px' } });
  goalIn.addEventListener('change', () => { const v = parseInt(goalIn.value, 10); if (v > 0) updateSettings({ weeklyGoal: v }); });
  const nameIn = h('input.input', { type: 'text', value: s.name || '', placeholder: 'Vorname', autocomplete: 'given-name', style: { width: '150px', minHeight: '42px' } });
  nameIn.addEventListener('change', () => updateSettings({ name: nameIn.value.trim() }));

  root.append(h('div.subhead', {}, [h('h2', { text: 'Darstellung' })]));
  root.append(h('div.card', {}, [
    switchRow('Erscheinungsbild', 'Dunkel ist Standard – Hell oder automatisch nach System', themeSeg),
    switchRow('Dein Name', 'Für die Begrüßung auf dem Startbildschirm', nameIn),
    switchRow('Wochenziel', 'Trainings pro Woche für den Ring auf dem Startbildschirm', goalIn),
  ]));

  // Deload-Woche: bis Sonntag 23:59 der laufenden Woche
  const deloadBtn = h('button.btn.sm' + (deloadActive() ? '.danger' : '.ghost'), { text: deloadActive() ? 'Beenden' : 'Starten', onclick: () => {
    if (deloadActive()) { updateSettings({ deloadUntil: 0 }); toast('Deload-Woche beendet'); }
    else { const end = weekKey(Date.now()) + 7 * 86400000 - 1; updateSettings({ deloadUntil: end }); toast('Deload-Woche bis Sonntag: −15 % Gewicht, ein Satz weniger'); }
    navigate('/settings', true);
  } });
  const volMin = h('input.input.num', { type: 'number', inputmode: 'numeric', value: s.volumeMin ?? 10, min: 1, max: 40, style: { width: '64px' } });
  const volMax = h('input.input.num', { type: 'number', inputmode: 'numeric', value: s.volumeMax ?? 20, min: 1, max: 60, style: { width: '64px' } });
  const commitVol = () => { const a = parseInt(volMin.value, 10), b = parseInt(volMax.value, 10); if (a > 0 && b >= a) updateSettings({ volumeMin: a, volumeMax: b }); };
  volMin.addEventListener('change', commitVol); volMax.addEventListener('change', commitVol);
  const sexSeg = h('div.seg', { style: { width: '130px' } }, [['m', 'Mann'], ['f', 'Frau']].map(([v, l]) => h('button', { text: l, class: (s.sex || 'm') === v ? 'active' : '', onclick: (e) => {
    updateSettings({ sex: v }); for (const x of e.target.parentNode.children) x.classList.toggle('active', x.textContent === l);
  } })));

  root.append(h('div.subhead', {}, [h('h2', { text: 'Training' })]));
  root.append(h('div.card', {}, [
    switchRow('Deload-Woche', deloadActive() ? `Aktiv bis ${fmtDate(s.deloadUntil)} – Gewichte −15 %, ein Satz weniger` : 'Eine Woche leichter trainieren: −15 % Gewicht, ein Satz weniger, Progression pausiert', deloadBtn),
    switchRow('Volumen-Ziel', 'Sätze je Muskelgruppe und Woche (Körperkarte und Balken färben sich danach)', h('div.row', { style: { gap: '6px' } }, [volMin, h('span.faint', { text: '–' }), volMax])),
    switchRow('Kraftstandards', 'Vergleichswerte auf der Übungsseite (relativ zum Körpergewicht)', sexSeg),
    switchRow('Sprachansagen', 'Sagt „Pause vorbei“ und den nächsten Satz an – fürs Handy in der Hosentasche', toggle('speech')),
    switchRow('Standard-Pause', 'Sekunden zwischen Sätzen, falls die Übung keine eigene Pause hat', rest),
    switchRow('Pausentimer automatisch', 'Startet nach jedem abgehakten Satz', toggle('autoRestTimer')),
    switchRow('Timer bei gesperrtem Bildschirm', 'Hält per lautlosem Audio die Verbindung – der Beep klingelt auch, wenn das Display aus ist', toggle('keepAliveAudio')),
    switchRow('Aufwärmsätze vorschlagen', '40 % × 10, 60 % × 6, 80 % × 3 vom Arbeitsgewicht (eingeklappt über Satz 1)', toggle('warmupSets')),
    switchRow('Stangengewicht', 'Standard für den Scheibenrechner (kg), pro Übung änderbar', barSeg),
    switchRow('Ton', 'Signal, wenn die Pause vorbei ist', toggle('sound')),
    isIOS ? null : switchRow('Vibration', 'Vibrationsmuster am Ende der Pause (Android)', toggle('vibrate')),
    switchRow('Bildschirm an lassen', 'Während Workout und Timer (Wake Lock)', toggle('wakeLock')),
    switchRow('Einheit', 'Für Gewichte', unitSeg),
  ]));

  // ---------- KI (Claude oder OpenAI) ----------
  root.append(h('div.subhead', {}, [h('h2', { text: 'KI (optional)' })]));
  const aiBox = h('div');
  const drawAi = () => {
    const st = getSettings();
    const provider = ['proxy', 'openai', 'claude'].includes(st.aiProvider) ? st.aiProvider : 'claude';
    const p = PROVIDERS[provider];
    aiBox.innerHTML = '';
    const provSeg = h('div.seg', {}, Object.entries(PROVIDERS).map(([k, v]) => h('button', { text: v.label, class: provider === k ? 'active' : '', onclick: () => { updateSettings({ aiProvider: k }); drawAi(); } })));

    // ----- Hantel-Server (Cloudflare Worker): Key liegt nur dort -----
    if (provider === 'proxy') {
      const urlIn = h('input.input', { type: 'url', value: st.proxyUrl || '', placeholder: 'https://hantel-ai.<name>.workers.dev', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
      urlIn.addEventListener('change', () => updateSettings({ proxyUrl: urlIn.value.trim().replace(/\/+$/, '') }));
      const tokIn = h('input.input', { type: 'password', value: st.proxyToken || '', placeholder: 'Zugangstoken (APP_TOKEN)', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
      tokIn.addEventListener('change', () => updateSettings({ proxyToken: tokIn.value.trim() }));
      const usage = h('p.small.faint.mt');
      const drawUsage = () => { const u = getSettings().proxyUsage; usage.textContent = u ? `KI-Anfragen heute ${u.today}${u.dailyLimit ? ` / ${u.dailyLimit}` : ''} · diesen Monat ${u.month}` : 'Noch keine Verbindung.'; };
      drawUsage();
      const testBtn = h('button.btn.ghost.block', { text: 'Verbindung testen', onclick: async () => {
        updateSettings({ proxyUrl: urlIn.value.trim().replace(/\/+$/, ''), proxyToken: tokIn.value.trim() });
        testBtn.disabled = true; testBtn.textContent = 'Teste …';
        try { await testConnection(); toast('Server erreichbar'); drawUsage(); }
        catch (e) { toast('Fehler: ' + e.message, { duration: 6000 }); }
        finally { testBtn.disabled = false; testBtn.textContent = 'Verbindung testen'; }
      } });
      aiBox.append(h('div.card', {}, [
        h('p.small.muted', { text: p.hint + ' Für Foto-Analyse, Rezepte, Websuche, Freitext und PDF-Import.' }),
        h('div.mt', {}, [provSeg]),
        h('div.field.mt', {}, [h('label', { text: 'Server-URL' }), urlIn]),
        h('div.field.mt', {}, [h('label', { text: 'Zugangstoken' }), tokIn]),
        h('div.mt', {}, [testBtn]),
        usage,
        h('p.small.faint', { html: 'Einrichtung: <a href="https://github.com/MarKa-stack/hantel/tree/main/worker" target="_blank" rel="noopener">worker/README.md</a> – Worker im Cloudflare-Dashboard anlegen, <code class="kbd">OPENAI_API_KEY</code> und <code class="kbd">APP_TOKEN</code> als Secrets setzen.' }),
      ]));
      return;
    }

    const keyField = provider === 'openai' ? 'openaiKey' : 'apiKey';
    const modelField = provider === 'openai' ? 'openaiModel' : 'aiModel';
    const key = h('input.input', { type: 'password', value: st[keyField] || '', placeholder: p.keyPlaceholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
    key.addEventListener('change', () => updateSettings({ [keyField]: key.value.trim() }));
    const cur = st[modelField] || p.defaultModel;
    const known = p.models.some(([v]) => v === cur);
    const model = h('select.input', {}, [
      ...p.models.map(([v, l]) => h('option', { value: v, text: l, selected: cur === v })),
      h('option', { value: '__custom', text: 'Anderes Modell …', selected: !known }),
    ]);
    const customIn = h('input.input', { type: 'text', value: known ? '' : cur, placeholder: 'Modell-ID, z.B. gpt-5-nano', hidden: known, autocapitalize: 'off', spellcheck: false, style: { marginTop: '8px' } });
    model.addEventListener('change', () => { if (model.value === '__custom') { customIn.hidden = false; customIn.focus(); } else { customIn.hidden = true; updateSettings({ [modelField]: model.value }); } });
    customIn.addEventListener('change', () => { const v = customIn.value.trim(); if (v) updateSettings({ [modelField]: v }); });
    const testBtn = h('button.btn.ghost', { text: 'Verbindung testen', onclick: async () => {
      const k = key.value.trim();
      if (!k) { toast('Bitte erst einen API-Key eintragen'); return; }
      updateSettings({ [keyField]: k });
      testBtn.disabled = true; testBtn.textContent = 'Teste …';
      try { await testConnection(); toast('Verbindung OK'); }
      catch (e) { toast('Fehler: ' + e.message, { duration: 6000 }); }
      finally { testBtn.disabled = false; testBtn.textContent = 'Verbindung testen'; }
    } });
    // Welche Modelle der Key wirklich hat – die Liste ersetzt dann die Vorauswahl
    const listBtn = h('button.btn.ghost', { text: 'Modelle laden', onclick: async () => {
      const k = key.value.trim();
      if (!k) { toast('Bitte erst einen API-Key eintragen'); return; }
      updateSettings({ [keyField]: k });
      listBtn.disabled = true; listBtn.textContent = 'Lade …';
      try {
        const list = await listModels();
        if (!list.length) { toast('Keine Chat-Modelle gefunden'); return; }
        const sel = getSettings()[modelField] || p.defaultModel;
        model.innerHTML = '';
        for (const m of list) model.append(h('option', { value: m.id, text: m.label, selected: m.id === sel }));
        model.append(h('option', { value: '__custom', text: 'Anderes Modell …', selected: !list.some(m => m.id === sel) }));
        customIn.hidden = list.some(m => m.id === sel);
        toast(`${list.length} Modelle verfügbar`);
      } catch (e) { toast('Fehler: ' + e.message, { duration: 6000 }); }
      finally { listBtn.disabled = false; listBtn.textContent = 'Modelle laden'; }
    } });
    aiBox.append(h('div.card', {}, [
      h('p.small.muted', { html: `Eigener Key im Gerät (Alternative zum Hantel-Server; Foto, Rezepte, Freitext, PDF – Websuche nur mit OpenAI). Key von <a href="${p.keyUrl}" target="_blank" rel="noopener">${p.keyUrl.replace('https://', '')}</a> – bleibt nur auf diesem Gerät und wird nie exportiert. Kosten: wenige Cent pro Import, Bruchteile eines Cents pro Mahlzeit.` }),
      h('div.mt', {}, [provSeg]),
      h('div.field.mt', {}, [h('label', { text: `API-Key (${p.label})` }), key]),
      h('div.field.mt', {}, [h('label', { text: 'Modell' }), model, customIn]),
      h('p.small.faint', { text: '„Modelle laden“ zeigt genau die Modell-IDs, die dein Key über die API nutzen darf – Namen aus der ChatGPT-App können davon abweichen.' }),
      h('div.grid-2.mt', {}, [testBtn, listBtn]),
    ]));
  };
  drawAi();
  root.append(aiBox);

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
    h('p.small.muted', { text: `${getPlans().length} Pläne · ${getSessions().length} Workouts gespeichert. Die Daten liegen nur in diesem Browser – sichere sie regelmäßig.`
      + (s.lastBackupAt ? ` Letzte Sicherung: ${fmtDate(s.lastBackupAt)}.` : ' Noch keine Sicherung erstellt.') }),
    h('div.grid-2.mt', {}, [
      h('button.btn.ghost', { text: 'Sicherung exportieren', onclick: exportBackup }),
      h('button.btn.ghost', { text: 'Sicherung einspielen', onclick: () => fileIn.click() }),
    ]),
    h('button.btn.ghost.block', { text: 'Alle Sätze als CSV (Excel/Numbers)', style: { marginTop: '10px' }, onclick: exportCSV }),
    fileIn,
    h('button.btn.danger.block.mt', { text: 'Alle Daten löschen', onclick: async () => {
      if (await confirmSheet({ title: 'Wirklich alles löschen?', text: 'Pläne, Workouts und Einstellungen werden unwiderruflich entfernt.', okLabel: 'Alles löschen', danger: true })) {
        resetAll(); toast('Alles gelöscht'); location.hash = '#/plans';
      }
    } }),
  ]));

  // ---------- Cloud-Backup (GitHub Gist) ----------
  root.append(h('div.subhead', {}, [h('h2', { text: 'Cloud-Backup' })]));
  const tokenIn = h('input.input', { type: 'password', value: s.gistToken || '', placeholder: 'ghp_… oder github_pat_…', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
  tokenIn.addEventListener('change', () => updateSettings({ gistToken: tokenIn.value.trim() }));
  const cloudStatus = h('p.small.faint.mt');
  const drawCloudStatus = () => {
    const c = getSettings();
    cloudStatus.textContent = c.cloudLastError ? `Letzter Fehler: ${c.cloudLastError}`
      : c.cloudLastSync ? `Zuletzt synchronisiert: ${fmtDate(c.cloudLastSync, { time: true })}` : 'Noch nicht synchronisiert.';
  };
  drawCloudStatus();
  const busy = async (btn, label, fn) => {
    const orig = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { await fn(); } catch (e) { toast('Fehler: ' + e.message, { duration: 5000 }); }
    finally { btn.disabled = false; btn.textContent = orig; drawCloudStatus(); }
  };
  const pushBtn = h('button.btn.ghost', { text: 'Jetzt hochladen', onclick: () => busy(pushBtn, 'Lade hoch …', async () => {
    updateSettings({ gistToken: tokenIn.value.trim() });
    await cloudPush();
  }) });
  const pullBtn = h('button.btn.ghost', { text: 'Wiederherstellen', onclick: () => busy(pullBtn, 'Hole …', async () => {
    updateSettings({ gistToken: tokenIn.value.trim() });
    const ok = await confirmSheet({ title: 'Aus der Cloud wiederherstellen', text: 'Die Sicherung wird mit den lokalen Daten zusammengeführt – nichts wird gelöscht.', okLabel: 'Zusammenführen' });
    if (!ok) return;
    const r = await cloudPull();
    toast(`${r.plans} Pläne, ${r.sessions} Workouts aus der Cloud übernommen`);
  }) });
  root.append(h('div.card', {}, [
    h('p.small.muted', { html: 'Sichert deine Daten in einem <b>privaten GitHub-Gist</b> – automatisch nach jedem Workout, und auf einem neuen iPhone reicht der Token zum Wiederherstellen. Token anlegen: <a href="https://github.com/settings/tokens/new?scopes=gist&description=Hantel" target="_blank" rel="noopener">github.com → Token mit Scope „gist“</a>. Der Token bleibt nur auf diesem Gerät.' }),
    h('div.field.mt', {}, [h('label', { text: 'GitHub-Token' }), tokenIn]),
    switchRow('Automatisch sichern', 'Nach Workouts, Plan- und Körperänderungen (mit ein paar Sekunden Verzögerung)', toggle('cloudAutoSync')),
    h('div.grid-2', {}, [pushBtn, pullBtn]),
    cloudStatus,
  ]));

  // ---------- Trainingstage → Kalender ----------
  root.append(h('div.subhead', {}, [h('h2', { text: 'Trainingstage' })]));
  const days = new Set(s.trainingDays || []);
  const byDay = { ...(s.trainingPlanByDay || {}) };
  const planSel = h('div.stack', { style: { marginTop: '10px', gap: '8px' } });
  const drawPlanSel = () => {
    planSel.innerHTML = '';
    for (const d of [1, 2, 3, 4, 5, 6, 0].filter(d => days.has(d))) {
      const sel = h('select.input', { style: { minHeight: '40px', padding: '6px 10px' } }, [
        h('option', { value: '', text: 'Nach Erholung / Reihenfolge', selected: !byDay[d] }),
        ...getPlans().map(p => h('option', { value: p.id, text: p.name, selected: byDay[d] === p.id })),
      ]);
      sel.addEventListener('change', () => { if (sel.value) byDay[d] = sel.value; else delete byDay[d]; updateSettings({ trainingPlanByDay: byDay }); });
      planSel.append(h('div.row', { style: { gap: '10px' } }, [h('span', { text: WEEKDAYS_DE[d], style: { width: '28px', fontWeight: 700 } }), sel]));
    }
  };
  const dayRow = h('div.day-row', {}, [1, 2, 3, 4, 5, 6, 0].map(d => h('button.chip' + (days.has(d) ? '.on' : ''), { text: WEEKDAYS_DE[d], onclick: (e) => {
    if (days.has(d)) days.delete(d); else days.add(d);
    e.target.classList.toggle('on', days.has(d));
    updateSettings({ trainingDays: [...days] }); drawPlanSel();
  } })));
  drawPlanSel();
  const timeIn = h('input.input', { type: 'time', value: s.trainingTime || '18:00', style: { width: '120px', minHeight: '40px' } });
  timeIn.addEventListener('change', () => updateSettings({ trainingTime: timeIn.value || '18:00' }));
  root.append(h('div.card', {}, [
    h('p.small.muted', { text: 'Wähle deine Gym-Tage. Daraus wird ein Kalender-Abo mit Erinnerung 30 Minuten vorher – der Termin landet über „Teilen“ direkt im Apple-Kalender.' }),
    h('div.mt', {}, [dayRow]),
    planSel,
    h('div.row.between.mt', {}, [h('span.small.muted', { text: 'Uhrzeit' }), timeIn]),
    h('button.btn.ghost.block.mt', { html: svgIcon.calendar + '<span>Termine in den Kalender</span>', onclick: exportICS }),
  ]));

  // ---------- Installation & Siri ----------
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const startUrl = location.origin + location.pathname + '?action=start';
  root.append(h('div.subhead', {}, [h('h2', { text: 'App installieren' })]));
  root.append(h('div.card', {}, [
    standalone
      ? h('p.small.muted', { text: 'Hantel läuft als installierte App.' })
      : h('p.small.muted', { html: 'Auf dem iPhone in Safari: <b>Teilen</b> (Quadrat mit Pfeil) → <b>Zum Home-Bildschirm</b>. Danach startet Hantel wie eine normale App – auch offline.' }),
    h('div.mt', {}, [
      h('div', { text: 'Siri-Kurzbefehl „Training starten“', style: { fontWeight: 600 } }),
      h('p.small.muted', { html: 'Kurzbefehle-App → neuer Kurzbefehl → Aktion <b>„URL öffnen“</b> mit dieser Adresse. Sag dann „Hey Siri, Training starten“ – Hantel öffnet das heutige Training.' }),
      h('div.row', { style: { gap: '8px', marginTop: '6px' } }, [
        h('code.kbd.truncate', { text: startUrl, style: { flex: '1', padding: '8px 10px' } }),
        h('button.btn.sm.ghost', { text: 'Kopieren', onclick: async () => { try { await navigator.clipboard.writeText(startUrl); toast('Adresse kopiert'); } catch { toast('Kopieren nicht möglich – Adresse markieren'); } } }),
      ]),
      h('p.small.faint', { style: { marginTop: '6px' }, text: 'Mit ?action=timer öffnet sich stattdessen der Timer.' }),
    ]),
    // Bildnachweise für die mitgelieferten Gerätefotos (Wikimedia Commons)
    h('details.credits.mt', {}, [
      h('summary', { text: 'Bildnachweise (Gerätefotos)' }),
      h('ul.small.faint', {}, Object.entries(PHOTOS).map(([k, p]) => h('li', {}, [
        h('b', { text: EQUIPMENT[k]?.name || k }), h('span', { text: ': ' }),
        h('a', { href: p.url, target: '_blank', rel: 'noopener', text: `„${p.title}“` }), h('span', { text: ` – ${p.author}, ${p.license}${p.url.includes('flickr') ? ', via Flickr' : ', via Wikimedia Commons'} (verkleinert)` }),
      ]))),
    ]),
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
