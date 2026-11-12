import mongoose from 'mongoose';
import Food from '../models/Food.js';
import { FOOD_CATEGORIES } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { requestRebuild } from './rebuild.js';

function checkCategory(category) {
  if (category && !FOOD_CATEGORIES.includes(category)) throw new HttpError(400, 'Unknown category');
}

// Public menu (same result the REST endpoint always returned).
export async function listFoods({ category } = {}) {
  checkCategory(category);
  const foods = await Food.find(category ? { category } : {}).sort({ category: 1, name: 1 });
  return { categories: FOOD_CATEGORIES, foods };
}

export async function getFood(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id');
  const food = await Food.findById(id);
  if (!food) throw new HttpError(404, 'Food not found');
  return food;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search used by the assistant. `query` is only ever used as a plain string (never merged into a query object),
// so model-built input cannot smuggle Mongo operators such as $where or $ne.
export async function searchFoods({ query, category, maxPrice, onlyAvailable = true, limit = 6 } = {}) {
  checkCategory(category);
  const base = {};
  if (onlyAvailable) base.isAvailable = true;
  if (category) base.category = category;
  if (Number.isFinite(maxPrice)) base.price = { $lte: maxPrice };
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';

  if (!q) return Food.find(base).sort({ category: 1, name: 1 }).limit(limit).lean();

  const scored = await Food.find({ ...base, $text: { $search: q } }, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
  if (scored.length) return scored;

  // Fallback for partial words ("shaw" -> Shawarma). The term is regex-escaped, so it stays literal text.
  const rx = new RegExp(escapeRegex(q), 'i');
  return Food.find({ ...base, $or: [{ name: rx }, { description: rx }] }).sort({ name: 1 }).limit(limit).lean();
}

export async function getFoodsByIds(ids) {
  return Food.find({ _id: { $in: ids } }).lean();
}

export async function setPrice(id, price) {
  const food = await getFood(id);
  const before = food.price;
  food.price = price;
  await food.save();
  requestRebuild();
  return { food, before };
}

export async function setDescription(id, description) {
  const food = await getFood(id);
  food.description = description;
  await food.save();
  requestRebuild();
  return food;
}
