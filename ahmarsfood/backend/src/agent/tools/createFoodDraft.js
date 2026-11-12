import { schemas } from '../schemas.js';

// Writes to the separate fooddrafts collection only. A draft is invisible to customers; an admin reviews and
// publishes it through the normal menu screen/endpoint. The assistant never publishes.
export const makeCreateFoodDraft = ({ drafts }) => ({
  name: 'create_food_draft',
  label: 'Saving a draft dish…',
  roles: ['admin'],
  description: 'Admin only. Save a suggested new dish as a DRAFT for review. It is not published and not visible to customers.',
  zod: schemas.create_food_draft.zod,
  jsonSchema: schemas.create_food_draft.json,
  async run(input, { user }) {
    const d = await drafts.createDraft({ name: input.name, category: input.category, price: input.price, description: input.description, prepTime: input.prep_time }, user);
    return { draft_id: String(d._id), status: 'draft', note: 'Saved as a draft only. An admin must review and publish it.' };
  },
});
