import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { BrokerProfile } from '../../types';
import { theme } from '../../theme';

type FieldKey = 'company_name' | 'license_number' | 'phone' | 'website' | 'bio';

interface FieldConfig {
  title: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
}

const FIELD_CONFIG: Record<FieldKey, FieldConfig> = {
  company_name: {
    title: 'Company Name',
    label: 'Company Name',
    placeholder: 'e.g., Smith & Associates Realty',
    required: true,
  },
  license_number: {
    title: 'Real Estate License #',
    label: 'Real Estate License #',
    placeholder: 'Your license number',
  },
  phone: {
    title: 'Phone',
    label: 'Phone',
    placeholder: '',
  },
  website: {
    title: 'Website',
    label: 'Website',
    placeholder: 'https://yoursite.com',
  },
  bio: {
    title: 'Bio',
    label: 'Bio',
    placeholder: 'Tell consumers a bit about yourself and your experience...',
    multiline: true,
  },
};

/** Single-field editor opened from a row on the profile summary screen —
 * saves just that one column instead of routing through the full edit form. */
export default function EditProfileField() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field: string }>();
  const user = useAuthStore((state) => state.user);
  const fieldKey: FieldKey = field && field in FIELD_CONFIG ? (field as FieldKey) : 'company_name';
  const config = FIELD_CONFIG[fieldKey];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.id) return;
        setLoading(true);
        const { profile } = await brokerService.getProfile(user.id);
        if (profile) {
          setValue((profile[fieldKey] as string | undefined) || '');
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, fieldKey]);

  const handleChange = (text: string) => {
    setValue(text);
    if (error) setError('');
  };

  const handleSave = async () => {
    if (!user?.id) return;

    if (config.required && !value.trim()) {
      setError(`${config.label} is required`);
      return;
    }

    try {
      setSaving(true);
      const { success, error: saveError } = await brokerService.updateProfile(user.id, {
        [fieldKey]: value,
      } as Partial<BrokerProfile>);

      if (!success) {
        Alert.alert('Error', saveError?.message || 'Failed to save');
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
      <Text style={styles.title}>{config.title}</Text>

      {fieldKey === 'phone' ? (
        <PhoneInput label={config.label} value={value} onChangeText={handleChange} error={error} />
      ) : (
        <TextInput
          label={config.label}
          placeholder={config.placeholder}
          value={value}
          onChangeText={handleChange}
          error={error}
          multiline={config.multiline}
          numberOfLines={config.multiline ? 4 : 1}
        />
      )}

      <Button
        title="Save"
        size="large"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={{ marginTop: 8 }}
      />
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
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 20,
  },
});
