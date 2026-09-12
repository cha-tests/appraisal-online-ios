import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback, FlatList, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { useAuthStore } from '../../stores/auth.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { brokerService } from '../../services/broker.service';
import { disclaimerService } from '../../services/disclaimer.service';
import { BROKER_DISCLAIMER_TEXT, BROKER_DISCLAIMER_VERSION } from '../../config/disclaimers';
import { orderedCountryList, countryFlagEmoji } from '../../config/countries';
import { BrokerTier, BrokerRole, City } from '../../types';

const TOTAL_STEPS = 6;
// Only these two are offered at signup for now, per the Sep 1 pricing
// decision (₱5,000/year flat, no city cap yet) — 'Founder Lifetime' still
// exists as a BrokerTier value (other screens reference it) but isn't
// offered here until the founder-tier mechanics are actually built.
const TIERS: BrokerTier[] = ['Basic Annual', 'Premium Annual'];
// Every country is selectable here, not just markets with cities already
// seeded (see countries.ts) — PH/AU/US pinned to the top since they're the
// primary launch market plus the two with the most current test activity.
// A country with no cities yet still shows in the picker; the city list
// below just shows an empty state for it (see step 4's render).
const COUNTRY_LIST = orderedCountryList();
const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(
  COUNTRY_LIST.map((c) => [c.code, `${countryFlagEmoji(c.code)} ${c.name}`])
);
// 'Basic Annual' and 'Premium Annual' are the stored tier values (unchanged,
// so this needs no database migration) — only their signup-time label and
// price are repurposed here for the Free / ₱5,000-a-year plan.
const TIER_DETAILS = {
  'Founder Lifetime': { label: 'Founder Lifetime', price: '$499 one-time', refund: '14 days' },
  'Premium Annual': { label: '₱5,000 Annually', price: '₱5,000/year', refund: '30 days' },
  'Basic Annual': { label: 'Free', price: 'Free', refund: '30 days' },
};

