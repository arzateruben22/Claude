// "Plan the week" as a button wherever posts wait for a slot (the Calendar page is no longer in the navigation).
// It runs the same planWeek action: open slots are filled in episode order; each post still needs its approval.
import { planWeek } from "@/app/actions";
import { ActionForm } from "./ActionForm";

export function PlanWeek({ label = "Plan the week" }: { label?: string }) {
  return (
    <ActionForm action={planWeek} className="plan-week" submit={label} submitClass="btn ghost small">
      <input type="hidden" name="days" value="7" />
    </ActionForm>
  );
}
