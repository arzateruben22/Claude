"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button, FieldError, Input, Label } from "@/components/ui";
import { REGION_SUGGESTIONS } from "@/lib/profile/constants";

/** Chip input for job-search regions. Each chip is a hidden `regions` field so the form posts an array. */
export function RegionsInput({
  name = "regions",
  defaultValue,
  errors,
  max = 10,
}: {
  name?: string;
  defaultValue: string[];
  errors?: string[];
  max?: number;
}) {
  const [regions, setRegions] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const add = (value: string) => {
    const v = value.trim().slice(0, 80);
    if (!v) return;
    if (regions.some((r) => r.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    if (regions.length >= max) return;
    setRegions([...regions, v]);
    setDraft("");
  };
  const remove = (value: string) => setRegions(regions.filter((r) => r !== value));
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && regions.length > 0) {
      setRegions(regions.slice(0, -1));
    }
  };
  const suggestions = REGION_SUGGESTIONS.filter((s) => !regions.some((r) => r.toLowerCase() === s.toLowerCase()));
  const full = regions.length >= max;

  return (
    <div>
      <Label htmlFor={inputId}>Regions</Label>
      <ul className="flex flex-wrap gap-1.5 mb-2" aria-label="Selected regions">
        {regions.map((r) => (
          <li key={r} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-strong pl-2.5 pr-1 py-0.5 text-xs text-fg">
            {r}
            <input type="hidden" name={name} value={r} />
            <button
              type="button"
              aria-label={`Remove ${r}`}
              onClick={() => remove(r)}
              className="rounded-full p-0.5 text-fg-muted hover:text-fg hover:bg-surface-hover"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
        {regions.length === 0 && <li className="text-xs text-fg-subtle">No regions yet — add at least one.</li>}
      </ul>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. Riverside County, CA"
          maxLength={80}
          aria-describedby={hintId}
          disabled={full}
        />
        <Button type="button" variant="secondary" onClick={() => add(draft)} disabled={!draft.trim() || full}>
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>
      <p id={hintId} className="mt-1 text-xs text-fg-subtle">
        {full ? `Maximum of ${max} regions reached.` : `Press Enter to add. Up to ${max} regions.`}
      </p>
      {suggestions.length > 0 && !full && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested regions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-hover"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <FieldError errors={errors} />
    </div>
  );
}
