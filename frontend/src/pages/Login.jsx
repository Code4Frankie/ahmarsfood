import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api';
import { homeFor } from '../siteLinks.js';
import { usePageMeta } from '../hooks/usePageMeta.js';

export default function Login() {
  usePageMeta({ title: 'Log in | Ahmars Food', noindex: true });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { const u = await login(form.identifier, form.password); navigate(from !== '/' ? from : homeFor(u.role), { replace: true }); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="card mx-auto mt-6 max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Log in</h1>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      <div><label className="label">Phone number or email</label><input className="input" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} autoComplete="username" required /></div>
      <div><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" required /></div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="text-center text-sm text-ink/60">New here? <Link to="/register" state={{ from: location.state?.from }} className="font-semibold text-forest">Create an account</Link></p>
    </form>
  );
}
