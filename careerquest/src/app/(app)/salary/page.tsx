import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { formatInTz } from "@/lib/applications/time";
import { listScenarios } from "@/lib/salary/scenarios";
import { SalaryCalculator } from "@/components/salary/calculator";

export const metadata = { title: "Salary calculator · CareerQuest" };

export default async function SalaryCalculatorPage() {
  const user = await requireUser("/salary");
  const [scenarios, timezone] = await Promise.all([listScenarios(user.id, "calculator"), userTimezone(user.id)]);
  return (
    <>
      <h2 className="sr-only">Calculator</h2>
      <SalaryCalculator scenarios={scenarios.map((s) => ({ id: s.id, name: s.name, updatedLabel: formatInTz(s.updatedAt, timezone), values: s.values }))} />
    </>
  );
}
