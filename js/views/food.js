// Essen: Tagebuch mit Ringen und Mahlzeiten, Lebensmittel (Basis / eigene / Open Food Facts / KI), Rezepte, Ziele
import { h, svg, svgIcon, toast, openSheet, confirmSheet, actionSheet, promptSheet, parseNum, fmtDate, relativeDay, iconBox } from '../util.js';
import { getSettings, updateSettings, getFoods, saveFood, deleteFood, touchFood, getRecipes, getRecipe, saveRecipe, deleteRecipe, getDay, addDiaryEntry, updateDiaryEntry, deleteDiaryEntry, copyDiaryDay, subscribe } from '../store.js';
import { MEALS, MEAL_NAME, ACTIVITY, GOALS, dateKey, keyToTs, macros, sumMacros, recipeTotals, searchLocal, recentItems, favoriteItems, findFood, dayTotals, mealTotals, foodEntry, recipeEntry, targets, tdee, currentWeight, adaptiveSuggestion, applyAdjustment, intakeAverage, weightTrend, fmtKcal, fmtG } from '../nutrition.js';
import { offSearch, offByBarcode, looksLikeBarcode } from '../off.js';
import { aiParseFood } from '../ai-food.js';
import { openScanner, scannerAvailable } from '../scanner.js';

let curKey = dateKey();
let unsub = null;

export function render(root, ctx) {
  if (ctx.sub === 'recipes') return renderRecipes(root, ctx);
  if (ctx.sub === 'recipe') return renderRecipeEditor(root, ctx);
  if (ctx.sub === 'foods') return renderMyFoods(root, ctx);
  if (ctx.sub === 'goals') return renderGoals(root, ctx);
  return renderDay(root, ctx);
}

export function unmount() { unsub?.(); unsub = null; }

// ==================================================================
// Tagebuch
// ==================================================================

function renderDay(root, { navigate, query }) {
  if (query?.get('d')) curKey = query.get('d');
  const draw = () => {
    root.innerHTML = '';
    const isToday = curKey === dateKey();
    const ts = keyToTs(curKey);
    const settings = getSettings();
    const t = targets();
    const tot = dayTotals(curKey);

    // Kopf mit Tagesnavigation
    root.append(h('div.page-head', {}, [
      h('div', {}, [h('div.eyebrow', { text: isToday ? 'Heute' : relativeDay(ts) }), h('h1', { text: 'Essen' })]),
      h('div.row', { style: { gap: '6px' } }, [
        h('button.btn.icon.ghost', { text: '‹', 'aria-label': 'Vorheriger Tag', style: { fontSize: '22px' }, onclick: () => { curKey = dateKey(ts - 86400000); draw(); } }),
        h('button.btn.sm.ghost', { text: isToday ? fmtDate(ts) : 'Heute', onclick: () => { curKey = dateKey(); draw(); } }),
        h('button.btn.icon.ghost', { text: '›', 'aria-label': 'Nächster Tag', style: { fontSize: '22px' }, disabled: isToday, onclick: () => { curKey = dateKey(ts + 86400000); draw(); } }),
      ]),
    ]));

    // Ringe / Balken
    root.append(macroCard(tot, t, navigate));

    // Mahlzeiten
    const yesterdayKey = dateKey(ts - 86400000);
    for (const [meal, label] of MEALS) {
      const entries = getDay(curKey).filter(e => e.meal === meal);
      const mt = mealTotals(curKey, meal);
      const card = h('div.card.meal-card');
      // „⋯“: Mahlzeit als Rezept merken (z.B. das tägliche Frühstück) oder leeren
      const menu = () => actionSheet(label, [
        { label: 'Als Rezept speichern', fn: () => saveMealAsRecipe(entries, label) },
        { label: 'Alle Einträge löschen', danger: true, fn: () => { for (const e of entries) deleteDiaryEntry(curKey, e.id); draw(); } },
      ]);
      card.append(h('div.row.between', {}, [
        h('div', {}, [h('div.meal-title', { text: label }), entries.length ? h('div.small.faint', { text: `${fmtKcal(mt.kcal)} kcal · ${fmtG(mt.protein)} g Protein` }) : null]),
        h('div.row', { style: { gap: '4px' } }, [
          entries.length ? h('button.btn.sm.ghost.icon', { 'aria-label': 'Mehr', html: svgIcon.more, onclick: menu }) : null,
          h('button.btn.sm.ghost.icon', { 'aria-label': `${label} hinzufügen`, html: svgIcon.plus, onclick: () => openAddSheet(meal, curKey, draw) }),
        ]),
      ]));
      for (const e of entries) {
        card.append(h('div.food-row', { onclick: () => openEntrySheet(curKey, e, draw) }, [
          h('div.grow', {}, [
            h('div.truncate', { text: e.name, style: { fontWeight: 600 } }),
            h('div.small.faint', { text: (e.kind === 'recipe' ? `${String(e.servings).replace('.', ',')} Portion${e.servings === 1 ? '' : 'en'} · ` : `${e.grams} g · `) + `${fmtG(e.protein)} g P · ${fmtG(e.carbs)} g KH · ${fmtG(e.fat)} g F` }),
          ]),
          h('div.kcal', { text: fmtKcal(e.kcal) }),
        ]));
      }
      if (!entries.length) {
        const yN = getDay(yesterdayKey).filter(e => e.meal === meal).length;
        card.append(h('div.row', { style: { gap: '10px' } }, [
          h('button.food-empty', { text: 'Hinzufügen …', style: { width: 'auto' }, onclick: () => openAddSheet(meal, curKey, draw) }),
          yN ? h('button.btn.sm.ghost', { text: `Wie gestern (${yN})`, onclick: () => { copyDiaryDay(yesterdayKey, curKey, meal); toast(`${label} von gestern übernommen`); draw(); } }) : null,
        ]));
      }
      root.append(card);
    }

    // Aktionen
    const yesterday = dateKey(ts - 86400000);
    const actions = h('div.stack.mt');
    actions.append(h('button.btn.primary.block', { html: svgIcon.doc + '<span>Freitext mit KI eintragen</span>', onclick: () => openAiSheet({ meal: 'lunch', dayKey: curKey, onDone: draw }) }));
    if (!getDay(curKey).length && getDay(yesterday).length) actions.append(h('button.btn.ghost.block', { text: 'Gestern kopieren', onclick: () => { const n = copyDiaryDay(yesterday, curKey); toast(`${n} Einträge kopiert`); draw(); } }));
    root.append(actions);
    root.append(h('div.row.mt', { style: { gap: '8px', flexWrap: 'wrap' } }, [
      h('button.btn.sm.ghost', { text: 'Rezepte', onclick: () => navigate('/food/recipes') }),
      h('button.btn.sm.ghost', { text: 'Meine Lebensmittel', onclick: () => navigate('/food/foods') }),
      h('button.btn.sm.ghost', { text: 'Ziele', onclick: () => navigate('/food/goals') }),
    ]));
    if (!settings.apiKey) root.append(h('p.small.faint.mt', { text: 'Tipp: Mit Claude-API-Key (unter „Mehr“) kannst du Mahlzeiten und Rezepte als Freitext eintragen.' }));
  };
  draw();
  unsub = subscribe((what) => { if (what === 'nutrition' && location.hash.startsWith('#/food') && !location.hash.startsWith('#/food/')) draw(); });
}

