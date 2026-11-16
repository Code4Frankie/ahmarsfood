import { Router } from 'express';
import Rider from '../models/Rider.js';
import Delivery from '../models/Delivery.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { acceptOffer, rejectOffer, advanceDelivery } from '../services/dispatch.js';
import { deliveryView } from './riders.js';

const router = Router();
router.use(protect, requireRole('rider'));

const riderId = async (req) => {
  const rider = await Rider.findOne({ user: req.user._id }).select('_id');
  if (!rider) throw new HttpError(404, 'No rider profile for this account');
  return rider._id;
};

router.post('/:id/accept', asyncHandler(async (req, res) => {
  const delivery = await acceptOffer(req.params.id, await riderId(req));
  res.json({ delivery: deliveryView(await delivery.populate('order'), { accepted: true }) });
}));

router.post('/:id/reject', asyncHandler(async (req, res) => {
  await rejectOffer(req.params.id, await riderId(req));
  res.json({ message: 'Offer declined' });
}));

// body: { status: "Picked Up" | "On The Way" | "Delivered" }
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const d = await advanceDelivery(req.params.id, await riderId(req), req.body.status);
  res.json({ delivery: deliveryView(await Delivery.findById(d._id).populate('order'), { accepted: true }) });
}));

export default router;
