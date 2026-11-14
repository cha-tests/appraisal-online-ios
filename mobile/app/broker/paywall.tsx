import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useAuthStore } from '../../stores/auth.store';
import {
  BROKER_TIER_FEATURES,
  BROKER_REFUND_WINDOW_DAYS,
  formatPriceCents,
  getBrokerAnnualPrice,
} from '../../config/brokerTiers';
import { theme } from '../../theme';

export default function Paywall() {
  const router = useRouter();
  const selectedTier = useSubscriptionStore((state) => state.selectedTier);
  const signupRank = useSubscriptionStore((state) => state.signupRank);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');

  if (!selectedTier || !signupRank) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>No tier selected</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  // Display-only estimate, computed from this broker's own signup rank —
  // the actual charge is always computed server-side at checkout time (see
  // checkout.tsx), so this can only ever be a preview of what to expect.
  const priceCents = getBrokerAnnualPrice(signupRank);
  const features = BROKER_TIER_FEATURES[selectedTier];

  const handleProceedToCheckout = () => {
    if (!agreedToTerms) {
      alert('Please agree to the terms to continue');
      return;
    }
    setError('');
    router.push('/broker/checkout');
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Review Your Plan</Text>
        <Text style={styles.subtitle}>
          Complete your membership and start receiving leads
        </Text>
      </View>

      {/* Tier Card */}
      <Card variant="elevated" style={styles.tierCard}>
        <View style={styles.tierCardHeader}>
          <Text style={styles.tierName}>{selectedTier}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{formatPriceCents(priceCents)}</Text>
            <Text style={styles.billingCycle}>per year</Text>
          </View>
        </View>

        {/* Quick Features */}
        <View style={styles.quickFeatures}>
          <View style={styles.quickFeature}>
            <Text style={styles.featureIcon}>📍</Text>
            <Text style={styles.featureText}>{features.cities} cities</Text>
          </View>
          <View style={styles.quickFeature}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureText}>{features.leads} leads</Text>
          </View>
          <View style={styles.quickFeature}>
            <Text style={styles.featureIcon}>💬</Text>
            <Text style={styles.featureText}>{features.channels}</Text>
          </View>
        </View>
      </Card>

      {/* What's Included */}
      <Text style={styles.sectionTitle}>What's Included</Text>
      {features.includes.map((feature, index) => (
        <View key={index} style={styles.inclusionItem}>
          <Text style={styles.inclusionCheck}>✓</Text>
          <Text style={styles.inclusionText}>{feature}</Text>
        </View>
      ))}

      {/* Protection Banner */}
      <Card variant="outlined" style={styles.protectionCard}>
        <Text style={styles.protectionTitle}>🛡️ Protected by Money-Back Guarantee</Text>
        <Text style={styles.protectionText}>
          Not satisfied? Get a full refund within {BROKER_REFUND_WINDOW_DAYS} days of your purchase. No questions asked.
        </Text>
      </Card>

      {/* Key Benefits */}
      <Text style={styles.sectionTitle}>How It Works</Text>

      <Card variant="default" style={styles.benefitCard}>
        <Text style={styles.benefitNumber}>1</Text>
        <View style={styles.benefitContent}>
          <Text style={styles.benefitTitle}>Leads Delivered</Text>
          <Text style={styles.benefitDescription}>Get instant notifications when consumers opt in</Text>
        </View>
      </Card>

      <Card variant="default" style={styles.benefitCard}>
        <Text style={styles.benefitNumber}>2</Text>
        <View style={styles.benefitContent}>
          <Text style={styles.benefitTitle}>Complete Lead Data</Text>
          <Text style={styles.benefitDescription}>
            Each lead includes property valuation, consumer contact info, and valuation details
          </Text>
        </View>
      </Card>

      <Card variant="default" style={styles.benefitCard}>
        <Text style={styles.benefitNumber}>3</Text>
        <View style={styles.benefitContent}>
          <Text style={styles.benefitTitle}>Contact & Follow Up</Text>
          <Text style={styles.benefitDescription}>
            Reach out via email, phone, or SMS and convert leads into clients
          </Text>
        </View>
      </Card>

      {/* Terms Agreement */}
      <View style={styles.termsSection}>
        <TouchableOpacity
          style={styles.termsCheckbox}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <View
            style={[
              styles.checkboxBox,
              agreedToTerms && styles.checkboxBoxChecked,
            ]}
          >
            {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.termsText}>
            <Text style={styles.termsLabel}>
              I agree to the{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and understand the
              {' '}<Text style={styles.termsLink}>{BROKER_REFUND_WINDOW_DAYS} days refund policy</Text>
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* FAQ */}
      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>Questions?</Text>
        <Card variant="default" style={styles.faqItem}>
          <Text style={styles.faqQ}>How do I cancel?</Text>
          <Text style={styles.faqA}>
            Contact us anytime. You can request a refund within {BROKER_REFUND_WINDOW_DAYS} days or cancel before your next renewal.
          </Text>
        </Card>
      </View>

      {!!error && <Text style={styles.errorMessage}>{error}</Text>}

      {/* CTA Buttons */}
      <View style={styles.footer}>
        <Button
          title="Proceed to Payment"
          size="large"
          onPress={handleProceedToCheckout}
          disabled={!agreedToTerms}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Back"
          variant="outline"
          size="large"
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const TouchableOpacity = ({ style, onPress, children }: any) => {
  const { TouchableOpacity: RNTouchableOpacity } = require('react-native');
  return (
    <RNTouchableOpacity style={style} onPress={onPress}>
      {children}
    </RNTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: 16,
    color: theme.color.danger,
    marginBottom: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.color.textMuted,
    lineHeight: 24,
  },
  tierCard: {
    marginBottom: 24,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.color.success,
  },
  billingCycle: {
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: 2,
  },
  quickFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  quickFeature: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    color: theme.color.textMuted,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
    marginTop: 20,
  },
  inclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  inclusionCheck: {
    fontSize: 18,
    color: theme.color.success,
    marginRight: 10,
    fontWeight: '700',
  },
  inclusionText: {
    fontSize: 14,
    color: theme.color.textMuted,
  },
  protectionCard: {
    backgroundColor: theme.color.successWash,
    borderColor: '#BBDFD4',
    marginBottom: 24,
    marginTop: 16,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.successInk,
    marginBottom: 6,
  },
  protectionText: {
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
  },
  benefitCard: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingVertical: 12,
  },
  benefitNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.accent,
    marginRight: 16,
    minWidth: 32,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  termsSection: {
    marginVertical: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border,
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.color.track,
    marginRight: 12,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  checkmark: {
    color: theme.color.onAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
  },
  termsLabel: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  termsLink: {
    color: theme.color.accent,
    fontWeight: '600',
  },
  faqSection: {
    marginBottom: 24,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
  },
  faqItem: {
    paddingVertical: 12,
  },
  faqQ: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  faqA: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  errorMessage: {
    color: theme.color.danger,
    fontSize: 14,
    marginBottom: 16,
  },
  footer: {
    marginBottom: 32,
  },
});
