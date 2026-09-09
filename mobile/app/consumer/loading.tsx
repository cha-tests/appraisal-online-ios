import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { IconSpinner } from '../../components/ui/icons';
import { useReportStore } from '../../stores/report.store';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/report.service';
import { generateMockComparableSales } from '../../config/marketConfig';
import { hasAnonymousValuationsLeft, incrementAnonymousValuationCount } from '../../utils/anonymousQuota';
import { theme } from '../../theme';

const STEPS = [
  { label: 'Finding comparable sales', at: 0 },
  { label: 'Analyzing property details', at: 900 },
  { label: 'Generating your valuation', at: 1800 },
];
const PROGRESS_AT_STEP = [22, 58, 92];

export default function LoadingScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const currentProperty = useReportStore((state) => state.currentProperty);
  const currentPropertyDetails = useReportStore((state) => state.currentPropertyDetails);
  const setCurrentReport = useReportStore((state) => state.setCurrentReport);
  const setCurrentProperty = useReportStore((state) => state.setCurrentProperty);
  const setPendingValuation = useReportStore((state) => state.setPendingValuation);
  const setError = useReportStore((state) => state.setError);
  const setIsGenerating = useReportStore((state) => state.setIsGenerating);

  const [stepIndex, setStepIndex] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    const generateReport = async () => {
      try {
        if (!currentProperty || !currentPropertyDetails) {
          throw new Error('Missing required data');
        }

        setIsGenerating(true);

        // Signed-in consumers spend their real monthly allowance; a guest
        // hasn't got an account yet, so a lightweight per-device count
        // stands in until the sign-up gate creates one (see anonymousQuota.ts
        // for why this is a UX speed bump, not a security boundary).
        if (user?.id) {
          const allowance = await reportService.checkReportAllowance(user.id);
          if (!allowance.allowed) {
            setError('You\'ve reached your monthly free report limit');
            setIsGenerating(false);
            Alert.alert(
              'Monthly Limit Reached',
              'You\'ve used all 3 free reports this month. Your allowance resets next month.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
            return;
          }
        } else if (!(await hasAnonymousValuationsLeft())) {
          setError('Free valuation limit reached');
          setIsGenerating(false);
          Alert.alert(
            'Create an account to continue',
            'You\'ve used your free valuations on this device. Sign up for a free account to keep valuing properties.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }

        const fallbackComparables = generateMockComparableSales(
          currentPropertyDetails.square_feet,
          currentProperty.address_components?.country_code
        );

        const valuationResult = await reportService.generateValuation(
          currentPropertyDetails,
          currentProperty.address,
          fallbackComparables,
          currentProperty.address_components?.country_code
        );

        if (!valuationResult.success) {
          throw new Error('Failed to generate valuation');
        }

        const valuation = {
          estimatedValue: valuationResult.estimatedValue!,
          confidenceRange: valuationResult.confidenceRange!,
          comparables: valuationResult.comparables || fallbackComparables,
          geminiResponse: valuationResult.geminiResponse || {},
        };

        if (user?.id) {
          // Already has an account — persist immediately, same as before.
          const propertyResult = await reportService.createProperty(
            user.id,
            currentProperty.address,
            { address_components: currentProperty.address_components, ...currentPropertyDetails }
          );
          if (!propertyResult.success || !propertyResult.property) {
            throw new Error('Failed to create property record');
          }

          // currentProperty was set back on Home from just the resolved
          // address/coordinates — bedrooms, bathrooms, square footage etc.
          // weren't known yet, so it never carried them. Replace it with the
          // full DB row now that one exists, or report-view.tsx's PDF
          // download reads those fields as undefined and prints "N/A".
          setCurrentProperty(propertyResult.property);

          const reportResult = await reportService.createReport(
            user.id,
            propertyResult.property.id,
            valuation.estimatedValue,
            valuation.confidenceRange,
            valuation.comparables,
            valuation.geminiResponse
          );
          if (!reportResult.success || !reportResult.report) {
            throw new Error('Failed to create report');
          }

          reportService.deliverReportEmail(reportResult.report.id);
          setCurrentReport(reportResult.report);
          setIsGenerating(false);
          router.push('/consumer/report-view');
        } else {
          // No account yet — hold the result in memory and gate the report
          // behind signup instead of writing to properties/reports, both of
          // which have a NOT NULL user_id (see stores/report.store.ts's
          // PendingValuation and the gate in auth/signup.tsx).
          await incrementAnonymousValuationCount();
          setPendingValuation(valuation);
          setIsGenerating(false);
          router.push('/auth/signup');
        }
      } catch (err) {
        console.error('Error generating report:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate report');
        setIsGenerating(false);
        router.back();
      }
    };

    generateReport();

    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(() => setStepIndex(i + 1), step.at)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <IconSpinner size={40} />
        </Animated.View>

        <Text style={styles.message}>{STEPS[stepIndex].label}…</Text>

        <View style={styles.progressWrap}>
          <ProgressBar progress={PROGRESS_AT_STEP[stepIndex]} />
        </View>

        <View style={styles.stepList}>
          {STEPS.map((step, i) => (
            <Text
              key={step.label}
              style={[styles.stepText, i <= stepIndex && styles.stepTextDone]}
            >
              {step.label}
            </Text>
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
    paddingHorizontal: theme.space['2xl'],
  },
  message: {
    ...theme.type.subheading,
    color: theme.color.text,
    marginTop: theme.space.xl,
    textAlign: 'center',
  },
  progressWrap: {
    width: '100%',
    marginTop: theme.space['2xl'],
  },
  stepList: {
    marginTop: theme.space.lg,
    gap: theme.space.sm,
    alignItems: 'center',
  },
  stepText: {
    ...theme.type.meta,
    color: theme.color.textFaint,
  },
  stepTextDone: {
    color: theme.color.textMuted,
  },
});