/** Geloggte Mahlzeit als Rezept (1 Portion) merken – Rezept-Einträge werden in ihre Zutaten aufgelöst */
async function saveMealAsRecipe(entries, label) {
  if (!entries.length) return;
  const name = await promptSheet({ title: 'Als Rezept speichern', label: 'Name', value: `Mein ${label}`, okLabel: 'Speichern' });
  if (!name) return;
  const items = [];
  for (const e of entries) {
    if (e.kind === 'recipe') {
      const r = getRecipe(e.refId);
      if (r) { const f = (Number(e.servings) || 1) / Math.max(1, r.servings || 1); for (const it of r.items) items.push({ ...it, grams: Math.round(it.grams * f) }); continue; }
    }
    const g = Number(e.grams) || 0;
    const per100 = findFood(e.refId)?.per100 || (g ? { kcal: e.kcal / g * 100, protein: e.protein / g * 100, carbs: e.carbs / g * 100, fat: e.fat / g * 100 } : null);
    if (per100 && g) items.push({ foodId: e.refId, name: e.name, grams: g, per100: { ...per100 } });
  }
  if (!items.length) { toast('Nichts zu speichern'); return; }
  saveRecipe({ name, servings: 1, items, note: '' });
  toast(`„${name}“ gespeichert – ab jetzt mit zwei Tipps eintragbar`, { duration: 3500 });
}

/** Kalorienring + Makro-Balken */
function macroCard(tot, t, navigate) {
  const R = 44, C = 2 * Math.PI * R;
  const ring = svg('svg', { viewBox: '0 0 100 100' });
  const ratio = t.ready ? Math.min(1, tot.kcal / t.kcal) : 0;
  const prog = svg('circle', { class: 'prog' + (t.ready && tot.kcal > t.kcal * 1.1 ? ' over' : ''), cx: 50, cy: 50, r: R, 'stroke-dasharray': C, 'stroke-dashoffset': C });
  ring.append(svg('circle', { class: 'track', cx: 50, cy: 50, r: R }), prog);
  requestAnimationFrame(() => requestAnimationFrame(() => prog.setAttribute('stroke-dashoffset', C * (1 - ratio))));
  const bar = (label, val, target, cls) => h('div.macro-bar', {}, [
    h('div.row.between', {}, [h('span.lbl', { text: label }), h('span.mono', { html: `<b>${fmtG(val)}</b>${target ? ` / ${target} g` : ' g'}` })]),
    h('div.track', {}, [h('i', { class: cls, style: { width: `${target ? Math.min(100, (val / target) * 100) : 0}%` } })]),
  ]);
  return h('div.card.macro-card', {}, [
    h('div.row', { style: { gap: '16px', alignItems: 'center' } }, [
      h('div.kcal-ring', {}, [ring, h('div.inner', {}, [h('div.big', { text: fmtKcal(tot.kcal) }), h('div.sub', { text: t.ready ? `von ${fmtKcal(t.kcal)}` : 'kcal' })])]),
      h('div.grow', {}, [
        bar('Protein', tot.protein, t.protein, 'p'),
        bar('Kohlenhydrate', tot.carbs, t.carbs, 'c'),
        bar('Fett', tot.fat, t.fat, 'f'),
      ]),
    ]),
    t.ready
      ? h('div.small.faint', { style: { marginTop: '8px' }, text: tot.kcal > t.kcal ? `${fmtKcal(tot.kcal - t.kcal)} kcal über dem Ziel` : `Noch ${fmtKcal(t.kcal - tot.kcal)} kcal · ${Math.max(0, Math.round(t.protein - tot.protein))} g Protein offen` })
      : h('button.btn.sm.ghost.mt', { text: 'Ziele einrichten (Größe, Alter, Aktivität)', onclick: () => navigate('/food/goals') }),
  ]);
}

// ==================================================================
// Hinzufügen: Suche (lokal, Open Food Facts, EAN), Zuletzt, Favoriten, Rezepte, KI
// ==================================================================

/**
 * @param {string|null} meal Ziel-Mahlzeit (null = Auswahl liefert nur zurück, z.B. Rezept-Zutat)
 * @param {string} dayKey
 * @param {Function} onDone nach dem Eintragen
 * @param {{ onFood?:(food, grams)=>void }} opts Rezept-Modus: statt Tagebuch-Eintrag Callback
 */
