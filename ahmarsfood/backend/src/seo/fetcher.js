const REDIRECTS = [301, 302, 303, 307, 308];

// Real fetcher. Raw HTML = what a crawler gets without JavaScript. With renderJs, Playwright (headless Chromium) also
// loads the page, which is what Google sees for a React app. Playwright is imported only when needed, so the web service
// never has to install it (the crawler's Docker image does).
export function createFetcher({ renderJs = true, timeoutMs = 20000, userAgent = 'AhmarsFoodSEOBot/1.0' } = {}) {
  let browser;

  async function rawGet(url, { asText = false } = {}) {
    const redirects = [];
    let current = url;
    for (let i = 0; i <= 5; i += 1) {
      const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(timeoutMs) });
      if (REDIRECTS.includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) break;
        const next = new URL(loc, current).href;
        redirects.push({ status: res.status, from: current, to: next });
        current = next;
        continue;
      }
      const type = res.headers.get('content-type') || '';
      const text = asText || type.includes('html') ? await res.text() : '';
      return { status: res.status, finalUrl: current, redirects, text, isHtml: type.includes('html') };
    }
    return { status: 0, finalUrl: current, redirects, text: '', isHtml: false };
  }

  async function render(url) {
    if (!browser) {
      const { chromium } = await import('playwright');
      browser = await chromium.launch();
    }
    const context = await browser.newContext({ userAgent });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
      return await page.content();
    } finally {
      await context.close();
    }
  }

  return {
    async get(url) {
      const raw = await rawGet(url).catch(() => ({ status: 0, finalUrl: url, redirects: [], text: '', isHtml: false }));
      let renderedHtml = null;
      if (renderJs && raw.status >= 200 && raw.status < 300 && raw.isHtml) renderedHtml = await render(raw.finalUrl).catch(() => null);
      return { status: raw.status, finalUrl: raw.finalUrl, redirects: raw.redirects, rawHtml: raw.text, renderedHtml };
    },
    async getText(url) {
      const r = await rawGet(url, { asText: true }).catch(() => ({ status: 0, text: '' }));
      return { status: r.status, text: r.text };
    },
    async close() { await browser?.close(); },
  };
}
