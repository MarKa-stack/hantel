// Essen fotografieren → KI schätzt Bestandteile, Mengen und Nährwerte → Nutzer prüft/korrigiert → Tagebuch.
// Das Bild wird nur für die Analyse übertragen (verkleinert, ohne EXIF) und nicht gespeichert.
import { h, svgIcon, toast, openSheet, parseNum, haptic } from '../util.js';
import { getSettings, updateSettings, addDiaryEntry, rememberAiMeal, getAiMeals } from '../store.js';
import { MEALS, sumMacros, fmtKcal, fmtG } from '../nutrition.js';
import { runTask, aiReady, aiSupports } from '../llm.js';
import { openAddSheet } from './food.js';

const MAX_SIDE = 1024;
const STATUS = ['Lebensmittel erkennen …', 'Portionen schätzen …', 'Nährwerte berechnen …'];
const CONF = { high: ['Hohe Sicherheit', 'good'], medium: ['Mittlere Sicherheit', ''], low: ['⚠ Portionsgröße schwer erkennbar', 'warn'] };
const r1 = (v) => Math.round(v * 10) / 10;

/** Datei → verkleinertes JPEG als Data-URL (Canvas-Neukodierung entfernt EXIF; Ausrichtung wird beim Dekodieren angewandt) */
async function prepareImage(file) {
  if (!/^image\//.test(file.type)) throw new Error('Bitte ein Bild auswählen.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), hgt = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = hgt;
    c.getContext('2d').drawImage(img, 0, 0, w, hgt);
    let q = 0.82, out = c.toDataURL('image/jpeg', q);
    while (out.length > 1_400_000 && q > 0.4) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

/** Analyse-Ergebnis → editierbares Modell (pro Bestandteil Werte pro 100 g merken, damit Gramm-Änderungen skalieren) */
function toEditable(data) {
  return {
    mealName: data.mealName, confidence: data.confidence, notes: data.notes,
    items: data.items.map(i => ({ name: i.name, grams: i.grams, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, per100: i.grams ? { kcal: i.kcal / i.grams * 100, protein: i.protein / i.grams * 100, carbs: i.carbs / i.grams * 100, fat: i.fat / i.grams * 100 } : { kcal: 0, protein: 0, carbs: 0, fat: 0 } })),
  };
}

export function openPhotoSheet({ meal = 'lunch', dayKey, onDone = () => {} }) {
  if (!aiReady()) { toast('Erst KI-Zugang unter „Mehr → KI“ einrichten', { duration: 4000 }); return; }
  if (!aiSupports('vision')) { toast('Der gewählte KI-Zugang kann keine Bilder auswerten.'); return; }
  openSheet((sheet, close) => {
    let image = null;   // Data-URL (nur im Speicher)
    let hint = null;    // 'small' | 'medium' | 'large'
    let model = null;   // editierbares Ergebnis
    let mealSel = meal;
    const body = h('div');
    // body.append ohne null-Kinder (DOM.append(null) schreibt sonst „null“)
    const put = (...els) => body.append(...els.filter(Boolean));
    sheet.append(h('h2', { text: 'Essen fotografieren' }), body);

    const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
    const galIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    const onFile = async (input) => {
      const f = input.files?.[0]; input.value = '';
      if (!f) return;
      try { image = await prepareImage(f); model = null; drawPreview(); }
      catch (e) { toast(e.message || 'Bild konnte nicht gelesen werden'); }
    };
    camIn.addEventListener('change', () => onFile(camIn));
    galIn.addEventListener('change', () => onFile(galIn));
    sheet.append(camIn, galIn);

    // ---------- Schritt 1: Aufnehmen / auswählen ----------
    const drawStart = () => {
      body.innerHTML = '';
      const consent = getSettings().photoConsent;
      put(
        h('p.small.muted', { text: 'Fotografiere dein Essen von oben bei gutem Licht. Die KI schätzt Bestandteile, Mengen und Nährwerte – du prüfst alles vor dem Speichern.' }),
        h('div.card.mt.privacy', {}, [
          h('div.small', { html: '<b>Datenschutz:</b> Das Foto wird verkleinert (ohne Metadaten) zur Analyse an den KI-Anbieter (OpenAI bzw. Anthropic) übertragen und in der App nicht gespeichert.' }),
          consent ? null : h('button.btn.sm.ghost.mt', { text: 'Verstanden', onclick: () => { updateSettings({ photoConsent: true }); drawStart(); } }),
        ]),
        h('div.grid-2.mt', {}, [
          h('button.btn.primary', { html: svgIcon.camera + '<span>Foto aufnehmen</span>', disabled: !consent, onclick: () => camIn.click() }),
          h('button.btn.ghost', { text: 'Aus Galerie', disabled: !consent, onclick: () => galIn.click() }),
        ]),
      );
      const recent = getAiMeals().slice(0, 5);
      if (recent.length) {
        body.append(h('div.subhead', {}, [h('h2', { text: 'Zuletzt analysiert' })]));
        body.append(h('div.card', {}, recent.map(m => h('div.food-row', { onclick: () => { model = toEditable({ mealName: m.mealName, confidence: m.confidence, notes: m.notes || '', items: m.items }); drawResult(); } }, [
          h('div.grow', {}, [h('div.truncate', { text: m.mealName, style: { fontWeight: 600 } }), h('div.small.faint', { text: `${fmtKcal(m.totals.kcal)} kcal · ${fmtG(m.totals.protein)} g P · ${m.items.length} Bestandteile` })]),
          h('div', { html: svgIcon.chevron }),
        ]))));
      }
      body.append(h('div.actions', {}, [h('button.btn.block', { text: 'Abbrechen', onclick: close })]));
    };

    // ---------- Schritt 2: Vorschau bestätigen ----------
    const drawPreview = () => {
      body.innerHTML = '';
      const chips = h('div.chips.mt', {}, [['small', 'Klein'], ['medium', 'Mittel'], ['large', 'Groß']].map(([k, l]) => h('button.chip' + (hint === k ? '.on' : ''), { text: l, onclick: (e) => { hint = hint === k ? null : k; for (const c of chips.children) c.classList.toggle('on', c === e.target && hint === k); } })));
      put(
        h('div.photo-preview', {}, [h('img', { src: image, alt: 'Vorschau' })]),
        h('div.small.faint.mt', { text: 'Wie groß war die Portion? (optional)' }),
        chips,
        h('div.grid-2.mt', {}, [
          h('button.btn.ghost', { text: 'Neu aufnehmen', onclick: drawStart }),
          h('button.btn.primary', { html: svgIcon.sparkle + '<span>Analysieren</span>', onclick: analyze }),
        ]),
        h('div.actions', {}, [h('button.btn.block', { text: 'Abbrechen', onclick: close })]),
      );
    };

    // ---------- Schritt 3: Analyse (echte Wartezeit, keine Fake-Prozente) ----------
    const analyze = async () => {
      body.innerHTML = '';
      const status = h('div.small.muted', { text: STATUS[0] });
      let i = 0;
      const rot = setInterval(() => { i = (i + 1) % STATUS.length; status.textContent = STATUS[i]; }, 1600);
      put(
        h('div.photo-preview.dim', {}, [h('img', { src: image, alt: '' })]),
        h('div.row.mt', { style: { gap: '10px' } }, [h('div.spinner'), h('div', {}, [h('div', { html: svgIcon.sparkle + ' <b>Dein Essen wird analysiert …</b>', style: { display: 'flex', alignItems: 'center', gap: '6px' } }), status])]),
      );
      try {
        const { data } = await runTask('food-image', { image, portionHint: hint });
        clearInterval(rot);
        if (!data.recognized) { drawError('Das Gericht konnte auf diesem Foto nicht zuverlässig erkannt werden. Versuch es mit besserem Licht oder einer Aufnahme direkt von oben.' + (data.notes ? ` (${data.notes})` : '')); return; }
        model = toEditable(data);
        haptic(20);
        drawResult();
      } catch (e) {
        clearInterval(rot);
        drawError(e.message || 'Die KI-Analyse ist gerade nicht verfügbar. Versuch es später erneut.');
      }
    };

    const drawError = (msg) => {
      body.innerHTML = '';
      put(
        image ? h('div.photo-preview.dim', {}, [h('img', { src: image, alt: '' })]) : null,
        h('div.card.mt.alert-card', {}, [h('div.title-ico', { html: svgIcon.warning + '<b>Analyse nicht möglich</b>' }), h('p.small.muted', { style: { marginTop: '6px' }, text: msg })]),
        h('div.grid-2.mt', {}, [
          h('button.btn.ghost', { text: 'Neu aufnehmen', onclick: drawStart }),
          image ? h('button.btn.primary', { text: 'Erneut versuchen', onclick: analyze }) : null,
        ]),
        h('div.actions', {}, [h('button.btn.block', { text: 'Abbrechen', onclick: close })]),
      );
    };

    // ---------- Schritt 4: Ergebnis prüfen und korrigieren ----------
    const drawResult = () => {
      body.innerHTML = '';
      const [confTxt, confCls] = CONF[model.confidence] || CONF.low;
      const nameIn = h('input.input', { type: 'text', value: model.mealName, placeholder: 'Name der Mahlzeit' });
      nameIn.addEventListener('input', () => { model.mealName = nameIn.value; });
      const list = h('div.stack', { style: { gap: '8px' } });
      const totalEl = h('div.macro-live.mt');
      const updateTotal = () => { const s = sumMacros(model.items); totalEl.innerHTML = `<b>${fmtKcal(s.kcal)} kcal</b> · ${fmtG(s.protein)} g P · ${fmtG(s.carbs)} g KH · ${fmtG(s.fat)} g F · ${model.items.reduce((a, i) => a + i.grams, 0)} g`; };
      const drawItems = () => {
        list.innerHTML = '';
        model.items.forEach((it, idx) => {
          const nm = h('input.input', { type: 'text', value: it.name, placeholder: 'Lebensmittel', style: { minHeight: '38px', fontSize: '15px' } });
          nm.addEventListener('input', () => { it.name = nm.value; });
          const num = (key, label) => {
            const inp = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(key === 'grams' ? it.grams : r1(it[key])).replace('.', ','), style: { minHeight: '36px', padding: '4px', fontSize: '14px' } });
            inp.addEventListener('input', () => {
              const v = parseNum(inp.value); if (v == null) return;
              if (key === 'grams') { it.grams = Math.max(0, v); for (const k of ['kcal', 'protein', 'carbs', 'fat']) { it[k] = r1(it.per100[k] * it.grams / 100); const el = box.querySelector(`[data-k="${k}"]`); if (el) el.value = String(k === 'kcal' ? Math.round(it[k]) : it[k]).replace('.', ','); } }
              else { it[key] = Math.max(0, v); if (it.grams) it.per100[key] = it[key] / it.grams * 100; }
              updateTotal();
            });
            inp.dataset.k = key;
            return h('div.field', {}, [h('label', { text: label }), inp]);
          };
          const box = h('div.ai-item', {}, [
            h('div.row', { style: { gap: '6px' } }, [
              nm,
              h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Entfernen', style: { width: '38px', minHeight: '38px' }, onclick: () => { model.items.splice(idx, 1); drawItems(); updateTotal(); } }),
            ]),
            h('div.row', { style: { gap: '6px', marginTop: '6px', alignItems: 'flex-end' } }, [
              h('button.btn.icon.ghost', { text: '−', style: { width: '36px', minHeight: '36px' }, onclick: () => { const g = Math.max(0, it.grams - (it.grams > 50 ? 10 : 5)); box.querySelector('[data-k="grams"]').value = String(g); box.querySelector('[data-k="grams"]').dispatchEvent(new Event('input')); } }),
              num('grams', 'g'),
              h('button.btn.icon.ghost', { text: '+', style: { width: '36px', minHeight: '36px' }, onclick: () => { const g = it.grams + (it.grams >= 50 ? 10 : 5); box.querySelector('[data-k="grams"]').value = String(g); box.querySelector('[data-k="grams"]').dispatchEvent(new Event('input')); } }),
              num('kcal', 'kcal'), num('protein', 'P'), num('carbs', 'KH'), num('fat', 'F'),
            ]),
          ]);
          list.append(box);
        });
        list.append(h('button.btn.sm.ghost', { text: '+ Lebensmittel hinzufügen', onclick: () => openAddSheet(null, dayKey, null, { onFood: (f, g) => {
          const m = { kcal: f.per100.kcal * g / 100, protein: f.per100.protein * g / 100, carbs: f.per100.carbs * g / 100, fat: f.per100.fat * g / 100 };
          model.items.push({ name: f.name, grams: g, kcal: Math.round(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat), per100: { ...f.per100 } });
          drawItems(); updateTotal();
        } }) }));
      };
      drawItems(); updateTotal();
      const mealSeg = h('div.seg.mt', {}, MEALS.map(([k, l]) => h('button', { text: l, class: mealSel === k ? 'active' : '', onclick: (e) => { mealSel = k; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } })));
      put(
        image ? h('div.photo-preview.small', {}, [h('img', { src: image, alt: '' })]) : null,
        h('div.row.mt', { style: { gap: '8px', flexWrap: 'wrap' } }, [h('span.pill.accent', { html: svgIcon.sparkle.replace('class="ico"', 'class="ico sm"') + '<span>KI-Schätzung</span>' }), h('span.pill' + (confCls ? '.' + confCls : ''), { text: confTxt })]),
        h('p.small.muted', { style: { marginTop: '8px' }, text: 'Die Portionsgrößen und Nährwerte wurden anhand des Fotos geschätzt. Kontrolliere die Werte vor dem Speichern.' + (model.notes ? ` ${model.notes}` : '') }),
        h('div.field.mt', {}, [h('label', { text: 'Name der Mahlzeit' }), nameIn]),
        h('div.mt', {}, [list]),
        totalEl,
        mealSeg,
        h('div.actions', {}, [
          h('button.btn.ghost', { text: image ? 'Neu aufnehmen' : 'Zurück', onclick: drawStart }),
          h('button.btn.good', { text: 'Speichern', onclick: () => {
            const items = model.items.filter(i => i.name.trim() && i.grams > 0);
            if (!items.length) { toast('Mindestens ein Bestandteil'); return; }
            const s = sumMacros(items);
            const entry = { meal: mealSel, kind: 'ai', refId: null, source: 'ai_image', name: (model.mealName || 'Gericht').trim(), grams: items.reduce((a, i) => a + i.grams, 0), ...s, confidence: model.confidence, items: items.map(i => ({ name: i.name, grams: i.grams, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat })) };
            addDiaryEntry(dayKey, entry);
            rememberAiMeal({ mealName: entry.name, confidence: model.confidence, notes: model.notes, items: entry.items, totals: s });
            close(); toast(`${entry.name} eingetragen (KI-Schätzung)`); onDone();
          } }),
        ]),
      );
    };

    drawStart();
  });
}
