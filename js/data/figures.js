// Bewegungsfiguren für die Übungsdatenbank (Start- und Endpose, siehe js/figure.js).
// Eine Figur je Bewegungsmuster – Varianten einer Übung verweisen per Namen darauf.

export const GROUND = { t: 'ground', y: 142 };
// Sitzende Grundpose an einer Maschine (Hüfte 90/92, Blick nach rechts)
export const SEAT = [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'rect', x: 82, y: 48, w: 6, h: 46 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142 }, GROUND];
export const seated = (extra = {}) => ({ hip: [90, 92], torso: 180, thigh: 90, shin: 0, foot: 90, ...extra });
export const standing = (extra = {}) => ({ hip: [100, 82], torso: 180, thigh: 0, shin: 0, foot: 90, ...extra });
// Flachbank: Liegefläche, zwei Füße, Blick nach rechts
const FLAT_BENCH = [{ t: 'rect', x: 52, y: 104, w: 92, h: 7 }, { t: 'line', x1: 60, y1: 111, x2: 60, y2: 142, w: 4 }, { t: 'line', x1: 136, y1: 111, x2: 136, y2: 142, w: 4 }, GROUND];
const lying = (extra = {}) => ({ hip: [78, 98], torso: 90, head: 90, thigh: -60, shin: 0, foot: 60, ...extra });

