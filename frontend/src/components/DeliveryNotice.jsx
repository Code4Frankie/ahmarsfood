import { useEffect, useState } from 'react';
import { getConfig } from '../api';

// Shown on the menu and cart while the admin has paused delivery.
export default function DeliveryNotice() {
  const [d, setD] = useState(null);
  useEffect(() => { getConfig().then((c) => setD(c.delivery)).catch(() => {}); }, []);
  if (d?.mode !== 'paused') return null;
  return (
    <div role="status" className="mb-5 rounded-xl border-2 border-chili/30 bg-chili/10 p-4 text-sm">
      <p className="font-bold text-chili">Delivery is paused right now: no rider is available.</p>
      {d.note && <p className="mt-1 text-ink/80">{d.note}</p>}
      <p className="mt-1 text-ink/80">You can still order and collect your food at the restaurant. Choose <b>Pickup</b> at checkout.</p>
    </div>
  );
}
