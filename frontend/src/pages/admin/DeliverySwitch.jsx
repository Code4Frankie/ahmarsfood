import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';

const MODES = [
  { id: 'app', title: 'Riders on the app', sub: 'Orders are offered to app riders automatically (normal).' },
  { id: 'manual', title: 'I will call a bike rider', sub: 'Delivery orders wait for you. You phone a bike rider and enter their name and number.' },
  { id: 'paused', title: 'Pause delivery', sub: 'No rider available. Customers are told and can still order pickup.' },
];

// The admin's delivery switch. It changes what customers see straight away; orders already placed are not affected.
export default function DeliverySwitch() {
  const [cfg, setCfg] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/settings/delivery').then((r) => { setCfg(r.data); setNote(r.data.note || ''); }).catch((e) => setError(errMsg(e)));
  }, []);

  const save = async (mode) => {
    setBusy(true); setError(''); setMsg('');
    try {
      const r = await api.put('/admin/settings/delivery', { mode, note });
      setCfg(r.data); setNote(r.data.note || '');
      setMsg(mode === 'paused' ? 'Delivery is paused. Customers now see a notice and can only order pickup.' : mode === 'manual' ? 'New delivery orders will wait for you to call a bike rider.' : 'Back to normal: app riders get new orders automatically.');
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  if (!cfg && !error) return null;
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">Delivery service</h2>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {cfg && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button key={m.id} type="button" disabled={busy} onClick={() => cfg.mode !== m.id && save(m.id)}
                className={`rounded-xl border-2 p-3 text-left ${cfg.mode === m.id ? (m.id === 'paused' ? 'border-chili bg-chili/10' : 'border-forest bg-forest/10') : 'border-ink/10'}`}
                aria-pressed={cfg.mode === m.id}>
                <span className="block font-semibold">{m.title}{cfg.mode === m.id ? ' ✓' : ''}</span>
                <span className="block text-xs text-ink/60">{m.sub}</span>
              </button>
            ))}
          </div>
          {cfg.mode === 'paused' && (
            <div className="flex flex-wrap items-center gap-2">
              <input className="input !w-auto min-w-[16rem] flex-1" maxLength={200} placeholder="Message for customers (optional), e.g. Riders are back at 4pm" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-ghost" disabled={busy || note === (cfg.note || '')} onClick={() => save('paused')}>Save message</button>
            </div>
          )}
          {msg && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{msg}</p>}
        </>
      )}
    </div>
  );
}
