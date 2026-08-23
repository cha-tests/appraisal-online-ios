import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function HowWeMakeMoney() {
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
        <Text style={styles.title}>How We Make Money</Text>
        <Text style={styles.subtitle}>
          A transparent look at our business model
        </Text>
      </View>

      {/* Mission Statement */}
      <Card variant="outlined" style={styles.missionCard}>
        <Text style={styles.missionIcon}>🎯</Text>
        <Text style={styles.missionText}>
          We make money by helping real estate professionals find qualified homeowners. Homeowners get free valuations. Professionals get pre-qualified leads. Everyone wins.
        </Text>
      </Card>

      {/* How It Works */}
      <Text style={styles.sectionTitle}>The Three-Party Model</Text>

      <View style={styles.flowItem}>
        <View style={styles.flowNumber}>
          <Text style={styles.flowNumberText}>1</Text>
        </View>
        <View style={styles.flowContent}>
          <Text style={styles.flowTitle}>Homeowners Get Free Valuations</Text>
          <Text style={styles.flowDesc}>
            You enter your address and property details. We use AI to estimate your home's value based on local comparable sales. Completely free, 3 times per month.
          </Text>
        </View>
      </View>

      <View style={styles.flowItem}>
        <View style={styles.flowNumber}>
          <Text style={styles.flowNumberText}>2</Text>
        </View>
        <View style={styles.flowContent}>
          <Text style={styles.flowTitle}>You Choose Professional Connections</Text>
          <Text style={styles.flowDesc}>
            At the end of your valuation, you can opt in to have local real estate agents, brokers, and lenders see your property and contact you. You're in total control.
          </Text>
        </View>
      </View>

      <View style={styles.flowItem}>
        <View style={styles.flowNumber}>
          <Text style={styles.flowNumberText}>3</Text>
        </View>
        <View style={styles.flowContent}>
          <Text style={styles.flowTitle}>Professionals Pay for Qualified Leads</Text>
          <Text style={styles.flowDesc}>
            Brokers and agents pay monthly subscriptions to access leads in their area. They only see homeowners who've explicitly opted in.
          </Text>
        </View>
      </View>

      {/* Broker Pricing */}
      <Text style={styles.sectionTitle}>Broker Subscription Tiers</Text>

      <Card variant="default" style={styles.tierCard}>
        <Text style={styles.tierBadge}>Founder Lifetime</Text>
        <Text style={styles.tierPrice}>$499</Text>
        <Text style={styles.tierPeriod}>One-time investment</Text>
        <Text style={styles.tierFeature}>📌 25 cities of coverage</Text>
        <Text style={styles.tierFeature}>⚡ Real-time lead notifications</Text>
        <Text style={styles.tierFeature}>💰 Unlimited leads</Text>
        <Text style={styles.tierFeature}>📲 Text + email + push</Text>
        <Text style={styles.tierFeature}>✅ 14-day money back guarantee</Text>
      </Card>

      <Card variant="default" style={styles.tierCard}>
        <Text style={styles.tierBadge}>Premium Annual</Text>
        <Text style={styles.tierPrice}>$199</Text>
        <Text style={styles.tierPeriod}>Billed yearly</Text>
        <Text style={styles.tierFeature}>📌 10 cities of coverage</Text>
        <Text style={styles.tierFeature}>📧 Weekly digest emails</Text>
        <Text style={styles.tierFeature}>💰 Unlimited leads</Text>
        <Text style={styles.tierFeature}>📬 Email only</Text>
        <Text style={styles.tierFeature}>✅ 30-day money back guarantee</Text>
      </Card>

      <Card variant="default" style={styles.tierCard}>
        <Text style={styles.tierBadge}>Basic Annual</Text>
        <Text style={styles.tierPrice}>$49</Text>
        <Text style={styles.tierPeriod}>Billed yearly</Text>
        <Text style={styles.tierFeature}>📌 1 city of coverage</Text>
        <Text style={styles.tierFeature}>📧 Weekly digest emails</Text>
        <Text style={styles.tierFeature}>💰 Unlimited leads</Text>
        <Text style={styles.tierFeature}>📬 Email only</Text>
        <Text style={styles.tierFeature}>✅ 30-day money back guarantee</Text>
      </Card>

      {/* Refund Guarantee */}
      <Card variant="elevated" style={styles.refundCard}>
        <Text style={styles.refundIcon}>💚</Text>
        <Text style={styles.refundTitle}>Money-Back Guarantee</Text>
        <Text style={styles.refundText}>
          All broker memberships include a money-back guarantee. Founder members get 14 days. Premium and Basic tiers get 30 days. If you're not satisfied with your leads, request a refund. We'll refund the full amount.
        </Text>
      </Card>

      {/* What We Don't Do */}
      <Text style={styles.sectionTitle}>What We Don't Do</Text>

      <View style={styles.dontItem}>
        <Text style={styles.dontIcon}>✗</Text>
        <View>
          <Text style={styles.dontTitle}>Sell Your Data</Text>
          <Text style={styles.dontDesc}>
            We never sell homeowner information to third parties. Your data stays private.
          </Text>
        </View>
      </View>

      <View style={styles.dontItem}>
        <Text style={styles.dontIcon}>✗</Text>
        <View>
          <Text style={styles.dontTitle}>Share Without Consent</Text>
          <Text style={styles.dontDesc}>
            Brokers only see properties from homeowners who've explicitly opted in.
          </Text>
        </View>
      </View>

      <View style={styles.dontItem}>
        <Text style={styles.dontIcon}>✗</Text>
        <View>
          <Text style={styles.dontTitle}>Charge Homeowners</Text>
          <Text style={styles.dontDesc}>
            Getting valuations and viewing professional profiles is always free for homeowners.
          </Text>
        </View>
      </View>

      {/* Sustainability */}
      <Card variant="outlined" style={styles.sustainabilityCard}>
        <Text style={styles.sustainabilityTitle}>Why This Model Works</Text>
        <Text style={styles.sustainabilityText}>
          Professionals pay for qualified leads because they save time. Homeowners get free valuations. We stay profitable by matching them efficiently. It's a win-win-win.
        </Text>
      </Card>

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          title="Get Started for Free"
          size="large"
          onPress={() => router.push('/consumer/address-entry')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Become a Broker Partner"
          variant="secondary"
          size="large"
          onPress={() => router.push('/broker/splash')}
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
  missionCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    alignItems: 'center',
    marginBottom: 24,
  },
  missionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  missionText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    marginTop: 24,
  },
  flowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  flowNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  flowNumberText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
  },
  flowContent: {
    flex: 1,
  },
  flowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  flowDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  tierCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  tierBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 8,
  },
  tierPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  tierPeriod: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  tierFeature: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 6,
  },
  refundCard: {
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  refundIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  refundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 8,
    textAlign: 'center',
  },
  refundText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    textAlign: 'center',
  },
  dontItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dontIcon: {
    fontSize: 20,
    color: '#EF4444',
    marginRight: 12,
    marginTop: 2,
  },
  dontTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  dontDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  sustainabilityCard: {
    backgroundColor: '#F5F3FF',
    borderColor: '#D8B4FE',
    marginTop: 24,
    marginBottom: 24,
  },
  sustainabilityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  sustainabilityText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
    marginTop: 24,
  },
});
