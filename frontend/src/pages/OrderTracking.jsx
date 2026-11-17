import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import api, { errMsg, getConfig } from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import { TrackMap } from '../components/MapPicker.jsx';
import { naira } from '../utils/money';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { getGuestToken, saveGuestToken } from '../utils/guestOrders.js';

const FLOW = ['Pending Payment', 'Pending', 'Preparing', 'On The Way', 'Delivered'];
const STEP_LABEL = { 'Pending Payment': 'Payment', Pending: 'Received', Preparing: 'Preparing', 'On The Way': 'On the way', Delivered: 'Delivered' };
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

  // Back from Paystack/Opay with ?ref=: ask the server to verify (it asks the provider), then show the result.
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
      window.location.assign(res.payment.authorizationUrl || res.payment.cashierUrl);
    } catch (e) { setNotice(errMsg(e)); setBusy(false); }
  };

  if (error && !data) return <p className="rounded-lg bg-chili/10 p-4 text-chili">{error}</p>;
  if (!order) return <p className="py-10 text-center text-ink/60">Loading your order…</p>;

  const flow = FLOW;
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
                <span className={`mt-1 text-xs ${i <= idx ? 'font-semibold' : 'text-ink/50'}`}>{STEP_LABEL[s]}</span>
              </li>
            ))}
          </ol>
          {!finished && eta && order.status !== 'Pending Payment' && <p className="mt-4 text-center text-sm text-ink/70">Estimated time: about <b>{eta} min</b> from when your order was confirmed</p>}
        </div>
      )}

      {order.status === 'Pending Payment' && (
        <div className="card space-y-3">
          <p className="font-semibold">Your order is waiting for payment. The kitchen starts once it is confirmed.</p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" disabled={busy} onClick={() => payAgain('paystack')}>Pay with Paystack</button>
            <button className="btn-accent" disabled={busy} onClick={() => payAgain('opay')}>Pay with Opay</button>
          </div>
        </div>
      )}

      {['Pending', 'Preparing'].includes(order.status) && delivery && FINDING.includes(delivery.status) && (
        <p className="card text-sm text-ink/70">🛵 We are finding a rider for you. This page updates by itself.</p>
      )}

      {rider && order.status !== 'Cancelled' && (
        <div className="card space-y-3">
          <h2 className="text-lg font-bold">Your rider</h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{rider.name}</p>
              <p className="text-sm text-ink/60">Bike {rider.bikeNumber}</p>
            </div>
            <a className="btn-primary" href={`tel:+${rider.phone}`}>📞 Call rider</a>
          </div>
          {!finished && <TrackMap rider={rider.location} destination={{ lat: order.lat, lng: order.lng }} />}
        </div>
      )}

      <div className="card space-y-2 text-sm">
        <h2 className="text-lg font-bold">Details</h2>
        {order.items.map((i) => <div key={i.food} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="font-mono">{naira(i.price * i.qty)}</span></div>)}
        <div className="flex justify-between border-t border-dashed border-ink/20 pt-2"><span>Delivery</span><span className="font-mono">{naira(order.deliveryFee)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>Total</span><span className="font-mono">{naira(order.total)}</span></div>
        <p className="pt-2 text-ink/60">
          {order.paymentStatus === 'paid' ? `Paid online (${order.paymentMethod === 'opay' ? 'Opay' : 'Paystack'}).` : 'Not paid yet.'}
        </p>
        <p className="text-ink/60">Delivering to: {order.deliveryAddress}{order.landmark ? `, ${order.landmark}` : ''}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/orders" className="btn-ghost">All my orders</Link>
        {wa && <a className="btn-accent" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello Ahmars Food, about my order ${order.orderNo}`)}`}>Chat on WhatsApp</a>}
      </div>
    </div>
  );
}
