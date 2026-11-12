import { schemas } from '../schemas.js';

// Admin only. A short digest of the latest crawl: the full grouped report is at GET /api/admin/seo/report.
export const makeGetSeoReport = ({ seo }) => ({
  name: 'get_seo_report',
  label: 'Reading the SEO report…',
  roles: ['admin'],
  description: 'Admin only. Summary of the latest SEO crawl: counts, the biggest issues per page type, and what changed since the previous crawl.',
  zod: schemas.get_seo_report.zod,
  jsonSchema: schemas.get_seo_report.json,
  async run() {
    const report = await seo.getLatestReport();
    if (!report) return { available: false, note: 'No crawl has completed yet.' };
    return {
      crawled_at: report.run?.finishedAt,
      pages: report.totals.pages,
      totals: { errors: report.totals.error, warnings: report.totals.warning, notes: report.totals.info },
      by_page_type: report.templates.map((t) => ({ page_type: t.template, pages: t.pages, top_issues: t.issues.slice(0, 5).map((i) => ({ code: i.code, severity: i.severity, count: i.count, message: i.message })) })),
      new_since_last_crawl: report.changes.newIssues.length,
      fixed_since_last_crawl: report.changes.fixedIssues.length,
    };
  },
});
