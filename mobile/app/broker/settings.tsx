import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
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
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { BROKER_DISCLAIMER_TEXT } from '../../config/disclaimers';
import { theme } from '../../theme';

const KYC_STATUS_LABEL: Record<string, string> = {
  pending: '⏳ Under review',
  approved: '✅ Verified',
  rejected: '⚠️ Needs another submission',
};

// kyc_status defaults to 'pending' in the DB even before a broker has ever
// submitted anything (KYC is optional — see onboarding.tsx), so the raw
// status alone can't tell "awaiting review" apart from "never submitted".
// kyc_submitted_at is only ever set by submitKyc(), which is what actually
// distinguishes the two.
function kycStatusLabel(profile: BrokerProfile | null): string {
  if (profile?.kyc_status === 'pending' && !profile?.kyc_submitted_at) {
    return 'Not submitted';
  }
  return KYC_STATUS_LABEL[profile?.kyc_status || 'pending'];
}

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

  // RN's Share API has no native share sheet on web unless the browser
  // itself supports navigator.share (most desktop browsers don't) —
  // Share.share() rejects in that case rather than silently no-opping, so
  // this needs a real fallback rather than letting it throw uncaught.
  const handleShareReferralCode = async () => {
    const code = profile?.referral_code;
    if (!code) return;
    try {
      await Share.share({
        message: `I've been using Appraisal Online to get property leads in my city. Use my referral code ${code} when you sign up as a broker or agent.`,
      });
    } catch (err) {
      Alert.alert('Sharing not available', `Your code is ${code} — copy it from the box above instead.`);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.back()}>
      {/* Header */}
      <View style={styles.header}>
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
          {/* profile?.tier (persisted) rather than selectedTier (only ever
              set during the live onboarding session, so it reads back as
              null and falls back to the generic label after any app
              reload — e.g. right after signing in on a new session). */}
          <Text style={styles.infoValue}>{profile?.tier || 'Broker'}</Text>
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

      {/* Verification status */}
      <Card variant="default" style={{ marginBottom: 16 }}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Verification Status</Text>
          <Text style={styles.infoValue}>{kycStatusLabel(profile)}</Text>
        </View>
        {profile?.kyc_status === 'pending' && profile?.kyc_submitted_at && (
          <Text style={styles.kycDetail}>
            Submitted {new Date(profile.kyc_submitted_at).toLocaleDateString()} — we'll notify you
            once it's reviewed.
          </Text>
        )}
        {profile?.kyc_status === 'rejected' && (
          <Text style={styles.kycDetail}>
            {profile.kyc_rejection_reason || 'Your submitted documents could not be verified.'}{' '}
            Contact support@appraisalonline.com to resubmit.
          </Text>
        )}
      </Card>

      {/* Refer a colleague — item #8 from the synthetic user report:
          discovery on both sides of this marketplace was overwhelmingly
          peer-to-peer, not paid marketing, so this just rides that channel
          rather than trying to redirect it. No reward/incentive wired up
          here — referred_by is attribution only (see migration 030). */}
      {!!profile?.referral_code && (
        <Card variant="default" style={{ marginBottom: 16 }}>
          <Text style={styles.referralTitle}>Refer a Colleague</Text>
          <Text style={styles.referralText}>
            Know another broker or agent who'd want leads in their city? Share your code — they can
            enter it when they sign up.
          </Text>
          <View style={styles.referralCodeRow}>
            <Text style={styles.referralCode}>{profile.referral_code}</Text>
          </View>
          <Button
            title="Share My Code"
            variant="outline"
            size="small"
            onPress={handleShareReferralCode}
          />
        </Card>
      )}

      {/* Upgrade path for a broker who signed up on the Free plan — reuses
          the same paywall/checkout screens as signup, just entered from
          here instead. */}
      {profile?.tier === 'Basic Annual' && (
        <Card variant="outlined" style={styles.upgradeCard}>
          <Text style={styles.upgradeTitle}>You're on the Free plan</Text>
          <Text style={styles.upgradeText}>
            Upgrade to Premium for real-time lead notifications, an enhanced profile, and
            quarterly market reports.
          </Text>
          <Button
            title="Upgrade to Premium"
            size="medium"
            onPress={() => {
              useSubscriptionStore.getState().setSelectedTier('Premium Annual');
              router.push('/broker/paywall');
            }}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      {/* Standing proof of the founding-member rate lock — the onboarding
          Alert is a one-time "congratulations" moment; this is the lasting
          record so it's never just forgotten. Only ever shown when the
          claim actually succeeded (see migration 015 / claimFoundingMemberSlot). */}
      {profile?.is_founding_member && (
        <Card variant="outlined" style={styles.founderCard}>
          <View style={styles.infoRow}>
            <Text style={styles.founderLabel}>
              🎉 Founding Member #{profile.founding_member_number}
            </Text>
            <Text style={styles.founderValue}>₱5,000/yr — locked in</Text>
          </View>
        </Card>
      )}

      {/* Re-viewable per the broker disclaimer's placement requirement —
          read-only here, so no checkbox: that gate already happened once
          at signup (see broker/onboarding.tsx). */}
      <DisclaimerNotice title="Platform Disclaimer" text={BROKER_DISCLAIMER_TEXT} />

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
    color: theme.color.textMuted,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 4,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: theme.color.textMuted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHelper: {
    fontSize: 13,
    color: theme.color.textMuted,
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
    color: theme.color.text,
    marginBottom: 4,
  },
  preferenceHelper: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  timeSelectCard: {
    marginBottom: 16,
    borderColor: '#BFDBFE',
  },
  quietHourLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 12,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 8,
  },
  timeOptionSelected: {
    backgroundColor: theme.color.accentWash,
    borderColor: theme.color.accent,
  },
  timeOptionText: {
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: theme.color.accent,
    fontWeight: '600',
  },
  privacyCard: {
    marginBottom: 16,
    borderColor: theme.color.border,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 13,
    color: theme.color.textMuted,
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
    color: theme.color.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
  },
  kycDetail: {
    fontSize: 13,
    color: theme.color.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  referralText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  referralCodeRow: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  referralCode: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.color.text,
  },
  upgradeCard: {
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  upgradeText: {
    fontSize: 13,
    color: theme.color.textMuted,
    lineHeight: 18,
  },
  founderCard: {
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  founderLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  founderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  infoDivider: {
    height: 1,
    backgroundColor: theme.color.border,
    marginVertical: 8,
  },
  footer: {
    paddingBottom: 32,
  },
});
