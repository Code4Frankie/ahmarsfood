// Stores Nigerian numbers as 234XXXXXXXXXX so 0811..., +234811... and 234811... all match.
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  else if (d.length === 10) d = '234' + d;
  return d;
}
export const isValidPhone = (d) => /^234\d{10}$/.test(d);
