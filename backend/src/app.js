import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';
import webhookRoutes from './routes/webhooks.js';
import authRoutes from './routes/auth.js';
import foodRoutes from './routes/foods.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import riderRoutes from './routes/riders.js';
import deliveryRoutes from './routes/deliveries.js';
import adminRoutes from './routes/admin.js';
import agentRoutes from './routes/agent.js';
import seoRoutes from './routes/seo.js';

const app = express();
app.set('trust proxy', 1); // behind a host proxy (Render, Railway, ...): needed for correct rate-limit IPs
app.use(helmet());
app.use(cors({ origin: env.frontendUrls, credentials: true }));

// Webhooks first: they need the raw body, before express.json() runs.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public restaurant info for the frontend (map centre, radius, fee rules, contact).
app.get('/api/config', (req, res) =>
  res.json({
    restaurant: env.restaurant,
    delivery: { baseFee: env.delivery.baseFee, perKm: env.delivery.perKm, maxRadiusKm: env.restaurant.maxRadiusKm },
    maxPodAmount: env.maxPodAmount,
    paymentMethods: ['paystack', 'opay', 'pod'],
  })
);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentLimiter, paymentRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/seo', seoRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
