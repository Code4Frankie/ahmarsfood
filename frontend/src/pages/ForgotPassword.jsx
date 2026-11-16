import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { usePageMeta } from '../hooks/usePageMeta.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function ForgotPassword() {
  usePageMeta({ title: 'Reset your password | Ahmars Food', noindex: true });
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const sendCode = (e) => {
    e?.preventDefault();
    return run(async () => {
      const r = await api.post('/auth/forgot-password', { identifier });
      setInfo(r.data.message);
      setStep(2);
    });
  };

  const reset = (e) => {
    e.preventDefault();
    return run(async () => {
      await api.post('/auth/reset-password', { identifier, code, password });
      navigate('/login', { replace: true, state: { notice: 'Password changed. Log in with your new password.' } });
    });
  };

  return (
    <form onSubmit={step === 1 ? sendCode : reset} className="card mx-auto mt-6 max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili" role="alert">{error}</p>}

      {step === 1 ? (
        <>
          <p className="text-sm text-ink/70">Enter the phone number or email on your account. We will text a 6-digit code to the phone number.</p>
          <div><label className="label" htmlFor="fp-id">Phone number or email</label><input id="fp-id" className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
        </>
      ) : (
        <>
          {info && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{info}</p>}
          <div><label className="label" htmlFor="fp-code">6-digit code</label><input id="fp-code" className="input font-mono tracking-widest" inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" required /></div>
          <div><label className="label" htmlFor="fp-pw">New password (8+ characters)</label><PasswordInput id="fp-pw" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
          <p className="text-center text-sm text-ink/60">
            No code yet? Wait a minute, then <button type="button" className="font-semibold text-forest" disabled={busy} onClick={sendCode}>send it again</button>.
          </p>
        </>
      )}
      <p className="text-center text-sm text-ink/60"><Link to="/login" className="font-semibold text-forest">Back to log in</Link></p>
    </form>
  );
}
