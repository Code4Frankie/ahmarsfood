import { Router } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food.js';
import Order from '../models/Order.js';
import rateLimit from 'express-rate-limit';
import { optionalAuth, protect } from '../middleware/auth.js';
import { newGuestToken, hashGuestToken } from '../utils/guestToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { haversineKm, isValidCoord } from '../utils/geo.js';
import { deliveryFeeFor, estimateMinutes } from '../utils/pricing.js';
import { normalizePhone, isValidPhone } from '../utils/phone.js';
import { initPayment, createTransferPayment } from '../services/payments.js';
import { listOrdersForUser, canAccessOrder, trackingView } from '../services/orders.js';

const router = Router();

// A freshly created document still carries the token hash; never send it back out.
const publicOrder = (order) => {
  const plain = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  delete plain.guestTokenHash;
  return plain;
};

// Guests can order too, so this endpoint is open to the internet: cap how many orders one address can start per hour.
const guestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many orders from this connection, please try again later' } });

router.post('/', optionalAuth, (req, res, next) => (req.user ? next() : guestLimiter(req, res, next)), asyncHandler(async (req, res) => {
  if (req.user && !['customer', 'admin'].includes(req.user.role)) throw new HttpError(403, 'Not allowed for this account');
  const guest = !req.user;
  const { items, paymentMethod, deliveryAddress, landmark, note } = req.body;
  const pickup = req.body.fulfillment === 'pickup'; // collect at the restaurant: no address, no rider, no delivery fee
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!['paystack', 'transfer'].includes(paymentMethod)) throw new HttpError(400, 'Choose a payment method');
  if (!pickup && !deliveryAddress?.trim()) throw new HttpError(400, 'Delivery address is required');
  if (!pickup && !isValidCoord(lat, lng)) throw new HttpError(400, 'Pin your delivery location on the map');
  const phone = normalizePhone(req.body.phone || req.user?.phone);
  const customerName = String(req.body.name || req.user?.name || '').trim();
  if (guest && customerName.length < 2) throw new HttpError(400, 'Enter your name');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Enter a valid phone number');
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new HttpError(400, 'Your cart is empty');

  // Merge duplicate lines and validate quantities.
  const qtyById = new Map();
  for (const it of items) {
    const qty = Number(it.qty);
    if (!mongoose.isValidObjectId(it.foodId) || !Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'Invalid cart item');
    qtyById.set(String(it.foodId), (qtyById.get(String(it.foodId)) || 0) + qty);
  }

  // Prices ALWAYS come from the database, never from the browser.
  const foods = await Food.find({ _id: { $in: [...qtyById.keys()] } });
  if (foods.length !== qtyById.size) throw new HttpError(400, 'An item in your cart no longer exists');
  const unavailable = foods.filter((f) => !f.isAvailable);
  if (unavailable.length) throw new HttpError(409, `Not available right now: ${unavailable.map((f) => f.name).join(', ')}`);

  const orderItems = foods.map((f) => ({ food: f._id, name: f.name, price: f.price, qty: qtyById.get(String(f._id)) }));
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);

  const distanceKm = pickup ? 0 : haversineKm(env.restaurant.lat, env.restaurant.lng, lat, lng);
  if (distanceKm > env.restaurant.maxRadiusKm) {
    throw new HttpError(400, `Sorry, we only deliver within ${env.restaurant.maxRadiusKm} km of ${env.restaurant.address}`);
  }
  const deliveryFee = pickup ? 0 : deliveryFeeFor(distanceKm, env.delivery);
  const total = subtotal + deliveryFee;
  const prep = Math.max(...foods.map((f) => f.prepTime || 15));

  const guestToken = guest ? newGuestToken() : undefined;
  const order = await Order.create({
    user: guest ? undefined : req.user._id,
    guestTokenHash: guest ? hashGuestToken(guestToken) : undefined,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    paymentMethod,
    fulfillment: pickup ? 'pickup' : 'delivery',
    status: 'Pending Payment',
    customerName,
    customerPhone: phone,
    note: note?.slice(0, 300),
    deliveryAddress: pickup ? 'Pickup at the restaurant' : deliveryAddress.trim(),
    landmark: pickup ? undefined : landmark?.trim(),
    lat: pickup ? undefined : lat,
    lng: pickup ? undefined : lng,
    distanceKm: Math.round(distanceKm * 10) / 10,
    estimatedTime: estimateMinutes(distanceKm, prep),
  });

  // The order exists but stays "Pending Payment" and is NOT visible to the kitchen until the payment is confirmed
  // (Paystack: verified with Paystack; bank transfer: confirmed by an admin).
  try {
    const payer = guest ? { _id: `guest-${order._id}`, name: customerName, phone } : req.user;
    const payment = paymentMethod === 'transfer' ? await createTransferPayment(order) : await initPayment(order, paymentMethod, payer, { guestToken });
    res.status(201).json({ order: publicOrder(order), payment, guestToken });
  } catch (err) {
    res.status(201).json({ order: publicOrder(order), paymentError: err.message || 'Could not start payment, please retry', guestToken });
  }
}));

// Bank transfer: the customer taps "I have sent the money" so the admin knows to check the bank app.
router.post('/:id/transfer-sent', optionalAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const order = await Order.findById(req.params.id);
  if (!order || !(await canAccessOrder(order, req))) throw new HttpError(404, 'Order not found');
  if (order.status !== 'Pending Payment') throw new HttpError(409, 'This order is not awaiting payment');
  if (!order.transferClaimedAt) await Order.updateOne({ _id: order._id }, { transferClaimedAt: new Date() });
  res.json({ ok: true });
}));

router.get('/mine', protect, asyncHandler(async (req, res) => {
  res.json({ orders: await listOrdersForUser(req.user) });
}));

router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const order = await Order.findById(req.params.id);
  if (!order || !(await canAccessOrder(order, req))) throw new HttpError(404, 'Order not found');
  res.json({ order, delivery: await trackingView(order._id) });
}));

export default router;
