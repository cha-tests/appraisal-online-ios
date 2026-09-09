import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PropertyMap } from '../../components/property/PropertyMap';
import { useReportStore } from '../../stores/report.store';
import { formatStreetLine, type ParsedAddress } from '../../utils/addressComponents';
import { theme } from '../../theme';

/**
 * "Confirm address" — step 1 of 3. Home already resolved the place (search +
 * Google Places details) and stashed it on currentProperty; this screen is
 * purely a review step before Property details, restyled from the old
 * address-entry.tsx / confirmation.tsx (which used to be the post-report
 * "All Done" screen — the flow now ends at Report instead, so that content
 * moved out and this route was repurposed for Confirm address instead).
 */
export default function ConfirmAddress() {
  const router = useRouter();
  const currentProperty = useReportStore((state) => state.currentProperty);

  useEffect(() => {
    // Reached directly (deep link, or a stale back-stack) with nothing to
    // confirm — send back to Home rather than rendering an empty screen.
    if (!currentProperty) {
      router.replace('/consumer/home');
    }
  }, [currentProperty, router]);

  if (!currentProperty) {
    return <SafeAreaWrapper>{null}</SafeAreaWrapper>;
  }

  const components = currentProperty.address_components ?? {};
  const parsed: ParsedAddress = {
    streetNumber: components.street_number,
    route: components.route,
    subpremise: components.unit,
    premise: components.building,
    barangay: components.barangay,
    city: components.city,
    province: components.province,
    stateCode: components.state_code,
    postalCode: components.postal_code,
    country: components.country,
    countryCode: components.country_code,
  };
  const imprecise = components.is_precise === false;
  const streetLine = formatStreetLine(parsed);
  const cityLine = [parsed.city, parsed.province].filter(Boolean).join(', ');

  return (
    <SafeAreaWrapper scrollable>
      <BackButton onPress={() => router.back()} />
      <ProgressBar progress={33} label="1 of 3" />

      <PropertyMap
        latitude={components.latitude}
        longitude={components.longitude}
        label={streetLine || currentProperty.address}
        description={cityLine}
      />

      <Text style={styles.address}>{streetLine || currentProperty.address}</Text>
      {!!cityLine && <Text style={styles.city}>{cityLine}</Text>}

      {imprecise && (
        <Card variant="outlined" style={styles.impreciseCard}>
          <Text style={styles.impreciseText}>
            This is a general location, not a numbered address — common for lots and raw land.
            Double-check the pin above before continuing.
          </Text>
        </Card>
      )}

      <View style={styles.footer}>
        <Button
          title="Yes, continue"
          size="large"
          onPress={() => router.push('/consumer/property-details')}
          style={{ marginBottom: theme.space.md }}
        />
        <Button title="Edit address" variant="outline" size="large" onPress={() => router.back()} />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  address: {
    ...theme.type.heading,
    color: theme.color.text,
    marginTop: theme.space.lg,
  },
  city: {
    ...theme.type.body,
    color: theme.color.textMuted,
    marginTop: theme.space.xs,
  },
  impreciseCard: {
    marginTop: theme.space.lg,
  },
  impreciseText: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  footer: {
    marginTop: theme.space['3xl'],
    marginBottom: theme.space['2xl'],
  },
});
