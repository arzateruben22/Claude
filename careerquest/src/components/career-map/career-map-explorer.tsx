"use client";

import { useMemo, useRef, useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { STATUS_LABELS } from "@/lib/career-map/labels";
import type { CareerMapView } from "@/lib/career-map/types";
import { cn } from "@/lib/utils";
import { CareerListView } from "./list-view";
import { MapCanvas, prefersReducedMotion } from "./map-canvas";
import { NodePanel } from "./node-panel";

type Mode = "map" | "list";

/**
 * Interactive Career Map: map or list view on the left, the selected stop's detail panel on the
 * right (below on small screens). Selection is mirrored to `?node=` so a stop can be linked to.
 */
export function CareerMapExplorer({ view, initialKey }: { view: CareerMapView; initialKey?: string | null }) {
  const nodesByKey = useMemo(() => new Map(view.nodes.map((n) => [n.key, n])), [view.nodes]);
  const fallback = view.currentKey ?? view.nodes[0]?.key ?? "";
  const [selectedKey, setSelectedKey] = useState(initialKey && nodesByKey.has(initialKey) ? initialKey : fallback);
  const [mode, setMode] = useState<Mode>("map");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selected = nodesByKey.get(selectedKey) ?? nodesByKey.get(fallback) ?? null;

  function select(key: string, via: "pointer" | "keyboard" = "pointer") {
    if (!nodesByKey.has(key)) return;
    setSelectedKey(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("node", key);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // URL sync is a convenience only.
    }
    const panel = panelRef.current;
    if (panel && !window.matchMedia("(min-width: 1024px)").matches) {
      panel.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      if (via === "keyboard") panel.querySelector<HTMLElement>("h2[tabindex]")?.focus({ preventScroll: true });
    }
  }

  function backToMap() {
    const el = mapRef.current?.querySelector<HTMLButtonElement>(`[data-node-key="${selectedKey}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", inline: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    } else {
      mapRef.current?.scrollIntoView({ block: "start" });
    }
  }

  if (!selected) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Choose a view" className="inline-flex rounded-ctl border border-line bg-surface p-0.5">
          {(
            [
              ["map", "Map", MapIcon],
              ["list", "List", List],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-sm transition-colors",
                mode === m ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-subtle tnum">
          {view.counts.COMPLETED} completed · {view.counts.IN_PROGRESS} in progress · {view.counts.AVAILABLE} available · {view.counts.LOCKED} locked
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div ref={mapRef} className="min-w-0">
          {mode === "map" ? (
            <MapCanvas
              nodes={view.nodes}
              edges={view.edges}
              branches={view.branches}
              selectedKey={selected.key}
              currentKey={view.currentKey}
              onSelect={select}
            />
          ) : (
            <CareerListView nodes={view.nodes} branches={view.branches} selectedKey={selected.key} currentKey={view.currentKey} onSelect={(k) => select(k)} />
          )}
        </div>
        <div
          ref={panelRef}
          id="career-node-panel"
          className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain"
        >
          <NodePanel
            node={selected}
            nodesByKey={nodesByKey}
            isCurrent={selected.key === view.currentKey}
            onSelect={(k) => select(k)}
            onBackToMap={backToMap}
          />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {`${selected.title}: ${STATUS_LABELS[selected.state.status]}. ${selected.state.reason}`}
      </p>
    </div>
  );
}
