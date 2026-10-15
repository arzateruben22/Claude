// The run card: a share image of a finished run, drawn on a canvas on the device. Nothing is uploaded by the game:
// the phone's own share sheet takes the picture where there is one, and everywhere else it downloads as a PNG.
// It carries the honesty lines the game lives by: it's a game, scores stay on this device, the map is credited.
import type { Result } from '../game/Game';
import { MODES } from '../game/settings';

const W = 1080, H = 1350;                 // 4:5, the portrait size feeds like
const FONT = '"Saira Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const MPH = 2.236936, MI = 1609.344;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// the route shield, as the menu draws it: blue with a red top for an Interstate, white with a black border for a state route
function shield(g: CanvasRenderingContext2D, label: string, x: number, y: number, h: number) {
  const m = /^(I|CA)-(\d+)\s*(\w+)?/.exec(label);
  if (!m) { g.fillStyle = '#f3f1ec'; g.font = `700 ${h * 0.7}px ${FONT}`; g.textBaseline = 'middle'; g.fillText(label, x, y + h / 2); return g.measureText(label).width; }
  const w = h * 1.35;
  g.font = `800 ${h * 0.56}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (m[1] === 'I') {
    roundRect(g, x, y, w, h, h * 0.22); g.fillStyle = '#fff'; g.fill();
    roundRect(g, x + 4, y + 4, w - 8, h - 8, h * 0.18); g.fillStyle = '#1d4f9c'; g.fill();
    g.fillStyle = '#c8102e'; roundRect(g, x + 4, y + 4, w - 8, h * 0.22, h * 0.12); g.fill();
    g.fillStyle = '#fff'; g.fillText(m[2], x + w / 2, y + h * 0.6);
  } else {
    roundRect(g, x, y, w, h, h * 0.3); g.fillStyle = '#111'; g.fill();
    roundRect(g, x + 5, y + 5, w - 10, h - 10, h * 0.24); g.fillStyle = '#f4f4ee'; g.fill();
    g.fillStyle = '#111'; g.fillText(m[2], x + w / 2, y + h * 0.53);
  }
  g.textAlign = 'left';
  if (m[3]) { g.fillStyle = '#f3f1ec'; g.font = `700 ${h * 0.62}px ${FONT}`; g.fillText(m[3], x + w + h * 0.3, y + h / 2); return w + h * 0.3 + g.measureText(m[3]).width; }
  return w;
}

export function drawRunCard(r: Result, name: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  // night road: a dark gradient, a horizon glow, lane lines running away from the bottom
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0c0f'); bg.addColorStop(0.55, '#14161b'); bg.addColorStop(1, '#1d2028');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 0.58, 20, W / 2, H * 0.58, W * 0.7);
  glow.addColorStop(0, 'rgba(245, 197, 24, 0.16)'); glow.addColorStop(1, 'rgba(245, 197, 24, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const vy = H * 0.58;                                      // vanishing point
  for (let i = -2; i <= 2; i++) {
    const x0 = W / 2 + i * 330, x1 = W / 2 + i * 26;
    g.strokeStyle = i === 0 ? 'rgba(245, 197, 24, 0.0)' : Math.abs(i) === 1 ? 'rgba(243, 241, 236, 0.22)' : 'rgba(245, 197, 24, 0.5)';
    g.lineWidth = Math.abs(i) === 2 ? 5 : 4;
    if (Math.abs(i) === 1) g.setLineDash([60, 90]); else g.setLineDash([]);
    g.beginPath(); g.moveTo(x0, H + 40); g.lineTo(x1, vy); g.stroke();
  }
  g.setLineDash([]);
  // a scrim so the numbers read over the road
  const sc = g.createLinearGradient(0, 0, 0, H); sc.addColorStop(0, 'rgba(6, 7, 9, 0.2)'); sc.addColorStop(0.5, 'rgba(6, 7, 9, 0.55)'); sc.addColorStop(1, 'rgba(6, 7, 9, 0.85)');
  g.fillStyle = sc; g.fillRect(0, 0, W, H);

  const pad = 72;
  // header: the game, the mode, the driver
  g.fillStyle = '#f5c518'; g.font = `700 30px ${FONT}`; g.textBaseline = 'alphabetic';
  g.fillText(('TOP SPEED OC · ' + MODES[r.mode].label).toUpperCase().split('').join(String.fromCharCode(8202)), pad, pad + 30);
  g.textAlign = 'right'; g.fillStyle = '#b9bcc2'; g.font = `600 30px ${FONT}`; g.fillText(name, W - pad, pad + 30); g.textAlign = 'left';
  // the road
  let y = pad + 90;
  if (r.road) shield(g, r.road, pad, y, 92);
  y += 92;
  // the big number
  const big = r.race ? `P${r.race.position}` : r.mode === 'time' || r.mode === 'free' ? (r.distance / MI).toFixed(2) : Math.round(r.score).toLocaleString();
  const unit = r.race ? `of ${r.race.of} · ${r.race.time}` : r.mode === 'time' || r.mode === 'free' ? 'miles' : 'points';
  g.fillStyle = '#f3f1ec'; g.font = `700 230px ${FONT}`; g.fillText(big, pad - 6, y + 250);
  const bw = g.measureText(big).width;
  g.fillStyle = '#b9bcc2'; g.font = `600 44px ${FONT}`; g.fillText(unit, pad + bw + 22, y + 250);
  y += 300;
  // the reason line
  g.fillStyle = '#f3f1ec'; g.font = `700 58px ${FONT}`; g.fillText(r.reason, pad, y + 58);
  if (r.newBest) { g.fillStyle = '#7be08d'; g.font = `700 34px ${FONT}`; g.fillText(r.race ? 'NEW BEST TIME' : 'NEW PERSONAL BEST', pad, y + 112); }
  y += 170;
  // stats
  const stats: [string, string][] = [['Top speed', `${Math.round(r.top * MPH)} mph`], ['Distance', `${(r.distance / MI).toFixed(2)} mi`]];
  if (r.mode === 'survival') stats.push(['Streak over 100', `${r.bestStreak.toFixed(1)} s`], ['Near misses', String(r.nearMisses)], ['Clean passes', String(r.overtakes)], ['Collisions', String(r.collisions)]);
  else if (r.race) stats.push(['Course', r.race.course], ['Credits', `+${r.race.credits.toLocaleString()}`]);
  const cols = 2, cw = (W - pad * 2) / cols;
  stats.forEach(([k, v], i) => {
    const x = pad + (i % cols) * cw, yy = y + Math.floor(i / cols) * 118;
    g.strokeStyle = 'rgba(243, 241, 236, 0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + cw - 24, yy); g.stroke();
    g.fillStyle = '#b9bcc2'; g.font = `700 24px ${FONT}`; g.fillText(k.toUpperCase().split('').join(String.fromCharCode(8202)), x, yy + 36);
    g.fillStyle = '#f3f1ec'; g.font = `700 54px ${FONT}`; g.fillText(v, x, yy + 96);
  });
  // footer: the honest lines
  const fy = H - pad;
  g.fillStyle = '#f5c518'; g.font = `800 40px ${FONT}`; g.fillText('#TopSpeedOC', pad, fy - 92);
  g.fillStyle = '#f3f1ec'; g.font = `600 28px ${FONT}`; g.fillText('A game. Drive the real ones at the limit.', pad, fy - 44);
  g.fillStyle = '#8f939a'; g.font = `500 22px ${FONT}`;
  g.fillText('Scores stay on this device. Map: OpenStreetMap contributors via Overture Maps (ODbL).', pad, fy - 6);
  return c;
}

// share the card through the device's share sheet, or download it; says which happened
export async function shareRunCard(r: Result, name: string): Promise<'shared' | 'saved' | 'failed'> {
  const c = drawRunCard(r, name);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], `top-speed-oc-${r.mode}-${Math.round(r.score)}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Top Speed OC', text: '#TopSpeedOC' }); return 'shared'; } catch { /* cancelled or refused: save it instead */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
