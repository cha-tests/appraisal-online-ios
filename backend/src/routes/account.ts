import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as accountDeletionService from '../services/accountDeletion.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * DELETE /api/account
 * Permanently deletes the CALLER's own account (consumer or broker).
 *
 * Who is deleted comes only from the verified Bearer token (authMiddleware
 * sets req.user/req.token) — there is no request body and no user id
 * parameter, so a caller can never target anyone else. The database step
 * additionally runs as that same user (auth.uid()), see
 * services/accountDeletion.service.ts.
 *
 * Safe to retry: if storage or auth deletion fails after the database
 * step succeeded, calling this again finishes the job.
 */
router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const token = req.token;

  if (!userId || !token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  try {
    const result = await accountDeletionService.deleteAccount(userId, token);
    res.json({ success: true, result });
  } catch (error) {
    logger.error(`Error deleting account ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCOUNT_DELETION_FAILED',
        message: 'Failed to delete account. Please try again.',
      },
    });
  }
});

export default router;
