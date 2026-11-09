// Guests' games, S3b (PROJECT_OC_SPORTS_BAR.md, "### S3b", "NPC games"; "Smart objects", "Party actions"; "The games:
// pool, darts, shuffleboard", "Games nobody is watching"). A guest who chooses a play advert invites a partner, picked
// by relationship and competitiveness; the partner accepts or not through their own utility (their current action
// against the game's advert, with hysteresis). An accepted Challenge starts a match the same way. With nobody to play,
// darts become solo practice and the others are dropped (ours: the invite is answered at once, two asked at most).
//   - Pool is played on the table's physics (games.ts's PoolSpot, the house's shot selection and aim error for both
//     sides) while the table is on screen or within 15 m of you, and resolved statistically otherwise (a turn of 15 to
//     30 s potting a geometric number of balls); when you come within 15 m or look at it, the balls left are laid out
//     at seeded positions and the physics takes over.
//   - Darts (301, straight out, bust over) and shuffleboard (first to 15) are played the same way: on the spot's physics
//     while it's on screen or within 15 m (games.ts's DartsSpot and ShuffleSpot: the house's throw model with each
//     side's competitiveness, darts and pucks drawn as instances of the item meshes), and statistically otherwise (each
//     turn's or frame's score drawn from the thrower's skill); the mode changes only between turns (darts) or frames
//     (shuffleboard).
//   - Spots kept for you (ours, for open item O36): guests never take the last free pool table or the last free
//     dartboard (a game of that kind you're playing counts as yours), so on a busy night one of each stays open; and a
//     spot you tapped while guests were on it is yours next (nobody else starts there when their match ends, for 2 sim
//     minutes).
// Results: the winner's "Won a game" moodlet, "Lost a close one", and the game as an interaction between the two. No
// tokens for guests and nothing wagered.
import * as THREE from 'three';
import type { Npc, Crowd } from './crowd';
import type { BarLife } from './life';
import type { Social } from './social';
import type { Spot, PoolSpot, NpcSide, NpcThrows } from './games';
import type { GameKind } from '../../engine/sim/games';
import { wonGameValue, PLAYED_TOGETHER } from '../../engine/sim/games';
import { GAME_DELTAS } from '../../engine/sim/interactions';
import type { Cand } from '../../engine/sim/autonomy';
import { decide } from '../../engine/sim/autonomy';
import { hash32, mulberry } from '../../engine/sim/rng';

