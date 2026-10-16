import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback, FlatList, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { AttachmentPreview } from '../../components/ui/AttachmentPreview';
import { useAuthStore } from '../../stores/auth.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { brokerService } from '../../services/broker.service';
import { disclaimerService } from '../../services/disclaimer.service';
import { checkPhotoQuality } from '../../services/photoQuality.service';
import { chooseAttachmentSource, withRetry } from '../../utils/attachments';
import { BROKER_DISCLAIMER_TEXT, BROKER_DISCLAIMER_VERSION } from '../../config/disclaimers';
import { orderedCountryList, countryFlagEmoji } from '../../config/countries';
import { BROKER_TIER_CITY_LIMITS } from '../../config/brokerTiers';
import { BrokerTier, BrokerRole, City } from '../../types';
import { theme } from '../../theme';

const TOTAL_STEPS = 6;
const TIERS: BrokerTier[] = ['Founder Lifetime', 'Premium Annual', 'Basic Annual'];
// Every country is selectable here, not just markets with cities already
// seeded (see countries.ts) — PH/AU/US pinned to the top since they're the
// primary launch market plus the two with the most current test activity.
// A country with no cities yet still shows in the picker; the city list
// below just shows an empty state for it (see step 4's render).
const COUNTRY_LIST = orderedCountryList();
const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(
  COUNTRY_LIST.map((c) => [c.code, `${countryFlagEmoji(c.code)} ${c.name}`])
);
const TIER_DETAILS = {
  'Founder Lifetime': { label: 'Founder Lifetime', price: '$499 one-time', refund: '14 days' },
  'Premium Annual': { label: 'Premium Annual', price: '$199/year', refund: '30 days' },
  'Basic Annual': { label: 'Basic Annual', price: '$49/year', refund: '30 days' },
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

  // KYC (Clause 3 of the Sep 1 spec): a selfie + a valid-ID photo. Each
  // uploads to the private 'kyc-documents' bucket immediately on pick
  // (rather than waiting for final submit) so a flaky connection gets
  // caught — and retried — early, not at the one moment that matters most.
  // `*Path` only ever holds a storage path once that upload has actually
  // succeeded; handleSubmit reads it directly instead of re-uploading.
  const [kycIdUri, setKycIdUri] = useState<string | null>(null);
  const [kycIdPath, setKycIdPath] = useState<string | null>(null);
  const [kycIdStatus, setKycIdStatus] = useState<'uploading' | 'uploaded' | 'error' | null>(null);
  const [kycSelfieUri, setKycSelfieUri] = useState<string | null>(null);
  const [kycSelfiePath, setKycSelfiePath] = useState<string | null>(null);
  const [kycSelfieStatus, setKycSelfieStatus] = useState<'uploading' | 'uploaded' | 'error' | null>(null);
  // Bumped on every pick/remove so a slow upload that resolves after the
  // photo was replaced or cleared doesn't clobber the newer state.
  const kycIdGenRef = useRef(0);
  const kycSelfieGenRef = useRef(0);
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
      // ID + selfie are optional — a broker can finish signup without them.
      // Only block on the disclaimer.
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
    const picked = await chooseAttachmentSource({
      title: kind === 'id' ? 'Add a Valid ID' : 'Add a Selfie',
    });
    if (!picked) return;

    // Catch an obviously blurry or glare-washed photo right away, rather
    // than making the broker wait for a human reviewer to reject it —
    // see photoQuality.service.ts for what this can and can't catch.
    const quality = await checkPhotoQuality(picked.uri);
    if (!quality.ok) {
      Alert.alert('Retake Photo', quality.message || 'Please retake this photo.');
      return;
    }

    setFormErrors((prev) => ({ ...prev, [kind === 'id' ? 'kycId' : 'kycSelfie']: '' }));
    uploadKycImage(kind, picked.uri);
  };

  const uploadKycImage = (kind: 'id' | 'selfie', uri: string) => {
    if (!user?.id) return;
    const genRef = kind === 'id' ? kycIdGenRef : kycSelfieGenRef;
    const myGen = ++genRef.current;

    if (kind === 'id') {
      setKycIdUri(uri);
      setKycIdPath(null);
      setKycIdStatus('uploading');
    } else {
      setKycSelfieUri(uri);
      setKycSelfiePath(null);
      setKycSelfieStatus('uploading');
    }

    withRetry(() => brokerService.uploadKycDocument(user.id, uri, kind)).then((result) => {
      // Superseded by a newer pick or a remove while this was in flight.
      if (genRef.current !== myGen) return;

      if (kind === 'id') {
        setKycIdPath(result.success ? result.path ?? null : null);
        setKycIdStatus(result.success ? 'uploaded' : 'error');
      } else {
        setKycSelfiePath(result.success ? result.path ?? null : null);
        setKycSelfieStatus(result.success ? 'uploaded' : 'error');
      }
    });
  };

  const retryKycUpload = (kind: 'id' | 'selfie') => {
    const uri = kind === 'id' ? kycIdUri : kycSelfieUri;
    if (uri) uploadKycImage(kind, uri);
  };

  const removeKycImage = (kind: 'id' | 'selfie') => {
    // Invalidate any in-flight upload for this field so its result, once it
    // resolves, is ignored instead of reviving a photo the broker removed.
    (kind === 'id' ? kycIdGenRef : kycSelfieGenRef).current++;
    if (kind === 'id') {
      setKycIdUri(null);
      setKycIdPath(null);
      setKycIdStatus(null);
    } else {
      setKycSelfieUri(null);
      setKycSelfiePath(null);
      setKycSelfieStatus(null);
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

  const handleCityToggle = async (cityId: string) => {
    const currentCities = formData.selectedCities;
    const cityLimit = BROKER_TIER_CITY_LIMITS[formData.tier];

    if (currentCities.includes(cityId)) {
      setFormData((prev) => ({
        ...prev,
        selectedCities: prev.selectedCities.filter((c) => c !== cityId),
      }));
    } else {
      if (currentCities.length >= cityLimit) {
        setError(
          `${TIER_DETAILS[formData.tier].label} is limited to ${cityLimit} ${cityLimit === 1 ? 'city' : 'cities'}. Remove one to add another, or upgrade your tier.`
        );
        return;
      }

      // Founder Lifetime is capped at 30 founders per city (CLAUDE.md: "Never
      // sell Lifetime into a city at its 30-founder cap") — the other tiers
      // have no such per-city member cap.
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

      // createProfile always inserts selected_cities as [] — this is what
      // actually persists the cities picked in step 4 (previously nothing
      // did; formData.selectedCities only ever reached the ephemeral
      // subscription store, used for value-reveal.tsx's estimates, never
      // the database). Also covers a returning broker re-running this flow
      // with a changed city selection, since getProfile found a profile.
      const citiesResult = await brokerService.updateCities(userId, formData.tier, formData.selectedCities);
      if (!citiesResult.success) {
        throw new Error(citiesResult.error?.message || 'Failed to save selected cities');
      }

      // KYC is optional, and each photo already uploaded in the background
      // the moment it was picked (see uploadKycImage) — only the two
      // storage paths need to exist now. A lone ID or lone selfie isn't
      // meaningful for review, so it's treated the same as providing
      // neither; an upload still in flight or failed at this point is also
      // skipped rather than blocking signup on it.
      if (kycIdPath && kycSelfiePath) {
        const kycResult = await brokerService.submitKyc(userId, kycIdPath, kycSelfiePath);
        if (!kycResult.success) {
          throw new Error(kycResult.error?.message || 'Failed to submit KYC documents');
        }
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
            Optional — you can finish signing up without it, but a verified ID and selfie get your account approved for leads faster.
          </Text>

          <Text style={styles.fieldLabel}>Valid ID (Optional)</Text>
          {kycIdUri ? (
            <AttachmentPreview
              uri={kycIdUri}
              isImage
              status={kycIdStatus ?? 'uploaded'}
              onRemove={() => removeKycImage('id')}
              onRetry={() => retryKycUpload('id')}
              height={160}
            />
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickKycImage('id')}>
              <Text style={styles.uploadPrompt}>Tap to attach a photo of a government ID</Text>
            </TouchableOpacity>
          )}
          {formErrors.kycId ? <Text style={styles.errorMessage}>{formErrors.kycId}</Text> : null}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Selfie (Optional)</Text>
          {kycSelfieUri ? (
            <AttachmentPreview
              uri={kycSelfieUri}
              isImage
              status={kycSelfieStatus ?? 'uploaded'}
              onRemove={() => removeKycImage('selfie')}
              onRetry={() => retryKycUpload('selfie')}
              height={160}
            />
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickKycImage('selfie')}>
              <Text style={styles.uploadPrompt}>Tap to take a selfie</Text>
            </TouchableOpacity>
          )}
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

          {(kycIdUri || kycSelfieUri) && (
            <Text style={styles.kycStatusNote}>
              A person on our team reviews every submission — approval isn't instant, but you can finish signing up now.
            </Text>
          )}
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
                const newLimit = BROKER_TIER_CITY_LIMITS[tier];
                setFormData((prev) => ({
                  ...prev,
                  tier,
                  // Switching to a lower city cap (e.g. Premium -> Basic)
                  // must not leave more cities selected than the new tier
                  // allows — trim to the first N already-chosen cities
                  // rather than silently submitting an over-the-limit list.
                  selectedCities: prev.selectedCities.slice(0, newLimit),
                }));
                setFormErrors({});
              }}
            >
              <View style={styles.tierHeader}>
                <Text style={styles.tierName}>{TIER_DETAILS[tier].label}</Text>
                <Text style={styles.tierPrice}>{TIER_DETAILS[tier].price}</Text>
              </View>

              <View style={styles.tierFeatures}>
                <Text style={styles.tierFeature}>
                  📍 {BROKER_TIER_CITY_LIMITS[tier]} {BROKER_TIER_CITY_LIMITS[tier] === 1 ? 'city' : 'cities'}
                </Text>
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
          <Text style={styles.sectionTitle}>Where Do You Want Leads From?</Text>
          <Text style={styles.stepDescription}>
            Pick the cities or towns where you want to receive leads — not necessarily where you live or work.
          </Text>

          {!!error && <Text style={styles.errorMessage}>{error}</Text>}

          {loadingCities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.color.accent} />
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

              <Text style={styles.dropdownLabel}>Cities or Towns Where You'll Get Leads</Text>
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
                        {!!error && <Text style={styles.errorMessage}>{error}</Text>}
                        <FlatList
                          data={(() => {
                            const countryCities = cities.filter((c) => c.country === selectedCountry);
                            const query = citySearch.trim().toLowerCase();
                            const matchesQuery = (c: City) =>
                              !query ||
                              c.name.toLowerCase().includes(query) ||
                              !!c.state?.toLowerCase().includes(query);

                            // Already-selected cities always stay visible at
                            // the top, even mid-search — otherwise typing a
                            // search term could hide a pick you'd already
                            // made, making it look like it got deselected.
                            // Only the *unselected* results are filtered by
                            // the search text.
                            const selected = countryCities.filter((c) =>
                              formData.selectedCities.includes(c.id)
                            );
                            const unselectedMatches = countryCities.filter(
                              (c) => !formData.selectedCities.includes(c.id) && matchesQuery(c)
                            );
                            return [...selected, ...unselectedMatches];
                          })()}
                          keyExtractor={(item) => item.id}
                          style={[styles.countryList, styles.cityPickerList]}
                          renderItem={({ item }) => {
                            const isSelected = formData.selectedCities.includes(item.id);
                            const isFull =
                              item.founder_count_lifetime >= 30 && formData.tier === 'Founder Lifetime';

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
                                  <Text
                                    style={[styles.cityItemName, isSelected && styles.cityItemNameSelected]}
                                  >
                                    {item.name}
                                    {item.state ? `, ${item.state}` : ''}
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
            Selected: {formData.selectedCities.length} of {BROKER_TIER_CITY_LIMITS[formData.tier]}{' '}
            {BROKER_TIER_CITY_LIMITS[formData.tier] === 1 ? 'city' : 'cities'}
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
              <Text style={styles.reviewValue}>
                {kycIdPath ? '✓ Uploaded' : kycIdStatus === 'uploading' ? 'Uploading…' : 'Not uploaded'}
              </Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Selfie</Text>
              <Text style={styles.reviewValue}>
                {kycSelfiePath ? '✓ Uploaded' : kycSelfieStatus === 'uploading' ? 'Uploading…' : 'Not uploaded'}
              </Text>
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
    color: theme.color.text,
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.color.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.color.accent,
  },
  stepIndicator: {
    fontSize: 12,
    color: theme.color.textFaint,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: theme.color.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
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
    borderColor: theme.color.track,
    alignItems: 'center',
    backgroundColor: theme.color.surface,
  },
  roleOptionActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accentWash,
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  roleOptionTextActive: {
    color: theme.color.accent,
  },
  roleHelper: {
    fontSize: 12,
    color: theme.color.textFaint,
    marginBottom: 20,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.track,
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    overflow: 'hidden',
  },
  uploadPrompt: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  uploadPreview: {
    width: '100%',
    height: 160,
  },
  kycStatusNote: {
    fontSize: 12,
    color: theme.color.textFaint,
    marginTop: 16,
    textAlign: 'center',
  },
  tierCard: {
    borderWidth: 1,
    borderColor: theme.color.track,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: theme.color.surface,
  },
  tierCardActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accentWash,
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
    color: theme.color.text,
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.accent,
  },
  tierFeatures: {
    marginBottom: 12,
    marginLeft: 12,
  },
  tierFeature: {
    fontSize: 13,
    color: theme.color.textMuted,
    marginBottom: 6,
  },
  tierRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.color.track,
    alignSelf: 'flex-end',
  },
  tierRadioActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
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
    color: '#374151',
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
  // Bounded so a long, searchable city list (PH alone can run 100+ rows)
  // scrolls within itself instead of growing until it pushes the Done
  // button below modalCard's maxHeight and off-screen.
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
    color: theme.color.text,
    marginBottom: 4,
  },
  preferenceHelper: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  infoCard: {
    marginTop: 16,
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  reviewCard: {
    marginBottom: 12,
  },
  reviewSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textMuted,
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
    color: theme.color.textMuted,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: theme.color.border,
  },
  footer: {
    marginBottom: 32,
    marginTop: 24,
  },
});
