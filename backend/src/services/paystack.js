import crypto from 'crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const BASE = 'https://api.paystack.co';

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { Authorization: `Bearer ${env.paystackSecret}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) throw new HttpError(502, json.message || 'Paystack request failed');
  return json.data;
}

// amountKobo: Paystack takes the smallest currency unit.
export const initializeTransaction = ({ email, amountKobo, reference, callbackUrl, metadata }) =>
  call('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({ email, amount: amountKobo, currency: 'NGN', reference, callback_url: callbackUrl, metadata }),
  });

export const verifyTransaction = (reference) =>
  call(`/transaction/verify/${encodeURIComponent(reference)}`);

// Webhook authenticity: HMAC-SHA512 of the RAW body with the secret key.
export function verifyWebhookSignature(rawBody, signature) {
  if (!signature || !env.paystackSecret) return false;
  const expected = crypto.createHmac('sha512', env.paystackSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
