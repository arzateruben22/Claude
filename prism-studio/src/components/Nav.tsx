"use client";
// The studio's navigation: a dark rail on wide screens, a five-tab bar at the thumb on phones.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/upload", label: "Upload", icon: "upload" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/rewards", label: "Rewards", icon: "trophy" },
];
const MORE: { href: string; label: string; icon: IconName }[] = [
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/learn", label: "Learn", icon: "spark" },
  { href: "/connections", label: "Accounts", icon: "link" },
  { href: "/queue", label: "Queue", icon: "queue" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function Nav({ channels, counts }: { channels: { slug: string; name: string; color: string }[]; counts: { upload: number; review: number } }) {
  const path = usePathname();
  const cur = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/")) ? "page" : undefined;
  const badge = (href: string) => (href === "/upload" ? counts.upload : href === "/review" ? counts.review : 0);
  return (
    <>
      <nav className="rail" aria-label="Studio">
        <div className="brand">Prism <i>Studio</i></div>
        {MAIN.map((m) => (
          <Link key={m.href} href={m.href} aria-current={cur(m.href)}>
            <Icon name={m.icon} /> {m.label}{badge(m.href) ? <span className="count">{badge(m.href)}</span> : null}
          </Link>
        ))}
        <div className="sep" />
        {channels.map((c) => (
          <Link key={c.slug} href={`/channels/${c.slug}`} aria-current={cur(`/channels/${c.slug}`)}>
            <span className="dot" style={{ background: c.color }} aria-hidden /> {c.name.replace(/ \(name TBD\)$/, "")}
          </Link>
        ))}
        <div className="sep" />
        {MORE.map((m) => (
          <Link key={m.href} href={m.href} aria-current={cur(m.href)}><Icon name={m.icon} /> {m.label}</Link>
        ))}
      </nav>
      <nav className="nav" aria-label="Studio">
        {MAIN.map((m) => (
          <Link key={m.href} href={m.href} aria-current={cur(m.href)}>
            <Icon name={m.icon} />
            <span>{m.label}{badge(m.href) ? <span className="count">{badge(m.href)}</span> : null}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
