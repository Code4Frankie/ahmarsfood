import { useEffect } from 'react';
import { SITE } from '../siteLinks.js';
import { DEFAULT_IMAGE } from '../seo/meta.js';

export { HOME_META } from '../seo/meta.js';

function setAttrTag(selector, create, attr, content) {
  let el = document.head.querySelector(selector);
  if (!content) { el?.remove(); return; }
  if (!el) { el = document.createElement(create.tag); Object.entries(create.attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); }
  el.setAttribute(attr, content);
}

// Sets the tab title and the tags search engines and link previews read, for the page being shown. Pages that are
// pre-rendered already have the same tags in their saved HTML; this keeps them right while people move around the app.
// Private pages (cart, account, orders, admin, rider) are marked noindex so they stay out of search results.
export function usePageMeta({ title, description, noindex = false, canonical, image, jsonLd }) {
  const ld = jsonLd && jsonLd.length ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const url = canonical || `${SITE.domain}/`;
    document.title = title;
    setAttrTag('meta[name="description"]', { tag: 'meta', attrs: { name: 'description' } }, 'content', description);
    setAttrTag('meta[name="robots"]', { tag: 'meta', attrs: { name: 'robots' } }, 'content', noindex ? 'noindex, nofollow' : 'index, follow');
    setAttrTag('link[rel="canonical"]', { tag: 'link', attrs: { rel: 'canonical' } }, 'href', url);
    setAttrTag('meta[property="og:title"]', { tag: 'meta', attrs: { property: 'og:title' } }, 'content', title);
    setAttrTag('meta[property="og:description"]', { tag: 'meta', attrs: { property: 'og:description' } }, 'content', description);
    setAttrTag('meta[property="og:url"]', { tag: 'meta', attrs: { property: 'og:url' } }, 'content', url);
    setAttrTag('meta[property="og:image"]', { tag: 'meta', attrs: { property: 'og:image' } }, 'content', image || DEFAULT_IMAGE);
    let script = document.head.querySelector('script#page-jsonld');
    if (!ld) script?.remove();
    else {
      if (!script) { script = document.createElement('script'); script.id = 'page-jsonld'; script.type = 'application/ld+json'; document.head.appendChild(script); }
      script.textContent = ld;
    }
  }, [title, description, noindex, canonical, image, ld]);
}
