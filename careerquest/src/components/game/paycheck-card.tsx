"use client";

import { useRef } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { logPaycheckAction, removePaycheckAction } from "@/lib/game/actions";
import type { Paycheck } from "@/lib/game/campaign-meta";
import { formatCurrency } from "@/lib/format";
import { useGameAction } from "./use-game-action";
import { formatDayKey } from "./format";

function RemovePaycheck({ paycheck }: { paycheck: Paycheck }) {
  const [, action, pending] = useGameAction(removePaycheckAction);
  return (
    <form action={action}>
      <input type="hidden" name="paycheckId" value={paycheck.id} />
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        loading={pending}
        aria-label={`Remove paycheck of ${formatCurrency(paycheck.amount, { cents: true })} paid ${formatDayKey(paycheck.payDate, true)}`}
      >
        {!pending && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
      </Button>
    </form>
  );
}

/** "Log a paycheck": adds to career earnings (self-reported) and unlocks First Paycheck. */
export function PaycheckCard({
  paychecks,
  paycheckCount,
  careerEarnings,
  todayKey,
}: {
  paychecks: Paycheck[];
  paycheckCount: number;
  careerEarnings: number;
  todayKey: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useGameAction(logPaycheckAction, () => formRef.current?.reset());
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <section aria-labelledby="paycheck-title" className="glass rounded-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="paycheck-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <Wallet className="h-4 w-4 text-fg-subtle" aria-hidden />
          Career earnings
        </h2>
        <Badge tone="neutral">Self-reported</Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold tnum text-gold" data-testid="career-earnings">
        {formatCurrency(careerEarnings, { cents: true })}
      </p>
      <p className="text-xs text-fg-subtle tnum">
        {paycheckCount === 0 ? "No paychecks logged yet." : `${paycheckCount} paycheck${paycheckCount === 1 ? "" : "s"} logged.`}
      </p>

      <form ref={formRef} action={action} className="mt-4 grid grid-cols-2 gap-3 items-end" noValidate>
        <Field label="Amount (USD)" htmlFor="pay-amount" errors={errors?.amount}>
          <Input id="pay-amount" name="amount" type="number" inputMode="decimal" min={0} step="0.01" required />
        </Field>
        <Field label="Pay date" htmlFor="pay-date" errors={errors?.payDate}>
          <Input id="pay-date" name="payDate" type="date" required max={todayKey} defaultValue={todayKey} />
        </Field>
        <div className="col-span-2">
          <Button type="submit" size="sm" loading={pending}>
            Log a paycheck
          </Button>
        </div>
      </form>

      {paychecks.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line" aria-label="Recent paychecks">
          {paychecks.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="tnum">{formatDayKey(p.payDate, true)}</span>
              <span className="flex items-center gap-1 tnum">
                {formatCurrency(p.amount, { cents: true })}
                <RemovePaycheck paycheck={p} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
