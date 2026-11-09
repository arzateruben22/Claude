// Talking groups (PROJECT_OC_SPORTS_BAR.md, "Conversations and lines": "Lot 57's group state machine carries over
// unchanged"; PROJECT_OC_ON_FOOT.md, "Groups that look like they're talking"). Lot 57's machine lives inside its own
// Crowd (lot57/npcs.ts), bound to its venue, so the bar writes the same rules here, pure (no three.js), for E0 to keep
// one copy of:
//   - one speaker at a time; a turn lasts 1 to 10 s (median about 3.5 s), with 0.2 to 0.8 s pauses;
//   - the next speaker is usually whoever the last one was looking at;
//   - the speaker looks at one listener and moves on every 1.5 to 3 s; listeners look at the speaker;
//   - listeners nod in the pauses (about 6 in 10 of them);
//   - laughter is a group event, about 1.5 a minute (one turn end in eight or so).
// The caller says who of the group is present (at the table or in the circle) at each step; a group with fewer than
// two present is quiet. The murmur is synthesised audio at Lot 57's plan; neither page has audio yet.

export interface TalkGroup {
  id: number; members: number[];
  /** the person speaking (an id) or -1, who spoke last, and who the speaker looks at */
  speaker: number; prev: number; lookAt: number;
  turnT: number; pauseT: number; lookT: number;
  /** turns started (for the hooks) and laughs */
  turns: number; laughs: number;
}
export interface GroupStep { started: number; ended: number; nods: number[]; laugh: boolean }

export function newGroup(id: number, members: number[], r: () => number): TalkGroup {
  return { id, members: [...members], speaker: -1, prev: -1, lookAt: -1, turnT: 0, pauseT: 0.4 + r() * 2, lookT: 0, turns: 0, laughs: 0 };
}
/** a turn's length: log-normal round a 3.5 s median, held to 1 to 10 s */
export function turnLength(r: () => number) {
  let u = 0; while (u <= 1e-9) u = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  return Math.min(10, Math.max(1, 3.5 * Math.exp(0.55 * z)));
}
const EMPTY: GroupStep = { started: -1, ended: -1, nods: [], laugh: false };
/** advance a group by dt seconds; `present` the members there now. Returns what happened (a shared object when
 *  nothing did: don't keep it) */
export function stepGroup(g: TalkGroup, present: number[], dt: number, r: () => number): GroupStep {
  if (present.length < 2) { if (g.speaker >= 0) { g.prev = g.speaker; g.speaker = -1; g.pauseT = 0.5; } return EMPTY; }
  if (g.speaker >= 0 && !present.includes(g.speaker)) { g.prev = g.speaker; g.speaker = -1; g.pauseT = 0.3; }
  if (g.speaker < 0) {
    g.pauseT -= dt; if (g.pauseT > 0) return EMPTY;
    // the next speaker: usually whoever the last one looked at
    let next = g.lookAt >= 0 && present.includes(g.lookAt) && r() < 0.75 ? g.lookAt : present[Math.floor(r() * present.length) % present.length];
    if (next === g.prev && present.length > 1 && r() < 0.7) next = present[(present.indexOf(next) + 1) % present.length];
    g.speaker = next; g.turnT = turnLength(r); g.turns++;
    g.lookAt = present[(present.indexOf(next) + 1 + Math.floor(r() * (present.length - 1))) % present.length];
    g.lookT = 1.5 + r() * 1.5;
    return { started: next, ended: -1, nods: [], laugh: false };
  }
  g.turnT -= dt; g.lookT -= dt;
  if (g.lookT <= 0) { const i = present.indexOf(g.speaker); g.lookAt = present[(i + 1 + Math.floor(r() * (present.length - 1))) % present.length]; g.lookT = 1.5 + r() * 1.5; }
  if (g.turnT > 0) return EMPTY;
  const ended = g.speaker;
  g.prev = ended; g.speaker = -1; g.pauseT = 0.2 + r() * 0.6;
  const nods = present.filter((m) => m !== ended && r() < 0.6);
  const laugh = r() < 0.12;
  if (laugh) g.laughs++;
  return { started: -1, ended, nods, laugh };
}
