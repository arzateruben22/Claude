// Detail by mode inside one batch, at no extra draw call (Vega & Vinnie's repair, 2026-11-23: Low's venue group had
// grown to 41 calls and 44k triangles against its 40 and 45k). A batch family (the steel, the plants, the paint, the
// patio's wood, the lamps, the neon) can carry a coarse part drawn only at Low and a fine part drawn only at HD and
// Ultra beside its shared part. When the page finishes the kit, each such batch is rebuilt as coarse | shared | fine,
// and the mesh's draw range picks [coarse + shared] at Low and [shared + fine] at HD and Ultra: one mesh, one call,
// one bake, whichever mode. Shadow maps, the AO pass and breakdown() all read the same draw range.
import type * as THREE from 'three';
import { Batch, Kit } from '../../engine/geom';

type Part = 'coarse' | 'fine';
const parts = new WeakMap<Batch, { coarse: Batch | null; fine: Batch | null }>();

/** the coarse (Low only) or fine (HD and Ultra only) part of a kit batch: a batch of its own, the same UV scale and
 *  baked occlusion, merged into the kit batch by finishLod */
export function lodPart(b: Batch, part: Part): Batch {
  let p = parts.get(b);
  if (!p) { p = { coarse: null, fine: null }; parts.set(b, p); }
  let o = p[part];
  if (!o) { o = new Batch(b.uvScale); o.ao = b.ao; p[part] = o; }
  return o;
}
/** both parts of a batch at once: lod(b) → [low, high] */
export const lod = (b: Batch): [Batch, Batch] => [lodPart(b, 'coarse'), lodPart(b, 'fine')];

export interface LodRange { lowStart: number; lowCount: number; hiStart: number; hiCount: number }
/** before kit.finish: every batch with parts rebuilt as coarse | shared | fine; returns each entry's ranges (vertices) */
export function finishLod(kit: Kit): Map<string, LodRange> {
  const out = new Map<string, LodRange>();
  for (const e of kit.entries) {
    const p = parts.get(e.batch); if (!p) continue;
    const c = p.coarse?.vertices ?? 0, s = e.batch.vertices, f = p.fine?.vertices ?? 0;
    const nb = new Batch(e.batch.uvScale); nb.ao = e.batch.ao;
    if (p.coarse) nb.add(p.coarse);
    nb.add(e.batch);
    if (p.fine) nb.add(p.fine);
    parts.delete(e.batch);
    e.batch = nb;
    out.set(e.name, { lowStart: 0, lowCount: c + s, hiStart: c, hiCount: s + f });
  }
  return out;
}
/** after kit.finish and on every change of mode: each split mesh's draw range for the mode */
export function applyLod(meshes: THREE.Mesh[], ranges: Map<string, LodRange>, low: boolean) {
  for (const m of meshes) {
    const r = ranges.get(m.name); if (!r) continue;
    if (low) m.geometry.setDrawRange(r.lowStart, r.lowCount); else m.geometry.setDrawRange(r.hiStart, r.hiCount);
  }
}
