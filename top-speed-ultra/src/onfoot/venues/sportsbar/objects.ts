// Stoppage Time's smart-object catalogue (PROJECT_OC_SPORTS_BAR.md, "Smart objects"): every object type with its
// adverts (the deltas are the expected total over the action; a continuous advert's are its rates over the 5 sim-minute
// window), and every placed object with the layout slots it's used from. 41 adverts across the types, as the plan
// counts them: bar counter 4, booth 6, high-top 6, window rail 3, screens 1, standing floor 1, pool table 2, dartboard
// 1, shuffleboard 1, jukebox 1, water station 1, restroom 1, dance spot 1, patio table 7, patio rail 5. S2b makes the
// pool tables, the dartboards and the shuffleboard playable against the house player; Watch pool waits for other
// people's games (S3a's crowd), so it's in the catalogue but not offered yet (`later`).
import type { Advert, SmartObjectType, SmartObject } from '../../engine/sim/objects';
import { HIGHTOPS, PATIO_TABLES, RAIL_V, SCREENS, POOL_TABLES, DART_BOARDS, JUKEBOX } from './layout';
import type { P2 } from '../../engine/venue-def';

const W = 5;   // the scoring window (sim minutes)
const A = (action: string, label: string, deltas: Advert['deltas'], minutes: Advert['minutes'], tags: Advert['tags'], o: Partial<Advert> = {}): Advert => ({ action, label, deltas, minutes, tags, slots: [], ...o });
const order = (where: 'bar' | 'table'): Advert[] => [
  A('order-drink', 'Order a drink', { thirst: 42, social: 3 }, [6, 7], ['drink'], { overlay: true, wait: where === 'bar' ? [4, 8] : [68, 108], requires: ['open', 'staffed', 'notHolding:drink', ...(where === 'table' ? ['seated' as const] : [])] }),
  A('order-food', 'Order food', { hunger: 45, energy: 5 }, [4, 6], ['food'], { overlay: true, wait: where === 'bar' ? [60, 180] : [98, 278], requires: ['open', 'staffed', 'notHolding:food', ...(where === 'table' ? ['seated' as const] : [])] }),
];
const watch = (label = 'Watch the game'): Advert => A('watch', label, { fun: 2.5 * W, social: 1 * W }, 'continuous', ['watch'], { requires: ['open', 'screenInView'] });
const sit = A('sit', 'Sit', { energy: 0.8 * W }, 'continuous', ['rest']);
const eat = A('eat', 'Eat', { hunger: 10 * W }, 'continuous', ['food'], { requires: ['holding:food'] });
const chat = A('chat', 'Chat with the table', { social: 12, fun: 1 }, [4, 6], ['social']);
const peopleWatch = A('people-watch', 'People-watch', { fun: 0.8 * W, energy: 0.8 * W }, 'continuous', ['rest']);
const freeway = A('watch-freeway', 'Watch the freeway', { fun: 1 * W, energy: 0.8 * W }, 'continuous', ['rest']);

