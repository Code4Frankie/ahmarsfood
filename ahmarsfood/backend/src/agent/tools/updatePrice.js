import { schemas } from '../schemas.js';

// Changing a price affects money, so it is prepared first and applied only after the admin confirms.
export const makeUpdatePrice = ({ foods }) => ({
  name: 'update_price',
  label: 'Preparing the price change…',
  roles: ['admin'],
  confirm: true,
  description: 'Admin only. Prepare a price change for one dish. It is applied only after the admin confirms.',
  zod: schemas.update_price.zod,
  jsonSchema: schemas.update_price.json,
  async prepare({ food_id, new_price }) {
    const food = await foods.getFood(food_id);
    return { summary: `Change the price of "${food.name}" from ₦${food.price.toLocaleString()} to ₦${new_price.toLocaleString()}` };
  },
  async apply({ food_id, new_price }) {
    const { food, before } = await foods.setPrice(food_id, new_price);
    return { food_id: String(food._id), name: food.name, old_price_naira: before, new_price_naira: food.price };
  },
});
