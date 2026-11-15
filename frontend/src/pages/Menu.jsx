import { useState } from 'react';
import { Link } from 'react-router-dom';
import FoodCard from '../components/FoodCard.jsx';
import { useMenu } from '../hooks/useMenu.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { homeMeta } from '../seo/meta.js';
import { LANDING_PATHS } from '../seo/landing.js';
import { slugMap } from '../utils/slug.js';
import { HERO } from '../heroConfig.js';

export default function Menu() {
  usePageMeta(homeMeta());
  const { data, error } = useMenu();
  const [cat, setCat] = useState('All');

  const slugs = data ? slugMap(data.foods) : new Map();
  const foods = data?.foods.filter((f) => cat === 'All' || f.category === cat) || [];
  const cats = data ? ['All', ...data.categories.filter((c) => data.foods.some((f) => f.category === c))] : [];

  return (
    <div>
      <section className="mb-8 overflow-hidden rounded-3xl bg-forest text-white">
        <div className="aspect-[1345/1200] w-full md:aspect-[2.4/1]">
          <picture>
            <source media="(min-width: 768px)" type="image/webp" srcSet={HERO.desktop.webp} sizes="(min-width: 1152px) 1152px, 100vw" />
            <source media="(min-width: 768px)" type="image/jpeg" srcSet={HERO.desktop.jpg} sizes="(min-width: 1152px) 1152px, 100vw" />
            <source type="image/webp" srcSet={HERO.mobile.webp} sizes="100vw" />
            <source type="image/jpeg" srcSet={HERO.mobile.jpg} sizes="100vw" />
            <img src={HERO.mobile.fallback} alt={HERO.alt} className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
          </picture>
        </div>
        {/* Mobile: visible headline under the picture. Desktop: the wordmark is in the picture, so this stays for screen readers and search only. */}
        <div className="px-6 py-8 md:sr-only">
          <span className="inline-block -rotate-2 rounded-full bg-gold px-3 py-1 font-mono text-xs font-bold text-ink">MARABA AKUNZA · FEDERAL UNIVERSITY LAFIA</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight">Home cooking,<br /><span className="text-gold">...trust in the taste.</span></h1>
          <p className="mt-3 max-w-md text-white/90">Order amala, jollof, shawarma and more in Lafia. Pay online or on delivery, then follow your rider to your door.</p>
        </div>
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
