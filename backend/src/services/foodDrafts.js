import FoodDraft from '../models/FoodDraft.js';

export const createDraft = (fields, user) => FoodDraft.create({ ...fields, createdBy: user._id });
