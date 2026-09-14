# Hantel 🏋️

Trainingsplan, Workout-Tracker und Pausentimer als installierbare Web-App (PWA) fürs iPhone.
Kein Build-Schritt, kein Backend – reines HTML/CSS/JavaScript, Daten bleiben auf dem Gerät.

## Funktionen

- **Trainingspläne** anlegen, bearbeiten, duplizieren (Sätze × Wdh × Gewicht × Pause pro Übung)
- **PDF-Import**: Trainingsplan als PDF auswählen → Übungen werden erkannt → prüfen → speichern
  - *Mustererkennung*: offline, erkennt Tabellen (Übung | Sätze | Wdh | Gewicht | Pause) und Freitext („Bankdrücken 3 x 10 @ 60 kg“, „3 Sätze à 12 Wdh“)
  - *KI (optional)*: mit eigenem Claude-API-Key liest Claude das PDF direkt – auch gescannte PDFs
- **Trainingsmodus**: eine Übung pro Seite mit Bild, Zielmuskeln, Fortschritt („Übung 3 von 8“), großen ±-Steppern für Gewicht/Wdh, „Letztes Training“ + „Heute empfohlen“, feste Navigation (Vorherige/Nächste/Abschließen), Auto-Speichern, automatischer **Pausentimer** mit Ton
- **Double Progression**: Empfehlung pro Übung aus der Historie (alle Sätze am oberen Ende des Bereichs → +Gewichtsschritt, sonst Gewicht halten); Gewichtsschritt pro Übung konfigurierbar (Standard: Kurzhantel 2 kg, Maschine/Kabel 5 kg, Langhantel 2,5 kg); Hinweis bei Leistungsabfall, Reduzierung bleibt beim Nutzer
- **PR-Erkennung**: höchstes Gewicht, meiste Wdh je Gewicht, bestes e1RM (Epley), höchstes Einheiten-Volumen – dezente Animation direkt nach dem Satz, Bereich „Rekorde“ je Übung
- **Timer-Seite**: Countdown mit Presets + Stoppuhr (zeitstempelbasiert, stimmt auch nach Sperrbildschirm)
- **Fortschritt**: Workouts pro Woche, Volumen, Serie; je Übung Kennzahlen (Bestes Gewicht, Top-Satz, e1RM, Volumen, Wdh) × Zeiträume (1M/3M/6M/1J/Gesamt) mit Tooltip (Datum, Gewicht × Wdh, Satz, e1RM), Veränderung („+13 kg in 5 Monaten“), Statistik und Rekorde
- **Muskelgruppen**: Sätze je Muskelgruppe (primär 1,0 / sekundär 0,5) pro Woche als Balken + Körperkarte Vorder-/Rückseite (grün = leicht … rot = intensiv), Tipp auf Muskel → diese/letzte Woche, 4-Wochen-Schnitt, Übungen; Körperkarte auch beim Workout-Abschluss
- **Studio-Tools im Training**: Maschineneinstellungen je Übung als Einzeiler (bleiben gespeichert), Scheibenrechner (Tipp aufs Gewicht, Stange 20/15/10 kg oder ohne; bei Maschinen eingeklappt), automatische Aufwärmsätze (40/60/80 %, nur vor dem ersten Arbeitssatz, zählen nicht als Volumen), RIR-Chips je Satz (schärfen die Progression), Übung für heute tauschen (gleiche Muskelgruppe), Supersätze (Pause erst nach der zweiten Übung), Pausentimer klingelt auch bei gesperrtem Bildschirm (lautloses Audio hält die Session offen)
- **Rund ums Training**: „Heute dran“-Karte mit A/B-Rotation, Gewicht & Maße mit Verlauf, Trainingskalender (Heatmap), vergangene Sessions korrigierbar, 1RM-Prozent-Tabelle je Übung
- **Übungsbibliothek**: animierte Strichfiguren (Start ↔ Endposition) mit Muskelgruppen und 2–3 Ausführungstipps zu 25 Übungen – im Plan, im Workout (ⓘ) und unter „Mehr“
- **Vorlagen**: Oberkörper/Unterkörper A+B (4-/5-Tage-Split) werden beim ersten Start angelegt; Zusatztag Samstag optional
- **Backup**: JSON-Export/-Import unter „Mehr“; alle 10 Workouts erinnert die App an eine Sicherung, `navigator.storage.persist()` wird beim Start angefragt
- **Premium-Details**: Dashboard mit Wochenring/Serie/letztem PR, Display-Schrift (Space Grotesk) für Titel und Zahlen, eigenes SVG-Icon-Set, Seitenübergänge und Mikro-Animationen (Haken zeichnet sich, Einrasten, Count-up, aufleuchtende Muskelkarte; `prefers-reduced-motion` wird respektiert), fokussierter Workout-Screen (kompakter Kopf, nur der aktuelle Satz groß, Pausenring inline, Auto-Scroll zum Ring), Begrüßung mit Namen (unter „Mehr“), iOS-Splash-Screens, Haptik über switch-Checkbox (iOS 17.4+)
- **Offline** dank Service Worker; Dark ist Standard, Hell/Auto unter „Mehr“

## Lokal testen

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

Dann `http://localhost:8080/` öffnen. Der Server braucht kein Node/Python.
Ein Test-PDF liegt unter `test/trainingsplan-test.pdf` (erzeugt von `tools/make-test-pdf.ps1`).
`test/figures.html` zeigt alle Übungsfiguren; `renderSheet(0|1)` in der Konsole schreibt ein PNG-Sprite nach `test/out/`.

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
js/backup.js          Sicherung exportieren + Erinnerung
js/pdf-import.js      pdf.js-Textextraktion + Mustererkennung
js/ai-import.js       Claude-API-Aufruf (PDF → JSON)
js/figure.js          Strichfiguren-Renderer (Posen über Gelenkwinkel, SMIL-Animation)
js/exercise-db.js     Übungsbibliothek: Figuren, Muskeln, Tipps, Namenszuordnung
js/templates.js       Eingebaute Plan-Vorlagen + Erststart-Seeding
js/progression.js     Double Progression, Gewichtsschritte, PR-Erkennung (Epley-e1RM)
js/muscles.js         Muskelgruppen-Taxonomie, Satz-Auswertung, Körperkarte (SVG)
js/views/*.js         Seiten: Pläne, Plan, Bearbeiten, Import, Workout, Timer, Fortschritt, Mehr, Bibliothek, Übungs-Info, Körper
icons/                App-Icons (PNG via tools/make-icons.ps1)
```

## Datenmodell (localStorage `hantel.v1`)

```
plan     { id, name, note, exercises: [{ id, name, sets, reps, weight, restSec, note }] }
session  { id, planId, planName, startedAt, endedAt, durationSec, note,
           entries: [{ exerciseId, name, sets: [{ reps, weight, done }] }] }
settings { defaultRestSec, autoRestTimer, sound, vibrate, wakeLock, unit, apiKey, aiModel, theme, weeklyGoal,
           barWeight, keepAliveAudio, warmupSets, name, lastBackupAt, lastBackupSessions }
```

Übungen werden über ihren Namen (case-insensitiv) über Pläne hinweg zusammengeführt – so zählt
„Bankdrücken“ aus Plan A und Plan B in dieselbe Statistik.
