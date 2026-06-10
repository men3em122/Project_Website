import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';

const router = Router();

const CATEGORY_COLORS = [
  '#58a6ff', '#bc8cff', '#3fb950', '#f0883e',
  '#f85149', '#ffa657', '#79c0ff', '#d2a8ff',
];

function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any }
  );
}

function formatUser(user: InstanceType<typeof User>) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res: Response): Promise<void> => {
  const { name, email, password, confirmPassword } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  };

  if (!name || !email || !password) {
    throw new AppError('Name, email and password are required', 400);
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({ name: name.trim(), email, password });
  const token = generateToken(user._id.toString());

  res.status(201).json({ token, user: formatUser(user) });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken(user._id.toString());
  res.json({ token, user: formatUser(user) });
}));

// GET /api/auth/me  (protected)
router.get('/me', protect, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  res.json({ user: formatUser(user) });
}));

// PUT /api/auth/me  (protected)
router.put('/me', protect, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email } = req.body as { name?: string; email?: string };

  if (email !== undefined) {
    throw new AppError('Email cannot be edited', 400);
  }

  const updates: { name?: string } = {};
  if (name) updates.name = name.trim();

  if (!updates.name) {
    throw new AppError('No valid fields to update', 400);
  }

  const user = await User.findByIdAndUpdate(req.userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ user: formatUser(user) });
}));

// PUT /api/auth/change-password  (protected)
router.put('/change-password', protect, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword, confirmPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters', 400);
  }

  const user = await User.findById(req.userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: 'Password changed successfully' });
}));

export { router as authRouter, CATEGORY_COLORS };
