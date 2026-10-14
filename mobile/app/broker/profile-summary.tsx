import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { IconChevronRight } from '../../components/ui/icons';
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

  const goToEdit = () => router.push('/broker/profile');

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

      <TouchableOpacity style={styles.identityCard} onPress={goToEdit} activeOpacity={0.7}>
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
        <View style={styles.identityText}>
          <Text style={styles.identityName} numberOfLines={1}>
            {profile?.company_name || 'Add your company name'}
          </Text>
          {!!profile?.tier && <Text style={styles.identityBadge}>{profile.tier}</Text>}
        </View>
        <IconChevronRight size={18} color={theme.color.track} />
      </TouchableOpacity>

      {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      <View style={styles.list}>
        <ProfileRow
          label="Company Name"
          value={profile?.company_name || 'Not set'}
          onPress={goToEdit}
        />
        <ProfileRow
          label="Real Estate License #"
          value={profile?.license_number || 'Not set'}
          onPress={goToEdit}
        />
        <ProfileRow label="Phone" value={profile?.phone || 'Not set'} onPress={goToEdit} />
        <ProfileRow label="Website" value={profile?.website || 'Not set'} onPress={goToEdit} />
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.color.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarIcon: {
    fontSize: 28,
  },
  identityText: {
    flex: 1,
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
  bio: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
    marginBottom: 24,
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
