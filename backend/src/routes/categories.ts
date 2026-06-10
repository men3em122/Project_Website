import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Image } from '../models/Image';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import { CATEGORY_COLORS } from './auth';

const router = Router();

router.use(protect);

// GET /api/categories — list user's categories with stats
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const categories = await Category.find({ userId: req.userId }).sort({ createdAt: -1 });

  const enriched = await Promise.all(
    categories.map(async (cat) => {
      const images = await Image.find({ categoryId: cat._id })
        .sort({ createdAt: -1 })
        .select('thumbnail annotations');

      const imageCount = images.length;
      const annotationCount = images.reduce((acc, img) => acc + img.annotations.length, 0);
      const thumbnails = images.slice(0, 4).map((img) => img.thumbnail);

      return {
        id: cat._id.toString(),
        name: cat.name,
        description: cat.description,
        color: cat.color,
        imageCount,
        annotationCount,
        thumbnails,
        createdAt: cat.createdAt.toISOString(),
      };
    })
  );

  res.json({ categories: enriched });
}));

// POST /api/categories — create a new category
router.post('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };

  if (!name || !name.trim()) {
    throw new AppError('Category name is required', 400);
  }

  const count = await Category.countDocuments({ userId: req.userId });
  const color = CATEGORY_COLORS[count % CATEGORY_COLORS.length];

  const category = await Category.create({
    userId: new mongoose.Types.ObjectId(req.userId),
    name: name.trim(),
    description: description?.trim(),
    color,
  });

  res.status(201).json({
    category: {
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      color: category.color,
      imageCount: 0,
      annotationCount: 0,
      thumbnails: [],
      createdAt: category.createdAt.toISOString(),
    },
  });
}));

// PUT /api/categories/:id — update category
router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };

  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { name: name?.trim(), description: description?.trim() },
    { new: true, runValidators: true }
  );

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const images = await Image.find({ categoryId: category._id }).select('thumbnail annotations');
  const thumbnails = images.slice(0, 4).map((img) => img.thumbnail);

  res.json({
    category: {
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      color: category.color,
      imageCount: images.length,
      annotationCount: images.reduce((acc, img) => acc + img.annotations.length, 0),
      thumbnails,
      createdAt: category.createdAt.toISOString(),
    },
  });
}));

// DELETE /api/categories/:id — delete category and all its images
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const category = await Category.findOneAndDelete({ _id: req.params.id, userId: req.userId });

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  await Image.deleteMany({ categoryId: req.params.id });

  res.json({ message: 'Category deleted successfully' });
}));

export { router as categoriesRouter };
