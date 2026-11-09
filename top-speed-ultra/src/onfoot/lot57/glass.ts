// Ultra's reflections on the Shed's glass (P1d repair): a planar mirror for the Shed's yard wall, where the tank-room
// window and, after hours, the four glass roll-up doors all lie in one plane, so one mirror view serves them all. It
// is three's own Reflector (examples/jsm) with a glass shader of ours laid a few millimetres in front of the panes: the
// mirror view of the yard, the string lights and the sky, as much as glass shows of it (a Fresnel term: a faint
// reflection looking straight on, nearly a mirror at a glancing angle), over the panes' own look behind it. The
// mullions stand proud of it, so they cut the reflection as they cut the glass. Drawn on Ultra only; its view is
// drawn once a frame at most, at 512 x 512, without multisampling.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { PLAN } from './coords';

/** the roll-up doors' centres along the Shed's yard wall (venue.ts builds them at these) */
const DOORS = [-38.2, -29.2, -20.2, -11.2];

const GlassShader = {
  name: 'Lot57Glass',
  uniforms: {
    color: { value: null as THREE.Color | null }, tDiffuse: { value: null as THREE.Texture | null }, textureMatrix: { value: null as THREE.Matrix4 | null },
    uDoors: { value: 0 }, uNormal: { value: new THREE.Vector3(1, 0, 0) }, uGain: { value: 1 },
  },
  vertexShader: /* glsl */ `
uniform mat4 textureMatrix;
attribute float aDoor;
varying vec4 vUv; varying vec3 vWorld; varying float vDoor;
void main() {
  vUv = textureMatrix * vec4( position, 1.0 ); vDoor = aDoor;
  vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
  fragmentShader: /* glsl */ `
uniform vec3 color; uniform sampler2D tDiffuse; uniform float uDoors; uniform vec3 uNormal; uniform float uGain;
varying vec4 vUv; varying vec3 vWorld; varying float vDoor;
void main() {
  if ( vDoor > 0.5 && uDoors < 0.5 ) discard;
  vec3 V = normalize( cameraPosition - vWorld );
  float c = clamp( abs( dot( V, uNormal ) ), 0.0, 1.0 );
  // glass: about a tenth straight on (the dark room behind lets it show), most of the view at a glancing angle
  float f = 0.12 + 0.78 * pow( 1.0 - c, 3.0 );
  vec3 refl = texture2DProj( tDiffuse, vUv ).rgb * color * uGain;
  gl_FragColor = vec4( refl, clamp( f, 0.0, 0.9 ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
};

export class ShedMirror {
  readonly mesh: Reflector;
  private doorsMesh: THREE.Object3D | null | undefined;
  private drawnAt = -1;
  frame = 0;
  constructor() {
    const S = PLAN.shed, x = S.x1 + 0.035;
    // panes in the mirror's own plane (local x along the wall, y up, +z out into the yard); the mesh is turned to face +x
    const pos: number[] = [], door: number[] = [], idx: number[] = [];
    const pane = (z0: number, z1: number, y0: number, y1: number, d: number) => {
      const b = pos.length / 3;
      // local x = -(world z), so the wall's z runs right to left in local x
      pos.push(-z0, y0, 0, -z1, y0, 0, -z1, y1, 0, -z0, y1, 0);
      door.push(d, d, d, d);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    };
    pane(-1.4, 6.6, 1.0, 5.4, 0);                                        // the tank-room window
    for (const z of DOORS) pane(z - 2.1, z + 2.1, 0.0, 4.2, 1);         // the roll-up doors (glass when down)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDoor', new THREE.Float32BufferAttribute(door, 1));
    g.setIndex(idx);
    // (wound so the face's front looks out of local +z, the side the Reflector mirrors)
    g.computeVertexNormals();
    const r = new Reflector(g, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0, shader: GlassShader, color: 0xffffff });
    r.position.set(x, 0, 0);
    r.rotation.y = Math.PI / 2;                                           // local +z to world +x, local +x to world -z
    r.name = 'ultra-shed-mirror';
    const m = r.material as THREE.ShaderMaterial;
    m.transparent = true; m.depthWrite = false;
    r.renderOrder = 3;
    // its view at most once a frame: the ambient occlusion's normal pass draws the scene again and would redraw it
    const draw = r.onBeforeRender;
    r.onBeforeRender = (...a) => { if (this.drawnAt === this.frame) return; this.drawnAt = this.frame; draw.apply(r, a); };
    r.visible = false;
    this.mesh = r;
  }
  /** each frame (Ultra): whether the roll-up doors are down (their glass shows), and how bright the yard is */
  update(scene: THREE.Object3D, frame: number) {
    this.frame = frame;
    if (this.doorsMesh === undefined) this.doorsMesh = scene.getObjectByName('when-closed-doors') ?? null;
    const u = (this.mesh.material as THREE.ShaderMaterial).uniforms;
    u.uDoors.value = this.doorsMesh?.visible ? 1 : 0;
  }
  dispose() { this.mesh.getRenderTarget().dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.geometry.dispose(); }
}
