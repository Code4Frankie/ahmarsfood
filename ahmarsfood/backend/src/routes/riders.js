import { Router } from 'express';
import Rider from '../models/Rider.js';
import Delivery from '../models/Delivery.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { isValidCoord } from '../utils/geo.js';
import { env } from '../config/env.js';

const router = Router();
router.use(protect, requireRole('rider'));

const myRider = async (req) => {
  const rider = await Rider.findOne({ user: req.user._id });
  if (!rider) throw new HttpError(404, 'No rider profile for this account');
  return rider;
};

// Customer phone and item list are only shown once the rider has accepted.
export const deliveryView = (d, { accepted }) => ({
  id: d._id,
  status: d.status,
  offerExpiresAt: d.offerExpiresAt,
  deliveryFee: d.deliveryFee,
  distanceKm: d.distanceKm,
  riderDistanceKm: d.riderDistanceKm,
  estimatedTime: d.estimatedTime,
  pickup: { address: env.restaurant.address, lat: env.restaurant.lat, lng: env.restaurant.lng },
  dropoff: { address: d.order.deliveryAddress, landmark: d.order.landmark, lat: d.order.lat, lng: d.order.lng },
  order: {
    orderNo: d.order.orderNo,
    paymentMethod: d.order.paymentMethod,
    collectAmount: d.order.paymentMethod === 'pod' ? d.order.total : 0, // cash/transfer to collect on arrival
    ...(accepted ? { customerName: d.order.customerName, customerPhone: d.order.customerPhone, note: d.order.note, items: d.order.items.map((i) => ({ name: i.name, qty: i.qty })) } : {}),
  },
});

router.get('/me', asyncHandler(async (req, res) => res.json({ rider: await myRider(req) })));

router.patch('/me/availability', asyncHandler(async (req, res) => {
  const rider = await myRider(req);
  rider.isOnline = !!req.body.isOnline;
  await rider.save();
  res.json({ rider });
}));

// The rider app sends this every ~15-30 s while online. Browser geolocation only reports while the page is open.
router.patch('/me/location', asyncHandler(async (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!isValidCoord(lat, lng)) throw new HttpError(400, 'Invalid coordinates');
  const rider = await myRider(req);
  await Rider.updateOne({ _id: rider._id }, { location: { type: 'Point', coordinates: [lng, lat] }, lastLocationUpdate: new Date() });
  res.json({ ok: true });
}));

// Polled by the rider app every 5-10 s.
router.get('/me/offers', asyncHandler(async (req, res) => {
  const rider = await myRider(req);
  const [offer, active] = await Promise.all([
    Delivery.findOne({ rider: rider._id, status: 'Offered', offerExpiresAt: { $gt: new Date() } }).populate('order'),
    Delivery.findOne({ rider: rider._id, status: { $in: ['Accepted', 'Picked Up', 'On The Way'] } }).populate('order'),
  ]);
  res.json({
    offer: offer ? deliveryView(offer, { accepted: false }) : null,
    active: active ? deliveryView(active, { accepted: true }) : null,
  });
}));

router.get('/me/deliveries', asyncHandler(async (req, res) => {
  const rider = await myRider(req);
  const history = await Delivery.find({ rider: rider._id, status: 'Delivered' }).sort({ deliveredAt: -1 }).limit(100).populate('order', 'orderNo deliveryAddress');
  const [sum] = await Delivery.aggregate([
    { $match: { rider: rider._id, status: 'Delivered' } },
    { $group: { _id: null, total: { $sum: '$deliveryFee' }, count: { $sum: 1 } } },
  ]);
  res.json({ history, totalEarned: sum?.total || 0, deliveriesCompleted: sum?.count || 0 });
}));

export default router;
