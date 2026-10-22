"use client";

import { useOptimistic, useTransition } from "react";
import type { ChecklistItem, ChecklistSource } from "@/lib/academy/programs/checklist";
import { CHECKLIST_SOURCE_LABELS } from "@/lib/academy/programs/checklist";
import { toggleChecklistItemAction } from "@/lib/academy/programs/actions";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ORDER: ChecklistSource[] = ["eligibility", "process", "document"];

/** Application checklist with optimistic ticks; each change is saved by a server action. */
export function ProgramChecklist({ programId, items }: { programId: string; items: ChecklistItem[] }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(items, (current: ChecklistItem[], change: { id: string; done: boolean }) =>
    current.map((i) => (i.id === change.id ? { ...i, done: change.done } : i)),
  );
  const done = optimistic.filter((i) => i.done).length;

  const toggle = (item: ChecklistItem, next: boolean) => {
    startTransition(async () => {
      setOptimistic({ id: item.id, done: next });
      const fd = new FormData();
      fd.set("programId", programId);
      fd.set("itemId", item.id);
      fd.set("done", String(next));
      const result = await toggleChecklistItemAction(null, fd);
      if (!result.ok) toast.push({ tone: "danger", title: result.error });
    });
  };

  if (items.length === 0) {
    return <p className="text-sm text-fg-muted">This program has no researched requirements yet, so there is nothing to check off. Contact the program for its checklist.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-fg-muted tnum" aria-live="polite">
          {done} of {optimistic.length} done
        </p>
        <ProgressBar value={done} max={optimistic.length} className="mt-1.5" label="Checklist progress" />
      </div>
      {ORDER.map((source) => {
        const group = optimistic.filter((i) => i.source === source);
        if (group.length === 0) return null;
        return (
          <fieldset key={source} className="space-y-2">
            <legend className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">{CHECKLIST_SOURCE_LABELS[source]}</legend>
            <ul className="space-y-1.5">
              {group.map((item) => {
                const id = `check-${item.id}`;
                return (
                  <li key={item.id} className="flex items-start gap-2.5 rounded-ctl px-2 py-1.5 hover:bg-surface-hover">
                    <input
                      id={id}
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-[var(--accent)]"
                      checked={item.done}
                      onChange={(e) => toggle(item, e.currentTarget.checked)}
                    />
                    <label htmlFor={id} className={cn("text-sm leading-snug", item.done ? "text-fg-muted line-through" : "text-fg")}>
                      {item.label}
                      {item.confirm && (
                        <span className="ml-1.5 rounded-full border border-warning/30 bg-warning-soft px-1.5 py-px text-[10px] font-medium text-warning no-underline">
                          Unverified
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
