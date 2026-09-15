// Übungsbibliothek: Muskeln, Ausführungstipps und Bewegungsfiguren.
// Figuren beschreiben Start- und Endposition (siehe figure.js).
import { renderFigure } from './figure.js';

// ---------- Wiederverwendbare Bausteine ----------

const GROUND = { t: 'ground', y: 142 };
// Sitzende Grundpose an einer Maschine (Hüfte 90/92, Blick nach rechts)
const SEAT = [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'rect', x: 82, y: 48, w: 6, h: 46 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142 }, GROUND];
const seated = (extra = {}) => ({ hip: [90, 92], torso: 180, thigh: 90, shin: 0, foot: 90, ...extra });
const standing = (extra = {}) => ({ hip: [100, 82], torso: 180, thigh: 0, shin: 0, foot: 90, ...extra });

/** Einträge in Reihenfolge der Spezifität (spezifische Aliase zuerst) */
export const EXERCISES = [
  // ================= OBERKÖRPER =================
  {
    id: 'brustpresse', name: 'Brustpresse',
    equip: { type: 'chest_press', setup: 'Sitzhöhe so, dass die Griffe auf Brusthöhe liegen; Rücken und Kopf am Polster.' },
    primary: ['chest'], secondary: ['triceps','front_delt'],
    aliases: ['brustpresse', 'chest press', 'brustpresse maschine', 'bankdrücken maschine'],
    muscles: 'Brust, vordere Schulter, Trizeps',
    tips: [
      'Schulterblätter nach hinten-unten ziehen und während des ganzen Satzes stabil am Polster lassen.',
      'Griffe etwa auf Brusthöhe einstellen; Ellbogen bleiben leicht unter Schulterhöhe.',
      'Drücken, ohne die Ellbogen ganz durchzustrecken – Spannung bleibt auf der Brust.',
    ],
    fig: {
      view: 'side', label: 'Brustpresse',
      static: [...SEAT, { t: 'line', x1: 150, y1: 30, x2: 150, y2: 142, w: 4 }, { t: 'circle', x: 150, y: 30, r: 3 }],
      moving: [{ t: 'lever', from: [150, 30], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
      poses: [seated({ uarm: -100, farm: 90 }), seated({ uarm: 90, farm: 90 })],
    },
  },
  {
    id: 'latzug-neutral', name: 'Latzug, neutraler Griff',
    equip: { type: 'lat_pulldown', attachment: 'V-Griff / paralleler Doppelgriff (neutral)', setup: 'Oberschenkelpolster fest einstellen, Füße flach auf dem Boden.' },
    primary: ['back'], secondary: ['biceps','rear_delt'],
    aliases: ['latzug neutraler griff', 'latzug neutral', 'latziehen neutral', 'lat pulldown neutral'],
    muscles: 'Latissimus, unterer Trapez, Bizeps',
    tips: [
      'Ellbogen Richtung Hüfte ziehen – nicht den Griff zur Brust „reißen“.',
      'Oberkörper ruhig, nur minimal zurücklehnen; Brust bleibt aufgerichtet.',
      'Oben die Arme kontrolliert lang werden lassen und die Dehnung im Lat spüren.',
    ],
    fig: 'latzug',
  },
  {
    id: 'latzug-breit', name: 'Latzug, schulterbreiter Griff',
    equip: { type: 'lat_pulldown', attachment: 'Lange Latzugstange, schulterbreit bis etwas weiter greifen', setup: 'Oberschenkelpolster fest, Stange vor dem Setzen greifen.' },
    primary: ['back'], secondary: ['biceps','rear_delt'],
    aliases: ['latzug schulterbreiter griff', 'latzug schulterbreit', 'latzug breit', 'latzug', 'latziehen', 'lat pulldown', 'latzug zur brust'],
    muscles: 'Latissimus, oberer Rücken, Bizeps',
    tips: [
      'Griff schulterbreit, Stange zur oberen Brust ziehen – kein Reißen, kein Schwung.',
      'Schulterblätter zuerst nach unten ziehen, dann die Ellbogen.',
      'Kopf neutral, nicht nach vorn ducken; die Stange geht knapp am Kinn vorbei.',
    ],
    fig: {
      view: 'side', label: 'Latzug',
      static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142 }, GROUND,
        { t: 'line', x1: 100, y1: 4, x2: 150, y2: 4, w: 4 }, { t: 'line', x1: 150, y1: 4, x2: 150, y2: 142, w: 4 },
        { t: 'circle', x: 100, y: 6, r: 4 }, { t: 'rect', x: 104, y: 82, w: 22, h: 6 }],
      moving: [{ t: 'cable', from: [100, 6], to: 'wr' }, { t: 'bar', at: 'wr', w: 6, a: 90 }],
      poses: [seated({ torso: 186, uarm: 176, farm: 178 }), seated({ torso: 190, uarm: -18, farm: 148 })],
    },
  },
  {
    id: 'rudern-brustgestuetzt', name: 'Rudern, brustgestützt',
    equip: { type: 'row_machine', attachment: 'Neutrale (parallele) Griffe, falls wählbar', setup: 'Brustpolster so, dass die Griffe auf Höhe der unteren Brust liegen; Sitz so hoch, dass die Arme waagerecht ziehen.' },
    primary: ['back'], secondary: ['biceps','rear_delt'],
    aliases: ['rudern brustgestützt', 'brustgestütztes rudern', 'chest supported row', 'rudern maschine'],
    muscles: 'Oberer Rücken, Latissimus, hintere Schulter, Bizeps',
    tips: [
      'Brust bleibt die ganze Zeit am Polster – kein Aufrichten oder Schwung aus dem Rücken.',
      'Ellbogen nach hinten führen, Schulterblätter am Ende bewusst zusammenziehen.',
      'Vorn die Arme lang werden lassen, Schultern dürfen leicht nach vorn kommen.',
    ],
    fig: {
      view: 'side', label: 'Rudern brustgestützt',
      static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142 }, GROUND,
        { t: 'rect', x: 108, y: 46, w: 6, h: 40, rot: 20 }, { t: 'line', x1: 152, y1: 122, x2: 152, y2: 142, w: 4 }],
      moving: [{ t: 'lever', from: [152, 122], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
      poses: [seated({ torso: 160, uarm: 78, farm: 80 }), seated({ torso: 160, uarm: -55, farm: 72 })],
    },
  },
  {
    id: 'kabel-flys', name: 'Kabel-Flys',
    equip: { type: 'cable_crossover', attachment: 'Zwei Einzelgriffe (D-Griffe)', setup: 'Rollen etwa auf Schulterhöhe oder leicht darüber, ein Schritt nach vorn in Schrittstellung.' },
    primary: ['chest'], secondary: ['front_delt'],
    aliases: ['kabel flys', 'kabelflys', 'cable fly', 'cable flys', 'fliegende am kabel', 'kabelzug fliegende', 'flys'],
    muscles: 'Brust, vordere Schulter',
    tips: [
      'Ellbogen leicht gebeugt und diesen Winkel während der Bewegung nicht verändern.',
      'Kontrolliert weit öffnen, bis eine deutliche Dehnung in der Brust spürbar ist.',
      'Hände vor der Brust zusammenführen, als würdest du einen Baum umarmen – Schultern bleiben unten.',
    ],
    fig: {
      view: 'top', label: 'Kabel-Flys', box: '0 0 200 130',
      static: [{ t: 'circle', x: 14, y: 26, r: 4 }, { t: 'circle', x: 186, y: 26, r: 4 }, { t: 'line', x1: 14, y1: 8, x2: 14, y2: 26, w: 3 }, { t: 'line', x1: 186, y1: 8, x2: 186, y2: 26, w: 3 }],
      moving: [{ t: 'cable', from: [14, 26], to: 'wrL' }, { t: 'cable', from: [186, 26], to: 'wrR' }, { t: 'plate', at: 'wrL', r: 3 }, { t: 'plate', at: 'wrR', r: 3 }],
      poses: [{ hip: [100, 50], uarmL: -100, farmL: -78, uarmR: 100, farmR: 78 }, { hip: [100, 50], uarmL: -5, farmL: 25, uarmR: 5, farmR: -25 }],
    },
  },
  {
    id: 'seitheben-kabel', name: 'Seitheben am Kabel',
    equip: { type: 'cable_tower', attachment: 'Einzelgriff (D-Griff)', setup: 'Rolle ganz unten, seitlich zur Säule stehen, Kabel läuft vor dem Körper.' },
    primary: ['side_delt'], secondary: [],
    aliases: ['seitheben am kabel', 'seitheben kabel', 'kabel seitheben', 'cable lateral raise', 'seitheben einarmig'],
    muscles: 'Seitliche Schulter',
    tips: [
      'Arm seitlich bis etwa Schulterhöhe anheben, Ellbogen minimal gebeugt und leicht vor dem Körper.',
      'Nicht mit dem Oberkörper schwingen – wenn es nur mit Schwung geht, ist das Gewicht zu hoch.',
      'Langsam absenken (2–3 s) und unten die Spannung halten, nicht ablegen.',
    ],
    fig: {
      view: 'front', label: 'Seitheben am Kabel',
      static: [{ t: 'rect', x: 24, y: 14, w: 6, h: 128 }, { t: 'circle', x: 27, y: 136, r: 4 }, GROUND],
      moving: [{ t: 'cable', from: [27, 136], to: 'wrR' }, { t: 'plate', at: 'wrR', r: 3 }],
      poses: [{ hip: [100, 84], torso: 180, uarmL: -12, farmL: -12, uarmR: -14, farmR: -18 }, { hip: [100, 84], torso: 180, uarmL: -12, farmL: -12, uarmR: 86, farmR: 92 }],
    },
  },
  {
    id: 'reverse-flys', name: 'Reverse-Flys, Maschine',
    equip: { type: 'pec_deck', setup: 'Arme in die hintere Position stellen (Reverse-Fly-Modus), Sitz so, dass die Griffe auf Schulterhöhe sind.' },
    primary: ['rear_delt'], secondary: ['back'],
    aliases: ['reverse flys maschine', 'reverse flys', 'reverse fly', 'butterfly reverse', 'rear delt fly', 'reverse butterfly'],
    muscles: 'Hintere Schulter, oberer Rücken (Rhomboiden, Trapez)',
    tips: [
      'Griffe auf Schulterhöhe einstellen, Arme mit leicht gebeugten Ellbogen weit nach außen-hinten führen.',
      'Nacken locker lassen, Schultern nicht hochziehen – die Bewegung kommt aus der hinteren Schulter.',
      'Jede Wiederholung auf derselben Bahn, am Ende kurz halten, dann langsam zurück.',
    ],
    fig: {
      view: 'top', label: 'Reverse-Flys', box: '0 0 200 130',
      static: [{ t: 'rect', x: 86, y: 58, w: 28, h: 6 }],
      moving: [{ t: 'lever', from: [100, 52], to: 'wrL' }, { t: 'lever', from: [100, 52], to: 'wrR' }, { t: 'plate', at: 'wrL', r: 3 }, { t: 'plate', at: 'wrR', r: 3 }],
      poses: [{ hip: [100, 52], uarmL: -12, farmL: 6, uarmR: 12, farmR: -6 }, { hip: [100, 52], uarmL: -100, farmL: -108, uarmR: 100, farmR: 108 }],
    },
  },
  {
    id: 'bizepscurls-kabel', name: 'Bizepscurls am Kabel',
    equip: { type: 'cable_tower', attachment: 'Gerade Stange oder SZ-Stange', setup: 'Rolle ganz unten, einen halben Schritt zurück, Oberarme am Körper.' },
    primary: ['biceps'], secondary: [],
    aliases: ['bizepscurls am kabel', 'bizepscurls kabel', 'kabelcurls', 'cable curl', 'bizeps kabel', 'bizepscurls', 'bizeps curls', 'curls'],
    muscles: 'Bizeps, Unterarm',
    tips: [
      'Oberarme bleiben ruhig am Körper – nur der Unterarm bewegt sich.',
      'Oben nicht die Ellbogen nach vorn schieben; Handgelenke gerade halten.',
      'Unten die Ellbogen kontrolliert fast strecken, ohne die Spannung zu verlieren.',
    ],
    fig: {
      view: 'side', label: 'Bizepscurls am Kabel',
      static: [{ t: 'rect', x: 168, y: 14, w: 6, h: 128 }, { t: 'circle', x: 171, y: 136, r: 4 }, GROUND],
      moving: [{ t: 'cable', from: [171, 136], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
      poses: [standing({ uarm: 8, farm: 20 }), standing({ uarm: 8, farm: 158 })],
    },
  },
  {
    id: 'trizepsdruecken-kabel', name: 'Trizepsdrücken am Kabel',
    equip: { type: 'cable_tower', attachment: 'Seil (Rope) oder gerade Stange', setup: 'Rolle ganz oben, nah an die Säule, Ellbogen eng am Körper.' },
    primary: ['triceps'], secondary: [],
    aliases: ['trizepsdrücken am kabel', 'trizepsdrücken kabel', 'trizeps kabel', 'pushdown', 'triceps pushdown', 'trizepsdrücken', 'trizeps drücken'],
    muscles: 'Trizeps',
    tips: [
      'Ellbogen eng am Körper fixieren; sie wandern weder vor noch zurück.',
      'Schultern unten lassen und nicht nach vorn schieben – der Oberkörper bleibt aufrecht.',
      'Unten voll strecken und kurz anspannen, dann langsam bis etwa 90° zurück.',
    ],
    fig: {
      view: 'side', label: 'Trizepsdrücken am Kabel',
      static: [{ t: 'rect', x: 148, y: 6, w: 6, h: 136 }, { t: 'circle', x: 146, y: 12, r: 4 }, GROUND],
      moving: [{ t: 'cable', from: [146, 12], to: 'wr' }, { t: 'bar', at: 'wr', w: 5, a: 90 }],
      poses: [standing({ torso: 176, uarm: 12, farm: 140 }), standing({ torso: 176, uarm: 12, farm: 22 })],
    },
  },
  {
    id: 'schraegbank-kh', name: 'Schrägbankdrücken, Kurzhanteln',
    equip: { type: 'incline_bench', attachment: 'Kurzhanteln', setup: 'Bank auf 15–30° stellen, Sitzfläche leicht anheben, damit du nicht rutschst.' },
    primary: ['chest'], secondary: ['front_delt','triceps'],
    aliases: ['schrägbankdrücken kurzhanteln', 'schrägbankdrücken kh', 'schrägbankdrücken', 'incline press', 'incline dumbbell press', 'schrägbank drücken'],
    muscles: 'Obere Brust, vordere Schulter, Trizeps',
    tips: [
      'Bank auf 15–30° stellen; flacher = mehr Brust, steiler = mehr Schulter.',
      'Unterarme senkrecht unter den Hanteln halten, Ellbogen etwa 45° vom Körper.',
      'Absenken bis die Hanteln auf Höhe der oberen Brust sind, Schulterblätter bleiben zusammengezogen.',
    ],
    fig: {
      view: 'side', label: 'Schrägbankdrücken',
      static: [{ t: 'line', x1: 60, y1: 113, x2: 128, y2: 74, w: 7 }, { t: 'rect', x: 58, y: 106, w: 24, h: 7 }, { t: 'line', x1: 70, y1: 113, x2: 70, y2: 142, w: 4 }, { t: 'line', x1: 114, y1: 82, x2: 114, y2: 142, w: 4 }, GROUND],
      moving: [{ t: 'plate', at: 'wr', r: 5 }, { t: 'plate', at: 'wr2', r: 5 }],
      poses: [
        { hip: [70, 100], torso: 120, head: 120, thigh: 70, shin: 0, foot: 90, uarm: -60, farm: 176, uarm2: -60, farm2: 176 },
        { hip: [70, 100], torso: 120, head: 120, thigh: 70, shin: 0, foot: 90, uarm: 212, farm: 210, uarm2: 212, farm2: 210 },
      ],
    },
  },
  {
    id: 'rudern-kabel', name: 'Rudern am Kabel',
    equip: { type: 'seated_row_cable', attachment: 'V-Griff (enger Neutralgriff)', setup: 'Rolle ganz unten, Füße auf die Platten, Knie leicht gebeugt.' },
    primary: ['back'], secondary: ['biceps','rear_delt'],
    aliases: ['rudern am kabel', 'kabelrudern', 'rudern kabel', 'seated row', 'cable row', 'rudern sitzend', 'rudern'],
    muscles: 'Latissimus, oberer Rücken, hintere Schulter, Bizeps',
    tips: [
      'Rumpf stabil und aufrecht; der Oberkörper pendelt höchstens ein paar Grad.',
      'Ellbogen dicht am Körper nach hinten ziehen, Griff Richtung Bauch, Schulterblätter zusammen.',
      'Kontrolliert nach vorn reichen lassen – die Schultern dürfen leicht mit nach vorn.',
    ],
    fig: {
      view: 'side', label: 'Rudern am Kabel',
      static: [{ t: 'rect', x: 50, y: 100, w: 40, h: 6 }, { t: 'line', x1: 70, y1: 106, x2: 70, y2: 142, w: 4 }, { t: 'rect', x: 118, y: 108, w: 6, h: 30, rot: -20 }, { t: 'rect', x: 176, y: 40, w: 6, h: 102 }, { t: 'circle', x: 178, y: 92, r: 4 }, GROUND],
      moving: [{ t: 'cable', from: [178, 92], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
      poses: [
        { hip: [70, 100], torso: 178, thigh: 80, shin: 30, foot: 100, uarm: 88, farm: 88 },
        { hip: [70, 100], torso: 188, thigh: 80, shin: 30, foot: 100, uarm: -30, farm: 100 },
      ],
    },
  },
  {
    id: 'butterfly', name: 'Butterfly-Maschine',
    equip: { type: 'pec_deck', setup: 'Griffe auf Höhe der Brustmitte, Arme in der vorderen Position (Butterfly-Modus).' },
    primary: ['chest'], secondary: ['front_delt'],
    aliases: ['butterfly maschine', 'butterfly', 'pec deck', 'brustmaschine'],
    muscles: 'Brust, vordere Schulter',
    tips: [
      'Sitz so einstellen, dass die Griffe auf Höhe der Brustmitte sind; Ellbogen leicht gebeugt.',
      'Brustkorb aufgerichtet und stabil, Schulterblätter am Polster – nicht mit den Schultern nach vorn ausweichen.',
      'Weit öffnen bis zur Dehnung, aber ohne dass die Schultern nach vorn kippen; langsam zurück.',
    ],
    fig: {
      view: 'top', label: 'Butterfly', box: '0 0 200 130',
      static: [{ t: 'rect', x: 84, y: 40, w: 32, h: 6 }],
      moving: [{ t: 'lever', from: [100, 50], to: 'elbL' }, { t: 'lever', from: [100, 50], to: 'elbR' }, { t: 'plate', at: 'wrL', r: 3 }, { t: 'plate', at: 'wrR', r: 3 }],
      poses: [{ hip: [100, 50], uarmL: -95, farmL: -6, uarmR: 95, farmR: 6 }, { hip: [100, 50], uarmL: 8, farmL: 4, uarmR: -8, farmR: -4 }],
    },
  },
  {
    id: 'seitheben-kh', name: 'Seitheben, Kurzhanteln',
    equip: { type: 'dumbbells', setup: 'Leichte Hanteln – meist 4–10 kg reichen.' },
    primary: ['side_delt'], secondary: [],
    aliases: ['seitheben kurzhanteln', 'seitheben kh', 'seitheben', 'lateral raise', 'dumbbell lateral raise', 'seitheben stehend'],
    muscles: 'Seitliche Schulter',
    tips: [
      'Arme seitlich bis etwa Schulterhöhe heben, Ellbogen leicht gebeugt und minimal vor dem Körper.',
      'Kontrolliert absenken (2–3 s), nicht hochzucken und nicht mit dem Oberkörper schwingen.',
      'Handgelenke neutral, Daumen zeigen leicht nach oben oder gerade – kein „Kanne ausgießen“.',
    ],
    fig: {
      view: 'front', label: 'Seitheben',
      static: [GROUND],
      moving: [{ t: 'dumbbell', at: 'wrL' }, { t: 'dumbbell', at: 'wrR' }],
      poses: [{ hip: [100, 84], torso: 180, uarmL: -10, farmL: -10, uarmR: 10, farmR: 10 }, { hip: [100, 84], torso: 180, uarmL: -84, farmL: -72, uarmR: 84, farmR: 72 }],
    },
  },
  {
    id: 'schraegbank-curls', name: 'Schrägbank-Bizepscurls',
    equip: { type: 'incline_bench', attachment: 'Kurzhanteln', setup: 'Bank auf 45–60°, Kopf und Rücken anlehnen, Arme frei hängen lassen.' },
    primary: ['biceps'], secondary: [],
    aliases: ['schrägbank bizepscurls', 'schrägbankcurls', 'schrägbank curls', 'incline curl', 'incline dumbbell curl', 'schrägbank bizeps'],
    muscles: 'Bizeps (langer Kopf), Unterarm',
    tips: [
      'Oberarme locker nach unten hängen lassen – der Ellbogen wandert beim Curl nicht nach vorn.',
      'Rücken und Kopf am Polster, Schultern unten; nur die Unterarme bewegen sich.',
      'Unten die Arme fast ganz strecken, die Dehnung im Bizeps spüren, dann kontrolliert hochcurlen.',
    ],
    fig: {
      view: 'side', label: 'Schrägbank-Curls',
      static: [{ t: 'line', x1: 78, y1: 102, x2: 52, y2: 40, w: 7 }, { t: 'rect', x: 70, y: 98, w: 30, h: 6 }, { t: 'line', x1: 85, y1: 104, x2: 85, y2: 142, w: 4 }, GROUND],
      moving: [{ t: 'plate', at: 'wr', r: 5 }, { t: 'plate', at: 'wr2', r: 5 }],
      poses: [
        { hip: [80, 98], torso: 200, thigh: 90, shin: 0, foot: 90, uarm: -6, farm: -4, uarm2: -6, farm2: -4 },
        { hip: [80, 98], torso: 200, thigh: 90, shin: 0, foot: 90, uarm: -6, farm: 150, uarm2: -6, farm2: 150 },
      ],
    },
  },
  {
    id: 'ueberkopf-trizeps', name: 'Überkopf-Trizeps am Kabel',
    equip: { type: 'cable_tower', attachment: 'Seil (Rope)', setup: 'Rolle unten oder auf Hüfthöhe, mit dem Rücken zur Säule, Schrittstellung.' },
    primary: ['triceps'], secondary: [],
    aliases: ['überkopf trizeps am kabel', 'überkopf trizeps', 'überkopf trizepsdrücken', 'overhead triceps', 'trizeps überkopf', 'french press kabel'],
    muscles: 'Trizeps (langer Kopf)',
    tips: [
      'Rumpf stabil, Schrittstellung, leicht nach vorn geneigt – kein Hohlkreuz beim Strecken.',
      'Ellbogen zeigen nach vorn-oben und bleiben nah am Kopf; nur beugen und strecken.',
      'Hinten die Dehnung im Trizeps zulassen, dann bis zur vollen Streckung nach vorn drücken.',
    ],
    fig: {
      view: 'side', label: 'Überkopf-Trizeps',
      static: [{ t: 'rect', x: 20, y: 10, w: 6, h: 132 }, { t: 'circle', x: 26, y: 30, r: 4 }, GROUND],
      moving: [{ t: 'cable', from: [26, 30], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
      poses: [
        { hip: [92, 82], torso: 166, thigh: 22, shin: 0, foot: 90, thigh2: -22, shin2: 0, uarm: 168, farm: -95, uarm2: 168, farm2: -95 },
        { hip: [92, 82], torso: 166, thigh: 22, shin: 0, foot: 90, thigh2: -22, shin2: 0, uarm: 168, farm: 172, uarm2: 168, farm2: 172 },
      ],
    },
  },

  // ================= UNTERKÖRPER =================
  {
    id: 'hackenschmidt', name: 'Hackenschmidt-Kniebeuge',
    equip: { type: 'hack_squat', setup: 'Schulterpolster einstellen, Füße mittig bis leicht vorn auf der Plattform, Sicherung lösen.' },
    primary: ['quads'], secondary: ['glutes'],
    aliases: ['hackenschmidt kniebeuge', 'hackenschmidt', 'hack squat', 'hackschmidt', 'hack kniebeuge'],
    muscles: 'Quadrizeps, Gesäß',
    tips: [
      'Füße etwa schulterbreit und stabil auf der Plattform, Fersen bleiben unten.',
      'So tief wie kontrolliert möglich – Knie folgen der Fußspitze, Rücken und Kopf am Polster.',
      'Aus der Tiefe gleichmäßig hochdrücken, oben die Knie nicht komplett durchstrecken.',
    ],
    fig: {
      view: 'side', label: 'Hackenschmidt-Kniebeuge',
      static: [{ t: 'line', x1: 114, y1: 108, x2: 80, y2: 14, w: 7 }, { t: 'line', x1: 128, y1: 116, x2: 96, y2: 28, w: 3 }, { t: 'rect', x: 92, y: 130, w: 44, h: 6 }, { t: 'line', x1: 92, y1: 136, x2: 92, y2: 142, w: 4 }, { t: 'line', x1: 136, y1: 136, x2: 136, y2: 142, w: 4 }, GROUND],
      moving: [{ t: 'pad', at: 'sh', w: 8, a: 110 }],
      poses: [
        { hip: [100, 70], torso: 200, thigh: 10, shin: 10, foot: 100, uarm: -40, farm: 175 },
        { hip: [110, 96], torso: 200, thigh: 55, shin: -55, foot: 100, uarm: -40, farm: 175 },
      ],
    },
  },
  {
    id: 'rdl', name: 'Rumänisches Kreuzheben',
    equip: { type: 'barbell', attachment: 'Langhantel, Obergriff schulterbreit', setup: 'Stange aus dem Rack auf Hüfthöhe nehmen oder vom Boden.' },
    primary: ['hamstrings'], secondary: ['glutes','back'],
    aliases: ['rumänisches kreuzheben', 'romanian deadlift', 'rdl', 'kreuzheben gestreckt', 'kreuzheben'],
    muscles: 'Beinbeuger, Gesäß, Rückenstrecker',
    tips: [
      'Bewegung kommt aus der Hüfte: Po nach hinten schieben, Knie nur leicht gebeugt.',
      'Stange bleibt nah am Körper (an den Oberschenkeln entlang), Rücken neutral und stabil.',
      'Nur so tief, wie der Rücken gerade bleibt – meist bis kurz unters Knie – dann Hüfte nach vorn strecken.',
    ],
    fig: {
      view: 'side', label: 'Rumänisches Kreuzheben',
      static: [GROUND],
      moving: [{ t: 'plate', at: 'wr', r: 8 }],
      poses: [
        { hip: [100, 82], torso: 180, thigh: 0, shin: 0, foot: 90, uarm: 6, farm: 4 },
        { hip: [94, 84], torso: 105, head: 105, thigh: 12, shin: -12, foot: 90, uarm: 0, farm: 0 },
      ],
    },
  },
  {
    id: 'beinstrecker', name: 'Beinstrecker',
    equip: { type: 'leg_extension', setup: 'Drehachse auf Kniehöhe, Fußpolster knapp über dem Sprunggelenk, Rückenlehne so, dass die Kniekehle an der Sitzkante liegt.' },
    primary: ['quads'], secondary: [],
    aliases: ['beinstrecker', 'leg extension', 'beinstreckmaschine'],
    muscles: 'Quadrizeps',
    tips: [
      'Drehachse der Maschine auf Kniehöhe einstellen, Polster knapp über dem Sprunggelenk.',
      'Gleichmäßig strecken, oben kurz anspannen – nicht hochschleudern.',
      'Langsam ablassen und unten nicht auf dem Gewichtsblock ausruhen.',
    ],
    fig: {
      view: 'side', label: 'Beinstrecker',
      static: [...SEAT, { t: 'circle', x: 120, y: 94, r: 3 }],
      moving: [{ t: 'lever', from: [120, 94], to: 'ank' }, { t: 'plate', at: 'ank', r: 6 }],
      poses: [seated({ torso: 190, uarm: 10, farm: 10, shin: 0, foot: 90 }), seated({ torso: 190, uarm: 10, farm: 10, shin: 85, foot: 172 })],
    },
  },
  {
    id: 'beinbeuger-sitzend', name: 'Beinbeuger, sitzend',
    equip: { type: 'leg_curl_seated', setup: 'Oberschenkelpolster fest herunterdrehen, Fersenpolster knapp über dem Sprunggelenk.' },
    primary: ['hamstrings'], secondary: [],
    aliases: ['beinbeuger sitzend', 'beinbeuger', 'seated leg curl', 'leg curl', 'beincurl', 'beinbeugemaschine'],
    muscles: 'Beinbeuger (Hamstrings)',
    tips: [
      'Oberschenkelpolster fest anlegen, Becken bleibt unten am Sitz – kein Anheben beim Beugen.',
      'Beine kontrolliert einbeugen, unten kurz halten, dann langsam strecken lassen.',
      'Fußspitzen neutral oder leicht angezogen; kein Ruck am Anfang der Bewegung.',
    ],
    fig: {
      view: 'side', label: 'Beinbeuger sitzend',
      static: [...SEAT, { t: 'rect', x: 104, y: 82, w: 22, h: 6 }, { t: 'circle', x: 120, y: 94, r: 3 }],
      moving: [{ t: 'lever', from: [120, 94], to: 'ank' }, { t: 'plate', at: 'ank', r: 6 }],
      poses: [seated({ torso: 190, uarm: 10, farm: 10, shin: 85, foot: 172 }), seated({ torso: 190, uarm: 10, farm: 10, shin: 8, foot: 95 })],
    },
  },
  {
    id: 'wadenheben-stehend', name: 'Wadenheben, stehend',
    equip: { type: 'calf_standing', setup: 'Schulterpolster so, dass du gerade darunter passt; Fußballen auf die Stufe, Fersen frei.' },
    primary: ['calves'], secondary: [],
    aliases: ['wadenheben stehend', 'standing calf raise', 'wadenheben stehen', 'wadenheben'],
    muscles: 'Waden (Gastrocnemius)',
    tips: [
      'Unten die Fersen kontrolliert tief absinken lassen und die Dehnung 1 s halten.',
      'Oben so hoch wie möglich auf die Zehenspitzen, kurz anspannen – nicht federn.',
      'Knie gestreckt, aber nicht überstreckt; Bewegung nur aus dem Sprunggelenk.',
    ],
    fig: {
      view: 'side', label: 'Wadenheben stehend',
      static: [{ t: 'rect', x: 104, y: 128, w: 40, h: 14 }, { t: 'rect', x: 150, y: 20, w: 6, h: 122 }, GROUND],
      moving: [{ t: 'pad', at: 'sh', w: 8, a: 90 }],
      poses: [
        { hip: [100, 74], torso: 180, thigh: 0, shin: 0, foot: 118, uarm: -40, farm: 172 },
        { hip: [101, 62], torso: 180, thigh: 0, shin: 0, foot: 52, uarm: -40, farm: 172 },
      ],
    },
  },
  {
    id: 'kabel-crunch', name: 'Kabel-Crunch',
    equip: { type: 'cable_tower', attachment: 'Seil (Rope)', setup: 'Rolle ganz oben, kniend vor der Säule (Matte), Seil neben dem Kopf halten.' },
    primary: ['abs'], secondary: [],
    aliases: ['kabel crunch', 'kabelcrunch', 'cable crunch', 'crunch am kabel', 'crunches kabel'],
    muscles: 'Gerade Bauchmuskulatur',
    tips: [
      'Seil am Kopf fixieren, Hüfte bleibt an Ort und Stelle – die Bewegung ist ein Einrollen der Wirbelsäule.',
      'Rippen Richtung Becken ziehen, unten kurz anspannen; nicht nur in der Hüfte knicken.',
      'Langsam zurück in die Ausgangsposition, den Bauch dabei unter Spannung halten.',
    ],
    fig: {
      view: 'side', label: 'Kabel-Crunch',
      static: [{ t: 'rect', x: 168, y: 4, w: 6, h: 138 }, { t: 'circle', x: 166, y: 10, r: 4 }, { t: 'rect', x: 40, y: 130, w: 70, h: 6 }, GROUND],
      moving: [{ t: 'cable', from: [166, 10], to: 'wr' }],
      poses: [
        { hip: [90, 100], torso: 165, head: 165, thigh: 0, shin: -90, foot: -90, uarm: 40, farm: 190 },
        { hip: [90, 100], torso: 120, head: 100, thigh: 0, shin: -90, foot: -90, uarm: 100, farm: -121 },
      ],
    },
  },
  {
    id: 'beinpresse', name: 'Beinpresse',
    equip: { type: 'leg_press', setup: 'Rückenlehne so, dass die Knie oben etwa 90° haben; Füße schulterbreit mittig auf der Platte, Sicherung lösen.' },
    primary: ['quads'], secondary: ['glutes','hamstrings'],
    aliases: ['beinpresse', 'leg press', '45 grad beinpresse', 'beinpresse 45'],
    muscles: 'Quadrizeps, Gesäß, Beinbeuger',
    tips: [
      'Becken und unterer Rücken bleiben die ganze Zeit am Polster – nicht so tief, dass der Po abhebt.',
      'Große, kontrollierte Bewegungsamplitude: Knie etwa bis 90° oder tiefer, dann gleichmäßig drücken.',
      'Knie nicht durchstrecken und nicht nach innen fallen lassen; Füße ganz auf der Platte.',
    ],
    fig: {
      view: 'side', label: 'Beinpresse',
      static: [{ t: 'line', x1: 77, y1: 104, x2: 31, y2: 65, w: 7 }, { t: 'line', x1: 77, y1: 104, x2: 91, y2: 93, w: 7 }, { t: 'line', x1: 92, y1: 110, x2: 160, y2: 42, w: 3 }, { t: 'line', x1: 60, y1: 110, x2: 60, y2: 142, w: 4 }, { t: 'line', x1: 130, y1: 72, x2: 130, y2: 142, w: 4 }, GROUND],
      moving: [{ t: 'pad', at: 'toe', w: 20, a: -135 }],
      poses: [
        { hip: [80, 100], torso: 230, head: 230, thigh: 192, shin: 84, foot: -135, uarm: 30, farm: 30 },
        { hip: [80, 100], torso: 230, head: 230, thigh: 138, shin: 132, foot: -135, uarm: 30, farm: 30 },
      ],
    },
  },
  {
    id: 'hip-thrust', name: 'Hip Thrust, Maschine',
    equip: { type: 'hip_thrust', setup: 'Rückenpolster unter den Schulterblättern, Hüftpolster auf dem Becken, Füße so, dass die Schienbeine oben senkrecht stehen.' },
    primary: ['glutes'], secondary: ['hamstrings'],
    aliases: ['hip thrust maschine', 'hip thrust', 'hipthrust', 'hüftheben', 'glute drive'],
    muscles: 'Gesäß, Beinbeuger',
    tips: [
      'Oberer Rücken auf dem Polster, Füße so, dass die Schienbeine oben senkrecht stehen.',
      'Hüfte bis zur vollen Streckung nach oben drücken und das Gesäß oben 1 s anspannen.',
      'Kinn leicht zur Brust, Rippen unten – nicht ins Hohlkreuz ausweichen.',
    ],
    fig: {
      view: 'side', label: 'Hip Thrust',
      static: [{ t: 'rect', x: 44, y: 98, w: 30, h: 8 }, { t: 'line', x1: 59, y1: 106, x2: 59, y2: 125, w: 4 }, { t: 'line', x1: 150, y1: 20, x2: 150, y2: 125, w: 4 }, { t: 'ground', y: 125 }],
      moving: [{ t: 'lever', from: [150, 20], to: 'hip' }, { t: 'pad', at: 'hip', w: 10, a: 90 }],
      poses: [
        { hip: [93.4, 109], torsoLen: 34, torso: 240, head: 250, thigh: 121, shin: 17, foot: 90, uarm: 60, farm: 100 },
        { hip: [98, 92], torsoLen: 34, torso: 270, head: 270, thigh: 90, shin: 0, foot: 90, uarm: 60, farm: 100 },
      ],
    },
  },
  {
    id: 'wadenheben-sitzend', name: 'Wadenheben, sitzend',
    equip: { type: 'calf_seated', setup: 'Kniepolster fest auf die Oberschenkel, Fußballen auf die Kante.' },
    primary: ['calves'], secondary: [],
    aliases: ['wadenheben sitzend', 'seated calf raise', 'wadenheben im sitzen'],
    muscles: 'Waden (Soleus)',
    tips: [
      'Kniepolster fest über den Oberschenkeln, Fußballen auf der Kante, Fersen frei.',
      'Volle kontrollierte Bewegung: unten tief dehnen, oben maximal hoch – nicht federn.',
      'Tempo langsam (2 s hoch, 1 s halten, 2 s runter), das Gewicht nicht mit dem Oberkörper nachdrücken.',
    ],
    fig: {
      view: 'side', label: 'Wadenheben sitzend',
      static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142, w: 4 }, { t: 'rect', x: 124, y: 129, w: 18, h: 13 }, { t: 'rect', x: 148, y: 40, w: 6, h: 102 }, GROUND],
      moving: [{ t: 'pad', at: 'knee', w: 10, a: 90 }, { t: 'lever', from: [151, 40], to: 'knee' }],
      poses: [
        { hip: [90, 92], torso: 180, thigh: 90, shin: -3, foot: 56, uarm: 40, farm: 60 },
        { hip: [90, 92], torso: 180, thigh: 98, shin: 8, foot: 24, uarm: 40, farm: 60 },
      ],
    },
  },
  {
    id: 'reverse-crunch', name: 'Reverse Crunch',
    equip: { type: 'mat' },
    primary: ['abs'], secondary: [],
    aliases: ['reverse crunch', 'reverse crunches', 'umgekehrter crunch', 'beinheben liegend'],
    muscles: 'Untere Bauchmuskulatur, Hüftbeuger',
    tips: [
      'Rücken auf dem Boden, Hände neben dem Körper; Beine angewinkelt anheben.',
      'Becken einrollen und leicht vom Boden anheben – die Knie kommen Richtung Brust, nicht die Beine schwingen.',
      'Langsam wieder absenken, ohne dass die Füße den Boden berühren; unterer Rücken bleibt in Kontakt.',
    ],
    fig: {
      view: 'side', label: 'Reverse Crunch',
      static: [{ t: 'ground', y: 129 }],
      moving: [],
      poses: [
        { hip: [94, 120], torsoLen: 30, torso: 270, head: 270, thigh: 180, shin: 90, foot: 45, uarm: 270, farm: 270 },
        { hip: [92, 112], torsoLen: 30, torso: 286, head: 280, thigh: 220, shin: 130, foot: 90, uarm: 270, farm: 270 },
      ],
    },
  },
];

// Figuren, die auf andere Einträge verweisen (z.B. 'latzug'), auflösen
const byId = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
for (const e of EXERCISES) {
  if (typeof e.fig === 'string') {
    const ref = EXERCISES.find(x => x.id.startsWith(e.fig) && typeof x.fig === 'object');
    e.fig = ref ? ref.fig : null;
  }
}

export function normalizeExerciseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[,;:()/\-–_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Findet den passenden Bibliothekseintrag zu einem Übungsnamen (oder null). */
export function findExercise(name) {
  const n = normalizeExerciseName(name);
  if (!n) return null;
  for (const e of EXERCISES) if (e.aliases.some(a => a === n)) return e;
  for (const e of EXERCISES) if (e.aliases.some(a => a.length >= 5 && (n.includes(a) || (a.includes(n) && n.length >= 5)))) return e;
  return null;
}

export function getExercise(id) { return byId[id] || null; }

/** SVG-String der Übungsfigur (animiert oder statisch) */
export function exerciseFigure(entryOrName, opts = {}) {
  const e = typeof entryOrName === 'string' ? findExercise(entryOrName) : entryOrName;
  if (!e || !e.fig) return '';
  return renderFigure(e.fig, opts);
}
