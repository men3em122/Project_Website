import { Router, Response } from 'express';
import { CategoryModel } from '../models/Category';
import { ImageModel } from '../models/Image';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import { deleteLocalImage } from '../config/storage';
import { CATEGORY_COLORS } from './auth';

const router = Router();
router.use(protect);

// GET /api/categories — list user's categories with stats
router.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const categories = CategoryModel.findByUser(req.userId!);

  const enriched = categories.map((cat) => {
    const images = ImageModel.findByCategoryForStats(cat.id);
    const imageCount = images.length;
    const annotationCount = images.reduce((acc, img) => acc + img.annotations.length, 0);
    const thumbnails = images.slice(0, 4).map((img) => img.thumbnail);
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      color: cat.color,
      imageCount,
      annotationCount,
      thumbnails,
      createdAt: cat.createdAt,
    };
  });

  res.json({ categories: enriched });
}));

// POST /api/categories — create a new category
router.post('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };

  if (!name?.trim()) throw new AppError('Category name is required', 400);

  const count = CategoryModel.countByUser(req.userId!);
  const color = CATEGORY_COLORS[count % CATEGORY_COLORS.length];
  const category = CategoryModel.create(req.userId!, name, description, color);

  res.status(201).json({
    category: { ...category, imageCount: 0, annotationCount: 0, thumbnails: [] },
  });
}));

// PUT /api/categories/:id — update category
router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };

  const category = CategoryModel.update(req.params.id, req.userId!, name, description);
  if (!category) throw new AppError('Category not found', 404);

  const images = ImageModel.findByCategoryForStats(category.id);
  res.json({
    category: {
      ...category,
      imageCount: images.length,
      annotationCount: images.reduce((acc, img) => acc + img.annotations.length, 0),
      thumbnails: images.slice(0, 4).map((img) => img.thumbnail),
    },
  });
}));

// DELETE /api/categories/:id — delete category and all its images
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Fetch images before deletion so we can clean up local files
  const images = ImageModel.findByCategory(req.params.id);

  const deleted = CategoryModel.delete(req.params.id, req.userId!);
  if (!deleted) throw new AppError('Category not found', 404);

  for (const img of images) {
    deleteLocalImage(img.localPath);
  }

  res.json({ message: 'Category deleted successfully' });
}));

export { router as categoriesRouter };
