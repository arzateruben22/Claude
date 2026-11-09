// Mounting an on-foot page (Lot 57, Stoppage Time) into a host: its own standalone page, or the driving game
// (PROJECT_OC_ON_FOOT.md, Phase 3a; PROJECT_OC_SPORTS_BAR.md, J1). Each page's main.ts exports mount(host, options),
// which sets the page's options, hands main() an Embed, and returns { ready, dispose }.
//
//   - Standalone (index.html, sportsbar.html): the markup is already in the document and the options come from the
//     address, as before; nothing is ever disposed.
//   - In the game: the page's own index.html (as text) is put into the host, its <style> into the head, and the game's
//     own stylesheets are switched off while the venue is up (the two share class names such as .panel and .pill;
//     each page keeps its look exactly as on its own). dispose() takes everything off again: the frame loop stops,
//     the listeners the page put on window and document come off, the people, the scene's geometries, materials and
//     textures are released, the renderer is disposed and its context dropped, the hooks go, and the game's
//     stylesheets come back.
import * as THREE from 'three';

export type VenueQuality = 'low' | 'high' | 'ultra';
export interface MountOptions {
  /** the car you drove there (a game car id) and its paint (a hex colour); else the page reads the game's profile */
  car?: string; paint?: number;
  quality?: VenueQuality;
  /** the venue's clock: the device's (live) or a set day (0 Sunday) and hour */
  clock?: { live: true } | { live?: false; day: number; hour: number };
  reducedMotion?: boolean;
  /** show the first-visit hint (default: the page decides) */
  hint?: boolean;
  /** "Drive" at your car's door: the game drives you away (without it the page says it's on its own page for now) */
  onDrive?: () => void;
  /** the page's index.html as text: put into the host (the game). Without it the markup is already in the document. */
  html?: string;
}
export interface Mounted { ready: Promise<void>; dispose(): void }

type Disposable = { dispose(): void } | null | undefined;

/** what main() needs from the host: the hooks to stop, release and drive */
export class Embed {
  dead = false;
  onDrive: (() => void) | null = null;
  paint: number | undefined;
  /** set by main() once everything it builds exists: releases its scene, renderer, people and listeners */
  cleanup: (() => void) | null = null;
  private undo: (() => void)[] = [];

  /** run f (a constructor that puts listeners on window or document), keeping each listener so dispose takes it off */
  track<T>(f: () => T): T {
    const targets: EventTarget[] = [window, document], undo = this.undo;
    const own = targets.map((t) => Object.prototype.hasOwnProperty.call(t, 'addEventListener'));
    const orig = targets.map((t) => t.addEventListener);
    targets.forEach((t, i) => {
      t.addEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
        if (l) undo.push(() => t.removeEventListener(type, l, o));
        return orig[i].call(t, type, l, o);
      } as EventTarget['addEventListener'];
    });
    try { return f(); }
    finally { targets.forEach((t, i) => { if (own[i]) t.addEventListener = orig[i]; else delete (t as { addEventListener?: unknown }).addEventListener; }); }
  }
  /** a listener added by main() itself, taken off on dispose */
  listen(t: EventTarget, type: string, l: EventListener) { t.addEventListener(type, l); this.undo.push(() => t.removeEventListener(type, l)); }

  /**
   * Release what the page built: its own disposables (the people, the parked cars, the composer) first, then every
   * geometry, material and texture still in the scene (which takes the renderer's listeners off the shared ones, the
   * game's palms and car materials among them, so nothing keeps the old renderer alive), then the renderer and its
   * context. The HUD objects' callbacks are blanked, so a stray key on a listener that outlived us reaches nothing.
   */
  release(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, parts: Disposable[] = [], huds: object[] = []) {
    for (const p of parts) { try { p?.dispose(); } catch { /* already gone */ } }
    disposeTree(scene);
    const sc = scene as THREE.Scene;
    for (const t of [sc.environment, sc.background]) if (t && (t as THREE.Texture).isTexture) (t as THREE.Texture).dispose();
    for (const h of huds) for (const k of Object.keys(h)) {
      const r = h as Record<string, unknown>;
      if (/^on[A-Z]/.test(k) && typeof r[k] === 'function') r[k] = () => {};
      if (k === 'paused' || k === 'orderOpen') r[k] = false;
    }
    try { renderer.renderLists.dispose(); } catch { /* fine */ }
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* fine */ }
  }

  /** stop: the loop sees dead, main's cleanup releases, the tracked listeners come off */
  stop() {
    if (this.dead) return;
    this.dead = true;
    try { this.cleanup?.(); } finally {
      this.cleanup = null; this.onDrive = null;
      for (const u of this.undo.splice(0).reverse()) { try { u(); } catch { /* fine */ } }
    }
  }
}

