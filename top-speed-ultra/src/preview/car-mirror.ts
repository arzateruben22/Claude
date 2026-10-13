// Mirrors that show the scene, for the cockpit: a flat quad that renders what it reflects into a small render
// target. Unlike three's Reflector (which renders the whole reflected frustum of the main camera and uses a sliver of
// it), the virtual camera here sits at the eye's reflection and its frustum is cut exactly to the mirror's outline,
// so every texel lands on the glass: a 256x64 target is sharp on a rear-view mirror, and frustum culling drops
// everything the narrow view can't see. Its near plane is the mirror's plane, so nothing behind the glass leaks in.
//
//   new CarMirror(w, h, { res: [w, h], tint?, far?, every?, phase?, dim? })
//     w, h: the glass in metres (local x, y); the reflective face looks along local +z.
//     res: render-target size. tint: multiplies the reflection (silvering is ~85-90 % reflective, an auto-dimming
//     rear-view a little less). far: how far the mirror sees (default 300 m). every / phase: render on one frame in
//     `every` (default 1), offset by phase, so two mirrors can alternate. dim: darken toward the edges (0..1).
//   CarMirror.busy: true while any mirror is rendering (others skip, so mirrors never recurse).
import * as THREE from 'three';

const VERT = /* glsl */`
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec2 vQ;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vQ = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
const FRAG = /* glsl */`
  uniform vec3 color;
  uniform float dim;
  uniform sampler2D tDiffuse;
  varying vec4 vUv;
  varying vec2 vQ;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec3 base = texture2DProj(tDiffuse, vUv).rgb;
    // the silvering darkens a touch toward the edges, where the glass is ground and the coating thins
    vec2 e = abs(vQ - 0.5) * 2.0;
    float edge = 1.0 - dim * smoothstep(0.75, 1.0, max(e.x, e.y));
    gl_FragColor = vec4(base * color * edge, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export interface MirrorOptions { res: [number, number]; tint?: number; far?: number; every?: number; phase?: number; dim?: number }

export class CarMirror extends THREE.Mesh {
  static busy = false;
  readonly target: THREE.WebGLRenderTarget;
  readonly cam = new THREE.PerspectiveCamera();
  private frame = 0;
  private readonly corners: THREE.Vector3[];

  constructor(w: number, h: number, o: MirrorOptions) {
    super(new THREE.PlaneGeometry(w, h));
    this.target = new THREE.WebGLRenderTarget(o.res[0], o.res[1], { type: THREE.HalfFloatType, samples: 0 });
    this.target.texture.generateMipmaps = false;
    const tm = new THREE.Matrix4();
    this.material = new THREE.ShaderMaterial({
      name: 'CarMirror',
      uniforms: { color: { value: new THREE.Color(o.tint ?? 0xdadada) }, tDiffuse: { value: this.target.texture }, textureMatrix: { value: tm }, dim: { value: o.dim ?? 0.25 } },
      vertexShader: VERT, fragmentShader: FRAG,
    });
    this.corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => new THREE.Vector3(x, y, 0));
    const every = Math.max(1, o.every ?? 1), phase = o.phase ?? 0, far = o.far ?? 300;
    const P = new THREE.Vector3(), N = new THREE.Vector3(), C = new THREE.Vector3(), E = new THREE.Vector3(), Y = new THREE.Vector3();
    const R = new THREE.Matrix4(), c = new THREE.Vector3();
    const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.castShadow = false; this.receiveShadow = false;
    this.onBeforeRender = (renderer, scene, camera) => {
      if (CarMirror.busy) return;
      if ((this.frame++ % every) !== phase % every) return;
      P.setFromMatrixPosition(this.matrixWorld);
      R.extractRotation(this.matrixWorld);
      N.set(0, 0, 1).applyMatrix4(R).normalize();
      Y.set(0, 1, 0).applyMatrix4(R).normalize();
      C.setFromMatrixPosition(camera.matrixWorld);
      const d = C.clone().sub(P).dot(N);
      if (d <= 0.001) return;                                   // looking at the back of it
      E.copy(C).addScaledVector(N, -2 * d);                     // the eye's reflection
      const vc = this.cam;
      vc.position.copy(E); vc.up.copy(Y); vc.lookAt(E.clone().add(N));
      vc.updateMatrixWorld(true);
      // the frustum through the glass's corners (all at depth d in front of the reflected eye)
      let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
      for (const k of this.corners) {
        c.copy(k).applyMatrix4(this.matrixWorld).applyMatrix4(vc.matrixWorldInverse);
        const s = 1 / Math.max(1e-4, -c.z);
        l = Math.min(l, c.x * s); r = Math.max(r, c.x * s); b = Math.min(b, c.y * s); t = Math.max(t, c.y * s);
      }
      const near = d + 0.004;
      vc.projectionMatrix.makePerspective(l * near, r * near, t * near, b * near, near, far);
      vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();
      vc.far = far; vc.near = near;
      (this.material as THREE.ShaderMaterial).uniforms.textureMatrix.value.copy(bias).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse).multiply(this.matrixWorld);
      // render
      CarMirror.busy = true;
      this.visible = false;
      const prevTarget = renderer.getRenderTarget(), prevXr = renderer.xr.enabled, prevShadow = renderer.shadowMap.autoUpdate;
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
      try {
        renderer.setRenderTarget(this.target);
        renderer.state.buffers.depth.setMask(true);
        if (renderer.autoClear === false) renderer.clear();
        renderer.render(scene, vc);
      } finally {
        renderer.xr.enabled = prevXr; renderer.shadowMap.autoUpdate = prevShadow;
        renderer.setRenderTarget(prevTarget);
        const vp = (camera as THREE.PerspectiveCamera & { viewport?: THREE.Vector4 }).viewport;
        if (vp !== undefined) renderer.state.viewport(vp);
        this.visible = true;
        CarMirror.busy = false;
      }
    };
  }
  dispose() { this.target.dispose(); (this.material as THREE.Material).dispose(); this.geometry.dispose(); }
}
