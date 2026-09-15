// Geräte-Bilder: schematische SVG-Illustrationen der Maschinen, Kabeltürme und freien Gewichte, damit man das
// Gerät im Studio schneller findet. Jede Übung verweist auf einen Typ und nennt Aufsatz/Griff und Einstellung.

const F = (x1, y1, x2, y2, w = 5) => `<line class="eq-frame" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke-width:${w}"/>`;
const PAD = (x, y, w, h, rot = 0, rx = 4) => `<rect class="eq-pad" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : ''}/>`;
const METAL = (x, y, w, h, rot = 0, rx = 3) => `<rect class="eq-metal" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : ''}/>`;
const CABLE = (x1, y1, x2, y2) => `<line class="eq-cable" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const PULLEY = (x, y, r = 5) => `<circle class="eq-pulley" cx="${x}" cy="${y}" r="${r}"/>`;
const FLOOR = `<line class="eq-floor" x1="10" y1="140" x2="230" y2="140"/>`;
/** Gewichtsblock: Säule mit Platten */
const STACK = (x, y, w = 26, n = 9) => {
  let s = `<rect class="eq-stackbox" x="${x}" y="${y}" width="${w}" height="${n * 7 + 6}" rx="3"/>`;
  for (let i = 0; i < n; i++) s += `<rect class="eq-plate" x="${x + 3}" y="${y + 4 + i * 7}" width="${w - 6}" height="5" rx="1"/>`;
  return s;
};
const DUMBBELL = (x, y, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})">${METAL(x - 22, y - 3, 44, 6)}${METAL(x - 30, y - 9, 10, 18, 0, 2)}${METAL(x + 20, y - 9, 10, 18, 0, 2)}</g>`;

