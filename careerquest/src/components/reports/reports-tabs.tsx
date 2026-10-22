import { LinkTabs } from "@/components/ui/tabs";

/**
 * Sub-navigation for /analytics. Mirrors the Overview | Forecast tabs that /analytics/forecast renders
 * (src/components/forecast/nav.ts) and adds Weekly reports.
 */
export const ANALYTICS_SECTION_TABS = [
  { href: "/analytics", label: "Overview", exact: true },
  { href: "/analytics/forecast", label: "Forecast" },
  { href: "/analytics/reports", label: "Weekly reports" },
];

export function ReportsTabs() {
  return <LinkTabs tabs={ANALYTICS_SECTION_TABS} className="print:hidden" />;
}
