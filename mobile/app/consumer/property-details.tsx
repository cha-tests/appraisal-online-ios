import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useReportStore } from '../../stores/report.store';
import { PropertyDetailsFormData } from '../../types';
import {
  getMarketConfig,
  sqftToSqm,
  sqmToSqft,
  isVacantLandType,
  OTHER_PROPERTY_TYPE,
  type SizeUnit,
} from '../../config/marketConfig';
import { theme, pill } from '../../theme';

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

// square_feet stays the one value that is stored, sent to the backend, and
// fed into the valuation prompt — the same field the DB column and
// PropertyDetailsFormData type already use. The toggle only changes how that
// number is entered and displayed; it never changes what gets saved.

/** 44px −/value/+ stepper row, matching the design brief's Rooms section. */
function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControl}>
        <TouchableOpacity
          style={styles.stepperButton}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          <Text style={[styles.stepperButtonText, value <= min && styles.stepperButtonTextDisabled]}>
            −
          </Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={styles.stepperButton}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        >
          <Text style={[styles.stepperButtonText, value >= max && styles.stepperButtonTextDisabled]}>
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PropertyDetails() {
  const router = useRouter();
  const currentProperty = useReportStore((state) => state.currentProperty);
  const setCurrentPropertyDetails = useReportStore((state) => state.setCurrentPropertyDetails);
  const reportsRemainingThisMonth = useReportStore((state) => state.reportsRemainingThisMonth);

  // Derived once from the property's own country (captured during address
  // entry), not a device-wide setting — so a US buyer entering a PH property
  // still sees PH conventions, and vice versa. This is the one place that
  // decides both the size unit and the property type options, so the two
  // never disagree about which market they're presenting.
  const market = useMemo(
    () => getMarketConfig(currentProperty?.address_components?.country_code),
    [currentProperty?.address_components?.country_code]
  );

  const [formData, setFormData] = useState<PropertyDetailsFormData>({
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 2000,
    // 0 is a deliberately invalid placeholder, not a real year — the field
    // starts genuinely blank (see yearText below) and validateAll already
    // rejects anything outside 1800-current, so an un-filled year can never
    // slip through to submission.
    year_built: 0,
    property_type: market.propertyTypes[0],
    condition: 'Good',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Raw land has no building on it, so a construction year doesn't apply —
  // "Vacant Lot"/"Vacant Land"/"Land" across every market in marketConfig.ts.
  const isLand = isVacantLandType(formData.property_type);

  // Free-text fallback for when none of the market's own categories fit (or
  // the address's country couldn't be resolved at all — see market above).
  // Kept separate from formData.property_type so the button grid can still
  // show "Others" as selected while this fills in what actually gets saved.
  const [customPropertyType, setCustomPropertyType] = useState('');
  const isOtherType = formData.property_type === OTHER_PROPERTY_TYPE;

  const [parkingText, setParkingText] = useState('');

  const handleParkingChange = (text: string) => {
    setParkingText(text);
    const parsed = parseInt(text, 10);
    updateFormData('parking_spaces', isNaN(parsed) ? undefined : parsed);
  };

  // Kept separate from formData.year_built (same reason as sizeText below):
  // displaying formData.year_built.toString() directly meant every erase
  // snapped back to a coerced fallback number (parseInt('') || <something>),
  // which then sat in the field and corrupted the next digits typed — you
  // could never actually clear it to type a different year from scratch.
  const [yearText, setYearText] = useState('');

  const handleYearChange = (text: string) => {
    setYearText(text);
    const parsed = parseInt(text, 10);
    updateFormData('year_built', isNaN(parsed) ? 0 : parsed);
  };

  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(market.sizeUnit);
  // Text the size field shows, in sizeUnit. Kept separate from
  // formData.square_feet (always sqft) so switching units doesn't compound
  // rounding on every toggle, and so a half-typed number isn't clobbered by
  // a live sqft<->sqm conversion on every keystroke. Start blank so the user
  // must enter a value rather than inheriting the formData default.
  const [sizeText, setSizeText] = useState('');

  const handleUnitChange = (unit: SizeUnit) => {
    if (unit === sizeUnit) return;
    setSizeUnit(unit);
    // Nothing typed yet — stay blank rather than deriving a value from
    // formData.square_feet, which still holds its unfilled 2000 default at
    // this point. Without this check, tapping the toggle before typing
    // anything populates the field with a phantom "2000"/"186" that looks
    // exactly like the prefill this field isn't supposed to have.
    if (!sizeText.trim()) return;
    // Re-derive the displayed text from the canonical sqft value rather than
    // converting the displayed text again, which would drift with each toggle.
    setSizeText(
      unit === 'sqft'
        ? String(Math.round(formData.square_feet))
        : String(Math.round(sqftToSqm(formData.square_feet)))
    );
  };

  const handleSizeChange = (text: string) => {
    setSizeText(text);
    const value = parseFloat(text) || 0;
    const sqft = sizeUnit === 'sqft' ? value : sqmToSqft(value);
    updateFormData('square_feet', Math.round(sqft));
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.bedrooms < 0 || formData.bedrooms > 10) {
      newErrors.bedrooms = 'Please enter 0-10 bedrooms';
    }
    if (formData.bathrooms < 0 || formData.bathrooms > 10) {
      newErrors.bathrooms = 'Please enter 0-10 bathrooms';
    }
    if (formData.square_feet < 100 || formData.square_feet > 50000) {
      // Bounds are stored in sqft; report them back in whichever unit the
      // user is currently looking at so the message matches what they typed.
      newErrors.square_feet =
        sizeUnit === 'sqft'
          ? 'Please enter 100-50,000 sq ft'
          : `Please enter ${Math.round(sqftToSqm(100))}-${Math.round(sqftToSqm(50000)).toLocaleString()} sq m`;
    }
    // Optional for vacant land — see isLand above — so a blank year_built
    // (still 0, its unfilled placeholder value) doesn't block submission.
    if (
      !isLand &&
      (formData.year_built < 1800 || formData.year_built > new Date().getFullYear())
    ) {
      newErrors.year_built = `Please enter year between 1800 and ${new Date().getFullYear()}`;
    }
    if (isOtherType && !customPropertyType.trim()) {
      newErrors.property_type = 'Please specify the property type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateAll()) {
      // The button grid stores the literal "Others" while the free-text box
      // is being filled in (see isOtherType) — swap in what was actually
      // typed before this goes anywhere near the backend or the AI prompt,
      // so neither ever sees the placeholder word itself.
      const submission = isOtherType
        ? { ...formData, property_type: customPropertyType.trim() }
        : formData;
      setCurrentPropertyDetails(submission);
      router.push('/consumer/loading');
    }
  };

  const updateFormData = (key: keyof PropertyDetailsFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <SafeAreaWrapper scrollable>
      <BackButton onPress={() => router.back()} />
      <ProgressBar progress={66} label="2 of 3" />

      <View style={styles.header}>
        <Text style={styles.title}>Tell us about the property</Text>
        <Text style={styles.subtitle}>{currentProperty?.address}</Text>
      </View>

      {/* Type & Condition — asked first: what the property IS shapes which of
          the questions below even apply (e.g. Year Built for vacant land). */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property type</Text>

        <View style={styles.pillGrid}>
          {market.propertyTypes.map((type) => {
            const active = formData.property_type === type;
            return (
              <TouchableOpacity
                key={type}
                style={[pill.base, active ? pill.on : pill.off]}
                onPress={() => updateFormData('property_type', type)}
              >
                <Text style={active ? pill.textOn : pill.textOff}>{type}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isOtherType && (
          <TextInput
            placeholder="e.g., Duplex, Farmhouse, Commercial Lot"
            value={customPropertyType}
            onChangeText={(val) => {
              setCustomPropertyType(val);
              if (errors.property_type) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.property_type;
                  return next;
                });
              }
            }}
            error={errors.property_type}
          />
        )}

        <Text style={styles.label}>Condition</Text>
        <View style={styles.conditionGrid}>
          {CONDITIONS.map((condition) => {
            const active = formData.condition === condition;
            return (
              <TouchableOpacity
                key={condition}
                style={[pill.base, active ? pill.on : pill.off, styles.conditionButton]}
                onPress={() => updateFormData('condition', condition)}
              >
                <Text style={active ? pill.textOn : pill.textOff}>{condition}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Rooms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rooms</Text>
        <Stepper
          label="Bedrooms"
          value={formData.bedrooms}
          onChange={(next) => updateFormData('bedrooms', next)}
          max={10}
        />
        <Stepper
          label="Bathrooms"
          value={formData.bathrooms}
          onChange={(next) => updateFormData('bathrooms', next)}
          max={10}
          step={0.5}
        />
        <Stepper
          label="Parking"
          value={parseInt(parkingText, 10) || 0}
          onChange={(next) => handleParkingChange(String(next))}
          max={10}
        />
        {(!!errors.bedrooms || !!errors.bathrooms) && (
          <Text style={styles.errorText}>{errors.bedrooms || errors.bathrooms}</Text>
        )}
      </View>

      {/* Size & Age */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Size and age</Text>

        <View style={styles.sizeLabelRow}>
          <Text style={styles.label}>Floor area</Text>
          <View style={styles.segmented}>
            <TouchableOpacity
              style={[pill.base, styles.segmentButton, sizeUnit === 'sqm' ? pill.on : pill.off]}
              onPress={() => handleUnitChange('sqm')}
            >
              <Text style={sizeUnit === 'sqm' ? pill.textOn : pill.textOff}>m²</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pill.base, styles.segmentButton, sizeUnit === 'sqft' ? pill.on : pill.off]}
              onPress={() => handleUnitChange('sqft')}
            >
              <Text style={sizeUnit === 'sqft' ? pill.textOn : pill.textOff}>sq ft</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          placeholder={sizeUnit === 'sqft' ? 'e.g., 2000' : 'e.g., 186'}
          keyboardType="numeric"
          value={sizeText}
          onChangeText={handleSizeChange}
          error={errors.square_feet}
        />

        <TextInput
          label="Year Built"
          placeholder={isLand ? 'e.g., 1985 — leave blank if not applicable' : 'e.g., 1985'}
          keyboardType="numeric"
          value={yearText}
          onChangeText={handleYearChange}
          error={errors.year_built}
        />
      </View>

      {/* Navigation */}
      <View style={styles.footer}>
        <Button title="Continue" size="large" onPress={handleSubmit} />
        <Text style={styles.footnote}>
          Uses 1 of your {reportsRemainingThisMonth} free reports this month
        </Text>
      </View>
    </SafeAreaWrapper>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: theme.space.xl,
  },
  title: {
    ...theme.type.heading,
    color: theme.color.text,
    marginBottom: theme.space.xs,
  },
  subtitle: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
  },
  section: {
    marginBottom: theme.space['2xl'],
    paddingTop: theme.space.xl,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  sectionTitle: {
    ...theme.type.subheading,
    color: theme.color.text,
    marginBottom: theme.space.lg,
  },
  label: {
    ...theme.type.label,
    color: theme.color.text,
    marginTop: theme.space.md,
    marginBottom: theme.space.md,
  },
  errorText: {
    ...theme.type.caption,
    color: theme.color.danger,
    marginTop: theme.space.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space.md + 2,
  },
  stepperLabel: {
    ...theme.type.body,
    color: theme.color.text,
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md + 2,
  },
  stepperButton: {
    width: theme.size.tapMin,
    height: theme.size.tapMin,
    borderRadius: theme.size.tapMin / 2,
    borderWidth: 1,
    borderColor: theme.color.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    ...theme.type.subheading,
    color: theme.color.text,
  },
  stepperButtonTextDisabled: {
    color: theme.color.textFaint,
  },
  stepperValue: {
    ...theme.type.subheading,
    color: theme.color.text,
    minWidth: 24,
    textAlign: 'center',
  },
  sizeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space.sm,
  },
  segmented: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  segmentButton: {
    paddingVertical: theme.space.xs + 2,
    paddingHorizontal: theme.space.md,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm + 2,
    marginBottom: theme.space.lg,
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm + 2,
  },
  conditionButton: {
    flexGrow: 1,
    alignItems: 'center',
  },
  footer: {
    marginTop: theme.space.md,
    marginBottom: theme.space['4xl'] + theme.space['2xl'],
  },
  footnote: {
    ...theme.type.caption,
    color: theme.color.textMuted,
    textAlign: 'center',
    marginTop: theme.space.md,
  },
});
