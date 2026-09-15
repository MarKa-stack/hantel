// Fortschrittsfotos: Galerie nach Monat, Vorher/Nachher-Vergleich mit Schieberegler, alles nur lokal (IndexedDB)
import { h, svgIcon, fmtDate, fmtShortDate, openSheet, confirmSheet, toast, parseNum } from '../util.js';
import { getBodyLog } from '../store.js';
import { listPhotos, addPhoto, updatePhoto, deletePhoto, POSES, POSE_NAME } from '../photos.js';

let lastPose = 'front';
let cmpPose = null;
let cmpA = null, cmpB = null; // ausgewählte Foto-IDs für den Vergleich

export function render(root, { navigate }) {
  root.append(h('button.back', { html: svgIcon.back + '<span>Zurück</span>', onclick: () => { if (history.length > 1) history.back(); else navigate('/progress'); } }));
  const fileIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  fileIn.addEventListener('change', () => { const f = fileIn.files[0]; fileIn.value = ''; if (f) openAddSheet(f, draw); });
  const head = h('div.page-head', {}, [
    h('div', {}, [h('div.eyebrow', { text: 'Körper' }), h('h1', { text: 'Fortschrittsfotos' })]),
    h('button.btn.sm.ghost.icon', { 'aria-label': 'Foto hinzufügen', html: svgIcon.plus, onclick: () => fileIn.click() }),
  ]);
  const body = h('div');
  root.append(head, fileIn, body);

  const draw = async () => {
    body.innerHTML = '';
    let photos;
    try { photos = await listPhotos(); } catch { body.append(h('div.card', {}, [h('p.small.muted', { text: 'Fotos können auf diesem Gerät nicht gespeichert werden (kein IndexedDB).' })])); return; }
    head.querySelector('.eyebrow').textContent = photos.length ? `${photos.length} Foto${photos.length === 1 ? '' : 's'} · nur auf diesem Gerät` : 'Körper';

    if (!photos.length) {
      body.append(h('div.card', {}, [
        h('p.muted', { text: 'Ein Foto pro Monat reicht: gleiche Pose, gleiches Licht, gleiche Uhrzeit – dann siehst du im Vorher/Nachher-Vergleich, was die Zahlen nicht zeigen.' }),
        h('p.small.faint.mt', { text: 'Die Fotos bleiben nur auf diesem iPhone (nicht in Sicherung oder Cloud-Backup).' }),
        h('button.btn.primary.block.mt', { html: svgIcon.plus + '<span>Erstes Foto aufnehmen</span>', onclick: () => fileIn.click() }),
      ]));
      return;
    }

    // ---- Vergleich ----
    const byPose = Object.fromEntries(POSES.map(([k]) => [k, photos.filter(p => p.pose === k)]));
    const cmpPoses = POSES.filter(([k]) => byPose[k].length >= 2);
    if (cmpPoses.length) {
      if (!cmpPose || !byPose[cmpPose] || byPose[cmpPose].length < 2) cmpPose = cmpPoses[0][0];
      const card = h('div.card');
      const seg = cmpPoses.length > 1 ? h('div.seg', {}, cmpPoses.map(([k, l]) => h('button', { text: l, class: cmpPose === k ? 'active' : '', onclick: () => { cmpPose = k; cmpA = cmpB = null; drawCmp(); for (const b of seg.children) b.classList.toggle('active', b.textContent === l); } }))) : null;
      const box = h('div');
      card.append(h('div.row.between', {}, [h('b', { text: 'Vorher / Nachher' }), seg]), box);
      const drawCmp = () => {
        const list = byPose[cmpPose];
        if (!list.some(p => p.id === cmpA)) cmpA = list[0].id;
        if (!list.some(p => p.id === cmpB) || cmpB === cmpA) cmpB = list[list.length - 1].id;
        const a = list.find(p => p.id === cmpA), b = list.find(p => p.id === cmpB);
        box.innerHTML = '';
        box.append(compareSlider(a, b));
        const pick = (which) => {
          const sel = h('select.input', { style: { minHeight: '38px', padding: '6px 10px' } }, list.map(p => h('option', { value: p.id, text: fmtShortDate(p.date) + (p.weight ? ` · ${fmtKg(p.weight)}` : ''), selected: p.id === (which === 'a' ? cmpA : cmpB) })));
          sel.addEventListener('change', () => { if (which === 'a') cmpA = sel.value; else cmpB = sel.value; drawCmp(); });
          return sel;
        };
        box.append(h('div.row.mt', { style: { gap: '8px' } }, [pick('a'), h('span.faint', { text: '→' }), pick('b')]));
        const days = Math.round((b.date - a.date) / 86400000);
        const span = days >= 60 ? `${Math.round(days / 30)} Monate` : days >= 14 ? `${Math.round(days / 7)} Wochen` : `${days} Tag${days === 1 ? '' : 'e'}`;
        const w = a.weight && b.weight ? ` · ${fmtKg(a.weight)} → ${fmtKg(b.weight)} (${b.weight - a.weight >= 0 ? '+' : '−'}${fmtKg(Math.abs(b.weight - a.weight))})` : '';
        box.append(h('p.small.faint.mt', { text: `${fmtDate(a.date)} → ${fmtDate(b.date)} · ${span}${w}` }));
      };
      drawCmp();
      body.append(card);
    } else {
      body.append(h('p.small.faint', { text: 'Ab zwei Fotos derselben Pose gibt es den Vorher/Nachher-Vergleich.' }));
    }

    // ---- Galerie nach Monat ----
    const groups = new Map();
    for (const p of [...photos].reverse()) {
      const d = new Date(p.date), key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!groups.has(key)) groups.set(key, { label: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), list: [] });
      groups.get(key).list.push(p);
    }
    for (const g of groups.values()) {
      body.append(h('div.subhead', {}, [h('h2', { text: g.label })]));
      body.append(h('div.photo-grid', {}, g.list.map(p => h('button.ph', { 'aria-label': `${POSE_NAME[p.pose]} ${fmtDate(p.date)}`, onclick: () => openViewer(p, draw) }, [
        h('img', { src: p.thumb, alt: '', loading: 'lazy' }),
        h('span.ph-tag', { text: `${POSE_NAME[p.pose]} · ${fmtShortDate(p.date)}` }),
      ]))));
    }
    body.append(h('p.small.faint.mt', { text: 'Fotos liegen nur auf diesem Gerät – nicht in Sicherung oder Cloud-Backup.' }));
  };
  draw();
}

