"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { LocateFixed, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRANCH_LABELS } from "@/lib/career-map/graph";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/career-map/labels";
import { MAP_LAYOUT, canvasSize, directionForKey, edgePath, nodeOrigin, readingOrder, spatialNeighbor } from "@/lib/career-map/navigation";
import type { BranchMeta, CareerMapNode, CareerNodeStatus, GraphEdge } from "@/lib/career-map/types";
import { cn } from "@/lib/utils";
import { KIND_ICONS, STATUS_CARD, STATUS_ICONS, STATUS_TEXT } from "./status-meta";

/** True when the OS or the CareerQuest profile asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.reducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type EdgeTone = "done" | "active" | "idle";

function edgeTone(from: CareerNodeStatus | undefined, to: CareerNodeStatus | undefined): EdgeTone {
  if (from === "COMPLETED" && to === "COMPLETED") return "done";
  if ((from === "COMPLETED" || from === "IN_PROGRESS") && to !== "LOCKED") return "active";
  return "idle";
}

const EDGE_COLORS: Record<EdgeTone, string> = { done: "var(--success)", active: "var(--accent)", idle: "var(--line-strong)" };

/**
 * The pannable map: absolutely positioned stop buttons over an SVG connector layer inside a
 * scroll container. Touch scrolls/pans natively; a mouse can drag the background. Arrow keys move
 * between stops (roving tabindex), Home/End jump to the ends, Enter/Space opens a stop.
 */
