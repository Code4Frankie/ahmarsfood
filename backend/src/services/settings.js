import Setting from '../models/Setting.js';
import { HttpError } from '../utils/httpError.js';

// app    : riders on the app get offers automatically (normal)
// manual : delivery orders wait for the admin, who phones a bike rider and enters their details
// paused : no rider available, new delivery orders are refused and customers are pointed to pickup
export const DELIVERY_MODES = ['app', 'manual', 'paused'];

export async function getDeliverySettings() {
  const doc = await Setting.findOne({ key: 'delivery' });
  const v = doc?.value || {};
  return { mode: DELIVERY_MODES.includes(v.mode) ? v.mode : 'app', note: typeof v.note === 'string' ? v.note : '' };
}

export async function setDeliverySettings({ mode, note }) {
  if (!DELIVERY_MODES.includes(mode)) throw new HttpError(400, `mode must be one of: ${DELIVERY_MODES.join(', ')}`);
  const clean = { mode, note: String(note || '').trim().slice(0, 200) };
  await Setting.updateOne({ key: 'delivery' }, { $set: { value: clean } }, { upsert: true });
  return clean;
}
