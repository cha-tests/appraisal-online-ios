import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { BrokerProfile } from '../../types';

export default function BrokerProfile() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    license_number: '',
    bio: '',
    phone: '',
    website: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);
        const { profile: brokerProfile } = await brokerService.getProfile(user.id);

        if (brokerProfile) {
          setProfile(brokerProfile);
          setFormData({
            company_name: brokerProfile.company_name,
            license_number: brokerProfile.license_number || '',
            bio: brokerProfile.bio || '',
            phone: brokerProfile.phone || '',
            website: brokerProfile.website || '',
          });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    try {
      if (!validateForm() || !user?.id) return;

      setSaving(true);

      const { profile: updated } = await brokerService.updateProfile(user.id, {
        ...formData,
      } as any);

      if (updated) {
        setProfile(updated);
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      {/* Profile Photo Section */}
      <Card variant="default" style={styles.photoCard}>
        <View style={styles.photoContainer}>
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📸</Text>
          </View>
          <Button
            title="Add Photo"
            variant="outline"
            size="small"
            onPress={() => {
              Alert.alert('Feature', 'Photo upload coming soon');
            }}
          />
        </View>
        <Text style={styles.photoHelper}>
          Add a professional photo to your profile to attract more connections
        </Text>
      </Card>

      {/* Company Information */}
      <Text style={styles.sectionTitle}>Company Information</Text>

      <TextInput
        label="Company Name"
        placeholder="e.g., Smith & Associates Realty"
        value={formData.company_name}
        onChangeText={(val) => setFormData((prev) => ({ ...prev, company_name: val }))}
        error={errors.company_name}
      />

      <TextInput
        label="Real Estate License #"
        placeholder="Your license number"
        value={formData.license_number}
        onChangeText={(val) => setFormData((prev) => ({ ...prev, license_number: val }))}
      />

      <TextInput
        label="Phone"
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
        value={formData.phone}
        onChangeText={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
      />

      <TextInput
        label="Website"
        placeholder="https://yoursite.com"
        value={formData.website}
        onChangeText={(val) => setFormData((prev) => ({ ...prev, website: val }))}
      />

      {/* About Section */}
      <Text style={styles.sectionTitle}>About You</Text>

      <TextInput
        label="Bio"
        placeholder="Tell consumers a bit about yourself and your experience..."
        multiline={true}
        numberOfLines={4}
        value={formData.bio}
        onChangeText={(val) => setFormData((prev) => ({ ...prev, bio: val }))}
      />

      {/* Profile Preview */}
      {profile && (
        <>
          <Text style={styles.sectionTitle}>How You'll Appear</Text>

          <Card variant="elevated" style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewPhotoContainer}>
                <Text style={styles.previewPhotoIcon}>📸</Text>
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>{formData.company_name || 'Company Name'}</Text>
                <Text style={styles.previewBadge}>{profile.tier}</Text>
              </View>
            </View>

            {formData.bio && (
              <>
                <View style={styles.previewDivider} />
                <Text style={styles.previewBio}>{formData.bio}</Text>
              </>
            )}

            <View style={styles.previewDivider} />

            <View style={styles.previewContact}>
              {formData.phone && (
                <Text style={styles.previewContactItem}>📱 {formData.phone}</Text>
              )}
              {formData.website && (
                <Text style={styles.previewContactItem}>🌐 {formData.website}</Text>
              )}
            </View>
          </Card>
        </>
      )}

      {/* Account Settings Link */}
      <Card variant="outlined" style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Account Settings</Text>
        <TouchableOpacity onPress={() => Alert.alert('Feature', 'Settings coming soon')}>
          <Text style={styles.settingsLink}>Manage Notifications & Preferences →</Text>
        </TouchableOpacity>
      </Card>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title="Save Changes"
          size="large"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Cancel"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          disabled={saving}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  photoCard: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoIcon: {
    fontSize: 48,
  },
  photoHelper: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 24,
  },
  previewCard: {
    backgroundColor: '#F0F9FF',
    marginBottom: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewPhotoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewPhotoIcon: {
    fontSize: 32,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  previewBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#BFDBFE',
    marginVertical: 12,
  },
  previewBio: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  previewContact: {
    gap: 6,
  },
  previewContactItem: {
    fontSize: 13,
    color: '#6B7280',
  },
  settingsCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    marginBottom: 24,
    marginTop: 24,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  settingsLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  footer: {
    marginBottom: 32,
  },
});
