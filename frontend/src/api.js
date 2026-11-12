import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('af_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// An expired or invalid token logs the user out everywhere.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('af_token')) {
      localStorage.removeItem('af_token');
      window.dispatchEvent(new Event('af-logout'));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';

let configPromise;
export const getConfig = () => (configPromise ||= api.get('/config').then((r) => r.data));

export default api;
