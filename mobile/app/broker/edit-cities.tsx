import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { orderedCountryList, countryFlagEmoji } from '../../config/countries';
import { BROKER_TIER_CITY_LIMITS } from '../../config/brokerTiers';
import { City } from '../../types';
import { theme } from '../../theme';

const COUNTRY_LIST = orderedCountryList();
const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(
  COUNTRY_LIST.map((c) => [c.code, `${countryFlagEmoji(c.code)} ${c.name}`])
);

/** Lets a broker change which cities they cover after onboarding — the
 * onboarding wizard (step 4) only ever wrote this once, with no way back
 * in. Reuses the same picker UI and the same updateCities() call (tier
 * limit + founder-cap validation, and the orphaned-lead catch-up in
 * updateCities itself) rather than re-deriving either. */
export default function EditCities() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState<'Founder Lifetime' | 'Premium Annual' | 'Basic Annual'>('Premium Annual');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const [{ profile }, { cities: fetchedCities }] = await Promise.all([
          brokerService.getProfile(user.id),
          brokerService.getCities(),
        ]);

        if (fetchedCities) setCities(fetchedCities);

        if (profile) {
          setTier(profile.tier);
          setSelectedCities(profile.selected_cities || []);

          const firstCity = fetchedCities?.find((c) => profile.selected_cities?.includes(c.id));
          setSelectedCountry(firstCity?.country ?? 'PH');
        } else {
          setSelectedCountry('PH');
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  const cityLimit = BROKER_TIER_CITY_LIMITS[tier];

  const handleCityToggle = async (cityId: string) => {
    if (selectedCities.includes(cityId)) {
      setSelectedCities((prev) => prev.filter((c) => c !== cityId));
      return;
    }

    if (selectedCities.length >= cityLimit) {
      setError(
        `${tier} is limited to ${cityLimit} ${cityLimit === 1 ? 'city' : 'cities'}. Remove one to add another.`
      );
      return;
    }

    if (tier === 'Founder Lifetime') {
      const { available } = await brokerService.checkFounderCapacity(cityId);
      if (!available) {
        setError('This city has reached the maximum Founder members. Choose another.');
        return;
      }
    }

    setError('');
    setSelectedCities((prev) => [...prev, cityId]);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (selectedCities.length === 0) {
      setError('Select at least one city');
      return;
    }

    try {
      setSaving(true);
      const result = await brokerService.updateCities(user.id, tier, selectedCities);
      if (!result.success) {
        Alert.alert('Error', result.error?.message || 'Failed to save cities');
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper onBackPress={() => router.back()}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.back()}>
      <Text style={styles.title}>Your Cities</Text>
      <Text style={styles.subtitle}>
        Leads are matched to the cities you cover below — changes apply immediately.
      </Text>

      <Text style={styles.dropdownLabel}>Country</Text>
      <TouchableOpacity
        style={styles.countryDropdown}
        onPress={() => setCountryPickerVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.countryDropdownText, !selectedCountry && styles.dropdownPlaceholder]}>
          {selectedCountry ? COUNTRY_LABELS[selectedCountry] ?? selectedCountry : 'Select your country'}
        </Text>
        <Text style={styles.countryDropdownChevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCountryPickerVisible(false);
          setCountrySearch('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setCountryPickerVisible(false);
            setCountrySearch('');
          }}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TextInput
                placeholder="Search countries"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />
              <FlatList
                data={COUNTRY_LIST.filter((c) =>
                  c.name.toLowerCase().includes(countrySearch.trim().toLowerCase())
                )}
                keyExtractor={(item) => item.code}
                style={styles.countryList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryOptionRow}
                    onPress={() => {
                      setSelectedCountry(item.code);
                      setCountryPickerVisible(false);
                      setCountrySearch('');
                    }}
                  >
                    <Text style={styles.countryOptionText}>{COUNTRY_LABELS[item.code]}</Text>
                    {selectedCountry === item.code && <Text style={styles.countryOptionCheck}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Text style={styles.dropdownLabel}>Cities or Towns Where You'll Get Leads</Text>
      <TouchableOpacity
        style={styles.countryDropdown}
        onPress={() => setCityPickerVisible(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.countryDropdownText, !selectedCities.length && styles.dropdownPlaceholder]}
          numberOfLines={1}
        >
          {selectedCities.length
            ? cities.filter((c) => selectedCities.includes(c.id)).map((c) => c.name).join(', ')
            : 'Select the cities where you want leads'}
        </Text>
        <Text style={styles.countryDropdownChevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={cityPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCityPickerVisible(false);
          setCitySearch('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setCityPickerVisible(false);
            setCitySearch('');
          }}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Where Do You Want Leads From?</Text>
              {cities.some((c) => c.country === selectedCountry) ? (
                <>
                  <TextInput
                    placeholder="Search cities or towns"
                    value={citySearch}
                    onChangeText={setCitySearch}
                    autoCapitalize="none"
                  />
                  {!!error && <Text style={styles.errorMessage}>{error}</Text>}
                  <FlatList
                    data={(() => {
                      const countryCities = cities.filter((c) => c.country === selectedCountry);
                      const query = citySearch.trim().toLowerCase();
                      const matchesQuery = (c: City) =>
                        !query || c.name.toLowerCase().includes(query) || !!c.state?.toLowerCase().includes(query);

                      const selected = countryCities.filter((c) => selectedCities.includes(c.id));
                      const unselectedMatches = countryCities.filter(
                        (c) => !selectedCities.includes(c.id) && matchesQuery(c)
                      );
                      return [...selected, ...unselectedMatches];
                    })()}
                    keyExtractor={(item) => item.id}
                    style={[styles.countryList, styles.cityPickerList]}
                    renderItem={({ item }) => {
                      const isSelected = selectedCities.includes(item.id);
                      const isFull = item.founder_count_lifetime >= 30 && tier === 'Founder Lifetime';

                      return (
                        <TouchableOpacity
                          style={[
                            styles.cityItem,
                            isSelected && styles.cityItemSelected,
                            isFull && !isSelected && styles.cityItemDisabled,
                          ]}
                          onPress={() => handleCityToggle(item.id)}
                          disabled={isFull && !isSelected}
                        >
                          <View style={styles.cityItemContent}>
                            <Text style={[styles.cityItemName, isSelected && styles.cityItemNameSelected]}>
                              {item.name}
                              {item.state ? `, ${item.state}` : ''}
                            </Text>
                            {tier === 'Founder Lifetime' && (
                              <Text style={styles.cityItemCapacity}>
                                {item.founder_count_lifetime}/30 founders
                              </Text>
                            )}
                          </View>
                          <View
                            style={[
                              styles.cityCheckbox,
                              isSelected && styles.cityCheckboxActive,
                              isFull && !isSelected && styles.cityCheckboxDisabled,
                            ]}
                          >
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                  <Button
                    title="Done"
                    size="small"
                    onPress={() => {
                      setCityPickerVisible(false);
                      setCitySearch('');
                    }}
                    style={{ marginTop: 12 }}
                  />
                </>
              ) : (
                <Text style={styles.noCitiesText}>
                  No cities available yet in {selectedCountry ? COUNTRY_LABELS[selectedCountry] : 'this country'}.
                </Text>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Text style={styles.cityCount}>
        Selected: {selectedCities.length} of {cityLimit} {cityLimit === 1 ? 'city' : 'cities'}
      </Text>

      {!!error && <Text style={styles.errorMessage}>{error}</Text>}

      <Button title="Save Changes" size="large" onPress={handleSave} loading={saving} disabled={saving} style={{ marginTop: 24 }} />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },
  countryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.color.track,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.color.surface,
    marginBottom: 16,
  },
  countryDropdownText: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text,
  },
  countryDropdownChevron: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.textMuted,
    marginBottom: 6,
  },
  dropdownPlaceholder: {
    fontWeight: '400',
    color: theme.color.textFaint,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    padding: 16,
  },
  countryList: {
    flexGrow: 0,
    marginTop: 8,
  },
  cityPickerList: {
    maxHeight: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  countryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  countryOptionText: {
    fontSize: 15,
    color: theme.color.text,
  },
  countryOptionCheck: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.accent,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  cityItemSelected: {
    backgroundColor: theme.color.accentWash,
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
    color: theme.color.text,
    marginBottom: 2,
  },
  cityItemNameSelected: {
    color: theme.color.accent,
  },
  cityItemCapacity: {
    fontSize: 12,
    color: theme.color.textFaint,
  },
  cityCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.color.track,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityCheckboxActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  cityCheckboxDisabled: {
    borderColor: theme.color.accentWash,
  },
  checkmark: {
    color: theme.color.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  cityCount: {
    fontSize: 12,
    color: theme.color.textFaint,
    marginTop: -8,
    textAlign: 'center',
  },
  noCitiesText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 24,
  },
  errorMessage: {
    color: theme.color.danger,
    fontSize: 14,
    marginBottom: 16,
  },
});
