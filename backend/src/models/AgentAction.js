import mongoose from 'mongoose';

// A prepared action waiting for the user's Confirm tap. Single-use, bound to one user, expires quickly.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tool: { type: String, required: true },
  input: mongoose.Schema.Types.Mixed, // already validated by the tool's zod schema
  summary: String,
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 }); // tidy up a day after expiry

export default mongoose.model('AgentAction', schema);
