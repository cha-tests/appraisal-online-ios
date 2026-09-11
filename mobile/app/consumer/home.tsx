import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput as RNTextInput,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CurrencyValue } from '../../components/ui/CurrencyValue';
import { IconSearch, IconUser, IconPin, IconTrendUp } from '../../components/ui/icons';
import { useAuthStore } from '../../stores/auth.store';
import { useReportStore } from '../../stores/report.store';
import { reportService } from '../../services/report.service';
import { AUTOCOMPLETE_COUNTRIES, PHONE_COUNTRIES } from '../../config/marketConfig';
import { parseAddressComponents, isPreciseAddress, isPlusCode } from '../../utils/addressComponents';
import { shortAddressLabel } from '../../utils/addressComponents';
import { supabase } from '../../services/supabase';
import { getAnonymousValuationCount, ANONYMOUS_VALUATION_LIMIT } from '../../utils/anonymousQuota';
import { Report } from '../../types';
import { theme, card, pill } from '../../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Country options for the selector, in AUTOCOMPLETE_COUNTRIES' order (PH
// first — see PHONE_COUNTRIES) rather than PHONE_COUNTRIES' full list, which
// also includes AE/CA/DE that aren't wired into the autocomplete filter.
const COUNTRY_OPTIONS = AUTOCOMPLETE_COUNTRIES.map(
  (code) => PHONE_COUNTRIES.find((c) => c.code === code)!
);

/**
 * Narrowing the search to one country (rather than always searching all of
 * AUTOCOMPLETE_COUNTRIES at once) means a "Main Street" query in the
 * Philippines doesn't have to compete with every "Main Street" in the US,
 * Australia, the UK, and Singapore for the top few suggestion slots.
 */
function componentsFilterFor(country: string | null): string {
  const countries = country ? [country] : AUTOCOMPLETE_COUNTRIES;
  return countries.map((code) => `country:${code}`).join('|');
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token}` };
}

interface PlacesPrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text?: string;
}

function monthDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConsumerHome() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearReport = useReportStore((state) => state.clear);
  const setCurrentProperty = useReportStore((state) => state.setCurrentProperty);
  const setCurrentReport = useReportStore((state) => state.setCurrentReport);

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacesPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [plusCodeModalVisible, setPlusCodeModalVisible] = useState(false);
  // null = search across all AUTOCOMPLETE_COUNTRIES at once (the prior
  // behavior); picking one narrows results to just that country.
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id) {
      reportService.checkReportAllowance(user.id).then(({ remaining }) => setRemaining(remaining));
      reportService.getUserReports(user.id, 5).then(({ success, reports }) => {
        if (success && reports) setReports(reports);
      });
    } else {
      getAnonymousValuationCount().then((used) => setRemaining(Math.max(ANONYMOUS_VALUATION_LIMIT - used, 0)));
    }
  }, [user?.id]);

  const fetchPredictions = useCallback(async (input: string, country: string | null) => {
    if (!input || input.length < 2) {
      setPredictions([]);
      return;
    }

    try {
      setSearching(true);
      setSearchError('');

      const componentsFilter = componentsFilterFor(country);
      const response = Platform.OS === 'web'
        ? await axios.get(`${API_URL}/api/places/autocomplete`, {
            params: { input, components: componentsFilter },
            headers: await authHeaders(),
          })
        : await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
              input,
              key: GOOGLE_PLACES_API_KEY,
              // See componentsFilterFor above for why 'address' was dropped
              // in favor of 'geocode'.
              types: 'geocode',
              components: componentsFilter,
            },
          });

      const status = response.data.status;
      if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
        console.error('Places autocomplete failed:', status, response.data.error_message);
        setSearchError(
          status === 'REQUEST_DENIED'
            ? 'Address lookup is not configured correctly. Please contact support.'
            : 'Unable to fetch addresses. Please try again.'
        );
        setPredictions([]);
        return;
      }

      const results: PlacesPrediction[] = (response.data.predictions ?? []).map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
        main_text: p.structured_formatting?.main_text ?? p.description,
        secondary_text: p.structured_formatting?.secondary_text,
      }));

      setPredictions(results);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setSearchError('Unable to fetch addresses. Please try again.');
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelectPrediction = async (prediction: PlacesPrediction) => {
    if (remaining !== null && remaining <= 0) {
      Alert.alert('Monthly limit reached', "You've used all your free valuations this month. Upgrade to continue valuing properties.");
      return;
    }

    setPredictions([]);
    setSearchError('');
    setResolving(true);
    // Starting a new valuation resets the draft first — otherwise a saved
    // property's rooms/rate leak into this one (see report.store.ts's clear).
    clearReport();

    try {
      const detailResponse = Platform.OS === 'web'
        ? await axios.get(`${API_URL}/api/places/details`, {
            params: { place_id: prediction.place_id },
            headers: await authHeaders(),
          })
        : await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params: {
              place_id: prediction.place_id,
              key: GOOGLE_PLACES_API_KEY,
              fields: 'geometry,formatted_address,address_components',
            },
          });

      const status = detailResponse.data.status;
      const result = detailResponse.data.result;
      if ((status && status !== 'OK') || !result) {
        console.error('Place details failed:', status, detailResponse.data.error_message);
        setSearchError('Could not look up that address. Please pick another.');
        return;
      }

      const { geometry, address_components, formatted_address } = result;
      const parsedAddress = parseAddressComponents(address_components);
      const canonical = formatted_address ?? prediction.description;
      const lat = geometry?.location?.lat;
      const lng = geometry?.location?.lng;
      const precise = isPreciseAddress(parsedAddress) || isPlusCode(prediction.description);

      setCurrentProperty({
        id: prediction.place_id,
        user_id: '',
        address: canonical,
        address_components: {
          latitude: lat,
          longitude: lng,
          street_number: parsedAddress.streetNumber,
          route: parsedAddress.route,
          unit: parsedAddress.subpremise,
          building: parsedAddress.premise,
          barangay: parsedAddress.barangay,
          city: parsedAddress.city,
          province: parsedAddress.province,
          state_code: parsedAddress.stateCode,
          postal_code: parsedAddress.postalCode,
          country: parsedAddress.country,
          country_code: parsedAddress.countryCode,
          is_precise: precise,
          components: address_components,
        },
        created_at: new Date().toISOString(),
      });

      setQuery('');
      router.push('/consumer/confirmation');
    } catch (err) {
      console.error('Error fetching place details:', err);
      setSearchError('Could not look up that address. Please check your connection.');
    } finally {
      setResolving(false);
    }
  };

  const handleOpenReport = async (report: Report) => {
    try {
      setOpeningReportId(report.id);
      const { success, property } = await reportService.getProperty(report.property_id);
      setCurrentReport(report);
      setCurrentProperty(success && property ? property : null);
      router.push('/consumer/report-view');
    } catch (err) {
      console.error('Error opening report:', err);
    } finally {
      setOpeningReportId(null);
    }
  };

  const freeLeftLabel = remaining === null ? '…' : `${remaining} free left`;

  return (
    <SafeAreaWrapper scrollable contentContainerStyle={{ paddingTop: theme.space['4xl'] }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>Appraisal Online</Text>
        <View style={styles.headerRight}>
          <View style={styles.freePill}>
            <Text style={styles.freePillText}>{freeLeftLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push(user ? '/consumer/account' : '/auth/login')}
            activeOpacity={0.7}
          >
            <IconUser size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>Value a property</Text>

      {/* Country selector — narrows the address search to one country
          instead of always matching against all five at once (see
          componentsFilterFor above). Placed above the search field since it
          scopes what that field searches. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.countryRow}
        contentContainerStyle={styles.countryRowContent}
      >
        <TouchableOpacity
          style={[pill.base, !selectedCountry ? pill.on : pill.off]}
          onPress={() => {
            setSelectedCountry(null);
            if (query.length >= 2) fetchPredictions(query, null);
          }}
        >
          <Text style={!selectedCountry ? pill.textOn : pill.textOff}>All</Text>
        </TouchableOpacity>
        {COUNTRY_OPTIONS.map((country) => {
          const active = selectedCountry === country.code;
          return (
            <TouchableOpacity
              key={country.code}
              style={[pill.base, active ? pill.on : pill.off]}
              onPress={() => {
                setSelectedCountry(country.code);
                if (query.length >= 2) fetchPredictions(query, country.code);
              }}
            >
              <Text style={active ? pill.textOn : pill.textOff}>
                {country.flag} {country.code}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search field */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchIcon}>
          <IconSearch size={19} color={theme.color.textMuted} />
        </View>
        <RNTextInput
          style={styles.searchInput}
          placeholder="Enter an address"
          placeholderTextColor={theme.color.textFaint}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            fetchPredictions(text, selectedCountry);
          }}
        />
        {(searching || resolving) && (
          <ActivityIndicator style={styles.searchSpinner} color={theme.color.text} />
        )}

        {predictions.length > 0 && (
          <Card variant="elevated" style={styles.suggestions}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
              {predictions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectPrediction(item)}
                  activeOpacity={0.7}
                >
                  <IconPin size={17} color={theme.color.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionMain}>{item.main_text}</Text>
                    {!!item.secondary_text && (
                      <Text style={styles.suggestionSecondary}>{item.secondary_text}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}
      </View>

      {!!searchError && <Text style={styles.errorText}>{searchError}</Text>}

      <Text style={styles.plusCodeHint}>
        Can't find it?{' '}
        <Text style={styles.plusCodeLink} onPress={() => setPlusCodeModalVisible(true)}>
          Try a Plus Code
        </Text>
      </Text>

      {/* Your properties */}
      {user && reports.length > 0 && (
        <>
          <Text style={styles.eyebrow}>Your properties</Text>
          {reports.map((report) => {
            const propertyComponents = (report as any).property?.address_components as
              | Record<string, any>
              | undefined;
            const address = (report as any).property?.address as string | undefined;
            const city = propertyComponents?.city as string | undefined;
            const countryCode = propertyComponents?.country_code as string | undefined;
            return (
              <TouchableOpacity
                key={report.id}
                style={styles.propertyCard}
                onPress={() => handleOpenReport(report)}
                activeOpacity={0.7}
                disabled={openingReportId === report.id}
              >
                <View style={styles.propertyCardRow}>
                  <Text style={styles.propertyAddress} numberOfLines={1}>
                    {address ? shortAddressLabel(address, propertyComponents as any) : 'Property'}
                  </Text>
                  {openingReportId === report.id ? (
                    <ActivityIndicator color={theme.color.text} />
                  ) : (
                    <CurrencyValue
                      amountMinorUnits={report.estimated_value}
                      countryCode={countryCode}
                      style={styles.propertyValue}
                    />
                  )}
                </View>
                <Text style={styles.propertyMeta}>
                  {[city, `valued ${monthDay(report.created_at)}`].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Market strip — illustrative copy, not live market data (no market-
          trend feed is wired up yet). */}
      <View style={styles.marketStrip}>
        <IconTrendUp size={16} />
        <Text style={styles.marketStripText}>Home values have been trending up this quarter</Text>
      </View>

      {/* Plus Code helper modal — carried over from the old address-entry
          screen so the affordance isn't lost now that search lives here. */}
      <Modal
        visible={plusCodeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPlusCodeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finding a Plus Code</Text>
            <View style={styles.modalSteps}>
              <Text style={styles.modalStep}>1. Open Google Maps and find the property's location.</Text>
              <Text style={styles.modalStep}>2. Press and hold the exact spot to drop a pin.</Text>
              <Text style={styles.modalStep}>3. The Plus Code appears above the pin, e.g. "7QQ3+8Q9".</Text>
              <Text style={styles.modalStep}>4. Type that code into the search above — adding the city helps too.</Text>
            </View>
            <Button title="Got it" onPress={() => setPlusCodeModalVisible(false)} />
          </Card>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space['2xl'] + 2,
  },
  wordmark: {
    ...theme.type.subheading,
    color: theme.color.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  freePill: {
    borderWidth: 1,
    borderColor: theme.color.text,
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: theme.space.md,
  },
  freePillText: {
    ...theme.type.eyebrow,
    color: theme.color.text,
    textTransform: 'none',
    letterSpacing: 0,
  },
  avatar: {
    width: theme.size.avatarSm,
    height: theme.size.avatarSm,
    borderRadius: theme.size.avatarSm / 2,
    borderWidth: 1,
    borderColor: theme.color.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...theme.type.title,
    color: theme.color.text,
    marginBottom: theme.space.xl - 2,
  },
  countryRow: {
    marginBottom: theme.space.md,
  },
  countryRowContent: {
    flexDirection: 'row',
    gap: theme.space.sm,
    paddingRight: theme.space.lg,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 20,
    elevation: 20,
  },
  searchIcon: {
    position: 'absolute',
    left: 18,
    top: 20,
    zIndex: 1,
  },
  searchInput: {
    minHeight: theme.size.field,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    paddingLeft: 46,
    paddingRight: theme.space.lg,
    fontFamily: theme.font.body,
    fontSize: theme.type.body.fontSize,
    color: theme.color.text,
  },
  searchSpinner: {
    position: 'absolute',
    right: 18,
    top: 20,
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: theme.space.sm,
    padding: theme.space.xs,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm + 2,
    paddingVertical: theme.space.md - 2,
    paddingHorizontal: theme.space.sm + 2,
    borderRadius: theme.radius.md - 2,
  },
  suggestionMain: {
    ...theme.type.bodySm,
    fontFamily: theme.font.bodySemibold,
    color: theme.color.text,
  },
  suggestionSecondary: {
    ...theme.type.meta,
    color: theme.color.textMuted,
  },
  errorText: {
    ...theme.type.meta,
    color: theme.color.danger,
    marginTop: theme.space.sm,
  },
  plusCodeHint: {
    ...theme.type.meta,
    color: theme.color.textMuted,
    marginTop: theme.space.md,
  },
  plusCodeLink: {
    color: theme.color.text,
    fontFamily: theme.font.bodySemibold,
    textDecorationLine: 'underline',
  },
  eyebrow: {
    ...theme.type.eyebrow,
    color: theme.color.textMuted,
    marginTop: theme.space['2xl'],
    marginBottom: theme.space.md,
  },
  propertyCard: {
    ...card.base,
    marginBottom: theme.space.md,
  },
  propertyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: theme.space.sm,
  },
  propertyAddress: {
    ...theme.type.bodySm,
    fontFamily: theme.font.bodySemibold,
    color: theme.color.text,
    flex: 1,
  },
  propertyValue: {
    ...theme.type.subheading,
    fontFamily: theme.font.heading,
    color: theme.color.text,
  },
  propertyMeta: {
    ...theme.type.caption,
    color: theme.color.textMuted,
    marginTop: theme.space.xs,
  },
  marketStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    backgroundColor: theme.color.accentWash,
    borderRadius: theme.radius.full,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg + 2,
    marginTop: theme.space['2xl'],
  },
  marketStripText: {
    ...theme.type.bodySm,
    color: theme.color.text,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(22, 24, 29, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space['2xl'],
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    ...theme.type.subheading,
    color: theme.color.text,
    marginBottom: theme.space.lg,
    textAlign: 'center',
  },
  modalSteps: {
    marginBottom: theme.space.xl,
    gap: theme.space.sm,
  },
  modalStep: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
  },
});
