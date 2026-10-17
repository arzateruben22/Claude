// The run card: a share image of a finished run, drawn on a canvas on the device. Nothing is uploaded by the game:
// the phone's own share sheet takes the picture where there is one, and everywhere else it downloads as a PNG.
// It carries the honesty lines the game lives by: it's a game, scores stay on this device, the map is credited.
// The header is the game's lockup, as on the menus: the OC sunset wordmark (the 480 px cut-out), the chromed ULTRA
// beside it and TOP SPEED under (the game is "OC Ultra", owner 2026-10-16); its colours are the wordmark's.
import type { Result } from '../game/Game';
import { MODES } from '../game/settings';
import { OC_LOGO_480 } from './Mark';
import { has } from '../store/entitlements';

const W = 1080, H = 1350;                 // 4:5, the portrait size feeds like
const FONT = '"Saira Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const MPH = 2.236936, MI = 1609.344;
const SUNSET = '#fd9123', AMBER = '#febc31', EMBER = '#ee1e0a';
const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const MARK_W = 330, MARK_H = MARK_W * 171 / 480;   // the 480 px cut-out, drawn smaller for a crisp edge, never stretched
// inside the cut-out the letters start 2 % in and end at 85 % of its height (the speed streaks run below)
const MARK_IN = 0.02, MARK_FOOT = 0.85;

// the wordmark, decoded once; null if it can't be (the card then writes the name instead)
let mark: Promise<HTMLImageElement | null> | null = null;
export function loadMark(): Promise<HTMLImageElement | null> {
  mark ??= new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = OC_LOGO_480;
  });
  return mark;
}

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

export function drawRunCard(r: Result, name: string, logo: HTMLImageElement | null = null): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  // night road: the violet-black of the menus, a sunset glow on the horizon, lane lines running away from the bottom
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0812'); bg.addColorStop(0.55, '#120c1e'); bg.addColorStop(1, '#1b1329');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 0.58, 20, W / 2, H * 0.58, W * 0.7);
  glow.addColorStop(0, 'rgba(253, 145, 35, 0.2)'); glow.addColorStop(0.5, 'rgba(238, 30, 10, 0.06)'); glow.addColorStop(1, 'rgba(238, 30, 10, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const vy = H * 0.58;                                      // vanishing point
  for (let i = -2; i <= 2; i++) {
    const x0 = W / 2 + i * 330, x1 = W / 2 + i * 26;
    g.strokeStyle = i === 0 ? 'rgba(0, 0, 0, 0)' : Math.abs(i) === 1 ? 'rgba(243, 241, 236, 0.22)' : 'rgba(253, 145, 35, 0.5)';
    g.lineWidth = Math.abs(i) === 2 ? 5 : 4;
    if (Math.abs(i) === 1) g.setLineDash([60, 90]); else g.setLineDash([]);
    g.beginPath(); g.moveTo(x0, H + 40); g.lineTo(x1, vy); g.stroke();
  }
  g.setLineDash([]);
  // a scrim so the numbers read over the road
  const sc = g.createLinearGradient(0, 0, 0, H); sc.addColorStop(0, 'rgba(6, 7, 9, 0.2)'); sc.addColorStop(0.5, 'rgba(6, 7, 9, 0.55)'); sc.addColorStop(1, 'rgba(6, 7, 9, 0.85)');
  g.fillStyle = sc; g.fillRect(0, 0, W, H);

  // the sunset hairline along the top, as on the menus' panels
  const edge = g.createLinearGradient(0, 0, W, 0); edge.addColorStop(0, '#f96d09'); edge.addColorStop(0.5, '#fc6231'); edge.addColorStop(1, EMBER);
  g.fillStyle = edge; g.fillRect(0, 0, W, 8);

  const pad = 72;
  // header: the lockup on the left (OC, ULTRA, TOP SPEED), the mode and the driver on the right
  const spaced = (t: string) => t.toUpperCase().split('').join(String.fromCharCode(8202));
  g.textBaseline = 'alphabetic';
  const mx = pad - MARK_W * MARK_IN, my = pad - 30, foot = my + MARK_H * MARK_FOOT;
  let ux = mx + MARK_W + 12;
  if (logo) g.drawImage(logo, mx, my, MARK_W, MARK_H);
  else { g.fillStyle = SUNSET; g.font = `900 120px ${DISPLAY}`; g.fillText('OC', pad, foot); ux = pad + g.measureText('OC').width + 18; }
  // ULTRA in brushed chrome on the letters' baseline, leaning like the menu's
  const us = Math.round(MARK_W * 0.2);
  g.save(); g.translate(ux, foot); g.transform(1, 0, -Math.tan(8 * Math.PI / 180), 1, 0, 0);
  const chrome = g.createLinearGradient(0, -us * 0.72, 0, 0);
  [[0, '#ffffff'], [0.34, '#d4cfe2'], [0.49, '#6a6380'], [0.52, '#2b2538'], [0.6, '#d4cfe2'], [0.78, '#ffffff'], [1, '#d4cfe2']].forEach(([k, v]) => chrome.addColorStop(k as number, v as string));
  g.font = `900 ${us}px ${DISPLAY}`;
  g.fillStyle = EMBER; g.globalAlpha = 0.85; g.fillText('ULTRA', -2, 0);
  g.fillStyle = chrome; g.globalAlpha = 1; g.fillText('ULTRA', 0, 0);
  g.restore();
  // TOP SPEED, quiet, under both, after a short sunset dash
  g.fillStyle = edge; g.fillRect(pad, foot + 31, 34, 3);
  g.fillStyle = '#b9bcc2'; g.font = `600 24px ${FONT}`; g.fillText('TOP SPEED'.split('').join(String.fromCharCode(8201)), pad + 48, foot + 41);
  g.textAlign = 'right';
  g.fillStyle = SUNSET; g.font = `700 30px ${FONT}`; g.fillText(spaced(MODES[r.mode].label), W - pad, pad + 26);
  g.fillStyle = '#b9bcc2'; g.font = `600 30px ${FONT}`; g.fillText(name, W - pad, pad + 70);
  g.textAlign = 'left';
  // the store's Founder '26 badge under the name, and its frame round the card (src/store: owned, never sold again)
  if (has('badge-founder-26')) founderBadge(g, W - pad, pad + 92);
  if (has('frame-founder-runcard')) founderFrame(g);
  // the road
  let y = pad + 156;
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
  g.fillStyle = AMBER; g.font = `800 40px ${FONT}`; g.fillText('#OCUltra', pad, fy - 92);
  g.fillStyle = '#f3f1ec'; g.font = `600 28px ${FONT}`; g.fillText('A game. Drive the real ones at the limit.', pad, fy - 44);
  g.fillStyle = '#8f939a'; g.font = `500 22px ${FONT}`;
  g.fillText('Scores stay on this device. Map: OpenStreetMap contributors via Overture Maps (ODbL).', pad, fy - 6);
  return c;
}

