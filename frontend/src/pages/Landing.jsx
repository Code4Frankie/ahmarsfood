import { Link } from 'react-router-dom';
import { useMenu, useSiteConfig } from '../hooks/useMenu.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { LANDING } from '../seo/landing.js';
import { landingMeta } from '../seo/meta.js';
import { slugFor } from '../utils/slug.js';
import { naira } from '../utils/money';

export default function Landing({ page }) {
  const p = LANDING[page];
  usePageMeta(landingMeta(page));
  const { data } = useMenu();
  const cfg = useSiteConfig();
  const foods = data?.foods || [];
  const picks = foods.filter((f) => f.isAvailable).slice(0, 6);
  const radius = cfg?.delivery?.maxRadiusKm;
  const perKm = cfg?.delivery?.perKm;
  const wa = cfg?.restaurant?.whatsapp;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <div>
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink/60"><Link to="/" className="underline">Ahmars Food</Link> <span aria-hidden="true">/</span> {p.crumb}</nav>
        <h1 className="text-4xl font-extrabold leading-tight">{p.h1}</h1>
        {p.intro.map((t) => <p key={t} className="mt-3 text-lg text-ink/80">{t}</p>)}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary">See the menu and order</Link>
          {wa && <a className="btn-ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>}
        </div>
      </div>

      {p.sections.map((s) => (
        <section key={s.heading} className="space-y-3">
          <h2 className="text-2xl font-bold">{s.heading}</h2>
          {s.body?.map((t) => <p key={t} className="text-ink/80">{t}</p>)}
          {s.steps && <ol className="list-decimal space-y-1 pl-5 text-ink/80">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol>}
          {s.dishes && picks.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {picks.map((f) => (
                <li key={f._id}><Link to={`/menu/${slugFor(f, foods)}`} className="card block !p-3 hover:border-forest"><span className="font-semibold">{f.name}</span> <span className="font-mono text-sm text-forest-dark">{naira(f.price)}</span></Link></li>
              ))}
            </ul>
          )}
          {s.delivery && (
            <p className="text-ink/80">
              We deliver {radius ? `within about ${radius} km of` : 'within a set distance of'} the restaurant at Maraba Akunza. Drop a pin on the map at checkout and the delivery fee is worked out from the distance{perKm ? ` (₦${perKm.toLocaleString()} for the first km, plus the same for each extra km)` : ''} and shown before you pay. Prefer to collect it yourself? Choose pickup at the restaurant.
            </p>
          )}
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Questions</h2>
        {p.faq.map((f) => (
          <div key={f.q}><h3 className="text-lg font-bold">{f.q}</h3><p className="text-ink/80">{f.a}</p></div>
        ))}
      </section>
    </article>
  );
}
