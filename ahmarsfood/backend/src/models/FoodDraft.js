import mongoose from 'mongoose';
import { FOOD_CATEGORIES } from '../utils/constants.js';

// Suggested menu items. Nothing here is visible to customers: an admin reviews a draft and publishes it
// through the normal food endpoint.
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: FOOD_CATEGORIES, required: true },
  price: { type: Number, min: 0, required: true },
  description: { type: String, default: '' },
  prepTime: { type: Number, default: 15 },
  status: { type: String, enum: ['draft', 'published', 'discarded'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('FoodDraft', schema);
