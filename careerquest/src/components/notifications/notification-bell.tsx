"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

/** Unread badge for the top bar. Fetches on mount and on navigation (reminders are generated server-side). */
export function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { unread?: number } | null) => {
        if (!cancelled && data && typeof data.unread === "number") setUnread(data.unread);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link href="/notifications" aria-label={label} title={label} className="relative rounded-ctl p-2 text-fg-muted hover:text-fg hover:bg-surface-hover">
      <Bell className="h-4 w-4" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-[10px] leading-4 text-white text-center tnum" aria-hidden>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
