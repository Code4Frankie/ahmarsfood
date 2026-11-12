// A small, dependency-free HTML reader for exactly what an SEO audit needs. It works on well-formed markup, which is what
// both a Vite build and a browser's serialised DOM (page.content()) produce.
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attrs(str) {
  const out = {};
  for (const m of str.matchAll(ATTR)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

export function parseHtml(rawHtml) {
  const html = String(rawHtml || '').replace(/<!--[\s\S]*?-->/g, '');
  const lower = html.toLowerCase();
  const r = { title: null, description: null, canonical: null, robots: null, h1s: [], images: [], links: [], jsonLd: [], og: {} };
  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(html))) {
    if (m[1]) continue;
    const name = m[2].toLowerCase();
    const a = attrs(m[3]);
    const end = TAG.lastIndex;

    if (name === 'script' || name === 'style' || name === 'title') {
      const close = lower.indexOf(`</${name}`, end);
      const content = html.slice(end, close < 0 ? html.length : close);
      if (name === 'title' && r.title === null) r.title = decode(content).replace(/\s+/g, ' ').trim();
      if (name === 'script' && (a.type || '').toLowerCase() === 'application/ld+json') {
        try { r.jsonLd.push({ data: JSON.parse(content) }); } catch (e) { r.jsonLd.push({ error: e.message }); }
      }
      TAG.lastIndex = close < 0 ? html.length : close; // never parse tags that sit inside script/style text
    } else if (name === 'meta') {
      const key = (a.name || '').toLowerCase();
      if (key === 'description' && r.description === null) r.description = (a.content || '').trim();
      else if (key === 'robots') r.robots = (a.content || '').toLowerCase();
      else if ((a.property || '').startsWith('og:')) r.og[a.property] = a.content || '';
    } else if (name === 'link') {
      if ((a.rel || '').toLowerCase().split(/\s+/).includes('canonical') && r.canonical === null) r.canonical = a.href || '';
    } else if (name === 'h1') {
      const close = lower.indexOf('</h1', end);
      r.h1s.push(decode(html.slice(end, close < 0 ? end : close).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim());
    } else if (name === 'img') {
      r.images.push({ src: a.src || a['data-src'] || '', alt: 'alt' in a ? a.alt : undefined }); // alt="" is valid (decorative); a MISSING alt is the problem
    } else if (name === 'a' && a.href) {
      r.links.push(a.href);
    }
  }
  return r;
}
