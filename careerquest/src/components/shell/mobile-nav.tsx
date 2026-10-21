"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_HREFS, NAV_ITEMS } from "./nav-config";

export function MobileNav() {
  const pathname = usePathname();
  const items = MOBILE_NAV_HREFS.map((h) => NAV_ITEMS.find((n) => n.href === h)!).filter(Boolean);
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-line pb-safe bg-bg-elevated/90" aria-label="Primary">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px]", active ? "text-accent" : "text-fg-muted")}
              >
                <item.icon className="h-5 w-5" aria-hidden />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
