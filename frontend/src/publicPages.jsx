import Menu from './pages/Menu.jsx';
import DishPage from './pages/DishPage.jsx';
import Landing from './pages/Landing.jsx';
import { LANDING_PATHS } from './seo/landing.js';

// The pages that are saved as finished HTML at build time (and so can be found by search engines).
// App.jsx and entry-server.jsx both read this list, so they can never drift apart.
export const PUBLIC_ROUTES = [
  { path: '/', element: <Menu /> },
  { path: '/menu/:slug', element: <DishPage /> },
  { path: LANDING_PATHS.lafia, element: <Landing page="lafia" /> },
  { path: LANDING_PATHS.ful, element: <Landing page="ful" /> },
];
