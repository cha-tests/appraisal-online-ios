import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useReportStore } from '../../stores/report.store';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

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
            types: ['address'],
            components: 'country:us|country:ph', // US & Philippines
          },
        }
      );

      if (response.data.predictions) {
        setPredictions(response.data.predictions);
      }
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setLocalError('Unable to fetch addresses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle address selection
  const handleSelectAddress = async (prediction: PlacesPrediction) => {
    setSelectedAddress(prediction.description);
    setAddress(prediction.description);
    setPredictions([]);

    // Optionally fetch detailed place info
    try {
      const detailResponse = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: prediction.place_id,
            key: GOOGLE_PLACES_API_KEY,
            fields: ['geometry', 'formatted_address', 'address_components'],
          },
        }
      );

      if (detailResponse.data.result) {
        const { geometry, address_components } = detailResponse.data.result;

        // Store address components for later use
        setCurrentProperty({
          id: prediction.place_id,
          user_id: '',
          address: detailResponse.data.result.formatted_address,
          address_components: {
            latitude: geometry?.location?.lat,
            longitude: geometry?.location?.lng,
            components: address_components,
          },
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error fetching place details:', err);
      setCurrentProperty({
        id: prediction.place_id,
        user_id: '',
        address: prediction.description,
        created_at: new Date().toISOString(),
      });
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
