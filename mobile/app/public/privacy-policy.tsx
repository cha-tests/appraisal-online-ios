import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function PrivacyPolicy() {
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
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last updated: August 21, 2026</Text>
      </View>

      {/* Content */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.sectionText}>
          Appraisal Online ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.sectionText}>
          <Text style={styles.bold}>Personal Information:</Text>
          {'\n'}• Email address and account credentials
          {'\n'}• Name and contact information
          {'\n'}• Phone number (if provided)
          {'\n'}• Property address and details
          {'\n'}• Payment information (processed by Stripe)
          {'\n'}
          {'\n'}<Text style={styles.bold}>Usage Data:</Text>
          {'\n'}• Device information
          {'\n'}• Browser type and IP address
          {'\n'}• Pages visited and time spent
          {'\n'}• Analytics events
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.sectionText}>
          • Generate property valuations
          {'\n'}• Process payments and subscriptions
          {'\n'}• Send confirmations and reports via email
          {'\n'}• Connect you with real estate professionals (only with consent)
          {'\n'}• Improve our service
          {'\n'}• Comply with legal obligations
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>4. Who We Share Your Data With</Text>
        <Text style={styles.sectionText}>
          <Text style={styles.bold}>Service Providers:</Text>
          {'\n'}• Stripe (payment processing)
          {'\n'}• Postmark (email delivery)
          {'\n'}• Supabase (database hosting)
          {'\n'}• Google (location services, analytics)
          {'\n'}
          {'\n'}<Text style={styles.bold}>Professional Connections:</Text>
          {'\n'}We share your information with real estate brokers and agents ONLY when you explicitly opt in to be contacted.
          {'\n'}
          {'\n'}<Text style={styles.bold}>We do NOT sell your data.</Text>
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>5. Your Rights</Text>
        <Text style={styles.sectionText}>
          <Text style={styles.bold}>Data Access:</Text>
          {'\n'}You can request a copy of your data at any time.
          {'\n'}
          {'\n'}<Text style={styles.bold}>Data Deletion:</Text>
          {'\n'}Request deletion of your account and all data. We'll process this within 30 days.
          {'\n'}
          {'\n'}<Text style={styles.bold}>Opt-Out:</Text>
          {'\n'}Unsubscribe from email communications in your account settings.
          {'\n'}
          {'\n'}<Text style={styles.bold}>Corrections:</Text>
          {'\n'}Update or correct your personal information anytime.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>6. Security</Text>
        <Text style={styles.sectionText}>
          We implement industry-standard security measures including:
          {'\n'}• HTTPS encryption for all data in transit
          {'\n'}• Row-level security on database records
          {'\n'}• No storage of full payment card information
          {'\n'}• Regular security audits
          {'\n'}• Secure authentication via Supabase Auth
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>7. Cookies & Tracking</Text>
        <Text style={styles.sectionText}>
          We use essential cookies for authentication and session management. We do not use third-party tracking cookies. Analytics data is collected anonymously via PostHog.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>8. Third-Party Links</Text>
        <Text style={styles.sectionText}>
          Our app may contain links to third-party websites. We are not responsible for their privacy practices. Always review their privacy policy before sharing information.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
        <Text style={styles.sectionText}>
          Our service is not intended for users under 18 years old. We do not knowingly collect information from minors. If we learn we have collected data from a minor, we will delete it immediately.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
        <Text style={styles.sectionText}>
          We may update this Privacy Policy from time to time. We'll notify you of material changes by posting the updated policy here. Your continued use means you accept the changes.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.sectionText}>
          Questions about this Privacy Policy?
          {'\n'}Email: support@appraisalonline.com
          {'\n'}Website: www.appraisalonline.com
          {'\n'}
          {'\n'}We'll respond within 10 business days.
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
