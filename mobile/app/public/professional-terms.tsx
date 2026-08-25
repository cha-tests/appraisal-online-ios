import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function ProfessionalTerms() {
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
        <Text style={styles.title}>Professional Terms</Text>
        <Text style={styles.subtitle}>For Real Estate Brokers & Agents</Text>
        <Text style={styles.lastUpdated}>Last updated: August 21, 2026</Text>
      </View>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>1. Broker Subscription Agreement</Text>
        <Text style={styles.sectionText}>
          This agreement governs your use of Appraisal Online as a real estate professional. By subscribing, you agree to comply with all applicable laws and our professional standards.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>2. Lead Quality & Authenticity</Text>
        <Text style={styles.sectionText}>
          • All leads come from consumers who have explicitly opted in to professional contact
          {'\n'}• Lead data is automatically verified against property records
          {'\n'}• No synthesized or duplicate leads
          {'\n'}• Leads are delivered in real-time (Lifetime/Premium) or as weekly digest (Basic)
          {'\n'}• We do not resell or share leads with competitors
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>3. Fair Housing Compliance</Text>
        <Text style={styles.sectionText}>
          You agree to comply with the Fair Housing Act and all applicable anti-discrimination laws:
          {'\n'}• No discrimination based on protected characteristics
          {'\n'}• Equal service to all qualified leads
          {'\n'}• Compliance with all state and local laws
          {'\n'}• Full accountability for your professional conduct
          {'\n'}
          {'\n'}Violations will result in immediate account termination.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>4. Lead Usage Restrictions</Text>
        <Text style={styles.sectionText}>
          Leads may only be used for:
          {'\n'}• Direct professional contact with consumers
          {'\n'}• Marketing real estate services
          {'\n'}• Professional follow-up and client relationship building
          {'\n'}
          {'\n'}Leads may NOT be used for:
          {'\n'}• Resale or redistribution
          {'\n'}• Data mining or harvesting
          {'\n'}• Non-real estate business purposes
          {'\n'}• Sharing with unauthorized third parties
          {'\n'}• Spam, harassment, or abusive contact
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>5. Privacy & Confidentiality</Text>
        <Text style={styles.sectionText}>
          • Consumer data is confidential and for your use only
          {'\n'}• Do not share lead information with third parties without consent
          {'\n'}• Do not sell or trade consumer contact information
          {'\n'}• Comply with GDPR, CCPA, and all privacy laws
          {'\n'}• Update your notification preferences in your settings
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>6. Subscription Tiers</Text>
        <Text style={styles.sectionText}>
          <Text style={styles.bold}>Founder Lifetime - $499</Text>
          {'\n'}• 25 cities
          {'\n'}• Real-time lead notifications
          {'\n'}• Email, push, and SMS
          {'\n'}• 14-day refund window
          {'\n'}
          {'\n'}<Text style={styles.bold}>Premium Annual - $199/year</Text>
          {'\n'}• 10 cities
          {'\n'}• Real-time lead notifications
          {'\n'}• Email and push only
          {'\n'}• 30-day refund window
          {'\n'}
          {'\n'}<Text style={styles.bold}>Basic Annual - $49/year</Text>
          {'\n'}• 1 city
          {'\n'}• Weekly digest only
          {'\n'}• Email only
          {'\n'}• 30-day refund window
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>7. Founder Capacity</Text>
        <Text style={styles.sectionText}>
          To maintain lead quality, we limit Founder Lifetime subscriptions to 30 per city. Each city has a Founder counter visible to all brokers. Once full, Founder tier cannot be selected for that city.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>8. Marketing Allocation</Text>
        <Text style={styles.sectionText}>
          Monthly marketing budget is allocated based on subscription tiers:
          {'\n'}• Founder Lifetime = 3x weight
          {'\n'}• Premium Annual = 2x weight
          {'\n'}• Basic Annual = 1x weight
          {'\n'}
          {'\n'}Your allocation determines lead volume and priority ranking in your city.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>9. Notification Preferences</Text>
        <Text style={styles.sectionText}>
          You can customize:
          {'\n'}• Email notifications (on/off)
          {'\n'}• Push notifications (on/off)
          {'\n'}• SMS notifications (on/off, Founder only)
          {'\n'}• Quiet hours (Founder only)
          {'\n'}• Weekly digest time (Basic only)
          {'\n'}
          {'\n'}Changes take effect immediately.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>10. Refunds & Cancellation</Text>
        <Text style={styles.sectionText}>
          • Cancellation available anytime with refund within the window
          {'\n'}• Founder: 14 days
          {'\n'}• Premium/Basic: 30 days
          {'\n'}• Account closure removes all your data
          {'\n'}• No refunds after the window closes
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>11. Professional Conduct</Text>
        <Text style={styles.sectionText}>
          You agree to:
          {'\n'}• Maintain professional standards
          {'\n'}• Respond to leads timely and respectfully
          {'\n'}• Disclose your affiliation and business terms
          {'\n'}• Not misrepresent services or credentials
          {'\n'}• Maintain transparency in all communications
          {'\n'}• Respect consumer preferences and opt-outs
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>12. Account Termination</Text>
        <Text style={styles.sectionText}>
          We may terminate your account for:
          {'\n'}• Violation of fair housing laws
          {'\n'}• Repeated consumer complaints
          {'\n'}• Harassment, spam, or abusive conduct
          {'\n'}• Non-payment or fraudulent payment
          {'\n'}• Any violation of these professional terms
          {'\n'}
          {'\n'}Termination is immediate with no refund.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>13. Liability & Indemnification</Text>
        <Text style={styles.sectionText}>
          • You are solely responsible for your professional conduct
          {'\n'}• You indemnify Appraisal Online against claims arising from your violations
          {'\n'}• We provide leads as-is without warranty
          {'\n'}• Lead accuracy is guaranteed but not performance
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>14. Contact</Text>
        <Text style={styles.sectionText}>
          Professional inquiries:
          {'\n'}Email: brokers@appraisalonline.com
          {'\n'}Website: www.appraisalonline.com
        </Text>
      </Card>

      <View style={styles.footer} />
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
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 16,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#1F2937',
  },
  footer: {
    height: 32,
  },
});
