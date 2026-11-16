// COPY of lot57 main.ts PRESET: E0 replaces it with engine/quality.ts (PROJECT_OC_SPORTS_BAR.md, the module map's
// main.ts row). Re-synced at S4 (2026-11-09) with Lot 57's P1d (claude/onfoot 3386549, merged at 5c572f6; L1
// re-measured): the ids are low, hd and ultra; the HD and Ultra rows equal Lot 57's field for field. The Low row
// differs from Lot 57's in one field, on purpose: no shadow map (Lot 57's P1d Low draws a 1024 hard sun map; the bar's
// Low doesn't, for its whole-frame budget: owner question 1, O18). Like Lot 57's, Low is the Retro look at full
// resolution (render scale 1, pixel ratio up to 2; the bar also never goes under 1), drawn by Lot 57's Retro module
// (look.ts). minPR, style, cars and far are the bar's own fields. The pause sheet's buttons read Low, HD and Ultra.
import type { Quality } from '../../engine/mats';

export interface Preset { shadows: number; post: boolean; bloom: boolean; ao: boolean; msaa: number; maxPR: number; minPR: number; scale: number; lights: number; people: 'phone' | 'high'; tex: number; style: 'retro' | 'standard'; cars: 'phone' | 'high'; far: 'simple' | 'full' }
export const PRESET: Record<Quality, Preset> = {
  low: { shadows: 0, post: false, bloom: false, ao: false, msaa: 0, maxPR: 2, minPR: 1, scale: 1, lights: 0, people: 'phone', tex: 512, style: 'retro', cars: 'phone', far: 'simple' },
  hd: { shadows: 2048, post: true, bloom: true, ao: false, msaa: 4, maxPR: 2, minPR: 0.5, scale: 1, lights: 4, people: 'high', tex: 1024, style: 'standard', cars: 'phone', far: 'simple' },
  ultra: { shadows: 4096, post: true, bloom: true, ao: true, msaa: 4, maxPR: 2, minPR: 0.5, scale: 1, lights: 8, people: 'high', tex: 1024, style: 'standard', cars: 'high', far: 'full' },
};
export const LABEL: Record<Quality, string> = { low: 'Low', hd: 'HD', ultra: 'Ultra' };
