import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { errMsg, getConfig } from '../api';
import MapPicker from '../components/MapPicker.jsx';
import { naira } from '../utils/money';
import { haversineKm, feeFor } from '../utils/geo';
import { usePageMeta } from '../hooks/usePageMeta.js';

const localPhone = (p) => (p?.startsWith('234') ? '0' + p.slice(3) : p || '');

const METHODS = [
  { id: 'paystack', title: 'Paystack', sub: 'Card, bank transfer or USSD' },
  { id: 'opay', title: 'Opay', sub: 'Opay wallet, transfer or card' },
  { id: 'pod', title: 'Pay on delivery', sub: 'Cash or transfer when your food arrives' },
];

export default function Checkout() {
  usePageMeta({ title: 'Checkout | Ahmars Food', noindex: true });
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const placed = useRef(false); // stops the empty-cart redirect from fighting the post-order redirect

  const [cfg, setCfg] = useState(null);
  const [pin, setPin] = useState(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [method, setMethod] = useState('paystack');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: localPhone(user?.phone), deliveryAddress: '', landmark: '', note: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { getConfig().then(setCfg).catch((e) => setError(errMsg(e))); }, []);

  if (items.length === 0 && !placed.current) return <Navigate to="/cart" replace />;

  const r = cfg?.restaurant;
  const distanceKm = pin && r ? haversineKm(r.lat, r.lng, pin.lat, pin.lng) : null;
  const outside = distanceKm != null && distanceKm > cfg.delivery.maxRadiusKm;
  const fee = distanceKm != null && !outside ? feeFor(distanceKm, cfg.delivery) : null;
  const total = subtotal + (fee || 0);
  const podAllowed = !cfg || total <= cfg.maxPodAmount;
  const activeMethod = method === 'pod' && !podAllowed ? 'paystack' : method;

  const useMyLocation = () => {
    setGeoMsg('Finding you…');
    if (!navigator.geolocation) return setGeoMsg('Your browser cannot share its location. Tap the map instead.');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoMsg(''); },
      () => setGeoMsg('Could not get your location. Tap the map to drop the pin instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pin) return setError('Drop a pin on the map so the rider can find you.');
    if (outside) return setError(`Sorry, we only deliver within ${cfg.delivery.maxRadiusKm} km of the restaurant.`);
    setBusy(true);
    try {
      const { data } = await api.post('/orders', {
        items: items.map((i) => ({ foodId: i.foodId, qty: i.qty })),
        paymentMethod: activeMethod,
        deliveryAddress: form.deliveryAddress,
        landmark: form.landmark,
        note: form.note,
        name: form.name,
        phone: form.phone,
        lat: pin.lat,
        lng: pin.lng,
      });
      placed.current = true;
      clear();
      const url = data.payment?.authorizationUrl || data.payment?.cashierUrl;
      if (url) window.location.assign(url); // off to Paystack / Opay; they send the customer back to the order page
      else navigate(`/orders/${data.order._id}`, { replace: true, state: { paymentError: data.paymentError } });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <h1 className="text-3xl font-bold">Checkout</h1>

        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Who is this for?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
            <div><label className="label">Phone (the rider will call this)</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} required /></div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Where should we deliver?</h2>
          {cfg ? (
            <>
              <MapPicker center={[r.lat, r.lng]} radiusKm={cfg.delivery.maxRadiusKm} value={pin} onChange={setPin} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-ghost" onClick={useMyLocation}>📍 Use my location</button>
                <span className="text-sm text-ink/60">{geoMsg || 'Or tap the map. Drag the red pin to adjust it.'}</span>
              </div>
              {outside && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">That pin is {distanceKm.toFixed(1)} km away. We deliver within {cfg.delivery.maxRadiusKm} km.</p>}
            </>
          ) : <p className="text-ink/60">Loading map…</p>}
          <div><label className="label">Address or hostel / gate name</label><input className="input" placeholder="e.g. Female Hostel B, FUL, Maraba Akunza" value={form.deliveryAddress} onChange={set('deliveryAddress')} required /></div>
          <div><label className="label">Landmark (optional)</label><input className="input" placeholder="e.g. beside the main gate" value={form.landmark} onChange={set('landmark')} /></div>
          <div><label className="label">Note for the kitchen or rider (optional)</label><textarea className="input" rows={2} maxLength={300} value={form.note} onChange={set('note')} /></div>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-bold">How would you like to pay?</h2>
          {METHODS.map((m) => {
            const disabled = m.id === 'pod' && !podAllowed;
            return (
              <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${activeMethod === m.id ? 'border-forest bg-forest/5' : 'border-ink/10'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input type="radio" name="method" className="mt-1" checked={activeMethod === m.id} disabled={disabled} onChange={() => setMethod(m.id)} />
                <span>
                  <span className="block font-semibold">{m.title}</span>
                  <span className="block text-sm text-ink/60">{disabled ? `Pay on delivery is for orders up to ${naira(cfg.maxPodAmount)}` : m.sub}</span>
                </span>
              </label>
            );
          })}
        </section>
      </div>

      <aside className="lg:col-span-2">
        <div className="card sticky top-24 space-y-3">
          <h2 className="text-lg font-bold">Your order</h2>
          <ul className="space-y-1 text-sm">
            {items.map((i) => <li key={i.foodId} className="flex justify-between gap-3"><span>{i.qty} × {i.name}</span><span className="font-mono">{naira(i.price * i.qty)}</span></li>)}
          </ul>
          <div className="space-y-1 border-t border-dashed border-ink/20 pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{naira(subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery{distanceKm != null && !outside ? ` (${distanceKm.toFixed(1)} km)` : ''}</span><span className="font-mono">{fee != null ? naira(fee) : 'Pin your location'}</span></div>
            <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-bold"><span>Total</span><span className="font-mono">{naira(total)}</span></div>
          </div>
          {fee != null && <p className="text-xs text-ink/50">The final delivery fee is confirmed when you place the order.</p>}
          {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
          <button className="btn-accent w-full" disabled={busy || !cfg}>
            {busy ? 'Placing order…' : activeMethod === 'pod' ? 'Place order' : 'Place order and pay'}
          </button>
        </div>
      </aside>
    </form>
  );
}
