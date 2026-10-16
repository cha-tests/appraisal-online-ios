import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Toggle } from '../../components/ui/Toggle';
import { AttachmentPreview } from '../../components/ui/AttachmentPreview';
import { useReportStore } from '../../stores/report.store';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/report.service';
import { useRequireAccount } from '../../hooks/useRequireAccount';
import { disclaimerService } from '../../services/disclaimer.service';
import { DisclaimerNotice } from '../../components/ui/DisclaimerNotice';
import { CLIENT_DISCLAIMER_TEXT, CLIENT_DISCLAIMER_VERSION } from '../../config/disclaimers';
import { chooseAttachmentSource, withRetry, PickedAttachment } from '../../utils/attachments';
import { theme } from '../../theme';

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
  // Pre-filled from savedPhone when it exists, blank for accounts that
  // predate phone-at-signup. Whether this actually gets sent to a broker is
  // gated by sharePhone below, not by whether this field has a value —
  // email is always on file either way (Clause 5 of the Sep 1 spec).
  const [phone, setPhone] = useState(savedPhone || '');
  // Never pre-checked — sharing a phone number with a broker is its own
  // consent decision, separate from the broker-contact opt-in itself (see
  // CLAUDE.md's "Consent" rule).
  const [sharePhone, setSharePhone] = useState(false);
  // Mandatory once opted in, but no default — left blank until the
  // consumer actively enters a number (see handleContinue's validation).
  const [brokerCount, setBrokerCount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Only ever asked here, alongside the broker opt-in — never on the
  // initial appraisal flow. All optional: none of these gate "Yes, Connect
  // Me" the way the disclaimer checkbox does (see Clause 5 of the Sep 1
  // spec — "don't require that yet... it's only for serious sellers").
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [intendsToSell, setIntendsToSell] = useState<boolean | null>(null);
  const [titleFile, setTitleFile] = useState<{
    uri: string;
    mimeType: string;
    name?: string;
    isImage: boolean;
  } | null>(null);
  // Set once uploadTitleDocument's upload actually succeeds — handleContinue
  // reads this directly instead of re-uploading at submit time.
  const [titleUploadPath, setTitleUploadPath] = useState<string | null>(null);
  const [titleUploadStatus, setTitleUploadStatus] = useState<'uploading' | 'uploaded' | 'error' | null>(null);
  // Bumped on every pick/remove so a slow upload that resolves after the
  // file was replaced or cleared doesn't clobber the newer state.
  const titleGenRef = useRef(0);

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
      <SafeAreaWrapper scrollable onBackPress={() => router.push('/consumer/report-view')}>
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

  // Uploads immediately on pick rather than staging it for handleContinue —
  // the storage round-trip already has its own success/failure feedback
  // (and a retry), and deferring it would mean the whole opt-in waits on a
  // slow upload at the one moment the consumer wants to finish quickly.
  const uploadTitleDocument = (picked: PickedAttachment) => {
    if (!userId) return;
    const myGen = ++titleGenRef.current;

    setTitleFile({ uri: picked.uri, mimeType: picked.mimeType, name: picked.name, isImage: picked.isImage });
    setTitleUploadPath(null);
    setTitleUploadStatus('uploading');

    withRetry(() => reportService.uploadTitleDocument(userId, report.id, picked.uri, picked.mimeType)).then(
      (result) => {
        // Superseded by a newer pick or a remove while this was in flight.
        if (titleGenRef.current !== myGen) return;
        setTitleUploadPath(result.success ? result.path ?? null : null);
        setTitleUploadStatus(result.success ? 'uploaded' : 'error');
      }
    );
  };

  const pickTitleDocument = async () => {
    const picked = await chooseAttachmentSource({
      title: 'Attach Your Land Title',
      allowCamera: true,
      allowLibrary: true,
      allowFiles: true,
    });
    if (!picked) return;
    uploadTitleDocument(picked);
  };

  const retryTitleUpload = () => {
    if (titleFile) uploadTitleDocument(titleFile);
  };

  const removeTitleDocument = () => {
    titleGenRef.current++; // invalidate any in-flight upload
    setTitleFile(null);
    setTitleUploadPath(null);
    setTitleUploadStatus(null);
  };

  const handleContinue = async () => {
    try {
      setError('');

      if (optedIn && !disclaimerAcknowledged) {
        setError('Please acknowledge the notice above before connecting with a broker.');
        return;
      }

      let brokerCountToSave: number | undefined;
      if (optedIn) {
        const parsedCount = parseInt(brokerCount, 10);
        if (!brokerCount.trim() || !Number.isInteger(parsedCount) || parsedCount < 1) {
          setError('Please enter how many professionals you want to connect with.');
          return;
        }
        brokerCountToSave = parsedCount;
      }

      setLoading(true);

      let phoneToSave: string | undefined;
      if (optedIn) {
        if (userId) {
          await disclaimerService.acceptDisclaimer(userId, 'client', CLIENT_DISCLAIMER_VERSION, {
            report_id: report.id,
          });
        }
        if (sharePhone) {
          // Only validated when the consumer has actually turned sharing on
          // — the field itself always holds whatever's on file, shared or not.
          const digitCount = phone.replace(/\D/g, '').length;
          if (digitCount < 7 || digitCount > 15) {
            setError('Please enter a valid mobile number');
            return;
          }
          phoneToSave = phone;
        }
      }

      // Already uploaded in the background when picked (see
      // uploadTitleDocument) — optional either way, so one still in flight
      // or that failed just isn't included rather than blocking continuing.
      const titleUrl: string | undefined = optedIn && titleUploadPath ? titleUploadPath : undefined;

      // Update report with opt-in status
      const result = await reportService.updateBrokerOptIn(
        report.id,
        optedIn,
        phoneToSave,
        optedIn ? isOwner ?? undefined : undefined,
        optedIn ? intendsToSell ?? undefined : undefined,
        titleUrl,
        brokerCountToSave
      );

      if (result.success) {
        // Without this, confirmation.tsx (and anywhere else reading
        // currentReport) keeps showing the stale pre-opt-in state — the
        // store was never told the update actually happened.
        if (result.report) setCurrentReport(result.report);

        // Opting in: stay on this screen rather than navigating away —
        // updating currentReport makes report.broker_contact_opted_in true,
        // which re-renders this same component into the "You're Connected"
        // confirmation (see the early-return branch above handleContinue).
        // Navigating to report-view here, like the decline path still does,
        // would skip past that confirmation before it ever showed.
        if (!optedIn) {
          router.push('/consumer/report-view');
        }
      } else {
        setError(result.error?.message || 'Failed to save preferences');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.push('/consumer/report-view')}>
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

      {/* Required whenever optedIn — see handleContinue's validation. Left
          blank rather than defaulted to any number, so the consumer has to
          make an actual choice instead of silently accepting a preset count. */}
      {optedIn && (
        <View style={styles.brokerCountSection}>
          <Text style={styles.brokerCountLabel}>
            How many professionals would you like to connect with?
          </Text>
          <TextInput
            placeholder="e.g., 3"
            value={brokerCount}
            onChangeText={(text) => {
              setBrokerCount(text.replace(/[^\d]/g, ''));
              if (error) setError('');
            }}
            keyboardType="number-pad"
            error={error && error.includes('professionals you want') ? error : undefined}
          />
        </View>
      )}

      {/* Editable so a wrong number or country code (from signup) can be
          corrected here — but whether it's actually sent is its own
          decision via the toggle below, never implied by just having a
          number on file (see CLAUDE.md's "Consent" rule and handleContinue). */}
      {optedIn && (
        <View style={styles.phoneSection}>
          <Text style={styles.phoneLabel}>Phone Number</Text>
          <PhoneInput
            value={phone}
            onChangeText={setPhone}
            error={error && error.includes('mobile number') ? error : undefined}
          />

          <View style={styles.sharePhoneRow}>
            <Text style={styles.sharePhoneLabel}>
              Let a professional call or text me at this number
            </Text>
            <Toggle value={sharePhone} onToggle={setSharePhone} />
          </View>

          <Text style={styles.phoneHelper}>
            {sharePhone
              ? 'This number will be shared with the professional who contacts you.'
              : "This stays private — they'll reach out by email unless you turn this on."}
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
          {titleFile ? (
            <AttachmentPreview
              uri={titleFile.uri}
              isImage={titleFile.isImage}
              fileName={titleFile.name}
              status={titleUploadStatus ?? 'uploaded'}
              onRemove={removeTitleDocument}
              onRetry={retryTitleUpload}
            />
          ) : (
            <TouchableOpacity style={styles.titleUploadBox} onPress={pickTitleDocument}>
              <Text style={styles.titleUploadPrompt}>Tap to attach your land title (photo or file)</Text>
            </TouchableOpacity>
          )}
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
            They'll reach out by email, or by phone too if you choose to share your number
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
      {!!error && !error.includes('mobile number') && !error.includes('professionals you want') && (
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
    color: theme.color.danger,
    marginBottom: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.color.textMuted,
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
    backgroundColor: theme.color.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectedIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.onAccent,
  },
  connectedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.color.successInk,
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
    color: theme.color.textMuted,
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
    color: theme.color.text,
    flex: 1,
  },
  brokerCountSection: {
    marginBottom: 24,
  },
  brokerCountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 12,
  },
  phoneSection: {
    marginBottom: 24,
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 12,
  },
  phoneHelper: {
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  sharePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  sharePhoneLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text,
    flex: 1,
    marginRight: 12,
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
    color: theme.color.text,
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
    borderColor: theme.color.track,
    alignItems: 'center',
    backgroundColor: theme.color.surface,
  },
  yesNoOptionActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accentWash,
  },
  yesNoText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  yesNoTextActive: {
    color: theme.color.accent,
  },
  titleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 10,
  },
  titleUploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.track,
    borderRadius: 12,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    overflow: 'hidden',
  },
  titleUploadPrompt: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  titleHelper: {
    fontSize: 12,
    color: theme.color.textFaint,
    marginTop: 8,
    lineHeight: 17,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
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
    color: theme.color.textMuted,
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
    color: theme.color.textFaint,
  },
  errorMessage: {
    color: theme.color.danger,
    fontSize: 14,
    marginBottom: 16,
  },
});
