// Strichfiguren-Renderer: Posen werden über Gelenkwinkel beschrieben und als
// SVG mit SMIL-Animation (Start ↔ Endposition) gezeichnet.
//
// Winkel-Konvention (Seitenansicht): 0° = nach unten, 90° = nach vorn (+x),
// 180° = nach oben, -90° = nach hinten. Die Figur schaut nach rechts.
// Frontansicht: 0° = nach unten, 90° = nach rechts (Bildschirm), -90° = nach links.

const L = { neck: 7, headR: 8, torso: 36, uarm: 22, farm: 20, thigh: 30, shin: 30, foot: 11 };

const rad = (d) => (d * Math.PI) / 180;
function pt(from, len, a) { return [from[0] + len * Math.sin(rad(a)), from[1] + len * Math.cos(rad(a))]; }
const f = (n) => Math.round(n * 10) / 10;

/**
 * Gelenkpunkte aus einer Pose berechnen.
 * Side-Pose: { hip:[x,y], torso, thigh, shin, foot, uarm, farm, uarm2?, farm2?, thigh2?, shin2?, foot2?, head? }
 * Front-Pose: { hip:[x,y], torso, uarmL, farmL, uarmR, farmR, legL?, legR? }
 */
export function joints(pose, view) {
  const j = {};
  j.hip = pose.hip;
  j.sh = pt(j.hip, pose.torsoLen ?? L.torso, pose.torso ?? 180);
  const headA = pose.head ?? pose.torso ?? 180;
  j.head = pt(j.sh, L.neck + L.headR, headA);
  if (view === "top") {
    // Draufsicht: Kopf in der Mitte, Schulterlinie, Arme; 0° = nach vorn (im Bild nach unten)
    j.center = pose.hip;
    j.sh = pose.hip; j.head = pose.hip;
    j.shL = [pose.hip[0] - 14, pose.hip[1]]; j.shR = [pose.hip[0] + 14, pose.hip[1]];
    j.elbL = pt(j.shL, L.uarm, pose.uarmL ?? -90); j.wrL = pt(j.elbL, L.farm, pose.farmL ?? -90);
    j.elbR = pt(j.shR, L.uarm, pose.uarmR ?? 90); j.wrR = pt(j.elbR, L.farm, pose.farmR ?? 90);
    return j;
  }
  if (view === "front") {
    const hipW = 7, shW = 11;
    j.hipL = [j.hip[0] - hipW, j.hip[1]]; j.hipR = [j.hip[0] + hipW, j.hip[1]];
    j.shL = [j.sh[0] - shW, j.sh[1]]; j.shR = [j.sh[0] + shW, j.sh[1]];
    j.elbL = pt(j.shL, L.uarm, pose.uarmL ?? -10); j.wrL = pt(j.elbL, L.farm, pose.farmL ?? -10);
    j.elbR = pt(j.shR, L.uarm, pose.uarmR ?? 10); j.wrR = pt(j.elbR, L.farm, pose.farmR ?? 10);
    j.kneeL = pt(j.hipL, L.thigh, pose.legL ?? -4); j.ankL = pt(j.kneeL, L.shin, pose.legL ?? -4);
    j.kneeR = pt(j.hipR, L.thigh, pose.legR ?? 4); j.ankR = pt(j.kneeR, L.shin, pose.legR ?? 4);
    return j;
  }
  j.knee = pt(j.hip, L.thigh, pose.thigh ?? 0);
  j.ank = pt(j.knee, L.shin, pose.shin ?? 0);
  j.toe = pt(j.ank, L.foot, pose.foot ?? 90);
  j.elb = pt(j.sh, L.uarm, pose.uarm ?? 0);
  j.wr = pt(j.elb, L.farm, pose.farm ?? 0);
  // Hintere Gliedmaßen (optional, sonst identisch zur vorderen)
  j.knee2 = pt(j.hip, L.thigh, pose.thigh2 ?? pose.thigh ?? 0);
  j.ank2 = pt(j.knee2, L.shin, pose.shin2 ?? pose.shin ?? 0);
  j.toe2 = pt(j.ank2, L.foot, pose.foot2 ?? pose.foot ?? 90);
  j.elb2 = pt(j.sh, L.uarm, pose.uarm2 ?? pose.uarm ?? 0);
  j.wr2 = pt(j.elb2, L.farm, pose.farm2 ?? pose.farm ?? 0);
  return j;
}

function P(...pts) { return pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join(' '); }

function bodyPaths(j, view) {
  if (view === "top") {
    return { back: "", body: [P(j.shL, j.shR), P(j.shL, j.elbL, j.wrL), P(j.shR, j.elbR, j.wrR)].join(" ") };
  }
  if (view === "front") {
    return {
      back: '',
      body: [
        P(j.sh, j.hip),
        P(j.hipL, j.kneeL, j.ankL), P(j.hipR, j.kneeR, j.ankR),
        P(j.shL, j.shR),
        P(j.shL, j.elbL, j.wrL), P(j.shR, j.elbR, j.wrR),
      ].join(' '),
    };
  }
  return {
    back: [P(j.hip, j.knee2, j.ank2, j.toe2), P(j.sh, j.elb2, j.wr2)].join(' '),
    body: [P(j.sh, j.hip), P(j.hip, j.knee, j.ank, j.toe), P(j.sh, j.elb, j.wr)].join(' '),
  };
}

