const STYLE = {
  'Pending Payment': 'bg-gold/30 text-ink',
  Pending: 'bg-sunset/20 text-sunset-dark',
  Preparing: 'bg-sunset/20 text-sunset-dark',
  'On The Way': 'bg-forest/15 text-forest-dark',
  Delivered: 'bg-forest text-white',
  Cancelled: 'bg-chili/15 text-chili',
};
const LABEL = { 'Pending Payment': 'Awaiting payment', Pending: 'Order received', 'On The Way': 'On the way' };

export default function StatusBadge({ status }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${STYLE[status] || 'bg-ink/10'}`}>{LABEL[status] || status}</span>;
}
