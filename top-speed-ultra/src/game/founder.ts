// The OC Hypercar Founder Edition: what only it has (PROJECT_OC_HYPERCAR.md section 7, milestone M6). Nothing here
// sells anything and nothing here counts owners: the store (the claude/store branch) sells the car and its server
// assigns the plaque numbers. Until that entitlement exists every plaque reads "No. 0000 · TEST", and no number is
// ever made up on the device.
//
// No imports: the car's shape (src/preview/car-shape.ts), the cockpit, the garage and the run card all read it.

export const FOUNDER_CAR = 'oc-hyper';

// The founder window, as one constant (Pacific time). The store's server enforces it at checkout and in its payment
// webhook, never this device's clock; the game only shows the date. Nothing in the game says more than the date.
export const FOUNDER_UNTIL = '2026-12-31T23:59:59-08:00';
export function founderWindowText() {
  const d = new Date(FOUNDER_UNTIL);
  return `Founder window to ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}`;
}

// The paint and the LED colour reserved to it: the garage offers them on no other car (finishesFor below), and no
// other car's shape carries the LED strips at all.
export const GLACIER_SILVER = { id: 'glacier-silver', name: 'Glacier Silver', hex: 0xc8d3e8, car: FOUNDER_CAR } as const;
export const FOUNDER_ICE = { id: 'founder-ice', name: 'Founder Ice', core: 0xa6dcff, halo: 0x2f8fe8, car: FOUNDER_CAR } as const;

// The plaque's number. THE ONE FUNCTION THE STORE FILLS: the serial on this profile's `hypercar-founder` entitlement
// (assigned by the store's server when the payment succeeds, 1 up, never reused; 0 is kept for owner-mode testing).
// There is no entitlement on this branch, so there is no number.
export function founderSerial(): number | null { return null; }

// what the plaques, the garage card and the run card print
export function plaqueNumber(serial = founderSerial()) {
  return serial === null || !(serial > 0) ? 'No. 0000 · TEST' : `No. ${String(Math.floor(serial)).padStart(4, '0')}`;
}
export function plaqueLine(serial = founderSerial()) { return `FOUNDER EDITION · ${plaqueNumber(serial)}`; }

// The finishes the garage offers each car: every car's own paint, and the founder pair only on the founder car.
export interface Finish { id: string; name: string; hex: number; only?: string }
export const FINISHES: Finish[] = [
  { id: 'rosso-gt', name: 'Rosso', hex: 0xa80d10 },
  { id: 'blu-brio', name: 'Blu Notte', hex: 0x1d4f9c },
  { id: 'giallo-corsa', name: 'Giallo', hex: 0xf5c518 },
  { id: 'vela-pearl', name: 'Pearl', hex: 0xf3f1ec },
  { id: GLACIER_SILVER.id, name: GLACIER_SILVER.name, hex: GLACIER_SILVER.hex, only: FOUNDER_CAR },
];
export function finishesFor(carId: string) { return FINISHES.filter((f) => !f.only || f.only === carId); }
// a paint for a car: a reserved one asked for on another car falls back to that car's own colour
export function paintFor(carId: string, hex: number, own: number) {
  const f = FINISHES.find((x) => x.hex === hex);
  return f && f.only && f.only !== carId ? own : hex;
}
