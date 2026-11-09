// The engine facade: the baked night-light channels and the material patch that reads them (Lot 57's mats.ts). The
// bar builds its own materials (venues/sportsbar/mats.ts) and never calls makeMats.
export { GLOW, glowify } from '../lot57/mats';
// The bar's presets keep their names (low, high, ultra; 'high' is shown as HD). Lot 57 renamed its own to low, hd and
// ultra at P1d (lot57/mats.ts), which the bar doesn't read.
export type Quality = 'low' | 'high' | 'ultra';
