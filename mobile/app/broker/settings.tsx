import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { TextInput } from '../../components/ui/TextInput';
import { useAuthStore } from '../../stores/auth.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { brokerService } from '../../services/broker.service';
import { signOut } from '../../services/supabase';
import { BrokerProfile } from '../../types';

const QUIET_HOURS_OPTIONS = [
  '6:00 PM - 8:00 AM',
  '7:00 PM - 9:00 AM',
  '8:00 PM - 10:00 AM',
  '9:00 PM - 11:00 AM',
  'Disable Quiet Hours',
];

const DIGEST_TIMES = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '6:00 PM', value: '18:00' },
];

export default function BrokerSettings() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const brokerProfile = useAuthStore((state) => state.brokerProfile);
  const selectedTier = useSubscriptionStore((state) => state.selectedTier);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: selectedTier === 'Founder Lifetime',
    quietHoursEnabled: false,
    quietHours: '6:00 PM - 8:00 AM',
    digestTime: '09:00',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);
        const { profile: fetchedProfile } = await brokerService.getProfile(user.id);

        if (fetchedProfile) {
          setProfile(fetchedProfile);
          // Load saved preferences if available
          if (fetchedProfile.notification_preferences) {
            setPreferences((prev) => ({
              ...prev,
              ...fetchedProfile.notification_preferences,
            }));
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        Alert.alert('Error', 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  const handleSavePreferences = async () => {
    try {
      if (!user?.id) return;

      setSaveStatus('saving');

      // Update preferences in database
      const result = await brokerService.updateNotificationPreferences(
        user.id,
        preferences
      );

      if (result.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        Alert.alert('Success', 'Your preferences have been saved');
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to save preferences');
        setSaveStatus('idle');
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred while saving preferences');
      setSaveStatus('idle');
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Sign Out',
        onPress: async () => {
          try {
            await signOut();
            useAuthStore.getState().clear();
            router.replace('/auth/login');
          } catch (err) {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

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
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your notification preferences</Text>
      </View>

      {/* Notification Channels */}
      <Text style={styles.sectionTitle}>📬 Notification Channels</Text>

      <Card variant="default" style={styles.preferenceCard}>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <Text style={styles.preferenceLabel}>Email Notifications</Text>
            <Text style={styles.preferenceHelper}>Receive updates via email</Text>
          </View>
          <Toggle
            value={preferences.emailNotifications}
            onToggle={(val) =>
              setPreferences((prev) => ({ ...prev, emailNotifications: val }))
            }
          />
        </View>
      </Card>

      <Card variant="default" style={styles.preferenceCard}>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <Text style={styles.preferenceLabel}>Push Notifications</Text>
            <Text style={styles.preferenceHelper}>Get alerts on your phone</Text>
          </View>
          <Toggle
            value={preferences.pushNotifications}
            onToggle={(val) =>
              setPreferences((prev) => ({ ...prev, pushNotifications: val }))
            }
          />
        </View>
      </Card>

      {selectedTier === 'Founder Lifetime' && (
        <Card variant="default" style={styles.preferenceCard}>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceContent}>
              <Text style={styles.preferenceLabel}>SMS Text Messages</Text>
              <Text style={styles.preferenceHelper}>Get instant notifications by text</Text>
            </View>
            <Toggle
              value={preferences.smsNotifications}
              onToggle={(val) =>
                setPreferences((prev) => ({ ...prev, smsNotifications: val }))
              }
            />
          </View>
        </Card>
      )}

      {/* Quiet Hours (Founder only) */}
      {selectedTier === 'Founder Lifetime' && (
        <>
          <Text style={styles.sectionTitle}>🤫 Quiet Hours</Text>
          <Text style={styles.sectionHelper}>
            Disable notifications during these hours
          </Text>

          <Card variant="default" style={styles.preferenceCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceLabel}>Enable Quiet Hours</Text>
                <Text style={styles.preferenceHelper}>
                  No notifications outside your preference
                </Text>
              </View>
              <Toggle
                value={preferences.quietHoursEnabled}
                onToggle={(val) =>
                  setPreferences((prev) => ({ ...prev, quietHoursEnabled: val }))
                }
              />
            </View>
          </Card>

          {preferences.quietHoursEnabled && (
            <Card variant="outlined" style={styles.timeSelectCard}>
              <Text style={styles.quietHourLabel}>Select Quiet Hours Range:</Text>
              {QUIET_HOURS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.timeOption,
                    preferences.quietHours === option && styles.timeOptionSelected,
                  ]}
                  onPress={() =>
                    setPreferences((prev) => ({ ...prev, quietHours: option }))
                  }
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      preferences.quietHours === option && styles.timeOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Weekly Digest Time (Basic tier only) */}
      {selectedTier === 'Basic Annual' && (
        <>
          <Text style={styles.sectionTitle}>📅 Weekly Digest</Text>
          <Text style={styles.sectionHelper}>
            Select the time to receive your weekly digest (Mondays)
          </Text>

          <Card variant="outlined" style={styles.timeSelectCard}>
            <Text style={styles.quietHourLabel}>Select Digest Time:</Text>
            {DIGEST_TIMES.map((time) => (
              <TouchableOpacity
                key={time.value}
                style={[
                  styles.timeOption,
                  preferences.digestTime === time.value && styles.timeOptionSelected,
                ]}
                onPress={() =>
                  setPreferences((prev) => ({ ...prev, digestTime: time.value }))
                }
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    preferences.digestTime === time.value &&
                      styles.timeOptionTextSelected,
                  ]}
                >
                  {time.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        </>
      )}

      {/* Privacy & Data */}
      <Text style={styles.sectionTitle}>🔐 Privacy & Data</Text>

      <Card variant="outlined" style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Your Information</Text>
        <Text style={styles.privacyText}>
          We protect your data and never share it with anyone. Your personal
          information is encrypted and stored securely.
        </Text>
      </Card>

      <Button
        title="Export My Data"
        variant="outline"
        size="medium"
        onPress={() =>
          Alert.alert('Coming Soon', 'Data export feature will be available soon')
        }
        style={{ marginBottom: 12 }}
      />

      <Button
        title="Delete My Account"
        variant="outline"
        size="medium"
        onPress={() => {
          Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all data. This cannot be undone.',
            [
              { text: 'Cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  Alert.alert('Submitted', 'Your deletion request has been submitted.'),
              },
            ]
          );
        }}
      />

      {/* Account Information */}
      <Text style={styles.sectionTitle}>ℹ️ Account Information</Text>

      <Card variant="default" style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Account Type</Text>
          <Text style={styles.infoValue}>{selectedTier || 'Broker'}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member Since</Text>
          <Text style={styles.infoValue}>
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : 'N/A'}
          </Text>
        </View>
      </Card>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={
            saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'saved'
              ? '✓ Saved'
              : 'Save Preferences'
          }
          size="large"
          onPress={handleSavePreferences}
          disabled={saving || saveStatus === 'saving'}
        />
        <Button
          title="Sign Out"
          variant="outline"
          size="large"
          onPress={handleSignOut}
          style={{ marginTop: 12 }}
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHelper: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    marginTop: -8,
  },
  preferenceCard: {
    marginBottom: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceContent: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  preferenceHelper: {
    fontSize: 13,
    color: '#6B7280',
  },
  timeSelectCard: {
    marginBottom: 16,
    borderColor: '#BFDBFE',
  },
  quietHourLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  timeOptionSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  privacyCard: {
    marginBottom: 16,
    borderColor: '#E5E7EB',
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  infoCard: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  footer: {
    paddingBottom: 32,
  },
});
