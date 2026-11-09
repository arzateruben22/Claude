// Sign census for docs/specs/SIGNS_SPEC.md: the guide signs on the test stretch and network-wide counts (dropped
// destinations, close exit pairs, gantry spacing, distinct textures). Bundle and run with esbuild:
//   npx esbuild tools/signs-census.ts --bundle --platform=node --format=esm --loader:.json=json --outfile=tests/out/signs-census.mjs && node tests/out/signs-census.mjs
import { Network } from '../src/game/world/Network';
import { STRETCH } from '../src/preview/spec';
const net = await Network.load();
const path = net.mains.find((m) => m.label === STRETCH.label)!;
const s0 = path.ctrlS[STRETCH.ctrl0], s1 = path.ctrlS[STRETCH.ctrl1];
console.log('stretch', STRETCH.label, 's0', s0.toFixed(0), 's1', s1.toFixed(0), 'len', (s1 - s0).toFixed(0), 'lanes', path.lanes, 'name', path.name);
for (const g of net.signs.filter((g) => g.path === path && g.s >= s0 - 1200 && g.s <= s1 + 1200)) console.log('sign at s-s0=', (g.s - s0).toFixed(0), g.side, JSON.stringify(g.text), 'gantries at s-s0=', (g.s - 800 - s0).toFixed(0), (g.s - 260 - s0).toFixed(0));
// network-wide stats
let n3 = 0, two = 0, left = 0, lanes: Record<number, number> = {};
for (const g of net.signs) { if (g.side === 'L') left++; lanes[g.path.lanes] = (lanes[g.path.lanes] ?? 0) + 1; }
console.log('signs', net.signs.length, 'left', left, 'by lanes', JSON.stringify(lanes));
// how close consecutive signs are (gantries 800 m before an exit may overlap the previous exit's 260 m gantry)
const by = new Map<number, number[]>(); for (const g of net.signs) { const a = by.get(g.path.id) ?? []; a.push(g.s); by.set(g.path.id, a); }
let close = 0, tot = 0; for (const a of by.values()) { a.sort((x, y) => x - y); for (let i = 1; i < a.length; i++) { tot++; if (a[i] - a[i - 1] < 800) close++; } }
console.log('consecutive exits closer than 800 m:', close, 'of', tot);
// gantry pairs closer than 120 m anywhere on the network, and how many distinct sign textures a full network would make
let pairs = 0, gantries = 0; const texts = new Set<string>();
for (const [pid, a] of by) { const g: number[] = []; for (const s of a) { g.push(s - 800, s - 260); } g.sort((x, y) => x - y); gantries += g.length; for (let i = 1; i < g.length; i++) if (g[i] - g[i - 1] < 120) pairs++; }
for (const g of net.signs) { texts.add(JSON.stringify(g.text) + 'A'); texts.add(JSON.stringify(g.text) + 'B'); }
console.log('gantries', gantries, 'pairs closer than 120 m', pairs, 'distinct exit textures', texts.size, '+ through panels', net.mains.filter((m) => m.lanes >= 3).length);
let dropped = 0; for (const g of net.signs) { const names = g.text.filter((t) => !/^(I|CA|US)\s+\d+/i.test(t)); if (names.length > 1) dropped++; }
console.log('signs with a second destination the sign drops', dropped);
