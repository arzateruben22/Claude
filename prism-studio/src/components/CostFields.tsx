// The fields of one cost entry, shared by "Record a cost" and each entry's edit form (rendered on the server, inside
// an ActionForm). Amounts are typed as money ("12.40") and stored as whole cents.
import { COST_CATEGORIES, CURRENCIES, type CostEntry } from "@/domain/costs";
import { centsInput } from "@/lib/format";

type Opt = { id: string; name: string };
type Ep = { id: string; number: number; title: string; channelId: string };

const CATEGORY_LABEL: Record<string, string> = {
  voice: "Voice", visuals: "Visuals", music: "Music", research: "Research", render: "Render", storage: "Storage", software: "Software", publishing: "Publishing", other: "Other",
};

export function CostFields({ channels, episodes, today, entry, channelId }: { channels: Opt[]; episodes: Ep[]; today: string; entry?: CostEntry; channelId?: string | null }) {
  const amount = entry ? centsInput(entry.source === "estimate" ? entry.estimateCents : entry.actualCents ?? 0) : "";
  return (
    <>
      <label className="field">What it was <input name="description" required maxLength={200} defaultValue={entry?.description ?? ""} placeholder="Narration for No. 004" /></label>
      <div className="cost-pair">
        <label className="field">Amount <input name="amount" inputMode="decimal" required defaultValue={amount} placeholder="12.40" autoComplete="off" /></label>
        <label className="field">Currency
          <select name="currency" defaultValue={entry?.currency ?? "USD"}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
      </div>
      <div className="cost-pair">
        <label className="field">Date <input name="incurredOn" type="date" required defaultValue={entry?.incurredOn ?? today} /></label>
        <label className="field">Category
          <select name="category" defaultValue={entry?.category ?? "voice"}>{COST_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
        </label>
      </div>
      <label className="field">Channel
        <select name="channelId" defaultValue={entry ? entry.channelId ?? "" : channelId ?? ""}>
          <option value="">Studio-wide (no channel)</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="field">Episode <span className="hint">Optional. Picking one sets its channel.</span>
        <select name="episodeId" defaultValue={entry?.episodeId ?? ""}>
          <option value="">No episode</option>
          {channels.map((c) => {
            const mine = episodes.filter((e) => e.channelId === c.id);
            return mine.length ? <optgroup key={c.id} label={c.name}>{mine.map((e) => <option key={e.id} value={e.id}>No. {String(e.number).padStart(3, "0")} · {e.title}</option>)}</optgroup> : null;
          })}
        </select>
      </label>
      <label className="field">Paid to <span className="hint">Optional: the service or person.</span><input name="provider" maxLength={80} defaultValue={entry && entry.provider !== "local" ? entry.provider : ""} placeholder="ElevenLabs" /></label>
      <label className="check"><input type="checkbox" name="estimate" defaultChecked={entry?.source === "estimate"} /> <span><b>This is an estimate</b><br /><span className="muted">Labelled ESTIMATE and never counted as spent.</span></span></label>
      <label className="field">Note <span className="hint">Optional.</span><input name="note" maxLength={500} defaultValue={entry?.note ?? ""} /></label>
    </>
  );
}
