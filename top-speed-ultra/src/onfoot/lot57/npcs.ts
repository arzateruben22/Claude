// The people of Lot 57 for P1b (PROJECT_OC_ON_FOOT.md, "NPCs", "Groups that look like they're talking", "Walkers,
// arrivals and staff", "Talk"): a few groups of regulars standing in talking circles, the bartender in the Shed and
// a cook in each truck. Everyone is built by the people builder (src/onfoot/people, used through its exports only)
// and everyone is fictional: nobody here is a real person or another player. The crowd's size at full scale (40 NPCs,
// arrivals, walkers) is the next milestone; here the groups show while Lot 57 is open (one when it's quiet).
//
// A group is a small state machine. Formation: a circle round a shared centre (a barrel table, or open turf), each
// member facing in. Turns: one speaker at a time, 1 to 10 s (median about 3.5 s), 0.2 to 0.8 s pauses; the next
// speaker is usually whoever the last one was looking at. The speaker talks (the builder's talk gestures and mouth),
// listeners look at the speaker most of the time, glance away now and then, and nod in the pauses. Laughter is a
// group event about 1.5 times a minute. When you join, the circle re-spaces to open a gap where you stand, they turn
// to you, and a short conversation runs (talk.ts): a line, two replies and Leave, an answer, a second exchange, then
// they wrap up and go back to their own conversation with you in the circle.
//
// Staff: the bartender walks along the bar to you when you order, turns to the taps or the back bar to make it (4 to
// 8 s), and sets it on the counter; the cooks do the same at their windows. The page owns the order itself.
import * as THREE from 'three';
import { buildPerson, Person, PersonOptions, randomPerson, LOD_RANGES } from '../people';
import { baseBody, baseLook, defaultFace, HAIR_COLORS } from '../people/params';
import type { Garment } from '../people';
import { Items, ItemId } from './items';
import { Exchange, OPENERS, FOLLOWUPS, WRAPS, LATER, HELLO, NAMES, pick, fill } from './talk';
import { rand } from './geom';

export type Role = 'regular' | 'bartender' | 'cook';
export type PeopleQuality = 'phone' | 'high';

export interface Npc {
  id: number; name: string; role: Role; p: Person;
  x: number; y: number; z: number; heading: number;
  /** where they're going (a slot in the circle, a place along the bar) and which way they'll face there */
  tx: number; tz: number; th: number;
  /** stepping aside for you: an offset that relaxes back */
  ox: number; oz: number;
  hold: ItemId | null; held: THREE.Group | null;
  acc: number; acc0: number; lod: 0 | 1 | 2; shown: boolean; closeUp: boolean;
  speaking: boolean; look: THREE.Vector3 | null;
  /** their own look target (another member's eyes); `look` points at it, at your eyes, or nowhere */
  lv: THREE.Vector3;
  nodT: number; laughT: number; glanceT: number; anim: 'idle' | 'talk' | 'walk' | 'turn' | 'laugh';
  group: Group | null;
}
export interface Group {
  id: number; label: string; cx: number; cz: number; r: number; table: boolean;
  members: Npc[];
  /** each member's angle round the centre now (radians, atan2(dx, dz)) and where they stand when you're not there */
  home: number[];
  speaker: number; turnT: number; pauseT: number; lookAt: number; lookT: number; laughT: number;
  /** your slot's angle when you're in the circle */
  you: number | null;
  talk: Talk | null;
  active: boolean;
  seed: number;
}
/** the short conversation you're in (talk.ts) */
export interface Talk {
  stage: 'hello' | 'line' | 'reply' | 'you' | 'answer' | 'wrap' | 'done';
  t: number; n: number; ex: Exchange | null; by: Npc; choice: number; seed: number;
  /** what's on screen now (for the hooks) */
  caption: { who: string; text: string } | null;
  replies: [string, string] | null;
  log: { who: string; text: string }[];
}

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** a line's reading time, for captions and the mouth */
const readS = (s: string) => clamp(1.0 + s.length * 0.055, 1.4, 5.5);
const BABBLE = ['so we took the long way round and the light was perfect', 'no, listen, that is not what happened', 'okay but the noodles though', 'I told her the left lane is for passing', 'he parked right under the tree again', 'honestly I would go back tomorrow', 'wait, which exit was it', 'we should do this every friday'];

/** what each group holds and where it stands (local metres, coords.ts) */
const GROUPS = [
  { label: 'by the barrel table in the yard', cx: 1.5, cz: -26, r: 0.98, table: true, n: 3, holds: ['pint', 'fizz', 'pint'] as ItemId[], quiet: true },
  { label: 'on the lawn by the bag toss', cx: 36.5, cz: -25.5, r: 0.8, table: false, n: 3, holds: ['jamaica', 'pint', null] as (ItemId | null)[], quiet: false },
];

