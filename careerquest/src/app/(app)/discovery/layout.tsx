import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";

const TABS = [
  { href: "/discovery", label: "Leads", exact: true },
  { href: "/discovery/companies", label: "Target companies" },
  { href: "/discovery/search", label: "Search links" },
  { href: "/discovery/apprenticeships", label: "Apprenticeship portals" },
];

export default function DiscoveryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Job Discovery"
        title="Find your next job"
        description="Keep the postings you find, the employers you want, and where to search. CareerQuest never scrapes job boards, opens your links or applies for you."
      />
      <LinkTabs tabs={TABS} />
      {children}
    </>
  );
}
