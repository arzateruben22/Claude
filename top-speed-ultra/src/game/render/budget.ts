// The phone's graphics-memory budget (2026-11-24; the owner's iPhone, v32: a mid-drive switch to Ultra killed the page,
// "just keeps loading and refreshing", the Claude viewer's "Something went wrong").
//
// iOS gives a web page one memory limit for everything (the JS heap, the canvases the textures were painted from, and
// every WebGL texture, render target and buffer, which share the phone's memory), and kills the page's process without
// any event when it is crossed; the viewer then reloads it. Nobody publishes the limit. The plan this file holds to is a
// heuristic: stay well under about 1 GB for the whole page, which means GPU allocations under about 300-400 MB on a
// 6 GB iPhone. Measured with the WebGL call model (tests/gpu-mem.mjs) at 393x852 CSS px, DPR 3, a switch from Retro Low
// to Ultra mid-drive on v32 asked for about 616 MB of GPU memory and left about 353 MB behind after going back to Retro
// Low (146 MB before). PROJECT_OC_TECHNICAL_NOTES.md, "The phone's graphics-memory budget", has the tables.
//
// So on a phone the presets with post (High and Ultra) are capped (`capPreset`), and the page's context is made
// without its own MSAA (`antialias`, below). Low, Medium and Retro are unchanged; a desktop is unchanged.
import type { QualityPreset } from '../settings';

export interface DeviceClass { phone: boolean; why: string }

let cached: DeviceClass | null = null;
// a phone (or an iPad: iOS has the same per-page limit): iOS by its user agent (iPadOS reports a Mac with touch), or a
// coarse pointer on a small screen. `?device=phone` or `?device=desktop` forces it (tests).
export function deviceClass(): DeviceClass {
  if (cached) return cached;
  let force = '';
  try { force = new URLSearchParams(location.search).get('device') ?? ''; } catch { /* no query */ }
  if (force === 'phone' || force === 'desktop') return (cached = { phone: force === 'phone', why: `?device=${force}` });
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  if (ios) return (cached = { phone: true, why: 'iOS' });
  let coarse = false;
  try { coarse = matchMedia('(pointer: coarse)').matches; } catch { /* no media queries */ }
  const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) <= 600;
  if (coarse && small) return (cached = { phone: true, why: 'touch screen under 600 px' });
  return (cached = { phone: false, why: 'desktop' });
}

// The caps on a phone, each from the measurements (MB at 393x852, DPR 3):
//  - pixel ratio 2 -> 1.5 on High and Ultra: every full-screen target scales with it (1.34 -> 0.75 Mpx): the composer's
//    4x MSAA target, the post chain and the drawing buffer, about 175 -> 99 MB with the leaner chain below.
//  - the sun's shadow map 4096 -> 2048 on Ultra (three's shadow target is RGBA8 colour plus a depth buffer: 128 -> 32 MB).
//  - procedural textures at most 1024 (Ultra asks 2048; most were already clamped to 1024) and no normal or roughness
//    maps on the building atlases (2 x 2 x 10.6 MB; they read only up close): `lean` in textures.ts.
//  - the canvas without its own 4x MSAA (`antialias: false`): High and Ultra draw through the composer's own MSAA
//    target and Retro through its own pass, so the canvas's multisampled buffer was never seen on them (about 32 bytes
//    a pixel: 43 MB at Retro's 786x1704). Standard Low and Medium (internal presets now) lose their edge smoothing.
//  - bloom is not capped: UnrealBloomPass already works at half resolution and below (about 4 MB).
export const PHONE_CAP = { maxPixelRatio: 1.5, shadows: 2048, texture: 1024 } as const;

export function capPreset(q: QualityPreset, d: DeviceClass = deviceClass()): QualityPreset {
  if (!d.phone || !q.post) return q;
  return { ...q, maxPixelRatio: Math.min(q.maxPixelRatio, PHONE_CAP.maxPixelRatio), shadows: Math.min(q.shadows, PHONE_CAP.shadows), texture: Math.min(q.texture, PHONE_CAP.texture) };
}

// The crash-loop breaker. A page killed for memory gets no event, and the viewer reloads it with the settings it saved:
// a phone that died on Ultra booted on Ultra and died again (the owner's "keeps loading and refreshing"). So on a phone,
// before a High or Ultra warm-up, a mark is saved; the game clears it once the preset has drawn for a while (Game
// `riskTick`). A page that finds the mark at boot died on that preset: it boots on Retro Low and says why.
const RISK_KEY = 'tsu.gpuRisk';
export interface GpuRisk { quality: string; why: string; at: number }
export function armGpuRisk(quality: string, why: string) {
  try { localStorage.setItem(RISK_KEY, JSON.stringify({ quality, why, at: Date.now() } satisfies GpuRisk)); } catch { /* storage off: no breaker */ }
}
export function clearGpuRisk() { try { localStorage.removeItem(RISK_KEY); } catch { /* fine */ } }
// read and clear the mark (at boot); a mark older than 30 minutes is ignored (the page was simply closed)
export function takeGpuRisk(): GpuRisk | null {
  try {
    const v = JSON.parse(localStorage.getItem(RISK_KEY) || 'null') as GpuRisk | null;
    localStorage.removeItem(RISK_KEY);
    if (!v || typeof v.at !== 'number' || Date.now() - v.at > 30 * 60 * 1000) return null;
    return v;
  } catch { return null; }
}
