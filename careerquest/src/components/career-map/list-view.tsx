"use client";

import { MapPin } from "lucide-react";
import type { BranchMeta, CareerMapNode } from "@/lib/career-map/types";
import { STATUS_LABELS } from "@/lib/career-map/labels";
import { cn } from "@/lib/utils";
import { STATUS_ICONS, STATUS_TEXT } from "./status-meta";

/** The same stops as the map, grouped by branch in path order — easier on small screens. */
export function CareerListView({
  nodes,
  branches,
  selectedKey,
  currentKey,
  onSelect,
}: {
  nodes: CareerMapNode[];
  branches: BranchMeta[];
  selectedKey: string;
  currentKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="space-y-4" data-testid="career-map-list">
      {branches.map((b) => {
        const items = nodes.filter((n) => n.branch === b.key).sort((x, y) => x.col - y.col || x.row - y.row);
        if (!items.length) return null;
        return (
          <section key={b.key} aria-labelledby={`cm-list-${b.key}`} className="glass rounded-card p-4">
            <h2 id={`cm-list-${b.key}`} className="text-sm font-semibold">
              {b.label}
            </h2>
            <p className="text-xs text-fg-muted">{b.description}</p>
            <ol className="mt-3 space-y-1.5">
              {items.map((n) => {
                const Icon = STATUS_ICONS[n.state.status];
                const selected = n.key === selectedKey;
                return (
                  <li key={n.key}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-current={n.key === currentKey ? "location" : undefined}
                      data-node-key={n.key}
                      onClick={() => onSelect(n.key)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-ctl border px-3 py-2 text-left transition-colors hover:bg-surface-hover",
                        selected ? "border-accent bg-accent-soft" : "border-line",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_TEXT[n.state.status])} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-fg">
                          {n.title}
                          {n.key === currentKey && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gold">
                              <MapPin className="h-3 w-3" aria-hidden />
                              You are here
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-fg-muted">
                          {STATUS_LABELS[n.state.status]}
                          {n.state.override ? " · Marked by you" : ""} — {n.state.reason}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
