# Konzept: Übungs- und Gerätedatenbank

Ziel: Wer im Plan-Editor „Brustpresse“ tippt, bekommt sofort passende Treffer mit **Gerät**, **Muskeln**
und **Varianten** – so wie in den großen Trainings-Apps. Grundlage für Wochenbilanz, Erholung,
Progression, Animation und Gerätefoto ist dann immer ein sauberer Datensatz statt einer Namens-Heuristik.

Stand vor dem Umbau (1.28.0): 25 Übungen in `js/exercise-db.js` (538 Zeilen), 18 Gerätetypen in
`js/equipment.js` (16 echte Fotos), 12 Muskelgruppen in `js/muscles.js`, Zuordnung über
`findExercise()` (Alias-Vergleich) mit Regex-Fallback `RULES`.

---

## 1. Datenmodell

### 1.1 Basisübung + Varianten (der Kern)

Eine **Bewegung** (`movement`) beschreibt das Muster einmal; **Varianten** erben alles und überschreiben
nur, was sich unterscheidet. Das hält die Datei klein und die Pflege machbar – sonst schreiben wir
Tipps und Figuren 100-mal ab.

```js
{
  id: 'bankdruecken',
  name: 'Bankdrücken',                  // Langhantel, flach = die Standardvariante
  category: 'chest',                    // für Gruppierung in der Suche
  mechanic: 'compound',                 // compound | isolation
  equip: { type: 'barbell_bench', setup: '…' },
  primary: ['chest'], secondary: ['triceps', 'front_delt'],
  aliases: ['bankdrücken', 'bench press', 'langhantel bankdrücken', 'bd'],
  tips: ['…', '…'],
  fig: { … },                           // Animation wie bisher
  variants: [
    { id: 'bankdruecken-schraeg', name: 'Schrägbankdrücken', suffix: 'Schrägbank',
      primary: ['chest'], secondary: ['front_delt', 'triceps'],
      equip: { type: 'incline_bench' }, aliases: ['schrägbankdrücken', 'incline bench'],
      tipsAdd: ['30–45° reichen; steiler wandert die Last in die Schulter.'] },
    { id: 'bankdruecken-kh', name: 'Kurzhantel-Bankdrücken', equip: { type: 'dumbbell' }, … },
    { id: 'bankdruecken-maschine', name: 'Brustpresse', equip: { type: 'chest_press' }, … },
  ],
}
```

Regeln:
- Variante erbt `category`, `mechanic`, `primary`, `secondary`, `tips`, `fig`, `equip` – überschreibt
  einzeln. `tipsAdd` hängt variantenspezifische Hinweise an.
- Fehlt der Variante eine `fig`, wird die Figur der Basisübung gezeigt (mit dem Gerät der Variante).
- Jede Variante bleibt ein eigener Eintrag mit eigener `id` – Historie, Rekorde und Progression
  rechnen weiterhin pro Übungsname.

### 1.2 Neue Felder (über den heutigen Stand hinaus)

| Feld | Zweck |
|---|---|
| `category` | Gruppierung in der Suche (Brust, Rücken, Schultern, Arme, Beine, Rumpf) |
| `mechanic` | `compound`/`isolation` → Vorschlag für Satzzahl, Pause und Reihenfolge im Plan |
| `unilateral` | einseitig (Ausfallschritt, Kickback) → Sätze zählen je Seite |
| `weightStep` | 1,25 / 2,5 / 5 kg – heute geraten in `inferWeightStep()`, künftig am Eintrag |
| `defaultReps`, `defaultRest` | Vorbelegung beim Anlegen im Plan |
| `equip.attachment` | Aufsatz am Kabelzug (Seil, Stange, Einzelgriff …) – existiert schon |
| `level` | Einsteiger / Fortgeschritten – nur als Hinweis in der Suche |

### 1.3 Muskeln

Die 12 Gruppen bleiben. Zusätzlich optional `ratio` je Muskel (z. B. Brust 1,0 / Trizeps 0,5), damit
die Wochenbilanz feiner rechnet als das heutige starre „primär 1,0 / sekundär 0,5“. Umstellung erst,
wenn die Daten stehen – sonst verschieben sich bestehende Statistiken mitten im Aufbau.

---

## 2. Umfang: ~100 Übungen in 6 Wellen

Jede Welle ist ein eigener Commit mit eigener Version, danach prüfst du sie im Studio-Alltag.

