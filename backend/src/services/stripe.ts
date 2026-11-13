import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-08-16',
});

/**
 * Single broker tier (migration 034) — 'Premium Annual' is the only value.
 * Price is NOT a static lookup any more: it depends on a broker's place in
 * the global signup order and today's date (see supabase.ts's
 * getBrokerSignupPrice, which reads it straight from the database's
 * get_broker_annual_price, the single source of truth — mirrored in
 * mobile/config/brokerTiers.ts's getBrokerAnnualPrice for client-side
 * display only).
 */
export type Tier = 'Premium Annual';

/** 30-day refund window for every broker, no tier variation any more. */
export const REFUND_WINDOW_DAYS = 30;

export const isTier = (value: unknown): value is Tier => value === 'Premium Annual';

/**
 * Create a payment intent.
 *
 * amount is computed by the caller from the broker's real signup_rank (see
 * routes/payments.ts), server-side and never from anything the client
 * sends, so a modified client can't request a lower price than its actual
 * rank qualifies for.
 */
export async function createPaymentIntent(amount: number, metadata: any = {}) {
  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { ...metadata, tier: 'Premium Annual' },
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
 * Verify Stripe webhook signature. `body` must be the exact raw request
 * bytes Stripe signed (a Buffer, from an express.raw() body parser) —
 * never a parsed-then-re-stringified copy, which is a different byte
 * sequence that always fails verification.
 */
export function verifyWebhookSignature(
  body: string | Buffer,
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
