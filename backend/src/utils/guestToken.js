import crypto from 'node:crypto';

// A guest order has no account. Whoever holds this random token (in the tracking link) may view and pay for that one order.
// Only a SHA-256 hash is stored, so a leaked database does not leak working links.
export const newGuestToken = () => crypto.randomBytes(24).toString('hex');
export const hashGuestToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export function guestTokenMatches(token, storedHash) {
  if (!token || !storedHash || typeof token !== 'string' || token.length > 200) return false;
  const a = Buffer.from(hashGuestToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
