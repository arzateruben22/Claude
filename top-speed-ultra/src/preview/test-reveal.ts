// Test page for the Founder Edition's reveal stage (reveal.ts), full frame: ?t=seconds into it (default the end),
// &kind=reveal|wake, &q=high|phone. Logs the stage's build time and its frame's draw calls and triangles (the whole
// stage: the car, the floor, the table and the room's lights; no shadow pass).
import { makeStage } from './stage';
import { buildReveal, REVEAL_SECONDS } from './reveal';
import { WAKE } from './car-wake';

const q = new URLSearchParams(location.search);
const quality = (q.get('q') ?? 'high') as 'high' | 'phone';
const kind = (q.get('kind') ?? 'reveal') as 'reveal' | 'wake';
const t = Number(q.get('t') ?? REVEAL_SECONDS);
const stage = await makeStage({ stretch: false });
const st = buildReveal(stage.renderer, quality);
const pose = st.pose(t, kind);
WAKE.value = pose.wake;
stage.renderer.toneMappingExposure = pose.exposure;
stage.renderer.shadowMap.enabled = false;
st.camera.aspect = innerWidth / innerHeight; st.camera.updateProjectionMatrix();
const log: Record<string, unknown> = { kind, t, quality, buildMs: st.buildMs, exposure: pose.exposure, wake: pose.wake, band: pose.band };
let info = { calls: 0, tris: 0 };
stage.setRender(() => { stage.renderer.render(st.scene, st.camera); info = { calls: stage.renderer.info.render.calls, tris: stage.renderer.info.render.triangles }; });
await stage.ready(2);
Object.assign(log, info);
console.warn('[reveal] ' + JSON.stringify(log));
