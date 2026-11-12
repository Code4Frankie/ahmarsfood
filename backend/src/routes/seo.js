import { Router } from 'express';
import Food from '../models/Food.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildSitemapXml } from '../seo/sitemap.js';
import { slugMap } from '../seo/slug.js';
import { LANDING_PATHS } from '../seo/sitemapPaths.js';

const router = Router();

// Public. Vercel serves it at /sitemap.xml (see frontend/vercel.json). Lists the home page, the two local pages and one page
// per dish, with the date the menu last changed.
router.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const foods = await Food.find().select('name updatedAt').lean();
  const slugs = slugMap(foods);
  const latest = foods.reduce((m, f) => (f.updatedAt > m ? f.updatedAt : m), new Date(0));
  const entries = [
    { path: '/', lastmod: foods.length ? latest : undefined },
    ...LANDING_PATHS.map((path) => ({ path })),
    ...foods.map((f) => ({ path: `/menu/${slugs.get(String(f._id))}`, lastmod: f.updatedAt })),
  ];
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(buildSitemapXml(env.frontendUrls[0], entries));
}));

export default router;
