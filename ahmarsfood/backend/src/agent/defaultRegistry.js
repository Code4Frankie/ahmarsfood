import { env } from '../config/env.js';
import AgentLog from '../models/AgentLog.js';
import * as foods from '../services/foods.js';
import * as orders from '../services/orders.js';
import * as reports from '../services/reports.js';
import * as drafts from '../services/foodDrafts.js';
import * as seo from '../services/seoReport.js';
import { createAction, claimAction } from '../services/agentActions.js';
import { createRegistry } from './toolRegistry.js';
import { makeSearchFoods } from './tools/searchFoods.js';
import { makeGetFood } from './tools/getFood.js';
import { makeCompareFoods } from './tools/compareFoods.js';
import { makeGetOrderStatus } from './tools/getOrderStatus.js';
import { makeGetHelp } from './tools/getHelp.js';
import { makeGetSalesSummary } from './tools/getSalesSummary.js';
import { makeAddToCart } from './tools/addToCart.js';
import { makeGoToCheckout } from './tools/goToCheckout.js';
import { makeCreateFoodDraft } from './tools/createFoodDraft.js';
import { makeUpdatePrice } from './tools/updatePrice.js';
import { makeGetSeoReport } from './tools/getSeoReport.js';

export function buildDefaultRegistry() {
  const tools = [
    makeSearchFoods({ foods }),
    makeGetFood({ foods }),
    makeCompareFoods({ foods }),
    makeGetOrderStatus({ orders }),
    makeGetHelp({ whatsapp: env.restaurant.whatsapp }),
    makeAddToCart({ foods }),
    makeGoToCheckout(),
    makeGetSalesSummary({ reports }),
    makeCreateFoodDraft({ drafts }),
    makeUpdatePrice({ foods }),
    makeGetSeoReport({ seo }),
  ];
  return createRegistry({
    tools,
    actions: { create: createAction, claim: claimAction },
    log: (entry) => AgentLog.create(entry),
  });
}
