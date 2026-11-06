import axios from 'axios';

interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

interface PaymentResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  paymentIntentId?: string;
}

/**
 * Payment service for handling Stripe payments via the official Stripe SDK
 *
 * This service:
 * 1. Creates a PaymentIntent on the backend (returns clientSecret)
 * 2. Lets Stripe's mobile SDK handle card entry and confirmation
 * 3. Confirms the payment result back on the backend
 *
 * Raw card details never pass through this app or the backend — they go
 * directly from the device to Stripe's servers via their official SDK.
 */
export const paymentService = {
  /**
   * Create a payment intent on the backend.
   *
   * The backend derives the amount server-side from the broker's own
   * signup_rank (migration 034's intro-pricing ladder) — never from
   * anything this client sends, so a modified client can't request a
   * lower price than its actual rank qualifies for.
   */
  async createPaymentIntent(): Promise<CreatePaymentIntentResponse> {
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/intent`,
        {
          tier: 'Premium Annual',
        }
      );

      if (!response.data.success) {
        throw new Error('Failed to create payment intent');
      }

      return {
        clientSecret: response.data.clientSecret,
        paymentIntentId: response.data.paymentIntentId,
        amount: response.data.amount,
        currency: response.data.currency,
      };
    } catch (error) {
      throw {
        code: 'INTENT_FAILED',
        message: 'Failed to create payment intent. Please try again.',
      };
    }
  },

  /**
   * Confirm a payment with the backend
   *
   * At this point, the Stripe SDK on the device has already:
   * 1. Collected the card details from the user
   * 2. Confirmed the card against Stripe
   * 3. The server has verified the payment succeeded
   *
   * This call creates the subscription record in the database.
   */
  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/confirm`,
        {
          paymentIntentId,
        }
      );

      if (response.data.success) {
        return {
          success: true,
          paymentIntentId,
        };
      } else {
        return {
          success: false,
          error: {
            code: response.data.error?.code || 'CONFIRMATION_FAILED',
            message: response.data.error?.message || 'Payment confirmation failed',
          },
        };
      }
    } catch (error: any) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        error: {
          code: 'CONFIRMATION_ERROR',
          message: error.response?.data?.message || 'Failed to confirm payment',
        },
      };
    }
  },
};