export function openAddSheet(meal, dayKey, onDone, opts = {}) {
  openSheet((sheet, close) => {
    const input = h('input.input', { type: 'search', placeholder: 'Suchen … oder EAN eingeben', autocomplete: 'off' });
    const results = h('div.results');
    let online = [];
    let onlineState = ''; // '', 'loading', 'done', 'error'
    let timer = null;

    const pickFood = (food, presetGrams) => {
      openPortionSheet(food, { grams: presetGrams, meal: meal || 'lunch', onCommit: (grams, mealSel) => {
        // Online-Treffer lokal merken (schnell + offline beim nächsten Mal)
        if (food.source === 'off' && !getFoods().some(f => f.id === food.id)) saveFood({ ...food });
        if (opts.onFood) { close(); opts.onFood(food, grams); return; }
        addDiaryEntry(dayKey, foodEntry(food, grams, mealSel));
        touchFood(food.id);
        close(); toast(`${food.name} eingetragen`); onDone?.();
      } });
    };
    const pickRecipe = (recipe, presetServings) => {
      openServingsSheet(recipe, { servings: presetServings, meal: meal || 'lunch', onCommit: (servings, mealSel) => {
        addDiaryEntry(dayKey, recipeEntry(recipe, servings, mealSel));
        close(); toast(`${recipe.name} eingetragen`); onDone?.();
      } });
    };

    const row = (kind, item, extra = '') => h('div.food-row', { onclick: () => kind === 'recipe' ? pickRecipe(item) : pickFood(item) }, [
      kind === 'recipe' ? h('span.pill.accent', { text: 'Rezept' }) : item.source === 'base' ? null : h('span.pill', { text: item.source === 'off' ? 'OFF' : item.source === 'ai' ? 'KI' : 'Eigen' }),
      h('div.grow', {}, [
        h('div.truncate', { text: item.name + (item.brand ? ` · ${item.brand}` : ''), style: { fontWeight: 600 } }),
        h('div.small.faint', { text: kind === 'recipe' ? `${fmtKcal(recipeTotals(item).perServing.kcal)} kcal · ${fmtG(recipeTotals(item).perServing.protein)} g P pro Portion` : `${fmtKcal(item.per100.kcal)} kcal · ${fmtG(item.per100.protein)} g P pro 100 ${item.unit || 'g'}${extra}` }),
      ]),
      h('div', { html: svgIcon.chevron }),
    ]);

    const draw = () => {
      results.innerHTML = '';
      const q = input.value.trim();
      if (!q) {
        const rec = recentItems(10);
        if (rec.length) { results.append(h('div.subhead', {}, [h('h2', { text: 'Zuletzt' })])); results.append(h('div.card', {}, rec.map(r => r.kind === 'recipe' ? row('recipe', r.item) : row('food', r.item, r.lastGrams ? ` · zuletzt ${r.lastGrams} g` : '')))); }
        const fav = favoriteItems();
        if (fav.length) { results.append(h('div.subhead', {}, [h('h2', { text: 'Favoriten' })])); results.append(h('div.card', {}, fav.map(r => row('food', r.item)))); }
        if (!opts.onFood && getRecipes().length) { results.append(h('div.subhead', {}, [h('h2', { text: 'Rezepte' })])); results.append(h('div.card', {}, getRecipes().slice(0, 6).map(r => row('recipe', r)))); }
        if (!rec.length && !fav.length) results.append(h('p.small.muted', { style: { padding: '8px 0' }, text: 'Tipp etwas ein – Grundnahrungsmittel sind sofort da, Markenprodukte kommen von Open Food Facts.' }));
        return;
      }
      if (looksLikeBarcode(q)) {
        results.append(h('button.btn.block.mt', { text: `EAN ${q} nachschlagen`, onclick: () => lookupBarcode(q) }));
      }
      const local = searchLocal(q).filter(x => opts.onFood ? x.kind === 'food' : true);
      if (local.length) results.append(h('div.card', {}, local.map(x => row(x.kind, x.item))));
      else results.append(h('p.small.muted', { style: { padding: '8px 0' }, text: 'Nichts Lokales gefunden.' }));
      // Online
      const box = h('div.mt');
      if (onlineState === 'loading') box.append(h('div.row', { style: { gap: '10px', padding: '6px 0' } }, [h('div.spinner'), h('span.small.muted', { text: 'Open Food Facts …' })]));
      else if (onlineState === 'done') {
        box.append(h('div.subhead', {}, [h('h2', { text: 'Open Food Facts' })]));
        box.append(online.length ? h('div.card', {}, online.map(f => row('food', f))) : h('p.small.muted', { text: 'Keine Produkte mit vollständigen Nährwerten gefunden.' }));
      } else if (onlineState === 'error') box.append(h('p.small.muted', { text: 'Online-Suche fehlgeschlagen – Netz?' }));
      else box.append(h('button.btn.ghost.block', { text: 'Online suchen (Open Food Facts)', onclick: () => searchOnline(q) }));
      results.append(box);
    };

    const searchOnline = async (q) => {
      onlineState = 'loading'; draw();
      try { online = await offSearch(q); onlineState = 'done'; } catch { onlineState = 'error'; }
      draw();
    };
    const lookupBarcode = async (code) => {
      onlineState = 'loading'; draw();
      try { const f = await offByBarcode(code); if (f) pickFood(f); else toast('EAN nicht gefunden'); onlineState = ''; } catch { onlineState = 'error'; }
      draw();
    };

    input.addEventListener('input', () => { onlineState = ''; online = []; clearTimeout(timer); timer = setTimeout(draw, 120); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const q = input.value.trim(); if (looksLikeBarcode(q)) lookupBarcode(q); else if (q.length >= 2 && onlineState === '') searchOnline(q); } });

    const scanBtn = h('button.btn.icon.ghost', { 'aria-label': 'Barcode scannen', title: 'Scannen', html: svgIcon.scan, hidden: !scannerAvailable(), onclick: () => openScanner((code) => { input.value = code; lookupBarcode(code); }) });
    sheet.append(
      h('h2', { text: opts.onFood ? 'Zutat hinzufügen' : `${MEAL_NAME[meal] || 'Mahlzeit'} hinzufügen` }),
      h('div.row', { style: { gap: '8px' } }, [input, scanBtn]),
      results,
      h('div.row.mt', { style: { gap: '8px' } }, [
        h('button.btn.ghost.grow', { text: 'Neues Lebensmittel', onclick: () => openFoodEditor(null, (f) => { if (f) pickFood(f); }) }),
        opts.onFood ? null : h('button.btn.ghost.grow', { text: 'Freitext mit KI', onclick: () => { close(); openAiSheet({ meal: meal || 'lunch', dayKey, onDone }); } }),
      ]),
      h('div.actions', {}, [h('button.btn.block', { text: 'Abbrechen', onclick: close })]),
    );
    draw();
    setTimeout(() => input.focus(), 80);
  });
}

