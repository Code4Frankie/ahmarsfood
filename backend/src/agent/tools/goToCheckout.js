import { schemas } from '../schemas.js';

// Money is involved, so this is confirmation-gated. Confirming only OPENS the existing checkout page, where the
// customer pins their address and pays by card or bank transfer. The assistant never sees or handles card data.
export const makeGoToCheckout = () => ({
  name: 'go_to_checkout',
  label: 'Preparing checkout…',
  roles: ['customer', 'admin'],
  confirm: true,
  clientAction: true,
  description: 'Take the user to the secure checkout page (needs their confirmation). Use after they have items in their cart and want to order.',
  zod: schemas.go_to_checkout.zod,
  jsonSchema: schemas.go_to_checkout.json,
  async prepare() {
    return { summary: 'Open checkout to choose your delivery pin and payment method' };
  },
  async apply() {
    return { client_action: { type: 'navigate', to: '/checkout' } };
  },
});
