// The garage cars' geometry and material settings as hashes, to show a change left a car untouched (the hypercar's
// G1 graphics pass: the other four must hash identical to the base commit's). Built with tools/preview-shoot.mjs:
//   node tools/preview-shoot.mjs tools/car-hash.ts tests/out/hyper-gfx/hash/x.png --size=320x200
// prints one console line per car, build (full car, shell, cockpit) and quality: '[hash] {...}'. Every mesh's
// position, normal, uv and index arrays and its placement are hashed, and every material's settings (its JSON
// without uuids, plus each texture's size and settings).
import * as THREE from 'three';
import { buildCar } from '../src/preview/car';
import { buildCockpit } from '../src/preview/cockpit';
import { CAR_IDS } from '../src/preview/car-shape';

declare global { interface Window { __previewReady?: boolean; __previewError?: string } }

function fnv(h: number, data: ArrayLike<number>) {
  const f = new Float32Array(1), u = new Uint32Array(f.buffer);
  for (let i = 0; i < data.length; i++) { f[0] = data[i]; h = Math.imul(h ^ u[0], 16777619) >>> 0; }
  return h;
}
function str(h: number, s: string) { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
function matKey(m: THREE.Material) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (k === 'uuid' || k === 'id' || k === 'version' || k.startsWith('_') || typeof v === 'function') continue;
    if (v && (v as THREE.Texture).isTexture) { const t = v as THREE.Texture; const img = t.image as { width?: number; height?: number } | undefined; o[k] = ['tex', img?.width, img?.height, t.repeat.x, t.repeat.y, t.offset.x, t.offset.y, t.wrapS, t.anisotropy, t.colorSpace, t.minFilter]; continue; }
    if (v && (v as THREE.Color).isColor) { o[k] = (v as THREE.Color).getHexString(); continue; }
    if (v && (v as THREE.Vector2).isVector2) { o[k] = [(v as THREE.Vector2).x, (v as THREE.Vector2).y]; continue; }
    if (typeof v === 'object' && v !== null && k !== 'userData') continue;
    o[k] = v;
  }
  const ud = (m.userData as { uniforms?: Record<string, { value: unknown }> }).uniforms;
  if (ud) o.uniforms = JSON.stringify(Object.fromEntries(Object.entries(ud).map(([k, u]) => [k, u.value])));
  return JSON.stringify(o);
}
function hashObj(root: THREE.Object3D) {
  let g = 2166136261, m = 2166136261, n = 0, tris = 0;
  root.updateMatrixWorld(true);
  root.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (!mesh.isMesh) return;
    n++;
    g = str(g, mesh.name); g = fnv(g, mesh.matrixWorld.elements);
    const geo = mesh.geometry;
    for (const a of ['position', 'normal', 'uv']) { const at = geo.attributes[a] as THREE.BufferAttribute | undefined; if (at) g = fnv(g, at.array as ArrayLike<number>); }
    if (geo.index) { g = fnv(g, geo.index.array as ArrayLike<number>); tris += geo.index.count / 3; } else tris += (geo.attributes.position?.count ?? 0) / 3;
    for (const mm of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m = str(m, matKey(mm));
  });
  return { meshes: n, tris: Math.round(tris), geo: g.toString(16), mat: m.toString(16) };
}
try {
  const only = new URLSearchParams(location.search).get('cars')?.split(',');
  for (const car of CAR_IDS) {
    if (only && !only.includes(car)) continue;
    for (const quality of ['high', 'phone'] as const) {
      const full = hashObj(buildCar({ car, quality }));
      const shell = hashObj(buildCar({ car, quality, cabin: 'shell', wheels: false }));
      const ck = hashObj(buildCockpit({ car, quality, body: false }).group);
      console.warn('[hash] ' + JSON.stringify({ car, quality, full, shell, cockpit: ck }));
    }
  }
  window.__previewReady = true;
} catch (e) { window.__previewError = String((e as Error).stack ?? e); }
