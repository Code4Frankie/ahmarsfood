import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import { optionalAuth } from '../middleware/auth.js';
import { canAccessOrder, orderTokenFrom } from '../services/orders.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { initPayment, verifyAndConfirm } from '../services/payments.js';

const router = Router();

// Retry payment, or switch method, for an order still awaiting payment.
router.post('/:provider/init', optionalAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.body.orderId)) throw new HttpError(400, 'orderId is required');
  const order = await Order.findById(req.body.orderId);
  if (!order || !(await canAccessOrder(order, req))) throw new HttpError(404, 'Order not found');
  const guestOrder = !order.user;
  const payer = guestOrder ? { _id: `guest-${order._id}`, name: order.customerName, phone: order.customerPhone } : req.user;
  const payment = await initPayment(order, req.params.provider, payer, { guestToken: guestOrder ? orderTokenFrom(req) : undefined });
  await Order.updateOne({ _id: order._id }, { paymentMethod: req.params.provider });
  res.json({ payment });
}));

// The return page calls this with the reference from the redirect URL. We ask the provider; we don't trust the URL.
router.get('/verify/:reference', optionalAuth, asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ reference: req.params.reference });
  if (!payment) throw new HttpError(404, 'Payment not found');
  const order = await Order.findById(payment.order);
  if (!(await canAccessOrder(order, req))) throw new HttpError(404, 'Payment not found');
  const updated = await verifyAndConfirm(payment);
  const fresh = await Order.findById(order._id);
  res.json({ payment: { reference: updated.reference, status: updated.status }, orderStatus: fresh.status });
}));

export default router;