const SECS = 60;
/** within this of a table, or with it on screen within 30 m: its game is on the physics */
const NEAR_M = 15, SEE_M = 30;
export interface Match {
  id: number; spot: string; kind: GameKind; sides: Npc[]; solo: boolean; why: string; t0: number;
  /** solo darts practice ends at this sim second */
  endsAt: number;
}
/** what a darts or shuffleboard spot offers a guests' match (games.ts) */
interface ThrowSpot { npcBegin(sides: NpcSide[], mode: 'physics' | 'stat', onEnd: NpcThrows['onEnd']): boolean; npcMode(mode: 'physics' | 'stat'): void; npcStop(): void; npcState(): Record<string, unknown> | null; npc: NpcThrows | null; npcGame: { turn: number } | null }
export class NpcGames {
  matches: Match[] = [];
  log: Record<string, unknown>[] = [];
  private nextId = 1; private checkT = 0;
  private r = mulberry(hash32('npcgames', 1));
  private fr = new THREE.Frustum(); private pm = new THREE.Matrix4(); private pt = new THREE.Vector3();
  constructor(private social: Social, private crowd: Crowd, private life: BarLife) {}
  private get G() { return this.life.games; }
  private get T() { return this.life.T * SECS; }
  private push(x: Record<string, unknown>) { this.log.push(x); if (this.log.length > 400) this.log.shift(); }
  /** the spot you're next for (you tapped it while guests played there): nobody else starts there until `until` (sim s;
   *  Infinity while their match is on, then 2 sim minutes) */
  nextFor: { spot: string; until: number } | null = null;
  /** a spot of a kind free for a new game: nobody's game there (yours, guests', the house's turn); for guests, also one
   *  they may take (spotsKept) */
  freeFor(kind: GameKind, forYou: boolean): string | null {
    const G = this.G; if (!G) return null;
    for (const s of G.spots) if (s.kind === kind && this.open(s) && (forYou || this.guestMay(s))) return s.id;
    return null;
  }
  private open(s: Spot) { return !s.mine && !s.npcBusy && this.G.houseAt !== s; }
  private heldForYou(s: Spot) { const h = this.nextFor; return !!h && h.spot === s.id && this.T < h.until; }
  /** guests may start on a spot unless you're next for it, or it's the last free pool table or the last free dartboard
   *  (one of each kept for you while you're here; your own game of that kind counts) */
  guestMay(s: Spot) {
    if (this.heldForYou(s)) return false;
    if (s.kind === 'shuffleboard') return true;
    for (const o of this.G.spots) if (o !== s && o.kind === s.kind && (o.mine || this.open(o))) return true;
    return false;
  }
  /** you tapped a spot guests are playing on: you're next there (nobody else starts when their match ends) */
  queueYou(spot: string) {
    const sp = this.G.spot(spot); if (!sp || !sp.npcBusy) return false;
    const was = this.nextFor?.spot === spot;
    this.nextFor = { spot, until: Infinity };
    this.push({ t: +this.life.T.toFixed(3), event: 'next', spot, again: was });
    return true;
  }
  /** you chose to play at a free spot: it's held for you while you walk there (nobody else starts there), up to `s` sim
   *  seconds or until your game begins */
  holdYou(spot: string, s: number) { const sp = this.G.spot(spot); if (!sp || sp.npcBusy) return false; this.nextFor = { spot, until: this.T + s }; return true; }
  /** the spots now: yours, guests', the house's, free for you, and free for guests (the busy-night probe) */
  spotsReport() {
    return this.G.spots.map((s) => ({ id: s.id, kind: s.kind, mine: s.mine, guests: s.npcBusy, freeForYou: this.open(s), guestsMay: this.open(s) && this.guestMay(s), next: this.heldForYou(s) }));
  }
  /** the match a guest plays in, if any */
  of(n: Npc) { for (const m of this.matches) if (m.sides.includes(n)) return m; return null; }
  /** lining up a shot, a throw or a slide: a guest whose turn it is in a match (or in yours, against you) */
  midTurn(n: Npc) {
    const G = this.G; if (G?.vs && G.vs.id === n.id && G.mine?.turnNow() === 1) return true;
    const m = this.of(n); if (!m) return false;
    const side = m.sides.indexOf(n);
    if (m.kind === 'pool') { const sp = G?.spot(m.spot) as PoolSpot | null; const g = sp?.npc?.game; return !!g && g.turn === side; }
    const ts = G?.spot(m.spot) as unknown as ThrowSpot | null, g = ts?.npcGame;
    return !!g && (m.solo || g.turn === side);
  }
  /** the table on screen (in the camera's view within 30 m) or you within 15 m of it */
  onScreen(sp: Spot) {
    const c = this.life.ctxRef, pl = c.player, [x, z] = sp.startW;
    if (Math.hypot(pl.x - x, pl.z - z) < NEAR_M) return true;
    const cam = c.camera; if (Math.hypot(cam.position.x - x, cam.position.z - z) > SEE_M) return false;
    cam.updateMatrixWorld(); this.pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this.fr.setFromProjectionMatrix(this.pm);
    return this.fr.containsPoint(this.pt.set(x, 1, z));
  }
  private side(n: Npc): NpcSide { return { opp: this.crowd.oppFor(n), name: n.name, competitive: n.traits.competitive }; }
  /** a match between two guests (or a guest's solo darts) on a spot; `test` (a check's setup) may use a spot kept for
   *  you */
  start(kind: GameKind, spotId: string, a: Npc, b: Npc | null, why: string): boolean {
    const G = this.G, sp = G?.spot(spotId); if (!sp || sp.kind !== kind || sp.mine || sp.npcBusy) return false;
    if (why !== 'test' && !this.guestMay(sp)) return false;
    if (!b && kind !== 'darts') return false;
    const sides = b ? [a, b] : [a];
    for (const n of sides) { this.social.leave(n, 'a game'); n.act = { action: 'game', object: spotId, slot: null, stage: 'do', t0: this.T, dur: Infinity, continuous: false, tags: ['game'], score: 0, screen: null, why }; }
    const m: Match = { id: this.nextId++, spot: spotId, kind, sides, solo: !b, why, t0: this.T, endsAt: b ? Infinity : this.T + (3 + 2 * this.r()) * SECS };
    const mode = this.onScreen(sp) ? 'physics' : 'stat', onEnd = (w: number, close: boolean, note: string) => this.end(m, w, close, note);
    const ok = kind === 'pool' ? (sp as PoolSpot).npcBegin([this.side(a), this.side(b!)], mode, onEnd) : (sp as unknown as ThrowSpot).npcBegin(sides.map((n) => this.side(n)), mode, onEnd);
    if (!ok) { for (const n of sides) this.crowd.finish(n, 'no table'); return false; }
    this.matches.push(m);
    this.push({ t: +this.life.T.toFixed(3), event: 'start', id: m.id, spot: spotId, kind, sides: sides.map((n) => n.key), solo: m.solo, why, mode });
    return true;
  }
  /** once a sim step: each match's physics or statistics as its spot is seen (re-checked once a sim second); a match
   *  whose player left stops; practice ends; your hold on a spot runs out 2 sim minutes after it frees */
  step(dS: number) {
    this.checkT -= dS; const recheck = this.checkT <= 0; if (recheck) this.checkT = 1;
    for (let i = this.matches.length - 1; i >= 0; i--) {
      const m = this.matches[i]; if (!m) continue;
      let gone = false; for (const n of m.sides) if (!this.crowd.byKey.has(n.key) || n.mode !== 'live' || n.act?.action !== 'game') { gone = true; break; }
      if (gone) { this.stop(m, 'a player left'); continue; }
      if (m.solo && this.T >= m.endsAt) { this.stop(m, 'practice over'); continue; }
      if (!recheck) continue;
      const sp = this.G.spot(m.spot)!, mode = this.onScreen(sp) ? 'physics' : 'stat';
      if (m.kind === 'pool') { const ps = sp as PoolSpot; if (ps.npc) ps.npcMode(mode); }
      else (sp as unknown as ThrowSpot).npcMode(mode);
    }
    const h = this.nextFor;
    if (h && this.T >= h.until) this.nextFor = null;
    if (h && h.until === Infinity) { const sp = this.G.spot(h.spot); if (sp && !sp.npcBusy) this.freed(sp); }
    if (h && this.G.mine) this.nextFor = null;
  }
  /** the spot you're next for is free: 2 sim minutes to come and play */
  private freed(sp: Spot) {
    this.nextFor = { spot: sp.id, until: this.T + 2 * SECS };
    this.life.tell(`${sp.label} is free: you're up`, 3.5);
    this.push({ t: +this.life.T.toFixed(3), event: 'freed for you', spot: sp.id });
  }
  /** a match's result: the winner's moodlet (scaled by competitive), "Lost a close one", and the game as an interaction
   *  between the two (ours: one pair, so the mean of the plan's +6 and +4, when both are in a good mood) */
  private end(m: Match, w: number, close: boolean, note: string) {
    const i = this.matches.indexOf(m); if (i >= 0) this.matches.splice(i, 1);
    const now = this.life.T, win = m.sides[w], lose = m.sides[1 - w];
    win.moodlets.add('won-game', now, wonGameValue(win.traits.competitive));
    if (lose && close) lose.moodlets.add('lost-close', now);
    let delta = 0;
    if (lose) { const good = win.mood >= 45 && lose.mood >= 45; delta = good ? (PLAYED_TOGETHER.winner + PLAYED_TOGETHER.loser) / 2 : 0; this.social.rels.apply(this.social.pid(win), this.social.pid(lose), delta, now, 'game', true, m.kind); }
    for (const n of m.sides) if (n.act?.action === 'game') this.crowd.finish(n, 'game over');
    this.push({ t: +now.toFixed(3), event: 'end', id: m.id, spot: m.spot, kind: m.kind, winner: win.key, loser: lose?.key ?? null, close, note, relDelta: delta, minutes: +((this.T - m.t0) / SECS).toFixed(2) });
  }
  /** a match stops without a result (a player left, held or gone; practice over; the bar closed) */
  stop(m: Match, why: string) {
    const i = this.matches.indexOf(m); if (i >= 0) this.matches.splice(i, 1);
    const sp = this.G.spot(m.spot) as Spot | null;
    if (sp) { if (m.kind === 'pool') (sp as PoolSpot).npcStop(); else (sp as unknown as ThrowSpot).npcStop(); sp.npcOn = false; }
    for (const n of m.sides) if (n.act?.action === 'game' && this.crowd.byKey.has(n.key)) this.crowd.finish(n, why);
    this.push({ t: +this.life.T.toFixed(3), event: 'stop', id: m.id, spot: m.spot, why });
  }
  drop(n: Npc) { const m = this.of(n); if (m) this.stop(m, 'a player left'); }
  reset() { for (const m of [...this.matches]) this.stop(m, 'reset'); this.nextFor = null; }

