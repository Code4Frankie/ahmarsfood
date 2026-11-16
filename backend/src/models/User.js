import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['customer', 'admin', 'rider'], default: 'customer' },
    address: String,
    // Password reset (see routes/auth.js). Only a hash of the 6-digit code is kept.
    resetCodeHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    resetAttempts: { type: Number, default: 0, select: false },
    resetSentAt: { type: Date, select: false },
    // Phone check for rider sign-ups: a 6-digit SMS code. Only a hash of the code is kept.
    phoneVerifiedAt: Date,
    verifyCodeHash: { type: String, select: false },
    verifyExpires: { type: Date, select: false },
    verifyAttempts: { type: Number, default: 0, select: false },
    verifySentAt: { type: Date, select: false },
    passwordChangedAt: Date, // tokens issued before this moment stop working
    lat: Number,
    lng: Number,
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
