import { env } from '../config/env.js';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import { HttpError } from '../utils/httpError.js';
import * as paystack from './paystack.js';
import { startDispatch } from './dispatch.js';

const PROVIDER_NAME = { paystack: 'Paystack' };

// Create a Payment attempt and get the provider's checkout link. Order must be "Pending Payment".
export async function initPayment(order, provider, user, { guestToken } = {}) {
  if (provider === 'transfer') return createTransferPayment(order);
  if (!PROVIDER_NAME[provider]) throw new HttpError(400, 'Unsupported payment provider');
  if (order.status !== 'Pending Payment') throw new HttpError(409, 'This order is not awaiting payment');

  const reference = `${order.orderNo}-${Date.now().toString(36)}`.toUpperCase();
  const amountKobo = Math.round(order.total * 100);
  const frontend = env.frontendUrls[0];
  const tokenQs = guestToken ? `&t=${guestToken}` : ''; // guests need their link token to land back on their order
  const returnUrl = `${frontend}/orders/${order._id}?ref=${reference}${tokenQs}`;

  let checkout;
  let raw;
  if (provider === 'paystack') {
    const email = user.email || `${user.phone}@guest.ahmarsfood.com`;
    raw = await paystack.initializeTransaction({
      email,
      amountKobo,
      reference,
      callbackUrl: returnUrl,
      metadata: { orderId: String(order._id), orderNo: order.orderNo },
    });
    checkout = { authorizationUrl: raw.authorization_url, accessCode: raw.access_code };
  }

  // Earlier unfinished attempts are marked abandoned (a late success on them is still honoured).
  await Payment.updateMany({ order: order._id, status: 'initiated' }, { status: 'abandoned' });
  const payment = await Payment.create({
    order: order._id,
    provider: PROVIDER_NAME[provider],
    reference,
    amount: order.total,
    rawResponse: raw,
  });
  return { paymentId: payment._id, reference, provider, ...checkout };
}

// Bank transfer: the customer sends money to our account with the order number as the narration, and an admin
// confirms it once it shows in the bank app (see POST /api/admin/orders/:id/confirm-transfer).
export async function createTransferPayment(order) {
  if (order.status !== 'Pending Payment') throw new HttpError(409, 'This order is not awaiting payment');
  const reference = `${order.orderNo}-TRF-${Date.now().toString(36)}`.toUpperCase();
  await Payment.updateMany({ order: order._id, status: 'initiated' }, { status: 'abandoned' });
  const payment = await Payment.create({ order: order._id, provider: 'Transfer', reference, amount: order.total });
  return { paymentId: payment._id, reference, provider: 'transfer', amount: order.total, bank: env.bank };
}

// Idempotent: the first caller flips the payment to success and starts dispatch; repeats do nothing.
export async function confirmPayment(payment) {
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'success' } },
    { status: 'success' },
    { new: true }
  );
  if (!claimed) return false; // already confirmed

  const order = await Order.findOneAndUpdate(
    { _id: payment.order, status: 'Pending Payment' },
    { status: 'Pending', paymentStatus: 'paid', paymentReference: payment.reference },
    { new: true }
  );
  if (!order) {
    await Payment.updateOne({ _id: payment._id }, { note: 'Paid, but the order was no longer awaiting payment (cancelled?). Review and refund if needed.' });
    console.warn(`[payments] ${payment.reference} paid but order not pending: needs review`);
    return false;
  }
  startDispatch(order._id).catch((e) => console.error('[dispatch] failed', e));
  return true;
}

// Ask the provider directly. Never trust a browser redirect or a webhook body on its own.
export async function verifyAndConfirm(payment) {
  const order = await Order.findById(payment.order);
  if (!order) throw new HttpError(404, 'Order not found');
  const expectedKobo = Math.round(order.total * 100);

  if (payment.provider === 'Paystack') {
    const data = await paystack.verifyTransaction(payment.reference);
    if (data.status === 'success') {
      if (data.amount !== expectedKobo || data.currency !== 'NGN') {
        await Payment.updateOne({ _id: payment._id }, { status: 'failed', note: 'Amount or currency mismatch', rawResponse: data });
        throw new HttpError(409, 'Payment amount does not match the order');
      }
      await confirmPayment(payment);
    } else if (['failed', 'abandoned', 'reversed'].includes(data.status) && payment.status !== 'success') {
      await Payment.updateOne({ _id: payment._id }, { status: data.status === 'failed' ? 'failed' : 'abandoned' });
    }
  }
  return Payment.findById(payment._id);
}
