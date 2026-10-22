/** Tabs rendered by the missions layout (URL is the state). */
export const MISSIONS_TABS = [
  { href: "/missions", label: "Today", exact: true },
  { href: "/missions/week", label: "This week" },
  { href: "/missions/campaign", label: "Campaign" },
  { href: "/missions/achievements", label: "Achievements" },
] as const;
