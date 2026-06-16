import { Request, Response, NextFunction } from 'express';
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
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    (err as { message: string }).message.includes('UNIQUE constraint failed')
  ) {
    // SQLite unique constraint violation (e.g. duplicate email)
    statusCode = 409;
    message = 'A record with this value already exists';
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = 'Invalid JSON format';
  } else if (err instanceof Error) {
    if (err.message === 'Only image files are allowed') statusCode = 400;
    if (err.name === 'MulterError') statusCode = 400;
    message = err.message || message;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  res.status(statusCode).json({ message });
}
