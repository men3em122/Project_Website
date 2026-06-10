import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from './AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    const firstError = Object.values(err.errors)[0];
    message = firstError?.message ?? 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  ) {
    statusCode = 409;
    message = 'A record with this value already exists';
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = 'Invalid JSON format';
  } else if (err instanceof Error) {
    if (err.message === 'Only image files are allowed') {
      statusCode = 400;
    }
    if (err.name === 'MulterError') {
      statusCode = 400;
    }
    message = err.message || message;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  res.status(statusCode).json({ message });
}
