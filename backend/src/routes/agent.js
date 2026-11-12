import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { runAgent } from '../agent/agentLoop.js';
import { createLlm } from '../agent/llm.js';
import { buildDefaultRegistry } from '../agent/defaultRegistry.js';

const router = Router();
const registry = buildDefaultRegistry();

// Customers and the restaurant admin only. Riders have nothing to do with the assistant.
const allowed = [protect, requireRole('customer', 'admin')];

const limiter = (limit, message) => rateLimit({
  windowMs: 60 * 60 * 1000,
  limit,
  keyGenerator: (req) => String(req.user._id), // per signed-in user (runs after protect)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
});
const chatLimiter = limiter(env.agent.ratePerHour, 'You have used the assistant a lot this hour. Please try again later.');
const confirmLimiter = limiter(env.agent.ratePerHour * 2, 'Too many confirmations. Please try again later.');

const chatBody = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }).strict()).min(1).max(20),
}).strict().refine((b) => b.messages[b.messages.length - 1].role === 'user', { message: 'The last message must be from the user' });

// POST /api/agent/chat: Server-Sent Events over fetch (the browser reads the stream; EventSource can't POST).
router.post('/chat', ...allowed, chatLimiter, asyncHandler(async (req, res) => {
  const body = chatBody.safeParse(req.body);
  if (!body.success) throw new HttpError(400, body.error.issues.map((i) => i.message).join('; '));
  if (!env.agent.apiKey) throw new HttpError(503, 'The assistant is not set up yet');

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies from buffering the stream
  });
  res.flushHeaders();

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), env.agent.timeoutMs);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000); // keeps idle proxies from closing the stream
  // 'close' on the RESPONSE fires when the browser disconnects (on the request it fires too early).
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });

  const emit = (event, data) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runAgent({
      llm: createLlm(),
      registry,
      user: req.user,
      messages: body.data.messages,
      emit,
      signal: abort.signal,
      config: { model: env.agent.model, maxSteps: env.agent.maxSteps, maxTokens: env.agent.maxTokens, restaurant: env.restaurant },
    });
  } catch (err) {
    console.error('[agent]', err.message);
    emit('error', { message: abort.signal.aborted ? 'That took too long or was cancelled.' : 'The assistant ran into a problem. Please try again.' });
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timeout);
    res.end();
  }
}));

const confirmBody = z.object({ actionId: z.string().regex(/^[a-f\d]{24}$/i), decision: z.enum(['confirm', 'cancel']) }).strict();

// POST /api/agent/confirm: the only way a prepared action ever runs. Single-use, same user, expires.
router.post('/confirm', ...allowed, confirmLimiter, asyncHandler(async (req, res) => {
  const body = confirmBody.safeParse(req.body);
  if (!body.success) throw new HttpError(400, 'actionId and decision (confirm or cancel) are required');
  res.json(await registry.resolve(body.data.actionId, body.data.decision, { user: req.user }));
}));

export default router;