function fmtKg(v) { return String(Math.round(v * 10) / 10).replace('.', ',') + ' kg'; }

/** Vorher/Nachher: beide Bilder übereinander, rechtes Bild per clip-path ab Trennlinie sichtbar; Finger zieht die Linie */
function compareSlider(a, b) {
  const after = h('img.after', { src: b.full, alt: 'Nachher', draggable: false });
  const bar = h('div.bar'), knob = h('div.knob', { html: svgIcon.chevron + svgIcon.chevron });
  const box = h('div.cmp', {}, [
    h('img', { src: a.full, alt: 'Vorher', draggable: false }), after, bar, knob,
    h('span.tag.l', { text: 'Vorher' }), h('span.tag.r', { text: 'Nachher' }),
  ]);
  const set = (x) => { const p = Math.max(2, Math.min(98, x)); after.style.clipPath = `inset(0 0 0 ${p}%)`; bar.style.left = knob.style.left = p + '%'; };
  set(50);
  const move = (ev) => { const r = box.getBoundingClientRect(); set((ev.clientX - r.left) / r.width * 100); };
  box.addEventListener('pointerdown', (ev) => { box.setPointerCapture(ev.pointerId); move(ev); });
  box.addEventListener('pointermove', (ev) => { if (ev.buttons || ev.pointerType === 'touch') move(ev); });
  return box;
}

