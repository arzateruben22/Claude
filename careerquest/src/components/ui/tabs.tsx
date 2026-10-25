"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Link-based tabs (URL is the state) — works without JS and keeps back/forward intuitive. */
export function LinkTabs({ tabs, className }: { tabs: { href: string; label: string; exact?: boolean }[]; className?: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className={cn("flex gap-1 overflow-x-auto no-scrollbar border-b border-line mb-5", className)} aria-label="Sections">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