/** Bewegliche Ausrüstung: Primitive, die an Gelenken hängen */
function equipPath(item, j) {
  const at = (k) => (Array.isArray(k) ? k : j[k]);
  switch (item.t) {
    case 'cable': { // Seilzug von fester Umlenkrolle zum Gelenk
      const a = at(item.from), b = at(item.to);
      return P(a, b);
    }
    case 'plate': { // Hantelscheibe / Griff seitlich gesehen (kleiner Kreis)
      const p = at(item.at), r = item.r ?? 5;
      return `M${f(p[0] - r)} ${f(p[1])} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
    }
    case 'dumbbell': { // Kurzhantel frontal: kurzer dicker Strich
      const p = at(item.at), w = item.w ?? 7;
      return P([p[0] - w, p[1]], [p[0] + w, p[1]]);
    }
    case 'bar': { // Stange zwischen zwei Gelenken (frontal) oder Linie durch Gelenk
      if (item.to) return P(at(item.from), at(item.to));
      const p = at(item.at), w = item.w ?? 12, a = item.a ?? 90;
      return P(pt(p, w, a), pt(p, w, a + 180));
    }
    case 'lever': { // Hebelarm einer Maschine: fester Drehpunkt → Gelenk
      return P(at(item.from), at(item.to));
    }
    case 'pad': { // Polster, das mit einem Gelenk wandert (z.B. Beinstrecker)
      const p = at(item.at), w = item.w ?? 10, a = item.a ?? 90;
      return P(pt(p, w, a), pt(p, w, a + 180));
    }
    default: return '';
  }
}

function staticSvg(item) {
  const c = item.c || 'frame';
  switch (item.t) {
    case 'rect': return `<rect class="${c}" x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${item.rx ?? 2}"${item.rot ? ` transform="rotate(${item.rot} ${item.x + item.w / 2} ${item.y + item.h / 2})"` : ''}/>`;
    case 'line': return `<path class="${c}-line" d="${P([item.x1, item.y1], [item.x2, item.y2])}"${item.w ? ` style="stroke-width:${item.w}"` : ''}/>`;
    case 'circle': return `<circle class="${c}" cx="${item.x}" cy="${item.y}" r="${item.r}"/>`;
    case 'path': return `<path class="${c}-line" d="${item.d}"${item.w ? ` style="stroke-width:${item.w}"` : ''}/>`;
    case 'ground': return `<path class="ground" d="M${item.x1 ?? 8} ${item.y} L${item.x2 ?? 192} ${item.y}"/>`;
    default: return '';
  }
}

const KEY_TIMES = '0;0.42;0.5;0.92;1';
function anim(attr, a, b, dur) {
  return `<animate attributeName="${attr}" values="${a};${b};${b};${a};${a}" keyTimes="${KEY_TIMES}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1;0 0 1 1"/>`;
}

/**
 * Rendert eine Figur als SVG-String.
 * @param {object} fig { view, poses:[A,B], static:[], moving:[], dur?, box? }
 * @param {{animate?:boolean, pose?:0|1}} opts
 */
export function renderFigure(fig, opts = {}) {
  const view = fig.view || 'side';
  const animate = opts.animate !== false && fig.poses.length > 1;
  const [A, B] = fig.poses.length > 1 ? fig.poses : [fig.poses[0], fig.poses[0]];
  const jA = joints(A, view), jB = joints(B, view);
  const pA = bodyPaths(jA, view), pB = bodyPaths(jB, view);
  const dur = fig.dur ?? 2.8;
  const single = opts.pose ?? 1; // Thumbnail: Endposition
  const jS = single ? jB : jA, pS = single ? pB : pA;

  const parts = [];
  for (const s of fig.static || []) parts.push(staticSvg(s));

  // Bewegliche Ausrüstung
  for (const m of fig.moving || []) {
    const da = equipPath(m, jA), db = equipPath(m, jB);
    const cls = m.t === 'cable' || m.t === 'lever' ? 'equip-line' : m.t === 'pad' ? 'equip-pad' : 'equip-move';
    if (animate) parts.push(`<path class="${cls}" d="${da}">${anim('d', da, db, dur)}</path>`);
    else parts.push(`<path class="${cls}" d="${equipPath(m, jS)}"/>`);
  }

  if (view === "side") {
    parts.push(animate ? `<path class="limb back" d="${pA.back}">${anim('d', pA.back, pB.back, dur)}</path>` : `<path class="limb back" d="${pS.back}"/>`);
  }
  parts.push(animate ? `<path class="limb" d="${pA.body}">${anim('d', pA.body, pB.body, dur)}</path>` : `<path class="limb" d="${pS.body}"/>`);
  const hd = animate
    ? `<circle class="head" cx="${f(jA.head[0])}" cy="${f(jA.head[1])}" r="${L.headR}">${anim('cx', f(jA.head[0]), f(jB.head[0]), dur)}${anim('cy', f(jA.head[1]), f(jB.head[1]), dur)}</circle>`
    : `<circle class="head" cx="${f(jS.head[0])}" cy="${f(jS.head[1])}" r="${L.headR}"/>`;
  parts.push(hd);

  const box = fig.box || '0 0 200 160';
  return `<svg class="figure" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${fig.label || ''}">${parts.join('')}</svg>`;
}
