"""Builds scene_tail2.mjs (Part 1 v2) from scene_tail.mjs by exact replacements, then scene2.mjs = scene_head.mjs + scene_tail2.mjs."""
from pathlib import Path
H = Path(__file__).resolve().parent
s = (H / "scene_tail.mjs").read_text()
def rep(a, b, count=1):
    global s
    assert s.count(a) >= 1, "missing: " + a[:70]
    s = s.replace(a, b) if count == 0 else s.replace(a, b, count)

# 1. imports, props, extra DOM ---------------------------------------------------------------------------------------------------------------------------------
rep("const GR = FILM.grav, BALL = GR.ball;", '''import { makeCup, makePedestal, makeStair, makeSkeleton, makeTower, makeCity, makeOcean, makeMountain } from "./glimpses.js";
const GR = FILM.grav, BALL = GR.ball, GLM = GR.glims || [];''')
rep("// ── the dark dip for the pinpoint", '''// ── v2 props: the cup on its pedestal, a 3-step stair, the skeleton beside it, the glimpse set pieces far from the globe, a small city ──
const FAR = { skel: [100, 0, 0], tower: [100, 0, -60], ocean: [100, 0, -120], mount: [100, 0, -180] };
const cup = makeCup(), ped = makePedestal(); scene.add(cup.group, ped.group); cup.group.visible = ped.group.visible = false;
const SPC = GR.step || { x0: 0.12, tread: 0.12, rise: 0.055 };
const stair = makeStair(3, SPC.tread, SPC.rise, 0.3, 0.07); scene.add(stair.group); stair.group.visible = false;
const skelB = makeSkeleton(); scene.add(skelB.group); skelB.group.visible = false;
const skelG = makeSkeleton(); skelG.group.position.set(...FAR.skel); scene.add(skelG.group); skelG.group.visible = false;
const towerG = makeTower(10); towerG.group.position.set(...FAR.tower); scene.add(towerG.group); towerG.group.visible = false;
const oceanG = makeOcean(); oceanG.group.position.set(...FAR.ocean); scene.add(oceanG.group); oceanG.group.visible = false;
const mountG = makeMountain(); mountG.group.position.set(...FAR.mount); scene.add(mountG.group); mountG.group.visible = false;
const city = makeCity(11); scene.add(city.group); city.group.visible = false;
const CITYX = [0.3, 0.42, 0.53, 0.63, -0.3, -0.42, -0.53, -0.63, 0.73, -0.73, 0.2];
const handDummy = new THREE.Object3D(); handDummy.position.set(0, -0.3, 0.04); if (bot) bot.parts.armL.el.add(handDummy);
const GLK = { skel: { scale: 0.58, cy: 0.49, dist: 3.1 }, tower: { scale: 0.62, cy: 0.39, dist: 3.1 }, ocean: { scale: 0.43, cy: -0.085, dist: 3.1 }, mount: { scale: 0.85, cy: 0.38, dist: 3.1 } };
// ── the dark dip for the pinpoint''')
rep('if (FILM.hook) { hookEl.textContent = FILM.hook.text; document.body.appendChild(hookEl); }', '''if (FILM.hook) { hookEl.innerHTML = FILM.hook.text.replace("/", "<br>"); document.body.appendChild(hookEl); }
const badgeEl = document.createElement("div"); badgeEl.style.cssText = "position:absolute;left:50%;bottom:5.5vh;transform:translateX(-50%);z-index:6;pointer-events:none;font:600 2.2vh/1 var(--font-text);letter-spacing:.14em;color:#9ff0c8;background:rgba(8,9,11,.72);padding:1vh 2.6vw;border-radius:3vh;border-left:.5vh solid #EB63FF;opacity:0;white-space:nowrap"; badgeEl.textContent = "Thought experiment"; document.body.appendChild(badgeEl);''')
# the reach pose for the cup (screen-left arm) and where the hand ends up
rep("const kf = (K, t, key)", '''const REACH = { z: 1.0, x: -0.12, e: 0.3 };
let HAND = { x: -0.3, y: 0.3 }; if (bot) { bot.group.position.set(0, 0, 0); bot.group.scale.setScalar(0.26); bot.set({ ...POSES2.stand, armL: REACH }); bot.group.updateMatrixWorld(true); const hp = new THREE.Vector3(); handDummy.getWorldPosition(hp); HAND = { x: hp.x, y: hp.y }; }
const kf = (K, t, key)''')