/** Grammzahl wählen → Makros live; Portions-Chips aus dem Lebensmittel */
function openPortionSheet(food, { grams, meal, onCommit, onDelete = null, title = 'Hinzufügen' }) {
  openSheet((sheet, close) => {
    let g = grams != null ? Number(grams) : (food.portions?.[0]?.grams || 100);
    let mealSel = meal;
    const input = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(g), style: { fontSize: '26px', minHeight: '56px' } });
    const live = h('div.macro-live');
    const update = () => {
      const m = macros(food.per100, g);
      live.innerHTML = `<b>${fmtKcal(m.kcal)} kcal</b> · ${fmtG(m.protein)} g P · ${fmtG(m.carbs)} g KH · ${fmtG(m.fat)} g F`;
    };
    const set = (v) => { g = Math.max(0, Math.round((Number(v) || 0) * 10) / 10); input.value = String(g).replace('.', ','); update(); };
    input.addEventListener('input', () => { const v = parseNum(input.value); if (v != null) { g = v; update(); } });
    const unit = food.unit || 'g';
    const chips = h('div.chips');
    const portions = [{ label: `100 ${unit}`, grams: 100 }, ...(food.portions || [])];
    for (const p of portions) chips.append(h('button.chip', { text: p.label, onclick: () => set(p.grams) }));
    const mealSeg = meal ? h('div.seg', {}, MEALS.map(([k, l]) => h('button', { text: l, class: mealSel === k ? 'active' : '', onclick: (e) => { mealSel = k; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } }))) : null;
    sheet.append(
      h('h2', { text: food.name, style: { marginBottom: '2px' } }),
      h('p.small.faint', { text: (food.brand ? `${food.brand} · ` : '') + `pro 100 ${unit}: ${fmtKcal(food.per100.kcal)} kcal · ${fmtG(food.per100.protein)} P · ${fmtG(food.per100.carbs)} KH · ${fmtG(food.per100.fat)} F` }),
      h('div.stepper.mt', {}, [
        h('button', { text: '−', onclick: () => set(g - (g > 50 ? 10 : 5)) }),
        h('div.val', {}, [input, h('small', { text: unit })]),
        h('button', { text: '+', onclick: () => set(g + (g >= 50 ? 10 : 5)) }),
      ]),
      h('div.mt', {}, [chips]),
      h('div.mt', {}, [live]),
      mealSeg ? h('div.mt', {}, [mealSeg]) : null,
      h('div.actions', {}, [
        onDelete ? h('button.btn.danger', { text: 'Löschen', onclick: () => { close(); onDelete(); } }) : h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
        h('button.btn.primary', { text: title, onclick: () => { if (!(g > 0)) { toast('Menge eingeben'); return; } close(); onCommit(g, mealSel); } }),
      ]),
    );
    update();
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

function openServingsSheet(recipe, { servings, meal, onCommit, onDelete = null, title = 'Hinzufügen' }) {
  openSheet((sheet, close) => {
    let n = servings || 1;
    let mealSel = meal;
    const t = recipeTotals(recipe);
    const input = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(n).replace('.', ','), style: { fontSize: '26px', minHeight: '56px' } });
    const live = h('div.macro-live');
    const update = () => { live.innerHTML = `<b>${fmtKcal(t.perServing.kcal * n)} kcal</b> · ${fmtG(t.perServing.protein * n)} g P · ${fmtG(t.perServing.carbs * n)} g KH · ${fmtG(t.perServing.fat * n)} g F · ≈ ${Math.round(t.gramsPerServing * n)} g`; };
    const set = (v) => { n = Math.max(0.25, Math.round(v * 4) / 4); input.value = String(n).replace('.', ','); update(); };
    input.addEventListener('input', () => { const v = parseNum(input.value); if (v > 0) { n = v; update(); } });
    const mealSeg = meal ? h('div.seg', {}, MEALS.map(([k, l]) => h('button', { text: l, class: mealSel === k ? 'active' : '', onclick: (e) => { mealSel = k; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } }))) : null;
    sheet.append(
      h('h2', { text: recipe.name, style: { marginBottom: '2px' } }),
      h('p.small.faint', { text: `pro Portion: ${fmtKcal(t.perServing.kcal)} kcal · ${fmtG(t.perServing.protein)} g P · ${t.gramsPerServing} g` }),
      h('div.stepper.mt', {}, [h('button', { text: '−', onclick: () => set(n - 0.5) }), h('div.val', {}, [input, h('small', { text: 'Portionen' })]), h('button', { text: '+', onclick: () => set(n + 0.5) })]),
      h('div.mt', {}, [live]),
      mealSeg ? h('div.mt', {}, [mealSeg]) : null,
      h('div.actions', {}, [
        onDelete ? h('button.btn.danger', { text: 'Löschen', onclick: () => { close(); onDelete(); } }) : h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
        h('button.btn.primary', { text: title, onclick: () => { close(); onCommit(n, mealSel); } }),
      ]),
    );
    update();
  });
}

/** Bestehenden Tagebuch-Eintrag ändern (Menge, Mahlzeit) oder löschen */
function openEntrySheet(dayKey, e, onDone) {
  const del = () => { deleteDiaryEntry(dayKey, e.id); toast('Eintrag gelöscht'); onDone?.(); };
  if (e.kind === 'recipe') {
    const r = getRecipe(e.refId);
    if (!r) { actionSheet(e.name, [{ label: 'Eintrag löschen', danger: true, fn: del }]); return; }
    openServingsSheet(r, { servings: e.servings, meal: e.meal, title: 'Speichern', onDelete: del, onCommit: (n, meal) => { updateDiaryEntry(dayKey, e.id, { ...recipeEntry(r, n, meal), id: e.id }); onDone?.(); } });
    return;
  }
  const f = findFood(e.refId) || { id: e.refId, name: e.name, per100: { kcal: e.kcal / e.grams * 100, protein: e.protein / e.grams * 100, carbs: e.carbs / e.grams * 100, fat: e.fat / e.grams * 100 }, unit: 'g', portions: [] };
  openPortionSheet(f, { grams: e.grams, meal: e.meal, title: 'Speichern', onDelete: del, onCommit: (g, meal) => { updateDiaryEntry(dayKey, e.id, { ...foodEntry(f, g, meal), id: e.id, name: e.name }); onDone?.(); } });
}

// ==================================================================
// Lebensmittel-Editor
// ==================================================================