// the Founders' sunset: amber to Founders Sunset orange to dusk plum (catalog: paint-founders-sunset is #E8622C)
function sunset(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const s = g.createLinearGradient(x0, y0, x1, y1);
  s.addColorStop(0, '#ffb347'); s.addColorStop(0.5, '#e8622c'); s.addColorStop(1, '#8e2c6b');
  return s;
}
function founderBadge(g: CanvasRenderingContext2D, right: number, top: number) {
  const text = "FOUNDER '26", h = 44;
  g.font = `800 24px ${FONT}`;
  const w = g.measureText(text).width + 40, x = right - w;
  const fill = g.createLinearGradient(x, top, x + w, top); fill.addColorStop(0, '#ffb347'); fill.addColorStop(1, '#e8622c');   // dark text stays 5:1 over it
  roundRect(g, x, top, w, h, h / 2); g.fillStyle = fill; g.fill();
  g.fillStyle = '#1a0b05'; g.textBaseline = 'middle'; g.fillText(text, x + 20, top + h / 2 + 1); g.textBaseline = 'alphabetic';
}
function founderFrame(g: CanvasRenderingContext2D) {
  g.save();
  g.lineWidth = 14; g.strokeStyle = sunset(g, 0, 0, W, H);
  roundRect(g, 18, 18, W - 36, H - 36, 28); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255, 179, 71, 0.45)';
  roundRect(g, 36, 36, W - 72, H - 72, 18); g.stroke();
  g.restore();
}

// the hosted page's viewer (claude.ai) blocks plain downloads and offers its own save prompt instead
interface HostDownloads { save(r: { filename: string; data: Blob }): Promise<{ status: string }> }
interface HostRuntime { use?: (name: 'downloads') => Promise<HostDownloads | null> }

// share the card through the device's share sheet, the host's save prompt, or a download; says which happened
export async function shareRunCard(r: Result, name: string): Promise<'shared' | 'saved' | 'declined' | 'failed'> {
  const c = drawRunCard(r, name, await loadMark());
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], `oc-ultra-${r.mode}-${Math.round(r.score)}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'OC Ultra: Top Speed', text: '#OCUltra' }); return 'shared'; } catch { /* cancelled or refused: save it instead */ }
  }
  const host = (window as unknown as { claude?: HostRuntime }).claude;
  if (host?.use) {
    const dl = await host.use('downloads').catch(() => null);
    if (dl) {
      try { await dl.save({ filename: file.name, data: blob }); return 'saved'; } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === 'declined') return 'declined';
        if (code !== 'unavailable' && code !== 'not_granted') return 'failed';
        /* no save prompt in this view: try a plain download below */
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
