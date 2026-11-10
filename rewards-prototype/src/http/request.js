// Reading what a client sent: the body of a state-changing request, and query
// parameters (docs/API.md §2, items 3 and 4).
//
// Rules protected here:
//   * A body is at most 64 KB, counted on the bytes that actually arrive. The
//     Content-Length header is only ever used to refuse early, never to allow.
//   * A body is JSON and its top level is an object. Nothing else is interpreted.
//   * The key "__proto__" is refused wherever it appears, so no later copy of a parsed
//     body can turn request data into an object's prototype.
//   * Query parameters are validated like body fields: a limit is a whole number in
//     range, an id is a short opaque string. Unknown parameters are ignored; a repeated
//     one is refused, so two readers can never disagree about which value counts.

import { AppError, badRequest, unprocessable } from '../lib/errors.js';
import { isJsonContentType } from './security.js';

export const MAX_BODY_BYTES = 64 * 1024;
// Past the limit nothing more is kept, but a modest overrun is still read to its end so
// that the 413 reaches the client instead of a reset connection. Beyond this the
// connection is simply closed.
const MAX_DRAIN_BYTES = 1024 * 1024;
const MAX_JSON_DEPTH = 12;

/** Opaque ids as this server mints them, and nothing that could carry a path, an address or markup. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const tooLarge = () => new AppError(413, 'body_too_large', 'That request is too large. The limit is 64 KB.');
const jsonRequired = () => new AppError(415, 'json_required', 'Send the request body as JSON (Content-Type: application/json).');
const invalidJson = () => badRequest('invalid_json', 'The request body must be a JSON object.');

/** Whether the request headers announce a body at all. */
function announcesBody(req) {
  const length = req.headers['content-length'];
  return req.headers['transfer-encoding'] !== undefined || (length !== undefined && length !== '0');
}

/**
 * Collects the body, keeping at most `limit` bytes.
 * @returns {Promise<Buffer>} rejects with 413 once more than `limit` bytes have arrived
 */
function readLimited(req, limit) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let received = 0;
    // An honest oversized Content-Length is refused without buffering a single byte.
    let over = Number(req.headers['content-length']) > limit;
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    req.on('data', (chunk) => {
      received += chunk.length;
      if (!over && received > limit) {
        over = true;
        chunks.length = 0;
      }
      if (!over) chunks.push(chunk);
      else if (received > MAX_DRAIN_BYTES) {
        const error = tooLarge();
        error.closeConnection = true;
        req.pause();
        settle(rejectPromise, error);
      }
    });
    req.on('end', () => settle(over ? rejectPromise : resolvePromise, over ? tooLarge() : Buffer.concat(chunks)));
    req.on('error', (error) => settle(rejectPromise, error));
    req.on('close', () => settle(rejectPromise, new AppError(400, 'request_aborted', 'The request was cut off before it was complete.')));
  });
}

function assertNoPrototypeKeys(value, depth) {
  if (value === null || typeof value !== 'object') return;
  if (depth > MAX_JSON_DEPTH) throw invalidJson();
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrototypeKeys(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value)) {
    if (key === '__proto__') throw unprocessable('unknown_field', '"__proto__" is not a field you can set here.', { field: '__proto__' });
    assertNoPrototypeKeys(value[key], depth + 1);
  }
}

/**
 * The body of a state-changing request as a plain object. The checks run in the order
 * docs/API.md §2 lists them: content type (415), size (413), JSON object (400).
 * A request with no body at all yields an empty object.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readJsonObject(req) {
  const json = isJsonContentType(req.headers['content-type']);
  if (announcesBody(req) && !json) {
    // The body is still read (and dropped) so the refusal can be delivered cleanly.
    const drained = await readLimited(req, 0).then(
      () => null,
      (error) => error,
    );
    const refusal = jsonRequired();
    if (drained?.closeConnection) refusal.closeConnection = true;
    throw refusal;
  }
  const bytes = await readLimited(req, MAX_BODY_BYTES);
  if (bytes.length === 0) return {};
  if (!json) throw jsonRequired();
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw invalidJson();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalidJson();
  assertNoPrototypeKeys(parsed, 0);
  return parsed;
}

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

const invalid = (field, message) => unprocessable('invalid_input', message, { field });

/** The single value of a query parameter, or undefined when it is absent or empty. */
function single(query, name) {
  const values = query.getAll(name);
  if (values.length > 1) throw invalid(name, `"${name}" may be given only once.`);
  return values.length === 0 || values[0] === '' ? undefined : values[0];
}

/** @param {URLSearchParams} query */
export function queryInteger(query, name, { min, max }) {
  const text = single(query, name);
  if (text === undefined) return undefined;
  const value = /^\d{1,15}$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isInteger(value) || value < min || value > max) throw invalid(name, `"${name}" must be a whole number from ${min} to ${max}.`);
  return value;
}

/** A short opaque string: an id, an enum value, an action name. */
export function queryToken(query, name, pattern = ID_PATTERN) {
  const text = single(query, name);
  if (text === undefined) return undefined;
  if (text.length > 100 || !pattern.test(text)) throw invalid(name, `"${name}" is not in the expected format.`);
  return text;
}

export function queryOneOf(query, name, options) {
  const text = single(query, name);
  if (text === undefined) return undefined;
  if (!options.includes(text)) throw invalid(name, `"${name}" must be one of: ${options.join(', ')}.`);
  return text;
}
