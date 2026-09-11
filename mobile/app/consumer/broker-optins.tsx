import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Toggle } from '../../components/ui/Toggle';
import { useReportStore } from '../../stores/report.store';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/report.service';
import { useRequireAccount } from '../../hooks/useRequireAccount';
import { disclaimerService } from '../../services/disclaimer.service';
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { CLIENT_DISCLAIMER_TEXT, CLIENT_DISCLAIMER_VERSION } from '../../config/disclaimers';

/** A compact Yes/No pair for the ownership/selling-intent questions. */
function YesNoRow({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (val: boolean) => void;
}) {
  return (
    <View style={styles.yesNoRow}>
      <TouchableOpacity
        style={[styles.yesNoOption, value === true && styles.yesNoOptionActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.yesNoText, value === true && styles.yesNoTextActive]}>Yes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.yesNoOption, value === false && styles.yesNoOptionActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.yesNoText, value === false && styles.yesNoTextActive]}>No</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BrokerOptins() {
  const router = useRouter();
  useRequireAccount();
  const report = useReportStore((state) => state.currentReport);
  const setCurrentReport = useReportStore((state) => state.setCurrentReport);
  // Collected at signup (see auth/signup.tsx) as a starting value — shown
  // here as an editable field (not read-only) so a wrong number or a
  // different country code can be corrected before sharing it with a
  // professional. This screen's opt-in toggle is what actually gates whether
  // it ever gets shared, not whether it's on file.
  const savedPhone = useAuthStore((state) => state.user?.phone);
  const [optedIn, setOptedIn] = useState(false);
  // Gates "Yes, Connect Me" only — declining doesn't involve a broker, so it
  // isn't required on that path. See config/disclaimers.ts for the text.
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);
  // Optional — Clause 5 of the Sep 1 spec doesn't require a phone number to
  // connect with a broker (email is always on file). Pre-filled from
  // savedPhone when it exists, blank for accounts that predate phone-at-signup.
  const [phone, setPhone] = useState(savedPhone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Only ever asked here, alongside the broker opt-in — never on the
  // initial appraisal flow. All optional: none of these gate "Yes, Connect
  // Me" the way the disclaimer checkbox does (see Clause 5 of the Sep 1
  // spec — "don't require that yet... it's only for serious sellers").
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [intendsToSell, setIntendsToSell] = useState<boolean | null>(null);
  const [titleUri, setTitleUri] = useState<string | null>(null);

  const pickTitlePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library access is needed to attach your title.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (!result.canceled && result.assets?.[0]) {
      setTitleUri(result.assets[0].uri);
    }
  };

  if (!report) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>Report not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  // Already decided for this report (e.g. navigating back here after
  // continuing) — show what they agreed to rather than the toggle again.
  // Withdrawing stays possible, just not from this one-time signup step;
  // see account.tsx settings.
  if (report.broker_contact_opted_in) {
    return (
      <SafeAreaWrapper scrollable>
        <BackButton onPress={() => router.push('/consumer/report-view')} />

        {/* Leads with the confirmation itself rather than a "Want
            professional help?" header — that question is already answered
            at this point, so restating it above the answer just buries the
            confirmation the user actually needs to see. */}
        <Card variant="elevated" style={styles.connectedCard}>
          <View style={styles.connectedIconCircle}>
            <Text style={styles.connectedIcon}>✓</Text>
          </View>
          <Text style={styles.connectedTitle}>You're Connected!</Text>
          <Text style={styles.connectedText}>
            You opted in to have local professionals contact you about this property.
          </Text>
          <Text style={styles.connectedHelper}>
            Want to change this? You can manage broker contact anytime from your account
            settings.
          </Text>
        </Card>

        <View style={styles.footer}>
          <Button
            title="Continue"
            size="large"
            onPress={() => router.push('/consumer/report-view')}
          />
        </View>
      </SafeAreaWrapper>
    );
  }

  const handleContinue = async () => {
    try {
      setError('');

      if (optedIn && !disclaimerAcknowledged) {
        setError('Please acknowledge the notice above before connecting with a broker.');
        return;
      }

      setLoading(true);

      let phoneToSave: string | undefined;
      if (optedIn) {
        if (userId) {
          await disclaimerService.acceptDisclaimer(userId, 'client', CLIENT_DISCLAIMER_VERSION, {
            report_id: report.id,
          });
        }
        if (phone) {
          // Optional — only validated when they've actually entered something.
          const digitCount = phone.replace(/\D/g, '').length;
          if (digitCount < 7 || digitCount > 15) {
            setError('Please enter a valid mobile number');
            return;
          }
          phoneToSave = phone;
        }
      }

      // Title upload is optional and never blocks continuing — if it fails,
      // the opt-in itself should still go through.
      let titleUrl: string | undefined;
      if (optedIn && titleUri && userId) {
        const uploaded = await reportService.uploadTitleDocument(userId, report.id, titleUri);
        if (uploaded.success && uploaded.path) {
          titleUrl = uploaded.path;
        } else {
          console.error('Title upload failed (non-blocking):', uploaded.error);
        }
      }

      // Update report with opt-in status
      const result = await reportService.updateBrokerOptIn(
        report.id,
        optedIn,
        phoneToSave,
        optedIn ? isOwner ?? undefined : undefined,
        optedIn ? intendsToSell ?? undefined : undefined,
        titleUrl
      );

      if (result.success) {
        // Without this, confirmation.tsx (and anywhere else reading
        // currentReport) keeps showing the stale pre-opt-in state — the
        // store was never told the update actually happened.
        if (result.report) setCurrentReport(result.report);
        router.push('/consumer/report-view');
      } else {
        setError(result.error?.message || 'Failed to save preferences');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      // Update report with opt-out
      const result = await reportService.updateBrokerOptIn(report.id, false);
      if (result.report) setCurrentReport(result.report);
      router.push('/consumer/report-view');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      <BackButton onPress={() => router.push('/consumer/report-view')} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Want professional help?</Text>
        <Text style={styles.subtitle}>
          Optionally connect with local real estate professionals who can provide guidance on your property.
        </Text>
      </View>

      {/* Opt-in Card */}
      <Card variant="elevated" style={styles.optInCard}>
        <View style={styles.checkboxRow}>
          <Text style={styles.checkboxLabel}>
            I'd like local professionals to contact me
          </Text>
          <Toggle value={optedIn} onToggle={setOptedIn} />
        </View>
      </Card>

      {/* Editable so a wrong number or country code (from signup) can be
          corrected here — optional, so leaving it blank doesn't block
          continuing (see handleContinue). */}
      {optedIn && (
        <View style={styles.phoneSection}>
          <Text style={styles.phoneLabel}>Phone Number (Optional)</Text>
          <PhoneInput
            value={phone}
            onChangeText={setPhone}
            error={error && error.includes('mobile number') ? error : undefined}
          />
          <Text style={styles.phoneHelper}>
            We'll only share your phone number with professionals if you provide it. Your data is always private and secure.
          </Text>
        </View>
      )}

      {/* Ownership, selling intent, and an optional title upload — Clause 5
          of the Sep 1 spec. None of these gate continuing; the title in
          particular is purely an incentive ("brokers prioritize properties
          with titles"), not a requirement. */}
      {optedIn && (
        <View style={styles.qualifySection}>
          <View style={styles.qualifyRow}>
            <Text style={styles.qualifyLabel}>Are you the owner of this property?</Text>
            <YesNoRow value={isOwner} onChange={setIsOwner} />
          </View>

          <View style={styles.qualifyRow}>
            <Text style={styles.qualifyLabel}>Are you selling this property?</Text>
            <YesNoRow value={intendsToSell} onChange={setIntendsToSell} />
          </View>

          <Text style={styles.titleLabel}>Land Title (Optional)</Text>
          <TouchableOpacity style={styles.titleUploadBox} onPress={pickTitlePhoto}>
            {titleUri ? (
              <Image source={{ uri: titleUri }} style={styles.titlePreview} />
            ) : (
              <Text style={styles.titleUploadPrompt}>Tap to attach a photo of your land title</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.titleHelper}>
            Not required — but properties with a title on file are prioritized by our broker
            network. We don't verify titles ourselves; brokers review what's submitted.
          </Text>
        </View>
      )}

      {/* Required before "Yes, Connect Me" — see handleContinue. */}
      {optedIn && (
        <DisclaimerNotice
          title="⚠️ Before You Connect"
          text={CLIENT_DISCLAIMER_TEXT}
          showPrcLink
          acknowledged={disclaimerAcknowledged}
          onToggleAcknowledged={setDisclaimerAcknowledged}
        />
      )}

      {/* Benefits Card */}
      <Card variant="default">
        <Text style={styles.benefitsTitle}>What happens next?</Text>
        <View style={styles.benefitItem}>
          <Text style={styles.benefitBullet}>📧</Text>
          <Text style={styles.benefitText}>
            We'll match you with qualified professionals based on your location
          </Text>
        </View>
        <View style={styles.benefitItem}>
          <Text style={styles.benefitBullet}>📞</Text>
          <Text style={styles.benefitText}>
            They'll reach out via your preferred method (or email if no phone provided)
          </Text>
        </View>
        <View style={styles.benefitItem}>
          <Text style={styles.benefitBullet}>🔒</Text>
          <Text style={styles.benefitText}>
            You're in complete control. You can opt out anytime from your account settings.
          </Text>
        </View>
      </Card>

      {/* Error Message */}
      {!!error && !error.includes('mobile number') && (
        <Text style={styles.errorMessage}>{error}</Text>
      )}

      {/* Actions */}
      <View style={styles.footer}>
        <Button
          title={optedIn ? 'Yes, Connect Me' : 'No Thanks, Continue'}
          size="large"
          onPress={handleContinue}
          loading={loading}
          style={{ marginBottom: 12 }}
        />
        <Text style={styles.skipText}>
          You can always change this later in your account settings
        </Text>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  optInCard: {
    marginBottom: 24,
  },
  connectedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#34D399',
    borderWidth: 2,
    alignItems: 'center',
    paddingVertical: 28,
    marginTop: 12,
    marginBottom: 24,
  },
  connectedIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectedIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  connectedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 10,
    textAlign: 'center',
  },
  connectedText: {
    fontSize: 15,
    color: '#065F46',
    lineHeight: 21,
    marginBottom: 14,
    textAlign: 'center',
  },
  connectedHelper: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  phoneSection: {
    marginBottom: 24,
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  phoneHelper: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 18,
  },
  qualifySection: {
    marginBottom: 24,
  },
  qualifyRow: {
    marginBottom: 16,
  },
  qualifyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  yesNoOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  yesNoOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  yesNoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  yesNoTextActive: {
    color: '#2563EB',
  },
  titleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  titleUploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  titleUploadPrompt: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  titlePreview: {
    width: '100%',
    height: 140,
  },
  titleHelper: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    lineHeight: 17,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  benefitBullet: {
    fontSize: 20,
    marginRight: 12,
    marginTop: -2,
  },
  benefitText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    marginBottom: 32,
    marginTop: 24,
  },
  skipText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
  },
});
