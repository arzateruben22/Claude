// Three drivers, each in a male or female presentation (cosmetic only: hands, sleeves, what's on the wrist), each
// with one ability on a cooldown. (2026-11-11) The driver's APPEARANCE now comes from the chosen character
// (src/onfoot/cast.ts, Settings.character) when the player has picked one: characterLook below. The archetype
// (DRIVERS) stays a separate gameplay choice: its ability, its off-wheel pose and its signature colour.
// The abilities change the world, not the scoring rules: Speed Survival still counts every pass and every crash the
// same way.

import { castById, CastEntry } from '../onfoot/cast';

export type AbilityId = 'clear' | 'focus' | 'grip';
export type DriverId = 'closer' | 'ace' | 'wrench';
export type Presentation = 'm' | 'f';

export interface AbilityDef { id: AbilityId; name: string; blurb: string; duration: number; cooldown: number }
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  // 35% fewer cars, by flow and spawning: cars ahead move out of your lane and fewer join beyond the haze.
  // Nothing in view disappears.
  clear: { id: 'clear', name: 'Clear Path', blurb: 'Traffic eases off 35% for 6 s: cars ahead move over, fewer join. Nothing vanishes in view.', duration: 6, cooldown: 45 },
  // the world (traffic, its lights and sounds) runs at 70% speed; you and your car don't
  focus: { id: 'focus', name: 'Focus Time', blurb: 'The world slows to 70% for 5 s. Your car doesn\'t.', duration: 5, cooldown: 40 },
  // tyres bite: grip x1.3 (it beats the rain)
  grip: { id: 'grip', name: 'Locked In', blurb: '30% more grip for 5 s, rain or shine.', duration: 5, cooldown: 35 },
};

export interface DriverLook {
  skin: number; sleeve: number | null; gloves: number | null;
  watch: 'gold' | 'steel' | 'smart' | null; ring: boolean; bracelet: boolean; scale: number;
  pose: 'watch' | 'wave' | 'knee';                  // what the left hand does when the ability fires
  outfit?: 'shirt' | 'suit' | 'work'                // the sleeves: a pressed shirt's cuffs, a fire suit, a work shirt rolled up
    | 'jacket' | 'fur';                             // (pack, 2026-11-12) a suit jacket's sleeve over a sliver of shirt cuff; a fur shrug's sleeve from mid forearm (hands-acc.ts)
  cuff?: number;                                    // (pack) the shirt cuff's colour under a 'jacket' sleeve
  accent?: number;                                  // the driver's signature colour (the UI's --drv), for the trim
  nails?: number | null;                            // the female presentation's polish (null: natural); unset: the caller's choice
}
export interface DriverDef { id: DriverId; name: string; title: string; blurb: string; ability: AbilityId }

export const DRIVERS: DriverDef[] = [
  { id: 'closer', name: 'The Closer', title: 'Dealmaker', blurb: 'Pressed shirt, heavy gold watch, never late. Checks the time and the road opens up.', ability: 'clear' },
  { id: 'ace', name: 'The Ace', title: 'Racer', blurb: 'Gloves on, eyes up. Everything slows down when it matters.', ability: 'focus' },
  { id: 'wrench', name: 'The Wrench', title: 'Engineer', blurb: 'Sleeves rolled, one hand on the wheel. Knows exactly how much grip is left.', ability: 'grip' },
];

export const SKINS = [0xf1c6a5, 0xd9a37f, 0xb67a52, 0x8a5536, 0x5c3a24];