const TOPS = new Set<Garment['kind']>(['dress', 'tee', 'fitted', 'tank', 'shirt', 'blouse', 'polo']);
const OUTER = new Set<Garment['kind']>(['jacket', 'leather', 'blazer', 'cardigan']);
/** colours a top swaps to when it would read as bare skin (ours, from the builder's night palette) */
const TOP_SWAP = [0x1d2a44, 0x2f4a3a, 0x3a2f4f, 0x0f3550, 0x7a1d24, 0x161616];
/** a tan, beige or brown in the range of skin tones (sRGB hue 12 to 50 degrees, some saturation, not near black or white) */
function skinLike(hex: number) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return false;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h >= 12 && h <= 50 && s >= 0.15 && s <= 0.8 && l >= 0.2 && l <= 0.85;
}
/**
 * The regulars' clothes at patio distance. The people builder's LOD 1 shells (what everyone here is drawn with on Low
 * and High) cut an open neckline (v, scoop, square) and a sleeveless armhole with a ragged edge that shows the skin in
 * patches, so a dress reads as torn; and a tan or beige top reads as bare skin under the warm string lights. Rendered
 * side by side at LOD 1, a crew neck with half sleeves came out clean on a slim and a heavy build. Until those shells
 * close up (a change for the people builder's own session), the regulars' tops and dresses take a crew neck (shirts
 * and polos keep their collars), sleeves to at least the mid upper arm, and a colour that isn't skin; nobody wears
 * heels on the lawn. The builder's own files are unchanged.
 */
export function patioOutfit(o: PersonOptions, lawn: boolean, seed: number): PersonOptions {
  const outfit = o.outfit.map((gm): Garment => {
    if (lawn && gm.kind === 'heels') return { ...gm, kind: 'flats' };
    const top = TOPS.has(gm.kind);
    if (!top && !OUTER.has(gm.kind)) return gm;
    const g: Garment = { ...gm };
    if (top) {
      if (g.kind === 'tank') g.kind = 'fitted';
      if (g.kind !== 'shirt' && g.kind !== 'polo') g.neck = 'crew';
      if ((g.sleeve ?? 0.25) < 0.3) g.sleeve = 0.5;
    }
    if (skinLike(g.color)) g.color = TOP_SWAP[seed % TOP_SWAP.length];
    return g;
  });
  return { ...o, outfit };
}

/** a staff member's outfit: our patina-green top (the aprons are a garment the people builder doesn't make yet) */
function staffPerson(seed: number, f: boolean, top: Garment['kind']): PersonOptions {
  const r = rand(seed);
  const body = { ...baseBody(f ? 'f' : 'm'), age: 24 + Math.round(r() * 22), height: f ? 1.62 + r() * 0.08 : 1.72 + r() * 0.1, fat: 0.3 + r() * 0.25, muscle: 0.4 + r() * 0.2 };
  const look = { ...baseLook(), skin: [0xeac0a4, 0xc99472, 0x9c6545, 0x65402f][Math.floor(r() * 4)], hair: (f ? 'ponytail' : r() < 0.5 ? 'short' : 'buzz') as PersonOptions['look']['hair'], hairColor: [HAIR_COLORS.black, HAIR_COLORS.darkBrown, HAIR_COLORS.brown][Math.floor(r() * 3)] };
  const outfit: Garment[] = [
    { kind: top, color: 0x4f7f6a, fabric: 'cotton', sleeve: top === 'polo' ? 0.25 : 0.22, neck: top === 'polo' ? 'collar' : 'crew' },
    { kind: 'trousers', color: 0x22252a, fabric: 'cotton' },
    { kind: 'sneakers', color: 0x161616, fabric: 'leather', accent: 0xf2f2f0 },
  ];
  return { seed, name: 'staff', body, face: defaultFace(f ? 'f' : 'm'), look, outfit, acc: { hoops: null, studs: null, chain: null, watch: f ? null : 0x161616, bracelet: null, ring: null, bag: 'none', bagColor: 0x111111 } };
}

export interface StaffPost {
  role: 'bartender' | 'cook'; counter: 'bar' | 'tacos' | 'noodles';
  /** where they stand (local metres), the floor height, which way they face to serve, the stretch they can move along (z) */
  x: number; y: number; z: number; face: number; z0: number; z1: number;
  /** where and which way they turn to make an order (the taps, the flat-top) */
  workX: number; workFace: number;
  /** a point on your side of their counter, just clear of it (the view test on Low: a cook stands inside the truck's
   *  collider and the bartender behind the bar, so the line is tested to here, not to them) */
  seeX: number;
}

