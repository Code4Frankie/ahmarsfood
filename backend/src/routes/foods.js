import { Router } from 'express';
import multer from 'multer';
import Food from '../models/Food.js';
import { listFoods, getFood } from '../services/foods.js';
import { requestRebuild } from '../services/rebuild.js';
import { protect, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { uploadImage, deleteImage } from '../services/cloudinary.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('image/') ? cb(null, true) : cb(new HttpError(400, 'Only image files are allowed'))),
});
const admin = [protect, requireRole('admin')];

const pick = (b) => {
  const out = {};
  for (const k of ['name', 'price', 'category', 'description', 'isAvailable', 'prepTime']) if (b[k] !== undefined) out[k] = b[k];
  if (typeof out.isAvailable === 'string') out.isAvailable = out.isAvailable === 'true'; // multipart sends strings
  return out;
};

// Public menu. ?category=Rice
router.get('/', asyncHandler(async (req, res) => {
  res.json(await listFoods({ category: req.query.category }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ food: await getFood(req.params.id) });
}));

router.post('/', ...admin, upload.single('image'), asyncHandler(async (req, res) => {
  const data = pick(req.body);
  if (req.file) {
    const img = await uploadImage(req.file.buffer);
    data.image = img.url;
    data.imagePublicId = img.publicId;
  }
  const created = await Food.create(data);
  requestRebuild();
  res.status(201).json({ food: created });
}));

router.put('/:id', ...admin, upload.single('image'), asyncHandler(async (req, res) => {
  const food = await Food.findById(req.params.id);
  if (!food) throw new HttpError(404, 'Food not found');
  Object.assign(food, pick(req.body));
  const oldImage = food.imagePublicId;
  if (req.file) {
    const img = await uploadImage(req.file.buffer);
    food.image = img.url;
    food.imagePublicId = img.publicId;
  }
  await food.save(); // save first: the old photo is only removed once the dish has been updated
  if (req.file) await deleteImage(oldImage).catch(() => {});
  requestRebuild();
  res.json({ food });
}));

router.patch('/:id/availability', ...admin, asyncHandler(async (req, res) => {
  const food = await Food.findByIdAndUpdate(req.params.id, { isAvailable: !!req.body.isAvailable }, { new: true });
  if (!food) throw new HttpError(404, 'Food not found');
  requestRebuild();
  res.json({ food });
}));

router.delete('/:id', ...admin, asyncHandler(async (req, res) => {
  const food = await Food.findByIdAndDelete(req.params.id);
  if (!food) throw new HttpError(404, 'Food not found');
  await deleteImage(food.imagePublicId).catch(() => {});
  requestRebuild();
  res.json({ message: 'Deleted' });
}));

export default router;
