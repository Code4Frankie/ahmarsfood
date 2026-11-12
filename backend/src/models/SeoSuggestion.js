import mongoose from 'mongoose';

// AI-written SEO copy waiting for a human decision. Nothing here is live until an admin approves it.
const schema = new mongoose.Schema({
  targetType: { type: String, enum: ['food', 'page'], required: true },
  food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  url: String,
  label: String, // dish name or page path, for display
  current: { title: String, description: String },
  suggested: { title: String, description: String, jsonLd: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'approved', 'applied', 'rejected'], default: 'pending', index: true },
  model: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
}, { timestamps: true });

export default mongoose.model('SeoSuggestion', schema);
