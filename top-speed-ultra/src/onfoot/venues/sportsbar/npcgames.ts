// Guests' games, S3b (PROJECT_OC_SPORTS_BAR.md, "### S3b", "NPC games"; "Smart objects", "Party actions"; "The games:
// pool, darts, shuffleboard", "Games nobody is watching"). A guest who chooses a play advert invites a partner, picked
// by relationship and competitiveness; the partner accepts or not through their own utility (their current action
// against the game's advert, with hysteresis). An accepted Challenge starts a match the same way. With nobody to play,
// darts become solo practice and the others are dropped (ours: the invite is answered at once, two asked at most).
//   - Pool is played on the table's physics (games.ts's PoolSpot, the house's shot selection and aim error for both
//     sides) while the table is on screen or within 15 m of you, and resolved statistically otherwise (a turn of 15 to
//     30 s potting a geometric number of balls); when you come within 15 m or look at it, the balls left are laid out
//     at seeded positions and the physics takes over.
//   - Darts (301, straight out, bust over) and shuffleboard (first to 15) are resolved statistically, each throw's or
//     frame's score drawn from the thrower's skill, on screen too (ours: their pieces aren't drawn for guests' games;
//     the thrower plays the throw or slide clip each turn). Left open for a later phase: guests' darts and shuffleboard
//     on the physics.
// Results: the winner's "Won a game" moodlet, "Lost a close one", and the game as an interaction between the two. No
// tokens for guests and nothing wagered.
import * as THREE from 'three';
import type { Npc, Crowd } from './crowd';
import type { BarLife } from './life';
import type { Social } from './social';
import type { Spot, PoolSpot, NpcSide } from './games';
import type { GameKind } from '../../engine/sim/games';
import { wonGameValue, PLAYED_TOGETHER } from '../../engine/sim/games';
import { GAME_DELTAS } from '../../engine/sim/interactions';
import type { Cand } from '../../engine/sim/autonomy';
import { decide } from '../../engine/sim/autonomy';
import { hash32, mulberry, gauss } from '../../engine/sim/rng';
import type { P2 } from '../../engine/venue-def';

