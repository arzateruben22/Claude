import { LinkTabs } from "@/components/ui/tabs";

/** Sub-navigation for every /academy page (records pages included). */
export const ACADEMY_TABS = [
  { href: "/academy", label: "Lessons", exact: true },
  { href: "/academy/roadmap", label: "Roadmap" },
  { href: "/academy/workshop", label: "Workshop" },
  { href: "/academy/exam", label: "Practice exam" },
  { href: "/academy/apprenticeships", label: "Apprenticeships" },
  { href: "/academy/hours", label: "Training hours" },
  { href: "/academy/certification", label: "Certification" },
];

export function AcademyTabs() {
  return <LinkTabs tabs={ACADEMY_TABS} />;
}
