# Suggested commits (run `git add` for the listed paths, then commit)

## 1. refactor: move food, order and report logic into services; add menu text index
No behaviour change. The routes now call the services.
- backend/src/utils/constants.js (new)
- backend/src/models/Food.js
- backend/src/services/foods.js, orders.js, reports.js (new)
- backend/src/routes/foods.js, orders.js, admin.js

## 2. feat: shopping assistant backend (read-only tools plus confirmation-gated actions)
Committed together because `defaultRegistry.js` registers all ten tools.
- backend/package.json, backend/.env.example, backend/src/config/env.js, backend/src/app.js
- backend/src/models/AgentLog.js, AgentAction.js, FoodDraft.js
- backend/src/services/agentActions.js, foodDrafts.js
- backend/src/agent/** (schemas, views, prompt, llm, agentLoop, toolRegistry, defaultRegistry, tools/*)
- backend/src/routes/agent.js
- backend/src/test/agentLoop.test.js, agentTools.test.js
- Ahmarsfood.postman_collection.json

## 3. feat: AgentChat widget
- frontend/src/components/AgentChat.jsx (new), Layout.jsx
- frontend/src/api.js, frontend/src/context/CartContext.jsx
- README.md

## 4. feat: SEO foundation
- frontend/index.html, frontend/public/robots.txt, frontend/public/og-image.png, frontend/vercel.json
- frontend/public/favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png
- frontend/src/hooks/usePageMeta.js, frontend/src/pages/Menu.jsx, Cart.jsx, Checkout.jsx, Login.jsx, Register.jsx, Orders.jsx, OrderTracking.jsx
- backend/src/seo/sitemap.js, backend/src/routes/seo.js, backend/src/app.js

## 5. feat: SEO crawler, admin report and suggested text
Committed together because `routes/admin.js` and `AdminSeo.jsx` contain both the report and the suggestion queue.
- backend/src/seo/** (urls, html, jsonld, checks, crawler, fetcher, report, suggest, crawl)
- backend/src/models/SeoRun.js, SeoAudit.js, SeoSuggestion.js
- backend/src/services/seoReport.js, seoSuggestions.js, foods.js
- backend/src/routes/admin.js, backend/src/agent/schemas.js, defaultRegistry.js, tools/getSeoReport.js
- backend/src/config/env.js, backend/.env.example, backend/package.json, backend/Dockerfile.crawler, backend/.dockerignore
- backend/src/test/seo.test.js, seoSuggest.test.js, agentTools.test.js
- frontend/src/pages/AdminSeo.jsx, frontend/src/App.jsx, frontend/src/components/Layout.jsx
- README.md, Ahmarsfood.postman_collection.json

## 6. feat: admin and rider screens, role-based landing, footer profile links
- frontend/src/components/AdminLayout.jsx
- frontend/src/pages/admin/AdminOrders.jsx, AdminMenu.jsx, AdminRiders.jsx, AdminMoney.jsx
- frontend/src/pages/rider/RiderHome.jsx
- frontend/src/hooks/usePoll.js, frontend/src/utils/alert.js, frontend/src/siteLinks.js
- frontend/src/App.jsx, components/Layout.jsx, pages/Login.jsx, pages/Register.jsx
- frontend/index.html (profile links in the structured data)
- README.md

## 7. feat: pre-rendering, dish pages and Lafia / Federal University Lafia pages
- frontend/scripts/prerender.mjs, frontend/src/entry-server.jsx, frontend/src/publicPages.jsx
- frontend/src/pages/DishPage.jsx, Landing.jsx, Menu.jsx; frontend/src/components/FoodCard.jsx, Layout.jsx
- frontend/src/seo/meta.js, landing.js; frontend/src/utils/slug.js; frontend/src/prerender/PrerenderContext.jsx
- frontend/src/hooks/useMenu.js, usePageMeta.js; frontend/src/context/AuthContext.jsx; frontend/src/main.jsx, App.jsx
- frontend/package.json, vercel.json, .gitignore, .env.example, public/robots.txt
- backend/src/seo/slug.js, sitemapPaths.js, urls.js, checks.js; backend/src/routes/seo.js, foods.js
- backend/src/utils/rebuildTrigger.js, backend/src/services/rebuild.js, foods.js; backend/src/config/env.js, .env.example
- backend/src/test/prerenderSupport.test.js
- README.md

## 8. fix: sharper header logo, readable footer logo, real-logo favicon and link-preview image
- frontend/public/logo-header.png, logo-footer.png, favicon.ico, favicon-32.png, icon-192.png, icon-512.png, apple-touch-icon.png, og-image.png
- frontend/brand/ahmars-logo-original.jpg
- frontend/src/components/Layout.jsx, frontend/index.html
- README.md

## 9. fix: phone header keeps its links on one line
- frontend/src/components/Layout.jsx
