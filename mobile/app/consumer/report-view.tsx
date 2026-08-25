import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useReportStore } from '../../stores/report.store';
import { useAuthStore } from '../../stores/auth.store';
import { pdfService } from '../../services/pdf.service';
import { formatDistance } from '../../config/marketConfig';

export default function ReportView() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const report = useReportStore((state) => state.currentReport);
  const currentProperty = useReportStore((state) => state.currentProperty);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  if (!report) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>Report not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  const valueMidpoint = report.estimated_value;
  const valueFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(valueMidpoint / 100);

  const confidenceLowFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(report.confidence_range.low / 100);

  const confidenceHighFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(report.confidence_range.high / 100);

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);

      if (!user?.id || !report?.id) {
        Alert.alert('Error', 'Missing user or report information');
        return;
      }

      const propertyAddress = currentProperty?.address || 'Property Report';

      const result = await pdfService.downloadReportPDF(
        user.id,
        report.id,
        propertyAddress
      );

      if (result.success) {
        Alert.alert(
          'Success',
          `Report downloaded successfully!\n\nFile: ${propertyAddress}.pdf`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          result.error || 'Failed to download PDF report'
        );
      }
    } catch (error) {
      console.error('PDF download error:', error);
      Alert.alert(
        'Error',
        'An error occurred while downloading the report'
      );
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just got an AI valuation for my property: ${valueFormatted}. Check it out!`,
        url: report.pdf_url,
        title: 'Property Valuation Report',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Disclaimer Banner */}
      <Card variant="outlined" style={[styles.disclaimerCard, styles.marginBottom]}>
        <Text style={styles.disclaimerTitle}>⚠️ Important Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          This is a computer estimate. It is not a licensed appraisal. Banks, courts, and government agencies do not accept this as a formal valuation.
        </Text>
      </Card>

      {/* Valuation Card */}
      <Card variant="elevated" style={styles.valuationCard}>
        <Text style={styles.estimateLabel}>Estimated Value</Text>
        <Text style={styles.valuationAmount}>{valueFormatted}</Text>
        <View style={styles.confidenceRange}>
          <View style={styles.rangeItem}>
            <Text style={styles.rangeLabel}>Low Estimate</Text>
            <Text style={styles.rangeValue}>{confidenceLowFormatted}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rangeItem}>
            <Text style={styles.rangeLabel}>High Estimate</Text>
            <Text style={styles.rangeValue}>{confidenceHighFormatted}</Text>
          </View>
        </View>
      </Card>

      {/* Comparables Section */}
      <Text style={styles.sectionTitle}>Comparable Sales</Text>
      <Text style={styles.sectionSubtitle}>
        Recent sales of similar properties in your area
      </Text>

      {report.comparables.map((comparable, index) => (
        <Card key={index} variant="default" style={styles.comparableCard}>
          <View style={styles.comparableHeader}>
            <Text style={styles.comparableAddress}>{comparable.address}</Text>
            <Text style={styles.comparableDistance}>
              {formatDistance(comparable.distance_miles, currentProperty?.address_components?.country_code)} away
            </Text>
          </View>
          <View style={styles.comparableDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Sale Price</Text>
              <Text style={styles.detailValue}>
                ${(comparable.sale_price / 100).toLocaleString()}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{comparable.sale_date}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Similarity</Text>
              <Text style={styles.detailValue}>
                {(comparable.similarity_score * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </Card>
      ))}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Download PDF"
          size="large"
          onPress={handleDownloadPDF}
          loading={downloadingPDF}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Share Report"
          variant="secondary"
          size="large"
          onPress={handleShare}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Next: Connect with Professionals"
          variant="outline"
          size="large"
          onPress={() => router.push('/consumer/broker-optins')}
        />
      </View>
    </SafeAreaWrapper>
  );
}

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
  marginBottom: {
    marginBottom: 20,
  },
  disclaimerCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  valuationCard: {
    backgroundColor: '#F0F9FF',
    marginBottom: 24,
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  valuationAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 20,
  },
  confidenceRange: {
    width: '100%',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    paddingTop: 16,
  },
  rangeItem: {
    flex: 1,
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  rangeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  divider: {
    width: 1,
    backgroundColor: '#BFDBFE',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  comparableCard: {
    marginBottom: 12,
  },
  comparableHeader: {
    marginBottom: 12,
  },
  comparableAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  comparableDistance: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  comparableDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  actions: {
    marginBottom: 32,
    marginTop: 24,
  },
});
