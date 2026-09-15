// Fortschrittsfotos: liegen in IndexedDB (nicht im localStorage-Store – Bilder sind zu groß dafür
// und gehören nicht in Sicherung/Cloud-Sync). Jedes Foto: Vollbild (JPEG-Data-URL, max. 1200 px)
// plus kleines Thumbnail für die Galerie.
import { shrinkImage } from './util.js';

const DB = 'hantel-photos', STORE = 'photos';
export const POSES = [['front', 'Vorne'], ['side', 'Seite'], ['back', 'Hinten']];
export const POSE_NAME = Object.fromEntries(POSES);

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
function tx(mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** Alle Fotos, nach Datum aufsteigend */
export async function listPhotos() {
  const all = await tx('readonly', s => s.getAll());
  return (all || []).sort((a, b) => a.date - b.date);
}

/** Datei verkleinern und speichern. weight: Körpergewicht am Tag (falls bekannt) */
export async function addPhoto(file, { date = Date.now(), pose = 'front', note = '', weight = null } = {}) {
  const full = await shrinkImage(file, { maxSide: 1200, maxBytes: 320_000 });
  const thumb = await shrinkImage(file, { maxSide: 360, maxBytes: 40_000 });
  const p = { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), date, pose, note, weight, full, thumb };
  await tx('readwrite', s => s.put(p));
  return p;
}

export async function updatePhoto(id, patch) {
  const p = await tx('readonly', s => s.get(id));
  if (!p) return null;
  const n = { ...p, ...patch };
  await tx('readwrite', s => s.put(n));
  return n;
}

export async function deletePhoto(id) { await tx('readwrite', s => s.delete(id)); }

export async function photoCount() { return (await tx('readonly', s => s.count())) || 0; }
