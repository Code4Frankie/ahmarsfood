import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE, errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

// POST + streaming: EventSource cannot send a POST or an Authorization header, so we read the response body ourselves.
async function streamChat(messages, signal, onEvent) {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('af_token')}` },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok) {
    if (res.status === 401) { localStorage.removeItem('af_token'); window.dispatchEvent(new Event('af-logout')); }
    let msg = 'The assistant is unavailable right now.';
    try { msg = (await res.json()).message || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      } // lines starting with ":" are heartbeats and are ignored
      if (data) { try { onEvent(event, JSON.parse(data)); } catch { /* skip a malformed event */ } }
    }
  }
}

const SUGGESTIONS = {
  customer: ['What can I eat for under ₦2,000?', 'Compare the shawarmas', 'Where is my order?'],
  admin: ["How were today's sales?", 'What is on the menu?'],
};

export default function AgentChat() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState('');
  const abortRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activity, open]);
  useEffect(() => { setMessages([]); }, [user?._id, user?.id]); // a new login starts a fresh conversation

  if (!user || !['customer', 'admin'].includes(user.role)) return null;

  const patchAssistant = (fn) => setMessages((cur) => { const copy = [...cur]; copy[copy.length - 1] = fn(copy[copy.length - 1]); return copy; });
  const setCard = (actionId, state, error) =>
    setMessages((cur) => cur.map((m) => ({ ...m, cards: (m.cards || []).map((c) => (c.actionId === actionId ? { ...c, state, error } : c)) })));

  const onEvent = (event, d) => {
    if (event === 'text') patchAssistant((m) => ({ ...m, content: m.content + d.delta }));
    else if (event === 'tool_start') setActivity(d.label);
    else if (event === 'tool_end') setActivity('');
    else if (event === 'confirmation_required') patchAssistant((m) => ({ ...m, cards: [...m.cards, { ...d, state: 'pending' }] }));
    else if (event === 'client_action' && d.type === 'add_to_cart') cart.addMany(d.items);
    else if (event === 'error') patchAssistant((m) => ({ ...m, content: `${m.content ? `${m.content}\n\n` : ''}${d.message}` }));
  };

  const send = async (text) => {
    text = text.trim();
    if (!text || busy) return;
    let history = [...messages, { role: 'user', content: text }].filter((m) => m.content?.trim()).map((m) => ({ role: m.role, content: m.content })).slice(-20);
    while (history.length && history[0].role !== 'user') history.shift();

    setMessages((cur) => [...cur, { role: 'user', content: text }, { role: 'assistant', content: '', cards: [] }]);
    setInput('');
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamChat(history, ac.signal, onEvent);
    } catch (e) {
      if (e.name !== 'AbortError') patchAssistant((m) => ({ ...m, content: m.content || e.message }));
    } finally {
      setBusy(false);
      setActivity('');
      abortRef.current = null;
    }
  };

  const resolveCard = async (actionId, decision) => {
    setCard(actionId, 'working');
    try {
      const { data } = await api.post('/agent/confirm', { actionId, decision });
      setCard(actionId, data.status === 'confirmed' ? 'confirmed' : 'cancelled');
      if (data.clientAction?.type === 'navigate') { setOpen(false); navigate(data.clientAction.to); }
    } catch (e) {
      setCard(actionId, 'error', errMsg(e));
    }
  };

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="btn-accent fixed bottom-5 right-5 z-40 !rounded-full !px-5 !py-3 shadow-lg" aria-label="Ask the Ahmars assistant">
        {open ? '✕ Close' : '💬 Ask Ahmars'}
      </button>

      {open && (
        <section className="fixed bottom-20 right-4 z-40 flex h-[32rem] max-h-[75vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-2xl" aria-label="Ahmars assistant">
          <header className="bg-forest px-4 py-3 text-white">
            <p className="font-display text-lg font-bold leading-none">Ahmars assistant</p>
            <p className="text-xs text-white/80">Ask about the menu, your cart or your order</p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-cream p-3 text-sm">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-ink/60">Hi {user.name?.split(' ')[0]}! How can I help?</p>
                <div className="flex flex-wrap gap-2">
                  {(SUGGESTIONS[user.role] || SUGGESTIONS.customer).map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-forest/40 bg-white px-3 py-1.5 text-xs font-semibold text-forest-dark hover:bg-forest/10">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                {m.content && (
                  <p className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left ${m.role === 'user' ? 'bg-forest text-white' : 'bg-white text-ink'}`}>{m.content}</p>
                )}
                {m.cards?.map((c) => (
                  <div key={c.actionId} className="mt-2 rounded-xl border-2 border-dashed border-sunset bg-white p-3 text-left">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-sunset">Please confirm</p>
                    <p className="mt-1 font-semibold">{c.summary}</p>
                    {c.state === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <button className="btn-primary !py-1.5" onClick={() => resolveCard(c.actionId, 'confirm')}>Confirm</button>
                        <button className="btn-ghost !py-1.5" onClick={() => resolveCard(c.actionId, 'cancel')}>Cancel</button>
                      </div>
                    )}
                    {c.state === 'working' && <p className="mt-2 text-ink/60">Working…</p>}
                    {c.state === 'confirmed' && <p className="mt-2 font-semibold text-forest-dark">✓ Done</p>}
                    {c.state === 'cancelled' && <p className="mt-2 text-ink/60">Cancelled</p>}
                    {c.state === 'error' && <p className="mt-2 text-chili">{c.error}</p>}
                  </div>
                ))}
              </div>
            ))}

            {activity && <p className="animate-pulse text-xs font-semibold text-forest-dark">{activity}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-ink/10 bg-white p-2">
            <input className="input" placeholder="Type your question…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} disabled={busy} />
            {busy
              ? <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>Stop</button>
              : <button className="btn-primary" disabled={!input.trim()}>Send</button>}
          </form>
        </section>
      )}
    </>
  );
}
