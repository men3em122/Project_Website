import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './AppError';

export interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  userId: string;
}

export function protect(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('No token provided, authorization denied', 401));
    return;
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET as string, (verifyErr, decoded) => {
    if (verifyErr || !decoded) {
      next(new AppError('Invalid or expired token', 401));
      return;
    }
    req.userId = (decoded as JwtPayload).userId;
    next();
  });
}
