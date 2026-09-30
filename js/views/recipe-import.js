// Rezepte übernehmen: Links (Cookidoo, Fddb) oder Text – einzeln oder alle auf einmal.
import { h, svgIcon, toast, confirmSheet } from '../util.js';
import { saveRecipe, getRecipes } from '../store.js';
import { fmtKcal, fmtG, recipeTotals } from '../nutrition.js';
import { aiReady } from '../llm.js';
import { recipeLinks, fetchRecipe, parseYield, parseRecipesBatch, ingredientsToItems, toRecipeDraft, importerReady } from '../recipe-import.js';

let mode = 'links';

export function render(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Rezepte</span>', onclick: () => navigate('/food/recipes') }));
  root.append(h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'Import' }), h('h1', { text: 'Rezepte übernehmen' })])]));
  const body = h('div');
  root.append(body);

  // ---------- Schritt 1: Quelle ----------
  const drawPicker = () => {
    body.innerHTML = '';
    const seg = h('div.seg', {}, [
      h('button', { text: 'Links', class: mode === 'links' ? 'active' : '', onclick: () => { mode = 'links'; drawPicker(); } }),
      h('button', { text: 'Text', class: mode === 'text' ? 'active' : '', onclick: () => { mode = 'text'; drawPicker(); } }),
    ]);
    const area = h('textarea.input.mt', {
      rows: 8,
      placeholder: mode === 'links'
        ? 'Einen Link pro Zeile:\n\nhttps://fddb.info/db/de/listen/123456_mein_rezept/index.html\nhttps://cookidoo.de/recipes/recipe/de-DE/r59322'
        : 'Rezepte als Text einfügen – mehrere durch eine Leerzeile oder „---“ trennen:\n\nChili con carne (4 Portionen)\n500 g Rinderhack\n400 g Kidneybohnen\n800 g Tomaten stückig\n\n---\n\nPorridge (1 Portion)\n60 g Haferflocken\n250 ml Milch',
      style: { minHeight: '180px', fontSize: '15px' },
    });
    const hint = h('p.small.faint.mt', {
      text: mode === 'links'
        ? 'Fddb: Rezept öffnen → Teilen → Link kopieren (fddb.info/db/de/listen/…). Cookidoo: Rezept → Teilen → Link kopieren. Du kannst auch einen ganzen Text einfügen – alle enthaltenen Links werden erkannt.'
        : 'Aus jeder App kopierbar: Name, Portionen und die Zutaten mit Mengen. Die KI rechnet Mengen und Nährwerte aus; mehrere Rezepte auf einmal sind kein Problem.',
    });
    const go = h('button.btn.primary.block.mt', { html: svgIcon.sparkle + `<span>${mode === 'links' ? 'Rezepte laden' : 'Text auswerten'}</span>` });
    go.addEventListener('click', () => (mode === 'links' ? loadLinks(area.value) : loadText(area.value)));
    body.append(seg, area, hint, go);
    if (mode === 'links' && !importerReady()) body.append(h('p.small.muted.mt', { text: 'Links braucht den Hantel-Server (Mehr → KI → Hantel-Server). Ohne Server geht der Weg über „Text“.' }));
    if (!aiReady()) body.append(h('p.small.muted.mt', { text: 'Für Mengen und Nährwerte braucht es einen KI-Zugang (Mehr → KI).' }));
  };

  const busyCard = (text) => {
    body.innerHTML = '';
    const status = h('div.muted', { text });
    const bar = h('div.progress-line', {}, [h('i')]);
    body.append(h('div.card', {}, [h('div.row', {}, [h('div.spinner'), status]), bar]));
    return { status, bar: bar.firstChild };
  };

  const fail = (e) => {
    body.innerHTML = '';
    body.append(h('div.card', { style: { borderColor: 'var(--danger)' } }, [
      h('h3', { text: 'Import fehlgeschlagen' }),
      h('p.muted.mt', { text: e.message || String(e) }),
      h('button.btn.block.mt', { text: 'Nochmal versuchen', onclick: drawPicker }),
    ]));
  };

  // ---------- Schritt 2a: Links holen ----------
  const loadLinks = async (raw) => {
    const links = recipeLinks(raw);
    if (!links.length) { toast('Keine Cookidoo- oder Fddb-Links gefunden'); return; }
    const { status, bar } = busyCard(`0 von ${links.length} geladen …`);
    const found = [], failed = [];
    for (let i = 0; i < links.length; i++) {
      try { found.push(await fetchRecipe(links[i])); }
      catch (e) { failed.push({ url: links[i], error: e.message }); }
      status.textContent = `${i + 1} von ${links.length} geladen …`;
      bar.style.width = `${Math.round((i + 1) / links.length * 100)}%`;
    }
    if (!found.length) { fail(new Error(failed[0]?.error || 'Keine Rezepte gefunden.')); return; }
    drawPick(found.map(r => ({
      pick: true, src: r, name: r.name, servings: parseYield(r.yieldText).servings,
      count: r.ingredients.length, kcal: r.perServing?.kcal ? Math.round(r.perServing.kcal) : null,
      label: r.sourceLabel || 'Link',
    })), failed, 'links');
  };

  // ---------- Schritt 2b: Text auswerten ----------
  const loadText = async (raw) => {
    if (raw.trim().length < 10) { toast('Bitte Rezepttext einfügen'); return; }
    const { status, bar } = busyCard('KI liest die Rezepte … (10–40 s)');
    bar.style.width = '45%';
    try {
      const parsed = await parseRecipesBatch({ rawText: raw });
      if (!parsed.length) { fail(new Error('Im Text wurde kein Rezept mit Zutaten erkannt.')); return; }
      status.textContent = 'fertig';
      drawPick(parsed.map(r => ({
        pick: true, parsed: r, name: r.name, servings: r.servings, count: r.items.length,
        kcal: Math.round(recipeTotals({ ...r, items: r.items }).perServing.kcal), label: 'Text',
      })), [], 'text');
    } catch (e) { fail(e); }
  };

  // ---------- Schritt 3: auswählen ----------
  const drawPick = (rows, failed, kind) => {
    body.innerHTML = '';
    const existing = new Set(getRecipes().map(r => r.name.trim().toLowerCase()));
    body.append(h('p.muted', { html: `<b>${rows.length} Rezept${rows.length === 1 ? '' : 'e'}</b> gefunden. Wähle aus, was übernommen werden soll.` }));
    const card = h('div.card');
    const count = h('span');
    const refresh = () => { const n = rows.filter(r => r.pick).length; count.textContent = String(n); btn.disabled = !n; };
    for (const row of rows) {
      const cb = h('input', { type: 'checkbox', checked: row.pick });
      cb.addEventListener('change', () => { row.pick = cb.checked; refresh(); });
      const dup = existing.has(row.name.trim().toLowerCase());
      card.append(h('div.pick-row', {}, [
        h('label.toggle', {}, [cb, h('span')]),
        h('div.grow.min0', {}, [
          h('div.clamp2', { text: row.name, style: { fontWeight: 600 } }),
          h('div.small.faint', { text: [`${row.servings} Portion${row.servings === 1 ? '' : 'en'}`, `${row.count} Zutaten`, row.kcal ? `${fmtKcal(row.kcal)} kcal/Portion` : null, row.label].filter(Boolean).join(' · ') + (dup ? ' · schon vorhanden' : '') }),
        ]),
      ]));
    }
    body.append(card);
    if (failed.length) {
      body.append(h('details.raw.mt', {}, [
        h('summary', { text: `${failed.length} Link${failed.length === 1 ? '' : 's'} nicht geladen` }),
        h('pre', { text: failed.map(f => `${f.url}\n  ${f.error}`).join('\n') }),
      ]));
    }
    const btn = h('button.btn.primary.block', { style: { minHeight: '56px', fontSize: '17px' } }, [h('span', { text: 'Übernehmen (' }), count, h('span', { text: ')' })]);
    btn.addEventListener('click', () => (kind === 'links' ? importLinks(rows.filter(r => r.pick)) : importParsed(rows.filter(r => r.pick))));
    body.append(h('div.stack.mt-lg', {}, [
      h('div.row', { style: { gap: '8px' } }, [
        h('button.btn.sm.ghost.grow', { text: 'Alle', onclick: () => { for (const r of rows) r.pick = true; drawPick(rows, failed, kind); } }),
        h('button.btn.sm.ghost.grow', { text: 'Keins', onclick: () => { for (const r of rows) r.pick = false; drawPick(rows, failed, kind); } }),
      ]),
      btn,
      h('button.btn.ghost.block', { text: 'Abbrechen', onclick: drawPicker }),
    ]));
    refresh();
  };

  // ---------- Schritt 4: speichern ----------
  const importParsed = (rows) => {
    let n = 0;
    for (const row of rows) {
      const r = row.parsed;
      saveRecipe({ name: r.name, servings: r.servings, items: r.items, note: r.note || '', source: 'text', variations: [] });
      n++;
    }
    done(n);
  };

  const importLinks = async (rows) => {
    const { status, bar } = busyCard('KI rechnet Mengen und Nährwerte aus … (10–60 s)');
    let n = 0;
    try {
      // In Blöcken zu 6: ein KI-Aufruf für mehrere Rezepte spart Anfragen
      for (let i = 0; i < rows.length; i += 6) {
        const chunk = rows.slice(i, i + 6);
        status.textContent = `Rezept ${i + 1}–${Math.min(rows.length, i + chunk.length)} von ${rows.length} …`;
        bar.style.width = `${Math.round(i / rows.length * 100)}%`;
        let parsed = [];
        try { parsed = await parseRecipesBatch({ recipes: chunk.map(c => c.src) }); } catch { parsed = []; }
        for (let k = 0; k < chunk.length; k++) {
          const src = chunk[k].src;
          let items = parsed.length === chunk.length ? parsed[k].items : null;
          if (!items) { // Zuordnung unklar → dieses Rezept einzeln nachrechnen
            try { items = await ingredientsToItems(src.ingredients, { servings: parseYield(src.yieldText).servings, name: src.name }); }
            catch { continue; }
          }
          saveRecipe(toRecipeDraft(src, items));
          n++;
        }
      }
      bar.style.width = '100%';
      done(n);
    } catch (e) { fail(e); }
  };

  const done = (n) => {
    toast(n ? `${n} Rezept${n === 1 ? '' : 'e'} übernommen – bitte Mengen prüfen` : 'Nichts übernommen', { duration: 5000 });
    navigate('/food/recipes');
  };

  drawPicker();
}
