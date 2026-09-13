// Einstieg: Router, Tab-Bar, Service Worker
import { load, getActiveWorkout, subscribe } from './store.js';
import { toast } from './util.js';
import { restTimer } from './timer.js';

import * as plans from './views/plans.js';
import * as planDetail from './views/plan-detail.js';
import * as planEdit from './views/plan-edit.js';
import * as importView from './views/import.js';
import * as workout from './views/workout.js';
import * as timerView from './views/timer.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';
import * as library from './views/library.js';
import { seedTemplates } from './templates.js';

const routes = [
  { re: /^\/plans$/, view: plans, tab: 'plans' },
  { re: /^\/plan\/([^/]+)$/, view: planDetail, tab: 'plans' },
  { re: /^\/plan\/([^/]+)\/edit$/, view: planEdit, tab: 'plans' },
  { re: /^\/import$/, view: importView, tab: 'plans' },
  { re: /^\/workout$/, view: workout, tab: null },
  { re: /^\/timer$/, view: timerView, tab: 'timer' },
  { re: /^\/progress$/, view: progress, tab: 'progress' },
  { re: /^\/exercise\/(.+)$/, view: progress, sub: 'exercise', tab: 'progress' },
  { re: /^\/session\/([^/]+)$/, view: progress, sub: 'session', tab: 'progress' },
  { re: /^\/settings$/, view: settings, tab: 'settings' },
  { re: /^\/library$/, view: library, tab: 'settings' },
  { re: /^\/templates$/, view: library, sub: 'templates', tab: 'plans' },
];

let current = null;
const viewEl = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/plans';
  const path = raw.split('?')[0];
  return { path, query: new URLSearchParams(raw.split('?')[1] || '') };
}

export function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', '#' + path);
  else location.hash = path;
  if (replace) render();
}

function render() {
  const { path, query } = parseHash();
  let match = null, params = [];
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { match = r; params = m.slice(1).map(decodeURIComponent); break; }
  }
  if (!match) { navigate('/plans', true); return; }

  // Laufendes Workout hat Vorrang, wenn man "Pläne" öffnet und gerade trainiert → Hinweis statt Umleitung
  if (current?.view?.unmount) { try { current.view.unmount(); } catch (e) { console.error(e); } }
  current = { view: match.view, path };

  viewEl.innerHTML = '';
  viewEl.scrollTop = 0;
  viewEl.classList.toggle('no-tabbar', match.tab === null);
  tabbar.classList.toggle('hidden', match.tab === null);
  for (const a of tabbar.querySelectorAll('.tab')) a.classList.toggle('active', a.dataset.tab === match.tab);

  try {
    match.view.render(viewEl, { params, query, sub: match.sub, navigate });
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = `<div class="empty"><div class="icon">💥</div><h3>Da ist was schiefgelaufen</h3><p>${e.message}</p></div>`;
  }
}

window.addEventListener('hashchange', render);

// ---------- Start ----------

load();
const seeded = seedTemplates();
render();
if (seeded) toast(`${seeded} Trainingspläne angelegt: Oberkörper & Unterkörper A/B`, { duration: 5000 });

// Laufendes Workout beim Start wieder öffnen
if (getActiveWorkout() && !location.hash.startsWith('#/workout')) {
  toast('Workout läuft noch', { action: { label: 'Weiter', fn: () => navigate('/workout') }, duration: 8000 });
}

// Pausentimer-Hinweis, wenn man nicht auf der Workout-/Timer-Seite ist
restTimer.on((type) => {
  if (type === 'done' && !/^#\/(workout|timer)/.test(location.hash)) toast('Pause vorbei – weiter geht’s!');
});

subscribe((what) => {
  if (what === 'workout' && !getActiveWorkout() && location.hash.startsWith('#/workout')) navigate('/plans', true);
});

// ---------- Service Worker ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Update verfügbar', { action: { label: 'Neu laden', fn: () => { nw.postMessage({ type: 'SKIP_WAITING' }); } }, duration: 10000 });
          }
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return; refreshing = true; location.reload();
      });
    } catch (e) {
      console.warn('Service Worker nicht registriert', e);
    }
  });
}
