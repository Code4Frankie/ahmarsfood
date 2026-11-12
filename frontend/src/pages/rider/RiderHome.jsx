import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';
import { TrackMap } from '../../components/MapPicker.jsx';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { usePoll } from '../../hooks/usePoll.js';
import { beep } from '../../utils/alert.js';
import { naira } from '../../utils/money';

const NEXT = { Accepted: 'Picked Up', 'Picked Up': 'On The Way', 'On The Way': 'Delivered' };
const LABEL = { 'Picked Up': 'I have picked up the food', 'On The Way': "I'm on my way to the customer", Delivered: 'Delivered' };

export default function RiderHome() {
  usePageMeta({ title: 'Rider | Ahmars Food', noindex: true });
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [ready, setReady] = useState(false);
  const [offer, setOffer] = useState(null);
  const [active, setActive] = useState(null);
  const [pos, setPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [tab, setTab] = useState('now');
  const [history, setHistory] = useState(null);
  const [collected, setCollected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const posRef = useRef(null);
  const seenOffer = useRef(null);
  const wakeLock = useRef(null);

  useEffect(() => {
    api.get('/riders/me').then((r) => { setOnline(r.data.rider.isOnline); setReady(true); }).catch((e) => setError(errMsg(e)));
  }, []);

  // ---- offers and the current delivery: polled every 5 seconds ----
  const fetchOffers = useCallback(async () => {
    try {
      const { data } = await api.get('/riders/me/offers');
      setOffer(data.offer);
      setActive(data.active);
      if (data.offer && data.offer.id !== seenOffer.current) { seenOffer.current = data.offer.id; beep(); }
      setError('');
    } catch (e) { setError(errMsg(e)); }
  }, []);
  usePoll(fetchOffers, 5000, { enabled: ready });

  useEffect(() => {
    if (!offer) return undefined;
    setNow(Date.now()); // start from the real time, so the first second is not stale
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [offer]);

  // ---- while online: share location (a fix when it changes, and a repeat every 20 s so it never goes stale) ----
  useEffect(() => {
    if (!online) return undefined;
    if (!navigator.geolocation) { setGeoError('This phone cannot share its location.'); return undefined; }
    const send = () => { if (posRef.current) api.patch('/riders/me/location', posRef.current).catch(() => {}); };
    let first = true;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        posRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(posRef.current);
        setGeoError('');
        if (first) { first = false; send(); }
      },
      () => setGeoError('Location is blocked. Allow location for this site in your browser settings, or you will not get orders.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    const repeat = setInterval(send, 20000);
    return () => { navigator.geolocation.clearWatch(watch); clearInterval(repeat); };
  }, [online]);

  // ---- keep the screen awake while online (location only updates while this page is open) ----
  useEffect(() => {
    if (!online || !navigator.wakeLock) return undefined;
    const lock = async () => { try { wakeLock.current = await navigator.wakeLock.request('screen'); } catch { /* not allowed: fine */ } };
    lock();
    const onVisible = () => { if (document.visibilityState === 'visible') lock(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); wakeLock.current?.release?.().catch(() => {}); };
  }, [online]);

  const toggleOnline = async () => {
    setBusy(true); setError('');
    try {
      const next = !online;
      await api.patch('/riders/me/availability', { isOnline: next });
      setOnline(next);
      if (next) beep(); // the tap also lets the browser play offer sounds later
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await fetchOffers(); } catch (e) { setError(errMsg(e)); await fetchOffers(); } finally { setBusy(false); } };
  const accept = () => act(() => api.post(`/deliveries/${offer.id}/accept`));
  const reject = () => act(() => api.post(`/deliveries/${offer.id}/reject`));
  const advance = () => act(async () => {
    await api.patch(`/deliveries/${active.id}/status`, { status: NEXT[active.status], collected });
    setCollected(false);
    setHistory(null);
  });

  const loadHistory = useCallback(async () => {
    try { setHistory((await api.get('/riders/me/deliveries')).data); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { if (tab === 'earnings' && !history) loadHistory(); }, [tab, history, loadHistory]);

  const left = offer ? Math.max(0, Math.ceil((new Date(offer.offerExpiresAt).getTime() - now) / 1000)) : 0;
  const next = active ? NEXT[active.status] : null;
  const needsCash = next === 'Delivered' && active?.order.collectAmount > 0;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink/60">Rider</p>
          <h1 className="text-2xl font-bold">{user?.name}</h1>
        </div>
        <button onClick={toggleOnline} disabled={busy || !ready} className={`rounded-full px-5 py-3 text-sm font-bold text-white ${online ? 'bg-forest' : 'bg-ink/50'}`}>
          {online ? '● Online' : 'Go online'}
        </button>
      </div>

      <div className="flex gap-2">
        {[['now', 'Deliveries'], ['earnings', 'Earnings']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full border-2 border-ink px-4 py-1 text-sm font-bold ${tab === id ? 'bg-ink text-white' : ''}`}>{label}</button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {geoError && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{geoError}</p>}

      {tab === 'now' && (
        <>
          {!online && !active && <p className="card text-sm text-ink/70">You are offline. Tap <b>Go online</b> to get orders. Keep this page open and your screen on while you work: your location only updates while the page is open.</p>}
          {online && !offer && !active && <p className="card text-sm text-ink/70">Waiting for an order{pos ? '' : ' (finding your location…)'}. You will hear a beep when one arrives.</p>}

          {offer && (
            <div className="card space-y-3 border-2 border-sunset">
              <div className="flex items-center justify-between">
                <p className="font-display text-xl font-bold">New order</p>
                <p className={`font-mono text-lg font-bold ${left <= 20 ? 'text-chili' : ''}`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
              </div>
              <p className="text-sm"><b>Pick up:</b> {offer.pickup.address}</p>
              <p className="text-sm"><b>Deliver to:</b> {offer.dropoff.address}{offer.dropoff.landmark ? `, ${offer.dropoff.landmark}` : ''}</p>
              <p className="text-sm text-ink/70">{offer.distanceKm} km · you earn <b className="text-forest-dark">{naira(offer.deliveryFee)}</b>{offer.order.collectAmount > 0 && <> · collect <b>{naira(offer.order.collectAmount)}</b> from the customer</>}</p>
              <div className="flex gap-2">
                <button className="btn-primary flex-1 !py-3" disabled={busy || left === 0} onClick={accept}>Accept</button>
                <button className="btn-ghost !py-3" disabled={busy} onClick={reject}>Decline</button>
              </div>
            </div>
          )}

          {active && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono font-bold">{active.order.orderNo}</p>
                <span className="rounded-full bg-forest/15 px-3 py-1 text-xs font-bold text-forest-dark">{active.status}</span>
              </div>
              <p className="text-sm"><b>{active.order.customerName}</b> · <a className="text-forest underline" href={`tel:+${active.order.customerPhone}`}>Call {active.order.customerPhone}</a></p>
              <ul className="text-sm">{active.order.items.map((i) => <li key={i.name}>{i.qty} × {i.name}</li>)}</ul>
              {active.order.note && <p className="text-sm text-ink/70">Note: {active.order.note}</p>}
              <p className="text-sm"><b>Deliver to:</b> {active.dropoff.address}{active.dropoff.landmark ? `, ${active.dropoff.landmark}` : ''}</p>
              <div className="flex flex-wrap gap-2">
                <a className="btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${active.pickup.lat},${active.pickup.lng}`}>Directions to restaurant</a>
                <a className="btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${active.dropoff.lat},${active.dropoff.lng}`}>Directions to customer</a>
              </div>
              <TrackMap rider={pos} destination={active.dropoff} height={200} />
              {needsCash && (
                <label className="flex items-start gap-2 rounded-lg bg-gold/30 p-3 text-sm font-semibold">
                  <input type="checkbox" className="mt-1" checked={collected} onChange={(e) => setCollected(e.target.checked)} />
                  I have collected {naira(active.order.collectAmount)} (cash or transfer)
                </label>
              )}
              {next && <button className="btn-primary w-full !py-3" disabled={busy || (needsCash && !collected)} onClick={advance}>{LABEL[next]}</button>}
            </div>
          )}
        </>
      )}

      {tab === 'earnings' && (
        <div className="space-y-3">
          {!history && <p className="text-ink/60">Loading…</p>}
          {history && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card !p-4"><p className="text-xs text-ink/60">Delivery fees earned</p><p className="font-mono text-xl font-bold">{naira(history.totalEarned)}</p></div>
                <div className="card !p-4"><p className="text-xs text-ink/60">Deliveries</p><p className="font-mono text-xl font-bold">{history.deliveriesCompleted}</p></div>
              </div>
              {history.history.length === 0 && <p className="card text-sm text-ink/60">No deliveries yet.</p>}
              {history.history.map((h) => (
                <div key={h._id} className="card flex items-center justify-between gap-3 !p-3 text-sm">
                  <div><p className="font-mono font-bold">{h.order?.orderNo}</p><p className="text-xs text-ink/60">{h.order?.deliveryAddress}</p></div>
                  <div className="text-right"><p className="font-mono font-bold text-forest-dark">{naira(h.deliveryFee)}</p><p className="text-xs text-ink/60">{new Date(h.deliveredAt).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
