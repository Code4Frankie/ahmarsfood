import { useCallback, useRef, useState } from 'react';
import api, { errMsg } from '../../api';
import StatusBadge from '../../components/StatusBadge.jsx';
import { usePoll } from '../../hooks/usePoll.js';
import { beep } from '../../utils/alert.js';
import { naira } from '../../utils/money';
import DeliverySwitch from './DeliverySwitch.jsx';

const TABS = [
  { id: 'active', label: 'Active', status: '' },
  { id: 'pay', label: 'Awaiting payment', status: 'Pending Payment' },
  { id: 'done', label: 'Delivered', status: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled', status: 'Cancelled' },
];
const ACTIVE = ['Pending', 'Preparing', 'Ready for Pickup', 'On The Way'];
const METHOD = { paystack: 'Paystack', transfer: 'Bank transfer' };
const awaitingTransfer = (o) => o.status === 'Pending Payment' && o.paymentMethod === 'transfer' && o.transferClaimedAt;
const time = (d) => new Date(d).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' });

function DeliveryLine({ d }) {
  if (!d) return <p className="text-ink/60">Rider search has not started.</p>;
  const rider = d.rider?.user;
  if (d.manual && d.manualRider) {
    return (
      <p>
        Call-in rider: <b>{d.manualRider.name}</b> · {d.status}
        {d.manualRider.phone && <> · <a className="text-forest underline" href={`tel:+${d.manualRider.phone}`}>{d.manualRider.phone}</a></>}
      </p>
    );
  }
  if (d.status === 'Unassigned') return <p className="font-semibold text-chili">No rider yet. Call a bike rider, assign an app rider, or search again.</p>;
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
  const [callFor, setCallFor] = useState('');
  const [callName, setCallName] = useState('');
  const [callPhone, setCallPhone] = useState('');
  const prevPending = useRef(null);

  const load = useCallback(async () => {
    try {
      const t = TABS.find((x) => x.id === tab);
      const [o, r] = await Promise.all([api.get('/admin/orders', { params: { limit: 100, ...(t.status ? { status: t.status } : {}) } }), api.get('/admin/riders')]);
      // Active also shows bank transfers the customer says they have sent, so they are not missed.
      const list = tab === 'active' ? o.data.orders.filter((x) => ACTIVE.includes(x.status) || awaitingTransfer(x)) : o.data.orders;
      const waiting = list.filter((x) => x.status === 'Pending' || awaitingTransfer(x)).length;
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
  const setStatus = (o, status) => run(o._id, () => api.patch(`/admin/orders/${o._id}/status`, { status }));
  const prepare = (o) => setStatus(o, 'Preparing');
  const confirmTransfer = (o) => {
    if (!window.confirm(`Confirm that ${naira(o.total)} for ${o.orderNo} has arrived in the Moniepoint account? Check the exact amount and the narration first.`)) return;
    run(o._id, () => api.post(`/admin/orders/${o._id}/confirm-transfer`), () => 'Payment confirmed. The order is now with the kitchen.');
  };
  const cancel = (o) => {
    const warn = o.paymentStatus === 'paid' ? ' It was paid online, so you will have to refund the customer yourself.' : '';
    if (!window.confirm(`Cancel order ${o.orderNo}?${warn}`)) return;
    run(o._id, () => api.patch(`/admin/orders/${o._id}/status`, { status: 'Cancelled' }), (r) => (r.data.refundNeeded ? `Cancelled. Refund ${naira(o.total)} to ${o.customerName} yourself.` : 'Order cancelled.'));
  };
  const assign = (o) => run(o._id, async () => { await api.post(`/admin/orders/${o._id}/assign`, { riderId }); setAssignFor(''); setRiderId(''); }, () => 'Rider assigned.');
  const callRider = (o) => run(o._id, async () => { await api.post(`/admin/orders/${o._id}/call-rider`, { name: callName, phone: callPhone }); setCallFor(''); setCallName(''); setCallPhone(''); }, () => 'Bike rider recorded. Customer can now see their name and number.');
  const callStatus = (o, status) => run(o._id, () => api.patch(`/admin/orders/${o._id}/call-rider-status`, { status }));
  const redispatch = (o) => run(o._id, () => api.post(`/admin/orders/${o._id}/redispatch`), () => 'Searching again…');

  const unassigned = (orders || []).filter((o) => o.fulfillment !== 'pickup' && o.delivery?.status === 'Unassigned' && ACTIVE.includes(o.status)).length;
  const transfers = (orders || []).filter(awaitingTransfer).length;
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

      <DeliverySwitch />

      {transfers > 0 && <p className="rounded-lg bg-gold/30 p-3 text-sm font-semibold">{transfers} bank transfer(s) to confirm. Check the Moniepoint app, then press "Confirm transfer received".</p>}
      {unassigned > 0 && <p className="rounded-lg bg-chili/10 p-3 text-sm font-semibold text-chili">{unassigned} order(s) have no rider. Call a bike rider or assign one below.</p>}
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {note && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{note}</p>}
      {orders === null && !error && <p className="text-ink/60">Loading…</p>}
      {orders?.length === 0 && <p className="card text-ink/60">No orders here.</p>}

      {orders?.map((o) => {
        const d = o.delivery;
        const isPickup = o.fulfillment === 'pickup';
        const canAssign = !isPickup && ['Pending', 'Preparing'].includes(o.status) && !['Delivered', 'Cancelled'].includes(d?.status);
        const busy = busyId === o._id;
        return (
          <div key={o._id} className="card space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono font-bold">{o.orderNo} {isPickup && <span className="rounded-full bg-gold/40 px-2 py-0.5 font-sans text-xs font-bold">PICKUP</span>} <span className="font-sans font-normal text-ink/50">· {time(o.createdAt)}</span></p>
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
                <p className="mt-1 font-mono font-bold">{naira(o.total)} <span className="font-sans font-normal text-ink/60">({METHOD[o.paymentMethod]}, {o.paymentStatus === 'paid' ? 'paid' : 'not paid'})</span></p>
              </div>
            </div>
            {o.status !== 'Pending Payment' && !isPickup && <DeliveryLine d={d} />}
            {awaitingTransfer(o) && <p className="rounded bg-gold/30 p-2 font-semibold">Customer says they sent {naira(o.total)} by transfer. Look for narration {o.orderNo}.</p>}

            <div className="flex flex-wrap gap-2">
              {o.status === 'Pending Payment' && o.paymentMethod === 'transfer' && <button className="btn-primary" disabled={busy} onClick={() => confirmTransfer(o)}>Confirm transfer received</button>}
              {o.status === 'Pending' && <button className="btn-primary" disabled={busy} onClick={() => prepare(o)}>Start preparing</button>}
              {isPickup && o.status === 'Preparing' && <button className="btn-primary" disabled={busy} onClick={() => setStatus(o, 'Ready for Pickup')}>Ready for pickup</button>}
              {isPickup && o.status === 'Ready for Pickup' && <button className="btn-primary" disabled={busy} onClick={() => setStatus(o, 'Delivered')}>Customer collected it</button>}
              {canAssign && <button className="btn-primary" disabled={busy} onClick={() => { setCallFor(callFor === o._id ? '' : o._id); setAssignFor(''); }}>Call a bike rider</button>}
              {d?.manual && d.status === 'Accepted' && <button className="btn-ghost" disabled={busy} onClick={() => callStatus(o, 'Picked Up')}>Rider picked it up</button>}
              {d?.manual && d.status === 'Picked Up' && <button className="btn-ghost" disabled={busy} onClick={() => callStatus(o, 'On The Way')}>On the way</button>}
              {d?.manual && d.status === 'On The Way' && <button className="btn-primary" disabled={busy} onClick={() => callStatus(o, 'Delivered')}>Delivered</button>}
              {canAssign && <button className="btn-ghost" disabled={busy} onClick={() => { setAssignFor(assignFor === o._id ? '' : o._id); setCallFor(''); }}>Assign app rider</button>}
              {canAssign && ['Unassigned', 'Searching'].includes(d?.status) && <button className="btn-ghost" disabled={busy} onClick={() => redispatch(o)}>Search again</button>}
              {['Pending Payment', 'Pending', 'Preparing', 'Ready for Pickup'].includes(o.status) && <button className="btn-ghost !text-chili" disabled={busy} onClick={() => cancel(o)}>Cancel</button>}
            </div>

            {callFor === o._id && (
              <div className="space-y-2 rounded-lg bg-cream p-3">
                <p className="text-xs text-ink/60">Phone a bike rider, then enter who is coming. The customer sees this name and number on their order page.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !w-auto min-w-[10rem] flex-1" placeholder="Rider's name" value={callName} onChange={(e) => setCallName(e.target.value)} />
                  <input className="input !w-auto min-w-[10rem] flex-1" type="tel" placeholder="Rider's phone, e.g. 0812 345 6789" value={callPhone} onChange={(e) => setCallPhone(e.target.value)} />
                  <button className="btn-primary" disabled={busy || callName.trim().length < 2 || callPhone.replace(/\D/g, '').length < 10} onClick={() => callRider(o)}>Save rider</button>
                </div>
              </div>
            )}
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
