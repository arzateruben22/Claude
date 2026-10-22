import { Fragment, type ReactNode } from "react";
import { parseInline, parseMarkdown, type Inline } from "@/lib/academy/markdown";
import { cn } from "@/lib/utils";

/**
 * Renders lesson markdown as React elements (never as an HTML string), so any markup in the source
 * is displayed as text. Works in Server and Client Components (no hooks).
 */

export function renderInline(nodes: Inline[], keyPrefix = "i"): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (n.type) {
      case "text":
        return <Fragment key={key}>{n.value}</Fragment>;
      case "br":
        return <br key={key} />;
      case "code":
        return (
          <code key={key} className="rounded bg-surface-strong px-1 py-0.5 font-mono text-[0.9em] text-fg">
            {n.value}
          </code>
        );
      case "strong":
        return (
          <strong key={key} className="font-semibold text-fg">
            {renderInline(n.children, key)}
          </strong>
        );
      case "em":
        return <em key={key}>{renderInline(n.children, key)}</em>;
    }
  });
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-fg-muted", className)}>
      {blocks.map((b, i) => {
        const key = `b-${i}`;
        switch (b.type) {
          case "p":
            return <p key={key}>{renderInline(b.children, key)}</p>;
          case "heading": {
            const Tag = b.level === 1 ? "h3" : b.level === 2 ? "h4" : "h5";
            return (
              <Tag key={key} className="font-semibold text-fg text-base">
                {renderInline(b.children, key)}
              </Tag>
            );
          }
          case "ul":
            return (
              <ul key={key} className="list-disc space-y-1.5 pl-5 marker:text-accent">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} start={b.start} className="list-decimal space-y-1.5 pl-5 marker:text-accent marker:font-medium">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}

/** Inline-only rendering for short strings (prompts, steps, table cells). */
export function InlineMarkdown({ source, className }: { source: string; className?: string }) {
  return <span className={className}>{renderInline(parseInline(source))}</span>;
}
