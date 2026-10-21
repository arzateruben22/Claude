// Homes (the Lifestyle menu, owner 2026-10-21: "homes and properties" first in the life half). Nine fictional homes in
// real Orange County neighbourhoods: our own names and designs, no real address, listing or business. Bought only with
// credits earned by driving (no real money, ever). Each one owned adds garage slots and is a place to start a drive
// from: the nearest real exit to it (Game.nearestExit). The interior style names the walk-in room it gets.
// Positions are a neighbourhood's middle (lat, lon), projected like the road data (Game: LAT0 33.72, LON0 -117.83).
import { slotsFor } from './cars';

export type HomeStyle = 'studio' | 'craftsman' | 'loft' | 'bungalow' | 'modern' | 'ranch' | 'retreat' | 'penthouse' | 'clifftop';
export interface Home {
  id: string; name: string; area: string; blurb: string;
  lat: number; lon: number;
  price: number; level: number;
  slots: number;               // garage slots it adds
  style: HomeStyle;
}

export const HOMES: Home[] = [
  { id: 'orangewood', name: 'Orangewood Studio', area: 'Anaheim', style: 'studio', lat: 33.794, lon: -117.879, price: 8000, level: 1, slots: 1,
    blurb: 'A one-room studio over a tyre shop, two blocks from Lot 57. The 57 is at the end of the street.' },
  { id: 'old-towne', name: 'Old Towne Craftsman', area: 'Orange', style: 'craftsman', lat: 33.787, lon: -117.853, price: 22000, level: 3, slots: 1,
    blurb: 'A 1920s craftsman with a deep porch and a detached garage, off the Plaza. The 55 and the 22 are minutes away.' },
  { id: 'legacy', name: 'Legacy Loft', area: 'Tustin', style: 'loft', lat: 33.705, lon: -117.826, price: 32000, level: 4, slots: 1,
    blurb: 'A loft in a converted hangar workshop: concrete floors, steel windows, your car parked inside.' },
  { id: 'surf-city', name: 'Surf City Bungalow', area: 'Huntington Beach', style: 'bungalow', lat: 33.664, lon: -118.0, price: 48000, level: 6, slots: 2,
    blurb: 'A beach bungalow six streets from the sand, with a two-car garage and a board rack. The 405 is a straight run north.' },
  { id: 'turtle-rock', name: 'Turtle Rock Modern', area: 'Irvine', style: 'modern', lat: 33.646, lon: -117.811, price: 75000, level: 8, slots: 2,
    blurb: 'Glass and white stucco on the hill, a gallery garage under the house. The 405, the 133 and the 73 are all close.' },
  { id: 'hills-ranch', name: 'Hills Ranch', area: 'Anaheim Hills', style: 'ranch', lat: 33.848, lon: -117.762, price: 95000, level: 9, slots: 3,
    blurb: 'A single-storey ranch house with a three-bay garage and a view down the canyon. The 91 and the 241 meet below.' },
  { id: 'canyon', name: 'Canyon Retreat', area: 'Laguna Canyon', style: 'retreat', lat: 33.567, lon: -117.766, price: 130000, level: 11, slots: 2,
    blurb: 'Timber and stone among the sycamores, a quiet drive down the 133 to the coast.' },
  { id: 'newport', name: 'Bay Penthouse', area: 'Newport Beach', style: 'penthouse', lat: 33.615, lon: -117.874, price: 180000, level: 13, slots: 3,
    blurb: 'The top floor over the bay, a private lift to a three-car bay below. The 73 starts at the door.' },
  { id: 'clifftop', name: 'Clifftop House', area: 'Dana Point', style: 'clifftop', lat: 33.465, lon: -117.7, price: 240000, level: 15, slots: 3,
    blurb: 'A wide low house on the bluff over the harbour, a four-car gallery and the whole Pacific. The 5 runs south from here.' },
];
export const homeById = (id: string) => HOMES.find((h) => h.id === id);

// the road data's projection (Game.ts, the network's LAT0/LON0)
const LAT0 = 33.72, LON0 = -117.83, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
export function homeXZ(h: Home) { return { x: (h.lon - LON0) * KX, z: -(h.lat - LAT0) * KZ }; }

// garage slots: the level's (1 + level/4, at most 6) plus what your homes add, at most 12
export const GARAGE_MAX = 12;
export function garageSlots(level: number, homes: string[]) {
  return Math.min(GARAGE_MAX, slotsFor(level) + homes.reduce((n, id) => n + (homeById(id)?.slots ?? 0), 0));
}
