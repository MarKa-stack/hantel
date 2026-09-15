// Kartenbilder für Pläne: abstrakter Farbverlauf in Planfarbe mit Lichtkanten und einer Geräte-Illustration
// (Kurzhantel für Oberkörper, Kettlebell für Beine, Langhantel für Ganzkörper). Reines SVG, kein Asset.
import { musclesFor } from './muscles.js';

let seq = 0;

/** Gerätetyp aus den Zielmuskeln des Plans */
export function planKind(plan) {
  let upper = 0, lower = 0;
  for (const ex of plan.exercises || []) {
    const m = musclesFor(ex.name);
    for (const k of m.primary) (['quads', 'hamstrings', 'glutes', 'calves'].includes(k) ? lower++ : upper++);
  }
  if (!upper && !lower) return 'barbell';
  if (lower > upper * 1.5) return 'kettlebell';
  if (upper > lower * 1.5) return 'dumbbell';
  return 'barbell';
}

/**
 * @param {object} plan
 * @param {string} color Planfarbe (Hex)
 * @param {{ tall?: boolean, kind?: string }} opts tall = „Als Nächstes“-Karte, kind überschreibt das Gerät
 */
export function planArtSvg(plan, color, opts = {}) {
  const id = 'pa' + (++seq);
  const kind = opts.kind || planKind(plan);
  const W = 400, H = opts.tall ? 240 : 150;
  const defs = `
    <defs>
      <linearGradient id="${id}-base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#14171e"/><stop offset="0.55" stop-color="#1b1f28"/><stop offset="1" stop-color="${color}" stop-opacity="0.55"/>
      </linearGradient>
      <radialGradient id="${id}-glow" cx="0.88" cy="0.15" r="0.65">
        <stop offset="0" stop-color="${color}" stop-opacity="0.85"/><stop offset="0.5" stop-color="${color}" stop-opacity="0.25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${id}-glow2" cx="0.35" cy="1.1" r="0.55">
        <stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f4f6fa"/><stop offset="0.45" stop-color="#b8bfcc"/><stop offset="0.55" stop-color="#8f97a6"/><stop offset="1" stop-color="#5b6272"/>
      </linearGradient>
      <linearGradient id="${id}-plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a3f4b"/><stop offset="0.5" stop-color="#20242d"/><stop offset="1" stop-color="#0f1116"/>
      </linearGradient>
      <linearGradient id="${id}-rim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0.02"/>
      </linearGradient>
      <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#000" flood-opacity="0.5"/></filter>
      <filter id="${id}-blur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>`;
  const bg = `
    <rect width="${W}" height="${H}" fill="url(#${id}-base)"/>
    <rect width="${W}" height="${H}" fill="url(#${id}-glow)"/>
    <rect width="${W}" height="${H}" fill="url(#${id}-glow2)"/>
    <g opacity="0.55" filter="url(#${id}-blur)"><ellipse cx="${W * 0.78}" cy="${H * 0.1}" rx="90" ry="40" fill="${color}" opacity="0.5"/></g>
    <g transform="rotate(-28 ${W * 0.7} ${H / 2})" opacity="0.9">
      <rect x="${W * 0.55}" y="-60" width="46" height="${H * 2.2}" fill="url(#${id}-sheen)"/>
      <rect x="${W * 0.72}" y="-60" width="18" height="${H * 2.2}" fill="url(#${id}-sheen)" opacity="0.6"/>
    </g>`;
  const cx = opts.tall ? W * 0.8 : W * 0.76, cy = opts.tall ? H * 0.38 : H * 0.52;
  let art = '';
  if (kind === 'dumbbell') {
    // Kurzhantel, leicht gekippt: Griff + je zwei Scheiben mit Lichtkante
    const plate = (x, w, hgt) => `<rect x="${x}" y="${-hgt / 2}" width="${w}" height="${hgt}" rx="7" fill="url(#${id}-plate)"/><rect x="${x}" y="${-hgt / 2}" width="${w}" height="${hgt}" rx="7" fill="url(#${id}-rim)"/>`;
    art = `<g transform="translate(${cx} ${cy}) rotate(-32)" filter="url(#${id}-shadow)">
      <rect x="-64" y="-9" width="128" height="18" rx="9" fill="url(#${id}-metal)"/>
      <rect x="-30" y="-6" width="60" height="12" rx="6" fill="#0f1116" opacity="0.25"/>
      ${plate(-102, 26, 74)}${plate(-76, 18, 58)}${plate(76 - 18, 18, 58)}${plate(76, 26, 74)}
    </g>`;
  } else if (kind === 'kettlebell') {
    // Kettlebell: dicker Griffbogen, Kugel mit Lichtsichel und flachem Fuß
    art = `<g transform="translate(${cx} ${cy + 8}) rotate(-10)" filter="url(#${id}-shadow)">
      <path d="M-40 -24 C-40 -86 40 -86 40 -24 L26 -24 C26 -68 -26 -68 -26 -24 Z" fill="url(#${id}-metal)"/>
      <ellipse cx="0" cy="62" rx="30" ry="6" fill="#0f1116" opacity="0.45"/>
      <circle r="52" cy="14" fill="url(#${id}-plate)"/>
      <circle r="52" cy="14" fill="url(#${id}-rim)"/>
      <path d="M-34 -6 C-30 -28 -12 -38 8 -36 C-10 -30 -24 -18 -30 2 Z" fill="#fff" opacity="0.16"/>
    </g>`;
  } else if (kind === 'plates') {
    // Hantelscheiben-Stapel: drei Scheiben leicht versetzt, mit Loch und Lichtkante
    const disc = (dx, dy, r) => `<g transform="translate(${dx} ${dy})"><ellipse rx="${r}" ry="${r * 0.34}" cy="10" fill="#0f1116" opacity="0.5"/><ellipse rx="${r}" ry="${r * 0.34}" fill="url(#${id}-plate)"/><ellipse rx="${r}" ry="${r * 0.34}" fill="url(#${id}-rim)"/><ellipse rx="${r * 0.72}" ry="${r * 0.24}" fill="#0f1116" opacity="0.25"/><ellipse rx="${r * 0.14}" ry="${r * 0.05}" fill="#0f1116" opacity="0.7"/></g>`;
    art = `<g transform="translate(${cx} ${cy + 20})" filter="url(#${id}-shadow)">${disc(0, 30, 70)}${disc(6, 8, 66)}${disc(-4, -16, 62)}</g>`;
  } else if (kind === 'cable') {
    // Kabelzug-Griff: Karabiner, Kabel und ein D-Griff mit Metallbügel
    art = `<g transform="translate(${cx + 10} ${cy - 10}) rotate(-18)" filter="url(#${id}-shadow)">
      <line x1="0" y1="-160" x2="0" y2="-54" stroke="#9aa3b4" stroke-width="5" stroke-linecap="round"/>
      <rect x="-9" y="-62" width="18" height="30" rx="9" fill="none" stroke="url(#${id}-metal)" stroke-width="6"/>
      <path d="M-40 -20 C-40 -48 40 -48 40 -20 L40 20 C40 48 -40 48 -40 20 Z" fill="none" stroke="url(#${id}-metal)" stroke-width="12" stroke-linejoin="round"/>
      <rect x="-58" y="-14" width="116" height="28" rx="14" fill="url(#${id}-plate)"/><rect x="-58" y="-14" width="116" height="28" rx="14" fill="url(#${id}-rim)"/>
    </g>`;
  } else {
    // Langhantel: lange Stange, je drei Scheiben außen
    const plate = (x, w, hgt) => `<rect x="${x}" y="${-hgt / 2}" width="${w}" height="${hgt}" rx="6" fill="url(#${id}-plate)"/><rect x="${x}" y="${-hgt / 2}" width="${w}" height="${hgt}" rx="6" fill="url(#${id}-rim)"/>`;
    art = `<g transform="translate(${cx - 10} ${cy}) rotate(-26)" filter="url(#${id}-shadow)">
      <rect x="-190" y="-7" width="380" height="14" rx="7" fill="url(#${id}-metal)"/>
      ${plate(-172, 16, 62)}${plate(-156, 14, 82)}${plate(-142, 22, 96)}
      ${plate(120, 22, 96)}${plate(142, 14, 82)}${plate(156, 16, 62)}
      <rect x="-118" y="-9" width="10" height="18" rx="3" fill="#6b7383"/><rect x="108" y="-9" width="10" height="18" rx="3" fill="#6b7383"/>
    </g>`;
  }
  return `<svg class="plan-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}${bg}${art}</svg>`;
}
