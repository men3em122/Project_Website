import { Router, Response } from 'express';
import multer from 'multer';
import { ImageModel, IImage } from '../models/Image';
import { CategoryModel } from '../models/Category';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import { saveImageLocally, deriveThumbnailUrl, urlToLocalPath, deleteLocalImage } from '../config/storage';

const router = Router();
router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

function serializeImage(img: IImage) {
  return {
    id: img.id,
    name: img.name,
    originalUrl: img.originalUrl,
    thumbnail: img.thumbnail,
    width: img.width,
    height: img.height,
    annotations: img.annotations,
    categoryId: img.categoryId,
    createdAt: img.createdAt,
  };
}

// GET /api/categories/:categoryId/images
router.get(
  '/categories/:categoryId/images',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const category = CategoryModel.findByIdAndUser(req.params.categoryId, req.userId!);
    if (!category) throw new AppError('Category not found', 404);

    const images = ImageModel.findByCategory(req.params.categoryId);
    res.json({ images: images.map(serializeImage) });
  })
);

// POST /api/categories/:categoryId/images
router.post(
  '/categories/:categoryId/images',
  upload.single('image'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const category = CategoryModel.findByIdAndUser(req.params.categoryId, req.userId!);
    if (!category) throw new AppError('Category not found', 404);

    const { name, width, height, annotations, imageUrl } = req.body as {
      name?: string;
      width?: string;
      height?: string;
      annotations?: string;
      imageUrl?: string;
    };

    if (!name?.trim()) throw new AppError('Image name is required', 400);

    let originalUrl: string;
    let thumbUrl: string;
    let localPath: string | undefined;
    let imgWidth = Number(width ?? 0);
    let imgHeight = Number(height ?? 0);

    if (req.file) {
      const saved = await saveImageLocally(req.file.buffer, req.file.mimetype);
      originalUrl = saved.url;
      thumbUrl = saved.thumbnail;
      localPath = saved.localPath;
      imgWidth = saved.width;
      imgHeight = saved.height;
    } else if (imageUrl) {
      // Image was already saved locally via POST /api/uploads
      originalUrl = imageUrl;
      thumbUrl = deriveThumbnailUrl(imageUrl);
      localPath = urlToLocalPath(imageUrl);
    } else {
      throw new AppError('Either an image file or imageUrl is required', 400);
    }

    let parsedAnnotations: unknown[] = [];
    if (annotations) {
      parsedAnnotations = JSON.parse(annotations);
      if (!Array.isArray(parsedAnnotations)) throw new AppError('Invalid annotations JSON', 400);
    }

    const image = ImageModel.create({
      categoryId: req.params.categoryId,
      userId: req.userId!,
      name,
      originalUrl,
      thumbnail: thumbUrl,
      localPath,
      width: imgWidth,
      height: imgHeight,
      annotations: parsedAnnotations,
    });

    res.status(201).json({ image: serializeImage(image) });
  })
);

// GET /api/images/:id
router.get(
  '/images/:id',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const image = ImageModel.findByIdAndUser(req.params.id, req.userId!);
    if (!image) throw new AppError('Image not found', 404);
    res.json({ image: serializeImage(image) });
  })
);

// DELETE /api/images/:id
router.delete(
  '/images/:id',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const image = ImageModel.delete(req.params.id, req.userId!);
    if (!image) throw new AppError('Image not found', 404);
    deleteLocalImage(image.localPath);
    res.json({ message: 'Image deleted successfully' });
  })
);

// GET /api/stats/accuracy
router.get(
  '/stats/accuracy',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const images = ImageModel.findByUser(req.userId!);
    let totalConfidence = 0;
    let autoAnnotationCount = 0;

    for (const image of images) {
      for (const annotation of image.annotations) {
        if (annotation.detectionMethod === 'auto' && annotation.confidence != null) {
          totalConfidence += annotation.confidence;
          autoAnnotationCount++;
        }
      }
    }

    const accuracy =
      autoAnnotationCount > 0
        ? Math.round((totalConfidence / autoAnnotationCount) * 100) / 100
        : null;

    res.json({ accuracy, autoAnnotationCount });
  })
);

export { router as imagesRouter };
