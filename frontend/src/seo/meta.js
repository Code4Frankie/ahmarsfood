import { SITE } from '../siteLinks.js';
import { findBySlug, slugFor } from '../utils/slug.js';
import { LANDING, LANDING_PATHS } from './landing.js';

export const HOME_META = {
  title: 'Ahmars Food: order Nigerian food in Lafia',
  description: 'Order amala, pounded yam, jollof rice and shawarma for delivery around Maraba Akunza and Federal University Lafia. Pay online.',
};
export const DEFAULT_IMAGE = `${SITE.domain}/og-image.png`;

// Cut at a word boundary so titles and descriptions never end mid-word.
function fit(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(' ');
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.-]+$/, '');
}

const crumbs = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
});

export function homeMeta() {
  return { ...HOME_META, canonical: `${SITE.domain}/`, image: DEFAULT_IMAGE, jsonLd: [] };
}

export function dishMeta(food, foods) {
  const url = `${SITE.domain}/menu/${slugFor(food, foods)}`;
  const price = `₦${Number(food.price).toLocaleString('en-NG')}`;
  const extra = food.description ? ` ${food.description}` : '';
  return {
    title: fit(`${food.name} | Ahmars Food, Lafia`, 60),
    description: fit(`${food.name} from Ahmars Food, ${price}.${extra} Delivery in Lafia and around Federal University Lafia.`, 155),
    canonical: url,
    image: food.image || DEFAULT_IMAGE,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'MenuItem',
        name: food.name,
        ...(food.description ? { description: food.description } : {}),
        ...(food.image ? { image: food.image } : {}),
        url,
        offers: { '@type': 'Offer', price: String(food.price), priceCurrency: 'NGN', availability: food.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
      },
      crumbs([{ name: 'Menu', url: `${SITE.domain}/` }, { name: food.name, url }]),
    ],
  };
}

export function landingMeta(key) {
  const p = LANDING[key];
  const url = `${SITE.domain}${p.path}`;
  return { title: p.title, description: p.description, canonical: url, image: DEFAULT_IMAGE, jsonLd: [crumbs([{ name: 'Ahmars Food', url: `${SITE.domain}/` }, { name: p.crumb, url }])] };
}

// One place that decides the tags for a public URL. The pre-render step and the browser both use it.
export function metaFor(pathname, data) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return homeMeta();
  const dish = path.match(/^\/menu\/([^/]+)$/);
  if (dish) {
    const foods = data?.menu?.foods;
    const food = foods && findBySlug(foods, dish[1]);
    return food ? dishMeta(food, foods) : null;
  }
  const key = Object.keys(LANDING_PATHS).find((k) => LANDING_PATHS[k] === path);
  return key ? landingMeta(key) : null;
}
