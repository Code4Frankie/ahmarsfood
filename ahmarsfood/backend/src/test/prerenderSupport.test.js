import test from 'node:test';
import assert from 'node:assert/strict';
import * as backendSlug from '../seo/slug.js';
import * as frontendSlug from '../../../frontend/src/utils/slug.js';
import { LANDING_PATHS as frontendLanding } from '../../../frontend/src/seo/landing.js';
import { LANDING_PATHS as backendLanding } from '../seo/sitemapPaths.js';
import { templateFor } from '../seo/urls.js';
import { parseHtml } from '../seo/html.js';
import { auditPage } from '../seo/checks.js';
import { buildSitemapXml } from '../seo/sitemap.js';
import { createRebuildTrigger } from '../utils/rebuildTrigger.js';

const NAMES = ['Amala + Ewedu & Gbegiri', 'Pounded Yam + Egusi Soup', 'Jollof Rice + Chicken', 'Yoghurt (Chilled)', 'Kunu Aya', '  Odd   Name!! ', 'Crème Brûlée'];

test('the frontend and backend make identical dish URLs (the sitemap must match the pages)', () => {
  for (const n of NAMES) assert.equal(backendSlug.slugify(n), frontendSlug.slugify(n), n);
  const foods = [{ _id: '2', name: 'Jollof' }, { _id: '1', name: 'Jollof' }, { _id: '3', name: 'Kunu Aya' }];
  assert.deepEqual([...backendSlug.slugMap(foods)], [...frontendSlug.slugMap(foods)]);
  assert.equal(backendSlug.slugify('Amala + Ewedu & Gbegiri'), 'amala-and-ewedu-and-gbegiri');
});

test('duplicate dish names get stable -2 style URLs and can be found again', () => {
  const foods = [{ _id: 'b', name: 'Jollof' }, { _id: 'a', name: 'Jollof' }];
  const m = frontendSlug.slugMap(foods);
  assert.equal(m.get('a'), 'jollof');
  assert.equal(m.get('b'), 'jollof-2');
  assert.equal(frontendSlug.findBySlug(foods, 'jollof-2')._id, 'b');
  assert.equal(frontendSlug.findBySlug(foods, 'nope'), null);
  assert.equal(frontendSlug.slugify('!!!'), 'dish', 'a name with no letters still gets a URL');
});

test('the sitemap lists the same local pages the frontend has', () => {
  assert.deepEqual([...backendLanding].sort(), Object.values(frontendLanding).sort());
});

test('the crawler recognises the new page types', () => {
  const B = 'https://shop.test';
  assert.equal(templateFor(`${B}/menu/jollof-rice-and-chicken`), 'dish pages');
  assert.equal(templateFor(`${B}/food-delivery-lafia`), 'local pages');
  assert.equal(templateFor(`${B}/admin/orders`), 'admin & rider');
  assert.equal(templateFor(`${B}/rider`), 'admin & rider');
  assert.equal(templateFor(`${B}/`), 'home / menu');
});

test('a dish page without its structured data is flagged; with it, it is clean', () => {
  const page = (ld) => parseHtml(`<html><head><title>Jollof Rice + Chicken | Ahmars Food, Lafia</title><meta name="description" content="Jollof Rice + Chicken from Ahmars Food, ₦1,800. Smoky party-style jollof with grilled chicken. Delivery in Lafia."><link rel="canonical" href="https://shop.test/menu/jollof"><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><h1>Jollof</h1></body></html>`);
  const audit = (raw) => auditPage({ url: 'https://shop.test/menu/jollof', status: 200, finalUrl: 'https://shop.test/menu/jollof', raw, rendered: raw });
  const none = audit(page([]));
  assert.ok(none.issues.some((i) => i.code === 'jsonld_missing' && /MenuItem/.test(i.message)));
  const ld = [
    { '@context': 'https://schema.org', '@type': 'MenuItem', name: 'Jollof', offers: { '@type': 'Offer', price: '1800', priceCurrency: 'NGN' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Menu', item: 'https://shop.test/' }, { '@type': 'ListItem', position: 2, name: 'Jollof', item: 'https://shop.test/menu/jollof' }] },
  ];
  assert.deepEqual(audit(page(ld)).issues.map((i) => i.code), []);
});

test('sitemap lists dishes and local pages with escaped URLs', () => {
  const xml = buildSitemapXml('https://shop.test/', [{ path: '/' }, { path: '/food-delivery-lafia' }, { path: '/menu/amala-and-ewedu', lastmod: new Date('2026-11-08T08:00:00Z') }]);
  assert.match(xml, /<loc>https:\/\/shop\.test\/menu\/amala-and-ewedu<\/loc>\s*<lastmod>2026-11-08<\/lastmod>/);
  assert.equal((xml.match(/<url>/g) || []).length, 3);
});

test('rebuild trigger: many menu edits make one request, after the quiet period', async () => {
  const timers = [];
  const calls = [];
  const trigger = createRebuildTrigger({
    url: 'https://hook.test/x', delayMs: 120000,
    fetchFn: async (url, opts) => { calls.push([url, opts.method]); return { status: 201 }; },
    setTimer: (fn, ms) => { const t = { fn, ms, cleared: false, unref() {} }; timers.push(t); return t; },
    clearTimer: (t) => { t.cleared = true; },
    log: { log() {}, error() {} },
  });
  trigger(); trigger(); trigger(); // three quick edits
  assert.equal(timers.length, 3);
  assert.deepEqual(timers.map((t) => t.cleared), [true, true, false], 'each edit restarts the wait');
  assert.equal(calls.length, 0, 'nothing is sent yet');
  await timers[2].fn();
  assert.deepEqual(calls, [['https://hook.test/x', 'POST']]);
  assert.equal(createRebuildTrigger({ url: '', delayMs: 1 })(), false, 'with no hook address it does nothing');
});

test('the rebuild trigger survives a failing hook', async () => {
  const timers = [];
  const errors = [];
  const trigger = createRebuildTrigger({ url: 'https://hook.test/x', delayMs: 1, fetchFn: async () => { throw new Error('offline'); }, setTimer: (fn) => { const t = { fn, unref() {} }; timers.push(t); return t; }, clearTimer() {}, log: { log() {}, error: (...a) => errors.push(a.join(' ')) } });
  trigger();
  await timers[0].fn();
  assert.match(errors[0], /offline/);
});
