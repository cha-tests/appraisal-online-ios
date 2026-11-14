import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { IconPencil, IconX } from '../../components/ui/icons';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { authService } from '../../services/auth.service';
import { chooseAttachmentSource, withRetry } from '../../utils/attachments';
import { BrokerProfile } from '../../types';
import { theme } from '../../theme';

export default function BrokerProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    license_number: '',
    bio: '',
    phone: '',
    website: '',
    profile_photo_url: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
            profile_photo_url: brokerProfile.profile_photo_url || '',
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

  // Uploads immediately on pick rather than staging it for "Save Changes"
  // — the storage round-trip already has its own success/failure feedback,
  // and deferring it would mean silently losing the picked photo if the
  // user backs out before saving the rest of the form.
  const pickProfilePhoto = async () => {
    if (!user?.id) return;

    const picked = await chooseAttachmentSource({ title: 'Profile Photo' });
    if (!picked) return;

    try {
      setUploadingPhoto(true);
      const uploaded = await withRetry(() => brokerService.uploadProfilePhoto(user.id, picked.uri));
      if (!uploaded.success || !uploaded.url) {
        Alert.alert('Error', uploaded.error || 'Failed to upload photo');
        return;
      }

      // Saved right away, independent of "Save Changes" below — otherwise
      // the file would be uploaded but its link never persisted if the
      // broker backs out before saving the rest of the form.
      const { profile: updated } = await brokerService.updateProfile(user.id, {
        profile_photo_url: uploaded.url,
      } as any);

      setFormData((prev) => ({ ...prev, profile_photo_url: uploaded.url! }));
      if (updated) setProfile(updated);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeProfilePhoto = () => {
    if (!user?.id) return;
    Alert.alert('Remove Photo', 'Remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { profile: updated } = await brokerService.updateProfile(user.id, {
            profile_photo_url: '',
          } as any);
          setFormData((prev) => ({ ...prev, profile_photo_url: '' }));
          if (updated) setProfile(updated);
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel', onPress: () => {} },
      {
        text: 'Sign Out',
        onPress: async () => {
          try {
            setSigningOut(true);
            const result = await authService.signout();
            // signout() reports failure by returning success: false rather
            // than throwing, so this needs handling here or a failed sign out
            // leaves the user on the page with no feedback at all.
            if (!result.success) {
              Alert.alert('Error', result.error?.message ?? 'Failed to sign out');
              return;
            }
            // clear() rather than setUser(null) so the cached broker profile
            // goes with it and cannot leak into the next session.
            clearAuth();
            // replace, not push: the signed-in screens must not stay on the
            // history stack where Back could return to them after sign out.
            router.replace('/auth/login');
          } catch (err) {
            console.error('Error signing out:', err);
            Alert.alert('Error', 'Failed to sign out');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.back()}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      {/* Profile Photo Section */}
      <Card variant="default" style={styles.photoCard}>
        {formData.profile_photo_url ? (
          <View style={styles.photoWrapper}>
            <Image
              source={{ uri: formData.profile_photo_url }}
              style={styles.photoPlaceholder}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.photoEditBadge}
              onPress={pickProfilePhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={theme.color.onAccent} />
              ) : (
                <IconPencil size={14} color={theme.color.onAccent} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoRemoveBadge}
              onPress={removeProfilePhoto}
              disabled={uploadingPhoto}
            >
              <IconX size={12} color={theme.color.onAccent} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoContainer}>
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📸</Text>
            </View>
            <Button
              title="Add Photo"
              variant="outline"
              size="small"
              onPress={pickProfilePhoto}
              loading={uploadingPhoto}
              disabled={uploadingPhoto}
            />
          </View>
        )}
        {!formData.profile_photo_url && (
          <Text style={styles.photoHelper}>
            Add a professional photo to your profile to attract more connections
          </Text>
        )}
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

      <PhoneInput
        label="Phone"
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
              {formData.profile_photo_url ? (
                <Image
                  source={{ uri: formData.profile_photo_url }}
                  style={styles.previewPhotoContainer}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewPhotoContainer}>
                  <Text style={styles.previewPhotoIcon}>📸</Text>
                </View>
              )}
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>{formData.company_name || 'Company Name'}</Text>
                <Text style={styles.previewBadge}>{profile.tier}</Text>
              </View>
            </View>

            {!!formData.bio && (
              <>
                <View style={styles.previewDivider} />
                <Text style={styles.previewBio}>{formData.bio}</Text>
              </>
            )}

            <View style={styles.previewDivider} />

            <View style={styles.previewContact}>
              {!!formData.phone && (
                <Text style={styles.previewContactItem}>📱 {formData.phone}</Text>
              )}
              {!!formData.website && (
                <Text style={styles.previewContactItem}>🌐 {formData.website}</Text>
              )}
            </View>
          </Card>
        </>
      )}

      {/* Account Settings Link */}
      <Card variant="outlined" style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Account Settings</Text>
        <TouchableOpacity onPress={() => router.push('/broker/settings')}>
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
          disabled={saving || signingOut}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Cancel"
          variant="outline"
          size="large"
          onPress={() => router.back()}
          disabled={saving || signingOut}
        />

        <View style={styles.signOutSection}>
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={saving || signingOut}
            style={styles.signOutButton}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={styles.signOutText}>Sign Out</Text>
            )}
          </TouchableOpacity>
        </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text,
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
  photoWrapper: {
    position: 'relative',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.color.text,
    borderWidth: 2,
    borderColor: theme.color.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.color.danger,
    borderWidth: 2,
    borderColor: theme.color.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: theme.color.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
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
    color: theme.color.text,
    marginBottom: 4,
  },
  previewBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.accent,
    backgroundColor: theme.color.accentWash,
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
    color: theme.color.text,
    lineHeight: 20,
  },
  previewContact: {
    gap: 6,
  },
  previewContactItem: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  settingsCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    marginBottom: 24,
    marginTop: 24,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
  },
  settingsLink: {
    fontSize: 14,
    color: theme.color.accent,
    fontWeight: '600',
  },
  footer: {
    marginBottom: 32,
  },
  signOutSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
});
