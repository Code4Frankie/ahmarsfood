import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);
// During pre-rendering there is no browser storage, so reading it must never throw.
const hasToken = () => { try { return !!localStorage.getItem('af_token'); } catch { return false; } };
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(hasToken);

  const logout = useCallback(() => {
    localStorage.removeItem('af_token');
    setUser(null);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('af_token')) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener('af-logout', logout);
    return () => window.removeEventListener('af-logout', logout);
  }, [logout]);

  const accept = ({ data }) => {
    localStorage.setItem('af_token', data.token);
    setUser(data.user);
    return data.user;
  };
  const login = (identifier, password) => api.post('/auth/login', { identifier, password }).then(accept);
  const register = (form) => api.post('/auth/register', form).then(accept);
  const riderSignup = (form) => api.post('/auth/rider-signup', form).then(accept);
  const refresh = () => api.get('/auth/me').then((r) => { setUser(r.data.user); return r.data.user; });

  return <AuthContext.Provider value={{ user, loading, login, register, riderSignup, refresh, logout }}>{children}</AuthContext.Provider>;
}
