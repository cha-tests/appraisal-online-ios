import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * Tier pricing in cents
 */
const TIER_PRICING = {
  'Founder Lifetime': 49900,
  'Premium Annual': 19900,
  'Basic Annual': 4900,
};

/**
 * Create a payment intent
 */
export async function createPaymentIntent(
  amount: number,
  currency: string = 'USD',
  metadata: any = {}
) {
  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata,
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

/**
 * Process payment with card details
 * In production, tokenize card first using Stripe.js
 */
export async function processPayment(
  clientSecret: string,
  cardData: any,
  metadata: any = {}
) {
  try {
    // Confirm the payment intent
    const intent = await stripe.paymentIntents.confirm(clientSecret, {
      payment_method: {
        type: 'card',
        card: {
          number: cardData.number,
          exp_month: cardData.exp_month,
          exp_year: cardData.exp_year,
          cvc: cardData.cvc,
        },
        billing_details: {
          name: cardData.name,
          email: cardData.email,
        },
      },
      metadata,
    });

    if (intent.status === 'succeeded') {
      return {
        success: true,
        paymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
      };
    }

    if (intent.status === 'requires_action') {
      return {
        success: false,
        requiresAction: true,
        clientSecret: intent.client_secret,
        error: 'Payment requires additional authentication',
      };
    }

    return {
      success: false,
      error: 'Payment failed',
      status: intent.status,
    };
  } catch (error: any) {
    logger.error('Error processing payment:', error);

    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

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
