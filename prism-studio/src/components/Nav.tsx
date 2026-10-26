"use client";
// The studio's navigation, kept quiet so the wall and the monitors carry the design: a slim glass rail on wide
// screens, a glass tab bar at the thumb on phones. Home is the monitor wall; the rest sits under "More", which is a
// <details> menu so it works without JavaScript (JS only closes it after a navigation, on Escape or outside clicks).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "./Icon";

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "wall" },
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

function More({ cur, where }: { cur: (href: string) => "page" | undefined; where: "rail" | "bar" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) {
        d.open = false;
        if (e instanceof KeyboardEvent) d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", close); };
  }, []);
  const active = MORE.some((m) => cur(m.href));
  return (
    <details ref={ref} className={`more more-${where}`}>
      <summary aria-label="More pages" data-active={active || undefined}><Icon name="more" /> <span>More</span></summary>
      <div className="more-menu">
        {MORE.map((m) => (
          <Link key={m.href} href={m.href} aria-current={cur(m.href)}><Icon name={m.icon} size={18} /> {m.label}</Link>
        ))}
      </div>
    </details>
  );
}

export function Nav({ counts }: { counts: { upload: number; review: number } }) {
  const path = usePathname();
  const cur = (href: string) => ((href === "/" ? path === "/" || path.startsWith("/m/") : path === href || path.startsWith(href + "/")) ? "page" : undefined);
  const badge = (href: string) => (href === "/upload" ? counts.upload : href === "/review" ? counts.review : 0);
  const item = (m: (typeof MAIN)[number]) => (
    <Link key={m.href} href={m.href} aria-current={cur(m.href)}>
      <span className="ico"><Icon name={m.icon} />{badge(m.href) ? <span className="count" aria-label={`${badge(m.href)} waiting`}>{badge(m.href)}</span> : null}</span>
      <span>{m.label}</span>
    </Link>
  );
  return (
    <>
      <nav className="rail" aria-label="Studio">
        <Link href="/" className="brand" aria-label="Prism Studio, the monitor wall"><span aria-hidden>P</span></Link>
        {MAIN.map(item)}
        <More cur={cur} where="rail" />
      </nav>
      <nav className="nav" aria-label="Studio">
        {MAIN.map(item)}
        <More cur={cur} where="bar" />
      </nav>
    </>
  );
}
