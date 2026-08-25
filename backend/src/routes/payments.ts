import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, brokerOnly } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import * as stripeService from '../services/stripe.js';
import * as supabaseService from '../services/supabase.js';
import * as emailService from '../services/email.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Schema validation.
// Note there is no `amount` here: the price is looked up from the tier
// server-side, so a client cannot choose what it pays.
const CreateIntentSchema = z.object({
  tier: z.enum(['Founder Lifetime', 'Premium Annual', 'Basic Annual']),
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

    const intent = await stripeService.createPaymentIntent(validated.tier, {
      brokerId: req.user?.id,
    });

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

// POST /api/payments/charge has been removed.
//
// It accepted raw card details and confirmed the payment from this server.
// Confirmation now happens on the device against Stripe directly, using the
// clientSecret handed out by /intent, so no endpoint here ever sees a card.
// See the note in services/stripe.ts for the full reasoning.

/**
 * POST /api/payments/confirm
 * Confirm a payment and create subscription
 */
router.post('/confirm', authMiddleware, brokerOnly, async (req: Request, res: Response) => {
  try {
    const validated = ConfirmPaymentSchema.parse(req.body);

    // Verify the payment against Stripe rather than trusting the client's word
    // that it succeeded.
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

    // The intent must belong to the caller. Without this, a broker who learns
    // another broker's payment intent ID could confirm it and grant themselves
    // a subscription off someone else's payment.
    if (intent.metadata?.brokerId && intent.metadata.brokerId !== req.user?.id) {
      logger.warn(
        `Broker ${req.user?.id} tried to confirm intent ${validated.paymentIntentId} belonging to ${intent.metadata.brokerId}`
      );
      return res.status(403).json({
        success: false,
        error: {
          code: 'INTENT_OWNER_MISMATCH',
          message: 'This payment does not belong to your account',
        },
      });
    }

    // Read the tier back from the intent metadata, which createPaymentIntent
    // set server-side. Previously this was hardcoded to 'Premium Annual', so a
    // Founder Lifetime purchase was recorded — and refunded — as the wrong plan.
    const tier = intent.metadata?.tier;
    if (!stripeService.isTier(tier)) {
      logger.error(
        `Intent ${validated.paymentIntentId} has no usable tier metadata: ${String(tier)}`
      );
      return res.status(422).json({
        success: false,
        error: {
          code: 'TIER_UNKNOWN',
          message: 'Could not determine which plan this payment was for',
        },
      });
    }

    // Create subscription record in database.
    // TODO: Create a real Stripe customer once a payment completes, and store
    // its ID for future lookups (refunds, account changes, etc). For now,
    // we use a synthetic ID to keep the schema happy.
    const subscription = await supabaseService.createSubscription(
      req.user?.id || '',
      `stripe_cus_${validated.paymentIntentId}`, // Placeholder; refactor when customer creation is added
      validated.paymentIntentId,
      tier
    );

    // Send welcome email
    const user = await supabaseService.getUser(req.user?.id || '');
    if (user?.email) {
      try {
        await emailService.sendBrokerWelcomeEmail(
          user.email,
          user.company_name || 'Broker',
          tier,
          stripeService.TIER_REFUND_DAYS[tier]
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
