import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Delivery from '../models/Delivery.js';
import { HttpError } from '../utils/httpError.js';

// Shape of a delivery as the CUSTOMER sees it: rider name/phone/bike, status, ETA, live position once on the road.
export async function trackingView(orderId) {
  const delivery = await Delivery.findOne({ order: orderId }).populate({ path: 'rider', populate: { path: 'user', select: 'name phone' } });
  if (!delivery) return null;
  const r = delivery.rider;
  const onRoad = ['Picked Up', 'On The Way'].includes(delivery.status);
  return {
    status: delivery.status,
    estimatedTime: delivery.estimatedTime,
    rider: r && ['Accepted', 'Picked Up', 'On The Way', 'Delivered'].includes(delivery.status)
      ? { name: r.user?.name, phone: r.user?.phone, bikeNumber: r.bikeNumber, location: onRoad && r.location?.coordinates ? { lat: r.location.coordinates[1], lng: r.location.coordinates[0] } : undefined }
      : null,
  };
}

export async function listOrdersForUser(user, limit = 50) {
  return Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(limit);
}

// Same permission rule as GET /api/orders/:id: customers see only their own orders, admins see all.
// With no id or orderNo it returns the user's most recent order.
export async function findOrderForUser(user, { id, orderNo } = {}) {
  let order;
  if (id) {
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id');
    order = await Order.findById(id);
  } else if (orderNo) {
    if (typeof orderNo !== 'string') throw new HttpError(400, 'Invalid order number');
    order = await Order.findOne({ orderNo });
  } else {
    order = await Order.findOne({ user: user._id }).sort({ createdAt: -1 });
  }
  if (!order || (user.role !== 'admin' && String(order.user) !== String(user._id))) throw new HttpError(404, 'Order not found');
  return { order, delivery: await trackingView(order._id) };
}
