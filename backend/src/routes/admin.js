import { Router } from 'express';
import mongoose from 'mongoose';
import Order, { ORDER_STATUSES } from '../models/Order.js';
import Delivery from '../models/Delivery.js';
import Payment from '../models/Payment.js';
import Rider from '../models/Rider.js';
import User from '../models/User.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone, isValidPhone } from '../utils/phone.js';
import { assignManually, redispatch, cancelDelivery } from '../services/dispatch.js';
import { dailySummary } from '../services/reports.js';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { createLlm } from '../agent/llm.js';
import { getLatestReport } from '../services/seoReport.js';
import { suggestForFood, suggestForFlaggedPages, listSuggestions, decide } from '../services/seoSuggestions.js';

const router = Router();
router.use(protect, requireRole('admin'));

const needId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id');
  return id;
};

router.get('/orders', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    if (!ORDER_STATUSES.includes(req.query.status)) throw new HttpError(400, 'Unknown status');
    filter.status = req.query.status;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  const deliveries = await Delivery.find({ order: { $in: orders.map((o) => o._id) } }).populate({ path: 'rider', populate: { path: 'user', select: 'name phone' } }).lean();
  const byOrder = new Map(deliveries.map((d) => [String(d.order), d]));
  res.json({ page, total, orders: orders.map((o) => ({ ...o, delivery: byOrder.get(String(o._id)) || null })) });
}));

// Kitchen: Pending -> Preparing, or cancel. Rider-driven statuses (On The Way / Delivered) are set by the rider flow.
router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const order = await Order.findById(needId(req.params.id));
  if (!order) throw new HttpError(404, 'Order not found');
  const { status } = req.body;

  if (status === 'Preparing') {
    if (order.status !== 'Pending') throw new HttpError(409, 'Only paid / confirmed orders can start preparing');
  } else if (status === 'Cancelled') {
    if (!['Pending Payment', 'Pending', 'Preparing'].includes(order.status)) throw new HttpError(409, `Cannot cancel an order that is ${order.status}`);
    await cancelDelivery(order._id);
  } else {
    throw new HttpError(400, 'Admins can set Preparing or Cancelled; riders set On The Way and Delivered');
  }
  order.status = status;
  await order.save();
  res.json({ order, refundNeeded: status === 'Cancelled' && order.paymentStatus === 'paid' });
}));

router.get('/deliveries/unassigned', asyncHandler(async (req, res) => {
  const deliveries = await Delivery.find({ status: 'Unassigned' }).sort({ unassignedAt: 1 }).populate('order');
  res.json({ deliveries });
}));

router.post('/orders/:id/assign', asyncHandler(async (req, res) => {
  res.json({ delivery: await assignManually(needId(req.params.id), needId(req.body.riderId)) });
}));

router.post('/orders/:id/redispatch', asyncHandler(async (req, res) => {
  res.json({ delivery: await redispatch(needId(req.params.id)) });
}));

router.get('/riders', asyncHandler(async (req, res) => {
  const riders = await Rider.find().populate('user', 'name phone').sort({ isOnline: -1 });
  res.json({ riders });
}));

router.post('/riders', asyncHandler(async (req, res) => {
  const { name, password, bikeNumber } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!name?.trim() || !bikeNumber?.trim()) throw new HttpError(400, 'Name and bike number are required');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Enter a valid phone number');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const user = await User.create({ name: name.trim(), phone, password, role: 'rider' });
  try {
    const rider = await Rider.create({ user: user._id, bikeNumber: bikeNumber.trim() });
    res.status(201).json({ rider });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // don't leave an orphan rider login behind
    throw err;
  }
}));

router.patch('/riders/:id', asyncHandler(async (req, res) => {
  const update = {};
  if (req.body.isAvailable !== undefined) update.isAvailable = !!req.body.isAvailable;
  if (req.body.isOnline !== undefined) update.isOnline = !!req.body.isOnline;
  const rider = await Rider.findByIdAndUpdate(needId(req.params.id), update, { new: true }).populate('user', 'name phone');
  if (!rider) throw new HttpError(404, 'Rider not found');
  res.json({ rider });
}));

router.get('/payments', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.provider) filter.provider = req.query.provider;
  const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(200).populate('order', 'orderNo total status customerName');
  res.json({ payments });
}));

router.get('/summary/daily', asyncHandler(async (req, res) => {
  res.json(await dailySummary(req.query.date));
}));

// ---- SEO (admin only: the whole router is behind protect + requireRole('admin')) ----
const suggestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: env.seo.suggestionsPerHour, keyGenerator: (req) => String(req.user._id), standardHeaders: true, legacyHeaders: false, message: { message: 'Too many SEO suggestions this hour. Please try again later.' } });
const needAssistant = () => { if (!env.agent.apiKey) throw new HttpError(503, 'The assistant is not set up yet'); };

router.get('/seo/report', asyncHandler(async (req, res) => {
  const report = await getLatestReport();
  res.json(report ? { report } : { report: null, message: 'No crawl has finished yet. Run `npm run crawl` or wait for the scheduled job.' });
}));

router.get('/seo/suggestions', asyncHandler(async (req, res) => {
  res.json({ suggestions: await listSuggestions(req.query.status) });
}));

// "Offer SEO text for a dish": the admin screen calls this after a dish is created or edited. Saved as pending only.
router.post('/seo/suggestions', suggestLimiter, asyncHandler(async (req, res) => {
  needAssistant();
  const s = await suggestForFood({ foodId: needId(req.body.foodId), user: req.user, llm: createLlm(), model: env.agent.model });
  res.status(201).json({ suggestion: s });
}));

// Queue copy for pages the latest crawl found without a meta description.
router.post('/seo/suggestions/from-report', suggestLimiter, asyncHandler(async (req, res) => {
  needAssistant();
  res.status(201).json(await suggestForFlaggedPages({ user: req.user, llm: createLlm(), model: env.agent.model, limit: env.seo.queueBatch }));
}));

router.patch('/seo/suggestions/:id', asyncHandler(async (req, res) => {
  if (!['approve', 'reject'].includes(req.body.decision)) throw new HttpError(400, 'decision must be approve or reject');
  res.json({ suggestion: await decide({ id: req.params.id, decision: req.body.decision, changes: { title: req.body.title, description: req.body.description }, user: req.user }) });
}));

export default router;
