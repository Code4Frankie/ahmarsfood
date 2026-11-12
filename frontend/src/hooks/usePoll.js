import { useEffect, useRef } from 'react';

// Calls fn now and then every `ms`. Changing `key` restarts it (for example when a filter tab changes).
export function usePoll(fn, ms, { enabled = true, key } = {}) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    latest.current();
    const t = setInterval(() => latest.current(), ms);
    return () => clearInterval(t);
  }, [ms, enabled, key]);
}
