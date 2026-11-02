// Things to do at Lot 57 (PROJECT_OC_ON_FOOT.md, "What you can do" and "Controls"): the context actions that appear
// when you're in range (Sit and Stand, Order and Pick up, Join and Leave, Drive), the order-and-pick-up beat with a
// held item afterwards, and joining a group's circle. One action button shows the best thing to do where you are;
// a second, smaller one appears when two make sense (Order and Sit at the bar).
//
// Nothing can be done through a wall: every action needs a clear line from you to what it acts on, tested in 2D
// against the walls, fences, gates, glass, doors, trucks, tanks and buildings (the colliders), as well as being in
// range. The test hooks can stretch the ranges (`reach`) to show that the line test, not only the distance, holds.
import * as THREE from 'three';
import type { Player } from './player';
import type { Venue, Seat, CounterSpot } from './venue';
import type { Collider, ColliderSet } from './collide';
import type { Hud } from './hud';
import { Items, ItemId, MENUS, Counter, itemName, isDrink, formOf } from './items';
import { Crowd, Group, Npc, holdPose, placeHeld } from './npcs';
import type { Person } from '../people';

export type ActLabel = 'Pick up' | 'Leave' | 'Stand' | 'Drive' | 'Order' | 'Join' | 'Sit';

const SIGHT = new Set(['wall', 'fence', 'gate', 'glass', 'door', 'building', 'truck', 'tank', 'sign', 'cage', 'generator']);
/** what you can't act through: walls and the like (thin poles and posts don't count, a tank does) */
export const blocksSight = (o: Collider) => SIGHT.has(o.tag) || (o.tall && !(o.k === 'circ' && o.r < 0.5));

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const RANGE = { seat: 1.4, counter: 1.5, join: 2.2, pick: 1.8 };

interface Order {
  c: CounterSpot; menu: Counter; stage: 'choosing' | 'making' | 'ready'; item: ItemId | null; t: number; dur: number; z: number; served: THREE.Group | null; doneT: number;
  /** the staff member has reached the taps or the flat-top and started on it (the 4 to 8 s count from here) */
  started: boolean; waitT: number;
}
interface Held { id: ItemId; fp: THREE.Group; tp: THREE.Group }

export interface DoCtx {
  player: Player; venue: Venue; set: ColliderSet; items: Items; hud: Hud;
  scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  crowd: () => Crowd;
  door: { x: number; z: number };
  /** re-plan the walk grid round the people (after a circle re-spaces) */
  refreshPeople: () => void;
  /** movement and look on or off (while the order sheet is up) */
  inputEnabled: (on: boolean) => void;
  focusView: () => void;
  rand: () => number;
}

export class Doings {
  reach = 1;
  order: Order | null = null;
  held: Held | null = null;
  /** the group you're in, and the one you're walking to join */
  joined: Group | null = null; pending: Group | null = null;
  /** what the buttons offer now and what each acts on */
  readonly avail: [ActLabel | null, ActLabel | null] = [null, null];
  target: { seat: Seat | null; counter: CounterSpot | null; group: Group | null } = { seat: null, counter: null, group: null };
  /** what was done, for the hooks */
  log: string[] = [];
  private staffTalkT: number[] = [];
  private _v = new THREE.Vector3(); private _w = new THREE.Vector3(); private _q = new THREE.Quaternion(); private _ax = new THREE.Vector3();
  private bob = 0;
  /** the order chip as last written (the HUD is touched only when its text or its progress step changes) */
  private chipKind = ''; private chipId: ItemId | null = null; private chipFor: Order | null = null; private chipStep = -1;
  /** how many of the pair available() has filled */
  private availK = 0;

  constructor(private c: DoCtx) {
    c.hud.onOrderPick = (id) => this.pick(id);
    c.hud.onOrderClose = () => this.closeSheet();
    c.hud.onReply = (i) => this.reply(i);
    c.player.onArrive = (g) => {
      if (g.join !== undefined) this.arriveJoin(g.join);
      else if (g.counter) { const cs = this.c.venue.counters.find((k) => k.id === g.counter); if (cs && this.inRange(cs)) this.startOrder(cs); }
    };
  }

