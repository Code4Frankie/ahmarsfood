import mongoose from 'mongoose';
import { env } from '../config/env.js';

// One row per tool call the assistant makes. Old rows delete themselves after AGENT_LOG_TTL_DAYS.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  tool: String,
  input: String, // JSON text, capped at 500 characters
  status: { type: String, enum: ['ok', 'error', 'denied', 'invalid_input', 'pending_confirmation', 'confirmed', 'cancelled'] },
  error: String,
  durationMs: Number,
  createdAt: { type: Date, default: Date.now },
});
schema.index({ createdAt: 1 }, { expireAfterSeconds: env.agent.logTtlDays * 86400 });

export default mongoose.model('AgentLog', schema);
