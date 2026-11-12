import { auditPage, crossPageChecks } from './checks.js';
import { parseHtml } from './html.js';
import { isAllowed, isInternal, isPageLike, normalizeUrl, parseRobots, parseSitemap, templateFor } from './urls.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// fetcher: { get(url) -> { status, finalUrl, redirects, rawHtml, renderedHtml }, getText(url) -> { status, text } }
// Starts from the sitemap plus the home page, follows internal links, and waits `rateMs` between pages.
export async function crawlSite({ baseUrl, fetcher, rateMs = 1000, maxPages = 200, sleep = wait, log = () => {} }) {
  const base = normalizeUrl(baseUrl, baseUrl);

  const robotsRes = await fetcher.getText(new URL('/robots.txt', base).href);
  const robots = robotsRes.status === 200 ? parseRobots(robotsRes.text) : { allow: [], disallow: [], sitemaps: [] };
  const sitemapLoc = robots.sitemaps[0] || new URL('/sitemap.xml', base).href;
  const smRes = await fetcher.getText(sitemapLoc);
  const sitemapFound = smRes.status === 200;
  const sitemapUrls = sitemapFound ? [...new Set(parseSitemap(smRes.text).map((u) => normalizeUrl(u, base)).filter(Boolean))] : [];

  const sources = new Map(); // url -> Set('sitemap' | 'link' | 'start')
  const queue = [];
  const enqueue = (url, source) => {
    if (!url || !isInternal(url, base) || !isPageLike(url)) return;
    if (!sources.has(url)) { sources.set(url, new Set()); queue.push(url); }
    sources.get(url).add(source);
  };
  enqueue(base, 'start');
  for (const u of sitemapUrls) enqueue(u, 'sitemap');

  const pages = [];
  const blockedSitemapUrls = [];
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (!isAllowed(robots, new URL(url).pathname)) {
      if (sitemapUrls.includes(url)) blockedSitemapUrls.push(url);
      continue;
    }
    if (pages.length) await sleep(rateMs); // crawl-rate limit
    log(`crawling ${url}`);
    const res = await fetcher.get(url);
    const raw = res.rawHtml ? parseHtml(res.rawHtml) : null;
    const rendered = res.renderedHtml ? parseHtml(res.renderedHtml) : null;
    const finalUrl = normalizeUrl(res.finalUrl || url, base) || url;
    const audit = auditPage({ url, status: res.status, finalUrl, redirects: res.redirects || [], raw, rendered });
    pages.push({ url, finalUrl, status: res.status, redirects: (res.redirects || []).map((r) => ({ status: r.status, to: r.to })), ...audit, sources: [...sources.get(url)] });

    for (const href of (rendered || raw)?.links || []) enqueue(normalizeUrl(href, finalUrl), 'link');
    if (finalUrl !== url) enqueue(finalUrl, 'link'); // a redirect target is a real page too
  }
  // `sources` is final only now, so sitemap/orphan checks run after the crawl
  for (const p of pages) p.sources = [...sources.get(p.url)];
  crossPageChecks(pages, { sitemapUrls, sitemapFound, robotsBlockedSitemapUrls: blockedSitemapUrls });
  return { pages, sitemap: { url: sitemapLoc, found: sitemapFound, count: sitemapUrls.length }, robots: { found: robotsRes.status === 200 }, truncated: queue.length > 0 };
}
