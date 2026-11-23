// Our own sports bar's name and look (PROJECT_OC_SPORTS_BAR.md, "The venue" and its 2026-11-16 rename note). The
// display name is this one constant (the owner's, 2026-11-16: "the new name for stoppage time will be called "Vega &
// Vinnie’s""), with the typographic apostrophe; every sign, menu, card, toast, Go To entry, World Map label and line
// reads it from here (the driving game through src/game/venues.ts). The venue's id in code, files and saved data is
// the neutral 'sportsbar' (the game's venue id 'stoppage' stays too), so nothing saved moves.
export const BAR_NAME = 'Vega & Vinnie’s';
/** the line under the script on the facade (the owner's front photo: "SPORTS BAR & CANTINA") */
export const BAR_LINE = 'Sports Bar & Cantina';
/** the pylon's shorter line (the owner's pylon photos: "SPORTS CANTINA") */
export const BAR_PYLON_LINE = 'Sports Cantina';
export const BAR_TAGLINE = 'Sports Bar · Patio · Games';
/** names the venue went by before (a save, a link or a Go To target that names one of them means this venue): the
 *  old name, and the new one typed with a plain apostrophe */
export const BAR_OLD_NAMES = ['Stoppage Time', "Vega & Vinnie's", 'Vega and Vinnie’s', "Vega and Vinnie's"];
/** a name as the venue's display name: an old name (or the new one with a plain apostrophe) maps to BAR_NAME */
export const barName = (name: string) => (BAR_OLD_NAMES.some((n) => n.toLowerCase() === name.trim().toLowerCase()) ? BAR_NAME : name);

/** the palette (ours; none of Lot 57's teal, cream, signal red or patina green, and no gold-and-black). The inside
 *  keeps S4's night violet, lime and coral; the outside takes the owner's photos' black facade and cream script */
export const PALETTE = {
  violet: '#1E1B3A',      // night violet: the inside's base, uniforms
  lime: '#C3F23A',        // added-time lime: LED and accents inside
  coral: '#FF6B4A',       // kick-off coral: booths, highlights
  chalk: '#F1EFE7',       // chalk: line paint, lettering
  oak: '#9A6B43',         // oak: wood
  facade: '#1C1B1D',      // the facade's black (the owner's front photo)
  cream: '#F3E9D2',       // the script sign's cream
};
export const HEX = { violet: 0x1e1b3a, lime: 0xc3f23a, coral: 0xff6b4a, chalk: 0xf1efe7, oak: 0x9a6b43, facade: 0x1c1b1d, cream: 0xf3e9d2 };
