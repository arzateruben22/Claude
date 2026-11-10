// The monitor wall at "/": which destination sits on which screen. Change the mapping here and the home rig, the
// phone stack and the small monitor strip on every extension screen all follow.
// The centre is always the shared Instagram (all series). RIG is each channel's own screen when every channel is
// active; rigLayout keeps the wall balanced when one is archived (src/domain/channels.ts): two screens a side once
// there are four channels (the top screen stays dark and the stand drops it), the top screen for an odd one out.
export const RIG = {
  top: "whatif",          // landscape, above Instagram
  innerLeft: "physics",   // portrait, larger
  innerRight: "space",
  outerLeft: "body",      // portrait, smaller, angled toward the centre
  outerRight: "skincare",
} as const;

export type RigPosition = keyof typeof RIG | "center";
export type ChannelPosition = Exclude<RigPosition, "center">;
export const INSTAGRAM_SLUG = "instagram";

/** The screens in use for a number of channels, so the wall stays symmetric. */
const SCREENS: ChannelPosition[][] = [
  [],
  ["top"],
  ["innerLeft", "innerRight"],
  ["top", "innerLeft", "innerRight"],
  ["innerLeft", "innerRight", "outerLeft", "outerRight"],
  ["top", "innerLeft", "innerRight", "outerLeft", "outerRight"],
];
/** The order a channel without its own screen takes the free ones in: nearest the centre first. */
const FILL: ChannelPosition[] = ["innerLeft", "innerRight", "outerLeft", "outerRight", "top"];
const OWN = new Map(Object.entries(RIG).map(([pos, slug]) => [slug as string, pos as ChannelPosition]));

/** Which screen each active channel (in studio order) takes: its own (RIG) when that screen is in use, else the first
 *  free one nearest the centre. Five channels give exactly RIG. Past five, the rest have no screen. */
export function rigLayout(slugs: string[]): Map<string, ChannelPosition> {
  const screens = SCREENS[Math.min(slugs.length, SCREENS.length - 1)];
  const shown = slugs.slice(0, screens.length), free = new Set(screens), out = new Map<string, ChannelPosition>();
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

/** Phone (and reading) order: Instagram first, then the inner pair, the top screen and the outer pair. Under 900 px,
 *  any monitor with nothing to show also drops to one compact row at the end (globals.css). */
export const PHONE_ORDER: RigPosition[] = ["center", "innerLeft", "innerRight", "top", "outerLeft", "outerRight"];
