import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api';
import { homeFor } from '../siteLinks.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Register() {
  usePageMeta({ title: 'Create an account | Ahmars Food', noindex: true });
  const { register } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from?.pathname || '/';
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { const u = await register(form); navigate(from !== '/' ? from : homeFor(u.role), { replace: true }); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="card mx-auto mt-6 max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Create your account</h1>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      <div><label className="label">Full name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
      <div><label className="label">Phone number</label><input className="input" type="tel" placeholder="0811 407 7101" value={form.phone} onChange={set('phone')} required /></div>
      <div><label className="label">Email (optional)</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
      <div><label className="label">Password (8+ characters)</label><PasswordInput minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" required /></div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="text-center text-sm text-ink/60">Already have an account? <Link to="/login" className="font-semibold text-forest">Log in</Link></p>
    </form>
  );
}
