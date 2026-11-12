import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const notFound = (req, res, next) =>
  next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id or value';
  } else if (err.code === 11000) {
    status = 409;
    message = `Already exists: ${Object.keys(err.keyPattern || {}).join(', ')}`;
  } else if (err.name === 'MulterError') {
    status = 400;
  }

  if (status >= 500) {
    console.error(err);
    if (env.nodeEnv === 'production') message = 'Server error';
  }
  res.status(status).json({ message });
}