# 2. pins (the pinpoint teaser and its echo) ----------------------------------------------------------------------------------------------------------------
rep("const PIN = GR.pin || { t0: 1e9, t1: 1e9 };", "const PINS = GR.pins || [[1e9, 1e9]], PIN = { t0: PINS[0][0], t1: PINS[0][1] };")
rep("const pinU = E.inout2(seg(t, PIN.t0, PIN.t0 + (PIN.t1 - PIN.t0) * 0.45)) * (1 - E.inout2(seg(t, PIN.t1 - 0.12, PIN.t1)));", "const pinU = Math.max(...PINS.map(([a, b]) => E.inout2(seg(t, a, a + (b - a) * 0.45)) * (1 - E.inout2(seg(t, b - 0.12, b)))));")

# 3. cameras: a second step pose; glimpses take over the camera --------------------------------------------------------------------------------------------
rep("    step: {", "    city: { pcy: -0.72, c: [0.0 + sw, 0.5 + sh, 4.5], l: [0, 0.25, 0], fov: 34, fs: 0.9 },\n    step2: { pcy: -0.78, c: [0.12 + sw, 0.6 + sh, 3.15], l: [0.1, 0.52, 0], fov: 34, fs: 1.0 },\n    step: {")
rep("  const pcx = 0, pcy = cur.pcy, figS = cur.fs, ysc = figS * 0.26;\n  camera.fov = cur.fov; camera.position.set(cur.c[0] + shake, cur.c[1], cur.c[2]); camera.lookAt(cur.l[0], cur.l[1], cur.l[2]);", '''  const pcx = 0, pcy = cur.pcy, figS = cur.fs, ysc = figS * 0.26;
  camera.fov = cur.fov; camera.position.set(cur.c[0] + shake, cur.c[1], cur.c[2]); camera.lookAt(cur.l[0], cur.l[1], cur.l[2]);
  // a glimpse (about 1 s of the season ahead) takes over the camera, framed to leave the HUD and the label clear
  const gl = GLM.find((q) => t >= q.t0 && t < q.t1), gk = gl ? GLK[gl.kind] : null;
  if (gl) { const PF = FAR[gl.kind], span = 2 * gk.dist * Math.tan(17 * Math.PI / 180), lookY = PF[1] + gk.cy * 1.0 + 0.16 * span, dr = 0.12 * Math.sin(t * 1.3 + gl.t0);
    camera.fov = 34; camera.position.set(PF[0] + dr, lookY + 0.2, PF[2] + gk.dist); camera.lookAt(PF[0], lookY, PF[2]); }''')
rep("planetG.position.set(pcx, pcy, 0); planetG.scale.setScalar(pScale); globe.visible = true;", "planetG.position.set(pcx, pcy, 0); planetG.scale.setScalar(pScale); globe.visible = !gl; planetG.visible = !gl;")

# 4. robot: the cup, the stair steps, the skeleton ---------------------------------------------------------------------------------------------------------
rep("  const rp = keyed1(GR.rpos, t);                                                                  // robot offset [x, y] (the step)", '''  const stX = (i) => SPC.x0 + SPC.tread * (i - 0.5), stBase = groundY(SPC.x0 + 0.05) , stTop = (i) => stBase + SPC.rise * i;
  const rpK = (k) => k.s > 0 ? [stX(k.s), stTop(k.s) - groundY(stX(k.s))] : [k.x || 0, k.y || 0];
  const rp = (() => { const K = GR.rpos, { A, B, u } = kf(K, t, "rp"), a = rpK(A), b = rpK(B), hop = A.s !== B.s ? 0.04 * Math.sin(Math.PI * u) : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + hop]; })();''')
