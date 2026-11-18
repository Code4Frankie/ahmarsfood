import { Router } from 'express';
import express from 'express';
import Payment from '../models/Payment.js';
import { verifyWebhookSignature } from '../services/paystack.js';
import { verifyAndConfirm } from '../services/payments.js';

// Mounted BEFORE express.json() in app.js: Paystack's signature is computed over the raw bytes.
const router = Router();

router.post('/paystack', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!verifyWebhookSignature(req.body, req.get('x-paystack-signature'))) return res.sendStatus(401);
  res.sendStatus(200); // acknowledge fast, then work
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success') {
      const payment = await Payment.findOne({ reference: event.data?.reference });
      if (payment) await verifyAndConfirm(payment); // re-verified with Paystack, so a forged body can't confirm an order
    }
  } catch (err) {
    console.error('[webhook:paystack]', err.message);
  }
});

export default router;
