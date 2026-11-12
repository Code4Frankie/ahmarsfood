import { validateJsonLd } from './jsonld.js';
import { normalizeUrl, templateFor } from './urls.js';

export const LIMITS = { titleMin: 15, titleMax: 60, descMin: 70, descMax: 160 };
const EXPECTED_JSONLD = { 'home / menu': ['Restaurant'], 'dish pages': ['MenuItem', 'BreadcrumbList'], 'local pages': ['BreadcrumbList'] }; // structured data we expect per template
const issue = (code, severity, message) => ({ code, severity, message });
const isCloudinary = (src) => /(^|\/\/)res\.cloudinary\.com\//i.test(src);

// Audits ONE page. `raw` = what a crawler sees without JavaScript, `rendered` = after JavaScript runs (null if skipped).
export function auditPage({ url, status, finalUrl, redirects = [], raw, rendered }) {
  const issues = [];
  const template = templateFor(url);
  const metrics = { redirects: redirects.length };

  if (!status) return { template, issues: [issue('fetch_failed', 'error', 'The page could not be fetched (network error, timeout or redirect loop).')], metrics };
  if (redirects.length) issues.push(issue(redirects.length > 1 ? 'redirect_chain' : 'redirect', redirects.length > 1 ? 'warning' : 'info', `Redirects ${redirects.length} time(s) before reaching ${finalUrl}.`));
  if (status >= 400) return { template, issues: [...issues, issue('http_error', 'error', `The page answers with HTTP ${status}.`)], metrics: { ...metrics, status } };
  if (!raw) return { template, issues, metrics };

  const view = rendered || raw; // judge by what a JavaScript-capable crawler such as Google sees
  metrics.noindex = /noindex/.test(view.robots || '');
  if (metrics.noindex) { issues.push(issue('noindex', 'info', 'Marked noindex: it is kept out of search results, so content checks are skipped.')); return { template, issues, metrics }; }

  // Title and description
  metrics.title = view.title || null;
  metrics.titleLength = (view.title || '').length;
  metrics.description = view.description || null;
  metrics.descriptionLength = (view.description || '').length;
  if (!view.title) issues.push(issue('missing_title', 'error', 'The page has no <title>.'));
  else if (metrics.titleLength < LIMITS.titleMin || metrics.titleLength > LIMITS.titleMax) issues.push(issue('title_length', 'warning', `Title is ${metrics.titleLength} characters; aim for ${LIMITS.titleMin}-${LIMITS.titleMax}.`));
  if (!view.description) issues.push(issue('missing_description', 'warning', 'The page has no meta description.'));
  else if (metrics.descriptionLength < LIMITS.descMin || metrics.descriptionLength > LIMITS.descMax) issues.push(issue('description_length', 'info', `Meta description is ${metrics.descriptionLength} characters; aim for ${LIMITS.descMin}-${LIMITS.descMax}.`));

  // Headings
  metrics.h1Count = view.h1s.length;
  if (view.h1s.length === 0) issues.push(issue('missing_h1', 'warning', 'The page has no <h1>.'));
  else if (view.h1s.length > 1) issues.push(issue('multiple_h1', 'info', `The page has ${view.h1s.length} <h1> headings.`));

  // Canonical
  if (!view.canonical) issues.push(issue('missing_canonical', 'warning', 'The page has no canonical link.'));
  else if (normalizeUrl(view.canonical, finalUrl) !== normalizeUrl(finalUrl, finalUrl)) issues.push(issue('canonical_mismatch', 'warning', `Canonical points to ${view.canonical}, not to this page.`));

  // Image alt text (an empty alt="" is fine; a missing alt attribute is not). Cloudinary images are counted separately.
  const missing = view.images.filter((i) => i.alt === undefined);
  const cloud = view.images.filter((i) => isCloudinary(i.src));
  metrics.imageCount = view.images.length;
  metrics.imagesMissingAlt = missing.length;
  metrics.cloudinaryImages = cloud.length;
  metrics.cloudinaryMissingAlt = cloud.filter((i) => i.alt === undefined).length;
  if (missing.length) issues.push(issue('images_missing_alt', 'warning', `${missing.length} of ${view.images.length} images have no alt text (${metrics.cloudinaryMissingAlt} of ${metrics.cloudinaryImages} Cloudinary images).`));

  // Structured data
  const ld = validateJsonLd(view.jsonLd);
  metrics.jsonLdTypes = ld.types;
  issues.push(...ld.issues);
  for (const t of EXPECTED_JSONLD[template] || []) {
    if (!ld.types.includes(t)) issues.push(issue('jsonld_missing', 'warning', `Expected ${t} structured data on this page.`));
  }

  // Client-rendered content: what exists only after JavaScript runs
  if (rendered) {
    const metaGap = !raw.title || !raw.description || !raw.canonical || raw.title !== rendered.title || raw.description !== rendered.description;
    if (metaGap) issues.push(issue('meta_not_prerendered', 'warning', 'Title, description or canonical differ in, or are missing from, the HTML sent before JavaScript runs. Link previews (WhatsApp, Facebook) and non-JavaScript crawlers see the generic version. Pre-rendering or server rendering would fix this.'));
    if (rendered.h1s.length && !raw.h1s.length) issues.push(issue('content_not_prerendered', 'warning', 'The heading and page content only appear after JavaScript runs. Google can render this, but it is slower and less reliable than pre-rendered HTML.'));
  }
  return { template, issues, metrics };
}

