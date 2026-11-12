import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../agent/agentLoop.js';

// A scripted stand-in for the Anthropic client: each call to stream() plays the next scripted model turn.
function fakeLlm(script) {
  const calls = [];
  return {
    calls,
    stream(params) {
      calls.push(structuredClone(params));
      const turn = script[Math.min(calls.length - 1, script.length - 1)];
      let onText = () => {};
      return {
        on(event, fn) { if (event === 'text') onText = fn; return this; },
        async finalMessage() {
          for (const b of turn.content) if (b.type === 'text') onText(b.text);
          return { content: turn.content, stop_reason: turn.stop_reason };
        },
      };
    },
  };
}
const toolTurn = (...uses) => ({ stop_reason: 'tool_use', content: uses.map((u, i) => ({ type: 'tool_use', id: `t${i}`, name: u.name || 'search_foods', input: u.input || {} })) });
const textTurn = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

function fakeRegistry(overrides = {}) {
  const executed = [];
  return {
    executed,
    definitionsFor: () => [{ name: 'search_foods' }],
    label: () => 'Working…',
    async execute(name, input) { executed.push({ name, input }); return overrides.outcome || { status: 'ok', content: '<tool_data untrusted="true">{}</tool_data>', isError: false }; },
  };
}

const base = (llm, registry, extra = {}) => {
  const events = [];
  return {
    events,
    args: { llm, registry, user: { _id: 'u1', role: 'customer' }, messages: [{ role: 'user', content: 'jollof?' }], emit: (type, data) => events.push([type, data]), signal: new AbortController().signal, config: { model: 'm', maxSteps: 3, maxTokens: 100, restaurant: { name: 'Ahmars Food', address: 'Lafia' } }, ...extra },
  };
};

test('runs a tool, feeds the result back, then streams the final answer', async () => {
  const llm = fakeLlm([toolTurn({ input: { query: 'jollof' } }), textTurn('Try the jollof!')]);
  const reg = fakeRegistry();
  const { args, events } = base(llm, reg);
  const res = await runAgent(args);

  assert.equal(res.stopped, 'done');
  assert.deepEqual(reg.executed, [{ name: 'search_foods', input: { query: 'jollof' } }]);
  assert.deepEqual(events.map((e) => e[0]), ['step', 'tool_start', 'tool_end', 'step', 'text', 'done']);
  const second = llm.calls[1].messages;
  const toolResult = second[second.length - 1].content[0];
  assert.equal(toolResult.type, 'tool_result');
  assert.equal(toolResult.tool_use_id, 't0');
  assert.match(llm.calls[0].system, /untrusted/); // injection guidance is in the system prompt
  assert.equal(llm.calls[0].tools[0].name, 'search_foods');
});

test('stops after the maximum number of steps', async () => {
  const llm = fakeLlm([toolTurn({})]); // the model never stops asking for tools
  const { args, events } = base(llm, fakeRegistry());
  const res = await runAgent(args);
  assert.equal(res.stopped, 'max_steps');
  assert.equal(llm.calls.length, 3);
  assert.deepEqual(events.at(-1), ['done', { stop_reason: 'max_steps' }]);
});

test('does not call the model if the request was already cancelled', async () => {
  const ac = new AbortController();
  ac.abort();
  const llm = fakeLlm([textTurn('hi')]);
  const { args } = base(llm, fakeRegistry(), { signal: ac.signal });
  const res = await runAgent(args);
  assert.equal(res.stopped, 'aborted');
  assert.equal(llm.calls.length, 0);
});

test('forwards confirmation requests and client actions to the browser', async () => {
  const outcome = { status: 'pending_confirmation', content: 'x', isError: false, pending: { actionId: 'a1', tool: 'update_price', summary: 'S' }, clientAction: { type: 'navigate', to: '/checkout' } };
  const llm = fakeLlm([toolTurn({ name: 'go_to_checkout' }), textTurn('Please confirm.')]);
  const { args, events } = base(llm, fakeRegistry({ outcome }));
  await runAgent(args);
  assert.ok(events.some(([t, d]) => t === 'confirmation_required' && d.actionId === 'a1'));
  assert.ok(events.some(([t, d]) => t === 'client_action' && d.to === '/checkout'));
});

test('caps parallel tool calls and still answers every tool_use', async () => {
  const llm = fakeLlm([toolTurn(...Array.from({ length: 7 }, () => ({}))), textTurn('ok')]);
  const reg = fakeRegistry();
  const { args } = base(llm, reg);
  await runAgent(args);
  assert.equal(reg.executed.length, 5);
  const results = llm.calls[1].messages.at(-1).content;
  assert.equal(results.length, 7); // the API requires a result for every tool_use
  assert.equal(results[6].is_error, true);
});
