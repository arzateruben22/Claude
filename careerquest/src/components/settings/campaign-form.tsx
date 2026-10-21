"use client";

import { useState } from "react";
import { CalendarDays, Flag, Hourglass } from "lucide-react";
import { updateCampaignTargetsAction } from "@/lib/profile/actions";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, StatTile } from "@/components/ui";
import { TargetsFields, type TargetsDefaults } from "./targets-fields";
import { useSettingsAction } from "./use-settings-action";

export type CampaignSummary = {
  /** YYYY-MM-DD of the campaign start (user's calendar). */
  startedAtKey: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  dayIndex: number;
};

const DAY_MS = 86_400_000;
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Calendar date of the final campaign day for a start key and length. Pure. */
export function lastCampaignDay(startedAtKey: string, lengthDays: number): string {
  const [y, m, d] = startedAtKey.split("-").map(Number);
  const start = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  const len = Number.isFinite(lengthDays) && lengthDays >= 1 ? Math.floor(lengthDays) : 1;
  return fmt.format(new Date(start + (len - 1) * DAY_MS));
}

export function CampaignForm({
  campaign,
  campaignLengthDays,
  targets,
}: {
  campaign: CampaignSummary;
  campaignLengthDays: number;
  targets: TargetsDefaults;
}) {
  const [state, action, pending] = useSettingsAction(updateCampaignTargetsAction);
  const [length, setLength] = useState(String(campaignLengthDays));
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const len = Number(length);
  const validLen = Number.isInteger(len) && len >= 7 && len <= 365;
  const beyond = validLen && campaign.dayIndex > len;
  const notStarted = campaign.dayIndex < 1;

  return (
    <form action={action} noValidate className="space-y-4" aria-label="Campaign targets">
      {state && !state.ok && state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Campaign started" value={fmt.format(new Date(campaign.startedAtKey + "T00:00:00Z"))} icon={<Flag className="h-4 w-4" aria-hidden />} hint="Operation Get Hired" />
        <StatTile
          label="Today"
          value={notStarted ? "Not started" : `Day ${campaign.dayIndex}`}
          hint={validLen ? (beyond ? `beyond the ${len}-day window` : `of ${len}`) : "set a valid length"}
          tone={beyond ? "warning" : undefined}
          icon={<Hourglass className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Final campaign day"
          value={validLen ? lastCampaignDay(campaign.startedAtKey, len) : "—"}
          hint={validLen ? "updates with the length below" : "7 to 365 days"}
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Campaign length</CardTitle>
            <CardDescription>Changing the length moves the campaign end date; the start date stays where it is.</CardDescription>
          </div>
          <Badge tone={campaign.status === "ACTIVE" ? "success" : campaign.status === "COMPLETED" ? "gold" : "warning"}>{campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}</Badge>
        </CardHeader>
        <CardContent>
          <Field label="Campaign length (days)" htmlFor="campaignLengthDays" errors={fe?.campaignLengthDays} hint="The classic plan is 90 days: Launch, Momentum, Close." className="max-w-xs">
            <Input id="campaignLengthDays" name="campaignLengthDays" type="number" inputMode="numeric" min={7} max={365} required value={length} onChange={(e) => setLength(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Application targets</CardTitle>
            <CardDescription>Missions and the numbers-game pace are measured against these.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TargetsFields defaults={targets} errors={fe} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save campaign
        </Button>
      </div>
    </form>
  );
}