export const TYPES: Record<string, SmartObjectType & { later?: string[] }> = {
  'bar-counter': { type: 'bar-counter', label: 'The bar', adverts: [...order('bar'), A('lean-chat', 'Lean and chat', { social: 12 }, [5, 5], ['social']), watch('Watch the bar screens')] },
  booth: { type: 'booth', label: 'A booth', adverts: [sit, eat, chat, watch(), ...order('table')] },
  'high-top': { type: 'high-top', label: 'A high-top', adverts: [sit, eat, chat, watch(), ...order('table')] },
  'window-rail': { type: 'window-rail', label: 'The window rail', adverts: [sit, eat, peopleWatch] },
  screen: { type: 'screen', label: 'A screen', adverts: [watch()] },
  'standing-floor': { type: 'standing-floor', label: 'The standing floor', adverts: [A('stand-watch', 'Stand and watch', { fun: 2.5 * W, energy: -0.4 * W }, 'continuous', ['watch'], { requires: ['open'] })] },
  'pool-table': { type: 'pool-table', label: 'A pool table', later: ['watch-pool'], adverts: [A('play-pool', 'Play pool', { fun: 40, social: 15, energy: -4 }, [5, 8], ['game'], { party: [2, 4], requires: ['open'] }), A('watch-pool', 'Watch pool', { fun: 8 }, [4, 4], ['watch'])] },
  dartboard: { type: 'dartboard', label: 'A dartboard', adverts: [A('play-darts', 'Play darts', { fun: 30, social: 10 }, [3, 5], ['game'], { party: [1, 2], requires: ['open'] })] },
  shuffleboard: { type: 'shuffleboard', label: 'The shuffleboard', adverts: [A('play-shuffleboard', 'Play shuffleboard', { fun: 35, social: 12 }, [5, 7], ['game'], { party: [2, 4], requires: ['open'] })] },
  jukebox: { type: 'jukebox', label: 'The jukebox', adverts: [A('song', 'Pick a song', { fun: 6 }, [20 / 60, 20 / 60], ['music'], { requires: ['open'] })] },
  'water-station': { type: 'water-station', label: 'The water station', adverts: [A('water', 'Get water', { thirst: 20 }, [15 / 60, 15 / 60], ['drink'], { requires: ['open'] })] },
  restroom: { type: 'restroom', label: 'The restrooms', adverts: [A('restroom', 'Restroom', { bladder: 100 }, [1, 2], ['comfort'], { requires: ['npcOnly'] })] },
  'dance-spot': { type: 'dance-spot', label: 'The dance spot', adverts: [A('dance', 'Dance', { fun: 35, social: 10, energy: -12 }, [3, 5], ['dance'], { requires: ['open', 'gameNight'] })] },
  'patio-table': { type: 'patio-table', label: 'A patio table', adverts: [sit, eat, chat, watch('Watch the patio screens'), ...order('table'), freeway] },
  'patio-rail': { type: 'patio-rail', label: 'The patio rail', adverts: [sit, eat, chat, watch('Watch the patio screens'), freeway] },
};
/** the number of adverts across the catalogue's types (the plan's 41) */
export const ADVERT_COUNT = Object.values(TYPES).reduce((a, t) => a + t.adverts.length, 0);

const O = (id: string, type: string, label: string, slots: string[], at: P2, size: P2, y: [number, number]): SmartObject => ({ id, type, label, slots, at, size, y });
/** the jukebox's own use spot, in front of it on the standing floor (it has no layout slot: the jukebox stands against
 *  the south wall at (32.0, 0.95)) */
export const JUKEBOX_SPOT: P2 = [JUKEBOX[0], 1.75];
/** the 12 of the standing floor's 20 spots that are the dance spot on game nights (nearest the big screen) */
export const DANCE_SLOTS = [33.1, 34.0, 34.9].flatMap((u) => [2.75, 3.65, 4.55, 5.45].map((v) => `standing ${u} ${v}`));

