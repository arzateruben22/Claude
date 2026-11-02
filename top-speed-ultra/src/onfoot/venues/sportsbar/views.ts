// The bar's three views: Lot 57's two person views and the overhead build view (engine/overhead.ts).
import type { View } from '../../engine/player';
export type BarView = View | 'overhead';
export const VIEWS: BarView[] = ['first', 'third', 'overhead'];
export const nextView = (v: BarView): BarView => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length];
