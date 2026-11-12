import { schemas } from '../schemas.js';
import { foodView } from '../views.js';

export const makeGetFood = ({ foods }) => ({
  name: 'get_food',
  label: 'Looking up the dish…',
  roles: ['customer', 'admin'],
  description: 'Get full details of one dish by its id.',
  zod: schemas.get_food.zod,
  jsonSchema: schemas.get_food.json,
  async run({ food_id }) {
    return foodView(await foods.getFood(food_id));
  },
});
