"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { OfferStatus, SalaryPeriod } from "@/generated/prisma/enums";
import type { OfferFormValues } from "./offer-values";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createOfferAction, updateOfferAction } from "@/lib/offers/actions";
import { OFFER_STATUS_LABELS } from "@/lib/applications/labels";
import { STATUS_LABELS } from "@/lib/applications/status";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { annualizeOffer } from "@/lib/offers/math";
import { usd, usdRate } from "./format";

export type ApplicationChoice = { id: string; companyName: string; positionTitle: string; status: ApplicationStatus };

const toNum = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function OfferForm({
  mode,
  offerId,
  application,
  candidates,
  initial,
  cancelHref,
  postedRange,
}: {
  mode: "create" | "edit";
  offerId?: string;
  /** Fixed application (from ?applicationId= or the offer being edited). */
  application: ApplicationChoice | null;
  /** Applications to choose from when none is fixed. */
  candidates: ApplicationChoice[];
  initial: OfferFormValues;
  cancelHref: string;
  /** The posting's pay range, shown as a hint (never assumed to be the offer). */
  postedRange?: string | null;
}) {
  const id = useId();
  const [values, setValues] = useState<OfferFormValues>(initial);
  // Controlled so a failed submit (React resets uncontrolled fields) never loses the choice.
  const [appId, setAppId] = useState("");
  const [state, action, pending] = useActionState(mode === "create" ? createOfferAction : updateOfferAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const set = (k: keyof OfferFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const base = toNum(values.baseAmount);
  const preview =
    base !== null && base > 0
      ? annualizeOffer({
          baseAmount: base,
          period: values.period,
          hoursPerWeek: toNum(values.hoursPerWeek) ?? 40,
          overtimeHours: toNum(values.overtimeHours) ?? 0,
          signingBonus: toNum(values.signingBonus),
          annualBonus: toNum(values.annualBonus),
          benefitsValue: toNum(values.benefitsValue),
        })
      : null;

  const text = (k: keyof OfferFormValues, label: string, opts: { hint?: string; placeholder?: string; type?: string; inputMode?: "decimal" | "numeric"; className?: string } = {}) => (
    <Field label={label} htmlFor={`${id}-${k}`} errors={fe?.[k]} hint={opts.hint} className={opts.className}>
      <Input
        id={`${id}-${k}`}
        name={k}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        value={values[k]}
        onChange={set(k)}
        placeholder={opts.placeholder}
        autoComplete="off"
      />
    </Field>
  );

  return (
    <form action={action} className="space-y-4" noValidate data-testid="offer-form">
      {mode === "edit" && offerId && <input type="hidden" name="offerId" value={offerId} />}
      {state && !state.ok && !state.fieldErrors && (
        <Alert tone="danger" title="Not saved">
          {state.error}
        </Alert>
      )}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Application</CardTitle>
            <CardDescription>Every offer belongs to one application in your tracker.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {application ? (
            <>
              <input type="hidden" name="applicationId" value={application.id} />
              <p className="text-sm">
                <strong className="font-medium">{application.companyName}</strong> – {application.positionTitle}{" "}
                <span className="text-fg-muted">({STATUS_LABELS[application.status]})</span>
              </p>
              {postedRange && <p className="mt-1 text-xs text-fg-muted">Posted pay on your application: {postedRange}. Enter what the offer actually says.</p>}
            </>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-fg-muted">
              You have no applications yet.{" "}
              <Link href="/applications/new" className="text-accent hover:underline">
                Log the application first
              </Link>
              , then record its offer.
            </p>
          ) : (
            <Field label="Application" htmlFor={`${id}-app`} errors={fe?.applicationId}>
              <Select id={`${id}-app`} name="applicationId" value={appId} onChange={(e) => setAppId(e.target.value)} required>
                <option value="" disabled>
                  Choose an application
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} – {c.positionTitle} ({STATUS_LABELS[c.status]})
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pay</CardTitle>
            <CardDescription>As written in the offer. Base pay is the only guaranteed part.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {text("baseAmount", values.period === "HOURLY" ? "Base hourly rate (USD)" : "Base annual salary (USD)", { inputMode: "decimal", placeholder: values.period === "HOURLY" ? "e.g. 34.00" : "e.g. 82000" })}
          <Field label="Pay period" htmlFor={`${id}-period`} errors={fe?.period}>
            <Select id={`${id}-period`} name="period" value={values.period} onChange={set("period")}>
              {Object.values(SalaryPeriod).map((p) => (
                <option key={p} value={p}>
                  {p === "HOURLY" ? "Hourly" : "Annual salary"}
                </option>
              ))}
            </Select>
          </Field>
          {text("hoursPerWeek", "Regular hours per week", { inputMode: "numeric" })}
          {text("overtimeHours", "Expected overtime hours per week", { inputMode: "numeric", hint: "What you were told to expect; not guaranteed" })}
          {text("signingBonus", "Signing bonus (one-time, USD)", { inputMode: "decimal", placeholder: "0" })}
          {text("annualBonus", "Annual bonus (USD)", { inputMode: "decimal", placeholder: "0" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Benefits</CardTitle>
            <CardDescription>Kept separate from pay. The dollar value is your own estimate of what the employer pays.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {text("benefitsValue", "Estimated benefits value per year (USD)", { inputMode: "decimal", placeholder: "0", className: "sm:col-span-2" })}
          {text("benefitHealth", "Health insurance", { placeholder: "e.g. medical + dental, employer pays 90%" })}
          {text("benefitRetirement", "Retirement / pension", { placeholder: "e.g. 401(k) 4% match, union pension" })}
          {text("benefitPto", "Paid time off", { placeholder: "e.g. 10 days + holidays" })}
          {text("benefitOther", "Other", { placeholder: "e.g. tool allowance, truck, training paid" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Dates and status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {text("startDate", "Start date", { type: "date" })}
          {text("decisionDue", "Decision due", { type: "date" })}
          <Field label="Offer status" htmlFor={`${id}-status`} errors={fe?.status}>
            <Select id={`${id}-status`} name="status" value={values.status} onChange={set("status")}>
              {Object.values(OfferStatus).map((s) => (
                <option key={s} value={s}>
                  {OFFER_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor={`${id}-notes`} errors={fe?.notes} className="sm:col-span-3">
            <Textarea id={`${id}-notes`} name="notes" value={values.notes} onChange={set("notes")} maxLength={5000} rows={4} />
          </Field>
        </CardContent>
      </Card>

      {preview && (
        <p className="text-sm text-fg-muted" aria-live="polite" data-testid="offer-preview">
          Annualized base {usd(preview.annualBase)} ({usdRate(preview.hourlyRate)}/h)
          {preview.overtimeExpected > 0 ? ` · expected overtime ${usd(preview.overtimeExpected)} (not guaranteed)` : ""} · total compensation{" "}
          {usd(preview.totalComp)} per year, before taxes.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses("ghost", "md")}>
          Cancel
        </Link>
        <Button type="submit" loading={pending} disabled={!application && candidates.length === 0}>
          {mode === "create" ? "Save offer" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