export function placed(): SmartObject[] {
  const out: SmartObject[] = [];
  out.push(O('bar', 'bar-counter', 'The bar', [...Array.from({ length: 9 }, (_, k) => `bar stool ${k + 1}`), ...[1, 2, 3, 4].map((k) => `bar gap ${k}`)], [20.4, 13.67], [12.8, 0.75], [0, 1.25]));
  for (let b = 0; b < 5; b++) {
    const u0 = 20.5 + 2.15 * b, ids = (['east', 'west'] as const).flatMap((side) => [1.15, 1.95].map((v) => `booth ${b + 1} ${side} ${v}`));
    out.push(O(`booth-${b + 1}`, 'booth', `Booth ${b + 1}`, ids, [u0 + 1.075, 1.55], [2.15, 1.6], [0, 1.2]));
  }
  HIGHTOPS.forEach((c, t) => out.push(O(`high-top-${t + 1}`, 'high-top', `High-top ${t + 1}`, ['w', 'e', 'n', 's'].map((s) => `high-top ${t + 1} ${s}`), c, [0.75, 0.75], [0, 1.15])));
  out.push(O('rail-south', 'window-rail', 'The window rail', RAIL_V.slice(0, 4).map((v) => `rail stool v ${v}`), [2.3, 4.4], [0.6, 3.8], [0, 1.15]));
  out.push(O('rail-north', 'window-rail', 'The window rail', RAIL_V.slice(4).map((v) => `rail stool v ${v}`), [4.6, 12.5], [0.6, 5], [0, 1.15]));
  for (const s of SCREENS) out.push(O(`screen-${s.id}`, 'screen', s.id === 'big' ? 'The big screen' : 'A screen', [], s.at, s.face[0] ? [0.3, s.w] : [s.w, 0.3], [s.y - s.h / 2, s.y + s.h / 2]));
  out.push(O('standing-floor', 'standing-floor', 'The standing floor', [32.2, 33.1, 34.0, 34.9].flatMap((u) => [2.75, 3.65, 4.55, 5.45, 6.35].map((v) => `standing ${u} ${v}`)), [33.5, 4.7], [4, 7.8], [0, 0.05]));
  out.push(O('dance-spot', 'dance-spot', 'The dance spot', DANCE_SLOTS, [34.0, 4.1], [2.7, 3.6], [0, 0.05]));
  POOL_TABLES.forEach((p, i) => out.push(O(`pool-${i + 1}`, 'pool-table', `Pool table ${i + 1}`, [], p, [1.25, 2.24], [0, 0.95])));
  DART_BOARDS.forEach((u, i) => out.push(O(`darts-${i + 1}`, 'dartboard', `Dartboard ${i + 1}`, [], [u, 15.9], [0.9, 0.3], [1.3, 2.2])));
  out.push(O('shuffleboard', 'shuffleboard', 'The shuffleboard', ['shuffleboard thrower', 'shuffleboard side 1', 'shuffleboard side 2'], [6.55, 1.45], [6.7, 0.6], [0, 0.95]));
  out.push(O('jukebox', 'jukebox', 'The jukebox', [], JUKEBOX, [0.7, 0.5], [0, 1.6]));
  out.push(O('water', 'water-station', 'The water station', ['water'], [29.3, 11.4], [0.6, 0.4], [0, 1.35]));
  out.push(O('restrooms', 'restroom', 'The restrooms', [], [29.3, 11.62], [3.4, 0.1], [0, 2.3]));
  PATIO_TABLES.forEach((u, k) => out.push(O(`patio-table-${k + 1}`, 'patio-table', `Patio table ${k + 1}`, (['east', 'west'] as const).flatMap((s) => [-0.9, -1.7].map((v) => `patio table ${k + 1} ${s} ${v}`)), [u, -1.3], [1.5, 1.6], [0, 0.95])));
  out.push(O('patio-rail', 'patio-rail', 'The patio rail', Array.from({ length: 6 }, (_, k) => `patio rail stool ${k + 1}`), [6.25, -5.0], [6.5, 0.7], [0, 1.15]));
  return out;
}
/** the table surfaces empties and served items are set down on (frame u, v, height): the counter's customer edge, the
 *  booth tables, the high-tops, the patio tables, the window rails' shelves */
export function surfaces(): { at: P2; y: number; object: string }[] {
  const out: { at: P2; y: number; object: string }[] = [];
  for (let k = 0; k < 24; k++) out.push({ at: [14.4 + k * 0.52, 13.55], y: 1.22, object: 'bar' });
  for (let b = 0; b < 5; b++) for (const dv of [-0.18, 0.18]) out.push({ at: [20.5 + 2.15 * b + 1.075, 1.55 + dv], y: 0.95, object: `booth-${b + 1}` });
  HIGHTOPS.forEach(([u, v], t) => { for (const [du, dv] of [[0.12, 0.12], [-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12]]) out.push({ at: [u + du, v + dv], y: 1.17, object: `high-top-${t + 1}` }); });
  PATIO_TABLES.forEach((u, k) => { for (const v of [-0.9, -1.7]) for (const du of [-0.18, 0.18]) out.push({ at: [u + du, v], y: 0.93, object: `patio-table-${k + 1}` }); });
  return out;
}
