import { Router } from 'express';
import User from '../models/User.js';
import Rider from '../models/Rider.js';
import { signToken, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone, isValidPhone } from '../utils/phone.js';
import { env } from '../config/env.js';
import { sendSms } from '../services/sms.js';
import { generateResetCode, hashResetCode, resetCodeMatches, RESET_CODE_TTL_MS, RESET_RESEND_MS, RESET_MAX_ATTEMPTS } from '../utils/resetCode.js';

const router = Router();
const publicUser = (u) => ({ id: u._id, name: u.name, phone: u.phone, email: u.email, role: u.role, address: u.address, phoneVerified: !!u.phoneVerifiedAt });

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!name?.trim()) throw new HttpError(400, 'Name is required');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Enter a valid Nigerian phone number');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

  // role is never taken from the request: public sign-ups are always customers.
  const user = await User.create({ name: name.trim(), phone, password, ...(email?.trim() ? { email: email.trim() } : {}) });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

// Rider sign-up: creates the login and a rider profile that stays "pending" until the phone is confirmed and the admin approves.
router.post('/rider-signup', asyncHandler(async (req, res) => {
  const { name, password, bikeNumber } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!name?.trim()) throw new HttpError(400, 'Name is required');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Enter a valid Nigerian phone number');
  if (!bikeNumber?.trim()) throw new HttpError(400, 'Bike number is required');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

  const user = await User.create({ name: name.trim(), phone, password, role: 'rider' });
  try {
    await Rider.create({ user: user._id, bikeNumber: bikeNumber.trim(), approval: 'pending' });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // no orphan login if the profile could not be created
    throw err;
  }
  await sendPhoneCode(user).catch((e) => console.error('[auth] verification SMS failed:', e.message));
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) throw new HttpError(400, 'Phone or email, and password are required');
  const phone = normalizePhone(identifier);
  const user = await User.findOne({ $or: [{ phone }, { email: String(identifier).toLowerCase().trim() }] }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new HttpError(401, 'Wrong phone/email or password');
  res.json({ token: signToken(user), user: publicUser(user) });
}));

const findByIdentifier = (identifier) =>
  User.findOne({ $or: [{ phone: normalizePhone(identifier) }, { email: String(identifier).toLowerCase().trim() }] });

// Step 1: ask for a code. The reply is always the same, so nobody can use this to find out who has an account.
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  if (!identifier || !String(identifier).trim()) throw new HttpError(400, 'Enter your phone number or email');
  const reply = { message: 'If that account exists, we have sent a 6-digit code to its phone number.' };

  const user = await findByIdentifier(identifier).select('+resetSentAt');
  if (!user) return res.json(reply);
  if (user.resetSentAt && Date.now() - user.resetSentAt.getTime() < RESET_RESEND_MS) return res.json(reply); // too soon for another SMS

  const code = generateResetCode();
  await User.updateOne({ _id: user._id }, {
    resetCodeHash: hashResetCode(code, user._id, env.jwtSecret),
    resetExpires: new Date(Date.now() + RESET_CODE_TTL_MS),
    resetAttempts: 0,
    resetSentAt: new Date(),
  });
  try {
    await sendSms(user.phone, `Your Ahmars Food password reset code is ${code}. It expires in ${RESET_CODE_TTL_MS / 60000} minutes. If you did not ask for it, ignore this message.`);
  } catch (err) {
    console.error('[auth] reset SMS failed:', err.message);
  }
  res.json(reply);
}));

// Step 2: code + new password. Every failure gives the same message.
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { identifier, code, password } = req.body;
  if (!identifier || !code) throw new HttpError(400, 'Enter your phone number or email, and the 6-digit code');
  if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const bad = new HttpError(400, 'That code is wrong or has expired. Ask for a new one.');

  const user = await findByIdentifier(identifier).select('+resetCodeHash +resetExpires +resetAttempts');
  if (!user || !user.resetCodeHash || !user.resetExpires || user.resetExpires < new Date() || user.resetAttempts >= RESET_MAX_ATTEMPTS) throw bad;
  if (!resetCodeMatches(code, user._id, user.resetCodeHash, env.jwtSecret)) {
    await User.updateOne({ _id: user._id }, { $inc: { resetAttempts: 1 } });
    throw bad;
  }

  user.password = password; // hashed by the model's pre-save hook
  user.resetCodeHash = undefined;
  user.resetExpires = undefined;
  user.resetAttempts = 0;
  user.resetSentAt = undefined;
  user.passwordChangedAt = new Date();
  await user.save();
  res.json({ message: 'Password changed. You can log in now.' });
}));

// --- Phone check (used by rider sign-ups) ---
const verifyHash = (code, userId) => hashResetCode(code, `verify:${userId}`, env.jwtSecret); // separate from password-reset codes

async function sendPhoneCode(user) {
  const code = generateResetCode();
  await User.updateOne({ _id: user._id }, {
    verifyCodeHash: verifyHash(code, user._id),
    verifyExpires: new Date(Date.now() + RESET_CODE_TTL_MS),
    verifyAttempts: 0,
    verifySentAt: new Date(),
  });
  await sendSms(user.phone, `Your Ahmars Food verification code is ${code}. It expires in ${RESET_CODE_TTL_MS / 60000} minutes.`);
}

router.post('/verify-phone/send', protect, asyncHandler(async (req, res) => {
  if (req.user.phoneVerifiedAt) return res.json({ message: 'Phone already verified' });
  const u = await User.findById(req.user._id).select('+verifySentAt');
  if (u.verifySentAt && Date.now() - u.verifySentAt.getTime() < RESET_RESEND_MS) throw new HttpError(429, 'Please wait a minute before asking for another code');
  try {
    await sendPhoneCode(u);
  } catch (err) {
    console.error('[auth] verification SMS failed:', err.message);
    throw new HttpError(502, 'Could not send the SMS right now. Please try again shortly.');
  }
  res.json({ message: 'We have sent a 6-digit code to your phone.' });
}));

router.post('/verify-phone', protect, asyncHandler(async (req, res) => {
  const bad = new HttpError(400, 'That code is wrong or has expired. Ask for a new one.');
  const u = await User.findById(req.user._id).select('+verifyCodeHash +verifyExpires +verifyAttempts');
  if (u.phoneVerifiedAt) return res.json({ user: publicUser(u) });
  const code = String(req.body.code || '').trim();
  if (!u.verifyCodeHash || !u.verifyExpires || u.verifyExpires < new Date() || u.verifyAttempts >= RESET_MAX_ATTEMPTS) throw bad;
  if (!resetCodeMatches(code, `verify:${u._id}`, u.verifyCodeHash, env.jwtSecret)) {
    await User.updateOne({ _id: u._id }, { $inc: { verifyAttempts: 1 } });
    throw bad;
  }
  u.phoneVerifiedAt = new Date();
  u.verifyCodeHash = undefined; u.verifyExpires = undefined; u.verifyAttempts = 0; u.verifySentAt = undefined;
  await u.save();
  res.json({ user: publicUser(u) });
}));

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
