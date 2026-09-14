// Teilbare Bildkarte eines Workouts (Canvas → PNG → Share-Sheet)
import { fmtDuration, fmtNum, fmtDate, download, toast } from './util.js';
import { sessionVolume, getSettings } from './store.js';
import { sessionPRs, fmtKg, PR_LABELS } from './progression.js';
import { muscleSets, bodyMapSvg, MUSCLE_NAME } from './muscles.js';

const W = 1080, H = 1350;
const COLORS = {
  bg1: '#0f1115', bg2: '#1c1410', surface: '#181b22', border: '#2b3040',
  text: '#f2f4f8', text2: '#aab1c3', text3: '#6f778a', accent: '#ff5c35', good: '#3ddc84',
  sil: '#2a2f3b',
};

/** Körperkarte als eigenständiges SVG (feste Farben statt CSS-Variablen), für Image/Canvas */
function standaloneBodyMap(side, sets) {
  const svg = bodyMapSvg(side, sets, { mode: 'session', still: true });
  const style = `<style>
    .body-sil{fill:${COLORS.sil}} .body-limb{fill:none;stroke:${COLORS.sil};stroke-width:26;stroke-linecap:round;stroke-linejoin:round}
    .body-leg{fill:none;stroke:${COLORS.sil};stroke-width:40;stroke-linecap:round;stroke-linejoin:round}
    .muscle{fill:#3a4050;stroke:${COLORS.bg1};stroke-width:1.5} .muscle-lines{fill:none;stroke:${COLORS.bg1};stroke-width:1.5;opacity:.7}
  </style>`;
  // bodyMapSvg liefert bereits xmlns; nur die Klasse (CSS-Variablen) entfernen und feste Farben einbetten
  return svg.replace(/^<svg([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/ class="[^"]*"/, '')}>${style}`);
}

function loadSvg(svgText) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Zeichnet die Karte und liefert den Canvas */
export async function renderShareCard(session) {
  const settings = getSettings();
  const unit = settings.unit;
  const display = '"Space Grotesk", -apple-system, "Segoe UI", Roboto, sans-serif';
  const body = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  try { await Promise.all([document.fonts.load(`700 80px ${display}`), document.fonts.load(`600 40px ${display}`)]); } catch { /* Systemschrift */ }

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Hintergrund mit Akzent-Schimmer oben links
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, COLORS.bg2); g.addColorStop(0.45, COLORS.bg1); g.addColorStop(1, COLORS.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(140, 120, 20, 140, 120, 700);
  glow.addColorStop(0, 'rgba(255,92,53,0.28)'); glow.addColorStop(1, 'rgba(255,92,53,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Kopf
  ctx.fillStyle = COLORS.accent;
  ctx.font = `700 30px ${display}`; ctx.letterSpacing = '4px';
  ctx.fillText('HANTEL · WORKOUT', 72, 110);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 84px ${display}`;
  ctx.fillText(fitText(ctx, session.planName, W - 144), 72, 205);
  ctx.fillStyle = COLORS.text2;
  ctx.font = `500 34px ${body}`;
  ctx.fillText(fmtDate(session.startedAt, { year: true, time: true }), 72, 262);

  // Kennzahlen
  const prs = sessionPRs(session);
  const sets = session.entries.reduce((a, e) => a + e.sets.length, 0);
  const stats = [
    [fmtDuration(session.durationSec), 'DAUER'],
    [String(sets), 'SÄTZE'],
    [fmtNum(sessionVolume(session)), `VOLUMEN ${unit.toUpperCase()}`],
    [String(prs.length), 'REKORDE'],
  ];
  const tileW = (W - 144 - 3 * 20) / 4;
  stats.forEach(([v, l], i) => {
    const x = 72 + i * (tileW + 20), y = 310;
    ctx.fillStyle = COLORS.surface; roundRect(ctx, x, y, tileW, 150, 24); ctx.fill();
    ctx.strokeStyle = COLORS.border; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = i === 3 && prs.length ? COLORS.good : COLORS.text;
    ctx.font = `700 60px ${display}`; ctx.fillText(fitText(ctx, v, tileW - 40), x + 22, y + 80);
    ctx.fillStyle = COLORS.text3; ctx.font = `700 20px ${body}`; ctx.letterSpacing = '2px';
    ctx.fillText(l, x + 22, y + 122); ctx.letterSpacing = '0px';
  });

  // Körperkarte vorn/hinten
  const ms = muscleSets([session]);
  const [front, back] = await Promise.all([loadSvg(standaloneBodyMap('front', ms.totals)), loadSvg(standaloneBodyMap('back', ms.totals))]);
  const mapH = 560, mapW = mapH * (200 / 420);
  const mapY = 500, mapX = 72;
  ctx.fillStyle = COLORS.surface; roundRect(ctx, 72, mapY - 20, mapW * 2 + 80, mapH + 40, 28); ctx.fill();
  ctx.strokeStyle = COLORS.border; ctx.stroke();
  ctx.drawImage(front, mapX + 20, mapY, mapW, mapH);
  ctx.drawImage(back, mapX + 40 + mapW, mapY, mapW, mapH);

  // Rechts: trainierte Muskeln + Rekorde
  const rightX = 72 + mapW * 2 + 80 + 36;
  const rightW = W - 72 - rightX;
  let y = mapY + 20;
  ctx.fillStyle = COLORS.text3; ctx.font = `700 20px ${body}`; ctx.letterSpacing = '2px';
  ctx.fillText('TRAINIERT', rightX, y); ctx.letterSpacing = '0px';
  y += 44;
  const trained = Object.entries(ms.totals).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  ctx.font = `500 26px ${body}`;
  for (const [k, n] of trained) {
    ctx.fillStyle = COLORS.text; ctx.fillText(fitText(ctx, MUSCLE_NAME[k], rightW - 70), rightX, y);
    ctx.fillStyle = COLORS.text2; ctx.textAlign = 'right';
    ctx.fillText((Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')) + ' S.', W - 72, y);
    ctx.textAlign = 'left';
    y += 42;
  }
  if (prs.length) {
    y += 26;
    ctx.fillStyle = COLORS.good; ctx.font = `700 20px ${body}`; ctx.letterSpacing = '2px';
    ctx.fillText('NEUE REKORDE', rightX, y); ctx.letterSpacing = '0px';
    y += 44;
    for (const p of prs.slice(0, 4)) {
      ctx.fillStyle = COLORS.text; ctx.font = `600 30px ${display}`;
      ctx.fillText(fitText(ctx, p.name, rightW), rightX, y);
      ctx.fillStyle = COLORS.text2; ctx.font = `500 26px ${body}`;
      const val = p.type === 'volume' ? `${fmtNum(p.value)} ${unit}` : p.type === 'e1rm' ? `e1RM ${fmtKg(Math.round(p.value))}` : `${fmtKg(p.weight)} × ${p.reps}`;
      ctx.fillText(fitText(ctx, `${val} · ${PR_LABELS[p.type]}`, rightW), rightX, y + 34);
      y += 84;
    }
  }

  // Übungen (kompakt)
  y = mapY + mapH + 70;
  ctx.fillStyle = COLORS.text3; ctx.font = `700 20px ${body}`; ctx.letterSpacing = '2px';
  ctx.fillText('ÜBUNGEN', 72, y); ctx.letterSpacing = '0px';
  y += 40;
  ctx.font = `500 27px ${body}`;
  const lines = session.entries.slice(0, 8).map(e => {
    const best = e.sets.reduce((a, s) => (Number(s.weight) || 0) > (Number(a.weight) || 0) ? s : a, e.sets[0]);
    return `${e.name} · ${e.sets.length} × ${best?.reps ?? '–'} @ ${fmtKg(best?.weight)}`;
  });
  const colW = (W - 144 - 30) / 2;
  lines.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    ctx.fillStyle = COLORS.text2;
    ctx.fillText(fitText(ctx, t, colW), 72 + col * (colW + 30), y + row * 40);
  });

  // Fußzeile
  ctx.fillStyle = COLORS.text3; ctx.font = `500 24px ${body}`;
  ctx.fillText('Getrackt mit Hantel', 72, H - 60);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.accent; ctx.font = `700 24px ${display}`;
  ctx.fillText('marka-stack.github.io/hantel', W - 72, H - 60);
  ctx.textAlign = 'left';
  return c;
}

/** Karte rendern und über das Share-Sheet teilen (Fallback: PNG-Download) */
export async function shareSession(session) {
  const canvas = await renderShareCard(session);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const d = new Date(session.startedAt);
  const name = `hantel-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${session.planName} – Hantel` }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(name, blob, 'image/png');
  toast('Bild gespeichert');
}
