import {
  LayoutDashboard,
  ListChecks,
  Compass,
  Briefcase,
  Map,
  GraduationCap,
  Network,
  Bot,
  BarChart3,
  Calculator,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon };

/** Main navigation, in the order specified by the product spec. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Command Center", short: "Home", icon: LayoutDashboard },
  { href: "/missions", label: "Today's Missions", short: "Missions", icon: ListChecks },
  { href: "/discovery", label: "Job Discovery", short: "Discover", icon: Compass },
  { href: "/applications", label: "Application Tracker", short: "Tracker", icon: Briefcase },
  { href: "/career-map", label: "Career Map", short: "Map", icon: Map },
  { href: "/academy", label: "Electrical Academy", short: "Academy", icon: GraduationCap },
  { href: "/skills", label: "Skill Tree", short: "Skills", icon: Network },
  { href: "/coach", label: "AI Career Coach", short: "Coach", icon: Bot },
  { href: "/analytics", label: "Analytics", short: "Analytics", icon: BarChart3 },
  { href: "/salary", label: "Salary Simulator", short: "Salary", icon: Calculator },
  { href: "/integrations", label: "Integrations", short: "Connect", icon: Plug },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

/** The five items shown in the iPhone bottom bar. */
export const MOBILE_NAV_HREFS = ["/dashboard", "/missions", "/applications", "/academy", "/settings"];
