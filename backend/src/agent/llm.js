import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

let client;

// Thin wrapper so the loop (and the tests) only depend on: stream(params, { signal }) -> { on('text', cb), finalMessage() }
export function createLlm() {
  client ||= new Anthropic({ apiKey: env.agent.apiKey });
  return { stream: (params, { signal } = {}) => client.messages.stream(params, { signal }) };
}
