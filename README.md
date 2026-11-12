# Ahmarsfood: backend API + customer web app

Ahmars Food, Maraba Akunza, Federal University Lafia and Lafia town.
Backend: Node + Express + Mongoose + MongoDB Atlas + Cloudinary (`backend/`).
Frontend: React + Vite + Tailwind + React Router + Axios + Leaflet (`frontend/`). The customer side is built;
the admin and rider screens are the next stage (their API endpoints already exist).

## Run the customer app

```bash
# terminal 1
cd backend && npm install && cp .env.example .env   # fill it in, then: npm run seed && npm run dev
# terminal 2
cd frontend && npm install && npm run dev            # http://localhost:5173 (Vite forwards /api to port 5000)
```

Customer screens: menu with category tabs and cart, sign up / log in, checkout with a map pin (OpenStreetMap, shaded
delivery radius, "use my location", live fee preview), Paystack / Opay / Pay on delivery, order history, and order
tracking (status steps, rider name/phone/bike, rider on the map, retry payment, WhatsApp button).

Notes for the frontend:
- Paystack and Opay open by redirect and send the customer back to the order page, which asks the server to verify
  the payment. No payment keys are ever needed in the browser.
- The fee shown at checkout is a preview; the server recalculates it when the order is placed.
- In production set `VITE_API_URL` (client) to your API address, and add `FRONTEND_URL` on the server.
  The host must serve `index.html` for every path (a single-page-app rewrite) or refreshing `/orders/...` will 404.
- Map tiles come from the public OpenStreetMap server, which is fine for a small launch. Move to a tile
  provider if traffic grows.
- Checked: all client files parse. Not run yet: `npm install`, the Vite build, and the screens in a browser.

## Run it

```bash
cd backend
npm install
cp .env.example .env        # fill MONGO_URI and JWT_SECRET first; payment keys when you have them
npm run seed                # loads the 13-item Ahmars menu + first admin (password printed once)
npm run dev                 # http://localhost:5000/api/health
npm test                    # unit tests for distance, fees, phone numbers
```

Set `RESTAURANT_LAT` / `RESTAURANT_LNG` to the restaurant's exact pin. The defaults are the centre of Lafia
(a placeholder): rider search and the delivery radius are measured from this point.

## How an order flows

1. `POST /api/orders` (customer): the server prices everything from the database, checks the pin is within
   `MAX_DELIVERY_RADIUS_KM`, adds the delivery fee, and creates the order.
2. Paystack / Opay: order stays **Pending Payment** (not visible to the kitchen) and the response carries the
   checkout link. Pay on Delivery: goes straight to **Pending**.
3. The provider confirms: webhook and/or `GET /api/payments/verify/:reference`. Either way the server asks the
   provider directly and checks the amount before confirming. Confirming is idempotent.
4. On confirmation the order becomes **Pending** and dispatch starts: the nearest rider within the radius who is
   online, available, and has a location fresher than 2 minutes gets a 2-minute offer.
5. Declined or expired: next nearest rider (never the same one twice). Nobody left: the delivery lands in the
   **Unassigned** queue for the admin (`/api/admin/deliveries/unassigned`).
6. Rider: Accept, Picked Up, On The Way, Delivered (Pay on Delivery needs `collected: true`).
   Kitchen/admin sets Preparing from `/api/admin/orders/:id/status`.

## Endpoints (all under /api)

| Area | Endpoints |
|---|---|
| Public | `GET /health`, `GET /config`, `GET /foods`, `GET /foods/:id` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Customer | `POST /orders`, `GET /orders/mine`, `GET /orders/:id` (includes rider + ETA), `POST /payments/:provider/init`, `GET /payments/verify/:reference` |
| Webhooks | `POST /webhooks/paystack`, `POST /webhooks/opay` |
| Rider | `PATCH /riders/me/availability`, `PATCH /riders/me/location`, `GET /riders/me/offers`, `GET /riders/me/deliveries`, `POST /deliveries/:id/accept`, `POST /deliveries/:id/reject`, `PATCH /deliveries/:id/status` |
| Admin | foods: `POST/PUT/PATCH/DELETE /foods`; `GET /admin/orders`, `PATCH /admin/orders/:id/status`, `POST /admin/orders/:id/assign`, `POST /admin/orders/:id/redispatch`, `GET /admin/deliveries/unassigned`, `GET/POST /admin/riders`, `PATCH /admin/riders/:id`, `GET /admin/payments`, `GET /admin/summary/daily` |

