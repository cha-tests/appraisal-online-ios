import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function DemoContent() {
  const router = useRouter();

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="← Back"
          variant="outline"
          size="small"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start' }}
        />
        <Text style={styles.title}>See How It Works</Text>
        <Text style={styles.subtitle}>
          Explore sample reports, alerts, and broker profiles
        </Text>
      </View>

      {/* Sample Report */}
      <Text style={styles.sectionTitle}>Sample Valuation Report</Text>

      <Card variant="elevated" style={styles.reportCard}>
        <Text style={styles.reportAddress}>123 Oak Avenue, San Francisco, CA</Text>
        <Text style={styles.reportValue}>$850,000</Text>
        <Text style={styles.reportMeta}>Based on 5 comparable sales</Text>
      </Card>

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          ⚠️ This is a computer estimate. It is not a licensed appraisal. Banks, courts, and government agencies do not accept this as a formal valuation.
        </Text>
      </View>

      {/* Sample Comparables */}
      <Text style={styles.sectionTitle}>Similar Properties Sold</Text>

      <Card variant="default" style={styles.comparableCard}>
        <View style={styles.comparableHeader}>
          <View>
            <Text style={styles.comparableAddress}>456 Elm Street</Text>
            <Text style={styles.comparableDate}>Sold 2 weeks ago</Text>
          </View>
          <Text style={styles.comparablePrice}>$825,000</Text>
        </View>
        <Text style={styles.comparableDistance}>0.3 miles away • 92% similar</Text>
      </Card>

      <Card variant="default" style={styles.comparableCard}>
        <View style={styles.comparableHeader}>
          <View>
            <Text style={styles.comparableAddress}>789 Maple Drive</Text>
            <Text style={styles.comparableDate}>Sold 1 month ago</Text>
          </View>
          <Text style={styles.comparablePrice}>$875,000</Text>
        </View>
        <Text style={styles.comparableDistance}>0.5 miles away • 88% similar</Text>
      </Card>

      {/* Sample Lead Alert */}
      <Text style={styles.sectionTitle}>Sample Lead Alert (Premium/Founder)</Text>

      <Card variant="elevated" style={styles.alertCard}>
        <Text style={styles.alertIcon}>🔔</Text>
        <Text style={styles.alertTitle}>New Lead Available</Text>
        <Text style={styles.alertAddress}>456 Elm Street, San Francisco, CA</Text>
        <Text style={styles.alertValue}>$825,000 valuation</Text>
        <Text style={styles.alertMeta}>
          Homeowner is interested in professional guidance • Contacted 2 minutes ago
        </Text>
      </Card>

      {/* Sample Weekly Digest */}
      <Text style={styles.sectionTitle}>Sample Weekly Digest (Basic)</Text>

      <Card variant="default" style={styles.digestCard}>
        <Text style={styles.digestTitle}>📧 Your Weekly Leads • Monday, June 24</Text>
        <Text style={styles.digestSubtitle}>3 new opportunities in your city</Text>

        <View style={styles.digestItem}>
          <Text style={styles.digestItemAddress}>123 Oak Avenue</Text>
          <Text style={styles.digestItemValue}>$850,000</Text>
        </View>

        <View style={styles.digestItem}>
          <Text style={styles.digestItemAddress}>456 Elm Street</Text>
          <Text style={styles.digestItemValue}>$825,000</Text>
        </View>

        <View style={styles.digestItem}>
          <Text style={styles.digestItemAddress}>789 Maple Drive</Text>
          <Text style={styles.digestItemValue}>$875,000</Text>
        </View>

        <Button
          title="View All Details"
          size="small"
          onPress={() => {}}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Sample Broker Profile */}
      <Text style={styles.sectionTitle}>Sample Broker Profile</Text>

      <Card variant="elevated" style={styles.brokerCard}>
        <View style={styles.brokerHeader}>
          <View style={styles.brokerPhoto}>
            <Text style={styles.brokerPhotoText}>👤</Text>
          </View>
          <View style={styles.brokerInfo}>
            <Text style={styles.brokerName}>Sarah Martinez</Text>
            <Text style={styles.brokerBadge}>Founder Member</Text>
          </View>
        </View>

        <Text style={styles.brokerBio}>
          13 years of experience in residential and investment properties. Specializing in Bay Area luxury homes.
        </Text>

        <View style={styles.brokerContact}>
          <Text style={styles.brokerContactItem}>📱 (555) 123-4567</Text>
          <Text style={styles.brokerContactItem}>🌐 smartinez-realty.com</Text>
        </View>

        <Button
          title="Contact This Professional"
          size="small"
          onPress={() => {}}
        />
      </Card>

      {/* Features Highlight */}
      <Text style={styles.sectionTitle}>What You'll Get</Text>

      <View style={styles.featureItem}>
        <Text style={styles.featureIcon}>✓</Text>
        <View>
          <Text style={styles.featureTitle}>AI-Powered Valuations</Text>
          <Text style={styles.featureDesc}>In under 60 seconds, get an estimate based on comparable sales</Text>
        </View>
      </View>

      <View style={styles.featureItem}>
        <Text style={styles.featureIcon}>✓</Text>
        <View>
          <Text style={styles.featureTitle}>Local Professionals</Text>
          <Text style={styles.featureDesc}>Connect with real estate agents, lenders, and brokers in your area</Text>
        </View>
      </View>

      <View style={styles.featureItem}>
        <Text style={styles.featureIcon}>✓</Text>
        <View>
          <Text style={styles.featureTitle}>Your Privacy Protected</Text>
          <Text style={styles.featureDesc}>You control who can contact you. No sharing without consent.</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          title="Get Started for Free"
          size="large"
          onPress={() => router.push('/consumer/address-entry')}
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

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 24,
  },
  reportCard: {
    alignItems: 'center',
    marginBottom: 12,
  },
  reportAddress: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  reportValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  reportMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  disclaimerCard: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#FBBF24',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  comparableCard: {
    marginBottom: 12,
  },
  comparableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  comparableAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  comparableDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  comparablePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  comparableDistance: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  alertCard: {
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    marginBottom: 24,
  },
  alertIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 8,
  },
  alertAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  alertValue: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  alertMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  digestCard: {
    marginBottom: 24,
  },
  digestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  digestSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  digestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  digestItemAddress: {
    fontSize: 14,
    color: '#1F2937',
  },
  digestItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  brokerCard: {
    backgroundColor: '#F0F9FF',
    marginBottom: 24,
  },
  brokerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  brokerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  brokerPhotoText: {
    fontSize: 32,
  },
  brokerInfo: {
    flex: 1,
  },
  brokerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  brokerBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  brokerBio: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  brokerContact: {
    marginBottom: 12,
    gap: 6,
  },
  brokerContactItem: {
    fontSize: 13,
    color: '#6B7280',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    color: '#10B981',
    marginRight: 12,
    marginTop: -2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
    marginTop: 24,
  },
});
