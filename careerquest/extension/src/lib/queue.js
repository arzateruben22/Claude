/**
 * Offline capture queue (pure functions over plain arrays; the background worker
 * persists the array in chrome.storage.local).
 *
 * @typedef {object} QueueItem
 * @property {string} id
 * @property {object} payload   Capture payload (see capture.js)
 * @property {number} attempts
 * @property {number} createdAt epoch ms
 * @property {number} nextAttemptAt epoch ms
 * @property {string} [lastError]
 */

import { QUEUE_LIMITS } from "./constants.js";

/**
 * Exponential backoff with jitter: base * 2^attempt, capped.
 * @param {number} attempt zero-based attempt count that already failed
 * @param {{ baseMs?: number, maxMs?: number, random?: () => number }} [opts]
 */
export function computeBackoffMs(attempt, opts = {}) {
  const base = opts.baseMs ?? QUEUE_LIMITS.BASE_DELAY_MS;
  const max = opts.maxMs ?? QUEUE_LIMITS.MAX_DELAY_MS;
  const rnd = opts.random ?? Math.random;
  const exp = Math.min(max, base * 2 ** Math.max(0, attempt));
  // ±20% jitter so many clients do not retry in lock-step.
  const jitter = exp * 0.2 * (rnd() * 2 - 1);
  return Math.round(Math.min(max, Math.max(base, exp + jitter)));
}

/** @param {any} payload */
function captureIdOf(payload) {
  const id = payload && payload.evidence && payload.evidence.captureId;
  return typeof id === "string" && id ? id : null;
}

/**
 * Appends an item, dropping the oldest when the queue is full. Idempotent: a
 * payload whose evidence.captureId is already queued is not added again.
 * @param {QueueItem[]} queue
 * @param {object} payload
 * @param {{ now?: number, id?: string, max?: number }} [opts]
 * @returns {{ queue: QueueItem[], item: QueueItem, duplicate?: boolean }}
 */
export function enqueue(queue, payload, opts = {}) {
  const captureId = captureIdOf(payload);
  const existing = captureId ? queue.find((i) => captureIdOf(i.payload) === captureId) : null;
  if (existing) return { queue, item: existing, duplicate: true };
  const now = opts.now ?? Date.now();
  const item = {
    id: opts.id ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    attempts: 0,
    createdAt: now,
    nextAttemptAt: now,
  };
  const max = opts.max ?? QUEUE_LIMITS.MAX_ITEMS;
  const next = [...queue, item];
  while (next.length > max) next.shift();
  return { queue: next, item };
}

/**
 * Marks an item as failed and schedules the next attempt.
 * @param {QueueItem} item
 * @param {{ now?: number, retryAfterMs?: number, error?: string, baseMs?: number }} [opts]
 * @returns {QueueItem}
 */
export function markFailed(item, opts = {}) {
  const now = opts.now ?? Date.now();
  const attempts = item.attempts + 1;
  const delay = opts.retryAfterMs ?? computeBackoffMs(attempts - 1, { baseMs: opts.baseMs });
  return { ...item, attempts, nextAttemptAt: now + delay, lastError: opts.error ?? item.lastError };
}

/** @param {QueueItem} item */
export function isExhausted(item) {
  return item.attempts >= QUEUE_LIMITS.MAX_ATTEMPTS;
}

/**
 * Items that may be attempted now.
 * @param {QueueItem[]} queue
 * @param {number} now
 */
export function dueItems(queue, now) {
  return queue.filter((i) => i.nextAttemptAt <= now);
}

/**
 * Earliest scheduled attempt in the queue (or null when empty).
 * @param {QueueItem[]} queue
 */
export function nextAttemptAt(queue) {
  if (!queue.length) return null;
  return queue.reduce((min, i) => Math.min(min, i.nextAttemptAt), Infinity);
}

/** @param {QueueItem[]} queue @param {string} id */
export function removeItem(queue, id) {
  return queue.filter((i) => i.id !== id);
}

/** @param {QueueItem[]} queue @param {QueueItem} item */
export function replaceItem(queue, item) {
  return queue.map((i) => (i.id === item.id ? item : i));
}
