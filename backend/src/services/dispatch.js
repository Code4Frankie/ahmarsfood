import { env } from '../config/env.js';
import Rider from '../models/Rider.js';
import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import { HttpError } from '../utils/httpError.js';
import { haversineKm } from '../utils/geo.js';

const ACTIVE = ['Offered', 'Accepted', 'Picked Up', 'On The Way'];

// Called once an order is confirmed (online payment verified). Safe to call twice.
export async function startDispatch(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return null;
  const fields = { distanceKm: order.distanceKm, estimatedTime: order.estimatedTime, deliveryFee: order.deliveryFee };
  try {
    await Delivery.updateOne(
      { order: order._id },
      { $setOnInsert: { order: order._id, status: 'Searching', attemptedRiders: [], ...fields } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // lost an upsert race: the delivery already exists
  }
  await offerToNextRider(await Delivery.findOne({ order: order._id }).select('_id'));
}

// Nearest eligible rider to the restaurant, within the radius, never one who already declined this order.
export async function offerToNextRider(deliveryRef) {
  if (!deliveryRef) return;
  const delivery = await Delivery.findById(deliveryRef._id || deliveryRef);
  if (!delivery || delivery.status !== 'Searching') return;

  const fresh = new Date(Date.now() - env.delivery.locationStaleMs);
  const busyRiders = await Delivery.distinct('rider', { status: { $in: ACTIVE }, rider: { $ne: null } });

  const rider = await Rider.findOne({
    isOnline: true,
    isAvailable: true,
    approval: { $nin: ['pending', 'rejected'] },
    lastLocationUpdate: { $gte: fresh },
    _id: { $nin: [...delivery.attemptedRiders, ...busyRiders] },
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [env.restaurant.lng, env.restaurant.lat] },
        $maxDistance: env.restaurant.maxRadiusKm * 1000,
      },
    },
  });

  if (!rider) {
    await Delivery.updateOne({ _id: delivery._id, status: 'Searching' }, { status: 'Unassigned', unassignedAt: new Date() });
    console.log(`[dispatch] order ${delivery.order} -> Unassigned queue`);
    return;
  }

  const [lng, lat] = rider.location.coordinates;
  // Only one offer at a time: the status filter makes this claim atomic.
  const claimed = await Delivery.findOneAndUpdate(
    { _id: delivery._id, status: 'Searching' },
    {
      $set: {
        status: 'Offered',
        rider: rider._id,
        offerExpiresAt: new Date(Date.now() + env.delivery.offerTimeoutMs),
        riderDistanceKm: haversineKm(lat, lng, env.restaurant.lat, env.restaurant.lng),
      },
      $addToSet: { attemptedRiders: rider._id },
    },
    { new: true }
  );
  if (claimed) console.log(`[dispatch] order ${delivery.order} offered to rider ${rider._id}`);
  // Riders pick the offer up by polling GET /api/riders/me/offers. Add SMS/push here later.
}

export async function acceptOffer(deliveryId, riderId) {
  const now = new Date();
  const delivery = await Delivery.findOneAndUpdate(
    { _id: deliveryId, rider: riderId, status: 'Offered', offerExpiresAt: { $gt: now } },
    { $set: { status: 'Accepted', acceptedAt: now }, $unset: { offerExpiresAt: 1 } },
    { new: true }
  );
  if (!delivery) throw new HttpError(409, 'This offer has expired or is no longer available');
  await Rider.updateOne({ _id: riderId }, { isAvailable: false });
  return delivery;
}

export async function rejectOffer(deliveryId, riderId) {
  const delivery = await Delivery.findOneAndUpdate(
    { _id: deliveryId, rider: riderId, status: 'Offered' },
    { $set: { status: 'Searching' }, $unset: { rider: 1, offerExpiresAt: 1 } },
    { new: true }
  );
  if (!delivery) throw new HttpError(409, 'Nothing to reject');
  await offerToNextRider(delivery);
}

const NEXT = { Accepted: 'Picked Up', 'Picked Up': 'On The Way', 'On The Way': 'Delivered' };

