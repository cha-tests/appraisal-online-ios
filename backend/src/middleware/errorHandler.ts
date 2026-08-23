import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error:', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message,
      },
    });
  }

  // Stripe errors
  if (err.type === 'StripeCardError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CARD_ERROR',
        message: err.message,
      },
    });
  }

  if (err.type === 'StripeRateLimitError') {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests',
      },
    });
  }

  if (err.type === 'StripeInvalidRequestError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: err.message,
      },
    });
  }

  // Supabase errors
  if (err.status && err.message) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: err.message,
      },
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
