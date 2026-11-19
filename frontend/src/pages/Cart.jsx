import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { naira } from '../utils/money';
import { usePageMeta } from '../hooks/usePageMeta.js';
import DeliveryNotice from '../components/DeliveryNotice.jsx';

export default function Cart() {
  usePageMeta({ title: 'Your cart | Ahmars Food', noindex: true });
  const { items, setQty, subtotal, clear } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-3 text-2xl font-bold">Your cart is empty</h1>
        <Link to="/" className="btn-primary mt-5">Browse the menu</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-3xl font-bold">Your cart</h1>
      <DeliveryNotice />
      <div className="card divide-y divide-dashed divide-ink/20 !p-0">
        {items.map((i) => (
          <div key={i.foodId} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{i.name}</p>
              <p className="font-mono text-sm text-ink/60">{naira(i.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty(i.foodId, i.qty - 1)} aria-label="Remove one">−</button>
              <span className="w-5 text-center font-mono font-bold">{i.qty}</span>
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty(i.foodId, i.qty + 1)} aria-label="Add one">+</button>
            </div>
            <p className="w-24 text-right font-mono font-bold">{naira(i.price * i.qty)}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4">
        <div className="flex justify-between text-lg font-bold"><span>Subtotal</span><span className="font-mono">{naira(subtotal)}</span></div>
        <p className="mt-1 text-sm text-ink/60">The delivery fee is added at checkout once you pin your location. Collecting at the restaurant has no delivery fee.</p>
        <div className="mt-4 flex gap-3">
          <button className="btn-ghost" onClick={clear}>Empty cart</button>
          <button className="btn-primary flex-1" onClick={() => navigate('/checkout')}>Checkout</button>
        </div>
      </div>
    </div>
  );
}