export function MapCanvas({
  nodes,
  edges,
  branches,
  selectedKey,
  currentKey,
  onSelect,
}: {
  nodes: CareerMapNode[];
  edges: GraphEdge[];
  branches: BranchMeta[];
  selectedKey: string;
  currentKey: string | null;
  onSelect: (key: string, via: "pointer" | "keyboard") => void;
}) {
  const uid = useId().replace(/:/g, "");
  const scroller = useRef<HTMLDivElement | null>(null);
  const centered = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [focusKey, setFocusKey] = useState(selectedKey);
  // Keep the single tabbable stop in sync when the selection changes elsewhere (list, panel links).
  const [lastSelected, setLastSelected] = useState(selectedKey);
  if (lastSelected !== selectedKey) {
    setLastSelected(selectedKey);
    setFocusKey(selectedKey);
  }
  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const size = useMemo(() => canvasSize(nodes), [nodes]);
  const order = useMemo(() => readingOrder(nodes), [nodes]);
  const { nodeWidth: W, nodeHeight: H } = MAP_LAYOUT;

  // Lane labels for side branches (decorative; each stop names its branch too).
  const lanes = useMemo(
    () =>
      branches
        .filter((b) => b.key !== "electrician")
        .flatMap((b) => {
          const entry = nodes.find((n) => n.branch === b.key && n.kind === "entry");
          return entry && !nodes.some((n) => n.col === 0 && n.row === entry.row) ? [{ key: b.key, label: b.label, row: entry.row }] : [];
        }),
    [branches, nodes],
  );

  function centerOn(key: string, smooth: boolean) {
    const el = scroller.current;
    const n = byKey.get(key);
    if (!el || !n) return;
    const o = nodeOrigin(n);
    el.scrollTo({
      left: Math.max(0, o.x + W / 2 - el.clientWidth / 2),
      top: Math.max(0, o.y + H / 2 - el.clientHeight / 2),
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  }

  function attachScroller(el: HTMLDivElement | null) {
    scroller.current = el;
    if (el && !centered.current) {
      centered.current = true;
      const n = byKey.get(currentKey ?? selectedKey);
      if (n) {
        const o = nodeOrigin(n);
        el.scrollLeft = Math.max(0, o.x + W / 2 - el.clientWidth / 2);
        el.scrollTop = Math.max(0, o.y + H / 2 - el.clientHeight / 2);
      }
    }
  }

  function moveFocus(key: string) {
    setFocusKey(key);
    const btn = buttons.current.get(key);
    if (!btn) return;
    btn.focus({ preventScroll: true });
    btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function onNodeKeyDown(e: KeyboardEvent<HTMLButtonElement>, key: string) {
    const dir = directionForKey(e.key);
    let next: string | null = null;
    if (dir) next = spatialNeighbor(nodes, key, dir);
    else if (e.key === "Home") next = order[0] ?? null;
    else if (e.key === "End") next = order[order.length - 1] ?? null;
    else return;
    e.preventDefault();
    if (next) moveFocus(next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as Element).closest("button, a")) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    el.dataset.dragging = "true";
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = scroller.current;
    if (!d || !el) return;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    if (!drag.current || !el) return;
    drag.current = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    delete el.dataset.dragging;
  }

  const marker = (tone: EdgeTone) => `${uid}-arrow-${tone}`;

  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p id={`${uid}-help`} className="text-xs text-fg-subtle">
          Drag or scroll to pan. Arrow keys move between stops; Enter opens details.
        </p>
        {currentKey && (
          <Button variant="ghost" size="sm" onClick={() => centerOn(currentKey, true)}>
            <LocateFixed className="h-3.5 w-3.5" aria-hidden />
            Center on my position
          </Button>
        )}
      </div>
      <div
        ref={attachScroller}
        className="relative max-h-[70vh] overflow-auto overscroll-contain cursor-grab data-[dragging=true]:cursor-grabbing data-[dragging=true]:select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="career-map-canvas"
      >
        <div
          role="group"
          aria-label="Career map"
          aria-describedby={`${uid}-help`}
          className="relative"
          style={{ width: size.width, height: size.height }}
        >
          <svg width={size.width} height={size.height} className="pointer-events-none absolute inset-0" aria-hidden focusable="false">
            <defs>
              {(["done", "active", "idle"] as const).map((t) => (
                <marker key={t} id={marker(t)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLORS[t]} />
                </marker>
              ))}
            </defs>
            {edges.map((e) => {
              const a = byKey.get(e.from);
              const b = byKey.get(e.to);
              if (!a || !b) return null;
              const tone = edgeTone(a.state.status, b.state.status);
              const touchesSelected = e.from === selectedKey || e.to === selectedKey;
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={edgePath(a, b)}
                  fill="none"
                  stroke={EDGE_COLORS[tone]}
                  strokeWidth={touchesSelected ? 2.5 : 1.5}
                  strokeOpacity={touchesSelected || tone !== "idle" ? 0.95 : 0.7}
                  strokeDasharray={e.kind === "typical" ? "5 5" : undefined}
                  markerEnd={`url(#${marker(tone)})`}
                />
              );
            })}
          </svg>

          {lanes.map((l) => {
            const o = nodeOrigin({ col: 0, row: l.row });
            return (
              <div
                key={l.key}
                aria-hidden
                className="pointer-events-none absolute flex items-center justify-end pr-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle"
                style={{ left: o.x, top: o.y, width: W, height: H }}
              >
                {l.label}
              </div>
            );
          })}

          {nodes.map((n) => {
            const o = nodeOrigin(n);
            const s = n.state;
            const StatusIcon = STATUS_ICONS[s.status];
            const KindIcon = KIND_ICONS[n.kind];
            const selected = n.key === selectedKey;
            const current = n.key === currentKey;
            const eyebrow = n.branch === "electrician" ? KIND_LABELS[n.kind] : BRANCH_LABELS[n.branch];
            return (
              <button
                key={n.key}
                ref={(el) => {
                  if (el) buttons.current.set(n.key, el);
                  else buttons.current.delete(n.key);
                }}
                type="button"
                tabIndex={n.key === focusKey ? 0 : -1}
                aria-pressed={selected}
                aria-current={current ? "location" : undefined}
                data-node-key={n.key}
                data-status={s.status}
                onClick={(e) => onSelect(n.key, e.detail === 0 ? "keyboard" : "pointer")}
                onFocus={() => setFocusKey(n.key)}
                onKeyDown={(e) => onNodeKeyDown(e, n.key)}
                className={cn(
                  "absolute flex cursor-pointer flex-col rounded-ctl border px-2.5 py-2 text-left transition-colors hover:border-accent/70",
                  STATUS_CARD[s.status],
                  selected && "ring-2 ring-accent",
                  current && !selected && "ring-2 ring-gold animate-pulse-glow",
                )}
                style={{ left: o.x, top: o.y, width: W, height: H }}
              >
                {current && (
                  <span className="absolute -top-2.5 left-2 inline-flex items-center gap-1 rounded-full border border-gold/40 bg-bg-elevated px-1.5 py-px text-[10px] font-semibold text-gold">
                    <MapPin className="h-3 w-3" aria-hidden />
                    You are here
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                  <KindIcon className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{eyebrow}</span>
                  {s.interest && (
                    <span className="ml-auto text-gold" title={s.interest === "primary" ? "Your primary trade" : "On your interest list"}>
                      <Star className="h-3 w-3" aria-hidden />
                      <span className="sr-only">{s.interest === "primary" ? ", your primary trade" : ", on your interest list"}</span>
                    </span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-fg">{n.title}</span>
                <span className="mt-auto flex items-center gap-1 text-[11px]">
                  <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", STATUS_TEXT[s.status])} aria-hidden />
                  <span className="text-fg-muted">{STATUS_LABELS[s.status]}</span>
                  {s.override && <span className="ml-auto truncate text-accent">Marked by you</span>}
                </span>
                {s.progress && (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-strong" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{ width: `${Math.max(0, Math.min(100, (s.progress.value / Math.max(1, s.progress.max)) * 100))}%` }}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
