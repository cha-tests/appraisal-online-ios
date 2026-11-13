import { Router, Request, Response, raw, json } from 'express';
import * as stripeService from '../services/stripe.js';
import * as supabaseService from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 * Configure webhook endpoint in Stripe dashboard
 *
 * raw({ type: 'application/json' }) rather than the app-wide json()
 * parser (this router is mounted before that in index.ts, specifically
 * so it can make this choice per-route): stripe.webhooks.constructEvent
 * needs the exact raw request bytes to recompute the signature against,
 * not a parsed-then-re-stringified copy.
 */
router.post('/stripe', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    // req.body is the raw Buffer here (see the raw() middleware above),
    // which is what verifyWebhookSignature/constructEvent actually wants.
    const event = stripeService.verifyWebhookSignature(req.body, sig);

    logger.info(`Webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        handlePaymentIntentFailed(event.data.object);
        break;

      case 'charge.refunded':
        handleChargeRefunded(event.data.object);
        break;

      case 'customer.subscription.deleted':
        handleSubscriptionDeleted(event.data.object);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    // Return early so Stripe doesn't retry
    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook signature verification failed:', error.message);
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Webhook signature verification failed',
      },
    });
  }
});

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(intent: any) {
  try {
    logger.info(`Payment succeeded: ${intent.id}`);

    // Payment already confirmed in API call
    // This is a confirmation/backup mechanism
  } catch (error) {
    logger.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(intent: any) {
  try {
    logger.error(`Payment failed: ${intent.id}`, {
      lastError: intent.last_payment_error,
    });

    // Could send failure notification to broker
  } catch (error) {
    logger.error('Error handling payment failed:', error);
  }
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(charge: any) {
  try {
    logger.info(`Charge refunded: ${charge.id}`);

    // Update refund log in database
    // Mark subscription for potential reactivation
  } catch (error) {
    logger.error('Error handling charge refunded:', error);
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: any) {
  try {
    logger.info(`Subscription deleted: ${subscription.id}`);

    // Could notify broker of cancellation
    // Mark subscription as cancelled in database
  } catch (error) {
    logger.error('Error handling subscription deleted:', error);
  }
}

/**
 * POST /webhooks/postmark
 * Handle Postmark email bounce/complaint events
 *
 * Parses its own JSON body explicitly, same reasoning as the raw() call
 * above: this router is mounted before the app-wide json() parser (see
 * index.ts), so each route here is responsible for its own body parsing
 * rather than assuming a global middleware ran first.
 */
router.post('/postmark', json(), async (req: Request, res: Response) => {
  try {
    const event = req.body;

    logger.info(`Postmark event: ${event.Type}`);

    switch (event.Type) {
      case 'Bounce':
        handleEmailBounce(event);
        break;

      case 'Complaint':
        handleEmailComplaint(event);
        break;

      case 'Delivery':
        handleEmailDelivery(event);
        break;

      default:
        logger.info(`Unhandled Postmark event: ${event.Type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error handling Postmark webhook:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process webhook',
      },
    });
  }
});

/**
 * Handle email bounce
 */
function handleEmailBounce(event: any) {
  try {
    const { Bounces } = event;

    Bounces.forEach((bounce: any) => {
      logger.warn(`Email bounced: ${bounce.Email}`, {
        type: bounce.Type,
        description: bounce.Description,
      });

      // Could mark email as invalid in database
      // Disable notifications for this email
    });
  } catch (error) {
    logger.error('Error handling bounce:', error);
  }
}

/**
 * Handle email complaint
 */
function handleEmailComplaint(event: any) {
  try {
    const { Complains } = event;

    Complains.forEach((complaint: any) => {
      logger.warn(`Email complaint: ${complaint.Email}`, {
        description: complaint.Description,
      });

      // Could mark email as having complaints
      // Disable email notifications for this user
    });
  } catch (error) {
    logger.error('Error handling complaint:', error);
  }
}

/**
 * Handle email delivery
 */
function handleEmailDelivery(event: any) {
  try {
    logger.info(`Email delivered: ${event.Recipient}`);

    // Could update delivery log in database
  } catch (error) {
    logger.error('Error handling delivery:', error);
  }
}

export default router;
