import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import api, { errMsg, getConfig } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import { TrackMap } from '../components/MapPicker.jsx';
import { naira } from '../utils/money';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { getGuestToken, saveGuestToken } from '../utils/guestOrders.js';

const FLOW = ['Pending Payment', 'Pending', 'Preparing', 'On The Way', 'Delivered'];
const PICKUP_FLOW = ['Pending Payment', 'Pending', 'Preparing', 'Ready for Pickup', 'Delivered'];
const STEP_LABEL = { 'Pending Payment': 'Payment', Pending: 'Received', Preparing: 'Preparing', 'On The Way': 'On the way', 'Ready for Pickup': 'Ready', Delivered: 'Delivered' };
const FINDING = ['Searching', 'Offered', 'Unassigned'];

export default function OrderTracking() {
  usePageMeta({ title: 'Track your order | Ahmars Food', noindex: true });
  const { id } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.paymentError || '');
  const [busy, setBusy] = useState(false);

  // Guests open their order with the secret from the link (?t=...); it is also remembered on this device.
  const token = useRef(params.get('t') || getGuestToken(id));
  useEffect(() => { saveGuestToken(id, token.current); }, [id]);
  const auth = () => (token.current ? { headers: { 'x-order-token': token.current } } : undefined);

  const load = useCallback(async () => {
    try { setData((await api.get(`/orders/${id}`, auth())).data); setError(''); }
    catch (e) { setError(errMsg(e)); }
  }, [id]);

  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  // Back from Paystack with ?ref=: ask the server to verify (it asks the provider), then show the result.
  useEffect(() => {
    (async () => {
      const ref = params.get('ref');
      if (ref) {
        try { await api.get(`/payments/verify/${encodeURIComponent(ref)}`, auth()); } catch { /* the order page shows the real status */ }
        setParams(token.current ? { t: token.current } : {}, { replace: true });
      }
      await load();
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const order = data?.order;
  const delivery = data?.delivery;
  const finished = order && ['Delivered', 'Cancelled'].includes(order.status);

  useEffect(() => {
    if (!order || finished) return undefined;
    const t = setInterval(load, 8000); // simple polling; WebSockets can replace this later
    return () => clearInterval(t);
  }, [order?._id, finished, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const payAgain = async (provider) => {
    setBusy(true); setNotice('');
    try {
      const { data: res } = await api.post(`/payments/${provider}/init`, { orderId: id }, auth());
      if (res.payment.authorizationUrl) { window.location.assign(res.payment.authorizationUrl); return; }
      await load(); // switched to bank transfer: the page now shows the account details
      setBusy(false);
    } catch (e) { setNotice(errMsg(e)); setBusy(false); }
  };

  const copy = (text) => { try { navigator.clipboard?.writeText(text); setNotice(''); } catch { /* ignore */ } };
  const transferSent = async () => {
    setBusy(true); setNotice('');
    try { await api.post(`/orders/${id}/transfer-sent`, null, auth()); await load(); }
    catch (e) { setNotice(errMsg(e)); }
    finally { setBusy(false); }
  };

  if (error && !data) return <p className="rounded-lg bg-chili/10 p-4 text-chili">{error}</p>;
  if (!order) return <p className="py-10 text-center text-ink/60">Loading your order…</p>;

  const isPickup = order.fulfillment === 'pickup';
  const flow = isPickup ? PICKUP_FLOW : FLOW;
  const bank = cfg?.bank;
  const idx = flow.indexOf(order.status);
  const rider = delivery?.rider;
  const eta = delivery?.estimatedTime || order.estimatedTime;
  const wa = cfg?.restaurant?.whatsapp;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-ink/60">Order</p>
          <h1 className="font-mono text-2xl font-bold">{order.orderNo}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {!order.user && (
        <p className="rounded-lg bg-gold/25 p-3 text-sm">
          You ordered as a guest. <b>Save this page</b> (bookmark it, or screenshot your order number {order.orderNo}) to check on your food later.{' '}
          <Link to="/register" className="font-semibold text-forest">Create an account</Link> to keep all your orders in one place.
        </p>
      )}

      {notice && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{notice}</p>}

      {order.status === 'Cancelled' ? (
        <div className="card border-chili/30 bg-chili/5">
          <p className="font-bold text-chili">This order was cancelled.</p>
          <p className="text-sm text-ink/70">If you already paid, message us on WhatsApp with your order number and we will sort out your refund.</p>
        </div>
      ) : (
        <div className="card">
          <ol className="flex items-start justify-between">
            {flow.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center text-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i <= idx ? 'bg-forest text-white' : 'bg-ink/10 text-ink/50'}`}>{i < idx || order.status === 'Delivered' ? '✓' : i + 1}</span>
                <span className={`mt-1 text-xs ${i <= idx ? 'font-semibold' : 'text-ink/50'}`}>{isPickup && s === 'Delivered' ? 'Collected' : STEP_LABEL[s]}</span>
              </li>
            ))}
          </ol>
          {!finished && eta && order.status !== 'Pending Payment' && <p className="mt-4 text-center text-sm text-ink/70">Estimated time: about <b>{eta} min</b> from when your order was confirmed</p>}
        </div>
      )}

      {order.status === 'Pending Payment' && order.paymentMethod === 'transfer' && bank && (
        <div className="card space-y-3">
          <p className="font-semibold">Send {naira(order.total)} to this account to start your order.</p>
          <dl className="space-y-1 rounded-lg bg-cream p-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Bank</dt><dd className="font-semibold">{bank.name}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-ink/60">Account number</dt><dd className="font-mono text-lg font-bold">{bank.accountNumber} <button type="button" className="ml-1 rounded border border-ink/20 px-2 py-0.5 font-sans text-xs font-semibold text-forest" onClick={() => copy(bank.accountNumber)}>Copy</button></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Account name</dt><dd className="font-semibold">{bank.accountName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Amount</dt><dd className="font-mono font-bold">{naira(order.total)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Narration / reference</dt><dd className="font-mono font-bold">{order.orderNo}</dd></div>
          </dl>
          <p className="text-sm text-ink/70">Send the exact amount and put <b>{order.orderNo}</b> as the narration so we can match it. We start your order as soon as we see the money.</p>
          {order.transferClaimedAt ? (
            <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">Thank you. We are checking for your transfer and will confirm shortly. This page updates by itself.</p>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={transferSent}>I have sent the money</button>
          )}
          <button type="button" className="text-sm font-semibold text-forest underline" disabled={busy} onClick={() => payAgain('paystack')}>Pay by card or online instead</button>
        </div>
      )}

      {order.status === 'Pending Payment' && order.paymentMethod !== 'transfer' && (
        <div className="card space-y-3">
          <p className="font-semibold">Your order is waiting for payment. The kitchen starts once it is confirmed.</p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" disabled={busy} onClick={() => payAgain('paystack')}>Pay online</button>
            <button className="btn-ghost" disabled={busy} onClick={() => payAgain('transfer')}>Pay by bank transfer instead</button>
          </div>
        </div>
      )}

      {isPickup && order.status === 'Ready for Pickup' && (
        <div className="card border-forest/40 bg-forest/10">
          <p className="text-lg font-bold text-forest-dark">Your food is ready! 🎉</p>
          <p className="text-sm text-ink/80">Come and collect it at {cfg?.pickup?.address || 'the restaurant'}. Show your order number <b>{order.orderNo}</b>.</p>
        </div>
      )}

      {!isPickup && ['Pending', 'Preparing'].includes(order.status) && delivery && FINDING.includes(delivery.status) && (
        <p className="card text-sm text-ink/70">🛵 We are arranging a rider for you. This page updates by itself.</p>
      )}

      {!isPickup && rider && order.status !== 'Cancelled' && (
        <div className="card space-y-3">
          <h2 className="text-lg font-bold">Your rider</h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{rider.name}</p>
              <p className="text-sm text-ink/60">{rider.byCall ? 'Arranged by our team' : `Bike ${rider.bikeNumber}`}</p>
            </div>
            <a className="btn-primary" href={`tel:+${rider.phone}`}>📞 Call rider</a>
          </div>
          {!finished && <TrackMap rider={rider.location} destination={{ lat: order.lat, lng: order.lng }} />}
        </div>
      )}

      <div className="card space-y-2 text-sm">
        <h2 className="text-lg font-bold">Details</h2>
        {order.items.map((i) => <div key={i.food} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="font-mono">{naira(i.price * i.qty)}</span></div>)}
        <div className="flex justify-between border-t border-dashed border-ink/20 pt-2"><span>{isPickup ? 'Pickup' : 'Delivery'}</span><span className="font-mono">{isPickup ? 'Free' : naira(order.deliveryFee)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>Total</span><span className="font-mono">{naira(order.total)}</span></div>
        <p className="pt-2 text-ink/60">
          {order.paymentStatus === 'paid' ? `Paid (${order.paymentMethod === 'transfer' ? 'bank transfer' : 'online'}).` : 'Not paid yet.'}
        </p>
        <p className="text-ink/60">{isPickup ? `Pickup at: ${cfg?.pickup?.address || 'the restaurant'}` : `Delivering to: ${order.deliveryAddress}${order.landmark ? `, ${order.landmark}` : ''}`}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/orders" className="btn-ghost">All my orders</Link>
        {wa && <a className="btn-accent" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello Ahmars Food, about my order ${order.orderNo}`)}`}>Chat on WhatsApp</a>}
      </div>
    </div>
  );
}
