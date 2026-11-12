// Runs after the two Vite builds (see "build" in package.json). It saves the public pages as finished HTML:
//   dist/index.html, dist/menu/<dish>/index.html, dist/food-delivery-lafia/index.html, ...
// The untouched app shell is kept as dist/app-shell.html and serves every other route (cart, orders, admin...).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.DIST_DIR || path.join(root, 'dist');
const SSR = process.env.SSR_DIR || path.join(root, 'dist-ssr');
const API = (process.env.PRERENDER_API_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stop(message) {
  if (process.env.PRERENDER_OPTIONAL === 'true') { console.warn(`PRE-RENDER SKIPPED: ${message}`); process.exit(0); }
  console.error(`\nPRE-RENDER FAILED: ${message}\nThe previous deployment stays live. (Set PRERENDER_OPTIONAL=true to ship without pre-rendering instead.)\n`);
  process.exit(1);
}

// The API may be waking up (Render), so retry for about a minute.
const TRIES = Number(process.env.PRERENDER_TRIES || 6);
const WAIT_MS = Number(process.env.PRERENDER_RETRY_MS || 10000);
async function getJson(url, tries = TRIES) {
  let last;
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      console.log(`  ${url} not ready (${err.message}), try ${i}/${tries}`);
      if (i < tries) await sleep(WAIT_MS);
    }
  }
  throw last;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// Remove the generic tags from the template, then add this page's own.
const GENERIC = [/<title>[\s\S]*?<\/title>\s*/i, /<meta\s+name="description"[^>]*>\s*/i, /<link\s+rel="canonical"[^>]*>\s*/i, /<meta\s+property="og:[^"]*"[^>]*>\s*/gi, /<meta\s+name="twitter:card"[^>]*>\s*/i];

function headTags(meta, data) {
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(meta.canonical)}" />`,
    '<meta name="robots" content="index, follow" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Ahmars Food" />',
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(meta.canonical)}" />`,
    `<meta property="og:image" content="${esc(meta.image)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    meta.jsonLd?.length ? `<script type="application/ld+json" id="page-jsonld">${json(meta.jsonLd)}</script>` : '',
    `<script>window.__PRERENDER__=${json(data)}</script>`,
  ].filter(Boolean).map((t) => `    ${t}`).join('\n');
}

function build(template, html, meta, data) {
  let page = GENERIC.reduce((acc, re) => acc.replace(re, ''), template);
  if (!page.includes('<div id="root"></div>')) throw new Error('index.html has no empty <div id="root"></div> to fill');
  page = page.replace('<div id="root"></div>', () => `<div id="root">${html}</div>`);
  return page.replace('</head>', () => `${headTags(meta, data)}\n  </head>`);
}

async function main() {
  if (!API || API.startsWith('/')) stop('set PRERENDER_API_URL (or VITE_API_URL) to the full API address, for example https://api.ahmarsfood.frankiecode.org.ng/api');

  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  // The shell serves every private or unknown route (login, cart, orders, admin...). Marking it noindex in the raw HTML keeps
  // crawlers that do not run JavaScript from treating those URLs as copies of the home page. The app sets the right tag itself.
  await writeFile(path.join(DIST, 'app-shell.html'), template.replace('</head>', () => '    <meta name="robots" content="noindex, nofollow" />\n  </head>'));

  console.log(`Pre-rendering from ${API}`);
  let data;
  try {
    const [menu, config] = await Promise.all([getJson(`${API}/foods`), getJson(`${API}/config`)]);
    data = { menu, config };
  } catch (err) {
    stop(`could not read the menu from the API (${err.message})`);
  }
  if (!data.menu.foods?.length) stop('the menu is empty, so there is nothing to pre-render');

  const { render, routesFor } = await import(pathToFileURL(path.join(SSR, 'entry-server.js')).href);
  const urls = routesFor(data);
  for (const url of urls) {
    const { html, meta } = render(url, data);
    if (!meta) throw new Error(`No page tags for ${url}`);
    if (!html.includes('<h1')) throw new Error(`Rendered nothing useful for ${url} (no heading found)`);
    const file = url === '/' ? path.join(DIST, 'index.html') : path.join(DIST, url, 'index.html');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, build(template, html, meta, data));
    console.log(`  saved ${url}`);
  }
  console.log(`Pre-rendered ${urls.length} pages.`);
}

main().catch((err) => stop(err.message));
