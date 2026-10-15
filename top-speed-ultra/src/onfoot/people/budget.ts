// Which level of detail a person gets, by distance from the camera (metres) and quality. LOD 0 is the conversation
// and close third-person shot (separate face, eyes, hair cards, clothes); LOD 1 the patio distance (one skinned mesh
// with vertex colours); LOD 2 the far crowd (one coarse skinned mesh). Measured costs: PROJECT_OC_ON_FOOT.md.
import type { Quality } from './params';

export const LOD_RANGES: Record<Quality, [number, number]> = {
  high: [3.5, 14],    // desktop leads: full detail out to a few metres, LOD 1 across the whole patio
  phone: [2.2, 8],    // phone: full detail only for the person you're talking to
};

export function lodFor(distance: number, quality: Quality): 0 | 1 | 2 {
  const [a, b] = LOD_RANGES[quality];
  return distance < a ? 0 : distance < b ? 1 : 2;
}
