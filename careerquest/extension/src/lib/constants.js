/**
 * Shared constants for the CareerQuest Job Tracker extension.
 * This module has no chrome.* dependencies so it can be unit-tested in node.
 */

/** Message types exchanged between content scripts, popup, options and the background worker. */
export const MSG = Object.freeze({
  // content script → background
  DETECTION: "cq:detection",
  // background → content script
  DETECT_NOW: "cq:detect-now",
  // popup/options → background
  GET_STATE: "cq:get-state",
  SAVE_SETTINGS: "cq:save-settings",
  TEST_CONNECTION: "cq:test-connection",
  LOOKUP: "cq:lookup",
  SAVE_CAPTURE: "cq:save-capture",
  RESOLVE_PENDING: "cq:resolve-pending",
  MANUAL_DETECT: "cq:manual-detect",
  FLUSH_QUEUE: "cq:flush-queue",
  CLEAR_QUEUE: "cq:clear-queue",
  DISCONNECT: "cq:disconnect",
});

/** Capture kinds accepted by POST /api/extension/captures. */
export const CAPTURE_KIND = Object.freeze({
  JOB_PAGE: "JOB_PAGE",
  APPLY_STARTED: "APPLY_STARTED",
  CONFIRMATION_PAGE: "CONFIRMATION_PAGE",
  MANUAL_CONFIRMATION: "MANUAL_CONFIRMATION",
});

/** Platforms accepted by the capture API. */
export const PLATFORMS = Object.freeze([
  "INDEED",
  "LINKEDIN",
  "GLASSDOOR",
  "ZIPRECRUITER",
  "WORKDAY",
  "GREENHOUSE",
  "LEVER",
  "SMARTRECRUITERS",
  "ICIMS",
  "ADP",
  "GOVERNMENTJOBS",
  "USAJOBS",
  "COMPANY_SITE",
  "OTHER",
]);

/** Confidence thresholds (product rules). */
export const CONFIDENCE = Object.freeze({
  /** A confirmation page at or above this is recorded automatically. */
  AUTO_CONFIRM: 0.8,
  /** Below this a confirmation signal is ignored entirely. */
  PROMPT_MIN: 0.5,
  /** A user assertion ("I submitted this") is absolute. */
  USER_ASSERTED: 1.0,
});

/** chrome.storage.local keys. */
export const STORAGE = Object.freeze({
  SETTINGS: "settings",
  CONNECTION: "connection",
  QUEUE: "queue",
  PENDING: "pending",
  HOST_PERMISSION: "hostPermission",
  /** dedupe keys of confirmations recorded automatically → timestamp */
  SENT: "sentCaptures",
  /** prompts the user already answered (Yes/No) → { at, answer } */
  RESOLVED: "resolvedPrompts",
});

/** chrome.storage.session keys (cleared when the browser closes). */
export const SESSION = Object.freeze({
  DETECTIONS: "detections",
  MATCHES: "matches",
  LAST_JOB: "lastJob",
});

/** How long remembered keys / page context stay valid. */
export const MEMORY = Object.freeze({
  /** an auto-recorded confirmation is not re-sent for this long */
  SENT_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  /** an answered prompt is not shown again for the same page for this long */
  RESOLVED_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  /** at most this many remembered keys per store (oldest dropped) */
  MAX_KEYS: 500,
  /** the last job page seen in a tab pre-fills a confirmation only this long */
  LAST_JOB_TTL_MS: 2 * 60 * 60 * 1000,
});

export const DEFAULT_SETTINGS = Object.freeze({
  apiBaseUrl: "http://localhost:3000",
  token: "",
});

export const QUEUE_LIMITS = Object.freeze({
  MAX_ITEMS: 50,
  MAX_ATTEMPTS: 8,
  BASE_DELAY_MS: 30_000,
  MAX_DELAY_MS: 6 * 60 * 60 * 1000,
});

export const ALARM_QUEUE_RETRY = "cq-queue-retry";

export const API_TIMEOUT_MS = 12_000;

/** Field length limits applied before anything leaves the page. */
export const LIMITS = Object.freeze({
  company: 200,
  title: 200,
  location: 200,
  salaryText: 120,
  requisitionId: 64,
  pageTitle: 300,
  confirmationText: 300,
  url: 2048,
});
