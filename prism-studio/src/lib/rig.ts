// The monitor wall at "/": which destination sits on which screen. Change the mapping here and the home rig, the
// phone stack and the small monitor strip on every extension screen all follow.
// The centre is always the shared Instagram (all series). Channels with episodes sit nearest the centre (the inner
// portrait screens); the two channels without episodes yet take the top screen and an outer portrait.
export const RIG = {
  top: "whatif",          // landscape, above Instagram
  innerLeft: "physics",   // portrait, larger
  innerRight: "space",
  outerLeft: "body",      // portrait, smaller, angled toward the centre
  outerRight: "skincare",
} as const;

export type RigPosition = keyof typeof RIG | "center";
export const INSTAGRAM_SLUG = "instagram";

/** Left-to-right reading order of the rig (used by the strip and by screen readers). */
export const RIG_ORDER: { position: RigPosition; slug: string }[] = [
  { position: "outerLeft", slug: RIG.outerLeft },
  { position: "innerLeft", slug: RIG.innerLeft },
  { position: "top", slug: RIG.top },
  { position: "center", slug: INSTAGRAM_SLUG },
  { position: "innerRight", slug: RIG.innerRight },
  { position: "outerRight", slug: RIG.outerRight },
];

/** Phone (and reading) order: Instagram first, then the inner pair (the channels with episodes), the top screen and the
 *  outer pair. Under 900 px, any monitor with nothing to show also drops to one compact row at the end (globals.css). */
export const PHONE_ORDER: RigPosition[] = ["center", "innerLeft", "innerRight", "top", "outerLeft", "outerRight"];
