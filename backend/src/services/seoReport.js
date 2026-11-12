import SeoRun from '../models/SeoRun.js';
import SeoAudit from '../models/SeoAudit.js';
import { groupReport } from '../seo/report.js';

// Latest finished crawl, compared with the one before it. Returns null if no crawl has completed yet.
export async function getLatestReport() {
  const runs = await SeoRun.find({ finishedAt: { $ne: null }, error: { $exists: false } }).sort({ startedAt: -1 }).limit(2).lean();
  if (!runs.length) return null;
  const [latest, prev] = runs;
  const [now, before] = await Promise.all([
    SeoAudit.find({ runId: latest._id }).lean(),
    prev ? SeoAudit.find({ runId: prev._id }).lean() : [],
  ]);
  return groupReport(now, before, {
    id: String(latest._id), baseUrl: latest.baseUrl, startedAt: latest.startedAt, finishedAt: latest.finishedAt,
    pages: latest.pages, renderJs: latest.renderJs, sitemapFound: latest.sitemapFound, truncated: latest.truncated,
  });
}

// Pages in the latest crawl that are indexable but have no meta description.
export async function pagesMissingDescription() {
  const run = await SeoRun.findOne({ finishedAt: { $ne: null }, error: { $exists: false } }).sort({ startedAt: -1 }).lean();
  if (!run) return [];
  return SeoAudit.find({ runId: run._id, 'issues.code': 'missing_description' }).lean();
}
