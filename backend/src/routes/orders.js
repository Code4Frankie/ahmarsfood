import { Router } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food.js';
import Order from '../models/Order.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { haversineKm, isValidCoord } from '../utils/geo.js';
import { deliveryFeeFor, estimateMinutes } from '../utils/pricing.js';
import { normalizePhone, isValidPhone } from '../utils/phone.js';
import { initPayment } from '../services/payments.js';
import { findOrderForUser, listOrdersForUser } from '../services/orders.js';

const router = Router();

router.post('/', protect, requireRole('customer', 'admin'), asyncHandler(async (req, res) => {
  const { items, paymentMethod, deliveryAddress, landmark, note } = req.body;
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (!['paystack', 'opay'].includes(paymentMethod)) throw new HttpError(400, 'Choose a payment method');
  if (!deliveryAddress?.trim()) throw new HttpError(400, 'Delivery address is required');
  if (!isValidCoord(lat, lng)) throw new HttpError(400, 'Pin your delivery location on the map');
  const phone = normalizePhone(req.body.phone || req.user.phone);
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

  const distanceKm = haversineKm(env.restaurant.lat, env.restaurant.lng, lat, lng);
  if (distanceKm > env.restaurant.maxRadiusKm) {
    throw new HttpError(400, `Sorry, we only deliver within ${env.restaurant.maxRadiusKm} km of ${env.restaurant.address}`);
  }
  const deliveryFee = deliveryFeeFor(distanceKm, env.delivery);
  const total = subtotal + deliveryFee;
  const prep = Math.max(...foods.map((f) => f.prepTime || 15));

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    paymentMethod,
    status: 'Pending Payment',
    customerName: (req.body.name || req.user.name).trim(),
    customerPhone: phone,
    note: note?.slice(0, 300),
    deliveryAddress: deliveryAddress.trim(),
    landmark: landmark?.trim(),
    lat,
    lng,
    distanceKm: Math.round(distanceKm * 10) / 10,
    estimatedTime: estimateMinutes(distanceKm, prep),
  });

  // Online payment: the order exists but stays "Pending Payment" and is NOT visible to the kitchen until verified.
  try {
    const payment = await initPayment(order, paymentMethod, req.user);
    res.status(201).json({ order, payment });
  } catch (err) {
    res.status(201).json({ order, paymentError: err.message || 'Could not start payment, please retry' });
  }
}));

router.get('/mine', protect, asyncHandler(async (req, res) => {
  res.json({ orders: await listOrdersForUser(req.user) });
}));

router.get('/:id', protect, asyncHandler(async (req, res) => {
  res.json(await findOrderForUser(req.user, { id: req.params.id }));
}));

export default router;
