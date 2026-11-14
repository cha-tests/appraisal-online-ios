import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { authService } from '../../services/auth.service';
import { BrokerProfile } from '../../types';
import { theme } from '../../theme';

type ProfileFieldKey = 'company_name' | 'license_number' | 'phone' | 'website' | 'bio';
type FieldKey = ProfileFieldKey | 'full_name';

interface FieldConfig {
  title: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
}

const FIELD_CONFIG: Record<FieldKey, FieldConfig> = {
  full_name: {
    title: 'Full Name',
    label: 'Full Name',
    placeholder: '',
    required: true,
  },
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
 * saves just that one column instead of routing through the full edit form.
 * "full_name" is the one exception: it edits first/last/suffix on the
 * account itself (the `users` table), not the broker_profiles row the other
 * fields live on. */
export default function EditProfileField() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field: string }>();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const fieldKey: FieldKey = field && field in FIELD_CONFIG ? (field as FieldKey) : 'company_name';
  const config = FIELD_CONFIG[fieldKey];
  const isFullName = fieldKey === 'full_name';

  const [loading, setLoading] = useState(!isFullName);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState('');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [suffix, setSuffix] = useState(user?.suffix || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isFullName) return;

    const load = async () => {
      try {
        if (!user?.id) return;
        setLoading(true);
        const { profile } = await brokerService.getProfile(user.id);
        if (profile) {
          setValue((profile[fieldKey as ProfileFieldKey] as string | undefined) || '');
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, fieldKey, isFullName]);

  const handleChange = (text: string) => {
    setValue(text);
    if (errors.value) setErrors({});
  };

  const handleSaveProfileField = async () => {
    if (!user?.id) return;

    if (config.required && !value.trim()) {
      setErrors({ value: `${config.label} is required` });
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

  const handleSaveFullName = async () => {
    if (!user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setSaving(true);
      const result = await authService.updateUserProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        suffix: suffix.trim() || undefined,
      });

      if (!result.success || !result.user) {
        Alert.alert('Error', result.error?.message || 'Failed to save');
        return;
      }

      setUser({ ...user, ...result.user });
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

      {isFullName ? (
        <>
          <TextInput
            label="First Name"
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.firstName}
          />
          <TextInput
            label="Last Name"
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
            error={errors.lastName}
            style={{ marginTop: 12 }}
          />
          <TextInput
            label="Suffix (optional)"
            placeholder="Jr., Sr., III"
            value={suffix}
            onChangeText={setSuffix}
            style={{ marginTop: 12 }}
          />
        </>
      ) : fieldKey === 'phone' ? (
        <PhoneInput label={config.label} value={value} onChangeText={handleChange} error={errors.value} />
      ) : (
        <TextInput
          label={config.label}
          placeholder={config.placeholder}
          value={value}
          onChangeText={handleChange}
          error={errors.value}
          multiline={config.multiline}
          numberOfLines={config.multiline ? 4 : 1}
        />
      )}

      <Button
        title="Save"
        size="large"
        onPress={isFullName ? handleSaveFullName : handleSaveProfileField}
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
