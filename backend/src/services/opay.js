import crypto from 'crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// Based on OPay's Cashier docs (doc.opaycheckout.com): cashier/create is authorised with the PUBLIC key,
// cashier/status with an HMAC-SHA512 signature of the exact JSON body, made with the SECRET key.
// Amounts are in the smallest unit (kobo). Re-check against the docs before going live.
const COUNTRY = 'NG';
const CURRENCY = 'NGN';

async function post(path, body, bearer) {
  const res = await fetch(env.opay.baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
      MerchantId: env.opay.merchantId,
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== '00000') throw new HttpError(502, json.message || 'Opay request failed');
  return json.data;
}

export function createCashierPayment({ reference, amountKobo, user, description, returnUrl, cancelUrl, callbackUrl }) {
  const body = JSON.stringify({
    country: COUNTRY,
    reference,
    amount: { total: amountKobo, currency: CURRENCY },
    returnUrl,
    cancelUrl,
    callbackUrl,
    expireAt: 30, // minutes
    userInfo: { userId: String(user._id), userName: user.name, userMobile: user.phone, userEmail: user.email },
    productList: [{ productId: reference, name: 'Ahmars Food order', description, price: amountKobo, quantity: 1 }],
  });
  return post('/api/v1/international/cashier/create', body, env.opay.publicKey); // -> { cashierUrl, orderNo, status }
}

export function queryPaymentStatus(reference) {
  const body = JSON.stringify({ country: COUNTRY, reference });
  const signature = crypto.createHmac('sha512', env.opay.secretKey).update(body).digest('hex');
  return post('/api/v1/international/cashier/status', body, signature); // -> { status, amount: { total } ... }
}
