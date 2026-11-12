import mongoose from 'mongoose';
import { z } from 'zod';
import SeoSuggestion from '../models/SeoSuggestion.js';
import { HttpError } from '../utils/httpError.js';
import { getFood, setDescription } from './foods.js';
import { pagesMissingDescription } from './seoReport.js';
import { generateCopy, buildMenuItemJsonLd, clamp, LIMITS } from '../seo/suggest.js';
import { validateJsonLd } from '../seo/jsonld.js';

// Suggestion for one dish: title, description and MenuItem JSON-LD. Saved as "pending"; nothing goes live.
export async function suggestForFood({ foodId, user, llm, model }) {
  const food = await getFood(foodId);
  const copy = await generateCopy({ llm, model, kind: 'menu item', subject: { name: food.name, category: food.category, price_naira: food.price, current_description: food.description || '' } });
  const jsonLd = buildMenuItemJsonLd(food, copy);
  if (validateJsonLd([{ data: jsonLd }]).issues.length) throw new HttpError(500, 'Generated structured data did not validate');
  return SeoSuggestion.create({
    targetType: 'food', food: food._id, label: food.name, current: { description: food.description || '' },
    suggested: { ...copy, jsonLd }, model, createdBy: user._id,
  });
}

// Queue copy for pages the latest crawl found without a meta description (skips pages already queued).
export async function suggestForFlaggedPages({ user, llm, model, limit }) {
  const flagged = await pagesMissingDescription();
  const queued = new Set((await SeoSuggestion.find({ targetType: 'page', status: { $in: ['pending', 'approved'] } }).select('url').lean()).map((s) => s.url));
  const todo = flagged.filter((a) => !queued.has(a.url)).slice(0, limit);
  const created = [];
  for (const a of todo) {
    const copy = await generateCopy({ llm, model, kind: 'web page', subject: { path: new URL(a.url).pathname, kind_of_page: a.template, current_title: a.metrics?.title || '' } });
    created.push(await SeoSuggestion.create({
      targetType: 'page', url: a.url, label: new URL(a.url).pathname, current: { title: a.metrics?.title, description: a.metrics?.description },
      suggested: copy, model, createdBy: user._id,
    }));
  }
  return { created, skippedAlreadyQueued: flagged.length - todo.length };
}

export const listSuggestions = (status) => SeoSuggestion.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(100).lean();

const edits = z.object({ title: z.string().trim().min(1).max(300).optional(), description: z.string().trim().min(1).max(800).optional() }).strict();

// Approve (optionally with the admin's edits) or reject. The claim is atomic, so a suggestion is decided once.
// Dish suggestions: approving applies the description to the dish. Page suggestions: approving stores the final wording;
// page tags live in the React code, so a developer pastes approved copy there.
export async function decide({ id, decision, changes = {}, user }) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id');
  const parsed = edits.safeParse(changes);
  if (!parsed.success) throw new HttpError(400, 'Invalid edits');

  const claimed = await SeoSuggestion.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: decision === 'reject' ? 'rejected' : 'approved', decidedBy: user._id, decidedAt: new Date() } },
    { new: true }
  );
  if (!claimed) throw new HttpError(409, 'This suggestion was already decided');
  if (decision === 'reject') return claimed;

  const final = {
    title: clamp(parsed.data.title ?? claimed.suggested.title ?? '', LIMITS.title),
    description: clamp(parsed.data.description ?? claimed.suggested.description ?? '', LIMITS.description),
  };
  try {
    if (claimed.targetType === 'food') {
      await setDescription(claimed.food, final.description);
      claimed.status = 'applied';
    }
    claimed.suggested.title = final.title;
    claimed.suggested.description = final.description;
    if (claimed.suggested.jsonLd) claimed.suggested.jsonLd = { ...claimed.suggested.jsonLd, description: final.description };
    claimed.markModified('suggested');
    await claimed.save();
  } catch (err) {
    await SeoSuggestion.updateOne({ _id: id }, { $set: { status: 'pending' }, $unset: { decidedBy: 1, decidedAt: 1 } }); // nothing was applied: let the admin retry
    throw err;
  }
  return claimed;
}
