"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { audit } from "@/lib/audit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { checked, list, numberOrNull, text, trimmed } from "./form-data";
import {
  appearanceSchema,
  campaignTargetsSchema,
  eligibilitySchema,
  onboardingSchema,
  profileGoalsSchema,
} from "./schema";
import * as svc from "./service";

export type SettingsData = { message: string };
export type SettingsResult = ActionResult<SettingsData>;

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/settings/campaign");
  revalidatePath("/settings/eligibility");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/goals");
}

function unexpected(scope: string, err: unknown): SettingsResult {
  console.error(`${scope} failed`, err);
  return fail("Something went wrong saving that. Please try again.");
}

function readPathway(formData: FormData) {
  return {
    primaryTrade: text(formData, "primaryTrade"),
    careerInterests: list(formData, "careerInterests"),
    openToApprenticeships: checked(formData, "openToApprenticeships"),
    apprenticeshipMinHourly: numberOrNull(formData, "apprenticeshipMinHourly"),
  };
}

function readTargets(formData: FormData) {
  return {
    campaignLengthDays: trimmed(formData, "campaignLengthDays"),
    dailyApplicationTarget: trimmed(formData, "dailyApplicationTarget"),
    workdaysPerWeek: trimmed(formData, "workdaysPerWeek"),
    weeklyApplicationTarget: trimmed(formData, "weeklyApplicationTarget"),
  };
}

function readEligibility(formData: FormData) {
  return {
    excludeCompanyVehicleJobs: checked(formData, "excludeCompanyVehicleJobs"),
    excludeDrivingRecordJobs: checked(formData, "excludeDrivingRecordJobs"),
    excludeCdlJobs: checked(formData, "excludeCdlJobs"),
  };
}

// ---------------------------------------------------------------------------

export async function updateProfileAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/settings");
  const parsed = profileGoalsSchema.safeParse({
    name: text(formData, "name"),
    regions: list(formData, "regions"),
    timezone: trimmed(formData, "timezone"),
    immediateSalaryTarget: trimmed(formData, "immediateSalaryTarget"),
    longTermSalaryTarget: trimmed(formData, "longTermSalaryTarget"),
    ...readPathway(formData),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await svc.updateProfile(user.id, parsed.data);
  } catch (err) {
    return unexpected("updateProfile", err);
  }
  await audit("profile.update", {
    userId: user.id,
    entityType: "UserProfile",
    entityId: user.id,
    metadata: { section: "profile", primaryTrade: parsed.data.primaryTrade, regions: parsed.data.regions },
  });
  revalidateSettings();
  revalidatePath("/", "layout"); // the top bar shows the user's name
  return ok({ message: "Profile saved." });
}

export async function updateCampaignTargetsAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/settings/campaign");
  const parsed = campaignTargetsSchema.safeParse(readTargets(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await svc.updateCampaignTargets(user.id, parsed.data);
  } catch (err) {
    return unexpected("updateCampaignTargets", err);
  }
  await audit("profile.campaign_targets_updated", { userId: user.id, entityType: "UserProfile", entityId: user.id, metadata: parsed.data });
  revalidateSettings();
  return ok({ message: "Campaign targets saved." });
}

export async function restartCampaignAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/settings/campaign");
  if (text(formData, "confirm") !== "RESTART") return fail("Confirm the restart before continuing.");
  let startedAt: Date;
  try {
    const c = await svc.restartCampaign(user.id);
    startedAt = c.startedAt;
  } catch (err) {
    return unexpected("restartCampaign", err);
  }
  await audit("campaign.restart", {
    userId: user.id,
    entityType: "CampaignState",
    entityId: "GET_HIRED",
    metadata: { startedAt: startedAt.toISOString() },
  });
  revalidateSettings();
  revalidatePath("/missions");
  revalidatePath("/analytics");
  return ok({ message: "Campaign restarted from today. Your applications and XP are untouched." });
}

export async function updateEligibilityAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/settings/eligibility");
  const parsed = eligibilitySchema.safeParse(readEligibility(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await svc.updateProfile(user.id, parsed.data);
  } catch (err) {
    return unexpected("updateEligibility", err);
  }
  // Only the on/off state is logged; CareerQuest stores no license or record details.
  await audit("profile.eligibility_updated", { userId: user.id, entityType: "UserProfile", entityId: user.id, metadata: parsed.data });
  revalidateSettings();
  revalidatePath("/discovery");
  revalidatePath("/applications");
  return ok({ message: "Eligibility filters saved." });
}

export async function updateAppearanceAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/settings/appearance");
  const parsed = appearanceSchema.safeParse({
    theme: text(formData, "theme"),
    reducedMotion: checked(formData, "reducedMotion"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await svc.setTheme(user.id, parsed.data.theme);
    await svc.setReducedMotion(user.id, parsed.data.reducedMotion);
  } catch (err) {
    return unexpected("updateAppearance", err);
  }
  await audit("profile.appearance_updated", { userId: user.id, entityType: "UserProfile", entityId: user.id, metadata: parsed.data });
  // The <html data-theme> attribute lives in the root layout.
  revalidatePath("/", "layout");
  return ok({ message: `Theme set to ${parsed.data.theme.charAt(0) + parsed.data.theme.slice(1).toLowerCase()}.` });
}

/** Final step of the onboarding wizard: save everything, award the one-time XP, go to the dashboard. */
export async function completeOnboardingAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  const user = await requireUser("/settings/onboarding");
  const parsed = onboardingSchema.safeParse({
    campaignLengthDays: trimmed(formData, "campaignLengthDays"),
    immediateSalaryTarget: trimmed(formData, "immediateSalaryTarget"),
    longTermSalaryTarget: trimmed(formData, "longTermSalaryTarget"),
    ...readPathway(formData),
    dailyApplicationTarget: trimmed(formData, "dailyApplicationTarget"),
    workdaysPerWeek: trimmed(formData, "workdaysPerWeek"),
    weeklyApplicationTarget: trimmed(formData, "weeklyApplicationTarget"),
    ...readEligibility(formData),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  let xpAwarded = 0;
  try {
    await svc.updateProfile(user.id, parsed.data);
    const done = await svc.completeOnboarding(user.id);
    xpAwarded = done.xpAwarded;
  } catch (err) {
    return unexpected("completeOnboarding", err);
  }
  await audit("profile.onboarding_completed", {
    userId: user.id,
    entityType: "UserProfile",
    entityId: user.id,
    metadata: { xpAwarded, primaryTrade: parsed.data.primaryTrade, campaignLengthDays: parsed.data.campaignLengthDays },
  });
  revalidateSettings();
  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=1");
}
