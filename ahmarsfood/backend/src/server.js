import mongoose from 'mongoose';
import { env, assertEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import app from './app.js';
import { expireStaleOffers, cancelAbandonedOrders } from './services/dispatch.js';

assertEnv();
await connectDB();

const server = app.listen(env.port, () => console.log(`Ahmarsfood API on :${env.port} (${env.nodeEnv})`));

// Every 10 s: re-offer expired rider offers. Every minute: tidy abandoned payments.
let tick = 0;
const timer = setInterval(async () => {
  try {
    await expireStaleOffers();
    if (++tick % 6 === 0) await cancelAbandonedOrders();
  } catch (err) {
    console.error('[scheduler]', err.message);
  }
}, 10_000);

const shutdown = async () => {
  clearInterval(timer);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
