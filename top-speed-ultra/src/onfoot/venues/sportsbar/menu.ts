// Our menu (PROJECT_OC_SPORTS_BAR.md, "Ordering and the menu (ours)"). Every name is ours. Ordering for yourself is
// free; there are no prices in any currency. You drove here, so the player's drinks are alcohol-free; NPCs may hold
// "a pint", a plain unlabelled glass, as part of the scene (S3a), never offered to the player.
import type { Need } from '../../engine/sim/needs';
import type { ItemModel } from '../../engine/sim/held';

export interface BarItem {
  id: string; name: string; note: string; kind: 'drink' | 'food';
  /** the total change over the item: a drink's sips add up to its thirst; a basket's hunger is eaten at +10 a minute */
  deltas: Partial<Record<Need, number>>;
  /** seconds to make it: the bartender's 4 to 8 s for a drink, the kitchen's 60 to 180 s for food */
  prep: [number, number];
  /** sips (drinks) or bites (food: the bite clip's beats while eating) */
  count: number;
  model: ItemModel; color: number;
  /** a tag the lines can use */
  tag: string;
  alcohol: false;
}
const D = (id: string, name: string, note: string, color: number, extra: Partial<Record<Need, number>> = {}, tag = 'drink'): BarItem =>
  ({ id, name, note, kind: 'drink', deltas: { thirst: 42, ...extra }, prep: [4, 8], count: 6, model: 'glass', color, tag, alcohol: false });
const F = (id: string, name: string, note: string, hunger: number, color: number, extra: Partial<Record<Need, number>> = {}, tag = 'food'): BarItem =>
  ({ id, name, note, kind: 'food', deltas: { hunger, energy: 5, ...extra }, prep: [60, 180], count: 6, model: 'basket', color, tag, alcohol: false });

export const DRINKS: BarItem[] = [
  D('lime-soda', 'Added-Time lime soda', 'Lime, a little salt, lots of ice', 0xb9e04c, {}, 'soda'),
  D('tamarindo', 'Tamarindo agua fresca', 'Sweet and tart, over ice', 0x9a6232, {}, 'agua'),
  D('cucumber', 'Cucumber-chile cooler', 'Cucumber, lime and a little chile', 0xbfe0a4, {}, 'cooler'),
  D('zero-lager', 'Zero-proof lager', 'Non-alcoholic lager, 0.0%', 0xe8b03c, {}, 'zero'),
  D('cafe-olla', 'Iced café de olla', 'Cinnamon and piloncillo coffee, iced', 0x4f3020, { energy: 15 }, 'coffee'),
  D('float', 'Root beer float', 'Root beer and vanilla', 0x6a3422, { fun: 3 }, 'float'),
  D('water', 'Water', 'Ice water (also self-serve by the restrooms)', 0xd2e8f4, { thirst: 30 }, 'water'),
];
export const FOODS: BarItem[] = [
  F('wings', 'Wings', 'Katella hot, lemon-pepper or mango-habanero', 50, 0xc85a2c, {}, 'wings'),
  F('asada-fries', 'Carne asada loaded fries', 'Fries, carne asada, crema, pico', 55, 0xd8a444, {}, 'fries'),
  F('nachos', 'Street-corn nachos', 'Charred corn, cotija, lime', 45, 0xe6c454, {}, 'nachos'),
  F('smash', 'Smash burger', 'Two thin patties, onions, pickles', 60, 0x8e5432, {}, 'burger'),
  F('sliders', 'Al pastor sliders', 'Three, with pineapple', 50, 0xc46634, {}, 'sliders'),
  F('quesadilla', 'Veggie quesadilla', 'Peppers, onions, jack cheese', 45, 0xe2bc66, {}, 'quesadilla'),
  F('pretzel', 'Pretzel bites with queso', 'Salted, warm, with a cup of queso', 35, 0xb47c3c, { fun: 2 }, 'pretzel'),
  F('churro', 'Churro bites', 'Cinnamon sugar, chocolate to dip', 35, 0xca9450, { fun: 2 }, 'churros'),
];
/** the player's menu: every item alcohol-free (the data check reads `alcohol` on each) */
export const PLAYER_MENU: BarItem[] = [...DRINKS, ...FOODS];
export const itemById = (id: string) => PLAYER_MENU.find((i) => i.id === id) ?? null;
export const MENU_NOTE = 'You drove here, so your drinks are alcohol-free. On the house.';
/** an empty glass and an empty basket, as left on a table (instance colours) */
export const EMPTY = { glass: 0xc9d4da, basket: 0xe8e2d4 };