export async function advanceDelivery(deliveryId, riderId, nextStatus) {
  const current = Object.keys(NEXT).find((k) => NEXT[k] === nextStatus);
  if (!current) throw new HttpError(400, 'Invalid status');

  const existing = await Delivery.findOne({ _id: deliveryId, rider: riderId, status: current }).populate('order');
  if (!existing) throw new HttpError(409, `Delivery must be "${current}" before it can be "${nextStatus}"`);
  const order = existing.order;

  const set = { status: nextStatus };
  if (nextStatus === 'Delivered') set.deliveredAt = new Date();
  const delivery = await Delivery.findOneAndUpdate({ _id: deliveryId, rider: riderId, status: current }, { $set: set }, { new: true });
  if (!delivery) throw new HttpError(409, 'Delivery changed, refresh and try again');

  if (nextStatus === 'Picked Up') await Order.updateOne({ _id: order._id }, { status: 'On The Way' });
  if (nextStatus === 'Delivered') {
    await Order.updateOne({ _id: order._id }, { status: 'Delivered' });
    await Rider.updateOne({ _id: riderId }, { isAvailable: true });
  }
  return delivery;
}

// Admin override: put a specific rider on an order, replacing whoever had it.
export async function assignManually(orderId, riderId) {
  const rider = await Rider.findById(riderId);
  if (!rider) throw new HttpError(404, 'Rider not found');
  if (rider.approval === 'pending' || rider.approval === 'rejected') throw new HttpError(409, 'This rider has not been approved yet');
  await startDispatchRecord(orderId);
  const before = await Delivery.findOne({ order: orderId });
  if (['Delivered', 'Cancelled'].includes(before.status)) throw new HttpError(409, `Delivery is already ${before.status}`);
  if (before.rider && String(before.rider) !== String(riderId)) await Rider.updateOne({ _id: before.rider }, { isAvailable: true });

  const delivery = await Delivery.findOneAndUpdate(
    { order: orderId },
    { $set: { status: 'Accepted', rider: riderId, acceptedAt: new Date() }, $unset: { offerExpiresAt: 1 }, $addToSet: { attemptedRiders: riderId } },
    { new: true }
  );
  await Rider.updateOne({ _id: riderId }, { isAvailable: false });
  return delivery;
}

async function startDispatchRecord(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'Order not found');
  try {
    await Delivery.updateOne(
      { order: order._id },
      { $setOnInsert: { order: order._id, status: 'Unassigned', attemptedRiders: [], distanceKm: order.distanceKm, estimatedTime: order.estimatedTime, deliveryFee: order.deliveryFee } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

// Admin: clear the "already declined" list and search again (e.g. riders have come online).
export async function redispatch(orderId) {
  await startDispatchRecord(orderId);
  const delivery = await Delivery.findOneAndUpdate(
    { order: orderId, status: { $in: ['Unassigned', 'Searching'] } },
    { $set: { status: 'Searching', attemptedRiders: [] }, $unset: { rider: 1, offerExpiresAt: 1 } },
    { new: true }
  );
  if (!delivery) throw new HttpError(409, 'Only unassigned orders can be re-dispatched');
  await offerToNextRider(delivery);
  return Delivery.findById(delivery._id);
}

export async function cancelDelivery(orderId) {
  const delivery = await Delivery.findOneAndUpdate(
    { order: orderId, status: { $nin: ['Delivered', 'Cancelled'] } },
    { $set: { status: 'Cancelled' }, $unset: { offerExpiresAt: 1 } }
  );
  if (delivery?.rider) await Rider.updateOne({ _id: delivery.rider }, { isAvailable: true });
}

// Runs on a timer (see server.js). Offers survive restarts because the deadline is stored on the delivery.
export async function expireStaleOffers() {
  const stale = await Delivery.find({ status: 'Offered', offerExpiresAt: { $lte: new Date() } }).select('_id');
  for (const d of stale) {
    const flipped = await Delivery.findOneAndUpdate(
      { _id: d._id, status: 'Offered', offerExpiresAt: { $lte: new Date() } },
      { $set: { status: 'Searching' }, $unset: { rider: 1, offerExpiresAt: 1 } }
    );
    if (flipped) await offerToNextRider(d._id);
  }
}

// Unpaid online orders older than an hour are cancelled so the list stays clean.
export async function cancelAbandonedOrders() {
  await Order.updateMany(
    { status: 'Pending Payment', createdAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } },
    { status: 'Cancelled' }
  );
}
