// COPY of lot57 main.ts PRESET: E0 replaces it with engine/quality.ts (PROJECT_OC_SPORTS_BAR.md, the module map's
// main.ts row). The High and Ultra rows are L1 as measured at claude/onfoot ab9fbe1 (2026-11-02); the Low row differs
// from L1 on purpose, per decision 15 (the Retro look at full resolution: render scale 1, pixel ratio up to 2 and
// never under 1, the Retro style on, still no shadow map; until claude/modes merges, Low draws with the standard
// materials at full resolution). The pause sheet's buttons read Low, HD and Ultra over these ids.
import type { Quality } from '../../engine/mats';

export interface Preset { shadows: number; post: boolean; bloom: boolean; ao: boolean; msaa: number; maxPR: number; minPR: number; scale: number; lights: number; people: 'phone' | 'high'; tex: number; style: 'retro' | 'standard'; cars: 'phone' | 'high'; far: 'simple' | 'full' }
export const PRESET: Record<Quality, Preset> = {
  low: { shadows: 0, post: false, bloom: false, ao: false, msaa: 0, maxPR: 2, minPR: 1, scale: 1, lights: 0, people: 'phone', tex: 512, style: 'retro', cars: 'phone', far: 'simple' },
  high: { shadows: 2048, post: true, bloom: true, ao: false, msaa: 4, maxPR: 2, minPR: 0.5, scale: 1, lights: 4, people: 'high', tex: 1024, style: 'standard', cars: 'phone', far: 'simple' },
  ultra: { shadows: 4096, post: true, bloom: true, ao: true, msaa: 4, maxPR: 2, minPR: 0.5, scale: 1, lights: 8, people: 'high', tex: 1024, style: 'standard', cars: 'high', far: 'full' },
};
export const LABEL: Record<Quality, string> = { low: 'Low', high: 'HD', ultra: 'Ultra' };
