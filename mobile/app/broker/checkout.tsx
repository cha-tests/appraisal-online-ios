import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useAuthStore } from '../../stores/auth.store';
import { subscriptionService } from '../../services/subscription.service';
import { paymentService } from '../../services/payment.service';

// lib/stripe is platform-split: the real SDK on native, inert stubs on web.
// Importing through it keeps the native-only module out of the web bundle.
import { CardField, useConfirmPayment, isStripeAvailable } from '../../lib/stripe';

const TIER_PRICING = {
  'Founder Lifetime': { price: 49900, currency: 'USD' },
  'Premium Annual': { price: 19900, currency: 'USD' },
  'Basic Annual': { price: 4900, currency: 'USD' },
};

export default function Checkout() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const selectedTier = useSubscriptionStore((state) => state.selectedTier);
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  // Resolved at bundle time by the platform-split lib/stripe module.
  const stripeAvailable = isStripeAvailable;

  if (!selectedTier) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>No tier selected</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!stripeAvailable) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Card variant="outlined" style={styles.noticeCard}>
            <Text style={styles.noticeIcon}>📱</Text>
            <Text style={styles.noticeTitle}>Web Checkout Not Available</Text>
            <Text style={styles.noticeText}>
              Stripe checkout only works on physical devices running Expo Go.
              Open this app on your iPhone to complete your purchase.
            </Text>
          </Card>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaWrapper>
    );
  }

  const pricing = TIER_PRICING[selectedTier];
  const priceInDollars = pricing.price / 100;

  const createPaymentIntent = useCallback(async () => {
    try {
      setError('');
      setLoading(true);

      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      // Step 1: Create payment intent on the backend
      const intentResponse = await paymentService.createPaymentIntent(
        pricing.price,
        selectedTier
      );

      if (!intentResponse.clientSecret) {
        setError('Failed to create payment intent');
        return;
      }

      setClientSecret(intentResponse.clientSecret);
      setPaymentIntentId(intentResponse.paymentIntentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment');
      console.error('Payment intent error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, pricing.price, selectedTier]);

  // Called unconditionally: the web shim provides a hook-shaped no-op, so this
  // obeys the rules of hooks on every platform. The previous conditional call
  // would have broken hook ordering.
  const { confirmPayment: stripeConfirmPayment } = useConfirmPayment();

  const confirmPayment = useCallback(async () => {
    try {
      setError('');
      setProcessingPayment(true);

      if (!paymentIntentId || !user?.id || !clientSecret) {
        setError('Payment setup incomplete');
        return;
      }

      // Step 1: Confirm the card with Stripe using the native SDK
      // This handles 3D Secure and other authentication flows
      if (stripeConfirmPayment) {
        const { paymentIntent, error: confirmError } = await stripeConfirmPayment(clientSecret, {
          type: 'Card',
        });

        if (confirmError) {
          setError(confirmError.message || 'Card confirmation failed');
          return;
        }

        if (!paymentIntent) {
          setError('Payment did not complete');
          return;
        }

        // The card was confirmed; now tell the backend to create the subscription
        if (paymentIntent.status !== 'Succeeded') {
          setError(`Payment failed: ${paymentIntent.status}`);
          return;
        }
      }

      // Step 2: Confirm the payment with the backend
      // This creates the subscription record in the database
      const confirmResult = await paymentService.confirmPayment(paymentIntentId);

      if (!confirmResult.success) {
        setError(confirmResult.error?.message || 'Payment confirmation failed');
        return;
      }

      // Step 3: Create subscription in the database
      const subscriptionResult = await subscriptionService.createSubscription(
        user.id,
        paymentIntentId,
        paymentIntentId,
        selectedTier,
        selectedTier.includes('Lifetime') ? 'lifetime' : 'annual'
      );

      if (subscriptionResult.success) {
        // Success - go to welcome screen
        router.push('/broker/welcome');
      } else {
        setError(subscriptionResult.error?.message || 'Failed to create subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Payment confirmation error:', err);
    } finally {
      setProcessingPayment(false);
    }
  }, [paymentIntentId, clientSecret, user?.id, stripeConfirmPayment]);

  // Step 1: Create intent when component mounts
  useEffect(() => {
    createPaymentIntent();
  }, [createPaymentIntent]);

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Purchase</Text>
        <Text style={styles.subtitle}>Secure payment powered by Stripe</Text>
      </View>

      {/* Order Summary */}
      <Card variant="default" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{selectedTier}</Text>
          <Text style={styles.summaryPrice}>${priceInDollars.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total</Text>
          <Text style={styles.summaryTotal}>${priceInDollars.toFixed(2)}</Text>
        </View>
      </Card>

      {/* Payment Status */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Setting up secure payment...</Text>
        </View>
      ) : clientSecret && paymentIntentId ? (
        <>
          {/* Instructions for Stripe */}
          <Card variant="outlined" style={styles.instructionCard}>
            <Text style={styles.instructionIcon}>💳</Text>
            <Text style={styles.instructionTitle}>Enter Your Card Details</Text>
            <Text style={styles.instructionText}>
              Your card information is collected securely by Stripe and never touches our servers.
            </Text>
          </Card>

          {/* Card Entry Field - Stripe SDK handles this securely */}
          {CardField ? (
            <View style={styles.cardFieldContainer}>
              <CardField
                postalCodeEnabled={false}
                placeholder={{
                  number: '4242 4242 4242 4242',
                }}
                onCardChange={(cardDetails) => {
                  // Update state if needed for validation
                  if (cardDetails.expiryMonth) {
                    // Card details are available
                  }
                }}
                style={styles.cardField}
              />
            </View>
          ) : (
            <Card variant="outlined" style={styles.errorCard}>
              <Text style={styles.errorText}>
                Stripe SDK not initialized. Please restart the app or update Stripe configuration.
              </Text>
            </Card>
          )}

          {/* Security Notice */}
          <Card variant="outlined" style={styles.securityCard}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>
              Your payment is secure and encrypted. Stripe is trusted by millions worldwide.
            </Text>
          </Card>

          {/* Terms */}
          <Card variant="default" style={styles.termsCard}>
            <Text style={styles.termsText}>
              By clicking "Complete Purchase," you agree to our Terms of Service and authorize the
              charge to your card. Refunds are available within {selectedTier === 'Founder Lifetime'
                ? '14'
                : '30'}{' '}
              days.
            </Text>
          </Card>
        </>
      ) : null}

      {/* Error Message */}
      {error && <Text style={styles.errorMessage}>{error}</Text>}

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title={processingPayment ? 'Processing...' : 'Complete Purchase'}
          size="large"
          onPress={confirmPayment}
          loading={processingPayment}
          disabled={loading || processingPayment || !clientSecret}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Cancel"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          disabled={processingPayment}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  summaryPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  summaryTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  noticeCard: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FBBF24',
  },
  noticeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionCard: {
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  instructionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  securityCard: {
    marginBottom: 24,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBFBBA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  securityText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    flex: 1,
  },
  termsCard: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
  },
  termsText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  errorMessage: {
    backgroundColor: '#FEE2E2',
    borderLeftColor: '#DC2626',
    borderLeftWidth: 4,
    color: '#991B1B',
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    borderRadius: 4,
  },
  cardFieldContainer: {
    marginBottom: 24,
    height: 50,
    borderRadius: 8,
  },
  cardField: {
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    borderColor: '#E5E7EB',
  },
  errorCard: {
    marginBottom: 24,
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
});