  // ------------------------------------------------------------------------------------------------ invites
  /** a guest chose a play advert: invite a partner by relationship and competitiveness (the candidate rule's people,
   *  ranked by friendship + rapport / 2 + 30 competitive, +10 for their favourite game); each of the best two answers
   *  through their own utility (their current action against the game's advert, hysteresis and all) */
  invite(n: Npc, c: Cand) {
    const kind = c.action.slice(5) as GameKind, spot = c.object, sp = this.G?.spot(spot);
    if (!sp || sp.mine || sp.npcBusy || sp.kind !== kind || !this.guestMay(sp)) { this.crowd.finish(n, 'taken'); return; }
    const me = this.social.pid(n);
    const ranked = this.social.candidates(n).filter((t) => t.act?.action !== 'game' && t.act?.action !== 'interact' && !t.path).map((t) => {
      const r = this.social.rels.get(me, this.social.pid(t));
      return { t, s: (r?.friendship ?? 0) + 0.5 * (r?.rapport ?? 0) + 30 * t.traits.competitive + (t.favourites.game === kind ? 10 : 0) };
    }).sort((a, b) => b.s - a.s).slice(0, 2);
    const asked: Record<string, unknown>[] = [];
    for (const { t, s } of ranked) {
      const [sx, sz] = sp.startW;
      const inv: Cand = { key: `invite:${spot}`, action: c.action, object: spot, slot: null, deltas: { ...GAME_DELTAS[kind] }, tags: ['game'], walk: Math.hypot(t.x - sx, t.z - sz) * 1.3, occupancy: 0, wait: 0, favourite: t.favourites.game === kind };
      const cur = this.crowd.currentCand(t);
      const d = decide(cur ? [cur, inv] : [inv], { needs: t.needs, traits: t.traits, emotion: t.emotion }, mulberry(hash32('invite', n.id, t.id, Math.floor(this.T))));
      const yes = !!d.chosen && d.chosen.c === inv;
      asked.push({ who: t.key, rank: +s.toFixed(2), invite: +(d.top.find((x) => x.c === inv)?.score ?? NaN).toFixed(2), current: cur ? +(d.top.find((x) => x.c === cur)?.score ?? NaN).toFixed(2) : null, yes });
      if (yes) {
        this.push({ t: +this.life.T.toFixed(3), event: 'invite', from: n.key, kind, spot, asked, accepted: t.key });
        this.social.rels.apply(me, this.social.pid(t), 0, this.life.T, 'challenge', true, kind);
        if (this.start(kind, spot, n, t, 'invite')) return;
        break;
      }
    }
    if (kind === 'darts' && !asked.some((a) => a.yes)) { this.push({ t: +this.life.T.toFixed(3), event: 'invite', from: n.key, kind, spot, asked, accepted: null, solo: true }); if (this.start(kind, spot, n, null, 'solo practice')) return; }
    if (!asked.some((a) => a.yes)) this.push({ t: +this.life.T.toFixed(3), event: 'invite', from: n.key, kind, spot, asked, accepted: null, dropped: true });
    this.crowd.finish(n, 'no partner');
  }
  report() {
    return this.matches.map((m) => {
      const sp = this.G.spot(m.spot);
      const st = m.kind === 'pool' ? (sp as PoolSpot | null)?.npcState() ?? null : (sp as unknown as ThrowSpot | null)?.npcState() ?? null;
      return { id: m.id, spot: m.spot, kind: m.kind, sides: m.sides.map((n) => n.key), solo: m.solo, why: m.why, mode: (st?.mode as string) ?? null, state: st };
    });
  }
}
