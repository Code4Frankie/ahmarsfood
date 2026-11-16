import { env } from '../config/env.js';

// Sends one SMS through Termii (Nigerian SMS provider): POST {baseUrl}/api/sms/send.
// Password-reset codes are transactional, so they use the "dnd" route (reaches numbers with DND on);
// Termii advises against the "generic" route for OTPs.
// No TERMII_API_KEY: in development the message is printed to the server console; in production it is an error.
export async function sendSms(to, text) {
  const { apiKey, senderId, baseUrl, channel } = env.sms;
  if (!apiKey) {
    if (env.nodeEnv === 'production') throw new Error('SMS is not configured (set TERMII_API_KEY and TERMII_SENDER_ID)');
    console.log(`[sms:dev] to ${to}: ${text}`);
    return { dev: true };
  }
  const res = await fetch(`${baseUrl}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, to, from: senderId, sms: text, type: 'plain', channel }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Termii ${res.status}: ${data.message || 'send failed'}`);
  return data;
}
