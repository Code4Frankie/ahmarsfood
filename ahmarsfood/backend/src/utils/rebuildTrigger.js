// Debounced "rebuild the site" request. Several menu edits close together send ONE request, after `delayMs` of quiet.
// Pure (everything is passed in) so it can be tested without a network or real timers.
export function createRebuildTrigger({ url, delayMs, fetchFn = fetch, setTimer = setTimeout, clearTimer = clearTimeout, log = console }) {
  let timer = null;
  return function requestRebuild() {
    if (!url) return false;
    if (timer) clearTimer(timer);
    timer = setTimer(async () => {
      timer = null;
      try {
        const res = await fetchFn(url, { method: 'POST', signal: AbortSignal.timeout(15000) });
        log.log(`[rebuild] Vercel deploy hook answered ${res.status}`);
      } catch (err) {
        log.error('[rebuild] could not reach the deploy hook:', err.message);
      }
    }, delayMs);
    timer.unref?.();
    return true;
  };
}
