// Getting out at a venue (PROJECT_OC_ON_FOOT.md Phase 3a, PROJECT_OC_SPORTS_BAR.md J1): the venue's own page, loaded
// only when you get out (its own chunks, so the game's boot is unchanged; scripts/single-file.mjs folds them into the
// single-file page), mounted over the paused game; and the fade between the two.
import type { MountOptions, Mounted } from '../onfoot/embed';
import type { VenueId } from './venues';

/** load the venue's code and its page, and mount it in host */
export async function mountVenue(id: VenueId, host: HTMLElement, o: MountOptions): Promise<Mounted> {
  // (each page boots itself on its own; mounted here, it waits for mount)
  (globalThis as { __onfootEmbed?: boolean }).__onfootEmbed = true;
  if (id === 'lot57') {
    const [m, page] = await Promise.all([import('../onfoot/main'), import('../onfoot/index.html?raw')]);
    return m.mount(host, { ...o, html: page.default });
  }
  const [m, page] = await Promise.all([import('../onfoot/venues/sportsbar/main'), import('../onfoot/sportsbar.html?raw')]);
  return m.mount(host, { ...o, html: page.default });
}

// the fade: one black layer over everything, styled inline (the game's stylesheets are off while a venue is up)
let veil: HTMLDivElement | null = null;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export async function fade(on: boolean, ms = 360) {
  if (!veil) {
    veil = document.createElement('div');
    veil.setAttribute('aria-hidden', 'true');
    veil.dataset.veil = '';
    Object.assign(veil.style, { position: 'fixed', inset: '0', background: '#000', opacity: '0', zIndex: '2147483647', pointerEvents: 'none', transition: `opacity ${ms}ms ease` });
    document.body.appendChild(veil);
    void veil.offsetWidth;
  }
  veil.style.transition = `opacity ${ms}ms ease`;
  veil.style.pointerEvents = on ? 'auto' : 'none';
  veil.style.opacity = on ? '1' : '0';
  await wait(ms + 30);
}
