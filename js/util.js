// Kleine Helfer: IDs, DOM, Formatierung, Toast, Modal

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Element-Builder: h('div.card', {onclick}, [children]) */
export function h(tag, attrs = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** SVG-Element-Builder (Namespace-korrekt) */
export function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) el.append(c);
  return el;
}

export const svgIcon = {
  chevron: '<svg class="chev" viewBox="0 0 24 24"><path d="M9.3 6.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4L13.2 12 9.3 8.1a1 1 0 0 1 0-1.4z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M14.7 6.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l4.6 4.6a1 1 0 0 0 1.4-1.4L10.8 12l3.9-3.9a1 1 0 0 0 0-1.4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5a1 1 0 1 0-1.4 1.4l4.2 4.2a1 1 0 0 0 1.4 0L20 8a1 1 0 1 0-1.4-1.4L9 16.2z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1zm1 2v0h4V5h-4zM7 7v13h10V7H7zm3 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1z"/></svg>',
  drag: '<svg viewBox="0 0 24 24"><path d="M9 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM9 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM9 20a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.4l-2.35-2.35a1 1 0 0 0-1.4 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>',
};

// ---------- Formatierung ----------

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m >= 60) {
    const hh = Math.floor(m / 60), mm = m % 60;
    return `${hh}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDurationLong(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function fmtDate(ts, opts = {}) {
  const d = new Date(ts);
  const day = d.getDate(), mon = MONTHS[d.getMonth()];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  let s = `${WEEKDAYS[d.getDay()]}, ${day}. ${mon}`;
  if (!sameYear || opts.year) s += ` ${d.getFullYear()}`;
  if (opts.time) s += ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}

export function fmtShortDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function dateParts(ts) {
  const d = new Date(ts);
  return { d: d.getDate(), m: MONTHS[d.getMonth()] };
}

export function fmtWeight(w, unit = 'kg') {
  if (w == null || w === '' || isNaN(w)) return '–';
  const n = Number(w);
  return (Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')) + ' ' + unit;
}

export function fmtNum(n) {
  return new Intl.NumberFormat('de-DE').format(Math.round(n));
}

export function relativeDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - d) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  return fmtDate(ts);
}

/** ISO-Woche als Schlüssel "2026-W37" plus Montag der Woche */
export function weekKey(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseNum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** "8-12" → 12 (obere Grenze), "10" → 10, "AMRAP" → null */
export function repsToNumber(reps) {
  const m = String(reps ?? '').match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!m) return null;
  return parseInt(m[2] || m[1], 10);
}

// ---------- Toast ----------

let toastTimer = null;
export function toast(msg, opts = {}) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  el.innerHTML = '';
  el.className = 'toast' + (opts.action ? ' action' : '');
  el.append(document.createTextNode(msg));
  if (opts.action) {
    const b = h('button', { text: opts.action.label, onclick: () => { el.hidden = true; opts.action.fn(); } });
    el.append(b);
  }
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, opts.duration || (opts.action ? 6000 : 2200));
}

// ---------- Modal / Bottom Sheet ----------

export function openSheet(build) {
  const root = document.getElementById('modal-root');
  const backdrop = h('div.modal-backdrop');
  const sheet = h('div.modal');
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  build(sheet, close);
  backdrop.append(sheet);
  root.append(backdrop);
  return close;
}

export function confirmSheet({ title, text, okLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    openSheet((sheet, close) => {
      sheet.append(
        h('h2', { text: title }),
        text ? h('p.muted', { text }) : null,
        h('div.actions', {}, [
          h('button.btn.ghost', { text: 'Abbrechen', onclick: () => { close(); resolve(false); } }),
          h('button.btn' + (danger ? '.danger' : '.primary'), { text: okLabel, onclick: () => { close(); resolve(true); } }),
        ])
      );
    });
  });
}

export function promptSheet({ title, label, value = '', placeholder = '', okLabel = 'Speichern' }) {
  return new Promise((resolve) => {
    openSheet((sheet, close) => {
      const input = h('input.input', { type: 'text', value, placeholder, autocomplete: 'off' });
      const submit = () => { const v = input.value.trim(); if (!v) return; close(); resolve(v); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      sheet.append(
        h('h2', { text: title }),
        h('div.field', {}, [label ? h('label', { text: label }) : null, input]),
        h('div.actions', {}, [
          h('button.btn.ghost', { text: 'Abbrechen', onclick: () => { close(); resolve(null); } }),
          h('button.btn.primary', { text: okLabel, onclick: submit }),
        ])
      );
      setTimeout(() => input.focus(), 50);
    });
  });
}

export function actionSheet(title, actions) {
  return openSheet((sheet, close) => {
    if (title) sheet.append(h('h2', { text: title }));
    const list = h('div.stack');
    for (const a of actions) {
      list.append(h('button.btn.block' + (a.danger ? '.danger' : '.ghost'), {
        text: a.label,
        onclick: () => { close(); a.fn(); },
      }));
    }
    list.append(h('button.btn.block', { text: 'Abbrechen', onclick: close }));
    sheet.append(list);
  });
}

// ---------- Haptik ----------

export function haptic(pattern = 10) {
  try { navigator.vibrate?.(pattern); } catch { /* iOS ignoriert das */ }
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}
