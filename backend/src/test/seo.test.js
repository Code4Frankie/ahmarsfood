import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, templateFor, parseRobots, isAllowed, parseSitemap } from '../seo/urls.js';
import { parseHtml } from '../seo/html.js';
import { validateJsonLd } from '../seo/jsonld.js';
import { auditPage } from '../seo/checks.js';
import { crawlSite } from '../seo/crawler.js';
import { groupReport } from '../seo/report.js';
import { buildSitemapXml } from '../seo/sitemap.js';

const BASE = 'https://shop.test';
const codes = (page) => page.issues.map((i) => i.code).sort();

// ---------- html fixtures ----------
const GOOD_LD = { '@context': 'https://schema.org', '@type': 'Restaurant', name: 'Ahmars Food', address: 'Lafia' };
function html({ title = 'Ahmars Food: order Nigerian food in Lafia', desc = 'Order amala, jollof rice and shawarma for delivery around Maraba Akunza and Federal University Lafia.', canonical = `${BASE}/`, h1 = 'Home cooking', robots, imgs = '', ld = GOOD_LD, links = '', extraHead = '' } = {}) {
  return `<!doctype html><html><head>${title === null ? '' : `<title>${title}</title>`}${desc === null ? '' : `<meta name="description" content="${desc}">`}${canonical === null ? '' : `<link rel="canonical" href="${canonical}">`}${robots ? `<meta name="robots" content="${robots}">` : ''}${ld ? `<script type="application/ld+json">${typeof ld === 'string' ? ld : JSON.stringify(ld)}</script>` : ''}${extraHead}</head><body>${h1 === null ? '' : `<h1>${h1}</h1>`}${imgs}${links}</body></html>`;
}

test('urls: normalising, templates, sitemap and robots parsing', () => {
  assert.equal(normalizeUrl('/login/#top', BASE), `${BASE}/login`);
  assert.equal(normalizeUrl('mailto:a@b.c', BASE), null);
  assert.equal(templateFor(`${BASE}/`), 'home / menu');
  assert.equal(templateFor(`${BASE}/orders/abc`), 'orders');
  assert.deepEqual(parseSitemap('<urlset><url><loc> https://a.test/x?a=1&amp;b=2 </loc></url></urlset>'), ['https://a.test/x?a=1&b=2']);
  const r = parseRobots('User-agent: Googlebot\nDisallow: /g\n\nUser-agent: *\nUser-agent: other\nDisallow: /cart\nAllow: /cart/public\nSitemap: https://a.test/sitemap.xml');
  assert.deepEqual(r.disallow, ['/cart']);
  assert.equal(isAllowed(r, '/cart'), false);
  assert.equal(isAllowed(r, '/cart/public'), true, 'longer Allow beats Disallow');
  assert.equal(isAllowed(r, '/g'), true, 'rules for other agents do not apply');
  assert.deepEqual(r.sitemaps, ['https://a.test/sitemap.xml']);
});

test('html reader: title, meta, canonical, h1, images, links, json-ld', () => {
  const p = parseHtml(html({
    imgs: '<img src="https://res.cloudinary.com/x/a.jpg" alt="Jollof"><img src="/b.png"><img src="/c.png" alt="">',
    links: '<a href="/login">Log in</a><a href=\'/cart\'>Cart</a>',
    h1: 'Home <span>cooking</span>',
    extraHead: '<meta property="og:title" content="OG">',
  }));
  assert.equal(p.title, 'Ahmars Food: order Nigerian food in Lafia');
  assert.equal(p.canonical, `${BASE}/`);
  assert.deepEqual(p.h1s, ['Home cooking']);
  assert.deepEqual(p.images.map((i) => i.alt), ['Jollof', undefined, ''], 'missing alt is undefined, empty alt is kept');
  assert.deepEqual(p.links, ['/login', '/cart']);
  assert.equal(p.og['og:title'], 'OG');
  assert.equal(p.jsonLd[0].data['@type'], 'Restaurant');
});

test('html reader: text inside scripts, comments and quoted ">" does not confuse it', () => {
  const p = parseHtml('<!-- <h1>ghost</h1> --><script>var s = "<h1>fake</h1><title>no</title>";</script><a href="/x" title="a > b">x</a><h1>Real</h1><script type="application/ld+json">{bad json</script>');
  assert.deepEqual(p.h1s, ['Real']);
  assert.equal(p.title, null);
  assert.deepEqual(p.links, ['/x']);
  assert.ok(p.jsonLd[0].error, 'invalid JSON-LD is reported, not thrown');
});

