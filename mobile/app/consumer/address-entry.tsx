import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useReportStore } from '../../stores/report.store';
import {
  parseAddressComponents,
  isPreciseAddress,
  formatStreetLine,
  type ParsedAddress,
} from '../../utils/addressComponents';
import { PropertyMap } from '../../components/property/PropertyMap';
import { AUTOCOMPLETE_COUNTRIES } from '../../config/marketConfig';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Google's country restriction filter is capped at 5 entries — see the
// comment on AUTOCOMPLETE_COUNTRIES for what happens past that.
const COMPONENTS_FILTER = AUTOCOMPLETE_COUNTRIES.map((code) => `country:${code}`).join('|');

interface PlacesPrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text?: string;
}

export default function AddressEntry() {
  const router = useRouter();
  const setCurrentProperty = useReportStore((state) => state.setCurrentProperty);
  const setError = useReportStore((state) => state.setError);

  const [address, setAddress] = useState('');
  const [predictions, setPredictions] = useState<PlacesPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [error, setLocalError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [parsed, setParsed] = useState<ParsedAddress | null>(null);
  const [imprecise, setImprecise] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  // Debounced Google Places autocomplete
  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      return;
    }

    try {
      setLoading(true);
      setLocalError('');

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        {
          params: {
            input,
            key: GOOGLE_PLACES_API_KEY,
            // Must be a plain string. Axios serialises an array as
            // `types[]=address`, which Google does not recognise.
            types: 'address',
            components: COMPONENTS_FILTER,
          },
        }
      );

      // Google signals problems in a `status` field with HTTP 200, so an
      // error here is invisible unless we check it explicitly. Without this,
      // a denied API key looks identical to "no matches found".
      const status = response.data.status;
      if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
        console.error('Places autocomplete failed:', status, response.data.error_message);
        setLocalError(
          status === 'REQUEST_DENIED'
            ? 'Address lookup is not configured correctly. Please contact support.'
            : 'Unable to fetch addresses. Please try again.'
        );
        setPredictions([]);
        return;
      }

      // Google nests the display strings under `structured_formatting`; there
      // is no top-level main_text/secondary_text. Map them into our own shape
      // here so the list has something to render.
      const results: PlacesPrediction[] = (response.data.predictions ?? []).map(
        (p: any) => ({
          place_id: p.place_id,
          description: p.description,
          main_text: p.structured_formatting?.main_text ?? p.description,
          secondary_text: p.structured_formatting?.secondary_text,
        })
      );

      setPredictions(results);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setLocalError('Unable to fetch addresses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle address selection
  const handleSelectAddress = async (prediction: PlacesPrediction) => {
    setPredictions([]);
    setLocalError('');
    setImprecise(false);
    setParsed(null);
    setSelectedAddress('');
    setCoords(null);
    setResolving(true);

    try {
      const detailResponse = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: prediction.place_id,
            key: GOOGLE_PLACES_API_KEY,
            // Comma-separated string, not an array: axios would send
            // `fields[]=geometry&...`, which Google ignores — and an ignored
            // fields param means being billed for every field group rather
            // than just these three.
            fields: 'geometry,formatted_address,address_components',
          },
        }
      );

      const status = detailResponse.data.status;
      if (status && status !== 'OK') {
        console.error('Place details failed:', status, detailResponse.data.error_message);
        setLocalError('Could not look up that address. Please pick another.');
        return;
      }

      const result = detailResponse.data.result;
      if (!result) {
        setLocalError('Could not look up that address. Please pick another.');
        return;
      }

      const { geometry, address_components, formatted_address } = result;
      const parsedAddress = parseAddressComponents(address_components);

      // Prefer Google's canonical formatted_address over the autocomplete
      // description — it is the resolved address for the place, including the
      // house number and postal code.
      const canonical = formatted_address ?? prediction.description;

      setParsed(parsedAddress);
      setAddress(canonical);
      setSelectedAddress(canonical);

      const lat = geometry?.location?.lat;
      const lng = geometry?.location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        setCoords({ latitude: lat, longitude: lng });
      }

      // A bare street or district cannot be valued. Flag it rather than
      // silently letting the user proceed with an unappraisable address.
      const precise = isPreciseAddress(parsedAddress);
      setImprecise(!precise);

      setCurrentProperty({
        id: prediction.place_id,
        user_id: '',
        address: canonical,
        address_components: {
          latitude: geometry?.location?.lat,
          longitude: geometry?.location?.lng,
          // Named fields, so downstream consumers (valuation prompt, PDF,
          // lead routing) do not each have to re-walk Google's raw array.
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
          // Keep the original array too — cheap, and useful if a field is
          // needed later that the parser does not surface.
          components: address_components,
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error fetching place details:', err);
      setLocalError('Could not look up that address. Please check your connection.');
    } finally {
      setResolving(false);
    }
  };

  const handleContinue = () => {
    if (!selectedAddress) {
      setLocalError('Please select a valid address');
      return;
    }
    router.push('/consumer/property-details');
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Where is the property?</Text>
        <Text style={styles.subtitle}>Start by entering the address of the property you want to value</Text>
      </View>

      {/* Address Input */}
      <TextInput
        label="Property Address"
        placeholder="e.g., 123 Main St, San Francisco, CA"
        value={address}
        onChangeText={(text) => {
          setAddress(text);
          // Editing the text invalidates any previous pick. Without this the
          // screen would keep the old selection and let the user continue with
          // an address that no longer matches what the field shows.
          if (selectedAddress && text !== selectedAddress) {
            setSelectedAddress('');
            setParsed(null);
            setImprecise(false);
            setCoords(null);
          }
          fetchPredictions(text);
        }}
        error={error}
      />

      {/* Predictions List */}
      {predictions.length > 0 && (
        <Card variant="elevated" style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.predictionItem}
                onPress={() => handleSelectAddress(item)}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={styles.predictionMain}>{item.main_text}</Text>
                  {item.secondary_text && (
                    <Text style={styles.predictionSecondary}>{item.secondary_text}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.place_id}
            scrollEnabled={false}
          />
          {loading && <ActivityIndicator color="#2563EB" style={{ marginTop: 12 }} />}
        </Card>
      )}

      {resolving && (
        <View style={styles.resolvingRow}>
          <ActivityIndicator color="#2563EB" />
          <Text style={styles.resolvingText}>Looking up exact address…</Text>
        </View>
      )}

      {/* Resolved address confirmation — shows exactly what Google matched, so
          the user can verify the house number before continuing. */}
      {parsed && !resolving && (
        <Card
          variant="elevated"
          style={imprecise ? styles.confirmCardWarning : styles.confirmCard}
        >
          <Text style={styles.confirmHeading}>
            {imprecise ? '⚠️ No specific property number' : '✓ Property found'}
          </Text>

          {!!formatStreetLine(parsed) && (
            <Text style={styles.confirmStreet}>{formatStreetLine(parsed)}</Text>
          )}

          <View style={styles.confirmRows}>
            {parsed.barangay && (
              <Text style={styles.confirmRow}>Barangay: {parsed.barangay}</Text>
            )}
            {parsed.city && <Text style={styles.confirmRow}>City: {parsed.city}</Text>}
            {parsed.province && (
              <Text style={styles.confirmRow}>
                {parsed.countryCode === 'US' ? 'State' : 'Province'}: {parsed.province}
              </Text>
            )}
            {parsed.postalCode && (
              <Text style={styles.confirmRow}>Postal code: {parsed.postalCode}</Text>
            )}
          </View>

          {imprecise && (
            <Text style={styles.confirmWarning}>
              This looks like a street or area rather than one property. For an accurate
              valuation, add the house or unit number if you have it.
            </Text>
          )}
        </Card>
      )}

      {/* Pinned location. Lets the user confirm visually that the resolved
          address is the property they meant — a wrong-but-plausible match is
          otherwise easy to miss when reading text alone. */}
      {parsed && coords && !resolving && (
        <>
          <Text style={styles.mapHeading}>Pinned location</Text>
          <PropertyMap
            latitude={coords.latitude}
            longitude={coords.longitude}
            label={formatStreetLine(parsed) || selectedAddress}
            description={[parsed.city, parsed.province].filter(Boolean).join(', ')}
          />
          <Text style={styles.mapHint}>
            Check the pin sits on your property. If it looks wrong, refine the address above.
          </Text>
        </>
      )}

      {error && <Text style={styles.errorMessage}>{error}</Text>}

      {/* Info Cards */}
      <View style={styles.infoCards}>
        <Card variant="outlined">
          <Text style={styles.infoTitle}>💡 Tip</Text>
          <Text style={styles.infoText}>
            Make sure to include the full street address, city, and state/region for best results.
          </Text>
        </Card>
      </View>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          size="large"
          onPress={handleContinue}
          disabled={!selectedAddress}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Back"
          variant="outline"
          size="large"
          onPress={() => router.back()}
        />
      </View>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  predictionsContainer: {
    marginBottom: 16,
    maxHeight: 300,
  },
  predictionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  predictionMain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  predictionSecondary: {
    fontSize: 14,
    color: '#6B7280',
  },
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resolvingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 10,
  },
  confirmCard: {
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
  },
  confirmCardWarning: {
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
  },
  confirmHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  confirmStreet: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  confirmRows: {
    gap: 3,
  },
  confirmRow: {
    fontSize: 13,
    color: '#6B7280',
  },
  confirmWarning: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    marginTop: 10,
  },
  mapHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  mapHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 17,
  },
  infoCards: {
    marginBottom: 24,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 24,
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: -12,
    marginBottom: 12,
  },
});