export function openFoodEditor(existing, onDone = () => {}) {
  const isNew = !existing;
  const d = existing ? { ...existing, per100: { ...existing.per100 }, portions: [...(existing.portions || [])] } : { name: '', brand: '', source: 'custom', per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, unit: 'g', portions: [], favorite: false };
  openSheet((sheet, close) => {
    const name = h('input.input', { type: 'text', value: d.name, placeholder: 'z.B. Skyr Vanille' });
    const brand = h('input.input', { type: 'text', value: d.brand || '', placeholder: 'Marke (optional)' });
    const numIn = (v) => h('input.input.num', { type: 'text', inputmode: 'decimal', value: v ? String(v).replace('.', ',') : '' });
    const kcal = numIn(d.per100.kcal), prot = numIn(d.per100.protein), carbs = numIn(d.per100.carbs), fat = numIn(d.per100.fat);
    const unitSeg = h('div.seg', { style: { width: '120px' } }, ['g', 'ml'].map(u => h('button', { text: u, class: d.unit === u ? 'active' : '', onclick: (e) => { d.unit = u; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } })));
    const portionsBox = h('div.stack', { style: { gap: '6px' } });
    const drawPortions = () => {
      portionsBox.innerHTML = '';
      d.portions.forEach((p, i) => portionsBox.append(h('div.row', { style: { gap: '6px' } }, [
        h('input.input', { type: 'text', value: p.label, placeholder: 'z.B. 1 Scheibe', style: { minHeight: '40px' }, oninput: (e) => { p.label = e.target.value; } }),
        h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(p.grams), style: { width: '80px', minHeight: '40px' }, oninput: (e) => { p.grams = parseNum(e.target.value) || 0; } }),
        h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Portion entfernen', style: { width: '40px', minHeight: '40px' }, onclick: () => { d.portions.splice(i, 1); drawPortions(); } }),
      ])));
      portionsBox.append(h('button.btn.sm.ghost', { text: '+ Portion (z.B. „1 Scheibe“ = 25 g)', onclick: () => { d.portions.push({ label: '', grams: 0 }); drawPortions(); } }));
    };
    drawPortions();
    const favIn = h('input', { type: 'checkbox', checked: !!d.favorite });
    sheet.append(
      h('h2', { text: isNew ? 'Neues Lebensmittel' : 'Lebensmittel bearbeiten' }),
      h('div.stack', {}, [
        h('div.field', {}, [h('label', { text: 'Name' }), name]),
        h('div.field', {}, [h('label', { text: 'Marke' }), brand]),
        h('div.row.between', {}, [h('span.small.muted', { text: 'Nährwerte pro 100' }), unitSeg]),
        h('div.grid-4', {}, [
          h('div.field', {}, [h('label', { text: 'kcal' }), kcal]),
          h('div.field', {}, [h('label', { text: 'Protein' }), prot]),
          h('div.field', {}, [h('label', { text: 'KH' }), carbs]),
          h('div.field', {}, [h('label', { text: 'Fett' }), fat]),
        ]),
        h('div.field', {}, [h('label', { text: 'Portionen' }), portionsBox]),
        h('div.switch', {}, [h('div.grow', {}, [h('div.lbl', { text: 'Favorit' }), h('div.desc', { text: 'Erscheint oben beim Hinzufügen' })]), h('label.toggle', {}, [favIn, h('span')])]),
      ]),
      !isNew && d.source !== 'base' ? h('button.btn.danger.block.mt', { text: 'Löschen', onclick: async () => {
        close();
        if (await confirmSheet({ title: `„${d.name}“ löschen?`, text: 'Tagebuch-Einträge bleiben erhalten.', okLabel: 'Löschen', danger: true })) { deleteFood(d.id); toast('Gelöscht'); onDone(null); }
      } }) : null,
      h('div.actions', {}, [
        h('button.btn.ghost', { text: 'Abbrechen', onclick: close }),
        h('button.btn.primary', { text: isNew ? 'Anlegen' : 'Speichern', onclick: () => {
          const n = name.value.trim(); if (!n) { name.focus(); return; }
          const k = parseNum(kcal.value); if (k == null) { kcal.focus(); return; }
          const food = { ...d, name: n, brand: brand.value.trim(), favorite: favIn.checked, portions: d.portions.filter(p => p.label.trim() && p.grams > 0),
            per100: { kcal: Math.round(k), protein: parseNum(prot.value) || 0, carbs: parseNum(carbs.value) || 0, fat: parseNum(fat.value) || 0 } };
          if (food.source === 'base') { food.id = undefined; food.source = 'custom'; } // Basis-Eintrag wird als eigene Kopie gespeichert
          const saved = saveFood(food);
          close(); toast(isNew ? 'Lebensmittel angelegt' : 'Gespeichert'); onDone(saved);
        } }),
      ]),
    );
    if (isNew) setTimeout(() => name.focus(), 60);
  });
}

// ==================================================================
// KI-Freitext
// ==================================================================

/** Freitext → Zutatenliste zum Prüfen → ins Tagebuch oder als Rezept */
export function openAiSheet({ meal = 'lunch', dayKey = dateKey(), onDone = () => {}, recipeMode = false, onRecipe = null }) {
  const settings = getSettings();
  if (!settings.apiKey) { toast('Erst API-Key unter „Mehr → KI-Import“ eintragen', { duration: 4000 }); return; }
  openSheet((sheet, close) => {
    const ta = h('textarea.input', { placeholder: recipeMode ? 'z.B. 500 g Hähnchenbrust, 200 g Philadelphia, 100 ml Sahne, 300 g Reis roh, 2 Paprika, 1 EL Öl – 4 Portionen' : 'z.B. 3 Eier, 2 Scheiben Vollkornbrot mit Butter, 1 Banane', style: { minHeight: '96px' } });
    const out = h('div');
    let parsed = null;
    let mealSel = meal;
    const analyzeBtn = h('button.btn.primary.block', { text: 'Analysieren', onclick: async () => {
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      analyzeBtn.disabled = true; analyzeBtn.textContent = 'Claude rechnet …';
      try { parsed = await aiParseFood(text, { apiKey: settings.apiKey, model: settings.aiModel || 'claude-sonnet-5' }); drawParsed(); }
      catch (e) { toast('Fehler: ' + e.message, { duration: 5000 }); }
      finally { analyzeBtn.disabled = false; analyzeBtn.textContent = 'Analysieren'; }
    } });
    const drawParsed = () => {
      out.innerHTML = '';
      if (!parsed?.items.length) { out.append(h('p.small.muted.mt', { text: 'Nichts erkannt – anders formulieren?' })); return; }
      const list = h('div.card.mt');
      const totalEl = h('div.macro-live.mt');
      const updateTotal = () => { const s = sumMacros(parsed.items.map(i => macros(i.per100, i.grams))); totalEl.innerHTML = `<b>${fmtKcal(s.kcal)} kcal</b> · ${fmtG(s.protein)} g P · ${fmtG(s.carbs)} g KH · ${fmtG(s.fat)} g F` + (parsed.servings ? ` · ${parsed.servings} Portionen → ${fmtKcal(s.kcal / parsed.servings)} kcal/Portion` : ''); };
      parsed.items.forEach((it, i) => {
        const gIn = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(it.grams), style: { width: '76px', minHeight: '38px' } });
        const kcalEl = h('span.kcal');
        const upd = () => { kcalEl.textContent = fmtKcal(macros(it.per100, it.grams).kcal); updateTotal(); };
        gIn.addEventListener('input', () => { it.grams = parseNum(gIn.value) || 0; upd(); });
        list.append(h('div.food-row', {}, [
          h('div.grow', {}, [
            h('div.truncate', { text: it.name + (it.brand ? ` · ${it.brand}` : ''), style: { fontWeight: 600 } }),
            h('div.small.faint', { text: `${fmtKcal(it.per100.kcal)} kcal · ${fmtG(it.per100.protein)} g P pro 100 ${it.unit}` + (it.note ? ` · ${it.note}` : '') }),
          ]),
          gIn, h('span.small.faint', { text: it.unit }), kcalEl,
          h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Entfernen', style: { width: '36px', minHeight: '36px' }, onclick: () => { parsed.items.splice(i, 1); drawParsed(); } }),
        ]));
        upd();
      });
      out.append(list, totalEl);
      const mealSeg = h('div.seg.mt', {}, MEALS.map(([k, l]) => h('button', { text: l, class: mealSel === k ? 'active' : '', onclick: (e) => { mealSel = k; for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target); } })));
      const servIn = h('input.input.num', { type: 'text', inputmode: 'numeric', value: String(parsed.servings || 1), style: { width: '70px', minHeight: '40px' } });
      const titleIn = h('input.input', { type: 'text', value: parsed.title || '', placeholder: 'Rezeptname', style: { minHeight: '40px' } });
      if (!recipeMode) out.append(mealSeg);
      out.append(h('div.row.mt', { style: { gap: '8px' } }, [titleIn, h('span.small.faint', { text: 'Portionen' }), servIn]));
      out.append(h('div.row.mt', { style: { gap: '8px' } }, [
        recipeMode ? null : h('button.btn.good.grow', { text: 'Ins Tagebuch', onclick: () => {
          for (const it of parsed.items) { const f = rememberAiFood(it); addDiaryEntry(dayKey, foodEntry(f, it.grams, mealSel)); touchFood(f.id); }
          close(); toast(`${parsed.items.length} Einträge eingetragen`); onDone();
        } }),
        h('button.btn' + (recipeMode ? '.primary' : '.ghost') + '.grow', { text: 'Als Rezept speichern', onclick: () => {
          const name = titleIn.value.trim() || 'Rezept';
          const servings = Math.max(1, parseInt(servIn.value, 10) || 1);
          const items = parsed.items.map(it => { const f = rememberAiFood(it); return { foodId: f.id, name: f.name, grams: it.grams, per100: { ...f.per100 } }; });
          const r = saveRecipe({ name, servings, items, note: '' });
          close(); toast(`Rezept „${name}“ gespeichert`);
          if (onRecipe) onRecipe(r); else onDone();
        } }),
      ]));
    };
    sheet.append(
      h('h2', { text: recipeMode ? 'Rezept per Freitext' : 'Was hast du gegessen?' }),
      h('p.small.muted.mb', { text: 'Claude schätzt Mengen und Nährwerte – prüfen, anpassen, eintragen. Alles Erkannte landet in „Meine Lebensmittel“.' }),
      ta, h('div.mt', {}, [analyzeBtn]), out,
      h('div.actions', {}, [h('button.btn.block', { text: 'Schließen', onclick: close })]),
    );
    setTimeout(() => ta.focus(), 80);
  });
}

