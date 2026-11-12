import { useState } from 'react';
import { Link } from 'react-router-dom';
import FoodCard from '../components/FoodCard.jsx';
import { useMenu } from '../hooks/useMenu.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { homeMeta } from '../seo/meta.js';
import { LANDING_PATHS } from '../seo/landing.js';
import { slugMap } from '../utils/slug.js';

export default function Menu() {
  usePageMeta(homeMeta());
  const { data, error } = useMenu();
  const [cat, setCat] = useState('All');

  const slugs = data ? slugMap(data.foods) : new Map();
  const foods = data?.foods.filter((f) => cat === 'All' || f.category === cat) || [];
  const cats = data ? ['All', ...data.categories.filter((c) => data.foods.some((f) => f.category === c))] : [];

  return (
    <div>
      <section className="mb-8 overflow-hidden rounded-3xl bg-forest px-6 py-10 text-white sm:px-10">
        <span className="inline-block -rotate-2 rounded-full bg-gold px-3 py-1 font-mono text-xs font-bold text-ink">MARABA AKUNZA · FEDERAL UNIVERSITY LAFIA</span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Home cooking,<br /><span className="text-gold">...trust in the taste.</span></h1>
        <p className="mt-3 max-w-md text-white/90">Order amala, jollof, shawarma and more in Lafia. Pay online or on delivery, then follow your rider to your door.</p>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold transition ${cat === c ? 'bg-ink text-white' : 'bg-transparent hover:bg-ink/5'}`}>
            {c}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-chili/10 p-4 text-chili">{error}</p>}
      {!data && !error && <p className="py-10 text-center text-ink/60">Loading the menu…</p>}
      {data && foods.length === 0 && <p className="py-10 text-center text-ink/60">Nothing in this category yet.</p>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {foods.map((f) => <FoodCard key={f._id} food={f} slug={slugs.get(String(f._id))} />)}
      </div>

      <section className="mt-12 space-y-2">
        <h2 className="text-2xl font-bold">Where we deliver</h2>
        <p className="text-ink/80">
          Ahmars Food is at Maraba Akunza, Federal University Lafia, and delivers around Lafia. Read more about{' '}
          <Link to={LANDING_PATHS.lafia} className="underline">food delivery in Lafia</Link> or{' '}
          <Link to={LANDING_PATHS.ful} className="underline">delivery to hostels at Federal University Lafia</Link>.
        </p>
      </section>
    </div>
  );
}
