// The World Map (U4 in PROJECT_OC_UI_TARGET.md; the style library's 03 MAP_NAVIGATION, ULTRA: a dark map with the
// roads lit in the accent). A full-screen canvas drawn from the real network (OpenStreetMap via Overture, ODbL):
// every freeway and, zoomed in, every ramp; the route shields; the cities; you and your planned route while driving;
// the race courses and our own places. Drag (or one finger) pans, the wheel or a pinch zooms. The list on the side
// does only what exists: navigate to a freeway while driving; on the menu, start at a real exit or pick a race.
// Houses and characters are roadmap and say so. It opens from the menu's rail and the pause screen, so the game is on
// the menu or paused while it is up.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Game } from '../game/Game';
import type { Path } from '../game/world/Path';
import { COURSES } from '../game/race';
import { STARTS } from '../game/settings';

// the network's projection (tools/oc-network/common.py): metres east (x) and south (z) of 33.72 N, 117.83 W
const LAT0 = 33.72, LON0 = -117.83, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const proj = (lat: number, lon: number): [number, number] => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
// city centres (public coordinates), for orientation only; nothing here claims a boundary. The first eight are the
// largest and show at every zoom; the rest only when there is room
const CITIES: [string, number, number][] = [
  ['Anaheim', 33.8366, -117.9143], ['Santa Ana', 33.7455, -117.8677], ['Irvine', 33.6846, -117.8265], ['Huntington Beach', 33.6595, -117.9988],
  ['Garden Grove', 33.7743, -117.938], ['Fullerton', 33.8704, -117.9242], ['Costa Mesa', 33.6411, -117.9187], ['Mission Viejo', 33.6, -117.672],
  ['Orange', 33.7879, -117.8531], ['Newport Beach', 33.6189, -117.9289], ['Westminster', 33.7513, -117.994], ['Lake Forest', 33.647, -117.6892],
  ['Tustin', 33.7459, -117.8262], ['Yorba Linda', 33.8886, -117.8131], ['San Clemente', 33.427, -117.612], ['Laguna Beach', 33.5427, -117.7854],
  ['Brea', 33.9167, -117.9001], ['Placentia', 33.8722, -117.8703], ['Dana Point', 33.4669, -117.6981],
];
// our own places (fictional), at their real spots
const PLACES = [{ id: 'lot57', name: 'Lot 57', blurb: 'Our own taproom and yard on Orangewood Avenue, Anaheim. On foot: coming later.', x: -5121, z: -8345 }];

type Tab = 'freeways' | 'races' | 'places';
interface View { cx: number; cz: number; mpp: number }      // centre (world metres) and metres per CSS pixel
interface Props {
  game: Game; driving: boolean; navTarget: string | null;
  onClose: () => void; onNavigate: (label: string | null) => void;
  onStartFreeway: (label: string) => void; onStartExit: (key: string) => void; onRace: (id: string) => void;
}

