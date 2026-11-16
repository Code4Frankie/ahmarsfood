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
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-forest text-white [container-type:inline-size]">
        <div className="aspect-[3/2] w-full md:aspect-[1.9/1]">
          <picture>
            <source media="(min-width: 768px)" type="image/webp" srcSet={HERO.desktop.webp} sizes="(min-width: 1152px) 1152px, 100vw" />
            <source media="(min-width: 768px)" type="image/jpeg" srcSet={HERO.desktop.jpg} sizes="(min-width: 1152px) 1152px, 100vw" />
            <source type="image/webp" srcSet={HERO.mobile.webp} sizes="100vw" />
            <source type="image/jpeg" srcSet={HERO.mobile.jpg} sizes="100vw" />
            <img src={HERO.mobile.fallback} alt={HERO.alt} className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
          </picture>
        </div>
        {/* Phones: text sits under the picture. md and up: the same text is laid over the dark-red area of the picture (sizes scale with the hero width). */}
        <div className="px-6 py-8 md:absolute md:left-[4%] md:top-[4%] md:w-[54%] md:p-0 md:[text-shadow:0_1px_10px_rgba(0,0,0,.45)]">
          <span className="inline-block -rotate-2 rounded-full bg-gold px-3 py-1 font-mono text-xs font-bold text-ink md:px-[1.1cqw] md:py-[0.35cqw] md:text-[1cqw]">LAFIA · GANDU · AKUNZA · FULAFIA</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:mt-[1.1cqw] md:text-[4cqw] md:leading-[1.05]">Cooked with Love,<br /><span className="text-gold md:text-[2.7cqw]">...trust in the taste, Ci-Kalashe.</span></h1>
          <p className="mt-3 max-w-md text-white/90 md:sr-only lg:not-sr-only lg:mt-[1cqw] md:max-w-[44cqw] md:text-[1.3cqw] md:leading-snug">Order pounded yam, fried/jollof rice, shawarma and more in Lafia. Pay online or on delivery, then follow your rider to your door.</p>
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
