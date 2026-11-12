// The character picker's live turntable (src/ui/CastPicker.tsx): the selected character, built by the people builder
// from the cast catalog (src/onfoot/cast.ts), turning slowly on a small stage of its own. Loaded only when the picker
// opens (a dynamic import, so the game's boot doesn't carry the builder), and released when it closes.
// Phone-cheap: the patio-distance body (LOD 1, one draw call) shows at once; the close-up body (LOD 0, the builder's
// phone quality) replaces it a moment later. One renderer, one person at a time; the previous one is disposed.
import * as THREE from 'three';
import { buildPerson, Person } from '../onfoot/people';
import { castPerson, CastId, CAST_IDS, CAST, CAST_PACK } from '../onfoot/cast';
import { packUnlocked, packOwned, packTestOffered, packOffer } from '../game/castPack';
import { saleState, skuById, forSale } from '../store/catalog';

export interface Stage { show(id: CastId): void; dispose(): void; readonly state: { id: string | null; lod: number; tris: number; ms: number } }

export function castStage(canvas: HTMLCanvasElement, quality: 'phone' | 'high' = 'phone'): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x3a3640, 1.1));
  const key = new THREE.DirectionalLight(0xfff2e4, 2.1); key.position.set(1.5, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.0); rim.position.set(-2.5, 2, -2.5); scene.add(rim);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }));
  disc.rotation.x = -Math.PI / 2; scene.add(disc);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 30);
  const turn = new THREE.Group(); scene.add(turn);
  const state = { id: null as string | null, lod: -1, tris: 0, ms: 0 };
  let person: Person | null = null, raf = 0, last = performance.now(), upgrade = 0, dead = false;
  // reduced motion: the character stands still, three-quarter on, instead of turning
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const size = () => {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const frame = (t: number) => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!still) turn.rotation.y += dt * 0.5;
    person?.update(dt);
    renderer.render(scene, camera);
  };
  const show = (id: CastId) => {
    if (state.id === id) return;
    clearTimeout(upgrade);
    if (person) { turn.remove(person.group); person.dispose(); person = null; }
    const t0 = performance.now();
    const p = buildPerson({ ...castPerson(id), quality, lod: 1 });
    p.play('idle');
    turn.add(p.group); person = p;
    turn.rotation.y = 0.45;            // a new pick starts facing you, three-quarter on
    const h = p.options.body.height;
    camera.position.set(0, h * 0.62, h * 2.35); camera.lookAt(0, h * 0.52, 0);
    Object.assign(state, { id, lod: 1, tris: p.stats().tris, ms: Math.round(performance.now() - t0) });
    // the close-up body a moment later (it takes a few seconds on a phone: the patio body stays up meanwhile)
    upgrade = window.setTimeout(() => {
      if (dead || person !== p) return;
      const t1 = performance.now();
      p.setLod(0);
      Object.assign(state, { lod: 0, tris: p.stats().tris, ms: Math.round(performance.now() - t1) });
    }, 400);
  };
  size();
  addEventListener('resize', size);
  raf = requestAnimationFrame(frame);
  return {
    show, state,
    dispose() {
      dead = true; cancelAnimationFrame(raf); clearTimeout(upgrade); removeEventListener('resize', size);
      if (person) person.dispose();
      disc.geometry.dispose(); (disc.material as THREE.Material).dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* fine */ }
    },
  };
}

/** the regression check's budget run (tests/regression.mjs, group 'cast'): each of the six built at the far, patio and
 *  close-up levels in the builder's phone quality, with its triangles, draw calls and build time at each */
export function castBudget(levels: (0 | 1 | 2)[] = [2, 1, 0], pack = false) {
  // (pack: the two pack characters instead of the six)
  return (pack ? CAST_PACK.identities.map((c) => c.id) : CAST_IDS).map((id) => {
    const t0 = performance.now();
    const p = buildPerson({ ...castPerson(id), quality: 'phone', lod: levels[0] });
    const rows: Record<string, { tris: number; calls: number; ms: number }> = {};
    rows[levels[0]] = { ...pick(p.stats()), ms: Math.round(performance.now() - t0) };
    for (const l of levels.slice(1)) { const t1 = performance.now(); p.setLod(l); rows[l] = { ...pick(p.stats()), ms: Math.round(performance.now() - t1) }; }
    p.dispose();
    return { id, height: p.options.body.height, ...rows };
  });
}
const pick = (s: { tris: number; calls: number }) => ({ tris: s.tris, calls: s.calls });
/** the catalog as the checks see it: each character's id, unlock category, skin and arms; the future pack's scaffold */
/** (the pack: its identities, its store entry, and its lock as the saved settings `s` see it) */
export const castInfo = (s: { packTest?: boolean } = {}) => ({ packIds: CAST_PACK.identities.map((c) => ({ id: c.id, ref: c.ref, unlock: c.unlock, presentation: c.presentation, skin: c.look.skin, arms: c.arms, height: c.body.height })), lock: { unlocked: packUnlocked(s), owned: packOwned(), testOffered: packTestOffered(), offer: packOffer(), price_cents: skuById(CAST_PACK.sku)?.price_cents ?? null }, cast: CAST.map((c) => ({ id: c.id, ref: c.ref, unlock: c.unlock, presentation: c.presentation, skin: c.look.skin, arms: c.arms, height: c.body.height })), pack: { ...CAST_PACK, identities: CAST_PACK.identities.map((c) => c.id), inCatalog: !!skuById(CAST_PACK.sku), onSale: saleState(skuById(CAST_PACK.sku)!).ok, listed: forSale().some((s) => s.sku === CAST_PACK.sku) } });
