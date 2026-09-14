// Cloud-Backup ohne eigenes Backend: ein privates GitHub-Gist hält hantel-backup.json.
// Token (Scope „gist“) liegt nur in localStorage und wird nie exportiert.
import { exportJSON, importJSON, getSettings, updateSettings, getSessions, subscribe } from './store.js';
import { toast } from './util.js';

const API = 'https://api.github.com';
const FILE = 'hantel-backup.json';
const DESCRIPTION = 'Hantel – Trainingsdaten (automatische Sicherung)';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function request(method, path, token, body) {
  const res = await fetch(API + path, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) throw new Error('Token ungültig oder abgelaufen');
  if (res.status === 403) throw new Error('Keine Berechtigung – Token braucht den Scope „gist“');
  if (res.status === 404) throw new Error('Gist nicht gefunden');
  if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export function cloudConfigured() {
  const s = getSettings();
  return !!(s.gistToken && s.gistToken.trim());
}

/** Gist mit Hantel-Sicherung im Konto suchen (für „Wiederherstellen“ auf einem neuen Gerät) */
export async function findGist(token) {
  const list = await request('GET', '/gists?per_page=100', token);
  const hit = list.find(g => g.files && g.files[FILE]);
  return hit ? hit.id : null;
}

/** Aktuellen Stand hochladen; legt das Gist beim ersten Mal an */
export async function cloudPush({ quiet = false } = {}) {
  const s = getSettings();
  const token = (s.gistToken || '').trim();
  if (!token) throw new Error('Kein Token hinterlegt');
  const content = exportJSON();
  let id = s.gistId;
  try {
    if (!id) id = await findGist(token);
    if (id) {
      await request('PATCH', `/gists/${id}`, token, { description: DESCRIPTION, files: { [FILE]: { content } } });
    } else {
      const g = await request('POST', '/gists', token, { description: DESCRIPTION, public: false, files: { [FILE]: { content } } });
      id = g.id;
    }
    updateSettings({ gistId: id, cloudLastSync: Date.now(), cloudLastError: '', lastBackupAt: Date.now(), lastBackupSessions: getSessions().length });
    if (!quiet) toast('In der Cloud gesichert');
    return id;
  } catch (e) {
    updateSettings({ cloudLastError: e.message });
    if (!quiet) toast('Cloud-Sicherung fehlgeschlagen: ' + e.message, { duration: 5000 });
    throw e;
  }
}

/** Sicherung aus dem Gist holen und mit den lokalen Daten zusammenführen */
export async function cloudPull() {
  const s = getSettings();
  const token = (s.gistToken || '').trim();
  if (!token) throw new Error('Kein Token hinterlegt');
  let id = s.gistId || await findGist(token);
  if (!id) throw new Error('Keine Hantel-Sicherung in deinem GitHub-Konto gefunden');
  const g = await request('GET', `/gists/${id}`, token);
  const f = g.files?.[FILE];
  if (!f) throw new Error('Gist enthält keine Hantel-Sicherung');
  // Große Gists liefern den Inhalt nur über raw_url
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  const r = importJSON(text, { merge: true });
  updateSettings({ gistId: id, cloudLastSync: Date.now(), cloudLastError: '' });
  return r;
}

// ---------- Automatische Sicherung nach Änderungen ----------

let pushTimer = null;
let dirty = false;

function schedulePush() {
  dirty = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, 4000);
}

async function flush() {
  if (!dirty) return;
  const s = getSettings();
  if (!s.cloudAutoSync || !cloudConfigured()) { dirty = false; return; }
  if (!navigator.onLine) return; // „online“-Event holt es nach
  dirty = false;
  try { await cloudPush({ quiet: true }); } catch { dirty = true; }
}

/** Einmal beim Start aufrufen: sichert nach Workouts, Plan- und Körperänderungen mit Verzögerung */
export function startAutoSync() {
  subscribe((what) => {
    if (what === 'sessions' || what === 'plans' || what === 'body') schedulePush();
  });
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}
