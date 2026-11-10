import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford base32, lower case

/** Opaque, unguessable id with a readable prefix: newId('clm') -> 'clm_3f9k…' (128 bits). */
export function newId(prefix) {
  const bytes = randomBytes(16);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return `${prefix}_${out}`;
}

/** URL-safe random secret (session tokens, CSRF tokens, nonces). */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

/** Constant-time comparison of two strings. Returns false for non-strings or length mismatch. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // UTF-16 code units, not UTF-8: in UTF-8 every unpaired surrogate becomes the same
  // replacement bytes, so two different strings could compare as equal.
  const ab = Buffer.from(a, 'utf16le');
  const bb = Buffer.from(b, 'utf16le');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
