import { useCallback, useState } from 'react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePoll } from '../../hooks/usePoll.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import RiderHome from './RiderHome.jsx';

// Approved riders go straight to the rider screen. Applicants see: confirm phone, then wait for approval.
export default function RiderEntry() {
  usePageMeta({ title: 'Rider | Ahmars Food', noindex: true });
  const { user, refresh } = useAuth();
  const [rider, setRider] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRider((await api.get('/riders/me')).data.rider); } catch (e) { setError(errMsg(e)); }
  }, []);
  usePoll(load, 15000, { enabled: rider?.approval !== 'approved' });

  if (error && !rider) return <p className="rounded-lg bg-chili/10 p-4 text-chili">{error}</p>;
  if (!rider) return <p className="py-10 text-center text-ink/60">Loading…</p>;
  if (rider.approval === 'approved') return <RiderHome />;

  const run = async (fn) => { setBusy(true); setError(''); setInfo(''); try { await fn(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); } };
  const send = () => run(async () => { const r = await api.post('/auth/verify-phone/send'); setInfo(r.data.message); });
  const verify = (e) => { e.preventDefault(); run(async () => { await api.post('/auth/verify-phone', { code }); await refresh(); setCode(''); }); };

  return (
    <div className="card mx-auto mt-6 max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Hello {user?.name?.split(' ')[0]}</h1>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili" role="alert">{error}</p>}
      {info && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{info}</p>}

      {rider.approval === 'rejected' ? (
        <p className="text-sm text-ink/80">Sorry, your application was not approved. Please contact the restaurant if you think this is a mistake.</p>
      ) : !user?.phoneVerified ? (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-ink/80">Step 1 of 2: confirm your phone number. Enter the 6-digit code we texted to {user?.phone}.</p>
          <div><label className="label" htmlFor="rv-code">6-digit code</label><input id="rv-code" className="input font-mono tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" required /></div>
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>Confirm number</button>
          <p className="text-center text-sm text-ink/60">No SMS yet? <button type="button" className="font-semibold text-forest" disabled={busy} onClick={send}>Send the code again</button></p>
        </form>
      ) : (
        <div className="space-y-2 text-sm text-ink/80">
          <p><b>Step 2 of 2:</b> your number is confirmed and your application is with us.</p>
          <p>We are reviewing it. This page checks again every few seconds, and your rider screen opens here as soon as you are approved.</p>
        </div>
      )}
    </div>
  );
}