export class Crowd {
  npcs: Npc[] = []; groups: Group[] = []; staff: Npc[] = [];
  readonly root = new THREE.Group();
  private r = rand(5701);
  private _v = new THREE.Vector3(); private _w = new THREE.Vector3(); private _q = new THREE.Quaternion(); private _ax = new THREE.Vector3();
  private sphere = new THREE.Sphere(); private frustum = new THREE.Frustum(); private pm = new THREE.Matrix4();
  /** the page's callbacks: a caption to show (null clears it), reply chips (null hides them) */
  onCaption: (who: string | null, text: string, seconds: number) => void = () => {};
  onReplies: (r: [string, string] | null) => void = () => {};
  /** your eyes (world), for "they turn to you" */
  you = new THREE.Vector3();
  night = false; car = 'rossini-gt';
  buildMs = 0;
  /** a wall, a truck body or a building between two ground points (the page's 2D line test); on Low, people hidden
   *  behind one aren't drawn (the bartender seen from the street, a cook from behind the truck) */
  occluded: ((ax: number, az: number, bx: number, bz: number) => boolean) | null = null;

  constructor(private items: Items, public quality: PeopleQuality, public ultra: boolean) { this.root.name = 'crowd'; }

  /** build everyone (at load: a person takes about a second on a desktop CPU) */
  build(posts: StaffPost[]) {
    const t0 = performance.now();
    let seed = 300;
    GROUPS.forEach((d, gi) => {
      const g: Group = { id: gi, label: d.label, cx: d.cx, cz: d.cz, r: d.r, table: d.table, members: [], home: [], speaker: -1, turnT: 0, pauseT: 0.5 + gi, lookAt: 0, lookT: 0, laughT: 20 + gi * 13, you: null, talk: null, active: true, seed: 77 + gi * 31 };
      for (let k = 0; k < d.n; k++) {
        // adults on a night out, dressed for the patio (patioOutfit, above)
        const o = patioOutfit(randomPerson(seed), !d.table, seed); seed++;
        const a = (k / d.n) * Math.PI * 2 + gi * 0.7;
        const n = this.add(o, 'regular', NAMES[(gi * 5 + k * 3) % NAMES.length], d.cx + Math.sin(a) * d.r, 0, d.cz + Math.cos(a) * d.r, wrap(a + Math.PI));
        n.group = g; g.members.push(n); g.home.push(a);
        n.hold = d.holds[k] ?? null;
      }
      this.groups.push(g);
    });
    posts.forEach((s, i) => {
      const o = staffPerson(900 + i * 17, i === 1, s.role === 'bartender' ? 'polo' : 'tee');
      const n = this.add(o, s.role, s.role === 'bartender' ? 'Bartender' : 'Cook', s.x, s.y, s.z, s.face);
      n.tx = s.x; n.tz = s.z; n.th = s.face;
      (n as Npc & { post: StaffPost }).post = s;
      this.staff.push(n);
    });
    for (const n of this.npcs) { this.shadows(n); if (n.hold) { n.held = this.items.make(n.hold, `held-${n.id}`); this.root.add(n.held); } }
    this.buildMs = Math.round(performance.now() - t0);
  }
  private add(o: PersonOptions, role: Role, name: string, x: number, y: number, z: number, heading: number): Npc {
    const p = buildPerson({ ...o, quality: this.quality, lod: 1 });
    p.setLod(2); p.setLod(1);                      // both coarse levels now, so nothing is built mid-play
    p.group.position.set(x, y, z); p.group.rotation.y = heading;
    this.root.add(p.group);
    const n: Npc = { id: this.npcs.length, name, role, p, x, y, z, heading, tx: x, tz: z, th: heading, ox: 0, oz: 0, hold: null, held: null, acc: 0, acc0: 0, lod: 1, shown: true, closeUp: false, speaking: false, look: null, lv: new THREE.Vector3(), nodT: 0, laughT: 0, glanceT: 0, anim: 'idle', group: null };
    p.play('idle');
    this.npcs.push(n);
    return n;
  }
  post(n: Npc) { return (n as Npc & { post: StaffPost }).post; }
  dispose() { for (const n of this.npcs) { this.root.remove(n.p.group); n.p.dispose(); } this.npcs = []; this.groups = []; this.staff = []; }

  /** which groups and staff are out: everyone while open, one group when it's quiet, nobody when closed */
  setOpen(open: boolean, quiet: boolean) {
    for (const g of this.groups) { g.active = open && (!quiet || GROUPS[g.id].quiet); if (!g.active) { g.you = null; g.talk = null; } }
    for (const n of this.npcs) { const on = n.group ? n.group.active : open; n.p.group.visible = on; n.shown = on; if (n.held) n.held.visible = on; }
  }

