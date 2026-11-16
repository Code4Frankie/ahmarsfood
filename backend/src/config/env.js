import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  paystackSecret: process.env.PAYSTACK_SECRET_KEY,
  opay: {
    publicKey: process.env.OPAY_PUBLIC_KEY,
    secretKey: process.env.OPAY_SECRET_KEY,
    merchantId: process.env.OPAY_MERCHANT_ID,
    baseUrl: process.env.OPAY_BASE_URL || 'https://sandboxapi.opaycheckout.com',
  },
  sms: {
    apiKey: process.env.TERMII_API_KEY,
    senderId: process.env.TERMII_SENDER_ID || 'AhmarsFood',
    baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com',
    channel: process.env.TERMII_CHANNEL || 'dnd',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  restaurant: {
    name: 'Ahmars Food',
    tagline: '...trust in the taste',
    address: 'Maraba Akunza, Federal University Lafia, Nasarawa State',
    whatsapp: '2348114077101',
    lat: num(process.env.RESTAURANT_LAT, 8.4966),
    lng: num(process.env.RESTAURANT_LNG, 8.5153),
    maxRadiusKm: num(process.env.MAX_DELIVERY_RADIUS_KM, 5),
  },
  delivery: {
    baseFee: num(process.env.DELIVERY_BASE_FEE, 300),
    perKm: num(process.env.DELIVERY_PER_KM, 100),
    offerTimeoutMs: num(process.env.OFFER_TIMEOUT_SECONDS, 120) * 1000,
    locationStaleMs: num(process.env.RIDER_LOCATION_STALE_SECONDS, 120) * 1000,
  },
  // Optional: a Vercel Deploy Hook address. When set, changing the menu asks Vercel to rebuild the site so the saved pages stay current.
  deployHookUrl: process.env.VERCEL_DEPLOY_HOOK_URL,
  rebuildDelayMs: num(process.env.REBUILD_DELAY_SECONDS, 120) * 1000,
  seo: {
    baseUrl: process.env.CRAWL_BASE_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim(),
    rateMs: num(process.env.CRAWL_RATE_MS, 1000),
    maxPages: num(process.env.CRAWL_MAX_PAGES, 200),
    renderJs: process.env.CRAWL_RENDER_JS !== 'false', // true = Playwright renders pages like Google does
    historyDays: num(process.env.SEO_HISTORY_DAYS, 365),
    suggestionsPerHour: num(process.env.SEO_SUGGESTIONS_PER_HOUR, 30),
    queueBatch: num(process.env.SEO_QUEUE_BATCH, 10),
  },
  agent: {
    apiKey: process.env.ANTHROPIC_API_KEY, // server-side only, never sent to the browser
    model: process.env.AGENT_MODEL || 'claude-haiku-5-5',
    maxSteps: num(process.env.AGENT_MAX_STEPS, 8),
    maxTokens: num(process.env.AGENT_MAX_TOKENS, 1024),
    ratePerHour: num(process.env.AGENT_RATE_LIMIT_PER_HOUR, 60),
    timeoutMs: num(process.env.AGENT_TIMEOUT_SECONDS, 60) * 1000,
    logTtlDays: num(process.env.AGENT_LOG_TTL_DAYS, 90),
    confirmTtlMs: num(process.env.AGENT_CONFIRM_TTL_SECONDS, 600) * 1000,
  },
};

export function assertEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}
