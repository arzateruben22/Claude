"use server";
/**
 * Server actions for Job Discovery and mobile capture. Every action authenticates with
 * requireUser(), validates with zod and touches only the signed-in user's rows (the services scope
 * every query by userId).
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { createTargetCompany, deleteTargetCompany, updateTargetCompany } from "./companies";
import { formString, leadFormValues } from "./form";
import { convertLead, createLead, deleteLead, setLeadStatus, updateLead, type CandidateChoice } from "./leads";
import {
  convertLeadSchema,
  leadIdSchema,
  leadInputSchema,
  leadStatusSchema,
  parseChoice,
  shareDecisionSchema,
  targetCompanyIdSchema,
  targetCompanySchema,
} from "./schemas";
import { shareDecision } from "./share";

export type DiscoveryActionData = {
  message: string;
  /** success: done; info: nothing new was stored (already a lead / already tracked) or a choice is needed. */
  tone: "success" | "info";
  href?: string;
  hrefLabel?: string;
  candidates?: CandidateChoice[];
  /** The decision the candidates answer ("saved" / "applied" / "track" …), for the choice buttons. */
  mode?: string;
};

export type DiscoveryActionResult = ActionResult<DiscoveryActionData>;

function refreshDiscovery(alsoTracker = false) {
  revalidatePath("/discovery", "layout");
  if (alsoTracker) {
    revalidatePath("/applications");
    revalidatePath("/dashboard");
  }
}

export async function createLeadAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery");
  const { values, pasted, flagsReviewed } = leadFormValues(formData);
  const parsed = leadInputSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await createLead(user.id, parsed.data, { postingText: pasted, flagsReviewed });
  refreshDiscovery();
  if (res.ok) return ok({ message: res.message, tone: "success" });
  if (res.reason === "tracked") return ok({ message: res.message, tone: "info", href: `/applications/${res.applicationId}`, hrefLabel: "Open the application" });
  if (res.reason === "duplicate_lead") return ok({ message: res.message, tone: "info" });
  return fail(res.message);
}

export async function updateLeadAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery");
  const id = leadIdSchema.safeParse({ leadId: formString(formData, "leadId") });
  if (!id.success) return fail("Unknown lead.");
  const { values } = leadFormValues(formData);
  const parsed = leadInputSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await updateLead(user.id, id.data.leadId, parsed.data, { flagsReviewed: true });
  refreshDiscovery();
  return res.ok ? ok({ message: res.message, tone: "success" }) : fail(res.message);
}

export async function leadStatusAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery");
  const parsed = leadStatusSchema.safeParse({ leadId: formString(formData, "leadId"), status: formString(formData, "status") });
  if (!parsed.success) return fail("Choose a valid action.");
  const res = await setLeadStatus(user.id, parsed.data.leadId, parsed.data.status);
  refreshDiscovery();
  return res.ok ? ok({ message: res.message, tone: "success" }) : fail(res.message);
}

export async function deleteLeadAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery");
  const parsed = leadIdSchema.safeParse({ leadId: formString(formData, "leadId") });
  if (!parsed.success) return fail("Unknown lead.");
  const res = await deleteLead(user.id, parsed.data.leadId);
  refreshDiscovery();
  return res.ok ? ok({ message: res.message, tone: "success" }) : fail(res.message);
}

export async function convertLeadAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery");
  const choice = parseChoice(formString(formData, "choice"), ["saved", "applied"] as const);
  const parsed = convertLeadSchema.safeParse({
    leadId: formString(formData, "leadId"),
    mode: choice?.mode ?? formString(formData, "mode"),
    attachTo: choice ? choice.attachTo : formString(formData, "attachTo"),
    force: choice ? (choice.force ? "1" : "") : formString(formData, "force"),
  });
  if (!parsed.success) return fail("Choose a valid action.");
  const res = await convertLead(user.id, parsed.data.leadId, { mode: parsed.data.mode, attachTo: parsed.data.attachTo, force: parsed.data.force });
  refreshDiscovery(true);
  if (res.ok) return ok({ message: res.message, tone: "success", href: `/applications/${res.applicationId}`, hrefLabel: "Open the application" });
  if (res.reason === "choose") return ok({ message: res.message, tone: "info", candidates: res.candidates, mode: parsed.data.mode });
  return fail(res.message);
}

export async function createTargetCompanyAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery/companies");
  const parsed = targetCompanySchema.safeParse({
    name: formString(formData, "name"),
    website: formString(formData, "website"),
    careersUrl: formString(formData, "careersUrl"),
    category: formString(formData, "category"),
    priority: formString(formData, "priority"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await createTargetCompany(user.id, parsed.data);
  refreshDiscovery();
  if (res.ok) {
    revalidatePath("/", "layout");
    return ok({ message: res.message, tone: "success" });
  }
  return res.reason === "duplicate" ? ok({ message: res.message, tone: "info" }) : fail(res.message);
}

export async function updateTargetCompanyAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery/companies");
  const id = targetCompanyIdSchema.safeParse({ companyId: formString(formData, "companyId") });
  if (!id.success) return fail("Unknown company.");
  const parsed = targetCompanySchema.safeParse({
    name: formString(formData, "name"),
    website: formString(formData, "website"),
    careersUrl: formString(formData, "careersUrl"),
    category: formString(formData, "category"),
    priority: formString(formData, "priority"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await updateTargetCompany(user.id, id.data.companyId, parsed.data);
  refreshDiscovery();
  return res.ok ? ok({ message: res.message, tone: "success" }) : fail(res.message);
}

export async function deleteTargetCompanyAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/discovery/companies");
  const id = targetCompanyIdSchema.safeParse({ companyId: formString(formData, "companyId") });
  if (!id.success) return fail("Unknown company.");
  const res = await deleteTargetCompany(user.id, id.data.companyId);
  refreshDiscovery();
  if (res.xpRevoked) revalidatePath("/", "layout");
  return res.ok ? ok({ message: res.message, tone: "success" }) : fail(res.message);
}

export async function shareDecisionAction(_prev: DiscoveryActionResult | null, formData: FormData): Promise<DiscoveryActionResult> {
  const user = await requireUser("/share");
  const choice = parseChoice(formString(formData, "choice"), ["lead", "track", "applied"] as const);
  const parsed = shareDecisionSchema.safeParse({
    decision: choice?.mode ?? formString(formData, "decision"),
    url: formString(formData, "url"),
    title: formString(formData, "title"),
    company: formString(formData, "company"),
    location: formString(formData, "location"),
    salaryText: formString(formData, "salaryText"),
    sharedText: formString(formData, "sharedText"),
    attachTo: choice ? choice.attachTo : formString(formData, "attachTo"),
    force: choice ? (choice.force ? "1" : "") : formString(formData, "force"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await shareDecision(user.id, parsed.data);
  if (res.ok) {
    refreshDiscovery(parsed.data.decision !== "lead");
    if (parsed.data.decision !== "lead") revalidatePath("/", "layout");
    return ok({
      message: res.message,
      tone: "success",
      href: res.href,
      hrefLabel: parsed.data.decision === "lead" ? "Open Job Discovery" : "Open the application",
    });
  }
  if (res.reason === "fields") return fail(res.message, res.fieldErrors);
  if (res.reason === "choose") return ok({ message: res.message, tone: "info", candidates: res.candidates, mode: parsed.data.decision });
  if (res.reason === "duplicate") return ok({ message: res.message, tone: "info", href: res.href, hrefLabel: "Open it" });
  return fail(res.message);
}
