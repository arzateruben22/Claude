import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { parseRichText, type Inline } from "@/lib/coach/format";
import type { CitedMetric } from "@/lib/coach/types";
import { MetricChip } from "./metric-chip";

/**
 * Renders Advisor text: paragraphs, bullet lists, bold, and citation tokens as metric chips. Only
 * citations present in `metrics` render; anything else is dropped (never shown as raw ids).
 */
export function RichText({ text, metrics, className }: { text: string; metrics: Record<string, CitedMetric>; className?: string }) {
  const blocks = parseRichText(text, (id) => metrics[id] !== undefined);
  const renderInline = (parts: Inline[]) =>
    parts.map((p, i) =>
      p.type === "cite" ? (
        <Fragment key={i}>
          {" "}
          <MetricChip metric={metrics[p.id]!} />
        </Fragment>
      ) : p.bold ? (
        <strong key={i} className="font-semibold text-fg">
          {p.value}
        </strong>
      ) : (
        <Fragment key={i}>{p.value}</Fragment>
      ),
    );
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed text-fg", className)}>
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

export function metricsById(list: readonly CitedMetric[]): Record<string, CitedMetric> {
  const out: Record<string, CitedMetric> = {};
  for (const m of list) out[m.id] = m;
  return out;
}
