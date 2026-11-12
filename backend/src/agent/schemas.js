import { z } from 'zod';
import { FOOD_CATEGORIES } from '../utils/constants.js';

// Every tool input is validated here BEFORE it reaches a service. Schemas are strict (unknown keys rejected) and
// only allow plain strings and numbers, so a model-built object such as {"$ne": "x"} or {"$where": "..."} fails.
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-character id');
const orderNo = z.string().regex(/^AF-[A-Z0-9]+$/, 'looks like AF-XXXXXXXX');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const cats = [...FOOD_CATEGORIES];

const idProp = { type: 'string', description: 'The dish id from a previous tool result' };

export const schemas = {
  search_foods: {
    zod: z.object({
      query: z.string().trim().max(100).optional(),
      category: z.enum(FOOD_CATEGORIES).optional(),
      max_price: z.number().positive().max(1_000_000).optional(),
      limit: z.number().int().min(1).max(10).default(6),
    }).strict(),
    json: { type: 'object', additionalProperties: false, properties: {
      query: { type: 'string', description: 'Words to look for, e.g. "egusi" or "chicken"' },
      category: { type: 'string', enum: cats },
      max_price: { type: 'number', description: 'Highest price in Naira' },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
    } },
  },
  get_food: {
    zod: z.object({ food_id: objectId }).strict(),
    json: { type: 'object', additionalProperties: false, required: ['food_id'], properties: { food_id: idProp } },
  },
  compare_foods: {
    zod: z.object({ food_ids: z.array(objectId).min(2).max(4) }).strict(),
    json: { type: 'object', additionalProperties: false, required: ['food_ids'], properties: { food_ids: { type: 'array', items: idProp, minItems: 2, maxItems: 4 } } },
  },
  get_order_status: {
    zod: z.object({ order_no: orderNo.optional(), order_id: objectId.optional() }).strict(),
    json: { type: 'object', additionalProperties: false, properties: {
      order_no: { type: 'string', description: 'Order number such as AF-LX3K2P. Leave out to use the latest order.' },
      order_id: { type: 'string' },
    } },
  },
  get_help: {
    zod: z.object({ topic: z.enum(['order_problem', 'refund', 'delivery', 'other']).optional(), order_no: orderNo.optional() }).strict(),
    json: { type: 'object', additionalProperties: false, properties: {
      topic: { type: 'string', enum: ['order_problem', 'refund', 'delivery', 'other'] },
      order_no: { type: 'string' },
    } },
  },
  add_to_cart: {
    zod: z.object({ items: z.array(z.object({ food_id: objectId, qty: z.number().int().min(1).max(20).default(1) }).strict()).min(1).max(10) }).strict(),
    json: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', minItems: 1, maxItems: 10, items: {
      type: 'object', additionalProperties: false, required: ['food_id'], properties: { food_id: idProp, qty: { type: 'integer', minimum: 1, maximum: 20 } } } } } },
  },
  get_seo_report: {
    zod: z.object({}).strict(),
    json: { type: 'object', additionalProperties: false, properties: {} },
  },
  go_to_checkout: {
    zod: z.object({}).strict(),
    json: { type: 'object', additionalProperties: false, properties: {} },
  },
  get_sales_summary: {
    zod: z.object({ date: day.optional() }).strict(),
    json: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', description: 'YYYY-MM-DD; today if left out' } } },
  },
  create_food_draft: {
    zod: z.object({
      name: z.string().trim().min(2).max(80),
      category: z.enum(FOOD_CATEGORIES),
      price: z.number().min(0).max(1_000_000),
      description: z.string().trim().max(500).optional(),
      prep_time: z.number().int().min(1).max(120).optional(),
    }).strict(),
    json: { type: 'object', additionalProperties: false, required: ['name', 'category', 'price'], properties: {
      name: { type: 'string' }, category: { type: 'string', enum: cats }, price: { type: 'number', description: 'Naira' },
      description: { type: 'string' }, prep_time: { type: 'integer', description: 'Minutes' },
    } },
  },
  update_price: {
    zod: z.object({ food_id: objectId, new_price: z.number().min(0).max(1_000_000) }).strict(),
    json: { type: 'object', additionalProperties: false, required: ['food_id', 'new_price'], properties: { food_id: idProp, new_price: { type: 'number', description: 'Naira' } } },
  },
};
