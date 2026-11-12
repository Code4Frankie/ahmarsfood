import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { PrerenderProvider } from './prerender/PrerenderContext.jsx';
import { PUBLIC_ROUTES } from './publicPages.jsx';
import { metaFor } from './seo/meta.js';
import { LANDING_PATHS } from './seo/landing.js';
import { slugMap } from './utils/slug.js';

// Used only at build time by scripts/prerender.mjs. It renders the public pages to HTML strings.
// (Private pages are not imported here: the map library they use needs a browser.)
export function render(url, data) {
  const html = renderToString(
    <PrerenderProvider value={data}>
      <StaticRouter location={url}>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route element={<Layout />}>
                {PUBLIC_ROUTES.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
              </Route>
            </Routes>
          </CartProvider>
        </AuthProvider>
      </StaticRouter>
    </PrerenderProvider>
  );
  return { html, meta: metaFor(url, data) };
}

// Every public URL that should be saved as a finished page.
export function routesFor(data) {
  const dishes = [...slugMap(data.menu.foods).values()].map((slug) => `/menu/${slug}`);
  return ['/', ...dishes, ...Object.values(LANDING_PATHS)];
}
