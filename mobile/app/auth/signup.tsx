import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CurrencyValue } from '../../components/ui/CurrencyValue';
import { useAuthStore } from '../../stores/auth.store';
import { useReportStore } from '../../stores/report.store';
import { authService } from '../../services/auth.service';
import { checkPasswordBreach } from '../../services/passwordBreach.service';
import { formatCurrency } from '../../config/marketConfig';
import {
  completePendingValuation,
  stashPendingValuation,
} from '../../services/pendingValuationCompletion';
import { theme } from '../../theme';

/**
 * Sign-up gate — screen 3 of 3 of the valuation flow, reached from
 * loading.tsx once a guest's Gemini valuation has come back (see
 * report.store.ts's pendingValuation). This is a repositioning, not just a
 * restyle: today's app makes signup a route you pass BEFORE valuing
 * anything; here the account wall comes AFTER, with the real value blurred
 * behind it (see the README's "Signup gates the report, not the flow").
 *
 * Reached any other way (a broker signing up, or a consumer tapping "Sign
 * Up" from the login screen with nothing pending) falls through to the
 * original type-selection form further down, unchanged.
 */
function GateScreen() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const currentProperty = useReportStore((state) => state.currentProperty);
  const currentPropertyDetails = useReportStore((state) => state.currentPropertyDetails);
  const pendingValuation = useReportStore((state) => state.pendingValuation);
  const setCurrentReport = useReportStore((state) => state.setCurrentReport);
  const setCurrentProperty = useReportStore((state) => state.setCurrentProperty);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [gateError, setGateError] = useState('');
  // Never pre-checked — same rule as every other consent checkbox in this
  // app (see broker-optins.tsx's disclaimer, CLAUDE.md's "Never pre-check a
  // consent checkbox").
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  if (!currentProperty || !currentPropertyDetails || !pendingValuation) {
    // Shouldn't happen (loading.tsx only routes here once all three are
    // set), but a stale deep link or a killed-and-reopened app could land
    // here with nothing to gate — send back to Home rather than crash.
    return null;
  }

  const countryCode = currentProperty.address_components?.country_code;
  const lowFormatted = formatCurrency(pendingValuation.confidenceRange.low, countryCode);
  const highFormatted = formatCurrency(pendingValuation.confidenceRange.high, countryCode);

  const validate = (): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email';
    const digitCount = phone.replace(/\D/g, '').length;
    if (digitCount < 7) return 'Please enter a valid mobile number';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!agreedToTerms) return 'Please agree to the Terms of Service and Privacy Policy';
    return null;
  };

  const handleCreateAccount = async () => {
    const validationError = validate();
    if (validationError) {
      setGateError(validationError);
      return;
    }

    setGateError('');
    setLoading(true);

    try {
      const breachCheck = await checkPasswordBreach(password);
      if (breachCheck.breached) {
        setGateError(
          'This password has appeared in known data breaches. Please choose a different password.'
        );
        return;
      }

      const result = await authService.signup(email, password, {
        first_name: '',
        last_name: '',
        user_type: 'consumer',
        phone,
      });

      if (!result.success || !result.user) {
        setGateError(result.error?.message || 'Unable to create account');
        return;
      }

      const payload = { property: currentProperty, details: currentPropertyDetails, valuation: pendingValuation };

      if (result.needsEmailConfirmation) {
        // No session yet — can't write properties/reports (NOT NULL
        // user_id). Stash to disk since Zustand state won't survive the
        // user leaving to check their inbox; auth/login.tsx finishes the
        // job on their first real sign-in.
        await stashPendingValuation(payload);
        router.replace({
          pathname: '/auth/verify-email',
          params: { email, hasPendingValuation: '1' },
        });
        return;
      }

      setUser(result.user);
      const completion = await completePendingValuation(result.user.id, payload);
      if (!completion.success) {
        setGateError(completion.error);
        return;
      }

      setCurrentProperty(completion.property);
      setCurrentReport(completion.report);
      // pendingValuation's job is done — currentReport is now the real,
      // persisted record report-view.tsx reads.
      useReportStore.setState({ pendingValuation: null });
      router.replace('/consumer/report-view');
    } catch (err) {
      console.error('Gate signup error:', err);
      setGateError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      <ProgressBar progress={100} label="3 of 3" />

      <Text style={styles.gateAddress}>{currentProperty.address}</Text>

      <View style={styles.valueCard}>
        <Text style={styles.valueLabel}>Estimated value</Text>
        <View style={styles.blurTarget}>
          <CurrencyValue
            amountMinorUnits={pendingValuation.estimatedValue}
            countryCode={countryCode}
            style={styles.valueFigure}
          />
          <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.blurTargetRange}>
          <Text style={styles.rangeText}>
            Range {lowFormatted} – {highFormatted}
          </Text>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        </View>
      </View>

      <Text style={styles.gateHeading}>Create your account to see it</Text>
      <Text style={styles.gateSubtitle}>Free — takes less than a minute.</Text>

      <View style={styles.form}>
        <TextInput
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />
        <PhoneInput label="Mobile number" value={phone} onChangeText={setPhone} editable={!loading} />
        <TextInput
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.gateTermsRow}
          onPress={() => setAgreedToTerms((prev) => !prev)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
            {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.gateTermsText}>
            I agree to the{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/public/terms-of-service')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/public/privacy-policy')}>
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        {!!gateError && <Text style={styles.gateErrorText}>{gateError}</Text>}

        <Button
          title={loading ? 'Creating account…' : 'Create account and see value'}
          size="large"
          onPress={handleCreateAccount}
          disabled={loading}
          style={{ marginTop: theme.space.md }}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Text
          style={styles.footerLink}
          onPress={() => {
            // The valuation stays in memory — coming back here after
            // logging in elsewhere isn't the expected path, but clearing it
            // would silently lose work if they do.
            router.push('/auth/login');
          }}
        >
          Log in
        </Text>
      </View>
    </SafeAreaWrapper>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const pendingValuation = useReportStore((state) => state.pendingValuation);
  const currentProperty = useReportStore((state) => state.currentProperty);
  const currentPropertyDetails = useReportStore((state) => state.currentPropertyDetails);

  // Choose role (welcome.tsx) already asked a broker which path they're on —
  // arriving here with that answer in hand should skip asking a second time.
  const { userType: userTypeParam } = useLocalSearchParams<{ userType?: string }>();
  const [userType, setUserType] = useState<'consumer' | 'broker' | null>(
    userTypeParam === 'broker' || userTypeParam === 'consumer' ? userTypeParam : null
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Consumer-only — see the phone comment on the User type. Brokers already
  // provide a phone number during broker/onboarding.tsx, so asking again
  // here would be a duplicate prompt for that account type.
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Never pre-checked — see the same field on GateScreen above.
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // A guest who just generated a valuation reaches this route with all
  // three of these set (see loading.tsx) — render the gate instead of the
  // generic broker/consumer type-selection form below.
  if (pendingValuation && currentProperty && currentPropertyDetails) {
    return <GateScreen />;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!userType) {
      newErrors.userType = 'Please select account type';
    }

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (userType === 'consumer') {
      if (!phone.trim()) {
        newErrors.phone = 'Mobile number is required';
      } else {
        // 7-15 digits accepts PH's 11-digit mobile format (09XXXXXXXXX),
        // US/CA's 10-digit format, and other international lengths —
        // matches the E.164 international max of 15 digits rather than
        // assuming one country's convention.
        const digitCount = phone.replace(/\D/g, '').length;
        if (digitCount < 7 || digitCount > 15) {
          newErrors.phone = 'Please enter a valid mobile number';
        }
      }
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreedToTerms) {
      newErrors.terms = 'Please agree to the Terms of Service and Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const breachCheck = await checkPasswordBreach(password);
      if (breachCheck.breached) {
        setErrors((prev) => ({
          ...prev,
          password: 'This password has appeared in known data breaches. Please choose a different password.',
        }));
        return;
      }

      const result = await authService.signup(email, password, {
        first_name: firstName,
        last_name: lastName,
        user_type: userType!,
        // Brokers provide their phone during onboarding instead — see the
        // field's own comment above for why it's consumer-only here.
        phone: userType === 'consumer' ? phone : undefined,
      });

      if (result.success && result.user) {
        if (result.needsEmailConfirmation) {
          router.replace({ pathname: '/auth/verify-email', params: { email } });
          return;
        }

        setUser(result.user);
        // Route based on user type
        if (userType === 'broker') {
          router.replace('/broker/onboarding');
        } else {
          router.replace('/consumer/home');
        }
      } else {
        Alert.alert('Signup Failed', result.error?.message || 'Unable to create account');
      }
    } catch (err) {
      console.error('Signup error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!userType) {
    return (
      <SafeAreaWrapper scrollable>
        <View style={styles.header}>
          <Button
            title="← Back"
            variant="outline"
            size="small"
            onPress={() => router.back()}
            style={{ alignSelf: 'flex-start', marginBottom: 20 }}
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Choose your account type</Text>
        </View>

        <View style={styles.typeSelection}>
          <Card
            variant={userType === 'consumer' ? 'elevated' : 'default'}
            style={[
              styles.typeCard,
              userType === 'consumer' && styles.typeCardSelected,
            ]}
          >
            <Button
              title="🏠 I'm a Homeowner"
              variant="outline"
              size="large"
              onPress={() => setUserType('consumer')}
            />
            <Text style={styles.typeDescription}>
              Get free AI valuations and connect with professionals
            </Text>
          </Card>

          <Card
            variant={userType === 'broker' ? 'elevated' : 'default'}
            style={[
              styles.typeCard,
              userType === 'broker' && styles.typeCardSelected,
            ]}
          >
            <Button
              title="🏢 I'm a Real Estate Pro"
              variant="outline"
              size="large"
              onPress={() => setUserType('broker')}
            />
            <Text style={styles.typeDescription}>
              Get qualified leads and grow your business
            </Text>
          </Card>
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
          onPress={() => router.replace('/welcome')}
          style={{ alignSelf: 'flex-start', marginBottom: 16 }}
        />
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>
          {userType === 'consumer' ? 'Homeowner' : 'Real Estate Professional'} Account
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
          editable={!loading}
          error={errors.firstName}
        />

        <TextInput
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
          editable={!loading}
          error={errors.lastName}
          style={{ marginTop: 12 }}
        />

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          error={errors.email}
          style={{ marginTop: 12 }}
        />

        <TextInput
          placeholder="Password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          error={errors.password}
          style={{ marginTop: 12 }}
        />

        <TextInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
          error={errors.confirmPassword}
          style={{ marginTop: 12 }}
        />

        {userType === 'consumer' && (
          <View style={{ marginTop: 12 }}>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              editable={!loading}
              error={errors.phone}
            />
            <Text style={styles.phoneHelper}>
              Only shared with a professional if you opt in to be contacted on a report.
            </Text>
          </View>
        )}

        {/* Terms Agreement — a real checkbox, not just informational text:
            explicit, required, never pre-checked (see CLAUDE.md's "Never
            pre-check a consent checkbox"). */}
        <Card variant="outlined" style={styles.termsCard}>
          <TouchableOpacity
            style={styles.termsCheckboxRow}
            onPress={() => setAgreedToTerms((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/public/terms-of-service')}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/public/privacy-policy')}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
        </Card>
        {!!errors.terms && <Text style={styles.errorMessage}>{errors.terms}</Text>}

        <Button
          title={loading ? 'Creating Account...' : 'Create Account'}
          size="large"
          onPress={handleSignup}
          disabled={loading}
          style={{ marginTop: 20 }}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    color: '#6B7280',
  },
  typeSelection: {
    gap: 12,
  },
  typeCard: {
    padding: 0,
  },
  typeCardSelected: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  typeDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  phoneHelper: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  termsCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginTop: 16,
  },
  termsCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  termsText: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 18,
    flex: 1,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorMessage: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  // --- Gate ---
  gateAddress: {
    ...theme.type.heading,
    color: theme.color.text,
    marginBottom: theme.space.lg,
  },
  gateTermsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.space.md,
  },
  gateTermsText: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: theme.color.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: theme.color.text,
    borderColor: theme.color.text,
  },
  checkmark: {
    color: theme.color.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  valueCard: {
    ...theme.type.body,
    alignItems: 'center',
    marginBottom: theme.space['2xl'],
  },
  valueLabel: {
    ...theme.type.eyebrow,
    color: theme.color.textMuted,
    marginBottom: theme.space.sm,
  },
  blurTarget: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.sm,
  },
  blurTargetRange: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueFigure: {
    ...theme.type.hero,
    color: theme.color.text,
  },
  rangeText: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
  },
  gateHeading: {
    ...theme.type.title,
    color: theme.color.text,
    marginBottom: theme.space.xs,
  },
  gateSubtitle: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
    marginBottom: theme.space.xl,
  },
  gateErrorText: {
    ...theme.type.bodySm,
    color: theme.color.danger,
    marginTop: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  footerLink: {
    ...theme.type.bodySm,
    fontFamily: theme.font.bodySemibold,
    color: theme.color.text,
    textDecorationLine: 'underline',
  },
});
