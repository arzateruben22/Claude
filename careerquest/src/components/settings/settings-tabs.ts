/** Tabs rendered by the settings layout (URL is the state). */
export const SETTINGS_TABS = [
  { href: "/settings", label: "Profile & goals", exact: true },
  { href: "/settings/campaign", label: "Campaign" },
  { href: "/settings/eligibility", label: "Eligibility filters" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/account", label: "Account & data" },
  { href: "/settings/tokens", label: "Developer tokens" },
] as const;
