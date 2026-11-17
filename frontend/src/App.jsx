import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { PUBLIC_ROUTES } from './publicPages.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Orders from './pages/Orders.jsx';
import OrderTracking from './pages/OrderTracking.jsx';
import AdminSeo from './pages/AdminSeo.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminMenu from './pages/admin/AdminMenu.jsx';
import AdminRiders from './pages/admin/AdminRiders.jsx';
import AdminMoney from './pages/admin/AdminMoney.jsx';
import RiderEntry from './pages/rider/RiderEntry.jsx';
import RiderSignup from './pages/rider/RiderSignup.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="py-20 text-center text-ink/60">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Only the given role may open these pages; anyone else is sent to the right place.
function RoleOnly({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="py-20 text-center text-ink/60">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

const NotFound = () => (
  <div className="py-20 text-center">
    <h1 className="text-3xl font-bold">Page not found</h1>
    <Link to="/" className="btn-primary mt-4">Back to the menu</Link>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {PUBLIC_ROUTES.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/rider/signup" element={<RiderSignup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Protected><Orders /></Protected>} />
        <Route path="/orders/:id" element={<OrderTracking />} />
        <Route path="/admin" element={<RoleOnly role="admin"><AdminLayout /></RoleOnly>}>
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="riders" element={<AdminRiders />} />
          <Route path="money" element={<AdminMoney />} />
          <Route path="seo" element={<AdminSeo />} />
        </Route>
        <Route path="/rider" element={<RoleOnly role="rider"><RiderEntry /></RoleOnly>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