/** KI-Zutat als eigenes Lebensmittel merken (vorhandene mit gleichem Namen wiederverwenden) */
function rememberAiFood(it) {
  const key = (s) => String(s || '').toLowerCase().trim();
  const hit = getFoods().find(f => key(f.name) === key(it.name) && key(f.brand) === key(it.brand));
  if (hit) return hit;
  return saveFood({ name: it.name, brand: it.brand, source: 'ai', per100: { ...it.per100 }, unit: it.unit, portions: [] });
}

// ==================================================================
// Rezepte
// ==================================================================

function renderRecipes(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Essen</span>', onclick: () => navigate('/food') }));
  root.append(h('div.page-head', {}, [
    h('div', {}, [h('div.eyebrow', { text: `${getRecipes().length} Rezepte` }), h('h1', { text: 'Rezepte' })]),
    h('div.row', { style: { gap: '6px' } }, [
      h('button.btn.sm.ghost', { text: 'KI', onclick: () => openAiSheet({ recipeMode: true, onRecipe: (r) => navigate('/food/recipe/' + r.id) }) }),
      h('button.btn.sm.ghost.icon', { 'aria-label': 'Neues Rezept', html: svgIcon.plus, onclick: () => navigate('/food/recipe/new') }),
    ]),
  ]));
  const list = getRecipes();
  if (!list.length) { root.append(h('div.card', {}, [h('p.small.muted', { text: 'Noch keine Rezepte. Per „KI“ in einem Satz beschreiben oder mit „+“ Zutat für Zutat anlegen. Ein Rezept trägst du danach mit zwei Tipps als Portion ein.' })])); return; }
  const card = h('div.card');
  for (const r of list) {
    const t = recipeTotals(r);
    card.append(h('div.food-row', { onclick: () => navigate('/food/recipe/' + r.id) }, [
      h('div.grow', {}, [h('div.truncate', { text: r.name, style: { fontWeight: 600 } }), h('div.small.faint', { text: `${r.servings} Portionen · ${r.items.length} Zutaten · pro Portion ${fmtKcal(t.perServing.kcal)} kcal · ${fmtG(t.perServing.protein)} g P` })]),
      h('div', { html: svgIcon.chevron }),
    ]));
  }
  root.append(card);
}

