# Hantel 🏋️

Trainingsplan, Workout-Tracker und Kalorienzähler als installierbare Web-App (PWA) fürs iPhone.
Kein Build-Schritt, kein Backend – reines HTML/CSS/JavaScript, Daten bleiben auf dem Gerät.

## Funktionen

- **Trainingspläne** anlegen, bearbeiten, duplizieren (Sätze × Wdh × Gewicht × Pause pro Übung); Plan-Ansicht mit Muskelfokus (zwei Mini-Körperkarten), Chips je Übung (Sätze · Wdh · Gewicht) und klebendem Start-Button
- **PDF-Import**: Trainingsplan als PDF auswählen → Übungen werden erkannt → prüfen → speichern
  - *Mustererkennung*: offline, erkennt Tabellen (Übung | Sätze | Wdh | Gewicht | Pause) und Freitext („Bankdrücken 3 x 10 @ 60 kg“, „3 Sätze à 12 Wdh“)
  - *KI (optional)*: mit eigenem Claude- **oder OpenAI-API-Key** (Umschalter unter „Mehr → KI“, `js/llm.js`) liest die KI das PDF direkt – auch gescannte PDFs
- **Trainingsmodus**: eine Übung pro Seite mit animierter Bühne (Tipp → Ausführung & Gerät), schmaler Fortschrittsleiste, „Weiter“ als Hauptaktion unten (Beenden/Abbrechen unauffällig hinter „⋯“ oben rechts), Satztabelle (Nr · kg · Wdh · RIR · Haken – Werte direkt tippbar, ± in der aktuellen Zeile, RIR per Tipp durchzählen), Details hinter „⋯“ (Tipps, Scheibenrechner, Notiz, Maschineneinstellungen, Tauschen), „Letztes Training“ + „Heute empfohlen“, feste Navigation (Vorherige/Nächste/Abschließen), Auto-Speichern, automatischer **Pausentimer** mit Ton
- **Double Progression**: Empfehlung pro Übung aus der Historie (alle Sätze am oberen Ende des Bereichs → +Gewichtsschritt, sonst Gewicht halten); Gewichtsschritt pro Übung konfigurierbar (Standard: Kurzhantel 2 kg, Maschine/Kabel 5 kg, Langhantel 2,5 kg); Hinweis bei Leistungsabfall, Reduzierung bleibt beim Nutzer
- **PR-Erkennung**: höchstes Gewicht, meiste Wdh je Gewicht, bestes e1RM (Epley), höchstes Einheiten-Volumen – dezente Animation direkt nach dem Satz, Bereich „Rekorde“ je Übung
- **Fortschritt**: Workouts pro Woche, Volumen, Serie; je Übung Kennzahlen (Bestes Gewicht, Top-Satz, e1RM, Volumen, Wdh) × Zeiträume (1M/3M/6M/1J/Gesamt) mit Tooltip (Datum, Gewicht × Wdh, Satz, e1RM), Veränderung („+13 kg in 5 Monaten“), Statistik und Rekorde
- **Muskelgruppen**: Sätze je Muskelgruppe (primär 1,0 / sekundär 0,5) pro Woche als Balken + anatomische Körperkarte Vorder-/Rückseite (Brust, Delta-Köpfe, Bizeps/Trizeps, Bauch/Obliques, Lat/Trapez/Rückenstrecker, Gesäß, Quadrizeps, Beinbeuger, Waden; grün = leicht … rot = intensiv), Tipp auf Muskel → diese/letzte Woche, 4-Wochen-Schnitt, Übungen; Körperkarte auch beim Workout-Abschluss
- **Studio-Tools im Training**: Maschineneinstellungen je Übung als Einzeiler (bleiben gespeichert), Scheibenrechner (Tipp aufs Gewicht, Stange 20/15/10 kg oder ohne; bei Maschinen eingeklappt), automatische Aufwärmsätze (40/60/80 %, nur vor dem ersten Arbeitssatz, zählen nicht als Volumen), RIR-Chips je Satz (schärfen die Progression), Übung für heute tauschen (gleiche Muskelgruppe), Supersätze (Pause erst nach der zweiten Übung), Pausentimer klingelt optional auch bei gesperrtem Bildschirm (Einstellung „Timer bei gesperrtem Bildschirm“, Standard aus, weil das lautlose Audio laufende Musik pausiert); Audio läuft als Ambient-Session (iOS 17+) und mischt sich unter Spotify/Apple Music
- **Rund ums Training**: „Heute dran“-Karte mit A/B-Rotation, Gewicht & Maße mit Verlauf, Trainingskalender (Heatmap), vergangene Sessions korrigierbar, 1RM-Prozent-Tabelle je Übung
- **Übungsbibliothek**: animierte Figuren aus konischen Kapseln (Start ↔ Endposition, `js/figure.js`), dazu je Übung ein **Gerätebild**: echtes Foto (16 Gerätetypen: Wikimedia Commons und Flickr unter CC BY/BY-SA/CC0, `img/equip/`, Bildnachweise unter „Mehr“; ohne freies Foto nur Wadenheben stehend, Hip Thrust, Matte) oder beschriftete SVG-Illustration (`js/equipment.js`), mit Aufsatz/Griff und Einstellhinweis – oder ein **eigenes Foto des Geräts im Studio** („Foto aus deinem Studio“, pro Gerätetyp, ≤ 900 px, eigener localStorage-Schlüssel `hantel.equipPhotos`) – im Info-Sheet über „Bewegung | Gerät“ oder Tipp aufs Bild; Muskelgruppen und 2–3 Ausführungstipps zu 25 Übungen – im Plan, im Workout (ⓘ) und unter „Mehr“
- **Vorlagen**: Oberkörper/Unterkörper A+B (4-/5-Tage-Split) werden beim ersten Start angelegt; Zusatztag Samstag optional
- **Backup**: JSON-Export/-Import unter „Mehr“; alle 10 Workouts erinnert die App an eine Sicherung, `navigator.storage.persist()` wird beim Start angefragt
- **Cloud-Backup**: privates GitHub-Gist (Token mit Scope „gist“ unter „Mehr“), automatisch nach Workouts/Plan-/Körperänderungen, Wiederherstellen auf neuem Gerät per Token (`js/cloud.js`)
- **Erholung & Planvorschlag**: Ermüdung je Muskelgruppe (Satz-Äquivalente, Halbwertszeit 24 h) → „Heute dran“ nimmt den Plan mit den erholtesten Muskeln, Erholungskarte auf dem Start (`js/recovery.js`)
- **Workout-Karte teilen**: Canvas-Bild (1080×1350) mit Kennzahlen, Körperkarte, Rekorden → Share-Sheet oder PNG (`js/share.js`)
- **Plateau & Deload**: Stagnation je Übung (≥ 4 Einheiten/3 Wochen ohne neues e1RM) mit Deload-Knopf im Training (−15 %, ein Satz weniger) und Plateau-Karte auf der Übungsseite; Deload-Woche global unter „Mehr“ (Progression ignoriert Deload-Einheiten)
- **Volumen-Ziel**: min–max Sätze je Muskel/Woche (Einstellung) – Zielband in den Balken, Status ✓/↓/↑, Körperkarte skaliert auf das Ziel
- **Satztypen**: Arbeit / Drop (zählt nicht für die Progression) / AMRAP / Failure je Satz; „Letzter Satz AMRAP“ im Plan-Editor
- **Kraftstandards**: e1RM ÷ Körpergewicht → Einsteiger … Elite mit Fortschrittsbalken (Bankdrücken, Kniebeuge, Kreuzheben, Presse, Latzug u.a.; Mann/Frau)
- **Pausen-Vorschau**: nach dem letzten Satz zeigt der Pausenring die nächste Übung samt Maschineneinstellungen
- **Wochenrückblick**: `#/week/<ts>` mit Vorwochenvergleich, Muskeln, Rekorden; Karte auf dem Start Mo–Mi
- **Meilensteine**: 23 aus dem Verlauf berechnete Marken (Workouts, Serien, Volumen, Rekorde, 100 kg …), Toast nach dem Workout, Seite `#/milestones` (`js/milestones.js`)
- **Sprachansagen**: „Noch zehn Sekunden“, „Pause vorbei. Satz 2: 60 Kilo, 6 Wiederholungen“ (Web Speech API, Schalter unter „Mehr“)
- **Notiz je Übung** in der Session (Stift-Button), erscheint beim nächsten Mal unter „Zuletzt“
- **Siri-Kurzbefehl**: `?action=start` startet das heutige Training
- **Kalender**: Trainingstage + Uhrzeit (+ optional Plan je Tag) als .ics mit Erinnerung, per Share-Sheet in den Apple-Kalender
- **CSV-Export** aller Sätze (Semikolon, BOM – Excel/Numbers)
- **Eigene Übungen**: Name, Aliase, Primär-/Sekundärmuskeln, Gewichtsschritt, Langhantel, Tipps – zählen in Bilanz, Erholung, Progression und Scheibenrechner (`js/views/custom-exercise.js`)
- **Essen (Kalorienzähler)**: Barcode-Scanner (Kamera; native BarcodeDetector, sonst ZXing vom CDN, `js/scanner.js`), Tagebuch mit Kalorienring und Makro-Balken, vier Mahlzeiten, Einträge ändern/verschieben/löschen, „Gestern kopieren“. Lebensmittel aus drei Quellen: Basistabelle (~90 Grundnahrungsmittel, `js/food-db.js`), Open Food Facts (Textsuche mit Deutschland-Filter + EAN-Eingabe, `js/off.js`; über den Hantel-Server gecacht, sonst direkt mit Wiederholung; Suche und Scanner auch in Rezepten und unter „Meine Lebensmittel“) und eigene Einträge mit Portionen/Favoriten. **KI-Freitext** („3 Eier, 2 Scheiben Vollkornbrot, 1 Banane“) → Claude schätzt Mengen und Nährwerte, Prüfliste, ins Tagebuch oder als Rezept (`js/ai-food.js`). **Fast Food**: Kette antippen (McDonald’s, Burger King, KFC, Subway, Döner, Pizza …) und Bestellung eingeben → KI schätzt nach den offiziellen Werten der Kette, Menü in Einzelteile. Im Hinzufügen-Sheet sind Zuletzt/Favoriten/Rezepte als Reiter eingeklappt, auf der Rezepte-Seite die Liste hinter „Meine Rezepte (N)“. **Rezepte** mit Zutaten × Gramm und Portionen, als Portion loggbar. **Ziele**: TDEE (Mifflin-St Jeor) aus Körperlog + Größe/Alter/Aktivität, Ziel Aufbau/Halten/Abnehmen, Protein pro kg; **adaptive Anpassung**: Wochenschnitt der Kalorien gegen den Gewichtstrend → ±100 kcal-Vorschlag (`js/nutrition.js`). Kachel „Essen heute“ auf dem Start, eigener Tab.
- **Essen fotografieren**: Kamera/Galerie → Bild clientseitig auf 1024 px verkleinert und ohne EXIF neu kodiert → KI schätzt Gericht, Bestandteile, Gramm und Nährwerte (`food-image`-Aufgabe, JSON-Schema) → Prüf-Editor (Name, Bestandteile, Gramm-Stepper skaliert Makros, Werte direkt editierbar, hinzufügen/entfernen) → Tagebuch-Eintrag `kind: "ai", source: "ai_image"` mit Confidence high/medium/low, Datenschutzhinweis vor der ersten Analyse, „Zuletzt analysiert“ (`js/views/food-photo.js`)
- **Rezept aus Zutaten**: Zutaten-Chips, Vorrat speichern/laden, Optionen (kcal min/max, Protein, Portionen, Zeit, Ernährungsform, Ausschlüsse, „Heute übrig“ aus den Tageszielen) → KI-Rezept mit ✓ vorhanden / „Zusätzlich benötigt“, Schritten und Nährwerten pro Portion → als Rezept speichern oder als Mahlzeit eintragen (Tag + Mahlzeit); **Rezepte im Web** über die OpenAI-Websuche – nur Treffer mit tatsächlich zitierter URL, verlinkt auf die Originalseite, kein Scraping (`js/views/food-generate.js`)
- **KI-Backend (Cloudflare Worker, `worker/`)**: OpenAI-Key nur als Worker-Secret, App spricht per Zugangstoken mit `POST /ai/<aufgabe>`; Prompts/Schemas in `js/ai-tasks.js` (geteilt, Worker wird per `tools/build-worker.ps1` gebaut); Rate-Limit pro IP, Tageslimit, Parallelitäts-Limit, Timeout, Eingabe- und Schema-Prüfung, Nutzungszähler; alternativ weiterhin eigener Claude-/OpenAI-Key im Gerät
- **Design (1.20)**: tiefes Blaugrau mit weichem Lichtverlauf statt Schwarz, flache Flächen ohne Rahmen; Plan-Karten in Listenfarben (Orange, Blau, Violett, Grün …) mit je eigenem Gerät (Kurzhantel, Langhantel, Kettlebell, Scheiben, Kabelgriff – A/B unterscheidbar). Startseite: Wochenleiste (Mo–So, heute markiert, Trainingstage mit Punkt → Session), laufendes Workout, „Als Nächstes“-Karte (empfohlener Plan) und die Pläne als Bildkarten – Hintergrund ist eine SVG-Illustration in Planfarbe (Farbverlauf, Lichtkanten, Kurzhantel/Kettlebell/Langhantel je nach Zielmuskeln, `js/plan-art.js`) oder ein eigenes Foto (Plan bearbeiten → „Bild der Karte“, verkleinert auf ≤ 1000 px, bleibt im Gerät); Play startet direkt; Plan anlegen über „+“ (Vorlage/PDF/manuell), Plan-Optionen (⋯) in der Plan-Ansicht. Erholung, Wochenrückblick und Stagnations-Hinweis liegen unter „Fortschritt“; dort teilen sich Trainingskalender und Wochen-Chart eine Karte mit ‹ › und die Bestwerte haben eine eigene Seite „Rekorde“ (`/records`). Rezepte-Seite mit „Rezept aus Zutaten“ (KI-Generator) und „Frei beschreiben“. Dashboard mit Wochenring/Serie/letztem PR, Display-Schrift (Space Grotesk) für Titel und Zahlen, eigenes SVG-Icon-Set, Seitenübergänge und Mikro-Animationen (Haken zeichnet sich, Einrasten, Count-up, aufleuchtende Muskelkarte; `prefers-reduced-motion` wird respektiert), fokussierter Workout-Screen (kompakter Kopf, nur der aktuelle Satz groß, Pausenring inline, Auto-Scroll zum Ring), Begrüßung mit Namen (unter „Mehr“), iOS-Splash-Screens, Haptik über switch-Checkbox (iOS 17.4+)
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
js/timer.js           Pausentimer-Engine, Ton (Ambient-Session), Wake Lock
js/backup.js          Sicherung exportieren + Erinnerung
js/cloud.js           Cloud-Backup über GitHub-Gist (Auto-Sync)
js/recovery.js        Erholungsstatus je Muskel, Planvorschlag
js/share.js           Teilbare Workout-Karte (Canvas)
js/milestones.js      Meilensteine
js/standards.js       Kraftstandards
js/speech.js          Sprachansagen
js/exporters.js       CSV + ICS
js/nutrition.js       Ernährung: Makros, Ziele/TDEE, Suche, adaptive Anpassung
js/food-db.js         Basistabelle Lebensmittel
js/off.js             Open Food Facts (Suche, EAN; via Worker /off/* oder direkt)
js/ai-food.js         KI-Freitext → Zutaten
js/pdf-import.js      pdf.js-Textextraktion + Mustererkennung
js/llm.js             KI-Zugang: Hantel-Server (Worker) oder eigener Claude-/OpenAI-Key; runTask()
js/ai-tasks.js        KI-Aufgaben: Prompts, JSON-Schemas, Eingabe-/Antwortprüfung (Client + Worker)
worker/               Cloudflare Worker (index.js generiert aus worker.src.js + ai-tasks.js), README mit Deploy-Schritten
js/ai-import.js       PDF → Trainingspläne (über llm.js)
js/figure.js          Figuren-Renderer (Posen über Gelenkwinkel, konische Kapseln, SMIL-Animation)
js/equipment.js       Gerätebilder (SVG) mit Namen/Beschreibung
js/exercise-db.js     Übungsbibliothek: Figuren, Muskeln, Tipps, Namenszuordnung
js/templates.js       Eingebaute Plan-Vorlagen + Erststart-Seeding
js/progression.js     Double Progression, Gewichtsschritte, PR-Erkennung (Epley-e1RM)
js/muscles.js         Muskelgruppen-Taxonomie, Satz-Auswertung, Körperkarte (SVG)
js/views/*.js         Seiten: Pläne, Plan, Bearbeiten, Import, Workout, Fortschritt, Mehr, Bibliothek, Übungs-Info, Körper
icons/                App-Icons (PNG via tools/make-icons.ps1)
```

## Datenmodell (localStorage `hantel.v1`)

```
plan     { id, name, note, exercises: [{ id, name, sets, reps, weight, restSec, note }] }
session  { id, planId, planName, startedAt, endedAt, durationSec, note,
           entries: [{ exerciseId, name, sessionNote, sets: [{ reps, weight, done, rir, type }] }], deload }
settings { defaultRestSec, autoRestTimer, sound, vibrate, wakeLock, unit, apiKey, aiModel, aiProvider, openaiKey, openaiModel, theme, weeklyGoal,
           barWeight, bgTimerAudio, warmupSets, name, lastBackupAt, lastBackupSessions,
           gistToken, gistId, cloudAutoSync, deloadUntil, volumeMin, volumeMax, sex, speech,
           trainingDays, trainingTime, trainingPlanByDay, milestonesSeen }
customExercises [{ id, name, aliases, primary, secondary, weightStep, barbell, tips }]
foods    [{ id, name, brand, source, per100:{kcal,protein,carbs,fat}, unit, portions, barcode, favorite, uses }]
recipes  [{ id, name, servings, items:[{ foodId, name, grams, per100 }] }]
diary    { "YYYY-MM-DD": [{ id, meal, kind, refId, name, grams, servings, kcal, protein, carbs, fat }] }
```

Übungen werden über ihren Namen (case-insensitiv) über Pläne hinweg zusammengeführt – so zählt
„Bankdrücken“ aus Plan A und Plan B in dieselbe Statistik.
