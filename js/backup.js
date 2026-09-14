// Sicherung: JSON-Export mit Datumsstempel + Erinnerung, wenn viele Workouts ungesichert sind
import { exportJSON, getSessions, getSettings, updateSettings } from './store.js';
import { download, toast } from './util.js';

const REMIND_EVERY = 10; // Workouts

export function exportBackup() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  download(`hantel-backup-${stamp}.json`, exportJSON());
  updateSettings({ lastBackupAt: Date.now(), lastBackupSessions: getSessions().length });
  toast('Sicherung erstellt');
}

/** true, wenn seit der letzten Sicherung mindestens REMIND_EVERY Workouts dazugekommen sind */
export function backupDue() {
  const n = getSessions().length;
  const since = getSettings().lastBackupSessions || 0;
  return n > 0 && n - since >= REMIND_EVERY;
}
