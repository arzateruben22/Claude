import "server-only";
/** The profile fields Job Discovery reads (scoring, filters, search links). Read-only. */
import { prisma } from "@/lib/db";
import { DEFAULT_REGIONS, SALARY_DEFAULTS } from "@/lib/profile/constants";
import { safeTimezone } from "@/lib/game/facts";
import type { ScoreProfile } from "./score";

export type DiscoveryProfile = ScoreProfile & { timezone: string; openToApprenticeships: boolean };

export async function loadDiscoveryProfile(userId: string): Promise<DiscoveryProfile> {
  const p = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      primaryTrade: true,
      careerInterests: true,
      regions: true,
      immediateSalaryTarget: true,
      openToApprenticeships: true,
      apprenticeshipMinHourly: true,
      excludeCompanyVehicleJobs: true,
      excludeDrivingRecordJobs: true,
      excludeCdlJobs: true,
      timezone: true,
    },
  });
  return {
    primaryTrade: p?.primaryTrade ?? "ELECTRICIAN",
    careerInterests: p?.careerInterests ?? [],
    regions: p?.regions?.length ? p.regions : [...DEFAULT_REGIONS],
    immediateSalaryTarget: p?.immediateSalaryTarget ?? SALARY_DEFAULTS.immediate,
    openToApprenticeships: p?.openToApprenticeships ?? true,
    apprenticeshipMinHourly: p?.apprenticeshipMinHourly == null ? null : Number(p.apprenticeshipMinHourly),
    excludeCompanyVehicleJobs: p?.excludeCompanyVehicleJobs ?? false,
    excludeDrivingRecordJobs: p?.excludeDrivingRecordJobs ?? false,
    excludeCdlJobs: p?.excludeCdlJobs ?? false,
    timezone: safeTimezone(p?.timezone),
  };
}
