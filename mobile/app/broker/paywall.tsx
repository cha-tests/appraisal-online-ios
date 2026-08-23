import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useSubscriptionStore } from '../../stores/subscription.store';

const TIER_PRICING = {
  'Founder Lifetime': { price: 49900, currency: 'USD', billingCycle: 'one-time' },
  'Premium Annual': { price: 19900, currency: 'USD', billingCycle: 'yearly' },
  'Basic Annual': { price: 4900, currency: 'USD', billingCycle: 'yearly' },
};

const TIER_FEATURES = {
  'Founder Lifetime': {
    cities: 25,
    leads: 'Real-time',
    channels: 'Email, Push, SMS',
    refund: '14 days',
    includes: ['Verified Founder badge', 'Top placement on Find a Pro page', 'Monthly market intelligence', 'Lifetime access'],
  },
  'Premium Annual': {
    cities: 10,
    leads: 'Real-time',
    channels: 'Email, Push',
    refund: '30 days',
    includes: ['Enhanced profile', 'Photo & bio', 'Quarterly market reports', 'Annual renewal'],
  },
  'Basic Annual': {
    cities: 1,
    leads: 'Weekly digest',
    channels: 'Email',
    refund: '30 days',
    includes: ['Standard profile', 'Weekly Monday digest', 'Annual renewal'],
  },
};

export default function Paywall() {
  const router = useRouter();
  const selectedTier = useSubscriptionStore((state) => state.selectedTier);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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
  const features = TIER_FEATURES[selectedTier];
  const priceInDollars = pricing.price / 100;

  const handleProceedToCheckout = () => {
    if (!agreedToTerms) {
      alert('Please agree to the terms to continue');
      return;
    }
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
            <Text style={styles.price}>${priceInDollars.toFixed(2)}</Text>
            <Text style={styles.billingCycle}>{pricing.billingCycle}</Text>
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
          Not satisfied? Get a full refund within {features.refund} of your purchase. No questions asked.
        </Text>
      </Card>

      {/* Key Benefits */}
      <Text style={styles.sectionTitle}>How It Works</Text>

      <Card variant="default" style={styles.benefitCard}>
        <Text style={styles.benefitNumber}>1</Text>
        <View style={styles.benefitContent}>
          <Text style={styles.benefitTitle}>Leads Delivered</Text>
          <Text style={styles.benefitDescription}>
            {selectedTier.includes('Founder') || selectedTier.includes('Premium')
              ? 'Get instant notifications when consumers opt in'
              : 'Receive leads every Monday morning'}
          </Text>
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
              {' '}<Text style={styles.termsLink}>{features.refund} refund policy</Text>
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
            Contact us anytime. {selectedTier.includes('Founder') ? 'Founder members can request refunds within 14 days.' : 'Annual members can request refunds within 30 days or cancel before next renewal.'}
          </Text>
        </Card>
      </View>

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
    fontSize: 16,
    color: '#6B7280',
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
    color: '#1F2937',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
  },
  billingCycle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  quickFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
    color: '#6B7280',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
    color: '#10B981',
    marginRight: 10,
    fontWeight: '700',
  },
  inclusionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  protectionCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBDFD4',
    marginBottom: 24,
    marginTop: 16,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
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
    color: '#2563EB',
    marginRight: 16,
    minWidth: 32,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  termsSection: {
    marginVertical: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
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
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
  },
  termsLabel: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '600',
  },
  faqSection: {
    marginBottom: 24,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  faqItem: {
    paddingVertical: 12,
  },
  faqQ: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  faqA: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
});