/** dispose every geometry, material and texture under root (each once) */
export function disposeTree(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
  const tex = (v: unknown) => { if (v && (v as THREE.Texture).isTexture) texs.add(v as THREE.Texture); };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    const ms = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mt of ms) mats.add(mt);
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) sk.skeleton.dispose();
    const im = o as THREE.InstancedMesh;
    if (im.isInstancedMesh) { try { im.dispose(); } catch { /* fine */ } }
    const l = o as THREE.Light & { shadow?: THREE.LightShadow };
    if ((l as THREE.Light).isLight && l.shadow?.map) l.shadow.map.dispose();
  });
  for (const mt of mats) {
    for (const v of Object.values(mt)) tex(v);
    const u = (mt as THREE.ShaderMaterial).uniforms;
    if (u) for (const k of Object.keys(u)) { const v = u[k]?.value; if (Array.isArray(v)) v.forEach(tex); else tex(v); }
  }
  for (const g of geos) g.dispose();
  for (const mt of mats) mt.dispose();
  for (const t of texs) t.dispose();
}

/**
 * Mount a page's main(embed) in host. With options.html, the page's markup and styles go into the host and the
 * document's other stylesheets are switched off until dispose. The returned ready resolves once the page reports
 * window.__onfoot.ready (its first frames drawn), or rejects with the page's error.
 */
export function mountPage(host: HTMLElement, o: MountOptions, run: (e: Embed) => Promise<void>): Mounted {
  const e = new Embed();
  e.onDrive = o.onDrive ?? null; e.paint = o.paint;
  let restore: (() => void) | null = null;
  if (o.html) {
    const doc = new DOMParser().parseFromString(o.html, 'text/html');
    const off: (HTMLStyleElement | HTMLLinkElement)[] = [];
    for (const s of Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'))) if (!s.disabled) { s.disabled = true; off.push(s); }
    const style = document.createElement('style'); style.dataset.onfoot = '';
    style.textContent = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
    document.head.appendChild(style);
    for (const n of Array.from(doc.body.childNodes)) {
      if (n.nodeType === 1 && /^(SCRIPT|NOSCRIPT)$/.test((n as Element).tagName)) continue;
      host.appendChild(document.importNode(n, true));
    }
    const bodyClass = document.body.className, title = document.title;
    restore = () => {
      host.replaceChildren(); style.remove();
      for (const s of off) s.disabled = false;
      document.body.className = bodyClass; document.title = title;
    };
  }
  const w = window as Window & { __onfoot?: Record<string, unknown>; __onfootError?: string };
  w.__onfootError = undefined;
  // (the page's own boot keeps its old behaviour: ready is main() itself)
  const ready = !o.html ? run(e) : run(e).then(() => new Promise<void>((res, rej) => {
    const t0 = performance.now();
    const poll = () => {
      if (e.dead) { rej(new Error('disposed while loading')); return; }
      if (w.__onfoot?.ready) { res(); return; }
      if (w.__onfootError) { rej(new Error(w.__onfootError)); return; }
      if (performance.now() - t0 > 600000) { rej(new Error('the venue took over 10 minutes to load')); return; }
      setTimeout(poll, 50);
    };
    poll();
  }));
  return {
    ready,
    dispose() {
      try { e.stop(); } finally {
        delete w.__onfoot;
        restore?.(); restore = null;
      }
    },
  };
}

/** the options as the address a standalone page reads (its own ?quality=, ?day=, ?hour=, ?car=, ?motion=, ?hint=) */
export function optionsToParams(o: MountOptions, base = ''): URLSearchParams {
  const q = new URLSearchParams(base);
  if (o.quality) q.set('quality', o.quality);
  if (o.car) q.set('car', o.car);
  if (o.clock && !o.clock.live) { q.set('day', String(o.clock.day)); q.set('hour', String(o.clock.hour)); }
  else if (o.clock?.live) { q.delete('day'); q.delete('hour'); }
  if (o.reducedMotion !== undefined) q.set('motion', o.reducedMotion ? 'reduced' : 'full');
  if (o.hint !== undefined) q.set('hint', o.hint ? '1' : '0');
  return q;
}
