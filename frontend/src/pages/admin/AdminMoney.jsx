import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { naira } from '../../utils/money';

const today = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10); // Lafia time (UTC+1)
const METHOD = { paystack: 'Paystack', transfer: 'Bank transfer' };
const CHIP = { success: 'bg-forest/15 text-forest-dark', initiated: 'bg-gold/40 text-ink', failed: 'bg-chili/15 text-chili', abandoned: 'bg-ink/10 text-ink/60' };

export default function AdminMoney() {
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState(null);
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api.get('/admin/summary/daily', { params: { date } }), api.get('/admin/payments', { params: { ...(provider && { provider }), ...(status && { status }) } })]);
      setSummary(s.data); setPayments(p.data.payments); setError('');
    } catch (e) { setError(errMsg(e)); }
  }, [date, provider, status]);
  useEffect(() => { load(); }, [load]);

  const Card = ({ label, value }) => <div className="card !p-4"><p className="text-xs text-ink/60">{label}</p><p className="font-mono text-xl font-bold">{value}</p></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Payments &amp; sales</h1>
        <input className="input !w-auto" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
      </div>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card label="Orders" value={summary.orders} />
            <Card label="Delivered" value={summary.delivered} />
            <Card label="Paid revenue" value={naira(summary.revenue)} />
          </div>
          {Object.keys(summary.byMethod).length > 0 && (
            <p className="text-sm text-ink/70">{Object.entries(summary.byMethod).map(([m, v]) => `${METHOD[m] || m}: ${v.orders} order(s), ${naira(v.amount)}`).join(' · ')}</p>
          )}
        </>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">Payments</h2>
          <select className="input !w-auto" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="">All providers</option><option>Paystack</option><option>Transfer</option></select>
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>success</option><option>initiated</option><option>failed</option><option>abandoned</option></select>
        </div>
        {payments?.length === 0 && <p className="card text-ink/60">No payments match.</p>}
        <div className="space-y-2">
          {payments?.map((p) => (
            <div key={p._id} className="card space-y-1 !p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><b>{p.provider}</b> · <span className="font-mono">{p.order?.orderNo}</span> · {p.order?.customerName}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[p.status]}`}>{p.status}</span>
              </div>
              <p className="font-mono text-xs text-ink/60">{p.reference} · {naira(p.amount)} · {new Date(p.createdAt).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}</p>
              {p.note && <p className="rounded bg-chili/10 p-2 text-xs font-semibold text-chili">{p.note}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
