import { useCallback, useRef, useState } from 'react';
import api, { errMsg } from '../../api';
import StatusBadge from '../../components/StatusBadge.jsx';
import { usePoll } from '../../hooks/usePoll.js';
import { beep } from '../../utils/alert.js';
import { naira } from '../../utils/money';

const TABS = [
  { id: 'active', label: 'Active', status: '' },
  { id: 'pay', label: 'Awaiting payment', status: 'Pending Payment' },
  { id: 'done', label: 'Delivered', status: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled', status: 'Cancelled' },
];
const ACTIVE = ['Pending', 'Preparing', 'On The Way'];
const METHOD = { paystack: 'Paystack', opay: 'Opay', pod: 'Pay on delivery' };
const time = (d) => new Date(d).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' });

function DeliveryLine({ d }) {
  if (!d) return <p className="text-ink/60">Rider search has not started.</p>;
  const rider = d.rider?.user;
  if (d.status === 'Unassigned') return <p className="font-semibold text-chili">No rider available. Assign one or search again.</p>;
  if (['Searching', 'Offered'].includes(d.status)) return <p>Finding a rider{d.status === 'Offered' && rider ? ` (offered to ${rider.name})` : ''}…</p>;
  return (
    <p>
      Rider: <b>{rider?.name}</b> · {d.status}
      {rider?.phone && <> · <a className="text-forest underline" href={`tel:+${rider.phone}`}>{rider.phone}</a></>}
    </p>
  );
}

export default function AdminOrders() {
  const [tab, setTab] = useState('active');
  const [orders, setOrders] = useState(null);
  const [riders, setRiders] = useState([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState('');
  const [assignFor, setAssignFor] = useState('');
  const [riderId, setRiderId] = useState('');
  const prevPending = useRef(null);

  const load = useCallback(async () => {
    try {
      const t = TABS.find((x) => x.id === tab);
      const [o, r] = await Promise.all([api.get('/admin/orders', { params: { limit: 100, ...(t.status ? { status: t.status } : {}) } }), api.get('/admin/riders')]);
      const list = tab === 'active' ? o.data.orders.filter((x) => ACTIVE.includes(x.status)) : o.data.orders;
      const waiting = list.filter((x) => x.status === 'Pending').length;
      if (prevPending.current !== null && waiting > prevPending.current) beep(); // a new paid order arrived
      prevPending.current = waiting;
      setOrders(list);
      setRiders(r.data.riders);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  }, [tab]);
  usePoll(load, 10000, { key: tab });

  const run = async (id, fn, say) => {
    setBusyId(id); setError(''); setNote('');
    try { const r = await fn(); if (say) setNote(say(r)); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusyId(''); }
  };
  const prepare = (o) => run(o._id, () => api.patch(`/admin/orders/${o._id}/status`, { status: 'Preparing' }));
  const cancel = (o) => {
    const warn = o.paymentStatus === 'paid' ? ' It was paid online, so you will have to refund the customer yourself.' : '';
    if (!window.confirm(`Cancel order ${o.orderNo}?${warn}`)) return;
    run(o._id, () => api.patch(`/admin/orders/${o._id}/status`, { status: 'Cancelled' }), (r) => (r.data.refundNeeded ? `Cancelled. Refund ${naira(o.total)} to ${o.customerName} yourself.` : 'Order cancelled.'));
  };
  const assign = (o) => run(o._id, async () => { await api.post(`/admin/orders/${o._id}/assign`, { riderId }); setAssignFor(''); setRiderId(''); }, () => 'Rider assigned.');
  const redispatch = (o) => run(o._id, () => api.post(`/admin/orders/${o._id}/redispatch`), () => 'Searching again…');

  const unassigned = (orders || []).filter((o) => o.delivery?.status === 'Unassigned' && ACTIVE.includes(o.status)).length;
  const ridersSorted = [...riders].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setOrders(null); setTab(t.id); }} className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${tab === t.id ? 'bg-ink text-white' : ''}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink/50">Updates by itself every 10 seconds. You hear a beep when a new paid order arrives.</p>

      {unassigned > 0 && <p className="rounded-lg bg-chili/10 p-3 text-sm font-semibold text-chili">{unassigned} order(s) have no rider. Assign one below.</p>}
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {note && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{note}</p>}
      {orders === null && !error && <p className="text-ink/60">Loading…</p>}
      {orders?.length === 0 && <p className="card text-ink/60">No orders here.</p>}

      {orders?.map((o) => {
        const d = o.delivery;
        const canAssign = ['Pending', 'Preparing'].includes(o.status) && !['Delivered', 'Cancelled'].includes(d?.status);
        const busy = busyId === o._id;
        return (
          <div key={o._id} className="card space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono font-bold">{o.orderNo} <span className="font-sans font-normal text-ink/50">· {time(o.createdAt)}</span></p>
              <StatusBadge status={o.status} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p><b>{o.customerName}</b> · <a className="text-forest underline" href={`tel:+${o.customerPhone}`}>{o.customerPhone}</a></p>
                <p className="text-ink/70">{o.deliveryAddress}{o.landmark ? `, ${o.landmark}` : ''}</p>
                {o.note && <p className="text-ink/70">Note: {o.note}</p>}
              </div>
              <div>
                <ul>{o.items.map((i) => <li key={i.food}>{i.qty} × {i.name}</li>)}</ul>
                <p className="mt-1 font-mono font-bold">{naira(o.total)} <span className="font-sans font-normal text-ink/60">({METHOD[o.paymentMethod]}, {o.paymentStatus === 'paid' ? 'paid' : o.paymentMethod === 'pod' ? 'collect on delivery' : 'not paid'})</span></p>
              </div>
            </div>
            {o.status !== 'Pending Payment' && <DeliveryLine d={d} />}

            <div className="flex flex-wrap gap-2">
              {o.status === 'Pending' && <button className="btn-primary" disabled={busy} onClick={() => prepare(o)}>Start preparing</button>}
              {canAssign && <button className="btn-ghost" disabled={busy} onClick={() => setAssignFor(assignFor === o._id ? '' : o._id)}>Assign rider</button>}
              {canAssign && ['Unassigned', 'Searching'].includes(d?.status) && <button className="btn-ghost" disabled={busy} onClick={() => redispatch(o)}>Search again</button>}
              {['Pending Payment', 'Pending', 'Preparing'].includes(o.status) && <button className="btn-ghost !text-chili" disabled={busy} onClick={() => cancel(o)}>Cancel</button>}
            </div>

            {assignFor === o._id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-cream p-3">
                <select className="input !w-auto min-w-[14rem]" value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                  <option value="">Choose a rider…</option>
                  {ridersSorted.map((r) => <option key={r._id} value={r._id}>{r.user?.name} ({r.bikeNumber}){r.isOnline ? ' · online' : ' · offline'}{r.isAvailable ? '' : ' · busy'}</option>)}
                </select>
                <button className="btn-primary" disabled={!riderId || busy} onClick={() => assign(o)}>Assign</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
