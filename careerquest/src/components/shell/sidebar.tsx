"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";

export function Sidebar({ level, xpProgress }: { level: number; xpProgress: number }) {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-line bg-bg-elevated/60 backdrop-blur-xl sticky top-0 h-screen">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-glow">
          <Zap className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">CareerQuest</p>
          <p className="text-[11px] text-fg-subtle">Career command center</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-ctl px-3 py-2 text-sm transition-colors",
                    active ? "bg-accent-soft text-accent font-medium" : "text-fg-muted hover:text-fg hover:bg-surface-hover",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-5 py-4 border-t border-line">
        <div className="flex items-center justify-between text-xs text-fg-muted">
          <span>Career level</span>
          <span className="text-gold font-semibold tnum">Lv {level}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-surface-strong overflow-hidden" aria-hidden>
          <div className="h-full bg-gold rounded-full" style={{ width: `${Math.round(xpProgress * 100)}%` }} />
        </div>
      </div>
    </aside>
  );
}
