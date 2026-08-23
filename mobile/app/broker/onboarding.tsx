import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { useAuthStore } from '../../stores/auth.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { brokerService } from '../../services/broker.service';
import { BrokerTier, City } from '../../types';

const TIERS: BrokerTier[] = ['Founder Lifetime', 'Premium Annual', 'Basic Annual'];
const TIER_DETAILS = {
  'Founder Lifetime': { cities: 25, price: '$499 one-time', refund: '14 days' },
  'Premium Annual': { cities: 10, price: '$199/year', refund: '30 days' },
  'Basic Annual': { cities: 1, price: '$49/year', refund: '30 days' },
};

export default function BrokerOnboarding() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setSelectedTier = useSubscriptionStore((state) => state.setSelectedTier);
  const setSelectedCities = useSubscriptionStore((state) => state.setSelectedCities);

  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    company_name: '',
    license_number: '',
    phone: '',
    website: '',
    tier: 'Premium Annual' as BrokerTier,
    selectedCities: [] as string[],
    emailEnabled: true,
    pushEnabled: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoadingCities(true);
        const { success, cities: fetchedCities } = await brokerService.getCities();
        if (success && fetchedCities) {
          setCities(fetchedCities);
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
      } finally {
        setLoadingCities(false);
      }
    };

    if (step === 3) {
      fetchCities();
    }
  }, [step]);

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required';
      if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    } else if (stepNum === 3) {
      if (formData.selectedCities.length === 0) {
        newErrors.cities = 'Select at least one city';
      }
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    setStep(step - 1);
  };

  const handleCityToggle = async (cityId: string) => {
    const currentCities = formData.selectedCities;
    const tierLimit = TIER_DETAILS[formData.tier].cities;

    if (currentCities.includes(cityId)) {
      // Remove city
      setFormData((prev) => ({
        ...prev,
        selectedCities: prev.selectedCities.filter((c) => c !== cityId),
      }));
    } else {
      // Check tier limit
      if (currentCities.length >= tierLimit) {
        setError(`${formData.tier} allows up to ${tierLimit} ${tierLimit === 1 ? 'city' : 'cities'}`);
        return;
      }

      // Check founder capacity (Lifetime only)
      if (formData.tier === 'Founder Lifetime') {
        const { available } = await brokerService.checkFounderCapacity(cityId);
        if (!available) {
          setError('This city has reached the maximum Founder members. Choose another.');
          return;
        }
      }

      setError('');
      setFormData((prev) => ({
        ...prev,
        selectedCities: [...prev.selectedCities, cityId],
      }));
    }
  };

  const handleSubmit = async () => {
    if (validateStep(4)) {
      try {
        // Save selections to Zustand
        setSelectedTier(formData.tier);
        setSelectedCities(formData.selectedCities);

        // Create broker profile if needed
        const { profile } = await brokerService.getProfile(user?.id || '');
        if (!profile) {
          await brokerService.createProfile(
            user?.id || '',
            formData.company_name,
            formData.license_number,
            formData.phone,
            formData.website
          );
        }

        router.push('/broker/value-reveal');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tell Us About Your Business</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(step / 4) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.stepIndicator}>
          Step {step} of 4
        </Text>
      </View>

      {/* Step 1: Company Info */}
      {step === 1 && (
        <View>
          <Text style={styles.sectionTitle}>Your Information</Text>

          <TextInput
            label="Company Name"
            placeholder="e.g., Smith & Associates Realty"
            value={formData.company_name}
            onChangeText={(val) => setFormData((prev) => ({ ...prev, company_name: val }))}
            error={formErrors.company_name}
          />

          <TextInput
            label="Real Estate License # (Optional)"
            placeholder="Your license number"
            value={formData.license_number}
            onChangeText={(val) => setFormData((prev) => ({ ...prev, license_number: val }))}
          />

          <TextInput
            label="Phone Number"
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
            error={formErrors.phone}
          />

          <TextInput
            label="Website (Optional)"
            placeholder="https://yoursite.com"
            value={formData.website}
            onChangeText={(val) => setFormData((prev) => ({ ...prev, website: val }))}
          />
        </View>
      )}

      {/* Step 2: Tier Selection */}
      {step === 2 && (
        <View>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>
          <Text style={styles.stepDescription}>
            Select the membership tier that fits your business needs
          </Text>

          {TIERS.map((tier) => (
            <TouchableOpacity
              key={tier}
              style={[styles.tierCard, formData.tier === tier && styles.tierCardActive]}
              onPress={() => {
                setFormData((prev) => ({ ...prev, tier }));
                setFormErrors({});
              }}
            >
              <View style={styles.tierHeader}>
                <Text style={styles.tierName}>{tier}</Text>
                <Text style={styles.tierPrice}>{TIER_DETAILS[tier].price}</Text>
              </View>

              <View style={styles.tierFeatures}>
                <Text style={styles.tierFeature}>
                  📍 Up to {TIER_DETAILS[tier].cities} {TIER_DETAILS[tier].cities === 1 ? 'city' : 'cities'}
                </Text>
                <Text style={styles.tierFeature}>
                  💬 {tier.includes('Founder') || tier.includes('Premium') ? 'Real-time' : 'Weekly'} leads
                </Text>
                <Text style={styles.tierFeature}>
                  💰 {TIER_DETAILS[tier].refund} money-back guarantee
                </Text>
              </View>

              <View
                style={[
                  styles.tierRadio,
                  formData.tier === tier && styles.tierRadioActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Step 3: City Selection */}
      {step === 3 && (
        <View>
          <Text style={styles.sectionTitle}>Select Your Cities</Text>
          <Text style={styles.stepDescription}>
            Choose up to {TIER_DETAILS[formData.tier].cities} {TIER_DETAILS[formData.tier].cities === 1 ? 'city' : 'cities'} for lead coverage
          </Text>

          {error && <Text style={styles.errorMessage}>{error}</Text>}

          {loadingCities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#2563EB" />
            </View>
          ) : (
            <FlatList
              data={cities}
              renderItem={({ item }) => {
                const isSelected = formData.selectedCities.includes(item.id);
                const isFull = item.founder_count_lifetime >= 30 && formData.tier === 'Founder Lifetime';

                return (
                  <TouchableOpacity
                    style={[
                      styles.cityItem,
                      isSelected && styles.cityItemSelected,
                      isFull && formData.tier === 'Founder Lifetime' && styles.cityItemDisabled,
                    ]}
                    onPress={() => handleCityToggle(item.id)}
                    disabled={isFull && formData.tier === 'Founder Lifetime'}
                  >
                    <View style={styles.cityItemContent}>
                      <Text style={[styles.cityItemName, isSelected && styles.cityItemNameSelected]}>
                        {item.name}{item.state ? `, ${item.state}` : ''}
                      </Text>
                      {formData.tier === 'Founder Lifetime' && (
                        <Text style={styles.cityItemCapacity}>
                          {item.founder_count_lifetime}/30 founders
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.cityCheckbox,
                        isSelected && styles.cityCheckboxActive,
                        isFull && styles.cityCheckboxDisabled,
                      ]}
                    >
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}

          <Text style={styles.cityCount}>
            Selected: {formData.selectedCities.length} of {TIER_DETAILS[formData.tier].cities}
          </Text>
        </View>
      )}

      {/* Step 4: Notifications */}
      {step === 4 && (
        <View>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>

          <Card variant="default" style={styles.preferencesCard}>
            <View style={styles.preferenceRow}>
              <View>
                <Text style={styles.preferenceLabel}>Email Notifications</Text>
                <Text style={styles.preferenceHelper}>Receive leads via email</Text>
              </View>
              <Toggle
                value={formData.emailEnabled}
                onToggle={(val) => setFormData((prev) => ({ ...prev, emailEnabled: val }))}
              />
            </View>
          </Card>

          <Card variant="default" style={styles.preferencesCard}>
            <View style={styles.preferenceRow}>
              <View>
                <Text style={styles.preferenceLabel}>Push Notifications</Text>
                <Text style={styles.preferenceHelper}>Get instant alerts on your phone</Text>
              </View>
              <Toggle
                value={formData.pushEnabled}
                onToggle={(val) => setFormData((prev) => ({ ...prev, pushEnabled: val }))}
              />
            </View>
          </Card>

          <Card variant="outlined" style={styles.infoCard}>
            <Text style={styles.infoTitle}>Next Step</Text>
            <Text style={styles.infoText}>
              After completing this onboarding, you'll see your personalized value reveal and choose how to proceed with payment.
            </Text>
          </Card>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.footer}>
        {step > 1 && (
          <Button
            title="Previous"
            variant="outline"
            size="large"
            onPress={handlePrevious}
            style={{ marginBottom: 12 }}
          />
        )}
        {step < 4 ? (
          <Button title="Next" size="large" onPress={handleNext} />
        ) : (
          <Button title="Review & Continue" size="large" onPress={handleSubmit} />
        )}
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
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  stepIndicator: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  tierCard: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  tierCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  tierFeatures: {
    marginBottom: 12,
    marginLeft: 12,
  },
  tierFeature: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  tierRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignSelf: 'flex-end',
  },
  tierRadioActive: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  loadingContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cityItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  cityItemDisabled: {
    opacity: 0.5,
  },
  cityItemContent: {
    flex: 1,
  },
  cityItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  cityItemNameSelected: {
    color: '#2563EB',
  },
  cityItemCapacity: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cityCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityCheckboxActive: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  cityCheckboxDisabled: {
    borderColor: '#DBEAFE',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cityCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
  },
  preferencesCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  preferenceHelper: {
    fontSize: 13,
    color: '#6B7280',
  },
  infoCard: {
    marginTop: 16,
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
    marginTop: 24,
  },
});
