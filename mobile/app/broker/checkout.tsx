import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useAuthStore } from '../../stores/auth.store';
import { subscriptionService } from '../../services/subscription.service';
import { paymentService } from '../../services/payment.service';

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
  const [error, setError] = useState('');

  const [cardData, setCardData] = useState({
    name: '',
    email: user?.email || '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
  });

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

  const pricing = TIER_PRICING[selectedTier];
  const priceInDollars = pricing.price / 100;

  const validateForm = (): boolean => {
    if (!cardData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!cardData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!cardData.cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
      setError('Card number must be 16 digits');
      return false;
    }
    if (!cardData.expiryMonth || !cardData.expiryYear) {
      setError('Expiry date is required');
      return false;
    }
    if (!cardData.cvc.match(/^\d{3,4}$/)) {
      setError('CVC must be 3-4 digits');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    try {
      setError('');

      if (!validateForm()) {
        return;
      }

      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      setLoading(true);

      // Step 1: Create payment intent
      const intentResponse = await paymentService.createPaymentIntent(
        pricing.price,
        'USD'
      );

      // Step 2: Process payment with card details
      const paymentResult = await paymentService.processPayment(
        cardData,
        intentResponse.clientSecret
      );

      if (!paymentResult.success) {
        setError(paymentResult.error?.message || 'Payment failed');
        // Report failure to backend
        if (paymentResult.paymentIntentId) {
          await paymentService.handlePaymentFailure(
            paymentResult.paymentIntentId,
            paymentResult.error?.message || 'Unknown error'
          );
        }
        return;
      }

      // Step 3: Confirm payment
      const confirmResult = await paymentService.confirmPayment(
        paymentResult.paymentIntentId || ''
      );

      if (!confirmResult.success) {
        setError(confirmResult.error?.message || 'Payment confirmation failed');
        return;
      }

      // Step 4: Create subscription in database
      const subscriptionResult = await subscriptionService.createSubscription(
        user.id,
        `cus_${paymentResult.paymentIntentId}`, // Stripe customer ID
        paymentResult.paymentIntentId || '', // Stripe subscription ID
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
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Purchase</Text>
        <Text style={styles.subtitle}>
          Secure payment powered by Stripe
        </Text>
      </View>

      {/* Order Summary */}
      <Card variant="default" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{selectedTier}</Text>
          <Text style={styles.summaryPrice}>${priceInDollars.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel} style={{ fontWeight: '700' }}>Total</Text>
          <Text style={styles.summaryTotal}>${priceInDollars.toFixed(2)}</Text>
        </View>
      </Card>

      {/* Cardholder Info */}
      <Text style={styles.sectionTitle}>Cardholder Information</Text>

      <TextInput
        label="Full Name"
        placeholder="John Doe"
        value={cardData.name}
        onChangeText={(val) => setCardData((prev) => ({ ...prev, name: val }))}
      />

      <TextInput
        label="Email"
        placeholder="john@example.com"
        keyboardType="email-address"
        value={cardData.email}
        onChangeText={(val) => setCardData((prev) => ({ ...prev, email: val }))}
      />

      {/* Card Details */}
      <Text style={styles.sectionTitle}>Card Details</Text>

      <TextInput
        label="Card Number"
        placeholder="1234 5678 9012 3456"
        keyboardType="numeric"
        value={cardData.cardNumber}
        onChangeText={(val) => {
          // Format with spaces
          const cleaned = val.replace(/\s/g, '').slice(0, 16);
          const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
          setCardData((prev) => ({ ...prev, cardNumber: formatted }));
        }}
        maxLength={19}
      />

      <View style={styles.cardDetailsRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <TextInput
            label="Expiry (MM/YY)"
            placeholder="MM/YY"
            keyboardType="numeric"
            value={
              cardData.expiryMonth && cardData.expiryYear
                ? `${cardData.expiryMonth}/${cardData.expiryYear}`
                : ''
            }
            onChangeText={(val) => {
              const cleaned = val.replace(/\D/g, '').slice(0, 4);
              if (cleaned.length >= 2) {
                setCardData((prev) => ({
                  ...prev,
                  expiryMonth: cleaned.slice(0, 2),
                  expiryYear: cleaned.slice(2, 4),
                }));
              } else {
                setCardData((prev) => ({
                  ...prev,
                  expiryMonth: cleaned,
                  expiryYear: '',
                }));
              }
            }}
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <TextInput
            label="CVC"
            placeholder="123"
            keyboardType="numeric"
            value={cardData.cvc}
            onChangeText={(val) => setCardData((prev) => ({ ...prev, cvc: val.slice(0, 4) }))}
            maxLength={4}
          />
        </View>
      </View>

      {/* Security Notice */}
      <Card variant="outlined" style={styles.securityCard}>
        <Text style={styles.securityIcon}>🔒</Text>
        <Text style={styles.securityText}>
          Your payment is secure and encrypted. We never store your full card details.
        </Text>
      </Card>

      {/* Error Message */}
      {error && <Text style={styles.errorMessage}>{error}</Text>}

      {/* Terms */}
      <Card variant="default" style={styles.termsCard}>
        <Text style={styles.termsText}>
          By clicking "Complete Purchase," you agree to our Terms of Service and authorize the charge to your card.
        </Text>
      </Card>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title={loading ? 'Processing...' : `Pay $${priceInDollars.toFixed(2)}`}
          size="large"
          onPress={handlePayment}
          loading={loading}
          disabled={loading}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Back"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          disabled={loading}
        />
      </View>

      {/* Test Card Notice */}
      <View style={styles.testModeNotice}>
        <Text style={styles.testModeText}>
          TEST MODE: Use card 4242 4242 4242 4242, any future date, and any 3-digit CVC
        </Text>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
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
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryPrice: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  cardDetailsRow: {
    flexDirection: 'row',
  },
  securityCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBDFD4',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  securityIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#065F46',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  termsCard: {
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  termsText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  footer: {
    marginBottom: 24,
  },
  testModeNotice: {
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginBottom: 32,
  },
  testModeText: {
    fontSize: 12,
    color: '#78350F',
  },
});
