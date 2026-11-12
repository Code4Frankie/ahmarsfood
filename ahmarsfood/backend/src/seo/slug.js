// URL names for dishes: "Amala + Ewedu & Gbegiri" -> "amala-and-ewedu-and-gbegiri".
// The backend has a copy (backend/src/seo/slug.js) for the sitemap; a test keeps the two identical.
export function slugify(name) {
  return String(name).toLowerCase().replace(/&/g, ' and ').replace(/\+/g, ' and ').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'dish';
}

// Unique slug for every dish in a fixed order, so two dishes with the same name get -2, -3 and URLs stay stable.
export function slugMap(foods) {
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name) || String(a._id).localeCompare(String(b._id)));
  const used = new Set();
  const out = new Map();
  for (const f of sorted) {
    const base = slugify(f.name);
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    out.set(String(f._id), slug);
  }
  return out;
}

export const slugFor = (food, foods) => slugMap(foods).get(String(food._id));
export const findBySlug = (foods, slug) => {
  const map = slugMap(foods);
  return foods.find((f) => map.get(String(f._id)) === slug) || null;
};
