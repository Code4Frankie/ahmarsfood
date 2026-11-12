import { Router } from 'express';
import User from '../models/User.js';
import { signToken, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone, isValidPhone } from '../utils/phone.js';

const router = Router();
const publicUser = (u) => ({ id: u._id, name: u.name, phone: u.phone, email: u.email, role: u.role, address: u.address });

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

router.post('/login', asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) throw new HttpError(400, 'Phone or email, and password are required');
  const phone = normalizePhone(identifier);
  const user = await User.findOne({ $or: [{ phone }, { email: String(identifier).toLowerCase().trim() }] }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new HttpError(401, 'Wrong phone/email or password');
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
