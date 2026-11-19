import mongoose from 'mongoose';

// Small switches an admin can flip while the site is running (no redeploy needed).
const settingSchema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true }, value: { type: mongoose.Schema.Types.Mixed } },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
