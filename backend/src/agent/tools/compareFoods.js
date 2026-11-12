import { schemas } from '../schemas.js';
import { foodView } from '../views.js';
import { HttpError } from '../../utils/httpError.js';

export const makeCompareFoods = ({ foods }) => ({
  name: 'compare_foods',
  label: 'Comparing dishes…',
  roles: ['customer', 'admin'],
  description: 'Compare 2 to 4 dishes side by side (price and preparation time). Returns which is cheapest and which is fastest.',
  zod: schemas.compare_foods.zod,
  jsonSchema: schemas.compare_foods.json,
  async run({ food_ids }) {
    const ids = [...new Set(food_ids)];
    if (ids.length < 2) throw new HttpError(400, 'Pick two different dishes to compare');
    const rows = await foods.getFoodsByIds(ids);
    if (rows.length !== ids.length) throw new HttpError(404, 'One of those dishes no longer exists');
    const dishes = rows.map(foodView);
    const by = (key) => dishes.reduce((a, b) => (b[key] < a[key] ? b : a)).id;
    return { dishes, cheapest_id: by('price_naira'), fastest_id: by('prep_minutes') };
  },
});
