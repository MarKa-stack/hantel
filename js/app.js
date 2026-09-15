// Einstieg: Router, Tab-Bar, Service Worker
import { load, getActiveWorkout, subscribe, getSettings } from './store.js';
import { toast, h, illustration, closeAllSheets } from './util.js';
import { restTimer } from './timer.js';
import { applyAccent } from './theme.js';

import * as plans from './views/plans.js';
import * as planDetail from './views/plan-detail.js';
import * as planEdit from './views/plan-edit.js';
import * as importView from './views/import.js';
import * as workout from './views/workout.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';
import * as library from './views/library.js';
import * as body from './views/body.js';
import * as photos from './views/photos.js';
import * as coach from './views/coach.js';
import * as food from './views/food.js';
import * as foodGenerate from './views/food-generate.js';
import { seedTemplates } from './templates.js';
import { startAutoSync } from './cloud.js';
import { suggestPlan } from './recovery.js';

const routes = [
  { re: /^\/plans$/, view: plans, tab: 'plans' },
  { re: /^\/plan\/([^/]+)$/, view: planDetail, tab: 'plans' },
  { re: /^\/plan\/([^/]+)\/edit$/, view: planEdit, tab: 'plans' },
  { re: /^\/import$/, view: importView, tab: 'plans' },
  { re: /^\/workout$/, view: workout, tab: null },
  { re: /^\/progress$/, view: progress, tab: 'progress' },
  { re: /^\/exercise\/(.+)$/, view: progress, sub: 'exercise', tab: 'progress' },
  { re: /^\/session\/([^/]+)$/, view: progress, sub: 'session', tab: 'progress' },
  { re: /^\/muscles$/, view: progress, sub: 'muscles', tab: 'progress' },
  { re: /^\/week\/(\d+)$/, view: progress, sub: 'week', tab: 'progress' },
  { re: /^\/milestones$/, view: progress, sub: 'milestones', tab: 'progress' },
  { re: /^\/records$/, view: progress, sub: 'records', tab: 'progress' },
  { re: /^\/coach$/, view: coach, tab: 'progress' },
  { re: /^\/body$/, view: body, tab: 'progress' },
  { re: /^\/photos$/, view: photos, tab: 'progress' },
  { re: /^\/food$/, view: food, tab: 'food' },
  { re: /^\/food\/recipes$/, view: food, sub: 'recipes', tab: 'food' },
  { re: /^\/food\/recipe\/([^/]+)$/, view: food, sub: 'recipe', tab: 'food' },
  { re: /^\/food\/foods$/, view: food, sub: 'foods', tab: 'food' },
  { re: /^\/food\/goals$/, view: food, sub: 'goals', tab: 'food' },
  { re: /^\/food\/generate$/, view: foodGenerate, tab: 'food' },
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

  if (current?.view?.unmount) { try { current.view.unmount(); } catch (e) { console.error(e); } }
  closeAllSheets(); // offene Sheets gehören zur alten Seite (Zurück-Geste, Tab-Wechsel)

  // Übergang: Detailseite im selben Tab → Slide von rechts, zurück zur Tab-Wurzel → Slide von links, Tab-Wechsel → Fade
  const isRoot = ROOTS.has(path);
  const sameTab = current && current.tab === match.tab;
  const kind = !current ? 'fade' : sameTab ? (isRoot && !current.isRoot ? 'back' : !isRoot ? 'slide' : 'fade') : 'fade';
  current = { view: match.view, path, tab: match.tab, isRoot };

  viewEl.innerHTML = '';
  viewEl.scrollTop = 0;
  viewEl.classList.remove('enter-slide', 'enter-fade', 'enter-back');
  viewEl.classList.toggle('no-tabbar', match.tab === null);
  tabbar.classList.toggle('hidden', match.tab === null);
  for (const a of tabbar.querySelectorAll('.tab')) a.classList.toggle('active', a.dataset.tab === match.tab);

  try {
    match.view.render(viewEl, { params, query, sub: match.sub, navigate });
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = '';
    viewEl.append(h('div.empty', {}, [illustration('warning'), h('h3', { text: 'Da ist was schiefgelaufen' }), h('p', { text: e.message })]));
  }
  void viewEl.offsetWidth; // Animation neu starten
  viewEl.classList.add('enter-' + kind);
}

const ROOTS = new Set(['/plans', '/progress', '/food', '/settings']);

// ---------- Theme ----------
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = getSettings().theme || 'dark';
  const theme = pref === 'system' ? (mqDark.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  applyAccent(getSettings().accent || 'orange', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#182030' : '#f4f5f8');
}
mqDark.addEventListener?.('change', applyTheme);

window.addEventListener('hashchange', render);

// ---------- Start ----------

load();
applyTheme();
const seeded = seedTemplates();
// Deep-Link für Siri-Kurzbefehle: …/?action=start startet das heutige Training, ?action=timer öffnet den Timer
const action = new URLSearchParams(location.search).get('action');
if (action) {
  let target = location.hash;
  if (action === 'start') {
    const sug = suggestPlan();
    target = getActiveWorkout() ? '#/workout' : sug ? '#/plan/' + sug.plan.id + '?start=1' : '#/plans';
  } else if (action === 'timer') target = '#/plans'; // Timer-Seite entfernt
  history.replaceState(null, '', location.pathname + target); // ohne hashchange, render() folgt direkt
}
render();
// Safari darf Site-Daten nach 7 Tagen ohne Nutzung löschen – „persistent“ anfragen (still, ohne Dialog)
navigator.storage?.persist?.().catch(() => {});
startAutoSync();
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
  if (what === 'settings') applyTheme();
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
