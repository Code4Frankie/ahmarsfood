import Order from '../models/Order.js';
import { HttpError } from '../utils/httpError.js';

// Day boundaries are in West Africa Time (UTC+1, no daylight saving), which is Lafia's time.
export async function dailySummary(dateInput) {
  const date = dateInput || new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');
  const start = new Date(`${date}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 86400000);
  const orders = await Order.find({ createdAt: { $gte: start, $lt: end }, status: { $ne: 'Cancelled' } }).select('total status paymentMethod paymentStatus');

  const byMethod = {};
  let revenue = 0;
  let paidOrders = 0;
  for (const o of orders) {
    if (o.paymentStatus === 'paid') {
      revenue += o.total;
      paidOrders += 1;
      byMethod[o.paymentMethod] = byMethod[o.paymentMethod] || { orders: 0, amount: 0 };
      byMethod[o.paymentMethod].orders += 1;
      byMethod[o.paymentMethod].amount += o.total;
    }
  }
  return {
    date,
    orders: orders.length,
    delivered: orders.filter((o) => o.status === 'Delivered').length,
    paidOrders,
    revenue,
    byMethod,
  };
}
