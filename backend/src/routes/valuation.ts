import { Router, Request, Response } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import * as geminiService from '../services/gemini.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/valuation/generate
 *
 * Proxies the Gemini valuation call server-side, mirroring routes/places.ts's
 * reasoning for proxying Google Places: keeps GEMINI_API_KEY out of the
 * client bundle instead of shipping it via EXPO_PUBLIC_*.
 *
 * Wired up to the web build only (mobile/services/report.service.ts
 * branches on Platform.OS === 'web') — native keeps calling Gemini directly
 * with EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY for now, same constraint as the
 * Places proxy (this endpoint only works once the backend has a public URL,
 * which native's EXPO_PUBLIC_API_URL may not point at in every environment).
 *
 * optionalAuthMiddleware, not authMiddleware: a signed-out guest can use the
 * consumer valuation flow before signing up, and this route doesn't care who
 * (or whether anyone) is asking — see optionalAuthMiddleware's own comment.
 */
router.post('/generate', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { propertyDetails, location, comparables, countryCode } = req.body;

    if (!propertyDetails || !location || !Array.isArray(comparables)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing propertyDetails, location, or comparables',
        },
      });
    }

    const result = await geminiService.generateValuation(
      propertyDetails,
      location,
      comparables,
      countryCode
    );

    res.json(result);
  } catch (error) {
    logger.error('Valuation proxy error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'VALUATION_ERROR', message: 'Failed to generate valuation' },
    });
  }
});

export default router;
