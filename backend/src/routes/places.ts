import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Proxies Google's Places Autocomplete/Details APIs.
 *
 * These calls used to go straight from the mobile app to Google. That works
 * fine on native (no CORS enforcement there), but on the web build the
 * browser blocks it outright — Google's Places REST API doesn't send
 * Access-Control-Allow-Origin headers, so any direct browser fetch/XHR to it
 * is rejected before Google's response is even read. Routing it through this
 * backend (a normal server-to-server call, no CORS involved) fixes web
 * without changing native's behavior, and as a side benefit keeps the API
 * key out of the client bundle entirely.
 */

/**
 * GET /api/places/autocomplete
 */
router.get('/autocomplete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { input, components } = req.query;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing "input" query parameter' },
      });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input,
          key: process.env.GOOGLE_PLACES_API_KEY,
          // No 'types' restriction at all — 'address' excluded named
          // subdivisions/villages (common in PH addressing, e.g. "JCMC
          // Ville"), and even the broader 'geocode' still missed some,
          // since a subdivision indexed by Google as an establishment/POI
          // falls under a different type category that 'geocode' doesn't
          // cover — the API only accepts one type category per request, it
          // can't combine geocode + establishment. Omitting 'types'
          // entirely returns predictions of every type, matching how the
          // full Google Maps app searches (no type restriction there either).
          components,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    logger.error('Places autocomplete proxy error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PLACES_ERROR', message: 'Failed to fetch address predictions' },
    });
  }
});

/**
 * GET /api/places/details
 */
router.get('/details', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { place_id } = req.query;

    if (!place_id || typeof place_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing "place_id" query parameter' },
      });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id,
          key: process.env.GOOGLE_PLACES_API_KEY,
          fields: 'geometry,formatted_address,address_components',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    logger.error('Places details proxy error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'PLACES_ERROR', message: 'Failed to fetch address details' },
    });
  }
});

export default router;
