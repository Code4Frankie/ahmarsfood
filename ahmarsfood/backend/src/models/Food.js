import mongoose from 'mongoose';
import { FOOD_CATEGORIES } from '../utils/constants.js';

export { FOOD_CATEGORIES };

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // Naira
    category: { type: String, required: true, enum: FOOD_CATEGORIES },
    image: String, // Cloudinary URL only
    imagePublicId: String,
    description: { type: String, default: '' },
    isAvailable: { type: Boolean, default: true },
    prepTime: { type: Number, default: 15 }, // minutes
  },
  { timestamps: true }
);

// Used by the assistant's search (weights: name matters most). Adding an index does not change stored documents.
foodSchema.index({ name: 'text', category: 'text', description: 'text' }, { weights: { name: 5, category: 2, description: 1 }, name: 'food_text' });

export default mongoose.model('Food', foodSchema);
