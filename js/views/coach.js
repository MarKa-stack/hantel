// Dein Coach: wöchentlicher KI-Bericht (Was lief gut · Darauf achten · Nächste Woche · Fokus)
import { h, svgIcon, fmtDate, toast, iconBox } from '../util.js';
import { getCoachReport, generateCoachReport, coachDue } from '../coach.js';
import { aiReady } from '../llm.js';
import { getSessions } from '../store.js';

const GRADE = { top: ['Starke Woche', 'good'], gut: ['Gute Woche', 'good'], ok: ['Solide Woche', 'warn'], schwach: ['Ruhige Woche', 'neutral'] };

export function render(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Fortschritt</span>', onclick: () => navigate('/progress') }));
  const head = h('div.page-head', {}, [h('div', {}, [h('div.eyebrow', { text: 'KI-Wochenbericht' }), h('h1', { text: 'Dein Coach' })])]);
  const body = h('div');
  root.append(head, body);

  const run = async (btn) => {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Coach liest deine Woche …</span>'; }
    body.classList.add('busy');
    try { await generateCoachReport(); toast('Wochenbericht erstellt'); draw(); }
    catch (e) { toast(e.message || 'Fehlgeschlagen', { duration: 7000 }); draw(); }
  };

  const draw = () => {
    body.innerHTML = ''; body.classList.remove('busy');
    const rep = getCoachReport();
    const sessions = getSessions();

    if (!rep) {
      const canRun = aiReady() && sessions.length > 0;
      body.append(h('div.card', {}, [
        h('p.muted', { text: 'Einmal pro Woche schaut der Coach auf deine Trainings, Rekorde, stagnierende Übungen, die Sätze je Muskelgruppe, Erholung, Gewicht und Ernährung – und sagt dir in ein paar Sätzen, was gut lief und was du nächste Woche konkret machst.' }),
        h('p.small.faint.mt', { text: 'Es gehen nur Kennzahlen an die KI (Sätze, Gewichte, Übungsnamen, Wochenwerte) – keine Fotos, keine Notizen außer Trainingsnotizen.' }),
        !aiReady() ? h('p.small.muted.mt', { text: 'Dafür braucht es einen KI-Zugang: Mehr → KI (optional).' }) : !sessions.length ? h('p.small.muted.mt', { text: 'Sobald du dein erstes Training abgeschlossen hast, geht es los.' }) : null,
        h('button.btn.primary.block.mt', { html: svgIcon.sparkle + '<span>Ersten Wochenbericht erstellen</span>', disabled: !canRun, onclick: (e) => run(e.currentTarget) }),
      ]));
      return;
    }

    const [gradeLabel, gradeVariant] = GRADE[rep.grade] || GRADE.ok;
    head.querySelector('.eyebrow').textContent = `KW ${rep.kw} · ${fmtDate(rep.at)}`;

    // Kopf: Note + Kernsatz
    body.append(h('div.card.coach-hero', {}, [
      h('div.row', { style: { gap: '10px', alignItems: 'center' } }, [iconBox('sparkle', gradeVariant), h('span.pill', { class: gradeVariant, text: gradeLabel }), rep.trainings != null ? h('span.small.faint', { text: `${rep.trainings} Training${rep.trainings === 1 ? '' : 's'} in 7 Tagen` }) : null]),
      h('p.coach-headline', { text: rep.headline }),
      rep.focus ? h('div.coach-focus', {}, [h('span.small.faint', { text: 'Fokus' }), h('b', { text: rep.focus })]) : null,
    ]));

    if (coachDue()) {
      body.append(h('div.card.alert-card.row-card', {}, [
        h('div.row.between', {}, [
          h('div', {}, [h('b', { text: 'Neue Woche, neue Daten' }), h('div.small.muted', { text: 'Seit diesem Bericht hast du weiter trainiert.' })]),
          h('button.btn.sm.primary', { text: 'Aktualisieren', onclick: (e) => run(e.currentTarget) }),
        ]),
      ]));
    }

    if (rep.wins?.length) {
      body.append(h('div.subhead', {}, [h('h2', { text: 'Was lief gut' })]));
      body.append(h('div.card', {}, rep.wins.map(t => h('div.coach-item', {}, [h('span.coach-dot.good', { html: svgIcon.check }), h('div', { text: t })]))));
    }
    if (rep.watch?.length) {
      body.append(h('div.subhead', {}, [h('h2', { text: 'Darauf achten' })]));
      body.append(h('div.card', {}, rep.watch.map(t => h('div.coach-item', {}, [h('span.coach-dot.warn', { html: svgIcon.warning }), h('div', { text: t })]))));
    }
    if (rep.next?.length) {
      body.append(h('div.subhead', {}, [h('h2', { text: 'Nächste Woche' })]));
      body.append(h('div.card', {}, rep.next.map((n, i) => h('div.coach-item', {}, [h('span.coach-num', { text: String(i + 1) }), h('div', {}, [h('div', { text: n.title, style: { fontWeight: 700 } }), n.detail ? h('div.small.muted', { text: n.detail }) : null])]))));
    }

    body.append(h('div.stack.mt-lg', {}, [
      h('button.btn.ghost.block', { html: svgIcon.sparkle + '<span>Bericht neu erstellen</span>', disabled: !aiReady(), onclick: (e) => run(e.currentTarget) }),
      h('p.small.faint.center', { text: 'KI-Einschätzung auf Basis deiner Trainingsdaten – kein medizinischer Rat.' }),
    ]));
  };
  draw();
}
