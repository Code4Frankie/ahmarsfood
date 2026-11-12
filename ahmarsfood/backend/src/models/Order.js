import mongoose from 'mongoose';

export const ORDER_STATUSES = ['Pending Payment', 'Pending', 'Preparing', 'On The Way', 'Delivered', 'Cancelled'];

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
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'Pending Payment', index: true },
    paymentMethod: { type: String, enum: ['paystack', 'opay', 'pod'], required: true },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed'], default: 'unpaid' },
    paymentReference: String,
    customerName: String,
    customerPhone: String,
    note: String,
    deliveryAddress: { type: String, required: true },
    landmark: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    distanceKm: Number, // restaurant -> customer, straight line
    estimatedTime: Number, // minutes, whole order
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
