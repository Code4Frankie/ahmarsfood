import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { getConfig } from '../api';
import { SITE } from '../siteLinks.js';
import { LANDING_PATHS } from '../seo/landing.js';
import AgentChat from './AgentChat.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  const link = ({ isActive }) => `whitespace-nowrap text-sm font-semibold ${isActive ? 'text-forest' : 'text-ink/70 hover:text-forest'}`;
  const wa = cfg?.restaurant?.whatsapp;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-ink bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/"><img src="/logo-header.png" alt="Ahmars Food" width="109" height="44" className="h-11 w-auto" /></Link>
          <nav className="flex items-center gap-3 sm:gap-6">
            {user?.role !== 'rider' && <NavLink to="/" end className={(s) => `${link(s)} hidden sm:inline`}>Menu</NavLink>}
            {user && user.role !== 'rider' && <NavLink to="/orders" className={link}>My orders</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
            {user?.role === 'rider' && <NavLink to="/rider" className={link}>Rider app</NavLink>}
            {user ? (
              <button onClick={() => { logout(); navigate('/'); }} className="whitespace-nowrap text-sm font-semibold text-ink/70 hover:text-chili">Log out</button>
            ) : (
              <NavLink to="/login" className={link}>Log in</NavLink>
            )}
            {user?.role !== 'rider' && (
            <Link to="/cart" className="btn-primary !px-3.5 !py-2">
                Cart
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-chili px-1 text-xs">{count}</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <AgentChat />

      <footer className="bg-forest-dark text-white/85">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="mb-3 inline-block rounded-xl bg-white p-2"><img src="/logo-footer.png" alt="Ahmars Food" width="90" height="36" className="h-9 w-auto" /></span>
            <p className="text-sm">{cfg?.restaurant?.address || 'Maraba Akunza, Federal University Lafia'}</p>
            <p className="font-display text-lg text-gold">...trust in the taste</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">Instagram</a>
              <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">Facebook</a>
              <a href={SITE.google} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">Find us on Google</a>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link to={LANDING_PATHS.lafia} className="underline hover:text-gold">Food delivery in Lafia</Link>
              <Link to={LANDING_PATHS.ful} className="underline hover:text-gold">Near Federal University Lafia</Link>
            </p>
          </div>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn-accent self-start sm:self-auto">
              Chat on WhatsApp
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
