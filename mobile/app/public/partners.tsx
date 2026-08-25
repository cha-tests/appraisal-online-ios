import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const PARTNERS = [
  {
    name: 'Stripe',
    description: 'Secure payment processing',
    icon: '💳',
  },
  {
    name: 'Supabase',
    description: 'Database & authentication',
    icon: '🗄️',
  },
  {
    name: 'Google Cloud',
    description: 'AI & location services',
    icon: '☁️',
  },
  {
    name: 'Postmark',
    description: 'Transactional email',
    icon: '📧',
  },
  {
    name: 'Expo',
    description: 'Mobile app framework',
    icon: '📱',
  },
  {
    name: 'Twilio',
    description: 'SMS messaging',
    icon: '📲',
  },
];

export default function Partners() {
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
        <Text style={styles.title}>Our Partners</Text>
        <Text style={styles.subtitle}>
          We work with industry-leading partners to deliver reliable services
        </Text>
      </View>

      {/* Mission */}
      <Card variant="outlined" style={styles.missionCard}>
        <Text style={styles.missionTitle}>Our Partnership Philosophy</Text>
        <Text style={styles.missionText}>
          We partner with best-in-class providers who share our commitment to security, reliability, and user experience. Every partner is carefully selected and continuously monitored to ensure they meet our high standards.
        </Text>
      </Card>

      {/* Partners Grid */}
      <Text style={styles.sectionTitle}>Technology Partners</Text>

      {PARTNERS.map((partner, index) => (
        <Card key={index} variant="default" style={styles.partnerCard}>
          <Text style={styles.partnerIcon}>{partner.icon}</Text>
          <View style={styles.partnerContent}>
            <Text style={styles.partnerName}>{partner.name}</Text>
            <Text style={styles.partnerDesc}>{partner.description}</Text>
          </View>
        </Card>
      ))}

      {/* Why Choose Us */}
      <Text style={styles.sectionTitle}>Why Partner With Us?</Text>

      <Card variant="outlined" style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>✨ Quality Leads</Text>
        <Text style={styles.benefitText}>
          Every lead is verified and comes from a consumer who explicitly opted in to be contacted.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>🔒 Security First</Text>
        <Text style={styles.benefitText}>
          Bank-level security with encryption, RLS policies, and regular audits protect all data.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>📊 Real-Time Insights</Text>
        <Text style={styles.benefitText}>
          Dashboard with analytics, lead tracking, and performance metrics to optimize your strategy.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>💰 Transparent Pricing</Text>
        <Text style={styles.benefitText}>
          No hidden fees. Flexible plans with money-back guarantees. Pay for what you use.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.benefitCard}>
        <Text style={styles.benefitTitle}>🤝 Partner Support</Text>
        <Text style={styles.benefitText}>
          Dedicated support team to help you succeed. Training and resources included.
        </Text>
      </Card>

      {/* Partnership Opportunities */}
      <Text style={styles.sectionTitle}>Interest in Partnering?</Text>

      <Card variant="default" style={styles.opportunityCard}>
        <Text style={styles.opportunityTitle}>Integration & API Access</Text>
        <Text style={styles.opportunityText}>
          White-label solutions and API access available for CRM platforms, MLS systems, and brokerages.
        </Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('mailto:partnerships@appraisalonline.com')
          }
          style={styles.emailLink}
        >
          <Text style={styles.emailLinkText}>
            partnerships@appraisalonline.com
          </Text>
        </TouchableOpacity>
      </Card>

      <Card variant="default" style={styles.opportunityCard}>
        <Text style={styles.opportunityTitle}>Affiliate & Referral Program</Text>
        <Text style={styles.opportunityText}>
          Earn commissions by referring brokers and agents to Appraisal Online. Competitive rates and ongoing support.
        </Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('mailto:affiliates@appraisalonline.com')
          }
          style={styles.emailLink}
        >
          <Text style={styles.emailLinkText}>affiliates@appraisalonline.com</Text>
        </TouchableOpacity>
      </Card>

      <Card variant="default" style={styles.opportunityCard}>
        <Text style={styles.opportunityTitle}>Strategic Partnerships</Text>
        <Text style={styles.opportunityText}>
          Co-marketing opportunities, data partnerships, and joint ventures for qualified organizations.
        </Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('mailto:partners@appraisalonline.com')
          }
          style={styles.emailLink}
        >
          <Text style={styles.emailLinkText}>partners@appraisalonline.com</Text>
        </TouchableOpacity>
      </Card>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <Button
          title="Join Our Network"
          size="large"
          onPress={() => Linking.openURL('https://appraisalonline.com/partners')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="View Opportunities"
          variant="outline"
          size="large"
          onPress={() =>
            Linking.openURL('https://appraisalonline.com/become-partner')
          }
        />
      </View>

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
    color: '#6B7280',
    lineHeight: 20,
  },
  missionCard: {
    marginBottom: 24,
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  missionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 16,
  },
  partnerCard: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  partnerContent: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  partnerDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
  benefitCard: {
    marginBottom: 12,
    borderColor: '#BFDBFE',
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  opportunityCard: {
    marginBottom: 12,
  },
  opportunityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  opportunityText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  emailLink: {
    paddingVertical: 8,
  },
  emailLinkText: {
    fontSize: 13,
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  ctaContainer: {
    marginTop: 32,
    marginBottom: 32,
  },
  footer: {
    height: 16,
  },
});
