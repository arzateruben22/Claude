// The main menu's hero (owner's reference, 2026-10-21): your car in a concrete garage at night, the OC sign glowing
// sunset orange on the wall, light strips under the slab, a wet floor that reflects all of it, and Orange County's
// lights behind a row of palms. A small scene of its own that the game's renderer draws in place of the attract drive
// while the main menu is up (Game.frame), so the menu costs one small scene instead of the freeway.
//
// Made in code: every texture is drawn on a canvas at load. The car is the PlayerCar's own model (PlayerCar.showroomModel:
// shared geometry and materials, nothing built twice). The colours are the OC sunset family from src/ui/styles.css
// (--sunset, --amber, --ember); the night is the reference's deep navy black. The city is low-rise sprawl, street
// grids and a freeway's light streams, with hills behind: no invented downtown towers presented as Orange County.
// The wet floor is a Reflector (one extra render of this small scene at half resolution) smeared down the screen in
// its shader, the way light streaks on wet concrete.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { drawOcMark } from '../preview/oc-mark';

const SUNSET = 0xfd9123;                  // --sunset
const SUNSET_DEEP = 0xe5620b;             // --sunset-deep
const CORE = 0xffa040;                    // a strip's hot core: --sunset-text, the hotter twin of --sunset
const AZ = (218 * Math.PI) / 180;          // the camera's bearing round the car: front-left, nose to the left of frame
const EL = (3.2 * Math.PI) / 180;          // and how far it looks down: a low, product-shot eye about a metre up, as the
                                           // reference's, so the horizon crosses the car near its waist and the wet floor
                                           // catches the city at a grazing angle
const DIST = 11;                           // metres from the target; the field of view sets the size
const TARGET = new THREE.Vector3(0, 0.6, 0.15);
const BACKDROP = 95;                       // how far behind the car the city sits
const SKY_TOP = 72, SKY_FOOT = -12;        // the backdrop's top and foot (metres); its horizon sits at the eye's height


