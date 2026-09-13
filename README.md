# Hantel 🏋️

Trainingsplan, Workout-Tracker und Pausentimer als installierbare Web-App (PWA) fürs iPhone.
Kein Build-Schritt, kein Backend – reines HTML/CSS/JavaScript, Daten bleiben auf dem Gerät.

## Funktionen

- **Trainingspläne** anlegen, bearbeiten, duplizieren (Sätze × Wdh × Gewicht × Pause pro Übung)
- **PDF-Import**: Trainingsplan als PDF auswählen → Übungen werden erkannt → prüfen → speichern
  - *Mustererkennung*: offline, erkennt Tabellen (Übung | Sätze | Wdh | Gewicht | Pause) und Freitext („Bankdrücken 3 x 10 @ 60 kg“, „3 Sätze à 12 Wdh“)
  - *KI (optional)*: mit eigenem Claude-API-Key liest Claude das PDF direkt – auch gescannte PDFs
- **Workout-Modus**: Sätze abhaken, Gewicht/Wdh eintragen, Vorbelegung aus dem letzten Training, automatischer **Pausentimer** mit Ton
- **Timer-Seite**: Countdown mit Presets + Stoppuhr (zeitstempelbasiert, stimmt auch nach Sperrbildschirm)
- **Fortschritt**: Workouts pro Woche, Volumen, Serie, Bestwerte & geschätztes 1RM pro Übung, Verlaufs-Charts, neue Rekorde werden beim Abschluss erkannt
- **Backup**: JSON-Export/-Import unter „Mehr“
- **Offline** dank Service Worker, Dark/Light Mode folgt dem System

## Lokal testen

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

Dann `http://localhost:8080/` öffnen. Der Server braucht kein Node/Python.
Ein Test-PDF liegt unter `test/trainingsplan-test.pdf` (erzeugt von `tools/make-test-pdf.ps1`).

## Auf dem iPhone installieren

1. Die veröffentlichte URL (z.B. GitHub Pages) in **Safari** öffnen
2. **Teilen** → **Zum Home-Bildschirm**
3. Hantel startet danach als eigenständige App – auch offline

## Veröffentlichen (GitHub Pages)

Der Ordner ist direkt als statische Seite deploybar. Bei GitHub: Repository anlegen, Dateien pushen,
unter *Settings → Pages* den Branch `main` (Root) auswählen. Alle Pfade sind relativ, die App läuft
also auch unter `https://<user>.github.io/<repo>/`.

Nach Änderungen an App-Dateien in `sw.js` die `VERSION` erhöhen, damit installierte Apps das Update ziehen.

## Struktur

```
index.html            App-Shell + Tab-Bar
manifest.webmanifest  PWA-Manifest
sw.js                 Service Worker (Offline-Cache)
css/app.css           Design-Tokens & Styles
js/app.js             Router, Start, SW-Registrierung
js/store.js           State + localStorage, Statistik-Helfer
js/timer.js           Countdown/Stoppuhr, Ton, Wake Lock
js/pdf-import.js      pdf.js-Textextraktion + Mustererkennung
js/ai-import.js       Claude-API-Aufruf (PDF → JSON)
js/views/*.js         Seiten: Pläne, Plan, Bearbeiten, Import, Workout, Timer, Fortschritt, Mehr
icons/                App-Icons (PNG via tools/make-icons.ps1)
```

## Datenmodell (localStorage `hantel.v1`)

```
plan     { id, name, note, exercises: [{ id, name, sets, reps, weight, restSec, note }] }
session  { id, planId, planName, startedAt, endedAt, durationSec, note,
           entries: [{ exerciseId, name, sets: [{ reps, weight, done }] }] }
settings { defaultRestSec, autoRestTimer, sound, vibrate, wakeLock, unit, apiKey, aiModel }
```

Übungen werden über ihren Namen (case-insensitiv) über Pläne hinweg zusammengeführt – so zählt
„Bankdrücken“ aus Plan A und Plan B in dieselbe Statistik.