// Checks that need several pages at once: duplicates and sitemap coverage.
export function crossPageChecks(pages, { sitemapUrls, sitemapFound, robotsBlockedSitemapUrls = [] }) {
  const add = (p, i) => p.issues.push(i);
  const indexable = pages.filter((p) => p.status >= 200 && p.status < 300 && !p.metrics.noindex && p.finalUrl === p.url);

  for (const field of ['title', 'description']) {
    const groups = new Map();
    for (const p of indexable) if (p.metrics[field]) groups.set(p.metrics[field], [...(groups.get(p.metrics[field]) || []), p]);
    for (const group of groups.values()) if (group.length > 1) for (const p of group) add(p, issue(`duplicate_${field}`, 'warning', `${group.length} pages share this ${field}: ${group.map((g) => new URL(g.url).pathname).join(', ')}.`));
  }

  const inSitemap = new Set(sitemapUrls);
  const home = pages.find((p) => new URL(p.url).pathname === '/') || pages[0];
  if (!sitemapFound && home) add(home, issue('sitemap_missing', 'warning', 'No sitemap.xml was found.'));
  if (sitemapFound) {
    for (const p of indexable) if (!inSitemap.has(p.url)) add(p, issue('not_in_sitemap', 'warning', 'The page can be reached and is indexable but is not listed in the sitemap.'));
    for (const p of pages) {
      if (!inSitemap.has(p.url)) continue;
      if (p.status >= 400 || !p.status) add(p, issue('sitemap_url_error', 'error', 'This sitemap URL does not load correctly.'));
      if (p.metrics.noindex) add(p, issue('sitemap_noindex', 'warning', 'This sitemap URL is marked noindex.'));
      if (!p.sources.includes('link') && !p.sources.includes('start') && !p.metrics.noindex) add(p, issue('orphan_in_sitemap', 'info', 'Listed in the sitemap but no internal link leads to it.'));
    }
  }
  for (const url of robotsBlockedSitemapUrls) {
    pages.push({ url, template: templateFor(url), status: null, finalUrl: url, redirects: [], sources: ['sitemap'], metrics: {}, issues: [issue('blocked_by_robots', 'error', 'This sitemap URL is disallowed in robots.txt.')] });
  }
  return pages;
}

export function countIssues(pages) {
  const c = { error: 0, warning: 0, info: 0 };
  for (const p of pages) for (const i of p.issues) c[i.severity] += 1;
  return c;
}
