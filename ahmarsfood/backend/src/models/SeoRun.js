import mongoose from 'mongoose';
import { env } from '../config/env.js';

const schema = new mongoose.Schema({
  baseUrl: String,
  renderJs: Boolean,
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
  pages: Number,
  counts: { error: Number, warning: Number, info: Number },
  sitemapFound: Boolean,
  truncated: Boolean,
  error: String,
});
schema.index({ startedAt: -1 });
schema.index({ startedAt: 1 }, { expireAfterSeconds: env.seo.historyDays * 86400 });

export default mongoose.model('SeoRun', schema);