function renderRecipeEditor(root, { params, navigate }) {
  const isNew = params[0] === 'new';
  const src = isNew ? null : getRecipe(params[0]);
  if (!isNew && !src) { navigate('/food/recipes', true); return; }
  const d = src ? { ...src, items: src.items.map(i => ({ ...i, per100: { ...i.per100 } })) } : { name: '', servings: 4, items: [], note: '' };

  root.append(h('button.back', { html: svgIcon.back + '<span>Rezepte</span>', onclick: () => navigate('/food/recipes') }));
  root.append(h('div.page-head', {}, [h('h1', { text: isNew ? 'Neues Rezept' : 'Rezept' })]));
  const name = h('input.input', { type: 'text', value: d.name, placeholder: 'z.B. Hähnchen-Frischkäse-Pfanne' });
  const serv = h('input.input.num', { type: 'text', inputmode: 'numeric', value: String(d.servings) });
  name.addEventListener('input', () => { d.name = name.value; });
  serv.addEventListener('input', () => { d.servings = Math.max(1, parseInt(serv.value, 10) || 1); drawTotals(); });
  root.append(h('div.row', { style: { gap: '10px' } }, [h('div.field.grow', {}, [h('label', { text: 'Name' }), name]), h('div.field', { style: { width: '90px' } }, [h('label', { text: 'Portionen' }), serv])]));

  root.append(h('div.subhead', {}, [h('h2', { text: 'Zutaten' })]));
  const list = h('div.card');
  const totals = h('div.card.mt');
  root.append(list);
  root.append(h('button.btn.block.mt', { html: svgIcon.plus + '<span>Zutat hinzufügen</span>', onclick: () => openAddSheet(null, curKey, null, { onFood: (f, g) => { d.items.push({ foodId: f.id, name: f.name + (f.brand ? ` (${f.brand})` : ''), grams: g, per100: { ...f.per100 } }); drawList(); } }) }));
  root.append(totals);

  const drawList = () => {
    list.innerHTML = '';
    if (!d.items.length) list.append(h('p.small.muted', { style: { padding: '8px 0' }, text: 'Noch keine Zutaten.' }));
    d.items.forEach((it, i) => {
      const gIn = h('input.input.num', { type: 'text', inputmode: 'decimal', value: String(it.grams), style: { width: '76px', minHeight: '38px' } });
      const kcalEl = h('span.kcal', { text: fmtKcal(macros(it.per100, it.grams).kcal) });
      gIn.addEventListener('input', () => { it.grams = parseNum(gIn.value) || 0; kcalEl.textContent = fmtKcal(macros(it.per100, it.grams).kcal); drawTotals(); });
      list.append(h('div.food-row', {}, [
        h('div.grow', {}, [h('div.truncate', { text: it.name, style: { fontWeight: 600 } }), h('div.small.faint', { text: `${fmtKcal(it.per100.kcal)} kcal · ${fmtG(it.per100.protein)} g P / 100 g` })]),
        gIn, h('span.small.faint', { text: 'g' }), kcalEl,
        h('button.btn.icon.ghost', { html: svgIcon.trash, 'aria-label': 'Zutat entfernen', style: { width: '36px', minHeight: '36px' }, onclick: () => { d.items.splice(i, 1); drawList(); } }),
      ]));
    });
    drawTotals();
  };
  const drawTotals = () => {
    const t = recipeTotals(d);
    totals.innerHTML = '';
    totals.append(
      h('div.small.faint', { text: `Gesamt ${t.grams} g · ${fmtKcal(t.total.kcal)} kcal` }),
      h('div.stats.cols-3.mt', {}, [
        h('div.stat', {}, [h('div.val', { html: `${fmtKcal(t.perServing.kcal)}<small>kcal</small>` }), h('div.lbl', { text: 'pro Portion' })]),
        h('div.stat', {}, [h('div.val', { html: `${fmtG(t.perServing.protein)}<small>g</small>` }), h('div.lbl', { text: 'Protein' })]),
        h('div.stat', {}, [h('div.val', { html: `${t.gramsPerServing}<small>g</small>` }), h('div.lbl', { text: 'Gewicht' })]),
      ]),
      h('p.small.faint.mt', { text: `pro Portion: ${fmtG(t.perServing.carbs)} g KH · ${fmtG(t.perServing.fat)} g Fett · pro 100 g: ${fmtKcal(t.per100.kcal)} kcal` }),
    );
  };
  drawList();

  const saveIt = () => {
    const n = name.value.trim(); if (!n) { name.focus(); toast('Name fehlt'); return null; }
    if (!d.items.length) { toast('Mindestens eine Zutat'); return null; }
    d.name = n;
    const r = saveRecipe({ ...d, items: d.items.filter(i => i.grams > 0) });
    return r;
  };
  root.append(h('div.stack.mt-lg', {}, [
    h('button.btn.primary.block', { text: 'Speichern', onclick: () => { const r = saveIt(); if (r) { toast('Rezept gespeichert'); navigate('/food/recipes'); } } }),
    h('button.btn.good.block', { text: 'Speichern und ins Tagebuch', onclick: () => { const r = saveIt(); if (!r) return; openServingsSheet(r, { servings: 1, meal: 'lunch', onCommit: (n, meal) => { addDiaryEntry(dateKey(), recipeEntry(r, n, meal)); toast('Eingetragen'); navigate('/food'); } }); } }),
    !isNew ? h('button.btn.danger.block', { text: 'Rezept löschen', onclick: async () => { if (await confirmSheet({ title: `„${d.name}“ löschen?`, okLabel: 'Löschen', danger: true })) { deleteRecipe(d.id); toast('Gelöscht'); navigate('/food/recipes'); } } }) : null,
  ]));
}

// ==================================================================
// Meine Lebensmittel
// ==================================================================

function renderMyFoods(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Essen</span>', onclick: () => navigate('/food') }));
  const draw = () => {
    root.querySelector('.foods-list')?.remove();
    root.querySelector('.page-head')?.remove();
    const foods = [...getFoods()].sort((a, b) => (b.favorite - a.favorite) || (b.lastUsed || 0) - (a.lastUsed || 0));
    root.append(h('div.page-head', {}, [
      h('div', {}, [h('div.eyebrow', { text: `${foods.length} gemerkt` }), h('h1', { text: 'Meine Lebensmittel' })]),
      h('button.btn.sm.ghost.icon', { 'aria-label': 'Neu', html: svgIcon.plus, onclick: () => openFoodEditor(null, draw) }),
    ]));
    const box = h('div.foods-list');
    if (!foods.length) box.append(h('div.card', {}, [h('p.small.muted', { text: 'Hier landen eigene Einträge, Open-Food-Facts-Produkte und KI-Schätzungen, die du benutzt hast. Basis-Lebensmittel (Hähnchenbrust, Reis …) sind immer da und tauchen beim Suchen auf.' })]));
    else {
      const card = h('div.card');
      for (const f of foods) card.append(h('div.food-row', { onclick: () => openFoodEditor(f, draw) }, [
        h('button.star' + (f.favorite ? '.on' : ''), { html: svgIcon.star, 'aria-label': 'Favorit', onclick: (e) => { e.stopPropagation(); saveFood({ id: f.id, favorite: !f.favorite }); draw(); } }),
        h('div.grow', {}, [h('div.truncate', { text: f.name + (f.brand ? ` · ${f.brand}` : ''), style: { fontWeight: 600 } }), h('div.small.faint', { text: `${fmtKcal(f.per100.kcal)} kcal · ${fmtG(f.per100.protein)} g P / 100 ${f.unit || 'g'}` + (f.source === 'off' ? ' · Open Food Facts' : f.source === 'ai' ? ' · KI' : '') })]),
        h('div', { html: svgIcon.chevron }),
      ]));
      box.append(card);
    }
    root.append(box);
  };
  draw();
}

// ==================================================================
// Ziele
// ==================================================================

