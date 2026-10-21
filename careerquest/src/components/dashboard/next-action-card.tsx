import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import type { NextAction } from "@/lib/dashboard/next-action";

export function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section aria-labelledby="next-action-title" className="glass rounded-card p-5 border-accent/30" data-next-action={action.key}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent">
        <Compass className="h-3.5 w-3.5" aria-hidden />
        Next best action
      </div>
      <h2 id="next-action-title" className="mt-2 text-lg font-semibold tracking-tight">
        {action.title}
      </h2>
      <p className="mt-1 text-sm text-fg-muted max-w-xl">{action.description}</p>
      <div className="mt-4">
        <Link href={action.href} className={buttonClasses("primary", "md")}>
          {action.cta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
