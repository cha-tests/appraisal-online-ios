import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { IconChevronRight, IconPencil } from '../../components/ui/icons';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { BrokerProfile } from '../../types';
import { theme } from '../../theme';

function ProfileRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <IconChevronRight size={18} color={theme.color.track} />
    </TouchableOpacity>
  );
}

export default function BrokerProfileSummary() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.id) return;
        setLoading(true);
        const { profile: brokerProfile } = await brokerService.getProfile(user.id);
        if (brokerProfile) setProfile(brokerProfile);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  const editField = (field: string) =>
    router.push({ pathname: '/broker/edit-field', params: { field } });

  // Same upload-immediately approach as the full edit screen — the storage
  // round-trip already has its own success/failure feedback, and the result
  // shows on this screen right away rather than needing a separate save step.
  const pickProfilePhoto = async () => {
    if (!user?.id) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library access is needed to add a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (result.canceled || !result.assets?.[0]) return;

    try {
      setUploadingPhoto(true);
      const uploaded = await brokerService.uploadProfilePhoto(user.id, result.assets[0].uri);
      if (!uploaded.success || !uploaded.url) {
        Alert.alert('Error', uploaded.error || 'Failed to upload photo');
        return;
      }

      const { profile: updated } = await brokerService.updateProfile(user.id, {
        profile_photo_url: uploaded.url,
      });
      if (updated) setProfile(updated);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fullName = [user?.first_name, user?.last_name, user?.suffix]
    .filter(Boolean)
    .join(' ');

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
      <Text style={styles.title}>Profile</Text>

      <View style={styles.identityCard}>
        <View style={styles.avatarWrapper}>
          {profile?.profile_photo_url ? (
            <Image
              source={{ uri: profile.profile_photo_url }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarIcon}>📸</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.avatarEditBadge}
            onPress={pickProfilePhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={theme.color.onAccent} />
            ) : (
              <IconPencil size={12} color={theme.color.onAccent} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.identityText}>
          {!!fullName && (
            <Text style={styles.identityFullName} numberOfLines={1}>
              {fullName}
            </Text>
          )}
          <Text style={styles.identityName} numberOfLines={1}>
            {profile?.company_name || 'Add your company name'}
          </Text>
          {!!profile?.tier && <Text style={styles.identityBadge}>{profile.tier}</Text>}
        </View>
      </View>

      <View style={styles.list}>
        <ProfileRow
          label="Company Name"
          value={profile?.company_name || 'Not set'}
          onPress={() => editField('company_name')}
        />
        <ProfileRow
          label="Real Estate License #"
          value={profile?.license_number || 'Not set'}
          onPress={() => editField('license_number')}
        />
        <ProfileRow
          label="Phone"
          value={profile?.phone || 'Not set'}
          onPress={() => editField('phone')}
        />
        <ProfileRow
          label="Website"
          value={profile?.website || 'Not set'}
          onPress={() => editField('website')}
        />
        <ProfileRow
          label="Bio"
          value={profile?.bio || 'Not set'}
          onPress={() => editField('bio')}
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 20,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.color.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    fontSize: 28,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.color.text,
    borderWidth: 2,
    borderColor: theme.color.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityText: {
    flex: 1,
  },
  identityFullName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.textMuted,
    marginBottom: 2,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 4,
  },
  identityBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.accent,
    backgroundColor: theme.color.accentWash,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 13,
    color: theme.color.textMuted,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text,
  },
});
