import { AlertTriangle, FlaskConical, Lightbulb, ShieldAlert, Sigma } from "lucide-react";
import type { CalloutSection, DiagramSection, FormulaSection, LessonSection, TableSection } from "@/lib/academy/schema";
import { DIAGRAM_THEME_COLORS, sanitizeSvg } from "@/lib/academy/svg-sanitize";
import { cn } from "@/lib/utils";
import { InlineMarkdown, Markdown } from "./markdown";
import { ExampleStepper } from "./example-stepper";

/** Renders a lesson's sections in order. Server-compatible (the example stepper is a client island). */
export function LessonSections({ lessonKey, sections }: { lessonKey: string; sections: LessonSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s, i) => {
        const id = `${lessonKey}-s${i}`;
        switch (s.type) {
          case "text":
            return (
              <section key={id} aria-labelledby={s.heading ? `${id}-h` : undefined} className="space-y-3">
                {s.heading && (
                  <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight text-fg scroll-mt-24">
                    {s.heading}
                  </h2>
                )}
                <Markdown source={s.markdown} />
              </section>
            );
          case "formula":
            return <FormulaCard key={id} id={id} section={s} />;
          case "diagram":
            return <DiagramFigure key={id} id={id} section={s} />;
          case "example":
            return <ExampleStepper key={id} id={id} title={s.title} problem={s.problem} steps={s.solutionSteps} answer={s.answer} />;
          case "table":
            return <DataTable key={id} section={s} />;
          case "callout":
            return <CalloutBox key={id} section={s} />;
        }
      })}
    </div>
  );
}

export function FormulaCard({ id, section }: { id: string; section: FormulaSection }) {
  return (
    <section aria-labelledby={`${id}-name`} className="rounded-card border border-accent/30 bg-accent-soft/40 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sigma className="h-4 w-4 text-accent" aria-hidden />
        <h3 id={`${id}-name`} className="text-[11px] uppercase tracking-[0.16em] text-accent">
          {section.name}
        </h3>
      </div>
      <p className="mt-3 overflow-x-auto whitespace-nowrap font-mono text-2xl font-semibold tracking-tight text-fg sm:text-3xl" aria-label={`Formula: ${section.expression}`}>
        {section.expression}
      </p>
      {section.variables.length > 0 && (
        <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr_auto]">
          {section.variables.map((v) => (
            <div key={v.symbol} className="contents">
              <dt className="font-mono font-semibold text-gold">{v.symbol}</dt>
              <dd className="text-fg-muted">{v.meaning}</dd>
              <dd className="text-fg-subtle text-xs sm:text-sm">{v.unit ?? ""}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.explanation && <Markdown source={section.explanation} className="mt-4" />}
    </section>
  );
}

/** Diagram SVG is sanitized (allowlist parser) immediately before it is injected. */
export function DiagramFigure({ id, section }: { id: string; section: DiagramSection }) {
  const svg = sanitizeSvg(section.svg, { label: section.title, themeColors: DIAGRAM_THEME_COLORS });
  return (
    <figure aria-labelledby={`${id}-title`} className="rounded-card border border-line bg-bg-elevated p-3 sm:p-4">
      <p id={`${id}-title`} className="mb-2 text-sm font-medium text-fg">
        {section.title}
      </p>
      {svg ? (
        <div
          className="mx-auto w-full max-w-2xl overflow-x-auto text-fg [&>svg]:h-auto [&>svg]:w-full [&>svg]:min-w-[300px]"
          // Safe: `svg` is the output of the allowlist sanitizer above (no scripts, handlers or external refs).
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="text-sm text-fg-subtle">This diagram could not be displayed.</p>
      )}
      {section.caption && (
        <figcaption className="mt-3 text-xs leading-relaxed text-fg-muted">
          <InlineMarkdown source={section.caption} />
        </figcaption>
      )}
    </figure>
  );
}

export function DataTable({ section }: { section: TableSection }) {
  return (
    <div className="rounded-card border border-line">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={section.caption ?? "Table"}>
        <table className="w-full min-w-[520px] text-left text-sm">
          {section.caption && <caption className="px-4 pt-3 pb-2 text-left text-xs font-medium text-fg-muted">{section.caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-surface-strong">
              {section.columns.map((c, i) => (
                <th key={i} scope="col" className="px-4 py-2 text-xs font-medium text-fg">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, r) => (
              <tr key={r} className="border-b border-line last:border-0">
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row" className="px-4 py-2 align-top font-medium text-fg">
                      <InlineMarkdown source={cell} />
                    </th>
                  ) : (
                    <td key={c} className="px-4 py-2 align-top text-fg-muted">
                      <InlineMarkdown source={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CALLOUTS = {
  safety: { label: "Safety", Icon: ShieldAlert, cls: "border-danger/40 bg-danger-soft", icon: "text-danger" },
  warning: { label: "Watch out", Icon: AlertTriangle, cls: "border-warning/40 bg-warning-soft", icon: "text-warning" },
  tip: { label: "Tip", Icon: Lightbulb, cls: "border-success/30 bg-success-soft", icon: "text-success" },
  simulation: { label: "Simulation", Icon: FlaskConical, cls: "border-accent/30 bg-accent-soft", icon: "text-accent" },
} as const;

export function CalloutBox({ section }: { section: CalloutSection }) {
  const c = CALLOUTS[section.tone];
  return (
    <aside role="note" aria-label={c.label} className={cn("flex gap-3 rounded-card border px-4 py-3", c.cls)} data-tone={section.tone}>
      <c.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", c.icon)} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", c.icon)}>{section.title ?? c.label}</p>
        <Markdown source={section.text} className="mt-1 text-fg" />
      </div>
    </aside>
  );
}
