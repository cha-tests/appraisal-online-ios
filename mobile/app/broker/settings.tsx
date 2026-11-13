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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { TextInput } from '../../components/ui/TextInput';
import { LoadError } from '../../components/ui/LoadError';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { accountService } from '../../services/account.service';
import { signOut } from '../../services/supabase';
import { withTimeout } from '../../services/withTimeout';
import { beginSignOut } from '../../utils/signOutGuard';
import { BrokerProfile } from '../../types';
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { BROKER_DISCLAIMER_TEXT } from '../../config/disclaimers';
import { formatPriceCents, getBrokerAnnualPrice } from '../../config/brokerTiers';
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

export default function BrokerSettings() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const brokerProfile = useAuthStore((state) => state.brokerProfile);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: false, // SMS isn't offered on any tier any more (migration 034)
    quietHoursEnabled: false,
    quietHours: '6:00 PM - 8:00 AM',
    digestTime: '09:00',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);
        setLoadError(false);
        const { profile: fetchedProfile } = await withTimeout(brokerService.getProfile(user.id));

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
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id, reloadToken]);

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

  // Fetches the real export bundle (export_my_data(), migration 042) and
  // hands it to the OS share sheet as a .json file — same
  // generate-locally-then-Sharing.shareAsync pattern pdf.service.ts already
  // uses for report PDFs, just with JSON instead of a rendered PDF.
  const handleExportData = async () => {
    try {
      setExporting(true);
      const result = await accountService.exportMyData();
      if (!result.success || !result.data) {
        Alert.alert('Export Failed', result.error || 'Could not export your data. Please try again.');
        return;
      }

      const fileName = `appraisal-online-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(result.data, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Export Ready', `Your data was saved as ${fileName}, but sharing isn't available on this device.`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const performAccountDeletion = async () => {
    setDeleting(true);
    // Per deleteMyAccount()'s own doc comment: call this BEFORE the delete
    // call, same as the normal sign-out flow, so the stale-redirect guard
    // doesn't race a competing redirect once the account is gone.
    beginSignOut();
    const result = await accountService.deleteMyAccount();
    if (result.success) {
      // NOTE: broker/_layout.tsx's RequireUserType redirects to /auth/login
      // itself the moment `user` goes null, and (unlike consumer's
      // useRequireAccount) never checks isSigningOut() — so that redirect
      // can still win the race against this explicit one, landing on
      // /auth/login instead of /welcome. Reproduced locally; reordering
      // clear()/replace() here didn't change the outcome either way, so
      // this is RequireUserType's own gap, not fixable from this screen.
      // Flagged for a follow-up there rather than fixed here (out of this
      // change's scope). Either destination is a dead end for a just-
      // deleted account, so this isn't a functional break, just not the
      // exact screen asked for.
      useAuthStore.getState().clear();
      router.replace('/welcome');
    } else {
      // Nothing was cleared on failure — the user is still signed in, so
      // just let them retry.
      setDeleting(false);
      Alert.alert('Could Not Delete Account', result.error || 'Something went wrong. Please try again.');
    }
  };

  // Irreversible, so this is a deliberate two-step confirmation rather than
  // a single destructive button — never fire on one tap.
  const handleRequestDeletion = () => {
    Alert.alert(
      'Delete Your Account',
      'Your account and personal information will be deleted. Some anonymized records may be retained as required. ' +
        "If you have an active or claimed lead, the homeowner's own record of it is kept (with your identifying details removed) rather than erased.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: confirmAccountDeletion },
      ]
    );
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      'Are You Sure?',
      'This is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: performAccountDeletion },
      ]
    );
  };

  if (loadError) {
    return (
      <SafeAreaWrapper>
        <LoadError
          message="Couldn't load your settings. Check your connection and try again."
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      </SafeAreaWrapper>
    );
  }

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
        title={exporting ? 'Preparing Export...' : 'Export My Data'}
        variant="outline"
        size="medium"
        onPress={handleExportData}
        disabled={exporting}
        style={{ marginBottom: 12 }}
      />

      <Card variant="outlined" style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Delete Account</Text>
        <Text style={styles.dangerText}>
          Permanently delete your account and personal information. This cannot be undone.
        </Text>
        <Button
          title={deleting ? 'Deleting...' : 'Request Deletion'}
          variant="outline"
          size="medium"
          onPress={handleRequestDeletion}
          disabled={deleting}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Legal */}
      <Text style={styles.sectionTitle}>📄 Legal</Text>

      <View style={styles.legalLinkItem}>
        <Text style={styles.legalLinkText}>Terms of Service</Text>
        <Button
          title="View"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/terms-of-service')}
        />
      </View>

      <View style={styles.legalLinkItem}>
        <Text style={styles.legalLinkText}>Privacy Policy</Text>
        <Button
          title="View"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/privacy-policy')}
        />
      </View>

      <View style={[styles.legalLinkItem, { marginBottom: 24 }]}>
        <Text style={styles.legalLinkText}>Professional Terms</Text>
        <Button
          title="View"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/professional-terms')}
        />
      </View>

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

      {/* Standing proof of this broker's intro-rate signup, same spirit as
          the old founding-member card — the onboarding Alert is a one-time
          "congratulations" moment; this is the lasting record. Honest about
          it not being locked for life, unlike the old ₱5,000 system this
          replaced (migration 034): the rate is intro pricing through
          Dec 31, 2026, not a permanent lock. */}
      {profile?.signup_rank && (
        <Card variant="outlined" style={styles.founderCard}>
          <View style={styles.infoRow}>
            <Text style={styles.founderLabel}>🎉 Signup #{profile.signup_rank}</Text>
            <Text style={styles.founderValue}>
              {formatPriceCents(getBrokerAnnualPrice(profile.signup_rank))}/yr intro rate
            </Text>
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
  dangerCard: {
    marginBottom: 16,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  dangerText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  legalLinkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  legalLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
  },
  footer: {
    paddingBottom: 32,
  },
});
