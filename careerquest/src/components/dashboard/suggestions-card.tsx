import { Lightbulb } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import type { Suggestion } from "@/lib/goals/calculator";

export function SuggestionsCard({ suggestions, dataRequirements }: { suggestions: Suggestion[]; dataRequirements: string }) {
  return (
    <section aria-labelledby="suggestions-title" className="glass rounded-card p-5">
      <h2 id="suggestions-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-fg-subtle" aria-hidden />
        Adjustments from observed results
      </h2>
      {suggestions.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          No adjustments suggested yet. {dataRequirements || "Your observed pace and response rate are within the ranges where we would not suggest a change."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Alert tone={s.tone} title={s.metric}>
                {s.text}
              </Alert>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-fg-subtle">Suggestions cite the metric they are based on and describe likelihoods, not outcomes. Hiring depends on factors no tracker can see.</p>
    </section>
  );
}
