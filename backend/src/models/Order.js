import mongoose from 'mongoose';

export const ORDER_STATUSES = ['Pending Payment', 'Pending', 'Preparing', 'Ready for Pickup', 'On The Way', 'Delivered', 'Cancelled'];

const itemSchema = new mongoose.Schema(
  {
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
    name: String, // snapshot, so later menu edits never change past orders
    price: Number,
    qty: { type: Number, min: 1, required: true },
  },
  { _id: false }
);

const genOrderNo = () =>
  'AF-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true, default: genOrderNo },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty for guest orders
    guestTokenHash: { type: String, select: false }, // guest orders only: hash of the secret in the tracking link
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'Pending Payment', index: true },
    fulfillment: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' }, // pickup: the customer collects at the restaurant, no rider
    paymentMethod: { type: String, enum: ['paystack', 'transfer'], required: true },
    transferClaimedAt: Date, // bank transfer: when the customer said they had sent the money
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed'], default: 'unpaid' },
    paymentReference: String,
    customerName: String,
    customerPhone: String,
    note: String,
    deliveryAddress: { type: String, required: true }, // "Pickup at the restaurant" for pickup orders
    landmark: String,
    lat: { type: Number, required: function () { return this.fulfillment !== 'pickup'; } },
    lng: { type: Number, required: function () { return this.fulfillment !== 'pickup'; } },
    distanceKm: Number, // restaurant -> customer, straight line
    estimatedTime: Number, // minutes, whole order
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