  /** the circles a planner should walk round (members where they'll stand; not your own slot) */
  blockers(out: { x: number; z: number; r: number }[] = []) {
    out.length = 0;
    for (const g of this.groups) if (g.active) for (const m of g.members) out.push({ x: m.tx, z: m.tz, r: 0.28 });
    return out;
  }
  /** the soft bodies you ease past (members where they stand now): written into `out`'s own objects every frame, new
   *  ones only when the count grows */
  soft(out: { x: number; z: number; r: number }[] = []) {
    let k = 0;
    for (const g of this.groups) if (g.active) for (const m of g.members) {
      const o = out[k] ?? (out[k] = { x: 0, z: 0, r: 0.26 });
      o.x = m.x + m.ox; o.z = m.z + m.oz; o.r = 0.26; k++;
    }
    out.length = k;
    return out;
  }

  // ------------------------------------------------------------------------------------------ joining
  /** where you'd stand to join a group from (px, pz): the slot that opens toward you */
  slotFor(g: Group, px: number, pz: number) {
    // you stand a step outside their ring, so the whole circle is in view in first person
    const a = Math.atan2(px - g.cx, pz - g.cz), r = g.r + 0.35;
    return { a, x: g.cx + Math.sin(a) * r, z: g.cz + Math.cos(a) * r };
  }
  /** open a gap at angle a: the members re-space evenly round the rest of the circle, keeping their order */
  join(g: Group, a: number) {
    g.you = a;
    const n = g.members.length, order = g.members.map((m, i) => ({ i, d: ((Math.atan2(m.x - g.cx, m.z - g.cz) - a) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI) })).sort((p, q) => p.d - q.d);
    // keep their order round the circle, turned so the host (the first of the group: the one built up close on
    // Ultra, who speaks first) ends up across from you
    const h = order.findIndex((o) => o.i === 0), mid = Math.floor(n / 2);
    const turned = order.map((_, k) => order[(k + h - mid + n) % n]);
    turned.forEach((o, k) => this.slot(g, g.members[o.i], a + ((k + 1) / (n + 1)) * Math.PI * 2));
    g.speaker = -1; g.pauseT = 99;
    for (const m of g.members) { m.look = this.you; m.p.setExpression('smile', 0.7); m.speaking = false; m.p.play('idle'); }
  }
  private slot(g: Group, m: Npc, a: number) { m.tx = g.cx + Math.sin(a) * g.r; m.tz = g.cz + Math.cos(a) * g.r; m.th = wrap(a + Math.PI); }
  /** you're in your slot: the conversation starts (talk.ts) */
  arrive(g: Group) {
    // the host, across the circle from you, starts (on Ultra, the one built up close)
    const by = g.members[0] ?? this.facing(g);
    g.talk = { stage: 'hello', t: 0.5, n: 0, ex: null, by, choice: -1, seed: g.seed + Math.floor(this.r() * 1000), caption: null, replies: null, log: [] };
  }
  /** the member most nearly across the circle from you (who speaks first) */
  private facing(g: Group) {
    let best = g.members[0], bd = -Infinity;
    for (const m of g.members) { const a = Math.atan2(m.tx - g.cx, m.tz - g.cz), d = Math.abs(wrap(a - (g.you ?? 0))); if (d > bd) { bd = d; best = m; } }
    return best;
  }
  /** your reply (0 or 1) */
  reply(g: Group, i: 0 | 1) {
    const t = g.talk; if (!t || t.stage !== 'reply' || !t.ex) return false;
    t.choice = i; t.stage = 'you'; t.t = readS(t.ex.replies[i]) * 0.8;
    this.say(g, null, t.ex.replies[i], t.t);
    t.replies = null; this.onReplies(null);
    for (const m of g.members) m.look = this.you;
    return true;
  }
  /** you step out: the circle closes up again; mid-conversation, someone says goodbye */
  leave(g: Group) {
    const t = g.talk, bye = !!t && t.stage !== 'done';
    if (bye) this.say(g, t!.by, LATER[t!.seed % LATER.length], 1.6);
    else this.onCaption(null, '', 0);
    // the circle closes up evenly, keeping their order, with the place you stood between two of them (so nobody
    // walks into the spot in front of you as you step back)
    const a = g.you ?? 0, n = g.members.length;
    const order = g.members.map((m, i) => ({ i, d: ((Math.atan2(m.tx - g.cx, m.tz - g.cz) - a) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI) })).sort((p, q) => p.d - q.d);
    order.forEach((o, k) => { const ang = a + ((k + 0.5) / n) * Math.PI * 2; g.home[o.i] = ang; });
    g.talk = null; g.you = null; this.onReplies(null);
    g.members.forEach((m, i) => { this.slot(g, m, g.home[i]); m.look = null; if (!(bye && m === t!.by)) m.p.setExpression('neutral', 1); });
    // their own talk picks up after the goodbye has been said (one speaker at a time)
    g.pauseT = bye ? 2.0 : 1.2; g.speaker = -1;
  }
  /** someone in the circle says a line (or you do: by null); a question waiting for your reply stays on screen */
  private say(g: Group, by: Npc | null, text: string, seconds: number, hold = false) {
    const who = by ? by.name : 'You';
    if (g.talk) { g.talk.caption = { who, text }; g.talk.log.push({ who, text }); }
    this.onCaption(who, text, hold ? 1e9 : seconds + 0.6);
    for (const m of g.members) { m.speaking = m === by; if (m === by) { m.p.play('talk'); m.anim = 'talk'; m.p.setExpression('talking', 0.75); m.p.say(text, seconds); m.look = this.you; } else if (m.anim === 'talk') { m.p.play('idle'); m.anim = 'idle'; m.p.setExpression('smile', 0.5); } }
    if (by) for (const m of g.members) if (m !== by) m.look = by.p.eyes(m.lv);
  }
  private stepTalk(g: Group, dt: number) {
    const t = g.talk!; t.t -= dt;
    if (t.t > 0) return;
    const quietAll = () => { for (const m of g.members) if (m.anim === 'talk') { m.p.play('idle'); m.anim = 'idle'; m.speaking = false; m.p.setExpression('smile', 0.6); } };
    switch (t.stage) {
      case 'hello': { const s = HELLO[t.seed % HELLO.length]; this.say(g, t.by, s, 1.1); t.stage = 'line'; t.t = 1.5; t.ex = pick(OPENERS, this.night, t.seed); break; }
      case 'line': {
        // the opener (or a follow-up, from another member)
        const ex = t.ex!, text = fill(ex.line, this.car), s = readS(text);
        this.say(g, t.by, text, s, true); t.stage = 'reply'; t.t = s; t.replies = ex.replies;
        this.onReplies(ex.replies);
        break;
      }
      case 'reply': quietAll(); for (const m of g.members) m.look = this.you; t.t = 1e9; break;   // waiting for you
      case 'you': {
        const a = t.ex!.answers[t.choice], s = readS(a);
        this.say(g, t.by, a, s); t.stage = 'answer'; t.t = s + 0.4; t.n++;
        // a laugh at the answer, now and then
        if ((t.seed + t.n) % 3 === 0) for (const m of g.members) m.laughT = 0.1 + this.r() * 0.3;
        break;
      }
      case 'answer': {
        quietAll();
        if (t.n < 2) {
          // the second exchange comes from someone else in the circle
          const others = g.members.filter((m) => m !== t.by); t.by = others[(t.seed + t.n) % others.length] ?? t.by;
          t.ex = pick(FOLLOWUPS, this.night, t.seed + t.n * 7); t.stage = 'line'; t.t = 0.7;
        } else { const w = WRAPS[t.seed % WRAPS.length]; this.say(g, t.by, w, readS(w)); t.stage = 'wrap'; t.t = readS(w) + 0.3; }
        break;
      }
      case 'wrap': quietAll(); t.stage = 'done'; t.caption = null; this.onCaption(null, '', 0); g.pauseT = 1.0; g.speaker = -1; for (const m of g.members) m.look = null; break;
      case 'done': break;
    }
  }

