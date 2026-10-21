// Where Lot 57 sits, and the frame the page works in.
//   Game coordinates: x east, z south, metres from 33.72 N, 117.83 W (the driving game's own projection; the Anaheim
//   data in src/data/anaheim uses it too). The test hooks take and report game coordinates.
//   Local coordinates: the same axes, moved so the venue sits near the origin (small numbers on the GPU).
// Every size below is our own design (PROJECT_OC_ON_FOOT.md, "Site plan"); the street positions come from the data.

export const ORIGIN = { x: -5100, z: -8350 };
/** the venue's open-data anchor, in game coordinates (src/data/anaheim/slice.json "venue") */
export const ANCHOR = { x: -5121.2, z: -8345.4 };
/** the game's terrain height under the site (flat: 43.8 to 46.1 m over 400 m x 300 m) */
export const GROUND_M = 45.1;

export const toLocal = (gx: number, gz: number): [number, number] => [gx - ORIGIN.x, gz - ORIGIN.z];
export const toGame = (lx: number, lz: number): [number, number] => [lx + ORIGIN.x, lz + ORIGIN.z];

/** the part of the block our layout replaces (local): the real footprints and lot features inside it are dropped */
export const SITE = { x0: -54, x1: 58, z0: -49, z1: 56.5 };

// the site plan, local metres (game x = local + -5100, game z = local + -8350)
export const PLAN = {
  shed: { x0: -48, x1: -20, z0: -44, z1: 8, eave: 7.2, peak: 9.4 },
  yard: { x0: -20, x1: 22, z0: -44, z1: 8 },
  lawn: { x0: 22, x1: 52, z0: -44, z1: -16 },
  trucks: { x0: 22, x1: 52, z0: -14, z1: 8 },
  frontage: { z: -48, x0: -48, x1: 52, gate: [-4, 4] as [number, number] },
  southFence: { z: 10, x0: -20, x1: 52, gate: [-8, -2] as [number, number] },
  eastFence: { x: 52 },
  lotWalk: { z0: 10, z1: 17.85 },
  lot: { x0: -49.5, x1: 57.5, z0: 17.85, z1: 56.4, aisles: [27, 47], aisleW: 7.3, stallW: 2.75, stallD: 5.5 },
  sign: { x: -49.6, z: -47 },
  // Dupont Drive's kerbs beside the lot (the loop's centreline from the data, less half of an 11 m street)
  dupontWestKerb: -56.4, dupontEastKerb: 62.8,
};

/** the Shed's inside (local), for "walking only indoors" */
export const inShed = (x: number, z: number) => x > PLAN.shed.x0 && x < PLAN.shed.x1 && z > PLAN.shed.z0 && z < PLAN.shed.z1;
/** inside the venue's fence (Shed, yard, lawn, trucks and the frontage strip) */
export const inVenue = (x: number, z: number) => x > PLAN.shed.x0 && x < PLAN.eastFence.x && z > PLAN.frontage.z && z < PLAN.southFence.z;

// the walkable edge for phase 1: the block inside the Dupont loop, and the Orangewood sidewalks from State College
// Boulevard (game x about -5482) to the stadium-entrance signal (x about -4812)
export const EDGE = { x0: -5482 - ORIGIN.x, x1: -4812 - ORIGIN.x, z0: -8446 - ORIGIN.z, z1: -8372 - ORIGIN.z };
