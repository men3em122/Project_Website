import { Router, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { Image } from '../models/Image';
import { Category } from '../models/Category';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import { uploadBuffer, thumbnailUrl, deleteAsset } from '../config/cloudinary';

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

function serializeImage(img: InstanceType<typeof Image>) {
  return {
    id: img._id.toString(),
    name: img.name,
    originalUrl: img.originalUrl,
    thumbnail: img.thumbnail,
    width: img.width,
    height: img.height,
    annotations: img.annotations,
    categoryId: img.categoryId.toString(),
    createdAt: img.createdAt.toISOString(),
  };
}

router.get(
  '/categories/:categoryId/images',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const category = await Category.findOne({ _id: req.params.categoryId, userId: req.userId });
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const images = await Image.find({ categoryId: req.params.categoryId }).sort({ createdAt: -1 });
    res.json({ images: images.map(serializeImage) });
  })
);

router.post(
  '/categories/:categoryId/images',
  upload.single('image'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const category = await Category.findOne({ _id: req.params.categoryId, userId: req.userId });
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const { name, width, height, annotations, imageUrl } = req.body as {
      name?: string;
      width?: string;
      height?: string;
      annotations?: string;
      imageUrl?: string;
    };

    if (!name?.trim()) {
      throw new AppError('Image name is required', 400);
    }

    let originalUrl: string;
    let thumbUrl: string;
    let cloudinaryPublicId: string | undefined;

    if (req.file) {
      const { url, publicId } = await uploadBuffer(req.file.buffer, req.file.mimetype);
      originalUrl = url;
      thumbUrl = thumbnailUrl(url);
      cloudinaryPublicId = publicId;
    } else if (imageUrl) {
      originalUrl = imageUrl;
      thumbUrl = thumbnailUrl(imageUrl);
    } else {
      throw new AppError('Either an image file or imageUrl is required', 400);
    }

    let parsedAnnotations: unknown[] = [];
    if (annotations) {
      parsedAnnotations = JSON.parse(annotations);
      if (!Array.isArray(parsedAnnotations)) {
        throw new AppError('Invalid annotations JSON', 400);
      }
    }

    const image = await Image.create({
      categoryId: new mongoose.Types.ObjectId(req.params.categoryId),
      userId: new mongoose.Types.ObjectId(req.userId),
      name: name.trim(),
      originalUrl,
      thumbnail: thumbUrl,
      cloudinaryPublicId,
      width: Number(width ?? 0),
      height: Number(height ?? 0),
      annotations: parsedAnnotations,
    });

    res.status(201).json({ image: serializeImage(image) });
  })
);

router.get('/images/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const image = await Image.findOne({ _id: req.params.id, userId: req.userId });
  if (!image) {
    throw new AppError('Image not found', 404);
  }
  res.json({ image: serializeImage(image) });
}));

router.delete('/images/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const image = await Image.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!image) {
    throw new AppError('Image not found', 404);
  }

  if (image.cloudinaryPublicId) {
    await deleteAsset(image.cloudinaryPublicId);
  }

  res.json({ message: 'Image deleted successfully' });
}));

export { router as imagesRouter };
