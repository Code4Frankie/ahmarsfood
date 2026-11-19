import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { errMsg, getConfig } from '../api';
import { saveGuestToken } from '../utils/guestOrders.js';
import MapPicker from '../components/MapPicker.jsx';
import { naira } from '../utils/money';
import { haversineKm, feeFor } from '../utils/geo';
import { usePageMeta } from '../hooks/usePageMeta.js';

const localPhone = (p) => (p?.startsWith('234') ? '0' + p.slice(3) : p || '');

const METHODS = [
  { id: 'paystack', title: 'Pay online', sub: 'Card, bank transfer or USSD, confirmed instantly (Paystack)' },
  { id: 'transfer', title: 'Bank transfer', sub: 'Send the money to our Moniepoint account. We confirm it and start your order.' },
];

export default function Checkout() {
  usePageMeta({ title: 'Checkout | Ahmars Food', noindex: true });
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const placed = useRef(false); // stops the empty-cart redirect from fighting the post-order redirect

  const [cfg, setCfg] = useState(null);
  const [pin, setPinRaw] = useState(null);
  const [pinConfirmed, setPinConfirmed] = useState(false); // false while the pin is just the Lafia starting point
  const [geoMsg, setGeoMsg] = useState('');
  const [method, setMethod] = useState('paystack');
  const [fulfillment, setFulfillment] = useState('delivery'); // 'delivery' or 'pickup' (collect at the restaurant)
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: localPhone(user?.phone), deliveryAddress: '', landmark: '', note: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Any pin the customer sets (tap, drag, or GPS) counts as confirmed; the Lafia starting pin does not.
  const setPin = (p) => { setPinRaw(p); setPinConfirmed(true); };

  useEffect(() => {
    getConfig()
      .then((c) => {
        setCfg(c);
        if (c.delivery.mode === 'paused') setFulfillment('pickup'); // no rider available: start on pickup
        setPinRaw((cur) => cur || { lat: c.restaurant.lat, lng: c.restaurant.lng }); // default pin: Lafia, never the visitor's own city
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  if (items.length === 0 && !placed.current) return <Navigate to="/cart" replace />;

  const r = cfg?.restaurant;
  const paused = cfg?.delivery?.mode === 'paused';
  const pickup = fulfillment === 'pickup' || paused; // delivery is not offered while paused
  const distanceKm = !pickup && pin && pinConfirmed && r ? haversineKm(r.lat, r.lng, pin.lat, pin.lng) : null;
  const outside = distanceKm != null && distanceKm > cfg.delivery.maxRadiusKm;
  const fee = pickup ? 0 : distanceKm != null && !outside ? feeFor(distanceKm, cfg.delivery) : null;
  const total = subtotal + (fee || 0);

  const useMyLocation = () => {
    setGeoMsg('Finding you…');
    if (!navigator.geolocation) return setGeoMsg('Your browser cannot share its location. Tap the map instead.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const away = haversineKm(r.lat, r.lng, here.lat, here.lng);
        if (away > cfg.delivery.maxRadiusKm) {
          // Phone GPS is outside the delivery area (e.g. the customer is in another city): keep the pin in Lafia.
          setGeoMsg(`Your GPS location is ${away.toFixed(0)} km from Lafia, outside our delivery area. Tap the map or drag the pin to where you want the food.`);
          return;
        }
        setPin(here);
        setGeoMsg('');
      },
      () => setGeoMsg('Could not get your location. Tap the map to drop the pin instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pickup && (!pin || !pinConfirmed)) return setError('Tap the map or drag the pin to where you want the food, so the rider can find you.');
    if (!pickup && outside) return setError(`Sorry, we only deliver within ${cfg.delivery.maxRadiusKm} km of the restaurant.`);
    setBusy(true);
    try {
      const { data } = await api.post('/orders', {
        items: items.map((i) => ({ foodId: i.foodId, qty: i.qty })),
        paymentMethod: method,
        fulfillment,
        ...(pickup ? {} : { deliveryAddress: form.deliveryAddress, landmark: form.landmark, lat: pin.lat, lng: pin.lng }),
        note: form.note,
        name: form.name,
        phone: form.phone,
      });
      if (data.guestToken) saveGuestToken(data.order._id, data.guestToken);
      placed.current = true;
      clear();
      const url = data.payment?.authorizationUrl;
      if (url) window.location.assign(url); // off to Paystack; it sends the customer back to the order page
      else navigate(`/orders/${data.order._id}${data.guestToken ? `?t=${data.guestToken}` : ''}`, { replace: true, state: { paymentError: data.paymentError } });
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
          {!user && <p className="-mt-2 text-sm text-ink/70">No account needed. <Link to="/login" className="font-semibold text-forest">Log in</Link> if you have one, to keep your orders together.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
            <div><label className="label">{pickup ? 'Phone' : 'Phone (the rider will call this)'}</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} required /></div>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-bold">How do you want your food?</h2>
          {[
            { id: 'delivery', title: 'Delivery', disabled: paused, sub: paused ? `Paused right now: no rider is available${cfg.delivery.note ? ` (${cfg.delivery.note})` : ''}. Please choose pickup, or try again later.` : cfg ? `${naira(cfg.delivery.perKm)} for the first km, plus ${naira(cfg.delivery.perKm)} for each extra km. Anywhere within ${cfg.delivery.maxRadiusKm} km of the restaurant.${cfg.delivery.mode === 'manual' ? ' Our team phones a bike rider for you, so it can take a little longer to get going.' : ''}` : 'A rider brings it to you.' },
            { id: 'pickup', title: 'Pickup at the restaurant', sub: `Live at or near the restaurant? Pay now and collect it yourself at ${cfg?.pickup?.address || 'the restaurant'}. No rider and no delivery fee.` },
          ].map((o) => (
            <label key={o.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${o.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${fulfillment === o.id ? 'border-forest bg-forest/5' : 'border-ink/10'}`}>
              <input type="radio" name="fulfillment" className="mt-1" disabled={o.disabled} checked={fulfillment === o.id} onChange={() => setFulfillment(o.id)} />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-sm text-ink/60">{o.sub}</span>
              </span>
            </label>
          ))}
        </section>

        {!pickup && (
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
        )}

        {pickup && (
          <section className="card space-y-3">
            <h2 className="text-lg font-bold">Pickup details</h2>
            <p className="text-sm text-ink/70">Collect your food at {cfg?.pickup?.address || 'the restaurant'} once we mark it ready. We will keep this page updated.</p>
            <div><label className="label">Note for the kitchen (optional)</label><textarea className="input" rows={2} maxLength={300} value={form.note} onChange={set('note')} /></div>
          </section>
        )}

        <section className="card space-y-3">
          <h2 className="text-lg font-bold">How would you like to pay?</h2>
          {METHODS.map((m) => (
            <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${method === m.id ? 'border-forest bg-forest/5' : 'border-ink/10'}`}>
              <input type="radio" name="method" className="mt-1" checked={method === m.id} onChange={() => setMethod(m.id)} />
              <span>
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-sm text-ink/60">{m.sub}</span>
              </span>
            </label>
          ))}
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
            <div className="flex justify-between"><span>{pickup ? 'Pickup' : `Delivery${distanceKm != null && !outside ? ` (${distanceKm.toFixed(1)} km)` : ''}`}</span><span className="font-mono">{pickup ? 'Free' : fee != null ? naira(fee) : 'Pin your location'}</span></div>
            <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-bold"><span>Total</span><span className="font-mono">{naira(total)}</span></div>
          </div>
          {!pickup && fee != null && <p className="text-xs text-ink/50">The final delivery fee is confirmed when you place the order.</p>}
          {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
          <button className="btn-accent w-full" disabled={busy || !cfg}>
            {busy ? 'Placing order…' : method === 'transfer' ? 'Place order' : 'Place order and pay'}
          </button>
        </div>
      </aside>
    </form>
  );
}
