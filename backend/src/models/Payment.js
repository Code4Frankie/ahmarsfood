import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    provider: { type: String, enum: ['Paystack', 'Transfer'], required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true }, // Naira
    status: { type: String, enum: ['initiated', 'success', 'failed', 'abandoned'], default: 'initiated' },
    note: String, // e.g. "paid but order was cancelled: refund"
    rawResponse: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
