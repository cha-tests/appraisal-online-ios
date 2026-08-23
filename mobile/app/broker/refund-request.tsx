import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { useAuthStore } from '../../stores/auth.store';
import { subscriptionService } from '../../services/subscription.service';
import { Subscription } from '../../types';

export default function RefundRequest() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    daysSincePurchase?: number;
    refundWindow?: number;
    expiresAt?: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Get subscription
        const { subscription: sub } = await subscriptionService.getBrokerSubscription(user.id);
        setSubscription(sub);

        // Check refund eligibility
        const elig = await subscriptionService.checkRefundEligibility(user.id);
        setEligibility(elig);
      } catch (err) {
        console.error('Error loading refund data:', err);
        Alert.alert('Error', 'Failed to load refund information');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!reason.trim()) {
      newErrors.reason = 'Please provide a reason for your refund request';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitRefund = async () => {
    try {
      if (!validateForm() || !user?.id) return;

      setSubmitting(true);

      const result = await subscriptionService.requestRefund(user.id, reason);

      if (result.success) {
        Alert.alert('Success', 'Your refund request has been submitted. We will process it within 10 business days.');
        router.back();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to submit refund request');
      }
    } catch (err) {
      console.error('Error submitting refund:', err);
      Alert.alert('Error', 'An error occurred while submitting your request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!subscription || !eligibility) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>Unable to load refund information</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!eligibility.eligible) {
    return (
      <SafeAreaWrapper scrollable>
        <View style={styles.header}>
          <Text style={styles.title}>Refund Not Available</Text>
        </View>

        <Card variant="outlined" style={styles.ineligibleCard}>
          <Text style={styles.ineligibleIcon}>⏰</Text>
          <Text style={styles.ineligibleTitle}>Refund Window Expired</Text>
          <Text style={styles.ineligibleText}>
            Your refund window of {eligibility.refundWindow} days has expired. Refunds are only available within {eligibility.refundWindow} days of your purchase date.
          </Text>
        </Card>

        <Card variant="default" style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            If you have questions about your membership, please contact our support team at support@appraisalonline.com
          </Text>
        </Card>

        <Button
          title="Go Back"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          style={{ marginTop: 32 }}
        />
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Request a Refund</Text>
        <Text style={styles.subtitle}>
          You have until {eligibility.expiresAt} to request a refund
        </Text>
      </View>

      {/* Refund Details Card */}
      <Card variant="elevated" style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Membership Tier</Text>
          <Text style={styles.detailValue}>{subscription.tier}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Refund Amount</Text>
          <Text style={styles.detailValue}>${(subscription.price / 100).toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Days Remaining</Text>
          <Text style={[styles.detailValue, { color: '#EF4444' }]}>
            {eligibility.daysSincePurchase ? eligibility.refundWindow! - eligibility.daysSincePurchase : eligibility.refundWindow} days
          </Text>
        </View>
      </Card>

      {/* Why Are You Requesting a Refund? */}
      <Text style={styles.sectionTitle}>Why are you requesting a refund?</Text>
      <Text style={styles.sectionHelper}>
        Your feedback helps us improve. Please share what could have been better.
      </Text>

      <TextInput
        label="Reason for Refund"
        placeholder="Tell us why you'd like a refund..."
        multiline={true}
        numberOfLines={5}
        value={reason}
        onChangeText={(val) => setReason(val)}
        error={errors.reason}
      />

      {/* Important Information */}
      <Card variant="outlined" style={styles.importantCard}>
        <Text style={styles.importantTitle}>⚠️ Important</Text>
        <Text style={styles.importantText}>
          Once you request a refund, your access to leads will be suspended until we process your request. The refund will be issued to your original payment method within 10 business days.
        </Text>
      </Card>

      {/* Alternatives */}
      <Card variant="default" style={styles.alternativesCard}>
        <Text style={styles.alternativesTitle}>Before You Go</Text>
        <Text style={styles.alternativesSubtitle}>Would any of these help?</Text>
        <View style={styles.alternativeItem}>
          <Text style={styles.alternativeBullet}>📞</Text>
          <Text style={styles.alternativeText}>
            Adjust your notification settings for fewer, more targeted leads
          </Text>
        </View>
        <View style={styles.alternativeItem}>
          <Text style={styles.alternativeBullet}>🏙️</Text>
          <Text style={styles.alternativeText}>
            Change your selected cities to focus on your strongest markets
          </Text>
        </View>
        <View style={styles.alternativeItem}>
          <Text style={styles.alternativeBullet}>💬</Text>
          <Text style={styles.alternativeText}>
            Contact our support team to discuss your needs
          </Text>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title="Request Refund"
          variant="danger"
          size="large"
          onPress={handleSubmitRefund}
          loading={submitting}
          disabled={submitting}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Cancel"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          disabled={submitting}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailsCard: {
    marginBottom: 24,
  },
  detailRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionHelper: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  importantCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    marginBottom: 20,
    marginTop: 20,
  },
  importantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  importantText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  alternativesCard: {
    marginBottom: 24,
  },
  alternativesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  alternativesSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alternativeBullet: {
    fontSize: 18,
    marginRight: 10,
    marginTop: -2,
  },
  alternativeText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
  },
  ineligibleCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    alignItems: 'center',
    marginBottom: 24,
  },
  ineligibleIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  ineligibleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  ineligibleText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
    textAlign: 'center',
  },
  helpCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
});
