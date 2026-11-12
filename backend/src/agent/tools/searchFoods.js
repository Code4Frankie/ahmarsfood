import { schemas } from '../schemas.js';
import { foodView } from '../views.js';

export const makeSearchFoods = ({ foods }) => ({
  name: 'search_foods',
  label: 'Searching the menu…',
  roles: ['customer', 'admin'],
  description: 'Search the Ahmars Food menu by words, category and/or maximum price. Returns up to 10 available dishes.',
  zod: schemas.search_foods.zod,
  jsonSchema: schemas.search_foods.json,
  async run(input) {
    const rows = await foods.searchFoods({ query: input.query, category: input.category, maxPrice: input.max_price, limit: input.limit });
    return { count: rows.length, foods: rows.map(foodView) };
  },
});
