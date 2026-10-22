import type { ReactNode } from "react";
import { LinkTabs, PageHeader } from "@/components/ui";
import { MISSIONS_TABS } from "@/components/game/missions-tabs";

export default function MissionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Missions"
        title="Missions"
        description="Daily and weekly missions mapped to real actions, Operation Get Hired, the $150K Electrician Path and your achievements. Rest days and rejections never cost you anything."
      />
      <LinkTabs tabs={[...MISSIONS_TABS]} />
      {children}
    </>
  );
}