  // ------------------------------------------------------------------------------------------ the group's own talk
  private stepGroup(g: Group, dt: number) {
    if (g.talk && g.talk.stage !== 'done') { this.stepTalk(g, dt); return; }
    const M = g.members, n = M.length;
    if (g.speaker < 0) {
      g.pauseT -= dt;
      if (g.pauseT <= 0) {
        // the next speaker: usually whoever the last one looked at
        const next = this.r() < 0.75 ? g.lookAt : Math.floor(this.r() * n);
        g.speaker = next % n;
        const s = M[g.speaker];
        // whoever spoke last (a goodbye, a line to you) has finished
        for (const m of M) if (m !== s && m.speaking) { m.speaking = false; if (m.anim === 'talk') { m.anim = 'idle'; m.p.play('idle'); } }
        // a turn of 1 to 10 s, median about 3.5 s (log-normal)
        const z = Math.sqrt(-2 * Math.log(this.r() + 1e-9)) * Math.cos(2 * Math.PI * this.r());
        g.turnT = clamp(3.5 * Math.exp(0.6 * z), 1, 10);
        s.speaking = true; s.anim = 'talk'; s.p.play('talk'); s.p.setExpression('talking', 0.7);
        s.p.say(BABBLE[Math.floor(this.r() * BABBLE.length)], g.turnT);
        g.lookAt = (g.speaker + 1 + Math.floor(this.r() * (n - 1))) % n; g.lookT = 1.5 + this.r() * 1.5;
        for (const m of M) if (m !== s) { m.p.setExpression(this.r() < 0.5 ? 'listen' : 'smile', 0.5 + this.r() * 0.3); m.glanceT = 2 + this.r() * 4; }
      }
    } else {
      const s = M[g.speaker];
      g.turnT -= dt; g.lookT -= dt;
      if (g.lookT <= 0) { g.lookAt = (g.speaker + 1 + Math.floor(this.r() * (n - 1))) % n; g.lookT = 1.5 + this.r() * 1.5; }
      if (g.turnT <= 0) {
        s.speaking = false; s.anim = 'idle'; s.p.play('idle'); s.p.setExpression('smile', 0.4);
        g.speaker = -1; g.pauseT = 0.2 + this.r() * 0.6;
        // listeners nod in the pause
        for (const m of M) if (m !== s && this.r() < 0.6) m.nodT = 0.6;
        // laughter: a group event, about 1.5 a minute (one turn in eight or so)
        if (this.r() < 0.12) for (const m of M) m.laughT = (m === s ? 0 : 0.1 + this.r() * 0.2);
      }
    }
    // where everyone looks: the speaker at a listener (or at you), listeners at the speaker, with glances
    for (let i = 0; i < n; i++) {
      const m = M[i];
      if (g.speaker === i) { m.look = g.you !== null && g.lookT > 2.6 ? this.you : M[g.lookAt].p.eyes(m.lv); continue; }
      m.glanceT -= dt;
      if (g.speaker >= 0) {
        // a glance away (at another member, or at you when you're in the circle) for about 0.7 s, then back
        if (m.glanceT < 0) { if (m.glanceT < -0.7) m.glanceT = 2 + this.r() * 5; else if (m.glanceT > -dt * 1.5) m.look = g.you !== null ? this.you : M[(i + 1 + Math.floor(this.r() * (n - 1))) % n].p.eyes(m.lv); }
        else m.look = M[g.speaker].p.eyes(m.lv);
      }
    }
  }

