import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
// Stripe constructor auto-selects a compatible API version

/**
 * Tier pricing in cents. This is the single source of truth for what a tier
 * costs — the amount is never accepted from the client, or a caller could ask
 * for a $1 intent against the $499 tier and get a Founder subscription for it.
 */
export const TIER_PRICING = {
  'Founder Lifetime': 49900,
  'Premium Annual': 19900,
  'Basic Annual': 4900,
} as const;

export type Tier = keyof typeof TIER_PRICING;

/** Refund window in days, by tier. Mirrors the published terms. */
export const TIER_REFUND_DAYS: Record<Tier, number> = {
  'Founder Lifetime': 14,
  'Premium Annual': 30,
  'Basic Annual': 30,
};

export const isTier = (value: unknown): value is Tier =>
  typeof value === 'string' && value in TIER_PRICING;

/**
 * Create a payment intent for a tier.
 *
 * The amount is derived from the tier server-side, and the tier is recorded in
 * the intent's metadata so that confirmation can read back which tier was
 * actually paid for without trusting the client.
 */
export async function createPaymentIntent(tier: Tier, metadata: any = {}) {
  try {
    const amount = TIER_PRICING[tier];

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { ...metadata, tier },
    });

    return {
      clientSecret: intent.client_secret,
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
    };
  } catch (error) {
    logger.error('Error creating payment intent:', error);
    throw error;
  }
}

// NOTE: There is deliberately no processPayment() here any more.
//
// The previous implementation accepted a raw card number, expiry and CVC and
// passed them to Stripe from this server. That had two problems: Stripe rejects
// raw card data from accounts not explicitly approved for it, and routing card
// numbers through our own infrastructure pulls the whole backend into PCI-DSS
// scope (SAQ D rather than SAQ A).
//
// Cards are now entered into Stripe's own SDK component on the device and
// confirmed directly against Stripe, so no card data ever reaches this server.
// The backend's only jobs are creating the intent (above) and verifying the
// outcome (below).

/**
 * Retrieve payment intent
 */
export async function getPaymentIntent(intentId: string) {
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId);
    return {
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      clientSecret: intent.client_secret,
      // Set by createPaymentIntent. Trustworthy because it was written
      // server-side, so confirmation can rely on it rather than on the client
      // telling us which tier was purchased.
      metadata: intent.metadata,
    };
  } catch (error) {
    logger.error('Error retrieving payment intent:', error);
    throw error;
  }
}

/**
 * Create a customer in Stripe
 */
export async function createCustomer(
  email: string,
  name: string,
  metadata: any = {}
) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
    };
  } catch (error) {
    logger.error('Error creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Create a subscription
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata: any = {}
) {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
    });

    return {
      id: subscription.id,
      customerId: subscription.customer,
      priceId: subscription.items.data[0].price.id,
      status: subscription.status,
    };
  } catch (error) {
    logger.error('Error creating subscription:', error);
    throw error;
  }
}

/**
 * Process a refund
 */
export async function processRefund(
  paymentIntentId: string,
  amount?: number
) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
    });

    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
    };
  } catch (error) {
    logger.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): any {
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
    return event;
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    throw error;
  }
}
