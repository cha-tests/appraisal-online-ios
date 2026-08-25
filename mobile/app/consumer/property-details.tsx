import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useReportStore } from '../../stores/report.store';
import { PropertyDetailsFormData } from '../../types';
import { getMarketConfig, type SizeUnit } from '../../config/marketConfig';

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

// square_feet stays the one value that is stored, sent to the backend, and
// fed into the valuation prompt — the same field the DB column and
// PropertyDetailsFormData type already use. The toggle only changes how that
// number is entered and displayed; it never changes what gets saved.
const SQFT_PER_SQM = 10.7639;
const sqftToSqm = (sqft: number) => sqft / SQFT_PER_SQM;
const sqmToSqft = (sqm: number) => sqm * SQFT_PER_SQM;

export default function PropertyDetails() {
  const router = useRouter();
  const currentProperty = useReportStore((state) => state.currentProperty);
  const setCurrentPropertyDetails = useReportStore((state) => state.setCurrentPropertyDetails);

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
    year_built: 2000,
    property_type: market.propertyTypes[0],
    condition: 'Good',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(market.sizeUnit);
  // Text the size field shows, in sizeUnit. Kept separate from
  // formData.square_feet (always sqft) so switching units doesn't compound
  // rounding on every toggle, and so a half-typed number isn't clobbered by
  // a live sqft<->sqm conversion on every keystroke.
  const [sizeText, setSizeText] = useState(
    sizeUnit === 'sqft'
      ? String(formData.square_feet)
      : String(Math.round(sqftToSqm(formData.square_feet)))
  );

  const handleUnitChange = (unit: SizeUnit) => {
    if (unit === sizeUnit) return;
    setSizeUnit(unit);
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
    if (formData.year_built < 1800 || formData.year_built > new Date().getFullYear()) {
      newErrors.year_built = `Please enter year between 1800 and ${new Date().getFullYear()}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateAll()) {
      setCurrentPropertyDetails(formData);
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
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Property Details</Text>
        <Text style={styles.subtitle}>
          {currentProperty?.address}
        </Text>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>

        <TextInput
          label="Bedrooms"
          placeholder="e.g., 3"
          keyboardType="numeric"
          value={formData.bedrooms.toString()}
          onChangeText={(val) => updateFormData('bedrooms', parseInt(val) || 0)}
          error={errors.bedrooms}
        />

        <TextInput
          label="Bathrooms"
          placeholder="e.g., 2.5"
          keyboardType="decimal-pad"
          value={formData.bathrooms.toString()}
          onChangeText={(val) => updateFormData('bathrooms', parseFloat(val) || 0)}
          error={errors.bathrooms}
        />
      </View>

      {/* Size & Age */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Size & Age</Text>

        <View style={styles.sizeLabelRow}>
          <Text style={styles.label}>Property Size</Text>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitButton, sizeUnit === 'sqm' && styles.unitButtonActive]}
              onPress={() => handleUnitChange('sqm')}
            >
              <Text
                style={[styles.unitButtonText, sizeUnit === 'sqm' && styles.unitButtonTextActive]}
              >
                m²
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitButton, sizeUnit === 'sqft' && styles.unitButtonActive]}
              onPress={() => handleUnitChange('sqft')}
            >
              <Text
                style={[styles.unitButtonText, sizeUnit === 'sqft' && styles.unitButtonTextActive]}
              >
                sq ft
              </Text>
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
          placeholder="e.g., 2000"
          keyboardType="numeric"
          value={formData.year_built.toString()}
          onChangeText={(val) => updateFormData('year_built', parseInt(val) || new Date().getFullYear())}
          error={errors.year_built}
        />
      </View>

      {/* Type & Condition */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Type</Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.buttonGroup}>
          {market.propertyTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                formData.property_type === type && styles.typeButtonActive,
              ]}
              onPress={() => updateFormData('property_type', type)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  formData.property_type === type && styles.typeButtonTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Condition</Text>
        <View style={styles.conditionGrid}>
          {CONDITIONS.map((condition) => (
            <TouchableOpacity
              key={condition}
              style={[
                styles.conditionButton,
                formData.condition === condition && styles.conditionButtonActive,
              ]}
              onPress={() => updateFormData('condition', condition)}
            >
              <Text
                style={[
                  styles.conditionButtonText,
                  formData.condition === condition && styles.conditionButtonTextActive,
                ]}
              >
                {condition}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Navigation */}
      <View style={styles.footer}>
        <Button title="Generate Valuation" size="large" onPress={handleSubmit} />
        <Button
          title="Back"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          style={{ marginTop: 12 }}
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  section: {
    marginBottom: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  sizeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  unitButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  unitButtonActive: {
    backgroundColor: '#2563EB',
  },
  unitButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#2563EB',
  },
  conditionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  conditionButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  conditionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  conditionButtonTextActive: {
    color: '#2563EB',
  },
  footer: {
    marginBottom: 24,
  },
});
