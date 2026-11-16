import crypto from 'node:crypto';

export const RESET_CODE_TTL_MS = 10 * 60 * 1000; // a code works for 10 minutes
export const RESET_RESEND_MS = 60 * 1000;        // at most one new code per minute per account
export const RESET_MAX_ATTEMPTS = 5;             // wrong guesses allowed per code

// 6 digits, from a cryptographically secure source.
export const generateResetCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// Only a keyed hash of the code is stored, never the code itself.
export const hashResetCode = (code, userId, secret) =>
  crypto.createHmac('sha256', secret).update(`${userId}:${String(code).trim()}`).digest('hex');

export function resetCodeMatches(code, userId, storedHash, secret) {
  if (!storedHash || !/^\d{6}$/.test(String(code).trim())) return false;
  const a = Buffer.from(hashResetCode(code, userId, secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