Set these URLs in the provider dashboards: Paystack webhook `{API_URL}/api/webhooks/paystack`;
Opay callback `{API_URL}/api/webhooks/opay` (also sent per payment).

## What has and has not been checked

- Checked: every file passes a syntax check, and the 5 unit tests (distance, fee rounding, ETA, phone
  normalising) pass.
- **Not run yet:** the API against a real MongoDB, Paystack or Opay. This build environment had no network or
  database. Expect to fix small things on first run, and test payments in each provider's sandbox first.
- Opay calls follow OPay's published Cashier docs (create with the public key; status with an HMAC-SHA512
  signature of the body; amounts in kobo; country NG). Confirm the callback response OPay expects and your
  merchant approval before going live.
- Delivery fee numbers (base 300, 100 per km) and the Pay on Delivery cap (20,000) are placeholders.

## Known limits (by design for MVP)

- Distance is straight-line (haversine), not road distance.
- Riders get offers by polling every 5 to 10 s; no push or SMS yet. Browser location only updates while the
  rider's page is open.
- Refunds are manual: cancelling a paid order returns `refundNeeded: true`; paid-but-cancelled payments are
  flagged in `/admin/payments`.
- Checkout needs a logged-in customer account.

## Deploy: frontend on Vercel, backend on Render

Frontend address: `ahmarsfood.frankiecode.org.ng` (domain and DNS at Qservers). Use a second subdomain for the API,
for example `api.ahmarsfood.frankiecode.org.ng`.

1. **Render (backend):** new Web Service from the repo, Root Directory `backend`, Build `npm install`, Start `npm start`.
   Add every variable from `backend/.env.example`, plus
   `FRONTEND_URL=https://ahmarsfood.frankiecode.org.ng` and `API_URL=https://api.ahmarsfood.frankiecode.org.ng`.
   Then Settings, Custom Domains, add the API subdomain; Render shows the CNAME target.
2. **Vercel (frontend):** import the repo, Root Directory `frontend` (Vite is detected). Add the environment variable
   `VITE_API_URL=https://api.ahmarsfood.frankiecode.org.ng/api`, deploy, then Settings, Domains, add
   `ahmarsfood.frankiecode.org.ng`. `frontend/vercel.json` makes page refreshes work on `/orders/...`.
