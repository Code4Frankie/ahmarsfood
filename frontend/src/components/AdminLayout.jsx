import { NavLink, Outlet } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta.js';

const TABS = [['orders', 'Orders'], ['menu', 'Menu'], ['riders', 'Riders'], ['money', 'Payments & sales'], ['seo', 'SEO']];

export default function AdminLayout() {
  usePageMeta({ title: 'Admin | Ahmars Food', noindex: true });
  return (
    <div>
      <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-ink/10 pb-3">
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold ${isActive ? 'bg-ink text-white' : 'bg-white text-ink/70 hover:bg-ink/5'}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
