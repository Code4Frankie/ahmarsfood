import { buildSystemPrompt } from './prompt.js';

const MAX_TOOLS_PER_STEP = 5;

// Dependency-free on purpose (no database or SDK imports) so it can be tested with a scripted fake model.
// emit(type, data) sends progress to the browser (Server-Sent Events).
export async function runAgent({ llm, registry, user, messages, emit, signal, config }) {
  const convo = messages.map((m) => ({ role: m.role, content: m.content }));
  const tools = registry.definitionsFor(user);
  const system = buildSystemPrompt(user, config.restaurant);

  for (let step = 1; step <= config.maxSteps; step += 1) {
    if (signal?.aborted) return { stopped: 'aborted' };
    emit('step', { step });

    const stream = llm.stream({ model: config.model, max_tokens: config.maxTokens, system, tools, messages: convo }, { signal });
    stream.on('text', (delta) => emit('text', { delta }));
    const final = await stream.finalMessage();

    convo.push({ role: 'assistant', content: final.content });
    const toolUses = final.content.filter((b) => b.type === 'tool_use');
    if (final.stop_reason !== 'tool_use' || toolUses.length === 0) {
      emit('done', { stop_reason: final.stop_reason });
      return { stopped: 'done' };
    }

    const results = [];
    for (const [i, tu] of toolUses.entries()) {
      if (i >= MAX_TOOLS_PER_STEP) {
        results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'Too many tool calls at once; ask again in smaller steps.' });
        continue;
      }
      emit('tool_start', { id: tu.id, name: tu.name, label: registry.label(tu.name) });
      const outcome = await registry.execute(tu.name, tu.input, { user, signal });
      emit('tool_end', { id: tu.id, name: tu.name, status: outcome.status });
      if (outcome.pending) emit('confirmation_required', outcome.pending);
      if (outcome.clientAction) emit('client_action', outcome.clientAction);
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
    }
    convo.push({ role: 'user', content: results });
  }

  emit('text', { delta: "\n\nI couldn't finish that in the steps I'm allowed. Could you ask in a simpler way?" });
  emit('done', { stop_reason: 'max_steps' });
  return { stopped: 'max_steps' };
}
