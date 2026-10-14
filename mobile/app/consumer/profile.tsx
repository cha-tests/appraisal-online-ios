import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { useAuthStore } from '../../stores/auth.store';
import { authService } from '../../services/auth.service';
import { useRequireAccount } from '../../hooks/useRequireAccount';

export default function ConsumerProfile() {
  const router = useRouter();
  const user = useRequireAccount();
  const setUser = useAuthStore((state) => state.setUser);

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [suffix, setSuffix] = useState(user?.suffix || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!phone.trim()) {
      newErrors.phone = 'Mobile number is required';
    } else {
      const digitCount = phone.replace(/\D/g, '').length;
      if (digitCount < 7 || digitCount > 15) {
        newErrors.phone = 'Please enter a valid mobile number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.id) return;

    try {
      setSaving(true);

      const result = await authService.updateUserProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        suffix: suffix.trim() || undefined,
        phone: phone.trim(),
      });

      if (result.success && result.user) {
        setUser({ ...user, ...result.user });
        Alert.alert('Success', 'Profile updated successfully');
        router.back();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Error saving consumer profile:', err);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="← Back"
          variant="outline"
          size="small"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start' }}
        />
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Update your name and contact info</Text>
      </View>

      <View style={styles.form}>
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

        <PhoneInput
          label="Mobile Number"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          style={{ marginTop: 12 }}
        />
      </View>

      <View style={styles.footer}>
        <Button
          title="Save Changes"
          size="large"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={{ marginBottom: 12 }}
        />
        <Button title="Cancel" variant="outline" size="large" onPress={() => router.back()} disabled={saving} />
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
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  form: {
    marginBottom: 24,
  },
  footer: {
    marginBottom: 32,
  },
});
