import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { Toggle } from '../../components/ui/Toggle';
import { useReportStore } from '../../stores/report.store';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/report.service';

export default function BrokerOptins() {
  const router = useRouter();
  const report = useReportStore((state) => state.currentReport);
  // Collected once at signup (see auth/signup.tsx) so it doesn't need to be
  // re-typed here — this screen's opt-in toggle is what actually gates
  // whether it ever gets shared, not whether it's on file.
  const savedPhone = useAuthStore((state) => state.user?.phone);
  const [optedIn, setOptedIn] = useState(false);
  // Fallback manual entry only for accounts that predate phone-at-signup
  // (savedPhone is empty) — new consumers never see this field.
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleContinue = async () => {
    try {
      setLoading(true);
      setError('');

      let phoneToSave: string | undefined;
      if (optedIn) {
        if (savedPhone) {
          // Already validated at signup — nothing to re-check here.
          phoneToSave = savedPhone;
        } else if (phone) {
          // Legacy-account fallback path only (see savedPhone comment above).
          const digitCount = phone.replace(/\D/g, '').length;
          if (digitCount < 7 || digitCount > 15) {
            setError('Please enter a valid mobile number');
            return;
          }
          phoneToSave = phone;
        }
      }

      // Update report with opt-in status
      const result = await reportService.updateBrokerOptIn(report.id, optedIn, phoneToSave);

      if (result.success) {
        router.push('/consumer/confirmation');
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
      await reportService.updateBrokerOptIn(report.id, false);
      router.push('/consumer/confirmation');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Want professional help?</Text>
        <Text style={styles.subtitle}>
          Optionally connect with local real estate professionals who can provide guidance on your property.
        </Text>
      </View>

      {/* Licensing Reminder */}
      <Card variant="outlined" style={styles.licenseCard}>
        <Text style={styles.licenseTitle}>⚠️ Verify Before You Engage</Text>
        <Text style={styles.licenseText}>
          Only work with licensed real estate brokers, agencies, and appraisers. Ask for
          proof of license and verify it with your local regulatory authority before
          sharing personal information or signing anything.
        </Text>
      </Card>

      {/* Opt-in Card */}
      <Card variant="elevated" style={styles.optInCard}>
        <View style={styles.checkboxRow}>
          <Text style={styles.checkboxLabel}>
            I'd like local professionals to contact me
          </Text>
          <Toggle value={optedIn} onToggle={setOptedIn} />
        </View>
      </Card>

      {/* Phone: saved-at-signup number shown read-only, or a fallback entry
          field for accounts created before phone-at-signup existed. */}
      {optedIn && (
        <View style={styles.phoneSection}>
          {savedPhone ? (
            <>
              <Text style={styles.phoneLabel}>We'll share this number</Text>
              <Text style={styles.savedPhoneValue}>{savedPhone}</Text>
              <Text style={styles.phoneHelper}>
                Only shared with a professional because you're opting in here.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.phoneLabel}>Phone Number (Optional)</Text>
              <TextInput
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                error={error && error.includes('mobile number') ? error : undefined}
              />
              <Text style={styles.phoneHelper}>
                We'll only share your phone number with professionals if you provide it. Your data is always private and secure.
              </Text>
            </>
          )}
        </View>
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
      {error && !error.includes('mobile number') && (
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
  licenseCard: {
    marginBottom: 24,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  licenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  licenseText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  optInCard: {
    marginBottom: 24,
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
  savedPhoneValue: {
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  phoneHelper: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 18,
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
