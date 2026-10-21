"use client";

import { ShieldCheck } from "lucide-react";
import { updateEligibilityAction } from "@/lib/profile/actions";
import type { EligibilityInput } from "@/lib/profile/schema";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Toggle } from "./toggle";
import { useSettingsAction } from "./use-settings-action";

export function EligibilityForm({ defaults }: { defaults: EligibilityInput }) {
  const [state, action, pending] = useSettingsAction(updateEligibilityAction);

  return (
    <form action={action} noValidate className="space-y-4" aria-label="Eligibility filters">
      <Alert tone="info" title="Private to you">
        These switches are preferences, not records. CareerQuest uses them only to flag or filter listings whose text mentions these
        requirements. It does not store your license status, driving record or any detail about them — only whether each switch is on
        or off.
      </Alert>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
              Exclude listings that require…
            </CardTitle>
            <CardDescription>Flagged listings stay visible in discovery with a badge; excluded ones are hidden from suggestions.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-line">
          <Toggle
            id="excludeCompanyVehicleJobs"
            name="excludeCompanyVehicleJobs"
            label="A company vehicle"
            description="Roles where driving a company truck or van is part of the job."
            defaultChecked={defaults.excludeCompanyVehicleJobs}
          />
          <Toggle
            id="excludeDrivingRecordJobs"
            name="excludeDrivingRecordJobs"
            label="An unrestricted driving record"
            description="Roles that ask for a clean MVR or an unrestricted license as a condition of hire."
            defaultChecked={defaults.excludeDrivingRecordJobs}
          />
          <Toggle
            id="excludeCdlJobs"
            name="excludeCdlJobs"
            label="A commercial driver's license (CDL)"
            description="Roles that require a Class A or Class B CDL."
            defaultChecked={defaults.excludeCdlJobs}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save filters
        </Button>
      </div>
    </form>
  );
}
