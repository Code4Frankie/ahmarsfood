import { schemas } from '../schemas.js';
import { HttpError } from '../../utils/httpError.js';

// The cart lives in the customer's browser, so this tool checks the dishes and then asks the React app to add them
// (client_action). It cannot place an order or take payment.
export const makeAddToCart = ({ foods }) => ({
  name: 'add_to_cart',
  label: 'Adding to your cart…',
  roles: ['customer', 'admin'],
  clientAction: true,
  description: "Add available dishes to the user's cart. Does not place an order; the user still checks out themselves.",
  zod: schemas.add_to_cart.zod,
  jsonSchema: schemas.add_to_cart.json,
  async run({ items }) {
    const qty = new Map();
    for (const i of items) qty.set(i.food_id, Math.min(20, (qty.get(i.food_id) || 0) + i.qty));
    const rows = await foods.getFoodsByIds([...qty.keys()]);
    if (rows.length !== qty.size) throw new HttpError(404, 'One of those dishes no longer exists');
    const off = rows.filter((f) => !f.isAvailable);
    if (off.length) throw new HttpError(409, `Not available right now: ${off.map((f) => f.name).join(', ')}`);
    const added = rows.map((f) => ({ id: String(f._id), name: f.name, qty: qty.get(String(f._id)), price_naira: f.price }));
    return {
      added,
      note: "These items are being added to the user's cart on their screen. Tell them to open the cart to check out.",
      // name and price are for display in the cart only; the server re-prices the order at checkout
      client_action: { type: 'add_to_cart', items: added.map((a) => ({ food_id: a.id, name: a.name, price: a.price_naira, qty: a.qty })) },
    };
  },
});