rep("      bot.set(P); bot.group.scale.setScalar(ysc);\n      const bx = pcx + rp[0], by = groundY(rp[0]) - 0.012 * ysc / 0.26 + rp[1] - (P.rise ? P.rise * 0 : 0);\n      bot.group.position.set(bx, by, 0);", '''      // the cup: the screen-left hand lifts it from the pedestal, then the arm dips with its weight (a premonition in line 1, for real at x2)
      const CU = GR.cup, cupOn = CU && t < CU.hide + 0.4 && pScale > 0.9;
      if (CU) { const lift = E.inout2(seg(t, CU.t0 - 0.3, CU.t0 + 0.5)), bump = E.inout2(seg(t, CU.p0, CU.p1)) * (1 - E.inout2(seg(t, CU.p2, CU.p3))), load = G + 0.85 * bump, rel = 1 - E.inout2(seg(t, CU.hide - 0.2, CU.hide + 0.3));
        if (rel > 0.01) P.armL = { z: lerp1(0.16, REACH.z - 0.3 * (load - 1), lift), x: REACH.x * lift, e: lerp1(0, REACH.e + 0.5 * (load - 1), lift) }; }
      bot.set(P); bot.group.scale.setScalar(ysc);
      const bx = pcx + rp[0], by = groundY(rp[0]) - 0.012 * ysc / 0.26 + rp[1] - (P.rise ? P.rise * 0 : 0);
      bot.group.position.set(bx, by, 0); bot.group.updateMatrixWorld(true);
      if (CU) { const k = ysc / 0.26, px = pcx + HAND.x * k, py0 = groundY(HAND.x * k), cupTopY = groundY(0) - 0.012 + HAND.y * k - 0.05; ped.group.visible = cupOn; cup.group.visible = cupOn;
        if (cupOn) { const hw = new THREE.Vector3(); handDummy.getWorldPosition(hw); const take = E.inout2(seg(t, CU.t0 + 0.25, CU.t1)), vs = 1 - E.inout2(seg(t, CU.hide - 0.2, CU.hide + 0.3));
          ped.group.position.set(px, py0, 0); ped.group.scale.set(1, Math.max(0.2, (cupTopY - py0) / ped.top), 1);
          cup.group.position.set(lerp1(px, hw.x, take), lerp1(cupTopY, hw.y - 0.02, take), lerp1(0, hw.z, take)); cup.group.scale.setScalar(Math.max(0.01, vs) * (ysc / 0.26)); cup.group.rotation.z = -0.08 * take * Math.sin(t * 3); ped.group.scale.x = ped.group.scale.z = Math.max(0.01, vs); } }''')
rep("// the ball\n", '''  // the stair (line 5) and the skeleton beside it
  { const SA = GR.stairVis, su = SA ? E.inout2(seg(t, SA.t0, SA.t0 + 0.5)) * (1 - E.inout2(seg(t, SA.t1 - 0.5, SA.t1))) : 0; stair.group.visible = su > 0.01 && pScale > 0.9 && !gl;
    if (stair.group.visible) { stair.group.position.set(pcx + SPC.x0, stBase - 0.0, 0.02); stair.group.scale.set(1, su, 1); }
    const SB = GR.skelB, sb = SB ? E.inout2(seg(t, SB.t0, SB.t0 + 0.5)) * (1 - E.inout2(seg(t, SB.t1 - 0.5, SB.t1))) : 0; skelB.group.visible = sb > 0.01 && pScale > 0.9 && !gl;
    if (skelB.group.visible) { skelB.group.position.set(pcx + SB.x, groundY(SB.x) - 0.005, 0); skelB.group.scale.setScalar(ysc); skelB.update(lerp1(SB.l0, SB.l1, E.inout2(seg(t, SB.tl0, SB.tl1))), sb); } }
  // the ball\n''')
