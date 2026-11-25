// The trailer's eight shots (control/trailer/TRAILER_PLAN.md is the human-readable copy; this file is what the capture
// script runs). Everything a shot needs to come out the same every time: a seed for Math.random, the settings
// written to localStorage before the page loads, the owner-mode car, how many seconds of driving to fast-forward
// before the first frame (the warm-up, at the game's own fixed step), the camera, and the frames to record.
// Times are game seconds; the cut is at 30 fps. BEAT = 60/124 s.
export const BEAT = 60 / 124, BAR = 4 * BEAT;
const HEX = { rossiniRed: 0xa80d10, electricBlue: 0x2a6fdc, trackYellow: 0xf5c518, glacier: null, coastBlue: 0x1d4f9c };
export const SHOTS = [
  { id: 's1-drone', bars: 2, seed: 101, car: 'oc-hyper', time: 'sunrise', weather: 'clear', density: 'moderate', quality: 'ultra',
    start: 'I-405 North', warm: 20, cam: 'cinematic', cine: 3, hud: false, note: 'drone, high behind, pulling in (cinematic shot 3)' },
  { id: 's2-reveal', bars: 2, seed: 102, car: 'oc-hyper', time: 'day', quality: 'ultra', reveal: true, revealFrom: 1.6,
    hud: false, note: 'the Founder reveal stage: dark turntable, LED wake, light sweep' },
  { id: 's3-cockpit', bars: 1.5, seed: 103, car: 'rossini-gt', paint: HEX.rossiniRed, time: 'day', weather: 'clear', density: 'moderate', quality: 'ultra',
    start: 'I-405 North', warm: 25, cruise: 45, cam: 'cockpit', hud: false, note: "driver's seat at ~100 mph, auto-drive" },
  { id: 's4-chase', bars: 1.5, seed: 104, car: 'vela-e', paint: HEX.electricBlue, time: 'day', weather: 'clear', density: 'heavy', quality: 'ultra',
    start: 'I-405 North', warm: 25, cruise: 40, cam: 'chase', hud: true, note: 'chase cam threading traffic, HUD on' },
  { id: 's5-drift', bars: 1.5, seed: 105, car: 'rossini-corsa', paint: HEX.trackYellow, time: 'sunset', weather: 'clear', density: 'light', quality: 'ultra',
    start: 'I-405 North', warm: 12, cruise: 30, cam: 'cinematic', cine: 2, drift: { at: 0.3, steer: -0.55, hand: 0.3, counter: 0.5, hold: 1.2 }, hud: false,
    note: 'low rear three-quarter (cinematic shot 2); handbrake flick to the right, opposite lock for 1.2 s, then the autopilot' },
  { id: 's6-dusk', bars: 2, seed: 106, car: 'rossini-gt', paint: HEX.rossiniRed, time: 'sunset', weather: 'clear', density: 'heavy', quality: 'ultra',
    start: 'I-405 North', warm: 30, cruise: 31, cam: 'cinematic', cine: 0, hud: false, note: 'the hero rear three-quarter, red tail lights in dusk traffic (cinematic shot 0)' },
  { id: 's7-retro-ultra', bars: 1, seed: 107, car: 'rossini-brio', paint: HEX.coastBlue, time: 'day', weather: 'clear', density: 'moderate', quality: 'ultra',
    start: 'I-405 North', warm: 20, cruise: 31, cam: 'chase', hud: false, twin: { quality: 'low', style: 'retro' },
    note: 'same seed and drive twice, Retro Low and Ultra, wiped across the frame in the cut' },
  { id: 's8-menu', bars: 1, seed: 108, car: 'oc-hyper', time: 'night', weather: 'clear', density: 'moderate', quality: 'ultra',
    menu: true, warm: 6, cine: 0, hud: true, note: 'the main menu over its attract drive, as a player first sees it' },
];
