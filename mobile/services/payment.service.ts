import { CardFieldInput } from '@stripe/stripe-react-native';
import axios from 'axios';

interface PaymentMethodData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  name: string;
  email: string;
}

interface CreatePaymentIntentResponse {
  clientSecret: string;
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
 * Payment service for handling Stripe payments
 * In production, use the official Stripe React Native SDK for secure tokenization
 */
export const paymentService = {
  /**
   * Create a payment intent on the backend
   * This should be called before charging the card
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'USD'
  ): Promise<CreatePaymentIntentResponse> {
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/intent`,
        {
          amount,
          currency,
        }
      );

      return {
        clientSecret: response.data.clientSecret,
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
   * Process a payment with card details
   * In production, use Stripe's official SDK to tokenize the card first
   * Never send raw card data to your server
   */
  async processPayment(
    paymentData: PaymentMethodData,
    clientSecret: string
  ): Promise<PaymentResult> {
    try {
      // Validate card data
      const validationError = validateCardData(paymentData);
      if (validationError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError,
          },
        };
      }

      // In production, tokenize the card using Stripe's official SDK first
      // This ensures raw card data never touches your server
      // For now, we'll send to backend which should use Stripe's API

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/charge`,
        {
          clientSecret,
          cardData: {
            // In production, use Stripe token instead of raw card
            number: paymentData.cardNumber.replace(/\s/g, ''),
            exp_month: parseInt(paymentData.expiryMonth, 10),
            exp_year: 2000 + parseInt(paymentData.expiryYear, 10),
            cvc: paymentData.cvc,
          },
          metadata: {
            name: paymentData.name,
            email: paymentData.email,
          },
        }
      );

      if (response.data.success) {
        return {
          success: true,
          paymentIntentId: response.data.paymentIntentId,
        };
      } else {
        return {
          success: false,
          error: {
            code: response.data.error?.code || 'PAYMENT_FAILED',
            message: response.data.error?.message || 'Payment processing failed',
          },
        };
      }
    } catch (error: any) {
      console.error('Payment error:', error);

      return {
        success: false,
        error: {
          code: 'PAYMENT_ERROR',
          message: error.response?.data?.message || 'An error occurred while processing your payment',
        },
      };
    }
  },

  /**
   * Confirm a payment with the backend
   * This verifies the payment was successful
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
      return {
        success: false,
        error: {
          code: 'CONFIRMATION_ERROR',
          message: error.response?.data?.message || 'Failed to confirm payment',
        },
      };
    }
  },

  /**
   * Handle a failed payment
   */
  async handlePaymentFailure(
    paymentIntentId: string,
    reason: string
  ): Promise<void> {
    try {
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/failure`,
        {
          paymentIntentId,
          reason,
        }
      );
    } catch (error) {
      console.error('Failed to report payment failure:', error);
    }
  },
};

/**
 * Validate card data format
 */
function validateCardData(data: PaymentMethodData): string | null {
  if (!data.name?.trim()) {
    return 'Cardholder name is required';
  }

  if (!data.email?.trim()) {
    return 'Email is required';
  }

  const cardNumber = data.cardNumber.replace(/\s/g, '');
  if (!cardNumber.match(/^\d{16}$/)) {
    return 'Card number must be 16 digits';
  }

  // Luhn check for card validity
  if (!luhnCheck(cardNumber)) {
    return 'Card number is invalid';
  }

  const expiryMonth = parseInt(data.expiryMonth, 10);
  const expiryYear = parseInt(data.expiryYear, 10);

  if (expiryMonth < 1 || expiryMonth > 12) {
    return 'Expiry month must be between 01 and 12';
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const fullYear = 2000 + expiryYear;

  if (fullYear < currentYear || (fullYear === currentYear && expiryMonth < currentMonth)) {
    return 'Card has expired';
  }

  if (!data.cvc.match(/^\d{3,4}$/)) {
    return 'CVC must be 3 or 4 digits';
  }

  return null;
}

/**
 * Luhn algorithm for card validation
 */
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
