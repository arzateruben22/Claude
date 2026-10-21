import type { ReactNode } from "react";
import { LinkTabs, PageHeader } from "@/components/ui";
import { SETTINGS_TABS } from "@/components/settings/settings-tabs";

export default function SettingsTabsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Your profile, campaign targets, private filters, appearance, account and developer tokens."
      />
      <LinkTabs tabs={[...SETTINGS_TABS]} />
      {children}
    </>
  );
}
