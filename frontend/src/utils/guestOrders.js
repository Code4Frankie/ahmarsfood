// Guest orders: the secret from the tracking link is kept on this device too, so reopening /orders/<id> still works.
const KEY = 'af_guest_orders';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export const getGuestToken = (orderId) => read()[orderId] || '';

export function saveGuestToken(orderId, token) {
  if (!orderId || !token) return;
  try {
    const all = read();
    all[orderId] = token;
    // keep only the 20 most recent
    const keep = Object.fromEntries(Object.entries(all).slice(-20));
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch { /* private mode or storage full: the link in the address bar still works */ }
}
