// The channels that carry their own look on the wall and on their screen (/m/<slug>), keyed by slug. The rest of the
// studio stays night glass; these two bring their films' palettes and fonts (globals.css, "channel identities").
export type Identity = "outer-layer" | "envelope";
const IDENTITY: Record<string, Identity> = { skincare: "outer-layer", whatif: "envelope" };
export const identityOf = (slug: string): Identity | undefined => IDENTITY[slug];
