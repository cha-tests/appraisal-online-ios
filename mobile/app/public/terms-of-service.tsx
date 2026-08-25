import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function TermsOfService() {
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
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last updated: August 21, 2026</Text>
      </View>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
        <Text style={styles.sectionText}>
          By accessing and using Appraisal Online, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>2. Use License</Text>
        <Text style={styles.sectionText}>
          Permission is granted to temporarily download one copy of the materials (information or software) on Appraisal Online for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          {'\n'}• Modify or copy the materials
          {'\n'}• Use the materials for any commercial purpose or for any public display
          {'\n'}• Attempt to decompile or reverse engineer any software
          {'\n'}• Remove any copyright or other proprietary notations
          {'\n'}• Transfer the materials to another person or "mirror" the materials
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>3. Disclaimer</Text>
        <Text style={styles.sectionText}>
          <Text style={styles.bold}>AI-Generated Content:</Text>
          {'\n'}Property valuations provided by Appraisal Online are computer-generated estimates based on available market data. These are NOT licensed appraisals and should not be used for:
          {'\n'}• Mortgage lending decisions
          {'\n'}• Legal proceedings
          {'\n'}• Insurance claims
          {'\n'}• Tax assessments
          {'\n'}• Any official purpose requiring a licensed appraisal
          {'\n'}
          {'\n'}Always consult with a licensed appraiser for official valuations.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>4. Limitations of Liability</Text>
        <Text style={styles.sectionText}>
          In no event shall Appraisal Online or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials, even if we or our authorized representative has been notified orally or in writing of the possibility of such damage.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>5. Accuracy of Materials</Text>
        <Text style={styles.sectionText}>
          The materials appearing on Appraisal Online could include technical, typographical, or photographic errors. We do not warrant that any of the materials are accurate, complete, or current. We may make changes to the materials contained on our service at any time without notice.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>6. User Conduct</Text>
        <Text style={styles.sectionText}>
          Users agree not to:
          {'\n'}• Engage in any conduct that restricts the use of our services
          {'\n'}• Attempt to gain unauthorized access to our systems
          {'\n'}• Provide false or misleading information
          {'\n'}• Engage in harassment or abusive behavior
          {'\n'}• Upload malicious content or viruses
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>7. Free Reports Policy</Text>
        <Text style={styles.sectionText}>
          Consumers receive 3 free property valuation reports per calendar month. Reports reset on the 1st of each month. Additional reports may require a subscription or purchase.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>8. Broker Terms</Text>
        <Text style={styles.sectionText}>
          Brokers who subscribe agree to:
          {'\n'}• Use leads only for legitimate business purposes
          {'\n'}• Respect consumer privacy and opt-in preferences
          {'\n'}• Comply with fair housing laws
          {'\n'}• Not share leads with unauthorized third parties
          {'\n'}• Not engage in spam or harassment
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>9. Refund Policy</Text>
        <Text style={styles.sectionText}>
          Refunds are available within the tier-specific window:
          {'\n'}• Founder Lifetime: 14 days from purchase
          {'\n'}• Premium Annual: 30 days from purchase
          {'\n'}• Basic Annual: 30 days from purchase
          {'\n'}
          {'\n'}Refunds are processed within 5-10 business days.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>10. Termination</Text>
        <Text style={styles.sectionText}>
          We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including if you breach the Terms. Upon termination, your right to use the service will immediately cease.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>11. Governing Law</Text>
        <Text style={styles.sectionText}>
          These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Appraisal Online is located, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>12. Changes to Terms</Text>
        <Text style={styles.sectionText}>
          We reserve the right to modify these terms at any time. Changes become effective immediately upon posting. Your continued use constitutes acceptance of the modified terms.
        </Text>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>13. Contact</Text>
        <Text style={styles.sectionText}>
          If you have any questions about these Terms, please contact:
          {'\n'}Email: support@appraisalonline.com
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
