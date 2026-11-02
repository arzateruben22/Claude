// The bar's HUD on top of Lot 57's (the module map's hud.ts row). Lot 57's Hud binds the element ids sportsbar.html
// carries (L17), so its toasts, hint, pause sheet, quality and clock controls, action buttons and crowd chip work
// unchanged. BarHud adds what S1 needs: the three-way view control (Lot 57's segView already passes a button's data-v,
// so data-v="overhead" arrives as onView('overhead')), and the Ultra lock (an entitlement flag only: no price and no
// purchase path). The needs strip, the radial menu, the TV chip and the rest come in S2a.
import { Hud } from '../../engine/hud';
import type { BarView } from './views';

const $ = (id: string) => document.getElementById(id)!;
export class BarHud {
  readonly hud: Hud;
  constructor(hud: Hud) { this.hud = hud; }
  /** Lot 57's setView for the person views; the bar sets the label and the three buttons itself for overhead */
  setView(v: BarView) {
    if (v !== 'overhead') this.hud.setView(v);
    $('viewLabel').textContent = v === 'first' ? '3rd' : v === 'third' ? 'Top' : '1st';
    $('viewBtn').setAttribute('aria-label', v === 'first' ? 'Switch to third person' : v === 'third' ? 'Switch to the overhead view' : 'Switch to first person');
    for (const b of $('segView').querySelectorAll('button')) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === v));
  }
  /** the Ultra button: unlocked by the shared entitlement (S4 reads RS2's), owner mode or the test build */
  setUltra(unlocked: boolean) {
    const b = $('segQ').querySelector('[data-q="ultra"]') as HTMLButtonElement | null;
    if (!b) return;
    b.textContent = unlocked ? 'Ultra' : 'Ultra · locked';
    if (unlocked) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
    b.dataset.locked = unlocked ? '' : '1';
  }
  /** a sheet painted over the paused game while a slow switch builds behind it */
  busy(text: string | null) {
    const el = $('busy');
    if (text) { el.textContent = text; el.classList.add('on'); } else el.classList.remove('on');
  }
}
