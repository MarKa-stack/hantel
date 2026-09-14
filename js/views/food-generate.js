// Rezept aus Zutaten: KI-Rezept (Schätzwerte) oder echte Rezepte im Web (nur mit Quelle/Link).
// Vorrat („Was hast du zuhause?“) wird gespeichert; „Heute übrig“ nutzt die Tagesziele.
import { h, svgIcon, toast, parseNum, escapeHtml } from '../util.js';
import { getSettings, saveRecipe, getPantry, setPantry, addDiaryEntry } from '../store.js';
import { MEALS, targets, dayTotals, dateKey, recipeEntry, fmtKcal, fmtG } from '../nutrition.js';
import { runTask, aiReady, aiSupports, aiConfig } from '../llm.js';
import { openServingsSheet } from './food.js';

const DIETS = ['vegetarisch', 'vegan', 'high protein', 'low carb', 'kalorienarm'];
let draft = null; // bleibt beim Navigieren erhalten

export function render(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Essen</span>', onclick: () => navigate('/food') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Was hast du zuhause?' }), h('h1', { text: 'Rezept aus Zutaten' })])]));

  if (!aiReady()) {
    root.append(h('div.card', {}, [h('p.small.muted', { text: 'Dafür braucht die App einen KI-Zugang – unter „Mehr → KI“ den Hantel-Server oder einen eigenen Key einrichten.' }), h('button.btn.sm.ghost.mt', { text: 'Zu den Einstellungen', onclick: () => navigate('/settings') })]));
    return;
  }

  const s = getSettings();
  if (!draft) draft = { ingredients: getPantry().map(p => p.name), exclude: '', kcalMin: '', kcalMax: '', proteinMin: '', servings: 2, timeMax: 0, diet: null, useRemaining: false };
  const d = draft;

  // ---------- Zutaten ----------
  const chipBox = h('div.chips');
  const drawChips = () => {
    chipBox.innerHTML = '';
    d.ingredients.forEach((name, i) => chipBox.append(h('button.chip.on', { html: `${escapeHtml(name)} <span class="x">×</span>`, onclick: () => { d.ingredients.splice(i, 1); drawChips(); } })));
    if (!d.ingredients.length) chipBox.append(h('span.small.faint', { text: 'Noch keine Zutaten – z.B. Hähnchen, Reis, Paprika' }));
  };
  const ingIn = h('input.input', { type: 'text', placeholder: 'Zutat eingeben, Enter oder Komma', autocomplete: 'off', autocapitalize: 'sentences' });
  const addIng = () => {
    const parts = ingIn.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
    for (const p of parts) if (!d.ingredients.some(x => x.toLowerCase() === p.toLowerCase()) && d.ingredients.length < 30) d.ingredients.push(p);
    ingIn.value = ''; drawChips();
  };
  ingIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIng(); } });
  drawChips();
  root.append(h('div.card', {}, [
    h('div.row', { style: { gap: '8px' } }, [ingIn, h('button.btn.sm.ghost', { text: 'Hinzu', onclick: addIng })]),
    h('div.mt', {}, [chipBox]),
    h('div.row.mt', { style: { gap: '8px', flexWrap: 'wrap' } }, [
      h('button.btn.sm.ghost', { text: 'Als Vorrat speichern', onclick: () => { setPantry(d.ingredients); toast('Vorrat gespeichert – beim nächsten Mal vorausgefüllt'); } }),
      getPantry().length ? h('button.btn.sm.ghost', { text: `Vorrat laden (${getPantry().length})`, onclick: () => { for (const p of getPantry()) if (!d.ingredients.some(x => x.toLowerCase() === p.name.toLowerCase())) d.ingredients.push(p.name); drawChips(); } }) : null,
    ]),
  ]));

  // ---------- Optionen ----------
  const t = targets();
  const remaining = t.ready ? { kcal: Math.max(0, t.kcal - dayTotals(dateKey()).kcal), protein: Math.max(0, Math.round(t.protein - dayTotals(dateKey()).protein)) } : null;
  const num = (key, placeholder, w = '80px') => { const i = h('input.input.num', { type: 'text', inputmode: 'numeric', value: d[key] || '', placeholder, style: { width: w, minHeight: '40px' } }); i.addEventListener('input', () => { d[key] = i.value; }); return i; };
  const kcalMin = num('kcalMin', 'min'), kcalMax = num('kcalMax', 'max'), protMin = num('proteinMin', 'z.B. 40');
  const servSeg = h('div.seg', {}, [1, 2, 3, 4].map(n => h('button', { text: String(n), class: d.servings === n ? 'active' : '', onclick: (e) => { d.servings = n; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } })));
  const timeSeg = h('div.seg', {}, [[15, '< 15 Min'], [30, '< 30 Min'], [0, 'egal']].map(([v, l]) => h('button', { text: l, class: d.timeMax === v ? 'active' : '', onclick: (e) => { d.timeMax = v; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } })));
  const dietChips = h('div.chips', {}, DIETS.map(x => h('button.chip' + (d.diet === x ? '.on' : ''), { text: x, onclick: (e) => { d.diet = d.diet === x ? null : x; for (const c of dietChips.children) c.classList.toggle('on', c === e.target && d.diet === x); } })));
  const exclIn = h('input.input', { type: 'text', value: d.exclude, placeholder: 'z.B. keine Pilze, kein Koriander', style: { minHeight: '40px' } });
  exclIn.addEventListener('input', () => { d.exclude = exclIn.value; });
  const remainBtn = remaining ? h('button.chip' + (d.useRemaining ? '.on' : ''), { text: `Heute übrig: ${fmtKcal(remaining.kcal)} kcal · ${remaining.protein} g P`, onclick: (e) => {
    d.useRemaining = !d.useRemaining; e.target.classList.toggle('on', d.useRemaining);
    if (d.useRemaining) { d.kcalMax = String(Math.max(200, remaining.kcal)); d.kcalMin = ''; d.proteinMin = remaining.protein > 10 ? String(Math.min(remaining.protein, 80)) : ''; kcalMax.value = d.kcalMax; kcalMin.value = ''; protMin.value = d.proteinMin; }
  } }) : null;
  root.append(h('details.options.mt', { open: !!(d.kcalMax || d.proteinMin || d.diet) }, [
    h('summary', { text: 'Optionen (Kalorien, Protein, Zeit, Ernährungsform)' }),
    h('div.stack', { style: { marginTop: '10px' } }, [
      remainBtn ? h('div', {}, [remainBtn]) : null,
      h('div.row', { style: { gap: '8px', alignItems: 'center' } }, [h('span.small.muted', { style: { width: '110px' }, text: 'kcal / Portion' }), kcalMin, h('span.faint', { text: '–' }), kcalMax]),
      h('div.row', { style: { gap: '8px', alignItems: 'center' } }, [h('span.small.muted', { style: { width: '110px' }, text: 'Protein min.' }), protMin, h('span.faint.small', { text: 'g / Portion' })]),
      h('div.row', { style: { gap: '8px', alignItems: 'center' } }, [h('span.small.muted', { style: { width: '110px' }, text: 'Portionen' }), servSeg]),
      h('div.row', { style: { gap: '8px', alignItems: 'center' } }, [h('span.small.muted', { style: { width: '110px' }, text: 'Zeit' }), timeSeg]),
      h('div', {}, [h('div.small.muted', { style: { marginBottom: '6px' }, text: 'Ernährungsform' }), dietChips]),
      h('div.field', {}, [h('label', { text: 'Ausschließen' }), exclIn]),
    ]),
  ]));

  // ---------- Aktionen ----------
  const out = h('div.mt');
  const genBtn = h('button.btn.primary.block.ai-btn', { html: svgIcon.sparkle + '<span>Rezept erstellen</span>', onclick: () => generate() });
  const webOk = aiSupports('webSearch');
  const webBtn = h('button.btn.ghost.block', { html: svgIcon.globe + '<span>Rezepte im Internet suchen</span>', disabled: !webOk, onclick: () => searchWeb() });
  root.append(h('div.stack.mt', {}, [genBtn, webBtn, webOk ? null : h('p.small.faint', { text: `Websuche braucht den Hantel-Server oder einen OpenAI-Key (aktuell: ${aiConfig().label}).` })]), out);

  const params = () => ({
    ingredients: d.ingredients, exclude: d.exclude.split(/[,;]/).map(x => x.trim().replace(/^kein[e]?\s+/i, '')).filter(Boolean),
    kcalMin: parseNum(d.kcalMin), kcalMax: parseNum(d.kcalMax), proteinMin: parseNum(d.proteinMin), servings: d.servings, timeMax: d.timeMax || null, diet: d.diet,
  });

  const busy = (label) => { out.innerHTML = ''; out.append(h('div.card', {}, [h('div.row', { style: { gap: '10px' } }, [h('div.spinner'), h('span.small.muted', { text: label })])])); genBtn.disabled = webBtn.disabled = true; };
  const idle = () => { genBtn.disabled = false; webBtn.disabled = !webOk; };
  const fail = (msg, retry) => { out.innerHTML = ''; out.append(h('div.card.alert-card', {}, [h('div.title-ico', { html: svgIcon.warning + '<b>Das hat nicht geklappt</b>' }), h('p.small.muted', { style: { marginTop: '6px' }, text: msg }), h('button.btn.sm.ghost.mt', { text: 'Erneut versuchen', onclick: retry })])); };

  async function generate() {
    if (!d.ingredients.length) { toast('Erst Zutaten eingeben'); ingIn.focus(); return; }
    busy('Rezept wird erstellt …');
    try { const { data } = await runTask('recipe', params()); out.innerHTML = ''; out.append(recipeCard(data)); }
    catch (e) { fail(e.message || 'Die KI ist gerade nicht verfügbar. Versuch es später erneut.', generate); }
    finally { idle(); }
  }

  async function searchWeb() {
    if (!d.ingredients.length) { toast('Erst Zutaten eingeben'); ingIn.focus(); return; }
    busy('Rezepte werden gesucht …');
    try { const { data } = await runTask('web-recipes', { ingredients: d.ingredients, diet: d.diet }); out.innerHTML = ''; out.append(webCard(data.results)); }
    catch (e) { fail(e.message || 'Die Suche ist gerade nicht verfügbar.', searchWeb); }
    finally { idle(); }
  }

  // ---------- Darstellung: KI-Rezept ----------
  function recipeCard(r) {
    const n = r.nutritionPerServing;
    const have = r.ingredients.filter(i => i.have), staples = r.ingredients.filter(i => !i.have && i.staple), need = r.ingredients.filter(i => !i.have && !i.staple);
    const li = (i, mark) => h('li', {}, [h('span.mark', { text: mark }), h('span', { text: i.display })]);
    const card = h('div.card.recipe-card', {}, [
      h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } }, [h('span.pill.accent', { html: svgIcon.sparkle.replace('class="ico"', 'class="ico sm"') + '<span>KI-Rezept · Schätzwerte</span>' })]),
      h('h2', { text: r.recipeName, style: { marginTop: '8px' } }),
      h('div.small.muted', { text: `${r.prepTimeMinutes} Min · ${r.servings} Portion${r.servings === 1 ? '' : 'en'} · ${fmtKcal(n.calories)} kcal · ${fmtG(n.protein)} g Protein pro Portion` }),
      r.description ? h('p.small', { style: { marginTop: '8px' }, text: r.description }) : null,
      h('div.subhead', {}, [h('h2', { text: 'Zutaten' })]),
      h('ul.ing-list', {}, [...have.map(i => li(i, '✓')), ...staples.map(i => li(i, '·'))]),
      need.length ? h('div.card.needed.mt', {}, [h('div.small', { html: '<b>Zusätzlich benötigt</b>' }), h('ul.ing-list', {}, need.map(i => li(i, '+')))]) : null,
      h('div.subhead', {}, [h('h2', { text: 'Zubereitung' })]),
      h('ol.steps', {}, r.instructions.map(s => h('li', { text: s }))),
      h('div.subhead', {}, [h('h2', { text: 'Nährwerte pro Portion' })]),
      h('div.stats', {}, [
        h('div.stat', {}, [h('div.val', { html: `${fmtKcal(n.calories)}<small>kcal</small>` }), h('div.lbl', { text: 'Kalorien' })]),
        h('div.stat', {}, [h('div.val', { html: `${fmtG(n.protein)}<small>g</small>` }), h('div.lbl', { text: 'Protein' })]),
        h('div.stat', {}, [h('div.val', { html: `${fmtG(n.carbs)}<small>g</small>` }), h('div.lbl', { text: 'Kohlenhydrate' })]),
        h('div.stat', {}, [h('div.val', { html: `${fmtG(n.fat)}<small>g</small>` }), h('div.lbl', { text: 'Fett' })]),
      ]),
      h('p.small.faint.mt', { text: `Ballaststoffe ≈ ${fmtG(n.fiber)} g · Alle Werte sind KI-Schätzungen.` }),
      h('div.actions', {}, [
        h('button.btn.ghost', { text: 'Rezept speichern', onclick: () => { const rec = persist(r); toast(`„${rec.name}“ unter Rezepte gespeichert`); } }),
        h('button.btn.good', { text: 'Als Mahlzeit eintragen', onclick: () => {
          const rec = toRecipe(r);
          openServingsSheet(rec, { servings: 1, meal: 'dinner', dayPick: true, onCommit: (n2, meal, key) => { const saved = persist(r); addDiaryEntry(key, recipeEntry(saved, n2, meal)); toast('Eingetragen'); navigate('/food?d=' + key); } });
        } }),
      ]),
    ]);
    return card;
  }

  /** Rezept nur einmal speichern, auch wenn beide Knöpfe genutzt werden */
  function persist(r) {
    if (!r._saved) r._saved = saveRecipe(toRecipe(r));
    return r._saved;
  }

  /** KI-Rezept → App-Rezept (Zutaten mit Werten pro 100 g), Schritte in der Notiz */
  function toRecipe(r) {
    const items = r.ingredients.filter(i => i.grams > 0).map(i => ({ foodId: null, name: i.display || i.name, grams: i.grams, per100: { kcal: i.kcal / i.grams * 100, protein: i.protein / i.grams * 100, carbs: i.carbs / i.grams * 100, fat: i.fat / i.grams * 100 } }));
    return { name: r.recipeName, servings: r.servings, items, note: r.description, instructions: r.instructions, prepTimeMinutes: r.prepTimeMinutes, source: 'ai' };
  }

  // ---------- Darstellung: Web-Rezepte (echte Quellen, verlinkt) ----------
  function webCard(results) {
    if (!results.length) return h('div.card', {}, [h('p.small.muted', { text: 'Keine passenden Rezepte mit belegbarer Quelle gefunden. Andere Zutaten probieren oder ein KI-Rezept erstellen lassen.' })]);
    return h('div.card', {}, [
      h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } }, [h('span.pill', { html: svgIcon.globe.replace('class="ico"', 'class="ico sm"') + '<span>Passende Rezepte im Web</span>' })]),
      h('p.small.faint', { style: { marginTop: '6px' }, text: 'Externe Rezepte – öffnen die Originalseite. Nährwerte laut Quelle können abweichen.' }),
      h('div.stack', { style: { marginTop: '8px' } }, results.map(r => {
        let host = ''; try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { /* egal */ }
        return h('a.web-recipe', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, [
          h('div.grow', {}, [
            h('div', { text: r.title, style: { fontWeight: 600 } }),
            h('div.small.faint', { text: [r.source || host, host && r.source && !r.source.toLowerCase().includes(host.split('.')[0]) ? host : null, r.prepTimeMinutes ? `ca. ${r.prepTimeMinutes} Min` : null].filter(Boolean).join(' · ') }),
            r.why ? h('div.small.muted', { style: { marginTop: '2px' }, text: r.why }) : null,
          ]),
          h('div', { html: svgIcon.chevron }),
        ]);
      })),
    ]);
  }
}
