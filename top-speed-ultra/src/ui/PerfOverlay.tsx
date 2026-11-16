// The performance overlay (SMOOTH): Settings > "Show performance" (off by default), or `?perf` in the address for one
// visit. Measured numbers only, from this device: the frame rate over the last second, the 1 % low (the slowest
// frame in a hundred, over the last 4 s), a frame-time graph against the 60 and 30 fps lines, the main view's draw
// calls and triangles, the governor's level and its last action. It reads Game.perf four times a second (no loop of
// its own on the frames) and never takes a tap. Every drawn frame feeds its numbers (FrameGovernor.record), with
// Adaptive quality on or off. A plain group, not a live region: screen readers aren't sent its updates.

import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/Game';
import { RING, T30, T60 } from '../game/render/governor';

const W = 132, H = 34, SPAN = 33.3 * 1.5;   // the graph: the last 132 frames, 0..50 ms

export function PerfOverlay({ game }: { game: Game | null }) {
  const [p, setP] = useState<Game['perf'] | null>(null);
  const graph = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!game) return;
    const draw = () => {
      const v = game.perf;
      setP({ ...v });
      const cv = graph.current, g = cv?.getContext('2d');
      if (!cv || !g) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const y = (ms: number) => H - Math.min(H, (ms / SPAN) * H);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, Math.round(y(T60)), W, 1);
      g.fillStyle = 'rgba(255,190,90,0.3)'; g.fillRect(0, Math.round(y(T30)), W, 1);
      const gov = game.gov, n = Math.min(W, gov.filled);
      for (let i = 0; i < n; i++) {
        const ms = gov.ring[(gov.head - n + i + RING) % RING];
        g.fillStyle = ms > T30 * 1.1 ? '#ff6a4f' : ms > T60 * 1.1 ? '#ffc25a' : '#6ff7de';
        const top = y(ms); g.fillRect(W - n + i, top, 1, H - top);
      }
    };
    draw();
    const t = setInterval(draw, 250);
    return () => clearInterval(t);
  }, [game]);
  if (!p) return null;
  const tris = p.tris >= 1e6 ? (p.tris / 1e6).toFixed(2) + 'M' : p.tris >= 1e3 ? Math.round(p.tris / 1e3) + 'k' : String(p.tris);
  return (
    <div className="perf" role="group" aria-label="Performance, measured on this device">
      <div className="perf-top"><b className="perf-fps">{p.fps || '--'}</b><span>fps</span><span className="perf-low">1% low {p.low1 || '--'}</span></div>
      <canvas ref={graph} className="perf-graph" style={{ width: W, height: H }} aria-hidden="true" />
      <div>frame {p.frameMs} ms · work {p.workMs} ms</div>
      <div>{p.calls} calls · {tris} tris · {p.pixelRatio}x</div>
      <div className="perf-label">{p.label}</div>
      <div className="perf-detail">{p.detail}</div>
      {p.last && <div className="perf-last">{p.last}{p.lastAgo >= 0 ? ` · ${p.lastAgo} s ago` : ''}</div>}
      {p.injectMs > 0 && <div className="perf-last">test load +{p.injectMs} ms a frame</div>}
    </div>
  );
}
