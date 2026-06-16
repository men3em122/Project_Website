import { Router, Response } from 'express';
import multer from 'multer';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import { saveImageLocally } from '../config/storage';

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
// Saves the image to the local uploads/ directory immediately on selection.
// Returns the local URL so the frontend can pass it to the AI service and
// then reference it when saving the annotated image to a category.
router.post(
  '/',
  upload.single('image'),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) throw new AppError('An image file is required', 400);

    const { url, thumbnail, width, height } = await saveImageLocally(
      req.file.buffer,
      req.file.mimetype
    );

    res.status(201).json({
      url,
      publicId: '',   // no cloud public ID in offline mode
      thumbnail,
      width,
      height,
    });
  })
);

export { router as uploadsRouter };