3. **Qservers DNS** (cPanel, Zone Editor, or Domains then Manage DNS): add one CNAME for each subdomain, using
   exactly the target Vercel and Render show (Vercel's general value is `cname.vercel-dns-0.com`). If
   `ahmarsfood` already exists as an A record or a cPanel subdomain (for example from the earlier static site),
   delete that record first: a name cannot have both an A record and a CNAME.
4. **Provider dashboards:** Paystack webhook `https://api.ahmarsfood.frankiecode.org.ng/api/webhooks/paystack`;
   Opay callback `.../api/webhooks/opay`.
5. Render's free plan puts the service to sleep when idle. Rider offers, the 2-minute timeout and payment webhooks all
   need the server awake, so use a paid always-on instance for real customers.

## Shopping assistant (Anthropic)

A chat widget (`💬 Ask Ahmars`, signed-in customers and the admin) backed by `POST /api/agent/chat`, which streams the
answer as Server-Sent Events. The model runs in a loop (max `AGENT_MAX_STEPS`, default 8) and can only call these tools:

| Tool | Who | What it does |
|---|---|---|
| `search_foods`, `get_food`, `compare_foods` | customer, admin | menu lookups (text index; category and price filters) |
| `get_order_status` | customer, admin | the user's own order (admins: any); same permission rule as the REST API |
| `get_help` | customer, admin | WhatsApp link with the order number prefilled (there is no returns system) |
| `add_to_cart` | customer, admin | checks the dishes, then the React app adds them to the browser cart |
| `go_to_checkout` | customer, admin | needs Confirm; only opens the existing checkout page |
| `get_sales_summary` | admin | daily summary (same code as the admin endpoint) |
| `create_food_draft` | admin | saves to the separate `fooddrafts` collection; never published |
| `update_price` | admin | needs Confirm; applied only by `POST /api/agent/confirm` |

How it stays safe:
- The Anthropic key lives only on the server. The assistant never sees card data, and checkout and payment stay on the existing pages.
- Every tool input is validated with zod (strict, strings and numbers only), so objects like `{"$ne": ...}` are rejected before any query runs.
- Database text comes back wrapped in `<tool_data untrusted="true">` and the system prompt says never to follow instructions inside it.
- Money or data-changing actions are only prepared. `POST /api/agent/confirm` claims the action atomically: single use, same user, role re-checked, expires after `AGENT_CONFIRM_TTL_SECONDS`.
- Each tool call is logged to `agentlogs` (user, tool, input, status, time) and deleted after `AGENT_LOG_TTL_DAYS`. Limits: per-user rate limit, request timeout.
- New collections only: `agentlogs`, `agentactions`, `fooddrafts`. The one change to an existing collection is a text index on foods.

Add in the **Render** dashboard (web service): `ANTHROPIC_API_KEY`, and optionally `AGENT_MODEL`, `AGENT_MAX_STEPS`,
`AGENT_MAX_TOKENS`, `AGENT_RATE_LIMIT_PER_HOUR`, `AGENT_TIMEOUT_SECONDS`, `AGENT_LOG_TTL_DAYS`, `AGENT_CONFIRM_TTL_SECONDS`.
Nothing new on **Vercel**. After deploying, run `npm install` once so the lockfile picks up `@anthropic-ai/sdk` and `zod`.

Tests: `npm test` in `backend/` (23 tests: tool permissions, invalid and injected input, confirmation gating, the agent loop with a scripted fake model).
Not yet tried here: a real call to the Anthropic API and a real MongoDB; do a first end-to-end run in development.
Postman: import `Ahmarsfood.postman_collection.json` (log in first; it stores the token).

## SEO: crawler, report and suggested text

What was added:
- **Page tags:** `frontend/index.html` has a description, canonical, social-preview tags and Restaurant structured data. Each page sets its own title; private pages (cart, account, orders) are marked `noindex`.
- **Sitemap and robots:** `frontend/public/robots.txt` is a static file (a robots file that fails to load can pause crawling, so it should not depend on a server that may be asleep). The sitemap is generated from the foods collection at `GET /api/seo/sitemap.xml` and served at `/sitemap.xml` by a rewrite in `frontend/vercel.json`. It lists the home page, the two local pages and one page per dish, with the date the menu last changed.
- **Crawler:** `npm run crawl` starts from the sitemap and home page, follows internal links, waits `CRAWL_RATE_MS` between pages, respects `robots.txt`, and (with `CRAWL_RENDER_JS=true`) renders each page in Chromium the way Google does. It compares the HTML sent before JavaScript with the rendered page. It records status, redirects, canonical, title, description, H1, duplicates, image alt coverage (Cloudinary images counted separately), JSON-LD checks (Product, Offer, BreadcrumbList, Restaurant, MenuItem) and sitemap coverage versus reachability.
- **History:** every crawl is kept (`seoruns`, `seoaudits`, deleted after `SEO_HISTORY_DAYS`), and the report shows new and fixed issues since the previous crawl.
- **Report:** `GET /api/admin/seo/report` (admin only) groups issues by page type; the admin screen is `/admin/seo`; the assistant has an admin-only `get_seo_report` tool.
- **Suggested text:** an admin can ask for a title and description for a dish (with MenuItem structured data built from the real name and price), or queue copy for pages the crawl found without a description. Everything lands in `seosuggestions` as pending. Approving a dish suggestion saves its description on the dish; approving a page suggestion keeps the wording for a developer to paste into the page. Nothing is published automatically.

The public pages are now saved as finished HTML (see "Pre-rendering" below), so the crawler's before/after-JavaScript comparison should come out clean for them. If `meta_not_prerendered` or `content_not_prerendered` ever appears on a public page, the build did not pre-render it.

### Run the crawler on Render (separate Cron Job)
1. Render, New, **Cron Job**, same repo. Runtime **Docker**, Dockerfile path `backend/Dockerfile.crawler`, build context `backend`.
2. Schedule, for example `0 3 * * 1` (Mondays 03:00 UTC, 04:00 in Lafia).
3. Environment: `MONGO_URI` (same database as the API), `CRAWL_BASE_URL=https://ahmarsfood.frankiecode.org.ng`, `CRAWL_RATE_MS=1000`, `CRAWL_RENDER_JS=true`.
4. Press **Trigger Run** once, then open `/admin/seo` as the admin. Check Render's current pricing for cron jobs.
A cron job is used instead of a timer inside the web service because that service can sleep or restart.
Locally: `npm run crawl` (add `CRAWL_RENDER_JS=false` to skip Chromium, or `npm install --no-save playwright && npx playwright install chromium` to render).

### Places that contain your domain
If the site address ever changes, update `frontend/index.html` (canonical, social tags, structured data), `frontend/public/robots.txt`, and `frontend/vercel.json` (API address in the sitemap rewrite). `frontend/public/og-image.png` is a simple text card for link previews; replace it with a real photo of your food (1200x630) when you have one.

New settings: see the SEO block in `backend/.env.example`. Render web service: `SEO_SUGGESTIONS_PER_HOUR`, `SEO_QUEUE_BATCH`, `SEO_HISTORY_DAYS` (optional). Render cron job: the `CRAWL_*` values above. Vercel: nothing new.

## Using the admin and rider screens

Log in at the normal login page. Each role lands on its own screen: the admin on `/admin`, a rider on `/rider`, customers on the menu.
The admin account comes from `npm run seed`. Riders are created by the admin.

**Admin (`/admin`)**
- **Orders:** new paid orders appear by themselves (refreshes every 10 seconds, with a beep). Tap **Start preparing** when the kitchen begins. Each order shows its customer, items, payment and rider. If no rider took it, a red banner appears: use **Assign rider** or **Search again**. **Cancel** warns you when a paid order will need a manual refund.
- **Menu:** add, edit, delete, mark sold out, and upload dish photos. After you save a dish you are offered drafted SEO text (you approve it on the SEO tab first).
- **Riders:** add riders (name, phone, bike number, password), see who is online and when their location last updated, and switch riders online/offline or free/busy.
- **Payments & sales:** a daily summary (paid revenue, Pay on Delivery still to collect) and every payment attempt, with refund warnings highlighted.
- **SEO:** the crawl report and the suggested-text queue.

**Rider (`/rider`)**
1. Open the site on the phone, log in, tap **Go online**, and allow location when the browser asks.
2. Keep the page open and the screen on while working: a browser only reports location while the page is open (the app asks the phone to keep the screen awake, which most current phones allow). Location is shared about every 20 seconds, and riders without a recent location are skipped.
3. An offer beeps and shows for 2 minutes: pickup, drop-off, distance, the fee you earn, and any cash to collect. **Accept** or **Decline**. The customer's phone number appears only after accepting.
4. Then tap **picked up**, **on my way**, and **Delivered**. For Pay on Delivery, tick that you collected the money before Delivered unlocks.
5. The **Earnings** tab shows delivery fees earned and past deliveries.

Notes: location needs the site to be on HTTPS (it is on Vercel). Offers are fetched by checking every 5 seconds, so a rider who closes the page or locks the phone will not get them; push notifications or SMS would be a later upgrade.

Tested here in a real browser against a mocked API: the rider flow (go online, location sent, offer with countdown, accept, pick up, cash confirmation, deliver, earnings) and the admin Orders screen (no-rider banner, start preparing, assign rider, cancel with refund warning). Menu, Riders and Payments & sales were only syntax-checked.


## Pre-rendering, dish pages and local pages

Still React and Vite (Next.js is not used). At build time the site is saved as finished HTML for the pages people search for, so Google and link previews (WhatsApp, Facebook) see real content instead of an empty page.

Pages saved at build time:
- `/` the menu
- `/menu/<dish>` one page per dish (for example `/menu/amala-and-ewedu-and-gbegiri`), with the photo, price, preparation time, `MenuItem` and breadcrumb structured data
- `/food-delivery-lafia` and `/food-delivery-federal-university-lafia`, with ordering steps, payment options, delivery area (taken from your delivery radius setting) and a short FAQ. The wording is in `frontend/src/seo/landing.js`; it only states facts about the restaurant and the app, so edit it freely once you have real details such as opening hours.

Everything else (cart, checkout, orders, admin, rider, login) is the normal app and is served from `app-shell.html`, which is marked `noindex`.

How a build works (`npm run build` in `frontend/`, which Vercel runs): build the app, build a server copy of the public pages, then `scripts/prerender.mjs` reads the menu from your API and writes one HTML file per page. The browser then loads the app over the saved page; prices are always refreshed from the server, so customers see current prices.

On **Vercel**: Root Directory `frontend`, and the build needs the full API address: `VITE_API_URL=https://api.ahmarsfood.frankiecode.org.ng/api` (or set `PRERENDER_API_URL` to it). The Render API must be awake during the build; the script retries for about a minute. If it cannot read the menu, the build fails and the previous version of the site stays live. To ship anyway without saved pages, set `PRERENDER_OPTIONAL=true`.

Keeping saved pages current: the saved HTML is a snapshot from the last build. In Vercel, Settings, Git, Deploy Hooks, create a hook and put its address in the API's `VERCEL_DEPLOY_HOOK_URL`. Changing the menu then triggers one rebuild about two minutes after the last edit (`REBUILD_DELAY_SECONDS`). Without the hook, redeploy by hand after menu changes.

Good to know:
- Renaming a dish changes its page address (there is no redirect from the old one yet). The sitemap updates itself.
- The browser replaces the saved page with the live app on load rather than "hydrating" it, which is simpler and safer; the content stays identical so visitors see no jump.
- Try it locally: `PRERENDER_API_URL=https://api.ahmarsfood.frankiecode.org.ng/api npm run build`, then open `frontend/dist/menu/` to see the saved pages. `npm run build:spa` builds only the app, with no pre-rendering.

Tested here with the real page components, build script and crawler: all 16 pages saved correctly and passed the SEO checks, and a crawl of the finished site found no errors or warnings; failures (API down) behave as described above; the in-page tag updates were checked in Chromium. Not tested here: a real Vite build (the router and Vite are not installed in this environment, so the router was replaced by a small stand-in for the test), real Vercel and Render, and your live data. Expect to fix small things on the first real deploy.

## Logo, favicon and link-preview image

All of these are made from the original logo, kept in `frontend/brand/ahmars-logo-original.jpg` (not served by the site). The white background was removed smoothly, so the logo sits cleanly on any colour.

| File in `frontend/public` | Used for |
|---|---|
| `logo-header.png` (298x120) | the header, shown 44px tall (about 2.7x sharper for phone screens) |
| `logo-footer.png` (239x96) | the footer, on a white badge (the green letters disappear on the dark green footer without it) |
| `favicon.ico` (16, 32, 48), `favicon-32.png` | browser tab icon: a round crop of the plate, simplified so it stays readable when tiny |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | phone home-screen icons and the `logo` in the Google structured data: the full plate, fork and knife |
| `og-image.png` (1200x630) | the picture shown when a link is shared on WhatsApp, Facebook and similar |

Browsers keep favicons for a long time: after deploying, hold Shift and refresh (or open the site in a private window) to see the new one. If the logo changes, send the new file and the set is regenerated the same way.
