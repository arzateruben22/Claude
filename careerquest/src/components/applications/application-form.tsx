"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ApplicationSource,
  ApplicationStatus,
  EmploymentType,
  SalaryPeriod,
} from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
  buttonClasses,
} from "@/components/ui";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_CATEGORY_SUGGESTIONS,
  SALARY_PERIOD_LABELS,
  SOURCE_LABELS,
} from "@/lib/applications/labels";
import {
  ALL_STATUSES,
  STATUS_LABELS,
  isSubmittedStatus,
} from "@/lib/applications/status";

export type ApplicationFormValues = {
  companyName: string;
  positionTitle: string;
  jobCategory: string;
  location: string;
  remote: boolean;
  employmentType: EmploymentType;
  postingUrl: string;
  source: ApplicationSource;
  submissionDestination: ApplicationSource | "";
  requisitionNumber: string;
  jobDescription: string;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: SalaryPeriod | "";
  status: ApplicationStatus;
  appliedAt: string;
  followUpAt: string;
  isQualified: boolean;
  requiresCompanyVehicle: boolean;
  requiresDrivingRecord: boolean;
  requiresCdl: boolean;
  recruiterName: string;
  recruiterEmail: string;
  notes: string;
  resumeVersionId: string;
  coverLetterVersionId: string;
};

export const EMPTY_APPLICATION_FORM: ApplicationFormValues = {
  companyName: "",
  positionTitle: "",
  jobCategory: "",
  location: "",
  remote: false,
  employmentType: "UNKNOWN",
  postingUrl: "",
  source: "OTHER",
  submissionDestination: "",
  requisitionNumber: "",
  jobDescription: "",
  salaryMin: "",
  salaryMax: "",
  salaryPeriod: "",
  status: "SAVED",
  appliedAt: "",
  followUpAt: "",
  isQualified: true,
  requiresCompanyVehicle: false,
  requiresDrivingRecord: false,
  requiresCdl: false,
  recruiterName: "",
  recruiterEmail: "",
  notes: "",
  resumeVersionId: "",
  coverLetterVersionId: "",
};

export type DocumentOptions = {
  resumes: { id: string; name: string }[];
  coverLetters: { id: string; name: string }[];
};

type FormAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;
type StringKey = {
  [K in keyof ApplicationFormValues]: ApplicationFormValues[K] extends string
    ? K
    : never;
}[keyof ApplicationFormValues];
type BoolKey = {
  [K in keyof ApplicationFormValues]: ApplicationFormValues[K] extends boolean
    ? K
    : never;
}[keyof ApplicationFormValues];
type ChangeEv = React.ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

const SOURCES = Object.keys(ApplicationSource) as ApplicationSource[];
const EMPLOYMENT_TYPES = Object.keys(EmploymentType) as EmploymentType[];
const PERIODS = Object.keys(SalaryPeriod) as SalaryPeriod[];

/**
 * Create/edit form for an application. Inputs are controlled so a server-side validation failure
 * never wipes what the user typed (React resets uncontrolled form fields after an action).
 */