// the page's tokens, so the map takes the atmosphere and the look on screen
function tokens() {
  const css = getComputedStyle(document.documentElement), v = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
  return { void: v('--void', '#030915'), night: v('--night-2', '#0c1320'), ink: v('--ink', '#f6fbff'), dim: v('--dim', '#b9c6d8'), faint: v('--faint', '#8c9bb2'),
    ice: v('--ice', '#408cff'), cyan: v('--cyan', '#8bd6ff'), hi: v('--ice-hi', '#bfe4ff'), deep: v('--ice-deep', '#1f6fd6'), ember: v('--ember', '#ee1e0a') };
}
const hexA = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})` : hex);
const routeNo = (label: string) => /^(?:I|CA)-(\d+)/.exec(label)?.[1] ?? label;

function bounds(paths: Path[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of paths) { x0 = Math.min(x0, p.minX); x1 = Math.max(x1, p.maxX); z0 = Math.min(z0, p.minZ); z1 = Math.max(z1, p.maxZ); }
  return { x0, x1, z0, z1 };
}
// the part of the screen the map is seen in: left of the side list on a wide screen, above the sheet on a phone
function region(w: number, h: number) { return w > 760 ? { x: 0, y: 0, w: w - 360, h } : { x: 0, y: 0, w, h: h * 0.54 }; }
// a view that fits the bounds into that part of the screen, centred in it
function fit(b: { x0: number; x1: number; z0: number; z1: number }, w: number, h: number, pad = 48): View {
  const r = region(w, h), mpp = Math.max((b.x1 - b.x0) / Math.max(1, r.w - pad * 2), (b.z1 - b.z0) / Math.max(1, r.h - pad * 2), 2);
  return { cx: (b.x0 + b.x1) / 2 - (r.x + r.w / 2 - w / 2) * mpp, cz: (b.z0 + b.z1) / 2 - (r.y + r.h / 2 - h / 2) * mpp, mpp };
}

export function WorldMap({ game, driving, navTarget, onClose, onNavigate, onStartFreeway, onStartExit, onRace }: Props) {
  const cv = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('freeways');
  const [sel, setSel] = useState<string | null>(navTarget ?? (driving ? game.path.label || null : null));
  const [course, setCourse] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const mains = game.net.mains, all = useMemo(() => bounds(mains), [mains]);
  const exits = useMemo(() => (sel ? game.exitsFor(sel) : []), [game, sel]);

  // the first view: you and the freeways around you while driving, the whole county on the menu
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (driving) setView({ cx: game.phys.x, cz: game.phys.z, mpp: 18 }); else setView(fit(all, w, h));
  }, [all, driving, game]);

  // pan and zoom: pointer drag, a two-finger pinch, the wheel; zoom keeps the point under the cursor still
  const pts = useRef(new Map<number, { x: number; y: number }>()), pinch = useRef(0);
  const zoomAt = useCallback((f: number, sx: number, sy: number) => {
    setView((v) => {
      if (!v || !wrap.current) return v;
      const w = wrap.current.clientWidth, h = wrap.current.clientHeight, mpp = Math.min(160, Math.max(1.2, v.mpp * f));
      const wx = v.cx + (sx - w / 2) * v.mpp, wz = v.cz + (sy - h / 2) * v.mpp;
      return { cx: wx - (sx - w / 2) * mpp, cz: wz - (sy - h / 2) * mpp, mpp };
    });
  }, []);
  const onDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch.current = 0; };
  const onMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId); if (!prev) return;
    const all2 = [...pts.current.entries()];
    if (all2.length >= 2) {
      const [a, b] = all2.map(([id, p]) => (id === e.pointerId ? { x: e.clientX, y: e.clientY } : p));
      const d = Math.hypot(a.x - b.x, a.y - b.y), r = wrap.current!.getBoundingClientRect();
      if (pinch.current > 0) zoomAt(pinch.current / d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinch.current = d;
    } else {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      setView((v) => (v ? { ...v, cx: v.cx - dx * v.mpp, cz: v.cz - dy * v.mpp } : v));
    }
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); pinch.current = 0; };
  const onWheel = (e: React.WheelEvent) => { const r = wrap.current!.getBoundingClientRect(); zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); };

  // pick a freeway or a course: select it and frame it
  const frame = (paths: Path[]) => { const el = wrap.current; if (el && paths.length) setView(fit(bounds(paths), el.clientWidth, el.clientHeight, 40)); };
  const pickFreeway = (label: string) => { setSel(label); setCourse(null); frame(mains.filter((m) => m.label === label)); };
  const pickCourse = (id: string) => { setCourse(id); const c = COURSES.find((x) => x.id === id); if (c) { setSel(c.road); frame(mains.filter((m) => m.label === c.road)); } };

  // draw whenever the view, the selection or the size changes
  useEffect(() => {
    const c = cv.current, el = wrap.current; if (!c || !el || !view) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = el.clientWidth, h = el.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); if (!g) return;
    const T = tokens(), k = 1 / view.mpp;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (x: number) => w / 2 + (x - view.cx) * k, sy = (z: number) => h / 2 + (z - view.cz) * k;
    const vis = (p: Path, m = 0) => !(p.maxX < view.cx - (w / 2 + m) * view.mpp || p.minX > view.cx + (w / 2 + m) * view.mpp || p.maxZ < view.cz - (h / 2 + m) * view.mpp || p.minZ > view.cz + (h / 2 + m) * view.mpp);
    // the ground: the menus' night, a faint kilometre grid
    const bg = g.createRadialGradient(w * 0.55, h * 0.45, 10, w * 0.55, h * 0.45, Math.max(w, h) * 0.8);
    bg.addColorStop(0, T.night); bg.addColorStop(1, T.void); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const km = view.mpp > 40 ? 5000 : 1000; g.strokeStyle = hexA(T.ice, 0.06); g.lineWidth = 1; g.beginPath();
    for (let x = Math.floor((view.cx - (w / 2) * view.mpp) / km) * km; x < view.cx + (w / 2) * view.mpp; x += km) { g.moveTo(sx(x), 0); g.lineTo(sx(x), h); }
    for (let z = Math.floor((view.cz - (h / 2) * view.mpp) / km) * km; z < view.cz + (h / 2) * view.mpp; z += km) { g.moveTo(0, sy(z)); g.lineTo(w, sy(z)); }
    g.stroke();
    // a path as a polyline, skipping points closer than ~2 px
    const line = (p: Path, from = 0, to = p.n - 1) => {
      const stride = Math.max(1, Math.round((2 * view.mpp) / Math.max(0.5, p.len / Math.max(1, p.n - 1))));
      g.beginPath(); g.moveTo(sx(p.xs[from]), sy(p.zs[from]));
      for (let i = from + stride; i < to; i += stride) g.lineTo(sx(p.xs[i]), sy(p.zs[i]));
      g.lineTo(sx(p.xs[to]), sy(p.zs[to])); g.stroke();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    // ramps, zoomed in
    if (view.mpp < 14) { g.strokeStyle = hexA(T.dim, 0.35); g.lineWidth = 1; for (const p of game.net.paths) if (!p.main && vis(p)) line(p); }
    // the freeways: a wide glow in the accent, then the line
    const width = view.mpp > 60 ? 1.4 : view.mpp > 20 ? 2 : 3;
    g.strokeStyle = hexA(T.ice, 0.22); g.lineWidth = width * 3.2; for (const p of mains) if (vis(p)) line(p);
    g.strokeStyle = hexA(T.hi, 0.85); g.lineWidth = width; for (const p of mains) if (vis(p)) line(p);
    // the selected freeway in the selection colour
    if (sel) { g.strokeStyle = T.cyan; g.lineWidth = width + 2; for (const p of mains) if (p.label === sel && vis(p)) line(p); }
    // a race course: its stretch of road, bright, with a start and a finish
    const cs = course ? COURSES.find((x) => x.id === course) : null, cp = cs ? mains.find((m) => m.label === cs.road) : null;
    if (cs && cp) {
      const s0 = cp.len * cs.at, s1 = Math.min(cp.len, s0 + cs.length), i0 = Math.floor((s0 / cp.len) * (cp.n - 1)), i1 = Math.floor((s1 / cp.len) * (cp.n - 1));
      g.strokeStyle = T.ember; g.lineWidth = width + 3; line(cp, i0, i1);
      for (const [i, txt] of [[i0, 'Start'], [i1, 'Finish']] as [number, string][]) { g.fillStyle = T.ink; g.beginPath(); g.arc(sx(cp.xs[i]), sy(cp.zs[i]), 5, 0, Math.PI * 2); g.fill(); g.font = '600 11px var(--f-mono, monospace)'; g.fillText(txt, sx(cp.xs[i]) + 8, sy(cp.zs[i]) - 6); }
    }
    // your route while driving: the path you are on and every hand-off still to make
    if (driving) {
      g.strokeStyle = T.ice; g.lineWidth = width + 3; g.globalAlpha = 0.95;
      for (const p of [game.path, ...game.route.map((j) => j.to)]) if (vis(p)) line(p);
      g.globalAlpha = 1;
    }
    // the selected freeway's exits, zoomed in: a dot and the sign's text
    if (sel && view.mpp < 16) {
      const p = mains.find((m) => m.label === sel), pt = { x: 0, y: 0, z: 0, h: 0 };
      if (p) for (const e of exits) { p.at(e.s, 0, pt); const x = sx(pt.x), y = sy(pt.z); if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue; g.fillStyle = T.cyan; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); if (view.mpp < 7) { g.fillStyle = T.dim; g.font = '500 11px system-ui, sans-serif'; g.fillText(e.text, x + 7, y + 4); } }
    }
    // labels never overlap: each takes a box, and a later one that would overlap is left out (shields first, then
    // the places, then the cities from the largest)
    const boxes: [number, number, number, number][] = [];
    const free = (x0: number, y0: number, x1: number, y1: number) => { if (boxes.some(([a, b, c, d]) => x0 < c && x1 > a && y0 < d && y1 > b)) return false; boxes.push([x0, y0, x1, y1]); return true; };
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // route shields: one per route, at the point of it nearest the middle of the view
    const done = new Set<string>();
    for (const p of mains) {
      const key = p.route ?? p.label; if (done.has(key) || !vis(p)) continue;
      let bi = -1, bd = Infinity; for (let i = 0; i < p.n; i += 20) { const d = (p.xs[i] - view.cx) ** 2 + (p.zs[i] - view.cz) ** 2; if (d < bd) { bd = d; bi = i; } }
      if (bi < 0) continue; const X = sx(p.xs[bi]), Y = sy(p.zs[bi]); if (X < 16 || Y < 12 || X > w - 16 || Y > h - 12 || !free(X - 16, Y - 11, X + 16, Y + 11)) continue;
      done.add(key); const inter = p.label.startsWith('I-'), no = routeNo(p.label);
      g.fillStyle = inter ? '#1d4f9c' : '#f4f4ee'; g.beginPath(); g.roundRect(X - 14, Y - 9, 28, 18, inter ? [4, 4, 9, 9] : [9, 9, 4, 4]); g.fill();
      if (inter) { g.fillStyle = '#c8102e'; g.fillRect(X - 12, Y - 8, 24, 4); }
      g.fillStyle = inter ? '#ffffff' : '#111111'; g.font = '700 11px system-ui, sans-serif'; g.fillText(no, X, Y + 1.5);
    }
    // our places: a ring, and the name where it fits
    for (const pl of PLACES) {
      const X = sx(pl.x), Y = sy(pl.z); if (X < 0 || Y < 0 || X > w || Y > h) continue;
      g.strokeStyle = T.cyan; g.lineWidth = 2; g.beginPath(); g.arc(X, Y, 7, 0, Math.PI * 2); g.stroke();
      g.font = '600 12px system-ui, sans-serif'; const tw = g.measureText(pl.name).width;
      if (free(X + 9, Y - 8, X + 13 + tw, Y + 8)) { g.fillStyle = T.ink; g.textAlign = 'left'; g.fillText(pl.name, X + 11, Y); g.textAlign = 'center'; }
    }
    // cities, quiet: the eight largest at any zoom, the rest when zoomed in, none over another label
    g.font = `500 ${view.mpp > 60 ? 10 : 12}px var(--f-mono, monospace)`;
    CITIES.forEach(([name, lat, lon], i) => {
      if (i >= 8 && view.mpp > 45) return;
      const [x, z] = proj(lat, lon), X = sx(x), Y = sy(z), txt = name.toUpperCase().split('').join(' '), tw = g.measureText(txt).width;
      if (X < tw / 2 || Y < 8 || X > w - tw / 2 || Y > h - 8 || !free(X - tw / 2 - 3, Y - 8, X + tw / 2 + 3, Y + 8)) return;
      g.fillStyle = hexA(T.dim, 0.75); g.fillText(txt, X, Y);
    });
    // you: an arrow along your heading
    if (driving) {
      const X = sx(game.phys.x), Y = sy(game.phys.z), a = Math.atan2(Math.cos(game.phys.psi), Math.sin(game.phys.psi));
      g.save(); g.translate(X, Y); g.rotate(a);
      g.fillStyle = hexA(T.ice, 0.3); g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.ink; g.strokeStyle = T.deep; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 0); g.lineTo(-7, 7); g.lineTo(-3, 0); g.lineTo(-7, -7); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }, [view, sel, course, exits, driving, game, mains]);
  // redraw on resize
  useEffect(() => { const r = () => setView((v) => (v ? { ...v } : v)); addEventListener('resize', r); return () => removeEventListener('resize', r); }, []);

  const startable = STARTS.some((s) => s.label === sel);
  return (
    <div className="overlay worldmap" role="dialog" aria-label="World map">
      <div className="wm-canvas" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <canvas ref={cv} role="img" aria-label={`Map of Orange County's freeways${sel ? `, ${sel} selected` : ''}${driving ? ', with your position and route' : ''}`} />
      </div>
      <header className="wm-head">
        <h2>World Map</h2>
        <p className="fine">Freeways: OpenStreetMap contributors via Overture Maps (ODbL)</p>
      </header>
      <div className="wm-zoom" role="group" aria-label="Zoom">
        <button type="button" className="tbtn" aria-label="Zoom in" onClick={() => wrap.current && zoomAt(0.7, wrap.current.clientWidth / 2, wrap.current.clientHeight / 2)}>+</button>
        <button type="button" className="tbtn" aria-label="Zoom out" onClick={() => wrap.current && zoomAt(1.45, wrap.current.clientWidth / 2, wrap.current.clientHeight / 2)}>−</button>
        <button type="button" className="tbtn" onClick={() => { const el = wrap.current; if (!el) return; setView(driving ? { cx: game.phys.x, cz: game.phys.z, mpp: 18 } : fit(all, el.clientWidth, el.clientHeight)); }}>{driving ? 'You' : 'All'}</button>
      </div>
      <aside className="wm-side">
        <div className="seg wm-tabs" role="group" aria-label="Show">
          {(['freeways', 'races', 'places'] as Tab[]).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'freeways' ? 'Freeways' : t === 'races' ? 'Races' : 'Places'}</button>)}
        </div>
        <div className="wm-list">
          {tab === 'freeways' && <>
            {mains.map((m) => (
              <button key={m.label} type="button" className={'wm-item' + (sel === m.label ? ' on' : '')} onClick={() => pickFreeway(m.label)}>
                <span className={'shield ' + (m.label.startsWith('I-') ? 'i' : 'ca')}>{routeNo(m.label)}</span><b>{m.label.split(' ')[1]}</b><small>{(m.len / 1609.344).toFixed(1)} mi</small>
              </button>
            ))}
          </>}
          {tab === 'races' && COURSES.map((c) => (
            <button key={c.id} type="button" className={'wm-item race' + (course === c.id ? ' on' : '')} onClick={() => pickCourse(c.id)}>
              <b>{c.name}</b><small>{c.road} · {(c.length / 1609.344).toFixed(1)} mi · {c.kind}</small>
            </button>
          ))}
          {tab === 'places' && <>
            {PLACES.map((p) => <button key={p.id} type="button" className="wm-item race" onClick={() => { const el = wrap.current; if (el) setView({ cx: p.x, cz: p.z, mpp: 6 }); }}><b>{p.name}</b><small>{p.blurb}</small></button>)}
            <div className="wm-item race off" aria-disabled="true"><b>Houses</b><small>Roadmap</small></div>
            <div className="wm-item race off" aria-disabled="true"><b>Characters</b><small>Roadmap</small></div>
          </>}
        </div>
        <div className="wm-act">
          {tab === 'freeways' && sel && driving && (navTarget === sel
            ? <button type="button" className="btn" onClick={() => onNavigate(null)}>Clear route</button>
            : <button type="button" className="btn primary" onClick={() => onNavigate(sel)}>Navigate to {sel}</button>)}
          {tab === 'freeways' && sel && !driving && startable && <button type="button" className="btn primary" onClick={() => onStartFreeway(sel)}>Start on {sel}</button>}
          {tab === 'freeways' && sel && !driving && exits.length > 0 && (
            <details className="wm-exits"><summary>Start at an exit ({exits.length})</summary>
              {exits.map((e) => <button key={e.key} type="button" className="wm-exit" onClick={() => onStartExit(e.key)}>{e.text}<small>{e.mi.toFixed(1)} mi</small></button>)}
            </details>
          )}
          {tab === 'races' && course && !driving && <button type="button" className="btn primary" onClick={() => onRace(course)}>Race here</button>}
          <button type="button" className="btn" onClick={onClose}>Back</button>
        </div>
      </aside>
    </div>
  );
}