# the old step block is replaced by the stair
a = s.index("  // the step block"); b = s.index("  // the tree: sag")
s = s[:a] + s[b:]
rep("stepBox.visible = stepEdge.visible = su > 0.01", "stepBox.visible = false && su > 0.01") if "stepBox.visible = stepEdge.visible" in s else None

# 5. glimpses and the city ---------------------------------------------------------------------------------------------------------------------------------
rep("  // the HUD\n", '''  // glimpses: one set piece at a time, far from the globe; the main scene's own props hide
  skelG.group.visible = !!gl && gl.kind === "skel"; towerG.group.visible = !!gl && gl.kind === "tower"; oceanG.group.visible = !!gl && gl.kind === "ocean"; mountG.group.visible = !!gl && gl.kind === "mount";
  if (gl) { const u = E.inout2(seg(t, gl.t0 + 0.12, gl.t1 - 0.1)), ld = gl.load ? lerp1(gl.load[0], gl.load[1], u) : 1, sc = gk.scale;
    if (gl.kind === "skel") { skelG.group.scale.setScalar(sc); skelG.update(ld, 1); }
    if (gl.kind === "tower") { towerG.group.scale.setScalar(sc); towerG.update(ld, gl.bow ? lerp1(gl.bow[0], gl.bow[1], u) : 0, t, 1); }
    if (gl.kind === "ocean") { oceanG.group.scale.setScalar(sc); oceanG.update(Math.exp(lerp1(Math.log(gl.load[0]), Math.log(gl.load[1]), u)), t); }
    if (gl.kind === "mount") { const c0 = gl.t0 + 0.1; mountG.group.scale.setScalar(sc); mountG.group.rotation.y = -0.25; mountG.update(seg(t, c0, c0 + 0.35), t, t - (c0 + 0.4)); }
    bot.group.visible = false; ghost.group.visible = false; contact.visible = false; ball.visible = ballGlow.visible = false; ringM.visible = false; pinGlow.visible = false; tree.visible = false; cup.group.visible = ped.group.visible = false; stair.group.visible = skelB.group.visible = false; city.group.visible = false; }
  { const CT = GR.city, cu = CT ? E.inout2(seg(t, CT.t0, CT.t0 + 0.9)) * (1 - E.inout2(seg(t, CT.t1 - 0.2, CT.t1))) : 0; city.group.visible = cu > 0.01 && pScale > 0.9 && !gl;
    if (city.group.visible) city.items.forEach((it, i) => { const x = CITYX[i], g = it.grp, k = E.inout2(clamp01(cu * 1.6 - (i % 5) * 0.14)); g.position.set(pcx + x, groundY(x) - 0.004, 0.02 * (i % 3)); g.rotation.z = -Math.asin(Math.max(-0.95, Math.min(0.95, x / Math.max(0.01, pScale)))); g.scale.set(1.5, Math.max(0.001, k) * 1.5, 1.5); }); }
  // the HUD
''')
rep("const hookA = FILM.hook", "const dipP = Math.max(0, ...(GR.dips || []).map((d) => 1 - Math.abs(t - d) / 0.12)); const hookA = FILM.hook")
rep("dipEl.style.opacity = String((0.42 * pinU).toFixed(3));", "dipEl.style.opacity = String(Math.max(0.42 * pinU, 0.92 * dipP).toFixed(3)); badgeEl.style.opacity = String((E.inout2(seg(t, 0.3, 0.7)) * (1 - E.inout2(seg(t, 4.5, 5.0))) * vis).toFixed(3));")
rep("gd.style.transform =", "gd.style.letterSpacing = txt.length > 7 ? \".012em\" : \"-.02em\"; gd.style.transform =")
rep("const robotOn = pScale > 0.5;", "const robotOn = pScale > 0.5;\n  const lerp1 = (a, b, u) => a + (b - a) * u;")
(H / "scene_tail2.mjs").write_text(s)
(H / "scene2.mjs").write_text((H / "scene_head.mjs").read_text() + "\n" + s)
print("ok", len(s))
