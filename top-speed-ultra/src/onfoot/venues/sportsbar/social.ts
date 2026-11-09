// Stoppage Time's people with each other, S3b (PROJECT_OC_SPORTS_BAR.md, "### S3b: interactions, relationships and
// conversations"; "Interacting with people", "Relationships and memory", "NPC autonomy" ("People advertise like
// objects"), "Conversations and lines"). The engine parts are pure and live in engine/sim/ (relations.ts, the pairs'
// numbers and memory; interactions.ts, the 11 interactions' table, acceptance and expected deltas; groups.ts, the
// talking groups; lines.ts, the lines). This file turns them on for the bar:
//   - people advertise: each guest's decision scores the interactions the people near them (at most 8, friends first)
//     offer, with the expected deltas, beside the objects' adverts (crowd.ts calls personAdverts);
//   - the 11 interactions for guests and for you, as beats: walk up and face each other, a 2 to 4 s clip, a caption
//     line, and a lime "+" spark or a coral "–" puff over the head, drawn in the HUD layer (no draw calls);
//   - talking groups of 2 to 6 across parties: an accepted Talk or a Join puts both in one group (the circle or the
//     table makes room); goodbyes, wrap-ups and decisions elsewhere take people out; a group left with one ends;
//   - rounds (yours for house tokens, and guests' own rule), introductions, challenges (npcgames.ts for guests'
//     matches), people's cards, "People here", and the regulars' friendships kept on the device.
// Everyone here is simulated; nobody is a real person or another player. Nothing is live and nothing costs money: a
// round costs house tokens, which can't be bought and have no cash value.
import * as THREE from 'three';
import type { Npc, Crowd, Act, Party } from './crowd';
import type { BarLife } from './life';
import { Relations, levelOf, gettingAlong, Rel, PersonId, SavedRel } from '../../engine/sim/relations';
import { KINDS, Kind, TABLE, acceptP, expected, contextTerm, memoryTerm, introStart, ROUND, Context } from '../../engine/sim/interactions';
import { newGroup, stepGroup, TalkGroup, addMember, removeMember, GROUP_MAX } from '../../engine/sim/groups';
import { pickFor, pickLine, LineKind } from '../../engine/sim/lines';
import { multipliers, NEEDS, bump, Needs, Moodlets } from '../../engine/sim/needs';
import { score, Cand } from '../../engine/sim/autonomy';
import { hash32, mulberry } from '../../engine/sim/rng';
import { teamByAbbr } from '../../engine/sim/leagues';
import { wonGameValue, GameKind, PLAYED_TOGETHER } from '../../engine/sim/games';
import type { TvEvent } from '../../engine/sim/tv';
import type { P2 } from '../../engine/venue-def';
import { NpcGames } from './npcgames';

const SECS = 60;
/** you, in the groups' member lists (guests' ids start at 1; staff are negative) */
export const YOU = 0;
const YOU_ID: PersonId = 'you';
/** within this of a group's anchor and not walking: present in it */
const PRESENT_M = 3.2;
/** beats other than Talk and Challenge are "inside a group or across a table": offered within this (ours) */
const NEAR_M = 2.5;
/** the candidate rule's distance */
const CAND_M = 8;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface SGroup extends TalkGroup {
  /** a party's own group (where they sit) or a circle formed by a Talk or a Join */
  kind: 'party' | 'circle';
  party: number | null;
  /** where the group is: a party's homes' centre, a circle's centre when it formed */
  cx: number; cz: number;
  formed: number;
}
/** an interaction under way: the walk up, then the beat (the clip, the line, the outcome at its end) */
interface Beat { kind: Kind; actor: Npc; target: Npc; second: Npc | null; game: GameKind | null; spot: string | null; p: number; seat: string | null; prev: Act | null; score: number; t0: number }
/** a guest's social state (kept beside the guest, not on the crowd's record) */
interface St { beat: Beat | null; roundAt: number; bought: boolean; wrapAt: number; turns: number; visiting: boolean; with: Npc | null; joinedAt: number; lookId: number; lookT: number; jokeAt: number; scoreSeenAt: number }
/** your exchange after an accepted Talk: a line, two reply chips, two or three rounds, then the wrap-up */
interface Exchange { n: Npc; count: number; wrapAt: number; chips: [string, string] | null }

export class Social {
  rels = new Relations();
  groups: SGroup[] = [];
  games: NpcGames;
  /** the group you're in */
  youIn: SGroup | null = null;
  private nextG = 1;
  private st = new WeakMap<Npc, St>();
  private ex: Exchange | null = null;
  /** your interaction waiting for you to walk up */
  private pendingYou: { n: Npc; kind: Kind; second: Npc | null; until: number; game: GameKind | null } | null = null;
  private lastCaption = -1e9;
  /** goals and touchdowns on the screens: the last per team (sim s), for the context and the "Offered when" rules */
  private scored: { team: string; t: number; fixture: string; against: string | null }[] = [];
  private lastGoalT = -1e9;
  /** the people whose team you know (Ask about their team), kept for the regulars */
  known = new Set<PersonId>();
  /** the people you've had a Great chat with (the first good conversation token is for someone new) */
  private chatted = new Set<PersonId>();
  /** the logs the checks read */
  logs = { talks: [] as Record<string, unknown>[], interactions: [] as Record<string, unknown>[], rounds: [] as Record<string, unknown>[], invites: [] as Record<string, unknown>[], matches: [] as Record<string, unknown>[], personAds: [] as Record<string, unknown>[], exchanges: [] as Record<string, unknown>[], leaves: [] as Record<string, unknown>[] };
  private r = mulberry(hash32('social', 1));
  private _v = new THREE.Vector3(); private _w = new THREE.Vector3();
  constructor(private crowd: Crowd, private life: BarLife) { this.games = new NpcGames(this, crowd, life); }
  private get c() { return this.life.ctxRef; }
  private get T() { return this.life.T * SECS; }
  private get Tm() { return this.life.T; }
  private push(log: Record<string, unknown>[], x: Record<string, unknown>, max = 600) { log.push(x); if (log.length > max) log.shift(); }
  pid(n: Npc): PersonId { return n.regular ?? n.key; }
  private s(n: Npc): St {
    let x = this.st.get(n);
    if (!x) { x = { beat: null, roundAt: -1e9, bought: false, wrapAt: 3, turns: 0, visiting: false, with: null, joinedAt: 0, lookId: -99, lookT: 0, jokeAt: -1e9, scoreSeenAt: -1e9 }; this.st.set(n, x); }
    return x;
  }
  npc(id: number): Npc | null { return id > 0 ? this.crowd.byKey.get(`n${id}`) ?? null : null; }

