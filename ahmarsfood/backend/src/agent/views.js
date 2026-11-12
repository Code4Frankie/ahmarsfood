// Small, model-friendly shapes. Only fields the assistant needs; user-written text (order notes, addresses) is left out.
export const foodView = (f) => ({
  id: String(f._id),
  name: f.name,
  category: f.category,
  price_naira: f.price,
  prep_minutes: f.prepTime,
  available: !!f.isAvailable,
  description: (f.description || '').slice(0, 200),
});
