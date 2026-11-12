import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import { naira } from '../utils/money';
import { usePageMeta } from '../hooks/usePageMeta.js';

export default function Orders() {
  usePageMeta({ title: 'My orders | Ahmars Food', noindex: true });
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/orders/mine').then((r) => setOrders(r.data.orders)).catch((e) => setError(errMsg(e)));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-3xl font-bold">My orders</h1>
      {error && <p className="rounded-lg bg-chili/10 p-4 text-chili">{error}</p>}
      {!orders && !error && <p className="text-ink/60">Loading…</p>}
      {orders?.length === 0 && (
        <div className="card text-center"><p className="mb-3 text-ink/60">No orders yet.</p><Link to="/" className="btn-primary">Browse the menu</Link></div>
      )}
      <div className="space-y-3">
        {orders?.map((o) => (
          <Link key={o._id} to={`/orders/${o._id}`} className="card flex items-center justify-between gap-3 transition hover:border-forest">
            <div>
              <p className="font-mono text-sm font-bold">{o.orderNo}</p>
              <p className="text-sm text-ink/60">{new Date(o.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })} · {o.items.reduce((s, i) => s + i.qty, 0)} items</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold">{naira(o.total)}</p>
              <StatusBadge status={o.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
