// Strand cards (hair, brows, lashes): textures drawn once on a canvas, and a material with anisotropic highlights
// (Kajiya-Kay: a primary lobe shifted toward the root and a coloured secondary lobe toward the tip), the strand
// direction taken from the card's v coordinate so it follows skinning and morphs for free.
import * as THREE from 'three';
import { rng } from './math';
import { Quality } from './params';

const texCache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;   // channels are data: r = strand shade, a = coverage
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** hair: strands running along v (root at v=0), tapering and thinning toward the tips. kind 'curl' waves them */
export function hairTexture(kind: 'straight' | 'wavy' | 'curl' = 'straight') {
  return canvasTex('hair2-' + kind, 256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(kind.length * 977);
    // a clump: strands bunched toward the middle, with gaps between them and ragged, thinning tips
    const n = kind === 'curl' ? 70 : 95;
    for (let i = 0; i < n; i++) {
      const x0 = w * (0.5 + (r.next() - 0.5) * (0.35 + 0.6 * r.next())), shade = 0.45 + 0.55 * r.next(), wd = 0.6 + r.next() * 1.1;
      const end = h * (0.45 + 0.55 * r.next());
      const amp = kind === 'curl' ? 7 + r.next() * 9 : kind === 'wavy' ? 2 + r.next() * 4 : r.next() * 1.2;
      const fr = kind === 'curl' ? 0.045 + r.next() * 0.03 : 0.012 + r.next() * 0.01, ph = r.next() * 6.28;
      const drift = (r.next() - 0.5) * 18;
      g.beginPath();
      for (let y = 0; y <= end; y += 4) {
        const x = x0 + Math.sin(y * fr + ph) * amp + (y / h) * drift;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      const v = Math.round(shade * 255), a0 = 0.75 + 0.25 * r.next();
      const grad = g.createLinearGradient(0, 0, 0, end);
      grad.addColorStop(0, `rgba(${v},${v},${v},${a0})`); grad.addColorStop(0.7, `rgba(${v},${v},${v},${a0 * 0.85})`); grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.strokeStyle = grad; g.lineWidth = wd; g.stroke();
    }
  });
}

/** lashes: dense tapered hairs along v, a little fanned */
export function lashTexture() {
  return canvasTex('lash', 256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(4242);
    for (let i = 0; i < 46; i++) {
      const x0 = (i + 0.5) / 46 * w + (r.next() - 0.5) * 5, len = h * (0.45 + 0.55 * r.next()), lean = (r.next() - 0.5) * 14;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.8)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grad; g.lineWidth = 1.1 + r.next() * 0.7;
      g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + lean * 0.3, len * 0.5, x0 + lean, len); g.stroke();
    }
  });
}

/** brows: short hairs; at the medial end (u=0) they point up, along the rest they lie toward the tail (u=1) */
export function browTexture() {
  return canvasTex('brow', 512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(777);
    for (let i = 0; i < 1100; i++) {
      const u = r.next(), x = u * w, y = h * (0.1 + 0.8 * r.next());
      const edge = Math.min(1, Math.min(y, h - y) / (h * 0.25));
      const ang = u < 0.18 ? -Math.PI / 2 + (r.next() - 0.5) * 0.4 : -0.35 - (1 - u) * 0.35 + (r.next() - 0.5) * 0.3 + (y / h - 0.5) * 0.4;
      const L = (10 + r.next() * 14) * (u < 0.18 ? 0.8 : 1);
      g.strokeStyle = `rgba(255,255,255,${(0.35 + 0.5 * r.next()) * edge})`; g.lineWidth = 0.8 + r.next() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L * 0.7); g.stroke();
    }
  });
}

export function hairLights(strength = 1) {
  return THREE.ShaderChunk.lights_physical_pars_fragment
    .replace('void RE_Direct_Physical(', 'vec3 gHairT = vec3(0.0, 1.0, 0.0); vec3 gHairSpec = vec3(1.0); float gHairShift = 0.0;\nvoid RE_Direct_Physical(')
    .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', /* glsl */ `
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	{
	  vec3 Hh = normalize( directLight.direction + geometryViewDir );
	  vec3 T1 = normalize( gHairT + geometryNormal * ( 0.12 + gHairShift ) );
	  vec3 T2 = normalize( gHairT - geometryNormal * 0.08 );
	  float th1 = dot( T1, Hh ), th2 = dot( T2, Hh );
	  float s1 = pow( sqrt( max( 0.0, 1.0 - th1 * th1 ) ), 90.0 );
	  float s2 = pow( sqrt( max( 0.0, 1.0 - th2 * th2 ) ), 22.0 );
	  float wrap = saturate( dot( geometryNormal, directLight.direction ) * 0.5 + 0.5 );
	  reflectedLight.directSpecular += directLight.color * wrap * ( s1 * ${(0.09 * strength).toFixed(3)} * gHairSpec + s2 * ${(0.12 * strength).toFixed(3)} * material.diffuseColor );
	}`);
}

export interface CardMaterial extends THREE.MeshStandardMaterial { uniformsRef: Record<string, THREE.IUniform> }

/** strand-card material; `grey` mixes grey strands in by a per-strand hash */
export function cardMaterial(color: number, tex: THREE.Texture, quality: Quality, o: { grey?: number; greyColor?: number; alphaTest?: number; kk?: boolean; shift?: number } = {}): CardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, alphaTest: o.alphaTest ?? 0.42, transparent: false }) as CardMaterial;
  m.map = tex;
  const u: Record<string, THREE.IUniform> = {
    uCol: { value: new THREE.Color(color) }, uGrey: { value: o.grey ?? 0 }, uGreyCol: { value: new THREE.Color(o.greyColor ?? 0xbdb9b2) }, uShift: { value: o.shift ?? 0 },
  };
  m.uniformsRef = u;
  m.alphaToCoverage = quality === 'high';
  const kk = o.kk ?? true;
  m.customProgramCacheKey = () => `card-${quality}-${kk ? 1 : 0}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCol; uniform float uGrey; uniform vec3 uGreyCol; uniform float uShift;')
      .replace('#include <lights_physical_pars_fragment>', kk ? hairLights() : THREE.ShaderChunk.lights_physical_pars_fragment)
      .replace('#include <map_fragment>', /* glsl */ `
vec4 st = texture2D( map, vMapUv );
float hsh = fract(sin(floor(vMapUv.x * 220.0) * 12.9898) * 43758.5453);
vec3 hc = pow(uCol, vec3(1.0)) * (0.55 + 0.6 * st.r);
hc = mix(hc, uGreyCol * (0.7 + 0.4 * st.r), step(1.0 - uGrey, hsh));
// darker toward the roots
hc *= 0.7 + 0.3 * smoothstep(0.0, 0.35, vMapUv.y);
diffuseColor.rgb = hc;
diffuseColor.a = st.a;`)
      .replace('#include <lights_fragment_begin>', !kk ? '#include <lights_fragment_begin>' : /* glsl */ `
{
  vec3 dpx = dFdx( -vViewPosition ), dpy = dFdy( -vViewPosition );
  vec2 dux = dFdx( vMapUv ), duy = dFdy( vMapUv );
  vec3 t = dpx * duy.y - dpy * dux.y;
  gHairT = normalize( t - normal * dot( t, normal ) + 1e-6 );
  gHairSpec = mix( vec3(1.0, 0.95, 0.9), diffuseColor.rgb * 3.0, 0.25 );
  gHairShift = uShift;
}
#include <lights_fragment_begin>`);
  };
  return m;
}
