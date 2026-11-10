// Small, explicit input validation. Every function throws a 422 AppError naming the field.
// `only()` is the mass-assignment guard: a request may not carry fields we did not ask for.

import { unprocessable } from './errors.js';

const fail = (field, message) => unprocessable('invalid_input', message, { field });

export function object(input, name = 'body') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(name, 'Send a JSON object.');
  return input;
}

/** Returns a copy of `input` restricted to `allowed`; any other key is an error. */
export function only(input, allowed, name = 'body') {
  object(input, name);
  const out = {};
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw unprocessable('unknown_field', `"${key}" is not a field you can set here.`, { field: key });
    out[key] = input[key];
  }
  return out;
}

export function string(value, field, { min = 1, max = 200, pattern, trim = true } = {}) {
  if (typeof value !== 'string') throw fail(field, `"${field}" must be text.`);
  const text = trim ? value.trim() : value;
  if (text.length < min || text.length > max) throw fail(field, `"${field}" must be ${min}–${max} characters.`);
  // Control characters have no place in names, labels or notes.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw fail(field, `"${field}" contains characters that are not allowed.`);
  if (pattern && !pattern.test(text)) throw fail(field, `"${field}" is not in the expected format.`);
  return text;
}

export function integer(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) throw fail(field, `"${field}" must be a whole number from ${min} to ${max}.`);
  return value;
}

export function boolean(value, field) {
  if (typeof value !== 'boolean') throw fail(field, `"${field}" must be true or false.`);
  return value;
}

export function oneOf(value, field, options) {
  if (!options.includes(value)) throw fail(field, `"${field}" must be one of: ${options.join(', ')}.`);
  return value;
}

/** Lower-cased, trimmed e-mail address. Deliberately simple: the allowlist is typed by an admin. */
export function email(value, field = 'email') {
  const text = string(value, field, { min: 3, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw fail(field, 'Enter a valid e-mail address.');
  return text;
}

/** https URL on one of the allowed hosts (exact host or a subdomain of it). */
export function httpsUrl(value, field, { hosts, max = 500 } = {}) {
  const text = string(value, field, { min: 8, max });
  let url;
  try {
    url = new URL(text);
  } catch {
    throw fail(field, `"${field}" must be a full https:// link.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw fail(field, `"${field}" must be a plain https:// link.`);
  if (hosts && !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw fail(field, `"${field}" must be a link to: ${hosts.join(', ')}.`);
  }
  return url;
}

/** Applies `fn` only when the value is present (not undefined). */
export const optional = (value, fn) => (value === undefined ? undefined : fn(value));

/** Like `optional`, and also lets an explicit null through. */
export const nullable = (value, fn) => (value === undefined ? undefined : value === null ? null : fn(value));