const SECS = 60;
/** within this of a table, or with it on screen within 30 m: its game is on the physics */
const NEAR_M = 15, SEE_M = 30;
export interface Match {
  id: number; spot: string; kind: GameKind; sides: Npc[]; solo: boolean; why: string; t0: number;
  /** darts and shuffleboard: whose turn, the clock to the next turn, 301 left or the points */
  turn: number; statT: number; left: [number, number]; score: [number, number]; frame: number; endsAt: number;
  log: { t: number; side: number; scored: number; note: string; mode: 'stat' | 'physics' }[];
}
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
  /** a spot of a kind free for a new game: nobody's game there (yours, guests', the house's turn) */
  freeFor(kind: GameKind, forYou: boolean): string | null {
    const G = this.G; if (!G) return null;
    for (const s of G.spots) if (s.kind === kind && !s.mine && !s.npcBusy && G.houseAt !== s && !(forYou && false)) return s.id;
    return null;
  }
  /** the match a guest plays in, if any */
  of(n: Npc) { for (const m of this.matches) if (m.sides.includes(n)) return m; return null; }
  /** lining up a shot, a throw or a slide: a guest whose turn it is in a match (or in yours, against you) */
  midTurn(n: Npc) {
    const G = this.G; if (G?.vs && G.vs.id === n.id && G.mine?.turnNow() === 1) return true;
    const m = this.of(n); if (!m) return false;
    const side = m.sides.indexOf(n);
    if (m.kind === 'pool') { const sp = G?.spot(m.spot) as PoolSpot | null; const g = sp?.npc?.game; return !!g && g.turn === side; }
    return m.turn === side;
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
  /** a match between two guests (or a guest's solo darts) on a spot */
  start(kind: GameKind, spotId: string, a: Npc, b: Npc | null, why: string): boolean {
    const G = this.G, sp = G?.spot(spotId); if (!sp || sp.kind !== kind || sp.mine || sp.npcBusy) return false;
    const sides = b ? [a, b] : [a];
    for (const n of sides) { this.social.leave(n, 'a game'); n.act = { action: 'game', object: spotId, slot: null, stage: 'do', t0: this.T, dur: Infinity, continuous: false, tags: ['game'], score: 0, screen: null, why }; }
    const m: Match = { id: this.nextId++, spot: spotId, kind, sides, solo: !b, why, t0: this.T, turn: 0, statT: 4, left: [301, 301], score: [0, 0], frame: 1, endsAt: b ? Infinity : this.T + (3 + 2 * this.r()) * SECS, log: [] };
    if (kind === 'pool' && b) {
      const ok = (sp as PoolSpot).npcBegin([this.side(a), this.side(b)], this.onScreen(sp) ? 'physics' : 'stat', (w, close, note) => this.end(m, w, close, note));
      if (!ok) { for (const n of sides) this.crowd.finish(n, 'no table'); return false; }
    } else { sp.npcOn = true; this.place(m); }
    this.matches.push(m);
    this.push({ t: +this.life.T.toFixed(3), event: 'start', id: m.id, spot: spotId, kind, sides: sides.map((n) => n.key), solo: m.solo, why, mode: kind === 'pool' ? (sp as PoolSpot).npc?.mode ?? null : 'stat' });
    return true;
  }
  /** darts and shuffleboard: the thrower at the oche (the throwing end), the other aside */
  private place(m: Match) {
    const F = this.life.ctxRef.F, sp = this.G.spot(m.spot)!;
    const at = (u: number, v: number): P2 => F.fromFrame(u, v);
    let throwAt: P2, aside: P2, yaw: number, ayaw: number;
    if (m.kind === 'darts') { const u = sp.start[0]; throwAt = at(u, 13.15); aside = at(u + (m.turn ? -0.85 : 0.85), 12.55); yaw = F.yawFromFrame(0, 1); ayaw = yaw; }
    else { throwAt = at(2.75, 1.45); aside = at(m.turn ? 3.6 : 4.5, 2.15); yaw = F.yawFromFrame(1, 0); ayaw = yaw; }
    const thrower = m.sides[m.turn], other = m.sides[1 - m.turn];
    this.crowd.oppFor(thrower).walkTo(throwAt, yaw);
    if (other) this.crowd.oppFor(other).walkTo(aside, ayaw);
  }
  /** once a sim step: pool's physics or statistics as the table is seen (re-checked once a sim second); darts and
   *  shuffleboard turns; a match whose player left stops */
  step(dS: number) {
    this.checkT -= dS; const recheck = this.checkT <= 0; if (recheck) this.checkT = 1;
    for (const m of [...this.matches]) {
      if (m.sides.some((n) => !this.crowd.byKey.has(n.key) || n.mode !== 'live' || n.act?.action !== 'game')) { this.stop(m, 'a player left'); continue; }
      const sp = this.G.spot(m.spot)!;
      if (m.kind === 'pool' && !m.solo) { const ps = sp as PoolSpot; if (recheck && ps.npc) ps.npcMode(this.onScreen(ps) ? 'physics' : 'stat'); continue; }
      if (m.solo && this.T >= m.endsAt) { this.stop(m, 'practice over'); continue; }
      // the players walk to their places first
      if (m.sides.some((n) => !!n.path)) continue;
      m.statT -= dS; if (m.statT > 0) continue;
      if (m.kind === 'darts') this.dartsTurn(m); else this.shuffleFrame(m);
    }
  }
  /** a darts turn: three darts, each scored from the thrower's skill (ours: a mean of 12 + 14 competitive a dart, sd
   *  8); 301, straight out, bust over; 15 to 25 s */
  private dartsTurn(m: Match) {
    const s = m.turn, n = m.sides[s], r = mulberry(hash32('ndarts', m.id, m.log.length));
    let total = 0; for (let k = 0; k < 3; k++) total += Math.max(0, Math.min(60, Math.round(12 + 14 * n.traits.competitive + 8 * gauss(r))));
    let note = '';
    if (m.solo) note = `${total} (practice)`;
    else if (total > m.left[s]) { note = `bust (${total} over ${m.left[s]})`; total = 0; }
    else { m.left[s] -= total; note = `${total}, ${m.left[s]} left`; }
    m.log.push({ t: +this.life.T.toFixed(3), side: s, scored: total, note, mode: 'stat' });
    if (n.p && (n.draw === 'lod1' || n.draw === 'lod2')) this.crowd.play(n, 'dart-throw', 1);
    if (!m.solo && m.left[s] === 0) { this.end(m, s, m.left[1 - s] <= 40, `${n.name} checked out`); return; }
    m.statT = 15 + 10 * r();
    if (!m.solo) { m.turn = 1 - s; this.place(m); }
  }
  /** a shuffleboard frame: four pucks a side; the frame's scorer by skill (competitive plus a draw, sd 0.35), 1 to 4
   *  points (ours); first to 15; 40 to 60 s */
  private shuffleFrame(m: Match) {
    const r = mulberry(hash32('nshuffle', m.id, m.frame)), a = m.sides[0], b = m.sides[1];
    const da = a.traits.competitive + 0.35 * gauss(r), db = b.traits.competitive + 0.35 * gauss(r);
    const w = da >= db ? 0 : 1, pts = 1 + Math.floor(r() * 3) + (r() < 0.15 ? 1 : 0);
    m.score[w] += pts; m.frame++;
    const thrower = m.sides[m.turn];
    m.log.push({ t: +this.life.T.toFixed(3), side: w, scored: pts, note: `frame ${m.frame - 1}: ${m.sides[w].name} ${pts}; ${m.score[0]}-${m.score[1]}`, mode: 'stat' });
    if (thrower.p && (thrower.draw === 'lod1' || thrower.draw === 'lod2')) this.crowd.play(thrower, 'shuffle-slide', 1.3);
    if (m.score[w] >= 15) { this.end(m, w, m.score[1 - w] >= 11, `${m.sides[w].name} reached ${m.score[w]}`); return; }
    m.statT = 40 + 20 * r(); m.turn = 1 - m.turn; this.place(m);
  }
  /** a match's result: the winner's moodlet (scaled by competitive), "Lost a close one", and the game as an interaction
   *  between the two (ours: one pair, so the mean of the plan's +6 and +4, when both are in a good mood) */
  private end(m: Match, w: number, close: boolean, note: string) {
    const i = this.matches.indexOf(m); if (i >= 0) this.matches.splice(i, 1);
    const sp = this.G.spot(m.spot); if (sp && m.kind !== 'pool') sp.npcOn = false;
    const now = this.life.T, win = m.sides[w], lose = m.sides[1 - w];
    win.moodlets.add('won-game', now, wonGameValue(win.traits.competitive));
    if (lose && close) lose.moodlets.add('lost-close', now);
    let delta = 0;
    if (lose) { const good = win.mood >= 45 && lose.mood >= 45; delta = good ? (PLAYED_TOGETHER.winner + PLAYED_TOGETHER.loser) / 2 : 0; this.social.rels.apply(this.social.pid(win), this.social.pid(lose), delta, now, 'game', true, m.kind); }
    for (const n of m.sides) if (n.act?.action === 'game') this.crowd.finish(n, 'game over');
    this.push({ t: +now.toFixed(3), event: 'end', id: m.id, spot: m.spot, kind: m.kind, winner: win.key, loser: lose?.key ?? null, close, note, relDelta: delta, minutes: +((this.T - m.t0) / SECS).toFixed(2), turns: m.log.length });
  }
  /** a match stops without a result (a player left, held or gone; practice over; the bar closed) */
  stop(m: Match, why: string) {
    const i = this.matches.indexOf(m); if (i >= 0) this.matches.splice(i, 1);
    const sp = this.G.spot(m.spot) as Spot | null;
    if (sp) { if (m.kind === 'pool' && !m.solo) (sp as PoolSpot).npcStop(); sp.npcOn = false; }
    for (const n of m.sides) if (n.act?.action === 'game' && this.crowd.byKey.has(n.key)) this.crowd.finish(n, why);
    this.push({ t: +this.life.T.toFixed(3), event: 'stop', id: m.id, spot: m.spot, why });
  }
  drop(n: Npc) { const m = this.of(n); if (m) this.stop(m, 'a player left'); }
  reset() { for (const m of [...this.matches]) this.stop(m, 'reset'); }

  // ------------------------------------------------------------------------------------------------ invites
  /** a guest chose a play advert: invite a partner by relationship and competitiveness (the candidate rule's people,
   *  ranked by friendship + rapport / 2 + 30 competitive, +10 for their favourite game); each of the best two answers
   *  through their own utility (their current action against the game's advert, hysteresis and all) */
  invite(n: Npc, c: Cand) {
    const kind = c.action.slice(5) as GameKind, spot = c.object, sp = this.G?.spot(spot);
    if (!sp || sp.mine || sp.npcBusy || sp.kind !== kind) { this.crowd.finish(n, 'taken'); return; }
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
      const sp = this.G.spot(m.spot) as PoolSpot | null;
      return { id: m.id, spot: m.spot, kind: m.kind, sides: m.sides.map((n) => n.key), solo: m.solo, why: m.why, mode: m.kind === 'pool' && !m.solo ? sp?.npc?.mode ?? null : 'stat', left: m.left, score: m.score, turns: m.log.length, log: m.log.slice(-10), pool: m.kind === 'pool' ? sp?.npcState?.() ?? null : null };
    });
  }
}