export function ApplicationForm({
  mode,
  action,
  initialValues,
  applicationId,
  documents,
  cancelHref,
  today,
}: {
  mode: "create" | "edit";
  action: FormAction;
  initialValues?: Partial<ApplicationFormValues>;
  applicationId?: string;
  documents: DocumentOptions;
  cancelHref: string;
  /** Today's date key in the user's timezone, used as the max for date inputs. */
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [values, setValues] = useState<ApplicationFormValues>({
    ...EMPTY_APPLICATION_FORM,
    ...initialValues,
  });
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const bind = (key: StringKey) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (e: ChangeEv) =>
      setValues(
        (v) => ({ ...v, [key]: e.target.value }) as ApplicationFormValues,
      ),
  });
  const bindBool = (key: BoolKey) => ({
    name: key,
    checked: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues(
        (v) => ({ ...v, [key]: e.target.checked }) as ApplicationFormValues,
      ),
  });

  const submitted = isSubmittedStatus(values.status);
  const hasDocs =
    documents.resumes.length > 0 || documents.coverLetters.length > 0;

  return (
    <form action={formAction} noValidate className="space-y-5 animate-rise">
      {applicationId && (
        <input type="hidden" name="applicationId" value={applicationId} />
      )}
      {state && !state.ok && !state.fieldErrors && (
        <Alert tone="danger">{state.error}</Alert>
      )}
      {state && !state.ok && state.fieldErrors && (
        <Alert tone="warning" title="Some fields need attention">
          {state.error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Role</CardTitle>
            <CardDescription>
              Who you are applying to and for what.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" htmlFor="companyName" errors={fe?.companyName}>
            <Input
              {...bind("companyName")}
              required
              autoComplete="organization"
              placeholder="e.g. Rosendin Electric"
            />
          </Field>
          <Field
            label="Job title"
            htmlFor="positionTitle"
            errors={fe?.positionTitle}
          >
            <Input
              {...bind("positionTitle")}
              required
              placeholder="e.g. Apprentice Electrician"
            />
          </Field>
          <Field
            label="Job category"
            htmlFor="jobCategory"
            errors={fe?.jobCategory}
            hint="Free text; pick a suggestion or type your own."
          >
            <Input
              {...bind("jobCategory")}
              list="cq-job-categories"
              placeholder="e.g. Electrician"
            />
            <datalist id="cq-job-categories">
              {JOB_CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Location" htmlFor="location" errors={fe?.location}>
            <Input
              {...bind("location")}
              placeholder="e.g. Anaheim, CA"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Employment type"
            htmlFor="employmentType"
            errors={fe?.employmentType}
          >
            <Select {...bind("employmentType")}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label="Remote or hybrid role" {...bindBool("remote")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Posting</CardTitle>
            <CardDescription>
              Where the job was listed. The link is used to spot duplicates and
              detect the platform.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Posting URL"
            htmlFor="postingUrl"
            errors={fe?.postingUrl}
            className="sm:col-span-2"
          >
            <Input
              {...bind("postingUrl")}
              type="url"
              inputMode="url"
              placeholder="https://"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Found on"
            htmlFor="source"
            errors={fe?.source}
            hint="Leave as Other to detect it from the URL."
          >
            <Select {...bind("source")}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Submitted through"
            htmlFor="submissionDestination"
            errors={fe?.submissionDestination}
            hint="If you applied somewhere other than where you found it."
          >
            <Select {...bind("submissionDestination")}>
              <option value="">Same as above</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Requisition / job ID"
            htmlFor="requisitionNumber"
            errors={fe?.requisitionNumber}
            hint="Optional; detected from the URL when possible."
          >
            <Input {...bind("requisitionNumber")} autoComplete="off" />
          </Field>
          <Field
            label="Job description"
            htmlFor="jobDescription"
            errors={fe?.jobDescription}
            className="sm:col-span-2"
            hint="Paste the posting so you can refer back to it after it is taken down."
          >
            <Textarea {...bind("jobDescription")} rows={5} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Compensation</CardTitle>
            <CardDescription>
              What the posting says, if anything. Leave blank when it is not
              listed.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Pay from" htmlFor="salaryMin" errors={fe?.salaryMin}>
            <Input
              {...bind("salaryMin")}
              inputMode="decimal"
              placeholder="e.g. 28"
            />
          </Field>
          <Field label="Pay to" htmlFor="salaryMax" errors={fe?.salaryMax}>
            <Input
              {...bind("salaryMax")}
              inputMode="decimal"
              placeholder="e.g. 36"
            />
          </Field>
          <Field
            label="Pay period"
            htmlFor="salaryPeriod"
            errors={fe?.salaryPeriod}
          >
            <Select {...bind("salaryPeriod")}>
              <option value="">Not listed</option>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {SALARY_PERIOD_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {mode === "create" ? "Status & dates" : "Dates"}
            </CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Where this application stands right now."
                : "Change the stage from the application page so the history stays accurate."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {mode === "create" && (
            <Field
              label="Status"
              htmlFor="status"
              errors={fe?.status}
              hint={
                submitted
                  ? "Counts as a submitted application."
                  : "Not yet submitted."
              }
            >
              <Select {...bind("status")}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label="Applied on"
            htmlFor="appliedAt"
            errors={fe?.appliedAt}
            hint={
              mode === "create" && submitted ? "Blank uses today." : undefined
            }
          >
            <Input {...bind("appliedAt")} type="date" max={today} />
          </Field>
          <Field
            label="Next follow-up"
            htmlFor="followUpAt"
            errors={fe?.followUpAt}
          >
            <Input {...bind("followUpAt")} type="date" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Eligibility</CardTitle>
            <CardDescription>
              Private to your account and stored as yes/no only, with no license
              or record details. Used to filter your own list and to keep your
              stats honest.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="I meet the posted requirements"
            {...bindBool("isQualified")}
          />
          <Checkbox
            label="Requires driving a company vehicle"
            {...bindBool("requiresCompanyVehicle")}
          />
          <Checkbox
            label="Requires a clean driving record"
            {...bindBool("requiresDrivingRecord")}
          />
          <Checkbox label="Requires a CDL" {...bindBool("requiresCdl")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recruiter</CardTitle>
            <CardDescription>
              Your contact at the company, if you have one.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Recruiter name"
            htmlFor="recruiterName"
            errors={fe?.recruiterName}
          >
            <Input {...bind("recruiterName")} autoComplete="off" />
          </Field>
          <Field
            label="Recruiter email"
            htmlFor="recruiterEmail"
            errors={fe?.recruiterEmail}
          >
            <Input
              {...bind("recruiterEmail")}
              type="email"
              inputMode="email"
              autoComplete="off"
            />
          </Field>
        </CardContent>
      </Card>

      {hasDocs && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Which versions you sent with this application.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {documents.resumes.length > 0 && (
              <Field
                label="Resume version"
                htmlFor="resumeVersionId"
                errors={fe?.resumeVersionId}
              >
                <Select {...bind("resumeVersionId")}>
                  <option value="">Not recorded</option>
                  {documents.resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {documents.coverLetters.length > 0 && (
              <Field
                label="Cover letter"
                htmlFor="coverLetterVersionId"
                errors={fe?.coverLetterVersionId}
              >
                <Select {...bind("coverLetterVersionId")}>
                  <option value="">Not recorded</option>
                  {documents.coverLetters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Anything worth remembering: who you spoke to, what they asked for,
              your gut feeling.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Field label="Notes" htmlFor="notes" errors={fe?.notes}>
            <Textarea {...bind("notes")} rows={4} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
        <Link href={cancelHref} className={buttonClasses("ghost", "md")}>
          Cancel
        </Link>
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Save application" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
