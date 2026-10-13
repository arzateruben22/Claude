// A reflection probe for the player's car: the real scene round the car (the road, the sound walls, the overpasses,
// the sky) captured into a cube map and prefiltered for roughness, so the clearcoat, the glass, the chrome and the
// door mirrors reflect where the car actually is instead of the sky preset's plain tan ground. Racing games do the
// same with local cube maps refreshed every few frames; here one face is re-rendered per refresh step, so a phone
// pays one low-resolution scene render every `every` frames.
//
//   carProbe(renderer, scene, frame, { res?, height?, every? }): CarProbe
//     frame: the car's frame (the probe sits at (0, height, 0) in it; height defaults to 0.75 m).
//     res: cube face size (default 128; 64 is enough on a phone). every: frames between face refreshes in tick()
//     (default 6; 0 = never refresh automatically).
//   probe.texture        the prefiltered (PMREM) environment, for material.envMap
//   probe.capture(hide)  render all six faces now, with the objects in hide made invisible (the car itself)
//   probe.tick(hide)     call once a frame: refreshes one face every `every` frames and re-filters after the sixth
//   probe.apply(root, o) set envMap (and o.intensity, default 1) on every lit material under root, except the
//                        materials named in o.skip (cabin materials should keep the darker cabin light)
//   probe.dispose()
import * as THREE from 'three';

export interface CarProbe {
  texture: THREE.Texture;
  capture(hide?: THREE.Object3D[]): void;
  tick(hide?: THREE.Object3D[]): void;
  apply(root: THREE.Object3D, o?: { intensity?: number; skip?: (m: THREE.Material) => boolean }): void;
  dispose(): void;
}

export function carProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene, frame: THREE.Object3D, o: { res?: number; height?: number; every?: number } = {}): CarProbe {
  const res = o.res ?? 128, every = o.every ?? 6, h = o.height ?? 0.75;
  const cubeRT = new THREE.WebGLCubeRenderTarget(res, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.3, 3000, cubeRT);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let out = pmrem.fromCubemap(cubeRT.texture);
  let n = 0, nextFace = 0;

  const place = () => { frame.updateMatrixWorld(true); cam.position.copy(new THREE.Vector3(0, h, 0).applyMatrix4(frame.matrixWorld)); cam.updateMatrixWorld(true); };
  const hidden = (hide: THREE.Object3D[], fn: () => void) => {
    const was = hide.map((x) => x.visible); hide.forEach((x) => { x.visible = false; });
    try { fn(); } finally { hide.forEach((x, i) => { x.visible = was[i]; }); }
  };
  const filter = () => { const next = pmrem.fromCubemap(cubeRT.texture, out); out = next; probe.texture = out.texture; };
  // one face: the CubeCamera's children are its six face cameras, in the cube target's face order (oriented by the
  // first full capture); linear light, no tone mapping, as CubeCamera.update renders them
  const renderFace = (i: number) => {
    const fc = cam.children[i] as THREE.PerspectiveCamera;
    const prevRT = renderer.getRenderTarget(), prevXR = renderer.xr.enabled, prevTM = renderer.toneMapping;
    renderer.xr.enabled = false; renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(cubeRT, i);
    renderer.render(scene, fc);
    renderer.setRenderTarget(prevRT);
    renderer.xr.enabled = prevXR; renderer.toneMapping = prevTM;
  };

  const probe: CarProbe = {
    texture: out.texture,
    capture(hide = []) {
      place();
      hidden(hide, () => cam.update(renderer, scene));
      filter();
    },
    tick(hide = []) {
      if (!every || ++n % every) return;
      place();
      hidden(hide, () => renderFace(nextFace));
      nextFace = (nextFace + 1) % 6;
      if (nextFace === 0) filter();
    },
    apply(root, ao = {}) {
      const k = ao.intensity ?? 1;
      root.traverse((x) => {
        const m = (x as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) {
          const s = mm as THREE.MeshStandardMaterial;
          if (!s.isMeshStandardMaterial || ao.skip?.(mm)) continue;
          s.envMap = probe.texture; s.envMapIntensity = (s.userData.envK ??= s.envMapIntensity) * k; s.needsUpdate = true;
        }
      });
    },
    dispose() { cubeRT.dispose(); out.dispose(); pmrem.dispose(); },
  };
  return probe;
}
