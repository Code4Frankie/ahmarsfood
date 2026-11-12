import { useEffect, useState } from 'react';
import api, { errMsg, getConfig } from '../api';
import { usePrerender } from '../prerender/PrerenderContext.jsx';

// Starts from the pre-rendered menu (so there is no "Loading…" flash), then always refreshes from the server so the
// prices a customer sees are current even if the saved page is a few hours old.
export function useMenu() {
  const pre = usePrerender();
  const [data, setData] = useState(pre?.menu || null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/foods').then((r) => setData(r.data)).catch((e) => { if (!pre?.menu) setError(errMsg(e)); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error };
}

export function useSiteConfig() {
  const pre = usePrerender();
  const [cfg, setCfg] = useState(pre?.config || null);
  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);
  return cfg;
}
