// Run:  npm run crawl      (the Render Cron Job runs this inside the Docker image)
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import SeoRun from '../models/SeoRun.js';
import SeoAudit from '../models/SeoAudit.js';
import { createFetcher } from './fetcher.js';
import { crawlSite } from './crawler.js';
import { countIssues } from './checks.js';

if (!env.mongoUri) throw new Error('MONGO_URI is required');
await connectDB();

const run = await SeoRun.create({ baseUrl: env.seo.baseUrl, renderJs: env.seo.renderJs, startedAt: new Date() });
const fetcher = createFetcher({ renderJs: env.seo.renderJs });
try {
  console.log(`Crawling ${env.seo.baseUrl} (render JS: ${env.seo.renderJs}, ${env.seo.rateMs} ms between pages)`);
  const result = await crawlSite({ baseUrl: env.seo.baseUrl, fetcher, rateMs: env.seo.rateMs, maxPages: env.seo.maxPages, log: (m) => console.log(m) });
  const checkedAt = new Date();
  await SeoAudit.insertMany(result.pages.map((p) => ({ runId: run._id, url: p.url, template: p.template, status: p.status, finalUrl: p.finalUrl, redirects: p.redirects, issues: p.issues, metrics: p.metrics, sources: p.sources, checkedAt })));
  const counts = countIssues(result.pages);
  await SeoRun.updateOne({ _id: run._id }, { finishedAt: new Date(), pages: result.pages.length, counts, sitemapFound: result.sitemap.found, truncated: result.truncated });
  console.log(`Done: ${result.pages.length} pages, ${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes`);
} catch (err) {
  console.error('Crawl failed:', err);
  await SeoRun.updateOne({ _id: run._id }, { finishedAt: new Date(), error: err.message });
  process.exitCode = 1;
} finally {
  await fetcher.close();
  await mongoose.disconnect();
}
