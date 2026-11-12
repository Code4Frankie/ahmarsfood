import { useCallback, useState } from 'react';
import api, { errMsg } from '../../api';
import { usePoll } from '../../hooks/usePoll.js';

const ago = (d) => {
  if (!d) return 'never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};
const EMPTY = { name: '', phone: '', bikeNumber: '', password: '' };

export default function AdminRiders() {
  const [riders, setRiders] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(async () => {
    try { setRiders((await api.get('/admin/riders')).data.riders); } catch (e) { setError(errMsg(e)); }
  }, []);
  usePoll(load, 15000);

  const act = async (fn, say) => { setBusy(true); setError(''); setNote(''); try { await fn(); if (say) setNote(say); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); } };
  const create = (e) => { e.preventDefault(); act(async () => { await api.post('/admin/riders', form); setForm(EMPTY); setAdding(false); }, 'Rider added. Give them the phone number and password to log in.'); };
  const patch = (r, body) => act(() => api.patch(`/admin/riders/${r._id}`, body));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Riders</h1>
        <button className="btn-primary" onClick={() => setAdding(!adding)}>Add a rider</button>
      </div>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {note && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{note}</p>}

      {adding && (
        <form onSubmit={create} className="card grid gap-4 sm:grid-cols-2">
          <div><label className="label">Full name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
          <div><label className="label">Phone number</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} required /></div>
          <div><label className="label">Bike number</label><input className="input" value={form.bikeNumber} onChange={set('bikeNumber')} required /></div>
          <div><label className="label">Password (8+ characters)</label><input className="input" type="password" minLength={8} value={form.password} onChange={set('password')} required /></div>
          <div className="sm:col-span-2"><button className="btn-primary" disabled={busy}>Create rider</button></div>
        </form>
      )}

      {!riders && !error && <p className="text-ink/60">Loading…</p>}
      {riders?.length === 0 && <p className="card text-ink/60">No riders yet.</p>}
      <div className="space-y-2">
        {riders?.map((r) => (
          <div key={r._id} className="card flex flex-wrap items-center gap-3 !p-3 text-sm">
            <div className="min-w-[10rem] flex-1">
              <p className="font-semibold">{r.user?.name}</p>
              <p className="text-xs text-ink/60">{r.user?.phone} · bike {r.bikeNumber}</p>
            </div>
            <p className="text-xs text-ink/60">Location: {ago(r.lastLocationUpdate)}</p>
            <button className={`rounded-full px-3 py-1 text-xs font-bold ${r.isOnline ? 'bg-forest text-white' : 'bg-ink/10 text-ink/60'}`} disabled={busy} onClick={() => patch(r, { isOnline: !r.isOnline })}>{r.isOnline ? 'Online' : 'Offline'}</button>
            <button className={`rounded-full px-3 py-1 text-xs font-bold ${r.isAvailable ? 'bg-forest/15 text-forest-dark' : 'bg-sunset/20 text-sunset-dark'}`} disabled={busy} onClick={() => patch(r, { isAvailable: !r.isAvailable })}>{r.isAvailable ? 'Free' : 'Busy'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
