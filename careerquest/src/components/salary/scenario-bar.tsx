"use client";

import { useCallback, useId, useState } from "react";
import { FolderOpen, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { useToastAction } from "@/components/applications/use-toast-action";
import { deleteScenarioAction, saveScenarioAction, type ScenarioActionData } from "@/lib/salary/actions";
import type { ScenarioKind } from "@/lib/salary/forms";

/** `updatedLabel` is formatted on the server in the user's timezone (avoids hydration drift). */
export type ScenarioOption<V> = { id: string; name: string; updatedLabel: string; values: V };

/**
 * Save, load, overwrite and delete named scenarios (SalaryScenario rows). Loading only replaces the
 * form values in the browser; nothing is saved until the user presses Save.
 */
export function ScenarioBar<V>({
  kind,
  scenarios,
  values,
  onLoad,
}: {
  kind: ScenarioKind;
  scenarios: ScenarioOption<V>[];
  values: V;
  onLoad: (values: V) => void;
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string>(scenarios[0]?.id ?? "");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = scenarios.find((s) => s.id === selectedId) ?? null;
  const loaded = scenarios.find((s) => s.id === loadedId) ?? null;
  const inputsJson = JSON.stringify({ kind, version: 1, values });

  const onSaved = useCallback((data: ScenarioActionData) => {
    setLoadedId(data.id);
    setSelectedId(data.id);
    setName("");
  }, []);
  const onDeleted = useCallback(
    (data: ScenarioActionData) => {
      setConfirmDelete(false);
      if (loadedId === data.id) setLoadedId(null);
      setSelectedId("");
    },
    [loadedId],
  );
  const [saveState, saveAction, saving] = useToastAction(saveScenarioAction, onSaved);
  const [, updateAction, updating] = useToastAction(saveScenarioAction);
  const [, deleteAction, deleting] = useToastAction(deleteScenarioAction, onDeleted);
  const nameErrors = saveState && !saveState.ok ? saveState.fieldErrors?.name : undefined;

  return (
    <Card data-testid={`scenario-bar-${kind}`}>
      <CardHeader>
        <div>
          <CardTitle>Saved scenarios</CardTitle>
          <CardDescription>Save these inputs under a name to compare later. Only you can see them.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {scenarios.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-48">
              <Label htmlFor={`${id}-pick`}>Your scenarios</Label>
              <Select id={`${id}-pick`} value={selected ? selected.id : ""} onChange={(e) => setSelectedId(e.target.value)}>
                {!selected && <option value="">Choose a scenario</option>}
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.updatedLabel}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="secondary"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                onLoad(selected.values);
                setLoadedId(selected.id);
              }}
            >
              <FolderOpen className="h-4 w-4" aria-hidden />
              Load
            </Button>
            <Button variant="ghost" disabled={!selected} onClick={() => setConfirmDelete(true)} aria-label={selected ? `Delete scenario ${selected.name}` : "Delete scenario"}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">No saved scenarios yet.</p>
        )}

        <form action={saveAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="inputs" value={inputsJson} />
          <Field label="Scenario name" htmlFor={`${id}-name`} errors={nameErrors} className="min-w-0 flex-1 basis-48">
            <Input id={`${id}-name`} name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Union apprenticeship, 5 h overtime" required />
          </Field>
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" aria-hidden />
            Save as new
          </Button>
        </form>

        {loaded && (
          <form action={updateAction} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="id" value={loaded.id} />
            <input type="hidden" name="name" value={loaded.name} />
            <input type="hidden" name="inputs" value={inputsJson} />
            <span className="text-fg-muted">
              Loaded: <strong className="font-medium text-fg">{loaded.name}</strong>
            </span>
            <Button type="submit" variant="outline" size="sm" loading={updating}>
              Update “{loaded.name}” with current inputs
            </Button>
          </form>
        )}
      </CardContent>

      <Dialog open={confirmDelete && !!selected} onClose={() => setConfirmDelete(false)} title="Delete scenario?" description={selected ? `“${selected.name}” will be removed for good.` : undefined} size="sm">
        <form action={deleteAction} className="flex justify-end gap-2">
          <input type="hidden" name="id" value={selected?.id ?? ""} />
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={deleting}>
            Delete
          </Button>
        </form>
      </Dialog>
    </Card>
  );
}
