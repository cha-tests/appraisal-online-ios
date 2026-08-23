import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, brokerOnly } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import * as stripeService from '../services/stripe.js';
import * as supabaseService from '../services/supabase.js';
import * as emailService from '../services/email.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Schema validation
const CreateIntentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().default('USD'),
  tier: z.enum(['Founder Lifetime', 'Premium Annual', 'Basic Annual']).optional(),
});

const ProcessPaymentSchema = z.object({
  clientSecret: z.string(),
  cardData: z.object({
    number: z.string(),
    exp_month: z.number(),
    exp_year: z.number(),
    cvc: z.string(),
    name: z.string(),
    email: z.string().email(),
  }),
});

const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string(),
});

/**
 * POST /api/payments/intent
 * Create a Stripe payment intent
 */
router.post('/intent', authMiddleware, brokerOnly, async (req: Request, res: Response) => {
  try {
    const validated = CreateIntentSchema.parse(req.body);

    const intent = await stripeService.createPaymentIntent(
      validated.amount,
      validated.currency,
      {
        brokerId: req.user?.id,
        tier: validated.tier,
      }
    );

    res.json({
      success: true,
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
      });
    }

    logger.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_ERROR',
        message: 'Failed to create payment intent',
      },
    });
  }
});

/**
 * POST /api/payments/charge
 * Process a payment
 */
router.post('/charge', authMiddleware, brokerOnly, async (req: Request, res: Response) => {
  try {
    const validated = ProcessPaymentSchema.parse(req.body);

    const result = await stripeService.processPayment(
      validated.clientSecret,
      validated.cardData,
      {
        brokerId: req.user?.id,
      }
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: result.code || 'PAYMENT_FAILED',
          message: result.error || 'Payment processing failed',
        },
      });
    }

    res.json({
      success: true,
      paymentIntentId: result.paymentIntentId,
      amount: result.amount,
      currency: result.currency,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
        },
      });
    }

    logger.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_ERROR',
        message: 'Payment processing failed',
      },
    });
  }
});

/**
 * POST /api/payments/confirm
 * Confirm a payment and create subscription
 */
router.post('/confirm', authMiddleware, brokerOnly, async (req: Request, res: Response) => {
  try {
    const validated = ConfirmPaymentSchema.parse(req.body);

    // Verify payment intent
    const intent = await stripeService.getPaymentIntent(validated.paymentIntentId);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_CONFIRMED',
          message: 'Payment was not successful',
        },
      });
    }

    // Create subscription record in database
    const subscription = await supabaseService.createSubscription(
      req.user?.id || '',
      `cus_${validated.paymentIntentId}`,
      validated.paymentIntentId,
      'Premium Annual' // TODO: Get from request
    );

    // Send welcome email
    const user = await supabaseService.getUser(req.user?.id || '');
    if (user?.email) {
      try {
        await emailService.sendBrokerWelcomeEmail(
          user.email,
          user.company_name || 'Broker',
          'Premium Annual',
          30
        );
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
        // Don't fail the payment if email fails
      }
    }

    res.json({
      success: true,
      subscriptionId: subscription.id,
      message: 'Payment confirmed and subscription created',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
        },
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    logger.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIRMATION_ERROR',
        message: 'Failed to confirm payment',
      },
    });
  }
});

/**
 * GET /api/payments/:paymentIntentId
 * Get payment status
 */
router.get('/:paymentIntentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const intent = await stripeService.getPaymentIntent(req.params.paymentIntentId);

    res.json({
      success: true,
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
    });
  } catch (error) {
    logger.error('Error retrieving payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETRIEVAL_ERROR',
        message: 'Failed to retrieve payment status',
      },
    });
  }
});

export default router;
