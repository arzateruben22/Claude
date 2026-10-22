import { LinkTabs } from "@/components/ui/tabs";

export const ANALYTICS_TABS = [
  { href: "/analytics", label: "Overview", exact: true },
  { href: "/analytics/reports", label: "Weekly reports" },
];

export function ReportsTabs() {
  return <LinkTabs tabs={ANALYTICS_TABS} className="print:hidden" />;
}
