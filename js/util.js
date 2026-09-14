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
  // ---- Premium-Icon-Set (ersetzen Emoji) ----
  trophy: '<svg class="ico" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
  book: '<svg class="ico" viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>',
  clipboard: '<svg class="ico" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
  calendar: '<svg class="ico" viewBox="0 0 24 24"><path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13zM6 10h4v4H6z"/></svg>',
  scale: '<svg class="ico" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM12 6a4 4 0 0 0-4 4c0 .32.04.62.11.92L10 12.6l2-1.72 2 1.72 1.89-1.68c.07-.3.11-.6.11-.92a4 4 0 0 0-4-4zm-3 9h6v1.5H9zm0-2.5h6V14H9z"/></svg>',
  dumbbell: '<svg class="ico" viewBox="0 0 24 24"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>',
  flame: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 23c-3.87 0-7-3.13-7-7 0-2.7 1.5-5.1 3.7-6.3-.2 1.6.3 3.2 1.4 4.3.6-3.7 2.6-6.3 5.1-8.3-.4 2.7 1 4.8 2.5 6.7.9 1.1 1.3 2.3 1.3 3.6 0 3.87-3.13 7-7 7zm0-2c2.76 0 5-2.24 5-5 0-.9-.3-1.7-.9-2.5-.5-.6-1.1-1.3-1.5-2.1-.9 1.2-1.7 2.6-2 4.3-1.3-.6-2.1-1.5-2.4-2.6C9.4 14 9 14.9 9 16c0 2.76 2.24 5 3 5z"/></svg>',
  chart: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8z"/></svg>',
  body: '<svg class="ico" viewBox="0 0 24 24"><path d="M20.5 6c-2.61.7-5.67 1-8.5 1s-5.89-.3-8.5-1L3 8c1.86.5 4 .83 6 1v13h2v-6h2v6h2V9c2-.17 4.14-.5 6-1l-.5-2zM12 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>',
  wrench: '<svg class="ico" viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
  swap: '<svg class="ico" viewBox="0 0 24 24"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>',
  info: '<svg class="ico" viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
  warning: '<svg class="ico" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  doc: '<svg class="ico" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  box: '<svg class="ico" viewBox="0 0 24 24"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>',
  repeat: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
  target: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-13a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>',
  clock: '<svg class="ico" viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a8.994 8.994 0 0 0 7.03-14.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>',
  star: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
  arrowUp: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>',
  arrowDown: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>',
  checkDraw: '<svg class="check-draw" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" pathLength="1"/></svg>',
  share: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2l4.5 4.5-1.4 1.4L13 5.8V15h-2V5.8L8.9 7.9 7.5 6.5 12 2zM5 10h4v2H7v8h10v-8h-2v-2h4v12H5V10z"/></svg>',
  cloud: '<svg class="ico" viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"/></svg>',
  moon: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>',
  note: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.4l-2.35-2.35a1 1 0 0 0-1.4 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  speaker: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  medal: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2L9 8l-6 .5 4.5 4L6 19l6-3.5 6 3.5-1.5-6.5 4.5-4L15 8l-3-6zm0 4.6l1.7 3.4 3.7.3-2.8 2.5.9 3.7-3.5-2-3.5 2 .9-3.7-2.8-2.5 3.7-.3L12 6.6z"/></svg>',
  food: '<svg class="ico" viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>',
};

/** Icon-Kachel (farbiger Kasten mit Icon) */
export function iconBox(name, variant = '') {
  return h('span.ico-box' + (variant ? '.' + variant : ''), { html: svgIcon[name] });
}

/** Große Illustration für leere Zustände */
export function illustration(name = 'dumbbell') {
  return h('div.illu', { html: svgIcon[name] || svgIcon.dumbbell });
}

/** Zahl hochzählen (z.B. Volumen im Abschluss-Sheet) */
export function countUp(el, to, { duration = 600, format = (v) => String(Math.round(v)) } = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !Number.isFinite(to)) { el.textContent = format(to); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = format(to * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

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

/** ISO-Kalenderwoche (Montag–Sonntag, Woche 1 enthält den 4. Januar) */
export function isoWeek(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // Donnerstag der Woche
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
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

const openSheets = new Set();

export function openSheet(build) {
  const root = document.getElementById('modal-root');
  const backdrop = h('div.modal-backdrop');
  const sheet = h('div.modal');
  // Wie bei h(): null/false als Kind ignorieren – DOM.append(null) würde sonst den Text „null“ schreiben
  const rawAppend = sheet.append.bind(sheet);
  sheet.append = (...nodes) => rawAppend(...nodes.filter(n => n != null && n !== false));
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); openSheets.delete(close); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  build(sheet, close);
  backdrop.append(sheet);
  root.append(backdrop);
  openSheets.add(close);
  return close;
}

/** Alle offenen Sheets schließen (z.B. bei Seitenwechsel per Zurück-Geste) */
export function closeAllSheets() {
  for (const close of [...openSheets]) close();
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

export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Haptisches Feedback: Android per Vibration-API; iOS 17.4+ über das Umschalten
 * einer switch-Checkbox (#haptic), das Safari mit echtem Haptic quittiert.
 */
export function haptic(pattern = 10) {
  try { navigator.vibrate?.(pattern); } catch { /* egal */ }
  if (isIOS) {
    const sw = document.getElementById('haptic');
    if (sw) { try { sw.click(); } catch { /* egal */ } }
  }
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}
