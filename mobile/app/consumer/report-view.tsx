import React, { useState } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { CurrencyValue } from '../../components/ui/CurrencyValue';
import { useReportStore } from '../../stores/report.store';
import { pdfService } from '../../services/pdf.service';
import { formatDistance, formatCurrency } from '../../config/marketConfig';
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { CLIENT_DISCLAIMER_TEXT } from '../../config/disclaimers';
import { useRequireAccount } from '../../hooks/useRequireAccount';
import { theme } from '../../theme';

export default function ReportView() {
  const router = useRouter();
  useRequireAccount();
  const report = useReportStore((state) => state.currentReport);
  const currentProperty = useReportStore((state) => state.currentProperty);
  const clearReport = useReportStore((state) => state.clear);
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

  // Prefer the property's own address_components (authoritative — set at
  // property-creation time) and fall back to the country_code stashed on
  // gemini_response at report-generation time (see report.service.ts) for
  // older reports or screens that only have the report row.
  const countryCode =
    currentProperty?.address_components?.country_code ?? report.gemini_response?.country_code;

  const low = report.confidence_range.low;
  const high = report.confidence_range.high;
  const range = Math.max(high - low, 1);
  // Marked between 14% and 86% along the bar per the design brief, scaled to
  // where the estimate actually sits within its own low-high range (rather
  // than a fixed midpoint) so a lopsided range still reads correctly.
  const markerPct = 14 + ((report.estimated_value - low) / range) * (86 - 14);

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);

      if (!report?.id) {
        Alert.alert('Error', 'Missing report information');
        return;
      }

      const propertyAddress = currentProperty?.address || 'Property Report';

      const result = await pdfService.downloadReportPDF(report, currentProperty, propertyAddress);

      if (result.success) {
        Alert.alert('Success', `Report downloaded successfully!\n\nFile: ${propertyAddress}.pdf`, [
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to download PDF report');
      }
    } catch (error) {
      console.error('PDF download error:', error);
      Alert.alert('Error', 'An error occurred while downloading the report');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleValueAnother = () => {
    // Otherwise this property's rooms/rate would leak into the next
    // valuation — see report.store.ts's clear.
    clearReport();
    // dismissTo (not push) so this drops Confirm/Details/Loading/Report/
    // opt-ins back down to the existing Home already at the bottom of the
    // stack, rather than stacking a second Home on top of them — a plain
    // push would leave the swipe-back gesture able to re-enter the just-
    // cleared flow.
    router.dismissTo('/consumer/home');
  };

  return (
    <SafeAreaWrapper scrollable>
      <BackButton onPress={() => router.push('/consumer/home')} />

      {/* Shown when Gemini failed and report.service.ts silently fell back to
          a generic placeholder valuation (see generateMockValuation) — that
          fallback exists so a real-API hiccup doesn't strand the user
          mid-flow, but without this notice the placeholder is
          indistinguishable from a real report. Placed first, before the
          number itself, so it's seen before the (fake) figure is. */}
      {report.gemini_response?.is_mock && (
        <DisclaimerNotice
          title="⚠️ Estimate unavailable"
          text="We couldn't reach our AI valuation service, so this is a rough placeholder, not a real estimate. Try generating this report again."
        />
      )}

      {/* Property Address */}
      {currentProperty?.address && (
        <View style={styles.addressHeader}>
          <Text style={styles.addressText}>{currentProperty.address}</Text>
        </View>
      )}

      {/* Valuation */}
      <View style={styles.valuationBlock}>
        <Text style={styles.estimateLabel}>Estimated value</Text>
        <CurrencyValue
          amountMinorUnits={report.estimated_value}
          countryCode={countryCode}
          style={styles.valuationAmount}
        />
        <Text style={styles.rangeLine}>
          Range {formatCurrency(low, countryCode)} – {formatCurrency(high, countryCode)}
        </Text>

        <View style={styles.rangeBarTrack}>
          <View style={[styles.rangeBarMarker, { left: `${Math.min(Math.max(markerPct, 0), 100)}%` }]} />
        </View>
      </View>

      <DisclaimerNotice title="⚠️ Important Notice" text={CLIENT_DISCLAIMER_TEXT} showPrcLink />

      {/* Property summary */}
      <Card variant="default" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type</Text>
          <Text style={styles.summaryValue}>{currentProperty?.property_type || '—'}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rooms</Text>
          <Text style={styles.summaryValue}>
            {currentProperty?.bedrooms ?? '—'} bed · {currentProperty?.bathrooms ?? '—'} bath
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Condition</Text>
          <Text style={styles.summaryValue}>{currentProperty?.condition || '—'}</Text>
        </View>
      </Card>

      {/* Comparables Section */}
      <Text style={styles.sectionTitle}>Comparable sales</Text>

      {report.comparables.map((comparable, index) => (
        <Card key={index} variant="default" style={styles.comparableCard}>
          <Text style={styles.comparableAddress}>{comparable.address}</Text>
          <Text style={styles.comparableMeta}>
            Sold {comparable.sale_date} ·{' '}
            {formatDistance(comparable.distance_miles, currentProperty?.address_components?.country_code)}{' '}
            away · {(comparable.similarity_score * 100).toFixed(0)}% similar
          </Text>
          <Text style={styles.comparablePrice}>{formatCurrency(comparable.sale_price, countryCode)}</Text>
        </Card>
      ))}

      {/* Broker opt-in */}
      {report.broker_contact_opted_in ? (
        <Card variant="default" style={styles.optinWash}>
          <Text style={styles.optinTitle}>You're connected</Text>
          <Text style={styles.optinText}>
            A qualified professional will reach out within 24-48 hours. You can manage this
            anytime from your account.
          </Text>
        </Card>
      ) : (
        <View style={styles.optinWash}>
          <Text style={styles.optinTitle}>Want professional help?</Text>
          <Text style={styles.optinText}>
            Optionally connect with a local real estate professional about this property.
          </Text>
          <Button
            title="Connect with a professional"
            variant="outline"
            size="medium"
            onPress={() => router.push('/consumer/broker-optins')}
            style={{ marginTop: theme.space.md }}
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Download PDF"
          size="large"
          onPress={handleDownloadPDF}
          loading={downloadingPDF}
          style={{ marginBottom: theme.space.md }}
        />
        <Button title="Value another property" variant="outline" size="large" onPress={handleValueAnother} />
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
    color: theme.color.danger,
    marginBottom: 16,
  },
  addressHeader: {
    marginBottom: theme.space.lg,
  },
  addressText: {
    ...theme.type.heading,
    color: theme.color.text,
  },
  valuationBlock: {
    alignItems: 'center',
    marginBottom: theme.space['2xl'],
  },
  estimateLabel: {
    ...theme.type.eyebrow,
    color: theme.color.textMuted,
    marginBottom: theme.space.sm,
  },
  valuationAmount: {
    ...theme.type.hero,
    color: theme.color.text,
    marginBottom: theme.space.sm,
  },
  rangeLine: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
    marginBottom: theme.space.lg,
  },
  rangeBarTrack: {
    width: '100%',
    height: theme.size.rangeBar,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.track,
  },
  rangeBarMarker: {
    position: 'absolute',
    top: -3,
    width: theme.size.rangeBar + 6,
    height: theme.size.rangeBar + 6,
    borderRadius: (theme.size.rangeBar + 6) / 2,
    backgroundColor: theme.color.accent,
    marginLeft: -(theme.size.rangeBar + 6) / 2,
  },
  summaryCard: {
    marginTop: theme.space.xl,
    marginBottom: theme.space['2xl'],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.space.sm,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.color.border,
  },
  summaryLabel: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
  },
  summaryValue: {
    ...theme.type.bodySm,
    fontFamily: theme.font.bodySemibold,
    color: theme.color.text,
  },
  sectionTitle: {
    ...theme.type.subheading,
    color: theme.color.text,
    marginBottom: theme.space.md,
  },
  comparableCard: {
    marginBottom: theme.space.md,
  },
  comparableAddress: {
    ...theme.type.bodySm,
    fontFamily: theme.font.bodySemibold,
    color: theme.color.text,
    marginBottom: theme.space.xs,
  },
  comparableMeta: {
    ...theme.type.caption,
    color: theme.color.textMuted,
    marginBottom: theme.space.sm,
  },
  comparablePrice: {
    ...theme.type.subheading,
    color: theme.color.text,
  },
  optinWash: {
    backgroundColor: theme.color.accentWash,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.lg + 2,
    marginTop: theme.space.lg,
  },
  optinTitle: {
    ...theme.type.label,
    color: theme.color.text,
    marginBottom: theme.space.xs,
  },
  optinText: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
  },
  actions: {
    marginTop: theme.space['2xl'],
    marginBottom: theme.space['2xl'],
  },
});
