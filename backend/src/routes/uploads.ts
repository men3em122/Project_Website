import { Router, Response } from 'express';
import multer from 'multer';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import { uploadBuffer, thumbnailUrl } from '../config/cloudinary';

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

// POST /api/uploads
// Uploads the raw image to Cloudinary as soon as the user selects it in the
// frontend. The frontend keeps the returned URL and uses it both for the AI
// service (set-image / segment) and later when saving to a category.
router.post(
  '/',
  upload.single('image'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('An image file is required', 400);
    }

    const { url, publicId, width, height } = await uploadBuffer(
      req.file.buffer,
      req.file.mimetype
    );

    res.status(201).json({
      url,
      publicId,
      thumbnail: thumbnailUrl(url),
      width,
      height,
    });
  })
);

export { router as uploadsRouter };
