// Three drivers, each in a male or female presentation (cosmetic only: hands, sleeves, what's on the wrist), each
// with one ability on a cooldown. The abilities change the world, not the scoring rules: Speed Survival still
// counts every pass and every crash the same way.

export type AbilityId = 'clear' | 'focus' | 'grip';
export type DriverId = 'closer' | 'ace' | 'wrench';
export type Presentation = 'm' | 'f';

export interface AbilityDef { id: AbilityId; name: string; blurb: string; duration: number; cooldown: number }
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  // 35% fewer cars, by flow and spawning: cars ahead move out of your lane and fewer join beyond the haze.
  // Nothing in view disappears.
  clear: { id: 'clear', name: 'Clear Path', blurb: 'Traffic eases off 35% for 8 s: cars ahead move over, fewer join. Nothing vanishes in view.', duration: 8, cooldown: 45 },
  // the world (traffic, its lights and sounds) runs at 70% speed; you and your car don't
  focus: { id: 'focus', name: 'Focus Time', blurb: 'The world slows to 70% for 5 s. Your car doesn\'t.', duration: 5, cooldown: 40 },
  // tyres bite: grip x1.3 (it beats the rain)
  grip: { id: 'grip', name: 'Locked In', blurb: '30% more grip for 7 s, rain or shine.', duration: 7, cooldown: 35 },
};

export interface DriverLook {
  skin: number; sleeve: number | null; gloves: number | null;
  watch: 'gold' | 'steel' | 'smart' | null; ring: boolean; bracelet: boolean; scale: number;
  pose: 'watch' | 'wave' | 'knee';                  // what the left hand does when the ability fires
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
  if (id === 'closer') return { skin, sleeve: pres === 'f' ? 0xe9e4da : 0xf2f2f0, gloves: null, watch: 'gold', ring: true, bracelet: pres === 'f', scale, pose: 'watch' };
  if (id === 'ace') return { skin, sleeve: 0x1b1b1d, gloves: 0x121214, watch: null, ring: false, bracelet: false, scale, pose: 'wave' };
  return { skin, sleeve: null, gloves: null, watch: 'smart', ring: pres === 'f', bracelet: false, scale, pose: 'knee' };
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