// ---------- json-ld ----------
const ld = (...nodes) => validateJsonLd(nodes.map((data) => ({ data })));
const ids = (r) => r.issues.map((i) => i.code);
test('json-ld: Product, Offer, BreadcrumbList and Restaurant rules', () => {
  assert.deepEqual(ids(ld(GOOD_LD)), []);
  assert.deepEqual(ids(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Jollof', offers: { '@type': 'Offer', price: '1800', priceCurrency: 'NGN' } })), []);
  assert.ok(ids(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Jollof' })).includes('jsonld_product_offer_missing'));
  assert.ok(ids(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'Jollof', offers: { '@type': 'Offer', price: '1800' } })).includes('jsonld_offer_invalid'), 'Offer without currency');
  assert.ok(ids(ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', name: 'Home' }] })).includes('jsonld_breadcrumb_invalid'), 'no position');
  assert.deepEqual(ids(ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home' }] })), []);
  assert.ok(ids(ld({ '@context': 'https://schema.org', '@type': 'Restaurant', name: 'X' })).includes('jsonld_restaurant_incomplete'));
  assert.ok(ids(ld({ '@type': 'Restaurant', name: 'X', address: 'Y' })).includes('jsonld_context'));
  assert.deepEqual(ids(ld({ '@context': 'https://schema.org', '@graph': [GOOD_LD] })), [], '@graph is unwrapped');
  assert.ok(ids(validateJsonLd([{ error: 'Unexpected token' }])).includes('jsonld_invalid'));
});

// ---------- single-page audit ----------
const audit = (over = {}) => {
  const raw = parseHtml(over.rawHtml ?? html());
  const rendered = over.renderedHtml === null ? null : parseHtml(over.renderedHtml ?? over.rawHtml ?? html());
  return auditPage({ url: `${BASE}/`, status: 200, finalUrl: `${BASE}/`, redirects: [], raw, rendered, ...over.page });
};

test('audit: a healthy page has no issues', () => {
  const a = audit();
  assert.deepEqual(a.issues, []);
  assert.equal(a.metrics.titleLength > 15, true);
});

test('audit: detects missing and badly sized title, description, h1 and canonical', () => {
  assert.ok(codes(audit({ rawHtml: html({ title: null }) })).includes('missing_title'));
  assert.ok(codes(audit({ rawHtml: html({ title: 'Hi' }) })).includes('title_length'));
  assert.ok(codes(audit({ rawHtml: html({ desc: null }) })).includes('missing_description'));
  assert.ok(codes(audit({ rawHtml: html({ desc: 'Too short.' }) })).includes('description_length'));
  assert.ok(codes(audit({ rawHtml: html({ h1: null }) })).includes('missing_h1'));
  assert.ok(codes(audit({ rawHtml: html({ canonical: null }) })).includes('missing_canonical'));
  assert.ok(codes(audit({ rawHtml: html({ canonical: `${BASE}/other` }) })).includes('canonical_mismatch'));
});

test('audit: image alt coverage counts Cloudinary images separately', () => {
  const a = audit({ rawHtml: html({ imgs: '<img src="https://res.cloudinary.com/d/1.jpg"><img src="https://res.cloudinary.com/d/2.jpg" alt="ok"><img src="/x.png"><img src="/y.png" alt="">' }) });
  assert.equal(a.metrics.imageCount, 4);
  assert.equal(a.metrics.imagesMissingAlt, 2);
  assert.equal(a.metrics.cloudinaryImages, 2);
  assert.equal(a.metrics.cloudinaryMissingAlt, 1);
  assert.match(a.issues.find((i) => i.code === 'images_missing_alt').message, /1 of 2 Cloudinary/);
});

test('audit: expected structured data and invalid json-ld are reported', () => {
  assert.ok(codes(audit({ rawHtml: html({ ld: null }) })).includes('jsonld_missing'));
  assert.ok(codes(audit({ rawHtml: html({ ld: '{broken' }) })).includes('jsonld_invalid'));
});

test('audit: http errors, redirects and noindex', () => {
  assert.deepEqual(codes(audit({ page: { status: 404 } })), ['http_error']);
  assert.deepEqual(codes(audit({ page: { status: 0 } })), ['fetch_failed']);
  assert.ok(codes(audit({ page: { redirects: [{ status: 301 }, { status: 302 }] } })).includes('redirect_chain'));
  const n = audit({ rawHtml: html({ robots: 'noindex, nofollow', title: null }) });
  assert.deepEqual(codes(n), ['noindex'], 'content checks are skipped for noindex pages');
});

test('audit: flags content that only exists after JavaScript runs (client-rendered React)', () => {
  const shell = html({ title: 'Ahmars Food', desc: null, canonical: null, h1: null, ld: null });
  const a = audit({ rawHtml: shell, renderedHtml: html() });
  assert.ok(codes(a).includes('meta_not_prerendered'));
  assert.ok(codes(a).includes('content_not_prerendered'));
  assert.ok(!codes(audit({ rawHtml: html(), renderedHtml: html() })).includes('meta_not_prerendered'), 'identical raw and rendered is fine');
});

// ---------- whole crawl, against a fake site ----------
function fakeSite() {
  const home = html({ links: '<a href="/login">Log in</a><a href="/missing">?</a><a href="/old">old</a><a href="/cart">cart</a>' });
  const pages = {
    '/': { html: home },
    '/login': { html: html({ title: 'Log in to Ahmars Food', canonical: `${BASE}/login`, robots: 'noindex, follow', h1: 'Log in' }) },
    '/orphan': { html: html({ canonical: `${BASE}/orphan`, h1: 'Orphan' }) }, // same title+description as home
    '/missing': { status: 404, html: '<h1>nope</h1>' },
    '/old': { status: 301, to: `${BASE}/login` },
    '/cart': { html: html() },
  };
  const requested = [];
  const resolve = (url, redirects = []) => {
    const path = new URL(url).pathname;
    const p = pages[path];
    if (!p) return { status: 404, finalUrl: url, redirects, rawHtml: '', renderedHtml: null };
    if (p.to) return resolve(p.to, [...redirects, { status: p.status, from: url, to: p.to }]);
    return { status: p.status || 200, finalUrl: url, redirects, rawHtml: p.html, renderedHtml: p.html };
  };
  const files = {
    '/robots.txt': 'User-agent: *\nDisallow: /cart\nSitemap: ' + `${BASE}/sitemap.xml`,
    '/sitemap.xml': `<urlset><url><loc>${BASE}/</loc></url><url><loc>${BASE}/orphan</loc></url><url><loc>${BASE}/cart</loc></url></urlset>`,
  };
  return {
    requested,
    get: async (url) => { requested.push(url); return resolve(url); },
    getText: async (url) => { const t = files[new URL(url).pathname]; return t ? { status: 200, text: t } : { status: 404, text: '' }; },
  };
}

test('crawl: follows sitemap and links, respects robots.txt and the crawl-rate limit', async () => {
  const f = fakeSite();
  const sleeps = [];
  const out = await crawlSite({ baseUrl: BASE, fetcher: f, rateMs: 250, sleep: async (ms) => sleeps.push(ms) });
  const by = Object.fromEntries(out.pages.map((p) => [new URL(p.url).pathname, p]));

  assert.ok(!f.requested.some((u) => u.endsWith('/cart')), '/cart is disallowed, so it is never fetched');
  assert.ok(by['/cart'], 'but a disallowed sitemap URL is reported');
  assert.deepEqual(codes(by['/cart']), ['blocked_by_robots']);
  assert.deepEqual(Object.keys(by).sort(), ['/', '/cart', '/login', '/missing', '/old', '/orphan']);
  assert.equal(sleeps.length, out.pages.filter((p) => p.status !== null).length - 1, 'waits between pages, not before the first');
  assert.ok(sleeps.every((ms) => ms === 250));

  assert.deepEqual(codes(by['/missing']), ['http_error']);
  assert.ok(codes(by['/old']).includes('redirect'));
  assert.equal(by['/old'].finalUrl, `${BASE}/login`);
  assert.ok(codes(by['/login']).includes('noindex'));
  // home and /orphan share a title and description; /orphan is in the sitemap but no page links to it
  assert.ok(codes(by['/']).includes('duplicate_title') && codes(by['/orphan']).includes('duplicate_description'));
  assert.ok(codes(by['/orphan']).includes('orphan_in_sitemap'));
  assert.ok(!codes(by['/']).includes('not_in_sitemap'));
  assert.ok(!codes(by['/']).includes('orphan_in_sitemap'), 'the start page is not an orphan');
  assert.equal(out.sitemap.found, true);
  assert.equal(by['/'].template, 'home / menu');
});

test('crawl: a site with no sitemap is flagged, and maxPages stops the crawl', async () => {
  const f = fakeSite();
  const noSitemap = { ...f, getText: async (url) => (url.endsWith('/sitemap.xml') ? { status: 404, text: '' } : f.getText(url)) };
  const out = await crawlSite({ baseUrl: BASE, fetcher: noSitemap, rateMs: 0, sleep: async () => {}, maxPages: 2 });
  assert.equal(out.pages.length, 2);
  assert.equal(out.truncated, true);
  assert.ok(codes(out.pages[0]).includes('sitemap_missing'));
});

// ---------- report grouping and history ----------
test('report: groups by template and shows new and fixed issues since the last run', () => {
  const mk = (url, template, ...cs) => ({ url, template, issues: cs.map((c) => ({ code: c, severity: c === 'http_error' ? 'error' : 'warning', message: c })) });
  const previous = [mk('/a', 'home / menu', 'missing_h1'), mk('/b', 'other', 'http_error')];
  const latest = [mk('/a', 'home / menu', 'missing_h1', 'missing_description'), mk('/b', 'other')];
  const r = groupReport(latest, previous, { id: 'r2' });
  assert.equal(r.totals.warning, 2);
  assert.equal(r.templates[0].template, 'home / menu');
  assert.deepEqual(r.changes.newIssues.map((c) => c.code), ['missing_description']);
  assert.deepEqual(r.changes.fixedIssues.map((c) => c.code), ['http_error']);
  assert.equal(groupReport(latest).changes.compared, false);
});

test('sitemap xml is escaped and includes lastmod', () => {
  const xml = buildSitemapXml('https://a.test/', [{ path: '/?a=1&b=2', lastmod: new Date('2026-11-05T10:00:00Z') }]);
  assert.match(xml, /<loc>https:\/\/a\.test\/\?a=1&amp;b=2<\/loc>/);
  assert.match(xml, /<lastmod>2026-11-05<\/lastmod>/);
});
