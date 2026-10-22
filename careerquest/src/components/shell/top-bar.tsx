"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Zap, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";

export function TopBar({
  userName,
  level,
  totalXp,
  streak,
  logoutAction,
}: {
  userName: string;
  level: number;
  totalXp: number;
  streak: number;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-line bg-bg-elevated/80">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
        <button
          type="button"
          className="lg:hidden rounded-ctl p-2 text-fg-muted hover:text-fg hover:bg-surface-hover"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
        <p className="text-sm font-medium truncate flex-1">{current?.label ?? "CareerQuest"}</p>
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-fg-muted shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 tnum" title="Current streak (active days)">
            <Flame className="h-3.5 w-3.5 text-warning" aria-hidden /> {streak}d
          </span>
          <span className="inline-flex items-center gap-1 tnum" title="Total XP" data-testid="topbar-xp">
            <Zap className="h-3.5 w-3.5 text-gold" aria-hidden /> {totalXp.toLocaleString()} XP
          </span>
          <span className="rounded-full bg-gold-soft text-gold px-2 py-0.5 font-medium" title="Career level">Lv {level}</span>
        </div>
        <span className="text-xs text-fg-muted hidden md:inline truncate max-w-40">{userName}</span>
        <form action={logoutAction}>
          <button type="submit" className="rounded-ctl p-2 text-fg-muted hover:text-fg hover:bg-surface-hover" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-line px-3 py-2 max-h-[70vh] overflow-y-auto" aria-label="All sections">
          <ul className="grid grid-cols-2 gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex items-center gap-2 rounded-ctl px-3 py-2 text-sm", active ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-hover hover:text-fg")}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
