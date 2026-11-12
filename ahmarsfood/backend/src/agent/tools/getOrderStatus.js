import { schemas } from '../schemas.js';

// Permissions live in the orders service (customers: own orders only), the same rule the REST API uses.
export const makeGetOrderStatus = ({ orders }) => ({
  name: 'get_order_status',
  label: 'Checking your order…',
  roles: ['customer', 'admin'],
  description: "Get the status of the user's order by order number. With no order number, returns their most recent order.",
  zod: schemas.get_order_status.zod,
  jsonSchema: schemas.get_order_status.json,
  async run(input, { user }) {
    const { order, delivery } = await orders.findOrderForUser(user, { id: input.order_id, orderNo: input.order_no });
    return {
      order_no: order.orderNo,
      status: order.status,
      payment: { method: order.paymentMethod, status: order.paymentStatus },
      total_naira: order.total,
      delivery_fee_naira: order.deliveryFee,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty })),
      estimated_minutes: delivery?.estimatedTime || order.estimatedTime,
      rider_assigned: !!delivery?.rider,
      rider_name: delivery?.rider?.name || null,
      bike_number: delivery?.rider?.bikeNumber || null,
      tracking_page: `/orders/${order._id}`,
    };
  },
});
