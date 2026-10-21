-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UiTheme" AS ENUM ('CLASSIC', 'CYBER', 'ULTRA');

-- CreateEnum
CREATE TYPE "PrimaryTrade" AS ENUM ('ELECTRICIAN', 'ELEVATOR_MECHANIC', 'COMMERCIAL_HVAC', 'INDUSTRIAL_MAINTENANCE', 'BUILDING_ENGINEER', 'CONSTRUCTION_PROJECT_COORDINATOR', 'CONSTRUCTION_ESTIMATOR', 'ASSISTANT_PROJECT_MANAGER', 'COMMERCIAL_PLUMBING_PIPEFITTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'PREPARING', 'SUBMITTED', 'CONFIRMED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED', 'HIRED', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('INDEED', 'GLASSDOOR', 'LINKEDIN', 'ZIPRECRUITER', 'WORKDAY', 'GREENHOUSE', 'LEVER', 'SMARTRECRUITERS', 'ICIMS', 'ADP', 'GOVERNMENTJOBS', 'USAJOBS', 'COMPANY_SITE', 'UNION_PORTAL', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'APPRENTICESHIP', 'INTERNSHIP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "RecordOrigin" AS ENUM ('MANUAL', 'EMAIL', 'EXTENSION', 'CSV_IMPORT', 'URL_IMPORT', 'PLATFORM_API', 'MOBILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('USER', 'EMAIL', 'EXTENSION', 'IMPORT', 'PLATFORM_API', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApplicationEventType" AS ENUM ('SAVED', 'APPLIED', 'CONFIRMATION_RECEIVED', 'RECRUITER_RESPONSE', 'SCREENING_SCHEDULED', 'ASSESSMENT_INVITED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_RECEIVED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'REJECTED', 'WITHDRAWN', 'FOLLOW_UP_SENT', 'NOTE_ADDED', 'STATUS_CHANGED', 'MERGED', 'ONBOARDING_RECEIVED');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('PHONE_SCREEN', 'VIDEO', 'ONSITE', 'PANEL', 'TECHNICAL', 'APPRENTICESHIP_INTERVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PENDING', 'ADVANCED', 'REJECTED', 'OFFER', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('RECEIVED', 'NEGOTIATING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'RESCINDED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('EMAIL', 'EXTENSION_CAPTURE', 'SCREENSHOT', 'CSV_ROW', 'URL', 'MANUAL_NOTE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('PENDING', 'MERGED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'SAVED', 'DISMISSED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'CHROME_EXTENSION', 'INDEED', 'GLASSDOOR', 'LINKEDIN', 'ZIPRECRUITER', 'WORKDAY', 'GREENHOUSE', 'LEVER', 'SMARTRECRUITERS', 'ICIMS', 'ADP', 'GOVERNMENTJOBS', 'USAJOBS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'NEEDS_REAUTH', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "EmailClassification" AS ENUM ('APPLICATION_SUBMITTED', 'EMPLOYER_ACKNOWLEDGMENT', 'RECRUITER_MESSAGE', 'INTERVIEW_INVITATION', 'ASSESSMENT_INVITATION', 'REJECTION', 'OFFER', 'ONBOARDING', 'JOB_ALERT', 'INCOMPLETE_APPLICATION', 'APPLICATION_INVITATION', 'UNRELATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('AUTO_ACCEPTED', 'NEEDS_REVIEW', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('CSV', 'EML', 'MBOX', 'GMAIL_HISTORY', 'OUTLOOK_HISTORY', 'URL_LIST', 'PLATFORM_EXPORT');

-- CreateEnum
CREATE TYPE "CaptureKind" AS ENUM ('JOB_PAGE', 'APPLY_STARTED', 'CONFIRMATION_PAGE', 'MANUAL_CONFIRMATION', 'SHARED_URL');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('PENDING_CONFIRMATION', 'ACCEPTED', 'DISMISSED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('DAILY', 'WEEKLY', 'CAMPAIGN', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "Campaign" AS ENUM ('GET_HIRED', 'ELECTRICIAN_150K');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SKIPPED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecruitmentStatus" AS ENUM ('OPEN', 'CLOSED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ProgramInterestStatus" AS ENUM ('INTERESTED', 'APPLIED', 'TESTING', 'INTERVIEWING', 'WAITLISTED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'FIRE_LIFE_SAFETY', 'VOICE_DATA_VIDEO', 'LIGHTING', 'SOLAR_PV', 'MAINTENANCE', 'CLASSROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "HourVerification" AS ENUM ('SELF_REPORTED', 'EMPLOYER_VERIFIED', 'OFFICIAL_RECORD');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('RESUME', 'CERTIFICATE', 'PAY_STUB', 'HOURS_VERIFICATION', 'TRAINEE_CARD', 'OFFER_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "CoachRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['capture:write', 'applications:read']::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "regions" TEXT[] DEFAULT ARRAY['Los Angeles County, CA', 'Orange County, CA']::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "immediateSalaryTarget" INTEGER NOT NULL DEFAULT 80000,
    "longTermSalaryTarget" INTEGER NOT NULL DEFAULT 150000,
    "openToApprenticeships" BOOLEAN NOT NULL DEFAULT true,
    "apprenticeshipMinHourly" DECIMAL(8,2),
    "primaryTrade" "PrimaryTrade" NOT NULL DEFAULT 'ELECTRICIAN',
    "careerInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campaignLengthDays" INTEGER NOT NULL DEFAULT 90,
    "dailyApplicationTarget" INTEGER NOT NULL DEFAULT 5,
    "workdaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "weeklyApplicationTarget" INTEGER NOT NULL DEFAULT 25,
    "excludeCompanyVehicleJobs" BOOLEAN NOT NULL DEFAULT false,
    "excludeDrivingRecordJobs" BOOLEAN NOT NULL DEFAULT false,
    "excludeCdlJobs" BOOLEAN NOT NULL DEFAULT false,
    "theme" "UiTheme" NOT NULL DEFAULT 'CYBER',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "notificationPrefs" JSONB NOT NULL DEFAULT '{}',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Employer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employerId" TEXT,
    "companyName" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "jobCategory" TEXT,
    "jobDescription" TEXT,
    "postingUrl" TEXT,
    "normalizedUrl" TEXT,
    "requisitionNumber" TEXT,
    "source" "ApplicationSource" NOT NULL DEFAULT 'OTHER',
    "submissionDestination" "ApplicationSource",
    "location" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "salaryMin" DECIMAL(12,2),
    "salaryMax" DECIMAL(12,2),
    "salaryPeriod" "SalaryPeriod",
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'UNKNOWN',
    "appliedAt" TIMESTAMP(3),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusVerified" BOOLEAN NOT NULL DEFAULT false,
    "isQualified" BOOLEAN NOT NULL DEFAULT true,
    "requiresCompanyVehicle" BOOLEAN NOT NULL DEFAULT false,
    "requiresDrivingRecord" BOOLEAN NOT NULL DEFAULT false,
    "requiresCdl" BOOLEAN NOT NULL DEFAULT false,
    "resumeVersionId" TEXT,
    "coverLetterVersionId" TEXT,
    "recruiterContactId" TEXT,
    "followUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "detectionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdVia" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "lastSyncedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "EventSource" NOT NULL DEFAULT 'USER',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "ApplicationEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "EventSource" NOT NULL DEFAULT 'USER',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL DEFAULT 'PHONE_SCREEN',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "interviewer" TEXT,
    "location" TEXT,
    "outcome" "InterviewOutcome" NOT NULL DEFAULT 'PENDING',
    "prepCompletedAt" TIMESTAMP(3),
    "attendedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "period" "SalaryPeriod" NOT NULL DEFAULT 'ANNUAL',
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 40,
    "overtimeHours" INTEGER NOT NULL DEFAULT 0,
    "signingBonus" DECIMAL(12,2),
    "annualBonus" DECIMAL(12,2),
    "benefitsValue" DECIMAL(12,2),
    "benefits" JSONB NOT NULL DEFAULT '{}',
    "startDate" TIMESTAMP(3),
    "decisionDue" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL DEFAULT '{}',
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSourceLink" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "platform" "ApplicationSource" NOT NULL,
    "url" TEXT,
    "externalId" TEXT,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationSourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationAId" TEXT NOT NULL,
    "applicationBId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL DEFAULT '{}',
    "status" "DuplicateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "title" TEXT,
    "linkedinUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverLetterVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverLetterVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT,
    "normalizedUrl" TEXT,
    "source" "ApplicationSource" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "salaryText" TEXT,
    "category" TEXT,
    "requiresCompanyVehicle" BOOLEAN NOT NULL DEFAULT false,
    "requiresDrivingRecord" BOOLEAN NOT NULL DEFAULT false,
    "requiresCdl" BOOLEAN NOT NULL DEFAULT false,
    "matchScore" INTEGER,
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "convertedApplicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "careersUrl" TEXT,
    "category" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "accountEmail" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "itemsScanned" INTEGER NOT NULL DEFAULT 0,
    "itemsMatched" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "threadId" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT,
    "toAddress" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3),
    "snippet" TEXT,
    "bodyText" TEXT,
    "classification" "EmailClassification" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extracted" JSONB NOT NULL DEFAULT '{}',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "applicationId" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "fileName" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "totals" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtensionCapture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "applicationId" TEXT,
    "kind" "CaptureKind" NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT,
    "platform" "ApplicationSource" NOT NULL DEFAULT 'OTHER',
    "company" TEXT,
    "title" TEXT,
    "location" TEXT,
    "salaryText" TEXT,
    "requisitionId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" "CaptureStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ExtensionCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "track" TEXT NOT NULL DEFAULT 'CAREER',
    "dedupeKey" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "jobHunterXp" INTEGER NOT NULL DEFAULT 0,
    "electricianXp" INTEGER NOT NULL DEFAULT 0,
    "interviewSkill" INTEGER NOT NULL DEFAULT 0,
    "technicalKnowledge" INTEGER NOT NULL DEFAULT 0,
    "resumeStrength" INTEGER NOT NULL DEFAULT 0,
    "networking" INTEGER NOT NULL DEFAULT 0,
    "trainingProgress" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,
    "missionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "currentSalary" DECIMAL(12,2),
    "careerEarnings" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MissionType" NOT NULL,
    "campaign" "Campaign" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "status" "MissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "userId" TEXT NOT NULL,
    "skillKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId","skillKey")
);

-- CreateTable
CREATE TABLE "UserCareerNode" (
    "userId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'LOCKED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCareerNode_pkey" PRIMARY KEY ("userId","nodeKey")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "applicationsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "followUps" INTEGER NOT NULL DEFAULT 0,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "missionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "trainingHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "restDay" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("userId","date")
);

-- CreateTable
CREATE TABLE "CampaignState" (
    "userId" TEXT NOT NULL,
    "campaign" "Campaign" NOT NULL,
    "startedAt" DATE NOT NULL,
    "targetEndAt" DATE,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignState_pkey" PRIMARY KEY ("userId","campaign")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "userId" TEXT NOT NULL,
    "lessonKey" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bestScore" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("userId","lessonKey")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizKey" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprenticeshipProgram" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sponsor" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isUnion" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "applyUrl" TEXT,
    "eligibility" JSONB NOT NULL DEFAULT '[]',
    "processSteps" JSONB NOT NULL DEFAULT '[]',
    "durationYears" DOUBLE PRECISION,
    "classroomHours" TEXT,
    "startingWage" TEXT,
    "startingWageVerified" BOOLEAN NOT NULL DEFAULT false,
    "fees" TEXT,
    "contact" JSONB NOT NULL DEFAULT '{}',
    "recruitmentStatus" "RecruitmentStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "recruitmentNote" TEXT,
    "sourceUrls" JSONB NOT NULL DEFAULT '[]',
    "verifiedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprenticeshipProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgramInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "ProgramInterestStatus" NOT NULL DEFAULT 'INTERESTED',
    "appliedAt" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgramInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationRequirement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hoursRequired" INTEGER NOT NULL,
    "notes" TEXT,
    "sourceUrl" TEXT,
    "verifiedOn" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHourEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "employer" TEXT NOT NULL,
    "supervisor" TEXT,
    "dateWorked" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "workType" "WorkType" NOT NULL DEFAULT 'COMMERCIAL',
    "description" TEXT,
    "verification" "HourVerification" NOT NULL DEFAULT 'SELF_REPORTED',
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkHourEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "traineeRegisteredAt" TIMESTAMP(3),
    "traineeExpiresAt" TIMESTAMP(3),
    "schoolEnrolled" TEXT,
    "examApplicationAt" TIMESTAMP(3),
    "examEligibleAt" TIMESTAMP(3),
    "examScheduledAt" TIMESTAMP(3),
    "examPassedAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    "certificateExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CoachRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "provider" TEXT NOT NULL DEFAULT 'RULES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

-- CreateIndex
CREATE INDEX "Employer_userId_idx" ON "Employer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employer_userId_normalizedName_key" ON "Employer"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- CreateIndex
CREATE INDEX "Application_userId_appliedAt_idx" ON "Application"("userId", "appliedAt");

-- CreateIndex
CREATE INDEX "Application_userId_normalizedCompany_idx" ON "Application"("userId", "normalizedCompany");

-- CreateIndex
CREATE INDEX "Application_userId_normalizedUrl_idx" ON "Application"("userId", "normalizedUrl");

-- CreateIndex
CREATE INDEX "Application_userId_requisitionNumber_idx" ON "Application"("userId", "requisitionNumber");

-- CreateIndex
CREATE INDEX "Application_userId_followUpAt_idx" ON "Application"("userId", "followUpAt");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_occurredAt_idx" ON "ApplicationStatusHistory"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_occurredAt_idx" ON "ApplicationEvent"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_userId_type_occurredAt_idx" ON "ApplicationEvent"("userId", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEvent_userId_dedupeKey_key" ON "ApplicationEvent"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Interview_userId_scheduledAt_idx" ON "Interview"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_userId_idx" ON "Offer"("userId");

-- CreateIndex
CREATE INDEX "Evidence_applicationId_idx" ON "Evidence"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_userId_kind_sourceRef_key" ON "Evidence"("userId", "kind", "sourceRef");

-- CreateIndex
CREATE INDEX "ApplicationSourceLink_applicationId_idx" ON "ApplicationSourceLink"("applicationId");

-- CreateIndex
CREATE INDEX "DuplicateCandidate_userId_status_idx" ON "DuplicateCandidate"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateCandidate_applicationAId_applicationBId_key" ON "DuplicateCandidate"("applicationAId", "applicationBId");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE INDEX "ResumeVersion_userId_idx" ON "ResumeVersion"("userId");

-- CreateIndex
CREATE INDEX "CoverLetterVersion_userId_idx" ON "CoverLetterVersion"("userId");

-- CreateIndex
CREATE INDEX "JobLead_userId_status_idx" ON "JobLead"("userId", "status");

-- CreateIndex
CREATE INDEX "TargetCompany_userId_idx" ON "TargetCompany"("userId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_userId_idx" ON "IntegrationConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_userId_provider_accountEmail_key" ON "IntegrationConnection"("userId", "provider", "accountEmail");

-- CreateIndex
CREATE INDEX "SyncRun_connectionId_startedAt_idx" ON "SyncRun"("connectionId", "startedAt");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_reviewStatus_idx" ON "EmailMessage"("userId", "reviewStatus");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_classification_idx" ON "EmailMessage"("userId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_userId_provider_externalId_key" ON "EmailMessage"("userId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "ImportBatch_userId_idx" ON "ImportBatch"("userId");

-- CreateIndex
CREATE INDEX "ExtensionCapture_userId_status_idx" ON "ExtensionCapture"("userId", "status");

-- CreateIndex
CREATE INDEX "ExtensionCapture_userId_normalizedUrl_idx" ON "ExtensionCapture"("userId", "normalizedUrl");

-- CreateIndex
CREATE INDEX "XpLedger_userId_createdAt_idx" ON "XpLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpLedger_userId_dedupeKey_key" ON "XpLedger"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementKey_key" ON "UserAchievement"("userId", "achievementKey");

-- CreateIndex
CREATE INDEX "Mission_userId_status_periodEnd_idx" ON "Mission"("userId", "status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_userId_key_periodStart_key" ON "Mission"("userId", "key", "periodStart");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizKey_idx" ON "QuizAttempt"("userId", "quizKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApprenticeshipProgram_slug_key" ON "ApprenticeshipProgram"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgramInterest_userId_programId_key" ON "UserProgramInterest"("userId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationRequirement_code_key" ON "CertificationRequirement"("code");

-- CreateIndex
CREATE INDEX "WorkHourEntry_userId_dateWorked_idx" ON "WorkHourEntry"("userId", "dateWorked");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationStatus_userId_classification_key" ON "CertificationStatus"("userId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_userId_weekStart_key" ON "WeeklyReport"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "CoachMessage_userId_createdAt_idx" ON "CoachMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SalaryScenario_userId_idx" ON "SalaryScenario"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_scheduledFor_idx" ON "Notification"("userId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employer" ADD CONSTRAINT "Employer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_coverLetterVersionId_fkey" FOREIGN KEY ("coverLetterVersionId") REFERENCES "CoverLetterVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_recruiterContactId_fkey" FOREIGN KEY ("recruiterContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSourceLink" ADD CONSTRAINT "ApplicationSourceLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_applicationAId_fkey" FOREIGN KEY ("applicationAId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_applicationBId_fkey" FOREIGN KEY ("applicationBId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetterVersion" ADD CONSTRAINT "CoverLetterVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLead" ADD CONSTRAINT "JobLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLead" ADD CONSTRAINT "JobLead_convertedApplicationId_fkey" FOREIGN KEY ("convertedApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetCompany" ADD CONSTRAINT "TargetCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionCapture" ADD CONSTRAINT "ExtensionCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionCapture" ADD CONSTRAINT "ExtensionCapture_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ApiToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionCapture" ADD CONSTRAINT "ExtensionCapture_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCareerNode" ADD CONSTRAINT "UserCareerNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignState" ADD CONSTRAINT "CampaignState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgramInterest" ADD CONSTRAINT "UserProgramInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgramInterest" ADD CONSTRAINT "UserProgramInterest_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ApprenticeshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHourEntry" ADD CONSTRAINT "WorkHourEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHourEntry" ADD CONSTRAINT "WorkHourEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ApprenticeshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHourEntry" ADD CONSTRAINT "WorkHourEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationStatus" ADD CONSTRAINT "CertificationStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryScenario" ADD CONSTRAINT "SalaryScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