  // ------------------------------------------------------------------------------------------------ groups
  private newG(kind: SGroup['kind'], ids: number[], party: number | null, cx: number, cz: number): SGroup {
    const g = { ...newGroup(this.nextG++, [], this.r), kind, party, cx, cz, formed: this.T } as SGroup;
    for (const id of ids) this.add(g, id);
    this.groups.push(g);
    return g;
  }
  private add(g: SGroup, id: number) {
    if (!addMember(g, id)) return false;
    if (id === YOU) this.youIn = g; else { const n = this.npc(id); if (n) { n.grp = g; const s = this.s(n); s.joinedAt = this.T; s.turns = 0; } }
    return true;
  }
  /** a party's own group: its members who aren't in another group (rebuilt when the party changes); the members know
   *  each other (ours: walk-ins who came together start at rapport 20 and friendship 30, a regulars' friend group at
   *  friendship 50 unless the device remembers them) */
  partyGroup(party: Party): SGroup | null {
    const ms = party.members;
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = this.pid(ms[i]), b = this.pid(ms[j]);
      if (!this.rels.met(a, b)) this.rels.meet(a, b, this.Tm, { rapport: 20, friendship: party.regularGroup !== null ? 50 : 30, ctx: 'came together' });
    }
    if (ms.length < 2) return null;
    let g = party.group as SGroup | null;
    if (!g || !this.groups.includes(g)) { const [x, z] = this.partyAnchor(party); g = this.newG('party', [], party.id, x, z); party.group = g; }
    for (const m of ms) if (!m.grp && m.mode === 'live') this.add(g, m.id);
    if (g.members.length < 2) { this.end(g); return null; }
    return g;
  }
  private partyAnchor(party: Party): P2 {
    let x = 0, z = 0, k = 0;
    for (const m of party.members) { const s = m.home ? this.crowd.slots.get(m.home) : null; if (s) { x += s.x; z += s.z; k++; } }
    if (!k) for (const m of party.members) { x += m.x; z += m.z; k++; }
    return [x / Math.max(1, k), z / Math.max(1, k)];
  }
  /** someone leaves their group (a goodbye, a wrap-up, a decision elsewhere, held, gone); a group left with one ends */
  leave(n: Npc | null, why = 'left') {
    const g = n ? n.grp : this.youIn; if (!g) return;
    const id = n ? n.id : YOU;
    removeMember(g, id);
    if (n) { n.grp = null; this.s(n).visiting = false; } else this.youIn = null;
    this.push(this.logs.leaves, { t: +this.Tm.toFixed(3), who: n ? n.key : 'you', group: g.id, why, left: g.members.length });
    if (g.members.length < 2) this.end(g);
  }
  private end(g: SGroup) {
    for (const id of g.members) { if (id === YOU) this.youIn = null; else { const m = this.npc(id); if (m && m.grp === g) m.grp = null; } }
    g.members.length = 0;
    const i = this.groups.indexOf(g); if (i >= 0) this.groups.splice(i, 1);
  }
  /** a guest is gone (left the bar, sent home, a filler again) or held: out of their group, their beat and their match;
   *  a walk-in is forgotten */
  gone(n: Npc, forget: boolean) {
    this.leave(n, forget ? 'gone' : 'held');
    const s = this.st.get(n); if (s) s.beat = null;
    this.games.drop(n);
    if (this.pendingYou?.n === n) this.pendingYou = null;
    if (this.ex?.n === n) this.endExchange(false);
    if (forget && !n.regular) this.rels.forget(this.pid(n));
  }
  /** the anchor of a group (a party's homes' centre; a circle's own) */
  private anchor(g: SGroup): P2 {
    if (g.kind === 'party' && g.party !== null) { const p = this.crowd.parties.find((x) => x.id === g.party); if (p) { const a = this.partyAnchor(p); g.cx = a[0]; g.cz = a[1]; } }
    return [g.cx, g.cz];
  }
  /** present in their group now: live, not walking, within 3.2 m of its anchor (you: the same, standing still) */
  present(g: SGroup, id: number): boolean {
    if (id === YOU) { const p = this.c.player; return this.youIn === g && !p.path && Math.hypot(p.x - g.cx, p.z - g.cz) < PRESENT_M; }
    const n = this.npc(id);
    return !!n && n.mode === 'live' && !n.path && n.hiddenUntil <= this.T && n.act?.action !== 'game' && Math.hypot(n.x - g.cx, n.z - g.cz) < PRESENT_M;
  }
  /** in a conversation: in a group with someone else present (the needs' conversation rates, the emotion "Social") */
  inConversation(n: Npc) { const g = n.grp; if (!g || !this.present(g, n.id)) return false; for (const id of g.members) if (id !== n.id && this.present(g, id)) return true; return false; }
  talking(n: Npc) { return !!n.grp && n.grp.speaker === n.id; }
  private _pr: number[] = [];
  private syncT = 0;
  /** the groups' talk: one speaker at a time (engine/sim/groups.ts), the speaker's line when you're near or in the
   *  group, laughter, the exchanges that make a Great chat, a visitor's wrap-up; parties back at their places regroup */
  stepGroups(dS: number) {
    const pl = this.c.player, now = this.T;
    this.syncT += dS;
    if (this.syncT >= 2) {
      this.syncT = 0;
      for (const p of this.crowd.parties) {
        if (p.leaving || p.members.length < 2) continue;
        const g = p.group as SGroup | null, active = !!g && this.groups.includes(g);
        let home = 0; for (const m of p.members) if (m.mode === 'live' && !m.grp && !m.path && m.home && m.slot === m.home) home++;
        if (!active ? home >= 2 : home >= 1) { const g2 = active ? g! : null; if (g2) { for (const m of p.members) if (m.mode === 'live' && !m.grp && !m.path && m.home && m.slot === m.home) this.add(g2, m.id); } else this.partyGroup(p); }
      }
    }
    for (let gi = this.groups.length - 1; gi >= 0; gi--) {
      const g = this.groups[gi];
      this.anchor(g);
      const pr = this._pr; pr.length = 0;
      for (const id of g.members) if (this.present(g, id)) pr.push(id);
      const ev = stepGroup(g, pr, dS, this.r);
      if (ev.started > 0) {
        const sp = this.npc(ev.started);
        if (sp) {
          if (sp.p && sp.draw !== 'card' && sp.draw !== 'off' && this.crowd.slots.get(sp.slot ?? '')?.seatId === undefined) sp.p.play('talk');
          const inYours = this.youIn === g, near = Math.hypot(sp.x - pl.x, sp.z - pl.z) < 3.5;
          if ((inYours || near) && !this.ex && now - this.lastCaption > 6) {
            const night = this.c.clock().night > 0.5, matchOn = this.life.tv.bigChannel(this.life.T) !== 3;
            const l = pickLine(hash32('line', sp.id, g.turns), night, matchOn);
            this.lastCaption = now; this.life.sayCaption(sp.name, l.text, Math.min(5.5, 1.2 + l.text.length * 0.055));
          }
        }
      }
      if (ev.ended > 0) {
        const sp = this.npc(ev.ended), to = g.lookAt > 0 ? this.npc(g.lookAt) : null;
        // an exchange between the speaker and who they spoke to: three good ones make a Great chat
        if (sp && to) { const r = this.rels.meet(this.pid(sp), this.pid(to), this.Tm); r.exchanges++; r.last = this.Tm; if (r.exchanges >= 3 && !r.greatChat) { r.greatChat = true; sp.moodlets.add('great-chat', this.Tm); to.moodlets.add('great-chat', this.Tm); } }
        // a visitor wraps up after two or three turns: a goodbye, and back to their place
        if (sp) { const s = this.s(sp); s.turns++; if (s.visiting && s.turns >= s.wrapAt && !s.beat) this.wrapUp(sp); }
      }
      if (ev.laugh) for (const id of pr) { const m = this.npc(id); if (m?.p && this.crowd.slots.get(m.slot ?? '')?.seatId === undefined) { m.p.play('laugh'); this.crowd.laughs.push({ t: +this.Tm.toFixed(3), npc: m.key, lod: m.draw, seated: false }); if (this.crowd.laughs.length > 300) this.crowd.laughs.shift(); } }
    }
    // you: four metres from your group's place and you've left it (Lot 57's Leave)
    if (this.youIn && Math.hypot(pl.x - this.youIn.cx, pl.z - this.youIn.cz) > 4 && !pl.path) { if (this.ex) this.endExchange(false); this.leave(null, 'walked away'); }
  }
  /** a visitor's goodbye to who they talked to, then back to their own place */
  private wrapUp(n: Npc) {
    const s = this.s(n), t = s.with && s.with.grp === n.grp ? s.with : null;
    if (t) this.outcome(n, t, 'goodbye', 1, 'accept');
    this.leave(n, 'wrap-up');
    this.goHome(n);
  }
  private goHome(n: Npc) {
    const home = n.home ? this.crowd.slots.get(n.home) : null;
    if (home && n.slot !== n.home) { n.act = { action: 'arrive', object: home.zone, slot: home.id, stage: 'walk', t0: this.T, dur: Infinity, continuous: false, tags: [], score: 0, screen: null, why: 'back to my place' }; this.crowd.walkToSlot(n, home); }
    else this.crowd.finish(n, 'done');
  }

  // ------------------------------------------------------------------------------------------------ facing: once a frame
  /** listeners turn to the speaker (standing: the body; seated: a little on the seat, the head the rest), the speaker
   *  to who they look at; heads look by the people builder's lookAt, refreshed when the target changes */
  frame(dt: number) {
    const k = Math.min(1, dt * 4);
    for (const g of this.groups) {
      const sp = g.speaker;
      for (const id of g.members) {
        if (id === YOU) continue;
        const n = this.npc(id); if (!n || n.path || n.mode !== 'live' || n.act?.action === 'game') continue;
        if (!this.present(g, id)) continue;
        const tgt = id === sp ? g.lookAt : sp;
        const st = this.s(n);
        if (tgt < 0 || tgt === id) { if (st.lookId !== -1) { st.lookId = -1; n.p?.lookAt(null); } continue; }
        const [tx, tz, ty] = this.headOf(tgt);
        const yaw = Math.atan2(tx - n.x, tz - n.z);
        const slot = n.slot ? this.crowd.slots.get(n.slot) : null, seat = slot && slot.seatId !== undefined ? this.c.venue.seats[slot.seatId] : null;
        if (seat) n.heading = seat.face + clamp(wrap(yaw - seat.face), -0.45, 0.45);
        else n.heading += wrap(yaw - n.heading) * k;
        st.lookT -= dt;
        if (n.p && (st.lookId !== tgt || st.lookT <= 0)) { st.lookId = tgt; st.lookT = 1.2; n.p.lookAt(this._v.set(tx, ty, tz)); }
      }
    }
  }
  /** a person's head point (x, z, y): a guest's eyes from their body when drawn, else their standing or seated height */
  private headOf(id: number): [number, number, number] {
    if (id === YOU) { const p = this.c.player; return [p.x, p.z, p.y + 1.55]; }
    const n = this.npc(id); if (!n) return [0, 0, 0];
    if (n.p && (n.draw === 'lod1' || n.draw === 'lod2')) { n.p.eyes(this._w); return [this._w.x, this._w.z, this._w.y]; }
    const seated = !!n.slot && this.crowd.slots.get(n.slot)?.seatId !== undefined;
    return [n.x, n.z, n.y + (seated ? 1.2 : 1.6)];
  }

  // ------------------------------------------------------------------------------------------------ the screens
  /** a goal or a touchdown: who scored (the context's "both support the team that scored", Cheer together, High-five) */
  moment(e: TvEvent) {
    if (e.kind !== 'goal' && e.kind !== 'td' && e.kind !== 'fg') return;
    const f = this.life.fixtureOf(e); if (!f || !e.team) return;
    const against = f.home.abbr === e.team ? f.away.abbr : f.home.abbr;
    this.scored.push({ team: e.team, t: this.T, fixture: e.fixture, against }); if (this.scored.length > 40) this.scored.shift();
    this.lastGoalT = this.T;
  }
  private lastScore(within: number) { for (let i = this.scored.length - 1; i >= 0; i--) { const s = this.scored[i]; if (this.T - s.t <= within) return s; break; } return null; }
  private conceded(team: string | null, within: number) { if (!team) return false; for (let i = this.scored.length - 1; i >= 0; i--) { const s = this.scored[i]; if (this.T - s.t > within) break; if (s.against === team) return true; } return false; }

  // ------------------------------------------------------------------------------------------------ who offers what
  private available(t: Npc) { return t.mode === 'live' && !t.party.leaving && t.hiddenUntil <= this.T && !(t.act?.action === 'leave'); }
  /** the candidate rule: at most 8 people: first everyone present with friendship 20 or more toward the decider, most
   *  friendly first; then everyone within 8 m or in the same zone, nearest first. Staff and fillers aren't candidates
   *  (they aren't guests); neither are held guests, people leaving, or you (ours: guests don't start interactions with
   *  you in S3b) */
  candidates(n: Npc, out: Npc[] = []): Npc[] {
    out.length = 0;
    const me = this.pid(n), zone = n.slot ? this.crowd.slots.get(n.slot)?.zone ?? null : null;
    const friends: { t: Npc; f: number }[] = [], near: { t: Npc; d: number }[] = [];
    for (const t of this.crowd.npcs) {
      if (t === n || !this.available(t) || t.act?.action === 'game') continue;
      const r = this.rels.get(me, this.pid(t)), d = Math.hypot(t.x - n.x, t.z - n.z);
      if (r && r.friendship >= 20) { friends.push({ t, f: r.friendship }); continue; }
      const z2 = t.slot ? this.crowd.slots.get(t.slot)?.zone ?? null : null;
      if (d <= CAND_M || (!!zone && zone === z2)) near.push({ t, d });
    }
    friends.sort((a, b) => b.f - a.f); near.sort((a, b) => a.d - b.d);
    for (const x of friends) { if (out.length >= 8) break; out.push(x.t); }
    for (const x of near) { if (out.length >= 8) break; out.push(x.t); }
    return out;
  }
  private holds(x: Npc | null) { return x ? !!x.hand.drink : !!this.life.held.drink && this.life.held.drink.left > 0; }
  private teamOf(x: Npc | null) { return x ? x.team : this.life.team; }
  private needsOf(x: Npc | null): Needs { return x ? x.needs : this.life.needs; }
  private moodletsOf(x: Npc | null): Moodlets { return x ? x.moodlets : this.life.moodlets; }
  private pos(x: Npc | null): P2 { return x ? [x.x, x.z] : [this.c.player.x, this.c.player.z]; }
  private groupOf(x: Npc | null) { return x ? x.grp : this.youIn; }
  /** what an actor (a guest, or you: null) can do with a target now: the "Offered when" column (and, ours, beats other
   *  than Talk, Challenge and Introduce only inside a group or within 2.5 m) */
  offered(actor: Npc | null, t: Npc): { kind: Kind; game?: GameKind; spot?: string; second?: Npc }[] {
    const out: { kind: Kind; game?: GameKind; spot?: string; second?: Npc }[] = [];
    const A = actor ? this.pid(actor) : YOU_ID, B = this.pid(t), rel = this.rels.get(A, B);
    const ga = this.groupOf(actor), same = !!ga && ga === t.grp;
    const [ax, az] = this.pos(actor), d = Math.hypot(t.x - ax, t.z - az), near = same || d < NEAR_M;
    const tg = t.grp, full = !!tg && tg.members.length >= GROUP_MAX && !same;
    if (!full) out.push({ kind: 'talk' });
    if (near) out.push({ kind: 'joke' });
    const sc8 = this.lastScore(8), sc60 = this.lastScore(60), myTeam = this.teamOf(actor);
    if (near && sc8 && (myTeam === null || myTeam === sc8.team) && (t.team === null || t.team === sc8.team || t.team === myTeam)) out.push({ kind: 'cheer' });
    const jokeLanded = !!rel && rel.mem.some((m) => m.kind === 'joke' && m.good && this.Tm - m.t <= 1);
    const gameTogether = !!rel && rel.mem.some((m) => m.kind === 'game' && this.Tm - m.t <= 10);
    if (near && ((sc60 && myTeam === sc60.team && t.team === sc60.team) || gameTogether || ((rel?.friendship ?? 0) >= 45 && jokeLanded))) out.push({ kind: 'high-five' });
    if (near && this.holds(actor) && this.holds(t) && (!!sc60 || (rel?.friendship ?? 0) >= 20)) out.push({ kind: 'toast' });
    if (!actor && t.grp && t.grp === this.youIn) { const size = this.roundSize(t.grp); if (size >= 2 && size <= GROUP_MAX && !this.roundBlocked(t.grp)) out.push({ kind: 'round' }); }
    if (near && rel) { const b = this.introducible(actor, t); if (b) out.push({ kind: 'introduce', second: b }); }
    const kind = t.favourites.game as GameKind, spot = this.games.freeFor(kind, actor === null) ?? null;
    const anySpot = spot ? { kind, spot } : (['pool', 'darts', 'shuffleboard'] as GameKind[]).map((k) => ({ kind: k, spot: this.games.freeFor(k, actor === null) })).find((x) => !!x.spot) ?? null;
    if (anySpot && anySpot.spot && t.act?.action !== 'game') out.push({ kind: 'challenge', game: anySpot.kind, spot: anySpot.spot });
    if (near && t.team && !(actor ? this.knowsTeam(actor, t) : this.known.has(B))) out.push({ kind: 'team' });
    if (near && t.teamLostAt !== undefined && this.Tm - t.teamLostAt <= 20) out.push({ kind: 'console' });
    if (same) out.push({ kind: 'goodbye' });
    return out;
  }
  private knowsTeam(a: Npc, t: Npc) { const r = this.rels.get(this.pid(a), this.pid(t)); return !!r && r.mem.some((m) => m.kind === 'team'); }
  /** someone the actor has met, present near them, who hasn't met the target */
  private introducible(actor: Npc | null, t: Npc): Npc | null {
    const A = actor ? this.pid(actor) : YOU_ID, B = this.pid(t), [ax, az] = this.pos(actor);
    let best: Npc | null = null, bd = Infinity;
    for (const m of this.crowd.npcs) {
      if (m === t || m === actor || !this.available(m) || m.act?.action === 'game') continue;
      const dd = Math.hypot(m.x - ax, m.z - az); if (dd > CAND_M) continue;
      const M = this.pid(m); if (!this.rels.met(A, M) || this.rels.met(B, M)) continue;
      if (dd < bd) { bd = dd; best = m; }
    }
    return best;
  }
  private roundSize(g: SGroup) { return g.members.length; }
  /** a group can be bought a round once every 10 sim minutes: anyone in it given one in the last 10 blocks it */
  roundBlocked(g: SGroup) { for (const id of g.members) { if (id === YOU) { if (this.T - this.youRoundAt < ROUND.everyMin * SECS) return true; continue; } const m = this.npc(id); if (m && this.T - this.s(m).roundAt < ROUND.everyMin * SECS) return true; } return false; }
  private youRoundAt = -1e9;
  /** the acceptance probability, worked out for this actor and this target */
  pFor(actor: Npc | null, t: Npc, kind: Kind) {
    const A = actor ? this.pid(actor) : YOU_ID, rel = this.rels.get(A, this.pid(t));
    const sc = this.lastScore(60), ta = this.teamOf(actor);
    const cx: Context = { bothScored: !!sc && ta === sc.team && t.team === sc.team, conceded: this.conceded(t.team, 5 * SECS), midTurn: this.games.midTurn(t), otherGroup: !!t.grp && t.grp !== this.groupOf(actor) && t.grp.members.length >= 2 };
    return acceptP(kind, { rapport: rel?.rapport ?? 0, friendship: rel?.friendship ?? 0, target: t.traits, targetMood: t.mood, memory: memoryTerm(rel?.mem, kind), context: contextTerm(kind, cx) });
  }

  // ------------------------------------------------------------------------------------------------ people advertise
  private _cands: Npc[] = [];
  /** the person adverts for a guest's decision: each candidate offers at most 6 interactions (the 6 with the largest
   *  sum of m_k D_k if more hold), each with the expected deltas; at most 48 in all (the current group counted) */
  personAdverts(n: Npc, out: Cand[]) {
    const m = multipliers(n.traits), cur = out.some((c) => c.current && c.action === 'group');
    let budget = 48 - (cur ? 1 : 0);
    const cands = this.candidates(n, this._cands), ga = n.grp;
    const goal60 = this.T - this.lastGoalT <= 60;
    const midTurn = this.talking(n);
    const ads: Record<string, unknown>[] = [];
    let people = 0;
    for (const t of cands) {
      if (budget <= 0) break;
      const offers = this.offered(n, t);
      if (!offers.length) continue;
      const tg = t.grp, occ = tg ? clamp((tg.members.length - 4) / 2, 0, 1) : 0;
      const same = !!ga && ga === tg, d = Math.hypot(t.x - n.x, t.z - n.z);
      const shared = this.rels.sharedHighlight(this.pid(n), this.pid(t));
      const scored = offers.map((o) => {
        const p = this.pFor(n, t, o.kind), deltas = expected(o.kind, p, o.game);
        let sum = 0; for (const k of NEEDS) sum += m[k] * (deltas[k] ?? 0);
        return { o, p, deltas, sum };
      }).sort((a, b) => b.sum - a.sum).slice(0, Math.min(6, budget));
      people++;
      for (const x of scored) {
        const k = x.o.kind, D = TABLE[k];
        const walk = same || d < NEAR_M ? 0 : d * 1.3;
        const c: Cand = { key: `person:${t.id}:${k}`, action: 'interact', object: `person:${t.id}`, slot: x.o.spot ?? null, deltas: x.deltas, tags: D.tags, walk, occupancy: occ, wait: 0,
          memory: shared ? 10 : 0, inter: k, aff: D.aff, goal60, target: this.pid(t), p: x.p, joke: k === 'joke', favourite: k === 'challenge' && x.o.game === n.favourites.game, leavesMidTurn: midTurn && !same };
        (c as Cand & { game?: GameKind; second?: number }).game = x.o.game;
        (c as Cand & { game?: GameKind; second?: number }).second = x.o.second?.id;
        out.push(c); budget--;
        ads.push({ target: t.key, kind: k, p: +x.p.toFixed(4), deltas: Object.fromEntries(Object.entries(x.deltas).map(([kk, v]) => [kk, +(v as number).toFixed(4)])), needs: +score(c, { needs: n.needs, traits: n.traits, emotion: n.emotion }).terms.needs.toFixed(4) });
      }
    }
    this.lastAds = { people, ads };
  }
  /** the last decision's people and person adverts (crowd.ts logs them with the decision) */
  lastAds: { people: number; ads: Record<string, unknown>[] } = { people: 0, ads: [] };
  /** the decision log's extra: who and what the people offered (the checks recompute the expected deltas from it) */
  logAds(n: Npc, d: { objects: number; people: number; total: number }) {
    this.push(this.logs.personAds, { t: +this.Tm.toFixed(3), npc: n.key, needs: Object.fromEntries(NEEDS.map((k) => [k, +n.needs[k].toFixed(3)])), traits: { ...n.traits }, people: this.lastAds.people, adverts: d, ads: this.lastAds.ads }, 300);
  }

  // ------------------------------------------------------------------------------------------------ a guest's interaction
  /** a guest chose an interaction: walk up (Talk and Challenge toward someone away from them), or the beat now */
  begin(n: Npc, c: Cand, scoreV: number) {
    const id = Number(c.object.slice(7)), t = this.npc(id), kind = c.inter as Kind;
    if (!t || !this.available(t) || !KINDS.includes(kind)) { this.crowd.finish(n, 'gone'); return; }
    const x = c as Cand & { game?: GameKind; second?: number };
    const st = this.s(n);
    const same = !!n.grp && n.grp === t.grp, d = Math.hypot(t.x - n.x, t.z - n.z);
    const prev = n.act && n.act.continuous ? n.act : null;
    st.beat = { kind, actor: n, target: t, second: x.second !== undefined ? this.npc(x.second) : null, game: x.game ?? null, spot: c.slot, p: c.p ?? this.pFor(n, t, kind), seat: null, prev, score: scoreV, t0: this.T };
    const D = TABLE[kind];
    if ((kind === 'talk' || kind === 'challenge') && !same && d >= 1.8) {
      const ap = this.approach(n, t);
      if (n.grp) this.leave(n, 'went to talk to someone');
      n.act = { action: 'interact', object: c.object, slot: ap.seat, stage: 'walk', t0: this.T, dur: D.seconds, continuous: false, tags: D.tags, score: scoreV, screen: null, why: kind };
      st.beat.seat = ap.seat;
      if (ap.seat) { const s = this.crowd.slots.get(ap.seat)!; this.life.res.reserve(ap.seat, n.key, this.T + d * 1.3 / 1.25 + 10); this.crowd.walkToSlot(n, s); }
      else this.crowd.walkTo(n, ap.at);
      return;
    }
    n.act = { action: 'interact', object: c.object, slot: n.slot, stage: 'do', t0: this.T, dur: D.seconds, continuous: false, tags: D.tags, score: scoreV, screen: null, why: kind };
    this.startBeat(n);
  }
  /** where an actor joins a target: a free seat at the target's table (the table makes room), else a standing spot in
   *  the circle round the target or their group (12 directions, 1.0 to 1.3 m out, on free floor, nearest the actor) */
  approach(n: Npc | null, t: Npc): { at: P2; seat: string | null } {
    const tslot = t.slot ? this.crowd.slots.get(t.slot) : null;
    if (n && tslot && tslot.seatId !== undefined) {
      const u = this.crowd.unitOf.get(tslot.id);
      if (u && u.kind === 'table') for (const id of u.slots) { if (id === tslot.id) continue; if (!this.life.res.holder(id) && !this.crowd.slotTaken(id, n.key)) return { at: [this.crowd.slots.get(id)!.x, this.crowd.slots.get(id)!.z], seat: id }; }
    }
    const g = t.grp, cx = g ? g.cx : t.x, cz = g ? g.cz : t.z, [ax, az] = this.pos(n);
    let best: P2 | null = null, bd = Infinity;
    for (const R of g && g.members.length >= 2 ? [1.25, 1.5] : [1.0, 1.25]) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
      if (!this.c.grid.isFree(x, z)) continue;
      let clash = false;
      for (const m of this.crowd.npcs) if (m !== n && m.mode === 'live' && Math.abs(m.x - x) < 0.6 && Math.abs(m.z - z) < 0.6 && Math.hypot(m.x - x, m.z - z) < 0.55) { clash = true; break; }
      if (clash) continue;
      const dd = Math.hypot(x - ax, z - az); if (dd < bd) { bd = dd; best = [x, z]; }
    }
    if (!best) { const f = this.c.grid.nearestFree(cx + 0.9, cz, 3); best = f ? [f[0], f[1]] : [t.x + 0.8, t.z]; }
    return { at: best, seat: null };
  }
  /** the actor reached the target: take the seat if it was one, face each other, the beat */
  arrived(n: Npc) {
    const a = n.act!;
    if (a.action === 'game') { if (n.faceYaw !== null) n.heading = n.faceYaw; const cb = n.onArrive; n.onArrive = null; cb?.(); return; }
    const st = this.s(n), b = st.beat;
    if (!b || !this.available(b.target)) { st.beat = null; this.crowd.finish(n, 'gone'); return; }
    if (a.slot) { const s = this.crowd.slots.get(a.slot)!; this.crowd.placeAt(n, s); n.slot = s.id; this.life.res.use(s.id, n.key); }
    a.stage = 'do'; a.t0 = this.T; a.dur = TABLE[b.kind].seconds;
    this.startBeat(n);
  }
  /** face each other and play the beat's clip (2 to 4 s) */
  private startBeat(n: Npc) {
    const b = this.s(n).beat!; const t = b.target;
    this.faceEach(n, t);
    const D = TABLE[b.kind];
    if (n.p && (n.draw === 'lod1' || n.draw === 'lod2')) { if (D.clip === 'talk') n.p.play('talk'); else this.crowd.play(n, D.clip, D.seconds); }
    this.crowd.clipLog.push({ t: +this.Tm.toFixed(3), npc: n.key, clip: D.clip, beat: b.kind, draw: n.draw });
  }
  private faceEach(a: Npc | null, t: Npc) {
    const [ax, az] = this.pos(a);
    const seated = (x: Npc) => !!x.slot && this.crowd.slots.get(x.slot)?.seatId !== undefined;
    if (a && !seated(a)) a.heading = Math.atan2(t.x - a.x, t.z - a.z);
    if (!seated(t) && t.act?.action !== 'game') t.heading = Math.atan2(ax - t.x, az - t.z);
    if (!a) { const p = this.c.player; p.heading = p.yaw = Math.atan2(t.x - p.x, t.z - p.z); }
  }
  /** the beat's end (crowd.ts calls it when the clip's time is up): the outcome, then the group or the action before */
  resolve(n: Npc) {
    const st = this.s(n), b = st.beat; st.beat = null;
    if (!b || !this.available(b.target)) { this.crowd.finish(n, 'gone'); return; }
    const ok = this.outcome(n, b.target, b.kind, b.p, undefined, b.second, b.game, b.spot);
    if (b.kind === 'talk' && ok) { this.together(n, b.target, b.score); return; }
    if (b.kind === 'challenge' && ok && b.game && b.spot) { if (this.games.start(b.game, b.spot, n, b.target, 'challenge')) return; }
    if (b.kind === 'goodbye' && ok) { this.leave(n, 'goodbye'); this.goHome(n); return; }
    // back to what they were doing, where they were
    const prev = b.prev;
    if (prev && (prev.slot === n.slot || (!prev.slot && !b.seat))) { n.act = prev; n.decideAt = this.T + 20; }
    else this.crowd.finish(n, 'done');
  }
  /** an accepted Talk: both in one group (the target's, if it has room; otherwise a new group of 2 where the target is) */
  private together(a: Npc, t: Npc, scoreV: number) {
    let g = t.grp;
    if (g && g.members.length < GROUP_MAX) { if (a.grp !== g) { this.leave(a, 'joined another group'); this.add(g, a.id); } }
    else if (!g) { this.leave(a, 'joined another group'); g = this.newG('circle', [t.id, a.id], null, (a.x + t.x) / 2, (a.z + t.z) / 2); }
    const st = this.s(a);
    st.visiting = !!g && g.party !== a.party.id; st.with = t; st.turns = 0; st.wrapAt = 2 + (this.r() < 0.5 ? 1 : 0);
    a.act = { action: 'group', object: `group:${g?.id ?? 0}`, slot: a.slot, stage: 'do', t0: this.T, dur: Infinity, continuous: true, tags: ['social'], score: scoreV, screen: null, why: 'talk' };
    a.decideAt = this.T + 20;
    this.push(this.logs.talks, { t: +this.Tm.toFixed(3), actor: a.key, target: t.key, accepted: true, group: g?.id ?? null, members: g ? g.members.slice() : [], size: g?.members.length ?? 0, bothIn: !!g && g.members.includes(a.id) && g.members.includes(t.id), via: 'talk' });
  }
  /** a decision for an action somewhere else takes a person out of their group (crowd.ts asks before it starts one) */
  leavingFor(n: Npc, slot: string | null) {
    const g = n.grp; if (!g) return;
    if (slot) { const s = this.crowd.slots.get(slot); if (s && Math.hypot(s.x - g.cx, s.z - g.cz) < PRESENT_M) return; }
    else return;
    this.leave(n, 'decided to do something else');
  }

  // ------------------------------------------------------------------------------------------------ the outcome
  /**
   * An interaction's outcome between an actor (a guest, or you: null) and a target: the roll against p (or forced, for
   * the checks), then the table's numbers: rapport and friendship by the outcome's delta (both people), the needs (both
   * people), the moodlets, a memory, the line and a spark or a puff. Returns whether it was accepted.
   */
  outcome(actor: Npc | null, t: Npc, kind: Kind, p: number, forced?: 'accept' | 'reject', second?: Npc | null, game?: GameKind | null, spot?: string | null): boolean {
    const ok = forced ? forced === 'accept' : this.r() < p;
    const D = TABLE[kind], o = ok ? D.acc : D.rej, A = actor ? this.pid(actor) : YOU_ID, B = this.pid(t), now = this.Tm;
    const relBefore = this.relNums(A, B), needsBefore = { actor: { ...this.needsOf(actor) }, target: { ...t.needs } };
    let ctx: string | undefined;
    if (kind === 'team') ctx = t.team ?? undefined;
    if (kind === 'challenge') ctx = game ?? undefined;
    if (kind === 'introduce' && second) {
      const C = this.pid(second);
      if (ok) {
        const start = introStart(this.rels.get(A, B)?.friendship ?? 0, this.rels.get(A, C)?.friendship ?? 0);
        const r = this.rels.meet(B, C, now, { ctx: actor ? actor.key : 'you' }); r.rapport = start;
        this.rels.remember(r, { t: now, kind: 'introduced', good: true, delta: start, ctx: actor ? actor.name : 'you' });
        this.rels.apply(A, B, o.rapport, now, kind, true, second.name); this.rels.apply(A, C, o.rapport, now, kind, true, t.name);
        t.moodlets.add('introduced', now); second.moodlets.add('introduced', now);
      } else this.rels.apply(A, B, o.rapport, now, kind, false, second.name);
    } else if (kind === 'round') {
      // handled by the round itself (each member)
    } else this.rels.apply(A, B, o.rapport, now, kind, ok, ctx);
    if (kind !== 'round') { bump(this.needsOf(actor), o.needs); bump(t.needs, o.needs); }
    if (o.actor) this.moodletsOf(actor).add(o.actor, now);
    if (o.target && kind !== 'introduce') t.moodlets.add(o.target, now);
    if (kind === 'console' && ok) t.moodlets.scale('team-lost', 0.5);
    if (kind === 'joke' && ok) { this.s(t).jokeAt = now; if (actor) this.s(actor).jokeAt = now; else this.youJokeAt = now; }
    if (kind === 'team' && ok && !actor) this.known.add(B);
    if (kind === 'talk' && ok) { const r = this.rels.get(A, B); if (r) r.exchanges++; }
    if (!actor) t.met = true;
    // the line and the spark: shown when you're in it or near (3.5 m)
    const pl = this.c.player, nearYou = !actor || Math.hypot(t.x - pl.x, t.z - pl.z) < 3.5 || (actor && Math.hypot(actor.x - pl.x, actor.z - pl.z) < 3.5);
    let line = '', who = '';
    if (nearYou) { const l = this.lineFor(actor, t, kind, ok); line = l.text; who = l.who; if (line) { this.lastCaption = this.T; this.life.sayCaption(who, line, Math.min(5.5, 1.4 + line.length * 0.05)); } }
    this.spark(t, ok && D.acc.rapport >= 0 ? (ok ? 'good' : 'bad') : ok ? 'good' : 'bad');
    if (actor && kind !== 'goodbye') this.spark(actor, ok ? 'good' : 'bad');
    // the target's answer on their body
    if (ok && t.p && (t.draw === 'lod1' || t.draw === 'lod2')) { if (kind === 'joke') t.p.play('laugh'); else if (kind === 'cheer' || kind === 'high-five') this.crowd.play(t, 'cheer', 1.8); else if (kind === 'toast' && t.hand.drink) this.crowd.play(t, 'drink', 2.4); }
    // your tonight's three
    if (!actor && ok) {
      if (kind === 'toast' && this.T - this.lastGoalT <= 60) this.life.goal('toast-goal');
      if (kind === 'introduce') this.life.goal('introduce');
      if (kind === 'joke' && t.regular) this.life.goal('regular-laugh');
      if (kind === 'cheer') { const sc = this.lastScore(8); if (sc) { this.cheeredWith.add(`${sc.t}:${t.id}`); let k = 0; for (const x of this.cheeredWith) if (x.startsWith(`${sc.t}:`)) k++; if (k >= 3) this.life.goal('cheer-three'); } }
    }
    const relAfter = this.relNums(A, B);
    const rec = { t: +now.toFixed(3), kind, actor: actor ? actor.key : 'you', target: t.key, p: +p.toFixed(4), accepted: ok, forced: forced ?? null, rapport: [relBefore.rapport, relAfter.rapport], friendship: [relBefore.friendship, relAfter.friendship], delta: o.rapport, needs: { actor: this.diff(needsBefore.actor, this.needsOf(actor)), target: this.diff(needsBefore.target, t.needs) }, moodlets: { actor: o.actor ?? null, target: o.target ?? null }, line, who, second: second?.key ?? null, game: game ?? null, spot: spot ?? null };
    this.push(this.logs.interactions, rec);
    this.lastOutcome = rec;
    return ok;
  }
  private cheeredWith = new Set<string>();
  youJokeAt = -1e9;
  lastOutcome: Record<string, unknown> | null = null;
  private relNums(a: PersonId, b: PersonId) { const r = this.rels.get(a, b); return { rapport: r ? +r.rapport.toFixed(4) : 0, friendship: r ? +r.friendship.toFixed(4) : 0 }; }
  private diff(a: Needs, b: Needs) { const o: Record<string, number> = {}; for (const k of NEEDS) { const d = b[k] - a[k]; if (Math.abs(d) > 1e-6) o[k] = +d.toFixed(4); } return o; }
  /** the beat's line: the actor's words, then (for a joke) the target's laugh or not; memory and your state pick first */
  private lineFor(actor: Npc | null, t: Npc, kind: Kind, ok: boolean): { who: string; text: string } {
    const night = this.c.clock().night > 0.5, matchOn = this.life.tv.bigChannel(this.life.T) !== 3;
    const team = (x: string | null) => (x ? teamByAbbr(x)?.name ?? null : null);
    const seed = hash32('beat', t.id, Math.floor(this.T), kind.length);
    const remembers = new Set<string>(); const rel = this.rels.get(actor ? this.pid(actor) : YOU_ID, this.pid(t));
    if (rel) for (const m of rel.mem) if (m.good) remembers.add(m.kind === 'introduced' ? 'introduce' : m.kind);
    const lc = { night, matchOn, remembers, state: actor ? null : this.youState(), team: team(t.team), mine: team(this.teamOf(actor)), name: t.name };
    // who speaks: the target answers (Talk, Team, Console, Introduce, Challenge, a round's thanks, a laugh); the actor
    // says the joke, the toast, the cheer, the goodbye, the round
    const actorName = actor ? actor.name : 'You';
    switch (kind) {
      case 'joke': { const j = pickFor('joke', null, seed, lc); const r = pickFor('laugh', ok ? 'yes' : 'no', seed >>> 3, lc); return { who: actor ? actor.name : t.name, text: actor ? `${j.text} · ${t.name}: ${r.text}` : r.text }; }
      case 'cheer': case 'high-five': case 'toast': case 'goodbye': return { who: ok || kind === 'goodbye' ? (kind === 'goodbye' ? actorName : t.name) : t.name, text: pickFor(kind as LineKind, kind === 'goodbye' ? null : ok ? 'yes' : 'no', seed, lc).text };
      case 'round': return { who: t.name, text: pickFor('thanks', 'yes', seed, lc).text };
      default: return { who: t.name, text: pickFor(kind as LineKind, ok ? 'yes' : 'no', seed, lc).text };
    }
  }
  private youState(): 'holding' | 'thirsty' | 'tired' | 'won' | null {
    if (this.life.held.drink && this.life.held.drink.left > 0) return 'holding';
    if (this.life.needs.thirst < 30) return 'thirsty';
    if (this.life.needs.energy < 25) return 'tired';
    return null;
  }

  // ------------------------------------------------------------------------------------------------ rounds
  /** a guest's own rule for rounds: outgoing above 0.6, in a group of 3 or more, at most once a visit (ours: once
   *  they've been in it 2 sim minutes, a 1 in 4 chance at each decision while the group isn't blocked) */
  npcRound(n: Npc): boolean {
    const s = this.s(n), g = n.grp;
    if (s.bought || n.traits.outgoing <= 0.6 || !g || g.members.length < 3 || this.roundBlocked(g) || this.T - s.joinedAt < 120 || !this.present(g, n.id)) return false;
    if (this.r() >= 0.25) return false;
    const t = g.members.map((id) => this.npc(id)).find((m) => !!m && m !== n) ?? null; if (!t) return false;
    s.bought = true;
    this.buyRound(n, g, t, this.pFor(n, t, 'round'));
    return true;
  }
  /** a round for a group: 4 house tokens a person when you buy (your favourite alcohol-free), each guest their favourite,
   *  brought by a server in 1 to 2 minutes; +15 with each; "Got a round" and "Bought a round" */
  buyRound(actor: Npc | null, g: SGroup, t: Npc, p: number, forced?: 'accept' | 'reject') {
    const size = g.members.length, cost = ROUND.perPerson * size;
    if (!actor && this.life.save.tokens < cost) { this.life.tell(`A round for ${size} is ${cost} house tokens. You have ${this.life.save.tokens}.`, 3); return { ok: false, why: 'tokens', cost }; }
    if (this.roundBlocked(g)) return { ok: false, why: 'too soon', cost };
    const tokensBefore = this.life.save.tokens;
    const ok = this.outcome(actor, t, 'round', p, forced);
    if (!ok) { this.push(this.logs.rounds, { t: +this.Tm.toFixed(3), by: actor ? actor.key : 'you', group: g.id, size, accepted: false, cost: 0 }); return { ok: false, why: 'declined', cost }; }
    if (!actor) { this.life.spendTokens(cost); this.youRoundAt = this.T; this.life.goal('buy-round'); }
    const A = actor ? this.pid(actor) : YOU_ID, now = this.Tm, members: Npc[] = [];
    for (const id of g.members) {
      if (id === YOU) { if (actor) { this.rels.apply(A, YOU_ID, TABLE.round.acc.rapport, now, 'round', true); this.life.moodlets.add('got-round', now); } continue; }
      const m = this.npc(id); if (!m || m === actor) continue;
      members.push(m);
      this.rels.apply(A, this.pid(m), TABLE.round.acc.rapport, now, 'round', true);
      if (m !== t) m.moodlets.add('got-round', now);
      this.s(m).roundAt = this.T;
    }
    if (actor) this.s(actor).roundAt = this.T;
    const deliverIn = ROUND.deliver[0] + (ROUND.deliver[1] - ROUND.deliver[0]) * this.r();
    const rec: Record<string, unknown> = { t: +now.toFixed(3), by: actor ? actor.key : 'you', group: g.id, size, accepted: true, cost: actor ? 0 : cost, tokens: actor ? null : [tokensBefore, this.life.save.tokens], members: members.map((m) => m.key), deliverIn: +deliverIn.toFixed(1), delivered: null as number | null };
    this.push(this.logs.rounds, rec);
    this.crowd.deliverRound(g, members, !actor || g.members.includes(YOU), deliverIn, () => { rec.delivered = +this.Tm.toFixed(3); });
    if (!actor) this.life.tell(`Round for ${size} · ${cost} house tokens (no cash value) · on its way`, 3.5);
    return { ok: true, cost, deliverIn };
  }

  // ------------------------------------------------------------------------------------------------ your side
  /** your radial menu on a person: up to six that fit the moment; a seventh, "More…", lists the rest; the "i" opens
   *  their card */
  menuFor(n: Npc): { label: string; key: string }[] {
    const offers = this.offered(null, n);
    const label = (o: { kind: Kind; game?: GameKind }) => o.kind === 'round' ? `Buy a round · ${ROUND.perPerson * (n.grp ? n.grp.members.length : 1)} tokens` : o.kind === 'challenge' ? `Challenge · ${o.game}` : TABLE[o.kind].label;
    const items = offers.map((o) => ({ label: label(o), key: o.kind }));
    if (items.length > 6) return [...items.slice(0, 6), { label: 'More…', key: 'more' }];
    return items;
  }
  allFor(n: Npc) { return this.offered(null, n).map((o) => ({ label: o.kind === 'challenge' ? `Challenge · ${o.game}` : o.kind === 'round' ? `Buy a round · ${ROUND.perPerson * (n.grp ? n.grp.members.length : 1)} tokens` : TABLE[o.kind].label, key: o.kind })); }
  /** you picked an interaction for a person: walk up if you're away (tap to go), then the beat */
  pick(n: Npc, key: string) {
    const c = this.c;
    if (key === 'card') { this.openCard(n); return; }
    if (key === 'more') { c.barHud.pick(`${n.name}: what to do`, this.allFor(n), (k) => this.pick(n, k)); return; }
    if (key === 'introduce') {
      const list = this.introList(n);
      if (!list.length) { c.hud.toast(`Nobody here to introduce ${n.name} to`, 2.5); return; }
      c.barHud.pick(`Introduce ${n.name} to…`, list.map((m) => ({ label: m.name, key: String(m.id) })), (k) => this.interact(n, 'introduce', { second: Number(k), place: false }));
      return;
    }
    if (!KINDS.includes(key as Kind)) return;
    this.interact(n, key as Kind, { place: false });
  }
  private introList(n: Npc) { const out: Npc[] = []; const B = this.pid(n); for (const m of this.crowd.npcs) { if (m === n || !this.available(m)) continue; const M = this.pid(m); if (this.rels.met(YOU_ID, M) && !this.rels.met(B, M) && Math.hypot(m.x - this.c.player.x, m.z - this.c.player.z) < CAND_M) out.push(m); } return out; }
  /**
   * Your interaction with a person. `place` stands you beside them now (the hooks' shortcut past the walk; the radial
   * menu walks you there); `outcome` forces accepted or not (the checks); `second` is Introduce's second person.
   * Returns what happened: the numbers before and after, the line, and the clip.
   */
  interact(n: Npc, kind: Kind, o: { place?: boolean; outcome?: 'accept' | 'reject'; second?: number; force?: boolean } = {}) {
    const c = this.c, pl = c.player;
    if (!KINDS.includes(kind)) return { ok: false, why: 'no such interaction: ' + kind };
    const offers = this.offered(null, n), off = offers.find((x) => x.kind === kind);
    if (!off && !o.force) return { ok: false, why: `${TABLE[kind].label} isn't offered now`, offered: offers.map((x) => x.kind) };
    const second = o.second !== undefined ? this.npc(o.second) : off?.second ?? null;
    if (kind === 'introduce' && !second) return { ok: false, why: 'Introduce needs a second person' };
    const d = Math.hypot(n.x - pl.x, n.z - pl.z);
    if (d > 2.2) {
      const ap = this.approach(null, n);
      if (o.place !== false) pl.place(ap.at[0], ap.at[1]);
      else { pl.goTo(ap.at[0], ap.at[1]); this.pendingYou = { n, kind, second, until: this.T + 30, game: off?.game ?? null }; return { ok: true, walking: true }; }
    }
    return this.doYours(n, kind, second, off?.game ?? null, off?.spot ?? null, o.outcome);
  }
  /** your walk up arrived (or gave up): the beat */
  private stepPending() {
    const q = this.pendingYou; if (!q) return;
    const pl = this.c.player;
    if (!this.available(q.n) || this.T > q.until) { this.pendingYou = null; return; }
    if (pl.path) return;
    this.pendingYou = null;
    if (Math.hypot(q.n.x - pl.x, q.n.z - pl.z) > 3) { this.c.hud.toast(`Couldn't reach ${q.n.name}`, 2.5); return; }
    this.doYours(q.n, q.kind, q.second, q.game, null);
  }
  private doYours(n: Npc, kind: Kind, second: Npc | null, game: GameKind | null, spot: string | null, forced?: 'accept' | 'reject') {
    const life = this.life;
    this.faceEach(null, n);
    // your avatar's beat
    const D = TABLE[kind], av = this.c.person();
    if (av) { if (D.clip === 'talk') av.play('talk'); else life.clips.play(av, D.clip, { upper: !!this.c.player.seat }); }
    life.clipYouLog(kind, D.clip);
    n.met = true;
    const before = { rel: this.relNums(YOU_ID, this.pid(n)), you: { ...life.needs }, them: { ...n.needs }, tokens: life.save.tokens };
    const p = this.pFor(null, n, kind);
    let ok: boolean, extra: Record<string, unknown> = {};
    if (kind === 'round') {
      const g = n.grp && n.grp === this.youIn ? n.grp : null;
      if (!g) return { ok: false, why: 'not in their group' };
      const r = this.buyRound(null, g, n, p, forced); ok = r.ok; extra = r;
    } else {
      ok = this.outcome(null, n, kind, p, forced, second, game, spot);
      if (kind === 'talk') { if (ok) { this.joinYou(n, false); this.startExchange(n); } }
      else if (kind === 'goodbye' && ok) { if (this.ex) this.endExchange(false); this.leave(null, 'goodbye'); }
      else if (kind === 'challenge' && ok && game) { const sp = spot ?? this.games.freeFor(game, true); if (sp) extra = { game, spot: sp, started: this.challengeYou(n, game, sp) }; }
    }
    this.life.refreshHud(true);
    return { ok: true, accepted: ok, kind, p: +p.toFixed(4), before, after: { rel: this.relNums(YOU_ID, this.pid(n)), you: { ...life.needs }, them: { ...n.needs }, tokens: life.save.tokens }, memory: this.rels.lastOf(YOU_ID, this.pid(n)), caption: life.ctxRef.hud.captionText, last: this.lastOutcome, group: this.youIn ? this.youIn.members.slice() : null, ...extra };
  }
  /** an accepted Challenge: they walk to the game with you; the game's opponent is them, not the house */
  private challengeYou(n: Npc, game: GameKind, spot: string) {
    this.crowd.ensureBody(n);
    const vs = { opp: this.crowd.oppFor(n), name: n.name, competitive: n.traits.competitive, id: n.id };
    return this.life.challenge(spot, game, vs);
  }
  /** your game with a guest ended: their moodlet, and the game counts as an interaction for both (ours: one pair, so
   *  the mean of the plan's +6 and +4, when both are in a good mood) */
  playedWith(id: number, youWon: boolean, close: boolean) {
    const n = this.npc(id); if (!n) return;
    const now = this.Tm;
    if (!youWon) n.moodlets.add('won-game', now, wonGameValue(n.traits.competitive)); else if (close) n.moodlets.add('lost-close', now);
    if (this.life.moodNow().value >= 45 && n.mood >= 45) this.rels.apply(YOU_ID, this.pid(n), (PLAYED_TOGETHER.winner + PLAYED_TOGETHER.loser) / 2, now, 'game', true, 'played together');
    else this.rels.apply(YOU_ID, this.pid(n), 0, now, 'game', true, 'played together');
  }
  /** you join a person's group (Lot 57's Join, and an accepted Talk): the circle opens a gap and turns to you; a person
   *  alone and you make a new group of 2 where they are */
  joinYou(n: Npc, place = true) {
    if (this.youIn && this.youIn === n.grp) return { group: this.youIn.id, members: this.youIn.members.slice() };
    if (this.youIn) this.leave(null, 'joined another group');
    let g = n.grp;
    if (g && g.members.length >= GROUP_MAX) return null;
    if (!g) g = this.newG('circle', [n.id], null, n.x, n.z);
    this.add(g, YOU);
    for (const p of this.crowd.parties) p.yours = false;
    for (const id of g.members) { const m = this.npc(id); if (m) m.party.yours = true; }
    if (place) { const ap = this.approach(null, n); this.c.player.place(ap.at[0], ap.at[1]); }
    if (g.members.length === 2 && g.kind === 'circle') { const p = this.c.player; g.cx = (p.x + n.x) / 2; g.cz = (p.z + n.z) / 2; }
    this.faceEach(null, n);
    this.push(this.logs.talks, { t: +this.Tm.toFixed(3), actor: 'you', target: n.key, accepted: true, group: g.id, members: g.members.slice(), size: g.members.length, bothIn: g.members.includes(YOU) && g.members.includes(n.id), via: place ? 'join' : 'talk' });
    return { group: g.id, members: g.members.slice() };
  }
  // ---- your exchange: a line, warm or quip, two or three times, then the wrap-up
  private startExchange(n: Npc) {
    this.ex = { n, count: 0, wrapAt: 2 + (this.r() < 0.5 ? 1 : 0), chips: null };
    this.nextLine();
  }
  private nextLine() {
    const e = this.ex!; const seed = hash32('ex', e.n.id, e.count, Math.floor(this.T));
    const lc = { night: this.c.clock().night > 0.5, matchOn: this.life.tv.bigChannel(this.life.T) !== 3 };
    const l = e.count === 0 ? null : pickLine(seed, lc.night, lc.matchOn);
    if (l) { this.life.sayCaption(e.n.name, l.text, 6); this.lastCaption = this.T; }
    const w = pickFor('warm', null, seed, lc).text, q = pickFor('quip', null, seed >>> 5, lc).text;
    e.chips = [w, q]; this.c.hud.replies(e.chips);
  }
  /** your reply chip: warm adds 2; quip adds 4 if they're playful above 0.5 and takes 2 otherwise */
  reply(i: 0 | 1) {
    const e = this.ex; if (!e) return null;
    const n = e.n, delta = i === 0 ? 2 : n.traits.playful > 0.5 ? 4 : -2;
    const r = this.rels.apply(YOU_ID, this.pid(n), delta, this.Tm, i === 0 ? 'warm' : 'quip', delta > 0);
    if (delta > 0) r.exchanges++;
    this.spark(n, delta > 0 ? 'good' : 'bad');
    e.count++;
    const rec = { t: +this.Tm.toFixed(3), with: n.key, reply: i === 0 ? 'warm' : 'quip', chip: e.chips?.[i] ?? '', delta, playful: +n.traits.playful.toFixed(3), rapport: +r.rapport.toFixed(4), exchanges: r.exchanges, count: e.count, wrapAt: e.wrapAt, greatChat: false, token: 0 };
    if (r.exchanges >= 3 && !r.greatChat) {
      r.greatChat = true; this.life.moodlets.add('great-chat', this.Tm); n.moodlets.add('great-chat', this.Tm); rec.greatChat = true;
      const P = this.pid(n); if (!this.chatted.has(P)) { this.chatted.add(P); rec.token = this.life.earnFirstChat(); }
    }
    if (e.count >= e.wrapAt) this.endExchange(true); else this.nextLine();
    this.push(this.logs.exchanges, rec);
    return rec;
  }
  private endExchange(wrap: boolean) {
    const e = this.ex; this.ex = null; this.c.hud.replies(null);
    if (wrap && e) { const l = pickFor('wrap', null, hash32('wrap', e.n.id, Math.floor(this.T)), { night: this.c.clock().night > 0.5, matchOn: this.life.tv.bigChannel(this.life.T) !== 3 }); this.life.sayCaption(e.n.name, l.text, 4); }
  }
  get exchange() { return this.ex ? { with: this.ex.n.key, count: this.ex.count, wrapAt: this.ex.wrapAt, chips: this.ex.chips } : null; }

  // ------------------------------------------------------------------------------------------------ cards and lists
  /** a person's card: first name, level and bar, the "Getting along" chip, team if known, the mood face, their last
   *  memory with you */
  cardData(n: Npc) {
    const P = this.pid(n), rel = this.rels.get(YOU_ID, P), lv = levelOf(rel), team = this.known.has(P) && n.team ? teamByAbbr(n.team) : null;
    const m = this.rels.lastOf(YOU_ID, P);
    return { id: n.id, name: n.name, level: lv, friendship: rel ? +rel.friendship.toFixed(1) : null, rapport: rel ? +rel.rapport.toFixed(1) : null, gettingAlong: gettingAlong(rel), team: team ? team.name : null, teamAbbr: team ? team.abbr : null, mood: n.label, emotion: n.emotion, regular: !!n.regular, memory: m ? this.memoryText(n, m) : rel ? null : `You haven't met ${n.name} yet` };
  }
  memoryText(n: Npc, m: { kind: string; good: boolean; ctx?: string }) {
    const team = (a?: string) => (a ? teamByAbbr(a)?.name ?? a : '');
    switch (m.kind) {
      case 'met': return `You met ${n.name} tonight`;
      case 'talk': return m.good ? `You got talking with ${n.name}` : `${n.name} wasn't up for a chat`;
      case 'warm': case 'quip': return m.good ? `You and ${n.name} had a good laugh` : `A quip of yours missed with ${n.name}`;
      case 'joke': return m.good ? `${n.name} laughed at your joke` : `Your joke fell flat with ${n.name}`;
      case 'cheer': return `You cheered a goal together`;
      case 'high-five': return m.good ? `You high-fived ${n.name}` : `${n.name} left you hanging`;
      case 'toast': return `You toasted together`;
      case 'round': return `You bought ${n.name} a round`;
      case 'introduce': return `You introduced ${n.name} to ${m.ctx ?? 'someone'}`;
      case 'introduced': return `${m.ctx ?? 'Someone'} introduced you`;
      case 'challenge': return m.good ? `${n.name} took you on at ${m.ctx ?? 'a game'}` : `${n.name} turned down a game`;
      case 'game': return `You played a game together`;
      case 'team': return `${n.name} backs the ${team(m.ctx)}`;
      case 'console': return m.good ? `You cheered ${n.name} up after a loss` : `${n.name} wasn't ready to talk about the loss`;
      case 'goodbye': return `You said goodbye`;
      default: return `You know each other`;
    }
  }
  openCard(n: Npc) { const d = this.cardData(n); this.c.barHud.card(d); return d; }
  /** everyone present you've met, by friendship */
  peopleHere() {
    const rows = this.crowd.npcs.filter((n) => n.mode === 'live' && this.rels.met(YOU_ID, this.pid(n))).map((n) => { const r = this.rels.get(YOU_ID, this.pid(n))!; return { id: n.id, name: n.name, level: levelOf(r), friendship: +r.friendship.toFixed(1), rapport: +r.rapport.toFixed(1), gettingAlong: gettingAlong(r), regular: !!n.regular }; });
    rows.sort((a, b) => b.friendship - a.friendship || b.rapport - a.rapport);
    return rows;
  }
  openPeople() { const rows = this.peopleHere(); this.c.barHud.people(rows, (id) => { const n = this.npc(id); if (n) this.openCard(n); }); return rows; }

  // ------------------------------------------------------------------------------------------------ sparks
  /** a lime "+" or a coral "–" over a head: drawn in the HUD layer at the head's screen position (no draw calls), when
   *  the head is on screen and within 18 m */
  spark(n: Npc, kind: 'good' | 'bad') {
    const cam = this.c.camera; if (Math.hypot(n.x - cam.position.x, n.z - cam.position.z) > 18) return;
    const [x, z, y] = this.headOf(n.id), v = this._v.set(x, y + 0.35, z).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return;
    this.c.barHud.spark((v.x * 0.5 + 0.5) * this.c.canvas.clientWidth, (-v.y * 0.5 + 0.5) * this.c.canvas.clientHeight, kind === 'good');
    this.sparkLog.push({ t: +this.Tm.toFixed(3), who: n.key, good: kind === 'good' }); if (this.sparkLog.length > 200) this.sparkLog.shift();
  }
  sparkLog: Record<string, unknown>[] = [];

  // ------------------------------------------------------------------------------------------------ the step
  /** once a sim step: rapport fades, your walk up, the guests' matches */
  step(dS: number) {
    this.rels.fade(dS / SECS, this.Tm);
    this.stepPending();
    this.games.step(dS);
  }

  // ------------------------------------------------------------------------------------------------ saving
  /** the pairs to keep: the player's and the regulars' (walk-ins are forgotten when they leave); friendship only */
  toSave(): { rels: SavedRel[]; known: string[]; chatted: string[]; seed: number } {
    const keep = (id: PersonId) => id === YOU_ID || /^r\d+$/.test(id);
    return { rels: this.rels.toSave(keep), known: [...this.known].filter(keep), chatted: [...this.chatted].filter(keep), seed: this.crowd.poolSeed };
  }
  load(saved: { rels?: SavedRel[]; known?: string[]; chatted?: string[]; seed?: number; at?: number } | undefined) {
    if (!saved || !Array.isArray(saved.rels) || saved.seed !== this.crowd.poolSeed) return 0;
    const days = saved.at ? Math.max(0, (Date.now() - saved.at) / 86400000) : 0;
    this.rels.load(saved.rels, days);
    for (const k of saved.known ?? []) this.known.add(k);
    for (const k of saved.chatted ?? []) this.chatted.add(k);
    return saved.rels.length;
  }
  /** the room settled from scratch (seed()): every guest is new, so the visit's pairs go (the regulars' kept ones stay) */
  reset() {
    const kept = this.toSave();
    this.rels.clear(); this.groups = []; this.youIn = null; this.ex = null; this.pendingYou = null; this.scored = [];
    this.games.reset();
    this.rels.load(kept.rels, 0);
  }

  // ------------------------------------------------------------------------------------------------ the checks' report
  groupsReport() {
    return this.groups.map((g) => ({ id: g.id, kind: g.kind, party: g.party, size: g.members.length, members: g.members.map((id) => (id === YOU ? 'you' : this.npc(id)?.key ?? `?${id}`)), present: g.members.filter((id) => this.present(g, id)).length, speaker: g.speaker === YOU ? 'you' : g.speaker > 0 ? this.npc(g.speaker)?.key ?? null : null, turns: g.turns, laughs: g.laughs, anchor: [+g.cx.toFixed(2), +g.cz.toFixed(2)] }));
  }
  /**
   * One sample of every group with two or more present: the speakers among the present (at most one), and each
   * present listener drawn: a body counts by its head (from the bones, within 25 degrees of the speaker's eyes), a card
   * by its body's heading (within 25 degrees of the line to the speaker); someone not drawn isn't counted.
   */
  talkSample() {
    const out = { groups: 0, multi: 0, inTwo: 0, body: [0, 0], card: [0, 0], per: [] as { id: number; size: number; speaker: string | null; faced: number; looks: number }[] };
    const seen = new Map<number, number>();
    const q = new THREE.Quaternion(), f = new THREE.Vector3();
    for (const g of this.groups) {
      for (const id of g.members) seen.set(id, (seen.get(id) ?? 0) + 1);
      const pr = g.members.filter((id) => this.present(g, id)); if (pr.length < 2) continue;
      out.groups++;
      const speakers = pr.filter((id) => id !== YOU && g.speaker === id).length; if (speakers > 1) out.multi++;
      const per = { id: g.id, size: pr.length, speaker: g.speaker > 0 ? this.npc(g.speaker)?.key ?? null : null, faced: 0, looks: 0 };
      if (g.speaker > 0 && pr.includes(g.speaker)) {
        const [sx, sz, sy] = this.headOf(g.speaker);
        for (const id of pr) {
          if (id === g.speaker || id === YOU) continue;
          const n = this.npc(id); if (!n || n.draw === 'off') continue;
          let faces = false;
          if ((n.draw === 'lod1' || n.draw === 'lod2') && n.p) {
            let head: THREE.Object3D | null = null; n.p.group.traverse((o) => { if (!head && (o as THREE.Bone).isBone && o.name === 'head') head = o; });
            const h = head as THREE.Object3D | null;
            if (h) { n.p.group.updateMatrixWorld(true); h.getWorldQuaternion(q); f.set(0, 0, 1).applyQuaternion(q); const [ex, ez] = this.headOf(id); const a = Math.atan2(f.x, f.z), b = Math.atan2(sx - ex, sz - ez); faces = Math.abs(wrap(a - b)) < (25 * Math.PI) / 180; }
            out.body[1]++; if (faces) out.body[0]++;
          } else { const b = Math.atan2(sx - n.x, sz - n.z); faces = Math.abs(wrap(n.heading - b)) < (25 * Math.PI) / 180; out.card[1]++; if (faces) out.card[0]++; }
          void sy;
          per.looks++; if (faces) per.faced++;
        }
      }
      out.per.push(per);
    }
    for (const v of seen.values()) if (v > 1) out.inTwo++;
    return out;
  }
  report() {
    return { groups: this.groups.length, sizes: this.groups.map((g) => g.members.length), youIn: this.youIn?.id ?? null, pairs: this.rels.size, matches: this.games.matches.length, exchange: this.exchange };
  }
  /** a relationship's numbers for the hooks: you and them (the default), or two guests */
  relReport(n: Npc | null, other?: Npc | null) {
    const A = other ? this.pid(other) : YOU_ID;
    if (!n) return { you: this.rels.of(YOU_ID).map((r) => this.relRow(r, YOU_ID)), pairs: this.rels.size, known: [...this.known] };
    const r = this.rels.get(A, this.pid(n));
    return { a: A, b: this.pid(n), name: n.name, ...(r ? this.relRow(r, A) : { rapport: 0, friendship: 0 }), level: levelOf(r), gettingAlong: gettingAlong(r), sharedHighlight: this.rels.sharedHighlight(A, this.pid(n)), theirs: this.rels.of(this.pid(n)).length };
  }
  private relRow(r: Rel, me: PersonId) { return { with: this.rels.other(r, me), rapport: +r.rapport.toFixed(4), friendship: +r.friendship.toFixed(4), best: +r.best.toFixed(4), level: levelOf(r), met: +r.met.toFixed(3), last: +r.last.toFixed(3), mem: r.mem.map((m) => ({ ...m, t: +m.t.toFixed(3) })), highlights: r.highlights.map((m) => ({ ...m, t: +m.t.toFixed(3) })), exchanges: r.exchanges, greatChat: r.greatChat }; }
}
