import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useAuthStore } from '../../stores/auth.store';
import { subscriptionService } from '../../services/subscription.service';

const TIER_INFO = {
  'Founder Lifetime': { refundWindow: '14 days', billingCycle: 'One-time payment' },
  'Premium Annual': { refundWindow: '30 days', billingCycle: 'Annual renewal' },
  'Basic Annual': { refundWindow: '30 days', billingCycle: 'Annual renewal' },
};

export default function Welcome() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const selectedTier = useSubscriptionStore((state) => state.selectedTier);
  const [refundInfo, setRefundInfo] = useState<{
    daysRemaining: number;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    const fetchRefundInfo = async () => {
      if (!user?.id) return;

      try {
        const eligibility = await subscriptionService.checkRefundEligibility(user.id);
        if (eligibility.eligible) {
          setRefundInfo({
            daysRemaining: eligibility.refundWindow || 0,
            expiresAt: new Date(
              Date.now() + (eligibility.refundWindow || 0) * 24 * 60 * 60 * 1000
            ).toLocaleDateString(),
          });
        }
      } catch (err) {
        console.error('Error fetching refund info:', err);
      }
    };

    fetchRefundInfo();
  }, [user?.id]);

  const tier = selectedTier || 'Premium Annual';
  const tierInfo = TIER_INFO[tier as keyof typeof TIER_INFO];

  return (
    <SafeAreaWrapper scrollable>
      {/* Success Header */}
      <View style={styles.celebrationArea}>
        <Text style={styles.celebration}>🎉</Text>
        <Text style={styles.successTitle}>Welcome to Appraisal Online!</Text>
        <Text style={styles.successMessage}>
          Your membership is now active
        </Text>
      </View>

      {/* Membership Confirmation */}
      <Card variant="elevated" style={styles.membershipCard}>
        <Text style={styles.membershipTier}>{tier}</Text>
        <Text style={styles.membershipBilling}>{tierInfo.billingCycle}</Text>
        <View style={styles.membershipDivider} />
        <View style={styles.membershipDate}>
          <Text style={styles.membershipDateLabel}>Activated</Text>
          <Text style={styles.membershipDateValue}>
            {new Date().toLocaleDateString()}
          </Text>
        </View>
      </Card>

      {/* Refund Guarantee */}
      {refundInfo && (
        <Card variant="outlined" style={styles.refundCard}>
          <Text style={styles.refundTitle}>💰 Money-Back Guarantee</Text>
          <Text style={styles.refundText}>
            Not satisfied? You have <Text style={styles.bold}>{refundInfo.daysRemaining} days</Text> to request a full refund (expires {refundInfo.expiresAt}).
          </Text>
          <Text style={styles.refundSubtext}>
            No questions asked. You can request a refund anytime from your dashboard.
          </Text>
        </Card>
      )}

      {/* What Happens Next */}
      <Text style={styles.sectionTitle}>What Happens Next</Text>

      <Card variant="default" style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepIcon}>📧</Text>
          <View>
            <Text style={styles.stepTitle}>Welcome Email</Text>
            <Text style={styles.stepDescription}>Check your email for account details and setup guide</Text>
          </View>
        </View>
      </Card>

      <Card variant="default" style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepIcon}>📍</Text>
          <View>
            <Text style={styles.stepTitle}>Start Receiving Leads</Text>
            <Text style={styles.stepDescription}>
              {tier.includes('Basic') ? 'First weekly digest on Monday' : 'Real-time notifications as they come in'}
            </Text>
          </View>
        </View>
      </Card>

      <Card variant="default" style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepIcon}>📊</Text>
          <View>
            <Text style={styles.stepTitle}>Access Your Dashboard</Text>
            <Text style={styles.stepDescription}>View leads, manage notifications, track performance</Text>
          </View>
        </View>
      </Card>

      {/* Quick Tips */}
      <Text style={styles.sectionTitle}>Quick Tips</Text>

      <Card variant="outlined" style={styles.tipCard}>
        <Text style={styles.tipIcon}>💡</Text>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Complete Your Profile</Text>
          <Text style={styles.tipText}>
            Add a photo, bio, and credentials to stand out on the Find a Pro page
          </Text>
        </View>
      </Card>

      <Card variant="outlined" style={styles.tipCard}>
        <Text style={styles.tipIcon}>⚡</Text>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Set Notification Preferences</Text>
          <Text style={styles.tipText}>
            Choose how and when you receive leads (email, push, SMS if applicable)
          </Text>
        </View>
      </Card>

      <Card variant="outlined" style={styles.tipCard}>
        <Text style={styles.tipIcon}>📞</Text>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Reach Out Quickly</Text>
          <Text style={styles.tipText}>
            Contact leads within 24 hours for best conversion rates
          </Text>
        </View>
      </Card>

      {/* Support */}
      <Card variant="default" style={styles.supportCard}>
        <Text style={styles.supportTitle}>Need Help?</Text>
        <Text style={styles.supportText}>
          Our support team is here to help. Email us at support@appraisalonline.com or tap the help icon in your dashboard.
        </Text>
      </Card>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title="Go to Dashboard"
          size="large"
          onPress={() => router.push('/broker/dashboard')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Complete Your Profile"
          variant="secondary"
          size="large"
          onPress={() => router.push('/broker/profile')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="View Terms & Conditions"
          variant="outline"
          size="large"
          onPress={() => {
            // TODO: Open terms in modal or new screen
            console.log('Open terms');
          }}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  celebrationArea: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  celebration: {
    fontSize: 72,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  successMessage: {
    fontSize: 16,
    color: '#6B7280',
  },
  membershipCard: {
    backgroundColor: '#F0F9FF',
    marginBottom: 20,
    alignItems: 'center',
  },
  membershipTier: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  membershipBilling: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  membershipDivider: {
    height: 1,
    backgroundColor: '#BFDBFE',
    width: '100%',
    marginBottom: 16,
  },
  membershipDate: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membershipDateLabel: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  membershipDateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  refundCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBDFD4',
    marginBottom: 24,
  },
  refundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 8,
  },
  refundText: {
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
    marginBottom: 6,
  },
  bold: {
    fontWeight: '700',
  },
  refundSubtext: {
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  stepCard: {
    marginBottom: 12,
    paddingVertical: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  tipCard: {
    marginBottom: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  supportCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    marginBottom: 24,
    marginTop: 16,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  supportText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
});