const rnd = (() => { let s = 20261021; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// view frame: the camera looks along d (its bearing reversed); r is screen right
const D = new THREE.Vector3(-Math.sin(AZ), 0, -Math.cos(AZ));
const R = new THREE.Vector3(-D.z, 0, D.x);
// a point in the set's frame (metres to the right of the view axis, up, and behind the target)
const at = (r: number, y: number, d: number) => TARGET.clone().setY(y).addScaledVector(R, r).addScaledVector(D, d);

// ------------------------------------------------------------------------------------------- textures
// Board-formed concrete: a mottled grey with formwork seams and tie holes, as in the reference's garage
function concreteTex() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d')!;
  g.fillStyle = '#76716c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 90, a = 0.04 + rnd() * 0.08;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rnd() < 0.5 ? `rgba(30,28,26,${a})` : `rgba(200,195,188,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '20,20,20' : '230,226,220'},${0.03 + rnd() * 0.07})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.strokeStyle = 'rgba(25,23,22,0.55)'; g.lineWidth = 2;
  for (let y = 0; y <= S; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  for (let x = 0; x <= S; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  for (let y = 32; y < S; y += 64) for (let x = 32; x < S; x += 128) {
    g.fillStyle = 'rgba(18,16,15,0.75)'; g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(220,214,206,0.25)'; g.beginPath(); g.arc(x + 0.8, y + 1.2, 3.2, 0, Math.PI); g.fill();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// the floor: red is the concrete's tone, green how wet it is (puddles that hold the reflections)
function floorTex() {
  const S = 512, tone = canvas(S, S), wet = canvas(S, S);
  const a = tone.getContext('2d')!, b = wet.getContext('2d')!;
  a.fillStyle = '#b0b0b0'; a.fillRect(0, 0, S, S);
  for (let i = 0; i < 12000; i++) { const v = Math.floor(120 + rnd() * 120); a.fillStyle = `rgba(${v},${v},${v},0.18)`; a.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1 + rnd() * 3); }
  a.strokeStyle = 'rgba(40,40,40,0.5)'; a.lineWidth = 2;                       // saw-cut joints every 6 m or so
  for (let x = 0; x <= S; x += 256) { a.beginPath(); a.moveTo(x, 0); a.lineTo(x, S); a.stroke(); a.beginPath(); a.moveTo(0, x); a.lineTo(S, x); a.stroke(); }
  b.fillStyle = '#000'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * S, y = rnd() * S, rx = 30 + rnd() * 110, ry = rx * (0.35 + rnd() * 0.5);
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const gr = b.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rx);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      b.save(); b.translate(x + ox, y + oy); b.scale(1, ry / rx); b.translate(-(x + ox), -(y + oy));
      b.fillStyle = gr; b.fillRect(x + ox - rx, y + oy - rx, rx * 2, rx * 2); b.restore();
    }
  }
  const out = canvas(S, S), o = out.getContext('2d')!, img = o.createImageData(S, S);
  const ta = a.getImageData(0, 0, S, S).data, wa = b.getImageData(0, 0, S, S).data;
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = ta[i]; img.data[i + 1] = wa[i]; img.data[i + 2] = 0; img.data[i + 3] = 255; }
  o.putImageData(img, 0, 0);
  const t = tex(out, false); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a soft glow: white at the middle, gone at the edge (tinted by the material; drawn additively)
function glowTex() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d')!;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}
// a light strip's halo: bright along its middle line, falling off across it and at both ends
function barTex() {
  const W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.4, 'rgba(255,255,255,0.35)'); v.addColorStop(0.5, 'rgba(255,255,255,1)'); v.addColorStop(0.6, 'rgba(255,255,255,0.35)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.08, 'rgba(0,0,0,1)'); h.addColorStop(0.92, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, W, H);
  return tex(c);
}

// The wall sign: the OC letterform (traced from the wordmark, src/preview/oc-mark.ts) as sunset neon: the letters the
// wordmark's sky orange (--sunset #fd9123), hottest along their top edge as a tube is, in a deeper orange halo, with
// ULTRA and TOP SPEED set thin and wide under it. Where the reference's sign glows blue-white, ours glows orange: it is
// drawn past the tone map (Showroom.build: signMat), so these are the colours you see, not a filmic amber.
function signTex() {
  const W = 1024, H = 560, c = canvas(W, H), g = c.getContext('2d')!;
  const mx = 140, my = 60, mw = W - 280, mh = 270;
  g.save();
  g.shadowColor = 'rgba(240,98,12,1)';
  for (const blur of [64, 32, 12]) { g.shadowBlur = blur; drawOcMark(g, mx, my, mw, mh, 'rgba(229,98,11,0.5)'); }
  g.restore();
  const core = g.createLinearGradient(0, my, 0, my + mh);
  core.addColorStop(0, '#ffc27a'); core.addColorStop(0.3, '#fd9a2c'); core.addColorStop(0.7, '#fd8a1c'); core.addColorStop(1, '#ec6a10');
  drawOcMark(g, mx, my, mw, mh, core);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const word = (text: string, size: number, y: number, track: number, alpha: number) => {
    g.font = `300 ${size}px "Helvetica Neue", Arial, sans-serif`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${track}px`;
    g.save(); g.shadowColor = 'rgba(240,98,12,0.95)'; g.shadowBlur = 18; g.fillStyle = `rgba(255,178,104,${alpha})`; g.fillText(text, W / 2 + track / 2, y); g.restore();
  };
  word('ULTRA', 74, my + mh + 108, 34, 0.95);
  word('TOP SPEED  ·  ORANGE COUNTY', 30, my + mh + 168, 16, 0.8);
  return tex(c);
}

// The view behind the open side of the garage: a deep navy night with the basin's glow on the horizon, hills with the
// lights of homes on them, the low-rise sprawl in street grids, a freeway's white and red streams, and palms in front.
function backdropTex() {
  const W = 2048, H = Math.round(2048 * (SKY_TOP - SKY_FOOT) / 210), c = canvas(W, H), g = c.getContext('2d')!;
  const yOf = (m: number) => ((SKY_TOP - m) / (SKY_TOP - SKY_FOOT)) * H;     // metres on the backdrop to pixels
  const m2px = H / (SKY_TOP - SKY_FOOT);
  const hz = yOf(TARGET.y + DIST * Math.sin(EL) + 0.35);                       // the eye's height: the horizon
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#02050b'); sky.addColorStop(0.5, '#061020'); sky.addColorStop(0.82, '#0c1a2e'); sky.addColorStop(0.94, '#2a2230'); sky.addColorStop(1, '#5a3420');
  g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);
  for (let i = 0; i < 260; i++) { const y = rnd() * hz * 0.7; g.fillStyle = `rgba(220,228,255,${0.12 + rnd() * 0.35 * (1 - y / hz)})`; g.fillRect(rnd() * W, y, 1.4, 1.4); }
  // the hills: two ridges, the lights of homes scattered up their slopes
  const ridge = (base: number, amp: number, col: string, lights: number) => {
    const pts: number[] = [];
    for (let x = 0; x <= W; x += 16) pts.push(base - amp * (0.55 + 0.45 * Math.sin(x / 260 + amp) * Math.sin(x / 97 + 1.3)) - amp * 0.3 * Math.sin(x / 41));
    g.fillStyle = col; g.beginPath(); g.moveTo(0, hz + 2);
    pts.forEach((y, i) => g.lineTo(i * 16, y)); g.lineTo(W, hz + 2); g.closePath(); g.fill();
    for (let i = 0; i < lights; i++) {
      const x = rnd() * W, top = pts[Math.min(pts.length - 1, Math.round(x / 16))], y = top + rnd() * (hz - top);
      g.fillStyle = rnd() < 0.7 ? `rgba(255,190,110,${0.35 + rnd() * 0.5})` : `rgba(225,232,255,${0.3 + rnd() * 0.4})`;
      g.fillRect(x, y, 1.5, 1.5);
    }
  };
  // the glow of the basin's lights in the air above the horizon, behind the hills
  const glow = g.createLinearGradient(0, hz - 120, 0, hz + 10);
  glow.addColorStop(0, 'rgba(255,140,60,0)'); glow.addColorStop(1, 'rgba(255,140,60,0.16)');
  g.fillStyle = glow; g.fillRect(0, hz - 120, W, 130);
  ridge(hz - 6, 46, '#04070d', 380);
  ridge(hz - 2, 20, '#03050a', 520);
  // the basin, looking down onto it: dark, then thousands of lights thinning toward us
  g.fillStyle = '#04060c'; g.fillRect(0, hz, W, H - hz);
  // low buildings along the horizon (a few storeys, an office block or two), each with lit windows
  for (let i = 0; i < 70; i++) {
    const w = 10 + rnd() * 34, h = 4 + rnd() * (rnd() < 0.12 ? 34 : 14), x = rnd() * W;
    g.fillStyle = '#05070d'; g.fillRect(x, hz - h, w, h);
    for (let wy = hz - h + 3; wy < hz - 1; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < 0.35) {
      g.fillStyle = rnd() < 0.6 ? 'rgba(255,205,140,0.85)' : 'rgba(210,225,255,0.7)'; g.fillRect(wx, wy, 1.6, 1.6);
    }
  }
  const dot = (x: number, y: number, s: number, col: string) => { g.fillStyle = col; g.fillRect(x - s / 2, y - s / 2, s, s); };
  for (let i = 0; i < 7000; i++) {
    const u = Math.pow(rnd(), 2.4), y = hz + 1 + u * (H - hz), s = 0.8 + u * 2.4;
    const k = rnd(), a = 0.35 + rnd() * 0.6;
    dot(rnd() * W, y, s, k < 0.62 ? `rgba(255,170,85,${a})` : k < 0.9 ? `rgba(228,236,255,${a})` : `rgba(255,214,150,${a})`);
  }
  // street grids: rows of lamps converging on the horizon
  for (let i = 0; i < 26; i++) {
    const vx = W * (0.15 + rnd() * 0.7), ex = rnd() * W * 1.6 - W * 0.3, n = 40 + Math.floor(rnd() * 50);
    for (let j = 1; j < n; j++) { const t = Math.pow(j / n, 1.8); dot(vx + (ex - vx) * t, hz + 2 + (H - hz) * t, 1 + t * 2.6, `rgba(255,178,92,${0.55 + 0.4 * rnd()})`); }
  }
  // a freeway: one carriageway's headlights, the other's tail lights
  for (const [x0, x1, col] of [[W * 0.36, W * 0.02, 'rgba(240,244,255,0.9)'], [W * 0.38, W * 0.12, 'rgba(255,50,40,0.85)']] as [number, number, string][]) {
    for (let j = 0; j < 260; j++) { const t = Math.pow(rnd(), 1.5); dot(x0 + (x1 - x0) * t + (rnd() - 0.5) * 3, hz + 3 + (H - hz) * t * 0.9, 1 + t * 2.4, col); }
  }
  // palms in front, black against the sky, with drooping fronds and leaflets
  const palm = (x: number, base: number, h: number, lean: number) => {
    const tx = x + lean, ty = base - h;
    g.strokeStyle = '#010205'; g.lineCap = 'round';
    g.lineWidth = Math.max(3, h * 0.024); g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * 0.2, base - h * 0.6, tx, ty); g.stroke();
    const L = Math.min(h * 0.24, 4.4 * m2px);                              // a crown 8-9 m across, however tall
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + rnd() * 0.3, dx = Math.cos(a), up = Math.sin(a) * 0.35;
      const ex = tx + dx * L, ey = ty + L * (0.45 - up) * (0.6 + 0.4 * Math.abs(dx));
      const cx = tx + dx * L * 0.5, cy = ty - L * (0.25 + up * 0.6);
      g.lineWidth = Math.max(1.4, h * 0.01); g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      g.lineWidth = Math.max(0.8, h * 0.004);
      for (let k = 2; k < 12; k++) {                                       // leaflets hanging off the frond
        const t = k / 12, px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * ey;
        const ll = L * 0.22 * (1 - t * 0.5);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx * ll * 0.3 - ll * 0.25, py + ll); g.moveTo(px, py); g.lineTo(px + dx * ll * 0.3 + ll * 0.25, py + ll); g.stroke();
      }
    }
  };
  const foot = yOf(-4);
  // A row of fan palms along a boulevard in front of the basin (Washingtonia, the tall thin ones Orange County is lined
  // with: 18-30 m), black against the sky's glow, with a lower, further row between them. 95 m off, they rise well
  // over the hills into the sky, as the reference's palms do. [x across the backdrop, height in metres, lean]
  const far: [number, number, number][] = [[0.05, 13, 5], [0.12, 15, -6], [0.21, 12, 4], [0.27, 14, -3], [0.315, 11, 6], [0.36, 13, -5], [0.41, 15, 4], [0.455, 12, -4], [0.5, 14, 5], [0.55, 12, -6], [0.6, 13, 3], [0.68, 15, -4], [0.76, 12, 6], [0.85, 14, -5], [0.93, 13, 4]];
  const near: [number, number, number][] = [[0.02, 24, 7], [0.09, 28, -9], [0.16, 22, 6], [0.235, 27, 10], [0.262, 21, -5], [0.3, 29, -8], [0.338, 24, 7], [0.385, 30, 12], [0.43, 23, -6], [0.462, 27, -11], [0.505, 25, 8], [0.545, 29, -7], [0.59, 22, 5], [0.64, 28, 9], [0.7, 24, -8], [0.78, 27, 6], [0.86, 23, -6], [0.94, 28, 8]];
  for (const [fx, fh, fl] of far) palm(fx * W, foot - 6 * m2px, fh * m2px, fl * 0.6);
  for (const [fx, fh, fl] of near) palm(fx * W, foot, fh * m2px, fl);
  return tex(c);
}

// ------------------------------------------------------------------------------------------- the wet floor
const FLOOR_SHADER = {
  name: 'ShowroomFloor',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tFloor: { value: null }, uBlur: { value: 0.0045 }, uSign: { value: new THREE.Vector2() }, 
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D tFloor;
    uniform float uBlur;
    uniform vec2 uSign;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec3 f = texture2D(tFloor, vWorld.xz * 0.09).rgb;
      float wet = smoothstep(0.25, 0.75, f.g);
      // the reflection, smeared down the screen as light is on wet concrete (more where it's only damp)
      vec3 refl = vec3(0.0); float ws = 0.0;
      float spread = uBlur * mix(1.7, 1.0, wet);
      float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;   // breaks up the taps' steps
      for (int i = -4; i <= 4; i++) {
        float w = 1.0 - abs(float(i)) / 5.0;
        vec4 uv = vUv; uv.y += (float(i) + j) * spread * vUv.w;
        refl += texture2DProj(tDiffuse, uv).rgb * w; ws += w;
      }
      refl /= ws;
      float d = length(vWorld.xz);
      // the concrete itself: a pool of the key light under the car, the sign's orange spill by the wall, night beyond
      vec3 base = color * f.r * (0.0025 + 0.03 * exp(-d * d * 0.07));
      base += vec3(1.0, 0.5, 0.12) * f.r * 0.02 * exp(-dot(vWorld.xz - uSign, vWorld.xz - uSign) * 0.04);
      float k = mix(0.55, 0.92, wet);
      gl_FragColor = vec4(base + refl * k, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  built = false;
  private car: THREE.Object3D | null = null;
  private carSpan = 4.9;                      // the car's width on screen in metres at the target, from its bounds
  private floor: Reflector | null = null;
  private env: THREE.Texture | null = null;
  private t = 0;
  private w = 1; private h = 1; private pr = 1;
  private frame = { cx: 0.5, cy: 0.5, span: 0.6 };

  // the set, the lights and the reflection probe; needs the renderer (the probe and the floor's render target)
  build(renderer: THREE.WebGLRenderer) {
    if (this.built) return;
    this.built = true;
    const s = this.scene;
    s.background = new THREE.Color(0x02050b);
    this.env = this.probe(renderer);
    s.environment = this.env;

    // Light: the same kinds as the freeway's (one directional, one hemisphere, a fog), so the car's materials reuse the
    // shader programs the game has already compiled for it instead of compiling a second set (seconds on a phone,
    // minutes in software rendering). The key comes from above and a little in front; the sky is the night's navy.
    // The sign's orange on the wall is its additive wash, and the sunset lines down the car's flank are the probe's
    // strips in its reflections. The fog starts far beyond the city, so it changes nothing you see.
    s.fog = new THREE.Fog(0x02050b, 900, 1600);
    // the ground's half of the hemisphere is the warm bounce off the wet floor and the sign, so the nose and the sills
    // aren't lost in the dark; the key stands high on the camera's side, so the bonnet and the flank facing you catch it
    s.add(new THREE.HemisphereLight(0x2a3d5c, 0x2a1709, 1.1));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.3);
    key.position.copy(TARGET).addScaledVector(D, -7).add(new THREE.Vector3(0, 7, 0)).addScaledVector(R, -2.5); key.target.position.copy(TARGET); s.add(key, key.target);

    // the floor
    const floor = new Reflector(new THREE.PlaneGeometry(130, 130), { textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0, shader: FLOOR_SHADER, color: 0xffffff });
    floor.rotation.x = -Math.PI / 2;
    const fm = floor.material as THREE.ShaderMaterial;
    fm.uniforms.tFloor.value = floorTex();
    const sp = at(4.6, 0, 7.6);
    fm.uniforms.uSign.value.set(sp.x, sp.z);
    this.floor = floor; s.add(floor);

    const concrete = concreteTex();
    const wallMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0x8c8782, roughness: 0.88 });
    const slabMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0x6e6a66, roughness: 0.9 });
    const yaw = Math.atan2(-D.x, -D.z);       // a plane facing back along the view
    // the wall the sign is on: from the view axis to the right, behind the car
    const wallTex = concrete.clone(); wallTex.repeat.set(3, 1.6); wallTex.needsUpdate = true;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(13, 7.2), new THREE.MeshStandardMaterial({ map: wallTex, color: 0x8c8782, roughness: 0.88 }));
    wall.position.copy(at(7.4, 3.6, 8.2)); wall.rotation.y = yaw; s.add(wall);
    // a return on the wall's left end, so it reads as a solid block
    const ret = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.2, 4), wallMat);
    ret.position.copy(at(1.2, 3.6, 10)); ret.rotation.y = yaw; s.add(ret);
    // the slab overhead, its front edge over the car's rear, and a pillar under its corner
    const slabTex = concrete.clone(); slabTex.repeat.set(4, 3); slabTex.needsUpdate = true;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(15, 0.5, 11), new THREE.MeshStandardMaterial({ map: slabTex, color: 0x6e6a66, roughness: 0.9 }));
    slab.position.copy(at(6, 3.85, 8.4)); slab.rotation.y = yaw; s.add(slab);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.9), slabMat);   // the building's corner
    pillar.position.copy(at(1.2, 1.8, 7.9)); pillar.rotation.y = yaw; s.add(pillar);

    // light strips: a hot core with an additive halo, sunset orange. The lights skip the tone map (toneMapped: false):
    // its filmic curve turns any bright, saturated orange to amber and then cream, and these are meant to be the
    // wordmark's own colours, as the reference's are its blue: the core --sunset-text, the halo --sunset-deep (added onto
    // the core it must not push the green past full, or the line reads gold). The floor sees them through its own tone
    // map, a touch warmer.
    const bar = barTex(), glow = glowTex();
    const coreMat = new THREE.MeshBasicMaterial({ color: CORE, toneMapped: false });
    const haloMat = new THREE.MeshBasicMaterial({ map: bar, color: SUNSET_DEEP, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const strip3 = (len: number, pos: THREE.Vector3, along: 'r' | 'd' | 'y', face: 'down' | 'view', thick = 0.05, halo = 0.7) => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.BoxGeometry(along === 'y' ? thick : len, along === 'y' ? len : thick, thick), coreMat);
      g.add(core);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(len + halo, halo), haloMat);
      if (along === 'y') h.rotation.z = Math.PI / 2;
      if (face === 'down') h.rotation.x = Math.PI / 2;
      h.position.z = face === 'view' ? 0.04 : 0;
      h.position.y = face === 'down' ? -0.03 : 0;
      g.add(h);
      g.position.copy(pos); g.rotation.y = yaw + (along === 'd' ? Math.PI / 2 : 0);
      s.add(g);
    };
    strip3(15, at(6, 3.57, 2.95), 'r', 'view', 0.06, 0.9);                     // the slab's front edge
    for (const r of [2.2, 5.6, 9]) strip3(10, at(r, 3.58, 8.4), 'd', 'down', 0.05, 0.8);   // under the slab
    strip3(11.6, at(7.4, 0.3, 8.12), 'r', 'view', 0.05, 0.36);                  // a cove light along the wall's foot
    strip3(3.0, at(1.2, 1.8, 7.42), 'y', 'view', 0.05, 0.45);                   // down the pillar's face

    // the sign, and the glow it throws on the concrete round it
    const signMat = new THREE.MeshBasicMaterial({ map: signTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const signM = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8 * 560 / 1024), signMat);
    signM.position.copy(at(4.6, 1.75, 8.12)); signM.rotation.y = yaw; s.add(signM);
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ map: glow, color: SUNSET_DEEP, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    wash.position.copy(at(4.6, 1.8, 8.15)); wash.rotation.y = yaw; s.add(wash);

    // the city, far behind
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(210, SKY_TOP - SKY_FOOT), new THREE.MeshBasicMaterial({ map: backdropTex(), fog: false }));
    bd.position.copy(at(-8, (SKY_TOP + SKY_FOOT) / 2, BACKDROP)); bd.rotation.y = yaw; s.add(bd);
    this.resize(this.w, this.h, this.pr);
  }

  // the reflection probe the car's paint and glass see: a dark room, an overhead softbox for the long highlight on the
  // bonnet and roof, sunset strips along the right (the orange lines down the flank), the sign's warm block, and a
  // low, cool band of city light on the left
  private probe(renderer: THREE.WebGLRenderer) {
    const e = new THREE.Scene();
    e.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x05080e, side: THREE.BackSide })));
    const panel = (w: number, h: number, col: THREE.Color, pos: THREE.Vector3, look: THREE.Vector3) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.copy(pos); m.lookAt(look); e.add(m);
    };
    const o = new THREE.Vector3(0, 0.6, 0);
    panel(7, 2.4, new THREE.Color(1, 0.97, 0.92).multiplyScalar(2.2), new THREE.Vector3(0, 7, 0), o);
    panel(16, 0.35, new THREE.Color(SUNSET).multiplyScalar(4), at(5, 3.5, 3), o);
    panel(16, 0.25, new THREE.Color(SUNSET).multiplyScalar(3), at(6, 0.2, 8), o);
    panel(5, 2.6, new THREE.Color(SUNSET).multiplyScalar(1.6), at(4.6, 1.8, 8), o);
    // a broad, soft panel behind the camera: the long highlight down the flank you see
    panel(12, 3, new THREE.Color(1, 0.95, 0.9).multiplyScalar(0.9), TARGET.clone().addScaledVector(D, -16).setY(2.2), o);
    panel(40, 3, new THREE.Color(0x30405e).multiplyScalar(0.8), at(-14, 1.2, 20), o);
    panel(40, 1.2, new THREE.Color(0x6a4a2a).multiplyScalar(0.7), at(-14, 0.4, 20), o);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x0b0b0e }));
    floor.rotation.x = -Math.PI / 2; e.add(floor);
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(e, 0.03).texture;
    pm.dispose();
    e.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    return t;
  }

  // the car to show: replaces the last one (the old copy shares the PlayerCar's geometry, so nothing is disposed here)
  setCar(model: THREE.Object3D | null) {
    if (this.car) this.scene.remove(this.car);
    this.car = model;
    if (!model) return;
    this.scene.add(model);
    // the body's bounds, not the soft contact shadow's plane (a metre and more beyond the car all round)
    const b = new THREE.Box3();
    model.updateMatrixWorld(true);
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.name !== 'contact-shadow') b.expandByObject(m, false); });
    const size = b.getSize(new THREE.Vector3());
    // its silhouette across the screen from this bearing (length and width foreshortened), plus a margin
    this.carSpan = Math.abs(size.z * Math.sin(AZ)) + Math.abs(size.x * Math.cos(AZ)) + 0.5;
  }

  // where the car sits on screen: its centre as fractions of the window, and the share of the width it may take
  setFrame(cx: number, cy: number, span: number) { this.frame = { cx, cy, span }; }

  resize(w: number, h: number, pr: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h); this.pr = pr;
    // the reflection at under half the screen's resolution: it is smeared anyway, and it costs a second render
    if (this.floor) this.floor.getRenderTarget().setSize(Math.max(64, Math.round(this.w * pr * 0.42)), Math.max(64, Math.round(this.h * pr * 0.42)));
  }

  // The camera: a fixed distance on its bearing (drifting a couple of degrees unless motion is reduced), the field of
  // view set so the car takes `span` of the window's width, and the projection's centre moved to (cx, cy) with a view
  // offset, so the car can sit in the space beside the menu's rail without the camera turning.
  private place(cam: THREE.PerspectiveCamera, w: number, h: number, motion: boolean) {
    const az = AZ + (motion ? Math.sin(this.t * 0.09) * 0.05 : 0), el = EL + (motion ? Math.sin(this.t * 0.07) * 0.008 : 0);
    cam.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(DIST).add(TARGET);
    cam.lookAt(TARGET);
    const { cx, cy, span } = this.frame;
    const tanH = (this.carSpan / Math.max(0.15, span)) / 2 / DIST;
    const tanV = tanH / (w / h);
    const px = cx * w, py = cy * h;
    const vw = 2 * Math.max(px, w - px), vh = 2 * Math.max(py, h - py);
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV * (vh / h)));
    cam.aspect = vw / vh;
    cam.setViewOffset(vw, vh, vw / 2 - px, vh / 2 - py, w, h);
    cam.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, dt: number, motion: boolean) {
    if (!this.built) return;
    this.t += motion ? dt : 0;
    this.place(this.camera, this.w, this.h, motion);
    const exp = renderer.toneMappingExposure;
    renderer.toneMappingExposure = 1;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    renderer.toneMappingExposure = exp;
  }

  dispose() {
    this.setCar(null);                         // the car's geometry is the PlayerCar's: it disposes it
    this.floor?.dispose();
    this.env?.dispose();
    this.scene.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  }
}