export const EQUIPMENT = {
  cable_tower: {
    name: 'Kabelzug / Kabelturm',
    desc: 'Säule mit Gewichtsblock, die Rolle lässt sich in der Höhe verstellen (Pin am Schlitten).',
    svg: () => [FLOOR, F(60, 12, 60, 140, 8), F(52, 12, 68, 12, 6), STACK(72, 40), METAL(56, 20, 8, 110, 0, 2), PULLEY(60, 30), PULLEY(60, 122), CABLE(60, 30, 150, 78), METAL(146, 72, 14, 12, 0, 3), `<text class="eq-label" x="150" y="100">Rolle oben / unten</text>`].join(''),
  },
  cable_crossover: {
    name: 'Kabelzug-Station (beidseitig)',
    desc: 'Zwei Säulen mit je einer verstellbaren Rolle – für Flys stehst du in der Mitte.',
    svg: () => [FLOOR, F(30, 12, 30, 140, 8), F(210, 12, 210, 140, 8), F(30, 12, 210, 12, 6), STACK(38, 44, 22, 8), STACK(180, 44, 22, 8), PULLEY(30, 58), PULLEY(210, 58), CABLE(30, 58, 108, 100), CABLE(210, 58, 132, 100), METAL(102, 96, 12, 10, 0, 3), METAL(126, 96, 12, 10, 0, 3)].join(''),
  },
  lat_pulldown: {
    name: 'Latzug-Maschine',
    desc: 'Sitz mit Oberschenkelpolster, Stange hängt an der oberen Rolle, Gewichtsblock hinten.',
    svg: () => [FLOOR, F(170, 12, 170, 140, 8), F(110, 12, 170, 12, 6), STACK(178, 40), PULLEY(112, 16), CABLE(112, 16, 112, 48), METAL(70, 46, 84, 6), PAD(78, 100, 44, 8), F(100, 108, 100, 140, 6), PAD(84, 84, 40, 8), F(124, 70, 124, 92, 5)].join(''),
  },
  chest_press: {
    name: 'Brustpresse (Maschine)',
    desc: 'Sitz mit hoher Rückenlehne, zwei Griffe an Hebelarmen vor der Brust; Sitzhöhe verstellbar.',
    svg: () => [FLOOR, F(60, 20, 60, 140, 8), PAD(52, 26, 16, 70, 0, 6), PAD(60, 96, 46, 10), F(84, 106, 84, 140, 6), F(150, 20, 150, 140, 8), STACK(158, 40), F(150, 36, 110, 70, 5), METAL(96, 64, 22, 8, 0, 4), METAL(96, 84, 22, 8, 0, 4)].join(''),
  },
  row_machine: {
    name: 'Rudermaschine, brustgestützt',
    desc: 'Sitz, Brustpolster nach vorn geneigt, Griffe an Hebeln vor dem Polster, Gewichtsblock vorn.',
    svg: () => [FLOOR, PAD(56, 100, 44, 10), F(78, 110, 78, 140, 6), PAD(104, 40, 12, 56, 15, 5), F(110, 96, 110, 140, 5), F(190, 20, 190, 140, 8), STACK(196, 40, 24, 8), F(190, 120, 150, 70, 5), METAL(140, 60, 10, 22, 0, 3), METAL(140, 84, 10, 8, 0, 3)].join(''),
  },
  seated_row_cable: {
    name: 'Rudern am Kabel (sitzend)',
    desc: 'Flache Bank mit Fußplatten, Rolle unten vor dir; Griff wird an den Karabiner gehängt.',
    svg: () => [FLOOR, PAD(30, 104, 60, 8), F(60, 112, 60, 140, 6), METAL(118, 96, 8, 34, -20, 2), F(200, 20, 200, 140, 8), STACK(206, 40, 22, 8), PULLEY(200, 108), CABLE(200, 108, 110, 84), METAL(98, 78, 16, 14, 0, 3), `<text class="eq-label" x="98" y="70">V-Griff</text>`].join(''),
  },
  pec_deck: {
    name: 'Butterfly / Reverse-Fly-Maschine',
    desc: 'Sitz mit Rückenlehne, zwei senkrechte Arme, die sich vorn (Butterfly) oder hinten (Reverse Fly) schwenken lassen.',
    svg: () => [FLOOR, F(120, 14, 120, 140, 8), PAD(112, 30, 16, 66, 0, 6), PAD(96, 96, 48, 10), F(120, 106, 120, 140, 6), F(120, 14, 60, 14, 6), F(120, 14, 180, 14, 6), F(60, 14, 60, 80, 5), F(180, 14, 180, 80, 5), PAD(52, 44, 16, 40, 0, 6), PAD(172, 44, 16, 40, 0, 6)].join(''),
  },
  incline_bench: {
    name: 'Schrägbank + Kurzhanteln',
    desc: 'Verstellbare Bank; Winkel nach Übung einstellen (Drücken 15–30°, Curls 45–60°).',
    svg: () => [FLOOR, PAD(50, 104, 50, 10), PAD(100, 44, 14, 70, 32, 6), F(70, 114, 70, 140, 6), F(130, 110, 130, 140, 6), F(70, 128, 130, 128, 5), DUMBBELL(190, 128, 0), DUMBBELL(190, 108, 0), `<text class="eq-label" x="112" y="34">15–60°</text>`].join(''),
  },
  hack_squat: {
    name: 'Hackenschmidt-Maschine',
    desc: 'Schräger Schlitten mit Rücken- und Schulterpolstern, Füße auf der Plattform unten.',
    svg: () => [FLOOR, F(70, 140, 170, 20, 8), F(130, 140, 200, 40, 6), PAD(110, 44, 12, 74, 51, 5), PAD(150, 28, 26, 10, 51, 4), METAL(60, 126, 70, 8, 0, 3), F(60, 134, 60, 140, 5), F(130, 134, 130, 140, 5)].join(''),
  },
  leg_press: {
    name: 'Beinpresse (45°)',
    desc: 'Tiefer Sitz mit Rückenlehne, große Fußplatte schräg oben; Sicherungshebel seitlich lösen.',
    svg: () => [FLOOR, PAD(30, 70, 14, 56, -40, 6), PAD(46, 104, 44, 10), F(64, 114, 64, 140, 6), F(100, 130, 200, 30, 6), METAL(130, 60, 12, 60, 45, 3), F(170, 70, 170, 140, 6), STACK(178, 60, 22, 7)].join(''),
  },
  leg_extension: {
    name: 'Beinstrecker',
    desc: 'Sitz mit Rückenlehne, Polster vor den Schienbeinen; Drehachse auf Kniehöhe einstellen.',
    svg: () => [FLOOR, PAD(60, 30, 16, 66, 0, 6), PAD(66, 96, 50, 10), F(88, 106, 88, 140, 6), PULLEY(122, 100, 4), F(122, 100, 130, 132, 5), PAD(122, 128, 26, 10), F(170, 20, 170, 140, 8), STACK(178, 40, 22, 8)].join(''),
  },
  leg_curl_seated: {
    name: 'Beinbeuger, sitzend',
    desc: 'Sitz mit Rückenlehne, Oberschenkelpolster oben, Fersenpolster vorn – Beine ziehen nach unten.',
    svg: () => [FLOOR, PAD(60, 30, 16, 66, 0, 6), PAD(66, 96, 50, 10), F(88, 106, 88, 140, 6), PAD(90, 80, 30, 8), PULLEY(122, 100, 4), F(122, 100, 150, 96, 5), PAD(144, 88, 12, 22, 0, 5), F(180, 20, 180, 140, 8), STACK(188, 40, 22, 8)].join(''),
  },
  calf_standing: {
    name: 'Wadenheben stehend (Maschine)',
    desc: 'Schulterpolster, kleine Stufe für die Fußballen; Höhe der Polster verstellen.',
    svg: () => [FLOOR, F(150, 12, 150, 140, 8), F(150, 40, 100, 40, 6), PAD(70, 34, 22, 12, 0, 5), PAD(106, 34, 22, 12, 0, 5), METAL(76, 124, 48, 16, 0, 3), STACK(158, 40, 22, 8)].join(''),
  },
  calf_seated: {
    name: 'Wadenheben sitzend (Maschine)',
    desc: 'Sitz, Kniepolster über den Oberschenkeln, Fußballen auf der Kante – Fersen hängen frei.',
    svg: () => [FLOOR, PAD(60, 96, 44, 10), F(82, 106, 82, 140, 6), PAD(96, 68, 40, 10), F(160, 40, 160, 140, 8), F(160, 60, 116, 74, 5), METAL(120, 124, 26, 16, 0, 3), STACK(168, 44, 20, 7)].join(''),
  },
  hip_thrust: {
    name: 'Hip-Thrust-Maschine',
    desc: 'Rückenpolster für den oberen Rücken, Hüftpolster am Hebel, Fußplatte vorn.',
    svg: () => [FLOOR, PAD(40, 90, 36, 12, 0, 5), F(58, 102, 58, 140, 6), F(180, 20, 180, 140, 8), F(180, 30, 110, 70, 5), PAD(96, 62, 30, 10, -30, 5), METAL(120, 120, 60, 8, 0, 3), STACK(188, 40, 20, 8)].join(''),
  },
  dumbbells: {
    name: 'Kurzhanteln',
    desc: 'Hantelablage – Gewicht so wählen, dass die letzten Wiederholungen sauber bleiben.',
    svg: () => [FLOOR, F(40, 60, 40, 140, 6), F(200, 60, 200, 140, 6), F(40, 70, 200, 70, 5), F(40, 105, 200, 105, 5), DUMBBELL(80, 62), DUMBBELL(160, 62), DUMBBELL(80, 97), DUMBBELL(160, 97), DUMBBELL(120, 132)].join(''),
  },
  barbell: {
    name: 'Langhantel',
    desc: 'Stange (20 kg) mit Scheiben, Verschlüsse nicht vergessen; auf Abstellhöhe oder vom Boden.',
    svg: () => [FLOOR, METAL(30, 96, 180, 8, 0, 4), METAL(56, 70, 12, 60, 0, 4), METAL(70, 78, 8, 44, 0, 3), METAL(172, 70, 12, 60, 0, 4), METAL(162, 78, 8, 44, 0, 3), METAL(44, 92, 10, 16, 0, 3), METAL(186, 92, 10, 16, 0, 3)].join(''),
  },
  mat: {
    name: 'Matte / Boden',
    desc: 'Keine Maschine – eine Matte reicht.',
    svg: () => [FLOOR, PAD(40, 120, 160, 12, 0, 6), F(200, 116, 200, 136, 4)].join(''),
  },
};

/** SVG-Karte des Geräts (leer, wenn unbekannt) */
export function equipmentSvg(type) {
  const eq = EQUIPMENT[type];
  if (!eq) return '';
  return `<svg class="equip-art" viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${eq.name}">${eq.svg()}</svg>`;
}
