// Service Worker: App-Shell offline verfügbar machen.
// Bei jeder Änderung an den App-Dateien VERSION erhöhen, damit Clients aktualisieren.
const VERSION = 'hantel-v1.18.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/timer.js',
  './js/backup.js',
  './js/cloud.js',
  './js/recovery.js',
  './js/share.js',
  './js/milestones.js',
  './js/standards.js',
  './js/speech.js',
  './js/exporters.js',
  './js/views/custom-exercise.js',
  './js/views/food.js',
  './js/nutrition.js',
  './js/food-db.js',
  './js/off.js',
  './js/ai-food.js',
  './js/scanner.js',
  './js/pdf-import.js',
  './js/ai-import.js',
  './js/llm.js',
  './js/ai-tasks.js',
  './js/views/food-photo.js',
  './js/views/food-generate.js',
  './js/views/plans.js',
  './js/views/plan-detail.js',
  './js/views/plan-edit.js',
  './js/views/import.js',
  './js/views/workout.js',
  './js/views/timer.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './js/views/exercise-info.js',
  './js/views/library.js',
  './js/views/body.js',
  './js/figure.js',
  './js/exercise-db.js',
  './js/templates.js',
  './js/progression.js',
  './js/muscles.js',
  './js/plan-art.js',
  './js/equipment.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION && k.startsWith('hantel-')).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Lokal (Entwicklung) nichts cachen, damit Änderungen sofort sichtbar sind
const DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

self.addEventListener('fetch', (event) => {
  if (DEV) return;
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API-Aufrufe nie cachen
  if (url.hostname === 'api.anthropic.com' || url.hostname === 'api.openai.com') return;

  // pdf.js vom CDN und Google Fonts: Cache-first, damit es offline funktioniert, sobald einmal geladen
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(VERSION + '-cdn').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // App-Shell: Cache-first, im Hintergrund aktualisieren (stale-while-revalidate)
  event.respondWith(caches.open(VERSION).then(async (c) => {
    const cached = await c.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { network.catch(() => {}); return cached; }
    const res = await network;
    if (res) return res;
    // Offline & nicht im Cache → Startseite als Fallback für Navigation
    if (req.mode === 'navigate') return c.match('./index.html');
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }));
});
