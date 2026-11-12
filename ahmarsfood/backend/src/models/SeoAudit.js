import mongoose from 'mongoose';
import { env } from '../config/env.js';

// One row per URL per crawl. Keeping every run is what makes regressions visible.
const schema = new mongoose.Schema({
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'SeoRun', required: true, index: true },
  url: { type: String, required: true },
  template: String,
  status: Number,
  finalUrl: String,
  redirects: [{ _id: false, status: Number, to: String }],
  issues: [{ _id: false, code: String, severity: { type: String, enum: ['error', 'warning', 'info'] }, message: String }],
  metrics: mongoose.Schema.Types.Mixed,
  sources: [String],
  checkedAt: { type: Date, default: Date.now },
});
schema.index({ url: 1, checkedAt: -1 });
schema.index({ checkedAt: 1 }, { expireAfterSeconds: env.seo.historyDays * 86400 });

export default mongoose.model('SeoAudit', schema);
