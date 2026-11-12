import { schemas } from '../schemas.js';

export const makeGetSalesSummary = ({ reports }) => ({
  name: 'get_sales_summary',
  label: 'Adding up sales…',
  roles: ['admin'],
  description: 'Admin only. Daily sales summary: orders, delivered, paid orders, revenue, Pay on Delivery still to collect, split by payment method.',
  zod: schemas.get_sales_summary.zod,
  jsonSchema: schemas.get_sales_summary.json,
  async run({ date }) {
    return reports.dailySummary(date);
  },
});
