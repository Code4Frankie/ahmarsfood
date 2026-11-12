import { HttpError } from '../utils/httpError.js';

// Results go back to the model inside <tool_data untrusted="true"> markers. "<" is escaped so data can never close the tag.
export function wrapData(data, max = 8000) {
  const json = JSON.stringify(data ?? null).replace(/</g, '\\u003c');
  const body = json.length > max ? `${json.slice(0, max)}…[truncated]` : json;
  return `<tool_data untrusted="true">${body}</tool_data>`;
}
const wrapError = (message) => wrapData({ error: message });

const issues = (err) => err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
const preview = (v) => { try { return JSON.stringify(v ?? {}).slice(0, 500); } catch { return '[unserialisable]'; } };

// Builds the registry from plain tool objects. Everything the registry needs (action store, logger) is passed in,
// so tests can run it without a database.
export function createRegistry({ tools, actions, log = async () => {}, maxResultChars = 8000 }) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const allowed = (tool, user) => tool.roles.includes(user.role);

  const record = (ctx, name, status, started, error) =>
    Promise.resolve(log({ userId: ctx.user._id, tool: name, input: ctx.inputPreview, status, error, durationMs: Date.now() - started })).catch(() => {});

  const splitClientAction = (tool, data) => {
    if (tool.clientAction && data && data.client_action) {
      const { client_action: clientAction, ...rest } = data;
      return { data: rest, clientAction };
    }
    return { data };
  };

  return {
    // The model is only shown tools this user's role may use.
    definitionsFor: (user) => tools.filter((t) => allowed(t, user)).map((t) => ({ name: t.name, description: t.description, input_schema: t.jsonSchema })),
    label: (name) => byName.get(name)?.label || 'Working…',

    // Never throws: every outcome is something the model can read.
    async execute(name, rawInput, ctx) {
      const started = Date.now();
      ctx = { ...ctx, inputPreview: preview(rawInput) };
      const out = (status, content, extra = {}) => record(ctx, name, status, started, extra.error).then(() => ({ status, content, isError: !['ok', 'pending_confirmation'].includes(status), ...extra }));

      const tool = byName.get(name);
      if (!tool || !allowed(tool, ctx.user)) return out('denied', wrapError('That tool is not available.'));

      const parsed = tool.zod.safeParse(rawInput ?? {});
      if (!parsed.success) return out('invalid_input', wrapError(`Invalid input: ${issues(parsed.error)}`));

      try {
        if (tool.confirm) {
          const { summary } = await tool.prepare(parsed.data, ctx);
          const action = await actions.create({ userId: ctx.user._id, tool: name, input: parsed.data, summary });
          return out('pending_confirmation',
            wrapData({ status: 'awaiting_user_confirmation', summary, note: 'Shown to the user with Confirm and Cancel buttons. It has NOT happened yet. Tell the user to review it.' }, maxResultChars),
            { pending: { actionId: String(action._id), tool: name, summary } });
        }
        const { data, clientAction } = splitClientAction(tool, await tool.run(parsed.data, ctx));
        return out('ok', wrapData(data, maxResultChars), clientAction ? { clientAction } : {});
      } catch (err) {
        const message = err instanceof HttpError ? err.message : 'The tool failed.';
        return out('error', wrapError(message), { error: err.message });
      }
    },

    // Called by POST /api/agent/confirm. The action is claimed atomically, so it can run at most once.
    async resolve(actionId, decision, ctx) {
      const started = Date.now();
      const claimed = await actions.claim(actionId, ctx.user._id, decision === 'confirm' ? 'confirmed' : 'cancelled');
      if (!claimed) throw new HttpError(409, 'This action has expired or was already handled');
      const c = { ...ctx, inputPreview: preview(claimed.input) };
      if (decision !== 'confirm') {
        await record(c, claimed.tool, 'cancelled', started);
        return { status: 'cancelled' };
      }
      const tool = byName.get(claimed.tool);
      if (!tool || !allowed(tool, ctx.user)) {
        await record(c, claimed.tool, 'denied', started);
        throw new HttpError(403, 'You are not allowed to do that');
      }
      const parsed = tool.zod.safeParse(claimed.input);
      if (!parsed.success) throw new HttpError(400, 'Stored action is no longer valid');
      try {
        const { data, clientAction } = splitClientAction(tool, await tool.apply(parsed.data, c));
        await record(c, claimed.tool, 'confirmed', started);
        return { status: 'confirmed', summary: claimed.summary, result: data, ...(clientAction ? { clientAction } : {}) };
      } catch (err) {
        await record(c, claimed.tool, 'error', started, err.message);
        throw err instanceof HttpError ? err : new HttpError(500, 'The action failed');
      }
    },
  };
}
