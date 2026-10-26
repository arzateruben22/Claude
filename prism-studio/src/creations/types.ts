export type CreationKey = "glass_garden" | "gravity_marble" | "bioelectric_car" | "pocket_universe" | "rift_dragon";
export type Form = 1 | 2 | 3 | 4 | 5;
export type Branch = "a" | "b" | null;
export type Activity = "idle" | "rendering" | "preparing" | "researching" | "celebrating" | "resting";
export type Motion = "full" | "reduced" | "static";

export interface CreationProps {
  creation: CreationKey;
  form: Form;
  branch?: Branch;
  ascended?: boolean;
  activity?: Activity;
  /** px, default 240 */
  size?: number;
  motion?: Motion;
  locked?: boolean;
  className?: string;
}

export interface CreationMeta {
  name: string;
  topic: "skincare" | "physics" | "body" | "space" | "whatif";
  forms: [string, string, string, string, string];
  branches: { a: { name: string; blurb: string }; b: { name: string; blurb: string } };
  colors: { primary: string; secondary: string; glow: string };
}
