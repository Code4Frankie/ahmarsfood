const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// entries: [{ path: '/', lastmod: Date | undefined }]
export function buildSitemapXml(baseUrl, entries) {
  const base = baseUrl.replace(/\/+$/, '');
  const urls = entries.map((e) => `  <url>\n    <loc>${esc(base + e.path)}</loc>${e.lastmod ? `\n    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
