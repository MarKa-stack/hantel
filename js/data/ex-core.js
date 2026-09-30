// Rumpf: Bauch, seitlicher Bauch und Stabilisation.
export const CORE = [
  {
    id: 'kabel-crunch', name: 'Kabel-Crunch', category: 'core', mechanic: 'isolation', fig: 'kabel_crunch',
    equip: { type: 'cable_tower', attachment: 'Seil (Rope)', setup: 'Rolle ganz oben, kniend vor der Säule (Matte), Seil neben dem Kopf halten.' },
    primary: ['abs'], secondary: [],
    muscles: 'Gerade Bauchmuskulatur',
    aliases: ['kabel crunch', 'kabelcrunch', 'cable crunch', 'crunch am kabel', 'crunches kabel'],
    tips: [
      'Seil am Kopf fixieren, Hüfte bleibt an Ort und Stelle – die Bewegung ist ein Einrollen der Wirbelsäule.',
      'Rippen Richtung Becken ziehen, unten kurz anspannen; nicht nur in der Hüfte knicken.',
      'Langsam zurück in die Ausgangsposition, den Bauch dabei unter Spannung halten.',
    ],
    variants: [
      { id: 'crunch-maschine', name: 'Bauchmaschine', equip: { type: 'pec_deck', setup: 'Bauchmaschine: Brustpolster fest, Drehachse etwa auf Bauchnabelhöhe.' },
        aliases: ['bauchmaschine', 'crunch maschine', 'ab machine', 'bauchpresse'],
        tipsAdd: ['Einrollen statt nur nach vorn kippen – sonst arbeitet der Hüftbeuger.'] },
    ],
  },
  {
    id: 'crunch', name: 'Crunch', category: 'core', mechanic: 'isolation', fig: 'crunch',
    equip: { type: 'mat', setup: 'Rücken auf der Matte, Knie angewinkelt, Hände an den Schläfen.' },
    primary: ['abs'], secondary: [],
    muscles: 'Gerade Bauchmuskulatur',
    aliases: ['crunch', 'crunches', 'bauchpressen', 'sit up', 'situps', 'sit ups'],
    tips: [
      'Nur die Schulterblätter heben – der untere Rücken bleibt am Boden.',
      'Kinn nicht auf die Brust pressen; der Nacken bleibt lang.',
      'Oben 1 s anspannen, dann langsam ablegen.',
    ],
  },
  {
    id: 'reverse-crunch', name: 'Reverse Crunch', category: 'core', mechanic: 'isolation', fig: 'reverse_crunch',
    equip: { type: 'mat' },
    primary: ['abs'], secondary: [],
    muscles: 'Untere Bauchmuskulatur, Hüftbeuger',
    aliases: ['reverse crunch', 'reverse crunches', 'umgekehrter crunch', 'beinheben liegend'],
    tips: [
      'Rücken auf dem Boden, Hände neben dem Körper; Beine angewinkelt anheben.',
      'Becken einrollen und leicht vom Boden anheben – die Knie kommen Richtung Brust, nicht die Beine schwingen.',
      'Langsam wieder absenken, ohne dass die Füße den Boden berühren; unterer Rücken bleibt in Kontakt.',
    ],
  },
  {
    id: 'beinheben-haengend', name: 'Beinheben, hängend', category: 'core', mechanic: 'isolation', fig: 'beinheben_haengend',
    equip: { type: 'pullup_bar', setup: 'An der Stange hängen oder im Beinhebe-Ständer abstützen.' },
    primary: ['abs'], secondary: [],
    muscles: 'Untere Bauchmuskulatur, Hüftbeuger',
    aliases: ['beinheben hängend', 'hanging leg raise', 'knieheben hängend', 'beinheben stange', 'hängendes beinheben'],
    tips: [
      'Erst das Becken einrollen, dann die Beine heben – sonst arbeitet fast nur der Hüftbeuger.',
      'Kein Schwingen: lieber angewinkelte Knie und sauber als gestreckte Beine mit Schwung.',
      'Langsam ablassen und die Spannung unten halten.',
    ],
    variants: [
      { id: 'knieheben-barren', name: 'Knieheben im Barren', equip: { type: 'dip_station', setup: 'Unterarme auf die Polster, Rücken am Polster.' },
        aliases: ['knieheben barren', 'captains chair', 'knieheben römischer stuhl', 'beinheben barren'],
        tipsAdd: ['Rücken bleibt am Polster; Knie bis über Hüfthöhe ziehen.'] },
    ],
  },
  {
    id: 'plank', name: 'Unterarmstütz (Plank)', category: 'core', mechanic: 'isolation', fig: 'plank',
    equip: { type: 'mat', setup: 'Unterarme unter den Schultern, Körper bildet eine Linie.' },
    primary: ['abs'], secondary: ['glutes'],
    muscles: 'Rumpf, Bauch',
    aliases: ['plank', 'unterarmstütz', 'planks', 'unterarmstuetz', 'bretthalten'],
    tips: [
      'Gesäß anspannen und Rippen einziehen – die Hüfte hängt nicht durch.',
      'Ruhig weiteratmen; Zeit statt Wiederholungen notieren (z.B. Wdh „45s“).',
      'Lieber 3 × 30 s in guter Form als einmal zwei Minuten durchgehangen.',
    ],
    variants: [
      { id: 'seitstuetz', name: 'Seitstütz', equip: { type: 'mat', setup: 'Auf der Seite, Unterarm unter der Schulter, Füße gestapelt.' }, unilateral: true,
        muscles: 'Seitlicher Bauch (schräge Bauchmuskeln)',
        aliases: ['seitstütz', 'side plank', 'seitlicher unterarmstütz', 'seitstuetz'],
        tipsAdd: ['Hüfte aktiv nach oben drücken, Schulter bleibt über dem Ellbogen.'] },
    ],
  },
  {
    id: 'russian-twist', name: 'Russian Twist', category: 'core', mechanic: 'isolation', fig: 'crunch',
    equip: { type: 'mat', attachment: 'Hantelscheibe oder Kurzhantel', setup: 'Sitzend, Oberkörper etwa 45° zurückgelehnt, Füße leicht angehoben.' },
    primary: ['abs'], secondary: [],
    muscles: 'Schräge Bauchmuskeln',
    aliases: ['russian twist', 'russische drehung', 'russian twists', 'rumpfdrehen'],
    tips: [
      'Die Drehung kommt aus dem Rumpf, nicht nur aus den Armen.',
      'Rücken bleibt lang – nicht rund einsinken.',
      'Langsam und kontrolliert; Gewicht erst nach sauberer Technik.',
    ],
  },
  {
    id: 'ab-wheel', name: 'Bauchroller (Ab Wheel)', category: 'core', mechanic: 'compound', fig: 'plank',
    equip: { type: 'mat', attachment: 'Bauchroller', setup: 'Kniend auf der Matte, Roller unter den Schultern.' },
    primary: ['abs'], secondary: ['back'],
    muscles: 'Bauch, Rumpf',
    aliases: ['ab wheel', 'bauchroller', 'ab roller', 'bauchrad', 'rollout'],
    tips: [
      'Nur so weit ausrollen, wie der untere Rücken neutral bleibt.',
      'Gesäß anspannen und Becken leicht einrollen – dann zieht es nicht im Rücken.',
      'Zurückziehen über die Bauchspannung, nicht über die Arme.',
    ],
  },
];
