// Info-Sheet zu einer Übung: animierte Figur ↔ Gerätebild (Maschine/Kabelturm/Hanteln mit Aufsatz und Einstellung), Muskeln, Tipps
import { h, openSheet } from '../util.js';
import { findExercise, exerciseFigure } from '../exercise-db.js';
import { findCustomExercise, MUSCLE_NAME } from '../muscles.js';
import { EQUIPMENT, equipmentSvg } from '../equipment.js';

/**
 * @param {string} name Übungsname (wie im Plan)
 * @param {{note?:string, target?:string}} opts zusätzliche Infos aus dem Plan
 */
export function openExerciseInfo(name, opts = {}) {
  const e = findExercise(name);
  const c = findCustomExercise(name);
  openSheet((sheet, close) => {
    sheet.append(h('h2', { text: name, style: { marginBottom: '6px' } }));
    if (c) {
      sheet.append(h('div.row.mb', {}, [h('span.pill.accent', { text: c.primary.map(k => MUSCLE_NAME[k]).join(', ') + (c.secondary?.length ? ` · ${c.secondary.map(k => MUSCLE_NAME[k]).join(', ')}` : '') })]));
      if (c.tips?.length) {
        sheet.append(h('div.subhead', { style: { margin: '6px 0 10px' } }, [h('h2', { text: 'Ausführung' })]));
        sheet.append(h('ol.tips', {}, c.tips.map(t => h('li', { text: t }))));
      } else sheet.append(h('p.small.muted', { text: 'Eigene Übung – Tipps kannst du in der Bibliothek ergänzen.' }));
    } else if (e) {
      sheet.append(h('div.row.mb', {}, [h('span.pill.accent', { text: e.muscles })]));
      // Bewegung ↔ Gerät: Tipp auf das Bild wechselt
      const hero = h('div.fig-hero', { html: exerciseFigure(e, { animate: true }) });
      const eq = e.equip && EQUIPMENT[e.equip.type];
      if (eq) {
        const eqBox = h('div.equip-box', { hidden: true }, [
          h('div.equip-hero', { html: equipmentSvg(e.equip.type) }),
          h('div.equip-name', { text: eq.name }),
          h('div.small.muted', { text: eq.desc }),
          e.equip.attachment ? h('div.equip-line', {}, [h('span.lbl', { text: 'Aufsatz / Griff' }), h('span', { text: e.equip.attachment })]) : null,
          e.equip.setup ? h('div.equip-line', {}, [h('span.lbl', { text: 'Einstellung' }), h('span', { text: e.equip.setup })]) : null,
        ]);
        const seg = h('div.seg.mb', {}, [
          h('button.active', { text: 'Bewegung', onclick: (ev) => { hero.hidden = false; eqBox.hidden = true; for (const b of ev.target.parentNode.children) b.classList.toggle('active', b === ev.target); } }),
          h('button', { text: 'Gerät', onclick: (ev) => { hero.hidden = true; eqBox.hidden = false; for (const b of ev.target.parentNode.children) b.classList.toggle('active', b === ev.target); } }),
        ]);
        hero.addEventListener('click', () => seg.children[1].click());
        hero.style.cursor = 'pointer';
        sheet.append(seg, hero, eqBox);
      } else sheet.append(hero);
      sheet.append(h('div.subhead', { style: { margin: '6px 0 10px' } }, [h('h2', { text: 'Ausführung' })]));
      sheet.append(h('ol.tips', {}, e.tips.map(t => h('li', { text: t }))));
    } else {
      sheet.append(h('p.muted', { text: 'Für diese Übung gibt es noch keine Bibliotheksinfo. Tipp: Namen wie im Plan verwenden (z.B. „Latzug“, „Beinpresse“).' }));
    }
    if (opts.target) sheet.append(h('p.small.faint.mt', { text: 'Im Plan: ' + opts.target }));
    if (opts.note) sheet.append(h('div.card.mt', { style: { padding: '10px 12px' } }, [h('div.small.faint', { text: 'Hinweis aus dem Plan' }), h('div', { text: opts.note })]));
    sheet.append(h('div.actions', {}, [h('button.btn.block', { text: 'Schließen', onclick: close })]));
  });
}

/** Kleines statisches Vorschaubild (Endposition) – leer, wenn unbekannt */
export function figureThumb(name) {
  const svg = exerciseFigure(name, { animate: false, pose: 1 });
  return svg ? h('div.fig-thumb', { html: svg }) : null;
}