export function lookFor(id: DriverId, pres: Presentation, skinIdx: number): DriverLook {
  const skin = SKINS[Math.max(0, Math.min(SKINS.length - 1, skinIdx))];
  const scale = pres === 'f' ? 0.9 : 1;
  // the Closer: a pressed white (ivory for her) shirt with buttoned cuffs, the gold watch, a red polish; the Ace: a
  // black ribbed fire suit over knit cuffs and the R chevron patch, black racing gloves; the Wrench: an olive work shirt rolled
  // up past the forearm (a faint tan line), the smart watch with its green grip readout
  if (id === 'closer') return { skin, sleeve: pres === 'f' ? 0xe9e4da : 0xf2f2f0, gloves: null, watch: 'gold', ring: true, bracelet: pres === 'f', scale, pose: 'watch', outfit: 'shirt', accent: 0xffd166, nails: pres === 'f' ? 0xb4111c : null };
  if (id === 'ace') return { skin, sleeve: 0x1b1b1d, gloves: 0x121214, watch: null, ring: false, bracelet: false, scale, pose: 'wave', outfit: 'suit', accent: 0xb9a6ff, nails: null };
  return { skin, sleeve: null, gloves: null, watch: 'smart', ring: pres === 'f', bracelet: false, scale, pose: 'knee', outfit: 'work', accent: 0x7dffa8, nails: null };
}

// A bought driver style (src/store/cosmetics.json, type 'style': Night Shift, Golden Hour, Canyon Run), as the parts
// it overrides. The rule (2026-11-11): a style, when one is equipped, applies ON TOP of the character's own arms: its
// gloves, its watch and its sleeve (colour and end: 'knit' a ribbed cuff, 'cuff' a buttoned cuff) replace the
// character's, and its nail colour applies to a female presentation only; the skin tone and the hand shape stay the
// character's. (No equip slot for styles exists yet: their status is 'hook'. This is the function it will call.)
export interface DriverStyle { gloves: number | null; watch: 'gold' | 'steel' | 'smart' | null; sleeve: number; end: 'knit' | 'cuff'; nails: number | null }
export function withStyle(look: DriverLook, style: DriverStyle | null, pres: Presentation): DriverLook {
  if (!style) return look;
  return { ...look, gloves: style.gloves, watch: style.watch, sleeve: style.sleeve, outfit: style.end === 'knit' ? 'suit' : 'shirt', nails: pres === 'f' ? style.nails : look.nails };
}

/**
 * The driver's look with a character chosen: the character's skin tone, sleeves (colour and the closest sleeve the
 * hands have), watch, wrist and nails (cast.ts CastEntry.arms), on the archetype's pose (the ability's animation) and
 * its signature colour. No gloves: the six drive bare-handed. Without a character (an old save, or a new player who
 * hasn't picked one), it is lookFor's archetype look, exactly as before.
 */
export function characterLook(id: DriverId, character: string, pres: Presentation, skinIdx: number, style: DriverStyle | null = null): { look: DriverLook; presentation: Presentation; cast: CastEntry | null } {
  const c = castById(character);
  const base = lookFor(id, pres, skinIdx);
  if (!c) return { look: withStyle(base, style, pres), presentation: pres, cast: null };
  const a = c.arms, p = c.presentation;
  const look: DriverLook = {
    skin: c.look.skin, sleeve: a.sleeve, gloves: null, watch: a.watch, ring: a.ring, bracelet: a.bracelet, scale: p === 'f' ? 0.9 : 1,
    pose: base.pose, outfit: a.outfit, accent: base.accent, nails: a.nails,
    ...(a.cuff !== undefined ? { cuff: a.cuff } : {}),
  };
  return { look: withStyle(look, style, p), presentation: p, cast: c };
}

// one ability's clock: active for `duration`, then cooling down
export class Ability {
  active = 0; cool = 0;
  constructor(public def: AbilityDef) {}
  get ready() { return this.active <= 0 && this.cool <= 0; }
  get on() { return this.active > 0; }
  // 0..1: how much of the cooldown is left (1 just used, 0 ready)
  get coolFrac() { return this.cool > 0 ? this.cool / this.def.cooldown : 0; }
  trigger() { if (!this.ready) return false; this.active = this.def.duration; return true; }
  // returns 'start' | 'end' | null on the step it changes
  update(dt: number): 'end' | null {
    if (this.active > 0) { this.active -= dt; if (this.active <= 0) { this.active = 0; this.cool = this.def.cooldown; return 'end'; } return null; }
    if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
    return null;
  }
  reset() { this.active = 0; this.cool = 0; }
}