function renderGoals(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Essen</span>', onclick: () => navigate('/food') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Ernährung' }), h('h1', { text: 'Ziele' })])]));
  const s = getSettings();
  const body = h('div');
  root.append(body);

  const draw = () => {
    body.innerHTML = '';
    const st = getSettings();
    const kg = currentWeight();
    const t = targets();
    const num = (key, opts = {}) => { const i = h('input.input.num', { type: 'text', inputmode: 'decimal', value: st[key] ? String(st[key]).replace('.', ',') : '', placeholder: opts.placeholder || '', style: { width: opts.w || '90px' } }); i.addEventListener('change', () => { updateSettings({ [key]: parseNum(i.value) || 0 }); draw(); }); return i; };
    const actSel = h('select.input', {}, ACTIVITY.map(([v, l]) => h('option', { value: String(v), text: l, selected: Number(st.nActivity) === v })));
    actSel.addEventListener('change', () => { updateSettings({ nActivity: Number(actSel.value) }); draw(); });
    const goalSeg = h('div.seg', {}, Object.entries(GOALS).map(([k, g]) => h('button', { text: g.label, class: st.nGoal === k ? 'active' : '', onclick: () => { updateSettings({ nGoal: k, nAdjust: 0 }); draw(); } })));
    const sexSeg = h('div.seg', { style: { width: '130px' } }, [['m', 'Mann'], ['f', 'Frau']].map(([v, l]) => h('button', { text: l, class: (st.sex || 'm') === v ? 'active' : '', onclick: () => { updateSettings({ sex: v }); draw(); } })));
    const adaptIn = h('input', { type: 'checkbox', checked: !!st.nAdaptive }); adaptIn.addEventListener('change', () => { updateSettings({ nAdaptive: adaptIn.checked }); draw(); });

    body.append(h('div.card', {}, [
      row('Körpergewicht', kg ? `${String(kg).replace('.', ',')} kg aus dem Körperlog` : 'Fehlt – unter „Gewicht & Maße“ eintragen', kg ? null : h('button.btn.sm.ghost', { text: 'Eintragen', onclick: () => navigate('/body') })),
      row('Größe', 'cm', num('nHeight', { placeholder: '180', w: '80px' })),
      row('Alter', 'Jahre', num('nAge', { placeholder: '30', w: '80px' })),
      row('Geschlecht', 'für den Grundumsatz', sexSeg),
      row('Aktivität', 'Alltag + Training', null),
      actSel,
    ]));
    body.append(h('div.subhead', {}, [h('h2', { text: 'Ziel' })]));
    body.append(h('div.card', {}, [
      goalSeg,
      row('Protein', 'g pro kg Körpergewicht (1,6–2,2 für Muskelaufbau)', num('nProteinPerKg', { placeholder: '1,8', w: '80px' })),
      row('Kalorien fest', 'leer = aus TDEE berechnen', num('nKcalOverride', { placeholder: 'auto', w: '90px' })),
      h('div.switch', {}, [h('div.grow', {}, [h('div.lbl', { text: 'Automatisch anpassen' }), h('div.desc', { text: 'Wochenschnitt der Kalorien gegen den Gewichtstrend – ±100 kcal, wenn die Waage nicht mitzieht' })]), h('label.toggle', {}, [adaptIn, h('span')])]),
    ]));

    // Ergebnis
    body.append(h('div.subhead', {}, [h('h2', { text: 'Dein Tagesziel' })]));
    if (!t.ready) body.append(h('div.card', {}, [h('p.small.muted', { text: 'Größe, Alter und Körpergewicht eintragen – dann rechnet die App Grundumsatz und Ziel.' })]));
    else {
      const g = GOALS[st.nGoal] || GOALS.gain;
      body.append(h('div.stats', {}, [
        h('div.stat', {}, [h('div.val', { html: `${fmtKcal(t.kcal)}<small>kcal</small>` }), h('div.lbl', { text: 'Kalorien' })]),
        h('div.stat', {}, [h('div.val', { html: `${t.protein}<small>g</small>` }), h('div.lbl', { text: 'Protein' })]),
        h('div.stat', {}, [h('div.val', { html: `${t.carbs}<small>g</small>` }), h('div.lbl', { text: 'Kohlenhydrate' })]),
        h('div.stat', {}, [h('div.val', { html: `${t.fat}<small>g</small>` }), h('div.lbl', { text: 'Fett' })]),
      ]));
      body.append(h('p.small.faint.mt', { text: `Grundumsatz × Aktivität = ${fmtKcal(t.tdee)} kcal` + (st.nKcalOverride ? ' · festes Ziel gesetzt' : ` · ${g.delta >= 0 ? '+' : ''}${g.delta} kcal für ${g.label}`) + (t.adjust ? ` · Anpassung ${t.adjust > 0 ? '+' : ''}${t.adjust} kcal` : '') }));
    }

    // Adaptive Anpassung
    const sug = adaptiveSuggestion();
    const intake = intakeAverage(14), trend = weightTrend(21);
    body.append(h('div.subhead', {}, [h('h2', { text: 'Verlauf & Anpassung' })]));
    body.append(h('div.card' + (sug.ready && sug.delta ? '.alert-card' : ''), {}, [
      h('div.stats.cols-3', {}, [
        h('div.stat', {}, [h('div.val', { html: intake ? `${fmtKcal(intake.kcal)}<small>kcal</small>` : '–' }), h('div.lbl', { text: `Ø ${intake?.days || 0} Tage` })]),
        h('div.stat', {}, [h('div.val', { html: intake ? `${intake.protein}<small>g</small>` : '–' }), h('div.lbl', { text: 'Ø Protein' })]),
        h('div.stat', {}, [h('div.val', { html: trend ? `${trend.perWeek > 0 ? '+' : ''}${String(trend.perWeek).replace('.', ',')}<small>kg/Wo</small>` : '–' }), h('div.lbl', { text: 'Gewichtstrend' })]),
      ]),
      h('p.small.muted.mt', { text: sug.message }),
      sug.ready && sug.delta ? h('button.btn.primary.block.mt', { text: `Ziel ${sug.delta > 0 ? '+' : ''}${sug.delta} kcal übernehmen`, onclick: () => { applyAdjustment(sug.delta); toast('Ziel angepasst'); draw(); } }) : null,
      t.adjust ? h('button.btn.sm.ghost.mt', { text: 'Anpassung zurücksetzen', onclick: () => { updateSettings({ nAdjust: 0, nLastAdjust: 0 }); draw(); } }) : null,
    ]));
  };
  const row = (label, desc, control) => h('div.switch', {}, [h('div.grow', {}, [h('div.lbl', { text: label }), desc ? h('div.desc', { text: desc }) : null]), control]);
  draw();
}
