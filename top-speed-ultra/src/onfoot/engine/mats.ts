// The engine facade: the baked night-light channels and the material patch that reads them (Lot 57's mats.ts). The
// bar builds its own materials (venues/sportsbar/mats.ts) and never calls makeMats.
export { GLOW, glowify } from '../lot57/mats';
export type { Quality } from '../lot57/mats';
