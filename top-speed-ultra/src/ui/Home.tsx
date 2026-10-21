// The main menu's home screen, after the owner's reference (2026-10-21) in the OC sunset colourway: the rail's line
// icons, the profile chip, the four picture tiles and the World Map. App.tsx lays them out; styles.css ("the main
// menu") draws them. Icons are inline SVG line drawings of our own (24 px grid, 1.6 px stroke, currentColor).
import { useEffect, useRef } from 'react';
import { AVATARS, levelOf, xpFor } from '../game/profile';
import type { Profile } from '../game/profile';

export type IconName = 'drive' | 'map' | 'garage' | 'custom' | 'career' | 'settings' | 'store';

// a gear's outline: eight teeth round a ring
const GEAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 - Math.PI / 2, k = i % 4, r = k === 0 || k === 1 ? 9.6 : 7.4;
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
  }
  return 'M' + pts.join('L') + 'Z';
})();

const PATHS: Record<IconName, string> = {
  // a steering wheel: rim, hub and three spokes
  drive: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 9.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8M3.4 10.6L9.7 11.4M20.6 10.6L14.3 11.4M12 14.4V21',
  // a folded map
  map: 'M3 6.5L8.5 4.5L15.5 6.5L21 4.5V17.5L15.5 19.5L8.5 17.5L3 19.5ZM8.5 4.5V17.5M15.5 6.5V19.5',
  // a garage: the roof, the door and its panels
  garage: 'M3 10L12 4L21 10V20H3ZM6.5 20V12.5H17.5V20M6.5 15H17.5M6.5 17.5H17.5',
  // a wrench
  custom: 'M14.5 4.2a5 5 0 0 0-4.7 6.6L4 16.6a2 2 0 0 0 2.8 2.8l5.8-5.8a5 5 0 0 0 6.6-4.7l-2.9 2.1l-2.5-.6l-.6-2.5Z',
  // a climbing bar chart
  career: 'M4 20H20M6 20V14M10.5 20V10M15 20V12.5M19.5 20V5',
  settings: GEAR + 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  // a shopping bag
  store: 'M5 8H19L18 20H6ZM9 8V6.5a3 3 0 0 1 6 0V8',
};

export function RailIcon({ name }: { name: IconName }) {
  return (
    <svg className="ricon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

// the profile chip, top right: your avatar (its initial on the colour you chose: never a photo of anyone), your name,
// your level and the XP to the next, and your Credits (earned by driving; never a currency sign, and no "+": credits
// can't be bought, and the game has no Credits screen yet). The whole chip opens your profile.
export function ProfileChip({ p, current, onOpen }: { p: Profile; current: boolean; onOpen: () => void }) {
  const level = levelOf(p.xp), lo = xpFor(level), hi = xpFor(level + 1);
  const av = AVATARS[p.avatar] ?? AVATARS[0];
  const pct = Math.min(100, Math.max(0, ((p.xp - lo) / Math.max(1, hi - lo)) * 100));
  const name = p.username || 'Driver';
  return (
    <button type="button" className="pchip" aria-label="Profile" aria-describedby="pchip-desc" aria-current={current ? 'page' : undefined} onClick={onOpen}>
      <span className="pchip-avatar" style={{ background: av.bg, color: av.fg }} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <span className="pchip-who">
        <span className="pchip-name">{name}</span>
        <span className="pchip-level">Lvl {level}</span>
        <span className="pchip-xp" aria-hidden="true"><i style={{ width: `${pct.toFixed(1)}%` }} /></span>
      </span>
      <span className="pchip-credits"><small>Credits</small><b>{Math.floor(p.credits).toLocaleString()}</b></span>
      <span className="sr" id="pchip-desc">{`${name}, level ${level}, ${Math.round(pct)}% to level ${level + 1}, ${Math.floor(p.credits).toLocaleString()} credits`}</span>
    </button>
  );
}

// a picture tile along the foot of the home screen: the picture the game rendered at load (Game.captureTiles), a
// title and a line of what's in it
export function Tile({ img, title, sub, onClick }: { img?: string; title: string; sub: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="tile" onClick={onClick}>
        {img ? <img src={img} alt="" width={480} height={270} draggable={false} /> : <span className="tile-ph" aria-hidden="true" />}
        <b>{title}</b>
        <small>{sub}</small>
      </button>
    </li>
  );
}

// The World Map: the ten freeways from the map data (OpenStreetMap via Overture), both carriageways, drawn as lines of
// light on the night base, north up, the road you start on in sunset orange. Drawn on a canvas at the device's
// resolution; it says what it is in its label.
export function WorldMap({ lines, hot }: { lines: { label: string; pts: [number, number][] }[]; hot: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const g = c.getContext('2d');
      if (!g) return;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const l of lines) for (const [x, z] of l.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const pad = 18 * dpr, k = Math.min((c.width - pad * 2) / (x1 - x0 || 1), (c.height - pad * 2) / (z1 - z0 || 1));
      const ox = (c.width - (x1 - x0) * k) / 2, oy = (c.height - (z1 - z0) * k) / 2;
      const css = getComputedStyle(c);
      const line = css.getPropertyValue('--map-road').trim() || '#c9d3e0', glow = css.getPropertyValue('--map-glow').trim() || 'rgba(214,222,234,0.3)';
      const hotC = css.getPropertyValue('--map-hot').trim() || '#fd9123';
      g.clearRect(0, 0, c.width, c.height);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const stroke = (l: { pts: [number, number][] }, col: string, width: number, blur: number, shadow: string) => {
        g.strokeStyle = col; g.lineWidth = width * dpr; g.shadowColor = shadow; g.shadowBlur = blur * dpr;
        g.beginPath();
        l.pts.forEach(([x, z], i) => { const px = ox + (x - x0) * k, py = oy + (z - z0) * k; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
        g.stroke();
      };
      for (const l of lines) if (l.label !== hot) stroke(l, line, 1.3, 6, glow);
      for (const l of lines) if (l.label === hot) stroke(l, hotC, 2.6, 12, hotC);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [lines, hot]);
  return <canvas ref={ref} className="worldmap" role="img" aria-label={`Map of the ten freeways in the game, north up; ${hot} is highlighted`} />;
}
