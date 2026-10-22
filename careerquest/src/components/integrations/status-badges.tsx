import { Badge, type Tone } from "@/components/ui/badge";
import type { IntegrationStatus, SyncStatus } from "@/generated/prisma/enums";
import { CAPABILITY_LEVEL_LABELS, type CapabilityLevel, type DisplayStatus } from "@/lib/integrations/registry";

const STATUS_TONES: Record<DisplayStatus, Tone> = {
  Connected: "success",
  Available: "accent",
  Experimental: "warning",
  "Manual-only": "neutral",
  Unsupported: "danger",
};

/** The provider's single display status, as visible text (never color alone). */
export function IntegrationStatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} data-status={status}>
      {status}
    </Badge>
  );
}

const LEVEL_TONES: Record<CapabilityLevel, Tone> = { supported: "success", experimental: "warning", unsupported: "neutral" };

export function CapabilityBadge({ level }: { level: CapabilityLevel }) {
  return <Badge tone={LEVEL_TONES[level]}>{CAPABILITY_LEVEL_LABELS[level]}</Badge>;
}

const CONNECTION_LABELS: Record<IntegrationStatus, { label: string; tone: Tone }> = {
  CONNECTED: { label: "Connected", tone: "success" },
  NEEDS_REAUTH: { label: "Reconnect needed", tone: "warning" },
  ERROR: { label: "Error", tone: "danger" },
  DISCONNECTED: { label: "Disconnected", tone: "neutral" },
};

export function ConnectionStatusBadge({ status }: { status: IntegrationStatus }) {
  const s = CONNECTION_LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const RUN_LABELS: Record<SyncStatus, { label: string; tone: Tone }> = {
  RUNNING: { label: "Running", tone: "info" },
  SUCCEEDED: { label: "Succeeded", tone: "success" },
  PARTIAL: { label: "Partial", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function RunStatusBadge({ status }: { status: SyncStatus }) {
  const s = RUN_LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
