// Building people's patio-distance bodies (the people builder's LOD 1) off the page's main thread
// (PROJECT_OC_ON_FOOT.md, "Building people is slow ... the game must build them over several frames or in a worker").
// The page builds each person's far body (LOD 2) and skeleton itself at load; a worker runs the same builder
// (src/onfoot/people, through its exports only) on the same options, so the rig and its bone order come out the same,
// and sends back the LOD 1 mesh's buffers. The page binds them to the person it already has (lot57/crowdview.ts).
// The worker is the page's own bundled script started a second time (main.ts): with no document there, it serves
// builds instead of building the page, so no code ships twice. Nothing here touches the DOM (LOD 1 has no hair cards).
import { buildPerson } from '../people';
import type { PersonOptions } from '../people';
import type * as THREE from 'three';

export interface BuildJob { job: number; gen: number; id: number; opts: PersonOptions; lod: 1 | 2 }
export interface BuiltAttr { name: string; array: Float32Array | Uint16Array | Uint32Array; size: number }
export interface BuildDone { job: number; gen: number; id: number; lod: 1 | 2; ms: number; attrs: BuiltAttr[]; index: Uint16Array | Uint32Array | null; error?: string }

const post = (msg: BuildDone, transfer: ArrayBuffer[]) => (self as unknown as { postMessage(m: unknown, t: ArrayBuffer[]): void }).postMessage(msg, transfer);

/** in a worker: answer build jobs */
export function serveBuilds() {
  self.onmessage = (e: MessageEvent<BuildJob>) => build(e.data);
}
function build(data: BuildJob) {
  const { job, gen, id, opts, lod } = data;
  const t0 = performance.now();
  try {
    const p = buildPerson({ ...opts, lod });
    let mesh: THREE.SkinnedMesh | null = null;
    p.group.traverse((o) => { if (o.name === 'lod' + lod && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh; });
    if (!mesh) throw new Error('no lod' + lod + ' mesh');
    const g = (mesh as THREE.SkinnedMesh).geometry;
    const attrs: BuiltAttr[] = [], transfer: ArrayBuffer[] = [];
    for (const [name, a] of Object.entries(g.attributes)) {
      // (the rest positions are only for the close-up skin's shader; the coarse material doesn't read them)
      if (name === 'aRest') continue;
      const arr = (a as THREE.BufferAttribute).array as Float32Array | Uint16Array | Uint32Array;
      const copy = arr.slice();
      attrs.push({ name, array: copy, size: (a as THREE.BufferAttribute).itemSize });
      transfer.push(copy.buffer as ArrayBuffer);
    }
    const index = g.index ? ((g.index.array as Uint16Array | Uint32Array).slice()) : null;
    if (index) transfer.push(index.buffer as ArrayBuffer);
    p.dispose();
    post({ job, gen, id, lod, ms: Math.round(performance.now() - t0), attrs, index }, transfer);
  } catch (err) {
    post({ job, gen, id, lod, ms: Math.round(performance.now() - t0), attrs: [], index: null, error: String((err as Error)?.message ?? err) }, []);
  }
}