| Welle | Bereich | ca. | Enthält u. a. |
|---|---|---|---|
| 1 | Brust | 14 | Bankdrücken (LH flach/schräg/negativ), KH-Varianten, Brustpresse, Butterfly, Kabel-Flys (hoch/mittig/tief), Dips, Liegestütze |
| 2 | Rücken | 22 | Klimmzüge (breit/eng/neutral/Untergriff), Latzug-Varianten, Rudern (LH/KH/Kabel/T-Bar/Maschine/brustgestützt), Überzüge, Face Pull, Hyperextension, Kreuzheben (konventionell/Sumo/RDL) |
| 3 | Schultern | 12 | Schulterdrücken (LH/KH/Maschine/Arnold), Seitheben (KH/Kabel/Maschine), Frontheben, Upright Row, Reverse Pec Deck |
| 4 | Arme | 16 | Bizeps (LH/SZ/KH/Hammer/Scott/Kabel/Konzentration), Trizeps (Pushdown Seil/Stange, Überkopf, French Press, Kickback, Dip-Maschine) |
| 5 | Beine | 24 | Kniebeuge (High/Low Bar, Front, Goblet), Hackenschmidt, Beinpresse, Ausfallschritte (Walking/Split/Bulgarian), Beinstrecker, Beinbeuger (sitzend/liegend), Good Morning, Hip Thrust, Ad-/Abduktoren, Waden (stehend/sitzend/Beinpresse) |
| 6 | Rumpf + Feinschliff | 12 | Kabel-Crunch, Crunch-Maschine, Beinheben (hängend/liegend), Plank, Ab Wheel, Russian Twist; danach Aliase und Lücken aus deinem Alltag |

Aliase je Eintrag deutsch **und** englisch, plus die üblichen Studio-Kürzel („BD“, „KH-Bank“, „Lat“).
Ziel: ~500 Suchbegriffe, damit Import und Suche fast immer treffen.

---

## 3. Dateien und Größe

`js/exercise-db.js` wächst sonst auf ~3.000 Zeilen. Deshalb Aufteilung:

```
js/exercise-db.js        Lookup-API (findExercise, search, getExercise, Vererbung auflösen)
js/data/ex-chest.js      Daten Welle 1
js/data/ex-back.js       Daten Welle 2
…                        je Welle eine Datei
js/data/figures.js       Wiederverwendbare Figuren-Bausteine (SEAT, GROUND, seated(), …)
```

Alle Datendateien werden von `exercise-db.js` importiert – kein Build nötig, aber jede Datei muss in die
`SHELL`-Liste von `sw.js`. Faustregel: rohe Daten (ohne Figuren) ~250 Byte pro Übung, also ~25 KB für
100 Übungen – unkritisch. Figuren nur für Basisübungen, Varianten erben.

---

## 4. Suche und Oberfläche

### 4.1 Neues Übungs-Auswahl-Sheet (`js/views/exercise-picker.js`)

Ein Sheet, das überall dasselbe kann:
- Suchfeld (Live-Treffer ab 2 Zeichen, unscharf: „bankdr“, „bench“, „brustpr“)
- Filterzeile: Muskelgruppe · Gerät · nur meine Geräte
- Trefferzeile: kleines Gerätefoto, Name, darunter „Brust · Trizeps, vordere Schulter“ und das Gerät
- Antippen öffnet die Variantenliste („Bankdrücken – 4 Varianten“), Auswahl übernimmt Name + Gerät +
  Gewichtsschritt + Vorgaben für Sätze/Wdh/Pause
- Fuß: „Eigene Übung anlegen“ (bestehender Editor), damit nichts blockiert

Eingebaut an drei Stellen:
1. **Plan-Editor** – ersetzt das heutige Textfeld mit `datalist` (`js/views/plan-edit.js:77`)
2. **Training → Übung tauschen** – nutzt schon `EXERCISES`, bekommt dieselbe Suche
3. **Übungsbibliothek** – Suchfeld oben statt der festen Zweiteilung „Oberkörper / Unterkörper“

### 4.2 Zuordnung bestehender Daten

`findExercise()` bekommt zusätzlich unscharfe Suche (Wortanfang, Tippfehler-Toleranz). Wichtig: Namen
aus alten Sessions bleiben unverändert – die Datenbank verbessert nur die Zuordnung, benennt nichts um.
Ein Prüfbildschirm („Diese Übungen kennt die App nicht: …“) hilft, Altlasten einmalig zuzuordnen.

---

## 5. Geräte

`js/equipment.js` wächst um die Typen, die in den Wellen auftauchen: Schrägbank-LH, T-Bar-Rudern,
Multipresse, Beinbeuger liegend, Adduktoren/Abduktoren, Hyperextension, Dip-Station, SZ-Stange,
Scott-Bank, Klimmzugstange. Für jeden Typ: Zeichnung (haben wir) und möglichst ein CC-Foto (wie
bisher Wikimedia/Flickr, Nachweis unter „Mehr“). Wo kein freies Foto existiert, bleibt die Zeichnung –
plus dein eigenes Studio-Foto, das die App schon je Gerätetyp speichern kann.

---

## 6. Qualitätssicherung

