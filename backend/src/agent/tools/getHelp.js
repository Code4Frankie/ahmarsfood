import { schemas } from '../schemas.js';

// Ahmarsfood has no returns system, so problems go to the restaurant on WhatsApp with the order number prefilled.
export const makeGetHelp = ({ whatsapp }) => ({
  name: 'get_help',
  label: 'Finding the best way to help…',
  roles: ['customer', 'admin'],
  description: 'For problems with an order, refunds or anything the assistant cannot do: returns a WhatsApp link to the restaurant.',
  zod: schemas.get_help.zod,
  jsonSchema: schemas.get_help.json,
  async run({ topic, order_no }) {
    const text = `Hello Ahmars Food, I need help${order_no ? ` with order ${order_no}` : ''}${topic ? ` (${topic.replace('_', ' ')})` : ''}.`;
    return { whatsapp_link: `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, note: 'Share this link with the user. Refunds are handled by the restaurant.' };
  },
});
