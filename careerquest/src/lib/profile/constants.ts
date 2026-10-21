import { PrimaryTrade, UiTheme } from "@/generated/prisma/enums";

export const DEFAULT_REGIONS = ["Los Angeles County, CA", "Orange County, CA"] as const;

/** Quick-add suggestions for the regions chip input (Southern California first). */
export const REGION_SUGGESTIONS = [
  "Los Angeles County, CA",
  "Orange County, CA",
  "Riverside County, CA",
  "San Bernardino County, CA",
  "San Diego County, CA",
  "Ventura County, CA",
] as const;

export const TIMEZONE_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Phoenix", label: "Arizona — Phoenix (no DST)" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "America/Anchorage", label: "Alaska — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Honolulu" },
] as const;

export const PRIMARY_TRADE_LABELS: Record<PrimaryTrade, string> = {
  ELECTRICIAN: "Electrician",
  ELEVATOR_MECHANIC: "Elevator mechanic",
  COMMERCIAL_HVAC: "Commercial HVAC",
  INDUSTRIAL_MAINTENANCE: "Industrial maintenance",
  BUILDING_ENGINEER: "Building engineer",
  CONSTRUCTION_PROJECT_COORDINATOR: "Construction project coordinator",
  CONSTRUCTION_ESTIMATOR: "Construction estimator",
  ASSISTANT_PROJECT_MANAGER: "Assistant project manager",
  COMMERCIAL_PLUMBING_PIPEFITTING: "Commercial plumbing & pipefitting",
  OTHER: "Other",
};

export const PRIMARY_TRADE_OPTIONS = (Object.keys(PrimaryTrade) as PrimaryTrade[]).map((value) => ({
  value,
  label: PRIMARY_TRADE_LABELS[value],
}));

export type ThemePreview = {
  value: UiTheme;
  name: string;
  tagline: string;
  /** Swatches mirror the token values declared per theme in `src/app/globals.css`. */
  swatches: { bg: string; elevated: string; line: string; fg: string; accent: string; gold: string };
};

export const THEME_PREVIEWS: ThemePreview[] = [
  {
    value: UiTheme.CYBER,
    name: "Cyber",
    tagline: "Dark glass, electric blue. The default.",
    swatches: { bg: "#0b0e14", elevated: "#10141c", line: "rgba(255,255,255,0.16)", fg: "#e8eef7", accent: "#4cc9ff", gold: "#f3c75b" },
  },
  {
    value: UiTheme.ULTRA,
    name: "Ultra",
    tagline: "Deeper blacks, ice-blue glow, softer corners.",
    swatches: { bg: "#05070b", elevated: "#0a0e16", line: "rgba(205,225,255,0.22)", fg: "#f2f6ff", accent: "#9fe1ff", gold: "#e9d9a8" },
  },
  {
    value: UiTheme.CLASSIC,
    name: "Classic",
    tagline: "Light, flat and high-contrast for daylight use.",
    swatches: { bg: "#f6f8fb", elevated: "#ffffff", line: "#cbd5e1", fg: "#0f172a", accent: "#2563eb", gold: "#b7791f" },
  },
];

export const CAMPAIGN_DEFAULTS = {
  campaignLengthDays: 90,
  dailyApplicationTarget: 5,
  workdaysPerWeek: 5,
  weeklyApplicationTarget: 25,
} as const;

export const SALARY_DEFAULTS = { immediate: 80_000, longTerm: 150_000 } as const;
