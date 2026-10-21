// The Ultra tier's render pipeline (G1): what the Ultra preset adds over Very High, for desktop GPUs. Every other
// preset keeps the plain path in Game.applyQuality, untouched.
//
//   msaaSamples(renderer, want)     the most MSAA samples (up to want) that the half-float colour target and its
//                                   24-bit depth both take on this GPU (8 on most desktops), never more than it reports
//   ultraShadowSize(renderer, want) the sun's shadow map size, clamped to the GPU's texture and renderbuffer limits
//   depthAO(scene, camera, w, h, p) GTAO from the scene's own depth: the composer's render target carries a depth
//                                   texture and the AO reads it (normals rebuilt from depth), so there is no second
//                                   render of the scene with a normal material (which Very High's GTAO does, and which
//                                   draws the see-through glass, the sky box and the cloud dome as solid surfaces).
//                                   It fades in past the cockpit (the dash has its own baked AO) and out with distance,
//                                   where 24-bit depth gets too coarse to trust.
//   bindAO(ao, composer)            each frame: point the AO at the depth of the target the scene renders into
//   carAnisotropy(root, max)        every texture under root at max anisotropy (null: back to what each had), so the
//                                   car's maps (fixed at 8 in src/preview) go to the GPU's maximum; render targets skipped
import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import type { UltraPipeline } from '../settings';

export function msaaSamples(renderer: THREE.WebGLRenderer, want: number): number {
  const max = renderer.capabilities.maxSamples;
  if (!renderer.capabilities.isWebGL2 || want <= 0) return 0;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const list = (fmt: number) => {
    try { return Array.from((gl.getInternalformatParameter(gl.RENDERBUFFER, fmt, gl.SAMPLES) as Int32Array | null) ?? []); } catch { return []; }
  };
  const color = list(gl.RGBA16F), depth = list(gl.DEPTH_COMPONENT24);
  let best = 0;
  for (const s of color) if (s <= want && s <= max && s > best && depth.includes(s)) best = s;
  return best || Math.min(4, want, max);          // the GPU didn't say: High's 4, which every WebGL2 GPU takes
}

export function ultraShadowSize(renderer: THREE.WebGLRenderer, want: number): number {
  const gl = renderer.getContext();
  const lim = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
  let s = want;
  while (s > lim && s > 1024) s /= 2;
  return s;
}

interface AOPrivate { _renderGBuffer: boolean }
export function depthAO(scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, p: UltraPipeline): GTAOPass {
  const ao = new GTAOPass(scene, camera, w, h);
  (ao as unknown as AOPrivate)._renderGBuffer = false;      // no normal pass: the AO reads the main pass's depth
  for (const m of [ao.gtaoMaterial, ao.pdMaterial]) {
    m.defines.NORMAL_VECTOR_TYPE = 0; m.defines.DEPTH_SWIZZLING = 'x';
    m.uniforms.tNormal.value = null; m.uniforms.tDepth.value = null;
    m.needsUpdate = true;
  }
  const g = ao.gtaoMaterial;
  g.uniforms.aoFade = { value: new THREE.Vector4(...p.aoFade) };
  g.fragmentShader = g.fragmentShader
    .replace('uniform float scale;', 'uniform float scale;\n\t\tuniform vec4 aoFade;')
    .replace('ao = pow(ao, scale);', 'ao = pow(ao, scale);\n\t\t\tao = mix(1., ao, smoothstep(aoFade.x, aoFade.y, -viewPos.z) * (1. - smoothstep(aoFade.z, aoFade.w, -viewPos.z)));');
  ao.updateGtaoMaterial({ radius: p.aoRadius, thickness: 1.5, distanceExponent: 1.4, distanceFallOff: 1, scale: 1, samples: 16 });
  ao.blendIntensity = p.aoIntensity;
  return ao;
}

export function bindAO(ao: GTAOPass, composer: EffectComposer) {
  const d = composer.readBuffer.depthTexture;   // where the RenderPass draws this frame
  ao.gtaoMaterial.uniforms.tDepth.value = d; ao.pdMaterial.uniforms.tDepth.value = d;
}

const BASE = new WeakMap<THREE.Texture, number>();
export function carAnisotropy(root: THREE.Object3D, max: number | null): number {
  let n = 0;
  const seen = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mm = (o as THREE.Mesh).material;
    if (!mm) return;
    for (const mat of Array.isArray(mm) ? mm : [mm]) {
      for (const v of Object.values(mat)) {
        const t = v as THREE.Texture | null;
        if (!t || !t.isTexture || t.isRenderTargetTexture || !t.image || seen.has(t)) continue;
        seen.add(t);
        if (!BASE.has(t)) BASE.set(t, t.anisotropy);
        const want = max ?? BASE.get(t)!;
        if (t.anisotropy !== want) { t.anisotropy = want; t.needsUpdate = true; }
        if (max !== null) n++;
      }
    }
  });
  return n;
}
