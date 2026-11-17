import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: '7d' });

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Not authenticated');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  // A password reset signs out every device: tokens issued before the change are refused.
  if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
    throw new HttpError(401, 'Password was changed, please log in again');
  }
  req.user = user;
  next();
});

// Signed-in users are recognised; with no Authorization header the request continues as a guest (req.user stays unset).
// A header that is present but invalid is still refused, so a stale login is not silently treated as a guest.
export const optionalAuth = (req, res, next) => (req.headers.authorization ? protect(req, res, next) : next());

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));
