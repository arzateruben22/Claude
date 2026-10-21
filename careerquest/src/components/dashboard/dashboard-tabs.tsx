import { LinkTabs } from "@/components/ui/tabs";

export function DashboardTabs() {
  return (
    <LinkTabs
      tabs={[
        { href: "/dashboard", label: "Overview", exact: true },
        { href: "/dashboard/goals", label: "Numbers game" },
      ]}
    />
  );
}
