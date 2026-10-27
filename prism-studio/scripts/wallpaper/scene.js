// Prism Studio wallpaper: a code-rendered, deterministic Gotham-dark Manhattan at 2 a.m.
//
// Original procedural art (no photographs). Everything below is a pure function of the
// composition (landscape or portrait) and the fixed city seed, so re-rendering gives the
// same picture. Driven headless by render.mjs through window.renderWallpaper().
//
// World units are metres. +x is east (right), +y is up, -z is north (the camera looks north
// up the island). The picture is drawn in tiles at `ss`x resolution into an HDR target,
// box-downsampled into a full-resolution HDR image, then bloomed, graded and dithered.

import * as THREE from 'three';

// ---------------------------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashInts(...v) {
  let h = 2166136261 >>> 0;
  for (const x of v) { h ^= (x | 0) + 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; }
  return h >>> 0;
}
const CITY_SEED = 20261026;

// ---------------------------------------------------------------------------------------------
// The world (shared by both compositions)
// ---------------------------------------------------------------------------------------------
const W = {
  ave: 270, aveW: 30, aveOff: 135,      // avenues run north-south (along z)
  st: 80, stW: 18, stOff: 40,           // streets run east-west (along x)
  riverZ: -4350, riverHalf: 560,        // the river crossing the far end of the island
  park: [-520, 260, -3420, -2480],      // xmin, xmax, zmin, zmax: the dark park in the middle distance
  cloudY: 560,                          // the low cloud deck
  scudY: 455,                           // a thin, broken layer just under it
  fogA: 0.00052, fogB: 1 / 330,         // exponential height haze
  hero: { x: 262, z: -1150 },           // the spire tower
};
const BRIDGE_X = -2050;                 // in the left third, where the wall leaves a gap between monitors
const riverZ = (x) => W.riverZ + 0.16 * x + 110 * Math.sin(x / 1300 + 0.7);

