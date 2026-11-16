import mongoose from 'mongoose';

const riderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bikeNumber: { type: String, required: true, trim: true },
    // Self-signups start "pending" until the admin approves them. Riders added by the admin (and older riders) are approved.
    approval: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    isAvailable: { type: Boolean, default: true }, // false while on a delivery (or set by admin)
    isOnline: { type: Boolean, default: false }, // rider's own Available/Offline toggle
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    lastLocationUpdate: Date,
  },
  { timestamps: true }
);

riderSchema.index({ location: '2dsphere' });

export default mongoose.model('Rider', riderSchema);
