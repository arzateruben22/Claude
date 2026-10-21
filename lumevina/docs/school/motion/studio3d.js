// The studio set every solid scene shares (render.mjs puts this right after each scene module's
// three.js import, and turns its `new THREE.BoxGeometry(` into `new SoftBox(`). After the
// reference clips: small blocks with rounded edges, a warm glossy floor that falls off into the
// dark, a warm rim from behind, and a camera that never quite stops (a slow push, a little sway).
// Everything stays a pure function of time: the drift reads M.t, which M.stage(t) sets.

// a box with rounded edges, kept as light as a plain box: 24 shared corners (each face's own
// four, with the face's normal), the six faces, twelve bevel strips between neighbouring faces
// and eight corner triangles. The strips interpolate between the two faces' normals, so the
// bevel shades round.
function SoftBox(w = 1, h = 1, d = 1) {
  const r = Math.min(w, h, d) * 0.2, H = [w / 2, h / 2, d / 2], I = H.map((v) => v - r);
  const pos = [], nor = [], idx = [], key = {};
  const vert = (a, s, signs) => {        // face on axis a with sign s; signs = the corner's signs on all three axes
    const k = a + "" + s + signs.join("");
    if (key[k] !== undefined) return key[k];
    const p = [0, 1, 2].map((ax) => ax === a ? s * H[ax] : signs[ax] * I[ax]), n = [0, 0, 0]; n[a] = s;
    key[k] = pos.length / 3; pos.push(...p); nor.push(...n); return key[k];
  };
  const tri = (i0, i1, i2) => {           // wound outward: the box is convex and centered
    const P = (i) => pos.slice(i * 3, i * 3 + 3);
    const [a, b, c] = [P(i0), P(i1), P(i2)], u = b.map((v, k) => v - a[k]), v = c.map((x, k) => x - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = a.map((x, k) => x + b[k] + c[k]);
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) idx.push(i0, i2, i1); else idx.push(i0, i1, i2);
  };
  const quad = (q) => { tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]); };
  const S = [-1, 1];
  for (let a = 0; a < 3; a++) for (const s of S) {       // the faces
    const [b, c] = [0, 1, 2].filter((x) => x !== a), at = (sb, sc) => { const g = [0, 0, 0]; g[a] = s; g[b] = sb; g[c] = sc; return vert(a, s, g); };
    quad([at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]);
  }
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of S) for (const sb of S) {   // the bevel strips
    const c = 3 - a - b, g = (sc) => { const x = [0, 0, 0]; x[a] = sa; x[b] = sb; x[c] = sc; return x; };
    quad([vert(a, sa, g(-1)), vert(a, sa, g(1)), vert(b, sb, g(1)), vert(b, sb, g(-1))]);
  }
  for (const sx of S) for (const sy of S) for (const sz of S) {   // the corners
    const g = [sx, sy, sz]; tri(vert(0, sx, g), vert(1, sy, g), vert(2, sz, g));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  geo.setIndex(idx); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

// dress the set once, on the first render: the floor, the fog, the rim light
const STUDIO = { dressed: false, center: new THREE.Vector3(), radius: 10, dist: 30 };
// her floor: warm brown with a little gloss, a pool of light under the set, and an edge that
// fades out into the page instead of ending at a horizon line
function floorMaterial(fade) {
  const m = new THREE.MeshStandardMaterial({ color: 0x4a3128, roughness: 0.38, metalness: 0.0, transparent: true });
  m.fog = false;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uC = { value: new THREE.Vector2(STUDIO.center.x, STUDIO.center.z) };
    sh.uniforms.uR = { value: Math.max(12, STUDIO.radius * 1.6) };
    sh.uniforms.uNear = { value: fade.near }; sh.uniforms.uFar = { value: fade.far };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying float vVd;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvVd = -mvPosition.z;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying float vVd;\nuniform vec2 uC;\nuniform float uR, uNear, uFar;")
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.rgb *= mix(1.4, 0.5, smoothstep(0.0, uR, distance(vWp.xz, uC)));\ngl_FragColor.a *= 1.0 - smoothstep(uNear, uFar, vVd);");
  };
  return m;
}
function dressSet(renderer, scene, camera) {
  STUDIO.dressed = true;
  const box = new THREE.Box3(), part = new THREE.Box3();
  const isFloor = (o) => o.isMesh && o.geometry && o.geometry.type === "PlaneGeometry" && Math.abs(o.rotation.x + Math.PI / 2) < 1e-3 && (o.geometry.parameters.width || 0) >= 100;
  let floorY = null; const floors = [];
  scene.traverse((o) => {
    if (isFloor(o)) { floorY = o.position.y; floors.push(o); return; }
    if (o.isMesh && o.visible) { part.setFromObject(o); if (!part.isEmpty() && isFinite(part.min.x)) box.union(part); }
  });
  if (box.isEmpty()) box.set(new THREE.Vector3(-8, 0, -5), new THREE.Vector3(8, 12, 5));
  box.getCenter(STUDIO.center);
  const size = box.getSize(new THREE.Vector3());
  STUDIO.radius = Math.max(4, Math.min(40, Math.hypot(size.x, size.z) / 2));
  STUDIO.dist = Math.max(6, camera.position.distanceTo(STUDIO.center));
  // where the floor fades out: measured from where the camera's gaze meets the floor, so the
  // fade shows as a soft falloff behind the set rather than a line at the horizon
  const look = new THREE.Vector3(); camera.getWorldDirection(look);
  const fy = floorY === null ? box.min.y : floorY;
  const df = look.y < -0.02 ? (camera.position.y - fy) / -look.y : STUDIO.dist;
  const fade = { near: df * 1.2, far: df * 2.8 };
  if (scene.fog) fade.far = Math.min(fade.far, scene.fog.far);
  if (scene.fog) scene.fog.color = new THREE.Color(0x0b0807);
  if (floorY === null) {
    // a scene without a floor gets one, just under its lowest block
    const f = new THREE.Mesh(new THREE.PlaneGeometry(400, 400)); f.rotation.x = -Math.PI / 2; f.position.y = box.min.y - 0.02; scene.add(f); floors.push(f);
  }
  floors.forEach((f) => { f.material = floorMaterial(fade); f.receiveShadow = true; });
  // a warm rim from behind and above, like the light behind the dominoes in the reference
  const rim = new THREE.DirectionalLight(0xffc9a0, 0.9);
  rim.position.set(STUDIO.center.x - STUDIO.dist * 0.5, STUDIO.center.y + STUDIO.dist * 0.6, STUDIO.center.z - STUDIO.dist * 0.9);
  rim.target.position.copy(STUDIO.center); scene.add(rim); scene.add(rim.target);
  // the key light a touch warmer
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) o.color.lerp(new THREE.Color(0xffe2c6), 0.5); });
}

// every render: a slow push in over the clip and a small sway, then the camera goes back
{
  const _render = THREE.WebGLRenderer.prototype.render;
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  THREE.WebGLRenderer.prototype.render = function (scene, camera) {
    if (!scene.isScene || !camera.isPerspectiveCamera) return _render.call(this, scene, camera);
    if (!STUDIO.dressed) dressSet(this, scene, camera);
    const t = (window.M && window.M.t) || 0, dur = (window.SCENE && window.SCENE.dur) || 20;
    pos.copy(camera.position); quat.copy(camera.quaternion);
    const d = camera.position.distanceTo(STUDIO.center);
    camera.matrixWorld.extractBasis(ax, ay, az);
    camera.position.addScaledVector(ax, Math.sin(t * 0.37) * d * 0.016)
      .addScaledVector(ay, Math.sin(t * 0.29 + 1.3) * d * 0.009)
      .addScaledVector(az, -Math.min(1, t / dur) * d * 0.04);
    camera.updateMatrixWorld();
    _render.call(this, scene, camera);
    camera.position.copy(pos); camera.quaternion.copy(quat); camera.updateMatrixWorld();
  };
}