  // ------------------------------------------------------------------------------------------ the frame
  /** move, animate and choose levels of detail; `step` is the simulation time to advance */
  update(dt: number, camera: THREE.Camera | null, player: { x: number; z: number }) {
    for (const g of this.groups) if (g.active) this.stepGroup(g, dt);
    // the frustum for culling (the builder's meshes don't cull themselves)
    if (camera) { this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm); }
    const [l0, l1] = LOD_RANGES[this.quality];
    for (const n of this.npcs) {
      if (!n.shown) continue;
      // walking to a slot (little side-steps), stepping aside for you
      const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
      const moving = d > 0.03;
      // (the regulars side-step into a slot at 0.75 m/s; staff walk along the counter at an ordinary 1.2 m/s, the pace
      // the builder's walk cycle is tuned for)
      if (moving) { const k = Math.min(1, ((n.role === 'regular' ? 0.75 : 1.2) * dt) / d); n.x += dx * k; n.z += dz * k; }
      if (n.role === 'regular') {
        const px = player.x - (n.x + n.ox), pz = player.z - (n.z + n.oz), pd = Math.hypot(px, pz);
        const want = pd < 0.62 && n.group?.you === null ? 0.3 : 0;
        const ax = want ? (-px / (pd || 1)) * want : 0, az = want ? (-pz / (pd || 1)) * want : 0;
        n.ox += (ax - n.ox) * Math.min(1, dt * 3); n.oz += (az - n.oz) * Math.min(1, dt * 3);
      }
      // the body turns toward its facing (staff turn to work and back); staff walking face the way they go
      const face = n.role !== 'regular' && d > 0.25 ? Math.atan2(dx, dz) : n.th;
      const dh = wrap(face - n.heading); n.heading += dh * Math.min(1, dt * 5);
      if (n.role !== 'regular') {
        const want = d > 0.25 ? 'walk' : moving || Math.abs(dh) > 0.35 ? 'turn' : n.speaking ? 'talk' : 'idle';
        if (want !== n.anim) { n.anim = want; n.p.play(want); }
      } else if (moving && n.anim !== 'turn' && n.anim !== 'talk') { n.anim = 'turn'; n.p.play('turn'); }
      else if (!moving && n.anim === 'turn') { n.anim = 'idle'; n.p.play('idle'); }
      // laughter
      if (n.laughT > 0) { n.laughT -= dt; if (n.laughT <= 0) { n.p.setExpression('laugh', 1); n.anim = 'laugh'; n.laughT = -1.4; } }
      else if (n.laughT < 0) { n.laughT += dt; if (n.laughT >= 0) { n.laughT = 0; n.p.setExpression('smile', 0.6); n.p.play(n.speaking ? 'talk' : 'idle'); n.anim = n.speaking ? 'talk' : 'idle'; } }
      n.p.group.position.set(n.x + n.ox, n.y, n.z + n.oz); n.p.group.rotation.y = n.heading;
      // cull and choose the level of detail (LOD 0 only for the people built up close on Ultra)
      const cx = n.x - (camera ? camera.position.x : player.x), cz = n.z - (camera ? camera.position.z : player.z), dist = Math.hypot(cx, cz);
      this.sphere.center.set(n.x, n.y + 0.95, n.z); this.sphere.radius = 1.15;
      let inView = !camera || this.frustum.intersectsSphere(this.sphere);
      // (on phones, people with a wall, a building or a truck's body between you and them aren't drawn; staff are tested
      // to their counter's customer side, since they stand inside its collider)
      if (inView && camera && this.quality === 'phone' && this.occluded?.(camera.position.x, camera.position.z, n.role === 'regular' ? n.x : this.post(n).seeX, n.z)) inView = false;
      // (on phones, nobody past 40 m: the plan's flat impostors for the far crowd aren't built yet, and a full body
      // there is about fifteen pixels tall for 1.5k triangles)
      n.p.group.visible = inView && dist < (this.quality === 'phone' ? 40 : 160);
      const lod: 0 | 1 | 2 = n.closeUp && this.ultra && dist < l0 + 0.5 ? 0 : dist < l1 ? 1 : 2;
      if (lod !== n.lod) { n.p.setLod(lod); n.lod = lod; this.shadows(n); }
      // (a drink in hand: on phones only within 15 m, where it's more than a few pixels)
      if (n.held) n.held.visible = n.p.group.visible && (this.quality !== 'phone' || dist < 15);
      // animate: 30 Hz near, 10 Hz to 40 m, 5 Hz beyond (in view only)
      const hz = dist < 15 ? 30 : dist < 40 ? 10 : 5;
      n.acc += dt;
      if (n.p.group.visible && n.acc >= 1 / hz - 1e-4) {
        n.p.lookAt(n.look); n.p.update(n.acc); n.acc0 = n.acc; n.acc = 0;
        this.pose(n, n.acc0);
      }
    }
  }
  /**
   * Ultra: the first of each group gets the builder's close-up body (LOD 0: separate eyes, lashes, teeth, clothes),
   * shown within a few metres, so the person who talks to you when you join is the most detailed one on screen. It
   * takes seconds per person, so the page calls this at load or behind a toast, never mid-conversation.
   */
  buildCloseUps() {
    const t0 = performance.now();
    for (const g of this.groups) { const m = g.members[0]; if (!m || m.closeUp) continue; m.p.setLod(0); m.p.setLod(m.lod); m.closeUp = true; this.shadows(m); }
    return Math.round(performance.now() - t0);
  }
  /** NPC shadows: from the sun's map near you on High and Ultra (LOD 0 and 1), none from LOD 2 (its contact blob) */
  shadows(n: Npc) { n.p.group.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = this.quality === 'high' && n.lod < 2; }); }

  /** after the builder's animation: hold a drink in the right hand, nod; then put the held item in the hand */
  pose(n: Npc, dt: number) {
    const bones = n.p.group;
    // a nod: 8 to 12 degrees at about 2 Hz for 0.6 s
    if (n.nodT > 0) { const head = bones.getObjectByName('head'); if (head) { this._q.setFromAxisAngle(this._ax.set(1, 0, 0), Math.abs(Math.sin((0.6 - n.nodT) * Math.PI * 2)) * 10 * DEG); head.quaternion.multiply(this._q); } n.nodT -= dt; }
    if (!n.held) return;
    holdPose(n.p, n.anim === 'laugh' ? 0.6 : 1, this._q, this._ax);
    placeHeld(n.p, n.held, n.heading, this._v, this._w);
  }

  // ------------------------------------------------------------------------------------------ queries
  /** the regular or staff member a ray from the camera hits first (a capsule round each), within maxT */
  hit(ray: THREE.Ray, maxT: number): { npc: Npc; t: number } | null {
    let best: { npc: Npc; t: number } | null = null;
    for (const n of this.npcs) {
      if (!n.shown || !n.p.group.visible) continue;
      const a = this._v.set(n.x + n.ox, n.y + 0.25, n.z + n.oz), b = this._w.set(n.x + n.ox, n.y + 1.7, n.z + n.oz);
      const t = rayCapsule(ray, a, b, 0.32);
      if (t !== null && t < maxT && (!best || t < best.t)) best = { npc: n, t };
    }
    return best;
  }
  stats() {
    const act = this.npcs.filter((n) => n.shown);
    let tris = 0, calls = 0;
    for (const n of act) if (n.p.group.visible) { const s = n.p.stats(); tris += s.tris; calls += s.calls; }
    return { npcs: act.length, groups: this.groups.filter((g) => g.active).length, staff: this.staff.filter((n) => n.shown).length, drawn: act.filter((n) => n.p.group.visible).length, tris, calls, buildMs: this.buildMs };
  }
}

