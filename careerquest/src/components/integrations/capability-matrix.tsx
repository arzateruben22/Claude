import {
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_LABELS,
  CAPABILITY_NAMES,
  type CapabilityMatrix as Matrix,
} from "@/lib/integrations/registry";
import { CapabilityBadge } from "./status-badges";

/** The provider adapter's honest capability matrix (five operations, each with a visible level). */
export function CapabilityMatrix({ capabilities, providerName }: { capabilities: Matrix; providerName: string }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5" aria-label={`${providerName} capabilities`}>
      {CAPABILITY_NAMES.map((name) => (
        <div key={name} className="flex items-center justify-between gap-2 min-w-0" title={CAPABILITY_DESCRIPTIONS[name]}>
          <dt className="text-xs text-fg-muted truncate">{CAPABILITY_LABELS[name]}</dt>
          <dd className="shrink-0">
            <CapabilityBadge level={capabilities[name]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
