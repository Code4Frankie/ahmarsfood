import { createContext, useContext } from 'react';

// Holds the menu and config that were used when the page was pre-rendered. On the server it is passed in directly;
// in the browser it comes from window.__PRERENDER__, so the first paint matches the saved HTML.
const Ctx = createContext(null);
export const PrerenderProvider = Ctx.Provider;
export const usePrerender = () => useContext(Ctx);
