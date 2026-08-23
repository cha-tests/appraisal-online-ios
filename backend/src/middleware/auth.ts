import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        user_type: 'consumer' | 'broker';
      };
      token?: string;
    }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

/**
 * Verify Supabase JWT token from mobile app
 * Token comes in Authorization header: "Bearer <token>"
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    req.token = token;

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }

    // Fetch user profile to get user_type
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, user_type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError(401, 'User profile not found', 'USER_NOT_FOUND');
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      user_type: profile.user_type,
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    logger.error('Auth middleware error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
};

/**
 * Ensure user is a broker
 */
export const brokerOnly = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      },
    });
  }

  if (req.user.user_type !== 'broker') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'This endpoint is only available to brokers',
      },
    });
  }

  next();
};

/**
 * Ensure user is a consumer
 */
export const consumerOnly = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      },
    });
  }

  if (req.user.user_type !== 'consumer') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'This endpoint is only available to consumers',
      },
    });
  }

  next();
};