export default function BrokerOnboarding() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setSelectedTier = useSubscriptionStore((state) => state.setSelectedTier);
  const setSelectedCities = useSubscriptionStore((state) => state.setSelectedCities);

  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    role: 'broker' as BrokerRole,
    company_name: '',
    license_number: '',
    phone: '',
    website: '',
    tier: 'Premium Annual' as BrokerTier,
    selectedCities: [] as string[],
    emailEnabled: true,
    pushEnabled: true,
  });

  // KYC (Clause 3 of the Sep 1 spec): a selfie + a valid-ID photo, held as
  // local URIs until submit, then uploaded to the private 'kyc-documents'
  // bucket. disclaimerAcknowledged gates progressing past this step —
  // brokers can't reach lead access without accepting the broker disclaimer.
  const [kycIdUri, setKycIdUri] = useState<string | null>(null);
  const [kycSelfieUri, setKycSelfieUri] = useState<string | null>(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoadingCities(true);
        const { success, cities: fetchedCities } = await brokerService.getCities();
        if (success && fetchedCities) {
          setCities(fetchedCities);
          // Default to PH (the primary launch market, and the one with real
          // seeded cities) rather than an arbitrary/empty country.
          setSelectedCountry((prev) => prev ?? 'PH');
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
      } finally {
        setLoadingCities(false);
      }
    };

    if (step === 4) {
      fetchCities();
    }
  }, [step]);

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    } else if (stepNum === 2) {
      if (!kycIdUri) newErrors.kycId = 'Upload a photo of a valid ID';
      if (!kycSelfieUri) newErrors.kycSelfie = 'Take a selfie to verify it matches your ID';
      if (!disclaimerAcknowledged) newErrors.disclaimer = 'Please acknowledge the notice before continuing';
    } else if (stepNum === 4) {
      if (formData.selectedCities.length === 0) {
        newErrors.cities = 'Select at least one city';
      }
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickKycImage = async (kind: 'id' | 'selfie') => {
    const permission =
      kind === 'selfie'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        kind === 'selfie'
          ? 'Camera access is needed to take a verification selfie.'
          : 'Photo library access is needed to upload your ID.'
      );
      return;
    }

    const result =
      kind === 'selfie'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });

    if (!result.canceled && result.assets?.[0]) {
      if (kind === 'id') setKycIdUri(result.assets[0].uri);
      else setKycSelfieUri(result.assets[0].uri);
      setFormErrors((prev) => ({ ...prev, [kind === 'id' ? 'kycId' : 'kycSelfie']: '' }));
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    setStep(step - 1);
  };

  // No per-tier city cap for now ("Lead coverage = no limit for now") — a
  // broker can select as many cities as they want regardless of plan.
  const handleCityToggle = (cityId: string) => {
    const currentCities = formData.selectedCities;

    if (currentCities.includes(cityId)) {
      setFormData((prev) => ({
        ...prev,
        selectedCities: prev.selectedCities.filter((c) => c !== cityId),
      }));
    } else {
      setError('');
      setFormData((prev) => ({
        ...prev,
        selectedCities: [...prev.selectedCities, cityId],
      }));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    const userId = user?.id || '';
    try {
      setSubmitting(true);
      setError('');

      // Save selections to Zustand
      setSelectedTier(formData.tier);
      setSelectedCities(formData.selectedCities);

      // Create broker profile if needed
      const { profile } = await brokerService.getProfile(userId);
      if (!profile) {
        const created = await brokerService.createProfile(
          userId,
          formData.company_name,
          formData.license_number,
          formData.phone,
          formData.website,
          formData.role,
          formData.tier
        );
        if (!created.success) {
          throw new Error(created.error?.message || 'Failed to create broker profile');
        }
      }

      // KYC — uploads should already exist by the time step 2 was passed,
      // but re-check defensively rather than trust component state alone.
      if (!kycIdUri || !kycSelfieUri) {
        throw new Error('Missing ID or selfie photo — please go back and add both');
      }
      const idUpload = await brokerService.uploadKycDocument(userId, kycIdUri, 'id');
      if (!idUpload.success || !idUpload.path) {
        throw new Error(idUpload.error || 'Failed to upload ID photo');
      }
      const selfieUpload = await brokerService.uploadKycDocument(userId, kycSelfieUri, 'selfie');
      if (!selfieUpload.success || !selfieUpload.path) {
        throw new Error(selfieUpload.error || 'Failed to upload selfie');
      }
      const kycResult = await brokerService.submitKyc(userId, idUpload.path, selfieUpload.path);
      if (!kycResult.success) {
        throw new Error(kycResult.error?.message || 'Failed to submit KYC documents');
      }

      await disclaimerService.acceptDisclaimer(userId, 'broker', BROKER_DISCLAIMER_VERSION);

      // Founding-member rate lock only applies to the paid (₱5,000/year)
      // plan — the Free plan has nothing to lock. See migration 015.
      if (formData.tier === 'Premium Annual') {
        const founding = await brokerService.claimFoundingMemberSlot(userId);
        if (founding.success && founding.founding_member_number) {
          await new Promise<void>((resolve) => {
            Alert.alert(
              '🎉 You’re a Founding Member!',
              `You're founding member #${founding.founding_member_number} of 1,000 — your ₱5,000/year rate is locked in for life, even if pricing goes up later.`,
              [{ text: 'Continue', onPress: () => resolve() }]
            );
          });
        }
      }

      router.push('/broker/value-reveal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
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
                width: `${(step / TOTAL_STEPS) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.stepIndicator}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      </View>

      {/* Step 1: Company Info */}
      {step === 1 && (
        <View>
          <Text style={styles.sectionTitle}>Your Information</Text>

          <Text style={styles.fieldLabel}>I am a</Text>
          <View style={styles.roleRow}>
            {(['broker', 'salesperson'] as BrokerRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleOption, formData.role === r && styles.roleOptionActive]}
                onPress={() => setFormData((prev) => ({ ...prev, role: r }))}
              >
                <Text style={[styles.roleOptionText, formData.role === r && styles.roleOptionTextActive]}>
                  {r === 'broker' ? 'Broker' : 'Salesperson'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {formData.role === 'broker' ? (
            <Text style={styles.roleHelper}>You hold a PRC broker license.</Text>
          ) : (
            <View style={styles.roleSpacer} />
          )}

          <TextInput
            label="Company Name (Optional)"
            placeholder="e.g., Smith & Associates Realty"
            value={formData.company_name}
            onChangeText={(val) => setFormData((prev) => ({ ...prev, company_name: val }))}
          />

          <TextInput
            label="Real Estate License # (Optional)"
            placeholder="Your license number"
            value={formData.license_number}
            onChangeText={(val) => setFormData((prev) => ({ ...prev, license_number: val }))}
          />

          <PhoneInput
            label="Phone Number"
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

      {/* Step 2: Identity Verification (KYC) */}
      {step === 2 && (
        <View>
          <Text style={styles.sectionTitle}>Verify Your Identity</Text>
          <Text style={styles.stepDescription}>
            Every new member goes through a quick verification check before their account is approved for leads.
          </Text>

          <Text style={styles.fieldLabel}>Valid ID</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickKycImage('id')}>
            {kycIdUri ? (
              <Image source={{ uri: kycIdUri }} style={styles.uploadPreview} />
            ) : (
              <Text style={styles.uploadPrompt}>Tap to attach a photo of a government ID</Text>
            )}
          </TouchableOpacity>
          {formErrors.kycId ? <Text style={styles.errorMessage}>{formErrors.kycId}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Selfie</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickKycImage('selfie')}>
            {kycSelfieUri ? (
              <Image source={{ uri: kycSelfieUri }} style={styles.uploadPreview} />
            ) : (
              <Text style={styles.uploadPrompt}>Tap to take a selfie</Text>
            )}
          </TouchableOpacity>
          {formErrors.kycSelfie ? <Text style={styles.errorMessage}>{formErrors.kycSelfie}</Text> : null}

          <View style={{ marginTop: 16 }}>
            <DisclaimerNotice
              title="⚠️ Before You Get Leads"
              text={BROKER_DISCLAIMER_TEXT}
              acknowledged={disclaimerAcknowledged}
              onToggleAcknowledged={(val) => {
                setDisclaimerAcknowledged(val);
                setFormErrors((prev) => ({ ...prev, disclaimer: '' }));
              }}
            />
            {formErrors.disclaimer ? <Text style={styles.errorMessage}>{formErrors.disclaimer}</Text> : null}
          </View>

          <Text style={styles.kycStatusNote}>
            A person on our team reviews every submission — approval isn't instant, but you can finish signing up now.
          </Text>
        </View>
      )}

      {/* Step 3: Tier Selection */}
      {step === 3 && (
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
                <Text style={styles.tierName}>{TIER_DETAILS[tier].label}</Text>
                <Text style={styles.tierPrice}>{TIER_DETAILS[tier].price}</Text>
              </View>

              <View style={styles.tierFeatures}>
                <Text style={styles.tierFeature}>📍 No limit on lead coverage cities</Text>
                <Text style={styles.tierFeature}>
                  💬 {tier === 'Premium Annual' ? 'Real-time' : 'Weekly'} leads
                </Text>
                {tier === 'Premium Annual' && (
                  <Text style={styles.tierFeature}>
                    💰 {TIER_DETAILS[tier].refund} money-back guarantee
                  </Text>
                )}
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

      {/* Step 4: City Selection */}
      {step === 4 && (
        <View>
          <Text style={styles.sectionTitle}>Select Your Cities</Text>
          <Text style={styles.stepDescription}>
            Choose the cities where you'd like lead coverage.
          </Text>

          {!!error && <Text style={styles.errorMessage}>{error}</Text>}

          {loadingCities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#2563EB" />
            </View>
          ) : (
            <>
              <Text style={styles.dropdownLabel}>Country</Text>
              <TouchableOpacity
                style={styles.countryDropdown}
                onPress={() => setCountryPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.countryDropdownText, !selectedCountry && styles.dropdownPlaceholder]}
                >
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
                  {/* TouchableWithoutFeedback (not onStartShouldSetResponder
                      on a plain View) is what actually stops a tap here from
                      bubbling up to the overlay's dismiss handler above —
                      the View-based version let a tap land on the overlay
                      first when the touch started inside the search
                      TextInput, closing the modal instead of focusing it. */}
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

              <Text style={styles.dropdownLabel}>Cities or Towns</Text>
              <TouchableOpacity
                style={styles.countryDropdown}
                onPress={() => setCityPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.countryDropdownText,
                    !formData.selectedCities.length && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {formData.selectedCities.length
                    ? cities
                        .filter((c) => formData.selectedCities.includes(c.id))
                        .map((c) => c.name)
                        .join(', ')
                    : 'Select your city or town'}
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
                    <Text style={styles.modalTitle}>Select Cities or Towns</Text>
                    {/* Cities are seeded per-country as real data comes in
                        (see supabase/migrations' city seeds) — a country
                        with none yet shows an empty state here instead of a
                        silently blank list. */}
                    {cities.some((c) => c.country === selectedCountry) ? (
                      <>
                        <TextInput
                          placeholder="Search cities or towns"
                          value={citySearch}
                          onChangeText={setCitySearch}
                          autoCapitalize="none"
                        />
                        <FlatList
                          data={cities
                            .filter((c) => c.country === selectedCountry)
                            .filter(
                              (c) =>
                                !citySearch.trim() ||
                                c.name.toLowerCase().includes(citySearch.trim().toLowerCase()) ||
                                c.state?.toLowerCase().includes(citySearch.trim().toLowerCase())
                            )
                            // Selected cities float to the top, so a broker
                            // can see what they've already picked without
                            // scrolling back through the whole (searched)
                            // list every time they reopen this.
                            .sort((a, b) => {
                              const aSel = formData.selectedCities.includes(a.id) ? 0 : 1;
                              const bSel = formData.selectedCities.includes(b.id) ? 0 : 1;
                              return aSel - bSel;
                            })}
                          keyExtractor={(item) => item.id}
                          style={[styles.countryList, styles.cityPickerList]}
                          renderItem={({ item }) => {
                            const isSelected = formData.selectedCities.includes(item.id);

                            return (
                              <TouchableOpacity
                                style={[styles.cityItem, isSelected && styles.cityItemSelected]}
                                onPress={() => handleCityToggle(item.id)}
                              >
                                <View style={styles.cityItemContent}>
                                  <Text
                                    style={[styles.cityItemName, isSelected && styles.cityItemNameSelected]}
                                  >
                                    {item.name}
                                    {item.state ? `, ${item.state}` : ''}
                                  </Text>
                                </View>
                                <View style={[styles.cityCheckbox, isSelected && styles.cityCheckboxActive]}>
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
                        No cities available yet in{' '}
                        {selectedCountry ? COUNTRY_LABELS[selectedCountry] : 'this country'} — check back
                        soon, or contact support if you'd like to be notified.
                      </Text>
                    )}
                  </View>
                  </TouchableWithoutFeedback>
                </TouchableOpacity>
              </Modal>
            </>
          )}

          <Text style={styles.cityCount}>
            Selected: {formData.selectedCities.length} {formData.selectedCities.length === 1 ? 'city' : 'cities'}
          </Text>
        </View>
      )}

      {/* Step 5: Notifications */}
      {step === 5 && (
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
              Review everything you've entered on the next screen before submitting.
            </Text>
          </Card>
        </View>
      )}

      {/* Step 6: Review — a real summary of what's about to be submitted,
          not just a button labeled "Review" with nothing to review. */}
      {step === 6 && (
        <View>
          <Text style={styles.sectionTitle}>Review Your Information</Text>
          <Text style={styles.stepDescription}>
            Confirm everything below is correct before submitting.
          </Text>

          <Card variant="default" style={styles.reviewCard}>
            <Text style={styles.reviewSectionLabel}>Your Information</Text>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>I am a</Text>
              <Text style={styles.reviewValue}>
                {formData.role === 'broker' ? 'Broker' : 'Salesperson'}
              </Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Company Name</Text>
              <Text style={styles.reviewValue}>{formData.company_name || 'Not provided'}</Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>License #</Text>
              <Text style={styles.reviewValue}>{formData.license_number || 'Not provided'}</Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Phone</Text>
              <Text style={styles.reviewValue}>{formData.phone || 'Not provided'}</Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Website</Text>
              <Text style={styles.reviewValue}>{formData.website || 'Not provided'}</Text>
            </View>
          </Card>

          <Card variant="default" style={styles.reviewCard}>
            <Text style={styles.reviewSectionLabel}>Verification</Text>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Valid ID</Text>
              <Text style={styles.reviewValue}>{kycIdUri ? '✓ Uploaded' : 'Not uploaded'}</Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Selfie</Text>
              <Text style={styles.reviewValue}>{kycSelfieUri ? '✓ Uploaded' : 'Not uploaded'}</Text>
            </View>
          </Card>

          <Card variant="default" style={styles.reviewCard}>
            <Text style={styles.reviewSectionLabel}>Plan</Text>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Selected Plan</Text>
              <Text style={styles.reviewValue}>{TIER_DETAILS[formData.tier].label}</Text>
            </View>
          </Card>

          <Card variant="default" style={styles.reviewCard}>
            <Text style={styles.reviewSectionLabel}>
              Cities ({formData.selectedCities.length})
            </Text>
            <Text style={styles.reviewValue}>
              {cities
                .filter((c) => formData.selectedCities.includes(c.id))
                .map((c) => c.name)
                .join(', ') || 'None selected'}
            </Text>
          </Card>

          <Card variant="default" style={styles.reviewCard}>
            <Text style={styles.reviewSectionLabel}>Notifications</Text>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Email</Text>
              <Text style={styles.reviewValue}>{formData.emailEnabled ? 'On' : 'Off'}</Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Push</Text>
              <Text style={styles.reviewValue}>{formData.pushEnabled ? 'On' : 'Off'}</Text>
            </View>
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
        {error && step === TOTAL_STEPS ? <Text style={styles.errorMessage}>{error}</Text> : null}
        {step < TOTAL_STEPS ? (
          <Button title="Next" size="large" onPress={handleNext} />
        ) : (
          <Button title="Confirm & Submit" size="large" onPress={handleSubmit} loading={submitting} />
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  roleSpacer: {
    marginBottom: 20,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  roleOptionTextActive: {
    color: '#2563EB',
  },
  roleHelper: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  uploadPrompt: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  uploadPreview: {
    width: '100%',
    height: 160,
  },
  kycStatusNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
    textAlign: 'center',
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
  countryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  countryDropdownText: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  countryDropdownChevron: {
    fontSize: 13,
    color: '#6B7280',
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  dropdownPlaceholder: {
    fontWeight: '400',
    color: '#9CA3AF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  countryList: {
    flexGrow: 0,
    marginTop: 8,
  },
  // Bounded so a long, searchable city list (PH alone can run 100+ rows)
  // scrolls within itself instead of growing until it pushes the Done
  // button below modalCard's maxHeight and off-screen.
  cityPickerList: {
    maxHeight: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  countryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  countryOptionText: {
    fontSize: 15,
    color: '#1F2937',
  },
  countryOptionCheck: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
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
  noCitiesText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 24,
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
  reviewCard: {
    marginBottom: 12,
  },
  reviewSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
    textAlign: 'right',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  footer: {
    marginBottom: 32,
    marginTop: 24,
  },
});
