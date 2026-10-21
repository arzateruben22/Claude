"use client";

/** Theme-styled tooltip body shared by the Recharts wrappers. Values lead; series names follow. */
export type TooltipRow = { label: string; value: string; color?: string };

export function ChartTooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-ctl border border-line bg-bg-elevated px-2.5 py-1.5 text-xs shadow-card min-w-28">
      <p className="text-fg-muted">{title}</p>
      <ul className="mt-0.5 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {r.color && <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-medium text-fg tnum">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Loose shape of what Recharts passes to a custom tooltip `content` element. */
export type RechartsTooltipProps<T> = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: T; dataKey?: string | number; name?: string | number; value?: number | string; color?: string; fill?: string }>;
};

export const AXIS_TICK = { fill: "var(--fg-subtle)", fontSize: 11 } as const;
export const GRID_STROKE = "var(--line)";
export const CURSOR_FILL = { fill: "var(--surface-hover)" } as const;
