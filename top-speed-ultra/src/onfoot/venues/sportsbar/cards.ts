// The filler atlas and the cards (PROJECT_OC_SPORTS_BAR.md, "Fillers": "How they're drawn", "The atlas", "Building
// it"; "Cards for live people"). Fillers, held guests, live people past the preset's mesh count from outside, and anyone
// whose body isn't built yet are drawn as one InstancedMesh of camera-facing quads (2 triangles each), with their blob
// shadows in one shared instanced blob mesh: 2 draw calls for everyone.
//   - The atlas is drawn from the atlas eight (the 8 live people nearest the camera when it's rendered; at load,
//     nearest the spawn), each at LOD 2, in 3 poses (seated, standing, cheering) from 8 directions: 192 cells. Low:
//     1024 x 1024 with 48 x 96 px cells; HD and Ultra: 2048 x 2048 with 96 x 192 px cells.
//   - Per instance: the position, the facing, the look (which of the eight) and the pose. The shader picks the
//     direction cell from the camera's bearing.
//   - Each cell is painted at twice its size and filtered down (Lot 57's impostors, lot57/crowdview.ts, found a leg
//     two or three texels wide broke into specks otherwise).
//   - The cards' material is our own shader material (the Retro style, once it lands, leaves those alone).
// Both meshes set frustumCulled = false: their instances move and change count, so a bounding sphere computed once
// would cull them wrongly ("Never culled by a stale sphere").
import * as THREE from 'three';
import type { Person, PersonOptions } from '../../people';
import type { ClipLayer } from '../../engine/sim/clips';

export const CARD = { w: 1.0, y0: -0.05, h: 2.0 };
export const DIRS = 8, POSES = 3, LOOKS = 8;
export type CardPose = 0 | 1 | 2;          // seated, standing, cheering
export const SEATED: CardPose = 0, STANDING: CardPose = 1, CHEERING: CardPose = 2;