/**
 * Hold something in the right hand: the forearm comes up to about waist height, steady (it stops swinging with the
 * walk and the talk gestures on that side). Rotations are about the bones' rest-frame axes, after the builder's
 * animation has written them (the builder's own files are unchanged).
 */
export function holdPose(p: Person, k: number, q: THREE.Quaternion, ax: THREE.Vector3) {
  const arm = p.group.getObjectByName('armR'), fore = p.group.getObjectByName('foreR'), hand = p.group.getObjectByName('handR');
  if (!arm || !fore || !hand) return;
  const body = p.options.body, a = p.rig.armAngle;
  const heavy = clamp((body.fat - 0.55) / 0.45, 0, 1), out = (7 + 11 * heavy + 6 * clamp(body.muscle - 0.6, 0, 1)) * DEG;
  const lower = a - out;
  // the upper arm: lowered from the rest pose as the builder's stance does, a little forward, turned in (so the bent
  // forearm comes across in front of the hip); the elbow bent about 80 degrees; the wrist straight
  _t.setFromAxisAngle(ax.set(0, 0, 1), lower * 0.8).multiply(q.setFromAxisAngle(ax.set(1, 0, 0), -14 * DEG)).multiply(q.setFromAxisAngle(ax.set(0, 1, 0), 18 * DEG));
  arm.quaternion.slerp(_t, k);
  _t.setFromAxisAngle(ax.set(Math.cos(a), -Math.sin(a), 0), -80 * DEG);
  fore.quaternion.slerp(_t, k);
  hand.quaternion.slerp(q.set(0, 0, 0, 1), k);
}
/** put a held item in the right hand: between the wrist and the fingers, upright, facing the way the body faces */
export function placeHeld(p: Person, item: THREE.Object3D, heading: number, v: THREE.Vector3, w: THREE.Vector3) {
  const hand = p.group.getObjectByName('handR'), fing = p.group.getObjectByName('fingR');
  if (!hand || !fing) return;
  p.group.updateMatrixWorld(true);
  hand.getWorldPosition(v); fing.getWorldPosition(w);
  const cupish = !HELD_LOW.has(item.userData.item as ItemId);
  v.lerp(w, 0.55);
  // into the palm (toward the body's midline and a little forward), the base below the grip
  const fx = Math.sin(heading), fz = Math.cos(heading), lx = Math.cos(heading), lz = -Math.sin(heading);
  item.position.set(v.x + fx * 0.025 + lx * 0.035, v.y - (cupish ? 0.07 : 0.035), v.z + fz * 0.025 + lz * 0.035);
  item.rotation.set(0, heading, 0);
}

