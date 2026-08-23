import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // Check Supabase connection
    let supabaseStatus = 'error';
    try {
      const { data } = await supabase.from('users').select('count()').limit(1);
      supabaseStatus = 'ok';
    } catch (error) {
      logger.error('Supabase health check failed:', error);
    }

    // Check Stripe (just verify configuration)
    const stripeStatus = process.env.STRIPE_SECRET_KEY ? 'ok' : 'error';

    // Check Postmark (just verify configuration)
    const postmarkStatus = process.env.POSTMARK_API_KEY ? 'ok' : 'error';

    const overallStatus = supabaseStatus === 'ok' ? 'healthy' : 'degraded';

    res.status(supabaseStatus === 'ok' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        supabase: supabaseStatus,
        stripe: stripeStatus,
        postmark: postmarkStatus,
        pdf: process.env.PDF_TEMP_DIR ? 'ok' : 'error',
      },
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    });
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Failed to perform health check',
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes or orchestration
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are available
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'STRIPE_SECRET_KEY',
      'POSTMARK_API_KEY',
    ];

    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

    if (missingVars.length > 0) {
      return res.status(503).json({
        ready: false,
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
      });
    }

    // Quick database check
    try {
      await supabase.from('users').select('count()').limit(1);
    } catch (error) {
      return res.status(503).json({
        ready: false,
        message: 'Database unavailable',
      });
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      ready: false,
      message: 'Readiness check failed',
    });
  }
});

/**
 * GET /health/live
 * Liveness probe - just check if server is running
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
