import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as geminiService from '../services/gemini.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/valuation/generate
 *
 * Proxies the Gemini valuation call server-side, mirroring routes/places.ts's
 * reasoning for proxying Google Places: keeps GEMINI_API_KEY out of the
 * mobile app bundle instead of shipping it via EXPO_PUBLIC_*.
 *
 * Not yet wired up to the mobile app — report.service.ts still calls Gemini
 * directly using EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY. Switching the app over to
 * this endpoint only makes sense once the backend is reachable from a real
 * device (i.e. deployed somewhere with a public URL, not just this dev
 * machine's LAN IP) — see the comment on EXPO_PUBLIC_API_URL in
 * mobile/.env.local for why that same constraint already limits the Places
 * proxy to the web build only.
 */
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
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
