import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { useReportStore } from '../../stores/report.store';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/report.service';

const LOADING_MESSAGES = [
  'Analyzing property details...',
  'Searching for comparable sales...',
  'Generating AI valuation...',
  'Compiling report...',
  'Almost done...',
];

export default function LoadingScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const currentProperty = useReportStore((state) => state.currentProperty);
  const currentPropertyDetails = useReportStore((state) => state.currentPropertyDetails);
  const setCurrentReport = useReportStore((state) => state.setCurrentReport);
  const setError = useReportStore((state) => state.setError);
  const setIsGenerating = useReportStore((state) => state.setIsGenerating);

  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const generateReport = async () => {
      try {
        if (!user?.id || !currentProperty || !currentPropertyDetails) {
          throw new Error('Missing required data');
        }

        setIsGenerating(true);

        // Check free report allowance
        const allowance = await reportService.checkReportAllowance(user.id);
        if (!allowance.allowed) {
          // There is no consumer paywall/upgrade screen yet — payments for
          // consumers are intentionally deferred for the initial launch (see
          // broker/paywall.tsx for the analogous broker flow, which does have
          // Stripe wired up). Until a consumer paywall exists, the limit is
          // surfaced as an alert rather than routed to a screen that isn't
          // built, which previously produced an "Unmatched Route" crash.
          setError('You\'ve reached your monthly free report limit');
          setIsGenerating(false);
          Alert.alert(
            'Monthly Limit Reached',
            'You\'ve used all 3 free reports this month. Your allowance resets next month.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }

        // Create property record
        const propertyResult = await reportService.createProperty(
          user.id,
          currentProperty.address,
          {
            address_components: currentProperty.address_components,
            ...currentPropertyDetails,
          }
        );

        if (!propertyResult.success) {
          throw new Error('Failed to create property record');
        }

        // Generate AI valuation (mock comparables for now)
        // sale_price is stored in cents — every screen that renders a
        // comparable (report-view.tsx, lead-detail.tsx) divides by 100, the
        // same convention report.estimated_value and subscriptions.price
        // already use. These were previously plain dollar amounts (e.g.
        // 725000 for $725,000), which displayed as $7,250 everywhere.
        const mockComparables = [
          {
            address: '456 Oak Ave',
            sale_price: 72500000,
            sale_date: '2026-05-15',
            distance_miles: 0.3,
            similarity_score: 0.95,
          },
          {
            address: '789 Elm St',
            sale_price: 69500000,
            sale_date: '2026-04-20',
            distance_miles: 0.5,
            similarity_score: 0.88,
          },
          {
            address: '321 Pine Rd',
            sale_price: 75000000,
            sale_date: '2026-03-10',
            distance_miles: 0.7,
            similarity_score: 0.82,
          },
        ];

        const valuationResult = await reportService.generateValuation(
          currentPropertyDetails,
          currentProperty.address,
          mockComparables,
          currentProperty.address_components?.country_code
        );

        if (!valuationResult.success) {
          throw new Error('Failed to generate valuation');
        }

        // Create report record
        const reportResult = await reportService.createReport(
          user.id,
          propertyResult.property.id,
          valuationResult.estimatedValue!,
          valuationResult.confidenceRange!,
          mockComparables,
          valuationResult.geminiResponse || {}
        );

        if (!reportResult.success) {
          throw new Error('Failed to create report');
        }

        setCurrentReport(reportResult.report);
        setIsGenerating(false);
        router.push('/consumer/report-view');
      } catch (err) {
        console.error('Error generating report:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate report');
        setIsGenerating(false);
        router.back();
      }
    };

    generateReport();

    // Cycle through loading messages
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(messageTimer);
  }, []);

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.message}>{LOADING_MESSAGES[messageIndex]}</Text>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: messageIndex % 3 === i ? 1 : 0.3,
                },
              ]}
            />
          ))}
        </View>
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
  message: {
    marginTop: 24,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
});
