import AgentAction from '../models/AgentAction.js';
import { env } from '../config/env.js';

export const createAction = ({ userId, tool, input, summary }) =>
  AgentAction.create({ userId, tool, input, summary, expiresAt: new Date(Date.now() + env.agent.confirmTtlMs) });

// Atomic: only one caller can move a still-pending, unexpired action belonging to this user.
export const claimAction = (id, userId, status) =>
  AgentAction.findOneAndUpdate({ _id: id, userId, status: 'pending', expiresAt: { $gt: new Date() } }, { status }, { new: true }).lean();