  // ------------------------------------------------------------------------------------------ line of sight, range
  /** a clear line from you to (x, z): no wall, fence, glass, door, truck or building between */
  canSee(x: number, z: number, from?: { x: number; z: number }) {
    const p = from ?? this.c.player;
    return this.c.set.ray(p.x, p.z, x, z, blocksSight) >= 1;
  }
  /** the nearest point of a counter's serving edge to you */
  counterPoint(cs: CounterSpot, at?: { x: number; z: number }) { const p = at ?? this.c.player; return { x: cs.x, z: clamp(p.z, cs.z0, cs.z1) }; }
  inRange(cs: CounterSpot, at?: { x: number; z: number }) {
    const p = at ?? this.c.player, q = this.counterPoint(cs, p);
    if ((p.x - cs.x) * cs.side < -0.05) return false;                         // you're on the staff's side of it
    return Math.hypot(p.x - q.x, p.z - q.z) <= RANGE.counter * this.reach && this.canSee(q.x + cs.side * 0.12, q.z, p);
  }
  nearCounter(at?: { x: number; z: number }) { for (const cs of this.c.venue.counters) if (this.inRange(cs, at)) return cs; return null; }
  nearSeat(at?: { x: number; z: number }) {
    const p = at ?? this.c.player;
    let best: Seat | null = null, bd = RANGE.seat * this.reach;
    const taken = this.c.crowd().taken;
    for (const s of this.c.venue.seats) {
      // (not your own, and not one a guest is in or walking to)
      if (this.c.player.seat === s || taken.has(s.id)) continue;
      const d = Math.min(Math.hypot(s.ax - p.x, s.az - p.z), Math.hypot(s.x - p.x, s.z - p.z) + 0.2);
      if (d < bd && this.canSee(s.x, s.z, p)) { bd = d; best = s; }
    }
    return best;
  }
  nearGroup(at?: { x: number; z: number }) {
    const p = at ?? this.c.player;
    let best: Group | null = null, bd = RANGE.join * this.reach;
    for (const g of this.c.crowd().groups) {
      // (standing circles that are all here: a seated group stays at its table, a party walking in isn't one yet)
      if (!g.active || g.seated || !g.ready) continue;
      const d = Math.hypot(p.x - g.cx, p.z - g.cz) - g.r;
      if (d < bd && this.canSee(g.cx, g.cz, p)) { bd = d; best = g; }
    }
    return best;
  }
  canPick(at?: { x: number; z: number }) {
    const o = this.order, p = at ?? this.c.player;
    if (!o || o.stage !== 'ready' || !o.served) return false;
    return Math.hypot(p.x - o.served.position.x, p.z - o.served.position.z) <= RANGE.pick * this.reach && this.canSee(o.served.position.x, o.served.position.z, p);
  }
  private nearCar() { return Math.hypot(this.c.door.x - this.c.player.x, this.c.door.z - this.c.player.z) < 1.8; }

  /** what the buttons offer here (the shared pair, rewritten each call) */
  available(): [ActLabel | null, ActLabel | null] {
    // (called every frame: the pair is written in place, the first two that apply, nothing allocated)
    const P = this.c.player;
    this.avail[0] = null; this.avail[1] = null; this.availK = 0;
    this.target.seat = null; this.target.counter = null; this.target.group = null;
    if (this.canPick()) this.put('Pick up');
    if (this.joined) this.put('Leave');
    else if (P.seat) {
      // seated: Stand first; on a bar stool, Order as the second, smaller button (the bartender comes to you)
      this.put('Stand');
      const cs = this.availK < 2 && P.seat.at === 'bar' && !this.order ? this.nearCounter() : null;
      if (cs) { this.target.counter = cs; this.put('Order'); }
    } else if (this.nearCar()) this.put('Drive');
    else {
      // (with an order waiting elsewhere, Order still shows here: pressing it says where yours is)
      const cs = this.nearCounter();
      if (cs && (!this.order || this.order.c !== cs)) { this.target.counter = cs; this.put('Order'); }
      const g = this.availK < 2 && !this.pending ? this.nearGroup() : null;
      if (g) { this.target.group = g; this.put('Join'); }
      const s = this.availK < 2 ? this.nearSeat() : null;
      if (s) { this.target.seat = s; this.put('Sit'); }
    }
    return this.avail;
  }
  private put(l: ActLabel) { if (this.availK < 2) this.avail[this.availK++] = l; }

