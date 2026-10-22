import type { ReactNode } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { isHttpUrl } from "@/lib/seed/schema";
import { cn } from "@/lib/utils";

/** Outbound link: http(s) only, new tab, `noopener noreferrer`, with a screen-reader hint. */
export function OutboundLink({ href, children, className, icon = true }: { href: string | null | undefined; children: ReactNode; className?: string; icon?: boolean }) {
  if (!isHttpUrl(href)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 text-accent hover:underline", className)}>
      {children}
      {icon && <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Host name for a URL, for compact source lists. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