// Two compositions. Landmarks are placed in camera terms (ndcX = horizontal screen position,
// fwd = distance ahead) so each frame keeps towers rising at both edges.
const COMPOSITIONS = {
  landscape: {
    cam: [0, 255, 160], pitch: -4.2, vfov: 50,
    calm: [0.5, 0.52, 0.30, 0.26],      // centre (uv) + radii of the quiet zone behind the monitor rig
    beam: { src: { ndcX: -0.60, fwd: 1700, y: 128 }, hit: { ndcX: -0.43, ndcY: 0.70 }, gain: 1.0 },
    landmarks: [
      { ndcX: -1.10, fwd: 235, w: 66, d: 58, h: 430, style: 'deco', flood: 0, occ: 0.30, spire: false },
      { ndcX: -0.90, fwd: 480, w: 44, d: 44, h: 335, style: 'gothic', flood: 0.55, occ: 0.24 },
      { ndcX: -0.76, fwd: 880, w: 36, d: 36, h: 240, style: 'gothic', flood: 0.4, occ: 0.2 },
      { ndcX: 1.12, fwd: 265, w: 72, d: 60, h: 470, style: 'deco', flood: 0, occ: 0.28, spire: false },
      { ndcX: 0.92, fwd: 540, w: 48, d: 46, h: 360, style: 'deco', flood: 0.5, occ: 0.24, spire: true },
      { ndcX: 0.70, fwd: 980, w: 38, d: 38, h: 265, style: 'gothic', flood: 0.4, occ: 0.2 },
      { ndcX: -0.20, fwd: 1200, w: 50, d: 50, h: 400, style: 'crown', flood: 1.0, occ: 0.2 },   // in the open sky between the inner-left and top monitors
    ],
  },
  portrait: {
    cam: [178, 268, 210], pitch: -8.5, vfov: 72,
    calm: [0.5, 0.55, 0.36, 0.22],
    beam: { src: { ndcX: -0.40, fwd: 1250, y: 128 }, hit: { ndcX: -0.56, ndcY: 0.55 }, gain: 0.62 },
    landmarks: [
      { ndcX: -1.18, fwd: 175, w: 52, d: 50, h: 440, style: 'deco', flood: 0, occ: 0.30, spire: false },
      { ndcX: -0.92, fwd: 430, w: 40, d: 40, h: 330, style: 'gothic', flood: 0.55, occ: 0.24 },
      { ndcX: 1.16, fwd: 205, w: 56, d: 52, h: 460, style: 'deco', flood: 0, occ: 0.28, spire: false },
      { ndcX: 0.92, fwd: 520, w: 42, d: 42, h: 335, style: 'deco', flood: 0.5, occ: 0.24, spire: true },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// GLSL shared by every surface: hashing, noise, haze
// ---------------------------------------------------------------------------------------------
const COMMON = /* glsl */ `
precision highp float;
precision highp int;
uniform float uFogA, uFogB;
uniform vec3 uHazeLow, uHazeHigh;
uniform float uPixAng;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint uix(float x){ return uint(int(floor(x)) + 8388608); }
float hash3(vec3 p){ uint h = pcg(uix(p.x)); h = pcg(h ^ uix(p.y)); h = pcg(h ^ uix(p.z)); return float(h) * (1.0/4294967296.0); }
float hash2(vec2 p, float s){ return hash3(vec3(p, s)); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = hash2(i, 0.0), b = hash2(i+vec2(1,0), 0.0), c = hash2(i+vec2(0,1), 0.0), d = hash2(i+vec2(1,1), 0.0);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
// fbm that fades octaves smaller than ~2 px (fp = footprint of p per pixel)
float fbmAA(vec2 p, float fp, int oct){
  float s = 0.0, a = 0.5, f = 1.0, nrm = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float k = 1.0 - smoothstep(0.2, 0.6, fp * f);
    s += a * mix(0.5, vnoise(p), k); nrm += a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(7.13, 3.71); f *= 2.0; a *= 0.5;
  }
  return s / nrm;
}

// Distance to the nearest feature point (cellular noise), for stratocumulus cells
float worley(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(x, y);
    vec2 o = vec2(hash2(i + g, 21.0), hash2(i + g, 22.0));
    vec2 r = g + o - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}

// The haze is lit by the city from below: warm smoky grey near the horizon, steel above.
vec3 hazeCol(vec3 rd){
  float t = smoothstep(-0.02, 0.30, rd.y);
  vec3 c = mix(uHazeLow, uHazeHigh, t);
  float down = smoothstep(-0.005, -0.28, rd.y);
  c = mix(c, vec3(0.0085, 0.0105, 0.0145), down * 0.85);  // looking down into the streets: dark steel
  c += uHazeLow * 0.50 * exp(-abs(rd.y - 0.006) * 52.0);   // the glow band on the horizon
  return c;
}
float fogAmt(vec3 p){
  vec3 d = p - cameraPosition; float dist = length(d); vec3 rd = d / max(dist, 1e-3);
  float ry = rd.y; if (abs(ry) < 1e-3) ry = (ry < 0.0) ? -1e-3 : 1e-3;
  float f = uFogA / uFogB * exp(-cameraPosition.y * uFogB) * (1.0 - exp(-dist * ry * uFogB)) / ry;
  return 1.0 - exp(-max(f, 0.0));
}
vec3 applyFog(vec3 col, vec3 p){
  return mix(col, hazeCol(normalize(p - cameraPosition)), fogAmt(p));
}
// A small light on the ground, prefiltered: never thinner than ~0.7 px across or along the
// view, energy kept, so distant lamps stay points instead of shimmering.
float plight(vec2 dd, float r0, vec2 along, float fpA, float fpC){
  float a = dot(dd, along), c = dot(dd, vec2(-along.y, along.x));
  float ra = max(r0, fpA * 0.7), rc = max(r0, fpC * 0.7);
  return (r0 * r0) / (ra * rc) * exp(-(a*a)/(ra*ra) - (c*c)/(rc*rc));
}
`;

// ---------------------------------------------------------------------------------------------
// Buildings: instanced boxes, pyramids and cylinders. Windows come from the fragment shader.
// aInfo = (seed, occupancy, kind, flood)   kind 0 = floors with windows, 1 = crown, 2 = roof plant
// aWin  = (bay width, floor height, window width fraction, window height fraction)
// aTone = (warm share, stone tone, lit-floor share, building base y)
// ---------------------------------------------------------------------------------------------
const BUILDING_VS = /* glsl */ `
attribute vec4 aInfo; attribute vec4 aWin; attribute vec4 aTone;
varying vec3 vWorld; varying vec3 vN;
flat varying vec3 vMin; flat varying vec3 vSize;
flat varying vec4 vInfo; flat varying vec4 vWin; flat varying vec4 vTone;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(instanceMatrix) * normal);
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vSize = sc; vMin = instanceMatrix[3].xyz - sc * 0.5;
  vInfo = aInfo; vWin = aWin; vTone = aTone;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BUILDING_FS = COMMON + /* glsl */ `
varying vec3 vWorld; varying vec3 vN;
flat varying vec3 vMin; flat varying vec3 vSize;
flat varying vec4 vInfo; flat varying vec4 vWin; flat varying vec4 vTone;
uniform float uWinGain, uFloodGain, uStreetGain;

float aaBand(float x, float a, float b, float w){
  w = max(w, 1e-4);
  return clamp((x - a) / w + 0.5, 0.0, 1.0) * clamp((b - x) / w + 0.5, 0.0, 1.0);
}

void main(){
  vec3 n = normalize(vN);
  vec3 p = vWorld;
  vec3 V = normalize(cameraPosition - p);
  float seed = vInfo.x, occ = vInfo.y, kind = vInfo.z, flood = vInfo.w;
  vec3 stoneCol = mix(vec3(0.020, 0.024, 0.031), vec3(0.040, 0.042, 0.046), vTone.y);
  if (kind > 1.5) stoneCol *= 0.6;

  // Light that reaches a facade at 2 a.m.: the glowing cloud above, the city around,
  // the street below (warm, fading within a few storeys).
  vec3 skyAmb = vec3(0.34, 0.33, 0.33);
  vec3 sideAmb = vec3(0.22, 0.24, 0.27);
  vec3 amb = mix(sideAmb, skyAmb, pow(clamp(n.y, 0.0, 1.0), 2.0));
  vec3 street = vec3(1.0, 0.58, 0.30) * uStreetGain * exp(-max(p.y, 0.0) / 14.0);
  // facades turned towards the bright core of the city get a little more glow
  float face = n.z > 0.5 ? 1.0 : (n.x > 0.5 ? 0.62 : (n.x < -0.5 ? 0.80 : 0.55));
  amb *= mix(1.0, face, step(abs(n.y), 0.5));
  vec3 col = stoneCol * (amb + street);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += hazeCol(reflect(-V, n)) * rim * 0.22;

  // Floodlit crowns: lamps on each ledge wash the stone upward, fading with height.
  if (flood > 0.0){
    float t = clamp((p.y - vMin.y) / max(vSize.y, 1.0), 0.0, 1.0);
    float fl = 0.22 + 0.78 * pow(1.0 - t, 1.5);
    float side = 1.0 - 0.75 * abs(n.y);
    // slight vertical fluting so the wash reads as stone, not paint
    float flute = 1.0;
    if (abs(n.y) < 0.5){
      float u = abs(n.x) > 0.5 ? p.z : p.x;
      flute = 0.82 + 0.18 * smoothstep(0.2, 0.8, abs(fract(u / 1.6) - 0.5) * 2.0);
    }
    col += vec3(0.90, 0.66, 0.38) * flood * uFloodGain * fl * side * flute;
  }

  if (kind < 0.5 && abs(n.y) < 0.5){
    bool xF = abs(n.x) > 0.5;
    float faceW = xF ? vSize.z : vSize.x;
    float u = xF ? (p.z - vMin.z) : (p.x - vMin.x);
    float faceId = xF ? (n.x > 0.0 ? 0.0 : 1.0) : (n.z > 0.0 ? 2.0 : 3.0);
    float nb = max(1.0, floor(faceW / vWin.x + 0.5));
    vec2 c = vec2(u / faceW * nb, (p.y - vTone.w) / vWin.y);
    vec2 fw = fwidth(c);
    vec2 f = fract(c);
    vec2 id = floor(c);
    float px = max(fw.x, fw.y);
    float hx = vWin.z * 0.5, hy = vWin.w * 0.5;
    float mask = aaBand(f.x, 0.5 - hx, 0.5 + hx, fw.x) * aaBand(f.y, 0.56 - hy, 0.56 + hy, fw.y);
    float area = vWin.z * vWin.w;
    mask = mix(mask, area, smoothstep(0.3, 0.9, px));
    // only whole floors get windows (no half window under a ledge)
    float floorTop = vTone.w + (id.y + 1.0) * vWin.y;
    mask *= step(floorTop, vMin.y + vSize.y + 0.01);

    // Which windows are lit at 2 a.m.: most floors dark, a few with scattered lamps,
    // the rare office floor fully on.
    float fh = hash3(vec3(seed, id.y, 17.0));
    // windows come in small groups (one flat, one office) that are lit together
    float unitW = 2.0 + floor(hash3(vec3(seed, 5.0, faceId)) * 3.0);
    float unit = floor(id.x / unitW);
    float wh = hash3(vec3(seed + faceId * 7919.0, id.y, unit));
    wh = mix(wh, 1.0, step(0.78, hash3(vec3(seed + 11.0, id.y + faceId * 977.0, id.x))));
    float floorOn = step(fh, vTone.z);
    float lit = floorOn * step(wh, occ) + (1.0 - floorOn) * step(wh, occ * 0.07);
    if (fh > 0.993) lit = step(wh, 0.85);
    float ch = hash3(vec3(id.x + faceId * 101.0, id.y, seed + 3.0));
    vec3 sodium = vec3(1.0, 0.56, 0.26);
    vec3 lamp = vec3(1.0, 0.78, 0.56);
    vec3 pale = vec3(0.78, 0.83, 0.88);
    vec3 wc = ch < vTone.x ? sodium : (ch < vTone.x + (1.0 - vTone.x) * 0.55 ? lamp : pale);
    float inten = mix(0.22, 1.0, pow(hash3(vec3(id.y + 5.0, id.x, seed + faceId)), 1.6));
    // drawn blinds: some lit windows glow only in their lower part
    float bl = hash3(vec3(id.x, id.y + 9.0, seed + faceId * 3.0));
    if (bl < 0.35 && px < 0.6){
      float cut = 0.56 - hy + vWin.w * (0.35 + bl);
      inten *= 0.25 + 0.75 * (1.0 - smoothstep(cut - fw.y, cut + fw.y, f.y));
    }
    vec3 em = wc * inten * lit * uWinGain;
    float litE = vTone.z * occ + (1.0 - vTone.z) * occ * 0.07;
    vec3 emE = mix(lamp, sodium, vTone.x) * 0.55 * litE * uWinGain;
    em = mix(em, emE, smoothstep(1.6, 4.0, px));
    float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
    vec3 glass = vec3(0.0035, 0.0045, 0.0065) + hazeCol(reflect(-V, n)) * (0.10 + 0.55 * fres);
    // stone piers between the window bays and a spandrel line under each floor: they read at 1x on
    // the near blocks and fade out once a bay is smaller than a couple of pixels
    float detail = 1.0 - smoothstep(0.25, 0.7, px);
    float pier = aaBand(f.x, -0.08, 0.08, fw.x) + aaBand(f.x, 0.92, 1.08, fw.x);
    float span = aaBand(f.y, 0.0, 0.07, fw.y);
    col += stoneCol * (amb + street) * (0.55 * pier + 0.35 * span) * detail * (1.0 - mask);
    col = mix(col, glass, mask) + em * mask;
  }
  if (abs(n.y) < 0.5){
    // the cornice: the top course of every block catches a little warm light from the street and the roof lamps
    float topD = vMin.y + vSize.y - p.y;
    float fy = fwidth(p.y);
    float corn = 1.0 - smoothstep(0.35, 0.35 + fy * 1.5 + 0.35, topD);
    col += vec3(0.90, 0.64, 0.40) * 0.020 * corn * (kind > 1.5 ? 0.6 : 1.0);
  }
  if (n.y > 0.5){
    // tar and gravel roofs: per-building tone, a little grain, a parapet that catches the glow
    float rt = 0.55 + 0.45 * hash3(vec3(seed, 3.0, 9.0));
    float fpx = length(fwidth(p.xz));
    float grain = 0.85 + 0.3 * fbmAA(p.xz / 3.5, fpx / 3.5, 3);
    vec2 e2 = min(p.xz - vMin.xz, vMin.xz + vSize.xz - p.xz);
    float edge = min(e2.x, e2.y);
    float parapet = 1.0 - smoothstep(0.6, 0.6 + fpx * 1.5 + 0.3, edge);
    col = stoneCol * skyAmb * (0.62 * rt * grain + 0.55 * parapet) + vec3(0.90, 0.64, 0.40) * 0.012 * parapet;
    if (flood > 0.0) col += vec3(0.9, 0.66, 0.38) * flood * uFloodGain * 0.08;
  }
  gl_FragColor = vec4(applyFog(col, p), 1.0);
}`;

// ---------------------------------------------------------------------------------------------
// Ground: the street grid (wet, dull amber), the park, the river and the far shore
// ---------------------------------------------------------------------------------------------
const GROUND_VS = /* glsl */ `
varying vec3 vWorld;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

const GROUND_FS = COMMON + /* glsl */ `
varying vec3 vWorld;
uniform float uRiverZ, uRiverHalf;
uniform vec4 uPark;
uniform float uAve, uAveOff, uAveW, uSt, uStOff, uStW;
uniform float uLampGain;

float riverZ(float x){ return uRiverZ + 0.16 * x + 110.0 * sin(x / 1300.0 + 0.7); }
const vec3 SODIUM = vec3(1.0, 0.56, 0.25);
const vec3 WHITE = vec3(0.86, 0.87, 0.85);

vec3 streets(vec2 q, vec3 rd, vec2 along, float fpA, float fpC, float fp){
  float ai = floor((q.x - uAveOff) / uAve + 0.5);
  float aC = ai * uAve + uAveOff;
  float da = abs(q.x - aC);
  float si = floor((q.y - uStOff) / uSt + 0.5);
  float sC = si * uSt + uStOff;
  float ds = abs(q.y - sC);
  float onA = 1.0 - smoothstep(uAveW * 0.5 - fp, uAveW * 0.5 + fp, da);
  float onS = 1.0 - smoothstep(uStW * 0.5 - fp, uStW * 0.5 + fp, ds);
  float road = max(onA, onS);
  vec3 col = mix(vec3(0.0040, 0.0043, 0.0048), vec3(0.0065, 0.0068, 0.0074), road);
  // wet asphalt: the glowing haze mirrored at grazing angles
  float fres = 0.03 + 0.97 * pow(1.0 - abs(rd.y), 5.0);
  col += road * hazeCol(reflect(rd, vec3(0.0, 1.0, 0.0))) * fres * 0.5;

  float pool = 0.0, refl = 0.0;
  // avenue lamps on both kerbs every 30 m
  float lz = floor(q.y / 30.0 + 0.5) * 30.0;
  for (int s = -1; s <= 1; s += 2){
    vec2 L = vec2(aC + float(s) * (uAveW * 0.5 - 1.5), lz);
    vec2 dd = q - L;
    pool += exp(-dot(dd, dd) / 70.0);
    float a = dot(dd, along), c = dot(dd, vec2(-along.y, along.x));
    refl += exp(-(c*c) / (1.2 + fpC*fpC) - (a*a) / (a < 0.0 ? 260.0 : 12.0));
  }
  // street lamps every 34 m
  float lx = floor(q.x / 34.0 + 0.5) * 34.0;
  for (int s = -1; s <= 1; s += 2){
    vec2 L = vec2(lx, sC + float(s) * (uStW * 0.5 - 1.2));
    vec2 dd = q - L;
    pool += 0.8 * exp(-dot(dd, dd) / 55.0);
  }
  col += SODIUM * uLampGain * (pool * 0.030 * road + refl * 0.06 * onA);

  return col;
}

vec3 park(vec2 q){ return vec3(0.0026, 0.0031, 0.0030); }

vec3 farShore(vec2 q, float fpA){
  vec3 col = vec3(0.0030, 0.0033, 0.0036);
  float dev = smoothstep(0.32, 0.68, fbmAA(q / 2300.0 + 5.0, fpA / 2300.0, 4));
  return col + SODIUM * 0.0016 * dev * uLampGain;   // the lamps themselves are point sprites
}

vec3 river(vec2 q, vec3 rd, float dr, float dist){
  vec3 col = vec3(0.0022, 0.0029, 0.0040);
  // ripples break the mirror
  vec2 w = vec2(fbmAA(q / vec2(140.0, 22.0), 0.0, 3), fbmAA(q / vec2(140.0, 22.0) + 9.0, 0.0, 3)) - 0.5;
  vec3 nn = normalize(vec3(w.x * 0.10, 1.0, w.y * 0.22));
  vec3 rr = reflect(rd, nn);
  float fres = 0.02 + 0.98 * pow(1.0 - max(-rd.y, 0.0), 5.0);
  col += hazeCol(rr) * fres * 0.30;
  // long broken reflections of the far-shore lights, running towards the viewer
  float s = (q.x - cameraPosition.x) / max(cameraPosition.z - q.y, 1.0);
  float col_id = floor(s * 1400.0);
  float has = step(hash3(vec3(col_id, 3.0, 7.0)), 0.22);
  float fromFar = clamp((-dr + uRiverHalf) / (2.0 * uRiverHalf), 0.0, 1.0); // 1 at the far bank
  float brk = smoothstep(0.45, 0.75, vnoise(vec2(col_id * 0.73, q.y / 7.0)));
  float colPos = fract(s * 1400.0);
  float core = 1.0 - smoothstep(0.15, 0.5, abs(colPos - 0.5));
  vec3 lc = hash3(vec3(col_id, 4.0, 7.0)) < 0.7 ? SODIUM : WHITE;
  col += lc * has * brk * core * pow(fromFar, 1.6) * 0.16 * uLampGain;
  return col;
}

void main(){
  vec3 p = vWorld;
  vec2 q = p.xz;
  vec3 d = p - cameraPosition; float dist = length(d); vec3 rd = d / dist;
  vec2 along = normalize(q - cameraPosition.xz);
  float fpC = dist * uPixAng;                       // metres per pixel across the view
  float fpA = fpC / max(-rd.y, 0.012);              // metres per pixel along the view
  float fp = min(fpA, 60.0);
  float zr = riverZ(q.x);
  float dr = q.y - zr;                              // > 0 on the island side
  vec3 col;
  if (dr > uRiverHalf) {
    bool inPark = q.x > uPark.x && q.x < uPark.y && q.y > uPark.z && q.y < uPark.w;
    col = inPark ? park(q) : streets(q, rd, along, fpA, fpC, fp);
  } else if (dr < -uRiverHalf) {
    col = farShore(q, fpA);
  } else {
    col = river(q, rd, dr, dist);
  }
  gl_FragColor = vec4(applyFog(col, p), 1.0);
}`;

// ---------------------------------------------------------------------------------------------
// Low cloud deck lit from below by the city, and a thin broken layer beneath it
// ---------------------------------------------------------------------------------------------
const CLOUD_FS = COMMON + /* glsl */ `
varying vec3 vWorld;
uniform vec3 uBeamHit;
uniform float uSpotGain;
uniform float uRiverZ;
uniform float uCloudGain;
float riverZ(float x){ return uRiverZ + 0.16 * x + 110.0 * sin(x / 1300.0 + 0.7); }
void main(){
  vec3 p = vWorld; vec3 d = p - cameraPosition; float dist = length(d); vec3 rd = d / dist;
  vec2 q = p.xz;
  float fpC = dist * uPixAng; float fpA = fpC / max(abs(rd.y), 0.01);
  float fp = sqrt(fpC * fpA);
  vec2 wq = q / 3000.0;
  vec2 warp = vec2(fbmAA(wq + 3.1, fp / 3000.0, 4), fbmAA(wq + 7.7, fp / 3000.0, 4)) - 0.5;
  float n = fbmAA(q / 1500.0 + warp * 2.0, fp / 1500.0, 6);
  float bil = 1.0 - abs(2.0 * fbmAA(q / 620.0 + warp * 3.0 + 4.0, fp / 620.0, 5) - 1.0);
  // stratocumulus: rounded cells with dark seams, broken up by the larger fbm
  vec2 cq = q / 520.0 + warp * 1.4;
  float cellAA = 1.0 - smoothstep(0.25, 0.7, fp / 520.0);
  float cells = mix(0.55, 1.0 - worley(cq), cellAA);
  float cells2 = mix(0.55, 1.0 - worley(cq * 2.3 + 5.0), 1.0 - smoothstep(0.25, 0.7, fp * 2.3 / 520.0));
  float dens = smoothstep(0.30, 0.72, n * 0.55 + cells * 0.38 + cells2 * 0.14 + bil * 0.10 - 0.08);
  float det = fbmAA(q / 210.0 + warp * 4.0, fp / 210.0, 5);
  // lit from below: brightest over the dense city and towards the horizon, darkest overhead
  float overCity = smoothstep(riverZ(q.x) - 900.0, riverZ(q.x) + 1600.0, q.y);
  float glow = mix(0.45, 1.0, overCity) * (0.55 + 0.6 * det) * mix(0.30, 1.0, smoothstep(700.0, 4800.0, dist));
  vec3 lit = mix(vec3(0.046, 0.050, 0.058), vec3(0.100, 0.081, 0.066), smoothstep(1200.0, 5200.0, dist)) * glow;
  vec3 gap = vec3(0.005, 0.0065, 0.010);
  vec3 col = mix(gap, lit, dens * 0.9 + 0.1 * det * dens);
  // the searchlight's soft spot where it enters the cloud
  float sd = length(q - uBeamHit.xz);
  col += vec3(0.60, 0.64, 0.68) * (0.055 * exp(-sd*sd / (150.0*150.0)) + 0.016 * exp(-sd / 420.0)) * (0.45 + 0.55 * dens) * uSpotGain;
  col *= uCloudGain;
  col = mix(col, hazeCol(rd), 1.0 - exp(-dist / 6500.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const SCUD_FS = COMMON + /* glsl */ `
varying vec3 vWorld;
void main(){
  vec3 p = vWorld; vec3 d = p - cameraPosition; float dist = length(d); vec3 rd = d / dist;
  vec2 q = p.xz;
  float fpC = dist * uPixAng; float fp = fpC / max(abs(rd.y), 0.01);
  float n = fbmAA(q / vec2(900.0, 520.0) + 11.0, fp / 520.0, 6);
  float a = smoothstep(0.55, 0.80, n) * 0.55;
  a *= smoothstep(300.0, 900.0, dist) * exp(-dist / 7000.0);
  vec3 col = mix(vec3(0.075, 0.063, 0.054), hazeCol(rd), 0.5);
  gl_FragColor = vec4(col * a, a);
}`;

const SKY_FS = COMMON + /* glsl */ `
varying vec3 vWorld;
void main(){ vec3 rd = normalize(vWorld - cameraPosition); gl_FragColor = vec4(hazeCol(rd), 1.0); }`;

// ---------------------------------------------------------------------------------------------
// Lamps as point sprites: never smaller than ~1 px, dimmer with distance, fogged
// ---------------------------------------------------------------------------------------------
const LIGHT_VS = COMMON + /* glsl */ `
attribute vec3 aCol; attribute float aR;
uniform float uPxPerRad, uMinPx, uGain;
varying vec3 vC;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float dist = length(wp.xyz - cameraPosition);
  float px = aR * 2.0 * uPxPerRad / dist;
  float size = max(px, uMinPx);
  float e = sqrt(px / size);
  vC = aCol * uGain * e * (1.0 - fogAmt(wp.xyz));
  gl_PointSize = size * 2.5;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const LIGHT_FS = /* glsl */ `
varying vec3 vC;
void main(){ vec2 d = gl_PointCoord - 0.5; gl_FragColor = vec4(vC * exp(-50.0 * dot(d, d)), 1.0); }`;

// ---------------------------------------------------------------------------------------------
// The searchlight: a plain soft beam (an open cone drawn additively)
// ---------------------------------------------------------------------------------------------
const BEAM_VS = /* glsl */ `
uniform float uLen;
varying vec3 vWorld; varying vec3 vNw; varying float vT; varying float vAng;
void main(){
  vT = position.y / uLen;
  vAng = atan(position.z, position.x);
  vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BEAM_FS = COMMON + /* glsl */ `
varying vec3 vWorld; varying vec3 vNw; varying float vT; varying float vAng;
uniform float uBeamGain;
void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = abs(dot(normalize(vNw), V));
  float core = pow(ndv, 2.2);
  float along = smoothstep(0.0, 0.05, vT) * (1.0 - 0.6 * vT) * (1.0 - smoothstep(0.86, 1.0, vT));
  float dens = 0.45 + 0.55 * exp(-vWorld.y / 260.0);
  float trans = 1.0 - fogAmt(vWorld);
  float streak = 0.8 + 0.2 * vnoise(vec2(vAng * 3.0, vT * 30.0));
  vec3 c = vec3(0.68, 0.71, 0.74) * uBeamGain * core * along * dens * streak * (0.3 + 0.7 * trans);
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------------------------
// Post: tile blit, bloom chain, final grade
// ---------------------------------------------------------------------------------------------
const POST_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COPY_FS = /* glsl */ `
uniform sampler2D tSrc; varying vec2 vUv;
void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`;
const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; uniform float uPre; varying vec2 vUv;
void main(){
  vec3 c = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
                 + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
  if (uPre > 0.5){
    float br = max(c.r, max(c.g, c.b));
    float knee = uThresh * 0.6;
    float soft = clamp(br - uThresh + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-5);
    c *= max(soft, br - uThresh) / max(br, 1e-5);
  }
  gl_FragColor = vec4(c, 1.0);
}`;
const BLUR_FS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const FINAL_FS = /* glsl */ `
precision highp float;
uniform sampler2D tHdr, tB0, tB1, tB2, tB3, tB4;
uniform float uExposure, uBloom, uSat, uCalmAmt;
uniform vec4 uCalm;
uniform vec2 uRes;
varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float enc(float c){ return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture2D(tHdr, vUv).rgb;
  vec3 b = texture2D(tB0, vUv).rgb * 0.34 + texture2D(tB1, vUv).rgb * 0.26 + texture2D(tB2, vUv).rgb * 0.18
         + texture2D(tB3, vUv).rgb * 0.13 + texture2D(tB4, vUv).rgb * 0.09;
  c += b * uBloom;
  // the quiet zone behind the monitor rig, and a soft vignette
  vec2 dc = (vUv - uCalm.xy) / uCalm.zw;
  c *= 1.0 - uCalmAmt * exp(-dot(dc, dc));
  vec2 v = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) / max(uRes.x / uRes.y, 1.0);
  c *= 1.0 - 0.38 * smoothstep(0.30, 0.78, length(v));
  c *= uExposure;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = aces(c);
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // steel in the shadows, a little warmth kept in the highlights
  c *= mix(vec3(0.90, 0.97, 1.10), vec3(1.0), smoothstep(0.0, 0.18, L));
  c += vec3(0.0012, 0.0015, 0.0021) * (1.0 - smoothstep(0.0, 0.1, L));
  vec3 o = vec3(enc(c.r), enc(c.g), enc(c.b));
  float d = h12(gl_FragCoord.xy) + h12(gl_FragCoord.xy + 71.7) - 1.0;
  o += d / 255.0;
  gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
}`;

// ---------------------------------------------------------------------------------------------
// The city
// ---------------------------------------------------------------------------------------------
class Builder {
  constructor() { this.boxes = []; this.cones = []; this.cyls = []; }
  box(cx, y0, cz, w, h, d, info, win, tone) { this.boxes.push({ cx, cy: y0 + h / 2, cz, w, h, d, info, win, tone }); }
  cone(cx, y0, cz, w, h, d, info, tone) { this.cones.push({ cx, cy: y0 + h / 2, cz, w, h, d, info, win: [2, 4, 0, 0], tone }); }
  cyl(cx, y0, cz, w, h, d, info, tone) { this.cyls.push({ cx, cy: y0 + h / 2, cz, w, h, d, info, win: [2, 4, 0, 0], tone }); }
}

function tower(B, cx, cz, w, d, H, style, r, o = {}) {
  const seed = Math.floor(r() * 60000);
  const win = style === 'slab'
    ? [2.9 + r() * 0.7, 3.8 + r() * 0.4, 0.62 + r() * 0.2, 0.55 + r() * 0.15]
    : [1.6 + r() * 0.9, 3.7 + r() * 0.5, 0.42 + r() * 0.22, 0.52 + r() * 0.16];
  let occ = (0.10 + 0.30 * r()) * (o.occMul ?? 1);
  if (o.occ != null) occ = o.occ;
  if (o.occ == null && r() < 0.14) occ *= 0.15;            // a dark building
  const floorP = 0.16 + 0.34 * r();
  const tone = [0.38 + 0.42 * r(), r(), floorP, 0];
  const flood = o.flood ?? ((H > 165 && r() < (style === 'gothic' ? 0.40 : 0.26)) ? 0.30 + 0.35 * r() : 0);
  const I = (kind, fl) => [seed, occ, kind, fl];
  let nT = H > 230 ? 3 + (r() < 0.5 ? 1 : 0) : H > 130 ? 2 + (r() < 0.5 ? 1 : 0) : H > 80 ? 1 + (r() < 0.6 ? 1 : 0) : 1;
  if (style === 'slab') nT = Math.min(nT, 2);
  let y = 0, tw = w, td = d;
  for (let t = 0; t < nT; t++) {
    const rem = H - y;
    const th = t === nT - 1 ? rem : rem * (t === 0 ? 0.52 + 0.18 * r() : 0.5 + 0.2 * r());
    B.box(cx, y, cz, tw, th, td, I(0, 0), win, tone);
    y += th;
    if (t < nT - 1) {
      const s = 0.70 + 0.14 * r();
      const nw = tw * s, nd = td * (r() < 0.6 ? s : 0.70 + 0.14 * r());
      if (H > 150 && (style === 'gothic' || (style === 'deco' && r() < 0.3))) {
        const pw = Math.max(1.2, tw * 0.07), ph = pw * (4 + 3 * r());
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          B.cone(cx + sx * (tw / 2 - pw / 2), y, cz + sz * (td / 2 - pw / 2), pw, ph, pw, I(1, flood * 0.6), tone);
        }
      }
      tw = nw; td = nd;
    }
  }
  if (style === 'deco') {
    const steps = 2 + Math.floor(r() * 3);
    let cw = tw * 0.84, cd = td * 0.84;
    for (let s = 0; s < steps; s++) {
      const ch = 3 + r() * 5 + H / 90;
      B.box(cx, y, cz, cw, ch, cd, I(1, flood), win, tone);
      y += ch; cw *= 0.74; cd *= 0.74;
    }
    if (o.spire ?? ((H > 150 && r() < 0.35) || H > 260)) {
      const sh = H * (0.08 + 0.10 * r());
      B.cone(cx, y, cz, Math.max(1.6, cw * 0.8), sh, Math.max(1.6, cd * 0.8), I(1, flood * 0.8), tone);
    }
  } else if (style === 'gothic') {
    if (Math.min(tw, td) > 30) {
      // a broad gothic top: two stepped stages before the pyramid
      for (let s2 = 0; s2 < 2; s2++) { const ch = 4 + r() * 4; B.box(cx, y, cz, tw * 0.8, ch, td * 0.8, I(1, flood), win, tone); y += ch; tw *= 0.62; td *= 0.62; }
    }
    const rh = Math.min(Math.min(tw, td) * (1.15 + 0.75 * r()), Math.max(10, H * 0.28));
    B.cone(cx, y, cz, tw * 0.94, rh, td * 0.94, I(1, flood), tone);
    const pw = Math.max(1.2, tw * 0.09), ph = rh * (0.5 + 0.2 * r());
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.cone(cx + sx * (tw / 2 - pw / 2), y, cz + sz * (td / 2 - pw / 2), pw, ph, pw, I(1, flood), tone);
    }
    if (H > 170 && r() < 0.45) B.cone(cx, y + rh * 0.85, cz, 1.6, H * 0.09, 1.6, I(1, flood * 0.7), tone);
  } else {
    B.box(cx + (r() - 0.5) * tw * 0.2, y, cz, tw * (0.35 + 0.25 * r()), 4 + r() * 4, td * (0.3 + 0.2 * r()), I(2, 0), win, tone);
  }
}

function lowBuilding(B, cx, cz, w, d, H, r, occMul, waterTowers) {
  const seed = Math.floor(r() * 60000);
  const win = [2.2 + r() * 1.4, 3.3 + r() * 0.4, 0.44 + r() * 0.2, 0.5 + r() * 0.16];
  let occ = (0.08 + 0.30 * r()) * occMul;
  if (r() < 0.18) occ *= 0.2;
  const tone = [0.45 + 0.4 * r(), r() * 0.8, 0.2 + 0.4 * r(), 0];
  const I = (kind) => [seed, occ, kind, 0];
  B.box(cx, 0, cz, w, H, d, I(0), win, tone);
  if (r() < 0.55) B.box(cx + (r() - 0.5) * w * 0.4, H, cz + (r() - 0.5) * d * 0.4, 4 + r() * 5, 3 + r() * 2, 4 + r() * 4, I(2), win, tone);
  const units = Math.floor(r() * 3.2);
  for (let k = 0; k < units; k++) {
    const uw = 1.6 + r() * 3.5, ud = 1.6 + r() * 3.5;
    B.box(cx + (r() - 0.5) * (w - uw - 2), H, cz + (r() - 0.5) * (d - ud - 2), uw, 1.2 + r() * 2.2, ud, I(2), win, tone);
  }
  if (waterTowers && r() < 0.22 && w > 14 && d > 14) {
    const tx = cx + (r() - 0.5) * (w - 10), tz = cz + (r() - 0.5) * (d - 10);
    const dia = 5 + r() * 2.5, th = 5 + r() * 2;
    B.box(tx, H, tz, dia * 0.8, 2.6, dia * 0.8, I(2), win, tone);
    B.cyl(tx, H + 2.6, tz, dia, th, dia, I(2), tone);
    B.cone(tx, H + 2.6 + th, tz, dia * 1.02, dia * 0.42, dia * 1.02, I(2), tone);
  }
}

function crownTower(B, cx, cz, w, d, H, r, o) {
  // A Chrysler-style top: a plain shaft, setbacks with corner eagles, then a crown of diminishing lit
  // arches (stacked floodlit pyramids, each one's peak inside the next one's base: the sunburst
  // triangles) and a long needle.
  const seed = Math.floor(r() * 60000), occ = o.occ ?? 0.2;
  const win = [1.6, 3.8, 0.42, 0.6];
  const tone = [0.55, 0.85, 0.28, 0];
  const I = (kind, fl) => [seed, occ, kind, fl];
  const shaft = H * 0.72;
  B.box(cx, 0, cz, w * 1.2, H * 0.18, d * 1.2, I(0, 0), win, tone);
  B.box(cx, H * 0.18, cz, w * 1.08, H * 0.2, d * 1.08, I(0, 0), win, tone);
  B.box(cx, H * 0.38, cz, w, shaft - H * 0.38, d, I(0, 0.1), win, tone);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cone(cx + sx * w * 0.46, shaft, cz + sz * d * 0.46, 2.4, 6, 2.4, I(1, 0.7), tone);
  let y = shaft, cw = w * 0.86, cd = d * 0.86;
  for (let k = 0; k < 5; k++) {
    const ch = cw * 0.95;
    B.box(cx, y, cz, cw, ch * 0.28, cd, I(1, o.flood ?? 1), win, tone);
    B.cone(cx, y + ch * 0.28, cz, cw * 1.02, ch * 0.62, cd * 1.02, I(1, o.flood ?? 1), tone);
    y += ch * 0.5; cw *= 0.78; cd *= 0.78;
  }
  B.cone(cx, y, cz, Math.max(1.4, cw * 0.7), H * 0.2, Math.max(1.4, cd * 0.7), I(1, 0.6), tone);
}

function heroTower(B, cx, cz) {
  // The spire tower: limestone setbacks, a stepped crown washed in muted gold, a mast.
  const seed = 4242, occ = 0.17;
  const win = [1.5, 3.9, 0.42, 0.62];
  const tone = [0.72, 0.7, 0.30, 0];
  const I = (kind, fl) => [seed, occ, kind, fl];
  B.box(cx, 0, cz, 84, 24, 74, I(0, 0), win, tone);
  B.box(cx, 24, cz, 62, 228, 62, I(0, 0), win, tone);
  B.box(cx, 252, cz, 50, 66, 50, I(0, 0.12), win, tone);
  B.box(cx, 318, cz, 40, 50, 40, I(0, 0.18), win, tone);
  const pin = (y, half, h, fl) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cone(cx + sx * half, y, cz + sz * half, 2.6, h, 2.6, I(1, fl), tone); };
  pin(252, 29.5, 11, 0.5); pin(318, 23.5, 10, 0.6);
  let y = 368;
  for (const [w, h, fl] of [[33, 12, 1.0], [27, 10, 1.0], [21, 9, 0.95], [14, 8, 0.85]]) { B.box(cx, y, cz, w, h, w, I(1, fl), win, tone); y += h; }
  B.cyl(cx, y, cz, 10, 26, 10, I(1, 0.75), tone); y += 26;
  B.cone(cx, y, cz, 7, 42, 7, I(1, 0.5), tone); y += 38;
  B.cyl(cx, y, cz, 1.1, 24, 1.1, I(1, 0.25), tone);
}

function buildCity(comp, cam, aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(comp.vfov / 2));
  const tanH = tanV * aspect;
  const [camX, camH, camZ] = comp.cam;
  const B = new Builder();
  const fields = (x, z) => ({
    mid: Math.exp(-((x - W.hero.x) ** 2 + ((z - W.hero.z) * 1.25) ** 2) / (2 * 720 * 720)),
    near: Math.exp(-((x - 60) ** 2 + (z + 260) ** 2) / (2 * 620 * 620)),
    west: Math.exp(-((x + 1900) ** 2 + (z + 1100) ** 2) / (2 * 760 * 760)),
    east: Math.exp(-((x - 2100) ** 2 + (z + 2300) ** 2) / (2 * 700 * 700)),
  });

  // landmarks for this composition
  const marks = comp.landmarks.map((m) => ({ ...m, x: camX + m.ndcX * tanH * m.fwd, z: camZ - m.fwd }));
  // the searchlight stands on a flat roof
  const bs = comp.beam.src;
  marks.push({ x: camX + bs.ndcX * tanH * bs.fwd, z: camZ - bs.fwd, w: 40, d: 36, h: bs.y - 1, style: 'slab', flood: 0, occ: 0.12, beamHouse: true });
  const heroBox = { x: W.hero.x, z: W.hero.z, w: 92, d: 82 };
  const blocked = (x0, x1, z0, z1) => {
    if (x1 > heroBox.x - heroBox.w / 2 - 8 && x0 < heroBox.x + heroBox.w / 2 + 8 && z1 > heroBox.z - heroBox.d / 2 - 8 && z0 < heroBox.z + heroBox.d / 2 + 8) return true;
    for (const m of marks) if (x1 > m.x - m.w / 2 - 10 && x0 < m.x + m.w / 2 + 10 && z1 > m.z - m.d / 2 - 10 && z0 < m.z + m.d / 2 + 10) return true;
    return false;
  };

  const xMin = -5200, xMax = 5200;
  const zNear = camZ - 30;
  const aiMin = Math.floor((xMin - W.aveOff) / W.ave), aiMax = Math.ceil((xMax - W.aveOff) / W.ave);
  const zFar = W.riverZ - 1400;
  const siMin = Math.floor((zFar - W.stOff) / W.st), siMax = Math.ceil((zNear - W.stOff) / W.st);
  const [pX0, pX1, pZ0, pZ1] = W.park;

  for (let ai = aiMin; ai < aiMax; ai++) {
    const bx0 = ai * W.ave + W.aveOff + W.aveW / 2, bx1 = (ai + 1) * W.ave + W.aveOff - W.aveW / 2;
    for (let si = siMin; si < siMax; si++) {
      const bz0 = si * W.st + W.stOff + W.stW / 2, bz1 = (si + 1) * W.st + W.stOff - W.stW / 2;
      const bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
      if (bz1 > zNear) continue;
      const bank = Math.max(riverZ(bx0), riverZ(bx1), riverZ(bcx)) + W.riverHalf + 30;
      if (bz0 < bank) continue;                        // only blocks wholly on the island
      if (bcx > pX0 && bcx < pX1 && bcz > pZ0 && bcz < pZ1) continue;
      // keep only blocks that can be seen (cheap frustum test on the block centre)
      const fwdB = camZ - bcz;
      if (fwdB < 20) continue;
      const ndcB = (bcx - camX) / (fwdB * tanH);
      if (Math.abs(ndcB) > 1.25 + 300 / fwdB) continue;

      const rb = mulberry32(hashInts(CITY_SEED, ai, si));
      // split the block east-west into lots
      const lots = [];
      let x = bx0;
      while (x < bx1 - 8) {
        let lw = 20 + rb() * 42;
        if (rb() < 0.16) lw += 30 + rb() * 40;
        if (bx1 - (x + lw) < 16) lw = bx1 - x;
        const deep = lw > 34 || rb() < 0.55;
        if (deep) lots.push([x, x + lw, bz0, bz1]);
        else { const mz = (bz0 + bz1) / 2; lots.push([x, x + lw, bz0, mz]); lots.push([x, x + lw, mz, bz1]); }
        x += lw;
      }
      lots.forEach((L, li) => {
        const r = mulberry32(hashInts(CITY_SEED, ai, si, li + 1));
        const [x0, x1, z0, z1] = L;
        const m = 1.2 + r() * 1.6;                       // gap between buildings
        const w = x1 - x0 - m, d = z1 - z0 - m;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const f = fields(cx, cz);
        const uptown = cz < -2650 ? 0.45 : 1;
        let H = 16 + 34 * Math.pow(r(), 1.8);
        const tallP = (0.035 + 0.30 * f.mid + 0.34 * f.near + 0.16 * f.west + 0.14 * f.east) * uptown;
        const u = r();
        let tall = false;
        if (u < tallP && w >= 24 && d >= 24) { tall = true; H = 82 + Math.pow(r(), 1.5) * (90 + 120 * f.mid + 150 * f.near + 110 * f.west + 90 * f.east); }
        else if (u < tallP * 2.4) H = 48 + r() * 55;
        const styleR = r();
        const style = styleR < 0.50 ? 'deco' : styleR < (H > 160 ? 0.68 : 0.56) ? 'gothic' : 'slab';
        const variant = r();

        if (blocked(x0, x1, z0, z1)) return;
        // keep the middle of the view open: in the central cone, nearer roofs stay below the eye line
        const fwd = camZ - cz;
        const ndc = (cx - camX) / (fwd * tanH);
        const central = Math.abs(ndc) < 0.80;
        if (central && fwd < 1500) H = Math.min(H, camH - 82 - Math.max(0, 1500 - fwd) * 0.045);
        const inner = Math.abs(ndc) < 0.62;
        if (inner && fwd < 1150) H = Math.min(H, 34 + (fwd - 300) * 0.15 + (r() < 0.12 ? 40 : 0));
        if (Math.abs(ndc) < 0.58 && fwd >= 1500 && fwd < 4200) H = Math.min(H, 95 + 120 * Math.abs(ndc) / 0.58 + (r() < 0.06 ? 60 : 0));
        if (Math.abs(ndc) < 0.62 && fwd >= 3300) H = Math.min(H, 22 + 30 * Math.abs(ndc) / 0.62);
        const dHero = Math.hypot(cx - W.hero.x, cz - W.hero.z);
        if (dHero < 420) H = Math.min(H, 70 + dHero * 0.25);
        H = Math.max(H, 12);
        // 2 a.m.: fewer lights in the quiet middle of the frame
        const calm = Math.exp(-((ndc / 0.62) ** 2)) * (fwd > 250 && fwd < 3200 ? 1 : 0.4);
        const occMul = 1 - 0.55 * calm;
        if (H > 80 && (tall || variant < 0.5)) tower(B, cx, cz, w, d, H, style, r, { occMul });
        else lowBuilding(B, cx, cz, w, d, H, r, occMul, fwd < 2200);
      });
    }
  }

  // the far shore: low sprawl along the bank and two hazy clusters of mid-rise towers
  const rf = mulberry32(hashInts(CITY_SEED, 777));
  for (let i = 0; i < 420; i++) {
    const x = -4600 + rf() * 9200;
    const z = riverZ(x) - W.riverHalf - 20 - Math.pow(rf(), 1.5) * 1600;
    const w = 14 + rf() * 40, d = 14 + rf() * 40, H = 8 + Math.pow(rf(), 2) * 30;
    const fwd = camZ - z, ndc = (x - camX) / (fwd * tanH);
    if (Math.abs(ndc) > 1.2) continue;
    lowBuilding(B, x, z, w, d, H, rf, 0.6, false);
  }
  for (const [ccx, cnt] of [[-2300, 16], [2000, 11]]) {
    for (let i = 0; i < cnt; i++) {
      const x = ccx + (rf() - 0.5) * 900;
      const z = riverZ(x) - W.riverHalf - 180 - rf() * 700;
      const H = 70 + Math.pow(rf(), 1.4) * 140;
      const fwd = camZ - z, ndc = (x - camX) / (fwd * tanH);
      if (Math.abs(ndc) > 1.2) continue;
      tower(B, x, z, 26 + rf() * 22, 26 + rf() * 22, H, rf() < 0.6 ? 'slab' : 'deco', rf, { occMul: 0.7 });
    }
  }

  heroTower(B, W.hero.x, W.hero.z);
  for (const m of marks) {
    const r = mulberry32(hashInts(CITY_SEED, Math.round(m.x), Math.round(m.z)));
    if (m.beamHouse) { lowBuilding(B, m.x, m.z, m.w, m.d, m.h, r, 0.6, false); continue; }
    if (m.style === 'crown') { crownTower(B, m.x, m.z, m.w, m.d, m.h, r, { occ: m.occ, flood: m.flood }); continue; }
    tower(B, m.x, m.z, m.w, m.d, m.h, m.style, r, { occ: m.occ, flood: m.flood, spire: m.spire });
  }
  return { B, marks };
}

// ---------------------------------------------------------------------------------------------
// Lamps (point sprites): streets, park paths, embankments, the bridge, late traffic, and the
// far shore all the way to the horizon
// ---------------------------------------------------------------------------------------------
function vnoiseJS(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => hashInts(CITY_SEED, a, b) / 4294967296;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
}
function genLights(comp, tanH) {
  const [camX, , camZ] = comp.cam;
  const P = [], C = [], R = [];
  const SOD = [1.0, 0.56, 0.25], LAMP = [1.0, 0.76, 0.52], WHITE = [0.86, 0.87, 0.85], TAIL = [0.62, 0.10, 0.05];
  const vis = (x, z, pad = 1.08) => { const f = camZ - z; return f > 40 && Math.abs((x - camX) / (f * tanH)) < pad; };
  const add = (x, y, z, col, I, r) => { if (!vis(x, z)) return; P.push(x, y, z); C.push(col[0] * I, col[1] * I, col[2] * I); R.push(r); };
  const [pX0, pX1, pZ0, pZ1] = W.park;
  const inPark = (x, z) => x > pX0 && x < pX1 && z > pZ0 && z < pZ1;
  const onIsland = (x, z) => z > riverZ(x) + W.riverHalf + 6;
  const rnd = mulberry32(hashInts(CITY_SEED, 31337));

  // avenue and street lamps
  for (let ai = -22; ai <= 22; ai++) {
    const aC = ai * W.ave + W.aveOff;
    for (let z = camZ; z > W.riverZ - 1500; z -= 30) {
      for (const sd of [-1, 1]) {
        const x = aC + sd * (W.aveW / 2 - 1.5);
        if (!onIsland(x, z) || inPark(x, z)) continue;
        add(x, 7, z, SOD, 2.4 + rnd() * 0.8, 0.55);
      }
    }
  }
  for (let si = -80; si <= 4; si++) {
    const sC = si * W.st + W.stOff;
    if (sC > camZ) continue;
    for (let x = -6000; x < 6000; x += 34) {
      for (const sd of [-1, 1]) {
        const z = sC + sd * (W.stW / 2 - 1.2);
        if (!onIsland(x, z) || inPark(x, z)) continue;
        add(x, 6, z, SOD, 1.8 + rnd() * 0.7, 0.5);
      }
    }
  }
  // late traffic on the avenues
  for (let ai = -22; ai <= 22; ai++) {
    const aC = ai * W.ave + W.aveOff;
    const north = ((ai % 2) + 2) % 2 === 0;
    for (let z = camZ; z > W.riverZ; z -= 13) {
      for (let lane = 0; lane < 5; lane++) {
        if (rnd() > 0.035) continue;
        const x = aC - 12 + (lane + 0.5) * 4.8;
        if (!onIsland(x, z) || inPark(x, z)) continue;
        const col = north ? TAIL : WHITE, I = north ? 1.6 : 3.2;
        add(x - 0.8, 0.9, z, col, I, 0.22); add(x + 0.8, 0.9, z, col, I, 0.22);
      }
    }
  }
  // park paths
  for (let x = pX0; x < pX1; x += 46) for (let z = pZ0; z < pZ1; z += 46) {
    if (rnd() < 0.2) add(x + rnd() * 40, 4, z + rnd() * 40, rnd() < 0.75 ? SOD : WHITE, 1.6, 0.4);
  }
  // embankments
  for (let x = -9000; x < 9000; x += 22) {
    const zr = riverZ(x);
    add(x, 6, zr + W.riverHalf - 5, SOD, 3.6, 0.6);
    add(x + 11, 6, zr - W.riverHalf + 5, rnd() < 0.8 ? SOD : WHITE, 3.0, 0.6);
  }
  // bridge: kerb lamps along the deck, warning lamps on the tower tops
  {
    const zr = riverZ(BRIDGE_X), len = W.riverHalf * 2 + 60;
    for (let z = zr - len / 2; z <= zr + len / 2; z += 16) for (const sd of [-1, 1]) add(BRIDGE_X + sd * 9.5, 56.5, z, WHITE, 2.6, 0.5);
    for (const t of [-0.3, 0.3]) add(BRIDGE_X, 119, zr + t * len, [0.9, 0.35, 0.2], 2.0, 0.8);
  }
  // a faint beacon at the top of the spire
  P.push(W.hero.x, 495, W.hero.z); C.push(1.6, 1.25, 0.95); R.push(0.7);
  // the far shore to the horizon: lamps on a rotated grid, coarser and brighter with distance
  const ca = Math.cos(0.42), sa = Math.sin(0.42);
  const bands = [[0, 5500, 40, 0.30, 0.55], [5500, 11000, 70, 0.30, 0.8], [11000, 26000, 120, 0.26, 1.2]];
  for (const [d0, d1, cell, baseD, rr] of bands) {
    const zStart = W.riverZ - W.riverHalf - d0 + 900, zEnd = W.riverZ - W.riverHalf - d1;
    for (let z = zStart; z > zEnd; z -= cell) {
      const fwd = camZ - z;
      const half = fwd * tanH * 1.1;
      for (let x = camX - half; x < camX + half; x += cell) {
        const jx = x + (rnd() - 0.2) * cell * 0.8, jz = z + (rnd() - 0.2) * cell * 0.8;
        const zr = riverZ(jx);
        if (jz > zr - W.riverHalf - 15) continue;
        const gx = jx * ca - jz * sa, gz = jx * sa + jz * ca;
        const dev = Math.min(1, Math.max(0, (vnoiseJS(jx / 2300 + 5, jz / 2300) * 0.65 + vnoiseJS(jx / 800, jz / 800 + 9) * 0.35 - 0.30) / 0.40));
        const road = Math.abs(((gz % 900) + 900) % 900 - 450) < cell * 0.5 ? 0.35 : 0;
        const town = Math.max(0, 1 - Math.hypot(jx + 2300, jz - (zr - W.riverHalf - 500)) / 1400) * 0.4 + Math.max(0, 1 - Math.hypot(jx - 2000, jz - (zr - W.riverHalf - 500)) / 1100) * 0.35;
        if (rnd() > baseD * (0.05 + 1.4 * dev * dev) + road * 0.7 + town) continue;
        void gx;
        add(jx, 5, jz, rnd() < 0.72 ? SOD : (rnd() < 0.6 ? LAMP : WHITE), 1.4 + rnd() * 1.4, rr);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(C), 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(new Float32Array(R), 1));
  return geo;
}

// ---------------------------------------------------------------------------------------------
// Scene assembly
// ---------------------------------------------------------------------------------------------
function instanced(geo, items, material, camPos) {
  items.sort((a, b) => ((a.cx - camPos.x) ** 2 + (a.cz - camPos.z) ** 2) - ((b.cx - camPos.x) ** 2 + (b.cz - camPos.z) ** 2));
  const n = items.length;
  const mesh = new THREE.InstancedMesh(geo, material, n);
  const aInfo = new Float32Array(n * 4), aWin = new Float32Array(n * 4), aTone = new Float32Array(n * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  items.forEach((it, i) => {
    p.set(it.cx, it.cy, it.cz); s.set(it.w, it.h, it.d); m.compose(p, q, s); mesh.setMatrixAt(i, m);
    aInfo.set(it.info, i * 4); aWin.set(it.win, i * 4); aTone.set(it.tone, i * 4);
  });
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(aInfo, 4));
  geo.setAttribute('aWin', new THREE.InstancedBufferAttribute(aWin, 4));
  geo.setAttribute('aTone', new THREE.InstancedBufferAttribute(aTone, 4));
  mesh.frustumCulled = false;
  return mesh;
}

function screenRay(cam, nx, ny) {
  const v = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
  return v.sub(cam.position).normalize();
}

const LOOK = {
  hazeLow: [0.037, 0.030, 0.0245],
  hazeHigh: [0.0055, 0.0080, 0.0125],
  winGain: 0.72, floodGain: 0.20, streetGain: 1.5, lampGain: 0.55,
  cloudGain: 1.0, beamGain: 0.09,
  lightGain: 1.0,
  exposure: 1.28, bloom: 0.6, bloomThresh: 0.16, sat: 0.78, calmAmt: 0.30,
};

function buildScene(format, aspect, pixAng, ss) {
  const comp = COMPOSITIONS[format];
  const cam = new THREE.PerspectiveCamera(comp.vfov, aspect, 20, 95000);
  cam.position.set(...comp.cam);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(THREE.MathUtils.degToRad(comp.pitch), 0, 0);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();

  const common = {
    uFogA: { value: W.fogA }, uFogB: { value: W.fogB },
    uHazeLow: { value: new THREE.Vector3(...LOOK.hazeLow) }, uHazeHigh: { value: new THREE.Vector3(...LOOK.hazeHigh) },
    uPixAng: { value: pixAng },
  };
  const scene = new THREE.Scene();
  let lampCount = 0;

  const { B } = buildCity(comp, cam, aspect);
  const bMat = new THREE.ShaderMaterial({
    vertexShader: BUILDING_VS, fragmentShader: BUILDING_FS,
    uniforms: { ...common, uWinGain: { value: LOOK.winGain }, uFloodGain: { value: LOOK.floodGain }, uStreetGain: { value: LOOK.streetGain } },
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const coneGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); coneGeo.rotateY(Math.PI / 4);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1);
  const camPos = cam.position;
  const boxes = instanced(boxGeo, B.boxes, bMat, camPos);
  const cones = instanced(coneGeo, B.cones, bMat, camPos);
  const cyls = instanced(cylGeo, B.cyls, bMat, camPos);
  for (const mm of [boxes, cones, cyls]) { mm.renderOrder = 0; scene.add(mm); }

  // ground
  const gMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VS, fragmentShader: GROUND_FS,
    uniforms: {
      ...common,
      uRiverZ: { value: W.riverZ }, uRiverHalf: { value: W.riverHalf },
      uPark: { value: new THREE.Vector4(...W.park) },
      uAve: { value: W.ave }, uAveOff: { value: W.aveOff }, uAveW: { value: W.aveW },
      uSt: { value: W.st }, uStOff: { value: W.stOff }, uStW: { value: W.stW },
      uLampGain: { value: LOOK.lampGain },
    },
  });
  const gGeo = new THREE.PlaneGeometry(130000, 130000); gGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gGeo, gMat);
  ground.position.set(camPos.x, 0, camPos.z); ground.renderOrder = 1; ground.frustumCulled = false;
  scene.add(ground);

  // bridge: two dark towers and a deck whose kerb lamps are a single row of lit "windows"
  {
    const zr = riverZ(BRIDGE_X);
    const bb = new Builder();
    const len = W.riverHalf * 2 + 60;
    for (const t of [-0.3, 0.3]) bb.box(BRIDGE_X, 0, zr + t * len, 18, 118, 10, [999, 0, 2, 0], [2, 4, 0, 0], [0.5, 0.3, 0, 0]);
    bb.box(BRIDGE_X, 52, zr, 20, 3.2, len, [998, 1.0, 0, 0], [16, 3.2, 0.12, 0.42], [0.0, 0.2, 1.0, 52]);
    scene.add(instanced(new THREE.BoxGeometry(1, 1, 1), bb.boxes, bMat, camPos));
  }

  // the cloud deck, the broken layer under it, and the sky beyond
  const beamSrcC = comp.beam.src;
  const tanV = Math.tan(THREE.MathUtils.degToRad(comp.vfov / 2));
  const src = new THREE.Vector3(comp.cam[0] + beamSrcC.ndcX * tanV * aspect * beamSrcC.fwd, beamSrcC.y, comp.cam[2] - beamSrcC.fwd);
  const rd = screenRay(cam, comp.beam.hit.ndcX, comp.beam.hit.ndcY);
  const tHit = (W.cloudY - camPos.y) / rd.y;
  const hit = camPos.clone().addScaledVector(rd, tHit);

  const cMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VS, fragmentShader: CLOUD_FS, side: THREE.DoubleSide,
    uniforms: { ...common, uBeamHit: { value: hit.clone() }, uSpotGain: { value: comp.beam.gain ?? 1 }, uRiverZ: { value: W.riverZ }, uCloudGain: { value: LOOK.cloudGain } },
  });
  const cGeo = new THREE.PlaneGeometry(130000, 130000); cGeo.rotateX(Math.PI / 2);
  const cloud = new THREE.Mesh(cGeo, cMat);
  cloud.position.set(camPos.x, W.cloudY, camPos.z); cloud.renderOrder = 2; cloud.frustumCulled = false;
  scene.add(cloud);

  const sMat = new THREE.ShaderMaterial({ vertexShader: GROUND_VS, fragmentShader: SKY_FS, side: THREE.BackSide, uniforms: { ...common }, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90000, 48, 24), sMat);
  sky.position.copy(camPos); sky.renderOrder = 3; sky.frustumCulled = false;
  scene.add(sky);

  const scMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VS, fragmentShader: SCUD_FS, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { ...common },
  });
  const scGeo = new THREE.PlaneGeometry(60000, 60000); scGeo.rotateX(Math.PI / 2);
  const scud = new THREE.Mesh(scGeo, scMat);
  scud.position.set(camPos.x, W.scudY, camPos.z); scud.renderOrder = 4; scud.frustumCulled = false;
  scene.add(scud);

  // lamps
  {
    const tanH = Math.tan(THREE.MathUtils.degToRad(comp.vfov / 2)) * aspect;
    const geo = genLights(comp, tanH);
    const mat = new THREE.ShaderMaterial({
      vertexShader: LIGHT_VS, fragmentShader: LIGHT_FS, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...common, uPxPerRad: { value: 1 / pixAng }, uMinPx: { value: 1.25 * ss }, uGain: { value: LOOK.lightGain } },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 6;
    scene.add(pts);
    lampCount = geo.attributes.position.count;
  }

  // the searchlight
  {
    const dir = hit.clone().sub(src);
    const len = dir.length() * 1.02; dir.normalize();
    const geo = new THREE.CylinderGeometry(len * 0.055, 1.8, len, 40, 1, true);
    geo.translate(0, len / 2, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { ...common, uLen: { value: len }, uBeamGain: { value: LOOK.beamGain * (comp.beam.gain ?? 1) } },
    });
    const beam = new THREE.Mesh(geo, mat);
    beam.position.copy(src);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    beam.renderOrder = 5; beam.frustumCulled = false;
    scene.add(beam);
  }

  return { scene, cam, comp, counts: { boxes: B.boxes.length, cones: B.cones.length, cyls: B.cyls.length, lamps: lampCount } };
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------
let renderer = null;
function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = true;
  return renderer;
}

function rt(w, h, samples = 0) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: samples > 0 || false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples,
    colorSpace: THREE.NoColorSpace,
  });
}

function postKit() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mesh = new THREE.Mesh(geo);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  return {
    copy: mk(COPY_FS, { tSrc: { value: null } }),
    down: mk(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1 }, uPre: { value: 0 } }),
    blur: mk(BLUR_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }),
    final: mk(FINAL_FS, {
      tHdr: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, tB4: { value: null },
      uExposure: { value: 1 }, uBloom: { value: 0.5 }, uSat: { value: 0.7 }, uCalmAmt: { value: 0.2 },
      uCalm: { value: new THREE.Vector4(0.5, 0.5, 0.3, 0.3) }, uRes: { value: new THREE.Vector2() },
    }),
    draw(r, mat, target) { mesh.material = mat; r.setRenderTarget(target); r.render(scene, cam); },
  };
}

async function renderFrame({ format, width, height, ss = 2, tile = 1024 }) {
  const r = getRenderer();
  const aspect = width / height;
  const pixAng = 2 * Math.tan(THREE.MathUtils.degToRad(COMPOSITIONS[format].vfov / 2)) / (height * ss);
  const t0 = performance.now();
  const { scene, cam, comp, counts } = buildScene(format, aspect, pixAng, ss);
  const post = postKit();

  // 1) tiles at ss x into an MSAA HDR target, box-downsampled into the full HDR image
  const full = rt(width, height);
  const nx = Math.ceil(width / tile), ny = Math.ceil(height / tile);
  const xs = Array.from({ length: nx + 1 }, (_, i) => Math.round((i * width) / nx));
  const ys = Array.from({ length: ny + 1 }, (_, i) => Math.round((i * height) / ny));
  let tileRT = null;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const tx = xs[i], tw = xs[i + 1] - xs[i], ty = ys[j], th = ys[j + 1] - ys[j];
      if (!tileRT || tileRT.width !== tw * ss || tileRT.height !== th * ss) { tileRT?.dispose(); tileRT = rt(tw * ss, th * ss, 4); }
      cam.setViewOffset(width * ss, height * ss, tx * ss, ty * ss, tw * ss, th * ss);
      r.setRenderTarget(tileRT);
      r.setClearColor(0x000000, 1);
      r.render(scene, cam);
      post.copy.uniforms.tSrc.value = tileRT.texture;
      full.viewport.set(tx, height - ty - th, tw, th);
      full.scissor.set(tx, height - ty - th, tw, th);
      full.scissorTest = true;
      r.autoClear = false;
      post.draw(r, post.copy, full);
      r.autoClear = true;
      full.scissorTest = false;
      full.viewport.set(0, 0, width, height);
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  tileRT?.dispose();
  cam.clearViewOffset();
  const t1 = performance.now();

  // 2) bloom chain
  const mips = [];
  let src = full, sw = width, sh = height;
  for (let k = 0; k < 6; k++) {
    sw = Math.max(1, Math.round(sw / 2)); sh = Math.max(1, Math.round(sh / 2));
    const a = rt(sw, sh), b = rt(sw, sh);
    post.down.uniforms.tSrc.value = src.texture;
    post.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    post.down.uniforms.uPre.value = k === 0 ? 1 : 0;
    post.down.uniforms.uThresh.value = LOOK.bloomThresh;
    post.draw(r, post.down, a);
    post.blur.uniforms.tSrc.value = a.texture; post.blur.uniforms.uDir.value.set(1 / sw, 0); post.draw(r, post.blur, b);
    post.blur.uniforms.tSrc.value = b.texture; post.blur.uniforms.uDir.value.set(0, 1 / sh); post.draw(r, post.blur, a);
    mips.push(a); b.dispose();
    src = a;
  }

  // 3) grade to the canvas
  r.setSize(width, height, false);
  const fu = post.final.uniforms;
  fu.tHdr.value = full.texture;
  for (let k = 0; k < 5; k++) fu['tB' + k].value = mips[k + 1].texture;
  fu.uExposure.value = LOOK.exposure; fu.uBloom.value = LOOK.bloom; fu.uSat.value = LOOK.sat; fu.uCalmAmt.value = LOOK.calmAmt;
  fu.uCalm.value.set(comp.calm[0], 1 - comp.calm[1], comp.calm[2], comp.calm[3]);
  fu.uRes.value.set(width, height);
  post.draw(r, post.final, null);
  const t2 = performance.now();

  full.dispose(); mips.forEach((m) => m.dispose());
  scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  return { canvas: r.domElement, timings: { tiles: Math.round(t1 - t0), post: Math.round(t2 - t1) }, counts };
}

// Simple read-out for the look check-list: luminance, saturation, neon, calm middle.
function measure(canvas) {
  const w = 480, h = Math.round((480 * canvas.height) / canvas.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let L = 0, S = 0, sn = 0, neon = 0, cL = 0, cn = 0, eL = 0, en = 0, bright = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const R = d[i], G = d[i + 1], Bv = d[i + 2];
    const l = 0.2126 * R + 0.7152 * G + 0.0722 * Bv; L += l;
    const mx = Math.max(R, G, Bv), mn = Math.min(R, G, Bv);
    if (mx > 12) { const s = (mx - mn) / mx; S += s; sn++;
      let hue = 0; const dd = mx - mn || 1;
      if (mx === R) hue = ((G - Bv) / dd) % 6; else if (mx === G) hue = (Bv - R) / dd + 2; else hue = (R - G) / dd + 4;
      hue = (hue * 60 + 360) % 360;
      if (s > 0.45 && mx > 70 && hue > 150 && hue < 345) neon++; }
    if (l > 200) bright++;
    const u = x / w, v = y / h;
    if (u > 0.3 && u < 0.7 && v > 0.3 && v < 0.75) { cL += l; cn++; } else if (u < 0.15 || u > 0.85 || v < 0.2) { eL += l; en++; }
  }
  const n = w * h;
  return { meanLuma: +(L / n).toFixed(1), meanSat: +(S / Math.max(sn, 1)).toFixed(3), neonPct: +((100 * neon) / n).toFixed(3), brightPct: +((100 * bright) / n).toFixed(3), centreLuma: +(cL / cn).toFixed(1), edgeLuma: +(eL / en).toFixed(1) };
}

function soften(canvas, width) {
  const h = Math.round((width * canvas.height) / canvas.width);
  const c = document.createElement('canvas'); c.width = width; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#060709'; g.fillRect(0, 0, width, h);
  g.filter = `blur(${Math.round(width / 64)}px) brightness(0.72) saturate(0.8)`;
  const ox = width * 0.06, oy = h * 0.06;
  g.drawImage(canvas, -ox, -oy, width + 2 * ox, h + 2 * oy);
  g.filter = 'none';
  // a touch of fine noise so the blur never bands
  const img = g.getImageData(0, 0, width, h); const d = img.data;
  let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() + rnd() - 1) * 1.6; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return c;
}

window.renderWallpaper = async (opts) => {
  const { canvas, timings, counts } = await renderFrame(opts);
  const q = opts.quality ?? 0.88;
  const out = { jpeg: canvas.toDataURL('image/jpeg', q), timings, counts, stats: measure(canvas) };
  if (opts.soft) {
    const s = soften(canvas, opts.soft);
    out.soft = s.toDataURL('image/jpeg', 0.86);
    out.softStats = measure(s);
  }
  return out;
};
window.wallpaperReady = true;