  /** do what a button says; returns what was done (for the hooks), or null */
  act(label: ActLabel | null): string | null {
    if (!label) return null;
    const P = this.c.player;
    switch (label) {
      case 'Pick up': return this.pickUp() ? 'pickup' : null;
      case 'Leave': return this.leave() ? 'leave' : null;
      case 'Stand': if (!P.seat) return null; P.stand(); return 'stand';
      case 'Drive': this.c.hud.toast('Lot 57 is on its own page for now. Driving out comes when it joins the game.', 4.5); return 'drive';
      case 'Order': { const cs = this.target.counter ?? this.nearCounter(); return cs && this.startOrder(cs) ? 'order' : null; }
      case 'Join': { const g = this.target.group ?? this.nearGroup(); return g && this.join(g) ? 'join' : null; }
      case 'Sit': { const s = this.target.seat ?? this.nearSeat(); if (!s) return null; P.sit(s); this.c.hud.fadeHint(); return 'sit'; }
    }
    return null;
  }

  // ------------------------------------------------------------------------------------------ ordering
  private staffOf(cs: CounterSpot): Npc | null { return this.c.crowd().staff[this.c.venue.counters.indexOf(cs)] ?? null; }
  private staffSay(cs: CounterSpot, text: string, caption = true) {
    const n = this.staffOf(cs); if (!n) return;
    const s = clamp(1 + text.length * 0.055, 1.3, 4);
    n.speaking = true; n.p.setExpression('talking', 0.7); n.p.say(text, s);
    this.staffTalkT[this.c.venue.counters.indexOf(cs)] = s;
    const P = this.c.player;
    if (caption && Math.hypot(P.x - cs.x, P.z - (cs.z0 + cs.z1) / 2) < 14) this.c.hud.caption(cs.id === 'bar' ? 'Bartender' : 'Cook', text, s + 0.8);
  }
  startOrder(cs: CounterSpot): boolean {
    if (!this.c.crowd().staff.length) return false;
    if (this.order && this.order.stage !== 'choosing') { this.c.hud.toast(this.order.stage === 'ready' ? `Your ${itemName(this.order.item!)} is waiting at ${this.where(this.order.c)}.` : `Your ${itemName(this.order.item!)} is on its way.`, 3); return false; }
    const n = this.staffOf(cs), post = n ? this.c.crowd().post(n) : null;
    const z = clamp(this.c.player.z, post ? post.z0 : cs.z0, post ? post.z1 : cs.z1);
    this.order = { c: cs, menu: MENUS[cs.id], stage: 'choosing', item: null, t: 0, dur: 0, z, served: null, doneT: 0, started: false, waitT: 0 };
    if (n && post) { n.tx = post.x; n.tz = z; n.th = post.face; n.look = this.c.crowd().you; }
    this.c.hud.openOrder(this.order.menu, cs.id === 'bar' ? 'Bartender' : 'Cook');
    this.c.inputEnabled(false);
    this.staffSay(cs, this.order.menu.hello, false);
    this.log.push(`order ${cs.id}`);
    return true;
  }
  private where(cs: CounterSpot) { return cs.id === 'bar' ? 'the bar' : cs.label; }
  /** an item picked on the sheet: the staff make it (4 to 8 s) */
  pick(id: ItemId): boolean {
    const o = this.order; if (!o || o.stage !== 'choosing' || !o.menu.items.some((i) => i.id === id)) return false;
    o.item = id; o.stage = 'making'; o.t = 0; o.dur = 4 + this.c.rand() * 4; o.started = false; o.waitT = 0;
    this.c.hud.closeOrder(); this.c.inputEnabled(true); this.c.focusView();
    const n = this.staffOf(o.c), post = n ? this.c.crowd().post(n) : null;
    if (n && post) { n.tx = post.workX; n.tz = o.z; n.th = post.workFace; n.look = null; }
    this.staffSay(o.c, o.c.id === 'bar' ? 'Coming right up.' : 'You got it.');
    this.log.push(`pick ${id}`);
    return true;
  }
  closeSheet() {
    const o = this.order; if (!o || o.stage !== 'choosing') { this.c.hud.closeOrder(); return; }
    this.c.hud.closeOrder(); this.c.inputEnabled(true); this.c.focusView();
    this.staffSay(o.c, 'No rush.');
    this.goHome(o.c);
    this.order = null;
  }
  private goHome(cs: CounterSpot) { const n = this.staffOf(cs); if (!n) return; const post = this.c.crowd().post(n); n.tx = post.x; n.tz = post.z; n.th = post.face; n.look = null; }
  pickUp(): boolean {
    const o = this.order; if (!o || !this.canPick() || !o.item) return false;
    if (o.served) { o.served.removeFromParent(); }
    this.hold(o.item);
    this.staffSay(o.c, isDrink(o.item) ? 'Cheers.' : 'Enjoy.', false);
    o.doneT = 2.5; o.stage = 'ready'; o.served = null;
    const c = o.c; this.order = null;
    setTimeout(() => { if (!this.order || this.order.c !== c) this.goHome(c); }, 2500);
    this.log.push(`pickup ${o.item}`);
    return true;
  }
  /** hold an item: a copy in the corner of the first-person view, another in your avatar's right hand */
  hold(id: ItemId | null) {
    if (this.held) { this.held.fp.removeFromParent(); this.held.tp.removeFromParent(); this.held = null; }
    if (!id) return;
    const fp = this.c.items.make(id, 'held-first'), tp = this.c.items.make(id, 'held-third');
    // the first-person copy never casts a shadow (it'd darken the view) and draws over nothing it shouldn't
    fp.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = false; m.frustumCulled = false; } });
    this.c.camera.add(fp); this.c.scene.add(tp);
    this.held = { id, fp, tp };
  }

  // ------------------------------------------------------------------------------------------ joining
  join(g: Group): boolean {
    const P = this.c.player, crowd = this.c.crowd();
    if (P.seat) P.stand();
    const s = crowd.slotFor(g, P.x, P.z);
    crowd.join(g, s.a);
    this.c.refreshPeople();
    // (pending before the walk: if you're already on the spot, the arrival comes inside goTo)
    this.pending = g;
    this.log.push(`join ${g.id}`);
    const path = P.goTo(s.x, s.z, { join: g.id });
    if (!path) { this.pending = null; crowd.leave(g); this.c.refreshPeople(); this.c.hud.toast("Can't get to them from here.", 2.5); return false; }
    return true;
  }
  private arriveJoin(id: number) {
    const g = this.c.crowd().groups[id], P = this.c.player;
    if (!g || this.pending !== g) return;
    this.pending = null; this.joined = g;
    // face the middle of the circle
    P.yaw = Math.atan2(g.cx - P.x, g.cz - P.z); P.heading = P.yaw; P.pitch = -0.06;
    this.c.crowd().arrive(g);
  }
  reply(i: 0 | 1): boolean {
    const g = this.joined; if (!g) return false;
    const ok = this.c.crowd().reply(g, i);
    if (ok) this.log.push(`reply ${i}`);
    return ok;
  }
  leave(): boolean {
    const g = this.joined ?? this.pending; if (!g) return false;
    const P = this.c.player, crowd = this.c.crowd();
    crowd.leave(g);
    this.joined = null; this.pending = null;
    this.c.refreshPeople();
    // step back out of the circle: when Leave is pressed standing still, or on the way in to join; already walking
    // somewhere else (a tap on another group, a seat, the ground), you keep going there
    if (!P.path || P.pathGoal?.join === g.id) {
      const a = Math.atan2(P.x - g.cx, P.z - g.cz), d = g.r + 1.1;
      P.goTo(g.cx + Math.sin(a) * d, g.cz + Math.cos(a) * d);
    }
    this.log.push(`leave ${g.id}`);
    return true;
  }
  /** closing time, a rebuilt crowd: drop the order and the circle (you keep what you hold) */
  cancelAll() {
    if (this.order?.served) this.order.served.removeFromParent();
    if (this.order?.stage === 'choosing') { this.c.hud.closeOrder(); this.c.inputEnabled(true); }
    this.order = null;
    if (this.joined || this.pending) { const g = this.joined ?? this.pending!; this.c.crowd().leave(g); this.joined = null; this.pending = null; this.c.refreshPeople(); }
    this.c.hud.replies(null); this.c.hud.caption(null, '');
  }

  // ------------------------------------------------------------------------------------------ the frame
  tick(dt: number) {
    const P = this.c.player;
    // staff mouths: speaking only for the line's length
    for (let i = 0; i < this.staffTalkT.length; i++) {
      const t = this.staffTalkT[i];
      if (t > 0) { this.staffTalkT[i] = t - dt; if (t - dt <= 0) { const n = this.c.crowd().staff[i]; if (n) { n.speaking = false; n.p.setExpression('smile', 0.5); } } }
    }
    // walking to a circle: given up (the stick moved, the path was blocked) means not joining after all
    if (this.pending && !P.path) { const g = this.pending; this.pending = null; this.c.crowd().leave(g); this.c.refreshPeople(); }
    // in a circle and walked off: you've left
    if (this.joined) { const g = this.joined; if (Math.hypot(P.x - g.cx, P.z - g.cz) > g.r + 1.4 || P.seat) this.leave(); }
    const o = this.order;
    if (o && o.stage === 'making') {
      const n = this.staffOf(o.c), post = n ? this.c.crowd().post(n) : null;
      // the 4 to 8 s start once they're at the taps or the flat-top (from the far end of the bar that's a walk of
      // several metres first), so it's never ready on the counter before they're there to make it
      if (!o.started) { o.waitT += dt; if (!n || !post || Math.hypot(n.x - post.workX, n.z - o.z) < 0.5 || o.waitT > 20) o.started = true; }
      if (o.started) o.t += dt;
      if (n && post && o.t > o.dur - 1.4 && n.tx !== post.x) {
        // back to the counter with it in hand
        n.tx = post.x; n.th = post.face; n.look = this.c.crowd().you;
        if (o.item && !n.held) this.c.crowd().hand(n, o.item);
      }
      if (o.t >= o.dur) {
        o.stage = 'ready';
        if (n?.held) { n.held.removeFromParent(); n.held = null; n.hold = null; }
        const item = this.c.items.make(o.item!, 'served');
        // the printed side toward you (the sleeve's print is centred on the item's +x and -x)
        item.position.set(o.c.setX, o.c.setY, o.z); item.rotation.y = o.c.side > 0 ? 0.25 : Math.PI + 0.25;
        this.c.scene.add(item); o.served = item;
        this.staffSay(o.c, o.menu.ready.replace('{item}', itemName(o.item!)));
        if (!this.canPick()) this.c.hud.toast(`Your ${itemName(o.item!)} is ready at ${this.where(o.c)}.`, 3.5);
        this.log.push(`ready ${o.item}`);
      }
    }
    // the chip: what's being made, what's ready, what you hold (rewritten only when it changes: the progress ring in
    // 2% steps)
    if (o && o.stage === 'making' && o.item) this.chip('making', o.item, o, Math.min(50, Math.floor((o.t / o.dur) * 50)));
    else if (o && o.stage === 'ready' && o.item) this.chip('ready', o.item, o, 50);
    else if (this.held) this.chip('hold', this.held.id, null, 50);
    else this.chip('', null, null, -1);
  }
  private chip(kind: '' | 'making' | 'ready' | 'hold', id: ItemId | null, o: Order | null, step: number) {
    // (the text is built only when what it says changes: the stage, the item, the order, or the ring's step)
    if (kind === this.chipKind && id === this.chipId && o === this.chipFor && step === this.chipStep) return;
    this.chipKind = kind; this.chipId = id; this.chipFor = o; this.chipStep = step;
    if (!kind || !id) { this.c.hud.status(null); return; }
    const text = kind === 'making' ? `${o!.menu.making} · ${itemName(id)}` : kind === 'ready' ? `Ready at ${this.where(o!.c)} · ${itemName(id)}` : `Holding · ${itemName(id)}`;
    this.c.hud.status(text, kind, step / 50);
  }

  /** place the held item each frame: the first-person copy in the lower right of the view, with a little sway */
  placeFirst(show: boolean, reduced: boolean, dt: number) {
    const h = this.held; if (!h) return;
    h.fp.visible = show;
    if (!show) return;
    // (farther off in portrait, where the view is narrow and tall, so it stays a corner of the view)
    const cam = this.c.camera, portrait = cam.aspect < 1, d = portrait ? 0.56 : 0.42, hh = d * Math.tan((cam.fov * Math.PI) / 360), hw = hh * cam.aspect;
    const form = formOf(h.id);
    const P = this.c.player, sp = Math.min(1, P.speed / 1.4);
    this.bob += dt * (reduced ? 0 : 1) * (5.5 + 3 * sp);
    const by = reduced ? 0 : Math.sin(this.bob * 2) * 0.004 * sp, bx = reduced ? 0 : Math.sin(this.bob) * 0.003 * sp;
    // a cup stands in the lower right, cut by the edge of the view; food sits a little lower and tips toward you
    const cup = form === 'cup';
    // (in portrait the bottom of the view holds the order chip and the map credit: the item sits just above them)
    const x = portrait ? hw * 0.22 : Math.min(hw * (cup ? 0.5 : 0.42), 0.17), y = -hh * (cup ? (portrait ? 0.56 : 0.82) : (portrait ? 0.56 : 0.74));
    h.fp.position.set(x + bx, y + by - (cup ? 0.06 : 0.0), cup ? -d : -d - 0.06);
    // (a cup turned so its printed sleeve faces you: the print is centred on the item's +x)
    h.fp.rotation.set(cup ? 0.12 : 0.5, cup ? -Math.PI / 2 + 0.3 : -0.35, cup ? 0.04 : 0);
  }
  /** after the avatar's animation: the right hand holds the item (third person, and its shadow in first) */
  poseAvatar(p: Person, heading: number, show: boolean) {
    const h = this.held; if (!h) return;
    holdPose(p, 1, this._q, this._ax);
    h.tp.visible = show;
    if (show) placeHeld(p, h.tp, heading, this._v, this._w);
  }

  /** the hooks' view of an order */
  state() {
    const o = this.order;
    return {
      order: o ? { counter: o.c.id, stage: o.stage, item: o.item, t: +o.t.toFixed(2), dur: +o.dur.toFixed(2), served: o.served ? { x: o.served.position.x, y: o.served.position.y, z: o.served.position.z } : null } : null,
      held: this.held ? { id: this.held.id, name: itemName(this.held.id), first: this.held.fp.visible, third: this.held.tp.visible } : null,
      joined: this.joined ? this.joined.id : null, pending: this.pending ? this.pending.id : null,
      sheet: this.c.hud.orderOpen,
    };
  }
}
