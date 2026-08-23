import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useReportStore } from '../../stores/report.store';
import { PropertyDetailsFormData } from '../../types';

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Land'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

export default function PropertyDetails() {
  const router = useRouter();
  const currentProperty = useReportStore((state) => state.currentProperty);
  const setCurrentPropertyDetails = useReportStore((state) => state.setCurrentPropertyDetails);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PropertyDetailsFormData>({
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 2000,
    year_built: 2000,
    property_type: 'Single Family',
    condition: 'Good',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (formData.bedrooms < 0 || formData.bedrooms > 10) {
        newErrors.bedrooms = 'Please enter 0-10 bedrooms';
      }
      if (formData.bathrooms < 0 || formData.bathrooms > 10) {
        newErrors.bathrooms = 'Please enter 0-10 bathrooms';
      }
    } else if (stepNum === 2) {
      if (formData.square_feet < 100 || formData.square_feet > 50000) {
        newErrors.square_feet = 'Please enter 100-50,000 sq ft';
      }
      if (formData.year_built < 1800 || formData.year_built > new Date().getFullYear()) {
        newErrors.year_built = `Please enter year between 1800 and ${new Date().getFullYear()}`;
      }
    }

    setErrors(newErrors);
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

  const handleSubmit = () => {
    if (validateStep(3)) {
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
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(step / 3) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.stepIndicator}>
          Step {step} of 3
        </Text>
      </View>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <View>
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
      )}

      {/* Step 2: Size & Age */}
      {step === 2 && (
        <View>
          <Text style={styles.sectionTitle}>Size & Age</Text>

          <TextInput
            label="Square Feet"
            placeholder="e.g., 2000"
            keyboardType="numeric"
            value={formData.square_feet.toString()}
            onChangeText={(val) => updateFormData('square_feet', parseInt(val) || 0)}
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
      )}

      {/* Step 3: Type & Condition */}
      {step === 3 && (
        <View>
          <Text style={styles.sectionTitle}>Property Type</Text>

          <Text style={styles.label}>Type</Text>
          <View style={styles.buttonGroup}>
            {PROPERTY_TYPES.map((type) => (
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
        {step < 3 ? (
          <Button title="Next" size="large" onPress={handleNext} />
        ) : (
          <Button title="Generate Valuation" size="large" onPress={handleSubmit} />
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
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
