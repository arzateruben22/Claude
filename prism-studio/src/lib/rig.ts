// The monitor wall at "/": which destination sits on which screen. Change the mapping here and the home rig, the
// phone stack and the small monitor strip on every extension screen all follow.
// While Instagram is on (INSTAGRAM_ON, src/domain/publications.ts) the centre is the shared Instagram (all series). RIG
// is each channel's own screen when every channel is active; rigLayout keeps the wall balanced when one is archived
// (src/domain/channels.ts): two screens a side once there are four channels (the top screen stays dark and the stand
// drops it), the top screen for an odd one out. With Instagram off (owner, 12 Nov 2026) the channels fill the wall: an
// odd one out takes the centre screen instead of the top one, and four sit two a side close to the pole (the wall
// drops the empty centre: MonitorRig's data-no-center).
export const RIG = {
  top: "whatif",          // landscape, above the centre
  innerLeft: "physics",   // portrait, larger
  innerRight: "space",
  outerLeft: "body",      // portrait, smaller, angled toward the centre
  outerRight: "skincare",
} as const;

export type RigPosition = keyof typeof RIG | "center";
export const INSTAGRAM_SLUG = "instagram";

/** The screens in use for a number of channels, so the wall stays symmetric: with the centre taken by Instagram, and
 *  with the centre free for a channel (Instagram off). */
const SCREENS: Record<"instagram" | "alone", RigPosition[][]> = {
  instagram: [
    [],
    ["top"],
    ["innerLeft", "innerRight"],
    ["top", "innerLeft", "innerRight"],
    ["innerLeft", "innerRight", "outerLeft", "outerRight"],
    ["top", "innerLeft", "innerRight", "outerLeft", "outerRight"],
  ],
  alone: [
    [],
    ["center"],
    ["innerLeft", "innerRight"],
    ["center", "innerLeft", "innerRight"],
    ["innerLeft", "innerRight", "outerLeft", "outerRight"],
    ["center", "innerLeft", "innerRight", "outerLeft", "outerRight"],
    ["top", "center", "innerLeft", "innerRight", "outerLeft", "outerRight"],
  ],
};
/** The order a channel without its own screen takes the free ones in: nearest the centre first. */
const FILL: RigPosition[] = ["center", "innerLeft", "innerRight", "outerLeft", "outerRight", "top"];
const OWN = new Map(Object.entries(RIG).map(([pos, slug]) => [slug as string, pos as RigPosition]));

/** Which screen each active channel (in studio order) takes: its own (RIG) when that screen is in use, else the first
 *  free one nearest the centre. `instagram` (pass INSTAGRAM_ON) says whether the shared Instagram holds the centre:
 *  then five channels give exactly RIG; without it a channel may take the centre. Past the screens there are, the rest
 *  have no screen. */
export function rigLayout(slugs: string[], instagram: boolean): Map<string, RigPosition> {
  const table = SCREENS[instagram ? "instagram" : "alone"];
  const screens = table[Math.min(slugs.length, table.length - 1)];
  const shown = slugs.slice(0, screens.length), free = new Set(screens), out = new Map<string, RigPosition>();
  for (const s of shown) {
    const own = OWN.get(s);
    if (own && free.has(own)) { out.set(s, own); free.delete(own); }
  }
  for (const s of shown) {
    if (out.has(s)) continue;
    const pos = FILL.find((p) => free.has(p))!;
    out.set(s, pos);
    free.delete(pos);
  }
  return out;
}

/** Left-to-right reading order of the rig's screens (used by the strip and by screen readers). */
export const RIG_ORDER: RigPosition[] = ["outerLeft", "innerLeft", "top", "center", "innerRight", "outerRight"];

/** Phone (and reading) order: the centre (Instagram, or a channel when it is off) first, then the inner pair, the top
 *  screen and the outer pair. Under 900 px, any monitor with nothing to show also drops to one compact row at the end
 *  (globals.css). */
export const PHONE_ORDER: RigPosition[] = ["center", "innerLeft", "innerRight", "top", "outerLeft", "outerRight"];
