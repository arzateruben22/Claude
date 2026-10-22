import { LinkTabs } from "@/components/ui/tabs";

export const COACH_TABS = [
  { href: "/coach", label: "Advisor", exact: true },
  { href: "/coach/resumes", label: "Résumés" },
];

export function CoachTabs() {
  return <LinkTabs tabs={COACH_TABS} />;
}
