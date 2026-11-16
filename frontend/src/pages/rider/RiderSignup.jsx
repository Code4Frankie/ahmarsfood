import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { errMsg } from '../../api';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import PasswordInput from '../../components/PasswordInput.jsx';

export default function RiderSignup() {
  usePageMeta({ title: 'Ride with Ahmars Food', noindex: true });
  const { riderSignup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', bikeNumber: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await riderSignup(form); navigate('/rider', { replace: true }); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="card mx-auto mt-6 max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Ride with Ahmars Food</h1>
      <p className="text-sm text-ink/70">You need a smartphone with mobile data and GPS. We will text a code to confirm your number, then we review your application.</p>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili" role="alert">{error}</p>}
      <div><label className="label" htmlFor="rs-name">Full name</label><input id="rs-name" className="input" value={form.name} onChange={set('name')} required /></div>
      <div><label className="label" htmlFor="rs-phone">Phone number</label><input id="rs-phone" className="input" type="tel" placeholder="0811 407 7101" value={form.phone} onChange={set('phone')} required /></div>
      <div><label className="label" htmlFor="rs-bike">Bike number</label><input id="rs-bike" className="input" value={form.bikeNumber} onChange={set('bikeNumber')} required /></div>
      <div><label className="label" htmlFor="rs-pw">Password (8+ characters)</label><PasswordInput id="rs-pw" minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" required /></div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Apply to ride'}</button>
      <p className="text-center text-sm text-ink/60">Already a rider? <Link to="/login" className="font-semibold text-forest">Log in</Link></p>
    </form>
  );
}