const VS = /* glsl */ `
attribute float iHead; attribute float iCell; attribute vec3 iTint;
uniform vec2 uCells; uniform vec2 uCellUv; uniform vec3 uCard;
varying vec2 vUv; varying vec3 vTint;
#include <fog_pars_vertex>
void main() {
  vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  vec3 toCam = cameraPosition - iPos;
  vec2 d = normalize(toCam.xz + vec2(1e-5, 0.0));
  float rel = atan(d.x, d.y) - iHead;
  float a = mod(floor(rel / 6.2831853 * ${DIRS}.0 + 0.5), ${DIRS}.0);
  float cell = iCell + a;
  vec3 right = vec3(d.y, 0.0, -d.x);
  vec3 p = iPos + right * (position.x * uCard.x) + vec3(0.0, uCard.y + position.y * uCard.z, 0.0);
  float col = mod(cell, uCells.x), row = floor(cell / uCells.x);
  vUv = (vec2(col, row) + uv) * uCellUv;
  vTint = iTint;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec3 vTint;
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  if (c.a < 0.45) discard;
  gl_FragColor = vec4(c.rgb / max(c.a, 0.45) * vTint, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const SS = 2;
const DOWN_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const DOWN_FS = /* glsl */ `uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }`;

function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  // hard-edged at the rim (Low's look is hard shadows: the blobs and the baked light), soft in the middle
  gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.86, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** the colours a look is matched by: the top's, the skin's and the hair's */
export function lookColours(o: PersonOptions): [number, number, number] {
  const top = o.outfit.find((g) => ['jacket', 'leather', 'blazer', 'cardigan', 'tee', 'fitted', 'tank', 'shirt', 'blouse', 'polo', 'dress'].includes(g.kind)) ?? o.outfit[0];
  return [top ? top.color : 0x808080, o.look.skin, o.look.hairColor];
}
const dist3 = (a: number, b: number) => { const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255; return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2; };

export class Cards {
  readonly group = new THREE.Group();
  mesh: THREE.InstancedMesh; blobs: THREE.InstancedMesh;
  private rt: THREE.WebGLRenderTarget | null = null; private ss: THREE.WebGLRenderTarget | null = null;
  private cw = 48; private ch = 96; private cols = 1; private rows = 1;
  size = 0;
  private iHead: THREE.InstancedBufferAttribute; private iCell: THREE.InstancedBufferAttribute; private iTint: THREE.InstancedBufferAttribute;
  private mat: THREE.ShaderMaterial;
  private cap: { scene: THREE.Scene; cam: THREE.OrthographicCamera };
  private down: THREE.Scene; private downMat: THREE.ShaderMaterial;
  /** the atlas eight's colours (top, skin, hair), for each card's nearest look */
  looks: [number, number, number][] = [];
  /** who the atlas eight were, and when and how it was painted (for the hooks) */
  source: { names: string[]; quality: string; size: number; cell: [number, number]; ms: number; renders: number } | null = null;
  private _m = new THREE.Matrix4(); private n = 0; private b = 0;
  constructor(private renderer: THREE.WebGLRenderer, readonly max = 160, readonly maxBlobs = 260) {
    this.group.name = 'people-cards'; this.group.userData.group = 'cards';
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.iHead = new THREE.InstancedBufferAttribute(new Float32Array(max), 1); this.iCell = new THREE.InstancedBufferAttribute(new Float32Array(max), 1); this.iTint = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.iHead, this.iCell, this.iTint]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iHead', this.iHead); g.setAttribute('iCell', this.iCell); g.setAttribute('iTint', this.iTint);
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: null }, uCells: { value: new THREE.Vector2(1, 1) }, uCellUv: { value: new THREE.Vector2(1, 1) }, uCard: { value: new THREE.Vector3(CARD.w, CARD.y0, CARD.h) } }]),
      vertexShader: VS, fragmentShader: FS, fog: true,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, max); this.mesh.name = 'people-cards'; this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.userData.group = 'cards';
    const bg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const bm = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.blobs = new THREE.InstancedMesh(bg, bm, maxBlobs); this.blobs.name = 'people-blobs'; this.blobs.count = 0; this.blobs.frustumCulled = false; this.blobs.renderOrder = 2;
    this.blobs.castShadow = false; this.blobs.receiveShadow = false; this.blobs.userData.group = 'cards';
    this.group.add(this.mesh, this.blobs);
    // the painting set: an orthographic camera on the card, a sky-and-ground fill and a key light from the front
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xf4eee6, 0x5a5048, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(0.6, 1.4, 1.6); scene.add(key);
    const cam = new THREE.OrthographicCamera(-CARD.w / 2, CARD.w / 2, CARD.y0 + CARD.h, CARD.y0, 0.1, 20);
    cam.position.set(0, 0, 6); cam.lookAt(0, 0, 0);
    this.cap = { scene, cam };
    this.downMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: DOWN_VS, fragmentShader: DOWN_FS, blending: THREE.NoBlending, depthTest: false, depthWrite: false, toneMapped: false });
    const dq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.downMat); dq.frustumCulled = false;
    this.down = new THREE.Scene(); this.down.add(dq);
  }
  /** the atlas's size for a people quality: Low 1024 with 48 x 96 cells, HD and Ultra 2048 with 96 x 192 */
  private alloc(hi: boolean) {
    const size = hi ? 2048 : 1024, cw = hi ? 96 : 48, ch = hi ? 192 : 96;
    if (this.rt && this.size === size) return;
    this.rt?.dispose(); this.ss?.dispose();
    this.size = size; this.cw = cw; this.ch = ch; this.cols = Math.floor(size / cw); this.rows = Math.floor(size / ch);
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    this.rt.texture.name = 'people-atlas';
    this.ss = new THREE.WebGLRenderTarget(cw * SS, ch * SS, { depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.downMat.uniforms.tSrc.value = this.ss.texture;
    this.mat.uniforms.uAtlas.value = this.rt.texture;
    (this.mat.uniforms.uCells.value as THREE.Vector2).set(this.cols, this.rows);
    // the cells fill cols x cw of the target's width (1008 of 1024 at Low), so a cell's UV size is its own share
    (this.mat.uniforms.uCellUv.value as THREE.Vector2).set(cw / size, ch / size);
  }
  /**
   * Paint the atlas from the atlas eight's LOD 2 bodies (each is shown at LOD 2 for the painting and put back as it
   * was): 8 looks x 3 poses x 8 directions. `restyle` (the Retro style at Low, once it lands) runs on each body first.
   * Returns the number of renders.
   */
  paint(bodies: { p: Person; name: string }[], hi: boolean, clips: ClipLayer, restyle?: (o: THREE.Object3D) => void) {
    const t0 = performance.now();
    this.alloc(hi);
    const r = this.renderer, oldRT = r.getRenderTarget(), oldAuto = r.autoClear, oldCol = r.getClearColor(new THREE.Color()).getHex(), oldA = r.getClearAlpha();
    const shadowOn = r.shadowMap.enabled; r.shadowMap.enabled = false;
    r.autoClear = false; r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.rt); r.clear(true, true, false);
    this.looks = [];
    let renders = 0;
    const list = bodies.slice(0, LOOKS);
    for (let li = 0; li < LOOKS; li++) {
      const b = list[li % Math.max(1, list.length)]; if (!b) break;
      const p = b.p, g = p.group, parent = g.parent;
      const pos = g.position.clone(), rot = g.rotation.y, vis = g.visible;
      this.looks.push(lookColours(p.options));
      p.setLod(2); restyle?.(g);
      this.cap.scene.add(g); g.position.set(0, 0, 0); g.visible = true;
      for (let pose = 0; pose < POSES; pose++) {
        p.lookAt(null); clips.stop(p); clips.forget(p);
        p.play(pose === SEATED ? 'sit' : 'idle');
        for (let k = 0; k < 4; k++) p.update(0.25);
        if (pose === CHEERING) { clips.play(p, 'cheer', { seconds: 1.8 }); clips.apply(p, 0.75); }
        for (let a = 0; a < DIRS; a++) {
          g.rotation.y = -(a / DIRS) * Math.PI * 2;
          const cell = (li * POSES + pose) * DIRS + a, cx = (cell % this.cols) * this.cw, cy = Math.floor(cell / this.cols) * this.ch;
          r.setRenderTarget(this.ss); r.clear(true, true, false);
          r.render(this.cap.scene, this.cap.cam);
          this.rt!.viewport.set(cx, cy, this.cw, this.ch); this.rt!.scissor.set(cx, cy, this.cw, this.ch); this.rt!.scissorTest = true;
          r.setRenderTarget(this.rt); r.render(this.down, this.cap.cam);
          this.rt!.scissorTest = false;
          renders += 2;
        }
        clips.forget(p);
      }
      if (parent) parent.add(g); else this.cap.scene.remove(g);
      g.position.copy(pos); g.rotation.y = rot; g.visible = vis;
      p.play('idle');
    }
    // the mipmaps once, after every cell is painted
    this.rt!.texture.generateMipmaps = true;
    this.rt!.viewport.set(0, 0, 1, 1); this.rt!.scissor.set(0, 0, 1, 1); this.rt!.scissorTest = true;
    r.setRenderTarget(this.rt); r.render(new THREE.Scene(), this.cap.cam);
    this.rt!.scissorTest = false; this.rt!.viewport.set(0, 0, this.size, this.size); this.rt!.texture.generateMipmaps = false;
    r.setRenderTarget(oldRT); r.autoClear = oldAuto; r.setClearColor(oldCol, oldA); r.shadowMap.enabled = shadowOn;
    this.source = { names: list.map((b) => b.name), quality: hi ? 'high' : 'phone', size: this.size, cell: [this.cw, this.ch], ms: Math.round(performance.now() - t0), renders };
    return renders;
  }
  /** the atlas look nearest a person's colours */
  nearestLook(o: PersonOptions) {
    if (!this.looks.length) return 0;
    const [t, s, h] = lookColours(o);
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.looks.length; i++) { const [a, b, c] = this.looks[i], d = dist3(a, t) * 1.0 + dist3(b, s) * 0.6 + dist3(c, h) * 0.4; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  begin() { this.n = 0; this.b = 0; }
  /** one card: at (x, y, z) facing yaw, look 0..7, pose 0..2, tint (the light on it) */
  put(x: number, y: number, z: number, yaw: number, look: number, pose: CardPose, tint: number) {
    if (this.n >= this.max) return false;
    const i = this.n++;
    this._m.makeTranslation(x, y, z); this.mesh.setMatrixAt(i, this._m);
    this.iHead.setX(i, yaw); this.iCell.setX(i, ((look % LOOKS) * POSES + pose) * DIRS); this.iTint.setXYZ(i, tint, tint * 0.97, tint * 0.92);
    return true;
  }
  /** a blob under someone drawn (a body or a card) */
  blob(x: number, y: number, z: number, s: number) {
    if (this.b >= this.maxBlobs) return false;
    this._m.makeScale(s, 1, s).setPosition(x, y + 0.02, z); this.blobs.setMatrixAt(this.b++, this._m);
    return true;
  }
  end() {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
    this.iHead.needsUpdate = true; this.iCell.needsUpdate = true; this.iTint.needsUpdate = true;
    this.blobs.count = this.b; this.blobs.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.n > 0; this.blobs.visible = this.b > 0;
  }
  get cards() { return this.n; }
  get blobCount() { return this.b; }
  /** one painted cell as a PNG (the checks look at the atlas) */
  atlasImage(maxCells = 192) {
    if (!this.rt) return null;
    const W = this.cw * DIRS, rowsN = Math.ceil(Math.min(maxCells, LOOKS * POSES * DIRS) / DIRS), c = document.createElement('canvas'); c.width = W; c.height = this.ch * rowsN;
    const g = c.getContext('2d')!, img = g.createImageData(this.cw, this.ch), buf = new Uint8Array(this.cw * this.ch * 4);
    for (let rI = 0; rI < rowsN; rI++) for (let a = 0; a < DIRS; a++) {
      const cell = rI * DIRS + a, cx = (cell % this.cols) * this.cw, cy = Math.floor(cell / this.cols) * this.ch;
      this.renderer.readRenderTargetPixels(this.rt, cx, cy, this.cw, this.ch, buf);
      for (let y = 0; y < this.ch; y++) for (let x = 0; x < this.cw; x++) {
        const i = ((this.ch - 1 - y) * this.cw + x) * 4, o = (y * this.cw + x) * 4, al = buf[i + 3] / 255;
        if (al < 0.45) { img.data[o] = 30; img.data[o + 1] = 60; img.data[o + 2] = 40; img.data[o + 3] = 255; continue; }
        for (let k = 0; k < 3; k++) img.data[o + k] = Math.round(255 * Math.pow(Math.min(1, buf[i + k] / 255 / al), 1 / 2.2));
        img.data[o + 3] = 255;
      }
      g.putImageData(img, a * this.cw, rI * this.ch);
    }
    return c.toDataURL('image/png');
  }
  dispose() {
    this.rt?.dispose(); this.ss?.dispose(); this.mesh.geometry.dispose(); this.mat.dispose(); this.mesh.dispose();
    this.blobs.geometry.dispose(); (this.blobs.material as THREE.MeshBasicMaterial).map?.dispose(); (this.blobs.material as THREE.Material).dispose(); this.blobs.dispose();
    this.downMat.dispose();
  }
}
