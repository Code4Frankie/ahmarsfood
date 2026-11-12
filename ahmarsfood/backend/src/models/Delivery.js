import mongoose from 'mongoose';

export const DELIVERY_STATUSES = [
  'Searching', // no active offer, looking for the next rider
  'Offered', // waiting for a rider to accept (offerExpiresAt)
  'Accepted',
  'Picked Up',
  'On The Way',
  'Delivered',
  'Unassigned', // nobody available: Admin queue
  'Cancelled',
];

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', index: true },
    status: { type: String, enum: DELIVERY_STATUSES, default: 'Searching', index: true },
    distanceKm: Number,
    estimatedTime: Number,
    deliveryFee: Number, // earned by the rider
    riderDistanceKm: Number, // rider -> restaurant when offered
    attemptedRiders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Rider' }],
    offerExpiresAt: Date,
    acceptedAt: Date,
    deliveredAt: Date,
    unassignedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Delivery', deliverySchema);