Eine Dev-Seite `tools/exercise-check.html` (nicht im App-Menü), die beim Öffnen alle Einträge prüft:
- Aliase eindeutig, keine Dopplung zwischen Übungen
- `primary` gesetzt, Muskel-Keys gültig
- `equip.type` existiert in `EQUIPMENT`
- Figur rendert ohne Fehler (Start- und Endpose)
- Vererbung aufgelöst: jede Variante hat Name, Muskeln, Gerät

Dazu eine Galerie, in der alle Übungen mit Figur und Gerätefoto untereinander stehen – so kannst du
eine Welle in zwei Minuten durchsehen und sagen, was nicht stimmt.

---

## 7. Ablauf, damit es reibungslos läuft

1. **Welle 0 (Technik, keine neuen Übungen)**: Modell, Vererbung, Dateiaufteilung, Prüfseite,
   bestehende 25 Übungen migriert. Danach sieht die App identisch aus – nur die Basis ist neu.
2. **Welle 1–6 (Inhalt)**: je Welle Daten + Geräte + Prüfseite, ein Commit, eine Version.
   Nach jeder Welle bekommst du eine Liste der neuen Übungen zum Gegenlesen.
3. **Welle 7 (Suche)**: Auswahl-Sheet in Plan-Editor, Training und Bibliothek.
4. **Welle 8 (Feinschliff)**: Gewichtsschritte, Vorgaben für Sätze/Wdh/Pause, optional `ratio` für die
   Wochenbilanz, Zuordnungs-Prüfbildschirm für alte Namen.

Was ich von dir brauche – am besten vorab, sonst frage ich zwischendurch:
- **Welche Geräte stehen in deinem Studio?** (Fotos oder Namen). Danach richte ich die Gerätetypen und
  den Filter „nur meine Geräte“ aus.
- **Welche Übungen machst du regelmäßig, die heute fehlen?** Die kommen vorn in ihre Welle.
- Nach jeder Welle: kurzer Blick auf die Liste, was heißt bei dir anders (Studio-Sprache), was fehlt.

Aufwand grob: Welle 0 ein Arbeitsschritt, danach je Welle ein Schritt – zusammen also überschaubar,
aber verteilt, damit du jede Stufe prüfen kannst, statt am Ende 100 Übungen auf einmal.

---

## 8. Vergleich mit anderen Apps (Stand 09/2026)

| App | Übungen | Charakter |
|---|---|---|
| Jefit | ~1.300–1.400 | größte Sammlung, viele Dubletten und exotische Varianten |
| Alpha Progression | 795 | kuratiert, jede Übung mit Video und Anleitung |
| Hevy | 300–400 | solide Standardauswahl |
| Strong | ~200 Vorlagen | bewusst klein, dafür beliebig eigene Übungen |
| **Hantel (1.29.0)** | **106** (41 Bewegungen) | Basis + Varianten, jede mit Animation, Gerät, Tipps |

Einordnung: Die großen Zahlen entstehen vor allem durch Varianten, die bei uns zu einer Bewegung
gehören („Bankdrücken“ mit fünf Varianten sind dort fünf bis sechs Einträge). Mit 106 Einträgen liegen
wir auf Augenhöhe mit Strong und etwas unter Hevy – und decken ab, was in einem deutschen Studio steht.
Wachstumspfad bis ~180, sobald der Alltag Lücken zeigt: mehr Maschinenvarianten (Marken-Setups),
einarmige Kabelvarianten, Unterarme/Nacken, Functional (Kettlebell-Swing, Farmer's Walk, Sled),
Dehn- und Mobilitätsübungen. Eingebaut wird das über neue Varianten in `js/data/ex-*.js` – ohne
Änderungen am Code.

## 9. Umgesetzt in 1.29.0

- Datenmodell mit Vererbung (`js/data/ex-*.js`, `js/data/figures.js`, Loader in `js/exercise-db.js`)
- 106 Übungen in 6 Kategorien, 41 Bewegungen, 32 Gerätetypen (14 neue Geräte gezeichnet)
- Suche `searchExercises()` mit Muskel-, Geräte- und Kategoriefilter, Umlaut-tolerant, deutsch/englisch
- Auswahl-Sheet `js/views/exercise-picker.js` im Plan-Editor (Gerät, Muskeln, Varianten, Direktübernahme
  mit Gewichtsschritt und Pausenvorgabe), Suchfeld in der Übungsbibliothek
- Prüfseite `tools/exercise-check.html`: validiert Aliase, Muskeln, Geräte, Figuren und Suchtreffer und
  zeigt alle Übungen als Galerie

Offen für die nächste Runde: Auswahl auch beim „Übung tauschen“ im Training, Filter „nur meine Geräte“,
Fotos für die neuen Gerätetypen, `ratio` für die Wochenbilanz.
