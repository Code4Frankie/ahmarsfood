import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { naira } from '../utils/money';

export default function FoodCard({ food, slug }) {
  const { add, setQty, qtyOf } = useCart();
  const qty = qtyOf(food._id);

  return (
    <div className={`card flex flex-col overflow-hidden !p-0 ${food.isAvailable ? '' : 'opacity-60'}`}>
      {food.image ? (
        <img src={food.image} alt={food.name} loading="lazy" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-forest/10 text-5xl" aria-hidden="true">🍲</div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-sunset">{food.category}</span>
        <h3 className="mt-1 text-lg font-bold leading-tight">{slug ? <Link to={`/menu/${slug}`} className="hover:text-forest">{food.name}</Link> : food.name}</h3>
        <p className="mt-1 flex-1 text-sm text-ink/60">{food.description}</p>
        <p className="mt-2 text-xs text-ink/50">About {food.prepTime} min to prepare</p>
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-ink/20 pt-3">
          <span className="font-mono text-base font-bold text-forest-dark">{naira(food.price)}</span>
          {!food.isAvailable ? (
            <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-bold">Sold out</span>
          ) : qty === 0 ? (
            <button className="btn-primary !py-2" onClick={() => add(food)}>Add</button>
          ) : (
            <div className="flex items-center gap-2">
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty(food._id, qty - 1)} aria-label="Remove one">−</button>
              <span className="w-5 text-center font-mono font-bold">{qty}</span>
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty(food._id, qty + 1)} aria-label="Add one">+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
