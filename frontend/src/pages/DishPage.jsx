import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useMenu } from '../hooks/useMenu.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { dishMeta } from '../seo/meta.js';
import { LANDING_PATHS } from '../seo/landing.js';
import { findBySlug, slugFor } from '../utils/slug.js';
import { naira } from '../utils/money';

const NOT_FOUND = { title: 'Dish not found | Ahmars Food', description: 'This dish is not on the Ahmars Food menu.' };

export default function DishPage() {
  const { slug } = useParams();
  const { data, error } = useMenu();
  const { add, setQty, qtyOf } = useCart();
  const foods = data?.foods || [];
  const food = data ? findBySlug(foods, slug) : null;
  usePageMeta(food ? dishMeta(food, foods) : { ...NOT_FOUND, noindex: true });

  if (error) return <p className="rounded-lg bg-chili/10 p-4 text-chili">{error}</p>;
  if (!data) return <p className="py-10 text-center text-ink/60">Loading…</p>;
  if (!food) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-bold">We could not find that dish</h1>
        <Link to="/" className="btn-primary mt-4">See the menu</Link>
      </div>
    );
  }

  const qty = qtyOf(food._id);
  const related = foods.filter((f) => f.category === food.category && f._id !== food._id && f.isAvailable).slice(0, 4);

  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink/60">
        <Link to="/" className="underline">Menu</Link> <span aria-hidden="true">/</span> {food.name}
      </nav>
      <div className="card overflow-hidden !p-0">
        {food.image ? <img src={food.image} alt={`${food.name} from Ahmars Food, Lafia`} className="h-64 w-full object-cover sm:h-80" /> : <div className="flex h-48 items-center justify-center bg-forest/10 text-6xl" aria-hidden="true">🍲</div>}
        <div className="space-y-3 p-6">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-sunset">{food.category}</p>
          <h1 className="text-3xl font-bold leading-tight">{food.name}</h1>
          {food.description && <p className="text-ink/80">{food.description}</p>}
          <p className="text-sm text-ink/60">About {food.prepTime} minutes to prepare.</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-ink/20 pt-4">
            <span className="font-mono text-2xl font-bold text-forest-dark">{naira(food.price)}</span>
            {!food.isAvailable ? (
              <span className="rounded-full bg-ink/10 px-4 py-2 text-sm font-bold">Sold out right now</span>
            ) : qty === 0 ? (
              <button className="btn-primary" onClick={() => add(food)}>Add to cart</button>
            ) : (
              <div className="flex items-center gap-2">
                <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty(food._id, qty - 1)} aria-label="Remove one">−</button>
                <span className="w-6 text-center font-mono font-bold">{qty}</span>
                <button className="btn-ghost !px-3 !py-1.5" onClick={() => setQty(food._id, qty + 1)} aria-label="Add one">+</button>
                <Link to="/cart" className="btn-accent ml-2">View cart</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8 space-y-2">
        <h2 className="text-xl font-bold">Order {food.name} in Lafia</h2>
        <p className="text-ink/80">
          Ahmars Food is at Maraba Akunza, Federal University Lafia. Order online, pay online or by bank transfer, and follow your rider to your door, or collect it at the restaurant.
          See <Link to={LANDING_PATHS.lafia} className="underline">food delivery in Lafia</Link> or <Link to={LANDING_PATHS.ful} className="underline">delivery at Federal University Lafia</Link>.
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-xl font-bold">More {food.category.toLowerCase()}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r._id}><Link to={`/menu/${slugFor(r, foods)}`} className="card block !p-3 hover:border-forest"><span className="font-semibold">{r.name}</span> <span className="font-mono text-sm text-forest-dark">{naira(r.price)}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