export const FIGS = {
  // ---------- Brust ----------
  brustpresse: {
    view: 'side', label: 'Brustpresse',
    static: [...SEAT, { t: 'line', x1: 150, y1: 30, x2: 150, y2: 142, w: 4 }, { t: 'circle', x: 150, y: 30, r: 3 }],
    moving: [{ t: 'lever', from: [150, 30], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
    poses: [seated({ uarm: -100, farm: 90 }), seated({ uarm: 90, farm: 90 })],
  },
  bankdruecken: {
    view: 'side', label: 'Bankdrücken',
    static: [...FLAT_BENCH, { t: 'line', x1: 128, y1: 58, x2: 128, y2: 104, w: 3 }, { t: 'line', x1: 122, y1: 58, x2: 134, y2: 58, w: 3 }],
    moving: [{ t: 'plate', at: 'wr', r: 7 }],
    poses: [lying({ uarm: 250, farm: 186 }), lying({ uarm: 182, farm: 180 })],
  },
  bankdruecken_kh: {
    view: 'side', label: 'Kurzhantel-Bankdrücken',
    static: FLAT_BENCH,
    moving: [{ t: 'plate', at: 'wr', r: 5 }, { t: 'plate', at: 'wr2', r: 5 }],
    poses: [lying({ uarm: 250, farm: 186, uarm2: 250, farm2: 186 }), lying({ uarm: 182, farm: 180, uarm2: 182, farm2: 180 })],
  },
  schraegbank_kh: {
    view: 'side', label: 'Schrägbankdrücken',
    static: [{ t: 'line', x1: 60, y1: 113, x2: 128, y2: 74, w: 7 }, { t: 'rect', x: 58, y: 106, w: 24, h: 7 }, { t: 'line', x1: 70, y1: 113, x2: 70, y2: 142, w: 4 }, { t: 'line', x1: 114, y1: 82, x2: 114, y2: 142, w: 4 }, GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 5 }, { t: 'plate', at: 'wr2', r: 5 }],
    poses: [
      { hip: [70, 100], torso: 120, head: 120, thigh: 70, shin: 0, foot: 90, uarm: -60, farm: 176, uarm2: -60, farm2: 176 },
      { hip: [70, 100], torso: 120, head: 120, thigh: 70, shin: 0, foot: 90, uarm: 212, farm: 210, uarm2: 212, farm2: 210 },
    ],
  },
  butterfly: {
    view: 'top', label: 'Butterfly', box: '0 0 200 130',
    static: [{ t: 'rect', x: 84, y: 40, w: 32, h: 6 }],
    moving: [{ t: 'lever', from: [100, 50], to: 'elbL' }, { t: 'lever', from: [100, 50], to: 'elbR' }, { t: 'plate', at: 'wrL', r: 3 }, { t: 'plate', at: 'wrR', r: 3 }],
    poses: [{ hip: [100, 50], uarmL: -95, farmL: -6, uarmR: 95, farmR: 6 }, { hip: [100, 50], uarmL: 8, farmL: 4, uarmR: -8, farmR: -4 }],
  },
  kabel_flys: {
    view: 'top', label: 'Kabel-Flys', box: '0 0 200 130',
    static: [{ t: 'circle', x: 14, y: 26, r: 4 }, { t: 'circle', x: 186, y: 26, r: 4 }, { t: 'line', x1: 14, y1: 8, x2: 14, y2: 26, w: 3 }, { t: 'line', x1: 186, y1: 8, x2: 186, y2: 26, w: 3 }],
    moving: [{ t: 'cable', from: [14, 26], to: 'wrL' }, { t: 'cable', from: [186, 26], to: 'wrR' }, { t: 'plate', at: 'wrL', r: 3 }, { t: 'plate', at: 'wrR', r: 3 }],
    poses: [{ hip: [100, 50], uarmL: -100, farmL: -78, uarmR: 100, farmR: 78 }, { hip: [100, 50], uarmL: -5, farmL: 25, uarmR: 5, farmR: -25 }],
  },
  dips: {
    // Hände bleiben auf den Holmen (y ≈ 80), der Körper bewegt sich dazwischen auf und ab
    view: 'side', label: 'Dips',
    static: [{ t: 'line', x1: 104, y1: 79, x2: 172, y2: 79, w: 5 }, { t: 'line', x1: 168, y1: 79, x2: 168, y2: 142, w: 4 }, GROUND],
    moving: [],
    poses: [
      { hip: [107, 108], torso: 172, head: 170, thigh: -24, shin: -62, foot: 40, uarm: -5, farm: 135 },
      { hip: [119, 74], torso: 172, head: 170, thigh: -24, shin: -62, foot: 40, uarm: 0, farm: 0 },
    ],
  },
  liegestuetz: {
    view: 'side', label: 'Liegestütze',
    static: [GROUND],
    moving: [],
    poses: [
      { hip: [96, 104], torso: 68, head: 66, thigh: -110, shin: -110, foot: -60, uarm: 4, farm: 4 },
      { hip: [96, 116], torso: 68, head: 66, thigh: -110, shin: -110, foot: -60, uarm: 52, farm: -48 },
    ],
  },

  // ---------- Rücken ----------
  latzug: {
    view: 'side', label: 'Latzug',
    static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142 }, GROUND,
      { t: 'line', x1: 100, y1: 4, x2: 150, y2: 4, w: 4 }, { t: 'line', x1: 150, y1: 4, x2: 150, y2: 142, w: 4 },
      { t: 'circle', x: 100, y: 6, r: 4 }, { t: 'rect', x: 104, y: 82, w: 22, h: 6 }],
    moving: [{ t: 'cable', from: [100, 6], to: 'wr' }, { t: 'bar', at: 'wr', w: 6, a: 90 }],
    poses: [seated({ torso: 186, uarm: 176, farm: 178 }), seated({ torso: 190, uarm: -18, farm: 148 })],
  },
  klimmzug: {
    view: 'side', label: 'Klimmzüge',
    static: [{ t: 'line', x1: 60, y1: 18, x2: 150, y2: 18, w: 4 }, { t: 'line', x1: 148, y1: 18, x2: 148, y2: 142, w: 3 }, GROUND],
    moving: [],
    poses: [
      { hip: [100, 96], torso: 180, head: 180, thigh: -14, shin: -40, foot: 60, uarm: 178, farm: 178 },
      { hip: [100, 74], torso: 180, head: 180, thigh: -14, shin: -40, foot: 60, uarm: 120, farm: 237 },
    ],
  },
  rudern_lh: {
    view: 'side', label: 'Langhantelrudern',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 8 }],
    poses: [
      { hip: [104, 86], torso: 120, head: 116, thigh: 14, shin: -14, foot: 90, uarm: 6, farm: 4 },
      { hip: [104, 86], torso: 120, head: 116, thigh: 14, shin: -14, foot: 90, uarm: 58, farm: -70 },
    ],
  },
  rudern_kabel: {
    view: 'side', label: 'Rudern am Kabel',
    static: [{ t: 'rect', x: 50, y: 100, w: 40, h: 6 }, { t: 'line', x1: 70, y1: 106, x2: 70, y2: 142, w: 4 }, { t: 'rect', x: 118, y: 108, w: 6, h: 30, rot: -20 }, { t: 'rect', x: 176, y: 40, w: 6, h: 102 }, { t: 'circle', x: 178, y: 92, r: 4 }, GROUND],
    moving: [{ t: 'cable', from: [178, 92], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
    poses: [
      { hip: [70, 100], torso: 178, thigh: 80, shin: 30, foot: 100, uarm: 88, farm: 88 },
      { hip: [70, 100], torso: 188, thigh: 80, shin: 30, foot: 100, uarm: -30, farm: 100 },
    ],
  },
  rudern_brustgestuetzt: {
    view: 'side', label: 'Rudern brustgestützt',
    static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142 }, GROUND,
      { t: 'rect', x: 108, y: 46, w: 6, h: 40, rot: 20 }, { t: 'line', x1: 152, y1: 122, x2: 152, y2: 142, w: 4 }],
    moving: [{ t: 'lever', from: [152, 122], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
    poses: [seated({ torso: 160, uarm: 78, farm: 80 }), seated({ torso: 160, uarm: -55, farm: 72 })],
  },
  hyperextension: {
    view: 'side', label: 'Rückenstrecker',
    static: [{ t: 'rect', x: 96, y: 96, w: 28, h: 8, rot: -30 }, { t: 'line', x1: 110, y1: 104, x2: 110, y2: 142, w: 4 }, { t: 'rect', x: 132, y: 120, w: 20, h: 8 }, GROUND],
    moving: [],
    poses: [
      { hip: [112, 96], torso: 130, head: 126, thigh: 68, shin: 60, foot: 120, uarm: 30, farm: 60 },
      { hip: [112, 96], torso: 74, head: 70, thigh: 68, shin: 60, foot: 120, uarm: 30, farm: 60 },
    ],
  },

  // ---------- Schultern ----------
  schulterdruecken: {
    view: 'front', label: 'Schulterdrücken',
    static: [GROUND],
    moving: [{ t: 'dumbbell', at: 'wrL' }, { t: 'dumbbell', at: 'wrR' }],
    poses: [
      { hip: [100, 84], torso: 180, uarmL: -100, farmL: -160, uarmR: 100, farmR: 160 },
      { hip: [100, 84], torso: 180, uarmL: -172, farmL: -178, uarmR: 172, farmR: 178 },
    ],
  },
  seitheben_kh: {
    view: 'front', label: 'Seitheben',
    static: [GROUND],
    moving: [{ t: 'dumbbell', at: 'wrL' }, { t: 'dumbbell', at: 'wrR' }],
    poses: [{ hip: [100, 84], torso: 180, uarmL: -10, farmL: -10, uarmR: 10, farmR: 10 }, { hip: [100, 84], torso: 180, uarmL: -84, farmL: -72, uarmR: 84, farmR: 72 }],
  },
  seitheben_kabel: {
    view: 'front', label: 'Seitheben am Kabel',
    static: [{ t: 'rect', x: 24, y: 14, w: 6, h: 128 }, { t: 'circle', x: 27, y: 136, r: 4 }, GROUND],
    moving: [{ t: 'cable', from: [27, 136], to: 'wrR' }, { t: 'plate', at: 'wrR', r: 3 }],
    poses: [{ hip: [100, 84], torso: 180, uarmL: -12, farmL: -12, uarmR: -14, farmR: -18 }, { hip: [100, 84], torso: 180, uarmL: -12, farmL: -12, uarmR: 86, farmR: 92 }],
  },
  frontheben: {
    view: 'side', label: 'Frontheben',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 5 }],
    poses: [standing({ uarm: 6, farm: 8 }), standing({ uarm: 88, farm: 92 })],
  },
  reverse_flys: {
    view: 'top', label: 'Reverse-Flys', box: '0 0 200 130',
    static: [{ t: 'rect', x: 86, y: 58, w: 28, h: 6 }],
    moving: [{ t: 'lever', from: [100, 52], to: 'wrL' }, { t: 'lever', from: [100, 52], to: 'wrR' }, { t: 'plate', at: 'wrL', r: 3 }, { t: 'plate', at: 'wrR', r: 3 }],
    poses: [{ hip: [100, 52], uarmL: -12, farmL: 6, uarmR: 12, farmR: -6 }, { hip: [100, 52], uarmL: -100, farmL: -108, uarmR: 100, farmR: 108 }],
  },

  // ---------- Arme ----------
  bizepscurls_kabel: {
    view: 'side', label: 'Bizepscurls am Kabel',
    static: [{ t: 'rect', x: 168, y: 14, w: 6, h: 128 }, { t: 'circle', x: 171, y: 136, r: 4 }, GROUND],
    moving: [{ t: 'cable', from: [171, 136], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
    poses: [standing({ uarm: 8, farm: 20 }), standing({ uarm: 8, farm: 158 })],
  },
  curls_stehend: {
    view: 'side', label: 'Bizepscurls',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 6 }],
    poses: [standing({ uarm: 8, farm: 12 }), standing({ uarm: 8, farm: 158 })],
  },
  schraegbank_curls: {
    view: 'side', label: 'Schrägbank-Curls',
    static: [{ t: 'line', x1: 78, y1: 102, x2: 52, y2: 40, w: 7 }, { t: 'rect', x: 70, y: 98, w: 30, h: 6 }, { t: 'line', x1: 85, y1: 104, x2: 85, y2: 142, w: 4 }, GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 5 }, { t: 'plate', at: 'wr2', r: 5 }],
    poses: [
      { hip: [80, 98], torso: 200, thigh: 90, shin: 0, foot: 90, uarm: -6, farm: -4, uarm2: -6, farm2: -4 },
      { hip: [80, 98], torso: 200, thigh: 90, shin: 0, foot: 90, uarm: -6, farm: 150, uarm2: -6, farm2: 150 },
    ],
  },
  scott_curls: {
    view: 'side', label: 'Scott-Curls',
    static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142, w: 4 }, { t: 'rect', x: 104, y: 62, w: 30, h: 8, rot: -28 }, GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 5 }],
    poses: [seated({ torso: 176, uarm: 62, farm: 66 }), seated({ torso: 176, uarm: 62, farm: 170 })],
  },
  trizepsdruecken_kabel: {
    view: 'side', label: 'Trizepsdrücken am Kabel',
    static: [{ t: 'rect', x: 148, y: 6, w: 6, h: 136 }, { t: 'circle', x: 146, y: 12, r: 4 }, GROUND],
    moving: [{ t: 'cable', from: [146, 12], to: 'wr' }, { t: 'bar', at: 'wr', w: 5, a: 90 }],
    poses: [standing({ torso: 176, uarm: 12, farm: 140 }), standing({ torso: 176, uarm: 12, farm: 22 })],
  },
  ueberkopf_trizeps: {
    view: 'side', label: 'Überkopf-Trizeps',
    static: [{ t: 'rect', x: 20, y: 10, w: 6, h: 132 }, { t: 'circle', x: 26, y: 30, r: 4 }, GROUND],
    moving: [{ t: 'cable', from: [26, 30], to: 'wr' }, { t: 'plate', at: 'wr', r: 4 }],
    poses: [
      { hip: [92, 82], torso: 166, thigh: 22, shin: 0, foot: 90, thigh2: -22, shin2: 0, uarm: 168, farm: -95, uarm2: 168, farm2: -95 },
      { hip: [92, 82], torso: 166, thigh: 22, shin: 0, foot: 90, thigh2: -22, shin2: 0, uarm: 168, farm: 172, uarm2: 168, farm2: 172 },
    ],
  },
  french_press: {
    view: 'side', label: 'French Press',
    static: FLAT_BENCH,
    moving: [{ t: 'plate', at: 'wr', r: 6 }],
    poses: [lying({ uarm: 200, farm: 130 }), lying({ uarm: 190, farm: 186 })],
  },

  // ---------- Beine ----------
  kniebeuge: {
    view: 'side', label: 'Kniebeuge',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'sh', r: 7 }],
    poses: [
      { hip: [100, 78], torso: 180, head: 180, thigh: 0, shin: 0, foot: 90, uarm: -46, farm: 168 },
      { hip: [94, 100], torso: 150, head: 150, thigh: 50, shin: -50, foot: 95, uarm: -46, farm: 168 },
    ],
  },
  ausfallschritt: {
    view: 'side', label: 'Ausfallschritt',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 5 }, { t: 'plate', at: 'wr2', r: 5 }],
    poses: [
      { hip: [100, 82], torso: 180, head: 180, thigh: 0, shin: 0, foot: 90, thigh2: 0, shin2: 0, uarm: 6, farm: 4, uarm2: 6, farm2: 4 },
      { hip: [100, 100], torso: 178, head: 178, thigh: 42, shin: -42, foot: 90, thigh2: -40, shin2: 40, foot2: 90, uarm: 6, farm: 4, uarm2: 6, farm2: 4 },
    ],
  },
  hackenschmidt: {
    view: 'side', label: 'Hackenschmidt-Kniebeuge',
    static: [{ t: 'line', x1: 114, y1: 108, x2: 80, y2: 14, w: 7 }, { t: 'line', x1: 128, y1: 116, x2: 96, y2: 28, w: 3 }, { t: 'rect', x: 92, y: 130, w: 44, h: 6 }, { t: 'line', x1: 92, y1: 136, x2: 92, y2: 142, w: 4 }, { t: 'line', x1: 136, y1: 136, x2: 136, y2: 142, w: 4 }, GROUND],
    moving: [{ t: 'pad', at: 'sh', w: 8, a: 110 }],
    poses: [
      { hip: [100, 70], torso: 200, thigh: 10, shin: 10, foot: 100, uarm: -40, farm: 175 },
      { hip: [110, 96], torso: 200, thigh: 55, shin: -55, foot: 100, uarm: -40, farm: 175 },
    ],
  },
  beinpresse: {
    view: 'side', label: 'Beinpresse',
    static: [{ t: 'line', x1: 77, y1: 104, x2: 31, y2: 65, w: 7 }, { t: 'line', x1: 77, y1: 104, x2: 91, y2: 93, w: 7 }, { t: 'line', x1: 92, y1: 110, x2: 160, y2: 42, w: 3 }, { t: 'line', x1: 60, y1: 110, x2: 60, y2: 142, w: 4 }, { t: 'line', x1: 130, y1: 72, x2: 130, y2: 142, w: 4 }, GROUND],
    moving: [{ t: 'pad', at: 'toe', w: 20, a: -135 }],
    poses: [
      { hip: [80, 100], torso: 230, head: 230, thigh: 192, shin: 84, foot: -135, uarm: 30, farm: 30 },
      { hip: [80, 100], torso: 230, head: 230, thigh: 138, shin: 132, foot: -135, uarm: 30, farm: 30 },
    ],
  },
  rdl: {
    view: 'side', label: 'Rumänisches Kreuzheben',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 8 }],
    poses: [
      { hip: [100, 82], torso: 180, thigh: 0, shin: 0, foot: 90, uarm: 6, farm: 4 },
      { hip: [94, 84], torso: 105, head: 105, thigh: 12, shin: -12, foot: 90, uarm: 0, farm: 0 },
    ],
  },
  kreuzheben: {
    view: 'side', label: 'Kreuzheben',
    static: [GROUND],
    moving: [{ t: 'plate', at: 'wr', r: 9 }],
    poses: [
      { hip: [96, 98], torso: 122, head: 118, thigh: 46, shin: -46, foot: 90, uarm: 2, farm: 2 },
      { hip: [100, 80], torso: 180, head: 180, thigh: 0, shin: 0, foot: 90, uarm: 4, farm: 4 },
    ],
  },
  beinstrecker: {
    view: 'side', label: 'Beinstrecker',
    static: [...SEAT, { t: 'circle', x: 120, y: 94, r: 3 }],
    moving: [{ t: 'lever', from: [120, 94], to: 'ank' }, { t: 'plate', at: 'ank', r: 6 }],
    poses: [seated({ torso: 190, uarm: 10, farm: 10, shin: 0, foot: 90 }), seated({ torso: 190, uarm: 10, farm: 10, shin: 85, foot: 172 })],
  },
  beinbeuger_sitzend: {
    view: 'side', label: 'Beinbeuger sitzend',
    static: [...SEAT, { t: 'rect', x: 104, y: 82, w: 22, h: 6 }, { t: 'circle', x: 120, y: 94, r: 3 }],
    moving: [{ t: 'lever', from: [120, 94], to: 'ank' }, { t: 'plate', at: 'ank', r: 6 }],
    poses: [seated({ torso: 190, uarm: 10, farm: 10, shin: 85, foot: 172 }), seated({ torso: 190, uarm: 10, farm: 10, shin: 8, foot: 95 })],
  },
  beinbeuger_liegend: {
    view: 'side', label: 'Beinbeuger liegend',
    static: [{ t: 'rect', x: 56, y: 100, w: 84, h: 7 }, { t: 'line', x1: 64, y1: 107, x2: 64, y2: 142, w: 4 }, { t: 'line', x1: 132, y1: 107, x2: 132, y2: 142, w: 4 }, { t: 'circle', x: 142, y: 100, r: 3 }, GROUND],
    moving: [{ t: 'lever', from: [142, 100], to: 'ank' }, { t: 'plate', at: 'ank', r: 5 }],
    poses: [
      { hip: [100, 94], torso: -90, head: -90, thigh: 90, shin: 90, foot: 130, uarm: -90, farm: -90 },
      { hip: [100, 94], torso: -90, head: -90, thigh: 90, shin: 176, foot: 220, uarm: -90, farm: -90 },
    ],
  },
  hip_thrust: {
    view: 'side', label: 'Hip Thrust',
    static: [{ t: 'rect', x: 44, y: 98, w: 30, h: 8 }, { t: 'line', x1: 59, y1: 106, x2: 59, y2: 125, w: 4 }, { t: 'line', x1: 150, y1: 20, x2: 150, y2: 125, w: 4 }, { t: 'ground', y: 125 }],
    moving: [{ t: 'lever', from: [150, 20], to: 'hip' }, { t: 'pad', at: 'hip', w: 10, a: 90 }],
    poses: [
      { hip: [93.4, 109], torsoLen: 34, torso: 240, head: 250, thigh: 121, shin: 17, foot: 90, uarm: 60, farm: 100 },
      { hip: [98, 92], torsoLen: 34, torso: 270, head: 270, thigh: 90, shin: 0, foot: 90, uarm: 60, farm: 100 },
    ],
  },
  abduktoren: {
    view: 'front', label: 'Abduktoren',
    static: [{ t: 'rect', x: 80, y: 96, w: 40, h: 6 }, GROUND],
    moving: [{ t: 'pad', at: 'kneeL', w: 8, a: 0 }, { t: 'pad', at: 'kneeR', w: 8, a: 0 }],
    poses: [
      { hip: [100, 88], torso: 180, uarmL: -14, farmL: -14, uarmR: 14, farmR: 14, legL: -4, legR: 4 },
      { hip: [100, 88], torso: 180, uarmL: -14, farmL: -14, uarmR: 14, farmR: 14, legL: -32, legR: 32 },
    ],
  },
  wadenheben_stehend: {
    view: 'side', label: 'Wadenheben stehend',
    static: [{ t: 'rect', x: 104, y: 128, w: 40, h: 14 }, { t: 'rect', x: 150, y: 20, w: 6, h: 122 }, GROUND],
    moving: [{ t: 'pad', at: 'sh', w: 8, a: 90 }],
    poses: [
      { hip: [100, 74], torso: 180, thigh: 0, shin: 0, foot: 118, uarm: -40, farm: 172 },
      { hip: [101, 62], torso: 180, thigh: 0, shin: 0, foot: 52, uarm: -40, farm: 172 },
    ],
  },
  wadenheben_sitzend: {
    view: 'side', label: 'Wadenheben sitzend',
    static: [{ t: 'rect', x: 68, y: 92, w: 34, h: 6 }, { t: 'line', x1: 85, y1: 98, x2: 85, y2: 142, w: 4 }, { t: 'rect', x: 124, y: 129, w: 18, h: 13 }, { t: 'rect', x: 148, y: 40, w: 6, h: 102 }, GROUND],
    moving: [{ t: 'pad', at: 'knee', w: 10, a: 90 }, { t: 'lever', from: [151, 40], to: 'knee' }],
    poses: [
      { hip: [90, 92], torso: 180, thigh: 90, shin: -3, foot: 56, uarm: 40, farm: 60 },
      { hip: [90, 92], torso: 180, thigh: 98, shin: 8, foot: 24, uarm: 40, farm: 60 },
    ],
  },

  // ---------- Rumpf ----------
  kabel_crunch: {
    view: 'side', label: 'Kabel-Crunch',
    static: [{ t: 'rect', x: 168, y: 4, w: 6, h: 138 }, { t: 'circle', x: 166, y: 10, r: 4 }, { t: 'rect', x: 40, y: 130, w: 70, h: 6 }, GROUND],
    moving: [{ t: 'cable', from: [166, 10], to: 'wr' }],
    poses: [
      { hip: [90, 100], torso: 165, head: 165, thigh: 0, shin: -90, foot: -90, uarm: 40, farm: 190 },
      { hip: [90, 100], torso: 120, head: 100, thigh: 0, shin: -90, foot: -90, uarm: 100, farm: -121 },
    ],
  },
  crunch: {
    view: 'side', label: 'Crunch',
    static: [{ t: 'ground', y: 129 }],
    moving: [],
    poses: [
      { hip: [96, 120], torsoLen: 32, torso: 92, head: 92, thigh: -50, shin: 40, foot: 90, uarm: 130, farm: 78 },
      { hip: [96, 120], torsoLen: 32, torso: 118, head: 126, thigh: -50, shin: 40, foot: 90, uarm: 150, farm: 92 },
    ],
  },
  reverse_crunch: {
    view: 'side', label: 'Reverse Crunch',
    static: [{ t: 'ground', y: 129 }],
    moving: [],
    poses: [
      { hip: [94, 120], torsoLen: 30, torso: 270, head: 270, thigh: 180, shin: 90, foot: 45, uarm: 270, farm: 270 },
      { hip: [92, 112], torsoLen: 30, torso: 286, head: 280, thigh: 220, shin: 130, foot: 90, uarm: 270, farm: 270 },
    ],
  },
  beinheben_haengend: {
    view: 'side', label: 'Beinheben hängend',
    static: [{ t: 'line', x1: 60, y1: 18, x2: 150, y2: 18, w: 4 }, { t: 'line', x1: 148, y1: 18, x2: 148, y2: 142, w: 3 }, GROUND],
    moving: [],
    poses: [
      { hip: [100, 88], torso: 180, head: 180, thigh: 0, shin: 0, foot: 90, uarm: 178, farm: 178 },
      { hip: [100, 88], torso: 180, head: 180, thigh: 88, shin: 60, foot: 120, uarm: 178, farm: 178 },
    ],
  },
  plank: {
    view: 'side', label: 'Unterarmstütz',
    static: [GROUND],
    moving: [],
    poses: [
      { hip: [98, 108], torso: 72, head: 70, thigh: -108, shin: -108, foot: -60, uarm: 20, farm: -80 },
      { hip: [98, 106], torso: 70, head: 68, thigh: -110, shin: -110, foot: -60, uarm: 20, farm: -80 },
    ],
  },
};
