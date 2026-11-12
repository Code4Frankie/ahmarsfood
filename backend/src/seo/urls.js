const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

// One canonical spelling per URL so "/login", "/login/" and "/login#x" count as the same page.
export function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.href;
  } catch {
    return null;
  }
}

export const isInternal = (url, baseUrl) => new URL(url).origin === new URL(baseUrl).origin;
export const isPageLike = (url) => !/\.(png|jpe?g|gif|webp|svg|ico|css|js|json|pdf|xml|txt|woff2?|map|mp4)$/i.test(new URL(url).pathname);

// Groups pages by the React route they come from, so the report reads "what is wrong with which kind of page".
export function templateFor(url) {
  const p = new URL(url).pathname;
  if (p === '/') return 'home / menu';
  if (/^\/menu\/[^/]+$/.test(p)) return 'dish pages';
  if (/^\/food-delivery-/.test(p)) return 'local pages';
  if (/^\/(login|register)$/.test(p)) return 'account';
  if (/^\/(cart|checkout)$/.test(p)) return 'cart & checkout';
  if (/^\/orders(\/|$)/.test(p)) return 'orders';
  if (/^\/(admin|rider)(\/|$)/.test(p)) return 'admin & rider';
  return 'other';
}

export const parseSitemap = (xml) => [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decode(m[1]));

// Only the "User-agent: *" group matters for our own check. Consecutive User-agent lines share one group of rules.
export function parseRobots(text) {
  const out = { allow: [], disallow: [], sitemaps: [] };
  let agents = [];
  let lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const i = line.indexOf(':');
    if (!line || i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) agents = [];
      agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') out.sitemaps.push(val);
    else if (agents.includes('*') && val && key === 'disallow') out.disallow.push(val);
    else if (agents.includes('*') && val && key === 'allow') out.allow.push(val);
  }
  return out;
}

// Longest matching rule wins; Allow wins a tie (same rule Google documents).
export function isAllowed(robots, path) {
  const best = (rules) => rules.filter((r) => path.startsWith(r)).reduce((m, r) => Math.max(m, r.length), -1);
  const d = best(robots.disallow);
  return d < 0 || best(robots.allow) >= d;
}
