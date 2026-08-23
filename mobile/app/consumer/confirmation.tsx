import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useReportStore } from '../../stores/report.store';

export default function Confirmation() {
  const router = useRouter();
  const report = useReportStore((state) => state.currentReport);

  const handleViewReport = () => {
    router.push('/consumer/report-view');
  };

  const handleNewReport = () => {
    useReportStore.setState({ currentReport: null });
    router.push('/consumer/address-entry');
  };

  const handleViewAccount = () => {
    router.push('/consumer/account');
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Success Animation Area */}
      <View style={styles.celebrationArea}>
        <Text style={styles.checkmark}>✅</Text>
        <Text style={styles.successTitle}>All Done!</Text>
        <Text style={styles.successMessage}>
          Your valuation report is ready
        </Text>
      </View>

      {/* Summary Cards */}
      <Card variant="elevated" style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Report Status</Text>
          <Text style={styles.summaryValue}>Generated & Ready</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Broker Contact</Text>
          <Text style={styles.summaryValue}>
            {report?.broker_contact_opted_in ? 'Enabled' : 'Not Enabled'}
          </Text>
        </View>
      </Card>

      {/* Next Steps */}
      <Text style={styles.sectionTitle}>What's Next?</Text>
      <Card variant="default" style={styles.nextStepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepIcon}>📄</Text>
          <Text style={styles.stepHeading}>Download Your Report</Text>
        </View>
        <Text style={styles.stepDescription}>
          Get a detailed PDF with your valuation, comparable sales, and market analysis.
        </Text>
      </Card>

      {report?.broker_contact_opted_in && (
        <Card variant="default" style={styles.nextStepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepIcon}>🤝</Text>
            <Text style={styles.stepHeading}>Hear from Professionals</Text>
          </View>
          <Text style={styles.stepDescription}>
            Qualified real estate professionals in your area will reach out within 24-48 hours.
          </Text>
        </Card>
      )}

      <Card variant="default" style={styles.nextStepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepIcon}>🎯</Text>
          <Text style={styles.stepHeading}>Get More Valuations</Text>
        </View>
        <Text style={styles.stepDescription}>
          You have 2 free valuations left this month. Compare multiple properties anytime.
        </Text>
      </Card>

      {/* Call to Action */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Create Your Account</Text>
        <Text style={styles.ctaDescription}>
          Save your reports and get notifications when professionals contact you.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title="View Full Report"
          size="large"
          onPress={handleViewReport}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Create Account"
          variant="secondary"
          size="large"
          onPress={handleViewAccount}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Get Another Valuation"
          variant="outline"
          size="large"
          onPress={handleNewReport}
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
  checkmark: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#6B7280',
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryItem: {
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  nextStepCard: {
    marginBottom: 12,
    padding: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  stepHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginLeft: 36,
  },
  ctaSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    marginTop: 16,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  ctaDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
});
