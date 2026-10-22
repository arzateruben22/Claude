import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CitedMetric, Recommendation } from "@/lib/coach/types";
import { RichText } from "./rich-text";

function RecommendationItem({ rec, metrics, index }: { rec: Recommendation; metrics: Record<string, CitedMetric>; index?: number }) {
  return (
    <li className="rounded-ctl border border-line bg-surface p-3.5" data-testid="coach-recommendation" data-rule={rec.id}>
      <div className="flex items-start gap-2.5">
        {index !== undefined && (
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent" aria-hidden>
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{rec.title}</p>
          <RichText text={rec.body} metrics={metrics} className="mt-1 text-fg-muted" />
          <Link href={rec.action.href} className={buttonClasses("secondary", "sm", "mt-3")}>
            {rec.action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  );
}

/** "This week's priorities": the top three recommendations, with every number behind a chip. */
export function PrioritiesCard({
  priorities,
  others,
  metrics,
}: {
  priorities: Recommendation[];
  others: Recommendation[];
  metrics: Record<string, CitedMetric>;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" aria-hidden />
            This week&apos;s priorities
          </CardTitle>
          <CardDescription>Ranked by the rules engine from your own records. Open a chip to see the number behind it.</CardDescription>
        </div>
        <Badge tone="info">Observed data</Badge>
      </CardHeader>
      <CardContent>
        {priorities.length === 0 ? (
          <p className="text-sm text-fg-muted">Nothing needs attention right now. Keep logging applications and the Advisor will flag what matters.</p>
        ) : (
          <ol className="space-y-3" aria-label="This week's priorities">
            {priorities.map((r, i) => (
              <RecommendationItem key={r.id} rec={r} metrics={metrics} index={i} />
            ))}
          </ol>
        )}
        {others.length > 0 && (
          <details className="mt-4 group">
            <summary className="cursor-pointer text-sm text-accent hover:underline">
              {others.length} more recommendation{others.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-3 space-y-3">
              {others.map((r) => (
                <RecommendationItem key={r.id} rec={r} metrics={metrics} />
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