const _t = new THREE.Quaternion();
/** food held low in the palm (a boat, a box, a bowl); everything else is held as a cup */
const HELD_LOW = new Set<ItemId>(['pretzel', 'birria', 'asada', 'dumplings', 'garlic', 'cukes']);
/** the first hit of a ray on a vertical capsule (a to b, radius r), or null */
function rayCapsule(ray: THREE.Ray, a: THREE.Vector3, b: THREE.Vector3, r: number): number | null {
  // closest approach between the ray and the segment, then a sphere test there
  const d = ray.direction, o = ray.origin;
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const wx = o.x - a.x, wy = o.y - a.y, wz = o.z - a.z;
  const A = d.x * d.x + d.y * d.y + d.z * d.z, B = d.x * ux + d.y * uy + d.z * uz, C = ux * ux + uy * uy + uz * uz;
  const D = d.x * wx + d.y * wy + d.z * wz, E = ux * wx + uy * wy + uz * wz, den = A * C - B * B;
  let s = den > 1e-9 ? (B * E - C * D) / den : 0, u = den > 1e-9 ? (A * E - B * D) / den : 0;
  u = clamp(u, 0, 1); s = Math.max(0, (B * u - D) / A);
  const px = o.x + d.x * s - (a.x + ux * u), py = o.y + d.y * s - (a.y + uy * u), pz = o.z + d.z * s - (a.z + uz * u);
  const dist = Math.hypot(px, py, pz);
  if (dist > r) return null;
  return Math.max(0, s - Math.sqrt(r * r - dist * dist));
}
