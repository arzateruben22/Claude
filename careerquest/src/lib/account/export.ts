import "server-only";
import { prisma } from "@/lib/db";

/**
 * Full data export for one user. Every user-owned table is included; credential material never is.
 * The builder is a plain function so it can be unit-tested without HTTP.
 */

export const EXPORT_FORMAT = "careerquest.account-export.v1";

/** Keys removed from the export wherever they appear (defence in depth on top of explicit selects). */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "passwordHash",
  "accessTokenEnc",
  "refreshTokenEnc",
  "tokenHash",
  "syncCursor",
  "storagePath",
  "keys", // PushSubscription.keys (browser push credentials)
]);

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Recursively drop sensitive keys from already-plain JSON. Pure. */
export function stripSensitiveKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stripSensitiveKeys);
  if (value && typeof value === "object") {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = stripSensitiveKeys(v);
    }
    return out;
  }
  return value;
}

/** Dates → ISO strings, Decimals → strings (their toJSON), then the sensitive-key sweep. */
function toPlainJson(raw: unknown): JsonValue {
  return stripSensitiveKeys(JSON.parse(JSON.stringify(raw)) as JsonValue);
}

export async function buildAccountExport(userId: string): Promise<JsonObject> {
  const where = { userId } as const;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true, createdAt: true, updatedAt: true },
  });
  if (!user) throw new Error("User not found");

  const [
    profile,
    stats,
    applications,
    employers,
    contacts,
    resumeVersions,
    coverLetters,
    duplicates,
    evidence,
    jobLeads,
    targetCompanies,
    integrations,
    emailMessages,
    importBatches,
    captures,
    xpLedger,
    achievements,
    missions,
    skills,
    careerNodes,
    dailyActivity,
    campaigns,
    lessonProgress,
    quizAttempts,
    programInterests,
    workHours,
    documents,
    certifications,
    weeklyReports,
    coachMessages,
    salaryScenarios,
    notifications,
    pushSubscriptions,
    auditLogs,
    apiTokens,
    sessions,
  ] = await Promise.all([
    prisma.userProfile.findUnique({ where }),
    prisma.playerStats.findUnique({ where }),
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        statusHistory: { orderBy: { occurredAt: "asc" } },
        events: { orderBy: { occurredAt: "asc" } },
        interviews: { orderBy: { scheduledAt: "asc" } },
        offers: { orderBy: { createdAt: "asc" } },
        sourceLinks: true,
      },
    }),
    prisma.employer.findMany({ where, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where, orderBy: { name: "asc" } }),
    prisma.resumeVersion.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.coverLetterVersion.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.duplicateCandidate.findMany({ where }),
    prisma.evidence.findMany({ where, orderBy: { capturedAt: "asc" } }),
    prisma.jobLead.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.targetCompany.findMany({ where, orderBy: { name: "asc" } }),
    prisma.integrationConnection.findMany({
      where,
      omit: { accessTokenEnc: true, refreshTokenEnc: true, syncCursor: true },
      include: { syncRuns: { orderBy: { startedAt: "asc" } } },
    }),
    // Email metadata only: bodies are the user's mailbox content, which they already own elsewhere.
    prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      select: {
        id: true,
        provider: true,
        externalId: true,
        threadId: true,
        fromAddress: true,
        fromName: true,
        toAddress: true,
        subject: true,
        receivedAt: true,
        snippet: true,
        classification: true,
        confidence: true,
        extracted: true,
        reviewStatus: true,
        applicationId: true,
        connectionId: true,
        importBatchId: true,
        createdAt: true,
      },
    }),
    prisma.importBatch.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.extensionCapture.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.xpLedger.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.userAchievement.findMany({ where, orderBy: { unlockedAt: "asc" } }),
    prisma.mission.findMany({ where, orderBy: { periodStart: "asc" } }),
    prisma.userSkill.findMany({ where }),
    prisma.userCareerNode.findMany({ where }),
    prisma.dailyActivity.findMany({ where, orderBy: { date: "asc" } }),
    prisma.campaignState.findMany({ where }),
    prisma.lessonProgress.findMany({ where }),
    prisma.quizAttempt.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.userProgramInterest.findMany({ where, include: { program: { select: { slug: true, name: true, sponsor: true } } } }),
    prisma.workHourEntry.findMany({ where, orderBy: { dateWorked: "asc" } }),
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true },
    }),
    prisma.certificationStatus.findMany({ where }),
    prisma.weeklyReport.findMany({ where, orderBy: { weekStart: "asc" } }),
    prisma.coachMessage.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.salaryScenario.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.pushSubscription.findMany({ where, select: { id: true, endpoint: true, userAgent: true, createdAt: true } }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.apiToken.findMany({ where, omit: { tokenHash: true } }),
    prisma.session.findMany({ where, select: { createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true } }),
  ]);

  const payload = {
    format: EXPORT_FORMAT,
    exportedAt: new Date(),
    notice:
      "Private data export. Credential material (password hash, OAuth tokens, API token hashes, push keys) is never included. Statuses marked verified=false were inferred and never confirmed by you.",
    user,
    profile,
    stats,
    applications,
    employers,
    contacts,
    resumeVersions,
    coverLetters,
    duplicateCandidates: duplicates,
    evidence,
    jobLeads,
    targetCompanies,
    integrations,
    emailMessages,
    importBatches,
    extensionCaptures: captures,
    xpLedger,
    achievements,
    missions,
    skills,
    careerNodes,
    dailyActivity,
    campaigns,
    lessonProgress,
    quizAttempts,
    programInterests,
    workHours,
    documents,
    certifications,
    weeklyReports,
    coachMessages,
    salaryScenarios,
    notifications,
    pushSubscriptions,
    auditLogs,
    apiTokens,
    sessions,
    counts: {
      applications: applications.length,
      employers: employers.length,
      contacts: contacts.length,
      xpLedger: xpLedger.length,
      emailMessages: emailMessages.length,
    },
  };
  return toPlainJson(payload) as JsonObject;
}

export function exportFileName(now = new Date()): string {
  return `careerquest-export-${now.toISOString().slice(0, 10)}.json`;
}
