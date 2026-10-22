"use client";

import { useActionState, useCallback, useId } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { clearCareerNodeMarkAction, markCareerNodeAction, type CareerMapActionResult } from "@/lib/career-map/actions";
import { MARK_LABELS } from "@/lib/career-map/labels";
import { MARK_NOTES_MAX } from "@/lib/career-map/schema";
import { MARKABLE_STATUSES, type CareerNodeStatus, type MarkableStatus } from "@/lib/career-map/types";
import { cn } from "@/lib/utils";

type Action = (prev: CareerMapActionResult | null, formData: FormData) => Promise<CareerMapActionResult>;

function useMapAction(action: Action) {
  const toast = useToast();
  const wrapped = useCallback<Action>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.ok) toast.push({ tone: "success", title: result.data.message });
      else if (!result.fieldErrors) toast.push({ tone: "danger", title: result.error });
      return result;
    },
    [action, toast],
  );
  return useActionState(wrapped, null);
}

const isMarkable = (s: CareerNodeStatus): s is MarkableStatus => (MARKABLE_STATUSES as readonly string[]).includes(s);

/**
 * "Mark this stop yourself": the user's own status for a stop, stored in UserCareerNode and always
 * shown as "Marked by you". Remount with a `key` when the selected stop or its mark changes.
 */
export function MarkForm({
  nodeKey,
  title,
  override,
  derivedStatus,
}: {
  nodeKey: string;
  title: string;
  override: { status: CareerNodeStatus; notes: string | null } | null;
  derivedStatus: CareerNodeStatus;
}) {
  const [state, markAction, marking] = useMapAction(markCareerNodeAction);
  const [, clearAction, clearing] = useMapAction(clearCareerNodeMarkAction);
  const id = useId();
  const initial: MarkableStatus = override && isMarkable(override.status) ? override.status : isMarkable(derivedStatus) ? derivedStatus : "AVAILABLE";
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div id="career-node-mark" className="rounded-card border border-line bg-surface p-4 scroll-mt-4">
      <form action={markAction} className="space-y-3">
        <input type="hidden" name="nodeKey" value={nodeKey} />
        <fieldset>
          <legend className="text-sm font-medium text-fg">Mark this stop yourself</legend>
          <p className="mt-0.5 text-xs text-fg-muted">
            Use this when CareerQuest cannot see your progress (for example, a completed apprenticeship). Your mark is labelled
            &ldquo;Marked by you&rdquo;, changes only your map, earns no XP and is not a credential.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5" data-node-title={title}>
            {MARKABLE_STATUSES.map((s) => (
              <label
                key={s}
                className={cn(
                  "relative flex cursor-pointer items-center justify-center rounded-ctl border border-line px-2 py-2 text-center text-xs font-medium text-fg-muted",
                  "has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-fg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                )}
              >
                <input type="radio" name="status" value={s} defaultChecked={s === initial} className="sr-only" />
                {MARK_LABELS[s]}
              </label>
            ))}
          </div>
          <FieldError errors={fe?.status} />
        </fieldset>
        <div>
          <Label htmlFor={`${id}-notes`}>Note (optional)</Label>
          <Textarea
            id={`${id}-notes`}
            name="notes"
            maxLength={MARK_NOTES_MAX}
            defaultValue={override?.notes ?? ""}
            placeholder="e.g. Program completion letter received"
            className="min-h-16"
          />
          <FieldError errors={fe?.notes} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" loading={marking}>
            {override ? "Update my mark" : "Save my mark"}
          </Button>
        </div>
      </form>
      {override && (
        <form action={clearAction} className="mt-2">
          <input type="hidden" name="nodeKey" value={nodeKey} />
          <Button type="submit" size="sm" variant="ghost" loading={clearing}>
            Remove my mark and follow my data
          </Button>
        </form>
      )}
    </div>
  );
}