function toDateInput(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fromDateInput(v) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); }
/** Körpergewicht aus dem Log, das dem Datum am nächsten liegt (max. 2 Tage) */
function weightNear(ts) {
  let best = null;
  for (const e of getBodyLog()) if (e.weight != null && Math.abs(e.date - ts) <= 2 * 86400000 && (!best || Math.abs(e.date - ts) < Math.abs(best.date - ts))) best = e;
  return best?.weight ?? null;
}

function openAddSheet(file, onDone) {
  openSheet((sheet, close) => {
    const preview = h('img.ph-preview', { alt: '' });
    preview.src = URL.createObjectURL(file);
    let pose = lastPose;
    const poseSeg = h('div.seg.mt', {}, POSES.map(([k, l]) => h('button', { text: l, class: pose === k ? 'active' : '', onclick: (e) => { pose = k; for (const x of e.target.parentNode.children) x.classList.toggle('active', x === e.target); } })));
    const dateIn = h('input.input', { type: 'date', value: toDateInput(Date.now()), max: toDateInput(Date.now()) });
    const weightIn = h('input.input.num', { type: 'text', inputmode: 'decimal', placeholder: '–', value: weightNear(Date.now()) ?? '' });
    dateIn.addEventListener('change', () => { const w = weightNear(fromDateInput(dateIn.value)); if (w != null) weightIn.value = String(w); });
    const noteIn = h('input.input', { type: 'text', placeholder: 'z.B. nach 8 Wochen Diät' });
    const save = h('button.btn.primary.block.mt', { text: 'Speichern' });
    save.addEventListener('click', async () => {
      save.disabled = true; save.textContent = 'Speichere …';
      try {
        await addPhoto(file, { date: fromDateInput(dateIn.value || toDateInput(Date.now())), pose, note: noteIn.value.trim(), weight: parseNum(weightIn.value) });
        lastPose = pose; close(); toast('Foto gespeichert'); onDone();
      } catch (e) { save.disabled = false; save.textContent = 'Speichern'; toast(e.message || 'Speichern fehlgeschlagen'); }
    });
    sheet.append(
      h('h3', { text: 'Foto hinzufügen' }),
      preview, poseSeg,
      h('div.grid-2.mt', {}, [h('div.field', {}, [h('label', { text: 'Datum' }), dateIn]), h('div.field', {}, [h('label', { text: 'Gewicht (kg)' }), weightIn])]),
      h('div.field.mt', {}, [h('label', { text: 'Notiz' }), noteIn]),
      save,
    );
  });
}

function openViewer(p, onDone) {
  openSheet((sheet, close) => {
    sheet.append(
      h('div.row.between', {}, [
        h('div', {}, [h('b', { text: `${POSE_NAME[p.pose]} · ${fmtDate(p.date)}` }), h('div.small.faint', { text: [p.weight ? fmtKg(p.weight) : null, p.note || null].filter(Boolean).join(' · ') || 'Keine Notiz' })]),
        h('button.btn.sm.ghost', { text: 'Fertig', onclick: close }),
      ]),
      h('img.ph-full', { src: p.full, alt: '' }),
      h('div.seg.mt', {}, POSES.map(([k, l]) => h('button', { text: l, class: p.pose === k ? 'active' : '', onclick: async (e) => { await updatePhoto(p.id, { pose: k }); p.pose = k; for (const x of e.target.parentNode.children) x.classList.toggle('active', x === e.target); onDone(); } }))),
      h('button.btn.danger.block.mt', { text: 'Foto löschen', onclick: async () => {
        if (await confirmSheet({ title: 'Foto löschen?', okLabel: 'Löschen', danger: true })) { await deletePhoto(p.id); close(); toast('Gelöscht'); onDone(); }
      } }),
    );
  });
}
